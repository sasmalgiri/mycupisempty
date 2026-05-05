'use client';

/**
 * GuardedVideoPlayer — embed YouTube/etc. with strict distraction controls.
 *
 * Guardrails enforced here (UI):
 *   - "Set a watch goal" pre-roll (forces an intentional commit)
 *   - Embedded in our frame; we never link out to youtube.com
 *   - Tab-blur counter — leaving the tab is logged, used in the retrieval
 *     scoring afterward
 *   - Post-watch retrieval questions GATE the XP — students can't farm
 *     watch-time without reading
 *   - Hard daily/session cap is enforced server-side in /api/videos
 *
 * IMPORTANT: youtube embed parameters force the cleanest experience:
 *   rel=0           → no related videos
 *   modestbranding=1
 *   iv_load_policy=3 → no annotations
 *   disablekb=1     → no keyboard shortcuts
 *   fs=0            → no fullscreen (keeps them in-frame)
 *   cc_load_policy=1 → captions on
 */

import { useEffect, useRef, useState } from 'react';

interface RetrievalQuestion {
  prompt: string;
  expected: string;
  hint?: string;
}

interface Props {
  videoId: string;             // our internal external_videos.id
  externalId: string;          // YouTube video id
  title: string;
  channel: string;
  durationSec: number | null;
  retrievalQuestions: RetrievalQuestion[];
  onCompleted: (info: { watchedSec: number; retrievalScore: number; blurCount: number }) => void;
}

type Phase = 'goal' | 'watching' | 'retrieval' | 'done' | 'capped';

export default function GuardedVideoPlayer({ videoId, externalId, title, channel, durationSec, retrievalQuestions, onCompleted }: Props) {
  const [phase, setPhase] = useState<Phase>('goal');
  const [goalSec, setGoalSec] = useState<number>(durationSec || 300);
  const [error, setError] = useState<string | null>(null);
  const startedAtRef = useRef<number>(0);
  const blurCountRef = useRef<number>(0);
  const [retrievalIdx, setRetrievalIdx] = useState(0);
  const [retrievalAnswers, setRetrievalAnswers] = useState<string[]>(retrievalQuestions.map(() => ''));

  useEffect(() => {
    if (phase !== 'watching') return;
    const onBlur = () => { blurCountRef.current += 1; };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [phase]);

  const startWatch = async () => {
    try {
      const res = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, action: 'start' }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 429) setPhase('capped');
        setError(json?.error || 'Could not start.');
        return;
      }
      startedAtRef.current = Date.now();
      setPhase('watching');
    } catch (err: any) {
      setError(err?.message || 'Network error.');
    }
  };

  const finishWatching = () => {
    setPhase('retrieval');
  };

  const submitRetrieval = async () => {
    const watchedSec = Math.round((Date.now() - startedAtRef.current) / 1000);
    // Score retrieval loosely: % of expected keyword hits across answers.
    let hits = 0;
    let total = 0;
    for (let i = 0; i < retrievalQuestions.length; i++) {
      const expected = retrievalQuestions[i].expected.toLowerCase().split(/[\s,]+/).filter((w) => w.length >= 3);
      const ans = retrievalAnswers[i].toLowerCase();
      total += expected.length;
      for (const w of expected) if (ans.includes(w)) hits += 1;
    }
    const retrievalScore = total > 0 ? hits / total : 0;

    await fetch('/api/videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId,
        action: 'complete',
        watchedSeconds: watchedSec,
        blurCount: blurCountRef.current,
        completedRetrieval: true,
        retrievalScore,
      }),
    });

    setPhase('done');
    onCompleted({ watchedSec, retrievalScore, blurCount: blurCountRef.current });
  };

  if (phase === 'capped') {
    return (
      <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-5 text-sm">
        <strong>Daily video limit reached.</strong> {error || 'Come back tomorrow — this guardrail keeps videos from displacing active practice.'}
      </div>
    );
  }

  if (phase === 'goal') {
    return (
      <div className="rounded-2xl border-2 border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 p-5">
        <h3 className="font-bold text-base mb-1">{title}</h3>
        <p className="text-xs text-gray-500 mb-3">{channel}{durationSec ? ` · ${Math.round(durationSec / 60)} min` : ''}</p>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
          Before you watch — set a goal. After, two short questions check what stuck. Tab switches are tracked. Hard cap: 2 videos / day.
        </p>
        <label className="block text-xs text-gray-500 mb-1">
          Watch how many seconds? (default: full length)
        </label>
        <input
          type="number"
          min={30}
          max={durationSec || 1800}
          value={goalSec}
          onChange={(e) => setGoalSec(Math.max(30, Number(e.target.value)))}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 mb-3 w-32"
        />
        {error && <p className="text-xs text-rose-700 mb-2">{error}</p>}
        <button type="button" onClick={startWatch} className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold">
          Start watching
        </button>
      </div>
    );
  }

  if (phase === 'watching') {
    const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(externalId)}?rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&fs=0&cc_load_policy=1`;
    return (
      <div className="rounded-2xl border-2 border-rose-200 dark:border-rose-800 bg-white dark:bg-gray-900 p-3">
        <div className="aspect-video w-full mb-3 rounded-lg overflow-hidden bg-black">
          <iframe
            src={src}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen={false}
            className="w-full h-full"
          />
        </div>
        <p className="text-xs text-gray-500 mb-2">
          Goal: {Math.round(goalSec / 60)} min · Tab switches tracked: {blurCountRef.current}
        </p>
        <button type="button" onClick={finishWatching} className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold">
          Done watching → answer 2 quick questions
        </button>
      </div>
    );
  }

  if (phase === 'retrieval') {
    const q = retrievalQuestions[retrievalIdx];
    if (!q) {
      submitRetrieval();
      return null;
    }
    return (
      <div className="rounded-2xl border-2 border-rose-200 dark:border-rose-800 bg-white dark:bg-gray-900 p-5">
        <p className="text-xs uppercase tracking-wider font-bold text-rose-600 mb-2">
          Q{retrievalIdx + 1} of {retrievalQuestions.length}
        </p>
        <p className="text-sm font-medium mb-2">{q.prompt}</p>
        {q.hint && <p className="text-xs text-gray-500 mb-2 italic">Hint: {q.hint}</p>}
        <textarea
          value={retrievalAnswers[retrievalIdx]}
          onChange={(e) => {
            const next = [...retrievalAnswers];
            next[retrievalIdx] = e.target.value;
            setRetrievalAnswers(next);
          }}
          placeholder="Your answer…"
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm mb-3"
        />
        <button
          type="button"
          onClick={() => {
            if (retrievalIdx + 1 < retrievalQuestions.length) setRetrievalIdx(retrievalIdx + 1);
            else submitRetrieval();
          }}
          className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold"
        >
          {retrievalIdx + 1 < retrievalQuestions.length ? 'Next question' : 'Submit'}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 p-5 text-sm">
      ✓ Done. Your retrieval check was scored — that&apos;s how this counts toward XP.
    </div>
  );
}
