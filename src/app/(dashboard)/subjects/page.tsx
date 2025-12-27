'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Subject {
  id: string;
  name: string;
  icon: string;
  color: string;
  progress: number;
  chaptersCompleted: number;
  totalChapters: number;
  nextChapter: string;
  questionsAnswered: number;
  accuracy: number;
}

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [userClass, setUserClass] = useState(6);

  useEffect(() => {
    fetchSubjects();
  }, [userClass]);

  const fetchSubjects = async () => {
    try {
      const res = await fetch(`/api/curriculum?class=${userClass}`);
      const data = await res.json();
      setSubjects(data.subjects || getMockSubjects());
    } catch (error) {
      setSubjects(getMockSubjects());
    } finally {
      setLoading(false);
    }
  };

  const getMockSubjects = (): Subject[] => [
    {
      id: 'mathematics',
      name: 'Mathematics',
      icon: '📐',
      color: 'from-indigo-500 to-purple-600',
      progress: 65,
      chaptersCompleted: 6,
      totalChapters: 10,
      nextChapter: 'Fractions',
      questionsAnswered: 156,
      accuracy: 78
    },
    {
      id: 'science',
      name: 'Science',
      icon: '🔬',
      color: 'from-purple-500 to-pink-600',
      progress: 48,
      chaptersCompleted: 5,
      totalChapters: 12,
      nextChapter: 'Materials Around Us',
      questionsAnswered: 98,
      accuracy: 82
    },
    {
      id: 'english',
      name: 'English',
      icon: '📖',
      color: 'from-pink-500 to-rose-600',
      progress: 72,
      chaptersCompleted: 4,
      totalChapters: 5,
      nextChapter: 'The Unlikely Best Friends',
      questionsAnswered: 87,
      accuracy: 85
    },
    {
      id: 'hindi',
      name: 'Hindi',
      icon: '📝',
      color: 'from-orange-500 to-amber-600',
      progress: 55,
      chaptersCompleted: 3,
      totalChapters: 5,
      nextChapter: 'चांद से थोड़ी-सी गप्पें',
      questionsAnswered: 64,
      accuracy: 70
    },
    {
      id: 'social-science',
      name: 'Social Science',
      icon: '🌍',
      color: 'from-teal-500 to-cyan-600',
      progress: 40,
      chaptersCompleted: 2,
      totalChapters: 5,
      nextChapter: 'In the Earliest Cities',
      questionsAnswered: 45,
      accuracy: 75
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="text-6xl mb-4">📚</div>
          <p className="text-gray-500">Loading subjects...</p>
        </div>
      </div>
    );
  }

  const overallProgress = Math.round(
    subjects.reduce((sum, s) => sum + s.progress, 0) / subjects.length
  );

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-effect border-b border-white/20 hidden lg:block">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-gray-900">My Subjects</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">Class {userClass}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Overall Progress:</span>
                <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-primary-500 to-secondary-500"
                    style={{ width: `${overallProgress}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-primary-600">{overallProgress}%</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Card */}
        <div className="bg-gradient-to-r from-primary-500 via-primary-600 to-secondary-500 rounded-3xl p-6 mb-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-2">📚 Your Learning Journey</h2>
            <p className="text-white/90 mb-4">
              Class {userClass} • {subjects.reduce((sum, s) => sum + s.chaptersCompleted, 0)} chapters completed
            </p>
            <div className="flex items-center gap-6">
              <div>
                <p className="text-3xl font-bold">{overallProgress}%</p>
                <p className="text-sm text-white/80">Overall Progress</p>
              </div>
              <div>
                <p className="text-3xl font-bold">{subjects.reduce((sum, s) => sum + s.questionsAnswered, 0)}</p>
                <p className="text-sm text-white/80">Questions Solved</p>
              </div>
              <div>
                <p className="text-3xl font-bold">{Math.round(subjects.reduce((sum, s) => sum + s.accuracy, 0) / subjects.length)}%</p>
                <p className="text-sm text-white/80">Avg. Accuracy</p>
              </div>
            </div>
          </div>
        </div>

        {/* Subjects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects.map(subject => (
            <Link
              key={subject.id}
              href={`/subjects/${subject.id}`}
              className="group bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden"
            >
              {/* Gradient Top Bar */}
              <div className={`h-2 bg-gradient-to-r ${subject.color}`} />
              
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${subject.color} flex items-center justify-center text-2xl shadow-lg group-hover:scale-110 transition-transform`}>
                      {subject.icon}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 group-hover:text-primary-600 transition-colors">
                        {subject.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {subject.chaptersCompleted}/{subject.totalChapters} chapters
                      </p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-primary-500 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500">Progress</span>
                    <span className="font-bold text-gray-700">{subject.progress}%</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full bg-gradient-to-r ${subject.color} rounded-full transition-all duration-500`}
                      style={{ width: `${subject.progress}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <span className="text-gray-500">
                      <strong className="text-gray-700">{subject.questionsAnswered}</strong> questions
                    </span>
                    <span className="text-gray-500">
                      <strong className="text-gray-700">{subject.accuracy}%</strong> accuracy
                    </span>
                  </div>
                </div>

                {/* Next Chapter */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-1">Continue with:</p>
                  <p className="text-sm font-medium text-primary-600 truncate">
                    📖 {subject.nextChapter}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/assessment" className="bg-white rounded-xl p-5 shadow-md hover:shadow-lg transition-shadow flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center text-2xl">
              🎯
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Learning Style Assessment</h4>
              <p className="text-sm text-gray-500">Discover how you learn best</p>
            </div>
          </Link>
          
          <Link href="/progress" className="bg-white rounded-xl p-5 shadow-md hover:shadow-lg transition-shadow flex items-center gap-4">
            <div className="w-12 h-12 bg-success-100 rounded-xl flex items-center justify-center text-2xl">
              📊
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">View Detailed Progress</h4>
              <p className="text-sm text-gray-500">See your learning analytics</p>
            </div>
          </Link>
          
          <Link href="/achievements" className="bg-white rounded-xl p-5 shadow-md hover:shadow-lg transition-shadow flex items-center gap-4">
            <div className="w-12 h-12 bg-warning-100 rounded-xl flex items-center justify-center text-2xl">
              🏆
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Achievements & Badges</h4>
              <p className="text-sm text-gray-500">See what you've unlocked</p>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
