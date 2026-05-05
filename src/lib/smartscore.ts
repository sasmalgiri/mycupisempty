/**
 * IXL-style SmartScore for skill mastery (replaces opaque mastery dots).
 *
 * Range 0..100. Three thresholds:
 *   0..70   practicing       (big point gains, small penalties)
 *   71..90  mid-rigor        (gains slow, penalties grow)
 *   91..100 challenge_zone   (must consistently nail hard items)
 *   100     mastered         (locked in)
 *
 * Apply rules: each correct answer adds delta based on the band; wrong
 * answers subtract a smaller delta. Difficulty multiplier (easy/medium/hard)
 * scales the gain so a hard problem is worth more.
 *
 * Mastered locks at 100 — no decay, but the FSRS scheduler still surfaces
 * the skill for review. Mastery and retention are different signals.
 */

export type Band = 'practicing' | 'mid' | 'challenge_zone' | 'mastered';
export type Difficulty = 'easy' | 'medium' | 'hard';

const DIFFICULTY_MULT: Record<Difficulty, number> = { easy: 1, medium: 1.5, hard: 2.2 };

function bandFor(score: number): Band {
  if (score >= 100) return 'mastered';
  if (score >= 91) return 'challenge_zone';
  if (score >= 71) return 'mid';
  return 'practicing';
}

function gainForBand(band: Band): number {
  switch (band) {
    case 'practicing':      return 8;
    case 'mid':             return 4;
    case 'challenge_zone':  return 2;
    case 'mastered':        return 0;
  }
}

function penaltyForBand(band: Band): number {
  switch (band) {
    case 'practicing':      return 2;
    case 'mid':             return 4;
    case 'challenge_zone':  return 8;
    case 'mastered':        return 0;
  }
}

export interface ApplyArgs {
  currentScore: number;
  consecutiveCorrect: number;
  correct: boolean;
  difficulty?: Difficulty;
}

export interface ApplyResult {
  newScore: number;
  newBand: Band;
  newConsecutiveCorrect: number;
  delta: number;
  unlockedMastery: boolean;
}

export function applyAttempt(args: ApplyArgs): ApplyResult {
  const cur = Math.max(0, Math.min(100, args.currentScore));
  const band = bandFor(cur);
  const mult = DIFFICULTY_MULT[args.difficulty || 'medium'];

  if (band === 'mastered') {
    // Already locked. Don't touch the score; just track consecutiveCorrect.
    return {
      newScore: 100,
      newBand: 'mastered',
      newConsecutiveCorrect: args.correct ? args.consecutiveCorrect + 1 : 0,
      delta: 0,
      unlockedMastery: false,
    };
  }

  let delta: number;
  let nextStreak = args.consecutiveCorrect;
  if (args.correct) {
    delta = Math.round(gainForBand(band) * mult);
    nextStreak += 1;
    // Challenge-zone bonus: 3-in-a-row hard correct unlocks mastery.
    if (band === 'challenge_zone' && args.difficulty === 'hard' && nextStreak >= 3) {
      return {
        newScore: 100,
        newBand: 'mastered',
        newConsecutiveCorrect: nextStreak,
        delta: 100 - cur,
        unlockedMastery: true,
      };
    }
  } else {
    delta = -Math.round(penaltyForBand(band) * mult);
    nextStreak = 0;
  }

  const newScore = Math.max(0, Math.min(100, cur + delta));
  return {
    newScore,
    newBand: bandFor(newScore),
    newConsecutiveCorrect: nextStreak,
    delta,
    unlockedMastery: false,
  };
}

export function bandLabel(b: Band): string {
  switch (b) {
    case 'practicing':      return 'Practicing';
    case 'mid':             return 'Building rigour';
    case 'challenge_zone':  return 'Challenge zone';
    case 'mastered':        return 'Mastered';
  }
}

export function bandColor(b: Band): string {
  switch (b) {
    case 'practicing':      return 'bg-blue-500';
    case 'mid':             return 'bg-amber-500';
    case 'challenge_zone':  return 'bg-rose-500';
    case 'mastered':        return 'bg-emerald-500';
  }
}
