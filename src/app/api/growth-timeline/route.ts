/**
 * Growth Timeline API — whole-human growth across 4 dimensions over time.
 *
 * Parents want to see: "My child isn't just getting better at Math.
 *   Their patience is growing. Their reflection is deeper. Their
 *   communication is sharper."
 *
 * Returns month-by-month snapshots across:
 *   - Academic (per-subject mastery count + accuracy)
 *   - Cognitive (focus, memory, reasoning, problem-solving, reflection,
 *                decision-making, self-learning, curiosity)
 *   - Character (discipline, patience, honesty, empathy, responsibility,
 *                consistency, failure-handling, confidence, emotional-reg,
 *                social-conduct)
 *   - Life Readiness (communication, financial, digital-safety,
 *                     time-management, real-world, career, teamwork, practical)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

interface MonthSnapshot {
  month: string;                 // "2026-03"
  label: string;                 // "March 2026"
  academic: {
    topicsTouched: number;
    topicsMastered: number;
    avgAccuracy: number;
    sessionsCompleted: number;
    minutesStudied: number;
    subjectBreakdown: Array<{
      subject: string;
      mastered: number;
      accuracy: number;
    }>;
  };
  cognitive: {
    composite: number;           // 0-100
    dimensions: Record<string, number>;
    topGrowth: string[];
  };
  character: {
    composite: number;
    dimensions: Record<string, number>;
    topGrowth: string[];
    habitsCompleted: number;
    longestStreak: number;
    reflections: number;
  };
  lifeReadiness: {
    composite: number;
    dimensions: Record<string, number>;
    topGrowth: string[];
  };
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(d: Date): string {
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

export async function GET(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const studentId = url.searchParams.get('studentId') || user.id;
    const months = Math.min(parseInt(url.searchParams.get('months') || '6', 10), 12);

    // Parent view — verify link
    if (studentId !== user.id) {
      const { data: link } = await supabase
        .from('parent_student_links')
        .select('*')
        .eq('parent_id', user.id)
        .eq('student_id', studentId)
        .maybeSingle();
      if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    // Parallel fetch of all needed tables
    const [
      answersResult,
      sessionsResult,
      signalsResult,
      habitResult,
      reflectionResult,
      devProfileResult,
      outcomeSnapshotsResult,
      masteryResult,
    ] = await Promise.all([
      supabase.from('user_answers')
        .select('created_at, is_correct, topic_id, topics(subject_id, subjects(title))')
        .eq('user_id', studentId)
        .gte('created_at', startDate.toISOString())
        .catch(() => ({ data: [] })),
      supabase.from('daily_mix_sessions')
        .select('session_date, completed_at, xp_earned, status')
        .eq('user_id', studentId)
        .gte('session_date', startDate.toISOString().split('T')[0])
        .catch(() => ({ data: [] })),
      supabase.from('learner_signals')
        .select('signal_type, category, value, metadata, created_at')
        .eq('user_id', studentId)
        .gte('created_at', startDate.toISOString())
        .catch(() => ({ data: [] })),
      supabase.from('habit_completions')
        .select('completed_on, user_id')
        .eq('user_id', studentId)
        .gte('completed_on', startDate.toISOString().split('T')[0])
        .catch(() => ({ data: [] })),
      supabase.from('reflection_entries')
        .select('created_at, reflection_type')
        .eq('user_id', studentId)
        .gte('created_at', startDate.toISOString())
        .catch(() => ({ data: [] })),
      supabase.from('student_development_profile')
        .select('*')
        .eq('user_id', studentId)
        .single()
        .catch(() => ({ data: null })),
      supabase.from('outcome_snapshots')
        .select('*')
        .eq('user_id', studentId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true })
        .catch(() => ({ data: [] })),
      supabase.from('learner_state')
        .select('current_band, last_active_at, topics(subject_id, subjects(title))')
        .eq('user_id', studentId)
        .catch(() => ({ data: [] })),
    ]);

    const answers = answersResult?.data || [];
    const sessions = sessionsResult?.data || [];
    const signals = signalsResult?.data || [];
    const habits = habitResult?.data || [];
    const reflections = reflectionResult?.data || [];
    const devProfile = devProfileResult?.data;
    const snapshots = outcomeSnapshotsResult?.data || [];
    const mastery = masteryResult?.data || [];

    // Build month buckets
    const timeline: MonthSnapshot[] = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
      const key = monthKey(d);
      const label = monthLabel(d);

      // Academic
      const monthAnswers = answers.filter((a: any) => monthKey(new Date(a.created_at)) === key);
      const monthSessions = sessions.filter((s: any) => monthKey(new Date(s.session_date)) === key);
      const monthTimeSignals = signals.filter((s: any) =>
        monthKey(new Date(s.created_at)) === key &&
        (s.signal_type === 'time_spent' || s.signal_type === 'step_time'),
      );
      const minutesStudied = Math.round(
        monthTimeSignals.reduce((sum: number, s: any) => sum + (s.value || 0), 0) / 60,
      );
      const correct = monthAnswers.filter((a: any) => a.is_correct).length;
      const total = monthAnswers.length;
      const avgAccuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

      // Per-subject breakdown this month
      const subjectGroups: Record<string, { mastered: number; correct: number; total: number }> = {};
      monthAnswers.forEach((a: any) => {
        const sname = a.topics?.subjects?.title || 'Unknown';
        if (!subjectGroups[sname]) subjectGroups[sname] = { mastered: 0, correct: 0, total: 0 };
        subjectGroups[sname].total++;
        if (a.is_correct) subjectGroups[sname].correct++;
      });
      mastery.forEach((m: any) => {
        if (m.last_active_at && monthKey(new Date(m.last_active_at)) === key) {
          const sname = m.topics?.subjects?.title || 'Unknown';
          if (!subjectGroups[sname]) subjectGroups[sname] = { mastered: 0, correct: 0, total: 0 };
          if (m.current_band === 'advanced' || m.current_band === 'secure') {
            subjectGroups[sname].mastered++;
          }
        }
      });

      const subjectBreakdown = Object.entries(subjectGroups).map(([subject, v]) => ({
        subject,
        mastered: v.mastered,
        accuracy: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
      }));

      // Cognitive/Character/LifeReadiness — use snapshots if available, else current profile
      const monthSnapshot = [...snapshots].reverse().find((s: any) => new Date(s.created_at) <= d);
      const sourceDev = monthSnapshot?.scores || devProfile || {};

      const cognitiveDims: Record<string, number> = {};
      const characterDims: Record<string, number> = {};
      const lifeDims: Record<string, number> = {};

      const cogKeys = ['focus', 'memory_habits', 'reasoning', 'problem_solving', 'reflection', 'decision_making', 'self_learning', 'curiosity'];
      const charKeys = ['discipline', 'patience', 'honesty', 'empathy', 'responsibility', 'consistency', 'failure_handling', 'confidence', 'emotional_regulation', 'social_conduct'];
      const lifeKeys = ['communication', 'financial_awareness', 'digital_safety', 'time_management', 'real_world_problem_solving', 'career_awareness', 'teamwork', 'practical_skills'];

      cogKeys.forEach((k) => { cognitiveDims[k] = sourceDev[`${k}_score`] ?? sourceDev[k] ?? 50; });
      charKeys.forEach((k) => { characterDims[k] = sourceDev[`${k}_score`] ?? sourceDev[k] ?? 50; });
      lifeKeys.forEach((k) => { lifeDims[k] = sourceDev[`${k}_score`] ?? sourceDev[k] ?? 50; });

      const avgCog = Math.round(Object.values(cognitiveDims).reduce((s, v) => s + v, 0) / cogKeys.length);
      const avgChar = Math.round(Object.values(characterDims).reduce((s, v) => s + v, 0) / charKeys.length);
      const avgLife = Math.round(Object.values(lifeDims).reduce((s, v) => s + v, 0) / lifeKeys.length);

      // Top growth vs previous month
      const prev = timeline[timeline.length - 1];
      const topGrowth = (current: Record<string, number>, previous?: Record<string, number>): string[] => {
        if (!previous) return [];
        const deltas = Object.entries(current).map(([k, v]) => ({ k, d: v - (previous[k] ?? 0) }));
        return deltas.filter((x) => x.d > 1).sort((a, b) => b.d - a.d).slice(0, 3).map((x) => x.k.replace(/_/g, ' '));
      };

      // Habits & reflections for character snapshot
      const monthHabits = habits.filter((h: any) => monthKey(new Date(h.completed_on)) === key).length;
      const monthReflections = reflections.filter((r: any) => monthKey(new Date(r.created_at)) === key).length;

      // Compute longest streak within this month (rough)
      const habitDates = habits
        .filter((h: any) => monthKey(new Date(h.completed_on)) === key)
        .map((h: any) => h.completed_on)
        .sort();
      let longestStreak = 0, current = 0, lastDate = '';
      for (const dt of habitDates) {
        if (lastDate) {
          const gap = Math.round((new Date(dt).getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
          if (gap === 1) current++;
          else { longestStreak = Math.max(longestStreak, current); current = 1; }
        } else { current = 1; }
        lastDate = dt;
      }
      longestStreak = Math.max(longestStreak, current);

      timeline.push({
        month: key,
        label,
        academic: {
          topicsTouched: new Set(monthAnswers.map((a: any) => a.topic_id)).size,
          topicsMastered: subjectBreakdown.reduce((sum, s) => sum + s.mastered, 0),
          avgAccuracy,
          sessionsCompleted: monthSessions.filter((s: any) => s.status === 'completed').length,
          minutesStudied,
          subjectBreakdown,
        },
        cognitive: {
          composite: avgCog,
          dimensions: cognitiveDims,
          topGrowth: topGrowth(cognitiveDims, prev?.cognitive.dimensions),
        },
        character: {
          composite: avgChar,
          dimensions: characterDims,
          topGrowth: topGrowth(characterDims, prev?.character.dimensions),
          habitsCompleted: monthHabits,
          longestStreak,
          reflections: monthReflections,
        },
        lifeReadiness: {
          composite: avgLife,
          dimensions: lifeDims,
          topGrowth: topGrowth(lifeDims, prev?.lifeReadiness.dimensions),
        },
      });
    }

    // Overall headline — compare first and last month
    const first = timeline[0];
    const last = timeline[timeline.length - 1];
    const headline = first && last ? buildHeadline(first, last) : 'Your growth timeline is just beginning.';

    return NextResponse.json({
      success: true,
      studentId,
      periodMonths: months,
      timeline,
      headline,
      latest: last,
      growthDeltas: first && last ? {
        academic: last.academic.avgAccuracy - first.academic.avgAccuracy,
        cognitive: last.cognitive.composite - first.cognitive.composite,
        character: last.character.composite - first.character.composite,
        lifeReadiness: last.lifeReadiness.composite - first.lifeReadiness.composite,
      } : null,
    });
  } catch (error: any) {
    console.error('Growth timeline error:', error);
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}

function buildHeadline(first: MonthSnapshot, last: MonthSnapshot): string {
  const cogDelta = last.cognitive.composite - first.cognitive.composite;
  const charDelta = last.character.composite - first.character.composite;
  const accDelta = last.academic.avgAccuracy - first.academic.avgAccuracy;

  const deltas = [
    { name: 'academic understanding', d: accDelta },
    { name: 'cognitive strength', d: cogDelta },
    { name: 'character', d: charDelta },
  ].filter((x) => x.d > 2).sort((a, b) => b.d - a.d);

  if (deltas.length === 0) {
    return `Over the last ${last.month === first.month ? 'month' : 'few months'}, growth is steady — the cup is filling.`;
  }
  if (deltas.length === 1) {
    return `Biggest growth: ${deltas[0].name} (+${deltas[0].d}).`;
  }
  return `Biggest growth: ${deltas[0].name} (+${deltas[0].d}) and ${deltas[1].name} (+${deltas[1].d}). Not just academics — a whole person is growing.`;
}
