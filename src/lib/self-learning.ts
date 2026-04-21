/**
 * Self-Learning Layer — the system gets smarter as students use it.
 *
 * The idea: every adaptive decision we make (pick method X, inject intervention Y,
 * set difficulty Z) is recorded as an ExperienceRecord. When the outcome resolves
 * (student answered right, mood improved, retention held 7 days later), we log
 * it back. A background aggregator turns experiences into LearnedPriors — which
 * are then read by the adaptation engines next time.
 *
 * Privacy: user-level experiences stay keyed to user_id. Global priors are
 * derived ONLY from aggregate counts; no PII, no individual content.
 *
 * Decision points that log experience:
 *   - Intervention picked  → did the student's accuracy improve in the next N attempts?
 *   - Method calibrated    → did engagement + retention rise?
 *   - Difficulty chosen    → did the student land near the 70% flow target?
 *   - Companion tone used  → did rapport strengthen?
 *   - Prompt modality      → did comprehension or confidence rise?
 *
 * The system becomes more personalized AND more globally-wise over time.
 */

export type ExperienceKind =
  | 'intervention'
  | 'method_choice'
  | 'difficulty_choice'
  | 'companion_tone'
  | 'modality'
  | 'reminder_timing'
  | 'assignment_shape'
  | 'adaptation_decision';

export interface ExperienceRecord {
  userId: string;
  kind: ExperienceKind;
  // Hash of the relevant context (maturity band, subject class, mood bucket).
  // Keep it coarse so aggregates have enough samples.
  contextKey: string;
  // The action/parameter we picked (method name, intervention id, difficulty level…).
  actionKey: string;
  // Numeric reward signal — higher = better.
  // Initially 0 (pending). Updated asynchronously when outcome resolves.
  reward: number;
  resolved: boolean;
  // Optional payload for later analysis (not used for matching)
  metadata?: Record<string, any>;
  issuedAt: string;
  resolvedAt?: string;
}

/**
 * Build a coarse, stable context key from student + situation.
 */
export function contextKeyFor(params: {
  subjectName?: string;
  maturityBand?: number;
  moodBucket?: 'positive' | 'neutral' | 'strained';
  classBand?: 'primary' | 'middle' | 'senior';  // 1-5, 6-8, 9-12
}): string {
  const subj = (params.subjectName || 'any').toLowerCase().replace(/[^a-z]/g, '').slice(0, 12);
  const band = params.maturityBand != null ? `b${params.maturityBand}` : 'b?';
  const mood = params.moodBucket || 'neutral';
  const cls = params.classBand || 'any';
  return `${subj}|${cls}|${band}|${mood}`;
}

export function classBandFromClassLevel(c: number): 'primary' | 'middle' | 'senior' {
  if (c <= 5) return 'primary';
  if (c <= 8) return 'middle';
  return 'senior';
}

export function moodBucketFromState(frustration: number, confidence: number): 'positive' | 'neutral' | 'strained' {
  if (frustration >= 6 || confidence <= 3) return 'strained';
  if (frustration <= 2 && confidence >= 7) return 'positive';
  return 'neutral';
}

// ============================================================
// Log a new experience (fire-and-forget at decision time)
// ============================================================

export async function logExperience(
  supabase: any,
  rec: Omit<ExperienceRecord, 'resolved' | 'issuedAt'>,
  options: { resolvedNow?: boolean } = {},
): Promise<string | null> {
  try {
    const now = new Date().toISOString();
    const resolved = options.resolvedNow ?? false;
    const row: any = {
      user_id: rec.userId,
      kind: rec.kind,
      context_key: rec.contextKey,
      action_key: rec.actionKey,
      reward: rec.reward ?? 0,
      resolved,
      metadata: rec.metadata || {},
      issued_at: now,
      ...(resolved ? { resolved_at: now } : {}),
    };
    const { data } = await supabase.from('experiences').insert(row).select('id').maybeSingle();
    return data?.id || null;
  } catch {
    return null;
  }
}

// ============================================================
// Resolve an outcome (update reward when we learn if it worked)
// ============================================================

export async function resolveExperience(
  supabase: any,
  experienceId: string,
  reward: number,
  metadata?: Record<string, any>,
): Promise<void> {
  try {
    await supabase.from('experiences').update({
      reward,
      resolved: true,
      resolved_at: new Date().toISOString(),
      ...(metadata ? { metadata } : {}),
    }).eq('id', experienceId);
  } catch {}
}

// ============================================================
// Look up the current learned prior for a (context, action) tuple
// ============================================================

export interface LearnedPrior {
  contextKey: string;
  actionKey: string;
  meanReward: number;           // 0..1 success rate (mapped from reward)
  sampleSize: number;
  confidence: number;           // 0..1
  updatedAt: string;
}

export async function getLearnedPrior(
  supabase: any,
  contextKey: string,
  actionKey: string,
): Promise<LearnedPrior | null> {
  try {
    const { data } = await supabase
      .from('learned_priors')
      .select('*')
      .eq('context_key', contextKey)
      .eq('action_key', actionKey)
      .maybeSingle();
    if (!data) return null;
    return {
      contextKey: data.context_key,
      actionKey: data.action_key,
      meanReward: data.mean_reward,
      sampleSize: data.sample_size,
      confidence: data.confidence,
      updatedAt: data.updated_at,
    };
  } catch {
    return null;
  }
}

/**
 * Look up top actions for a context, sorted by mean reward (desc).
 * Good for "given this student profile, what has worked across ALL students?"
 */
export async function topActionsForContext(
  supabase: any,
  contextKey: string,
  limit = 5,
): Promise<LearnedPrior[]> {
  try {
    const { data } = await supabase
      .from('learned_priors')
      .select('*')
      .eq('context_key', contextKey)
      .gte('sample_size', 3)       // require some evidence
      .order('mean_reward', { ascending: false })
      .limit(limit);
    return (data || []).map((d: any) => ({
      contextKey: d.context_key,
      actionKey: d.action_key,
      meanReward: d.mean_reward,
      sampleSize: d.sample_size,
      confidence: d.confidence,
      updatedAt: d.updated_at,
    }));
  } catch {
    return [];
  }
}

// ============================================================
// Aggregate resolved experiences into learned priors (run periodically)
// ============================================================

/**
 * Incremental aggregator. Reads recently-resolved experiences and updates
 * priors using exponential-moving-average so recent data weighs more.
 *
 * Can be called from a cron/edge function, or on-demand from an admin endpoint.
 */
export async function aggregateIntoPriors(
  supabase: any,
  options: { since?: string; decay?: number } = {},
): Promise<{ processed: number; priorsUpdated: number }> {
  const since = options.since || new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const decay = options.decay ?? 0.1;  // EMA weight for new batch

  try {
    const { data: experiences } = await supabase
      .from('experiences')
      .select('kind, context_key, action_key, reward, resolved_at')
      .eq('resolved', true)
      .gte('resolved_at', since)
      .limit(10000);

    if (!experiences || experiences.length === 0) return { processed: 0, priorsUpdated: 0 };

    // Group by (context, action)
    const groups: Record<string, { rewards: number[] }> = {};
    for (const e of experiences) {
      const key = `${e.context_key}::${e.action_key}`;
      if (!groups[key]) groups[key] = { rewards: [] };
      groups[key].rewards.push(Number(e.reward));
    }

    let priorsUpdated = 0;
    for (const [key, g] of Object.entries(groups)) {
      const [contextKey, actionKey] = key.split('::');
      const batchMean = g.rewards.reduce((s, x) => s + x, 0) / g.rewards.length;
      const batchSize = g.rewards.length;

      // Fetch existing prior
      const { data: existing } = await supabase
        .from('learned_priors')
        .select('mean_reward, sample_size')
        .eq('context_key', contextKey)
        .eq('action_key', actionKey)
        .maybeSingle();

      let meanReward: number;
      let sampleSize: number;
      if (existing) {
        meanReward = (1 - decay) * existing.mean_reward + decay * batchMean;
        sampleSize = existing.sample_size + batchSize;
      } else {
        meanReward = batchMean;
        sampleSize = batchSize;
      }
      // Confidence grows with sample size, saturating around 30
      const confidence = 1 - Math.exp(-sampleSize / 15);

      await supabase.from('learned_priors').upsert({
        context_key: contextKey,
        action_key: actionKey,
        mean_reward: meanReward,
        sample_size: sampleSize,
        confidence,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'context_key,action_key' });

      priorsUpdated++;
    }

    return { processed: experiences.length, priorsUpdated };
  } catch (err) {
    console.error('Prior aggregation failed:', err);
    return { processed: 0, priorsUpdated: 0 };
  }
}

// ============================================================
// Blend a learned prior into a per-student calibration score
// ============================================================

/**
 * If we have per-student calibration (Thompson bandit on student's own data)
 * and a global learned prior (aggregate across students), blend them so
 * early in the journey the global prior dominates, and later the student's
 * own data dominates.
 *
 * Returns a 0..1 score.
 */
export function blendWithPrior(params: {
  studentOwnScore?: number;      // 0..1 from student's own calibration
  studentOwnSamples?: number;    // how many personal attempts
  prior?: LearnedPrior | null;
}): number {
  const ownScore = params.studentOwnScore ?? 0;
  const ownSamples = params.studentOwnSamples ?? 0;
  const priorScore = params.prior?.meanReward ?? 0.5;
  const priorConf = params.prior?.confidence ?? 0;

  // Weight on student's own data grows with their sample size (saturates ~15)
  const ownWeight = 1 - Math.exp(-ownSamples / 8);
  const priorWeight = priorConf * (1 - ownWeight);
  const totalWeight = ownWeight + priorWeight;
  if (totalWeight < 0.01) return 0.5;
  return (ownScore * ownWeight + priorScore * priorWeight) / totalWeight;
}
