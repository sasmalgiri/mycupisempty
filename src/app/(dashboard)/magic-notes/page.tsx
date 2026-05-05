'use client';

/**
 * Magic Notes — photograph notes (or paste text), get back extracted
 * concepts + practice. Works offline-first with a paste box; camera
 * upload requires Supabase storage to be wired (left as caller config).
 */

import { useEffect, useRef, useState } from 'react';

interface Upload {
  id: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  extracted_concepts: string[];
  created_at: string;
  ready_at: string | null;
  error: string | null;
}

export default function MagicNotesPage() {
  const [pasteText, setPasteText] = useState('');
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/magic-notes')
      .then((r) => r.json())
      .then((d) => setUploads(d?.uploads || []))
      .catch(() => setUploads([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  // Browser-side OCR via Tesseract.js when the user picks a photo. We dynamic-
  // import on first use so the 2.5 MB Tesseract bundle isn't pulled into the
  // initial Magic Notes page load.
  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoBusy(true); setPhotoMsg('Reading photo…');
    try {
      const Tesseract = (await import('tesseract.js')).default;
      const result = await Tesseract.recognize(file, 'eng+ben', {
        logger: (m: any) => {
          if (m.status === 'recognizing text') setPhotoMsg(`Reading… ${Math.round((m.progress || 0) * 100)}%`);
        },
      });
      const text = String(result?.data?.text || '').trim();
      if (text.length < 20) { setPhotoMsg('Not enough text recognised. Try a clearer photo.'); return; }
      setPasteText((prev) => (prev ? prev + '\n\n' : '') + text);
      setPhotoMsg(`Extracted ${text.length} chars. Review then submit below.`);
    } catch (err: any) {
      setPhotoMsg(`OCR failed: ${err?.message || 'unknown error'}`);
    } finally {
      setPhotoBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const submitPaste = async () => {
    if (!pasteText.trim()) return;
    setBusy(true);
    try {
      const created = await fetch('/api/magic-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath: 'paste:inline', ocrText: pasteText }),
      }).then((r) => r.json());
      if (created?.success) {
        await fetch('/api/magic-notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'process', uploadId: created.upload.id }),
        });
        setPasteText('');
        load();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Magic Notes</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Paste your class notes (or, soon, snap a photo of the blackboard). We extract concepts and stage flashcards + practice questions for you.
        </p>
      </div>

      <section className="rounded-2xl border-2 border-fuchsia-200 dark:border-fuchsia-800 bg-fuchsia-50 dark:bg-fuchsia-950/30 p-5">
        <h3 className="font-bold text-base mb-2">Paste notes (text)</h3>
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="Paste any text from class — definitions, formulas, dates, anything…"
          rows={6}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm mb-3"
        />
        <button
          type="button"
          onClick={submitPaste}
          disabled={busy || !pasteText.trim()}
          className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold"
        >
          Extract concepts
        </button>
        <div className="mt-3 pt-3 border-t border-fuchsia-200 dark:border-fuchsia-800">
          <label htmlFor="magic-photo" className="text-xs font-bold text-fuchsia-800 dark:text-fuchsia-300">📷 Or snap a photo (English + Bengali)</label>
          <input
            id="magic-photo"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            disabled={photoBusy}
            onChange={onPhoto}
            className="block mt-1 text-xs"
          />
          {photoMsg && <p className="text-[11px] text-fuchsia-800 dark:text-fuchsia-300 mt-1">{photoMsg}</p>}
          <p className="text-[10px] text-gray-500 mt-1">
            On-device OCR (Tesseract.js) — your photo never leaves your phone. Works offline once cached.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">Recent uploads</h2>
        {loading ? (
          <p className="text-sm text-gray-500 text-center py-8">Loading…</p>
        ) : uploads.length === 0 ? (
          <div className="p-8 rounded-2xl border border-gray-200 dark:border-gray-800 text-center text-sm text-gray-500">
            Nothing yet — paste something above to start.
          </div>
        ) : (
          <ul className="space-y-3">
            {uploads.map((u) => (
              <li key={u.id} className="p-4 rounded-2xl border-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase tracking-wider font-bold">
                    {u.status === 'ready' ? '✓ Ready' : u.status === 'failed' ? '✗ Failed' : '…' + ' ' + u.status}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {new Date(u.created_at).toLocaleString()}
                  </span>
                </div>
                {u.error && <p className="text-xs text-rose-700 mb-2">{u.error}</p>}
                {u.extracted_concepts && u.extracted_concepts.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Concepts extracted ({u.extracted_concepts.length}):
                    </p>
                    <ul className="text-xs text-gray-700 dark:text-gray-300 list-disc pl-5 space-y-0.5">
                      {u.extracted_concepts.slice(0, 12).map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
