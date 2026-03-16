-- ============================================================================
-- MyCupIsEmpty Pedagogy Engine v1
-- 8-Module Evidence-Based Learning System
-- Replaces permanent style teams with adaptive barrier-detection engine
-- ============================================================================

-- ============================================================================
-- 1. LEARNER STATE — The central record for each student per subject
-- ============================================================================

CREATE TABLE public.learner_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    chapter_id UUID REFERENCES public.chapters(id) ON DELETE SET NULL,
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    education_level_code TEXT,

    -- Current module & progression
    current_module TEXT NOT NULL DEFAULT 'access_fit' CHECK (current_module IN (
        'access_fit', 'diagnostic', 'teach_scaffold', 'retrieve_retain',
        'feedback_repair', 'metacognition', 'mastery_check', 'tiered_support'
    )),
    current_band TEXT NOT NULL DEFAULT 'foundation' CHECK (current_band IN (
        'foundation', 'emerging', 'developing', 'secure', 'advanced'
    )),
    support_tier INTEGER DEFAULT 1 CHECK (support_tier BETWEEN 1 AND 3),

    -- Access & Fit preferences (Module 1) — NOT classification, just preference
    preferred_format TEXT DEFAULT 'text' CHECK (preferred_format IN (
        'visual', 'text', 'audio', 'story', 'activity', 'guided_examples', 'video', 'diagram'
    )),
    language_level TEXT DEFAULT 'standard' CHECK (language_level IN (
        'simplified', 'standard', 'advanced', 'bilingual'
    )),
    pacing TEXT DEFAULT 'normal' CHECK (pacing IN ('slow', 'normal', 'fast', 'self_paced')),
    chunk_size TEXT DEFAULT 'medium' CHECK (chunk_size IN ('small', 'medium', 'large')),
    accessibility_needs JSONB DEFAULT '[]', -- ['read_aloud', 'high_contrast', 'captions']

    -- Diagnostic state (Module 2)
    prior_knowledge_score NUMERIC(5,2) DEFAULT 0,
    misconception_tags JSONB DEFAULT '[]',  -- ['fraction_as_whole', 'force_equals_motion', ...]
    confidence_accuracy_gap NUMERIC(5,2) DEFAULT 0, -- positive = overconfident
    readiness_level TEXT DEFAULT 'unknown' CHECK (readiness_level IN (
        'unknown', 'not_ready', 'needs_scaffolding', 'ready', 'above_level'
    )),

    -- Teach & Scaffold state (Module 3)
    scaffold_level INTEGER DEFAULT 3 CHECK (scaffold_level BETWEEN 0 AND 5),
    -- 5=full worked example, 4=faded, 3=guided, 2=hints, 1=minimal, 0=independent
    hint_dependence_rate NUMERIC(5,2) DEFAULT 0, -- 0-100, high = dependent
    consecutive_correct INTEGER DEFAULT 0,
    consecutive_wrong INTEGER DEFAULT 0,

    -- Retrieve & Retain state (Module 4)
    spaced_interval_days NUMERIC(5,1) DEFAULT 1, -- current spacing in days
    retrieval_strength NUMERIC(5,2) DEFAULT 0,   -- 0-100
    last_retrieval_at TIMESTAMPTZ,
    retrieval_success_rate NUMERIC(5,2) DEFAULT 0,
    items_in_spaced_queue INTEGER DEFAULT 0,

    -- Feedback & Misconception state (Module 5)
    active_misconceptions JSONB DEFAULT '[]',
    -- [{code, description, occurrences, last_seen, resolved: bool}]
    misconception_repair_attempts INTEGER DEFAULT 0,
    last_feedback_type TEXT, -- 'corrective', 'explanatory', 'contrastive', 'self_explanation'

    -- Metacognition state (Module 6)
    confidence_calibration NUMERIC(5,2) DEFAULT 50, -- 0-100, 100=perfectly calibrated
    self_regulation_score NUMERIC(5,2) DEFAULT 50,
    uses_planning BOOLEAN DEFAULT false,
    uses_monitoring BOOLEAN DEFAULT false,
    uses_evaluation BOOLEAN DEFAULT false,
    careless_error_rate NUMERIC(5,2) DEFAULT 0,
    revision_behavior_score NUMERIC(5,2) DEFAULT 0,

    -- Mastery state (Module 7)
    mastery_score_recall NUMERIC(5,2) DEFAULT 0,         -- /20
    mastery_score_comprehension NUMERIC(5,2) DEFAULT 0,  -- /20
    mastery_score_application NUMERIC(5,2) DEFAULT 0,    -- /20
    mastery_score_transfer NUMERIC(5,2) DEFAULT 0,       -- /15
    mastery_score_retention NUMERIC(5,2) DEFAULT 0,      -- /10
    mastery_score_metacognition NUMERIC(5,2) DEFAULT 0,  -- /10
    mastery_score_independence NUMERIC(5,2) DEFAULT 0,   -- /5
    mastery_total NUMERIC(5,2) GENERATED ALWAYS AS (
        mastery_score_recall + mastery_score_comprehension + mastery_score_application +
        mastery_score_transfer + mastery_score_retention + mastery_score_metacognition +
        mastery_score_independence
    ) STORED,

    -- Tiered support state (Module 8)
    stalled_cycles INTEGER DEFAULT 0, -- how many cycles without progress
    frustration_signals INTEGER DEFAULT 0,
    fallback_loop_count INTEGER DEFAULT 0,
    needs_human_review BOOLEAN DEFAULT false,
    teacher_notes TEXT,

    -- Session tracking
    total_time_minutes NUMERIC(8,1) DEFAULT 0,
    sessions_count INTEGER DEFAULT 0,
    last_active_at TIMESTAMPTZ,
    streak_days INTEGER DEFAULT 0,

    -- Engagement signals
    session_abandonment_count INTEGER DEFAULT 0,
    format_change_requests INTEGER DEFAULT 0,
    disengagement_signals JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, subject_id, chapter_id, topic_id)
);

-- ============================================================================
-- 2. MODULE EVENTS — Log of every module activation and outcome
-- ============================================================================

CREATE TABLE public.module_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    learner_state_id UUID REFERENCES public.learner_state(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id),
    topic_id UUID REFERENCES public.topics(id),

    module TEXT NOT NULL CHECK (module IN (
        'access_fit', 'diagnostic', 'teach_scaffold', 'retrieve_retain',
        'feedback_repair', 'metacognition', 'mastery_check', 'tiered_support'
    )),
    trigger_reason TEXT NOT NULL, -- why this module was activated
    -- e.g. 'new_topic', 'repeated_errors', 'forgetting_curve', 'overconfidence', 'stalled_progress'

    -- Input signals that triggered this module
    input_signals JSONB NOT NULL DEFAULT '{}',

    -- Module outcome
    outcome TEXT CHECK (outcome IN (
        'promoted',         -- student advanced to next module/topic
        'stayed',           -- student stays in current module, making progress
        'fallback',         -- student fell back to an earlier module
        'escalated',        -- moved to higher tier of support
        'completed',        -- module objective met
        'abandoned'         -- student disengaged
    )),
    outcome_data JSONB DEFAULT '{}',

    -- Scores before and after
    score_before NUMERIC(5,2),
    score_after NUMERIC(5,2),
    time_spent_minutes NUMERIC(5,1),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. DIAGNOSTIC ITEMS — Questions used for placement and ongoing checks
-- ============================================================================

CREATE TABLE public.diagnostic_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID REFERENCES public.subjects(id),
    chapter_id UUID REFERENCES public.chapters(id),
    topic_id UUID REFERENCES public.topics(id),
    education_level_code TEXT,

    item_type TEXT NOT NULL CHECK (item_type IN (
        'prior_knowledge', 'prerequisite', 'misconception_probe',
        'confidence_check', 'transfer_check', 'retention_check'
    )),
    bloom_level TEXT CHECK (bloom_level IN (
        'remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'
    )),

    question_text TEXT NOT NULL,
    question_format TEXT DEFAULT 'mcq' CHECK (question_format IN (
        'mcq', 'short_answer', 'explanation', 'true_false',
        'ordering', 'matching', 'self_rating'
    )),
    options JSONB, -- for MCQ/matching/ordering
    correct_answer JSONB NOT NULL,
    misconception_if_wrong JSONB, -- {code: '...', description: '...'}
    difficulty NUMERIC(3,1) DEFAULT 5, -- 1-10
    time_limit_seconds INTEGER,

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. DIAGNOSTIC RESPONSES — Student answers to diagnostic items
-- ============================================================================

CREATE TABLE public.diagnostic_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    learner_state_id UUID REFERENCES public.learner_state(id) ON DELETE CASCADE,
    diagnostic_item_id UUID NOT NULL REFERENCES public.diagnostic_items(id) ON DELETE CASCADE,

    answer JSONB NOT NULL,
    is_correct BOOLEAN,
    confidence_rating INTEGER CHECK (confidence_rating BETWEEN 1 AND 5), -- 1=guess, 5=certain
    time_taken_seconds INTEGER,
    misconception_detected TEXT, -- code if wrong answer maps to known misconception

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5. SCAFFOLD STEPS — Worked examples and faded scaffolding
-- ============================================================================

CREATE TABLE public.scaffold_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID REFERENCES public.subjects(id),
    topic_id UUID REFERENCES public.topics(id),
    education_level_code TEXT,

    step_type TEXT NOT NULL CHECK (step_type IN (
        'full_worked_example',  -- level 5: all steps shown
        'faded_example',        -- level 4: some steps blanked
        'guided_practice',      -- level 3: hints available
        'independent_practice', -- level 2: minimal hints
        'assessment'            -- level 1: no support
    )),
    scaffold_level INTEGER NOT NULL CHECK (scaffold_level BETWEEN 1 AND 5),

    title TEXT NOT NULL,
    content JSONB NOT NULL, -- structured content
    -- { steps: [{text, is_shown, hint, explanation}], problem, solution }
    format TEXT DEFAULT 'text', -- preferred presentation format
    alternative_formats JSONB DEFAULT '[]', -- ['video', 'diagram', 'audio']

    prerequisite_topic_ids UUID[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 6. RETRIEVAL QUEUE — Spaced repetition items per student
-- ============================================================================

CREATE TABLE public.retrieval_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id),
    topic_id UUID REFERENCES public.topics(id),

    item_type TEXT NOT NULL CHECK (item_type IN (
        'recall', 'cue_recall', 'free_recall', 'application',
        'transfer', 'explanation', 'mixed_practice'
    )),
    question_text TEXT NOT NULL,
    answer JSONB NOT NULL,

    -- SM-2 algorithm fields
    ease_factor NUMERIC(4,2) DEFAULT 2.5,
    interval_days NUMERIC(6,1) DEFAULT 1,
    repetitions INTEGER DEFAULT 0,
    next_review_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_reviewed_at TIMESTAMPTZ,
    last_quality INTEGER, -- 0-5 (SM-2 quality rating)

    -- Performance tracking
    times_correct INTEGER DEFAULT 0,
    times_wrong INTEGER DEFAULT 0,
    avg_response_time_seconds NUMERIC(5,1),

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 7. MISCONCEPTION BANK — Known misconceptions per subject/topic
-- ============================================================================

CREATE TABLE public.misconception_bank (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID REFERENCES public.subjects(id),
    topic_id UUID REFERENCES public.topics(id),
    education_level_code TEXT,

    code TEXT UNIQUE NOT NULL, -- 'math_fraction_as_whole', 'physics_force_motion', etc
    description TEXT NOT NULL,
    common_wrong_answers JSONB DEFAULT '[]', -- patterns that indicate this misconception
    repair_strategy TEXT NOT NULL, -- how to fix it
    contrastive_examples JSONB DEFAULT '[]', -- correct vs incorrect side-by-side
    prerequisite_gaps TEXT[], -- what's usually missing

    severity TEXT DEFAULT 'moderate' CHECK (severity IN ('mild', 'moderate', 'severe')),
    frequency_percentage NUMERIC(5,2), -- how common is this among students

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 8. STUDENT MISCONCEPTIONS — Tracked per student
-- ============================================================================

CREATE TABLE public.student_misconceptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    misconception_code TEXT NOT NULL REFERENCES public.misconception_bank(code),
    subject_id UUID REFERENCES public.subjects(id),
    topic_id UUID REFERENCES public.topics(id),

    first_detected_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    occurrences INTEGER DEFAULT 1,
    repair_attempts INTEGER DEFAULT 0,
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolution_method TEXT, -- what finally fixed it

    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, misconception_code)
);

-- ============================================================================
-- 9. MASTERY CHECKPOINTS — Topic-level mastery assessments
-- ============================================================================

CREATE TABLE public.mastery_checkpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id),
    chapter_id UUID REFERENCES public.chapters(id),
    topic_id UUID REFERENCES public.topics(id),

    checkpoint_type TEXT NOT NULL CHECK (checkpoint_type IN (
        'topic_end', 'chapter_end', 'mid_review', 'promotion_gate', 'delayed_check'
    )),

    -- The 7-component mastery score
    score_recall NUMERIC(5,2) DEFAULT 0,         -- /20
    score_comprehension NUMERIC(5,2) DEFAULT 0,  -- /20
    score_application NUMERIC(5,2) DEFAULT 0,    -- /20
    score_transfer NUMERIC(5,2) DEFAULT 0,       -- /15
    score_retention NUMERIC(5,2) DEFAULT 0,      -- /10
    score_metacognition NUMERIC(5,2) DEFAULT 0,  -- /10
    score_independence NUMERIC(5,2) DEFAULT 0,   -- /5
    total_score NUMERIC(5,2) GENERATED ALWAYS AS (
        score_recall + score_comprehension + score_application +
        score_transfer + score_retention + score_metacognition + score_independence
    ) STORED,

    band TEXT GENERATED ALWAYS AS (
        CASE
            WHEN score_recall + score_comprehension + score_application +
                 score_transfer + score_retention + score_metacognition + score_independence >= 90 THEN 'advanced'
            WHEN score_recall + score_comprehension + score_application +
                 score_transfer + score_retention + score_metacognition + score_independence >= 75 THEN 'secure'
            WHEN score_recall + score_comprehension + score_application +
                 score_transfer + score_retention + score_metacognition + score_independence >= 60 THEN 'developing'
            WHEN score_recall + score_comprehension + score_application +
                 score_transfer + score_retention + score_metacognition + score_independence >= 40 THEN 'emerging'
            ELSE 'foundation'
        END
    ) STORED,

    -- Decision
    promoted BOOLEAN DEFAULT false,
    promotion_blocked_by JSONB DEFAULT '[]', -- which sub-scores blocked
    weak_subskills JSONB DEFAULT '[]', -- routed back to specific modules

    -- Delayed check
    delayed_check_scheduled_at TIMESTAMPTZ,
    delayed_check_completed BOOLEAN DEFAULT false,
    delayed_check_passed BOOLEAN,

    questions_json JSONB DEFAULT '[]',
    answers_json JSONB DEFAULT '[]',
    time_taken_minutes INTEGER,
    ai_feedback TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 10. TIER ASSIGNMENTS — MTSS tier tracking
-- ============================================================================

CREATE TABLE public.tier_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id),
    topic_id UUID REFERENCES public.topics(id),

    tier INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 3),
    -- 1 = universal core engine
    -- 2 = targeted extra support
    -- 3 = intensive individualized path

    reason TEXT NOT NULL,
    assigned_by TEXT DEFAULT 'engine' CHECK (assigned_by IN ('engine', 'teacher', 'ai_recommendation')),
    teacher_id UUID REFERENCES public.profiles(id),

    interventions JSONB DEFAULT '[]',
    -- [{type: 'extra_scaffolding', description: '...', started_at, status}]

    progress_notes TEXT,
    is_active BOOLEAN DEFAULT true,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_reason TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 11. ENGINE DECISION LOG — Audit trail of the decision engine
-- ============================================================================

CREATE TABLE public.engine_decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    learner_state_id UUID REFERENCES public.learner_state(id),
    subject_id UUID REFERENCES public.subjects(id),
    topic_id UUID REFERENCES public.topics(id),

    -- The decision
    from_module TEXT,
    to_module TEXT NOT NULL,
    decision_reason TEXT NOT NULL,
    decision_signals JSONB NOT NULL DEFAULT '{}',
    -- signals that informed this decision

    -- Thresholds used
    thresholds_applied JSONB DEFAULT '{}',
    -- { 'accuracy_threshold': 0.7, 'hint_dependence_max': 30, ... }

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_learner_state_user ON public.learner_state(user_id);
CREATE INDEX idx_learner_state_subject ON public.learner_state(subject_id);
CREATE INDEX idx_learner_state_module ON public.learner_state(current_module);
CREATE INDEX idx_learner_state_band ON public.learner_state(current_band);
CREATE INDEX idx_module_events_user ON public.module_events(user_id);
CREATE INDEX idx_module_events_module ON public.module_events(module);
CREATE INDEX idx_diagnostic_items_subject ON public.diagnostic_items(subject_id);
CREATE INDEX idx_diagnostic_items_topic ON public.diagnostic_items(topic_id);
CREATE INDEX idx_diagnostic_responses_user ON public.diagnostic_responses(user_id);
CREATE INDEX idx_retrieval_queue_user ON public.retrieval_queue(user_id);
CREATE INDEX idx_retrieval_queue_next ON public.retrieval_queue(next_review_at);
CREATE INDEX idx_misconception_bank_subject ON public.misconception_bank(subject_id);
CREATE INDEX idx_student_misconceptions_user ON public.student_misconceptions(user_id);
CREATE INDEX idx_mastery_checkpoints_user ON public.mastery_checkpoints(user_id);
CREATE INDEX idx_mastery_checkpoints_topic ON public.mastery_checkpoints(topic_id);
CREATE INDEX idx_tier_assignments_user ON public.tier_assignments(user_id);
CREATE INDEX idx_engine_decisions_user ON public.engine_decisions(user_id);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.learner_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scaffold_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retrieval_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.misconception_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_misconceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastery_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tier_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engine_decisions ENABLE ROW LEVEL SECURITY;

-- Student access
CREATE POLICY "Users manage own learner state" ON public.learner_state FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own module events" ON public.module_events FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own diagnostic responses" ON public.diagnostic_responses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own retrieval queue" ON public.retrieval_queue FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own misconceptions" ON public.student_misconceptions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own mastery checkpoints" ON public.mastery_checkpoints FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own tier assignments" ON public.tier_assignments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users see own engine decisions" ON public.engine_decisions FOR SELECT USING (auth.uid() = user_id);

-- Public read for reference tables
CREATE POLICY "Everyone can read diagnostic items" ON public.diagnostic_items FOR SELECT USING (true);
CREATE POLICY "Everyone can read scaffold steps" ON public.scaffold_steps FOR SELECT USING (true);
CREATE POLICY "Everyone can read misconception bank" ON public.misconception_bank FOR SELECT USING (true);

-- Teacher access
CREATE POLICY "Teachers manage tier assignments" ON public.tier_assignments FOR ALL USING (
    auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
);
CREATE POLICY "Teachers view learner states" ON public.learner_state FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
);
CREATE POLICY "Teachers view engine decisions" ON public.engine_decisions FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
);
CREATE POLICY "Teachers manage diagnostic items" ON public.diagnostic_items FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
);
CREATE POLICY "Teachers manage scaffold steps" ON public.scaffold_steps FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
);
CREATE POLICY "Teachers manage misconception bank" ON public.misconception_bank FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
);
