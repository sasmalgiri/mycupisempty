'use client';

import { useState, useEffect, useCallback } from 'react';

interface Goal {
  id: string;
  pillar: string;
  dimension_code: string | null;
  domain: string | null;
  title: string;
  description: string | null;
  target_value: number | null;
  current_value: number;
  status: string;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
  set_by: string;
  created_at: string;
}

const PILLARS = [
  { key: 'academic', label: 'Academic', icon: '📚', color: 'blue' },
  { key: 'cognitive', label: 'Cognitive', icon: '🧠', color: 'indigo' },
  { key: 'character', label: 'Character', icon: '💎', color: 'purple' },
  { key: 'life_readiness', label: 'Life Skills', icon: '🌍', color: 'green' },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  paused: { label: 'Paused', color: 'bg-yellow-100 text-yellow-700' },
  abandoned: { label: 'Abandoned', color: 'bg-gray-100 text-gray-500' },
};

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  high: { label: 'High', color: 'text-red-600' },
  medium: { label: 'Medium', color: 'text-yellow-600' },
  low: { label: 'Low', color: 'text-gray-500' },
};

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('active');
  const [showCreate, setShowCreate] = useState(false);
  const [newGoal, setNewGoal] = useState({
    pillar: 'academic',
    title: '',
    description: '',
    target_value: '',
    due_date: '',
    priority: 'medium',
  });
  const [creating, setCreating] = useState(false);

  const loadGoals = useCallback(async () => {
    try {
      const res = await fetch(`/api/development?action=goals&status=${statusFilter}`);
      if (res.ok) {
        const data = await res.json();
        setGoals(data.goals || []);
      }
    } catch (err) {
      console.error('Failed to load goals:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { loadGoals(); }, [loadGoals]);

  const createGoal = async () => {
    if (!newGoal.title.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/development', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_goal',
          pillar: newGoal.pillar,
          title: newGoal.title.trim(),
          description: newGoal.description.trim() || undefined,
          target_value: newGoal.target_value ? parseFloat(newGoal.target_value) : undefined,
          due_date: newGoal.due_date || undefined,
          priority: newGoal.priority,
        }),
      });

      if (res.ok) {
        setShowCreate(false);
        setNewGoal({ pillar: 'academic', title: '', description: '', target_value: '', due_date: '', priority: 'medium' });
        loadGoals();
      }
    } catch (err) {
      console.error('Failed to create goal:', err);
    } finally {
      setCreating(false);
    }
  };

  const updateGoal = async (goalId: string, updates: Partial<{ status: string; current_value: number }>) => {
    try {
      const res = await fetch('/api/development', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_goal', goal_id: goalId, ...updates }),
      });
      if (res.ok) loadGoals();
    } catch (err) {
      console.error('Failed to update goal:', err);
    }
  };

  const activeGoals = goals.filter(g => g.status === 'active');
  const completedGoals = goals.filter(g => g.status === 'completed');

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Goals</h1>
          <p className="text-gray-500 mt-1">Set meaningful goals across all areas of growth</p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)} className="btn-primary px-4 py-2 text-sm">
          + New Goal
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {PILLARS.map(p => {
          const count = goals.filter(g => g.pillar === p.key && g.status === 'active').length;
          return (
            <div key={p.key} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
              <span className="text-2xl">{p.icon}</span>
              <p className="text-lg font-bold text-gray-900 mt-1">{count}</p>
              <p className="text-xs text-gray-500">{p.label}</p>
            </div>
          );
        })}
      </div>

      {/* Status Filter */}
      <div className="flex gap-2">
        {['active', 'completed', 'paused', 'abandoned'].map(status => (
          <button
            key={status}
            type="button"
            onClick={() => { setStatusFilter(status); setLoading(true); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize ${
              statusFilter === status
                ? 'bg-primary-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Goals List */}
      {goals.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <p className="text-4xl mb-4">🎯</p>
          <p className="text-gray-500 font-medium">
            No {statusFilter} goals
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {statusFilter === 'active' ? 'Set your first goal to start tracking your growth' : 'Goals will appear here when their status changes'}
          </p>
          {statusFilter === 'active' && (
            <button type="button" onClick={() => setShowCreate(true)} className="btn-primary px-6 py-2 mt-4 text-sm">
              Create Your First Goal
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map(goal => {
            const pillar = PILLARS.find(p => p.key === goal.pillar);
            const statusInfo = STATUS_LABELS[goal.status] || STATUS_LABELS.active;
            const priorityInfo = PRIORITY_LABELS[goal.priority] || PRIORITY_LABELS.medium;
            const progress = goal.target_value ? Math.min(100, Math.round((goal.current_value / goal.target_value) * 100)) : null;
            const overdue = goal.status === 'active' && isOverdue(goal.due_date);

            return (
              <div key={goal.id} className={`bg-white rounded-2xl shadow-sm border p-5 ${overdue ? 'border-red-200' : 'border-gray-100'}`}>
                <div className="flex items-start gap-4">
                  <span className="text-2xl mt-0.5">{pillar?.icon || '🎯'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{goal.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                      <span className={`text-xs font-medium ${priorityInfo.color}`}>
                        {priorityInfo.label}
                      </span>
                      {goal.set_by !== 'student' && (
                        <span className="text-xs px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full">
                          Set by {goal.set_by}
                        </span>
                      )}
                    </div>
                    {goal.description && (
                      <p className="text-sm text-gray-500 mt-1">{goal.description}</p>
                    )}

                    {/* Progress Bar */}
                    {progress !== null && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>Progress</span>
                          <span>{goal.current_value}/{goal.target_value}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-primary-500 to-secondary-500 h-2 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3 mt-3 flex-wrap">
                      <span className="text-xs text-gray-400">{pillar?.label}</span>
                      {goal.due_date && (
                        <span className={`text-xs ${overdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                          {overdue ? 'Overdue: ' : 'Due: '}{formatDate(goal.due_date)}
                        </span>
                      )}

                      {goal.status === 'active' && (
                        <div className="flex gap-2 ml-auto">
                          {goal.target_value && (
                            <button
                              type="button"
                              onClick={() => updateGoal(goal.id, { current_value: Math.min(goal.current_value + 1, goal.target_value!) })}
                              className="text-xs px-3 py-1 bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100"
                            >
                              +1 Progress
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => updateGoal(goal.id, { status: 'completed' })}
                            className="text-xs px-3 py-1 bg-green-50 text-green-600 rounded-lg hover:bg-green-100"
                          >
                            Complete
                          </button>
                          <button
                            type="button"
                            onClick={() => updateGoal(goal.id, { status: 'paused' })}
                            className="text-xs px-3 py-1 bg-yellow-50 text-yellow-600 rounded-lg hover:bg-yellow-100"
                          >
                            Pause
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Goal Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Set a New Goal</h2>
              <button type="button" onClick={() => setShowCreate(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Pillar Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Growth Area</label>
                <div className="grid grid-cols-2 gap-2">
                  {PILLARS.map(p => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setNewGoal({ ...newGoal, pillar: p.key })}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        newGoal.pillar === p.key
                          ? 'border-primary-400 bg-primary-50 ring-2 ring-primary-200'
                          : 'border-gray-100 hover:border-primary-200'
                      }`}
                    >
                      <span className="text-xl">{p.icon}</span>
                      <p className="text-sm font-medium mt-1">{p.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label htmlFor="goal-title" className="block text-sm font-medium text-gray-700 mb-1">Goal</label>
                <input
                  id="goal-title"
                  type="text"
                  value={newGoal.title}
                  onChange={e => setNewGoal({ ...newGoal, title: e.target.value })}
                  placeholder="e.g., Complete all Science chapters, Read 1 book per week"
                  className="input-field"
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="goal-desc" className="block text-sm font-medium text-gray-700 mb-1">Details (optional)</label>
                <textarea
                  id="goal-desc"
                  value={newGoal.description}
                  onChange={e => setNewGoal({ ...newGoal, description: e.target.value })}
                  placeholder="Why is this goal important to you?"
                  className="input-field resize-none"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Target */}
                <div>
                  <label htmlFor="goal-target" className="block text-sm font-medium text-gray-700 mb-1">Target (optional)</label>
                  <input
                    id="goal-target"
                    type="number"
                    value={newGoal.target_value}
                    onChange={e => setNewGoal({ ...newGoal, target_value: e.target.value })}
                    placeholder="e.g., 10"
                    className="input-field"
                    min="1"
                  />
                </div>

                {/* Due Date */}
                <div>
                  <label htmlFor="goal-due" className="block text-sm font-medium text-gray-700 mb-1">Due Date (optional)</label>
                  <input
                    id="goal-due"
                    type="date"
                    value={newGoal.due_date}
                    onChange={e => setNewGoal({ ...newGoal, due_date: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                <div className="flex gap-2">
                  {['low', 'medium', 'high'].map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewGoal({ ...newGoal, priority: p })}
                      className={`flex-1 py-2 rounded-xl border text-sm font-medium capitalize transition-all ${
                        newGoal.priority === p
                          ? 'border-primary-400 bg-primary-50 text-primary-700'
                          : 'border-gray-200 text-gray-600 hover:border-primary-200'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={createGoal}
                disabled={!newGoal.title.trim() || creating}
                className="w-full btn-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating...' : 'Create Goal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
