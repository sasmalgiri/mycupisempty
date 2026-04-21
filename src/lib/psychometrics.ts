/**
 * Psychometrics — IRT (Item Response Theory) + BKT (Bayesian Knowledge Tracing).
 *
 * Our mastery engine uses categorical bands (foundation → advanced). That's
 * adequate but not rigorous. Real psychometrics uses two frameworks that
 * Knewton, ALEKS, and Duolingo SRS are built on:
 *
 * IRT (Item Response Theory) — Rasch / 2PL / 3PL models
 *   Estimates a continuous student ability θ (theta) and, for each question,
 *   a difficulty β (beta) and discrimination α (alpha). P(correct) is a
 *   logistic function of (θ - β). This lets us compare students + questions
 *   on the same scale.
 *
 * BKT (Bayesian Knowledge Tracing)
 *   Models each skill as a hidden Bernoulli variable (known/not-known) with
 *   four parameters: P(prior), P(learn), P(slip), P(guess). Updates P(known)
 *   after each attempt using Bayes. Produces a smooth mastery probability
 *   per skill — much better than our state categorization alone.
 *
 * We combine: BKT decides "do they know this skill?", IRT decides "how hard
 * is the NEXT question?" to keep them in flow (near 70% success rate).
 */

// ============================================================
// IRT — 2-parameter logistic model
// ============================================================

/** P(correct | theta, beta, alpha) */
export function irtProbability(theta: number, beta: number, alpha: number = 1): number {
  const z = alpha * (theta - beta);
  return 1 / (1 + Math.exp(-z));
}

/**
 * Update student ability estimate after one attempt using gradient ascent.
 * Converges well with small step size (eta) and plenty of items.
 */
export function updateTheta(
  thetaPrior: number,
  items: Array<{ beta: number; alpha?: number; correct: boolean }>,
  eta: number = 0.5,
): number {
  let theta = thetaPrior;
  // Simple gradient ascent on log-likelihood for this sequence
  for (let iter = 0; iter < 20; iter++) {
    let grad = 0;
    let info = 0; // Fisher information
    for (const it of items) {
      const alpha = it.alpha ?? 1;
      const p = irtProbability(theta, it.beta, alpha);
      const y = it.correct ? 1 : 0;
      grad += alpha * (y - p);
      info += alpha * alpha * p * (1 - p);
    }
    if (info < 1e-6) break;
    const step = grad / info; // Newton step
    theta += Math.max(-1, Math.min(1, step)) * eta;
    if (Math.abs(step) < 1e-4) break;
  }
  // Bound theta to reasonable range
  return Math.max(-4, Math.min(4, theta));
}

/**
 * Pick the next item in a CAT (Computerized Adaptive Testing) sense:
 * the one that maximizes Fisher information at current theta.
 * Equivalent to picking the item whose difficulty is closest to theta
 * (assuming similar alpha).
 */
export function pickNextItem<T extends { beta: number; alpha?: number }>(
  theta: number,
  pool: T[],
  targetP: number = 0.7,
): T | null {
  if (pool.length === 0) return null;
  // Target difficulty = theta - logit(targetP)/alpha
  const logitTarget = Math.log(targetP / (1 - targetP));
  let best: T | null = null;
  let bestScore = -Infinity;
  for (const it of pool) {
    const alpha = it.alpha ?? 1;
    const targetBeta = theta - logitTarget / alpha;
    // Prefer items whose beta is near targetBeta AND whose alpha is high
    const score = -Math.abs(it.beta - targetBeta) + alpha * 0.1;
    if (score > bestScore) {
      bestScore = score;
      best = it;
    }
  }
  return best;
}

/** Map continuous theta to a friendly band label */
export function thetaBand(theta: number): 'foundation' | 'emerging' | 'developing' | 'secure' | 'advanced' {
  if (theta < -1.5) return 'foundation';
  if (theta < -0.5) return 'emerging';
  if (theta < 0.5) return 'developing';
  if (theta < 1.5) return 'secure';
  return 'advanced';
}

// ============================================================
// BKT — Bayesian Knowledge Tracing
// ============================================================

export interface BKTParams {
  pPrior: number;     // P(known before first attempt)
  pLearn: number;     // P(learn | unknown, attempted)
  pSlip: number;      // P(wrong | known)
  pGuess: number;     // P(correct | unknown)
}

/** Reasonable defaults for K-12. These get refined per-skill over time. */
export const DEFAULT_BKT: BKTParams = {
  pPrior: 0.3,
  pLearn: 0.15,
  pSlip: 0.1,
  pGuess: 0.25,
};

export interface BKTState {
  pKnown: number;         // current posterior P(skill known)
  attempts: number;
}

/**
 * Update P(known) after one attempt. Standard BKT update:
 *
 *   Posterior P(known | correct)   = P(known) * (1-pSlip) / P(correct)
 *   Posterior P(known | incorrect) = P(known) * pSlip / P(incorrect)
 *   Then learning opportunity: P(known+1) = posterior + (1 - posterior) * pLearn
 */
export function bktUpdate(state: BKTState, correct: boolean, params: BKTParams = DEFAULT_BKT): BKTState {
  const { pLearn, pSlip, pGuess } = params;
  const pKnown = state.pKnown;
  const pUnknown = 1 - pKnown;

  // P(observation | known), P(observation | unknown)
  const pObsGivenKnown = correct ? (1 - pSlip) : pSlip;
  const pObsGivenUnknown = correct ? pGuess : (1 - pGuess);

  // P(observation) = marginal
  const pObs = pKnown * pObsGivenKnown + pUnknown * pObsGivenUnknown;
  if (pObs < 1e-9) {
    return { pKnown: pKnown, attempts: state.attempts + 1 };
  }

  // Bayes: P(known | observation)
  const posterior = (pKnown * pObsGivenKnown) / pObs;
  // Learning transition: might learn in this attempt
  const nextPKnown = posterior + (1 - posterior) * pLearn;

  return {
    pKnown: Math.max(0, Math.min(1, nextPKnown)),
    attempts: state.attempts + 1,
  };
}

/** Run BKT over a sequence of attempts from scratch */
export function bktRun(attempts: boolean[], params: BKTParams = DEFAULT_BKT): BKTState {
  let state: BKTState = { pKnown: params.pPrior, attempts: 0 };
  for (const a of attempts) state = bktUpdate(state, a, params);
  return state;
}

/** Map BKT probability to mastery category */
export function bktBand(pKnown: number, attempts: number): 'learning' | 'fragile' | 'stable' | 'mastered' {
  if (pKnown >= 0.95 && attempts >= 5) return 'mastered';
  if (pKnown >= 0.85 && attempts >= 3) return 'stable';
  if (pKnown >= 0.6) return 'fragile';
  return 'learning';
}

// ============================================================
// Item difficulty calibration (offline / batch)
// ============================================================

/**
 * From a pool of past attempts across many students, estimate per-item
 * difficulty beta (proportion correct, logit-transformed).
 *
 * This is a simplified 1-parameter (Rasch) estimator. For production,
 * run a proper MML estimator offline, but this is good for online updates.
 */
export function estimateBeta(correctCount: number, totalAttempts: number): number {
  if (totalAttempts === 0) return 0;
  // Smooth with Laplace prior (1/2 correct, 1/2 wrong)
  const p = (correctCount + 0.5) / (totalAttempts + 1);
  // Logit transform
  return -Math.log(p / (1 - p));
}

// ============================================================
// Combined: next-question picker using theta + BKT per-skill
// ============================================================

export interface SkillAbility {
  skillId: string;
  theta: number;
  bktState: BKTState;
}

/**
 * Pick a next question from a pool, weighing:
 *   - IRT: how close is difficulty to the student's theta?
 *   - BKT: which skill has the lowest P(known) (prioritize learning opportunity)
 */
export function pickNextAdaptive<T extends { id: string; beta: number; alpha?: number; skillId?: string }>(
  abilities: Record<string, SkillAbility>,
  pool: T[],
  options?: { targetP?: number; preferUnlearned?: boolean },
): T | null {
  if (pool.length === 0) return null;
  const targetP = options?.targetP ?? 0.7;
  const preferUnlearned = options?.preferUnlearned ?? true;

  let best: T | null = null;
  let bestScore = -Infinity;

  for (const item of pool) {
    const skill = item.skillId ? abilities[item.skillId] : null;
    const theta = skill?.theta ?? 0;
    const pKnown = skill?.bktState.pKnown ?? 0.3;

    // IRT flow score: closer to target probability = better
    const p = irtProbability(theta, item.beta, item.alpha ?? 1);
    const flowScore = 1 - Math.abs(p - targetP);

    // BKT priority: lower pKnown = higher learning value
    const bktScore = preferUnlearned ? (1 - pKnown) : 0;

    const score = flowScore * 0.7 + bktScore * 0.3;
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return best;
}
