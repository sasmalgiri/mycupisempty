'use client';

/**
 * TodaysPlanBanner — surfaces the student's plan-driven "today" on the
 * dashboard and inside Daily Mix. Shows the current-week chapters,
 * adherence %, and the companion+method picked for the first block.
 *
 * Silently renders nothing if the student isn't enrolled in any course —
 * Daily Mix's free-form behaviour stays the default for non-enrolled users.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Block {
  subjectSlug: string;
  chapterTitle: string;
  allocatedMinutes: number;
  isReview: boolean;
  chapterId: string | null;
}

interface Snapshot {
  enrolled: boolean;
  enrollment?: any;
  plan?: { id: string; generated_at: string };
  week?: { weekNo: number; startDate: string; endDate: string; dailyMinutesTarget: number; blocks: Block[]; notes: string[]; isLightWeek?: boolean; isAssessmentWeek?: boolean };
  method?: string | null;
  overlay?: { companion_id: string; class_level: number; system_prompt_fragment: string } | null;
  adherence_pct?: number | null;
  notice?: string;
}

export default function TodaysPlanBanner({ compact = false }: { compact?: boolean }) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/todays-plan')
      .then((r) => r.json())
      .then((d) => setSnap(d))
      .catch(() => setSnap({ enrolled: false }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!snap || !snap.enrolled) return null;

  if (snap.notice) {
    return (
      <section className="rounded-2xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 mb-6">
        <p className="text-sm font-bold mb-1">⚠ Plan not generated yet</p>
        <p className="text-xs text-gray-700 dark:text-gray-300">{snap.notice}</p>
      </section>
    );
  }
  if (!snap.week) return null;

  const w = snap.week;

  return (
    <section className="rounded-2xl border-2 border-primary-200 dark:border-primary-800 bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-primary-950/40 dark:to-secondary-950/40 p-4 sm:p-5 mb-6">
      <div className="flex items-center justify-between mb-2 text-xs">
        <span className="font-semibold uppercase tracking-wider text-primary-700 dark:text-primary-300">
          📅 Week {w.weekNo} · {snap.enrollment?.curriculum_courses?.title || 'Your course'}
        </span>
        {snap.adherence_pct != null && (
          <span className="font-mono text-gray-500">adherence {snap.adherence_pct}%</span>
        )}
      </div>

      {(w.isLightWeek || w.isAssessmentWeek) && (
        <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
          {w.isAssessmentWeek ? '🎯 Assessment week — keep practice light, prioritise revision.' : '🌴 Light week — calendar shows holidays, take it easy.'}
        </p>
      )}

      <div className="space-y-1 mb-3">
        {(w.blocks || []).slice(0, compact ? 3 : 6).map((b, i) => (
          <div key={i} className="flex items-center justify-between text-xs bg-white/60 dark:bg-gray-900/60 rounded-lg px-2 py-1">
            <span className="capitalize font-mono text-[11px] text-gray-500 w-24 truncate">{b.subjectSlug.replace('_', ' ')}</span>
            <span className="flex-1 mx-2 truncate">{b.chapterTitle}{b.isReview ? ' · review' : ''}</span>
            <span className="font-mono text-[10px] text-gray-500 w-12 text-right">{b.allocatedMinutes}m</span>
          </div>
        ))}
        {(w.blocks || []).length > (compact ? 3 : 6) && (
          <p className="text-[10px] text-gray-500 text-center">
            +{(w.blocks || []).length - (compact ? 3 : 6)} more blocks this week
          </p>
        )}
      </div>

      {w.notes && w.notes.length > 0 && (
        <p className="text-[11px] italic text-gray-600 dark:text-gray-400 mb-3">{w.notes.join(' · ')}</p>
      )}

      <div className="flex items-center justify-between gap-2 text-xs">
        <span>
          Today's target: <strong>{w.dailyMinutesTarget} min</strong>
          {snap.method && <> · taught <strong>{snap.method.replace(/_/g, ' ')}</strong></>}
          {snap.overlay && <> · {snap.overlay.companion_id} · class {snap.overlay.class_level}</>}
        </span>
        <Link href="/daily-mix" className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold">
          Start today's mix →
        </Link>
      </div>
    </section>
  );
}
