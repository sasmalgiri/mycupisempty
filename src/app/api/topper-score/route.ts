/**
 * Topper score — single composite 0-100 metric for the dashboard headline.
 *
 * GET → { score, mastery, adherence, honestyXp, streak, practiceFreq, breakdown }
 *
 * Pulls from v_topper_score (computed in Postgres so the view stays the source
 * of truth). The breakdown lets the UI explain "why is the number what it is".
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: row } = await supabase
      .from('v_topper_score')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!row) return NextResponse.json({ success: true, score: null });

    const mastery = Number(row.mastery_pct) || 0;
    const adherence = Number(row.adherence_pct) || 0;
    const honestyXp = Number(row.honesty_xp) || 0;
    const practice = Number(row.practice_freq) || 0;
    const streak = Number(row.streak) || 0;

    const breakdown = {
      masteryContribution:    Math.round(45 * mastery),
      adherenceContribution:  Math.round(25 * adherence),
      honestyContribution:    Math.round(15 * Math.min(honestyXp, 200) / 200),
      practiceContribution:   Math.round(10 * practice),
      streakContribution:     Math.round(5 * Math.min(streak, 30) / 30),
    };

    return NextResponse.json({
      success: true,
      score: row.topper_score,
      mastery,
      adherence,
      honestyXp,
      streak,
      practiceFreq: practice,
      breakdown,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
