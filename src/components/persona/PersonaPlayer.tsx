'use client';

/**
 * PersonaPlayer — dispatches to the right persona-reveal game and persists
 * the play via /api/persona-games. Reusable inside /persona, after the
 * Arena baseline, or as a recalibration prompt.
 */

import { useState } from 'react';
import { PERSONA_GAME_META, type PersonaGameId } from '@/lib/persona-games';
import IslandChoice from './IslandChoice';
import EffortCurve from './EffortCurve';
import CuriosityRoom from './CuriosityRoom';
import TortoiseOrHare from './TortoiseOrHare';
import HelpingHands from './HelpingHands';
import StudyTimeQuest from './StudyTimeQuest';

interface Props {
  game: PersonaGameId;
  onDone?: (result: { persona?: any }) => void;
  onSkip?: () => void;
}

export default function PersonaPlayer({ game, onDone, onSkip }: Props) {
  const [phase, setPhase] = useState<'playing' | 'saving' | 'done' | 'failed'>('playing');
  const [error, setError] = useState<string | null>(null);
  const meta = PERSONA_GAME_META[game];

  const persist = async (signals: any, durationSec: number) => {
    setPhase('saving');
    try {
      const res = await fetch('/api/persona-games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game, signals, durationSeconds: durationSec }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || `Save failed (${res.status})`);
      setPhase('done');
      onDone?.({ persona: json.persona });
    } catch (err: any) {
      setError(err?.message || 'Could not save.');
      setPhase('failed');
    }
  };

  if (phase === 'saving') return <div className="rounded-2xl border-2 border-gray-200 dark:border-gray-800 p-5 text-sm text-center text-gray-500">Saving…</div>;
  if (phase === 'failed') return (
    <div className="rounded-2xl border-2 border-rose-200 bg-rose-50 dark:bg-rose-950/30 p-5 text-sm">
      <strong>Couldn&apos;t save:</strong> {error}
    </div>
  );
  if (phase === 'done') return (
    <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 p-5">
      <h3 className="font-bold text-base mb-1">✓ Done — {meta.label}</h3>
      <p className="text-sm text-gray-700 dark:text-gray-300">Your persona profile updated. We&apos;ll use it to plan your weeks and pick how each lesson is taught.</p>
    </div>
  );

  switch (game) {
    case 'island_choice':    return <IslandChoice onComplete={persist} onSkip={onSkip} />;
    case 'effort_curve':     return <EffortCurve onComplete={persist} onSkip={onSkip} />;
    case 'curiosity_room':   return <CuriosityRoom onComplete={persist} onSkip={onSkip} />;
    case 'tortoise_or_hare': return <TortoiseOrHare onComplete={persist} onSkip={onSkip} />;
    case 'helping_hands':    return <HelpingHands onComplete={persist} onSkip={onSkip} />;
    case 'study_time_quest': return <StudyTimeQuest onComplete={persist} onSkip={onSkip} />;
  }
}
