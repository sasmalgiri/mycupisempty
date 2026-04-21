/**
 * Self-Learning API
 *
 * GET                    — show current learned priors for this student's context
 * POST action=aggregate  — trigger aggregation of recent experiences into priors
 *                           (safe to call from cron or admin; protected by auth)
 *
 * The heart of "the system gets smarter with experience": every adaptive
 * decision logs an ExperienceRecord and resolves with a reward signal. This
 * route exposes the accumulated learning.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import {
  aggregateIntoPriors,
  contextKeyFor,
  classBandFromClassLevel,
  moodBucketFromState,
  topActionsForContext,
} from '@/lib/self-learning';
import { buildStudentState } from '@/lib/student-state';
import { computeMaturity } from '@/lib/maturity';

export async function GET(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const subjectName = url.searchParams.get('subject') || undefined;

    // Build context for this student right now
    const state = await buildStudentState(supabase, user.id);
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_class')
      .eq('id', user.id)
      .single()
      .catch(() => ({ data: null }));
    const classLevel = profile?.current_class || 8;

    const subjectState = subjectName
      ? Object.values(state.subjectStates).find((s) => s.subjectName?.toLowerCase() === subjectName.toLowerCase())
      : null;

    let maturityBand: number | undefined;
    if (subjectState) {
      const mp = computeMaturity({
        userId: user.id,
        subjectId: subjectState.subjectId,
        subjectName: subjectState.subjectName,
        subjectState,
        studentState: state,
        classLevel,
      });
      maturityBand = mp.band;
    }

    const contextKey = contextKeyFor({
      subjectName,
      maturityBand,
      moodBucket: moodBucketFromState(state.frustrationLevel, state.confidenceLevel),
      classBand: classBandFromClassLevel(classLevel),
    });

    const topActions = await topActionsForContext(supabase, contextKey, 10);

    // Also expose the student's own resolved experiences count (privacy: only theirs)
    const { count: personalExperienceCount } = await supabase
      .from('experiences')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('resolved', true);

    return NextResponse.json({
      success: true,
      contextKey,
      topActions,
      personalExperienceCount: personalExperienceCount || 0,
      message: topActions.length === 0
        ? 'Still learning — as more students interact, we\'ll know what works best for your context.'
        : `Based on ${topActions.reduce((s, a) => s + a.sampleSize, 0)} aggregate experiences from learners in your context.`,
    });
  } catch (error: any) {
    console.error('Self-learning GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    if (body.action !== 'aggregate') return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

    // Allow any user to trigger an aggregation for their own recently-resolved
    // experiences. (For a global background job, use a scheduled edge function
    // with service-role key.)
    const result = await aggregateIntoPriors(supabase, {
      since: body.since,
      decay: body.decay,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Self-learning POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
