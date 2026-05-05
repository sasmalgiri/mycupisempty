/**
 * Arena signals — interpretation layer between raw minigame plays and the
 * 5-layer learner profile.
 *
 * Why a separate file: the games write JSONB into minigame_results.signals.
 * Schema doesn't change when we tune the model. This module turns those raw
 * signals into a behavioural profile vector that everything downstream
 * (companion mode picking, daily-mix difficulty, exit-eval expectations)
 * can read without re-deriving.
 *
 * Cardinal rule (whole reason this exists): never ask the student "are you
 * a visual learner?". Infer from how they play.
 */

export type MinigameId =
  | 'pattern_trace'
  | 'word_sprint'
  | 'number_snap'
  | 'memory_match'
  | 'story_choice';

export type TriggerKind =
  | 'first_session'
  | 'session_start'
  | 'weekly'
  | 'recalibration'
  | 'manual';

// ----------------------------------------------------------------------------
// Per-game raw signal shapes. Each game's UI writes ONE of these into
// minigame_results.signals when it ends. Keep them flat so JSONB queries are
// cheap.
// ----------------------------------------------------------------------------

export interface PatternTraceSignals {
  trialsCompleted: number;
  trialsCorrect: number;
  reactionTimesMs: number[];      // one entry per trial
  highestLevel: number;            // grid size / pattern length reached
  hesitationsBeforeFirstMove: number; // long pause = "thinking carefully"
}

export interface WordSprintSignals {
  trialsCompleted: number;
  trialsCorrect: number;
  reactionTimesMs: number[];
  wordsRecognizedPerMinute: number; // primary fluency metric
  difficultyReached: number;        // word-list difficulty band
  rereadsDetected: number;          // visible second-pass via long fixation proxy
}

export interface NumberSnapSignals {
  trialsCompleted: number;
  trialsCorrect: number;
  reactionTimesMs: number[];
  highestSpeedTier: number;         // 1..6 — game speeds up
  errorsByOperation: Record<'add' | 'sub' | 'mul' | 'div', number>;
  carriesAttempted: number;         // 17+8 etc. needs carry — wm load proxy
  carriesCorrect: number;
}

export interface MemoryMatchSignals {
  trialsCompleted: number;
  trialsCorrect: number;
  setSizesReached: number[];        // n=4..n=10 etc.
  interferenceErrors: number;       // confused with a previously-seen pair
  meanRevealsToFind: number;        // efficiency proxy
  longestRunWithoutMistake: number;
}

export interface StoryChoiceSignals {
  pathsExplored: number;
  decisionLatenciesMs: number[];
  riskySelections: number;          // chose the brave/uncertain branch
  empatheticSelections: number;     // chose the help-others branch
  analyticalSelections: number;     // chose the gather-info branch
  rereadCount: number;              // backed up to re-read text
  finishedStory: boolean;
}

// ----------------------------------------------------------------------------
// Composite profile produced by aggregating recent results across games.
// This is the artifact the rest of the app reads. Stored in
// learner_profiles.behavioral_observations.minigame_profile so it persists
// without re-aggregation.
// ----------------------------------------------------------------------------

export interface ArenaProfile {
  // Each axis is normalized 0..1. Higher = more of that capacity.
  visualProcessingSpeed: number;
  readingFluency: number;
  numericalFluency: number;
  workingMemoryCapacity: number;
  inferenceStrength: number;
  decisionTempo: number;            // 0=deliberate ... 1=fast/impulsive
  riskTolerance: number;            // 0=cautious ... 1=bold
  empathyLeaning: number;           // 0..1 from story choices
  // Calibration metadata
  samplesUsed: number;              // how many minigame_results rows backed this
  staleness: 'fresh' | 'aging' | 'stale'; // <2w fresh, 2-6w aging, >6w stale
  lastComputedAt: string;
}

const EMPTY_PROFILE: ArenaProfile = {
  visualProcessingSpeed: 0.5,
  readingFluency: 0.5,
  numericalFluency: 0.5,
  workingMemoryCapacity: 0.5,
  inferenceStrength: 0.5,
  decisionTempo: 0.5,
  riskTolerance: 0.5,
  empathyLeaning: 0.5,
  samplesUsed: 0,
  staleness: 'stale',
  lastComputedAt: new Date(0).toISOString(),
};

// ----------------------------------------------------------------------------
// Per-game scoring → 0..1 axis values. Tunable; thresholds based on common
// K-12 reaction-time and accuracy distributions, not arbitrary.
// ----------------------------------------------------------------------------

function clamp01(n: number): number {
  if (!isFinite(n) || isNaN(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function median(arr: number[]): number {
  if (!arr.length) return NaN;
  const sorted = [...arr].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

/**
 * Map median reaction time on a recognition task to a 0..1 speed axis.
 * Empirical anchor for K-12: 600ms = very fast, 2400ms = slow.
 */
function rtToSpeedAxis(rtMs: number): number {
  if (!isFinite(rtMs)) return 0.5;
  if (rtMs <= 600) return 1;
  if (rtMs >= 2400) return 0;
  return 1 - (rtMs - 600) / 1800;
}

/**
 * Score Pattern Trace into visualProcessingSpeed + decisionTempo signals.
 */
export function scorePatternTrace(s: PatternTraceSignals): {
  visualProcessingSpeed: number;
  decisionTempo: number;
} {
  const accuracy = s.trialsCompleted > 0 ? s.trialsCorrect / s.trialsCompleted : 0;
  const rt = median(s.reactionTimesMs);
  const speed = rtToSpeedAxis(rt);
  // Visual processing combines accuracy and speed. Weighted toward accuracy
  // because a fast wrong answer is not visual processing skill.
  const visualProcessingSpeed = clamp01(0.6 * accuracy + 0.4 * speed);
  // Tempo: hesitations make decisions look slower / more deliberate.
  const tempo = clamp01(speed - Math.min(0.3, s.hesitationsBeforeFirstMove * 0.05));
  return { visualProcessingSpeed, decisionTempo: tempo };
}

export function scoreWordSprint(s: WordSprintSignals): {
  readingFluency: number;
  decisionTempo: number;
} {
  const accuracy = s.trialsCompleted > 0 ? s.trialsCorrect / s.trialsCompleted : 0;
  // wpm ranges in K-12: 60 wpm ~= class 4, 200 wpm ~= class 12.
  const wpmAxis = clamp01((s.wordsRecognizedPerMinute - 60) / 140);
  const rt = median(s.reactionTimesMs);
  const speed = rtToSpeedAxis(rt);
  const readingFluency = clamp01(0.5 * accuracy + 0.3 * wpmAxis + 0.2 * speed);
  return { readingFluency, decisionTempo: speed };
}

export function scoreNumberSnap(s: NumberSnapSignals): {
  numericalFluency: number;
  workingMemoryCapacity: number;
} {
  const accuracy = s.trialsCompleted > 0 ? s.trialsCorrect / s.trialsCompleted : 0;
  const speedTierAxis = clamp01((s.highestSpeedTier - 1) / 5);
  const rt = median(s.reactionTimesMs);
  const speed = rtToSpeedAxis(rt);
  const numericalFluency = clamp01(0.5 * accuracy + 0.3 * speedTierAxis + 0.2 * speed);
  // Carry attempts probe working memory under arithmetic load.
  const carryAccuracy = s.carriesAttempted > 0 ? s.carriesCorrect / s.carriesAttempted : 0.5;
  const workingMemoryCapacity = clamp01(0.7 * carryAccuracy + 0.3 * accuracy);
  return { numericalFluency, workingMemoryCapacity };
}

export function scoreMemoryMatch(s: MemoryMatchSignals): {
  workingMemoryCapacity: number;
} {
  const maxSet = Math.max(0, ...s.setSizesReached);
  // Class-band-agnostic: n=4 trivial, n=10 hard, n=14 elite.
  const setAxis = clamp01((maxSet - 4) / 10);
  const interferencePenalty = clamp01(s.interferenceErrors / Math.max(1, s.trialsCompleted));
  const efficiencyAxis = s.meanRevealsToFind > 0
    ? clamp01(1 - (s.meanRevealsToFind - 2) / 6)  // 2 reveals = perfect; 8 = poor
    : 0.5;
  const workingMemoryCapacity = clamp01(0.5 * setAxis + 0.3 * efficiencyAxis - 0.2 * interferencePenalty + 0.2);
  return { workingMemoryCapacity };
}

export function scoreStoryChoice(s: StoryChoiceSignals): {
  inferenceStrength: number;
  riskTolerance: number;
  empathyLeaning: number;
  decisionTempo: number;
} {
  const totalDecisions = s.riskySelections + s.empatheticSelections + s.analyticalSelections;
  const finishedBonus = s.finishedStory ? 0.15 : 0;
  // Inference proxy: high analytical + low rereads (caught it first time).
  const analyticalShare = totalDecisions > 0 ? s.analyticalSelections / totalDecisions : 0.5;
  const rereadPenalty = clamp01(s.rereadCount / 8);
  const inferenceStrength = clamp01(0.6 * analyticalShare + finishedBonus + 0.4 * (1 - rereadPenalty));
  const riskTolerance = totalDecisions > 0 ? clamp01(s.riskySelections / totalDecisions) : 0.5;
  const empathyLeaning = totalDecisions > 0 ? clamp01(s.empatheticSelections / totalDecisions) : 0.5;
  const decisionTempo = rtToSpeedAxis(median(s.decisionLatenciesMs));
  return { inferenceStrength, riskTolerance, empathyLeaning, decisionTempo };
}

// ----------------------------------------------------------------------------
// Cross-game aggregation. Newer plays count more (exponential decay), and
// each axis only updates when at least one of its source games has fresh data.
// ----------------------------------------------------------------------------

interface MinigameRow {
  game: MinigameId;
  signals: any;
  played_at: string;
}

const HALF_LIFE_DAYS = 30;
const FRESH_DAYS = 14;
const STALE_DAYS = 42;

function ageWeight(playedAt: string, now: number = Date.now()): number {
  const ageDays = (now - new Date(playedAt).getTime()) / 86400000;
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

/**
 * Aggregate a list of recent minigame_results rows into an ArenaProfile.
 * Pass the rows already filtered to a single user (RLS does that for you).
 */
export function aggregateProfile(rows: MinigameRow[], now: number = Date.now()): ArenaProfile {
  if (rows.length === 0) return EMPTY_PROFILE;

  // Per-axis weighted accumulator: { sumWeighted, sumWeights }
  const acc: Record<keyof Omit<ArenaProfile, 'samplesUsed' | 'staleness' | 'lastComputedAt'>, [number, number]> = {
    visualProcessingSpeed: [0, 0],
    readingFluency: [0, 0],
    numericalFluency: [0, 0],
    workingMemoryCapacity: [0, 0],
    inferenceStrength: [0, 0],
    decisionTempo: [0, 0],
    riskTolerance: [0, 0],
    empathyLeaning: [0, 0],
  };

  function add(axis: keyof typeof acc, value: number, w: number) {
    if (!isFinite(value)) return;
    acc[axis][0] += value * w;
    acc[axis][1] += w;
  }

  let mostRecentMs = 0;

  for (const row of rows) {
    const w = ageWeight(row.played_at, now);
    if (w < 0.05) continue;  // ignore very stale rows
    mostRecentMs = Math.max(mostRecentMs, new Date(row.played_at).getTime());

    switch (row.game) {
      case 'pattern_trace': {
        const s = scorePatternTrace(row.signals as PatternTraceSignals);
        add('visualProcessingSpeed', s.visualProcessingSpeed, w);
        add('decisionTempo', s.decisionTempo, w * 0.5);  // shared axis, half weight
        break;
      }
      case 'word_sprint': {
        const s = scoreWordSprint(row.signals as WordSprintSignals);
        add('readingFluency', s.readingFluency, w);
        add('decisionTempo', s.decisionTempo, w * 0.5);
        break;
      }
      case 'number_snap': {
        const s = scoreNumberSnap(row.signals as NumberSnapSignals);
        add('numericalFluency', s.numericalFluency, w);
        add('workingMemoryCapacity', s.workingMemoryCapacity, w * 0.5);
        break;
      }
      case 'memory_match': {
        const s = scoreMemoryMatch(row.signals as MemoryMatchSignals);
        add('workingMemoryCapacity', s.workingMemoryCapacity, w);
        break;
      }
      case 'story_choice': {
        const s = scoreStoryChoice(row.signals as StoryChoiceSignals);
        add('inferenceStrength', s.inferenceStrength, w);
        add('riskTolerance', s.riskTolerance, w);
        add('empathyLeaning', s.empathyLeaning, w);
        add('decisionTempo', s.decisionTempo, w * 0.3);
        break;
      }
    }
  }

  const out: any = {};
  for (const axis of Object.keys(acc) as Array<keyof typeof acc>) {
    const [sum, weight] = acc[axis];
    out[axis] = weight > 0 ? clamp01(sum / weight) : 0.5;
  }

  const ageDays = (now - mostRecentMs) / 86400000;
  const staleness: ArenaProfile['staleness'] =
    ageDays < FRESH_DAYS ? 'fresh' : ageDays < STALE_DAYS ? 'aging' : 'stale';

  return {
    ...(out as Omit<ArenaProfile, 'samplesUsed' | 'staleness' | 'lastComputedAt'>),
    samplesUsed: rows.length,
    staleness,
    lastComputedAt: new Date(now).toISOString(),
  };
}

// ----------------------------------------------------------------------------
// Trigger logic: when should we surface an Arena game?
// ----------------------------------------------------------------------------

export interface TriggerDecision {
  shouldTrigger: boolean;
  reason: string;
  recommendedGame?: MinigameId;
  trigger: TriggerKind;
}

/**
 * Decide whether to show an Arena minigame at the start of the next session.
 * Inputs are kept loose — pass what you have, the function defaults the rest.
 */
export function decideTrigger(state: {
  hasEverPlayed: boolean;
  totalSessionsAllTime: number;
  daysSinceLastPlay: number | null;
  daysSinceLastSession: number | null;
}): TriggerDecision {
  if (!state.hasEverPlayed && state.totalSessionsAllTime <= 1) {
    return {
      shouldTrigger: true,
      reason: 'first session — establish baseline profile',
      trigger: 'first_session',
    };
  }

  if (state.daysSinceLastSession !== null && state.daysSinceLastSession >= 3) {
    return {
      shouldTrigger: true,
      reason: 'returned after 3+ day gap — recalibrate',
      trigger: 'recalibration',
    };
  }

  if (state.daysSinceLastPlay === null || state.daysSinceLastPlay >= 7) {
    return {
      shouldTrigger: true,
      reason: 'weekly cadence — drift detection',
      trigger: 'weekly',
    };
  }

  return {
    shouldTrigger: false,
    reason: 'within weekly cadence',
    trigger: 'session_start',
  };
}

/**
 * Pick the next minigame to surface, biased toward whichever axis is least
 * recently sampled. Pass last-played-at per game; missing games are picked first.
 */
export function pickNextGame(lastPlayedByGame: Partial<Record<MinigameId, string>>): MinigameId {
  const all: MinigameId[] = ['pattern_trace', 'word_sprint', 'number_snap', 'memory_match', 'story_choice'];
  let oldest: MinigameId = all[0];
  let oldestMs = Infinity;
  for (const g of all) {
    const t = lastPlayedByGame[g];
    if (!t) return g;  // never played → always pick first
    const ms = new Date(t).getTime();
    if (ms < oldestMs) {
      oldestMs = ms;
      oldest = g;
    }
  }
  return oldest;
}

export const ARENA_GAMES: MinigameId[] = [
  'pattern_trace', 'word_sprint', 'number_snap', 'memory_match', 'story_choice',
];

export const GAME_META: Record<MinigameId, { label: string; icon: string; durationSec: number; description: string }> = {
  pattern_trace: { label: 'Pattern Trace',   icon: '🧩', durationSec: 45, description: 'Spot and complete the pattern.' },
  word_sprint:   { label: 'Word Sprint',     icon: '📚', durationSec: 60, description: 'Match words to meanings, fast.' },
  number_snap:   { label: 'Number Snap',     icon: '⚡', durationSec: 60, description: 'Quick mental math under time pressure.' },
  memory_match:  { label: 'Memory Match',    icon: '🧠', durationSec: 75, description: 'Pair up cards before they hide.' },
  story_choice:  { label: 'Story Choice',    icon: '📖', durationSec: 90, description: 'A short story — your choices steer it.' },
};
