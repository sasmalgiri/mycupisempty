/**
 * GET /api/mastery
 *
 * Returns true mastery map per subject. NOT "% complete" — real states:
 * fresh | learning | fragile | stable | mastered | stalled | decayed.
 *
 * This is what replaces the fake progress bar on the dashboard.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { buildMasteryMap, honestMasterySummary } from '@/lib/mastery';
import { detectInterventions } from '@/lib/intervention-engine';
import { buildStudentState } from '@/lib/student-state';
import { masteryCache, studentStateCache, cached, cacheKey } from '@/lib/cache';

export async function GET() {
  try {
    const supabase = await createServerClient() as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [maps, state] = await Promise.all([
      cached(masteryCache, cacheKey(user.id, 'mastery'), () => buildMasteryMap(supabase, user.id)) as ReturnType<typeof buildMasteryMap>,
      cached(studentStateCache, cacheKey(user.id, 'state'), () => buildStudentState(supabase, user.id)) as ReturnType<typeof buildStudentState>,
    ]);

    const summary = honestMasterySummary(maps);
    const interventions = detectInterventions(state);

    return NextResponse.json({
      success: true,
      summary,
      subjects: maps,
      interventions: interventions.slice(0, 5),
    });
  } catch (error: any) {
    console.error('Mastery error:', error);
    return NextResponse.json({ error: error.message || 'Failed to build mastery map' }, { status: 500 });
  }
}
