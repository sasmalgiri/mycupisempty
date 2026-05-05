'use client';

/**
 * DailyWonderCard — small dashboard widget showing today's Wonder fact.
 * Deterministic per-user-per-day so it doesn't shift mid-session.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import CurrencyBadge from './CurrencyBadge';

interface Fact {
  id: string;
  category: string;
  hook: string;
  body: string;
  last_verified_at: string;
  is_evergreen: boolean;
  related_topic_id: string | null;
}

export default function DailyWonderCard() {
  const [fact, setFact] = useState<Fact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/wonder?mode=daily')
      .then((r) => r.json())
      .then((d) => setFact(d?.item || null))
      .catch(() => setFact(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !fact) return null;

  return (
    <section className="rounded-2xl border-2 border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 p-4 sm:p-5 mb-6">
      <div className="flex items-center justify-between mb-2 text-xs">
        <span className="font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
          ✨ Today&apos;s wonder
        </span>
        <CurrencyBadge lastVerifiedAt={fact.last_verified_at} evergreen={fact.is_evergreen} />
      </div>
      <h3 className="font-bold text-base mb-1">{fact.hook}</h3>
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 leading-relaxed">{fact.body}</p>
      <div className="flex gap-3 text-xs">
        <Link href="/wonder" className="text-amber-700 dark:text-amber-300 hover:underline">More wonders →</Link>
        {fact.related_topic_id && (
          <Link href={`/subjects?topic=${fact.related_topic_id}`} className="text-primary-600 hover:underline">Connect to a lesson →</Link>
        )}
      </div>
    </section>
  );
}
