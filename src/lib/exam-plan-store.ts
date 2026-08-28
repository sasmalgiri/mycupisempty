/**
 * Exam Plan Store — assembles a real ExamPlanInput from the database.
 *
 * exam-back-planner.ts is pure and knows nothing about Supabase. This module
 * does the gathering: syllabus, exam date, holidays, mastery, adherence, and —
 * the interesting one — the student's MEASURED per-unit timings, which replace
 * the planner's seeded cost estimates.
 *
 * That last part closes loop C. Most planners estimate chapter time once and
 * never revisit it, so a student who is genuinely slower than average spends
 * the year being told she will catch up. Here, every taught unit records
 * time_spent_seconds, and the plan's cost model corrects itself weekly.
 */

import {
  planBackFromExam,
  calibrateCosts,
  estimateMixForSubject,
  normaliseMix,
  DEFAULT_UNIT_COSTS,
  type ChapterWork,
  type BlackoutPeriod,
  type MeasuredCost,
  type ExamPlan,
  type UnitCost,
} from './exam-back-planner';
import { KNOWLEDGE_TYPES, type KnowledgeType } from './conversion-engine';

// ============================================================================
// 1. Measured costs — loop C
// ============================================================================

/**
 * How long this student ACTUALLY takes per unit, by knowledge type.
 *
 * Outliers are trimmed before averaging: a session left open over dinner
 * records forty minutes of "work" that never happened, and a couple of those
 * would tell the planner she needs twice the time she does. We drop anything
 * over 90 minutes outright and take the median rather than the mean.
 */
export async function loadMeasuredCosts(
  supabase: any,
  userId: string,
): Promise<MeasuredCost[]> {
  let rows: any[] = [];
  try {
    const { data } = await supabase
      .from('conversion_outcomes')
      .select('knowledge_type, time_spent_seconds')
      .eq('user_id', userId)
      .gt('time_spent_seconds', 30)      // sub-30s is a mis-click, not a lesson
      .lt('time_spent_seconds', 5400)    // over 90 min is a session left open
      .limit(2000);
    rows = data || [];
  } catch {
    return [];
  }

  const byType = new Map<KnowledgeType, number[]>();
  for (const r of rows) {
    const t = r.knowledge_type as KnowledgeType;
    if (!KNOWLEDGE_TYPES.includes(t)) continue;
    if (!byType.has(t)) byType.set(t, []);
    byType.get(t)!.push(Number(r.time_spent_seconds) / 60);
  }

  const out: MeasuredCost[] = [];
  for (const [knowledgeType, mins] of byType.entries()) {
    if (mins.length < 3) continue; // three points is not a measurement
    out.push({
      knowledgeType,
      samples: mins.length,
      meanTeachMinutes: median(mins),
    });
  }
  return out;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// ============================================================================
// 2. Adherence — what she actually did, not what she meant to do
// ============================================================================

/**
 * Fraction of planned study that actually happened, over the last `days`.
 *
 * Derived from real session minutes against the weekly target. Returns the
 * conservative default when there is too little history — an optimistic
 * default here would quietly inflate every plan.
 */
export async function loadObservedAdherence(
  supabase: any,
  userId: string,
  weeklyMinutesTarget: number,
  days = 28,
): Promise<{ adherence: number; measured: boolean }> {
  if (weeklyMinutesTarget <= 0) return { adherence: 0.7, measured: false };

  const since = new Date(Date.now() - days * 86400000).toISOString();
  try {
    const { data } = await supabase
      .from('conversion_outcomes')
      .select('time_spent_seconds, created_at')
      .eq('user_id', userId)
      .gte('created_at', since)
      .limit(3000);

    const rows = data || [];
    if (rows.length < 5) return { adherence: 0.7, measured: false };

    const actualMinutes = rows.reduce(
      (s: number, r: any) => s + Math.min(Number(r.time_spent_seconds || 0), 5400) / 60,
      0,
    );
    const expectedMinutes = (days / 7) * weeklyMinutesTarget;
    if (expectedMinutes <= 0) return { adherence: 0.7, measured: false };

    // Cap at 1: doing more than planned does not create future capacity.
    const adherence = Math.max(0.1, Math.min(1, actualMinutes / expectedMinutes));
    return { adherence, measured: true };
  } catch {
    return { adherence: 0.7, measured: false };
  }
}

// ============================================================================
// 3. Chapter mix — measured where we have it, prior where we do not
// ============================================================================

export interface ChapterMixResult {
  mix: Partial<Record<KnowledgeType, number>>;
  /** False when the mix came from a measured classification rather than a prior. */
  estimated: boolean;
}

/**
 * Read measured mixes from the classification audit table, keyed by chapter.
 *
 * A chapter that has been through /api/conversion has real per-unit
 * classifications cached; anything else falls back to the subject prior and is
 * flagged, so the UI can say which chapter costs are guesses.
 */
export async function loadChapterMixes(
  supabase: any,
  chapterIds: string[],
): Promise<Map<string, ChapterMixResult>> {
  const out = new Map<string, ChapterMixResult>();
  if (chapterIds.length === 0) return out;

  try {
    const { data } = await supabase
      .from('content_classifications')
      .select('chapter_id, knowledge_type')
      .in('chapter_id', chapterIds)
      .limit(5000);

    const counts = new Map<string, Map<KnowledgeType, number>>();
    for (const r of data || []) {
      if (!r.chapter_id) continue;
      const t = r.knowledge_type as KnowledgeType;
      if (!KNOWLEDGE_TYPES.includes(t)) continue;
      if (!counts.has(r.chapter_id)) counts.set(r.chapter_id, new Map());
      const m = counts.get(r.chapter_id)!;
      m.set(t, (m.get(t) || 0) + 1);
    }

    for (const [chapterId, m] of counts.entries()) {
      const total = Array.from(m.values()).reduce((s, n) => s + n, 0);
      // Under 3 classified units the "measured" mix is noisier than the prior.
      if (total < 3) continue;
      const mix: Partial<Record<KnowledgeType, number>> = {};
      for (const [t, n] of m.entries()) mix[t] = n / total;
      out.set(chapterId, { mix, estimated: false });
    }
  } catch {
    // fall through — every chapter will use its subject prior
  }

  return out;
}

// ============================================================================
// 4. Mastery per chapter
// ============================================================================

/**
 * How much of each chapter is genuinely done, 0..1.
 *
 * Computed from conversion_outcomes rather than the legacy mastery tables,
 * because those key off public.topics, which no migration ever populates.
 *
 * A unit counts as mastered only if it survived the 7-day retention probe.
 * Units taught but not yet probed count as half — real progress, unconfirmed.
 * This is what stops the plan believing a week of enthusiastic covering was
 * the same as learning.
 */
export async function loadChapterMastery(
  supabase: any,
  userId: string,
  chapters: Array<{ id: string; unitCount: number }>,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (chapters.length === 0) return out;

  try {
    const { data } = await supabase
      .from('conversion_outcomes')
      .select('chapter_id, unit_id, immediate_score, retention_score')
      .eq('user_id', userId)
      .in('chapter_id', chapters.map((c) => c.id))
      .limit(5000);

    // Keep the best attempt per unit — a retried unit is not two units.
    const bestPerUnit = new Map<string, { immediate: number; retention: number | null }>();
    for (const r of data || []) {
      if (!r.chapter_id || !r.unit_id) continue;
      const key = `${r.chapter_id}::${r.unit_id}`;
      const immediate = Number(r.immediate_score ?? 0);
      const retention = r.retention_score == null ? null : Number(r.retention_score);
      const prev = bestPerUnit.get(key);
      const score = retention ?? immediate;
      const prevScore = prev ? (prev.retention ?? prev.immediate) : -1;
      if (!prev || score > prevScore) bestPerUnit.set(key, { immediate, retention });
    }

    const credit = new Map<string, number>();
    for (const [key, v] of bestPerUnit.entries()) {
      const chapterId = key.split('::')[0];
      let c = 0;
      if (v.retention != null) {
        c = v.retention >= 0.6 ? 1 : v.retention >= 0.3 ? 0.4 : 0;
      } else {
        // Taught but unconfirmed — real progress, only half believed.
        c = v.immediate >= 0.6 ? 0.5 : 0.2;
      }
      credit.set(chapterId, (credit.get(chapterId) || 0) + c);
    }

    for (const ch of chapters) {
      const earned = credit.get(ch.id) || 0;
      out.set(ch.id, ch.unitCount > 0 ? Math.min(1, earned / ch.unitCount) : 0);
    }
  } catch {
    // no data — everything is unmastered, which is the safe assumption
  }

  return out;
}

// ============================================================================
// 5. Exam date and blackouts
// ============================================================================

const EXAM_KINDS = ['board_exam', 'final_exam', 'pre_board', 'half_yearly', 'mid_term'];
const BREAK_KINDS = ['school_break', 'puja_vacation', 'summer_break', 'public_holiday', 'festival'];

/**
 * Next exam and the breaks between here and it.
 *
 * Breaks are not treated as zero-capacity: Puja vacation is often the single
 * best block of study time in the WB year, so it retains most of its capacity.
 * A public holiday is a normal study day for an exam candidate.
 */
export async function loadCalendar(
  supabase: any,
  params: { boardCode?: string; academicYear?: string; from: string },
): Promise<{ examDate: string | null; examTitle: string | null; blackouts: BlackoutPeriod[] }> {
  try {
    let q = supabase
      .from('curriculum_calendars')
      .select('event_kind, title, start_date, end_date, affects_planner, board_code, academic_year')
      .gte('end_date', params.from)
      .order('start_date', { ascending: true })
      .limit(200);
    if (params.boardCode) q = q.or(`board_code.eq.${params.boardCode},board_code.is.null`);
    if (params.academicYear) q = q.eq('academic_year', params.academicYear);

    const { data } = await q;
    const rows = data || [];

    const exam = rows.find((r: any) => EXAM_KINDS.includes(r.event_kind));
    const blackouts: BlackoutPeriod[] = rows
      .filter((r: any) => BREAK_KINDS.includes(r.event_kind) && r.affects_planner !== false)
      .map((r: any) => ({
        startDate: r.start_date,
        endDate: r.end_date,
        title: r.title,
        // A vacation is study time for an exam candidate, just less of it.
        capacityRetained:
          r.event_kind === 'public_holiday' || r.event_kind === 'festival' ? 0.8 : 0.5,
      }));

    return {
      examDate: exam?.start_date ?? null,
      examTitle: exam?.title ?? null,
      blackouts,
    };
  } catch {
    return { examDate: null, examTitle: null, blackouts: [] };
  }
}

// ============================================================================
// 6. Assemble and plan
// ============================================================================

export interface BuildPlanParams {
  userId: string;
  /** Overrides the calendar lookup when the student names their own date. */
  examDate?: string;
  weeklyMinutesTarget?: number;
  classLevel: number;
  boardCode?: string;
  academicYear?: string;
  /** Restrict to these subject_class ids; defaults to all for the class. */
  subjectClassIds?: string[];
  today?: string;
}

export interface BuildPlanResult {
  plan: ExamPlan | null;
  examDate: string | null;
  examTitle: string | null;
  adherence: { value: number; measured: boolean };
  costs: Record<KnowledgeType, UnitCost>;
  costsCalibrated: boolean;
  /** Chapters whose knowledge mix is a subject prior, not a measurement. */
  estimatedMixChapters: number;
  chapterCount: number;
  error?: string;
}

export async function buildExamPlan(
  supabase: any,
  params: BuildPlanParams,
): Promise<BuildPlanResult> {
  const today = params.today || new Date().toISOString().slice(0, 10);
  const weeklyMinutesTarget = params.weeklyMinutesTarget ?? 300;

  const empty = (error: string): BuildPlanResult => ({
    plan: null, examDate: null, examTitle: null,
    adherence: { value: 0.7, measured: false },
    costs: DEFAULT_UNIT_COSTS, costsCalibrated: false,
    estimatedMixChapters: 0, chapterCount: 0, error,
  });

  // --- Subjects ---------------------------------------------------------
  let subjectRows: any[] = [];
  try {
    let q = supabase
      .from('curriculum_subjects_by_class')
      .select('id, subject_slug, class_level, board_code')
      .eq('class_level', params.classLevel);
    if (params.boardCode) q = q.eq('board_code', params.boardCode);
    const { data } = await q;
    subjectRows = data || [];
  } catch {
    return empty('Could not read the syllabus');
  }

  if (params.subjectClassIds?.length) {
    const keep = new Set(params.subjectClassIds);
    subjectRows = subjectRows.filter((s) => keep.has(s.id));
  }
  if (subjectRows.length === 0) return empty('No subjects found for this class');

  // --- Chapters ---------------------------------------------------------
  let chapterRows: any[] = [];
  try {
    const { data } = await supabase
      .from('curriculum_chapters')
      .select('id, title_en, subject_class_id, exam_weight_pct, prereq_chapter_ids')
      .in('subject_class_id', subjectRows.map((s) => s.id))
      .order('chapter_no', { ascending: true });
    chapterRows = data || [];
  } catch {
    return empty('Could not read the chapters');
  }
  if (chapterRows.length === 0) return empty('No chapters found for these subjects');

  // Unit counts come from the syllabus topic rows.
  const unitCounts = new Map<string, number>();
  try {
    const { data } = await supabase
      .from('curriculum_topics')
      .select('id, chapter_id')
      .in('chapter_id', chapterRows.map((c) => c.id))
      .limit(5000);
    for (const t of data || []) {
      unitCounts.set(t.chapter_id, (unitCounts.get(t.chapter_id) || 0) + 1);
    }
  } catch {
    // fall through — default below
  }

  const subjectById = new Map(subjectRows.map((s) => [s.id, s]));

  // --- Everything else, in parallel -------------------------------------
  const chapterIds = chapterRows.map((c) => c.id);
  const provisional = chapterRows.map((c) => ({
    id: c.id,
    // A topic usually splits into ~2 teachable units; 4 is the floor for a
    // chapter whose topics were never seeded.
    unitCount: Math.max(4, (unitCounts.get(c.id) || 3) * 2),
  }));

  const [measured, adherenceResult, mixes, mastery, calendar] = await Promise.all([
    loadMeasuredCosts(supabase, params.userId),
    loadObservedAdherence(supabase, params.userId, weeklyMinutesTarget),
    loadChapterMixes(supabase, chapterIds),
    loadChapterMastery(supabase, params.userId, provisional),
    params.examDate
      ? Promise.resolve({ examDate: params.examDate, examTitle: 'Your exam', blackouts: [] as BlackoutPeriod[] })
      : loadCalendar(supabase, {
          boardCode: params.boardCode,
          academicYear: params.academicYear,
          from: today,
        }),
  ]);

  const examDate = params.examDate || calendar.examDate;
  if (!examDate) {
    return { ...empty('No exam date found — set one to plan backwards from it'), adherence: { value: adherenceResult.adherence, measured: adherenceResult.measured } };
  }

  // --- Build the work list ----------------------------------------------
  let estimatedMixChapters = 0;
  const chapters: ChapterWork[] = chapterRows.map((c, i) => {
    const subject = subjectById.get(c.subject_class_id);
    const slug = subject?.subject_slug || '';
    const measuredMix = mixes.get(c.id);
    if (!measuredMix) estimatedMixChapters++;

    return {
      id: c.id,
      title: c.title_en,
      subjectName: prettySlug(slug),
      examWeightPct: c.exam_weight_pct ?? null,
      unitCount: provisional[i].unitCount,
      mix: normaliseMix(measuredMix ? measuredMix.mix : estimateMixForSubject(slug)),
      currentMastery: mastery.get(c.id) ?? 0,
      prereqChapterIds: Array.isArray(c.prereq_chapter_ids) ? c.prereq_chapter_ids : [],
    };
  });

  const costs = calibrateCosts(measured);

  const plan = planBackFromExam({
    examDate,
    today,
    weeklyMinutesTarget,
    observedAdherence: adherenceResult.adherence,
    chapters,
    blackouts: calendar.blackouts,
    costs,
  });

  return {
    plan,
    examDate,
    examTitle: calendar.examTitle,
    adherence: { value: adherenceResult.adherence, measured: adherenceResult.measured },
    costs,
    costsCalibrated: measured.length > 0,
    estimatedMixChapters,
    chapterCount: chapters.length,
  };
}

function prettySlug(slug: string): string {
  if (!slug) return 'Subject';
  return slug.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
