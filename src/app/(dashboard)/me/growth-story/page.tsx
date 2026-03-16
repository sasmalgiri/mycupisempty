'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface GrowthStory {
  id?: string;
  period_start: string;
  period_end: string;
  story_type: string;
  narrative: string;
  highlights?: string[];
  data_context?: Record<string, any>;
  created_at: string;
}

const STORY_TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  on_demand: { label: 'Growth Snapshot', icon: '📅', color: 'from-blue-500 to-cyan-400' },
  monthly: { label: 'Monthly Journey', icon: '🌙', color: 'from-purple-500 to-pink-400' },
  term: { label: 'Term Story', icon: '📖', color: 'from-amber-500 to-orange-400' },
  annual: { label: 'Annual Celebration', icon: '🏆', color: 'from-green-500 to-emerald-400' },
};

const ENCOURAGING_MESSAGES = [
  'Weaving your story of growth...',
  'Gathering your achievements...',
  'Reflecting on your journey...',
  'Finding the bright spots...',
  'Crafting your narrative...',
  'Celebrating your progress...',
];

export default function GrowthStoryPage() {
  const [stories, setStories] = useState<GrowthStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [encouragingMsg, setEncouragingMsg] = useState(ENCOURAGING_MESSAGES[0]);

  // Generate form state
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [storyType, setStoryType] = useState<string>('on_demand');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  useEffect(() => {
    fetchStories();
    // Set default period dates
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    setPeriodEnd(now.toISOString().split('T')[0]);
    setPeriodStart(weekAgo.toISOString().split('T')[0]);
  }, []);

  // Cycle encouraging messages during generation
  useEffect(() => {
    if (!generating) return;
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % ENCOURAGING_MESSAGES.length;
      setEncouragingMsg(ENCOURAGING_MESSAGES[idx]);
    }, 3000);
    return () => clearInterval(interval);
  }, [generating]);

  const fetchStories = async () => {
    try {
      const res = await fetch('/api/growth-story');
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setStories(json.stories || []);
      }
    } catch {
      setError('Failed to load stories');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!periodStart || !periodEnd) return;

    setGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/growth-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          period_start: periodStart,
          period_end: periodEnd,
          story_type: storyType,
        }),
      });

      const json = await res.json();

      if (json.error) {
        setError(json.error);
      } else if (json.story) {
        setStories(prev => [json.story, ...prev]);
        setShowGenerateForm(false);
        setExpandedId(json.story.id || json.story.created_at);
      }
    } catch {
      setError('Failed to generate story. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const canGenerate = () => {
    if (stories.length === 0) return true;
    const lastStory = stories[0];
    const lastGenerated = new Date(lastStory.created_at).getTime();
    const hoursSinceLast = (Date.now() - lastGenerated) / (1000 * 60 * 60);
    return hoursSinceLast >= 24;
  };

  const handleShare = (type: 'parent' | 'teacher', story: GrowthStory) => {
    // In production, this would create a sharing link or notification
    const message = `Growth Story (${story.period_start} to ${story.period_end}): ${story.narrative.slice(0, 200)}...`;
    if (navigator.share) {
      navigator.share({
        title: `My Growth Story - ${STORY_TYPE_CONFIG[story.story_type]?.label || 'Growth Story'}`,
        text: message,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(story.narrative).then(() => {
        alert(`Story copied to clipboard! Share it with your ${type}.`);
      }).catch(() => {});
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-16 h-16 bg-amber-200 rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Loading your growth stories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-lg border-b border-amber-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/me" className="p-2 hover:bg-amber-100 rounded-lg transition-colors">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">My Growth Story</h1>
                <p className="text-xs text-gray-500">Your journey, beautifully told</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 rounded-3xl p-8 mb-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2"></div>
          <div className="relative z-10">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">Every step counts.</h2>
            <p className="text-white/80 max-w-lg">
              Your growth story captures not just what you learned, but who you&apos;re becoming.
              Generate a personalized narrative to celebrate your progress.
            </p>
            <div className="mt-6">
              {canGenerate() ? (
                <button
                  onClick={() => setShowGenerateForm(!showGenerateForm)}
                  className="px-6 py-3 bg-white text-amber-600 rounded-xl font-bold hover:bg-amber-50 transition-colors shadow-lg"
                >
                  Generate My Growth Story
                </button>
              ) : (
                <div className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 rounded-xl text-white/80">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm">You can generate a new story once every 24 hours</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Generate Form */}
        <AnimatePresence>
          {showGenerateForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden mb-8"
            >
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-amber-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Create Your Story</h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Story Type</label>
                    <select
                      value={storyType}
                      onChange={(e) => setStoryType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    >
                      {Object.entries(STORY_TYPE_CONFIG).map(([key, config]) => (
                        <option key={key} value={key}>
                          {config.icon} {config.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Period Start</label>
                    <input
                      type="date"
                      value={periodStart}
                      onChange={(e) => setPeriodStart(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Period End</label>
                    <input
                      type="date"
                      value={periodEnd}
                      onChange={(e) => setPeriodEnd(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleGenerate}
                    disabled={generating || !periodStart || !periodEnd}
                    className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generating ? 'Generating...' : 'Generate Story'}
                  </button>
                  <button
                    onClick={() => setShowGenerateForm(false)}
                    className="px-6 py-2.5 text-gray-500 hover:text-gray-700 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generating Animation */}
        <AnimatePresence>
          {generating && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mb-8"
            >
              <div className="bg-gradient-to-r from-amber-100 to-orange-100 rounded-2xl p-8 text-center border border-amber-200">
                <div className="relative w-20 h-20 mx-auto mb-4">
                  <div className="absolute inset-0 rounded-full border-4 border-amber-200"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-amber-500 border-t-transparent animate-spin"></div>
                  <div className="absolute inset-3 rounded-full bg-amber-50 flex items-center justify-center">
                    <span className="text-2xl">✨</span>
                  </div>
                </div>
                <motion.p
                  key={encouragingMsg}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-amber-800 font-medium"
                >
                  {encouragingMsg}
                </motion.p>
                <p className="text-amber-600 text-sm mt-2">This may take a moment...</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Stories List */}
        {stories.length === 0 && !generating && !error ? (
          <div className="bg-white rounded-2xl p-12 shadow-md text-center">
            <span className="text-5xl block mb-4">📖</span>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No Stories Yet</h2>
            <p className="text-gray-500 max-w-md mx-auto">
              Your growth story is waiting to be written. Click &quot;Generate My Growth Story&quot;
              above to create your first personalized narrative.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {stories.map((story, index) => {
              const config = STORY_TYPE_CONFIG[story.story_type] || STORY_TYPE_CONFIG.on_demand;
              const storyId = story.id || story.created_at;
              const isExpanded = expandedId === storyId;

              return (
                <motion.div
                  key={storyId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-amber-50 hover:shadow-lg transition-shadow">
                    {/* Story Header - Always Visible */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : storyId)}
                      className="w-full text-left p-6 focus:outline-none"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          <div className={`flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${config.color} flex items-center justify-center text-xl text-white shadow-md`}>
                            {config.icon}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-gray-900">{config.label}</h3>
                            <p className="text-sm text-gray-500">
                              {formatDate(story.period_start)} - {formatDate(story.period_end)}
                            </p>
                            {/* Key highlights preview */}
                            {story.highlights && story.highlights.length > 0 && !isExpanded && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {story.highlights.slice(0, 3).map((h, i) => (
                                  <span key={i} className="text-xs px-2 py-1 bg-amber-50 text-amber-700 rounded-full">
                                    {h.length > 30 ? h.slice(0, 30) + '...' : h}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0 ml-4">
                          <motion.svg
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                            className="w-5 h-5 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </motion.svg>
                        </div>
                      </div>
                    </button>

                    {/* Expanded Content */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden"
                        >
                          <div className="px-6 pb-6 border-t border-amber-50">
                            {/* Narrative */}
                            <div className="mt-4 mb-6 prose prose-sm max-w-none">
                              <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                                {story.narrative}
                              </div>
                            </div>

                            {/* Highlights */}
                            {story.highlights && story.highlights.length > 0 && (
                              <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-100">
                                <h4 className="text-sm font-bold text-amber-800 mb-2">Key Highlights</h4>
                                <ul className="space-y-1">
                                  {story.highlights.map((h, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                                      <span className="flex-shrink-0 mt-0.5">&#9733;</span>
                                      <span>{h}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Data Context Summary */}
                            {story.data_context && (
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                                {story.data_context.total_topics > 0 && (
                                  <div className="p-3 bg-blue-50 rounded-xl text-center">
                                    <p className="text-lg font-bold text-blue-700">{story.data_context.total_topics}</p>
                                    <p className="text-[10px] text-blue-500">Topics Studied</p>
                                  </div>
                                )}
                                {story.data_context.topics_mastered > 0 && (
                                  <div className="p-3 bg-green-50 rounded-xl text-center">
                                    <p className="text-lg font-bold text-green-700">{story.data_context.topics_mastered}</p>
                                    <p className="text-[10px] text-green-500">Topics Mastered</p>
                                  </div>
                                )}
                                {story.data_context.habit_completions > 0 && (
                                  <div className="p-3 bg-purple-50 rounded-xl text-center">
                                    <p className="text-lg font-bold text-purple-700">{story.data_context.habit_completions}</p>
                                    <p className="text-[10px] text-purple-500">Habit Check-ins</p>
                                  </div>
                                )}
                                {story.data_context.reflection_count > 0 && (
                                  <div className="p-3 bg-amber-50 rounded-xl text-center">
                                    <p className="text-lg font-bold text-amber-700">{story.data_context.reflection_count}</p>
                                    <p className="text-[10px] text-amber-500">Reflections</p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Share Buttons */}
                            <div className="flex flex-wrap items-center gap-3">
                              <button
                                onClick={() => handleShare('parent', story)}
                                className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-xl text-sm font-medium hover:bg-amber-200 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                </svg>
                                Share with Parent
                              </button>
                              <button
                                onClick={() => handleShare('teacher', story)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-xl text-sm font-medium hover:bg-blue-200 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                                </svg>
                                Share with Teacher
                              </button>
                              <span className="text-xs text-gray-400 ml-auto">
                                Generated {formatDate(story.created_at)}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
