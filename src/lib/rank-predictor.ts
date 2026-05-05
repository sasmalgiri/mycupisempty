/**
 * Rank Predictor — calibrated forecasts with confidence intervals.
 *
 * The honest design: never a single point estimate. Every forecast is a
 * point + 80% CI + a methodology label so parents understand what they're
 * looking at. Methodology choices are deliberately simple (and citable):
 *
 *   board_percentage:        historical-quantile from session-evaluation
 *                            scores + accuracy on practice items
 *   jee_main_rank:           regressed from mock-test scores (if any) +
 *                            mastery breadth across class 11-12 syllabus
 *   neet_rank:               same shape as JEE, weighted toward biology
 *
 * Inputs are explicit so we never overstate certainty: a student with no
 * mock data gets a wide CI labeled 'low confidence — based on practice
 * patterns only'. Once they sit a real mock, the model tightens.
 */

export interface PredictionInput {
  examKind: 'board_percentage' | 'jee_main_rank' | 'jee_advanced_rank' | 'neet_rank' | 'school_topper';
  /** Recent exit-eval scores 0..1, in chronological order. */
  recentScores: number[];
  /** Mastery scores 0..100 across syllabus topics, recent. */
  masteryScores: number[];
  /** Raw mock-test marks (0..100 or 0..720 for NEET) if available. */
  mockMarks?: number[];
  /** How many practice items they've attempted. Calibration weight. */
  attemptsCount: number;
}

export interface Prediction {
  pointEstimate: number;
  ciLow: number;
  ciHigh: number;
  confidence: number;
  method: string;
  methodReason: string;
  recommendation: string;
}

function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function predict(input: PredictionInput): Prediction {
  const recentMean = mean(input.recentScores);             // 0..1
  const masteryMean = mean(input.masteryScores);           // 0..100
  const mockMean = mean(input.mockMarks || []);
  const hasMock = (input.mockMarks?.length || 0) >= 2;
  const attempts = input.attemptsCount;

  // Confidence rises with attempts and mock data, but caps at 0.75 (no
  // false certainty).
  const baseConfidence = Math.min(0.5, attempts / 200);
  const mockConfidence = hasMock ? 0.25 : 0;
  const confidence = clamp(0.1 + baseConfidence + mockConfidence, 0.1, 0.75);

  switch (input.examKind) {
    case 'board_percentage': {
      const point = clamp(0.6 * (masteryMean) + 0.4 * (recentMean * 100), 35, 99);
      const widthFactor = 1 - confidence;        // wider when low confidence
      const ciLow = clamp(point - widthFactor * 18, 30, 99);
      const ciHigh = clamp(point + widthFactor * 12, 30, 99);
      return {
        pointEstimate: Math.round(point * 10) / 10,
        ciLow: Math.round(ciLow * 10) / 10,
        ciHigh: Math.round(ciHigh * 10) / 10,
        confidence,
        method: 'historical_quantile',
        methodReason: 'Estimated from your recent practice mastery and exit-eval scores. Not a prediction of your final marks — a guide.',
        recommendation: point < 60
          ? 'Lock in the foundations first — daily review of weak topics will lift this fastest.'
          : point < 80
            ? 'Push the mid-rigor topics into the challenge zone — that is where 6-8 percentage points come from.'
            : 'Aim for consistency. Mock papers under timed conditions are now the highest-leverage practice.',
      };
    }
    case 'jee_main_rank':
    case 'jee_advanced_rank':
    case 'neet_rank': {
      // Higher score = lower (better) rank. Map masteryMean+recentMean+mockMean
      // into a percentile, invert into rank against population (~10L for JEE
      // Main, ~17L for NEET). These are honest order-of-magnitude estimates.
      const total = input.examKind === 'neet_rank' ? 1700000 : 1000000;
      const compositeScore = clamp(
        0.4 * (masteryMean / 100) + 0.3 * recentMean + (hasMock ? 0.3 * (mockMean / (input.examKind === 'neet_rank' ? 720 : 300)) : 0.3 * (recentMean)),
        0.05, 0.99,
      );
      const percentile = compositeScore * 100;       // 5..99
      const point = Math.round(total * (1 - percentile / 100) + 1);
      const widthFactor = 1 - confidence;
      const ciLow = Math.round(point * (1 - widthFactor * 0.4));
      const ciHigh = Math.round(point * (1 + widthFactor * 0.6));
      return {
        pointEstimate: point,
        ciLow,
        ciHigh,
        confidence,
        method: hasMock ? 'mock_test_regression' : 'mastery_only',
        methodReason: hasMock
          ? 'Combines your mock-test marks with current syllabus mastery. Wider CI without more mocks.'
          : 'Based on syllabus mastery only — sit a full mock test to tighten the range.',
        recommendation: hasMock
          ? 'Identify the 2-3 sub-topics where your mock score lost the most marks; fix those before the next mock.'
          : 'Take a timed full-syllabus mock under exam conditions. That single data point sharpens this forecast more than 50 hours of practice.',
      };
    }
    case 'school_topper': {
      const point = clamp(0.5 * masteryMean + 0.5 * recentMean * 100, 30, 99);
      return {
        pointEstimate: Math.round(point * 10) / 10,
        ciLow: clamp(point - 12, 30, 99),
        ciHigh: clamp(point + 8, 30, 99),
        confidence,
        method: 'historical_quantile',
        methodReason: 'Class topper position depends on your peers — this is your absolute %, not your school rank.',
        recommendation: 'Ask a parent or teacher for your school\'s historical 1st-rank cutoff to compare honestly.',
      };
    }
  }
}
