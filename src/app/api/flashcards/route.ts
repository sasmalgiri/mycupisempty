import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { scheduleReview, type ReviewRating } from '@/lib/fsrs-scheduler';

// SM-2 quality (0..5) → FSRS rating (1..4). Quality<3 = Again; 3=Hard; 4=Good; 5=Easy.
function smTwoQualityToFsrsRating(q: number): ReviewRating {
  if (q < 3) return 1;
  if (q === 3) return 2;
  if (q === 4) return 3;
  return 4;
}

export async function GET() {
  try {
    const supabase = await createServerClient() as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch user's flashcard progress joined with flashcard data
    const { data: progress } = await supabase
      .from('user_flashcard_progress')
      .select(`
        id, easiness_factor, interval_days, repetitions, next_review_date, last_review_date,
        flashcard:flashcards(id, front_text, back_text, card_type, topic_id)
      `)
      .eq('user_id', user.id);

    // Also fetch flashcards the user hasn't started yet (from their curriculum)
    const existingIds = (progress || [])
      .map((p: any) => p.flashcard?.id)
      .filter(Boolean);

    // Get user profile for class level. (profiles uses `current_class`, not
    // `class_level` — see migration history; class_level was a phantom column.)
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_class')
      .eq('id', user.id)
      .single();

    const cards = (progress || []).map((p: any) => ({
      id: p.flashcard?.id || p.id,
      front: p.flashcard?.front_text || '',
      back: p.flashcard?.back_text || '',
      cardType: p.flashcard?.card_type || 'concept',
      easeFactor: parseFloat(p.easiness_factor) || 2.5,
      intervalDays: p.interval_days || 1,
      repetitions: p.repetitions || 0,
      nextReview: p.next_review_date || new Date().toISOString().split('T')[0],
      lastReviewed: p.last_review_date || null,
    }));

    return NextResponse.json({ cards, classLevel: profile?.current_class || 8 });
  } catch (error: any) {
    console.error('Flashcards GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient() as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { action } = body;

    if (action === 'create') {
      const { front, back, subject } = body;
      if (!front || !back) {
        return NextResponse.json({ error: 'Front and back are required' }, { status: 400 });
      }

      // Create the flashcard
      const { data: card, error: cardErr } = await supabase
        .from('flashcards')
        .insert({ front_text: front, back_text: back, card_type: 'concept', topic_id: null })
        .select('id')
        .single();

      if (cardErr) throw cardErr;

      // Create user progress entry
      await supabase
        .from('user_flashcard_progress')
        .insert({
          user_id: user.id,
          flashcard_id: card.id,
          easiness_factor: 2.5,
          interval_days: 1,
          repetitions: 0,
          next_review_date: new Date().toISOString().split('T')[0],
        });

      return NextResponse.json({ success: true, cardId: card.id });
    }

    if (action === 'review') {
      const { flashcard_id, quality } = body;
      // Inbound `quality` is the SM-2 scale (0=again, 3=hard, 4=good, 5=easy)
      // for backwards compatibility with the existing UI; we map it onto
      // FSRS's 4-rating scale below. Pass `rating` directly (1-4) to skip
      // the conversion if you're calling this from a new client.
      const rating: ReviewRating = typeof body.rating === 'number'
        ? Math.max(1, Math.min(4, body.rating)) as ReviewRating
        : smTwoQualityToFsrsRating(quality);

      // Load current state — both SM-2 and FSRS columns
      const { data: prog } = await supabase
        .from('user_flashcard_progress')
        .select('easiness_factor, interval_days, repetitions, next_review_date, last_review_date, fsrs_stability, fsrs_difficulty, fsrs_state, fsrs_reps, fsrs_lapses, last_review_at, scheduled_days, elapsed_days')
        .eq('user_id', user.id)
        .eq('flashcard_id', flashcard_id)
        .maybeSingle();

      const stateBeforeJson = prog ? { ...prog } : null;

      // Run the card through FSRS. Falls back to a fresh card if no prior state.
      const scheduled = scheduleReview({
        fsrs_stability: prog?.fsrs_stability ?? null,
        fsrs_difficulty: prog?.fsrs_difficulty ?? null,
        fsrs_state: prog?.fsrs_state ?? 'new',
        fsrs_reps: prog?.fsrs_reps ?? 0,
        fsrs_lapses: prog?.fsrs_lapses ?? 0,
        last_review_at: prog?.last_review_at ?? null,
        next_review_at: prog?.next_review_date ?? null,
        scheduled_days: prog?.scheduled_days ?? 0,
        elapsed_days: prog?.elapsed_days ?? 0,
        ease_factor: prog?.easiness_factor ?? null,
        interval_days: prog?.interval_days ?? null,
      }, rating);

      const today = new Date().toISOString().split('T')[0];
      const nextReviewDate = new Date(scheduled.next_review_at).toISOString().split('T')[0];

      // Persist new FSRS state (and keep the legacy SM-2 columns roughly
      // in sync for any callers that still read them).
      await supabase
        .from('user_flashcard_progress')
        .upsert({
          user_id: user.id,
          flashcard_id,
          // FSRS state — the source of truth going forward
          fsrs_stability: scheduled.fsrs_stability,
          fsrs_difficulty: scheduled.fsrs_difficulty,
          fsrs_state: scheduled.fsrs_state,
          fsrs_reps: scheduled.fsrs_reps,
          fsrs_lapses: scheduled.fsrs_lapses,
          last_review_at: scheduled.last_review_at,
          scheduled_days: scheduled.scheduled_days,
          elapsed_days: scheduled.elapsed_days,
          // Legacy SM-2 mirrors so the existing GET handler still works
          interval_days: Math.max(1, scheduled.scheduled_days),
          repetitions: scheduled.fsrs_reps,
          next_review_date: nextReviewDate,
          last_review_date: today,
        }, { onConflict: 'user_id,flashcard_id' });

      // Append to the review log — this is what the offline FSRS optimizer
      // will fit weights against once we have enough history.
      try {
        await supabase.from('flashcard_review_log').insert({
          card_id: flashcard_id,
          user_id: user.id,
          rating,
          state_before: stateBeforeJson?.fsrs_state || 'new',
          state_after: scheduled.fsrs_state,
          stability_before: stateBeforeJson?.fsrs_stability ?? null,
          stability_after: scheduled.fsrs_stability,
          difficulty_before: stateBeforeJson?.fsrs_difficulty ?? null,
          difficulty_after: scheduled.fsrs_difficulty,
          scheduled_days: scheduled.scheduled_days,
          elapsed_days: scheduled.elapsed_days,
        });
      } catch (err) {
        console.warn('flashcard_review_log insert failed (table may not exist):', err);
      }

      // Silently track flashcard performance signal — value is 1 when student
      // remembered (rating ≥ Hard), 0 when they forgot. Drives main-brain.
      try {
        await supabase.from('learner_signals').insert({
          user_id: user.id,
          signal_type: 'flashcard_review',
          category: 'performance',
          source: 'flashcard',
          value: rating >= 2 ? 1 : 0,
          metadata: {
            rating,
            quality,  // legacy
            flashcard_id,
            interval: scheduled.scheduled_days,
            stability: scheduled.fsrs_stability,
            difficulty: scheduled.fsrs_difficulty,
            state: scheduled.fsrs_state,
          },
          created_at: new Date().toISOString(),
        });
      } catch { /* table may not exist */ }

      return NextResponse.json({
        success: true,
        interval: scheduled.scheduled_days,
        nextReview: scheduled.next_review_at,
        stability: scheduled.fsrs_stability,
        difficulty: scheduled.fsrs_difficulty,
        state: scheduled.fsrs_state,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Flashcards POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
