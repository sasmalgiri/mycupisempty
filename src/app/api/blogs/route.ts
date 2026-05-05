/**
 * Subject Blogs API.
 * GET ?subject=...&class=8&lang=en   → list non-archived blogs (newest first)
 * GET ?slug=...                       → single blog by slug
 * POST { blogId, action: 'view' | 'flag', reason? }
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');
    if (slug) {
      const { data } = await supabase
        .from('subject_blogs')
        .select('*')
        .eq('slug', slug)
        .eq('is_archived', false)
        .maybeSingle();
      return NextResponse.json({ success: true, item: data || null });
    }

    const subject = url.searchParams.get('subject');
    const klass = Math.max(1, Math.min(12, Number(url.searchParams.get('class') || 8)));
    const language = url.searchParams.get('lang') || 'en';
    const limit = Math.max(1, Math.min(40, Number(url.searchParams.get('limit') || 20)));

    let q = supabase
      .from('subject_blogs')
      .select('id, subject_slug, title, slug, body_md, reading_minutes, language, class_min, class_max, related_topic_id, last_verified_at, is_evergreen, published_at, source_url')
      .eq('is_archived', false)
      .eq('language', language)
      .lte('class_min', klass)
      .gte('class_max', klass);

    if (subject) q = q.eq('subject_slug', subject);

    const { data: rows } = await q.order('published_at', { ascending: false }).limit(limit);
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
    if (body.action === 'flag') {
      await supabase.from('content_flags').insert({
        user_id: user.id,
        content_kind: 'subject_blog',
        content_id: body.blogId,
        reason: (body.reason || 'other').slice(0, 30),
        notes: (body.notes || '').slice(0, 500),
      });
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
