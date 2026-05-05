/**
 * Today's plan slice — what does the student's curriculum plan say to study
 * RIGHT NOW? This is what makes Daily Mix plan-aware (Phase G).
 *
 * GET → {
 *   week: { weekNo, startDate, endDate, dailyMinutesTarget, notes, isLightWeek, isAssessmentWeek }
 *   blocks: PlanBlock[] (today's slice — proportional share of the week)
 *   enrollment: { ... }
 *   companion_overlay: { ... } picked for the first block's subject
 *   method: chosen method for the first block (from /api/method-assignment narrow)
 *   adherence_pct: rolling % from prior weeks
 * }
 *
 * If the student isn't enrolled in any course → returns { enrolled: false }
 * and Daily Mix falls back to its existing free-form behaviour.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function weekFor(plan: any, today: string): any {
  const weeks = plan?.weeks || [];
  for (const w of weeks) {
    if (today >= w.startDate && today <= w.endDate) return w;
  }
  // If no week matches (start_date not yet reached, or plan ended), pick the
  // closest forward week.
  const upcoming = weeks.find((w: any) => w.startDate >= today);
  return upcoming || weeks[weeks.length - 1] || null;
}

export async function GET(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Find the student's most recent active enrollment.
    const { data: enrollment } = await supabase
      .from('course_enrollments')
      .select('id, course_id, start_date, weekly_minutes_target, status, curriculum_courses!inner(id, board_code, class_level, language, title)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('enrolled_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!enrollment) {
      return NextResponse.json({ success: true, enrolled: false });
    }

    // Pull the current plan
    const { data: plan } = await supabase
      .from('student_curriculum_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('enrollment_id', enrollment.id)
      .eq('is_current', true)
      .maybeSingle();

    if (!plan) {
      return NextResponse.json({
        success: true,
        enrolled: true,
        enrollment,
        plan: null,
        notice: 'No current plan — call POST /api/plan to generate.',
      });
    }

    const today = todayISO();
    const week = weekFor(plan, today);
    if (!week) {
      return NextResponse.json({ success: true, enrolled: true, enrollment, plan: { id: plan.id }, week: null });
    }

    // Pull companion overlay for the first non-review block's subject.
    const firstBlock = (week.blocks || []).find((b: any) => !b.isReview) || (week.blocks || [])[0] || null;
    const course = enrollment.curriculum_courses;

    let overlay: any = null;
    let method: string | null = null;
    if (firstBlock?.subjectSlug) {
      // Map subject_slug → companion_id via a small constant table.
      const COMPANION_BY_SUBJECT: Record<string, string> = {
        math: 'aryabhata',
        physical_science: 'nambi',
        life_science: 'nambi',
        science: 'nambi',
        english: 'tagore',
        bengali: 'premchand',
        history: 'chanakya',
        geography: 'chanakya',
        social: 'chanakya',
      };
      const companionId = COMPANION_BY_SUBJECT[firstBlock.subjectSlug] || 'guru';

      // Method narrowing
      try {
        const baseUrl = new URL(req.url).origin;
        const cookies = req.headers.get('cookie') || '';
        const narrowRes = await fetch(`${baseUrl}/api/method-assignment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: cookies },
          body: JSON.stringify({
            action: 'narrow',
            subjectSlug: firstBlock.subjectSlug,
            chapterId: firstBlock.chapterId,
          }),
        }).then((r) => r.json());
        method = narrowRes?.method || null;
      } catch { /* non-fatal */ }

      // Companion overlay (most-specific for this class+method+chapter)
      try {
        const params = new URLSearchParams({
          board: course.board_code,
          companionId,
          class: String(course.class_level),
          lang: course.language,
        });
        if (method) params.set('method', method);
        if (firstBlock.chapterId) params.set('chapterId', firstBlock.chapterId);
        const overRes = await fetch(`${new URL(req.url).origin}/api/companion-overlay?${params.toString()}`, {
          headers: { cookie: req.headers.get('cookie') || '' },
        }).then((r) => r.json());
        overlay = overRes?.overlay || null;
      } catch { /* non-fatal */ }
    }

    // Adherence: how many past weeks had at least one completed daily mix?
    // Cheap version — count daily_mix_sessions in the plan's date range.
    const planStart = (plan.weeks || [])[0]?.startDate;
    const planTodayCutoff = today;
    let adherencePct: number | null = null;
    if (planStart) {
      const { count: weeksElapsed } = await supabase
        .from('daily_mix_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('session_date', planStart)
        .lte('session_date', planTodayCutoff);
      const expectedDays = Math.max(1, Math.round((new Date(today).getTime() - new Date(planStart).getTime()) / 86400000));
      adherencePct = Math.min(100, Math.round(((weeksElapsed || 0) / expectedDays) * 100));
    }

    return NextResponse.json({
      success: true,
      enrolled: true,
      enrollment,
      plan: { id: plan.id, generated_at: plan.generated_at, generator_version: plan.generator_version },
      week,
      method,
      overlay,
      adherence_pct: adherencePct,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
