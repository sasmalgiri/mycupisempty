/**
 * Leagues API
 *
 * GET                 — returns the current league view for the user.
 * POST action=opt_in  — student opts into weekly leagues (pseudonymous).
 * POST action=opt_out — student leaves leagues.
 * POST action=pick_badge — update display name + emoji.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { buildLeagueView, currentWeekBoundaries, computeGrowthBonus, type RawLeagueRow } from '@/lib/leagues';

export async function GET(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { start, end } = currentWeekBoundaries();
    const url = new URL(request.url);
    const cohortMode = url.searchParams.get('cohort') || 'class_board'; // 'class_board' | 'school'

    // Check opt-in status from user_stats. Also pull cohort key fields so the
    // league filters to peers in the same class+board (or same school).
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('full_name, current_class, board_code, school_id')
      .eq('id', user.id)
      .single();

    const { data: leagueOpt } = await supabase
      .from('league_participation')
      .select('opted_in, display_name, badge_emoji')
      .eq('user_id', user.id)
      .maybeSingle();

    const optedIn = leagueOpt?.opted_in ?? false;
    const myDisplayName = leagueOpt?.display_name || myProfile?.full_name?.split(' ')[0] || 'You';
    const myBadge = leagueOpt?.badge_emoji || '🌱';

    // Pull XP events for this week
    const { data: thisWeekXP } = await supabase
      .from('xp_events')
      .select('user_id, xp_amount')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    // Last week for growth bonus
    const lastWeekEnd = new Date(start.getTime() - 1);
    const lastWeekStart = new Date(lastWeekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
    const { data: lastWeekXP } = await supabase
      .from('xp_events')
      .select('user_id, xp_amount')
      .gte('created_at', lastWeekStart.toISOString())
      .lte('created_at', lastWeekEnd.toISOString());

    // Aggregate
    const thisXPByUser: Record<string, number> = {};
    for (const e of thisWeekXP || []) {
      thisXPByUser[e.user_id] = (thisXPByUser[e.user_id] || 0) + (e.xp_amount || 0);
    }
    const lastXPByUser: Record<string, number> = {};
    for (const e of lastWeekXP || []) {
      lastXPByUser[e.user_id] = (lastXPByUser[e.user_id] || 0) + (e.xp_amount || 0);
    }

    // Pull session_evaluations to compute weekly accuracy per user — feeds
    // the growth bonus so improvement matters, not just XP volume.
    const userIdsForAcc = Array.from(new Set([...Object.keys(thisXPByUser), ...Object.keys(lastXPByUser)]));
    const accThisByUser: Record<string, { sum: number; n: number }> = {};
    const accLastByUser: Record<string, { sum: number; n: number }> = {};
    if (userIdsForAcc.length > 0) {
      const { data: evals } = await supabase
        .from('session_evaluations')
        .select('user_id, score, evaluated_at')
        .in('user_id', userIdsForAcc)
        .gte('evaluated_at', lastWeekStart.toISOString())
        .lte('evaluated_at', end.toISOString());
      for (const ev of evals || []) {
        const t = new Date(ev.evaluated_at).getTime();
        const bucket = t >= start.getTime() ? accThisByUser : accLastByUser;
        const cur = bucket[ev.user_id] || { sum: 0, n: 0 };
        cur.sum += Number(ev.score) || 0;
        cur.n += 1;
        bucket[ev.user_id] = cur;
      }
    }

    // Get participating users (opted in) + their display info, restricted to the
    // caller's cohort. Default cohort = same class + same board; cohort=school
    // narrows further to the caller's school_id (if they have one).
    const participatingUserIds = Object.keys(thisXPByUser);
    let cohortIds: string[] = [];
    if (participatingUserIds.length > 0) {
      let cohortQ = supabase
        .from('profiles')
        .select('id')
        .in('id', participatingUserIds);
      if (myProfile?.current_class) cohortQ = cohortQ.eq('current_class', myProfile.current_class);
      if (myProfile?.board_code) cohortQ = cohortQ.eq('board_code', myProfile.board_code);
      if (cohortMode === 'school' && myProfile?.school_id) cohortQ = cohortQ.eq('school_id', myProfile.school_id);
      const { data: cohortRows } = await cohortQ;
      cohortIds = (cohortRows || []).map((r: any) => r.id);
    }
    const { data: participants } = await supabase
      .from('league_participation')
      .select('user_id, display_name, badge_emoji, opted_in')
      .in('user_id', cohortIds.length > 0 ? cohortIds : ['__none__']);

    const optedInMap = new Map<string, { name: string; badge: string }>();
    for (const p of participants || []) {
      if (p.opted_in) {
        optedInMap.set(p.user_id, { name: p.display_name || 'Learner', badge: p.badge_emoji || '🌱' });
      }
    }
    // Always include self
    if (optedIn) {
      optedInMap.set(user.id, { name: myDisplayName, badge: myBadge });
    }

    const rows: RawLeagueRow[] = [];
    for (const [uid, info] of optedInMap.entries()) {
      const weekly = thisXPByUser[uid] || 0;
      const prev = lastXPByUser[uid] || 0;
      const accThis = accThisByUser[uid] ? accThisByUser[uid].sum / Math.max(1, accThisByUser[uid].n) : 0;
      const accLast = accLastByUser[uid] ? accLastByUser[uid].sum / Math.max(1, accLastByUser[uid].n) : 0;
      const growthBonus = computeGrowthBonus(weekly, prev, accThis, accLast);
      rows.push({
        userId: uid,
        displayName: info.name,
        badgeEmoji: info.badge,
        weeklyXP: weekly,
        growthBonus,
      });
    }

    // If user opted out, still compute rank privately (don't expose their name to others)
    if (!optedIn && thisXPByUser[user.id] > 0) {
      rows.push({
        userId: user.id,
        displayName: myDisplayName,
        badgeEmoji: myBadge,
        weeklyXP: thisXPByUser[user.id],
        growthBonus: 0,
      });
    }

    const view = buildLeagueView({
      myUserId: user.id,
      rows,
      optedIn,
    });

    return NextResponse.json({ success: true, view });
  } catch (error: any) {
    console.error('Leagues GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { action, displayName, badgeEmoji } = body;

    if (action === 'opt_in') {
      await supabase.from('league_participation').upsert({
        user_id: user.id,
        opted_in: true,
        display_name: displayName || null,
        badge_emoji: badgeEmoji || '🌱',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      return NextResponse.json({ success: true, optedIn: true });
    }

    if (action === 'opt_out') {
      await supabase.from('league_participation').upsert({
        user_id: user.id,
        opted_in: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      return NextResponse.json({ success: true, optedIn: false });
    }

    if (action === 'pick_badge') {
      await supabase.from('league_participation').upsert({
        user_id: user.id,
        display_name: displayName || null,
        badge_emoji: badgeEmoji || '🌱',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Leagues POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
