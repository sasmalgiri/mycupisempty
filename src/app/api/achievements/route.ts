import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // In production, fetch from Supabase based on authenticated user
    const achievements = [
      // Learning Achievements
      { id: '1', title: 'First Steps', description: 'Complete your first lesson', icon: '👣', category: 'learning', xpReward: 50, earned: true, earnedAt: '2 weeks ago', rarity: 'common' },
      { id: '2', title: 'Knowledge Seeker', description: 'Complete 10 lessons', icon: '🔍', category: 'learning', xpReward: 100, earned: true, earnedAt: '1 week ago', rarity: 'common' },
      { id: '3', title: 'Scholar', description: 'Complete 50 lessons', icon: '📖', category: 'learning', xpReward: 250, earned: false, progress: 32, requirement: 50, rarity: 'rare' },
      { id: '4', title: 'Bookworm', description: 'Complete 100 lessons', icon: '📚', category: 'learning', xpReward: 500, earned: false, progress: 32, requirement: 100, rarity: 'epic' },
      { id: '5', title: 'Wisdom Master', description: 'Complete all lessons in a subject', icon: '🎓', category: 'learning', xpReward: 1000, earned: false, rarity: 'legendary' },
      
      // Streak Achievements
      { id: '6', title: 'Getting Started', description: 'Maintain a 3-day streak', icon: '🌱', category: 'streak', xpReward: 30, earned: true, earnedAt: '1 week ago', rarity: 'common' },
      { id: '7', title: 'Week Warrior', description: 'Maintain a 7-day streak', icon: '🔥', category: 'streak', xpReward: 100, earned: true, earnedAt: '3 days ago', rarity: 'common' },
      { id: '8', title: 'Fortnight Fighter', description: 'Maintain a 14-day streak', icon: '💪', category: 'streak', xpReward: 250, earned: false, progress: 7, requirement: 14, rarity: 'rare' },
      { id: '9', title: 'Month Master', description: 'Maintain a 30-day streak', icon: '🏃', category: 'streak', xpReward: 500, earned: false, progress: 7, requirement: 30, rarity: 'epic' },
      { id: '10', title: 'Year Legend', description: 'Maintain a 365-day streak', icon: '👑', category: 'streak', xpReward: 5000, earned: false, progress: 7, requirement: 365, rarity: 'legendary' },
      
      // Mastery Achievements
      { id: '11', title: 'Quick Thinker', description: 'Answer 10 questions correctly', icon: '⚡', category: 'mastery', xpReward: 50, earned: true, earnedAt: '5 days ago', rarity: 'common' },
      { id: '12', title: 'Perfectionist', description: 'Get 100% on any quiz', icon: '💯', category: 'mastery', xpReward: 150, earned: true, earnedAt: '4 days ago', rarity: 'rare' },
      { id: '13', title: 'Chapter Champion', description: 'Complete a chapter with 90%+ accuracy', icon: '🏅', category: 'mastery', xpReward: 200, earned: false, rarity: 'rare' },
      { id: '14', title: 'Subject Specialist', description: 'Score 90%+ in all chapters of a subject', icon: '🌟', category: 'mastery', xpReward: 750, earned: false, rarity: 'epic' },
      { id: '15', title: 'Genius', description: 'Answer 100 questions without a mistake', icon: '🧠', category: 'mastery', xpReward: 2000, earned: false, progress: 23, requirement: 100, rarity: 'legendary' },
      
      // Social Achievements
      { id: '16', title: 'Profile Complete', description: 'Complete your learning profile', icon: '✨', category: 'social', xpReward: 25, earned: true, earnedAt: '2 weeks ago', rarity: 'common' },
      { id: '17', title: 'Feedback Friend', description: 'Give feedback on 5 explanations', icon: '💬', category: 'social', xpReward: 75, earned: false, progress: 2, requirement: 5, rarity: 'common' },
      { id: '18', title: 'Helper', description: 'Help 10 students with their doubts', icon: '🤝', category: 'social', xpReward: 200, earned: false, rarity: 'rare' },
      { id: '19', title: 'Community Star', description: 'Get 50 thanks from other students', icon: '⭐', category: 'social', xpReward: 500, earned: false, rarity: 'epic' },
      
      // Special Achievements
      { id: '20', title: 'Early Bird', description: 'Study before 7 AM', icon: '🌅', category: 'special', xpReward: 50, earned: true, earnedAt: '1 week ago', rarity: 'common' },
      { id: '21', title: 'Night Owl', description: 'Study after 10 PM', icon: '🦉', category: 'special', xpReward: 50, earned: true, earnedAt: '6 days ago', rarity: 'common' },
      { id: '22', title: 'Weekend Warrior', description: 'Study on both Saturday and Sunday', icon: '🏆', category: 'special', xpReward: 75, earned: true, earnedAt: '3 days ago', rarity: 'rare' },
      { id: '23', title: 'Multi-Talented', description: 'Study 3 different subjects in one day', icon: '🎭', category: 'special', xpReward: 100, earned: false, rarity: 'rare' },
      { id: '24', title: 'Speed Demon', description: 'Complete a quiz in under 2 minutes with 100% accuracy', icon: '💨', category: 'special', xpReward: 300, earned: false, rarity: 'epic' }
    ];

    return NextResponse.json({ success: true, achievements });
  } catch (error) {
    console.error('Achievements API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch achievements' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { achievementId } = body;

    // In production, mark achievement as earned in Supabase
    // Also grant XP reward to user

    return NextResponse.json({ success: true, message: 'Achievement unlocked!' });
  } catch (error) {
    console.error('Achievement unlock error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to unlock achievement' },
      { status: 500 }
    );
  }
}
