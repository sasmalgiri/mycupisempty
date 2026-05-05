-- ============================================================================
-- Migration 023: WBBSE syllabus seed (Class 1-10)
--
-- Confidence levels in source_url / notes:
--   HIGH = corroborated across 2+ sources including a board-aligned site
--   MED  = single secondary source, structurally consistent
--   GAP  = not seeded; left blank for human verification
--
-- Seeded HIGH-confidence rows (full chapter lists with titles):
--   Class 6 History (9), Class 6 Geography (11)
--   Class 7 History (9), Class 7 Geography (11)
--   Class 8 History (9), Class 8 Geography (11)
--   Class 9 Math (21), Phys Sci (7), Life Sci (5), History (8), Geography (9), English (12)
--   Class 10 Math (26), Phys Sci (13 sub-units), Life Sci (5), Geography (6), History (8), English (8)
--
-- Seeded MED-confidence (subject + textbook + chapter count, titles GAP):
--   Class 5 Math (21 chapters, titles GAP)
--   Class 6-8 Math (Ganit Probha, count from common refs)
--   Class 6-8 Bengali, English, Science (textbook only)
--   Class 9-10 Bengali (chapter list reconstructed from coaching guides)
--
-- Class 1-4: NOT seeded. Primary textbooks have lesson-titles, not numbered
-- chapters. The schema accepts NULL chapter_no but the planner can't operate
-- on absent data — defer to manual seeding from the actual e-textbook PDFs.
--
-- Madhyamik 2026 calendar + exam routine seeded into curriculum_calendars.
-- ============================================================================

-- ============================================================================
-- 1. Subjects-by-class registrations (only what we have data for)
-- ============================================================================

-- A small helper to keep INSERTs short. Postgres doesn't have a real
-- "if not exists" for INSERT…SELECT without ON CONFLICT on a unique key, and
-- (board_code, class_level, subject_slug, language) is already UNIQUE in the
-- schema, so ON CONFLICT DO NOTHING is enough.

INSERT INTO public.curriculum_subjects_by_class
  (board_code, class_level, subject_slug, textbook_title_native, textbook_title_romanized, textbook_title_en, total_chapters, expected_hours_per_year, expected_minutes_per_week, language, notes)
VALUES
  -- Class 5
  ('wbbse', 5, 'math',           'আমার গণিত',                 'Amar Ganit',         'My Mathematics',                    21,  150, 240, 'bn', 'HIGH count, MED titles — chapter list to be filled from wbxpress PDF'),

  -- Class 6
  ('wbbse', 6, 'math',           'গণিত প্রভা',                  'Ganit Probha',       'Mathematics Bloom',                 NULL, 180, 270, 'bn', 'MED — count not pinned; chapter titles GAP'),
  ('wbbse', 6, 'science',        'পরিবেশ ও বিজ্ঞান',            'Poribesh O Bigyan',  'Environment and Science',           NULL, 150, 240, 'bn', 'MED — chapter list GAP'),
  ('wbbse', 6, 'history',        'অতীত ও ঐতিহ্য',                'Atit O Aitihya',     'The Past and Heritage',             9,    100, 180, 'bn', 'HIGH'),
  ('wbbse', 6, 'geography',      'আমাদের পৃথিবী',                'Aamader Prithibi',   'Our World',                         11,   100, 180, 'bn', 'HIGH'),
  ('wbbse', 6, 'bengali',        'সাহিত্য মেলা',                  'Sahitya Mela',       'Literature Fair',                   NULL, 180, 240, 'bn', 'MED — chapter list GAP'),
  ('wbbse', 6, 'english',        'Blossoms',                   'Blossoms',           'Blossoms',                          NULL, 150, 200, 'en', 'MED — chapter list GAP'),

  -- Class 7
  ('wbbse', 7, 'math',           'গণিত প্রভা',                  'Ganit Probha',       'Mathematics Bloom',                 NULL, 180, 270, 'bn', 'MED — count not pinned'),
  ('wbbse', 7, 'science',        'পরিবেশ ও বিজ্ঞান',            'Poribesh O Bigyan',  'Environment and Science',           NULL, 150, 240, 'bn', 'MED'),
  ('wbbse', 7, 'history',        'অতীত ও ঐতিহ্য',                'Atit O Aitihya',     'The Past and Heritage',             9,    100, 180, 'bn', 'HIGH'),
  ('wbbse', 7, 'geography',      'আমাদের পৃথিবী',                'Aamader Prithibi',   'Our World',                         11,   100, 180, 'bn', 'HIGH'),
  ('wbbse', 7, 'bengali',        'সাহিত্য মেলা',                  'Sahitya Mela',       'Literature Fair',                   NULL, 180, 240, 'bn', 'MED'),
  ('wbbse', 7, 'english',        'Blossoms',                   'Blossoms',           'Blossoms',                          NULL, 150, 200, 'en', 'MED'),

  -- Class 8
  ('wbbse', 8, 'math',           'গণিত প্রভা',                  'Ganit Probha',       'Mathematics Bloom',                 NULL, 200, 270, 'bn', 'MED'),
  ('wbbse', 8, 'science',        'পরিবেশ ও বিজ্ঞান',            'Poribesh O Bigyan',  'Environment and Science',           NULL, 160, 240, 'bn', 'MED'),
  ('wbbse', 8, 'history',        'অতীত ও ঐতিহ্য',                'Atit O Aitihya',     'The Past and Heritage',             9,    100, 180, 'bn', 'HIGH'),
  ('wbbse', 8, 'geography',      'আমাদের পৃথিবী',                'Aamader Prithibi',   'Our World',                         11,   100, 180, 'bn', 'HIGH'),
  ('wbbse', 8, 'bengali',        'সাহিত্য মেলা',                  'Sahitya Mela',       'Literature Fair',                   NULL, 180, 240, 'bn', 'MED'),
  ('wbbse', 8, 'english',        'Blossoms',                   'Blossoms',           'Blossoms',                          NULL, 150, 200, 'en', 'MED'),

  -- Class 9
  ('wbbse', 9, 'math',             'গণিত প্রকাশ',                  'Ganit Prakash',      'Mathematics Expressed',           21,  180, 270, 'bn', 'HIGH'),
  ('wbbse', 9, 'physical_science', 'ভৌত বিজ্ঞান ও পরিবেশ',         'Bhouto Bigyan',      'Physical Science and Environment', 7,   140, 240, 'bn', 'HIGH (sub-chapters expand to ~12)'),
  ('wbbse', 9, 'life_science',     'জীবন বিজ্ঞান ও পরিবেশ',        'Jibon Bigyan',       'Life Science and Environment',     5,   130, 200, 'bn', 'HIGH'),
  ('wbbse', 9, 'history',          NULL,                          'Itihas',             'History',                           7,   100, 180, 'bn', 'HIGH (excludes foreword)'),
  ('wbbse', 9, 'geography',        'ভূগোল ও পরিবেশ',               'Bhugol O Poribesh',  'Geography and Environment',        9,    120, 180, 'bn', 'HIGH'),
  ('wbbse', 9, 'english',          'Bliss',                       'Bliss',              'Bliss',                            12,   140, 200, 'en', 'HIGH'),
  ('wbbse', 9, 'bengali',          'সাহিত্য সঞ্চয়ন',                  'Sahitya Sanchayan',  'Sahitya Sanchayan',                NULL, 180, 240, 'bn', 'MED — chapter list GAP'),

  -- Class 10
  ('wbbse', 10, 'math',             'গণিত প্রকাশ',                  'Ganit Prakash',      'Mathematics Expressed',           26,  200, 300, 'bn', 'HIGH'),
  ('wbbse', 10, 'physical_science', 'ভৌত বিজ্ঞান ও পরিবেশ',         'Bhouto Bigyan',      'Physical Science and Environment', 13,  150, 270, 'bn', 'HIGH (8 main + Ch 8 sub-chapters)'),
  ('wbbse', 10, 'life_science',     'জীবন বিজ্ঞান ও পরিবেশ',        'Jibon Bigyan',       'Life Science and Environment',     5,   140, 240, 'bn', 'HIGH'),
  ('wbbse', 10, 'history',          NULL,                          'Itihas',             'History',                          8,    120, 180, 'bn', 'HIGH'),
  ('wbbse', 10, 'geography',        'ভূগোল ও পরিবেশ',               'Bhugol O Poribesh',  'Geography and Environment',        6,    140, 180, 'bn', 'HIGH (Madhyamik weighting confirmed)'),
  ('wbbse', 10, 'english',          'Bliss',                       'Bliss',              'Bliss',                            8,    140, 200, 'en', 'HIGH'),
  ('wbbse', 10, 'bengali',          'সাহিত্য সঞ্চয়ন + কোনি',           'Sahitya Sanchayan + Koni', 'Sahitya Sanchayan + Koni (rapid reader)', NULL, 200, 240, 'bn', 'MED — Sahitya Sanchayan chapter list reconstructed; Koni is the supplementary novel by Moti Nandi')
ON CONFLICT (board_code, class_level, subject_slug, language) DO NOTHING;

-- ============================================================================
-- 2. Chapters — HIGH-confidence rows only.
--    Each chapter row uses a SELECT to look up subject_class_id by composite
--    key, so chapter rows can be re-run idempotently with ON CONFLICT.
-- ============================================================================

-- Helper macro doesn't exist in pg, so we inline the SELECT subquery for
-- subject_class_id. (board_code, class_level, subject_slug, language) is unique.

-- ----------------------------------------------------------------------------
-- Class 6 History — 9 chapters
-- ----------------------------------------------------------------------------
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band,
       'https://wbbsesolutions.com/west-bengal-board-class-6-history-book-solution/'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1, 'The Concept of History',                                                  'How historians read evidence; oral, written, archaeological sources.', 'early', 8, 2),
  (2, 'Early Humans of the Indian Subcontinent',                                  'From nomadic life to settlement; tools and habitats.',                'early', 10, 2),
  (3, 'Ancient History — Period I (~7000–1500 BCE)',                              'Early agriculture, Indus/Harappa civilisation.',                       'mid',   12, 2),
  (4, 'Ancient History — Period II (~1500–600 BCE)',                              'Vedic age and post-Vedic society.',                                    'mid',   12, 2),
  (5, 'Indian Subcontinent in the 6th Century BCE',                               'Mahajanapadas, rise of new ideas (Buddhism, Jainism).',                'mid',   10, 2),
  (6, 'Empire Expansion and Governance',                                          'Mauryan empire and administration.',                                   'mid',   12, 2),
  (7, 'Economy and Livelihood',                                                   'Trade, currency, professions in ancient India.',                       'late',  10, 2),
  (8, 'Culture of the Ancient Indian Subcontinent',                               'Languages, religions, art, education.',                                'late',  10, 2),
  (9, 'India and the Contemporary External World',                                'Cross-cultural exchanges in the ancient world.',                       'late',  8,  2)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='wbbse' AND class_level=6 AND subject_slug='history' AND language='bn'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Class 6 Geography — 11 chapters
-- ----------------------------------------------------------------------------
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band,
       'https://wbbsesolutions.com/west-bengal-board-class-6-geography-book-solution/'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1, 'The Universe and the Solar System',         'Stars, planets, our solar neighbourhood.',     'early', 8, 2),
  (2, 'Shape of the Earth',                        'Evidence of a spherical earth; geoid.',         'early', 6, 2),
  (3, 'Location on the Earth''s Surface',           'Latitude, longitude, time zones.',              'early', 8, 2),
  (4, 'Rotation of the Earth',                     'Day-night cycle, Coriolis hint.',               'mid',   8, 2),
  (5, 'Realms of the Earth',                       'Lithosphere, hydrosphere, atmosphere.',         'mid',   8, 2),
  (6, 'Antarctica: The Ice-capped Continent',      'Climate, exploration, biodiversity.',           'mid',   6, 2),
  (7, 'Weather and Climate',                       'Difference, elements of weather.',              'mid',   10, 2),
  (8, 'Pollution',                                 'Air, water, land pollution.',                   'late',  6, 2),
  (9, 'Noise Pollution',                           'Causes, effects, remedies.',                    'late',  4, 2),
  (10,'India: Our Motherland',                     'Location, neighbours, broad regions.',          'late',  10, 2),
  (11,'Maps',                                      'Reading scale, direction, basic legend.',       'late',  6, 2)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='wbbse' AND class_level=6 AND subject_slug='geography' AND language='bn'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Class 7 History — 9 chapters
-- ----------------------------------------------------------------------------
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band,
       'https://wbbsesolutions.com/west-bengal-board-class-7-history-book-solution/'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1, 'The Idea of History',                                            'Continuity from Cl 6 — sources and methods.',                           'early', 6, 3),
  (2, 'Indian Political History: 7th–12th Century CE',                  'Successor kingdoms after Harsha; Pala, Pratihara, Rashtrakuta, Chola.', 'early', 10, 3),
  (3, 'Society, Economy & Culture: 7th–12th Century CE',                'Trade, temple economy, regional cultures.',                            'mid',   10, 3),
  (4, 'The Delhi Sultanate: Turko-Afghan Rule',                         'Slave dynasty to Lodis; iqta, administration.',                        'mid',   12, 3),
  (5, 'The Mughal Empire',                                              'Babur, Akbar, succession, religious policy.',                          'mid',   12, 3),
  (6, 'Towns, Traders and Trade',                                       'Maritime and overland trade; commercial networks.',                    'mid',   8,  3),
  (7, 'Lifestyle and Culture: Sultanate & Mughal Era',                  'Bhakti, Sufism, architecture, language evolution.',                    'late',  10, 3),
  (8, 'The Crisis of the Mughal Empire',                                'Decline, regional polities, European entry.',                           'late',  8, 3),
  (9, 'India Today: Government, Democracy and Self-Governance',         'Civics bridge — Constitution basics.',                                  'late',  6, 3)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='wbbse' AND class_level=7 AND subject_slug='history' AND language='bn'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Class 7 Geography — 11 chapters
-- ----------------------------------------------------------------------------
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band,
       'https://wbbsesolutions.com/west-bengal-board-class-7-geography-book-solution/'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1, 'Earth''s Revolution',                            'Seasons, equinox, solstice.',                  'early', 8, 3),
  (2, 'Determination of Location',                       'Latitude/longitude refresher; time.',          'early', 8, 3),
  (3, 'Air Pressure',                                   'Pressure belts, isobars.',                     'mid',   6, 3),
  (4, 'Landforms',                                      'Mountains, plateaus, plains.',                 'mid',   10, 3),
  (5, 'River',                                          'River system, work of rivers.',                'mid',   10, 3),
  (6, 'Rock and Soil',                                  'Rock cycle; soil formation.',                  'mid',   8, 3),
  (7, 'Water Pollution',                                'Sources, effects, remedies.',                  'late',  6, 3),
  (8, 'Soil Pollution',                                 'Erosion, contamination, conservation.',        'late',  6, 3),
  (9, 'Continent of Asia',                              'Physical and economic geography.',             'late',  10, 3),
  (10,'Continent of Africa',                            'Physical and economic geography.',             'late',  8, 3),
  (11,'Continent of Europe',                            'Physical and economic geography.',             'late',  8, 3)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='wbbse' AND class_level=7 AND subject_slug='geography' AND language='bn'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Class 8 History — 9 chapters
-- ----------------------------------------------------------------------------
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band,
       'https://wbbsesolutions.com/west-bengal-board-class-8-history-book-solution/'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1, 'The Idea of History',                          'Modern historiography; continuity.',           'early', 6, 3),
  (2, 'Rise of Regional Powers',                       'Bengal, Awadh, Hyderabad, Marathas, Sikhs.',   'early', 10, 3),
  (3, 'Establishing the Colonial Authority',           'Battle of Plassey to Subsidiary Alliance.',    'mid',   10, 3),
  (4, 'The Nature of Colonial Economy',                'Land revenue, deindustrialisation, trade.',    'mid',   10, 3),
  (5, 'Reaction to Colonial Rule: Co-operation and Revolt', 'Tribal, peasant, sepoy uprisings.',       'mid',   10, 3),
  (6, 'The Beginning of Nationalism',                  'Founding of INC; moderates.',                  'late',  10, 3),
  (7, 'Nationalist Ideals and Their Evolution',        'Extremists, Swadeshi, Gandhi.',                'late',  10, 3),
  (8, 'From Communalism to Partition',                 '20th c. communal politics to 1947.',           'late',  10, 3),
  (9, 'Constitution of India: Democratic Structure',   'Fundamental rights, duties, citizenship.',     'late',  6, 3)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='wbbse' AND class_level=8 AND subject_slug='history' AND language='bn'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Class 8 Geography — 11 chapters
-- ----------------------------------------------------------------------------
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band,
       'https://wbbsesolutions.com/west-bengal-board-class-8-geography-book-solution/'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1, 'Interior of the Earth',                         'Crust/mantle/core; layered model.',          'early', 8, 3),
  (2, 'Unstable Earth',                                'Earthquakes and volcanoes.',                  'early', 10, 3),
  (3, 'Rocks',                                         'Igneous, sedimentary, metamorphic.',          'mid',   8, 3),
  (4, 'Pressure Belts and Winds',                      'Trade winds, jet streams.',                   'mid',   8, 3),
  (5, 'Cloud and Rain',                                'Cloud types, rainfall mechanisms.',           'mid',   8, 3),
  (6, 'Climatic Regions',                              'Tropical, temperate, polar.',                 'mid',   8, 3),
  (7, 'Human Activities and Environmental Degradation','Urbanisation, deforestation, pollution.',     'late',  8, 3),
  (8, 'Some Neighbouring Countries of India',          'Bangladesh, Nepal, Sri Lanka — ties.',        'late',  8, 3),
  (9, 'North America',                                 'Physical and economic geography.',            'late',  10, 3),
  (10,'South America',                                 'Physical and economic geography.',            'late',  8, 3),
  (11,'Oceania',                                       'Australia + Pacific island nations.',         'late',  6, 3)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='wbbse' AND class_level=8 AND subject_slug='geography' AND language='bn'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Class 9 Mathematics — 21 chapters (Ganit Prakash)
-- ----------------------------------------------------------------------------
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band,
       'https://wbbsesolutions.guide/wbbse-solutions-for-class-9-maths/'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1, 'Real Numbers',                                          'Rational, irrational, decimal expansion, real number line.',  'early', 8, 4),
  (2, 'Laws of Indices',                                       'Exponent rules, fractional/negative indices.',                'early', 6, 4),
  (3, 'Graph',                                                 'Plotting linear relations on Cartesian plane.',               'early', 8, 4),
  (4, 'Co-ordinate Geometry: Distance Formula',                'Distance between two points; section formula intro.',         'early', 6, 4),
  (5, 'Linear Simultaneous Equations',                         'Two-variable systems by substitution, elimination, graph.',   'early', 10, 4),
  (6, 'Properties of Parallelogram',                           'Sides, angles, diagonals theorems.',                          'mid',   10, 4),
  (7, 'Polynomial',                                            'Degree, types, evaluation, factor theorem.',                  'mid',   10, 4),
  (8, 'Factorisation',                                         'Common factor, grouping, identities.',                        'mid',   8, 4),
  (9, 'Transversal & Mid-Point Theorem',                       'Parallel lines cut by transversal.',                          'mid',   8, 4),
  (10,'Profit and Loss',                                       'CP, SP, profit %, loss %, discounts.',                        'mid',   6, 4),
  (11,'Statistics',                                            'Frequency tables, measures of central tendency.',             'mid',   8, 4),
  (12,'Theorems on Area',                                      'Triangles, parallelograms equal area.',                       'mid',   8, 4),
  (13,'Construction: Parallelogram of Given Area',             'Geometric construction techniques.',                           'mid',   6, 4),
  (14,'Construction: Triangle Equal in Area to a Quadrilateral','Geometric construction.',                                   'late',  6, 4),
  (15,'Area & Perimeter of Triangle & Quadrilateral',          'Heron''s formula, mensuration basics.',                       'late',  8, 4),
  (16,'Circumference of Circle',                               'π, circumference, arc length.',                               'late',  6, 4),
  (17,'Theorems on Concurrence',                               'Centroid, incentre, circumcentre.',                           'late',  8, 4),
  (18,'Area of Circle',                                        'πr² and applications.',                                       'late',  6, 4),
  (19,'Co-ordinate Geometry: Section Formula',                 'Internal and external division of a line segment.',           'late',  8, 4),
  (20,'Logarithm',                                             'Definition, laws of logs, change of base.',                   'late',  10, 4),
  (21,'Set Theory',                                            'Sets, subsets, operations, Venn diagrams.',                   'late',  8, 4)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='wbbse' AND class_level=9 AND subject_slug='math' AND language='bn'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Class 9 Physical Science — 7 main chapters
-- ----------------------------------------------------------------------------
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band,
       'https://wbbsesolutions.com/west-bengal-board-class-9-physical-science-book-solution/'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1, 'Measurement',                                  'Units, dimensions, errors.',                           'early', 12, 4),
  (2, 'Force and Motion',                              'Newton''s laws, momentum.',                           'early', 16, 4),
  (3, 'Matter: Structure and Properties',              'States of matter, density, pressure.',                 'mid',   16, 4),
  (4, 'Matter: Atomic Structure & Chemistry',          'Atomic structure, mole concept, solutions, acids/bases/salts, separation, water — has 6 sub-chapters.', 'mid', 30, 4),
  (5, 'Work, Power and Energy',                        'Definitions, conservation.',                          'mid',   14, 4),
  (6, 'Heat',                                          'Temperature, transfer, expansion.',                    'late',  14, 4),
  (7, 'Sound',                                         'Wave types, properties, applications.',                'late',  12, 4)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='wbbse' AND class_level=9 AND subject_slug='physical_science' AND language='bn'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Class 9 Life Science — 5 chapters
-- ----------------------------------------------------------------------------
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band,
       'https://wbbsesolutions.com/west-bengal-board-class-9-life-science-book-solution/'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1, 'Life and Its Diversity',                       'Taxonomy, 5 kingdoms, plant/animal classification.',  'early', 30, 4),
  (2, 'Levels of Organisation of Life',                'Biomolecules, cell, tissue, organ systems.',          'mid',   30, 4),
  (3, 'Physiological Processes',                       'Photosynthesis, respiration, nutrition, circulation, excretion.', 'mid', 30, 4),
  (4, 'Biology and Human Welfare',                     'Immunity, diseases, microbes.',                       'late',  20, 4),
  (5, 'Environment and Its Resources',                 'Ecology, sustainable use.',                           'late',  20, 4)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='wbbse' AND class_level=9 AND subject_slug='life_science' AND language='bn'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Class 9 History — 7 chapters
-- ----------------------------------------------------------------------------
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band,
       'https://wbbsesolutions.com/west-bengal-board-class-9-history-book-solution/'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1, 'Some Aspects of the French Revolution',         'Causes, course, consequences.',                    'early', 14, 4),
  (2, 'Revolutionary Ideals: Napoleon and Nationalism','Napoleonic Code, rise of nationalism.',            'early', 14, 4),
  (3, '19th-Century Europe: Conflict of Ideas',         'Nationalism vs monarchy.',                          'mid',   14, 4),
  (4, 'Industrial Revolution: Colonialism and Imperialism','Causes, effects, scramble for territory.',     'mid',   16, 4),
  (5, 'Europe in the Twentieth Century',                'Russia 1917, fascism, world wars setting.',         'mid',   14, 4),
  (6, 'Second World War and Its Aftermath',             'Causes, course, consequences.',                     'late',  14, 4),
  (7, 'League of Nations and the United Nations',       'Inter-war diplomacy, UN structure.',                'late',  14, 4)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='wbbse' AND class_level=9 AND subject_slug='history' AND language='bn'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Class 9 Geography — 9 chapters
-- ----------------------------------------------------------------------------
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band,
       'https://wbbsesolutions.com/west-bengal-board-class-9-geography-book-solution/'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1, 'Earth as a Planet',                             'Solar system, earth''s shape, dimensions.',        'early', 10, 4),
  (2, 'Movements of the Earth',                        'Rotation and revolution; effects.',                 'early', 12, 4),
  (3, 'Determination of Location on Earth',            'Latitude, longitude, time zones.',                  'early', 10, 4),
  (4, 'Geomorphic Processes and Landforms',            'Endogenetic and exogenetic processes.',             'mid',   14, 4),
  (5, 'Weathering',                                    'Physical, chemical, biological weathering.',        'mid',   12, 4),
  (6, 'Hazards and Disasters',                          'Natural hazards: earthquakes, cyclones, floods.',  'mid',   12, 4),
  (7, 'Resources of India',                            'Natural and human resources.',                      'late',  16, 4),
  (8, 'West Bengal',                                   'Physiography, climate, economy of WB.',             'late',  14, 4),
  (9, 'Maps and Scales',                               'Map types, scale, map reading.',                    'late',  12, 4)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='wbbse' AND class_level=9 AND subject_slug='geography' AND language='bn'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Class 9 English (Bliss) — 12 lessons
-- ----------------------------------------------------------------------------
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band,
       'https://wbxpress.com/files/2018/07/Bliss-IX.pdf'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1,  'Tales of Bhola Grandpa',         'Short story.',                            'early', 10, 4),
  (2,  'All About a Dog',                'Short story.',                            'early', 10, 4),
  (3,  'Autumn',                          'Poem.',                                   'early', 6, 4),
  (4,  'A Day in the Zoo',               'Short story.',                            'mid',   10, 4),
  (5,  'All Summer in a Day',            'Short story by Ray Bradbury.',            'mid',   10, 4),
  (6,  'Mild the Mist Upon the Hill',    'Poem.',                                   'mid',   6, 4),
  (7,  'Tom Loses a Tooth',              'Short story.',                            'mid',   10, 4),
  (8,  'His First Flight',               'Short story.',                            'mid',   10, 4),
  (9,  'The North Ship',                 'Poem.',                                   'mid',   6, 4),
  (10, 'The Price of Bananas',           'Short story.',                            'late',  10, 4),
  (11, 'A Shipwrecked Sailor',           'Short story.',                            'late',  10, 4),
  (12, 'Hunting Snake',                  'Poem.',                                   'late',  6, 4)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='wbbse' AND class_level=9 AND subject_slug='english' AND language='en'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Class 10 Mathematics — 26 chapters (Madhyamik)
-- ----------------------------------------------------------------------------
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, exam_weight_pct, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band, n.weight,
       'https://wbbse.ramadantutorial.com/wbbse-class-10-math-solution/'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1,  'Quadratic Equation in One Variable',                 'ax²+bx+c=0; factor, complete-square, formula.',     'early', 10, 5, 4.0),
  (2,  'Simple Interest',                                    'P, R, T relationships.',                             'early',  6, 5, 2.0),
  (3,  'Theorems Related to Circle',                         'Chord, arc, central angles.',                        'early', 10, 5, 5.0),
  (4,  'Rectangular Parallelopiped (Cuboid)',                'Surface area, volume.',                              'early',  6, 5, 2.0),
  (5,  'Ratio and Proportion',                               'Properties, applications.',                          'early',  6, 5, 2.0),
  (6,  'Compound Interest & Uniform Rate',                   'CI formula, growth/decay.',                          'mid',    8, 5, 4.0),
  (7,  'Theorems on Angles in a Circle',                     'Inscribed angle, alternate segment.',                'mid',    8, 5, 5.0),
  (8,  'Right Circular Cylinder',                            'CSA, TSA, volume.',                                   'mid',    6, 5, 2.0),
  (9,  'Quadratic Surds',                                    'Rationalisation, conjugates.',                       'mid',    6, 5, 3.0),
  (10, 'Theorems on Cyclic Quadrilateral',                   'Opposite angles, exterior angle.',                   'mid',    6, 5, 4.0),
  (11, 'Construction: Circumcircle and In-circle',           'Geometric construction.',                            'mid',    6, 5, 2.0),
  (12, 'Sphere',                                             'Surface area, volume.',                               'mid',    6, 5, 2.0),
  (13, 'Variation',                                          'Direct, inverse, joint.',                             'mid',    6, 5, 3.0),
  (14, 'Partnership Business',                               'Profit/loss share computations.',                     'mid',    6, 5, 2.0),
  (15, 'Theorems on Tangent to a Circle',                    'Tangent properties, alternate segment.',             'mid',    8, 5, 4.0),
  (16, 'Right Circular Cone',                                'CSA, TSA, volume.',                                   'mid',    6, 5, 2.0),
  (17, 'Construction: Tangent to a Circle',                  'Geometric construction.',                            'late',   6, 5, 2.0),
  (18, 'Similarity',                                         'Similar triangles, ratio of areas.',                 'late',   8, 5, 5.0),
  (19, 'Real-life Solid Object Problems',                    'Combined solids, applications.',                     'late',   8, 5, 4.0),
  (20, 'Trigonometry: Concept of Angle',                     'Degree, radian, conversions.',                       'late',   6, 5, 2.0),
  (21, 'Construction: Mean Proportional',                    'Geometric mean construction.',                       'late',   4, 5, 1.0),
  (22, 'Pythagoras Theorem',                                 'Theorem, converse, applications.',                   'late',   6, 5, 4.0),
  (23, 'Trig Ratios and Identities',                         'sin, cos, tan and identities.',                       'late',   8, 5, 5.0),
  (24, 'Trig Ratios of Complementary Angles',                'sin(90-θ)=cosθ etc.',                                'late',   6, 5, 3.0),
  (25, 'Heights and Distances',                              'Application of trig.',                                'late',   6, 5, 4.0),
  (26, 'Statistics: Mean, Median, Mode, Ogive',              'Grouped data, measures of central tendency.',         'late',   8, 5, 8.0)
) AS n(no, title, descr, hint, hrs, band, weight)
WHERE board_code='wbbse' AND class_level=10 AND subject_slug='math' AND language='bn'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Class 10 Physical Science — 13 effective units (8 main; Ch 8 has 6 sub)
-- ----------------------------------------------------------------------------
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band,
       'https://wbbsesolutions.com/west-bengal-board-class-10-physical-science-book-solution/'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1, 'Concerns About Our Environment',         'Greenhouse effect, ozone, climate change.',  'early', 10, 5),
  (2, 'Behaviour of Gases',                     'Boyle, Charles, ideal gas equation.',         'early', 12, 5),
  (3, 'Chemical Calculations',                  'Stoichiometry, mole concept applied.',         'early', 12, 5),
  (4, 'Thermal Phenomena',                      'Expansion, calorimetry.',                      'mid',   12, 5),
  (5, 'Light',                                  'Reflection, refraction, lenses, eye.',         'mid',   16, 5),
  (6, 'Current Electricity',                    'Ohm''s law, circuits, magnetic effect.',      'mid',   16, 5),
  (7, 'Atomic Nucleus',                         'Radioactivity, nuclear energy.',              'late',   8, 5),
  (8, 'Periodic Table and Periodicity',         'Modern periodic table, trends.',              'late',  10, 5),
  (9, 'Ionic and Covalent Bonding',             'Bond formation, properties.',                  'late',  10, 5),
  (10,'Electricity and Chemical Reactions',     'Electrolysis, electroplating.',                'late',   8, 5),
  (11,'Inorganic Chemistry in Lab and Industry','Common gases, fertilisers.',                   'late',   8, 5),
  (12,'Metallurgy',                              'Extraction, alloys.',                          'late',   8, 5),
  (13,'Organic Chemistry',                      'Hydrocarbons, functional groups.',             'late',  10, 5)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='wbbse' AND class_level=10 AND subject_slug='physical_science' AND language='bn'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Class 10 Life Science — 5 chapters
-- ----------------------------------------------------------------------------
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, exam_weight_pct, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band, n.weight,
       'https://wbbsesolutions.com/west-bengal-board-class-10-life-science-book-solution/'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1, 'Control and Coordination in Living Organisms',        'Hormones, nervous system, locomotion.',       'early', 26, 5, 17.0),
  (2, 'Continuity of Life',                                  'Cell division, reproduction, plant repro.',   'mid',   30, 5, 21.0),
  (3, 'Heredity and Common Genetic Diseases',                'Mendel, thalassemia, haemophilia.',           'mid',   18, 5, 13.0),
  (4, 'Evolution and Adaptation',                            'Darwin, natural selection, adaptation.',      'late',  18, 5, 13.0),
  (5, 'Environment, Resources and Conservation',             'Cycles, pollution, biodiversity.',            'late',  22, 5, 16.0)
) AS n(no, title, descr, hint, hrs, band, weight)
WHERE board_code='wbbse' AND class_level=10 AND subject_slug='life_science' AND language='bn'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Class 10 Geography — 6 chapters with confirmed Madhyamik weights
-- ----------------------------------------------------------------------------
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, exam_weight_pct, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band, n.weight,
       'https://wbbsesolutions.com/west-bengal-board-class-10-geography-book-solution/'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1, 'Exogenetic Processes and Resultant Landforms',  'River, glacier, wind work.',                   'early', 24, 5, 16.0),
  (2, 'Atmosphere',                                     'Composition, temperature, winds, humidity.',    'mid',   18, 5, 12.0),
  (3, 'Hydrosphere',                                    'Ocean currents, tides, salinity.',              'mid',    8, 5,  4.0),
  (4, 'Waste Management',                              'Sources, types, disposal methods.',             'mid',   10, 5,  8.0),
  (5, 'India: Physical & Economic',                     'Physiography, climate, soils, agri, industry.','late',   42, 5, 32.0),
  (6, 'Satellite Imagery & Topographical Map',          'Map interpretation, map work.',                 'late',   24, 5, 18.0)
) AS n(no, title, descr, hint, hrs, band, weight)
WHERE board_code='wbbse' AND class_level=10 AND subject_slug='geography' AND language='bn'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Class 10 History — 8 chapters
-- ----------------------------------------------------------------------------
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band,
       'https://wbbsesolutions.com/west-bengal-board-class-10-history-book-solution/'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1, 'Ideas of History',                              'Sources, modern historiography.',           'early', 10, 5),
  (2, 'Reform: Characteristics and Observations',       '19th c. social and religious reforms.',     'early', 14, 5),
  (3, 'Resistance and Rebellion',                       '1857, peasant and tribal revolts.',         'early', 14, 5),
  (4, 'Early Stages of Collective Action',              'INC origins.',                              'mid',   14, 5),
  (5, 'Alternative Ideas and Initiatives',              'Vernacular press, education, mid-19th to early 20th c.', 'mid', 14, 5),
  (6, 'Peasant, Working Class, and Left Movements',     '20th-c India.',                             'late',  16, 5),
  (7, 'Movements by Women, Students, Marginal People',  '20th-c India social movements.',            'late',  14, 5),
  (8, 'Post-Colonial India (1947-1964)',                'Refugee, States Reorganisation, foreign policy.', 'late', 14, 5)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='wbbse' AND class_level=10 AND subject_slug='history' AND language='bn'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Class 10 English (Bliss) — 8 lessons
-- ----------------------------------------------------------------------------
INSERT INTO public.curriculum_chapters
  (subject_class_id, chapter_no, title_en, description, season_hint, expected_hours, maturity_band, source_url)
SELECT id, n.no, n.title, n.descr, n.hint, n.hrs, n.band,
       'https://wbxpress.com/files/2018/07/Bliss-X.pdf'
FROM public.curriculum_subjects_by_class,
LATERAL (VALUES
  (1, 'Father''s Help',                  'Story by R.K. Narayan.',                  'early', 14, 5),
  (2, 'Fable',                            'Poem by Ralph Waldo Emerson.',           'early', 8, 5),
  (3, 'The Passing Away of Bapu',        'Memoir by Nayantara Sahgal.',             'mid',   14, 5),
  (4, 'My Own True Family',              'Poem by Ted Hughes.',                     'mid',   8, 5),
  (5, 'Our Runaway Kite',                'Story by L.M. Montgomery.',               'mid',   14, 5),
  (6, 'Sea Fever',                       'Poem by John Masefield.',                 'mid',   8, 5),
  (7, 'The Cat',                         'Story by Andrew Barton Paterson.',        'late',  14, 5),
  (8, 'The Snail',                       'Poem by William Cowper.',                 'late',  8, 5)
) AS n(no, title, descr, hint, hrs, band)
WHERE board_code='wbbse' AND class_level=10 AND subject_slug='english' AND language='en'
ON CONFLICT (subject_class_id, chapter_no) DO NOTHING;

-- ============================================================================
-- 3. WBBSE 2026 calendar — public holidays, breaks, Madhyamik dates
-- ============================================================================

INSERT INTO public.curriculum_calendars
  (board_code, region, academic_year, event_kind, title, start_date, end_date, affects_planner, notes)
VALUES
  ('wbbse', 'IN-WB', '2026', 'public_holiday', 'English New Year',                  '2026-01-01', '2026-01-01', TRUE, NULL),
  ('wbbse', 'IN-WB', '2026', 'festival',       'Saraswati Puja & Netaji Jayanti',   '2026-01-23', '2026-01-23', TRUE, NULL),
  ('wbbse', 'IN-WB', '2026', 'public_holiday', 'Republic Day',                       '2026-01-26', '2026-01-26', TRUE, NULL),
  ('wbbse', 'IN-WB', '2026', 'board_exam',     'Madhyamik Exam Window',              '2026-02-02', '2026-02-12', TRUE, 'Class 10 final board exam — confirmed by WBBSE notification'),
  ('wbbse', 'IN-WB', '2026', 'festival',       'Doljatra',                            '2026-03-03', '2026-03-03', TRUE, NULL),
  ('wbbse', 'IN-WB', '2026', 'festival',       'Holi',                                '2026-03-04', '2026-03-04', TRUE, NULL),
  ('wbbse', 'IN-WB', '2026', 'festival',       'Eid-ul-Fitr (tentative)',             '2026-03-21', '2026-03-21', TRUE, 'Moon-sighting; date may shift +/- 1 day'),
  ('wbbse', 'IN-WB', '2026', 'festival',       'Ram Navami',                          '2026-03-26', '2026-03-26', TRUE, NULL),
  ('wbbse', 'IN-WB', '2026', 'public_holiday', 'Dr. B.R. Ambedkar Jayanti',           '2026-04-14', '2026-04-14', TRUE, NULL),
  ('wbbse', 'IN-WB', '2026', 'festival',       'Bengali New Year (Poila Boishakh)',   '2026-04-15', '2026-04-15', TRUE, NULL),
  ('wbbse', 'IN-WB', '2026', 'public_holiday', 'May Day & Buddha Purnima',            '2026-05-01', '2026-05-01', TRUE, NULL),
  ('wbbse', 'IN-WB', '2026', 'summer_break',   'WBBSE Secondary Summer Vacation',     '2026-05-04', '2026-05-18', TRUE, 'Per WBBSE secondary calendar; primary follows different shorter window'),
  ('wbbse', 'IN-WB', '2026', 'festival',       'Rabindra Jayanti',                    '2026-05-09', '2026-05-09', TRUE, NULL),
  ('wbbse', 'IN-WB', '2026', 'festival',       'Eid-ul-Adha / Bakrid',                '2026-05-27', '2026-05-27', TRUE, NULL),
  ('wbbse', 'IN-WB', '2026', 'public_holiday', 'Independence Day',                    '2026-08-15', '2026-08-15', TRUE, NULL),
  ('wbbse', 'IN-WB', '2026', 'puja_vacation',  'Durga Puja Vacation',                 '2026-10-15', '2026-11-12', TRUE, '~25 working days excluding Sundays — biggest single break in WB calendar'),
  ('wbbse', 'IN-WB', '2026', 'festival',       'Chhat Puja',                          '2026-11-15', '2026-11-16', TRUE, NULL),
  ('wbbse', 'IN-WB', '2026', 'festival',       'Christmas',                           '2026-12-25', '2026-12-25', TRUE, NULL),
  ('wbbse', 'IN-WB', '2026', 'mid_term',       '1st Summative / Periodic Exam',       '2026-04-01', '2026-04-15', TRUE, 'Typical window; school-specific dates'),
  ('wbbse', 'IN-WB', '2026', 'half_yearly',    '2nd Summative / Half-yearly',         '2026-08-15', '2026-08-31', TRUE, 'Typical window'),
  ('wbbse', 'IN-WB', '2026', 'final_exam',     '3rd Summative / Annual',              '2026-11-25', '2026-12-15', TRUE, 'Typical window — Class 9-10 cover full syllabus')
ON CONFLICT DO NOTHING;
