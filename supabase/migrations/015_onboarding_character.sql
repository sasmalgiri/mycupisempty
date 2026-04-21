-- ============================================================================
-- Migration 015: Onboarding + Character-First Additions
-- Adds the profile columns onboarding writes, plus a convenience view for
-- per-student character growth that UI and parent digest query.
-- ============================================================================

-- Profile columns that onboarding writes
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS character_goal TEXT;

-- Keep profiles.character_goal in sync for fast reads (sourced from signals for history)
CREATE INDEX IF NOT EXISTS idx_profiles_character_goal ON public.profiles(character_goal) WHERE character_goal IS NOT NULL;

-- A character_moment signal type is introduced — no schema change needed
-- since learner_signals accepts free-form signal_type strings.

-- Character XP awards are stored in the existing xp_events table with
-- source_pillar = 'character' — no schema change needed.
