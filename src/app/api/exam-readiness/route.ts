/**
 * Exam Readiness Forecast API
 *
 * GET ?examType=jee_main&targetDate=2027-05-15
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { forecastReadiness } from '@/lib/exam-readiness';
import { buildMasteryMap } from '@/lib/mastery';

export async function GET(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const studentId = url.searchParams.get('studentId') || user.id;
    const rawExamType = url.searchParams.get('examType') || 'general';
    const VALID_EXAM_TYPES = ['board_10', 'board_12', 'jee_main', 'jee_advanced', 'neet', 'ntse', 'general'] as const;
    type ValidExamType = typeof VALID_EXAM_TYPES[number];
    const examType = (VALID_EXAM_TYPES.includes(rawExamType as ValidExamType) ? rawExamType : 'general') as ValidExamType;
    const targetDateRaw = url.searchParams.get('targetDate');
    let targetDate: string | undefined;
    if (targetDateRaw) {
      const parsed = new Date(targetDateRaw);
      if (!isNaN(parsed.getTime()) && parsed.getTime() > Date.now()) {
        targetDate = parsed.toISOString();
      }
    }

    // Parent access check
    if (studentId !== user.id) {
      const { data: link } = await supabase
        .from('parent_student_links')
        .select('*')
        .eq('parent_id', user.id)
        .eq('student_id', studentId)
        .maybeSingle();
      if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch mastery + weekly mastery deltas (from signals)
    const [masteryMaps, signalsResult, statsResult] = await Promise.all([
      buildMasteryMap(supabase, studentId).catch(() => []),
      supabase.from('learner_signals')
        .select('signal_type, value, created_at')
        .eq('user_id', studentId)
        .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
        .catch(() => ({ data: [] })),
      supabase.from('user_stats')
        .select('total_time_spent_minutes')
        .eq('user_id', studentId)
        .single()
        .catch(() => ({ data: null })),
    ]);

    const signals = signalsResult?.data || [];

    // Weekly mastery deltas — count answer_result == 1 per week for last 8 weeks
    const weeklyMasteryDeltas: number[] = [];
    const now = new Date();
    for (let w = 0; w < 8; w++) {
      const weekStart = new Date(now.getTime() - (w + 1) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000);
      const weekSignals = signals.filter((s: any) => {
        if (s.signal_type !== 'answer_result') return false;
        const d = new Date(s.created_at);
        return d >= weekStart && d < weekEnd && s.value === 1;
      });
      // Approximate "mastered this week" as count of correct answers / 5
      // (we don't have perfect mastery-delta data, this is a proxy)
      weeklyMasteryDeltas.push(weekSignals.length / 5);
    }
    weeklyMasteryDeltas.reverse(); // chronological

    // Recent accuracy from last 30 days
    const recentAnswers = signals.filter((s: any) =>
      s.signal_type === 'answer_result' &&
      new Date(s.created_at) >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    );
    const recentAccuracy = recentAnswers.length > 0
      ? recentAnswers.reduce((sum: number, s: any) => sum + s.value, 0) / recentAnswers.length
      : 0.5;

    // Active minutes per day (rough estimate from stats)
    const totalMinutes = statsResult?.data?.total_time_spent_minutes || 0;
    const activeMinutesPerDay = Math.min(Math.round(totalMinutes / 30), 180); // cap at 3hr

    const forecast = forecastReadiness({
      examType,
      examTargetDate: targetDate,
      masteryMaps,
      weeklyMasteryDeltas,
      recentAccuracy,
      activeMinutesPerDay,
    });

    return NextResponse.json({ success: true, forecast });
  } catch (error: any) {
    console.error('Exam-readiness error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
