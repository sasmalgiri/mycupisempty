'use client';

/**
 * Three-bar rollup of summative-window syllabus coverage. The "Plan for this"
 * button replans the active enrollment with targetSummative=N so the next
 * /todays-plan focuses on chapters in that window only.
 */

import { useEffect, useState } from 'react';

interface Term {
  summativeNo: number;
  total: number;
  covered: number;
  pct: number;
  examWindow: { title: string; startDate: string; endDate: string } | null;
}

const TERM_LABEL: Record<number, string> = {
  1: '1st Summative',
  2: '2nd Summative / Half-yearly',
  3: 'Annual / 3rd Summative',
};

export default function TermProgressCard({ enrollmentId }: { enrollmentId: string }) {
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/term-progress')
      .then((r) => r.json())
      .then((d) => setTerms(d?.terms || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-4 text-xs text-gray-500">Loading term progress…</div>;
  if (terms.length === 0) return null;

  const replanForTerm = async (sn: number) => {
    setBusy(sn); setMsg(null);
    try {
      const res = await fetch('/api/plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'replan', enrollmentId, reason: `focus_summative_${sn}`, targetSummative: sn }),
      });
      const json = await res.json();
      if (json?.success) setMsg(`✅ Plan now scoped to Summative ${sn}. Refresh /daily-mix to see the focus.`);
      else setMsg(`❌ ${json?.error || 'Replan failed'}`);
    } finally { setBusy(null); }
  };

  return (
    <section className="rounded-2xl border-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
      <div>
        <h2 className="font-bold text-base">Term progress</h2>
        <p className="text-xs text-gray-600 dark:text-gray-400">Chapter coverage in each summative window. &quot;Plan for this&quot; narrows the planner to that term&apos;s syllabus.</p>
      </div>
      <div className="space-y-2">
        {terms.map((t) => (
          <div key={t.summativeNo} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold w-44 truncate">{TERM_LABEL[t.summativeNo]}</span>
              <div className="flex-1 h-2 bg-white dark:bg-gray-900 rounded-full overflow-hidden">
                <div
                  className={`h-full ${t.pct >= 70 ? 'bg-emerald-500' : t.pct >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`}
                  style={{ width: `${t.pct}%` }}
                />
              </div>
              <span className="font-mono text-[11px] w-16 text-right">{t.covered} / {t.total}</span>
              <button type="button" onClick={() => replanForTerm(t.summativeNo)} disabled={busy === t.summativeNo} className="text-[10px] px-2 py-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded font-semibold whitespace-nowrap">
                {busy === t.summativeNo ? '…' : 'Plan for this'}
              </button>
            </div>
            {t.examWindow && (
              <p className="text-[10px] text-gray-500 mt-1 ml-44">
                Exam window: {t.examWindow.startDate} → {t.examWindow.endDate}
              </p>
            )}
          </div>
        ))}
      </div>
      {msg && <p className="text-[11px]">{msg}</p>}
    </section>
  );
}
