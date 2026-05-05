/**
 * Parent / student-uploaded school papers — the moat that "every school's
 * questions live in one cupboard". Owners photograph an old summative,
 * Tesseract OCRs on the client, this route stores the photo URLs + raw OCR
 * text + (optionally) AI-extracted question rows.
 *
 * GET ?classId=...&subject=...   → list rows visible to the caller
 * POST { schoolId?, classLevel, subjectSlug, year, examLabel, examKind,
 *        photoUrls[], ocrText? }
 *   Inserts a school_papers row (status='uploaded' or 'ocr_done').
 *
 * Verification + extraction is a follow-up admin step (status → 'extracted'
 * → 'verified'). Owners only see their own rows; admins see all.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

const VALID_KINDS = new Set(['summative_1', 'summative_2', 'summative_3', 'unit_test', 'mid_term', 'half_yearly', 'final_exam']);

export async function GET(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const url = new URL(req.url);

    let q = supabase
      .from('school_papers')
      .select('id, school_id, class_level, subject_slug, year, exam_label, exam_kind, status, uploaded_at')
      .eq('uploader_id', user.id)
      .order('uploaded_at', { ascending: false })
      .limit(50);
    const klass = url.searchParams.get('classLevel');
    if (klass) q = q.eq('class_level', Number(klass));
    const subject = url.searchParams.get('subject');
    if (subject) q = q.eq('subject_slug', subject);

    const { data, error } = await q;
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
    const body = await req.json();

    if (!body.classLevel || !body.subjectSlug || !body.year || !body.examLabel) {
      return NextResponse.json({ error: 'classLevel + subjectSlug + year + examLabel required' }, { status: 400 });
    }
    if (body.examKind && !VALID_KINDS.has(body.examKind)) {
      return NextResponse.json({ error: 'invalid examKind' }, { status: 400 });
    }

    const photoUrls: string[] = Array.isArray(body.photoUrls) ? body.photoUrls.slice(0, 10) : [];
    const ocrText: string = String(body.ocrText || '').slice(0, 50000);
    const status = ocrText ? 'ocr_done' : 'uploaded';

    const { data: profile } = await supabase
      .from('profiles')
      .select('school_id, board_code')
      .eq('id', user.id)
      .maybeSingle();

    const { data: row, error } = await supabase
      .from('school_papers')
      .insert({
        uploader_id: user.id,
        school_id: body.schoolId || profile?.school_id || null,
        board_code: body.boardCode || (profile?.board_code === 'wb_board' ? 'wbbse' : profile?.board_code) || null,
        class_level: Number(body.classLevel),
        subject_slug: String(body.subjectSlug).trim(),
        language: body.language || 'bn',
        exam_label: String(body.examLabel).slice(0, 200),
        year: Number(body.year),
        exam_kind: body.examKind || null,
        photo_urls: photoUrls,
        ocr_text: ocrText || null,
        status,
        notes: body.notes ? String(body.notes).slice(0, 500) : null,
      })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ success: true, paper: row });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
