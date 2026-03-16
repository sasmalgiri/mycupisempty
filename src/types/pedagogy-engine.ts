// ============================================================================
// Pedagogy Engine v1 — Core Types
// 8-Module Evidence-Based Adaptive Learning System
// ============================================================================

// --- Enums & Literals ---

export type PedagogyModule =
  | 'access_fit'
  | 'diagnostic'
  | 'teach_scaffold'
  | 'retrieve_retain'
  | 'feedback_repair'
  | 'metacognition'
  | 'mastery_check'
  | 'tiered_support';

export type MasteryBand = 'foundation' | 'emerging' | 'developing' | 'secure' | 'advanced';

export type SupportTier = 1 | 2 | 3;

export type PreferredFormat = 'visual' | 'text' | 'audio' | 'story' | 'activity' | 'guided_examples' | 'video' | 'diagram';

export type LanguageLevel = 'simplified' | 'standard' | 'advanced' | 'bilingual';

export type Pacing = 'slow' | 'normal' | 'fast' | 'self_paced';

export type ChunkSize = 'small' | 'medium' | 'large';

export type ReadinessLevel = 'unknown' | 'not_ready' | 'needs_scaffolding' | 'ready' | 'above_level';

export type BloomLevel = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';

export type DiagnosticItemType =
  | 'prior_knowledge'
  | 'prerequisite'
  | 'misconception_probe'
  | 'confidence_check'
  | 'transfer_check'
  | 'retention_check';

export type QuestionFormat = 'mcq' | 'short_answer' | 'explanation' | 'true_false' | 'ordering' | 'matching' | 'self_rating';

export type ScaffoldType =
  | 'full_worked_example'
  | 'faded_example'
  | 'guided_practice'
  | 'independent_practice'
  | 'assessment';

export type RetrievalItemType = 'recall' | 'cue_recall' | 'free_recall' | 'application' | 'transfer' | 'explanation' | 'mixed_practice';

export type FeedbackType = 'corrective' | 'explanatory' | 'contrastive' | 'self_explanation';

export type MisconceptionSeverity = 'mild' | 'moderate' | 'severe';

export type CheckpointType = 'topic_end' | 'chapter_end' | 'mid_review' | 'promotion_gate' | 'delayed_check';

export type ModuleOutcome = 'promoted' | 'stayed' | 'fallback' | 'escalated' | 'completed' | 'abandoned';

export type TierAssignedBy = 'engine' | 'teacher' | 'ai_recommendation';

// --- Core Tables ---

export interface LearnerState {
  id: string;
  user_id: string;
  subject_id: string | null;
  chapter_id: string | null;
  topic_id: string | null;
  education_level_code: string | null;

  // Current module & progression
  current_module: PedagogyModule;
  current_band: MasteryBand;
  support_tier: SupportTier;

  // Module 1: Access & Fit
  preferred_format: PreferredFormat;
  language_level: LanguageLevel;
  pacing: Pacing;
  chunk_size: ChunkSize;
  accessibility_needs: string[]; // ['read_aloud', 'high_contrast', 'captions']

  // Module 2: Diagnostic
  prior_knowledge_score: number;
  misconception_tags: string[];
  confidence_accuracy_gap: number;
  readiness_level: ReadinessLevel;

  // Module 3: Teach & Scaffold
  scaffold_level: number; // 0-5
  hint_dependence_rate: number; // 0-100
  consecutive_correct: number;
  consecutive_wrong: number;

  // Module 4: Retrieve & Retain
  spaced_interval_days: number;
  retrieval_strength: number; // 0-100
  last_retrieval_at: string | null;
  retrieval_success_rate: number;
  items_in_spaced_queue: number;

  // Module 5: Feedback & Misconception
  active_misconceptions: ActiveMisconception[];
  misconception_repair_attempts: number;
  last_feedback_type: FeedbackType | null;

  // Module 6: Metacognition
  confidence_calibration: number; // 0-100
  self_regulation_score: number;
  uses_planning: boolean;
  uses_monitoring: boolean;
  uses_evaluation: boolean;
  careless_error_rate: number;
  revision_behavior_score: number;

  // Module 7: Mastery (7-component score)
  mastery_score_recall: number;         // max 20
  mastery_score_comprehension: number;  // max 20
  mastery_score_application: number;    // max 20
  mastery_score_transfer: number;       // max 15
  mastery_score_retention: number;      // max 10
  mastery_score_metacognition: number;  // max 10
  mastery_score_independence: number;   // max 5
  mastery_total: number;               // generated: sum of above, max 100

  // Module 8: Tiered Support
  stalled_cycles: number;
  frustration_signals: number;
  fallback_loop_count: number;
  needs_human_review: boolean;
  teacher_notes: string | null;

  // Session tracking
  total_time_minutes: number;
  sessions_count: number;
  last_active_at: string | null;
  streak_days: number;

  // Engagement signals
  session_abandonment_count: number;
  format_change_requests: number;
  disengagement_signals: Record<string, any>;

  created_at: string;
  updated_at: string;
}

export interface ActiveMisconception {
  code: string;
  description: string;
  occurrences: number;
  last_seen: string;
  resolved: boolean;
}

export interface ModuleEvent {
  id: string;
  user_id: string;
  learner_state_id: string | null;
  subject_id: string | null;
  topic_id: string | null;

  module: PedagogyModule;
  trigger_reason: string;
  input_signals: Record<string, any>;

  outcome: ModuleOutcome | null;
  outcome_data: Record<string, any>;

  score_before: number | null;
  score_after: number | null;
  time_spent_minutes: number | null;

  created_at: string;
}

export interface DiagnosticItem {
  id: string;
  subject_id: string | null;
  chapter_id: string | null;
  topic_id: string | null;
  education_level_code: string | null;

  item_type: DiagnosticItemType;
  bloom_level: BloomLevel | null;

  question_text: string;
  question_format: QuestionFormat;
  options: any | null;
  correct_answer: any;
  misconception_if_wrong: { code: string; description: string } | null;
  difficulty: number;
  time_limit_seconds: number | null;

  is_active: boolean;
  created_at: string;
}

export interface DiagnosticResponse {
  id: string;
  user_id: string;
  learner_state_id: string | null;
  diagnostic_item_id: string;

  answer: any;
  is_correct: boolean | null;
  confidence_rating: number | null; // 1-5
  time_taken_seconds: number | null;
  misconception_detected: string | null;

  created_at: string;
}

export interface ScaffoldStep {
  id: string;
  subject_id: string | null;
  topic_id: string | null;
  education_level_code: string | null;

  step_type: ScaffoldType;
  scaffold_level: number; // 1-5

  title: string;
  content: ScaffoldContent;
  format: string;
  alternative_formats: string[];

  prerequisite_topic_ids: string[] | null;
  is_active: boolean;
  created_at: string;
}

export interface ScaffoldContent {
  steps: ScaffoldContentStep[];
  problem?: string;
  solution?: string;
}

export interface ScaffoldContentStep {
  text: string;
  is_shown: boolean;
  hint?: string;
  explanation?: string;
}

export interface RetrievalQueueItem {
  id: string;
  user_id: string;
  subject_id: string | null;
  topic_id: string | null;

  item_type: RetrievalItemType;
  question_text: string;
  answer: any;

  // SM-2 algorithm fields
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_at: string;
  last_reviewed_at: string | null;
  last_quality: number | null; // 0-5

  // Performance
  times_correct: number;
  times_wrong: number;
  avg_response_time_seconds: number | null;

  is_active: boolean;
  created_at: string;
}

export interface MisconceptionBankEntry {
  id: string;
  subject_id: string | null;
  topic_id: string | null;
  education_level_code: string | null;

  code: string;
  description: string;
  common_wrong_answers: any[];
  repair_strategy: string;
  contrastive_examples: ContrastiveExample[];
  prerequisite_gaps: string[] | null;

  severity: MisconceptionSeverity;
  frequency_percentage: number | null;

  is_active: boolean;
  created_at: string;
}

export interface ContrastiveExample {
  correct: string;
  incorrect: string;
  explanation: string;
}

export interface StudentMisconception {
  id: string;
  user_id: string;
  misconception_code: string;
  subject_id: string | null;
  topic_id: string | null;

  first_detected_at: string;
  last_seen_at: string;
  occurrences: number;
  repair_attempts: number;
  is_resolved: boolean;
  resolved_at: string | null;
  resolution_method: string | null;

  created_at: string;
  // Joined
  misconception?: MisconceptionBankEntry;
}

export interface MasteryCheckpoint {
  id: string;
  user_id: string;
  subject_id: string | null;
  chapter_id: string | null;
  topic_id: string | null;

  checkpoint_type: CheckpointType;

  // 7-component mastery score
  score_recall: number;
  score_comprehension: number;
  score_application: number;
  score_transfer: number;
  score_retention: number;
  score_metacognition: number;
  score_independence: number;
  total_score: number;  // generated
  band: MasteryBand;    // generated

  // Decision
  promoted: boolean;
  promotion_blocked_by: string[];
  weak_subskills: string[];

  // Delayed check
  delayed_check_scheduled_at: string | null;
  delayed_check_completed: boolean;
  delayed_check_passed: boolean | null;

  questions_json: any[];
  answers_json: any[];
  time_taken_minutes: number | null;
  ai_feedback: string | null;

  created_at: string;
}

export interface TierAssignment {
  id: string;
  user_id: string;
  subject_id: string | null;
  topic_id: string | null;

  tier: SupportTier;
  reason: string;
  assigned_by: TierAssignedBy;
  teacher_id: string | null;

  interventions: TierIntervention[];

  progress_notes: string | null;
  is_active: boolean;
  assigned_at: string;
  resolved_at: string | null;
  resolved_reason: string | null;

  created_at: string;
}

export interface TierIntervention {
  type: string;
  description: string;
  started_at: string;
  status: 'active' | 'completed' | 'paused';
}

export interface EngineDecision {
  id: string;
  user_id: string;
  learner_state_id: string | null;
  subject_id: string | null;
  topic_id: string | null;

  from_module: PedagogyModule | null;
  to_module: PedagogyModule;
  decision_reason: string;
  decision_signals: Record<string, any>;

  thresholds_applied: Record<string, number>;

  created_at: string;
}

// ============================================================================
// Scoring & Threshold Configuration
// ============================================================================

/** Weights for the 7-component mastery score (must sum to 100) */
export interface MasteryWeights {
  recall: 20;
  comprehension: 20;
  application: 20;
  transfer: 15;
  retention: 10;
  metacognition: 10;
  independence: 5;
}

/** Band thresholds — mastery_total maps to band */
export interface BandThresholds {
  advanced: 90;    // >= 90
  secure: 75;      // >= 75
  developing: 60;  // >= 60
  emerging: 40;    // >= 40
  foundation: 0;   // < 40
}

/** Trigger thresholds for the decision engine */
export interface EngineThresholds {
  // Module 2 → Module 3: Diagnostic → Teach
  diagnostic_pass_score: number;               // default 70 — below triggers scaffolding
  misconception_count_threshold: number;       // default 2  — ≥ triggers feedback_repair

  // Module 3: Scaffold fade rules
  scaffold_promote_consecutive_correct: number; // default 3  — 3 correct in a row → reduce scaffold
  scaffold_demote_consecutive_wrong: number;    // default 2  — 2 wrong in a row → increase scaffold
  hint_dependence_max: number;                  // default 30 — above 30% = still dependent

  // Module 4: Retrieval thresholds
  retrieval_strength_min: number;              // default 60 — below → more retrieval practice
  retrieval_success_rate_promote: number;      // default 80 — above → increase interval

  // Module 5: Misconception repair
  misconception_occurrences_escalate: number;  // default 3  — same misconception 3+ times → escalate
  repair_attempts_max: number;                 // default 5  — after 5 attempts → flag for teacher

  // Module 6: Metacognition triggers
  confidence_accuracy_gap_threshold: number;   // default 20 — |gap| > 20 → metacognition module
  careless_error_rate_threshold: number;       // default 15 — above 15% → metacognition nudge

  // Module 7: Mastery promotion
  mastery_promote_min: number;                 // default 75 — need ≥75 to promote
  mastery_each_component_min_pct: number;      // default 50 — each component must be ≥50% of its max
  delayed_check_days: number;                  // default 7  — recheck after 7 days

  // Module 8: Tier escalation
  stalled_cycles_tier2: number;                // default 3  — 3 stalled cycles → tier 2
  stalled_cycles_tier3: number;                // default 6  — 6 stalled cycles → tier 3
  frustration_signals_escalate: number;        // default 5  — 5+ frustration signals → escalate
  fallback_loop_max: number;                   // default 3  — 3 fallback loops → escalate
}

/** Default threshold values */
export const DEFAULT_THRESHOLDS: EngineThresholds = {
  diagnostic_pass_score: 70,
  misconception_count_threshold: 2,
  scaffold_promote_consecutive_correct: 3,
  scaffold_demote_consecutive_wrong: 2,
  hint_dependence_max: 30,
  retrieval_strength_min: 60,
  retrieval_success_rate_promote: 80,
  misconception_occurrences_escalate: 3,
  repair_attempts_max: 5,
  confidence_accuracy_gap_threshold: 20,
  careless_error_rate_threshold: 15,
  mastery_promote_min: 75,
  mastery_each_component_min_pct: 50,
  delayed_check_days: 7,
  stalled_cycles_tier2: 3,
  stalled_cycles_tier3: 6,
  frustration_signals_escalate: 5,
  fallback_loop_max: 3,
};

// ============================================================================
// SM-2 Spaced Repetition Algorithm Types
// ============================================================================

export interface SM2Input {
  quality: number;        // 0-5 (0-2 = forgotten, 3 = hard recall, 4 = good, 5 = perfect)
  ease_factor: number;    // current EF, starts at 2.5
  interval_days: number;  // current interval
  repetitions: number;    // successful repetition count
}

export interface SM2Output {
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_at: string; // ISO timestamp
}

// ============================================================================
// Decision Engine Types
// ============================================================================

/** Signals collected from learner state to make routing decisions */
export interface DecisionSignals {
  // From diagnostic
  prior_knowledge_score: number;
  readiness_level: ReadinessLevel;
  misconception_count: number;

  // From scaffold
  scaffold_level: number;
  consecutive_correct: number;
  consecutive_wrong: number;
  hint_dependence_rate: number;

  // From retrieval
  retrieval_strength: number;
  retrieval_success_rate: number;
  items_due_count: number;

  // From misconception tracking
  active_unresolved_count: number;
  repeat_misconception: boolean;

  // From metacognition
  confidence_accuracy_gap: number;
  careless_error_rate: number;
  self_regulation_score: number;

  // From mastery
  mastery_total: number;
  weakest_component: string;
  weakest_component_pct: number;

  // From engagement
  stalled_cycles: number;
  frustration_signals: number;
  fallback_loop_count: number;
  session_abandonment_count: number;
}

/** The decision engine's routing result */
export interface EngineRoute {
  next_module: PedagogyModule;
  reason: string;
  signals_used: Partial<DecisionSignals>;
  thresholds_applied: Record<string, number>;
  priority: 'normal' | 'urgent' | 'escalated';
}

// ============================================================================
// API Contract Types — Request/Response for module endpoints
// ============================================================================

/** GET /api/pedagogy/state — returns the full learner state */
export interface PedagogyStateResponse {
  state: LearnerState;
  current_route: EngineRoute;
  due_retrieval_count: number;
  active_misconception_count: number;
}

/** POST /api/pedagogy/diagnostic — submit diagnostic answers */
export interface DiagnosticSubmitRequest {
  learner_state_id: string;
  responses: {
    diagnostic_item_id: string;
    answer: any;
    confidence_rating: number;
    time_taken_seconds: number;
  }[];
}

export interface DiagnosticSubmitResponse {
  prior_knowledge_score: number;
  readiness_level: ReadinessLevel;
  misconceptions_detected: string[];
  confidence_accuracy_gap: number;
  next_route: EngineRoute;
}

/** POST /api/pedagogy/scaffold — record scaffold interaction */
export interface ScaffoldInteractionRequest {
  learner_state_id: string;
  scaffold_step_id: string;
  answer: any;
  used_hint: boolean;
  time_taken_seconds: number;
}

export interface ScaffoldInteractionResponse {
  is_correct: boolean;
  new_scaffold_level: number;
  feedback: string;
  next_step_id: string | null;
  next_route: EngineRoute;
}

/** POST /api/pedagogy/retrieval — submit retrieval practice answer */
export interface RetrievalSubmitRequest {
  learner_state_id: string;
  retrieval_item_id: string;
  answer: any;
  quality: number; // 0-5 SM-2 quality
  time_taken_seconds: number;
}

export interface RetrievalSubmitResponse {
  is_correct: boolean;
  sm2_result: SM2Output;
  retrieval_strength: number;
  next_route: EngineRoute;
}

/** POST /api/pedagogy/mastery-check — submit mastery checkpoint */
export interface MasteryCheckSubmitRequest {
  learner_state_id: string;
  checkpoint_type: CheckpointType;
  answers: {
    question_index: number;
    answer: any;
    time_taken_seconds: number;
  }[];
}

export interface MasteryCheckResponse {
  checkpoint: MasteryCheckpoint;
  promoted: boolean;
  weak_subskills: string[];
  next_route: EngineRoute;
}

/** POST /api/pedagogy/preferences — update Module 1 preferences */
export interface PreferencesUpdateRequest {
  learner_state_id: string;
  preferred_format?: PreferredFormat;
  language_level?: LanguageLevel;
  pacing?: Pacing;
  chunk_size?: ChunkSize;
  accessibility_needs?: string[];
}

/** POST /api/pedagogy/metacognition — submit metacognition check */
export interface MetacognitionSubmitRequest {
  learner_state_id: string;
  confidence_before: number; // 1-5
  confidence_after: number;  // 1-5
  actual_score: number;      // 0-100
  used_planning: boolean;
  used_monitoring: boolean;
  used_evaluation: boolean;
  reflection_text?: string;
}

export interface MetacognitionResponse {
  confidence_calibration: number;
  self_regulation_score: number;
  careless_error_rate: number;
  nudge_message: string | null;
  next_route: EngineRoute;
}

/** Teacher endpoints */
export interface TeacherTierOverrideRequest {
  student_id: string;
  subject_id: string;
  topic_id?: string;
  new_tier: SupportTier;
  reason: string;
  interventions?: TierIntervention[];
}

export interface TeacherLearnerView {
  student_id: string;
  student_name: string;
  states: LearnerState[];
  recent_events: ModuleEvent[];
  tier_assignments: TierAssignment[];
  misconceptions: StudentMisconception[];
}

// ============================================================================
// AI Tutor Prompt Context — what the AI tutor receives
// ============================================================================

export interface AITutorContext {
  student_state: Pick<LearnerState,
    'current_module' | 'current_band' | 'support_tier' |
    'preferred_format' | 'language_level' | 'pacing' | 'chunk_size' |
    'scaffold_level' | 'hint_dependence_rate' |
    'active_misconceptions' | 'confidence_calibration' |
    'mastery_total' | 'mastery_score_recall' | 'mastery_score_comprehension' |
    'mastery_score_application' | 'mastery_score_transfer'
  >;
  current_route: EngineRoute;
  subject_name: string;
  topic_name: string;
  education_level: string;
  active_misconceptions: ActiveMisconception[];
  scaffold_content?: ScaffoldContent;
  retrieval_items_due?: RetrievalQueueItem[];
}
