/**
 * Leagues — weekly cohort leaderboards.
 *
 * Duolingo's Bronze-Silver-Gold-etc league system is a proven retention
 * driver: students care more about cohort-relative rank than raw XP.
 *
 * We implement it with three guardrails to keep it healthy (not toxic):
 *
 *   1. OPT-IN by default — no student gets thrown into a league without
 *      agreeing. We never surface a student's name publicly unless they
 *      joined.
 *
 *   2. PSEUDONYMOUS — we display the student's first name + a leaf emoji
 *      they pick, NOT their real identity. Matches how many Indian parents
 *      prefer privacy.
 *
 *   3. PROGRESS-WEIGHTED XP — XP weighs growth more than raw volume. This
 *      stops the league from rewarding "grind time" (which would burn kids
 *      out) and rewards actual learning.
 *
 * Weekly cadence: Monday 00:00 IST → Sunday 23:59 IST. Top 10% promote,
 * bottom 20% relegate (so weaker cohorts stay gentle).
 */

export type LeagueTier = 'sapling' | 'sprout' | 'bloom' | 'flourish' | 'canopy' | 'grove';

export const LEAGUE_TIERS: Record<LeagueTier, { label: string; icon: string; minWeeklyXP: number; color: string }> = {
  sapling:   { label: 'Sapling',   icon: '🌱', minWeeklyXP: 0,    color: '#94a3b8' },
  sprout:    { label: 'Sprout',    icon: '🌿', minWeeklyXP: 150,  color: '#22c55e' },
  bloom:     { label: 'Bloom',     icon: '🌸', minWeeklyXP: 400,  color: '#ec4899' },
  flourish:  { label: 'Flourish',  icon: '🌺', minWeeklyXP: 800,  color: '#f59e0b' },
  canopy:    { label: 'Canopy',    icon: '🌳', minWeeklyXP: 1500, color: '#14b8a6' },
  grove:     { label: 'Grove',     icon: '🌲', minWeeklyXP: 3000, color: '#6366f1' },
};

const TIER_ORDER: LeagueTier[] = ['sapling', 'sprout', 'bloom', 'flourish', 'canopy', 'grove'];

export interface LeagueEntry {
  userId: string;
  displayName: string;
  badgeEmoji: string;
  weeklyXP: number;
  growthBonus: number;           // extra XP from improving
  rank: number;
  tier: LeagueTier;
  isYou: boolean;
}

export interface LeagueView {
  tier: LeagueTier;
  tierLabel: string;
  tierIcon: string;
  weekStart: string;
  weekEnd: string;
  daysRemaining: number;
  entries: LeagueEntry[];
  myRank: number | null;
  myWeeklyXP: number;
  myGrowthBonus: number;
  zoneOfRank: 'promotion' | 'safe' | 'relegation';
  // Friendly next-step guidance (never shaming)
  message: string;
  optedIn: boolean;
}

// ============================================================
// Week boundaries (IST) — Mon 00:00 to Sun 23:59
// ============================================================

const IST_OFFSET_MINUTES = 330; // +5:30

export function currentWeekBoundaries(now: Date = new Date()): { start: Date; end: Date } {
  // Convert to IST
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utcMs + IST_OFFSET_MINUTES * 60000);
  const dayOfWeek = ist.getDay(); // 0 = Sunday
  const daysSinceMonday = (dayOfWeek + 6) % 7; // Monday = 0
  const istMonday = new Date(ist);
  istMonday.setDate(ist.getDate() - daysSinceMonday);
  istMonday.setHours(0, 0, 0, 0);
  const istSunday = new Date(istMonday);
  istSunday.setDate(istMonday.getDate() + 6);
  istSunday.setHours(23, 59, 59, 999);

  // Convert back to UTC for storage
  const startUtc = new Date(istMonday.getTime() - IST_OFFSET_MINUTES * 60000);
  const endUtc = new Date(istSunday.getTime() - IST_OFFSET_MINUTES * 60000);
  return { start: startUtc, end: endUtc };
}

export function computeTier(weeklyXP: number): LeagueTier {
  let tier: LeagueTier = 'sapling';
  for (const t of TIER_ORDER) {
    if (weeklyXP >= LEAGUE_TIERS[t].minWeeklyXP) tier = t;
  }
  return tier;
}

// ============================================================
// Growth bonus — weight improvement over raw grinding
// ============================================================

export function computeGrowthBonus(
  thisWeekXP: number,
  lastWeekXP: number,
  thisWeekAccuracy: number,
  lastWeekAccuracy: number,
): number {
  const xpDelta = thisWeekXP - lastWeekXP;
  const accDelta = thisWeekAccuracy - lastWeekAccuracy;
  let bonus = 0;
  if (xpDelta > 0) bonus += Math.min(xpDelta * 0.2, 100);
  if (accDelta > 0.05) bonus += Math.round(accDelta * 200);
  return Math.round(bonus);
}

// ============================================================
// Ranked entries + promotion/relegation zones
// ============================================================

export interface RawLeagueRow {
  userId: string;
  displayName: string;
  badgeEmoji: string;
  weeklyXP: number;
  growthBonus: number;
}

export function buildLeagueView(params: {
  myUserId: string;
  rows: RawLeagueRow[];
  optedIn: boolean;
  now?: Date;
}): LeagueView {
  const { myUserId, rows, optedIn, now = new Date() } = params;
  const { start, end } = currentWeekBoundaries(now);
  const daysRemaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  // Sort by effective XP (weeklyXP + growthBonus)
  const ranked = [...rows]
    .sort((a, b) => (b.weeklyXP + b.growthBonus) - (a.weeklyXP + a.growthBonus))
    .map((r, i) => ({
      ...r,
      rank: i + 1,
      tier: computeTier(r.weeklyXP),
      isYou: r.userId === myUserId,
    }));

  const me = ranked.find((r) => r.userId === myUserId) || null;
  const total = ranked.length || 1;
  const promotionCutoff = Math.max(1, Math.floor(total * 0.1));
  const relegationCutoff = Math.max(total - Math.floor(total * 0.2), total + 1);

  let zoneOfRank: LeagueView['zoneOfRank'] = 'safe';
  if (me) {
    if (me.rank <= promotionCutoff) zoneOfRank = 'promotion';
    else if (me.rank > relegationCutoff) zoneOfRank = 'relegation';
  }

  const myTier = me ? me.tier : 'sapling';
  const myXP = me?.weeklyXP ?? 0;
  const myBonus = me?.growthBonus ?? 0;

  // Friendly message — never shaming
  let message: string;
  if (!optedIn) {
    message = 'Leagues are off — you\'re learning for yourself, not for rank. Opt in anytime.';
  } else if (!me) {
    message = 'Start learning this week to earn your first rank.';
  } else if (zoneOfRank === 'promotion') {
    message = `🎉 You\'re in the promotion zone! Keep pace and you\'ll move up next week.`;
  } else if (zoneOfRank === 'relegation') {
    message = `A calm ${Math.ceil((LEAGUE_TIERS[myTier].minWeeklyXP - myXP) / Math.max(daysRemaining, 1))} XP/day keeps you here — no pressure.`;
  } else {
    message = `You\'re safely at rank ${me.rank}. ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left — study at your own pace.`;
  }

  return {
    tier: myTier,
    tierLabel: LEAGUE_TIERS[myTier].label,
    tierIcon: LEAGUE_TIERS[myTier].icon,
    weekStart: start.toISOString(),
    weekEnd: end.toISOString(),
    daysRemaining,
    entries: ranked,
    myRank: me?.rank ?? null,
    myWeeklyXP: myXP,
    myGrowthBonus: myBonus,
    zoneOfRank,
    message,
    optedIn,
  };
}
