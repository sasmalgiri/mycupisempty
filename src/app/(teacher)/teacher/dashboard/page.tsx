'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import type { Classroom, StudentProfile, VARKDistribution } from '@/types/teacher';

interface DashboardStats {
  totalStudents: number;
  totalClassrooms: number;
  activeAssignments: number;
  pendingSubmissions: number;
}

interface ClassroomSummary {
  id: string;
  name: string;
  class_level: number;
  student_count: number;
  invite_code: string;
}

interface RecentStudent {
  id: string;
  full_name: string;
  classroom_name: string;
  joined_at: string;
  dominant_style?: string;
}

export default function TeacherDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalClassrooms: 0,
    activeAssignments: 0,
    pendingSubmissions: 0,
  });
  const [classrooms, setClassrooms] = useState<ClassroomSummary[]>([]);
  const [recentStudents, setRecentStudents] = useState<RecentStudent[]>([]);
  const [varkDistribution, setVarkDistribution] = useState<VARKDistribution | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    const supabase = createBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    try {
      // Fetch classrooms
      const { data: classroomsData } = await supabase
        .from('classrooms')
        .select('id, name, class_level, invite_code')
        .eq('teacher_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      const classroomsList = classroomsData || [];

      // Fetch enrollments for each classroom
      const classroomSummaries: ClassroomSummary[] = [];
      let totalStudentIds = new Set<string>();

      for (const classroom of classroomsList) {
        const { data: enrollments } = await supabase
          .from('classroom_enrollments')
          .select('student_id')
          .eq('classroom_id', classroom.id)
          .eq('status', 'active');

        const studentCount = enrollments?.length || 0;
        enrollments?.forEach(e => totalStudentIds.add(e.student_id));

        classroomSummaries.push({
          ...classroom,
          student_count: studentCount,
        });
      }

      setClassrooms(classroomSummaries);

      // Fetch assignments count
      const { count: assignmentsCount } = await supabase
        .from('assignments')
        .select('*', { count: 'exact', head: true })
        .eq('teacher_id', user.id)
        .eq('status', 'published');

      // Fetch pending submissions
      const { count: pendingCount } = await supabase
        .from('assignment_submissions')
        .select('*, assignments!inner(*)', { count: 'exact', head: true })
        .eq('assignments.teacher_id', user.id)
        .eq('status', 'submitted');

      setStats({
        totalStudents: totalStudentIds.size,
        totalClassrooms: classroomsList.length,
        activeAssignments: assignmentsCount || 0,
        pendingSubmissions: pendingCount || 0,
      });

      // Fetch recent students with their VARK styles
      if (classroomsList.length > 0) {
        const { data: recentEnrollments } = await supabase
          .from('classroom_enrollments')
          .select(`
            student_id,
            joined_at,
            classrooms (name)
          `)
          .in('classroom_id', classroomsList.map(c => c.id))
          .eq('status', 'active')
          .order('joined_at', { ascending: false })
          .limit(5);

        if (recentEnrollments && recentEnrollments.length > 0) {
          const studentIds = recentEnrollments.map(e => e.student_id);

          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', studentIds);

          const { data: learningStyles } = await supabase
            .from('learning_styles')
            .select('user_id, dominant_style')
            .in('user_id', studentIds);

          const recentStudentsList: RecentStudent[] = recentEnrollments.map(enrollment => {
            const profile = profiles?.find(p => p.id === enrollment.student_id);
            const style = learningStyles?.find(s => s.user_id === enrollment.student_id);
            return {
              id: enrollment.student_id,
              full_name: profile?.full_name || 'Unknown Student',
              classroom_name: (enrollment.classrooms as any)?.name || '',
              joined_at: enrollment.joined_at,
              dominant_style: style?.dominant_style,
            };
          });

          setRecentStudents(recentStudentsList);

          // Calculate VARK distribution
          if (learningStyles && learningStyles.length > 0) {
            const counts = { visual: 0, auditory: 0, reading: 0, kinesthetic: 0 };
            learningStyles.forEach(style => {
              if (style.dominant_style && style.dominant_style in counts) {
                counts[style.dominant_style as keyof typeof counts]++;
              }
            });
            const total = learningStyles.length;
            setVarkDistribution({
              visual: Math.round((counts.visual / total) * 100),
              auditory: Math.round((counts.auditory / total) * 100),
              reading: Math.round((counts.reading / total) * 100),
              kinesthetic: Math.round((counts.kinesthetic / total) * 100),
              dominant_counts: counts,
              total_students: total,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStyleColor = (style: string) => {
    switch (style) {
      case 'visual': return 'bg-purple-100 text-purple-700';
      case 'auditory': return 'bg-blue-100 text-blue-700';
      case 'reading': return 'bg-green-100 text-green-700';
      case 'kinesthetic': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
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

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Teacher Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back! Here&apos;s an overview of your classes.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Students</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalStudents}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl">
              👨‍🎓
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Classrooms</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalClassrooms}</p>
            </div>
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-2xl">
              🏫
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Assignments</p>
              <p className="text-3xl font-bold text-gray-900">{stats.activeAssignments}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-2xl">
              📝
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending Reviews</p>
              <p className="text-3xl font-bold text-gray-900">{stats.pendingSubmissions}</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-2xl">
              ⏳
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Classrooms Section */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Your Classrooms</h2>
              <Link
                href="/teacher/classrooms/new"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                + New Classroom
              </Link>
            </div>

            {classrooms.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🏫</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No classrooms yet</h3>
                <p className="text-gray-500 mb-4">Create your first classroom to start managing students.</p>
                <Link
                  href="/teacher/classrooms/new"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Classroom
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {classrooms.map(classroom => (
                  <Link
                    key={classroom.id}
                    href={`/teacher/classrooms/${classroom.id}`}
                    className="block p-4 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl flex items-center justify-center text-white font-bold">
                          {classroom.class_level}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{classroom.name}</h3>
                          <p className="text-sm text-gray-500">Class {classroom.class_level} • {classroom.student_count} students</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Invite Code</p>
                        <p className="font-mono font-bold text-blue-600">{classroom.invite_code}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* VARK Distribution */}
          {varkDistribution && varkDistribution.total_students > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Class Learning Styles</h2>
              <div className="space-y-3">
                {[
                  { key: 'visual', label: 'Visual', emoji: '👁️', color: 'bg-purple-500' },
                  { key: 'auditory', label: 'Auditory', emoji: '👂', color: 'bg-blue-500' },
                  { key: 'reading', label: 'Reading/Writing', emoji: '📖', color: 'bg-green-500' },
                  { key: 'kinesthetic', label: 'Kinesthetic', emoji: '🤸', color: 'bg-orange-500' },
                ].map(style => (
                  <div key={style.key}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="flex items-center gap-2">
                        <span>{style.emoji}</span>
                        <span className="text-gray-700">{style.label}</span>
                      </span>
                      <span className="font-semibold text-gray-900">
                        {varkDistribution[style.key as keyof typeof varkDistribution]}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${style.color} rounded-full transition-all`}
                        style={{ width: `${varkDistribution[style.key as keyof typeof varkDistribution]}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-4 text-center">
                Based on {varkDistribution.total_students} students
              </p>
            </div>
          )}

          {/* Recent Students */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Recent Students</h2>
              <Link href="/teacher/students" className="text-sm text-blue-600 hover:underline">
                View all
              </Link>
            </div>

            {recentStudents.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No students enrolled yet</p>
            ) : (
              <div className="space-y-3">
                {recentStudents.map(student => (
                  <Link
                    key={student.id}
                    href={`/teacher/students/${student.id}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center text-gray-600 font-bold">
                      {student.full_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{student.full_name}</p>
                      <p className="text-xs text-gray-500 truncate">{student.classroom_name}</p>
                    </div>
                    {student.dominant_style && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStyleColor(student.dominant_style)}`}>
                        {getStyleEmoji(student.dominant_style)}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-sm p-6 text-white">
            <h2 className="text-lg font-bold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Link
                href="/teacher/classrooms/new"
                className="flex items-center gap-3 px-4 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                <span>➕</span>
                <span>Create New Classroom</span>
              </Link>
              <Link
                href="/teacher/assignments"
                className="flex items-center gap-3 px-4 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                <span>📝</span>
                <span>Create Assignment</span>
              </Link>
              <Link
                href="/teacher/analytics"
                className="flex items-center gap-3 px-4 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                <span>📊</span>
                <span>View Analytics</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
