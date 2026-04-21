/**
 * Learning Mode preference — bridges the 5-layer learner engine to UI controls.
 *
 * The engine observes student behavior invisibly (preferred_explanation,
 * preferred_pace, etc.). This endpoint exposes the current inferred mode
 * so the UI can show a chip, and lets the student override it.
 *
 * GET  ?subjectId=...   → { mode, pace, source: 'observed' | 'manual' | 'default' }
 * POST { subjectId?, mode, pace? }   → persists manual override in learner_profiles
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export type ExplanationMode =
  | 'visual' | 'story' | 'step_by_step' | 'example_first' | 'socratic' | 'drill' | 'hands_on';

export type PaceMode = 'fast' | 'moderate' | 'slow' | 'self_paced';

const VALID_MODES: ExplanationMode[] = [
  'visual', 'story', 'step_by_step', 'example_first', 'socratic', 'drill', 'hands_on',
];

const VALID_PACES: PaceMode[] = ['fast', 'moderate', 'slow', 'self_paced'];

interface ModeRow {
  mode: ExplanationMode;
  pace: PaceMode;
  source: 'observed' | 'manual' | 'default';
}

function defaultMode(): ModeRow {
  return { mode: 'step_by_step', pace: 'moderate', source: 'default' };
}

export async function GET(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const subjectId = url.searchParams.get('subjectId') || '_global';

    const { data } = await supabase
      .from('learner_profiles')
      .select('baseline_profile, behavioral_observations')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!data) return NextResponse.json({ success: true, ...defaultMode() });

    // Manual overrides live under baseline_profile.learning_modes[subjectId]
    const modes = data.baseline_profile?.learning_modes || {};
    const manual = modes[subjectId] || modes._global;
    if (manual?.mode && VALID_MODES.includes(manual.mode)) {
      return NextResponse.json({
        success: true,
        mode: manual.mode,
        pace: manual.pace || 'moderate',
        source: 'manual',
      });
    }

    // Observed from engine: behavioral_observations.subjects[id].preferred_explanation
    const observed = data.behavioral_observations?.subjects?.[subjectId];
    if (observed?.preferred_explanation && VALID_MODES.includes(observed.preferred_explanation)) {
      return NextResponse.json({
        success: true,
        mode: observed.preferred_explanation,
        pace: observed.preferred_pace || 'moderate',
        source: 'observed',
      });
    }

    return NextResponse.json({ success: true, ...defaultMode() });
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
    const subjectId = body.subjectId || '_global';
    const mode = body.mode as ExplanationMode;
    const pace = body.pace as PaceMode | undefined;

    if (!VALID_MODES.includes(mode)) {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    }
    if (pace && !VALID_PACES.includes(pace)) {
      return NextResponse.json({ error: 'Invalid pace' }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from('learner_profiles')
      .select('baseline_profile')
      .eq('user_id', user.id)
      .maybeSingle();

    const baseline = existing?.baseline_profile || {};
    baseline.learning_modes = baseline.learning_modes || {};
    baseline.learning_modes[subjectId] = { mode, pace: pace || 'moderate', set_at: new Date().toISOString() };

    await supabase.from('learner_profiles').upsert({
      user_id: user.id,
      baseline_profile: baseline,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    // Log as signal so the engine can learn the student's self-awareness too
    await supabase.from('learner_signals').insert({
      user_id: user.id,
      signal_type: 'learning_mode_set',
      category: 'preference',
      source: 'ai_guru',
      subject_id: subjectId === '_global' ? null : subjectId,
      value: 1,
      metadata: { mode, pace: pace || 'moderate' },
    }).then(() => {}, () => {});

    return NextResponse.json({ success: true, mode, pace: pace || 'moderate', source: 'manual' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
