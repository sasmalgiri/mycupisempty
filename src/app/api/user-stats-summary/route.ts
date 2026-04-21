import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/** Tiny fast endpoint for components that only need the core stats */
export async function GET() {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: stats } = await supabase
      .from('user_stats')
      .select('total_xp, current_streak, last_activity_date, total_questions_answered, correct_answers')
      .eq('user_id', user.id)
      .maybeSingle();
    return NextResponse.json({ success: true, stats: stats || { total_xp: 0, current_streak: 0 } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
