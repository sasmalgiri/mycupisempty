-- ============================================================================
-- Migration 024: Publish WBBSE Class 6-10 courses for academic year 2026
--
-- Migration 023 seeded chapter data. This migration creates the actual
-- "course product" rows (curriculum_courses) that students enrol in.
-- Only Classes 6-10 are published — Classes 1-5 still need chapter-level
-- data before we can plan against them.
-- ============================================================================

INSERT INTO public.curriculum_courses
  (board_code, class_level, language, academic_year, title, description, total_subjects, expected_hours_total, expected_weeks, is_published)
VALUES
  ('wbbse', 6,  'bn', '2026', 'WBBSE Class 6 — Coaching 2026',                'One-year coaching for Class 6 across Math, Science, History, Geography, Bengali and English. Bengali medium.',                      6, 880, 40, TRUE),
  ('wbbse', 7,  'bn', '2026', 'WBBSE Class 7 — Coaching 2026',                'One-year Class 7 coaching covering all six core subjects, with emphasis on the new history and geography sweep.',                  6, 880, 40, TRUE),
  ('wbbse', 8,  'bn', '2026', 'WBBSE Class 8 — Coaching 2026',                'One-year Class 8 coaching, with a deeper dive into the colonial-era history and earth-interior geography.',                       6, 920, 40, TRUE),
  ('wbbse', 9,  'bn', '2026', 'WBBSE Class 9 — Pre-Madhyamik Foundation',     'One-year Class 9 coaching across Math, Physical Science, Life Science, History, Geography, English. Builds the foundation for Madhyamik.', 6, 1100, 40, TRUE),
  ('wbbse', 10, 'bn', '2026', 'WBBSE Class 10 — Madhyamik 2026',              'One-year Madhyamik coaching, exam-weighted across all six core subjects, ending with the February 2026 board window.',         6, 1180, 40, TRUE)
ON CONFLICT (board_code, class_level, language, academic_year) DO NOTHING;
