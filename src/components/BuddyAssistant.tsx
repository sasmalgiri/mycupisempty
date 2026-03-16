'use client';

import React, { useState, useEffect, useCallback } from 'react';

/**
 * BuddyAssistant — A floating AI companion that acts as:
 * - Co-reader: summarizes and discusses what you're reading
 * - Study buddy: reminds you to take breaks, suggests activities
 * - Motivator: celebrates achievements, encourages during struggles
 * - Guide: suggests next steps, methods, and resources
 */

interface BuddyMessage {
  text: string;
  type: 'tip' | 'motivation' | 'question' | 'reminder' | 'celebration';
  action?: { label: string; href: string };
}

const BUDDY_MESSAGES: BuddyMessage[] = [
  { text: "Hey! Have you tried the Socratic method for this topic? It's amazing for understanding deeply!", type: 'tip', action: { label: 'Try it', href: '/guru?method=socratic' } },
  { text: "You've been studying for 25 minutes — time for a 5-minute break! (Pomodoro style 🍅)", type: 'reminder' },
  { text: "Did you know? The Memory Palace technique was used by ancient Greek orators to memorize long speeches!", type: 'tip', action: { label: 'Try Memory Palace', href: '/guru?method=memory_palace' } },
  { text: "Great progress today! You've completed 3 topics. Keep it up! 💪", type: 'motivation' },
  { text: "Feeling stuck? Try explaining this topic to a friend or even a toy — that's the Feynman Technique!", type: 'tip' },
  { text: "Your Learning DNA profile is only 50% complete. Finish the Kolb assessment to unlock better recommendations!", type: 'reminder', action: { label: 'Take Assessment', href: '/assessment/kolb' } },
  { text: "Quick quiz: Can you recall the 3 main points from your last topic? Close your eyes and try! (Active Recall)", type: 'question' },
  { text: "You're on a 5-day streak! 🔥 One more day and you'll unlock the 'Consistent Learner' badge!", type: 'celebration' },
  { text: "Try the Vedic Math sutra 'Nikhilam' for faster mental multiplication — it's mindblowing! 🕉️", type: 'tip', action: { label: 'Learn Vedic Math', href: '/guru?method=vedic_math' } },
  { text: "New challenge available! Test your speed in today's timed challenge.", type: 'reminder', action: { label: 'Go to Challenges', href: '/challenges' } },
  { text: "Ancient wisdom: 'विद्या ददाति विनयम्' — Knowledge gives humility. Keep learning! 🙏", type: 'motivation' },
  { text: "Your best subject is Mathematics! Have you explored the advanced activities yet?", type: 'tip', action: { label: 'Activities', href: '/activities' } },
];

const BUDDY_MOODS = {
  tip: { emoji: '💡', bg: 'from-blue-600/20 to-blue-800/20', border: 'border-blue-500/30' },
  motivation: { emoji: '💪', bg: 'from-green-600/20 to-green-800/20', border: 'border-green-500/30' },
  question: { emoji: '🤔', bg: 'from-purple-600/20 to-purple-800/20', border: 'border-purple-500/30' },
  reminder: { emoji: '⏰', bg: 'from-amber-600/20 to-amber-800/20', border: 'border-amber-500/30' },
  celebration: { emoji: '🎉', bg: 'from-pink-600/20 to-pink-800/20', border: 'border-pink-500/30' },
};

export default function BuddyAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMessage, setCurrentMessage] = useState<BuddyMessage | null>(null);
  const [showBubble, setShowBubble] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Show a random message every 3 minutes
  useEffect(() => {
    const showRandomMessage = () => {
      if (dismissed) return;
      const msg = BUDDY_MESSAGES[Math.floor(Math.random() * BUDDY_MESSAGES.length)];
      setCurrentMessage(msg);
      setShowBubble(true);

      // Auto-hide after 10 seconds
      setTimeout(() => setShowBubble(false), 10000);
    };

    // Show first message after 30 seconds
    const initialTimer = setTimeout(showRandomMessage, 30000);
    // Then every 3 minutes
    const interval = setInterval(showRandomMessage, 180000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [dismissed]);

  const dismiss = () => {
    setShowBubble(false);
    setDismissed(true);
    // Re-enable after 10 minutes
    setTimeout(() => setDismissed(false), 600000);
  };

  const mood = currentMessage ? BUDDY_MOODS[currentMessage.type] : BUDDY_MOODS.tip;

  return (
    <>
      {/* Floating Buddy Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 shadow-lg shadow-primary-500/30 flex items-center justify-center text-2xl hover:scale-110 transition-transform"
        title="Your Study Buddy"
      >
        🧙
      </button>

      {/* Speech bubble */}
      {showBubble && currentMessage && !isOpen && (
        <div className={`fixed bottom-24 right-6 z-50 max-w-xs p-4 rounded-2xl border bg-gradient-to-br ${mood.bg} ${mood.border} shadow-xl animate-slideUp`}>
          <button onClick={dismiss} className="absolute top-2 right-2 text-gray-500 hover:text-white text-xs">✕</button>
          <div className="flex items-start gap-2">
            <span className="text-xl flex-shrink-0">{mood.emoji}</span>
            <div>
              <p className="text-sm text-gray-200 leading-relaxed">{currentMessage.text}</p>
              {currentMessage.action && (
                <a
                  href={currentMessage.action.href}
                  className="inline-block mt-2 px-3 py-1 bg-primary-600 text-white text-xs rounded-lg hover:bg-primary-700"
                >
                  {currentMessage.action.label} →
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Expanded buddy panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-80 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-primary-600 to-accent-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🧙</span>
                <div>
                  <h3 className="text-white font-bold text-sm">Your Study Buddy</h3>
                  <p className="text-white/70 text-xs">Always here to help!</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-white/70 hover:text-white">✕</button>
            </div>
          </div>

          <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
            {/* Quick actions */}
            <h4 className="text-xs text-gray-500 uppercase tracking-wider">Quick Actions</h4>

            <a href="/guru" className="flex items-center gap-3 p-3 bg-gray-800 rounded-xl hover:bg-gray-750 transition-all">
              <span className="text-lg">🧙</span>
              <div>
                <p className="text-sm text-white font-medium">Ask AI Guru</p>
                <p className="text-xs text-gray-400">Get any topic explained</p>
              </div>
            </a>

            <a href="/activities" className="flex items-center gap-3 p-3 bg-gray-800 rounded-xl hover:bg-gray-750 transition-all">
              <span className="text-lg">🎮</span>
              <div>
                <p className="text-sm text-white font-medium">Play a Game</p>
                <p className="text-xs text-gray-400">Learn through fun activities</p>
              </div>
            </a>

            <a href="/methods" className="flex items-center gap-3 p-3 bg-gray-800 rounded-xl hover:bg-gray-750 transition-all">
              <span className="text-lg">📚</span>
              <div>
                <p className="text-sm text-white font-medium">Try a New Method</p>
                <p className="text-xs text-gray-400">20+ ways to learn</p>
              </div>
            </a>

            <a href="/learning-dna" className="flex items-center gap-3 p-3 bg-gray-800 rounded-xl hover:bg-gray-750 transition-all">
              <span className="text-lg">🧬</span>
              <div>
                <p className="text-sm text-white font-medium">My Learning Profile</p>
                <p className="text-xs text-gray-400">See how you learn best</p>
              </div>
            </a>

            <a href="/flashcards" className="flex items-center gap-3 p-3 bg-gray-800 rounded-xl hover:bg-gray-750 transition-all">
              <span className="text-lg">🃏</span>
              <div>
                <p className="text-sm text-white font-medium">Review Flashcards</p>
                <p className="text-xs text-gray-400">Spaced repetition practice</p>
              </div>
            </a>

            <h4 className="text-xs text-gray-500 uppercase tracking-wider pt-2">Today's Tip</h4>
            {currentMessage && (
              <div className={`p-3 rounded-xl bg-gradient-to-br ${mood.bg} border ${mood.border}`}>
                <p className="text-xs text-gray-300">{currentMessage.text}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
      `}</style>
    </>
  );
}
