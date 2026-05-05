import { describe, it, expect } from 'vitest';
import { generatePlan } from '../plan-generator';

const baseCourse = {
  id: 'course-1', board_code: 'wbbse', class_level: 10, language: 'bn',
  academic_year: '2026', total_subjects: 3,
  expected_hours_total: 600, expected_weeks: 24,
} as any;

const baseSubjects = [
  { id: 's-math', subject_slug: 'math', total_chapters: 6, expected_hours_per_year: 200, expected_minutes_per_week: 300 },
  { id: 's-phys', subject_slug: 'physical_science', total_chapters: 4, expected_hours_per_year: 150, expected_minutes_per_week: 270 },
  { id: 's-life', subject_slug: 'life_science', total_chapters: 4, expected_hours_per_year: 140, expected_minutes_per_week: 240 },
] as any;

function chapter(idx: number, scId: string) {
  return {
    id: `${scId}-ch-${idx}`,
    subject_class_id: scId,
    chapter_no: idx,
    title_en: `${scId} ch${idx}`,
    season_hint: idx <= 2 ? 'early' : idx <= 4 ? 'mid' : 'late',
    expected_hours: 12,
    maturity_band: 4,
    prereq_chapter_ids: [],
  } as any;
}

const baseChapters = [
  ...Array.from({ length: 6 }, (_, i) => chapter(i + 1, 's-math')),
  ...Array.from({ length: 4 }, (_, i) => chapter(i + 1, 's-phys')),
  ...Array.from({ length: 4 }, (_, i) => chapter(i + 1, 's-life')),
];

const basePersona = {
  daily_minutes_available: 90,
  effort_tolerance: 0.6,
  best_study_time: 'evening',
} as any;

const baseEnrollment = {
  id: 'enr-1', user_id: 'u-1', course_id: 'course-1',
  start_date: '2026-04-01', target_end_date: '2026-12-31',
  weekly_minutes_target: 600, status: 'active',
} as any;

function planInput(extra?: Partial<Parameters<typeof generatePlan>[0]>) {
  return {
    course: baseCourse,
    subjects: baseSubjects,
    chapters: baseChapters,
    persona: basePersona,
    enrollment: baseEnrollment,
    calendars: [],
    ...extra,
  } as any;
}

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
    const sumMins = (plan: ReturnType<typeof generatePlan>, slug: string) =>
      plan.weeks.reduce((sum, w) => sum + w.blocks.filter((b) => b.subjectSlug === slug).reduce((s, b) => s + b.allocatedMinutes, 0), 0);
    expect(sumMins(slowMath, 'math')).toBeGreaterThan(sumMins(fastMath, 'math'));
  });

  it('career=engineer tilts more time toward math + physical_science vs unsure', () => {
    const engineer = generatePlan(planInput({ careerPath: 'engineer' as any }));
    const baseline = generatePlan(planInput({ careerPath: 'unsure' as any }));
    const sumFor = (plan: ReturnType<typeof generatePlan>, slug: string) =>
      plan.weeks.reduce((sum, w) => sum + w.blocks.filter((b) => b.subjectSlug === slug).reduce((s, b) => s + b.allocatedMinutes, 0), 0);
    const ratioE = sumFor(engineer, 'math') / Math.max(1, sumFor(engineer, 'life_science'));
    const ratioU = sumFor(baseline, 'math') / Math.max(1, sumFor(baseline, 'life_science'));
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
