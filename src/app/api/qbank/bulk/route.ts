/**
 * Bulk qbank generator — admin-only.
 *
 * POST { board?, classLevel?, subjectSlug?, limit? }
 *   Iterates all chapters matching the filters that don't yet meet target
 *   coverage, calls /api/qbank/generate per chapter (synchronously, sequential
 *   so we don't blow Gemini quota in parallel). Stops at `limit` chapters per
 *   call so a 30-second Vercel function doesn't time out.
 *
 * Returns per-chapter summary.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { totalForClass } from '@/lib/qbank-coverage';

async function isAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  return data?.role === 'admin' || data?.role === 'teacher';
}

export async function POST(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await isAdmin(supabase, user.id))) {
      return NextResponse.json({ error: 'Admin / teacher role required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const board = body.board || null;
    const classLevel = body.classLevel ? Number(body.classLevel) : null;
    const subjectSlug = body.subjectSlug || null;
    const limit = Math.max(1, Math.min(20, Number(body.limit) || 6));

    // Find chapters under target coverage from the view.
    let q = supabase
      .from('v_qbank_coverage')
      .select('chapter_id, chapter_title, subject_slug, class_level, board_code, total_questions, language');
    if (board) q = q.eq('board_code', board);
    if (classLevel) q = q.eq('class_level', classLevel);
    if (subjectSlug) q = q.eq('subject_slug', subjectSlug);
    const { data: rows } = await q;

    const candidates = (rows || [])
      .filter((r: any) => (r.total_questions || 0) < totalForClass(r.class_level))
      .sort((a: any, b: any) => (a.total_questions || 0) - (b.total_questions || 0))
      .slice(0, limit);

    const results: Array<{ chapter_id: string; chapter_title: string; generated: number; totalNow: number; ok: boolean; error?: string }> = [];
    const baseUrl = new URL(req.url).origin;
    const cookies = req.headers.get('cookie') || '';

    for (const row of candidates) {
      try {
        const res = await fetch(`${baseUrl}/api/qbank/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: cookies },
          body: JSON.stringify({ chapterId: row.chapter_id }),
        });
        const json = await res.json();
        results.push({
          chapter_id: row.chapter_id,
          chapter_title: row.chapter_title,
          generated: json?.generated || 0,
          totalNow: json?.totalNow || 0,
          ok: !!json?.success,
          error: json?.error,
        });
      } catch (err: any) {
        results.push({
          chapter_id: row.chapter_id,
          chapter_title: row.chapter_title,
          generated: 0,
          totalNow: 0,
          ok: false,
          error: err?.message || String(err),
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      remaining: Math.max(0, (rows || []).filter((r: any) => (r.total_questions || 0) < totalForClass(r.class_level)).length - results.length),
      results,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
