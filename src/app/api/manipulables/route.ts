/**
 * Manipulables registry API.
 *
 * GET ?topicId=...   → list interactives for a topic (graph_plotter,
 *                      physics_sim, molecule_viewer, slider, ...)
 * GET ?subject=...   → subject-level defaults (apply when topic has none)
 *
 * Concept cards (Phase 14) read this to render an interactive by default
 * rather than a static image. Brilliant-style "manipulables-first".
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const url = new URL(req.url);
    const topicId = url.searchParams.get('topicId');
    const subject = url.searchParams.get('subject');

    let q = supabase.from('manipulables_registry').select('*').eq('is_default', true);
    if (topicId) q = q.eq('topic_id', topicId);
    else if (subject) q = q.eq('subject_slug', subject);
    const { data: rows } = await q.limit(20);
    return NextResponse.json({ success: true, items: rows || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
