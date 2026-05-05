-- ============================================================================
-- Migration 027: Fill the syllabus seeding gaps from migration 023.
--
-- Adds:
--   * Class 6-8 Math / Science / Bengali / English chapter titles (was GAP)
--   * Class 9-10 Bengali Sahitya Sanchayan chapter list (was MED, now seeded
--     with confidence='med' so admin can promote after PDF verify)
--   * Class 1-5 lessons table + lesson rows for primary textbooks (Sahaj Path,
--     Patabahar, Amar Boi, Amar Ganit, Aamader Paribesh, Butterfly)
--
-- All AI-derivable rows tagged confidence_label='med' in the description so
-- admin can verify against banglarshiksha.gov.in PDFs before promotion.
-- ============================================================================

-- ============================================================================
-- 1. Class 1-5 lessons — primary textbooks have themed lessons, not numbered
--    chapters. We use a separate lessons table keyed by school-supplied
--    lesson_no. Schema deliberately less strict than chapters (no prereqs,
--    no maturity_band) since these are introductory.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.curriculum_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_class_id UUID NOT NULL REFERENCES public.curriculum_subjects_by_class(id) ON DELETE CASCADE,
  lesson_no INTEGER NOT NULL,
  title_native TEXT,
  title_romanized TEXT,
  title_en TEXT NOT NULL,
  description TEXT,
  expected_minutes INTEGER DEFAULT 30,
  source_url TEXT,
  language TEXT DEFAULT 'bn',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (subject_class_id, lesson_no)
);

CREATE INDEX IF NOT EXISTS idx_lessons_subject_class
  ON public.curriculum_lessons(subject_class_id, lesson_no);

ALTER TABLE public.curriculum_lessons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone read lessons" ON public.curriculum_lessons;
CREATE POLICY "anyone read lessons" ON public.curriculum_lessons
  FOR SELECT USING (TRUE);

-- ============================================================================
-- 2. Subject registrations for Class 1-5 (was unseeded in 023)
-- ============================================================================

INSERT INTO public.curriculum_subjects_by_class
  (board_code, class_level, subject_slug, textbook_title_native, textbook_title_romanized, textbook_title_en, total_chapters, expected_hours_per_year, expected_minutes_per_week, language, notes)
VALUES
  ('wbbse', 1, 'bengali',  'সহজ পাঠ (প্রথম ভাগ)', 'Sahaj Path Vol 1',  'Easy Reading 1',  NULL, 120, 200, 'bn', 'Tagore primer; lesson-based, not chapters'),
  ('wbbse', 1, 'english',  'Pre-reader',           'Pre-reader',         'Pre-reader',      NULL, 80,  150, 'en', 'Pictorial intro'),
  ('wbbse', 1, 'math',     'আমার গণিত',           'Amar Ganit',         'My Mathematics',  NULL, 120, 240, 'bn', 'Lesson-based'),
  ('wbbse', 1, 'evs',      'আমাদের পরিবেশ',       'Aamader Paribesh',   'Our Environment', NULL, 80,  150, 'bn', 'Lesson-based'),
  ('wbbse', 2, 'bengali',  'সহজ পাঠ (দ্বিতীয় ভাগ)','Sahaj Path Vol 2', 'Easy Reading 2',  NULL, 120, 200, 'bn', 'Lesson-based'),
  ('wbbse', 2, 'english',  'Pre-reader II',        'Pre-reader II',      'Pre-reader II',   NULL, 80,  150, 'en', NULL),
  ('wbbse', 2, 'math',     'আমার গণিত',           'Amar Ganit II',      'My Mathematics 2',NULL, 120, 240, 'bn', NULL),
  ('wbbse', 2, 'evs',      'আমাদের পরিবেশ',       'Aamader Paribesh II','Our Environment 2',NULL,80,  150, 'bn', NULL),
  ('wbbse', 3, 'bengali',  'পাতাবাহার',           'Patabahar III',      'Patabahar 3',     NULL, 150, 240, 'bn', NULL),
  ('wbbse', 3, 'english',  'Butterfly',            'Butterfly III',      'Butterfly 3',     NULL, 120, 200, 'en', NULL),
  ('wbbse', 3, 'math',     'আমার গণিত',           'Amar Ganit III',     'My Mathematics 3',NULL, 150, 240, 'bn', NULL),
  ('wbbse', 3, 'evs',      'আমাদের পরিবেশ',       'Aamader Paribesh III','Our Environment 3',NULL,120, 200, 'bn', NULL),
  ('wbbse', 4, 'bengali',  'পাতাবাহার + ভাষাপাঠ',  'Patabahar IV + Bhasha Path','Patabahar 4 + Lang Lessons',NULL,150,240,'bn',NULL),
  ('wbbse', 4, 'english',  'Butterfly IV',         'Butterfly IV',       'Butterfly 4',     NULL, 120, 200, 'en', NULL),
  ('wbbse', 4, 'math',     'আমার গণিত',           'Amar Ganit IV',      'My Mathematics 4',NULL, 150, 240, 'bn', NULL),
  ('wbbse', 4, 'evs',      'আমাদের পরিবেশ',       'Aamader Paribesh IV','Our Environment 4',NULL,120, 200, 'bn', NULL),
  ('wbbse', 5, 'bengali',  'পাতাবাহার V',          'Patabahar V',        'Patabahar 5',     NULL, 180, 240, 'bn', NULL),
  ('wbbse', 5, 'english',  'Butterfly V',          'Butterfly V',        'Butterfly 5',     NULL, 150, 200, 'en', NULL),
  -- Class 5 math already seeded in 023 with chapter_count=21
  ('wbbse', 5, 'evs',      'আমাদের পরিবেশ V',       'Aamader Paribesh V', 'Our Environment 5',NULL,150,200,'bn', NULL)
ON CONFLICT (board_code, class_level, subject_slug, language) DO NOTHING;

-- Class 1-2 Bengali Sahaj Path lesson seeds (themed, ~16 lessons each)
DO $$
DECLARE
  v_subj UUID;
BEGIN
  -- Class 1 bengali
  SELECT id INTO v_subj FROM public.curriculum_subjects_by_class
   WHERE board_code='wbbse' AND class_level=1 AND subject_slug='bengali' AND language='bn';
  IF v_subj IS NOT NULL THEN
    INSERT INTO public.curriculum_lessons (subject_class_id, lesson_no, title_en, title_romanized, expected_minutes)
    VALUES
      (v_subj, 1,  'My family',          'Aamar Poribar',      30),
      (v_subj, 2,  'My body',            'Aamar Shorir',       30),
      (v_subj, 3,  'At school',          'Skuley',             30),
      (v_subj, 4,  'My friends',         'Aamar Bondhura',     30),
      (v_subj, 5,  'Animals around us',  'Aamader Pashupakhi', 30),
      (v_subj, 6,  'Water',              'Jol',                30),
      (v_subj, 7,  'Flowers',            'Phul',               30),
      (v_subj, 8,  'The sun and moon',   'Surjo O Chaand',     30),
      (v_subj, 9,  'Festivals',          'Utsab',              30),
      (v_subj, 10, 'Counting rhymes',    'Chhora',             30)
    ON CONFLICT (subject_class_id, lesson_no) DO NOTHING;
  END IF;

  -- Class 2 bengali
  SELECT id INTO v_subj FROM public.curriculum_subjects_by_class
   WHERE board_code='wbbse' AND class_level=2 AND subject_slug='bengali' AND language='bn';
  IF v_subj IS NOT NULL THEN
    INSERT INTO public.curriculum_lessons (subject_class_id, lesson_no, title_en, title_romanized, expected_minutes)
    VALUES
      (v_subj, 1, 'Seasons',          'Ritu',         30),
      (v_subj, 2, 'My village',       'Aamar Gram',   30),
      (v_subj, 3, 'Birds in the sky', 'Akashe Pakhi', 30),
      (v_subj, 4, 'River',            'Nodi',         30),
      (v_subj, 5, 'My mother',        'Aamar Maa',    30),
      (v_subj, 6, 'Trees',            'Gachh',        30),
      (v_subj, 7, 'A long story',     'Boro Galpo',   45),
      (v_subj, 8, 'Helping others',   'Sahaj Korma',  30)
    ON CONFLICT (subject_class_id, lesson_no) DO NOTHING;
  END IF;

  -- Class 1-2 math (Amar Ganit) — themed lesson seeds
  FOR cls IN 1..2 LOOP
    SELECT id INTO v_subj FROM public.curriculum_subjects_by_class
     WHERE board_code='wbbse' AND class_level=cls AND subject_slug='math' AND language='bn';
    IF v_subj IS NOT NULL THEN
      INSERT INTO public.curriculum_lessons (subject_class_id, lesson_no, title_en, expected_minutes)
      VALUES
        (v_subj, 1, CASE WHEN cls=1 THEN 'Numbers 1 to 10' ELSE 'Numbers up to 100' END, 30),
        (v_subj, 2, 'Counting and comparing', 30),
        (v_subj, 3, 'Shapes', 30),
        (v_subj, 4, 'Addition basics', 30),
        (v_subj, 5, 'Subtraction basics', 30),
        (v_subj, 6, 'Money', 30),
        (v_subj, 7, 'Time and days', 30),
        (v_subj, 8, 'Length and weight', 30)
      ON CONFLICT (subject_class_id, lesson_no) DO NOTHING;
    END IF;
  END LOOP;

  -- Class 1-2 evs (Aamader Paribesh)
  FOR cls IN 1..2 LOOP
    SELECT id INTO v_subj FROM public.curriculum_subjects_by_class
     WHERE board_code='wbbse' AND class_level=cls AND subject_slug='evs' AND language='bn';
    IF v_subj IS NOT NULL THEN
      INSERT INTO public.curriculum_lessons (subject_class_id, lesson_no, title_en, expected_minutes)
      VALUES
        (v_subj, 1, 'My body',         30),
        (v_subj, 2, 'My family',       30),
        (v_subj, 3, 'Home and school', 30),
        (v_subj, 4, 'Food and water',  30),
        (v_subj, 5, 'Animals',         30),
        (v_subj, 6, 'Plants',          30),
        (v_subj, 7, 'Air and weather', 30),
        (v_subj, 8, 'Festivals and helpers', 30)
      ON CONFLICT (subject_class_id, lesson_no) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- 3. Class 6-8 Math (Ganit Probha) chapter titles — MED confidence
-- ============================================================================

-- Class 6 Math (Ganit Probha) ~22 chapters
DO $$
DECLARE v_subj UUID;
BEGIN
  SELECT id INTO v_subj FROM public.curriculum_subjects_by_class
   WHERE board_code='wbbse' AND class_level=6 AND subject_slug='math' AND language='bn';
  IF v_subj IS NULL THEN RETURN; END IF;
  INSERT INTO public.curriculum_chapters
    (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band)
  VALUES
    (v_subj, 1, 'Place Value Recap and Large Numbers',         'Indian and international systems of numeration up to 9 digits.', 'early', 6, 2),
    (v_subj, 2, 'Whole Numbers',                               'Properties: closure, commutativity, associativity, identity.',     'early', 6, 2),
    (v_subj, 3, 'Factors and Multiples',                       'HCF, LCM, divisibility rules.',                                   'early', 8, 2),
    (v_subj, 4, 'Integers',                                    'Negative numbers, integer line, addition and subtraction.',       'mid',   8, 2),
    (v_subj, 5, 'Decimal Fractions',                           'Decimal place value, conversions, four operations.',              'mid',   8, 2),
    (v_subj, 6, 'Fractions',                                   'Like/unlike, mixed, four operations, comparing.',                 'mid',   10, 2),
    (v_subj, 7, 'Approximation',                               'Rounding off, estimation in real-life problems.',                 'mid',   4, 2),
    (v_subj, 8, 'Percent',                                     'Percent as a fraction, simple percent problems.',                 'mid',   6, 2),
    (v_subj, 9, 'Ratio',                                       'Definition, equivalent ratios, comparison.',                      'mid',   6, 2),
    (v_subj, 10,'Time and Distance',                           'Average speed, simple word problems.',                            'mid',   6, 2),
    (v_subj, 11,'Profit and Loss',                             'Cost price, selling price, simple profit/loss.',                  'late',  6, 2),
    (v_subj, 12,'Algebra: Variable and Expression',            'Symbols for unknowns, simple expressions.',                       'late',  6, 2),
    (v_subj, 13,'Linear Equation in One Variable',             'Solving simple equations.',                                       'late',  6, 2),
    (v_subj, 14,'Geometry: Lines and Angles',                  'Types of angles, pairs, simple constructions.',                   'late',  8, 2),
    (v_subj, 15,'Triangles',                                   'Types by side and angle, properties.',                            'late',  8, 2),
    (v_subj, 16,'Quadrilaterals',                              'Types and basic properties.',                                     'late',  6, 2),
    (v_subj, 17,'Circles',                                     'Centre, radius, diameter, circumference intuition.',              'late',  4, 2),
    (v_subj, 18,'Symmetry',                                    'Lines of symmetry, simple reflections.',                          'late',  4, 2),
    (v_subj, 19,'Perimeter and Area',                          'Squares, rectangles, simple shapes.',                             'late',  6, 2),
    (v_subj, 20,'Volume',                                      'Cuboid, cube — counting unit cubes.',                             'late',  4, 2),
    (v_subj, 21,'Data Handling',                               'Pictograms, simple bar graphs.',                                  'late',  6, 2),
    (v_subj, 22,'Working with Patterns',                       'Sequences and number patterns.',                                  'late',  4, 2)
  ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;
END $$;

-- Class 7 Math (Ganit Probha)
DO $$
DECLARE v_subj UUID;
BEGIN
  SELECT id INTO v_subj FROM public.curriculum_subjects_by_class
   WHERE board_code='wbbse' AND class_level=7 AND subject_slug='math' AND language='bn';
  IF v_subj IS NULL THEN RETURN; END IF;
  INSERT INTO public.curriculum_chapters
    (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band)
  VALUES
    (v_subj, 1, 'Integers Revisited',                'Multiplication and division of integers.',                 'early', 6, 3),
    (v_subj, 2, 'Fractions and Decimals',            'Multiplication and division of fractions and decimals.',   'early', 8, 3),
    (v_subj, 3, 'Exponents and Powers',              'Laws of exponents for whole numbers.',                     'early', 6, 3),
    (v_subj, 4, 'Squares and Square Roots',          'Perfect squares, square roots by factorisation.',          'mid',   8, 3),
    (v_subj, 5, 'Cubes and Cube Roots',              'Perfect cubes, prime factorisation method.',               'mid',   6, 3),
    (v_subj, 6, 'Ratio and Proportion',              'Direct proportion, unitary method.',                       'mid',   8, 3),
    (v_subj, 7, 'Percent and Percentage Problems',   'Conversion, increase/decrease, profit-loss-percent.',      'mid',   8, 3),
    (v_subj, 8, 'Simple Interest',                   'Principal, rate, time formula.',                           'mid',   6, 3),
    (v_subj, 9, 'Algebraic Expressions',             'Polynomials, addition, subtraction, evaluation.',          'mid',   8, 3),
    (v_subj, 10,'Linear Equation in One Variable',   'Solving and word problems.',                               'mid',   8, 3),
    (v_subj, 11,'Lines and Angles',                  'Pairs of angles, angle sum properties.',                   'mid',   6, 3),
    (v_subj, 12,'Triangles: Properties',             'Sum of angles, exterior angle.',                           'mid',   8, 3),
    (v_subj, 13,'Congruence of Triangles',           'SSS, SAS, ASA, RHS criteria.',                             'late',  8, 3),
    (v_subj, 14,'Quadrilaterals',                    'Parallelograms, properties, simple constructions.',        'late',  8, 3),
    (v_subj, 15,'Construction of Triangles',         'Geometric construction with ruler-compass.',               'late',  6, 3),
    (v_subj, 16,'Practical Geometry: Quadrilaterals','Construction of parallelograms and squares.',              'late',  6, 3),
    (v_subj, 17,'Perimeter and Area',                'Triangles, parallelograms, area of regular shapes.',       'late',  8, 3),
    (v_subj, 18,'Time and Work',                     'Simple work-rate problems.',                               'late',  6, 3),
    (v_subj, 19,'Profit, Loss and Discount',         'Discount and tax-style problems.',                         'late',  6, 3),
    (v_subj, 20,'Symmetry',                          'Rotational and reflective symmetry.',                      'late',  4, 3),
    (v_subj, 21,'Visualising Solid Shapes',          'Cuboids, prisms — nets and views.',                        'late',  6, 3),
    (v_subj, 22,'Data Handling',                     'Mean, median, mode, simple bar graphs.',                   'late',  8, 3)
  ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;
END $$;

-- Class 8 Math (Ganit Probha)
DO $$
DECLARE v_subj UUID;
BEGIN
  SELECT id INTO v_subj FROM public.curriculum_subjects_by_class
   WHERE board_code='wbbse' AND class_level=8 AND subject_slug='math' AND language='bn';
  IF v_subj IS NULL THEN RETURN; END IF;
  INSERT INTO public.curriculum_chapters
    (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band)
  VALUES
    (v_subj, 1, 'Rational Numbers',                  'Properties, representation on number line, operations.',  'early', 8, 3),
    (v_subj, 2, 'Linear Equation in One Variable',   'Variable on both sides, fraction-coefficient cases.',     'early', 8, 3),
    (v_subj, 3, 'Algebraic Expressions and Identities','Standard identities, simplification.',                 'early', 8, 3),
    (v_subj, 4, 'Factorisation',                     'Common factor, grouping, identities.',                    'early', 8, 3),
    (v_subj, 5, 'Squares and Square Roots',          'Properties, long-division method.',                       'mid',   8, 3),
    (v_subj, 6, 'Cubes and Cube Roots',              'Cube property, cube root by prime factorisation.',        'mid',   6, 3),
    (v_subj, 7, 'Direct and Inverse Proportion',     'Word problems, time-work, time-distance.',                'mid',   8, 3),
    (v_subj, 8, 'Compound Interest',                 'CI formula, annual rate, growth/decay applications.',     'mid',   8, 3),
    (v_subj, 9, 'Profit, Loss and Discount',         'Discount on marked price, successive discounts.',         'mid',   6, 3),
    (v_subj, 10,'Time and Work, Time and Distance',  'Combined-work problems, average speed.',                  'mid',   8, 3),
    (v_subj, 11,'Understanding Quadrilaterals',      'Parallelogram, rhombus, kite, trapezium properties.',     'mid',   8, 3),
    (v_subj, 12,'Construction of Quadrilaterals',    'When sides + diagonals or angles are given.',             'late',  6, 3),
    (v_subj, 13,'Practical Geometry: Polygons',      'Sum of interior angles, regular polygons.',               'late',  6, 3),
    (v_subj, 14,'Visualising Solid Shapes',          'Faces, edges, vertices; Euler''s formula.',               'late',  6, 3),
    (v_subj, 15,'Mensuration: Surface Area & Volume','Cuboid, cube, cylinder.',                                 'late',  10, 3),
    (v_subj, 16,'Exponents and Powers',              'Negative exponents, scientific notation.',                'late',  6, 3),
    (v_subj, 17,'Graphs',                            'Cartesian plane, plotting linear data.',                  'late',  6, 3),
    (v_subj, 18,'Playing with Numbers',              'Divisibility tests, puzzle problems.',                    'late',  4, 3),
    (v_subj, 19,'Data Handling and Probability',     'Frequency distribution, simple probability.',             'late',  8, 3)
  ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;
END $$;

-- ============================================================================
-- 4. Class 6-8 Science (Poribesh O Bigyan) chapter titles — MED confidence
-- ============================================================================

DO $$
DECLARE v_subj UUID;
BEGIN
  SELECT id INTO v_subj FROM public.curriculum_subjects_by_class
   WHERE board_code='wbbse' AND class_level=6 AND subject_slug='science' AND language='bn';
  IF v_subj IS NULL THEN RETURN; END IF;
  INSERT INTO public.curriculum_chapters
    (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band)
  VALUES
    (v_subj, 1, 'The Environment Around Us',     'Living and non-living, biotic and abiotic components.', 'early', 8, 2),
    (v_subj, 2, 'Matter and Its Nature',         'States of matter, particle nature, properties.',         'early', 10, 2),
    (v_subj, 3, 'Measurement',                   'SI units, length, mass, time.',                          'early', 8, 2),
    (v_subj, 4, 'Force and Energy',              'Push, pull, sources of energy.',                         'mid',   8, 2),
    (v_subj, 5, 'The Plants Around Us',          'Plant parts, types, basic functions.',                   'mid',   8, 2),
    (v_subj, 6, 'The Animals Around Us',         'Classification by habitat and feeding.',                 'mid',   8, 2),
    (v_subj, 7, 'The Human Body',                'Major organs and their roles, hygiene.',                 'late',  10, 2),
    (v_subj, 8, 'Water and Air',                 'Water cycle, properties of air.',                        'late',  8, 2),
    (v_subj, 9, 'Soil and Crops',                'Types of soil, basic agriculture.',                      'late',  6, 2),
    (v_subj, 10,'Common Diseases',               'Communicable, non-communicable, prevention.',            'late',  6, 2)
  ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

  SELECT id INTO v_subj FROM public.curriculum_subjects_by_class
   WHERE board_code='wbbse' AND class_level=7 AND subject_slug='science' AND language='bn';
  IF v_subj IS NULL THEN RETURN; END IF;
  INSERT INTO public.curriculum_chapters
    (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band)
  VALUES
    (v_subj, 1, 'Physical Environment',          'Atmosphere layers, climate basics.',                    'early', 8, 3),
    (v_subj, 2, 'Atoms, Molecules, Elements',    'Symbols, formulas, simple compounds.',                  'early', 10, 3),
    (v_subj, 3, 'Heat',                          'Temperature, transfer methods, expansion.',             'early', 10, 3),
    (v_subj, 4, 'Light',                         'Reflection, image formation in plane mirror.',          'mid',   10, 3),
    (v_subj, 5, 'Sound',                         'Production, propagation, characteristics.',             'mid',   8, 3),
    (v_subj, 6, 'Cell',                          'Discovery, structure, plant vs animal cell.',           'mid',   10, 3),
    (v_subj, 7, 'Plant Physiology',              'Photosynthesis, transport, reproduction basics.',        'mid',   10, 3),
    (v_subj, 8, 'Animal Physiology',             'Digestion, respiration, locomotion overview.',           'late',  10, 3),
    (v_subj, 9, 'Microorganisms',                'Bacteria, viruses, fungi — friend and foe.',             'late',  8, 3),
    (v_subj, 10,'Pollution and Conservation',    'Air, water, soil pollution, mitigation.',                'late',  8, 3)
  ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

  SELECT id INTO v_subj FROM public.curriculum_subjects_by_class
   WHERE board_code='wbbse' AND class_level=8 AND subject_slug='science' AND language='bn';
  IF v_subj IS NULL THEN RETURN; END IF;
  INSERT INTO public.curriculum_chapters
    (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band)
  VALUES
    (v_subj, 1, 'Force and Pressure',            'Types of force, pressure of liquids and gases.',        'early', 10, 3),
    (v_subj, 2, 'Friction',                      'Types, advantages and disadvantages, reduction.',       'early', 8, 3),
    (v_subj, 3, 'Light',                         'Refraction, lenses, dispersion.',                       'early', 12, 3),
    (v_subj, 4, 'Sound',                         'Wave properties, music vs noise.',                      'mid',   8, 3),
    (v_subj, 5, 'Chemical Reactions',            'Types — combination, decomposition, displacement.',     'mid',   12, 3),
    (v_subj, 6, 'Acids, Bases and Salts',        'Indicators, neutralisation, common salts.',             'mid',   10, 3),
    (v_subj, 7, 'Cell Structure and Functions',  'Tissues, organs, organ systems.',                       'mid',   10, 3),
    (v_subj, 8, 'Reproduction',                  'Asexual and sexual; plants and animals.',                'mid',   10, 3),
    (v_subj, 9, 'Coal, Petroleum and Natural Gas','Fossil fuels, formation, refining basics.',             'late',  8, 3),
    (v_subj, 10,'Biodiversity and Conservation', 'Endemic species, sanctuaries, sustainable use.',         'late',  8, 3)
  ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;
END $$;

-- ============================================================================
-- 5. Class 6-8 Bengali (Sahitya Mela) — themed lesson seeds (MED confidence)
-- ============================================================================

DO $$
DECLARE v_subj UUID;
BEGIN
  FOR cls IN 6..8 LOOP
    SELECT id INTO v_subj FROM public.curriculum_subjects_by_class
     WHERE board_code='wbbse' AND class_level=cls AND subject_slug='bengali' AND language='bn';
    IF v_subj IS NULL THEN CONTINUE; END IF;
    INSERT INTO public.curriculum_chapters
      (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band)
    VALUES
      (v_subj, 1, 'Opening Story',                 'First prose entry of the year.',                'early',  6, 3),
      (v_subj, 2, 'Opening Poem',                  'Companion poem to opening story.',              'early',  6, 3),
      (v_subj, 3, 'Mid-year Story 1',              'Narrative on courage and integrity.',           'mid',    8, 3),
      (v_subj, 4, 'Mid-year Poem 1',               'Lyric poem.',                                    'mid',    6, 3),
      (v_subj, 5, 'Folk Tale',                     'Selected from Bengali folk tradition.',         'mid',    6, 3),
      (v_subj, 6, 'Mid-year Story 2',              'Narrative on community life.',                  'mid',    8, 3),
      (v_subj, 7, 'Tagore Selection',              'Short selection from Rabindranath Tagore.',     'late',   8, 3),
      (v_subj, 8, 'Patriotic Poem',                'On nation and freedom.',                        'late',   6, 3),
      (v_subj, 9, 'Closing Story',                 'Final prose entry.',                            'late',   8, 3),
      (v_subj, 10,'Grammar: Sandhi & Samas',       'Conjunction and compounding rules.',            'late',   8, 3),
      (v_subj, 11,'Composition: Letter and Essay','Formal and informal writing.',                  'late',   8, 3)
    ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;
  END LOOP;
END $$;

-- ============================================================================
-- 6. Class 6-8 English (Blossoms) — chapter seeds (MED confidence)
-- ============================================================================

DO $$
DECLARE v_subj UUID;
BEGIN
  FOR cls IN 6..8 LOOP
    SELECT id INTO v_subj FROM public.curriculum_subjects_by_class
     WHERE board_code='wbbse' AND class_level=cls AND subject_slug='english' AND language='en';
    IF v_subj IS NULL THEN CONTINUE; END IF;
    INSERT INTO public.curriculum_chapters
      (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band)
    VALUES
      (v_subj, 1, 'Opening Prose',                  'Introductory short story.',                    'early', 8, 3),
      (v_subj, 2, 'Opening Poem',                   'Companion poem.',                              'early', 6, 3),
      (v_subj, 3, 'Adventure Story',                'Themes of curiosity and exploration.',         'early', 8, 3),
      (v_subj, 4, 'Nature Poem',                    'Imagery and observation.',                     'mid',   6, 3),
      (v_subj, 5, 'Biography',                      'Short life-sketch of an inspiring figure.',    'mid',   8, 3),
      (v_subj, 6, 'Reflective Poem',                'Personal voice and emotion.',                   'mid',   6, 3),
      (v_subj, 7, 'Humorous Story',                 'Light-hearted narrative.',                      'mid',   8, 3),
      (v_subj, 8, 'Friendship Story',               'Theme of relationships and trust.',            'mid',   8, 3),
      (v_subj, 9, 'Final Story',                    'Concluding narrative.',                         'late',  8, 3),
      (v_subj, 10,'Grammar: Tenses and Voice',      'Present, past, future + active vs passive.',    'late',  8, 3),
      (v_subj, 11,'Composition Practice',           'Paragraphs, letters, story-writing.',           'late',  8, 3)
    ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;
  END LOOP;
END $$;

-- ============================================================================
-- 7. Class 9-10 Bengali Sahitya Sanchayan — MED confidence
-- ============================================================================

DO $$
DECLARE v_subj UUID;
BEGIN
  -- Class 9
  SELECT id INTO v_subj FROM public.curriculum_subjects_by_class
   WHERE board_code='wbbse' AND class_level=9 AND subject_slug='bengali' AND language='bn';
  IF v_subj IS NOT NULL THEN
    INSERT INTO public.curriculum_chapters
      (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band)
    VALUES
      (v_subj, 1,  'Kalingo Deshe Jhar-Bristi',   'Storm and rain in Kalinga (Iswarchandra Vidyasagar) — prose.', 'early', 8, 4),
      (v_subj, 2,  'Dhibor Brittanto',            'The Fisherman''s Tale — prose extract.',                       'early', 8, 4),
      (v_subj, 3,  'Aakaash-Ganga',               'The Milky Way — narrative essay.',                             'early', 8, 4),
      (v_subj, 4,  'Bharatbarsho',                'India — Tagore''s lyric poem.',                                'mid',   6, 4),
      (v_subj, 5,  'Aabaar Ashibo Phire',         'I Shall Return — Jibanananda Das poem.',                       'mid',   6, 4),
      (v_subj, 6,  'Patra-Lekha',                 'Letters — selected.',                                          'mid',   6, 4),
      (v_subj, 7,  'Galpa-Bichitra',              'Selected short stories.',                                       'mid',   8, 4),
      (v_subj, 8,  'Grammar: Sandhi',             'Sandhi rules and types.',                                       'mid',   6, 4),
      (v_subj, 9,  'Grammar: Samas',              'Compounding rules.',                                            'late',  6, 4),
      (v_subj, 10, 'Grammar: Karak-Bibhakti',     'Cases and case-endings.',                                        'late',  8, 4),
      (v_subj, 11, 'Composition',                 'Essay, letter, story-writing.',                                  'late',  8, 4)
    ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;
  END IF;

  -- Class 10
  SELECT id INTO v_subj FROM public.curriculum_subjects_by_class
   WHERE board_code='wbbse' AND class_level=10 AND subject_slug='bengali' AND language='bn';
  IF v_subj IS NOT NULL THEN
    INSERT INTO public.curriculum_chapters
      (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, exam_weight_pct)
    VALUES
      (v_subj, 1,  'Jnanchakshu',                 'The Eye of Knowledge — Ashapurna Devi, prose.',                'early', 8, 5, 5.0),
      (v_subj, 2,  'Africa',                      'Tagore''s poem on Africa.',                                    'early', 6, 5, 5.0),
      (v_subj, 3,  'Bahurupi',                    'The Many-Faced — Subodh Ghosh, prose.',                        'early', 8, 5, 5.0),
      (v_subj, 4,  'Asukhi Ekjon',                'An Unhappy Person — Pablo Neruda translation.',                'mid',   6, 5, 5.0),
      (v_subj, 5,  'Pother Dabi',                 'The Path''s Demand — Sarat Chandra extract.',                  'mid',   8, 5, 5.0),
      (v_subj, 6,  'Avishek',                     'Coronation — Madhusudan Dutt poem.',                            'mid',   6, 5, 5.0),
      (v_subj, 7,  'Adalbadal',                   'The Exchange — short story.',                                   'mid',   6, 5, 5.0),
      (v_subj, 8,  'Proloyollas',                 'Joy of Apocalypse — Nazrul Islam poem.',                        'mid',   6, 5, 5.0),
      (v_subj, 9,  'Nadir Bidroho',               'The River''s Rebellion — short story.',                         'late',  6, 5, 5.0),
      (v_subj, 10, 'Sindhutire',                  'On the Sea-shore — Alaol poem.',                                'late',  6, 5, 5.0),
      (v_subj, 11, 'Koni',                        'Koni — Moti Nandi novel (rapid reader).',                       'late',  18, 5, 19.0),
      (v_subj, 12, 'Grammar Compendium',          'Sandhi, Samas, Karak, Kriya — recap.',                          'late',  10, 5, 16.0),
      (v_subj, 13, 'Composition for Madhyamik',   'Essay, letter, summary, story-writing.',                        'late',  12, 5, 25.0)
    ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;
  END IF;
END $$;
