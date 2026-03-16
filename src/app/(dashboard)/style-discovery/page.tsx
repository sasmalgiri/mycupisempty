'use client';

import React, { useState } from 'react';
import { useStyleEvaluation, useLearningStyles } from '@/hooks/learning-teams';
import { RadarChart } from '@/components/ui/upgrade';
import { Button, Card, LoadingSpinner } from '@/components/ui/index';
import Link from 'next/link';
import type { LearningStyleCode } from '@/types/learning-teams';

const STYLE_ICONS: Record<string, string> = {
  visual_spatial: '👁️', auditory_musical: '👂', reading_writing: '📖',
  kinesthetic_tactile: '🤲', logical_mathematical: '🧮', social_interpersonal: '🤝',
  solitary_intrapersonal: '🧘', naturalistic: '🌿',
};

const STYLE_COLORS: Record<string, string> = {
  visual_spatial: '#3b82f6', auditory_musical: '#8b5cf6', reading_writing: '#22c55e',
  kinesthetic_tactile: '#f59e0b', logical_mathematical: '#ef4444', social_interpersonal: '#ec4899',
  solitary_intrapersonal: '#6366f1', naturalistic: '#10b981',
};

export default function StyleDiscoveryPage() {
  const [phase, setPhase] = useState<'intro' | 'test' | 'result'>('intro');
  const [subjectFilter, setSubjectFilter] = useState<string>('');
  const { styles, loading: stylesLoading } = useLearningStyles();
  const {
    questions, currentIndex, currentQuestion, answers, result, loading,
    isComplete, progress,
    startEvaluation, answerQuestion, submitEvaluation,
  } = useStyleEvaluation(subjectFilter || undefined);

  const handleStart = async () => {
    await startEvaluation(subjectFilter || undefined);
    setPhase('test');
  };

  const handleAnswer = (optionIndex: number) => {
    answerQuestion(optionIndex);
    if (answers.length + 1 === questions.length) {
      // Will be complete after this answer
    }
  };

  const handleSubmit = async () => {
    await submitEvaluation();
    setPhase('result');
  };

  // INTRO PHASE
  if (phase === 'intro') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center mb-8">
          <span className="text-6xl block mb-4">🧬</span>
          <h1 className="text-3xl font-bold text-white mb-2">Discover Your Learning Style</h1>
          <p className="text-gray-400 max-w-lg mx-auto">
            Everyone learns differently. This assessment will discover which of the 8 major learning
            styles fits you best — and it can be different for each subject!
          </p>
        </div>

        {/* 8 Learning Styles Preview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {styles.map(style => (
            <Card key={style.code} className="p-4 text-center hover:border-gray-500 transition-all">
              <span className="text-3xl block mb-2">{style.icon || STYLE_ICONS[style.code]}</span>
              <h3 className="text-sm font-medium text-white">{style.name.replace(' Learners', '')}</h3>
              <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">{style.description?.substring(0, 60)}...</p>
            </Card>
          ))}
          {stylesLoading && <LoadingSpinner />}
        </div>

        {/* Subject selector (optional) */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-3">Choose Assessment Type</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setSubjectFilter('')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                !subjectFilter ? 'bg-primary-600 text-white' : 'bg-gray-800 text-gray-400 border border-gray-700'
              }`}
            >
              General (All Subjects)
            </button>
            {['Mathematics', 'Science', 'English', 'History'].map(sub => (
              <button
                key={sub}
                onClick={() => setSubjectFilter(sub)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  subjectFilter === sub ? 'bg-primary-600 text-white' : 'bg-gray-800 text-gray-400 border border-gray-700'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3">
            {subjectFilter
              ? `This will include subject-specific questions for ${subjectFilter} + general questions.`
              : 'General assessment covers all learning contexts. You can take subject-specific tests later.'}
          </p>
        </Card>

        <div className="text-center">
          <p className="text-sm text-gray-400 mb-4">
            {questions.length} questions | ~{Math.ceil(questions.length * 0.5)} minutes
          </p>
          <Button onClick={handleStart} variant="primary" className="px-8 py-3 text-lg">
            Start Assessment
          </Button>
        </div>
      </div>
    );
  }

  // TEST PHASE
  if (phase === 'test') {
    if (!currentQuestion) {
      return <div className="flex justify-center py-20"><LoadingSpinner /></div>;
    }

    return (
      <div className="max-w-3xl mx-auto p-6">
        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>Question {currentIndex + 1} of {questions.length}</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <Card className="p-8 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs px-2 py-1 bg-gray-700 rounded text-gray-300 capitalize">
              {currentQuestion.question_type.replace(/_/g, ' ')}
            </span>
          </div>
          <h2 className="text-xl font-bold text-white mb-6 leading-relaxed">
            {currentQuestion.question_text}
          </h2>

          <div className="space-y-3">
            {currentQuestion.options.map((opt: any, i: number) => (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                disabled={loading}
                className="w-full text-left p-4 bg-gray-800 rounded-xl border border-gray-700
                           hover:border-primary-500 hover:bg-gray-750 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-gray-700 group-hover:bg-primary-600 flex items-center justify-center text-sm text-gray-300 group-hover:text-white font-bold flex-shrink-0 transition-all">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-gray-200">{opt.text}</p>
                  </div>
                  <span className="text-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    {STYLE_ICONS[opt.style_code] || ''}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Submit when all answered */}
        {isComplete && (
          <div className="text-center">
            <Button onClick={handleSubmit} variant="primary" className="px-8 py-3" disabled={loading}>
              {loading ? 'Analyzing...' : 'See My Results'}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // RESULT PHASE
  if (phase === 'result' && result) {
    const primaryStyle = styles.find(s => s.code === result.primary_style);
    const secondaryStyle = styles.find(s => s.code === result.secondary_style);

    const radarData = Object.entries(result.style_scores)
      .filter(([key]) => key in STYLE_ICONS)
      .map(([key, value]) => ({
        label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).substring(0, 12),
        value: value as number,
        maxValue: 100,
      }));

    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center mb-8">
          <span className="text-6xl block mb-4">🎉</span>
          <h1 className="text-3xl font-bold text-white mb-2">Your Learning Style Profile</h1>
          <p className="text-gray-400">Based on your {questions.length} responses</p>
        </div>

        {/* Primary Style */}
        <div className="p-8 mb-6 border-2 rounded-xl bg-gray-900" style={{ borderColor: STYLE_COLORS[result.primary_style] }}>
          <div className="flex items-center gap-4 mb-4">
            <span className="text-5xl">{primaryStyle?.icon || STYLE_ICONS[result.primary_style]}</span>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Your Primary Learning Style</p>
              <h2 className="text-2xl font-bold text-white">{primaryStyle?.name || result.primary_style}</h2>
              {primaryStyle?.name_hindi && <p className="text-sm text-gray-400">{primaryStyle.name_hindi}</p>}
            </div>
            <div className="ml-auto text-right">
              <p className="text-3xl font-bold" style={{ color: STYLE_COLORS[result.primary_style] }}>
                {result.confidence}%
              </p>
              <p className="text-xs text-gray-500">Confidence</p>
            </div>
          </div>
          <p className="text-gray-300 leading-relaxed">{primaryStyle?.description}</p>

          {primaryStyle?.teaching_strategies && (
            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Best Learning Strategies for You</p>
              <div className="flex flex-wrap gap-2">
                {(primaryStyle.teaching_strategies as string[]).slice(0, 8).map((s, i) => (
                  <span key={i} className="px-3 py-1 bg-gray-800 rounded-lg text-xs text-white capitalize">
                    {s.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Secondary + Radar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="p-6">
            <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">Secondary Style</h3>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{secondaryStyle?.icon || STYLE_ICONS[result.secondary_style]}</span>
              <div>
                <h4 className="text-lg font-bold text-white">{secondaryStyle?.name}</h4>
                <p className="text-xs text-gray-400">Your backup learning approach</p>
              </div>
            </div>
            <p className="text-sm text-gray-400">{secondaryStyle?.description?.substring(0, 150)}...</p>
          </Card>

          <Card className="p-6 flex items-center justify-center">
            <RadarChart data={radarData} size={280} color={STYLE_COLORS[result.primary_style]} />
          </Card>
        </div>

        {/* All Scores */}
        <Card className="p-6 mb-8">
          <h3 className="text-sm font-bold text-gray-400 uppercase mb-4">All Style Scores</h3>
          <div className="space-y-3">
            {Object.entries(result.style_scores)
              .filter(([key]) => key in STYLE_ICONS)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(([code, score]) => {
                const style = styles.find(s => s.code === code);
                return (
                  <div key={code} className="flex items-center gap-3">
                    <span className="text-xl w-8">{STYLE_ICONS[code]}</span>
                    <span className="text-sm text-white w-40 truncate">{style?.name?.replace(' Learners', '') || code}</span>
                    <div className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${score}%`, backgroundColor: STYLE_COLORS[code] }}
                      />
                    </div>
                    <span className="text-sm font-bold text-white w-12 text-right">{Math.round(score as number)}%</span>
                  </div>
                );
              })}
          </div>
        </Card>

        {/* Note: style is a preference, not a permanent label */}
        <Card className="p-4 mb-6 bg-blue-900/10 border-blue-500/20">
          <p className="text-xs text-blue-300 leading-relaxed">
            <strong>Note:</strong> Your learning style is a <em>preference</em>, not a permanent label.
            The Pedagogy Engine uses this to set your initial content format, but adapts based on
            how you actually learn — evidence over labels.
          </p>
        </Card>

        {/* Actions */}
        <div className="flex flex-wrap gap-4 justify-center">
          <Link href="/pedagogy" className="px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 text-sm font-medium">
            Open Learning Engine
          </Link>
          <Link href="/my-teams" className="px-6 py-3 bg-gray-800 border border-gray-700 text-white rounded-xl hover:bg-gray-750 text-sm font-medium">
            View My Teams
          </Link>
          <Link href="/lifecycle" className="px-6 py-3 bg-gray-800 border border-gray-700 text-white rounded-xl hover:bg-gray-750 text-sm font-medium">
            My Learning Journey
          </Link>
          <button
            onClick={() => { setPhase('intro'); }}
            className="px-6 py-3 bg-gray-800 border border-gray-700 text-gray-400 rounded-xl hover:text-white text-sm font-medium"
          >
            Take Another Assessment
          </button>
        </div>
      </div>
    );
  }

  return <div className="flex justify-center py-20"><LoadingSpinner /></div>;
}
