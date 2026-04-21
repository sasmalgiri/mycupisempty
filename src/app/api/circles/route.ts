/**
 * Study Circles — create / list / join circles via invite code.
 *
 * GET  → list my circles (with member counts and today's shared challenge)
 * POST { action: 'create', name }                 → new circle + invite code
 * POST { action: 'join',   code: 'ABC123' }       → join circle by code
 * POST { action: 'leave',  circleId }             → leave
 * POST { action: 'complete_challenge', challengeId, response? } → mark done
 *
 * First pass at peer learning. Deliberately no chat, no feed — just visibility
 * ("Priya and Amit already did today's shared question") to make the other
 * students in the student's life feel present without opening a moderation
 * problem for a K-12 product.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { checkPeerPrompt, findTemplate } from '@/lib/content-safety';

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  // no O/0/1/I

function generateInviteCode(): string {
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)];
  }
  return out;
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export async function GET() {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: memberships } = await supabase
      .from('circle_members')
      .select('circle_id, role, joined_at, study_circles(id, name, invite_code, created_by, max_members)')
      .eq('user_id', user.id);

    const circles = await Promise.all(
      (memberships || []).map(async (m: any) => {
        const c = m.study_circles;
        if (!c) return null;
        const [countRes, { data: challenge }] = await Promise.all([
          supabase.rpc('get_circle_member_count', { p_circle_id: c.id }),
          supabase
            .from('circle_shared_challenges')
            .select('id, prompt, subject_hint, created_at')
            .eq('circle_id', c.id)
            .eq('challenge_date', todayISO())
            .maybeSingle(),
        ]);
        const memberCount = typeof countRes?.data === 'number' ? countRes.data : 0;

        let completionCount = 0;
        let completedByMe = false;
        if (challenge?.id) {
          const { data: comps } = await supabase
            .from('circle_challenge_completions')
            .select('user_id')
            .eq('challenge_id', challenge.id);
          completionCount = comps?.length || 0;
          completedByMe = !!comps?.some((r: any) => r.user_id === user.id);
        }

        return {
          id: c.id,
          name: c.name,
          inviteCode: c.invite_code,
          role: m.role,
          isFounder: c.created_by === user.id,
          memberCount,
          maxMembers: c.max_members,
          todayChallenge: challenge
            ? {
                id: challenge.id,
                prompt: challenge.prompt,
                subjectHint: challenge.subject_hint,
                completionCount,
                completedByMe,
              }
            : null,
        };
      })
    );

    return NextResponse.json({ success: true, circles: circles.filter(Boolean) });
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

    if (action === 'create') {
      const name = String(body.name || '').trim().slice(0, 60);
      if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

      // Retry a few times if we hit a rare code collision
      let circle: any = null;
      let err: any = null;
      for (let i = 0; i < 5; i++) {
        const code = generateInviteCode();
        const res = await supabase
          .from('study_circles')
          .insert({ name, invite_code: code, created_by: user.id })
          .select()
          .single();
        if (!res.error) { circle = res.data; break; }
        err = res.error;
      }
      if (!circle) return NextResponse.json({ error: err?.message || 'Could not create circle' }, { status: 500 });

      await supabase.from('circle_members').insert({
        circle_id: circle.id,
        user_id: user.id,
        role: 'founder',
      });

      return NextResponse.json({ success: true, circle: { id: circle.id, name: circle.name, inviteCode: circle.invite_code } });
    }

    if (action === 'join') {
      const code = String(body.code || '').trim().toUpperCase();
      if (!code || code.length !== 6) return NextResponse.json({ error: 'Invalid code' }, { status: 400 });

      const { data: circle } = await supabase
        .from('study_circles')
        .select('id, name, max_members, is_active')
        .eq('invite_code', code)
        .maybeSingle();

      if (!circle || !circle.is_active) return NextResponse.json({ error: 'Code not found' }, { status: 404 });

      // SECURITY DEFINER count — RLS would hide rows from a non-member, so a
      // direct count() returns 0 and the size check would be bypassed.
      const { data: countData } = await supabase
        .rpc('get_circle_member_count', { p_circle_id: circle.id });
      const memberCount = typeof countData === 'number' ? countData : 0;

      if (memberCount >= circle.max_members) {
        return NextResponse.json({ error: 'Circle is full' }, { status: 409 });
      }

      const { error } = await supabase.from('circle_members').insert({
        circle_id: circle.id,
        user_id: user.id,
        role: 'member',
      });

      if (error && !error.message?.includes('duplicate')) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, circle: { id: circle.id, name: circle.name } });
    }

    if (action === 'leave') {
      const circleId = body.circleId;
      if (!circleId) return NextResponse.json({ error: 'circleId required' }, { status: 400 });
      await supabase
        .from('circle_members')
        .delete()
        .eq('circle_id', circleId)
        .eq('user_id', user.id);
      return NextResponse.json({ success: true });
    }

    if (action === 'complete_challenge') {
      const challengeId = body.challengeId;
      const response = body.response ? String(body.response).slice(0, 500) : null;
      if (!challengeId) return NextResponse.json({ error: 'challengeId required' }, { status: 400 });
      const { error } = await supabase.from('circle_challenge_completions').insert({
        challenge_id: challengeId,
        user_id: user.id,
        response,
      });
      if (error && !error.message?.includes('duplicate')) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'seed_today_challenge') {
      const circleId = body.circleId;
      if (!circleId) return NextResponse.json({ error: 'circleId required' }, { status: 400 });

      // Two paths: curated template (any member) or free-form text (founder only
      // + block-list filter). This stops a random member from posting abusive
      // prompts to the whole circle.
      let prompt = '';
      let subjectHint: string | null = null;

      if (body.templateId) {
        const tpl = findTemplate(String(body.templateId));
        if (!tpl) return NextResponse.json({ error: 'Unknown template' }, { status: 400 });
        prompt = tpl.prompt;
        subjectHint = tpl.subjectHint || null;
      } else {
        // Free-form requires founder role
        const { data: circle } = await supabase
          .from('study_circles')
          .select('created_by')
          .eq('id', circleId)
          .maybeSingle();
        if (!circle) return NextResponse.json({ error: 'Circle not found' }, { status: 404 });
        if (circle.created_by !== user.id) {
          return NextResponse.json({
            error: 'Only the circle founder can write custom prompts. Pick a template, or ask the founder.',
          }, { status: 403 });
        }

        const raw = String(body.prompt || '').trim();
        const verdict = checkPeerPrompt(raw, { minLen: 5, maxLen: 300 });
        if (!verdict.ok) {
          return NextResponse.json({ error: verdict.hint || 'That prompt is not allowed.' }, { status: 400 });
        }
        prompt = raw.slice(0, 300);
        subjectHint = body.subjectHint ? String(body.subjectHint).slice(0, 40) : null;
      }

      const { data, error } = await supabase
        .from('circle_shared_challenges')
        .upsert({
          circle_id: circleId,
          challenge_date: todayISO(),
          prompt,
          subject_hint: subjectHint,
        }, { onConflict: 'circle_id,challenge_date' })
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, challenge: data });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
