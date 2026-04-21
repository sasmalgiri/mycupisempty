-- ============================================================================
-- Migration 013: Self-Learning Brain
--   1. Companion memory v2 (structured)
--   2. Main-brain directives (cross-subject orchestration)
--   3. Experiences (every adaptive decision we make + its outcome)
--   4. Learned priors (aggregate across all students — privacy-safe)
-- ============================================================================

-- ============================================================================
-- 1. COMPANION MEMORY v2 — structured JSONB column on the existing table
-- ============================================================================

ALTER TABLE public.companion_memory
  ADD COLUMN IF NOT EXISTS memory_v2 JSONB;

-- ============================================================================
-- 2. BRAIN DIRECTIVES — one row per student, current active set
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.brain_directives (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    directives JSONB DEFAULT '[]',
    cross_patterns JSONB DEFAULT '[]',
    recommended_focus TEXT,
    overall_sentiment TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.brain_directives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own directives" ON public.brain_directives FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 3. EXPERIENCES — every adaptive decision + outcome
--
-- Keyed on user_id but aggregated globally by (context_key, action_key).
-- context_key is a coarse bucket like "math|middle|b3|neutral", so many
-- students map to the same key and priors sharpen with scale.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.experiences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,                     -- intervention | method_choice | companion_tone | ...
    context_key TEXT NOT NULL,              -- coarse context bucket
    action_key TEXT NOT NULL,               -- the action we picked
    reward NUMERIC DEFAULT 0,               -- -1..1 (higher = better outcome)
    resolved BOOLEAN DEFAULT FALSE,         -- has outcome landed yet?
    metadata JSONB DEFAULT '{}',
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_experiences_user ON public.experiences(user_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_experiences_context ON public.experiences(context_key, action_key, resolved);
CREATE INDEX IF NOT EXISTS idx_experiences_resolved_at ON public.experiences(resolved, resolved_at DESC) WHERE resolved = TRUE;

ALTER TABLE public.experiences ENABLE ROW LEVEL SECURITY;
-- Users can only see their own experiences
CREATE POLICY "Users read own experiences" ON public.experiences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own experiences" ON public.experiences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own experiences" ON public.experiences FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- 4. LEARNED PRIORS — aggregate rewards per (context, action)
-- These are derived from experiences and are READ-ONLY by users
-- (all users benefit from the aggregate wisdom).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.learned_priors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    context_key TEXT NOT NULL,
    action_key TEXT NOT NULL,
    mean_reward NUMERIC DEFAULT 0,
    sample_size INTEGER DEFAULT 0,
    confidence NUMERIC DEFAULT 0,           -- 0..1 (grows with sample size)
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(context_key, action_key)
);

CREATE INDEX IF NOT EXISTS idx_priors_context ON public.learned_priors(context_key, mean_reward DESC);

ALTER TABLE public.learned_priors ENABLE ROW LEVEL SECURITY;
-- Priors are global readable (aggregate wisdom benefits every user)
CREATE POLICY "All users read learned priors" ON public.learned_priors FOR SELECT USING (true);
-- Only authenticated users can update priors (via the aggregator)
CREATE POLICY "Authenticated users update priors" ON public.learned_priors FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users upsert priors" ON public.learned_priors FOR UPDATE USING (auth.role() = 'authenticated');
