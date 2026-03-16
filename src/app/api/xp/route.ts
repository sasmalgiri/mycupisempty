import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import {
  awardXP,
  getXPBreakdown,
  getRecentXPEvents,
  calculateLevel,
  xpToNextLevel,
} from '@/lib/xp-engine';

/**
 * GET /api/xp
 * Returns user's XP breakdown: total, level, xp to next level,
 * breakdown by pillar, and recent XP events.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch user stats
    const { data: stats } = await supabase
      .from('user_stats')
      .select('total_xp, level')
      .eq('user_id', user.id)
      .single();

    const totalXP = stats?.total_xp || 0;
    const level = stats?.level || calculateLevel(totalXP);
    const xpNeeded = xpToNextLevel(totalXP);

    // Fetch breakdown and recent events in parallel
    const [breakdown, recentEvents] = await Promise.all([
      getXPBreakdown(supabase, user.id),
      getRecentXPEvents(supabase, user.id, 20),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        total_xp: totalXP,
        level,
        xp_to_next_level: xpNeeded,
        breakdown,
        recent_events: recentEvents,
      },
    });
  } catch (error) {
    console.error('XP API GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch XP data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/xp
 * Award XP to the current user.
 * Body: { pillar, action, source_id?, description? }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { pillar, action, source_id, description } = body;

    if (!pillar || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: pillar, action' },
        { status: 400 }
      );
    }

    const result = await awardXP(
      supabase,
      user.id,
      pillar,
      action,
      source_id,
      description
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('XP API POST error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to award XP';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
