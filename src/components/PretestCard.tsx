'use client';

/**
 * PretestCard — a 60-second 2-question warmup BEFORE the student sees a new
 * concept. Even when the student gets the answers wrong, the act of
 * attempting them primes encoding for the upcoming material.
 *
 * Evidence: Pan, Sana et al. 2023 meta-analysis of the prequestion effect:
 *   - Hedges' g = 0.54 for items specifically pretested (medium-large effect)
 *   - Hedges' g ≈ 0.04 for items NOT pretested but adjacent (no general boost)
 * Implication: pretests must probe THE SPECIFIC concept the lesson is about
 * to teach — they are not a generic warm-up. Feedback after the attempt is
 * the active ingredient (Richland, Kornell, Kao 2009).
 *
 * Design constraints:
 *   - Max 2 questions (any more is just a quiz, defeats the warm-up framing)
 *   - 60s soft timeout — student can stay longer, but the UI suggests moving on
 *   - Shows confidence rating after each answer (metacognition signal)
 *   - Reveals correct answer + brief reason after submit (the feedback)
 *   - Always proceeds to lesson regardless of score — wrong answers are FINE
 */

import { useEffect, useRef, useState } from 'react';

export interface PretestQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  /** One-line reason shown as feedback after answering. */
  reason: string;
}

interface Props {
  topicTitle: string;
  questions: PretestQuestion[];
  onComplete: (result: { correct: number; total: number; durationSec: number }) => void;
  onSkip?: () => void;
}

type Stage = 'intro' | 'asking' | 'feedback' | 'done';

export default function PretestCard({ topicTitle, questions, onComplete, onSkip }: Props) {
  const [stage, setStage] = useState<Stage>('intro');
  const [qIdx, setQIdx] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<'guess' | 'unsure' | 'sure' | null>(null);
  const [results, setResults] = useState<Array<{ correct: boolean; conf: string | null }>>([]);
  const startedAtRef = useRef<number>(Date.now());

  // 60s soft timer; doesn't force-advance, just nudges.
  const [secondsLeft, setSecondsLeft] = useState(60);
  useEffect(() => {
    if (stage !== 'asking') return;
    const id = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [stage]);

  const current = questions[qIdx];
  const total = questions.length;

  const handleStart = () => {
    setStage('asking');
    startedAtRef.current = Date.now();
  };

  const handleSubmit = () => {
    if (answer === null) return;
    const correct = answer === current.correctIndex;
    setResults((r) => [...r, { correct, conf: confidence }]);
    setStage('feedback');
  };

  const handleNext = () => {
    if (qIdx + 1 < total) {
      setQIdx((i) => i + 1);
      setAnswer(null);
      setConfidence(null);
      setStage('asking');
    } else {
      const correctCount = [...results, { correct: false, conf: null }].slice(0, total).filter((r) => r.correct).length;
      // recount including the just-finished question:
      const finalResults = results;  // already includes the last submit
      const finalCorrect = finalResults.filter((r) => r.correct).length;
      const durationSec = Math.round((Date.now() - startedAtRef.current) / 1000);
      setStage('done');
      onComplete({ correct: finalCorrect, total, durationSec });
    }
  };

  if (!current && stage !== 'done') return null;

  return (
    <section className="rounded-2xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/40 dark:to-indigo-950/40 dark:border-purple-800 p-5">
      {stage === 'intro' && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl" aria-hidden="true">🎯</span>
            <h3 className="text-base font-bold">Quick warm-up before learning</h3>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
            Two quick questions about <strong>{topicTitle}</strong>. <em>It&apos;s OK if you don&apos;t know the answers</em> — research shows even guessing primes your brain to learn the new material faster.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleStart}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold"
            >
              Start warm-up (60s)
            </button>
            {onSkip && (
              <button
                type="button"
                onClick={onSkip}
                className="px-3 py-2 text-xs text-gray-500 hover:text-gray-800"
              >
                Skip
              </button>
            )}
          </div>
        </>
      )}

      {stage === 'asking' && (
        <>
          <div className="flex items-center justify-between mb-2 text-xs text-gray-500">
            <span>Question {qIdx + 1} of {total}</span>
            <span className={secondsLeft < 15 ? 'text-amber-600' : ''}>{secondsLeft}s</span>
          </div>
          <p className="text-base font-semibold mb-3">{current.prompt}</p>
          <div className="space-y-2 mb-3">
            {current.options.map((opt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setAnswer(i)}
                className={`w-full text-left px-3 py-2 rounded-lg border-2 text-sm transition-colors ${
                  answer === i
                    ? 'border-purple-500 bg-purple-100 dark:bg-purple-900/30'
                    : 'border-gray-200 hover:border-purple-300 dark:border-gray-700'
                }`}
              >
                <span className="font-mono text-xs mr-2">{String.fromCharCode(65 + i)}</span>
                {opt}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mb-2">How sure are you?</p>
          <div className="flex gap-2 mb-3">
            {(['guess', 'unsure', 'sure'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setConfidence(c)}
                className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium border ${
                  confidence === c
                    ? 'border-purple-500 bg-purple-100 dark:bg-purple-900/30'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                {c === 'guess' && '🤷 Just guessing'}
                {c === 'unsure' && '🤔 Not sure'}
                {c === 'sure' && '💪 Pretty sure'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={answer === null}
            className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold"
          >
            Submit
          </button>
        </>
      )}

      {stage === 'feedback' && answer !== null && (
        <>
          <div className="flex items-center gap-2 mb-2">
            {answer === current.correctIndex ? (
              <>
                <span className="text-xl">✓</span>
                <h3 className="font-bold text-emerald-700 dark:text-emerald-300">Correct</h3>
              </>
            ) : (
              <>
                <span className="text-xl">→</span>
                <h3 className="font-bold text-amber-700 dark:text-amber-300">
                  The answer is <span className="font-mono">{String.fromCharCode(65 + current.correctIndex)}</span>
                </h3>
              </>
            )}
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{current.reason}</p>
          {answer !== current.correctIndex && confidence === 'sure' && (
            <p className="text-xs italic text-amber-600 mb-3">
              You were sure but it was off — that&apos;s exactly the kind of moment that makes the lesson stick. Watch for this pattern.
            </p>
          )}
          <button
            type="button"
            onClick={handleNext}
            className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold"
          >
            {qIdx + 1 < total ? 'Next question →' : 'Start lesson →'}
          </button>
        </>
      )}

      {stage === 'done' && (
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
          Warm-up complete. Loading lesson…
        </p>
      )}
    </section>
  );
}
