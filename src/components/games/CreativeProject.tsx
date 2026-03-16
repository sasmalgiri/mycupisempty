'use client';

import React, { useState } from 'react';
import type { CreativeProjectConfig } from '@/types/upgrade';

interface CreativeProjectProps {
  config: CreativeProjectConfig;
  addScore: (points: number) => void;
  setGameComplete: () => void;
  maxScore: number;
}

export default function CreativeProject({ config, addScore, setGameComplete, maxScore }: CreativeProjectProps) {
  const [submission, setSubmission] = useState('');
  const [selfScores, setSelfScores] = useState<Record<number, number>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  const totalRubricPoints = config.rubric.reduce((sum, r) => sum + r.max_points, 0);

  const handleSelfScore = (index: number, score: number) => {
    setSelfScores(prev => ({ ...prev, [index]: score }));
  };

  const submit = () => {
    const totalSelfScore = Object.values(selfScores).reduce((sum, s) => sum + s, 0);
    const normalizedScore = Math.round((totalSelfScore / totalRubricPoints) * maxScore);
    addScore(normalizedScore);
    setIsSubmitted(true);
    setTimeout(setGameComplete, 2000);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Project prompt */}
      <div className="p-6 bg-gradient-to-br from-purple-900/30 to-blue-900/30 border border-purple-500/20 rounded-2xl mb-6">
        <h3 className="text-lg font-semibold text-white mb-2">Creative Project</h3>
        <p className="text-gray-300 text-sm leading-relaxed">{config.prompt}</p>
      </div>

      {/* Examples */}
      {config.examples && config.examples.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-400 mb-2">Examples for inspiration:</h4>
          <div className="space-y-2">
            {config.examples.map((example, i) => (
              <div key={i} className="p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
                <p className="text-sm text-gray-300">{example}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submission */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-white mb-2">
          Your Work ({config.submission_type})
        </h4>
        <textarea
          value={submission}
          onChange={(e) => setSubmission(e.target.value)}
          placeholder={
            config.submission_type === 'text' ? 'Write your response here...'
            : config.submission_type === 'code' ? 'Write your code here...'
            : 'Describe your work here...'
          }
          className={`w-full p-4 bg-gray-900 border border-gray-600 rounded-xl text-white text-sm
                    focus:outline-none focus:border-primary-500 resize-none
                    ${config.submission_type === 'code' ? 'font-mono' : ''}`}
          rows={8}
          disabled={isSubmitted}
        />
      </div>

      {/* Self-evaluation rubric */}
      {submission.length > 20 && !isSubmitted && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-white mb-3">Self-Evaluate Your Work</h4>
          <div className="space-y-4">
            {config.rubric.map((criterion, i) => (
              <div key={i} className="p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm text-white font-medium">{criterion.criterion}</p>
                    <p className="text-xs text-gray-500">{criterion.description}</p>
                  </div>
                  <span className="text-xs text-gray-400">/{criterion.max_points}</span>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: criterion.max_points + 1 }, (_, score) => (
                    <button
                      key={score}
                      onClick={() => handleSelfScore(i, score)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                        selfScores[i] === score
                          ? 'bg-primary-600 text-white'
                          : score <= (selfScores[i] ?? -1)
                            ? 'bg-primary-600/30 text-primary-300'
                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      }`}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit */}
      {Object.keys(selfScores).length === config.rubric.length && !isSubmitted && (
        <div className="text-center">
          <button
            onClick={submit}
            className="px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium text-lg"
          >
            Submit Project
          </button>
        </div>
      )}

      {isSubmitted && (
        <div className="p-4 bg-green-500/20 border border-green-500/30 rounded-xl text-center">
          <p className="text-green-400 font-medium">Project submitted! Great work! 🎉</p>
        </div>
      )}
    </div>
  );
}
