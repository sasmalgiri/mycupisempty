'use client';

/**
 * Renders 0..3 tricks linked to a chapter so the student sees memory hooks /
 * shortcuts inline while reading. Backed by /api/tricks?chapterId=...
 * (v_chapter_trick_links view in 029 is the SQL-side mirror).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Trick {
  id: string;
  title: string;
  one_liner: string;
  category: string;
  helpful_count: number;
}

const CATEGORY_ICONS: Record<string, string> = {
  mnemonic: '🧠', memory_palace: '🏛️', math_trick: '🔢', english_grammar: '📝',
  physics_shortcut: '⚡', bio_mnemonic: '🧬', exam_strategy: '🎯', study_hack: '💡',
};

export default function ChapterTricksSlot({ chapterId }: { chapterId: string }) {
  const [tricks, setTricks] = useState<Trick[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/tricks?chapterId=${encodeURIComponent(chapterId)}&limit=3`)
      .then((r) => r.json())
      .then((d) => setTricks(d?.items || []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [chapterId]);

  if (!loaded || tricks.length === 0) return null;

  return (
    <section className="rounded-2xl border-2 border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-sm">🪄 Tricks for this chapter</h3>
        <Link href="/tricks" className="text-[11px] text-purple-700 hover:underline">All tricks →</Link>
      </div>
      <ul className="space-y-2">
        {tricks.map((t) => (
          <li key={t.id} className="bg-white dark:bg-gray-900 rounded-lg p-3 text-xs">
            <div className="flex items-center gap-2 mb-0.5">
              <span aria-hidden="true">{CATEGORY_ICONS[t.category] || '🪄'}</span>
              <span className="font-bold">{t.title}</span>
              <span className="ml-auto text-[10px] text-gray-500">👍 {t.helpful_count}</span>
            </div>
            <p className="text-gray-700 dark:text-gray-300">{t.one_liner}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
