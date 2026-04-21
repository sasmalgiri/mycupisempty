'use client';

import { useState, useCallback, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

interface UnstuckButtonProps {
  topicId?: string;
  subjectName?: string;
  currentModule?: string;
  masteryBand?: number;
  scaffoldLevel?: number;
  /** Minimum time on page before showing — 0 to show immediately. Default 180s (3 min). */
  appearAfterMs?: number;
}

export default function UnstuckButton({
  topicId,
  subjectName,
  currentModule,
  masteryBand,
  scaffoldLevel,
  appearAfterMs = 180000,
}: UnstuckButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [showContext, setShowContext] = useState(false);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);
  // Don't be intrusive on first load. Only surface after the user has spent real time on a topic,
  // or immediately if they navigated here with stuck context already attached.
  const hasContext = Boolean(topicId || subjectName || currentModule);
  const [visible, setVisible] = useState(hasContext || appearAfterMs === 0);

  useEffect(() => {
    if (hasContext || appearAfterMs === 0) {
      setVisible(true);
      return;
    }
    setVisible(false);
    const t = setTimeout(() => setVisible(true), appearAfterMs);
    return () => clearTimeout(t);
  }, [pathname, hasContext, appearAfterMs]);

  const buildGuruUrl = useCallback(() => {
    const params = new URLSearchParams({ unstuck: 'true' });
    if (topicId) params.set('topic_id', topicId);
    if (subjectName) params.set('subject', subjectName);
    if (currentModule) params.set('module', currentModule);
    if (masteryBand !== undefined) params.set('mastery', String(masteryBand));
    if (scaffoldLevel !== undefined) params.set('scaffold', String(scaffoldLevel));
    return `/guru?${params.toString()}`;
  }, [topicId, subjectName, currentModule, masteryBand, scaffoldLevel]);

  const handleNavigate = () => {
    router.push(buildGuruUrl());
  };

  const handlePointerEnter = () => {
    const timeout = setTimeout(() => setShowContext(true), 300);
    setHoverTimeout(timeout);
  };

  const handlePointerLeave = () => {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    setShowContext(false);
  };

  const handleTap = () => {
    // On mobile: first tap shows context card, second tap navigates
    if (!showContext && (topicId || subjectName)) {
      setShowContext(true);
      return;
    }
    handleNavigate();
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 right-24 z-50 flex flex-col items-end gap-2 mb-safe">
      <AnimatePresence>
        {showContext && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="bg-white rounded-xl shadow-lg border border-gray-200 p-3 min-w-[200px] max-w-[260px]"
          >
            {/* Mini context card */}
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Current Context
            </p>
            <div className="space-y-1.5">
              {subjectName && (
                <div className="flex items-center gap-2">
                  <span className="text-sm">📚</span>
                  <span className="text-sm text-gray-700 font-medium">{subjectName}</span>
                </div>
              )}
              {topicId && (
                <div className="flex items-center gap-2">
                  <span className="text-sm">📝</span>
                  <span className="text-sm text-gray-600">Topic: {topicId}</span>
                </div>
              )}
              {currentModule && (
                <div className="flex items-center gap-2">
                  <span className="text-sm">📦</span>
                  <span className="text-sm text-gray-600">Module: {currentModule}</span>
                </div>
              )}
              {masteryBand !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="text-sm">📊</span>
                  <span className="text-sm text-gray-600">Mastery: {masteryBand}%</span>
                </div>
              )}
            </div>
            <button
              onClick={handleNavigate}
              className="mt-3 w-full text-center text-xs font-semibold text-white bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 rounded-lg py-1.5 transition-colors"
            >
              Open AI Guru with Context →
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tooltip */}
      <AnimatePresence>
        {!showContext && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="pointer-events-none absolute -top-10 right-0 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap shadow-md"
          >
            Get help from AI Guru
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating button */}
      <motion.button
        onClick={handleTap}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        className="group relative flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold rounded-full shadow-lg shadow-red-500/30 hover:shadow-xl hover:shadow-red-500/40 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
        animate={{
          scale: [1, 1.04, 1],
        }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          repeatType: 'loop',
          ease: 'easeInOut',
        }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        title="Get help from AI Guru"
        aria-label="I'm Stuck — open AI Guru for help"
      >
        {/* Pulse ring behind the button */}
        <span className="absolute inset-0 rounded-full bg-red-400 opacity-0 group-hover:opacity-0 animate-ping-slow" />

        <span className="text-lg leading-none" aria-hidden="true">🆘</span>
        <span className="text-sm tracking-wide">I'm Stuck</span>
      </motion.button>

      <style jsx>{`
        @keyframes ping-slow {
          0% { transform: scale(1); opacity: 0.4; }
          75%, 100% { transform: scale(1.5); opacity: 0; }
        }
        .animate-ping-slow {
          animation: ping-slow 3s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        .mb-safe {
          margin-bottom: env(safe-area-inset-bottom, 0px);
        }
        @media (max-width: 640px) {
          /* Push above potential bottom nav on mobile */
          .mb-safe {
            margin-bottom: calc(env(safe-area-inset-bottom, 0px) + 4rem);
          }
        }
      `}</style>
    </div>
  );
}
