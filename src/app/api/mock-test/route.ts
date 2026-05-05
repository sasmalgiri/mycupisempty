/**
 * Mock test engine.
 *
 * POST { action: 'create', subjectSlug, totalMarks?, durationMinutes? }
 *      → composes a fresh paper from chapter_question_bank for the student's
 *        enrolled course (board+class+language). Picks 5-8 chapters across
 *        the syllabus, draws by Madhyamik-shaped proportion (MCQ 25%,
 *        very_short 15%, short 25%, long 20%, application+hots 15%).
 *
 * GET ?id=...            → mock test detail (questions list, no answers)
 * POST { action: 'start_attempt', mockTestId } → opens an attempt row
 * POST { action: 'submit_attempt', attemptId, answers, durationSeconds, pasteCount, blurCount }
 *      → grades + writes per_question_marks + total_marks_awarded, sets
 *        status='graded'
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { answersMatch } from '@/lib/exit-eval';

const TYPE_PROPORTIONS: Record<string, number> = {
  mcq: 0.25,
  very_short: 0.15,
  short: 0.25,
  long: 0.20,
  application: 0.10,
  hots: 0.05,
};

const DEFAULT_TOTAL_MARKS = 70;
const DEFAULT_DURATION_MIN = 90;

export async function GET(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) {
      // List recent mock tests for this user
      const { data } = await supabase
        .from('mock_tests')
        .select('id, subject_slug, class_level, board_code, total_marks, duration_minutes, generated_at, language')
        .eq('user_id', user.id)
        .order('generated_at', { ascending: false })
        .limit(10);
      return NextResponse.json({ success: true, mockTests: data || [] });
    }
    const { data: mt } = await supabase
      .from('mock_tests')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!mt) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    // Hydrate question bodies (without answers)
    const qIds = (mt.questions as any[]).map((q: any) => q.question_id);
    const { data: qrows } = await supabase
      .from('chapter_question_bank')
      .select('id, question_text, question_type, marks, options')
      .in('id', qIds);
    return NextResponse.json({ success: true, mockTest: mt, questions: qrows || [] });
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

    if (body.action === 'create') {
      const subjectSlug = String(body.subjectSlug || '').trim();
      if (!subjectSlug) return NextResponse.json({ error: 'subjectSlug required' }, { status: 400 });
      const totalMarks = Math.max(20, Math.min(100, Number(body.totalMarks) || DEFAULT_TOTAL_MARKS));
      const durationMinutes = Math.max(20, Math.min(180, Number(body.durationMinutes) || DEFAULT_DURATION_MIN));

      // Find the student's active enrollment to figure out board+class+language
      const { data: enrollment } = await supabase
        .from('course_enrollments')
        .select('id, curriculum_courses!inner(board_code, class_level, language)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('enrolled_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!enrollment) return NextResponse.json({ error: 'No active enrollment' }, { status: 400 });
      const course = enrollment.curriculum_courses;

      // Pull the subject_class row + chapters
      const { data: scc } = await supabase
        .from('curriculum_subjects_by_class')
        .select('id')
        .eq('board_code', course.board_code)
        .eq('class_level', course.class_level)
        .eq('subject_slug', subjectSlug)
        .eq('language', course.language)
        .maybeSingle();
      if (!scc) return NextResponse.json({ error: 'Subject not registered for this course' }, { status: 404 });

      // Pull qbank questions for this subject's chapters
      const { data: chapters } = await supabase
        .from('curriculum_chapters')
        .select('id')
        .eq('subject_class_id', scc.id);
      const chapterIds = (chapters || []).map((c: any) => c.id);
      if (chapterIds.length === 0) return NextResponse.json({ error: 'No chapters seeded for this subject' }, { status: 404 });

      const { data: pool } = await supabase
        .from('chapter_question_bank')
        .select('id, question_type, marks')
        .in('chapter_id', chapterIds);
      const allQ = (pool || []) as any[];
      if (allQ.length < 5) return NextResponse.json({ error: 'Not enough questions in bank yet — run /api/qbank/bulk first' }, { status: 503 });

      // Compose: target marks per type by proportion, then sample
      const composed: Array<{ question_id: string; marks: number; type: string }> = [];
      let used = new Set<string>();
      for (const [type, proportion] of Object.entries(TYPE_PROPORTIONS)) {
        const targetMarks = Math.round(totalMarks * proportion);
        let acc = 0;
        const candidates = allQ.filter((q) => q.question_type === type && !used.has(q.id));
        // Shuffle
        for (let i = candidates.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }
        for (const q of candidates) {
          if (acc >= targetMarks) break;
          composed.push({ question_id: q.id, marks: q.marks, type: q.question_type });
          used.add(q.id);
          acc += q.marks;
        }
      }
      const actualTotal = composed.reduce((s, q) => s + q.marks, 0);

      const { data: row, error } = await supabase.from('mock_tests').insert({
        user_id: user.id,
        board_code: course.board_code,
        class_level: course.class_level,
        subject_slug: subjectSlug,
        language: course.language,
        questions: composed,
        total_marks: actualTotal,
        duration_minutes: durationMinutes,
        expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
      }).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, mockTest: row });
    }

    if (body.action === 'start_attempt' && body.mockTestId) {
      const { data: mt } = await supabase.from('mock_tests').select('total_marks').eq('id', body.mockTestId).eq('user_id', user.id).maybeSingle();
      if (!mt) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const { data: row, error } = await supabase.from('mock_test_attempts').insert({
        user_id: user.id,
        mock_test_id: body.mockTestId,
        total_marks_available: mt.total_marks,
        status: 'in_progress',
      }).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, attempt: row });
    }

    if (body.action === 'submit_attempt' && body.attemptId) {
      const answers = body.answers || {};
      // Pull mock test composition + qbank rows for grading
      const { data: attempt } = await supabase.from('mock_test_attempts').select('mock_test_id, total_marks_available').eq('id', body.attemptId).eq('user_id', user.id).maybeSingle();
      if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
      const { data: mt } = await supabase.from('mock_tests').select('questions').eq('id', attempt.mock_test_id).maybeSingle();
      const composedList: any[] = mt?.questions || [];
      const qIds = composedList.map((q: any) => q.question_id);
      const { data: qrows } = await supabase
        .from('chapter_question_bank')
        .select('id, question_type, marks, answer_text, correct_index, options')
        .in('id', qIds);
      const qById: Record<string, any> = Object.fromEntries((qrows || []).map((q: any) => [q.id, q]));

      // Grade
      const perQ: Record<string, number> = {};
      let total = 0;
      for (const composed of composedList) {
        const q = qById[composed.question_id];
        if (!q) continue;
        const studentAnswer: string = String(answers[composed.question_id]?.answer || '').trim();
        if (!studentAnswer) { perQ[composed.question_id] = 0; continue; }
        let awarded = 0;
        if (q.question_type === 'mcq') {
          // student answer is the chosen index as a string
          const chosenIdx = Number(studentAnswer);
          if (Number.isFinite(chosenIdx) && chosenIdx === q.correct_index) awarded = q.marks;
        } else {
          if (answersMatch(studentAnswer, q.answer_text || '')) awarded = q.marks;
          else if (studentAnswer.length >= 10 && q.answer_text && studentAnswer.toLowerCase().includes(q.answer_text.toLowerCase().slice(0, 12))) {
            awarded = Math.round(q.marks / 2);
          }
        }
        perQ[composed.question_id] = awarded;
        total += awarded;
      }

      const pasteCount = Number(body.pasteCount) || 0;
      const blurCount = Number(body.blurCount) || 0;
      const durationSeconds = Number(body.durationSeconds) || 0;

      await supabase.from('mock_test_attempts').update({
        answers,
        per_question_marks: perQ,
        total_marks_awarded: total,
        paste_count: pasteCount,
        blur_count: blurCount,
        duration_seconds: durationSeconds,
        status: 'graded',
        submitted_at: new Date().toISOString(),
        graded_at: new Date().toISOString(),
      }).eq('id', body.attemptId).eq('user_id', user.id);

      return NextResponse.json({ success: true, totalAwarded: total, totalAvailable: attempt.total_marks_available, perQuestion: perQ });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
