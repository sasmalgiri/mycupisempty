'use client';

/**
 * Island Choice — pick the islands that pull you in. The choices reveal
 * risk tolerance, social orientation, and curiosity breadth without ever
 * asking the student to label themselves.
 */

import { useRef, useState } from 'react';
import type { IslandChoiceSignals } from '@/lib/persona-games';

interface Props {
  onComplete: (signals: IslandChoiceSignals, durationSec: number) => void;
  onSkip?: () => void;
}

interface Island {
  id: string;
  name: string;
  icon: string;
  caption: string;
}

const ISLANDS: Island[] = [
  { id: 'volcano',  name: 'Volcano Peak',  icon: '🌋', caption: 'High up, hot, exciting and dangerous.' },
  { id: 'reef',     name: 'Coral Reef',    icon: '🪸', caption: 'Dive in. Discover what hides.' },
  { id: 'library',  name: 'Old Library',   icon: '📚', caption: 'Quiet halls. Books with answers.' },
  { id: 'market',   name: 'Bazaar Town',   icon: '🛍️', caption: 'Crowds, voices, finds.' },
  { id: 'forest',   name: 'Tangle Forest', icon: '🌳', caption: 'Off-trail. Many paths.' },
  { id: 'beach',    name: 'Calm Beach',    icon: '🏖️', caption: 'Soft sand. People around.' },
  { id: 'ruins',    name: 'Mystic Ruins',  icon: '🏛️', caption: 'Old, weird, half-known.' },
  { id: 'garden',   name: 'Walled Garden', icon: '🌷', caption: 'Tidy paths. Familiar.' },
  { id: 'mountain', name: 'Cold Summit',   icon: '🏔️', caption: 'Long hike. Big view.' },
];

export default function IslandChoice({ onComplete, onSkip }: Props) {
  const [picked, setPicked] = useState<string[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const startedAt = useRef<number>(Date.now());
  const lastTickRef = useRef<number>(Date.now());
  const pickOrderRef = useRef<number[]>([]);

  const togglePick = (id: string) => {
    if (picked.includes(id)) {
      setPicked(picked.filter((x) => x !== id));
    } else {
      const now = Date.now();
      pickOrderRef.current.push(now - lastTickRef.current);
      lastTickRef.current = now;
      setPicked([...picked, id]);
      setRejected(rejected.filter((x) => x !== id));
    }
  };

  const reject = (id: string) => {
    if (!rejected.includes(id)) setRejected([...rejected, id]);
    if (picked.includes(id)) setPicked(picked.filter((x) => x !== id));
  };

  const submit = () => {
    onComplete({
      islandsPicked: picked,
      pickOrderMs: pickOrderRef.current,
      rejectedFirst: rejected,
    }, Math.round((Date.now() - startedAt.current) / 1000));
  };

  return (
    <section className="rounded-2xl border-2 border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/30 p-5">
      <h3 className="font-bold text-base mb-1">🏝 Island Hop</h3>
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
        Tap the islands that pull you in. Long-press one to push it away. Pick at least 2 — there&apos;s no right answer.
      </p>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {ISLANDS.map((island) => {
          const isPicked = picked.includes(island.id);
          const isRejected = rejected.includes(island.id);
          return (
            <button
              key={island.id}
              type="button"
              onClick={() => togglePick(island.id)}
              onContextMenu={(e) => { e.preventDefault(); reject(island.id); }}
              className={`p-3 rounded-xl text-left border-2 transition-all ${
                isPicked
                  ? 'border-cyan-500 bg-cyan-100 dark:bg-cyan-900/50'
                  : isRejected
                    ? 'border-rose-300 bg-rose-50 dark:bg-rose-950/30 opacity-50'
                    : 'border-gray-200 dark:border-gray-800 hover:border-cyan-300'
              }`}
            >
              <div className="text-2xl mb-1">{island.icon}</div>
              <div className="text-xs font-bold leading-tight">{island.name}</div>
              <div className="text-[10px] text-gray-500 mt-1 leading-snug">{island.caption}</div>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-gray-500 mb-2">Tap to pick. Right-click / long-press to push away.</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={picked.length < 2}
          className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-40 text-white rounded-lg text-sm font-semibold"
        >
          Set sail ({picked.length} picked)
        </button>
        {onSkip && (
          <button type="button" onClick={onSkip} className="px-3 py-2 text-xs text-gray-500 hover:text-gray-800">
            Skip
          </button>
        )}
      </div>
    </section>
  );
}
