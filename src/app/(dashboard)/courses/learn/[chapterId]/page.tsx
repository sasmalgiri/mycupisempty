'use client';

/**
 * Per-chapter Q&A page — exhaustive question bank grouped by type, with
 * model answers and step-by-step working. Each question can be flagged.
 * The "Explain Differently" button sits at the top so a stuck student
 * never has to leave the page.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ExplainDifferently from '@/components/ExplainDifferently';

interface Question {
  id: string;
  chapter_id: string;
  question_text: string;
  answer_text: string;
  working: string | null;
  options: string[] | null;
  correct_index: number | null;
  question_type: string;
  marks: number;
  difficulty: string;
  cognitive_level: number;
  source: string;
  source_paper_year: number | null;
  source_paper_label: string | null;
  confidence: number;
  verified_at: string | null;
  language: string;
  tags: string[];
}

const TYPE_META: Record<string, { label: string; icon: string; order: number }> = {
  mcq:           { label: 'Multiple choice',       icon: '🔘', order: 1 },
  very_short:    { label: 'Very short',            icon: '✏️', order: 2 },
  short:         { label: 'Short answer',          icon: '📝', order: 3 },
  long:          { label: 'Long answer',           icon: '📄', order: 4 },
  application:   { label: 'Application',           icon: '🎯', order: 5 },
  hots:          { label: 'Higher-order thinking', icon: '🧠', order: 6 },
  match:         { label: 'Match the following',   icon: '🔗', order: 7 },
  fill_blank:    { label: 'Fill in the blank',     icon: '⏳', order: 8 },
  true_false:    { label: 'True or false',         icon: '✓✗', order: 9 },
};

export default function ChapterLearnPage() {
  const params = useParams();
  const chapterId = String(params?.chapterId);
  const [grouped, setGrouped] = useState<Record<string, Question[]>>({});
  const [chapter, setChapter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});

  useEffect(() => {
    Promise.all([
      fetch(`/api/qbank?chapterId=${chapterId}`).then((r) => r.json()),
      // We don't have a /api/chapters endpoint yet; the qbank response
      // includes per-question chapter_id. For chapter title, hit courses API
      // when present — for now display the chapterId as a fallback header.
    ]).then(([qb]) => {
      setGrouped(qb?.grouped || {});
    }).finally(() => setLoading(false));
  }, [chapterId]);

  const reveal = (id: string) => setRevealed({ ...revealed, [id]: !revealed[id] });

  const flag = async (id: string) => {
    if (flagged[id]) return;
    setFlagged({ ...flagged, [id]: true });
    await fetch('/api/qbank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'flag', questionId: id }),
    }).catch(() => {});
  };

  const orderedTypes = Object.keys(grouped).sort((a, b) => (TYPE_META[a]?.order || 99) - (TYPE_META[b]?.order || 99));
  const totalQuestions = Object.values(grouped).reduce((s, arr) => s + arr.length, 0);

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      <Link href="/courses" className="text-sm text-primary-600 hover:underline">← Back to courses</Link>

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Chapter Q&amp;A</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Every question type a school exam might ask — with model answers and working. Tap to reveal each answer.
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {totalQuestions} question{totalQuestions === 1 ? '' : 's'} on file.
        </p>
      </div>

      <ExplainDifferently chapterId={chapterId} />

      {loading ? (
        <p className="text-sm text-gray-500 text-center py-12">Loading questions…</p>
      ) : totalQuestions === 0 ? (
        <div className="p-10 rounded-2xl border border-gray-200 dark:border-gray-800 text-center">
          <div className="text-5xl mb-2">📝</div>
          <p className="text-sm text-gray-500">No questions populated for this chapter yet.</p>
          <p className="text-xs text-gray-400 mt-1">Admin: run /api/qbank/generate with this chapterId.</p>
        </div>
      ) : (
        orderedTypes.map((type) => {
          const meta = TYPE_META[type] || { label: type, icon: '❓', order: 99 };
          const list = grouped[type] || [];
          return (
            <section key={type} className="rounded-2xl border-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
              <h2 className="font-bold mb-3 flex items-center gap-2">
                <span>{meta.icon}</span> {meta.label}
                <span className="text-xs font-mono text-gray-500 ml-auto">{list.length}</span>
              </h2>
              <ol className="space-y-3">
                {list.map((q, idx) => (
                  <li key={q.id} className="border-t border-gray-100 dark:border-gray-800 pt-3">
                    <div className="flex items-start gap-2 mb-1">
                      <span className="font-mono text-xs text-gray-500 mt-0.5">Q{idx + 1}.</span>
                      <p className="flex-1 text-sm font-medium">{q.question_text}</p>
                      <span className="text-[10px] font-mono text-gray-500 whitespace-nowrap">
                        [{q.marks}m · {q.difficulty}]
                      </span>
                    </div>

                    {q.options && q.options.length > 0 && (
                      <ol className="ml-7 mt-2 space-y-1 text-xs">
                        {q.options.map((opt, i) => (
                          <li key={i} className={revealed[q.id] && q.correct_index === i ? 'font-bold text-emerald-700 dark:text-emerald-300' : ''}>
                            ({String.fromCharCode(97 + i)}) {opt}{revealed[q.id] && q.correct_index === i ? ' ← correct' : ''}
                          </li>
                        ))}
                      </ol>
                    )}

                    {revealed[q.id] && (
                      <div className="ml-7 mt-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Answer</p>
                        <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{q.answer_text}</p>
                        {q.working && (
                          <>
                            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mt-2">Working / reasoning</p>
                            <pre className="text-xs whitespace-pre-wrap font-sans text-gray-700 dark:text-gray-300">{q.working}</pre>
                          </>
                        )}
                        {q.source_paper_label && (
                          <p className="text-[10px] text-gray-500 mt-2">Source: {q.source_paper_label}{q.source_paper_year ? ` (${q.source_paper_year})` : ''}</p>
                        )}
                      </div>
                    )}

                    <div className="flex gap-3 mt-2 ml-7 text-xs">
                      <button type="button" onClick={() => reveal(q.id)} className="text-primary-600 hover:underline">
                        {revealed[q.id] ? 'Hide answer' : 'Show answer'}
                      </button>
                      {q.source === 'ai_generated' && (q.confidence < 0.7 || !q.verified_at) && (
                        <button type="button" onClick={() => flag(q.id)} disabled={flagged[q.id]} className="text-gray-400 hover:text-rose-600 ml-auto">
                          {flagged[q.id] ? '⚑ flagged' : '⚑ Flag'}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          );
        })
      )}
    </div>
  );
}
