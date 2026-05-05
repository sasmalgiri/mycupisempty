/**
 * Tricks library API.
 *
 * GET ?category=...&subject=...&topic=...&class=8&lang=en
 *   → list non-archived tricks matching filters
 * GET ?topicId=...&offer=1
 *   → recommend ONE trick relevant to the given topic — used by the
 *     companion when a student fails an exit-eval question
 * POST { trickId, action: 'helpful' | 'flag', reason? }
 *   → bump helpful_count / file a flag
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

const CATEGORIES = [
  'mnemonic', 'memory_palace', 'math_trick', 'english_grammar',
  'physics_shortcut', 'bio_mnemonic', 'exam_strategy', 'study_hack',
];

export async function GET(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const offer = url.searchParams.get('offer') === '1';
    const topicId = url.searchParams.get('topicId');
    const chapterId = url.searchParams.get('chapterId');
    const subject = url.searchParams.get('subject');
    const category = url.searchParams.get('category');
    const klass = Math.max(1, Math.min(12, Number(url.searchParams.get('class') || 8)));
    const language = url.searchParams.get('lang') || 'en';
    const limit = Math.max(1, Math.min(40, Number(url.searchParams.get('limit') || 20)));

    if (offer && topicId) {
      // Recommend one trick that names this topic in related_topic_ids;
      // fall back to subject-level tricks if topic-level has none.
      const { data: scoped } = await supabase
        .from('tricks')
        .select('*')
        .eq('is_archived', false)
        .eq('language', language)
        .lte('class_min', klass)
        .gte('class_max', klass)
        .contains('related_topic_ids', [topicId])
        .limit(5);
      const list = (scoped || []) as any[];
      let pick = list.length > 0 ? list[Math.floor(Math.random() * list.length)] : null;
      if (!pick && subject) {
        const { data: subjScoped } = await supabase
          .from('tricks')
          .select('*')
          .eq('is_archived', false)
          .eq('language', language)
          .eq('subject_slug', subject)
          .lte('class_min', klass)
          .gte('class_max', klass)
          .limit(5);
        const subjList = (subjScoped || []) as any[];
        pick = subjList.length > 0 ? subjList[Math.floor(Math.random() * subjList.length)] : null;
      }
      return NextResponse.json({ success: true, trick: pick });
    }

    let q = supabase
      .from('tricks')
      .select('*')
      .eq('is_archived', false)
      .eq('language', language)
      .lte('class_min', klass)
      .gte('class_max', klass);

    if (category && CATEGORIES.includes(category)) q = q.eq('category', category);
    if (subject) q = q.eq('subject_slug', subject);
    // Chapter linkage — tricks.related_topic_ids stores ids that may be either
    // topic ids or chapter ids (the column predates the topic/chapter split).
    // The v_chapter_trick_links view treats them as chapter ids; we mirror that here.
    if (chapterId) q = q.contains('related_topic_ids', [chapterId]);
    if (topicId && !chapterId) q = q.contains('related_topic_ids', [topicId]);

    const { data: rows } = await q.order('helpful_count', { ascending: false }).limit(limit);
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
    const trickId = body.trickId;
    if (!trickId) return NextResponse.json({ error: 'trickId required' }, { status: 400 });

    if (body.action === 'flag') {
      await supabase.from('content_flags').insert({
        user_id: user.id,
        content_kind: 'trick',
        content_id: trickId,
        reason: (body.reason || 'other').slice(0, 30),
        notes: (body.notes || '').slice(0, 500),
      });
      return NextResponse.json({ success: true });
    }
    if (body.action === 'helpful') {
      await supabase.rpc('increment_trick_helpful', { p_id: trickId }).catch(() => {});
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
