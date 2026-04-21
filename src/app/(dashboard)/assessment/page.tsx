'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createBrowserClient } from '@/lib/supabase';
import { collectSignal, trackMood, trackAnswer, trackPreferenceChoice } from '@/lib/learner-engine';
import { CHARACTER_VALUES, getAgeFraming } from '@/lib/character-framework';

// ============================================================
// ASSESSMENT ACTIVITIES — disguised as play, captures real signals
// ============================================================

// Mood Island — quick emotional baseline
const MOOD_ISLANDS = [
  { value: 'excited', label: 'Adventure Island', label_bn: 'অ্যাডভেঞ্চার দ্বীপ', icon: '🏝️', color: 'from-yellow-300 to-orange-400', desc: 'Ready for anything!' },
  { value: 'calm', label: 'Peaceful Bay', label_bn: 'শান্ত উপসাগর', icon: '🌊', color: 'from-blue-300 to-cyan-400', desc: 'Feeling chill' },
  { value: 'curious', label: 'Mystery Mountain', label_bn: 'রহস্য পাহাড়', icon: '🏔️', color: 'from-purple-300 to-indigo-400', desc: 'Want to explore!' },
  { value: 'tired', label: 'Cozy Cove', label_bn: 'আরামের কোণ', icon: '🌅', color: 'from-pink-300 to-rose-400', desc: 'Need a gentle start' },
];

// Pattern puzzles — captures logical reasoning + processing speed
const PATTERN_PUZZLES = [
  { sequence: ['2', '4', '8', '16', '?'], answer: '32', wrong: ['24', '20', '18'], hint: 'Each number doubles', subject_signal: 'math_pattern' },
  { sequence: ['🔴', '🔵', '🔴', '🔵', '?'], answer: '🔴', wrong: ['🟢', '🔵', '🟡'], hint: 'Look at the colors repeating', subject_signal: 'visual_pattern' },
  { sequence: ['A', 'C', 'E', 'G', '?'], answer: 'I', wrong: ['H', 'J', 'F'], hint: 'Skip one letter each time', subject_signal: 'language_pattern' },
];

// Story choice — captures narrative preference, empathy, risk tolerance
const STORY_SCENARIOS = [
  {
    setup: 'You find a mysterious book in the library that glows when you touch it. Do you...',
    setup_bn: 'তুমি লাইব্রেরিতে একটা রহস্যময় বই পেলে যেটা ছুঁলে জ্বলে ওঠে। তুমি কী করবে...',
    options: [
      { text: 'Open it immediately and start reading', signal: 'curious_bold', icon: '📖' },
      { text: 'Show it to a friend first', signal: 'collaborative_cautious', icon: '👫' },
      { text: 'Examine the cover and symbols carefully', signal: 'analytical_visual', icon: '🔍' },
      { text: 'Ask the librarian about it', signal: 'seeks_guidance', icon: '🙋' },
    ],
  },
  {
    setup: 'Your team has a science project. Everyone disagrees on the topic. You would...',
    setup_bn: 'তোমার দলের একটা বিজ্ঞান প্রকল্প আছে। সবাই বিষয়ে একমত না। তুমি...',
    options: [
      { text: 'Suggest a vote and go with majority', signal: 'democratic_fair', icon: '🗳️' },
      { text: 'Propose combining everyone\'s ideas', signal: 'integrative_creative', icon: '🧩' },
      { text: 'Research all options and present the best one', signal: 'analytical_leader', icon: '📊' },
      { text: 'Let others decide, you\'ll make any topic work', signal: 'adaptable_easygoing', icon: '🤝' },
    ],
  },
];

// Speed round — captures processing speed + subject strengths
const SPEED_QUESTIONS = [
  { q: 'What is 7 x 8?', a: '56', wrong: ['54', '48', '64'], subject: 'math', difficulty: 'easy' },
  { q: 'What is the capital of India?', a: 'New Delhi', wrong: ['Mumbai', 'Kolkata', 'Chennai'], subject: 'geography', difficulty: 'easy' },
  { q: 'Water boils at __ degrees Celsius', a: '100', wrong: ['90', '120', '80'], subject: 'science', difficulty: 'easy' },
  { q: 'Opposite of "ancient"', a: 'Modern', wrong: ['Old', 'Historic', 'Classic'], subject: 'english', difficulty: 'easy' },
  { q: 'How many sides does a hexagon have?', a: '6', wrong: ['5', '7', '8'], subject: 'math', difficulty: 'medium' },
  { q: 'Which planet is known as the Red Planet?', a: 'Mars', wrong: ['Jupiter', 'Venus', 'Saturn'], subject: 'science', difficulty: 'easy' },
];

// Explore activity — captures curiosity, attention span, preference for visual/text
const EXPLORE_TOPICS = [
  { id: 'space', title: 'The Solar System', icon: '🚀', visual: 'Planets orbiting the sun in a beautiful diagram', text: 'The solar system has 8 planets. Mercury is closest to the Sun...', fact: 'Jupiter is so big that all other planets could fit inside it!' },
  { id: 'ocean', title: 'Deep Ocean', icon: '🐋', visual: 'Layers of the ocean with creatures at each depth', text: 'The deepest point in the ocean is the Mariana Trench at 11,034m...', fact: 'We have explored less than 5% of the ocean floor!' },
  { id: 'history', title: 'Ancient Bengal', icon: '🏛️', visual: 'Timeline of Bengal\'s great scholars and their contributions', text: 'Bengal has been a center of learning for over a thousand years...', fact: 'Nalanda, one of the world\'s first universities, was nearby!' },
];

// ============================================================
// COMPONENT
// ============================================================

type Phase = 'intro' | 'mood' | 'pattern' | 'story' | 'speed' | 'explore' | 'results';

const PHASES: Phase[] = ['intro', 'mood', 'pattern', 'story', 'speed', 'explore', 'results'];

export default function AssessmentPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('intro');
  const [saving, setSaving] = useState(false);

  // Signal collection state
  const [userId, setUserId] = useState<string>('');
  const [classLevel, setClassLevel] = useState(8);

  // Mood state
  const [selectedMood, setSelectedMood] = useState<string | null>(null);

  // Pattern state
  const [patternIndex, setPatternIndex] = useState(0);
  const [patternAnswers, setPatternAnswers] = useState<{ correct: boolean; timeMs: number }[]>([]);
  const patternStartTime = useRef<number>(Date.now());

  // Story state
  const [storyIndex, setStoryIndex] = useState(0);
  const [storyChoices, setStoryChoices] = useState<string[]>([]);

  // Speed round state
  const [speedIndex, setSpeedIndex] = useState(0);
  const [speedAnswers, setSpeedAnswers] = useState<{ correct: boolean; timeMs: number; subject: string }[]>([]);
  const speedStartTime = useRef<number>(Date.now());
  const [speedCountdown, setSpeedCountdown] = useState(3);
  const [speedStarted, setSpeedStarted] = useState(false);

  // Explore state
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [exploredSections, setExploredSections] = useState<Set<string>>(new Set());
  const [exploreTimeSpent, setExploreTimeSpent] = useState(0);
  const exploreStartTime = useRef<number>(Date.now());

  // Collected profile signals
  const [profileSignals, setProfileSignals] = useState<Record<string, unknown>>({});

  // Get user info on mount
  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
        const cl = data.user.user_metadata?.current_class || 8;
        setClassLevel(cl);
      }
    });
  }, []);

  const goNext = useCallback(() => {
    const idx = PHASES.indexOf(phase);
    if (idx < PHASES.length - 1) {
      setPhase(PHASES[idx + 1]);
    }
  }, [phase]);

  // Speed round countdown
  useEffect(() => {
    if (phase === 'speed' && !speedStarted) {
      if (speedCountdown > 0) {
        const timer = setTimeout(() => setSpeedCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        setSpeedStarted(true);
        speedStartTime.current = Date.now();
      }
    }
  }, [phase, speedCountdown, speedStarted]);

  // Explore timer
  useEffect(() => {
    if (phase === 'explore' && selectedTopic) {
      exploreStartTime.current = Date.now();
      const interval = setInterval(() => {
        setExploreTimeSpent(Math.floor((Date.now() - exploreStartTime.current) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [phase, selectedTopic]);

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleMoodSelect = (mood: string) => {
    setSelectedMood(mood);
    if (userId) {
      trackMood(userId, 'assessment_activity', mood as any);
    }
    setProfileSignals(prev => ({ ...prev, initial_mood: mood }));
    setTimeout(goNext, 600);
  };

  const handlePatternAnswer = (answer: string) => {
    const puzzle = PATTERN_PUZZLES[patternIndex];
    const correct = answer === puzzle.answer;
    const timeMs = Date.now() - patternStartTime.current;

    const result = { correct, timeMs };
    const newAnswers = [...patternAnswers, result];
    setPatternAnswers(newAnswers);

    if (userId) {
      trackAnswer(userId, 'assessment_activity', correct, timeMs / 1000, undefined, {
        puzzle_type: puzzle.subject_signal,
      });
    }

    if (patternIndex < PATTERN_PUZZLES.length - 1) {
      setPatternIndex(patternIndex + 1);
      patternStartTime.current = Date.now();
    } else {
      setProfileSignals(prev => ({
        ...prev,
        pattern_accuracy: newAnswers.filter(a => a.correct).length / newAnswers.length,
        pattern_avg_time: newAnswers.reduce((s, a) => s + a.timeMs, 0) / newAnswers.length,
      }));
      setTimeout(goNext, 500);
    }
  };

  const handleStoryChoice = (signal: string) => {
    const newChoices = [...storyChoices, signal];
    setStoryChoices(newChoices);

    if (userId) {
      trackPreferenceChoice(
        userId,
        'assessment_activity',
        signal,
        STORY_SCENARIOS[storyIndex].options.map(o => o.signal)
      );
    }

    if (storyIndex < STORY_SCENARIOS.length - 1) {
      setStoryIndex(storyIndex + 1);
    } else {
      setProfileSignals(prev => ({ ...prev, story_choices: newChoices }));
      setTimeout(goNext, 500);
    }
  };

  const handleSpeedAnswer = (answer: string) => {
    const question = SPEED_QUESTIONS[speedIndex];
    const correct = answer === question.a;
    const timeMs = Date.now() - speedStartTime.current;

    const result = { correct, timeMs, subject: question.subject };
    const newAnswers = [...speedAnswers, result];
    setSpeedAnswers(newAnswers);

    if (userId) {
      trackAnswer(userId, 'assessment_activity', correct, timeMs / 1000, question.subject, {
        difficulty: question.difficulty,
      });
    }

    if (speedIndex < SPEED_QUESTIONS.length - 1) {
      setSpeedIndex(speedIndex + 1);
      speedStartTime.current = Date.now();
    } else {
      // Analyze speed round results by subject
      const bySubject: Record<string, { correct: number; total: number; avgTime: number }> = {};
      newAnswers.forEach(a => {
        if (!bySubject[a.subject]) bySubject[a.subject] = { correct: 0, total: 0, avgTime: 0 };
        bySubject[a.subject].total++;
        if (a.correct) bySubject[a.subject].correct++;
        bySubject[a.subject].avgTime += a.timeMs;
      });
      Object.values(bySubject).forEach(s => { s.avgTime /= s.total; });

      setProfileSignals(prev => ({ ...prev, speed_by_subject: bySubject }));
      setTimeout(goNext, 500);
    }
  };

  const handleExploreClick = (section: string) => {
    setExploredSections(prev => new Set([...prev, section]));
    if (userId) {
      trackPreferenceChoice(userId, 'assessment_activity', section, ['visual', 'text', 'fact']);
    }
  };

  const handleFinishExplore = () => {
    setProfileSignals(prev => ({
      ...prev,
      explore_topic: selectedTopic,
      explore_sections: Array.from(exploredSections),
      explore_time_seconds: exploreTimeSpent,
      visual_preference: exploredSections.has('visual') ? 1 : 0,
      text_preference: exploredSections.has('text') ? 1 : 0,
    }));
    goNext();
  };

  const saveAndContinue = async () => {
    setSaving(true);
    try {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Derive initial preferences from behavioral signals
        const patternAccuracy = (profileSignals.pattern_accuracy as number) || 0.5;
        const patternSpeed = (profileSignals.pattern_avg_time as number) || 5000;
        const speedData = profileSignals.speed_by_subject as Record<string, { correct: number; total: number; avgTime: number }> | undefined;

        // Determine initial preference based on BEHAVIOR, not self-report
        // Fast + accurate on patterns = analytical/visual learner
        // Story choices = narrative/collaborative preference
        // Explore: which sections they visited = visual vs text preference
        let visualScore = 30;
        let readingScore = 25;
        let auditoryScore = 20;
        let kinestheticScore = 25;

        // Pattern performance → analytical/logical strength
        if (patternAccuracy > 0.7 && patternSpeed < 4000) {
          visualScore += 15;  // fast pattern recognition suggests visual processing
        }

        // Explore behavior → visual vs text preference
        if (exploredSections.has('visual')) visualScore += 10;
        if (exploredSections.has('text')) readingScore += 10;
        if (exploredSections.has('fact')) kinestheticScore += 5;

        // Story choices → collaborative vs independent
        const storySignals = storyChoices;
        if (storySignals.includes('analytical_visual') || storySignals.includes('analytical_leader')) {
          readingScore += 10;
          visualScore += 5;
        }
        if (storySignals.includes('curious_bold') || storySignals.includes('integrative_creative')) {
          kinestheticScore += 10;
        }

        // Normalize to 100
        const total = visualScore + auditoryScore + readingScore + kinestheticScore;
        const normalized = {
          visual: Math.round((visualScore / total) * 100),
          auditory: Math.round((auditoryScore / total) * 100),
          reading: Math.round((readingScore / total) * 100),
          kinesthetic: Math.round((kinestheticScore / total) * 100),
        };

        const primary = Object.entries(normalized).sort((a, b) => b[1] - a[1])[0][0];

        // Save to existing learning_styles table for backward compat
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('learning_styles') as any).upsert({
          user_id: user.id,
          visual_score: normalized.visual,
          auditory_score: normalized.auditory,
          reading_score: normalized.reading,
          kinesthetic_score: normalized.kinesthetic,
          dominant_style: primary,
          assessment_date: new Date().toISOString(),
        });

        // Save the rich behavioral signals for the learner engine
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('learner_profiles') as any).upsert({
          user_id: user.id,
          initial_mood: profileSignals.initial_mood,
          pattern_accuracy: profileSignals.pattern_accuracy,
          pattern_avg_time_ms: profileSignals.pattern_avg_time,
          story_signals: storyChoices,
          speed_by_subject: profileSignals.speed_by_subject,
          explore_preferences: {
            topic: selectedTopic,
            sections: Array.from(exploredSections),
            time_seconds: exploreTimeSpent,
          },
          profile_confidence: 0.3,  // initial — low confidence, will grow with usage
          assessment_version: 2,    // v2 = behavioral assessment
          assessed_at: new Date().toISOString(),
        }).then(() => {}).catch(() => {
          // Table might not exist yet — that's okay, signals are still in learning_styles
        });
      }

      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to save:', error);
      router.push('/dashboard');
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // COMPUTED VALUES
  // ============================================================

  const todaysValue = CHARACTER_VALUES[Math.floor(Math.random() * CHARACTER_VALUES.length)];
  const wisdomQuote = getAgeFraming(todaysValue, classLevel);
  const phaseIndex = PHASES.indexOf(phase);
  const progress = phase === 'intro' ? 0 : ((phaseIndex) / (PHASES.length - 1)) * 100;

  // Shuffle options for a question (consistent per render)
  const shuffleOptions = (correct: string, wrong: string[]) => {
    const all = [correct, ...wrong];
    // Simple deterministic shuffle based on correct answer
    return all.sort(() => correct.charCodeAt(0) % 2 === 0 ? -1 : 1);
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50">
      {/* Progress bar — only show during activities */}
      {phase !== 'intro' && phase !== 'results' && (
        <div className="fixed top-0 left-0 right-0 z-50">
          <div className="h-1.5 bg-gray-200">
            <motion.div
              className="h-full bg-gradient-to-r from-primary-500 to-secondary-500"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* ============================================================ */}
        {/* INTRO — Welcome, no mention of "testing" or "judging" */}
        {/* ============================================================ */}
        {phase === 'intro' && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="min-h-screen flex items-center justify-center p-4"
          >
            <div className="max-w-lg w-full text-center">
              <motion.div
                animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="text-7xl mb-6"
              >
                🌟
              </motion.div>

              <h1 className="text-3xl font-bold text-gray-900 mb-3">
                Let&apos;s Get to Know You!
              </h1>
              <p className="text-gray-600 text-lg mb-2">
                A few quick, fun activities so we can make learning feel just right for you.
              </p>
              <p className="text-gray-400 text-sm mb-8">
                No right or wrong answers. Just be yourself!
              </p>

              <div className="flex justify-center gap-4 mb-8">
                {[
                  { icon: '🏝️', label: 'Mood' },
                  { icon: '🧩', label: 'Puzzles' },
                  { icon: '📚', label: 'Story' },
                  { icon: '⚡', label: 'Quick Fire' },
                  { icon: '🔍', label: 'Explore' },
                ].map(item => (
                  <div key={item.label} className="text-center">
                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-xl mb-1">
                      {item.icon}
                    </div>
                    <span className="text-xs text-gray-500">{item.label}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={goNext}
                className="px-10 py-4 bg-gradient-to-r from-primary-500 to-secondary-500 text-white text-lg rounded-2xl font-bold hover:shadow-xl hover:scale-105 transition-all"
              >
                Let&apos;s Go!
              </button>

              {/* Character wisdom — subtle, not preachy */}
              <div className="mt-8 bg-amber-50/50 rounded-xl p-3 border border-amber-100">
                <p className="text-xs text-amber-700 italic">
                  &ldquo;{wisdomQuote}&rdquo;
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ============================================================ */}
        {/* MOOD ISLAND — emotional baseline, feels like a game */}
        {/* ============================================================ */}
        {phase === 'mood' && (
          <motion.div
            key="mood"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="min-h-screen flex items-center justify-center p-4 pt-8"
          >
            <div className="max-w-xl w-full text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Pick Your Island</h2>
              <p className="text-gray-500 mb-8">Where does your mood take you right now?</p>

              <div className="grid grid-cols-2 gap-4">
                {MOOD_ISLANDS.map(island => (
                  <motion.button
                    key={island.value}
                    onClick={() => handleMoodSelect(island.value)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`relative p-6 rounded-3xl bg-gradient-to-br ${island.color} text-white text-left overflow-hidden transition-all ${
                      selectedMood === island.value ? 'ring-4 ring-white shadow-2xl scale-105' : 'shadow-lg'
                    }`}
                  >
                    <span className="text-4xl block mb-2">{island.icon}</span>
                    <h3 className="font-bold text-lg">{island.label}</h3>
                    <p className="text-sm opacity-90">{island.desc}</p>
                    {selectedMood === island.value && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-3 right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center text-green-500 font-bold"
                      >
                        ✓
                      </motion.div>
                    )}
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ============================================================ */}
        {/* PATTERN PUZZLE — logical reasoning + processing speed */}
        {/* ============================================================ */}
        {phase === 'pattern' && (
          <motion.div
            key="pattern"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="min-h-screen flex items-center justify-center p-4 pt-8"
          >
            <div className="max-w-lg w-full">
              <div className="text-center mb-6">
                <span className="text-4xl mb-2 block">🧩</span>
                <h2 className="text-2xl font-bold text-gray-900">Spot the Pattern</h2>
                <p className="text-gray-500 text-sm">
                  {patternIndex + 1} of {PATTERN_PUZZLES.length}
                </p>
              </div>

              <div className="bg-white rounded-3xl shadow-lg p-8">
                <div className="flex items-center justify-center gap-4 mb-8">
                  {PATTERN_PUZZLES[patternIndex].sequence.map((item, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: idx * 0.1 }}
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold ${
                        item === '?'
                          ? 'bg-gradient-to-br from-primary-100 to-secondary-100 text-primary-600 border-2 border-dashed border-primary-300'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {item}
                    </motion.div>
                  ))}
                </div>

                <p className="text-center text-sm text-gray-500 mb-4">What comes next?</p>

                <div className="grid grid-cols-2 gap-3">
                  {shuffleOptions(
                    PATTERN_PUZZLES[patternIndex].answer,
                    PATTERN_PUZZLES[patternIndex].wrong
                  ).map((option, idx) => (
                    <motion.button
                      key={idx}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handlePatternAnswer(option)}
                      className="py-4 px-6 bg-gray-50 hover:bg-primary-50 border-2 border-gray-200 hover:border-primary-300 rounded-2xl font-bold text-lg transition-all"
                    >
                      {option}
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ============================================================ */}
        {/* STORY CHOICE — personality, empathy, decision style */}
        {/* ============================================================ */}
        {phase === 'story' && (
          <motion.div
            key="story"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="min-h-screen flex items-center justify-center p-4 pt-8"
          >
            <div className="max-w-lg w-full">
              <div className="text-center mb-6">
                <span className="text-4xl mb-2 block">📚</span>
                <h2 className="text-2xl font-bold text-gray-900">Choose Your Path</h2>
                <p className="text-gray-500 text-sm">
                  {storyIndex + 1} of {STORY_SCENARIOS.length}
                </p>
              </div>

              <div className="bg-white rounded-3xl shadow-lg p-8">
                <p className="text-lg font-medium text-gray-900 mb-6 leading-relaxed">
                  {STORY_SCENARIOS[storyIndex].setup}
                </p>

                <div className="space-y-3">
                  {STORY_SCENARIOS[storyIndex].options.map((option, idx) => (
                    <motion.button
                      key={idx}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleStoryChoice(option.signal)}
                      className="w-full flex items-center gap-4 p-4 bg-gray-50 hover:bg-primary-50 border-2 border-gray-200 hover:border-primary-300 rounded-2xl transition-all text-left"
                    >
                      <span className="text-2xl flex-shrink-0">{option.icon}</span>
                      <span className="font-medium text-gray-800">{option.text}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ============================================================ */}
        {/* SPEED ROUND — subject strengths + processing speed */}
        {/* ============================================================ */}
        {phase === 'speed' && (
          <motion.div
            key="speed"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="min-h-screen flex items-center justify-center p-4 pt-8"
          >
            <div className="max-w-lg w-full">
              {!speedStarted ? (
                <div className="text-center">
                  <span className="text-6xl block mb-4">⚡</span>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Quick Fire Round!</h2>
                  <p className="text-gray-500 mb-8">Answer as fast as you can. Don&apos;t overthink!</p>
                  <motion.div
                    key={speedCountdown}
                    initial={{ scale: 2, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-8xl font-black text-primary-500"
                  >
                    {speedCountdown || 'GO!'}
                  </motion.div>
                </div>
              ) : speedIndex < SPEED_QUESTIONS.length ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-gray-500">
                      {speedIndex + 1}/{SPEED_QUESTIONS.length}
                    </span>
                    <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">
                      {SPEED_QUESTIONS[speedIndex].subject}
                    </span>
                  </div>

                  <div className="bg-white rounded-3xl shadow-lg p-8">
                    <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">
                      {SPEED_QUESTIONS[speedIndex].q}
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                      {shuffleOptions(
                        SPEED_QUESTIONS[speedIndex].a,
                        SPEED_QUESTIONS[speedIndex].wrong
                      ).map((option, idx) => (
                        <motion.button
                          key={idx}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => handleSpeedAnswer(option)}
                          className="py-4 px-4 bg-gray-50 hover:bg-primary-50 border-2 border-gray-200 hover:border-primary-300 rounded-2xl font-semibold transition-all text-center"
                        >
                          {option}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <motion.div
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  className="text-center"
                >
                  <span className="text-6xl block mb-4">🎯</span>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Nice speed!</h2>
                  <p className="text-gray-500 mb-4">
                    {speedAnswers.filter(a => a.correct).length}/{speedAnswers.length} correct
                  </p>
                  <button
                    onClick={goNext}
                    className="px-8 py-3 bg-gradient-to-r from-primary-500 to-secondary-500 text-white rounded-xl font-bold"
                  >
                    Continue
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {/* ============================================================ */}
        {/* EXPLORE — curiosity, attention span, visual vs text preference */}
        {/* ============================================================ */}
        {phase === 'explore' && (
          <motion.div
            key="explore"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="min-h-screen flex items-center justify-center p-4 pt-8"
          >
            <div className="max-w-lg w-full">
              {!selectedTopic ? (
                <>
                  <div className="text-center mb-6">
                    <span className="text-4xl block mb-2">🔍</span>
                    <h2 className="text-2xl font-bold text-gray-900">Pick Something to Explore</h2>
                    <p className="text-gray-500">What catches your eye?</p>
                  </div>

                  <div className="space-y-3">
                    {EXPLORE_TOPICS.map(topic => (
                      <motion.button
                        key={topic.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setSelectedTopic(topic.id);
                          if (userId) {
                            trackPreferenceChoice(userId, 'assessment_activity', topic.id, EXPLORE_TOPICS.map(t => t.id));
                          }
                        }}
                        className="w-full flex items-center gap-4 p-5 bg-white hover:bg-primary-50 border-2 border-gray-200 hover:border-primary-300 rounded-2xl transition-all text-left shadow-sm"
                      >
                        <span className="text-3xl flex-shrink-0">{topic.icon}</span>
                        <span className="text-lg font-bold text-gray-800">{topic.title}</span>
                      </motion.button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  {(() => {
                    const topic = EXPLORE_TOPICS.find(t => t.id === selectedTopic)!;
                    return (
                      <div className="bg-white rounded-3xl shadow-lg overflow-hidden">
                        <div className="bg-gradient-to-br from-primary-500 to-secondary-500 p-6 text-white text-center">
                          <span className="text-5xl block mb-2">{topic.icon}</span>
                          <h2 className="text-2xl font-bold">{topic.title}</h2>
                          <p className="text-sm opacity-80 mt-1">Tap anything that interests you!</p>
                        </div>

                        <div className="p-6 space-y-4">
                          {/* Visual section */}
                          <button
                            onClick={() => handleExploreClick('visual')}
                            className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                              exploredSections.has('visual')
                                ? 'border-primary-400 bg-primary-50'
                                : 'border-gray-200 hover:border-primary-200'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span>🎨</span>
                              <span className="font-bold text-sm text-gray-700">Visual</span>
                              {exploredSections.has('visual') && <span className="text-primary-500 text-xs">Explored!</span>}
                            </div>
                            <p className="text-sm text-gray-600">{topic.visual}</p>
                          </button>

                          {/* Text section */}
                          <button
                            onClick={() => handleExploreClick('text')}
                            className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                              exploredSections.has('text')
                                ? 'border-primary-400 bg-primary-50'
                                : 'border-gray-200 hover:border-primary-200'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span>📝</span>
                              <span className="font-bold text-sm text-gray-700">Read About It</span>
                              {exploredSections.has('text') && <span className="text-primary-500 text-xs">Explored!</span>}
                            </div>
                            <p className="text-sm text-gray-600">{topic.text}</p>
                          </button>

                          {/* Fun fact section */}
                          <button
                            onClick={() => handleExploreClick('fact')}
                            className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                              exploredSections.has('fact')
                                ? 'border-amber-400 bg-amber-50'
                                : 'border-gray-200 hover:border-amber-200'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span>💡</span>
                              <span className="font-bold text-sm text-gray-700">Fun Fact!</span>
                              {exploredSections.has('fact') && <span className="text-amber-600 text-xs">Explored!</span>}
                            </div>
                            <p className="text-sm text-gray-600">{topic.fact}</p>
                          </button>
                        </div>

                        <div className="px-6 pb-6">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs text-gray-400">
                              {exploredSections.size}/3 sections explored
                            </span>
                            <span className="text-xs text-gray-400">{exploreTimeSpent}s spent</span>
                          </div>
                          <button
                            onClick={handleFinishExplore}
                            className="w-full py-4 bg-gradient-to-r from-primary-500 to-secondary-500 text-white rounded-2xl font-bold hover:shadow-lg transition-all"
                          >
                            {exploredSections.size === 0 ? 'Skip' : 'Continue'}
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* ============================================================ */}
        {/* RESULTS — friendly, no labels, no "you are X type" */}
        {/* ============================================================ */}
        {phase === 'results' && (
          <motion.div
            key="results"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="min-h-screen flex items-center justify-center p-4"
          >
            <div className="max-w-lg w-full text-center">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-6xl mb-4"
              >
                🎉
              </motion.div>

              <h1 className="text-3xl font-bold text-gray-900 mb-3">
                We&apos;re Getting to Know You!
              </h1>
              <p className="text-gray-600 mb-8">
                Based on how you played, we&apos;ll start personalizing your learning.
                The more you use the app, the better it gets at understanding you.
              </p>

              {/* Show what we observed — NOT a label */}
              <div className="bg-white rounded-3xl shadow-lg p-6 mb-6 text-left">
                <h3 className="font-bold text-gray-900 mb-4">What we noticed:</h3>

                <div className="space-y-3">
                  {/* Mood insight */}
                  {selectedMood && (
                    <div className="flex items-start gap-3">
                      <span className="text-xl flex-shrink-0">
                        {MOOD_ISLANDS.find(m => m.value === selectedMood)?.icon}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          Starting mood: {MOOD_ISLANDS.find(m => m.value === selectedMood)?.label}
                        </p>
                        <p className="text-xs text-gray-500">We&apos;ll adjust today&apos;s pace to match</p>
                      </div>
                    </div>
                  )}

                  {/* Pattern insight */}
                  <div className="flex items-start gap-3">
                    <span className="text-xl flex-shrink-0">🧩</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        Puzzles: {patternAnswers.filter(a => a.correct).length}/{patternAnswers.length} solved
                        {patternAnswers.length > 0 && (
                          <span className="text-gray-500">
                            {' '}(avg {Math.round(patternAnswers.reduce((s, a) => s + a.timeMs, 0) / patternAnswers.length / 1000)}s per puzzle)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">Helps us understand your problem-solving style</p>
                    </div>
                  </div>

                  {/* Speed round insight */}
                  <div className="flex items-start gap-3">
                    <span className="text-xl flex-shrink-0">⚡</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        Quick fire: {speedAnswers.filter(a => a.correct).length}/{speedAnswers.length} correct
                      </p>
                      <p className="text-xs text-gray-500">Shows us which subjects feel natural to you</p>
                    </div>
                  </div>

                  {/* Explore insight */}
                  {exploredSections.size > 0 && (
                    <div className="flex items-start gap-3">
                      <span className="text-xl flex-shrink-0">🔍</span>
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          Explored {exploredSections.size} sections ({exploreTimeSpent}s)
                        </p>
                        <p className="text-xs text-gray-500">Tells us how you like to discover new things</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-amber-50 rounded-2xl p-4 mb-6 border border-amber-100">
                <p className="text-sm text-amber-800">
                  <strong>This is just the beginning.</strong> The more you learn with us,
                  the smarter your experience gets. We adapt to YOU — not the other way around.
                </p>
              </div>

              <button
                onClick={saveAndContinue}
                disabled={saving}
                className="w-full py-4 bg-gradient-to-r from-primary-500 to-secondary-500 text-white rounded-2xl font-bold text-lg hover:shadow-xl transition-all disabled:opacity-50"
              >
                {saving ? 'Setting things up...' : 'Start Learning! →'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
