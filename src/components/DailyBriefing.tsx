'use client';

/**
 * DailyBriefing — the first thing the student sees today.
 *
 * Fetches /api/daily-briefing, shows headline + each companion's one-liner,
 * and lists today's priority actions. Dismissible (with localStorage so it
 * doesn't re-appear the same day).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Section {
  companionId: string;
  companionName: string;
  companionAvatar: string;
  subjectName: string;
  line: string;
  sentiment: string;
  rapport: number;
}

interface Action {
  kind: 'review' | 'fix' | 'stretch' | 'start';
  label: string;
  href: string;
}

interface Briefing {
  generatedAt: string;
  greeting: string;
  sections: Section[];
  todayActions: Action[];
  dailyThought?: { title: string; body: string };
  characterGoal?: string | null;
  characterNudge?: string | null;
  streak: number;
  studiedToday: boolean;
}

const ACTION_ICONS: Record<string, string> = {
  review: '🔁', fix: '🛠', stretch: '🚀', start: '▶',
};

const SENTIMENT_ACCENT: Record<string, string> = {
  flourishing: 'border-l-emerald-500',
  steady: 'border-l-blue-500',
  strained: 'border-l-amber-500',
  unknown: 'border-l-gray-400',
};

function dismissKey(): string {
  const d = new Date();
  return `mcie_briefing_${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export default function DailyBriefing() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(dismissKey()) === '1') { setDismissed(true); return; }
    } catch {}
    fetch('/api/daily-briefing')
      .then(r => r.json())
      .then(d => { if (d.success) setBriefing(d.briefing); })
      .catch(() => {});
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(dismissKey(), '1'); } catch {}
  };

  if (dismissed || !briefing) return null;

  return (
    <section className="mb-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-indigo-950/40 dark:via-gray-900 dark:to-purple-950/40 overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Your companions say</p>
            <h2 className="text-lg sm:text-xl font-bold leading-tight">{briefing.greeting}</h2>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss briefing"
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xl leading-none px-2"
          >×</button>
        </div>

        {briefing.sections.length > 0 && (
          <ul className="space-y-2 mb-4">
            {briefing.sections.map((s) => (
              <li
                key={s.companionId + s.subjectName}
                className={`flex items-start gap-3 p-2 rounded-lg bg-white/60 dark:bg-gray-900/60 border-l-4 ${SENTIMENT_ACCENT[s.sentiment] || SENTIMENT_ACCENT.unknown}`}
              >
                <span className="text-xl flex-shrink-0" aria-hidden="true">{s.companionAvatar}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-gray-100">{s.line}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{s.subjectName} · rapport {s.rapport}/100</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {briefing.todayActions.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">Today, try</p>
            <div className="flex flex-wrap gap-2">
              {briefing.todayActions.map((a, i) => (
                <Link
                  key={i}
                  href={a.href}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-primary-400 text-sm font-medium transition-colors"
                >
                  <span>{ACTION_ICONS[a.kind] || '•'}</span>
                  {a.label}
                </Link>
              ))}
            </div>
          </div>
        )}

        {briefing.characterNudge && briefing.characterGoal && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-300 mb-1">
              🌱 Your character goal: {briefing.characterGoal.replace(/_/g, ' ')}
            </p>
            <p className="text-sm text-gray-800 dark:text-gray-100">{briefing.characterNudge}</p>
          </div>
        )}

        {briefing.dailyThought && (
          <div className="mt-3 p-3 rounded-lg bg-white/40 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800">
            <p className="text-xs italic text-gray-700 dark:text-gray-300">&ldquo;{briefing.dailyThought.body}&rdquo;</p>
          </div>
        )}

        {briefing.streak > 0 && (
          <p className="mt-3 text-xs text-gray-500">🔥 {briefing.streak}-day streak{briefing.studiedToday ? ' · keep going' : ' · alive today'}</p>
        )}
      </div>
    </section>
  );
}
