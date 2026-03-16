'use client';

import React from 'react';
import { useMyTeams, useLearningStyles, useStyleHistory } from '@/hooks/learning-teams';
import { RadarChart } from '@/components/ui/upgrade';
import { Card, LoadingSpinner } from '@/components/ui/index';
import Link from 'next/link';

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

export default function MyTeamsPage() {
  const { memberships, loading } = useMyTeams();
  const { styles } = useLearningStyles();
  const { transitions } = useStyleHistory();

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>;

  // Group by general vs subject-specific
  const generalTeam = memberships.find(m => !m.subject_id);
  const subjectTeams = memberships.filter(m => m.subject_id);

  // Build style distribution for radar
  const styleDistribution = styles.map(s => {
    const count = memberships.filter(m => m.style_code === s.code).length;
    return { label: (s.name || s.code).replace(' Learners', '').substring(0, 10), value: count > 0 ? 100 : 0 };
  });

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">My Learning Style Teams</h1>
          <p className="text-gray-400 text-sm">Your learning style assignment for each subject. Different subjects may suit different styles!</p>
        </div>
        <Link href="/style-discovery" className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700">
          Retake Assessment
        </Link>
      </div>

      {memberships.length === 0 ? (
        <Card className="p-12 text-center">
          <span className="text-6xl block mb-4">🧬</span>
          <h2 className="text-xl font-bold text-white mb-2">No Team Assigned Yet</h2>
          <p className="text-gray-400 mb-6">Take the Learning Style Discovery assessment to find your team!</p>
          <Link href="/style-discovery" className="px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700">
            Start Assessment
          </Link>
        </Card>
      ) : (
        <>
          {/* General Learning Style */}
          {generalTeam && (
            <div className="p-6 mb-6 border-2 rounded-xl bg-gray-900" style={{ borderColor: STYLE_COLORS[generalTeam.style_code] || '#8b5cf6' }}>
              <div className="flex items-center gap-4">
                <span className="text-5xl">{STYLE_ICONS[generalTeam.style_code] || '📌'}</span>
                <div className="flex-1">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Your Primary Learning Style (General)</p>
                  <h2 className="text-2xl font-bold text-white">
                    {(generalTeam as any).learning_styles_master?.name || generalTeam.style_code}
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">
                    Strength: {Math.round(generalTeam.style_strength || 0)}% confidence
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Team</p>
                  <p className="text-sm font-medium text-white">{(generalTeam as any).learning_style_teams?.team_name}</p>
                </div>
              </div>

              {(generalTeam as any).learning_styles_master?.teaching_strategies && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <p className="text-xs text-gray-500 mb-2">Recommended Learning Strategies</p>
                  <div className="flex flex-wrap gap-2">
                    {((generalTeam as any).learning_styles_master.teaching_strategies as string[]).slice(0, 6).map((s: string, i: number) => (
                      <span key={i} className="px-3 py-1 bg-gray-800 rounded-lg text-xs text-white capitalize">{s.replace(/_/g, ' ')}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Subject-Specific Teams */}
          {subjectTeams.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-bold text-white mb-4">Subject-Specific Styles</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {subjectTeams.map(tm => (
                  <div key={tm.id} className="p-4 border-l-4 rounded-xl bg-gray-900 border border-gray-700" style={{ borderLeftColor: STYLE_COLORS[tm.style_code] || '#666' }}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{STYLE_ICONS[tm.style_code]}</span>
                      <div>
                        <p className="text-xs text-gray-500">{tm.subject_name || 'Subject'}</p>
                        <h3 className="text-sm font-bold text-white">
                          {(tm as any).learning_styles_master?.name?.replace(' Learners', '') || tm.style_code}
                        </h3>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${tm.style_strength || 0}%`, backgroundColor: STYLE_COLORS[tm.style_code] }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">{Math.round(tm.style_strength || 0)}% strength</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Style Transition History */}
          {transitions.length > 0 && (
            <Card className="p-6">
              <h2 className="text-lg font-bold text-white mb-4">Style Journey</h2>
              <div className="space-y-3">
                {transitions.slice(0, 10).map(t => (
                  <div key={t.id} className="flex items-center gap-3 text-sm">
                    <span className="text-gray-500 text-xs w-24">
                      {new Date(t.transitioned_at).toLocaleDateString()}
                    </span>
                    {t.from_style && (
                      <>
                        <span>{STYLE_ICONS[t.from_style] || '?'}</span>
                        <span className="text-gray-500">→</span>
                      </>
                    )}
                    <span>{STYLE_ICONS[t.to_style]}</span>
                    <span className="text-white capitalize">{t.to_style.replace(/_/g, ' ')}</span>
                    <span className="text-xs px-2 py-0.5 bg-gray-800 rounded text-gray-400 capitalize">{t.reason.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
