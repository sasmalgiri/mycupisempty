/**
 * Rank Predictor API.
 *
 * GET ?kind=board_percentage|jee_main_rank|jee_advanced_rank|neet_rank|school_topper
 *   → Compute a fresh prediction (or return a cached one < 24h old) using
 *     the student's recent session_evaluations + mastery_scores. Caches
 *     the result in rank_predictions for fast reads.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { predict, type PredictionInput } from '@/lib/rank-predictor';

const VALID_KINDS = ['board_percentage', 'jee_main_rank', 'jee_advanced_rank', 'neet_rank', 'school_topper'];
const CACHE_HOURS = 24;

export async function GET(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const kind = url.searchParams.get('kind') as PredictionInput['examKind'] | null;
    if (!kind || !VALID_KINDS.includes(kind)) {
      return NextResponse.json({ error: 'kind required' }, { status: 400 });
    }

    // Cache hit?
    const since = new Date(Date.now() - CACHE_HOURS * 3600 * 1000).toISOString();
    const { data: cached } = await supabase
      .from('rank_predictions')
      .select('*')
      .eq('user_id', user.id)
      .eq('prediction_kind', kind)
      .gte('generated_at', since)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cached) return NextResponse.json({ success: true, prediction: cached, cached: true });

    // Pull recent inputs
    const evalsSince = new Date(Date.now() - 60 * 86400000).toISOString();
    const [{ data: evals }, { data: masteries }] = await Promise.all([
      supabase
        .from('session_evaluations')
        .select('score')
        .eq('user_id', user.id)
        .gte('evaluated_at', evalsSince)
        .order('evaluated_at', { ascending: false })
        .limit(50),
      supabase
        .from('mastery_scores')
        .select('score')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(80),
    ]);

    const input: PredictionInput = {
      examKind: kind,
      recentScores: (evals || []).map((r: any) => r.score),
      masteryScores: (masteries || []).map((r: any) => r.score),
      mockMarks: [],   // wired when the mock-test feature lands
      attemptsCount: (evals || []).length + (masteries || []).length,
    };

    const p = predict(input);
    const expiresAt = new Date(Date.now() + CACHE_HOURS * 3600 * 1000).toISOString();

    const { data: row } = await supabase.from('rank_predictions').insert({
      user_id: user.id,
      prediction_kind: kind,
      point_estimate: p.pointEstimate,
      ci_low: p.ciLow,
      ci_high: p.ciHigh,
      confidence: p.confidence,
      inputs: input,
      method: p.method,
      expires_at: expiresAt,
    }).select().single();

    return NextResponse.json({
      success: true,
      prediction: row || {
        prediction_kind: kind,
        point_estimate: p.pointEstimate,
        ci_low: p.ciLow,
        ci_high: p.ciHigh,
        confidence: p.confidence,
        method: p.method,
      },
      reason: p.methodReason,
      recommendation: p.recommendation,
      cached: false,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
