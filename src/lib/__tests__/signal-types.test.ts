import { describe, it, expect } from 'vitest';
import { SIGNAL, CATEGORY, isMoodSignal, isTimeSignal } from '../signal-types';

describe('SIGNAL + CATEGORY enums', () => {
  it('all types are non-empty strings', () => {
    for (const v of Object.values(SIGNAL)) {
      expect(typeof v).toBe('string');
      expect(v.length).toBeGreaterThan(0);
    }
    for (const v of Object.values(CATEGORY)) {
      expect(typeof v).toBe('string');
      expect(v.length).toBeGreaterThan(0);
    }
  });
});

describe('isMoodSignal', () => {
  it('accepts both canonical + legacy mood aliases', () => {
    expect(isMoodSignal('mood')).toBe(true);
    expect(isMoodSignal('mood_emoji')).toBe(true);
  });

  it('rejects unrelated signal types', () => {
    expect(isMoodSignal('answer_result')).toBe(false);
    expect(isMoodSignal('time_spent')).toBe(false);
  });

  it('is safe for non-string inputs', () => {
    expect(isMoodSignal(undefined)).toBe(false);
    expect(isMoodSignal(null)).toBe(false);
    expect(isMoodSignal(42)).toBe(false);
  });
});

describe('isTimeSignal', () => {
  it('accepts canonical + legacy time aliases', () => {
    expect(isTimeSignal('time_spent')).toBe(true);
    expect(isTimeSignal('step_time')).toBe(true);
  });

  it('rejects unrelated', () => {
    expect(isTimeSignal('mood')).toBe(false);
  });

  it('is safe for non-string inputs', () => {
    expect(isTimeSignal(undefined)).toBe(false);
    expect(isTimeSignal({})).toBe(false);
  });
});
