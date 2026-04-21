import { describe, it, expect } from 'vitest';
import { contextKeyFor, classBandFromClassLevel, moodBucketFromState, blendWithPrior } from '../self-learning';

describe('contextKeyFor', () => {
  it('is stable + reproducible', () => {
    const a = contextKeyFor({ subjectName: 'Mathematics', maturityBand: 3, moodBucket: 'neutral', classBand: 'middle' });
    const b = contextKeyFor({ subjectName: 'Mathematics', maturityBand: 3, moodBucket: 'neutral', classBand: 'middle' });
    expect(a).toBe(b);
  });

  it('has coarse shape subject|classBand|band|mood', () => {
    const key = contextKeyFor({ subjectName: 'Math', maturityBand: 4, moodBucket: 'positive', classBand: 'senior' });
    expect(key.split('|')).toHaveLength(4);
    expect(key).toContain('senior');
    expect(key).toContain('b4');
    expect(key).toContain('positive');
  });

  it('defaults gracefully when fields are missing', () => {
    const k = contextKeyFor({});
    expect(typeof k).toBe('string');
    expect(k.length).toBeGreaterThan(0);
  });
});

describe('classBandFromClassLevel', () => {
  it('maps class 1–5 to primary', () => {
    expect(classBandFromClassLevel(1)).toBe('primary');
    expect(classBandFromClassLevel(5)).toBe('primary');
  });
  it('maps 6–8 to middle', () => {
    expect(classBandFromClassLevel(6)).toBe('middle');
    expect(classBandFromClassLevel(8)).toBe('middle');
  });
  it('maps 9–12 to senior', () => {
    expect(classBandFromClassLevel(9)).toBe('senior');
    expect(classBandFromClassLevel(12)).toBe('senior');
  });
});

describe('moodBucketFromState', () => {
  it('strained on high frustration', () => {
    expect(moodBucketFromState(7, 5)).toBe('strained');
  });
  it('strained on low confidence', () => {
    expect(moodBucketFromState(2, 2)).toBe('strained');
  });
  it('positive on low frustration + high confidence', () => {
    expect(moodBucketFromState(1, 8)).toBe('positive');
  });
  it('neutral otherwise', () => {
    expect(moodBucketFromState(4, 5)).toBe('neutral');
  });
});

describe('blendWithPrior', () => {
  it('favours global prior when student has no data', () => {
    const v = blendWithPrior({
      studentOwnSamples: 0,
      prior: { contextKey: 'x', actionKey: 'y', meanReward: 0.8, sampleSize: 100, confidence: 1, updatedAt: '' },
    });
    expect(v).toBeCloseTo(0.8, 1);
  });

  it('favours student data when heavily sampled', () => {
    const v = blendWithPrior({
      studentOwnScore: 0.9,
      studentOwnSamples: 100,
      prior: { contextKey: 'x', actionKey: 'y', meanReward: 0.3, sampleSize: 5, confidence: 0.1, updatedAt: '' },
    });
    expect(v).toBeGreaterThan(0.6);
  });

  it('returns neutral 0.5 when no data either side', () => {
    expect(blendWithPrior({})).toBe(0.5);
  });
});
