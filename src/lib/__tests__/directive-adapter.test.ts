import { describe, it, expect } from 'vitest';
import { adaptationDelta, deltaToPromptBlock } from '../directive-adapter';
import type { BrainDirective } from '../main-brain';

const future = () => new Date(Date.now() + 600_000).toISOString();

const mkDir = (over: Partial<BrainDirective>): BrainDirective => ({
  id: 'd1',
  type: 'ease_up',
  reason: 'test',
  appliesTo: 'all',
  issuedAt: new Date().toISOString(),
  expiresAt: future(),
  ...over,
});

describe('adaptationDelta', () => {
  it('returns empty delta with no directives', () => {
    const d = adaptationDelta([]);
    expect(d.difficultyAdjust).toBe(0);
    expect(d.applied).toHaveLength(0);
  });

  it('ease_up reduces difficulty + raises encouragement', () => {
    const d = adaptationDelta([mkDir({ type: 'ease_up' })]);
    expect(d.difficultyAdjust).toBeLessThanOrEqual(-1);
    expect(d.encouragementIntensity).toBe('high');
  });

  it('push_harder increases difficulty', () => {
    const d = adaptationDelta([mkDir({ type: 'push_harder' })]);
    expect(d.difficultyAdjust).toBeGreaterThan(0);
  });

  it('shorten_session caps session length + task count', () => {
    const d = adaptationDelta([mkDir({ type: 'shorten_session' })]);
    expect(d.maxDurationMinutes).toBeLessThanOrEqual(12);
    expect(d.maxTaskCount).toBeLessThanOrEqual(3);
  });

  it('celebrate captures breakthrough messages', () => {
    const d = adaptationDelta([mkDir({ type: 'celebrate', params: { breakthroughs: ['great work on fractions'] } })]);
    expect(d.mustMentionBreakthroughs).toContain('great work on fractions');
  });

  it('focus_area sets the concern', () => {
    const d = adaptationDelta([mkDir({ type: 'focus_area', params: { concern: 'careless arithmetic' } })]);
    expect(d.mustAddressConcern).toBe('careless arithmetic');
  });

  it('cross_insight propagates hint only to listed companions', () => {
    const d = adaptationDelta(
      [mkDir({ type: 'cross_insight', appliesTo: ['tagore'], params: { hint: 'prefers analogies', fromSubject: 'Math' } })],
      { forCompanionId: 'tagore' },
    );
    expect(d.crossInsights).toHaveLength(1);
  });

  it('filters out directives that do not apply to this companion', () => {
    const d = adaptationDelta(
      [mkDir({ type: 'ease_up', appliesTo: ['tagore'] })],
      { forCompanionId: 'aryabhata' },
    );
    expect(d.applied).toHaveLength(0);
  });

  it('clamps difficulty adjust to [-2, +2]', () => {
    const d = adaptationDelta([
      mkDir({ id: 'a', type: 'ease_up' }),
      mkDir({ id: 'b', type: 'ease_up' }),
      mkDir({ id: 'c', type: 'ease_up' }),
    ]);
    expect(d.difficultyAdjust).toBeGreaterThanOrEqual(-2);
  });
});

describe('deltaToPromptBlock', () => {
  it('returns empty string when nothing applies', () => {
    expect(deltaToPromptBlock(adaptationDelta([]))).toBe('');
  });

  it('includes concise lines for active directives', () => {
    const d = adaptationDelta([mkDir({ type: 'push_harder', reason: 'flourishing across subjects' })]);
    const block = deltaToPromptBlock(d);
    expect(block).toContain('STRETCH');
    expect(block).toContain('flourishing');
  });
});
