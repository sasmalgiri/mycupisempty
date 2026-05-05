'use client';

/**
 * Effort Curve — give a deliberately HARD problem with three escape routes:
 * "Hint", "Show answer", or just keep trying. The student's behaviour reveals
 * effort tolerance and perfectionism without us asking.
 *
 * Critical detail: there's no "skip" button. To leave you must either solve,
 * take a hint, or show the answer. That means the choice itself is signal.
 */

import { useEffect, useRef, useState } from 'react';
import type { EffortCurveSignals } from '@/lib/persona-games';

interface Props {
  onComplete: (signals: EffortCurveSignals, durationSec: number) => void;
  onSkip?: () => void;
}

// Hard puzzle — picking one that 30-50% of students solve in 60s without help.
// Anagram of "EDUCATION" with two extra distractor letters.
const ANSWER = 'EDUCATION';
const SHUFFLED = 'NUDOIATCXXE';
const HINT = 'It has 9 letters and starts with E.';

export default function EffortCurve({ onComplete, onSkip }: Props) {
  const [input, setInput] = useState('');
  const [hintShown, setHintShown] = useState(false);
  const [answerShown, setAnswerShown] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const startedAt = useRef<number>(Date.now());
  const lastSubmitRef = useRef<number>(0);
  const rapidRetriesRef = useRef<number>(0);

  const submit = () => {
    const now = Date.now();
    if (now - lastSubmitRef.current < 1000) rapidRetriesRef.current += 1;
    lastSubmitRef.current = now;
    setAttemptCount((n) => n + 1);
    const correct = input.trim().toUpperCase() === ANSWER;
    if (correct) {
      finish(true);
    } else {
      setFeedback('Not quite. Look at the letters again.');
    }
  };

  const finish = (correct: boolean) => {
    setDone(true);
    const duration = Math.round((Date.now() - startedAt.current) / 1000);
    onComplete({
      attemptedSeconds: duration,
      hintTaken: hintShown,
      showAnswer: answerShown,
      retried: attemptCount > 1,
      finalCorrect: correct,
      rapidRetries: rapidRetriesRef.current,
    }, duration);
  };

  // Soft 90s ceiling — auto-finish so we don't trap a student who tuned out.
  useEffect(() => {
    const id = setTimeout(() => { if (!done) finish(false); }, 90_000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (done) return null;

  return (
    <section className="rounded-2xl border-2 border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 p-5">
      <h3 className="font-bold text-base mb-1">🧩 Stuck Puzzle</h3>
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
        Unscramble the letters. Some letters are extra distractors. There&apos;s a 9-letter word hiding in there.
      </p>
      <p className="font-mono text-2xl text-center tracking-widest my-4 select-none">{SHUFFLED}</p>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Your answer…"
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm mb-2 font-mono uppercase"
      />
      {feedback && <p className="text-xs text-rose-700 mb-2">{feedback}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={!input.trim()} className="flex-1 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white rounded-lg text-sm font-semibold">
          Try ({attemptCount})
        </button>
        <button
          type="button"
          onClick={() => setHintShown(true)}
          disabled={hintShown}
          className="px-3 py-2 text-xs rounded-lg border border-orange-300 disabled:opacity-50"
        >
          💡 Hint
        </button>
        <button
          type="button"
          onClick={() => { setAnswerShown(true); setInput(ANSWER); }}
          disabled={answerShown}
          className="px-3 py-2 text-xs rounded-lg border border-rose-300 text-rose-700 disabled:opacity-50"
        >
          Show answer
        </button>
      </div>
      {hintShown && <p className="text-xs text-orange-700 mt-2">Hint: {HINT}</p>}
      {answerShown && (
        <button
          type="button"
          onClick={() => finish(false)}
          className="mt-3 w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold"
        >
          OK, move on
        </button>
      )}
      {onSkip && !answerShown && !hintShown && (
        <button type="button" onClick={onSkip} className="mt-2 text-xs text-gray-400 hover:text-gray-700">
          (no skip — pick hint or show-answer to leave)
        </button>
      )}
    </section>
  );
}
