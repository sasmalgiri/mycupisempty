/**
 * Coverage targets per chapter — the "exhaustive" specification.
 *
 * Every chapter, when fully populated, should have at least these counts of
 * each question type. When admin runs the generator, it tops up to these
 * numbers. Coverage view in migration 026 surfaces gaps.
 *
 * Targets are calibrated to typical Indian school exams across class bands:
 *   Class 6-8  : 14 questions per chapter (lighter Bloom mix)
 *   Class 9-10 : 18 questions per chapter (heavier Bloom mix, Madhyamik-shaped)
 */

export interface CoverageTarget {
  mcq: number;
  very_short: number;
  short: number;
  long: number;
  application: number;
  hots: number;
  match: number;
  fill_blank: number;
  true_false: number;
}

export function targetForClass(classLevel: number): CoverageTarget {
  if (classLevel >= 9) {
    // Madhyamik-shaped
    return {
      mcq: 5,
      very_short: 3,
      short: 3,
      long: 2,
      application: 2,
      hots: 1,
      match: 1,
      fill_blank: 1,
      true_false: 0,
    };
  }
  if (classLevel >= 6) {
    return {
      mcq: 5,
      very_short: 3,
      short: 2,
      long: 1,
      application: 1,
      hots: 0,
      match: 1,
      fill_blank: 1,
      true_false: 0,
    };
  }
  // Class 1-5 — lessons not chapters; this layer rarely applies
  return {
    mcq: 3, very_short: 2, short: 1, long: 0,
    application: 0, hots: 0, match: 1, fill_blank: 1, true_false: 1,
  };
}

export const QUESTION_TYPES = [
  'mcq', 'very_short', 'short', 'long',
  'application', 'hots', 'match', 'fill_blank', 'true_false',
] as const;

export type QuestionType = typeof QUESTION_TYPES[number];

/** Returns a list of (type, count_needed) entries given current coverage. */
export function gapAgainstTarget(
  current: Partial<Record<QuestionType, number>>,
  target: CoverageTarget,
): Array<{ type: QuestionType; needed: number }> {
  const out: Array<{ type: QuestionType; needed: number }> = [];
  for (const t of QUESTION_TYPES) {
    const have = current[t] || 0;
    const want = (target as any)[t] || 0;
    if (want > have) out.push({ type: t, needed: want - have });
  }
  return out;
}

export function totalForClass(classLevel: number): number {
  const t = targetForClass(classLevel);
  return Object.values(t).reduce((a, b) => a + b, 0);
}
