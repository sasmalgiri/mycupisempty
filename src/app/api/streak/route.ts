/**
 * Streak + League API.
 *
 * GET → { streak, league: { tier, members[], myStanding } | null }
 * POST { action: 'tick' }       → tick streak today, return delta + new state
 * POST { action: 'add_xp', xp } → add xp to this week's standing in user's league
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { tickStreak, cohortKey, thisWeekMonday, generateAnonHandle, tierMeta } from '@/lib/streak';

export async function GET(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: streak } = await supabase
      .from('streaks')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    // Fetch profile for cohort assignment context
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_class, board_code, language')
      .eq('id', user.id)
      .maybeSingle();

    const ck = cohortKey({
      board: profile?.board_code,
      classLevel: profile?.current_class,
      language: profile?.language,
    });
    const week = thisWeekMonday();

    // Find or create the student's league for this week
    let league: any = null;
    let standings: any[] = [];

    const { data: myStanding } = await supabase
      .from('weekly_league_standings')
      .select('*, weekly_leagues(*)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (myStanding?.weekly_leagues && myStanding.weekly_leagues.week_start_date === week) {
      league = myStanding.weekly_leagues;
      const { data: rows } = await supabase
        .from('weekly_league_standings')
        .select('user_id, weekly_xp, anon_handle')
        .eq('league_id', league.id)
        .order('weekly_xp', { ascending: false })
        .limit(40);
      standings = rows || [];
    }

    return NextResponse.json({
      success: true,
      streak: streak || null,
      league: league
        ? { tier: league.tier, week: league.week_start_date, cohort: league.cohort_key, standings, tier_meta: tierMeta(league.tier) }
        : null,
      cohort_key_proposed: ck,
      week_proposed: week,
    });
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
    const action = body.action;

    if (action === 'tick') {
      const { data: prev } = await supabase
        .from('streaks')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      const update = tickStreak(prev || null);
      await supabase.from('streaks').upsert({
        user_id: user.id,
        ...update.state,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      return NextResponse.json({ success: true, ...update });
    }

    if (action === 'add_xp') {
      const xp = Math.max(0, Math.min(500, Number(body.xp) || 0));
      if (xp === 0) return NextResponse.json({ success: true, addedXp: 0 });

      // Look up profile + ensure standing for this week's cohort
      const { data: profile } = await supabase
        .from('profiles')
        .select('current_class, board_code, language')
        .eq('id', user.id)
        .maybeSingle();
      const ck = cohortKey({
        board: profile?.board_code,
        classLevel: profile?.current_class,
        language: profile?.language,
      });
      const week = thisWeekMonday();

      // Find a current-week league for this cohort at the student's tier (default 1).
      // Tier promotion / demotion is handled by a weekly job — out of this commit.
      let { data: league } = await supabase
        .from('weekly_leagues')
        .select('*')
        .eq('cohort_key', ck)
        .eq('week_start_date', week)
        .order('tier', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!league) {
        const { data: created } = await supabase
          .from('weekly_leagues')
          .insert({ tier: 1, week_start_date: week, cohort_key: ck })
          .select()
          .single();
        league = created;
      }

      // Upsert standing
      const handle = generateAnonHandle(`${user.id}:${league.id}`);
      const { data: existing } = await supabase
        .from('weekly_league_standings')
        .select('id, weekly_xp')
        .eq('league_id', league.id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (existing) {
        await supabase
          .from('weekly_league_standings')
          .update({ weekly_xp: existing.weekly_xp + xp, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('weekly_league_standings')
          .insert({ league_id: league.id, user_id: user.id, weekly_xp: xp, anon_handle: handle });
      }
      return NextResponse.json({ success: true, addedXp: xp, league_id: league.id });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
