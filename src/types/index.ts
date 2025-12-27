// User & Authentication Types
export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  role: 'student' | 'teacher' | 'parent' | 'admin';
  current_class: number;
  school_name?: string;
  preferred_language: 'english' | 'hindi' | 'bilingual';
  created_at: string;
  updated_at: string;
}

export interface Profile extends User {
  learning_style?: LearningStyle;
  intelligences?: MultipleIntelligences;
  stats?: UserStats;
}

// Learning Style Types (VARK)
export interface LearningStyle {
  id: string;
  user_id: string;
  visual: number;
  auditory: number;
  reading: number;
  kinesthetic: number;
  primary_style: 'visual' | 'auditory' | 'reading' | 'kinesthetic';
  assessed_at: string;
}

export type VARKStyle = 'visual' | 'auditory' | 'reading' | 'kinesthetic';

// Multiple Intelligences (Howard Gardner)
export interface MultipleIntelligences {
  id: string;
  user_id: string;
  logical_mathematical: number;
  linguistic: number;
  spatial: number;
  musical: number;
  bodily_kinesthetic: number;
  interpersonal: number;
  intrapersonal: number;
  naturalistic: number;
  assessed_at: string;
}

export type IntelligenceType = 
  | 'logical_mathematical'
  | 'linguistic'
  | 'spatial'
  | 'musical'
  | 'bodily_kinesthetic'
  | 'interpersonal'
  | 'intrapersonal'
  | 'naturalistic';

// Curriculum Types
export interface Class {
  id: string;
  class_number: number;
  display_name: string;
  display_name_hindi: string;
}

export interface Subject {
  id: string;
  class_id: string;
  name: string;
  name_hindi: string;
  code: string;
  icon: string;
  color: string;
  book_title: string;
  book_code: string;
  chapters_count?: number;
}

export interface Chapter {
  id: string;
  subject_id: string;
  chapter_number: number;
  title: string;
  title_hindi: string;
  pdf_url?: string;
  topics_count?: number;
  progress?: number;
}

export interface Topic {
  id: string;
  chapter_id: string;
  topic_number: number;
  title: string;
  title_hindi: string;
  content?: string;
  content_hindi?: string;
}

// Learning Content Types
export interface LearningContent {
  id: string;
  topic_id: string;
  content_type: VARKStyle;
  title: string;
  content: string;
  media_url?: string;
  metadata?: Record<string, any>;
}

export interface Definition {
  id: string;
  topic_id: string;
  term: string;
  term_hindi: string;
  definition: string;
  definition_hindi: string;
  example?: string;
}

export interface Formula {
  id: string;
  topic_id: string;
  name: string;
  name_hindi: string;
  formula_latex: string;
  description: string;
  description_hindi: string;
  example?: string;
}

// Question & Quiz Types
export type QuestionType = 
  | 'mcq'
  | 'fill_blank'
  | 'true_false'
  | 'short_answer'
  | 'long_answer'
  | 'match'
  | 'assertion_reason';

export type BloomLevel = 
  | 'remember'
  | 'understand'
  | 'apply'
  | 'analyze'
  | 'evaluate'
  | 'create';

export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface Question {
  id: string;
  topic_id: string;
  question_type: QuestionType;
  bloom_level: BloomLevel;
  difficulty: DifficultyLevel;
  question_text: string;
  question_text_hindi: string;
  options?: string[];
  options_hindi?: string[];
  correct_answer: string;
  correct_answer_hindi?: string;
  explanation: string;
  explanation_hindi: string;
  hints?: string[];
  marks: number;
  time_limit_seconds?: number;
  tags?: string[];
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  quiz_type: 'practice' | 'assessment' | 'daily_challenge';
  chapter_id?: string;
  topic_id?: string;
  total_questions: number;
  total_marks: number;
  time_limit_minutes?: number;
  passing_percentage: number;
  is_active: boolean;
  questions?: Question[];
}

export interface QuizAttempt {
  id: string;
  user_id: string;
  quiz_id: string;
  started_at: string;
  completed_at?: string;
  score: number;
  total_marks: number;
  percentage: number;
  time_taken_seconds: number;
  answers: UserAnswer[];
}

export interface UserAnswer {
  id: string;
  attempt_id: string;
  question_id: string;
  user_answer: string;
  is_correct: boolean;
  marks_obtained: number;
  time_taken_seconds: number;
}

// Progress & Analytics Types
export interface TopicProgress {
  id: string;
  user_id: string;
  topic_id: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'mastered';
  progress_percentage: number;
  time_spent_minutes: number;
  questions_attempted: number;
  questions_correct: number;
  mastery_score: number;
  last_accessed_at: string;
}

export interface UserStats {
  id: string;
  user_id: string;
  total_xp: number;
  current_level: number;
  current_streak: number;
  longest_streak: number;
  total_time_spent_minutes: number;
  total_questions_attempted: number;
  total_questions_correct: number;
  last_active_date: string;
}

export interface DailyGoal {
  id: string;
  user_id: string;
  goal_date: string;
  target_questions: number;
  completed_questions: number;
  target_time_minutes: number;
  completed_time_minutes: number;
  target_xp: number;
  earned_xp: number;
  is_completed: boolean;
}

// Achievement Types
export interface Achievement {
  id: string;
  name: string;
  name_hindi: string;
  description: string;
  description_hindi: string;
  icon: string;
  badge_color: string;
  xp_reward: number;
  criteria_type: string;
  criteria_value: number;
  category: 'streak' | 'progress' | 'accuracy' | 'speed' | 'completion' | 'special';
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
  achievement?: Achievement;
}

// AI Chat Types
export interface ChatSession {
  id: string;
  user_id: string;
  topic_id?: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages?: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: {
    learning_style?: VARKStyle;
    topic_context?: string;
    question_id?: string;
  };
  created_at: string;
}

// Flashcard Types (Spaced Repetition)
export interface Flashcard {
  id: string;
  topic_id: string;
  front_text: string;
  front_text_hindi: string;
  back_text: string;
  back_text_hindi: string;
  difficulty: DifficultyLevel;
}

export interface FlashcardProgress {
  id: string;
  user_id: string;
  flashcard_id: string;
  easiness_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_date: string;
  last_quality: number;
}

// API Response Types
export interface ApiResponse<T> {
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
  success: boolean;
}

// Assessment Types
export interface VARKAssessmentQuestion {
  id: number;
  question: string;
  options: {
    visual: string;
    auditory: string;
    reading: string;
    kinesthetic: string;
  };
}

export interface VARKAssessmentResult {
  visual: number;
  auditory: number;
  reading: number;
  kinesthetic: number;
  primary_style: VARKStyle;
}

// Dashboard Types
export interface DashboardData {
  user: Profile;
  today_goal: DailyGoal;
  recent_progress: TopicProgress[];
  subjects: SubjectWithProgress[];
  achievements: UserAchievement[];
  streak_info: {
    current: number;
    longest: number;
  };
}

export interface SubjectWithProgress extends Subject {
  progress_percentage: number;
  chapters: ChapterWithProgress[];
}

export interface ChapterWithProgress extends Chapter {
  progress_percentage: number;
  is_locked: boolean;
}

// Ollama AI Types
export interface OllamaRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  context?: number[];
  options?: {
    temperature?: number;
    top_p?: number;
    num_predict?: number;
  };
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_duration?: number;
  eval_duration?: number;
}

// Curriculum Data Types (for scraper)
export interface NCERTCurriculum {
  classes: NCERTClass[];
}

export interface NCERTClass {
  classNumber: number;
  subjects: NCERTSubject[];
}

export interface NCERTSubject {
  name: string;
  nameHindi: string;
  code: string;
  icon: string;
  color: string;
  bookTitle: string;
  bookCode: string;
  chapters: NCERTChapter[];
}

export interface NCERTChapter {
  chapterNumber: number;
  title: string;
  titleHindi?: string;
  pdfUrl?: string;
  topics: NCERTTopic[];
}

export interface NCERTTopic {
  topicNumber: number;
  title: string;
  titleHindi?: string;
}
