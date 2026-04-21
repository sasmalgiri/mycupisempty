'use client';

/**
 * MyNotebook — a scrollable archive of the student's own reflections and
 * session pulses. Groups by day, oldest entries at the bottom.
 *
 * Read-write learners (and anyone curious) can flip through what past-them
 * thought and felt. No editing — this is a record, not a journal tool.
 */

import { useEffect, useState } from 'react';
import ReadAloudButton from './ReadAloudButton';

interface NotebookEntry {
  id: string;
  kind: 'reflection' | 'session_pulse';
  created_at: string;
  prompt?: string;
  body?: string;
  session_kind?: string;
  usefulness?: number;
  understood?: string;
  confusing?: string;
  difficulty_felt?: string;
  dimension_tags?: string[];
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (isSameDay(d, today)) return 'Today';
  if (isSameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function groupByDay(entries: NotebookEntry[]): Record<string, NotebookEntry[]> {
  const out: Record<string, NotebookEntry[]> = {};
  entries.forEach((e) => {
    const key = dayLabel(e.created_at);
    if (!out[key]) out[key] = [];
    out[key].push(e);
  });
  return out;
}

export default function MyNotebook() {
  const [entries, setEntries] = useState<NotebookEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/my-notebook')
      .then((r) => r.json())
      .then((d) => { if (d?.success) setEntries(d.entries || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-10 text-gray-500">Opening your notebook…</div>;
  }

  if (entries.length === 0) {
    return (
      <div className="p-8 bg-gray-800 rounded-2xl text-center">
        <div className="text-4xl mb-3">📓</div>
        <h3 className="font-bold text-lg text-white mb-1">Your notebook is empty</h3>
        <p className="text-sm text-gray-400">
          Reflections you write in Daily Mix and session pulses will collect here.
        </p>
      </div>
    );
  }

  const grouped = groupByDay(entries);
  const days = Object.keys(grouped);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">📓 My Notebook</h2>
        <p className="text-xs text-gray-500">{entries.length} entr{entries.length === 1 ? 'y' : 'ies'}</p>
      </div>

      {days.map((day) => (
        <div key={day}>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{day}</p>
          <div className="space-y-3">
            {grouped[day].map((e) => (
              <article key={e.id} className="p-4 bg-gray-800 border border-gray-700 rounded-xl">
                {e.kind === 'reflection' ? (
                  <>
                    {e.prompt && (
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-xs text-gray-400 italic flex-1">{e.prompt}</p>
                        {e.body && <ReadAloudButton text={() => `${e.prompt}. ${e.body}`} />}
                      </div>
                    )}
                    {e.body && (
                      <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{e.body}</p>
                    )}
                    {(e.dimension_tags?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {e.dimension_tags!.map((t) => (
                          <span key={t} className="text-[10px] px-2 py-0.5 bg-gray-700 text-gray-300 rounded-full">{t.replace(/_/g, ' ')}</span>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                        {e.session_kind?.replace(/_/g, ' ')} · pulse
                      </span>
                      {typeof e.usefulness === 'number' && (
                        <span className="text-xs text-gray-400">useful {e.usefulness}/5</span>
                      )}
                    </div>
                    {e.understood && <p className="text-sm text-emerald-300">✓ {e.understood}</p>}
                    {e.confusing && <p className="text-sm text-amber-300">? {e.confusing}</p>}
                    {e.difficulty_felt && (
                      <p className="text-xs text-gray-400 mt-1">felt: {e.difficulty_felt.replace(/_/g, ' ')}</p>
                    )}
                  </>
                )}
                <p className="text-[10px] text-gray-500 mt-2">
                  {new Date(e.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                </p>
              </article>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
