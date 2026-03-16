'use client';

import React, { useState } from 'react';
import type { CaseStudyConfig } from '@/types/upgrade';

interface CaseStudyProps {
  config: CaseStudyConfig;
  addScore: (points: number) => void;
  setGameComplete: () => void;
  maxScore: number;
}

export default function CaseStudy({ config, addScore, setGameComplete, maxScore }: CaseStudyProps) {
  const [currentDecisionId, setCurrentDecisionId] = useState(config.starting_decision_id);
  const [path, setPath] = useState<Array<{ decision: string; choice: string; outcome: string; score: number }>>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const currentDecision = config.decisions.find(d => d.id === currentDecisionId);

  const makeChoice = (optionIndex: number) => {
    if (!currentDecision) return;

    const option = currentDecision.options[optionIndex];
    const newScore = totalScore + option.score;
    setTotalScore(newScore);

    setPath(prev => [...prev, {
      decision: currentDecision.question,
      choice: option.text,
      outcome: option.outcome,
      score: option.score,
    }]);

    if (option.next_decision_id) {
      setCurrentDecisionId(option.next_decision_id);
    } else {
      // End of case study
      setIsComplete(true);
      const finalScore = Math.min(Math.round((newScore / (config.decisions.length * 10)) * maxScore), maxScore);
      addScore(finalScore);
      setTimeout(setGameComplete, 3000);
    }
  };

  if (isComplete) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="p-6 bg-gray-800/50 border border-gray-700 rounded-2xl mb-6">
          <h3 className="text-xl font-bold text-white mb-4">Case Study Complete!</h3>
          <div className="space-y-4">
            {path.map((step, i) => (
              <div key={i} className="p-3 bg-gray-900 rounded-xl">
                <p className="text-sm text-gray-400">Decision {i + 1}: {step.decision}</p>
                <p className="text-sm text-primary-400 mt-1">Your choice: {step.choice}</p>
                <p className="text-sm text-gray-300 mt-1">{step.outcome}</p>
                <span className={`text-xs font-bold ${step.score > 5 ? 'text-green-400' : step.score > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                  +{step.score} points
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Scenario */}
      <div className="p-6 bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700 rounded-2xl mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">Scenario</h3>
        <p className="text-gray-300 text-sm leading-relaxed">{config.scenario}</p>
        {config.scenario_image_url && (
          <img src={config.scenario_image_url} alt="Scenario" className="mt-3 rounded-lg w-full" />
        )}
      </div>

      {/* Progress */}
      <div className="flex gap-1 mb-4">
        {config.decisions.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${i < path.length ? 'bg-primary-500' : 'bg-gray-700'}`}
          />
        ))}
      </div>

      {/* Current decision */}
      {currentDecision && (
        <div className="p-6 bg-gray-800/50 border border-gray-700 rounded-2xl">
          <h4 className="text-white font-medium mb-4">{currentDecision.question}</h4>

          <div className="space-y-3">
            {currentDecision.options.map((option, i) => (
              <button
                key={i}
                onClick={() => makeChoice(i)}
                className="w-full text-left p-4 bg-gray-900 border border-gray-700 rounded-xl hover:border-primary-500 hover:bg-gray-850 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-primary-600/20 border border-primary-500/30 text-primary-400 text-sm font-bold flex items-center justify-center group-hover:bg-primary-600 group-hover:text-white transition-all">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="text-sm text-gray-300 group-hover:text-white">{option.text}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Previous decisions */}
      {path.length > 0 && (
        <div className="mt-6">
          <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Your Journey</h4>
          {path.map((step, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <span className="text-primary-400">→</span>
              <span>{step.choice}</span>
              <span className={step.score > 5 ? 'text-green-400' : 'text-yellow-400'}>+{step.score}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
