import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// Achievement definitions (static catalog)
const ACHIEVEMENT_DEFS = [
  { id: '1', title: 'First Steps', description: 'Complete your first lesson', icon: '👣', category: 'learning', xpReward: 50, rarity: 'common', check: (s: any) => (s.total_questions_answered || 0) >= 1 },
  { id: '2', title: 'Knowledge Seeker', description: 'Answer 10 questions', icon: '🔍', category: 'learning', xpReward: 100, rarity: 'common', check: (s: any) => (s.total_questions_answered || 0) >= 10 },
  { id: '3', title: 'Scholar', description: 'Answer 50 questions', icon: '📖', category: 'learning', xpReward: 250, rarity: 'rare', check: (s: any) => (s.total_questions_answered || 0) >= 50, req: 50, field: 'total_questions_answered' },
  { id: '4', title: 'Bookworm', description: 'Answer 100 questions', icon: '📚', category: 'learning', xpReward: 500, rarity: 'epic', check: (s: any) => (s.total_questions_answered || 0) >= 100, req: 100, field: 'total_questions_answered' },
  { id: '5', title: 'Wisdom Master', description: 'Answer 500 questions', icon: '🎓', category: 'learning', xpReward: 1000, rarity: 'legendary', check: (s: any) => (s.total_questions_answered || 0) >= 500, req: 500, field: 'total_questions_answered' },
  { id: '6', title: 'Getting Started', description: 'Maintain a 3-day streak', icon: '🌱', category: 'streak', xpReward: 30, rarity: 'common', check: (s: any) => (s.longest_streak || 0) >= 3 },
  { id: '7', title: 'Week Warrior', description: 'Maintain a 7-day streak', icon: '🔥', category: 'streak', xpReward: 100, rarity: 'common', check: (s: any) => (s.longest_streak || 0) >= 7 },
  { id: '8', title: 'Fortnight Fighter', description: 'Maintain a 14-day streak', icon: '💪', category: 'streak', xpReward: 250, rarity: 'rare', check: (s: any) => (s.longest_streak || 0) >= 14, req: 14, field: 'longest_streak' },
  { id: '9', title: 'Month Master', description: 'Maintain a 30-day streak', icon: '🏃', category: 'streak', xpReward: 500, rarity: 'epic', check: (s: any) => (s.longest_streak || 0) >= 30, req: 30, field: 'longest_streak' },
  { id: '10', title: 'Year Legend', description: '365-day streak', icon: '👑', category: 'streak', xpReward: 5000, rarity: 'legendary', check: (s: any) => (s.longest_streak || 0) >= 365, req: 365, field: 'longest_streak' },
  { id: '11', title: 'Quick Thinker', description: 'Get 10 correct answers', icon: '⚡', category: 'mastery', xpReward: 50, rarity: 'common', check: (s: any) => (s.correct_answers || 0) >= 10 },
  { id: '12', title: 'Sharp Mind', description: 'Get 50 correct answers', icon: '💯', category: 'mastery', xpReward: 150, rarity: 'rare', check: (s: any) => (s.correct_answers || 0) >= 50, req: 50, field: 'correct_answers' },
  { id: '13', title: 'Subject Specialist', description: 'Get 200 correct answers', icon: '🏅', category: 'mastery', xpReward: 500, rarity: 'epic', check: (s: any) => (s.correct_answers || 0) >= 200, req: 200, field: 'correct_answers' },
  { id: '14', title: 'Genius', description: 'Get 1000 correct answers', icon: '🧠', category: 'mastery', xpReward: 2000, rarity: 'legendary', check: (s: any) => (s.correct_answers || 0) >= 1000, req: 1000, field: 'correct_answers' },
  { id: '15', title: 'XP Collector', description: 'Earn 500 XP', icon: '⭐', category: 'special', xpReward: 50, rarity: 'common', check: (s: any) => (s.total_xp || 0) >= 500 },
  { id: '16', title: 'XP Hunter', description: 'Earn 2000 XP', icon: '🌟', category: 'special', xpReward: 200, rarity: 'rare', check: (s: any) => (s.total_xp || 0) >= 2000, req: 2000, field: 'total_xp' },
  { id: '17', title: 'XP Legend', description: 'Earn 10000 XP', icon: '👑', category: 'special', xpReward: 1000, rarity: 'legendary', check: (s: any) => (s.total_xp || 0) >= 10000, req: 10000, field: 'total_xp' },
];

export async function GET(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: stats } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const s = stats || {};

    const achievements = ACHIEVEMENT_DEFS.map(def => ({
      id: def.id,
      title: def.title,
      description: def.description,
      icon: def.icon,
      category: def.category,
      xpReward: def.xpReward,
      rarity: def.rarity,
      earned: def.check(s),
      progress: def.field ? (s[def.field] || 0) : undefined,
      requirement: def.req,
    }));

    return NextResponse.json({ success: true, achievements });
  } catch (error) {
    console.error('Achievements API error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch achievements' }, { status: 500 });
  }
}
