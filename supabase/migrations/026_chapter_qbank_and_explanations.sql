-- ============================================================================
-- Migration 026: Per-chapter exhaustive Q&A bank + on-demand re-explanations
--
-- Two new tables:
--
--   chapter_question_bank     Every plausible school-exam question per chapter,
--                             with model answer + step-by-step working. Covers
--                             MCQ / very-short / short / long / application /
--                             HOTS / match / fill-blank / true-false.
--                             Source flag distinguishes ai_generated from
--                             authored from past_paper. Confidence tracked
--                             so admin verify can upgrade rows.
--
--   chapter_explanations      Per-student, per-chapter on-demand alternate
--                             explanations. When a student says "I don't get
--                             it", /api/explain generates a fresh original
--                             walkthrough — never reproduces textbook prose,
--                             always tagged with the persona snapshot it was
--                             tailored for. Cached per student-chapter so a
--                             repeat ask reads the cache, not the model.
--
-- Plus a coverage view so admin can spot holes ("Class 10 Math Ch 3 has
-- only 4 questions; should be ~16").
-- ============================================================================

-- ============================================================================
-- 1. Question bank
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.chapter_question_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES public.curriculum_chapters(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES public.curriculum_topics(id) ON DELETE SET NULL,

  -- The question itself + the model answer + the worked-out solution.
  -- working is what a student would actually write on paper / see step-by-step.
  question_text TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  working TEXT,

  -- For MCQ: 4 options; correct_index 0..3. NULL for non-MCQ.
  options JSONB,
  correct_index INTEGER,

  question_type TEXT NOT NULL CHECK (question_type IN (
    'mcq', 'very_short', 'short', 'long',
    'application', 'hots', 'match', 'fill_blank', 'true_false'
  )),
  marks INTEGER NOT NULL CHECK (marks BETWEEN 1 AND 10),
  difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  -- Bloom's taxonomy 1=remember .. 6=create
  cognitive_level INTEGER NOT NULL DEFAULT 2 CHECK (cognitive_level BETWEEN 1 AND 6),

  -- Provenance + verification
  source TEXT NOT NULL DEFAULT 'ai_generated' CHECK (source IN ('ai_generated', 'authored', 'past_paper', 'imported')),
  source_paper_year INTEGER,                -- when source='past_paper', e.g. 2024
  source_paper_label TEXT,                  -- e.g. 'WBBSE Madhyamik 2024 Math'
  confidence NUMERIC NOT NULL DEFAULT 0.5 CHECK (confidence BETWEEN 0 AND 1),
  verified_by UUID,
  verified_at TIMESTAMPTZ,

  language TEXT NOT NULL DEFAULT 'bn',
  tags TEXT[] DEFAULT '{}',                 -- 'commercial_math', 'word_problem', 'proof', etc.

  -- Honest-flag: student-flagged as wrong / unclear / off-topic. Drives the
  -- admin verify queue.
  flag_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qbank_chapter
  ON public.chapter_question_bank(chapter_id, question_type, difficulty);

CREATE INDEX IF NOT EXISTS idx_qbank_topic
  ON public.chapter_question_bank(topic_id) WHERE topic_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_qbank_unverified
  ON public.chapter_question_bank(verified_at NULLS FIRST, source) WHERE source = 'ai_generated';

-- RLS: students can read; only authenticated service role / verified admin
-- writes (no INSERT policy → only service_role bypass can populate).
ALTER TABLE public.chapter_question_bank ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone read qbank" ON public.chapter_question_bank;
CREATE POLICY "anyone read qbank" ON public.chapter_question_bank
  FOR SELECT USING (TRUE);   -- public-read; only seeded content lives here

-- Optional: students can flag a question for review
DROP POLICY IF EXISTS "anyone update flag count" ON public.chapter_question_bank;
-- Don't expose UPDATE; flagging happens via /api/qbank with a service_role-backed RPC

-- ============================================================================
-- 2. Per-student on-demand re-explanations
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.chapter_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES public.curriculum_chapters(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES public.curriculum_topics(id) ON DELETE SET NULL,

  -- What style was the explanation? Drives whether we can reuse the cache
  -- (a 'story' explanation isn't a substitute for a 'numerical_walkthrough').
  style TEXT NOT NULL CHECK (style IN ('analogy', 'step_by_step', 'story', 'visual_described', 'numerical_walkthrough', 'predict_then_reveal')),

  -- The student's confusion in their own words. Optional but useful — the
  -- next regeneration can address this directly.
  confusion_note TEXT,

  -- Snapshot of the persona we tailored to. Lets us audit later: "Aryabhata
  -- generated this story-style explanation when Priya was visual-strong but
  -- effort-tolerance low."
  persona_snapshot JSONB NOT NULL DEFAULT '{}',

  body_md TEXT NOT NULL,
  helpful BOOLEAN,                          -- student rates after reading
  helpful_rated_at TIMESTAMPTZ,

  -- Source: which model + which chapter context was used. Always AI here;
  -- this is explicitly for fresh, non-textbook explanations.
  generator TEXT NOT NULL DEFAULT 'gemini',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_explanations_user_chapter
  ON public.chapter_explanations(user_id, chapter_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_explanations_user_topic
  ON public.chapter_explanations(user_id, topic_id, generated_at DESC) WHERE topic_id IS NOT NULL;

ALTER TABLE public.chapter_explanations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self all explanations" ON public.chapter_explanations;
CREATE POLICY "self all explanations" ON public.chapter_explanations
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 3. Coverage view — which chapters need more questions?
--
-- Run ad-hoc:
--   SELECT * FROM v_qbank_coverage WHERE class_level = 10 ORDER BY total_questions ASC;
-- ============================================================================

CREATE OR REPLACE VIEW public.v_qbank_coverage AS
SELECT
  ch.id                 AS chapter_id,
  ch.title_en           AS chapter_title,
  scc.subject_slug,
  scc.class_level,
  scc.board_code,
  scc.language,
  COUNT(qb.id)                                                              AS total_questions,
  COUNT(qb.id) FILTER (WHERE qb.question_type = 'mcq')                      AS mcq_count,
  COUNT(qb.id) FILTER (WHERE qb.question_type = 'very_short')               AS very_short_count,
  COUNT(qb.id) FILTER (WHERE qb.question_type = 'short')                    AS short_count,
  COUNT(qb.id) FILTER (WHERE qb.question_type = 'long')                     AS long_count,
  COUNT(qb.id) FILTER (WHERE qb.question_type IN ('application', 'hots'))   AS hots_count,
  COUNT(qb.id) FILTER (WHERE qb.difficulty = 'hard')                        AS hard_count,
  COUNT(qb.id) FILTER (WHERE qb.verified_at IS NOT NULL)                    AS verified_count,
  COUNT(qb.id) FILTER (WHERE qb.source = 'past_paper')                      AS past_paper_count,
  COUNT(qb.id) FILTER (WHERE qb.flag_count > 0)                             AS flagged_count
FROM public.curriculum_chapters ch
JOIN public.curriculum_subjects_by_class scc ON scc.id = ch.subject_class_id
LEFT JOIN public.chapter_question_bank qb ON qb.chapter_id = ch.id
GROUP BY ch.id, ch.title_en, scc.subject_slug, scc.class_level, scc.board_code, scc.language;

-- ============================================================================
-- 4. Helper: bump flag_count when a student flags a question (SECURITY DEFINER
-- so we don't need to grant UPDATE on chapter_question_bank to authenticated).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.flag_qbank_question(p_question_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chapter_question_bank
  SET flag_count = flag_count + 1, updated_at = NOW()
  WHERE id = p_question_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.flag_qbank_question(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flag_qbank_question(UUID) TO authenticated;
