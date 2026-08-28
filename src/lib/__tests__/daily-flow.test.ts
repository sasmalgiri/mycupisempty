import { describe, it, expect } from 'vitest';
import { buildDailyFlow, type DailyFlowInput, type FlowUnit } from '../daily-flow';
import type { KnowledgeType } from '../conversion-engine';

const TODAY = '2026-11-10';

function unit(over: Partial<FlowUnit> = {}): FlowUnit {
  return {
    unitId: over.unitId || 'u1',
    chapterId: over.chapterId || 'ch1',
    chapterTitle: over.chapterTitle || 'Quadratic Equations',
    subjectName: over.subjectName || 'Math',
    knowledgeType: over.knowledgeType || 'procedure',
    marksAtStake: over.marksAtStake,
    estimatedMinutes: over.estimatedMinutes ?? 12,
    topicId: over.topicId,
  };
}

function input(over: Partial<DailyFlowInput> = {}): DailyFlowInput {
  return {
    today: TODAY,
    minutesAvailable: 45,
    probesDue: [],
    reviewDueCount: 0,
    availableUnits: [],
    ...over,
  };
}

const kinds = (f: ReturnType<typeof buildDailyFlow>) => f.steps.map((s) => s.kind);

// ===========================================================================
// Ordering — the rules that make this worth having
// ===========================================================================

describe('ordering', () => {
  it('puts probes first, before review and before new material', () => {
    const f = buildDailyFlow(input({
      probesDue: [{ outcomeId: 'o1', question: 'Still got it?' }],
      reviewDueCount: 5,
      availableUnits: [unit()],
    }));
    expect(kinds(f)[0]).toBe('probe');
  });

  it('puts review before new material, always', () => {
    const f = buildDailyFlow(input({ reviewDueCount: 6, availableUnits: [unit()] }));
    const ks = kinds(f);
    expect(ks.indexOf('review')).toBeLessThan(ks.indexOf('learn'));
  });

  it('puts reflection last', () => {
    const f = buildDailyFlow(input({ reviewDueCount: 4, availableUnits: [unit()] }));
    expect(kinds(f)[kinds(f).length - 1]).toBe('reflect');
  });

  it('caps probes at three so the day is not all checking', () => {
    const f = buildDailyFlow(input({
      probesDue: Array.from({ length: 9 }, (_, i) => ({ outcomeId: `o${i}`, question: 'q' })),
      availableUnits: [unit()],
    }));
    expect(kinds(f).filter((k) => k === 'probe')).toHaveLength(3);
    expect(f.omitted.join(' ')).toMatch(/6 more retention checks/);
  });

  it('offers no choices — every step is a single next action', () => {
    const f = buildDailyFlow(input({ reviewDueCount: 3, availableUnits: [unit(), unit({ unitId: 'u2' })] }));
    for (const s of f.steps) {
      expect(s.id).toBeTruthy();
      expect(s.why.length).toBeGreaterThan(20);
      expect(s.minutes).toBeGreaterThan(0);
    }
  });
});

// ===========================================================================
// Review saturation — the anti-cramming guard
// ===========================================================================

describe('review saturation', () => {
  it('teaches nothing new when review has eaten the day', () => {
    const f = buildDailyFlow(input({
      minutesAvailable: 30,
      reviewDueCount: 40,
      availableUnits: [unit(), unit({ unitId: 'u2' })],
    }));
    expect(kinds(f)).not.toContain('learn');
    expect(f.mode).toBe('catch_up');
  });

  it('says out loud that it dropped new material and why', () => {
    const f = buildDailyFlow(input({ minutesAvailable: 30, reviewDueCount: 40, availableUnits: [unit()] }));
    expect(f.omitted.join(' ')).toMatch(/catch-up day/i);
    expect(f.omitted.join(' ')).toMatch(/worse, not better/i);
  });

  it('still teaches when review is a modest share of the day', () => {
    const f = buildDailyFlow(input({ minutesAvailable: 60, reviewDueCount: 8, availableUnits: [unit()] }));
    expect(kinds(f)).toContain('learn');
    expect(f.mode).not.toBe('catch_up');
  });

  it('changes the review rationale when saturated', () => {
    const light = buildDailyFlow(input({ minutesAvailable: 60, reviewDueCount: 5, availableUnits: [unit()] }));
    const heavy = buildDailyFlow(input({ minutesAvailable: 30, reviewDueCount: 40, availableUnits: [unit()] }));
    const lw = light.steps.find((s) => s.kind === 'review')!.why;
    const hw = heavy.steps.find((s) => s.kind === 'review')!.why;
    expect(lw).not.toBe(hw);
    expect(hw).toMatch(/built up|add to the pile/i);
  });
});

// ===========================================================================
// Budget
// ===========================================================================

describe('time budget', () => {
  it('never plans more than the minutes available', () => {
    for (const minutesAvailable of [10, 20, 45, 90, 120]) {
      const f = buildDailyFlow(input({
        minutesAvailable,
        reviewDueCount: 5,
        availableUnits: Array.from({ length: 20 }, (_, i) => unit({ unitId: `u${i}` })),
      }));
      expect(f.totalMinutes).toBeLessThanOrEqual(minutesAvailable + 1);
    }
  });

  it('protects only what would be lost when there is barely any time', () => {
    const f = buildDailyFlow(input({ minutesAvailable: 5, reviewDueCount: 10, availableUnits: [unit()] }));
    expect(kinds(f)).not.toContain('learn');
    expect(f.omitted.join(' ')).toMatch(/not enough time/i);
  });

  it('inserts a break once the attention span is exceeded', () => {
    const f = buildDailyFlow(input({
      minutesAvailable: 90,
      attentionSpanMinutes: 15,
      availableUnits: Array.from({ length: 6 }, (_, i) => unit({ unitId: `u${i}`, estimatedMinutes: 10 })),
    }));
    expect(kinds(f)).toContain('break');
  });

  it('does not insert a break for a short session inside the span', () => {
    const f = buildDailyFlow(input({
      minutesAvailable: 30,
      attentionSpanMinutes: 30,
      availableUnits: [unit({ estimatedMinutes: 10 })],
    }));
    expect(kinds(f)).not.toContain('break');
  });

  it('explains the break as method, not reward', () => {
    const f = buildDailyFlow(input({
      minutesAvailable: 90, attentionSpanMinutes: 12,
      availableUnits: Array.from({ length: 6 }, (_, i) => unit({ unitId: `u${i}`, estimatedMinutes: 10 })),
    }));
    const br = f.steps.find((s) => s.kind === 'break');
    expect(br?.why).toMatch(/not a reward|part of the method/i);
  });

  it('reports what it queued for later rather than dropping it silently', () => {
    const f = buildDailyFlow(input({
      minutesAvailable: 30,
      availableUnits: Array.from({ length: 12 }, (_, i) => unit({ unitId: `u${i}` })),
    }));
    expect(f.omitted.join(' ')).toMatch(/more units queued/);
  });
});

// ===========================================================================
// Rest day
// ===========================================================================

describe('rest day', () => {
  it('schedules nothing but the probes', () => {
    const f = buildDailyFlow(input({
      isRestDay: true,
      probesDue: [{ outcomeId: 'o1', question: 'q' }],
      reviewDueCount: 30,
      availableUnits: [unit()],
    }));
    expect(kinds(f)).toEqual(['probe']);
    expect(f.mode).toBe('rest');
  });

  it('still asks the probes, because a probe is a question not a session', () => {
    const f = buildDailyFlow(input({
      isRestDay: true,
      probesDue: [{ outcomeId: 'o1', question: 'q' }, { outcomeId: 'o2', question: 'q' }],
    }));
    expect(kinds(f).filter((k) => k === 'probe')).toHaveLength(2);
  });

  it('says the plan is to stop', () => {
    const f = buildDailyFlow(input({ isRestDay: true }));
    expect(f.headline).toMatch(/rest day/i);
  });
});

// ===========================================================================
// Reasons — never generic encouragement
// ===========================================================================

describe('reasons', () => {
  const each: KnowledgeType[] = [
    'arbitrary_fact', 'causal_sequence', 'concept',
    'procedure', 'relational_structure', 'judgment',
  ];

  it('gives a different reason per knowledge type', () => {
    const whys = each.map((knowledgeType) => {
      const f = buildDailyFlow(input({ availableUnits: [unit({ knowledgeType })] }));
      return f.steps.find((s) => s.kind === 'learn')!.why;
    });
    expect(new Set(whys).size).toBe(each.length);
  });

  it('describes the method rather than cheering', () => {
    for (const knowledgeType of each) {
      const f = buildDailyFlow(input({ availableUnits: [unit({ knowledgeType })] }));
      const why = f.steps.find((s) => s.kind === 'learn')!.why;
      expect(why).not.toMatch(/you can do it|great job|keep it up|well done/i);
      expect(why.length).toBeGreaterThan(40);
    }
  });

  it('mentions marks only when the exam is under pressure', () => {
    const calm = buildDailyFlow(input({
      examVerdict: 'comfortable',
      availableUnits: [unit({ marksAtStake: 14 })],
    }));
    const pushed = buildDailyFlow(input({
      examVerdict: 'crunch',
      availableUnits: [unit({ marksAtStake: 14 })],
    }));
    expect(calm.steps.find((s) => s.kind === 'learn')!.why).not.toMatch(/marks/);
    expect(pushed.steps.find((s) => s.kind === 'learn')!.why).toMatch(/14 marks/);
  });

  it('does not shout about marks for a low-stakes unit even under pressure', () => {
    const f = buildDailyFlow(input({
      examVerdict: 'crunch',
      availableUnits: [unit({ marksAtStake: 2 })],
    }));
    expect(f.steps.find((s) => s.kind === 'learn')!.why).not.toMatch(/marks/);
  });
});

// ===========================================================================
// Headline and mode
// ===========================================================================

describe('headline', () => {
  it('names the shape of the day in order', () => {
    const f = buildDailyFlow(input({
      probesDue: [{ outcomeId: 'o1', question: 'q' }],
      reviewDueCount: 7,
      availableUnits: [unit()],
    }));
    expect(f.headline).toMatch(/1 quick check/);
    expect(f.headline).toMatch(/7 to review/);
    expect(f.headline).toMatch(/in that order/i);
  });

  it('leads with weeks remaining when the exam is tight', () => {
    const f = buildDailyFlow(input({
      examVerdict: 'crunch', weeksToExam: 6,
      availableUnits: [unit()],
    }));
    expect(f.headline).toMatch(/6 weeks out/);
    expect(f.mode).toBe('push');
  });

  it('handles a completely empty day without breaking', () => {
    const f = buildDailyFlow(input({ minutesAvailable: 40 }));
    expect(f.steps).toHaveLength(0);
    expect(f.headline).toMatch(/nothing due/);
    expect(f.omitted.join(' ')).toMatch(/nothing queued/i);
  });
});

// ===========================================================================
// Reflection
// ===========================================================================

describe('reflection', () => {
  it('is skipped when she already reflected today', () => {
    const f = buildDailyFlow(input({
      lastReflectionDate: TODAY,
      reviewDueCount: 5, availableUnits: [unit()],
    }));
    expect(kinds(f)).not.toContain('reflect');
  });

  it('is included when the last one was another day', () => {
    const f = buildDailyFlow(input({
      lastReflectionDate: '2026-11-01',
      reviewDueCount: 5, availableUnits: [unit()],
    }));
    expect(kinds(f)).toContain('reflect');
  });

  it('is skipped when nothing substantive happened', () => {
    const f = buildDailyFlow(input({
      probesDue: [{ outcomeId: 'o1', question: 'q' }],
      reviewDueCount: 0, availableUnits: [],
    }));
    expect(kinds(f)).not.toContain('reflect');
  });
});
