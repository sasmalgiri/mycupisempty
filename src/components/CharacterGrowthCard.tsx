'use client';

/**
 * CharacterGrowthCard — a quiet but central card showing the student their
 * chosen character quality growing. This is the thing that makes this app
 * different: grades aren't the headline. Character is.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Moment {
  moment: string;
  dimension: string;
  source: string;
  subjectName: string;
  at: string;
  isChosenGoal: boolean;
}

interface WeeklyRhythm { week: string; count: number; }

interface CharacterGrowth {
  characterGoal: string | null;
  goalLabel: string | null;
  setAt: string | null;
  totalCharacterXP: number;
  onGoalMomentCount: number;
  otherMomentCount: number;
  recentMoments: Moment[];
  weeklyRhythm: WeeklyRhythm[];
  narrative: string;
}

const DIM_EMOJI: Record<string, string> = {
  patience: '🌱', curiosity: '🔍', persistence: '🧗', honesty: '🪞',
  discipline: '📏', confidence: '💪', failure_handling: '🔁',
  empathy: '🤝', emotional_regulation: '🫁', self_direction: '🧭',
  responsibility: '🤲', consistency: '🔂',
};

export default function CharacterGrowthCard() {
  const [data, setData] = useState<CharacterGrowth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/character-growth')
      .then(r => r.json())
      .then(d => { if (d.success) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!data) return null;

  if (!data.characterGoal) {
    return (
      <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800">
        <h3 className="font-bold mb-2">🌱 Pick a character quality to grow</h3>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
          Grades are one thing. Who you\'re becoming is another. Pick a character quality to anchor this year.
        </p>
        <Link href="/onboarding" className="inline-block px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold">
          Choose a goal →
        </Link>
      </div>
    );
  }

  const emoji = DIM_EMOJI[data.characterGoal] || '🌱';
  const maxWeekCount = Math.max(...data.weeklyRhythm.map((w) => w.count), 1);

  return (
    <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-emerald-950/30 dark:via-gray-900 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800">
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-300">Character this year</p>
          <h3 className="text-xl font-bold flex items-center gap-2 mt-1">
            <span className="text-2xl">{emoji}</span>
            <span className="capitalize">{data.goalLabel}</span>
          </h3>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{data.onGoalMomentCount}</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">moments</p>
        </div>
      </div>

      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{data.narrative}</p>

      {/* Weekly rhythm */}
      {data.weeklyRhythm.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Last 8 weeks</p>
          <div className="flex items-end gap-1 h-16">
            {data.weeklyRhythm.map((w) => {
              const pct = (w.count / maxWeekCount) * 100;
              return (
                <div key={w.week} className="flex-1 flex flex-col items-center justify-end">
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-emerald-500 to-emerald-400 transition-all"
                    style={{ height: `${Math.max(4, pct)}%` }}
                    title={`${w.week}: ${w.count}`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data.recentMoments.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Recent moments witnessed</p>
          <ul className="space-y-1.5 text-sm">
            {data.recentMoments.slice(0, 4).map((m, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-emerald-600 mt-0.5">✓</span>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-800 dark:text-gray-200 leading-snug">{m.moment}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{m.subjectName}{m.source ? ` · ${m.source.replace('companion_', '')}` : ''}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-[10px] text-gray-500">
        +{data.totalCharacterXP} character XP · observed quietly by your companions
      </p>
    </div>
  );
}
