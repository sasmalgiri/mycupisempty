/**
 * Study Plan API — returns an autonomously-generated weekly plan.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { buildStudentState, decideAdaptation } from '@/lib/student-state';
import { buildMasteryMap } from '@/lib/mastery';
import { detectInterventions } from '@/lib/intervention-engine';
import { buildCalibrationMap } from '@/lib/method-calibration';
import { computeReminderSchedule } from '@/lib/smart-reminders';
import { generateWeeklyPlan } from '@/lib/study-planner';

export async function GET(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const targetExamDate = url.searchParams.get('examDate') || undefined;

    const [state, masteryMaps, signalsResult, statsResult] = await Promise.all([
      buildStudentState(supabase, user.id),
      buildMasteryMap(supabase, user.id).catch(() => []),
      supabase.from('learner_signals').select('signal_type, value, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(500).catch(() => ({ data: [] })),
      supabase.from('user_stats').select('current_streak, last_activity_date').eq('user_id', user.id).maybeSingle().catch(() => ({ data: null })),
    ]);

    const signals = signalsResult?.data || [];
    const stats = statsResult?.data || {};

    const adaptation = decideAdaptation(state);
    const interventions = detectInterventions(state);

    const subjectList = Object.values(state.subjectStates).map((s) => ({ id: s.subjectId, name: s.subjectName }));
    const calibration = subjectList.length > 0
      ? await buildCalibrationMap(supabase, user.id, subjectList).catch(() => [])
      : [];

    const schedule = computeReminderSchedule(user.id, signals, {
      currentStreak: stats.current_streak,
      lastActivityDate: stats.last_activity_date,
    });

    // Check last plan's adherence
    let lastPlanAdherence: number | undefined;
    try {
      const { data: lastPlan } = await supabase
        .from('study_plans')
        .select('sessions, adherence')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastPlan?.adherence != null) lastPlanAdherence = lastPlan.adherence;
    } catch {}

    const plan = generateWeeklyPlan({
      state,
      masteryMaps,
      adaptation,
      interventions,
      calibration,
      preferredHour: schedule.preferredHour,
      targetExamDate,
      lastPlanAdherence,
    });

    // Persist the plan
    try {
      await supabase.from('study_plans').insert({
        user_id: user.id,
        plan_data: plan,
        target_date: targetExamDate || null,
        created_at: plan.generatedAt,
      });
    } catch {}

    return NextResponse.json({ success: true, plan });
  } catch (error: any) {
    console.error('Study plan error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
