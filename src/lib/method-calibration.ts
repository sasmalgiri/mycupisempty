/**
 * Method Calibration Engine — per-student × per-subject × per-method effectiveness.
 *
 * The founder's rule: don't ASK students what works, OBSERVE what works.
 *
 * Every competitor either:
 *   (a) lets students pick (Khan Academy — "choose your path"),
 *   (b) uses a one-global-style label (VARK), or
 *   (c) picks a method randomly and calls it "personalized."
 *
 * We measure the truth from behavior:
 *   - accuracy on attempts after using this method
 *   - retention at 7 days (did the memory stick?)
 *   - engagement (did they finish the session? how long?)
 *   - confidence gap closure (did their predictions align with reality?)
 *
 * We use a Thompson-sampling bandit to balance "use the winning method"
 * with "occasionally try alternatives so we don't get stuck in a local max."
 */

export type MethodCode =
  | 'feynman' | 'mind_map' | 'cornell_notes' | 'pomodoro' | 'teach_back'
  | 'project_based' | 'pq4r' | 'analogy' | 'gurukul' | 'vedic_math'
  | 'memory_palace' | 'socratic' | 'storytelling' | 'visualization'
  | 'sutra_learning' | 'active_recall' | 'spaced_rep' | 'interleaving'
  | 'elaborative_interrogation' | 'dual_coding' | 'chunking';

export interface MethodOutcome {
  userId: string;
  subjectId: string;
  topicId?: string;
  method: MethodCode;
  // Behavioral measurements — NOT self-reported
  accuracyDelta: number;        // -1..1 (difference from baseline accuracy)
  completed: boolean;           // did they finish the session?
  timeSpentSeconds: number;     // how long they stayed engaged
  engagementScore: number;      // 0..1 — composite from time + interactions
  retentionAt7Days?: number;    // 0..1 — follow-up accuracy, filled later
  confidenceGapAfter?: number;  // signed — 0 = calibrated
  timestamp: string;
}

export interface MethodStats {
  method: MethodCode;
  attempts: number;
  wins: number;                 // attempts with positive outcome
  losses: number;
  avgAccuracyDelta: number;
  avgEngagement: number;
  retentionRate: number;        // 0..1
  completionRate: number;       // 0..1
  effectivenessScore: number;   // 0..1 — composite
  confidence: number;           // 0..1 — how much evidence we have
  lastUsedDaysAgo: number;
}

export interface CalibrationResult {
  subjectId: string;
  subjectName?: string;
  bestMethod: MethodCode;
  bestScore: number;
  runnerUps: MethodStats[];
  recommendedMethod: MethodCode;  // what we'll actually use (may differ from best for exploration)
  exploring: boolean;              // true if the recommended method is exploratory
  evidence: string;                // human-readable explanation
}

// ============================================================
// Default priors — when we have no data yet
// ============================================================
// These are subject-method prior fits — NOT what we'll use long-term,
// just a starting point so the bandit doesn't flail on day 1.

const SUBJECT_METHOD_PRIORS: Record<string, Partial<Record<MethodCode, number>>> = {
  math: {
    vedic_math: 0.7, feynman: 0.65, pq4r: 0.6, dual_coding: 0.6,
    visualization: 0.55, analogy: 0.55, active_recall: 0.6,
  },
  science: {
    visualization: 0.7, analogy: 0.7, feynman: 0.65, project_based: 0.65,
    elaborative_interrogation: 0.6, dual_coding: 0.6,
  },
  english: {
    storytelling: 0.7, elaborative_interrogation: 0.65, active_recall: 0.6,
    cornell_notes: 0.6, pq4r: 0.6,
  },
  hindi: {
    storytelling: 0.7, memory_palace: 0.6, active_recall: 0.6, sutra_learning: 0.55,
  },
  'social science': {
    storytelling: 0.7, mind_map: 0.65, cornell_notes: 0.6, memory_palace: 0.55,
  },
  history: {
    storytelling: 0.75, memory_palace: 0.65, mind_map: 0.6, cornell_notes: 0.55,
  },
  geography: {
    visualization: 0.7, mind_map: 0.65, dual_coding: 0.6, project_based: 0.55,
  },
};

function getPrior(subjectName: string | undefined, method: MethodCode): number {
  if (!subjectName) return 0.4;
  const key = subjectName.toLowerCase();
  for (const [sub, priors] of Object.entries(SUBJECT_METHOD_PRIORS)) {
    if (key.includes(sub)) {
      return priors[method] ?? 0.4;
    }
  }
  return 0.4;
}

// ============================================================
// Compute per-subject per-method stats from raw records
// ============================================================

export async function computeMethodStats(
  supabase: any,
  userId: string,
  subjectId: string,
  subjectName?: string,
): Promise<MethodStats[]> {
  // Pull effectiveness records + recent learner signals scoped to this subject
  const [effectivenessResult, signalsResult] = await Promise.all([
    supabase
      .from('student_method_effectiveness')
      .select('*, topics(id, subject_id)')
      .eq('user_id', userId)
      .catch(() => ({ data: [] })),
    supabase
      .from('learner_signals')
      .select('*')
      .eq('user_id', userId)
      .eq('subject_id', subjectId)
      .order('created_at', { ascending: false })
      .limit(500)
      .catch(() => ({ data: [] })),
  ]);

  const effectiveness = (effectivenessResult?.data || []).filter(
    (r: any) => r.topics?.subject_id === subjectId,
  );
  const signals = signalsResult?.data || [];

  // Group records by method
  const methodGroups: Record<string, any[]> = {};
  for (const r of effectiveness) {
    const m = r.method_code;
    if (!methodGroups[m]) methodGroups[m] = [];
    methodGroups[m].push(r);
  }

  // Also consider method tags from AI interaction signals
  for (const s of signals) {
    if (s.signal_type === 'ai_guru_interaction' && s.metadata?.teaching_method) {
      const m = s.metadata.teaching_method;
      if (!methodGroups[m]) methodGroups[m] = [];
      methodGroups[m].push({
        method_code: m,
        created_at: s.created_at,
        time_spent_minutes: (s.metadata.time_seconds || 120) / 60,
        _fromSignal: true,
      });
    }
  }

  const nowMs = Date.now();
  const stats: MethodStats[] = [];

  for (const [method, records] of Object.entries(methodGroups)) {
    const attempts = records.length;
    if (attempts === 0) continue;

    // Accuracy delta: look at answer signals BEFORE and AFTER method use
    // Simplified: use average understanding_after - understanding_before
    const deltas = records
      .filter((r: any) => !r._fromSignal && r.understanding_after !== null && r.understanding_before !== null)
      .map((r: any) => (r.understanding_after - r.understanding_before) / 100);
    const avgAccuracyDelta = deltas.length > 0
      ? deltas.reduce((s: number, d: number) => s + d, 0) / deltas.length
      : 0;

    // Engagement: time spent > 3 min = engaged
    const times = records.map((r: any) => r.time_spent_minutes || 0);
    const avgTime = times.reduce((s: number, t: number) => s + t, 0) / times.length;
    const avgEngagement = Math.min(avgTime / 10, 1); // normalize to 10 min

    // Completion rate: for now assume 1 unless marked incomplete
    const completionRate = records.filter((r: any) => r._fromSignal || r.understanding_after !== null).length / attempts;

    // Retention: approximate by checking if same topic was retried 7+ days later AND succeeded
    let retained = 0;
    let retentionBasis = 0;
    for (const r of records) {
      if (r._fromSignal) continue;
      const recordTime = new Date(r.created_at).getTime();
      const followup = signals.find((s: any) => {
        if (s.signal_type !== 'answer_result') return false;
        const sTime = new Date(s.created_at).getTime();
        const daysLater = (sTime - recordTime) / (1000 * 60 * 60 * 24);
        return s.metadata?.topic_id === r.topic_id && daysLater >= 5 && daysLater <= 21;
      });
      if (followup) {
        retentionBasis++;
        if (followup.value >= 0.5) retained++;
      }
    }
    const retentionRate = retentionBasis > 0 ? retained / retentionBasis : 0.5;

    // Wins = delta > 0 OR high engagement
    const wins = records.filter((r: any) => {
      if (r._fromSignal) return (r.time_spent_minutes || 0) > 3;
      return (r.understanding_after || 0) > (r.understanding_before || 0);
    }).length;
    const losses = attempts - wins;

    // Effectiveness score — composite (behavioral, not self-report)
    // 40% accuracy delta, 25% retention, 20% engagement, 15% completion
    const effectivenessScore = clamp(
      0.4 * (0.5 + avgAccuracyDelta / 2) +
      0.25 * retentionRate +
      0.20 * avgEngagement +
      0.15 * completionRate,
      0, 1,
    );

    // Confidence grows with sample size, saturating around 20 attempts
    const confidence = 1 - Math.exp(-attempts / 7);

    const lastUsed = records[0]?.created_at ? new Date(records[0].created_at).getTime() : nowMs;
    const lastUsedDaysAgo = Math.floor((nowMs - lastUsed) / (1000 * 60 * 60 * 24));

    stats.push({
      method: method as MethodCode,
      attempts,
      wins,
      losses,
      avgAccuracyDelta,
      avgEngagement,
      retentionRate,
      completionRate,
      effectivenessScore,
      confidence,
      lastUsedDaysAgo,
    });
  }

  return stats.sort((a, b) => b.effectivenessScore - a.effectivenessScore);
}

function clamp(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, x));
}

// ============================================================
// Thompson sampling — pick method using beta distribution
// ============================================================

function sampleBeta(alpha: number, beta: number): number {
  // Approximation via gamma ratios for simplicity
  const x = sampleGamma(alpha);
  const y = sampleGamma(beta);
  return x / (x + y);
}

function sampleGamma(shape: number): number {
  // Marsaglia & Tsang for shape >= 1; shift for shape < 1
  if (shape < 1) {
    return sampleGamma(shape + 1) * Math.pow(Math.random(), 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x, v;
    do {
      x = randn();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function randn(): number {
  // Box-Muller
  const u = 1 - Math.random();
  const v = 1 - Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ============================================================
// Recommend a method — exploit best, occasionally explore
// ============================================================

export function recommendMethod(
  stats: MethodStats[],
  subjectName: string | undefined,
  candidatePool?: MethodCode[],
): CalibrationResult {
  // Pool of methods under consideration
  const pool: MethodCode[] = candidatePool || [
    'feynman', 'mind_map', 'cornell_notes', 'teach_back', 'project_based',
    'analogy', 'storytelling', 'visualization', 'active_recall', 'spaced_rep',
    'dual_coding', 'chunking', 'memory_palace', 'socratic', 'vedic_math',
    'elaborative_interrogation', 'pq4r',
  ];

  // Ensure every pool method has a stats entry (use priors if none)
  const statMap: Record<string, MethodStats> = {};
  for (const s of stats) statMap[s.method] = s;
  for (const m of pool) {
    if (!statMap[m]) {
      statMap[m] = {
        method: m,
        attempts: 0,
        wins: 0,
        losses: 0,
        avgAccuracyDelta: 0,
        avgEngagement: 0,
        retentionRate: 0.5,
        completionRate: 0.8,
        effectivenessScore: getPrior(subjectName, m),
        confidence: 0,
        lastUsedDaysAgo: 999,
      };
    }
  }

  const fullStats = Object.values(statMap);
  // Sort by effectiveness to find best
  const sorted = [...fullStats].sort((a, b) => b.effectivenessScore - a.effectivenessScore);
  const best = sorted[0];

  // Thompson sampling for recommendation
  // alpha = wins + prior_wins, beta = losses + prior_losses
  const samples = fullStats.map((s) => {
    const priorStrength = 3; // how much the prior anchors
    const prior = getPrior(subjectName, s.method);
    const alpha = s.wins + priorStrength * prior + 1;
    const beta = s.losses + priorStrength * (1 - prior) + 1;
    return { method: s.method, sample: sampleBeta(alpha, beta), stats: s };
  });
  samples.sort((a, b) => b.sample - a.sample);
  const sampled = samples[0];

  const exploring = sampled.method !== best.method;

  let evidence = '';
  if (best.attempts === 0) {
    evidence = `No attempts yet — starting with ${sampled.method} based on priors for ${subjectName || 'this subject'}.`;
  } else if (exploring) {
    evidence = `Best so far is ${best.method} (score ${(best.effectivenessScore * 100).toFixed(0)}%, ${best.attempts} attempts). Trying ${sampled.method} this time to see if it could work even better.`;
  } else {
    evidence = `${best.method} is working well — score ${(best.effectivenessScore * 100).toFixed(0)}% across ${best.attempts} attempts. Retention: ${(best.retentionRate * 100).toFixed(0)}%.`;
  }

  return {
    subjectId: '',
    subjectName,
    bestMethod: best.method,
    bestScore: best.effectivenessScore,
    runnerUps: sorted.slice(0, 5),
    recommendedMethod: sampled.method,
    exploring,
    evidence,
  };
}

// ============================================================
// Record an outcome — behavioral, not self-report
// ============================================================

export async function recordMethodOutcome(supabase: any, outcome: Omit<MethodOutcome, 'timestamp'>): Promise<void> {
  const timestamp = new Date().toISOString();
  // Persist to the existing table (graceful on missing columns)
  try {
    await supabase.from('student_method_effectiveness').insert({
      user_id: outcome.userId,
      topic_id: outcome.topicId || null,
      method_code: outcome.method,
      // Map behavioral outcome into existing schema
      understanding_before: 50,
      understanding_after: Math.round(50 + outcome.accuracyDelta * 50),
      time_spent_minutes: Math.round(outcome.timeSpentSeconds / 60),
      rating: Math.round(outcome.engagementScore * 5),
      created_at: timestamp,
    });
  } catch {
    // ignore — table may not exist yet
  }

  // Also write a behavioral signal for orthogonal tracking
  try {
    await supabase.from('learner_signals').insert({
      user_id: outcome.userId,
      signal_type: 'method_outcome',
      category: 'performance',
      source: 'calibration_engine',
      subject_id: outcome.subjectId,
      value: outcome.accuracyDelta,
      metadata: {
        method: outcome.method,
        topic_id: outcome.topicId,
        completed: outcome.completed,
        time_seconds: outcome.timeSpentSeconds,
        engagement: outcome.engagementScore,
        retention_7d: outcome.retentionAt7Days,
        confidence_gap: outcome.confidenceGapAfter,
      },
      created_at: timestamp,
    });
  } catch {
    // ignore
  }
}

// ============================================================
// Build full calibration for all subjects at once
// ============================================================

export async function buildCalibrationMap(
  supabase: any,
  userId: string,
  subjects: Array<{ id: string; name: string }>,
): Promise<CalibrationResult[]> {
  const results = await Promise.all(
    subjects.map(async (s) => {
      const stats = await computeMethodStats(supabase, userId, s.id, s.name);
      const rec = recommendMethod(stats, s.name);
      return { ...rec, subjectId: s.id, subjectName: s.name };
    }),
  );
  return results;
}
