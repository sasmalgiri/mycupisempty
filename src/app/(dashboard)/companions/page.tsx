'use client';

/**
 * Companions Dashboard — see every subject companion, rapport, recent reports,
 * and the live main-brain directives flowing between them.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import RichContent from '@/components/RichContent';
import CompanionChat from '@/components/CompanionChat';

interface CompanionDetail {
  companionId: string;
  subjectId: string;
  subjectName?: string;
  report: {
    sentimentWindow: string;
    urgentFlags: string[];
    breakthroughs: string[];
    concerns: string[];
    recommendedAction: string;
  };
  rapport: {
    strength: number;
    tone: string;
    humorWelcomed: boolean;
    trustSignals: number;
    frictionSignals: number;
  };
  sessionCount: number;
  facts: string[];
}

interface Directive {
  id: string;
  type: string;
  reason: string;
  appliesTo: string | string[];
  expiresAt: string;
  sourceCompanionId?: string;
  params?: Record<string, any>;
}

interface Snapshot {
  overallSentiment: string;
  crossSubjectPatterns: string[];
  recommendedFocusThisWeek: string;
  activeDirectives: Directive[];
}

const SENTIMENT_COLOR: Record<string, string> = {
  flourishing: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  steady: 'bg-blue-100 text-blue-800 border-blue-300',
  strained: 'bg-amber-100 text-amber-800 border-amber-300',
  mixed: 'bg-purple-100 text-purple-800 border-purple-300',
  unknown: 'bg-gray-100 text-gray-700 border-gray-300',
};

const DIRECTIVE_EMOJI: Record<string, string> = {
  ease_up: '🫱', push_harder: '💪', celebrate: '🎉', focus_area: '🎯',
  cross_insight: '🔗', shorten_session: '⏱', switch_modality: '🔄', watch_for: '👀',
};

export default function CompanionsDashboard() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [companions, setCompanions] = useState<CompanionDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompanion, setSelectedCompanion] = useState<CompanionDetail | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selfLearning, setSelfLearning] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [brainRes, learningRes] = await Promise.all([
        fetch('/api/main-brain').then(r => r.json()).catch(() => null),
        fetch('/api/self-learning').then(r => r.json()).catch(() => null),
      ]);
      if (brainRes?.success) {
        setSnapshot(brainRes.snapshot);
        setCompanions(brainRes.companionDetails || []);
      }
      if (learningRes?.success) setSelfLearning(learningRes);
    } finally {
      setLoading(false);
    }
  };

  const refreshBrain = async () => {
    setRefreshing(true);
    try {
      await fetch('/api/main-brain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh' }),
      });
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return <div className="max-w-6xl mx-auto p-8 text-center text-gray-500">Loading your companions…</div>;
  }

  if (selectedCompanion) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <button
          type="button"
          onClick={() => setSelectedCompanion(null)}
          aria-label="Back"
          className="mb-4 text-sm font-semibold text-primary-600"
        >← All companions</button>
        <CompanionChat
          subjectId={selectedCompanion.subjectId}
          subjectName={selectedCompanion.subjectName || 'Subject'}
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Your Companions</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Each subject has its own AI companion. They observe you, learn about you, and report to the main brain.</p>
        </div>
        <button
          type="button"
          onClick={refreshBrain}
          disabled={refreshing}
          aria-label="Refresh brain"
          className="px-4 py-2 text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-60"
        >{refreshing ? 'Refreshing…' : '🔄 Refresh brain'}</button>
      </div>

      {snapshot && (
        <section className={`p-5 rounded-2xl border-2 ${SENTIMENT_COLOR[snapshot.overallSentiment] || SENTIMENT_COLOR.unknown}`}>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider opacity-70">Main Brain · Overall</span>
              <h2 className="text-lg font-bold capitalize">{snapshot.overallSentiment}</h2>
            </div>
            <span className="text-xs opacity-70">{snapshot.activeDirectives.length} active directive{snapshot.activeDirectives.length === 1 ? '' : 's'}</span>
          </div>
          <p className="text-sm font-medium">{snapshot.recommendedFocusThisWeek}</p>
          {snapshot.crossSubjectPatterns.length > 0 && (
            <ul className="mt-2 text-xs space-y-0.5 opacity-90">
              {snapshot.crossSubjectPatterns.map((p, i) => (
                <li key={i}>• {p}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {snapshot && snapshot.activeDirectives.length > 0 && (
        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <h3 className="font-bold mb-2">Live directives to companions</h3>
          <p className="text-xs text-gray-500 mb-3">Instructions the main brain is pushing to every companion right now.</p>
          <ul className="space-y-2">
            {snapshot.activeDirectives.map((d) => (
              <li key={d.id} className="flex gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
                <span className="text-xl flex-shrink-0">{DIRECTIVE_EMOJI[d.type] || '•'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold capitalize">{d.type.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{d.reason}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Applies to: {d.appliesTo === 'all' ? 'all companions' : Array.isArray(d.appliesTo) ? d.appliesTo.join(', ') : d.appliesTo}
                    {d.sourceCompanionId && ` · from ${d.sourceCompanionId}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-lg font-bold mb-3">Per-subject companions</h2>
        {companions.length === 0 ? (
          <div className="p-8 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl text-center">
            <div className="text-4xl mb-3">🤝</div>
            <h3 className="font-bold text-lg mb-2">Your companions are waiting to meet you</h3>
            <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
              Each subject has its own guide — Aryabhata for Math, Nambi Narayanan for Science, Tagore for English, and more. Start a subject to wake one up.
            </p>
            <div className="flex gap-2 justify-center flex-wrap">
              <Link href="/daily-mix" className="inline-block px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold">▶ Start Daily Mix</Link>
              <Link href="/subjects" className="inline-block px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-sm">Or browse subjects</Link>
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {companions.map((c) => (
              <button
                key={c.companionId + c.subjectId}
                type="button"
                onClick={() => setSelectedCompanion(c)}
                aria-label={`Open ${c.subjectName} companion`}
                className="text-left p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl hover:border-primary-400 hover:shadow-lg transition"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold">{c.subjectName || 'Subject'}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${SENTIMENT_COLOR[c.report?.sentimentWindow] || SENTIMENT_COLOR.unknown}`}>
                    {c.report?.sentimentWindow || 'unknown'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-2 capitalize">{c.companionId} · {c.sessionCount} session{c.sessionCount === 1 ? '' : 's'}</p>

                {/* Rapport meter */}
                <div className="mb-2">
                  <div className="flex items-center justify-between text-[10px] text-gray-500 mb-0.5">
                    <span>Rapport · {c.rapport?.tone}</span>
                    <span>{c.rapport?.strength}/100</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary-400 to-secondary-400"
                      style={{ width: `${c.rapport?.strength || 0}%` }}
                    />
                  </div>
                </div>

                {c.report?.recommendedAction && (
                  <p className="text-xs text-gray-700 dark:text-gray-300 mb-2 italic">
                    &ldquo;{c.report.recommendedAction}&rdquo;
                  </p>
                )}

                {c.report?.breakthroughs?.length > 0 && (
                  <div className="mb-1 text-[10px] text-emerald-700 dark:text-emerald-300">🎉 {c.report.breakthroughs[0]}</div>
                )}
                {c.report?.urgentFlags?.length > 0 && (
                  <div className="text-[10px] text-amber-700 dark:text-amber-300">⚠ {c.report.urgentFlags[0]}</div>
                )}

                {c.facts?.length > 0 && (
                  <ul className="mt-2 text-[10px] text-gray-500 space-y-0.5">
                    {c.facts.slice(0, 2).map((f, i) => <li key={i}>• {f}</li>)}
                  </ul>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Self-learning panel */}
      {selfLearning && (
        <section className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-800 p-5">
          <h3 className="font-bold mb-2">🧠 What the system has learned</h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">{selfLearning.message}</p>
          {selfLearning.topActions?.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold">Top performing actions in your context:</p>
              {selfLearning.topActions.slice(0, 5).map((a: any) => (
                <div key={a.actionKey} className="flex items-center gap-2 text-xs">
                  <div className="flex-1 font-mono text-gray-700 dark:text-gray-300 truncate">{a.actionKey}</div>
                  <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, a.meanReward * 100))}%` }} />
                  </div>
                  <span className="w-14 text-right text-gray-500">n={a.sampleSize}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-gray-500 mt-3">
            Your personal resolved experiences: {selfLearning.personalExperienceCount ?? 0}. As more students interact, context-specific priors sharpen for everyone.
          </p>
        </section>
      )}
    </div>
  );
}
