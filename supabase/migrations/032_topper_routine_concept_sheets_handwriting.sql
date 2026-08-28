-- ============================================================================
-- Migration 032: Topper-track tables
--
-- Closes the audit gap "what would actually move a Class 5 student to first
-- in class". Adds:
--
-- 1. concept_sheets       Per-chapter × persona × method one-page must-know
-- 2. handwriting_attempts Photo + OCR + score for written practice
-- 3. spelling_drill_words Curated word list per class+language (Bengali first)
-- 4. spelling_attempts    Per-student attempt log for the daily drill
-- 5. school_papers        Parent-uploaded school-specific PYQ (not board-level)
-- 6. parent_artifacts.kind extension: 'primary_dinner_card'
-- 7. topper_score view    Composite metric used by dashboard headline tile
-- 8. v_yesterdays_mistake view — pulls each user's lowest-score eval from
--    the last day so the dashboard "redo your mistake" card has zero logic.
-- ============================================================================

-- 1. Concept sheets ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.concept_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES public.curriculum_chapters(id) ON DELETE CASCADE,
  language TEXT NOT NULL DEFAULT 'bn',
  -- learning style this sheet is tailored for. NULL = generic.
  learning_style TEXT CHECK (learning_style IN ('visual','auditory','reading','kinesthetic','mixed')),
  -- persona axis this sheet leans into. NULL = generic.
  persona_axis TEXT CHECK (persona_axis IN ('high_perfectionist','low_effort','curious','social','quiet','impatient','steady')),
  must_know JSONB NOT NULL DEFAULT '[]',          -- [{ fact, why_it_matters, example }]
  formulas JSONB NOT NULL DEFAULT '[]',           -- [{ name, formula_md, when_to_use }]
  common_mistakes JSONB NOT NULL DEFAULT '[]',    -- [{ mistake, why_wrong, fix }]
  exam_pattern_tip TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generator TEXT NOT NULL DEFAULT 'gemini',
  UNIQUE (chapter_id, language, learning_style, persona_axis)
);

CREATE INDEX IF NOT EXISTS idx_concept_sheets_chapter
  ON public.concept_sheets(chapter_id, language);

ALTER TABLE public.concept_sheets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone read concept sheets" ON public.concept_sheets;
CREATE POLICY "anyone read concept sheets" ON public.concept_sheets FOR SELECT USING (TRUE);

-- 2. Handwriting attempts ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.handwriting_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES public.curriculum_chapters(id) ON DELETE SET NULL,
  prompt_text TEXT NOT NULL,
  expected_answer TEXT NOT NULL,
  -- OCR output as Tesseract returned it
  ocr_text TEXT,
  -- per-axis 0..1; combined topper-score elsewhere
  legibility_score NUMERIC CHECK (legibility_score BETWEEN 0 AND 1),
  correctness_score NUMERIC CHECK (correctness_score BETWEEN 0 AND 1),
  speed_score NUMERIC CHECK (speed_score BETWEEN 0 AND 1),
  duration_seconds INTEGER,
  language TEXT NOT NULL DEFAULT 'en',
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_handwriting_user
  ON public.handwriting_attempts(user_id, attempted_at DESC);

ALTER TABLE public.handwriting_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self all handwriting" ON public.handwriting_attempts;
CREATE POLICY "self all handwriting" ON public.handwriting_attempts
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 3. Spelling drill words ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spelling_drill_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language TEXT NOT NULL,                       -- 'bn' | 'en' | 'hi'
  class_min INTEGER NOT NULL DEFAULT 1,
  class_max INTEGER NOT NULL DEFAULT 12,
  word TEXT NOT NULL,
  meaning TEXT,
  -- 'simple' | 'conjunct' (যুক্তাক্ষর) | 'compound' | 'irregular' | 'silent'
  category TEXT NOT NULL DEFAULT 'simple',
  difficulty INTEGER NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  example_sentence TEXT,
  UNIQUE (language, word)
);

CREATE INDEX IF NOT EXISTS idx_spelling_words_lookup
  ON public.spelling_drill_words(language, class_min, class_max, difficulty);

ALTER TABLE public.spelling_drill_words ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone read spelling words" ON public.spelling_drill_words;
CREATE POLICY "anyone read spelling words" ON public.spelling_drill_words FOR SELECT USING (TRUE);

-- Seed Bengali primary conjuncts that 90% of Class 4-6 students miss.
INSERT INTO public.spelling_drill_words (language, class_min, class_max, word, meaning, category, difficulty, example_sentence)
VALUES
  ('bn', 3, 6, 'বিদ্যালয়',          'school',                'conjunct', 2, 'আমি বিদ্যালয়ে যাই।'),
  ('bn', 3, 6, 'বিদ্যুৎ',            'electricity',           'conjunct', 3, 'বিদ্যুৎ ছাড়া আজকের জীবন কঠিন।'),
  ('bn', 3, 6, 'বুদ্ধিমান',         'intelligent',           'conjunct', 3, 'সে একজন বুদ্ধিমান ছাত্র।'),
  ('bn', 3, 6, 'বিজ্ঞান',           'science',               'conjunct', 2, 'বিজ্ঞান আমাদের জীবন সহজ করে।'),
  ('bn', 3, 6, 'সংস্কৃতি',          'culture',               'conjunct', 4, 'বাঙালি সংস্কৃতি প্রাচীন।'),
  ('bn', 3, 6, 'মাতৃভূমি',          'motherland',            'conjunct', 3, 'মাতৃভূমিকে ভালোবাসো।'),
  ('bn', 3, 6, 'প্রকৃতি',           'nature',                'conjunct', 2, 'প্রকৃতিকে রক্ষা করো।'),
  ('bn', 3, 6, 'বন্ধুত্ব',           'friendship',            'conjunct', 3, 'সত্যিকারের বন্ধুত্ব মূল্যবান।'),
  ('bn', 3, 6, 'স্বাধীনতা',         'freedom',               'conjunct', 4, 'আমাদের দেশ স্বাধীনতা পেয়েছে।'),
  ('bn', 3, 6, 'অভিজ্ঞতা',          'experience',            'conjunct', 4, 'শিক্ষকের অনেক অভিজ্ঞতা আছে।'),
  ('bn', 3, 6, 'কৃষক',              'farmer',                'conjunct', 2, 'কৃষক মাঠে কাজ করে।'),
  ('bn', 3, 6, 'মৃত্যু',             'death',                 'conjunct', 3, 'মৃত্যু সবার জন্য সত্য।'),
  ('bn', 3, 6, 'উৎসব',              'festival',              'conjunct', 2, 'দুর্গাপূজা আমাদের প্রধান উৎসব।'),
  ('bn', 3, 6, 'স্বাস্থ্য',           'health',                'conjunct', 4, 'সুস্থ স্বাস্থ্যই আসল সম্পদ।'),
  ('bn', 3, 6, 'গৃহ',                'home',                  'conjunct', 1, 'গৃহ আমার পরম শান্তির স্থান।'),
  ('bn', 3, 6, 'বিদ্বান',            'learned person',        'conjunct', 3, 'বিদ্বান সকলের প্রিয়।'),
  ('bn', 3, 6, 'লক্ষ্মী',            'goddess Lakshmi',       'conjunct', 4, 'মা লক্ষ্মী ধনের দেবী।'),
  ('bn', 3, 6, 'সরস্বতী',           'goddess Saraswati',     'conjunct', 3, 'সরস্বতী জ্ঞানের দেবী।'),
  ('bn', 3, 6, 'সত্য',               'truth',                 'conjunct', 1, 'সত্য সবসময় জয়ী হয়।'),
  ('bn', 3, 6, 'পরিশ্রম',           'hard work',             'conjunct', 2, 'পরিশ্রম সাফল্যের চাবিকাঠি।')
ON CONFLICT (language, word) DO NOTHING;

-- English primary spelling list (focuses on commonly-misspelt 8-12 yr words).
INSERT INTO public.spelling_drill_words (language, class_min, class_max, word, meaning, category, difficulty, example_sentence)
VALUES
  ('en', 3, 6, 'because',          NULL, 'irregular', 2, 'I was late because the bus was delayed.'),
  ('en', 3, 6, 'beautiful',        NULL, 'irregular', 3, 'The sunset was beautiful.'),
  ('en', 3, 6, 'separate',         NULL, 'irregular', 3, 'Please separate the recyclables.'),
  ('en', 3, 6, 'necessary',        NULL, 'irregular', 4, 'Water is necessary for life.'),
  ('en', 3, 6, 'environment',      NULL, 'irregular', 4, 'We must protect the environment.'),
  ('en', 3, 6, 'definitely',       NULL, 'irregular', 4, 'I will definitely come tomorrow.'),
  ('en', 3, 6, 'February',         NULL, 'silent',    3, 'February is a short month.'),
  ('en', 3, 6, 'Wednesday',        NULL, 'silent',    3, 'Wednesday is the middle of the week.'),
  ('en', 3, 6, 'knife',            NULL, 'silent',    2, 'A knife is sharp.'),
  ('en', 3, 6, 'science',          NULL, 'irregular', 2, 'Science explains the world.'),
  ('en', 3, 6, 'friend',           NULL, 'irregular', 1, 'A good friend is precious.'),
  ('en', 3, 6, 'school',           NULL, 'irregular', 1, 'School starts at 8 am.'),
  ('en', 3, 6, 'piece',            NULL, 'irregular', 2, 'I want a piece of cake.'),
  ('en', 3, 6, 'receive',          NULL, 'irregular', 3, 'I receive letters every week.'),
  ('en', 3, 6, 'believe',          NULL, 'irregular', 2, 'Believe in yourself.')
ON CONFLICT (language, word) DO NOTHING;

-- 4. Spelling attempts -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spelling_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  word_id UUID NOT NULL REFERENCES public.spelling_drill_words(id) ON DELETE CASCADE,
  student_input TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  duration_seconds INTEGER,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spelling_attempts_user
  ON public.spelling_attempts(user_id, attempted_at DESC);

ALTER TABLE public.spelling_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self all spelling attempts" ON public.spelling_attempts;
CREATE POLICY "self all spelling attempts" ON public.spelling_attempts
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 5. School-uploaded papers --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.school_papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  board_code TEXT,
  class_level INTEGER NOT NULL,
  subject_slug TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'bn',
  exam_label TEXT NOT NULL,
  year INTEGER NOT NULL,
  exam_kind TEXT,                                 -- 'summative_1' | 'summative_2' | 'summative_3' | 'unit_test'
  -- Photographs of the question paper, in order. Stored as Supabase Storage URLs.
  photo_urls TEXT[] NOT NULL DEFAULT '{}',
  ocr_text TEXT,
  extracted_questions JSONB DEFAULT '[]',         -- AI-extracted, awaiting verification
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'ocr_done', 'extracted', 'verified', 'rejected')),
  notes TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_school_papers_lookup
  ON public.school_papers(school_id, class_level, subject_slug, year DESC);

ALTER TABLE public.school_papers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self read own school papers" ON public.school_papers;
CREATE POLICY "self read own school papers" ON public.school_papers
  FOR SELECT USING (uploader_id = auth.uid());
DROP POLICY IF EXISTS "self insert own school papers" ON public.school_papers;
CREATE POLICY "self insert own school papers" ON public.school_papers
  FOR INSERT WITH CHECK (uploader_id = auth.uid());

-- 6. Parent artifacts: extend kind -------------------------------------------
DO $$ BEGIN
  ALTER TABLE public.parent_artifacts
    DROP CONSTRAINT IF EXISTS parent_artifacts_kind_check;
EXCEPTION WHEN undefined_table THEN NULL; END $$;
-- The column is artifact_kind, not kind — 021_master_redesign creates
-- parent_artifacts(id, user_id, artifact_kind, ...). Referencing "kind" here
-- aborted the migration with "column kind does not exist".
DO $$ BEGIN
  ALTER TABLE public.parent_artifacts
    ADD CONSTRAINT parent_artifacts_kind_check
    CHECK (artifact_kind IN ('weekly_digest', 'monthly_report', 'character_growth', 'rank_predictor', 'primary_dinner_card'));
EXCEPTION
  WHEN duplicate_object  THEN NULL;
  WHEN duplicate_table   THEN NULL;
  WHEN undefined_table   THEN NULL;
  WHEN undefined_column  THEN NULL;
END $$;

-- 7. Topper score view -------------------------------------------------------
-- Composite metric a parent / student can read at a glance:
--   topper_score = clamp(0..100,
--     0.45 * mastery_pct
--   + 0.25 * adherence_pct
--   + 0.15 * honesty_xp_normalized   (capped at 200 honesty XP)
--   + 0.10 * recent_practice_freq
--   + 0.05 * weekly_growth_bonus
--   )
CREATE OR REPLACE VIEW public.v_topper_score AS
WITH base AS (
  SELECT
    p.id AS user_id,
    COALESCE(s.honesty_xp, 0)::numeric                                   AS honesty_xp,
    COALESCE(s.current_streak, 0)::numeric                               AS streak,
    -- Mastery proxy: average score across last 30 evaluations
    COALESCE(
      (SELECT AVG(score) FROM public.session_evaluations e
       WHERE e.user_id = p.id
       AND e.evaluated_at >= NOW() - INTERVAL '30 days'), 0)::numeric    AS mastery_avg,
    -- Adherence proxy: days active in last 14 / 14
    COALESCE((
      SELECT COUNT(DISTINCT (created_at::date))::numeric / 14
      FROM public.xp_events x
      WHERE x.user_id = p.id
      AND x.created_at >= NOW() - INTERVAL '14 days'
    ), 0)                                                                 AS adherence_frac,
    -- Recent practice: distinct topics touched in the last 7 days, capped at 10.
    -- session_evaluations records topic_id, not chapter_id — counting distinct
    -- topics is the same signal at finer grain.
    COALESCE((
      SELECT LEAST(COUNT(DISTINCT topic_id), 10)::numeric / 10
      FROM public.session_evaluations e
      WHERE e.user_id = p.id
      AND e.evaluated_at >= NOW() - INTERVAL '7 days'
      AND e.topic_id IS NOT NULL
    ), 0)                                                                 AS practice_freq
  FROM public.profiles p
  LEFT JOIN public.streaks s ON s.user_id = p.id
)
SELECT
  user_id,
  GREATEST(0, LEAST(100, ROUND(
      45 * mastery_avg                          -- 0..1 → 0..45
    + 25 * adherence_frac                       -- 0..1 → 0..25
    + 15 * LEAST(honesty_xp, 200) / 200          -- 0..15
    + 10 * practice_freq                        -- 0..1 → 0..10
    + 5  * LEAST(streak, 30) / 30               -- 0..5
  )::int))::int                                 AS topper_score,
  mastery_avg                                   AS mastery_pct,
  adherence_frac                                AS adherence_pct,
  honesty_xp,
  streak,
  practice_freq
FROM base;

GRANT SELECT ON public.v_topper_score TO authenticated;

-- 8. Yesterday's mistake view ------------------------------------------------
-- Each user's lowest-score evaluation in the last 24h. Used by the dashboard
-- "Redo your mistake" first-card.
-- session_evaluations has no chapter_id, so resolve it through the topic.
-- The LEFT JOIN keeps the column in the view's shape (callers select it)
-- and simply yields NULL when the topic is not a curriculum topic.
CREATE OR REPLACE VIEW public.v_yesterdays_mistake AS
SELECT DISTINCT ON (e.user_id)
  e.user_id,
  e.id AS evaluation_id,
  t.chapter_id,
  e.topic_id,
  e.subject_id,
  e.score,
  e.evaluated_at
FROM public.session_evaluations e
LEFT JOIN public.curriculum_topics t ON t.id = e.topic_id
WHERE e.evaluated_at >= NOW() - INTERVAL '36 hours'
  AND e.score < 0.7
ORDER BY e.user_id, e.score ASC, e.evaluated_at DESC;

GRANT SELECT ON public.v_yesterdays_mistake TO authenticated;

-- 9. Topper routine event log ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.topper_routine_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  routine_date DATE NOT NULL DEFAULT CURRENT_DATE,
  step TEXT NOT NULL CHECK (step IN ('flashcards', 'new_concept', 'mixed', 'past_paper', 'teach_back')),
  duration_seconds INTEGER,
  completed BOOLEAN NOT NULL DEFAULT TRUE,
  payload JSONB DEFAULT '{}',                 -- step-specific result snapshot
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, routine_date, step)
);

ALTER TABLE public.topper_routine_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self all topper routine" ON public.topper_routine_log;
CREATE POLICY "self all topper routine" ON public.topper_routine_log
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
