'use client';

import React, { useState, useEffect } from 'react';
import { Card, LoadingSpinner } from '@/components/ui/index';

const PILLAR_COLORS: Record<string, string> = {
  cognitive: '#8b5cf6', character: '#22c55e', life_readiness: '#f59e0b',
};

const DIMENSION_ICONS: Record<string, string> = {
  focus: '🎯', memory_habits: '🧠', reasoning: '🔍', problem_solving: '🧩',
  reflection: '🪞', decision_making: '⚖️', self_learning: '📚', curiosity: '🔭',
  discipline: '📏', patience: '⏳', honesty: '💎', empathy: '💗',
  responsibility: '🛡️', consistency: '📈', failure_handling: '🔥', confidence: '💪',
  emotional_regulation: '🧘', social_conduct: '🤝', communication: '🗣️',
  financial_awareness: '💰', digital_safety: '🔒', time_management: '⏰',
  real_world_problem_solving: '🌍', career_awareness: '🧭', teamwork: '👥', practical_skills: '🔧',
};

export default function TeacherDevelopmentView() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackType, setFeedbackType] = useState('observation');

  // Fetch all student profiles
  useEffect(() => {
    const fetchStudents = async () => {
      const res = await fetch('/api/development?action=dimensions'); // just to verify auth
      // For teacher, we need a teacher endpoint — reuse pedagogy teacher pattern
      const studentsRes = await fetch('/api/pedagogy/teacher?action=overview');
      const data = await studentsRes.json();

      // Also fetch development profiles
      // In a real app, we'd have a dedicated teacher development endpoint
      // For now, use the available data
      setStudents(data.states || []);
      setLoading(false);
    };
    fetchStudents();
  }, []);

  const loadStudentDetail = async (studentId: string) => {
    setDetailLoading(true);
    const res = await fetch(`/api/pedagogy/teacher?action=student_detail&student_id=${studentId}`);
    const data = await res.json();
    setDetail(data);
    setDetailLoading(false);
  };

  const sendFeedback = async () => {
    if (!selected || !feedbackText.trim()) return;
    await fetch('/api/development', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'submit_reflection', // Use mentor_feedback table directly in production
        // For now, this is a placeholder — in real impl, teacher has their own feedback endpoint
      }),
    });
    setFeedbackText('');
  };

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Student Development Overview</h1>
        <p className="text-gray-400 text-sm">Monitor whole-student growth across all 4 pillars</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-white">{students.length}</p>
          <p className="text-xs text-gray-400">Total Students</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-purple-400">
            {students.filter((s: any) => s.support_tier === 1).length}
          </p>
          <p className="text-xs text-gray-400">On Track</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-yellow-400">
            {students.filter((s: any) => s.support_tier === 2).length}
          </p>
          <p className="text-xs text-gray-400">Need Support</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-red-400">
            {students.filter((s: any) => s.needs_human_review).length}
          </p>
          <p className="text-xs text-gray-400">Need Review</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student List */}
        <div className="lg:col-span-2">
          <Card className="p-4">
            <h2 className="text-sm font-bold text-gray-400 uppercase mb-3">Students</h2>
            <div className="space-y-2">
              {students.map((s: any) => (
                <div
                  key={s.id}
                  onClick={() => { setSelected(s); loadStudentDetail(s.user_id); }}
                  role="button"
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                    selected?.id === s.id ? 'bg-gray-700 border border-primary-500/40' : 'bg-gray-800 hover:bg-gray-750 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm text-white">
                      {(s.profiles?.full_name || 'S')[0]}
                    </div>
                    <div>
                      <p className="text-sm text-white">{s.profiles?.full_name || 'Student'}</p>
                      <p className="text-[10px] text-gray-500">
                        Mastery: {s.mastery_total?.toFixed(0) || 0}% |
                        Module: {s.current_module?.replace(/_/g, ' ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      s.support_tier === 1 ? 'bg-green-500' : s.support_tier === 2 ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                    {s.needs_human_review && <span className="text-xs text-red-400">⚠️</span>}
                  </div>
                </div>
              ))}
              {students.length === 0 && <p className="text-gray-500 text-sm text-center py-4">No student data yet</p>}
            </div>
          </Card>
        </div>

        {/* Detail Panel */}
        <div>
          {selected && (
            <Card className="p-4">
              <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">
                {selected.profiles?.full_name || 'Student'} — Detail
              </h3>

              {detailLoading ? <LoadingSpinner /> : detail ? (
                <div className="space-y-4">
                  {/* Academic Status */}
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Academic Mastery</p>
                    <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${selected.mastery_total || 0}%` }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{selected.current_band} band | Tier {selected.support_tier}</p>
                  </div>

                  {/* Misconceptions */}
                  {detail.misconceptions?.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Active Misconceptions</p>
                      {detail.misconceptions.slice(0, 3).map((m: any) => (
                        <p key={m.id} className="text-xs text-red-300 bg-red-900/10 p-1.5 rounded mb-1">
                          {m.misconception_bank?.description || m.misconception_code}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Recent Events */}
                  {detail.events?.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Recent Activity</p>
                      {detail.events.slice(0, 5).map((e: any) => (
                        <div key={e.id} className="text-xs text-gray-400 py-1 border-b border-gray-800">
                          {e.module?.replace(/_/g, ' ')} — {e.outcome || 'in progress'}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Quick Feedback */}
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Send Feedback</p>
                    <select
                      value={feedbackType}
                      onChange={e => setFeedbackType(e.target.value)}
                      aria-label="Feedback type"
                      className="w-full bg-gray-800 border border-gray-700 rounded p-1.5 text-xs text-white mb-2"
                    >
                      <option value="observation">Observation</option>
                      <option value="encouragement">Encouragement</option>
                      <option value="concern">Concern</option>
                      <option value="suggestion">Suggestion</option>
                      <option value="milestone">Milestone</option>
                    </select>
                    <textarea
                      value={feedbackText}
                      onChange={e => setFeedbackText(e.target.value)}
                      placeholder="Write feedback..."
                      className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-xs text-white resize-none"
                      rows={3}
                    />
                    <button
                      onClick={sendFeedback}
                      disabled={!feedbackText.trim()}
                      className="mt-1 text-xs px-3 py-1 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
                    >
                      Send
                    </button>
                  </div>
                </div>
              ) : null}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
