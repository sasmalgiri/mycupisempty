/**
 * Learner Intelligence Engine
 *
 * Replaces the simplistic VARK "learning style quiz" with a 5-layer adaptive model
 * that continuously learns HOW each student actually learns — per subject, per context.
 *
 * Philosophy: Don't ask students how they learn. OBSERVE how they learn.
 * The student should never feel "judged" or "tested" — every signal is captured
 * naturally through engagement.
 *
 * 5 Layers:
 * 1. Baseline Profile — age, class, board, language comfort, attention span
 * 2. Preference Signals — what they choose when given options (visual/audio/text/interactive)
 * 3. Performance Signals — speed, accuracy, retries, error patterns, drop-off points
 * 4. Subject-Specific Signals — different approaches work for different subjects
 * 5. Adaptation Loop — system changes method based on what actually worked
 */

// ============================================================
// SIGNAL TYPES — every interaction generates signals
// ============================================================

export type SignalSource =
  | 'daily_mix'
  | 'ai_chat'
  | 'ai_guru'
  | 'flashcard'
  | 'challenge'
  | 'reflection'
  | 'habit'
  | 'subject_lesson'
  | 'assessment_activity';

export type SignalCategory =
  | 'engagement'      // time spent, scroll depth, interaction count
  | 'performance'     // accuracy, speed, retries, error types
  | 'preference'      // what they click, choose, skip
  | 'emotional'       // mood check-ins, emoji reactions, frustration signals
  | 'behavioral';     // session length, time of day, break patterns

export interface LearnerSignal {
  user_id: string;
  signal_type: string;
  category: SignalCategory;
  source: SignalSource;
  subject_id?: string;
  value: number;           // normalized 0-1 or raw count
  metadata?: Record<string, unknown>;
  timestamp: string;
}

// ============================================================
// LEARNER PROFILE — the multi-dimensional model
// ============================================================

export interface SubjectProfile {
  subject_id: string;
  // What works for THIS student in THIS subject
  preferred_explanation: 'visual' | 'story' | 'step_by_step' | 'example_first' | 'socratic' | 'drill';
  preferred_pace: 'fast' | 'moderate' | 'slow' | 'self_paced';
  preferred_difficulty_curve: 'gradual' | 'challenging' | 'mixed';
  // Performance patterns
  avg_accuracy: number;
  avg_time_per_question: number;  // seconds
  error_patterns: string[];       // e.g., "careless_arithmetic", "concept_gap_fractions"
  strength_topics: string[];
  weak_topics: string[];
  // Engagement patterns
  avg_session_duration: number;   // minutes
  drop_off_after: number;         // minutes before attention drops
  best_time_of_day: 'morning' | 'afternoon' | 'evening' | 'night';
  // Confidence
  confidence_score: number;       // 0-1, derived from behavior not self-report
  asks_for_help_rate: number;     // how often they use hints/AI help
  retries_after_failure: number;  // persistence score
}

export interface LearnerProfile {
  user_id: string;
  // Layer 1: Baseline
  class_level: number;
  board: string;
  language_comfort: 'en' | 'bn' | 'hi' | 'bilingual';
  estimated_attention_span: number;  // minutes, derived from behavior
  // Layer 2: Overall preferences (across subjects)
  overall_explanation_pref: string;
  prefers_encouragement: boolean;    // responds well to praise vs neutral feedback
  prefers_competition: boolean;      // motivated by leaderboards/challenges
  prefers_collaboration: boolean;    // likes group features
  // Layer 3: Emotional baseline
  typical_mood: 'energetic' | 'calm' | 'anxious' | 'neutral';
  frustration_threshold: 'low' | 'medium' | 'high';  // how many failures before disengaging
  // Layer 4: Subject-specific profiles
  subjects: Record<string, SubjectProfile>;
  // Layer 5: Adaptation history
  adaptations_applied: AdaptationRecord[];
  // Meta
  total_signals_collected: number;
  profile_confidence: number;  // 0-1, how reliable is this profile
  last_updated: string;
}

export interface AdaptationRecord {
  date: string;
  subject_id?: string;
  what_changed: string;        // e.g., "switched from visual to step_by_step for algebra"
  reason: string;              // e.g., "accuracy dropped 20% over 5 sessions with visual"
  outcome?: 'improved' | 'no_change' | 'declined';
}

// ============================================================
// PASSIVE SIGNAL COLLECTORS
// ============================================================

/**
 * Collect a learning signal from any interaction.
 * Called silently from UI components — student never sees this.
 */
export function collectSignal(signal: Omit<LearnerSignal, 'timestamp'>): void {
  const fullSignal: LearnerSignal = {
    ...signal,
    timestamp: new Date().toISOString(),
  };

  // Queue signals in memory, batch-send to API
  if (typeof window !== 'undefined') {
    const queue = getSignalQueue();
    queue.push(fullSignal);
    localStorage.setItem('_learner_signals', JSON.stringify(queue));

    // Flush if queue is large enough
    if (queue.length >= 10) {
      flushSignals();
    }
  }
}

function getSignalQueue(): LearnerSignal[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem('_learner_signals') || '[]');
  } catch {
    return [];
  }
}

export async function flushSignals(): Promise<void> {
  if (typeof window === 'undefined') return;
  const queue = getSignalQueue();
  if (queue.length === 0) return;

  localStorage.setItem('_learner_signals', '[]');

  try {
    await fetch('/api/learner-signals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signals: queue }),
    });
  } catch {
    // Put signals back if send failed
    const current = getSignalQueue();
    localStorage.setItem('_learner_signals', JSON.stringify([...current, ...queue]));
  }
}

// ============================================================
// SPECIFIC SIGNAL HELPERS — called from UI components
// ============================================================

/**
 * Track how long a student spends on something
 */
export function trackTimeSpent(
  userId: string,
  source: SignalSource,
  durationSeconds: number,
  subjectId?: string
): void {
  collectSignal({
    user_id: userId,
    signal_type: 'time_spent',
    category: 'engagement',
    source,
    subject_id: subjectId,
    value: durationSeconds,
  });
}

/**
 * Track when a student gets an answer right/wrong
 */
export function trackAnswer(
  userId: string,
  source: SignalSource,
  correct: boolean,
  timeToAnswer: number,
  subjectId?: string,
  metadata?: Record<string, unknown>
): void {
  collectSignal({
    user_id: userId,
    signal_type: 'answer_result',
    category: 'performance',
    source,
    subject_id: subjectId,
    value: correct ? 1 : 0,
    metadata: { time_to_answer: timeToAnswer, ...metadata },
  });
}

/**
 * Track what the student chooses when given options
 * (e.g., picked "watch video" over "read explanation")
 */
export function trackPreferenceChoice(
  userId: string,
  source: SignalSource,
  chosenOption: string,
  availableOptions: string[],
  subjectId?: string
): void {
  collectSignal({
    user_id: userId,
    signal_type: 'preference_choice',
    category: 'preference',
    source,
    subject_id: subjectId,
    value: availableOptions.indexOf(chosenOption) / Math.max(availableOptions.length - 1, 1),
    metadata: { chosen: chosenOption, options: availableOptions },
  });
}

/**
 * Track mood/emotion — captured through quick micro-interactions, not surveys
 */
export function trackMood(
  userId: string,
  source: SignalSource,
  mood: 'great' | 'okay' | 'frustrated' | 'confused' | 'bored' | 'excited'
): void {
  const moodScores: Record<string, number> = {
    great: 1, excited: 0.9, okay: 0.6, confused: 0.3, bored: 0.2, frustrated: 0.1,
  };
  collectSignal({
    user_id: userId,
    signal_type: 'mood',
    category: 'emotional',
    source,
    value: moodScores[mood] || 0.5,
    metadata: { mood },
  });
}

/**
 * Track frustration signals (implicit, not asked)
 * e.g., rapid re-clicks, back-button presses, long pauses
 */
export function trackFrustrationSignal(
  userId: string,
  source: SignalSource,
  signal: 'rapid_retry' | 'long_pause' | 'skipped' | 'used_hint' | 'back_button',
  subjectId?: string
): void {
  collectSignal({
    user_id: userId,
    signal_type: 'frustration_signal',
    category: 'emotional',
    source,
    subject_id: subjectId,
    value: 1,
    metadata: { signal_detail: signal },
  });
}

/**
 * Track error pattern for subject-specific analysis
 */
export function trackErrorPattern(
  userId: string,
  source: SignalSource,
  errorType: string,
  subjectId: string,
  topicId?: string
): void {
  collectSignal({
    user_id: userId,
    signal_type: 'error_pattern',
    category: 'performance',
    source,
    subject_id: subjectId,
    value: 1,
    metadata: { error_type: errorType, topic_id: topicId },
  });
}

// ============================================================
// ADAPTATION DECISION ENGINE
// ============================================================

/**
 * Given a learner profile and context, recommend the best teaching approach
 */
export function recommendApproach(
  profile: LearnerProfile,
  subjectId: string,
  topicId?: string
): TeachingRecommendation {
  const subjectProfile = profile.subjects[subjectId];

  // Default for new students or unknown subjects
  if (!subjectProfile || profile.profile_confidence < 0.3) {
    return {
      explanation_style: 'mixed',
      pace: 'moderate',
      encouragement_level: 'high',
      difficulty: 'adaptive',
      method: 'guided_discovery',
      reason: 'Not enough data yet — using balanced approach while we learn about you.',
    };
  }

  const rec: TeachingRecommendation = {
    explanation_style: subjectProfile.preferred_explanation || 'step_by_step',
    pace: subjectProfile.preferred_pace || 'moderate',
    encouragement_level: profile.prefers_encouragement ? 'high' : 'moderate',
    difficulty: subjectProfile.preferred_difficulty_curve || 'adaptive',
    method: 'guided_discovery',
    reason: '',
  };

  // Confidence-based adjustments
  if (subjectProfile.confidence_score < 0.3) {
    rec.encouragement_level = 'high';
    rec.difficulty = 'gradual';
    rec.reason = 'Building confidence — starting easier and encouraging more.';
  }

  // Attention span adjustments
  if (profile.estimated_attention_span < 10) {
    rec.pace = 'fast';
    rec.method = 'micro_lessons';
    rec.reason = 'Short attention window — using bite-sized content.';
  }

  // Error pattern adjustments
  if (subjectProfile.error_patterns.includes('careless_arithmetic')) {
    rec.method = 'drill_with_checks';
    rec.reason = 'Careless errors detected — adding verification steps.';
  }

  // Frustration threshold
  if (profile.frustration_threshold === 'low') {
    rec.difficulty = 'gradual';
    rec.encouragement_level = 'high';
  }

  return rec;
}

export interface TeachingRecommendation {
  explanation_style: string;
  pace: string;
  encouragement_level: 'low' | 'moderate' | 'high';
  difficulty: string;
  method: string;
  reason: string;
}

// ============================================================
// ASSESSMENT ACTIVITIES — disguised as fun, captures real signals
// ============================================================

export interface AssessmentActivity {
  id: string;
  type: 'puzzle' | 'story_choice' | 'speed_round' | 'explore' | 'create' | 'mood_island';
  title: string;
  description: string;
  icon: string;
  signals_captured: string[];  // what this activity tells us about the student
  duration_seconds: number;
}

/**
 * The "assessment" is a series of fun activities — NOT a quiz about learning preferences.
 * Each activity silently captures behavioral signals.
 */
export const ASSESSMENT_ACTIVITIES: AssessmentActivity[] = [
  {
    id: 'welcome_island',
    type: 'mood_island',
    title: 'How are you feeling?',
    description: 'Pick the island that matches your mood right now',
    icon: '🏝️',
    signals_captured: ['current_mood', 'self_awareness'],
    duration_seconds: 15,
  },
  {
    id: 'pattern_puzzle',
    type: 'puzzle',
    title: 'Spot the Pattern',
    description: 'Can you find what comes next?',
    icon: '🧩',
    signals_captured: ['logical_reasoning', 'visual_processing', 'response_speed', 'persistence'],
    duration_seconds: 60,
  },
  {
    id: 'story_path',
    type: 'story_choice',
    title: 'Choose Your Adventure',
    description: 'A story unfolds — your choices shape what happens',
    icon: '📚',
    signals_captured: ['narrative_preference', 'risk_tolerance', 'empathy', 'decision_speed'],
    duration_seconds: 90,
  },
  {
    id: 'speed_challenge',
    type: 'speed_round',
    title: 'Quick Fire!',
    description: 'Answer as fast as you can — no pressure!',
    icon: '⚡',
    signals_captured: ['processing_speed', 'accuracy_under_pressure', 'subject_strengths', 'confidence'],
    duration_seconds: 60,
  },
  {
    id: 'explore_room',
    type: 'explore',
    title: 'Explore This!',
    description: 'Look around this topic — tap anything interesting',
    icon: '🔍',
    signals_captured: ['curiosity_level', 'attention_span', 'visual_vs_text_preference', 'exploration_depth'],
    duration_seconds: 90,
  },
  {
    id: 'create_corner',
    type: 'create',
    title: 'Make Something',
    description: 'Express an idea your way — draw, write, or arrange',
    icon: '✨',
    signals_captured: ['creativity', 'expression_preference', 'kinesthetic_tendency', 'detail_orientation'],
    duration_seconds: 120,
  },
];

// ============================================================
// MICRO-INTERACTIONS — tiny check-ins woven into normal flow
// ============================================================

export interface MicroCheckIn {
  id: string;
  type: 'mood_emoji' | 'difficulty_feel' | 'energy_level' | 'understanding_check';
  prompt: string;
  prompt_bn: string;
  options: { value: string; label: string; label_bn: string; icon: string }[];
}

/**
 * Quick check-ins that appear naturally during learning sessions.
 * NOT surveys — just quick taps that feel like part of the experience.
 */
export const MICRO_CHECKINS: MicroCheckIn[] = [
  {
    id: 'mood_quick',
    type: 'mood_emoji',
    prompt: 'How\'s it going?',
    prompt_bn: 'কেমন চলছে?',
    options: [
      { value: 'great', label: 'Great!', label_bn: 'দারুণ!', icon: '😊' },
      { value: 'okay', label: 'Okay', label_bn: 'ঠিকঠাক', icon: '🙂' },
      { value: 'struggling', label: 'Tough', label_bn: 'কঠিন', icon: '😤' },
      { value: 'confused', label: 'Lost', label_bn: 'বুঝিনি', icon: '😵‍💫' },
    ],
  },
  {
    id: 'difficulty_feel',
    type: 'difficulty_feel',
    prompt: 'This was...',
    prompt_bn: 'এটা ছিল...',
    options: [
      { value: 'too_easy', label: 'Too easy', label_bn: 'খুব সহজ', icon: '🥱' },
      { value: 'just_right', label: 'Just right', label_bn: 'ঠিকঠাক', icon: '👍' },
      { value: 'bit_hard', label: 'A bit hard', label_bn: 'একটু কঠিন', icon: '💪' },
      { value: 'too_hard', label: 'Way too hard', label_bn: 'অনেক কঠিন', icon: '🆘' },
    ],
  },
  {
    id: 'energy_level',
    type: 'energy_level',
    prompt: 'Energy check!',
    prompt_bn: 'শক্তি কেমন?',
    options: [
      { value: 'high', label: 'Fired up!', label_bn: 'তৈরি!', icon: '🔥' },
      { value: 'medium', label: 'Normal', label_bn: 'স্বাভাবিক', icon: '⚡' },
      { value: 'low', label: 'Tired', label_bn: 'ক্লান্ত', icon: '😴' },
    ],
  },
  {
    id: 'understanding',
    type: 'understanding_check',
    prompt: 'Did that click?',
    prompt_bn: 'বুঝেছো?',
    options: [
      { value: 'crystal', label: 'Crystal clear!', label_bn: 'পরিষ্কার!', icon: '💎' },
      { value: 'mostly', label: 'Mostly', label_bn: 'মোটামুটি', icon: '🤔' },
      { value: 'not_really', label: 'Not really', label_bn: 'তেমন না', icon: '😕' },
      { value: 'explain_again', label: 'Explain again', label_bn: 'আবার বোঝাও', icon: '🔄' },
    ],
  },
];

/**
 * Get a random micro check-in appropriate for the context
 */
export function getMicroCheckIn(context: 'after_lesson' | 'mid_session' | 'after_challenge' | 'start'): MicroCheckIn {
  const contextMap: Record<string, string[]> = {
    after_lesson: ['understanding', 'difficulty_feel'],
    mid_session: ['mood_quick', 'energy_level'],
    after_challenge: ['difficulty_feel', 'mood_quick'],
    start: ['mood_quick', 'energy_level'],
  };

  const validIds = contextMap[context] || ['mood_quick'];
  const filtered = MICRO_CHECKINS.filter(c => validIds.includes(c.id));
  return filtered[Math.floor(Math.random() * filtered.length)];
}
