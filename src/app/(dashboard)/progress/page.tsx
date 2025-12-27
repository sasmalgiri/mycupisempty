'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ProgressData {
  totalXP: number;
  currentLevel: number;
  xpToNextLevel: number;
  streak: number;
  longestStreak: number;
  totalStudyTime: number;
  questionsAnswered: number;
  correctAnswers: number;
  subjectProgress: {
    name: string;
    icon: string;
    progress: number;
    chaptersCompleted: number;
    totalChapters: number;
  }[];
  weeklyActivity: {
    day: string;
    minutes: number;
    questions: number;
  }[];
  bloomDistribution: {
    level: string;
    count: number;
    percentage: number;
  }[];
  recentAchievements: {
    id: string;
    title: string;
    icon: string;
    earnedAt: string;
  }[];
}

export default function ProgressPage() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'subjects' | 'activity'>('overview');

  useEffect(() => {
    fetchProgressData();
  }, []);

  const fetchProgressData = async () => {
    try {
      const res = await fetch('/api/progress');
      const json = await res.json();
      setData(json.data);
    } catch (error) {
      setData(getMockData());
    } finally {
      setLoading(false);
    }
  };

  const getMockData = (): ProgressData => ({
    totalXP: 2450,
    currentLevel: 12,
    xpToNextLevel: 550,
    streak: 7,
    longestStreak: 14,
    totalStudyTime: 1847, // minutes
    questionsAnswered: 342,
    correctAnswers: 287,
    subjectProgress: [
      { name: 'Mathematics', icon: '📐', progress: 65, chaptersCompleted: 6, totalChapters: 10 },
      { name: 'Science', icon: '🔬', progress: 48, chaptersCompleted: 5, totalChapters: 12 },
      { name: 'English', icon: '📖', progress: 72, chaptersCompleted: 4, totalChapters: 5 },
      { name: 'Hindi', icon: '📝', progress: 55, chaptersCompleted: 3, totalChapters: 5 },
      { name: 'Social Science', icon: '🌍', progress: 40, chaptersCompleted: 2, totalChapters: 5 }
    ],
    weeklyActivity: [
      { day: 'Mon', minutes: 45, questions: 23 },
      { day: 'Tue', minutes: 30, questions: 15 },
      { day: 'Wed', minutes: 60, questions: 34 },
      { day: 'Thu', minutes: 25, questions: 12 },
      { day: 'Fri', minutes: 55, questions: 28 },
      { day: 'Sat', minutes: 90, questions: 45 },
      { day: 'Sun', minutes: 40, questions: 20 }
    ],
    bloomDistribution: [
      { level: 'Remember', count: 120, percentage: 35 },
      { level: 'Understand', count: 95, percentage: 28 },
      { level: 'Apply', count: 75, percentage: 22 },
      { level: 'Analyze', count: 35, percentage: 10 },
      { level: 'Evaluate', count: 12, percentage: 3.5 },
      { level: 'Create', count: 5, percentage: 1.5 }
    ],
    recentAchievements: [
      { id: '1', title: 'Week Warrior', icon: '🔥', earnedAt: '2 days ago' },
      { id: '2', title: 'Math Master', icon: '📐', earnedAt: '5 days ago' },
      { id: '3', title: 'Quick Learner', icon: '⚡', earnedAt: '1 week ago' }
    ]
  });

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-50 to-secondary-50 flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-16 h-16 bg-primary-200 rounded-full mx-auto mb-4"></div>
          <div className="h-4 w-32 bg-gray-200 rounded mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const accuracy = Math.round((data.correctAnswers / data.questionsAnswered) * 100);
  const levelProgress = ((1000 - data.xpToNextLevel) / 1000) * 100;

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
              <h1 className="text-xl font-bold text-gray-900">My Progress</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Level & XP Card */}
        <div className="bg-gradient-to-r from-primary-500 via-primary-600 to-secondary-500 rounded-3xl p-6 mb-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-white/80 text-sm mb-1">Current Level</p>
                <div className="flex items-center gap-3">
                  <span className="text-5xl font-bold">{data.currentLevel}</span>
                  <div className="text-left">
                    <p className="font-semibold">Learning Champion</p>
                    <p className="text-sm text-white/80">{data.xpToNextLevel} XP to next level</p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white/80 text-sm mb-1">Total XP</p>
                <p className="text-4xl font-bold">⭐ {data.totalXP.toLocaleString()}</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Level Progress</span>
                <span>{Math.round(levelProgress)}%</span>
              </div>
              <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white rounded-full transition-all duration-1000"
                  style={{ width: `${levelProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 shadow-md">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-warning-100 rounded-xl flex items-center justify-center text-xl">🔥</div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{data.streak}</p>
                <p className="text-sm text-gray-500">Day Streak</p>
              </div>
            </div>
            <p className="text-xs text-gray-400">Best: {data.longestStreak} days</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-md">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center text-xl">⏱️</div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{formatTime(data.totalStudyTime)}</p>
                <p className="text-sm text-gray-500">Study Time</p>
              </div>
            </div>
            <p className="text-xs text-gray-400">This month</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-md">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-success-100 rounded-xl flex items-center justify-center text-xl">✓</div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{data.questionsAnswered}</p>
                <p className="text-sm text-gray-500">Questions</p>
              </div>
            </div>
            <p className="text-xs text-gray-400">{data.correctAnswers} correct</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-md">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-secondary-100 rounded-xl flex items-center justify-center text-xl">🎯</div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{accuracy}%</p>
                <p className="text-sm text-gray-500">Accuracy</p>
              </div>
            </div>
            <p className="text-xs text-gray-400">Overall</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {['overview', 'subjects', 'activity'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab 
                  ? 'bg-primary-500 text-white' 
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {activeTab === 'overview' && (
            <>
              {/* Subject Progress */}
              <div className="bg-white rounded-2xl p-6 shadow-md">
                <h3 className="font-bold text-gray-900 mb-4">Subject Progress</h3>
                <div className="space-y-4">
                  {data.subjectProgress.map(subject => (
                    <div key={subject.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span>{subject.icon}</span>
                          <span className="font-medium text-gray-700">{subject.name}</span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {subject.chaptersCompleted}/{subject.totalChapters} chapters
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all duration-500"
                          style={{ width: `${subject.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Weekly Activity Chart */}
              <div className="bg-white rounded-2xl p-6 shadow-md">
                <h3 className="font-bold text-gray-900 mb-4">Weekly Activity</h3>
                <div className="flex items-end justify-between h-40 gap-2">
                  {data.weeklyActivity.map((day, i) => {
                    const maxMinutes = Math.max(...data.weeklyActivity.map(d => d.minutes));
                    const height = (day.minutes / maxMinutes) * 100;
                    return (
                      <div key={day.day} className="flex-1 flex flex-col items-center">
                        <div 
                          className="w-full bg-gradient-to-t from-primary-500 to-primary-300 rounded-t-lg transition-all duration-500"
                          style={{ height: `${height}%`, minHeight: '8px' }}
                        />
                        <span className="text-xs text-gray-500 mt-2">{day.day}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-600">
                    Total this week: <strong>{formatTime(data.weeklyActivity.reduce((sum, d) => sum + d.minutes, 0))}</strong> • 
                    <strong> {data.weeklyActivity.reduce((sum, d) => sum + d.questions, 0)}</strong> questions
                  </p>
                </div>
              </div>

              {/* Bloom's Distribution */}
              <div className="bg-white rounded-2xl p-6 shadow-md">
                <h3 className="font-bold text-gray-900 mb-4">Learning Depth (Bloom's Taxonomy)</h3>
                <div className="space-y-3">
                  {data.bloomDistribution.map((level, i) => (
                    <div key={level.level} className="flex items-center gap-3">
                      <div className="w-24 text-sm text-gray-600">{level.level}</div>
                      <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            ['bg-blue-400', 'bg-green-400', 'bg-yellow-400', 'bg-orange-400', 'bg-purple-400', 'bg-pink-400'][i]
                          }`}
                          style={{ width: `${level.percentage}%` }}
                        />
                      </div>
                      <div className="w-12 text-right text-sm font-medium text-gray-700">{level.count}</div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-4">
                  💡 Try more Analyze and Evaluate questions to deepen understanding!
                </p>
              </div>

              {/* Recent Achievements */}
              <div className="bg-white rounded-2xl p-6 shadow-md">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900">Recent Achievements</h3>
                  <Link href="/achievements" className="text-sm text-primary-600 hover:underline">View all</Link>
                </div>
                <div className="space-y-3">
                  {data.recentAchievements.map(achievement => (
                    <div key={achievement.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <div className="w-12 h-12 bg-gradient-to-br from-primary-100 to-secondary-100 rounded-xl flex items-center justify-center text-2xl">
                        {achievement.icon}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{achievement.title}</p>
                        <p className="text-xs text-gray-500">{achievement.earnedAt}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'subjects' && (
            <div className="lg:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.subjectProgress.map(subject => (
                  <Link 
                    key={subject.name}
                    href={`/subjects/${subject.name.toLowerCase().replace(' ', '-')}`}
                    className="bg-white rounded-2xl p-6 shadow-md hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center text-3xl">
                        {subject.icon}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900">{subject.name}</h4>
                        <p className="text-sm text-gray-500">
                          {subject.chaptersCompleted} of {subject.totalChapters} chapters
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Progress</span>
                        <span className="font-bold text-primary-600">{subject.progress}%</span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full"
                          style={{ width: `${subject.progress}%` }}
                        />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl p-6 shadow-md">
                <h3 className="font-bold text-gray-900 mb-6">Activity Heatmap</h3>
                <div className="grid grid-cols-7 gap-1">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                    <div key={i} className="text-center text-xs text-gray-500 mb-2">{day}</div>
                  ))}
                  {[...Array(35)].map((_, i) => {
                    const intensity = Math.random();
                    return (
                      <div
                        key={i}
                        className={`aspect-square rounded-sm ${
                          intensity > 0.8 ? 'bg-primary-500' :
                          intensity > 0.5 ? 'bg-primary-300' :
                          intensity > 0.2 ? 'bg-primary-100' :
                          'bg-gray-100'
                        }`}
                        title={`${Math.round(intensity * 60)} minutes`}
                      />
                    );
                  })}
                </div>
                <div className="flex items-center justify-end gap-2 mt-4">
                  <span className="text-xs text-gray-500">Less</span>
                  <div className="w-3 h-3 bg-gray-100 rounded-sm"></div>
                  <div className="w-3 h-3 bg-primary-100 rounded-sm"></div>
                  <div className="w-3 h-3 bg-primary-300 rounded-sm"></div>
                  <div className="w-3 h-3 bg-primary-500 rounded-sm"></div>
                  <span className="text-xs text-gray-500">More</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
