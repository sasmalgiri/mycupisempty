/**
 * SmartScore API.
 *
 * GET ?subject=...                 → list mastery_scores rows for the user
 * POST { skillId, correct, difficulty?, subject? } → apply one attempt
 * GET /needs-prereq?topicId=...    → returns the lowest-scored prerequisite
 *                                    skill so the UI can surface "let's
 *                                    review X first" flow
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { applyAttempt } from '@/lib/smartscore';

export async function GET(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const mode = url.searchParams.get('mode');
    if (mode === 'needs_prereq') {
      const topicId = url.searchParams.get('topicId');
      if (!topicId) return NextResponse.json({ error: 'topicId required' }, { status: 400 });

      // Look up prerequisites of this topic; return the weakest mastery score.
      // The schema for prereqs varies — try a simple topic_prerequisites table first.
      let prereqIds: string[] = [];
      try {
        const { data: prereqs } = await supabase
          .from('topic_prerequisites')
          .select('prerequisite_topic_id')
          .eq('topic_id', topicId);
        prereqIds = (prereqs || []).map((r: any) => r.prerequisite_topic_id).filter(Boolean);
      } catch { /* table may not exist — falls through */ }

      if (prereqIds.length === 0) return NextResponse.json({ success: true, prereq: null });

      const { data: scores } = await supabase
        .from('mastery_scores')
        .select('*, topics:skill_id(title)')
        .eq('user_id', user.id)
        .in('skill_id', prereqIds);
      const list = (scores || []) as any[];
      // Prereq topics with no record yet: assume score 0 — they need it most.
      const missing = prereqIds.filter((id) => !list.find((r) => r.skill_id === id));
      let weakest: any = null;
      if (missing.length > 0) {
        const { data: topic } = await supabase.from('topics').select('id, title').eq('id', missing[0]).maybeSingle();
        weakest = { skill_id: missing[0], score: 0, band: 'practicing', topics: topic };
      } else {
        weakest = list.reduce<any | null>((acc, r) => (!acc || r.score < acc.score ? r : acc), null);
      }

      // Only surface as "needs prereq" if the score is below 71 (mid).
      if (weakest && weakest.score < 71) {
        return NextResponse.json({ success: true, prereq: weakest });
      }
      return NextResponse.json({ success: true, prereq: null });
    }

    const subject = url.searchParams.get('subject');
    let q = supabase
      .from('mastery_scores')
      .select('*')
      .eq('user_id', user.id);
    if (subject) q = q.eq('subject_slug', subject);
    const { data: rows } = await q.order('score', { ascending: false }).limit(200);
    return NextResponse.json({ success: true, scores: rows || [] });
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
    const skillId = body.skillId;
    if (!skillId) return NextResponse.json({ error: 'skillId required' }, { status: 400 });
    const correct = !!body.correct;
    const difficulty = (['easy', 'medium', 'hard'] as const).includes(body.difficulty) ? body.difficulty : 'medium';
    const subjectSlug = body.subject || null;

    const { data: existing } = await supabase
      .from('mastery_scores')
      .select('*')
      .eq('user_id', user.id)
      .eq('skill_id', skillId)
      .maybeSingle();

    const result = applyAttempt({
      currentScore: existing?.score || 0,
      consecutiveCorrect: existing?.consecutive_correct || 0,
      correct,
      difficulty,
    });

    await supabase.from('mastery_scores').upsert({
      user_id: user.id,
      skill_id: skillId,
      subject_slug: subjectSlug || existing?.subject_slug || null,
      score: result.newScore,
      band: result.newBand,
      consecutive_correct: result.newConsecutiveCorrect,
      last_attempted_at: new Date().toISOString(),
      mastered_at: result.unlockedMastery ? new Date().toISOString() : existing?.mastered_at || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,skill_id' });

    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
