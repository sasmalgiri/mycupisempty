/**
 * Metacognition — Predict-Then-Answer + Self-Awareness.
 *
 * Cognitive-science fact: students who predict their confidence BEFORE
 * answering build dramatically stronger self-awareness and learn faster
 * (Dunlosky & Rawson 2012). No mass-market ed-tech does this.
 *
 * How it works:
 *   1. Before the student answers, we ask: "How confident are you?" (1-5)
 *   2. After the answer, we compare predicted vs actual outcome
 *   3. Over time, we show their "calibration curve" — do they know what
 *      they know?
 *
 * This also powers the CONFIDENCE gap in SubjectState: if the student
 * consistently says "5" and gets 50%, they are overconfident and we adapt
 * (add calibration questions, avoid easy praise).
 */

export type ConfidenceLevel = 1 | 2 | 3 | 4 | 5;

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, { label: string; emoji: string; color: string }> = {
  1: { label: 'Just guessing', emoji: '🤷', color: '#94a3b8' },
  2: { label: 'Unsure', emoji: '🤔', color: '#60a5fa' },
  3: { label: 'Maybe right', emoji: '😐', color: '#f59e0b' },
  4: { label: 'Pretty sure', emoji: '🙂', color: '#22c55e' },
  5: { label: 'Definitely right', emoji: '💪', color: '#16a34a' },
};

export interface PredictionRecord {
  userId: string;
  topicId?: string;
  subjectId?: string;
  questionId: string;
  predictedConfidence: ConfidenceLevel;
  wasCorrect: boolean;
  timestamp: string;
}

export interface CalibrationStats {
  totalPredictions: number;
  // Per-confidence-level accuracy
  byConfidence: Record<ConfidenceLevel, { count: number; correctCount: number; accuracy: number }>;
  // Calibration score: 1.0 = perfectly calibrated, 0.0 = wildly off
  calibrationScore: number;
  // Directional bias: positive = overconfident, negative = underconfident
  calibrationBias: number;
  // Narrative insights
  insight: string;
  selfAwarenessTier: 'developing' | 'emerging' | 'strong' | 'excellent';
}

// ============================================================
// Compute calibration from prediction records
// ============================================================

export function computeCalibration(records: PredictionRecord[]): CalibrationStats {
  const byConfidence: Record<ConfidenceLevel, { count: number; correctCount: number; accuracy: number }> = {
    1: { count: 0, correctCount: 0, accuracy: 0 },
    2: { count: 0, correctCount: 0, accuracy: 0 },
    3: { count: 0, correctCount: 0, accuracy: 0 },
    4: { count: 0, correctCount: 0, accuracy: 0 },
    5: { count: 0, correctCount: 0, accuracy: 0 },
  };

  for (const r of records) {
    const c = r.predictedConfidence;
    byConfidence[c].count++;
    if (r.wasCorrect) byConfidence[c].correctCount++;
  }

  // Accuracy at each confidence level
  for (const levelKey of [1, 2, 3, 4, 5] as ConfidenceLevel[]) {
    const b = byConfidence[levelKey];
    b.accuracy = b.count > 0 ? b.correctCount / b.count : 0;
  }

  // Expected accuracy at each level (if perfectly calibrated):
  //  1 → 20%, 2 → 40%, 3 → 60%, 4 → 80%, 5 → 95%
  const expectedByLevel: Record<ConfidenceLevel, number> = {
    1: 0.20, 2: 0.40, 3: 0.60, 4: 0.80, 5: 0.95,
  };

  // Brier-style calibration: mean squared deviation from expected
  let totalDev = 0;
  let weight = 0;
  let signedBias = 0;
  for (const levelKey of [1, 2, 3, 4, 5] as ConfidenceLevel[]) {
    const b = byConfidence[levelKey];
    if (b.count === 0) continue;
    const dev = b.accuracy - expectedByLevel[levelKey];
    totalDev += Math.pow(dev, 2) * b.count;
    // If student said HIGH confidence but accuracy is low, they're overconfident
    signedBias += (expectedByLevel[levelKey] - b.accuracy) * b.count;
    weight += b.count;
  }

  const meanSquaredDev = weight > 0 ? totalDev / weight : 0;
  const calibrationScore = Math.max(0, 1 - meanSquaredDev * 4); // 0..1
  const calibrationBias = weight > 0 ? signedBias / weight : 0; // positive = overconfident

  let insight: string;
  let selfAwarenessTier: CalibrationStats['selfAwarenessTier'];

  if (records.length < 10) {
    insight = `Keep predicting — ${10 - records.length} more to build a clear picture.`;
    selfAwarenessTier = 'developing';
  } else if (calibrationScore >= 0.85) {
    insight = `You know what you know — excellent self-awareness. This is a real superpower for exams.`;
    selfAwarenessTier = 'excellent';
  } else if (calibrationScore >= 0.7) {
    insight = `Your confidence usually matches your accuracy — you're self-aware.`;
    selfAwarenessTier = 'strong';
  } else if (calibrationBias > 0.15) {
    insight = `You're often more confident than the result shows. Slow down, verify, and you'll turn those "definitely right" answers into actual wins.`;
    selfAwarenessTier = 'emerging';
  } else if (calibrationBias < -0.15) {
    insight = `You know more than you think. Trust your gut when it says "4" — you usually get it right.`;
    selfAwarenessTier = 'emerging';
  } else {
    insight = `Your predictions are getting sharper. Keep using the confidence slider — it builds a skill employers, colleges, and exam-setters love.`;
    selfAwarenessTier = 'developing';
  }

  return {
    totalPredictions: records.length,
    byConfidence,
    calibrationScore: Math.round(calibrationScore * 100) / 100,
    calibrationBias: Math.round(calibrationBias * 100) / 100,
    insight,
    selfAwarenessTier,
  };
}

// ============================================================
// "Why?" probe — force articulation after answering
// ============================================================

export const WHY_PROBE_PROMPTS: string[] = [
  'In one line, why did you pick that?',
  'What made you rule out the other options?',
  'Which rule or idea are you using here?',
  'If you had to explain this to a friend, what would you say?',
  'What\'s the one step that was most important?',
];

export function pickWhyProbe(wasCorrect: boolean, confidence: ConfidenceLevel): string {
  if (!wasCorrect && confidence >= 4) {
    return 'You were pretty sure — what led you to that answer? Walking through it helps catch the slip.';
  }
  if (wasCorrect && confidence <= 2) {
    return 'You got it right even though you weren\'t sure. What did you notice that led you there?';
  }
  return WHY_PROBE_PROMPTS[Math.floor(Math.random() * WHY_PROBE_PROMPTS.length)];
}
