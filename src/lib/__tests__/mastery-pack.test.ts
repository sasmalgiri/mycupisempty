import { describe, it, expect } from 'vitest';
import {
  allocateQuestions, legalQuestionTypes, questionFit, buildPack,
  constructPromptFor, renderPack, MIN_QUESTION_FIT, QUESTION_MARKS,
  REVIEW_SCHEDULE_DAYS,
  type ExamShape, type PackUnit,
} from '../mastery-pack';
import {
  diagnose, profilePaper, similarity, deeperOf,
  type AttemptEvidence,
} from '../answer-diagnosis';
import { KNOWLEDGE_TYPES, type KnowledgeType } from '../conversion-engine';

// The real WBBSE Class 5 3rd Summative blueprint, from exam_shape_profiles.
const SUMMATIVE_3: ExamShape = {
  examKind: 'summative_3',
  totalMarks: 60,
  durationMinutes: 120,
  typeProportions: { mcq: 0.20, fill_blank: 0.20, very_short: 0.25, short: 0.25, long: 0.10 },
};

function unit(over: Partial<PackUnit> = {}): PackUnit {
  return {
    unitId: over.unitId || 'u1',
    heading: over.heading || 'Place value',
    knowledgeType: over.knowledgeType || 'procedure',
    typeLabel: 'Skill to build',
    representation: 'worked_example_faded',
    representationLabel: 'Fading worked examples',
    body: over.body || 'Some teaching text about the topic that runs to a reasonable length.',
    constructPrompt: 'build it',
    questions: over.questions || [],
    checkQuestion: 'Do a fresh one unaided.',
    retentionProbeDays: 7,
    ...over,
  };
}

// ===========================================================================
// Question type follows knowledge type
// ===========================================================================

describe('question fit', () => {
  it('never sets a long essay on a bare fact', () => {
    expect(legalQuestionTypes('arbitrary_fact')).not.toContain('long');
  });

  it('never sets a fill-in-the-blank on a judgement', () => {
    expect(legalQuestionTypes('judgment')).not.toContain('fill_blank');
    expect(questionFit('judgment', 'fill_blank')).toBe(0);
  });

  it('puts fill-blank and one-liners at the top for facts', () => {
    expect(legalQuestionTypes('arbitrary_fact')[0]).toBe('fill_blank');
  });

  it('puts short-answer at the top for procedures', () => {
    expect(legalQuestionTypes('procedure')[0]).toBe('short');
  });

  it('puts long answer at the top for judgement', () => {
    expect(legalQuestionTypes('judgment')[0]).toBe('long');
  });

  it('gives every knowledge type at least two usable question types', () => {
    for (const k of KNOWLEDGE_TYPES) {
      expect(legalQuestionTypes(k).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('every legal type clears the fit floor', () => {
    for (const k of KNOWLEDGE_TYPES) {
      for (const q of legalQuestionTypes(k)) {
        expect(questionFit(k, q)).toBeGreaterThanOrEqual(MIN_QUESTION_FIT);
      }
    }
  });
});

// ===========================================================================
// Allocation against the real blueprint
// ===========================================================================

describe('allocateQuestions', () => {
  const units = [
    { unitId: 'a', knowledgeType: 'arbitrary_fact' as KnowledgeType },
    { unitId: 'b', knowledgeType: 'procedure' as KnowledgeType },
    { unitId: 'c', knowledgeType: 'concept' as KnowledgeType },
    { unitId: 'd', knowledgeType: 'judgment' as KnowledgeType },
  ];

  it('produces questions across the blueprint types', () => {
    const qs = allocateQuestions(units, SUMMATIVE_3);
    expect(qs.length).toBeGreaterThan(5);
    expect(new Set(qs.map((q) => q.questionType)).size).toBeGreaterThanOrEqual(4);
  });

  it('never assigns a question type a unit cannot support', () => {
    for (const q of allocateQuestions(units, SUMMATIVE_3)) {
      expect(questionFit(q.knowledgeType, q.questionType)).toBeGreaterThanOrEqual(MIN_QUESTION_FIT);
    }
  });

  it('sends long answers to the judgement unit, not the fact unit', () => {
    const longs = allocateQuestions(units, SUMMATIVE_3).filter((q) => q.questionType === 'long');
    for (const q of longs) expect(q.knowledgeType).not.toBe('arbitrary_fact');
  });

  it('sends fill-blanks to the fact unit', () => {
    const fills = allocateQuestions(units, SUMMATIVE_3).filter((q) => q.questionType === 'fill_blank');
    expect(fills.length).toBeGreaterThan(0);
    expect(fills.some((q) => q.knowledgeType === 'arbitrary_fact')).toBe(true);
  });

  it('roughly honours the blueprint mark distribution', () => {
    const qs = allocateQuestions(units, SUMMATIVE_3);
    const total = qs.reduce((s, q) => s + q.marks, 0);
    const mcqMarks = qs.filter((q) => q.questionType === 'mcq').reduce((s, q) => s + q.marks, 0);
    expect(mcqMarks / total).toBeGreaterThan(0.08);
    expect(mcqMarks / total).toBeLessThan(0.40);
  });

  it('scales down for a chapter that is only part of the paper', () => {
    const full = allocateQuestions(units, SUMMATIVE_3, 1);
    const part = allocateQuestions(units, SUMMATIVE_3, 0.25);
    expect(part.length).toBeLessThan(full.length);
  });

  it('handles a chapter with no units', () => {
    expect(allocateQuestions([], SUMMATIVE_3)).toEqual([]);
  });

  it('handles a chapter that is entirely judgement', () => {
    const only = [{ unitId: 'j', knowledgeType: 'judgment' as KnowledgeType }];
    const qs = allocateQuestions(only, SUMMATIVE_3);
    expect(qs.length).toBeGreaterThan(0);
    expect(qs.every((q) => q.questionType !== 'fill_blank')).toBe(true);
  });
});

// ===========================================================================
// The pack
// ===========================================================================

describe('buildPack', () => {
  const base = {
    chapterId: 'ch1', chapterTitle: 'Numbers up to 10,00,000',
    subjectName: 'Math', classLevel: 5, exam: SUMMATIVE_3,
  };

  it('reports the mix and totals', () => {
    const pack = buildPack({ ...base, units: [
      unit({ unitId: 'a', knowledgeType: 'arbitrary_fact' }),
      unit({ unitId: 'b', knowledgeType: 'procedure', questions: [
        { id: 'q1', unitId: 'b', questionType: 'short', marks: 3, prompt: 'Solve', answer: '42' },
      ] }),
    ] });
    expect(pack.mix.arbitrary_fact).toBeCloseTo(0.5, 5);
    expect(pack.practiceMarks).toBe(3);
    expect(pack.estimatedMinutes).toBeGreaterThan(0);
  });

  it('schedules four expanding retrievals', () => {
    const pack = buildPack({ ...base, units: [unit()] });
    expect(pack.reviewSchedule).toEqual(REVIEW_SCHEDULE_DAYS);
    for (let i = 1; i < pack.reviewSchedule.length; i++) {
      expect(pack.reviewSchedule[i]).toBeGreaterThan(pack.reviewSchedule[i - 1]);
    }
  });

  it('promises working, not reading — and says what skipping review costs', () => {
    const pack = buildPack({ ...base, units: [unit()] });
    expect(pack.promise).toMatch(/work through/i);
    expect(pack.promise).not.toMatch(/read (this|it) and you will remember/i);
    expect(pack.promise).toMatch(/skip/i);
  });

  it('renders without throwing and includes the build step', () => {
    const pack = buildPack({ ...base, units: [unit({ questions: [
      { id: 'q', unitId: 'u1', questionType: 'mcq', marks: 1, prompt: 'Which?', options: ['a', 'b'], answer: 'a' },
    ] })] });
    const text = renderPack(pack);
    expect(text).toContain('BUILD IT');
    expect(text).toContain('Numbers up to 10,00,000');
    expect(text).toMatch(/Retrieval: days/);
  });
});

describe('constructPromptFor', () => {
  it('asks the student to produce something, for every knowledge type', () => {
    for (const k of KNOWLEDGE_TYPES) {
      const p = constructPromptFor(k, 'Some topic', 'Math');
      expect(p.length).toBeGreaterThan(60);
      expect(p).toMatch(/your|you /i);
    }
  });

  it('never simply hands over the answer', () => {
    for (const k of KNOWLEDGE_TYPES) {
      expect(constructPromptFor(k, 'X', 'Math')).not.toMatch(/here is the (answer|mnemonic|story)/i);
    }
  });

  it('differs per knowledge type', () => {
    const all = KNOWLEDGE_TYPES.map((k) => constructPromptFor(k, 'X', 'Math'));
    expect(new Set(all).size).toBe(KNOWLEDGE_TYPES.length);
  });
});

// ===========================================================================
// Answer diagnosis
// ===========================================================================

function ev(over: Partial<AttemptEvidence> = {}): AttemptEvidence {
  return {
    questionId: 'q1',
    answerGiven: 'wrong',
    expectedAnswer: 'right',
    isCorrect: false,
    timeSpentSeconds: 60,
    expectedSeconds: 60,
    daysSinceTaught: 3,
    ...over,
  };
}

describe('diagnose', () => {
  it('recognises a correct answer', () => {
    expect(diagnose(ev({ isCorrect: true })).kind).toBe('correct');
  });

  it('recognises not attempted, and separates ran-out from avoided', () => {
    const ranOut = diagnose(ev({ answerGiven: '', timeSpentSeconds: 5, expectedSeconds: 60 }));
    const avoided = diagnose(ev({ answerGiven: '', timeSpentSeconds: 90, expectedSeconds: 60 }));
    expect(ranOut.kind).toBe('not_attempted');
    expect(avoided.kind).toBe('not_attempted');
    expect(ranOut.reason).not.toBe(avoided.reason);
  });

  it('calls a fast near-miss on known material careless', () => {
    const d = diagnose(ev({
      answerGiven: 'the water cycle evaporation', expectedAnswer: 'the water cycle evaporation condensation',
      timeSpentSeconds: 10, expectedSeconds: 60, previouslyCorrect: true,
    }));
    expect(d.kind).toBe('careless');
    expect(d.action).toMatch(/do not re-teach/i);
  });

  it('calls decayed known material retrieval, not conceptual', () => {
    const d = diagnose(ev({ previouslyCorrect: true, daysSinceTaught: 20 }));
    expect(d.kind).toBe('retrieval');
    expect(d.action).toMatch(/spacing/i);
  });

  it('calls partial marks procedural', () => {
    const d = diagnose(ev({ marksAwarded: 2, marksAvailable: 5, isCorrect: false }));
    expect(d.kind).toBe('procedural');
    expect(d.action).toMatch(/scaffold/i);
  });

  it('calls wrong-but-confident conceptual', () => {
    const d = diagnose(ev({ confidenceBefore: 0.9 }));
    expect(d.kind).toBe('conceptual');
    expect(d.reason).toMatch(/confident/i);
  });

  it('treats never-taught material as transfer, not forgetting', () => {
    const d = diagnose(ev({ daysSinceTaught: null }));
    expect(d.kind).toBe('transfer');
    expect(d.resolvedDeeper).toBe(true);
  });

  it('resolves DEEPER when signals are thin — never assumes a slip', () => {
    const d = diagnose(ev({ timeSpentSeconds: undefined, expectedSeconds: undefined }));
    expect(d.kind).toBe('conceptual');
    expect(d.resolvedDeeper).toBe(true);
    expect(d.confidence).toBeLessThan(0.6);
  });

  it('does not call a slow near-miss careless', () => {
    const d = diagnose(ev({
      answerGiven: 'almost the right answer here', expectedAnswer: 'almost the right answer there',
      timeSpentSeconds: 200, expectedSeconds: 60, previouslyCorrect: true,
    }));
    expect(d.kind).not.toBe('careless');
  });

  it('every diagnosis carries a distinct action', () => {
    const kinds = new Set([
      diagnose(ev({ isCorrect: true })).action,
      diagnose(ev({ answerGiven: '' })).action,
      diagnose(ev({ previouslyCorrect: true, daysSinceTaught: 30 })).action,
      diagnose(ev({ marksAwarded: 1, marksAvailable: 5 })).action,
      diagnose(ev({ confidenceBefore: 0.95 })).action,
    ]);
    expect(kinds.size).toBe(5);
  });
});

describe('profilePaper', () => {
  it('leads with the dominant error kind, not the score', () => {
    const evidence = [
      ev({ questionId: '1', previouslyCorrect: true, daysSinceTaught: 20, marksAwarded: 0, marksAvailable: 5 }),
      ev({ questionId: '2', previouslyCorrect: true, daysSinceTaught: 25, marksAwarded: 0, marksAvailable: 5 }),
      ev({ questionId: '3', isCorrect: true, marksAwarded: 5, marksAvailable: 5 }),
    ];
    const p = profilePaper(evidence.map(diagnose), evidence);
    expect(p.headline).toMatch(/review-schedule problem/i);
    expect(p.scorePct).toBe(33);
  });

  it('reports per knowledge type, which is what feeds calibration', () => {
    const evidence = [
      ev({ questionId: '1', knowledgeType: 'arbitrary_fact', isCorrect: true, marksAwarded: 1, marksAvailable: 1 }),
      ev({ questionId: '2', knowledgeType: 'arbitrary_fact', confidenceBefore: 0.9, marksAwarded: 0, marksAvailable: 1 }),
      ev({ questionId: '3', knowledgeType: 'procedure', marksAwarded: 1, marksAvailable: 5 }),
    ];
    const p = profilePaper(evidence.map(diagnose), evidence);
    expect(p.byKnowledgeType.length).toBe(2);
    const fact = p.byKnowledgeType.find((t) => t.knowledgeType === 'arbitrary_fact')!;
    expect(fact.attempted).toBe(2);
    expect(fact.correct).toBe(1);
  });

  it('says everything correct when it is', () => {
    const evidence = [ev({ isCorrect: true, marksAwarded: 5, marksAvailable: 5 })];
    expect(profilePaper(evidence.map(diagnose), evidence).headline).toMatch(/everything correct/i);
  });

  it('gives actionable recommendations, most valuable first', () => {
    const evidence = [
      ev({ questionId: '1', confidenceBefore: 0.9 }),
      ev({ questionId: '2', confidenceBefore: 0.9 }),
      ev({ questionId: '3', previouslyCorrect: true, daysSinceTaught: 30 }),
    ];
    const p = profilePaper(evidence.map(diagnose), evidence);
    expect(p.recommendations.length).toBeGreaterThan(0);
    expect(p.recommendations[0]).toMatch(/wrong idea underneath/i);
  });

  it('handles an empty paper', () => {
    const p = profilePaper([], []);
    expect(p.total).toBe(0);
    expect(p.scorePct).toBeNull();
  });
});

describe('similarity', () => {
  it('scores identical answers 1', () => {
    expect(similarity('the water cycle', 'the water cycle')).toBeCloseTo(1, 5);
  });
  it('scores unrelated answers near 0', () => {
    expect(similarity('photosynthesis', 'quadratic formula')).toBeLessThan(0.2);
  });
  it('scores a near miss high', () => {
    expect(similarity('evaporation condensation rain', 'evaporation condensation rainfall')).toBeGreaterThan(0.6);
  });
  it('handles empty strings', () => {
    expect(similarity('', 'anything')).toBe(0);
  });
});

describe('deeperOf', () => {
  it('prefers the more expensive cause', () => {
    expect(deeperOf('careless', 'conceptual')).toBe('conceptual');
    expect(deeperOf('conceptual', 'careless')).toBe('conceptual');
    expect(deeperOf('correct', 'retrieval')).toBe('retrieval');
  });
});
