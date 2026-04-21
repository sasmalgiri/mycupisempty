/**
 * Character Growth API — focused tracker for the student's chosen
 * character quality.
 *
 * Returns:
 *   - The chosen dimension + date it was set
 *   - Count of observed character_moment signals for that dimension
 *   - Total character_xp earned for that dimension
 *   - Recent moments (last 6) with companion attribution + subject
 *   - Weekly rhythm (moments per ISO week over past 8 weeks)
 *   - A simple narrative sentence
 *
 * The student sees this as their "quiet growth" — the thing no other app
 * tracks explicitly, because it's the one thing that matters most.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const studentId = url.searchParams.get('studentId') || user.id;

    // Parent access check
    if (studentId !== user.id) {
      const { data: link } = await supabase
        .from('parent_student_links')
        .select('*')
        .eq('parent_id', user.id)
        .eq('student_id', studentId)
        .maybeSingle();
      if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Profile for chosen goal
    const { data: profile } = await supabase
      .from('profiles')
      .select('character_goal, onboarded_at, full_name')
      .eq('id', studentId)
      .maybeSingle();

    const goal = profile?.character_goal || null;

    // Character signals & XP events
    const [{ data: momentSignals }, { data: xpEvents }] = await Promise.all([
      supabase.from('learner_signals')
        .select('metadata, created_at, source, subject_id, subjects(title)')
        .eq('user_id', studentId)
        .eq('signal_type', 'character_moment')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('xp_events')
        .select('xp_amount, description, created_at, source_action')
        .eq('user_id', studentId)
        .eq('source_pillar', 'character')
        .order('created_at', { ascending: false })
        .limit(200),
    ]);

    interface MomentRow {
      moment?: string;
      dimension?: string;
      isChosenGoal: boolean;
      source: string;
      subjectName: string;
      at: string;
    }
    const moments: MomentRow[] = (momentSignals || []).map((m: any) => ({
      moment: m.metadata?.moment,
      dimension: m.metadata?.dimension,
      isChosenGoal: !!m.metadata?.is_chosen_goal,
      source: m.source,
      subjectName: m.subjects?.title || 'general',
      at: m.created_at,
    }));

    // Filter to student's chosen dimension + count
    const onGoalMoments: MomentRow[] = goal ? moments.filter((m: MomentRow) => m.dimension === goal) : [];
    const otherMoments: MomentRow[] = goal ? moments.filter((m: MomentRow) => m.dimension !== goal) : moments;

    const totalCharacterXP = (xpEvents || []).reduce((s: number, e: any) => s + (e.xp_amount || 0), 0);

    // Weekly rhythm: moments grouped per ISO week for the past 8 weeks
    const weekBuckets: Record<string, number> = {};
    const now = new Date();
    for (let w = 7; w >= 0; w--) {
      const d = new Date(now.getTime() - w * 7 * 86400 * 1000);
      const key = weekKey(d);
      weekBuckets[key] = 0;
    }
    for (const m of onGoalMoments) {
      const key = weekKey(new Date(m.at));
      if (weekBuckets[key] !== undefined) weekBuckets[key]++;
    }

    // Narrative sentence
    const firstName = (profile?.full_name || '').split(' ')[0] || 'You';
    const label = goal ? goal.replace(/_/g, ' ') : null;
    let narrative: string;
    if (!goal) {
      narrative = `${firstName} hasn\'t chosen a character goal yet. Pick one to quietly anchor growth.`;
    } else if (onGoalMoments.length === 0) {
      narrative = `${firstName} has chosen ${label}. No moments captured yet — they will come as companions notice them in your work.`;
    } else if (onGoalMoments.length < 5) {
      narrative = `${firstName} is growing in ${label}. ${onGoalMoments.length} moment${onGoalMoments.length === 1 ? '' : 's'} captured so far.`;
    } else if (onGoalMoments.length < 20) {
      narrative = `${firstName} is practicing ${label} steadily — ${onGoalMoments.length} moments this journey. The cup fills slowly, but it fills.`;
    } else {
      narrative = `${firstName} has deeply embodied ${label} — ${onGoalMoments.length} observed moments. This is becoming part of who they are, not just what they do.`;
    }

    return NextResponse.json({
      success: true,
      characterGoal: goal,
      goalLabel: label,
      setAt: profile?.onboarded_at || null,
      totalCharacterXP,
      onGoalMomentCount: onGoalMoments.length,
      otherMomentCount: otherMoments.length,
      recentMoments: onGoalMoments.slice(0, 6),
      weeklyRhythm: Object.entries(weekBuckets).map(([week, count]) => ({ week, count })),
      narrative,
    });
  } catch (error: any) {
    console.error('Character-growth error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function weekKey(d: Date): string {
  // ISO-ish year-week string (good enough for bucketing)
  const year = d.getFullYear();
  const firstJan = new Date(year, 0, 1);
  const days = Math.floor((d.getTime() - firstJan.getTime()) / 86400000);
  const week = Math.ceil((days + firstJan.getDay() + 1) / 7);
  return `${year}W${String(week).padStart(2, '0')}`;
}
