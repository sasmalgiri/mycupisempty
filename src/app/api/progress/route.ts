import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch user stats
    const { data: stats } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Fetch user profile for class level
    const { data: profile } = await supabase
      .from('profiles')
      .select('class_level')
      .eq('id', user.id)
      .single();

    // Fetch subjects and topic progress
    const { data: subjects } = await supabase
      .from('subjects')
      .select('id, name, icon')
      .eq('class_level', profile?.class_level || 6);

    // Fetch user topic progress for completion stats
    const { data: topicProgress } = await supabase
      .from('user_topic_progress')
      .select('topic_id, mastery_score, questions_attempted, questions_correct')
      .eq('user_id', user.id);

    // Fetch question attempts for Bloom's distribution
    const { data: attempts } = await supabase
      .from('question_attempts')
      .select('bloom_level, is_correct')
      .eq('user_id', user.id);

    // Calculate subject progress
    const subjectProgress = (subjects || []).map((subject: any) => ({
      name: subject.name,
      icon: subject.icon || '📚',
      progress: 0, // Would need chapter-level data
      chaptersCompleted: 0,
      totalChapters: 0,
    }));

    // Calculate Bloom's distribution
    const bloomCounts: Record<string, number> = {};
    const bloomLevels = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'];
    bloomLevels.forEach(l => bloomCounts[l] = 0);
    (attempts || []).forEach((a: any) => {
      if (a.bloom_level && bloomCounts[a.bloom_level] !== undefined) {
        bloomCounts[a.bloom_level]++;
      }
    });
    const totalAttempts = Object.values(bloomCounts).reduce((s, c) => s + c, 0) || 1;
    const bloomDistribution = bloomLevels.map(level => ({
      level,
      count: bloomCounts[level],
      percentage: Math.round((bloomCounts[level] / totalAttempts) * 100),
    }));

    // Build weekly activity (last 7 days)
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyActivity = days.map(day => ({
      day,
      minutes: 0,
      questions: 0,
    }));

    const totalXP = stats?.total_xp || 0;
    const level = Math.floor(totalXP / 100) + 1;

    const progressData = {
      totalXP,
      currentLevel: level,
      xpToNextLevel: (level * 100) - totalXP,
      streak: stats?.current_streak || 0,
      longestStreak: stats?.longest_streak || 0,
      totalStudyTime: stats?.total_study_time_minutes || 0,
      questionsAnswered: stats?.total_questions_answered || 0,
      correctAnswers: stats?.correct_answers || 0,
      subjectProgress,
      weeklyActivity,
      bloomDistribution,
      recentAchievements: [],
    };

    return NextResponse.json({ success: true, data: progressData });
  } catch (error) {
    console.error('Progress API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch progress data' },
      { status: 500 }
    );
  }
}
