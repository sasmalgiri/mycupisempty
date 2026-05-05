/**
 * Persona-reveal games — distinct from Arena cognitive minigames.
 *
 * Arena measures CAPACITY (visual processing, WM, reading fluency, etc.).
 * Persona games measure DISPOSITION + CONSTRAINT — perfectionism, effort
 * tolerance, curiosity vs comfort, social orientation, daily-routine reality.
 *
 * Critical principle (this is why we don't use a survey):
 *   What students SAY about themselves and what they DO are different.
 *   Self-report inflates conscientiousness and downplays struggle.
 *   These games extract dispositional signal as a side-effect of play, so
 *   the persona we build matches who the student really is, not who they
 *   want to look like.
 *
 * Six games, each ~30-90 seconds:
 *
 *   island_choice      — disposition: which kind of place pulls you?
 *                        signals: risk_tolerance, curiosity_breadth,
 *                                 social_orientation
 *
 *   effort_curve       — given a hard puzzle, do you push, look up the
 *                        answer, or skip? — signals: effort_tolerance,
 *                                                    perfectionism
 *
 *   curiosity_room     — drop into a room with multiple click targets;
 *                        which do you explore first, how broadly?
 *                        signals: curiosity_breadth, attention_diffusion
 *
 *   tortoise_or_hare   — race scenario with speed/steady tradeoff
 *                        signals: pace_preference, decision_tempo
 *
 *   helping_hands      — branching micro-scenario: classmate needs help
 *                        when you're behind on your own work
 *                        signals: social_orientation, conscientiousness
 *
 *   study_time_quest   — fixed 100% energy budget split across
 *                        different times of day with constraints
 *                        signals: best_study_time, energy_after_school,
 *                                 daily_study_minutes_available
 *                        — this one IS a constraint-elicitation game,
 *                          but framed as a quest so it's revealing rather
 *                          than self-flattering. The numbers fall out of
 *                          the choices, not from typing them in.
 */

export type PersonaGameId =
  | 'island_choice'
  | 'effort_curve'
  | 'curiosity_room'
  | 'tortoise_or_hare'
  | 'helping_hands'
  | 'study_time_quest';

export const PERSONA_GAMES: PersonaGameId[] = [
  'island_choice',
  'effort_curve',
  'curiosity_room',
  'tortoise_or_hare',
  'helping_hands',
  'study_time_quest',
];

export const PERSONA_GAME_META: Record<PersonaGameId, { label: string; icon: string; durationSec: number; description: string }> = {
  island_choice:    { label: 'Island Hop',        icon: '🏝',  durationSec: 60, description: 'Pick the islands that pull you in.' },
  effort_curve:     { label: 'Stuck Puzzle',      icon: '🧩',  durationSec: 90, description: 'A hard one — do you push or skip?' },
  curiosity_room:   { label: 'The Curious Room',  icon: '🔍',  durationSec: 75, description: "What catches your eye when there's no goal?" },
  tortoise_or_hare: { label: 'Tortoise or Hare',  icon: '🐢',  durationSec: 60, description: 'Speed, steady — your call.' },
  helping_hands:    { label: 'Helping Hands',     icon: '🤝',  durationSec: 90, description: 'Friend in need when you are behind too.' },
  study_time_quest: { label: 'Energy Quest',      icon: '⚡',  durationSec: 75, description: 'Spend your day-energy across moments.' },
};

// ----------------------------------------------------------------------------
// Per-game raw signals
// ----------------------------------------------------------------------------

export interface IslandChoiceSignals {
  islandsPicked: string[];                    // ['volcano', 'library', 'reef', 'market']
  pickOrderMs: number[];                       // time between picks
  rejectedFirst: string[];                     // explicitly de-selected
}

export interface EffortCurveSignals {
  attemptedSeconds: number;                    // time spent BEFORE escape route
  hintTaken: boolean;
  showAnswer: boolean;                         // bailed
  retried: boolean;
  finalCorrect: boolean;
  rapidRetries: number;                        // < 1s between attempts (frustration)
}

export interface CuriosityRoomSignals {
  itemsClicked: string[];                      // ordered list
  uniqueAreas: number;                         // 1..N
  meanLingerMs: number;
  finishedExploring: boolean;
}

export interface TortoiseOrHareSignals {
  trackPicked: 'fast' | 'steady' | 'mixed';
  // % of moves that were 'rush' vs 'walk' on the chosen track
  rushFraction: number;
  finishedRace: boolean;
  tripCount: number;                           // mistakes when rushing
}

export interface HelpingHandsSignals {
  helpedClassmate: boolean;                     // first decision
  finishedOwnWork: boolean;
  splitTimeFraction: number;                    // 0..1 share given to helping
  tookSelfishExit: boolean;                     // explicitly chose to ignore
}

export interface StudyTimeQuestSignals {
  energyByTime: Record<'early_morning' | 'after_school' | 'evening' | 'late_night', number>; // sums to ~100
  declaredFreeMinutesPerDay: number;            // derived from cumulative drops
  blockedSlots: string[];                        // 'school', 'tuition', 'family_time'
}

// ----------------------------------------------------------------------------
// Per-game scoring → persona axes (0..1 each)
// ----------------------------------------------------------------------------

function clamp01(n: number): number {
  if (!isFinite(n) || isNaN(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

export interface PersonaAxes {
  perfectionism?: number;
  effort_tolerance?: number;
  curiosity_breadth?: number;
  social_orientation?: number;
  risk_tolerance?: number;
  decision_tempo?: number;
  // Hard constraints (only emitted by study_time_quest)
  daily_study_minutes_available?: number;
  best_study_time?: 'early_morning' | 'after_school' | 'evening' | 'late_night' | 'flexible';
  energy_after_school?: number; // 1..5
}

const ISLAND_RISK_TAGS: Record<string, number> = {
  volcano: 1.0, ruins: 0.85, reef: 0.7, mountain: 0.65,
  forest: 0.5, market: 0.4, beach: 0.3, library: 0.15, garden: 0.1,
};
const ISLAND_SOCIAL_TAGS: Record<string, number> = {
  market: 0.95, beach: 0.7, festival: 1.0,
  forest: 0.4, reef: 0.5, ruins: 0.3, library: 0.2, garden: 0.4, volcano: 0.5, mountain: 0.3,
};
const ISLAND_CURIOSITY_TAGS: Record<string, number> = {
  ruins: 0.95, library: 0.85, reef: 0.7, volcano: 0.7, forest: 0.6,
  mountain: 0.55, festival: 0.6, market: 0.4, garden: 0.3, beach: 0.2,
};

export function scoreIslandChoice(s: IslandChoiceSignals): PersonaAxes {
  const picks = s.islandsPicked || [];
  if (picks.length === 0) return { risk_tolerance: 0.5, social_orientation: 0.5, curiosity_breadth: 0.5 };
  const avg = (tags: Record<string, number>): number => {
    const vals = picks.map((p) => (tags[p] ?? 0.5));
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };
  return {
    risk_tolerance: clamp01(avg(ISLAND_RISK_TAGS)),
    social_orientation: clamp01(avg(ISLAND_SOCIAL_TAGS)),
    curiosity_breadth: clamp01(avg(ISLAND_CURIOSITY_TAGS)),
  };
}

export function scoreEffortCurve(s: EffortCurveSignals): PersonaAxes {
  // Effort tolerance: time spent attempting before escape route, normalized.
  // ≥60s without showAnswer = high tolerance; <15s + showAnswer = low.
  const baseEffort = clamp01(s.attemptedSeconds / 90);
  let effort = baseEffort;
  if (s.showAnswer) effort = Math.min(effort, 0.35);
  if (s.hintTaken && !s.showAnswer) effort = Math.max(0.5, effort);
  if (s.retried && s.finalCorrect) effort = Math.min(1, effort + 0.15);

  // Perfectionism proxy: rapid retries + reluctance to take hints =
  // perfectionist; quick to ask for help = lower perfectionism.
  let perfection = 0.5;
  if (s.rapidRetries >= 3) perfection = 0.8;
  if (s.hintTaken) perfection -= 0.2;
  if (s.showAnswer) perfection -= 0.25;
  perfection = clamp01(perfection);

  return { effort_tolerance: clamp01(effort), perfectionism: perfection };
}

export function scoreCuriosityRoom(s: CuriosityRoomSignals): PersonaAxes {
  const breadth = clamp01(s.uniqueAreas / 6);
  // Decision tempo: short linger = fast; long linger = deliberate.
  const tempo = clamp01(1 - (s.meanLingerMs - 600) / 4000);
  return { curiosity_breadth: breadth, decision_tempo: tempo };
}

export function scoreTortoiseOrHare(s: TortoiseOrHareSignals): PersonaAxes {
  const tempo = s.trackPicked === 'fast'
    ? Math.min(1, 0.7 + s.rushFraction * 0.3)
    : s.trackPicked === 'steady'
      ? Math.max(0.1, 0.3 - s.rushFraction * 0.2)
      : 0.5 + (s.rushFraction - 0.5) * 0.4;
  // Trips while rushing reduce effort_tolerance (gave up on accuracy)
  const effort = clamp01(s.finishedRace ? 0.7 - (s.tripCount * 0.1) : 0.3);
  return { decision_tempo: clamp01(tempo), effort_tolerance: effort };
}

export function scoreHelpingHands(s: HelpingHandsSignals): PersonaAxes {
  let social = 0.5;
  if (s.helpedClassmate) social += 0.2;
  if (s.tookSelfishExit) social -= 0.3;
  social += s.splitTimeFraction * 0.2;
  return { social_orientation: clamp01(social) };
}

export function scoreStudyTimeQuest(s: StudyTimeQuestSignals): PersonaAxes {
  const energies = s.energyByTime || { early_morning: 25, after_school: 25, evening: 25, late_night: 25 };
  const peak = Object.entries(energies).sort((a, b) => b[1] - a[1])[0]?.[0] as PersonaAxes['best_study_time'];
  const energyAfterSchool = energies.after_school || 0;
  const energyBand = energyAfterSchool >= 40 ? 5 : energyAfterSchool >= 30 ? 4 : energyAfterSchool >= 20 ? 3 : energyAfterSchool >= 10 ? 2 : 1;
  return {
    best_study_time: peak || 'flexible',
    daily_study_minutes_available: Math.max(15, Math.min(360, s.declaredFreeMinutesPerDay || 60)),
    energy_after_school: energyBand,
  };
}

// ----------------------------------------------------------------------------
// Aggregator: persona_game_results rows → PersonaAxes
// Caller folds these into the persona_profiles row.
// ----------------------------------------------------------------------------

interface PersonaGameRow {
  game: PersonaGameId;
  signals: any;
  played_at: string;
}

const HALF_LIFE_DAYS = 90;  // dispositions drift slower than capacity

function ageWeight(playedAt: string, now: number): number {
  const ageDays = (now - new Date(playedAt).getTime()) / 86400000;
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

export function aggregatePersonaAxes(rows: PersonaGameRow[], now: number = Date.now()): PersonaAxes {
  if (rows.length === 0) return {};

  const acc: Record<string, [number, number]> = {};
  let lastStudyTimeQuest: StudyTimeQuestSignals | null = null;

  for (const row of rows) {
    const w = ageWeight(row.played_at, now);
    if (w < 0.05) continue;
    let axes: PersonaAxes = {};
    switch (row.game) {
      case 'island_choice':    axes = scoreIslandChoice(row.signals); break;
      case 'effort_curve':     axes = scoreEffortCurve(row.signals); break;
      case 'curiosity_room':   axes = scoreCuriosityRoom(row.signals); break;
      case 'tortoise_or_hare': axes = scoreTortoiseOrHare(row.signals); break;
      case 'helping_hands':    axes = scoreHelpingHands(row.signals); break;
      case 'study_time_quest': lastStudyTimeQuest = row.signals; break;
    }
    for (const [k, v] of Object.entries(axes)) {
      if (typeof v !== 'number') continue;
      acc[k] = acc[k] || [0, 0];
      acc[k][0] += v * w;
      acc[k][1] += w;
    }
  }

  const out: PersonaAxes = {};
  for (const [k, [sum, weight]] of Object.entries(acc)) {
    if (weight > 0) (out as any)[k] = clamp01(sum / weight);
  }

  // Constraints come from the most-recent study_time_quest only — they're
  // not behavioural signals to average, they're stated facts.
  if (lastStudyTimeQuest) {
    const cAxes = scoreStudyTimeQuest(lastStudyTimeQuest);
    if (cAxes.best_study_time) out.best_study_time = cAxes.best_study_time;
    if (cAxes.daily_study_minutes_available) out.daily_study_minutes_available = cAxes.daily_study_minutes_available;
    if (cAxes.energy_after_school) out.energy_after_school = cAxes.energy_after_school;
  }

  return out;
}
