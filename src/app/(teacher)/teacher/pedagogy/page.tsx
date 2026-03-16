'use client';

import React, { useState, useEffect } from 'react';
import { useTeacherPedagogy } from '@/hooks/pedagogy-engine';
import { Card, LoadingSpinner, Button } from '@/components/ui/index';

const BAND_COLORS: Record<string, string> = {
  foundation: '#ef4444', emerging: '#f59e0b', developing: '#3b82f6', secure: '#22c55e', advanced: '#8b5cf6',
};

const MODULE_ICONS: Record<string, string> = {
  access_fit: '🎯', diagnostic: '🔍', teach_scaffold: '📚', retrieve_retain: '🧠',
  feedback_repair: '🔧', metacognition: '🪞', mastery_check: '🏆', tiered_support: '🤝',
};

export default function TeacherPedagogyView() {
  const { students, summary, flagged, loading, fetchOverview, fetchFlagged, getStudentDetail, overrideTier, addNotes, resolveReview } = useTeacherPedagogy();
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [studentDetail, setStudentDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tab, setTab] = useState<'overview' | 'flagged' | 'tiers'>('overview');
  const [tierModal, setTierModal] = useState<any>(null);
  const [noteText, setNoteText] = useState('');

  useEffect(() => { fetchOverview(); fetchFlagged(); }, []);

  const openDetail = async (studentState: any) => {
    setSelectedStudent(studentState);
    setDetailLoading(true);
    const detail = await getStudentDetail(studentState.user_id);
    setStudentDetail(detail);
    setDetailLoading(false);
  };

  const handleTierOverride = async () => {
    if (!tierModal) return;
    await overrideTier({
      student_id: tierModal.user_id,
      subject_id: tierModal.subject_id,
      new_tier: tierModal.newTier,
      reason: tierModal.reason,
    });
    setTierModal(null);
    fetchOverview();
  };

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Pedagogy Engine — Teacher View</h1>
          <p className="text-gray-400 text-sm">Monitor student progress, barriers, and tier assignments</p>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {['foundation', 'emerging', 'developing', 'secure', 'advanced'].map(band => (
            <div key={band} className="p-4 rounded-xl border border-gray-700" style={{ backgroundColor: BAND_COLORS[band] + '10' }}>
              <p className="text-2xl font-bold" style={{ color: BAND_COLORS[band] }}>{summary[band]}</p>
              <p className="text-xs text-gray-400 capitalize">{band}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tier + Flagged Summary */}
      {summary && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <Card className="p-4">
            <p className="text-2xl font-bold text-green-400">{summary.tier1}</p>
            <p className="text-xs text-gray-400">Tier 1 (Standard)</p>
          </Card>
          <Card className="p-4">
            <p className="text-2xl font-bold text-yellow-400">{summary.tier2}</p>
            <p className="text-xs text-gray-400">Tier 2 (Targeted)</p>
          </Card>
          <Card className="p-4">
            <p className="text-2xl font-bold text-red-400">{summary.tier3}</p>
            <p className="text-xs text-gray-400">Tier 3 (Intensive)</p>
          </Card>
          <Card className="p-4">
            <p className="text-2xl font-bold text-pink-400">{summary.needs_review}</p>
            <p className="text-xs text-gray-400">Needs Review</p>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['overview', 'flagged', 'tiers'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              tab === t ? 'bg-primary-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {t === 'overview' ? 'All Students' : t === 'flagged' ? `Flagged (${flagged.length})` : 'Tier Management'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student List */}
        <div className="lg:col-span-2">
          {tab === 'overview' && (
            <Card className="p-4">
              <div className="space-y-2">
                {students.map((s: any) => (
                  <StudentRow key={s.id} state={s} onClick={() => openDetail(s)} selected={selectedStudent?.id === s.id} />
                ))}
                {students.length === 0 && <p className="text-gray-500 text-sm text-center py-4">No student data yet</p>}
              </div>
            </Card>
          )}

          {tab === 'flagged' && (
            <Card className="p-4">
              <div className="space-y-2">
                {flagged.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-red-900/10 border border-red-500/20 rounded-lg">
                    <div className="flex items-center gap-3" onClick={() => openDetail(s)} role="button">
                      <span className="text-lg">{s.support_tier === 3 ? '🔴' : '⚠️'}</span>
                      <div>
                        <p className="text-sm text-white">{s.profiles?.full_name || 'Student'}</p>
                        <p className="text-[10px] text-gray-400">
                          Tier {s.support_tier} | {s.current_module} | Stalled: {s.stalled_cycles} | Frustration: {s.frustration_signals}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => resolveReview(s.id, 'Reviewed by teacher')}
                      className="text-xs px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 text-white"
                    >
                      Resolve
                    </button>
                  </div>
                ))}
                {flagged.length === 0 && <p className="text-gray-500 text-sm text-center py-4">No flagged students</p>}
              </div>
            </Card>
          )}

          {tab === 'tiers' && (
            <Card className="p-4">
              <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">Tier Override</h3>
              <p className="text-xs text-gray-500 mb-4">Select a student from the overview tab, then assign a tier override.</p>
              {selectedStudent && (
                <div className="space-y-3">
                  <p className="text-sm text-white">
                    Student: <strong>{selectedStudent.profiles?.full_name || 'Selected'}</strong> — Current Tier: {selectedStudent.support_tier}
                  </p>
                  <div className="flex gap-2">
                    {[1, 2, 3].map(tier => (
                      <button
                        key={tier}
                        onClick={() => setTierModal({ ...selectedStudent, newTier: tier, reason: '' })}
                        className={`px-4 py-2 rounded-lg text-sm ${
                          tier === 1 ? 'bg-green-600/20 text-green-400 border border-green-600/30' :
                          tier === 2 ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30' :
                          'bg-red-600/20 text-red-400 border border-red-600/30'
                        }`}
                      >
                        Set Tier {tier}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Student Detail Panel */}
        <div>
          {selectedStudent && (
            <Card className="p-4">
              <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">Student Detail</h3>
              {detailLoading ? <LoadingSpinner /> : studentDetail ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-white font-bold">{selectedStudent.profiles?.full_name || 'Student'}</p>
                    <p className="text-xs text-gray-400">
                      Band: <span style={{ color: BAND_COLORS[selectedStudent.current_band] }}>{selectedStudent.current_band}</span> |
                      Module: {MODULE_ICONS[selectedStudent.current_module]} {selectedStudent.current_module.replace(/_/g, ' ')}
                    </p>
                  </div>

                  {/* Mastery */}
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Mastery: {selectedStudent.mastery_total?.toFixed(1)}/100</p>
                    <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${selectedStudent.mastery_total || 0}%`,
                          backgroundColor: BAND_COLORS[selectedStudent.current_band],
                        }}
                      />
                    </div>
                  </div>

                  {/* Active Misconceptions */}
                  {studentDetail.misconceptions?.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Active Misconceptions</p>
                      {studentDetail.misconceptions.map((m: any) => (
                        <div key={m.id} className="p-2 bg-red-900/10 rounded text-xs text-red-300 mb-1">
                          {m.misconception_bank?.description || m.misconception_code} (×{m.occurrences})
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Recent Events */}
                  {studentDetail.events?.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Recent Events</p>
                      {studentDetail.events.slice(0, 5).map((e: any) => (
                        <div key={e.id} className="flex items-center gap-2 text-xs text-gray-400 py-1">
                          <span>{MODULE_ICONS[e.module] || '📋'}</span>
                          <span className="flex-1 truncate">{e.trigger_reason}</span>
                          <span className={e.outcome === 'promoted' ? 'text-green-400' : ''}>{e.outcome}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Teacher Notes */}
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Teacher Notes</p>
                    <textarea
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      placeholder="Add notes about this student..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-xs text-white resize-none"
                      rows={3}
                    />
                    <button
                      onClick={async () => { await addNotes(selectedStudent.id, noteText); setNoteText(''); }}
                      className="mt-1 text-xs px-3 py-1 bg-primary-600 text-white rounded hover:bg-primary-700"
                    >
                      Save Notes
                    </button>
                  </div>
                </div>
              ) : null}
            </Card>
          )}
        </div>
      </div>

      {/* Tier Override Modal */}
      {tierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-white mb-4">Assign Tier {tierModal.newTier}</h3>
            <p className="text-sm text-gray-400 mb-3">
              Student: {tierModal.profiles?.full_name || 'Selected'}<br />
              Current Tier: {tierModal.support_tier} → New Tier: {tierModal.newTier}
            </p>
            <textarea
              value={tierModal.reason}
              onChange={e => setTierModal({ ...tierModal, reason: e.target.value })}
              placeholder="Reason for tier change..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-white resize-none mb-4"
              rows={3}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setTierModal(null)} className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm">Cancel</button>
              <button
                onClick={handleTierOverride}
                disabled={!tierModal.reason}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
              >
                Confirm Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StudentRow({ state, onClick, selected }: { state: any; onClick: () => void; selected: boolean }) {
  return (
    <div
      onClick={onClick}
      role="button"
      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
        selected ? 'bg-gray-700 border border-primary-500/40' : 'bg-gray-800 hover:bg-gray-750 border border-transparent'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-lg">{MODULE_ICONS[state.current_module] || '📋'}</span>
        <div>
          <p className="text-sm text-white">{state.profiles?.full_name || 'Student'}</p>
          <p className="text-[10px] text-gray-500">
            {state.current_module.replace(/_/g, ' ')} | Mastery: {state.mastery_total?.toFixed(0) || 0}%
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs px-2 py-0.5 rounded" style={{
          backgroundColor: (BAND_COLORS[state.current_band] || '#6b7280') + '20',
          color: BAND_COLORS[state.current_band] || '#6b7280',
        }}>
          {state.current_band}
        </span>
        <span className={`w-2 h-2 rounded-full ${
          state.support_tier === 1 ? 'bg-green-500' : state.support_tier === 2 ? 'bg-yellow-500' : 'bg-red-500'
        }`} />
      </div>
    </div>
  );
}
