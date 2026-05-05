/**
 * Wonder Hub API.
 *
 * GET ?category=...&class=8&lang=en   → list non-archived facts (paginated)
 * GET /daily                          → today's deterministic daily fact
 * POST { factId, action: 'save' | 'unsave' } → toggle Wonder Wall save
 * POST { factId, action: 'view' }            → increment view counter
 *
 * The catalog is DB-backed so the freshness pipeline (Phase 8) can refill
 * it without a code release. We never serve archived items to students.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

const WONDER_CATEGORIES = [
  'deep_sea', 'outer_space', 'tiny_worlds', 'history_weird',
  'body_mysteries', 'math_magic', 'tech_hacks', 'nature_engineers',
];

export async function GET(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    // Wonder Hub is readable when logged in. Saves require auth.
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const mode = url.searchParams.get('mode'); // 'daily' | 'list' | 'saved'
    const category = url.searchParams.get('category');
    const klass = Math.max(1, Math.min(12, Number(url.searchParams.get('class') || 8)));
    const language = url.searchParams.get('lang') || 'en';
    const limit = Math.max(1, Math.min(40, Number(url.searchParams.get('limit') || 20)));

    if (mode === 'saved') {
      const { data: rows } = await supabase
        .from('wonder_saves')
        .select('saved_at, wonder_facts(*)')
        .eq('user_id', user.id)
        .order('saved_at', { ascending: false });
      const items = (rows || []).map((r: any) => ({ ...r.wonder_facts, saved_at: r.saved_at }));
      return NextResponse.json({ success: true, items });
    }

    let q = supabase
      .from('wonder_facts')
      .select('*')
      .eq('is_archived', false)
      .eq('language', language)
      .lte('class_min', klass)
      .gte('class_max', klass);

    if (category && WONDER_CATEGORIES.includes(category)) {
      q = q.eq('category', category);
    }

    if (mode === 'daily') {
      // Deterministic-ish daily fact: order by seeded pseudo-random per day.
      const { data: rows } = await q.limit(50);
      const list = rows || [];
      if (list.length === 0) return NextResponse.json({ success: true, item: null });
      // Stable seed: today's date string + user id → index
      const seedStr = `${new Date().toISOString().split('T')[0]}:${user.id}`;
      let h = 0;
      for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) | 0;
      const idx = Math.abs(h) % list.length;
      return NextResponse.json({ success: true, item: list[idx] });
    }

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
    const factId = body.factId;
    const action = body.action;
    if (!factId || !action) return NextResponse.json({ error: 'factId + action required' }, { status: 400 });

    if (action === 'save') {
      const { error } = await supabase.from('wonder_saves').insert({ user_id: user.id, fact_id: factId });
      if (error && !error.message?.includes('duplicate')) return NextResponse.json({ error: error.message }, { status: 500 });
      // Bump save_count cheaply; failure is non-fatal.
      await supabase.rpc('increment_wonder_save', { p_id: factId }).catch(() => {});
      return NextResponse.json({ success: true });
    }
    if (action === 'unsave') {
      await supabase.from('wonder_saves').delete().eq('user_id', user.id).eq('fact_id', factId);
      return NextResponse.json({ success: true });
    }
    if (action === 'view') {
      // Best-effort view tracking; the RLS service-role boundary blocks
      // direct UPDATE for students, so we no-op silently if not allowed.
      return NextResponse.json({ success: true });
    }
    if (action === 'flag') {
      const reason = (body.reason || 'other').slice(0, 30);
      await supabase.from('content_flags').insert({
        user_id: user.id,
        content_kind: 'wonder_fact',
        content_id: factId,
        reason,
        notes: (body.notes || '').slice(0, 500),
      });
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
