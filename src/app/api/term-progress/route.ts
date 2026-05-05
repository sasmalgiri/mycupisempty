/**
 * Per-summative chapter coverage rollup. Used by TermProgressCard on /courses/my.
 *
 * GET → { terms: [{ summativeNo, total, covered, pct, examWindow }] }
 *
 * "covered" = student has at least one session_evaluation row for that chapter.
 * Imperfect but matches what we have today; chapter-level completion is on
 * the Phase L+1 backlog.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

const KIND_TO_SUMMATIVE: Record<string, 1 | 2 | 3> = {
  mid_term: 1, half_yearly: 2, final_exam: 3, pre_board: 3, board_exam: 3,
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
    if (!profile?.current_class) return NextResponse.json({ success: true, terms: [] });
    const board = profile.board_code === 'wb_board' ? 'wbbse' : profile.board_code;

    const { data: scc } = await supabase
      .from('curriculum_subjects_by_class')
      .select('id')
      .eq('board_code', board)
      .eq('class_level', profile.current_class);
    const sccIds = (scc || []).map((r: any) => r.id);
    if (sccIds.length === 0) return NextResponse.json({ success: true, terms: [] });

    const { data: chapters } = await supabase
      .from('curriculum_chapters')
      .select('id, summative_no')
      .in('subject_class_id', sccIds);

    const allChapterIds = (chapters || []).map((c: any) => c.id);
    const { data: evals } = await supabase
      .from('session_evaluations')
      .select('chapter_id')
      .eq('user_id', user.id)
      .in('chapter_id', allChapterIds.length > 0 ? allChapterIds : ['__none__']);
    const coveredSet = new Set((evals || []).map((e: any) => e.chapter_id));

    const { data: cals } = await supabase
      .from('curriculum_calendars')
      .select('event_kind, title, start_date, end_date')
      .eq('board_code', board);
    const examByTerm: Record<number, any> = {};
    for (const ev of cals || []) {
      const t = KIND_TO_SUMMATIVE[ev.event_kind];
      if (t && !examByTerm[t]) examByTerm[t] = { title: ev.title, startDate: ev.start_date, endDate: ev.end_date };
    }

    const terms: Array<{ summativeNo: number; total: number; covered: number; pct: number; examWindow: any }> = [];
    for (const sn of [1, 2, 3] as const) {
      const inTerm = (chapters || []).filter((c: any) => c.summative_no === sn);
      const total = inTerm.length;
      if (total === 0) continue;
      const covered = inTerm.filter((c: any) => coveredSet.has(c.id)).length;
      terms.push({
        summativeNo: sn,
        total,
        covered,
        pct: Math.round((covered / total) * 100),
        examWindow: examByTerm[sn] || null,
      });
    }

    return NextResponse.json({ success: true, terms });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
