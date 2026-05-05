/**
 * Spelling drill — one Bengali / English word a day, persona-tuned difficulty.
 *
 * GET ?lang=bn → { word: { id, word, meaning, category, example_sentence }, recentAccuracy }
 * POST { wordId, studentInput, durationSeconds }
 *   Compares case-insensitively (Bengali matras are normalised).
 *   Inserts spelling_attempts row, returns { isCorrect, correctWord }.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

function normalise(s: string): string {
  return s.normalize('NFC').trim().toLowerCase();
}

export async function GET(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const lang = url.searchParams.get('lang') || 'bn';

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_class')
      .eq('id', user.id)
      .maybeSingle();
    const klass = profile?.current_class || 5;

    // Recent accuracy adjusts difficulty.
    const { data: recent } = await supabase
      .from('spelling_attempts')
      .select('is_correct, attempted_at')
      .eq('user_id', user.id)
      .order('attempted_at', { ascending: false })
      .limit(10);
    const recentAccuracy = recent && recent.length > 0
      ? recent.filter((r: any) => r.is_correct).length / recent.length
      : 0.5;
    const targetDifficulty = recentAccuracy > 0.8 ? [3, 4, 5] : recentAccuracy > 0.5 ? [2, 3, 4] : [1, 2, 3];

    // Pick a word the student hasn't seen recently (or got wrong).
    const recentIds = (recent || []).map((r: any) => r.word_id).filter(Boolean);
    let q = supabase
      .from('spelling_drill_words')
      .select('id, word, meaning, category, difficulty, example_sentence')
      .eq('language', lang)
      .lte('class_min', klass)
      .gte('class_max', klass)
      .in('difficulty', targetDifficulty)
      .limit(50);
    const { data: pool } = await q;
    const list = (pool || []).filter((w: any) => !recentIds.includes(w.id));
    const candidates = list.length > 0 ? list : (pool || []);
    if (candidates.length === 0) return NextResponse.json({ success: true, word: null });

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    return NextResponse.json({
      success: true,
      word: pick,
      recentAccuracy,
    });
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

    const { data: word } = await supabase
      .from('spelling_drill_words')
      .select('word')
      .eq('id', body.wordId)
      .maybeSingle();
    if (!word) return NextResponse.json({ error: 'word not found' }, { status: 404 });

    const isCorrect = normalise(String(body.studentInput || '')) === normalise(word.word);

    await supabase.from('spelling_attempts').insert({
      user_id: user.id,
      word_id: body.wordId,
      student_input: String(body.studentInput || '').slice(0, 200),
      is_correct: isCorrect,
      duration_seconds: Number(body.durationSeconds) || null,
    });

    return NextResponse.json({ success: true, isCorrect, correctWord: word.word });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
