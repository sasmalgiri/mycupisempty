'use client';

/**
 * SessionReflection — 15-second end-of-session pulse.
 *
 * Drop-in component. Fire when a session ends; after student answers it
 * closes and sends the reflection to /api/session-reflection.
 */

import { useState } from 'react';

interface Props {
  sessionKind: 'daily_mix' | 'companion_chat' | 'lab' | 'exam' | 'assignment';
  sessionId?: string;
  subjectId?: string;
  onDone?: () => void;
}

const USEFULNESS_EMOJI: Record<number, string> = {
  1: '😩', 2: '😐', 3: '🙂', 4: '😊', 5: '🤩',
};

export default function SessionReflection({ sessionKind, sessionId, subjectId, onDone }: Props) {
  const [stage, setStage] = useState<'rate' | 'detail' | 'done'>('rate');
  const [usefulness, setUsefulness] = useState<number | null>(null);
  const [difficultyFelt, setDifficultyFelt] = useState<string | null>(null);
  const [understood, setUnderstood] = useState('');
  const [confusing, setConfusing] = useState('');
  const [thanks, setThanks] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (usefulness == null) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/session-reflection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionKind,
          sessionId,
          subjectId,
          usefulness,
          difficultyFelt,
          understoodSomething: understood.slice(0, 300),
          stillConfusing: confusing.slice(0, 300),
        }),
      });
      const data = await res.json();
      setThanks(data.thanks || 'Thanks — noted.');
      setStage('done');
      setTimeout(() => onDone?.(), 1500);
    } catch {
      setThanks('Saved.');
      setStage('done');
      setTimeout(() => onDone?.(), 1500);
    } finally {
      setSubmitting(false);
    }
  };

  if (stage === 'done') {
    return (
      <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 text-center">
        <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">{thanks}</p>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border-2 border-primary-200 dark:border-primary-800">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-base">Quick pulse · 15 seconds</h3>
        <button
          type="button"
          onClick={() => onDone?.()}
          aria-label="Skip"
          className="text-xs text-gray-500 hover:text-gray-700"
        >Skip</button>
      </div>

      {stage === 'rate' && (
        <>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">How useful was that session?</p>
          <div className="flex gap-2 justify-between mb-4">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setUsefulness(n)}
                aria-label={`${n} of 5`}
                className={`flex-1 py-3 rounded-xl border-2 transition-all ${
                  usefulness === n
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/40 scale-105'
                    : 'border-gray-200 dark:border-gray-800 hover:border-primary-300'
                }`}
              >
                <div className="text-2xl">{USEFULNESS_EMOJI[n]}</div>
                <div className="text-[10px] text-gray-500 mt-1">{n}/5</div>
              </button>
            ))}
          </div>

          <p className="text-xs text-gray-500 mb-2">Difficulty felt:</p>
          <div className="flex gap-2 mb-4">
            {[
              { v: 'too_easy', label: 'Too easy' },
              { v: 'just_right', label: 'Just right' },
              { v: 'too_hard', label: 'Too hard' },
            ].map((d) => (
              <button
                key={d.v}
                type="button"
                onClick={() => setDifficultyFelt(d.v)}
                aria-label={d.label}
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                  difficultyFelt === d.v
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}
              >{d.label}</button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => usefulness != null ? setStage('detail') : undefined}
            disabled={usefulness == null}
            aria-label="Continue"
            className="w-full py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm"
          >Continue (optional detail)</button>
          <button
            type="button"
            onClick={submit}
            disabled={usefulness == null || submitting}
            aria-label="Submit without detail"
            className="w-full mt-2 py-2 bg-gray-100 dark:bg-gray-800 disabled:opacity-50 text-gray-700 dark:text-gray-300 rounded-lg text-sm"
          >Skip detail — submit</button>
        </>
      )}

      {stage === 'detail' && (
        <>
          <div className="mb-3">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Something that clicked today (optional)</label>
            <textarea
              value={understood}
              onChange={(e) => setUnderstood(e.target.value.slice(0, 300))}
              placeholder="e.g., I finally got how quadratic factorization works"
              aria-label="Something you understood"
              rows={2}
              className="w-full border border-gray-200 dark:border-gray-800 rounded-lg p-2 text-sm bg-white dark:bg-gray-950"
            />
          </div>
          <div className="mb-3">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Something still confusing (optional)</label>
            <textarea
              value={confusing}
              onChange={(e) => setConfusing(e.target.value.slice(0, 300))}
              placeholder="e.g., I'm not sure when to use the discriminant"
              aria-label="Something still confusing"
              rows={2}
              className="w-full border border-gray-200 dark:border-gray-800 rounded-lg p-2 text-sm bg-white dark:bg-gray-950"
            />
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            aria-label="Submit reflection"
            className="w-full py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm"
          >{submitting ? 'Saving…' : 'Submit'}</button>
        </>
      )}
    </div>
  );
}
