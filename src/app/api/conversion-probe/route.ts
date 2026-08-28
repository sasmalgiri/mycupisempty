/**
 * Retention probe sweep — the job that closes the learning loop.
 *
 * Without this, every conversion_outcomes row keeps retention_score = NULL, so
 * rewardFor() marks it provisional forever, the evidence never firms up, and
 * the engine never actually learns anything. This is the cron that turns a
 * pleasant lesson into evidence — or into a correction.
 *
 * What it does nightly:
 *   1. Find outcomes whose retention_probe_at has passed and whose
 *      retention_score is still NULL.
 *   2. Queue a probe question for each, as a notification the student answers
 *      in their next session ("A week ago you worked out X — can you still do
 *      it?"). Answering POSTs back to /api/conversion { action:'resolve_probe' }.
 *   3. Expire probes nobody answered after PROBE_GRACE_DAYS, so a dead row
 *      cannot sit in the queue forever pretending to be pending evidence.
 *   4. Roll resolved experiences into the global learned_priors, so what one
 *      student teaches us improves the cold start for the next.
 *
 * Authorization: Bearer ${CRON_SECRET}, or ?secret=... for local runs.
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { aggregateIntoPriors } from '@/lib/self-learning';
import { KNOWLEDGE_TYPE_LABEL, REPRESENTATION_LABEL, type KnowledgeType, type RepresentationCode } from '@/lib/conversion-engine';

/** After this long unanswered, a probe stops counting as pending evidence. */
const PROBE_GRACE_DAYS = 14;

function isAuthorizedCron(req: Request): boolean {
  const auth = req.headers.get('authorization') || '';
  const expected = process.env.CRON_SECRET || '';
  if (!expected) return false;
  if (auth === `Bearer ${expected}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get('secret') === expected;
}

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin: any = createAdminClient();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const graceIso = new Date(now - PROBE_GRACE_DAYS * 86400000).toISOString();

  let queued = 0;
  let expired = 0;
  const errors: string[] = [];

  // --- 1. Expire probes that went unanswered past the grace window ---------
  try {
    const { data: stale } = await admin
      .from('conversion_outcomes')
      .select('id')
      .is('retention_score', null)
      .lt('retention_probe_at', graceIso)
      .limit(500);

    if (stale?.length) {
      // An unanswered probe is not a zero score — we did not measure anything.
      // Mark it resolved-as-unknown so it stops looking like pending evidence,
      // and leave the reward at the neutral provisional value it already has.
      const ids = stale.map((r: any) => r.id);
      await admin
        .from('conversion_outcomes')
        .update({ retention_probe_at: null, resolved_at: nowIso })
        .in('id', ids);
      await admin
        .from('retention_probe_queue')
        .update({ status: 'expired' })
        .in('outcome_id', ids)
        .eq('status', 'pending');
      expired = ids.length;
    }
  } catch (e: any) {
    errors.push(`expire: ${e.message}`);
  }

  // --- 2. Queue probes that are due ---------------------------------------
  try {
    const { data: due } = await admin
      .from('conversion_outcomes')
      .select('id, user_id, unit_id, topic_id, knowledge_type, representation, retention_probe_at')
      .is('retention_score', null)
      .lte('retention_probe_at', nowIso)
      .gte('retention_probe_at', graceIso)
      .order('retention_probe_at', { ascending: true })
      .limit(500);

    for (const row of due || []) {
      try {
        // UNIQUE(outcome_id) makes this idempotent — a re-run of the cron
        // cannot double-queue the same probe.
        const { error } = await admin.from('retention_probe_queue').upsert(
          {
            user_id: row.user_id,
            outcome_id: row.id,
            unit_id: row.unit_id,
            topic_id: row.topic_id,
            knowledge_type: row.knowledge_type,
            representation: row.representation,
            question: probeText(row.knowledge_type, row.representation),
            status: 'pending',
            due_at: row.retention_probe_at || nowIso,
          },
          { onConflict: 'outcome_id', ignoreDuplicates: true },
        );
        if (error) throw new Error(error.message);
        queued++;
      } catch (e: any) {
        errors.push(`queue ${row.id}: ${e.message}`);
      }
    }
  } catch (e: any) {
    errors.push(`due: ${e.message}`);
  }

  // --- 3. Roll resolved experiences into global priors ---------------------
  let priorsUpdated = 0;
  try {
    const agg = await aggregateIntoPriors(admin, {
      since: new Date(now - 2 * 86400000).toISOString(),
    });
    priorsUpdated = agg.priorsUpdated;
  } catch (e: any) {
    errors.push(`aggregate: ${e.message}`);
  }

  return NextResponse.json({
    success: errors.length === 0,
    queued,
    expired,
    priorsUpdated,
    errors: errors.slice(0, 20),
  });
}

/**
 * The probe question depends on what was taught and how.
 *
 * Crucially it asks the student to PERFORM, not to rate themselves. "Do you
 * still remember?" measures confidence; "do it again now" measures retention,
 * and those two come apart badly — which is the entire reason this table
 * exists.
 */
function probeText(kind: string, rep: string): string {
  const what = KNOWLEDGE_TYPE_LABEL[kind as KnowledgeType] || 'this';
  const how = REPRESENTATION_LABEL[rep as RepresentationCode] || 'the approach we used';

  switch (kind as KnowledgeType) {
    case 'arbitrary_fact':
      return `You built your own picture for this one (${how}). Can you still get it back — without looking?`;
    case 'causal_sequence':
      return 'Walk the chain again from the start. What causes what?';
    case 'concept':
      return 'One borderline case: does it count or not, and what decides it?';
    case 'procedure':
      return 'One fresh problem of the same type, no help this time.';
    case 'relational_structure':
      return 'Where does a new item belong on the map you made, and why there?';
    case 'judgment':
      return 'Apply the criteria you set out last week to a new sample.';
    default:
      return `A quick check on ${what.toLowerCase()}.`;
  }
}
