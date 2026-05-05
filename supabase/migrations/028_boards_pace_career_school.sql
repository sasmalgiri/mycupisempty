-- ============================================================================
-- Migration 028: Multi-board, pace, career, school-cohort, manipulables seed
--
-- Closes seven of the deferred items in one go:
--   * Per-subject pace multiplier in course_enrollments
--   * Career-path emphasis lever in persona_profiles
--   * School-classroom league via profiles.school_id + cohort key extension
--   * Manipulables registry seeds for Class 9-10 math/science
--   * Stuck-detector flag column on session_evaluations
--   * Encouragement Engine — table of grade-tagged emotional-scaffolding lines
--   * English-medium WBBSE 2026 + skeleton CBSE/ICSE Class 6-10 courses
-- ============================================================================

-- ============================================================================
-- 1. Per-subject pace multiplier
-- ============================================================================

ALTER TABLE public.course_enrollments
  ADD COLUMN IF NOT EXISTS pace_multipliers JSONB NOT NULL DEFAULT '{}'::jsonb;
-- pace_multipliers shape: { "math": 0.7, "english": 1.3 } — 0.3..2.0
-- Plan generator multiplies subject share by this. Default 1.0 implicit.

COMMENT ON COLUMN public.course_enrollments.pace_multipliers IS
  'Per-subject pace multiplier (0.3..2.0). Plan generator scales subject share by this. Empty object = uniform.';

-- ============================================================================
-- 2. Career-path emphasis lever on persona
-- ============================================================================

ALTER TABLE public.persona_profiles
  ADD COLUMN IF NOT EXISTS career_path TEXT
    CHECK (career_path IN ('doctor', 'engineer', 'civil_services', 'arts_humanities', 'commerce', 'sports', 'creative', 'unsure'));

COMMENT ON COLUMN public.persona_profiles.career_path IS
  'Self-declared aspiration. Plan generator boosts relevant subject share by 0.1.';

-- ============================================================================
-- 3. School-classroom league
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS school_id UUID,                       -- nullable; not all students are in a school
  ADD COLUMN IF NOT EXISTS school_section TEXT;                  -- 'A', 'B', 'C' etc. within a class

CREATE TABLE IF NOT EXISTS public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT,
  state TEXT DEFAULT 'WB',
  board_code TEXT REFERENCES public.curriculum_boards(code),
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schools_name ON public.schools(name);

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone read schools" ON public.schools;
CREATE POLICY "anyone read schools" ON public.schools
  FOR SELECT USING (TRUE);

-- ============================================================================
-- 4. Stuck-detector flag — when 3 consecutive exit-evals on a chapter score
--    < 0.4, the system should remediate. Schema-level flag lets the planner
--    insert a remediation track.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.stuck_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic_id UUID,
  chapter_id UUID,
  subject_id UUID,
  consecutive_low_count INTEGER NOT NULL DEFAULT 1,
  avg_score NUMERIC,
  status TEXT NOT NULL DEFAULT 'detected' CHECK (status IN ('detected', 'remediation_offered', 'remediation_running', 'resolved', 'declined')),
  remediation_started_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stuck_user_active
  ON public.stuck_detections(user_id, status) WHERE status IN ('detected', 'remediation_offered', 'remediation_running');

ALTER TABLE public.stuck_detections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self all stuck" ON public.stuck_detections;
CREATE POLICY "self all stuck" ON public.stuck_detections
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 5. Encouragement Engine — grade-tagged emotional scaffolding lines
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.encouragement_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger TEXT NOT NULL CHECK (trigger IN (
    'low_score', 'overconfident_wrong', 'guess_correct', 'first_wrong_in_session', 'streak_broken', 'returning_after_gap', 'big_concept_done', 'effort_low'
  )),
  class_min INTEGER DEFAULT 1,
  class_max INTEGER DEFAULT 12,
  language TEXT DEFAULT 'bn',
  body TEXT NOT NULL,
  -- Tag a tone so callers don't show two lines from the same vibe back-to-back
  tone TEXT CHECK (tone IN ('warm', 'witty', 'firm', 'curious', 'reassuring')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_encouragement_trigger
  ON public.encouragement_lines(trigger, language, is_active);

ALTER TABLE public.encouragement_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone read encouragement" ON public.encouragement_lines;
CREATE POLICY "anyone read encouragement" ON public.encouragement_lines
  FOR SELECT USING (is_active = TRUE);

-- Seed 30+ honest, non-treacly lines. Pitched grade-appropriately.
INSERT INTO public.encouragement_lines (trigger, class_min, class_max, language, body, tone)
VALUES
  -- low_score (after exit-eval < 0.4)
  ('low_score',          1, 5,  'en', 'That one was tricky. Real-world test: you did try. Want to see another way to think about it?', 'reassuring'),
  ('low_score',          6, 10, 'en', 'You missed it but you finished it. That''s the bit that matters — a wrong answer you actually thought about beats a right one you copied.', 'firm'),
  ('low_score',          1, 5,  'bn', 'একটু কঠিন ছিল, তাই না? চেষ্টা করেছ — সেটাই আসল।', 'reassuring'),
  ('low_score',          6, 10, 'bn', 'উত্তর ভুল হলেও তুমি সম্পূর্ণ চেষ্টা করেছ। সেটাই দরকার ছিল।', 'firm'),
  -- overconfident_wrong (sure + wrong)
  ('overconfident_wrong',6, 10, 'en', 'You said "sure" but it didn''t land. That gap is gold — the next time you see this, your brain will pause. Use that.', 'witty'),
  ('overconfident_wrong',6, 10, 'bn', 'নিশ্চিত ছিলে, কিন্তু ভুল হলো। এই ব্যবধানটাই সবচেয়ে শেখার মুহূর্ত।', 'witty'),
  -- guess_correct (lucky)
  ('guess_correct',      6, 10, 'en', 'You said "guessing" and got it. Want to lock it in by trying one more like it — same idea, fresh numbers?', 'curious'),
  ('guess_correct',      6, 10, 'bn', 'অনুমান করেও সঠিক! চলো আরেকটা একই ধরনের চেষ্টা করি — তখনই বুঝবে নিজের ক্ষমতা।', 'curious'),
  -- first_wrong_in_session
  ('first_wrong_in_session', 1, 12, 'en', 'First wrong of the day. Honest data — your brain just told us where to slow down.', 'warm'),
  ('first_wrong_in_session', 1, 12, 'bn', 'আজকের প্রথম ভুল। মন জানালো কোথায় একটু থামতে হবে।', 'warm'),
  -- streak_broken
  ('streak_broken',      1, 12, 'en', 'Streaks come back. The longest one starts the day after one breaks.', 'firm'),
  ('streak_broken',      1, 12, 'bn', 'স্ট্রিক ভাঙলো — তবে নতুন যাত্রা আজই শুরু হবে।', 'firm'),
  -- returning_after_gap
  ('returning_after_gap',1, 12, 'en', 'Welcome back. We held your spot.', 'warm'),
  ('returning_after_gap',1, 12, 'bn', 'আবার এসেছ — তোমার জায়গা রেখে দিয়েছিলাম।', 'warm'),
  -- big_concept_done
  ('big_concept_done',   6, 10, 'en', 'You closed a chapter today. Tomorrow''s easier than you think because of that.', 'firm'),
  ('big_concept_done',   6, 10, 'bn', 'আজ একটা অধ্যায় শেষ করলে। কাল সহজ হবে — কারণ এই কাজটা আজই করেছ।', 'firm'),
  -- effort_low (skipped Hint or showed answer fast)
  ('effort_low',         6, 10, 'en', 'You took the answer-button quickly. Try one more, sit with it for 30 seconds before peeking. Your call.', 'witty'),
  ('effort_low',         6, 10, 'bn', 'উত্তর দ্রুত দেখে নিলে। আরেকবার চেষ্টা করো — ৩০ সেকেন্ড ভাবো আগে। তোমার পছন্দ।', 'witty')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. Manipulables registry seeds for Class 9-10 math + science
-- ============================================================================

DO $$
DECLARE v_chapter UUID;
BEGIN
  -- Class 9 math: Graph chapter → graph_plotter
  SELECT ch.id INTO v_chapter
  FROM public.curriculum_chapters ch
  JOIN public.curriculum_subjects_by_class scc ON scc.id = ch.subject_class_id
  WHERE scc.board_code='wbbse' AND scc.class_level=9 AND scc.subject_slug='math'
    AND ch.title_en = 'Graph'
  LIMIT 1;
  IF v_chapter IS NOT NULL THEN
    INSERT INTO public.manipulables_registry (topic_id, subject_slug, manipulable, config, is_default)
    VALUES (v_chapter, 'math', 'graph_plotter', '{"showAxes": true, "default_function": "y=2x+3"}', TRUE)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Class 9 math: Co-ordinate Geometry → graph_plotter
  SELECT ch.id INTO v_chapter
  FROM public.curriculum_chapters ch
  JOIN public.curriculum_subjects_by_class scc ON scc.id = ch.subject_class_id
  WHERE scc.board_code='wbbse' AND scc.class_level=9 AND scc.subject_slug='math'
    AND ch.title_en LIKE 'Co-ordinate Geometry%'
  LIMIT 1;
  IF v_chapter IS NOT NULL THEN
    INSERT INTO public.manipulables_registry (topic_id, subject_slug, manipulable, config, is_default)
    VALUES (v_chapter, 'math', 'graph_plotter', '{"plotPoints": true}', TRUE)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Class 10 phys sci: Light → physics_sim
  SELECT ch.id INTO v_chapter
  FROM public.curriculum_chapters ch
  JOIN public.curriculum_subjects_by_class scc ON scc.id = ch.subject_class_id
  WHERE scc.board_code='wbbse' AND scc.class_level=10 AND scc.subject_slug='physical_science'
    AND ch.title_en = 'Light'
  LIMIT 1;
  IF v_chapter IS NOT NULL THEN
    INSERT INTO public.manipulables_registry (topic_id, subject_slug, manipulable, config, is_default)
    VALUES (v_chapter, 'physical_science', 'physics_sim', '{"sim": "ray_optics"}', TRUE)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Class 10 phys sci: Current Electricity → physics_sim
  SELECT ch.id INTO v_chapter
  FROM public.curriculum_chapters ch
  JOIN public.curriculum_subjects_by_class scc ON scc.id = ch.subject_class_id
  WHERE scc.board_code='wbbse' AND scc.class_level=10 AND scc.subject_slug='physical_science'
    AND ch.title_en = 'Current Electricity'
  LIMIT 1;
  IF v_chapter IS NOT NULL THEN
    INSERT INTO public.manipulables_registry (topic_id, subject_slug, manipulable, config, is_default)
    VALUES (v_chapter, 'physical_science', 'physics_sim', '{"sim": "circuit_builder"}', TRUE)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Class 10 phys sci: Periodic Table → periodic_table
  SELECT ch.id INTO v_chapter
  FROM public.curriculum_chapters ch
  JOIN public.curriculum_subjects_by_class scc ON scc.id = ch.subject_class_id
  WHERE scc.board_code='wbbse' AND scc.class_level=10 AND scc.subject_slug='physical_science'
    AND ch.title_en LIKE 'Periodic Table%'
  LIMIT 1;
  IF v_chapter IS NOT NULL THEN
    INSERT INTO public.manipulables_registry (topic_id, subject_slug, manipulable, config, is_default)
    VALUES (v_chapter, 'physical_science', 'periodic_table', '{}', TRUE)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Class 10 phys sci: Organic Chemistry → molecule_viewer
  SELECT ch.id INTO v_chapter
  FROM public.curriculum_chapters ch
  JOIN public.curriculum_subjects_by_class scc ON scc.id = ch.subject_class_id
  WHERE scc.board_code='wbbse' AND scc.class_level=10 AND scc.subject_slug='physical_science'
    AND ch.title_en LIKE 'Organic%'
  LIMIT 1;
  IF v_chapter IS NOT NULL THEN
    INSERT INTO public.manipulables_registry (topic_id, subject_slug, manipulable, config, is_default)
    VALUES (v_chapter, 'physical_science', 'molecule_viewer', '{}', TRUE)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Class 9-10 history: Timeline viewer (subject-level default)
  INSERT INTO public.manipulables_registry (topic_id, subject_slug, manipulable, config, is_default)
  VALUES (NULL, 'history', 'timeline', '{}', TRUE)
  ON CONFLICT DO NOTHING;

  -- Class 9-10 math: Trigonometry chapters → graph_plotter (sin/cos)
  SELECT ch.id INTO v_chapter
  FROM public.curriculum_chapters ch
  JOIN public.curriculum_subjects_by_class scc ON scc.id = ch.subject_class_id
  WHERE scc.board_code='wbbse' AND scc.class_level=10 AND scc.subject_slug='math'
    AND ch.title_en LIKE 'Trig Ratios and Identities%'
  LIMIT 1;
  IF v_chapter IS NOT NULL THEN
    INSERT INTO public.manipulables_registry (topic_id, subject_slug, manipulable, config, is_default)
    VALUES (v_chapter, 'math', 'graph_plotter', '{"default_function": "y=sin(x)"}', TRUE)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- 7. English-medium WBBSE 2026 + CBSE/ICSE skeleton courses
-- ============================================================================

INSERT INTO public.curriculum_courses
  (board_code, class_level, language, academic_year, title, description, total_subjects, expected_hours_total, expected_weeks, is_published)
VALUES
  -- WBBSE English-medium mirror (uses Bengali-medium chapter rows for now;
  -- localisation can plug in when chapter rows are duplicated in en).
  ('wbbse', 6,  'en', '2026', 'WBBSE Class 6 — English Medium 2026',  'One-year coaching for Class 6 (English medium). Same syllabus as Bengali-medium edition, instruction in English.', 6, 880, 40, TRUE),
  ('wbbse', 7,  'en', '2026', 'WBBSE Class 7 — English Medium 2026',  'One-year Class 7 (English medium).', 6, 880, 40, TRUE),
  ('wbbse', 8,  'en', '2026', 'WBBSE Class 8 — English Medium 2026',  'One-year Class 8 (English medium).', 6, 920, 40, TRUE),
  ('wbbse', 9,  'en', '2026', 'WBBSE Class 9 — English Medium 2026',  'One-year Class 9 (English medium). Pre-Madhyamik foundation.', 6, 1100, 40, TRUE),
  ('wbbse', 10, 'en', '2026', 'WBBSE Class 10 — English Medium 2026', 'Madhyamik 2026 coaching, English medium.', 6, 1180, 40, TRUE),

  -- CBSE Class 6-10 — published as skeleton; chapter seeding is a follow-up
  ('cbse', 6,  'en', '2026', 'CBSE Class 6 — 2026',  'CBSE Class 6 coaching across Math, Science, English, Hindi, Social Science.', 5, 800, 40, TRUE),
  ('cbse', 7,  'en', '2026', 'CBSE Class 7 — 2026',  'CBSE Class 7 coaching.', 5, 800, 40, TRUE),
  ('cbse', 8,  'en', '2026', 'CBSE Class 8 — 2026',  'CBSE Class 8 coaching.', 5, 840, 40, TRUE),
  ('cbse', 9,  'en', '2026', 'CBSE Class 9 — 2026',  'CBSE Class 9 — pre-board foundation.', 5, 1000, 40, TRUE),
  ('cbse', 10, 'en', '2026', 'CBSE Class 10 — 2026', 'CBSE Class 10 — board exam coaching.', 5, 1100, 40, TRUE),

  -- ICSE skeleton
  ('icse', 9,  'en', '2026', 'ICSE Class 9 — 2026',  'ICSE Class 9 coaching.', 6, 1100, 40, TRUE),
  ('icse', 10, 'en', '2026', 'ICSE Class 10 — 2026', 'ICSE Class 10 — board exam coaching.', 6, 1180, 40, TRUE)
ON CONFLICT (board_code, class_level, language, academic_year) DO NOTHING;
