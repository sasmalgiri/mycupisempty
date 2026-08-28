/**
 * Mastery Pack — one chapter, converted into everything needed to own it.
 *
 * ---------------------------------------------------------------------------
 * THE BRIEF, AND THE ONE CORRECTION TO IT
 * ---------------------------------------------------------------------------
 * The ask was: convert each chapter so that once a student reads it she
 * remembers all of it, can replicate it, and can solve any question from it.
 *
 * Two of those three are achievable as stated. "Once she reads it" is not, and
 * pretending otherwise would build the wrong thing. Reading is the weakest
 * encoding there is — recognition feels like knowing and disappears in a week.
 * Lorayne's own method is not a reading method: the student BUILDS the image,
 * and that construction is where the memory forms.
 *
 * So a pack is built to be WORKED once and RETRIEVED four times, not read. The
 * three promised outcomes map onto three layers:
 *
 *   REMEMBER  → the student constructs her own memory artefact per unit
 *               (Lorayne link/peg/substitute for facts, causal chain for
 *                processes, contrast set for concepts, map for structures)
 *   REPLICATE → faded worked examples: full → partial → solo, one support
 *               removed at a time
 *   SOLVE     → questions in the real exam's shape, generated per unit, so
 *               practice matches the paper she will actually sit
 *
 * Plus a retrieval schedule, because without it the other three decay.
 *
 * ---------------------------------------------------------------------------
 * THE IDEA THAT MAKES THE SOLVE LAYER WORK
 * ---------------------------------------------------------------------------
 * Question type should follow KNOWLEDGE type, not be sprinkled at random to
 * hit a mark distribution. A fact is tested by fill-in-the-blank or one-word
 * recall; a procedure by "solve this"; a concept by a discriminating MCQ where
 * the distractors are near-misses; a judgement by a long answer. Generating a
 * long essay question about a valency, or an MCQ about an essay, is how
 * practice ends up feeling unlike the exam.
 *
 * QUESTION_FIT below encodes that, and the pack reconciles it against the
 * board's real mark proportions.
 *
 * Pure functions. No I/O, no model calls — the generator script supplies text.
 */

import {
  KNOWLEDGE_TYPES,
  REPRESENTATION_LABEL,
  KNOWLEDGE_TYPE_LABEL,
  type KnowledgeType,
  type RepresentationCode,
  type ConversionPlan,
} from './conversion-engine';

// ============================================================================
// 1. Question types — the shapes a WB paper actually uses
// ============================================================================

export type QuestionType = 'mcq' | 'fill_blank' | 'very_short' | 'short' | 'long';

export const QUESTION_LABEL: Record<QuestionType, string> = {
  mcq: 'Multiple choice',
  fill_blank: 'Fill in the blank',
  very_short: 'One-line answer',
  short: 'Short answer',
  long: 'Long answer',
};

/** Typical marks per question type in WB summative papers. */
export const QUESTION_MARKS: Record<QuestionType, number> = {
  mcq: 1, fill_blank: 1, very_short: 1, short: 3, long: 5,
};

/**
 * How well each question type tests each kind of knowledge, 0..1.
 *
 * The zeros carry the weight. `arbitrary_fact x long = 0.05` says: do not set
 * a five-mark essay on something whose whole content is one remembered word.
 * `judgment x fill_blank = 0.0` says the opposite — a judgement has no single
 * correct token to blank out, and pretending it does teaches the student that
 * interpretation has one right answer.
 */
const QUESTION_FIT: Record<KnowledgeType, Record<QuestionType, number>> = {
  arbitrary_fact:       { fill_blank: 1.00, very_short: 0.95, mcq: 0.85, short: 0.30, long: 0.05 },
  causal_sequence:      { short: 0.95, mcq: 0.70, very_short: 0.60, long: 0.55, fill_blank: 0.40 },
  concept:              { mcq: 0.90, short: 0.85, very_short: 0.60, long: 0.55, fill_blank: 0.25 },
  procedure:            { short: 1.00, long: 0.80, very_short: 0.45, mcq: 0.35, fill_blank: 0.20 },
  relational_structure: { mcq: 0.85, short: 0.85, fill_blank: 0.55, very_short: 0.50, long: 0.45 },
  judgment:             { long: 1.00, short: 0.70, mcq: 0.25, very_short: 0.15, fill_blank: 0.00 },
};

/** Below this, a question type is never generated for that knowledge type. */
export const MIN_QUESTION_FIT = 0.3;

export function questionFit(k: KnowledgeType, q: QuestionType): number {
  return QUESTION_FIT[k]?.[q] ?? 0;
}

export function legalQuestionTypes(k: KnowledgeType): QuestionType[] {
  return (Object.keys(QUESTION_MARKS) as QuestionType[])
    .filter((q) => questionFit(k, q) >= MIN_QUESTION_FIT)
    .sort((a, b) => questionFit(k, b) - questionFit(k, a));
}

// ============================================================================
// 2. Exam shape
// ============================================================================

export interface ExamShape {
  examKind: string;
  totalMarks: number;
  durationMinutes: number;
  /** Share of MARKS per question type, e.g. {mcq:0.2, short:0.25, ...}. */
  typeProportions: Partial<Record<QuestionType, number>>;
}

/**
 * How many questions of each type this chapter's practice should contain.
 *
 * Two constraints pull against each other: the board's mark distribution, and
 * what each unit's knowledge type can legitimately be asked about. We honour
 * the board proportions for the overall shape, then assign each slot to the
 * unit that best fits it — so the paper looks like the real one AND no unit is
 * asked a question its content cannot support.
 */
export function allocateQuestions(
  units: Array<{ unitId: string; knowledgeType: KnowledgeType }>,
  exam: ExamShape,
  chapterShareOfPaper = 1,
): Array<{ unitId: string; knowledgeType: KnowledgeType; questionType: QuestionType; marks: number }> {
  const out: Array<{ unitId: string; knowledgeType: KnowledgeType; questionType: QuestionType; marks: number }> = [];
  if (units.length === 0) return out;

  const budget = Math.max(5, Math.round(exam.totalMarks * chapterShareOfPaper));

  for (const [qt, share] of Object.entries(exam.typeProportions) as Array<[QuestionType, number]>) {
    if (!share || share <= 0) continue;
    const marksForType = budget * share;
    const count = Math.max(0, Math.round(marksForType / QUESTION_MARKS[qt]));

    // Units that can legitimately carry this question type, best fit first.
    const eligible = units
      .filter((u) => questionFit(u.knowledgeType, qt) >= MIN_QUESTION_FIT)
      .sort((a, b) => questionFit(b.knowledgeType, qt) - questionFit(a.knowledgeType, qt));

    if (eligible.length === 0) continue;

    for (let i = 0; i < count; i++) {
      const u = eligible[i % eligible.length];
      out.push({ unitId: u.unitId, knowledgeType: u.knowledgeType, questionType: qt, marks: QUESTION_MARKS[qt] });
    }
  }

  return out;
}

// ============================================================================
// 3. The pack
// ============================================================================

export interface PackQuestion {
  id: string;
  unitId: string;
  questionType: QuestionType;
  marks: number;
  prompt: string;
  /** MCQ only. Distractors should be near-misses, not obvious wrongs. */
  options?: string[];
  answer: string;
  /** What a marker is actually looking for — used when grading her attempt. */
  markScheme?: string[];
  /** The misconception this question is designed to expose, if any. */
  probesMisconception?: string;
}

export interface PackUnit {
  unitId: string;
  heading: string;
  knowledgeType: KnowledgeType;
  typeLabel: string;
  representation: RepresentationCode;
  representationLabel: string;

  /** The teaching text. */
  body: string;

  /** REMEMBER — what she builds, in her own head. Never handed over. */
  constructPrompt: string;
  /** What a good artefact looks like, for the tutor only — not shown first. */
  constructExemplar?: string;

  /** REPLICATE — full worked, then faded, then solo. */
  workedExample?: string;
  fadedExample?: string;
  soloTask?: string;

  /** SOLVE — exam-shaped, generated per unit. */
  questions: PackQuestion[];

  /** The check that decides whether it stuck. */
  checkQuestion: string;
  retentionProbeDays: number;
}

export interface MasteryPack {
  chapterId: string;
  chapterTitle: string;
  subjectName: string;
  classLevel: number;
  examKind: string;

  units: PackUnit[];
  mix: Record<KnowledgeType, number>;

  /** Total marks of practice in the pack. */
  practiceMarks: number;
  /** Realistic minutes to work the pack once. */
  estimatedMinutes: number;

  /** Days after the first pass on which to retrieve. */
  reviewSchedule: number[];
  /** Plain-language contract with the student. */
  promise: string;
}

/**
 * Retrieval schedule.
 *
 * Expanding intervals, and deliberately four points rather than one: a single
 * review returns most of the forgetting curve, but the fourth is what carries
 * material from "known this week" to "known at the exam". Day 21 is placed to
 * land inside a 13-week run-up more than once.
 */
export const REVIEW_SCHEDULE_DAYS = [1, 3, 7, 21];

export function buildPack(input: {
  chapterId: string;
  chapterTitle: string;
  subjectName: string;
  classLevel: number;
  exam: ExamShape;
  units: PackUnit[];
}): MasteryPack {
  const counts = Object.fromEntries(KNOWLEDGE_TYPES.map((t) => [t, 0])) as Record<KnowledgeType, number>;
  for (const u of input.units) counts[u.knowledgeType] += 1;
  const n = input.units.length || 1;
  for (const t of KNOWLEDGE_TYPES) counts[t] = counts[t] / n;

  const practiceMarks = input.units.reduce(
    (s, u) => s + u.questions.reduce((m, q) => m + q.marks, 0), 0,
  );

  // Working time, not reading time: constructing an image, doing a faded
  // example and attempting questions is where the minutes actually go.
  const estimatedMinutes = input.units.reduce((s, u) => {
    const construct = 4;
    const replicate = u.workedExample ? 6 : 0;
    const solve = u.questions.reduce((m, q) => m + (q.marks <= 1 ? 1 : q.marks), 0);
    return s + construct + replicate + solve;
  }, 0);

  return {
    chapterId: input.chapterId,
    chapterTitle: input.chapterTitle,
    subjectName: input.subjectName,
    classLevel: input.classLevel,
    examKind: input.exam.examKind,
    units: input.units,
    mix: counts,
    practiceMarks,
    estimatedMinutes,
    reviewSchedule: REVIEW_SCHEDULE_DAYS,
    promise: buildPromise(input.chapterTitle, input.units.length, practiceMarks, estimatedMinutes),
  };
}

/**
 * The contract, stated plainly.
 *
 * Deliberately does NOT say "read this and you will remember everything". It
 * says what the work is and what it buys, because a promise the method cannot
 * keep is the fastest way to lose a student's trust in the method.
 */
function buildPromise(title: string, unitCount: number, marks: number, minutes: number): string {
  return `${title} breaks into ${unitCount} pieces. Work through them once — about ${minutes} minutes, building each memory hook yourself rather than reading mine — then answer the ${marks} marks of exam-shaped questions at the end. After that you will be asked again on days 1, 3, 7 and 21. Do those four and it stays. Skip them and about half of this is gone within a fortnight, however well today goes.`;
}

// ============================================================================
// 4. Construction prompts, per knowledge type
// ============================================================================

/**
 * What the student is asked to BUILD for each kind of knowledge.
 *
 * These are deliberately harder than "read this". Every one demands an output
 * from her — an image, a chain, a counter-example, a placement — because the
 * generation is the encoding. Handing her a finished mnemonic gets roughly
 * half the retention of one she made, which is the single most robust finding
 * in this whole area.
 */
export function constructPromptFor(
  knowledgeType: KnowledgeType,
  heading: string,
  subject: string,
): string {
  switch (knowledgeType) {
    case 'arbitrary_fact':
      return `There is nothing to work out here — this one just has to be known. Say the key words of "${heading}" out loud. What do they sound like, or look like? Build one ridiculous picture that holds them: too big, too many, moving, in the wrong place. Describe your picture to me before you write anything down.`;
    case 'causal_sequence':
      return `"${heading}" is a chain — each step forces the next. I will give you the starting point only. Tell me what has to happen next and why it cannot happen the other way round. We will go step by step, and you predict each one before I confirm it.`;
    case 'concept':
      return `"${heading}" is an idea with an edge to it. I will show you one thing that counts and one that very nearly counts but does not. Your job is to find the single difference that decides it — and then invent your own borderline case and tell me which side it falls on.`;
    case 'procedure':
      return `"${heading}" is something you have to be able to DO. Watch one worked all the way through. Then the same problem with the last step blank — you finish it. Then two steps blank. Then none. If you stall, we go back one level, no penalty.`;
    case 'relational_structure':
      return `"${heading}" is a system where where-things-sit is the whole point. Lay the pieces out yourself — on paper, however rough — so that things belonging together sit together. Where you put them tells me what you think relates to what, and then we fix the gaps.`;
    case 'judgment':
      return `"${heading}" is one where more than one answer can be defended. I will show you three sample answers of different quality, unmarked. Rank them best to worst and tell me what made the top one best — before I tell you the marks. Your criteria are what we are building.`;
  }
}

// ============================================================================
// 5. Rendering
// ============================================================================

/** Compact human-readable pack, for printing or for the tutor's screen. */
export function renderPack(pack: MasteryPack): string {
  const lines: string[] = [];
  lines.push(`${pack.chapterTitle}  —  ${pack.subjectName}, Class ${pack.classLevel}`);
  lines.push(`${pack.units.length} units · ${pack.practiceMarks} marks of practice · ~${pack.estimatedMinutes} min`);
  lines.push('');
  lines.push(pack.promise);
  lines.push('');
  lines.push('This chapter is:');
  for (const [t, share] of Object.entries(pack.mix).filter(([, v]) => v > 0)) {
    lines.push(`  ${Math.round(share * 100).toString().padStart(3)}%  ${KNOWLEDGE_TYPE_LABEL[t as KnowledgeType]}`);
  }

  for (const [i, u] of pack.units.entries()) {
    lines.push('');
    lines.push(`── ${i + 1}. ${u.heading}`);
    lines.push(`   ${u.typeLabel} → ${u.representationLabel}`);
    lines.push(`   ${u.body}`);
    lines.push('');
    lines.push(`   BUILD IT: ${u.constructPrompt}`);
    if (u.workedExample) lines.push(`   WORKED:   ${u.workedExample}`);
    if (u.fadedExample) lines.push(`   NOW YOU:  ${u.fadedExample}`);
    if (u.soloTask) lines.push(`   ALONE:    ${u.soloTask}`);
    if (u.questions.length) {
      lines.push(`   QUESTIONS (${u.questions.reduce((m, q) => m + q.marks, 0)} marks):`);
      for (const q of u.questions) {
        lines.push(`     [${QUESTION_LABEL[q.questionType]}, ${q.marks}m] ${q.prompt}`);
        if (q.options?.length) q.options.forEach((o, n) => lines.push(`        ${String.fromCharCode(97 + n)}) ${o}`));
      }
    }
    lines.push(`   CHECK:    ${u.checkQuestion}  (again in ${u.retentionProbeDays}d)`);
  }

  lines.push('');
  lines.push(`Retrieval: days ${pack.reviewSchedule.join(', ')} after today. Those are not optional extras — they are the part that makes the rest hold.`);
  return lines.join('\n');
}

/** Bridge a ConversionPlan into the pack's unit shape. */
export function unitFromPlan(
  plan: ConversionPlan,
  extras: {
    heading: string;
    body: string;
    subject: string;
    questions?: PackQuestion[];
    workedExample?: string;
    fadedExample?: string;
    soloTask?: string;
    constructExemplar?: string;
  },
): PackUnit {
  return {
    unitId: plan.unitId,
    heading: extras.heading,
    knowledgeType: plan.knowledgeType,
    typeLabel: KNOWLEDGE_TYPE_LABEL[plan.knowledgeType],
    representation: plan.representation,
    representationLabel: REPRESENTATION_LABEL[plan.representation],
    body: extras.body,
    constructPrompt: constructPromptFor(plan.knowledgeType, extras.heading, extras.subject),
    constructExemplar: extras.constructExemplar,
    workedExample: extras.workedExample,
    fadedExample: extras.fadedExample,
    soloTask: extras.soloTask,
    questions: extras.questions || [],
    checkQuestion: plan.checkQuestion,
    retentionProbeDays: plan.retentionProbeDays,
  };
}
