'use client';

/**
 * ExplainDifferently — drop-in button for any chapter / topic surface.
 * Click → modal with style picker → fetches /api/explain (cached per
 * user-chapter-topic-style) → renders the original walkthrough with a
 * helpful / not-helpful rating.
 *
 * Persistence handled by /api/explain. Cached re-reads return instantly.
 */

import { useState } from 'react';

type Style = 'analogy' | 'step_by_step' | 'story' | 'visual_described' | 'numerical_walkthrough' | 'predict_then_reveal';

const STYLE_OPTIONS: Array<{ id: Style; label: string; icon: string; hint: string }> = [
  { id: 'analogy',                label: 'With an analogy',     icon: '🪢', hint: 'Compare it to something I already know' },
  { id: 'step_by_step',           label: 'Step by step',         icon: '📋', hint: 'Numbered steps, no rush' },
  { id: 'story',                  label: 'As a story',           icon: '📖', hint: 'A character meets the idea' },
  { id: 'visual_described',       label: 'As a picture I can sketch', icon: '✏️', hint: 'Describe a diagram in words' },
  { id: 'numerical_walkthrough',  label: 'With real numbers',    icon: '🔢', hint: 'One worked example, slowly' },
  { id: 'predict_then_reveal',    label: 'Predict-then-reveal',  icon: '❓', hint: 'I guess first, then you tell me' },
];

interface Props {
  chapterId: string;
  topicId?: string;
  className?: string;
}

export default function ExplainDifferently({ chapterId, topicId, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<Style | null>(null);
  const [confusion, setConfusion] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ id: string; body_md: string; cached?: boolean; source?: string } | null>(null);
  const [helpful, setHelpful] = useState<boolean | null>(null);

  const fetchExplanation = async (chosenStyle: Style, force = false) => {
    setBusy(true);
    setResult(null);
    setHelpful(null);
    try {
      const params = new URLSearchParams({ chapterId, style: chosenStyle });
      if (topicId) params.set('topicId', topicId);
      if (confusion.trim()) params.set('q', confusion.trim());
      if (force) params.set('force', '1');
      const res = await fetch(`/api/explain?${params.toString()}`);
      const json = await res.json();
      if (json?.success && json.explanation) {
        setResult({
          id: json.explanation.id,
          body_md: json.explanation.body_md,
          cached: json.cached,
          source: json.source,
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const rate = async (value: boolean) => {
    if (!result) return;
    setHelpful(value);
    try {
      await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ explanationId: result.id, helpful: value }),
      });
    } catch { /* non-fatal */ }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-purple-300 bg-purple-50 hover:bg-purple-100 text-xs font-semibold text-purple-700 dark:bg-purple-950/30 dark:border-purple-800 dark:text-purple-300 ${className}`}
      >
        <span>🤔</span> Explain this differently
      </button>
    );
  }

  return (
    <section className="rounded-2xl border-2 border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-base">🤔 Explain it differently</h3>
        <button type="button" onClick={() => { setOpen(false); setResult(null); setStyle(null); }} className="text-xs text-gray-500 hover:text-gray-800">Close</button>
      </div>

      {!result && (
        <>
          <p className="text-xs text-gray-700 dark:text-gray-300 mb-2">
            What didn&apos;t click? (optional — we&apos;ll tailor the re-explanation)
          </p>
          <textarea
            value={confusion}
            onChange={(e) => setConfusion(e.target.value)}
            placeholder="e.g. I don't get why we have to flip the inequality sign…"
            rows={2}
            maxLength={500}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm mb-3"
          />
          <p className="text-xs text-gray-700 dark:text-gray-300 mb-2">Pick a style:</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {STYLE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => { setStyle(opt.id); fetchExplanation(opt.id); }}
                disabled={busy}
                className={`text-left p-2 rounded-lg border-2 transition-colors ${
                  style === opt.id
                    ? 'border-purple-500 bg-purple-100 dark:bg-purple-900/40'
                    : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span>{opt.icon}</span> {opt.label}
                </div>
                <p className="text-[10px] text-gray-500 mt-0.5">{opt.hint}</p>
              </button>
            ))}
          </div>
          {busy && <p className="text-xs text-gray-500 mt-3 text-center">Thinking of a fresh way to put it…</p>}
        </>
      )}

      {result && (
        <>
          <pre className="text-sm whitespace-pre-wrap font-sans p-3 bg-white dark:bg-gray-900 rounded-lg leading-relaxed mb-3">
            {result.body_md}
          </pre>
          <div className="flex items-center gap-2 text-xs flex-wrap">
            {result.cached && <span className="text-gray-500">📌 You&apos;ve seen this before</span>}
            {result.source === 'fallback' && <span className="text-amber-600">⚠ AI not configured — generic fallback</span>}
            <span className="ml-auto flex gap-2">
              <button type="button" onClick={() => rate(true)} disabled={helpful === true} className={`px-2 py-1 rounded-full text-[11px] font-semibold ${helpful === true ? 'bg-emerald-200 text-emerald-800' : 'border border-gray-300 hover:bg-emerald-50'}`}>
                👍 Helpful
              </button>
              <button type="button" onClick={() => rate(false)} disabled={helpful === false} className={`px-2 py-1 rounded-full text-[11px] font-semibold ${helpful === false ? 'bg-rose-200 text-rose-800' : 'border border-gray-300 hover:bg-rose-50'}`}>
                👎 Still not getting it
              </button>
              {style && (
                <button type="button" onClick={() => fetchExplanation(style, true)} disabled={busy} className="px-2 py-1 rounded-full text-[11px] font-semibold border border-gray-300 hover:bg-purple-50">
                  🔁 Try again
                </button>
              )}
            </span>
          </div>
          {helpful === false && (
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-2 italic">
              Try a different style above — sometimes &quot;as a story&quot; or &quot;with real numbers&quot; clicks when an analogy doesn&apos;t.
            </p>
          )}
        </>
      )}
    </section>
  );
}
