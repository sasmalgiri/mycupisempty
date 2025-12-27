'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

interface Chapter {
  id: string;
  name: string;
  chapter_number: number;
  description: string;
  progress: number;
  topics_count: number;
  completed_topics: number;
}

interface Subject {
  id: string;
  name: string;
  icon: string;
  description: string;
  class_number: number;
  chapters: Chapter[];
}

export default function SubjectPage() {
  const params = useParams();
  const router = useRouter();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubjectData();
  }, [params.subjectId]);

  const fetchSubjectData = async () => {
    try {
      const res = await fetch(`/api/curriculum?subjectId=${params.subjectId}`);
      const data = await res.json();
      setSubject(data.subject);
    } catch (error) {
      console.error('Error fetching subject:', error);
      // Use mock data for demo
      setSubject(getMockSubject());
    } finally {
      setLoading(false);
    }
  };

  const getMockSubject = (): Subject => ({
    id: params.subjectId as string,
    name: 'Mathematics',
    icon: '📐',
    description: 'Master mathematical concepts from basic arithmetic to advanced problem-solving',
    class_number: 6,
    chapters: [
      { id: '1', name: 'Patterns in Mathematics', chapter_number: 1, description: 'Explore number patterns, sequences, and mathematical relationships', progress: 100, topics_count: 4, completed_topics: 4 },
      { id: '2', name: 'Lines and Angles', chapter_number: 2, description: 'Understanding lines, rays, segments, and different types of angles', progress: 75, topics_count: 5, completed_topics: 4 },
      { id: '3', name: 'Number Play', chapter_number: 3, description: 'Fun with numbers, place value, and number properties', progress: 60, topics_count: 4, completed_topics: 2 },
      { id: '4', name: 'Data Handling', chapter_number: 4, description: 'Collecting, organizing, and representing data', progress: 30, topics_count: 5, completed_topics: 1 },
      { id: '5', name: 'Prime Time', chapter_number: 5, description: 'Prime numbers, factors, multiples, and divisibility', progress: 0, topics_count: 6, completed_topics: 0 },
      { id: '6', name: 'Perimeter and Area', chapter_number: 6, description: 'Measuring boundaries and surfaces of shapes', progress: 0, topics_count: 5, completed_topics: 0 },
      { id: '7', name: 'Fractions', chapter_number: 7, description: 'Understanding and operating with fractions', progress: 0, topics_count: 6, completed_topics: 0 },
      { id: '8', name: 'Playing with Constructions', chapter_number: 8, description: 'Using compass and ruler to construct geometric figures', progress: 0, topics_count: 4, completed_topics: 0 },
      { id: '9', name: 'Symmetry', chapter_number: 9, description: 'Line symmetry and rotational symmetry', progress: 0, topics_count: 3, completed_topics: 0 },
      { id: '10', name: 'The Other Side of Zero', chapter_number: 10, description: 'Introduction to negative numbers and integers', progress: 0, topics_count: 5, completed_topics: 0 },
    ]
  });

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-success-500';
    if (progress >= 50) return 'bg-primary-500';
    if (progress > 0) return 'bg-warning-500';
    return 'bg-gray-300';
  };

  const getProgressBadge = (progress: number) => {
    if (progress === 100) return { text: 'Completed', class: 'bg-success-100 text-success-700' };
    if (progress >= 50) return { text: 'In Progress', class: 'bg-primary-100 text-primary-700' };
    if (progress > 0) return { text: 'Started', class: 'bg-warning-100 text-warning-700' };
    return { text: 'Not Started', class: 'bg-gray-100 text-gray-600' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-50 to-secondary-50 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-primary-200 rounded-2xl"></div>
          <div className="h-4 w-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!subject) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-50 to-secondary-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Subject not found</h2>
          <Link href="/dashboard" className="btn-primary">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const overallProgress = Math.round(
    subject.chapters.reduce((sum, ch) => sum + ch.progress, 0) / subject.chapters.length
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-50 to-secondary-50">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-effect border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{subject.icon}</span>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{subject.name}</h1>
                  <p className="text-sm text-gray-500">Class {subject.class_number}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-500">Overall Progress</p>
                <p className="text-lg font-bold text-primary-600">{overallProgress}%</p>
              </div>
              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${getProgressColor(overallProgress)} transition-all duration-500`}
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Subject Overview */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-gray-600 mb-4">{subject.description}</p>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📚</span>
                  <span className="text-gray-700"><strong>{subject.chapters.length}</strong> Chapters</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">✅</span>
                  <span className="text-gray-700">
                    <strong>{subject.chapters.filter(c => c.progress === 100).length}</strong> Completed
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📝</span>
                  <span className="text-gray-700">
                    <strong>{subject.chapters.reduce((sum, c) => sum + c.topics_count, 0)}</strong> Topics
                  </span>
                </div>
              </div>
            </div>
            <Link
              href={`/subjects/${subject.id}/quiz`}
              className="btn-primary flex items-center gap-2"
            >
              <span>🎯</span>
              <span>Start Quiz</span>
            </Link>
          </div>
        </div>

        {/* Chapters List */}
        <h2 className="text-xl font-bold text-gray-900 mb-4">Chapters</h2>
        <div className="space-y-4">
          {subject.chapters.map((chapter, index) => {
            const badge = getProgressBadge(chapter.progress);
            return (
              <Link
                key={chapter.id}
                href={`/subjects/${subject.id}/chapter/${chapter.id}`}
                className="block bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden group"
              >
                <div className="flex items-center p-5">
                  {/* Chapter Number */}
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold mr-5
                    ${chapter.progress === 100 
                      ? 'bg-success-100 text-success-600' 
                      : chapter.progress > 0 
                        ? 'bg-primary-100 text-primary-600'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {chapter.progress === 100 ? '✓' : chapter.chapter_number}
                  </div>

                  {/* Chapter Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                        {chapter.name}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.class}`}>
                        {badge.text}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mb-2 line-clamp-1">{chapter.description}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>{chapter.topics_count} topics</span>
                      <span>•</span>
                      <span>{chapter.completed_topics}/{chapter.topics_count} completed</span>
                    </div>
                  </div>

                  {/* Progress Ring */}
                  <div className="ml-5 flex items-center gap-4">
                    <div className="relative w-16 h-16">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          stroke="currentColor"
                          strokeWidth="6"
                          fill="none"
                          className="text-gray-200"
                        />
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          stroke="currentColor"
                          strokeWidth="6"
                          fill="none"
                          strokeDasharray={`${chapter.progress * 1.76} 176`}
                          className={chapter.progress === 100 ? 'text-success-500' : 'text-primary-500'}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold text-gray-700">{chapter.progress}%</span>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-primary-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="h-1 bg-gray-100">
                  <div 
                    className={`h-full ${getProgressColor(chapter.progress)} transition-all duration-500`}
                    style={{ width: `${chapter.progress}%` }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
