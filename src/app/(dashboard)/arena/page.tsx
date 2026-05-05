'use client';

/**
 * Arena page — five short behavioural minigames. Each play silently updates
 * the student's behavioural profile. The "How this is used" line at the top
 * is deliberate transparency — we don't hide the fact that these are signals.
 *
 * Surfaces:
 *   /arena              → grid of all 5, plus the most-recently-played stats
 *   /arena?game=number_snap → jump straight into one (used by daily-mix Open)
 */

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ArenaPlayer from '@/components/arena/ArenaPlayer';
import { ARENA_GAMES, GAME_META, type MinigameId } from '@/lib/arena-signals';

export default function ArenaPage() {
  return (
    <Suspense fallback={<div className="max-w-3xl mx-auto p-8 text-center text-gray-500">Loading the Arena…</div>}>
      <ArenaPageInner />
    </Suspense>
  );
}

function ArenaPageInner() {
  const params = useSearchParams();
  const router = useRouter();

  const queryGame = params?.get('game') as MinigameId | null;
  const [active, setActive] = useState<MinigameId | null>(
    queryGame && ARENA_GAMES.includes(queryGame) ? queryGame : null
  );
  const [recent, setRecent] = useState<Array<{ game: MinigameId; played_at: string; accuracy: number | null; difficulty_reached: number | null }>>([]);
  const [profile, setProfile] = useState<any | null>(null);

  useEffect(() => {
    fetch('/api/arena?last=10')
      .then((r) => r.json())
      .then((d) => {
        if (d?.success) setRecent(d.results || []);
      })
      .catch(() => {});
  }, [active]); // refresh when player exits a game

  const startGame = (g: MinigameId) => {
    setActive(g);
    // Sync URL so refresh keeps the player.
    const url = new URL(window.location.href);
    url.searchParams.set('game', g);
    router.replace(url.pathname + '?' + url.searchParams.toString());
  };

  const exitGame = () => {
    setActive(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('game');
    router.replace(url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : ''));
  };

  if (active) {
    return (
      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        <button
          type="button"
          onClick={exitGame}
          aria-label="Back to Arena"
          className="mb-4 text-sm font-semibold text-primary-600"
        >← Back to Arena</button>
        <ArenaPlayer game={active} trigger="manual" onDone={() => setTimeout(exitGame, 1800)} onSkip={exitGame} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">The Arena</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Five short games. Each one quietly tells your companions how you think today — visual,
          verbal, numerical, working-memory, narrative. We never ask you what kind of learner you are.
          We just watch how you play and adjust.
        </p>
      </div>

      <section className="grid sm:grid-cols-2 gap-3">
        {ARENA_GAMES.map((g) => {
          const meta = GAME_META[g];
          const last = recent.find((r) => r.game === g);
          return (
            <button
              key={g}
              type="button"
              onClick={() => startGame(g)}
              className="text-left p-4 rounded-2xl border-2 border-gray-200 dark:border-gray-800 hover:border-primary-400 bg-white dark:bg-gray-900 transition-colors"
            >
              <div className="flex items-center gap-3 mb-1">
                <span className="text-2xl" aria-hidden="true">{meta.icon}</span>
                <h3 className="font-bold">{meta.label}</h3>
              </div>
              <p className="text-xs text-gray-500 mb-2">{meta.description}</p>
              <div className="flex items-center justify-between text-[11px] text-gray-500">
                <span>~{meta.durationSec}s</span>
                {last && (
                  <span className="font-mono">
                    last: {last.accuracy != null ? `${Math.round(last.accuracy * 100)}%` : '—'}
                    {last.difficulty_reached != null && ` · L${last.difficulty_reached}`}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </section>

      <section className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
        <h3 className="text-sm font-bold mb-1">How this is used</h3>
        <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-disc pl-5">
          <li>Your scores update a behavioural profile we use to pick lesson formats — visual, story, drills, examples-first, Socratic.</li>
          <li>If a teaching style isn&apos;t working for you, your companion notices in the exit-evals and proposes a switch with reasons.</li>
          <li>No public leaderboard — only your own scores over time.</li>
          <li>Skipping is fine. Playing earns Honesty XP.</li>
        </ul>
      </section>
    </div>
  );
}
