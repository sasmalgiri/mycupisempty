'use client';

/**
 * Subject Blogs — short class-tagged digests, one stream per subject.
 * Live, DB-backed; the freshness pipeline (Phase 8) feeds it from
 * trusted sources (NASA, ISRO, Nature, etc.) translated to the student's
 * grade level.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import CurrencyBadge from '@/components/CurrencyBadge';

interface Blog {
  id: string;
  subject_slug: string;
  title: string;
  slug: string;
  body_md: string;
  reading_minutes: number | null;
  language: string;
  class_min: number;
  class_max: number;
  related_topic_id: string | null;
  source_url: string | null;
  is_evergreen: boolean;
  last_verified_at: string;
  published_at: string;
}

const SUBJECTS = ['math', 'science', 'english', 'hindi', 'bengali', 'social', 'computer'];

export default function BlogsPage() {
  const [items, setItems] = useState<Blog[]>([]);
  const [subject, setSubject] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    const qs = new URLSearchParams({ limit: '24' });
    if (subject !== 'all') qs.set('subject', subject);
    fetch(`/api/blogs?${qs.toString()}`)
      .then((r) => r.json())
      .then((d) => setItems(d?.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [subject]);

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Subject Blogs</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Short, class-tagged digests of new science, math, and humanities — drawn daily from sources we trust (NASA, ISRO, Nature, NPTEL, others). Each one is dated; flag anything that reads off.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={() => setSubject('all')} className={`px-3 py-1 rounded-full text-xs font-medium border ${subject === 'all' ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-200 dark:border-gray-700'}`}>All subjects</button>
        {SUBJECTS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSubject(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border capitalize ${subject === s ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-200 dark:border-gray-700'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 text-center py-12">Loading…</p>
      ) : items.length === 0 ? (
        <div className="p-10 rounded-2xl border border-gray-200 dark:border-gray-800 text-center">
          <div className="text-5xl mb-2">📰</div>
          <p className="text-sm text-gray-500">No blogs in this subject yet. The freshness pipeline writes them daily.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {items.map((b) => (
            <article key={b.id} className="p-4 rounded-2xl border-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                <span className="capitalize font-mono">{b.subject_slug} · cls {b.class_min}-{b.class_max}</span>
                <CurrencyBadge lastVerifiedAt={b.last_verified_at} evergreen={b.is_evergreen} />
              </div>
              <h3 className="font-bold text-base mb-1">{b.title}</h3>
              <p className="text-xs text-gray-500 mb-2">
                {b.reading_minutes ? `${b.reading_minutes} min read · ` : ''}
                {new Date(b.published_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 leading-relaxed">
                {b.body_md.slice(0, 240)}{b.body_md.length > 240 ? '…' : ''}
              </p>
              <div className="flex gap-2 text-xs">
                <Link href={`/blogs/${b.slug}`} className="text-primary-600 hover:underline">Read full →</Link>
                {b.related_topic_id && (
                  <Link href={`/subjects?topic=${b.related_topic_id}`} className="text-gray-500 hover:underline ml-auto">Connected lesson →</Link>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
