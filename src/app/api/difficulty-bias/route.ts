/**
 * Difficulty Bias — records a single "too easy / just right / too hard" thumb
 * from the student and nudges the next day's challenge band accordingly.
 *
 * We don't compute a new band here — we just log the signal. The daily-mix
 * generator already reads recent difficulty signals when picking items.
 * Keeping the logic in one place (daily-mix) avoids double-counting.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

type Feedback = 'too_easy' | 'just_right' | 'too_hard';

export async function POST(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const feedback = body.feedback as Feedback;
    const context = typeof body.context === 'string' ? body.context.slice(0, 60) : 'unknown';

    if (!['too_easy', 'just_right', 'too_hard'].includes(feedback)) {
      return NextResponse.json({ error: 'Invalid feedback' }, { status: 400 });
    }

    await supabase.from('learner_signals').insert({
      user_id: user.id,
      signal_type: 'difficulty_feel',
      category: 'emotional',
      source: 'daily_mix',
      value: feedback === 'too_easy' ? 0 : feedback === 'just_right' ? 0.5 : 1,
      metadata: { response: feedback, context },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
