'use client';

/**
 * Type-ahead school picker with "can't find your school? add it" fallback.
 * Writes to profiles.school_id + school_section so the league cohort narrows
 * to the student's classroom (see streak.cohortKey).
 */

import { useEffect, useState } from 'react';

interface School {
  id: string;
  name: string;
  board_code: string | null;
  city: string | null;
  is_verified: boolean;
}

export default function SchoolPicker({ defaultBoard, onSaved }: { defaultBoard?: string; onSaved?: () => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<School[]>([]);
  const [selected, setSelected] = useState<School | null>(null);
  const [section, setSection] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCity, setNewCity] = useState('Kolkata');
  const [newBoard, setNewBoard] = useState(defaultBoard || 'wbbse');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (q.length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      const params = new URLSearchParams({ q });
      if (defaultBoard) params.set('board', defaultBoard);
      fetch(`/api/schools?${params.toString()}`)
        .then((r) => r.json())
        .then((d) => setResults(d?.schools || []))
        .catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q, defaultBoard]);

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const body: any = { section };
      if (selected) body.schoolId = selected.id;
      else if (adding && newName.trim().length >= 3) {
        body.createNew = { name: newName.trim(), city: newCity.trim() || null, board_code: newBoard };
      } else {
        setMsg('Pick a school or add a new one.');
        setBusy(false); return;
      }
      const res = await fetch('/api/schools', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setMsg(`❌ ${json?.error || 'Could not save.'}`);
      } else {
        setMsg('✅ School saved. Your league now shows classmates.');
        onSaved?.();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
      <div>
        <h3 className="font-bold text-base">Your school</h3>
        <p className="text-xs text-gray-600 dark:text-gray-400">Optional. Setting your school narrows the weekly league cohort to your actual classmates.</p>
      </div>

      {!selected && !adding && (
        <>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type to search…"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
          />
          {results.length > 0 && (
            <ul className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
              {results.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => setSelected(s)} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-800">
                    <div className="font-semibold">{s.name} {s.is_verified && <span aria-label="verified" className="text-emerald-600">✓</span>}</div>
                    <div className="text-gray-500 text-[10px]">{s.board_code?.toUpperCase()} · {s.city}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {q.length >= 2 && results.length === 0 && (
            <button type="button" onClick={() => { setAdding(true); setNewName(q); }} className="text-xs text-primary-600 hover:underline">
              Can&apos;t find &quot;{q}&quot;? Add it →
            </button>
          )}
        </>
      )}

      {selected && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs">
          <p className="font-semibold">{selected.name}</p>
          <p className="text-gray-500 text-[10px]">{selected.board_code?.toUpperCase()} · {selected.city}</p>
          <button type="button" onClick={() => setSelected(null)} className="text-[11px] text-primary-600 hover:underline mt-1">Change</button>
        </div>
      )}

      {adding && (
        <div className="space-y-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="School name" className="w-full px-2 py-1 rounded border border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-900" />
          <input value={newCity} onChange={(e) => setNewCity(e.target.value)} placeholder="City" className="w-full px-2 py-1 rounded border border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-900" />
          <select value={newBoard} onChange={(e) => setNewBoard(e.target.value)} className="w-full px-2 py-1 rounded border border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-900">
            <option value="wbbse">WBBSE</option>
            <option value="cbse">CBSE</option>
            <option value="icse">ICSE</option>
          </select>
          <button type="button" onClick={() => setAdding(false)} className="text-[11px] text-primary-600 hover:underline">Cancel</button>
          <p className="text-[10px] text-gray-500">New schools start unverified — an admin reviews them later.</p>
        </div>
      )}

      {(selected || adding) && (
        <div>
          <label htmlFor="school-section" className="text-[11px] text-gray-500">Section (optional, 1-4 chars)</label>
          <input id="school-section" value={section} onChange={(e) => setSection(e.target.value)} maxLength={4} placeholder="A, B, …" className="w-24 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs ml-2" />
        </div>
      )}

      <div className="flex items-center gap-2">
        <button type="button" onClick={save} disabled={busy || (!selected && (!adding || newName.trim().length < 3))} className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded text-xs font-semibold">
          {busy ? 'Saving…' : 'Save school'}
        </button>
        {msg && <span className="text-[11px]">{msg}</span>}
      </div>
    </section>
  );
}
