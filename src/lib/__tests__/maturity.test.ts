import { describe, it, expect } from 'vitest';
import { computeMaturity, adaptationForMaturity, BAND_INFO, maturitySummary } from '../maturity';
import type { StudentState, SubjectState } from '../student-state';

const mockStudentState = (overrides: Partial<StudentState> = {}): StudentState => ({
  userId: 'u1',
  classLevel: 8,
  board: 'cbse',
  currentMood: 'neutral',
  energyLevel: 'medium',
  frustrationLevel: 3,
  confidenceLevel: 6,
  persistenceScore: 0.5,
  helpSeekingRate: 0.2,
  minutesActiveToday: 15,
  attentionSpanMinutes: 20,
  cognitiveLoad: 'moderate',
  isNearDropOff: false,
  subjectStates: {},
  activeMistakePatterns: [],
  activeMisconceptions: [],
  profileConfidence: 0.5,
  bestTimeOfDay: 'afternoon',
  ...overrides,
});

const mockSubjectState = (overrides: Partial<SubjectState> = {}): SubjectState => ({
  subjectId: 's1',
  subjectName: 'Mathematics',
  recentAccuracy: 0.6,
  accuracyTrend: 'stable',
  avgTimePerQuestion: 30,
  currentBand: 'developing',
  stalledTopics: [],
  strongTopics: [],
  bestMethod: 'feynman',
  bestExplanationStyle: 'step_by_step',
  confidenceAccuracyGap: 0,
  commonErrors: [],
  ...overrides,
});

describe('computeMaturity', () => {
  it('returns a valid band between 1 and 5', () => {
    const p = computeMaturity({
      userId: 'u1',
      subjectId: 's1',
      subjectName: 'Math',
      subjectState: mockSubjectState(),
      studentState: mockStudentState(),
      classLevel: 8,
    });
    expect(p.band).toBeGreaterThanOrEqual(1);
    expect(p.band).toBeLessThanOrEqual(5);
  });

  it('places advanced-band high-accuracy student in band 4 or 5', () => {
    const p = computeMaturity({
      userId: 'u1',
      subjectId: 's1',
      subjectName: 'Math',
      subjectState: mockSubjectState({ currentBand: 'advanced', recentAccuracy: 0.92, accuracyTrend: 'improving' }),
      studentState: mockStudentState({ confidenceLevel: 9, persistenceScore: 0.9 }),
      classLevel: 10,
      metacognitionCalibration: 0.88,
      creativeScore: 0.85,
    });
    expect(p.band).toBeGreaterThanOrEqual(4);
  });

  it('places foundation-band low-accuracy student in band 1 or 2', () => {
    const p = computeMaturity({
      userId: 'u1',
      subjectId: 's1',
      subjectName: 'Math',
      subjectState: mockSubjectState({ currentBand: 'foundation', recentAccuracy: 0.25, accuracyTrend: 'declining' }),
      studentState: mockStudentState({ confidenceLevel: 3, persistenceScore: 0.2 }),
      classLevel: 5,
    });
    expect(p.band).toBeLessThanOrEqual(2);
  });

  it('dimension scores stay in 0..100', () => {
    const p = computeMaturity({
      userId: 'u1',
      subjectId: 's1',
      subjectName: 'Math',
      subjectState: mockSubjectState(),
      studentState: mockStudentState(),
      classLevel: 8,
    });
    for (const v of Object.values(p.dimensions)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});

describe('adaptationForMaturity', () => {
  it('lower band → higher scaffold + lower difficulty', () => {
    const p1 = computeMaturity({ userId: 'u1', subjectId: 's1', studentState: mockStudentState({ confidenceLevel: 2 }), classLevel: 5 });
    const a1 = adaptationForMaturity(p1);
    const p5 = computeMaturity({ userId: 'u1', subjectId: 's1', subjectState: mockSubjectState({ currentBand: 'advanced', recentAccuracy: 0.95 }), studentState: mockStudentState({ confidenceLevel: 10 }), classLevel: 12, metacognitionCalibration: 0.9 });
    const a5 = adaptationForMaturity(p5);
    expect(a1.scaffoldLevel).toBeGreaterThan(a5.scaffoldLevel);
    expect(a1.targetDifficulty).toBeLessThanOrEqual(a5.targetDifficulty);
  });
});

describe('BAND_INFO', () => {
  it('has an entry for each band 1..5', () => {
    for (const b of [1, 2, 3, 4, 5] as const) {
      expect(BAND_INFO[b]).toBeTruthy();
      expect(BAND_INFO[b].label).toBeTruthy();
    }
  });
});

describe('maturitySummary', () => {
  it('returns a descriptive string', () => {
    const p = computeMaturity({ userId: 'u1', subjectId: 's1', studentState: mockStudentState(), classLevel: 8 });
    const s = maturitySummary(p);
    expect(s.length).toBeGreaterThan(10);
    expect(s).toContain(BAND_INFO[p.band].icon);
  });
});
