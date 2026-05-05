'use client';

/**
 * Number Snap — numerical fluency + WM-under-arithmetic-load minigame.
 *
 * Mechanic: a quick mental math problem appears. 4 numeric options. Speed
 * tier rises after every 3 correct in a row, falls after a wrong answer.
 * Carries (e.g. 17 + 8) are explicitly mixed in to probe working memory
 * separately from raw fluency.
 *
 * What it measures:
 *   - numerical fluency (accuracy + speed at each tier)
 *   - working memory under arithmetic load (carry accuracy specifically)
 *   - operation-specific weakness (which of +, -, ×, ÷ trips the student)
 *
 * Anti-fakeable: random tapping converges to 25%. To reach high tiers the
 * student has to be doing real arithmetic.
 */

import { useEffect, useRef, useState } from 'react';
import type { NumberSnapSignals } from '@/lib/arena-signals';

type Op = 'add' | 'sub' | 'mul' | 'div';

interface Problem {
  a: number;
  b: number;
  op: Op;
  answer: number;
  hasCarry: boolean;
}

interface Props {
  durationSec?: number;
  onComplete: (signals: NumberSnapSignals, summary: { accuracy: number; rtP50: number; tier: number; durationSec: number }) => void;
  onAbort?: () => void;
}

const SPEED_TIER_TIME_LIMITS: number[] = [10, 8, 6, 5, 4, 3];  // seconds per problem

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeProblem(tier: number): Problem {
  // Tier governs operand range and op mix.
  let a: number, b: number, op: Op, answer: number, hasCarry = false;
  if (tier <= 2) {
    op = (['add', 'sub'] as Op[])[rand(0, 1)];
  } else if (tier <= 4) {
    op = (['add', 'sub', 'mul'] as Op[])[rand(0, 2)];
  } else {
    op = (['add', 'sub', 'mul', 'div'] as Op[])[rand(0, 3)];
  }

  switch (op) {
    case 'add':
      a = rand(tier <= 2 ? 5 : 10, tier <= 2 ? 30 : 80);
      b = rand(tier <= 2 ? 5 : 10, tier <= 2 ? 30 : 80);
      hasCarry = (a % 10) + (b % 10) >= 10;
      answer = a + b;
      break;
    case 'sub':
      a = rand(tier <= 2 ? 15 : 30, tier <= 2 ? 50 : 120);
      b = rand(tier <= 2 ? 5 : 10, a - 1);
      hasCarry = a % 10 < b % 10;
      answer = a - b;
      break;
    case 'mul':
      a = rand(2, tier <= 4 ? 9 : 12);
      b = rand(2, tier <= 4 ? 9 : 15);
      answer = a * b;
      hasCarry = a >= 6 && b >= 6;
      break;
    case 'div':
      b = rand(2, 12);
      answer = rand(2, tier <= 4 ? 9 : 12);
      a = b * answer;
      hasCarry = false;
      break;
  }
  return { a, b, op, answer, hasCarry };
}

function makeOptions(answer: number): number[] {
  const set = new Set<number>([answer]);
  while (set.size < 4) {
    const delta = rand(1, Math.max(3, Math.floor(Math.abs(answer) * 0.25))) * (Math.random() < 0.5 ? -1 : 1);
    const candidate = answer + delta;
    if (candidate >= 0) set.add(candidate);
  }
  const arr = Array.from(set);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const OP_SYMBOL: Record<Op, string> = { add: '+', sub: '−', mul: '×', div: '÷' };

export default function NumberSnap({ durationSec = 60, onComplete, onAbort }: Props) {
  const [started, setStarted] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [options, setOptions] = useState<number[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(durationSec);
  const [tier, setTier] = useState(1);
  const [highestTier, setHighestTier] = useState(1);
  const [trialsCompleted, setTrialsCompleted] = useState(0);
  const [trialsCorrect, setTrialsCorrect] = useState(0);
  const [feedback, setFeedback] = useState<'right' | 'wrong' | null>(null);
  const trialStartRef = useRef<number>(0);
  const startedAtRef = useRef<number>(0);
  const reactionsRef = useRef<number[]>([]);
  const errorsByOpRef = useRef<Record<Op, number>>({ add: 0, sub: 0, mul: 0, div: 0 });
  const carriesAttemptedRef = useRef<number>(0);
  const carriesCorrectRef = useRef<number>(0);
  const correctStreakRef = useRef<number>(0);

  const nextTrial = (t: number) => {
    const p = makeProblem(t);
    setProblem(p);
    setOptions(makeOptions(p.answer));
    setFeedback(null);
    trialStartRef.current = Date.now();
  };

  const start = () => {
    setStarted(true);
    startedAtRef.current = Date.now();
    nextTrial(1);
  };

  useEffect(() => {
    if (!started) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(id); finishGame(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  const handlePick = (opt: number) => {
    if (!problem || feedback) return;
    const rt = Date.now() - trialStartRef.current;
    reactionsRef.current.push(rt);
    const correct = opt === problem.answer;
    setTrialsCompleted((n) => n + 1);
    if (correct) {
      setTrialsCorrect((n) => n + 1);
      correctStreakRef.current += 1;
    } else {
      errorsByOpRef.current[problem.op] += 1;
      correctStreakRef.current = 0;
    }
    if (problem.hasCarry) {
      carriesAttemptedRef.current += 1;
      if (correct) carriesCorrectRef.current += 1;
    }
    let nextTier = tier;
    if (correct && correctStreakRef.current >= 3) {
      nextTier = Math.min(SPEED_TIER_TIME_LIMITS.length, tier + 1);
      correctStreakRef.current = 0;
    } else if (!correct && tier > 1) {
      nextTier = Math.max(1, tier - 1);
    }
    if (nextTier !== tier) setTier(nextTier);
    if (nextTier > highestTier) setHighestTier(nextTier);
    setFeedback(correct ? 'right' : 'wrong');
    setTimeout(() => nextTrial(nextTier), 280);
  };

  const finishGame = () => {
    const accuracy = trialsCompleted > 0 ? trialsCorrect / trialsCompleted : 0;
    const sortedRt = [...reactionsRef.current].sort((a, b) => a - b);
    const rtP50 = sortedRt.length ? sortedRt[Math.floor(sortedRt.length / 2)] : 0;
    const signals: NumberSnapSignals = {
      trialsCompleted,
      trialsCorrect,
      reactionTimesMs: reactionsRef.current.slice(0, 80),
      highestSpeedTier: highestTier,
      errorsByOperation: errorsByOpRef.current,
      carriesAttempted: carriesAttemptedRef.current,
      carriesCorrect: carriesCorrectRef.current,
    };
    onComplete(signals, { accuracy, rtP50, tier: highestTier, durationSec: Math.round((Date.now() - startedAtRef.current) / 1000) });
  };

  if (!started) {
    return (
      <div className="rounded-2xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-6">
        <h3 className="font-bold text-lg mb-2">⚡ Number Snap</h3>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
          Quick mental math. {durationSec} seconds. Three correct in a row and the speed jumps up.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={start} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold">
            Start
          </button>
          {onAbort && (
            <button type="button" onClick={onAbort} className="px-3 py-2 text-xs text-gray-500 hover:text-gray-800">Skip</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-900 p-6">
      <div className="flex items-center justify-between mb-3 text-xs">
        <span className={`font-mono ${secondsLeft < 15 ? 'text-amber-600' : 'text-gray-500'}`}>{secondsLeft}s</span>
        <span className="font-mono text-gray-500">tier {tier} · {trialsCorrect}/{trialsCompleted}</span>
      </div>

      {problem && (
        <>
          <p className="text-4xl font-mono font-bold text-center my-6">
            {problem.a} {OP_SYMBOL[problem.op]} {problem.b} = ?
          </p>
          <div className="grid grid-cols-2 gap-2">
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => handlePick(opt)}
                disabled={!!feedback}
                className={`py-3 rounded-lg border-2 text-lg font-mono font-bold transition-colors ${
                  feedback && opt === problem.answer
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/40'
                    : feedback === 'wrong' && opt !== problem.answer
                      ? 'border-rose-300 opacity-50'
                      : 'border-gray-200 dark:border-gray-700 hover:border-amber-400'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
