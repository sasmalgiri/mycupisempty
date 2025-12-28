'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';

interface StudentDetail {
  id: string;
  full_name: string;
  email: string;
  current_class: number;
  school_name: string | null;
  created_at: string;
}

interface LearningStyle {
  visual_score: number;
  auditory_score: number;
  reading_score: number;
  kinesthetic_score: number;
  dominant_style: string;
  assessment_date: string;
}

interface UserStats {
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  level: number;
  total_questions_answered: number;
  correct_answers: number;
  total_time_spent_minutes: number;
}

interface TopicProgress {
  topic_id: string;
  topic_title: string;
  chapter_title: string;
  subject_name: string;
  status: string;
  progress_percentage: number;
  mastery_score: number;
}

export default function StudentDetailPage() {
  const params = useParams();
  const studentId = params.studentId as string;

  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [learningStyle, setLearningStyle] = useState<LearningStyle | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [topicProgress, setTopicProgress] = useState<TopicProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'vark' | 'progress'>('overview');

  useEffect(() => {
    fetchStudentData();
  }, [studentId]);

  const fetchStudentData = async () => {
    const supabase = createBrowserClient();

    try {
      // Fetch student profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, email, current_class, school_name, created_at')
        .eq('id', studentId)
        .single();

      if (profile) {
        setStudent(profile);

        // Fetch learning style
        const { data: style } = await supabase
          .from('learning_styles')
          .select('visual_score, auditory_score, reading_score, kinesthetic_score, dominant_style, assessment_date')
          .eq('user_id', studentId)
          .single();

        setLearningStyle(style);

        // Fetch user stats
        const { data: userStats } = await supabase
          .from('user_stats')
          .select('total_xp, current_streak, longest_streak, level, total_questions_answered, correct_answers, total_time_spent_minutes')
          .eq('user_id', studentId)
          .single();

        setStats(userStats);

        // Fetch topic progress
        const { data: progress } = await supabase
          .from('user_topic_progress')
          .select(`
            topic_id,
            status,
            progress_percentage,
            mastery_score,
            topics (
              title,
              chapters (
                title,
                subjects (name)
              )
            )
          `)
          .eq('user_id', studentId)
          .order('mastery_score', { ascending: true })
          .limit(10);

        if (progress) {
          const formattedProgress: TopicProgress[] = progress.map((p: any) => ({
            topic_id: p.topic_id,
            topic_title: p.topics?.title || 'Unknown',
            chapter_title: p.topics?.chapters?.title || 'Unknown',
            subject_name: p.topics?.chapters?.subjects?.name || 'Unknown',
            status: p.status,
            progress_percentage: p.progress_percentage || 0,
            mastery_score: p.mastery_score || 0,
          }));
          setTopicProgress(formattedProgress);
        }
      }
    } catch (error) {
      console.error('Error fetching student data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStyleColor = (style: string) => {
    switch (style) {
      case 'visual': return { bg: 'bg-purple-500', light: 'bg-purple-100', text: 'text-purple-700' };
      case 'auditory': return { bg: 'bg-blue-500', light: 'bg-blue-100', text: 'text-blue-700' };
      case 'reading': return { bg: 'bg-green-500', light: 'bg-green-100', text: 'text-green-700' };
      case 'kinesthetic': return { bg: 'bg-orange-500', light: 'bg-orange-100', text: 'text-orange-700' };
      default: return { bg: 'bg-gray-500', light: 'bg-gray-100', text: 'text-gray-700' };
    }
  };

  const getStyleRecommendations = (style: string) => {
    switch (style) {
      case 'visual':
        return [
          'Use diagrams, charts, and mind maps in explanations',
          'Provide color-coded notes and visual summaries',
          'Include videos and animations in learning materials',
          'Encourage drawing concepts and visual note-taking',
        ];
      case 'auditory':
        return [
          'Encourage participation in group discussions',
          'Use verbal explanations and storytelling',
          'Recommend audio resources and podcasts',
          'Allow verbal responses in assessments when possible',
        ];
      case 'reading':
        return [
          'Provide detailed written materials and textbooks',
          'Encourage extensive note-taking',
          'Assign reading tasks and written reports',
          'Use lists, bullet points, and structured content',
        ];
      case 'kinesthetic':
        return [
          'Include hands-on activities and experiments',
          'Allow movement during learning sessions',
          'Use role-playing and simulations',
          'Provide practice problems and real-world applications',
        ];
      default:
        return [];
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-bold text-gray-900">Student not found</h2>
        <Link href="/teacher/students" className="text-blue-600 hover:underline mt-4 inline-block">
          Back to Students
        </Link>
      </div>
    );
  }

  const accuracy = stats && stats.total_questions_answered > 0
    ? Math.round((stats.correct_answers / stats.total_questions_answered) * 100)
    : 0;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/teacher/students"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <span>←</span>
          <span>Back to Students</span>
        </Link>

        <div className="flex items-start gap-6">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-lg">
            {student.full_name.charAt(0)}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">{student.full_name}</h1>
            <p className="text-gray-600">Class {student.current_class} {student.school_name && `• ${student.school_name}`}</p>
            <p className="text-sm text-gray-500 mt-1">Joined {new Date(student.created_at).toLocaleDateString()}</p>
          </div>

          {learningStyle?.dominant_style && (
            <div className={`px-4 py-2 rounded-xl ${getStyleColor(learningStyle.dominant_style).light} ${getStyleColor(learningStyle.dominant_style).text} font-medium`}>
              {learningStyle.dominant_style === 'visual' && '👁️ Visual Learner'}
              {learningStyle.dominant_style === 'auditory' && '👂 Auditory Learner'}
              {learningStyle.dominant_style === 'reading' && '📖 Reading/Writing Learner'}
              {learningStyle.dominant_style === 'kinesthetic' && '🤸 Kinesthetic Learner'}
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{stats?.level || 1}</p>
          <p className="text-sm text-gray-500">Level</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{stats?.total_xp?.toLocaleString() || 0}</p>
          <p className="text-sm text-gray-500">Total XP</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">🔥 {stats?.current_streak || 0}</p>
          <p className="text-sm text-gray-500">Current Streak</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{accuracy}%</p>
          <p className="text-sm text-gray-500">Accuracy</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{Math.round((stats?.total_time_spent_minutes || 0) / 60)}h</p>
          <p className="text-sm text-gray-500">Study Time</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {[
          { id: 'overview', label: 'Overview', icon: '📊' },
          { id: 'vark', label: 'VARK Analysis', icon: '🧠' },
          { id: 'progress', label: 'Topic Progress', icon: '📚' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-3 font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Performance Summary */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Performance Summary</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Questions Answered</span>
                  <span className="font-medium">{stats?.total_questions_answered || 0}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Correct Answers</span>
                  <span className="font-medium text-green-600">{stats?.correct_answers || 0}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Longest Streak</span>
                  <span className="font-medium">{stats?.longest_streak || 0} days</span>
                </div>
              </div>
            </div>
          </div>

          {/* VARK Summary */}
          {learningStyle && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Learning Style Profile</h3>
              <div className="space-y-3">
                {[
                  { key: 'visual', label: 'Visual', score: learningStyle.visual_score, emoji: '👁️', color: 'bg-purple-500' },
                  { key: 'auditory', label: 'Auditory', score: learningStyle.auditory_score, emoji: '👂', color: 'bg-blue-500' },
                  { key: 'reading', label: 'Reading/Writing', score: learningStyle.reading_score, emoji: '📖', color: 'bg-green-500' },
                  { key: 'kinesthetic', label: 'Kinesthetic', score: learningStyle.kinesthetic_score, emoji: '🤸', color: 'bg-orange-500' },
                ].map(style => (
                  <div key={style.key}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="flex items-center gap-2">
                        <span>{style.emoji}</span>
                        <span className="text-gray-700">{style.label}</span>
                      </span>
                      <span className="font-medium text-gray-900">{style.score}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${style.color} rounded-full transition-all`}
                        style={{ width: `${style.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'vark' && learningStyle && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* VARK Scores */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-6">VARK Assessment Results</h3>

            <div className="grid grid-cols-2 gap-4 mb-6">
              {[
                { key: 'visual', label: 'Visual', score: learningStyle.visual_score, emoji: '👁️', color: 'from-purple-400 to-purple-600' },
                { key: 'auditory', label: 'Auditory', score: learningStyle.auditory_score, emoji: '👂', color: 'from-blue-400 to-blue-600' },
                { key: 'reading', label: 'Reading', score: learningStyle.reading_score, emoji: '📖', color: 'from-green-400 to-green-600' },
                { key: 'kinesthetic', label: 'Kinesthetic', score: learningStyle.kinesthetic_score, emoji: '🤸', color: 'from-orange-400 to-orange-600' },
              ].map(style => (
                <div
                  key={style.key}
                  className={`p-4 rounded-xl bg-gradient-to-br ${style.color} text-white ${
                    learningStyle.dominant_style === style.key ? 'ring-4 ring-yellow-400 ring-offset-2' : ''
                  }`}
                >
                  <span className="text-3xl">{style.emoji}</span>
                  <p className="text-2xl font-bold mt-2">{style.score}%</p>
                  <p className="text-sm opacity-90">{style.label}</p>
                  {learningStyle.dominant_style === style.key && (
                    <span className="text-xs bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full mt-2 inline-block">
                      Dominant
                    </span>
                  )}
                </div>
              ))}
            </div>

            <p className="text-sm text-gray-500">
              Assessment completed on {new Date(learningStyle.assessment_date).toLocaleDateString()}
            </p>
          </div>

          {/* Recommendations */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Teaching Recommendations</h3>
            <div className={`p-4 rounded-xl mb-4 ${getStyleColor(learningStyle.dominant_style).light}`}>
              <p className={`font-medium ${getStyleColor(learningStyle.dominant_style).text} mb-2`}>
                This student is primarily a {learningStyle.dominant_style} learner
              </p>
            </div>

            <ul className="space-y-3">
              {getStyleRecommendations(learningStyle.dominant_style).map((rec, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span className="text-gray-700">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {activeTab === 'progress' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Topic Progress (Areas Needing Attention)</h3>

          {topicProgress.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No progress data available yet</p>
          ) : (
            <div className="space-y-4">
              {topicProgress.map(topic => (
                <div key={topic.topic_id} className="p-4 rounded-xl border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium text-gray-900">{topic.topic_title}</p>
                      <p className="text-sm text-gray-500">{topic.subject_name} • {topic.chapter_title}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      topic.mastery_score >= 80 ? 'bg-green-100 text-green-700' :
                      topic.mastery_score >= 50 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {topic.mastery_score}% Mastery
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        topic.mastery_score >= 80 ? 'bg-green-500' :
                        topic.mastery_score >= 50 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${topic.progress_percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
