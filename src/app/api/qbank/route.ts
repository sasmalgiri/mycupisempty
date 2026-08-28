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
      // gracefully; fetch a wider slice and sample in JS.
      const { data: rows } = await q.limit(200);
      const list = (rows || []) as any[];

      // Sample to the BOARD'S question-type proportions, not to whatever the
      // bank happens to hold. Generation over-provides unevenly — this bank is
      // 36% long answers by marks against a paper that is 10% — so a flat
      // random draw would hand her an essay-heavy diet that looks nothing like
      // the exam. Weighting at selection time means an uneven pool is a
      // strength (more to choose from) instead of a distortion.
      const shaped = type
        ? shuffle(list).slice(0, n)                       // caller asked for one type
        : await sampleToBlueprint(supabase, list, n, chapterId);

      return NextResponse.json({ success: true, questions: shaped });
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

/**
 * Fisher-Yates.
 *
 * The previous `sort(() => Math.random() - 0.5)` is the classic JS shuffle
 * bug: comparator-based shuffling does not produce a uniform permutation, and
 * V8's sort makes some orderings markedly more likely than others. For a
 * question bank that means the same items surfacing repeatedly in "random"
 * practice — which reads as the app being repetitive rather than as a bug.
 */
function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Draw `n` questions in the proportions of the student's real exam paper.
 *
 * Falls back to a plain shuffle when no blueprint is on file — a missing
 * exam_shape_profiles row should degrade to "random practice", never to an
 * error in front of a student.
 */
async function sampleToBlueprint(
  supabase: any,
  list: any[],
  n: number,
  chapterId: string,
): Promise<any[]> {
  let proportions: Record<string, number> | null = null;
  try {
    const { data: ch } = await supabase
      .from('curriculum_chapters')
      .select('summative_no, curriculum_subjects_by_class(class_level, board_code)')
      .eq('id', chapterId)
      .maybeSingle();

    const cls = ch?.curriculum_subjects_by_class?.class_level;
    const board = ch?.curriculum_subjects_by_class?.board_code;
    if (cls && board) {
      const { data: shape } = await supabase
        .from('exam_shape_profiles')
        .select('type_proportions')
        .eq('board_code', board)
        .eq('class_level', cls)
        .eq('exam_kind', ch?.summative_no ? `summative_${ch.summative_no}` : 'mock_default')
        .maybeSingle();
      proportions = shape?.type_proportions || null;
    }
  } catch {
    // fall through to a plain shuffle
  }

  if (!proportions) return shuffle(list).slice(0, n);

  const byType = new Map<string, any[]>();
  for (const r of list) {
    if (!byType.has(r.question_type)) byType.set(r.question_type, []);
    byType.get(r.question_type)!.push(r);
  }

  const out: any[] = [];
  for (const [qtype, share] of Object.entries(proportions)) {
    const pool = byType.get(qtype);
    if (!pool?.length || !share) continue;
    const want = Math.round(n * (share as number));
    out.push(...shuffle(pool).slice(0, want));
  }

  // Rounding leaves gaps, and a type the bank has none of leaves more. Top up
  // from whatever is left so the student always gets the count she asked for.
  if (out.length < n) {
    const chosen = new Set(out.map((r) => r.id));
    out.push(...shuffle(list.filter((r) => !chosen.has(r.id))).slice(0, n - out.length));
  }

  return shuffle(out).slice(0, n);
}
