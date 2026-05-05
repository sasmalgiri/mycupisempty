'use client';

/**
 * Pulls /api/yesterdays-mistake and shows a fresh question on the same
 * concept the student got wrong yesterday. Renders nothing if there's no
 * mistake to redo.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Mistake {
  evaluationId: string;
  chapterId: string;
  topicId: string | null;
  score: number;
  question: {
    id: string;
    question_text: string;
    question_type: string;
    marks: number;
    options: string[] | null;
  };
}

export default function YesterdaysMistakeCard() {
  const [data, setData] = useState<Mistake | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/yesterdays-mistake').then((r) => r.json()).then((d) => setData(d?.mistake || null)).finally(() => setLoaded(true));
  }, []);

  if (!loaded || !data) return null;

  return (
    <div className="mb-6 p-4 rounded-2xl border-2 border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20">
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden="true">🎯</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">Redo yesterday&apos;s mistake</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Score {Math.round(data.score * 100)}% · same idea, fresh question</p>
          <p className="font-medium text-sm mt-2 line-clamp-2">{data.question.question_text}</p>
        </div>
        <Link href={`/subjects/_/chapter/${data.chapterId}#q-${data.question.id}`} className="text-xs px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-semibold whitespace-nowrap">
          Try again →
        </Link>
      </div>
    </div>
  );
}
