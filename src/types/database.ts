export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          avatar_url: string | null;
          role: 'student' | 'teacher' | 'parent' | 'admin';
          current_class: number;
          school_name: string | null;
          preferred_language: 'english' | 'hindi' | 'bilingual';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          avatar_url?: string | null;
          role?: 'student' | 'teacher' | 'parent' | 'admin';
          current_class?: number;
          school_name?: string | null;
          preferred_language?: 'english' | 'hindi' | 'bilingual';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          avatar_url?: string | null;
          role?: 'student' | 'teacher' | 'parent' | 'admin';
          current_class?: number;
          school_name?: string | null;
          preferred_language?: 'english' | 'hindi' | 'bilingual';
          created_at?: string;
          updated_at?: string;
        };
      };
      learning_styles: {
        Row: {
          id: string;
          user_id: string;
          visual: number;
          auditory: number;
          reading: number;
          kinesthetic: number;
          primary_style: 'visual' | 'auditory' | 'reading' | 'kinesthetic';
          assessed_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          visual: number;
          auditory: number;
          reading: number;
          kinesthetic: number;
          primary_style: 'visual' | 'auditory' | 'reading' | 'kinesthetic';
          assessed_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          visual?: number;
          auditory?: number;
          reading?: number;
          kinesthetic?: number;
          primary_style?: 'visual' | 'auditory' | 'reading' | 'kinesthetic';
          assessed_at?: string;
        };
      };
      multiple_intelligences: {
        Row: {
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
        };
        Insert: {
          id?: string;
          user_id: string;
          logical_mathematical: number;
          linguistic: number;
          spatial: number;
          musical: number;
          bodily_kinesthetic: number;
          interpersonal: number;
          intrapersonal: number;
          naturalistic: number;
          assessed_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          logical_mathematical?: number;
          linguistic?: number;
          spatial?: number;
          musical?: number;
          bodily_kinesthetic?: number;
          interpersonal?: number;
          intrapersonal?: number;
          naturalistic?: number;
          assessed_at?: string;
        };
      };
      classes: {
        Row: {
          id: string;
          class_number: number;
          display_name: string;
          display_name_hindi: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          class_number: number;
          display_name: string;
          display_name_hindi: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          class_number?: number;
          display_name?: string;
          display_name_hindi?: string;
          created_at?: string;
        };
      };
      subjects: {
        Row: {
          id: string;
          class_id: string;
          name: string;
          name_hindi: string;
          code: string;
          icon: string;
          color: string;
          book_title: string;
          book_code: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          name: string;
          name_hindi: string;
          code: string;
          icon: string;
          color: string;
          book_title: string;
          book_code: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          class_id?: string;
          name?: string;
          name_hindi?: string;
          code?: string;
          icon?: string;
          color?: string;
          book_title?: string;
          book_code?: string;
          created_at?: string;
        };
      };
      chapters: {
        Row: {
          id: string;
          subject_id: string;
          chapter_number: number;
          title: string;
          title_hindi: string;
          pdf_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          subject_id: string;
          chapter_number: number;
          title: string;
          title_hindi: string;
          pdf_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          subject_id?: string;
          chapter_number?: number;
          title?: string;
          title_hindi?: string;
          pdf_url?: string | null;
          created_at?: string;
        };
      };
      topics: {
        Row: {
          id: string;
          chapter_id: string;
          topic_number: number;
          title: string;
          title_hindi: string;
          content: string | null;
          content_hindi: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          chapter_id: string;
          topic_number: number;
          title: string;
          title_hindi: string;
          content?: string | null;
          content_hindi?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          chapter_id?: string;
          topic_number?: number;
          title?: string;
          title_hindi?: string;
          content?: string | null;
          content_hindi?: string | null;
          created_at?: string;
        };
      };
      questions: {
        Row: {
          id: string;
          topic_id: string;
          question_type: 'mcq' | 'fill_blank' | 'true_false' | 'short_answer' | 'long_answer' | 'match' | 'assertion_reason';
          bloom_level: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
          difficulty: 'easy' | 'medium' | 'hard';
          question_text: string;
          question_text_hindi: string;
          options: string[] | null;
          options_hindi: string[] | null;
          correct_answer: string;
          correct_answer_hindi: string | null;
          explanation: string;
          explanation_hindi: string;
          hints: string[] | null;
          marks: number;
          time_limit_seconds: number | null;
          tags: string[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          topic_id: string;
          question_type: 'mcq' | 'fill_blank' | 'true_false' | 'short_answer' | 'long_answer' | 'match' | 'assertion_reason';
          bloom_level: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
          difficulty: 'easy' | 'medium' | 'hard';
          question_text: string;
          question_text_hindi: string;
          options?: string[] | null;
          options_hindi?: string[] | null;
          correct_answer: string;
          correct_answer_hindi?: string | null;
          explanation: string;
          explanation_hindi: string;
          hints?: string[] | null;
          marks?: number;
          time_limit_seconds?: number | null;
          tags?: string[] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          topic_id?: string;
          question_type?: 'mcq' | 'fill_blank' | 'true_false' | 'short_answer' | 'long_answer' | 'match' | 'assertion_reason';
          bloom_level?: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
          difficulty?: 'easy' | 'medium' | 'hard';
          question_text?: string;
          question_text_hindi?: string;
          options?: string[] | null;
          options_hindi?: string[] | null;
          correct_answer?: string;
          correct_answer_hindi?: string | null;
          explanation?: string;
          explanation_hindi?: string;
          hints?: string[] | null;
          marks?: number;
          time_limit_seconds?: number | null;
          tags?: string[] | null;
          created_at?: string;
        };
      };
      user_stats: {
        Row: {
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
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          total_xp?: number;
          current_level?: number;
          current_streak?: number;
          longest_streak?: number;
          total_time_spent_minutes?: number;
          total_questions_attempted?: number;
          total_questions_correct?: number;
          last_active_date?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          total_xp?: number;
          current_level?: number;
          current_streak?: number;
          longest_streak?: number;
          total_time_spent_minutes?: number;
          total_questions_attempted?: number;
          total_questions_correct?: number;
          last_active_date?: string;
          updated_at?: string;
        };
      };
      user_topic_progress: {
        Row: {
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
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          topic_id: string;
          status?: 'not_started' | 'in_progress' | 'completed' | 'mastered';
          progress_percentage?: number;
          time_spent_minutes?: number;
          questions_attempted?: number;
          questions_correct?: number;
          mastery_score?: number;
          last_accessed_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          topic_id?: string;
          status?: 'not_started' | 'in_progress' | 'completed' | 'mastered';
          progress_percentage?: number;
          time_spent_minutes?: number;
          questions_attempted?: number;
          questions_correct?: number;
          mastery_score?: number;
          last_accessed_at?: string;
          updated_at?: string;
        };
      };
      achievements: {
        Row: {
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
          created_at: string;
        };
        Insert: {
          id?: string;
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
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          name_hindi?: string;
          description?: string;
          description_hindi?: string;
          icon?: string;
          badge_color?: string;
          xp_reward?: number;
          criteria_type?: string;
          criteria_value?: number;
          category?: 'streak' | 'progress' | 'accuracy' | 'speed' | 'completion' | 'special';
          created_at?: string;
        };
      };
      user_achievements: {
        Row: {
          id: string;
          user_id: string;
          achievement_id: string;
          unlocked_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          achievement_id: string;
          unlocked_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          achievement_id?: string;
          unlocked_at?: string;
        };
      };
      chat_sessions: {
        Row: {
          id: string;
          user_id: string;
          topic_id: string | null;
          title: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          topic_id?: string | null;
          title: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          topic_id?: string | null;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      chat_messages: {
        Row: {
          id: string;
          session_id: string;
          role: 'user' | 'assistant';
          content: string;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          role: 'user' | 'assistant';
          content: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          role?: 'user' | 'assistant';
          content?: string;
          metadata?: Json | null;
          created_at?: string;
        };
      };
    };
    Views: {};
    Functions: {
      update_user_xp: {
        Args: { p_user_id: string; p_xp_amount: number };
        Returns: void;
      };
      update_user_streak: {
        Args: { p_user_id: string };
        Returns: void;
      };
    };
    Enums: {};
  };
}
