'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { resolveClassLevel, formatBoard } from '@/lib/user-class';
import { average } from '@/lib/safe-math';

interface Subject {
  id: string;
  name: string;
  icon: string;
  color: string;
  progress: number;
  chaptersCompleted: number;
  totalChapters: number;
  nextChapter: string;
  questionsAnswered: number;
  accuracy: number;
}

/**
 * Presentation for a subject slug. The curriculum schema stores slugs
 * ('physical_science'), not display names or colours.
 */
const SUBJECT_STYLE: Record<string, { name: string; icon: string; color: string }> = {
  math: { name: 'Mathematics', icon: '📐', color: 'from-indigo-500 to-purple-600' },
  mathematics: { name: 'Mathematics', icon: '📐', color: 'from-indigo-500 to-purple-600' },
  science: { name: 'Science', icon: '🔬', color: 'from-emerald-500 to-teal-600' },
  physical_science: { name: 'Physical Science', icon: '⚗️', color: 'from-cyan-500 to-blue-600' },
  life_science: { name: 'Life Science', icon: '🌿', color: 'from-green-500 to-emerald-600' },
  physics: { name: 'Physics', icon: '🧲', color: 'from-blue-500 to-indigo-600' },
  chemistry: { name: 'Chemistry', icon: '⚗️', color: 'from-cyan-500 to-sky-600' },
  biology: { name: 'Biology', icon: '🧬', color: 'from-green-500 to-lime-600' },
  history: { name: 'History', icon: '🏛️', color: 'from-amber-500 to-orange-600' },
  geography: { name: 'Geography', icon: '🗺️', color: 'from-lime-500 to-green-600' },
  english: { name: 'English', icon: '📖', color: 'from-rose-500 to-pink-600' },
  bengali: { name: 'Bengali', icon: '📕', color: 'from-red-500 to-rose-600' },
  hindi: { name: 'Hindi', icon: '📙', color: 'from-orange-500 to-amber-600' },
  computer: { name: 'Computer', icon: '💻', color: 'from-slate-500 to-gray-700' },
};

function styleFor(slug: string) {
  return (
    SUBJECT_STYLE[slug] ?? {
      name: slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      icon: '📚',
      color: 'from-primary-500 to-secondary-500',
    }
  );
}

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [userClass, setUserClass] = useState<number | null>(null);
  const [board, setBoard] = useState<string>('');
  const [loadError, setLoadError] = useState(false);

  const loadSubjects = useCallback(async (classLevel: number, boardCode: string) => {
    // NOTE: `?class=` is a legacy branch reading migration-001 tables that no
    // migration ever seeds — it always answered { subjects: [] }, and because
    // [] is truthy the old mock fallback never fired. That empty list is what
    // rendered "NaN%". `action=subjects` reads the curriculum schema that the
    // syllabus is actually seeded into.
    const res = await fetch(`/api/curriculum?action=subjects&classLevel=${classLevel}`);
    if (!res.ok) throw new Error(`curriculum ${res.status}`);
    const data = await res.json();
    const rows: any[] = Array.isArray(data.subjects) ? data.subjects : [];

    // One class has rows for several boards; showing all of them lists
    // "Mathematics" three times.
    const forBoard = boardCode ? rows.filter((r) => r.board_code === boardCode) : rows;
    const chosen = forBoard.length > 0 ? forBoard : rows;

    return chosen.map((r): Subject => {
      const style = styleFor(r.subject_slug ?? '');
      return {
        id: r.id,
        name: style.name,
        icon: style.icon,
        color: style.color,
        // Per-student progress has no source table yet. Report zero rather
        // than inventing a number — a fabricated 65% is worse than an honest 0.
        progress: 0,
        chaptersCompleted: 0,
        totalChapters: r.total_chapters ?? 0,
        nextChapter: 'Start the first chapter',
        questionsAnswered: 0,
        accuracy: 0,
      };
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const supabase = createBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();

        let classLevel: number | null = null;
        let boardCode = '';

        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('current_class, education_level, board_code')
            .eq('id', user.id)
            .single() as any;
          classLevel = resolveClassLevel(profile);
          boardCode = profile?.board_code ?? '';
        }

        if (cancelled) return;
        setUserClass(classLevel);
        setBoard(boardCode);

        // No class on the profile means onboarding is incomplete — there is
        // nothing sensible to fetch, and guessing a class (this page used to
        // hard-code 6) shows a child someone else's syllabus.
        if (classLevel === null) {
          setSubjects([]);
          return;
        }

        const loaded = await loadSubjects(classLevel, boardCode);
        if (!cancelled) setSubjects(loaded);
      } catch {
        if (!cancelled) {
          setSubjects([]);
          setLoadError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [loadSubjects]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="text-6xl mb-4">📚</div>
          <p className="text-gray-500">Loading subjects...</p>
        </div>
      </div>
    );
  }

  const overallProgress = average(subjects.map((s) => s.progress));
  const averageAccuracy = average(subjects.map((s) => s.accuracy));
  const chaptersCompleted = subjects.reduce((sum, s) => sum + s.chaptersCompleted, 0);
  const questionsAnswered = subjects.reduce((sum, s) => sum + s.questionsAnswered, 0);
  const classLabel = userClass ? `Class ${userClass}` : 'Class not set';

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-effect border-b border-white/20 hidden lg:block">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-gray-900">My Subjects</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {[classLabel, formatBoard(board)].filter(Boolean).join(' · ')}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Overall Progress:</span>
                <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary-500 to-secondary-500"
                    style={{ width: `${overallProgress}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-primary-600">{overallProgress}%</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Card */}
        <div className="bg-gradient-to-r from-primary-500 via-primary-600 to-secondary-500 rounded-3xl p-6 mb-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-2">📚 Your Learning Journey</h2>
            <p className="text-white/90 mb-4">
              {classLabel} • {chaptersCompleted} chapters completed
            </p>
            <div className="flex items-center gap-6">
              <div>
                <p className="text-3xl font-bold">{overallProgress}%</p>
                <p className="text-sm text-white/80">Overall Progress</p>
              </div>
              <div>
                <p className="text-3xl font-bold">{questionsAnswered}</p>
                <p className="text-sm text-white/80">Questions Solved</p>
              </div>
              <div>
                <p className="text-3xl font-bold">{averageAccuracy}%</p>
                <p className="text-sm text-white/80">Avg. Accuracy</p>
              </div>
            </div>
          </div>
        </div>

        {/* Empty state — an empty grid with 0% tiles reads as a broken page. */}
        {subjects.length === 0 && (
          <div className="bg-white rounded-2xl shadow-md p-10 text-center">
            <div className="text-5xl mb-4">🧭</div>
            {userClass === null ? (
              <>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Let&apos;s set up your class first</h3>
                <p className="text-gray-500 mb-6">
                  We need to know which class you&apos;re in before we can show your syllabus.
                </p>
                <Link
                  href="/settings"
                  className="inline-block px-5 py-3 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 transition-colors"
                >
                  Complete my profile
                </Link>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  {loadError ? 'Could not load your subjects' : `No subjects yet for ${classLabel}`}
                </h3>
                <p className="text-gray-500 mb-6">
                  {loadError
                    ? 'Something went wrong fetching your syllabus. Please try again.'
                    : `We haven't added the ${[formatBoard(board), classLabel].filter(Boolean).join(' ')} syllabus yet. Browse the full course catalogue in the meantime.`}
                </p>
                <Link
                  href="/courses"
                  className="inline-block px-5 py-3 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 transition-colors"
                >
                  Browse courses
                </Link>
              </>
            )}
          </div>
        )}

        {/* Subjects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects.map(subject => (
            <Link
              key={subject.id}
              href={`/subjects/${subject.id}`}
              className="group bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden"
            >
              {/* Gradient Top Bar */}
              <div className={`h-2 bg-gradient-to-r ${subject.color}`} />

              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${subject.color} flex items-center justify-center text-2xl shadow-lg group-hover:scale-110 transition-transform`}>
                      {subject.icon}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 group-hover:text-primary-600 transition-colors">
                        {subject.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {subject.totalChapters > 0
                          ? `${subject.chaptersCompleted}/${subject.totalChapters} chapters`
                          : 'Chapters coming soon'}
                      </p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-primary-500 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500">Progress</span>
                    <span className="font-bold text-gray-700">{subject.progress}%</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${subject.color} rounded-full transition-all duration-500`}
                      style={{ width: `${subject.progress}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <span className="text-gray-500">
                      <strong className="text-gray-700">{subject.questionsAnswered}</strong> questions
                    </span>
                    <span className="text-gray-500">
                      <strong className="text-gray-700">{subject.accuracy}%</strong> accuracy
                    </span>
                  </div>
                </div>

                {/* Next Chapter */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-1">Continue with:</p>
                  <p className="text-sm font-medium text-primary-600 truncate">
                    📖 {subject.nextChapter}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/assessment" className="bg-white rounded-xl p-5 shadow-md hover:shadow-lg transition-shadow flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center text-2xl">
              🎯
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Learning Style Assessment</h4>
              <p className="text-sm text-gray-500">Discover how you learn best</p>
            </div>
          </Link>

          <Link href="/progress" className="bg-white rounded-xl p-5 shadow-md hover:shadow-lg transition-shadow flex items-center gap-4">
            <div className="w-12 h-12 bg-success-100 rounded-xl flex items-center justify-center text-2xl">
              📊
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">View Detailed Progress</h4>
              <p className="text-sm text-gray-500">See your learning analytics</p>
            </div>
          </Link>

          <Link href="/achievements" className="bg-white rounded-xl p-5 shadow-md hover:shadow-lg transition-shadow flex items-center gap-4">
            <div className="w-12 h-12 bg-warning-100 rounded-xl flex items-center justify-center text-2xl">
              🏆
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Achievements & Badges</h4>
              <p className="text-sm text-gray-500">See what you've unlocked</p>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
