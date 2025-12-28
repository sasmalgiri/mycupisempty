'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';

interface Student {
  id: string;
  full_name: string;
  email: string;
  current_class: number;
  classroom_name: string;
  classroom_id: string;
  joined_at: string;
  dominant_style?: string;
  total_xp: number;
  level: number;
  current_streak: number;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStyle, setFilterStyle] = useState<string>('all');
  const [filterClassroom, setFilterClassroom] = useState<string>('all');
  const [classrooms, setClassrooms] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    const supabase = createBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    try {
      // Fetch teacher's classrooms
      const { data: classroomsData } = await supabase
        .from('classrooms')
        .select('id, name')
        .eq('teacher_id', user.id)
        .eq('is_active', true);

      setClassrooms(classroomsData || []);

      if (!classroomsData || classroomsData.length === 0) {
        setLoading(false);
        return;
      }

      const classroomIds = classroomsData.map(c => c.id);

      // Fetch all enrollments
      const { data: enrollments } = await supabase
        .from('classroom_enrollments')
        .select('student_id, classroom_id, joined_at')
        .in('classroom_id', classroomIds)
        .eq('status', 'active');

      if (enrollments && enrollments.length > 0) {
        const studentIds = [...new Set(enrollments.map(e => e.student_id))];

        // Fetch profiles
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, current_class')
          .in('id', studentIds);

        // Fetch learning styles
        const { data: learningStyles } = await supabase
          .from('learning_styles')
          .select('user_id, dominant_style')
          .in('user_id', studentIds);

        // Fetch user stats
        const { data: userStats } = await supabase
          .from('user_stats')
          .select('user_id, total_xp, level, current_streak')
          .in('user_id', studentIds);

        const studentsData: Student[] = enrollments.map(enrollment => {
          const profile = profiles?.find(p => p.id === enrollment.student_id);
          const style = learningStyles?.find(s => s.user_id === enrollment.student_id);
          const stats = userStats?.find(s => s.user_id === enrollment.student_id);
          const classroom = classroomsData.find(c => c.id === enrollment.classroom_id);

          return {
            id: enrollment.student_id,
            full_name: profile?.full_name || 'Unknown',
            email: profile?.email || '',
            current_class: profile?.current_class || 0,
            classroom_name: classroom?.name || '',
            classroom_id: enrollment.classroom_id,
            joined_at: enrollment.joined_at,
            dominant_style: style?.dominant_style,
            total_xp: stats?.total_xp || 0,
            level: stats?.level || 1,
            current_streak: stats?.current_streak || 0,
          };
        });

        // Remove duplicates (students in multiple classrooms)
        const uniqueStudents = studentsData.reduce((acc, student) => {
          const existing = acc.find(s => s.id === student.id);
          if (!existing) acc.push(student);
          return acc;
        }, [] as Student[]);

        setStudents(uniqueStudents);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
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

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStyle = filterStyle === 'all' || student.dominant_style === filterStyle;
    const matchesClassroom = filterClassroom === 'all' || student.classroom_id === filterClassroom;
    return matchesSearch && matchesStyle && matchesClassroom;
  });

  const varkCounts = {
    visual: students.filter(s => s.dominant_style === 'visual').length,
    auditory: students.filter(s => s.dominant_style === 'auditory').length,
    reading: students.filter(s => s.dominant_style === 'reading').length,
    kinesthetic: students.filter(s => s.dominant_style === 'kinesthetic').length,
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
        <h1 className="text-3xl font-bold text-gray-900">All Students</h1>
        <p className="text-gray-600 mt-1">View and manage all students across your classrooms</p>
      </div>

      {/* VARK Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { key: 'visual', label: 'Visual', emoji: '👁️', color: 'from-purple-400 to-purple-600' },
          { key: 'auditory', label: 'Auditory', emoji: '👂', color: 'from-blue-400 to-blue-600' },
          { key: 'reading', label: 'Reading', emoji: '📖', color: 'from-green-400 to-green-600' },
          { key: 'kinesthetic', label: 'Kinesthetic', emoji: '🤸', color: 'from-orange-400 to-orange-600' },
        ].map(style => (
          <button
            key={style.key}
            onClick={() => setFilterStyle(filterStyle === style.key ? 'all' : style.key)}
            className={`p-4 rounded-xl border transition-all ${
              filterStyle === style.key
                ? 'border-2 border-gray-900 shadow-lg'
                : 'border-gray-100 hover:border-gray-200'
            } bg-white`}
          >
            <div className={`w-10 h-10 bg-gradient-to-br ${style.color} rounded-lg flex items-center justify-center text-white text-xl mb-2`}>
              {style.emoji}
            </div>
            <p className="text-2xl font-bold text-gray-900">{varkCounts[style.key as keyof typeof varkCounts]}</p>
            <p className="text-sm text-gray-500">{style.label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search students..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
          />
        </div>

        <select
          value={filterClassroom}
          onChange={(e) => setFilterClassroom(e.target.value)}
          className="px-4 py-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
        >
          <option value="all">All Classrooms</option>
          {classrooms.map(classroom => (
            <option key={classroom.id} value={classroom.id}>{classroom.name}</option>
          ))}
        </select>

        {filterStyle !== 'all' && (
          <button
            onClick={() => setFilterStyle('all')}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Clear Filter
          </button>
        )}
      </div>

      {/* Students List */}
      {students.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="text-6xl mb-4">👨‍🎓</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No students yet</h3>
          <p className="text-gray-500 mb-6">
            Students will appear here once they join your classrooms
          </p>
          <Link
            href="/teacher/classrooms"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
          >
            Manage Classrooms
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Student</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Classroom</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Learning Style</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Level</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">XP</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Streak</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredStudents.map(student => (
                <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center text-gray-600 font-bold">
                        {student.full_name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{student.full_name}</p>
                        <p className="text-sm text-gray-500">Class {student.current_class}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{student.classroom_name}</td>
                  <td className="px-6 py-4">
                    {student.dominant_style ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStyleColor(student.dominant_style)}`}>
                        {getStyleEmoji(student.dominant_style)} {student.dominant_style}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">Not assessed</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium text-gray-900">{student.level}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-700">{student.total_xp.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-700">🔥 {student.current_streak}</span>
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/teacher/students/${student.id}`}
                      className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      View Details →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredStudents.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No students match your filters
            </div>
          )}
        </div>
      )}
    </div>
  );
}
