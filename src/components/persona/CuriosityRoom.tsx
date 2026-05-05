'use client';

/**
 * Curiosity Room — drop the student into a "room" with several click-targets.
 * No goal, no time pressure. We watch what they explore, in what order,
 * and how long they linger. Reveals curiosity_breadth and decision_tempo.
 */

import { useEffect, useRef, useState } from 'react';
import type { CuriosityRoomSignals } from '@/lib/persona-games';

interface Props {
  onComplete: (signals: CuriosityRoomSignals, durationSec: number) => void;
  onSkip?: () => void;
}

interface Item {
  id: string;
  emoji: string;
  label: string;
  reveal: string;
}

const ITEMS: Item[] = [
  { id: 'window',    emoji: '🪟', label: 'window',         reveal: 'You watch a kingfisher dive once.' },
  { id: 'bookshelf', emoji: '📚', label: 'bookshelf',      reveal: 'A book on origami catches your eye.' },
  { id: 'chest',     emoji: '🧰', label: 'old chest',      reveal: 'Inside: a pocket watch, frozen at 7:13.' },
  { id: 'plant',     emoji: '🪴', label: 'plant',          reveal: 'Its leaves close when you breathe near them.' },
  { id: 'door',      emoji: '🚪', label: 'small door',     reveal: 'Locked. You try anyway. It rattles.' },
  { id: 'painting',  emoji: '🖼️', label: 'painting',       reveal: 'A river. The brushwork looks alive.' },
  { id: 'desk',      emoji: '🪑', label: 'desk',           reveal: 'Notebook open to: "begin with the smallest piece."' },
  { id: 'lamp',      emoji: '🪔', label: 'lamp',           reveal: 'Warm glow. The room shifts colour.' },
];

export default function CuriosityRoom({ onComplete, onSkip }: Props) {
  const [clicked, setClicked] = useState<string[]>([]);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const startedAt = useRef<number>(Date.now());
  const lastClickRef = useRef<number>(Date.now());
  const lingerTimesRef = useRef<number[]>([]);

  const click = (id: string) => {
    const now = Date.now();
    if (clicked.length > 0) lingerTimesRef.current.push(now - lastClickRef.current);
    lastClickRef.current = now;
    if (!clicked.includes(id)) setClicked([...clicked, id]);
    const item = ITEMS.find((x) => x.id === id);
    if (item) setRevealed({ ...revealed, [id]: item.reveal });
  };

  const finish = (finished: boolean) => {
    const meanLinger = lingerTimesRef.current.length > 0
      ? lingerTimesRef.current.reduce((a, b) => a + b, 0) / lingerTimesRef.current.length
      : 0;
    onComplete({
      itemsClicked: clicked,
      uniqueAreas: new Set(clicked).size,
      meanLingerMs: Math.round(meanLinger),
      finishedExploring: finished,
    }, Math.round((Date.now() - startedAt.current) / 1000));
  };

  // Auto-end at 75s
  useEffect(() => {
    const id = setTimeout(() => finish(false), 75_000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="rounded-2xl border-2 border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 p-5">
      <h3 className="font-bold text-base mb-1">🔍 The Curious Room</h3>
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
        You&apos;ve walked into an old room. No goal, no rush. Click anything that catches your eye.
      </p>
      <div className="grid grid-cols-4 gap-2 mb-4">
        {ITEMS.map((item) => {
          const seen = clicked.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => click(item.id)}
              className={`p-3 rounded-xl text-center border transition-all ${
                seen
                  ? 'border-violet-400 bg-violet-100 dark:bg-violet-900/50'
                  : 'border-gray-200 dark:border-gray-700 hover:border-violet-300'
              }`}
            >
              <div className="text-2xl">{item.emoji}</div>
              <div className="text-[10px] text-gray-500 mt-1">{item.label}</div>
            </button>
          );
        })}
      </div>
      <div className="space-y-1 mb-4 max-h-32 overflow-y-auto text-xs text-gray-700 dark:text-gray-300">
        {clicked.map((id) => (
          <p key={id}>• {revealed[id]}</p>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => finish(true)} className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-semibold">
          Step out of the room
        </button>
        {onSkip && <button type="button" onClick={onSkip} className="px-3 py-2 text-xs text-gray-500 hover:text-gray-800">Skip</button>}
      </div>
    </section>
  );
}
