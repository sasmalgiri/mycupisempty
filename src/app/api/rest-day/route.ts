/**
 * Rest Day — wellness-first streak framing.
 *
 * Duolingo guilts students with "your streak is on fire!" — stressful for
 * kids, especially at exam time. We flip it: a rest day is a CONSCIOUS
 * choice, not a failure. Streak doesn't break; it enters "recovery" mode.
 *
 * Rules:
 *   - Student earns 1 rest day every 7 consecutive active days (capped at 3)
 *   - Using a rest day keeps the streak alive without guilt messaging
 *   - "Overwhelm detected" (frustration >7 three days in a row) auto-suggests
 *     a rest day
 *   - Parents see rest days in growth timeline (sign of self-regulation —
 *     a CHARACTER dimension)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { buildStudentState } from '@/lib/student-state';

export async function GET() {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Load user stats + rest day record
    const [statsResult, restResult] = await Promise.all([
      supabase.from('user_stats')
        .select('current_streak, longest_streak, last_activity_date')
        .eq('user_id', user.id)
        .maybeSingle()
        .catch(() => ({ data: null })),
      supabase.from('rest_days')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
        .catch(() => ({ data: null })),
    ]);

    const stats = statsResult?.data || { current_streak: 0, longest_streak: 0, last_activity_date: null };
    const rest = restResult?.data || { available: 0, used: 0, last_used_date: null, earned: 0 };

    // Compute earned rest days: floor(streak / 7), max 3, minus already used
    const currentStreak = stats.current_streak || 0;
    const totalEarned = Math.min(Math.floor(currentStreak / 7), 3);
    const used = rest.used || 0;
    const available = Math.max(0, totalEarned - used);

    // Detect overwhelm → suggest rest day
    let suggestRest = false;
    let suggestReason = '';
    try {
      const state = await buildStudentState(supabase, user.id);
      if (state.frustrationLevel > 6 && currentStreak >= 5) {
        suggestRest = true;
        suggestReason = `You've been pushing hard for ${currentStreak} days. A rest day now keeps learning healthy.`;
      } else if (state.cognitiveLoad === 'heavy' && state.minutesActiveToday > 60) {
        suggestRest = true;
        suggestReason = `You've absorbed a lot today. Resting is how memory consolidates — it's still learning.`;
      }
    } catch {}

    return NextResponse.json({
      success: true,
      currentStreak,
      longestStreak: stats.longest_streak || 0,
      lastActivityDate: stats.last_activity_date,
      restDays: {
        available,
        used,
        totalEarned,
        lastUsedDate: rest.last_used_date,
      },
      suggestRest,
      suggestReason,
      // UX messaging — never shaming
      message: currentStreak === 0
        ? `Fresh start — your learning journey begins today.`
        : available > 0
        ? `You've earned ${available} rest day${available === 1 ? '' : 's'}. Using one is a skill, not a failure.`
        : `Keep going — your next rest day is earned at day ${(Math.floor(currentStreak / 7) + 1) * 7}.`,
    });
  } catch (error: any) {
    console.error('Rest-day GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { action } = body;

    if (action === 'use_rest_day') {
      // Validate: does user have available rest days?
      const { data: stats } = await supabase
        .from('user_stats')
        .select('current_streak')
        .eq('user_id', user.id)
        .maybeSingle();
      const { data: rest } = await supabase
        .from('rest_days')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      const currentStreak = stats?.current_streak || 0;
      const totalEarned = Math.min(Math.floor(currentStreak / 7), 3);
      const used = rest?.used || 0;
      const available = Math.max(0, totalEarned - used);

      if (available === 0) {
        return NextResponse.json({
          error: `No rest days available yet. Complete a 7-day streak to earn one.`,
        }, { status: 403 });
      }

      const today = new Date().toISOString().split('T')[0];

      // Upsert the rest day record
      await supabase.from('rest_days').upsert({
        user_id: user.id,
        used: used + 1,
        last_used_date: today,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      // Preserve the streak by updating last_activity_date to today
      await supabase.from('user_stats').update({
        last_activity_date: today,
      }).eq('user_id', user.id);

      // Record as a character-dimension signal (self-regulation)
      try {
        await supabase.from('learner_signals').insert({
          user_id: user.id,
          signal_type: 'rest_day_used',
          category: 'character',
          source: 'rest_day',
          value: 1,
          metadata: { streak_at_use: currentStreak },
          created_at: new Date().toISOString(),
        });
      } catch {}

      return NextResponse.json({
        success: true,
        message: `Rest day used. Your ${currentStreak}-day streak is safe. Come back tomorrow rested.`,
        restDaysRemaining: available - 1,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Rest-day POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
