'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  assignment_type: string;
  classroom_name: string;
  classroom_id: string;
  due_date: string | null;
  status: string;
  total_marks: number;
  submissions_count: number;
  graded_count: number;
}

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classrooms, setClassrooms] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    const supabase = createBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    try {
      // Fetch classrooms
      const { data: classroomsData } = await (supabase
        .from('classrooms') as any)
        .select('id, name')
        .eq('teacher_id', user.id);

      setClassrooms((classroomsData || []) as { id: string; name: string }[]);

      // Fetch assignments
      const { data: assignmentsData } = await (supabase
        .from('assignments') as any)
        .select('*, classrooms(name)')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });

      if (assignmentsData) {
        const assignmentsWithStats = await Promise.all(
          (assignmentsData as any[]).map(async (assignment: any) => {
            const { count: submissionsCount } = await (supabase
              .from('assignment_submissions') as any)
              .select('*', { count: 'exact', head: true })
              .eq('assignment_id', assignment.id)
              .in('status', ['submitted', 'graded']);

            const { count: gradedCount } = await (supabase
              .from('assignment_submissions') as any)
              .select('*', { count: 'exact', head: true })
              .eq('assignment_id', assignment.id)
              .eq('status', 'graded');

            return {
              id: assignment.id,
              title: assignment.title,
              description: assignment.description,
              assignment_type: assignment.assignment_type,
              classroom_name: (assignment.classrooms as any)?.name || '',
              classroom_id: assignment.classroom_id,
              due_date: assignment.due_date,
              status: assignment.status,
              total_marks: assignment.total_marks,
              submissions_count: submissionsCount || 0,
              graded_count: gradedCount || 0,
            };
          })
        );

        setAssignments(assignmentsWithStats);
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-700';
      case 'draft': return 'bg-gray-100 text-gray-700';
      case 'closed': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'quiz': return '📝';
      case 'homework': return '📚';
      case 'test': return '🎯';
      case 'practice': return '💪';
      default: return '📄';
    }
  };

  const filteredAssignments = filterStatus === 'all'
    ? assignments
    : assignments.filter(a => a.status === filterStatus);

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
          <h1 className="text-3xl font-bold text-gray-900">Assignments</h1>
          <p className="text-gray-600 mt-1">Create and manage assignments for your classrooms</p>
        </div>
        {classrooms.length > 0 && (
          <Link
            href="/teacher/assignments/new"
            className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
          >
            <span>+</span>
            <span>New Assignment</span>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {['all', 'draft', 'published', 'closed'].map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Assignments List */}
      {classrooms.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="text-6xl mb-4">🏫</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Create a classroom first</h3>
          <p className="text-gray-500 mb-6">
            You need at least one classroom before creating assignments
          </p>
          <Link
            href="/teacher/classrooms/new"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
          >
            Create Classroom
          </Link>
        </div>
      ) : assignments.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="text-6xl mb-4">📝</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No assignments yet</h3>
          <p className="text-gray-500 mb-6">
            Create your first assignment to start engaging your students
          </p>
          <Link
            href="/teacher/assignments/new"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
          >
            Create Assignment
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {filteredAssignments.map(assignment => (
              <div key={assignment.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl">
                    {getTypeIcon(assignment.assignment_type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{assignment.title}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(assignment.status)}`}>
                        {assignment.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {assignment.classroom_name} • {assignment.total_marks} marks
                      {assignment.due_date && ` • Due ${new Date(assignment.due_date).toLocaleDateString()}`}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-medium text-gray-900">
                      {assignment.graded_count}/{assignment.submissions_count}
                    </p>
                    <p className="text-sm text-gray-500">graded</p>
                  </div>

                  <Link
                    href={`/teacher/assignments/${assignment.id}`}
                    className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    View →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
