// =====================================================
// Teacher Management Types
// =====================================================

// Classroom Types
export interface Classroom {
  id: string;
  teacher_id: string;
  name: string;
  description?: string;
  class_level: number;
  subject_id?: string;
  invite_code: string;
  invite_code_expires_at?: string;
  max_students: number;
  is_active: boolean;
  settings: ClassroomSettings;
  created_at: string;
  updated_at: string;
  // Computed fields
  student_count?: number;
  active_assignments?: number;
  pending_submissions?: number;
}

export interface ClassroomSettings {
  allow_self_enrollment?: boolean;
  show_leaderboard?: boolean;
  notifications_enabled?: boolean;
}

export interface ClassroomEnrollment {
  id: string;
  classroom_id: string;
  student_id: string;
  status: 'pending' | 'active' | 'removed' | 'left';
  joined_at: string;
  removed_at?: string;
  // Relations
  student?: StudentProfile;
  classroom?: Classroom;
}

// Student Types (for teacher view)
export interface StudentProfile {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  current_class: number;
  school_name?: string;
  learning_style?: StudentLearningStyle;
  stats?: StudentStats;
  progress?: StudentProgress;
}

export interface StudentLearningStyle {
  id: string;
  user_id: string;
  visual_score: number;
  auditory_score: number;
  reading_score: number;
  kinesthetic_score: number;
  dominant_style: 'visual' | 'auditory' | 'reading' | 'kinesthetic';
  assessment_date: string;
}

export interface StudentStats {
  id: string;
  user_id: string;
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  level: number;
  total_questions_answered: number;
  correct_answers: number;
  total_time_spent_minutes: number;
  last_activity_date?: string;
}

export interface StudentProgress {
  topics_completed: number;
  topics_in_progress: number;
  topics_total: number;
  overall_mastery: number;
  accuracy_percentage: number;
  weak_topics: WeakTopic[];
  strong_topics: StrongTopic[];
}

export interface WeakTopic {
  topic_id: string;
  topic_name: string;
  chapter_name: string;
  subject_name: string;
  mastery_score: number;
  accuracy: number;
  attempts: number;
}

export interface StrongTopic {
  topic_id: string;
  topic_name: string;
  chapter_name: string;
  mastery_score: number;
}

// Assignment Types
export interface Assignment {
  id: string;
  classroom_id: string;
  teacher_id: string;
  title: string;
  description?: string;
  assignment_type: 'quiz' | 'homework' | 'practice' | 'test';
  chapter_id?: string;
  topic_ids?: string[];
  quiz_id?: string;
  total_marks: number;
  passing_marks: number;
  due_date?: string;
  available_from: string;
  time_limit_minutes?: number;
  allow_late_submission: boolean;
  max_attempts: number;
  shuffle_questions: boolean;
  show_answers_after_submission: boolean;
  status: 'draft' | 'published' | 'closed' | 'archived';
  created_at: string;
  updated_at: string;
  // Computed fields
  submissions_count?: number;
  graded_count?: number;
  average_score?: number;
  completion_rate?: number;
  // Relations
  classroom?: Classroom;
  chapter?: {
    id: string;
    title: string;
    chapter_number: number;
  };
}

export interface AssignmentSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  quiz_attempt_id?: string;
  status: 'not_started' | 'in_progress' | 'submitted' | 'graded' | 'returned';
  score?: number;
  total_marks?: number;
  percentage?: number;
  time_taken_minutes?: number;
  submitted_at?: string;
  graded_at?: string;
  graded_by?: string;
  teacher_feedback?: string;
  is_late: boolean;
  attempt_number: number;
  created_at: string;
  updated_at: string;
  // Relations
  student?: StudentProfile;
  assignment?: Assignment;
}

// Teacher Notes
export interface TeacherStudentNote {
  id: string;
  teacher_id: string;
  student_id: string;
  classroom_id?: string;
  note_type: 'general' | 'strength' | 'weakness' | 'recommendation' | 'parent_communication';
  content: string;
  is_private: boolean;
  created_at: string;
  updated_at: string;
}

// Progress Reports
export interface ProgressReport {
  id: string;
  teacher_id: string;
  student_id: string;
  classroom_id?: string;
  report_period_start: string;
  report_period_end: string;
  overall_grade?: string;
  overall_percentage?: number;
  strengths: string[];
  areas_for_improvement: string[];
  teacher_comments?: string;
  vark_insights: VARKInsights;
  subject_performance: SubjectPerformance[];
  recommendations?: string;
  is_shared_with_parent: boolean;
  shared_at?: string;
  created_at: string;
  // Relations
  student?: StudentProfile;
}

export interface VARKInsights {
  primary_style: 'visual' | 'auditory' | 'reading' | 'kinesthetic';
  style_breakdown: {
    visual: number;
    auditory: number;
    reading: number;
    kinesthetic: number;
  };
  learning_recommendations: string[];
}

export interface SubjectPerformance {
  subject_id: string;
  subject_name: string;
  grade: string;
  percentage: number;
  improvement_trend: 'improving' | 'stable' | 'declining';
  topics_mastered: number;
  topics_total: number;
}

// Dashboard Types
export interface TeacherDashboardData {
  overview: TeacherOverview;
  recent_activity: RecentActivity[];
  classrooms: ClassroomSummary[];
  upcoming_deadlines: Assignment[];
  students_needing_attention: StudentAlert[];
}

export interface TeacherOverview {
  total_students: number;
  total_classrooms: number;
  active_assignments: number;
  pending_submissions: number;
  average_class_performance: number;
}

export interface ClassroomSummary {
  id: string;
  name: string;
  class_level: number;
  subject_name?: string;
  student_count: number;
  average_progress: number;
  average_performance: number;
  recent_activity_count: number;
  pending_submissions: number;
}

export interface StudentAlert {
  student_id: string;
  student_name: string;
  avatar_url?: string;
  classroom_id: string;
  classroom_name: string;
  alert_type: 'low_activity' | 'struggling' | 'dropping_performance' | 'missed_deadline';
  message: string;
  severity: 'low' | 'medium' | 'high';
  created_at: string;
}

export interface RecentActivity {
  id: string;
  type: 'submission' | 'enrollment' | 'assignment_created' | 'grade_given' | 'student_joined';
  message: string;
  timestamp: string;
  related_id: string;
  actor_name?: string;
  actor_avatar?: string;
}

// Analytics Types
export interface ClassAnalytics {
  classroom_id: string;
  classroom_name: string;
  period: 'week' | 'month' | 'all_time';
  vark_distribution: VARKDistribution;
  performance_trends: PerformanceTrend[];
  topic_mastery: TopicMastery[];
  student_ranking: StudentRanking[];
  bloom_distribution: BloomDistribution;
  engagement_metrics: EngagementMetrics;
}

export interface VARKDistribution {
  visual: number;
  auditory: number;
  reading: number;
  kinesthetic: number;
  dominant_counts: {
    visual: number;
    auditory: number;
    reading: number;
    kinesthetic: number;
  };
  total_students: number;
}

export interface PerformanceTrend {
  date: string;
  average_score: number;
  participation_rate: number;
  submissions_count: number;
}

export interface TopicMastery {
  topic_id: string;
  topic_name: string;
  chapter_id: string;
  chapter_name: string;
  average_mastery: number;
  students_struggling: number;
  students_mastered: number;
  total_students: number;
}

export interface StudentRanking {
  rank: number;
  student_id: string;
  student_name: string;
  avatar_url?: string;
  xp: number;
  accuracy: number;
  topics_completed: number;
  current_streak: number;
}

export interface BloomDistribution {
  remember: number;
  understand: number;
  apply: number;
  analyze: number;
  evaluate: number;
  create: number;
}

export interface EngagementMetrics {
  average_time_per_session: number;
  average_questions_per_day: number;
  active_students_today: number;
  active_students_week: number;
  completion_rate: number;
}

// Form Types for Creating/Editing
export interface CreateClassroomInput {
  name: string;
  description?: string;
  class_level: number;
  subject_id?: string;
  max_students?: number;
  settings?: Partial<ClassroomSettings>;
}

export interface UpdateClassroomInput extends Partial<CreateClassroomInput> {
  is_active?: boolean;
}

export interface CreateAssignmentInput {
  classroom_id: string;
  title: string;
  description?: string;
  assignment_type: 'quiz' | 'homework' | 'practice' | 'test';
  chapter_id?: string;
  topic_ids?: string[];
  quiz_id?: string;
  total_marks?: number;
  passing_marks?: number;
  due_date?: string;
  available_from?: string;
  time_limit_minutes?: number;
  allow_late_submission?: boolean;
  max_attempts?: number;
  shuffle_questions?: boolean;
  show_answers_after_submission?: boolean;
}

export interface GradeSubmissionInput {
  submission_id: string;
  score: number;
  teacher_feedback?: string;
}

export interface CreateNoteInput {
  student_id: string;
  classroom_id?: string;
  note_type: TeacherStudentNote['note_type'];
  content: string;
  is_private?: boolean;
}

export interface GenerateReportInput {
  student_id: string;
  classroom_id?: string;
  report_period_start: string;
  report_period_end: string;
  include_vark_insights?: boolean;
  include_subject_breakdown?: boolean;
}

// API Response Types
export interface TeacherApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// Filter/Query Types
export interface ClassroomFilters {
  class_level?: number;
  subject_id?: string;
  is_active?: boolean;
  search?: string;
}

export interface StudentFilters {
  classroom_id?: string;
  learning_style?: 'visual' | 'auditory' | 'reading' | 'kinesthetic';
  performance?: 'struggling' | 'average' | 'excelling';
  search?: string;
}

export interface AssignmentFilters {
  classroom_id?: string;
  status?: Assignment['status'];
  assignment_type?: Assignment['assignment_type'];
  due_before?: string;
  due_after?: string;
}

export interface SubmissionFilters {
  assignment_id?: string;
  status?: AssignmentSubmission['status'];
  is_late?: boolean;
}
