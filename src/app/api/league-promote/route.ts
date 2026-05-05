/**
 * Weekly league tier promotion / demotion job.
 *
 * Vercel cron hits this Monday 00:30 UTC after a fresh league week begins,
 * applying tierTransition() to last week's standings and writing the new
 * tier into each student's row in weekly_league_standings (the next read of
 * /api/streak will lazily create their fresh-week league at the new tier).
 *
 * Authorization: Bearer ${CRON_SECRET} or ?secret=... for local dev.
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { tierTransition, thisWeekMonday } from '@/lib/streak';

function isAuthorizedCron(req: Request): boolean {
  const auth = req.headers.get('authorization') || '';
  const expected = process.env.CRON_SECRET || '';
  if (!expected) return false;
  if (auth === `Bearer ${expected}`) return true;
  const url = new URL(req.url);
  if (url.searchParams.get('secret') === expected) return true;
  return false;
}

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin: any = createAdminClient();

  // Last week's Monday = current week's Monday minus 7 days
  const thisMon = new Date(thisWeekMonday() + 'T00:00:00Z');
  const lastMon = new Date(thisMon.getTime() - 7 * 86400000);
  const lastMonStr = lastMon.toISOString().split('T')[0];

  const { data: leagues, error: lerr } = await admin
    .from('weekly_leagues')
    .select('id, tier, cohort_key, week_start_date')
    .eq('week_start_date', lastMonStr);
  if (lerr) return NextResponse.json({ error: lerr.message }, { status: 500 });

  let promoted = 0, demoted = 0, stayed = 0, inactive = 0;
  const errors: string[] = [];

  for (const league of (leagues || [])) {
    const { data: standings } = await admin
      .from('weekly_league_standings')
      .select('id, user_id, weekly_xp')
      .eq('league_id', league.id)
      .order('weekly_xp', { ascending: false });
    const list = standings || [];
    const cohortSize = list.length;
    for (let i = 0; i < list.length; i++) {
      const row = list[i];
      const decision = tierTransition({
        currentTier: league.tier,
        rank: i + 1,
        cohortSize,
        weeklyXp: row.weekly_xp || 0,
      });
      if (decision.reason === 'promote') promoted++;
      else if (decision.reason === 'demote') demoted++;
      else if (decision.reason === 'inactive') inactive++;
      else stayed++;
      // Write the decision into the standing row's promoted_to_tier column so
      // /api/streak can pick it up when creating next week's league.
      const { error: uerr } = await admin
        .from('weekly_league_standings')
        .update({
          promoted_to_tier: decision.newTier,
          promotion_reason: decision.reason,
          promoted_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      if (uerr) errors.push(uerr.message);
    }
  }

  return NextResponse.json({
    success: true,
    week_evaluated: lastMonStr,
    leagues_evaluated: (leagues || []).length,
    promoted,
    demoted,
    stayed,
    inactive,
    errors: errors.slice(0, 10),
  });
}
