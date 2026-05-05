'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { CHARACTER_VALUES, getAgeFraming, getDailyPractice, getSourceQuote, type CharacterValue } from '@/lib/character-framework';
import { collectSignal, trackAnswer, trackTimeSpent, trackMood, trackFrustrationSignal, flushSignals, getMicroCheckIn, type MicroCheckIn } from '@/lib/learner-engine';
import LearningModePill, { type ExplanationMode } from '@/components/LearningModePill';
import ReadAloudButton from '@/components/ReadAloudButton';
import NextStepGuide from '@/components/NextStepGuide';
import PretestCard, { type PretestQuestion } from '@/components/PretestCard';
import ActiveBreak from '@/components/ActiveBreak';
import ExitEvalCard from '@/components/ExitEvalCard';
import ArenaPlayer from '@/components/arena/ArenaPlayer';
import TodaysPlanBanner from '@/components/TodaysPlanBanner';
import { pickNextGame, type MinigameId } from '@/lib/arena-signals';

interface SpacedRepItem {
  id: string;
  question_text: string;
  answer: any;
  item_type: string;
  topics?: { title: string };
}

interface Session {
  id: string;
  session_date: string;
  status: string;
  spaced_rep_items: SpacedRepItem[];
  new_concept: {
    topic_id: string;
    current_band: string;
    topics?: { id: string; title: string; description: string; subject_id: string };
  } | null;
  habit_check: {
    id: string;
    habit_id: string;
    habit_definitions?: { name: string; description: string; frequency: string; icon: string };
  } | null;
  reflection_prompt: { type: string; prompt: string };
  challenge_item: {
    id: string;
    question_text: string;
    options: string[];
    correct_answer: string;
    explanation: string;
  } | null;
  spaced_rep_total: number;
  spaced_rep_completed: number;
  new_concept_completed: boolean;
  habit_checked: boolean;
  reflection_done: boolean;
  challenge_done: boolean;
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

/**
 * Get today's character value — rotates daily through all 15 values
 */
function getTodaysCharacterValue(): CharacterValue {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return CHARACTER_VALUES[dayOfYear % CHARACTER_VALUES.length];
}

const SOURCE_LABELS: Record<string, string> = {
  vidyasagar: 'Ishwar Chandra Vidyasagar',
  gita: 'Bhagavad Gita',
  shastra: 'Indian Shastra',
  bratachari: 'Bratachari Movement',
};

// Mode-branched entry point for the New Concept step. Each learner archetype
// sees a different door into the same topic — visual students get a concept
// map shortcut, hands-on students jump to an interactive activity, storytellers
// get a companion narration, etc. Targets are real pages that exist today;
// hands-on routes to /activities (virtual-lab activity) because /lab isn't a
// page yet. Opens in a new tab so the Daily Mix session isn't lost.
function ModeEntryPoint({
  mode,
  topic,
  userId,
}: {
  mode: ExplanationMode;
  topic: { id: string; title: string; subject_id?: string };
  userId: string;
}) {
  const subjectId = topic.subject_id;

  const primaries: Record<ExplanationMode, { label: string; href: string; icon: string; blurb: string }> = {
    visual: {
      icon: '🗺',
      label: 'See it on the concept map',
      blurb: 'See how this connects to what you already know.',
      href: subjectId ? `/subjects/${subjectId}?topic=${topic.id}&view=concept-map` : '/subjects',
    },
    story: {
      icon: '📖',
      label: 'Hear the story from your companion',
      blurb: 'Your subject companion will narrate the idea.',
      href: subjectId ? `/companions?subject=${subjectId}&topic=${topic.id}&mode=story` : '/companions',
    },
    example_first: {
      icon: '🎯',
      label: 'Show me 2 examples first',
      blurb: "We'll infer the rule from examples together.",
      href: `/guru?topic=${topic.id}&mode=example_first&q=${encodeURIComponent('Give me 2 worked examples of ' + topic.title + ', then help me spot the rule.')}`,
    },
    step_by_step: {
      icon: '📋',
      label: 'Walk me through it step by step',
      blurb: 'A clear numbered breakdown, your pace.',
      href: subjectId ? `/subjects/${subjectId}?topic=${topic.id}` : '/subjects',
    },
    socratic: {
      icon: '❓',
      label: 'Ask me questions — I want to think it out',
      blurb: "The Guru leads with questions, not answers.",
      href: `/guru?topic=${topic.id}&socratic=1&mode=socratic&q=${encodeURIComponent('Guide me through ' + topic.title + ' by asking me questions.')}`,
    },
    drill: {
      icon: '⚡',
      label: 'Skip to rapid practice',
      blurb: 'Flashcards and quick-fire — minimal theory.',
      href: `/flashcards?topic=${topic.id}`,
    },
    hands_on: {
      icon: '🧪',
      label: 'Try it in an interactive activity',
      blurb: 'Build it, try it, see what breaks.',
      href: `/activities?topic=${topic.id}${subjectId ? `&subject=${subjectId}` : ''}&kind=virtual_lab`,
    },
  };

  const primary = primaries[mode] || primaries.step_by_step;

  const onEnter = () => {
    // Record that the student engaged with the concept via their preferred mode.
    // This lets the adaptation loop connect mode choice → later outcomes without
    // forcing the student to finish inside Daily Mix.
    collectSignal({
      user_id: userId || 'anonymous',
      signal_type: 'concept_mode_entered',
      category: 'preference',
      source: 'daily_mix',
      subject_id: topic.subject_id,
      value: 1,
      metadata: { mode, topic_id: topic.id, href: primary.href },
    });
    flushSignals();
  };

  return (
    <div className="mb-4">
      <a
        href={primary.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onEnter}
        className="block w-full text-left py-4 px-5 bg-gradient-to-r from-amber-100 to-orange-100 hover:from-amber-200 hover:to-orange-200 text-amber-900 rounded-xl font-semibold transition-colors mb-2 group"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl flex-shrink-0" aria-hidden="true">{primary.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="text-base">{primary.label}</div>
            <div className="text-xs font-normal text-amber-800/80 mt-0.5">{primary.blurb}</div>
          </div>
          <span className="opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" aria-hidden="true">↗</span>
        </div>
      </a>
      <p className="text-[10px] text-gray-400 text-center">
        Opens in a new tab. Come back here to keep your Daily Mix streak.
      </p>
    </div>
  );
}

function getCompletedSteps(s: Session): string[] {
  const steps: string[] = [];
  if (s.spaced_rep_completed > 0) steps.push('spaced_rep');
  if (s.new_concept_completed) steps.push('concept');
  if (s.habit_checked) steps.push('habit');
  if (s.reflection_done) steps.push('reflection');
  if (s.challenge_done) steps.push('challenge');
  return steps;
}

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

  // Character wisdom — today's value rotates daily
  const todaysValue = useMemo(() => getTodaysCharacterValue(), []);
  const classLevel = 8; // TODO: get from user profile
  const wisdomQuote = useMemo(() => getAgeFraming(todaysValue, classLevel), [todaysValue]);
  const dailyPractice = useMemo(() => getDailyPractice(todaysValue), [todaysValue]);
  const sourceQuote = useMemo(() => getSourceQuote(todaysValue), [todaysValue]);

  // Learner intelligence — passive tracking
  const [userId, setUserId] = useState('');
  const stepStartTime = useRef(Date.now());
  const sessionStartTime = useRef(Date.now());

  // How the student prefers to receive new material — drives Step 1 branching.
  // Starts as step_by_step and hydrates from /api/learning-mode on mount.
  const [learningMode, setLearningMode] = useState<ExplanationMode>('step_by_step');
  const [difficultyFeedback, setDifficultyFeedback] = useState<'too_easy' | 'just_right' | 'too_hard' | null>(null);

  // Pretest state — 2-question warmup before the New Concept step. Loaded
  // lazily when the student reaches step 1 and there's a topic with MCQ
  // questions on file. Once done (or skipped), we don't reshow this session.
  const [pretestQuestions, setPretestQuestions] = useState<PretestQuestion[] | null>(null);
  const [pretestDone, setPretestDone] = useState(false);
  const [pretestLoading, setPretestLoading] = useState(false);

  // v2 arc state — Open (Arena), break-gating between blocks, and the
  // single transfer Exit Eval before Wrap. Each gate is independent so the
  // existing 5-step server flow is unchanged; v2 layers around it.
  const [arenaShown, setArenaShown] = useState(false);
  const [arenaSkipped, setArenaSkipped] = useState(false);
  const arenaGameRef = useRef<MinigameId>('pattern_trace');
  const [break1Shown, setBreak1Shown] = useState(false);   // between concept (1) and habit (2)
  const [break1Done, setBreak1Done] = useState(false);
  const [break2Shown, setBreak2Shown] = useState(false);   // between reflection (3) and challenge (4)
  const [break2Done, setBreak2Done] = useState(false);
  const [exitEvalShown, setExitEvalShown] = useState(false);
  const [exitEvalDone, setExitEvalDone] = useState(false);

  // Pick which Arena game to play at Open (least-recently-played first).
  useEffect(() => {
    fetch('/api/arena?last=10')
      .then((r) => r.json())
      .then((d) => {
        if (!d?.success) return;
        const map: Partial<Record<MinigameId, string>> = {};
        for (const r of (d.results || []) as Array<{ game: MinigameId; played_at: string }>) {
          if (!map[r.game]) map[r.game] = r.played_at;
        }
        arenaGameRef.current = pickNextGame(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/learning-mode')
      .then((r) => r.json())
      .then((d) => { if (d?.success && d?.mode) setLearningMode(d.mode); })
      .catch(() => {});
  }, []);

  // Fetch pretest questions when the student arrives at the New Concept step
  // and we have a topic_id. If the topic has fewer than 2 MCQs we silently
  // skip the warmup — no harm done.
  useEffect(() => {
    if (currentStep !== 1 || pretestDone || pretestQuestions !== null || pretestLoading) return;
    const topicId = session?.new_concept?.topic_id || session?.new_concept?.topics?.id;
    if (!topicId) { setPretestDone(true); return; }
    setPretestLoading(true);
    fetch(`/api/pretest?topicId=${encodeURIComponent(topicId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && Array.isArray(d.questions) && d.questions.length >= 2) {
          setPretestQuestions(d.questions.slice(0, 2));
        } else {
          setPretestDone(true);  // not enough questions — skip silently
        }
      })
      .catch(() => setPretestDone(true))
      .finally(() => setPretestLoading(false));
  }, [currentStep, session?.new_concept?.topic_id, session?.new_concept?.topics?.id, pretestDone, pretestQuestions, pretestLoading]);
  // Micro check-in state — appears between steps
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [currentCheckIn, setCurrentCheckIn] = useState<MicroCheckIn | null>(null);
  const [pendingNextStep, setPendingNextStep] = useState<number | null>(null);

  const fetchSession = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/daily-mix');
      const json = await res.json();
      if (json.success && json.data) {
        setSession(json.data);
        if (json.data.status === 'completed') {
          setIsFinished(true);
        } else if (json.data.status === 'in_progress') {
          // Resume from where they left off using individual boolean fields
          const completedSteps = getCompletedSteps(json.data);
          const nextIdx = STEPS.findIndex(s => !completedSteps.includes(s));
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
    // Get user ID for signal tracking
    fetch('/api/learner-signals').then(r => r.json()).then(d => {
      // If successful, we're authenticated
    }).catch(() => {});
    sessionStartTime.current = Date.now();
    // Flush signals when leaving
    return () => { flushSignals(); };
  }, [fetchSession]);

  // Track time spent per step
  useEffect(() => {
    stepStartTime.current = Date.now();
  }, [currentStep]);

  // Helper to advance step with optional micro check-in
  const advanceWithCheckIn = useCallback((nextStep: number, context: 'after_lesson' | 'mid_session' | 'after_challenge') => {
    // Track time on current step
    const timeOnStep = (Date.now() - stepStartTime.current) / 1000;
    collectSignal({
      user_id: userId || 'anonymous',
      signal_type: 'step_time',
      category: 'engagement',
      source: 'daily_mix',
      value: timeOnStep,
      metadata: { step: STEPS[currentStep], step_index: currentStep },
    });

    // Show a micro check-in between steps (not every time — ~40% chance)
    if (Math.random() < 0.4 && nextStep < STEPS.length) {
      const checkIn = getMicroCheckIn(context);
      setCurrentCheckIn(checkIn);
      setPendingNextStep(nextStep);
      setShowCheckIn(true);
    } else {
      setCurrentStep(nextStep);
    }
  }, [userId, currentStep]);

  const handleCheckInResponse = (value: string) => {
    if (currentCheckIn) {
      collectSignal({
        user_id: userId || 'anonymous',
        signal_type: currentCheckIn.type,
        category: 'emotional',
        source: 'daily_mix',
        value: currentCheckIn.options.findIndex(o => o.value === value) / Math.max(currentCheckIn.options.length - 1, 1),
        metadata: { response: value, check_in_id: currentCheckIn.id },
      });

      // Track mood specifically
      if (currentCheckIn.type === 'mood_emoji') {
        trackMood(userId || 'anonymous', 'daily_mix', value as any);
      }
    }

    setShowCheckIn(false);
    setCurrentCheckIn(null);
    if (pendingNextStep !== null) {
      setCurrentStep(pendingNextStep);
      setPendingNextStep(null);
    }
  };

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
    // Track each card rating as a performance signal
    ratings.forEach(r => {
      trackAnswer(userId || 'anonymous', 'daily_mix', r.quality >= 2, (Date.now() - stepStartTime.current) / 1000);
    });
    await postAction('complete_spaced_rep', { ratings });
    advanceWithCheckIn(1, 'after_lesson');
  };

  const handleCompleteConcept = async () => {
    await postAction('complete_concept');
    advanceWithCheckIn(2, 'after_lesson');
  };

  const handleCompleteHabit = async (completed: boolean) => {
    setHabitDone(completed);
    const habitId = session?.habit_check?.habit_id;
    collectSignal({
      user_id: userId || 'anonymous',
      signal_type: 'habit_completion',
      category: 'behavioral',
      source: 'daily_mix',
      value: completed ? 1 : 0,
      metadata: { habit_id: habitId },
    });
    await postAction('complete_habit', { habit_id: habitId, completed });
    advanceWithCheckIn(3, 'mid_session');
  };

  const handleCompleteReflection = async () => {
    // Track reflection depth by word count
    const wordCount = reflectionText.trim().split(/\s+/).filter(Boolean).length;
    collectSignal({
      user_id: userId || 'anonymous',
      signal_type: 'reflection_depth',
      category: 'engagement',
      source: 'daily_mix',
      value: Math.min(wordCount / 50, 1),  // normalize: 50 words = 1.0
      metadata: { word_count: wordCount, has_content: wordCount > 3 },
    });
    await postAction('complete_reflection', { response: reflectionText });
    advanceWithCheckIn(4, 'mid_session');
  };

  const handleCompleteChallenge = async () => {
    const correct = selectedAnswer === session?.challenge_item?.correct_answer;
    const timeOnChallenge = (Date.now() - stepStartTime.current) / 1000;
    setChallengeSubmitted(true);
    trackAnswer(userId || 'anonymous', 'daily_mix', correct, timeOnChallenge);
    await postAction('complete_challenge', { answer: selectedAnswer, correct });
  };

  const handleFinish = async () => {
    // Track total session time
    const totalTime = (Date.now() - sessionStartTime.current) / 1000;
    trackTimeSpent(userId || 'anonymous', 'daily_mix', totalTime);
    flushSignals();  // Send all queued signals now
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
  const stepsCompleted = session ? getCompletedSteps(session).length : 0;
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

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gradient-to-br from-warning-50 to-warning-100 rounded-2xl p-4">
                <p className="text-3xl font-bold text-warning-600">+{session.xp_earned}</p>
                <p className="text-sm text-warning-500">XP Earned</p>
              </div>
              <div className="bg-gradient-to-br from-success-50 to-success-100 rounded-2xl p-4">
                <p className="text-3xl font-bold text-success-600">
                  {getCompletedSteps(session)?.length || 0}/{STEPS.length}
                </p>
                <p className="text-sm text-success-500">Steps Done</p>
              </div>
            </div>

            {/* Character Growth Insight */}
            <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50 border border-amber-200/40 rounded-2xl p-5 mb-6 text-left">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🪔</span>
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                  Character Growth Today
                </p>
              </div>
              <p className="text-sm font-semibold text-gray-900 mb-1">
                {todaysValue.name} &middot; {todaysValue.name_bn}
              </p>
              <p className="text-sm text-gray-600 italic mb-2">
                &ldquo;{wisdomQuote}&rdquo;
              </p>
              <p className="text-xs text-amber-700">
                By reviewing, learning, reflecting, and challenging yourself today — you practiced <strong>{todaysValue.name.split('(')[0].trim().toLowerCase()}</strong>.
                {' '}{SOURCE_LABELS[todaysValue.source]} teaches us this is how real growth happens.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 justify-center mb-8">
              {STEPS.map(step => {
                const done = getCompletedSteps(session)?.includes(step);
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

            <div className="mb-6 text-left">
              <NextStepGuide context="post_daily_mix" />
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

  if (!session) return null;
  const mix = session;

  // If not started yet, show welcome
  if (session.status === 'not_started') {
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

          <div className="flex flex-wrap gap-3 justify-center mb-6">
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

          {/* Today's Character Wisdom */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/50 rounded-2xl p-4 mb-8 text-left">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">
              Today&apos;s Wisdom &middot; {SOURCE_LABELS[todaysValue.source]}
            </p>
            <p className="text-sm font-medium text-gray-800 italic mb-1">
              &ldquo;{wisdomQuote}&rdquo;
            </p>
            <p className="text-xs text-amber-700">
              {todaysValue.name} ({todaysValue.name_bn})
            </p>
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
        {/* Plan banner — only renders when student is enrolled. Surfaces today's
            week, blocks, method, companion overlay, and adherence %. */}
        <TodaysPlanBanner compact />

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">Daily Mix</h1>
            <div className="flex items-center gap-3">
              <LearningModePill onChange={setLearningMode} />
              <span className="text-sm font-medium text-gray-500">
                {stepsCompleted}/{STEPS.length} steps
              </span>
            </div>
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
              const done = getCompletedSteps(session)?.includes(step);
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

          {/* Wisdom bridge — connects current step to character growth */}
          <div className="mt-3 px-1">
            <p className="text-xs text-amber-700/70 italic text-center">
              {currentStep === 0 && `Reviewing what you've learned builds ${todaysValue.name.split('(')[0].trim().toLowerCase()} — remembering strengthens your mind.`}
              {currentStep === 1 && `Every new concept is a step toward wisdom. "${todaysValue.name_bn}" grows when you stay curious.`}
              {currentStep === 2 && `Small habits, practiced daily, shape who you become. — ${SOURCE_LABELS[todaysValue.source]}`}
              {currentStep === 3 && `Reflection is where learning becomes growth. Take a moment with today's wisdom.`}
              {currentStep === 4 && `Face the challenge with courage. ${todaysValue.name.split('(')[0].trim()} means trying even when it's hard.`}
            </p>
          </div>
        </div>

        {/* Micro Check-In Overlay — appears between steps, feels natural */}
        {showCheckIn && currentCheckIn && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-3xl shadow-lg p-6 mb-4 text-center"
          >
            <p className="text-lg font-bold text-gray-900 mb-4">{currentCheckIn.prompt}</p>
            <div className="flex justify-center gap-3">
              {currentCheckIn.options.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleCheckInResponse(opt.value)}
                  className="flex flex-col items-center gap-1 px-4 py-3 rounded-2xl bg-gray-50 hover:bg-primary-50 border-2 border-gray-200 hover:border-primary-300 transition-all"
                >
                  <span className="text-2xl">{opt.icon}</span>
                  <span className="text-xs font-medium text-gray-600">{opt.label}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => handleCheckInResponse('skipped')}
              className="mt-3 text-xs text-gray-400 hover:text-gray-600"
            >
              Skip
            </button>
          </motion.div>
        )}

        {/* Step content */}
        {/* === v2 Arc: Open with a 30-90s Arena minigame to capture signal ===
            Surfaces only at step 0 the first time. Skipping is fine — the
            student still earns Honesty XP for completing one. */}
        {currentStep === 0 && !arenaShown && !arenaSkipped && (
          <div className="mb-4">
            <ArenaPlayer
              game={arenaGameRef.current}
              trigger="session_start"
              onDone={() => setArenaShown(true)}
              onSkip={() => { setArenaSkipped(true); setArenaShown(true); }}
            />
          </div>
        )}

        {/* === v2 Arc: Break 1 between Concept (step 1) and Habit (step 2) === */}
        {currentStep === 2 && !break1Done && !break1Shown && (
          <div className="mb-4">
            <ActiveBreak
              durationSec={75}
              recallContext={mix?.new_concept?.topics?.title}
              onDone={(info) => {
                setBreak1Done(true);
                setBreak1Shown(true);
                if (info.recall) {
                  collectSignal({
                    user_id: userId || 'anonymous',
                    signal_type: 'free_recall_break',
                    category: 'engagement',
                    source: 'daily_mix',
                    value: Math.min(1, info.recall.split(/\s+/).length / 30),
                    metadata: { kind: info.kind, words: info.recall.split(/\s+/).length },
                  });
                }
              }}
            />
          </div>
        )}

        {/* === v2 Arc: Break 2 between Reflection (step 3) and Challenge (step 4) === */}
        {currentStep === 4 && !break2Done && !break2Shown && (
          <div className="mb-4">
            <ActiveBreak
              durationSec={60}
              kind="breathing"
              onDone={() => { setBreak2Done(true); setBreak2Shown(true); }}
            />
          </div>
        )}

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
                          {flippedCards.has(idx) ? (typeof item.answer === 'string' ? item.answer : JSON.stringify(item.answer)) : item.question_text}
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

              {/* Pretest warm-up — appears once per session, BEFORE the topic
                  reveal. Even when answered wrong, this primes encoding for the
                  upcoming material (Pan, Sana et al. 2023, g=0.54 for items
                  specifically pretested). */}
              {!pretestDone && pretestQuestions && pretestQuestions.length >= 2 && mix.new_concept?.topics && (
                <div className="mb-6">
                  <PretestCard
                    topicTitle={mix.new_concept.topics.title}
                    questions={pretestQuestions}
                    onComplete={(result) => {
                      setPretestDone(true);
                      collectSignal({
                        user_id: userId || 'anonymous',
                        signal_type: 'pretest_completed',
                        category: 'performance',
                        source: 'daily_mix',
                        subject_id: mix.new_concept?.topics?.subject_id,
                        value: result.total > 0 ? result.correct / result.total : 0,
                        metadata: { ...result, topic_id: mix.new_concept?.topic_id },
                      });
                    }}
                    onSkip={() => setPretestDone(true)}
                  />
                </div>
              )}

              {mix.new_concept?.topics ? (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 mb-6">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-2xl font-bold text-gray-900">
                      {mix.new_concept.topics.title}
                    </h3>
                    <ReadAloudButton text={() => {
                      const t = mix.new_concept?.topics;
                      return [t?.title, t?.description].filter(Boolean).join('. ');
                    }} />
                  </div>
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

              {/* Mode-branched entry point: match the learner's preferred explanation style */}
              {mix.new_concept?.topics && (
                <ModeEntryPoint
                  mode={learningMode}
                  topic={mix.new_concept.topics}
                  userId={userId}
                />
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

              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 mb-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-xs font-semibold text-purple-500 uppercase tracking-wide">
                    {mix.reflection_prompt.type}
                  </p>
                  <ReadAloudButton text={() => mix.reflection_prompt.prompt} />
                </div>
                <p className="text-lg font-medium text-gray-900">
                  {mix.reflection_prompt.prompt}
                </p>
              </div>

              {/* Character Wisdom Connection */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/40 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0 mt-0.5">🪔</span>
                  <div>
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
                      Today&apos;s Practice &middot; {todaysValue.name_bn}
                    </p>
                    {sourceQuote && (
                      <p className="text-sm text-gray-700 italic mb-1">&ldquo;{sourceQuote}&rdquo;</p>
                    )}
                    <p className="text-sm text-amber-800 font-medium">{dailyPractice}</p>
                    <p className="text-xs text-amber-600 mt-1">
                      — {SOURCE_LABELS[todaysValue.source]}
                    </p>
                  </div>
                </div>
              </div>

              <textarea
                value={reflectionText}
                onChange={(e) => setReflectionText(e.target.value)}
                placeholder="Write your thoughts here... How does today's wisdom connect to what you learned?"
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
                  <div className="flex items-start justify-between gap-2 mb-6">
                    <p className="text-lg font-medium text-gray-900 flex-1">
                      {mix.challenge_item.question_text}
                    </p>
                    <ReadAloudButton text={() => mix.challenge_item?.question_text || ''} />
                  </div>

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
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-semibold text-blue-700">Explanation</p>
                        <ReadAloudButton text={() => mix.challenge_item?.explanation || ''} />
                      </div>
                      <p className="text-sm text-blue-800">{mix.challenge_item.explanation}</p>
                    </motion.div>
                  )}

                  {/* Difficulty feedback — biases tomorrow's challenge band */}
                  {challengeSubmitted && (
                    <div className="mb-6 text-center">
                      <p className="text-xs text-gray-500 mb-2">How did that feel?</p>
                      <div className="flex justify-center gap-2">
                        {([
                          { v: 'too_easy',   label: 'Too easy',   icon: '🥱' },
                          { v: 'just_right', label: 'Just right', icon: '👍' },
                          { v: 'too_hard',   label: 'Too hard',   icon: '😤' },
                        ] as const).map((opt) => {
                          const active = difficultyFeedback === opt.v;
                          return (
                            <button
                              key={opt.v}
                              type="button"
                              onClick={() => {
                                setDifficultyFeedback(opt.v);
                                // Single write path via the client signal queue —
                                // it flushes to /api/learner-signals which is the
                                // canonical store. Earlier I also POSTed to
                                // /api/difficulty-bias from here, which inserted a
                                // second row for the same click and inflated counts.
                                collectSignal({
                                  user_id: userId || 'anonymous',
                                  signal_type: 'difficulty_feel',
                                  category: 'emotional',
                                  source: 'daily_mix',
                                  value: opt.v === 'too_easy' ? 0 : opt.v === 'just_right' ? 0.5 : 1,
                                  metadata: { response: opt.v, step: 'challenge' },
                                });
                                flushSignals();
                              }}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                                active
                                  ? 'bg-primary-50 border-primary-400 text-primary-700'
                                  : 'bg-white border-gray-200 text-gray-600 hover:border-primary-300'
                              }`}
                            >
                              <span>{opt.icon}</span> <span>{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
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
                    <>
                      {/* v2 Arc: honest exit eval gates session completion.
                          Shown after the challenge is submitted; once the
                          eval is done (or skipped explicitly), Finish unlocks. */}
                      {!exitEvalDone && mix.new_concept?.topics?.id && (
                        <div className="mb-4">
                          <ExitEvalCard
                            topicId={mix.new_concept.topics.id}
                            topicTitle={mix.new_concept.topics.title}
                            subjectId={mix.new_concept.topics.subject_id}
                            companionId={undefined}
                            modeUsed={learningMode}
                            sessionId={session?.id}
                            onComplete={() => setExitEvalDone(true)}
                          />
                        </div>
                      )}
                      <button
                        onClick={handleFinish}
                        disabled={!exitEvalDone && !!mix.new_concept?.topics?.id}
                        className={`w-full py-4 rounded-2xl font-bold text-lg transition-all ${
                          (!exitEvalDone && !!mix.new_concept?.topics?.id)
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white hover:shadow-lg'
                        }`}
                      >
                        {(!exitEvalDone && !!mix.new_concept?.topics?.id) ? 'Finish (do exit question first)' : 'Finish Daily Mix'}
                      </button>
                    </>
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
