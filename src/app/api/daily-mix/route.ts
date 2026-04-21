import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { buildStudentState, decideAdaptation } from '@/lib/student-state';
import { pickInterventionForMoment } from '@/lib/intervention-engine';
import { recordMethodOutcome } from '@/lib/method-calibration';
import { loadActiveDirectives, adaptationDelta } from '@/lib/directive-adapter';
import { getDifficultyBias } from '@/lib/signal-aggregator';

// State-aware reflection prompts — different prompts for different student states
const REFLECTION_PROMPTS = {
  // When student is doing well — push them to think deeper
  growth: [
    'What mistake did you make recently that taught you something?',
    'What is one thing you found difficult this week but kept trying?',
    'How have you improved in a subject compared to last month?',
    'What would you teach a younger student about what you learned today?',
  ],
  // When student is struggling — build confidence
  confidence: [
    'What is something you understand now that you didn\'t understand a month ago?',
    'What moment this week made you feel proud of yourself?',
    'Name one thing you\'re getting better at, even slowly.',
    'What\'s a problem you solved recently that felt really good?',
  ],
  // When student is frustrated — acknowledge and redirect
  frustration: [
    'Learning hard things is uncomfortable. What\'s one small win you can celebrate today?',
    'Even experts struggle. What\'s one thing you tried hard on recently?',
    'What would you tell a friend who was stuck on the same problem?',
    'What part of today\'s learning went well, even if other parts were tough?',
  ],
  // When student is bored — spark curiosity
  curiosity: [
    'What is one question you had today that you want to explore?',
    'If you could learn about anything in the world, what would it be?',
    'What surprised you while studying recently?',
    'What would happen if you could combine two subjects you\'re learning?',
  ],
  // General
  gratitude: [
    'What are 3 things you are thankful for today?',
    'Who helped you learn something new recently? How did that feel?',
    'What is one thing about your school that you appreciate?',
  ],
  emotion: [
    'How are you feeling about your learning today? Why?',
    'When did you feel most focused and "in the zone" recently?',
    'What part of learning feels easiest right now? What feels hardest?',
  ],
  goal: [
    'What is one small goal you want to achieve by the end of this week?',
    'What subject do you want to spend more time on? Why?',
    'If you could master one topic perfectly, which one would you choose?',
  ],
};

/**
 * Choose reflection prompt based on student state — not random.
 */
function getAdaptiveReflectionPrompt(studentState?: any): { type: string; prompt: string } {
  let type: string;

  if (!studentState) {
    // No state = random
    const types = Object.keys(REFLECTION_PROMPTS);
    type = types[Math.floor(Math.random() * types.length)];
  } else if (studentState.frustrationLevel > 5) {
    type = 'frustration';
  } else if (studentState.confidenceLevel < 4) {
    type = 'confidence';
  } else if (studentState.currentMood === 'bored' || studentState.prefersChallenge) {
    type = 'curiosity';
  } else if (studentState.confidenceLevel > 7) {
    type = 'growth';
  } else {
    // Weighted random from non-extreme types
    const normalTypes = ['gratitude', 'emotion', 'goal', 'growth', 'curiosity'];
    type = normalTypes[Math.floor(Math.random() * normalTypes.length)];
  }

  const prompts = REFLECTION_PROMPTS[type as keyof typeof REFLECTION_PROMPTS] || REFLECTION_PROMPTS.growth;
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

    // Build live student state — drives all adaptation decisions
    let studentState;
    let adaptation;
    try {
      studentState = await buildStudentState(supabase, user.id);
      adaptation = decideAdaptation(studentState);
    } catch {
      studentState = null;
      adaptation = null;
    }

    // Build a new daily mix — ADAPTED to the student's current state

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

    // 4. Reflection prompt — adapted to student's emotional state
    const reflection = getAdaptiveReflectionPrompt(studentState);

    // 5. Challenge item — matched to student's level, not just latest question
    // If student is struggling, give easier questions. If strong, push harder.
    let challengeQuery = supabase
      .from('questions')
      .select('id, question_text, options, correct_answer, explanation, subject_id, topic_id, difficulty')
      .eq('question_type', 'mcq');

    // Main-brain directives override base adaptation for today's challenge
    const directives = await loadActiveDirectives(supabase, user.id);
    const delta = adaptationDelta(directives);

    // Student's own "too easy / too hard" thumb from recent challenges. Only
    // nudges when the student state + main-brain are neutral — explicit
    // directives still take precedence because the main brain sees more
    // context than a handful of thumb taps.
    const diffBias = await getDifficultyBias(supabase, user.id).catch(() => ({
      direction: 'same' as const, samples: 0, avg: 0.5,
    }));

    // Effective intent after applying main-brain delta
    let effectiveSimplify = adaptation?.shouldSimplify || delta.difficultyAdjust < 0;
    let effectiveChallenge = adaptation?.shouldChallenge && delta.difficultyAdjust >= 0;

    // Student-voice override: only apply when upstream signals are neutral so
    // we don't fight an explicit main-brain decision.
    const upstreamNeutral = !effectiveSimplify && !effectiveChallenge && delta.difficultyAdjust === 0;
    if (upstreamNeutral && diffBias.samples >= 3) {
      if (diffBias.direction === 'easier') effectiveSimplify = true;
      else if (diffBias.direction === 'harder') effectiveChallenge = true;
    }

    if (effectiveSimplify) {
      challengeQuery = challengeQuery.in('difficulty', ['easy', 'medium']);
    } else if (effectiveChallenge || delta.difficultyAdjust > 0) {
      challengeQuery = challengeQuery.in('difficulty', ['medium', 'hard']);
    }

    // Try to match the student's weakest subject for targeted practice
    if (studentState) {
      const weakestSubject = Object.values(studentState.subjectStates)
        .filter(s => s.accuracyTrend === 'declining' || s.recentAccuracy < 0.5)
        .sort((a, b) => a.recentAccuracy - b.recentAccuracy)[0];
      if (weakestSubject) {
        challengeQuery = challengeQuery.eq('subject_id', weakestSubject.subjectId);
      }
    }

    const { data: challengeItem } = await challengeQuery
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const spacedRepItemsList = spacedRepItems || [];

    // Pick a targeted intervention to weave into today's mix
    let intervention = null;
    if (studentState) {
      intervention = pickInterventionForMoment(studentState, 'daily_mix_start');
    }

    // Insert the mix into daily_mix_sessions — with adaptation metadata
    const { data: session, error: insertError } = await supabase
      .from('daily_mix_sessions')
      .insert({
        user_id: user.id,
        session_date: today,
        status: 'not_started',
        spaced_rep_items: spacedRepItemsList,
        new_concept: newConcept || null,
        habit_check: habitCheck || null,
        reflection_prompt: {
          ...reflection,
          // Include adaptation context so frontend can adjust UI
          student_mood: studentState?.currentMood || 'neutral',
          encouragement_level: delta.encouragementIntensity || adaptation?.encouragementLevel || 'moderate',
          adaptation_reason: adaptation?.reason || null,
          brain_directives_applied: delta.applied.length,
          brain_directive_reasons: delta.applied.slice(0, 3).map((d) => d.reason),
          celebrate_breakthroughs: delta.mustMentionBreakthroughs,
          intervention: intervention ? {
            id: intervention.id,
            title: intervention.title,
            hook: intervention.hook,
            correction: intervention.correction,
            counterExample: intervention.counterExample,
            practicePrompt: intervention.practicePrompt,
            estimatedSeconds: intervention.estimatedSeconds,
          } : null,
        },
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
        // Update retrieval queue items if ratings are provided — parallelized
        if (actionData?.ratings && Array.isArray(actionData.ratings)) {
          const ratings = actionData.ratings;
          const multipliers: Record<number, number> = { 0: 0.5, 1: 1, 2: 1.5, 3: 2.5 };
          await Promise.all(ratings.map(async (rating: any) => {
            try {
              const { item_id, quality } = rating;
              if (!item_id) return;
              const multiplier = multipliers[quality] || 1;
              const { data: item } = await supabase
                .from('retrieval_queue')
                .select('interval_days, ease_factor')
                .eq('id', item_id)
                .maybeSingle();
              if (!item) return;
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
            } catch (err) {
              console.error('Retrieval update failed (non-fatal):', err);
            }
          }));
        }
        updates = {
          spaced_rep_completed: actionData?.ratings?.length || session.spaced_rep_completed || 0,
        };
        break;

      case 'complete_concept':
        updates = { new_concept_completed: true };
        break;

      case 'complete_habit':
        // Record habit completion into the canonical habit_completions table.
        // We upsert so repeating this action on the same day is idempotent.
        if (actionData?.habit_id && actionData?.completed) {
          const today = getTodayDateString();
          try {
            await supabase
              .from('habit_completions')
              .upsert({
                user_id: user.id,
                habit_id: actionData.habit_id,
                completed_on: today,
                note: actionData.notes || null,
              }, { onConflict: 'user_id,habit_id,completed_on' });
            // Bump the student_habits streak
            const { data: habit } = await supabase
              .from('student_habits')
              .select('current_streak, longest_streak, last_completed_on')
              .eq('id', actionData.habit_id)
              .eq('user_id', user.id)
              .maybeSingle();
            if (habit) {
              // Only increment if we didn't already complete today
              const alreadyToday = habit.last_completed_on === today;
              const newStreak = alreadyToday ? (habit.current_streak || 0) : (habit.current_streak || 0) + 1;
              const newLongest = Math.max(habit.longest_streak || 0, newStreak);
              await supabase
                .from('student_habits')
                .update({
                  current_streak: newStreak,
                  longest_streak: newLongest,
                  last_completed_on: today,
                })
                .eq('id', actionData.habit_id)
                .eq('user_id', user.id);
            }
          } catch (err) {
            console.error('Habit completion failed (non-fatal):', err);
          }
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

        // Update user_stats.total_xp — upsert so first-time users don't lose XP
        try {
          const { data: stats } = await supabase
            .from('user_stats')
            .select('total_xp, current_streak, last_activity_date')
            .eq('user_id', user.id)
            .maybeSingle();

          const today = getTodayDateString();
          const prevTotal = stats?.total_xp || 0;
          const prevStreak = stats?.current_streak || 0;
          // Only increment streak if this is a new day (prevents double-count)
          const incrementStreak = stats?.last_activity_date !== today;

          await supabase
            .from('user_stats')
            .upsert({
              user_id: user.id,
              total_xp: prevTotal + xpEarned,
              current_streak: incrementStreak ? prevStreak + 1 : prevStreak,
              last_activity_date: today,
            }, { onConflict: 'user_id' });
        } catch (err) {
          console.error('user_stats update failed (non-fatal):', err);
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

        // Record method outcome for calibration — behavioral, not self-report
        try {
          const challenge = session.challenge_item || {};
          const subjectId = challenge.subject_id;
          const topicId = challenge.topic_id;
          const reflection = session.reflection_prompt || {};
          const methodUsed = reflection.intervention?.method || 'daily_mix';

          if (subjectId) {
            // Behavioral effectiveness composite:
            // - did they complete? (engagement)
            // - did they get the challenge right? (accuracy delta proxy)
            // - how many steps did they finish? (persistence)
            const completionScore = completedCount / 5;
            const accuracyDelta = challenge.correct ? 0.3 : challenge.correct === false ? -0.2 : 0;
            const sessionStart = session.started_at ? new Date(session.started_at).getTime() : Date.now();
            const timeSpentSeconds = Math.max(60, Math.round((Date.now() - sessionStart) / 1000));

            await recordMethodOutcome(supabase, {
              userId: user.id,
              subjectId,
              topicId,
              method: methodUsed,
              accuracyDelta,
              completed: completedCount >= 4,
              timeSpentSeconds,
              engagementScore: completionScore,
            });
          }
        } catch (err) {
          console.error('Method outcome recording failed (non-fatal):', err);
        }

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
