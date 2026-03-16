'use client';

import React, { useState } from 'react';
import { useTeamManagement, useLearningStyles, useEducationLevels } from '@/hooks/learning-teams';
import { Card, LoadingSpinner, Button } from '@/components/ui/index';

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

export default function TeacherTeamsPage() {
  const [levelFilter, setLevelFilter] = useState('class_5');
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [reassignModal, setReassignModal] = useState<{ studentId: string; studentName: string } | null>(null);
  const [newStyle, setNewStyle] = useState('');
  const [reassignNotes, setReassignNotes] = useState('');

  const { styles } = useLearningStyles();
  const { levels } = useEducationLevels();
  const { teams, loading, reassignStudent } = useTeamManagement(levelFilter);

  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const loadMembers = async (teamId: string) => {
    setSelectedTeam(teamId);
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/style-teams?action=team_members&team_id=${teamId}`);
      const data = await res.json();
      setTeamMembers(data.members || []);
    } finally {
      setMembersLoading(false);
    }
  };

  const handleReassign = async () => {
    if (!reassignModal || !newStyle) return;
    await reassignStudent(reassignModal.studentId, newStyle, undefined, reassignNotes);
    setReassignModal(null);
    setNewStyle('');
    setReassignNotes('');
    if (selectedTeam) loadMembers(selectedTeam);
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Learning Style Teams</h1>
        <p className="text-gray-400 text-sm">
          View and manage student learning style team assignments. Each student is placed in a team
          based on their evaluation results — you can override assignments when needed.
        </p>
      </div>

      {/* Level filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {levels.filter(l => l.level_order <= 12).map(level => (
          <button
            key={level.code}
            onClick={() => { setLevelFilter(level.code); setSelectedTeam(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              levelFilter === level.code
                ? 'bg-primary-600 text-white'
                : 'bg-gray-800 text-gray-400 border border-gray-700'
            }`}
          >
            {level.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Teams List */}
          <div className="lg:col-span-1 space-y-3">
            <h2 className="text-sm font-bold text-gray-400 uppercase mb-2">Teams ({teams.length})</h2>
            {teams.length === 0 ? (
              <Card className="p-6 text-center">
                <p className="text-gray-500 text-sm">No teams formed yet for this level.</p>
                <p className="text-gray-600 text-xs mt-1">Teams are created when students complete the Style Discovery assessment.</p>
              </Card>
            ) : (
              teams.map((team: any) => {
                const styleInfo = team.learning_styles_master;
                return (
                  <button
                    key={team.id}
                    onClick={() => loadMembers(team.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      selectedTeam === team.id
                        ? 'border-primary-500 bg-gray-800'
                        : 'border-gray-700 bg-gray-900 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{styleInfo?.icon || STYLE_ICONS[team.style_code]}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-white truncate">{team.team_name}</h3>
                        <p className="text-xs text-gray-500 capitalize">{team.style_code.replace(/_/g, ' ')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-white">{team.member_count}</p>
                        <p className="text-[10px] text-gray-500">students</p>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min((team.member_count / Math.max(...teams.map((t: any) => t.member_count || 1))) * 100, 100)}%`,
                          backgroundColor: STYLE_COLORS[team.style_code] || '#8b5cf6',
                        }}
                      />
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Team Members */}
          <div className="lg:col-span-2">
            {!selectedTeam ? (
              <Card className="p-12 text-center">
                <span className="text-4xl block mb-3">👈</span>
                <p className="text-gray-400">Select a team to see its members</p>
              </Card>
            ) : membersLoading ? (
              <div className="flex justify-center py-12"><LoadingSpinner /></div>
            ) : (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white">Team Members ({teamMembers.length})</h2>
                </div>

                {teamMembers.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-8">No members in this team yet.</p>
                ) : (
                  <div className="space-y-3">
                    {teamMembers.map((member: any) => (
                      <div key={member.id} className="flex items-center gap-3 p-3 bg-gray-800 rounded-xl">
                        <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-lg">
                          {member.profiles?.avatar_url ? (
                            <img src={member.profiles.avatar_url} alt="" className="w-full h-full rounded-full" />
                          ) : (
                            <span>👤</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {member.profiles?.full_name || 'Student'}
                          </p>
                          <p className="text-xs text-gray-500">
                            Strength: {Math.round(member.style_strength || 0)}% |
                            Joined {new Date(member.assigned_at).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={() => setReassignModal({
                            studentId: member.user_id,
                            studentName: member.profiles?.full_name || 'Student',
                          })}
                          className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded-lg text-xs hover:bg-gray-600"
                        >
                          Reassign
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Reassign Modal */}
      {reassignModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <Card className="p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-white mb-4">
              Reassign {reassignModal.studentName}
            </h3>
            <p className="text-sm text-gray-400 mb-4">Select a new learning style team:</p>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {styles.map(style => (
                <button
                  key={style.code}
                  onClick={() => setNewStyle(style.code)}
                  className={`flex items-center gap-2 p-3 rounded-xl text-left transition-all ${
                    newStyle === style.code
                      ? 'bg-primary-600 text-white border-primary-500'
                      : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-500'
                  }`}
                >
                  <span>{style.icon || STYLE_ICONS[style.code]}</span>
                  <span className="text-xs">{style.name.replace(' Learners', '')}</span>
                </button>
              ))}
            </div>

            <textarea
              value={reassignNotes}
              onChange={e => setReassignNotes(e.target.value)}
              placeholder="Notes (optional): Why are you reassigning?"
              className="w-full p-3 bg-gray-900 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 mb-4 resize-none"
              rows={2}
            />

            <div className="flex gap-3">
              <button
                onClick={() => setReassignModal(null)}
                className="flex-1 px-4 py-2 bg-gray-800 text-gray-400 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleReassign}
                disabled={!newStyle}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm disabled:opacity-50"
              >
                Reassign Student
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
