'use client';

/**
 * Courses landing — list available courses (Class N — board — language).
 * Click into one for the chapter map + enrollment flow.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Course {
  id: string;
  board_code: string;
  class_level: number;
  language: string;
  academic_year: string;
  title: string;
  description: string | null;
  expected_hours_total: number | null;
  expected_weeks: number | null;
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState<string>('all');

  useEffect(() => {
    setLoading(true);
    const url = classFilter === 'all' ? '/api/courses' : `/api/courses?class=${classFilter}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => setCourses(d?.courses || []))
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  }, [classFilter]);

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Courses</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Year-long, board-aligned coaching tracks. Pick the class you&apos;re studying — your week-by-week plan is built from your persona.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={() => setClassFilter('all')} className={`px-3 py-1 rounded-full text-xs font-medium border ${classFilter === 'all' ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-200 dark:border-gray-700'}`}>All</button>
        {[1,2,3,4,5,6,7,8,9,10].map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setClassFilter(String(k))}
            className={`px-3 py-1 rounded-full text-xs font-medium border ${classFilter === String(k) ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-200 dark:border-gray-700'}`}
          >
            Class {k}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 text-center py-12">Loading…</p>
      ) : courses.length === 0 ? (
        <div className="p-10 rounded-2xl border border-gray-200 dark:border-gray-800 text-center">
          <div className="text-5xl mb-2">📚</div>
          <p className="text-sm text-gray-500">No published courses yet for this class.</p>
          <p className="text-xs text-gray-400 mt-1">Phase D ships the publishing tool — see /admin/courses (coming).</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {courses.map((c) => (
            <Link
              key={c.id}
              href={`/courses/${c.id}`}
              className="block p-4 rounded-2xl border-2 border-gray-200 dark:border-gray-800 hover:border-primary-400 bg-white dark:bg-gray-900 transition-colors"
            >
              <p className="text-xs uppercase tracking-wider font-bold text-primary-700 dark:text-primary-300">
                {c.board_code} · Class {c.class_level} · {c.language}
              </p>
              <h3 className="font-bold text-base mt-1">{c.title}</h3>
              {c.description && <p className="text-xs text-gray-500 mt-1">{c.description}</p>}
              <p className="text-[11px] text-gray-500 mt-2">
                {c.expected_weeks || 40} weeks · {c.academic_year}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
