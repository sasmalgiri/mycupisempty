'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTeachingMethods, useMethodEffectiveness } from '@/hooks/upgrade';
import { LearningRoad, RadarChart } from '@/components/ui/upgrade';
import { Card, LoadingSpinner, Button } from '@/components/ui/index';
import Link from 'next/link';
import type { TeachingMethod } from '@/types/upgrade';

const MASTERY_LEVELS = [
  { level: 1, name: 'Discover', description: 'Learn what this method is about', xp: 25, icon: '🔍' },
  { level: 2, name: 'Understand', description: 'Understand the core principles', xp: 50, icon: '💡' },
  { level: 3, name: 'Practice', description: 'Apply it to 3 different topics', xp: 100, icon: '✏️' },
  { level: 4, name: 'Apply', description: 'Use consistently across subjects', xp: 150, icon: '🎯' },
  { level: 5, name: 'Master', description: 'Teach others & combine with other methods', xp: 250, icon: '⭐' },
];

const CATEGORY_INFO = {
  modern: { color: '#3b82f6', label: 'Modern', bg: 'from-blue-600/20 to-blue-800/20', border: 'border-blue-500/30', badge: 'bg-blue-500/20 text-blue-400' },
  ancient: { color: '#f59e0b', label: 'Ancient Wisdom', bg: 'from-amber-600/20 to-amber-800/20', border: 'border-amber-500/30', badge: 'bg-amber-500/20 text-amber-400' },
  scientific: { color: '#22c55e', label: 'Scientific', bg: 'from-green-600/20 to-green-800/20', border: 'border-green-500/30', badge: 'bg-green-500/20 text-green-400' },
};

const VARK_ICONS: Record<string, string> = { visual: '👁️', auditory: '👂', reading: '📖', kinesthetic: '🤲' };
const BLOOM_ICONS: Record<string, string> = { remember: '🧠', understand: '💡', apply: '🔧', analyze: '🔬', evaluate: '⚖️', create: '🎨' };

function getMethodMasteryLevel(usageCount: number, avgRating: number): number {
  if (usageCount >= 10 && avgRating >= 4) return 5;
  if (usageCount >= 7 && avgRating >= 3.5) return 4;
  if (usageCount >= 3) return 3;
  if (usageCount >= 1) return 2;
  return 1;
}

export default function MethodDetailPage() {
  const params = useParams();
  const router = useRouter();
  const methodCode = params.methodCode as string;
  const { methods, loading } = useTeachingMethods();
  const { history: effectiveness } = useMethodEffectiveness();
  const [method, setMethod] = useState<TeachingMethod | null>(null);

  useEffect(() => {
    if (methods.length > 0) {
      const found = methods.find(m => m.code === methodCode);
      setMethod(found || null);
    }
  }, [methods, methodCode]);

  if (loading) {
    return <div className="flex justify-center py-20"><LoadingSpinner /></div>;
  }

  if (!method) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <p className="text-6xl mb-4">🔍</p>
        <h2 className="text-2xl font-bold text-white mb-2">Method Not Found</h2>
        <p className="text-gray-400 mb-6">This method doesn't exist or hasn't been loaded yet.</p>
        <button onClick={() => router.push('/methods')} className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          Back to Methods
        </button>
      </div>
    );
  }

  const catInfo = CATEGORY_INFO[method.category];

  // Calculate mastery from effectiveness data
  const myUsage = effectiveness.filter(e => e.method_code === method.code);
  const usageCount = myUsage.length;
  const avgRating = usageCount > 0 ? myUsage.reduce((sum, e) => sum + e.rating, 0) / usageCount : 0;
  const avgImprovement = usageCount > 0
    ? myUsage.reduce((sum, e) => sum + (e.understanding_after - e.understanding_before), 0) / usageCount
    : 0;
  const currentLevel = getMethodMasteryLevel(usageCount, avgRating);

  // Build road steps
  const roadSteps = MASTERY_LEVELS.map((ml) => ({
    id: `level-${ml.level}`,
    title: `Level ${ml.level}: ${ml.name}`,
    description: ml.description,
    status: ml.level < currentLevel ? 'completed' as const
      : ml.level === currentLevel ? 'in_progress' as const
      : ml.level === currentLevel + 1 ? 'available' as const
      : 'locked' as const,
    xp: ml.xp,
    icon: ml.icon,
  }));

  // Practice suggestions based on level
  const practiceTopics = [
    { level: 1, prompt: `What is the ${method.name}? Explain it to me.` },
    { level: 2, prompt: `Use ${method.name} to explain photosynthesis.` },
    { level: 3, prompt: `Apply ${method.name} to teach me about fractions.` },
    { level: 3, prompt: `Use ${method.name} for understanding the water cycle.` },
    { level: 4, prompt: `Combine ${method.name} with Mind Mapping for history.` },
    { level: 5, prompt: `How can I teach someone else using ${method.name}?` },
  ];

  const relevantPractice = practiceTopics.filter(p => p.level <= currentLevel + 1);

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Back link */}
      <Link href="/methods" className="text-gray-400 hover:text-white text-sm mb-4 inline-flex items-center gap-1">
        ← All Methods
      </Link>

      {/* Method Header */}
      <div className={`p-6 rounded-2xl border bg-gradient-to-br ${catInfo.bg} ${catInfo.border} mb-8`}>
        <div className="flex items-start justify-between">
          <div>
            <span className="text-5xl block mb-3">{method.icon || '📖'}</span>
            <h1 className="text-3xl font-bold text-white mb-1">{method.name}</h1>
            {method.name_hindi && <p className="text-gray-400 text-sm mb-2">{method.name_hindi}</p>}
            <span className={`inline-block text-xs px-3 py-1 rounded-full font-medium ${catInfo.badge}`}>
              {catInfo.label}
            </span>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Mastery Level</p>
            <p className="text-4xl font-bold text-white">{currentLevel}/5</p>
            <p className="text-xs text-gray-400 mt-1">{MASTERY_LEVELS[currentLevel - 1]?.name}</p>
          </div>
        </div>
        <p className="text-gray-300 mt-4 leading-relaxed">{method.description}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Learning Road */}
        <div className="lg:col-span-2 space-y-6">
          {/* Mastery Road */}
          <Card className="p-6">
            <h2 className="text-lg font-bold text-white mb-4">Mastery Road</h2>
            <p className="text-sm text-gray-400 mb-4">
              Progress through 5 levels to master the {method.name}. Use it with AI Guru to level up!
            </p>
            <LearningRoad
              steps={roadSteps}
              onStepClick={(step) => {
                if (step.status !== 'locked') {
                  router.push(`/guru?method=${method.code}`);
                }
              }}
            />
          </Card>

          {/* Steps to Follow */}
          <Card className="p-6">
            <h2 className="text-lg font-bold text-white mb-4">How to Use This Method</h2>
            <div className="space-y-3">
              {method.steps.map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-full bg-primary-600/20 border border-primary-500/30 flex items-center justify-center text-xs text-primary-400 font-bold flex-shrink-0">
                    {i + 1}
                  </span>
                  <p className="text-sm text-gray-300 leading-relaxed pt-0.5">{step}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Practice Prompts */}
          <Card className="p-6">
            <h2 className="text-lg font-bold text-white mb-4">Practice with AI Guru</h2>
            <div className="space-y-2">
              {relevantPractice.map((p, i) => (
                <button
                  key={i}
                  onClick={() => router.push(`/guru?method=${method.code}`)}
                  className="w-full text-left p-3 bg-gray-800 rounded-xl border border-gray-700 hover:border-primary-500 transition-all"
                >
                  <p className="text-sm text-gray-300">{p.prompt}</p>
                  <span className="text-[10px] text-gray-500 mt-1">Level {p.level} practice</span>
                </button>
              ))}
            </div>
            <Link
              href={`/guru?method=${method.code}`}
              className="inline-block mt-4 px-6 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700"
            >
              Open AI Guru with {method.name} →
            </Link>
          </Card>
        </div>

        {/* Right column: Stats & Info */}
        <div className="space-y-6">
          {/* Your Stats */}
          <Card className="p-6">
            <h3 className="text-sm font-bold text-white mb-4">Your Stats</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500">Times Used</p>
                <p className="text-2xl font-bold text-white">{usageCount}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Avg Rating</p>
                <p className="text-2xl font-bold text-white">{avgRating > 0 ? avgRating.toFixed(1) : '—'}<span className="text-sm text-gray-500">/5</span></p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Avg Improvement</p>
                <p className={`text-2xl font-bold ${avgImprovement > 0 ? 'text-green-400' : 'text-gray-400'}`}>
                  {avgImprovement > 0 ? `+${avgImprovement.toFixed(0)}%` : '—'}
                </p>
              </div>
            </div>
          </Card>

          {/* Best For */}
          <Card className="p-6">
            <h3 className="text-sm font-bold text-white mb-3">Best For</h3>

            {/* VARK styles */}
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Learning Styles</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {method.best_for_vark.map(style => (
                <span key={style} className="px-2 py-1 bg-gray-800 rounded-lg text-xs text-white flex items-center gap-1">
                  {VARK_ICONS[style] || '📌'} {style}
                </span>
              ))}
            </div>

            {/* Bloom levels */}
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Cognitive Levels</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {method.best_for_bloom.map(level => (
                <span key={level} className="px-2 py-1 bg-gray-800 rounded-lg text-xs text-white flex items-center gap-1">
                  {BLOOM_ICONS[level] || '📌'} {level}
                </span>
              ))}
            </div>

            {/* Subjects */}
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Subjects</p>
            <div className="flex flex-wrap gap-2">
              {method.best_for_subjects.map(sub => (
                <span key={sub} className="px-2 py-1 bg-gray-800 rounded-lg text-xs text-gray-300 capitalize">
                  {sub === 'all' ? '🌐 All Subjects' : sub.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </Card>

          {/* Related Methods */}
          <Card className="p-6">
            <h3 className="text-sm font-bold text-white mb-3">Combine With</h3>
            <div className="space-y-2">
              {methods
                .filter(m => m.code !== method.code && m.category === method.category)
                .slice(0, 3)
                .map(m => (
                  <Link
                    key={m.code}
                    href={`/methods/${m.code}`}
                    className="flex items-center gap-2 p-2 bg-gray-800 rounded-lg hover:bg-gray-750 transition-all"
                  >
                    <span>{m.icon || '📖'}</span>
                    <div>
                      <p className="text-xs text-white font-medium">{m.name}</p>
                      <p className="text-[10px] text-gray-500">{m.category}</p>
                    </div>
                  </Link>
                ))}
              {methods
                .filter(m => m.code !== method.code && m.category !== method.category)
                .slice(0, 2)
                .map(m => (
                  <Link
                    key={m.code}
                    href={`/methods/${m.code}`}
                    className="flex items-center gap-2 p-2 bg-gray-800 rounded-lg hover:bg-gray-750 transition-all"
                  >
                    <span>{m.icon || '📖'}</span>
                    <div>
                      <p className="text-xs text-white font-medium">{m.name}</p>
                      <p className="text-[10px] text-gray-500">{m.category}</p>
                    </div>
                  </Link>
                ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
