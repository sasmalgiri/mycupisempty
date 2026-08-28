import { describe, it, expect } from 'vitest';
import { generatePlan, type PlanInput } from '../plan-generator';

// NOTE: these fixtures are deliberately NOT cast with `as any`. They were, and
// the casts hid the fact that every field was snake_case (DB row shape) while
// generatePlan takes camelCase — so the suite exercised a plan built entirely
// from undefined. Typing them means the compiler catches the next drift.

const baseCourse: PlanInput['course'] = {
  boardCode: 'wbbse',
  classLevel: 10,
  language: 'bn',
  expectedWeeks: 24,
};

const baseSubjects: PlanInput['subjects'] = [
  { id: 's-math', subjectSlug: 'math', totalChapters: 6, expectedHoursPerYear: 200 },
  { id: 's-phys', subjectSlug: 'physical_science', totalChapters: 4, expectedHoursPerYear: 150 },
  { id: 's-life', subjectSlug: 'life_science', totalChapters: 4, expectedHoursPerYear: 140 },
];

function chapter(idx: number, scId: string): PlanInput['chapters'][number] {
  return {
    id: `${scId}-ch-${idx}`,
    subjectClassId: scId,
    chapterNo: idx,
    titleEn: `${scId} ch${idx}`,
    seasonHint: idx <= 2 ? 'early' : idx <= 4 ? 'mid' : 'late',
    expectedHours: 12,
    prereqChapterIds: [],
    examWeightPct: null,
    maturityBand: 4,
  };
}

const baseChapters: PlanInput['chapters'] = [
  ...Array.from({ length: 6 }, (_, i) => chapter(i + 1, 's-math')),
  ...Array.from({ length: 4 }, (_, i) => chapter(i + 1, 's-phys')),
  ...Array.from({ length: 4 }, (_, i) => chapter(i + 1, 's-life')),
];

const basePersona: PlanInput['persona'] = {
  dailyStudyMinutesAvailable: 90,
  bestStudyTime: 'evening',
  energyAfterSchool: null,
  effortTolerance: 0.6,
  perfectionism: null,
};

const baseEnrollment: PlanInput['enrollment'] = {
  startDate: '2026-04-01',
  weeklyMinutesTarget: 600,
};

function planInput(extra?: Partial<PlanInput>): PlanInput {
  return {
    course: baseCourse,
    subjects: baseSubjects,
    chapters: baseChapters,
    persona: basePersona,
    enrollment: baseEnrollment,
    calendars: [],
    ...extra,
  };
}

const sumMinutes = (plan: ReturnType<typeof generatePlan>, slug: string) =>
  plan.weeks.reduce(
    (sum, w) =>
      sum +
      w.blocks
        .filter((b) => b.subjectSlug === slug)
        .reduce((s, b) => s + b.allocatedMinutes, 0),
    0,
  );

describe('plan-generator pace + career levers', () => {
  it('produces a deterministic plan with all subjects represented', () => {
    const plan = generatePlan(planInput());
    expect(plan.weeks.length).toBeGreaterThan(0);
    const subjectsSeen = new Set<string>();
    for (const w of plan.weeks) for (const b of w.blocks) subjectsSeen.add(b.subjectSlug);
    expect(subjectsSeen.size).toBe(3);
  });

  it('honours per-subject pace_multipliers — slower subject gets more minutes per chapter', () => {
    const slowMath = generatePlan(planInput({
      enrollment: { ...baseEnrollment, paceMultipliers: { math: 1.8, physical_science: 0.6, life_science: 0.6 } },
    }));
    const fastMath = generatePlan(planInput({
      enrollment: { ...baseEnrollment, paceMultipliers: { math: 0.6, physical_science: 1.2, life_science: 1.2 } },
    }));
    expect(sumMinutes(slowMath, 'math')).toBeGreaterThan(sumMinutes(fastMath, 'math'));
  });

  it('career=engineer tilts more time toward math + physical_science vs unsure', () => {
    const engineer = generatePlan(planInput({ careerPath: 'engineer' }));
    const baseline = generatePlan(planInput({ careerPath: 'unsure' }));
    const ratioE = sumMinutes(engineer, 'math') / Math.max(1, sumMinutes(engineer, 'life_science'));
    const ratioU = sumMinutes(baseline, 'math') / Math.max(1, sumMinutes(baseline, 'life_science'));
    expect(ratioE).toBeGreaterThan(ratioU);
  });

  it('clamps pace multipliers outside [0.3, 2.0]', () => {
    // With absurd 9.0 the planner should still produce a valid plan (no crash, all subjects covered)
    const plan = generatePlan(planInput({
      enrollment: { ...baseEnrollment, paceMultipliers: { math: 9.0, physical_science: 0.01, life_science: 1.0 } },
    }));
    expect(plan.weeks.length).toBeGreaterThan(0);
    const ms = plan.weeks.flatMap((w) => w.blocks).filter((b) => b.subjectSlug === 'physical_science');
    expect(ms.length).toBeGreaterThan(0);   // clamping prevented physical_science from disappearing
  });
});
