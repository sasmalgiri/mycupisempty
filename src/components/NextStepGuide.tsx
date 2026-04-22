'use client';

/**
 * NextStepGuide — a friendly, proactive "what to do next" card.
 *
 * The existing UnstuckButton + AI Guru are reactive: students ask for help
 * when they're stuck. New / uncertain students need the opposite — a visible
 * nudge telling them the logical next move without having to ask.
 *
 * This component reads a small stats snapshot from /api/user-stats-summary
 * and, combined with the current route, picks one best suggestion. No AI call,
 * no server round-trip beyond the stats fetch — just deterministic rules.
 *
 * Dismissible per-suggestion for 24h via localStorage so it doesn't nag.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

export type GuideContext =
  | 'dashboard'
  | 'post_assessment'
  | 'post_daily_mix'
  | 'companions_empty';

interface Suggestion {
  id: string;
  headline: string;
  body: string;
  cta: { label: string; href: string };
  icon: string;
  tone: 'welcome' | 'encourage' | 'celebrate' | 'nudge';
}

interface StatsSnapshot {
  total_xp?: number;
  current_streak?: number;
  last_activity_date?: string | null;
}

const DISMISS_KEY = (id: string) => `mcie_guide_dismiss_${id}`;
const DISMISS_MS = 24 * 60 * 60 * 1000;

function isDismissed(id: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const ts = parseInt(localStorage.getItem(DISMISS_KEY(id)) || '0', 10);
    return ts > 0 && Date.now() - ts < DISMISS_MS;
  } catch {
    return false;
  }
}

function dismiss(id: string): void {
  try { localStorage.setItem(DISMISS_KEY(id), String(Date.now())); } catch {}
}

/**
 * Given context + stats, pick the most appropriate next-step suggestion.
 * Returns null if every candidate for this context is dismissed or nothing
 * applies — the card silently disappears in that case.
 */
function pickSuggestion(context: GuideContext, stats: StatsSnapshot | null): Suggestion | null {
  const xp = stats?.total_xp || 0;
  const streak = stats?.current_streak || 0;
  const studiedToday = stats?.last_activity_date === new Date().toISOString().split('T')[0];

  const candidates: Suggestion[] = [];

  if (context === 'post_assessment') {
    candidates.push({
      id: 'post_assessment_first_mix',
      headline: 'Ready to start learning?',
      body: "Your Daily Mix is 5-10 focused minutes built around what we just learned about you. It's the fastest way to earn your first streak.",
      cta: { label: 'Open Daily Mix', href: '/daily-mix' },
      icon: '🎯',
      tone: 'welcome',
    });
  }

  if (context === 'post_daily_mix') {
    candidates.push({
      id: 'post_mix_flashcards',
      headline: 'Lock it in with flashcards',
      body: "You just learned something. Reviewing it in 24 hours moves it from short-term to long-term memory. We'll schedule the cards for you — just say yes.",
      cta: { label: 'Review flashcards', href: '/flashcards' },
      icon: '🃏',
      tone: 'encourage',
    });
    candidates.push({
      id: 'post_mix_companions',
      headline: 'Meet your companions',
      body: 'Each subject has a guide — Aryabhata for Math, Tagore for English, Nambi Narayanan for Science. They track what works for you.',
      cta: { label: 'Visit companions', href: '/companions' },
      icon: '🤝',
      tone: 'nudge',
    });
  }

  if (context === 'companions_empty') {
    candidates.push({
      id: 'companions_empty_mix',
      headline: 'Start a subject to wake a companion',
      body: 'Companions come alive once you start a subject. Daily Mix picks one for you based on how you learn best.',
      cta: { label: 'Start Daily Mix', href: '/daily-mix' },
      icon: '🌱',
      tone: 'welcome',
    });
  }

  if (context === 'dashboard') {
    if (xp === 0 && streak === 0) {
      candidates.push({
        id: 'dashboard_first_mix',
        headline: "Let's get your first win",
        body: "A Daily Mix takes ~10 minutes and sets up everything else — streak, XP, your first companion notes. Start here.",
        cta: { label: 'Open Daily Mix', href: '/daily-mix' },
        icon: '▶',
        tone: 'welcome',
      });
    } else if (!studiedToday && streak > 0) {
      candidates.push({
        id: `dashboard_keep_streak_${streak}`,
        headline: `Keep your ${streak}-day streak alive`,
        body: `Your companions noticed you haven't been by yet today. A short Daily Mix is enough to hold the streak.`,
        cta: { label: 'Continue streak', href: '/daily-mix' },
        icon: '🔥',
        tone: 'encourage',
      });
    } else if (!studiedToday) {
      candidates.push({
        id: 'dashboard_no_activity',
        headline: 'Start small today',
        body: 'Even 5 minutes on one subject counts. Pick anything that feels right — your Daily Mix is a gentle way in.',
        cta: { label: 'Open Daily Mix', href: '/daily-mix' },
        icon: '🌿',
        tone: 'nudge',
      });
    } else if (studiedToday && xp >= 50) {
      candidates.push({
        id: 'dashboard_studied_today_reflect',
        headline: 'You studied today — take 30 seconds to reflect',
        body: 'A quick reflection now makes today\'s learning stick. Your companions read these to understand you better.',
        cta: { label: 'Reflect now', href: '/reflect' },
        icon: '🪞',
        tone: 'celebrate',
      });
    }
  }

  // Return the first non-dismissed candidate
  return candidates.find((c) => !isDismissed(c.id)) || null;
}

const TONE_STYLES: Record<Suggestion['tone'], string> = {
  welcome:
    'from-indigo-50 to-purple-50 border-indigo-200 dark:from-indigo-950/40 dark:to-purple-950/40 dark:border-indigo-800',
  encourage:
    'from-emerald-50 to-teal-50 border-emerald-200 dark:from-emerald-950/40 dark:to-teal-950/40 dark:border-emerald-800',
  celebrate:
    'from-amber-50 to-orange-50 border-amber-200 dark:from-amber-950/40 dark:to-orange-950/40 dark:border-amber-800',
  nudge:
    'from-sky-50 to-cyan-50 border-sky-200 dark:from-sky-950/40 dark:to-cyan-950/40 dark:border-sky-800',
};

interface Props {
  context: GuideContext;
  className?: string;
}

export default function NextStepGuide({ context, className = '' }: Props) {
  const [stats, setStats] = useState<StatsSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    // Only fetch stats when the context actually depends on them.
    if (context !== 'dashboard') {
      setLoaded(true);
      return;
    }
    fetch('/api/user-stats-summary')
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && d.stats) setStats(d.stats);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [context]);

  if (!loaded || hidden) return null;

  const suggestion = pickSuggestion(context, stats);
  if (!suggestion) return null;

  const handleDismiss = () => {
    dismiss(suggestion.id);
    setHidden(true);
  };

  return (
    <section
      aria-label="Next step"
      className={`rounded-2xl border bg-gradient-to-br ${TONE_STYLES[suggestion.tone]} p-4 sm:p-5 ${className}`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0" aria-hidden="true">{suggestion.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-bold text-base leading-snug">{suggestion.headline}</h3>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss for today"
              className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm leading-none px-1 flex-shrink-0"
            >×</button>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{suggestion.body}</p>
          <Link
            href={suggestion.cta.href}
            className="inline-flex items-center gap-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            {suggestion.cta.label} <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
