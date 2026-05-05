'use client';

/**
 * Teacher Reports — pick a classroom, see a per-student rollup of weekly XP,
 * streak, honesty XP, character growth (last 7 days), and active stuck-detections.
 * Sorted by weekly XP so the teacher's eye lands on who's working most/least.
 */

import { useEffect, useState } from 'react';

interface Classroom {
  id: string; name: string; invite_code: string;
  class_level: number;
}

interface StudentRow {
  user_id: string;
  name: string;
  class_level: number;
  total_xp: number;
  current_streak: number;
  honesty_xp: number;
  weekly_xp: number;
  active_stuck_count: number;
  weekly_character_growth: number;
}

export default function TeacherReportsPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [picked, setPicked] = useState<Classroom | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/teacher/reports')
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) { setError(d.error); return; }
        setClassrooms(d?.classrooms || []);
        if (d?.classrooms?.length === 1) setPicked(d.classrooms[0]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!picked) return;
    setLoading(true);
    fetch(`/api/teacher/reports?classroomId=${picked.id}`)
      .then((r) => r.json())
      .then((d) => setStudents(d?.students || []))
      .finally(() => setLoading(false));
  }, [picked]);

  if (error) return <div className="p-6 text-sm text-rose-600">⚠ {error}</div>;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-600 mt-1 text-sm">Per-student weekly rollup. Pick a classroom to drill in.</p>
      </div>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <label htmlFor="classroom-select" className="text-xs font-bold uppercase tracking-wider text-gray-500">Classroom</label>
        <select id="classroom-select" value={picked?.id || ''} onChange={(e) => setPicked(classrooms.find((c) => c.id === e.target.value) || null)} className="ml-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm">
          <option value="">— select —</option>
          {classrooms.map((c) => (
            <option key={c.id} value={c.id}>{c.name} · {c.invite_code} (Class {c.class_level})</option>
          ))}
        </select>
      </section>

      {!picked && !loading && classrooms.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-sm text-gray-500">
          You don&apos;t own any classrooms yet. Create one from <a href="/teacher/classrooms/new" className="text-primary-600 hover:underline">/teacher/classrooms/new</a>.
        </div>
      )}

      {picked && loading && <p className="text-sm text-gray-500">Loading report…</p>}

      {picked && !loading && (
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-bold">{picked.name}</h2>
            <p className="text-xs text-gray-500">Class {picked.class_level} · {students.length} students</p>
          </div>
          {students.length === 0 ? (
            <p className="p-6 text-sm text-gray-500 text-center">No students have joined this classroom yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="text-left px-4 py-2">Student</th>
                    <th className="text-right px-3 py-2">Weekly XP</th>
                    <th className="text-right px-3 py-2">Streak</th>
                    <th className="text-right px-3 py-2">Honesty XP</th>
                    <th className="text-right px-3 py-2">Char. growth (7d)</th>
                    <th className="text-right px-3 py-2">Stuck</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {students.map((s) => (
                    <tr key={s.user_id} className={s.active_stuck_count > 0 ? 'bg-amber-50/50' : ''}>
                      <td className="px-4 py-2">
                        <a href={`/teacher/students/${s.user_id}`} className="font-medium text-gray-900 hover:text-primary-600">{s.name}</a>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{s.weekly_xp.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">🔥 {s.current_streak}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-600">{s.honesty_xp}</td>
                      <td className={`px-3 py-2 text-right font-mono ${s.weekly_character_growth > 0 ? 'text-emerald-600' : s.weekly_character_growth < 0 ? 'text-rose-600' : 'text-gray-400'}`}>
                        {s.weekly_character_growth > 0 ? `+${s.weekly_character_growth}` : s.weekly_character_growth}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {s.active_stuck_count > 0 ? <span className="text-amber-700 font-semibold">⚠ {s.active_stuck_count}</span> : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
