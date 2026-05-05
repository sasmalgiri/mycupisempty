/**
 * Yesterday's mistake — first card every day.
 *
 * GET → { mistake: { evaluationId, chapterId, topicId, score, prompt, expectedAnswer } | null }
 *
 * Pulls from v_yesterdays_mistake (lowest-score eval in last 36h with score < 0.7),
 * then re-hydrates a question from chapter_question_bank scoped to that chapter
 * so the student gets a fresh question on the same concept (not the literal
 * one they just got wrong).
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: row } = await supabase
      .from('v_yesterdays_mistake')
      .select('evaluation_id, chapter_id, topic_id, subject_id, score, evaluated_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!row || !row.chapter_id) return NextResponse.json({ success: true, mistake: null });

    // Pick a fresh similar question from the same chapter (prefer same topic).
    let q = supabase
      .from('chapter_question_bank')
      .select('id, question_text, answer_text, options, correct_index, question_type, marks, working')
      .eq('chapter_id', row.chapter_id)
      .order('confidence', { ascending: false })
      .limit(20);
    if (row.topic_id) q = q.eq('topic_id', row.topic_id);
    const { data: candidates } = await q;
    const list = (candidates || []) as any[];
    if (list.length === 0) return NextResponse.json({ success: true, mistake: null });
    const pick = list[Math.floor(Math.random() * list.length)];

    return NextResponse.json({
      success: true,
      mistake: {
        evaluationId: row.evaluation_id,
        chapterId: row.chapter_id,
        topicId: row.topic_id,
        score: row.score,
        question: pick,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
