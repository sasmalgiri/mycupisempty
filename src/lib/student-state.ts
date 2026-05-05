import { SIGNAL, isMoodSignal, isTimeSignal } from './signal-types';

/**
 * StudentState — The Brain of MyCupIsEmpty
 *
 * This is the SINGLE source of truth about who a student is RIGHT NOW.
 * Every component in the system reads from this. It's built from:
 * - Database records (performance history, pedagogy state)
 * - Real-time signals (what they just did in this session)
 * - Behavioral patterns (accumulated over time)
 *
 * This is NOT a learning style label. This is a living, breathing model
 * of a human being who has good days and bad days, who is strong in
 * some things and struggles with others, who gets frustrated and excited.
 */

// ============================================================
// THE STATE — everything we know about this student right now
// ============================================================

export interface StudentState {
  userId: string;
  classLevel: number;
  board: string;

  // === EMOTIONAL STATE (right now, this session) ===
  currentMood: 'energetic' | 'calm' | 'anxious' | 'frustrated' | 'bored' | 'confused' | 'neutral';
  energyLevel: 'high' | 'medium' | 'low';
  frustrationLevel: number;           // 0-10, real-time
  confidenceLevel: number;            // 0-10, recent trend

  // === COGNITIVE STATE ===
  attentionSpanMinutes: number;       // measured, not guessed
  minutesActiveToday: number;         // how long they've been learning today
  isNearDropOff: boolean;             // are they about to disengage?
  cognitiveLoad: 'light' | 'moderate' | 'heavy'; // how much new stuff they've absorbed today

  // === PERFORMANCE PATTERNS (per subject) ===
  subjectStates: Record<string, SubjectState>;

  // === BEHAVIORAL PATTERNS ===
  persistenceScore: number;           // 0-1: do they retry after failure?
  helpSeekingRate: number;            // 0-1: how often they ask for help
  prefersEncouragement: boolean;      // responds well to praise?
  prefersChallenge: boolean;          // motivated by difficulty?
  bestTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  avgSessionMinutes: number;          // typical session length

  // === MISTAKE PATTERNS (the gold) ===
  activeMistakePatterns: MistakePattern[];
  activeMisconceptions: string[];

  // === ADAPTATION CONTEXT ===
  recentAdaptations: string[];        // what we changed recently and why
  profileConfidence: number;          // 0-1: how sure are we about this profile?
}

export interface SubjectState {
  subjectId: string;
  subjectName: string;
  // Performance
  recentAccuracy: number;             // 0-1, last 10 attempts
  accuracyTrend: 'improving' | 'stable' | 'declining';
  avgTimePerQuestion: number;         // seconds
  // Mastery
  currentBand: 'foundation' | 'emerging' | 'developing' | 'secure' | 'advanced';
  stalledTopics: string[];            // topics where they're stuck
  strongTopics: string[];             // topics they've mastered
  // What works
  bestMethod: string;                 // teaching method that works best here
  bestExplanationStyle: 'visual' | 'story' | 'step_by_step' | 'example_first' | 'analogy' | 'socratic';
  // Confidence gap
  confidenceAccuracyGap: number;      // positive = overconfident, negative = underconfident
  // Mistakes in this subject
  commonErrors: string[];             // e.g., "sign_errors_algebra", "tense_confusion_english"
  // Calibration: is the current method choice an exploration or exploit?
  calibrationExploring?: boolean;
}

export interface MistakePattern {
  pattern: string;                    // e.g., "careless_arithmetic", "concept_gap_fractions"
  subject: string;
  frequency: number;                  // how often this happens (count)
  severity: 'minor' | 'moderate' | 'critical'; // minor = careless, critical = fundamental misunderstanding
  lastSeen: string;                   // ISO date
  suggestedIntervention: string;      // what to do about it
}

// ============================================================
// BUILD THE STATE — from database + signals
// ============================================================

/**
 * Fetch and compute the full student state from all available data.
 * Called server-side before any teaching decision.
 */
export async function buildStudentState(supabase: any, userId: string): Promise<StudentState> {
  // Fetch everything we know in parallel
  const [
    profileResult,
    learnerStateResult,
    pedagogyResult,
    signalsResult,
    learningStyleResult,
    developmentResult,
  ] = await Promise.all([
    // User profile
    supabase.from('profiles').select('current_class, school_name, board_code').eq('id', userId).single().catch(() => ({ data: null })),
    // Learner state per topic
    supabase.from('learner_state').select('topic_id, current_band, scaffold_level, last_active_at, stalled_cycles, topics(id, title, subject_id, subjects(id, title))').eq('user_id', userId).catch(() => ({ data: null })),
    // Pedagogy state (misconceptions, frustration)
    supabase.from('pedagogy_state').select('*').eq('user_id', userId).catch(() => ({ data: null })),
    // Recent signals (last 50)
    supabase.from('learner_signals').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50).catch(() => ({ data: null })),
    // Learning style (backward compat)
    supabase.from('learning_styles').select('*').eq('user_id', userId).single().catch(() => ({ data: null })),
    // Development profile
    supabase.from('student_development_profile').select('*').eq('user_id', userId).single().catch(() => ({ data: null })),
  ]);

  const profile = profileResult?.data;
  const learnerStates = learnerStateResult?.data || [];
  const pedagogyStates = pedagogyResult?.data || [];
  const signals = signalsResult?.data || [];
  const development = developmentResult?.data;

  // === Compute emotional state from recent signals ===
  const moodSignals = signals.filter((s: any) => isMoodSignal(s.signal_type));
  const frustrationSignals = signals.filter((s: any) => s.signal_type === SIGNAL.FRUSTRATION_SIGNAL);
  const recentMood = moodSignals.length > 0 ? interpretMood(moodSignals[0]?.metadata?.mood || moodSignals[0]?.metadata?.response) : 'neutral';
  const frustrationLevel = Math.min(frustrationSignals.length, 10);

  // === Compute attention span from time signals ===
  const timeSignals = signals.filter((s: any) => isTimeSignal(s.signal_type));
  const avgStepTime = timeSignals.length > 0
    ? timeSignals.reduce((sum: number, s: any) => sum + s.value, 0) / timeSignals.length
    : 600; // default 10 min
  const estimatedAttention = Math.min(Math.max(Math.round(avgStepTime / 60), 5), 45);

  // === Compute performance per subject ===
  const answerSignals = signals.filter((s: any) => s.signal_type === 'answer_result');
  const subjectStates: Record<string, SubjectState> = {};

  // Group learner states by subject
  const subjectTopics: Record<string, any[]> = {};
  for (const ls of learnerStates) {
    const subjectId = ls.topics?.subject_id || ls.topics?.subjects?.id;
    const subjectName = ls.topics?.subjects?.title || 'Unknown';
    if (subjectId) {
      if (!subjectTopics[subjectId]) subjectTopics[subjectId] = [];
      subjectTopics[subjectId].push({ ...ls, subjectName });
    }
  }

  for (const [subjectId, topics] of Object.entries(subjectTopics)) {
    const subjectName = (topics[0] as any)?.subjectName || 'Unknown';
    const subjectAnswers = answerSignals.filter((s: any) => s.subject_id === subjectId);
    const recentAccuracy = subjectAnswers.length > 0
      ? subjectAnswers.slice(0, 10).reduce((sum: number, s: any) => sum + s.value, 0) / Math.min(subjectAnswers.length, 10)
      : 0.5;

    // Find stalled and strong topics
    const stalledTopics = topics
      .filter((t: any) => (t.stalled_cycles || 0) >= 3)
      .map((t: any) => t.topics?.title || t.topic_id);
    const strongTopics = topics
      .filter((t: any) => t.current_band === 'secure' || t.current_band === 'advanced')
      .map((t: any) => t.topics?.title || t.topic_id);

    // Find pedagogy state for this subject's misconceptions
    const subjectPedagogy = pedagogyStates.filter((p: any) => {
      return topics.some((t: any) => t.topic_id === p.topic_id);
    });
    const misconceptions = subjectPedagogy
      .flatMap((p: any) => p.active_misconceptions || [])
      .filter(Boolean);
    const confidenceGap = subjectPedagogy.length > 0
      ? subjectPedagogy.reduce((sum: number, p: any) => sum + (p.confidence_accuracy_gap || 0), 0) / subjectPedagogy.length
      : 0;

    // Determine best band
    const bands = topics.map((t: any) => t.current_band);
    const bandPriority: Record<string, number> = { foundation: 0, emerging: 1, developing: 2, secure: 3, advanced: 4 };
    const avgBandScore = bands.reduce((sum: number, b: string) => sum + (bandPriority[b] || 0), 0) / bands.length;
    const currentBand = avgBandScore < 0.5 ? 'foundation' : avgBandScore < 1.5 ? 'emerging' : avgBandScore < 2.5 ? 'developing' : avgBandScore < 3.5 ? 'secure' : 'advanced';

    // Calibrated best method — from behavioral observation, not self-report
    let calibratedMethod = 'feynman';
    let explorationActive = false;
    try {
      const { computeMethodStats, recommendMethod } = await import('./method-calibration');
      const methodStats = await computeMethodStats(supabase, userId, subjectId, subjectName);
      const rec = recommendMethod(methodStats, subjectName);
      calibratedMethod = rec.recommendedMethod;
      explorationActive = rec.exploring;
    } catch {
      // if calibration fails, keep default
    }

    subjectStates[subjectId] = {
      subjectId,
      subjectName,
      recentAccuracy,
      accuracyTrend: computeAccuracyTrend(subjectAnswers),
      avgTimePerQuestion: subjectAnswers.length > 0
        ? subjectAnswers.reduce((sum: number, s: any) => sum + (s.metadata?.time_to_answer || 30), 0) / subjectAnswers.length
        : 30,
      currentBand: currentBand as any,
      stalledTopics,
      strongTopics,
      bestMethod: calibratedMethod,
      bestExplanationStyle: 'step_by_step',
      confidenceAccuracyGap: confidenceGap,
      commonErrors: extractErrorPatterns(subjectAnswers),
      calibrationExploring: explorationActive,
    };
  }

  // === Compute overall patterns ===
  const habitSignals = signals.filter((s: any) => s.signal_type === 'habit_completion');
  const reflectionSignals = signals.filter((s: any) => s.signal_type === 'reflection_depth');
  const hintSignals = signals.filter((s: any) => s.signal_type === 'frustration_signal' && s.metadata?.signal_detail === 'used_hint');

  const persistenceScore = computePersistence(answerSignals, frustrationSignals);
  const helpSeekingRate = signals.length > 0 ? hintSignals.length / signals.length : 0.1;

  // === Build mistake patterns ===
  const mistakePatterns = buildMistakePatterns(answerSignals, pedagogyStates);

  // === Misconceptions from pedagogy engine ===
  const allMisconceptions = pedagogyStates
    .flatMap((p: any) => p.active_misconceptions || [])
    .filter(Boolean);

  // === Confidence from behavior ===
  const overallAccuracy = answerSignals.length > 0
    ? answerSignals.reduce((sum: number, s: any) => sum + s.value, 0) / answerSignals.length
    : 0.5;
  const confidenceLevel = Math.round(overallAccuracy * 10);

  // === Time active today ===
  const todayStr = new Date().toISOString().split('T')[0];
  const todaySignals = signals.filter((s: any) => s.created_at?.startsWith(todayStr));
  const minutesActiveToday = todaySignals.length > 0
    ? todaySignals.reduce((sum: number, s: any) => isTimeSignal(s.signal_type) ? sum + (s.value || 0) / 60 : sum + 0.5, 0)
    : 0;

  return {
    userId,
    classLevel: profile?.current_class || 8,
    board: profile?.board_code || 'cbse',

    currentMood: recentMood as any,
    energyLevel: frustrationLevel > 5 ? 'low' : frustrationLevel > 2 ? 'medium' : 'high',
    frustrationLevel,
    confidenceLevel,

    attentionSpanMinutes: estimatedAttention,
    minutesActiveToday: Math.round(minutesActiveToday),
    isNearDropOff: minutesActiveToday > estimatedAttention * 0.8,
    cognitiveLoad: todaySignals.length > 30 ? 'heavy' : todaySignals.length > 15 ? 'moderate' : 'light',

    subjectStates,

    persistenceScore,
    helpSeekingRate,
    prefersEncouragement: confidenceLevel < 5 || frustrationLevel > 3,
    prefersChallenge: overallAccuracy > 0.8 && frustrationLevel < 2,
    bestTimeOfDay: deriveBestTimeOfDay(signals),
    avgSessionMinutes: estimatedAttention,

    activeMistakePatterns: mistakePatterns,
    activeMisconceptions: allMisconceptions,

    recentAdaptations: [],
    profileConfidence: Math.min(signals.length / 100, 1),
  };
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Pick the time-of-day bucket where the student has been most active in the
 * last ~30 days of signals. Quietly falls back to 'afternoon' when there's
 * not enough data yet.
 */
function deriveBestTimeOfDay(signals: any[]): 'morning' | 'afternoon' | 'evening' | 'night' {
  if (!signals || signals.length < 20) return 'afternoon';
  const buckets: Record<string, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  for (const s of signals) {
    if (!s?.created_at) continue;
    const d = new Date(s.created_at);
    const h = d.getHours();
    if (h >= 5 && h < 12) buckets.morning++;
    else if (h >= 12 && h < 17) buckets.afternoon++;
    else if (h >= 17 && h < 22) buckets.evening++;
    else buckets.night++;
  }
  let best: 'morning' | 'afternoon' | 'evening' | 'night' = 'afternoon';
  let max = -1;
  for (const k of Object.keys(buckets) as (keyof typeof buckets)[]) {
    if (buckets[k] > max) { max = buckets[k]; best = k as any; }
  }
  return best;
}

function interpretMood(mood: string | undefined): string {
  if (!mood) return 'neutral';
  const moodMap: Record<string, string> = {
    great: 'energetic', excited: 'energetic', okay: 'calm', calm: 'calm',
    struggling: 'frustrated', frustrated: 'frustrated', tough: 'frustrated',
    confused: 'confused', lost: 'confused',
    tired: 'bored', bored: 'bored', low: 'bored',
    curious: 'energetic', high: 'energetic',
  };
  return moodMap[mood] || 'neutral';
}

function computeAccuracyTrend(answers: any[]): 'improving' | 'stable' | 'declining' {
  if (answers.length < 6) return 'stable';
  const recent5 = answers.slice(0, 5).reduce((s: number, a: any) => s + a.value, 0) / 5;
  const prev5 = answers.slice(5, 10).reduce((s: number, a: any) => s + a.value, 0) / Math.min(answers.slice(5, 10).length, 5);
  if (recent5 - prev5 > 0.15) return 'improving';
  if (prev5 - recent5 > 0.15) return 'declining';
  return 'stable';
}

function computePersistence(answers: any[], frustrations: any[]): number {
  if (answers.length === 0) return 0.5;
  // How many times did they keep going after a wrong answer?
  let retries = 0;
  let failures = 0;
  for (let i = 1; i < answers.length; i++) {
    if (answers[i - 1].value === 0) {
      failures++;
      if (answers[i]) retries++; // they continued after failure
    }
  }
  if (failures === 0) return 0.8; // no failures = can't measure persistence
  return Math.min(retries / failures, 1);
}

function extractErrorPatterns(answers: any[]): string[] {
  const patterns: Record<string, number> = {};
  for (const a of answers) {
    if (a.value === 0 && a.metadata?.error_type) {
      patterns[a.metadata.error_type] = (patterns[a.metadata.error_type] || 0) + 1;
    }
  }
  return Object.entries(patterns)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([p]) => p);
}

function buildMistakePatterns(answers: any[], pedagogyStates: any[]): MistakePattern[] {
  const patterns: MistakePattern[] = [];

  // From answer signals with error metadata
  const errorCounts: Record<string, { count: number; subject: string; lastSeen: string }> = {};
  for (const a of answers) {
    if (a.value === 0) {
      const errorType = a.metadata?.error_type || 'unknown';
      const key = `${a.subject_id || 'general'}_${errorType}`;
      if (!errorCounts[key]) {
        errorCounts[key] = { count: 0, subject: a.subject_id || 'general', lastSeen: a.created_at };
      }
      errorCounts[key].count++;
      errorCounts[key].lastSeen = a.created_at;
    }
  }

  for (const [key, data] of Object.entries(errorCounts)) {
    const pattern = key.split('_').slice(1).join('_');
    patterns.push({
      pattern,
      subject: data.subject,
      frequency: data.count,
      severity: data.count > 5 ? 'critical' : data.count > 2 ? 'moderate' : 'minor',
      lastSeen: data.lastSeen,
      suggestedIntervention: getSuggestedIntervention(pattern, data.count),
    });
  }

  // From pedagogy state misconceptions
  for (const ps of pedagogyStates) {
    if (ps.active_misconceptions?.length > 0) {
      for (const misconception of ps.active_misconceptions) {
        patterns.push({
          pattern: `misconception: ${misconception}`,
          subject: ps.subject_id || 'general',
          frequency: ps.stalled_cycles || 1,
          severity: (ps.stalled_cycles || 0) > 3 ? 'critical' : 'moderate',
          lastSeen: ps.updated_at || new Date().toISOString(),
          suggestedIntervention: `Address misconception "${misconception}" directly with counter-examples and correct explanation.`,
        });
      }
    }
  }

  return patterns.sort((a, b) => b.frequency - a.frequency).slice(0, 10);
}

function getSuggestedIntervention(pattern: string, frequency: number): string {
  const interventions: Record<string, string> = {
    'careless_arithmetic': 'Add verification step. Ask student to double-check each calculation.',
    'sign_errors': 'Practice with sign-focused drills. Highlight sign changes in each step.',
    'concept_gap': 'Go back to prerequisites. Use the Feynman method to rebuild understanding.',
    'tense_confusion': 'Use timeline visualization for tenses. Compare with Bengali/Hindi tense structures.',
    'formula_misapplication': 'Show WHY the formula works, not just how. Use derivation-based teaching.',
    'reading_comprehension': 'Break text into smaller chunks. Ask questions after each paragraph.',
    'unknown': frequency > 3
      ? 'Student is repeatedly failing. Lower difficulty and rebuild from basics.'
      : 'Monitor this pattern. May resolve with practice.',
  };
  return interventions[pattern] || interventions['unknown'];
}

// ============================================================
// GENERATE AI CONTEXT — what the AI should know about this student
// ============================================================

/**
 * Turn StudentState into a concise system prompt section for the AI.
 * This is what makes the AI actually SEE the student.
 */
export function generateAIContext(state: StudentState, subjectId?: string): string {
  const lines: string[] = [];

  lines.push(`\n--- STUDENT INTELLIGENCE (live data, not a quiz) ---`);

  // Emotional state
  lines.push(`CURRENT STATE: Mood=${state.currentMood}, Energy=${state.energyLevel}, Frustration=${state.frustrationLevel}/10, Confidence=${state.confidenceLevel}/10`);

  if (state.frustrationLevel > 5) {
    lines.push(`⚠️ HIGH FRUSTRATION DETECTED — be extra gentle, lower difficulty, use more encouragement. This student is struggling right now.`);
  }
  if (state.isNearDropOff) {
    lines.push(`⚠️ ATTENTION DROPPING — student has been active ${state.minutesActiveToday}min (their limit is ~${state.attentionSpanMinutes}min). Keep responses SHORT and engaging.`);
  }
  if (state.currentMood === 'bored') {
    lines.push(`⚠️ STUDENT SEEMS BORED — increase challenge, use surprising facts, try a different angle.`);
  }
  if (state.currentMood === 'confused') {
    lines.push(`⚠️ STUDENT IS CONFUSED — start from basics, use concrete examples, check understanding frequently.`);
  }

  // Encouragement calibration
  if (state.prefersEncouragement) {
    lines.push(`ENCOURAGEMENT: This student responds well to praise. Celebrate small wins. Be warm.`);
  }
  if (state.prefersChallenge) {
    lines.push(`CHALLENGE: This student is strong. Don't oversimplify. Push them to think deeper.`);
  }

  // Subject-specific intelligence
  if (subjectId && state.subjectStates[subjectId]) {
    const ss = state.subjectStates[subjectId];
    lines.push(`\nSUBJECT: ${ss.subjectName}`);
    lines.push(`- Accuracy: ${Math.round(ss.recentAccuracy * 100)}% (trend: ${ss.accuracyTrend})`);
    lines.push(`- Mastery band: ${ss.currentBand}`);
    lines.push(`- Confidence gap: ${ss.confidenceAccuracyGap > 0 ? 'OVERCONFIDENT — ask questions to calibrate, don\'t just praise' : ss.confidenceAccuracyGap < -0.2 ? 'UNDERCONFIDENT — encourage more, show them they know more than they think' : 'calibrated'}`);

    if (ss.stalledTopics.length > 0) {
      lines.push(`- STUCK ON: ${ss.stalledTopics.join(', ')} — try a completely different approach for these`);
    }
    if (ss.strongTopics.length > 0) {
      lines.push(`- STRONG IN: ${ss.strongTopics.join(', ')} — can reference these as anchors for new concepts`);
    }
    if (ss.commonErrors.length > 0) {
      lines.push(`- COMMON ERRORS: ${ss.commonErrors.join(', ')} — watch for these and address proactively`);
    }
  }

  // Active misconceptions
  if (state.activeMisconceptions.length > 0) {
    lines.push(`\nACTIVE MISCONCEPTIONS (student believes these wrong things):`);
    state.activeMisconceptions.slice(0, 5).forEach(m => {
      lines.push(`  ❌ ${m} — gently correct this with evidence, don't just say "that's wrong"`);
    });
  }

  // Mistake patterns
  const criticalMistakes = state.activeMistakePatterns.filter(m => m.severity === 'critical');
  if (criticalMistakes.length > 0) {
    lines.push(`\nCRITICAL MISTAKE PATTERNS:`);
    criticalMistakes.forEach(m => {
      lines.push(`  🔴 ${m.pattern} (${m.frequency}x) — ${m.suggestedIntervention}`);
    });
  }

  // Behavioral patterns
  if (state.persistenceScore < 0.3) {
    lines.push(`\nPERSISTENCE: LOW — this student gives up easily after errors. Never show all mistakes at once. Build up gradually.`);
  }
  if (state.helpSeekingRate > 0.5) {
    lines.push(`HELP SEEKING: HIGH — student asks for help frequently. Guide them to try first before giving answers.`);
  }
  if (state.helpSeekingRate < 0.1 && state.confidenceLevel < 4) {
    lines.push(`HELP SEEKING: LOW + LOW CONFIDENCE — student may be too shy to ask for help. Proactively offer hints and check-ins.`);
  }

  // Cognitive load
  if (state.cognitiveLoad === 'heavy') {
    lines.push(`\nCOGNITIVE LOAD: HEAVY — student has already absorbed a lot today. Favor review and consolidation over new concepts.`);
  }

  lines.push(`--- END STUDENT INTELLIGENCE ---\n`);

  return lines.join('\n');
}

// ============================================================
// ADAPTATION DECISIONS — what should we change?
// ============================================================

export interface AdaptationDecision {
  difficulty: number;                 // 1-10
  teachingMethod: string;
  pace: 'slow' | 'moderate' | 'fast';
  encouragementLevel: 'high' | 'moderate' | 'low';
  shouldSimplify: boolean;
  shouldChallenge: boolean;
  shouldTakeBreak: boolean;
  focusOn: string[];                  // what to prioritize
  avoid: string[];                    // what to avoid
  reason: string;
}

/**
 * Based on student state, decide how to adapt the teaching experience.
 */
export function decideAdaptation(state: StudentState, subjectId?: string): AdaptationDecision {
  let difficulty = 5;
  // Default to the calibrated best method for this subject (behavior-driven)
  let method = subjectId && state.subjectStates[subjectId]?.bestMethod
    ? state.subjectStates[subjectId].bestMethod
    : 'feynman';
  let pace: 'slow' | 'moderate' | 'fast' = 'moderate';
  let encouragement: 'high' | 'moderate' | 'low' = 'moderate';
  const focusOn: string[] = [];
  const avoid: string[] = [];
  const reasons: string[] = [];

  const ss = subjectId ? state.subjectStates[subjectId] : undefined;

  // === Frustration response ===
  if (state.frustrationLevel > 6) {
    difficulty = Math.max(difficulty - 3, 1);
    encouragement = 'high';
    pace = 'slow';
    focusOn.push('review_strengths', 'build_confidence');
    avoid.push('new_concepts', 'hard_questions');
    reasons.push('High frustration — backing off difficulty');
  } else if (state.frustrationLevel > 3) {
    difficulty = Math.max(difficulty - 1, 2);
    encouragement = 'high';
    reasons.push('Moderate frustration — easing difficulty');
  }

  // === Boredom response ===
  if (state.currentMood === 'bored' || (ss?.recentAccuracy || 0) > 0.9) {
    difficulty = Math.min(difficulty + 2, 10);
    focusOn.push('challenge', 'novel_approach');
    avoid.push('basic_review', 'repetitive_drills');
    reasons.push('Student is bored/too easy — increasing challenge');
  }

  // === Confusion response ===
  if (state.currentMood === 'confused') {
    difficulty = Math.max(difficulty - 2, 1);
    method = 'feynman'; // simplest explanation
    pace = 'slow';
    focusOn.push('basics', 'concrete_examples');
    avoid.push('abstract_theory', 'multiple_concepts');
    reasons.push('Student is confused — going back to basics');
  }

  // === Subject-specific adaptation ===
  if (ss) {
    // Accuracy trend
    if (ss.accuracyTrend === 'declining') {
      difficulty = Math.max(difficulty - 1, 1);
      focusOn.push('review_fundamentals');
      reasons.push(`${ss.subjectName} accuracy declining — reviewing fundamentals`);
    } else if (ss.accuracyTrend === 'improving') {
      difficulty = Math.min(difficulty + 1, 10);
      reasons.push(`${ss.subjectName} accuracy improving — stepping up`);
    }

    // Stalled topics
    if (ss.stalledTopics.length > 0) {
      method = ss.bestMethod !== 'feynman' ? 'feynman' : 'analogy'; // try different method
      focusOn.push('stalled_topics_new_approach');
      reasons.push(`Stalled on: ${ss.stalledTopics[0]} — switching method`);
    }

    // Confidence gap
    if (ss.confidenceAccuracyGap > 0.2) {
      focusOn.push('calibration_questions');
      avoid.push('easy_confidence_boosters');
      reasons.push('Overconfident — adding calibration');
    } else if (ss.confidenceAccuracyGap < -0.2) {
      encouragement = 'high';
      focusOn.push('show_progress', 'celebrate_small_wins');
      reasons.push('Underconfident — boosting encouragement');
    }
  }

  // === Attention/energy ===
  if (state.isNearDropOff) {
    pace = 'fast';
    avoid.push('long_explanations');
    focusOn.push('micro_content', 'quick_wins');
    reasons.push('Near attention limit — keeping it short');
  }

  if (state.energyLevel === 'low') {
    avoid.push('complex_new_topics');
    focusOn.push('light_review', 'gamified_content');
    reasons.push('Low energy — lighter content');
  }

  // === Cognitive load ===
  if (state.cognitiveLoad === 'heavy') {
    avoid.push('new_concepts');
    focusOn.push('consolidation', 'spaced_repetition');
    reasons.push('Heavy cognitive load — consolidate, don\'t add');
  }

  // === Persistence ===
  if (state.persistenceScore < 0.3) {
    difficulty = Math.max(difficulty - 1, 1);
    encouragement = 'high';
    reasons.push('Low persistence — easier tasks with more encouragement');
  }

  return {
    difficulty,
    teachingMethod: method,
    pace,
    encouragementLevel: encouragement,
    shouldSimplify: difficulty < 4 || state.currentMood === 'confused',
    shouldChallenge: difficulty > 7 || state.currentMood === 'bored',
    shouldTakeBreak: state.isNearDropOff && state.minutesActiveToday > state.attentionSpanMinutes,
    focusOn,
    avoid,
    reason: reasons.join('. ') || 'Standard approach — no strong signals yet.',
  };
}
