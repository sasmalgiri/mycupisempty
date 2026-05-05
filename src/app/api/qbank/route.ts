/**
 * Question bank — student-facing read.
 *
 * GET ?chapterId=...                          → all questions for a chapter,
 *                                                grouped by type
 * GET ?chapterId=...&type=mcq                 → just one type
 * GET ?chapterId=...&random=1&n=5             → N random across types
 * POST { action: 'flag', questionId }         → flag a wrong/unclear question
 *
 * Generator (POST { action: 'generate' }) lives in /api/qbank/generate so we
 * can role-gate it separately.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const chapterId = url.searchParams.get('chapterId');
    const type = url.searchParams.get('type');
    const random = url.searchParams.get('random');
    const n = Math.max(1, Math.min(30, Number(url.searchParams.get('n') || 5)));
    if (!chapterId) return NextResponse.json({ error: 'chapterId required' }, { status: 400 });

    let q = supabase
      .from('chapter_question_bank')
      .select('id, chapter_id, topic_id, question_text, answer_text, working, options, correct_index, question_type, marks, difficulty, cognitive_level, source, source_paper_year, source_paper_label, confidence, verified_at, language, tags')
      .eq('chapter_id', chapterId);
    if (type) q = q.eq('question_type', type);

    if (random) {
      // Postgres random() doesn't compose with .order() in the JS client
      // gracefully; fetch a wider slice and sample in JS. Cheap for 14-18-
      // question chapters.
      const { data: rows } = await q.limit(60);
      const list = (rows || []) as any[];
      const shuffled = [...list].sort(() => Math.random() - 0.5).slice(0, n);
      return NextResponse.json({ success: true, questions: shuffled });
    }

    const { data: rows } = await q.order('marks', { ascending: true });
    const grouped: Record<string, any[]> = {};
    for (const r of (rows || []) as any[]) {
      (grouped[r.question_type] ||= []).push(r);
    }
    return NextResponse.json({ success: true, questions: rows || [], grouped });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    if (body.action === 'flag' && body.questionId) {
      const { data, error } = await supabase.rpc('flag_qbank_question', { p_question_id: body.questionId });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Award honesty XP — real value-add to the audience-QA loop
      try {
        await supabase.from('honesty_xp_events').insert({
          user_id: user.id,
          event_kind: 'flag_validated',
          delta: 3,
          notes: `qbank flag ${body.questionId}`,
        });
      } catch { /* honesty table optional */ }
      return NextResponse.json({ success: true, flagged: !!data });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
