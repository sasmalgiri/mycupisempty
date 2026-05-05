'use client';

/**
 * Tricks library — mnemonics, memory palaces, math hacks, exam-cracking
 * shortcuts. Live, DB-backed; freshness pipeline can add more nightly.
 *
 * Each trick honestly states "when this works / when this fails" so the
 * student knows the scope. Helpful-count climbs when a student says it
 * helped; flag opens a content_flags review.
 */

import { useEffect, useState } from 'react';
import CurrencyBadge from '@/components/CurrencyBadge';

interface Trick {
  id: string;
  category: string;
  subject_slug: string | null;
  title: string;
  one_liner: string;
  walkthrough_md: string;
  when_it_works: string | null;
  when_it_fails: string | null;
  helpful_count: number;
  last_verified_at: string;
  is_evergreen: boolean;
  language: string;
  class_min: number;
  class_max: number;
}

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  mnemonic:           { label: 'Mnemonics',         icon: '🧠' },
  memory_palace:      { label: 'Memory Palaces',    icon: '🏛️' },
  math_trick:         { label: 'Math Tricks',       icon: '🔢' },
  english_grammar:    { label: 'Grammar Hacks',     icon: '📝' },
  physics_shortcut:   { label: 'Physics Shortcuts', icon: '⚡' },
  bio_mnemonic:       { label: 'Bio Mnemonics',     icon: '🧬' },
  exam_strategy:      { label: 'Exam Strategy',     icon: '🎯' },
  study_hack:         { label: 'Study Hacks',       icon: '💡' },
};

export default function TricksPage() {
  const [items, setItems] = useState<Trick[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>('all');
  const [subject, setSubject] = useState<string>('all');

  const load = () => {
    setLoading(true);
    const qs = new URLSearchParams({ limit: '40' });
    if (category !== 'all') qs.set('category', category);
    if (subject !== 'all') qs.set('subject', subject);
    fetch(`/api/tricks?${qs.toString()}`)
      .then((r) => r.json())
      .then((d) => setItems(d?.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [category, subject]);

  const markHelpful = async (id: string) => {
    await fetch('/api/tricks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trickId: id, action: 'helpful' }),
    });
    load();
  };

  const flag = async (id: string) => {
    const reason = window.prompt('Why is this off? (stale / wrong / inappropriate / other)', 'wrong');
    if (!reason) return;
    await fetch('/api/tricks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trickId: id, action: 'flag', reason: reason.trim() }),
    });
    alert('Thanks — flagged. You earn Honesty XP if validated.');
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Tricks</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          The hacks teachers and the best YouTubers actually use. Mnemonics, mental-math shortcuts, exam-room strategies. Each trick is honest about when it doesn&apos;t work.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={() => setCategory('all')} className={`px-3 py-1 rounded-full text-xs font-medium border ${category === 'all' ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-200 dark:border-gray-700'}`}>All</button>
        {Object.entries(CATEGORY_META).map(([k, m]) => (
          <button
            key={k}
            type="button"
            onClick={() => setCategory(k)}
            className={`px-3 py-1 rounded-full text-xs font-medium border ${category === k ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-200 dark:border-gray-700'}`}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {['all', 'math', 'science', 'english', 'hindi', 'bengali', 'social'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSubject(s)}
            className={`px-2 py-0.5 rounded-md text-[11px] font-mono border ${subject === s ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-300 dark:border-gray-700'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 text-center py-12">Loading tricks…</p>
      ) : items.length === 0 ? (
        <div className="p-10 rounded-2xl border border-gray-200 dark:border-gray-800 text-center">
          <div className="text-5xl mb-2">🪄</div>
          <p className="text-sm text-gray-500">
            No tricks for this filter yet. The freshness pipeline (daily) keeps adding more.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((t) => {
            const meta = CATEGORY_META[t.category] || { label: t.category, icon: '✨' };
            return (
              <article key={t.id} className="p-4 rounded-2xl border-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                  <span>{meta.icon} {meta.label}{t.subject_slug ? ` · ${t.subject_slug}` : ''}</span>
                  <CurrencyBadge lastVerifiedAt={t.last_verified_at} evergreen={t.is_evergreen} />
                </div>
                <h3 className="font-bold text-base mb-1">{t.title}</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 italic">{t.one_liner}</p>
                <pre className="text-sm whitespace-pre-wrap font-sans p-3 bg-gray-50 dark:bg-gray-800 rounded-lg leading-relaxed">{t.walkthrough_md}</pre>
                {(t.when_it_works || t.when_it_fails) && (
                  <div className="grid sm:grid-cols-2 gap-2 mt-3">
                    {t.when_it_works && (
                      <div className="text-xs p-2 rounded bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800">
                        <strong>Works for:</strong> {t.when_it_works}
                      </div>
                    )}
                    {t.when_it_fails && (
                      <div className="text-xs p-2 rounded bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800">
                        <strong>Fails for:</strong> {t.when_it_fails}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex gap-3 mt-3 text-xs">
                  <button type="button" onClick={() => markHelpful(t.id)} className="text-primary-600 hover:underline">👍 Helpful ({t.helpful_count})</button>
                  <button type="button" onClick={() => flag(t.id)} className="text-gray-400 hover:text-rose-600 ml-auto">⚑ Flag</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
