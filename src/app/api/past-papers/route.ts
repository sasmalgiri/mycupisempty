/**
 * Past papers — admin import + list.
 *
 * GET ?board=...&class=...&subject=...   → list past_papers metadata + question count
 * POST { paper, questions[] }            → admin only. Inserts a past_papers row + bulk
 *                                           imports questions into chapter_question_bank
 *                                           with source='past_paper'.
 *
 * Each question must include chapter_id (admin maps year-by-year). Future work:
 * AI-assisted chapter inference at import time.
 */

import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase';

interface ImportQuestion {
  chapter_id: string;
  topic_id?: string | null;
  question_text: string;
  answer_text: string;
  working?: string | null;
  options?: string[] | null;
  correct_index?: number | null;
  question_type: string;
  marks: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  cognitive_level?: number;
  tags?: string[];
}

const ADMIN_ROLES = new Set(['admin', 'teacher']);

export async function GET(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const url = new URL(req.url);
    const boardCode = url.searchParams.get('board');
    const classLevel = url.searchParams.get('class');
    const subjectSlug = url.searchParams.get('subject');

    let query = supabase.from('past_papers').select('*').order('year', { ascending: false });
    if (boardCode) query = query.eq('board_code', boardCode);
    if (classLevel) query = query.eq('class_level', Number(classLevel));
    if (subjectSlug) query = query.eq('subject_slug', subjectSlug);

    const { data, error } = await query.limit(200);
    if (error) throw error;
    return NextResponse.json({ success: true, papers: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (!profile || !ADMIN_ROLES.has(profile.role)) {
      return NextResponse.json({ error: 'Forbidden — admin/teacher only' }, { status: 403 });
    }

    const body = await req.json();
    const paper = body.paper as {
      board_code: string;
      class_level: number;
      subject_slug: string;
      language?: string;
      exam_label: string;
      year: number;
      total_marks?: number | null;
      duration_minutes?: number | null;
      source_url?: string | null;
      notes?: string | null;
    };
    const questions = (body.questions || []) as ImportQuestion[];

    if (!paper?.board_code || !paper?.class_level || !paper?.subject_slug || !paper?.exam_label || !paper?.year) {
      return NextResponse.json({ error: 'paper.{board_code,class_level,subject_slug,exam_label,year} required' }, { status: 400 });
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: 'questions[] must be a non-empty array' }, { status: 400 });
    }

    const admin = createAdminClient() as any;

    const { data: paperRow, error: paperErr } = await admin
      .from('past_papers')
      .upsert({
        board_code: paper.board_code,
        class_level: paper.class_level,
        subject_slug: paper.subject_slug,
        language: paper.language || 'bn',
        exam_label: paper.exam_label,
        year: paper.year,
        total_marks: paper.total_marks ?? null,
        duration_minutes: paper.duration_minutes ?? null,
        source_url: paper.source_url ?? null,
        notes: paper.notes ?? null,
      }, { onConflict: 'board_code,class_level,subject_slug,year,language' })
      .select()
      .single();
    if (paperErr) throw paperErr;

    // Validate every question has a real chapter_id and required shape
    const rows = questions.map((q) => {
      if (!q.chapter_id || !q.question_text || !q.answer_text || !q.question_type || !q.marks) {
        throw new Error('Each question requires chapter_id, question_text, answer_text, question_type, marks');
      }
      return {
        chapter_id: q.chapter_id,
        topic_id: q.topic_id || null,
        question_text: q.question_text,
        answer_text: q.answer_text,
        working: q.working || null,
        options: q.options || null,
        correct_index: q.correct_index ?? null,
        question_type: q.question_type,
        marks: q.marks,
        difficulty: q.difficulty || 'medium',
        cognitive_level: q.cognitive_level || 2,
        source: 'past_paper',
        source_paper_year: paper.year,
        source_paper_label: paper.exam_label,
        confidence: 0.95,
        verified_by: user.id,
        verified_at: new Date().toISOString(),
        language: paper.language || 'bn',
        tags: q.tags || [],
      };
    });

    const { data: inserted, error: insErr } = await admin
      .from('chapter_question_bank')
      .insert(rows)
      .select('id');
    if (insErr) throw insErr;

    return NextResponse.json({
      success: true,
      paper: paperRow,
      inserted_count: inserted?.length || 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
