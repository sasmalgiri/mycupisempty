// ============================================================================
// Development Engine — Layer B (Human Development) + Layer C (Life Path)
// Scoring formulas, archetype detection, habit scoring, reflection prompts
// ============================================================================

import type {
  StudentDevelopmentProfile, DimensionCode, DevelopmentPillar,
  CognitiveDimension, CharacterDimension, LifeReadinessDimension,
  ScenarioOption, ReflectionPrompt, ReflectionType, PillarSummary,
} from '@/types/student-development';
import { ARCHETYPE_PATTERNS } from '@/types/student-development';

// ============================================================================
// 1. DIMENSION SCORE MANAGEMENT
// ============================================================================

const COGNITIVE_DIMS: CognitiveDimension[] = [
  'focus', 'memory_habits', 'reasoning', 'problem_solving',
  'reflection', 'decision_making', 'self_learning', 'curiosity',
];

const CHARACTER_DIMS: CharacterDimension[] = [
  'discipline', 'patience', 'honesty', 'empathy', 'responsibility',
  'consistency', 'failure_handling', 'confidence', 'emotional_regulation', 'social_conduct',
];

const LIFE_DIMS: LifeReadinessDimension[] = [
  'communication', 'financial_awareness', 'digital_safety', 'time_management',
  'real_world_problem_solving', 'career_awareness', 'teamwork', 'practical_skills',
];

/** Get the DB column name for a dimension score */
export function dimensionToColumn(dim: DimensionCode): string {
  return `${dim}_score`;
}

/** Get the pillar for a dimension */
export function dimensionPillar(dim: DimensionCode): DevelopmentPillar {
  if ((COGNITIVE_DIMS as string[]).includes(dim)) return 'cognitive';
  if ((CHARACTER_DIMS as string[]).includes(dim)) return 'character';
  return 'life_readiness';
}

/** Extract a dimension score from the profile */
export function getDimensionScore(profile: StudentDevelopmentProfile, dim: DimensionCode): number {
  const key = `${dim}_score` as keyof StudentDevelopmentProfile;
  return (profile[key] as number) ?? 50;
}

/** Get all dimensions for a pillar */
export function getDimensionsForPillar(pillar: DevelopmentPillar): DimensionCode[] {
  switch (pillar) {
    case 'cognitive': return COGNITIVE_DIMS;
    case 'character': return CHARACTER_DIMS;
    case 'life_readiness': return LIFE_DIMS;
    default: return [];
  }
}

// ============================================================================
// 2. COMPOSITE SCORING
// ============================================================================

/** Compute pillar composite score */
export function computePillarComposite(profile: StudentDevelopmentProfile, pillar: DevelopmentPillar): number {
  const dims = getDimensionsForPillar(pillar);
  if (dims.length === 0) return 0;
  const sum = dims.reduce((total, dim) => total + getDimensionScore(profile, dim), 0);
  return Math.round((sum / dims.length) * 100) / 100;
}

/** Compute the overall development score (all 3 non-academic pillars) */
export function computeOverallDevelopment(profile: StudentDevelopmentProfile): number {
  const cog = profile.cognitive_composite;
  const char = profile.character_composite;
  const life = profile.life_readiness_composite;
  return Math.round(((cog + char + life) / 3) * 100) / 100;
}

/** Get pillar summary */
export function computePillarSummary(
  profile: StudentDevelopmentProfile,
  pillar: DevelopmentPillar,
  activeGoals: number = 0,
  recentEvents: number = 0,
): PillarSummary {
  const dims = getDimensionsForPillar(pillar);
  const scores = dims.map(dim => ({ code: dim, score: getDimensionScore(profile, dim) }));

  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const composite = pillar === 'cognitive' ? profile.cognitive_composite :
                    pillar === 'character' ? profile.character_composite :
                    profile.life_readiness_composite;

  return {
    pillar,
    composite_score: composite,
    trend: 'stable', // Computed from historical data in real usage
    top_dimension: sorted[0] || { code: dims[0], score: 50 },
    weakest_dimension: sorted[sorted.length - 1] || { code: dims[0], score: 50 },
    active_goals_count: activeGoals,
    recent_events_count: recentEvents,
  };
}

// ============================================================================
// 3. ARCHETYPE DETECTION
// ============================================================================

interface ArchetypeMatch {
  code: string;
  label: string;
  description: string;
  match_strength: number; // 0-100
  growth_focus: DimensionCode[];
}

/** Detect archetype patterns from the student's profile */
export function detectArchetypes(profile: StudentDevelopmentProfile): ArchetypeMatch[] {
  const matches: ArchetypeMatch[] = [];

  const get = (dim: DimensionCode) => getDimensionScore(profile, dim);

  // High curiosity, low discipline
  if (get('curiosity') >= 70 && get('discipline') <= 40) {
    matches.push({
      code: 'high_curiosity_low_discipline',
      ...ARCHETYPE_PATTERNS.high_curiosity_low_discipline,
      match_strength: Math.min(get('curiosity'), 100 - get('discipline')),
    });
  }

  // Strong memory, weak confidence
  if (get('memory_habits') >= 65 && get('confidence') <= 40) {
    matches.push({
      code: 'strong_memory_weak_confidence',
      ...ARCHETYPE_PATTERNS.strong_memory_weak_confidence,
      match_strength: Math.min(get('memory_habits'), 100 - get('confidence')),
    });
  }

  // Good understanding, poor consistency
  if (get('reasoning') >= 65 && get('consistency') <= 40) {
    matches.push({
      code: 'good_understanding_poor_consistency',
      ...ARCHETYPE_PATTERNS.good_understanding_poor_consistency,
      match_strength: Math.min(get('reasoning'), 100 - get('consistency')),
    });
  }

  // Emotionally unstable during tests
  if (get('emotional_regulation') <= 35 && get('memory_habits') >= 55) {
    matches.push({
      code: 'emotionally_unstable_during_tests',
      ...ARCHETYPE_PATTERNS.emotionally_unstable_during_tests,
      match_strength: 100 - get('emotional_regulation'),
    });
  }

  // Good practical, weak textbook
  if (get('real_world_problem_solving') >= 65 && get('self_learning') <= 40) {
    matches.push({
      code: 'good_practical_weak_textbook',
      ...ARCHETYPE_PATTERNS.good_practical_weak_textbook,
      match_strength: Math.min(get('real_world_problem_solving'), 100 - get('self_learning')),
    });
  }

  // Creative learner, weak structure
  if (get('curiosity') >= 65 && get('problem_solving') >= 60 && get('discipline') <= 40 && get('time_management') <= 40) {
    matches.push({
      code: 'creative_learner_weak_structure',
      ...ARCHETYPE_PATTERNS.creative_learner_weak_structure,
      match_strength: Math.min(get('curiosity'), 100 - get('discipline')),
    });
  }

  // Socially strong, academically weak
  if (get('social_conduct') >= 70 && get('teamwork') >= 65 && get('focus') <= 40) {
    matches.push({
      code: 'socially_strong_academically_weak',
      ...ARCHETYPE_PATTERNS.socially_strong_academically_weak,
      match_strength: Math.min(get('social_conduct'), 100 - get('focus')),
    });
  }

  // High achiever, low empathy
  if (get('reasoning') >= 75 && get('self_learning') >= 70 && get('empathy') <= 35) {
    matches.push({
      code: 'high_achiever_low_empathy',
      ...ARCHETYPE_PATTERNS.high_achiever_low_empathy,
      match_strength: 100 - get('empathy'),
    });
  }

  // Resilient slow learner
  if (get('failure_handling') >= 70 && get('patience') >= 65 && get('reasoning') <= 40) {
    matches.push({
      code: 'resilient_slow_learner',
      ...ARCHETYPE_PATTERNS.resilient_slow_learner,
      match_strength: get('failure_handling'),
    });
  }

  // Balanced — all composites above 55
  if (profile.cognitive_composite >= 55 && profile.character_composite >= 55 && profile.life_readiness_composite >= 55) {
    matches.push({
      code: 'all_round_steady',
      ...ARCHETYPE_PATTERNS.all_round_steady,
      match_strength: Math.min(profile.cognitive_composite, profile.character_composite, profile.life_readiness_composite),
    });
  }

  return matches.sort((a, b) => b.match_strength - a.match_strength);
}

// ============================================================================
// 4. HABIT STREAK & SCORING
// ============================================================================

/** Compute streak from completion dates */
export function computeStreak(completionDates: string[]): { current: number; longest: number } {
  if (completionDates.length === 0) return { current: 0, longest: 0 };

  const sorted = [...completionDates].sort().reverse(); // newest first
  const today = new Date().toISOString().split('T')[0];

  let current = 0;
  let longest = 0;
  let streak = 0;
  let expectedDate = today;

  for (const date of sorted) {
    if (date === expectedDate) {
      streak++;
      // Move expected to previous day
      const d = new Date(expectedDate);
      d.setDate(d.getDate() - 1);
      expectedDate = d.toISOString().split('T')[0];
    } else if (date < expectedDate) {
      // Gap — streak broken
      if (current === 0) current = streak;
      longest = Math.max(longest, streak);
      streak = 1;
      const d = new Date(date);
      d.setDate(d.getDate() - 1);
      expectedDate = d.toISOString().split('T')[0];
    }
    // duplicate date — skip
  }

  if (current === 0) current = streak;
  longest = Math.max(longest, streak);

  return { current, longest };
}

/** Score impact of habit completion on dimension */
export function habitScoreImpact(
  currentScore: number,
  qualityRating: number, // 1-5
  streakDays: number,
): number {
  // Base impact: 0.5 per completion, scaled by quality
  const qualityMultiplier = qualityRating / 3; // 1→0.33, 3→1, 5→1.67
  const streakBonus = Math.min(streakDays / 30, 1) * 0.3; // up to 0.3 bonus at 30-day streak
  const impact = 0.5 * qualityMultiplier + streakBonus;

  // Diminishing returns as score approaches 100
  const ceiling = Math.max(0, (100 - currentScore) / 100);
  return Math.round(impact * ceiling * 100) / 100;
}

// ============================================================================
// 5. SCENARIO SCORING
// ============================================================================

/** Process scenario response and compute dimension score changes */
export function scoreScenarioResponse(
  option: ScenarioOption,
  responseTimeSeconds: number,
): { scores: Partial<Record<DimensionCode, number>>; isGrowthChoice: boolean } {
  const scores: Partial<Record<DimensionCode, number>> = {};

  for (const [dim, baseScore] of Object.entries(option.dimension_scores)) {
    // Thoughtful responses (not too fast, not too slow) get a small bonus
    let timeMultiplier = 1;
    if (responseTimeSeconds >= 5 && responseTimeSeconds <= 60) {
      timeMultiplier = 1.1; // 10% bonus for thoughtful response
    } else if (responseTimeSeconds < 3) {
      timeMultiplier = 0.8; // 20% penalty for rushing
    }

    scores[dim as DimensionCode] = Math.round((baseScore as number) * timeMultiplier * 100) / 100;
  }

  return { scores, isGrowthChoice: option.is_growth_choice };
}

// ============================================================================
// 6. REFLECTION PROMPT GENERATION — Age-aware
// ============================================================================

const REFLECTION_PROMPTS: ReflectionPrompt[] = [
  // Daily review — younger students
  { type: 'daily_review', prompt: 'What was the best thing you learned today?', dimension_tags: ['curiosity', 'reflection'], age_range: { min: 5, max: 10 } },
  { type: 'daily_review', prompt: 'Was anything hard today? What did you do about it?', dimension_tags: ['failure_handling', 'patience'], age_range: { min: 5, max: 10 } },
  { type: 'daily_review', prompt: 'Did you help anyone today? How did it feel?', dimension_tags: ['empathy', 'social_conduct'], age_range: { min: 5, max: 12 } },

  // Daily review — older students
  { type: 'daily_review', prompt: 'What concept challenged me today and how did I approach it?', dimension_tags: ['problem_solving', 'reflection'], age_range: { min: 11, max: 18 } },
  { type: 'daily_review', prompt: 'Did I follow through on what I planned today? If not, what got in the way?', dimension_tags: ['discipline', 'time_management'], age_range: { min: 11, max: 25 } },
  { type: 'daily_review', prompt: 'What would I do differently if I could redo today?', dimension_tags: ['reflection', 'decision_making'], age_range: { min: 11, max: 25 } },

  // Failure reflection
  { type: 'failure_reflection', prompt: 'Something didn\'t go well. What happened and what did you learn?', dimension_tags: ['failure_handling', 'reflection'], age_range: { min: 8, max: 15 } },
  { type: 'failure_reflection', prompt: 'Describe a recent setback. What was your emotional response? What would a calm, wise version of you have done?', dimension_tags: ['failure_handling', 'emotional_regulation', 'reflection'], age_range: { min: 14, max: 25 } },

  // Gratitude
  { type: 'gratitude', prompt: 'Name 3 things you are thankful for today.', dimension_tags: ['empathy', 'emotional_regulation'], age_range: { min: 5, max: 12 } },
  { type: 'gratitude', prompt: 'Who helped you recently? What would you like to tell them?', dimension_tags: ['empathy', 'social_conduct'], age_range: { min: 10, max: 25 } },

  // Emotion check
  { type: 'emotion_check', prompt: 'How are you feeling right now? Happy, sad, worried, excited, calm, or something else?', dimension_tags: ['emotional_regulation'], age_range: { min: 5, max: 12 } },
  { type: 'emotion_check', prompt: 'Rate your stress (1-10). What\'s causing it? What\'s one thing you can control about it?', dimension_tags: ['emotional_regulation', 'decision_making'], age_range: { min: 12, max: 25 } },

  // Goal review
  { type: 'goal_review', prompt: 'Look at your goals. Are you closer to any of them than last week?', dimension_tags: ['responsibility', 'consistency'], age_range: { min: 10, max: 25 } },
  { type: 'goal_review', prompt: 'Do your current goals still matter to you? If not, what would you change?', dimension_tags: ['decision_making', 'self_learning'], age_range: { min: 13, max: 25 } },

  // Weekly review
  { type: 'weekly_review', prompt: 'What habit was hardest to keep this week? Why?', dimension_tags: ['discipline', 'consistency', 'reflection'], age_range: { min: 10, max: 25 } },
  { type: 'weekly_review', prompt: 'Name one moment this week where you chose the harder right thing over the easier wrong thing.', dimension_tags: ['honesty', 'responsibility'], age_range: { min: 12, max: 25 } },

  // Success reflection
  { type: 'success_reflection', prompt: 'What went well this week? What did YOU do to make it happen?', dimension_tags: ['confidence', 'reflection'], age_range: { min: 8, max: 25 } },
];

/** Get age-appropriate reflection prompts */
export function getReflectionPrompts(age: number, type?: ReflectionType, count: number = 3): ReflectionPrompt[] {
  let filtered = REFLECTION_PROMPTS.filter(p =>
    age >= p.age_range.min && age <= p.age_range.max
  );

  if (type) {
    filtered = filtered.filter(p => p.type === type);
  }

  // Shuffle and return
  const shuffled = filtered.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ============================================================================
// 7. STRENGTH DISCOVERY — Domain affinity scoring
// ============================================================================

export const INTEREST_DOMAINS = [
  { code: 'science_tech', label: 'Science & Technology', icon: '🔬', careers: ['engineer', 'scientist', 'developer', 'doctor', 'researcher'] },
  { code: 'arts_creative', label: 'Arts & Creativity', icon: '🎨', careers: ['artist', 'designer', 'musician', 'writer', 'filmmaker'] },
  { code: 'people_social', label: 'People & Social', icon: '🤝', careers: ['teacher', 'counselor', 'social_worker', 'nurse', 'HR'] },
  { code: 'business_organize', label: 'Business & Organizing', icon: '📊', careers: ['manager', 'entrepreneur', 'accountant', 'planner', 'admin'] },
  { code: 'building_making', label: 'Building & Making', icon: '🔧', careers: ['mechanic', 'architect', 'carpenter', 'electrician', 'chef'] },
  { code: 'nature_outdoor', label: 'Nature & Outdoors', icon: '🌿', careers: ['farmer', 'ecologist', 'vet', 'forest_officer', 'explorer'] },
  { code: 'leadership_governance', label: 'Leadership & Governance', icon: '⚖️', careers: ['leader', 'lawyer', 'civil_servant', 'politician', 'officer'] },
  { code: 'sports_fitness', label: 'Sports & Physical', icon: '🏃', careers: ['athlete', 'coach', 'physio', 'fitness_trainer', 'sports_manager'] },
];

/** Map dimension scores to career domain affinities */
export function computeDomainAffinities(profile: StudentDevelopmentProfile): { code: string; label: string; affinity: number }[] {
  const get = (dim: DimensionCode) => getDimensionScore(profile, dim);

  return [
    { code: 'science_tech', label: 'Science & Technology', affinity: Math.round((get('reasoning') * 0.3 + get('problem_solving') * 0.3 + get('curiosity') * 0.2 + get('focus') * 0.2)) },
    { code: 'arts_creative', label: 'Arts & Creativity', affinity: Math.round((get('curiosity') * 0.3 + get('emotional_regulation') * 0.2 + get('reflection') * 0.2 + get('confidence') * 0.15 + get('patience') * 0.15)) },
    { code: 'people_social', label: 'People & Social', affinity: Math.round((get('empathy') * 0.3 + get('communication') * 0.25 + get('social_conduct') * 0.25 + get('patience') * 0.2)) },
    { code: 'business_organize', label: 'Business & Organizing', affinity: Math.round((get('decision_making') * 0.25 + get('time_management') * 0.25 + get('financial_awareness') * 0.2 + get('responsibility') * 0.15 + get('communication') * 0.15)) },
    { code: 'building_making', label: 'Building & Making', affinity: Math.round((get('practical_skills') * 0.3 + get('problem_solving') * 0.25 + get('real_world_problem_solving') * 0.25 + get('patience') * 0.2)) },
    { code: 'nature_outdoor', label: 'Nature & Outdoors', affinity: Math.round((get('curiosity') * 0.3 + get('practical_skills') * 0.25 + get('patience') * 0.2 + get('real_world_problem_solving') * 0.25)) },
    { code: 'leadership_governance', label: 'Leadership & Governance', affinity: Math.round((get('decision_making') * 0.25 + get('communication') * 0.25 + get('responsibility') * 0.2 + get('confidence') * 0.15 + get('social_conduct') * 0.15)) },
    { code: 'sports_fitness', label: 'Sports & Physical', affinity: Math.round((get('discipline') * 0.3 + get('consistency') * 0.25 + get('failure_handling') * 0.2 + get('confidence') * 0.15 + get('teamwork') * 0.1)) },
  ].sort((a, b) => b.affinity - a.affinity);
}

// ============================================================================
// 8. DIMENSION SCORE UPDATE — Weighted moving average
// ============================================================================

/**
 * Update a dimension score using weighted moving average.
 * More recent signals have more weight, but we don't swing wildly.
 */
export function updateDimensionScore(
  currentScore: number,
  newSignal: number,     // the new score signal (0-100)
  signalWeight: number = 0.15,  // how much weight the new signal gets (default 15%)
): number {
  const updated = currentScore * (1 - signalWeight) + newSignal * signalWeight;
  return Math.round(Math.max(0, Math.min(100, updated)) * 100) / 100;
}

// ============================================================================
// 9. CONCERN FLAG DETECTION
// ============================================================================

export interface ConcernFlag {
  type: 'academic' | 'emotional' | 'behavioral' | 'social';
  severity: 'watch' | 'concern' | 'urgent';
  dimension: DimensionCode;
  message: string;
}

/** Detect concerns from profile scores */
export function detectConcerns(profile: StudentDevelopmentProfile): ConcernFlag[] {
  const flags: ConcernFlag[] = [];
  const get = (dim: DimensionCode) => getDimensionScore(profile, dim);

  if (get('emotional_regulation') < 25) {
    flags.push({ type: 'emotional', severity: 'urgent', dimension: 'emotional_regulation', message: 'Very low emotional regulation — may need counselor support' });
  }
  if (get('confidence') < 20) {
    flags.push({ type: 'emotional', severity: 'concern', dimension: 'confidence', message: 'Very low confidence — at risk of disengagement' });
  }
  if (get('failure_handling') < 25 && get('confidence') < 35) {
    flags.push({ type: 'emotional', severity: 'urgent', dimension: 'failure_handling', message: 'Low resilience combined with low confidence — needs immediate support' });
  }
  if (get('social_conduct') < 25) {
    flags.push({ type: 'social', severity: 'concern', dimension: 'social_conduct', message: 'Social conduct score very low — may be struggling with peer relationships' });
  }
  if (get('discipline') < 20 && get('consistency') < 20) {
    flags.push({ type: 'behavioral', severity: 'concern', dimension: 'discipline', message: 'Both discipline and consistency very low — may need structured routine support' });
  }
  if (get('focus') < 20) {
    flags.push({ type: 'academic', severity: 'watch', dimension: 'focus', message: 'Very low focus score — may benefit from focus-building exercises' });
  }

  return flags;
}
