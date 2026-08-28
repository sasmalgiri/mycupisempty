/**
 * Daily Flow — the conductor.
 *
 * ---------------------------------------------------------------------------
 * WHY A CONDUCTOR AND NOT ANOTHER FEATURE
 * ---------------------------------------------------------------------------
 * The app already has Daily Mix, flashcards, the guru, probes, reflection and
 * now the Conversion Engine. Each is good. The problem is that the student is
 * the one holding them together — she opens the app and has to decide what to
 * do, and a fourteen-year-old at 7pm decides badly. She picks the subject she
 * likes, skips review because nothing is due-looking, and never answers the
 * retention probes that are the only reason the system learns anything.
 *
 * So this module does not add a capability. It ORDERS the ones that exist,
 * into a queue with no choices in it. One screen, one step, the next thing
 * always decided for her — which is the same principle as the rest of the
 * product: observe and decide, do not ask.
 *
 * ---------------------------------------------------------------------------
 * THE ORDERING RULES, AND WHY THEY ARE IN THIS ORDER
 * ---------------------------------------------------------------------------
 * 1. PROBES FIRST. They cost a minute and they are the entire evidence loop.
 *    Put them last and they get skipped, and then every recommendation the
 *    system makes rests on unconfirmed guesses forever.
 *
 * 2. REVIEW BEFORE NEW MATERIAL. Always. Forgetting is silent and new
 *    chapters feel like progress, so every student left to choose will
 *    over-teach and under-review. By March that is the whole difference.
 *
 * 3. NEW MATERIAL ONLY WITH WHAT IS LEFT, in the exam plan's triage order.
 *
 * 4. IF REVIEW ALONE FILLS THE DAY, TEACH NOTHING. Say so plainly. Adding new
 *    material on top of unpayable review debt is how a student ends up having
 *    "covered" everything and remembering a third of it.
 *
 * Pure functions. No I/O, no clock — `today` is injected.
 */

import type { KnowledgeType } from './conversion-engine';

// ============================================================================
// 1. Types
// ============================================================================

export type StepKind = 'probe' | 'review' | 'learn' | 'practice' | 'reflect' | 'break';

export interface FlowStep {
  id: string;
  kind: StepKind;
  title: string;
  /** One line telling her why this, now. Never generic encouragement. */
  why: string;
  minutes: number;
  /** Where the UI sends her, when the step is handled by an existing feature. */
  href?: string;
  /** Payload for steps this module owns outright. */
  payload?: Record<string, any>;
}

export interface FlowUnit {
  unitId: string;
  topicId?: string;
  chapterId: string;
  chapterTitle: string;
  subjectName: string;
  knowledgeType: KnowledgeType;
  /** Exam marks riding on the chapter this unit belongs to. */
  marksAtStake?: number;
  estimatedMinutes: number;
}

export interface DailyFlowInput {
  today: string;
  /** Minutes she realistically has today. */
  minutesAvailable: number;
  /** Her observed attention span — sessions are chunked to it. */
  attentionSpanMinutes?: number;

  probesDue: Array<{ outcomeId: string; question: string; knowledgeType?: string }>;
  /** Count of spaced-repetition items due today. */
  reviewDueCount: number;
  /** Next teachable units, already in exam-plan triage order. */
  availableUnits: FlowUnit[];

  /** From the exam plan — changes the tone and the aggression. */
  examVerdict?: 'comfortable' | 'tight' | 'crunch' | 'not_possible';
  weeksToExam?: number;

  /** ISO date of her last reflection, so we do not ask daily. */
  lastReflectionDate?: string;
  /** True on a scheduled rest day — we still protect review, nothing more. */
  isRestDay?: boolean;
}

export interface DailyFlow {
  steps: FlowStep[];
  totalMinutes: number;
  /** The shape of the day, in one sentence, for the top of the screen. */
  headline: string;
  /** What was deliberately left out today, and why. Never silent. */
  omitted: string[];
  mode: 'rest' | 'catch_up' | 'balanced' | 'push';
}

// ============================================================================
// 2. Tunables
// ============================================================================

/** A probe is one question. Three is the most anyone will answer honestly. */
const MAX_PROBES = 3;
const PROBE_MINUTES = 1;

/** Roughly a minute a card, the working figure for a due-queue of any size. */
const REVIEW_MINUTES_PER_ITEM = 1;

/**
 * Above this share of the day, review has eaten the day and no new material is
 * scheduled. Not a stylistic choice: teaching on top of unpayable review debt
 * is the mechanism by which students "finish" a syllabus they cannot recall.
 */
const REVIEW_SATURATION = 0.75;

/** Below this, the day is only worth protecting what she already has. */
const MINIMUM_USEFUL_MINUTES = 8;

const BREAK_MINUTES = 3;

// ============================================================================
// 3. The conductor
// ============================================================================

export function buildDailyFlow(input: DailyFlowInput): DailyFlow {
  const attention = clamp(input.attentionSpanMinutes ?? 20, 8, 45);
  const budget = Math.max(0, input.minutesAvailable);
  const steps: FlowStep[] = [];
  const omitted: string[] = [];
  let spent = 0;

  // --- 1. Probes ---------------------------------------------------------
  // Always, and always first. Even on a rest day: a probe is a question, not
  // a study session, and the evidence loop dies without them.
  const probes = input.probesDue.slice(0, MAX_PROBES);
  for (const p of probes) {
    steps.push({
      id: `probe:${p.outcomeId}`,
      kind: 'probe',
      title: 'Quick check',
      why: 'You learned this a while back. This one question decides whether it actually stuck — it is how the app learns what works for you.',
      minutes: PROBE_MINUTES,
      payload: { outcomeId: p.outcomeId, question: p.question, knowledgeType: p.knowledgeType },
    });
    spent += PROBE_MINUTES;
  }
  if (input.probesDue.length > MAX_PROBES) {
    omitted.push(`${input.probesDue.length - MAX_PROBES} more retention checks — saved for tomorrow so today is not all checking`);
  }

  // --- 2. Rest day -------------------------------------------------------
  if (input.isRestDay) {
    const headline = steps.length === 0
      ? 'Rest day. Nothing at all today — that is the whole plan.'
      : `Rest day. ${steps.length} quick question${steps.length === 1 ? '' : 's'}, then stop — that is the whole plan.`;
    if (input.reviewDueCount > 0) {
      omitted.push(`${input.reviewDueCount} review items — they will keep until tomorrow. A rest day only works if it is actually a rest day.`);
    }
    return finish(steps, omitted, 'rest', spent, headline);
  }

  // --- 3. Too little time to do anything but hold ground -----------------
  if (budget < MINIMUM_USEFUL_MINUTES) {
    if (input.reviewDueCount > 0) {
      const m = Math.max(1, budget - spent);
      steps.push(reviewStep(Math.min(input.reviewDueCount, m), m,
        'Only a few minutes today, so we spend them on what you would otherwise lose.'));
      spent += m;
    }
    omitted.push('New material — not enough time today to start something and finish it');
    return finish(steps, omitted, 'catch_up', spent,
      'A short one. Just protecting what you already know.');
  }

  // --- 4. Review debt ----------------------------------------------------
  const reviewMinutesNeeded = input.reviewDueCount * REVIEW_MINUTES_PER_ITEM;
  const remainingAfterProbes = budget - spent;
  const reviewShare = remainingAfterProbes > 0 ? reviewMinutesNeeded / remainingAfterProbes : 0;
  const saturated = reviewShare >= REVIEW_SATURATION;

  const reviewMinutes = Math.min(reviewMinutesNeeded, remainingAfterProbes);
  if (reviewMinutes > 0) {
    steps.push(reviewStep(
      input.reviewDueCount,
      Math.round(reviewMinutes),
      saturated
        ? 'Review has built up. Clearing it matters more than starting anything new — new chapters on top of this would just add to the pile.'
        : 'These are due today. Clearing them first is what stops last month quietly draining away.',
    ));
    spent += reviewMinutes;
  }

  // --- 5. New material ---------------------------------------------------
  const left = budget - spent;

  if (saturated) {
    omitted.push('New chapters — today is a catch-up day. Starting new material on top of this backlog would make next week worse, not better.');
    return finish(steps, omitted, 'catch_up', spent,
      `Catch-up day: ${input.reviewDueCount} things to re-fix, and nothing new until they are.`);
  }

  if (left < MINIMUM_USEFUL_MINUTES || input.availableUnits.length === 0) {
    if (input.availableUnits.length === 0) {
      omitted.push('New material — nothing queued. Either the plan is complete or a chapter needs opening.');
    } else {
      omitted.push('New material — review used the time available today');
    }
  } else {
    const pushing = input.examVerdict === 'crunch' || input.examVerdict === 'not_possible';
    let chunkSpent = 0;
    let sinceBreak = 0;

    for (const unit of input.availableUnits) {
      const cost = Math.max(4, Math.round(unit.estimatedMinutes));
      if (chunkSpent + cost > left) break;

      // Protect the attention span — a break beats a fading second half.
      if (sinceBreak + cost > attention && chunkSpent + cost + BREAK_MINUTES <= left) {
        steps.push({
          id: `break:${steps.length}`,
          kind: 'break',
          title: 'Stand up for a minute',
          why: `You have been going ${sinceBreak} minutes. Past your usual stretch the next bit stops sticking, so this is not a reward — it is part of the method.`,
          minutes: BREAK_MINUTES,
        });
        chunkSpent += BREAK_MINUTES;
        sinceBreak = 0;
      }

      steps.push({
        id: `learn:${unit.unitId}`,
        kind: 'learn',
        title: unit.chapterTitle,
        why: whyThisUnit(unit, pushing),
        minutes: cost,
        href: `/teach?chapterId=${unit.chapterId}`,
        payload: {
          unitId: unit.unitId,
          topicId: unit.topicId,
          chapterId: unit.chapterId,
          knowledgeType: unit.knowledgeType,
          subjectName: unit.subjectName,
        },
      });
      chunkSpent += cost;
      sinceBreak += cost;
    }

    spent += chunkSpent;

    const taught = steps.filter((s) => s.kind === 'learn').length;
    if (taught < input.availableUnits.length) {
      omitted.push(`${input.availableUnits.length - taught} more units queued for the coming days`);
    }
  }

  // --- 6. Reflection -----------------------------------------------------
  const didSomething = steps.some((s) => s.kind === 'learn' || s.kind === 'review');
  const reflectedToday = input.lastReflectionDate === input.today;
  if (didSomething && !reflectedToday && budget - spent >= 1) {
    steps.push({
      id: 'reflect',
      kind: 'reflect',
      title: 'Fifteen seconds',
      why: 'One honest line about how that went. It is the fastest signal we get about whether the approach is right for you.',
      minutes: 1,
      href: '/reflect',
    });
    spent += 1;
  }

  const mode: DailyFlow['mode'] =
    input.examVerdict === 'crunch' || input.examVerdict === 'not_possible' ? 'push' : 'balanced';

  return finish(steps, omitted, mode, spent, headlineFor(steps, input, mode));
}

// ============================================================================
// 4. Language
// ============================================================================

function whyThisUnit(unit: FlowUnit, pushing: boolean): string {
  const kindReason: Record<KnowledgeType, string> = {
    arbitrary_fact: 'This one is just to be known — you will build the picture for it yourself, which is what makes it stay.',
    causal_sequence: 'This is a chain where each step forces the next, so you will be asked what has to happen next before you are told.',
    concept: 'This is an idea with a boundary. You will meet cases just inside and just outside it, which is the only way that boundary becomes yours.',
    procedure: 'This is something you have to be able to DO, so it starts fully worked and the support comes away one step at a time.',
    relational_structure: 'This is a system where where-things-sit is the point, so you will place them yourself before anything is corrected.',
    judgment: 'This is one where more than one answer is defensible. You will rank real samples before you see any marks.',
  };

  const stakes =
    pushing && (unit.marksAtStake ?? 0) >= 8
      ? ` It also carries about ${Math.round(unit.marksAtStake!)} marks, which is why it is near the front.`
      : '';

  return `${unit.subjectName}. ${kindReason[unit.knowledgeType]}${stakes}`;
}

function headlineFor(steps: FlowStep[], input: DailyFlowInput, mode: DailyFlow['mode']): string {
  const learn = steps.filter((s) => s.kind === 'learn').length;
  const review = steps.some((s) => s.kind === 'review');
  const probes = steps.filter((s) => s.kind === 'probe').length;

  const bits: string[] = [];
  if (probes) bits.push(`${probes} quick check${probes === 1 ? '' : 's'}`);
  if (review) bits.push(`${input.reviewDueCount} to review`);
  if (learn) bits.push(`${learn} new piece${learn === 1 ? '' : 's'}`);

  const body = bits.length ? bits.join(', ') : 'nothing due';

  if (mode === 'push' && input.weeksToExam != null) {
    return `${Math.round(input.weeksToExam)} weeks out — ${body}. In that order.`;
  }
  return `Today: ${body}. In that order.`;
}

function reviewStep(count: number, minutes: number, why: string): FlowStep {
  return {
    id: 'review',
    kind: 'review',
    title: `Review ${count} thing${count === 1 ? '' : 's'}`,
    why,
    minutes: Math.max(1, Math.round(minutes)),
    href: '/flashcards',
    payload: { dueCount: count },
  };
}

function finish(
  steps: FlowStep[],
  omitted: string[],
  mode: DailyFlow['mode'],
  spent: number,
  headline: string,
): DailyFlow {
  return {
    steps,
    totalMinutes: Math.round(spent),
    headline,
    omitted,
    mode,
  };
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
