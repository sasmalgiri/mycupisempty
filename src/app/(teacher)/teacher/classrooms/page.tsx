'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';

interface Classroom {
  id: string;
  name: string;
  description: string | null;
  class_level: number;
  invite_code: string;
  is_active: boolean;
  created_at: string;
  student_count: number;
  active_assignments: number;
}

export default function ClassroomsPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    fetchClassrooms();
  }, []);

  const fetchClassrooms = async () => {
    const supabase = createBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    try {
      const { data: classroomsData } = await supabase
        .from('classrooms')
        .select('*')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });

      if (classroomsData) {
        const classroomsWithStats = await Promise.all(
          classroomsData.map(async (classroom) => {
            const { count: studentCount } = await supabase
              .from('classroom_enrollments')
              .select('*', { count: 'exact', head: true })
              .eq('classroom_id', classroom.id)
              .eq('status', 'active');

            const { count: assignmentCount } = await supabase
              .from('assignments')
              .select('*', { count: 'exact', head: true })
              .eq('classroom_id', classroom.id)
              .eq('status', 'published');

            return {
              ...classroom,
              student_count: studentCount || 0,
              active_assignments: assignmentCount || 0,
            };
          })
        );

        setClassrooms(classroomsWithStats);
      }
    } catch (error) {
      console.error('Error fetching classrooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyInviteCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const toggleClassroomStatus = async (classroomId: string, currentStatus: boolean) => {
    const supabase = createBrowserClient();

    const { error } = await supabase
      .from('classrooms')
      .update({ is_active: !currentStatus })
      .eq('id', classroomId);

    if (!error) {
      setClassrooms(prev =>
        prev.map(c =>
          c.id === classroomId ? { ...c, is_active: !currentStatus } : c
        )
      );
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Classrooms</h1>
          <p className="text-gray-600 mt-1">Manage your virtual classrooms and students</p>
        </div>
        <Link
          href="/teacher/classrooms/new"
          className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
        >
          <span>+</span>
          <span>New Classroom</span>
        </Link>
      </div>

      {/* Classrooms Grid */}
      {classrooms.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="text-6xl mb-4">🏫</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No classrooms yet</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Create your first classroom to start adding students and tracking their learning progress.
          </p>
          <Link
            href="/teacher/classrooms/new"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
          >
            Create Your First Classroom
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classrooms.map(classroom => (
            <div
              key={classroom.id}
              className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all hover:shadow-md ${
                !classroom.is_active ? 'opacity-60' : ''
              }`}
            >
              {/* Header */}
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center text-2xl font-bold">
                    {classroom.class_level}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    classroom.is_active
                      ? 'bg-green-400/20 text-green-100'
                      : 'bg-gray-400/20 text-gray-200'
                  }`}>
                    {classroom.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <h3 className="text-xl font-bold">{classroom.name}</h3>
                <p className="text-blue-100 text-sm mt-1">Class {classroom.class_level}</p>
              </div>

              {/* Body */}
              <div className="p-6">
                {classroom.description && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">{classroom.description}</p>
                )}

                {/* Stats */}
                <div className="flex gap-4 mb-4">
                  <div className="flex-1 text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-900">{classroom.student_count}</p>
                    <p className="text-xs text-gray-500">Students</p>
                  </div>
                  <div className="flex-1 text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-900">{classroom.active_assignments}</p>
                    <p className="text-xs text-gray-500">Assignments</p>
                  </div>
                </div>

                {/* Invite Code */}
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg mb-4">
                  <span className="text-sm text-blue-700">Invite Code:</span>
                  <span className="font-mono font-bold text-blue-900">{classroom.invite_code}</span>
                  <button
                    onClick={() => copyInviteCode(classroom.invite_code)}
                    className="ml-auto p-1.5 hover:bg-blue-100 rounded transition-colors"
                    title="Copy invite code"
                  >
                    {copiedCode === classroom.invite_code ? (
                      <span className="text-green-600">✓</span>
                    ) : (
                      <span>📋</span>
                    )}
                  </button>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Link
                    href={`/teacher/classrooms/${classroom.id}`}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white text-center rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    View Details
                  </Link>
                  <button
                    onClick={() => toggleClassroomStatus(classroom.id, classroom.is_active)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      classroom.is_active
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {classroom.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
