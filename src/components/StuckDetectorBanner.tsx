'use client';

/**
 * Surfaces active stuck-detections as a dismissible banner. When 3 consecutive
 * exit-evals on the same chapter score < 0.4 the API opens a detection; this
 * banner offers a remediation track. Auto-hides on resolve/decline.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Detection {
  id: string;
  chapter_id: string | null;
  topic_id: string | null;
  subject_id: string | null;
  avg_score: number | null;
  status: string;
}

export default function StuckDetectorBanner() {
  const [detections, setDetections] = useState<Detection[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => {
    fetch('/api/stuck-detect').then((r) => r.json()).then((d) => setDetections(d?.detections || [])).catch(() => {});
  };
  useEffect(refresh, []);

  if (!detections.length) return null;
  const top = detections[0];

  const accept = async () => {
    setBusy(top.id);
    try {
      await fetch('/api/stuck-detect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept_remediation', detectionId: top.id }),
      });
      refresh();
    } finally { setBusy(null); }
  };
  const decline = async () => {
    setBusy(top.id);
    try {
      await fetch('/api/stuck-detect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decline', detectionId: top.id }),
      });
      refresh();
    } finally { setBusy(null); }
  };

  const score = top.avg_score != null ? Math.round(top.avg_score * 100) : null;

  return (
    <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-amber-100/90 dark:bg-amber-950/60 border-b border-amber-300 dark:border-amber-800 backdrop-blur">
      <div className="max-w-4xl mx-auto flex items-center gap-3">
        <span className="text-lg" aria-hidden="true">🪜</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
            We notice this chapter is fighting back. {score != null ? `Last 3 attempts averaged ${score}%.` : ''}
          </p>
          <p className="text-[11px] text-amber-800 dark:text-amber-300">
            Want a slower remediation track — fewer questions, more worked examples, a fresh re-explanation?
          </p>
        </div>
        {top.status === 'remediation_running' ? (
          <Link href="/daily-mix" className="text-xs px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-semibold whitespace-nowrap">
            Continue track →
          </Link>
        ) : (
          <>
            <button type="button" onClick={accept} disabled={busy === top.id} className="text-xs px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded font-semibold whitespace-nowrap">
              Yes, slow it down
            </button>
            <button type="button" onClick={decline} disabled={busy === top.id} className="text-xs px-2 py-1.5 text-amber-800 dark:text-amber-300 hover:underline disabled:opacity-50">
              Not now
            </button>
          </>
        )}
      </div>
    </div>
  );
}
