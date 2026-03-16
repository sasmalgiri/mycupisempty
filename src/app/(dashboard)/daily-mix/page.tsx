'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

interface SpacedRepItem {
  id: string;
  question_text: string;
  answer_text: string;
  difficulty: string;
  topics?: { title: string };
}

interface MixData {
  spaced_rep_items: SpacedRepItem[];
  new_concept: {
    topic_id: string;
    current_band: string;
    topics?: { id: string; title: string; description: string; subject_id: string };
  } | null;
  habit_check: {
    id: string;
    habit_id: string;
    habit_definitions?: { id: string; name: string; description: string; category: string; icon: string };
  } | null;
  reflection: { type: string; prompt: string };
  challenge_item: {
    id: string;
    question_text: string;
    options: string[];
    correct_answer: string;
    explanation: string;
  } | null;
  reflection_response?: string;
  challenge_answer?: string;
  challenge_correct?: boolean;
}

interface Session {
  id: string;
  session_date: string;
  mix_data: MixData;
  status: string;
  steps_completed: string[];
  xp_earned: number;
  started_at: string | null;
  completed_at: string | null;
}

const STEPS = ['spaced_rep', 'concept', 'habit', 'reflection', 'challenge'] as const;
type StepName = typeof STEPS[number];

const STEP_LABELS: Record<StepName, string> = {
  spaced_rep: 'Review',
  concept: 'Learn',
  habit: 'Habit',
  reflection: 'Reflect',
  challenge: 'Challenge',
};

const STEP_ICONS: Record<StepName, string> = {
  spaced_rep: '🔄',
  concept: '💡',
  habit: '✅',
  reflection: '🪞',
  challenge: '⚡',
};

export default function DailyMixPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  // Spaced rep state
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const [cardRatings, setCardRatings] = useState<Record<string, number>>({});

  // Habit state
  const [habitDone, setHabitDone] = useState<boolean | null>(null);

  // Reflection state
  const [reflectionText, setReflectionText] = useState('');

  // Challenge state
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [challengeSubmitted, setChallengeSubmitted] = useState(false);

  const fetchSession = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/daily-mix');
      const json = await res.json();
      if (json.success && json.data) {
        setSession(json.data);
        if (json.data.status === 'completed') {
          setIsFinished(true);
        } else if (json.data.steps_completed?.length > 0) {
          // Resume from where they left off
          const completed = json.data.steps_completed as string[];
          const nextIdx = STEPS.findIndex(s => !completed.includes(s));
          setCurrentStep(nextIdx >= 0 ? nextIdx : STEPS.length);
        }
      } else {
        setError(json.error || 'Failed to load daily mix');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const postAction = async (action: string, data?: any) => {
    if (!session) return null;
    try {
      const res = await fetch('/api/daily-mix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, session_id: session.id, data }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setSession(json.data);
        return json.data;
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleStart = async () => {
    await postAction('start');
    setCurrentStep(0);
  };

  const handleCompleteSpacedRep = async () => {
    const ratings = Object.entries(cardRatings).map(([item_id, quality]) => ({
      item_id,
      quality,
    }));
    await postAction('complete_spaced_rep', { ratings });
    setCurrentStep(1);
  };

  const handleCompleteConcept = async () => {
    await postAction('complete_concept');
    setCurrentStep(2);
  };

  const handleCompleteHabit = async (completed: boolean) => {
    setHabitDone(completed);
    const habitId = session?.mix_data?.habit_check?.habit_id;
    await postAction('complete_habit', { habit_id: habitId, completed });
    setCurrentStep(3);
  };

  const handleCompleteReflection = async () => {
    await postAction('complete_reflection', { response: reflectionText });
    setCurrentStep(4);
  };

  const handleCompleteChallenge = async () => {
    const correct = selectedAnswer === session?.mix_data?.challenge_item?.correct_answer;
    setChallengeSubmitted(true);
    await postAction('complete_challenge', { answer: selectedAnswer, correct });
  };

  const handleFinish = async () => {
    const result = await postAction('finish');
    if (result) {
      setIsFinished(true);
    }
  };

  const flipCard = (index: number) => {
    setFlippedCards(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const rateCard = (itemId: string, quality: number) => {
    setCardRatings(prev => ({ ...prev, [itemId]: quality }));
  };

  // Progress calculation
  const stepsCompleted = session?.steps_completed?.length || 0;
  const progressPercent = (stepsCompleted / STEPS.length) * 100;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 border-4 border-primary-200 border-t-primary-500 rounded-full"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <p className="text-4xl mb-4">😔</p>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Oops!</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={fetchSession}
            className="px-6 py-3 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Already completed today
  if (isFinished && session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="bg-white rounded-3xl shadow-2xl p-8 max-w-lg w-full text-center relative overflow-hidden"
        >
          {/* Confetti-like decorative elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-3 h-3 rounded-full"
                style={{
                  background: ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'][i % 5],
                  left: `${Math.random() * 100}%`,
                  top: `-10%`,
                }}
                animate={{
                  y: ['0vh', '110vh'],
                  x: [0, (Math.random() - 0.5) * 100],
                  rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)],
                }}
                transition={{
                  duration: 2 + Math.random() * 2,
                  repeat: Infinity,
                  delay: Math.random() * 2,
                  ease: 'easeIn',
                }}
              />
            ))}
          </div>

          <div className="relative z-10">
            <motion.p
              className="text-6xl mb-4"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              🎉
            </motion.p>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-secondary-500 bg-clip-text text-transparent mb-2">
              Your Daily Mix is Complete!
            </h1>
            <p className="text-gray-500 mb-6">Great job today! Come back tomorrow for a fresh session.</p>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-gradient-to-br from-warning-50 to-warning-100 rounded-2xl p-4">
                <p className="text-3xl font-bold text-warning-600">+{session.xp_earned}</p>
                <p className="text-sm text-warning-500">XP Earned</p>
              </div>
              <div className="bg-gradient-to-br from-success-50 to-success-100 rounded-2xl p-4">
                <p className="text-3xl font-bold text-success-600">
                  {session.steps_completed?.length || 0}/{STEPS.length}
                </p>
                <p className="text-sm text-success-500">Steps Done</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 justify-center mb-8">
              {STEPS.map(step => {
                const done = session.steps_completed?.includes(step);
                return (
                  <div
                    key={step}
                    className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 ${
                      done
                        ? 'bg-success-100 text-success-700'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    <span>{STEP_ICONS[step]}</span>
                    <span>{STEP_LABELS[step]}</span>
                    {done && <span>&#10003;</span>}
                  </div>
                );
              })}
            </div>

            <Link
              href="/dashboard"
              className="inline-block px-8 py-3 bg-gradient-to-r from-primary-500 to-secondary-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
            >
              Back to Dashboard
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  const mix = session?.mix_data;
  if (!mix || !session) return null;

  // If not started yet, show welcome
  if (session.status === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-white rounded-3xl shadow-2xl p-8 max-w-lg w-full text-center"
        >
          <motion.p
            className="text-6xl mb-4"
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            🎯
          </motion.p>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Daily Mix</h1>
          <p className="text-gray-500 mb-6">
            A personalized 5-10 minute session combining review, learning, habits, reflection, and a challenge!
          </p>

          <div className="flex flex-wrap gap-3 justify-center mb-8">
            {STEPS.map(step => (
              <div
                key={step}
                className="bg-gradient-to-br from-primary-50 to-secondary-50 px-4 py-2 rounded-full text-sm font-medium text-primary-700 flex items-center gap-2"
              >
                <span>{STEP_ICONS[step]}</span>
                <span>{STEP_LABELS[step]}</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleStart}
            className="px-10 py-4 bg-gradient-to-r from-primary-500 to-secondary-500 text-white text-lg rounded-2xl font-bold hover:shadow-xl hover:scale-105 transition-all"
          >
            Start Today&apos;s Mix
          </button>
        </motion.div>
      </div>
    );
  }

  // Step-by-step flow
  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-gray-900">Daily Mix</h1>
            <span className="text-sm font-medium text-gray-500">
              {stepsCompleted}/{STEPS.length} steps
            </span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
          <div className="flex justify-between mt-2">
            {STEPS.map((step, idx) => {
              const done = session.steps_completed?.includes(step);
              const active = idx === currentStep;
              return (
                <div
                  key={step}
                  className={`flex flex-col items-center ${
                    done ? 'text-success-500' : active ? 'text-primary-600' : 'text-gray-300'
                  }`}
                >
                  <span className="text-lg">{done ? '✓' : STEP_ICONS[step]}</span>
                  <span className="text-xs mt-1 font-medium hidden sm:block">{STEP_LABELS[step]}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          {/* Step 0: Spaced Repetition */}
          {currentStep === 0 && (
            <motion.div
              key="spaced_rep"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -50, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-3xl shadow-lg p-6 md:p-8"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl flex items-center justify-center text-2xl text-white shadow-lg">
                  🔄
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Spaced Review</h2>
                  <p className="text-sm text-gray-500">Tap cards to flip, then rate your recall</p>
                </div>
              </div>

              {mix.spaced_rep_items.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-4xl mb-3">🎉</p>
                  <p className="text-gray-600 font-medium">No reviews due today! You&apos;re all caught up.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {mix.spaced_rep_items.map((item, idx) => (
                    <div key={item.id} className="border border-gray-100 rounded-2xl overflow-hidden">
                      <button
                        onClick={() => flipCard(idx)}
                        className="w-full p-5 text-left hover:bg-gray-50 transition-colors"
                      >
                        <p className="text-xs font-semibold text-primary-500 mb-1 uppercase tracking-wide">
                          {item.topics?.title || 'Topic'}
                        </p>
                        <p className="font-medium text-gray-900">
                          {flippedCards.has(idx) ? item.answer_text : item.question_text}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                          {flippedCards.has(idx) ? 'Tap to see question' : 'Tap to reveal answer'}
                        </p>
                      </button>

                      {flippedCards.has(idx) && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          className="px-5 pb-4 flex gap-2"
                        >
                          {[
                            { label: 'Forgot', quality: 0, color: 'bg-red-100 text-red-700 hover:bg-red-200' },
                            { label: 'Hard', quality: 1, color: 'bg-orange-100 text-orange-700 hover:bg-orange-200' },
                            { label: 'Good', quality: 2, color: 'bg-green-100 text-green-700 hover:bg-green-200' },
                            { label: 'Easy', quality: 3, color: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
                          ].map(btn => (
                            <button
                              key={btn.quality}
                              onClick={() => rateCard(item.id, btn.quality)}
                              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${btn.color} ${
                                cardRatings[item.id] === btn.quality
                                  ? 'ring-2 ring-offset-1 ring-primary-400 scale-105'
                                  : ''
                              }`}
                            >
                              {btn.label}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={handleCompleteSpacedRep}
                className="w-full mt-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-2xl font-bold text-lg hover:shadow-lg transition-all"
              >
                Continue
              </button>
            </motion.div>
          )}

          {/* Step 1: New Concept */}
          {currentStep === 1 && (
            <motion.div
              key="concept"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -50, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-3xl shadow-lg p-6 md:p-8"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center text-2xl text-white shadow-lg">
                  💡
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">New Concept</h2>
                  <p className="text-sm text-gray-500">Something new to explore today</p>
                </div>
              </div>

              {mix.new_concept?.topics ? (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {mix.new_concept.topics.title}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {mix.new_concept.topics.description || 'Explore this topic to strengthen your foundation.'}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-white/80 rounded-full text-xs font-semibold text-amber-700">
                      {mix.new_concept.current_band}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-4xl mb-3">🌟</p>
                  <p className="text-gray-600 font-medium">No new concepts right now. Keep it up!</p>
                </div>
              )}

              {mix.new_concept?.topics && (
                <Link
                  href={`/subjects`}
                  className="block w-full text-center py-3 bg-amber-100 text-amber-700 rounded-xl font-semibold hover:bg-amber-200 transition-colors mb-4"
                >
                  Start Learning
                </Link>
              )}

              <button
                onClick={handleCompleteConcept}
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-bold text-lg hover:shadow-lg transition-all"
              >
                Continue
              </button>
            </motion.div>
          )}

          {/* Step 2: Habit Check */}
          {currentStep === 2 && (
            <motion.div
              key="habit"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -50, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-3xl shadow-lg p-6 md:p-8"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center text-2xl text-white shadow-lg">
                  ✅
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Habit Check</h2>
                  <p className="text-sm text-gray-500">Track your daily habits</p>
                </div>
              </div>

              {mix.habit_check?.habit_definitions ? (
                <div className="text-center py-6">
                  <p className="text-5xl mb-4">{mix.habit_check.habit_definitions.icon || '📏'}</p>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {mix.habit_check.habit_definitions.name}
                  </h3>
                  <p className="text-gray-500 mb-8">
                    {mix.habit_check.habit_definitions.description || 'Did you complete this habit today?'}
                  </p>

                  {habitDone === null ? (
                    <div className="flex gap-4 justify-center">
                      <button
                        onClick={() => handleCompleteHabit(true)}
                        className="flex-1 max-w-[160px] py-4 bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-700 rounded-2xl font-bold text-lg hover:shadow-lg hover:scale-105 transition-all"
                      >
                        Yes! ✓
                      </button>
                      <button
                        onClick={() => handleCompleteHabit(false)}
                        className="flex-1 max-w-[160px] py-4 bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600 rounded-2xl font-bold text-lg hover:shadow-lg hover:scale-105 transition-all"
                      >
                        Not yet
                      </button>
                    </div>
                  ) : (
                    <motion.div
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      className={`inline-block px-8 py-4 rounded-2xl font-bold text-lg ${
                        habitDone
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {habitDone ? 'Awesome! Keep going!' : 'No worries, try tomorrow!'}
                    </motion.div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-4xl mb-3">📏</p>
                  <p className="text-gray-600 font-medium mb-6">No habits set up yet.</p>
                  <Link
                    href="/habits"
                    className="text-primary-600 font-semibold hover:underline"
                  >
                    Set up your habits
                  </Link>
                  <button
                    onClick={() => {
                      postAction('complete_habit', { completed: false });
                      setCurrentStep(3);
                    }}
                    className="w-full mt-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-bold text-lg hover:shadow-lg transition-all"
                  >
                    Continue
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* Step 3: Reflection */}
          {currentStep === 3 && (
            <motion.div
              key="reflection"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -50, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-3xl shadow-lg p-6 md:p-8"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-500 rounded-2xl flex items-center justify-center text-2xl text-white shadow-lg">
                  🪞
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Reflection</h2>
                  <p className="text-sm text-gray-500">Take a moment to think</p>
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 mb-6">
                <p className="text-xs font-semibold text-purple-500 uppercase tracking-wide mb-2">
                  {mix.reflection.type}
                </p>
                <p className="text-lg font-medium text-gray-900">
                  {mix.reflection.prompt}
                </p>
              </div>

              <textarea
                value={reflectionText}
                onChange={(e) => setReflectionText(e.target.value)}
                placeholder="Write your thoughts here..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent resize-none mb-6"
              />

              <button
                onClick={handleCompleteReflection}
                className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl font-bold text-lg hover:shadow-lg transition-all"
              >
                Continue
              </button>
            </motion.div>
          )}

          {/* Step 4: Quick Challenge */}
          {currentStep === 4 && (
            <motion.div
              key="challenge"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -50, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-3xl shadow-lg p-6 md:p-8"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-rose-400 to-red-500 rounded-2xl flex items-center justify-center text-2xl text-white shadow-lg">
                  ⚡
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Quick Challenge</h2>
                  <p className="text-sm text-gray-500">Test your knowledge!</p>
                </div>
              </div>

              {mix.challenge_item ? (
                <>
                  <p className="text-lg font-medium text-gray-900 mb-6">
                    {mix.challenge_item.question_text}
                  </p>

                  <div className="space-y-3 mb-6">
                    {(mix.challenge_item.options || []).map((option: string, idx: number) => {
                      const letter = String.fromCharCode(65 + idx);
                      const isSelected = selectedAnswer === option;
                      const isCorrect = option === mix.challenge_item!.correct_answer;
                      let optionStyle = 'border-gray-200 hover:border-primary-300 hover:bg-primary-50';

                      if (challengeSubmitted) {
                        if (isCorrect) {
                          optionStyle = 'border-green-400 bg-green-50 text-green-800';
                        } else if (isSelected && !isCorrect) {
                          optionStyle = 'border-red-400 bg-red-50 text-red-800';
                        } else {
                          optionStyle = 'border-gray-200 opacity-50';
                        }
                      } else if (isSelected) {
                        optionStyle = 'border-primary-400 bg-primary-50 ring-2 ring-primary-200';
                      }

                      return (
                        <button
                          key={idx}
                          onClick={() => !challengeSubmitted && setSelectedAnswer(option)}
                          disabled={challengeSubmitted}
                          className={`w-full text-left px-5 py-4 border-2 rounded-2xl transition-all flex items-center gap-3 ${optionStyle}`}
                        >
                          <span className="w-8 h-8 flex-shrink-0 rounded-full bg-gray-100 flex items-center justify-center font-bold text-sm">
                            {letter}
                          </span>
                          <span className="font-medium">{option}</span>
                        </button>
                      );
                    })}
                  </div>

                  {challengeSubmitted && mix.challenge_item.explanation && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6"
                    >
                      <p className="text-sm font-semibold text-blue-700 mb-1">Explanation</p>
                      <p className="text-sm text-blue-800">{mix.challenge_item.explanation}</p>
                    </motion.div>
                  )}

                  {!challengeSubmitted ? (
                    <button
                      onClick={handleCompleteChallenge}
                      disabled={!selectedAnswer}
                      className={`w-full py-4 rounded-2xl font-bold text-lg transition-all ${
                        selectedAnswer
                          ? 'bg-gradient-to-r from-rose-500 to-red-500 text-white hover:shadow-lg'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      Submit Answer
                    </button>
                  ) : (
                    <button
                      onClick={handleFinish}
                      className="w-full py-4 bg-gradient-to-r from-primary-500 to-secondary-500 text-white rounded-2xl font-bold text-lg hover:shadow-lg transition-all"
                    >
                      Finish Daily Mix
                    </button>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-4xl mb-3">🏆</p>
                  <p className="text-gray-600 font-medium mb-6">No challenge available today.</p>
                  <button
                    onClick={handleFinish}
                    className="w-full py-4 bg-gradient-to-r from-primary-500 to-secondary-500 text-white rounded-2xl font-bold text-lg hover:shadow-lg transition-all"
                  >
                    Finish Daily Mix
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
