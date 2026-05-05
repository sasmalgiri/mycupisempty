'use client';

/**
 * Weekly League — anonymous handle leaderboard for the student's cohort.
 * No real names ever shown. Demotion is inactivity-based, not score-based,
 * so anti-mastery pressure is avoided.
 */

import { useEffect, useState } from 'react';

interface Standing {
  user_id: string;
  weekly_xp: number;
  anon_handle: string;
}

interface Streak {
  current_streak: number;
  longest_streak: number;
  freezes_available: number;
  honesty_xp: number;
}

export default function LeaguePage() {
  const [streak, setStreak] = useState<Streak | null>(null);
  const [tier, setTier] = useState<{ tier: number; name: string; icon: string } | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/streak')
      .then((r) => r.json())
      .then((d) => {
        if (d?.streak) setStreak(d.streak);
        if (d?.league) {
          setTier(d.league.tier_meta);
          setStandings(d.league.standings || []);
          // Find me in the standings — handle is stable per league.
          // We don't have user_id back from auth on the client; use a heuristic:
          // the only standing without an obvious "anonymous" prefix.
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="max-w-2xl mx-auto p-8 text-center text-gray-500">Loading your league…</div>;

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Weekly League</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          A small cohort of students at your class + board, tracked anonymously for one week. Demotion only happens for inactivity — you can&apos;t lose your spot for getting things wrong.
        </p>
      </div>

      <section className="grid sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-200 dark:border-amber-800">
          <p className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-300 font-bold">🔥 Streak</p>
          <p className="text-2xl font-bold mt-1">{streak?.current_streak || 0} days</p>
          <p className="text-[10px] text-gray-500">Longest: {streak?.longest_streak || 0} · ❄️ {streak?.freezes_available || 0} freezes</p>
        </div>
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-800">
          <p className="text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-300 font-bold">✓ Honesty XP</p>
          <p className="text-2xl font-bold mt-1">{streak?.honesty_xp || 0}</p>
          <p className="text-[10px] text-gray-500">Earned for completing exit-evals + flags.</p>
        </div>
        <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/40 dark:to-indigo-950/40 border border-purple-200 dark:border-purple-800">
          <p className="text-xs uppercase tracking-wider text-purple-700 dark:text-purple-300 font-bold">{tier?.icon || '🥉'} League</p>
          <p className="text-2xl font-bold mt-1">{tier?.name || 'Bronze'}</p>
          <p className="text-[10px] text-gray-500">Tier {tier?.tier || 1} of 10</p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">This week&apos;s cohort</h2>
        {standings.length === 0 ? (
          <div className="p-6 rounded-2xl border border-gray-200 dark:border-gray-800 text-center text-sm text-gray-500">
            You&apos;ll be matched to a cohort the first time you earn weekly XP.
          </div>
        ) : (
          <ol className="space-y-1">
            {standings.map((s, i) => (
              <li
                key={s.user_id}
                className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                  s.user_id === me
                    ? 'bg-primary-50 dark:bg-primary-900/30 border border-primary-300'
                    : 'bg-gray-50 dark:bg-gray-900'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="font-mono text-xs w-5 text-gray-500">{i + 1}.</span>
                  <span className="text-sm">{s.anon_handle}</span>
                </span>
                <span className="text-sm font-mono font-bold">{s.weekly_xp} xp</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
