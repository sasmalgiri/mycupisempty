/**
 * Streak + freeze logic. Pure functions; persistence in /api/streak.
 *
 * Rules:
 *   - active_today: any session_completion or exit_eval ticks the streak
 *   - earn_freeze: every 7 days streak (current_streak % 7 === 0 AND it just ticked)
 *   - max stored freezes: 3 (Duolingo's cap; prevents hoarding)
 *   - missed_day → if a freeze is available, auto-consume one and keep streak
 *   - missed_day && no freeze → reset to 0
 *
 * Cohort matching: cohort_key = `${board}-class-${class}-${language}`. New
 * leagues are created lazily when the first member of a cohort is assigned
 * for a given week.
 */

const MAX_FREEZES = 3;

export interface StreakState {
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;     // 'YYYY-MM-DD'
  freezes_available: number;
  freezes_used_total: number;
  honesty_xp: number;
}

export interface StreakUpdate {
  state: StreakState;
  /** Human-readable summary of what just happened — for UI feedback. */
  delta: {
    streakChanged: boolean;
    streakIncreased: boolean;
    freezeUsed: boolean;
    freezeEarned: boolean;
    streakReset: boolean;
    note: string;
  };
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function dayDiff(a: string | null, b: string): number {
  if (!a) return Infinity;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

/**
 * Apply a "session completed today" tick. Pure — caller persists the result.
 */
export function tickStreak(prev: StreakState | null): StreakUpdate {
  const today = todayISO();
  const cur: StreakState = prev || {
    current_streak: 0, longest_streak: 0, last_active_date: null,
    freezes_available: 0, freezes_used_total: 0, honesty_xp: 0,
  };

  const gap = dayDiff(cur.last_active_date, today);

  if (gap === 0) {
    return {
      state: cur,
      delta: { streakChanged: false, streakIncreased: false, freezeUsed: false, freezeEarned: false, streakReset: false, note: 'Already active today.' },
    };
  }

  if (gap === 1) {
    const next = cur.current_streak + 1;
    const earnedFreeze = next > 0 && next % 7 === 0 && cur.freezes_available < MAX_FREEZES;
    return {
      state: {
        ...cur,
        current_streak: next,
        longest_streak: Math.max(cur.longest_streak, next),
        last_active_date: today,
        freezes_available: earnedFreeze ? cur.freezes_available + 1 : cur.freezes_available,
      },
      delta: {
        streakChanged: true, streakIncreased: true, freezeUsed: false,
        freezeEarned: earnedFreeze, streakReset: false,
        note: earnedFreeze ? `${next}-day streak — and a streak freeze for the week ahead.` : `${next}-day streak.`,
      },
    };
  }

  // Gap >= 2: missed yesterday. Try to consume freezes.
  const missedDays = gap - 1;
  if (cur.freezes_available >= missedDays) {
    // Use freezes to bridge the missed days, then tick today.
    const next = cur.current_streak + 1;
    return {
      state: {
        ...cur,
        current_streak: next,
        longest_streak: Math.max(cur.longest_streak, next),
        last_active_date: today,
        freezes_available: cur.freezes_available - missedDays,
        freezes_used_total: cur.freezes_used_total + missedDays,
      },
      delta: {
        streakChanged: true, streakIncreased: true, freezeUsed: true, freezeEarned: false, streakReset: false,
        note: `Streak freeze${missedDays > 1 ? 's' : ''} kept your run alive. Now ${next} days.`,
      },
    };
  }

  // No freeze coverage — reset.
  return {
    state: {
      ...cur,
      current_streak: 1,
      last_active_date: today,
      // Honesty: don't snap longest down.
      longest_streak: cur.longest_streak,
    },
    delta: {
      streakChanged: true, streakIncreased: true, freezeUsed: false, freezeEarned: false, streakReset: true,
      note: 'Fresh start — back to day 1. Past streak isn\'t lost on the record.',
    },
  };
}

// ----------------------------------------------------------------------------
// Weekly league cohort + tier helpers.
// ----------------------------------------------------------------------------

export const LEAGUE_TIERS = [
  { tier: 1,  name: 'Bronze',     icon: '🥉' },
  { tier: 2,  name: 'Silver',     icon: '🥈' },
  { tier: 3,  name: 'Gold',       icon: '🥇' },
  { tier: 4,  name: 'Sapphire',   icon: '💎' },
  { tier: 5,  name: 'Ruby',       icon: '🔴' },
  { tier: 6,  name: 'Emerald',    icon: '🟢' },
  { tier: 7,  name: 'Topaz',      icon: '🟡' },
  { tier: 8,  name: 'Amethyst',   icon: '🟣' },
  { tier: 9,  name: 'Obsidian',   icon: '⚫' },
  { tier: 10, name: 'Diamond',    icon: '💠' },
];

export function tierMeta(tier: number) {
  return LEAGUE_TIERS.find((t) => t.tier === tier) || LEAGUE_TIERS[0];
}

/**
 * Decide a student's tier change after a week ends.
 *
 *   rank 1-3        → promote (tier + 1, capped at 10)
 *   rank ≥ size-2   → demote (tier - 1, floored at 1)
 *   inactive (xp=0) → demote even from tier 1: stays tier 1 (no minus)
 *   middle band     → stay
 *
 * Pure function so we can unit-test the rule.
 */
export function tierTransition(args: {
  currentTier: number;
  rank: number;            // 1-based rank within the league
  cohortSize: number;      // total participants
  weeklyXp: number;        // 0 means inactive
}): { newTier: number; reason: 'promote' | 'demote' | 'stay' | 'inactive' } {
  const t = Math.max(1, Math.min(10, Math.round(args.currentTier || 1)));
  if (args.weeklyXp <= 0) return { newTier: t, reason: 'inactive' };
  if (args.rank > 0 && args.rank <= 3) return { newTier: Math.min(10, t + 1), reason: 'promote' };
  if (args.cohortSize > 4 && args.rank >= args.cohortSize - 2) return { newTier: Math.max(1, t - 1), reason: 'demote' };
  return { newTier: t, reason: 'stay' };
}

export function cohortKey(args: { board: string | null; classLevel: number | null; language: string | null; schoolId?: string | null; section?: string | null }): string {
  const b = (args.board || 'cbse').toLowerCase().replace(/\s+/g, '_');
  const c = args.classLevel || 8;
  const l = (args.language || 'en').toLowerCase();
  // School-classroom cohort: when both school_id and class are known, the
  // cohort narrows to that school's class — students compete with their actual
  // classmates rather than an anonymous board-wide pool. Falls back to global
  // class+board+language cohort.
  if (args.schoolId) {
    const s = args.schoolId.replace(/-/g, '').slice(0, 12);
    const sec = (args.section || '').toLowerCase().slice(0, 4);
    return `school-${s}-class-${c}${sec ? `-${sec}` : ''}`;
  }
  return `${b}-class-${c}-${l}`;
}

export function thisWeekMonday(now: Date = new Date()): string {
  const d = new Date(now);
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;  // Monday-as-week-start
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

const ANON_HANDLES = [
  'BlueOwl', 'GoldFox', 'WildPanda', 'BraveTiger', 'SteadyHare', 'KindOtter',
  'SwiftDeer', 'CalmBear', 'CleverCrow', 'BoldRobin', 'MagicMoth', 'DeepWhale',
  'GreenLynx', 'SilverShark', 'WiseElephant', 'YoungEagle', 'PinkAxolotl',
];

export function generateAnonHandle(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const animal = ANON_HANDLES[Math.abs(h) % ANON_HANDLES.length];
  const num = Math.abs(h) % 1000;
  return `${animal}${num.toString().padStart(3, '0')}`;
}
