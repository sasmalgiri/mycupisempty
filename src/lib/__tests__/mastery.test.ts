import { describe, it, expect } from 'vitest';
import { classifyMastery, decideNextAction, honestMasterySummary } from '../mastery';

describe('classifyMastery', () => {
  it('returns fresh when never attempted', () => {
    const r = classifyMastery({ attempts: 0, correctAttempts: 0, recentAccuracy: 0, stalledCycles: 0, lastSeenDaysAgo: 0 });
    expect(r.state).toBe('fresh');
    expect(r.confidence).toBe(1);
  });

  it('flags stalled after 3+ cycles', () => {
    const r = classifyMastery({ attempts: 10, correctAttempts: 1, recentAccuracy: 0.2, stalledCycles: 3, lastSeenDaysAgo: 2 });
    expect(r.state).toBe('stalled');
  });

  it('detects decay when advanced band but unseen for 2x interval', () => {
    const r = classifyMastery({
      attempts: 20,
      correctAttempts: 18,
      recentAccuracy: 0.9,
      stalledCycles: 0,
      lastSeenDaysAgo: 60,
      currentBand: 'advanced',
      interval: 21,
    });
    expect(r.state).toBe('decayed');
  });

  it('classifies mastered when interval is long and recently seen', () => {
    const r = classifyMastery({
      attempts: 15,
      correctAttempts: 14,
      recentAccuracy: 0.93,
      stalledCycles: 0,
      lastSeenDaysAgo: 5,
      interval: 30,
    });
    expect(r.state).toBe('mastered');
  });

  it('classifies stable when recent accuracy high and 5+ attempts', () => {
    const r = classifyMastery({
      attempts: 8,
      correctAttempts: 7,
      recentAccuracy: 0.9,
      stalledCycles: 0,
      lastSeenDaysAgo: 1,
    });
    expect(r.state).toBe('stable');
  });

  it('classifies fragile when few attempts but recent accuracy is decent', () => {
    const r = classifyMastery({
      attempts: 2,
      correctAttempts: 2,
      recentAccuracy: 1,
      stalledCycles: 0,
      lastSeenDaysAgo: 1,
    });
    expect(r.state).toBe('fragile');
  });

  it('classifies learning when just started with mixed results', () => {
    const r = classifyMastery({
      attempts: 3,
      correctAttempts: 1,
      recentAccuracy: 0.33,
      stalledCycles: 0,
      lastSeenDaysAgo: 0,
    });
    expect(r.state).toBe('learning');
  });
});

describe('decideNextAction', () => {
  it('suggests relearn for decayed', () => {
    const a = decideNextAction({ state: 'decayed', confidence: 0.8 }, 40);
    expect(a.kind).toBe('relearn');
    expect(a.urgency).toBe('now');
  });

  it('suggests intervene for stalled', () => {
    const a = decideNextAction({ state: 'stalled', confidence: 0.9 }, 3);
    expect(a.kind).toBe('intervene');
    expect(a.urgency).toBe('now');
  });

  it('suggests rest for mastered', () => {
    const a = decideNextAction({ state: 'mastered', confidence: 0.95 }, 1);
    expect(a.kind).toBe('rest');
  });
});

describe('honestMasterySummary', () => {
  it('returns a friendly headline with zero data', () => {
    const s = honestMasterySummary([]);
    expect(s.headline).toMatch(/Ready/);
    expect(s.priorityTopic).toBeNull();
  });
});
