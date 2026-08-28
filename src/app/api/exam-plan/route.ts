/**
 * Exam Plan API — "the exam is on 3 March. Is that enough time, and if not,
 * what exactly are we not going to do?"
 *
 * GET  — build the backward plan from the exam date.
 * POST — { action: 'what_if' } to test a different weekly commitment or date
 *        before committing to it.
 *
 * This is the inverse of /api/exam-readiness, which forecasts forwards from
 * the current pace. Both are useful; only this one can tell a student in
 * October that five hours a week will not get her through the syllabus.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { buildExamPlan } from '@/lib/exam-plan-store';
import { summariseLearningSelf } from '@/lib/conversion-engine';
import { loadRepStats } from '@/lib/conversion-store';

export const maxDuration = 30;

async function resolveTarget(supabase: any, userId: string, studentId: string | null) {
  if (!studentId || studentId === userId) return userId;
  const { data: link } = await supabase
    .from('parent_student_links')
    .select('parent_id')
    .eq('parent_id', userId)
    .eq('student_id', studentId)
    .maybeSingle();
  return link ? studentId : null;
}

export async function GET(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const targetId = await resolveTarget(supabase, user.id, url.searchParams.get('studentId'));
    if (!targetId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_class, board_code')
      .eq('id', targetId)
      .maybeSingle();

    // Enrolment carries the student's own weekly commitment; fall back to the
    // query string, then to a modest default rather than an ambitious one.
    const { data: enrolment } = await supabase
      .from('course_enrollments')
      .select('weekly_minutes_target, target_completion_date')
      .eq('user_id', targetId)
      .eq('status', 'active')
      .order('enrolled_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const weeklyMinutesTarget =
      Number(url.searchParams.get('weeklyMinutes')) ||
      enrolment?.weekly_minutes_target ||
      300;

    const result = await buildExamPlan(supabase, {
      userId: targetId,
      examDate: url.searchParams.get('examDate') || enrolment?.target_completion_date || undefined,
      weeklyMinutesTarget,
      classLevel: profile?.current_class ?? 10,
      boardCode: profile?.board_code || url.searchParams.get('board') || undefined,
      academicYear: url.searchParams.get('academicYear') || undefined,
      subjectClassIds: url.searchParams.get('subjects')?.split(',').filter(Boolean),
    });

    if (!result.plan) {
      return NextResponse.json({ success: false, error: result.error || 'Could not build a plan' }, { status: 422 });
    }

    // What she has learned about herself, shown alongside the plan — the plan
    // says what to study, this says how it goes in best for her.
    const stats = await loadRepStats(supabase, targetId);
    const self = summariseLearningSelf([
      { subjectName: 'your subjects', stats: Object.values(stats).flat() },
    ]);

    const p = result.plan;
    return NextResponse.json({
      success: true,
      studentId: targetId,
      exam: { date: result.examDate, title: result.examTitle },

      verdict: p.verdict,
      message: p.message,
      parentMessage: p.parentMessage,
      levers: p.levers,

      time: {
        weeksAvailable: p.weeksAvailable,
        weeklyMinutesTarget,
        grossCapacityHours: Math.round(p.grossCapacityMinutes / 60),
        requiredHours: Math.round(p.requiredMinutes / 60),
        reservedReviewHours: Math.round(p.reservedReviewMinutes / 60),
        feasibility: p.feasibility,
      },

      marks: { covered: p.marksCovered, atRisk: p.marksAtRisk },

      included: p.included.map(summariseAllocation),
      dropped: p.dropped.map((a) => ({ ...summariseAllocation(a), reason: a.droppedReason })),

      reviewCurve: p.reviewCurve,

      // Honesty about the plan's own inputs — a teacher should be able to see
      // which numbers are measured and which are still assumptions.
      confidence: {
        adherence: Math.round(result.adherence.value * 100),
        adherenceMeasured: result.adherence.measured,
        costsCalibrated: result.costsCalibrated,
        chaptersWithEstimatedMix: result.estimatedMixChapters,
        chapterCount: result.chapterCount,
        note: buildConfidenceNote(result),
      },

      howSheLearns: self.insights.map((i) => i.sentence),
      stillLearning: self.stillLearning,
    });
  } catch (error: any) {
    console.error('Exam plan GET error:', error);
    return NextResponse.json({ error: error.message || 'Planning failed' }, { status: 500 });
  }
}

/**
 * What-if: try a different commitment before making it.
 *
 * "What would 8 hours a week get me?" is the question that actually changes
 * behaviour, and it should be answerable without saving anything.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    if (body.action !== 'what_if') {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const targetId = await resolveTarget(supabase, user.id, body.studentId || null);
    if (!targetId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_class, board_code')
      .eq('id', targetId)
      .maybeSingle();

    const options: number[] = Array.isArray(body.weeklyMinutesOptions) && body.weeklyMinutesOptions.length
      ? body.weeklyMinutesOptions.slice(0, 6).map(Number).filter((n: number) => n > 0)
      : [180, 300, 420, 600];

    const results = await Promise.all(
      options.map(async (weeklyMinutesTarget) => {
        const r = await buildExamPlan(supabase, {
          userId: targetId,
          examDate: body.examDate,
          weeklyMinutesTarget,
          classLevel: profile?.current_class ?? 10,
          boardCode: profile?.board_code,
        });
        return {
          weeklyHours: Math.round((weeklyMinutesTarget / 60) * 10) / 10,
          verdict: r.plan?.verdict ?? 'not_possible',
          marksCovered: r.plan?.marksCovered ?? 0,
          marksAtRisk: r.plan?.marksAtRisk ?? 0,
          chaptersDropped: r.plan?.dropped.length ?? 0,
          feasibility: r.plan?.feasibility ?? 0,
        };
      }),
    );

    return NextResponse.json({ success: true, scenarios: results });
  } catch (error: any) {
    console.error('Exam plan POST error:', error);
    return NextResponse.json({ error: error.message || 'What-if failed' }, { status: 500 });
  }
}

function summariseAllocation(a: any) {
  return {
    chapterId: a.chapter.id,
    title: a.chapter.title,
    subject: a.chapter.subjectName,
    examWeightPct: a.chapter.examWeightPct,
    currentMastery: Math.round((a.chapter.currentMastery ?? 0) * 100),
    hours: Math.round((a.totalMinutes / 60) * 10) / 10,
    teachHours: Math.round((a.teachMinutes / 60) * 10) / 10,
    reviewHours: Math.round((a.reviewMinutes / 60) * 10) / 10,
    marksAtStake: a.marksAtStake,
  };
}

function buildConfidenceNote(r: any): string {
  const parts: string[] = [];
  parts.push(
    r.adherence.measured
      ? `Planned against your measured ${Math.round(r.adherence.value * 100)}% adherence.`
      : 'Planned against an assumed 70% adherence — not enough history yet to measure yours.',
  );
  parts.push(
    r.costsCalibrated
      ? 'Chapter times use how long you actually take.'
      : 'Chapter times are still estimates; they will correct themselves as you study.',
  );
  if (r.estimatedMixChapters > 0) {
    parts.push(
      `${r.estimatedMixChapters} of ${r.chapterCount} chapters have not been opened yet, so their difficulty is a subject-level guess.`,
    );
  }
  return parts.join(' ');
}
