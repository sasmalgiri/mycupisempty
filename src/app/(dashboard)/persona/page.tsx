'use client';

/**
 * /persona — game-driven persona reveal.
 *
 * Six short games. No surveys, no self-labels. The student plays and the
 * system extracts disposition + constraint signals as a side-effect.
 * Together with the Arena (capacity), this is the persona the planner uses.
 */

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PersonaPlayer from '@/components/persona/PersonaPlayer';
import { PERSONA_GAMES, PERSONA_GAME_META, type PersonaGameId } from '@/lib/persona-games';

export default function PersonaPage() {
  return (
    <Suspense fallback={<div className="max-w-3xl mx-auto p-8 text-center text-gray-500">Loading your persona…</div>}>
      <Inner />
    </Suspense>
  );
}

interface PersonaSnapshot {
  composite_confidence?: number | null;
  perfectionism?: number | null;
  effort_tolerance?: number | null;
  curiosity_breadth?: number | null;
  social_orientation?: number | null;
  risk_tolerance?: number | null;
  decision_tempo?: number | null;
  best_study_time?: string | null;
  daily_study_minutes_available?: number | null;
  energy_after_school?: number | null;
  built_from_sources?: string[];
}

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const queryGame = params?.get('game') as PersonaGameId | null;
  const [active, setActive] = useState<PersonaGameId | null>(
    queryGame && PERSONA_GAMES.includes(queryGame) ? queryGame : null
  );
  const [played, setPlayed] = useState<PersonaGameId[]>([]);
  const [persona, setPersona] = useState<PersonaSnapshot | null>(null);

  const refresh = () => {
    fetch('/api/persona-games?last=30')
      .then((r) => r.json())
      .then((d) => {
        const games = (d?.results || []).map((r: any) => r.game as PersonaGameId);
        setPlayed(games);
      })
      .catch(() => {});
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [active]);

  const start = (g: PersonaGameId) => {
    setActive(g);
    const url = new URL(window.location.href);
    url.searchParams.set('game', g);
    router.replace(url.pathname + '?' + url.searchParams.toString());
  };
  const exit = () => {
    setActive(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('game');
    router.replace(url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : ''));
  };

  if (active) {
    return (
      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        <button type="button" onClick={exit} aria-label="Back" className="mb-4 text-sm font-semibold text-primary-600">← Back</button>
        <PersonaPlayer
          game={active}
          onDone={(res) => { if (res.persona) setPersona(res.persona); setTimeout(exit, 1500); }}
          onSkip={exit}
        />
      </div>
    );
  }

  const playedSet = new Set(played);
  const completed = played.length;
  const total = PERSONA_GAMES.length;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Your persona</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Six short games. No surveys, no labels. We watch how you play and learn how you actually think and study — not how you describe yourself. The planner uses this to lay out your week.
        </p>
      </div>

      <div className="rounded-2xl border-2 border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-950/30 p-4">
        <div className="flex items-center justify-between mb-1 text-xs">
          <span className="font-semibold uppercase tracking-wider text-primary-700 dark:text-primary-300">Persona completion</span>
          <span className="font-mono">{completed}/{total} games played</span>
        </div>
        <div className="h-2 rounded-full bg-primary-100 dark:bg-primary-950 overflow-hidden">
          <div className="h-full bg-primary-500 transition-all" style={{ width: `${(completed / total) * 100}%` }} />
        </div>
      </div>

      <section className="grid sm:grid-cols-2 gap-3">
        {PERSONA_GAMES.map((g) => {
          const meta = PERSONA_GAME_META[g];
          const done = playedSet.has(g);
          return (
            <button
              key={g}
              type="button"
              onClick={() => start(g)}
              className={`text-left p-4 rounded-2xl border-2 transition-colors ${
                done
                  ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30'
                  : 'border-gray-200 dark:border-gray-800 hover:border-primary-400 bg-white dark:bg-gray-900'
              }`}
            >
              <div className="flex items-center gap-3 mb-1">
                <span className="text-2xl" aria-hidden="true">{meta.icon}</span>
                <h3 className="font-bold">{meta.label}</h3>
                {done && <span className="ml-auto text-xs text-emerald-700 dark:text-emerald-300">✓ played</span>}
              </div>
              <p className="text-xs text-gray-500 mb-2">{meta.description}</p>
              <p className="text-[10px] text-gray-500 font-mono">~{meta.durationSec}s</p>
            </button>
          );
        })}
      </section>

      {persona && (
        <section className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-sm">
          <h3 className="font-bold mb-2">What we&apos;ve learned</h3>
          <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-1">
            {persona.daily_study_minutes_available != null && <li>• Realistic daily study minutes: <strong>{persona.daily_study_minutes_available}</strong></li>}
            {persona.best_study_time && <li>• Best study time: <strong>{persona.best_study_time.replace(/_/g, ' ')}</strong></li>}
            {persona.energy_after_school != null && <li>• Energy after school: <strong>{persona.energy_after_school}/5</strong></li>}
            {persona.effort_tolerance != null && <li>• Effort tolerance: <strong>{Math.round(persona.effort_tolerance * 100)}%</strong> on hard items</li>}
            {persona.perfectionism != null && <li>• Perfectionism leaning: <strong>{Math.round(persona.perfectionism * 100)}%</strong></li>}
            {persona.curiosity_breadth != null && <li>• Curiosity breadth: <strong>{Math.round(persona.curiosity_breadth * 100)}%</strong></li>}
            {persona.social_orientation != null && <li>• Social orientation: <strong>{Math.round(persona.social_orientation * 100)}%</strong></li>}
            {persona.risk_tolerance != null && <li>• Risk tolerance: <strong>{Math.round(persona.risk_tolerance * 100)}%</strong></li>}
          </ul>
          <p className="text-[10px] text-gray-500 mt-2">
            Confidence: {Math.round((persona.composite_confidence || 0) * 100)}%. Sources: {(persona.built_from_sources || []).join(', ') || 'persona games'}.
          </p>
        </section>
      )}
    </div>
  );
}
