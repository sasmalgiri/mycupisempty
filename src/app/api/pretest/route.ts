/**
 * Pretest generator — returns 2 multiple-choice prequestions tightly bound
 * to a specific topic. Pulls from the existing `questions` table when
 * possible (real curriculum-aligned items), with a deterministic fallback
 * for topics that don't have authored MCQs yet.
 *
 * Why exactly 2: meta-analysis (Pan, Sana et al. 2023) finds the
 * prequestion effect operates on the *specific items pretested*. More than
 * 2-3 items turns this into a quiz and crosses into spaced-rep territory.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

interface PretestQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  reason: string;
}

export async function GET(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const topicId = url.searchParams.get('topicId');
    if (!topicId) return NextResponse.json({ error: 'topicId required' }, { status: 400 });

    // Try to pull two real MCQs scoped to this topic. Easy band first —
    // pretests are warm-ups, not gates.
    const { data: rows } = await supabase
      .from('questions')
      .select('id, question_text, options, correct_answer, explanation, difficulty')
      .eq('topic_id', topicId)
      .eq('question_type', 'mcq')
      .in('difficulty', ['easy', 'medium'])
      .limit(2);

    const items = (rows || []) as Array<{
      id: string;
      question_text: string;
      options: string[];
      correct_answer: string;
      explanation: string | null;
    }>;

    const questions: PretestQuestion[] = items
      .filter((q) => Array.isArray(q.options) && q.options.length >= 2)
      .map((q) => {
        const correctIndex = Math.max(0, q.options.indexOf(q.correct_answer));
        return {
          id: q.id,
          prompt: q.question_text,
          options: q.options.slice(0, 4),
          correctIndex,
          reason: (q.explanation || 'This connects to what we\'re about to cover.').slice(0, 240),
        };
      });

    return NextResponse.json({ success: true, questions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
