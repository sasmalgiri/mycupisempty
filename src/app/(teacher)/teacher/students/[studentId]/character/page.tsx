'use client';

import React, { useState } from 'react';
import { useCharacterProfile } from '@/hooks/upgrade';
import { CharacterTraitBar, RadarChart } from '@/components/ui/upgrade';
import { Card, Button, Badge, Input, Modal } from '@/components/ui/index';
import type { CharacterTraitCategory } from '@/types/upgrade';

const ALL_TRAITS: { key: CharacterTraitCategory; icon: string; color: string }[] = [
  { key: 'values', icon: '💎', color: '#8b5cf6' },
  { key: 'habits', icon: '🔄', color: '#3b82f6' },
  { key: 'social_skills', icon: '🤝', color: '#10b981' },
  { key: 'emotional_intelligence', icon: '❤️', color: '#ef4444' },
  { key: 'responsibility', icon: '🎯', color: '#f59e0b' },
  { key: 'empathy', icon: '🤗', color: '#ec4899' },
  { key: 'resilience', icon: '💪', color: '#14b8a6' },
  { key: 'teamwork', icon: '👥', color: '#6366f1' },
  { key: 'integrity', icon: '⚖️', color: '#a855f7' },
  { key: 'curiosity', icon: '🔍', color: '#06b6d4' },
];

export default function CharacterPage({ params }: { params: { studentId: string } }) {
  const { traits, goals, loading, updateTrait, setGoal } = useCharacterProfile(params.studentId);
  const [editingTrait, setEditingTrait] = useState<CharacterTraitCategory | null>(null);
  const [editScore, setEditScore] = useState(50);
  const [editObservation, setEditObservation] = useState('');
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [newGoal, setNewGoal] = useState({ trait: '' as string, description: '', target: 80 });

  // Get latest score per trait
  const latestScores: Record<string, number> = {};
  for (const t of traits) {
    if (!latestScores[t.trait_category]) {
      latestScores[t.trait_category] = t.score;
    }
  }

  const radarData = ALL_TRAITS.map(t => ({
    label: t.key.replace(/_/g, ' ').split(' ')[0],
    value: latestScores[t.key] || 0,
  }));

  const overallScore = Object.values(latestScores).length > 0
    ? Math.round(Object.values(latestScores).reduce((a, b) => a + b, 0) / Object.values(latestScores).length)
    : 0;

  const handleSaveTrait = async () => {
    if (!editingTrait) return;
    await updateTrait({
      trait_category: editingTrait,
      score: editScore,
      observations: editObservation || undefined,
    });
    setEditingTrait(null);
    setEditObservation('');
  };

  const handleCreateGoal = async () => {
    if (!newGoal.trait || !newGoal.description) return;
    await setGoal({
      trait_category: newGoal.trait,
      goal_description: newGoal.description,
      target_score: newGoal.target,
    });
    setShowGoalModal(false);
    setNewGoal({ trait: '', description: '', target: 80 });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Character Profile</h1>
          <p className="text-gray-400 text-sm">Track and nurture character development</p>
        </div>
        <Button onClick={() => setShowGoalModal(true)} variant="primary">
          + Set Goal
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Radar Chart */}
        <Card className="p-6 text-center">
          <h3 className="text-lg font-semibold text-white mb-4">Character Radar</h3>
          <RadarChart data={radarData} size={220} color="#8b5cf6" />
          <div className="mt-4">
            <p className="text-sm text-gray-400">Overall Score</p>
            <p className={`text-3xl font-bold ${overallScore >= 70 ? 'text-green-400' : overallScore >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
              {overallScore}/100
            </p>
          </div>
        </Card>

        {/* Trait Bars */}
        <div className="lg:col-span-2">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Character Traits</h3>
            <div className="space-y-4">
              {ALL_TRAITS.map(trait => {
                const targetGoal = goals.find(g => g.trait_category === trait.key && g.status === 'active');
                return (
                  <div key={trait.key} className="group">
                    <CharacterTraitBar
                      trait={trait.key}
                      score={latestScores[trait.key] || 0}
                      targetScore={targetGoal?.target_score}
                      icon={trait.icon}
                      color={trait.color}
                    />
                    <button
                      onClick={() => {
                        setEditingTrait(trait.key);
                        setEditScore(latestScores[trait.key] || 50);
                      }}
                      className="text-[10px] text-primary-400 opacity-0 group-hover:opacity-100 transition-opacity mt-1"
                    >
                      Update assessment
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      {/* Active Goals */}
      {goals.filter(g => g.status === 'active').length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-white mb-4">Active Goals</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {goals.filter(g => g.status === 'active').map(goal => (
              <Card key={goal.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <Badge variant="primary">{goal.trait_category.replace(/_/g, ' ')}</Badge>
                    <p className="text-sm text-white mt-1">{goal.goal_description}</p>
                  </div>
                  <span className="text-xs text-gray-400">Target: {goal.target_score}</span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 rounded-full"
                    style={{ width: `${Math.min(100, (goal.current_score / goal.target_score) * 100)}%` }}
                  />
                </div>
                {goal.due_date && (
                  <p className="text-[10px] text-gray-500 mt-1">Due: {new Date(goal.due_date).toLocaleDateString()}</p>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Edit Trait Modal */}
      {editingTrait && (
        <Modal isOpen={true} onClose={() => setEditingTrait(null)} title={`Assess: ${editingTrait.replace(/_/g, ' ')}`}>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 block mb-2">Score (0-100)</label>
              <input
                type="range" min={0} max={100} value={editScore}
                onChange={(e) => setEditScore(Number(e.target.value))}
                className="w-full accent-primary-500"
              />
              <p className="text-center text-white font-bold">{editScore}</p>
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">Observations (optional)</label>
              <textarea
                value={editObservation}
                onChange={(e) => setEditObservation(e.target.value)}
                className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm resize-none h-20"
                placeholder="Any observations about this trait..."
              />
            </div>
            <Button onClick={handleSaveTrait} variant="primary" className="w-full">
              Save Assessment
            </Button>
          </div>
        </Modal>
      )}

      {/* Goal Modal */}
      {showGoalModal && (
        <Modal isOpen={true} onClose={() => setShowGoalModal(false)} title="Set Character Goal">
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1">Trait</label>
              <select
                value={newGoal.trait}
                onChange={(e) => setNewGoal(prev => ({ ...prev, trait: e.target.value }))}
                className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm"
              >
                <option value="">Select trait...</option>
                {ALL_TRAITS.map(t => (
                  <option key={t.key} value={t.key}>{t.icon} {t.key.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <Input
              label="Goal Description"
              value={newGoal.description}
              onChange={(e: any) => setNewGoal(prev => ({ ...prev, description: e.target.value }))}
              placeholder="e.g., Show more empathy in group activities"
            />
            <div>
              <label className="text-sm text-gray-400 block mb-1">Target Score: {newGoal.target}</label>
              <input
                type="range" min={50} max={100} value={newGoal.target}
                onChange={(e) => setNewGoal(prev => ({ ...prev, target: Number(e.target.value) }))}
                className="w-full accent-primary-500"
              />
            </div>
            <Button onClick={handleCreateGoal} variant="primary" className="w-full">
              Create Goal
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
