-- ============================================================================
-- Migration 014: Cross-Subject Quests + Session Reflections
-- ============================================================================

-- ============================================================================
-- 1. QUESTS — multi-subject challenges co-designed by companions
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.quests (
    id TEXT PRIMARY KEY,                 -- deterministic id from generator
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    theme TEXT,
    narrative TEXT,
    steps JSONB NOT NULL,                -- array of QuestStep
    progress JSONB DEFAULT '{}',         -- map of stepOrder -> { completed, submission, completedAt }
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
    xp_reward INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_quests_user ON public.quests(user_id, status, created_at DESC);
ALTER TABLE public.quests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own quests" ON public.quests FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 2. SESSION REFLECTIONS — 15-second end-of-session pulse
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.session_reflections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_kind TEXT,                   -- daily_mix | companion_chat | lab | exam | assignment
    session_id TEXT,                     -- opaque ID of the originating session
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    usefulness INTEGER CHECK (usefulness BETWEEN 1 AND 5),
    understood TEXT,                      -- optional "something you understood"
    confusing TEXT,                       -- optional "something still confusing"
    difficulty_felt TEXT CHECK (difficulty_felt IN ('too_easy', 'just_right', 'too_hard') OR difficulty_felt IS NULL),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_reflections_user ON public.session_reflections(user_id, created_at DESC);
ALTER TABLE public.session_reflections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own reflections" ON public.session_reflections FOR ALL USING (auth.uid() = user_id);
