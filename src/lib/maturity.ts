/**
 * Maturity Engine — per-student × per-subject developmental readiness.
 *
 * Maturity is NOT age or class. It's a composite of:
 *   - Cognitive depth     (abstract vs concrete thinking)
 *   - Self-direction      (retries without prompting, asks good questions)
 *   - Persistence         (from StudentState)
 *   - Metacognition       (confidence-accuracy calibration)
 *   - Mastery depth       (from Mastery engine)
 *   - Creative expression (open-ended answer quality)
 *
 * Five bands — every question, challenge, assignment, and companion tone
 * should adapt to the student's band in THAT subject.
 */

import type { StudentState, SubjectState } from './student-state';

export type MaturityBand = 1 | 2 | 3 | 4 | 5;

export const BAND_INFO: Record<MaturityBand, {
  label: string;
  icon: string;
  description: string;
  taskScope: string;
  aiTone: string;
  scaffoldLevel: number;          // 0..1 how much hand-holding
  preferredQuestionStyles: string[];
}> = {
  1: {
    label: 'Novice',
    icon: '🌱',
    description: 'Just starting — concrete examples, short tasks, lots of encouragement.',
    taskScope: 'single-step, concrete, guided',
    aiTone: 'warm, patient, uses everyday analogies, never assumes prior knowledge',
    scaffoldLevel: 0.9,
    preferredQuestionStyles: ['recall', 'match', 'identify', 'fill_blank'],
  },
  2: {
    label: 'Developing',
    icon: '🌿',
    description: 'Building foundations — simple abstraction with worked examples.',
    taskScope: 'two-step, guided, with hints available',
    aiTone: 'encouraging, explains reasoning behind steps, celebrates small wins',
    scaffoldLevel: 0.65,
    preferredQuestionStyles: ['apply', 'short_answer', 'worked_example'],
  },
  3: {
    label: 'Capable',
    icon: '🌳',
    description: 'Comfortable with core ideas — ready for moderate abstraction and independence.',
    taskScope: 'multi-step, some independence, real-world framing',
    aiTone: 'Socratic when appropriate, gives room to think, adds cross-connections',
    scaffoldLevel: 0.45,
    preferredQuestionStyles: ['analyze', 'apply', 'compare', 'explain'],
  },
  4: {
    label: 'Proficient',
    icon: '🌸',
    description: 'Self-directed thinker — handles ambiguity, designs own solutions.',
    taskScope: 'open-ended projects, novel problems, minimal scaffolding',
    aiTone: 'colleague-like, pushes back with counter-examples, expects justification',
    scaffoldLevel: 0.25,
    preferredQuestionStyles: ['synthesize', 'evaluate', 'design', 'critique'],
  },
  5: {
    label: 'Expert',
    icon: '🏆',
    description: 'Teaches others, creates new approaches, contributes original insight.',
    taskScope: 'creative synthesis, teaching tasks, Olympiad-level problems',
    aiTone: 'peer-level, challenges with edge cases, asks student to teach back',
    scaffoldLevel: 0.1,
    preferredQuestionStyles: ['create', 'teach', 'prove', 'invent'],
  },
};

export interface MaturityProfile {
  userId: string;
  subjectId: string;
  subjectName?: string;
  dimensions: {
    cognitiveDepth: number;          // 0-100
    selfDirection: number;
    persistence: number;
    metacognition: number;
    masteryDepth: number;
    creativeExpression: number;
  };
  compositeScore: number;             // 0-100
  band: MaturityBand;
  confidence: number;                 // 0-1, how much evidence we have
  lastUpdated: string;
  // Evidence summary
  reasons: string[];
}

// ============================================================
// Compute per-subject maturity
// ============================================================

export function computeMaturity(params: {
  userId: string;
  subjectId: string;
  subjectName?: string;
  subjectState?: SubjectState;
  studentState: StudentState;
  // Prediction records for metacognition
  metacognitionCalibration?: number;    // 0..1
  // Open-ended answer quality score (if available)
  creativeScore?: number;                // 0..1
  // Age if known (used only as a soft weight, never as ceiling)
  classLevel?: number;
}): MaturityProfile {
  const { userId, subjectId, subjectName, subjectState, studentState, metacognitionCalibration, creativeScore, classLevel } = params;

  const accuracy = subjectState?.recentAccuracy ?? 0.5;
  const band = subjectState?.currentBand;
  const trend = subjectState?.accuracyTrend;

  // Mastery depth — anchored in band + accuracy
  const bandPts: Record<string, number> = { foundation: 15, emerging: 35, developing: 55, secure: 75, advanced: 90 };
  const masteryDepth = Math.min(100, (bandPts[band || 'developing'] || 50) + (accuracy - 0.5) * 30 + (trend === 'improving' ? 10 : trend === 'declining' ? -10 : 0));

  // Cognitive depth — use classLevel as floor AND student's accuracy on harder items
  let cognitiveDepth = Math.min(100, 20 + (classLevel || 6) * 5 + (accuracy - 0.5) * 30);
  // If student answers ages above their class with accuracy > 70%, bump
  if (studentState.confidenceLevel > 7 && accuracy > 0.7) cognitiveDepth = Math.min(100, cognitiveDepth + 15);

  // Self-direction — low help-seeking + high persistence = high self-direction
  const selfDirection = Math.round(
    (1 - studentState.helpSeekingRate) * 50 +
    studentState.persistenceScore * 50,
  );

  // Persistence — direct from StudentState
  const persistence = Math.round(studentState.persistenceScore * 100);

  // Metacognition — from predict-then-answer calibration
  const metacognition = metacognitionCalibration != null
    ? Math.round(metacognitionCalibration * 100)
    : Math.max(0, 50 - Math.abs((subjectState?.confidenceAccuracyGap ?? 0) * 100));

  // Creative expression — from open-ended answer quality (writing feedback, reflection depth)
  const creativeExpression = creativeScore != null
    ? Math.round(creativeScore * 100)
    : 40 + (accuracy > 0.7 ? 20 : 0);

  // Composite — weighted average
  const dimensions = {
    cognitiveDepth: Math.round(cognitiveDepth),
    selfDirection: Math.round(selfDirection),
    persistence: Math.round(persistence),
    metacognition: Math.round(metacognition),
    masteryDepth: Math.round(masteryDepth),
    creativeExpression: Math.round(creativeExpression),
  };

  const compositeScore = Math.round(
    dimensions.cognitiveDepth * 0.20 +
    dimensions.selfDirection * 0.15 +
    dimensions.persistence * 0.15 +
    dimensions.metacognition * 0.15 +
    dimensions.masteryDepth * 0.25 +
    dimensions.creativeExpression * 0.10,
  );

  // Band cutoffs
  const band2: MaturityBand =
    compositeScore >= 82 ? 5 :
    compositeScore >= 65 ? 4 :
    compositeScore >= 45 ? 3 :
    compositeScore >= 25 ? 2 : 1;

  const confidence = Math.min(1, ((subjectState?.recentAccuracy != null ? 0.3 : 0) +
    (metacognitionCalibration != null ? 0.2 : 0) +
    (creativeScore != null ? 0.2 : 0) +
    Math.min(0.3, (studentState.profileConfidence || 0))));

  // Evidence summary
  const reasons: string[] = [];
  if (dimensions.masteryDepth >= 70) reasons.push(`Mastery is deep (${dimensions.masteryDepth}/100)`);
  if (dimensions.masteryDepth < 40) reasons.push(`Building mastery foundation (${dimensions.masteryDepth}/100)`);
  if (dimensions.selfDirection >= 70) reasons.push(`Highly self-directed`);
  if (dimensions.selfDirection < 40) reasons.push(`Still needs scaffolded guidance`);
  if (dimensions.metacognition >= 70) reasons.push(`Strong self-awareness`);
  if (dimensions.metacognition < 40) reasons.push(`Self-awareness growing`);
  if (dimensions.persistence >= 70) reasons.push(`Persists through difficulty`);
  if (dimensions.persistence < 40) reasons.push(`Gives up when stuck — needs encouragement`);

  return {
    userId,
    subjectId,
    subjectName,
    dimensions,
    compositeScore,
    band: band2,
    confidence,
    lastUpdated: new Date().toISOString(),
    reasons,
  };
}

// ============================================================
// Convert maturity → AI instructions + difficulty + task scope
// ============================================================

export interface MaturityAdaptation {
  targetDifficulty: number;           // 1-10
  aiToneInstruction: string;
  taskScopeInstruction: string;
  scaffoldLevel: number;              // 0-1
  maxTaskSteps: number;
  questionStyles: string[];
  encouragementIntensity: 'high' | 'moderate' | 'low';
}

export function adaptationForMaturity(profile: MaturityProfile): MaturityAdaptation {
  const info = BAND_INFO[profile.band];

  return {
    targetDifficulty:
      profile.band === 1 ? 3 :
      profile.band === 2 ? 4 :
      profile.band === 3 ? 6 :
      profile.band === 4 ? 7 : 9,
    aiToneInstruction: info.aiTone,
    taskScopeInstruction: info.taskScope,
    scaffoldLevel: info.scaffoldLevel,
    maxTaskSteps:
      profile.band === 1 ? 1 :
      profile.band === 2 ? 2 :
      profile.band === 3 ? 3 :
      profile.band === 4 ? 5 : 7,
    questionStyles: info.preferredQuestionStyles,
    encouragementIntensity:
      profile.band <= 2 ? 'high' :
      profile.band === 3 ? 'moderate' : 'low',
  };
}

// ============================================================
// Human-readable summary for UI / parent digest
// ============================================================

export function maturitySummary(profile: MaturityProfile): string {
  const info = BAND_INFO[profile.band];
  const topDim = Object.entries(profile.dimensions)
    .sort((a, b) => b[1] - a[1])[0];
  return `${info.icon} ${info.label} in ${profile.subjectName || 'this subject'}. Strongest: ${topDim[0].replace(/([A-Z])/g, ' $1').toLowerCase().trim()} (${topDim[1]}/100). ${info.description}`;
}
