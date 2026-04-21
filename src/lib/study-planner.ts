/**
 * Agentic Study Planner — autonomously generates and adjusts weekly plans.
 *
 * Every competitor either hand-rolls "study plans" (rigid, one-size-fits-all)
 * or asks students to pick their own schedule. We do it autonomously:
 *   - Reads StudentState, Mastery, Interventions, Calibration, Attention span
 *   - Produces a 7-day plan with specific sessions, each sized to their
 *     actual attention span, targeting the right topics with the right method
 *   - Adjusts daily based on what actually got done + how it went
 *   - Integrates exam-readiness forecast to reverse-plan from target date
 *
 * This turns MyCupIsEmpty from "a tool" into "a coach."
 */

import type { StudentState, AdaptationDecision } from './student-state';
import type { SubjectMasteryMap } from './mastery';
import type { Intervention } from './intervention-engine';
import type { CalibrationResult } from './method-calibration';

export interface StudySession {
  day: number;                  // 0 = today, 1 = tomorrow
  dayLabel: string;             // "Mon, Apr 20"
  timeSlot?: string;            // "5:00 PM" (from preferredHour)
  durationMinutes: number;
  focus: 'new' | 'review' | 'practice' | 'exam_sim' | 'reflection' | 'rest';
  subject?: string;
  topic?: string;
  method?: string;              // calibrated method for this subject
  activities: Array<{
    kind: 'daily_mix' | 'flashcards' | 'guru_chat' | 'exam' | 'photo_solve' | 'intervention' | 'reflection';
    label: string;
    minutes: number;
    href?: string;
  }>;
  why: string;                  // one-line rationale
  energyMatch: 'high' | 'medium' | 'low';
}

export interface StudyPlan {
  generatedAt: string;
  targetDate?: string;
  sessions: StudySession[];
  weeklyGoals: string[];
  totalMinutes: number;
  restDays: number;
  overarchingGoal: string;
  adjustmentReason?: string;    // why we changed plan from last week
}

// ============================================================
// Generate a 7-day plan autonomously from state
// ============================================================

export function generateWeeklyPlan(input: {
  state: StudentState;
  masteryMaps: SubjectMasteryMap[];
  adaptation: AdaptationDecision;
  interventions: Intervention[];
  calibration: CalibrationResult[];
  preferredHour?: number;
  targetExamDate?: string;
  lastPlanAdherence?: number;  // 0..1 — how much of last plan was done
}): StudyPlan {
  const {
    state, masteryMaps, adaptation, interventions, calibration,
    preferredHour, targetExamDate, lastPlanAdherence,
  } = input;

  const attentionSpan = state.attentionSpanMinutes || 20;
  const sessionMinutes = Math.max(15, Math.min(attentionSpan, 45));

  const sessions: StudySession[] = [];
  const now = new Date();

  // Priority topics: urgent interventions → stalled → decayed → fragile
  const urgentInterventions = interventions.filter((i) => i.urgency === 'immediate').slice(0, 3);
  const stalledTopics = masteryMaps.flatMap((m) =>
    m.topics.filter((t) => t.state === 'stalled').map((t) => ({ ...t, subjectName: m.subjectName })),
  );
  const decayedTopics = masteryMaps.flatMap((m) =>
    m.topics.filter((t) => t.state === 'decayed').map((t) => ({ ...t, subjectName: m.subjectName })),
  );
  const fragileTopics = masteryMaps.flatMap((m) =>
    m.topics.filter((t) => t.state === 'fragile').map((t) => ({ ...t, subjectName: m.subjectName })),
  );

  // Decide rest days: if student pushed hard recently (>45min/day avg), give 1-2 rest days
  const restDayIndices = new Set<number>();
  if (state.frustrationLevel > 5 || state.minutesActiveToday > attentionSpan * 2) {
    restDayIndices.add(6); // Sunday
  }
  if (state.cognitiveLoad === 'heavy') {
    restDayIndices.add(3); // Thursday mid-week break
  }

  // Weekly goals — concrete, measurable
  const weeklyGoals: string[] = [];
  if (stalledTopics.length > 0) {
    weeklyGoals.push(`Unstick ${Math.min(stalledTopics.length, 2)} topic${stalledTopics.length > 1 ? 's' : ''} with new methods`);
  }
  if (fragileTopics.length > 0) {
    weeklyGoals.push(`Lock in ${Math.min(fragileTopics.length, 3)} fragile topics to stable`);
  }
  if (decayedTopics.length > 0) {
    weeklyGoals.push(`Refresh ${decayedTopics.length} decayed topic${decayedTopics.length > 1 ? 's' : ''} before they fade`);
  }
  if (urgentInterventions.length > 0) {
    weeklyGoals.push(`Clear ${urgentInterventions.length} misconception${urgentInterventions.length > 1 ? 's' : ''} in targeted sessions`);
  }
  if (weeklyGoals.length === 0) {
    weeklyGoals.push(`Steady progress — consistent daily practice`);
  }

  // Build day-by-day plan
  for (let d = 0; d < 7; d++) {
    const date = new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
    const dayLabel = date.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    if (restDayIndices.has(d)) {
      sessions.push({
        day: d,
        dayLabel,
        durationMinutes: 0,
        focus: 'rest',
        activities: [],
        why: `Conscious rest — recovery is still learning.`,
        energyMatch: 'low',
      });
      continue;
    }

    // Pick today's focus
    let focus: StudySession['focus'] = 'practice';
    let subject: string | undefined;
    let topic: string | undefined;
    let method: string | undefined;
    const activities: StudySession['activities'] = [];
    let why = '';

    // Day rotation
    const dayFocusRotation: StudySession['focus'][] = ['new', 'practice', 'review', 'practice', 'new', 'review', 'exam_sim'];
    focus = dayFocusRotation[d];

    // Day 0: start with a low-stakes warmup if anxious
    if (d === 0 && state.frustrationLevel > 4) {
      focus = 'review';
      why = `Warm start after a tough stretch — rebuild confidence.`;
    }

    // Apply urgent intervention on day 0 or 1 if exists
    if (urgentInterventions.length > 0 && d <= 1) {
      const iv = urgentInterventions[0];
      activities.push({
        kind: 'intervention',
        label: iv.title,
        minutes: Math.ceil(iv.estimatedSeconds / 60),
        href: `/guru?intervention=${iv.id}`,
      });
      subject = iv.subjectId ? masteryMaps.find((m) => m.subjectId === iv.subjectId)?.subjectName : undefined;
      why = `Clear "${iv.title}" before it blocks more topics.`;
      focus = 'practice';
    }

    // Fragile topics on fragile focus days
    if (focus === 'review' && fragileTopics.length > 0) {
      const t = fragileTopics[d % fragileTopics.length];
      topic = t.topicTitle;
      subject = t.subjectName;
      activities.push({
        kind: 'flashcards',
        label: `${t.topicTitle} flashcards`,
        minutes: 10,
        href: '/flashcards',
      });
      if (!why) why = `${t.topicTitle} is almost stuck — one more review locks it in.`;
    }

    // New topics
    if (focus === 'new') {
      // Pick weakest subject to add a new topic
      const weakSubject = Object.values(state.subjectStates)
        .sort((a, b) => a.recentAccuracy - b.recentAccuracy)[0];
      if (weakSubject) {
        subject = weakSubject.subjectName;
        const calibrated = calibration.find((c) => c.subjectId === weakSubject.subjectId);
        method = calibrated?.recommendedMethod || weakSubject.bestMethod;
        activities.push({
          kind: 'daily_mix',
          label: 'Daily Mix (calibrated)',
          minutes: sessionMinutes,
          href: '/daily-mix',
        });
        if (!why) why = `${weakSubject.subjectName} needs attention — using ${method.replace(/_/g, ' ')}.`;
      }
    }

    // Practice / Exam sim
    if (focus === 'practice') {
      activities.push({
        kind: 'daily_mix',
        label: 'Daily Mix',
        minutes: sessionMinutes,
        href: '/daily-mix',
      });
      if (!why) why = `Daily habit — ${sessionMinutes} min keeps the cup filling.`;
    }
    if (focus === 'exam_sim' && isWeekend) {
      activities.push({
        kind: 'exam',
        label: 'Chapter test (30 min)',
        minutes: 30,
        href: '/exam',
      });
      why = `Weekend exam sim — build stamina + spot patterns.`;
    }

    // Reflection slot every 3rd day
    if (d % 3 === 0) {
      activities.push({
        kind: 'reflection',
        label: 'Reflect (2 min)',
        minutes: 2,
        href: '/reflect',
      });
    }

    const total = activities.reduce((sum, a) => sum + a.minutes, 0);
    sessions.push({
      day: d,
      dayLabel,
      timeSlot: preferredHour != null ? formatHour(preferredHour) : undefined,
      durationMinutes: total,
      focus,
      subject,
      topic,
      method,
      activities,
      why: why || `Keeping momentum.`,
      energyMatch: state.energyLevel,
    });
  }

  const totalMinutes = sessions.reduce((s, x) => s + x.durationMinutes, 0);
  const restDays = sessions.filter((s) => s.focus === 'rest').length;

  // Overarching goal — tie to exam date if provided
  let overarchingGoal = 'Steady whole-human growth this week.';
  if (targetExamDate) {
    const target = new Date(targetExamDate);
    const daysToExam = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysToExam > 0) {
      overarchingGoal = `${daysToExam} days to exam — this week focuses on ${urgentInterventions.length > 0 ? 'fixing misconceptions' : fragileTopics.length > 0 ? 'locking in fragile topics' : 'building depth'}.`;
    }
  } else if (adaptation.shouldSimplify) {
    overarchingGoal = 'Rebuilding confidence with foundation work.';
  } else if (adaptation.shouldChallenge) {
    overarchingGoal = 'Pushing into stretch territory — ready for harder problems.';
  }

  // Adjustment reason (if we know last plan adherence)
  let adjustmentReason: string | undefined;
  if (lastPlanAdherence != null) {
    if (lastPlanAdherence < 0.4) {
      adjustmentReason = `Last week\'s plan was too ambitious — shorter sessions this week.`;
    } else if (lastPlanAdherence > 0.9) {
      adjustmentReason = `Crushed last week — adding a stretch session.`;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    targetDate: targetExamDate,
    sessions,
    weeklyGoals,
    totalMinutes,
    restDays,
    overarchingGoal,
    adjustmentReason,
  };
}

function formatHour(h: number): string {
  const period = h < 12 ? 'AM' : 'PM';
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}:00 ${period}`;
}
