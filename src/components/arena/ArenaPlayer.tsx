'use client';

/**
 * ArenaPlayer — single dispatcher that renders the right minigame and
 * persists its result via /api/arena. Use this anywhere we want to surface
 * an Arena game (the Arena page, daily-mix Open step, recalibration prompt).
 */

import { useState } from 'react';
import { GAME_META, type MinigameId } from '@/lib/arena-signals';
import PatternTrace from './PatternTrace';
import WordSprint from './WordSprint';
import NumberSnap from './NumberSnap';
import MemoryMatch from './MemoryMatch';
import StoryChoice from './StoryChoice';

interface Props {
  game: MinigameId;
  trigger?: 'first_session' | 'session_start' | 'weekly' | 'recalibration' | 'manual';
  /** Called after the result is persisted server-side. */
  onDone?: (result: { profile?: any; samplesUsed?: number }) => void;
  /** User chose to skip the game without playing. */
  onSkip?: () => void;
}

export default function ArenaPlayer({ game, trigger = 'manual', onDone, onSkip }: Props) {
  const [phase, setPhase] = useState<'playing' | 'saving' | 'done' | 'failed'>('playing');
  const [error, setError] = useState<string | null>(null);
  const [serverResult, setServerResult] = useState<{ profile?: any; samplesUsed?: number } | null>(null);
  const meta = GAME_META[game];

  const persist = async (
    signals: any,
    summary: { accuracy?: number; rtP50?: number; level?: number; tier?: number; setSize?: number; difficulty?: number; durationSec: number }
  ) => {
    setPhase('saving');
    try {
      const res = await fetch('/api/arena', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game,
          signals,
          trigger,
          accuracy: typeof summary.accuracy === 'number' ? summary.accuracy : null,
          rt_p50_ms: typeof summary.rtP50 === 'number' ? summary.rtP50 : null,
          difficulty_reached: summary.level ?? summary.tier ?? summary.setSize ?? summary.difficulty ?? null,
          duration_seconds: summary.durationSec,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Save failed (${res.status})`);
      }
      setServerResult({ profile: json.profile, samplesUsed: json.samplesUsed });
      setPhase('done');
      onDone?.({ profile: json.profile, samplesUsed: json.samplesUsed });
    } catch (err: any) {
      setError(err?.message || 'Could not save your play.');
      setPhase('failed');
    }
  };

  if (phase === 'saving') {
    return (
      <div className="rounded-2xl border-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 text-center text-sm text-gray-500">
        Saving your play…
      </div>
    );
  }

  if (phase === 'failed') {
    return (
      <div className="rounded-2xl border-2 border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 p-6 text-sm">
        <strong>Couldn&apos;t save:</strong> {error}
        <button
          type="button"
          onClick={() => setPhase('playing')}
          className="ml-3 underline text-rose-700"
        >
          Play again
        </button>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-6">
        <h3 className="font-bold text-base mb-1">Done — {meta.label}</h3>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Saved. Your behavioural profile updated silently in the background. We&apos;ll use it to pick how your next lesson is taught.
        </p>
        {serverResult?.samplesUsed != null && (
          <p className="text-xs text-gray-500 mt-2">
            Built from {serverResult.samplesUsed} recent play{serverResult.samplesUsed === 1 ? '' : 's'} across the Arena.
          </p>
        )}
      </div>
    );
  }

  // phase === 'playing'
  switch (game) {
    case 'pattern_trace':
      return <PatternTrace onComplete={(s, sum) => persist(s, sum)} onAbort={onSkip} />;
    case 'word_sprint':
      return <WordSprint onComplete={(s, sum) => persist(s, sum)} onAbort={onSkip} />;
    case 'number_snap':
      return <NumberSnap onComplete={(s, sum) => persist(s, sum)} onAbort={onSkip} />;
    case 'memory_match':
      return <MemoryMatch onComplete={(s, sum) => persist(s, sum)} onAbort={onSkip} />;
    case 'story_choice':
      return <StoryChoice onComplete={(s, sum) => persist(s, sum)} onAbort={onSkip} />;
  }
}
