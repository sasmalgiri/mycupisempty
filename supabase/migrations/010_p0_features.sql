-- ============================================================================
-- Migration 010: P0 Features — Engagement, Social, Analytics, Growth
-- Streak Freezes, Daily Mix, Live Quiz, Unified XP, Growth Story, etc.
-- ============================================================================

-- ============================================================================
-- 1. STREAK FREEZES
-- ============================================================================

ALTER TABLE public.student_habits ADD COLUMN IF NOT EXISTS
    streak_freezes_available INTEGER DEFAULT 0;
ALTER TABLE public.student_habits ADD COLUMN IF NOT EXISTS
    streak_freezes_used INTEGER DEFAULT 0;
ALTER TABLE public.student_habits ADD COLUMN IF NOT EXISTS
    last_freeze_date DATE;

-- Track freeze usage history
CREATE TABLE public.streak_freeze_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    habit_id UUID REFERENCES public.student_habits(id) ON DELETE SET NULL,
    action TEXT NOT NULL CHECK (action IN ('earned', 'used', 'expired')),
    streak_at_time INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_streak_freeze_user ON public.streak_freeze_log(user_id);
ALTER TABLE public.streak_freeze_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own freeze log" ON public.streak_freeze_log FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 2. DAILY MIX SESSIONS
-- ============================================================================

CREATE TABLE public.daily_mix_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'skipped')),

    -- Mix composition
    spaced_rep_items JSONB DEFAULT '[]',         -- [{item_id, type, topic}]
    new_concept JSONB,                            -- {topic_id, title, subject}
    habit_check JSONB,                            -- {habit_id, name}
    reflection_prompt JSONB,                      -- {type, prompt_text}
    challenge_item JSONB,                         -- {type, question}

    -- Completion tracking
    spaced_rep_completed INTEGER DEFAULT 0,
    spaced_rep_total INTEGER DEFAULT 0,
    new_concept_completed BOOLEAN DEFAULT false,
    habit_checked BOOLEAN DEFAULT false,
    reflection_done BOOLEAN DEFAULT false,
    challenge_done BOOLEAN DEFAULT false,

    -- Results
    xp_earned INTEGER DEFAULT 0,
    time_taken_seconds INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, session_date)
);

CREATE INDEX idx_daily_mix_user ON public.daily_mix_sessions(user_id);
CREATE INDEX idx_daily_mix_date ON public.daily_mix_sessions(session_date);
ALTER TABLE public.daily_mix_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own daily mix" ON public.daily_mix_sessions FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 3. LIVE QUIZ MODE (Kahoot-style)
-- ============================================================================

CREATE TABLE public.live_quizzes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    host_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    classroom_id UUID REFERENCES public.classrooms(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,

    -- Quiz config
    questions JSONB NOT NULL DEFAULT '[]',        -- [{question, options[], correct_index, time_seconds, points}]
    total_questions INTEGER DEFAULT 0,
    time_per_question INTEGER DEFAULT 20,         -- default seconds

    -- State
    status TEXT DEFAULT 'lobby' CHECK (status IN ('lobby', 'active', 'question', 'results', 'finished')),
    current_question INTEGER DEFAULT 0,
    join_code TEXT UNIQUE NOT NULL,
    question_started_at TIMESTAMPTZ,

    -- Settings
    show_leaderboard BOOLEAN DEFAULT true,
    shuffle_options BOOLEAN DEFAULT true,
    allow_late_join BOOLEAN DEFAULT true,
    team_mode BOOLEAN DEFAULT false,

    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.live_quiz_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID NOT NULL REFERENCES public.live_quizzes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    total_score INTEGER DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    avg_response_time_ms INTEGER DEFAULT 0,
    rank INTEGER,
    answers JSONB DEFAULT '[]',                   -- [{question_index, answer_index, is_correct, time_ms, points}]
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(quiz_id, user_id)
);

CREATE INDEX idx_live_quiz_host ON public.live_quizzes(host_id);
CREATE INDEX idx_live_quiz_code ON public.live_quizzes(join_code);
CREATE INDEX idx_live_quiz_status ON public.live_quizzes(status);
CREATE INDEX idx_live_quiz_participants ON public.live_quiz_participants(quiz_id);

ALTER TABLE public.live_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_quiz_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone reads active live quizzes" ON public.live_quizzes FOR SELECT USING (true);
CREATE POLICY "Teachers create live quizzes" ON public.live_quizzes FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
);
CREATE POLICY "Hosts manage own quizzes" ON public.live_quizzes FOR UPDATE USING (host_id = auth.uid());
CREATE POLICY "Hosts delete own quizzes" ON public.live_quizzes FOR DELETE USING (host_id = auth.uid());
CREATE POLICY "Participants see own data" ON public.live_quiz_participants FOR SELECT USING (true);
CREATE POLICY "Users join quizzes" ON public.live_quiz_participants FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own participation" ON public.live_quiz_participants FOR UPDATE USING (user_id = auth.uid());

-- ============================================================================
-- 4. UNIFIED XP EVENTS (All 4 Pillars)
-- ============================================================================

CREATE TABLE public.xp_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    source_pillar TEXT NOT NULL CHECK (source_pillar IN ('academic', 'cognitive', 'character', 'life_readiness', 'engagement')),
    source_action TEXT NOT NULL,                   -- 'topic_mastered', 'habit_completed', 'reflection_written', etc.
    source_id UUID,                                -- reference to the source record
    xp_amount INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_xp_events_user ON public.xp_events(user_id);
CREATE INDEX idx_xp_events_pillar ON public.xp_events(source_pillar);
CREATE INDEX idx_xp_events_date ON public.xp_events(created_at);
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own xp events" ON public.xp_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System inserts xp events" ON public.xp_events FOR INSERT WITH CHECK (true);

-- ============================================================================
-- 5. GROWTH STORY
-- ============================================================================

CREATE TABLE public.growth_stories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    story_type TEXT NOT NULL CHECK (story_type IN ('monthly', 'term', 'annual', 'on_demand')),

    -- Narrative
    narrative_text TEXT NOT NULL,                   -- The AI-generated story
    highlights JSONB DEFAULT '[]',                 -- [{type, description, value}]
    archetype_journey JSONB,                       -- {start_archetypes, end_archetypes, evolution}

    -- Data snapshot at generation time
    academic_snapshot JSONB,                        -- mastery totals, topics mastered, etc.
    development_snapshot JSONB,                     -- dimension scores at start vs end
    engagement_snapshot JSONB,                      -- streaks, sessions, time
    milestones JSONB DEFAULT '[]',                 -- [{date, type, description}]

    -- Sharing
    is_shared_with_parent BOOLEAN DEFAULT false,
    is_shared_with_teacher BOOLEAN DEFAULT false,
    shared_at TIMESTAMPTZ,

    generated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_growth_stories_user ON public.growth_stories(user_id);
CREATE INDEX idx_growth_stories_type ON public.growth_stories(story_type);
ALTER TABLE public.growth_stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own stories" ON public.growth_stories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Parents see shared stories" ON public.growth_stories FOR SELECT USING (
    is_shared_with_parent = true AND EXISTS (
        SELECT 1 FROM parent_student_link WHERE parent_id = auth.uid() AND student_id = user_id AND is_active = true
    )
);
CREATE POLICY "Teachers see shared stories" ON public.growth_stories FOR SELECT USING (
    is_shared_with_teacher = true AND EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher'
    )
);
CREATE POLICY "System inserts stories" ON public.growth_stories FOR INSERT WITH CHECK (true);

-- ============================================================================
-- 6. QUESTION PAPER GENERATOR (Teacher Tool)
-- ============================================================================

CREATE TABLE public.generated_papers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    classroom_id UUID REFERENCES public.classrooms(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    chapter_ids UUID[] DEFAULT '{}',

    -- Config
    total_marks INTEGER NOT NULL,
    duration_minutes INTEGER,
    difficulty_distribution JSONB DEFAULT '{"easy": 30, "medium": 50, "hard": 20}',
    bloom_distribution JSONB DEFAULT '{"remember": 20, "understand": 30, "apply": 30, "analyze": 20}',
    question_type_mix JSONB DEFAULT '{"mcq": 40, "short_answer": 30, "long_answer": 30}',

    -- Generated content
    questions JSONB NOT NULL DEFAULT '[]',          -- [{question_id, question_text, marks, difficulty, bloom, type}]
    answer_key JSONB DEFAULT '[]',                  -- [{question_id, correct_answer, explanation}]

    -- Metadata
    class_level INTEGER,
    is_published BOOLEAN DEFAULT false,
    download_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_generated_papers_teacher ON public.generated_papers(teacher_id);
ALTER TABLE public.generated_papers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers manage own papers" ON public.generated_papers FOR ALL USING (teacher_id = auth.uid());

-- ============================================================================
-- 7. TELEGRAM BOT INTEGRATION
-- ============================================================================

CREATE TABLE public.notification_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('telegram', 'whatsapp', 'email', 'push')),
    channel_id TEXT NOT NULL,                      -- telegram chat_id, email address, etc.
    is_active BOOLEAN DEFAULT true,
    notification_types JSONB DEFAULT '["daily_reminder", "streak_warning", "concern_flag", "weekly_digest"]',
    quiet_hours_start INTEGER,                     -- hour (0-23)
    quiet_hours_end INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, channel)
);

CREATE TABLE public.notification_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    channel TEXT NOT NULL,
    notification_type TEXT NOT NULL,
    message_text TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'delivered')),
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notif_subs_user ON public.notification_subscriptions(user_id);
CREATE INDEX idx_notif_log_user ON public.notification_log(user_id);
CREATE INDEX idx_notif_log_status ON public.notification_log(status);
ALTER TABLE public.notification_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own subscriptions" ON public.notification_subscriptions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own notification log" ON public.notification_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System inserts notifications" ON public.notification_log FOR INSERT WITH CHECK (true);

-- ============================================================================
-- 8. WEAKNESS HEAT MAP DATA VIEW
-- ============================================================================

-- Materialized view for fast heat map rendering
CREATE OR REPLACE VIEW public.student_topic_mastery_map AS
SELECT
    ls.user_id,
    ls.topic_id,
    t.title as topic_title,
    t.topic_number,
    c.title as chapter_title,
    c.chapter_number,
    s.name as subject_name,
    s.id as subject_id,
    ls.mastery_score_recall AS mastery_recall,
    ls.mastery_score_comprehension AS mastery_comprehension,
    ls.mastery_score_application AS mastery_application,
    ls.mastery_score_transfer AS mastery_transfer,
    ls.mastery_score_retention AS mastery_retention,
    ls.mastery_score_metacognition AS mastery_metacognition,
    ls.mastery_score_independence AS mastery_independence,
    ls.mastery_total,
    ls.current_band AS mastery_band,
    ls.support_tier,
    ls.current_module,
    ls.last_active_at
FROM public.learner_state ls
JOIN public.topics t ON ls.topic_id = t.id
JOIN public.chapters c ON t.chapter_id = c.id
JOIN public.subjects s ON c.subject_id = s.id;

-- ============================================================================
-- 9. UPDATE FEATURE FLAGS
-- ============================================================================

INSERT INTO public.feature_flags (flag_key, enabled, phase, description) VALUES
('daily_mix', true, 'phase_a', 'Daily personalized learning session'),
('streak_freezes', true, 'phase_a', 'Streak protection tokens'),
('unstuck_button', true, 'phase_a', 'Context-aware AI help button'),
('weakness_heatmap', true, 'phase_a', 'Topic mastery visualization'),
('growth_story', true, 'phase_a', 'AI-generated development narratives'),
('unified_xp', true, 'phase_a', 'XP from all 4 pillars'),
('socratic_mode', true, 'phase_a', 'Socratic AI prompt mode (default for stuck)'),
('live_quiz', false, 'phase_b', 'Kahoot-style live classroom quizzes'),
('question_paper_gen', false, 'phase_b', 'Auto question paper generator for teachers'),
('telegram_bot', false, 'phase_b', 'Telegram notification integration')
ON CONFLICT (flag_key) DO NOTHING;

-- ============================================================================
-- 10. XP REWARD CONFIG
-- ============================================================================

-- Standard XP values for unified system
INSERT INTO public.safety_config (config_key, config_value, description, is_locked) VALUES
('xp_rewards', '{
    "academic": {
        "topic_mastered": 50,
        "chapter_completed": 100,
        "mastery_checkpoint_passed": 30,
        "diagnostic_completed": 20,
        "retrieval_session": 10,
        "misconception_resolved": 25,
        "perfect_score": 50
    },
    "cognitive": {
        "reflection_written": 20,
        "challenge_completed": 30,
        "activity_completed": 15,
        "focus_session_25min": 20,
        "focus_session_45min": 35
    },
    "character": {
        "habit_completed": 10,
        "habit_streak_7": 30,
        "habit_streak_30": 100,
        "scenario_completed": 25,
        "goal_completed": 40
    },
    "life_readiness": {
        "practical_skill_practiced": 15,
        "teamwork_activity": 20,
        "communication_exercise": 15
    },
    "engagement": {
        "daily_mix_completed": 25,
        "daily_login": 5,
        "weekly_reflection": 30,
        "live_quiz_participation": 20,
        "live_quiz_top3": 50,
        "peer_teaching": 40
    }
}', 'XP reward values for unified cross-pillar system', false)
ON CONFLICT (config_key) DO NOTHING;
