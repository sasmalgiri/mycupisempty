/**
 * Smart Study Reminders — adaptive, behavior-driven (not clock-driven).
 *
 * Duolingo famously sends "your friend will pass you if you don't study" at
 * 7PM — but the clock is hardcoded for everyone. Our rule: observe when THIS
 * student actually studies best, and nudge at that time.
 *
 * We also respect the founder's rule: don't ASK preferences. So we never pop
 * up "when do you want reminders?" We simply observe, adjust, and the student
 * can silence a reminder if they don't need it.
 */

export interface ReminderSchedule {
  userId: string;
  preferredHour: number;         // 0-23, computed from behavior
  weekdayHours: number[];        // hours where activity is observed on weekdays
  weekendHours: number[];        // weekends
  avgSessionDuration: number;    // minutes
  daysSinceLastSession: number;
  suggestedReminders: SmartReminder[];
}

export interface SmartReminder {
  type: 'habit_nudge' | 'streak_save' | 'fragile_review' | 'decay_refresh' | 'comeback' | 'exam_countdown';
  title: string;
  body: string;
  scheduledFor: string;          // ISO
  priority: 'high' | 'medium' | 'low';
  actionHref?: string;
  action: string;                // short verb
  reason: string;                // why we chose this nudge
}

// ============================================================
// Compute the student's natural study time from signals
// ============================================================

export function computeReminderSchedule(
  userId: string,
  signals: any[],
  state: {
    currentStreak?: number;
    lastActivityDate?: string;
    fragileTopicsCount?: number;
    decayedTopicsCount?: number;
    upcomingExamDays?: number;
  },
): ReminderSchedule {
  // Histogram of active hours — weekdays vs weekends separately
  const weekdayCounts: number[] = new Array(24).fill(0);
  const weekendCounts: number[] = new Array(24).fill(0);
  let totalSessions = 0;
  let totalDurationMinutes = 0;

  const sessionSignals = signals.filter((s: any) =>
    s.signal_type === 'step_time' ||
    s.signal_type === 'time_spent' ||
    s.signal_type === 'ai_guru_interaction' ||
    s.signal_type === 'ai_chat_interaction',
  );

  for (const s of sessionSignals) {
    const d = new Date(s.created_at);
    const hour = d.getHours();
    const day = d.getDay();
    if (day === 0 || day === 6) weekendCounts[hour]++;
    else weekdayCounts[hour]++;
    totalSessions++;
    if (s.signal_type === 'time_spent') {
      totalDurationMinutes += (s.value || 0) / 60;
    }
  }

  // Find peak hour
  const allCounts = weekdayCounts.map((v, i) => v + weekendCounts[i]);
  const peakHour = allCounts.indexOf(Math.max(...allCounts));

  // Top 3 weekday and weekend hours
  const topHours = (arr: number[], n = 3): number[] => {
    return arr
      .map((v, i) => ({ v, i }))
      .filter((x) => x.v > 0)
      .sort((a, b) => b.v - a.v)
      .slice(0, n)
      .map((x) => x.i);
  };

  const weekdayHours = topHours(weekdayCounts);
  const weekendHours = topHours(weekendCounts);

  const preferredHour = weekdayCounts.some((v) => v > 0) ? peakHour : 17; // default 5 PM
  const avgSessionDuration = totalSessions > 0 ? Math.round(totalDurationMinutes / totalSessions) : 15;

  const now = new Date();
  const lastActive = state.lastActivityDate ? new Date(state.lastActivityDate) : now;
  const daysSinceLastSession = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));

  // Schedule upcoming reminders
  const suggestedReminders: SmartReminder[] = [];

  // Next reminder slot: next occurrence of preferredHour today or tomorrow
  function nextSlot(hourOffset = 0): string {
    const target = new Date();
    target.setHours(preferredHour + hourOffset, 0, 0, 0);
    if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
    return target.toISOString();
  }

  // 1. Streak save (if streak > 3 and not studied today)
  if ((state.currentStreak ?? 0) >= 3 && daysSinceLastSession >= 1) {
    suggestedReminders.push({
      type: 'streak_save',
      title: `Save your ${state.currentStreak}-day streak 🔥`,
      body: `You've built real momentum. 10 minutes now keeps it alive.`,
      scheduledFor: nextSlot(),
      priority: 'high',
      actionHref: '/daily-mix',
      action: 'Start 10-min session',
      reason: `Streak at ${state.currentStreak} days, no activity today.`,
    });
  }

  // 2. Comeback (if > 3 days gone)
  if (daysSinceLastSession >= 3) {
    suggestedReminders.push({
      type: 'comeback',
      title: 'Your cup is waiting',
      body: `Life happens. Come back when you're ready — we'll pick up where you left off, no pressure.`,
      scheduledFor: nextSlot(),
      priority: 'medium',
      actionHref: '/daily-mix',
      action: 'Ease back in',
      reason: `${daysSinceLastSession} days since last session.`,
    });
  }

  // 3. Fragile review (if fragile topics exist)
  if ((state.fragileTopicsCount ?? 0) > 0) {
    suggestedReminders.push({
      type: 'fragile_review',
      title: `${state.fragileTopicsCount} topic${state.fragileTopicsCount === 1 ? '' : 's'} almost stuck — one more review`,
      body: `These are close to sticking permanently. A 5-minute review will lock them in.`,
      scheduledFor: nextSlot(),
      priority: 'medium',
      actionHref: '/flashcards',
      action: 'Review fragile topics',
      reason: `${state.fragileTopicsCount} fragile topics need reinforcement.`,
    });
  }

  // 4. Decay refresh (topics slipping)
  if ((state.decayedTopicsCount ?? 0) > 0) {
    suggestedReminders.push({
      type: 'decay_refresh',
      title: `${state.decayedTopicsCount} topic${state.decayedTopicsCount === 1 ? '' : 's'} fading — refresh now`,
      body: `You knew these once. A quick refresh brings them back faster than re-learning.`,
      scheduledFor: nextSlot(1), // 1 hour after peak
      priority: 'high',
      actionHref: '/progress',
      action: 'Refresh memory',
      reason: `${state.decayedTopicsCount} topics decayed past the forgetting curve.`,
    });
  }

  // 5. Exam countdown (if exam in <= 14 days)
  if (state.upcomingExamDays != null && state.upcomingExamDays > 0 && state.upcomingExamDays <= 14) {
    suggestedReminders.push({
      type: 'exam_countdown',
      title: `${state.upcomingExamDays} day${state.upcomingExamDays === 1 ? '' : 's'} to your exam`,
      body: `We've built a focused plan. ${avgSessionDuration} min today gets you ready.`,
      scheduledFor: nextSlot(),
      priority: 'high',
      actionHref: '/exam',
      action: 'Take mock test',
      reason: 'Exam approaching.',
    });
  }

  // 6. Habit nudge (if none of the above fired and student has a preferred hour)
  if (suggestedReminders.length === 0 && totalSessions > 10) {
    suggestedReminders.push({
      type: 'habit_nudge',
      title: 'Your cup is empty',
      body: `Usually you study around ${formatHour(preferredHour)}. A ${avgSessionDuration}-min session fits right in.`,
      scheduledFor: nextSlot(),
      priority: 'low',
      actionHref: '/daily-mix',
      action: 'Start Daily Mix',
      reason: 'Regular habit time.',
    });
  }

  return {
    userId,
    preferredHour,
    weekdayHours,
    weekendHours,
    avgSessionDuration,
    daysSinceLastSession,
    suggestedReminders,
  };
}

function formatHour(h: number): string {
  const period = h < 12 ? 'AM' : 'PM';
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display} ${period}`;
}
