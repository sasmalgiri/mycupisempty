import { describe, it, expect } from 'vitest';
import { tierTransition, cohortKey } from '../streak';

describe('tierTransition', () => {
  it('promotes top-3 finishers up one tier (capped at 10)', () => {
    expect(tierTransition({ currentTier: 1, rank: 1, cohortSize: 10, weeklyXp: 500 }).newTier).toBe(2);
    expect(tierTransition({ currentTier: 9, rank: 2, cohortSize: 10, weeklyXp: 500 }).newTier).toBe(10);
    expect(tierTransition({ currentTier: 10, rank: 1, cohortSize: 10, weeklyXp: 500 }).newTier).toBe(10);
  });

  it('demotes bottom-3 finishers (floored at 1)', () => {
    expect(tierTransition({ currentTier: 5, rank: 9, cohortSize: 10, weeklyXp: 50 }).newTier).toBe(4);
    expect(tierTransition({ currentTier: 1, rank: 9, cohortSize: 10, weeklyXp: 50 }).newTier).toBe(1);
  });

  it('keeps middle ranks at the same tier', () => {
    expect(tierTransition({ currentTier: 4, rank: 5, cohortSize: 10, weeklyXp: 200 }).newTier).toBe(4);
    expect(tierTransition({ currentTier: 4, rank: 5, cohortSize: 10, weeklyXp: 200 }).reason).toBe('stay');
  });

  it('treats inactive (0 XP) as no movement, not demotion', () => {
    const out = tierTransition({ currentTier: 5, rank: 10, cohortSize: 10, weeklyXp: 0 });
    expect(out.reason).toBe('inactive');
    expect(out.newTier).toBe(5);
  });

  it('does not demote when cohort is too small to have a meaningful bottom', () => {
    expect(tierTransition({ currentTier: 5, rank: 4, cohortSize: 4, weeklyXp: 10 }).reason).toBe('stay');
  });
});

describe('cohortKey', () => {
  it('uses school cohort when school_id is set', () => {
    const k = cohortKey({ board: 'wbbse', classLevel: 10, language: 'bn', schoolId: '11111111-2222-3333-4444-555555555555', section: 'A' });
    expect(k.startsWith('school-')).toBe(true);
    expect(k.includes('class-10')).toBe(true);
    expect(k.endsWith('-a')).toBe(true);
  });

  it('falls back to board+class+language when no school', () => {
    expect(cohortKey({ board: 'wbbse', classLevel: 10, language: 'bn' })).toBe('wbbse-class-10-bn');
    expect(cohortKey({ board: null, classLevel: null, language: null })).toBe('cbse-class-8-en');
  });
});
