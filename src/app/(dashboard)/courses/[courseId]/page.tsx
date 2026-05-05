'use client';

/**
 * Course detail + enrollment flow. Shows chapter map per subject, weekly
 * minutes picker, start-date picker, then enrolls.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Chapter {
  id: string;
  subject_class_id: string;
  chapter_no: number;
  title_en: string;
  title_native: string | null;
  description: string | null;
  expected_hours: number | null;
}

interface Subject {
  id: string;
  subject_slug: string;
  textbook_title_romanized: string | null;
  textbook_title_en: string | null;
  total_chapters: number | null;
}

interface Course {
  id: string;
  board_code: string;
  class_level: number;
  language: string;
  title: string;
  description: string | null;
  expected_hours_total: number | null;
  expected_weeks: number | null;
}

export default function CourseDetail() {
  const params = useParams();
  const router = useRouter();
  const courseId = String(params?.courseId);

  const [course, setCourse] = useState<Course | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [myEnrollment, setMyEnrollment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [weeklyMinutes, setWeeklyMinutes] = useState(300);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetch(`/api/courses?id=${courseId}`)
      .then((r) => r.json())
      .then((d) => {
        setCourse(d?.course || null);
        setSubjects(d?.subjects || []);
        setChapters(d?.chapters || []);
        setMyEnrollment(d?.myEnrollment || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [courseId]);

  const enroll = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enroll', courseId, startDate, weeklyMinutes }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Enrollment failed.');
      setMyEnrollment(json.enrollment);
      // After enrollment, navigate to a course-progress view (to be built in Phase H).
      router.push('/courses');
    } catch (err: any) {
      alert(err?.message || 'Enrollment error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="max-w-3xl mx-auto p-8 text-center text-gray-500">Loading course…</div>;
  if (!course) return (
    <div className="max-w-3xl mx-auto p-8 text-center">
      <p className="text-sm text-gray-500">Course not found.</p>
      <Link href="/courses" className="text-primary-600 hover:underline">Back to courses</Link>
    </div>
  );

  const chaptersBySubject = chapters.reduce<Record<string, Chapter[]>>((acc, c) => {
    (acc[c.subject_class_id] ||= []).push(c);
    return acc;
  }, {});

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      <Link href="/courses" className="text-sm text-primary-600 hover:underline">← All courses</Link>

      <div>
        <p className="text-xs uppercase tracking-wider font-bold text-primary-700 dark:text-primary-300">
          {course.board_code} · Class {course.class_level} · {course.language}
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold mt-1">{course.title}</h1>
        {course.description && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{course.description}</p>}
        <p className="text-xs text-gray-500 mt-2">
          {course.expected_weeks || 40} weeks{course.expected_hours_total ? ` · ~${course.expected_hours_total} hours total` : ''}
        </p>
      </div>

      {myEnrollment ? (
        <section className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4">
          <h3 className="font-bold mb-1">✓ Enrolled</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Started <strong>{myEnrollment.start_date}</strong> · target {myEnrollment.weekly_minutes_target} min / week.
          </p>
          <p className="text-xs text-gray-500 mt-2">Your week-by-week plan generates from your persona — visit <Link href="/persona" className="text-primary-600 underline">/persona</Link> to fill it out if you haven&apos;t.</p>
        </section>
      ) : (
        <section className="rounded-2xl border-2 border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-950/30 p-4 space-y-3">
          <h3 className="font-bold">Enrol</h3>
          <label className="block text-xs">
            <span className="block text-gray-500 mb-1">Start date</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
          </label>
          <label className="block text-xs">
            <span className="block text-gray-500 mb-1">Weekly study minutes target</span>
            <input type="range" min={60} max={1200} step={30} value={weeklyMinutes} onChange={(e) => setWeeklyMinutes(Number(e.target.value))} className="w-full" />
            <p className="text-center font-mono text-sm mt-1">{weeklyMinutes} min/week (≈ {Math.round(weeklyMinutes / 7)} min/day)</p>
          </label>
          <button type="button" onClick={enroll} disabled={busy} className="w-full py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
            {busy ? 'Enrolling…' : 'Enrol & generate my plan'}
          </button>
        </section>
      )}

      <section>
        <h2 className="text-lg font-bold mb-2">Chapter map</h2>
        {subjects.length === 0 ? (
          <p className="text-sm text-gray-500">No subjects registered for this class yet.</p>
        ) : (
          <div className="space-y-3">
            {subjects.map((s) => {
              const list = chaptersBySubject[s.id] || [];
              return (
                <details key={s.id} className="rounded-2xl border-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                  <summary className="cursor-pointer p-3 font-bold capitalize text-sm flex items-center justify-between">
                    <span>
                      {s.subject_slug.replace('_', ' ')}
                      {s.textbook_title_romanized && <span className="text-xs text-gray-500 font-normal ml-2">— {s.textbook_title_romanized}</span>}
                    </span>
                    <span className="text-xs font-mono text-gray-500">{list.length || s.total_chapters || '?'} chapters</span>
                  </summary>
                  {list.length > 0 ? (
                    <ol className="p-3 pt-0 space-y-1 text-xs">
                      {list.map((c) => (
                        <li key={c.id} className="flex gap-2">
                          <span className="font-mono text-gray-500 w-6">{c.chapter_no}.</span>
                          <span className="flex-1">{c.title_en}{c.expected_hours ? ` · ~${c.expected_hours}h` : ''}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="p-3 pt-0 text-xs text-gray-500">Chapter list not yet seeded for this subject. Subject is registered.</p>
                  )}
                </details>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
