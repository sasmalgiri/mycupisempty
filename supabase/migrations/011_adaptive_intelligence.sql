-- ============================================================================
-- Migration 011: Adaptive Intelligence Layer
-- StudentState signals, Mastery, Calibration, Leagues, Study Plans, Exam Attempts,
-- Rest Days, Generated Practice, Metacognition records, Parent-Student Links
-- ============================================================================

-- ============================================================================
-- 1. LEARNER SIGNALS — unified behavioral signal stream
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.learner_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    signal_type TEXT NOT NULL,              -- 'answer_result', 'mood', 'step_time', etc.
    category TEXT,                          -- 'performance', 'engagement', 'metacognition', 'help_seeking', 'character'
    source TEXT,                            -- 'daily_mix', 'ai_guru', 'flashcard', 'exam_mode', etc.
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    value NUMERIC DEFAULT 0,                -- 0 or 1 for boolean-like, numeric otherwise
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learner_signals_user ON public.learner_signals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learner_signals_type ON public.learner_signals(user_id, signal_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learner_signals_subject ON public.learner_signals(user_id, subject_id, created_at DESC);

ALTER TABLE public.learner_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own signals" ON public.learner_signals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own signals" ON public.learner_signals FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 2. LEARNER PROFILES — richer learner profile beyond learning_styles
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.learner_profiles (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    baseline_profile JSONB DEFAULT '{}',    -- from assessment: mood, speed, curiosity, etc.
    preference_signals JSONB DEFAULT '{}',
    performance_signals JSONB DEFAULT '{}',
    subject_profiles JSONB DEFAULT '{}',    -- per-subject behavioral snapshots
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.learner_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own learner profile" ON public.learner_profiles FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 3. LEARNER SUBJECT PROFILES — finer per-subject snapshots
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.learner_subject_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    best_method TEXT,
    accuracy_trend TEXT,                     -- improving | stable | declining
    mastery_band TEXT,                       -- foundation | emerging | developing | secure | advanced
    confidence_accuracy_gap NUMERIC DEFAULT 0,
    common_errors TEXT[] DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, subject_id)
);

ALTER TABLE public.learner_subject_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own subject profile" ON public.learner_subject_profiles FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 4. PEDAGOGY STATE — misconceptions + frustration per topic
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pedagogy_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    active_misconceptions TEXT[] DEFAULT '{}',
    stalled_cycles INTEGER DEFAULT 0,
    confidence_accuracy_gap NUMERIC DEFAULT 0,
    last_frustration_signal_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, topic_id)
);

ALTER TABLE public.pedagogy_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own pedagogy state" ON public.pedagogy_state FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 5. FLASHCARDS + SM-2 REVIEWS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.flashcards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    hint TEXT,
    difficulty TEXT DEFAULT 'medium',
    card_type TEXT DEFAULT 'concept',       -- definition | concept | formula | example | fact
    source TEXT DEFAULT 'manual',            -- manual | ai_generated | imported
    -- SM-2 state
    ease_factor NUMERIC DEFAULT 2.5,
    interval_days INTEGER DEFAULT 1,
    review_count INTEGER DEFAULT 0,
    next_review_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Reconcile with the flashcards table from 001_initial_schema.
--
-- 001 already created public.flashcards as a topic-scoped card with no owner
-- (id, topic_id, front_text, back_text, card_type, created_at). The CREATE
-- TABLE IF NOT EXISTS above therefore does NOTHING on any database where 001
-- ran — the per-user SM-2 columns are silently skipped, and the index on
-- user_id below fails with "column user_id does not exist".
--
-- This block adds what 011 actually needs, so the migration is correct whether
-- it meets 001's table or its own.
-- ---------------------------------------------------------------------------
ALTER TABLE public.flashcards
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS front TEXT,
    ADD COLUMN IF NOT EXISTS back TEXT,
    ADD COLUMN IF NOT EXISTS hint TEXT,
    ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'medium',
    ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS ease_factor NUMERIC DEFAULT 2.5,
    ADD COLUMN IF NOT EXISTS interval_days INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS next_review_at TIMESTAMPTZ DEFAULT NOW();

-- Carry across 001's column names where rows already exist, so no card is lost.
UPDATE public.flashcards SET front = front_text WHERE front IS NULL AND front_text IS NOT NULL;
UPDATE public.flashcards SET back  = back_text  WHERE back  IS NULL AND back_text  IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_flashcards_user_due ON public.flashcards(user_id, next_review_at);
CREATE INDEX IF NOT EXISTS idx_flashcards_topic ON public.flashcards(topic_id);
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY has no IF NOT EXISTS, and re-running a migration against a
-- database that already has the policy would abort the whole transaction.
DROP POLICY IF EXISTS "Users manage own flashcards" ON public.flashcards;
CREATE POLICY "Users manage own flashcards" ON public.flashcards FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.flashcard_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    flashcard_id UUID REFERENCES public.flashcards(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    quality INTEGER,                        -- SM-2 quality 0..5
    ease_factor NUMERIC,
    interval_days INTEGER,
    reviewed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flashcard_reviews_user ON public.flashcard_reviews(user_id, reviewed_at DESC);
ALTER TABLE public.flashcard_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own flashcard reviews" ON public.flashcard_reviews FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 6. HABIT COMPLETIONS — separate from student_habits for daily tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.habit_completions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    habit_id UUID REFERENCES public.student_habits(id) ON DELETE CASCADE,
    completed_on DATE NOT NULL DEFAULT CURRENT_DATE,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, habit_id, completed_on)
);

CREATE INDEX IF NOT EXISTS idx_habit_completions_user ON public.habit_completions(user_id, completed_on DESC);
ALTER TABLE public.habit_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own habit completions" ON public.habit_completions FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 7. PARENT-STUDENT LINKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.parent_student_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    relationship TEXT DEFAULT 'parent',     -- parent | guardian | mentor
    verified BOOLEAN DEFAULT false,
    linked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(parent_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_parent_links_parent ON public.parent_student_links(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_links_student ON public.parent_student_links(student_id);
ALTER TABLE public.parent_student_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parents see own links" ON public.parent_student_links FOR SELECT USING (auth.uid() = parent_id OR auth.uid() = student_id);
CREATE POLICY "Parents create links" ON public.parent_student_links FOR INSERT WITH CHECK (auth.uid() = parent_id);

-- ============================================================================
-- 8. LEAGUE PARTICIPATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.league_participation (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    opted_in BOOLEAN DEFAULT false,
    display_name TEXT,
    badge_emoji TEXT DEFAULT '🌱',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.league_participation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own league participation" ON public.league_participation FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "All read opted-in league members" ON public.league_participation FOR SELECT USING (opted_in = true);

-- ============================================================================
-- 9. EXAM ATTEMPTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.exam_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    exam_type TEXT NOT NULL,                 -- board | jee_main | neet | ntse | chapter_test | custom
    blueprint JSONB DEFAULT '{}',
    questions JSONB DEFAULT '[]',            -- stored snapshot of question IDs + difficulty + marks
    answers JSONB DEFAULT '{}',
    duration_seconds INTEGER,
    status TEXT DEFAULT 'in_progress',       -- in_progress | completed | abandoned
    score NUMERIC,
    max_score NUMERIC,
    percentage NUMERIC,
    analysis JSONB,                          -- full ExamAnalysis object
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_exam_attempts_user ON public.exam_attempts(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_type ON public.exam_attempts(user_id, exam_type, started_at DESC);
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own exam attempts" ON public.exam_attempts FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 10. REST DAYS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rest_days (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    used INTEGER DEFAULT 0,
    last_used_date DATE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.rest_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own rest days" ON public.rest_days FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 11. STUDY PLANS (autonomous agentic plans)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.study_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_data JSONB NOT NULL,
    target_date DATE,
    adherence NUMERIC,                       -- 0..1 how much of the plan got done
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_plans_user ON public.study_plans(user_id, created_at DESC);
ALTER TABLE public.study_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own study plans" ON public.study_plans FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 12. GENERATED PRACTICE SETS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.generated_practice_sets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    target_pattern TEXT,
    difficulty TEXT,
    questions JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_practice_sets_user ON public.generated_practice_sets(user_id, created_at DESC);
ALTER TABLE public.generated_practice_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own practice sets" ON public.generated_practice_sets FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 13. CHAT SESSIONS + MESSAGES (if not already present)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    title TEXT,
    session_type TEXT DEFAULT 'guru',        -- guru | socratic | exploration | teach_back
    teaching_method TEXT DEFAULT 'feynman',
    difficulty_level INTEGER DEFAULT 5,
    is_beyond_curriculum BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON public.chat_sessions(user_id, created_at DESC);
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own chat sessions" ON public.chat_sessions FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON public.chat_messages(session_id, created_at ASC);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own chat messages" ON public.chat_messages FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.chat_sessions WHERE id = session_id AND user_id = auth.uid())
);
CREATE POLICY "Users insert to own chat sessions" ON public.chat_messages FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.chat_sessions WHERE id = session_id AND user_id = auth.uid())
);

-- ============================================================================
-- 14. USER ANSWERS — unified answer log (referenced by growth-timeline)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    question_id UUID,
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    is_correct BOOLEAN,
    time_spent_seconds INTEGER,
    source TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_answers_user ON public.user_answers(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_answers_topic ON public.user_answers(topic_id);
ALTER TABLE public.user_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own answers" ON public.user_answers FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 15. TOPIC PREREQUISITES — optional column on topics for knowledge graph
-- ============================================================================

ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS prerequisite_ids UUID[] DEFAULT '{}';

-- ============================================================================
-- 16. PEER Q&A with AI moderation
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.peer_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT DEFAULT 'flagged' CHECK (status IN ('approved', 'flagged', 'blocked')),
    moderation_reason TEXT,
    upvotes INTEGER DEFAULT 0,
    answer_count INTEGER DEFAULT 0,
    helpful_answer_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_peer_questions_status ON public.peer_questions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_peer_questions_subject ON public.peer_questions(subject_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_peer_questions_user ON public.peer_questions(user_id);

ALTER TABLE public.peer_questions ENABLE ROW LEVEL SECURITY;
-- Approved questions visible to everyone
CREATE POLICY "Approved peer questions are public" ON public.peer_questions FOR SELECT USING (status = 'approved' OR auth.uid() = user_id);
CREATE POLICY "Users create peer questions" ON public.peer_questions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authors edit own peer questions" ON public.peer_questions FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.peer_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES public.peer_questions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    status TEXT DEFAULT 'flagged' CHECK (status IN ('approved', 'flagged', 'blocked')),
    moderation_reason TEXT,
    moderation_confidence NUMERIC,
    upvotes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_peer_answers_question ON public.peer_answers(question_id, status, upvotes DESC);
CREATE INDEX IF NOT EXISTS idx_peer_answers_user ON public.peer_answers(user_id);

ALTER TABLE public.peer_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved peer answers public" ON public.peer_answers FOR SELECT USING (status = 'approved' OR auth.uid() = user_id);
CREATE POLICY "Users create peer answers" ON public.peer_answers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authors edit own peer answers" ON public.peer_answers FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.peer_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    answer_id UUID NOT NULL REFERENCES public.peer_answers(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, answer_id)
);

ALTER TABLE public.peer_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own votes" ON public.peer_votes FOR ALL USING (auth.uid() = user_id);

-- Increment helper
CREATE OR REPLACE FUNCTION public.increment_peer_answer_count(q_id UUID)
RETURNS void LANGUAGE sql AS $$
  UPDATE public.peer_questions SET answer_count = COALESCE(answer_count, 0) + 1 WHERE id = q_id;
$$;

-- ============================================================================
-- 17. INTEGRATION TOKENS — Google Classroom, Microsoft Teams, etc.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.integration_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,                  -- google_classroom | microsoft_teams
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    scopes TEXT[] DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

ALTER TABLE public.integration_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own integration tokens" ON public.integration_tokens FOR ALL USING (auth.uid() = user_id);

-- Classrooms: add external provider mirroring fields
ALTER TABLE public.classrooms ADD COLUMN IF NOT EXISTS external_id TEXT UNIQUE;
ALTER TABLE public.classrooms ADD COLUMN IF NOT EXISTS external_provider TEXT;

-- ============================================================================
-- 18. FOCUS LEVEL signals — tagged under learner_signals (no schema change needed)
-- signal_type='focus_level', category='engagement', source='focus_monitor'
-- ============================================================================
