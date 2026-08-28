'use client';

/**
 * Today — the student's one screen.
 *
 * The founder's rule: never fragment the experience into separate tabs. So
 * this is not a dashboard of cards to pick from. It is a queue with a current
 * step, and the only real control is "done". What comes next is decided by the
 * engine, from the exam date, the review debt and what she has actually
 * retained — because a fourteen-year-old at 7pm choosing between eight tiles
 * will pick the subject she already likes and skip the review.
 *
 * Everything visible answers one of two questions: what now, and why this.
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, Button, LoadingSpinner } from '@/components/ui/index';

interface FlowStep {
  id: string;
  kind: 'probe' | 'review' | 'learn' | 'practice' | 'reflect' | 'break';
  title: string;
  why: string;
  minutes: number;
  href?: string;
  payload?: any;
}

interface TodayResponse {
  today: string;
  studentName: string | null;
  minutesAvailable: number;
  flow: {
    steps: FlowStep[];
    totalMinutes: number;
    headline: string;
    omitted: string[];
    mode: 'rest' | 'catch_up' | 'balanced' | 'push';
  };
  exam: {
    date: string; title: string | null; verdict: string;
    weeksAvailable: number; marksCovered: number; marksAtRisk: number; message: string;
  } | null;
}

const STEP_STYLE: Record<string, { icon: string; ring: string; accent: string }> = {
  probe:    { icon: '⏱️', ring: 'border-amber-500/40 bg-amber-900/10',   accent: 'text-amber-300' },
  review:   { icon: '🔁', ring: 'border-sky-500/40 bg-sky-900/10',       accent: 'text-sky-300' },
  learn:    { icon: '📘', ring: 'border-violet-500/40 bg-violet-900/10', accent: 'text-violet-300' },
  practice: { icon: '✏️', ring: 'border-emerald-500/40 bg-emerald-900/10', accent: 'text-emerald-300' },
  reflect:  { icon: '🪞', ring: 'border-gray-600 bg-gray-900/30',        accent: 'text-gray-300' },
  break:    { icon: '🌤️', ring: 'border-gray-700 bg-gray-900/20',        accent: 'text-gray-400' },
};

export default function TodayPage() {
  const [data, setData] = useState<TodayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [minutes, setMinutes] = useState<number | null>(null);

  const load = useCallback((mins?: number) => {
    setLoading(true); setError('');
    const q = mins ? `?minutes=${mins}` : '';
    fetch(`/api/today${q}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.success) throw new Error(j.error || 'Could not build today');
        setData(j);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const steps = data?.flow.steps ?? [];
  const current = steps.find((s) => !doneIds.has(s.id)) || null;
  const remaining = steps.filter((s) => !doneIds.has(s.id));
  const minutesLeft = remaining.reduce((s, x) => s + x.minutes, 0);

  const complete = (id: string) => setDoneIds((prev) => new Set(prev).add(id));

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto flex flex-col items-center py-20 gap-3">
        <LoadingSpinner size="lg" />
        <p className="text-sm text-gray-400">Working out what matters most today…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card className="p-5 border-red-500/30 bg-red-900/10">
          <p className="text-red-300 text-sm mb-3">{error}</p>
          <p className="text-xs text-gray-400">
            This usually means there is no exam date or syllabus set up yet.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Context: one line, not a dashboard */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-white mb-1">
          {data?.studentName ? `${data.studentName.split(' ')[0]}, ` : ''}
          {data?.flow.headline}
        </h1>
        {data?.exam && (
          <p className="text-xs text-gray-500">
            {data.exam.title || 'Exam'} · {data.exam.date} ·{' '}
            {Math.round(data.exam.weeksAvailable)} weeks · {data.exam.marksCovered}% of marks covered
            {data.exam.marksAtRisk > 0 && (
              <span className="text-amber-400"> · {data.exam.marksAtRisk}% at risk</span>
            )}
          </p>
        )}
      </div>

      {/* Progress rail — shape of the day, never a menu */}
      {steps.length > 0 && (
        <div className="flex gap-1 mb-6">
          {steps.map((s) => {
            const done = doneIds.has(s.id);
            const isCurrent = current?.id === s.id;
            return (
              <div
                key={s.id}
                title={s.title}
                className={`h-1.5 flex-1 rounded-full transition-all ${
                  done ? 'bg-green-500'
                    : isCurrent ? (STEP_STYLE[s.kind]?.accent || 'text-white').replace('text-', 'bg-')
                    : 'bg-gray-700'
                }`}
              />
            );
          })}
        </div>
      )}

      {/* The current step — the only thing she has to think about */}
      {current ? (
        <CurrentStep step={current} onDone={() => complete(current.id)} />
      ) : steps.length > 0 ? (
        <Card className="p-6 border-green-500/30 bg-green-900/10 text-center">
          <div className="text-3xl mb-2">✅</div>
          <h2 className="text-white font-semibold mb-1">That is today done.</h2>
          <p className="text-sm text-gray-300">
            {data?.flow.totalMinutes} minutes, in the order that keeps the most of it.
            Stopping here is the right call — more today would cost you tomorrow.
          </p>
        </Card>
      ) : (
        <Card className="p-6 text-center">
          <p className="text-gray-300 mb-2">Nothing is due today.</p>
          <p className="text-xs text-gray-500">
            {data?.flow.omitted.join(' · ') || 'Enjoy it.'}
          </p>
        </Card>
      )}

      {/* What is coming — visible but not selectable. No choices. */}
      {remaining.length > 1 && (
        <div className="mt-6">
          <p className="text-[10px] uppercase tracking-wide text-gray-600 mb-2">
            After that — {minutesLeft} min left
          </p>
          <div className="space-y-1.5">
            {remaining.slice(1, 5).map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-xs text-gray-500 px-3 py-2 rounded-lg bg-gray-900/30">
                <span className="opacity-60">{STEP_STYLE[s.kind]?.icon}</span>
                <span className="flex-1 truncate">{s.title}</span>
                <span className="opacity-50">{s.minutes}m</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Honesty about what was left out */}
      {data && data.flow.omitted.length > 0 && steps.length > 0 && (
        <div className="mt-6 border-l border-gray-700 pl-3 space-y-1">
          {data.flow.omitted.map((o, i) => (
            <p key={i} className="text-[11px] text-gray-500">Not today: {o}</p>
          ))}
        </div>
      )}

      {/* The one legitimate control: how long she actually has */}
      <div className="mt-8 pt-4 border-t border-gray-800">
        <p className="text-[11px] text-gray-600 mb-2">Got a different amount of time?</p>
        <div className="flex gap-2 flex-wrap">
          {[10, 20, 30, 45, 60].map((m) => (
            <button
              key={m}
              onClick={() => { setMinutes(m); setDoneIds(new Set()); load(m); }}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                minutes === m
                  ? 'border-primary-500 bg-primary-600/20 text-primary-200'
                  : 'border-gray-700 text-gray-400 hover:text-white'
              }`}
            >
              {m} min
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function CurrentStep({ step, onDone }: { step: FlowStep; onDone: () => void }) {
  const style = STEP_STYLE[step.kind] || STEP_STYLE.learn;
  const [busy, setBusy] = useState(false);

  // A probe is answered inline — it is one question, and bouncing her to
  // another screen for it is how probes end up unanswered.
  if (step.kind === 'probe') {
    const answer = async (score: number) => {
      setBusy(true);
      try {
        await fetch('/api/conversion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'resolve_probe',
            outcomeId: step.payload?.outcomeId,
            retentionScore: score,
          }),
        });
      } finally {
        setBusy(false);
        onDone();
      }
    };

    return (
      <Card className={`p-6 border ${style.ring}`}>
        <Header style={style} step={step} />
        <p className="text-lg text-white my-4">{step.payload?.question}</p>
        <p className="text-xs text-gray-400 mb-4">
          Answer honestly — a wrong answer here is more useful than a right one, because it
          tells us to teach it differently next time.
        </p>
        <div className="flex gap-2">
          <button onClick={() => answer(1)} disabled={busy}
            className="flex-1 py-2.5 rounded-lg bg-green-900/50 text-green-300 hover:bg-green-900 text-sm disabled:opacity-40">
            Still got it
          </button>
          <button onClick={() => answer(0.5)} disabled={busy}
            className="flex-1 py-2.5 rounded-lg bg-yellow-900/50 text-yellow-300 hover:bg-yellow-900 text-sm disabled:opacity-40">
            Half of it
          </button>
          <button onClick={() => answer(0)} disabled={busy}
            className="flex-1 py-2.5 rounded-lg bg-red-900/50 text-red-300 hover:bg-red-900 text-sm disabled:opacity-40">
            Gone
          </button>
        </div>
      </Card>
    );
  }

  if (step.kind === 'break') {
    return (
      <Card className={`p-6 border ${style.ring} text-center`}>
        <div className="text-3xl mb-2">{style.icon}</div>
        <h2 className="text-white font-semibold mb-1">{step.title}</h2>
        <p className="text-sm text-gray-400 max-w-md mx-auto mb-4">{step.why}</p>
        <Button onClick={onDone}>Back</Button>
      </Card>
    );
  }

  return (
    <Card className={`p-6 border ${style.ring}`}>
      <Header style={style} step={step} />
      <h2 className="text-xl font-semibold text-white mt-3 mb-2">{step.title}</h2>
      <p className="text-sm text-gray-300 leading-relaxed mb-5">{step.why}</p>

      <div className="flex gap-2 flex-wrap">
        {step.href && (
          <Link href={step.href}>
            <Button>Start · {step.minutes} min</Button>
          </Link>
        )}
        <button onClick={onDone}
          className="text-xs px-4 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white">
          Done
        </button>
      </div>
    </Card>
  );
}

function Header({ style, step }: { style: any; step: FlowStep }) {
  return (
    <div className="flex items-center gap-2">
      <span>{style.icon}</span>
      <span className={`text-xs font-semibold uppercase tracking-wide ${style.accent}`}>
        {step.kind === 'learn' ? 'Learn' : step.kind === 'review' ? 'Review'
          : step.kind === 'probe' ? 'Quick check' : step.kind}
      </span>
      <span className="text-xs text-gray-600">· {step.minutes} min</span>
    </div>
  );
}
