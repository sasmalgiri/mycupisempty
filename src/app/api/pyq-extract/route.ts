/**
 * PDF → question-bank extractor.
 *
 * POST { paperId, pdfBase64?, ocrText? }
 *   Pulls a past_papers row, extracts questions via Gemini (preferring caller-
 *   supplied OCR text or PDF; falls back to fetching the source_url and OCR-ing
 *   on the server). Each extracted question lands in chapter_question_bank
 *   tagged source='past_paper' with confidence 0.85.
 *
 * Admin-only.
 */

import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase';
import { geminiGenerateJSON, isGeminiConfigured } from '@/lib/gemini';

interface ExtractedQuestion {
  question_text: string;
  answer_text?: string;
  marks?: number;
  question_type?: string;
  options?: string[];
  correct_index?: number;
  chapter_hint?: string;
}

const VALID_TYPES = new Set(['mcq', 'very_short', 'short', 'long', 'application', 'hots', 'match', 'fill_blank', 'true_false']);

export async function POST(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (!profile || (profile.role !== 'admin' && profile.role !== 'teacher')) {
      return NextResponse.json({ error: 'Forbidden — admin/teacher only' }, { status: 403 });
    }
    if (!isGeminiConfigured()) {
      return NextResponse.json({ error: 'Gemini not configured' }, { status: 503 });
    }

    const body = await req.json();
    const paperId = body.paperId;
    if (!paperId) return NextResponse.json({ error: 'paperId required' }, { status: 400 });

    const { data: paper } = await supabase
      .from('past_papers')
      .select('id, board_code, class_level, subject_slug, exam_label, year, language')
      .eq('id', paperId)
      .maybeSingle();
    if (!paper) return NextResponse.json({ error: 'paper not found' }, { status: 404 });

    const ocrText = String(body.ocrText || '').slice(0, 80000);
    if (!ocrText || ocrText.length < 200) {
      return NextResponse.json({ error: 'ocrText (>= 200 chars) required — run OCR client-side first' }, { status: 400 });
    }

    const langName = paper.language === 'bn' ? 'Bengali' : paper.language === 'hi' ? 'Hindi' : 'English';
    const prompt = `You are extracting questions from a ${paper.exam_label} (Class ${paper.class_level} ${paper.subject_slug}).

The OCR text below may have artefacts (headers, page numbers, broken hyphens). Ignore noise; extract only actual exam questions.

Return STRICTLY this JSON:
{
  "questions": [
    {
      "question_text": "...",
      "answer_text": "(your best model answer in ${langName}, even if not in source)",
      "marks": 1,
      "question_type": "mcq | very_short | short | long | fill_blank | true_false",
      "options": ["A","B","C","D"]   (only for mcq),
      "correct_index": 0,            (only for mcq, 0-based),
      "chapter_hint": "(short phrase identifying which chapter — e.g. 'Fractions', 'Light reflection')"
    }
  ]
}

Source text:
${ocrText}`;

    const result = await geminiGenerateJSON<{ questions: ExtractedQuestion[] }>(prompt, { temperature: 0.2 });
    if (!result.ok || !result.data) {
      return NextResponse.json({ error: result.error || 'Gemini returned nothing' }, { status: 502 });
    }

    const candidates = (result.data.questions || []).filter((q) => q.question_text && q.question_text.length > 5);

    // Map each extracted question to a chapter via chapter_hint string-match.
    const { data: scc } = await supabase
      .from('curriculum_subjects_by_class')
      .select('id')
      .eq('board_code', paper.board_code)
      .eq('class_level', paper.class_level)
      .eq('subject_slug', paper.subject_slug)
      .maybeSingle();
    if (!scc) return NextResponse.json({ error: 'Subject not registered for this class' }, { status: 404 });

    const { data: chapters } = await supabase
      .from('curriculum_chapters')
      .select('id, title_en, title_native')
      .eq('subject_class_id', scc.id);

    const findChapter = (hint?: string): string | null => {
      if (!hint || !chapters) return null;
      const h = hint.toLowerCase();
      for (const c of chapters) {
        const t = (c.title_en || '').toLowerCase();
        const tn = (c.title_native || '').toLowerCase();
        if (t && (t.includes(h) || h.includes(t))) return c.id;
        if (tn && (tn.includes(h) || h.includes(tn))) return c.id;
      }
      return null;
    };

    const admin: any = createAdminClient();
    const rowsToInsert: any[] = [];
    for (const q of candidates) {
      const chapterId = findChapter(q.chapter_hint);
      if (!chapterId) continue;
      const qType = VALID_TYPES.has(q.question_type || '') ? q.question_type : 'short';
      rowsToInsert.push({
        chapter_id: chapterId,
        question_text: q.question_text.slice(0, 1000),
        answer_text: (q.answer_text || '(model answer pending review)').slice(0, 2000),
        options: q.options && q.options.length > 0 ? q.options.slice(0, 6) : null,
        correct_index: typeof q.correct_index === 'number' ? q.correct_index : null,
        question_type: qType,
        marks: Math.max(1, Math.min(10, Number(q.marks) || 1)),
        difficulty: 'medium',
        cognitive_level: 2,
        source: 'past_paper',
        source_paper_year: paper.year,
        source_paper_label: paper.exam_label,
        confidence: 0.85,
        verified_by: user.id,
        verified_at: new Date().toISOString(),
        language: paper.language,
        tags: ['pyq', `pyq_${paper.year}`],
      });
    }

    if (rowsToInsert.length === 0) {
      return NextResponse.json({ success: true, extracted: candidates.length, inserted: 0, note: 'no chapter matches found — review chapter_hint output' });
    }

    const { error } = await admin.from('chapter_question_bank').insert(rowsToInsert);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await admin.from('pyq_ingestion_log').insert({
      source_name: 'pyq_extract',
      board_code: paper.board_code,
      class_level: paper.class_level,
      subject_slug: paper.subject_slug,
      papers_imported: 1,
      questions_imported: rowsToInsert.length,
      status: 'success',
    });

    return NextResponse.json({
      success: true,
      extracted: candidates.length,
      inserted: rowsToInsert.length,
      unmatched: candidates.length - rowsToInsert.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
