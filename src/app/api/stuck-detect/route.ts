/**
 * Stuck-detector — runs after every exit-eval. If the student has 3
 * consecutive exit-evals < 0.4 on the same chapter, we open a stuck_detection
 * row and offer a remediation track.
 *
 * GET                                                → list active detections
 * POST { action: 'check', chapterId, topicId? }      → run the rule, open a
 *                                                      detection if threshold
 *                                                      hit
 * POST { action: 'accept_remediation', detectionId } → mark as running
 * POST { action: 'decline', detectionId }            → respect student's choice
 * POST { action: 'resolve', detectionId }            → close it (caller fires
 *                                                      when next exit-eval
 *                                                      score >= 0.6)
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

const STUCK_THRESHOLD = 0.4;
const STUCK_WINDOW = 3;
const RESOLVE_THRESHOLD = 0.6;

export async function GET() {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data } = await supabase
      .from('stuck_detections')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['detected', 'remediation_offered', 'remediation_running'])
      .order('updated_at', { ascending: false });
    return NextResponse.json({ success: true, detections: data || [] });
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

    if (body.action === 'check') {
      // Pull last STUCK_WINDOW exit-evals on this chapter (or topic).
      let q = supabase
        .from('session_evaluations')
        .select('score, evaluated_at, topic_id, subject_id')
        .eq('user_id', user.id)
        .order('evaluated_at', { ascending: false })
        .limit(STUCK_WINDOW);
      if (body.topicId) q = q.eq('topic_id', body.topicId);
      const { data: evals } = await q;
      const scores: number[] = (evals || []).map((r: any) => Number(r.score) || 0);
      if (scores.length < STUCK_WINDOW || scores.some((s: number) => s >= STUCK_THRESHOLD)) {
        return NextResponse.json({ success: true, stuck: false });
      }
      const avg = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
      // Open or update a detection.
      const { data: existing } = await supabase
        .from('stuck_detections')
        .select('id, consecutive_low_count, status')
        .eq('user_id', user.id)
        .eq('chapter_id', body.chapterId || null)
        .in('status', ['detected', 'remediation_offered', 'remediation_running'])
        .maybeSingle();
      let row;
      if (existing) {
        const { data } = await supabase
          .from('stuck_detections')
          .update({ consecutive_low_count: STUCK_WINDOW, avg_score: avg, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select()
          .single();
        row = data;
      } else {
        const { data } = await supabase
          .from('stuck_detections')
          .insert({
            user_id: user.id,
            chapter_id: body.chapterId || null,
            topic_id: body.topicId || null,
            subject_id: body.subjectId || null,
            consecutive_low_count: STUCK_WINDOW,
            avg_score: avg,
            status: 'remediation_offered',
          })
          .select()
          .single();
        row = data;
      }
      return NextResponse.json({ success: true, stuck: true, detection: row });
    }

    if (body.action === 'accept_remediation' && body.detectionId) {
      await supabase
        .from('stuck_detections')
        .update({ status: 'remediation_running', remediation_started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', body.detectionId)
        .eq('user_id', user.id);
      return NextResponse.json({ success: true });
    }
    if (body.action === 'decline' && body.detectionId) {
      await supabase
        .from('stuck_detections')
        .update({ status: 'declined', updated_at: new Date().toISOString() })
        .eq('id', body.detectionId)
        .eq('user_id', user.id);
      return NextResponse.json({ success: true });
    }
    if (body.action === 'resolve' && body.detectionId) {
      await supabase
        .from('stuck_detections')
        .update({ status: 'resolved', resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', body.detectionId)
        .eq('user_id', user.id);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const RESOLVE_THRESHOLD_VALUE = RESOLVE_THRESHOLD;
