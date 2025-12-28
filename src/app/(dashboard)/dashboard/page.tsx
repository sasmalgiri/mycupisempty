'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { useCurriculum, useProgress } from '@/hooks';
import type { Profile, UserStats, LearningStyle } from '@/types';
import JoinClassroomModal from '@/components/JoinClassroomModal';

// Subject with progress for display
interface SubjectWithProgress {
  id: string;
  name: string;
  icon: string;
  color: string;
  progress: number;
  accuracy: number;
  chaptersCount?: number;
}

// Default icons and colors for subjects
const SUBJECT_ICONS: Record<string, string> = {
  'Mathematics': '📐',
  'Science': '🔬',
  'English': '📖',
  'Hindi': '📝',
  'Social Science': '🌍',
  'Physics': '⚛️',
  'Chemistry': '🧪',
  'Biology': '🧬',
  'Computer Science': '💻',
  'Economics': '📈',
  'History': '📜',
  'Geography': '🗺️',
};

const SUBJECT_COLORS: Record<string, string> = {
  'Mathematics': '#6366F1',
  'Science': '#8B5CF6',
  'English': '#EC4899',
  'Hindi': '#F97316',
  'Social Science': '#14B8A6',
  'Physics': '#3B82F6',
  'Chemistry': '#10B981',
  'Biology': '#22C55E',
  'Computer Science': '#6366F1',
  'Economics': '#EAB308',
  'History': '#A855F7',
  'Geography': '#14B8A6',
};

// Default subjects fallback
const DEFAULT_SUBJECTS: SubjectWithProgress[] = [
  { id: '1', name: 'Mathematics', icon: '📐', color: '#6366F1', progress: 0, accuracy: 0 },
  { id: '2', name: 'Science', icon: '🔬', color: '#8B5CF6', progress: 0, accuracy: 0 },
  { id: '3', name: 'English', icon: '📖', color: '#EC4899', progress: 0, accuracy: 0 },
  { id: '4', name: 'Hindi', icon: '📝', color: '#F97316', progress: 0, accuracy: 0 },
  { id: '5', name: 'Social Science', icon: '🌍', color: '#14B8A6', progress: 0, accuracy: 0 },
];

export default function DashboardPage() {
  const [user, setUser] = useState<Profile | null>(null);
  const [learningStyle, setLearningStyle] = useState<LearningStyle | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [enrolledClassrooms, setEnrolledClassrooms] = useState<{ id: string; name: string }[]>([]);

  // Get user's class level (default to 6)
  const classLevel = user?.current_class || 6;

  // Fetch curriculum and progress using hooks
  const { subjects: curriculumSubjects, loading: curriculumLoading } = useCurriculum(classLevel);
  const { progress, loading: progressLoading } = useProgress();

  // Combine curriculum with progress data
  const subjectsWithProgress = useMemo<SubjectWithProgress[]>(() => {
    if (!curriculumSubjects || curriculumSubjects.length === 0) {
      return DEFAULT_SUBJECTS;
    }

    return curriculumSubjects.map((subject) => {
      // Get progress for this subject
      const subjectProgress = progress?.subjectProgress?.[subject.id] || {
        completed: 0,
        total: 100,
        accuracy: 0
      };

      const progressPercent = subjectProgress.total > 0
        ? Math.round((subjectProgress.completed / subjectProgress.total) * 100)
        : 0;

      return {
        id: subject.id,
        name: subject.name,
        icon: subject.icon || SUBJECT_ICONS[subject.name] || '📚',
        color: subject.color || SUBJECT_COLORS[subject.name] || '#6366F1',
        progress: progressPercent,
        accuracy: subjectProgress.accuracy || 0,
        chaptersCount: subject.chapters?.length || 0,
      };
    });
  }, [curriculumSubjects, progress]);

  useEffect(() => {
    loadUserData();
  }, []);

  async function loadUserData() {
    try {
      const supabase = createBrowserClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (authUser) {
        // Load profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (profile) {
          setUser(profile as Profile);
        }

        // Load learning style
        const { data: style } = await supabase
          .from('learning_styles')
          .select('*')
          .eq('user_id', authUser.id)
          .single();

        if (style) {
          setLearningStyle(style as LearningStyle);
        }

        // Load stats
        const { data: userStats } = await supabase
          .from('user_stats')
          .select('*')
          .eq('user_id', authUser.id)
          .single();

        if (userStats) {
          setStats(userStats as UserStats);
        }

        // Load enrolled classrooms
        const { data: enrollments } = await (supabase
          .from('classroom_enrollments') as any)
          .select('classroom_id, classrooms(id, name)')
          .eq('student_id', authUser.id)
          .eq('status', 'active');

        if (enrollments) {
          const classroomsList = enrollments
            .map((e: any) => e.classrooms)
            .filter(Boolean);
          setEnrolledClassrooms(classroomsList);
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleJoinSuccess = () => {
    loadUserData(); // Refresh data after joining
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-50 to-secondary-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 animate-pulse">
            🧠
          </div>
          <p className="text-gray-500">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-50 to-secondary-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-primary-500/30">
                🧠
              </div>
              <span className="font-bold text-xl gradient-text">MyCupIsEmpty</span>
            </div>

            <nav className="hidden md:flex items-center gap-1">
              <Link href="/dashboard" className="px-4 py-2 rounded-lg bg-primary-100 text-primary-700 font-semibold">
                Dashboard
              </Link>
              <Link href="/subjects" className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 font-medium">
                Subjects
              </Link>
              <Link href="/progress" className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 font-medium">
                Progress
              </Link>
              <Link href="/achievements" className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 font-medium">
                Achievements
              </Link>
            </nav>

            <div className="flex items-center gap-4">
              <div className="xp-badge">
                <span>⭐</span>
                <span>{stats?.total_xp?.toLocaleString() || '0'}</span>
              </div>
              <div className="streak-badge">
                <span>🔥</span>
                <span>{stats?.current_streak || 0}</span>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-secondary-400 rounded-full flex items-center justify-center text-white font-bold cursor-pointer">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <section className="bg-gradient-to-r from-primary-500 via-primary-600 to-secondary-600 rounded-3xl p-8 text-white mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-2">
                {getGreeting()}, {user?.full_name?.split(' ')[0] || 'Student'}! 👋
              </h1>
              <p className="text-white/90">Ready to continue your learning journey?</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 text-center">
              <div className="text-sm opacity-90 mb-2">Today's Goal</div>
              <div className="relative w-24 h-24">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    fill="none"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="8"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    fill="none"
                    stroke="#FCD34D"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={251.2}
                    strokeDashoffset={251.2 * (1 - 0.65)}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold">65%</span>
                  <span className="text-xs opacity-90">complete</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Profile & Learning Style */}
          <div className="space-y-6">
            {/* Profile Card */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-primary-400 to-secondary-400 rounded-full flex items-center justify-center text-2xl text-white font-bold">
                  👩‍🎓
                </div>
                <div>
                  <h3 className="font-bold text-lg">{user?.full_name || 'Student'}</h3>
                  <p className="text-gray-500 text-sm">Class {user?.current_class || 6} • Level {stats?.current_level || 1}</p>
                </div>
              </div>

              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Your Learning Style (VARK)
              </h4>

              <div className="space-y-3">
                {[
                  { key: 'visual', icon: '👁️', label: 'Visual', value: learningStyle?.visual || 55 },
                  { key: 'kinesthetic', icon: '🖐️', label: 'Kinesthetic', value: learningStyle?.kinesthetic || 25 },
                  { key: 'auditory', icon: '👂', label: 'Auditory', value: learningStyle?.auditory || 12 },
                  { key: 'reading', icon: '📖', label: 'Reading', value: learningStyle?.reading || 8 },
                ].map((style) => (
                  <div key={style.key} className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
                      style.key === 'visual' ? 'bg-blue-100' :
                      style.key === 'kinesthetic' ? 'bg-red-100' :
                      style.key === 'auditory' ? 'bg-green-100' : 'bg-yellow-100'
                    }`}>
                      {style.icon}
                    </div>
                    <span className="w-24 font-medium text-sm">{style.label}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          style.key === 'visual' ? 'bg-blue-500' :
                          style.key === 'kinesthetic' ? 'bg-red-500' :
                          style.key === 'auditory' ? 'bg-green-500' : 'bg-yellow-500'
                        }`}
                        style={{ width: `${style.value}%` }}
                      />
                    </div>
                    <span className="w-12 text-right font-bold text-sm">{style.value}%</span>
                  </div>
                ))}
              </div>

              <Link
                href="/assessment"
                className="w-full mt-6 py-3 bg-primary-100 text-primary-700 rounded-xl font-semibold text-center block hover:bg-primary-200 transition-colors"
              >
                🔄 Retake Assessment
              </Link>
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h4 className="font-bold mb-4">📊 Your Stats</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-primary-600">{stats?.total_questions_attempted || 0}</div>
                  <div className="text-xs text-gray-500">Questions</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {stats?.total_questions_attempted
                      ? Math.round((stats.total_questions_correct / stats.total_questions_attempted) * 100)
                      : 0}%
                  </div>
                  <div className="text-xs text-gray-500">Accuracy</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-orange-600">{stats?.current_streak || 0}</div>
                  <div className="text-xs text-gray-500">Day Streak</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-purple-600">{stats?.total_time_spent_minutes || 0}m</div>
                  <div className="text-xs text-gray-500">Study Time</div>
                </div>
              </div>
            </div>

            {/* Classrooms */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold">🏫 My Classrooms</h4>
                <button
                  type="button"
                  onClick={() => setShowJoinModal(true)}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  + Join
                </button>
              </div>
              {enrolledClassrooms.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-gray-500 text-sm mb-3">Not enrolled in any classroom yet</p>
                  <button
                    type="button"
                    onClick={() => setShowJoinModal(true)}
                    className="px-4 py-2 bg-primary-100 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-200 transition-colors"
                  >
                    Join a Classroom
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {enrolledClassrooms.map(classroom => (
                    <div
                      key={classroom.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center text-primary-600 font-bold text-sm">
                        🏫
                      </div>
                      <span className="font-medium text-gray-900 text-sm">{classroom.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Subjects */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">📚 Your Subjects</h2>
              <Link href="/subjects" className="text-primary-600 hover:text-primary-700 font-semibold text-sm">
                View All →
              </Link>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {subjectsWithProgress.map((subject) => (
                <Link
                  key={subject.id}
                  href={`/subjects/${subject.id}`}
                  className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-lg hover:-translate-y-1 transition-all relative overflow-hidden group"
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{ backgroundColor: subject.color }}
                  />
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
                      style={{ backgroundColor: `${subject.color}20` }}
                    >
                      {subject.icon}
                    </div>
                    <span
                      className="px-3 py-1 rounded-full text-xs font-bold"
                      style={{ backgroundColor: `${subject.color}20`, color: subject.color }}
                    >
                      Class {user?.current_class || 6}
                    </span>
                  </div>
                  <h3 className="font-bold text-lg mb-1">{subject.name}</h3>
                  <p className="text-gray-500 text-sm mb-4">12 chapters • Semester 2</p>
                  <div className="mb-2">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${subject.progress}%`, backgroundColor: subject.color }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">
                      <strong className="text-gray-700">{subject.progress}%</strong> complete
                    </span>
                    <span className="text-gray-500">
                      <strong className="text-gray-700">{subject.accuracy}%</strong> accuracy
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Learning Methods */}
            <div className="mt-8 bg-white rounded-2xl shadow-sm p-6">
              <h3 className="font-bold mb-4">🎯 Learning Methods We Use</h3>
              <div className="grid grid-cols-5 gap-3">
                {[
                  { icon: '📊', name: 'VARK', desc: 'Learning Styles' },
                  { icon: '🧠', name: 'Multiple Intel.', desc: "Gardner's 8 Types" },
                  { icon: '🔺', name: "Bloom's", desc: '6 Thinking Levels' },
                  { icon: '🔄', name: "Kolb's Cycle", desc: 'Learn by Doing' },
                  { icon: '📅', name: 'Spaced Rep.', desc: 'Optimal Review' },
                ].map((method) => (
                  <div
                    key={method.name}
                    className="text-center p-3 bg-gray-50 rounded-xl hover:bg-primary-50 transition-colors cursor-pointer"
                  >
                    <div className="text-2xl mb-1">{method.icon}</div>
                    <div className="font-semibold text-xs">{method.name}</div>
                    <div className="text-xs text-gray-500">{method.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Join Classroom Modal */}
      <JoinClassroomModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onSuccess={handleJoinSuccess}
      />
    </div>
  );
}
