// ============================================================================
// Pedagogy Engine v1 — Scoring Formulas, SM-2, Decision Engine
// ============================================================================

import type {
  LearnerState, PedagogyModule, MasteryBand, ReadinessLevel,
  SM2Input, SM2Output, DecisionSignals, EngineRoute, EngineThresholds,
  DiagnosticResponse, MasteryCheckpoint, SupportTier,
} from '@/types/pedagogy-engine';
import { DEFAULT_THRESHOLDS } from '@/types/pedagogy-engine';

// ============================================================================
// 1. MASTERY SCORING — 7-component formula (sum = 100)
// ============================================================================

export interface MasteryComponents {
  recall: number;         // max 20
  comprehension: number;  // max 20
  application: number;    // max 20
  transfer: number;       // max 15
  retention: number;      // max 10
  metacognition: number;  // max 10
  independence: number;   // max 5
}

const MASTERY_MAX: MasteryComponents = {
  recall: 20,
  comprehension: 20,
  application: 20,
  transfer: 15,
  retention: 10,
  metacognition: 10,
  independence: 5,
};

/** Compute total mastery and band from 7 components */
export function computeMastery(scores: MasteryComponents): { total: number; band: MasteryBand } {
  // Clamp each component to its max
  const clamped: MasteryComponents = {
    recall: Math.min(Math.max(scores.recall, 0), MASTERY_MAX.recall),
    comprehension: Math.min(Math.max(scores.comprehension, 0), MASTERY_MAX.comprehension),
    application: Math.min(Math.max(scores.application, 0), MASTERY_MAX.application),
    transfer: Math.min(Math.max(scores.transfer, 0), MASTERY_MAX.transfer),
    retention: Math.min(Math.max(scores.retention, 0), MASTERY_MAX.retention),
    metacognition: Math.min(Math.max(scores.metacognition, 0), MASTERY_MAX.metacognition),
    independence: Math.min(Math.max(scores.independence, 0), MASTERY_MAX.independence),
  };

  const total = clamped.recall + clamped.comprehension + clamped.application +
    clamped.transfer + clamped.retention + clamped.metacognition + clamped.independence;

  const band: MasteryBand =
    total >= 90 ? 'advanced' :
    total >= 75 ? 'secure' :
    total >= 60 ? 'developing' :
    total >= 40 ? 'emerging' :
    'foundation';

  return { total, band };
}

/** Check if all components meet minimum percentage of their max */
export function checkComponentMinimums(
  scores: MasteryComponents,
  minPct: number = 50
): { passed: boolean; weak: string[] } {
  const weak: string[] = [];
  for (const [key, value] of Object.entries(scores)) {
    const max = MASTERY_MAX[key as keyof MasteryComponents];
    if ((value / max) * 100 < minPct) {
      weak.push(key);
    }
  }
  return { passed: weak.length === 0, weak };
}

/** Get the weakest component as name + percentage */
export function weakestComponent(scores: MasteryComponents): { name: string; pct: number } {
  let weakest = 'recall';
  let lowestPct = 100;

  for (const [key, value] of Object.entries(scores)) {
    const max = MASTERY_MAX[key as keyof MasteryComponents];
    const pct = (value / max) * 100;
    if (pct < lowestPct) {
      lowestPct = pct;
      weakest = key;
    }
  }

  return { name: weakest, pct: lowestPct };
}

// ============================================================================
// 2. DIAGNOSTIC SCORING — Compute prior knowledge & readiness
// ============================================================================

export interface DiagnosticResult {
  prior_knowledge_score: number;   // 0-100
  readiness_level: ReadinessLevel;
  misconceptions_detected: string[];
  confidence_accuracy_gap: number; // positive = overconfident
}

export function scoreDiagnostic(responses: DiagnosticResponse[]): DiagnosticResult {
  if (responses.length === 0) {
    return { prior_knowledge_score: 0, readiness_level: 'unknown', misconceptions_detected: [], confidence_accuracy_gap: 0 };
  }

  const correct = responses.filter(r => r.is_correct).length;
  const prior_knowledge_score = (correct / responses.length) * 100;

  // Confidence-accuracy gap
  const avgConfidence = responses.reduce((sum, r) => sum + ((r.confidence_rating || 3) / 5) * 100, 0) / responses.length;
  const confidence_accuracy_gap = avgConfidence - prior_knowledge_score;

  // Collect misconceptions
  const misconceptions_detected = responses
    .filter(r => r.misconception_detected && !r.is_correct)
    .map(r => r.misconception_detected!)
    .filter((v, i, a) => a.indexOf(v) === i); // unique

  // Determine readiness
  let readiness_level: ReadinessLevel;
  if (prior_knowledge_score >= 85) {
    readiness_level = 'above_level';
  } else if (prior_knowledge_score >= 70) {
    readiness_level = 'ready';
  } else if (prior_knowledge_score >= 40) {
    readiness_level = 'needs_scaffolding';
  } else {
    readiness_level = 'not_ready';
  }

  return { prior_knowledge_score, readiness_level, misconceptions_detected, confidence_accuracy_gap };
}

// ============================================================================
// 3. SM-2 SPACED REPETITION ALGORITHM
// ============================================================================

/**
 * SM-2 Algorithm (SuperMemo 2)
 * quality: 0-5 where 0=complete blackout, 5=perfect recall
 * Returns new ease factor, interval, repetition count, and next review date
 */
export function sm2(input: SM2Input): SM2Output {
  const { quality, ease_factor, interval_days, repetitions } = input;

  let newEF = ease_factor;
  let newInterval: number;
  let newReps: number;

  if (quality >= 3) {
    // Successful recall
    if (repetitions === 0) {
      newInterval = 1;
    } else if (repetitions === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(interval_days * ease_factor * 10) / 10;
    }
    newReps = repetitions + 1;
  } else {
    // Failed recall — reset
    newInterval = 1;
    newReps = 0;
  }

  // Update ease factor: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  newEF = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  newEF = Math.max(1.3, Math.round(newEF * 100) / 100); // minimum 1.3

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + Math.ceil(newInterval));

  return {
    ease_factor: newEF,
    interval_days: newInterval,
    repetitions: newReps,
    next_review_at: nextReview.toISOString(),
  };
}

// ============================================================================
// 4. METACOGNITION SCORING
// ============================================================================

export interface MetacognitionResult {
  confidence_calibration: number; // 0-100, 100=perfectly calibrated
  self_regulation_score: number;
  careless_error_rate: number;
  nudge: string | null;
}

/**
 * Compute metacognition metrics.
 * @param confidenceBefore - self-rated confidence before attempt (1-5)
 * @param confidenceAfter - self-rated confidence after seeing result (1-5)
 * @param actualScore - actual performance (0-100)
 * @param usedPlanning - did student plan before starting?
 * @param usedMonitoring - did student monitor during?
 * @param usedEvaluation - did student evaluate after?
 * @param totalAttempts - total problems attempted
 * @param carelessErrors - errors that were not knowledge gaps
 */
export function computeMetacognition(
  confidenceBefore: number,
  actualScore: number,
  usedPlanning: boolean,
  usedMonitoring: boolean,
  usedEvaluation: boolean,
  totalAttempts: number,
  carelessErrors: number,
): MetacognitionResult {
  // Confidence calibration: how close is self-rated confidence to actual performance
  const predictedScore = (confidenceBefore / 5) * 100;
  const gap = Math.abs(predictedScore - actualScore);
  const confidence_calibration = Math.max(0, 100 - gap * 2); // 0-100

  // Self-regulation: composite of planning + monitoring + evaluation use
  const selfRegComponents = [usedPlanning, usedMonitoring, usedEvaluation];
  const selfRegBase = selfRegComponents.filter(Boolean).length / 3;
  const self_regulation_score = Math.round(selfRegBase * 100);

  // Careless error rate
  const careless_error_rate = totalAttempts > 0
    ? Math.round((carelessErrors / totalAttempts) * 100)
    : 0;

  // Nudge message
  let nudge: string | null = null;
  if (confidence_calibration < 50 && predictedScore > actualScore) {
    nudge = 'You might be overestimating your understanding. Try explaining the concept in your own words before answering.';
  } else if (confidence_calibration < 50 && predictedScore < actualScore) {
    nudge = 'You know more than you think! Trust your understanding and try answering without second-guessing.';
  } else if (careless_error_rate > 15) {
    nudge = 'Some of your errors seem like slips, not knowledge gaps. Try slowing down and checking your work.';
  } else if (!usedPlanning) {
    nudge = 'Before starting, take a moment to plan your approach. What do you already know? What will you try first?';
  }

  return { confidence_calibration, self_regulation_score, careless_error_rate, nudge };
}

// ============================================================================
// 5. DECISION ENGINE — Routes student to the right module
// ============================================================================

/** Extract decision signals from a learner state */
export function extractSignals(state: LearnerState, itemsDueCount: number = 0): DecisionSignals {
  const misconceptions = (state.active_misconceptions || []).filter(m => !m.resolved);
  const weak = weakestComponent({
    recall: state.mastery_score_recall,
    comprehension: state.mastery_score_comprehension,
    application: state.mastery_score_application,
    transfer: state.mastery_score_transfer,
    retention: state.mastery_score_retention,
    metacognition: state.mastery_score_metacognition,
    independence: state.mastery_score_independence,
  });

  return {
    prior_knowledge_score: state.prior_knowledge_score,
    readiness_level: state.readiness_level,
    misconception_count: misconceptions.length,
    scaffold_level: state.scaffold_level,
    consecutive_correct: state.consecutive_correct,
    consecutive_wrong: state.consecutive_wrong,
    hint_dependence_rate: state.hint_dependence_rate,
    retrieval_strength: state.retrieval_strength,
    retrieval_success_rate: state.retrieval_success_rate,
    items_due_count: itemsDueCount,
    active_unresolved_count: misconceptions.length,
    repeat_misconception: misconceptions.some(m => m.occurrences >= 3),
    confidence_accuracy_gap: state.confidence_accuracy_gap,
    careless_error_rate: state.careless_error_rate,
    self_regulation_score: state.self_regulation_score,
    mastery_total: state.mastery_total,
    weakest_component: weak.name,
    weakest_component_pct: weak.pct,
    stalled_cycles: state.stalled_cycles,
    frustration_signals: state.frustration_signals,
    fallback_loop_count: state.fallback_loop_count,
    session_abandonment_count: state.session_abandonment_count,
  };
}

/**
 * The Decision Engine state machine.
 * Evaluates signals against thresholds and returns the next module to activate.
 *
 * Priority order:
 * 1. Tier escalation (urgent safety net)
 * 2. Misconception repair (if active unresolved)
 * 3. Metacognition nudge (if calibration is off)
 * 4. Retrieval practice (if items are due)
 * 5. Normal progression: Access → Diagnostic → Scaffold → Retrieve → Mastery
 */
export function routeStudent(
  state: LearnerState,
  signals: DecisionSignals,
  thresholds: EngineThresholds = DEFAULT_THRESHOLDS,
): EngineRoute {
  const t = thresholds;

  // --- Priority 1: Tier escalation checks ---
  if (signals.stalled_cycles >= t.stalled_cycles_tier3 || signals.frustration_signals >= t.frustration_signals_escalate * 2) {
    return {
      next_module: 'tiered_support',
      reason: 'Persistent stalling or high frustration — escalating to Tier 3 intensive support',
      signals_used: { stalled_cycles: signals.stalled_cycles, frustration_signals: signals.frustration_signals },
      thresholds_applied: { stalled_cycles_tier3: t.stalled_cycles_tier3, frustration_signals_escalate: t.frustration_signals_escalate },
      priority: 'escalated',
    };
  }

  if (signals.stalled_cycles >= t.stalled_cycles_tier2 || signals.fallback_loop_count >= t.fallback_loop_max) {
    return {
      next_module: 'tiered_support',
      reason: 'Multiple stalled cycles or fallback loops — moving to Tier 2 targeted support',
      signals_used: { stalled_cycles: signals.stalled_cycles, fallback_loop_count: signals.fallback_loop_count },
      thresholds_applied: { stalled_cycles_tier2: t.stalled_cycles_tier2, fallback_loop_max: t.fallback_loop_max },
      priority: 'urgent',
    };
  }

  // --- Priority 2: Misconception repair ---
  if (signals.active_unresolved_count >= t.misconception_count_threshold || signals.repeat_misconception) {
    return {
      next_module: 'feedback_repair',
      reason: signals.repeat_misconception
        ? 'Repeated misconception detected — needs contrastive feedback'
        : `${signals.active_unresolved_count} active misconceptions need repair`,
      signals_used: { active_unresolved_count: signals.active_unresolved_count, repeat_misconception: signals.repeat_misconception },
      thresholds_applied: { misconception_count_threshold: t.misconception_count_threshold },
      priority: 'urgent',
    };
  }

  // --- Priority 3: Metacognition nudge ---
  if (Math.abs(signals.confidence_accuracy_gap) > t.confidence_accuracy_gap_threshold ||
      signals.careless_error_rate > t.careless_error_rate_threshold) {
    return {
      next_module: 'metacognition',
      reason: Math.abs(signals.confidence_accuracy_gap) > t.confidence_accuracy_gap_threshold
        ? `Confidence-accuracy gap of ${signals.confidence_accuracy_gap.toFixed(0)}% — metacognition check needed`
        : `Careless error rate at ${signals.careless_error_rate.toFixed(0)}% — needs self-monitoring`,
      signals_used: { confidence_accuracy_gap: signals.confidence_accuracy_gap, careless_error_rate: signals.careless_error_rate },
      thresholds_applied: { confidence_accuracy_gap_threshold: t.confidence_accuracy_gap_threshold, careless_error_rate_threshold: t.careless_error_rate_threshold },
      priority: 'normal',
    };
  }

  // --- Priority 4: Retrieval practice (if items due) ---
  if (signals.items_due_count > 0 && signals.retrieval_strength < t.retrieval_strength_min) {
    return {
      next_module: 'retrieve_retain',
      reason: `${signals.items_due_count} spaced repetition items due, retrieval strength at ${signals.retrieval_strength.toFixed(0)}%`,
      signals_used: { items_due_count: signals.items_due_count, retrieval_strength: signals.retrieval_strength },
      thresholds_applied: { retrieval_strength_min: t.retrieval_strength_min },
      priority: 'normal',
    };
  }

  // --- Normal progression flow ---
  const module = state.current_module;

  // New topic or unknown readiness → Diagnostic
  if (module === 'access_fit' || state.readiness_level === 'unknown') {
    return {
      next_module: 'diagnostic',
      reason: 'Starting topic — running diagnostic placement',
      signals_used: { readiness_level: signals.readiness_level },
      thresholds_applied: {},
      priority: 'normal',
    };
  }

  // Diagnostic complete → route based on readiness
  if (module === 'diagnostic') {
    if (signals.prior_knowledge_score < t.diagnostic_pass_score) {
      return {
        next_module: 'teach_scaffold',
        reason: `Prior knowledge at ${signals.prior_knowledge_score.toFixed(0)}% — needs scaffolded instruction`,
        signals_used: { prior_knowledge_score: signals.prior_knowledge_score },
        thresholds_applied: { diagnostic_pass_score: t.diagnostic_pass_score },
        priority: 'normal',
      };
    }
    // Ready or above — go to retrieval practice
    return {
      next_module: 'retrieve_retain',
      reason: `Prior knowledge at ${signals.prior_knowledge_score.toFixed(0)}% — ready for retrieval practice`,
      signals_used: { prior_knowledge_score: signals.prior_knowledge_score },
      thresholds_applied: { diagnostic_pass_score: t.diagnostic_pass_score },
      priority: 'normal',
    };
  }

  // Teaching → check scaffold readiness
  if (module === 'teach_scaffold') {
    if (signals.consecutive_correct >= t.scaffold_promote_consecutive_correct &&
        signals.hint_dependence_rate <= t.hint_dependence_max) {
      return {
        next_module: 'retrieve_retain',
        reason: `${signals.consecutive_correct} consecutive correct with low hint dependence — moving to retrieval`,
        signals_used: { consecutive_correct: signals.consecutive_correct, hint_dependence_rate: signals.hint_dependence_rate },
        thresholds_applied: { scaffold_promote_consecutive_correct: t.scaffold_promote_consecutive_correct, hint_dependence_max: t.hint_dependence_max },
        priority: 'normal',
      };
    }
    // Stay in scaffold
    return {
      next_module: 'teach_scaffold',
      reason: 'Still building understanding — continuing scaffolded practice',
      signals_used: { consecutive_correct: signals.consecutive_correct, hint_dependence_rate: signals.hint_dependence_rate },
      thresholds_applied: {},
      priority: 'normal',
    };
  }

  // Retrieval → check if ready for mastery
  if (module === 'retrieve_retain') {
    if (signals.retrieval_success_rate >= t.retrieval_success_rate_promote &&
        signals.retrieval_strength >= t.retrieval_strength_min) {
      return {
        next_module: 'mastery_check',
        reason: `Retrieval success at ${signals.retrieval_success_rate.toFixed(0)}% — ready for mastery check`,
        signals_used: { retrieval_success_rate: signals.retrieval_success_rate, retrieval_strength: signals.retrieval_strength },
        thresholds_applied: { retrieval_success_rate_promote: t.retrieval_success_rate_promote },
        priority: 'normal',
      };
    }
    return {
      next_module: 'retrieve_retain',
      reason: 'Strengthening retention — continuing spaced practice',
      signals_used: { retrieval_success_rate: signals.retrieval_success_rate },
      thresholds_applied: {},
      priority: 'normal',
    };
  }

  // Mastery check result → promote or loop back
  if (module === 'mastery_check') {
    if (signals.mastery_total >= t.mastery_promote_min && signals.weakest_component_pct >= t.mastery_each_component_min_pct) {
      // Promoted! Schedule delayed check and move to next topic
      return {
        next_module: 'access_fit',
        reason: `Mastery at ${signals.mastery_total.toFixed(0)}% — promoted! Moving to next topic.`,
        signals_used: { mastery_total: signals.mastery_total, weakest_component_pct: signals.weakest_component_pct },
        thresholds_applied: { mastery_promote_min: t.mastery_promote_min, mastery_each_component_min_pct: t.mastery_each_component_min_pct },
        priority: 'normal',
      };
    }
    // Not promoted — identify weak area and route back
    const targetModule = mapWeakComponentToModule(signals.weakest_component);
    return {
      next_module: targetModule,
      reason: `Mastery at ${signals.mastery_total.toFixed(0)}% (need ${t.mastery_promote_min}), weakest: ${signals.weakest_component} at ${signals.weakest_component_pct.toFixed(0)}%`,
      signals_used: { mastery_total: signals.mastery_total, weakest_component: signals.weakest_component, weakest_component_pct: signals.weakest_component_pct },
      thresholds_applied: { mastery_promote_min: t.mastery_promote_min },
      priority: 'normal',
    };
  }

  // Feedback/repair → re-check
  if (module === 'feedback_repair') {
    if (signals.active_unresolved_count === 0) {
      return {
        next_module: 'retrieve_retain',
        reason: 'Misconceptions resolved — returning to retrieval practice',
        signals_used: { active_unresolved_count: signals.active_unresolved_count },
        thresholds_applied: {},
        priority: 'normal',
      };
    }
    return {
      next_module: 'feedback_repair',
      reason: `Still ${signals.active_unresolved_count} unresolved misconceptions`,
      signals_used: { active_unresolved_count: signals.active_unresolved_count },
      thresholds_applied: {},
      priority: 'normal',
    };
  }

  // Metacognition → return to previous flow
  if (module === 'metacognition') {
    return {
      next_module: signals.mastery_total >= 60 ? 'mastery_check' : 'retrieve_retain',
      reason: 'Metacognition check complete — continuing progression',
      signals_used: { mastery_total: signals.mastery_total },
      thresholds_applied: {},
      priority: 'normal',
    };
  }

  // Tiered support → re-evaluate
  if (module === 'tiered_support') {
    if (signals.stalled_cycles === 0 && signals.frustration_signals < t.frustration_signals_escalate) {
      return {
        next_module: 'diagnostic',
        reason: 'Support period stabilized — re-diagnosing to find current level',
        signals_used: { stalled_cycles: signals.stalled_cycles, frustration_signals: signals.frustration_signals },
        thresholds_applied: {},
        priority: 'normal',
      };
    }
    return {
      next_module: 'tiered_support',
      reason: 'Still in support period — continuing interventions',
      signals_used: { stalled_cycles: signals.stalled_cycles },
      thresholds_applied: {},
      priority: 'normal',
    };
  }

  // Fallback — restart from diagnostic
  return {
    next_module: 'diagnostic',
    reason: 'Routing reset — running fresh diagnostic',
    signals_used: {},
    thresholds_applied: {},
    priority: 'normal',
  };
}

/** Map a weak mastery component back to the module that addresses it */
function mapWeakComponentToModule(component: string): PedagogyModule {
  switch (component) {
    case 'recall':
    case 'retention':
      return 'retrieve_retain';
    case 'comprehension':
    case 'application':
      return 'teach_scaffold';
    case 'transfer':
      return 'teach_scaffold'; // needs more worked examples in new contexts
    case 'metacognition':
      return 'metacognition';
    case 'independence':
      return 'teach_scaffold'; // reduce scaffold level
    default:
      return 'diagnostic';
  }
}

// ============================================================================
// 6. SCAFFOLD LEVEL MANAGEMENT
// ============================================================================

/**
 * Adjust scaffold level based on student performance.
 * Level 5 = full worked example, Level 0 = fully independent
 */
export function adjustScaffoldLevel(
  currentLevel: number,
  isCorrect: boolean,
  usedHint: boolean,
  consecutiveCorrect: number,
  consecutiveWrong: number,
  thresholds: EngineThresholds = DEFAULT_THRESHOLDS,
): { newLevel: number; consecutiveCorrect: number; consecutiveWrong: number } {
  let newCorrect = isCorrect ? consecutiveCorrect + 1 : 0;
  let newWrong = isCorrect ? 0 : consecutiveWrong + 1;

  let newLevel = currentLevel;

  // Promote: reduce scaffolding
  if (newCorrect >= thresholds.scaffold_promote_consecutive_correct && !usedHint) {
    newLevel = Math.max(0, currentLevel - 1);
    newCorrect = 0; // reset after promotion
  }

  // Demote: increase scaffolding
  if (newWrong >= thresholds.scaffold_demote_consecutive_wrong) {
    newLevel = Math.min(5, currentLevel + 1);
    newWrong = 0; // reset after demotion
  }

  return { newLevel, consecutiveCorrect: newCorrect, consecutiveWrong: newWrong };
}

// ============================================================================
// 7. TIER DETERMINATION
// ============================================================================

export function determineTier(
  stalledCycles: number,
  frustrationSignals: number,
  fallbackLoops: number,
  thresholds: EngineThresholds = DEFAULT_THRESHOLDS,
): SupportTier {
  if (stalledCycles >= thresholds.stalled_cycles_tier3 ||
      frustrationSignals >= thresholds.frustration_signals_escalate * 2 ||
      fallbackLoops >= thresholds.fallback_loop_max * 2) {
    return 3;
  }
  if (stalledCycles >= thresholds.stalled_cycles_tier2 ||
      frustrationSignals >= thresholds.frustration_signals_escalate ||
      fallbackLoops >= thresholds.fallback_loop_max) {
    return 2;
  }
  return 1;
}

// ============================================================================
// 8. MASTERY CHECK — Evaluate a checkpoint submission
// ============================================================================

export interface CheckpointScoring {
  scores: MasteryComponents;
  total: number;
  band: MasteryBand;
  promoted: boolean;
  blocked_by: string[];
  weak_subskills: string[];
}

/**
 * Score a mastery checkpoint from question-level scores.
 * Each question should tag which component it measures.
 */
export function scoreMasteryCheckpoint(
  questionScores: { component: keyof MasteryComponents; earned: number; max: number }[],
  thresholds: EngineThresholds = DEFAULT_THRESHOLDS,
): CheckpointScoring {
  // Aggregate by component
  const earned: Record<string, number> = {};
  const maxes: Record<string, number> = {};

  for (const q of questionScores) {
    earned[q.component] = (earned[q.component] || 0) + q.earned;
    maxes[q.component] = (maxes[q.component] || 0) + q.max;
  }

  // Normalize to mastery max scale
  const scores: MasteryComponents = {
    recall: maxes.recall ? (earned.recall || 0) / maxes.recall * MASTERY_MAX.recall : 0,
    comprehension: maxes.comprehension ? (earned.comprehension || 0) / maxes.comprehension * MASTERY_MAX.comprehension : 0,
    application: maxes.application ? (earned.application || 0) / maxes.application * MASTERY_MAX.application : 0,
    transfer: maxes.transfer ? (earned.transfer || 0) / maxes.transfer * MASTERY_MAX.transfer : 0,
    retention: maxes.retention ? (earned.retention || 0) / maxes.retention * MASTERY_MAX.retention : 0,
    metacognition: maxes.metacognition ? (earned.metacognition || 0) / maxes.metacognition * MASTERY_MAX.metacognition : 0,
    independence: maxes.independence ? (earned.independence || 0) / maxes.independence * MASTERY_MAX.independence : 0,
  };

  const { total, band } = computeMastery(scores);
  const { passed, weak } = checkComponentMinimums(scores, thresholds.mastery_each_component_min_pct);

  const promoted = total >= thresholds.mastery_promote_min && passed;
  const blocked_by = total >= thresholds.mastery_promote_min && !passed ? weak : [];

  return { scores, total, band, promoted, blocked_by, weak_subskills: weak };
}

// ============================================================================
// 9. RETRIEVAL STRENGTH — Aggregate from queue items
// ============================================================================

export function computeRetrievalStrength(
  items: { times_correct: number; times_wrong: number; ease_factor: number }[],
): number {
  if (items.length === 0) return 0;

  let totalStrength = 0;
  for (const item of items) {
    const total = item.times_correct + item.times_wrong;
    if (total === 0) continue;
    const accuracy = item.times_correct / total;
    const efWeight = (item.ease_factor - 1.3) / (2.5 - 1.3); // normalize EF to 0-1
    totalStrength += accuracy * 0.7 + efWeight * 0.3;
  }

  return Math.round((totalStrength / items.length) * 100);
}

// ============================================================================
// 10. HINT DEPENDENCE RATE
// ============================================================================

export function computeHintDependence(
  totalAttempts: number,
  attemptsWithHint: number,
): number {
  if (totalAttempts === 0) return 0;
  return Math.round((attemptsWithHint / totalAttempts) * 100);
}
