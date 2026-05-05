'use client';

/**
 * Word Sprint — reading fluency + lexical access minigame.
 *
 * Mechanic: a word appears. Four short definitions below it. Pick the matching
 * one. Speeds up as the student keeps getting them right. 60 seconds total.
 *
 * What it measures:
 *   - reading fluency (words per minute on correct reads)
 *   - lexical recognition speed (median RT)
 *   - difficulty band reached (vocabulary depth)
 *
 * The word bank is intentionally small and seedable from props so we can
 * cycle in new banks without code changes (Phase 8 freshness pipeline can
 * insert grade-aligned banks). Default bank ships here for offline-first.
 */

import { useEffect, useRef, useState } from 'react';
import type { WordSprintSignals } from '@/lib/arena-signals';

interface WordItem {
  word: string;
  correct: string;
  distractors: [string, string, string];
  difficulty: 1 | 2 | 3 | 4 | 5;
}

interface Props {
  bank?: WordItem[];
  durationSec?: number;
  onComplete: (signals: WordSprintSignals, summary: { accuracy: number; rtP50: number; difficulty: number; durationSec: number }) => void;
  onAbort?: () => void;
}

// Default bank — covers Class 4-12 ranges. Can be replaced via props.
const DEFAULT_BANK: WordItem[] = [
  { word: 'rapid',     correct: 'very fast',          distractors: ['kind', 'sleepy', 'dry'],            difficulty: 1 },
  { word: 'enormous',  correct: 'extremely big',      distractors: ['tiny', 'broken', 'soft'],            difficulty: 1 },
  { word: 'fragile',   correct: 'easily broken',      distractors: ['heavy', 'noisy', 'sharp'],           difficulty: 2 },
  { word: 'curious',   correct: 'wanting to learn',   distractors: ['scared', 'wealthy', 'tired'],        difficulty: 2 },
  { word: 'reluctant', correct: 'unwilling',          distractors: ['eager', 'forgetful', 'rude'],        difficulty: 3 },
  { word: 'meticulous',correct: 'very careful',       distractors: ['careless', 'dishonest', 'gentle'],   difficulty: 3 },
  { word: 'verbose',   correct: 'using too many words', distractors: ['silent', 'angry', 'truthful'],     difficulty: 3 },
  { word: 'lucid',     correct: 'clear and easy to understand', distractors: ['confusing', 'painful', 'expensive'], difficulty: 4 },
  { word: 'pragmatic', correct: 'practical',          distractors: ['emotional', 'spiritual', 'imagined'], difficulty: 4 },
  { word: 'ephemeral', correct: 'lasting a short time', distractors: ['endless', 'invisible', 'familiar'], difficulty: 5 },
  { word: 'austere',   correct: 'plain and serious',  distractors: ['cheerful', 'generous', 'colourful'], difficulty: 5 },
  { word: 'placate',   correct: 'calm someone down',  distractors: ['provoke', 'ignore', 'tease'],        difficulty: 4 },
  { word: 'candid',    correct: 'honest and direct',  distractors: ['secretive', 'rude', 'shy'],          difficulty: 3 },
  { word: 'novel',     correct: 'new and different',  distractors: ['old-fashioned', 'expensive', 'broken'], difficulty: 2 },
  { word: 'ample',     correct: 'plenty',             distractors: ['scarce', 'sour', 'narrow'],          difficulty: 2 },
];

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pickItem(bank: WordItem[], targetDifficulty: number, recentlyUsed: Set<string>): WordItem {
  // Prefer items at the target difficulty; widen if we exhaust them.
  const tiers = [targetDifficulty, targetDifficulty - 1, targetDifficulty + 1, targetDifficulty - 2, targetDifficulty + 2]
    .filter((t) => t >= 1 && t <= 5);
  for (const t of tiers) {
    const candidates = bank.filter((b) => b.difficulty === t && !recentlyUsed.has(b.word));
    if (candidates.length) return candidates[Math.floor(Math.random() * candidates.length)];
  }
  // Last resort
  return bank[Math.floor(Math.random() * bank.length)];
}

export default function WordSprint({ bank = DEFAULT_BANK, durationSec = 60, onComplete, onAbort }: Props) {
  const [started, setStarted] = useState(false);
  const [item, setItem] = useState<WordItem | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(durationSec);
  const [trialsCompleted, setTrialsCompleted] = useState(0);
  const [trialsCorrect, setTrialsCorrect] = useState(0);
  const [difficultyTier, setDifficultyTier] = useState<number>(2);
  const [feedback, setFeedback] = useState<'right' | 'wrong' | null>(null);
  const trialStartRef = useRef<number>(0);
  const reactionsRef = useRef<number[]>([]);
  const recentlyUsedRef = useRef<Set<string>>(new Set());
  const correctStreakRef = useRef<number>(0);
  const startedAtRef = useRef<number>(0);
  const rereadsRef = useRef<number>(0);

  const nextTrial = (tier = difficultyTier) => {
    const next = pickItem(bank, tier, recentlyUsedRef.current);
    recentlyUsedRef.current.add(next.word);
    if (recentlyUsedRef.current.size > Math.max(3, Math.floor(bank.length / 2))) {
      recentlyUsedRef.current.clear();  // refresh pool
    }
    setItem(next);
    setOptions(shuffle([next.correct, ...next.distractors]));
    setFeedback(null);
    trialStartRef.current = Date.now();
  };

  const start = () => {
    setStarted(true);
    startedAtRef.current = Date.now();
    nextTrial();
  };

  // Countdown
  useEffect(() => {
    if (!started) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          finishGame();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  const handlePick = (opt: string) => {
    if (!item || feedback) return;
    const rt = Date.now() - trialStartRef.current;
    reactionsRef.current.push(rt);
    if (rt > 4000) rereadsRef.current += 1;
    const correct = opt === item.correct;
    setTrialsCompleted((n) => n + 1);
    if (correct) {
      setTrialsCorrect((n) => n + 1);
      correctStreakRef.current += 1;
      if (correctStreakRef.current >= 3 && difficultyTier < 5) {
        setDifficultyTier((t) => Math.min(5, t + 1));
        correctStreakRef.current = 0;
      }
    } else {
      correctStreakRef.current = 0;
      if (difficultyTier > 1) setDifficultyTier((t) => Math.max(1, t - 1));
    }
    setFeedback(correct ? 'right' : 'wrong');
    setTimeout(() => nextTrial(), 350);
  };

  const finishGame = () => {
    const accuracy = trialsCompleted > 0 ? trialsCorrect / trialsCompleted : 0;
    const elapsedMin = Math.max(0.1, (Date.now() - startedAtRef.current) / 60000);
    const wpm = trialsCorrect / elapsedMin;
    const sortedRt = [...reactionsRef.current].sort((a, b) => a - b);
    const rtP50 = sortedRt.length ? sortedRt[Math.floor(sortedRt.length / 2)] : 0;
    const signals: WordSprintSignals = {
      trialsCompleted,
      trialsCorrect,
      reactionTimesMs: reactionsRef.current.slice(0, 60),
      wordsRecognizedPerMinute: Math.round(wpm),
      difficultyReached: difficultyTier,
      rereadsDetected: rereadsRef.current,
    };
    onComplete(signals, { accuracy, rtP50, difficulty: difficultyTier, durationSec: Math.round(elapsedMin * 60) });
  };

  if (!started) {
    return (
      <div className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-6">
        <h3 className="font-bold text-lg mb-2">📚 Word Sprint</h3>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
          Match each word to its meaning. Get them right and the words get harder. {durationSec} seconds on the clock.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={start} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold">
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
    <div className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-white dark:bg-gray-900 p-6">
      <div className="flex items-center justify-between mb-3 text-xs">
        <span className={`font-mono ${secondsLeft < 15 ? 'text-amber-600' : 'text-gray-500'}`}>{secondsLeft}s</span>
        <span className="font-mono text-gray-500">tier {difficultyTier} · {trialsCorrect}/{trialsCompleted}</span>
      </div>

      {item && (
        <>
          <p className="text-3xl font-bold text-center mb-5">{item.word}</p>
          <div className="space-y-2">
            {options.map((opt) => {
              const isCorrect = item.correct === opt;
              let cls = 'border-gray-200 dark:border-gray-700 hover:border-emerald-400';
              if (feedback && isCorrect) cls = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/40';
              else if (feedback === 'wrong' && !isCorrect && opt !== item.correct) cls = 'border-rose-300 opacity-60';
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handlePick(opt)}
                  disabled={!!feedback}
                  className={`w-full text-left px-3 py-2 rounded-lg border-2 text-sm transition-colors ${cls}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
