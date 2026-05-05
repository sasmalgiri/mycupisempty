'use client';

/**
 * Wonder Hub — the curiosity gateway. Eight categories of "things you didn't
 * know" that bridge to curriculum topics. Live, DB-backed; refreshed by
 * the freshness pipeline (Phase 8).
 *
 * Reading a fact bumps view counts; saving builds a Wonder Wall on /me.
 * Each card shows a CurrencyBadge so the student can flag stale items.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import CurrencyBadge from '@/components/CurrencyBadge';

interface WonderFact {
  id: string;
  category: string;
  hook: string;
  body: string;
  source_url: string | null;
  language: string;
  last_verified_at: string;
  is_evergreen: boolean;
  related_topic_id: string | null;
  related_subject_id: string | null;
  saved_at?: string;
}

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  deep_sea:         { label: 'Deep Sea',          icon: '🌊' },
  outer_space:      { label: 'Outer Space',       icon: '🚀' },
  tiny_worlds:      { label: 'Tiny Worlds',       icon: '🧬' },
  history_weird:    { label: "History's Weird",   icon: '🏛️' },
  body_mysteries:   { label: 'Body Mysteries',    icon: '🧠' },
  math_magic:       { label: 'Math Magic',        icon: '🔢' },
  tech_hacks:       { label: 'Tech Hacks',        icon: '⚡' },
  nature_engineers: { label: "Nature's Engineers", icon: '🌍' },
};

export default function WonderPage() {
  const [tab, setTab] = useState<'feed' | 'saved'>('feed');
  const [category, setCategory] = useState<string>('all');
  const [items, setItems] = useState<WonderFact[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    const url = tab === 'saved'
      ? '/api/wonder?mode=saved'
      : `/api/wonder?mode=list${category !== 'all' ? `&category=${encodeURIComponent(category)}` : ''}&limit=24`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => setItems(d?.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab, category]);

  const toggleSave = async (fact: WonderFact) => {
    const isSaved = !!fact.saved_at || tab === 'saved';
    await fetch('/api/wonder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factId: fact.id, action: isSaved ? 'unsave' : 'save' }),
    });
    load();
  };

  const flag = async (fact: WonderFact) => {
    const reason = window.prompt('Why is this off? (stale / wrong / inappropriate / other)', 'stale');
    if (!reason) return;
    await fetch('/api/wonder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factId: fact.id, action: 'flag', reason: reason.trim() }),
    });
    alert('Thanks — your flag is in the review queue. You earn Honesty XP if it gets validated.');
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Wonder</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Things most people don&apos;t know. Each one bridges to a curriculum topic. Save what you love — your Wonder Wall remembers.
        </p>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => setTab('feed')} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${tab === 'feed' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}>Feed</button>
        <button type="button" onClick={() => setTab('saved')} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${tab === 'saved' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}>Wonder Wall</button>
      </div>

      {tab === 'feed' && (
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => setCategory('all')} className={`px-3 py-1 rounded-full text-xs font-medium border ${category === 'all' ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-200 dark:border-gray-700'}`}>All</button>
          {Object.entries(CATEGORY_META).map(([key, m]) => (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(key)}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${category === key ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-200 dark:border-gray-700'}`}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500 text-center py-12">Loading…</p>
      ) : items.length === 0 ? (
        <div className="p-10 rounded-2xl border border-gray-200 dark:border-gray-800 text-center">
          <div className="text-5xl mb-2">🌱</div>
          <p className="text-sm text-gray-500">
            {tab === 'saved' ? 'Your Wonder Wall is empty — save facts you love.' : 'No facts in this category yet. The freshness pipeline (daily) will add more.'}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {items.map((fact) => {
            const meta = CATEGORY_META[fact.category] || { label: fact.category, icon: '✨' };
            return (
              <article key={fact.id} className="p-4 rounded-2xl border-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                  <span>{meta.icon} {meta.label}</span>
                  <CurrencyBadge lastVerifiedAt={fact.last_verified_at} evergreen={fact.is_evergreen} />
                </div>
                <h3 className="font-bold text-base mb-1">{fact.hook}</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 leading-relaxed">{fact.body}</p>
                <div className="flex flex-wrap gap-2 items-center">
                  {fact.related_topic_id && (
                    <Link
                      href={`/subjects?topic=${fact.related_topic_id}`}
                      className="text-xs text-primary-600 hover:underline"
                    >
                      Dive deeper →
                    </Link>
                  )}
                  <button type="button" onClick={() => toggleSave(fact)} className="text-xs text-gray-500 hover:text-gray-800">
                    {tab === 'saved' || fact.saved_at ? '☆ Unsave' : '★ Save'}
                  </button>
                  <button type="button" onClick={() => flag(fact)} className="text-xs text-gray-400 hover:text-rose-600 ml-auto">
                    ⚑ Flag
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
