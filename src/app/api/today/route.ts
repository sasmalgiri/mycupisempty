/**
 * Today API — the single ordered queue for the student's day.
 *
 * Assembles the conductor's inputs (probes, review debt, the exam plan's next
 * units, attention span) and returns one flat list of steps with no choices
 * in it.
 *
 * It does NOT replace Daily Mix or flashcards — steps link out to those. The
 * job here is deciding what comes next and why, which is the thing nothing
 * else in the app owns.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { buildDailyFlow, type FlowUnit } from '@/lib/daily-flow';
import { buildExamPlan } from '@/lib/exam-plan-store';
import { dueRetentionProbes } from '@/lib/conversion-store';
import { estimateMixForSubject } from '@/lib/exam-back-planner';
import { DEFAULT_UNIT_COSTS } from '@/lib/exam-back-planner';
import { KNOWLEDGE_TYPES, type KnowledgeType } from '@/lib/conversion-engine';

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const today = url.searchParams.get('today') || new Date().toISOString().slice(0, 10);

    // Minutes she actually has today — the caller may pass "I've got 20 mins".
    const minutesOverride = Number(url.searchParams.get('minutes')) || null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_class, board_code, full_name')
      .eq('id', user.id)
      .maybeSingle();

    const { data: enrolment } = await supabase
      .from('course_enrollments')
      .select('weekly_minutes_target, target_completion_date')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('enrolled_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const weeklyMinutesTarget = enrolment?.weekly_minutes_target || 300;
    const minutesAvailable = minutesOverride ?? Math.round(weeklyMinutesTarget / 7);

    // --- Gather in parallel ----------------------------------------------
    const [probes, reviewDueCount, planResult, restDay, lastReflection, attentionSpan] =
      await Promise.all([
        dueRetentionProbes(supabase, user.id, 6),
        countReviewDue(supabase, user.id),
        buildExamPlan(supabase, {
          userId: user.id,
          examDate: enrolment?.target_completion_date || undefined,
          weeklyMinutesTarget,
          classLevel: profile?.current_class ?? 10,
          boardCode: profile?.board_code || undefined,
          today,
        }),
        isRestDay(supabase, user.id, today),
        lastReflectionDate(supabase, user.id),
        loadAttentionSpan(supabase, user.id),
      ]);

    // --- Turn the plan's next chapters into today's units ----------------
    const availableUnits = await nextUnits(supabase, planResult, user.id);

    const flow = buildDailyFlow({
      today,
      minutesAvailable,
      attentionSpanMinutes: attentionSpan,
      probesDue: probes.map((p: any) => ({
        outcomeId: p.outcome_id || p.id,
        question: p.question || 'Can you still do this one, unaided?',
        knowledgeType: p.knowledge_type,
      })),
      reviewDueCount,
      availableUnits,
      examVerdict: planResult.plan?.verdict,
      weeksToExam: planResult.plan?.weeksAvailable,
      lastReflectionDate: lastReflection,
      isRestDay: restDay,
    });

    return NextResponse.json({
      success: true,
      today,
      studentName: profile?.full_name || null,
      minutesAvailable,
      flow,
      exam: planResult.plan
        ? {
            date: planResult.examDate,
            title: planResult.examTitle,
            verdict: planResult.plan.verdict,
            weeksAvailable: planResult.plan.weeksAvailable,
            marksCovered: planResult.plan.marksCovered,
            marksAtRisk: planResult.plan.marksAtRisk,
            message: planResult.plan.message,
          }
        : null,
    });
  } catch (error: any) {
    console.error('Today GET error:', error);
    return NextResponse.json({ error: error.message || 'Could not build today' }, { status: 500 });
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * How many spaced-repetition items are due.
 *
 * Tries the FSRS/retrieval queue and degrades to zero rather than erroring —
 * a missing review table should mean "nothing to review", not a broken day.
 */
async function countReviewDue(supabase: any, userId: string): Promise<number> {
  const nowIso = new Date().toISOString();
  for (const table of ['retrieval_queue', 'flashcards']) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .lte('next_review_at', nowIso);
      if (!error && typeof count === 'number') return count;
    } catch {
      // try the next one
    }
  }
  return 0;
}

/**
 * rest_days holds one row per user with the date of the last rest day taken,
 * not a row per rest day — so "is today a rest day" is a match on that date.
 */
async function isRestDay(supabase: any, userId: string, today: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('rest_days')
      .select('last_used_date')
      .eq('user_id', userId)
      .maybeSingle();
    return !!data?.last_used_date && String(data.last_used_date).slice(0, 10) === today;
  } catch {
    return false;
  }
}

async function lastReflectionDate(supabase: any, userId: string): Promise<string | undefined> {
  try {
    const { data } = await supabase
      .from('session_reflections')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.created_at ? String(data.created_at).slice(0, 10) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Observed attention span.
 *
 * Median of her recent session lengths rather than the mean — one marathon
 * revision session should not convince the app she can sit for an hour.
 */
async function loadAttentionSpan(supabase: any, userId: string): Promise<number> {
  try {
    const { data } = await supabase
      .from('conversion_outcomes')
      .select('time_spent_seconds')
      .eq('user_id', userId)
      .gt('time_spent_seconds', 60)
      .lt('time_spent_seconds', 5400)
      .order('created_at', { ascending: false })
      .limit(40);
    const mins = (data || []).map((r: any) => Number(r.time_spent_seconds) / 60).sort((a: number, b: number) => a - b);
    if (mins.length < 5) return 20;
    const mid = Math.floor(mins.length / 2);
    const median = mins.length % 2 ? mins[mid] : (mins[mid - 1] + mins[mid]) / 2;
    return Math.max(8, Math.min(45, Math.round(median * 1.5)));
  } catch {
    return 20;
  }
}

/**
 * The next teachable units, in the exam plan's triage order.
 *
 * Reads cached classifications where a chapter has been taught before, so the
 * knowledge type is real. For an unopened chapter we do not invent unit-level
 * types — we emit one placeholder per chapter using the subject's dominant
 * type, and /teach does the real classification when she opens it.
 */
async function nextUnits(supabase: any, planResult: any, userId: string): Promise<FlowUnit[]> {
  const plan = planResult?.plan;
  if (!plan) return [];

  // Chapters worth doing next: highest triage rank, not yet finished.
  const candidates = plan.included
    .filter((a: any) => (a.chapter.currentMastery ?? 0) < 0.85)
    .slice(0, 4);
  if (candidates.length === 0) return [];

  const chapterIds = candidates.map((a: any) => a.chapter.id);

  // Which units has she already done?
  const done = new Set<string>();
  try {
    const { data } = await supabase
      .from('conversion_outcomes')
      .select('unit_id')
      .eq('user_id', userId)
      .in('chapter_id', chapterIds)
      .limit(2000);
    for (const r of data || []) if (r.unit_id) done.add(r.unit_id);
  } catch {
    // treat as none done
  }

  // Real classified units, where they exist.
  const classified = new Map<string, Array<{ unitId: string; type: KnowledgeType; topicId?: string }>>();
  try {
    const { data } = await supabase
      .from('content_classifications')
      .select('chapter_id, topic_id, unit_id, knowledge_type')
      .in('chapter_id', chapterIds)
      .limit(2000);
    for (const r of data || []) {
      if (!r.chapter_id || done.has(r.unit_id)) continue;
      const t = r.knowledge_type as KnowledgeType;
      if (!KNOWLEDGE_TYPES.includes(t)) continue;
      if (!classified.has(r.chapter_id)) classified.set(r.chapter_id, []);
      classified.get(r.chapter_id)!.push({ unitId: r.unit_id, type: t, topicId: r.topic_id });
    }
  } catch {
    // fall through to placeholders
  }

  const out: FlowUnit[] = [];
  for (const a of candidates) {
    const ch = a.chapter;
    const real = classified.get(ch.id) || [];

    if (real.length > 0) {
      for (const u of real.slice(0, 4)) {
        out.push({
          unitId: u.unitId,
          topicId: u.topicId,
          chapterId: ch.id,
          chapterTitle: ch.title,
          subjectName: ch.subjectName,
          knowledgeType: u.type,
          marksAtStake: a.marksAtStake,
          estimatedMinutes: DEFAULT_UNIT_COSTS[u.type].teach,
        });
      }
    } else {
      // Never taught — one placeholder, typed by the subject's dominant kind.
      const mix = estimateMixForSubject(ch.subjectName.toLowerCase().replace(/\s+/g, '_'));
      const dominant = (KNOWLEDGE_TYPES
        .map((t) => [t, mix[t] ?? 0] as const)
        .sort((x, y) => y[1] - x[1])[0]?.[0]) || 'concept';
      out.push({
        unitId: `${ch.id.slice(0, 8)}-next`,
        chapterId: ch.id,
        chapterTitle: ch.title,
        subjectName: ch.subjectName,
        knowledgeType: dominant,
        marksAtStake: a.marksAtStake,
        estimatedMinutes: DEFAULT_UNIT_COSTS[dominant].teach,
      });
    }
  }

  return out;
}
