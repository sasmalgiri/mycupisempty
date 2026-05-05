-- ============================================================================
-- Migration 029: Past papers ingestion + mock test engine
--
-- past_papers              Real published exam papers we ingest from public
--                          archives. Schema is metadata-only — the questions
--                          themselves go into chapter_question_bank with
--                          source='past_paper' and source_paper_year + label.
-- mock_tests               A timed simulation of a real paper. Composed from
--                          chapter_question_bank rows. Generated per-student
--                          on demand so two students don't see the same set
--                          (anti-share).
-- mock_test_attempts       Append-only record of each attempt + score breakdown.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.past_papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_code TEXT NOT NULL REFERENCES public.curriculum_boards(code),
  class_level INTEGER NOT NULL CHECK (class_level BETWEEN 1 AND 12),
  subject_slug TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'bn',
  exam_label TEXT NOT NULL,                          -- 'WBBSE Madhyamik 2024 Math'
  year INTEGER NOT NULL,
  total_marks INTEGER,
  duration_minutes INTEGER,
  source_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (board_code, class_level, subject_slug, year, language)
);

CREATE INDEX IF NOT EXISTS idx_past_papers_lookup
  ON public.past_papers(board_code, class_level, subject_slug, year DESC);

ALTER TABLE public.past_papers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone read past papers" ON public.past_papers;
CREATE POLICY "anyone read past papers" ON public.past_papers
  FOR SELECT USING (TRUE);

CREATE TABLE IF NOT EXISTS public.mock_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  board_code TEXT NOT NULL REFERENCES public.curriculum_boards(code),
  class_level INTEGER NOT NULL,
  subject_slug TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'bn',
  -- Question composition: array of { question_id, marks, type } from the qbank
  questions JSONB NOT NULL,
  total_marks INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mock_tests_user
  ON public.mock_tests(user_id, generated_at DESC);

ALTER TABLE public.mock_tests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self all mock tests" ON public.mock_tests;
CREATE POLICY "self all mock tests" ON public.mock_tests
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.mock_test_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mock_test_id UUID NOT NULL REFERENCES public.mock_tests(id) ON DELETE CASCADE,
  -- answers: { question_id: { answer, time_ms, paste_detected, blur_count } }
  answers JSONB NOT NULL DEFAULT '{}',
  -- per_question_marks: { question_id: marks_awarded }
  per_question_marks JSONB DEFAULT '{}',
  total_marks_awarded INTEGER,
  total_marks_available INTEGER NOT NULL,
  duration_seconds INTEGER,
  -- Anti-cheat aggregate
  paste_count INTEGER DEFAULT 0,
  blur_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'graded', 'abandoned')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  graded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mock_attempts_user
  ON public.mock_test_attempts(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_mock_attempts_mock
  ON public.mock_test_attempts(mock_test_id);

ALTER TABLE public.mock_test_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self all mock attempts" ON public.mock_test_attempts;
CREATE POLICY "self all mock attempts" ON public.mock_test_attempts
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- Tricks ↔ chapter linkage helper view: which tricks reference which chapters?
-- (tricks.related_topic_ids is already an array; this view makes it queryable.)
-- ============================================================================

CREATE OR REPLACE VIEW public.v_chapter_trick_links AS
SELECT
  ch.id AS chapter_id,
  ch.title_en AS chapter_title,
  scc.subject_slug,
  scc.class_level,
  scc.board_code,
  t.id AS trick_id,
  t.title AS trick_title,
  t.category AS trick_category,
  t.helpful_count
FROM public.curriculum_chapters ch
JOIN public.curriculum_subjects_by_class scc ON scc.id = ch.subject_class_id
JOIN public.tricks t ON ch.id = ANY(t.related_topic_ids)
WHERE t.is_archived = FALSE;
