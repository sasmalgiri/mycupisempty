/**
 * Signal Types — canonical enum to prevent fragmentation.
 *
 * We were using `'mood'` + `'mood_emoji'` + inconsistent `'step_time'` vs
 * `'time_spent'` across different producers. This fragments downstream
 * filters and can silently lose signals. This file is the single source
 * of truth.
 *
 * If you want to add a new signal type, add it here FIRST, then use the
 * constant in producer + consumer code. Never string-literal a type.
 */

// ============================================================
// Canonical signal types
// ============================================================

export const SIGNAL = {
  // === Performance ===
  ANSWER_RESULT: 'answer_result',            // value=1 correct, 0 wrong
  FLASHCARD_REVIEW: 'flashcard_review',      // metadata: quality 0..5
  METHOD_OUTCOME: 'method_outcome',          // behavioral calibration outcome
  PREDICTION_RECORD: 'prediction_record',    // metacognitive predict-then-answer

  // === Time / Engagement ===
  TIME_SPENT: 'time_spent',                  // value=seconds on a step/session
  STEP_TIME: 'step_time',                    // alias — consumers should accept both
  SESSION_START: 'session_start',
  SESSION_END: 'session_end',

  // === Emotional state (micro check-ins) ===
  MOOD: 'mood',                              // canonical; do NOT use 'mood_emoji'
  ENERGY_LEVEL: 'energy_level',
  /**
   * difficulty_feel — how hard the student felt a step/session was.
   * VALUE CONVENTION: monotone in difficulty.
   *   too_easy   → 0
   *   just_right → 0.5
   *   too_hard   → 1
   * Higher value = harder. Do NOT invert at any write site — downstream
   * aggregation averages these and inverted writers cancel each other out.
   */
  DIFFICULTY_FEEL: 'difficulty_feel',
  UNDERSTANDING_CHECK: 'understanding_check',
  FRUSTRATION_SIGNAL: 'frustration_signal',

  // === Habits + Reflection ===
  HABIT_COMPLETION: 'habit_completion',
  REFLECTION_DEPTH: 'reflection_depth',      // value = word count as a proxy
  REST_DAY_USED: 'rest_day_used',

  // === AI Interactions ===
  AI_GURU_INTERACTION: 'ai_guru_interaction',
  AI_CHAT_INTERACTION: 'ai_chat_interaction',
  PHOTO_SOLVE_REQUEST: 'photo_solve_request',
  CONTENT_GEN_REQUEST: 'content_gen_request',

  // === Preferences / Behavior ===
  PREFERENCE_CHOICE: 'preference_choice',
  ERROR_PATTERN: 'error_pattern',
} as const;

export type SignalType = typeof SIGNAL[keyof typeof SIGNAL];

// ============================================================
// Categories — higher-level tagging
// ============================================================

export const CATEGORY = {
  PERFORMANCE: 'performance',
  ENGAGEMENT: 'engagement',
  EMOTIONAL: 'emotional',
  METACOGNITION: 'metacognition',
  HELP_SEEKING: 'help_seeking',
  CHARACTER: 'character',
} as const;

export type SignalCategory = typeof CATEGORY[keyof typeof CATEGORY];

// ============================================================
// Mood canonicalization — both 'mood' and 'mood_emoji' should map here
// ============================================================

export const MOOD_TYPES = new Set<string>([SIGNAL.MOOD, 'mood_emoji']);
export const TIME_TYPES = new Set<string>([SIGNAL.TIME_SPENT, SIGNAL.STEP_TIME]);

/** Returns true if the given signal_type should be treated as a mood record */
export function isMoodSignal(type: unknown): boolean {
  return typeof type === 'string' && MOOD_TYPES.has(type);
}

/** Returns true if the given signal_type should be treated as a time record */
export function isTimeSignal(type: unknown): boolean {
  return typeof type === 'string' && TIME_TYPES.has(type);
}
