/**
 * Exam Mode — timed mock tests with real exam analytics.
 *
 * India-specific must-have: boards, JEE, NEET, NTSE, Olympiad practice.
 * Parents measure progress against exam pattern. Every competitor (PW,
 * Embibe, Unacademy) leads with this. We add our behavioral-analytics twist.
 *
 * What we do differently from competitors:
 * - Post-test analysis identifies SPECIFIC error patterns (not just score)
 * - Time-per-question reveals speed-vs-accuracy trade-offs
 * - Feeds into method-calibration engine (did exam pattern reveal a new best method?)
 * - Feeds into intervention engine (critical misconceptions get scheduled)
 */

export type ExamType =
  | 'board'          // CBSE / ICSE / WBBSE class 10, 12
  | 'jee_main'
  | 'jee_advanced'
  | 'neet'
  | 'ntse'
  | 'olympiad_math'
  | 'olympiad_science'
  | 'chapter_test'   // small chapter-level test
  | 'custom';

export interface ExamBlueprint {
  examType: ExamType;
  label: string;
  durationMinutes: number;
  totalQuestions: number;
  sectionBreakdown: Array<{ subject: string; count: number; marks: number; negativeMarks?: number }>;
  difficultyMix: { easy: number; medium: number; hard: number }; // percentages
}

export const EXAM_BLUEPRINTS: Record<ExamType, ExamBlueprint> = {
  board: {
    examType: 'board',
    label: 'Board Exam (Class 10/12)',
    durationMinutes: 180,
    totalQuestions: 35,
    sectionBreakdown: [
      { subject: 'any', count: 35, marks: 80 },
    ],
    difficultyMix: { easy: 30, medium: 50, hard: 20 },
  },
  jee_main: {
    examType: 'jee_main',
    label: 'JEE Main',
    durationMinutes: 180,
    totalQuestions: 75,
    sectionBreakdown: [
      { subject: 'Physics', count: 25, marks: 100, negativeMarks: 1 },
      { subject: 'Chemistry', count: 25, marks: 100, negativeMarks: 1 },
      { subject: 'Mathematics', count: 25, marks: 100, negativeMarks: 1 },
    ],
    difficultyMix: { easy: 20, medium: 50, hard: 30 },
  },
  jee_advanced: {
    examType: 'jee_advanced',
    label: 'JEE Advanced',
    durationMinutes: 180,
    totalQuestions: 54,
    sectionBreakdown: [
      { subject: 'Physics', count: 18, marks: 60, negativeMarks: 1 },
      { subject: 'Chemistry', count: 18, marks: 60, negativeMarks: 1 },
      { subject: 'Mathematics', count: 18, marks: 60, negativeMarks: 1 },
    ],
    difficultyMix: { easy: 10, medium: 40, hard: 50 },
  },
  neet: {
    examType: 'neet',
    label: 'NEET',
    durationMinutes: 200,
    totalQuestions: 200,
    sectionBreakdown: [
      { subject: 'Biology', count: 100, marks: 360, negativeMarks: 1 },
      { subject: 'Physics', count: 50, marks: 180, negativeMarks: 1 },
      { subject: 'Chemistry', count: 50, marks: 180, negativeMarks: 1 },
    ],
    difficultyMix: { easy: 25, medium: 50, hard: 25 },
  },
  ntse: {
    examType: 'ntse',
    label: 'NTSE',
    durationMinutes: 240,
    totalQuestions: 200,
    sectionBreakdown: [
      { subject: 'MAT', count: 100, marks: 100 },
      { subject: 'SAT', count: 100, marks: 100 },
    ],
    difficultyMix: { easy: 30, medium: 50, hard: 20 },
  },
  olympiad_math: {
    examType: 'olympiad_math',
    label: 'Math Olympiad',
    durationMinutes: 120,
    totalQuestions: 30,
    sectionBreakdown: [{ subject: 'Mathematics', count: 30, marks: 90 }],
    difficultyMix: { easy: 10, medium: 30, hard: 60 },
  },
  olympiad_science: {
    examType: 'olympiad_science',
    label: 'Science Olympiad',
    durationMinutes: 120,
    totalQuestions: 30,
    sectionBreakdown: [{ subject: 'Science', count: 30, marks: 90 }],
    difficultyMix: { easy: 10, medium: 30, hard: 60 },
  },
  chapter_test: {
    examType: 'chapter_test',
    label: 'Chapter Test',
    durationMinutes: 30,
    totalQuestions: 15,
    sectionBreakdown: [{ subject: 'any', count: 15, marks: 15 }],
    difficultyMix: { easy: 40, medium: 40, hard: 20 },
  },
  custom: {
    examType: 'custom',
    label: 'Custom Test',
    durationMinutes: 30,
    totalQuestions: 10,
    sectionBreakdown: [{ subject: 'any', count: 10, marks: 10 }],
    difficultyMix: { easy: 30, medium: 50, hard: 20 },
  },
};

export interface ExamQuestion {
  id: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation?: string;
  subject_id: string;
  subject_name?: string;
  topic_id?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  marks?: number;
  negative_marks?: number;
}

export interface ExamAttempt {
  examId: string;
  userId: string;
  examType: ExamType;
  questions: ExamQuestion[];
  startedAt: string;
  endedAt?: string;
  durationSeconds: number;
  answers: Record<string, {
    selected?: string;
    skipped: boolean;
    markedForReview: boolean;
    timeSpentSeconds: number;
    isCorrect?: boolean;
  }>;
}

export interface ExamAnalysis {
  score: number;
  maxScore: number;
  percentage: number;
  // Classification
  performanceBand: 'excellent' | 'strong' | 'fair' | 'needs_work' | 'starting';
  // Per-subject breakdown
  subjectBreakdown: Array<{
    subject: string;
    attempted: number;
    correct: number;
    wrong: number;
    skipped: number;
    accuracy: number;
    avgTimeSeconds: number;
    strength: 'strong' | 'fair' | 'weak';
  }>;
  // Difficulty breakdown
  difficultyBreakdown: Record<'easy' | 'medium' | 'hard', { total: number; correct: number; accuracy: number }>;
  // Time analysis
  totalTimeSeconds: number;
  avgTimePerQuestion: number;
  fastestCorrect: number;
  slowestCorrect: number;
  // Behavioral insights (our differentiator)
  insights: {
    speedAccuracyBalance: 'rushing' | 'balanced' | 'overthinking';
    carelessErrors: number;         // wrong but fast = careless
    conceptGaps: number;            // wrong + slow = didn't know
    wastedOnHard: number;           // spent > 3min on a single hard question
    skippedButKnew?: number;        // topics they're strong in but skipped
    improvementFocus: string[];     // what to fix first
  };
  // Recommendations
  recommendations: Array<{
    type: 'study' | 'practice' | 'speed' | 'concept';
    text: string;
    subject?: string;
  }>;
  // Compared to earlier attempts
  vsPreviousAttempt?: {
    scoreDelta: number;
    accuracyDelta: number;
    timeDelta: number;
    newStrengths: string[];
    newWeaknesses: string[];
  };
}

// ============================================================
// Build an exam from blueprint
// ============================================================

export async function generateExamFromBlueprint(
  supabase: any,
  blueprint: ExamBlueprint,
  classLevel: number,
  subjectFilter?: string[],
): Promise<ExamQuestion[]> {
  const questions: ExamQuestion[] = [];

  for (const section of blueprint.sectionBreakdown) {
    const subjectName = section.subject;
    const count = section.count;
    const easyCount = Math.round(count * blueprint.difficultyMix.easy / 100);
    const hardCount = Math.round(count * blueprint.difficultyMix.hard / 100);
    const mediumCount = count - easyCount - hardCount;

    for (const [diff, n] of [
      ['easy', easyCount],
      ['medium', mediumCount],
      ['hard', hardCount],
    ] as const) {
      if (n <= 0) continue;

      let query = supabase
        .from('questions')
        .select(`
          id, question_text, options, correct_answer, explanation,
          subject_id, topic_id, difficulty,
          subjects(title, name)
        `)
        .eq('difficulty', diff)
        .eq('question_type', 'mcq')
        .limit(n * 3); // oversample to allow subject filtering

      if (subjectName !== 'any') {
        query = query.ilike('subjects.title', `%${subjectName}%`);
      }
      if (subjectFilter?.length) {
        query = query.in('subject_id', subjectFilter);
      }

      const { data: rows } = await query;
      const shuffled = (rows || []).sort(() => Math.random() - 0.5).slice(0, n);
      for (const r of shuffled) {
        questions.push({
          id: r.id,
          question_text: r.question_text,
          options: Array.isArray(r.options) ? r.options : [],
          correct_answer: r.correct_answer,
          explanation: r.explanation,
          subject_id: r.subject_id,
          subject_name: r.subjects?.title || r.subjects?.name,
          topic_id: r.topic_id,
          difficulty: diff,
          marks: Math.round(section.marks / count),
          negative_marks: section.negativeMarks,
        });
      }
    }
  }

  // Shuffle final order
  return questions.sort(() => Math.random() - 0.5);
}

// ============================================================
// Analyze a completed exam
// ============================================================

export function analyzeExam(attempt: ExamAttempt, previous?: ExamAnalysis): ExamAnalysis {
  let score = 0;
  let maxScore = 0;
  const subjectStats: Record<string, { subject: string; attempted: number; correct: number; wrong: number; skipped: number; totalTime: number }> = {};
  const diffStats: Record<'easy' | 'medium' | 'hard', { total: number; correct: number }> = {
    easy: { total: 0, correct: 0 },
    medium: { total: 0, correct: 0 },
    hard: { total: 0, correct: 0 },
  };

  let totalTime = 0;
  let carelessErrors = 0;
  let conceptGaps = 0;
  let wastedOnHard = 0;
  let fastestCorrect = Infinity;
  let slowestCorrect = 0;
  const correctTimes: number[] = [];

  for (const q of attempt.questions) {
    const answer = attempt.answers[q.id];
    const marks = q.marks ?? 1;
    maxScore += marks;
    const sKey = q.subject_name || q.subject_id;

    if (!subjectStats[sKey]) {
      subjectStats[sKey] = { subject: sKey, attempted: 0, correct: 0, wrong: 0, skipped: 0, totalTime: 0 };
    }
    diffStats[q.difficulty].total++;

    if (!answer || answer.skipped || answer.selected == null) {
      subjectStats[sKey].skipped++;
      continue;
    }

    subjectStats[sKey].attempted++;
    subjectStats[sKey].totalTime += answer.timeSpentSeconds;
    totalTime += answer.timeSpentSeconds;

    const correct = answer.selected === q.correct_answer;
    if (correct) {
      score += marks;
      subjectStats[sKey].correct++;
      diffStats[q.difficulty].correct++;
      correctTimes.push(answer.timeSpentSeconds);
      fastestCorrect = Math.min(fastestCorrect, answer.timeSpentSeconds);
      slowestCorrect = Math.max(slowestCorrect, answer.timeSpentSeconds);
    } else {
      if (q.negative_marks) score -= q.negative_marks;
      subjectStats[sKey].wrong++;
      // Behavioral classification
      if (answer.timeSpentSeconds < 20 && q.difficulty !== 'hard') {
        carelessErrors++;
      } else if (answer.timeSpentSeconds > 90) {
        conceptGaps++;
      }
      if (q.difficulty === 'hard' && answer.timeSpentSeconds > 180) {
        wastedOnHard++;
      }
    }
  }

  const totalQuestions = attempt.questions.length || 1;
  const avgTimePerQuestion = totalTime / totalQuestions;

  // Speed-accuracy classification
  let speedAccuracyBalance: 'rushing' | 'balanced' | 'overthinking' = 'balanced';
  if (carelessErrors >= 3 && avgTimePerQuestion < 40) speedAccuracyBalance = 'rushing';
  else if (conceptGaps === 0 && avgTimePerQuestion > 120) speedAccuracyBalance = 'overthinking';

  // Strongest and weakest subjects
  const subjectBreakdown = Object.values(subjectStats).map((s) => {
    const accuracy = s.attempted > 0 ? s.correct / s.attempted : 0;
    return {
      subject: s.subject,
      attempted: s.attempted,
      correct: s.correct,
      wrong: s.wrong,
      skipped: s.skipped,
      accuracy: Math.round(accuracy * 100),
      avgTimeSeconds: s.attempted > 0 ? Math.round(s.totalTime / s.attempted) : 0,
      strength: (accuracy >= 0.75 ? 'strong' : accuracy >= 0.5 ? 'fair' : 'weak') as 'strong' | 'fair' | 'weak',
    };
  }).sort((a, b) => b.accuracy - a.accuracy);

  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const performanceBand: ExamAnalysis['performanceBand'] =
    percentage >= 85 ? 'excellent' :
    percentage >= 70 ? 'strong' :
    percentage >= 50 ? 'fair' :
    percentage >= 30 ? 'needs_work' : 'starting';

  // Improvement focus
  const improvementFocus: string[] = [];
  if (carelessErrors >= 3) improvementFocus.push(`${carelessErrors} silly mistakes — slow down, verify each answer`);
  if (conceptGaps >= 3) improvementFocus.push(`${conceptGaps} concept gaps — revisit fundamentals`);
  if (wastedOnHard >= 2) improvementFocus.push(`Stuck too long on hard questions — skip and return at end`);
  if (subjectBreakdown[subjectBreakdown.length - 1]?.strength === 'weak') {
    improvementFocus.push(`Weakest subject: ${subjectBreakdown[subjectBreakdown.length - 1].subject}`);
  }

  const recommendations: ExamAnalysis['recommendations'] = [];
  if (speedAccuracyBalance === 'rushing') {
    recommendations.push({
      type: 'speed',
      text: 'You\'re rushing. Practice with a 60-second timer per easy question to build calm pacing.',
    });
  } else if (speedAccuracyBalance === 'overthinking') {
    recommendations.push({
      type: 'speed',
      text: 'You\'re overthinking. On easy questions, trust your first instinct and move on.',
    });
  }
  for (const s of subjectBreakdown) {
    if (s.strength === 'weak') {
      recommendations.push({
        type: 'concept',
        text: `${s.subject} is at ${s.accuracy}% — schedule focused practice on the 3 weakest chapters this week.`,
        subject: s.subject,
      });
    }
  }
  if (carelessErrors >= 3) {
    recommendations.push({
      type: 'practice',
      text: 'Add a verification step — before submitting, re-read the question and recheck arithmetic.',
    });
  }

  // Previous attempt comparison
  let vsPreviousAttempt;
  if (previous) {
    const scoreDelta = score - previous.score;
    const accuracyDelta = percentage - previous.percentage;
    const timeDelta = avgTimePerQuestion - previous.avgTimePerQuestion;
    const newStrengths: string[] = [];
    const newWeaknesses: string[] = [];
    for (const curr of subjectBreakdown) {
      const prev = previous.subjectBreakdown.find((p) => p.subject === curr.subject);
      if (!prev) continue;
      if (curr.strength === 'strong' && prev.strength !== 'strong') newStrengths.push(curr.subject);
      if (curr.strength === 'weak' && prev.strength !== 'weak') newWeaknesses.push(curr.subject);
    }
    vsPreviousAttempt = { scoreDelta, accuracyDelta, timeDelta, newStrengths, newWeaknesses };
  }

  return {
    score,
    maxScore,
    percentage,
    performanceBand,
    subjectBreakdown,
    difficultyBreakdown: {
      easy: { ...diffStats.easy, accuracy: diffStats.easy.total > 0 ? Math.round((diffStats.easy.correct / diffStats.easy.total) * 100) : 0 },
      medium: { ...diffStats.medium, accuracy: diffStats.medium.total > 0 ? Math.round((diffStats.medium.correct / diffStats.medium.total) * 100) : 0 },
      hard: { ...diffStats.hard, accuracy: diffStats.hard.total > 0 ? Math.round((diffStats.hard.correct / diffStats.hard.total) * 100) : 0 },
    },
    totalTimeSeconds: totalTime,
    avgTimePerQuestion: Math.round(avgTimePerQuestion),
    fastestCorrect: fastestCorrect === Infinity ? 0 : fastestCorrect,
    slowestCorrect,
    insights: {
      speedAccuracyBalance,
      carelessErrors,
      conceptGaps,
      wastedOnHard,
      improvementFocus,
    },
    recommendations,
    vsPreviousAttempt,
  };
}
