-- =====================================================
-- MyCupIsEmpty - Complete Database Schema
-- Supabase PostgreSQL Migration
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =====================================================
-- USERS & AUTHENTICATION
-- =====================================================

-- User profiles (extends Supabase auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'parent', 'admin')),
    current_class INTEGER CHECK (current_class BETWEEN 1 AND 12),
    school_name TEXT,
    city TEXT,
    state TEXT,
    preferred_language TEXT DEFAULT 'en' CHECK (preferred_language IN ('en', 'hi')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Learning style profile (VARK)
CREATE TABLE public.learning_styles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    visual_score INTEGER DEFAULT 0 CHECK (visual_score BETWEEN 0 AND 100),
    auditory_score INTEGER DEFAULT 0 CHECK (auditory_score BETWEEN 0 AND 100),
    reading_score INTEGER DEFAULT 0 CHECK (reading_score BETWEEN 0 AND 100),
    kinesthetic_score INTEGER DEFAULT 0 CHECK (kinesthetic_score BETWEEN 0 AND 100),
    dominant_style TEXT CHECK (dominant_style IN ('visual', 'auditory', 'reading', 'kinesthetic')),
    assessment_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Multiple Intelligences (Howard Gardner)
CREATE TABLE public.multiple_intelligences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    logical_mathematical INTEGER DEFAULT 50 CHECK (logical_mathematical BETWEEN 0 AND 100),
    linguistic INTEGER DEFAULT 50 CHECK (linguistic BETWEEN 0 AND 100),
    spatial INTEGER DEFAULT 50 CHECK (spatial BETWEEN 0 AND 100),
    musical INTEGER DEFAULT 50 CHECK (musical BETWEEN 0 AND 100),
    bodily_kinesthetic INTEGER DEFAULT 50 CHECK (bodily_kinesthetic BETWEEN 0 AND 100),
    interpersonal INTEGER DEFAULT 50 CHECK (interpersonal BETWEEN 0 AND 100),
    intrapersonal INTEGER DEFAULT 50 CHECK (intrapersonal BETWEEN 0 AND 100),
    naturalistic INTEGER DEFAULT 50 CHECK (naturalistic BETWEEN 0 AND 100),
    assessment_date TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- =====================================================
-- CURRICULUM STRUCTURE
-- =====================================================

-- Classes (1-12)
CREATE TABLE public.classes (
    id SERIAL PRIMARY KEY,
    class_number INTEGER NOT NULL UNIQUE CHECK (class_number BETWEEN 1 AND 12),
    name TEXT NOT NULL, -- "Class 1", "Class 12"
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subjects
CREATE TABLE public.subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id INTEGER REFERENCES public.classes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    name_hindi TEXT,
    code TEXT, -- "math", "science", "english"
    icon TEXT, -- emoji or icon name
    color TEXT, -- hex color
    description TEXT,
    book_title TEXT, -- NCERT book title
    book_code TEXT, -- NCERT book code for API
    total_chapters INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(class_id, code)
);

-- Chapters
CREATE TABLE public.chapters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    chapter_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    title_hindi TEXT,
    description TEXT,
    ncert_page_start INTEGER,
    ncert_page_end INTEGER,
    ncert_pdf_url TEXT,
    estimated_duration_minutes INTEGER DEFAULT 60,
    difficulty_level INTEGER DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 5),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(subject_id, chapter_number)
);

-- Topics within chapters
CREATE TABLE public.topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chapter_id UUID REFERENCES public.chapters(id) ON DELETE CASCADE,
    topic_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    title_hindi TEXT,
    content_text TEXT, -- Main content from NCERT
    content_html TEXT, -- Formatted content
    bloom_levels JSONB, -- {"remember": true, "understand": true, etc}
    key_concepts JSONB, -- Array of key terms
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(chapter_id, topic_number)
);

-- =====================================================
-- CONTENT & LEARNING MATERIALS
-- =====================================================

-- Definitions and key terms
CREATE TABLE public.definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
    term TEXT NOT NULL,
    term_hindi TEXT,
    definition TEXT NOT NULL,
    definition_hindi TEXT,
    example TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Formulas (for Math, Science, etc.)
CREATE TABLE public.formulas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    formula_latex TEXT NOT NULL,
    formula_text TEXT,
    description TEXT,
    example TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Examples and worked solutions
CREATE TABLE public.examples (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
    example_number INTEGER,
    problem_text TEXT NOT NULL,
    solution_text TEXT NOT NULL,
    solution_steps JSONB, -- Array of step-by-step solutions
    difficulty_level INTEGER DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 5),
    bloom_level TEXT CHECK (bloom_level IN ('remember', 'understand', 'apply', 'analyze', 'evaluate', 'create')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Learning content in different formats (for VARK adaptation)
CREATE TABLE public.learning_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL CHECK (content_type IN ('visual', 'auditory', 'reading', 'kinesthetic')),
    format TEXT NOT NULL CHECK (format IN ('text', 'video', 'audio', 'diagram', 'animation', 'interactive', 'activity')),
    title TEXT NOT NULL,
    content_text TEXT,
    content_url TEXT,
    thumbnail_url TEXT,
    duration_minutes INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- QUESTIONS & ASSESSMENTS
-- =====================================================

-- Question bank
CREATE TABLE public.questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
    question_type TEXT NOT NULL CHECK (question_type IN ('mcq', 'fill_blank', 'true_false', 'short_answer', 'long_answer', 'match', 'assertion_reason')),
    question_text TEXT NOT NULL,
    question_text_hindi TEXT,
    options JSONB, -- For MCQ: [{text, isCorrect}, ...]
    correct_answer TEXT,
    explanation TEXT,
    explanation_hindi TEXT,
    difficulty_level INTEGER DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 5),
    bloom_level TEXT CHECK (bloom_level IN ('remember', 'understand', 'apply', 'analyze', 'evaluate', 'create')),
    marks INTEGER DEFAULT 1,
    time_limit_seconds INTEGER,
    source TEXT, -- "ncert", "exemplar", "previous_year", "custom"
    year INTEGER, -- For previous year questions
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quizzes
CREATE TABLE public.quizzes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chapter_id UUID REFERENCES public.chapters(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    quiz_type TEXT DEFAULT 'practice' CHECK (quiz_type IN ('practice', 'test', 'assessment', 'daily_challenge')),
    total_questions INTEGER DEFAULT 10,
    time_limit_minutes INTEGER,
    passing_percentage INTEGER DEFAULT 60,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quiz questions junction
CREATE TABLE public.quiz_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
    question_order INTEGER NOT NULL,
    UNIQUE(quiz_id, question_id)
);

-- =====================================================
-- USER PROGRESS & ANALYTICS
-- =====================================================

-- User progress per topic
CREATE TABLE public.user_topic_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'mastered')),
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
    time_spent_minutes INTEGER DEFAULT 0,
    last_accessed TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    mastery_score INTEGER DEFAULT 0 CHECK (mastery_score BETWEEN 0 AND 100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, topic_id)
);

-- User answers to questions
CREATE TABLE public.user_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
    quiz_id UUID REFERENCES public.quizzes(id),
    answer_given TEXT,
    is_correct BOOLEAN,
    time_taken_seconds INTEGER,
    attempt_number INTEGER DEFAULT 1,
    answered_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quiz attempts
CREATE TABLE public.quiz_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
    score INTEGER DEFAULT 0,
    total_marks INTEGER,
    percentage DECIMAL(5,2),
    time_taken_minutes INTEGER,
    status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- =====================================================
-- GAMIFICATION
-- =====================================================

-- XP and streaks
CREATE TABLE public.user_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    total_xp INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_activity_date DATE,
    total_questions_answered INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    total_time_spent_minutes INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Achievements/Badges
CREATE TABLE public.achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    xp_reward INTEGER DEFAULT 0,
    criteria JSONB, -- {"type": "streak", "value": 7}
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User achievements
CREATE TABLE public.user_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    achievement_id UUID REFERENCES public.achievements(id) ON DELETE CASCADE,
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, achievement_id)
);

-- Daily goals
CREATE TABLE public.daily_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    goal_date DATE DEFAULT CURRENT_DATE,
    questions_goal INTEGER DEFAULT 20,
    questions_completed INTEGER DEFAULT 0,
    time_goal_minutes INTEGER DEFAULT 30,
    time_completed_minutes INTEGER DEFAULT 0,
    xp_goal INTEGER DEFAULT 100,
    xp_earned INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT false,
    UNIQUE(user_id, goal_date)
);

-- =====================================================
-- AI & CHAT
-- =====================================================

-- AI Chat sessions
CREATE TABLE public.chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES public.topics(id),
    title TEXT,
    learning_style TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages
CREATE TABLE public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB, -- For storing additional data like sources, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SPACED REPETITION
-- =====================================================

-- Flashcards for spaced repetition
CREATE TABLE public.flashcards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
    front_text TEXT NOT NULL,
    back_text TEXT NOT NULL,
    card_type TEXT DEFAULT 'definition' CHECK (card_type IN ('definition', 'formula', 'concept', 'example')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User flashcard progress (SM-2 algorithm)
CREATE TABLE public.user_flashcard_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    flashcard_id UUID REFERENCES public.flashcards(id) ON DELETE CASCADE,
    easiness_factor DECIMAL(3,2) DEFAULT 2.5,
    interval_days INTEGER DEFAULT 1,
    repetitions INTEGER DEFAULT 0,
    next_review_date DATE DEFAULT CURRENT_DATE,
    last_review_date DATE,
    UNIQUE(user_id, flashcard_id)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX idx_subjects_class ON public.subjects(class_id);
CREATE INDEX idx_chapters_subject ON public.chapters(subject_id);
CREATE INDEX idx_topics_chapter ON public.topics(chapter_id);
CREATE INDEX idx_questions_topic ON public.questions(topic_id);
CREATE INDEX idx_user_progress_user ON public.user_topic_progress(user_id);
CREATE INDEX idx_user_progress_topic ON public.user_topic_progress(topic_id);
CREATE INDEX idx_user_answers_user ON public.user_answers(user_id);
CREATE INDEX idx_user_answers_question ON public.user_answers(question_id);
CREATE INDEX idx_chat_messages_session ON public.chat_messages(session_id);
CREATE INDEX idx_flashcard_progress_user ON public.user_flashcard_progress(user_id);
CREATE INDEX idx_flashcard_progress_next_review ON public.user_flashcard_progress(next_review_date);

-- Full text search indexes
CREATE INDEX idx_topics_content_search ON public.topics USING gin(to_tsvector('english', content_text));
CREATE INDEX idx_questions_text_search ON public.questions USING gin(to_tsvector('english', question_text));

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multiple_intelligences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_topic_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_flashcard_progress ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own learning style" ON public.learning_styles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own learning style" ON public.learning_styles FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own intelligences" ON public.multiple_intelligences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own intelligences" ON public.multiple_intelligences FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own progress" ON public.user_topic_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON public.user_topic_progress FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own answers" ON public.user_answers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own answers" ON public.user_answers FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own quiz attempts" ON public.quiz_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own quiz attempts" ON public.quiz_attempts FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own stats" ON public.user_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own stats" ON public.user_stats FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own achievements" ON public.user_achievements FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own daily goals" ON public.daily_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own daily goals" ON public.daily_goals FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own chat sessions" ON public.chat_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own chat sessions" ON public.chat_sessions FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own chat messages" ON public.chat_messages FOR SELECT 
    USING (session_id IN (SELECT id FROM public.chat_sessions WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own chat messages" ON public.chat_messages FOR INSERT 
    WITH CHECK (session_id IN (SELECT id FROM public.chat_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can view own flashcard progress" ON public.user_flashcard_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own flashcard progress" ON public.user_flashcard_progress FOR ALL USING (auth.uid() = user_id);

-- Public read access for curriculum content
CREATE POLICY "Anyone can view classes" ON public.classes FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Anyone can view subjects" ON public.subjects FOR SELECT TO authenticated, anon USING (is_active = true);
CREATE POLICY "Anyone can view chapters" ON public.chapters FOR SELECT TO authenticated, anon USING (is_active = true);
CREATE POLICY "Anyone can view topics" ON public.topics FOR SELECT TO authenticated, anon USING (is_active = true);
CREATE POLICY "Anyone can view definitions" ON public.definitions FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Anyone can view formulas" ON public.formulas FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Anyone can view examples" ON public.examples FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Anyone can view learning content" ON public.learning_content FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Anyone can view questions" ON public.questions FOR SELECT TO authenticated, anon USING (is_active = true);
CREATE POLICY "Anyone can view quizzes" ON public.quizzes FOR SELECT TO authenticated, anon USING (is_active = true);
CREATE POLICY "Anyone can view quiz questions" ON public.quiz_questions FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Anyone can view achievements" ON public.achievements FOR SELECT TO authenticated, anon USING (is_active = true);
CREATE POLICY "Anyone can view flashcards" ON public.flashcards FOR SELECT TO authenticated, anon USING (true);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update user XP and check achievements
CREATE OR REPLACE FUNCTION update_user_xp(p_user_id UUID, p_xp_amount INTEGER)
RETURNS VOID AS $$
DECLARE
    v_new_xp INTEGER;
    v_new_level INTEGER;
BEGIN
    UPDATE public.user_stats 
    SET total_xp = total_xp + p_xp_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING total_xp INTO v_new_xp;
    
    -- Calculate new level (100 XP per level)
    v_new_level := FLOOR(v_new_xp / 100) + 1;
    
    UPDATE public.user_stats 
    SET level = v_new_level
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update streak
CREATE OR REPLACE FUNCTION update_user_streak(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_last_activity DATE;
    v_current_streak INTEGER;
    v_longest_streak INTEGER;
BEGIN
    SELECT last_activity_date, current_streak, longest_streak 
    INTO v_last_activity, v_current_streak, v_longest_streak
    FROM public.user_stats 
    WHERE user_id = p_user_id;
    
    IF v_last_activity = CURRENT_DATE - INTERVAL '1 day' THEN
        -- Continuing streak
        v_current_streak := v_current_streak + 1;
    ELSIF v_last_activity < CURRENT_DATE - INTERVAL '1 day' THEN
        -- Streak broken
        v_current_streak := 1;
    END IF;
    
    IF v_current_streak > v_longest_streak THEN
        v_longest_streak := v_current_streak;
    END IF;
    
    UPDATE public.user_stats 
    SET current_streak = v_current_streak,
        longest_streak = v_longest_streak,
        last_activity_date = CURRENT_DATE,
        updated_at = NOW()
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    
    INSERT INTO public.user_stats (user_id)
    VALUES (NEW.id);
    
    INSERT INTO public.learning_styles (user_id)
    VALUES (NEW.id);
    
    INSERT INTO public.multiple_intelligences (user_id)
    VALUES (NEW.id);
    
    INSERT INTO public.daily_goals (user_id, goal_date)
    VALUES (NEW.id, CURRENT_DATE);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_user_stats_updated_at BEFORE UPDATE ON public.user_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_user_progress_updated_at BEFORE UPDATE ON public.user_topic_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- SEED INITIAL DATA
-- =====================================================

-- Insert classes 1-12
INSERT INTO public.classes (class_number, name, description) VALUES
(1, 'Class 1', 'Foundation level for primary education'),
(2, 'Class 2', 'Building basic literacy and numeracy'),
(3, 'Class 3', 'Developing reading and problem-solving skills'),
(4, 'Class 4', 'Intermediate primary education'),
(5, 'Class 5', 'Advanced primary education'),
(6, 'Class 6', 'Middle school - Introduction to Sciences'),
(7, 'Class 7', 'Middle school - Expanding knowledge'),
(8, 'Class 8', 'Middle school - Pre-secondary preparation'),
(9, 'Class 9', 'Secondary education begins'),
(10, 'Class 10', 'Board examination year'),
(11, 'Class 11', 'Senior secondary - Stream specialization'),
(12, 'Class 12', 'Board examination and competitive prep');

-- Insert default achievements
INSERT INTO public.achievements (code, name, description, icon, xp_reward, criteria) VALUES
('first_login', 'Welcome!', 'Complete your first login', '🎉', 10, '{"type": "first_login"}'),
('streak_7', 'Week Warrior', 'Maintain a 7-day streak', '🔥', 50, '{"type": "streak", "value": 7}'),
('streak_30', 'Monthly Master', 'Maintain a 30-day streak', '🏆', 200, '{"type": "streak", "value": 30}'),
('first_quiz', 'Quiz Starter', 'Complete your first quiz', '📝', 20, '{"type": "quiz_count", "value": 1}'),
('quiz_10', 'Quiz Pro', 'Complete 10 quizzes', '🎯', 100, '{"type": "quiz_count", "value": 10}'),
('perfect_score', 'Perfect!', 'Score 100% on a quiz', '⭐', 50, '{"type": "perfect_score"}'),
('chapter_complete', 'Chapter Champion', 'Complete a chapter', '📖', 30, '{"type": "chapter_complete"}'),
('subject_mastery', 'Subject Star', 'Achieve 80% mastery in a subject', '🌟', 200, '{"type": "subject_mastery", "value": 80}'),
('xp_100', 'Rising Star', 'Earn 100 XP', '✨', 0, '{"type": "xp", "value": 100}'),
('xp_1000', 'XP Hunter', 'Earn 1000 XP', '💎', 0, '{"type": "xp", "value": 1000}');
