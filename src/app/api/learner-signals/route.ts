import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { tryResolveFromSignal } from '@/lib/experience-resolver';
import { invalidateUserCaches } from '@/lib/cache';

/**
 * Learner Signals API
 *
 * Receives batched behavioral signals from the client-side learner engine.
 * Signals are stored and used to continuously update the learner profile.
 *
 * This API is called silently — the student never sees these requests.
 */

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { signals } = await request.json();

    if (!Array.isArray(signals) || signals.length === 0) {
      return NextResponse.json({ error: 'No signals provided' }, { status: 400 });
    }

    // Validate and attach user_id to all signals
    const validSignals = signals
      .filter((s: any) => s.signal_type && s.category && s.source)
      .map((s: any) => ({
        user_id: user.id,
        signal_type: s.signal_type,
        category: s.category,
        source: s.source,
        subject_id: s.subject_id || null,
        value: typeof s.value === 'number' ? s.value : 0,
        metadata: s.metadata || {},
        created_at: s.timestamp || new Date().toISOString(),
      }));

    if (validSignals.length === 0) {
      return NextResponse.json({ success: true, stored: 0 });
    }

    // Try to insert into learner_signals table
    // If the table doesn't exist yet, silently succeed (signals are still queued client-side)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('learner_signals') as any)
        .insert(validSignals);

      if (error) {
        // Table might not exist — log but don't fail
        console.warn('Learner signals insert warning:', error.message);
      }
    } catch {
      // Silently handle — the table may not be created yet
    }

    // Bust this user's caches — state has changed
    invalidateUserCaches(user.id);

    // Also update aggregate profile data based on signal patterns
    await updateLearnerAggregates(supabase, user.id, validSignals);

    // Close the self-learning loop: try to resolve any delayed experiences
    // whose outcome is now visible via these signals.
    let resolvedExperiences = 0;
    try {
      for (const s of validSignals) {
        resolvedExperiences += await tryResolveFromSignal(supabase, user.id, s);
      }
    } catch (err) {
      console.warn('Experience resolver warning:', err);
    }

    return NextResponse.json({
      success: true,
      stored: validSignals.length,
      resolvedExperiences,
    });
  } catch (error: any) {
    console.error('Learner signals error:', error);
    return NextResponse.json(
      { error: 'Failed to process signals' },
      { status: 500 }
    );
  }
}

/**
 * Update aggregate learner data from new signals.
 * This builds up the learner profile over time without needing a separate batch job.
 */
async function updateLearnerAggregates(
  supabase: any,
  userId: string,
  signals: any[]
) {
  // Count emotional signals for mood tracking
  const moodSignals = signals.filter(s => s.signal_type === 'mood');
  if (moodSignals.length > 0) {
    const avgMood = moodSignals.reduce((sum: number, s: any) => sum + s.value, 0) / moodSignals.length;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('learner_profiles') as any)
        .upsert({
          user_id: userId,
          latest_mood_score: avgMood,
          mood_updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
    } catch {
      // Table might not exist
    }
  }

  // Count performance signals for subject-specific tracking
  const performanceSignals = signals.filter(
    (s: any) => s.signal_type === 'answer_result' && s.subject_id
  );
  if (performanceSignals.length > 0) {
    // Group by subject
    const bySubject: Record<string, { correct: number; total: number }> = {};
    performanceSignals.forEach((s: any) => {
      if (!bySubject[s.subject_id]) bySubject[s.subject_id] = { correct: 0, total: 0 };
      bySubject[s.subject_id].total++;
      if (s.value === 1) bySubject[s.subject_id].correct++;
    });

    // Store per-subject accuracy updates
    for (const [subjectId, stats] of Object.entries(bySubject)) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('learner_subject_profiles') as any)
          .upsert({
            user_id: userId,
            subject_id: subjectId,
            recent_accuracy: stats.correct / stats.total,
            total_attempts: stats.total,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,subject_id' });
      } catch {
        // Table might not exist
      }
    }
  }

  // Track frustration signals
  const frustrationSignals = signals.filter(
    (s: any) => s.signal_type === 'frustration_signal'
  );
  if (frustrationSignals.length >= 3) {
    // Multiple frustration signals in one batch = student is struggling
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('learner_profiles') as any)
        .upsert({
          user_id: userId,
          frustration_alert: true,
          frustration_alert_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
    } catch {
      // Table might not exist
    }
  }
}

/**
 * GET — retrieve current learner profile for the authenticated user
 */
export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch learner profile
    let profile = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from('learner_profiles') as any)
        .select('*')
        .eq('user_id', user.id)
        .single();
      profile = data;
    } catch {
      // Table might not exist
    }

    // Fetch learning style (backward compat)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: learningStyle } = await (supabase.from('learning_styles') as any)
      .select('*')
      .eq('user_id', user.id)
      .single();

    return NextResponse.json({
      success: true,
      data: {
        profile,
        learning_style: learningStyle,
      },
    });
  } catch (error: any) {
    console.error('Learner profile fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}
