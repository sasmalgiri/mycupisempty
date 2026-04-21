/**
 * Smart Reminders API — returns personalized reminder schedule.
 *
 * This is what the client polls (or what a cron job reads) to send notifications.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { computeReminderSchedule } from '@/lib/smart-reminders';
import { buildMasteryMap } from '@/lib/mastery';

export async function GET() {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [signalsResult, statsResult, masteryMaps] = await Promise.all([
      supabase.from('learner_signals')
        .select('signal_type, value, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500)
        .catch(() => ({ data: [] })),
      supabase.from('user_stats')
        .select('current_streak, last_activity_date')
        .eq('user_id', user.id)
        .single()
        .catch(() => ({ data: null })),
      buildMasteryMap(supabase, user.id).catch(() => []),
    ]);

    const signals = signalsResult?.data || [];
    const stats = statsResult?.data || {};

    // Count fragile and decayed across all subjects
    let fragileTopicsCount = 0;
    let decayedTopicsCount = 0;
    if (Array.isArray(masteryMaps)) {
      for (const m of masteryMaps) {
        if (m?.counts) {
          fragileTopicsCount += m.counts.fragile || 0;
          decayedTopicsCount += m.counts.decayed || 0;
        }
      }
    }

    const schedule = computeReminderSchedule(user.id, signals, {
      currentStreak: stats.current_streak,
      lastActivityDate: stats.last_activity_date,
      fragileTopicsCount,
      decayedTopicsCount,
    });

    return NextResponse.json({ success: true, schedule });
  } catch (error: any) {
    console.error('Smart reminders error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
