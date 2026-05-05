/**
 * FSRS retention dial — power-user knob.
 *
 * Anki exposes the desired retention as a tunable (default 0.9). Higher
 * values mean shorter intervals (more reviews, fewer lapses); lower values
 * mean longer intervals at the cost of more lapses. We let the student
 * pick within a sensible range so JEE/NEET serious users can tighten it
 * without us hiding the dial.
 *
 * GET → current retention setting
 * POST { retention: 0.85..0.95 }
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

const MIN_RETENTION = 0.80;
const MAX_RETENTION = 0.95;
const DEFAULT_RETENTION = 0.90;

export async function GET() {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data } = await supabase
      .from('learner_profiles')
      .select('baseline_profile')
      .eq('user_id', user.id)
      .maybeSingle();
    const retention = data?.baseline_profile?.fsrs_retention ?? DEFAULT_RETENTION;
    return NextResponse.json({
      success: true,
      retention,
      range: { min: MIN_RETENTION, max: MAX_RETENTION, default: DEFAULT_RETENTION },
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
    const r = Number(body.retention);
    if (!Number.isFinite(r) || r < MIN_RETENTION || r > MAX_RETENTION) {
      return NextResponse.json({
        error: `retention must be between ${MIN_RETENTION} and ${MAX_RETENTION}`,
      }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from('learner_profiles')
      .select('baseline_profile')
      .eq('user_id', user.id)
      .maybeSingle();
    const baseline = existing?.baseline_profile || {};
    baseline.fsrs_retention = r;
    await supabase.from('learner_profiles').upsert({
      user_id: user.id,
      baseline_profile: baseline,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    return NextResponse.json({ success: true, retention: r });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
