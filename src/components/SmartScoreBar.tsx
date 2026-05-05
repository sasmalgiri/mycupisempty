'use client';

/**
 * SmartScoreBar — a 0..100 mastery progress bar with band coloring + band
 * thresholds visible. Drop into any skill detail page.
 */

import { bandColor, bandLabel, type Band } from '@/lib/smartscore';

interface Props {
  score: number;
  band?: Band;
  showLabel?: boolean;
  className?: string;
}

export default function SmartScoreBar({ score, band, showLabel = true, className = '' }: Props) {
  const s = Math.max(0, Math.min(100, score));
  const b: Band = band || (s >= 100 ? 'mastered' : s >= 91 ? 'challenge_zone' : s >= 71 ? 'mid' : 'practicing');

  return (
    <div className={className}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1 text-xs">
          <span className="font-semibold">{bandLabel(b)}</span>
          <span className="font-mono">{s}/100</span>
        </div>
      )}
      <div className="relative h-2 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
        <div
          className={`h-full ${bandColor(b)} transition-all`}
          style={{ width: `${s}%` }}
        />
        {/* Band threshold ticks at 71 and 91 */}
        <div className="absolute inset-y-0 left-[71%] w-px bg-white/40 dark:bg-black/40" />
        <div className="absolute inset-y-0 left-[91%] w-px bg-white/40 dark:bg-black/40" />
      </div>
    </div>
  );
}
