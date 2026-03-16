import type { VARKStyle, BloomLevel, DifficultyLevel, ChatSession } from './index';

// ============================================================================
// REQUIREMENT 1: Teacher Intelligence - Character Building
// ============================================================================

export type CharacterTraitCategory =
  | 'values'
  | 'habits'
  | 'social_skills'
  | 'emotional_intelligence'
  | 'responsibility'
  | 'empathy'
  | 'resilience'
  | 'teamwork'
  | 'integrity'
  | 'curiosity';

export interface CharacterTrait {
  id: string;
  student_id: string;
  teacher_id: string;
  trait_category: CharacterTraitCategory;
  score: number;
  observations: string | null;
  assessed_at: string;
  created_at: string;
  updated_at: string;
}

export interface CharacterGoal {
  id: string;
  student_id: string;
  teacher_id: string;
  classroom_id: string | null;
  trait_category: string;
  goal_description: string;
  target_score: number;
  current_score: number;
  status: 'active' | 'achieved' | 'paused';
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentTeachingMethod {
  id: string;
  student_id: string;
  teacher_id: string;
  subject_id: string | null;
  recommended_methods: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CharacterProfile {
  traits: CharacterTrait[];
  goals: CharacterGoal[];
  overall_score: number;
  strengths: CharacterTraitCategory[];
  areas_for_growth: CharacterTraitCategory[];
}

// ============================================================================
// REQUIREMENT 3: Learning Discovery
// ============================================================================

export type KolbType = 'diverger' | 'assimilator' | 'converger' | 'accommodator';

export interface KolbStyle {
  id: string;
  user_id: string;
  concrete_experience: number;
  reflective_observation: number;
  abstract_conceptualization: number;
  active_experimentation: number;
  kolb_type: KolbType | null;
  assessment_date: string;
}

export interface SubjectAptitude {
  id: string;
  user_id: string;
  subject_id: string;
  aptitude_score: number;
  interest_score: number;
  performance_score: number;
  recommended_difficulty: DifficultyLevel;
  assessed_at: string;
  updated_at: string;
}

export interface LearningDNA {
  id: string;
  user_id: string;
  vark_primary: VARKStyle | null;
  gardner_top_3: string[];
  kolb_type: KolbType | null;
  preferred_methods: string[];
  learning_speed: 'slow' | 'medium' | 'fast';
  best_time_of_day: 'morning' | 'afternoon' | 'evening' | 'night' | null;
  attention_span_minutes: number;
  profile_completeness: number;
  computed_at: string;
  updated_at: string;
}

export interface LearningDNAFull extends LearningDNA {
  vark_scores?: { visual: number; auditory: number; reading: number; kinesthetic: number };
  kolb_scores?: { ce: number; ro: number; ac: number; ae: number };
  gardner_scores?: Record<string, number>;
  subject_aptitudes?: SubjectAptitude[];
}

// Kolb Assessment
export interface KolbAssessmentQuestion {
  id: number;
  scenario: string;
  options: {
    concrete_experience: string;
    reflective_observation: string;
    abstract_conceptualization: string;
    active_experimentation: string;
  };
}

export interface KolbAssessmentResult {
  concrete_experience: number;
  reflective_observation: number;
  abstract_conceptualization: number;
  active_experimentation: number;
  kolb_type: KolbType;
}

// Subject Aptitude Assessment
export interface AptitudeQuestion {
  id: number;
  subject_code: string;
  question: string;
  options: string[];
  correct_answer: number;
  difficulty: DifficultyLevel;
}

// ============================================================================
// REQUIREMENT 4: Teaching Methods
// ============================================================================

export type MethodCategory = 'modern' | 'ancient' | 'scientific';

export interface TeachingMethod {
  id: string;
  code: string;
  name: string;
  name_hindi: string | null;
  category: MethodCategory;
  description: string;
  description_hindi: string | null;
  best_for_vark: VARKStyle[];
  best_for_subjects: string[];
  best_for_bloom: BloomLevel[];
  icon: string | null;
  steps: string[];
  is_active: boolean;
  created_at: string;
}

export interface StudentMethodEffectiveness {
  id: string;
  user_id: string;
  topic_id: string;
  method_code: string;
  understanding_before: number;
  understanding_after: number;
  time_spent_minutes: number;
  rating: number;
  created_at: string;
}

export interface MethodRecommendation {
  method: TeachingMethod;
  match_score: number;
  reason: string;
}

// ============================================================================
// REQUIREMENT 5: Interactive Engagement
// ============================================================================

export type ActivityType =
  | 'word_puzzle'
  | 'number_game'
  | 'drag_drop'
  | 'case_study'
  | 'virtual_lab'
  | 'timed_challenge'
  | 'creative_project'
  | 'simulation'
  | 'sequence_arrange'
  | 'concept_match';

export interface Activity {
  id: string;
  topic_id: string | null;
  subject_id: string | null;
  activity_type: ActivityType;
  title: string;
  title_hindi: string | null;
  description: string | null;
  difficulty: DifficultyLevel;
  config: ActivityConfig;
  time_limit_seconds: number | null;
  xp_reward: number;
  max_score: number;
  is_active: boolean;
  created_at: string;
}

// Discriminated union for activity configs
export type ActivityConfig =
  | WordPuzzleConfig
  | NumberGameConfig
  | DragDropConfig
  | CaseStudyConfig
  | VirtualLabConfig
  | TimedChallengeConfig
  | CreativeProjectConfig
  | SimulationConfig
  | SequenceArrangeConfig
  | ConceptMatchConfig;

export interface WordPuzzleConfig {
  type: 'word_puzzle';
  puzzle_type: 'crossword' | 'word_search' | 'fill_letters' | 'scramble';
  words: { word: string; clue: string }[];
  grid_size?: number;
}

export interface NumberGameConfig {
  type: 'number_game';
  game_type: 'mental_math' | 'pattern' | 'vedic_math' | 'estimation';
  problems: { question: string; answer: number; hint?: string }[];
  time_per_problem?: number;
}

export interface DragDropConfig {
  type: 'drag_drop';
  items: { id: string; text: string; image_url?: string }[];
  targets: { id: string; label: string; correct_items: string[] }[];
  instruction: string;
}

export interface CaseStudyConfig {
  type: 'case_study';
  scenario: string;
  scenario_image_url?: string;
  decisions: {
    id: string;
    question: string;
    options: { text: string; outcome: string; score: number; next_decision_id?: string }[];
  }[];
  starting_decision_id: string;
}

export interface VirtualLabConfig {
  type: 'virtual_lab';
  lab_type: 'chemistry' | 'physics' | 'biology' | 'electronics';
  title: string;
  instructions: string[];
  elements: { id: string; name: string; type: string; properties: Record<string, any> }[];
  expected_result: string;
}

export interface TimedChallengeConfig {
  type: 'timed_challenge';
  questions: { question: string; options: string[]; correct: number; points: number }[];
  time_limit_seconds: number;
  bonus_per_second: number;
}

export interface CreativeProjectConfig {
  type: 'creative_project';
  prompt: string;
  rubric: { criterion: string; max_points: number; description: string }[];
  examples?: string[];
  submission_type: 'text' | 'drawing' | 'code' | 'presentation';
}

export interface SimulationConfig {
  type: 'simulation';
  simulation_type: string;
  parameters: { name: string; min: number; max: number; default: number; unit: string }[];
  expected_observations: string[];
}

export interface SequenceArrangeConfig {
  type: 'sequence_arrange';
  items: { id: string; text: string; image_url?: string }[];
  correct_order: string[];
  instruction: string;
}

export interface ConceptMatchConfig {
  type: 'concept_match';
  pairs: { concept: string; match: string }[];
  instruction: string;
  distractor_matches?: string[];
}

export interface ActivityAttempt {
  id: string;
  user_id: string;
  activity_id: string;
  score: number;
  max_score: number;
  time_taken_seconds: number;
  completed: boolean;
  result_data: Record<string, any> | null;
  created_at: string;
}

export type ChallengeType = 'speed' | 'accuracy' | 'creative' | 'collaborative';

export interface Challenge {
  id: string;
  classroom_id: string | null;
  created_by: string | null;
  title: string;
  description: string | null;
  challenge_type: ChallengeType;
  topic_id: string | null;
  subject_id: string | null;
  config: Record<string, any>;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ChallengeParticipant {
  id: string;
  challenge_id: string;
  user_id: string;
  score: number;
  rank: number | null;
  completed_at: string | null;
  created_at: string;
}

export interface ChallengeWithParticipants extends Challenge {
  participants: ChallengeParticipant[];
  my_participation?: ChallengeParticipant;
}

// ============================================================================
// REQUIREMENT 2: AI Guru - Extended Chat
// ============================================================================

export type GuruSessionType = 'tutor' | 'guru' | 'socratic' | 'exploration';

export interface GuruSession extends ChatSession {
  session_type: GuruSessionType;
  teaching_method: string | null;
  difficulty_level: number;
  is_beyond_curriculum: boolean;
}

export interface UnderstandingCheckpoint {
  id: string;
  session_id: string;
  user_id: string;
  checkpoint_number: number;
  understanding_level: number;
  ai_assessment: string | null;
  created_at: string;
}

export interface GuruChatRequest {
  message: string;
  session_id?: string;
  topic_id?: string;
  teaching_method?: string;
  difficulty_level?: number;
  is_socratic?: boolean;
  is_beyond_curriculum?: boolean;
}

export interface GuruChatResponse {
  reply: string;
  session_id: string;
  checkpoint?: UnderstandingCheckpoint;
  suggested_methods?: string[];
  follow_up_questions?: string[];
}

// ============================================================================
// Shared / Dashboard Extension Types
// ============================================================================

export interface StudentFullProfile {
  learning_dna: LearningDNAFull;
  character_profile: CharacterProfile;
  method_effectiveness: StudentMethodEffectiveness[];
  assigned_methods: StudentTeachingMethod[];
}

export interface MethodLibraryFilters {
  category?: MethodCategory;
  vark_style?: VARKStyle;
  subject?: string;
  bloom_level?: BloomLevel;
}
