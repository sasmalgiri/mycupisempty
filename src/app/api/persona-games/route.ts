/**
 * Persona-game API. Persists each play and recomputes the consolidated
 * persona_profiles row by merging Arena minigame_profile + persona-game
 * axes + onboarding/companion-fact signals.
 *
 * GET ?last=10           → recent plays
 * POST { game, signals, durationSeconds } → save play, return updated persona
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { aggregatePersonaAxes, PERSONA_GAMES, type PersonaGameId } from '@/lib/persona-games';
import { aggregateProfile as aggregateArena } from '@/lib/arena-signals';

const PERSONA_HISTORY_DAYS = 180;

export async function GET(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const url = new URL(req.url);
    const last = Math.max(1, Math.min(60, Number(url.searchParams.get('last') || 20)));
    const { data } = await supabase
      .from('persona_game_results')
      .select('id, game, signals, duration_seconds, played_at')
      .eq('user_id', user.id)
      .order('played_at', { ascending: false })
      .limit(last);
    return NextResponse.json({ success: true, results: data || [] });
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
    const game = body.game as PersonaGameId;
    if (!PERSONA_GAMES.includes(game)) {
      return NextResponse.json({ error: 'Invalid game' }, { status: 400 });
    }
    if (!body.signals || typeof body.signals !== 'object') {
      return NextResponse.json({ error: 'signals required' }, { status: 400 });
    }
    const payloadStr = JSON.stringify(body.signals);
    if (payloadStr.length > 6000) {
      return NextResponse.json({ error: 'signals too large' }, { status: 413 });
    }

    const { data: inserted, error } = await supabase
      .from('persona_game_results')
      .insert({
        user_id: user.id,
        game,
        signals: body.signals,
        duration_seconds: typeof body.durationSeconds === 'number' ? Math.round(body.durationSeconds) : null,
      })
      .select()
      .single();
    if (error) {
      console.error('persona_game_results insert failed:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Recompute persona — merge Arena axes + persona-game axes + interests
    // + companion facts + (later) onboarding-form constraints.
    const since = new Date(Date.now() - PERSONA_HISTORY_DAYS * 86400000).toISOString();
    const [pgRes, arenaRes] = await Promise.all([
      supabase
        .from('persona_game_results')
        .select('game, signals, played_at')
        .eq('user_id', user.id)
        .gte('played_at', since)
        .order('played_at', { ascending: false })
        .limit(60),
      supabase
        .from('minigame_results')
        .select('game, signals, played_at')
        .eq('user_id', user.id)
        .gte('played_at', since)
        .order('played_at', { ascending: false })
        .limit(60),
    ]);

    const personaAxes = aggregatePersonaAxes(pgRes.data || []);
    const arenaProfile = aggregateArena(arenaRes.data || []);

    // Composite confidence: more samples = more confident, capped at 0.85.
    const sampleCount = (pgRes.data?.length || 0) + (arenaRes.data?.length || 0);
    const confidence = Math.min(0.85, 0.2 + sampleCount * 0.04);
    const sources: string[] = [];
    if (pgRes.data?.length) sources.push('persona_games');
    if (arenaRes.data?.length) sources.push('arena');

    const personaRow: Record<string, any> = {
      user_id: user.id,
      // Arena (capacity)
      visual_processing_speed: arenaProfile.visualProcessingSpeed,
      reading_fluency: arenaProfile.readingFluency,
      numerical_fluency: arenaProfile.numericalFluency,
      working_memory_capacity: arenaProfile.workingMemoryCapacity,
      inference_strength: arenaProfile.inferenceStrength,
      decision_tempo: arenaProfile.decisionTempo,
      risk_tolerance: arenaProfile.riskTolerance,
      empathy_leaning: arenaProfile.empathyLeaning,
      // Persona games (disposition)
      perfectionism: personaAxes.perfectionism ?? null,
      effort_tolerance: personaAxes.effort_tolerance ?? null,
      curiosity_breadth: personaAxes.curiosity_breadth ?? null,
      social_orientation: personaAxes.social_orientation ?? null,
      // Constraints from study_time_quest
      best_study_time: personaAxes.best_study_time ?? null,
      daily_study_minutes_available: personaAxes.daily_study_minutes_available ?? null,
      energy_after_school: personaAxes.energy_after_school ?? null,
      composite_confidence: confidence,
      built_from_sources: sources,
      updated_at: new Date().toISOString(),
    };

    // Persona-game axes can override capacity ones where they overlap
    // (decision_tempo, risk_tolerance) — the persona games target disposition
    // more directly than Arena, so we prefer their reading.
    if (personaAxes.risk_tolerance != null) personaRow.risk_tolerance = personaAxes.risk_tolerance;
    if (personaAxes.decision_tempo != null) personaRow.decision_tempo = personaAxes.decision_tempo;

    await supabase.from('persona_profiles').upsert(personaRow, { onConflict: 'user_id' });

    return NextResponse.json({ success: true, result: inserted, persona: personaRow });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
