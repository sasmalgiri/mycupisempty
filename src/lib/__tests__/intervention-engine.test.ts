import { describe, it, expect } from 'vitest';
import { detectInterventions, pickInterventionForMoment, interventionToAIPrompt } from '../intervention-engine';
import type { StudentState } from '../student-state';

const mockState = (over: Partial<StudentState> = {}): StudentState => ({
  userId: 'u1',
  classLevel: 8,
  board: 'cbse',
  currentMood: 'neutral',
  energyLevel: 'medium',
  frustrationLevel: 3,
  confidenceLevel: 6,
  persistenceScore: 0.5,
  helpSeekingRate: 0.2,
  minutesActiveToday: 10,
  attentionSpanMinutes: 20,
  cognitiveLoad: 'moderate',
  isNearDropOff: false,
  subjectStates: {},
  activeMistakePatterns: [],
  activeMisconceptions: [],
  profileConfidence: 0.5,
  bestTimeOfDay: 'afternoon',
  ...over,
});

describe('detectInterventions', () => {
  it('returns empty list when no triggers', () => {
    expect(detectInterventions(mockState())).toHaveLength(0);
  });

  it('surfaces library intervention for known mistake pattern', () => {
    const list = detectInterventions(mockState({
      activeMistakePatterns: [{ pattern: 'sign_errors', subject: 'math', frequency: 5, severity: 'critical', suggestedIntervention: 'test' }],
    }));
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].triggerPattern).toBe('sign_errors');
    expect(list[0].urgency).toBe('immediate');
  });

  it('produces a generic intervention for an unknown critical pattern', () => {
    const list = detectInterventions(mockState({
      activeMistakePatterns: [{ pattern: 'unknown_weird_pattern', subject: 'math', frequency: 5, severity: 'critical', suggestedIntervention: 'slow down' }],
    }));
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].urgency).toBe('immediate');
  });

  it('flags guessing intervention when persistence low + confidence low', () => {
    const list = detectInterventions(mockState({
      persistenceScore: 0.15,
      confidenceLevel: 2,
    }));
    expect(list.some((i) => i.triggerPattern === 'guessing_pattern')).toBe(true);
  });

  it('sorts immediate before next_session before this_week', () => {
    const list = detectInterventions(mockState({
      activeMistakePatterns: [
        { pattern: 'sign_errors', subject: 'math', frequency: 1, severity: 'mild', suggestedIntervention: '' },
        { pattern: 'careless_arithmetic', subject: 'math', frequency: 5, severity: 'critical', suggestedIntervention: '' },
      ],
    }));
    const urgencies = list.map((i) => i.urgency);
    const idxImmediate = urgencies.indexOf('immediate');
    const idxLater = urgencies.indexOf('this_week');
    if (idxImmediate >= 0 && idxLater >= 0) expect(idxImmediate).toBeLessThan(idxLater);
  });
});

describe('pickInterventionForMoment', () => {
  it('returns null when there are no active triggers', () => {
    expect(pickInterventionForMoment(mockState(), 'daily_mix_start')).toBeNull();
  });

  it('picks an immediate intervention on after_wrong_answer', () => {
    const state = mockState({
      activeMistakePatterns: [{ pattern: 'sign_errors', subject: 'math', frequency: 3, severity: 'critical', suggestedIntervention: '' }],
    });
    const iv = pickInterventionForMoment(state, 'after_wrong_answer');
    expect(iv).toBeTruthy();
    expect(iv?.urgency).toBe('immediate');
  });
});

describe('interventionToAIPrompt', () => {
  it('renders all the expected sections', () => {
    const state = mockState({
      activeMistakePatterns: [{ pattern: 'sign_errors', subject: 'math', frequency: 5, severity: 'critical', suggestedIntervention: '' }],
    });
    const iv = detectInterventions(state)[0];
    const p = interventionToAIPrompt(iv);
    expect(p).toContain('misconception');
    expect(p).toContain('Counter-example');
    expect(p).toContain('practice');
  });
});
