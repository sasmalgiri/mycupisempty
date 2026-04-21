-- ============================================================================
-- Migration 012: Companions, Virtual Labs, Assignments, Maturity Profiles
-- ============================================================================

-- ============================================================================
-- 1. MATURITY PROFILES — per student × per subject
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.maturity_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    composite_score INTEGER NOT NULL,         -- 0-100
    band SMALLINT NOT NULL CHECK (band BETWEEN 1 AND 5),
    dimensions JSONB DEFAULT '{}',            -- cognitive, selfDirection, persistence, etc.
    confidence NUMERIC,                        -- 0-1
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_maturity_user ON public.maturity_profiles(user_id);
ALTER TABLE public.maturity_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own maturity" ON public.maturity_profiles FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 2. COMPANION SESSIONS + TURNS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.companion_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    companion_id TEXT NOT NULL,                -- 'aryabhata', 'kalam', etc.
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_companion_sessions_user ON public.companion_sessions(user_id, subject_id, started_at DESC);
ALTER TABLE public.companion_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own companion sessions" ON public.companion_sessions FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.companion_turns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.companion_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companion_turns_session ON public.companion_turns(session_id, created_at ASC);
ALTER TABLE public.companion_turns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own companion turns" ON public.companion_turns FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 3. COMPANION MEMORY — long-term summary per student × subject
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.companion_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    companion_id TEXT,
    summary TEXT,
    key_topics TEXT[] DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, subject_id)
);

ALTER TABLE public.companion_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own companion memory" ON public.companion_memory FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 4. LAB ATTEMPTS — student submissions to lab challenges
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.lab_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    challenge_id TEXT NOT NULL,                -- from LAB_CHALLENGE_LIBRARY.id
    attempts INTEGER DEFAULT 0,
    best_score NUMERIC DEFAULT 0,
    last_score NUMERIC DEFAULT 0,
    correct BOOLEAN DEFAULT FALSE,
    submission JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, challenge_id)
);

CREATE INDEX IF NOT EXISTS idx_lab_attempts_user ON public.lab_attempts(user_id, updated_at DESC);
ALTER TABLE public.lab_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own lab attempts" ON public.lab_attempts FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 5. ASSIGNMENTS — AI-generated, per chapter × subject × student × style × maturity
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    chapter_id UUID REFERENCES public.chapters(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    assignment_data JSONB NOT NULL,            -- full tasks, rubric, objectives
    submissions JSONB,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'graded', 'expired')),
    grade INTEGER,                              -- 0-100
    feedback JSONB,                             -- AI grading output
    maturity_band SMALLINT,
    learning_style TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    due_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    graded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_assignments_user ON public.assignments(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignments_subject ON public.assignments(user_id, subject_id, created_at DESC);
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own assignments" ON public.assignments FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 6. Signal type whitelist expansion — breakthroughs now tracked
-- (no schema change — learner_signals accepts free-form signal_type)
-- ============================================================================
