/**
 * Handwriting drill — caller posts a question, takes a photo of their answer,
 * and the route scores legibility × correctness × speed.
 *
 * GET → { prompt: { text, expectedAnswer, chapterId } } — picks one short
 *      question from chapter_question_bank (current summative window) the
 *      student hasn't recently seen.
 * POST { promptText, expectedAnswer, ocrText, durationSeconds, chapterId? }
 *      → returns { legibility, correctness, speed, total }, persists row.
 *
 * OCR happens on the client (Tesseract.js, same dep used by /magic-notes) so
 * the server only sees text. Privacy: photo bytes never hit our DB.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { answersMatch } from '@/lib/exit-eval';

function legibilityFrom(ocrText: string, expected: string): number {
  // Heuristic: how much of expected made it into OCR? Word-overlap ratio.
  const expectedWords = new Set(expected.toLowerCase().split(/\s+/).filter((w) => w.length > 1));
  const ocrWords = new Set(ocrText.toLowerCase().split(/\s+/).filter((w) => w.length > 1));
  if (expectedWords.size === 0) return 0.5;
  let hit = 0;
  for (const w of expectedWords) if (ocrWords.has(w)) hit++;
  return Math.min(1, hit / expectedWords.size);
}

function speedFrom(durationSeconds: number, expectedWordCount: number): number {
  if (!durationSeconds || durationSeconds <= 0 || !expectedWordCount) return 0.5;
  // 5 words / minute is target for primary; older students faster.
  const wpm = (expectedWordCount / durationSeconds) * 60;
  if (wpm < 3)  return 0.3;
  if (wpm < 5)  return 0.6;
  if (wpm < 8)  return 0.85;
  return 1.0;
}

export async function GET() {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_class, board_code, language')
      .eq('id', user.id)
      .maybeSingle();
    if (!profile?.current_class) return NextResponse.json({ success: true, prompt: null });
    const board = profile.board_code === 'wb_board' ? 'wbbse' : profile.board_code;

    const { data: scc } = await supabase
      .from('curriculum_subjects_by_class')
      .select('id')
      .eq('board_code', board)
      .eq('class_level', profile.current_class);
    const sccIds = (scc || []).map((r: any) => r.id);
    if (sccIds.length === 0) return NextResponse.json({ success: true, prompt: null });

    const { data: chs } = await supabase
      .from('curriculum_chapters')
      .select('id')
      .in('subject_class_id', sccIds);
    const chIds = (chs || []).map((c: any) => c.id);
    if (chIds.length === 0) return NextResponse.json({ success: true, prompt: null });

    // Prefer short answers (so a 10-yr-old can write them in 60s).
    const { data: pool } = await supabase
      .from('chapter_question_bank')
      .select('id, chapter_id, question_text, answer_text, question_type, marks')
      .in('chapter_id', chIds)
      .in('question_type', ['very_short', 'short', 'fill_blank'])
      .limit(50);
    const list = (pool || []) as any[];
    if (list.length === 0) return NextResponse.json({ success: true, prompt: null });
    const pick = list[Math.floor(Math.random() * list.length)];

    return NextResponse.json({
      success: true,
      prompt: {
        questionId: pick.id,
        chapterId: pick.chapter_id,
        text: pick.question_text,
        expectedAnswer: pick.answer_text,
        questionType: pick.question_type,
        marks: pick.marks,
      },
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

    const promptText = String(body.promptText || '').trim();
    const expectedAnswer = String(body.expectedAnswer || '').trim();
    const ocrText = String(body.ocrText || '').trim();
    const durationSeconds = Math.max(1, Number(body.durationSeconds) || 60);

    if (!promptText || !expectedAnswer) return NextResponse.json({ error: 'promptText + expectedAnswer required' }, { status: 400 });

    const legibility = legibilityFrom(ocrText, expectedAnswer);
    const correctness = ocrText ? (answersMatch(ocrText, expectedAnswer) ? 1 : Math.max(0, legibility - 0.2)) : 0;
    const expectedWordCount = expectedAnswer.split(/\s+/).filter(Boolean).length;
    const speed = speedFrom(durationSeconds, expectedWordCount);
    const total = Math.round((0.4 * legibility + 0.4 * correctness + 0.2 * speed) * 100) / 100;

    await supabase.from('handwriting_attempts').insert({
      user_id: user.id,
      chapter_id: body.chapterId || null,
      prompt_text: promptText.slice(0, 500),
      expected_answer: expectedAnswer.slice(0, 1000),
      ocr_text: ocrText.slice(0, 2000),
      legibility_score: legibility,
      correctness_score: correctness,
      speed_score: speed,
      duration_seconds: durationSeconds,
      language: body.language || 'en',
    });

    return NextResponse.json({
      success: true,
      legibility,
      correctness,
      speed,
      total,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
