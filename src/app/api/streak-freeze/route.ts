import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

const MAX_STORED_FREEZES = 3;
const STREAK_FREEZE_INTERVAL = 7; // Earn a freeze every 7-day streak multiple

/**
 * GET /api/streak-freeze
 * Returns user's streak freeze status for all active habits.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch all active habits for the user
    const { data: habits, error } = await supabase
      .from('student_habits')
      .select('id, current_streak, streak_freezes_available, streak_freezes_used, last_freeze_date, habit_definitions(name)')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching habits:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch habits' },
        { status: 500 }
      );
    }

    const habitData = (habits || []).map((h: any) => ({
      habit_id: h.id,
      name: h.habit_definitions?.name || 'Habit',
      current_streak: h.current_streak || 0,
      freezes_available: h.streak_freezes_available || 0,
      freezes_used: h.streak_freezes_used || 0,
      last_freeze_date: h.last_freeze_date || null,
    }));

    return NextResponse.json({
      success: true,
      data: { habits: habitData },
    });
  } catch (error) {
    console.error('Streak Freeze GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch streak freeze data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/streak-freeze
 * Actions:
 * - use_freeze: Use a streak freeze for a specific habit
 * - earn_freeze: Award a freeze when a habit hits a 7-day streak multiple
 */
export async function POST(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, habit_id } = body;

    if (!action || !habit_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: action, habit_id' },
        { status: 400 }
      );
    }

    // Fetch the habit
    const { data: habit, error: habitError } = await supabase
      .from('student_habits')
      .select('*')
      .eq('id', habit_id)
      .eq('user_id', user.id)
      .single();

    if (habitError || !habit) {
      return NextResponse.json(
        { success: false, error: 'Habit not found' },
        { status: 404 }
      );
    }

    if (action === 'use_freeze') {
      return await handleUseFreeze(supabase, user.id, habit);
    } else if (action === 'earn_freeze') {
      return await handleEarnFreeze(supabase, user.id, habit);
    } else {
      return NextResponse.json(
        { success: false, error: `Unknown action: ${action}` },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Streak Freeze POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process streak freeze action' },
      { status: 500 }
    );
  }
}

async function handleUseFreeze(supabase: any, userId: string, habit: any) {
  const freezesAvailable = habit.streak_freezes_available || 0;

  // Check: has freezes available
  if (freezesAvailable <= 0) {
    return NextResponse.json(
      { success: false, error: 'No streak freezes available for this habit' },
      { status: 400 }
    );
  }

  // Check: hasn't used one today
  const today = new Date().toISOString().split('T')[0];
  if (habit.last_freeze_date === today) {
    return NextResponse.json(
      { success: false, error: 'Already used a streak freeze today for this habit' },
      { status: 400 }
    );
  }

  // Use the freeze: decrement available, increment used, set last_freeze_date
  const { error: updateError } = await supabase
    .from('student_habits')
    .update({
      streak_freezes_available: freezesAvailable - 1,
      streak_freezes_used: (habit.streak_freezes_used || 0) + 1,
      last_freeze_date: today,
    })
    .eq('id', habit.id);

  if (updateError) {
    console.error('Error using streak freeze:', updateError);
    return NextResponse.json(
      { success: false, error: 'Failed to use streak freeze' },
      { status: 500 }
    );
  }

  // Log the freeze usage
  await supabase.from('streak_freeze_log').insert({
    user_id: userId,
    habit_id: habit.id,
    action: 'used',
    streak_at_time: habit.current_streak || 0,
  });

  return NextResponse.json({
    success: true,
    data: {
      message: 'Streak freeze used successfully',
      freezes_remaining: freezesAvailable - 1,
      streak_preserved: habit.current_streak || 0,
    },
  });
}

async function handleEarnFreeze(supabase: any, userId: string, habit: any) {
  const freezesAvailable = habit.streak_freezes_available || 0;
  const currentStreak = habit.current_streak || 0;

  // Check: max 3 stored
  if (freezesAvailable >= MAX_STORED_FREEZES) {
    return NextResponse.json({
      success: true,
      data: {
        message: 'Already at maximum streak freezes',
        freezes_available: freezesAvailable,
      },
    });
  }

  // Check: streak is a multiple of STREAK_FREEZE_INTERVAL
  if (currentStreak <= 0 || currentStreak % STREAK_FREEZE_INTERVAL !== 0) {
    return NextResponse.json(
      { success: false, error: `Freeze earned only at ${STREAK_FREEZE_INTERVAL}-day streak multiples` },
      { status: 400 }
    );
  }

  const newFreezes = Math.min(freezesAvailable + 1, MAX_STORED_FREEZES);

  const { error: updateError } = await supabase
    .from('student_habits')
    .update({
      streak_freezes_available: newFreezes,
    })
    .eq('id', habit.id);

  if (updateError) {
    console.error('Error earning streak freeze:', updateError);
    return NextResponse.json(
      { success: false, error: 'Failed to earn streak freeze' },
      { status: 500 }
    );
  }

  // Log the freeze earn
  await supabase.from('streak_freeze_log').insert({
    user_id: userId,
    habit_id: habit.id,
    action: 'earned',
    streak_at_time: currentStreak,
  });

  return NextResponse.json({
    success: true,
    data: {
      message: 'Streak freeze earned!',
      freezes_available: newFreezes,
      streak: currentStreak,
    },
  });
}
