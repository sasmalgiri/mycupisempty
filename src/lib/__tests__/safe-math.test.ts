import { describe, it, expect } from 'vitest';
import { average, averageBy, percent, safeDiv } from '../safe-math';
import { resolveClassLevel, formatBoard } from '../user-class';

describe('safe-math — the empty list must never render as NaN', () => {
  it('average of an empty list is 0, not NaN', () => {
    expect(average([])).toBe(0);
    expect(Number.isNaN(average([]))).toBe(false);
  });

  it('average rounds and ignores non-finite entries', () => {
    expect(average([10, 20, 31])).toBe(20);
    expect(average([50, NaN])).toBe(25);   // NaN counted as 0, not propagated
  });

  it('averageBy over an empty list is 0', () => {
    expect(averageBy([] as Array<{ p: number }>, (x) => x.p)).toBe(0);
    expect(averageBy([{ p: 40 }, { p: 60 }], (x) => x.p)).toBe(50);
  });

  it('percent with a zero denominator is 0 — the brand-new-account case', () => {
    expect(percent(0, 0)).toBe(0);
    expect(percent(5, 0)).toBe(0);
  });

  it('percent clamps into 0..100', () => {
    expect(percent(3, 4)).toBe(75);
    expect(percent(9, 4)).toBe(100);
    expect(percent(-5, 4)).toBe(0);
  });

  it('safeDiv returns the fallback rather than Infinity or NaN', () => {
    expect(safeDiv(1, 0)).toBe(0);
    expect(safeDiv(1, 0, -1)).toBe(-1);
    expect(safeDiv(10, 4)).toBe(2.5);
  });
});

describe('resolveClassLevel — one answer for "which class is this student in"', () => {
  it('prefers the canonical current_class column', () => {
    expect(resolveClassLevel({ current_class: 8, education_level: 'class_5' })).toBe(8);
  });

  it('falls back to education_level when current_class is NULL', () => {
    // This is the real shape in production: onboarding writes education_level
    // and leaves current_class null, which rendered "Class 0".
    expect(resolveClassLevel({ current_class: null, education_level: 'class_5' })).toBe(5);
    expect(resolveClassLevel({ education_level: 'CLASS-11' })).toBe(11);
  });

  it('returns null — never 0 — when the profile genuinely does not say', () => {
    expect(resolveClassLevel({ current_class: null, education_level: null })).toBeNull();
    expect(resolveClassLevel(null)).toBeNull();
    expect(resolveClassLevel({})).toBeNull();
  });

  it('rejects out-of-range values instead of displaying them', () => {
    expect(resolveClassLevel({ current_class: 0 })).toBeNull();
    expect(resolveClassLevel({ current_class: 99 })).toBeNull();
  });

  it('formats board codes, including the wb_board slug', () => {
    expect(formatBoard('wb_board')).toBe('WBBSE');
    expect(formatBoard('wbbse')).toBe('WBBSE');
    expect(formatBoard('cbse')).toBe('CBSE');
    expect(formatBoard(null)).toBe('');
  });
});
