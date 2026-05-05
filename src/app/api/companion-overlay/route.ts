/**
 * Companion overlay lookup. Picks the most-specific overlay for a
 * (board, companion, class, method, chapter) tuple.
 *
 * Specificity rank:
 *   1. exact (chapter + method)
 *   2. chapter only (method NULL)
 *   3. method only (chapter NULL)
 *   4. class default (both NULL)
 *
 * Used by the companion chat scaffolding so Aryabhata-class-3-visual ≠
 * Aryabhata-class-9-Socratic ≠ Aryabhata-class-10-default.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const board = url.searchParams.get('board') || 'wbbse';
    const companionId = url.searchParams.get('companionId');
    const classLevel = Number(url.searchParams.get('class') || 8);
    const method = url.searchParams.get('method');
    const chapterId = url.searchParams.get('chapterId');
    const language = url.searchParams.get('lang') || 'bn';
    if (!companionId) return NextResponse.json({ error: 'companionId required' }, { status: 400 });

    // Pull all candidate overlays for this companion+class then rank in JS —
    // simpler than a 4-stage SQL CASE.
    const { data: rows } = await supabase
      .from('companion_class_overlays')
      .select('*')
      .eq('board_code', board)
      .eq('companion_id', companionId)
      .eq('class_level', classLevel)
      .eq('language', language)
      .eq('is_active', true);

    const candidates = rows || [];

    function specificity(r: any): number {
      let s = 0;
      if (r.chapter_id === chapterId && chapterId) s += 4;
      if (r.method === method && method) s += 2;
      if (r.chapter_id == null) s += 0; else if (r.chapter_id !== chapterId) return -1;
      if (r.method == null) s += 0; else if (r.method !== method) return -1;
      return s;
    }

    const ranked = candidates
      .map((r: any) => ({ row: r, score: specificity(r) }))
      .filter((x: any) => x.score >= 0)
      .sort((a: any, b: any) => b.score - a.score);

    const winner = ranked[0]?.row || null;
    return NextResponse.json({ success: true, overlay: winner, ranked: ranked.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
