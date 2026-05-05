'use client';

/**
 * 30-minute fixed daily routine. The pages it links to all exist already —
 * this page just gives the parent + student a single trustworthy sequence
 * with one progress bar. Each step is logged to topper_routine_log so the
 * dashboard can show "✅ 3/5 steps today".
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface StepLog {
  step: string;
  completed: boolean;
  duration_seconds: number | null;
}

const STEPS = [
  { id: 'flashcards',  icon: '🃏', label: 'Yesterday\'s flashcards', minutes: 5,  href: '/flashcards', why: 'FSRS review of due cards.' },
  { id: 'new_concept', icon: '🌱', label: 'One new chapter section', minutes: 10, href: '/daily-mix',  why: 'New material from current summative.' },
  { id: 'mixed',       icon: '🧩', label: 'One mixed-practice question', minutes: 5, href: '/interleave', why: 'Interleaved practice to fight forgetting.' },
  { id: 'past_paper',  icon: '📝', label: 'One past-paper question', minutes: 5, href: '/past-papers', why: 'Real exam exposure.' },
  { id: 'teach_back',  icon: '🎤', label: 'Teach it back to the companion', minutes: 5, href: '/companions', why: 'If you can\'t teach it, you don\'t know it.' },
] as const;

export default function TopperRoutinePage() {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => {
    fetch('/api/topper-routine')
      .then((r) => r.json())
      .then((d) => {
        const s = new Set<string>();
        for (const row of (d?.steps || []) as StepLog[]) if (row.completed) s.add(row.step);
        setDone(s);
      })
      .catch(() => {});
  };
  useEffect(refresh, []);

  const markDone = async (stepId: string) => {
    setBusy(stepId);
    try {
      await fetch('/api/topper-routine', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: stepId }),
      });
      refresh();
    } finally { setBusy(null); }
  };

  const completed = done.size;
  const totalMin = STEPS.reduce((s, x) => s + x.minutes, 0);
  const pct = Math.round((completed / STEPS.length) * 100);

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">🏆 Topper Routine</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {totalMin} minutes a day. The same five things, in the same order. This is what consistent toppers actually do — not more time, just better time.
        </p>
      </div>

      <section className="rounded-2xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden="true">{completed === STEPS.length ? '🌟' : '⏱'}</span>
          <div className="flex-1">
            <p className="text-sm font-bold">Today: {completed} / {STEPS.length} steps done</p>
            <div className="mt-1 h-2 bg-white dark:bg-gray-900 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
          {completed === STEPS.length && <span className="text-sm font-semibold text-amber-700">All done! 🎉</span>}
        </div>
      </section>

      <ol className="space-y-3">
        {STEPS.map((s, i) => {
          const isDone = done.has(s.id);
          return (
            <li key={s.id} className={`p-4 rounded-2xl border-2 ${isDone ? 'border-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/20' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'}`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden="true">{s.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">Step {i + 1} · {s.label}</p>
                  <p className="text-[11px] text-gray-500">{s.minutes} min · {s.why}</p>
                </div>
                {isDone ? (
                  <span className="text-emerald-600 font-bold text-sm">✓ Done</span>
                ) : (
                  <>
                    <Link href={s.href} className="text-xs px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded font-semibold whitespace-nowrap">
                      Open →
                    </Link>
                    <button type="button" onClick={() => markDone(s.id)} disabled={busy === s.id} className="text-[11px] px-2 py-1.5 text-gray-600 hover:text-emerald-700 disabled:opacity-50">
                      Mark done
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
