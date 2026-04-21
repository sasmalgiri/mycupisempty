/**
 * Intervention Engine — Targeted micro-lessons for misconceptions.
 *
 * Competitors detect that a student is struggling and either:
 *   (a) show the same content again (Khan Academy), or
 *   (b) lower the difficulty (Duolingo), or
 *   (c) suggest a video (BYJU'S).
 *
 * None of them understand WHY the student is wrong, and none inject
 * targeted counter-examples at the exact moment the misconception is active.
 *
 * This engine detects the specific wrong mental model and produces a
 * 60-second intervention that attacks it directly.
 */

import type { StudentState, MistakePattern } from './student-state';

export interface Intervention {
  id: string;
  triggerPattern: string;
  subjectId?: string;
  title: string;
  hook: string;                 // one-line grab their attention
  misconception: string;        // what they currently believe (wrong)
  correction: string;           // the truthful correction
  counterExample: string;       // a concrete case that exposes the error
  practicePrompt: string;       // a question that forces them to apply the correct model
  estimatedSeconds: number;     // how long this intervention takes
  urgency: 'immediate' | 'next_session' | 'this_week';
  modality: 'text' | 'visual' | 'dialogue';
}

// ============================================================
// Canonical misconception library — known wrong mental models
// ============================================================

const MISCONCEPTION_LIBRARY: Record<string, Omit<Intervention, 'id' | 'triggerPattern' | 'subjectId' | 'urgency'>> = {
  // === MATH ===
  'sign_errors': {
    title: 'Signs are sneaky',
    hook: 'Quick check: what is -3² ? Not 9 — the answer surprises most people.',
    misconception: 'Many students think -3² means (-3)×(-3) = 9.',
    correction: 'Without parentheses, -3² means -(3²) = -9. The negative sign is NOT inside the square unless parentheses say so.',
    counterExample: 'Compare: -3² = -9, but (-3)² = 9. The parentheses change everything.',
    practicePrompt: 'What is -2²? And what is (-2)²? Do they match?',
    estimatedSeconds: 60,
    modality: 'text',
  },
  'fraction_addition': {
    title: 'Fractions don\'t add the lazy way',
    hook: 'If 1/2 + 1/3 = 2/5, then half a pizza plus a third would be less than a third. That can\'t be right.',
    misconception: 'Adding numerators and denominators: 1/2 + 1/3 ≠ 2/5.',
    correction: 'You need a common denominator. 1/2 = 3/6, 1/3 = 2/6. So 3/6 + 2/6 = 5/6.',
    counterExample: 'Draw it: half a circle + third of a circle = more than half. 5/6 is more than 1/2. ✓',
    practicePrompt: 'Try: 1/4 + 1/3. What\'s the common denominator? What\'s the answer?',
    estimatedSeconds: 90,
    modality: 'visual',
  },
  'formula_misapplication': {
    title: 'Formulas need the right fit',
    hook: 'A formula is a recipe. Using it on the wrong dish gives strange results.',
    misconception: 'Applying area formulas to perimeter problems, or volume to area.',
    correction: 'Area is flat (2D, square units). Perimeter is distance around (1D, just length). Volume is space inside (3D, cubic units).',
    counterExample: 'A 3×4 rectangle: area = 12 square units, perimeter = 14 units. Same shape, different things measured.',
    practicePrompt: 'For a 5×2 rectangle, what\'s the area? What\'s the perimeter? Why are the numbers different?',
    estimatedSeconds: 75,
    modality: 'text',
  },
  'careless_arithmetic': {
    title: 'Small slips, big difference',
    hook: 'You know the method. The arithmetic is what\'s catching you.',
    misconception: 'Skipping the verification step — trusting a fast answer.',
    correction: 'Every answer deserves a 5-second sanity check: does it feel right in scale?',
    counterExample: 'If asked "what\'s 19 × 21?" and you get 359, pause. 19 × 21 ≈ 20 × 20 = 400. Your answer should be near 400. It\'s actually 399.',
    practicePrompt: 'Quick estimate: 48 × 52 is roughly…? Then compute exactly.',
    estimatedSeconds: 45,
    modality: 'text',
  },
  'concept_gap': {
    title: 'Let\'s rebuild from the ground up',
    hook: 'The wall you\'re hitting is because a brick underneath is missing.',
    misconception: 'Trying to build on an incomplete prerequisite.',
    correction: 'We\'ll go one level down and rebuild the foundation. Once it\'s solid, this concept becomes obvious.',
    counterExample: 'Before we can divide fractions, multiplication of fractions must feel easy. Before logarithms, exponents must feel easy.',
    practicePrompt: 'What\'s the simpler version of this concept you learned first? Let\'s start there.',
    estimatedSeconds: 120,
    modality: 'dialogue',
  },

  // === SCIENCE ===
  'force_equals_motion': {
    title: 'No force ≠ no motion',
    hook: 'A ball rolling on ice keeps going. Where\'s the force pushing it?',
    misconception: 'Thinking objects need a constant force to stay in motion.',
    correction: 'Newton\'s 1st law: an object in motion stays in motion unless acted on. Force CHANGES motion, it doesn\'t MAINTAIN it.',
    counterExample: 'A satellite in space orbits with no engine — it keeps moving because nothing stops it.',
    practicePrompt: 'If you slide a book on a table and it stops, what force stopped it?',
    estimatedSeconds: 75,
    modality: 'text',
  },
  'mass_vs_weight': {
    title: 'On the moon, you weigh less but you\'re the same you',
    hook: 'An astronaut on the moon weighs 1/6 as much. But their mass? Unchanged.',
    misconception: 'Using mass and weight interchangeably.',
    correction: 'Mass = how much matter you\'re made of (kg, unchanging). Weight = gravitational force on that mass (N, depends on gravity).',
    counterExample: '60 kg on Earth feels like ~600 N. On the moon: 60 kg still, but only ~100 N of weight.',
    practicePrompt: 'If gravity doubled tomorrow, would your mass change? Your weight?',
    estimatedSeconds: 60,
    modality: 'text',
  },

  // === ENGLISH / LANGUAGE ===
  'tense_confusion': {
    title: 'Tenses are a timeline, not a rule book',
    hook: 'English tenses tell WHEN and HOW — simple past vs past perfect is about sequence.',
    misconception: 'Using simple past when you need past perfect (or vice versa).',
    correction: 'Past perfect (had + V3) is for actions that happened BEFORE another past action. It\'s "the past of the past."',
    counterExample: 'When I reached the station, the train had left. (It left before I arrived — had left = past perfect.)',
    practicePrompt: 'Fill in: "By the time she called, I ___ (finish) dinner." Which tense fits?',
    estimatedSeconds: 90,
    modality: 'text',
  },
  'subject_verb_agreement': {
    title: 'The verb follows the real subject',
    hook: '"The box of chocolates ___ on the table." Is/are? The trap is the word between.',
    misconception: 'Matching the verb to the nearest noun instead of the true subject.',
    correction: 'Ignore prepositional phrases ("of chocolates"). The verb agrees with the actual subject ("box").',
    counterExample: '"The box of chocolates IS on the table." Singular box → singular IS.',
    practicePrompt: '"The team of players ___ practicing." Is/are?',
    estimatedSeconds: 45,
    modality: 'text',
  },

  // === GENERAL ===
  'guessing_pattern': {
    title: 'Guessing feels fast — but it\'s teaching your brain the wrong way',
    hook: 'Every quick guess makes the next attempt harder.',
    misconception: 'When stuck, clicking any option to "move on."',
    correction: 'A wrong guess burns into memory too. Better: take 15 seconds and say "I don\'t know yet" — that\'s honest learning.',
    counterExample: 'Neuroscience shows that effortful retrieval (even when wrong) strengthens memory. Random guesses don\'t.',
    practicePrompt: 'Next question: if you\'re unsure, try to name ONE reason before answering.',
    estimatedSeconds: 40,
    modality: 'dialogue',
  },
};

// ============================================================
// Detect interventions from StudentState
// ============================================================

export function detectInterventions(state: StudentState, subjectId?: string): Intervention[] {
  const interventions: Intervention[] = [];

  // Critical mistake patterns → high-urgency interventions
  for (const mp of state.activeMistakePatterns) {
    if (subjectId && mp.subject !== subjectId && mp.subject !== 'general') continue;

    const library = MISCONCEPTION_LIBRARY[mp.pattern];
    if (library) {
      interventions.push({
        id: `intv_${mp.pattern}_${mp.subject}`,
        triggerPattern: mp.pattern,
        subjectId: mp.subject,
        urgency: mp.severity === 'critical' ? 'immediate' : mp.severity === 'moderate' ? 'next_session' : 'this_week',
        ...library,
      });
    } else if (mp.severity === 'critical') {
      // No library match but critical — generate generic intervention
      interventions.push({
        id: `intv_generic_${mp.pattern}`,
        triggerPattern: mp.pattern,
        subjectId: mp.subject,
        urgency: 'immediate',
        title: 'Let\'s address this pattern',
        hook: `You\'ve hit the same snag ${mp.frequency} times. Time for a different angle.`,
        misconception: `Recurring error: ${mp.pattern.replace(/_/g, ' ')}.`,
        correction: mp.suggestedIntervention,
        counterExample: 'Every expert had this exact confusion once. The fix is always the same: slow down and rebuild.',
        practicePrompt: 'Can you describe in your own words what went wrong last time?',
        estimatedSeconds: 90,
        modality: 'dialogue',
      });
    }
  }

  // Active misconceptions from pedagogy engine
  for (const m of state.activeMisconceptions.slice(0, 3)) {
    // Try to match known library entries
    const key = m.toLowerCase().replace(/\s+/g, '_');
    const library = MISCONCEPTION_LIBRARY[key];
    if (library && !interventions.some((i) => i.triggerPattern === key)) {
      interventions.push({
        id: `intv_misc_${key}`,
        triggerPattern: key,
        urgency: 'immediate',
        ...library,
      });
    }
  }

  // Behavioral pattern: low persistence + many wrongs → "guessing" intervention
  if (state.persistenceScore < 0.3 && state.confidenceLevel < 4 && !interventions.some((i) => i.triggerPattern === 'guessing_pattern')) {
    interventions.push({
      id: 'intv_guessing',
      triggerPattern: 'guessing_pattern',
      urgency: 'next_session',
      ...MISCONCEPTION_LIBRARY['guessing_pattern'],
    });
  }

  // Sort by urgency
  const urgencyRank: Record<string, number> = { immediate: 0, next_session: 1, this_week: 2 };
  return interventions.sort((a, b) => urgencyRank[a.urgency] - urgencyRank[b.urgency]);
}

// ============================================================
// Select the single best intervention for a given moment
// ============================================================

export function pickInterventionForMoment(
  state: StudentState,
  moment: 'daily_mix_start' | 'after_wrong_answer' | 'session_close' | 'guru_chat',
  subjectId?: string,
): Intervention | null {
  const candidates = detectInterventions(state, subjectId);
  if (candidates.length === 0) return null;

  switch (moment) {
    case 'after_wrong_answer':
      // Immediate strike — most urgent, subject-specific
      return candidates.find((i) => i.urgency === 'immediate' && (!subjectId || i.subjectId === subjectId)) || candidates[0];
    case 'daily_mix_start':
      // Warm them up with something they'll face today
      return candidates.find((i) => i.urgency !== 'this_week') || candidates[0];
    case 'session_close':
      // Reflection-oriented — pick one of their recurring patterns
      return candidates.find((i) => i.triggerPattern !== 'guessing_pattern') || candidates[0];
    case 'guru_chat':
      return candidates[0];
  }
}

// ============================================================
// Turn an intervention into AI instructions
// ============================================================

export function interventionToAIPrompt(intervention: Intervention): string {
  return `
ACTIVE INTERVENTION — deliver this in your response:

The student is holding a specific misconception we need to correct: "${intervention.misconception}"

Correction to deliver: ${intervention.correction}

Counter-example to show: ${intervention.counterExample}

After explaining, ask: "${intervention.practicePrompt}"

Keep the intervention concise (~${intervention.estimatedSeconds} seconds of reading). Don't lecture — lead them to the insight. Use the counter-example to make the error feel obvious, not shameful.
`;
}
