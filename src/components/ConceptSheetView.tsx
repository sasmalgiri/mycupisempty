'use client';

/**
 * Reads (or generates on demand) the per-chapter Concept Sheet — the one-page
 * must-know summary tailored to the student's learning style + persona.
 */

import { useEffect, useState } from 'react';

interface Sheet {
  must_know: Array<{ fact: string; why_it_matters: string; example?: string }>;
  formulas: Array<{ name: string; formula_md: string; when_to_use: string }>;
  common_mistakes: Array<{ mistake: string; why_wrong: string; fix: string }>;
  exam_pattern_tip: string;
}

export default function ConceptSheetView({ chapterId, language = 'bn', style, persona }: { chapterId: string; language?: string; style?: string; persona?: string }) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = new URLSearchParams({ chapterId, lang: language });
  if (style) params.set('style', style);
  if (persona) params.set('persona', persona);

  const load = (generate = false) => {
    if (generate) setGenerating(true); else setLoading(true);
    const p = new URLSearchParams(params.toString());
    if (generate) p.set('generate', '1');
    fetch(`/api/concept-sheet?${p.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) setError(d.error);
        else setSheet(d?.sheet || null);
      })
      .finally(() => { setLoading(false); setGenerating(false); });
  };
  useEffect(() => load(false), [chapterId, language, style, persona]);

  if (loading) return <p className="text-xs text-gray-500">Loading concept sheet…</p>;
  if (error) return <p className="text-xs text-rose-600">{error}</p>;
  if (!sheet) return (
    <div className="p-4 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 text-center">
      <p className="text-sm text-gray-600 dark:text-gray-400">No concept sheet yet for this chapter.</p>
      <button type="button" onClick={() => load(true)} disabled={generating} className="mt-2 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded text-xs font-semibold">
        {generating ? 'Generating…' : 'Generate one for me'}
      </button>
    </div>
  );

  return (
    <section className="rounded-2xl border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 space-y-4">
      <h3 className="font-bold text-base">📋 Must-know · one-page sheet</h3>

      {sheet.must_know?.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 mb-1">Facts</p>
          <ol className="space-y-1.5 list-decimal pl-5 text-sm">
            {sheet.must_know.map((m, i) => (
              <li key={i}>
                <strong>{m.fact}</strong>
                {m.why_it_matters && <span className="text-xs text-gray-600 dark:text-gray-400"> — {m.why_it_matters}</span>}
                {m.example && <p className="text-[11px] text-gray-500 italic">e.g. {m.example}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {sheet.formulas?.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 mb-1">Formulas / rules</p>
          <ul className="space-y-1.5 text-sm">
            {sheet.formulas.map((f, i) => (
              <li key={i} className="bg-white dark:bg-gray-900 rounded p-2">
                <p className="font-bold">{f.name}</p>
                <p className="font-mono text-xs">{f.formula_md}</p>
                <p className="text-[11px] text-gray-500">when: {f.when_to_use}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sheet.common_mistakes?.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300 mb-1">Common mistakes</p>
          <ul className="space-y-1.5 text-xs">
            {sheet.common_mistakes.map((m, i) => (
              <li key={i} className="bg-white dark:bg-gray-900 rounded p-2">
                <p>❌ <strong>{m.mistake}</strong> — {m.why_wrong}</p>
                <p>✅ <span className="text-emerald-700 dark:text-emerald-400">{m.fix}</span></p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sheet.exam_pattern_tip && (
        <p className="text-xs italic text-gray-700 dark:text-gray-300 border-l-2 border-indigo-400 pl-2">
          📝 {sheet.exam_pattern_tip}
        </p>
      )}
    </section>
  );
}
