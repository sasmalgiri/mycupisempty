-- ============================================================================
-- Migration 020: FSRS scheduler — replace SM-2 retention math with FSRS
--
-- SM-2 (the algorithm Anki used pre-2023) is reasonable but FSRS beats it by
-- ~20% retention at the same review load (Anki adopted FSRS as default in
-- 2023). We keep the SM-2 columns for a transition period — readers fall back
-- to them when FSRS state hasn't been initialized yet — but every new review
-- writes FSRS state.
--
-- FSRS model: three numbers per card.
--   stability (S) = days until retrievability falls to 90%
--   difficulty (D) = inherent difficulty 1..10 (does NOT decay with reviews)
--   retrievability (R) = computed at read time from S + elapsed days
--
-- We also need a review log for the optimizer (later — once we have ~1000
-- reviews per cohort, run the Python `fsrs` optimizer on this log to refit
-- the 21 weights).
-- ============================================================================

-- Add FSRS state to user_flashcard_progress (the per-user table the live API
-- writes to) AND to flashcards (used by the newer per-user schema in 011).
-- Either column set is harmless if its table isn't actively used.
ALTER TABLE public.user_flashcard_progress
  ADD COLUMN IF NOT EXISTS fsrs_stability   NUMERIC,
  ADD COLUMN IF NOT EXISTS fsrs_difficulty  NUMERIC,
  ADD COLUMN IF NOT EXISTS fsrs_state       TEXT DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS fsrs_reps        INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fsrs_lapses      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_review_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_days   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS elapsed_days     INTEGER DEFAULT 0;

ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS fsrs_stability   NUMERIC,
  ADD COLUMN IF NOT EXISTS fsrs_difficulty  NUMERIC,
  ADD COLUMN IF NOT EXISTS fsrs_state       TEXT DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS fsrs_reps        INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fsrs_lapses      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_review_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_days   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS elapsed_days     INTEGER DEFAULT 0;

-- Index on next_review_at so the daily-mix spaced-rep query stays fast as the
-- table grows.
CREATE INDEX IF NOT EXISTS idx_flashcards_due
  ON public.flashcards(user_id, next_review_at)
  WHERE next_review_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_flashcard_progress_due
  ON public.user_flashcard_progress(user_id, next_review_date)
  WHERE next_review_date IS NOT NULL;

-- Review log — every Again/Hard/Good/Easy lands a row here. Used by:
--   1. Audit (when did this card actually get reviewed?)
--   2. The FSRS optimizer offline (refit 21 weights from review history)
--   3. Honest mastery views ("you've seen this 12 times, last 3 were Good")
CREATE TABLE IF NOT EXISTS public.flashcard_review_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL,  -- references flashcards(id) loosely; we don't FK so
                          -- review history survives card deletion for analysis
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 4),  -- 1=Again 2=Hard 3=Good 4=Easy
  state_before TEXT,
  state_after TEXT,
  stability_before NUMERIC,
  stability_after NUMERIC,
  difficulty_before NUMERIC,
  difficulty_after NUMERIC,
  scheduled_days INTEGER,
  elapsed_days INTEGER,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flashcard_review_log_user
  ON public.flashcard_review_log(user_id, reviewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_flashcard_review_log_card
  ON public.flashcard_review_log(card_id, reviewed_at DESC);

-- RLS: students can only read/write their own review log
ALTER TABLE public.flashcard_review_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "self read review log" ON public.flashcard_review_log;
CREATE POLICY "self read review log" ON public.flashcard_review_log
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "self insert review log" ON public.flashcard_review_log;
CREATE POLICY "self insert review log" ON public.flashcard_review_log
  FOR INSERT WITH CHECK (user_id = auth.uid());
