'use client';

/**
 * Tortoise or Hare — pick a track (fast/steady/mixed) then "race" by tapping
 * one of two buttons each round: Rush (could trip) or Walk (slow but safe).
 * Their pattern reveals decision_tempo and effort_tolerance.
 */

import { useState } from 'react';
import type { TortoiseOrHareSignals } from '@/lib/persona-games';

interface Props {
  onComplete: (signals: TortoiseOrHareSignals, durationSec: number) => void;
  onSkip?: () => void;
}

const TOTAL_ROUNDS = 8;

export default function TortoiseOrHare({ onComplete, onSkip }: Props) {
  const [phase, setPhase] = useState<'pick' | 'racing' | 'done'>('pick');
  const [track, setTrack] = useState<'fast' | 'steady' | 'mixed' | null>(null);
  const [round, setRound] = useState(0);
  const [moves, setMoves] = useState<('rush' | 'walk')[]>([]);
  const [trips, setTrips] = useState(0);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const [startedAt] = useState(() => Date.now());

  const startRace = (t: 'fast' | 'steady' | 'mixed') => {
    setTrack(t);
    setPhase('racing');
  };

  const move = (m: 'rush' | 'walk') => {
    const tripChance = m === 'rush' ? 0.20 : 0.02;
    const tripped = Math.random() < tripChance;
    if (tripped) {
      setTrips((n) => n + 1);
      setLastEvent('Tripped! Lost a step.');
    } else {
      setLastEvent(m === 'rush' ? 'Sprinted ahead.' : 'Steady stride.');
    }
    const next = [...moves, m];
    setMoves(next);
    if (round + 1 >= TOTAL_ROUNDS) {
      finish(next, true);
    } else {
      setRound(round + 1);
    }
  };

  const finish = (finalMoves: ('rush' | 'walk')[], finished: boolean) => {
    setPhase('done');
    const rushFraction = finalMoves.length > 0
      ? finalMoves.filter((m) => m === 'rush').length / finalMoves.length
      : 0;
    onComplete({
      trackPicked: track || 'mixed',
      rushFraction,
      finishedRace: finished,
      tripCount: trips,
    }, Math.round((Date.now() - startedAt) / 1000));
  };

  if (phase === 'pick') {
    return (
      <section className="rounded-2xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-5">
        <h3 className="font-bold text-base mb-1">🐢 Tortoise or Hare</h3>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">Pick a track. Then race.</p>
        <div className="space-y-2">
          <button type="button" onClick={() => startRace('fast')} className="w-full text-left p-3 rounded-xl border-2 border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30">
            <strong>🐇 Fast track</strong>
            <p className="text-xs text-gray-600 dark:text-gray-400">Win big or trip. High variance.</p>
          </button>
          <button type="button" onClick={() => startRace('steady')} className="w-full text-left p-3 rounded-xl border-2 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30">
            <strong>🐢 Steady track</strong>
            <p className="text-xs text-gray-600 dark:text-gray-400">Slow + sure. Low risk, low thrill.</p>
          </button>
          <button type="button" onClick={() => startRace('mixed')} className="w-full text-left p-3 rounded-xl border-2 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30">
            <strong>🦌 Mixed terrain</strong>
            <p className="text-xs text-gray-600 dark:text-gray-400">You decide each step.</p>
          </button>
        </div>
        {onSkip && <button type="button" onClick={onSkip} className="mt-3 text-xs text-gray-500 hover:text-gray-800">Skip</button>}
      </section>
    );
  }

  if (phase === 'racing') {
    return (
      <section className="rounded-2xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-5">
        <div className="flex items-center justify-between mb-2 text-xs">
          <span>Round {round + 1} / {TOTAL_ROUNDS}</span>
          <span>{track} track</span>
        </div>
        <div className="text-3xl text-center my-3">
          {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => (
            <span key={i}>{i < round ? '·' : '·'}</span>
          ))}
        </div>
        {lastEvent && <p className="text-xs text-amber-700 mb-3 text-center italic">{lastEvent}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => move('rush')} className="py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold">
            🏃 Rush
          </button>
          <button type="button" onClick={() => move('walk')} className="py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold">
            🚶 Walk
          </button>
        </div>
        <p className="text-[10px] text-gray-500 text-center mt-2">
          Trips so far: {trips}
        </p>
      </section>
    );
  }

  return null;
}
