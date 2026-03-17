import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import {
  sendTelegramMessage,
  formatDailyReminder,
  formatWeeklyDigest,
  type WeeklyDigestData,
} from '@/lib/telegram-bot';

/**
 * GET /api/notifications/telegram
 * Returns user's Telegram notification subscription status.
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

    const { data: subscription } = await supabase
      .from('notification_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('channel', 'telegram')
      .single();

    if (!subscription) {
      return NextResponse.json({
        success: true,
        data: {
          linked: false,
          telegram_chat_id: null,
          notification_types: null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        linked: true,
        telegram_chat_id: (subscription as any).channel_id,
        notification_types: (subscription as any).notification_types || [
          'daily_reminder',
          'streak_warning',
          'concern_flag',
          'weekly_digest',
        ],
        quiet_hours: {
          start: (subscription as any).quiet_hours_start,
          end: (subscription as any).quiet_hours_end,
        },
      },
    });
  } catch (error) {
    console.error('Telegram GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notification status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications/telegram
 * Actions: link, unlink, send_test, send_reminder, send_digest, update_preferences
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
    const { action } = body;

    switch (action) {
      case 'link':
        return await handleLink(supabase, user.id, body);
      case 'unlink':
        return await handleUnlink(supabase, user.id);
      case 'send_test':
        return await handleSendTest(supabase, user.id);
      case 'send_reminder':
        return await handleSendReminder(supabase, user.id);
      case 'send_digest':
        return await handleSendDigest(supabase, user.id);
      case 'update_preferences':
        return await handleUpdatePreferences(supabase, user.id, body);
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Telegram POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process notification action' },
      { status: 500 }
    );
  }
}

async function handleLink(supabase: any, userId: string, body: any) {
  const { telegram_chat_id } = body;

  if (!telegram_chat_id) {
    return NextResponse.json(
      { success: false, error: 'Missing telegram_chat_id' },
      { status: 400 }
    );
  }

  // Upsert the subscription
  const { error } = await supabase.from('notification_subscriptions').upsert(
    {
      user_id: userId,
      channel: 'telegram',
      channel_id: telegram_chat_id,
      is_active: true,
      notification_types: ["daily_reminder", "streak_warning", "concern_flag", "weekly_digest"],
    },
    { onConflict: 'user_id,channel' }
  );

  if (error) {
    console.error('Error linking Telegram:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to link Telegram account' },
      { status: 500 }
    );
  }

  // Send a confirmation message
  await sendTelegramMessage(
    telegram_chat_id,
    '<b>MyCupIsEmpty Connected!</b>\n\nYour Telegram account is now linked. You will receive study reminders and progress updates here.'
  );

  return NextResponse.json({
    success: true,
    data: { message: 'Telegram account linked successfully' },
  });
}

async function handleUnlink(supabase: any, userId: string) {
  const { error } = await supabase
    .from('notification_subscriptions')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('channel', 'telegram');

  if (error) {
    console.error('Error unlinking Telegram:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to unlink Telegram account' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: { message: 'Telegram account unlinked' },
  });
}

async function handleSendTest(supabase: any, userId: string) {
  // Get the user's subscription
  const { data: subscription } = await supabase
    .from('notification_subscriptions')
    .select('channel_id')
    .eq('user_id', userId)
    .eq('channel', 'telegram')
    .eq('is_active', true)
    .single();

  if (!subscription?.channel_id) {
    return NextResponse.json(
      { success: false, error: 'No active Telegram subscription found' },
      { status: 400 }
    );
  }

  const sent = await sendTelegramMessage(
    subscription.channel_id,
    '<b>Test Message</b>\n\nThis is a test notification from MyCupIsEmpty. If you see this, your Telegram notifications are working!'
  );

  if (!sent) {
    return NextResponse.json(
      { success: false, error: 'Failed to send test message. Check your chat ID.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: { message: 'Test message sent!' },
  });
}

async function handleSendReminder(supabase: any, userId: string) {
  // Fetch user subscription
  const { data: subscription } = await supabase
    .from('notification_subscriptions')
    .select('channel_id, notification_types, quiet_hours_start, quiet_hours_end')
    .eq('user_id', userId)
    .eq('channel', 'telegram')
    .eq('is_active', true)
    .single();

  if (!subscription?.channel_id) {
    return NextResponse.json({
      success: false,
      error: 'No active Telegram subscription',
    });
  }

  // Check quiet hours
  if (isInQuietHours(subscription.quiet_hours_start, subscription.quiet_hours_end)) {
    return NextResponse.json({
      success: true,
      data: { message: 'Skipped - quiet hours active' },
    });
  }

  // Check if daily reminders are enabled
  if (!(subscription.notification_types || []).includes('daily_reminder')) {
    return NextResponse.json({
      success: true,
      data: { message: 'Skipped - daily reminders disabled' },
    });
  }

  // Fetch user profile for name
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .single();

  // Fetch streak and pending habits
  const { data: stats } = await supabase
    .from('user_stats')
    .select('current_streak')
    .eq('user_id', userId)
    .single();

  const { count: activeHabits } = await supabase
    .from('student_habits')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_active', true);

  const message = formatDailyReminder(
    profile?.full_name || 'Student',
    stats?.current_streak || 0,
    activeHabits || 0
  );

  const sent = await sendTelegramMessage(subscription.channel_id, message);

  return NextResponse.json({
    success: sent,
    data: { message: sent ? 'Reminder sent' : 'Failed to send reminder' },
  });
}

async function handleSendDigest(supabase: any, userId: string) {
  const { data: subscription } = await supabase
    .from('notification_subscriptions')
    .select('channel_id, notification_types')
    .eq('user_id', userId)
    .eq('channel', 'telegram')
    .eq('is_active', true)
    .single();

  if (
    !subscription?.channel_id ||
    !(subscription.notification_types || []).includes('weekly_digest')
  ) {
    return NextResponse.json({
      success: true,
      data: { message: 'Skipped - weekly digest disabled or no subscription' },
    });
  }

  // Fetch data for digest
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .single();

  const { data: stats } = await supabase
    .from('user_stats')
    .select('total_xp, level, current_streak')
    .eq('user_id', userId)
    .single();

  // Get XP gained this week
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const { data: weekEvents } = await supabase
    .from('xp_events')
    .select('xp_amount')
    .eq('user_id', userId)
    .gte('created_at', oneWeekAgo.toISOString());

  const xpGained = (weekEvents || []).reduce(
    (sum: number, e: any) => sum + (e.xp_amount || 0),
    0
  );

  const digestData: WeeklyDigestData = {
    studentName: profile?.full_name || 'Student',
    totalXP: stats?.total_xp || 0,
    xpGained,
    level: stats?.level || 1,
    streakDays: stats?.current_streak || 0,
    habitsCompleted: 0,
    totalHabits: 0,
    topSubject: '',
    studyMinutes: 0,
    achievements: [],
  };

  const message = formatWeeklyDigest(digestData);
  const sent = await sendTelegramMessage(subscription.channel_id, message);

  return NextResponse.json({
    success: sent,
    data: { message: sent ? 'Digest sent' : 'Failed to send digest' },
  });
}

async function handleUpdatePreferences(
  supabase: any,
  userId: string,
  body: any
) {
  const { notification_types, quiet_hours_start, quiet_hours_end } = body;

  const updates: Record<string, any> = {};

  if (notification_types !== undefined) {
    updates.notification_types = notification_types;
  }

  if (quiet_hours_start !== undefined) {
    updates.quiet_hours_start = quiet_hours_start;
  }

  if (quiet_hours_end !== undefined) {
    updates.quiet_hours_end = quiet_hours_end;
  }

  const { error } = await supabase
    .from('notification_subscriptions')
    .update(updates)
    .eq('user_id', userId)
    .eq('channel', 'telegram');

  if (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to update preferences' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: { message: 'Preferences updated' },
  });
}

function isInQuietHours(
  quietHoursStart: number | null,
  quietHoursEnd: number | null
): boolean {
  if (quietHoursStart == null || quietHoursEnd == null) return false;

  const currentHour = new Date().getHours();

  if (quietHoursStart <= quietHoursEnd) {
    // Same-day range (e.g., 9 - 17)
    return currentHour >= quietHoursStart && currentHour < quietHoursEnd;
  } else {
    // Overnight range (e.g., 22 - 7)
    return currentHour >= quietHoursStart || currentHour < quietHoursEnd;
  }
}
