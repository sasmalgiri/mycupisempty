'use client';

/**
 * Study Time Quest — the constraints game. Instead of typing
 * "I study 60 minutes a day in the evening", the student spends a
 * fixed energy budget across slots in their day. The output IS the
 * planner inputs — daily_study_minutes_available, best_study_time,
 * energy_after_school — extracted from where the student dropped energy.
 *
 * Framing matters: "spend your day-energy" is far less self-flattering
 * than "how many minutes a day do you study?". A student who "drops"
 * 60% of their energy on late-night gaming and 10% on evening study has
 * told us the truth. They wouldn't have typed it.
 */

import { useState } from 'react';
import type { StudyTimeQuestSignals } from '@/lib/persona-games';

interface Props {
  onComplete: (signals: StudyTimeQuestSignals, durationSec: number) => void;
  onSkip?: () => void;
}

interface Slot {
  id: 'early_morning' | 'after_school' | 'evening' | 'late_night';
  label: string;
  hours: string;
  icon: string;
}

const SLOTS: Slot[] = [
  { id: 'early_morning', label: 'Early morning', hours: '5–8 AM',  icon: '🌅' },
  { id: 'after_school',  label: 'After school',  hours: '4–7 PM',  icon: '🎒' },
  { id: 'evening',       label: 'Evening',       hours: '7–10 PM', icon: '🌆' },
  { id: 'late_night',    label: 'Late night',    hours: '10 PM–1 AM', icon: '🌙' },
];

const TOTAL_BUDGET = 100;

export default function StudyTimeQuest({ onComplete, onSkip }: Props) {
  const [allocation, setAllocation] = useState<Record<Slot['id'], number>>({
    early_morning: 25, after_school: 25, evening: 25, late_night: 25,
  });
  const [freeMinutes, setFreeMinutes] = useState<number>(60);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [step, setStep] = useState<'split' | 'minutes' | 'blocks'>('split');
  const [startedAt] = useState(() => Date.now());

  const total = Object.values(allocation).reduce((a, b) => a + b, 0);

  const setSlot = (id: Slot['id'], v: number) => {
    setAllocation({ ...allocation, [id]: Math.max(0, Math.min(100, v)) });
  };

  const submit = () => {
    onComplete({
      energyByTime: allocation,
      declaredFreeMinutesPerDay: freeMinutes,
      blockedSlots: blocked,
    }, Math.round((Date.now() - startedAt) / 1000));
  };

  const toggleBlock = (id: string) => {
    setBlocked(blocked.includes(id) ? blocked.filter((x) => x !== id) : [...blocked, id]);
  };

  if (step === 'split') {
    return (
      <section className="rounded-2xl border-2 border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30 p-5">
        <h3 className="font-bold text-base mb-1">⚡ Energy Quest</h3>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
          You have {TOTAL_BUDGET} energy points to spend across your day. Drop them where you actually have them — not where you wish you did.
        </p>
        {SLOTS.map((slot) => (
          <div key={slot.id} className="mb-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span>{slot.icon} <strong>{slot.label}</strong> <span className="text-gray-500">({slot.hours})</span></span>
              <span className="font-mono">{allocation[slot.id]}</span>
            </div>
            <input
              type="range"
              min={0}
              max={60}
              step={5}
              value={allocation[slot.id]}
              onChange={(e) => setSlot(slot.id, Number(e.target.value))}
              className="w-full"
            />
          </div>
        ))}
        <p className={`text-xs mb-3 ${total === TOTAL_BUDGET ? 'text-emerald-700' : total > TOTAL_BUDGET ? 'text-rose-700' : 'text-amber-700'}`}>
          Total spent: {total} / {TOTAL_BUDGET}
        </p>
        <button
          type="button"
          onClick={() => setStep('minutes')}
          disabled={total < 80 || total > 120}
          className="w-full py-2 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-40 text-white rounded-lg text-sm font-semibold"
        >
          Continue
        </button>
        {onSkip && <button type="button" onClick={onSkip} className="mt-2 text-xs text-gray-500 hover:text-gray-800">Skip</button>}
      </section>
    );
  }

  if (step === 'minutes') {
    return (
      <section className="rounded-2xl border-2 border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30 p-5">
        <h3 className="font-bold text-base mb-1">⚡ Energy Quest</h3>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
          On a typical school day, how long can you actually focus on study (not just sit with the book open)?
        </p>
        <input
          type="range"
          min={15}
          max={240}
          step={15}
          value={freeMinutes}
          onChange={(e) => setFreeMinutes(Number(e.target.value))}
          className="w-full mb-2"
        />
        <p className="text-center text-2xl font-mono font-bold mb-3">{freeMinutes} min</p>
        <button type="button" onClick={() => setStep('blocks')} className="w-full py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-semibold">
          Continue
        </button>
      </section>
    );
  }

  // step === 'blocks'
  const BLOCKS = ['school', 'tuition', 'family_time', 'sports', 'chores', 'religious', 'commute'];
  return (
    <section className="rounded-2xl border-2 border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30 p-5">
      <h3 className="font-bold text-base mb-1">⚡ Energy Quest</h3>
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
        Which of these eat into your day? Tap any that apply.
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        {BLOCKS.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => toggleBlock(b)}
            className={`px-3 py-1 text-xs rounded-full border ${
              blocked.includes(b) ? 'bg-yellow-600 border-yellow-700 text-white' : 'border-gray-300 dark:border-gray-700'
            }`}
          >
            {b.replace('_', ' ')}
          </button>
        ))}
      </div>
      <button type="button" onClick={submit} className="w-full py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-semibold">
        Save energy quest
      </button>
    </section>
  );
}
