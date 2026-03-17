import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// Hardcoded age-appropriate reflection prompts by type
const REFLECTION_PROMPTS = {
  gratitude: [
    'What are 3 things you are thankful for today?',
    'Who helped you learn something new recently? How did that feel?',
    'What is one thing about your school that you appreciate?',
  ],
  growth: [
    'What mistake did you make recently that taught you something?',
    'What is one thing you found difficult this week but kept trying?',
    'How have you improved in a subject compared to last month?',
  ],
  curiosity: [
    'What is one question you had today that you want to explore?',
    'If you could learn about anything in the world, what would it be?',
    'What surprised you while studying recently?',
  ],
  emotion: [
    'How are you feeling about your learning today? Why?',
    'What moment this week made you feel proud of yourself?',
    'When did you feel most focused and "in the zone" recently?',
  ],
  goal: [
    'What is one small goal you want to achieve by the end of this week?',
    'What subject do you want to spend more time on? Why?',
    'If you could master one topic perfectly, which one would you choose?',
  ],
};

function getRandomReflectionPrompt(): { type: string; prompt: string } {
  const types = Object.keys(REFLECTION_PROMPTS) as Array<keyof typeof REFLECTION_PROMPTS>;
  const type = types[Math.floor(Math.random() * types.length)];
  const prompts = REFLECTION_PROMPTS[type];
  const prompt = prompts[Math.floor(Math.random() * prompts.length)];
  return { type, prompt };
}

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

export async function GET(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = getTodayDateString();

    // Check if a daily mix session already exists for today
    const { data: existingSession } = await supabase
      .from('daily_mix_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('session_date', today)
      .single();

    if (existingSession) {
      return NextResponse.json({ success: true, data: existingSession });
    }

    // Build a new daily mix

    // 1. Spaced repetition items (3-5)
    const { data: spacedRepItems } = await supabase
      .from('retrieval_queue')
      .select(`
        id,
        topic_id,
        question_text,
        answer,
        item_type,
        next_review_at,
        interval_days,
        ease_factor,
        topics ( title )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .lte('next_review_at', new Date().toISOString())
      .order('next_review_at', { ascending: true })
      .limit(5);

    // 2. New concept — next uncompleted topic
    const { data: newConcept } = await supabase
      .from('learner_state')
      .select(`
        id,
        topic_id,
        current_band,
        last_active_at,
        topics ( id, title, description, subject_id )
      `)
      .eq('user_id', user.id)
      .in('current_band', ['foundation', 'emerging'])
      .order('last_active_at', { ascending: true })
      .limit(1)
      .single();

    // 3. Habit check — one random active habit
    const { data: habits } = await supabase
      .from('student_habits')
      .select(`
        id,
        habit_id,
        is_active,
        current_streak,
        longest_streak,
        habit_definitions ( name, description, frequency, icon )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true);

    const habitCheck = habits && habits.length > 0
      ? habits[Math.floor(Math.random() * habits.length)]
      : null;

    // 4. Reflection prompt
    const reflection = getRandomReflectionPrompt();

    // 5. Challenge item — a quick question matching student's subjects
    const { data: challengeItem } = await supabase
      .from('questions')
      .select('id, question_text, options, correct_answer, explanation, subject_id, topic_id')
      .eq('question_type', 'mcq')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const spacedRepItemsList = spacedRepItems || [];

    // Insert the mix into daily_mix_sessions using individual columns
    const { data: session, error: insertError } = await supabase
      .from('daily_mix_sessions')
      .insert({
        user_id: user.id,
        session_date: today,
        status: 'not_started',
        spaced_rep_items: spacedRepItemsList,
        new_concept: newConcept || null,
        habit_check: habitCheck || null,
        reflection_prompt: reflection,
        challenge_item: challengeItem || null,
        spaced_rep_total: spacedRepItemsList.length,
        spaced_rep_completed: 0,
        new_concept_completed: false,
        habit_checked: false,
        reflection_done: false,
        challenge_done: false,
        xp_earned: 0,
        started_at: null,
        completed_at: null,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ success: true, data: session });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, success: false }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, session_id, data: actionData } = body;

    if (!action || !session_id) {
      return NextResponse.json(
        { error: 'action and session_id are required' },
        { status: 400 }
      );
    }

    // Fetch current session
    const { data: session, error: fetchError } = await supabase
      .from('daily_mix_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    let updates: Record<string, any> = {};

    switch (action) {
      case 'start':
        updates = {
          status: 'in_progress',
          started_at: new Date().toISOString(),
        };
        break;

      case 'complete_spaced_rep':
        // Update retrieval queue items if ratings are provided
        if (actionData?.ratings && Array.isArray(actionData.ratings)) {
          for (const rating of actionData.ratings) {
            const { item_id, quality } = rating;
            // quality: 0=forgot, 1=hard, 2=good, 3=easy
            const multipliers: Record<number, number> = { 0: 0.5, 1: 1, 2: 1.5, 3: 2.5 };
            const multiplier = multipliers[quality] || 1;

            const { data: item } = await supabase
              .from('retrieval_queue')
              .select('interval_days, ease_factor')
              .eq('id', item_id)
              .single();

            if (item) {
              const newInterval = Math.max(1, Math.round((item.interval_days || 1) * multiplier));
              const newEase = Math.max(1.3, (item.ease_factor || 2.5) + (quality - 2) * 0.1);
              const nextReview = new Date();
              nextReview.setDate(nextReview.getDate() + newInterval);

              await supabase
                .from('retrieval_queue')
                .update({
                  interval_days: newInterval,
                  ease_factor: newEase,
                  next_review_at: nextReview.toISOString(),
                  last_reviewed_at: new Date().toISOString(),
                  last_quality: quality,
                })
                .eq('id', item_id);
            }
          }
        }
        updates = {
          spaced_rep_completed: actionData?.ratings?.length || session.spaced_rep_completed || 0,
        };
        break;

      case 'complete_concept':
        updates = { new_concept_completed: true };
        break;

      case 'complete_habit':
        // Record habit completion if provided
        if (actionData?.habit_id && actionData?.completed !== undefined) {
          await supabase
            .from('habit_tracking')
            .insert({
              user_id: user.id,
              habit_id: actionData.habit_id,
              date: getTodayDateString(),
              completed: actionData.completed,
              notes: actionData.notes || null,
            });
        }
        updates = { habit_checked: true };
        break;

      case 'complete_reflection':
        // Store reflection response in reflection_prompt JSONB
        if (actionData?.response) {
          const reflectionPrompt = session.reflection_prompt || {};
          reflectionPrompt.response = actionData.response;
          updates = { reflection_done: true, reflection_prompt: reflectionPrompt };
        } else {
          updates = { reflection_done: true };
        }
        break;

      case 'complete_challenge':
        // Store answer in challenge_item JSONB
        if (actionData?.answer !== undefined) {
          const challengeItem = session.challenge_item || {};
          challengeItem.student_answer = actionData.answer;
          challengeItem.correct = actionData.correct || false;
          updates = { challenge_done: true, challenge_item: challengeItem };
        } else {
          updates = { challenge_done: true };
        }
        break;

      case 'finish': {
        // Count completed steps
        let completedCount = 0;
        if (session.spaced_rep_completed > 0) completedCount++;
        if (session.new_concept_completed) completedCount++;
        if (session.habit_checked) completedCount++;
        if (session.reflection_done) completedCount++;
        if (session.challenge_done) completedCount++;

        // Calculate XP earned
        let xpEarned = 25; // base XP
        if (completedCount >= 5) xpEarned += 15; // completion bonus
        if (completedCount >= 3) xpEarned += 5;  // partial bonus
        // Bonus for challenge correct
        const challengeItem = session.challenge_item || {};
        if (challengeItem.correct) xpEarned += 10;

        updates = {
          status: 'completed',
          completed_at: new Date().toISOString(),
          xp_earned: xpEarned,
        };

        // Update user_stats.total_xp
        const { data: stats } = await supabase
          .from('user_stats')
          .select('total_xp, current_streak')
          .eq('user_id', user.id)
          .single();

        if (stats) {
          await supabase
            .from('user_stats')
            .update({
              total_xp: (stats.total_xp || 0) + xpEarned,
              current_streak: (stats.current_streak || 0) + 1,
              last_activity_date: getTodayDateString(),
            })
            .eq('user_id', user.id);
        }

        // Insert xp_events record
        await supabase
          .from('xp_events')
          .insert({
            user_id: user.id,
            source_pillar: 'engagement',
            source_action: 'daily_mix_completed',
            source_id: session_id,
            xp_amount: xpEarned,
            description: `Daily Mix completed with ${completedCount}/5 steps`,
          });

        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    // Update session
    const { data: updatedSession, error: updateError } = await supabase
      .from('daily_mix_sessions')
      .update(updates)
      .eq('id', session_id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, data: updatedSession });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, success: false }, { status: 500 });
  }
}
