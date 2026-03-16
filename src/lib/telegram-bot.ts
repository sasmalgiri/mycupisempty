// ============================================================================
// Telegram Bot Integration
// ============================================================================

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

/**
 * Send a message to a Telegram chat
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
  parseMode = 'HTML'
): Promise<boolean> {
  try {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Telegram API error:', errorData);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return false;
  }
}

/**
 * Format a daily study reminder message
 */
export function formatDailyReminder(
  studentName: string,
  streak: number,
  pendingHabits: number
): string {
  const greeting = getTimeGreeting();
  let message = `<b>${greeting}, ${studentName}!</b>\n\n`;

  if (streak > 0) {
    message += `You're on a <b>${streak}-day streak</b>! Don't break it today.\n\n`;
  } else {
    message += `Start a new streak today! Every day counts.\n\n`;
  }

  if (pendingHabits > 0) {
    message += `You have <b>${pendingHabits} habit${pendingHabits > 1 ? 's' : ''}</b> to complete today.\n`;
  }

  message += `\nOpen MyCupIsEmpty to continue learning!`;
  return message;
}

/**
 * Format a streak warning message (when a streak is about to break)
 */
export function formatStreakWarning(
  studentName: string,
  habitName: string,
  streak: number
): string {
  return (
    `<b>Streak Alert!</b>\n\n` +
    `Hey ${studentName}, your <b>${streak}-day streak</b> for "<b>${habitName}</b>" is about to break!\n\n` +
    `You still have time to complete it today. Don't lose your progress!\n\n` +
    `Tip: You can use a <b>Streak Freeze</b> if you need a day off.`
  );
}

/**
 * Weekly digest data structure
 */
export interface WeeklyDigestData {
  studentName: string;
  totalXP: number;
  xpGained: number;
  level: number;
  streakDays: number;
  habitsCompleted: number;
  totalHabits: number;
  topSubject: string;
  studyMinutes: number;
  achievements: string[];
}

/**
 * Format a weekly digest message
 */
export function formatWeeklyDigest(data: WeeklyDigestData): string {
  let message = `<b>Weekly Digest for ${data.studentName}</b>\n\n`;

  message += `<b>XP & Level</b>\n`;
  message += `Level ${data.level} | +${data.xpGained} XP this week | ${data.totalXP} total\n\n`;

  message += `<b>Habits</b>\n`;
  message += `${data.habitsCompleted}/${data.totalHabits} completed | ${data.streakDays}-day streak\n\n`;

  message += `<b>Study Time</b>\n`;
  message += `${data.studyMinutes} minutes this week\n`;

  if (data.topSubject) {
    message += `Top subject: ${data.topSubject}\n`;
  }

  if (data.achievements.length > 0) {
    message += `\n<b>Achievements Unlocked</b>\n`;
    for (const achievement of data.achievements) {
      message += `- ${achievement}\n`;
    }
  }

  message += `\nKeep going! Open MyCupIsEmpty for details.`;
  return message;
}

/**
 * Format a concern alert message (for parents/teachers)
 */
export function formatConcernAlert(
  studentName: string,
  concernType: string,
  details: string
): string {
  const typeLabels: Record<string, string> = {
    low_engagement: 'Low Engagement',
    streak_broken: 'Streak Broken',
    declining_performance: 'Declining Performance',
    missed_sessions: 'Missed Sessions',
    emotional_flag: 'Emotional Well-being',
  };

  const label = typeLabels[concernType] || concernType;

  return (
    `<b>Concern Flag: ${label}</b>\n\n` +
    `Student: <b>${studentName}</b>\n\n` +
    `${details}\n\n` +
    `This is an automated alert from MyCupIsEmpty. Please check in with the student when possible.`
  );
}

/**
 * Get a time-appropriate greeting
 */
function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
