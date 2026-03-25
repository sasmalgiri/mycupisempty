import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

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

    // Get user profile for class level
    const { data: profile } = await supabase
      .from('profiles')
      .select('class_level')
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

    return NextResponse.json({ cards, classLevel: profile?.class_level || 8 });
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
      // quality: 0=again, 1=hard, 3=good, 5=easy (SM-2 scale)

      // Get current progress
      const { data: prog } = await supabase
        .from('user_flashcard_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('flashcard_id', flashcard_id)
        .single();

      if (!prog) {
        // Create new progress entry
        await supabase
          .from('user_flashcard_progress')
          .insert({
            user_id: user.id,
            flashcard_id,
            easiness_factor: 2.5,
            interval_days: 1,
            repetitions: 0,
            next_review_date: new Date().toISOString().split('T')[0],
          });
      }

      const ef = parseFloat(prog?.easiness_factor || '2.5');
      const reps = prog?.repetitions || 0;

      // SM-2 algorithm
      let newEF = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
      newEF = Math.max(1.3, newEF);

      let interval = 1;
      let newReps = reps;
      if (quality >= 3) {
        newReps = reps + 1;
        if (newReps === 1) interval = 1;
        else if (newReps === 2) interval = 6;
        else interval = Math.round((prog?.interval_days || 1) * newEF);
      } else {
        newReps = 0;
        interval = 1;
      }

      const nextReview = new Date();
      nextReview.setDate(nextReview.getDate() + interval);

      await supabase
        .from('user_flashcard_progress')
        .upsert({
          user_id: user.id,
          flashcard_id,
          easiness_factor: Math.round(newEF * 100) / 100,
          interval_days: interval,
          repetitions: newReps,
          next_review_date: nextReview.toISOString().split('T')[0],
          last_review_date: new Date().toISOString().split('T')[0],
        }, { onConflict: 'user_id,flashcard_id' });

      return NextResponse.json({ success: true, interval, newEF, repetitions: newReps });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Flashcards POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
