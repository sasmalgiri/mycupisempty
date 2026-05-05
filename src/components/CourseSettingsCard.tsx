'use client';

/**
 * Per-enrollment levers: pace multiplier per subject + career-path emphasis.
 * Both feed plan-generator (CAREER_EMPHASIS table + per-subject pace clamp).
 * Saving fires a fire-and-forget replan.
 */

import { useEffect, useState } from 'react';

interface Subject {
  slug: string;
  title?: string;
}

const CAREERS: { value: string; label: string }[] = [
  { value: 'doctor', label: '🩺 Doctor / NEET' },
  { value: 'engineer', label: '⚙️ Engineer / JEE' },
  { value: 'civil_services', label: '🏛️ Civil Services' },
  { value: 'arts_humanities', label: '🎨 Arts & Humanities' },
  { value: 'commerce', label: '📊 Commerce' },
  { value: 'sports', label: '🏏 Sports' },
  { value: 'creative', label: '✨ Creative' },
  { value: 'unsure', label: '🤔 Still figuring out' },
];

export default function CourseSettingsCard({ enrollmentId, subjects }: { enrollmentId: string; subjects: Subject[] }) {
  const [pace, setPace] = useState<Record<string, number>>({});
  const [career, setCareer] = useState<string | null>(null);
  const [savingPace, setSavingPace] = useState<string | null>(null);
  const [savingCareer, setSavingCareer] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/enrollment-settings?enrollmentId=${enrollmentId}`)
      .then((r) => r.json())
      .then((d) => {
        setPace(d?.pace_multipliers || {});
        setCareer(d?.career_path || null);
      })
      .finally(() => setLoaded(true));
  }, [enrollmentId]);

  const updatePace = async (slug: string, value: number) => {
    setPace((p) => ({ ...p, [slug]: value }));
  };

  const commitPace = async (slug: string) => {
    setSavingPace(slug);
    try {
      await fetch('/api/enrollment-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollmentId, action: 'set_pace', subjectSlug: slug, multiplier: pace[slug] ?? 1.0 }),
      });
    } finally {
      setSavingPace(null);
    }
  };

  const updateCareer = async (val: string) => {
    setCareer(val);
    setSavingCareer(true);
    try {
      await fetch('/api/enrollment-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollmentId, action: 'set_career', careerPath: val }),
      });
    } finally {
      setSavingCareer(false);
    }
  };

  if (!loaded) return <div className="p-4 text-xs text-gray-500">Loading settings…</div>;

  return (
    <section className="rounded-2xl border-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-4">
      <div>
        <h2 className="font-bold text-base">Tune your plan</h2>
        <p className="text-xs text-gray-600 dark:text-gray-400">Slow down weak subjects, speed up strong ones. Career emphasis tilts time toward subjects that matter for the path you&apos;re considering.</p>
      </div>

      <div>
        <label htmlFor="career-path" className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1 block">Career path {savingCareer && <span className="font-normal lowercase text-gray-400">· saving…</span>}</label>
        <select
          id="career-path"
          value={career || ''}
          onChange={(e) => updateCareer(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
        >
          <option value="">— not set —</option>
          {CAREERS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Per-subject pace</p>
        <div className="space-y-2">
          {subjects.map((s) => {
            const val = pace[s.slug] ?? 1.0;
            return (
              <div key={s.slug} className="flex items-center gap-3">
                <span className="text-xs capitalize w-28 truncate">{(s.title || s.slug).replace(/_/g, ' ')}</span>
                <input
                  type="range"
                  min={0.3}
                  max={2.0}
                  step={0.1}
                  value={val}
                  onChange={(e) => updatePace(s.slug, Number(e.target.value))}
                  onMouseUp={() => commitPace(s.slug)}
                  onTouchEnd={() => commitPace(s.slug)}
                  className="flex-1"
                />
                <span className="font-mono text-[11px] w-10 text-right">{val.toFixed(1)}×</span>
                {savingPace === s.slug && <span className="text-[10px] text-gray-400">…</span>}
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-gray-500 mt-2">0.3× ≈ much slower · 1.0× = balanced · 2.0× = double pace. Replans automatically.</p>
      </div>
    </section>
  );
}
