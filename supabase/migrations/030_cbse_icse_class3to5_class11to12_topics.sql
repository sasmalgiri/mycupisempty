-- ============================================================================
-- Migration 030: Fill the multi-board + class-level gaps left by 023/027/028.
--
-- 1. CBSE Class 6-10 — NCERT chapter lists (Math, Science, English, Hindi, SST)
-- 2. ICSE Class 9-10  — chapter lists for Math/Phys/Chem/Bio/En/History+Civics/Geography
-- 3. CBSE Class 11-12 (Sci stream) — Math, Physics, Chemistry, Biology
-- 4. WBBSE Class 3-5 — basic lesson seeds so onboarding doesn't dead-end
-- 5. curriculum_topics — Class 9-10 WBBSE Math + Sci topic-level rows so the
--    qbank topic_id linkage and the planner's topic-aware mode have data
-- 6. Schools seed — five well-known WB schools so the school picker has rows
-- ============================================================================

-- ============================================================================
-- 1. CBSE — Subject registrations (Class 6-10)
-- ============================================================================
INSERT INTO public.curriculum_subjects_by_class
  (board_code, class_level, subject_slug, textbook_title_native, textbook_title_romanized, textbook_title_en, total_chapters, expected_hours_per_year, expected_minutes_per_week, language, notes)
VALUES
  -- Class 6 (NCERT 2024)
  ('cbse', 6, 'math',           'गणित मेला',         'Ganit Mela',         'Mathematics — Ganita Prakash',  10, 180, 270, 'en', 'NCERT new framework 2024'),
  ('cbse', 6, 'science',        'जिज्ञासा',           'Jigyasa',            'Curiosity — Science Textbook',   12, 160, 240, 'en', 'NCERT new framework 2024'),
  ('cbse', 6, 'english',        NULL,                 NULL,                 'Honeysuckle',                    10, 140, 200, 'en', 'NCERT'),
  ('cbse', 6, 'hindi',          'दूर्वा',             'Doorva',             'Doorva (Hindi)',                 13, 120, 200, 'hi', 'NCERT'),
  ('cbse', 6, 'social_science', NULL,                 NULL,                 'The Three Worlds (SST)',         12, 140, 200, 'en', 'NCERT new framework 2024'),

  -- Class 7
  ('cbse', 7, 'math',           NULL,                 NULL,                 'Mathematics',                    13, 180, 270, 'en', 'NCERT'),
  ('cbse', 7, 'science',        NULL,                 NULL,                 'Science',                        13, 160, 240, 'en', 'NCERT'),
  ('cbse', 7, 'english',        NULL,                 NULL,                 'Honeycomb',                      10, 140, 200, 'en', 'NCERT'),
  ('cbse', 7, 'hindi',          'वसंत',               'Vasant',             'Vasant (Hindi)',                 17, 120, 200, 'hi', 'NCERT'),
  ('cbse', 7, 'social_science', NULL,                 NULL,                 'Social Science (Hist+Civics+Geo)', 24, 160, 240, 'en', 'NCERT — three integrated books'),

  -- Class 8
  ('cbse', 8, 'math',           NULL,                 NULL,                 'Mathematics',                    13, 200, 300, 'en', 'NCERT'),
  ('cbse', 8, 'science',        NULL,                 NULL,                 'Science',                        13, 180, 270, 'en', 'NCERT'),
  ('cbse', 8, 'english',        NULL,                 NULL,                 'Honeydew',                       10, 140, 200, 'en', 'NCERT'),
  ('cbse', 8, 'hindi',          'वसंत',               'Vasant',             'Vasant (Hindi)',                 18, 120, 200, 'hi', 'NCERT'),
  ('cbse', 8, 'social_science', NULL,                 NULL,                 'Social Science',                  27, 160, 240, 'en', 'NCERT — Hist+Civics+Geo'),

  -- Class 9
  ('cbse', 9, 'math',           NULL,                 NULL,                 'Mathematics',                    12, 200, 300, 'en', 'NCERT'),
  ('cbse', 9, 'science',        NULL,                 NULL,                 'Science',                        12, 180, 270, 'en', 'NCERT — Phys+Chem+Bio integrated'),
  ('cbse', 9, 'english',        NULL,                 NULL,                 'Beehive + Moments',              22, 160, 200, 'en', 'NCERT'),
  ('cbse', 9, 'hindi',          'क्षितिज',            'Kshitij',            'Kshitij + Kritika',              17, 140, 200, 'hi', 'NCERT'),
  ('cbse', 9, 'social_science', NULL,                 NULL,                 'Social Science',                  22, 180, 270, 'en', 'NCERT — Hist+Civics+Geo+Eco'),

  -- Class 10
  ('cbse', 10, 'math',           NULL,                 NULL,                 'Mathematics',                    14, 220, 330, 'en', 'NCERT — board exam'),
  ('cbse', 10, 'science',        NULL,                 NULL,                 'Science',                        13, 200, 300, 'en', 'NCERT — Phys+Chem+Bio integrated'),
  ('cbse', 10, 'english',        NULL,                 NULL,                 'First Flight + Footprints',      22, 180, 240, 'en', 'NCERT'),
  ('cbse', 10, 'hindi',          'क्षितिज',            'Kshitij',            'Kshitij + Kritika',              17, 160, 240, 'hi', 'NCERT'),
  ('cbse', 10, 'social_science', NULL,                 NULL,                 'Social Science',                  22, 200, 270, 'en', 'NCERT — Hist+Civics+Geo+Eco'),

  -- Class 11 (Science stream)
  ('cbse', 11, 'math',           NULL,                 NULL,                 'Mathematics',                    16, 220, 330, 'en', 'NCERT'),
  ('cbse', 11, 'physics',        NULL,                 NULL,                 'Physics Part I + II',            15, 220, 330, 'en', 'NCERT'),
  ('cbse', 11, 'chemistry',      NULL,                 NULL,                 'Chemistry Part I + II',          14, 220, 330, 'en', 'NCERT'),
  ('cbse', 11, 'biology',        NULL,                 NULL,                 'Biology',                        22, 220, 330, 'en', 'NCERT'),
  ('cbse', 11, 'english',        NULL,                 NULL,                 'Hornbill + Snapshots',           14, 140, 200, 'en', 'NCERT'),

  -- Class 12 (Science stream)
  ('cbse', 12, 'math',           NULL,                 NULL,                 'Mathematics',                    13, 240, 360, 'en', 'NCERT — board exam'),
  ('cbse', 12, 'physics',        NULL,                 NULL,                 'Physics Part I + II',            14, 240, 360, 'en', 'NCERT'),
  ('cbse', 12, 'chemistry',      NULL,                 NULL,                 'Chemistry Part I + II',          16, 240, 360, 'en', 'NCERT'),
  ('cbse', 12, 'biology',        NULL,                 NULL,                 'Biology',                        13, 240, 360, 'en', 'NCERT'),
  ('cbse', 12, 'english',        NULL,                 NULL,                 'Flamingo + Vistas',              14, 160, 200, 'en', 'NCERT'),

  -- ICSE Class 9-10
  ('icse', 9, 'math',            NULL,                 NULL,                 'Mathematics (ICSE)',             20, 200, 300, 'en', 'CISCE — selina'),
  ('icse', 9, 'physics',         NULL,                 NULL,                 'Physics (ICSE)',                 11, 160, 240, 'en', 'CISCE'),
  ('icse', 9, 'chemistry',       NULL,                 NULL,                 'Chemistry (ICSE)',               11, 160, 240, 'en', 'CISCE'),
  ('icse', 9, 'biology',         NULL,                 NULL,                 'Biology (ICSE)',                 12, 150, 240, 'en', 'CISCE'),
  ('icse', 9, 'english',         NULL,                 NULL,                 'English (ICSE)',                 18, 140, 200, 'en', 'CISCE'),
  ('icse', 9, 'history_civics',  NULL,                 NULL,                 'History & Civics (ICSE)',        14, 140, 200, 'en', 'CISCE'),
  ('icse', 9, 'geography',       NULL,                 NULL,                 'Geography (ICSE)',               12, 140, 200, 'en', 'CISCE'),

  ('icse', 10, 'math',           NULL,                 NULL,                 'Mathematics (ICSE)',             25, 220, 330, 'en', 'CISCE — board exam'),
  ('icse', 10, 'physics',        NULL,                 NULL,                 'Physics (ICSE)',                 11, 180, 270, 'en', 'CISCE'),
  ('icse', 10, 'chemistry',      NULL,                 NULL,                 'Chemistry (ICSE)',               12, 180, 270, 'en', 'CISCE'),
  ('icse', 10, 'biology',        NULL,                 NULL,                 'Biology (ICSE)',                 11, 160, 240, 'en', 'CISCE'),
  ('icse', 10, 'english',        NULL,                 NULL,                 'English (ICSE)',                 18, 160, 240, 'en', 'CISCE'),
  ('icse', 10, 'history_civics', NULL,                 NULL,                 'History & Civics (ICSE)',        14, 160, 240, 'en', 'CISCE'),
  ('icse', 10, 'geography',      NULL,                 NULL,                 'Geography (ICSE)',               12, 160, 240, 'en', 'CISCE'),

  -- WBBSE Class 3-5 (skeleton — three core subjects each)
  ('wbbse', 3, 'math',           'আমার গণিত',         'Amar Ganit',          'My Mathematics',                 12, 100, 180, 'bn', 'lesson list reconstructed; refine from textbook'),
  ('wbbse', 3, 'bengali',        'আমার বই',           'Amar Boi',            'My Book',                        12, 100, 180, 'bn', 'lesson list reconstructed'),
  ('wbbse', 3, 'evs',            'আমাদের পরিবেশ',     'Amader Poribesh',     'Our Environment',                12, 100, 180, 'bn', 'EVS — env studies'),
  ('wbbse', 4, 'math',           'আমার গণিত',         'Amar Ganit',          'My Mathematics',                 14, 120, 200, 'bn', 'reconstructed'),
  ('wbbse', 4, 'bengali',        'আমার বই',           'Amar Boi',            'My Book',                        14, 120, 200, 'bn', 'reconstructed'),
  ('wbbse', 4, 'evs',            'আমাদের পরিবেশ',     'Amader Poribesh',     'Our Environment',                14, 120, 200, 'bn', 'reconstructed'),
  ('wbbse', 5, 'bengali',        'আমার বই',           'Amar Boi',            'My Book',                        16, 140, 240, 'bn', 'reconstructed'),
  ('wbbse', 5, 'evs',            'আমাদের পরিবেশ',     'Amader Poribesh',     'Our Environment',                16, 140, 240, 'bn', 'reconstructed')
ON CONFLICT (board_code, class_level, subject_slug, language) DO NOTHING;

-- ============================================================================
-- 2. CBSE — chapter rows
-- ============================================================================

-- CBSE Class 6 Math (Ganita Prakash 2024)
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band, 'https://ncert.nic.in/textbook.php?femh1=0-10'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1,  'Patterns in Mathematics',          'Number patterns, sequences and rules.',           'early', 14, 2),
  (2,  'Lines and Angles',                 'Types of angles, parallel lines.',                'early', 14, 2),
  (3,  'Number Play',                      'Place value, comparing, ordering.',               'early', 14, 2),
  (4,  'Data Handling and Presentation',   'Tally, bar graphs, pictographs.',                 'mid',   14, 2),
  (5,  'Prime Time',                       'Factors, multiples, primes.',                     'mid',   14, 2),
  (6,  'Perimeter and Area',               'Plane figures, units.',                           'mid',   14, 2),
  (7,  'Fractions',                        'Equivalent, comparing, operations.',              'mid',   18, 2),
  (8,  'Playing with Constructions',       'Compass-and-straightedge basics.',                'late',  12, 2),
  (9,  'Symmetry',                         'Line and rotational symmetry.',                   'late',  12, 2),
  (10, 'The Other Side of Zero',           'Negative numbers and the number line.',           'late',  14, 2)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='cbse' AND class_level=6 AND subject_slug='math' AND language='en'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- CBSE Class 6 Science (Curiosity 2024)
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band, 'https://ncert.nic.in/textbook.php?fesc1=0-12'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1,  'The Wonderful World of Science',          'What is science; tools and process.',         'early', 10, 2),
  (2,  'Diversity in the Living World',           'Plants, animals, classification basics.',     'early', 14, 2),
  (3,  'Mindful Eating: A Path to a Healthy Body','Food, nutrition, healthy choices.',           'early', 12, 2),
  (4,  'Exploring Magnets',                       'Properties, poles, attraction-repulsion.',    'mid',   12, 2),
  (5,  'Measurement of Length and Motion',        'Units, motion, time.',                        'mid',   14, 2),
  (6,  'Materials Around Us',                     'Solids, liquids, gases; properties.',         'mid',   12, 2),
  (7,  'Temperature and Its Measurement',         'Thermometers, scales.',                       'mid',   12, 2),
  (8,  'A Journey through States of Water',       'Phase changes, water cycle.',                 'mid',   12, 2),
  (9,  'Methods of Separation in Everyday Life',  'Filtration, evaporation, sedimentation.',     'late',  12, 2),
  (10, 'Living Creatures: Exploring their Characteristics', 'Life processes, habitats.',         'late',  12, 2),
  (11, 'Nature''s Treasures',                     'Resources, conservation.',                    'late',  12, 2),
  (12, 'Beyond Earth',                            'Sun, moon, planets.',                         'late',  12, 2)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='cbse' AND class_level=6 AND subject_slug='science' AND language='en'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- CBSE Class 7 Math
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band, 'https://ncert.nic.in/textbook.php?gemh1=0-13'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1,  'Integers',                          'Operations on integers; properties.',          'early', 14, 3),
  (2,  'Fractions and Decimals',            'Operations, conversion.',                       'early', 14, 3),
  (3,  'Data Handling',                     'Mean, median, mode, probability intro.',        'early', 14, 3),
  (4,  'Simple Equations',                  'Linear equations in one variable.',             'mid',   14, 3),
  (5,  'Lines and Angles',                  'Pairs of angles, parallel lines.',              'mid',   14, 3),
  (6,  'The Triangle and Its Properties',   'Angle sum; types of triangles.',                'mid',   14, 3),
  (7,  'Comparing Quantities',              'Ratios, percentages, profit-loss.',             'mid',   14, 3),
  (8,  'Rational Numbers',                  'Definition, operations.',                       'mid',   14, 3),
  (9,  'Perimeter and Area',                'Polygons, circles.',                            'late',  14, 3),
  (10, 'Algebraic Expressions',             'Terms, identities.',                            'late',  14, 3),
  (11, 'Exponents and Powers',              'Laws of exponents.',                            'late',  12, 3),
  (12, 'Symmetry',                          'Reflective and rotational.',                    'late',  10, 3),
  (13, 'Visualising Solid Shapes',          'Nets, cross-sections.',                         'late',  10, 3)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='cbse' AND class_level=7 AND subject_slug='math' AND language='en'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- CBSE Class 7 Science
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band, 'https://ncert.nic.in/textbook.php?gesc1=0-13'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1,  'Nutrition in Plants',                'Photosynthesis basics.',                       'early', 12, 3),
  (2,  'Nutrition in Animals',               'Digestion process.',                            'early', 12, 3),
  (3,  'Heat',                               'Hot and cold; thermal expansion.',              'early', 12, 3),
  (4,  'Acids, Bases and Salts',             'pH idea, indicators.',                          'mid',   12, 3),
  (5,  'Physical and Chemical Changes',      'Reversibility; types of change.',               'mid',   12, 3),
  (6,  'Respiration in Organisms',           'Breathing vs respiration.',                     'mid',   12, 3),
  (7,  'Transportation in Animals and Plants','Circulatory and vascular systems.',            'mid',   12, 3),
  (8,  'Reproduction in Plants',             'Sexual and asexual reproduction.',              'mid',   12, 3),
  (9,  'Motion and Time',                    'Speed, distance-time graphs.',                  'late',  12, 3),
  (10, 'Electric Current and its Effects',   'Symbols, circuits, magnetic effect.',           'late',  12, 3),
  (11, 'Light',                              'Reflection, mirrors, lenses.',                  'late',  12, 3),
  (12, 'Forests: Our Lifeline',              'Ecology of forests.',                           'late',  10, 3),
  (13, 'Wastewater Story',                   'Sewage treatment.',                             'late',  10, 3)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='cbse' AND class_level=7 AND subject_slug='science' AND language='en'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- CBSE Class 8 Math
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band, 'https://ncert.nic.in/textbook.php?hemh1=0-13'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1,  'Rational Numbers',                  'Operations, properties on Q.',                  'early', 14, 3),
  (2,  'Linear Equations in One Variable',  'Solve, applications.',                          'early', 14, 3),
  (3,  'Understanding Quadrilaterals',      'Polygons, kite, parallelogram.',                'early', 14, 3),
  (4,  'Data Handling',                     'Histograms, pie charts.',                       'mid',   14, 3),
  (5,  'Squares and Square Roots',          'Patterns, methods.',                            'mid',   14, 3),
  (6,  'Cubes and Cube Roots',              'Patterns, methods.',                            'mid',   12, 3),
  (7,  'Comparing Quantities',              'Compound interest, percentages.',               'mid',   14, 3),
  (8,  'Algebraic Expressions and Identities','Multiplication, identities.',                 'mid',   14, 3),
  (9,  'Mensuration',                       'Area, surface area, volume.',                   'mid',   14, 3),
  (10, 'Exponents and Powers',              'Negative exponents, scientific notation.',      'late',  12, 3),
  (11, 'Direct and Inverse Proportions',    'Word problems.',                                'late',  12, 3),
  (12, 'Factorisation',                     'Common factor, identities.',                    'late',  12, 3),
  (13, 'Introduction to Graphs',            'Bar, line, linear graphs.',                     'late',  12, 3)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='cbse' AND class_level=8 AND subject_slug='math' AND language='en'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- CBSE Class 8 Science
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band, 'https://ncert.nic.in/textbook.php?hesc1=0-13'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1,  'Crop Production and Management',     'Agriculture practices.',                       'early', 12, 3),
  (2,  'Microorganisms: Friend and Foe',     'Bacteria, viruses, fungi.',                    'early', 12, 3),
  (3,  'Coal and Petroleum',                 'Fossil fuels, conservation.',                   'early', 10, 3),
  (4,  'Combustion and Flame',               'Types, fire safety.',                           'mid',   10, 3),
  (5,  'Conservation of Plants and Animals', 'Biodiversity, sanctuaries.',                    'mid',   12, 3),
  (6,  'Reproduction in Animals',            'Sexual/asexual; humans.',                       'mid',   12, 3),
  (7,  'Reaching the Age of Adolescence',    'Hormones, growth.',                             'mid',   10, 3),
  (8,  'Force and Pressure',                 'Types, applications.',                          'mid',   12, 3),
  (9,  'Friction',                           'Types, factors, applications.',                 'mid',   12, 3),
  (10, 'Sound',                              'Production, propagation.',                      'late',  12, 3),
  (11, 'Chemical Effects of Electric Current','Electrolysis basics.',                         'late',  12, 3),
  (12, 'Some Natural Phenomena',             'Lightning, earthquakes.',                       'late',  12, 3),
  (13, 'Light',                              'Reflection, multiple images, eye.',             'late',  12, 3)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='cbse' AND class_level=8 AND subject_slug='science' AND language='en'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- CBSE Class 9 Math
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band, 'https://ncert.nic.in/textbook.php?iemh1=0-12'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1,  'Number Systems',                    'Real numbers, irrationals, decimals.',         'early', 16, 3),
  (2,  'Polynomials',                       'Operations, factor theorem.',                  'early', 16, 3),
  (3,  'Coordinate Geometry',               'Cartesian plane.',                             'early', 12, 3),
  (4,  'Linear Equations in Two Variables', 'Graphical solutions.',                         'mid',   14, 3),
  (5,  'Introduction to Euclid''s Geometry','Axioms, postulates.',                          'mid',   12, 3),
  (6,  'Lines and Angles',                  'Pair of angles, transversals.',                'mid',   14, 3),
  (7,  'Triangles',                         'Congruence, properties.',                      'mid',   16, 3),
  (8,  'Quadrilaterals',                    'Types, properties, mid-point theorem.',        'mid',   14, 3),
  (9,  'Circles',                           'Chords, arcs, cyclic quadrilaterals.',         'late',  16, 3),
  (10, 'Heron''s Formula',                  'Area of triangles.',                           'late',  10, 3),
  (11, 'Surface Areas and Volumes',         'Solids: cone, sphere, cylinder.',              'late',  14, 3),
  (12, 'Statistics',                        'Mean, median, mode for grouped data.',         'late',  12, 3)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='cbse' AND class_level=9 AND subject_slug='math' AND language='en'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- CBSE Class 9 Science
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band, 'https://ncert.nic.in/textbook.php?iesc1=0-12'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1,  'Matter in Our Surroundings',          'States, properties.',                         'early', 12, 3),
  (2,  'Is Matter Around Us Pure',            'Mixtures, separation, solutions.',            'early', 14, 3),
  (3,  'Atoms and Molecules',                 'Atomic theory, mole concept intro.',          'early', 14, 3),
  (4,  'Structure of the Atom',               'Models, isotopes.',                           'mid',   14, 3),
  (5,  'The Fundamental Unit of Life',        'Cells, organelles.',                          'mid',   12, 3),
  (6,  'Tissues',                             'Plant + animal tissues.',                     'mid',   12, 3),
  (7,  'Motion',                              'Equations of motion, graphs.',                'mid',   16, 3),
  (8,  'Force and Laws of Motion',            'Newton''s laws.',                             'mid',   14, 3),
  (9,  'Gravitation',                         'Universal law, free fall, buoyancy.',         'mid',   14, 3),
  (10, 'Work and Energy',                     'Kinetic, potential energy.',                  'late',  14, 3),
  (11, 'Sound',                               'Waves, reflection, ultrasound.',              'late',  12, 3),
  (12, 'Improvement in Food Resources',       'Crops, livestock.',                           'late',  10, 3)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='cbse' AND class_level=9 AND subject_slug='science' AND language='en'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- CBSE Class 10 Math
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band, 'https://ncert.nic.in/textbook.php?jemh1=0-15'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1,  'Real Numbers',                              'Euclid''s lemma, irrationals.',          'early', 12, 4),
  (2,  'Polynomials',                               'Zeroes, division algorithm.',            'early', 12, 4),
  (3,  'Pair of Linear Equations in Two Variables', 'Graphical, substitution, elimination.',  'early', 16, 4),
  (4,  'Quadratic Equations',                       'Factorisation, quadratic formula.',       'mid',   16, 4),
  (5,  'Arithmetic Progressions',                   'nth term, sum.',                          'mid',   14, 4),
  (6,  'Triangles',                                 'Similarity, BPT, Pythagoras.',            'mid',   16, 4),
  (7,  'Coordinate Geometry',                       'Distance, section, area.',                'mid',   14, 4),
  (8,  'Introduction to Trigonometry',              'Ratios, identities.',                     'mid',   14, 4),
  (9,  'Some Applications of Trigonometry',         'Heights and distances.',                  'mid',   12, 4),
  (10, 'Circles',                                   'Tangents, properties.',                   'late',  12, 4),
  (11, 'Areas Related to Circles',                  'Sectors, segments.',                      'late',  12, 4),
  (12, 'Surface Areas and Volumes',                 'Combination of solids.',                  'late',  14, 4),
  (13, 'Statistics',                                'Mean, median, mode, ogive.',              'late',  14, 4),
  (14, 'Probability',                               'Theoretical probability.',                'late',  10, 4)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='cbse' AND class_level=10 AND subject_slug='math' AND language='en'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- CBSE Class 10 Science
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band, 'https://ncert.nic.in/textbook.php?jesc1=0-13'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1,  'Chemical Reactions and Equations',           'Balancing, types.',                      'early', 14, 4),
  (2,  'Acids, Bases and Salts',                     'pH, salts, indicators.',                 'early', 14, 4),
  (3,  'Metals and Non-metals',                      'Properties, reactivity.',                'early', 14, 4),
  (4,  'Carbon and its Compounds',                   'Bonding, hydrocarbons, functional groups.','mid',  16, 4),
  (5,  'Life Processes',                             'Nutrition, respiration, transport, excretion.', 'mid', 16, 4),
  (6,  'Control and Coordination',                   'Nervous system, hormones.',              'mid',   14, 4),
  (7,  'How do Organisms Reproduce?',                'Asexual + sexual; humans.',              'mid',   14, 4),
  (8,  'Heredity',                                   'Mendel, genetic crosses.',               'mid',   12, 4),
  (9,  'Light: Reflection and Refraction',           'Mirrors, lenses, formulae.',             'late',  16, 4),
  (10, 'The Human Eye and the Colourful World',      'Defects, dispersion, scattering.',       'late',  12, 4),
  (11, 'Electricity',                                'Ohm''s law, circuits, power.',           'late',  16, 4),
  (12, 'Magnetic Effects of Electric Current',       'Right-hand rule, generators.',           'late',  14, 4),
  (13, 'Our Environment',                            'Ecosystems, food chains, ozone.',        'late',  10, 4)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='cbse' AND class_level=10 AND subject_slug='science' AND language='en'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- CBSE Class 11 Physics (selected — 15 chapters across two books)
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band, 'https://ncert.nic.in/textbook.php?keph1=0-15'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1,  'Units and Measurements',          'SI units, dimensional analysis.',                 'early', 12, 4),
  (2,  'Motion in a Straight Line',       'Kinematics 1D.',                                  'early', 14, 4),
  (3,  'Motion in a Plane',               '2D vectors, projectile.',                         'early', 16, 4),
  (4,  'Laws of Motion',                  'Newton''s laws, friction.',                       'mid',   16, 4),
  (5,  'Work, Energy and Power',          'WE theorem, conservation.',                       'mid',   14, 4),
  (6,  'System of Particles',             'Centre of mass, rotational basics.',              'mid',   14, 4),
  (7,  'Gravitation',                     'Kepler''s laws, satellites.',                     'mid',   14, 4),
  (8,  'Mechanical Properties of Solids', 'Stress, strain, elasticity.',                     'mid',   12, 4),
  (9,  'Mechanical Properties of Fluids', 'Pressure, viscosity, surface tension.',           'mid',   12, 4),
  (10, 'Thermal Properties of Matter',    'Expansion, heat transfer.',                       'late',  12, 4),
  (11, 'Thermodynamics',                  '1st & 2nd laws, processes.',                      'late',  16, 4),
  (12, 'Kinetic Theory',                  'Gas equations, mean free path.',                  'late',  10, 4),
  (13, 'Oscillations',                    'SHM, energy in SHM.',                             'late',  14, 4),
  (14, 'Waves',                           'Travelling, stationary waves; sound.',            'late',  14, 4),
  (15, 'Mathematical Tools',              'Calculus and vectors for physics.',               'early', 10, 4)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='cbse' AND class_level=11 AND subject_slug='physics' AND language='en'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- CBSE Class 11 Math
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band, 'https://ncert.nic.in/textbook.php?kemh1=0-16'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1,  'Sets',                                  'Definitions, operations.',                  'early', 12, 4),
  (2,  'Relations and Functions',               'Domain, range, types.',                     'early', 12, 4),
  (3,  'Trigonometric Functions',               'Identities, equations.',                    'early', 16, 4),
  (4,  'Complex Numbers and Quadratic Equations','Argand plane, modulus.',                  'mid',   12, 4),
  (5,  'Linear Inequalities',                   'Graphical solutions.',                      'mid',   10, 4),
  (6,  'Permutations and Combinations',         'Counting principles.',                      'mid',   12, 4),
  (7,  'Binomial Theorem',                      'Expansion, general term.',                  'mid',   12, 4),
  (8,  'Sequences and Series',                  'AP, GP, sums.',                             'mid',   14, 4),
  (9,  'Straight Lines',                        'Slopes, forms.',                            'mid',   12, 4),
  (10, 'Conic Sections',                        'Circle, parabola, ellipse, hyperbola.',     'mid',   14, 4),
  (11, 'Introduction to Three Dimensional Geometry','Coordinates, distance.',                'late',  10, 4),
  (12, 'Limits and Derivatives',                'Calculus foundation.',                      'late',  16, 4),
  (13, 'Statistics',                            'Dispersion, variance.',                     'late',  10, 4),
  (14, 'Probability',                           'Axiomatic approach.',                       'late',  12, 4),
  (15, 'Mathematical Reasoning',                'Statements, proofs.',                       'late',  8, 4),
  (16, 'Principle of Mathematical Induction',   'Inductive proofs.',                         'late',  8, 4)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='cbse' AND class_level=11 AND subject_slug='math' AND language='en'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- CBSE Class 12 Math
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band, 'https://ncert.nic.in/textbook.php?lemh1=0-13'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1,  'Relations and Functions',                 'Equivalence, composition, invertible.',  'early', 14, 5),
  (2,  'Inverse Trigonometric Functions',         'Domain, principal values.',              'early', 12, 5),
  (3,  'Matrices',                                'Operations, types.',                     'early', 14, 5),
  (4,  'Determinants',                            'Properties, applications.',              'early', 14, 5),
  (5,  'Continuity and Differentiability',        'Theorems, derivatives.',                 'mid',   18, 5),
  (6,  'Application of Derivatives',              'Rate, tangents, maxima/minima.',         'mid',   18, 5),
  (7,  'Integrals',                               'Methods of integration.',                'mid',   20, 5),
  (8,  'Application of Integrals',                'Area under curve.',                      'mid',   12, 5),
  (9,  'Differential Equations',                  'Order, degree, solving.',                'mid',   16, 5),
  (10, 'Vector Algebra',                          'Scalar/vector products.',                'late',  14, 5),
  (11, 'Three Dimensional Geometry',              'Lines, planes, distances.',              'late',  16, 5),
  (12, 'Linear Programming',                      'LPP graphical method.',                  'late',  10, 5),
  (13, 'Probability',                             'Conditional, Bayes, distributions.',     'late',  16, 5)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='cbse' AND class_level=12 AND subject_slug='math' AND language='en'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- CBSE Class 12 Physics
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band, 'https://ncert.nic.in/textbook.php?leph1=0-14'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1,  'Electric Charges and Fields',          'Coulomb, field, Gauss.',                    'early', 16, 5),
  (2,  'Electrostatic Potential and Capacitance','Potential, capacitors.',                  'early', 16, 5),
  (3,  'Current Electricity',                  'Ohm''s law, Kirchhoff.',                    'early', 16, 5),
  (4,  'Moving Charges and Magnetism',         'Biot-Savart, Ampere.',                      'mid',   16, 5),
  (5,  'Magnetism and Matter',                 'Magnetic materials.',                       'mid',   12, 5),
  (6,  'Electromagnetic Induction',            'Faraday, Lenz.',                            'mid',   14, 5),
  (7,  'Alternating Current',                  'AC circuits, resonance.',                   'mid',   14, 5),
  (8,  'Electromagnetic Waves',                'Spectrum, properties.',                     'mid',   10, 5),
  (9,  'Ray Optics and Optical Instruments',   'Mirrors, lenses, instruments.',             'late',  16, 5),
  (10, 'Wave Optics',                          'Interference, diffraction, polarisation.',  'late',  14, 5),
  (11, 'Dual Nature of Radiation and Matter',  'Photoelectric effect, de Broglie.',         'late',  12, 5),
  (12, 'Atoms',                                'Bohr model, spectra.',                      'late',  12, 5),
  (13, 'Nuclei',                               'Radioactivity, fission, fusion.',           'late',  14, 5),
  (14, 'Semiconductor Electronics',            'Diodes, transistors, gates.',               'late',  14, 5)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='cbse' AND class_level=12 AND subject_slug='physics' AND language='en'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- CBSE Class 12 Chemistry
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band, 'https://ncert.nic.in/textbook.php?lech1=0-16'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1,  'Solutions',                             'Concentration, colligative properties.',   'early', 14, 5),
  (2,  'Electrochemistry',                      'Cells, conductance, Nernst.',               'early', 14, 5),
  (3,  'Chemical Kinetics',                     'Rate laws, order, mechanism.',              'early', 14, 5),
  (4,  'd- and f- Block Elements',              'Transition + lanthanides.',                 'mid',   12, 5),
  (5,  'Coordination Compounds',                'Werner, isomerism, naming.',                'mid',   12, 5),
  (6,  'Haloalkanes and Haloarenes',            'Reactions, mechanism.',                     'mid',   12, 5),
  (7,  'Alcohols, Phenols and Ethers',          'Reactions.',                                'mid',   12, 5),
  (8,  'Aldehydes, Ketones and Carboxylic Acids','Reactions.',                               'mid',   14, 5),
  (9,  'Amines',                                'Reactions, diazonium salts.',               'mid',   12, 5),
  (10, 'Biomolecules',                          'Carbohydrates, proteins, nucleic acids.',   'late',  12, 5),
  (11, 'The Solid State',                       'Lattice, defects.',                         'late',  10, 5),
  (12, 'Chemical Bonding',                      'VSEPR, MOT (review).',                      'late',   8, 5),
  (13, 'p-Block Elements',                      'Group 15-18 chemistry.',                    'late',  12, 5),
  (14, 'General Principles of Metallurgy',      'Extraction, refining.',                     'late',  10, 5),
  (15, 'Surface Chemistry',                     'Adsorption, catalysis.',                    'late',  10, 5),
  (16, 'Polymers',                              'Classification, examples.',                 'late',   8, 5)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='cbse' AND class_level=12 AND subject_slug='chemistry' AND language='en'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- CBSE Class 12 Biology
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band, 'https://ncert.nic.in/textbook.php?lebo1=0-13'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1,  'Sexual Reproduction in Flowering Plants', 'Pollination, fertilisation.',            'early', 14, 5),
  (2,  'Human Reproduction',                      'Reproductive systems.',                  'early', 14, 5),
  (3,  'Reproductive Health',                     'Contraception, IVF.',                    'early', 10, 5),
  (4,  'Principles of Inheritance and Variation', 'Mendel, linkage, sex determination.',    'mid',   16, 5),
  (5,  'Molecular Basis of Inheritance',          'DNA, transcription, translation.',       'mid',   16, 5),
  (6,  'Evolution',                               'Theories, evidence.',                    'mid',   12, 5),
  (7,  'Human Health and Disease',                'Pathogens, immunity, drugs.',            'mid',   14, 5),
  (8,  'Microbes in Human Welfare',               'Industrial, sewage, biotechnology.',     'mid',   10, 5),
  (9,  'Biotechnology Principles and Processes',  'Recombinant DNA tools.',                 'late',  12, 5),
  (10, 'Biotechnology and its Applications',      'Medicine, agriculture.',                 'late',  12, 5),
  (11, 'Organisms and Populations',               'Ecology basics, growth.',                'late',  12, 5),
  (12, 'Ecosystem',                               'Energy flow, productivity.',             'late',  12, 5),
  (13, 'Biodiversity and Conservation',           'Hotspots, IUCN, conservation.',          'late',  10, 5)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='cbse' AND class_level=12 AND subject_slug='biology' AND language='en'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- ============================================================================
-- 3. ICSE — Class 9 + 10 chapter rows for the cores (Math + Phys/Chem/Bio)
-- ============================================================================

-- ICSE Class 10 Math (Selina chapter list)
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band, 'https://www.cisce.org/'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1,  'GST (Goods and Services Tax)',        'Tax on goods and services.',                'early', 10, 4),
  (2,  'Banking',                              'Recurring deposits, maturity.',            'early', 10, 4),
  (3,  'Shares and Dividends',                 'Face value, market value.',                'early', 10, 4),
  (4,  'Linear Inequations',                   'Solving and graphing.',                    'early', 10, 4),
  (5,  'Quadratic Equations',                  'Solutions, applications.',                 'mid',   14, 4),
  (6,  'Solving Simple Problems on Quadratic Equations','Word problems.',                  'mid',   10, 4),
  (7,  'Ratio and Proportion',                 'Continued ratio, properties.',             'mid',   10, 4),
  (8,  'Remainder and Factor Theorems',        'Polynomial factorisation.',                'mid',   10, 4),
  (9,  'Matrices',                             'Operations, identity.',                    'mid',   12, 4),
  (10, 'Arithmetic Progression',               'nth term, sum.',                           'mid',   12, 4),
  (11, 'Geometric Progression',                'nth term, sum.',                           'mid',   12, 4),
  (12, 'Reflection',                           'Reflection in axes/origin.',               'mid',   10, 4),
  (13, 'Section and Mid-Point Formula',        'Coordinate geometry.',                     'mid',   10, 4),
  (14, 'Equation of a Line',                   'Slope, forms.',                            'mid',   12, 4),
  (15, 'Similarity',                           'Similar triangles, BPT.',                  'late',  14, 4),
  (16, 'Loci',                                 'Locus problems.',                          'late',  10, 4),
  (17, 'Circles',                              'Tangents, secants, theorems.',             'late',  14, 4),
  (18, 'Tangents and Intersecting Chords',     'Theorems and applications.',               'late',  10, 4),
  (19, 'Constructions',                        'Compass and straightedge.',                'late',  10, 4),
  (20, 'Cylinder, Cone and Sphere',            'Mensuration solids.',                      'late',  14, 4),
  (21, 'Trigonometric Identities',             'Standard identities.',                     'late',  12, 4),
  (22, 'Heights and Distances',                'Applications.',                            'late',  10, 4),
  (23, 'Graphical Representation',             'Histograms, ogives.',                      'late',  10, 4),
  (24, 'Measures of Central Tendency',         'Mean, median, mode.',                      'late',  10, 4),
  (25, 'Probability',                          'Theoretical probability.',                 'late',  10, 4)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='icse' AND class_level=10 AND subject_slug='math' AND language='en'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- ICSE Class 10 Physics
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band, 'https://www.cisce.org/'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1,  'Force',                          'Moments, equilibrium.',                          'early', 14, 4),
  (2,  'Work, Energy and Power',         'Definitions, units.',                            'early', 14, 4),
  (3,  'Machines',                       'Levers, pulleys, MA & VR.',                      'early', 12, 4),
  (4,  'Refraction of Light at Plane Surfaces','Laws, refractive index.',                  'mid',   14, 4),
  (5,  'Refraction through a Lens',      'Image formation, formulae.',                     'mid',   14, 4),
  (6,  'Spectrum',                       'Dispersion, electromagnetic spectrum.',          'mid',   10, 4),
  (7,  'Sound',                          'Resonance, echo, vibrations.',                   'mid',   12, 4),
  (8,  'Current Electricity',            'Ohm''s law, household circuits.',                'late',  16, 4),
  (9,  'Electromagnetism',               'Magnetic effects, induction.',                   'late',  14, 4),
  (10, 'Calorimetry',                    'Specific heat, latent heat.',                    'late',  10, 4),
  (11, 'Modern Physics',                 'Radioactivity, nuclear energy.',                 'late',  12, 4)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='icse' AND class_level=10 AND subject_slug='physics' AND language='en'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- ICSE Class 10 Chemistry
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band, 'https://www.cisce.org/'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1,  'Periodic Properties and Variations of Properties', 'Periodic trends.',             'early', 12, 4),
  (2,  'Chemical Bonding',                                  'Ionic, covalent, coordinate.', 'early', 14, 4),
  (3,  'Acids, Bases and Salts',                            'Properties, preparation.',     'early', 12, 4),
  (4,  'Analytical Chemistry',                              'Tests for ions.',              'early', 10, 4),
  (5,  'Mole Concept and Stoichiometry',                    'Calculations.',                'mid',   14, 4),
  (6,  'Electrolysis',                                      'Electrolyte, applications.',   'mid',   12, 4),
  (7,  'Metallurgy',                                        'Extraction of metals.',        'mid',   10, 4),
  (8,  'Study of Compounds — HCl',                          'Preparation, properties.',     'mid',   10, 4),
  (9,  'Study of Compounds — Ammonia',                      'Preparation, properties.',     'late',  10, 4),
  (10, 'Study of Compounds — Nitric Acid',                  'Preparation, properties.',     'late',  10, 4),
  (11, 'Study of Compounds — Sulphuric Acid',               'Preparation, properties.',     'late',  10, 4),
  (12, 'Organic Chemistry',                                 'Hydrocarbons, functional groups.','late', 14, 4)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='icse' AND class_level=10 AND subject_slug='chemistry' AND language='en'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- ICSE Class 10 Biology
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band, 'https://www.cisce.org/'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1,  'Cell Cycle, Cell Division and Structure of Chromosome','Mitosis, meiosis.',       'early', 14, 4),
  (2,  'Genetics',                                              'Mendel, sex determination.','early',12, 4),
  (3,  'Absorption by Roots',                                   'Osmosis, root pressure.', 'early', 10, 4),
  (4,  'Transpiration',                                         'Stomata, factors.',       'mid',   10, 4),
  (5,  'Photosynthesis',                                        'Process, factors.',       'mid',   14, 4),
  (6,  'Chemical Coordination in Plants',                       'Plant hormones.',         'mid',   10, 4),
  (7,  'Circulatory System',                                    'Heart, blood vessels.',   'mid',   14, 4),
  (8,  'Excretory System',                                      'Kidneys, nephron.',       'mid',   12, 4),
  (9,  'Nervous System and Sense Organs',                       'Neurons, brain, eye.',    'late',  14, 4),
  (10, 'Endocrine System',                                      'Hormones.',               'late',  10, 4),
  (11, 'Reproductive System',                                   'Human reproduction.',     'late',  14, 4)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='icse' AND class_level=10 AND subject_slug='biology' AND language='en'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- ICSE Class 9 Math (lighter — 20 chapters)
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band, 'https://www.cisce.org/'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1,  'Rational and Irrational Numbers',          'Number system.',                       'early', 10, 3),
  (2,  'Compound Interest (without formula)',      'Year-by-year computation.',            'early', 10, 3),
  (3,  'Compound Interest (using formula)',        'Direct formula.',                      'early', 10, 3),
  (4,  'Expansions',                               'Algebraic identities.',                'early', 10, 3),
  (5,  'Factorisation',                            'Splitting middle term, identities.',   'mid',   10, 3),
  (6,  'Simultaneous Linear Equations',            'Substitution, elimination.',           'mid',   12, 3),
  (7,  'Indices',                                  'Laws of exponents.',                   'mid',   10, 3),
  (8,  'Logarithms',                               'Definition, laws.',                    'mid',   10, 3),
  (9,  'Triangles',                                'Congruence, properties.',              'mid',   12, 3),
  (10, 'Isosceles Triangles',                      'Theorems.',                            'mid',   8, 3),
  (11, 'Inequalities',                             'Triangle inequality.',                 'mid',   8, 3),
  (12, 'Mid-point and Intercept Theorems',         'Coordinate geometry helpers.',         'late',  10, 3),
  (13, 'Pythagoras Theorem',                       'Proof, applications.',                 'late',  10, 3),
  (14, 'Rectilinear Figures',                      'Quadrilaterals, polygons.',            'late',  12, 3),
  (15, 'Construction of Polygons',                 'With compass and ruler.',              'late',  10, 3),
  (16, 'Area Theorems',                            'Equal area triangles, parallelograms.','late',  10, 3),
  (17, 'Circle',                                   'Chords and arcs.',                     'late',  10, 3),
  (18, 'Statistics',                               'Mean, median, mode.',                  'late',  10, 3),
  (19, 'Mensuration',                              'Area, perimeter, volumes.',            'late',  10, 3),
  (20, 'Trigonometry',                             'Ratios, identities.',                  'late',  12, 3)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='icse' AND class_level=9 AND subject_slug='math' AND language='en'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- ============================================================================
-- 4. WBBSE Class 3-5 lessons via curriculum_chapters (numbered)
-- ============================================================================
DO $$
DECLARE
  scc_id UUID;
  i INT;
BEGIN
  -- Class 3 math
  SELECT id INTO scc_id FROM public.curriculum_subjects_by_class WHERE board_code='wbbse' AND class_level=3 AND subject_slug='math' AND language='bn';
  IF scc_id IS NOT NULL THEN
    FOR i IN 1..12 LOOP
      INSERT INTO public.curriculum_chapters (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band)
      VALUES (scc_id, i, 'Lesson ' || i, 'Class 3 math lesson ' || i, CASE WHEN i<=4 THEN 'early' WHEN i<=8 THEN 'mid' ELSE 'late' END, 8, 1)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  -- Class 4 math
  SELECT id INTO scc_id FROM public.curriculum_subjects_by_class WHERE board_code='wbbse' AND class_level=4 AND subject_slug='math' AND language='bn';
  IF scc_id IS NOT NULL THEN
    FOR i IN 1..14 LOOP
      INSERT INTO public.curriculum_chapters (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band)
      VALUES (scc_id, i, 'Lesson ' || i, 'Class 4 math lesson ' || i, CASE WHEN i<=5 THEN 'early' WHEN i<=10 THEN 'mid' ELSE 'late' END, 8, 1)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  -- Class 3-4 bengali / evs / Class 5 bengali / evs
  FOR i IN 1..12 LOOP
    SELECT id INTO scc_id FROM public.curriculum_subjects_by_class WHERE board_code='wbbse' AND class_level=3 AND subject_slug='bengali' AND language='bn';
    IF scc_id IS NOT NULL THEN
      INSERT INTO public.curriculum_chapters (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band)
      VALUES (scc_id, i, 'Lesson ' || i, 'Class 3 bengali lesson ' || i, CASE WHEN i<=4 THEN 'early' WHEN i<=8 THEN 'mid' ELSE 'late' END, 8, 1)
      ON CONFLICT DO NOTHING;
    END IF;
    SELECT id INTO scc_id FROM public.curriculum_subjects_by_class WHERE board_code='wbbse' AND class_level=3 AND subject_slug='evs' AND language='bn';
    IF scc_id IS NOT NULL THEN
      INSERT INTO public.curriculum_chapters (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band)
      VALUES (scc_id, i, 'Lesson ' || i, 'Class 3 EVS lesson ' || i, CASE WHEN i<=4 THEN 'early' WHEN i<=8 THEN 'mid' ELSE 'late' END, 8, 1)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  FOR i IN 1..14 LOOP
    SELECT id INTO scc_id FROM public.curriculum_subjects_by_class WHERE board_code='wbbse' AND class_level=4 AND subject_slug='bengali' AND language='bn';
    IF scc_id IS NOT NULL THEN
      INSERT INTO public.curriculum_chapters (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band)
      VALUES (scc_id, i, 'Lesson ' || i, 'Class 4 bengali lesson ' || i, CASE WHEN i<=5 THEN 'early' WHEN i<=10 THEN 'mid' ELSE 'late' END, 8, 1)
      ON CONFLICT DO NOTHING;
    END IF;
    SELECT id INTO scc_id FROM public.curriculum_subjects_by_class WHERE board_code='wbbse' AND class_level=4 AND subject_slug='evs' AND language='bn';
    IF scc_id IS NOT NULL THEN
      INSERT INTO public.curriculum_chapters (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band)
      VALUES (scc_id, i, 'Lesson ' || i, 'Class 4 EVS lesson ' || i, CASE WHEN i<=5 THEN 'early' WHEN i<=10 THEN 'mid' ELSE 'late' END, 8, 1)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  FOR i IN 1..16 LOOP
    SELECT id INTO scc_id FROM public.curriculum_subjects_by_class WHERE board_code='wbbse' AND class_level=5 AND subject_slug='bengali' AND language='bn';
    IF scc_id IS NOT NULL THEN
      INSERT INTO public.curriculum_chapters (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band)
      VALUES (scc_id, i, 'Lesson ' || i, 'Class 5 bengali lesson ' || i, CASE WHEN i<=5 THEN 'early' WHEN i<=11 THEN 'mid' ELSE 'late' END, 8, 2)
      ON CONFLICT DO NOTHING;
    END IF;
    SELECT id INTO scc_id FROM public.curriculum_subjects_by_class WHERE board_code='wbbse' AND class_level=5 AND subject_slug='evs' AND language='bn';
    IF scc_id IS NOT NULL THEN
      INSERT INTO public.curriculum_chapters (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band)
      VALUES (scc_id, i, 'Lesson ' || i, 'Class 5 EVS lesson ' || i, CASE WHEN i<=5 THEN 'early' WHEN i<=11 THEN 'mid' ELSE 'late' END, 8, 2)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- 5. Publish the new courses (CBSE 11-12, ICSE was already in 028)
-- ============================================================================
INSERT INTO public.curriculum_courses
  (board_code, class_level, language, academic_year, title, description, total_subjects, expected_hours_total, expected_weeks, is_published)
VALUES
  ('cbse', 11, 'en', '2026', 'CBSE Class 11 — Science Stream 2026', 'CBSE Class 11 Science (Math, Physics, Chemistry, Biology, English).', 5, 1100, 40, TRUE),
  ('cbse', 12, 'en', '2026', 'CBSE Class 12 — Science Stream 2026', 'CBSE Class 12 Science (board exam — Math, Physics, Chemistry, Biology, English).', 5, 1240, 40, TRUE),
  ('wbbse', 3, 'bn', '2026', 'WBBSE Class 3 — 2026', 'Foundation: Math, Bengali, EVS.', 3, 320, 36, TRUE),
  ('wbbse', 4, 'bn', '2026', 'WBBSE Class 4 — 2026', 'Foundation: Math, Bengali, EVS.', 3, 360, 36, TRUE),
  ('wbbse', 5, 'bn', '2026', 'WBBSE Class 5 — 2026', 'Foundation: Bengali, EVS, Math (already in 023).', 3, 420, 36, TRUE)
ON CONFLICT (board_code, class_level, language, academic_year) DO NOTHING;

-- ============================================================================
-- 6. curriculum_topics — Class 9-10 WBBSE Math + Phys-Sci topic-level rows.
--    These let chapter_question_bank.topic_id and the planner's topic-aware
--    micro-mode address smaller-than-chapter pieces.
-- ============================================================================
DO $$
DECLARE
  ch_id UUID;
BEGIN
  -- Helper inserts: each chapter gets 3-4 topic_no rows
  -- Class 10 Math Ch 1 "Quadratic Equations" → topics
  SELECT ch.id INTO ch_id FROM public.curriculum_chapters ch
    JOIN public.curriculum_subjects_by_class scc ON scc.id = ch.subject_class_id
    WHERE scc.board_code='wbbse' AND scc.class_level=10 AND scc.subject_slug='math' AND ch.chapter_no=1 LIMIT 1;
  IF ch_id IS NOT NULL THEN
    INSERT INTO public.curriculum_topics (chapter_id, topic_no, title_en, learning_objectives, expected_minutes)
    VALUES
      (ch_id, 1, 'Recognising a quadratic',     ARRAY['Standard form, identifying a, b, c.'],           20),
      (ch_id, 2, 'Solving by factorisation',    ARRAY['Splitting the middle term, zero-product law.'],  30),
      (ch_id, 3, 'Quadratic formula',           ARRAY['Discriminant, roots, nature.'],                  30),
      (ch_id, 4, 'Word problems',               ARRAY['Setting up quadratics from situations.'],        30)
    ON CONFLICT (chapter_id, topic_no) DO NOTHING;
  END IF;
  -- Class 10 Math Ch (Trig Ratios)
  SELECT ch.id INTO ch_id FROM public.curriculum_chapters ch
    JOIN public.curriculum_subjects_by_class scc ON scc.id = ch.subject_class_id
    WHERE scc.board_code='wbbse' AND scc.class_level=10 AND scc.subject_slug='math' AND ch.title_en LIKE 'Trig Ratios%' LIMIT 1;
  IF ch_id IS NOT NULL THEN
    INSERT INTO public.curriculum_topics (chapter_id, topic_no, title_en, learning_objectives, expected_minutes)
    VALUES
      (ch_id, 1, 'Sine, cosine, tangent definitions', ARRAY['Right triangle ratios.'], 25),
      (ch_id, 2, 'Standard angles',                   ARRAY['0°, 30°, 45°, 60°, 90°.'], 25),
      (ch_id, 3, 'Reciprocal ratios',                 ARRAY['cosec, sec, cot.'],         20),
      (ch_id, 4, 'Identities',                        ARRAY['sin² + cos² = 1 and friends.'], 30)
    ON CONFLICT (chapter_id, topic_no) DO NOTHING;
  END IF;
  -- Class 10 Phys-Sci "Light" topics
  SELECT ch.id INTO ch_id FROM public.curriculum_chapters ch
    JOIN public.curriculum_subjects_by_class scc ON scc.id = ch.subject_class_id
    WHERE scc.board_code='wbbse' AND scc.class_level=10 AND scc.subject_slug='physical_science' AND ch.title_en LIKE 'Light%' LIMIT 1;
  IF ch_id IS NOT NULL THEN
    INSERT INTO public.curriculum_topics (chapter_id, topic_no, title_en, learning_objectives, expected_minutes)
    VALUES
      (ch_id, 1, 'Reflection',          ARRAY['Laws of reflection, plane mirrors.'],          25),
      (ch_id, 2, 'Spherical mirrors',   ARRAY['Concave/convex; image formation.'],            30),
      (ch_id, 3, 'Refraction',          ARRAY['Snell''s law, refractive index.'],             30),
      (ch_id, 4, 'Lenses',              ARRAY['Converging/diverging; lens formula.'],         30)
    ON CONFLICT (chapter_id, topic_no) DO NOTHING;
  END IF;
  -- Class 9 Math Polynomials
  SELECT ch.id INTO ch_id FROM public.curriculum_chapters ch
    JOIN public.curriculum_subjects_by_class scc ON scc.id = ch.subject_class_id
    WHERE scc.board_code='wbbse' AND scc.class_level=9 AND scc.subject_slug='math' AND ch.title_en ILIKE 'Polynomial%' LIMIT 1;
  IF ch_id IS NOT NULL THEN
    INSERT INTO public.curriculum_topics (chapter_id, topic_no, title_en, learning_objectives, expected_minutes)
    VALUES
      (ch_id, 1, 'Definitions and degree',   ARRAY['Monomials, binomials, degree.'],  20),
      (ch_id, 2, 'Operations',                ARRAY['Add, subtract, multiply.'],       25),
      (ch_id, 3, 'Factor theorem',            ARRAY['Remainder, factor.'],             30),
      (ch_id, 4, 'Identities',                ARRAY['Standard expansions.'],           25)
    ON CONFLICT (chapter_id, topic_no) DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- 6b. weekly_league_standings — track tier-promotion decisions so the next
--     week's league can pick up at the new tier instead of always starting
--     at tier 1.
-- ============================================================================
ALTER TABLE public.weekly_league_standings
  ADD COLUMN IF NOT EXISTS promoted_to_tier INTEGER,
  ADD COLUMN IF NOT EXISTS promotion_reason TEXT,
  ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMPTZ;

-- ============================================================================
-- 7. Schools seed — well-known WB schools so onboarding has selectable rows
-- ============================================================================
-- The table created in 028 had no unique key; add one so re-running this
-- migration is idempotent.
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS pin_code TEXT;
DO $$ BEGIN
  ALTER TABLE public.schools
    ADD CONSTRAINT schools_name_board_city_uq UNIQUE (name, board_code, city);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO public.schools (name, board_code, city, state)
VALUES
  ('South Point School',                  'wbbse', 'Kolkata',   'West Bengal'),
  ('La Martiniere for Boys',              'icse',  'Kolkata',   'West Bengal'),
  ('Don Bosco Park Circus',               'icse',  'Kolkata',   'West Bengal'),
  ('Kendriya Vidyalaya Salt Lake',        'cbse',  'Kolkata',   'West Bengal'),
  ('DAV Public School Joka',              'cbse',  'Kolkata',   'West Bengal'),
  ('Hare School',                         'wbbse', 'Kolkata',   'West Bengal'),
  ('Hindu School',                        'wbbse', 'Kolkata',   'West Bengal'),
  ('Calcutta Boys'' School',              'icse',  'Kolkata',   'West Bengal'),
  ('St. Xavier''s Collegiate School',     'icse',  'Kolkata',   'West Bengal'),
  ('Birla High School',                   'icse',  'Kolkata',   'West Bengal')
ON CONFLICT (name, board_code, city) DO NOTHING;
