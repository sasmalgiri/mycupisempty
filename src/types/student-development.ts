// ============================================================================
// MyCupIsEmpty — Whole-Student Development OS Types
// 4 Pillars: Academic | Cognitive | Character & Emotional | Life Readiness
// 5 Domains: Learn | Think | Grow | Live | Path
// ============================================================================

// --- Enums ---

export type DevelopmentPillar = 'academic' | 'cognitive' | 'character' | 'life_readiness';

export type DevelopmentDomain = 'learn' | 'think' | 'grow' | 'live' | 'path';

export type CognitiveDimension =
  | 'focus' | 'memory_habits' | 'reasoning' | 'problem_solving'
  | 'reflection' | 'decision_making' | 'self_learning' | 'curiosity';

export type CharacterDimension =
  | 'discipline' | 'patience' | 'honesty' | 'empathy'
  | 'responsibility' | 'consistency' | 'failure_handling'
  | 'confidence' | 'emotional_regulation' | 'social_conduct';

export type LifeReadinessDimension =
  | 'communication' | 'financial_awareness' | 'digital_safety'
  | 'time_management' | 'real_world_problem_solving' | 'career_awareness'
  | 'teamwork' | 'practical_skills';

export type DimensionCode = CognitiveDimension | CharacterDimension | LifeReadinessDimension;

export type ReflectionType =
  | 'daily_review' | 'weekly_review' | 'failure_reflection' | 'success_reflection'
  | 'goal_review' | 'gratitude' | 'scenario_response' | 'emotion_check' | 'mentor_prompt';

export type GoalStatus = 'active' | 'completed' | 'paused' | 'abandoned';

export type FeedbackType = 'observation' | 'encouragement' | 'concern' | 'suggestion' | 'milestone';

export type StrengthLevel = 'emerging' | 'moderate' | 'strong' | 'passionate';

export type BadgeRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export type DevEventType =
  | 'assessment' | 'habit_completion' | 'reflection' | 'scenario'
  | 'behavioral' | 'goal_progress' | 'mentor_feedback' | 'peer_interaction' | 'self_report';

export type AssessmentMethod = 'self_report' | 'behavioral' | 'scenario' | 'observation' | 'reflection';

// --- Core Interfaces ---

export interface StudentDevelopmentProfile {
  id: string;
  user_id: string;

  // Cognitive dimensions (0-100 each)
  focus_score: number;
  memory_habits_score: number;
  reasoning_score: number;
  problem_solving_score: number;
  reflection_score: number;
  decision_making_score: number;
  self_learning_score: number;
  curiosity_score: number;

  // Character dimensions (0-100 each)
  discipline_score: number;
  patience_score: number;
  honesty_score: number;
  empathy_score: number;
  responsibility_score: number;
  consistency_score: number;
  failure_handling_score: number;
  confidence_score: number;
  emotional_regulation_score: number;
  social_conduct_score: number;

  // Life readiness dimensions (0-100 each)
  communication_score: number;
  financial_awareness_score: number;
  digital_safety_score: number;
  time_management_score: number;
  real_world_problem_solving_score: number;
  career_awareness_score: number;
  teamwork_score: number;
  practical_skills_score: number;

  // Computed composites (generated)
  cognitive_composite: number;
  character_composite: number;
  life_readiness_composite: number;

  // Patterns
  archetype_tags: string[];
  top_strengths: DimensionEvidence[];
  growth_areas: DimensionGrowth[];

  last_assessed_at: string | null;
  assessment_count: number;
  created_at: string;
  updated_at: string;
}

export interface DimensionEvidence {
  dimension: DimensionCode;
  score: number;
  evidence: string;
}

export interface DimensionGrowth {
  dimension: DimensionCode;
  score: number;
  suggestion: string;
}

export interface DevelopmentDimensionMaster {
  id: string;
  code: DimensionCode;
  name: string;
  name_hindi: string | null;
  pillar: DevelopmentPillar;
  domain: DevelopmentDomain;
  description: string | null;
  age_min: number;
  age_max: number;
  assessment_method: AssessmentMethod | null;
  growth_strategies: string[];
  display_order: number;
  icon: string | null;
  color: string | null;
  is_active: boolean;
}

// --- Habits ---

export interface HabitDefinition {
  id: string;
  code: string;
  name: string;
  name_hindi: string | null;
  description: string | null;
  pillar: DevelopmentPillar;
  dimension_code: DimensionCode | null;
  frequency: 'daily' | 'weekly' | 'custom';
  default_target: number;
  age_min: number;
  age_max: number;
  icon: string | null;
  is_system: boolean;
  is_active: boolean;
}

export interface HabitTracking {
  id: string;
  user_id: string;
  habit_id: string;
  date: string;
  completed: boolean;
  notes: string | null;
  quality_rating: number | null;
}

export interface StudentHabit {
  id: string;
  user_id: string;
  habit_id: string;
  is_active: boolean;
  target_count: number;
  current_streak: number;
  longest_streak: number;
  total_completions: number;
  started_at: string;
  // Joined
  habit?: HabitDefinition;
}

// --- Reflections ---

export interface ReflectionEntry {
  id: string;
  user_id: string;
  reflection_type: ReflectionType;
  prompt_text: string | null;
  response_text: string | null;
  dimension_tags: DimensionCode[];

  detected_emotions: string[];
  growth_signals: string[];
  concern_flags: string[];

  is_private: boolean;
  shared_with_teacher: boolean;
  shared_with_parent: boolean;
  teacher_feedback: string | null;
  parent_feedback: string | null;

  created_at: string;
}

// --- Scenario Assessments ---

export interface ScenarioOption {
  text: string;
  dimension_scores: Partial<Record<DimensionCode, number>>;
  feedback_text: string;
  is_growth_choice: boolean;
}

export interface ScenarioBankItem {
  id: string;
  code: string;
  pillar: DevelopmentPillar;
  dimension_code: DimensionCode | null;
  title: string;
  scenario_text: string;
  age_min: number;
  age_max: number;
  education_level_codes: string[] | null;
  options: ScenarioOption[];
  debrief_text: string | null;
  cultural_context: string;
  is_active: boolean;
}

export interface ScenarioResponse {
  id: string;
  user_id: string;
  scenario_id: string;
  selected_option_index: number;
  response_time_seconds: number | null;
  reflection_text: string | null;
  dimension_scores_earned: Partial<Record<DimensionCode, number>>;
  created_at: string;
}

// --- Goals ---

export interface StudentGoal {
  id: string;
  user_id: string;
  pillar: DevelopmentPillar;
  dimension_code: DimensionCode | null;
  domain: DevelopmentDomain | null;
  title: string;
  description: string | null;
  target_value: number | null;
  current_value: number;
  status: GoalStatus;
  priority: 'low' | 'medium' | 'high';
  due_date: string | null;
  completed_at: string | null;
  review_notes: string | null;
  set_by: 'student' | 'teacher' | 'parent' | 'system';
  mentor_id: string | null;
  created_at: string;
  updated_at: string;
}

// --- Strength & Interest Discovery ---

export interface StrengthAssessment {
  id: string;
  user_id: string;
  assessment_type: 'interest_inventory' | 'strength_finder' | 'work_style' | 'domain_affinity' | 'career_explorer';
  questions: any[];
  answers: any[];
  results: StrengthResults;
  created_at: string;
}

export interface StrengthResults {
  top_strengths: string[];
  interest_areas: string[];
  suggested_domains: string[];
  work_style: 'collaborative' | 'independent' | 'structured' | 'creative' | 'mixed';
  career_clusters: string[];
}

export interface StudentInterest {
  id: string;
  user_id: string;
  interest_area: string;
  strength_level: StrengthLevel;
  evidence: { source: string; detail: string; date: string }[];
  discovered_at: string;
}

// --- Development Events ---

export interface DevelopmentEvent {
  id: string;
  user_id: string;
  pillar: DevelopmentPillar;
  dimension_code: DimensionCode | null;
  domain: DevelopmentDomain | null;
  event_type: DevEventType;
  score_change: number | null;
  evidence: Record<string, any>;
  notes: string | null;
  created_at: string;
}

// --- Mentor Feedback ---

export interface MentorFeedback {
  id: string;
  student_id: string;
  mentor_id: string;
  mentor_role: 'teacher' | 'parent' | 'counselor';
  pillar: DevelopmentPillar | null;
  dimension_code: DimensionCode | null;
  feedback_type: FeedbackType;
  message: string;
  is_visible_to_student: boolean;
  student_acknowledged: boolean;
  created_at: string;
}

// --- Parent Link ---

export interface ParentStudentLink {
  id: string;
  parent_id: string;
  student_id: string;
  relationship: 'parent' | 'guardian' | 'caregiver';
  can_see_reflections: boolean;
  can_see_emotions: boolean;
  can_see_academic: boolean;
  can_see_character: boolean;
  can_see_life_readiness: boolean;
  can_set_goals: boolean;
  can_give_feedback: boolean;
  notify_on_concern: boolean;
  notify_on_milestone: boolean;
  notify_weekly_summary: boolean;
  is_active: boolean;
  linked_at: string;
}

// --- Badges ---

export interface DevelopmentBadge {
  id: string;
  code: string;
  name: string;
  name_hindi: string | null;
  description: string;
  pillar: DevelopmentPillar | 'overall';
  dimension_code: DimensionCode | null;
  icon: string;
  criteria: BadgeCriteria;
  rarity: BadgeRarity;
  is_active: boolean;
}

export type BadgeCriteria =
  | { type: 'streak'; count: number; habit_code?: string }
  | { type: 'count'; event: string; count: number }
  | { type: 'score'; dimension: DimensionCode; min: number }
  | { type: 'all_pillars'; min: number };

export interface StudentBadge {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
  evidence: Record<string, any>;
  // Joined
  badge?: DevelopmentBadge;
}

// ============================================================================
// Dashboard Composite Types
// ============================================================================

/** The full 4-pillar student profile for dashboard */
export interface HolisticStudentView {
  profile: StudentDevelopmentProfile;
  academic_mastery: number | null; // from pedagogy engine
  active_habits: StudentHabit[];
  active_goals: StudentGoal[];
  recent_reflections: ReflectionEntry[];
  recent_events: DevelopmentEvent[];
  badges: StudentBadge[];
  interests: StudentInterest[];
  unread_feedback: MentorFeedback[];
}

/** Pillar summary for quick view */
export interface PillarSummary {
  pillar: DevelopmentPillar;
  composite_score: number;
  trend: 'improving' | 'stable' | 'declining';
  top_dimension: { code: DimensionCode; score: number };
  weakest_dimension: { code: DimensionCode; score: number };
  active_goals_count: number;
  recent_events_count: number;
}

/** Parent's view of their child */
export interface ParentChildView {
  student_name: string;
  student_avatar: string | null;
  link: ParentStudentLink;
  pillar_summaries: PillarSummary[];
  recent_milestones: DevelopmentEvent[];
  concerns: MentorFeedback[];
  goals: StudentGoal[];
  habit_streaks: { habit_name: string; streak: number; icon: string }[];
}

/** Teacher's class-wide view */
export interface TeacherClassView {
  students: {
    student_id: string;
    student_name: string;
    cognitive_composite: number;
    character_composite: number;
    life_readiness_composite: number;
    academic_mastery: number | null;
    concern_flags: string[];
    top_strength: string;
    growth_area: string;
  }[];
  class_averages: {
    cognitive: number;
    character: number;
    life_readiness: number;
    academic: number;
  };
}

// ============================================================================
// Reflection Prompts — Age-aware prompt generation
// ============================================================================

export interface ReflectionPrompt {
  type: ReflectionType;
  prompt: string;
  dimension_tags: DimensionCode[];
  age_range: { min: number; max: number };
}

// ============================================================================
// Archetype Patterns — Not labels, observable patterns
// ============================================================================

export const ARCHETYPE_PATTERNS: Record<string, { label: string; description: string; growth_focus: DimensionCode[] }> = {
  high_curiosity_low_discipline: {
    label: 'Curious Explorer',
    description: 'Loves learning but struggles with routine and follow-through',
    growth_focus: ['discipline', 'consistency', 'time_management'],
  },
  strong_memory_weak_confidence: {
    label: 'Quiet Knower',
    description: 'Retains information well but hesitates to attempt challenging tasks',
    growth_focus: ['confidence', 'failure_handling', 'communication'],
  },
  good_understanding_poor_consistency: {
    label: 'Bright Sprinter',
    description: 'Grasps concepts quickly but effort is inconsistent',
    growth_focus: ['consistency', 'discipline', 'patience'],
  },
  emotionally_unstable_during_tests: {
    label: 'Sensitive Performer',
    description: 'Knows the material but anxiety disrupts performance',
    growth_focus: ['emotional_regulation', 'confidence', 'patience'],
  },
  good_practical_weak_textbook: {
    label: 'Hands-On Thinker',
    description: 'Excels at real-world application but struggles with abstract academics',
    growth_focus: ['self_learning', 'reasoning', 'memory_habits'],
  },
  creative_learner_weak_structure: {
    label: 'Creative Mind',
    description: 'Rich in ideas but needs help organizing and structuring output',
    growth_focus: ['discipline', 'time_management', 'consistency'],
  },
  socially_strong_academically_weak: {
    label: 'Social Leader',
    description: 'Natural collaborator and communicator, needs academic support',
    growth_focus: ['focus', 'self_learning', 'memory_habits'],
  },
  all_round_steady: {
    label: 'Steady Builder',
    description: 'Consistent across all areas, growing at a balanced pace',
    growth_focus: [],
  },
  high_achiever_low_empathy: {
    label: 'Focused Achiever',
    description: 'Strong academically but needs growth in social awareness',
    growth_focus: ['empathy', 'social_conduct', 'teamwork'],
  },
  resilient_slow_learner: {
    label: 'Determined Climber',
    description: 'Learns slowly but never gives up — persistence is their strength',
    growth_focus: ['memory_habits', 'reasoning', 'self_learning'],
  },
};
