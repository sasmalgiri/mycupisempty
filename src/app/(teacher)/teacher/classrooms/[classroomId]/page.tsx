'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';

interface Classroom {
  id: string;
  name: string;
  description: string | null;
  class_level: number;
  invite_code: string;
  is_active: boolean;
  max_students: number;
  created_at: string;
}

interface Student {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  current_class: number;
  joined_at: string;
  learning_style?: {
    visual_score: number;
    auditory_score: number;
    reading_score: number;
    kinesthetic_score: number;
    dominant_style: string | null;
  };
  stats?: {
    total_xp: number;
    current_streak: number;
    level: number;
  };
}

export default function ClassroomDetailPage() {
  const params = useParams();
  const classroomId = params.classroomId as string;

  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeTab, setActiveTab] = useState<'students' | 'vark' | 'assignments'>('students');

  useEffect(() => {
    fetchClassroomData();
  }, [classroomId]);

  const fetchClassroomData = async () => {
    const supabase = createBrowserClient();

    try {
      // Fetch classroom - cast to any for new tables
      const { data: classroomData } = await (supabase
        .from('classrooms') as any)
        .select('*')
        .eq('id', classroomId)
        .single();

      if (classroomData) {
        setClassroom(classroomData as Classroom);

        // Fetch enrolled students - cast to any for new tables
        const { data: enrollments } = await (supabase
          .from('classroom_enrollments') as any)
          .select('student_id, joined_at')
          .eq('classroom_id', classroomId)
          .eq('status', 'active');

        if (enrollments && enrollments.length > 0) {
          const studentIds = (enrollments as any[]).map((e: any) => e.student_id);

          // Fetch student profiles - add type assertion
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url, current_class')
            .in('id', studentIds) as { data: { id: string; full_name: string | null; email: string | null; avatar_url: string | null; current_class: number | null }[] | null };

          // Fetch learning styles - add type assertion
          const { data: learningStyles } = await supabase
            .from('learning_styles')
            .select('user_id, visual_score, auditory_score, reading_score, kinesthetic_score, dominant_style')
            .in('user_id', studentIds) as { data: { user_id: string; visual_score: number; auditory_score: number; reading_score: number; kinesthetic_score: number; dominant_style: string | null }[] | null };

          // Fetch user stats - add type assertion
          const { data: userStats } = await supabase
            .from('user_stats')
            .select('user_id, total_xp, current_streak, level')
            .in('user_id', studentIds) as { data: { user_id: string; total_xp: number; current_streak: number; level: number }[] | null };

          const studentsData: Student[] = (enrollments as any[]).map((enrollment: any) => {
            const profile = profiles?.find(p => p.id === enrollment.student_id);
            const style = learningStyles?.find(s => s.user_id === enrollment.student_id);
            const stats = userStats?.find(s => s.user_id === enrollment.student_id);

            return {
              id: enrollment.student_id,
              full_name: profile?.full_name || 'Unknown',
              email: profile?.email || '',
              avatar_url: profile?.avatar_url || null,
              current_class: profile?.current_class || 0,
              joined_at: enrollment.joined_at,
              learning_style: style ? {
                visual_score: style.visual_score,
                auditory_score: style.auditory_score,
                reading_score: style.reading_score,
                kinesthetic_score: style.kinesthetic_score,
                dominant_style: style.dominant_style,
              } : undefined,
              stats: stats ? {
                total_xp: stats.total_xp,
                current_streak: stats.current_streak,
                level: stats.level,
              } : undefined,
            };
          });

          setStudents(studentsData);
        }
      }
    } catch (error) {
      console.error('Error fetching classroom data:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyInviteCode = async () => {
    if (classroom) {
      await navigator.clipboard.writeText(classroom.invite_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const getStyleColor = (style: string) => {
    switch (style) {
      case 'visual': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'auditory': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'reading': return 'bg-green-100 text-green-700 border-green-200';
      case 'kinesthetic': return 'bg-orange-100 text-orange-700 border-orange-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStyleEmoji = (style: string) => {
    switch (style) {
      case 'visual': return '👁️';
      case 'auditory': return '👂';
      case 'reading': return '📖';
      case 'kinesthetic': return '🤸';
      default: return '❓';
    }
  };

  const calculateVARKDistribution = () => {
    const counts = { visual: 0, auditory: 0, reading: 0, kinesthetic: 0 };
    students.forEach(student => {
      if (student.learning_style?.dominant_style) {
        const style = student.learning_style.dominant_style as keyof typeof counts;
        if (style in counts) counts[style]++;
      }
    });
    return counts;
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!classroom) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-bold text-gray-900">Classroom not found</h2>
        <Link href="/teacher/classrooms" className="text-blue-600 hover:underline mt-4 inline-block">
          Back to Classrooms
        </Link>
      </div>
    );
  }

  const varkDistribution = calculateVARKDistribution();

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/teacher/classrooms"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <span>←</span>
          <span>Back to Classrooms</span>
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{classroom.name}</h1>
            <p className="text-gray-600 mt-1">
              Class {classroom.class_level} • {students.length} students
              {classroom.description && ` • ${classroom.description}`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Invite Code */}
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg border border-blue-100">
              <span className="text-sm text-blue-700">Invite Code:</span>
              <span className="font-mono font-bold text-blue-900">{classroom.invite_code}</span>
              <button
                onClick={copyInviteCode}
                className="p-1 hover:bg-blue-100 rounded transition-colors"
                title="Copy invite code"
              >
                {copiedCode ? '✓' : '📋'}
              </button>
            </div>

            <span className={`px-3 py-2 rounded-lg text-sm font-medium ${
              classroom.is_active
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-700'
            }`}>
              {classroom.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {[
          { id: 'students', label: 'Students', icon: '👨‍🎓' },
          { id: 'vark', label: 'VARK Insights', icon: '🧠' },
          { id: 'assignments', label: 'Assignments', icon: '📝' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-3 font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'students' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          {students.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">👨‍🎓</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No students yet</h3>
              <p className="text-gray-500 mb-4">
                Share the invite code <span className="font-mono font-bold text-blue-600">{classroom.invite_code}</span> with your students
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {students.map(student => (
                <Link
                  key={student.id}
                  href={`/teacher/students/${student.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center text-gray-600 font-bold text-lg">
                    {student.full_name.charAt(0)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{student.full_name}</p>
                    <p className="text-sm text-gray-500">Joined {new Date(student.joined_at).toLocaleDateString()}</p>
                  </div>

                  {student.learning_style && student.learning_style.dominant_style && (
                    <div className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${getStyleColor(student.learning_style.dominant_style)}`}>
                      {getStyleEmoji(student.learning_style.dominant_style)} {student.learning_style.dominant_style}
                    </div>
                  )}

                  {student.stats && (
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">Level {student.stats.level}</p>
                      <p className="text-sm text-gray-500">{student.stats.total_xp} XP</p>
                    </div>
                  )}

                  <span className="text-gray-400">→</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'vark' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Distribution */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Class Learning Style Distribution</h3>

            {students.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No student data available</p>
            ) : (
              <div className="space-y-4">
                {[
                  { key: 'visual', label: 'Visual Learners', emoji: '👁️', color: 'bg-purple-500', bg: 'bg-purple-100' },
                  { key: 'auditory', label: 'Auditory Learners', emoji: '👂', color: 'bg-blue-500', bg: 'bg-blue-100' },
                  { key: 'reading', label: 'Reading/Writing', emoji: '📖', color: 'bg-green-500', bg: 'bg-green-100' },
                  { key: 'kinesthetic', label: 'Kinesthetic Learners', emoji: '🤸', color: 'bg-orange-500', bg: 'bg-orange-100' },
                ].map(style => {
                  const count = varkDistribution[style.key as keyof typeof varkDistribution];
                  const percentage = students.length > 0 ? Math.round((count / students.length) * 100) : 0;

                  return (
                    <div key={style.key}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="flex items-center gap-2">
                          <span className="text-xl">{style.emoji}</span>
                          <span className="text-gray-700 font-medium">{style.label}</span>
                        </span>
                        <span className="font-bold text-gray-900">{count} ({percentage}%)</span>
                      </div>
                      <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${style.color} rounded-full transition-all`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recommendations */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Teaching Recommendations</h3>

            {students.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Add students to see recommendations</p>
            ) : (
              <div className="space-y-4">
                {varkDistribution.visual > 0 && (
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                    <p className="font-medium text-purple-900 mb-1">
                      👁️ For {varkDistribution.visual} Visual Learner{varkDistribution.visual > 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-purple-700">
                      Use diagrams, charts, mind maps, and color-coded notes. Include videos and visual demonstrations.
                    </p>
                  </div>
                )}

                {varkDistribution.auditory > 0 && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="font-medium text-blue-900 mb-1">
                      👂 For {varkDistribution.auditory} Auditory Learner{varkDistribution.auditory > 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-blue-700">
                      Encourage discussions, use verbal explanations, and provide audio resources. Group activities work well.
                    </p>
                  </div>
                )}

                {varkDistribution.reading > 0 && (
                  <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                    <p className="font-medium text-green-900 mb-1">
                      📖 For {varkDistribution.reading} Reading/Writing Learner{varkDistribution.reading > 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-green-700">
                      Provide written materials, encourage note-taking, and assign reading tasks. Written assignments are effective.
                    </p>
                  </div>
                )}

                {varkDistribution.kinesthetic > 0 && (
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                    <p className="font-medium text-orange-900 mb-1">
                      🤸 For {varkDistribution.kinesthetic} Kinesthetic Learner{varkDistribution.kinesthetic > 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-orange-700">
                      Include hands-on activities, experiments, and movement. Let them learn by doing and practice.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'assignments' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="text-6xl mb-4">📝</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Assignment Management</h3>
          <p className="text-gray-500 mb-6">Create and manage assignments for this classroom</p>
          <Link
            href={`/teacher/classrooms/${classroomId}/assignments/new`}
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
          >
            Create Assignment
          </Link>
        </div>
      )}
    </div>
  );
}
