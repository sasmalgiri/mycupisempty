import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { buildStudentState, decideAdaptation, type StudentState } from '@/lib/student-state';
import { studentStateCache, cached, cacheKey } from '@/lib/cache';

/**
 * GET /api/student-state
 *
 * Returns the full computed student state — used by the dashboard
 * and any component that needs to understand the student.
 */
export async function GET() {
  try {
    const supabase = await createServerClient() as any;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Cached — bust via invalidateUserCaches(userId) from signal-writing paths
    const state = (await cached(
      studentStateCache,
      cacheKey(user.id, 'state'),
      () => buildStudentState(supabase, user.id),
    )) as StudentState;
    const adaptation = decideAdaptation(state);

    return NextResponse.json({
      success: true,
      data: {
        state,
        adaptation,
        // Summary for quick display
        summary: {
          mood: state.currentMood,
          energy: state.energyLevel,
          frustration: state.frustrationLevel,
          confidence: state.confidenceLevel,
          minutesActiveToday: state.minutesActiveToday,
          attentionSpan: state.attentionSpanMinutes,
          isNearDropOff: state.isNearDropOff,
          cognitiveLoad: state.cognitiveLoad,
          // Per-subject quick stats
          subjects: Object.values(state.subjectStates).map(s => ({
            id: s.subjectId,
            name: s.subjectName,
            accuracy: Math.round(s.recentAccuracy * 100),
            trend: s.accuracyTrend,
            band: s.currentBand,
            stalledCount: s.stalledTopics.length,
            confidenceGap: s.confidenceAccuracyGap > 0.2 ? 'overconfident'
              : s.confidenceAccuracyGap < -0.2 ? 'underconfident' : 'calibrated',
          })),
          // Top issues
          topIssues: [
            ...state.activeMistakePatterns
              .filter(m => m.severity === 'critical')
              .slice(0, 3)
              .map(m => ({ type: 'mistake', text: m.pattern, subject: m.subject, action: m.suggestedIntervention })),
            ...state.activeMisconceptions
              .slice(0, 3)
              .map(m => ({ type: 'misconception', text: m, subject: '', action: 'Address directly' })),
          ],
          profileConfidence: state.profileConfidence,
        },
      },
    });
  } catch (error: any) {
    console.error('Student state error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to compute student state' },
      { status: 500 }
    );
  }
}
