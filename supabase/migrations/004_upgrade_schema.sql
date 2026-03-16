-- ============================================================================
-- MyCupIsEmpty Platform Upgrade Migration
-- Adds: Character Building, Learning DNA, Teaching Methods, Activities, AI Guru
-- ============================================================================

-- ============================================================================
-- REQUIREMENT 1: Teacher Intelligence - Character Building
-- ============================================================================

CREATE TABLE public.character_traits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    trait_category TEXT NOT NULL CHECK (trait_category IN (
        'values', 'habits', 'social_skills', 'emotional_intelligence',
        'responsibility', 'empathy', 'resilience', 'teamwork', 'integrity', 'curiosity'
    )),
    score INTEGER DEFAULT 50 CHECK (score BETWEEN 0 AND 100),
    observations TEXT,
    assessed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.character_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    classroom_id UUID REFERENCES public.classrooms(id) ON DELETE SET NULL,
    trait_category TEXT NOT NULL,
    goal_description TEXT NOT NULL,
    target_score INTEGER CHECK (target_score BETWEEN 0 AND 100),
    current_score INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'paused')),
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.student_teaching_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    recommended_methods TEXT[] NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, teacher_id, subject_id)
);

-- Indexes
CREATE INDEX idx_character_traits_student ON public.character_traits(student_id);
CREATE INDEX idx_character_traits_teacher ON public.character_traits(teacher_id);
CREATE INDEX idx_character_goals_student ON public.character_goals(student_id);
CREATE INDEX idx_character_goals_teacher ON public.character_goals(teacher_id);
CREATE INDEX idx_student_teaching_methods_student ON public.student_teaching_methods(student_id);

-- RLS
ALTER TABLE public.character_traits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_teaching_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage character traits for their classroom students"
    ON public.character_traits FOR ALL USING (
        auth.uid() = teacher_id
        OR auth.uid() = student_id
    );

CREATE POLICY "Teachers can manage character goals for their classroom students"
    ON public.character_goals FOR ALL USING (
        auth.uid() = teacher_id
        OR auth.uid() = student_id
    );

CREATE POLICY "Teachers can manage student teaching methods"
    ON public.student_teaching_methods FOR ALL USING (
        auth.uid() = teacher_id
        OR auth.uid() = student_id
    );

-- ============================================================================
-- REQUIREMENT 3: Learning Discovery - Extended Assessments
-- ============================================================================

CREATE TABLE public.kolb_styles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    concrete_experience INTEGER DEFAULT 50 CHECK (concrete_experience BETWEEN 0 AND 100),
    reflective_observation INTEGER DEFAULT 50 CHECK (reflective_observation BETWEEN 0 AND 100),
    abstract_conceptualization INTEGER DEFAULT 50 CHECK (abstract_conceptualization BETWEEN 0 AND 100),
    active_experimentation INTEGER DEFAULT 50 CHECK (active_experimentation BETWEEN 0 AND 100),
    kolb_type TEXT CHECK (kolb_type IN ('diverger', 'assimilator', 'converger', 'accommodator')),
    assessment_date TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE TABLE public.subject_aptitude (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    aptitude_score INTEGER DEFAULT 50 CHECK (aptitude_score BETWEEN 0 AND 100),
    interest_score INTEGER DEFAULT 50 CHECK (interest_score BETWEEN 0 AND 100),
    performance_score INTEGER DEFAULT 50 CHECK (performance_score BETWEEN 0 AND 100),
    recommended_difficulty TEXT DEFAULT 'medium' CHECK (recommended_difficulty IN ('easy', 'medium', 'hard')),
    assessed_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, subject_id)
);

CREATE TABLE public.learning_dna (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    vark_primary TEXT,
    gardner_top_3 TEXT[],
    kolb_type TEXT,
    preferred_methods TEXT[],
    learning_speed TEXT DEFAULT 'medium' CHECK (learning_speed IN ('slow', 'medium', 'fast')),
    best_time_of_day TEXT CHECK (best_time_of_day IN ('morning', 'afternoon', 'evening', 'night')),
    attention_span_minutes INTEGER DEFAULT 25,
    profile_completeness INTEGER DEFAULT 0 CHECK (profile_completeness BETWEEN 0 AND 100),
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_kolb_styles_user ON public.kolb_styles(user_id);
CREATE INDEX idx_subject_aptitude_user ON public.subject_aptitude(user_id);
CREATE INDEX idx_subject_aptitude_subject ON public.subject_aptitude(subject_id);
CREATE INDEX idx_learning_dna_user ON public.learning_dna(user_id);

-- RLS
ALTER TABLE public.kolb_styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_aptitude ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_dna ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own kolb styles"
    ON public.kolb_styles FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own subject aptitude"
    ON public.subject_aptitude FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own learning DNA"
    ON public.learning_dna FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- REQUIREMENT 4: Teaching Methods Registry
-- ============================================================================

CREATE TABLE public.teaching_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    name_hindi TEXT,
    category TEXT NOT NULL CHECK (category IN ('modern', 'ancient', 'scientific')),
    description TEXT NOT NULL,
    description_hindi TEXT,
    best_for_vark TEXT[],
    best_for_subjects TEXT[],
    best_for_bloom TEXT[],
    icon TEXT,
    steps TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.student_method_effectiveness (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
    method_code TEXT NOT NULL,
    understanding_before INTEGER CHECK (understanding_before BETWEEN 0 AND 100),
    understanding_after INTEGER CHECK (understanding_after BETWEEN 0 AND 100),
    time_spent_minutes INTEGER DEFAULT 0,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_method_effectiveness_user ON public.student_method_effectiveness(user_id);
CREATE INDEX idx_method_effectiveness_topic ON public.student_method_effectiveness(topic_id);
CREATE INDEX idx_method_effectiveness_method ON public.student_method_effectiveness(method_code);

-- RLS
ALTER TABLE public.teaching_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_method_effectiveness ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read teaching methods"
    ON public.teaching_methods FOR SELECT USING (true);

CREATE POLICY "Users can manage their own method effectiveness"
    ON public.student_method_effectiveness FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- REQUIREMENT 5: Interactive Engagement - Activities & Challenges
-- ============================================================================

CREATE TABLE public.activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL CHECK (activity_type IN (
        'word_puzzle', 'number_game', 'drag_drop', 'case_study',
        'virtual_lab', 'timed_challenge', 'creative_project',
        'simulation', 'sequence_arrange', 'concept_match'
    )),
    title TEXT NOT NULL,
    title_hindi TEXT,
    description TEXT,
    difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    config JSONB NOT NULL DEFAULT '{}',
    time_limit_seconds INTEGER,
    xp_reward INTEGER DEFAULT 10,
    max_score INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.activity_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    score INTEGER DEFAULT 0,
    max_score INTEGER,
    time_taken_seconds INTEGER,
    completed BOOLEAN DEFAULT false,
    result_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    classroom_id UUID REFERENCES public.classrooms(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    challenge_type TEXT NOT NULL CHECK (challenge_type IN ('speed', 'accuracy', 'creative', 'collaborative')),
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    config JSONB NOT NULL DEFAULT '{}',
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.challenge_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    score INTEGER DEFAULT 0,
    rank INTEGER,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(challenge_id, user_id)
);

-- Indexes
CREATE INDEX idx_activities_topic ON public.activities(topic_id);
CREATE INDEX idx_activities_subject ON public.activities(subject_id);
CREATE INDEX idx_activities_type ON public.activities(activity_type);
CREATE INDEX idx_activity_attempts_user ON public.activity_attempts(user_id);
CREATE INDEX idx_activity_attempts_activity ON public.activity_attempts(activity_id);
CREATE INDEX idx_challenges_classroom ON public.challenges(classroom_id);
CREATE INDEX idx_challenges_active ON public.challenges(is_active, ends_at);
CREATE INDEX idx_challenge_participants_user ON public.challenge_participants(user_id);
CREATE INDEX idx_challenge_participants_challenge ON public.challenge_participants(challenge_id);

-- RLS
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read activities"
    ON public.activities FOR SELECT USING (true);

CREATE POLICY "Users can manage their own activity attempts"
    ON public.activity_attempts FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Everyone can read active challenges"
    ON public.challenges FOR SELECT USING (true);

CREATE POLICY "Teachers can create challenges"
    ON public.challenges FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can manage their own challenge participation"
    ON public.challenge_participants FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- REQUIREMENT 2: AI Guru - Extend existing chat_sessions
-- ============================================================================

ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS
    session_type TEXT DEFAULT 'tutor' CHECK (session_type IN ('tutor', 'guru', 'socratic', 'exploration'));
ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS
    teaching_method TEXT;
ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS
    difficulty_level INTEGER DEFAULT 5 CHECK (difficulty_level BETWEEN 1 AND 10);
ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS
    is_beyond_curriculum BOOLEAN DEFAULT false;

CREATE TABLE public.understanding_checkpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    checkpoint_number INTEGER NOT NULL,
    understanding_level INTEGER CHECK (understanding_level BETWEEN 1 AND 5),
    ai_assessment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_understanding_checkpoints_session ON public.understanding_checkpoints(session_id);
CREATE INDEX idx_understanding_checkpoints_user ON public.understanding_checkpoints(user_id);

ALTER TABLE public.understanding_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own understanding checkpoints"
    ON public.understanding_checkpoints FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- SEED: Teaching Methods (20+ methods)
-- ============================================================================

INSERT INTO public.teaching_methods (code, name, name_hindi, category, description, best_for_vark, best_for_subjects, best_for_bloom, icon, steps) VALUES

-- MODERN METHODS
('feynman', 'Feynman Technique', 'फेनमैन तकनीक', 'modern',
 'Explain a concept in the simplest possible terms, as if teaching a child. If you get stuck, go back and study that part again.',
 ARRAY['reading', 'auditory'], ARRAY['math', 'science', 'social_science'], ARRAY['understand', 'apply'],
 '🎯', ARRAY['Choose a concept', 'Explain it in simple language', 'Identify gaps in your explanation', 'Go back and fill the gaps', 'Simplify and use analogies']),

('mind_map', 'Mind Mapping', 'माइंड मैपिंग', 'modern',
 'Create a visual diagram that maps out ideas, concepts, and their relationships radiating from a central theme.',
 ARRAY['visual'], ARRAY['all'], ARRAY['remember', 'understand', 'analyze'],
 '🧠', ARRAY['Write the central concept in the middle', 'Draw branches for main sub-topics', 'Add sub-branches for details', 'Use colors and images', 'Connect related ideas with lines']),

('cornell_notes', 'Cornell Notes', 'कॉर्नेल नोट्स', 'modern',
 'A structured note-taking system that divides notes into cues, main notes, and summary sections.',
 ARRAY['reading'], ARRAY['all'], ARRAY['remember', 'understand'],
 '📝', ARRAY['Divide your page into 3 sections', 'Take notes in the large right column', 'Write questions/cues in the left column', 'Write a summary at the bottom', 'Review using the cue column']),

('pomodoro', 'Pomodoro Technique', 'पोमोडोरो तकनीक', 'modern',
 'Study in focused 25-minute intervals with 5-minute breaks. After 4 cycles, take a longer break.',
 ARRAY['kinesthetic'], ARRAY['all'], ARRAY['remember', 'apply'],
 '🍅', ARRAY['Set a 25-minute timer', 'Focus completely on one task', 'Take a 5-minute break', 'Repeat 4 times', 'Take a 15-30 minute long break']),

('teach_back', 'Teach-Back Method', 'सिखाकर सीखना', 'modern',
 'Learn by teaching the concept to someone else. Explaining forces you to organize and deepen your understanding.',
 ARRAY['auditory', 'kinesthetic'], ARRAY['all'], ARRAY['understand', 'evaluate', 'create'],
 '👨‍🏫', ARRAY['Study the material thoroughly', 'Prepare to teach it to someone', 'Explain it out loud (to a friend, parent, or even a toy)', 'Answer questions about it', 'Note what you struggled to explain']),

('project_based', 'Project-Based Learning', 'प्रोजेक्ट आधारित शिक्षा', 'modern',
 'Learn by building real projects and solving authentic problems that require applying multiple concepts.',
 ARRAY['kinesthetic', 'visual'], ARRAY['science', 'math', 'computer_science'], ARRAY['apply', 'create'],
 '🏗️', ARRAY['Define a real-world problem', 'Research what you need to know', 'Plan your project', 'Build and iterate', 'Present and reflect on what you learned']),

('pq4r', 'PQ4R Method', 'PQ4R विधि', 'modern',
 'Preview, Question, Read, Reflect, Recite, Review — a systematic approach to reading and retaining textbook material.',
 ARRAY['reading'], ARRAY['all'], ARRAY['remember', 'understand'],
 '📖', ARRAY['Preview: Skim headings and summaries', 'Question: Turn headings into questions', 'Read: Read actively to answer your questions', 'Reflect: Think about what you read', 'Recite: Say key points from memory', 'Review: Go over the material again']),

('analogy', 'Analogy-Based Learning', 'सादृश्य आधारित शिक्षा', 'modern',
 'Connect new, unfamiliar concepts to things you already know. Build bridges between the known and unknown.',
 ARRAY['visual', 'auditory'], ARRAY['science', 'math'], ARRAY['understand', 'apply'],
 '🔗', ARRAY['Identify the new concept', 'Think of something familiar that works similarly', 'Map the similarities', 'Note the differences', 'Use the analogy to explain and remember']),

-- ANCIENT METHODS
('gurukul', 'Gurukul Method', 'गुरुकुल पद्धति', 'ancient',
 'The ancient Indian teacher-student relationship where learning happens through close mentorship, dialogue, and living with the teacher.',
 ARRAY['auditory', 'kinesthetic'], ARRAY['all'], ARRAY['understand', 'evaluate'],
 '🙏', ARRAY['Find a mentor or guide for the subject', 'Ask questions with genuine curiosity', 'Discuss ideas in dialogue', 'Practice under guidance', 'Reflect and seek feedback']),

('vedic_math', 'Vedic Mathematics', 'वैदिक गणित', 'ancient',
 'Ancient Indian mathematical techniques using 16 sutras (formulas) for rapid mental calculation and problem solving.',
 ARRAY['visual', 'kinesthetic'], ARRAY['math'], ARRAY['apply', 'remember'],
 '🕉️', ARRAY['Learn the relevant Vedic sutra', 'Understand the pattern behind it', 'Practice with simple examples', 'Increase difficulty gradually', 'Apply to solve problems mentally']),

('memory_palace', 'Memory Palace (Loci Method)', 'स्मृति महल (लोकी विधि)', 'ancient',
 'Associate information with specific locations in a familiar place. Walk through the palace mentally to recall information.',
 ARRAY['visual', 'kinesthetic'], ARRAY['all'], ARRAY['remember'],
 '🏰', ARRAY['Choose a familiar location (your home)', 'Identify specific spots along a path', 'Associate each piece of information with a spot', 'Create vivid, unusual mental images', 'Walk the path mentally to recall']),

('socratic', 'Socratic Dialogue', 'सुकरात संवाद', 'ancient',
 'Learn through a series of guided questions that lead you to discover the answer yourself, rather than being told directly.',
 ARRAY['auditory'], ARRAY['all'], ARRAY['understand', 'analyze', 'evaluate'],
 '❓', ARRAY['Start with what you think you know', 'Ask "why" and "how" questions', 'Challenge assumptions', 'Follow the logical chain', 'Arrive at understanding through questioning']),

('storytelling', 'Kathasaritsagara / Storytelling', 'कथासरित्सागर / कहानी सुनाना', 'ancient',
 'Learn through narratives, stories, and parables. Ancient Indian tradition of teaching complex ideas through engaging tales.',
 ARRAY['auditory', 'visual'], ARRAY['social_science', 'english', 'hindi', 'science'], ARRAY['understand', 'remember'],
 '📚', ARRAY['Frame the concept as a story', 'Create characters that represent ideas', 'Build a narrative with a problem', 'Show how the concept solves the problem', 'Remember the story to remember the concept']),

('visualization', 'Visualization / Dhyana', 'दृश्यकल्पना / ध्यान', 'ancient',
 'Create vivid mental images of abstract concepts. The ancient practice of focused meditation applied to learning.',
 ARRAY['visual'], ARRAY['all'], ARRAY['understand', 'remember'],
 '🧘', ARRAY['Close your eyes and relax', 'Visualize the concept as a scene or image', 'Add details: colors, shapes, movement', 'Interact with the visualization mentally', 'Recall the image to remember the concept']),

('sutra_learning', 'Sutra Learning', 'सूत्र शिक्षा', 'ancient',
 'Condense complex ideas into short, memorable phrases or sutras — the ancient Indian art of compression.',
 ARRAY['reading', 'auditory'], ARRAY['all'], ARRAY['remember', 'understand'],
 '📿', ARRAY['Study the full concept', 'Extract the core essence', 'Compress into a short phrase', 'Create a mnemonic or rhythm', 'Use the sutra as a key to unlock the full concept']),

-- SCIENTIFIC METHODS
('active_recall', 'Active Recall', 'सक्रिय स्मरण', 'scientific',
 'Test yourself repeatedly without looking at your notes. Forcing your brain to retrieve information strengthens memory.',
 ARRAY['reading', 'kinesthetic'], ARRAY['all'], ARRAY['remember', 'understand'],
 '🧪', ARRAY['Study the material once', 'Close your notes', 'Try to recall everything from memory', 'Check what you missed', 'Focus on weak areas and repeat']),

('spaced_rep', 'Spaced Repetition', 'अंतराल पुनरावृत्ति', 'scientific',
 'Review material at increasing intervals. Each successful recall extends the next review interval.',
 ARRAY['reading'], ARRAY['all'], ARRAY['remember'],
 '📅', ARRAY['Study new material', 'Review after 1 day', 'Review after 3 days', 'Review after 7 days', 'Review after 14, 30, 60 days...']),

('interleaving', 'Interleaving', 'अंतर्विन्यास', 'scientific',
 'Mix different topics or problem types during a single study session instead of focusing on just one.',
 ARRAY['kinesthetic'], ARRAY['math', 'science'], ARRAY['apply', 'analyze'],
 '🔀', ARRAY['Select 3-4 related topics', 'Alternate between them during study', 'Practice mixed problem sets', 'Compare and contrast approaches', 'Build flexibility in applying concepts']),

('elaborative_interrogation', 'Elaborative Interrogation', 'विस्तृत पूछताछ', 'scientific',
 'Ask "why" and "how" questions about every fact you learn. Connecting facts to reasons makes them memorable.',
 ARRAY['auditory', 'reading'], ARRAY['science', 'social_science'], ARRAY['understand', 'analyze'],
 '🔍', ARRAY['Read a fact or statement', 'Ask "Why is this true?"', 'Ask "How does this work?"', 'Connect to what you already know', 'Generate your own explanations']),

('dual_coding', 'Dual Coding', 'दोहरा संकेतन', 'scientific',
 'Combine verbal and visual information. Draw diagrams alongside text to create two memory pathways.',
 ARRAY['visual', 'reading'], ARRAY['all'], ARRAY['understand', 'remember'],
 '📊', ARRAY['Read the text explanation', 'Create a visual representation', 'Label the diagram with key terms', 'Explain the diagram in words', 'Use both to study and recall']),

('chunking', 'Chunking', 'खंडन', 'scientific',
 'Break large amounts of information into smaller, meaningful groups. Your brain can hold 4-7 chunks at a time.',
 ARRAY['reading', 'visual'], ARRAY['all'], ARRAY['remember'],
 '🧩', ARRAY['Take the full information set', 'Group related items together', 'Label each group', 'Create connections between groups', 'Study group by group']);

-- ============================================================================
-- NEW ACHIEVEMENTS for upgraded features
-- ============================================================================

INSERT INTO public.achievements (code, name, description, icon, xp_reward, criteria) VALUES
('method_explorer', 'Method Explorer', 'Try 5 different teaching methods', '🗺️', 100, '{"type": "methods_tried", "value": 5}'),
('guru_seeker', 'Guru Seeker', 'Complete 10 AI Guru sessions', '🧙', 150, '{"type": "guru_sessions", "value": 10}'),
('character_builder', 'Character Builder', 'Improve 3 character traits by 20+ points', '💎', 200, '{"type": "character_improved", "value": 3}'),
('game_master', 'Game Master', 'Complete 20 interactive activities', '🎮', 150, '{"type": "activities_completed", "value": 20}'),
('challenge_champion', 'Challenge Champion', 'Win 3 challenges', '🏆', 250, '{"type": "challenges_won", "value": 3}'),
('learning_dna_complete', 'Learning DNA Complete', 'Finish all assessments (VARK, Kolb, MI, Aptitude)', '🧬', 300, '{"type": "assessments_complete", "value": 4}'),
('curiosity_cat', 'Curiosity Cat', 'Explore 5 beyond-curriculum topics', '🐱', 100, '{"type": "beyond_curriculum", "value": 5}'),
('ancient_wisdom', 'Ancient Wisdom', 'Use 3 ancient learning methods', '📿', 100, '{"type": "ancient_methods", "value": 3}'),
('puzzle_master', 'Puzzle Master', 'Solve 15 puzzles with 80%+ score', '🧩', 150, '{"type": "puzzles_solved", "value": 15}'),
('speed_demon', 'Speed Demon', 'Complete 5 timed challenges under the time limit', '⚡', 200, '{"type": "speed_challenges", "value": 5}')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- UPDATE TRIGGERS for new tables with updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_character_traits_updated_at BEFORE UPDATE ON public.character_traits
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_character_goals_updated_at BEFORE UPDATE ON public.character_goals
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_student_teaching_methods_updated_at BEFORE UPDATE ON public.student_teaching_methods
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subject_aptitude_updated_at BEFORE UPDATE ON public.subject_aptitude
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_learning_dna_updated_at BEFORE UPDATE ON public.learning_dna
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
