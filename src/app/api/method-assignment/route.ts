/**
 * Method assignment API.
 *
 * GET ?subject=...&topicId=... → most recent method for this scope
 * POST { action: 'narrow', subjectSlug, topicId?, chapterId?, subjectId? }
 *      → run the narrower, log the assignment, return the chosen method
 * POST { action: 'override', method, subjectSlug, topicId?, ... }
 *      → student manual override; logs as 'student_override' and updates
 *        learner_profiles.baseline_profile.learning_modes for stickiness
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { narrowMethod, type Method } from '@/lib/method-narrowing';

const VALID: Method[] = ['visual', 'story', 'step_by_step', 'example_first', 'socratic', 'drill', 'hands_on'];

export async function GET(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const url = new URL(req.url);
    const topicId = url.searchParams.get('topicId');
    const chapterId = url.searchParams.get('chapterId');
    const subject = url.searchParams.get('subject');

    let q = supabase
      .from('student_method_assignments')
      .select('*')
      .eq('user_id', user.id)
      .order('assigned_at', { ascending: false })
      .limit(1);
    if (topicId) q = q.eq('topic_id', topicId);
    else if (chapterId) q = q.eq('chapter_id', chapterId);
    else if (subject) q = q.eq('companion_id', subject);

    const { data } = await q.maybeSingle();
    return NextResponse.json({ success: true, assignment: data || null });
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
    const subjectSlug = String(body.subjectSlug || '').toLowerCase();
    if (!subjectSlug) return NextResponse.json({ error: 'subjectSlug required' }, { status: 400 });

    if (body.action === 'override') {
      const method = body.method as Method;
      if (!VALID.includes(method)) return NextResponse.json({ error: 'Invalid method' }, { status: 400 });

      // Persist to baseline_profile.learning_modes for stickiness across
      // sessions (read by the narrower next time).
      const { data: existing } = await supabase
        .from('learner_profiles')
        .select('baseline_profile')
        .eq('user_id', user.id)
        .maybeSingle();
      const baseline = existing?.baseline_profile || {};
      baseline.learning_modes = baseline.learning_modes || {};
      baseline.learning_modes[subjectSlug] = { mode: method, set_at: new Date().toISOString() };
      await supabase.from('learner_profiles').upsert({
        user_id: user.id,
        baseline_profile: baseline,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      // Audit row
      await supabase.from('student_method_assignments').insert({
        user_id: user.id,
        topic_id: body.topicId || null,
        chapter_id: body.chapterId || null,
        subject_id: body.subjectId || null,
        companion_id: subjectSlug,
        method,
        reason: 'student_override',
        evidence: { via: 'method-assignment-api' },
      });
      return NextResponse.json({ success: true, method, reason: 'student_override' });
    }

    if (body.action === 'narrow') {
      // Pull persona, manual override, and recent companion decision.
      const [personaRes, profileRes, companionRes] = await Promise.all([
        supabase.from('persona_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('learner_profiles').select('baseline_profile').eq('user_id', user.id).maybeSingle(),
        supabase.from('companion_mode_history')
          .select('new_mode, reason, decision, changed_at, companion_id')
          .eq('user_id', user.id)
          .in('decision', ['accepted', 'auto_applied'])
          .order('changed_at', { ascending: false })
          .limit(5),
      ]);

      const manualOverride: Method | null = profileRes.data?.baseline_profile?.learning_modes?.[subjectSlug]?.mode || null;

      // Use the most recent matching companion decision (subject match by companion_id ~= subjectSlug)
      const companionMatch = (companionRes.data || []).find((r: any) => r.companion_id === subjectSlug);
      const companionRecent = companionMatch
        ? { mode: companionMatch.new_mode as Method, reason: companionMatch.reason }
        : null;

      const persona = personaRes.data || {};
      const out = narrowMethod({
        subjectSlug,
        topicId: body.topicId,
        chapterId: body.chapterId,
        persona: {
          visual_processing_speed: persona.visual_processing_speed,
          reading_fluency: persona.reading_fluency,
          numerical_fluency: persona.numerical_fluency,
          inference_strength: persona.inference_strength,
          curiosity_breadth: persona.curiosity_breadth,
          empathy_leaning: persona.empathy_leaning,
          effort_tolerance: persona.effort_tolerance,
        },
        manualOverride,
        companionRecent,
      });

      // Audit row
      const { data: row } = await supabase.from('student_method_assignments').insert({
        user_id: user.id,
        topic_id: body.topicId || null,
        chapter_id: body.chapterId || null,
        subject_id: body.subjectId || null,
        companion_id: subjectSlug,
        method: out.method,
        reason: out.reason,
        evidence: out.evidence,
      }).select().single();

      return NextResponse.json({ success: true, ...out, assignmentId: row?.id });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
