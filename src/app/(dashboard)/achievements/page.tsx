'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'learning' | 'streak' | 'mastery' | 'social' | 'special';
  xpReward: number;
  earned: boolean;
  earnedAt?: string;
  progress?: number;
  requirement?: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

const categoryInfo = {
  learning: { name: 'Learning', color: 'from-blue-400 to-blue-600', icon: '📚' },
  streak: { name: 'Streaks', color: 'from-orange-400 to-red-500', icon: '🔥' },
  mastery: { name: 'Mastery', color: 'from-purple-400 to-purple-600', icon: '🏆' },
  social: { name: 'Social', color: 'from-green-400 to-teal-500', icon: '🤝' },
  special: { name: 'Special', color: 'from-yellow-400 to-orange-500', icon: '⭐' }
};

const rarityInfo = {
  common: { label: 'Common', color: 'text-gray-500 border-gray-300 bg-gray-50' },
  rare: { label: 'Rare', color: 'text-blue-600 border-blue-300 bg-blue-50' },
  epic: { label: 'Epic', color: 'text-purple-600 border-purple-300 bg-purple-50' },
  legendary: { label: 'Legendary', color: 'text-yellow-600 border-yellow-400 bg-yellow-50' }
};

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [showEarned, setShowEarned] = useState<'all' | 'earned' | 'unearned'>('all');

  useEffect(() => {
    fetchAchievements();
  }, []);

  const fetchAchievements = async () => {
    try {
      const res = await fetch('/api/achievements');
      const data = await res.json();
      setAchievements(data.achievements);
    } catch (error) {
      setAchievements(getMockAchievements());
    } finally {
      setLoading(false);
    }
  };

  const getMockAchievements = (): Achievement[] => [
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

  const filteredAchievements = achievements.filter(a => {
    const categoryMatch = activeCategory === 'all' || a.category === activeCategory;
    const earnedMatch = showEarned === 'all' || 
      (showEarned === 'earned' && a.earned) || 
      (showEarned === 'unearned' && !a.earned);
    return categoryMatch && earnedMatch;
  });

  const earnedCount = achievements.filter(a => a.earned).length;
  const totalXPEarned = achievements.filter(a => a.earned).reduce((sum, a) => sum + a.xpReward, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-50 to-secondary-50 flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="text-6xl mb-4">🏆</div>
          <p className="text-gray-500">Loading achievements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-50 to-secondary-50">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-effect border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-xl font-bold text-gray-900">Achievements</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Banner */}
        <div className="bg-gradient-to-r from-primary-500 via-primary-600 to-secondary-500 rounded-3xl p-6 mb-8 text-white">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-5xl font-bold">{earnedCount}</p>
              <p className="text-white/80">Achievements Earned</p>
            </div>
            <div>
              <p className="text-5xl font-bold">{achievements.length - earnedCount}</p>
              <p className="text-white/80">Yet to Unlock</p>
            </div>
            <div>
              <p className="text-5xl font-bold">+{totalXPEarned}</p>
              <p className="text-white/80">XP from Achievements</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeCategory === 'all' 
                  ? 'bg-gray-800 text-white' 
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              All
            </button>
            {Object.entries(categoryInfo).map(([key, info]) => (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  activeCategory === key 
                    ? 'bg-gray-800 text-white' 
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span>{info.icon}</span>
                <span>{info.name}</span>
              </button>
            ))}
          </div>

          {/* Earned Filter */}
          <div className="flex gap-2 ml-auto">
            {['all', 'earned', 'unearned'].map(option => (
              <button
                key={option}
                onClick={() => setShowEarned(option as any)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                  showEarned === option 
                    ? 'bg-primary-500 text-white' 
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Achievements Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAchievements.map(achievement => {
            const rarity = rarityInfo[achievement.rarity];
            const hasProgress = achievement.progress !== undefined && achievement.requirement !== undefined;
            
            return (
              <div
                key={achievement.id}
                className={`bg-white rounded-2xl p-5 shadow-md transition-all hover:shadow-lg ${
                  !achievement.earned ? 'opacity-70 grayscale-[30%]' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl ${
                    achievement.earned 
                      ? `bg-gradient-to-br ${categoryInfo[achievement.category].color} shadow-lg` 
                      : 'bg-gray-100'
                  }`}>
                    {achievement.earned ? achievement.icon : '🔒'}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900 truncate">{achievement.title}</h3>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${rarity.color}`}>
                        {rarity.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mb-2">{achievement.description}</p>
                    
                    {/* Progress Bar or Earned Date */}
                    {hasProgress && !achievement.earned ? (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Progress</span>
                          <span className="font-medium text-gray-700">{achievement.progress}/{achievement.requirement}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary-400 rounded-full"
                            style={{ width: `${(achievement.progress! / achievement.requirement!) * 100}%` }}
                          />
                        </div>
                      </div>
                    ) : achievement.earned ? (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-success-600 font-medium flex items-center gap-1">
                          ✓ Earned {achievement.earnedAt}
                        </span>
                        <span className="text-xs font-bold text-primary-600">+{achievement.xpReward} XP</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Not earned yet</span>
                        <span className="text-xs font-medium text-gray-500">+{achievement.xpReward} XP</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredAchievements.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <p className="text-gray-500">No achievements found with these filters</p>
          </div>
        )}
      </main>
    </div>
  );
}
