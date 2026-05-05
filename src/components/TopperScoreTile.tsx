'use client';

/**
 * Single-headline 0-100 number that summarises everything that matters.
 * 45% mastery + 25% adherence + 15% honesty + 10% practice + 5% streak.
 * Renders nothing until the API responds — no flash of zero.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Score {
  score: number;
  mastery: number;
  adherence: number;
  honestyXp: number;
  streak: number;
  practiceFreq: number;
  breakdown: {
    masteryContribution: number;
    adherenceContribution: number;
    honestyContribution: number;
    practiceContribution: number;
    streakContribution: number;
  };
}

export default function TopperScoreTile() {
  const [data, setData] = useState<Score | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/topper-score').then((r) => r.json()).then((d) => { if (d?.success) setData(d as any); }).finally(() => setLoaded(true));
  }, []);

  if (!loaded || !data) return null;

  const tone = data.score >= 75 ? 'from-emerald-500 to-teal-500'
    : data.score >= 50 ? 'from-amber-400 to-orange-500'
    : 'from-rose-400 to-pink-500';

  return (
    <div className="mb-6 p-5 rounded-2xl bg-gradient-to-br border-2 border-white/40 dark:border-gray-800 shadow-lg" style={{ background: undefined }}>
      <div className={`-m-5 p-5 rounded-2xl bg-gradient-to-br ${tone}`}>
        <div className="flex items-center gap-4">
          <div className="text-5xl font-extrabold text-white">{data.score}</div>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wider font-bold text-white/80">Topper Score</p>
            <p className="text-sm text-white/90">{data.score >= 75 ? '🌟 You\'re on track for top of class.' : data.score >= 50 ? 'Solid base — push consistency.' : 'Plenty of room to grow. One step at a time.'}</p>
          </div>
          <Link href="/topper-routine" className="text-xs px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded font-semibold whitespace-nowrap">
            Routine →
          </Link>
        </div>
        <div className="mt-3 flex gap-1 text-[10px] font-bold text-white/90">
          <span className="px-2 py-1 bg-white/20 rounded">Mastery {data.breakdown.masteryContribution}</span>
          <span className="px-2 py-1 bg-white/20 rounded">Consistent {data.breakdown.adherenceContribution}</span>
          <span className="px-2 py-1 bg-white/20 rounded">Honesty {data.breakdown.honestyContribution}</span>
          <span className="px-2 py-1 bg-white/20 rounded">Practice {data.breakdown.practiceContribution}</span>
          <span className="px-2 py-1 bg-white/20 rounded">Streak {data.breakdown.streakContribution}</span>
        </div>
      </div>
    </div>
  );
}
