'use client';

/**
 * Admin past-paper import.
 * Paste a JSON document of shape { paper, questions[] } and POST to /api/past-papers.
 * Each question must include chapter_id (admin maps year-by-year using
 * /admin/qbank for chapter ids).
 */

import { useEffect, useState } from 'react';

interface PaperRow {
  id: string;
  board_code: string;
  class_level: number;
  subject_slug: string;
  exam_label: string;
  year: number;
  total_marks: number | null;
  language: string;
}

const SAMPLE = `{
  "paper": {
    "board_code": "wb_board",
    "class_level": 10,
    "subject_slug": "math",
    "language": "bn",
    "exam_label": "WBBSE Madhyamik 2024 Math",
    "year": 2024,
    "total_marks": 90,
    "duration_minutes": 195,
    "source_url": "https://wbbse.wb.gov.in/..."
  },
  "questions": [
    {
      "chapter_id": "<paste-uuid-from-/admin/qbank>",
      "question_text": "Solve …",
      "answer_text": "x = 4",
      "working": "Step 1: …",
      "question_type": "short",
      "marks": 3,
      "difficulty": "medium"
    }
  ]
}`;

export default function AdminPastPapersPage() {
  const [papers, setPapers] = useState<PaperRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState(SAMPLE);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    fetch('/api/past-papers')
      .then((r) => r.json())
      .then((d) => setPapers(d?.papers || []))
      .finally(() => setLoading(false));
  };
  useEffect(refresh, []);

  const submit = async () => {
    setBusy(true); setMsg(null);
    try {
      const body = JSON.parse(text);
      const res = await fetch('/api/past-papers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setMsg(`❌ ${json?.error || 'Import failed'}`);
      } else {
        setMsg(`✅ Imported ${json.inserted_count} questions for ${json.paper?.exam_label}`);
        refresh();
      }
    } catch (err: any) {
      setMsg(`❌ Invalid JSON: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Past papers · Admin import</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Bulk-import a published exam paper. Each question is tagged source=past_paper and confidence=0.95 so the question bank gets a verified backbone alongside the AI-generated set.
        </p>
      </div>

      <section className="rounded-2xl border-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <h2 className="font-bold mb-2">Paste paper JSON</h2>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={16}
          spellCheck={false}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 font-mono text-xs"
        />
        <div className="flex items-center gap-3 mt-2">
          <button type="button" onClick={submit} disabled={busy} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
            {busy ? 'Importing…' : 'Import paper'}
          </button>
          {msg && <span className="text-xs">{msg}</span>}
        </div>
      </section>

      <section>
        <h2 className="font-bold text-base mb-2">Already imported</h2>
        {loading ? <p className="text-sm text-gray-500">Loading…</p>
          : papers.length === 0 ? <p className="text-sm text-gray-500">No past papers yet.</p>
          : (
            <ul className="space-y-1">
              {papers.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-gray-50 dark:bg-gray-900">
                  <span>{p.exam_label}</span>
                  <span className="text-gray-500 font-mono">{p.board_code} · cls {p.class_level} · {p.subject_slug} · {p.year} · {p.total_marks ?? '?'}m</span>
                </li>
              ))}
            </ul>
          )}
      </section>
    </div>
  );
}
