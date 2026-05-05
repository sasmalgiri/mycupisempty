/**
 * Arena API — persist a minigame result, recompute and cache the aggregate
 * Arena profile back to learner_profiles.behavioral_observations.
 *
 * GET ?last=10           → recent minigame_results for the user (debug + history)
 * POST { game, signals, trigger?, accuracy?, rt_p50_ms?, difficulty_reached? }
 *      → insert one play, return { profile, samplesUsed }
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import {
  ARENA_GAMES,
  aggregateProfile,
  type MinigameId,
  type TriggerKind,
} from '@/lib/arena-signals';

const VALID_TRIGGERS: TriggerKind[] = [
  'first_session', 'session_start', 'weekly', 'recalibration', 'manual',
];

const HISTORY_DAYS = 60;  // window we use to build the aggregate profile

export async function GET(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('last') || 20)));

    const { data: rows } = await supabase
      .from('minigame_results')
      .select('id, game, signals, accuracy, rt_p50_ms, difficulty_reached, duration_seconds, trigger, played_at')
      .eq('user_id', user.id)
      .order('played_at', { ascending: false })
      .limit(limit);

    return NextResponse.json({ success: true, results: rows || [] });
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
    const game = body.game as MinigameId;
    if (!ARENA_GAMES.includes(game)) {
      return NextResponse.json({ error: 'Invalid game' }, { status: 400 });
    }
    if (!body.signals || typeof body.signals !== 'object') {
      return NextResponse.json({ error: 'signals object required' }, { status: 400 });
    }
    const trigger: TriggerKind = VALID_TRIGGERS.includes(body.trigger) ? body.trigger : 'manual';

    // Insert the play. Cap signals payload size so an abusive client can't
    // bloat the table.
    const signalsString = JSON.stringify(body.signals);
    if (signalsString.length > 10_000) {
      return NextResponse.json({ error: 'signals payload too large' }, { status: 413 });
    }

    const { data: inserted, error } = await supabase
      .from('minigame_results')
      .insert({
        user_id: user.id,
        game,
        signals: body.signals,
        accuracy: typeof body.accuracy === 'number' ? body.accuracy : null,
        rt_p50_ms: typeof body.rt_p50_ms === 'number' ? Math.round(body.rt_p50_ms) : null,
        difficulty_reached: typeof body.difficulty_reached === 'number' ? body.difficulty_reached : null,
        duration_seconds: typeof body.duration_seconds === 'number' ? Math.round(body.duration_seconds) : null,
        trigger,
      })
      .select()
      .single();

    if (error) {
      console.error('Arena insert failed:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Recompute aggregate profile from the last N days of plays. Cheap query
    // (indexed on user_id, played_at) and worth doing eagerly so dependent
    // surfaces (companion mode picker, daily-mix difficulty) read fresh data.
    const since = new Date(Date.now() - HISTORY_DAYS * 86400000).toISOString();
    const { data: recent } = await supabase
      .from('minigame_results')
      .select('game, signals, played_at')
      .eq('user_id', user.id)
      .gte('played_at', since)
      .order('played_at', { ascending: false })
      .limit(60);

    const profile = aggregateProfile(recent || []);

    // Cache the profile back to learner_profiles.behavioral_observations.
    // Merge-safe: read existing JSONB, replace only the minigame_profile sub-key.
    try {
      const { data: existing } = await supabase
        .from('learner_profiles')
        .select('behavioral_observations')
        .eq('user_id', user.id)
        .maybeSingle();
      const obs = existing?.behavioral_observations || {};
      obs.minigame_profile = profile;
      await supabase.from('learner_profiles').upsert({
        user_id: user.id,
        behavioral_observations: obs,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    } catch (err) {
      // Non-fatal — the play is saved; we just couldn't cache.
      console.warn('Arena profile cache failed:', err);
    }

    // Award honesty XP for completing an Arena game (regardless of score).
    try {
      await supabase.from('honesty_xp_events').insert({
        user_id: user.id,
        event_kind: 'arena_completed',
        delta: 5,
        reference_id: inserted?.id || null,
      });
    } catch { /* honesty XP table may not exist if migration not run */ }

    return NextResponse.json({
      success: true,
      result: inserted,
      profile,
      samplesUsed: (recent || []).length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
