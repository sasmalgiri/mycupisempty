'use client';

/**
 * FirstSessionCard — shows only to brand-new students who haven't completed
 * any Daily Mix yet. One clear CTA to get them started without decision
 * paralysis from the 10+ features in the sidebar.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function FirstSessionCard() {
  const [show, setShow] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/user-stats-summary');
        const data = await res.json();
        // Only show if the student has never earned XP
        if (data?.stats && (data.stats.total_xp || 0) === 0 && !data.stats.last_activity_date) {
          setShow(true);
        }
      } catch {}
      setChecked(true);
    })();
  }, []);

  if (!checked || !show) return null;

  return (
    <section className="mb-6 p-6 rounded-2xl bg-gradient-to-br from-primary-500 via-primary-600 to-secondary-600 text-white shadow-lg">
      <p className="text-xs font-semibold uppercase tracking-wider opacity-90 mb-2">Your first session</p>
      <h2 className="text-xl sm:text-2xl font-bold mb-2">Start small. 5 focused minutes today.</h2>
      <p className="text-sm opacity-90 mb-4 leading-relaxed">
        Don&apos;t try to use everything at once. A short Daily Mix gives your companions their first look at how you think — and sets the stage for everything else.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/daily-mix"
          className="px-5 py-2.5 bg-white text-primary-700 hover:bg-gray-50 rounded-lg font-semibold text-sm inline-flex items-center gap-2"
        >
          ▶ Start Daily Mix
        </Link>
        <Link
          href="/subjects"
          className="px-4 py-2.5 bg-white/20 hover:bg-white/30 rounded-lg font-medium text-sm"
        >
          Or browse subjects
        </Link>
      </div>
    </section>
  );
}
