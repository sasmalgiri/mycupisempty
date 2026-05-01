'use client';

/**
 * Interleaved Practice — short page that lets a student opt into a 9-question
 * mixed set across their 3 weakest topics. The interleaving itself happens
 * server-side in /api/interleaved-mix; this page just renders the items in
 * order, collects answers, and shows a results summary.
 *
 * Pedagogical note for the student is shown up-front so they know WHY this
 * feels harder than blocked practice (the "fluency illusion" of blocked
 * practice is part of why interleaving works — see Bjork's "desirable
 * difficulties").
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Item {
  id: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation: string | null;
  topic_id: string;
  topic_title: string;
  subject_id: string;
}

interface ApiResponse {
  success: boolean;
  items: Item[];
  topics: Array<{ id: string; title: string; subject_id: string; band: string }>;
  rationale?: string;
  reason?: string;
}

export default function InterleavedPracticePage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<Array<{ id: string; correct: boolean; topic: string }>>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch('/api/interleaved-mix')
      .then((r) => r.json())
      .then((d: ApiResponse) => setData(d))
      .catch(() => setData({ success: false, items: [], topics: [], reason: 'Could not load practice.' }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="max-w-2xl mx-auto p-8 text-center text-gray-500">Loading mixed practice…</div>;
  }

  if (!data?.items?.length) {
    return (
      <div className="max-w-2xl mx-auto p-6 sm:p-8">
        <div className="rounded-2xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 p-8 text-center">
          <div className="text-5xl mb-3">🧩</div>
          <h1 className="text-xl font-bold mb-2">Mixed practice not ready yet</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {data?.reason || 'You need at least a couple of weak topics on record before we can build a mixed set. Run a Daily Mix or two first.'}
          </p>
          <Link href="/daily-mix" className="inline-block px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold">
            Open Daily Mix
          </Link>
        </div>
      </div>
    );
  }

  const item = data.items[idx];

  const submit = () => {
    if (!item || answer == null) return;
    const correct = answer === item.correct_answer;
    setResults((r) => [...r, { id: item.id, correct, topic: item.topic_title }]);
    setSubmitted(true);
  };

  const next = () => {
    if (idx + 1 < data.items.length) {
      setIdx(idx + 1);
      setAnswer(null);
      setSubmitted(false);
    } else {
      setDone(true);
    }
  };

  if (done) {
    const correctCount = results.filter((r) => r.correct).length;
    const byTopic: Record<string, { right: number; total: number }> = {};
    for (const r of results) {
      byTopic[r.topic] = byTopic[r.topic] || { right: 0, total: 0 };
      byTopic[r.topic].total += 1;
      if (r.correct) byTopic[r.topic].right += 1;
    }
    return (
      <div className="max-w-2xl mx-auto p-6 sm:p-8">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 p-6">
          <h1 className="text-2xl font-bold mb-2">{correctCount}/{results.length} correct</h1>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
            Mixed practice is harder in the moment, but research shows it sticks ~30% better at 30 days than drilling one topic at a time. The discomfort is the point.
          </p>
          <div className="space-y-2 mb-4">
            {Object.entries(byTopic).map(([topic, stats]) => (
              <div key={topic} className="flex items-center justify-between text-sm">
                <span className="font-medium">{topic}</span>
                <span className={stats.right === stats.total ? 'text-emerald-600' : stats.right === 0 ? 'text-rose-600' : 'text-amber-600'}>
                  {stats.right}/{stats.total}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard" className="flex-1 text-center py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold">
              Back to dashboard
            </Link>
            <Link href="/interleave" className="flex-1 text-center py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-semibold">
              Another set
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="text-xl sm:text-2xl font-bold">Mixed Practice</h1>
        <p className="text-xs text-gray-500 mt-1">
          {data.topics.map((t) => t.title).filter(Boolean).join(' · ')}
        </p>
      </div>

      {idx === 0 && data.rationale && !submitted && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
          <strong>Why this might feel hard:</strong> {data.rationale}
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <div className="flex items-center justify-between mb-3 text-xs">
          <span className="text-gray-500">Question {idx + 1} of {data.items.length}</span>
          <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-[10px] font-semibold">
            {item.topic_title}
          </span>
        </div>

        <p className="text-base font-semibold mb-4">{item.question_text}</p>

        <div className="space-y-2 mb-4">
          {item.options.map((opt, i) => {
            const isPicked = answer === opt;
            const isCorrect = opt === item.correct_answer;
            let className = 'border-gray-200 dark:border-gray-700 hover:border-primary-300';
            if (submitted && isCorrect) className = 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30';
            else if (submitted && isPicked && !isCorrect) className = 'border-rose-400 bg-rose-50 dark:bg-rose-900/30';
            else if (isPicked) className = 'border-primary-400 bg-primary-50 dark:bg-primary-900/30';
            return (
              <button
                key={i}
                type="button"
                onClick={() => !submitted && setAnswer(opt)}
                disabled={submitted}
                className={`w-full text-left px-3 py-2 rounded-lg border-2 text-sm transition-colors ${className}`}
              >
                <span className="font-mono text-xs mr-2">{String.fromCharCode(65 + i)}</span>
                {opt}
              </button>
            );
          })}
        </div>

        {submitted && item.explanation && (
          <div className="p-3 mb-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-sm">
            {item.explanation}
          </div>
        )}

        {!submitted ? (
          <button
            type="button"
            onClick={submit}
            disabled={answer == null}
            className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold"
          >
            Submit
          </button>
        ) : (
          <button
            type="button"
            onClick={next}
            className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold"
          >
            {idx + 1 < data.items.length ? 'Next' : 'See results'} →
          </button>
        )}
      </div>
    </div>
  );
}
