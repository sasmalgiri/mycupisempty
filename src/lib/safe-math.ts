/**
 * Percentages and averages that never render as "NaN%".
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * Every progress surface in the app computes some variant of
 *
 *     Math.round(items.reduce((s, i) => s + i.value, 0) / items.length)
 *
 * which is 0/0 = NaN the moment the list is empty — and the list is empty for
 * exactly the students who matter most: the ones who just signed up. A brand
 * new account was greeted with "Overall Progress: NaN%".
 *
 * An empty list means "nothing yet", and nothing yet is 0 — not undefined, not
 * NaN. These helpers make that the default so the next progress widget cannot
 * reintroduce it.
 */

/** Average of a list; 0 for an empty list. Rounded to a whole number. */
export function average(values: number[]): number {
  if (!values.length) return 0;
  const sum = values.reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0);
  return Math.round(sum / values.length);
}

/** Average of `key` across a list of objects; 0 when empty. */
export function averageBy<T>(items: T[], pick: (item: T) => number): number {
  return average(items.map(pick));
}

/**
 * `part` as a whole-number percentage of `total`, clamped to 0..100.
 * Returns 0 when `total` is 0 — the "no denominator yet" case.
 */
export function percent(part: number, total: number): number {
  if (!total || !Number.isFinite(total) || !Number.isFinite(part)) return 0;
  const pct = Math.round((part / total) * 100);
  return Math.min(100, Math.max(0, pct));
}

/** Division with an explicit fallback for a zero/invalid denominator. */
export function safeDiv(numerator: number, denominator: number, fallback = 0): number {
  if (!denominator || !Number.isFinite(denominator) || !Number.isFinite(numerator)) return fallback;
  return numerator / denominator;
}
