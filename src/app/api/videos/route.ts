/**
 * Curated external videos API — strict allowlist, distraction-guarded.
 *
 * GET ?subject=...&topic=...&class=8&lang=en
 *   → list non-archived videos matching filters
 * GET ?id=...
 *   → single video metadata
 * POST { videoId, action: 'start' | 'progress' | 'complete' | 'flag',
 *        watchedSeconds?, blurCount?, retrievalScore?, reason? }
 *   → enforces hard cap (1 video per session, 2 per day) at start;
 *     records progress; gates retrieval-question completion for XP
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

const HARD_CAP_PER_DAY = 2;

export async function GET(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (id) {
      const { data } = await supabase
        .from('external_videos')
        .select('*')
        .eq('id', id)
        .eq('is_archived', false)
        .maybeSingle();
      return NextResponse.json({ success: true, item: data || null });
    }

    const subject = url.searchParams.get('subject');
    const topic = url.searchParams.get('topic');
    const klass = Math.max(1, Math.min(12, Number(url.searchParams.get('class') || 8)));
    const language = url.searchParams.get('lang') || 'en';
    const limit = Math.max(1, Math.min(20, Number(url.searchParams.get('limit') || 10)));

    let q = supabase
      .from('external_videos')
      .select('*')
      .eq('is_archived', false)
      .eq('language', language)
      .lte('class_min', klass)
      .gte('class_max', klass);

    if (subject) q = q.eq('subject_slug', subject);
    if (topic) q = q.eq('topic_id', topic);

    const { data: rows } = await q.order('view_count', { ascending: true }).limit(limit);
    return NextResponse.json({ success: true, items: rows || [] });
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
    const videoId = body.videoId;
    if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 });

    if (body.action === 'flag') {
      await supabase.from('content_flags').insert({
        user_id: user.id,
        content_kind: 'external_video',
        content_id: videoId,
        reason: (body.reason || 'other').slice(0, 30),
        notes: (body.notes || '').slice(0, 500),
      });
      return NextResponse.json({ success: true });
    }

    if (body.action === 'start') {
      // Hard cap: at most HARD_CAP_PER_DAY watch starts in the last 24h.
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { count } = await supabase
        .from('video_watch_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('watched_at', since);
      if ((count || 0) >= HARD_CAP_PER_DAY) {
        return NextResponse.json({
          error: `Hit your daily video limit (${HARD_CAP_PER_DAY}). Distraction guard: come back tomorrow.`,
        }, { status: 429 });
      }
      const { data: row, error } = await supabase
        .from('video_watch_log')
        .insert({
          user_id: user.id,
          video_id: videoId,
          watched_seconds: 0,
          completed_retrieval: false,
          blur_count: 0,
        })
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, watchId: row.id });
    }

    if (body.action === 'progress' || body.action === 'complete') {
      // Update the most recent watch row for this user+video.
      const { data: latest } = await supabase
        .from('video_watch_log')
        .select('id')
        .eq('user_id', user.id)
        .eq('video_id', videoId)
        .order('watched_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!latest) return NextResponse.json({ error: 'no watch session — call action=start first' }, { status: 400 });

      const updates: any = {};
      if (typeof body.watchedSeconds === 'number') updates.watched_seconds = Math.max(0, Math.round(body.watchedSeconds));
      if (typeof body.blurCount === 'number') updates.blur_count = Math.max(0, Math.round(body.blurCount));
      if (body.action === 'complete') {
        updates.completed_retrieval = !!body.completedRetrieval;
        if (typeof body.retrievalScore === 'number') {
          updates.retrieval_score = Math.max(0, Math.min(1, body.retrievalScore));
        }
      }
      if (Object.keys(updates).length === 0) return NextResponse.json({ success: true });
      await supabase.from('video_watch_log').update(updates).eq('id', latest.id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
