/**
 * Question bank generator — admin-only.
 *
 * POST { chapterId, force? }
 *   For a single chapter, computes the gap between current coverage and the
 *   class-band target, calls Gemini to fill the gap (one prompt per question
 *   type so we don't blow context budget), inserts rows with
 *   source='ai_generated', confidence=0.55.
 *
 * Returns { generated, totalNow, gapBefore }.
 *
 * IMPORTANT: We never copy textbook prose. The prompt explicitly tells the
 * model to write FRESH problems that exercise the chapter's learning
 * objectives, NOT to reproduce examples from the book.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { geminiGenerateJSON, isGeminiConfigured } from '@/lib/gemini';
import { gapAgainstTarget, targetForClass, type QuestionType } from '@/lib/qbank-coverage';

interface GeneratedItem {
  question_text: string;
  answer_text: string;
  working?: string;
  options?: string[];
  correct_index?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  cognitive_level?: number;
  marks?: number;
  tags?: string[];
}

const MARKS_BY_TYPE: Record<QuestionType, number> = {
  mcq: 1, very_short: 2, short: 3, long: 5,
  application: 4, hots: 5, match: 2, fill_blank: 1, true_false: 1,
};

function promptForType(args: {
  chapterTitle: string;
  chapterDescription: string;
  classLevel: number;
  language: string;
  type: QuestionType;
  count: number;
}): string {
  const { chapterTitle, chapterDescription, classLevel, language, type, count } = args;
  const langName = language === 'bn' ? 'Bengali' : language === 'hi' ? 'Hindi' : 'English';
  const typeBrief: Record<QuestionType, string> = {
    mcq: '4-option multiple-choice questions. Each option must be plausible (no obvious throwaways). Correct option index 0..3.',
    very_short: 'one-line questions answered in 1-2 sentences (~2 marks each).',
    short: 'questions answered in 4-5 sentences with a clear concept (~3 marks each).',
    long: 'detailed questions requiring a structured answer of ~150 words (~5 marks each). Answer must include working / reasoning.',
    application: 'real-world application questions where the student applies the concept to a fresh scenario.',
    hots: 'higher-order thinking — analyse, evaluate, or extrapolate. Not just recall.',
    match: 'match the following — provide list_a (4 items) and list_b (4 items) with the correct pairing in answer_text as "1-c, 2-a, 3-d, 4-b".',
    fill_blank: 'fill-in-the-blank with a single short answer (one word or phrase).',
    true_false: 'a statement; answer is "True" or "False" with a one-line reason in working.',
  };

  return `You are an Indian school exam question writer. Write ${count} ORIGINAL ${type.replace('_', ' ')} questions for:

  Chapter: "${chapterTitle}"
  Class:   ${classLevel}
  Language for question_text + answer_text + working: ${langName}.
  Description / scope: ${chapterDescription || '(no description provided — infer from chapter title)'}

CRITICAL RULES:
- DO NOT copy or paraphrase any textbook example. Generate FRESH problems that test the same concepts.
- Pitch difficulty appropriately for class ${classLevel}.
- ${typeBrief[type]}
- Working/answer must be self-contained — a student could verify the answer from the working alone.

Return JSON: { "items": [ { "question_text": "...", "answer_text": "...", "working": "...", "difficulty": "easy"|"medium"|"hard", "cognitive_level": 1..6, ${type === 'mcq' ? '"options": ["a","b","c","d"], "correct_index": 0..3,' : ''} "tags": ["..."] } ] }
Output JSON only — no prose, no markdown fences.`;
}

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
    if (!isGeminiConfigured()) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not set on server' }, { status: 503 });
    }

    const body = await req.json();
    const chapterId = body.chapterId;
    if (!chapterId) return NextResponse.json({ error: 'chapterId required' }, { status: 400 });

    // Pull chapter + class
    const { data: chapter } = await supabase
      .from('curriculum_chapters')
      .select('id, title_en, description, subject_class_id')
      .eq('id', chapterId)
      .maybeSingle();
    if (!chapter) return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });

    const { data: scc } = await supabase
      .from('curriculum_subjects_by_class')
      .select('class_level, language')
      .eq('id', chapter.subject_class_id)
      .maybeSingle();
    if (!scc) return NextResponse.json({ error: 'Subject-class missing' }, { status: 500 });

    // Compute gap
    const { data: existing } = await supabase
      .from('chapter_question_bank')
      .select('question_type')
      .eq('chapter_id', chapterId);
    const have: Record<string, number> = {};
    for (const r of (existing || [])) have[r.question_type] = (have[r.question_type] || 0) + 1;

    const target = targetForClass(scc.class_level);
    const gap = body.force ? gapAgainstTarget({}, target) : gapAgainstTarget(have, target);

    if (gap.length === 0) {
      return NextResponse.json({ success: true, generated: 0, totalNow: existing?.length || 0, message: 'Already at target coverage.' });
    }

    let totalGenerated = 0;
    const errors: string[] = [];

    for (const { type, needed } of gap) {
      const prompt = promptForType({
        chapterTitle: chapter.title_en,
        chapterDescription: chapter.description || '',
        classLevel: scc.class_level,
        language: scc.language,
        type,
        count: needed,
      });

      const ai = await geminiGenerateJSON<{ items: GeneratedItem[] }>(prompt, {
        temperature: 0.7,
        maxOutputTokens: 2400,
        timeoutMs: 45_000,
      });
      if (!ai.ok || !ai.data?.items) {
        errors.push(`${type}: ${ai.error || 'no items'}`);
        continue;
      }

      const rows = ai.data.items.slice(0, needed).map((it) => ({
        chapter_id: chapterId,
        question_text: String(it.question_text || '').slice(0, 1500),
        answer_text: String(it.answer_text || '').slice(0, 2500),
        working: it.working ? String(it.working).slice(0, 3000) : null,
        options: type === 'mcq' && Array.isArray(it.options) ? it.options.slice(0, 4) : null,
        correct_index: type === 'mcq' && typeof it.correct_index === 'number' ? Math.max(0, Math.min(3, it.correct_index)) : null,
        question_type: type,
        marks: typeof it.marks === 'number' ? Math.max(1, Math.min(10, it.marks)) : MARKS_BY_TYPE[type],
        difficulty: ['easy', 'medium', 'hard'].includes(it.difficulty || '') ? it.difficulty : 'medium',
        cognitive_level: typeof it.cognitive_level === 'number' ? Math.max(1, Math.min(6, it.cognitive_level)) : 2,
        source: 'ai_generated',
        confidence: 0.55,
        language: scc.language,
        tags: Array.isArray(it.tags) ? it.tags.slice(0, 6).map((s) => String(s).slice(0, 30)) : [],
      }));

      if (rows.length === 0) continue;

      const { error: insertErr } = await supabase.from('chapter_question_bank').insert(rows);
      if (insertErr) errors.push(`${type}: insert ${insertErr.message}`);
      else totalGenerated += rows.length;
    }

    const { count: totalNow } = await supabase
      .from('chapter_question_bank')
      .select('id', { count: 'exact', head: true })
      .eq('chapter_id', chapterId);

    return NextResponse.json({
      success: true,
      chapter_id: chapterId,
      generated: totalGenerated,
      totalNow: totalNow || 0,
      gapBefore: gap,
      errors: errors.length ? errors : undefined,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
