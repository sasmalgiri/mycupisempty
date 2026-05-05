/**
 * Enrollment-level settings: per-subject pace multipliers + career path
 * (career sits on persona but a single endpoint is convenient).
 *
 * GET ?enrollmentId=...        → { pace_multipliers, career_path }
 * POST { enrollmentId, action: 'set_pace', subjectSlug, multiplier }
 * POST { enrollmentId, action: 'set_career', careerPath }
 *
 * Both actions trigger a fire-and-forget plan replan so the change takes
 * effect on the next /todays-plan read.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

const VALID_CAREERS = ['doctor', 'engineer', 'civil_services', 'arts_humanities', 'commerce', 'sports', 'creative', 'unsure'];

export async function GET(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const url = new URL(req.url);
    const enrollmentId = url.searchParams.get('enrollmentId');
    if (!enrollmentId) return NextResponse.json({ error: 'enrollmentId required' }, { status: 400 });

    const [{ data: enrollment }, { data: persona }] = await Promise.all([
      supabase.from('course_enrollments').select('pace_multipliers').eq('id', enrollmentId).eq('user_id', user.id).maybeSingle(),
      supabase.from('persona_profiles').select('career_path').eq('user_id', user.id).maybeSingle(),
    ]);
    return NextResponse.json({
      success: true,
      pace_multipliers: enrollment?.pace_multipliers || {},
      career_path: persona?.career_path || null,
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
    const enrollmentId = body.enrollmentId;
    if (!enrollmentId) return NextResponse.json({ error: 'enrollmentId required' }, { status: 400 });

    if (body.action === 'set_pace') {
      const subjectSlug = String(body.subjectSlug || '').trim();
      const multiplier = Math.max(0.3, Math.min(2.0, Number(body.multiplier) || 1.0));
      if (!subjectSlug) return NextResponse.json({ error: 'subjectSlug required' }, { status: 400 });

      const { data: existing } = await supabase
        .from('course_enrollments')
        .select('pace_multipliers')
        .eq('id', enrollmentId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!existing) return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
      const map = existing.pace_multipliers || {};
      map[subjectSlug] = multiplier;
      await supabase.from('course_enrollments').update({ pace_multipliers: map }).eq('id', enrollmentId).eq('user_id', user.id);
    } else if (body.action === 'set_career') {
      const careerPath = body.careerPath && VALID_CAREERS.includes(body.careerPath) ? body.careerPath : null;
      const { data: existing } = await supabase.from('persona_profiles').select('user_id').eq('user_id', user.id).maybeSingle();
      if (existing) {
        await supabase.from('persona_profiles').update({ career_path: careerPath, updated_at: new Date().toISOString() }).eq('user_id', user.id);
      } else {
        await supabase.from('persona_profiles').insert({ user_id: user.id, career_path: careerPath });
      }
    } else {
      return NextResponse.json({ error: 'unknown action' }, { status: 400 });
    }

    // Fire-and-forget replan
    try {
      const baseUrl = new URL(req.url).origin;
      fetch(`${baseUrl}/api/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: req.headers.get('cookie') || '' },
        body: JSON.stringify({ enrollmentId, action: 'replan', reason: `${body.action} change` }),
      }).catch(() => {});
    } catch { /* non-blocking */ }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
