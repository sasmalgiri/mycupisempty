-- ============================================================================
-- MyCupIsEmpty — Whole-Student Development OS
-- Migration 008: 4-Pillar Student Development System
--
-- Pillars: Academic (existing) | Cognitive | Character & Emotional | Life Readiness
-- Domains: Learn | Think | Grow | Live | Path
-- ============================================================================

-- ============================================================================
-- 1. HOLISTIC STUDENT PROFILE — The real learner profile
-- ============================================================================

CREATE TABLE public.student_development_profile (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,

    -- === COGNITIVE DIMENSIONS ===
    focus_score NUMERIC(5,2) DEFAULT 50,             -- 0-100
    memory_habits_score NUMERIC(5,2) DEFAULT 50,
    reasoning_score NUMERIC(5,2) DEFAULT 50,
    problem_solving_score NUMERIC(5,2) DEFAULT 50,
    reflection_score NUMERIC(5,2) DEFAULT 50,
    decision_making_score NUMERIC(5,2) DEFAULT 50,
    self_learning_score NUMERIC(5,2) DEFAULT 50,
    curiosity_score NUMERIC(5,2) DEFAULT 50,

    -- === CHARACTER & EMOTIONAL DIMENSIONS ===
    discipline_score NUMERIC(5,2) DEFAULT 50,
    patience_score NUMERIC(5,2) DEFAULT 50,
    honesty_score NUMERIC(5,2) DEFAULT 50,
    empathy_score NUMERIC(5,2) DEFAULT 50,
    responsibility_score NUMERIC(5,2) DEFAULT 50,
    consistency_score NUMERIC(5,2) DEFAULT 50,
    failure_handling_score NUMERIC(5,2) DEFAULT 50,   -- resilience
    confidence_score NUMERIC(5,2) DEFAULT 50,
    emotional_regulation_score NUMERIC(5,2) DEFAULT 50,
    social_conduct_score NUMERIC(5,2) DEFAULT 50,

    -- === LIFE READINESS DIMENSIONS ===
    communication_score NUMERIC(5,2) DEFAULT 50,
    financial_awareness_score NUMERIC(5,2) DEFAULT 50,
    digital_safety_score NUMERIC(5,2) DEFAULT 50,
    time_management_score NUMERIC(5,2) DEFAULT 50,
    real_world_problem_solving_score NUMERIC(5,2) DEFAULT 50,
    career_awareness_score NUMERIC(5,2) DEFAULT 50,
    teamwork_score NUMERIC(5,2) DEFAULT 50,
    practical_skills_score NUMERIC(5,2) DEFAULT 50,

    -- === PILLAR COMPOSITES (computed) ===
    cognitive_composite NUMERIC(5,2) GENERATED ALWAYS AS (
        (focus_score + memory_habits_score + reasoning_score + problem_solving_score +
         reflection_score + decision_making_score + self_learning_score + curiosity_score) / 8
    ) STORED,
    character_composite NUMERIC(5,2) GENERATED ALWAYS AS (
        (discipline_score + patience_score + honesty_score + empathy_score +
         responsibility_score + consistency_score + failure_handling_score +
         confidence_score + emotional_regulation_score + social_conduct_score) / 10
    ) STORED,
    life_readiness_composite NUMERIC(5,2) GENERATED ALWAYS AS (
        (communication_score + financial_awareness_score + digital_safety_score +
         time_management_score + real_world_problem_solving_score + career_awareness_score +
         teamwork_score + practical_skills_score) / 8
    ) STORED,

    -- === LEARNER ARCHETYPE TAGS ===
    -- Not labels, just patterns observed: e.g. 'high_curiosity_low_discipline',
    -- 'strong_memory_weak_confidence', 'creative_learner_weak_structure'
    archetype_tags JSONB DEFAULT '[]',

    -- === STRENGTHS & GROWTH AREAS ===
    top_strengths JSONB DEFAULT '[]',     -- [{dimension, score, evidence}]
    growth_areas JSONB DEFAULT '[]',      -- [{dimension, score, suggestion}]

    -- Metadata
    last_assessed_at TIMESTAMPTZ,
    assessment_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. DEVELOPMENT DIMENSIONS — Master reference table
-- ============================================================================

CREATE TABLE public.development_dimensions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    name_hindi TEXT,
    pillar TEXT NOT NULL CHECK (pillar IN ('academic', 'cognitive', 'character', 'life_readiness')),
    domain TEXT NOT NULL CHECK (domain IN ('learn', 'think', 'grow', 'live', 'path')),
    description TEXT,
    age_min INTEGER DEFAULT 5,        -- minimum age this applies
    age_max INTEGER DEFAULT 25,       -- maximum age
    assessment_method TEXT,            -- 'self_report', 'behavioral', 'scenario', 'observation', 'reflection'
    growth_strategies JSONB DEFAULT '[]',
    display_order INTEGER DEFAULT 0,
    icon TEXT,
    color TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed the 26 development dimensions
INSERT INTO public.development_dimensions (code, name, name_hindi, pillar, domain, description, assessment_method, icon, color, display_order) VALUES
-- Cognitive (Think)
('focus', 'Focus & Attention', 'ध्यान और एकाग्रता', 'cognitive', 'think', 'Ability to sustain attention and avoid distractions during learning', 'behavioral', '🎯', '#3b82f6', 1),
('memory_habits', 'Memory Habits', 'स्मृति आदतें', 'cognitive', 'think', 'Use of effective memory techniques like spaced repetition and retrieval practice', 'behavioral', '🧠', '#8b5cf6', 2),
('reasoning', 'Reasoning', 'तर्क', 'cognitive', 'think', 'Logical and critical thinking applied to new problems', 'scenario', '🔍', '#6366f1', 3),
('problem_solving', 'Problem Solving', 'समस्या समाधान', 'cognitive', 'think', 'Breaking down and solving unfamiliar problems step by step', 'scenario', '🧩', '#14b8a6', 4),
('reflection', 'Reflection', 'आत्म-चिंतन', 'cognitive', 'think', 'Looking back on what worked, what did not, and why', 'self_report', '🪞', '#f59e0b', 5),
('decision_making', 'Decision Making', 'निर्णय लेना', 'cognitive', 'think', 'Making thoughtful choices when faced with options or tradeoffs', 'scenario', '⚖️', '#ec4899', 6),
('self_learning', 'Self-Learning Ability', 'स्व-अध्ययन', 'cognitive', 'think', 'Ability to learn independently without constant guidance', 'behavioral', '📚', '#22c55e', 7),
('curiosity', 'Curiosity', 'जिज्ञासा', 'cognitive', 'think', 'Asking questions, exploring beyond what is taught, wanting to know more', 'behavioral', '🔭', '#f97316', 8),

-- Character & Emotional (Grow)
('discipline', 'Discipline', 'अनुशासन', 'character', 'grow', 'Following through on commitments and maintaining routines', 'behavioral', '📏', '#ef4444', 9),
('patience', 'Patience', 'धैर्य', 'character', 'grow', 'Ability to wait, persist through difficulty without giving up', 'behavioral', '⏳', '#f59e0b', 10),
('honesty', 'Honesty & Integrity', 'ईमानदारी', 'character', 'grow', 'Being truthful in self-assessment, not cutting corners', 'observation', '💎', '#3b82f6', 11),
('empathy', 'Empathy', 'सहानुभूति', 'character', 'grow', 'Understanding and respecting the feelings and perspectives of others', 'scenario', '💗', '#ec4899', 12),
('responsibility', 'Responsibility', 'जिम्मेदारी', 'character', 'grow', 'Taking ownership of one''s actions, work, and commitments', 'behavioral', '🛡️', '#6366f1', 13),
('consistency', 'Consistency', 'निरंतरता', 'character', 'grow', 'Showing up regularly, maintaining steady effort over time', 'behavioral', '📈', '#22c55e', 14),
('failure_handling', 'Handling Failure', 'असफलता से सीखना', 'character', 'grow', 'Responding to setbacks with resilience rather than giving up', 'reflection', '🔥', '#f97316', 15),
('confidence', 'Confidence', 'आत्मविश्वास', 'character', 'grow', 'Healthy self-belief without arrogance, willingness to attempt hard things', 'self_report', '💪', '#8b5cf6', 16),
('emotional_regulation', 'Emotional Regulation', 'भावनात्मक नियंत्रण', 'character', 'grow', 'Managing emotions during stress, tests, conflicts, and disappointments', 'self_report', '🧘', '#14b8a6', 17),
('social_conduct', 'Social Conduct', 'सामाजिक व्यवहार', 'character', 'grow', 'Respectful behavior, teamwork, listening, cooperation', 'observation', '🤝', '#3b82f6', 18),

-- Life Readiness (Live + Path)
('communication', 'Communication', 'संवाद', 'life_readiness', 'live', 'Expressing ideas clearly in speaking and writing', 'scenario', '🗣️', '#8b5cf6', 19),
('financial_awareness', 'Financial Basics', 'वित्तीय जागरूकता', 'life_readiness', 'live', 'Understanding money, saving, spending, and basic financial concepts', 'scenario', '💰', '#22c55e', 20),
('digital_safety', 'Digital Safety', 'डिजिटल सुरक्षा', 'life_readiness', 'live', 'Safe and responsible use of technology and internet', 'scenario', '🔒', '#ef4444', 21),
('time_management', 'Time Management', 'समय प्रबंधन', 'life_readiness', 'live', 'Planning, prioritizing, and using time effectively', 'behavioral', '⏰', '#f59e0b', 22),
('real_world_problem_solving', 'Real-World Problem Solving', 'व्यावहारिक समस्या समाधान', 'life_readiness', 'live', 'Applying knowledge to practical everyday situations', 'scenario', '🌍', '#6366f1', 23),
('career_awareness', 'Career Awareness', 'करियर जागरूकता', 'life_readiness', 'path', 'Understanding different careers, own interests, and strengths', 'self_report', '🧭', '#ec4899', 24),
('teamwork', 'Teamwork', 'टीमवर्क', 'life_readiness', 'live', 'Working effectively with others, contributing, and supporting', 'observation', '👥', '#14b8a6', 25),
('practical_skills', 'Practical Skills', 'व्यावहारिक कौशल', 'life_readiness', 'live', 'Hands-on abilities applicable to real life beyond academics', 'scenario', '🔧', '#f97316', 26);

-- ============================================================================
-- 3. HABIT TRACKER — Daily/weekly habit tracking for character development
-- ============================================================================

CREATE TABLE public.habit_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    name_hindi TEXT,
    description TEXT,
    pillar TEXT NOT NULL CHECK (pillar IN ('cognitive', 'character', 'life_readiness')),
    dimension_code TEXT REFERENCES public.development_dimensions(code),
    frequency TEXT DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly', 'custom')),
    default_target INTEGER DEFAULT 1,   -- times per frequency period
    age_min INTEGER DEFAULT 5,
    age_max INTEGER DEFAULT 25,
    icon TEXT,
    is_system BOOLEAN DEFAULT true,     -- system-suggested vs user-created
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed core habits
INSERT INTO public.habit_definitions (code, name, name_hindi, pillar, dimension_code, frequency, icon) VALUES
-- Cognitive habits
('daily_reading', 'Read for 20 minutes', '20 मिनट पढ़ना', 'cognitive', 'self_learning', 'daily', '📖'),
('focus_session', 'Complete a focus session without distractions', 'बिना ध्यान भटकाए सत्र पूरा करें', 'cognitive', 'focus', 'daily', '🎯'),
('reflect_learning', 'Write what I learned today', 'आज क्या सीखा लिखें', 'cognitive', 'reflection', 'daily', '🪞'),
('ask_question', 'Ask a thoughtful question', 'एक अच्छा सवाल पूछें', 'cognitive', 'curiosity', 'daily', '❓'),
('practice_recall', 'Practice recall without looking', 'बिना देखे याद करने की कोशिश करें', 'cognitive', 'memory_habits', 'daily', '🧠'),

-- Character habits
('on_time', 'Start study on time', 'समय पर पढ़ाई शुरू करें', 'character', 'discipline', 'daily', '⏰'),
('complete_task', 'Finish what I started', 'जो शुरू किया उसे पूरा करें', 'character', 'responsibility', 'daily', '✅'),
('help_someone', 'Help a classmate or family member', 'किसी की मदद करें', 'character', 'empathy', 'daily', '🤝'),
('stay_calm', 'Stay calm when frustrated', 'गुस्सा आने पर शांत रहें', 'character', 'emotional_regulation', 'daily', '🧘'),
('honest_assessment', 'Rate myself honestly (not inflated)', 'ईमानदारी से अपना मूल्यांकन करें', 'character', 'honesty', 'daily', '💎'),
('try_hard_thing', 'Attempt something difficult', 'कुछ कठिन करने की कोशिश करें', 'character', 'confidence', 'daily', '💪'),
('bounce_back', 'Recover from a mistake without giving up', 'गलती से हार न मानें', 'character', 'failure_handling', 'weekly', '🔥'),

-- Life readiness habits
('plan_day', 'Plan my day before starting', 'दिन की शुरुआत से पहले योजना बनाएं', 'life_readiness', 'time_management', 'daily', '📋'),
('explain_idea', 'Explain an idea to someone clearly', 'किसी को एक विचार स्पष्ट रूप से समझाएं', 'life_readiness', 'communication', 'daily', '🗣️'),
('save_money', 'Think about a saving decision', 'बचत के बारे में सोचें', 'life_readiness', 'financial_awareness', 'weekly', '💰'),
('digital_check', 'Check: am I using my phone wisely?', 'क्या मैं फोन का सही उपयोग कर रहा हूँ?', 'life_readiness', 'digital_safety', 'daily', '📱');

CREATE TABLE public.habit_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    habit_id UUID NOT NULL REFERENCES public.habit_definitions(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    completed BOOLEAN DEFAULT false,
    notes TEXT,
    quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5), -- self-assessment
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, habit_id, date)
);

CREATE TABLE public.student_habits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    habit_id UUID NOT NULL REFERENCES public.habit_definitions(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    target_count INTEGER DEFAULT 1,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    total_completions INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, habit_id)
);

-- ============================================================================
-- 4. REFLECTION JOURNAL — Structured reflections (not free diary)
-- ============================================================================

CREATE TABLE public.reflection_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

    reflection_type TEXT NOT NULL CHECK (reflection_type IN (
        'daily_review',         -- What did I learn? What was hard? What will I do differently?
        'weekly_review',        -- Weekly patterns and growth
        'failure_reflection',   -- What went wrong and what I learned from it
        'success_reflection',   -- What went right and why
        'goal_review',          -- Am I on track? Do my goals still make sense?
        'gratitude',            -- What am I grateful for today
        'scenario_response',    -- Response to a presented scenario
        'emotion_check',        -- How am I feeling and why
        'mentor_prompt'         -- Teacher/parent assigned reflection
    )),

    prompt_text TEXT,           -- the question/prompt shown
    response_text TEXT,         -- student's response
    dimension_tags TEXT[],      -- which dimensions this relates to

    -- AI-detected signals (optional, from Ollama analysis)
    detected_emotions JSONB DEFAULT '[]',     -- ['frustrated', 'hopeful', 'confused']
    growth_signals JSONB DEFAULT '[]',        -- ['showed_resilience', 'self_aware', 'seeking_help']
    concern_flags JSONB DEFAULT '[]',         -- ['prolonged_frustration', 'isolation', 'low_self_worth']

    is_private BOOLEAN DEFAULT true,          -- only student sees by default
    shared_with_teacher BOOLEAN DEFAULT false,
    shared_with_parent BOOLEAN DEFAULT false,
    teacher_feedback TEXT,
    parent_feedback TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5. SCENARIO ASSESSMENTS — Situation-based character/life evaluation
-- ============================================================================

CREATE TABLE public.scenario_bank (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    pillar TEXT NOT NULL CHECK (pillar IN ('cognitive', 'character', 'life_readiness')),
    dimension_code TEXT REFERENCES public.development_dimensions(code),

    title TEXT NOT NULL,
    scenario_text TEXT NOT NULL,    -- the situation described
    age_min INTEGER DEFAULT 5,
    age_max INTEGER DEFAULT 25,
    education_level_codes TEXT[],   -- which levels this applies to

    options JSONB NOT NULL,
    -- [{text, dimension_scores: {discipline: +5, empathy: +3}, feedback_text, is_growth_choice: bool}]

    debrief_text TEXT,             -- shown after answering — what this scenario was measuring
    cultural_context TEXT DEFAULT 'universal',  -- 'universal', 'indian', 'configurable'

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.scenario_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    scenario_id UUID NOT NULL REFERENCES public.scenario_bank(id) ON DELETE CASCADE,
    selected_option_index INTEGER NOT NULL,
    response_time_seconds INTEGER,
    reflection_text TEXT,          -- optional: why did you choose this?
    dimension_scores_earned JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 6. GOAL SETTING — Student-driven goals across all pillars
-- ============================================================================

CREATE TABLE public.student_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

    pillar TEXT NOT NULL CHECK (pillar IN ('academic', 'cognitive', 'character', 'life_readiness')),
    dimension_code TEXT REFERENCES public.development_dimensions(code),
    domain TEXT CHECK (domain IN ('learn', 'think', 'grow', 'live', 'path')),

    title TEXT NOT NULL,
    description TEXT,
    target_value NUMERIC(5,2),         -- measurable target if applicable
    current_value NUMERIC(5,2) DEFAULT 0,

    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'abandoned')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),

    due_date DATE,
    completed_at TIMESTAMPTZ,
    review_notes TEXT,

    -- Who set it
    set_by TEXT DEFAULT 'student' CHECK (set_by IN ('student', 'teacher', 'parent', 'system')),
    mentor_id UUID REFERENCES public.profiles(id),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 7. STRENGTH & INTEREST DISCOVERY (Path domain)
-- ============================================================================

CREATE TABLE public.strength_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

    assessment_type TEXT NOT NULL CHECK (assessment_type IN (
        'interest_inventory',    -- what topics/activities excite you
        'strength_finder',       -- what are you naturally good at
        'work_style',           -- how do you prefer to work
        'domain_affinity',      -- which domains attract you
        'career_explorer'       -- age-appropriate career awareness
    )),

    questions JSONB NOT NULL,
    answers JSONB NOT NULL,
    results JSONB NOT NULL,
    -- {top_strengths: [], interest_areas: [], suggested_domains: [],
    --  work_style: 'collaborative/independent/structured/creative',
    --  career_clusters: []}

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.student_interests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    interest_area TEXT NOT NULL,     -- 'art', 'technology', 'nature', 'people', 'building', 'organizing'
    strength_level TEXT DEFAULT 'moderate' CHECK (strength_level IN ('emerging', 'moderate', 'strong', 'passionate')),
    evidence JSONB DEFAULT '[]',    -- [{source: 'assessment'|'behavior'|'self_report', detail, date}]
    discovered_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, interest_area)
);

-- ============================================================================
-- 8. DEVELOPMENT EVENTS — Log every development signal across all pillars
-- ============================================================================

CREATE TABLE public.development_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

    pillar TEXT NOT NULL CHECK (pillar IN ('academic', 'cognitive', 'character', 'life_readiness')),
    dimension_code TEXT REFERENCES public.development_dimensions(code),
    domain TEXT CHECK (domain IN ('learn', 'think', 'grow', 'live', 'path')),

    event_type TEXT NOT NULL CHECK (event_type IN (
        'assessment',       -- formal evaluation
        'habit_completion', -- daily habit done
        'reflection',       -- journal entry
        'scenario',         -- scenario-based assessment
        'behavioral',       -- observed behavior (from app usage patterns)
        'goal_progress',    -- progress on a goal
        'mentor_feedback',  -- teacher/parent feedback
        'peer_interaction', -- group/team interaction
        'self_report'       -- student self-assessment
    )),

    score_change NUMERIC(5,2),       -- +/- change to dimension score
    evidence JSONB DEFAULT '{}',     -- what triggered this event
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 9. MENTOR FEEDBACK — Teacher and parent observations
-- ============================================================================

CREATE TABLE public.mentor_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    mentor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    mentor_role TEXT NOT NULL CHECK (mentor_role IN ('teacher', 'parent', 'counselor')),

    pillar TEXT CHECK (pillar IN ('academic', 'cognitive', 'character', 'life_readiness')),
    dimension_code TEXT REFERENCES public.development_dimensions(code),

    feedback_type TEXT NOT NULL CHECK (feedback_type IN (
        'observation',      -- I noticed the student...
        'encouragement',    -- positive reinforcement
        'concern',          -- something to watch
        'suggestion',       -- try doing this...
        'milestone'         -- celebrating a growth moment
    )),

    message TEXT NOT NULL,
    is_visible_to_student BOOLEAN DEFAULT true,
    student_acknowledged BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 10. PARENT CONFIGURATION — What parents can see and configure
-- ============================================================================

CREATE TABLE public.parent_student_link (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    relationship TEXT DEFAULT 'parent' CHECK (relationship IN ('parent', 'guardian', 'caregiver')),

    -- Visibility preferences
    can_see_reflections BOOLEAN DEFAULT false,   -- opt-in only
    can_see_emotions BOOLEAN DEFAULT false,
    can_see_academic BOOLEAN DEFAULT true,
    can_see_character BOOLEAN DEFAULT true,
    can_see_life_readiness BOOLEAN DEFAULT true,
    can_set_goals BOOLEAN DEFAULT true,
    can_give_feedback BOOLEAN DEFAULT true,

    -- Notification preferences
    notify_on_concern BOOLEAN DEFAULT true,
    notify_on_milestone BOOLEAN DEFAULT true,
    notify_weekly_summary BOOLEAN DEFAULT true,

    is_active BOOLEAN DEFAULT true,
    linked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(parent_id, student_id)
);

-- ============================================================================
-- 11. DEVELOPMENT BADGES — Non-academic achievements
-- ============================================================================

CREATE TABLE public.development_badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    name_hindi TEXT,
    description TEXT NOT NULL,
    pillar TEXT NOT NULL CHECK (pillar IN ('cognitive', 'character', 'life_readiness', 'overall')),
    dimension_code TEXT REFERENCES public.development_dimensions(code),
    icon TEXT NOT NULL,
    criteria JSONB NOT NULL,  -- {type: 'streak', count: 7, habit_code: 'on_time'} or {type: 'score', dimension: 'empathy', min: 80}
    rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'legendary')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.student_badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    badge_id UUID NOT NULL REFERENCES public.development_badges(id) ON DELETE CASCADE,
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    evidence JSONB DEFAULT '{}',
    UNIQUE(user_id, badge_id)
);

-- Seed some badges
INSERT INTO public.development_badges (code, name, description, pillar, dimension_code, icon, criteria, rarity) VALUES
('streak_7_discipline', '7-Day Discipline Streak', 'Completed discipline habit 7 days in a row', 'character', 'discipline', '🔥', '{"type":"streak","count":7,"habit_code":"on_time"}', 'common'),
('streak_30_any', '30-Day Champion', 'Maintained any habit for 30 consecutive days', 'overall', NULL, '🏆', '{"type":"streak","count":30}', 'rare'),
('curiosity_explorer', 'Curiosity Explorer', 'Asked 50 thoughtful questions', 'cognitive', 'curiosity', '🔭', '{"type":"count","event":"ask_question","count":50}', 'uncommon'),
('empathy_hero', 'Empathy Hero', 'Helped others 20 times', 'character', 'empathy', '💗', '{"type":"count","event":"help_someone","count":20}', 'uncommon'),
('reflection_master', 'Reflection Master', 'Wrote 30 reflections', 'cognitive', 'reflection', '🪞', '{"type":"count","event":"reflection","count":30}', 'uncommon'),
('resilience_phoenix', 'Phoenix Rising', 'Bounced back from failure 10 times without giving up', 'character', 'failure_handling', '🔥', '{"type":"count","event":"bounce_back","count":10}', 'rare'),
('communicator', 'Clear Communicator', 'Communication score reached 80', 'life_readiness', 'communication', '🗣️', '{"type":"score","dimension":"communication","min":80}', 'uncommon'),
('balanced_growth', 'Balanced Growth', 'All 4 pillar composites above 60', 'overall', NULL, '⚖️', '{"type":"all_pillars","min":60}', 'legendary');

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_dev_profile_user ON public.student_development_profile(user_id);
CREATE INDEX idx_habit_tracking_user_date ON public.habit_tracking(user_id, date);
CREATE INDEX idx_habit_tracking_habit ON public.habit_tracking(habit_id);
CREATE INDEX idx_student_habits_user ON public.student_habits(user_id);
CREATE INDEX idx_reflection_user ON public.reflection_entries(user_id);
CREATE INDEX idx_reflection_type ON public.reflection_entries(reflection_type);
CREATE INDEX idx_scenario_responses_user ON public.scenario_responses(user_id);
CREATE INDEX idx_student_goals_user ON public.student_goals(user_id);
CREATE INDEX idx_student_goals_status ON public.student_goals(status);
CREATE INDEX idx_strength_assessments_user ON public.strength_assessments(user_id);
CREATE INDEX idx_student_interests_user ON public.student_interests(user_id);
CREATE INDEX idx_dev_events_user ON public.development_events(user_id);
CREATE INDEX idx_dev_events_pillar ON public.development_events(pillar);
CREATE INDEX idx_dev_events_dimension ON public.development_events(dimension_code);
CREATE INDEX idx_mentor_feedback_student ON public.mentor_feedback(student_id);
CREATE INDEX idx_parent_link_parent ON public.parent_student_link(parent_id);
CREATE INDEX idx_parent_link_student ON public.parent_student_link(student_id);
CREATE INDEX idx_student_badges_user ON public.student_badges(user_id);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.student_development_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.development_dimensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reflection_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenario_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenario_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strength_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.development_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentor_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_student_link ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.development_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_badges ENABLE ROW LEVEL SECURITY;

-- Public read for reference tables
CREATE POLICY "Everyone can read dimensions" ON public.development_dimensions FOR SELECT USING (true);
CREATE POLICY "Everyone can read habit definitions" ON public.habit_definitions FOR SELECT USING (true);
CREATE POLICY "Everyone can read scenario bank" ON public.scenario_bank FOR SELECT USING (true);
CREATE POLICY "Everyone can read badges" ON public.development_badges FOR SELECT USING (true);

-- Student access to own data
CREATE POLICY "Users manage own dev profile" ON public.student_development_profile FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own habit tracking" ON public.habit_tracking FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own habits" ON public.student_habits FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own reflections" ON public.reflection_entries FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own scenario responses" ON public.scenario_responses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own goals" ON public.student_goals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own strength assessments" ON public.strength_assessments FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own interests" ON public.student_interests FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own dev events" ON public.development_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users see own badges" ON public.student_badges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users see feedback for them" ON public.mentor_feedback FOR SELECT USING (auth.uid() = student_id AND is_visible_to_student = true);

-- Parent access (via link table)
CREATE POLICY "Parents see linked students dev profile" ON public.student_development_profile FOR SELECT USING (
    EXISTS (SELECT 1 FROM parent_student_link WHERE parent_id = auth.uid() AND student_id = user_id AND is_active = true)
);
CREATE POLICY "Parents see linked students goals" ON public.student_goals FOR SELECT USING (
    EXISTS (SELECT 1 FROM parent_student_link WHERE parent_id = auth.uid() AND student_id = user_id AND is_active = true)
);
CREATE POLICY "Parents manage own links" ON public.parent_student_link FOR ALL USING (auth.uid() = parent_id);
CREATE POLICY "Students see own parent links" ON public.parent_student_link FOR SELECT USING (auth.uid() = student_id);

-- Teacher access
CREATE POLICY "Teachers view all dev profiles" ON public.student_development_profile FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
);
CREATE POLICY "Teachers view all dev events" ON public.development_events FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
);
CREATE POLICY "Teachers manage feedback" ON public.mentor_feedback FOR ALL USING (
    auth.uid() = mentor_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
);
CREATE POLICY "Teachers manage goals for students" ON public.student_goals FOR ALL USING (
    auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
);
CREATE POLICY "Teachers view habit tracking" ON public.habit_tracking FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
);
CREATE POLICY "Teachers view reflections shared with them" ON public.reflection_entries FOR SELECT USING (
    shared_with_teacher = true AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
);

-- System insert for events and badges
CREATE POLICY "System inserts dev events" ON public.development_events FOR INSERT WITH CHECK (true);
CREATE POLICY "System inserts badges" ON public.student_badges FOR INSERT WITH CHECK (true);
