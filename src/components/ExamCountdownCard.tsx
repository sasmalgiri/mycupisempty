'use client';

/**
 * Surfaces the next exam window from curriculum_calendars + how much of that
 * summative's syllabus the student has covered. Renders nothing if no event
 * is upcoming.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Next {
  eventKind: string;
  title: string;
  startDate: string;
  endDate: string;
  daysUntil: number;
  summativeNo: number | null;
  coveragePct: number | null;
}

const KIND_LABEL: Record<string, string> = {
  mid_term: '1st Summative',
  half_yearly: '2nd Summative / Half-yearly',
  final_exam: 'Annual Exam',
  pre_board: 'Pre-board',
  board_exam: 'Board Exam',
};

export default function ExamCountdownCard() {
  const [next, setNext] = useState<Next | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/exam-countdown').then((r) => r.json()).then((d) => setNext(d?.next || null)).finally(() => setLoaded(true));
  }, []);

  if (!loaded || !next) return null;

  const label = KIND_LABEL[next.eventKind] || next.title;
  const coverage = next.coveragePct;
  const urgency: 'far' | 'soon' | 'imminent' =
    next.daysUntil > 30 ? 'far' : next.daysUntil > 10 ? 'soon' : 'imminent';

  const tone =
    urgency === 'imminent' ? 'border-rose-300 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-800'
    : urgency === 'soon'   ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800'
    : 'border-sky-200 bg-sky-50/50 dark:bg-sky-950/20 dark:border-sky-800';

  return (
    <div className={`mb-6 p-4 rounded-2xl border-2 ${tone}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden="true">📅</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">{label}</p>
          <p className="font-bold text-base mt-0.5">{next.title}</p>
          <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">
            <strong className="font-mono">{next.daysUntil}</strong> day{next.daysUntil === 1 ? '' : 's'} away · starts {next.startDate}
            {coverage != null && (
              <> · syllabus <strong className="font-mono">{coverage}%</strong> covered</>
            )}
          </p>
          {coverage != null && (
            <div className="mt-2 h-2 bg-white/50 dark:bg-gray-900/50 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${coverage >= 70 ? 'bg-emerald-500' : coverage >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${coverage}%` }} />
            </div>
          )}
        </div>
        {next.summativeNo && (
          <Link href={`/courses/my?summative=${next.summativeNo}`} className="text-xs px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded font-semibold whitespace-nowrap">
            Plan for this →
          </Link>
        )}
      </div>
    </div>
  );
}
