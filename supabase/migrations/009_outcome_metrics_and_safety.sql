-- ============================================================================
-- Migration 009: Outcome Metrics + Safety Boundaries + MVP Config
-- This is the FINAL schema migration before production build.
-- ============================================================================

-- ============================================================================
-- 1. OUTCOME METRICS — How we know the system works
-- ============================================================================

CREATE TABLE public.outcome_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id),
    topic_id UUID REFERENCES public.topics(id),

    -- When this snapshot was taken
    snapshot_type TEXT NOT NULL CHECK (snapshot_type IN (
        'weekly', 'monthly', 'topic_end', 'chapter_end', 'term_end', 'on_demand'
    )),

    -- Academic outcomes
    mastery_total NUMERIC(5,2),
    mastery_band TEXT,
    comprehension_gain NUMERIC(5,2),          -- delta since last snapshot
    retention_after_delay NUMERIC(5,2),       -- delayed check score
    error_reduction_pct NUMERIC(5,2),         -- % fewer errors vs last period
    time_to_mastery_minutes NUMERIC(8,1),     -- total time to reach mastery for topic
    topics_mastered_count INTEGER DEFAULT 0,
    topics_attempted_count INTEGER DEFAULT 0,

    -- Engagement outcomes
    sessions_count INTEGER DEFAULT 0,
    total_time_minutes NUMERIC(8,1) DEFAULT 0,
    streak_days INTEGER DEFAULT 0,
    session_completion_rate NUMERIC(5,2),      -- % of sessions completed (not abandoned)
    engagement_consistency NUMERIC(5,2),       -- 0-100, based on daily activity regularity

    -- Cognitive/metacognitive outcomes
    confidence_calibration NUMERIC(5,2),       -- how accurate is self-assessment
    self_regulation_score NUMERIC(5,2),
    hint_dependence_rate NUMERIC(5,2),
    scaffold_level_at_end INTEGER,

    -- Development outcomes (non-academic)
    cognitive_composite NUMERIC(5,2),
    character_composite NUMERIC(5,2),
    life_readiness_composite NUMERIC(5,2),
    habits_completed_count INTEGER DEFAULT 0,
    reflections_count INTEGER DEFAULT 0,
    goals_completed_count INTEGER DEFAULT 0,

    -- Support tier at snapshot time
    support_tier INTEGER DEFAULT 1,
    misconception_count INTEGER DEFAULT 0,
    misconceptions_resolved INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_outcomes_user ON public.outcome_snapshots(user_id);
CREATE INDEX idx_outcomes_type ON public.outcome_snapshots(snapshot_type);
CREATE INDEX idx_outcomes_date ON public.outcome_snapshots(created_at);

ALTER TABLE public.outcome_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own outcomes" ON public.outcome_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Teachers see all outcomes" ON public.outcome_snapshots FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
);
CREATE POLICY "Parents see linked child outcomes" ON public.outcome_snapshots FOR SELECT USING (
    EXISTS (SELECT 1 FROM parent_student_link WHERE parent_id = auth.uid() AND student_id = user_id AND is_active = true)
);
CREATE POLICY "System inserts outcomes" ON public.outcome_snapshots FOR INSERT WITH CHECK (true);

-- ============================================================================
-- 2. SAFETY & ETHICS CONFIGURATION
-- ============================================================================

CREATE TABLE public.safety_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key TEXT UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    is_locked BOOLEAN DEFAULT false,  -- locked = cannot be overridden by school/parent
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.safety_config (config_key, config_value, description, is_locked) VALUES
-- Core safety rules (LOCKED — cannot be overridden)
('no_mental_health_diagnosis', '{"enabled": true, "rule": "System must NEVER diagnose mental health conditions. Concern flags trigger human review only."}', 'The system detects patterns but never diagnoses. Flags go to teachers/parents.', true),
('no_ideology_shaping', '{"enabled": true, "rule": "No political, religious, or ideological content in character development. Character = self-management, respect, accountability, kindness, persistence, practical wisdom."}', 'Character development is universal values only, never ideological.', true),
('no_moral_policing', '{"enabled": true, "rule": "System does not judge moral choices. Scenario assessments present options and explain tradeoffs, never declare right/wrong on values."}', 'No moral judgment, only growth-oriented feedback.', true),
('no_permanent_labels', '{"enabled": true, "rule": "Archetype tags are patterns, not labels. They change as the student grows. Never shown as fixed identity. Never used for sorting/ranking students."}', 'All classification is temporary and growth-oriented.', true),
('age_appropriate_only', '{"enabled": true, "rule": "All content, scenarios, reflections, and habit tracking must be age-appropriate. Age ranges are enforced on all content tables.", "min_tracking_age": 5, "emotion_tracking_min_age": 8, "career_awareness_min_age": 12}', 'Content and tracking respects developmental stage.', true),
('data_minimization', '{"enabled": true, "rule": "Collect only what is needed for learning improvement. No surveillance. No tracking outside learning sessions. No location data."}', 'Minimum viable data collection.', true),
('student_data_ownership', '{"enabled": true, "rule": "Students can see all data collected about them. Students can request deletion. Reflections are private by default."}', 'Students own their data.', true),

-- Configurable by school/parent
('parent_visibility_defaults', '{"can_see_reflections": false, "can_see_emotions": false, "can_see_academic": true, "can_see_character": true, "can_see_life_readiness": true}', 'Default parent visibility settings. Parents must opt-in for reflections/emotions.', false),
('teacher_visibility_defaults', '{"can_see_reflections_shared": true, "can_see_habit_tracking": true, "can_see_concern_flags": true, "can_see_archetype_tags": false}', 'Default teacher visibility. Archetype tags hidden from teachers by default.', false),
('character_tracking_enabled', '{"enabled": true, "configurable_by": "school"}', 'Schools can disable character tracking if they prefer academics-only.', false),
('life_readiness_tracking_enabled', '{"enabled": true, "configurable_by": "school"}', 'Schools can disable life readiness tracking.', false),
('concern_escalation_rules', '{"auto_flag_teacher": true, "auto_flag_parent": false, "parent_notification_requires_consent": true, "urgent_always_flags_teacher": true}', 'Who gets notified when concern flags are raised.', false);

ALTER TABLE public.safety_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone reads safety config" ON public.safety_config FOR SELECT USING (true);
CREATE POLICY "Only admins update safety config" ON public.safety_config FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
) WITH CHECK (is_locked = false); -- cannot update locked rules

-- ============================================================================
-- 3. MVP FEATURE FLAGS
-- ============================================================================

CREATE TABLE public.feature_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flag_key TEXT UNIQUE NOT NULL,
    enabled BOOLEAN DEFAULT false,
    phase TEXT DEFAULT 'phase_a' CHECK (phase IN ('phase_a', 'phase_b', 'phase_c', 'future')),
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.feature_flags (flag_key, enabled, phase, description) VALUES
-- Phase A: MVP (build now)
('academic_engine', true, 'phase_a', 'Pedagogy engine with 8 modules — full'),
('subjects_math', true, 'phase_a', 'Mathematics subject'),
('subjects_science', true, 'phase_a', 'Science subject'),
('classes_6_to_8', true, 'phase_a', 'Classes 6, 7, 8'),
('cognitive_partial', true, 'phase_a', 'Cognitive pillar — focus, memory, reasoning, reflection only'),
('habit_tracking', true, 'phase_a', 'Basic daily habit tracking'),
('reflection_journal', true, 'phase_a', 'Daily/weekly reflections'),
('confidence_tracking', true, 'phase_a', 'Confidence calibration scoring'),
('consistency_tracking', true, 'phase_a', 'Consistency scoring from habits'),
('spaced_repetition', true, 'phase_a', 'SM-2 spaced repetition'),
('mastery_checkpoints', true, 'phase_a', 'Topic-end mastery checks'),
('ai_guru_ollama', true, 'phase_a', 'AI Guru with Ollama'),
('outcome_tracking', true, 'phase_a', 'Weekly outcome snapshots'),

-- Phase B: Pilot (test with 20-100 students)
('parent_dashboard', false, 'phase_b', 'Parent view of child development'),
('teacher_development_view', false, 'phase_b', 'Teacher development dashboard'),
('scenario_assessments', false, 'phase_b', 'Scenario-based character assessment'),
('goal_setting', false, 'phase_b', 'Student and parent goal setting'),
('mentor_feedback', false, 'phase_b', 'Teacher/parent feedback system'),
('badges', false, 'phase_b', 'Development badges'),
('concern_flags', false, 'phase_b', 'Auto-detection of concern patterns'),
('subjects_english', false, 'phase_b', 'English subject'),
('classes_9_10', false, 'phase_b', 'Classes 9, 10'),

-- Phase C: Production expansion
('full_character_pillar', false, 'phase_c', 'All 10 character dimensions active'),
('full_life_readiness', false, 'phase_c', 'All 8 life readiness dimensions active'),
('path_discovery', false, 'phase_c', 'Strength/interest/career discovery'),
('domain_affinities', false, 'phase_c', 'Career domain matching'),
('all_classes', false, 'phase_c', 'Classes 1-12 + higher education'),
('all_subjects', false, 'phase_c', 'All subjects beyond Math/Science/English'),
('multilingual', false, 'phase_c', 'Hindi + regional language support'),
('parent_goal_setting', false, 'phase_c', 'Parents can set goals for children'),

-- Future
('private_study_vault', false, 'future', 'Private encrypted study space'),
('peer_learning', false, 'future', 'Peer collaboration features'),
('school_admin_dashboard', false, 'future', 'School-level analytics'),
('api_for_schools', false, 'future', 'External API for school integration');

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone reads feature flags" ON public.feature_flags FOR SELECT USING (true);
