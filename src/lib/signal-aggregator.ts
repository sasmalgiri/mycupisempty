/**
 * Signal aggregator — derives learner preferences from raw learner_signals rows.
 *
 * Purpose: close the loop between "we collect signals" and "the app uses them."
 * Previously, difficulty_feel / concept_mode_entered / learning_mode_set signals
 * landed in the DB but nothing read them directly; the behavioral_observations
 * JSONB column the pill checks was never populated, and the daily-mix challenge
 * picker didn't listen to the Harder/Easier thumb. This module makes both
 * explicit.
 *
 * Design:
 *   - Pure derivation functions over a supabase client + userId + optional
 *     subjectId. Read-only; safe to call from any route.
 *   - Small, deterministic thresholds so the outputs are predictable and
 *     testable (not magic numbers buried in route handlers).
 *   - The caller decides whether to persist results. Most routes will just
 *     read-on-demand, which matches the rest of the codebase's pattern.
 */

export type ExplanationMode =
  | 'visual' | 'story' | 'step_by_step' | 'example_first' | 'socratic' | 'drill' | 'hands_on';

const VALID_MODES: ExplanationMode[] = [
  'visual', 'story', 'step_by_step', 'example_first', 'socratic', 'drill', 'hands_on',
];

// Time windows — kept generous enough to be stable but recent enough to follow
// the student if their habits change.
const MODE_WINDOW_DAYS = 14;
const DIFFICULTY_WINDOW_DAYS = 7;

const MIN_MODE_SAMPLES = 3;        // below this, no "observed" claim
const MIN_DIFFICULTY_SAMPLES = 3;  // below this, don't bias difficulty

// Thresholds on the [0,1] difficulty_feel scale (high = harder, canonical — see
// signal-types.ts). If the student has been saying "too hard" on average we
// bias easier; if "too easy" we bias harder.
const DIFF_THRESHOLD_EASIER = 0.65;
const DIFF_THRESHOLD_HARDER = 0.35;

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
}

export interface ObservedMode {
  mode: ExplanationMode;
  confidence: number;  // share of total signals
  samples: number;
}

/**
 * Derive the student's observed preferred explanation mode for a subject (or
 * globally if subjectId is omitted). Counts concept_mode_entered signals plus
 * learning_mode_set overrides in the last ~2 weeks; the most-picked mode wins.
 * Returns null if there isn't enough data to claim anything.
 */
export async function getObservedMode(
  supabase: any,
  userId: string,
  subjectId?: string | null,
): Promise<ObservedMode | null> {
  let q = supabase
    .from('learner_signals')
    .select('signal_type, metadata, created_at')
    .eq('user_id', userId)
    .in('signal_type', ['concept_mode_entered', 'learning_mode_set'])
    .gte('created_at', daysAgo(MODE_WINDOW_DAYS));

  if (subjectId) {
    q = q.eq('subject_id', subjectId);
  }

  const { data } = await q;
  const rows = (data || []) as Array<{ signal_type: string; metadata: any }>;
  if (rows.length < MIN_MODE_SAMPLES) return null;

  // Manual overrides (learning_mode_set) count double — an explicit choice is
  // stronger evidence than a one-off click-through.
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const mode = row.metadata?.mode;
    if (!mode || !VALID_MODES.includes(mode)) continue;
    const weight = row.signal_type === 'learning_mode_set' ? 2 : 1;
    counts[mode] = (counts[mode] || 0) + weight;
  }

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;

  const [topMode, topWeight] = entries[0];
  const totalWeight = Object.values(counts).reduce((s, n) => s + n, 0);
  const confidence = totalWeight > 0 ? topWeight / totalWeight : 0;

  return {
    mode: topMode as ExplanationMode,
    confidence,
    samples: rows.length,
  };
}

export interface DifficultyBias {
  /** Mean of difficulty_feel values on [0,1]; 0.5 is "just right". */
  avg: number;
  samples: number;
  /** 'easier' = student says too hard lately; 'harder' = too easy; 'same' = within band or insufficient data. */
  direction: 'easier' | 'same' | 'harder';
}

/**
 * Read recent difficulty_feel signals and decide whether tomorrow's challenge
 * should skew easier, harder, or stay put. Pass subjectId to scope to one
 * subject; omit for a cross-subject bias.
 */
export async function getDifficultyBias(
  supabase: any,
  userId: string,
  subjectId?: string | null,
): Promise<DifficultyBias> {
  let q = supabase
    .from('learner_signals')
    .select('value, created_at')
    .eq('user_id', userId)
    .eq('signal_type', 'difficulty_feel')
    .gte('created_at', daysAgo(DIFFICULTY_WINDOW_DAYS))
    .order('created_at', { ascending: false })
    .limit(20);

  if (subjectId) {
    q = q.eq('subject_id', subjectId);
  }

  const { data } = await q;
  const rows = (data || []) as Array<{ value: number | null }>;

  if (rows.length < MIN_DIFFICULTY_SAMPLES) {
    return { avg: 0.5, samples: rows.length, direction: 'same' };
  }

  const vals = rows.map((r) => (typeof r.value === 'number' ? r.value : 0.5));
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length;

  const direction: DifficultyBias['direction'] =
    avg > DIFF_THRESHOLD_EASIER ? 'easier'
      : avg < DIFF_THRESHOLD_HARDER ? 'harder'
      : 'same';

  return { avg, samples: rows.length, direction };
}
