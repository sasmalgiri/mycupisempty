/**
 * Encouragement Engine — picks one grade-appropriate emotional-scaffolding
 * line for a given trigger.
 *
 * GET ?trigger=low_score&class=8&lang=bn → { line, tone }
 *
 * Used by Daily Mix challenge feedback, exit-eval feedback, dashboard streak
 * card, post-break recall card. Caller decides when to show it.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

const VALID_TRIGGERS = [
  'low_score', 'overconfident_wrong', 'guess_correct', 'first_wrong_in_session',
  'streak_broken', 'returning_after_gap', 'big_concept_done', 'effort_low',
];

export async function GET(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const trigger = url.searchParams.get('trigger') || '';
    if (!VALID_TRIGGERS.includes(trigger)) return NextResponse.json({ error: 'invalid trigger' }, { status: 400 });
    // Default class + language come from the caller's profile when query params
    // aren't supplied — keeps the call sites lean.
    let klass: number | null = url.searchParams.get('class') ? Number(url.searchParams.get('class')) : null;
    let language: string | null = url.searchParams.get('lang');
    if (!klass || !language) {
      const { data: profile } = await supabase.from('profiles').select('current_class, language').eq('id', user.id).maybeSingle();
      if (!klass) klass = profile?.current_class || 8;
      if (!language) language = profile?.language || 'bn';
    }
    klass = Math.max(1, Math.min(12, klass || 8));
    language = (language || 'bn').toLowerCase();

    const { data: rows } = await supabase
      .from('encouragement_lines')
      .select('body, tone')
      .eq('trigger', trigger)
      .eq('language', language)
      .eq('is_active', true)
      .lte('class_min', klass)
      .gte('class_max', klass)
      .limit(20);
    const list = rows || [];
    if (list.length === 0) return NextResponse.json({ success: true, line: null });
    const pick = list[Math.floor(Math.random() * list.length)];
    return NextResponse.json({ success: true, line: pick.body, tone: pick.tone });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
