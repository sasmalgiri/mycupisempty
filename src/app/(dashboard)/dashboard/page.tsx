'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { useCurriculum, useProgress } from '@/hooks';
import type { Profile, UserStats, LearningStyle } from '@/types';
import JoinClassroomModal from '@/components/JoinClassroomModal';
import DailyBriefing from '@/components/DailyBriefing';
import CharacterGrowthCard from '@/components/CharacterGrowthCard';
import FirstSessionCard from '@/components/FirstSessionCard';
import NextStepGuide from '@/components/NextStepGuide';
import DailyWonderCard from '@/components/DailyWonderCard';
import TodaysPlanBanner from '@/components/TodaysPlanBanner';

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
  // Student intelligence — the real picture
  const [studentIntel, setStudentIntel] = useState<any>(null);
  // Mastery — true mastery states, not fake % complete
  const [mastery, setMastery] = useState<any>(null);
  // Method calibration — what method works for this student × subject
  const [calibration, setCalibration] = useState<any>(null);

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

        // Load student intelligence — the real picture of this student
        fetch('/api/student-state')
          .then(r => r.json())
          .then(d => { if (d.success) setStudentIntel(d.data?.summary); })
          .catch(() => {});

        // Load true mastery map — NOT fake % complete
        fetch('/api/mastery')
          .then(r => r.json())
          .then(d => { if (d.success) setMastery(d); })
          .catch(() => {});

        // Load per-subject method calibration — observed, not self-reported
        fetch('/api/method-calibration')
          .then(r => r.json())
          .then(d => { if (d.success) setCalibration(d); })
          .catch(() => {});

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
        {/* First-session card — only appears for brand-new students */}
        <FirstSessionCard />

        {/* Today's plan slice — only renders when student is enrolled in a course */}
        <TodaysPlanBanner />

        {/* Context-aware next-step guide — proactive "what to do now" */}
        <div className="mb-6">
          <NextStepGuide context="dashboard" />
        </div>

        {/* Daily Wonder — curiosity gateway, deterministic per user per day */}
        <DailyWonderCard />

        {/* Daily Briefing — companions speak first */}
        <DailyBriefing />

        {/* Character Growth — the quiet thread that matters most */}
        <div className="mb-6">
          <CharacterGrowthCard />
        </div>

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
                  <p className="text-gray-500 text-sm">Class {user?.current_class || 6} • Level {stats?.level || 1}</p>
                </div>
              </div>

              {/* Student Intelligence — real state, not a label */}
              {studentIntel ? (
                <>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    How You&apos;re Doing Right Now
                  </h4>

                  {/* Mood + Energy + Confidence */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <span className="text-xl block">
                        {studentIntel.mood === 'energetic' ? '😊' : studentIntel.mood === 'frustrated' ? '😤' : studentIntel.mood === 'confused' ? '😵' : studentIntel.mood === 'bored' ? '🥱' : '🙂'}
                      </span>
                      <span className="text-xs text-gray-500 capitalize">{studentIntel.mood}</span>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <span className="text-xl block">
                        {studentIntel.energy === 'high' ? '🔥' : studentIntel.energy === 'low' ? '😴' : '⚡'}
                      </span>
                      <span className="text-xs text-gray-500">{studentIntel.energy} energy</span>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <span className="text-xl font-bold block text-primary-600">{studentIntel.confidence}/10</span>
                      <span className="text-xs text-gray-500">confidence</span>
                    </div>
                  </div>

                  {/* Subject intelligence */}
                  {studentIntel.subjects?.length > 0 && (
                    <div className="space-y-2 mb-4">
                      <h5 className="text-xs font-semibold text-gray-400 uppercase">Per Subject</h5>
                      {studentIntel.subjects.slice(0, 4).map((s: any) => (
                        <div key={s.id} className="flex items-center gap-2">
                          <span className="text-xs font-medium w-20 truncate">{s.name}</span>
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                s.accuracy > 70 ? 'bg-green-500' : s.accuracy > 40 ? 'bg-amber-500' : 'bg-red-400'
                              }`}
                              style={{ width: `${s.accuracy}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold w-10 text-right">{s.accuracy}%</span>
                          <span className={`text-xs ${s.trend === 'improving' ? 'text-green-600' : s.trend === 'declining' ? 'text-red-500' : 'text-gray-400'}`}>
                            {s.trend === 'improving' ? '↑' : s.trend === 'declining' ? '↓' : '–'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Issues that need attention */}
                  {studentIntel.topIssues?.length > 0 && (
                    <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
                      <h5 className="text-xs font-bold text-red-700 mb-2">Needs Attention</h5>
                      {studentIntel.topIssues.slice(0, 2).map((issue: any, i: number) => (
                        <p key={i} className="text-xs text-red-600 mb-1">
                          {issue.type === 'misconception' ? '❌' : '🔴'} {issue.text}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Attention span warning */}
                  {studentIntel.isNearDropOff && (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4">
                      <p className="text-xs text-amber-700">
                        ⏰ You&apos;ve been learning for {studentIntel.minutesActiveToday} min today.
                        Maybe take a short break?
                      </p>
                    </div>
                  )}

                  {/* Profile confidence */}
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary-300 rounded-full" style={{ width: `${Math.round((studentIntel.profileConfidence || 0) * 100)}%` }} />
                    </div>
                    <span>{Math.round((studentIntel.profileConfidence || 0) * 100)}% profile built</span>
                  </div>
                </>
              ) : (
                <>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                    Learning Intelligence
                  </h4>
                  <p className="text-sm text-gray-500 mb-4">
                    The more you learn with us, the better we understand how to help you.
                    Start your Daily Mix to build your profile!
                  </p>
                </>
              )}

              <Link
                href="/daily-mix"
                className="w-full mt-4 py-3 bg-gradient-to-r from-primary-500 to-secondary-500 text-white rounded-xl font-semibold text-center block hover:shadow-lg transition-all"
              >
                Start Daily Mix →
              </Link>
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h4 className="font-bold mb-4">📊 Your Stats</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-primary-600">{stats?.total_questions_answered || 0}</div>
                  <div className="text-xs text-gray-500">Questions</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {stats?.total_questions_answered
                      ? Math.round((stats.correct_answers / stats.total_questions_answered) * 100)
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

            {/* Honest mastery headline — no fake % */}
            {mastery?.summary && (
              <div className="bg-white rounded-2xl shadow-sm p-5 mb-4 border-l-4 border-primary-500">
                <p className="font-bold text-gray-900 mb-1">{mastery.summary.headline}</p>
                {mastery.summary.details?.slice(0, 2).map((d: string, i: number) => (
                  <p key={i} className="text-xs text-gray-600">{d}</p>
                ))}
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              {subjectsWithProgress.map((subject) => {
                const subjMastery = mastery?.subjects?.find((m: any) => m.subjectId === subject.id);
                return (
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

                    {subjMastery ? (
                      <>
                        {/* Real mastery chips — not fake % complete */}
                        <div className="flex flex-wrap gap-1 mb-3">
                          {subjMastery.counts.mastered > 0 && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                              🏆 {subjMastery.counts.mastered} mastered
                            </span>
                          )}
                          {subjMastery.counts.stable > 0 && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
                              ✓ {subjMastery.counts.stable} stable
                            </span>
                          )}
                          {subjMastery.counts.fragile > 0 && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">
                              ⚠ {subjMastery.counts.fragile} fragile
                            </span>
                          )}
                          {subjMastery.counts.decayed > 0 && (
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">
                              ⏳ {subjMastery.counts.decayed} slipping
                            </span>
                          )}
                          {subjMastery.counts.stalled > 0 && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                              🛑 {subjMastery.counts.stalled} stuck
                            </span>
                          )}
                          {subjMastery.counts.learning > 0 && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                              📖 {subjMastery.counts.learning} learning
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>
                            <strong className="text-gray-800">{subjMastery.trueMasteryPercent}%</strong> truly known
                          </span>
                          <span>
                            {subjMastery.topics.length} topic{subjMastery.topics.length === 1 ? '' : 's'}
                          </span>
                        </div>
                        {subjMastery.needsAttention?.length > 0 && (
                          <p className="mt-2 text-xs text-red-600 font-medium truncate">
                            ⚡ Next: {subjMastery.needsAttention[0].nextAction.label} — {subjMastery.needsAttention[0].topicTitle}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-gray-500 text-sm mb-4">Start any topic to see your real mastery map.</p>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Method Calibration — per-subject what's proven to work */}
            {calibration?.calibration?.length > 0 && (
              <div className="mt-6 bg-white rounded-2xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold">🧭 How You Learn Each Subject Best</h3>
                  <span className="text-xs text-gray-500">Observed from your behavior</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {calibration.calibration.slice(0, 6).map((c: any) => (
                    <div key={c.subjectId} className="p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-sm">{c.subjectName}</span>
                        <span className={`text-xs font-bold ${c.exploring ? 'text-indigo-600' : 'text-emerald-600'}`}>
                          {c.exploring ? '🧪 trying' : '✓ working'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800 capitalize">
                        {c.recommendedMethod.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{c.evidence}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interventions — the misconceptions we're attacking this week */}
            {mastery?.interventions?.length > 0 && (
              <div className="mt-6 bg-white rounded-2xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold">🎯 What We&apos;re Fixing This Week</h3>
                  <span className="text-xs text-gray-500">{mastery.interventions.length} target{mastery.interventions.length === 1 ? '' : 's'}</span>
                </div>
                <div className="space-y-3">
                  {mastery.interventions.slice(0, 3).map((iv: any) => (
                    <div key={iv.id} className="border-l-4 border-primary-400 pl-4 py-2">
                      <p className="font-semibold text-sm">{iv.title}</p>
                      <p className="text-xs text-gray-600 mt-1">{iv.hook}</p>
                      <Link
                        href={`/guru?intervention=${iv.id}&subjectId=${iv.subjectId || ''}`}
                        className="inline-block mt-2 text-xs text-primary-600 font-semibold hover:text-primary-700"
                      >
                        Try it now ({iv.estimatedSeconds}s) →
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Access - New Features */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Link
                href="/guru"
                className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-6 text-white hover:shadow-lg hover:-translate-y-1 transition-all"
              >
                <span className="text-3xl block mb-2">🧙</span>
                <h3 className="font-bold text-lg">AI Guru</h3>
                <p className="text-white/80 text-sm">Your personal learning companion</p>
              </Link>

              <Link
                href="/activities"
                className="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-6 text-white hover:shadow-lg hover:-translate-y-1 transition-all"
              >
                <span className="text-3xl block mb-2">🎮</span>
                <h3 className="font-bold text-lg">Activities</h3>
                <p className="text-white/80 text-sm">Games, puzzles & challenges</p>
              </Link>

              <Link
                href="/learning-dna"
                className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl p-6 text-white hover:shadow-lg hover:-translate-y-1 transition-all"
              >
                <span className="text-3xl block mb-2">🧬</span>
                <h3 className="font-bold text-lg">Learning DNA</h3>
                <p className="text-white/80 text-sm">Discover how you learn best</p>
              </Link>
            </div>

            {/* Learning Methods */}
            <div className="mt-8 bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">🎯 Learning Methods We Use</h3>
                <Link href="/methods" className="text-primary-600 hover:text-primary-700 text-sm font-semibold">
                  View All 20+ →
                </Link>
              </div>
              <div className="grid grid-cols-5 gap-3">
                {[
                  { icon: '📊', name: 'VARK', desc: 'Learning Styles', href: '/learning-dna' },
                  { icon: '🧠', name: 'Multiple Intel.', desc: "Gardner's 8 Types", href: '/learning-dna' },
                  { icon: '🔺', name: "Bloom's", desc: '6 Thinking Levels', href: '/methods' },
                  { icon: '🔄', name: "Kolb's Cycle", desc: 'Learn by Doing', href: '/assessment/kolb' },
                  { icon: '📅', name: 'Spaced Rep.', desc: 'Optimal Review', href: '/flashcards' },
                  { icon: '🕉️', name: 'Vedic Math', desc: 'Ancient Shortcuts', href: '/guru?method=vedic_math' },
                  { icon: '🏰', name: 'Memory Palace', desc: 'Visual Memory', href: '/guru?method=memory_palace' },
                  { icon: '❓', name: 'Socratic', desc: 'Learn by Questions', href: '/guru?method=socratic' },
                  { icon: '📚', name: 'Storytelling', desc: 'Learn through Tales', href: '/guru?method=storytelling' },
                  { icon: '🎯', name: 'Feynman', desc: 'Simplify & Teach', href: '/guru?method=feynman' },
                ].map((method) => (
                  <Link
                    key={method.name}
                    href={method.href}
                    className="text-center p-3 bg-gray-50 rounded-xl hover:bg-primary-50 transition-colors cursor-pointer"
                  >
                    <div className="text-2xl mb-1">{method.icon}</div>
                    <div className="font-semibold text-xs">{method.name}</div>
                    <div className="text-xs text-gray-500">{method.desc}</div>
                  </Link>
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
