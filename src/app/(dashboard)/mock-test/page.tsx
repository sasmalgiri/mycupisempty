'use client';

/**
 * Mock test home — pick a subject, generate a paper, sit it under timer.
 * Anti-cheat instrumentation reused from ExitEvalCard pattern.
 */

import { useEffect, useRef, useState } from 'react';

const SUBJECTS = ['math', 'physical_science', 'life_science', 'history', 'geography', 'english', 'bengali'];

interface MockTest {
  id: string;
  subject_slug: string;
  total_marks: number;
  duration_minutes: number;
  generated_at: string;
}

interface QuestionRow {
  id: string;
  question_text: string;
  question_type: string;
  marks: number;
  options: string[] | null;
}

export default function MockTestPage() {
  const [recent, setRecent] = useState<MockTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [activeTest, setActiveTest] = useState<{ mockTest: any; questions: QuestionRow[]; attemptId: string | null } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [result, setResult] = useState<{ totalAwarded: number; totalAvailable: number; perQuestion: Record<string, number> } | null>(null);
  const startedAtRef = useRef<number>(0);
  const blurCountRef = useRef<number>(0);
  const pasteCountRef = useRef<number>(0);

  const refresh = () => {
    fetch('/api/mock-test').then(r => r.json()).then(d => setRecent(d?.mockTests || [])).finally(() => setLoading(false));
  };
  useEffect(refresh, []);

  // Timer
  useEffect(() => {
    if (!activeTest || result) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(id); submit(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTest, result]);

  // Tab-blur tracking
  useEffect(() => {
    if (!activeTest || result) return;
    const onBlur = () => { blurCountRef.current += 1; };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [activeTest, result]);

  const create = async (subjectSlug: string) => {
    setBusy(true); setCreating(subjectSlug);
    try {
      const res = await fetch('/api/mock-test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', subjectSlug }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) { alert(json?.error || 'Could not create mock test.'); return; }
      // Fetch full test details
      const detailRes = await fetch(`/api/mock-test?id=${json.mockTest.id}`);
      const detail = await detailRes.json();
      // Open attempt
      const attRes = await fetch('/api/mock-test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_attempt', mockTestId: json.mockTest.id }),
      });
      const att = await attRes.json();
      setActiveTest({ mockTest: detail.mockTest, questions: detail.questions || [], attemptId: att.attempt?.id });
      setSecondsLeft(detail.mockTest.duration_minutes * 60);
      startedAtRef.current = Date.now();
      blurCountRef.current = 0;
      pasteCountRef.current = 0;
      setAnswers({});
      setResult(null);
    } finally {
      setBusy(false); setCreating(null);
    }
  };

  const submit = async () => {
    if (!activeTest?.attemptId) return;
    const durationSeconds = Math.round((Date.now() - startedAtRef.current) / 1000);
    const answersForApi: Record<string, any> = {};
    for (const [k, v] of Object.entries(answers)) answersForApi[k] = { answer: v };
    const res = await fetch('/api/mock-test', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'submit_attempt',
        attemptId: activeTest.attemptId,
        answers: answersForApi,
        durationSeconds,
        pasteCount: pasteCountRef.current,
        blurCount: blurCountRef.current,
      }),
    });
    const json = await res.json();
    if (json?.success) setResult({ totalAwarded: json.totalAwarded, totalAvailable: json.totalAvailable, perQuestion: json.perQuestion });
  };

  if (activeTest && !result) {
    const test = activeTest.mockTest;
    return (
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 py-2 -mx-4 sm:-mx-6 px-4 sm:px-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold capitalize">{test.subject_slug.replace('_', ' ')} mock · {test.total_marks} marks</p>
            <span className={`font-mono text-base ${secondsLeft < 300 ? 'text-rose-600' : 'text-gray-700 dark:text-gray-300'}`}>
              ⏱ {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
            </span>
          </div>
        </div>

        {activeTest.questions.map((q, idx) => (
          <article key={q.id} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <div className="flex items-start gap-2 mb-2">
              <span className="font-mono text-xs text-gray-500">Q{idx + 1}</span>
              <p className="flex-1 text-sm font-medium">{q.question_text}</p>
              <span className="text-[10px] font-mono text-gray-500 whitespace-nowrap">[{q.marks}m · {q.question_type}]</span>
            </div>
            {q.options && q.options.length > 0 ? (
              <div className="space-y-1 ml-7">
                {q.options.map((opt, i) => (
                  <label key={i} className="flex items-center gap-2 text-xs">
                    <input type="radio" name={`mock-${q.id}`} value={String(i)} checked={answers[q.id] === String(i)} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
                    {String.fromCharCode(97 + i)}) {opt}
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                value={answers[q.id] || ''}
                onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                onPaste={() => { pasteCountRef.current += 1; }}
                rows={q.question_type === 'long' ? 5 : 2}
                placeholder="Your answer…"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm ml-7"
                style={{ width: 'calc(100% - 1.75rem)' }}
              />
            )}
          </article>
        ))}

        <button type="button" onClick={submit} className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold">
          Submit paper
        </button>
      </div>
    );
  }

  if (result) {
    const pct = result.totalAvailable > 0 ? Math.round((result.totalAwarded / result.totalAvailable) * 100) : 0;
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-bold">Result</h1>
        <div className="p-6 rounded-2xl border-2 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30">
          <p className="text-4xl font-bold">{result.totalAwarded} / {result.totalAvailable}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{pct}%</p>
        </div>
        <button type="button" onClick={() => { setActiveTest(null); setResult(null); refresh(); }} className="w-full py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold">
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Mock test</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Sit a timed paper composed from the question bank. Every paper is unique. Anti-cheat tracks tab switches and pastes.
        </p>
      </div>

      <section>
        <h2 className="font-bold text-base mb-2">Start a new paper</h2>
        <div className="grid sm:grid-cols-3 gap-2">
          {SUBJECTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => create(s)}
              disabled={busy}
              className="text-left p-3 rounded-xl border-2 border-gray-200 dark:border-gray-800 hover:border-primary-400 disabled:opacity-50 capitalize text-sm font-semibold"
            >
              {creating === s ? 'Composing…' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-bold text-base mb-2">Recent papers</h2>
        {loading ? <p className="text-sm text-gray-500">Loading…</p>
          : recent.length === 0 ? <p className="text-sm text-gray-500">No papers yet — compose one above.</p>
          : (
            <ul className="space-y-1">
              {recent.map((mt) => (
                <li key={mt.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-gray-50 dark:bg-gray-900">
                  <span className="capitalize">{mt.subject_slug.replace('_', ' ')} · {mt.total_marks} marks · {mt.duration_minutes} min</span>
                  <span className="text-gray-500">{new Date(mt.generated_at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
      </section>
    </div>
  );
}
