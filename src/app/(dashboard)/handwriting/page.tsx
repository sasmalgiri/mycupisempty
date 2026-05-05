'use client';

/**
 * Handwriting drill — student gets a short prompt, writes the answer on
 * paper, photographs it. Tesseract.js OCRs on-device, server scores
 * legibility × correctness × speed. No image bytes leave the phone.
 */

import { useEffect, useRef, useState } from 'react';

interface Prompt {
  questionId: string;
  chapterId: string;
  text: string;
  expectedAnswer: string;
  questionType: string;
  marks: number;
}

interface Result {
  legibility: number;
  correctness: number;
  speed: number;
  total: number;
}

export default function HandwritingPage() {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [start, setStart] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/handwriting')
      .then((r) => r.json())
      .then((d) => setPrompt(d?.prompt || null))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const begin = () => { setStart(Date.now()); setResult(null); };

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !prompt || !start) return;
    setBusy(true); setPhotoMsg('Reading your handwriting…');
    try {
      const Tesseract = (await import('tesseract.js')).default;
      const { data } = await Tesseract.recognize(file, 'eng+ben', {
        logger: (m: any) => { if (m.status === 'recognizing text') setPhotoMsg(`Reading… ${Math.round((m.progress || 0) * 100)}%`); },
      });
      const ocrText = String(data?.text || '').trim();
      const durationSeconds = Math.max(1, Math.round((Date.now() - start) / 1000));
      setPhotoMsg('Scoring…');
      const res = await fetch('/api/handwriting', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptText: prompt.text,
          expectedAnswer: prompt.expectedAnswer,
          ocrText,
          durationSeconds,
          chapterId: prompt.chapterId,
        }),
      });
      const json = await res.json();
      if (json?.success) {
        setResult({ legibility: json.legibility, correctness: json.correctness, speed: json.speed, total: json.total });
        setPhotoMsg(null);
      } else {
        setPhotoMsg(`❌ ${json?.error || 'Could not score.'}`);
      }
    } catch (err: any) {
      setPhotoMsg(`OCR failed: ${err?.message || 'unknown'}`);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (loading) return <div className="max-w-2xl mx-auto p-8 text-center text-sm text-gray-500">Loading prompt…</div>;
  if (!prompt) return (
    <div className="max-w-2xl mx-auto p-8 text-center">
      <p className="text-sm text-gray-500">No prompt available — your question bank may need more rows.</p>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">✍️ Handwriting practice</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Exam answers are written on paper. We grade legibility + correctness + speed so you train all three.
        </p>
      </div>

      <section className="rounded-2xl border-2 border-fuchsia-200 dark:border-fuchsia-800 bg-fuchsia-50/40 dark:bg-fuchsia-950/20 p-5 space-y-3">
        <p className="text-[11px] font-bold uppercase text-fuchsia-700">Today&apos;s prompt · {prompt.marks} mark{prompt.marks === 1 ? '' : 's'} · {prompt.questionType.replace('_', ' ')}</p>
        <p className="font-medium leading-relaxed">{prompt.text}</p>
        {!start && (
          <button type="button" onClick={begin} className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg text-sm font-semibold">
            Start writing on paper
          </button>
        )}
        {start && !result && (
          <>
            <p className="text-xs text-gray-700 dark:text-gray-300">Now write your answer on paper, then take a clear photo.</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              disabled={busy}
              onChange={onPhoto}
              className="block text-xs"
              aria-label="Photo of handwritten answer"
            />
            {photoMsg && <p className="text-[11px] text-fuchsia-800 dark:text-fuchsia-300">{photoMsg}</p>}
          </>
        )}
        {result && (
          <div className="space-y-2">
            <p className="text-lg font-bold">Score: {Math.round(result.total * 100)} / 100</p>
            <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-1">
              <li>📖 Legibility: {Math.round(result.legibility * 100)}%</li>
              <li>✅ Correctness: {Math.round(result.correctness * 100)}%</li>
              <li>⏱ Speed: {Math.round(result.speed * 100)}%</li>
            </ul>
            <button type="button" onClick={() => { setResult(null); setStart(null); load(); }} className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg text-sm font-semibold">
              Next prompt →
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
