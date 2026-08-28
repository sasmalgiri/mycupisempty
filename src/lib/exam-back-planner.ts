/**
 * Exam-Back Planner — plan backwards from the exam date, honestly.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * exam-readiness.ts answers "at your current pace, when will you be ready?"
 * That is the forward problem. This is the inverse:
 *
 *     The exam is on 3 March. She has 5 hours a week. Is that enough?
 *     If not, what exactly are we going to NOT do, and what does that cost?
 *
 * Almost every study app refuses to answer the second half. They print a
 * cheerful plan that silently assumes 100% adherence and uniform chapter
 * costs, the student falls behind in week 3, and the plan becomes a source of
 * guilt instead of direction.
 *
 * This module is willing to return `not_possible`. That is the point. A plan
 * that cannot be finished is worse than an honest triage, because the student
 * discovers the shortfall in February instead of October.
 *
 * ---------------------------------------------------------------------------
 * THE THREE THINGS IT GETS RIGHT THAT A NAIVE PLANNER DOES NOT
 * ---------------------------------------------------------------------------
 * 1. COST COMES FROM THE KNOWLEDGE MIX, not from chapter count.
 *    A chapter that is mostly dates costs a fraction of one that is mostly
 *    judgement. The Conversion Engine already computes the mix per chapter,
 *    so cost is derived rather than guessed.
 *
 * 2. REVIEW DEBT IS RESERVED BEFORE NEW TEACHING IS SCHEDULED.
 *    Everything taught in week 3 still needs reviewing in week 9. Review load
 *    grows with coverage, so it is subtracted from capacity FIRST. Otherwise
 *    the plan front-loads teaching and collapses near the exam — covered
 *    everything, remembers nothing.
 *
 * 3. CAPACITY IS DISCOUNTED BY OBSERVED ADHERENCE, not stated availability.
 *    "I'll do 5 hours a week" is an aspiration. What she actually did last
 *    month is data. Planning against the aspiration is the single most common
 *    reason study plans fail.
 *
 * Pure functions. No I/O. Fully testable.
 */

import { KNOWLEDGE_TYPES, type KnowledgeType } from './conversion-engine';

// ============================================================================
// 1. Cost model — what each kind of knowledge actually costs
// ============================================================================

export interface UnitCost {
  /** Minutes to teach it the first time, properly. */
  teach: number;
  /**
   * Total review minutes this unit will demand between now and the exam.
   * Not a per-session figure — the whole FSRS tail, summed.
   */
  review: number;
}

/**
 * Seeded estimates, in minutes per unit.
 *
 * These are deliberately explicit constants rather than a hidden heuristic,
 * because they are the assumption most likely to be wrong for any given
 * student — and `calibrateCosts()` below replaces them with her measured
 * times as soon as there is enough evidence.
 *
 * The shape matters more than the exact numbers: facts are cheap to install
 * and cheap to keep; procedures are expensive to install AND expensive to
 * keep because they need repeated practice; judgement is the most expensive
 * of all and cannot be crammed, which is why it gets triaged first when time
 * runs out.
 */
export const DEFAULT_UNIT_COSTS: Record<KnowledgeType, UnitCost> = {
  arbitrary_fact:       { teach: 6,  review: 5 },
  causal_sequence:      { teach: 10, review: 6 },
  relational_structure: { teach: 12, review: 7 },
  concept:              { teach: 14, review: 8 },
  procedure:            { teach: 16, review: 14 },
  judgment:             { teach: 20, review: 10 },
};

export interface MeasuredCost {
  knowledgeType: KnowledgeType;
  /** Observations behind this measurement. */
  samples: number;
  /** Mean measured minutes actually spent teaching one unit of this type. */
  meanTeachMinutes: number;
}

/**
 * Replace seeded costs with measured ones, weighted by evidence.
 *
 * conversion_outcomes.time_spent_seconds gives us real per-unit timings, so
 * the planner's cost model self-corrects. A student who works slowly through
 * procedures gets a plan that knows it, instead of one that keeps promising
 * she will catch up.
 *
 * Review cost is scaled in proportion, since a student who needs longer to
 * learn something also needs longer to keep it.
 */
export function calibrateCosts(
  measured: MeasuredCost[],
  base: Record<KnowledgeType, UnitCost> = DEFAULT_UNIT_COSTS,
): Record<KnowledgeType, UnitCost> {
  const out = { ...base };
  const K = 8; // samples at which measurement and prior carry equal weight

  for (const m of measured) {
    if (!KNOWLEDGE_TYPES.includes(m.knowledgeType) || m.samples <= 0) continue;
    if (!Number.isFinite(m.meanTeachMinutes) || m.meanTeachMinutes <= 0) continue;

    const prior = base[m.knowledgeType];
    const w = m.samples / (m.samples + K);
    // Clamp to 0.4x–2.5x the prior: one pathological session must not convince
    // the planner that a concept takes four hours.
    const measuredTeach = Math.max(prior.teach * 0.4, Math.min(prior.teach * 2.5, m.meanTeachMinutes));
    const teach = w * measuredTeach + (1 - w) * prior.teach;

    out[m.knowledgeType] = {
      teach: round1(teach),
      review: round1(prior.review * (teach / prior.teach)),
    };
  }

  return out;
}

// ============================================================================
// 1b. Mix priors — costing a chapter nobody has opened yet
// ============================================================================

/**
 * Seeded knowledge-mix per subject.
 *
 * The planner needs a mix for EVERY chapter, including ones never taught, so
 * it can cost the whole syllabus on day one. Where a chapter has been through
 * the Conversion Engine we use its measured mix; otherwise we fall back to
 * these subject-level priors and mark the estimate as such.
 *
 * These shapes are the ordinary structure of Indian school subjects: Maths is
 * mostly procedure, History is dates and causal chains with essay judgement on
 * top, Geography is heavily relational. They are wrong for any individual
 * chapter and right on average — which is what a prior is for.
 */
export const DEFAULT_SUBJECT_MIX: Record<string, Partial<Record<KnowledgeType, number>>> = {
  math:             { procedure: 0.60, concept: 0.22, arbitrary_fact: 0.10, relational_structure: 0.08 },
  physical_science: { concept: 0.32, procedure: 0.28, arbitrary_fact: 0.20, causal_sequence: 0.20 },
  life_science:     { causal_sequence: 0.32, relational_structure: 0.26, arbitrary_fact: 0.24, concept: 0.18 },
  science:          { concept: 0.30, causal_sequence: 0.25, arbitrary_fact: 0.25, procedure: 0.20 },
  history:          { causal_sequence: 0.35, arbitrary_fact: 0.30, judgment: 0.25, concept: 0.10 },
  geography:        { relational_structure: 0.40, causal_sequence: 0.25, arbitrary_fact: 0.25, concept: 0.10 },
  social:           { causal_sequence: 0.30, judgment: 0.28, arbitrary_fact: 0.24, concept: 0.18 },
  english:          { judgment: 0.35, arbitrary_fact: 0.30, procedure: 0.20, concept: 0.15 },
  bengali:          { judgment: 0.35, arbitrary_fact: 0.30, procedure: 0.20, concept: 0.15 },
  hindi:            { arbitrary_fact: 0.35, judgment: 0.30, procedure: 0.20, concept: 0.15 },
  computer:         { procedure: 0.55, concept: 0.25, relational_structure: 0.12, arbitrary_fact: 0.08 },
};

/** Even split — used when the subject slug is unrecognised. */
const FLAT_MIX: Partial<Record<KnowledgeType, number>> = Object.fromEntries(
  KNOWLEDGE_TYPES.map((t) => [t, 1 / KNOWLEDGE_TYPES.length]),
);

export function estimateMixForSubject(
  subjectSlug: string | undefined | null,
): Partial<Record<KnowledgeType, number>> {
  if (!subjectSlug) return { ...FLAT_MIX };
  const key = subjectSlug.toLowerCase();
  if (DEFAULT_SUBJECT_MIX[key]) return { ...DEFAULT_SUBJECT_MIX[key] };
  // Partial match: 'physical_science_bn' → physical_science
  for (const [slug, mix] of Object.entries(DEFAULT_SUBJECT_MIX)) {
    if (key.includes(slug)) return { ...mix };
  }
  return { ...FLAT_MIX };
}

/** Normalise any mix so its shares sum to 1; an empty mix falls back to flat. */
export function normaliseMix(
  mix: Partial<Record<KnowledgeType, number>>,
): Partial<Record<KnowledgeType, number>> {
  const total = KNOWLEDGE_TYPES.reduce((s, t) => s + Math.max(0, mix[t] ?? 0), 0);
  if (total <= 0) return { ...FLAT_MIX };
  const out: Partial<Record<KnowledgeType, number>> = {};
  for (const t of KNOWLEDGE_TYPES) {
    const v = Math.max(0, mix[t] ?? 0);
    if (v > 0) out[t] = v / total;
  }
  return out;
}

// ============================================================================
// 2. Inputs
// ============================================================================

export interface ChapterWork {
  id: string;
  title: string;
  subjectName: string;
  /** Share of exam marks this chapter historically carries, 0..100. */
  examWeightPct?: number | null;
  /** How many teachable units it breaks into. */
  unitCount: number;
  /** Proportions per knowledge type, summing to ~1 (from chapterMix()). */
  mix: Partial<Record<KnowledgeType, number>>;
  /** 0..1 — how much of this chapter is already genuinely mastered. */
  currentMastery?: number;
  /** Chapters that must come first. */
  prereqChapterIds?: string[];
}

export interface BlackoutPeriod {
  startDate: string;   // ISO date
  endDate: string;     // ISO date
  title: string;
  /** Puja vacation may be study time; a hospital stay is not. 0..1 kept. */
  capacityRetained?: number;
}

export interface ExamPlanInput {
  /** ISO date of the exam. */
  examDate: string;
  /** ISO date to plan from. Injected rather than read from the clock. */
  today: string;
  /** Stated weekly study minutes. */
  weeklyMinutesTarget: number;
  /**
   * Observed 0..1 completion of previous plans. Defaults to 0.7 — planning at
   * 1.0 is the single most common reason study plans fail.
   */
  observedAdherence?: number;
  chapters: ChapterWork[];
  blackouts?: BlackoutPeriod[];
  costs?: Record<KnowledgeType, UnitCost>;
  /**
   * Mastery fraction counted as exam-ready. Below 1.0 because the last 15% of
   * mastery costs as much as the first 60% and rarely changes the grade.
   */
  readyThreshold?: number;
}

// ============================================================================
// 3. Outputs
// ============================================================================

export type PlanVerdict = 'comfortable' | 'tight' | 'crunch' | 'not_possible';

export interface ChapterAllocation {
  chapter: ChapterWork;
  teachMinutes: number;
  reviewMinutes: number;
  totalMinutes: number;
  /** Marks at stake, from exam weight × how much is still unlearned. */
  marksAtStake: number;
  /** marksAtStake per minute — the triage ranking. */
  valueDensity: number;
  included: boolean;
  /** Why it was cut, when it was. */
  droppedReason?: string;
}

export interface ExamPlan {
  verdict: PlanVerdict;
  weeksAvailable: number;
  /** Raw minutes before adherence and review are taken out. */
  grossCapacityMinutes: number;
  /** What can realistically be spent on NEW teaching. */
  netTeachingCapacityMinutes: number;
  reservedReviewMinutes: number;
  requiredMinutes: number;
  /** netCapacity / required. Below 1 means something must be cut. */
  feasibility: number;

  included: ChapterAllocation[];
  dropped: ChapterAllocation[];

  /** Exam marks covered by the included set, 0..100. */
  marksCovered: number;
  marksAtRisk: number;

  /** Minutes per week to reserve for review, week by week — it grows. */
  reviewCurve: Array<{ week: number; reviewMinutes: number; teachMinutes: number }>;

  /** What to say to the student. Plain, specific, never cheerful-but-vague. */
  message: string;
  /** What to say to a parent. */
  parentMessage: string;
  /** Concrete levers, most effective first. */
  levers: string[];
}

// ============================================================================
// 4. The planner
// ============================================================================

const MS_PER_DAY = 86_400_000;

export function planBackFromExam(input: ExamPlanInput): ExamPlan {
  const readyThreshold = input.readyThreshold ?? 0.85;
  const costs = input.costs || DEFAULT_UNIT_COSTS;
  const adherence = clamp(input.observedAdherence ?? 0.7, 0.1, 1);

  // --- Capacity ---------------------------------------------------------
  const start = Date.parse(input.today);
  const exam = Date.parse(input.examDate);
  const rawDays = Math.max(0, (exam - start) / MS_PER_DAY);
  const lostDays = blackoutDaysLost(input.blackouts || [], start, exam);
  const effectiveDays = Math.max(0, rawDays - lostDays);
  const weeksAvailable = effectiveDays / 7;

  const grossCapacityMinutes = Math.round(weeksAvailable * input.weeklyMinutesTarget);
  const realisticCapacity = Math.round(grossCapacityMinutes * adherence);

  // --- Cost every chapter ----------------------------------------------
  const allocations: ChapterAllocation[] = input.chapters.map((ch) => {
    const remaining = Math.max(0, readyThreshold - (ch.currentMastery ?? 0)) / readyThreshold;
    const unitsToDo = ch.unitCount * remaining;

    let teach = 0;
    let review = 0;
    for (const t of KNOWLEDGE_TYPES) {
      const share = ch.mix[t] ?? 0;
      if (share <= 0) continue;
      const units = unitsToDo * share;
      teach += units * costs[t].teach;
      review += units * costs[t].review;
    }

    const weight = ch.examWeightPct ?? 0;
    const marksAtStake = weight * remaining;
    const total = teach + review;

    return {
      chapter: ch,
      teachMinutes: Math.round(teach),
      reviewMinutes: Math.round(review),
      totalMinutes: Math.round(total),
      marksAtStake: round1(marksAtStake),
      // Chapters with no recorded exam weight still need doing — fall back to a
      // small positive density so they are not all triaged out first.
      valueDensity: total > 0 ? (marksAtStake > 0 ? marksAtStake / total : 0.001) : 0,
      included: true,
    };
  });

  const requiredMinutes = allocations.reduce((s, a) => s + a.totalMinutes, 0);
  const totalReviewNeeded = allocations.reduce((s, a) => s + a.reviewMinutes, 0);

  // Review is reserved off the top, before any new teaching is scheduled.
  const netTeachingCapacityMinutes = Math.max(0, realisticCapacity - totalReviewNeeded);

  // --- Triage -----------------------------------------------------------
  const { included, dropped } = triage(allocations, realisticCapacity);

  const totalMarks = input.chapters.reduce((s, c) => s + (c.examWeightPct ?? 0), 0);
  const marksAtRisk = round1(dropped.reduce((s, a) => s + a.marksAtStake, 0));
  const marksCovered = totalMarks > 0 ? round1(totalMarks - marksAtRisk) : 0;

  const feasibility = requiredMinutes > 0 ? realisticCapacity / requiredMinutes : 1;
  const verdict = verdictFor(feasibility, dropped.length);

  return {
    verdict,
    weeksAvailable: round1(weeksAvailable),
    grossCapacityMinutes,
    netTeachingCapacityMinutes,
    reservedReviewMinutes: Math.round(totalReviewNeeded),
    requiredMinutes,
    feasibility: round2(feasibility),
    included,
    dropped,
    marksCovered,
    marksAtRisk,
    reviewCurve: buildReviewCurve(included, weeksAvailable, realisticCapacity),
    message: studentMessage(verdict, weeksAvailable, dropped, marksAtRisk, feasibility),
    parentMessage: parentMessage(verdict, weeksAvailable, included.length, dropped.length, marksCovered),
    levers: leversFor(verdict, feasibility, input, adherence),
  };
}

// ============================================================================
// 5. Triage — the honest part
// ============================================================================

/**
 * Greedy knapsack by marks-per-minute, with prerequisites respected.
 *
 * Deliberately greedy rather than optimal: a teacher must be able to look at
 * the ordering and agree with it. "Highest marks per minute first, but never
 * before its prerequisite" is explicable. A dynamic-programming optimum that
 * shuffles chapters for a 2% gain is not, and would not be trusted.
 */
function triage(
  allocations: ChapterAllocation[],
  capacityMinutes: number,
): { included: ChapterAllocation[]; dropped: ChapterAllocation[] } {
  const ranked = [...allocations].sort((a, b) => b.valueDensity - a.valueDensity);

  const included: ChapterAllocation[] = [];
  const dropped: ChapterAllocation[] = [];
  const includedIds = new Set<string>();
  let spent = 0;

  // Multiple passes so a chapter blocked only by an unplaced prerequisite gets
  // reconsidered once that prerequisite lands.
  let remaining = ranked;
  for (let pass = 0; pass < 4 && remaining.length > 0; pass++) {
    const deferred: ChapterAllocation[] = [];

    for (const a of remaining) {
      const prereqs = a.chapter.prereqChapterIds || [];
      const blocked = prereqs.some(
        (p) => !includedIds.has(p) && allocations.some((x) => x.chapter.id === p),
      );

      if (blocked) { deferred.push(a); continue; }

      if (spent + a.totalMinutes <= capacityMinutes) {
        spent += a.totalMinutes;
        included.push({ ...a, included: true });
        includedIds.add(a.chapter.id);
      } else {
        deferred.push(a);
      }
    }

    // Nothing moved — the rest genuinely does not fit.
    if (deferred.length === remaining.length) break;
    remaining = deferred;
  }

  for (const a of remaining) {
    const prereqs = a.chapter.prereqChapterIds || [];
    const blockedBy = prereqs.filter((p) => !includedIds.has(p));
    dropped.push({
      ...a,
      included: false,
      droppedReason: blockedBy.length > 0
        ? 'its prerequisite chapter did not fit either'
        : `needs ${Math.round(a.totalMinutes / 60)}h for ${a.marksAtStake.toFixed(0)} marks — lowest return of what is left`,
    });
  }

  return { included, dropped };
}

// ============================================================================
// 6. Review curve
// ============================================================================

/**
 * Review load grows as coverage grows.
 *
 * Modelled as proportional to how much has been taught so far, which is the
 * behaviour that matters for planning: week 2 needs almost no review time,
 * week 20 needs a lot. A planner that reserves a flat 20% every week
 * over-reserves early and under-reserves late — and under-reserving late is
 * precisely when forgetting decides the grade.
 */
function buildReviewCurve(
  included: ChapterAllocation[],
  weeksAvailable: number,
  capacityMinutes: number,
): Array<{ week: number; reviewMinutes: number; teachMinutes: number }> {
  const weeks = Math.max(1, Math.ceil(weeksAvailable));
  const perWeek = weeks > 0 ? capacityMinutes / weeks : 0;
  const totalReview = included.reduce((s, a) => s + a.reviewMinutes, 0);
  const totalTeach = included.reduce((s, a) => s + a.teachMinutes, 0);

  const curve: Array<{ week: number; reviewMinutes: number; teachMinutes: number }> = [];

  // Weight review by cumulative coverage: sum of w over the horizon normalises
  // to a linear ramp, so early weeks teach and late weeks consolidate.
  const rampTotal = (weeks * (weeks + 1)) / 2;

  for (let w = 1; w <= weeks; w++) {
    const reviewShare = rampTotal > 0 ? w / rampTotal : 0;
    const reviewMinutes = Math.round(totalReview * reviewShare);
    const teachMinutes = Math.max(0, Math.round(Math.min(perWeek - reviewMinutes, totalTeach / weeks)));
    curve.push({ week: w, reviewMinutes, teachMinutes });
  }

  return curve;
}

// ============================================================================
// 7. Verdict and language
// ============================================================================

function verdictFor(feasibility: number, droppedCount: number): PlanVerdict {
  if (feasibility >= 1.25 && droppedCount === 0) return 'comfortable';
  if (feasibility >= 1.0 && droppedCount === 0) return 'tight';
  if (feasibility >= 0.6) return 'crunch';
  return 'not_possible';
}

function studentMessage(
  verdict: PlanVerdict,
  weeks: number,
  dropped: ChapterAllocation[],
  marksAtRisk: number,
  feasibility: number,
): string {
  const w = weeks < 1 ? 'less than a week' : weeks < 1.5 ? 'about a week' : `${Math.round(weeks)} weeks`;
  const n = dropped.length;
  const setAside = n === 1
    ? `set one chapter aside (${dropped[0].chapter.title})`
    : `set ${n} chapters aside`;

  switch (verdict) {
    case 'comfortable':
      return `You have ${w}, and that is enough to cover everything with room to spare. Keep the weekly rhythm and you will not need to cram.`;
    case 'tight':
      return `You have ${w}. Everything fits — but only if you keep to the weekly hours. There is no slack for a lost fortnight, so tell me early if a week goes wrong and we will re-plan rather than pretend.`;
    case 'crunch':
      return `You have ${w}, and that is not quite enough for all of it. I have kept the chapters that earn the most marks per hour and ${setAside} — about ${marksAtRisk.toFixed(0)} marks we are choosing not to chase. That is a real cost, and you should know it now rather than in February. A little more time each week would close it.`;
    case 'not_possible':
      return `Straight answer: ${w} at these hours covers roughly ${Math.round(feasibility * 100)}% of what is left, so full coverage is not on the table. The real choice is which marks to go after. I have picked the highest-return chapters and ${setAside} — but this needs either more hours a week or a longer run-up, and that is worth deciding today.`;
  }
}

function parentMessage(
  verdict: PlanVerdict,
  weeks: number,
  includedCount: number,
  droppedCount: number,
  marksCovered: number,
): string {
  const w = `${Math.round(weeks)} weeks`;
  if (verdict === 'comfortable' || verdict === 'tight') {
    return `With ${w} to the exam, the current schedule covers the full syllabus — ${includedCount} chapters. ${verdict === 'tight' ? 'There is little slack, so a missed fortnight would need re-planning.' : 'There is some slack for illness or a bad week.'}`;
  }
  return `With ${w} to the exam and the hours currently available, ${includedCount} of ${includedCount + droppedCount} chapters fit — around ${marksCovered.toFixed(0)}% of the exam marks. We have prioritised by marks-per-hour rather than spreading thin across everything. Adding study hours or starting earlier are the two levers that change this.`;
}

function leversFor(
  verdict: PlanVerdict,
  feasibility: number,
  input: ExamPlanInput,
  adherence: number,
): string[] {
  if (verdict === 'comfortable') {
    return ['Hold the current rhythm', 'Use the slack for past papers rather than new chapters'];
  }

  const levers: string[] = [];
  const shortfallRatio = feasibility > 0 ? 1 / feasibility : 2;

  const neededWeekly = Math.ceil((input.weeklyMinutesTarget * shortfallRatio) / 30) * 30;
  if (neededWeekly > input.weeklyMinutesTarget) {
    levers.push(
      `Raise weekly study from ${Math.round(input.weeklyMinutesTarget / 60)}h to about ${Math.round(neededWeekly / 60)}h to cover everything`,
    );
  }

  if (adherence < 0.75) {
    levers.push(
      `Adherence is running at ${Math.round(adherence * 100)}% — recovering the sessions already scheduled is cheaper than adding new ones`,
    );
  }

  levers.push('Accept the triage and go deep on the high-mark chapters rather than thin everywhere');
  if (verdict === 'not_possible') {
    levers.push('Consider the next exam window if this one is not fixed');
  }
  return levers;
}

// ============================================================================
// 8. Helpers
// ============================================================================

function blackoutDaysLost(blackouts: BlackoutPeriod[], start: number, end: number): number {
  let lost = 0;
  for (const b of blackouts) {
    const bs = Math.max(Date.parse(b.startDate), start);
    const be = Math.min(Date.parse(b.endDate), end);
    if (!Number.isFinite(bs) || !Number.isFinite(be) || be <= bs) continue;
    const days = (be - bs) / MS_PER_DAY;
    lost += days * (1 - clamp(b.capacityRetained ?? 0, 0, 1));
  }
  return lost;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
function round1(x: number): number { return Math.round(x * 10) / 10; }
function round2(x: number): number { return Math.round(x * 100) / 100; }
