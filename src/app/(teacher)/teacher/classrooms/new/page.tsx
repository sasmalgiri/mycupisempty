'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';

interface Subject {
  id: string;
  name: string;
  code: string;
}

export default function NewClassroomPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    class_level: '6',
    subject_id: '',
    max_students: '50',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSubjects();
  }, [formData.class_level]);

  const fetchSubjects = async () => {
    const supabase = createBrowserClient();

    const { data: classData } = await supabase
      .from('classes')
      .select('id')
      .eq('class_number', parseInt(formData.class_level))
      .single();

    if (classData) {
      const { data: subjectsData } = await supabase
        .from('subjects')
        .select('id, name, code')
        .eq('class_id', classData.id)
        .eq('is_active', true);

      setSubjects(subjectsData || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError('You must be logged in to create a classroom');
      setLoading(false);
      return;
    }

    try {
      const { data, error: insertError } = await supabase
        .from('classrooms')
        .insert({
          teacher_id: user.id,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          class_level: parseInt(formData.class_level),
          subject_id: formData.subject_id || null,
          max_students: parseInt(formData.max_students),
        })
        .select()
        .single();

      if (insertError) throw insertError;

      router.push(`/teacher/classrooms/${data.id}`);
    } catch (err: any) {
      console.error('Error creating classroom:', err);
      setError(err.message || 'Failed to create classroom');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/teacher/classrooms"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <span>←</span>
          <span>Back to Classrooms</span>
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Create New Classroom</h1>
        <p className="text-gray-600 mt-1">Set up a virtual classroom for your students</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Classroom Name */}
        <div className="mb-6">
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Classroom Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="e.g., Class 6A - Mathematics"
            className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
          />
        </div>

        {/* Description */}
        <div className="mb-6">
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Description (Optional)
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Brief description of this classroom..."
            rows={3}
            className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all resize-none"
          />
        </div>

        {/* Class Level */}
        <div className="mb-6">
          <label htmlFor="class_level" className="block text-sm font-medium text-gray-700 mb-2">
            Class Level *
          </label>
          <select
            id="class_level"
            name="class_level"
            value={formData.class_level}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map(level => (
              <option key={level} value={level}>
                Class {level}
              </option>
            ))}
          </select>
        </div>

        {/* Subject */}
        <div className="mb-6">
          <label htmlFor="subject_id" className="block text-sm font-medium text-gray-700 mb-2">
            Subject (Optional)
          </label>
          <select
            id="subject_id"
            name="subject_id"
            value={formData.subject_id}
            onChange={handleChange}
            className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
          >
            <option value="">All Subjects / General</option>
            {subjects.map(subject => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Select a subject to focus this classroom on specific content
          </p>
        </div>

        {/* Max Students */}
        <div className="mb-8">
          <label htmlFor="max_students" className="block text-sm font-medium text-gray-700 mb-2">
            Maximum Students
          </label>
          <input
            type="number"
            id="max_students"
            name="max_students"
            value={formData.max_students}
            onChange={handleChange}
            min="1"
            max="200"
            className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
          />
          <p className="text-xs text-gray-500 mt-1">
            Limit the number of students who can join this classroom
          </p>
        </div>

        {/* Info Box */}
        <div className="mb-8 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <h4 className="font-medium text-blue-900 mb-2">What happens next?</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• A unique invite code will be generated automatically</li>
            <li>• Share the code with students to let them join</li>
            <li>• You&apos;ll be able to see each student&apos;s learning style and progress</li>
            <li>• Create assignments and track submissions</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <Link
            href="/teacher/classrooms"
            className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 text-center rounded-xl hover:bg-gray-200 transition-colors font-medium"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || !formData.name.trim()}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create Classroom'}
          </button>
        </div>
      </form>
    </div>
  );
}
