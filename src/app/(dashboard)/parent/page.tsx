'use client';

import React, { useState, useEffect } from 'react';
import { useParentDashboard } from '@/hooks/student-development';
import { Card, LoadingSpinner, Button } from '@/components/ui/index';

const PILLAR_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  cognitive: { label: 'Thinking', icon: '🧠', color: '#8b5cf6' },
  character: { label: 'Character', icon: '🌱', color: '#22c55e' },
  life_readiness: { label: 'Life Skills', icon: '🌍', color: '#f59e0b' },
};

export default function ParentDashboard() {
  const { children, loading, getChildOverview, giveFeedback, setGoalForChild } = useParentDashboard();
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [childData, setChildData] = useState<any>(null);
  const [childLoading, setChildLoading] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState<any>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [goalModal, setGoalModal] = useState(false);
  const [goalForm, setGoalForm] = useState({ pillar: 'character', title: '', description: '', due_date: '' });

  const loadChild = async (studentId: string) => {
    setSelectedChild(studentId);
    setChildLoading(true);
    const data = await getChildOverview(studentId);
    setChildData(data);
    setChildLoading(false);
  };

  useEffect(() => {
    if (children.length > 0 && !selectedChild) {
      loadChild(children[0].student_id);
    }
  }, [children]);

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>;

  if (children.length === 0) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Card className="p-8 text-center">
          <span className="text-5xl block mb-4">👨‍👩‍👧</span>
          <h1 className="text-2xl font-bold text-white mb-2">Parent Dashboard</h1>
          <p className="text-gray-400 mb-4">Link your child's account to view their development progress.</p>
          <p className="text-xs text-gray-500">Ask your child's teacher for the link code.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Parent Dashboard</h1>
          <p className="text-gray-400 text-sm">Your child's whole development at a glance</p>
        </div>
        {children.length > 1 && (
          <select
            value={selectedChild || ''}
            onChange={e => loadChild(e.target.value)}
            aria-label="Select child"
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
          >
            {children.map((c: any) => (
              <option key={c.student_id} value={c.student_id}>
                {c.profiles?.full_name || 'Child'}
              </option>
            ))}
          </select>
        )}
      </div>

      {childLoading ? <LoadingSpinner /> : childData ? (
        <div className="space-y-6">
          {/* Pillar Scores */}
          {childData.profile && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(PILLAR_CONFIG).map(([key, config]) => {
                const score = key === 'cognitive' ? childData.profile.cognitive_composite :
                              key === 'character' ? childData.profile.character_composite :
                              childData.profile.life_readiness_composite;

                return score !== null ? (
                  <div key={key} className="p-5 rounded-xl border border-gray-700" style={{ borderColor: config.color + '40' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">{config.icon}</span>
                      <span className="text-sm font-bold text-white">{config.label}</span>
                    </div>
                    <p className="text-3xl font-bold mb-2" style={{ color: config.color }}>{Math.round(score)}/100</p>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: config.color }} />
                    </div>
                  </div>
                ) : null;
              })}
            </div>
          )}

          {/* Concerns */}
          {childData.concerns?.length > 0 && (
            <Card className="p-6 border-yellow-500/20">
              <h2 className="text-lg font-bold text-yellow-400 mb-4">Areas to Watch</h2>
              {childData.concerns.map((c: any, i: number) => (
                <div key={i} className={`p-3 rounded-lg mb-2 ${c.severity === 'urgent' ? 'bg-red-900/20' : 'bg-yellow-900/10'}`}>
                  <p className="text-sm text-gray-200">{c.message}</p>
                  <p className="text-[10px] text-gray-500 capitalize mt-1">Severity: {c.severity}</p>
                </div>
              ))}
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Habit Streaks */}
            <Card className="p-6">
              <h2 className="text-lg font-bold text-white mb-4">Habit Streaks</h2>
              {childData.habits?.length > 0 ? (
                <div className="space-y-2">
                  {childData.habits.map((h: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span>{h.icon || '📋'}</span>
                        <span className="text-sm text-white">{h.name}</span>
                      </div>
                      <span className="text-sm font-bold text-orange-400">
                        {h.streak > 0 ? `🔥 ${h.streak}d` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-gray-500 text-sm">No habits tracked yet</p>}
            </Card>

            {/* Goals */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Goals</h2>
                <button onClick={() => setGoalModal(true)} className="text-xs px-3 py-1 bg-primary-600 text-white rounded hover:bg-primary-700">
                  Set Goal
                </button>
              </div>
              {childData.goals?.length > 0 ? (
                <div className="space-y-2">
                  {childData.goals.map((g: any) => (
                    <div key={g.id} className="p-3 bg-gray-800 rounded-lg">
                      <p className="text-sm text-white">{g.title}</p>
                      <p className="text-[10px] text-gray-500">
                        {g.set_by === 'parent' ? 'Set by you' : `Set by ${g.set_by}`}
                        {g.due_date && ` — Due: ${new Date(g.due_date).toLocaleDateString()}`}
                      </p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-gray-500 text-sm">No active goals</p>}
            </Card>

            {/* Badges */}
            <Card className="p-6">
              <h2 className="text-lg font-bold text-white mb-4">Badges Earned</h2>
              {childData.badges?.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {childData.badges.map((b: any) => (
                    <div key={b.id} className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg">
                      <span className="text-xl">{b.development_badges?.icon || '🏅'}</span>
                      <div>
                        <p className="text-xs text-white">{b.development_badges?.name}</p>
                        <p className="text-[10px] text-gray-500">{new Date(b.earned_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-gray-500 text-sm">No badges yet — they'll come with consistent effort!</p>}
            </Card>

            {/* Give Feedback */}
            <Card className="p-6">
              <h2 className="text-lg font-bold text-white mb-4">Send Encouragement</h2>
              <div className="space-y-2">
                {[
                  { type: 'encouragement', icon: '💪', label: 'Encouragement', placeholder: 'I\'m proud of you for...' },
                  { type: 'observation', icon: '👀', label: 'Observation', placeholder: 'I noticed that you...' },
                  { type: 'suggestion', icon: '💡', label: 'Suggestion', placeholder: 'You might try...' },
                ].map(fb => (
                  <button key={fb.type} onClick={() => setFeedbackModal(fb)} className="w-full flex items-center gap-3 p-3 bg-gray-800 rounded-lg hover:bg-gray-750 text-left">
                    <span className="text-lg">{fb.icon}</span>
                    <span className="text-sm text-white">{fb.label}</span>
                  </button>
                ))}
              </div>
            </Card>
          </div>

          {/* Domain Affinities */}
          {childData.domain_affinities?.length > 0 && (
            <Card className="p-6">
              <h2 className="text-lg font-bold text-white mb-4">Natural Strengths & Directions</h2>
              <p className="text-xs text-gray-400 mb-4">Based on your child's development profile, these are the domains they naturally align with:</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {childData.domain_affinities.slice(0, 4).map((da: any) => (
                  <div key={da.code} className="p-3 bg-gray-800 rounded-lg text-center">
                    <p className="text-2xl font-bold text-primary-400">{da.affinity}%</p>
                    <p className="text-xs text-white mt-1">{da.label}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      ) : null}

      {/* Feedback Modal */}
      {feedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-white mb-2">{feedbackModal.icon} {feedbackModal.label}</h3>
            <textarea
              value={feedbackText}
              onChange={e => setFeedbackText(e.target.value)}
              placeholder={feedbackModal.placeholder}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-white resize-none mb-4"
              rows={4}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setFeedbackModal(null); setFeedbackText(''); }} className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm">Cancel</button>
              <button
                onClick={async () => {
                  await giveFeedback({ student_id: selectedChild!, feedback_type: feedbackModal.type, message: feedbackText });
                  setFeedbackModal(null);
                  setFeedbackText('');
                }}
                disabled={!feedbackText.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Goal Modal */}
      {goalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-white mb-4">Set a Goal</h3>
            <select
              value={goalForm.pillar}
              onChange={e => setGoalForm({ ...goalForm, pillar: e.target.value })}
              aria-label="Goal pillar"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm text-white mb-3"
            >
              <option value="character">Character & Growth</option>
              <option value="cognitive">Thinking & Learning</option>
              <option value="life_readiness">Life Skills</option>
              <option value="academic">Academic</option>
            </select>
            <input
              value={goalForm.title}
              onChange={e => setGoalForm({ ...goalForm, title: e.target.value })}
              placeholder="Goal title (e.g., Read 20 mins daily)"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm text-white mb-3"
            />
            <textarea
              value={goalForm.description}
              onChange={e => setGoalForm({ ...goalForm, description: e.target.value })}
              placeholder="Why this goal? (optional)"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm text-white resize-none mb-3"
              rows={2}
            />
            <input
              type="date"
              value={goalForm.due_date}
              onChange={e => setGoalForm({ ...goalForm, due_date: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm text-white mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setGoalModal(false)} className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm">Cancel</button>
              <button
                onClick={async () => {
                  await setGoalForChild({ student_id: selectedChild!, ...goalForm });
                  setGoalModal(false);
                  setGoalForm({ pillar: 'character', title: '', description: '', due_date: '' });
                  loadChild(selectedChild!);
                }}
                disabled={!goalForm.title.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
              >
                Set Goal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
