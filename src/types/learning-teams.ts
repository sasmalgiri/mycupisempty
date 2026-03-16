// ============================================================================
// Learning Style Teams — Core Types
// ============================================================================

export type LearningStyleCode =
  | 'visual_spatial'
  | 'auditory_musical'
  | 'reading_writing'
  | 'kinesthetic_tactile'
  | 'logical_mathematical'
  | 'social_interpersonal'
  | 'solitary_intrapersonal'
  | 'naturalistic';

export type EducationLevelGroup =
  | 'primary'
  | 'upper_primary'
  | 'secondary'
  | 'higher_secondary'
  | 'undergraduate'
  | 'postgraduate'
  | 'doctoral'
  | 'professional';

export interface LearningStyleMaster {
  id: string;
  code: LearningStyleCode;
  name: string;
  name_hindi: string | null;
  description: string;
  icon: string | null;
  color: string | null;
  evaluation_criteria: string[];
  teaching_strategies: string[];
  is_active: boolean;
  display_order: number;
}

export interface EducationLevel {
  id: string;
  code: string;
  name: string;
  name_hindi: string | null;
  level_order: number;
  level_group: EducationLevelGroup;
  age_range: string | null;
  is_active: boolean;
}

// ============================================================================
// Evaluation System
// ============================================================================

export type EvalQuestionType =
  | 'scenario_choice'
  | 'task_performance'
  | 'preference_rank'
  | 'self_assessment'
  | 'observation_task'
  | 'comprehension_test';

export interface StyleEvaluation {
  id: string;
  subject_id: string | null;
  education_level_code: string | null;
  evaluation_name: string;
  description: string | null;
  estimated_minutes: number;
  is_active: boolean;
}

export interface StyleEvalQuestionOption {
  text: string;
  style_code: LearningStyleCode;
  weight: number;
  media_url?: string;
}

export interface StyleEvalQuestion {
  id: string;
  evaluation_id: string;
  question_number: number;
  question_type: EvalQuestionType;
  question_text: string;
  question_media_url: string | null;
  options: StyleEvalQuestionOption[];
  correct_answer: any | null;
  time_limit_seconds: number | null;
  order_index: number;
}

export interface StyleScores {
  visual_spatial: number;
  auditory_musical: number;
  reading_writing: number;
  kinesthetic_tactile: number;
  logical_mathematical: number;
  social_interpersonal: number;
  solitary_intrapersonal: number;
  naturalistic: number;
  [key: string]: number;
}

export interface StyleEvaluationAttempt {
  id: string;
  user_id: string;
  evaluation_id: string;
  subject_id: string | null;
  started_at: string;
  completed_at: string | null;
  answers: EvalAnswer[];
  style_scores: StyleScores | null;
  primary_style: LearningStyleCode | null;
  secondary_style: LearningStyleCode | null;
  confidence_score: number | null;
  status: 'in_progress' | 'completed' | 'expired';
}

export interface EvalAnswer {
  question_id: string;
  selected_option_index: number;
  time_taken_seconds: number;
  response_data?: any;
}

// ============================================================================
// Teams
// ============================================================================

export interface LearningStyleTeam {
  id: string;
  style_code: LearningStyleCode;
  subject_id: string | null;
  education_level_code: string | null;
  board_code: string | null;
  team_name: string;
  description: string | null;
  curriculum_config: Record<string, any>;
  is_active: boolean;
}

export interface TeamMembership {
  id: string;
  user_id: string;
  team_id: string;
  style_code: LearningStyleCode;
  subject_id: string | null;
  evaluation_id: string | null;
  assigned_at: string;
  style_strength: number;
  is_current: boolean;
  notes: string | null;
  // Joined fields
  team?: LearningStyleTeam;
  style?: LearningStyleMaster;
  subject_name?: string;
}

// ============================================================================
// Curriculum Mapping
// ============================================================================

export interface StyleCurriculumMapping {
  id: string;
  subject_id: string;
  chapter_id: string | null;
  topic_id: string | null;
  style_code: LearningStyleCode;
  education_level_code: string | null;
  primary_teaching_methods: string[];
  content_format: string[];
  ai_guru_method: string | null;
  ai_guru_prompt_prefix: string | null;
  resource_urls: { type: string; url: string; title: string }[];
  activity_types: string[];
  estimated_hours: number | null;
  mastery_criteria: Record<string, any>;
}

// ============================================================================
// Lifecycle Progress
// ============================================================================

export interface LifecycleProgress {
  id: string;
  user_id: string;
  education_level_code: string;
  subject_id: string | null;
  style_code: LearningStyleCode | null;
  chapters_completed: number;
  chapters_total: number;
  topics_mastered: number;
  topics_total: number;
  current_chapter_id: string | null;
  current_topic_id: string | null;
  avg_comprehension: number;
  avg_evaluation_score: number;
  total_study_hours: number;
  streak_days: number;
  status: 'not_started' | 'active' | 'completed' | 'on_hold';
  started_at: string | null;
  completed_at: string | null;
  // Joined
  level?: EducationLevel;
  subject_name?: string;
}

// ============================================================================
// Comprehension Evaluation
// ============================================================================

export type ComprehensionEvalType =
  | 'pre_assessment'
  | 'checkpoint'
  | 'post_assessment'
  | 'mastery_test'
  | 'style_discovery'
  | 'periodic_review';

export interface ComprehensionQuestion {
  id: string;
  text: string;
  type: 'mcq' | 'short' | 'explain' | 'apply' | 'create' | 'analyze';
  bloom_level: string;
  options?: string[];
  correct_answer: string | number;
  points: number;
  style_indicators?: Partial<StyleScores>;
}

export interface ComprehensionEvaluation {
  id: string;
  user_id: string;
  subject_id: string | null;
  chapter_id: string | null;
  topic_id: string | null;
  style_code: LearningStyleCode | null;
  education_level_code: string | null;
  eval_type: ComprehensionEvalType;
  questions: ComprehensionQuestion[];
  answers: any[];
  score_knowledge: number;
  score_comprehension: number;
  score_application: number;
  score_analysis: number;
  score_evaluation: number;
  score_creation: number;
  overall_score: number;
  style_signals: Partial<StyleScores>;
  time_taken_minutes: number | null;
  ai_feedback: string | null;
  status: 'in_progress' | 'completed' | 'abandoned';
}

// ============================================================================
// Style Transition
// ============================================================================

export interface StyleTransition {
  id: string;
  user_id: string;
  subject_id: string | null;
  from_style: LearningStyleCode | null;
  to_style: LearningStyleCode;
  reason: 'initial_assessment' | 'periodic_reassessment' | 'teacher_override' | 'self_request' | 'performance_based' | 'ai_recommendation';
  confidence_score: number | null;
  notes: string | null;
  transitioned_at: string;
}

// ============================================================================
// Dashboard Composite Types
// ============================================================================

export interface StudentStyleProfile {
  general_style: LearningStyleCode | null;
  subject_styles: {
    subject_id: string;
    subject_name: string;
    style_code: LearningStyleCode;
    style_name: string;
    strength: number;
    team_id: string;
  }[];
  style_scores: StyleScores | null;
  evaluation_history: StyleEvaluationAttempt[];
  lifecycle: LifecycleProgress[];
}

// Evaluation flow for frontend
export interface StyleDiscoverySession {
  evaluation: StyleEvaluation;
  questions: StyleEvalQuestion[];
  currentQuestionIndex: number;
  answers: EvalAnswer[];
  subjectId: string | null;
  startedAt: string;
}
