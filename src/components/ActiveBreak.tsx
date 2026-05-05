'use client';

/**
 * ActiveBreak — 60–90 second deliberate break between learning blocks.
 *
 * Why deliberate: distributed practice + brief consolidation breaks beat
 * massed practice for retention (Bjork, Sobel, Cepeda — robust meta-analytic
 * effect for spacing). Reads to the student as a coffee break; under the
 * hood it's:
 *
 *   - free-recall prompt ("what's one thing you remember?") — testing-effect
 *     style retrieval
 *   - body movement card ("stand and stretch — we'll wait")
 *   - hydration / window glance card (visual rest, dopamine reset)
 *   - 60-sec interesting-fact micro-dose (curiosity-reload, rotates)
 *   - physiological-sigh breathing animation (Huberman protocol — 30s)
 *
 * Break-gating: timer must hit 0 OR the student presses "Done" actively after
 * the floor (~25s). Skipping logs a fatigue/override signal but never blocks
 * the session. The *override is itself a learning signal*.
 */

import { useEffect, useRef, useState } from 'react';

export type BreakKind = 'recall' | 'stretch' | 'hydrate' | 'fact' | 'breathing';

interface FactItem {
  hook: string;
  body: string;
}

interface Props {
  durationSec?: number;             // default 60
  /** Bias which kind of break appears. Random within available pool if omitted. */
  kind?: BreakKind;
  /** What the student just learned — used to seed the recall prompt. */
  recallContext?: string;
  /** Pluggable facts (from Wonder Hub). Fallback to a small built-in set. */
  facts?: FactItem[];
  onDone: (info: { kind: BreakKind; durationSec: number; skipped: boolean; recall?: string }) => void;
}

const DEFAULT_FACTS: FactItem[] = [
  { hook: 'Octopuses taste with their arms.', body: 'Each suction cup has chemical receptors. They literally know what something is by touching it.' },
  { hook: 'A neutron star teaspoon weighs ~6 billion tonnes.', body: 'Their matter is packed denser than an atomic nucleus.' },
  { hook: 'Honeybees do trigonometry to dance directions home.', body: 'The angle of their waggle relative to vertical encodes the angle to food relative to the sun.' },
  { hook: 'You shed about 30,000 to 40,000 skin cells every minute.', body: 'Most household dust is just you.' },
  { hook: 'Bananas are radioactive — a little.', body: 'They contain potassium-40. Your body too. It\'s harmless and natural.' },
  { hook: 'The ISS orbits at 7.66 km/s.', body: 'That is roughly 27,600 km/h — sunrise every 90 minutes for the astronauts.' },
];

const BREAK_FLOOR_SEC = 25;  // can't "Done" before this

function pickRandomKind(): BreakKind {
  const pool: BreakKind[] = ['recall', 'stretch', 'hydrate', 'fact', 'breathing'];
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function ActiveBreak({ durationSec = 60, kind, recallContext, facts, onDone }: Props) {
  const [theKind] = useState<BreakKind>(kind || pickRandomKind());
  const [secondsLeft, setSecondsLeft] = useState(durationSec);
  const [recallText, setRecallText] = useState('');
  const startedAtRef = useRef<number>(Date.now());
  const factRef = useRef<FactItem | undefined>(undefined);
  if (factRef.current === undefined) {
    const pool = facts && facts.length ? facts : DEFAULT_FACTS;
    factRef.current = pool[Math.floor(Math.random() * pool.length)];
  }

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          finish(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = (skipped: boolean) => {
    const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000);
    onDone({ kind: theKind, durationSec: elapsed, skipped, recall: recallText.trim() || undefined });
  };

  const canDoneNow = (durationSec - secondsLeft) >= BREAK_FLOOR_SEC;

  return (
    <section className="rounded-2xl border-2 border-teal-200 dark:border-teal-800 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/40 dark:to-cyan-950/40 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-base">⏸ Quick break</h3>
        <span className={`font-mono text-xs ${secondsLeft < 10 ? 'text-amber-600' : 'text-gray-500'}`}>{secondsLeft}s</span>
      </div>

      {theKind === 'recall' && (
        <>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
            What&apos;s <em>one</em> thing you remember from the last few minutes? No judgment — type or just think it.
          </p>
          {recallContext && (
            <p className="text-xs text-gray-500 mb-2 italic">Topic: {recallContext}</p>
          )}
          <textarea
            value={recallText}
            onChange={(e) => setRecallText(e.target.value)}
            placeholder="One sentence is plenty…"
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
          />
        </>
      )}

      {theKind === 'stretch' && (
        <div className="text-center py-3">
          <p className="text-3xl mb-2">🧍</p>
          <p className="text-sm font-medium mb-1">Stand up. Touch your toes 3 times.</p>
          <p className="text-xs text-gray-500">We&apos;ll wait — the timer keeps going.</p>
        </div>
      )}

      {theKind === 'hydrate' && (
        <div className="text-center py-3">
          <p className="text-3xl mb-2">💧</p>
          <p className="text-sm font-medium mb-1">Sip water. Look out a window for 20 seconds.</p>
          <p className="text-xs text-gray-500">Your eyes need the rest. Honest.</p>
        </div>
      )}

      {theKind === 'fact' && factRef.current && (
        <div className="py-1">
          <p className="text-sm font-bold mb-1">{factRef.current.hook}</p>
          <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{factRef.current.body}</p>
          <p className="text-[10px] text-gray-500 mt-2">— a 60-second curiosity dose to reset your attention.</p>
        </div>
      )}

      {theKind === 'breathing' && (
        <div className="text-center py-3">
          <BreathingDot />
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
            Inhale 4, hold 7, exhale 8 — twice. Used by Andrew Huberman to reset arousal in 30s.
          </p>
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <button
          type="button"
          onClick={() => finish(false)}
          disabled={!canDoneNow}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
            canDoneNow
              ? 'bg-teal-600 hover:bg-teal-700 text-white'
              : 'bg-gray-200 dark:bg-gray-800 text-gray-500 cursor-not-allowed'
          }`}
        >
          {canDoneNow ? 'Done — back to learning' : `Stay a moment (${BREAK_FLOOR_SEC - (durationSec - secondsLeft)}s)`}
        </button>
        <button
          type="button"
          onClick={() => finish(true)}
          aria-label="Skip break"
          className="px-3 py-2 text-xs text-gray-500 hover:text-gray-800"
        >
          Skip
        </button>
      </div>

      <p className="text-[10px] text-gray-500 text-center mt-2">
        Skipping is fine — but research says distributed practice with breaks beats grinding.
      </p>
    </section>
  );
}

function BreathingDot() {
  return (
    <div className="flex items-center justify-center h-24">
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-400 to-teal-400 animate-pulse-slow" />
      <style jsx>{`
        @keyframes pulse-slow {
          0%, 100% { transform: scale(0.7); opacity: 0.6; }
          50% { transform: scale(1.2); opacity: 1; }
        }
        .animate-pulse-slow { animation: pulse-slow 7.6s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
