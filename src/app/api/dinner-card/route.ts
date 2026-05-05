/**
 * Primary Dinner Card — single-screen weekly digest for primary-class parents.
 * Three things: what got right, what got wrong, one thing to ask at dinner.
 *
 * GET → { card: { date_range, right_count, wrong_count, top_strength,
 *                 weakest_chapter, dinner_question, character_note } }
 *
 * Pulls from session_evaluations + xp_events + character signals over the
 * last 7 days. No AI call — fully deterministic so it's reliable for parents.
 *
 * Storing it as a parent_artifacts row (kind='primary_dinner_card') gives us a
 * forwardable WhatsApp link for free.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    const [profileRes, evalsRes, xpRes, chaptersRes] = await Promise.all([
      supabase.from('profiles').select('full_name, current_class, language').eq('id', user.id).maybeSingle(),
      supabase.from('session_evaluations').select('chapter_id, score, evaluated_at').eq('user_id', user.id).gte('evaluated_at', sevenDaysAgo),
      supabase.from('xp_events').select('xp_amount, source_pillar, created_at').eq('user_id', user.id).gte('created_at', sevenDaysAgo),
      supabase.from('curriculum_chapters').select('id, title_en, title_native'),
    ]);

    const evals = (evalsRes.data || []) as any[];
    const xpRows = (xpRes.data || []) as any[];
    const chapters = (chaptersRes.data || []) as any[];
    const chapterTitle = new Map<string, string>();
    for (const c of chapters) chapterTitle.set(c.id, (c.title_native || c.title_en || 'a chapter'));

    const right = evals.filter((e) => e.score >= 0.7).length;
    const wrong = evals.filter((e) => e.score < 0.5).length;

    // Strongest + weakest chapter (avg score across the week)
    const byChapter: Record<string, { sum: number; n: number }> = {};
    for (const e of evals) {
      if (!e.chapter_id) continue;
      const r = byChapter[e.chapter_id] || { sum: 0, n: 0 };
      r.sum += Number(e.score) || 0;
      r.n += 1;
      byChapter[e.chapter_id] = r;
    }
    let bestId: string | null = null, bestAvg = -1;
    let worstId: string | null = null, worstAvg = 2;
    for (const [cid, r] of Object.entries(byChapter)) {
      const avg = r.sum / r.n;
      if (r.n >= 2 && avg > bestAvg)  { bestAvg = avg; bestId = cid; }
      if (r.n >= 2 && avg < worstAvg) { worstAvg = avg; worstId = cid; }
    }

    const characterXp = xpRows.filter((r) => r.source_pillar === 'character').reduce((s, r) => s + (r.xp_amount || 0), 0);

    // Build the dinner question — picks from a small persona-neutral list
    // weighted by what happened this week. No AI dependency on purpose.
    const childName = profileRes.data?.full_name?.split(' ')[0] || 'her';
    let dinner_question = `Ask ${childName}: "Which one thing made you proud this week?"`;
    if (worstId && worstAvg < 0.5) {
      dinner_question = `Ask ${childName}: "Tell me about ${chapterTitle.get(worstId)} — what is still confusing?"`;
    } else if (right > 5 && wrong === 0) {
      dinner_question = `Tell ${childName}: "I noticed you got ${right} answers right this week — share one that surprised you."`;
    } else if (characterXp > 50) {
      dinner_question = `Ask ${childName}: "What did you do this week that made you feel like a kind person?"`;
    }

    const card = {
      generated_at: new Date().toISOString(),
      child_first_name: childName,
      class_level: profileRes.data?.current_class || null,
      week_window: { from: sevenDaysAgo.split('T')[0], to: new Date().toISOString().split('T')[0] },
      right_count: right,
      wrong_count: wrong,
      top_strength: bestId ? chapterTitle.get(bestId) || null : null,
      weakest_chapter: worstId ? chapterTitle.get(worstId) || null : null,
      dinner_question,
      character_note: characterXp > 0 ? `+${characterXp} character XP earned this week.` : null,
    };

    return NextResponse.json({ success: true, card });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
