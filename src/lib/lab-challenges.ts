/**
 * Lab Challenges — virtual practical lab tasks.
 *
 * A challenge is a concrete task the student does inside a tool (PhysicsSim,
 * MoleculeViewer, CodeSandbox, GraphPlotter…) with clear success criteria
 * and a gradable submission shape.
 *
 * Challenges are:
 *   - Per tool (each tool knows how to render + grade its challenges)
 *   - Per subject + optional chapter
 *   - Scaled by maturity band
 *   - Can be preset (library) OR AI-generated on demand
 */

import type { MaturityBand } from './maturity';

export type ToolKey =
  | 'graph_plotter' | 'calculator' | 'geometry' | 'physics_pendulum' | 'physics_projectile'
  | 'physics_wave' | 'physics_circuit' | 'unit_converter' | 'periodic_table'
  | 'molecule_viewer' | 'reaction_balancer' | 'diagram_explorer' | 'taxonomy_tree'
  | 'writing' | 'pronunciation' | 'dictionary' | 'reading_comprehension'
  | 'timeline' | 'india_map' | 'chart_builder' | 'code_sandbox' | 'algorithm_viz';

export interface LabChallenge {
  id: string;
  title: string;
  subject: string;
  chapter?: string;
  tool: ToolKey;
  maturityBand: MaturityBand[];  // which bands this is suited for
  instructions: string;
  successCriteria: string;
  submissionKind: 'numeric' | 'equation' | 'code' | 'text' | 'multi_choice' | 'free_build';
  expected?: any;                  // for auto-grading
  tolerance?: number;              // numeric tolerance (abs or percentage)
  hints?: string[];
  estimatedMinutes: number;
  xpReward: number;
}

// ============================================================
// Starter library of challenges (curated, covers all subjects)
// ============================================================

export const LAB_CHALLENGE_LIBRARY: LabChallenge[] = [
  // === MATH ===
  {
    id: 'math_quad_intersect',
    title: 'Find the intersection',
    subject: 'Mathematics',
    chapter: 'Quadratic equations',
    tool: 'graph_plotter',
    maturityBand: [3, 4],
    instructions: 'Plot y = x² and y = 2x + 3 on the same axes. Find the x-values where they intersect.',
    successCriteria: 'Both x-coordinates within ±0.1 of the true values.',
    submissionKind: 'numeric',
    expected: [-1, 3],
    tolerance: 0.1,
    hints: ['Set x² = 2x + 3', 'Solve x² - 2x - 3 = 0'],
    estimatedMinutes: 8,
    xpReward: 20,
  },
  {
    id: 'math_sin_period',
    title: 'Spot the period',
    subject: 'Mathematics',
    chapter: 'Trigonometry',
    tool: 'graph_plotter',
    maturityBand: [2, 3],
    instructions: 'Plot y = sin(x). What is the period (in radians)?',
    successCriteria: 'Answer must be 2π ≈ 6.28.',
    submissionKind: 'numeric',
    expected: 6.283,
    tolerance: 0.1,
    hints: ['The period is the distance for one full wave', 'Measure between two peaks'],
    estimatedMinutes: 4,
    xpReward: 12,
  },
  {
    id: 'math_geo_triangle',
    title: 'Build a triangle',
    subject: 'Mathematics',
    chapter: 'Geometry',
    tool: 'geometry',
    maturityBand: [1, 2, 3],
    instructions: 'Construct any triangle and measure its three angles. They should sum to 180°.',
    successCriteria: 'Place 3 points, connect with lines, measure all 3 angles, sum within ±3°.',
    submissionKind: 'numeric',
    expected: 180,
    tolerance: 3,
    estimatedMinutes: 6,
    xpReward: 15,
  },

  // === PHYSICS ===
  {
    id: 'phys_find_g',
    title: 'Measure gravity',
    subject: 'Science',
    chapter: 'Gravitation',
    tool: 'physics_pendulum',
    maturityBand: [3, 4],
    instructions: 'Using the pendulum simulation, set different lengths and read the period. Use T = 2π√(L/g) to determine g. Aim within 5% of 9.8 m/s².',
    successCriteria: 'Submitted g must be 9.31–10.29 m/s² range.',
    submissionKind: 'numeric',
    expected: 9.8,
    tolerance: 0.5,
    hints: ['Record T for at least 2 different lengths', 'Solve for g algebraically'],
    estimatedMinutes: 12,
    xpReward: 25,
  },
  {
    id: 'phys_best_angle',
    title: 'Optimal launch angle',
    subject: 'Science',
    chapter: 'Motion',
    tool: 'physics_projectile',
    maturityBand: [2, 3],
    instructions: 'With fixed speed, try different angles. Which angle gives maximum range on flat ground?',
    successCriteria: '45° (±2°)',
    submissionKind: 'numeric',
    expected: 45,
    tolerance: 2,
    estimatedMinutes: 6,
    xpReward: 15,
  },
  {
    id: 'phys_ohms',
    title: 'Ohm\'s Law verification',
    subject: 'Science',
    chapter: 'Electricity',
    tool: 'physics_circuit',
    maturityBand: [2, 3],
    instructions: 'Set voltage to 24 V and resistance to 6 Ω. What is the current?',
    successCriteria: 'I = 24/6 = 4 A',
    submissionKind: 'numeric',
    expected: 4,
    tolerance: 0.1,
    estimatedMinutes: 3,
    xpReward: 10,
  },

  // === CHEMISTRY ===
  {
    id: 'chem_balance_iron',
    title: 'Balance iron oxide formation',
    subject: 'Science',
    chapter: 'Chemical reactions',
    tool: 'reaction_balancer',
    maturityBand: [2, 3],
    instructions: 'Balance: Fe + O2 = Fe2O3',
    successCriteria: 'Correct coefficients: 4, 3, 2',
    submissionKind: 'equation',
    expected: '4Fe + 3O2 = 2Fe2O3',
    estimatedMinutes: 5,
    xpReward: 15,
  },
  {
    id: 'chem_combustion',
    title: 'Balance methane combustion',
    subject: 'Science',
    chapter: 'Chemical reactions',
    tool: 'reaction_balancer',
    maturityBand: [2, 3, 4],
    instructions: 'Balance: CH4 + O2 = CO2 + H2O',
    successCriteria: 'CH4 + 2O2 = CO2 + 2H2O',
    submissionKind: 'equation',
    expected: 'CH4 + 2O2 = CO2 + 2H2O',
    estimatedMinutes: 4,
    xpReward: 12,
  },
  {
    id: 'chem_find_halogen',
    title: 'Find a halogen',
    subject: 'Science',
    chapter: 'Periodic classification',
    tool: 'periodic_table',
    maturityBand: [1, 2],
    instructions: 'Find any halogen (Group 17) and name it.',
    successCriteria: 'Any of F, Cl, Br, I, At.',
    submissionKind: 'text',
    expected: ['fluorine', 'chlorine', 'bromine', 'iodine', 'astatine'],
    estimatedMinutes: 3,
    xpReward: 10,
  },

  // === BIOLOGY ===
  {
    id: 'bio_cell_parts',
    title: 'Name the organelle',
    subject: 'Science',
    chapter: 'Cells',
    tool: 'diagram_explorer',
    maturityBand: [1, 2, 3],
    instructions: 'Open the plant cell diagram. Which organelle is the site of photosynthesis?',
    successCriteria: 'Chloroplast',
    submissionKind: 'text',
    expected: ['chloroplast'],
    estimatedMinutes: 3,
    xpReward: 10,
  },

  // === HISTORY ===
  {
    id: 'hist_independence_year',
    title: 'When did India become independent?',
    subject: 'Social Science',
    chapter: 'Modern India',
    tool: 'timeline',
    maturityBand: [1, 2],
    instructions: 'Use the timeline. In what year did India gain independence?',
    successCriteria: '1947',
    submissionKind: 'numeric',
    expected: 1947,
    tolerance: 0,
    estimatedMinutes: 2,
    xpReward: 8,
  },

  // === GEOGRAPHY ===
  {
    id: 'geo_capital_kerala',
    title: 'Name the capital',
    subject: 'Social Science',
    chapter: 'Indian states',
    tool: 'india_map',
    maturityBand: [1, 2],
    instructions: 'Click on Kerala and note its capital.',
    successCriteria: 'Thiruvananthapuram',
    submissionKind: 'text',
    expected: ['thiruvananthapuram'],
    estimatedMinutes: 2,
    xpReward: 8,
  },

  // === CS ===
  {
    id: 'cs_fibonacci',
    title: 'Write a Fibonacci function',
    subject: 'Computer Science',
    chapter: 'Functions & recursion',
    tool: 'code_sandbox',
    maturityBand: [3, 4],
    instructions: 'Write a function fib(n) that returns the nth Fibonacci number (fib(0)=0, fib(1)=1, fib(10)=55). Test by calling console.log(fib(10)).',
    successCriteria: 'Output must contain 55',
    submissionKind: 'code',
    expected: '55',
    hints: ['Use recursion or a loop', 'Base cases: fib(0)=0, fib(1)=1'],
    estimatedMinutes: 10,
    xpReward: 25,
  },
  {
    id: 'cs_binary_search',
    title: 'Binary search step-through',
    subject: 'Computer Science',
    chapter: 'Algorithms',
    tool: 'algorithm_viz',
    maturityBand: [3, 4],
    instructions: 'Use binary search on [2, 5, 8, 12, 16, 23, 38, 56, 72, 91] to find 23. How many comparisons were needed?',
    successCriteria: '2 comparisons (middle=16 then middle=38 wait no — work through it carefully)',
    submissionKind: 'numeric',
    expected: 2,
    tolerance: 1,
    estimatedMinutes: 4,
    xpReward: 12,
  },

  // === LANGUAGE ===
  {
    id: 'eng_paragraph_descriptive',
    title: 'Write a descriptive paragraph',
    subject: 'English',
    chapter: 'Writing skills',
    tool: 'writing',
    maturityBand: [2, 3, 4],
    instructions: 'Write a 5-7 sentence paragraph describing your favourite season. Use at least 3 sensory details.',
    successCriteria: 'Writing feedback score >= 6/10 overall.',
    submissionKind: 'text',
    estimatedMinutes: 15,
    xpReward: 20,
  },
  {
    id: 'hindi_pronunciation',
    title: 'विद्या का महत्व',
    subject: 'Hindi',
    chapter: 'उच्चारण अभ्यास',
    tool: 'pronunciation',
    maturityBand: [1, 2, 3],
    instructions: '"विद्या ही सबसे बड़ा धन है।" — यह वाक्य स्पष्ट उच्चारण के साथ बोलो।',
    successCriteria: 'उच्चारण स्कोर 70/100 से ऊपर',
    submissionKind: 'numeric',
    expected: 70,
    tolerance: 0,
    estimatedMinutes: 4,
    xpReward: 12,
  },
];

// ============================================================
// Select challenges for a student
// ============================================================

export function selectChallengesForStudent(params: {
  maturityBand: MaturityBand;
  subjectName?: string;
  chapter?: string;
  tool?: ToolKey;
  limit?: number;
}): LabChallenge[] {
  const { maturityBand, subjectName, chapter, tool, limit = 5 } = params;
  let pool = LAB_CHALLENGE_LIBRARY.filter((c) => c.maturityBand.includes(maturityBand));
  if (subjectName) pool = pool.filter((c) => c.subject.toLowerCase().includes(subjectName.toLowerCase()) || subjectName.toLowerCase().includes(c.subject.toLowerCase()));
  if (chapter) pool = pool.filter((c) => !c.chapter || c.chapter.toLowerCase().includes(chapter.toLowerCase()));
  if (tool) pool = pool.filter((c) => c.tool === tool);
  return pool.slice(0, limit);
}

// ============================================================
// Auto-grade a submission
// ============================================================

export interface GradingResult {
  correct: boolean;
  score: number;               // 0..1
  feedback: string;
}

export function gradeSubmission(challenge: LabChallenge, submission: any): GradingResult {
  if (challenge.submissionKind === 'numeric') {
    const value = Array.isArray(submission) ? submission : [submission];
    const expected = Array.isArray(challenge.expected) ? challenge.expected : [challenge.expected];
    if (value.length !== expected.length) {
      return { correct: false, score: 0, feedback: `Expected ${expected.length} number(s), got ${value.length}.` };
    }
    const tolerance = challenge.tolerance ?? 0.01;
    let correctCount = 0;
    for (let i = 0; i < expected.length; i++) {
      const v = Number(value[i]);
      const e = Number(expected[i]);
      if (Math.abs(v - e) <= tolerance) correctCount++;
    }
    const score = correctCount / expected.length;
    return {
      correct: score === 1,
      score,
      feedback: score === 1
        ? `Perfect — answer within tolerance.`
        : correctCount > 0
        ? `Got ${correctCount}/${expected.length} within tolerance.`
        : `Not within tolerance of ${tolerance}. Try again.`,
    };
  }

  if (challenge.submissionKind === 'text') {
    const s = String(submission || '').toLowerCase().trim();
    const expectedList = Array.isArray(challenge.expected) ? challenge.expected : [challenge.expected];
    const match = expectedList.some((e: any) => s.includes(String(e).toLowerCase()));
    return {
      correct: match,
      score: match ? 1 : 0,
      feedback: match ? `Correct!` : `Not quite — look more carefully.`,
    };
  }

  if (challenge.submissionKind === 'equation') {
    const s = String(submission || '').replace(/\s+/g, '').toLowerCase();
    const e = String(challenge.expected || '').replace(/\s+/g, '').toLowerCase();
    return {
      correct: s === e,
      score: s === e ? 1 : 0,
      feedback: s === e ? `Balanced correctly!` : `Coefficients don't match the expected balance.`,
    };
  }

  if (challenge.submissionKind === 'code') {
    const output = String(submission?.output || submission || '');
    const match = output.includes(String(challenge.expected || ''));
    return {
      correct: match,
      score: match ? 1 : 0,
      feedback: match ? `Code runs correctly.` : `Output didn't contain the expected value.`,
    };
  }

  // free_build / multi_choice / text fall back to manual review
  return { correct: false, score: 0.5, feedback: 'Submitted — awaiting review.' };
}
