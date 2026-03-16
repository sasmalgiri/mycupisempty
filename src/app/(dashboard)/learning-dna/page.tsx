'use client';

import React, { useEffect } from 'react';
import { useLearningDNA } from '@/hooks/upgrade';
import { RadarChart, LearningRoad, BuddyBubble } from '@/components/ui/upgrade';
import { LoadingPage, Card, Badge, Button } from '@/components/ui/index';
import Link from 'next/link';

export default function LearningDNAPage() {
  const { dna, loading } = useLearningDNA();

  if (loading) return <LoadingPage message="Loading your Learning DNA..." />;

  const completeness = dna?.profile_completeness || 0;

  // Build radar data from available assessments
  const radarData: { label: string; value: number }[] = [];
  if (dna?.vark_scores) {
    radarData.push(
      { label: 'Visual', value: dna.vark_scores.visual },
      { label: 'Auditory', value: dna.vark_scores.auditory },
      { label: 'Reading', value: dna.vark_scores.reading },
      { label: 'Kinesthetic', value: dna.vark_scores.kinesthetic },
    );
  }
  if (dna?.kolb_scores) {
    radarData.push(
      { label: 'Experience', value: dna.kolb_scores.ce },
      { label: 'Reflect', value: dna.kolb_scores.ro },
      { label: 'Concept', value: dna.kolb_scores.ac },
      { label: 'Experiment', value: dna.kolb_scores.ae },
    );
  }

  // Gardner intelligences radar
  const gardnerData = dna?.gardner_scores
    ? Object.entries(dna.gardner_scores).map(([key, value]) => ({
        label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).split(' ')[0],
        value: value as number,
      }))
    : [];

  // Learning road for assessments
  const assessmentRoad = [
    {
      id: 'vark',
      title: 'VARK Learning Style',
      description: 'Visual, Auditory, Reading, Kinesthetic',
      status: dna?.vark_scores ? 'completed' as const : 'available' as const,
      xp: 50,
      icon: '🎨',
    },
    {
      id: 'gardner',
      title: 'Multiple Intelligences',
      description: "Howard Gardner's 8 Intelligence Types",
      status: dna?.gardner_scores ? 'completed' as const : (dna?.vark_scores ? 'available' as const : 'locked' as const),
      xp: 50,
      icon: '🧠',
    },
    {
      id: 'kolb',
      title: "Kolb's Learning Cycle",
      description: 'Diverger, Assimilator, Converger, Accommodator',
      status: dna?.kolb_scores ? 'completed' as const : (dna?.gardner_scores ? 'available' as const : 'locked' as const),
      xp: 50,
      icon: '🔄',
    },
    {
      id: 'aptitude',
      title: 'Subject Aptitude',
      description: 'Discover your natural subject strengths',
      status: (dna?.subject_aptitudes?.length || 0) > 0 ? 'completed' as const : (dna?.kolb_scores ? 'available' as const : 'locked' as const),
      xp: 100,
      icon: '📊',
    },
  ];

  const assessmentLinks: Record<string, string> = {
    vark: '/assessment',
    gardner: '/assessment',
    kolb: '/assessment/kolb',
    aptitude: '/assessment/aptitude',
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          🧬 Your Learning DNA
        </h1>
        <p className="text-gray-400">
          A complete profile of how you learn best — built from scientific assessments
        </p>
      </div>

      {/* Completeness */}
      <div className="mb-8 p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Profile Completeness</span>
          <span className="text-sm font-bold text-primary-400">{completeness}%</span>
        </div>
        <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-600 to-accent-500 rounded-full transition-all duration-700"
            style={{ width: `${completeness}%` }}
          />
        </div>
        {completeness < 100 && (
          <p className="text-xs text-gray-500 mt-2">
            Complete all assessments to unlock personalized recommendations!
          </p>
        )}
      </div>

      {/* Buddy tip */}
      {completeness < 50 && (
        <BuddyBubble
          message="Hey! Let's discover how you learn best. Start with the VARK assessment — it only takes 5 minutes and helps me personalize everything for you!"
          mood="encouraging"
          className="mb-6"
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Assessment Road */}
        <div className="lg:col-span-1">
          <h2 className="text-lg font-semibold text-white mb-4">Assessment Journey</h2>
          <LearningRoad
            steps={assessmentRoad}
            onStepClick={(step) => {
              if (step.status !== 'locked') {
                window.location.href = assessmentLinks[step.id];
              }
            }}
          />
        </div>

        {/* Right column: Visualizations */}
        <div className="lg:col-span-2 space-y-6">
          {/* VARK + Kolb Radar */}
          {radarData.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Learning Style Radar</h3>
              <div className="flex justify-center">
                <RadarChart data={radarData} size={280} />
              </div>
              {dna?.vark_primary && (
                <div className="text-center mt-4">
                  <p className="text-sm text-gray-400">Primary Style</p>
                  <Badge variant="primary" size="md">
                    {dna.vark_primary.charAt(0).toUpperCase() + dna.vark_primary.slice(1)} Learner
                  </Badge>
                </div>
              )}
            </Card>
          )}

          {/* Gardner Intelligences */}
          {gardnerData.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Multiple Intelligences</h3>
              <div className="flex justify-center">
                <RadarChart data={gardnerData} size={280} color="#14b8a6" />
              </div>
              {dna?.gardner_top_3 && dna.gardner_top_3.length > 0 && (
                <div className="text-center mt-4">
                  <p className="text-sm text-gray-400 mb-2">Top Intelligences</p>
                  <div className="flex gap-2 justify-center flex-wrap">
                    {dna.gardner_top_3.map(g => (
                      <Badge key={g} variant="success">
                        {g.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Kolb Type */}
          {dna?.kolb_type && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-white mb-2">Kolb Learning Type</h3>
              <div className="text-center">
                <div className="text-4xl mb-2">
                  {dna.kolb_type === 'diverger' ? '🌊' : dna.kolb_type === 'assimilator' ? '📐' :
                   dna.kolb_type === 'converger' ? '🎯' : '🚀'}
                </div>
                <p className="text-xl font-bold text-white capitalize">{dna.kolb_type}</p>
                <p className="text-sm text-gray-400 mt-1">
                  {dna.kolb_type === 'diverger' && 'You learn best through concrete experiences and reflective observation. Great at brainstorming!'}
                  {dna.kolb_type === 'assimilator' && 'You learn best through abstract concepts and reflective observation. Great at theory!'}
                  {dna.kolb_type === 'converger' && 'You learn best through abstract concepts and active experimentation. Great at problem-solving!'}
                  {dna.kolb_type === 'accommodator' && 'You learn best through concrete experiences and active experimentation. Great at doing!'}
                </p>
              </div>
            </Card>
          )}

          {/* Subject Aptitudes */}
          {dna?.subject_aptitudes && dna.subject_aptitudes.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Subject Aptitudes</h3>
              <div className="space-y-3">
                {dna.subject_aptitudes.map((apt: any) => (
                  <div key={apt.id} className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-white font-medium">{apt.subject_id}</span>
                        <span className="text-gray-400">{apt.aptitude_score}%</span>
                      </div>
                      <div className="flex gap-1 h-2">
                        <div className="flex-1 bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${apt.aptitude_score}%` }} />
                        </div>
                        <div className="flex-1 bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${apt.interest_score}%` }} />
                        </div>
                        <div className="flex-1 bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500 rounded-full" style={{ width: `${apt.performance_score}%` }} />
                        </div>
                      </div>
                      <div className="flex gap-4 mt-1">
                        <span className="text-[10px] text-blue-400">Aptitude</span>
                        <span className="text-[10px] text-green-400">Interest</span>
                        <span className="text-[10px] text-purple-400">Performance</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Recommended methods */}
          {dna?.preferred_methods && dna.preferred_methods.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Your Best Methods</h3>
              <div className="flex flex-wrap gap-2">
                {dna.preferred_methods.map(m => (
                  <Link
                    key={m}
                    href={`/methods`}
                    className="px-3 py-2 bg-primary-600/20 border border-primary-500/30 rounded-lg text-sm text-primary-400 hover:bg-primary-600/30 transition-all"
                  >
                    {m.replace(/_/g, ' ')}
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {/* Empty state */}
          {radarData.length === 0 && gardnerData.length === 0 && (
            <Card className="p-12 text-center">
              <span className="text-5xl block mb-4">🧬</span>
              <h3 className="text-xl font-bold text-white mb-2">Your DNA Profile is Empty</h3>
              <p className="text-gray-400 mb-6">
                Complete the assessments on the left to build your unique learning profile.
                It helps us recommend the best methods, difficulty, and style for you!
              </p>
              <Link href="/assessment">
                <Button variant="primary">Start VARK Assessment</Button>
              </Link>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
