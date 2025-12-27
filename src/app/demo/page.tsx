'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function DemoPage() {
  const [activeTab, setActiveTab] = useState<'vark' | 'dashboard' | 'ai'>('vark');

  const demoFeatures = {
    vark: {
      title: 'VARK Learning Style Assessment',
      description: 'Discover how you learn best - Visual, Auditory, Reading, or Kinesthetic',
    },
    dashboard: {
      title: 'Personalized Dashboard',
      description: 'Track your progress, streaks, achievements, and learning journey',
    },
    ai: {
      title: 'AI Tutor',
      description: 'Get explanations in your preferred learning style from our AI',
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-50 to-secondary-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-primary-500/30">
                🧠
              </div>
              <span className="font-bold text-xl gradient-text">MyCupIsEmpty</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/" className="text-gray-600 hover:text-gray-900 font-medium">
                Home
              </Link>
              <Link href="/about" className="text-gray-600 hover:text-gray-900 font-medium">
                About
              </Link>
              <Link href="/login" className="btn-secondary text-sm">
                Log In
              </Link>
              <Link href="/signup" className="btn-primary text-sm">
                Get Started Free
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-16 pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-100 rounded-full text-primary-700 font-semibold text-sm mb-6">
            <span>🎬</span>
            <span>Interactive Demo</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-6">
            See <span className="gradient-text">MyCupIsEmpty</span> in Action
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Explore our key features and see how personalized learning works.
          </p>
        </div>
      </section>

      {/* Demo Tabs */}
      <section className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          {/* Tab Navigation */}
          <div className="flex justify-center gap-2 mb-8 flex-wrap">
            {[
              { id: 'vark', label: 'VARK Assessment', icon: '🎯' },
              { id: 'dashboard', label: 'Dashboard', icon: '📊' },
              { id: 'ai', label: 'AI Tutor', icon: '🤖' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'vark' | 'dashboard' | 'ai')}
                className={`
                  flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all
                  ${activeTab === tab.id
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                  }
                `}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Demo Content */}
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
            <div className="p-8 text-center border-b border-gray-100">
              <h2 className="text-2xl font-bold mb-2">
                {demoFeatures[activeTab].title}
              </h2>
              <p className="text-gray-600">
                {demoFeatures[activeTab].description}
              </p>
            </div>

            {/* Interactive Demo Area */}
            <div className="p-8 bg-gray-50 min-h-[400px]">
              {activeTab === 'vark' && <VARKDemo />}
              {activeTab === 'dashboard' && <DashboardDemo />}
              {activeTab === 'ai' && <AITutorDemo />}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-extrabold mb-4">Ready to Experience It Yourself?</h2>
          <p className="text-xl text-gray-600 mb-8">
            Create a free account and start your personalized learning journey today.
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Link
              href="/signup"
              className="btn-primary text-lg px-8 py-4"
            >
              Sign Up Free
            </Link>
            <Link
              href="/"
              className="btn-secondary text-lg px-8 py-4"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400">
            Made with love for Indian students.
          </p>
        </div>
      </footer>
    </div>
  );
}

// VARK Demo Component
function VARKDemo() {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const questions = [
    {
      id: 1,
      question: 'When learning a new skill, you prefer to:',
      options: {
        V: 'Watch a video or diagram showing how to do it',
        A: 'Listen to someone explain it step by step',
        R: 'Read written instructions carefully',
        K: 'Try it yourself and learn by doing',
      },
    },
    {
      id: 2,
      question: 'When giving directions to someone, you would:',
      options: {
        V: 'Draw a map or show pictures',
        A: 'Tell them verbally how to get there',
        R: 'Write down the directions',
        K: 'Walk with them and show the way',
      },
    },
  ];

  const handleAnswer = (type: string) => {
    setAnswers({ ...answers, [questions[currentQuestion].id]: type });
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-4 text-sm text-gray-500">
        Question {currentQuestion + 1} of {questions.length}
      </div>
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h3 className="text-xl font-bold mb-6">
          {questions[currentQuestion].question}
        </h3>
        <div className="space-y-3">
          {Object.entries(questions[currentQuestion].options).map(([type, option]) => (
            <button
              key={type}
              onClick={() => handleAnswer(type)}
              className={`
                w-full p-4 text-left rounded-xl border-2 transition-all
                ${answers[questions[currentQuestion].id] === type
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-primary-300'
                }
              `}
            >
              <span className="font-medium">{type}.</span> {option}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-4 text-sm text-gray-500 text-center">
        This is a demo. Sign up to take the full 16-question assessment!
      </p>
    </div>
  );
}

// Dashboard Demo Component
function DashboardDemo() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total XP', value: '2,450', icon: '⭐' },
          { label: 'Streak', value: '7 days', icon: '🔥' },
          { label: 'Accuracy', value: '84%', icon: '🎯' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl p-4 text-center shadow-sm">
            <div className="text-2xl mb-1">{stat.icon}</div>
            <div className="text-xl font-bold">{stat.value}</div>
            <div className="text-sm text-gray-500">{stat.label}</div>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h3 className="font-bold mb-4">Your Subjects</h3>
        <div className="space-y-3">
          {[
            { name: 'Mathematics', icon: '📐', progress: 65, color: '#6366F1' },
            { name: 'Science', icon: '🔬', progress: 48, color: '#8B5CF6' },
            { name: 'English', icon: '📖', progress: 72, color: '#EC4899' },
          ].map((subject) => (
            <div key={subject.name} className="flex items-center gap-4">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                style={{ backgroundColor: `${subject.color}20` }}
              >
                {subject.icon}
              </div>
              <div className="flex-1">
                <div className="font-medium">{subject.name}</div>
                <div className="h-2 bg-gray-100 rounded-full mt-1">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${subject.progress}%`, backgroundColor: subject.color }}
                  />
                </div>
              </div>
              <div className="font-bold">{subject.progress}%</div>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-4 text-sm text-gray-500 text-center">
        Sign up to track your real progress across all subjects!
      </p>
    </div>
  );
}

// AI Tutor Demo Component
function AITutorDemo() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hi! I am your AI tutor. I can explain concepts in your preferred learning style. Try asking me a question!',
    },
  ]);

  const handleSend = () => {
    if (!input.trim()) return;

    setMessages([
      ...messages,
      { role: 'user', content: input },
      {
        role: 'assistant',
        content: 'Great question! In the full version, I would explain this concept using your preferred VARK learning style. Visual learners get diagrams, auditory learners get conversational explanations, and kinesthetic learners get hands-on activities. Sign up to experience personalized AI tutoring!',
      },
    ]);
    setInput('');
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="h-64 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`
                  max-w-[80%] p-3 rounded-2xl
                  ${msg.role === 'user'
                    ? 'bg-primary-600 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }
                `}
              >
                {msg.content}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask a question..."
              className="flex-1 px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-primary-500"
            />
            <button
              onClick={handleSend}
              className="btn-primary px-6"
            >
              Send
            </button>
          </div>
        </div>
      </div>
      <p className="mt-4 text-sm text-gray-500 text-center">
        Sign up to chat with our AI tutor about any topic in the NCERT curriculum!
      </p>
    </div>
  );
}
