/**
 * Method narrowing — Phase E.5.
 *
 * Persona + plan + companion-mode-history come in. For each (subject, chapter)
 * the student is going to study, this picks ONE explanation method:
 *
 *   visual | story | step_by_step | example_first | socratic | drill | hands_on
 *
 * The choice is logged to student_method_assignments so we can later answer
 * "Aryabhata tried visual for algebra → exit-eval avg 0.42 → switched to
 * story → avg climbed to 0.78".
 *
 * Decision rules (in order of authority):
 *
 *   1. Manual override — learner_profiles.baseline_profile.learning_modes[subjectId]
 *      wins outright. The student told us how to teach them; we listen.
 *
 *   2. Companion's most-recent decision — if companion_mode_history has an
 *      'accepted' or 'auto_applied' row in the last 14 days for this subject,
 *      use that mode.
 *
 *   3. Persona-derived default per subject:
 *      - Math       : numerical_fluency >= 0.7 → drill;
 *                     visual_processing_speed >= 0.7 → visual;
 *                     else step_by_step
 *      - Science    : inference_strength >= 0.7 → socratic;
 *                     visual_processing_speed >= 0.6 → visual;
 *                     curiosity_breadth >= 0.7 → hands_on;
 *                     else example_first
 *      - English    : reading_fluency >= 0.7 → story;
 *                     inference_strength >= 0.6 → socratic;
 *                     else step_by_step
 *      - Bengali    : empathy_leaning >= 0.6 OR reading_fluency >= 0.6 → story;
 *                     else step_by_step
 *      - History    : reading_fluency >= 0.6 → story;
 *                     curiosity_breadth >= 0.7 → example_first;
 *                     else step_by_step
 *      - Geography  : visual_processing_speed >= 0.7 → visual;
 *                     curiosity_breadth >= 0.6 → hands_on;
 *                     else step_by_step
 *      - Phys/Life Sci: same as Science
 *      - default    : step_by_step
 *
 *   4. Effort-tolerance modulator:
 *      - effort_tolerance < 0.35 → upgrade 'socratic' or 'hands_on' to
 *        'example_first' (Socratic discovery is brutal for low-effort
 *        students; ease them in with worked examples first)
 *
 * Pure function. The caller (API) handles persistence into
 * student_method_assignments.
 */

export type Method =
  | 'visual' | 'story' | 'step_by_step' | 'example_first' | 'socratic' | 'drill' | 'hands_on';

export interface NarrowInput {
  subjectSlug: string;
  topicId?: string | null;
  chapterId?: string | null;
  // Persona axes (any may be null when not yet measured)
  persona: {
    visual_processing_speed?: number | null;
    reading_fluency?: number | null;
    numerical_fluency?: number | null;
    inference_strength?: number | null;
    curiosity_breadth?: number | null;
    empathy_leaning?: number | null;
    effort_tolerance?: number | null;
  };
  // Manual override per subject from learner_profiles.baseline_profile.learning_modes
  manualOverride?: Method | null;
  // Companion's most recent accepted/auto_applied row in last 14 days
  companionRecent?: { mode: Method; reason: string } | null;
}

export interface NarrowOutput {
  method: Method;
  reason: 'student_override' | 'companion_switch' | 'plan_generator';
  evidence: Record<string, any>;
}

const SUBJECT_DEFAULT_RULES: Record<string, (p: NarrowInput['persona']) => Method> = {
  math:             (p) => {
    if ((p.numerical_fluency ?? 0) >= 0.7) return 'drill';
    if ((p.visual_processing_speed ?? 0) >= 0.7) return 'visual';
    return 'step_by_step';
  },
  science:          (p) => {
    if ((p.inference_strength ?? 0) >= 0.7) return 'socratic';
    if ((p.visual_processing_speed ?? 0) >= 0.6) return 'visual';
    if ((p.curiosity_breadth ?? 0) >= 0.7) return 'hands_on';
    return 'example_first';
  },
  physical_science: (p) => SUBJECT_DEFAULT_RULES.science(p),
  life_science:     (p) => SUBJECT_DEFAULT_RULES.science(p),
  english:          (p) => {
    if ((p.reading_fluency ?? 0) >= 0.7) return 'story';
    if ((p.inference_strength ?? 0) >= 0.6) return 'socratic';
    return 'step_by_step';
  },
  bengali:          (p) => {
    if ((p.empathy_leaning ?? 0) >= 0.6 || (p.reading_fluency ?? 0) >= 0.6) return 'story';
    return 'step_by_step';
  },
  history:          (p) => {
    if ((p.reading_fluency ?? 0) >= 0.6) return 'story';
    if ((p.curiosity_breadth ?? 0) >= 0.7) return 'example_first';
    return 'step_by_step';
  },
  geography:        (p) => {
    if ((p.visual_processing_speed ?? 0) >= 0.7) return 'visual';
    if ((p.curiosity_breadth ?? 0) >= 0.6) return 'hands_on';
    return 'step_by_step';
  },
  social:           (p) => SUBJECT_DEFAULT_RULES.history(p),
};

function applyEffortModulator(method: Method, effortTolerance: number | null | undefined): Method {
  if (effortTolerance == null) return method;
  if (effortTolerance >= 0.35) return method;
  // Low effort tolerance: ease away from cognitively demanding methods.
  if (method === 'socratic') return 'example_first';
  if (method === 'hands_on') return 'example_first';
  return method;
}

export function narrowMethod(input: NarrowInput): NarrowOutput {
  // 1. Manual override wins outright
  if (input.manualOverride) {
    return {
      method: input.manualOverride,
      reason: 'student_override',
      evidence: { source: 'learner_profiles.baseline_profile.learning_modes' },
    };
  }

  // 2. Companion's recent accepted decision wins next
  if (input.companionRecent) {
    return {
      method: input.companionRecent.mode,
      reason: 'companion_switch',
      evidence: { companionReason: input.companionRecent.reason },
    };
  }

  // 3. Persona-driven default
  const ruleFn = SUBJECT_DEFAULT_RULES[input.subjectSlug] || (() => 'step_by_step' as Method);
  const baseMethod = ruleFn(input.persona);
  const finalMethod = applyEffortModulator(baseMethod, input.persona.effort_tolerance);

  return {
    method: finalMethod,
    reason: 'plan_generator',
    evidence: {
      subject: input.subjectSlug,
      basePersonaMethod: baseMethod,
      effortModulated: baseMethod !== finalMethod,
      personaSnapshot: input.persona,
    },
  };
}
