-- ============================================================================
-- Multi-Board Support + Full Exam Lifecycle
-- Supports: CBSE, ICSE, State Boards, NIOS, International
-- ============================================================================

-- Education Boards
CREATE TABLE public.education_boards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL, -- 'cbse', 'icse', 'up_board', 'mp_board', etc.
    name TEXT NOT NULL,
    name_hindi TEXT,
    country TEXT DEFAULT 'India',
    state TEXT, -- null for national boards
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Board-specific syllabus mapping
CREATE TABLE public.board_syllabus (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id UUID NOT NULL REFERENCES public.education_boards(id) ON DELETE CASCADE,
    class_id INTEGER NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    syllabus_year TEXT DEFAULT '2024-25',
    syllabus_pdf_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(board_id, class_id, subject_id, syllabus_year)
);

-- Model/Previous Year Question Papers
CREATE TABLE public.question_papers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id UUID REFERENCES public.education_boards(id) ON DELETE SET NULL,
    class_id INTEGER REFERENCES public.classes(id) ON DELETE SET NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    paper_type TEXT NOT NULL CHECK (paper_type IN (
        'model', 'previous_year', 'sample', 'practice', 'mock', 'unit_test', 'half_yearly', 'final'
    )),
    title TEXT NOT NULL,
    year TEXT,
    duration_minutes INTEGER,
    total_marks INTEGER,
    pdf_url TEXT,
    questions_json JSONB, -- structured questions if digitized
    solution_pdf_url TEXT,
    solutions_json JSONB, -- structured solutions if digitized
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Student exam attempts
CREATE TABLE public.exam_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    paper_id UUID NOT NULL REFERENCES public.question_papers(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    score INTEGER,
    total_marks INTEGER,
    time_taken_minutes INTEGER,
    answers_json JSONB,
    self_evaluation JSONB, -- student's self-marking
    ai_evaluation JSONB, -- AI's evaluation of long answers
    status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'evaluated')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Revision schedules
CREATE TABLE public.revision_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    chapter_id UUID REFERENCES public.chapters(id) ON DELETE SET NULL,
    revision_date DATE NOT NULL,
    revision_type TEXT DEFAULT 'review' CHECK (revision_type IN ('review', 'practice', 'test', 'deep_dive')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User board preference
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS
    board_code TEXT DEFAULT 'cbse';

-- Indexes
CREATE INDEX idx_board_syllabus_board ON public.board_syllabus(board_id);
CREATE INDEX idx_question_papers_board ON public.question_papers(board_id);
CREATE INDEX idx_question_papers_subject ON public.question_papers(subject_id);
CREATE INDEX idx_question_papers_type ON public.question_papers(paper_type);
CREATE INDEX idx_exam_attempts_user ON public.exam_attempts(user_id);
CREATE INDEX idx_exam_attempts_paper ON public.exam_attempts(paper_id);
CREATE INDEX idx_revision_plans_user ON public.revision_plans(user_id);
CREATE INDEX idx_revision_plans_date ON public.revision_plans(revision_date);

-- RLS
ALTER TABLE public.education_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_syllabus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revision_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read boards" ON public.education_boards FOR SELECT USING (true);
CREATE POLICY "Everyone can read syllabus" ON public.board_syllabus FOR SELECT USING (true);
CREATE POLICY "Everyone can read question papers" ON public.question_papers FOR SELECT USING (true);
CREATE POLICY "Users manage own exam attempts" ON public.exam_attempts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own revision plans" ON public.revision_plans FOR ALL USING (auth.uid() = user_id);

-- Seed education boards
INSERT INTO public.education_boards (code, name, name_hindi, state) VALUES
('cbse', 'Central Board of Secondary Education', 'केंद्रीय माध्यमिक शिक्षा बोर्ड', NULL),
('icse', 'Indian Certificate of Secondary Education', 'भारतीय माध्यमिक शिक्षा प्रमाणपत्र', NULL),
('nios', 'National Institute of Open Schooling', 'राष्ट्रीय मुक्त विद्यालयी शिक्षा संस्थान', NULL),
('up_board', 'Uttar Pradesh Board', 'उत्तर प्रदेश बोर्ड', 'Uttar Pradesh'),
('mp_board', 'Madhya Pradesh Board', 'मध्य प्रदेश बोर्ड', 'Madhya Pradesh'),
('bihar_board', 'Bihar School Examination Board', 'बिहार विद्यालय परीक्षा बोर्ड', 'Bihar'),
('wb_board', 'West Bengal Board', 'पश्चिम बंगाल बोर्ड', 'West Bengal'),
('mh_board', 'Maharashtra State Board', 'महाराष्ट्र राज्य बोर्ड', 'Maharashtra'),
('tn_board', 'Tamil Nadu State Board', NULL, 'Tamil Nadu'),
('ka_board', 'Karnataka State Board', NULL, 'Karnataka'),
('ap_board', 'Andhra Pradesh Board', NULL, 'Andhra Pradesh'),
('rj_board', 'Rajasthan Board', 'राजस्थान बोर्ड', 'Rajasthan'),
('gj_board', 'Gujarat Board', NULL, 'Gujarat'),
('hr_board', 'Haryana Board', 'हरियाणा बोर्ड', 'Haryana'),
('jk_board', 'J&K Board', NULL, 'Jammu & Kashmir'),
('ib', 'International Baccalaureate', NULL, NULL),
('cambridge', 'Cambridge International (IGCSE)', NULL, NULL)
ON CONFLICT (code) DO NOTHING;
