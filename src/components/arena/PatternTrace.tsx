'use client';

/**
 * Pattern Trace — visual processing speed minigame.
 *
 * Mechanic: a 3x3 grid blinks 3 cells in sequence, briefly. Student must
 * tap them in the same order. Sequence length grows by 1 every two correct
 * trials. Wrong = sequence length holds; two wrongs in a row → game ends.
 *
 * What it measures:
 *   - visual processing speed (median reaction time)
 *   - pattern memory (sequence length reached)
 *   - hesitation = "deliberate" vs "impulsive" tempo
 *
 * Anti-fakeable: a student can't fake sequence-length-reached without
 * actually tapping correctly. Random tapping converges fast to incorrect.
 */

import { useEffect, useRef, useState } from 'react';
import type { PatternTraceSignals } from '@/lib/arena-signals';

interface Props {
  onComplete: (signals: PatternTraceSignals, summary: { accuracy: number; rtP50: number; level: number; durationSec: number }) => void;
  onAbort?: () => void;
}

type Phase = 'intro' | 'showing' | 'recalling' | 'feedback' | 'done';

const GRID_SIZE = 3;
const FLASH_MS = 500;
const GAP_MS = 250;
const START_LEN = 3;
const MAX_LEN = 9;

function rand(n: number): number {
  return Math.floor(Math.random() * n);
}

function newSequence(len: number): number[] {
  const seq: number[] = [];
  for (let i = 0; i < len; i++) seq.push(rand(GRID_SIZE * GRID_SIZE));
  return seq;
}

export default function PatternTrace({ onComplete, onAbort }: Props) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [seq, setSeq] = useState<number[]>([]);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [tapped, setTapped] = useState<number[]>([]);
  const [trialsCompleted, setTrialsCompleted] = useState(0);
  const [trialsCorrect, setTrialsCorrect] = useState(0);
  const [highestLevel, setHighestLevel] = useState(START_LEN);
  const [wrongStreak, setWrongStreak] = useState(0);
  const startedAtRef = useRef<number>(Date.now());
  const trialStartRef = useRef<number>(0);
  const reactionsRef = useRef<number[]>([]);
  const hesitationsRef = useRef<number>(0);

  // Run the "show sequence" animation, then wait for taps.
  useEffect(() => {
    if (phase !== 'showing' || seq.length === 0) return;
    let cancelled = false;
    let i = 0;

    const step = () => {
      if (cancelled) return;
      if (i >= seq.length) {
        setHighlight(null);
        setPhase('recalling');
        trialStartRef.current = Date.now();
        return;
      }
      setHighlight(seq[i]);
      setTimeout(() => {
        if (cancelled) return;
        setHighlight(null);
        setTimeout(() => {
          i++;
          step();
        }, GAP_MS);
      }, FLASH_MS);
    };

    setTimeout(step, GAP_MS);
    return () => { cancelled = true; };
  }, [phase, seq]);

  const start = () => {
    const len = START_LEN;
    setSeq(newSequence(len));
    setTapped([]);
    setHighestLevel(len);
    setPhase('showing');
    startedAtRef.current = Date.now();
  };

  const handleTap = (idx: number) => {
    if (phase !== 'recalling') return;
    const now = Date.now();

    if (tapped.length === 0) {
      // First-tap reaction time per trial.
      const rt = now - trialStartRef.current;
      reactionsRef.current.push(rt);
      if (rt > 1500) hesitationsRef.current += 1;
    }

    const next = [...tapped, idx];
    setTapped(next);

    // Check correctness so far
    for (let i = 0; i < next.length; i++) {
      if (next[i] !== seq[i]) {
        // Wrong — finish trial as failed
        finishTrial(false);
        return;
      }
    }
    // Correct so far — if complete, win the trial
    if (next.length === seq.length) {
      finishTrial(true);
    }
  };

  const finishTrial = (correct: boolean) => {
    setTrialsCompleted((n) => n + 1);
    if (correct) setTrialsCorrect((n) => n + 1);

    const newWrongStreak = correct ? 0 : wrongStreak + 1;
    setWrongStreak(newWrongStreak);

    setPhase('feedback');
    setTimeout(() => {
      // End conditions: 2 wrong in a row or hit max length.
      if (newWrongStreak >= 2 || (correct && seq.length >= MAX_LEN)) {
        finishGame();
        return;
      }
      // Next trial: grow on every other correct trial, hold on wrong.
      const nextLen = correct && trialsCorrect % 2 === 1
        ? Math.min(MAX_LEN, seq.length + 1)
        : seq.length;
      setSeq(newSequence(nextLen));
      setTapped([]);
      setHighestLevel((cur) => Math.max(cur, nextLen));
      setPhase('showing');
    }, 700);
  };

  const finishGame = () => {
    setPhase('done');
    const durationSec = Math.round((Date.now() - startedAtRef.current) / 1000);
    const accuracy = trialsCompleted > 0 ? trialsCorrect / trialsCompleted : 0;
    const sortedRt = [...reactionsRef.current].sort((a, b) => a - b);
    const rtP50 = sortedRt.length ? sortedRt[Math.floor(sortedRt.length / 2)] : 0;

    const signals: PatternTraceSignals = {
      trialsCompleted,
      trialsCorrect,
      reactionTimesMs: reactionsRef.current.slice(0, 50),
      highestLevel,
      hesitationsBeforeFirstMove: hesitationsRef.current,
    };
    onComplete(signals, { accuracy, rtP50, level: highestLevel, durationSec });
  };

  if (phase === 'intro') {
    return (
      <div className="rounded-2xl border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 p-6">
        <h3 className="font-bold text-lg mb-2">🧩 Pattern Trace</h3>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
          Watch the cells light up. Tap them in the same order. The sequence grows.
          Two slips in a row ends the run.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={start} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold">
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
    <div className="rounded-2xl border-2 border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-900 p-6">
      <div className="flex items-center justify-between mb-3 text-xs">
        <span className="font-mono text-gray-500">Pattern length: {seq.length}</span>
        <span className="font-mono text-gray-500">{trialsCorrect}/{trialsCompleted} correct</span>
      </div>

      <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
        {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, idx) => {
          const isFlashing = highlight === idx && phase === 'showing';
          const isTapped = phase === 'recalling' && tapped.includes(idx);
          return (
            <button
              key={idx}
              type="button"
              aria-label={`Cell ${idx + 1}`}
              onClick={() => handleTap(idx)}
              disabled={phase !== 'recalling'}
              className={`aspect-square rounded-lg border-2 transition-all duration-150 ${
                isFlashing
                  ? 'bg-indigo-500 border-indigo-700 scale-105 shadow-lg shadow-indigo-400/40'
                  : isTapped
                    ? 'bg-indigo-200 border-indigo-400 dark:bg-indigo-900 dark:border-indigo-700'
                    : 'bg-gray-100 border-gray-300 dark:bg-gray-800 dark:border-gray-700 hover:border-indigo-400'
              }`}
            />
          );
        })}
      </div>

      <p className="text-xs text-gray-500 text-center mt-4">
        {phase === 'showing' && 'Watch the pattern…'}
        {phase === 'recalling' && 'Your turn — tap in order.'}
        {phase === 'feedback' && (wrongStreak === 0 ? '✓ Right' : '✗ That broke the run')}
      </p>
    </div>
  );
}
