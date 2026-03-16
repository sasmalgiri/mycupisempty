-- ============================================================================
-- Learning Style Teams — The Core Engine of MyCupIsEmpty
-- Students are evaluated and placed into learning style teams PER SUBJECT.
-- Each team follows a style-optimized curriculum from Class 1 to Master's.
-- ============================================================================

-- ============================================================================
-- 1. MAJOR LEARNING STYLES (Teams)
-- ============================================================================

CREATE TABLE public.learning_styles_master (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    name_hindi TEXT,
    description TEXT NOT NULL,
    icon TEXT,
    color TEXT, -- hex color for UI
    evaluation_criteria JSONB NOT NULL DEFAULT '[]', -- what we measure
    teaching_strategies JSONB NOT NULL DEFAULT '[]', -- how to teach this group
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed 8 major learning style teams
INSERT INTO public.learning_styles_master (code, name, name_hindi, description, icon, color, display_order, evaluation_criteria, teaching_strategies) VALUES
('visual_spatial', 'Visual-Spatial Learners', 'दृश्य-स्थानिक शिक्षार्थी',
 'Learn best through images, diagrams, charts, maps, colors, and spatial understanding. They think in pictures and need to see information to understand it.',
 '👁️', '#3b82f6', 1,
 '["diagram_comprehension", "chart_reading", "spatial_reasoning", "color_pattern_recognition", "mental_imagery", "map_interpretation"]',
 '["mind_maps", "infographics", "color_coding", "video_lessons", "diagrams", "flowcharts", "visual_timelines", "picture_associations"]'),

('auditory_musical', 'Auditory-Musical Learners', 'श्रवण-संगीत शिक्षार्थी',
 'Learn best through listening, discussion, music, rhythms, and verbal explanation. They process information through hearing and speaking.',
 '👂', '#8b5cf6', 2,
 '["listening_comprehension", "verbal_instruction_following", "rhythm_pattern", "discussion_participation", "audio_recall", "phonetic_awareness"]',
 '["lectures", "podcasts", "group_discussions", "mnemonics", "rhymes", "storytelling", "verbal_repetition", "audio_books", "songs"]'),

('reading_writing', 'Reading-Writing Learners', 'पठन-लेखन शिक्षार्थी',
 'Learn best through reading texts, writing notes, making lists, and written exercises. They prefer information displayed as words.',
 '📖', '#22c55e', 3,
 '["reading_comprehension", "note_taking_quality", "written_expression", "text_analysis", "summary_writing", "essay_clarity"]',
 '["textbooks", "written_notes", "essays", "lists", "journaling", "written_assignments", "glossaries", "reading_logs"]'),

('kinesthetic_tactile', 'Kinesthetic-Tactile Learners', 'गतिज-स्पर्श शिक्षार्थी',
 'Learn best through hands-on experience, movement, building, touching, and doing. They need to physically engage with material.',
 '🤲', '#f59e0b', 4,
 '["hands_on_task_completion", "physical_demonstration", "experiment_execution", "model_building", "movement_learning", "real_world_application"]',
 '["experiments", "labs", "field_trips", "building_models", "role_play", "physical_activities", "simulations", "hands_on_projects"]'),

('logical_mathematical', 'Logical-Mathematical Learners', 'तार्किक-गणितीय शिक्षार्थी',
 'Learn best through logic, reasoning, patterns, systems, and problem-solving. They need to understand the "why" behind everything.',
 '🧮', '#ef4444', 5,
 '["pattern_recognition", "logical_deduction", "problem_solving_steps", "systematic_analysis", "numerical_reasoning", "cause_effect_understanding"]',
 '["problem_sets", "logic_puzzles", "step_by_step_proofs", "classification", "scientific_method", "flowcharts", "statistics", "coding"]'),

('social_interpersonal', 'Social-Interpersonal Learners', 'सामाजिक-अंतरवैयक्तिक शिक्षार्थी',
 'Learn best through group work, peer teaching, discussions, and social interaction. They understand material by explaining to and learning from others.',
 '🤝', '#ec4899', 6,
 '["group_collaboration", "peer_teaching_ability", "discussion_quality", "empathy_in_learning", "team_problem_solving", "social_engagement"]',
 '["group_projects", "peer_tutoring", "study_groups", "debates", "role_play", "teach_back", "collaborative_research", "pair_programming"]'),

('solitary_intrapersonal', 'Solitary-Intrapersonal Learners', 'एकल-अंतर्वैयक्तिक शिक्षार्थी',
 'Learn best through self-study, reflection, journaling, and independent work. They are self-motivated and prefer to work at their own pace.',
 '🧘', '#6366f1', 7,
 '["self_study_effectiveness", "reflection_depth", "goal_setting", "self_assessment_accuracy", "independent_problem_solving", "journaling_quality"]',
 '["self_paced_modules", "journaling", "personal_projects", "reflection_exercises", "solo_research", "self_assessment", "meditation", "goal_tracking"]'),

('naturalistic', 'Naturalistic Learners', 'प्रकृतिवादी शिक्षार्थी',
 'Learn best through nature, real-world connections, classification, and environmental context. They see patterns in nature and relate concepts to the natural world.',
 '🌿', '#10b981', 8,
 '["nature_observation", "classification_ability", "real_world_connection", "environmental_awareness", "pattern_in_nature", "ecosystem_thinking"]',
 '["nature_walks", "field_observations", "classification_exercises", "real_world_case_studies", "environmental_projects", "outdoor_learning", "gardening", "ecology_labs"]')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 2. EDUCATION LEVELS (Class 1 to Master's)
-- ============================================================================

CREATE TABLE public.education_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    name_hindi TEXT,
    level_order INTEGER NOT NULL, -- 1, 2, 3... for sorting
    level_group TEXT NOT NULL CHECK (level_group IN (
        'primary', 'upper_primary', 'secondary', 'higher_secondary',
        'undergraduate', 'postgraduate', 'doctoral', 'professional'
    )),
    age_range TEXT, -- '5-6', '6-7', etc.
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.education_levels (code, name, name_hindi, level_order, level_group, age_range) VALUES
-- Primary (Class 1-5)
('class_1', 'Class 1', 'कक्षा 1', 1, 'primary', '5-6'),
('class_2', 'Class 2', 'कक्षा 2', 2, 'primary', '6-7'),
('class_3', 'Class 3', 'कक्षा 3', 3, 'primary', '7-8'),
('class_4', 'Class 4', 'कक्षा 4', 4, 'primary', '8-9'),
('class_5', 'Class 5', 'कक्षा 5', 5, 'primary', '9-10'),
-- Upper Primary (Class 6-8)
('class_6', 'Class 6', 'कक्षा 6', 6, 'upper_primary', '10-11'),
('class_7', 'Class 7', 'कक्षा 7', 7, 'upper_primary', '11-12'),
('class_8', 'Class 8', 'कक्षा 8', 8, 'upper_primary', '12-13'),
-- Secondary / Madhyamik (Class 9-10)
('class_9', 'Class 9', 'कक्षा 9', 9, 'secondary', '13-14'),
('class_10', 'Class 10 (Madhyamik)', 'कक्षा 10 (माध्यमिक)', 10, 'secondary', '14-15'),
-- Higher Secondary (Class 11-12)
('class_11', 'Class 11', 'कक्षा 11', 11, 'higher_secondary', '15-16'),
('class_12', 'Class 12 (HS)', 'कक्षा 12 (उच्च माध्यमिक)', 12, 'higher_secondary', '16-17'),
-- Undergraduate
('ug_year_1', 'Bachelor Year 1', 'स्नातक वर्ष 1', 13, 'undergraduate', '17-18'),
('ug_year_2', 'Bachelor Year 2', 'स्नातक वर्ष 2', 14, 'undergraduate', '18-19'),
('ug_year_3', 'Bachelor Year 3', 'स्नातक वर्ष 3', 15, 'undergraduate', '19-20'),
('ug_year_4', 'Bachelor Year 4 (Hons)', 'स्नातक वर्ष 4 (ऑनर्स)', 16, 'undergraduate', '20-21'),
-- Postgraduate
('pg_year_1', 'Master Year 1', 'स्नातकोत्तर वर्ष 1', 17, 'postgraduate', '21-22'),
('pg_year_2', 'Master Year 2', 'स्नातकोत्तर वर्ष 2', 18, 'postgraduate', '22-23'),
-- Doctoral
('phd', 'Ph.D / Doctoral', 'पी.एच.डी / डॉक्टरेट', 19, 'doctoral', '23+'),
-- Professional
('competitive_prep', 'Competitive Exam Prep', 'प्रतियोगी परीक्षा', 20, 'professional', 'Any')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 3. STYLE EVALUATION SYSTEM
-- ============================================================================

-- Evaluation templates — questions/tasks that measure each learning style
CREATE TABLE public.style_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL, -- null = general
    education_level_code TEXT REFERENCES public.education_levels(code),
    evaluation_name TEXT NOT NULL,
    description TEXT,
    estimated_minutes INTEGER DEFAULT 15,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Each evaluation has multiple questions targeting different styles
CREATE TABLE public.style_evaluation_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evaluation_id UUID NOT NULL REFERENCES public.style_evaluations(id) ON DELETE CASCADE,
    question_number INTEGER NOT NULL,
    question_type TEXT NOT NULL CHECK (question_type IN (
        'scenario_choice', -- "How would you prefer to learn this?"
        'task_performance', -- "Complete this task" (measures how they approach it)
        'preference_rank',  -- "Rank these options 1-4"
        'self_assessment',  -- "How strongly do you agree?"
        'observation_task', -- "Look at this and describe what you notice"
        'comprehension_test' -- "Read/watch/do, then answer"
    )),
    question_text TEXT NOT NULL,
    question_media_url TEXT, -- image, audio, video URL
    options JSONB NOT NULL DEFAULT '[]', -- each option maps to a style with weight
    -- options format: [{ "text": "...", "style_code": "visual_spatial", "weight": 3 }, ...]
    correct_answer JSONB, -- for comprehension tests
    time_limit_seconds INTEGER,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Student evaluation attempts
CREATE TABLE public.style_evaluation_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    evaluation_id UUID NOT NULL REFERENCES public.style_evaluations(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    answers JSONB NOT NULL DEFAULT '[]',
    -- answers format: [{ "question_id": "...", "selected_option_index": 0, "time_taken_seconds": 12, "response_data": {} }]
    style_scores JSONB, -- computed: { "visual_spatial": 85, "auditory_musical": 60, ... }
    primary_style TEXT REFERENCES public.learning_styles_master(code),
    secondary_style TEXT REFERENCES public.learning_styles_master(code),
    confidence_score NUMERIC(5,2), -- how confident we are in the assignment (0-100)
    status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'expired')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. LEARNING STYLE TEAMS (Per Subject)
-- ============================================================================

CREATE TABLE public.learning_style_teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    style_code TEXT NOT NULL REFERENCES public.learning_styles_master(code),
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL, -- null = general/all
    education_level_code TEXT REFERENCES public.education_levels(code),
    board_code TEXT, -- optional board affiliation
    team_name TEXT NOT NULL, -- "Visual Learners - Mathematics - Class 5"
    description TEXT,
    curriculum_config JSONB NOT NULL DEFAULT '{}', -- how to deliver curriculum to this team
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(style_code, subject_id, education_level_code, board_code)
);

-- Students assigned to teams
CREATE TABLE public.team_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES public.learning_style_teams(id) ON DELETE CASCADE,
    style_code TEXT NOT NULL REFERENCES public.learning_styles_master(code),
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    evaluation_id UUID REFERENCES public.style_evaluation_attempts(id), -- which eval placed them
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    style_strength NUMERIC(5,2) DEFAULT 0, -- 0-100 how strongly they fit
    is_current BOOLEAN DEFAULT true, -- students can be re-evaluated
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, subject_id, is_current) -- one active team per subject per student
);

-- ============================================================================
-- 5. STYLE-MAPPED CURRICULUM
-- ============================================================================

-- For each (subject, chapter, learning_style) we store HOW to teach it
CREATE TABLE public.style_curriculum_mapping (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    chapter_id UUID REFERENCES public.chapters(id) ON DELETE CASCADE, -- null = subject-level
    topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE, -- null = chapter-level
    style_code TEXT NOT NULL REFERENCES public.learning_styles_master(code),
    education_level_code TEXT REFERENCES public.education_levels(code),

    -- Content delivery configuration
    primary_teaching_methods TEXT[] NOT NULL DEFAULT '{}', -- method codes from teaching_methods
    content_format TEXT[] NOT NULL DEFAULT '{}', -- 'video', 'diagram', 'text', 'audio', 'interactive', 'hands_on'
    ai_guru_method TEXT, -- default method for AI Guru when teaching this topic to this style
    ai_guru_prompt_prefix TEXT, -- extra instructions for AI when teaching this style

    -- Resources
    resource_urls JSONB DEFAULT '[]', -- [{type: 'video', url: '...', title: '...'}]
    activity_types TEXT[] DEFAULT '{}', -- preferred activity types for this style

    -- Progression
    estimated_hours NUMERIC(5,1),
    prerequisite_topics UUID[],
    mastery_criteria JSONB DEFAULT '{}', -- what "mastery" looks like for this style

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(subject_id, chapter_id, topic_id, style_code, education_level_code)
);

-- ============================================================================
-- 6. STUDENT LIFECYCLE PROGRESS
-- ============================================================================

CREATE TABLE public.lifecycle_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    education_level_code TEXT NOT NULL REFERENCES public.education_levels(code),
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    style_code TEXT REFERENCES public.learning_styles_master(code),

    -- Progress tracking
    chapters_completed INTEGER DEFAULT 0,
    chapters_total INTEGER DEFAULT 0,
    topics_mastered INTEGER DEFAULT 0,
    topics_total INTEGER DEFAULT 0,
    current_chapter_id UUID REFERENCES public.chapters(id),
    current_topic_id UUID REFERENCES public.topics(id),

    -- Performance
    avg_comprehension NUMERIC(5,2) DEFAULT 0, -- 0-100
    avg_evaluation_score NUMERIC(5,2) DEFAULT 0,
    total_study_hours NUMERIC(8,1) DEFAULT 0,
    streak_days INTEGER DEFAULT 0,

    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('not_started', 'active', 'completed', 'on_hold')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, education_level_code, subject_id)
);

-- ============================================================================
-- 7. COMPREHENSION MEASUREMENT
-- ============================================================================

-- Adaptive comprehension tests that adjust to student level
CREATE TABLE public.comprehension_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id),
    chapter_id UUID REFERENCES public.chapters(id),
    topic_id UUID REFERENCES public.topics(id),
    style_code TEXT REFERENCES public.learning_styles_master(code),
    education_level_code TEXT REFERENCES public.education_levels(code),

    -- Evaluation type
    eval_type TEXT NOT NULL CHECK (eval_type IN (
        'pre_assessment',    -- before learning (baseline)
        'checkpoint',        -- during learning
        'post_assessment',   -- after completing topic
        'mastery_test',      -- final mastery evaluation
        'style_discovery',   -- to determine learning style fit
        'periodic_review'    -- spaced review to check retention
    )),

    -- Questions & answers
    questions JSONB NOT NULL DEFAULT '[]',
    -- format: [{
    --   id, text, type: 'mcq'|'short'|'explain'|'apply'|'create'|'analyze',
    --   bloom_level, options?, correct_answer, points, style_indicators: {}
    -- }]
    answers JSONB DEFAULT '[]',

    -- Scoring (multi-dimensional)
    score_knowledge NUMERIC(5,2) DEFAULT 0,     -- Bloom: Remember
    score_comprehension NUMERIC(5,2) DEFAULT 0,  -- Bloom: Understand
    score_application NUMERIC(5,2) DEFAULT 0,    -- Bloom: Apply
    score_analysis NUMERIC(5,2) DEFAULT 0,       -- Bloom: Analyze
    score_evaluation NUMERIC(5,2) DEFAULT 0,     -- Bloom: Evaluate
    score_creation NUMERIC(5,2) DEFAULT 0,       -- Bloom: Create
    overall_score NUMERIC(5,2) DEFAULT 0,

    -- Style signals from this evaluation
    style_signals JSONB DEFAULT '{}', -- { "visual_spatial": 0.8, "logical_mathematical": 0.6, ... }

    -- Meta
    time_taken_minutes INTEGER,
    ai_feedback TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 8. STYLE TRANSITION LOG (students may change teams over time)
-- ============================================================================

CREATE TABLE public.style_transitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id),
    from_style TEXT REFERENCES public.learning_styles_master(code),
    to_style TEXT NOT NULL REFERENCES public.learning_styles_master(code),
    reason TEXT NOT NULL CHECK (reason IN (
        'initial_assessment', 'periodic_reassessment', 'teacher_override',
        'self_request', 'performance_based', 'ai_recommendation'
    )),
    evaluation_id UUID REFERENCES public.style_evaluation_attempts(id),
    confidence_score NUMERIC(5,2),
    notes TEXT,
    transitioned_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_style_eval_questions_eval ON public.style_evaluation_questions(evaluation_id);
CREATE INDEX idx_style_eval_attempts_user ON public.style_evaluation_attempts(user_id);
CREATE INDEX idx_style_eval_attempts_subject ON public.style_evaluation_attempts(subject_id);
CREATE INDEX idx_team_memberships_user ON public.team_memberships(user_id);
CREATE INDEX idx_team_memberships_team ON public.team_memberships(team_id);
CREATE INDEX idx_team_memberships_style ON public.team_memberships(style_code);
CREATE INDEX idx_style_curriculum_subject ON public.style_curriculum_mapping(subject_id);
CREATE INDEX idx_style_curriculum_style ON public.style_curriculum_mapping(style_code);
CREATE INDEX idx_lifecycle_progress_user ON public.lifecycle_progress(user_id);
CREATE INDEX idx_lifecycle_progress_level ON public.lifecycle_progress(education_level_code);
CREATE INDEX idx_comprehension_user ON public.comprehension_evaluations(user_id);
CREATE INDEX idx_comprehension_subject ON public.comprehension_evaluations(subject_id);
CREATE INDEX idx_style_transitions_user ON public.style_transitions(user_id);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.learning_styles_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.style_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.style_evaluation_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.style_evaluation_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_style_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.style_curriculum_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lifecycle_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comprehension_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.style_transitions ENABLE ROW LEVEL SECURITY;

-- Public read for reference tables
CREATE POLICY "Everyone can read learning styles" ON public.learning_styles_master FOR SELECT USING (true);
CREATE POLICY "Everyone can read education levels" ON public.education_levels FOR SELECT USING (true);
CREATE POLICY "Everyone can read evaluations" ON public.style_evaluations FOR SELECT USING (true);
CREATE POLICY "Everyone can read evaluation questions" ON public.style_evaluation_questions FOR SELECT USING (true);
CREATE POLICY "Everyone can read teams" ON public.learning_style_teams FOR SELECT USING (true);
CREATE POLICY "Everyone can read curriculum mapping" ON public.style_curriculum_mapping FOR SELECT USING (true);

-- User-specific data
CREATE POLICY "Users manage own evaluation attempts" ON public.style_evaluation_attempts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own team memberships" ON public.team_memberships FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users manage own lifecycle progress" ON public.lifecycle_progress FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own comprehension evals" ON public.comprehension_evaluations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own style transitions" ON public.style_transitions FOR SELECT USING (auth.uid() = user_id);

-- Teachers can manage team memberships
CREATE POLICY "Teachers manage team memberships" ON public.team_memberships FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'teacher'
    )
);

-- Teachers can create comprehension evaluations
CREATE POLICY "Teachers manage comprehension evals" ON public.comprehension_evaluations FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'teacher'
    )
);

-- Teachers can manage curriculum mappings
CREATE POLICY "Teachers manage curriculum mappings" ON public.style_curriculum_mapping FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'teacher'
    )
);

-- Teachers can log style transitions
CREATE POLICY "Teachers manage style transitions" ON public.style_transitions FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'teacher'
    )
);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to compute learning style scores from evaluation answers
CREATE OR REPLACE FUNCTION compute_style_scores(p_attempt_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_scores JSONB := '{}';
    v_answer RECORD;
    v_question RECORD;
    v_option JSONB;
    v_style TEXT;
    v_weight NUMERIC;
    v_totals JSONB := '{}';
    v_max_possible JSONB := '{}';
BEGIN
    -- Get all answers for this attempt
    FOR v_answer IN
        SELECT a.value AS answer_data, q.*
        FROM style_evaluation_attempts att,
             jsonb_array_elements(att.answers) a,
             style_evaluation_questions q
        WHERE att.id = p_attempt_id
          AND q.id = (a.value->>'question_id')::UUID
    LOOP
        -- Get the selected option
        v_option := v_answer.options->((v_answer.answer_data->>'selected_option_index')::INTEGER);

        IF v_option IS NOT NULL AND v_option->>'style_code' IS NOT NULL THEN
            v_style := v_option->>'style_code';
            v_weight := COALESCE((v_option->>'weight')::NUMERIC, 1);

            -- Accumulate scores
            v_totals := jsonb_set(
                v_totals,
                ARRAY[v_style],
                to_jsonb(COALESCE((v_totals->>v_style)::NUMERIC, 0) + v_weight)
            );
        END IF;
    END LOOP;

    -- Normalize to 0-100
    -- Find the max possible score per style
    SELECT jsonb_object_agg(style, GREATEST(score, 1))
    INTO v_max_possible
    FROM (
        SELECT v_style AS style, SUM(v_weight) AS score
        FROM (SELECT DISTINCT ON (key) key, value FROM jsonb_each(v_totals)) sub,
             LATERAL (SELECT sub.key AS v_style, GREATEST((sub.value)::NUMERIC, 1) AS v_weight) lat
        GROUP BY v_style
    ) agg;

    RETURN v_totals;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-assign student to team based on evaluation
CREATE OR REPLACE FUNCTION assign_student_to_team(
    p_user_id UUID,
    p_subject_id UUID,
    p_evaluation_attempt_id UUID
) RETURNS UUID AS $$
DECLARE
    v_style_scores JSONB;
    v_primary_style TEXT;
    v_secondary_style TEXT;
    v_max_score NUMERIC := 0;
    v_second_max NUMERIC := 0;
    v_style TEXT;
    v_score NUMERIC;
    v_team_id UUID;
    v_membership_id UUID;
    v_level_code TEXT;
BEGIN
    -- Get scores from the attempt
    SELECT style_scores, primary_style
    INTO v_style_scores, v_primary_style
    FROM style_evaluation_attempts
    WHERE id = p_evaluation_attempt_id;

    IF v_style_scores IS NULL THEN
        RETURN NULL;
    END IF;

    -- Find primary and secondary styles
    FOR v_style, v_score IN SELECT key, value::NUMERIC FROM jsonb_each_text(v_style_scores)
    LOOP
        IF v_score > v_max_score THEN
            v_second_max := v_max_score;
            v_secondary_style := v_primary_style;
            v_max_score := v_score;
            v_primary_style := v_style;
        ELSIF v_score > v_second_max THEN
            v_second_max := v_score;
            v_secondary_style := v_style;
        END IF;
    END LOOP;

    -- Get student's education level
    SELECT COALESCE(p.education_level, 'class_5')
    INTO v_level_code
    FROM profiles p WHERE p.id = p_user_id;

    -- Find or create team
    SELECT id INTO v_team_id
    FROM learning_style_teams
    WHERE style_code = v_primary_style
      AND (subject_id = p_subject_id OR (subject_id IS NULL AND p_subject_id IS NULL))
      AND education_level_code = v_level_code
      AND is_active = true
    LIMIT 1;

    IF v_team_id IS NULL THEN
        INSERT INTO learning_style_teams (style_code, subject_id, education_level_code, team_name)
        VALUES (
            v_primary_style, p_subject_id, v_level_code,
            (SELECT name FROM learning_styles_master WHERE code = v_primary_style) || ' Team'
        )
        RETURNING id INTO v_team_id;
    END IF;

    -- Deactivate previous membership for this subject
    UPDATE team_memberships
    SET is_current = false
    WHERE user_id = p_user_id
      AND (subject_id = p_subject_id OR (subject_id IS NULL AND p_subject_id IS NULL))
      AND is_current = true;

    -- Create new membership
    INSERT INTO team_memberships (user_id, team_id, style_code, subject_id, evaluation_id, style_strength)
    VALUES (p_user_id, v_team_id, v_primary_style, p_subject_id, p_evaluation_attempt_id, v_max_score)
    RETURNING id INTO v_membership_id;

    -- Log transition
    INSERT INTO style_transitions (user_id, subject_id, to_style, reason, evaluation_id, confidence_score)
    VALUES (p_user_id, p_subject_id, v_primary_style, 'initial_assessment', p_evaluation_attempt_id, v_max_score);

    -- Update attempt
    UPDATE style_evaluation_attempts
    SET primary_style = v_primary_style,
        secondary_style = v_secondary_style,
        confidence_score = v_max_score,
        status = 'completed',
        completed_at = NOW()
    WHERE id = p_evaluation_attempt_id;

    RETURN v_membership_id;
END;
$$ LANGUAGE plpgsql;

-- Add education_level to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS
    education_level TEXT DEFAULT 'class_5' REFERENCES public.education_levels(code);
