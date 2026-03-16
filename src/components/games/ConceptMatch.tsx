'use client';

import React, { useState, useMemo } from 'react';
import type { ConceptMatchConfig } from '@/types/upgrade';

interface ConceptMatchProps {
  config: ConceptMatchConfig;
  addScore: (points: number) => void;
  setGameComplete: () => void;
  maxScore: number;
}

export default function ConceptMatch({ config, addScore, setGameComplete, maxScore }: ConceptMatchProps) {
  const pointsPerPair = Math.floor(maxScore / config.pairs.length);

  // Shuffle matches (including distractors)
  const allMatches = useMemo(() => {
    const matches = config.pairs.map(p => p.match);
    if (config.distractor_matches) {
      matches.push(...config.distractor_matches);
    }
    return matches.sort(() => Math.random() - 0.5);
  }, [config]);

  const [selectedConcept, setSelectedConcept] = useState<number | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
  const [matched, setMatched] = useState<Record<number, { match: string; correct: boolean }>>({});
  const [shake, setShake] = useState<string | null>(null);

  const tryMatch = (conceptIdx: number, match: string) => {
    const pair = config.pairs[conceptIdx];
    const isCorrect = pair.match === match;

    setMatched(prev => ({ ...prev, [conceptIdx]: { match, correct: isCorrect } }));

    if (isCorrect) {
      addScore(pointsPerPair);
    } else {
      setShake(match);
      setTimeout(() => setShake(null), 500);
    }

    setSelectedConcept(null);
    setSelectedMatch(null);

    // Check if all matched
    const newMatched = { ...matched, [conceptIdx]: { match, correct: isCorrect } };
    if (Object.keys(newMatched).length === config.pairs.length) {
      setTimeout(setGameComplete, 1500);
    }
  };

  const usedMatches = new Set(Object.values(matched).map(m => m.match));

  return (
    <div className="max-w-3xl mx-auto">
      <p className="text-sm text-gray-400 mb-4 text-center">{config.instruction}</p>

      <div className="grid grid-cols-2 gap-6">
        {/* Concepts (left side) */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Concepts</h4>
          {config.pairs.map((pair, i) => (
            <button
              key={i}
              onClick={() => {
                if (matched[i]) return;
                setSelectedConcept(i);
                if (selectedMatch !== null) {
                  tryMatch(i, selectedMatch);
                }
              }}
              disabled={!!matched[i]}
              className={`w-full text-left p-3 rounded-xl border-2 transition-all text-sm ${
                matched[i]?.correct
                  ? 'border-green-500 bg-green-500/10 text-green-400'
                  : matched[i]
                    ? 'border-red-500 bg-red-500/10 text-red-400'
                    : selectedConcept === i
                      ? 'border-primary-500 bg-primary-500/10 text-white'
                      : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-500'
              }`}
            >
              {pair.concept}
              {matched[i] && (
                <span className="ml-2">{matched[i].correct ? '✅' : '❌'}</span>
              )}
            </button>
          ))}
        </div>

        {/* Matches (right side) */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Matches</h4>
          {allMatches.map((match, i) => (
            <button
              key={i}
              onClick={() => {
                if (usedMatches.has(match)) return;
                setSelectedMatch(match);
                if (selectedConcept !== null) {
                  tryMatch(selectedConcept, match);
                }
              }}
              disabled={usedMatches.has(match)}
              className={`w-full text-left p-3 rounded-xl border-2 transition-all text-sm ${
                usedMatches.has(match)
                  ? 'border-gray-800 bg-gray-900 text-gray-600 opacity-50'
                  : selectedMatch === match
                    ? 'border-primary-500 bg-primary-500/10 text-white'
                    : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-500'
              } ${shake === match ? 'animate-shake' : ''}`}
            >
              {match}
            </button>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.3s ease-in-out; }
      `}</style>
    </div>
  );
}
