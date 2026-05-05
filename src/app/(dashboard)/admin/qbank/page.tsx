'use client';

/**
 * Admin coverage dashboard. Lists every chapter with current question count
 * vs target, plus per-chapter "Generate" button and a bulk run button.
 *
 * Role-gated by /api/qbank/generate + /api/qbank/bulk (both 403 for non-admin).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { totalForClass } from '@/lib/qbank-coverage';

interface CoverageRow {
  chapter_id: string;
  chapter_title: string;
  subject_slug: string;
  class_level: number;
  board_code: string;
  language: string;
  total_questions: number;
  mcq_count: number;
  very_short_count: number;
  short_count: number;
  long_count: number;
  hots_count: number;
  hard_count: number;
  verified_count: number;
  flagged_count: number;
}

export default function QbankAdminPage() {
  const [rows, setRows] = useState<CoverageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClass, setFilterClass] = useState<string>('all');
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const load = () => {
    setLoading(true);
    fetch('/api/admin/qbank-coverage')
      .then((r) => r.json())
      .then((d) => setRows(d?.rows || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const generate = async (chapterId: string) => {
    setBusy(true);
    setLogs((l) => [`Generating ${chapterId.slice(0, 8)}…`, ...l].slice(0, 30));
    try {
      const res = await fetch('/api/qbank/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterId }),
      });
      const json = await res.json();
      setLogs((l) => [`+${json?.generated || 0} → total ${json?.totalNow || 0}${json?.error ? ` · ${json.error}` : ''}`, ...l].slice(0, 30));
      load();
    } finally {
      setBusy(false);
    }
  };

  const bulkRun = async () => {
    setBusy(true);
    setLogs((l) => [`Bulk run · class=${filterClass}…`, ...l].slice(0, 30));
    try {
      const body: any = { limit: 6 };
      if (filterClass !== 'all') body.classLevel = Number(filterClass);
      const res = await fetch('/api/qbank/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      const lines = (json?.results || []).map((r: any) => `${r.chapter_title.slice(0, 40)}: +${r.generated}${r.error ? ` ✗ ${r.error}` : ''}`);
      setLogs((l) => [...lines, `(remaining: ${json?.remaining ?? '?'})`, ...l].slice(0, 50));
      load();
    } finally {
      setBusy(false);
    }
  };

  const filtered = rows.filter((r) => filterClass === 'all' || String(r.class_level) === filterClass);

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">QBank coverage (admin)</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Every chapter, current question count vs target, with per-chapter generator + bulk run. Admin / teacher role only.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <button type="button" onClick={() => setFilterClass('all')} className={`px-3 py-1 rounded-full text-xs font-medium border ${filterClass === 'all' ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-200 dark:border-gray-700'}`}>All</button>
        {[1,2,3,4,5,6,7,8,9,10].map((k) => (
          <button key={k} type="button" onClick={() => setFilterClass(String(k))} className={`px-3 py-1 rounded-full text-xs font-medium border ${filterClass === String(k) ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-200 dark:border-gray-700'}`}>
            Class {k}
          </button>
        ))}
        <button type="button" onClick={bulkRun} disabled={busy} className="ml-auto px-3 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold">
          {busy ? 'Running…' : 'Bulk-generate next 6'}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 text-center py-12">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-12">No chapters match.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr className="text-left">
                <th className="py-2 px-2">Class · Subject · Chapter</th>
                <th className="py-2 px-2 text-right">Total / Target</th>
                <th className="py-2 px-2">MCQ · VS · S · L · HOTS</th>
                <th className="py-2 px-2 text-right">Verified</th>
                <th className="py-2 px-2 text-right">Flags</th>
                <th className="py-2 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const target = totalForClass(r.class_level);
                const pct = target > 0 ? Math.round(((r.total_questions || 0) / target) * 100) : 100;
                const colour = pct >= 100 ? 'bg-emerald-200 text-emerald-900' : pct >= 50 ? 'bg-amber-200 text-amber-900' : 'bg-rose-200 text-rose-900';
                return (
                  <tr key={r.chapter_id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900">
                    <td className="py-2 px-2">
                      <p className="font-mono text-[10px] text-gray-500">cls {r.class_level} · {r.subject_slug} · {r.board_code}</p>
                      <p className="font-medium">{r.chapter_title}</p>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <span className={`px-2 py-0.5 rounded font-mono ${colour}`}>{r.total_questions || 0} / {target}</span>
                    </td>
                    <td className="py-2 px-2 font-mono">
                      {r.mcq_count} · {r.very_short_count} · {r.short_count} · {r.long_count} · {r.hots_count}
                    </td>
                    <td className="py-2 px-2 text-right font-mono">{r.verified_count}</td>
                    <td className="py-2 px-2 text-right font-mono text-rose-600">{r.flagged_count > 0 ? r.flagged_count : ''}</td>
                    <td className="py-2 px-2 text-right">
                      <Link href={`/courses/learn/${r.chapter_id}`} className="text-primary-600 hover:underline mr-2">View</Link>
                      <button type="button" onClick={() => generate(r.chapter_id)} disabled={busy} className="text-primary-600 hover:underline disabled:opacity-50">
                        Generate
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {logs.length > 0 && (
        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 p-3 bg-gray-50 dark:bg-gray-900 font-mono text-[11px]">
          <p className="font-bold mb-1">Activity</p>
          {logs.map((l, i) => <div key={i} className="text-gray-700 dark:text-gray-300">{l}</div>)}
        </section>
      )}
    </div>
  );
}
