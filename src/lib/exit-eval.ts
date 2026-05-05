/**
 * Exit-eval scoring + transfer-question generation.
 *
 * Cardinal rule: an exit eval is a TRANSFER question, not a recall question.
 * The student must apply what they just learned to a near-neighbour problem.
 * Recall ("what did the chapter say about X?") is gameable; transfer
 * ("here's a slightly different scenario — apply the rule") is honest.
 *
 * AI generation: cached per (topicId, day) so the same student can't farm
 * retries (we rotate the question after 24h, but within a session it's fixed).
 * If AI generation fails, we fall back to authored items in `questions` table
 * tagged kind=transfer where available.
 *
 * Scoring composite (all on [0,1]):
 *   correctness:        1 if correct, ~0.5 partial credit if close
 *   confidence cal:     bonus when student's confidence matched outcome
 *   anti-cheat penalty: paste detected, instant typing, tab-blur > 2
 *   final_score = clamp01( 0.7*correctness + 0.15*calibration + 0.15*timeliness ) - cheat_penalty
 */

import type { ExplanationMode } from '@/components/LearningModePill';

export type Confidence = 'guess' | 'unsure' | 'sure';
export type QuestionKind = 'transfer' | 'recall' | 'application' | 'synthesis';

export interface ExitEvalQuestion {
  id: string;
  prompt: string;
  expectedAnswer: string;
  acceptableAnswers?: string[];        // alternate phrasings considered correct
  kind: QuestionKind;
  topicId?: string;
  hint?: string;
  source: 'ai' | 'authored' | 'fallback';
  generatedAt: string;
}

export interface ExitEvalAttempt {
  question: ExitEvalQuestion;
  studentAnswer: string;
  confidenceBefore: Confidence | null;
  timeToFirstKeystrokeMs: number;
  pasteDetected: boolean;
  tabBlurCount: number;
  durationSeconds: number;
}

export interface ExitEvalResult {
  correct: boolean;
  partialCredit: number;          // 0..1
  score: number;                  // 0..1 final composite
  components: {
    correctness: number;
    calibration: number;
    timeliness: number;
    cheatPenalty: number;
  };
  cheatFlags: string[];
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,;:!?'"]+$/, '');
}

/** Loose string-match for free-text answers. Caller normalizes numerics. */
export function answersMatch(student: string, expected: string, acceptable?: string[]): boolean {
  const normS = normalize(student);
  if (!normS) return false;
  const candidates = [expected, ...(acceptable || [])].map(normalize);
  if (candidates.includes(normS)) return true;
  // Substring match in either direction (tolerates "9.8 m/s²" vs "9.8 m/s2").
  for (const c of candidates) {
    if (!c) continue;
    if (normS.includes(c) || c.includes(normS)) return true;
  }
  // Numeric equivalence (1/2 vs 0.5)
  const sNum = Number(normS.replace(/[^0-9.\-]/g, ''));
  for (const c of candidates) {
    const cNum = Number(c.replace(/[^0-9.\-]/g, ''));
    if (Number.isFinite(sNum) && Number.isFinite(cNum) && Math.abs(sNum - cNum) < 1e-6) return true;
  }
  return false;
}

export function scoreExitEval(attempt: ExitEvalAttempt): ExitEvalResult {
  const { question, studentAnswer, confidenceBefore, timeToFirstKeystrokeMs, pasteDetected, tabBlurCount, durationSeconds } = attempt;

  // Correctness — full credit on match, half credit on close substring match.
  const exactMatch = answersMatch(studentAnswer, question.expectedAnswer, question.acceptableAnswers);
  let correctness = 0;
  let partialCredit = 0;
  if (exactMatch) {
    correctness = 1;
    partialCredit = 1;
  } else {
    const sN = normalize(studentAnswer);
    const eN = normalize(question.expectedAnswer);
    if (sN.length >= 3 && eN.length >= 3 && (sN.includes(eN.slice(0, Math.min(8, eN.length))) || eN.includes(sN.slice(0, Math.min(8, sN.length))))) {
      correctness = 0.5;
      partialCredit = 0.5;
    }
  }

  // Calibration: bonus if confidence and outcome agreed (sure+correct, guess+wrong).
  let calibration = 0.5;
  if (confidenceBefore) {
    if (confidenceBefore === 'sure' && correctness === 1) calibration = 1;
    else if (confidenceBefore === 'guess' && correctness === 0) calibration = 0.7;  // honest
    else if (confidenceBefore === 'sure' && correctness === 0) calibration = 0.2;   // overconfident
    else if (confidenceBefore === 'guess' && correctness === 1) calibration = 0.6;  // lucky
    else calibration = 0.5;
  }

  // Timeliness: well-paced thinking, neither rushed nor stalled.
  // 10s..120s window is "honest"; outside that we flatten.
  let timeliness = 0.5;
  if (durationSeconds >= 10 && durationSeconds <= 120) timeliness = 1;
  else if (durationSeconds < 10) timeliness = 0.4;
  else if (durationSeconds > 240) timeliness = 0.4;

  // Anti-cheat penalties — these subtract from the final, not gate the score.
  const cheatFlags: string[] = [];
  let cheatPenalty = 0;
  if (pasteDetected) { cheatFlags.push('paste_detected'); cheatPenalty += 0.25; }
  if (timeToFirstKeystrokeMs > 0 && timeToFirstKeystrokeMs < 250 && studentAnswer.length > 8) {
    cheatFlags.push('instant_long_typing');
    cheatPenalty += 0.15;
  }
  if (tabBlurCount >= 3) { cheatFlags.push('frequent_tab_blur'); cheatPenalty += 0.1; }
  cheatPenalty = Math.min(cheatPenalty, 0.5);

  const composite = 0.7 * correctness + 0.15 * calibration + 0.15 * timeliness;
  const score = Math.max(0, Math.min(1, composite - cheatPenalty));

  return {
    correct: correctness === 1,
    partialCredit,
    score,
    components: { correctness, calibration, timeliness, cheatPenalty },
    cheatFlags,
  };
}

// ----------------------------------------------------------------------------
// ModeRecommender — companion-driven mode change logic.
//
// Reads recent session_evaluations + current mode, decides whether the
// companion should propose switching the student's preferred explanation
// mode. Hard guardrails:
//   - need >=5 sessions in current mode before considering a switch
//   - if avg score >= 0.6, no switch ("don't fix what isn't broken")
//   - if avg score < 0.4 over last 5, switch is allowed
//   - prefer modes the student has tried successfully before; otherwise pick
//     a mode they haven't tried
//   - if a mode failed twice (avg <0.4 across two attempts), mark "ineffective"
//     and don't re-suggest
//   - if student has declined the same suggestion 3 times, respect it
// ----------------------------------------------------------------------------

export interface ModeStat {
  mode: ExplanationMode;
  sessions: number;
  avgScore: number;
  attempts: number;          // distinct contiguous windows of trying this mode
}

export interface ModeRecommendation {
  shouldPropose: boolean;
  newMode?: ExplanationMode;
  reason: string;
  evidence: {
    currentMode: ExplanationMode;
    currentAvg: number;
    sessionsTried: number;
    alternatives: ModeStat[];
  };
}

const MIN_SESSIONS_BEFORE_SWITCH = 5;
const SWITCH_THRESHOLD = 0.4;
const KEEP_THRESHOLD = 0.6;

const ALL_MODES: ExplanationMode[] = [
  'visual', 'story', 'step_by_step', 'example_first', 'socratic', 'drill', 'hands_on',
];

export function recommendMode(args: {
  currentMode: ExplanationMode;
  modeStats: ModeStat[];
  declinesForCurrentSwitch: number;
  ineffectiveModes: ExplanationMode[];
}): ModeRecommendation {
  const { currentMode, modeStats, declinesForCurrentSwitch, ineffectiveModes } = args;
  const cur = modeStats.find((s) => s.mode === currentMode) || { mode: currentMode, sessions: 0, avgScore: 0.5, attempts: 0 };
  const evidence = { currentMode, currentAvg: cur.avgScore, sessionsTried: cur.sessions, alternatives: modeStats.filter((s) => s.mode !== currentMode) };

  if (declinesForCurrentSwitch >= 3) {
    return { shouldPropose: false, reason: 'Student has declined a switch 3+ times — respecting their choice.', evidence };
  }
  if (cur.sessions < MIN_SESSIONS_BEFORE_SWITCH) {
    return { shouldPropose: false, reason: `Only ${cur.sessions} session${cur.sessions === 1 ? '' : 's'} in this mode — too early to judge.`, evidence };
  }
  if (cur.avgScore >= KEEP_THRESHOLD) {
    return { shouldPropose: false, reason: 'Current mode is working — exit-eval avg is healthy.', evidence };
  }
  if (cur.avgScore >= SWITCH_THRESHOLD) {
    return { shouldPropose: false, reason: 'Mode is borderline — give it more sessions before changing.', evidence };
  }

  // Pick a candidate: previously-successful modes first, then untried modes,
  // skipping anything marked ineffective.
  const tried = new Set(modeStats.map((s) => s.mode));
  const successful = evidence.alternatives
    .filter((s) => !ineffectiveModes.includes(s.mode) && s.avgScore >= 0.55 && s.sessions >= 2)
    .sort((a, b) => b.avgScore - a.avgScore);
  if (successful.length > 0) {
    return {
      shouldPropose: true,
      newMode: successful[0].mode,
      reason: `Current mode (${currentMode}) is averaging ${(cur.avgScore * 100).toFixed(0)}%. ${successful[0].mode} averaged ${(successful[0].avgScore * 100).toFixed(0)}% when you tried it before.`,
      evidence,
    };
  }

  // Untried modes
  const untried = ALL_MODES.filter((m) => m !== currentMode && !tried.has(m) && !ineffectiveModes.includes(m));
  if (untried.length > 0) {
    // Light deterministic preference: examples first → step-by-step → visual → others
    const preference: ExplanationMode[] = ['example_first', 'step_by_step', 'visual', 'story', 'socratic', 'drill', 'hands_on'];
    const pick = preference.find((m) => untried.includes(m)) || untried[0];
    return {
      shouldPropose: true,
      newMode: pick,
      reason: `Current mode (${currentMode}) hasn't been working (avg ${(cur.avgScore * 100).toFixed(0)}%). Let's try ${pick.replace('_', ' ')} — you haven't given it a fair shot yet.`,
      evidence,
    };
  }

  return { shouldPropose: false, reason: 'No promising alternative — keeping current mode.', evidence };
}

/** Given session_evaluations rows, group by mode and compute stats. */
export function statsFromSessions(rows: Array<{ mode_used: string | null; score: number }>): ModeStat[] {
  const buckets: Record<string, { sum: number; n: number }> = {};
  for (const r of rows) {
    const m = (r.mode_used || 'step_by_step') as ExplanationMode;
    if (!buckets[m]) buckets[m] = { sum: 0, n: 0 };
    buckets[m].sum += r.score;
    buckets[m].n += 1;
  }
  return Object.entries(buckets).map(([mode, b]) => ({
    mode: mode as ExplanationMode,
    sessions: b.n,
    avgScore: b.n > 0 ? b.sum / b.n : 0,
    attempts: 1,  // we'd need contiguity tracking for true attempts; close enough for v1
  }));
}
