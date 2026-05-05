'use client';

/**
 * Student-facing past-papers browser. Filters by board+class+subject and
 * lists imported papers; clicking a paper takes the student to the mock-test
 * page seeded from that paper's questions (qbank rows tagged source='past_paper').
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';

interface Paper {
  id: string;
  exam_label: string;
  board_code: string;
  class_level: number;
  subject_slug: string;
  year: number;
  total_marks: number | null;
  duration_minutes: number | null;
  language: string;
  source_url: string | null;
}

const SUBJECTS = ['math', 'physical_science', 'life_science', 'science', 'history', 'geography', 'english', 'bengali', 'physics', 'chemistry', 'biology'];

export default function PastPapersPage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<{ class_level: number | null; board_code: string | null }>({ class_level: null, board_code: null });
  const [subject, setSubject] = useState('all');

  useEffect(() => {
    (async () => {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('current_class, board_code')
          .eq('id', user.id)
          .single() as any;
        setMe({ class_level: profile?.current_class || null, board_code: profile?.board_code || null });
      }
    })();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (me.board_code) params.set('board', me.board_code === 'wb_board' ? 'wbbse' : me.board_code);
    if (me.class_level) params.set('class', String(me.class_level));
    if (subject !== 'all') params.set('subject', subject);
    setLoading(true);
    fetch(`/api/past-papers?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setPapers(d?.papers || []))
      .catch(() => setPapers([]))
      .finally(() => setLoading(false));
  }, [me, subject]);

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Past papers</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Real published board papers. Sit them as a timed mock test, or browse questions topic-by-topic.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="subject-filter" className="text-xs font-bold uppercase text-gray-500">Subject</label>
        <select id="subject-filter" value={subject} onChange={(e) => setSubject(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
          <option value="all">All</option>
          {SUBJECTS.map((s) => <option key={s} value={s} className="capitalize">{s.replace('_', ' ')}</option>)}
        </select>
        <Link href="/mock-test" className="ml-auto text-xs text-primary-600 hover:underline">Compose mock test →</Link>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : papers.length === 0 ? (
        <div className="p-6 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 text-center">
          <p className="text-sm text-gray-500">No past papers indexed yet for your class+board.</p>
          <p className="text-xs text-gray-400 mt-1">Admins are still importing them; check back soon.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {papers.map((p) => (
            <li key={p.id} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">{p.exam_label}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {p.board_code.toUpperCase()} · Class {p.class_level} · {p.subject_slug.replace('_', ' ')} · {p.total_marks ?? '?'} marks · {p.duration_minutes ?? '?'} min · {p.language}
                  </p>
                </div>
                <Link href={`/mock-test?subject=${encodeURIComponent(p.subject_slug)}`} className="text-[11px] px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded font-semibold whitespace-nowrap">
                  Sit a mock →
                </Link>
                {p.source_url && (
                  <a href={p.source_url} target="_blank" rel="noreferrer" className="text-[11px] text-gray-500 hover:underline whitespace-nowrap">Source</a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
