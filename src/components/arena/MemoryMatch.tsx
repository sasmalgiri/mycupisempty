'use client';

/**
 * Memory Match — working memory + interference resistance minigame.
 *
 * Mechanic: a grid of face-down cards. Tap two — if they match, they stay
 * up. If not, they flip back. Each round the grid grows: 6 → 8 → 10 → 12 → 14
 * cards. Goal is to clear each round. Time per peek is short to put working
 * memory under load.
 *
 * What it measures:
 *   - working memory capacity (largest set cleared)
 *   - efficiency (mean reveals to find each pair)
 *   - interference (confusing a new pair with a previously-seen one)
 *
 * Avoids dual-N-back's debunked transfer claim — we use Memory Match purely
 * as an in-the-moment WM probe, not a "training tool."
 */

import { useEffect, useRef, useState } from 'react';
import type { MemoryMatchSignals } from '@/lib/arena-signals';

interface Props {
  onComplete: (signals: MemoryMatchSignals, summary: { accuracy: number; rtP50: number; setSize: number; durationSec: number }) => void;
  onAbort?: () => void;
}

const SET_PROGRESSION = [6, 8, 10, 12, 14];
const FLIP_BACK_MS = 800;

const SYMBOLS = ['🐢', '🦋', '🌻', '⚓', '🍉', '🎈', '🪁', '🧊', '🔮', '🎭', '🪐', '🚂'];

interface Card {
  id: number;
  symbol: string;
  matched: boolean;
}

function buildSet(size: number): Card[] {
  const pairCount = size / 2;
  const symbols = [...SYMBOLS].sort(() => Math.random() - 0.5).slice(0, pairCount);
  const cards: Card[] = [];
  symbols.forEach((s, i) => {
    cards.push({ id: i * 2, symbol: s, matched: false });
    cards.push({ id: i * 2 + 1, symbol: s, matched: false });
  });
  // Shuffle
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export default function MemoryMatch({ onComplete, onAbort }: Props) {
  const [started, setStarted] = useState(false);
  const [setIdx, setSetIdx] = useState(0);
  const [cards, setCards] = useState<Card[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  // Track interference: symbols that were briefly revealed but already part of
  // a matched pair re-appearing in next set tests recall under interference.
  const seenSymbolsRef = useRef<Set<string>>(new Set());
  const interferenceErrorsRef = useRef<number>(0);
  const revealsThisSetRef = useRef<number>(0);
  const matchAttemptsRef = useRef<number>(0);
  const matchHitsRef = useRef<number>(0);
  const longestRunRef = useRef<number>(0);
  const currentRunRef = useRef<number>(0);
  const setSizesReachedRef = useRef<number[]>([]);
  const revealsByPairRef = useRef<number[]>([]);
  const startedAtRef = useRef<number>(0);
  const reactionsRef = useRef<number[]>([]);
  const lastTapRef = useRef<number>(0);

  const beginSet = (idx: number) => {
    const size = SET_PROGRESSION[idx];
    setCards(buildSet(size));
    setFlipped([]);
    setBusy(false);
    revealsThisSetRef.current = 0;
    setSizesReachedRef.current.push(size);
  };

  const start = () => {
    setStarted(true);
    startedAtRef.current = Date.now();
    lastTapRef.current = Date.now();
    beginSet(0);
  };

  const handleFlip = (id: number) => {
    if (busy) return;
    if (flipped.includes(id)) return;
    if (cards.find((c) => c.id === id)?.matched) return;

    const now = Date.now();
    reactionsRef.current.push(now - lastTapRef.current);
    lastTapRef.current = now;
    revealsThisSetRef.current += 1;

    const next = [...flipped, id];
    setFlipped(next);

    if (next.length === 2) {
      matchAttemptsRef.current += 1;
      const [aId, bId] = next;
      const a = cards.find((c) => c.id === aId)!;
      const b = cards.find((c) => c.id === bId)!;
      if (a.symbol === b.symbol) {
        // Match
        matchHitsRef.current += 1;
        currentRunRef.current += 1;
        if (currentRunRef.current > longestRunRef.current) longestRunRef.current = currentRunRef.current;
        seenSymbolsRef.current.add(a.symbol);
        revealsByPairRef.current.push(revealsThisSetRef.current);
        setCards((prev) => prev.map((c) => (c.id === aId || c.id === bId ? { ...c, matched: true } : c)));
        setFlipped([]);
        // Did we clear the set?
        setTimeout(() => {
          const allMatched = cards.every((c) =>
            c.id === aId || c.id === bId || c.matched
          );
          if (allMatched) {
            advanceSet();
          }
        }, 200);
      } else {
        // No match; possibly interference
        if (seenSymbolsRef.current.has(a.symbol) || seenSymbolsRef.current.has(b.symbol)) {
          interferenceErrorsRef.current += 1;
        }
        currentRunRef.current = 0;
        setBusy(true);
        setTimeout(() => {
          setFlipped([]);
          setBusy(false);
        }, FLIP_BACK_MS);
      }
    }
  };

  const advanceSet = () => {
    const next = setIdx + 1;
    if (next >= SET_PROGRESSION.length) {
      finishGame();
      return;
    }
    setSetIdx(next);
    beginSet(next);
  };

  const finishGame = () => {
    const trialsCompleted = matchAttemptsRef.current;
    const trialsCorrect = matchHitsRef.current;
    const accuracy = trialsCompleted > 0 ? trialsCorrect / trialsCompleted : 0;
    const sortedRt = [...reactionsRef.current].sort((a, b) => a - b);
    const rtP50 = sortedRt.length ? sortedRt[Math.floor(sortedRt.length / 2)] : 0;
    const meanReveals = revealsByPairRef.current.length > 0
      ? revealsByPairRef.current.reduce((a, b) => a + b, 0) / revealsByPairRef.current.length
      : 0;
    const setSizesReached = [...new Set(setSizesReachedRef.current)].sort((a, b) => a - b);
    const signals: MemoryMatchSignals = {
      trialsCompleted,
      trialsCorrect,
      setSizesReached,
      interferenceErrors: interferenceErrorsRef.current,
      meanRevealsToFind: Math.round(meanReveals * 10) / 10,
      longestRunWithoutMistake: longestRunRef.current,
    };
    const largest = setSizesReached.length ? setSizesReached[setSizesReached.length - 1] : 0;
    onComplete(signals, { accuracy, rtP50, setSize: largest, durationSec: Math.round((Date.now() - startedAtRef.current) / 1000) });
    setStarted(false);
  };

  // Auto-end if the student stalls for 60s with no progress.
  useEffect(() => {
    if (!started) return;
    const id = setInterval(() => {
      if (Date.now() - lastTapRef.current > 60_000) {
        clearInterval(id);
        finishGame();
      }
    }, 5_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  if (!started) {
    return (
      <div className="rounded-2xl border-2 border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 p-6">
        <h3 className="font-bold text-lg mb-2">🧠 Memory Match</h3>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
          Find the pairs. Each round the grid grows. The cards flip back fast — hold them in your head.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={start} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold">
            Start
          </button>
          {onAbort && (
            <button type="button" onClick={onAbort} className="px-3 py-2 text-xs text-gray-500 hover:text-gray-800">Skip</button>
          )}
        </div>
      </div>
    );
  }

  const cols = cards.length <= 8 ? 4 : cards.length <= 12 ? 4 : 5;

  return (
    <div className="rounded-2xl border-2 border-purple-200 dark:border-purple-800 bg-white dark:bg-gray-900 p-6">
      <div className="flex items-center justify-between mb-3 text-xs">
        <span className="font-mono text-gray-500">Round {setIdx + 1} / {SET_PROGRESSION.length}</span>
        <span className="font-mono text-gray-500">{cards.filter((c) => c.matched).length}/{cards.length} matched</span>
      </div>
      <div
        className={`grid gap-2 ${cols === 5 ? 'grid-cols-5' : 'grid-cols-4'}`}
      >
        {cards.map((c) => {
          const isUp = c.matched || flipped.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => handleFlip(c.id)}
              disabled={busy || c.matched}
              aria-label={`Card ${c.id + 1}`}
              className={`aspect-square rounded-lg border-2 text-2xl flex items-center justify-center transition-all ${
                isUp
                  ? c.matched
                    ? 'bg-emerald-100 border-emerald-400 dark:bg-emerald-900/30'
                    : 'bg-purple-100 border-purple-400 dark:bg-purple-900/30'
                  : 'bg-gray-100 border-gray-300 dark:bg-gray-800 dark:border-gray-700 hover:border-purple-400'
              }`}
            >
              {isUp ? c.symbol : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
}
