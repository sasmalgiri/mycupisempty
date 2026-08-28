/**
 * Answer Diagnosis — turn what she actually wrote into evidence.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS THE MOST INFORMATIVE THING IN THE SYSTEM
 * ---------------------------------------------------------------------------
 * Everything else the app records is thin: time spent, whether a box was
 * ticked, a self-rating. A wrong answer, read properly, is dense. It says
 * which of five completely different things went wrong, and each one has a
 * different fix:
 *
 *   CARELESS       she knew it and slipped        → slow down, check; NOT re-teach
 *   RETRIEVAL      she knew it and lost it        → spacing problem, not a teaching problem
 *   CONCEPTUAL     she has the wrong model        → re-teach with contrast cases
 *   PROCEDURAL     right idea, wrong execution    → faded worked examples
 *   TRANSFER       knows it, cannot apply it here → vary the surface, keep the deep structure
 *   NOT_ATTEMPTED  never got to it                → pacing or avoidance, look at time
 *
 * Treating all six as "got it wrong, revise the chapter" is the single most
 * wasteful thing a tutor can do, and it is what a score alone forces you into.
 *
 * ---------------------------------------------------------------------------
 * THE ASYMMETRY THAT MATTERS
 * ---------------------------------------------------------------------------
 * A careless slip misdiagnosed as conceptual costs a wasted re-teach. A
 * conceptual error misdiagnosed as careless leaves a broken model in place
 * that will fail every future question built on it. So under uncertainty this
 * module resolves toward the DEEPER cause, exactly as the classifier does.
 *
 * Pure functions. The evidence in, a diagnosis out.
 */

import type { KnowledgeType, RepresentationCode } from './conversion-engine';

// ============================================================================
// 1. Types
// ============================================================================

export type ErrorKind =
  | 'correct'
  | 'careless'
  | 'retrieval'
  | 'conceptual'
  | 'procedural'
  | 'transfer'
  | 'not_attempted';

export const ERROR_LABEL: Record<ErrorKind, string> = {
  correct: 'Correct',
  careless: 'Knew it, slipped',
  retrieval: 'Knew it, lost it',
  conceptual: 'Wrong idea underneath',
  procedural: 'Right idea, wrong execution',
  transfer: 'Knows it, could not apply it here',
  not_attempted: 'Not attempted',
};

/** What to do about it. The whole point of separating the kinds. */
export const ERROR_ACTION: Record<ErrorKind, string> = {
  correct: 'Nothing — schedule the retrieval and move on.',
  careless: 'Do NOT re-teach. Slow the pace and add a checking step; re-teaching a known fact wastes the session and tells her she does not know something she does.',
  retrieval: 'Teaching is fine — the spacing is not. Shorten the interval and re-probe sooner. Re-explaining will feel redundant to her, correctly.',
  conceptual: 'Re-teach with contrast cases: one that counts, one that nearly counts. More practice on the same wrong model just entrenches it.',
  procedural: 'She has the idea. Go back one scaffold level — a worked example with the last step blank — rather than re-explaining the concept.',
  transfer: 'Keep the deep structure, change the surface. Same problem dressed differently, several times, until the dressing stops mattering.',
  not_attempted: 'Look at time and order before content. Ran out, or avoided? Those need opposite responses.',
};

export interface AttemptEvidence {
  questionId: string;
  unitId?: string;
  knowledgeType?: KnowledgeType;
  representationTaught?: RepresentationCode;

  /** What she wrote. Empty means not attempted. */
  answerGiven: string;
  expectedAnswer: string;
  /** Marker's judgement where available; otherwise inferred. */
  isCorrect?: boolean;
  marksAwarded?: number;
  marksAvailable?: number;

  /** Behavioural signals — the ones that separate careless from conceptual. */
  timeSpentSeconds?: number;
  /** Typical time for this question type, for comparison. */
  expectedSeconds?: number;
  /** Did she change her answer? Self-correction is a good sign. */
  revisions?: number;
  /** Was this taught, and how long ago? Null = never taught. */
  daysSinceTaught?: number | null;
  /** Did she get this same unit right previously? */
  previouslyCorrect?: boolean;
  /** Self-rated confidence 0..1 before answering, if captured. */
  confidenceBefore?: number;
}

export interface Diagnosis {
  questionId: string;
  unitId?: string;
  kind: ErrorKind;
  confidence: number;      // 0..1 in the diagnosis itself
  reason: string;          // why we think so, in plain words
  action: string;
  /** True when the signals were thin and we resolved toward the deeper cause. */
  resolvedDeeper: boolean;
}

// ============================================================================
// 2. Diagnosis
// ============================================================================

/** Ascending depth. Ties resolve toward the later (more expensive) cause. */
const DEPTH: ErrorKind[] = [
  'correct', 'not_attempted', 'careless', 'retrieval', 'procedural', 'transfer', 'conceptual',
];

export function diagnose(e: AttemptEvidence): Diagnosis {
  const wrote = (e.answerGiven || '').trim();
  const correct = e.isCorrect ?? (e.marksAvailable ? (e.marksAwarded ?? 0) >= e.marksAvailable * 0.8 : false);
  const partial = e.marksAvailable != null && e.marksAwarded != null
    && e.marksAwarded > 0 && e.marksAwarded < e.marksAvailable;

  const mk = (kind: ErrorKind, confidence: number, reason: string, resolvedDeeper = false): Diagnosis => ({
    questionId: e.questionId, unitId: e.unitId, kind, confidence, reason,
    action: ERROR_ACTION[kind], resolvedDeeper,
  });

  if (correct) return mk('correct', 1, 'Full marks.');
  if (wrote.length === 0) {
    const ranOut = e.timeSpentSeconds != null && e.expectedSeconds != null
      && e.timeSpentSeconds < e.expectedSeconds * 0.3;
    return mk('not_attempted', 0.9,
      ranOut ? 'Blank, and barely any time on it — likely ran out of time or skipped.'
             : 'Blank despite time available — worth asking whether she avoided it.');
  }

  // Never taught → not a memory failure at all.
  if (e.daysSinceTaught == null) {
    return mk('transfer', 0.6,
      'This was never taught. Getting it wrong is information about transfer, not about forgetting.', true);
  }

  const fast = e.timeSpentSeconds != null && e.expectedSeconds != null
    && e.timeSpentSeconds < e.expectedSeconds * 0.5;
  const slow = e.timeSpentSeconds != null && e.expectedSeconds != null
    && e.timeSpentSeconds > e.expectedSeconds * 1.6;
  const nearMiss = similarity(wrote, e.expectedAnswer) >= 0.72;
  const overconfident = e.confidenceBefore != null && e.confidenceBefore >= 0.75;

  // --- careless: knew it, answered too fast, answer is nearly right --------
  // Requires BOTH speed and near-correctness. Either alone is not enough:
  // fast-and-wrong is often a guess, and near-miss-but-slow is usually a
  // procedure breaking down late.
  if (fast && nearMiss && e.previouslyCorrect) {
    return mk('careless', 0.8, 'Answered fast, very close to right, and she has had this correct before — a slip, not a gap.');
  }

  // --- retrieval: had it, time has passed, no sign of a broken model -------
  if (e.previouslyCorrect && (e.daysSinceTaught ?? 0) >= 7 && !overconfident) {
    return mk('retrieval', 0.75,
      `She had this right before and it is ${e.daysSinceTaught} days since it was taught. That is decay, not misunderstanding.`);
  }

  // --- procedural: right approach visible, breaks down partway -------------
  if (partial || (slow && nearMiss)) {
    return mk('procedural', 0.7,
      partial ? 'Partial marks — the method is there and fails partway through.'
              : 'Took longer than expected and landed close — the approach is right, the execution is not.');
  }

  // --- transfer: knows the unit, this question wears different clothes -----
  if (e.previouslyCorrect && (e.daysSinceTaught ?? 99) < 7) {
    return mk('transfer', 0.65,
      'Correct on this unit recently, wrong here — the underlying idea is there but this presentation of it is not recognised.');
  }

  // --- conceptual: the default, deliberately ------------------------------
  // Nothing above fired, so the signals are thin. Resolve deeper: assuming a
  // slip and moving on would leave a broken model in place to fail every
  // question built on top of it.
  const confident = overconfident || fast;
  return mk('conceptual', confident ? 0.7 : 0.45,
    overconfident
      ? 'Wrong but confident — that pattern almost always means the model underneath is wrong rather than missing.'
      : 'No sign of a slip, a decay or a partial method. Treating it as a wrong model, because assuming otherwise leaves it in place.',
    !confident);
}

// ============================================================================
// 3. Aggregating a whole paper
// ============================================================================

export interface PaperProfile {
  total: number;
  byKind: Record<ErrorKind, number>;
  /** Marks earned / available, where known. */
  scorePct: number | null;
  /** The single most useful sentence about this paper. */
  headline: string;
  /** Ordered — most valuable action first. */
  recommendations: string[];
  /** Per knowledge type, how she fared. This is what feeds calibration. */
  byKnowledgeType: Array<{
    knowledgeType: KnowledgeType;
    attempted: number;
    correct: number;
    dominantError: ErrorKind | null;
  }>;
}

export function profilePaper(
  diagnoses: Diagnosis[],
  evidence: AttemptEvidence[],
): PaperProfile {
  const byKind = Object.fromEntries(
    (Object.keys(ERROR_LABEL) as ErrorKind[]).map((k) => [k, 0]),
  ) as Record<ErrorKind, number>;
  for (const d of diagnoses) byKind[d.kind] += 1;

  const awarded = evidence.reduce((s, e) => s + (e.marksAwarded ?? 0), 0);
  const available = evidence.reduce((s, e) => s + (e.marksAvailable ?? 0), 0);
  const scorePct = available > 0 ? Math.round((awarded / available) * 100) : null;

  // Per knowledge type
  const byType = new Map<KnowledgeType, { attempted: number; correct: number; kinds: ErrorKind[] }>();
  diagnoses.forEach((d, i) => {
    const kt = evidence[i]?.knowledgeType;
    if (!kt) return;
    if (!byType.has(kt)) byType.set(kt, { attempted: 0, correct: 0, kinds: [] });
    const b = byType.get(kt)!;
    b.attempted += 1;
    if (d.kind === 'correct') b.correct += 1;
    else b.kinds.push(d.kind);
  });

  const byKnowledgeType = Array.from(byType.entries()).map(([knowledgeType, b]) => ({
    knowledgeType,
    attempted: b.attempted,
    correct: b.correct,
    dominantError: mode(b.kinds),
  }));

  return {
    total: diagnoses.length,
    byKind,
    scorePct,
    headline: headlineFor(byKind, scorePct, diagnoses.length),
    recommendations: recommend(byKind, byKnowledgeType),
    byKnowledgeType,
  };
}

/**
 * The headline leads with the DOMINANT ERROR KIND, not the score.
 *
 * "38%" tells a parent almost nothing about what to do next. "Most of what she
 * lost was material she had right a fortnight ago" tells them the teaching is
 * working and the review schedule is not — a completely different response,
 * and invisible in the number.
 */
function headlineFor(byKind: Record<ErrorKind, number>, scorePct: number | null, total: number): string {
  const wrong = total - byKind.correct;
  const score = scorePct != null ? `${scorePct}%. ` : '';
  if (wrong === 0) return `${score}Everything correct.`;

  const worst = (Object.entries(byKind) as Array<[ErrorKind, number]>)
    .filter(([k]) => k !== 'correct')
    .sort((a, b) => b[1] - a[1])[0];
  if (!worst || worst[1] === 0) return `${score}${wrong} wrong.`;

  const [kind, n] = worst;
  const share = Math.round((n / wrong) * 100);
  switch (kind) {
    case 'careless':
      return `${score}${share}% of the losses were slips on things she knows. The teaching is not the problem — the pace is.`;
    case 'retrieval':
      return `${score}${share}% of the losses were material she had right before and has since lost. That is a review-schedule problem, not a teaching one.`;
    case 'conceptual':
      return `${score}${share}% of the losses come from a wrong model underneath, not from forgetting. More practice on the same approach will entrench it.`;
    case 'procedural':
      return `${score}${share}% of the losses were right-idea-wrong-execution. She needs scaffolded practice, not re-explanation.`;
    case 'transfer':
      return `${score}${share}% of the losses were things she knows, asked in an unfamiliar form. She needs the same idea in different clothes.`;
    case 'not_attempted':
      return `${score}${share}% was left blank. Before anything else, find out whether that was time or avoidance.`;
    default:
      return `${score}${wrong} wrong.`;
  }
}

function recommend(
  byKind: Record<ErrorKind, number>,
  byType: PaperProfile['byKnowledgeType'],
): string[] {
  const out: string[] = [];
  const ranked = (Object.entries(byKind) as Array<[ErrorKind, number]>)
    .filter(([k, n]) => k !== 'correct' && n > 0)
    .sort((a, b) => b[1] - a[1]);

  for (const [kind, n] of ranked.slice(0, 3)) {
    out.push(`${n}x ${ERROR_LABEL[kind].toLowerCase()} — ${ERROR_ACTION[kind]}`);
  }

  const weakest = [...byType]
    .filter((t) => t.attempted >= 2)
    .sort((a, b) => (a.correct / a.attempted) - (b.correct / b.attempted))[0];
  if (weakest && weakest.correct / weakest.attempted < 0.6) {
    out.push(
      `Weakest by kind of knowledge: ${weakest.knowledgeType.replace(/_/g, ' ')} ` +
      `(${weakest.correct}/${weakest.attempted}). That is the axis to work on, not the chapter as a whole.`,
    );
  }
  return out;
}

// ============================================================================
// 4. Helpers
// ============================================================================

/** Token-overlap similarity — good enough to spot a near-miss answer. */
export function similarity(a: string, b: string): number {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9ঀ-৿\s]/g, ' ').split(/\s+/).filter(Boolean);
  const A = norm(a);
  const B = norm(b);
  if (A.length === 0 || B.length === 0) return 0;
  const setB = new Set(B);
  const hits = A.filter((t) => setB.has(t)).length;
  return (2 * hits) / (A.length + B.length);
}

function mode<T>(xs: T[]): T | null {
  if (xs.length === 0) return null;
  const counts = new Map<T, number>();
  for (const x of xs) counts.set(x, (counts.get(x) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/** Deeper of two diagnoses — used when two signals disagree. */
export function deeperOf(a: ErrorKind, b: ErrorKind): ErrorKind {
  return DEPTH.indexOf(a) >= DEPTH.indexOf(b) ? a : b;
}
