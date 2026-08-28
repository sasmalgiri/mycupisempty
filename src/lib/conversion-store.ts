/**
 * Conversion Store — the I/O layer for the Conversion Engine.
 *
 * conversion-engine.ts is deliberately pure (no Supabase, no network) so it
 * stays testable and runs offline. Everything that touches the database lives
 * here.
 *
 * Three jobs:
 *   1. Turn conversion_outcomes rows into the RepStats the selector expects.
 *   2. Read cross-student learned_priors for the (subject × knowledgeType)
 *      context, so a brand-new student starts from accumulated wisdom rather
 *      than from a quiz.
 *   3. Write outcomes back, including the delayed retention probe that is the
 *      only signal which actually distinguishes learning from a nice session.
 */

import { createHash } from 'crypto';
import {
  conversionContextKey,
  rewardFor,
  KNOWLEDGE_TYPES,
  type KnowledgeType,
  type RepresentationCode,
  type RepStats,
  type Classification,
  type ConversionOutcome,
} from './conversion-engine';
import { logExperience, classBandFromClassLevel } from './self-learning';

// ============================================================================
// 1. Per-student stats, grouped by knowledge type
// ============================================================================

export async function loadRepStats(
  supabase: any,
  userId: string,
  subjectId?: string,
): Promise<Partial<Record<KnowledgeType, RepStats[]>>> {
  let rows: any[] = [];
  try {
    let q = supabase
      .from('conversion_outcomes')
      .select('knowledge_type, representation, immediate_score, retention_score, engagement_score, completed, reward, provisional')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(2000);
    if (subjectId) q = q.eq('subject_id', subjectId);
    const { data } = await q;
    rows = data || [];
  } catch {
    return {};
  }

  // Group by (knowledge_type, representation)
  const groups = new Map<string, any[]>();
  for (const r of rows) {
    const key = `${r.knowledge_type}::${r.representation}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const out: Partial<Record<KnowledgeType, RepStats[]>> = {};

  for (const [key, rs] of groups.entries()) {
    const [kt, rep] = key.split('::') as [KnowledgeType, RepresentationCode];
    if (!KNOWLEDGE_TYPES.includes(kt)) continue;

    const attempts = rs.length;
    const num = (v: any, d = 0) => (v == null ? d : Number(v));

    // Retention is only averaged over rows where the probe actually fired.
    // Unresolved rows must not be silently counted as 0.5 successes — that
    // would let a burst of fresh sessions look like evidence.
    const resolved = rs.filter((r) => r.retention_score != null);
    const retentionRate = resolved.length
      ? resolved.reduce((s, r) => s + num(r.retention_score), 0) / resolved.length
      : 0.5;

    const avgImmediate = rs.reduce((s, r) => s + num(r.immediate_score, 0.5), 0) / attempts;
    const avgEngagement = rs.reduce((s, r) => s + num(r.engagement_score, 0.5), 0) / attempts;
    const completionRate = rs.filter((r) => r.completed).length / attempts;

    // A "win" is judged on retention where we have it, immediate score otherwise.
    const wins = rs.filter((r) =>
      r.retention_score != null ? num(r.retention_score) >= 0.6 : num(r.immediate_score, 0) >= 0.7,
    ).length;

    const stat: RepStats = {
      representation: rep,
      knowledgeType: kt,
      attempts,
      wins,
      losses: attempts - wins,
      // Centre the immediate score on 0 so it reads as a delta from baseline.
      avgAccuracyDelta: (avgImmediate - 0.5) * 2,
      retentionRate,
      avgEngagement,
      completionRate,
    };

    (out[kt] ||= []).push(stat);
  }

  return out;
}

// ============================================================================
// 2. Cross-student priors — how a new student avoids a cold start
// ============================================================================

/**
 * Read learned_priors for every knowledge type in this context.
 *
 * learned_priors (migration 013) is generic over (context_key, action_key), so
 * conversionContextKey() slots straight in with action_key = representation.
 * No parallel table, and the existing aggregator keeps these fresh.
 */
export async function loadGlobalPriors(
  supabase: any,
  params: { subjectName?: string; classLevel?: number; maturityBand?: number },
): Promise<Partial<Record<KnowledgeType, Partial<Record<RepresentationCode, number>>>>> {
  const classBand = params.classLevel != null ? classBandFromClassLevel(params.classLevel) : undefined;

  const keys = KNOWLEDGE_TYPES.map((kt) => ({
    kt,
    key: conversionContextKey({
      subjectName: params.subjectName,
      knowledgeType: kt,
      classBand,
      maturityBand: params.maturityBand,
    }),
  }));

  let rows: any[] = [];
  try {
    const { data } = await supabase
      .from('learned_priors')
      .select('context_key, action_key, mean_reward, sample_size')
      .in('context_key', keys.map((k) => k.key));
    rows = data || [];
  } catch {
    return {};
  }

  const byKey = new Map(keys.map((k) => [k.key, k.kt]));
  const out: Partial<Record<KnowledgeType, Partial<Record<RepresentationCode, number>>>> = {};

  for (const r of rows) {
    const kt = byKey.get(r.context_key);
    if (!kt) continue;
    // A prior built on 2 samples is not a prior. Ignore it rather than let it
    // steer a real student.
    if (Number(r.sample_size || 0) < 5) continue;
    (out[kt] ||= {})[r.action_key as RepresentationCode] = Math.max(0, Math.min(1, Number(r.mean_reward)));
  }

  return out;
}

// ============================================================================
// 3. Classification with caching
// ============================================================================

function hashUnit(text: string): string {
  return createHash('sha256').update(text.trim()).digest('hex').slice(0, 32);
}

/**
 * Write the classification audit trail.
 *
 * Not a performance cache — classification is cheap. This exists so a teacher
 * can later ask "why was this unit taught as a procedure?" and get the exact
 * cue list that decided it, months after the lesson.
 *
 * Best-effort by design: a failure here must never interrupt a lesson.
 */
export async function cacheClassifications(
  supabase: any,
  classifications: Array<Classification & { topicId: string; body: string }>,
  chapterId?: string | null,
): Promise<void> {
  if (classifications.length === 0) return;
  try {
    await supabase.from('content_classifications').upsert(
      classifications.map((r) => ({
        chapter_id: chapterId || null,
        topic_id: r.topicId,
        unit_id: r.unitId,
        unit_hash: hashUnit(r.body),
        unit_preview: r.body.slice(0, 200),
        knowledge_type: r.type,
        confidence: r.confidence,
        ambiguous: r.ambiguous,
        runner_up: r.runnerUp,
        distribution: r.distribution,
        cues: r.cues,
      })),
      { onConflict: 'unit_hash', ignoreDuplicates: true },
    );
  } catch {
    // ignore — the audit trail is desirable, not load-bearing
  }
}

// ============================================================================
// 4. Recording an outcome
// ============================================================================

export interface RecordArgs extends ConversionOutcome {
  userId: string;
  subjectId?: string;
  subjectName?: string;
  topicId?: string;
  chapterId?: string;
  classLevel?: number;
  maturityBand?: number;
  retentionProbeDays?: number;
}

/**
 * Write one observation.
 *
 * Two writes, deliberately:
 *   - conversion_outcomes  → this student's per-knowledge-type evidence
 *   - experiences          → feeds aggregateIntoPriors(), so what we learn
 *                            from this child improves the cold start for the
 *                            next one, with no PII crossing over.
 */
export async function recordConversionOutcome(
  supabase: any,
  args: RecordArgs,
): Promise<{ reward: number; provisional: boolean; experienceId: string | null }> {
  const { reward, provisional } = rewardFor(args);

  const probeDays = args.retentionProbeDays ?? 7;
  const probeAt = new Date(Date.now() + probeDays * 24 * 3600 * 1000).toISOString();

  const contextKey = conversionContextKey({
    subjectName: args.subjectName,
    knowledgeType: args.knowledgeType,
    classBand: args.classLevel != null ? classBandFromClassLevel(args.classLevel) : undefined,
    maturityBand: args.maturityBand,
  });

  // Only resolved (probe-fired) outcomes are allowed to move the global priors.
  const experienceId = await logExperience(
    supabase,
    {
      userId: args.userId,
      kind: 'conversion',
      contextKey,
      actionKey: args.representation,
      reward,
      metadata: {
        knowledge_type: args.knowledgeType,
        representation: args.representation,
        constructed_own: args.constructedOwn,
        unit_id: args.unitId,
        provisional,
      },
    },
    { resolvedNow: !provisional },
  );

  try {
    await supabase.from('conversion_outcomes').insert({
      user_id: args.userId,
      subject_id: args.subjectId || null,
      topic_id: args.topicId || null,
      chapter_id: args.chapterId || null,
      unit_id: args.unitId,
      knowledge_type: args.knowledgeType,
      representation: args.representation,
      constructed_own: args.constructedOwn,
      immediate_score: args.immediateScore,
      retention_score: args.retentionScore ?? null,
      engagement_score: args.engagementScore,
      completed: args.completed,
      time_spent_seconds: args.timeSpentSeconds,
      reward,
      provisional,
      retention_probe_at: args.retentionScore == null ? probeAt : null,
      experience_id: experienceId,
      resolved_at: provisional ? null : new Date().toISOString(),
    });
  } catch {
    // table may not exist yet — the engine still works, it just learns nothing
  }

  return { reward, provisional, experienceId };
}

/**
 * Close the loop when a retention probe comes back.
 *
 * This is the write that turns a provisional guess into real evidence, and it
 * is the reason the engine can honestly say "backed by evidence" at 15
 * observations instead of at 2.
 */
export async function resolveRetentionProbe(
  supabase: any,
  outcomeId: string,
  retentionScore: number,
): Promise<void> {
  try {
    const { data: row } = await supabase
      .from('conversion_outcomes')
      .select('*')
      .eq('id', outcomeId)
      .maybeSingle();
    if (!row) return;

    const { reward } = rewardFor({
      unitId: row.unit_id,
      knowledgeType: row.knowledge_type,
      representation: row.representation,
      constructedOwn: !!row.constructed_own,
      immediateScore: Number(row.immediate_score ?? 0.5),
      retentionScore,
      engagementScore: Number(row.engagement_score ?? 0.5),
      completed: !!row.completed,
      timeSpentSeconds: Number(row.time_spent_seconds ?? 0),
    });

    await supabase
      .from('conversion_outcomes')
      .update({
        retention_score: retentionScore,
        reward,
        provisional: false,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', outcomeId);

    if (row.experience_id) {
      await supabase
        .from('experiences')
        .update({ reward, resolved: true, resolved_at: new Date().toISOString() })
        .eq('id', row.experience_id);
    }

    // Close the queued probe so the student is not asked the same thing twice.
    await supabase
      .from('retention_probe_queue')
      .update({ status: 'answered', answered_at: new Date().toISOString() })
      .eq('outcome_id', outcomeId);
  } catch {
    // ignore
  }
}

/**
 * Probes waiting for this student, newest question first.
 *
 * Read the queue the cron fills, and fall back to scanning conversion_outcomes
 * directly if the queue table is not there yet — so a session still works
 * before migration 034 is applied.
 */
export async function dueRetentionProbes(
  supabase: any,
  userId: string,
  limit = 10,
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('retention_probe_queue')
      .select('id, outcome_id, unit_id, topic_id, knowledge_type, representation, question, due_at')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .lte('due_at', new Date().toISOString())
      .order('due_at', { ascending: true })
      .limit(limit);
    if (!error && data) return data;
  } catch {
    // fall through
  }

  try {
    const { data } = await supabase
      .from('conversion_outcomes')
      .select('id, unit_id, topic_id, subject_id, knowledge_type, representation, retention_probe_at')
      .eq('user_id', userId)
      .is('retention_score', null)
      .lte('retention_probe_at', new Date().toISOString())
      .order('retention_probe_at', { ascending: true })
      .limit(limit);
    return (data || []).map((r: any) => ({ ...r, outcome_id: r.id, due_at: r.retention_probe_at }));
  } catch {
    return [];
  }
}
