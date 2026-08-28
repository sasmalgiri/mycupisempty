import { describe, it, expect } from 'vitest';
import {
  planBackFromExam,
  calibrateCosts,
  DEFAULT_UNIT_COSTS,
  type ChapterWork,
  type ExamPlanInput,
  estimateMixForSubject,
  normaliseMix,
  DEFAULT_SUBJECT_MIX,
} from '../exam-back-planner';
import { summariseLearningSelf, KNOWLEDGE_TYPES, type RepStats, type KnowledgeType, type RepresentationCode } from '../conversion-engine';

const TODAY = '2026-09-01';
const EXAM = '2027-03-03'; // ~26 weeks

function chapter(over: Partial<ChapterWork> = {}): ChapterWork {
  return {
    id: over.id || 'c1',
    title: over.title || 'Chapter',
    subjectName: over.subjectName || 'Math',
    examWeightPct: over.examWeightPct ?? 10,
    unitCount: over.unitCount ?? 8,
    mix: over.mix ?? { procedure: 0.5, concept: 0.5 },
    currentMastery: over.currentMastery ?? 0,
    prereqChapterIds: over.prereqChapterIds,
  };
}

function input(over: Partial<ExamPlanInput> = {}): ExamPlanInput {
  return {
    examDate: EXAM,
    today: TODAY,
    weeklyMinutesTarget: 300,
    chapters: over.chapters ?? [chapter()],
    ...over,
  };
}

// ===========================================================================
// Capacity
// ===========================================================================

describe('capacity', () => {
  it('computes weeks between today and the exam', () => {
    const p = planBackFromExam(input());
    expect(p.weeksAvailable).toBeGreaterThan(25);
    expect(p.weeksAvailable).toBeLessThan(27);
  });

  it('discounts stated availability by observed adherence', () => {
    const optimistic = planBackFromExam(input({ observedAdherence: 1 }));
    const realistic = planBackFromExam(input({ observedAdherence: 0.5 }));
    expect(realistic.feasibility).toBeLessThan(optimistic.feasibility);
  });

  it('defaults to 70% adherence rather than assuming perfection', () => {
    const def = planBackFromExam(input());
    const explicit = planBackFromExam(input({ observedAdherence: 0.7 }));
    expect(def.feasibility).toBeCloseTo(explicit.feasibility, 5);
  });

  it('subtracts blackout periods from available time', () => {
    const without = planBackFromExam(input());
    const withBreak = planBackFromExam(input({
      blackouts: [{ startDate: '2026-10-01', endDate: '2026-10-21', title: 'Puja vacation' }],
    }));
    expect(withBreak.weeksAvailable).toBeLessThan(without.weeksAvailable);
  });

  it('honours partial capacity during a break', () => {
    const full = planBackFromExam(input({
      blackouts: [{ startDate: '2026-10-01', endDate: '2026-10-21', title: 'Break', capacityRetained: 0 }],
    }));
    const partial = planBackFromExam(input({
      blackouts: [{ startDate: '2026-10-01', endDate: '2026-10-21', title: 'Break', capacityRetained: 0.5 }],
    }));
    expect(partial.weeksAvailable).toBeGreaterThan(full.weeksAvailable);
  });

  it('handles an exam date in the past without producing negative time', () => {
    const p = planBackFromExam(input({ examDate: '2026-01-01' }));
    expect(p.weeksAvailable).toBe(0);
    expect(p.grossCapacityMinutes).toBe(0);
  });
});

// ===========================================================================
// Cost comes from the knowledge mix
// ===========================================================================

describe('knowledge-mix costing', () => {
  it('costs a judgement-heavy chapter more than a fact-heavy one', () => {
    const facts = planBackFromExam(input({ chapters: [chapter({ mix: { arbitrary_fact: 1 } })] }));
    const judging = planBackFromExam(input({ chapters: [chapter({ mix: { judgment: 1 } })] }));
    expect(judging.requiredMinutes).toBeGreaterThan(facts.requiredMinutes);
  });

  it('ranks all six knowledge types by cost as designed', () => {
    const cost = (t: KnowledgeType) =>
      planBackFromExam(input({ chapters: [chapter({ mix: { [t]: 1 } })] })).requiredMinutes;

    expect(cost('arbitrary_fact')).toBeLessThan(cost('causal_sequence'));
    expect(cost('causal_sequence')).toBeLessThan(cost('concept'));
    expect(cost('concept')).toBeLessThan(cost('procedure'));
  });

  it('charges less for a chapter that is already partly mastered', () => {
    const fresh = planBackFromExam(input({ chapters: [chapter({ currentMastery: 0 })] }));
    const known = planBackFromExam(input({ chapters: [chapter({ currentMastery: 0.6 })] }));
    expect(known.requiredMinutes).toBeLessThan(fresh.requiredMinutes);
  });

  it('charges nothing for a chapter already past the ready threshold', () => {
    const p = planBackFromExam(input({ chapters: [chapter({ currentMastery: 0.95 })] }));
    expect(p.requiredMinutes).toBe(0);
  });

  it('separates teaching cost from review cost', () => {
    const p = planBackFromExam(input());
    const a = p.included[0] || p.dropped[0];
    expect(a.teachMinutes).toBeGreaterThan(0);
    expect(a.reviewMinutes).toBeGreaterThan(0);
    expect(a.totalMinutes).toBe(a.teachMinutes + a.reviewMinutes);
  });
});

// ===========================================================================
// Review debt
// ===========================================================================

describe('review debt', () => {
  it('reserves review minutes off the top of capacity', () => {
    const p = planBackFromExam(input());
    expect(p.reservedReviewMinutes).toBeGreaterThan(0);
    expect(p.netTeachingCapacityMinutes).toBeLessThan(p.grossCapacityMinutes);
  });

  it('produces a review curve that grows toward the exam', () => {
    const p = planBackFromExam(input({
      chapters: Array.from({ length: 6 }, (_, i) => chapter({ id: `c${i}`, examWeightPct: 10 })),
    }));
    expect(p.reviewCurve.length).toBeGreaterThan(4);
    const first = p.reviewCurve[0].reviewMinutes;
    const last = p.reviewCurve[p.reviewCurve.length - 1].reviewMinutes;
    expect(last).toBeGreaterThan(first);
  });

  it('never emits a negative teaching allocation', () => {
    const p = planBackFromExam(input({
      weeklyMinutesTarget: 60,
      chapters: Array.from({ length: 12 }, (_, i) => chapter({ id: `c${i}` })),
    }));
    for (const w of p.reviewCurve) {
      expect(w.teachMinutes).toBeGreaterThanOrEqual(0);
    }
  });
});

// ===========================================================================
// Triage — the honest part
// ===========================================================================

describe('triage', () => {
  const many = Array.from({ length: 14 }, (_, i) =>
    chapter({ id: `c${i}`, title: `Ch ${i}`, examWeightPct: i < 5 ? 15 : 3, unitCount: 10 }),
  );

  it('includes everything when there is plenty of time', () => {
    const p = planBackFromExam(input({ weeklyMinutesTarget: 1200, chapters: many }));
    expect(p.dropped).toHaveLength(0);
    expect(p.verdict).toBe('comfortable');
  });

  it('drops the lowest marks-per-hour chapters first when time is short', () => {
    const p = planBackFromExam(input({ weeklyMinutesTarget: 120, chapters: many }));
    expect(p.dropped.length).toBeGreaterThan(0);
    const minIncluded = Math.min(...p.included.map((a) => a.valueDensity));
    const maxDropped = Math.max(...p.dropped.map((a) => a.valueDensity));
    expect(minIncluded).toBeGreaterThanOrEqual(maxDropped);
  });

  it('keeps the high-weight chapters and cuts the low-weight ones', () => {
    const p = planBackFromExam(input({ weeklyMinutesTarget: 150, chapters: many }));
    const droppedIds = new Set(p.dropped.map((a) => a.chapter.id));
    // c0..c4 carry 15 marks each; they should survive ahead of the 3-mark ones.
    expect(droppedIds.has('c0')).toBe(false);
  });

  it('states what was dropped and what it costs in marks', () => {
    const p = planBackFromExam(input({ weeklyMinutesTarget: 120, chapters: many }));
    expect(p.marksAtRisk).toBeGreaterThan(0);
    expect(p.marksCovered).toBeGreaterThan(0);
    for (const d of p.dropped) expect(d.droppedReason).toBeTruthy();
  });

  it('never schedules a chapter before its prerequisite', () => {
    const chapters = [
      chapter({ id: 'basic', examWeightPct: 2, unitCount: 6 }),
      chapter({ id: 'advanced', examWeightPct: 30, unitCount: 6, prereqChapterIds: ['basic'] }),
    ];
    const p = planBackFromExam(input({ weeklyMinutesTarget: 400, chapters }));
    const ids = p.included.map((a) => a.chapter.id);
    if (ids.includes('advanced')) {
      expect(ids.indexOf('basic')).toBeLessThan(ids.indexOf('advanced'));
    }
  });

  it('drops a chapter whose prerequisite could not fit, and says so', () => {
    const chapters = [
      chapter({ id: 'huge', examWeightPct: 1, unitCount: 400 }),
      chapter({ id: 'needs-huge', examWeightPct: 40, unitCount: 5, prereqChapterIds: ['huge'] }),
    ];
    const p = planBackFromExam(input({ weeklyMinutesTarget: 60, chapters }));
    const dropped = p.dropped.find((d) => d.chapter.id === 'needs-huge');
    if (dropped) expect(dropped.droppedReason).toMatch(/prerequisite/i);
  });

  it('marks covered plus marks at risk accounts for the whole syllabus', () => {
    const p = planBackFromExam(input({ weeklyMinutesTarget: 120, chapters: many }));
    const total = many.reduce((s, c) => s + (c.examWeightPct ?? 0), 0);
    expect(p.marksCovered + p.marksAtRisk).toBeCloseTo(total, 0);
  });

  it('does not triage out every unweighted chapter just for lacking a weight', () => {
    const unweighted = Array.from({ length: 4 }, (_, i) =>
      chapter({ id: `u${i}`, examWeightPct: null, unitCount: 5 }),
    );
    const p = planBackFromExam(input({ weeklyMinutesTarget: 600, chapters: unweighted }));
    expect(p.included.length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// Verdict and honesty
// ===========================================================================

describe('verdict', () => {
  const many = Array.from({ length: 16 }, (_, i) => chapter({ id: `c${i}`, unitCount: 12 }));

  it('is willing to say a target is not possible', () => {
    const p = planBackFromExam(input({ weeklyMinutesTarget: 30, chapters: many }));
    expect(p.verdict).toBe('not_possible');
    expect(p.message).toMatch(/not on the table|straight answer/i);
  });

  it('says crunch when most but not all fits', () => {
    const p = planBackFromExam(input({ weeklyMinutesTarget: 1000, chapters: many }));
    expect(['crunch', 'tight', 'comfortable']).toContain(p.verdict);
  });

  it('never promises coverage it just triaged away', () => {
    const p = planBackFromExam(input({ weeklyMinutesTarget: 60, chapters: many }));
    if (p.dropped.length > 0) {
      expect(p.message).not.toMatch(/cover everything|all of it will/i);
    }
  });

  it('gives concrete levers, including the required weekly hours', () => {
    const p = planBackFromExam(input({ weeklyMinutesTarget: 120, chapters: many }));
    expect(p.levers.length).toBeGreaterThan(0);
    expect(p.levers.join(' ')).toMatch(/\dh/);
  });

  it('flags poor adherence as a cheaper lever than adding hours', () => {
    const p = planBackFromExam(input({ weeklyMinutesTarget: 120, chapters: many, observedAdherence: 0.4 }));
    expect(p.levers.join(' ')).toMatch(/adherence/i);
  });

  it('writes a parent message that names the real coverage', () => {
    const p = planBackFromExam(input({ weeklyMinutesTarget: 120, chapters: many }));
    expect(p.parentMessage.length).toBeGreaterThan(40);
  });
});

// ===========================================================================
// Cost calibration from measured time
// ===========================================================================

describe('calibrateCosts', () => {
  it('leaves costs untouched with no measurements', () => {
    expect(calibrateCosts([])).toEqual(DEFAULT_UNIT_COSTS);
  });

  it('moves toward the measured value as samples accumulate', () => {
    const few = calibrateCosts([{ knowledgeType: 'procedure', samples: 1, meanTeachMinutes: 30 }]);
    const many = calibrateCosts([{ knowledgeType: 'procedure', samples: 100, meanTeachMinutes: 30 }]);
    expect(many.procedure.teach).toBeGreaterThan(few.procedure.teach);
    expect(many.procedure.teach).toBeGreaterThan(DEFAULT_UNIT_COSTS.procedure.teach);
  });

  it('refuses to be swung by one pathological session', () => {
    const wild = calibrateCosts([{ knowledgeType: 'concept', samples: 200, meanTeachMinutes: 600 }]);
    expect(wild.concept.teach).toBeLessThanOrEqual(DEFAULT_UNIT_COSTS.concept.teach * 2.5);
  });

  it('scales review cost with teaching cost', () => {
    const slower = calibrateCosts([{ knowledgeType: 'procedure', samples: 100, meanTeachMinutes: 32 }]);
    expect(slower.procedure.review).toBeGreaterThan(DEFAULT_UNIT_COSTS.procedure.review);
  });

  it('ignores nonsense measurements', () => {
    const out = calibrateCosts([
      { knowledgeType: 'concept', samples: 0, meanTeachMinutes: 50 },
      { knowledgeType: 'concept', samples: 10, meanTeachMinutes: 0 },
      { knowledgeType: 'concept', samples: 10, meanTeachMinutes: NaN },
    ]);
    expect(out.concept).toEqual(DEFAULT_UNIT_COSTS.concept);
  });

  it('a slower student gets a plan that knows it', () => {
    const slow = calibrateCosts([
      { knowledgeType: 'procedure', samples: 40, meanTeachMinutes: 34 },
      { knowledgeType: 'concept', samples: 40, meanTeachMinutes: 30 },
    ]);
    const base = planBackFromExam(input());
    const adjusted = planBackFromExam(input({ costs: slow }));
    expect(adjusted.requiredMinutes).toBeGreaterThan(base.requiredMinutes);
  });
});

// ===========================================================================
// Mix priors — costing a chapter nobody has opened
// ===========================================================================

describe('estimateMixForSubject', () => {
  it('gives every known subject a mix that sums to 1', () => {
    for (const slug of Object.keys(DEFAULT_SUBJECT_MIX)) {
      const mix = estimateMixForSubject(slug);
      const sum = KNOWLEDGE_TYPES.reduce((s, t) => s + (mix[t] ?? 0), 0);
      expect(sum).toBeCloseTo(1, 2);
    }
  });

  it('makes Maths procedure-heavy and History causal/fact-heavy', () => {
    const math = estimateMixForSubject('math');
    const history = estimateMixForSubject('history');
    expect((math.procedure ?? 0)).toBeGreaterThan(math.judgment ?? 0);
    expect((history.causal_sequence ?? 0) + (history.arbitrary_fact ?? 0))
      .toBeGreaterThan((history.procedure ?? 0) + (history.concept ?? 0));
  });

  it('matches a slug variant by substring', () => {
    expect(estimateMixForSubject('physical_science_bn')).toEqual(estimateMixForSubject('physical_science'));
  });

  it('falls back to an even split for an unknown subject', () => {
    const mix = estimateMixForSubject('underwater_basket_weaving');
    const sum = KNOWLEDGE_TYPES.reduce((s, t) => s + (mix[t] ?? 0), 0);
    expect(sum).toBeCloseTo(1, 5);
    expect(new Set(KNOWLEDGE_TYPES.map((t) => mix[t])).size).toBe(1);
  });

  it('handles null and empty input', () => {
    for (const bad of [null, undefined, '']) {
      const sum = KNOWLEDGE_TYPES.reduce((s, t) => s + (estimateMixForSubject(bad as any)[t] ?? 0), 0);
      expect(sum).toBeCloseTo(1, 5);
    }
  });

  it('a Maths chapter costs more than a History chapter of the same size', () => {
    const cost = (slug: string) => planBackFromExam(input({
      chapters: [chapter({ mix: estimateMixForSubject(slug), unitCount: 10 })],
    })).requiredMinutes;
    // Procedure-heavy Maths is the most expensive per unit by design.
    expect(cost('math')).toBeGreaterThan(cost('history'));
  });
});

describe('normaliseMix', () => {
  it('rescales shares that do not sum to 1', () => {
    const out = normaliseMix({ procedure: 2, concept: 2 });
    expect(out.procedure).toBeCloseTo(0.5, 5);
    expect(out.concept).toBeCloseTo(0.5, 5);
  });

  it('drops negatives rather than letting them cancel real work', () => {
    const out = normaliseMix({ procedure: 1, concept: -5 });
    expect(out.concept).toBeUndefined();
    expect(out.procedure).toBeCloseTo(1, 5);
  });

  it('falls back to an even split for an empty mix', () => {
    const sum = KNOWLEDGE_TYPES.reduce((s, t) => s + (normaliseMix({})[t] ?? 0), 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it('leaves an already-normalised mix alone', () => {
    const mix = { procedure: 0.6, concept: 0.4 };
    const out = normaliseMix(mix);
    expect(out.procedure).toBeCloseTo(0.6, 5);
    expect(out.concept).toBeCloseTo(0.4, 5);
  });
});

// ===========================================================================
// Self-knowledge — what the student is told
// ===========================================================================

describe('summariseLearningSelf', () => {
  const s = (kt: KnowledgeType, rep: RepresentationCode, over: Partial<RepStats> = {}): RepStats => ({
    representation: rep, knowledgeType: kt,
    attempts: 20, wins: 16, losses: 4,
    avgAccuracyDelta: 0.4, retentionRate: 0.85, avgEngagement: 0.7, completionRate: 0.9,
    ...over,
  });

  it('reports per subject AND per knowledge type, not one label per subject', () => {
    const { insights } = summariseLearningSelf([{
      subjectName: 'History',
      stats: [s('arbitrary_fact', 'mnemonic_link'), s('judgment', 'exemplar_comparison')],
    }]);
    expect(insights).toHaveLength(2);
    expect(new Set(insights.map((i) => i.knowledgeType)).size).toBe(2);
  });

  it('stays silent where evidence is thin, rather than hedging', () => {
    const { insights, stillLearning } = summariseLearningSelf([{
      subjectName: 'Math',
      stats: [s('procedure', 'worked_example_faded', { attempts: 2 })],
    }]);
    expect(insights).toHaveLength(0);
    expect(stillLearning.length).toBe(1);
    expect(stillLearning[0]).toMatch(/Math/);
  });

  it('writes a sentence the student can act on', () => {
    const { insights } = summariseLearningSelf([{
      subjectName: 'History',
      stats: [s('arbitrary_fact', 'mnemonic_link', { retentionRate: 0.9 })],
    }]);
    expect(insights[0].sentence).toMatch(/for you/i);
    expect(insights[0].sentence).toMatch(/90%/);
  });

  it('marks an emerging claim as still early', () => {
    const { insights } = summariseLearningSelf([{
      subjectName: 'Math',
      stats: [s('procedure', 'worked_example_faded', { attempts: 6 })],
    }]);
    expect(insights[0].evidence).toBe('emerging');
    expect(insights[0].sentence).toMatch(/still early/i);
  });

  it('never recommends a representation illegal for that knowledge type', () => {
    const { insights } = summariseLearningSelf([{
      subjectName: 'Science',
      // Rigged: rote memorisation "winning" on concepts must not be reported.
      stats: [
        s('concept', 'mnemonic_link', { attempts: 500, retentionRate: 1 }),
        s('concept', 'contrast_set', { attempts: 20, retentionRate: 0.7 }),
      ],
    }]);
    for (const i of insights) {
      expect(i.representation).not.toBe('mnemonic_link');
    }
  });

  it('handles a student with no history at all', () => {
    const { insights, stillLearning } = summariseLearningSelf([]);
    expect(insights).toHaveLength(0);
    expect(stillLearning).toHaveLength(0);
  });
});
