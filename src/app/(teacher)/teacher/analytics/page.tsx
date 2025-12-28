'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalClassrooms: 0,
    averageAccuracy: 0,
    totalQuestions: 0,
  });
  const [varkDistribution, setVarkDistribution] = useState({
    visual: 0,
    auditory: 0,
    reading: 0,
    kinesthetic: 0,
  });

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    const supabase = createBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    try {
      // Fetch classrooms
      const { data: classrooms, count: classroomCount } = await (supabase
        .from('classrooms') as any)
        .select('id', { count: 'exact' })
        .eq('teacher_id', user.id)
        .eq('is_active', true);

      if (classrooms && classrooms.length > 0) {
        const classroomIds = (classrooms as any[]).map((c: any) => c.id);

        // Fetch enrollments
        const { data: enrollments } = await (supabase
          .from('classroom_enrollments') as any)
          .select('student_id')
          .in('classroom_id', classroomIds)
          .eq('status', 'active');

        const studentIds = [...new Set((enrollments as any[] || []).map((e: any) => e.student_id))] as string[];

        // Fetch learning styles
        const { data: learningStyles } = await supabase
          .from('learning_styles')
          .select('dominant_style')
          .in('user_id', studentIds) as { data: { dominant_style: string | null }[] | null };

        // Calculate VARK distribution
        const counts = { visual: 0, auditory: 0, reading: 0, kinesthetic: 0 };
        learningStyles?.forEach((style: { dominant_style: string | null }) => {
          if (style.dominant_style && style.dominant_style in counts) {
            counts[style.dominant_style as keyof typeof counts]++;
          }
        });

        const total = studentIds.length || 1;
        setVarkDistribution({
          visual: Math.round((counts.visual / total) * 100),
          auditory: Math.round((counts.auditory / total) * 100),
          reading: Math.round((counts.reading / total) * 100),
          kinesthetic: Math.round((counts.kinesthetic / total) * 100),
        });

        // Fetch user stats for accuracy
        const { data: userStats } = await supabase
          .from('user_stats')
          .select('total_questions_answered, correct_answers')
          .in('user_id', studentIds) as { data: { total_questions_answered: number; correct_answers: number }[] | null };

        let totalQuestions = 0;
        let totalCorrect = 0;
        userStats?.forEach((stat: { total_questions_answered: number; correct_answers: number }) => {
          totalQuestions += stat.total_questions_answered || 0;
          totalCorrect += stat.correct_answers || 0;
        });

        setStats({
          totalStudents: studentIds.length,
          totalClassrooms: classroomCount || 0,
          averageAccuracy: totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
          totalQuestions,
        });
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
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
        <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600 mt-1">Overview of your students&apos; performance and learning patterns</p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
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

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
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

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Average Accuracy</p>
              <p className="text-3xl font-bold text-gray-900">{stats.averageAccuracy}%</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-2xl">
              🎯
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Questions Answered</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalQuestions.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-2xl">
              ❓
            </div>
          </div>
        </div>
      </div>

      {/* VARK Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Learning Style Distribution</h3>

          {stats.totalStudents === 0 ? (
            <p className="text-gray-500 text-center py-8">No student data available</p>
          ) : (
            <div className="space-y-4">
              {[
                { key: 'visual', label: 'Visual Learners', emoji: '👁️', color: 'bg-purple-500', percentage: varkDistribution.visual },
                { key: 'auditory', label: 'Auditory Learners', emoji: '👂', color: 'bg-blue-500', percentage: varkDistribution.auditory },
                { key: 'reading', label: 'Reading/Writing', emoji: '📖', color: 'bg-green-500', percentage: varkDistribution.reading },
                { key: 'kinesthetic', label: 'Kinesthetic Learners', emoji: '🤸', color: 'bg-orange-500', percentage: varkDistribution.kinesthetic },
              ].map(style => (
                <div key={style.key}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-2">
                      <span className="text-xl">{style.emoji}</span>
                      <span className="text-gray-700 font-medium">{style.label}</span>
                    </span>
                    <span className="font-bold text-gray-900">{style.percentage}%</span>
                  </div>
                  <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${style.color} rounded-full transition-all`}
                      style={{ width: `${style.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Teaching Insights</h3>

          {stats.totalStudents === 0 ? (
            <p className="text-gray-500 text-center py-8">Add students to see insights</p>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <p className="font-medium text-blue-900 mb-1">Diverse Learning Styles</p>
                <p className="text-sm text-blue-700">
                  Your students have varied learning preferences. Consider using multimodal teaching approaches.
                </p>
              </div>

              <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                <p className="font-medium text-green-900 mb-1">Performance Tip</p>
                <p className="text-sm text-green-700">
                  Students with {stats.averageAccuracy >= 70 ? 'strong' : 'developing'} accuracy.
                  {stats.averageAccuracy < 70 && ' Consider reviewing difficult topics.'}
                </p>
              </div>

              <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                <p className="font-medium text-purple-900 mb-1">Engagement</p>
                <p className="text-sm text-purple-700">
                  {stats.totalQuestions > 100
                    ? 'Good engagement! Students are actively practicing.'
                    : 'Encourage more practice to build mastery.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
