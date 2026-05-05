/**
 * Exam countdown — returns the next assessment-window event for the caller's
 * board+academic year, with days-until + chapter coverage rollup against the
 * relevant summative window.
 *
 * GET → { next: { eventKind, title, startDate, daysUntil, summativeNo, coveragePct } | null }
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

const ASSESSMENT_KINDS = new Set(['mid_term', 'half_yearly', 'final_exam', 'pre_board', 'board_exam']);

const KIND_TO_SUMMATIVE: Record<string, 1 | 2 | 3 | null> = {
  mid_term: 1,
  half_yearly: 2,
  pre_board: 3,
  final_exam: 3,
  board_exam: 3,
};

export async function GET() {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_class, board_code, language')
      .eq('id', user.id)
      .maybeSingle();
    const board = profile?.board_code === 'wb_board' ? 'wbbse' : (profile?.board_code || 'wbbse');
    const klass = profile?.current_class || 8;
    const today = new Date().toISOString().split('T')[0];

    const { data: events } = await supabase
      .from('curriculum_calendars')
      .select('event_kind, title, start_date, end_date')
      .eq('board_code', board)
      .gte('end_date', today)
      .order('start_date', { ascending: true })
      .limit(20);

    const next = (events || []).find((e: any) => ASSESSMENT_KINDS.has(e.event_kind)) || null;

    if (!next) return NextResponse.json({ success: true, next: null });

    const summativeNo = KIND_TO_SUMMATIVE[next.event_kind] ?? null;
    let coveragePct: number | null = null;

    // Rough coverage: of chapters tagged for this summative window, how many
    // does the student have a session_evaluation row for? Not perfect — better
    // than nothing for a high-level "you've covered N% of Summative-2 syllabus".
    if (summativeNo) {
      const { data: scc } = await supabase
        .from('curriculum_subjects_by_class')
        .select('id')
        .eq('board_code', board)
        .eq('class_level', klass);
      const sccIds = (scc || []).map((r: any) => r.id);
      if (sccIds.length > 0) {
        const { data: chs } = await supabase
          .from('curriculum_chapters')
          .select('id, summative_no')
          .in('subject_class_id', sccIds);
        const targetChapterIds = (chs || []).filter((c: any) => c.summative_no === summativeNo || c.summative_no === null).map((c: any) => c.id);
        const total = targetChapterIds.length;
        if (total > 0) {
          // We don't track chapter-level completion directly; proxy via
          // session_evaluations.chapter_id when present.
          const { data: evals } = await supabase
            .from('session_evaluations')
            .select('chapter_id')
            .eq('user_id', user.id)
            .in('chapter_id', targetChapterIds);
          const covered = new Set((evals || []).map((e: any) => e.chapter_id)).size;
          coveragePct = Math.round((covered / total) * 100);
        }
      }
    }

    const startMs = new Date(next.start_date).getTime();
    const todayMs = new Date(today).getTime();
    const daysUntil = Math.max(0, Math.ceil((startMs - todayMs) / 86400000));

    return NextResponse.json({
      success: true,
      next: {
        eventKind: next.event_kind,
        title: next.title,
        startDate: next.start_date,
        endDate: next.end_date,
        daysUntil,
        summativeNo,
        coveragePct,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
