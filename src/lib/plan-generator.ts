/**
 * Plan generator — turns a course enrollment + persona + calendar into a
 * concrete week-by-week study plan.
 *
 * Inputs (all read from DB by the API caller, passed in as plain data):
 *   - course        : board / class / language / expected weeks
 *   - subjects[]    : subject_class rows for this course
 *   - chapters[]    : curriculum chapters keyed by subject_class_id
 *   - persona       : persona_profiles row (may be sparse)
 *   - calendars[]   : curriculum_calendars rows for the academic year
 *   - enrollment    : start_date + weekly_minutes_target
 *
 * Output:
 *   weeks[]: [{ weekNo, startDate, endDate, dailyMinutesTarget, blocks: [
 *     { subjectSlug, chapterId, chapterTitle, allocatedMinutes, isReview, mode }
 *   ], notes: string[], isLightWeek?, isAssessmentWeek? }]
 *
 * Design decisions:
 *
 *   1. Non-school days come out of the budget. The planner still allocates
 *      something to a holiday week so the student can use it for review,
 *      but the "expected work" drops to ~30% of normal.
 *
 *   2. Madhyamik / Class-10 courses front-load chapters early in the year and
 *      pad the last 4 weeks with revision so the actual exam window
 *      (Feb 2-12) doesn't fall mid-chapter.
 *
 *   3. Per-subject minute allocation is roughly proportional to total
 *      expected hours of that subject for the class, with a floor of
 *      ~10% per subject so no subject is starved.
 *
 *   4. Chapters within a subject are spread across the year using
 *      season_hint (early/mid/late/flexible) as a primary key, then
 *      chapter_no as tiebreaker. We respect prereq_chapter_ids so a
 *      late-tagged chapter that needs an early-tagged prereq still waits.
 *
 *   5. Method tagging: this generator emits 'persona_default' for every
 *      block. Phase E.5 (method narrowing) consumes the plan and stamps
 *      a chosen_method per topic into student_method_assignments. Keeping
 *      method out of THIS module means the planner can be re-run without
 *      re-deciding methods.
 *
 *   6. Adherence: not computed here. The plan is a static artifact;
 *      adherence is a rolling stat updated when sessions complete.
 *
 * Pure function — easy to unit-test, no I/O. Caller persists.
 */

export interface PlanInput {
  course: {
    boardCode: string;
    classLevel: number;
    language: string;
    expectedWeeks: number;            // default 40
  };
  subjects: Array<{
    id: string;
    subjectSlug: string;
    expectedHoursPerYear: number | null;
    totalChapters: number | null;
  }>;
  chapters: Array<{
    id: string;
    subjectClassId: string;
    chapterNo: number;
    titleEn: string;
    seasonHint: 'early' | 'mid' | 'late' | 'flexible';
    expectedHours: number | null;
    prereqChapterIds: string[];
    examWeightPct: number | null;
    maturityBand: number;
  }>;
  persona: {
    dailyStudyMinutesAvailable: number | null;
    bestStudyTime: string | null;
    energyAfterSchool: number | null;
    effortTolerance: number | null;     // 0..1
    perfectionism: number | null;       // 0..1
  };
  calendars: Array<{
    eventKind: string;
    startDate: string;
    endDate: string;
  }>;
  enrollment: {
    startDate: string;                // 'YYYY-MM-DD'
    weeklyMinutesTarget: number;
    /** Per-subject pace multiplier (0.3..2.0). Subject share is multiplied by this. */
    paceMultipliers?: Record<string, number>;
  };
  /** Optional career-path emphasis from persona_profiles.career_path. */
  careerPath?: string | null;
}

export interface PlanWeek {
  weekNo: number;
  startDate: string;
  endDate: string;
  dailyMinutesTarget: number;
  blocks: PlanBlock[];
  notes: string[];
  isLightWeek?: boolean;
  isAssessmentWeek?: boolean;
}

export interface PlanBlock {
  subjectSlug: string;
  chapterId: string | null;
  chapterTitle: string;
  allocatedMinutes: number;
  isReview: boolean;
  // method is left null here — Phase E.5 fills it.
  method: null;
}

export interface Plan {
  generatorVersion: string;
  generatedAt: string;
  totalWeeks: number;
  weeks: PlanWeek[];
}

const GENERATOR_VERSION = 'v1.1';   // adds pace multipliers + career emphasis
const MIN_SUBJECT_SHARE = 0.10;          // floor share of weekly minutes per subject
const LIGHT_WEEK_FACTOR = 0.30;          // multiplier for holiday-heavy weeks
const REVISION_TAIL_WEEKS = 4;           // last N weeks reserved for revision

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

function dayOverlap(rangeStart: string, rangeEnd: string, eventStart: string, eventEnd: string): number {
  const a = new Date(Math.max(new Date(rangeStart).getTime(), new Date(eventStart).getTime()));
  const b = new Date(Math.min(new Date(rangeEnd).getTime(), new Date(eventEnd).getTime()));
  if (b < a) return 0;
  return Math.floor((b.getTime() - a.getTime()) / 86400000) + 1;
}

/**
 * Given a week's [start, end] window, count how many days are blocked by
 * planner-relevant calendar events and compute a multiplier on the budget.
 */
function weekFactor(weekStart: string, weekEnd: string, calendars: PlanInput['calendars']): { factor: number; reasons: string[] } {
  let blockedDays = 0;
  const reasons: string[] = [];
  for (const ev of calendars) {
    const overlap = dayOverlap(weekStart, weekEnd, ev.startDate, ev.endDate);
    if (overlap > 0) {
      blockedDays += overlap;
      reasons.push(`${ev.eventKind.replace(/_/g, ' ')} (${overlap}d)`);
    }
  }
  if (blockedDays === 0) return { factor: 1, reasons: [] };
  if (blockedDays >= 5) return { factor: LIGHT_WEEK_FACTOR, reasons };
  return { factor: 1 - (blockedDays / 7) * 0.6, reasons };
}

function isAssessmentEvent(kind: string): boolean {
  return ['mid_term', 'half_yearly', 'final_exam', 'pre_board', 'board_exam'].includes(kind);
}

/**
 * Sort chapters into a year-long sequence respecting season_hint and
 * prereq_chapter_ids. Stable on chapter_no within the same season tier.
 */
function orderChapters(chapters: PlanInput['chapters']): PlanInput['chapters'] {
  const seasonRank: Record<string, number> = { early: 1, flexible: 2, mid: 3, late: 4 };
  const ranked = [...chapters].sort((a, b) => {
    const sa = seasonRank[a.seasonHint] ?? 2;
    const sb = seasonRank[b.seasonHint] ?? 2;
    if (sa !== sb) return sa - sb;
    return a.chapterNo - b.chapterNo;
  });
  // Topological pass: if a chapter's prereq isn't already placed, push it back.
  const placed = new Set<string>();
  const out: PlanInput['chapters'] = [];
  let safety = ranked.length * 3;
  while (ranked.length && safety-- > 0) {
    const next = ranked.shift()!;
    const unmet = next.prereqChapterIds.some((p) => !placed.has(p));
    if (unmet) {
      ranked.push(next); // try later
    } else {
      placed.add(next.id);
      out.push(next);
    }
  }
  // Anything left after safety bound: append in given order — better to ship
  // a degraded plan than to loop forever on broken prereqs.
  out.push(...ranked);
  return out;
}

// Per-career subject emphasis. A career boost applies a +0.1 / -0.05 multiplier
// to the corresponding subject's raw share before the floor + renormalize step.
const CAREER_EMPHASIS: Record<string, Record<string, number>> = {
  doctor:           { life_science: 1.30, physical_science: 1.20, science: 1.20, math: 1.10, english: 1.05 },
  engineer:         { math: 1.30, physical_science: 1.25, science: 1.20, english: 1.05 },
  civil_services:   { history: 1.25, geography: 1.25, social: 1.25, english: 1.15, bengali: 1.10 },
  arts_humanities:  { english: 1.25, bengali: 1.25, history: 1.20, geography: 1.10 },
  commerce:         { math: 1.25, english: 1.10, social: 1.10 },
  sports:           { english: 1.05, bengali: 1.05 },
  creative:         { english: 1.20, bengali: 1.20 },
  unsure:           {},
};

/**
 * Distribute subject minutes across the year. Each subject gets a share
 * proportional to its expected_hours_per_year, modified by per-subject pace
 * multipliers and career emphasis, with a MIN_SUBJECT_SHARE floor.
 */
function subjectShares(
  subjects: PlanInput['subjects'],
  paceMultipliers: Record<string, number> = {},
  careerPath: string | null = null,
): Record<string, number> {
  const careerTable = careerPath ? (CAREER_EMPHASIS[careerPath] || {}) : {};
  const total = subjects.reduce((s, x) => s + (x.expectedHoursPerYear || 60), 0);
  const raw: Record<string, number> = {};
  for (const s of subjects) {
    const baseShare = (s.expectedHoursPerYear || 60) / Math.max(1, total);
    const pace = paceMultipliers[s.subjectSlug] ?? 1.0;
    const career = careerTable[s.subjectSlug] ?? 1.0;
    raw[s.id] = baseShare * Math.max(0.3, Math.min(2.0, pace)) * career;
  }
  // Apply floor and re-normalize.
  let remaining = 1;
  for (const s of subjects) {
    if (raw[s.id] < MIN_SUBJECT_SHARE) {
      raw[s.id] = MIN_SUBJECT_SHARE;
    }
    remaining -= raw[s.id];
  }
  if (remaining < 0) {
    // Over-allocated due to floor; renormalize.
    const sum = Object.values(raw).reduce((a, b) => a + b, 0);
    for (const k of Object.keys(raw)) raw[k] /= sum;
  }
  return raw;
}

export function generatePlan(input: PlanInput): Plan {
  const { course, subjects, chapters, persona, calendars, enrollment, careerPath } = input;
  const totalWeeks = course.expectedWeeks || 40;
  const weeks: PlanWeek[] = [];

  // Pre-compute persona-driven daily budget. Use the smaller of:
  //   - persona's declared daily_study_minutes_available
  //   - enrollment's weeklyMinutesTarget / 7
  const personaDaily = persona.dailyStudyMinutesAvailable ?? Math.round(enrollment.weeklyMinutesTarget / 7);
  const enrollDaily = Math.round(enrollment.weeklyMinutesTarget / 7);
  const baselineDaily = Math.min(personaDaily, enrollDaily);

  // Subject -> chapter queues, ordered.
  const chaptersBySubject: Record<string, PlanInput['chapters']> = {};
  for (const s of subjects) chaptersBySubject[s.id] = [];
  for (const c of chapters) (chaptersBySubject[c.subjectClassId] ||= []).push(c);
  for (const sId of Object.keys(chaptersBySubject)) {
    chaptersBySubject[sId] = orderChapters(chaptersBySubject[sId]);
  }
  // Cursors — index into each subject queue
  const cursors: Record<string, number> = {};
  for (const s of subjects) cursors[s.id] = 0;

  // Subject share of daily minutes
  const shares = subjectShares(subjects, enrollment.paceMultipliers, careerPath);

  // Generate week-by-week
  for (let w = 1; w <= totalWeeks; w++) {
    const weekStart = addDays(enrollment.startDate, (w - 1) * 7);
    const weekEnd = addDays(weekStart, 6);
    const factor = weekFactor(weekStart, weekEnd, calendars);

    // Detect assessment-window weeks
    const isAssessmentWeek = calendars.some((ev) =>
      isAssessmentEvent(ev.eventKind) && dayOverlap(weekStart, weekEnd, ev.startDate, ev.endDate) > 0
    );

    // Daily target for this week
    const dailyMinutesTarget = Math.round(baselineDaily * factor.factor);
    const weekMinutes = dailyMinutesTarget * 7;

    // Last REVISION_TAIL_WEEKS weeks: switch to revision-only blocks.
    const isRevisionTail = w > totalWeeks - REVISION_TAIL_WEEKS;

    const blocks: PlanBlock[] = [];
    const notes: string[] = [];
    if (factor.reasons.length) notes.push(`Light week — ${factor.reasons.join(', ')}`);
    if (isAssessmentWeek) notes.push('Assessment / exam window — focus on revision and confidence');
    if (isRevisionTail) notes.push('Revision tail — covering syllabus is done, locking in retention');

    if (isRevisionTail) {
      // Spread revision evenly across all subjects
      const perSubject = Math.round(weekMinutes / Math.max(1, subjects.length));
      for (const s of subjects) {
        blocks.push({
          subjectSlug: s.subjectSlug,
          chapterId: null,
          chapterTitle: 'Revision sweep',
          allocatedMinutes: perSubject,
          isReview: true,
          method: null,
        });
      }
    } else {
      // Normal week: pull next chapter per subject proportional to share
      for (const s of subjects) {
        const minutes = Math.round(weekMinutes * (shares[s.id] || MIN_SUBJECT_SHARE));
        if (minutes <= 0) continue;
        const queue = chaptersBySubject[s.id] || [];
        const cursor = cursors[s.id];
        const ch = queue[cursor] || null;
        if (!ch) {
          // Out of chapters in this subject — fill with review.
          blocks.push({
            subjectSlug: s.subjectSlug,
            chapterId: null,
            chapterTitle: 'Review',
            allocatedMinutes: minutes,
            isReview: true,
            method: null,
          });
          continue;
        }
        // How many minutes does this chapter ask for?
        const chHours = ch.expectedHours || 4;
        const chMinutesNeeded = chHours * 60;
        const allocated = Math.min(minutes, chMinutesNeeded);
        blocks.push({
          subjectSlug: s.subjectSlug,
          chapterId: ch.id,
          chapterTitle: ch.titleEn,
          allocatedMinutes: allocated,
          isReview: false,
          method: null,
        });
        // If the week's allocated portion roughly satisfies this chapter, advance cursor.
        // Track residual on the chapter so we don't double-pay across weeks.
        // Cheap version: advance cursor when allocated >= chMinutesNeeded * 0.7.
        if (allocated >= chMinutesNeeded * 0.7) cursors[s.id] = cursor + 1;
      }
    }

    weeks.push({
      weekNo: w,
      startDate: weekStart,
      endDate: weekEnd,
      dailyMinutesTarget,
      blocks,
      notes,
      isLightWeek: factor.factor < 0.6,
      isAssessmentWeek,
    });
  }

  return {
    generatorVersion: GENERATOR_VERSION,
    generatedAt: new Date().toISOString(),
    totalWeeks,
    weeks,
  };
}
