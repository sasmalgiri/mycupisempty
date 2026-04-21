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

    // Check opt-in status from user_stats
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('full_name')
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

    // Get participating users (opted in) + their display info
    const participatingUserIds = Object.keys(thisXPByUser);
    const { data: participants } = await supabase
      .from('league_participation')
      .select('user_id, display_name, badge_emoji, opted_in')
      .in('user_id', participatingUserIds.length > 0 ? participatingUserIds : ['__none__']);

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
      // Accuracy unavailable at this granularity — set to 0 for now, extend later
      const growthBonus = computeGrowthBonus(weekly, prev, 0, 0);
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
