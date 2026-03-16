// ============================================================================
// Unified XP Engine
// ============================================================================
// Centralized XP reward system across all five pillars:
// Academic, Cognitive, Character, Life Readiness, Engagement

// XP reward values (matches safety_config.xp_rewards)
export const XP_REWARDS: Record<string, Record<string, number>> = {
  academic: {
    topic_mastered: 50,
    chapter_completed: 100,
    mastery_checkpoint_passed: 30,
    diagnostic_completed: 20,
    retrieval_session: 10,
    misconception_resolved: 25,
    perfect_score: 50,
  },
  cognitive: {
    reflection_written: 20,
    challenge_completed: 30,
    activity_completed: 15,
    focus_session_25min: 20,
    focus_session_45min: 35,
  },
  character: {
    habit_completed: 10,
    habit_streak_7: 30,
    habit_streak_30: 100,
    scenario_completed: 25,
    goal_completed: 40,
  },
  life_readiness: {
    practical_skill_practiced: 15,
    teamwork_activity: 20,
    communication_exercise: 15,
  },
  engagement: {
    daily_mix_completed: 25,
    daily_login: 5,
    weekly_reflection: 30,
    live_quiz_participation: 20,
    live_quiz_top3: 50,
    peer_teaching: 40,
  },
};

/**
 * Calculate level from total XP using a non-linear scale:
 * - Level 1-10: 100 XP each (total: 1000 XP for level 10)
 * - Level 11-20: 200 XP each (total: 3000 XP for level 20)
 * - Level 21+: 500 XP each
 */
export function calculateLevel(totalXP: number): number {
  if (totalXP <= 0) return 1;

  // Phase 1: Levels 1-10, 100 XP each (0-999 XP)
  if (totalXP < 1000) {
    return Math.floor(totalXP / 100) + 1;
  }

  // Phase 2: Levels 11-20, 200 XP each (1000-2999 XP)
  const xpAfterPhase1 = totalXP - 1000;
  if (xpAfterPhase1 < 2000) {
    return 11 + Math.floor(xpAfterPhase1 / 200);
  }

  // Phase 3: Level 21+, 500 XP each (3000+ XP)
  const xpAfterPhase2 = xpAfterPhase1 - 2000;
  return 21 + Math.floor(xpAfterPhase2 / 500);
}

/**
 * Calculate XP required to reach the next level from current total XP
 */
export function xpToNextLevel(totalXP: number): number {
  const currentLevel = calculateLevel(totalXP);

  let xpForCurrentLevel: number;
  if (currentLevel <= 10) {
    xpForCurrentLevel = (currentLevel - 1) * 100;
  } else if (currentLevel <= 20) {
    xpForCurrentLevel = 1000 + (currentLevel - 10 - 1) * 200;
  } else {
    xpForCurrentLevel = 3000 + (currentLevel - 20 - 1) * 500;
  }

  let xpForNextLevel: number;
  if (currentLevel < 10) {
    xpForNextLevel = currentLevel * 100;
  } else if (currentLevel < 20) {
    xpForNextLevel = 1000 + (currentLevel - 10) * 200;
  } else {
    xpForNextLevel = 3000 + (currentLevel - 20) * 500;
  }

  return xpForNextLevel - totalXP;
}

/**
 * Award XP to a user — inserts an xp_event and updates user_stats
 */
export async function awardXP(
  supabase: any,
  userId: string,
  pillar: string,
  action: string,
  sourceId?: string,
  description?: string
): Promise<{ xp_awarded: number; new_total: number; leveled_up: boolean }> {
  // Look up the XP amount from the rewards table
  const pillarRewards = XP_REWARDS[pillar];
  if (!pillarRewards || !pillarRewards[action]) {
    throw new Error(`Unknown XP action: ${pillar}.${action}`);
  }

  const xpAmount = pillarRewards[action];

  // Insert XP event
  const { error: eventError } = await supabase.from('xp_events').insert({
    user_id: userId,
    source_pillar: pillar,
    source_action: action,
    xp_amount: xpAmount,
    source_id: sourceId || null,
    description: description || `${action} in ${pillar}`,
    created_at: new Date().toISOString(),
  });

  if (eventError) {
    console.error('Error inserting XP event:', eventError);
    throw eventError;
  }

  // Fetch current user stats
  const { data: stats, error: statsError } = await supabase
    .from('user_stats')
    .select('total_xp, level')
    .eq('user_id', userId)
    .single();

  if (statsError && statsError.code !== 'PGRST116') {
    console.error('Error fetching user stats:', statsError);
    throw statsError;
  }

  const currentXP = stats?.total_xp || 0;
  const currentLevel = stats?.level || 1;
  const newTotal = currentXP + xpAmount;
  const newLevel = calculateLevel(newTotal);
  const leveledUp = newLevel > currentLevel;

  // Upsert user stats
  const { error: updateError } = await supabase.from('user_stats').upsert(
    {
      user_id: userId,
      total_xp: newTotal,
      level: newLevel,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (updateError) {
    console.error('Error updating user stats:', updateError);
    throw updateError;
  }

  return {
    xp_awarded: xpAmount,
    new_total: newTotal,
    leveled_up: leveledUp,
  };
}

/**
 * Get XP breakdown by pillar for a user
 */
export async function getXPBreakdown(
  supabase: any,
  userId: string
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('xp_events')
    .select('source_pillar, xp_amount')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching XP breakdown:', error);
    throw error;
  }

  const breakdown: Record<string, number> = {
    academic: 0,
    cognitive: 0,
    character: 0,
    life_readiness: 0,
    engagement: 0,
  };

  for (const event of data || []) {
    const pillar = event.source_pillar;
    if (pillar in breakdown) {
      breakdown[pillar] += event.xp_amount;
    }
  }

  return breakdown;
}

/**
 * Get recent XP events for a user
 */
export async function getRecentXPEvents(
  supabase: any,
  userId: string,
  limit = 20
): Promise<any[]> {
  const { data, error } = await supabase
    .from('xp_events')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent XP events:', error);
    throw error;
  }

  return data || [];
}
