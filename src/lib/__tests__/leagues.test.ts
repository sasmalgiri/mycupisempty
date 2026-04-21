import { describe, it, expect } from 'vitest';
import { computeTier, computeGrowthBonus, buildLeagueView, currentWeekBoundaries } from '../leagues';

describe('computeTier', () => {
  it('maps XP thresholds to tier labels', () => {
    expect(computeTier(0)).toBe('sapling');
    expect(computeTier(149)).toBe('sapling');
    expect(computeTier(150)).toBe('sprout');
    expect(computeTier(400)).toBe('bloom');
    expect(computeTier(799)).toBe('bloom');
    expect(computeTier(800)).toBe('flourish');
    expect(computeTier(1499)).toBe('flourish');
    expect(computeTier(1500)).toBe('canopy');
    expect(computeTier(2999)).toBe('canopy');
    expect(computeTier(3000)).toBe('grove');
  });
});

describe('computeGrowthBonus', () => {
  it('is zero when no improvement', () => {
    expect(computeGrowthBonus(100, 100, 0.5, 0.5)).toBe(0);
  });

  it('is positive when XP + accuracy both improve', () => {
    expect(computeGrowthBonus(200, 100, 0.6, 0.5)).toBeGreaterThan(0);
  });

  it('caps xp bonus reasonably', () => {
    expect(computeGrowthBonus(10_000, 100, 0.6, 0.5)).toBeLessThanOrEqual(120);
  });
});

describe('currentWeekBoundaries', () => {
  it('returns a Monday → Sunday range in IST', () => {
    const { start, end } = currentWeekBoundaries();
    expect(end.getTime()).toBeGreaterThan(start.getTime());
    const diff = end.getTime() - start.getTime();
    expect(diff).toBeGreaterThan(6 * 24 * 3600 * 1000);
    expect(diff).toBeLessThan(7 * 24 * 3600 * 1000 + 60_000);
  });
});

describe('buildLeagueView', () => {
  it('respects opt-in flag in message', () => {
    const v = buildLeagueView({
      myUserId: 'u1',
      rows: [],
      optedIn: false,
    });
    expect(v.optedIn).toBe(false);
    expect(v.message.toLowerCase()).toContain('off');
  });

  it('ranks entries by weeklyXP + growthBonus', () => {
    const v = buildLeagueView({
      myUserId: 'u1',
      rows: [
        { userId: 'u1', displayName: 'Me', badgeEmoji: '🌱', weeklyXP: 200, growthBonus: 10 },
        { userId: 'u2', displayName: 'A', badgeEmoji: '🌿', weeklyXP: 250, growthBonus: 0 },
        { userId: 'u3', displayName: 'B', badgeEmoji: '🌸', weeklyXP: 100, growthBonus: 20 },
      ],
      optedIn: true,
    });
    expect(v.entries[0].userId).toBe('u2');   // 250
    expect(v.entries[1].userId).toBe('u1');   // 210
    expect(v.entries[2].userId).toBe('u3');   // 120
    expect(v.myRank).toBe(2);
  });
});
