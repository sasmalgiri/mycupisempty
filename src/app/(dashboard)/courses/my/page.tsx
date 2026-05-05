'use client';

/**
 * /courses/my — the student's enrolled-course progress dashboard.
 *
 * Shows: course title, adherence %, current week's chapter map across
 * subjects, last 4 weeks done, next 4 weeks coming, parent-shareable
 * artifact button.
 *
 * Built for the parent over the student — the digest reads cleanly when
 * forwarded to a WhatsApp group.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import CourseSettingsCard from '@/components/CourseSettingsCard';
import TermProgressCard from '@/components/TermProgressCard';

interface Block {
  subjectSlug: string;
  chapterTitle: string;
  allocatedMinutes: number;
  isReview: boolean;
}

interface Week {
  weekNo: number;
  startDate: string;
  endDate: string;
  dailyMinutesTarget: number;
  blocks: Block[];
  notes: string[];
  isLightWeek?: boolean;
  isAssessmentWeek?: boolean;
}

interface Course {
  id: string;
  title: string;
  board_code: string;
  class_level: number;
  language: string;
}

interface Enrollment {
  id: string;
  start_date: string;
  weekly_minutes_target: number;
  status: string;
  curriculum_courses: Course;
}

interface Plan {
  id: string;
  weeks: Week[];
  generated_at: string;
  generator_version: string;
  adherence_pct: number | null;
}

export default function MyCoursePage() {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [adherence, setAdherence] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/courses?my=1').then((r) => r.json()),
      fetch('/api/todays-plan').then((r) => r.json()),
    ]).then(([myRes, planRes]) => {
      const active = (myRes?.enrollments || []).find((e: any) => e.status === 'active');
      setEnrollment(active || null);
      setAdherence(planRes?.adherence_pct ?? null);
      if (active) {
        fetch(`/api/plan?enrollmentId=${active.id}`)
          .then((r) => r.json())
          .then((d) => setPlan(d?.plan || null));
      }
    }).finally(() => setLoading(false));
  }, []);

  const replan = async () => {
    if (!enrollment) return;
    setBusy(true);
    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'replan', enrollmentId: enrollment.id, reason: 'manual_replan' }),
      });
      const json = await res.json();
      if (json?.success) setPlan(json.plan);
    } finally {
      setBusy(false);
    }
  };

  const generateArtifact = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/parent-artifacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'weekly_digest' }),
      });
      const json = await res.json();
      if (json?.success && json.artifact?.share_token) {
        setShareLink(`${window.location.origin}/api/parent-artifacts?token=${json.artifact.share_token}`);
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="max-w-3xl mx-auto p-8 text-center text-gray-500">Loading your course…</div>;
  if (!enrollment) return (
    <div className="max-w-3xl mx-auto p-8 text-center">
      <p className="text-sm text-gray-500 mb-3">You aren&apos;t enrolled in any course yet.</p>
      <Link href="/courses" className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold inline-block">Browse courses →</Link>
    </div>
  );

  const today = new Date().toISOString().split('T')[0];
  const weeks = plan?.weeks || [];
  const planSubjects = useMemo(() => {
    const seen = new Map<string, { slug: string; title: string }>();
    for (const w of weeks) for (const b of w.blocks || []) if (!seen.has(b.subjectSlug)) seen.set(b.subjectSlug, { slug: b.subjectSlug, title: b.subjectSlug });
    return Array.from(seen.values());
  }, [weeks]);
  const currentIdx = weeks.findIndex((w) => today >= w.startDate && today <= w.endDate);
  const currentWeek = currentIdx >= 0 ? weeks[currentIdx] : weeks[0];
  const past4 = currentIdx >= 0 ? weeks.slice(Math.max(0, currentIdx - 4), currentIdx) : [];
  const next4 = currentIdx >= 0 ? weeks.slice(currentIdx + 1, currentIdx + 5) : weeks.slice(0, 4);

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <Link href="/courses" className="text-sm text-primary-600 hover:underline">← All courses</Link>
        <h1 className="text-2xl sm:text-3xl font-bold mt-1">{enrollment.curriculum_courses.title}</h1>
        <p className="text-xs text-gray-500 mt-1">
          Started {enrollment.start_date} · {enrollment.weekly_minutes_target} min/week target
        </p>
      </div>

      {/* Adherence + replan */}
      <section className="grid sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-800">
          <p className="text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-300 font-bold">📈 Adherence</p>
          <p className="text-2xl font-bold mt-1">{adherence != null ? `${adherence}%` : '—'}</p>
          <p className="text-[10px] text-gray-500">% of expected days you&apos;ve actually studied</p>
        </div>
        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-200 dark:border-amber-800">
          <p className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-300 font-bold">📅 Current week</p>
          <p className="text-2xl font-bold mt-1">{currentWeek?.weekNo || '—'} / {weeks.length || '—'}</p>
          <p className="text-[10px] text-gray-500">{currentWeek?.startDate} → {currentWeek?.endDate}</p>
        </div>
        <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/40 dark:to-indigo-950/40 border border-purple-200 dark:border-purple-800">
          <p className="text-xs uppercase tracking-wider text-purple-700 dark:text-purple-300 font-bold">🔁 Plan</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Generated {plan ? new Date(plan.generated_at).toLocaleDateString() : '—'} · v{plan?.generator_version || '?'}
          </p>
          <button type="button" onClick={replan} disabled={busy} className="mt-2 px-3 py-1 text-xs bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded">
            Replan
          </button>
        </div>
      </section>

      {/* Current week deep view */}
      {currentWeek && (
        <section className="rounded-2xl border-2 border-primary-200 dark:border-primary-800 bg-white dark:bg-gray-900 p-4">
          <h2 className="font-bold mb-2">Week {currentWeek.weekNo}: {currentWeek.startDate} → {currentWeek.endDate}</h2>
          {(currentWeek.isLightWeek || currentWeek.isAssessmentWeek) && (
            <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
              {currentWeek.isAssessmentWeek ? '🎯 Assessment week' : '🌴 Light week'}
              {currentWeek.notes?.length ? ` — ${currentWeek.notes.join(' · ')}` : ''}
            </p>
          )}
          <div className="space-y-1">
            {(currentWeek.blocks || []).map((b, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-800 rounded-lg px-2 py-1.5">
                <span className="capitalize font-mono text-[11px] text-gray-500 w-28 truncate">{b.subjectSlug.replace('_', ' ')}</span>
                <span className="flex-1 mx-2 truncate">{b.chapterTitle}{b.isReview ? ' · review' : ''}</span>
                <span className="font-mono text-[10px] text-gray-500 w-12 text-right">{b.allocatedMinutes}m</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Past 4 weeks */}
      {past4.length > 0 && (
        <section>
          <h2 className="font-bold mb-2">Past 4 weeks</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            {past4.map((w) => (
              <div key={w.weekNo} className="p-3 rounded-xl border border-gray-200 dark:border-gray-800 text-xs bg-white dark:bg-gray-900 opacity-70">
                <p className="font-bold">Week {w.weekNo}</p>
                <p className="text-[10px] text-gray-500">{w.startDate} → {w.endDate}</p>
                <ul className="mt-1 list-disc pl-4">
                  {(w.blocks || []).slice(0, 3).map((b, i) => (
                    <li key={i} className="truncate">{b.subjectSlug}: {b.chapterTitle}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Next 4 weeks */}
      {next4.length > 0 && (
        <section>
          <h2 className="font-bold mb-2">Next 4 weeks</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            {next4.map((w) => (
              <div key={w.weekNo} className="p-3 rounded-xl border border-gray-200 dark:border-gray-800 text-xs bg-white dark:bg-gray-900">
                <p className="font-bold">Week {w.weekNo}{w.isAssessmentWeek ? ' · 🎯 assessment' : ''}{w.isLightWeek ? ' · 🌴 light' : ''}</p>
                <p className="text-[10px] text-gray-500">{w.startDate} → {w.endDate}</p>
                <ul className="mt-1 list-disc pl-4">
                  {(w.blocks || []).slice(0, 3).map((b, i) => (
                    <li key={i} className="truncate">{b.subjectSlug}: {b.chapterTitle}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Term progress + plan tuning */}
      <TermProgressCard enrollmentId={enrollment.id} />

      {/* Plan tuning */}
      {planSubjects.length > 0 && (
        <CourseSettingsCard enrollmentId={enrollment.id} subjects={planSubjects} />
      )}

      {/* Parent artifact */}
      <section className="rounded-2xl border-2 border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-4">
        <h2 className="font-bold mb-1">Share with parent</h2>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
          Generate a weekly digest with an opaque share link. Forward to WhatsApp; expires in 30 days.
        </p>
        <button type="button" onClick={generateArtifact} disabled={busy} className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded text-xs font-semibold">
          Generate weekly digest
        </button>
        {shareLink && (
          <div className="mt-3 p-2 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs flex items-center gap-2">
            <input type="text" readOnly value={shareLink} className="flex-1 bg-transparent text-[11px] font-mono" />
            <button type="button" onClick={() => navigator.clipboard.writeText(shareLink)} className="text-primary-600 hover:underline">Copy</button>
          </div>
        )}
      </section>
    </div>
  );
}
