/**
 * Plan API — generate / read / replan.
 *
 * GET ?enrollmentId=...  → current plan (or 404)
 * POST { action: 'generate', enrollmentId }
 *      → generates a fresh plan, marks any prior current plan superseded
 * POST { action: 'replan', enrollmentId, reason }
 *      → same as generate but logs a reason for the audit trail
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { generatePlan, type PlanInput } from '@/lib/plan-generator';

async function loadPlanInput(supabase: any, userId: string, enrollmentId: string): Promise<PlanInput | null> {
  const { data: enrollment } = await supabase
    .from('course_enrollments')
    .select('id, course_id, start_date, weekly_minutes_target')
    .eq('id', enrollmentId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!enrollment) return null;

  const { data: course } = await supabase
    .from('curriculum_courses')
    .select('id, board_code, class_level, language, expected_weeks, academic_year')
    .eq('id', enrollment.course_id)
    .maybeSingle();
  if (!course) return null;

  const { data: subjects } = await supabase
    .from('curriculum_subjects_by_class')
    .select('id, subject_slug, expected_hours_per_year, total_chapters')
    .eq('board_code', course.board_code)
    .eq('class_level', course.class_level);

  const subjectIds = (subjects || []).map((s: any) => s.id);
  const { data: chapters } = subjectIds.length
    ? await supabase
        .from('curriculum_chapters')
        .select('id, subject_class_id, chapter_no, title_en, season_hint, expected_hours, prereq_chapter_ids, exam_weight_pct, maturity_band')
        .in('subject_class_id', subjectIds)
    : { data: [] };

  const { data: persona } = await supabase
    .from('persona_profiles')
    .select('daily_study_minutes_available, best_study_time, energy_after_school, effort_tolerance, perfectionism')
    .eq('user_id', userId)
    .maybeSingle();

  const { data: calendars } = await supabase
    .from('curriculum_calendars')
    .select('event_kind, start_date, end_date')
    .eq('academic_year', course.academic_year)
    .eq('affects_planner', true);

  return {
    course: {
      boardCode: course.board_code,
      classLevel: course.class_level,
      language: course.language,
      expectedWeeks: course.expected_weeks || 40,
    },
    subjects: (subjects || []).map((s: any) => ({
      id: s.id,
      subjectSlug: s.subject_slug,
      expectedHoursPerYear: s.expected_hours_per_year,
      totalChapters: s.total_chapters,
    })),
    chapters: (chapters || []).map((c: any) => ({
      id: c.id,
      subjectClassId: c.subject_class_id,
      chapterNo: c.chapter_no,
      titleEn: c.title_en,
      seasonHint: c.season_hint || 'flexible',
      expectedHours: c.expected_hours,
      prereqChapterIds: c.prereq_chapter_ids || [],
      examWeightPct: c.exam_weight_pct,
      maturityBand: c.maturity_band || 3,
    })),
    persona: persona || {
      daily_study_minutes_available: null,
      best_study_time: null,
      energy_after_school: null,
      effort_tolerance: null,
      perfectionism: null,
    },
    calendars: (calendars || []).map((c: any) => ({
      eventKind: c.event_kind,
      startDate: c.start_date,
      endDate: c.end_date,
    })),
    enrollment: {
      startDate: enrollment.start_date,
      weeklyMinutesTarget: enrollment.weekly_minutes_target,
    },
  };
}

export async function GET(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const enrollmentId = url.searchParams.get('enrollmentId');
    if (!enrollmentId) return NextResponse.json({ error: 'enrollmentId required' }, { status: 400 });

    const { data: plan } = await supabase
      .from('student_curriculum_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('enrollment_id', enrollmentId)
      .eq('is_current', true)
      .maybeSingle();
    if (!plan) return NextResponse.json({ success: true, plan: null });

    return NextResponse.json({ success: true, plan });
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
    const enrollmentId = body.enrollmentId;
    if (!enrollmentId) return NextResponse.json({ error: 'enrollmentId required' }, { status: 400 });

    const input = await loadPlanInput(supabase, user.id, enrollmentId);
    if (!input) return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });

    const plan = generatePlan(input);

    // Mark any prior current plans for this enrollment as superseded.
    const { data: priors } = await supabase
      .from('student_curriculum_plans')
      .select('id')
      .eq('user_id', user.id)
      .eq('enrollment_id', enrollmentId)
      .eq('is_current', true);

    const { data: row, error } = await supabase
      .from('student_curriculum_plans')
      .insert({
        user_id: user.id,
        enrollment_id: enrollmentId,
        generator_version: plan.generatorVersion,
        weeks: plan.weeks,
        is_current: true,
        notes: body.reason || (body.action === 'replan' ? 'replan' : 'initial'),
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (priors && priors.length > 0) {
      await supabase
        .from('student_curriculum_plans')
        .update({ is_current: false, superseded_by: row.id })
        .in('id', priors.map((p: any) => p.id));
    }

    return NextResponse.json({ success: true, plan: row });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
