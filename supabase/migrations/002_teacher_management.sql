-- =====================================================
-- MyCupIsEmpty - Teacher Management Schema
-- Supabase PostgreSQL Migration
-- =====================================================

-- =====================================================
-- CLASSROOM MANAGEMENT
-- =====================================================

-- Classrooms (Teacher-created virtual classrooms)
CREATE TABLE public.classrooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    class_level INTEGER CHECK (class_level BETWEEN 1 AND 12),
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    invite_code TEXT UNIQUE NOT NULL,
    invite_code_expires_at TIMESTAMPTZ,
    max_students INTEGER DEFAULT 50,
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{"allow_self_enrollment": true, "show_leaderboard": true, "notifications_enabled": true}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Classroom enrollments (Students in classrooms)
CREATE TABLE public.classroom_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'removed', 'left')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    removed_at TIMESTAMPTZ,
    UNIQUE(classroom_id, student_id)
);

-- =====================================================
-- ASSIGNMENTS & SUBMISSIONS
-- =====================================================

-- Assignments (Teacher-created work)
CREATE TABLE public.assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    assignment_type TEXT DEFAULT 'quiz' CHECK (assignment_type IN ('quiz', 'homework', 'practice', 'test')),
    chapter_id UUID REFERENCES public.chapters(id) ON DELETE SET NULL,
    topic_ids UUID[],
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE SET NULL,
    total_marks INTEGER DEFAULT 100,
    passing_marks INTEGER DEFAULT 40,
    due_date TIMESTAMPTZ,
    available_from TIMESTAMPTZ DEFAULT NOW(),
    time_limit_minutes INTEGER,
    allow_late_submission BOOLEAN DEFAULT false,
    max_attempts INTEGER DEFAULT 1,
    shuffle_questions BOOLEAN DEFAULT true,
    show_answers_after_submission BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assignment submissions (Student work)
CREATE TABLE public.assignment_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    quiz_attempt_id UUID REFERENCES public.quiz_attempts(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'submitted', 'graded', 'returned')),
    score INTEGER,
    total_marks INTEGER,
    percentage DECIMAL(5,2),
    time_taken_minutes INTEGER,
    submitted_at TIMESTAMPTZ,
    graded_at TIMESTAMPTZ,
    graded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    teacher_feedback TEXT,
    is_late BOOLEAN DEFAULT false,
    attempt_number INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(assignment_id, student_id, attempt_number)
);

-- =====================================================
-- TEACHER TOOLS
-- =====================================================

-- Teacher notes about students
CREATE TABLE public.teacher_student_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    classroom_id UUID REFERENCES public.classrooms(id) ON DELETE SET NULL,
    note_type TEXT DEFAULT 'general' CHECK (note_type IN ('general', 'strength', 'weakness', 'recommendation', 'parent_communication')),
    content TEXT NOT NULL,
    is_private BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Progress reports for parents
CREATE TABLE public.progress_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    classroom_id UUID REFERENCES public.classrooms(id) ON DELETE SET NULL,
    report_period_start DATE NOT NULL,
    report_period_end DATE NOT NULL,
    overall_grade TEXT,
    overall_percentage DECIMAL(5,2),
    strengths TEXT[],
    areas_for_improvement TEXT[],
    teacher_comments TEXT,
    vark_insights JSONB,
    subject_performance JSONB,
    recommendations TEXT,
    is_shared_with_parent BOOLEAN DEFAULT false,
    shared_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX idx_classrooms_teacher ON public.classrooms(teacher_id);
CREATE INDEX idx_classrooms_invite_code ON public.classrooms(invite_code);
CREATE INDEX idx_classrooms_class_level ON public.classrooms(class_level);
CREATE INDEX idx_enrollments_classroom ON public.classroom_enrollments(classroom_id);
CREATE INDEX idx_enrollments_student ON public.classroom_enrollments(student_id);
CREATE INDEX idx_enrollments_status ON public.classroom_enrollments(status);
CREATE INDEX idx_assignments_classroom ON public.assignments(classroom_id);
CREATE INDEX idx_assignments_teacher ON public.assignments(teacher_id);
CREATE INDEX idx_assignments_status ON public.assignments(status);
CREATE INDEX idx_assignments_due_date ON public.assignments(due_date);
CREATE INDEX idx_submissions_assignment ON public.assignment_submissions(assignment_id);
CREATE INDEX idx_submissions_student ON public.assignment_submissions(student_id);
CREATE INDEX idx_submissions_status ON public.assignment_submissions(status);
CREATE INDEX idx_teacher_notes_student ON public.teacher_student_notes(student_id);
CREATE INDEX idx_teacher_notes_teacher ON public.teacher_student_notes(teacher_id);
CREATE INDEX idx_progress_reports_student ON public.progress_reports(student_id);
CREATE INDEX idx_progress_reports_teacher ON public.progress_reports(teacher_id);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all new tables
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_student_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_reports ENABLE ROW LEVEL SECURITY;

-- CLASSROOMS POLICIES
-- Teachers can manage their own classrooms
CREATE POLICY "Teachers can create classrooms" ON public.classrooms
    FOR INSERT WITH CHECK (
        teacher_id = auth.uid() AND
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher')
    );

CREATE POLICY "Teachers can view own classrooms" ON public.classrooms
    FOR SELECT USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can update own classrooms" ON public.classrooms
    FOR UPDATE USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete own classrooms" ON public.classrooms
    FOR DELETE USING (teacher_id = auth.uid());

-- Students can view classrooms they're enrolled in
CREATE POLICY "Students can view enrolled classrooms" ON public.classrooms
    FOR SELECT USING (
        id IN (
            SELECT classroom_id FROM public.classroom_enrollments
            WHERE student_id = auth.uid() AND status = 'active'
        )
    );

-- Anyone can view classroom by invite code (for joining)
CREATE POLICY "Anyone can lookup classroom by invite code" ON public.classrooms
    FOR SELECT USING (is_active = true);

-- ENROLLMENT POLICIES
-- Teachers can manage enrollments in their classrooms
CREATE POLICY "Teachers can view enrollments in own classrooms" ON public.classroom_enrollments
    FOR SELECT USING (
        classroom_id IN (SELECT id FROM public.classrooms WHERE teacher_id = auth.uid())
    );

CREATE POLICY "Teachers can manage enrollments in own classrooms" ON public.classroom_enrollments
    FOR ALL USING (
        classroom_id IN (SELECT id FROM public.classrooms WHERE teacher_id = auth.uid())
    );

-- Students can view their own enrollments
CREATE POLICY "Students can view own enrollments" ON public.classroom_enrollments
    FOR SELECT USING (student_id = auth.uid());

-- Students can enroll themselves (join classroom)
CREATE POLICY "Students can enroll themselves" ON public.classroom_enrollments
    FOR INSERT WITH CHECK (
        student_id = auth.uid() AND
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student')
    );

-- Students can leave classrooms (update status to 'left')
CREATE POLICY "Students can leave classrooms" ON public.classroom_enrollments
    FOR UPDATE USING (student_id = auth.uid());

-- ASSIGNMENT POLICIES
-- Teachers can manage assignments in their classrooms
CREATE POLICY "Teachers can create assignments" ON public.assignments
    FOR INSERT WITH CHECK (
        teacher_id = auth.uid() AND
        classroom_id IN (SELECT id FROM public.classrooms WHERE teacher_id = auth.uid())
    );

CREATE POLICY "Teachers can view own assignments" ON public.assignments
    FOR SELECT USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can update own assignments" ON public.assignments
    FOR UPDATE USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete own assignments" ON public.assignments
    FOR DELETE USING (teacher_id = auth.uid());

-- Students can view published assignments in enrolled classrooms
CREATE POLICY "Students can view published assignments" ON public.assignments
    FOR SELECT USING (
        status = 'published' AND
        classroom_id IN (
            SELECT classroom_id FROM public.classroom_enrollments
            WHERE student_id = auth.uid() AND status = 'active'
        )
    );

-- SUBMISSION POLICIES
-- Teachers can view all submissions for their assignments
CREATE POLICY "Teachers can view submissions for own assignments" ON public.assignment_submissions
    FOR SELECT USING (
        assignment_id IN (SELECT id FROM public.assignments WHERE teacher_id = auth.uid())
    );

-- Teachers can grade submissions
CREATE POLICY "Teachers can grade submissions" ON public.assignment_submissions
    FOR UPDATE USING (
        assignment_id IN (SELECT id FROM public.assignments WHERE teacher_id = auth.uid())
    );

-- Students can view own submissions
CREATE POLICY "Students can view own submissions" ON public.assignment_submissions
    FOR SELECT USING (student_id = auth.uid());

-- Students can create/update own submissions
CREATE POLICY "Students can create submissions" ON public.assignment_submissions
    FOR INSERT WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can update own submissions" ON public.assignment_submissions
    FOR UPDATE USING (student_id = auth.uid() AND status IN ('not_started', 'in_progress'));

-- TEACHER NOTES POLICIES
-- Teachers can manage their own notes
CREATE POLICY "Teachers can manage own notes" ON public.teacher_student_notes
    FOR ALL USING (teacher_id = auth.uid());

-- PROGRESS REPORTS POLICIES
-- Teachers can manage reports they created
CREATE POLICY "Teachers can manage own reports" ON public.progress_reports
    FOR ALL USING (teacher_id = auth.uid());

-- Students can view reports about them that are shared
CREATE POLICY "Students can view shared reports about them" ON public.progress_reports
    FOR SELECT USING (student_id = auth.uid() AND is_shared_with_parent = true);

-- Parents can view shared reports (if parent role exists and linked to student)
-- This would require a parent-student linking table, skipped for now

-- =====================================================
-- ADDITIONAL RLS FOR EXISTING TABLES (Teacher Access)
-- =====================================================

-- Teachers can view profiles of students in their classrooms
CREATE POLICY "Teachers can view student profiles" ON public.profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.classroom_enrollments ce
            JOIN public.classrooms c ON ce.classroom_id = c.id
            WHERE ce.student_id = profiles.id
            AND c.teacher_id = auth.uid()
            AND ce.status = 'active'
        )
    );

-- Teachers can view learning styles of their students
CREATE POLICY "Teachers can view student learning styles" ON public.learning_styles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.classroom_enrollments ce
            JOIN public.classrooms c ON ce.classroom_id = c.id
            WHERE ce.student_id = learning_styles.user_id
            AND c.teacher_id = auth.uid()
            AND ce.status = 'active'
        )
    );

-- Teachers can view student progress in their classrooms
CREATE POLICY "Teachers can view student topic progress" ON public.user_topic_progress
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.classroom_enrollments ce
            JOIN public.classrooms c ON ce.classroom_id = c.id
            WHERE ce.student_id = user_topic_progress.user_id
            AND c.teacher_id = auth.uid()
            AND ce.status = 'active'
        )
    );

-- Teachers can view student stats
CREATE POLICY "Teachers can view student stats" ON public.user_stats
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.classroom_enrollments ce
            JOIN public.classrooms c ON ce.classroom_id = c.id
            WHERE ce.student_id = user_stats.user_id
            AND c.teacher_id = auth.uid()
            AND ce.status = 'active'
        )
    );

-- Teachers can view student quiz attempts
CREATE POLICY "Teachers can view student quiz attempts" ON public.quiz_attempts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.classroom_enrollments ce
            JOIN public.classrooms c ON ce.classroom_id = c.id
            WHERE ce.student_id = quiz_attempts.user_id
            AND c.teacher_id = auth.uid()
            AND ce.status = 'active'
        )
    );

-- Teachers can view student answers
CREATE POLICY "Teachers can view student answers" ON public.user_answers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.classroom_enrollments ce
            JOIN public.classrooms c ON ce.classroom_id = c.id
            WHERE ce.student_id = user_answers.user_id
            AND c.teacher_id = auth.uid()
            AND ce.status = 'active'
        )
    );

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to generate invite code
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..6 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate invite code for new classrooms
CREATE OR REPLACE FUNCTION set_classroom_invite_code()
RETURNS TRIGGER AS $$
DECLARE
    new_code TEXT;
    code_exists BOOLEAN;
BEGIN
    IF NEW.invite_code IS NULL OR NEW.invite_code = '' THEN
        LOOP
            new_code := generate_invite_code();
            SELECT EXISTS(SELECT 1 FROM public.classrooms WHERE invite_code = new_code) INTO code_exists;
            EXIT WHEN NOT code_exists;
        END LOOP;
        NEW.invite_code := new_code;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_classroom_insert
    BEFORE INSERT ON public.classrooms
    FOR EACH ROW EXECUTE FUNCTION set_classroom_invite_code();

-- Update timestamps trigger for new tables
CREATE TRIGGER update_classrooms_updated_at BEFORE UPDATE ON public.classrooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON public.assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_submissions_updated_at BEFORE UPDATE ON public.assignment_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_teacher_notes_updated_at BEFORE UPDATE ON public.teacher_student_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- HELPER VIEWS FOR TEACHER DASHBOARD
-- =====================================================

-- View: Classroom summary with student count
CREATE OR REPLACE VIEW public.classroom_summary AS
SELECT
    c.id,
    c.teacher_id,
    c.name,
    c.description,
    c.class_level,
    c.invite_code,
    c.is_active,
    c.created_at,
    COUNT(DISTINCT ce.student_id) FILTER (WHERE ce.status = 'active') as student_count,
    COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'published') as active_assignments,
    COUNT(DISTINCT asub.id) FILTER (WHERE asub.status = 'submitted') as pending_submissions
FROM public.classrooms c
LEFT JOIN public.classroom_enrollments ce ON c.id = ce.classroom_id
LEFT JOIN public.assignments a ON c.id = a.classroom_id
LEFT JOIN public.assignment_submissions asub ON a.id = asub.assignment_id
GROUP BY c.id;

-- View: Student summary for teachers
CREATE OR REPLACE VIEW public.student_classroom_summary AS
SELECT
    ce.classroom_id,
    ce.student_id,
    p.full_name,
    p.email,
    p.avatar_url,
    p.current_class,
    ls.visual_score,
    ls.auditory_score,
    ls.reading_score,
    ls.kinesthetic_score,
    ls.dominant_style,
    us.total_xp,
    us.current_streak,
    us.level,
    us.total_questions_answered,
    us.correct_answers,
    ce.joined_at,
    ce.status as enrollment_status
FROM public.classroom_enrollments ce
JOIN public.profiles p ON ce.student_id = p.id
LEFT JOIN public.learning_styles ls ON p.id = ls.user_id
LEFT JOIN public.user_stats us ON p.id = us.user_id
WHERE ce.status = 'active';
