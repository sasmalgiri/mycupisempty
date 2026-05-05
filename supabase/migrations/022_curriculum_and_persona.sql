-- ============================================================================
-- Migration 022: Curriculum-as-a-course schema + persona profiles
--
-- This is the spine for the 1-year-course product (Class N — WBBSE).
-- The narrowing chain:
--   board syllabus → class course → persona-curriculum → method-curriculum
--   → companion delivery → outcome
--
-- Each ring is smaller than the one above. Each ring is tracked + evaluated
-- + re-narrowed independently.
--
-- Tables added:
--   curriculum_boards
--   curriculum_subjects_by_class
--   curriculum_chapters
--   curriculum_topics
--   curriculum_courses                -- the published product
--   course_enrollments                -- student × course
--   course_milestones                 -- weekly checkpoints per course
--   curriculum_calendars              -- festival/exam/holiday hints
--   student_curriculum_plans          -- the personalized week-by-week plan
--   student_method_assignments        -- per-topic chosen method audit
--   persona_profiles                  -- consolidated persona view
--   companion_class_overlays          -- companion × class × method × chapter
--   persona_game_results              -- game-revealed persona signals
-- ============================================================================

-- ============================================================================
-- 1. Boards + subjects
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.curriculum_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,                 -- 'wbbse' | 'cbse' | 'icse' | 'wb_state' ...
  name TEXT NOT NULL,
  region TEXT,
  language_default TEXT DEFAULT 'en',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.curriculum_boards (code, name, region, language_default, notes)
VALUES
  ('wbbse', 'West Bengal Board of Secondary Education', 'IN-WB', 'bn', 'Madhyamik board; class 1-10 + Class XI/XII via WBCHSE'),
  ('cbse',  'Central Board of Secondary Education',     'IN',    'en', 'NCERT-aligned; class 1-12'),
  ('icse',  'Indian Certificate of Secondary Education', 'IN',   'en', 'CISCE; class 1-10 ICSE, 11-12 ISC'),
  ('nios',  'National Institute of Open Schooling',     'IN',    'en', 'Open schooling system')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.curriculum_subjects_by_class (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_code TEXT NOT NULL REFERENCES public.curriculum_boards(code) ON DELETE CASCADE,
  class_level INTEGER NOT NULL CHECK (class_level BETWEEN 1 AND 12),
  subject_slug TEXT NOT NULL,                          -- 'math' | 'science' | 'english' | 'bengali' | 'social' | 'physical_science' | 'life_science' | 'history' | 'geography'
  textbook_title_native TEXT,                          -- 'আমাদের পরিবেশ'
  textbook_title_romanized TEXT,                       -- 'Aamader Paribesh'
  textbook_title_en TEXT,                              -- 'Our Environment'
  total_chapters INTEGER,
  expected_hours_per_year INTEGER,                     -- school timetable hours
  expected_minutes_per_week INTEGER,
  notes TEXT,
  language TEXT DEFAULT 'bn',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (board_code, class_level, subject_slug, language)
);

CREATE INDEX IF NOT EXISTS idx_subjects_by_class_lookup
  ON public.curriculum_subjects_by_class(board_code, class_level, subject_slug);

-- ============================================================================
-- 2. Chapters + topics
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.curriculum_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_class_id UUID NOT NULL REFERENCES public.curriculum_subjects_by_class(id) ON DELETE CASCADE,
  chapter_no INTEGER NOT NULL,
  title_native TEXT,
  title_romanized TEXT,
  title_en TEXT NOT NULL,
  description TEXT,
  -- season_hint nudges the planner to schedule chapters in seasonally
  -- appropriate slots (early-year basics, mid-year hard chapters, late-year revision)
  season_hint TEXT CHECK (season_hint IN ('early', 'mid', 'late', 'flexible')) DEFAULT 'flexible',
  expected_hours NUMERIC,
  -- prerequisite chapter ids — even cross-class (class 7 algebra prereqs
  -- something from class 6 fractions). UUIDs reference curriculum_chapters.
  prereq_chapter_ids UUID[] DEFAULT '{}',
  -- Maturity band 1-5: where this chapter sits on a cognitive-readiness scale.
  -- A class-3 chapter is band 1-2; a class-10 abstract algebra chapter is band 5.
  maturity_band INTEGER CHECK (maturity_band BETWEEN 1 AND 5) DEFAULT 3,
  -- Madhyamik / board-exam weight (% of marks historically), nullable
  exam_weight_pct NUMERIC,
  source_url TEXT,
  last_verified_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (subject_class_id, chapter_no)
);

CREATE INDEX IF NOT EXISTS idx_chapters_subject_class
  ON public.curriculum_chapters(subject_class_id, chapter_no);
CREATE INDEX IF NOT EXISTS idx_chapters_prereqs
  ON public.curriculum_chapters USING GIN (prereq_chapter_ids);

CREATE TABLE IF NOT EXISTS public.curriculum_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES public.curriculum_chapters(id) ON DELETE CASCADE,
  topic_no INTEGER NOT NULL,
  title_native TEXT,
  title_romanized TEXT,
  title_en TEXT NOT NULL,
  -- Bloom level: 1=remember, 2=understand, 3=apply, 4=analyze, 5=evaluate, 6=create
  bloom_level INTEGER CHECK (bloom_level BETWEEN 1 AND 6) DEFAULT 2,
  expected_minutes INTEGER DEFAULT 30,
  learning_objectives TEXT[] DEFAULT '{}',
  -- Seeds for the method-narrowed lesson variants. Each element is a JSONB
  -- of shape { method: 'visual' | 'story' | 'step_by_step' | ..., body: '...' }.
  -- When the planner picks a method for this topic, it loads the matching
  -- variant; if none exists, falls back to the companion's class overlay.
  method_variants JSONB DEFAULT '[]',
  worked_example_seeds JSONB DEFAULT '[]',
  misconceptions JSONB DEFAULT '[]',
  -- Misc tags: 'practical' | 'project' | 'theory' | 'activity'
  tags TEXT[] DEFAULT '{}',
  language TEXT DEFAULT 'bn',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (chapter_id, topic_no)
);

CREATE INDEX IF NOT EXISTS idx_topics_chapter
  ON public.curriculum_topics(chapter_id, topic_no);

-- ============================================================================
-- 3. Courses (the published product) + enrollments + milestones
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.curriculum_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_code TEXT NOT NULL REFERENCES public.curriculum_boards(code),
  class_level INTEGER NOT NULL CHECK (class_level BETWEEN 1 AND 12),
  language TEXT NOT NULL DEFAULT 'bn',
  academic_year TEXT NOT NULL,                  -- '2026' | '2026-27'
  title TEXT NOT NULL,
  description TEXT,
  total_subjects INTEGER,
  expected_hours_total INTEGER,
  expected_weeks INTEGER DEFAULT 40,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (board_code, class_level, language, academic_year)
);

CREATE TABLE IF NOT EXISTS public.course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.curriculum_courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  start_date DATE NOT NULL,
  target_completion_date DATE,
  weekly_minutes_target INTEGER DEFAULT 300,    -- ~7 hours/week default
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'dropped')),
  completed_at TIMESTAMPTZ,
  UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_user
  ON public.course_enrollments(user_id, status);

ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self all enrollments" ON public.course_enrollments;
CREATE POLICY "self all enrollments" ON public.course_enrollments
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.course_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.curriculum_courses(id) ON DELETE CASCADE,
  week_no INTEGER NOT NULL,                     -- 1..expected_weeks
  title TEXT NOT NULL,
  description TEXT,
  -- Chapters expected to be in progress / completed by end of this week
  expected_chapter_ids UUID[] DEFAULT '{}',
  cumulative_hours_target NUMERIC,
  is_assessment_week BOOLEAN DEFAULT FALSE,     -- mid-term / mock test weeks
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (course_id, week_no)
);

CREATE INDEX IF NOT EXISTS idx_milestones_course
  ON public.course_milestones(course_id, week_no);

-- ============================================================================
-- 4. Calendars: festivals, school exams, holidays
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.curriculum_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_code TEXT REFERENCES public.curriculum_boards(code),       -- nullable = global
  region TEXT,                                  -- 'IN-WB' for WB-specific holidays
  academic_year TEXT NOT NULL,
  event_kind TEXT NOT NULL CHECK (event_kind IN (
    'public_holiday', 'school_break', 'mid_term', 'half_yearly', 'final_exam', 'pre_board', 'board_exam', 'festival', 'puja_vacation', 'summer_break'
  )),
  title TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  affects_planner BOOLEAN DEFAULT TRUE,         -- false for low-impact festivals
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendars_dates
  ON public.curriculum_calendars(academic_year, start_date);

-- ============================================================================
-- 5. Student curriculum plan (week-by-week, persona-narrowed)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.student_curriculum_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES public.course_enrollments(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generator_version TEXT,                       -- 'v1' | 'v2-method-aware' | ...
  -- weeks[] is the canonical plan: array of { week_no, start_date, end_date,
  -- chapters[], topics[], daily_minutes_targets[], review_topic_ids[],
  -- rest_days[], notes }
  weeks JSONB NOT NULL DEFAULT '[]',
  -- adherence rolling stat updated as the student progresses
  adherence_pct NUMERIC,
  is_current BOOLEAN DEFAULT TRUE,              -- false when superseded by a newer plan
  superseded_by UUID,                           -- self-FK (no constraint to allow inserts before commit)
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_plans_user_current
  ON public.student_curriculum_plans(user_id) WHERE is_current = TRUE;

ALTER TABLE public.student_curriculum_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self all plans" ON public.student_curriculum_plans;
CREATE POLICY "self all plans" ON public.student_curriculum_plans
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 6. Method narrowing audit (Phase E.5)
--
-- Per topic, which method did the planner assign? When did the system switch?
-- Append-only — past assignments are evidence for the ModeRecommender and the
-- parent audit trail.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.student_method_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic_id UUID,                                -- curriculum_topics(id) when known
  chapter_id UUID,                              -- curriculum_chapters(id) for chapter-level
  subject_id UUID,                              -- legacy subjects table (loose link)
  companion_id TEXT,
  -- The chosen method for this topic. Mirrors LearningModePill values.
  method TEXT NOT NULL CHECK (method IN ('visual', 'story', 'step_by_step', 'example_first', 'socratic', 'drill', 'hands_on')),
  reason TEXT,                                  -- 'persona_default' | 'companion_switch' | 'student_override' | 'plan_generator'
  evidence JSONB,                               -- e.g. { exitEvalAvg: 0.42, sessionsTried: 5, alternative: 'story' }
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_method_assignments_user
  ON public.student_method_assignments(user_id, assigned_at DESC);
CREATE INDEX IF NOT EXISTS idx_method_assignments_topic
  ON public.student_method_assignments(user_id, topic_id, assigned_at DESC);

ALTER TABLE public.student_method_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self read method assignments" ON public.student_method_assignments;
CREATE POLICY "self read method assignments" ON public.student_method_assignments
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "self insert method assignment" ON public.student_method_assignments;
CREATE POLICY "self insert method assignment" ON public.student_method_assignments
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 7. Persona — consolidated read view + game results
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.persona_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Behavioural axes (0..1, copied from the Arena minigame_profile)
  visual_processing_speed NUMERIC,
  reading_fluency NUMERIC,
  numerical_fluency NUMERIC,
  working_memory_capacity NUMERIC,
  inference_strength NUMERIC,
  decision_tempo NUMERIC,
  risk_tolerance NUMERIC,
  empathy_leaning NUMERIC,
  -- Persona-game-revealed dimensions (0..1)
  perfectionism NUMERIC,                        -- behavioural: time spent re-checking
  effort_tolerance NUMERIC,                     -- behavioural: persistence on hard items
  curiosity_breadth NUMERIC,                    -- behavioural: explore-vs-exploit choice
  social_orientation NUMERIC,                   -- behavioural: collaborative vs solo bias
  -- Pragmatic constraints (asked once, refreshed yearly)
  daily_study_minutes_available INTEGER,
  best_study_time TEXT CHECK (best_study_time IN ('early_morning', 'after_school', 'evening', 'late_night', 'flexible')),
  exam_target TEXT CHECK (exam_target IN ('school_pass', 'honour_roll', 'olympiad', 'jee_neet', 'ntse', 'kvpy')),
  energy_after_school INTEGER CHECK (energy_after_school BETWEEN 1 AND 5),
  family_constraints TEXT,
  secret_aspiration TEXT,
  -- Meta
  composite_confidence NUMERIC DEFAULT 0.3,     -- how reliable is this persona overall
  built_from_sources TEXT[] DEFAULT '{}',       -- ['arena', 'persona_games', 'onboarding', 'companion_facts', 'interests']
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.persona_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self all persona" ON public.persona_profiles;
CREATE POLICY "self all persona" ON public.persona_profiles
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- persona_game_results: each persona-reveal game (different from Arena
-- cognitive games — these probe disposition and effort, not capacity).
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.persona_game_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game TEXT NOT NULL CHECK (game IN ('island_choice', 'effort_curve', 'curiosity_room', 'tortoise_or_hare', 'helping_hands', 'study_time_quest')),
  -- Raw signals from the play. Interpretation in lib/persona-games.ts.
  signals JSONB NOT NULL DEFAULT '{}',
  duration_seconds INTEGER,
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_persona_games_user
  ON public.persona_game_results(user_id, played_at DESC);

ALTER TABLE public.persona_game_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self all persona games" ON public.persona_game_results;
CREATE POLICY "self all persona games" ON public.persona_game_results
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 8. Companion class overlays (Phase F)
-- Keyed by board × companion × class × method × chapter so a single companion
-- can speak class-3-visual-algebra differently from class-9-Socratic-algebra.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.companion_class_overlays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_code TEXT NOT NULL REFERENCES public.curriculum_boards(code),
  companion_id TEXT NOT NULL,                   -- 'aryabhata' | 'tagore' | 'nambi' | ...
  class_level INTEGER NOT NULL CHECK (class_level BETWEEN 1 AND 12),
  method TEXT,                                  -- nullable = applies across methods
  chapter_id UUID REFERENCES public.curriculum_chapters(id) ON DELETE CASCADE,  -- nullable = applies across chapters
  -- Persona-aware system-prompt fragment + vocab + example bank refs
  system_prompt_fragment TEXT NOT NULL,
  vocabulary TEXT[] DEFAULT '{}',
  example_bank_refs JSONB DEFAULT '[]',
  exit_eval_flavour TEXT,                       -- 'mcq' | 'free_form' | 'draw_bar_model' | 'predict_then_reveal' | 'teach_back'
  misconception_remediation JSONB DEFAULT '[]',
  language TEXT DEFAULT 'bn',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Composite key: nulls in method/chapter make a row a "default" for the
  -- broader class. We don't use UNIQUE on the partial composite (Postgres
  -- nulls don't dedupe well); the API layer picks the most specific match.
  UNIQUE (board_code, companion_id, class_level, method, chapter_id, language)
);

CREATE INDEX IF NOT EXISTS idx_companion_overlays_lookup
  ON public.companion_class_overlays(board_code, companion_id, class_level, language);

-- ============================================================================
-- 9. Helper: convenient view of a student's currently-active plan + course
-- ============================================================================

CREATE OR REPLACE VIEW public.v_student_current_course AS
SELECT
  e.user_id,
  e.id          AS enrollment_id,
  e.course_id,
  c.board_code,
  c.class_level,
  c.language,
  c.title       AS course_title,
  e.start_date,
  e.target_completion_date,
  e.weekly_minutes_target,
  e.status,
  p.id          AS plan_id,
  p.weeks       AS plan_weeks,
  p.adherence_pct
FROM public.course_enrollments e
JOIN public.curriculum_courses c ON c.id = e.course_id
LEFT JOIN public.student_curriculum_plans p
  ON p.enrollment_id = e.id AND p.is_current = TRUE
WHERE e.status = 'active';
