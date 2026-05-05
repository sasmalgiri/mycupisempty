'use client';

/**
 * Parent / sibling uploads a photographed school PYQ. Tesseract OCRs locally;
 * server stores OCR text + metadata. Admin verifies extraction later.
 */

import { useEffect, useRef, useState } from 'react';

interface Paper {
  id: string; class_level: number; subject_slug: string; year: number;
  exam_label: string; exam_kind: string | null; status: string; uploaded_at: string;
}

const SUBJECT_OPTIONS = ['math', 'bengali', 'english', 'evs', 'science', 'history', 'geography', 'physical_science', 'life_science'];
const KIND_OPTIONS = [
  { value: 'summative_1', label: '1st Summative' },
  { value: 'summative_2', label: '2nd Summative / Half-yearly' },
  { value: 'summative_3', label: '3rd Summative / Annual' },
  { value: 'unit_test',   label: 'Unit Test' },
];

export default function SchoolPapersPage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [classLevel, setClassLevel] = useState(5);
  const [subject, setSubject] = useState('math');
  const [year, setYear] = useState(new Date().getFullYear() - 1);
  const [kind, setKind] = useState('summative_2');
  const [examLabel, setExamLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    setLoading(true);
    fetch('/api/school-papers').then((r) => r.json()).then((d) => setPapers(d?.papers || [])).finally(() => setLoading(false));
  };
  useEffect(refresh, []);

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setPhotoMsg('Reading photo (OCR)…');
    try {
      const Tesseract = (await import('tesseract.js')).default;
      const { data } = await Tesseract.recognize(file, 'eng+ben', {
        logger: (m: any) => { if (m.status === 'recognizing text') setPhotoMsg(`Reading… ${Math.round((m.progress || 0) * 100)}%`); },
      });
      const text = String(data?.text || '').trim();
      if (text.length < 50) { setPhotoMsg('Not enough text. Try a clearer / closer photo.'); return; }
      setOcrText((prev) => (prev ? prev + '\n\n' : '') + text);
      setPhotoMsg(`✅ OCR added ${text.length} chars. Add more pages, or submit.`);
    } catch (err: any) {
      setPhotoMsg(`OCR failed: ${err?.message}`);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const submit = async () => {
    if (!examLabel.trim() || !ocrText.trim()) { setPhotoMsg('Add a label and at least one page.'); return; }
    setBusy(true); setPhotoMsg('Uploading…');
    try {
      const res = await fetch('/api/school-papers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classLevel, subjectSlug: subject, year,
          examKind: kind, examLabel: examLabel.trim(), ocrText, photoUrls: [],
        }),
      });
      const json = await res.json();
      if (json?.success) {
        setPhotoMsg('✅ Saved. Admin will verify extraction.');
        setOcrText(''); setExamLabel('');
        refresh();
      } else {
        setPhotoMsg(`❌ ${json?.error || 'Could not save'}`);
      }
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">📚 Upload your school&apos;s old paper</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          The questions YOUR school sets. Photograph an old summative from a sibling, cousin, or last year&apos;s notebook. Text is read on-device — photos never leave the phone.
        </p>
      </div>

      <section className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 p-5 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <label className="flex flex-col gap-1">
            <span className="font-bold text-gray-600">Class</span>
            <select value={classLevel} onChange={(e) => setClassLevel(Number(e.target.value))} className="px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>Class {n}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-bold text-gray-600">Subject</span>
            <select value={subject} onChange={(e) => setSubject(e.target.value)} className="px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 capitalize">
              {SUBJECT_OPTIONS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-bold text-gray-600">Year</span>
            <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} min={2015} max={new Date().getFullYear()} className="px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-bold text-gray-600">Exam type</span>
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              {KIND_OPTIONS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </label>
        </div>
        <input value={examLabel} onChange={(e) => setExamLabel(e.target.value)} placeholder="Label (e.g., 'Hare School Class 5 Math 2nd Summative 2023')" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
        <input ref={fileRef} type="file" accept="image/*" capture="environment" disabled={busy} onChange={onPhoto} className="block text-xs" aria-label="Photo of school paper page" />
        {photoMsg && <p className="text-[11px] text-emerald-800 dark:text-emerald-300">{photoMsg}</p>}
        {ocrText && (
          <details className="text-xs text-gray-600 dark:text-gray-400">
            <summary className="cursor-pointer">Preview extracted text ({ocrText.length} chars)</summary>
            <pre className="mt-2 p-2 bg-white dark:bg-gray-900 rounded max-h-60 overflow-y-auto whitespace-pre-wrap">{ocrText}</pre>
          </details>
        )}
        <button type="button" onClick={submit} disabled={busy || !ocrText.trim() || !examLabel.trim()} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
          Save paper
        </button>
      </section>

      <section>
        <h2 className="font-bold text-base mb-2">Your uploads</h2>
        {loading ? <p className="text-sm text-gray-500">Loading…</p>
          : papers.length === 0 ? <p className="text-sm text-gray-500">Nothing yet. Upload above to start your school&apos;s archive.</p>
          : (
            <ul className="space-y-1">
              {papers.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-gray-50 dark:bg-gray-900">
                  <span>{p.exam_label}</span>
                  <span className="text-gray-500 font-mono">cls {p.class_level} · {p.subject_slug} · {p.year} · {p.status}</span>
                </li>
              ))}
            </ul>
          )}
      </section>
    </div>
  );
}
