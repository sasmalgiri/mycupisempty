'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMyTeams, useLearningStyles } from '@/hooks/learning-teams';
import { LearningRoad, BuddyBubble } from '@/components/ui/upgrade';
import { Card, LoadingSpinner, Button } from '@/components/ui/index';
import Link from 'next/link';
import { STYLE_METHOD_MAP, STYLE_CONTENT_FORMATS } from '@/lib/style-evaluation-engine';
import type { LearningStyleCode } from '@/types/learning-teams';

const STYLE_ICONS: Record<string, string> = {
  visual_spatial: '👁️', auditory_musical: '👂', reading_writing: '📖',
  kinesthetic_tactile: '🤲', logical_mathematical: '🧮', social_interpersonal: '🤝',
  solitary_intrapersonal: '🧘', naturalistic: '🌿',
};

const FORMAT_ICONS: Record<string, string> = {
  video: '🎬', diagram: '📊', infographic: '📈', animation: '🎞️', mind_map: '🧠',
  audio: '🎧', podcast: '🎙️', lecture: '🗣️', discussion: '💬', song: '🎵',
  text: '📝', article: '📰', notes: '📋', essay: '✍️', glossary: '📖',
  interactive: '🎮', hands_on: '🤲', experiment: '🧪', simulation: '🖥️', game: '🎯',
  problem_set: '📐', proof: '📏', flowchart: '🔄', data: '📊', coding: '💻',
  group_activity: '👥', debate: '🗣️', peer_review: '🤝', presentation: '📽️',
  self_paced: '⏰', journal: '📓', reflection: '🪞', solo_project: '🎨', meditation: '🧘',
  field_trip: '🚌', observation: '🔭', real_world: '🌍', nature_study: '🌿', outdoor: '☀️',
};

const METHOD_NAMES: Record<string, string> = {
  mind_map: 'Mind Mapping', dual_coding: 'Dual Coding', visualization: 'Visualization',
  memory_palace: 'Memory Palace', storytelling: 'Storytelling', socratic: 'Socratic Dialogue',
  gurukul: 'Gurukul Method', teach_back: 'Teach-Back', cornell_notes: 'Cornell Notes',
  pq4r: 'PQ4R Method', sutra_learning: 'Sutra Learning', elaborative_interrogation: 'Why/How Method',
  project_based: 'Project-Based', feynman: 'Feynman Technique', active_recall: 'Active Recall',
  chunking: 'Chunking', vedic_math: 'Vedic Math', interleaving: 'Interleaving',
  analogy: 'Analogy-Based', pomodoro: 'Pomodoro', spaced_rep: 'Spaced Repetition',
};

export default function StyleLearnPageWrapper() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><LoadingSpinner /></div>}>
      <StyleLearnPage />
    </Suspense>
  );
}

function StyleLearnPage() {
  const searchParams = useSearchParams();
  const subjectId = searchParams.get('subject_id');
  const subjectName = searchParams.get('subject') || 'Subject';

  const { memberships, loading: teamsLoading } = useMyTeams();
  const { styles } = useLearningStyles();
  const [curriculum, setCurriculum] = useState<any[]>([]);
  const [currLoading, setCurrLoading] = useState(false);

  // Get style for this subject (or general)
  const subjectTeam = memberships.find(m => m.subject_id === subjectId);
  const generalTeam = memberships.find(m => !m.subject_id);
  const myStyleCode = (subjectTeam?.style_code || generalTeam?.style_code || 'visual_spatial') as LearningStyleCode;
  const myStyle = styles.find(s => s.code === myStyleCode);

  // Load style-mapped curriculum
  useEffect(() => {
    if (!subjectId || !myStyleCode) return;
    setCurrLoading(true);
    fetch(`/api/lifecycle?action=curriculum_for_style&subject_id=${subjectId}&style_code=${myStyleCode}`)
      .then(r => r.json())
      .then(d => setCurriculum(d.curriculum || []))
      .catch(() => {})
      .finally(() => setCurrLoading(false));
  }, [subjectId, myStyleCode]);

  const recommendedMethods = STYLE_METHOD_MAP[myStyleCode] || [];
  const recommendedFormats = STYLE_CONTENT_FORMATS[myStyleCode] || [];

  if (teamsLoading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/subjects" className="text-gray-400 hover:text-white text-xs mb-1 block">← Back to Subjects</Link>
          <h1 className="text-2xl font-bold text-white">Learn {subjectName}</h1>
          <p className="text-gray-400 text-sm">Content optimized for your learning style</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-xl border border-gray-700">
          <span className="text-2xl">{STYLE_ICONS[myStyleCode]}</span>
          <div>
            <p className="text-[10px] text-gray-500">Your Style for {subjectName}</p>
            <p className="text-sm font-medium text-white">{myStyle?.name?.replace(' Learners', '') || myStyleCode}</p>
          </div>
        </div>
      </div>

      {/* Buddy tip */}
      <BuddyBubble
        message={`As a ${myStyle?.name?.replace(' Learners', '') || myStyleCode} learner, I'll focus on ${recommendedFormats.slice(0, 3).join(', ')} to help you understand ${subjectName}. Let's go!`}
        mood="encouraging"
        className="mb-6"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main: How to study this subject */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recommended Methods */}
          <Card className="p-6">
            <h2 className="text-lg font-bold text-white mb-4">Your Recommended Methods</h2>
            <p className="text-xs text-gray-400 mb-4">
              Based on your {myStyle?.name || 'learning style'}, these teaching methods work best for you:
            </p>
            <div className="grid grid-cols-2 gap-3">
              {recommendedMethods.map(method => (
                <Link
                  key={method}
                  href={`/guru?method=${method}`}
                  className="flex items-center gap-3 p-3 bg-gray-800 rounded-xl border border-gray-700 hover:border-primary-500 transition-all"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary-600/20 flex items-center justify-center text-lg">
                    {METHOD_NAMES[method]?.[0] || '📖'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{METHOD_NAMES[method] || method}</p>
                    <p className="text-[10px] text-gray-500">Try with AI Guru →</p>
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          {/* Content Formats */}
          <Card className="p-6">
            <h2 className="text-lg font-bold text-white mb-4">Best Content Formats For You</h2>
            <div className="flex flex-wrap gap-3">
              {recommendedFormats.map(format => (
                <div key={format} className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-xl border border-gray-700">
                  <span className="text-xl">{FORMAT_ICONS[format] || '📌'}</span>
                  <span className="text-sm text-white capitalize">{format.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Style-mapped curriculum (if available) */}
          {curriculum.length > 0 && (
            <Card className="p-6">
              <h2 className="text-lg font-bold text-white mb-4">Style-Optimized Chapters</h2>
              <div className="space-y-3">
                {curriculum.map((item: any, i: number) => (
                  <div key={item.id || i} className="p-4 bg-gray-800 rounded-xl border border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-white">
                        {item.chapter_name || `Chapter ${i + 1}`}
                      </h3>
                      <div className="flex gap-1">
                        {(item.content_format || []).slice(0, 3).map((f: string) => (
                          <span key={f} className="text-sm" title={f}>{FORMAT_ICONS[f] || '📌'}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(item.primary_teaching_methods || []).map((m: string) => (
                        <span key={m} className="text-[10px] px-2 py-0.5 bg-gray-700 rounded text-gray-300 capitalize">
                          {METHOD_NAMES[m] || m}
                        </span>
                      ))}
                    </div>
                    {item.ai_guru_method && (
                      <Link
                        href={`/guru?method=${item.ai_guru_method}`}
                        className="inline-block mt-2 text-xs text-primary-400 hover:text-primary-300"
                      >
                        Study with AI Guru →
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Quick Start with AI Guru */}
          <Card className="p-6 bg-gradient-to-r from-primary-900/40 to-accent-900/40 border-primary-500/30">
            <div className="flex items-center gap-4">
              <span className="text-4xl">🧙</span>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white">Start Learning Now</h3>
                <p className="text-sm text-gray-300">
                  AI Guru will teach {subjectName} using {METHOD_NAMES[recommendedMethods[0]] || 'your best method'},
                  optimized for your {myStyle?.name?.replace(' Learners', '')} style.
                </p>
              </div>
              <Link
                href={`/guru?method=${recommendedMethods[0] || 'feynman'}`}
                className="px-6 py-3 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 whitespace-nowrap"
              >
                Open AI Guru
              </Link>
            </div>
          </Card>
        </div>

        {/* Sidebar: Style info + activities */}
        <div className="space-y-6">
          {/* Style Summary */}
          <Card className="p-6">
            <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">Your Style Profile</h3>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl">{STYLE_ICONS[myStyleCode]}</span>
              <div>
                <p className="text-white font-bold">{myStyle?.name?.replace(' Learners', '')}</p>
                <p className="text-xs text-gray-400">
                  {subjectTeam ? 'Subject-specific' : 'General'} style
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">{myStyle?.description?.substring(0, 200)}</p>
          </Card>

          {/* Activities for this style */}
          <Card className="p-6">
            <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">Recommended Activities</h3>
            <div className="space-y-2">
              <Link href="/activities" className="flex items-center gap-2 p-2 bg-gray-800 rounded-lg hover:bg-gray-750">
                <span>🎮</span>
                <span className="text-xs text-white">Games & Puzzles</span>
              </Link>
              <Link href="/challenges" className="flex items-center gap-2 p-2 bg-gray-800 rounded-lg hover:bg-gray-750">
                <span>🏆</span>
                <span className="text-xs text-white">Challenges</span>
              </Link>
              <Link href="/flashcards" className="flex items-center gap-2 p-2 bg-gray-800 rounded-lg hover:bg-gray-750">
                <span>🃏</span>
                <span className="text-xs text-white">Flashcards</span>
              </Link>
            </div>
          </Card>

          {/* Take subject-specific assessment */}
          <Card className="p-6">
            <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">Not the right fit?</h3>
            <p className="text-xs text-gray-400 mb-3">
              Your learning style can be different for each subject. Take a subject-specific assessment.
            </p>
            <Link
              href="/style-discovery"
              className="block text-center px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white hover:border-primary-500"
            >
              Retake Assessment for {subjectName}
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
