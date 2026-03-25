'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import type { VARKStyle, VARKAssessmentQuestion } from '@/types';

const VARK_QUESTIONS: VARKAssessmentQuestion[] = [
  {
    id: 1,
    question: 'When learning something new, you prefer to:',
    options: {
      visual: 'Watch a video or look at diagrams',
      auditory: 'Listen to someone explain it',
      reading: 'Read about it in a textbook',
      kinesthetic: 'Try it yourself hands-on',
    },
  },
  {
    id: 2,
    question: 'To remember a phone number, you would:',
    options: {
      visual: 'Picture the numbers in your mind',
      auditory: 'Say the numbers out loud repeatedly',
      reading: 'Write the numbers down',
      kinesthetic: 'Remember the pattern of pressing buttons',
    },
  },
  {
    id: 3,
    question: 'When assembling furniture, you prefer to:',
    options: {
      visual: 'Look at the pictures and diagrams',
      auditory: 'Have someone read the instructions to you',
      reading: 'Read the written instructions carefully',
      kinesthetic: 'Just start putting it together',
    },
  },
  {
    id: 4,
    question: 'You remember people best by their:',
    options: {
      visual: 'Face or appearance',
      auditory: 'Voice or what they said',
      reading: 'Name (written)',
      kinesthetic: 'Actions or what you did together',
    },
  },
  {
    id: 5,
    question: 'In your free time, you most enjoy:',
    options: {
      visual: 'Watching movies or looking at art',
      auditory: 'Listening to music or podcasts',
      reading: 'Reading books or articles',
      kinesthetic: 'Sports or hands-on hobbies',
    },
  },
  {
    id: 6,
    question: 'When giving directions, you would:',
    options: {
      visual: 'Draw a map or show pictures',
      auditory: 'Verbally explain the route',
      reading: 'Write down the directions',
      kinesthetic: 'Walk with them to show the way',
    },
  },
  {
    id: 7,
    question: 'When studying for an exam, you prefer to:',
    options: {
      visual: 'Use charts, diagrams, and colors',
      auditory: 'Discuss topics with others or record notes',
      reading: 'Make detailed written notes',
      kinesthetic: 'Practice problems or create models',
    },
  },
  {
    id: 8,
    question: 'You find it easier to understand:',
    options: {
      visual: 'Graphs and flowcharts',
      auditory: 'Lectures and discussions',
      reading: 'Textbooks and written materials',
      kinesthetic: 'Labs and practical experiments',
    },
  },
  {
    id: 9,
    question: 'When cooking a new recipe, you would:',
    options: {
      visual: 'Look at pictures of each step',
      auditory: 'Listen to someone explain how to make it',
      reading: 'Follow the written recipe carefully',
      kinesthetic: 'Just start cooking and figure it out',
    },
  },
  {
    id: 10,
    question: 'You would rather attend:',
    options: {
      visual: 'An art exhibition or movie',
      auditory: 'A concert or lecture',
      reading: 'A book reading or library event',
      kinesthetic: 'A dance class or sports event',
    },
  },
];

export default function AssessmentPage() {
  const router = useRouter();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<VARKStyle[]>([]);
  const [showIntro, setShowIntro] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<{
    visual: number;
    auditory: number;
    reading: number;
    kinesthetic: number;
    primary: VARKStyle;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const handleAnswer = (style: VARKStyle) => {
    const newAnswers = [...answers, style];
    setAnswers(newAnswers);

    if (currentQuestion < VARK_QUESTIONS.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Calculate results
      const counts = {
        visual: newAnswers.filter((a) => a === 'visual').length,
        auditory: newAnswers.filter((a) => a === 'auditory').length,
        reading: newAnswers.filter((a) => a === 'reading').length,
        kinesthetic: newAnswers.filter((a) => a === 'kinesthetic').length,
      };

      const total = VARK_QUESTIONS.length;
      const percentages = {
        visual: Math.round((counts.visual / total) * 100),
        auditory: Math.round((counts.auditory / total) * 100),
        reading: Math.round((counts.reading / total) * 100),
        kinesthetic: Math.round((counts.kinesthetic / total) * 100),
      };

      const primary = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]) as VARKStyle;

      setResults({ ...percentages, primary });
      setShowResults(true);
    }
  };

  const saveResults = async () => {
    if (!results) return;
    setSaving(true);

    try {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('learning_styles') as any).upsert({
          user_id: user.id,
          visual_score: results.visual,
          auditory_score: results.auditory,
          reading_score: results.reading,
          kinesthetic_score: results.kinesthetic,
          dominant_style: results.primary,
          assessment_date: new Date().toISOString(),
        });
      }

      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to save results:', error);
    } finally {
      setSaving(false);
    }
  };

  if (showIntro) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 pb-16">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-3xl flex items-center justify-center text-4xl mx-auto shadow-xl shadow-primary-500/30 mb-6">
              🎯
            </div>
            <h1 className="text-3xl font-bold mb-4">Discover Your Learning Style</h1>
            <p className="text-gray-600 text-lg max-w-xl mx-auto">
              Answer 10 quick questions to find out how you learn best.
              This helps our AI Guru personalize everything for you.
            </p>

            <div className="flex justify-center gap-6 my-8">
              {[
                { icon: '👁️', name: 'Visual', color: 'bg-blue-100' },
                { icon: '👂', name: 'Auditory', color: 'bg-green-100' },
                { icon: '📖', name: 'Reading', color: 'bg-yellow-100' },
                { icon: '🖐️', name: 'Kinesthetic', color: 'bg-red-100' },
              ].map((style) => (
                <div key={style.name} className="text-center">
                  <div className={`w-16 h-16 ${style.color} rounded-full flex items-center justify-center text-2xl mb-2`}>
                    {style.icon}
                  </div>
                  <span className="text-sm font-medium text-gray-600">{style.name}</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowIntro(false)}
              className="btn-primary text-lg px-8 py-4"
            >
              Start Assessment →
            </button>
            <p className="mt-3 text-sm text-gray-500">Takes about 2 minutes</p>
          </div>

          {/* FOR PARENTS & TEACHERS — Why This Matters */}
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">For Parents &amp; Teachers</h2>
            <p className="text-gray-600 mb-6">
              MyCupIsEmpty is not just another tutoring app. We build the <strong>whole human</strong> — academics,
              thinking ability, character, and life skills — all woven into one learning journey.
            </p>

            <h3 className="text-lg font-bold text-gray-800 mb-4">Our 20+ Teaching Methods</h3>
            <p className="text-sm text-gray-500 mb-4">
              Based on your child&apos;s VARK learning style, our AI selects the best teaching approach:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              {[
                { name: 'Feynman Technique', desc: 'Explain complex ideas in simple words — if you can teach it to a 5-year-old, you truly understand it.', icon: '🧠', tag: 'Modern' },
                { name: 'Socratic Method', desc: 'Learning through guided questions — the student discovers answers themselves, building deeper understanding.', icon: '❓', tag: 'Classical' },
                { name: 'Gurukul Method', desc: 'The ancient Guru-Shishya tradition of personalized mentoring through dialogue and respect.', icon: '🙏', tag: 'Indian' },
                { name: 'Vedic Math', desc: 'Ancient Indian mathematical sutras for faster, more elegant problem-solving.', icon: '🕉️', tag: 'Indian' },
                { name: 'Mind Mapping', desc: 'Visual branching from central concepts — perfect for visual learners who think in connections.', icon: '🗺️', tag: 'Modern' },
                { name: 'Storytelling (Katha)', desc: 'Learning through narratives — the Kathasaritsagara tradition of teaching through memorable stories.', icon: '📖', tag: 'Indian' },
                { name: 'Spaced Repetition', desc: 'Scientifically proven: reviewing at increasing intervals builds long-term memory.', icon: '🔄', tag: 'Scientific' },
                { name: 'Active Recall', desc: 'Test yourself immediately after learning — the most effective memory technique known to science.', icon: '🧪', tag: 'Scientific' },
                { name: 'Project-Based Learning', desc: 'Build real projects to learn concepts — hands-on, practical, and deeply engaging.', icon: '🏗️', tag: 'Modern' },
                { name: 'Visualization (Dhyana)', desc: 'Create vivid mental images of concepts — uses the meditative tradition for deeper understanding.', icon: '🧘', tag: 'Indian' },
              ].map((method) => (
                <div key={method.name} className="flex gap-3 p-3 rounded-xl border border-gray-100 hover:border-primary-200 transition-all">
                  <span className="text-2xl flex-shrink-0">{method.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900 text-sm">{method.name}</h4>
                      <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">{method.tag}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{method.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <h3 className="text-lg font-bold text-gray-800 mb-4">How We Build Character</h3>
            <p className="text-sm text-gray-500 mb-4">
              Character development is woven into every learning session — not taught separately.
              Our framework draws from four pillars of Indian wisdom:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
                <h4 className="font-bold text-orange-800 mb-1">Ishwar Chandra Vidyasagar</h4>
                <p className="text-sm text-orange-700">
                  Compassion (Daya), Perseverance (Adhyavasaya), Truthfulness, Self-Reliance.
                  The &quot;Ocean of Compassion&quot; who walked miles barefoot to school and reformed education for all.
                </p>
              </div>
              <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                <h4 className="font-bold text-purple-800 mb-1">Bhagavad Gita</h4>
                <p className="text-sm text-purple-700">
                  Karma Yoga (selfless action), Equanimity (Samatva), Self-Discipline (Atma-sanyama).
                  Focus on effort, not results. Stay balanced in success and failure.
                </p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <h4 className="font-bold text-blue-800 mb-1">Indian Shastra</h4>
                <p className="text-sm text-blue-700">
                  Love of Learning (Sa Vidya Ya Vimuktaye), Dharma (doing what is right),
                  Humility (Vidya Dadati Vinayam). True education liberates the mind.
                </p>
              </div>
              <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                <h4 className="font-bold text-green-800 mb-1">Bratachari Movement</h4>
                <p className="text-sm text-green-700">
                  Gurusaday Dutt&apos;s 5 vows: Knowledge, Labor, Truth, Unity, Joy.
                  Complete youth development through culture, fitness, and character.
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <p className="text-sm text-gray-600 italic">
                <strong>Note:</strong> Character development in MyCupIsEmpty is about self-management,
                respect, accountability, kindness, and practical wisdom — NOT religious instruction
                or moral policing. These are universal values expressed through India&apos;s rich cultural heritage.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showResults && results) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 flex items-center justify-center p-4">
        <div className="max-w-xl w-full">
          <div className="bg-white rounded-3xl shadow-xl p-8 text-center">
            <div className="mb-6">
              <div className="text-5xl mb-4">🎉</div>
              <h1 className="text-2xl font-bold mb-2">Your Learning Style Results</h1>
              <p className="text-gray-600">
                You are primarily a <span className="font-bold text-primary-600 capitalize">{results.primary}</span> Learner!
              </p>
            </div>

            <div className="space-y-4 mb-8">
              {[
                { key: 'visual' as const, icon: '👁️', label: 'Visual', color: 'bg-blue-500' },
                { key: 'auditory' as const, icon: '👂', label: 'Auditory', color: 'bg-green-500' },
                { key: 'reading' as const, icon: '📖', label: 'Reading', color: 'bg-yellow-500' },
                { key: 'kinesthetic' as const, icon: '🖐️', label: 'Kinesthetic', color: 'bg-red-500' },
              ].map((style) => (
                <div key={style.key} className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-xl">
                    {style.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="font-medium">{style.label}</span>
                      <span className="font-bold">{results[style.key]}%</span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className={`h-full ${style.color} rounded-full transition-all duration-500`}
                        style={{ width: `${results[style.key]}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-primary-50 rounded-2xl p-4 mb-6 text-left">
              <div className="font-bold text-primary-700 mb-2 flex items-center gap-2">
                <span>💡</span>
                What this means for you:
              </div>
              <p className="text-sm text-primary-600">
                {results.primary === 'visual' &&
                  'You learn best through images, diagrams, charts, and visual representations. We\'ll show you lots of visual content!'}
                {results.primary === 'auditory' &&
                  'You learn best through listening and discussion. We\'ll provide audio explanations and encourage verbal practice!'}
                {results.primary === 'reading' &&
                  'You learn best through reading and writing. We\'ll give you detailed text content and encourage note-taking!'}
                {results.primary === 'kinesthetic' &&
                  'You learn best through hands-on practice. We\'ll provide interactive activities and practical examples!'}
              </p>
            </div>

            <button
              onClick={saveResults}
              disabled={saving}
              className="btn-primary w-full py-4 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Continue to Dashboard →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const question = VARK_QUESTIONS[currentQuestion];
  const progress = ((currentQuestion + 1) / VARK_QUESTIONS.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-3xl shadow-xl p-8">
          {/* Progress */}
          <div className="flex items-center gap-4 mb-8">
            <div className="flex-1 progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="font-bold text-gray-500">
              {currentQuestion + 1}/{VARK_QUESTIONS.length}
            </span>
          </div>

          {/* Question */}
          <h2 className="text-xl font-bold mb-6">{question.question}</h2>

          {/* Options */}
          <div className="space-y-3">
            {(Object.entries(question.options) as [VARKStyle, string][]).map(([style, text]) => (
              <button
                key={style}
                onClick={() => handleAnswer(style)}
                className="w-full flex items-center gap-4 p-4 bg-gray-50 hover:bg-primary-50 border-2 border-gray-200 hover:border-primary-300 rounded-2xl transition-all text-left group"
              >
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl border group-hover:border-primary-300">
                  {style === 'visual' && '👁️'}
                  {style === 'auditory' && '👂'}
                  {style === 'reading' && '📖'}
                  {style === 'kinesthetic' && '🖐️'}
                </div>
                <span className="flex-1 font-medium">{text}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
