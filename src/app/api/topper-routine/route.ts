/**
 * Topper Routine logger.
 *
 * GET → { date, steps: [{step, completed, durationSeconds, payload}] for today }
 * POST { step, durationSeconds?, payload? } → mark a step done for today.
 *
 * Steps are: flashcards | new_concept | mixed | past_paper | teach_back.
 * The /topper-routine page strings the existing FSRS / daily-mix / interleave /
 * mock-test / companion endpoints together; this route just records what's done
 * so the parent / dashboard can show "✅ 3 / 5 steps today".
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

const VALID_STEPS = new Set(['flashcards', 'new_concept', 'mixed', 'past_paper', 'teach_back']);

export async function GET() {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('topper_routine_log')
      .select('step, completed, duration_seconds, payload, logged_at')
      .eq('user_id', user.id)
      .eq('routine_date', today);
    return NextResponse.json({ success: true, date: today, steps: data || [] });
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
    if (!VALID_STEPS.has(body.step)) {
      return NextResponse.json({ error: 'invalid step' }, { status: 400 });
    }
    const today = new Date().toISOString().split('T')[0];
    await supabase
      .from('topper_routine_log')
      .upsert({
        user_id: user.id,
        routine_date: today,
        step: body.step,
        completed: true,
        duration_seconds: Number(body.durationSeconds) || null,
        payload: body.payload || {},
      }, { onConflict: 'user_id,routine_date,step' });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
