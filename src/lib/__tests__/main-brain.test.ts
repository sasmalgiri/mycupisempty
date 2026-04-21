import { describe, it, expect } from 'vitest';
import { aggregateReports, activeOnly, directivesToPromptBlock } from '../main-brain';
import type { CompanionReport } from '../companion-memory';

const mockReport = (over: Partial<CompanionReport> = {}): CompanionReport => ({
  generatedAt: new Date().toISOString(),
  sentimentWindow: 'steady',
  urgentFlags: [],
  breakthroughs: [],
  concerns: [],
  recommendedAction: '',
  crossSubjectHints: [],
  ...over,
});

describe('aggregateReports', () => {
  it('returns unknown sentiment with no reports', () => {
    const s = aggregateReports('u1', []);
    expect(s.overallSentiment).toBe('unknown');
    expect(s.activeDirectives).toHaveLength(0);
  });

  it('issues ease_up when multiple subjects are strained', () => {
    const reports = [
      { companionId: 'aryabhata', subjectId: 's1', report: mockReport({ sentimentWindow: 'strained', urgentFlags: ['High frustration'] }) },
      { companionId: 'tagore',   subjectId: 's2', report: mockReport({ sentimentWindow: 'strained' }) },
    ];
    const s = aggregateReports('u1', reports);
    expect(s.overallSentiment).toBe('strained');
    const hasEaseUp = s.activeDirectives.some((d) => d.type === 'ease_up');
    expect(hasEaseUp).toBe(true);
  });

  it('issues push_harder when flourishing across multiple subjects', () => {
    const reports = [
      { companionId: 'aryabhata', subjectId: 's1', report: mockReport({ sentimentWindow: 'flourishing', breakthroughs: ['great work on quadratics'] }) },
      { companionId: 'tagore',   subjectId: 's2', report: mockReport({ sentimentWindow: 'flourishing', breakthroughs: ['wrote a moving essay'] }) },
    ];
    const s = aggregateReports('u1', reports);
    expect(s.overallSentiment).toBe('flourishing');
    const hasPush = s.activeDirectives.some((d) => d.type === 'push_harder');
    expect(hasPush).toBe(true);
  });

  it('issues celebrate when any breakthroughs land', () => {
    const reports = [
      { companionId: 'aryabhata', subjectId: 's1', report: mockReport({ breakthroughs: ['got fractions'] }) },
    ];
    const s = aggregateReports('u1', reports);
    expect(s.activeDirectives.some((d) => d.type === 'celebrate')).toBe(true);
  });

  it('issues cross_insight when a subject hints something useful', () => {
    const reports = [
      { companionId: 'aryabhata', subjectId: 's1', report: mockReport({ crossSubjectHints: ['Student loves pattern-finding'] }) },
      { companionId: 'tagore',   subjectId: 's2', report: mockReport() },
    ];
    const s = aggregateReports('u1', reports);
    const crossDir = s.activeDirectives.find((d) => d.type === 'cross_insight');
    expect(crossDir).toBeTruthy();
    expect(crossDir?.appliesTo).not.toBe('all');
  });

  it('issues focus_area when the same concern repeats across subjects', () => {
    const reports = [
      { companionId: 'aryabhata', subjectId: 's1', report: mockReport({ concerns: ['Rushing answers'] }) },
      { companionId: 'tagore',   subjectId: 's2', report: mockReport({ concerns: ['Rushing answers'] }) },
    ];
    const s = aggregateReports('u1', reports);
    const hasFocus = s.activeDirectives.some((d) => d.type === 'focus_area');
    expect(hasFocus).toBe(true);
  });
});

describe('activeOnly', () => {
  it('filters expired directives out', () => {
    const past = new Date(Date.now() - 10_000).toISOString();
    const future = new Date(Date.now() + 60_000).toISOString();
    const list = [
      { id: '1', type: 'ease_up' as const, reason: '', appliesTo: 'all' as const, issuedAt: past, expiresAt: past },
      { id: '2', type: 'ease_up' as const, reason: '', appliesTo: 'all' as const, issuedAt: past, expiresAt: future },
    ];
    expect(activeOnly(list)).toHaveLength(1);
  });
});

describe('directivesToPromptBlock', () => {
  it('renders nothing for empty input', () => {
    expect(directivesToPromptBlock([], 'aryabhata')).toBe('');
  });

  it('includes ease_up line when relevant', () => {
    const s = directivesToPromptBlock(
      [{ id: '1', type: 'ease_up', reason: 'strain detected', appliesTo: 'all', issuedAt: '', expiresAt: new Date(Date.now() + 60000).toISOString() }],
      'aryabhata',
    );
    expect(s).toContain('EASE UP');
  });

  it('excludes directives not targeting this companion', () => {
    const s = directivesToPromptBlock(
      [{ id: '1', type: 'ease_up', reason: 'only for tagore', appliesTo: ['tagore'], issuedAt: '', expiresAt: new Date(Date.now() + 60000).toISOString() }],
      'aryabhata',
    );
    expect(s).toBe('');
  });
});
