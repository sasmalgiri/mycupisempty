/**
 * Which class is this student in?
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * A student's class is recorded in two places that disagree:
 *
 *   profiles.current_class    integer, the canonical column — but onboarding
 *                             does not always populate it, so it is frequently
 *                             NULL on real rows.
 *   profiles.education_level  text like 'class_5', written by the onboarding
 *                             flow and reliably present.
 *
 * The sidebar read only `current_class` and rendered "Class 0" for a student
 * whose profile clearly said `class_5`, while /subjects ignored the profile
 * altogether and hard-coded 6 — so the same screen showed two different
 * classes at once, and neither was the student's.
 *
 * Reading the class through one function means the next surface to need it
 * cannot invent a third answer.
 */

/** Shape we need — deliberately loose, callers select different column sets. */
export interface ClassBearingProfile {
  current_class?: number | string | null;
  education_level?: string | null;
}

/**
 * Resolve a class number (1-12), or null when the profile genuinely does not
 * say. Null means "ask the student" — it must NOT be coerced to 0 and shown,
 * which is how "Class 0" reached production.
 */
export function resolveClassLevel(profile: ClassBearingProfile | null | undefined): number | null {
  if (!profile) return null;

  const direct = Number(profile.current_class);
  if (Number.isFinite(direct) && direct >= 1 && direct <= 12) return direct;

  // 'class_5' -> 5. Also tolerates 'CLASS-11' and a bare '7'.
  const match = String(profile.education_level ?? '').match(/(\d{1,2})/);
  if (match) {
    const parsed = Number(match[1]);
    if (parsed >= 1 && parsed <= 12) return parsed;
  }

  return null;
}

/** Board code for display/filtering, upper-cased, with WBBSE's odd slug fixed. */
export function formatBoard(boardCode: string | null | undefined): string {
  if (!boardCode) return '';
  if (boardCode === 'wb_board' || boardCode === 'wbbse') return 'WBBSE';
  return boardCode.toUpperCase();
}
