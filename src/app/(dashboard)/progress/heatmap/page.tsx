'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

interface TopicMastery {
  topic_id: string;
  topic_title: string;
  chapter_title: string;
  subject_name: string;
  mastery_score_recall: number;
  mastery_score_comprehension: number;
  mastery_score_application: number;
  mastery_score_transfer: number;
  mastery_score_retention: number;
  mastery_score_metacognition: number;
  mastery_score_independence: number;
  mastery_total: number;
  mastery_band: string;
}

const MASTERY_COMPONENTS = [
  { key: 'mastery_score_recall', label: 'Recall', shortLabel: 'RCL' },
  { key: 'mastery_score_comprehension', label: 'Comprehension', shortLabel: 'CMP' },
  { key: 'mastery_score_application', label: 'Application', shortLabel: 'APP' },
  { key: 'mastery_score_transfer', label: 'Transfer', shortLabel: 'TRF' },
  { key: 'mastery_score_retention', label: 'Retention', shortLabel: 'RTN' },
  { key: 'mastery_score_metacognition', label: 'Metacognition', shortLabel: 'MTC' },
  { key: 'mastery_score_independence', label: 'Independence', shortLabel: 'IND' },
] as const;

type MasteryKey = typeof MASTERY_COMPONENTS[number]['key'];

function getMasteryColor(value: number): string {
  if (value >= 90) return 'bg-green-600 text-white';
  if (value >= 75) return 'bg-green-400 text-white';
  if (value >= 60) return 'bg-yellow-300 text-gray-900';
  if (value >= 40) return 'bg-orange-400 text-white';
  return 'bg-red-500 text-white';
}

function getMasteryBgLight(value: number): string {
  if (value >= 90) return 'bg-green-600/20 border-green-600/40';
  if (value >= 75) return 'bg-green-400/20 border-green-400/40';
  if (value >= 60) return 'bg-yellow-300/20 border-yellow-400/40';
  if (value >= 40) return 'bg-orange-400/20 border-orange-400/40';
  return 'bg-red-500/20 border-red-500/40';
}

export default function WeaknessHeatMapPage() {
  const [topics, setTopics] = useState<TopicMastery[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHeatmapData();
  }, []);

  const fetchHeatmapData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/progress/heatmap');
      const json = await res.json();

      if (json.error) {
        setError(json.error);
        setTopics(getMockData());
      } else {
        setTopics(json.topics || []);
        setError(null);
      }
    } catch {
      setTopics(getMockData());
    } finally {
      setLoading(false);
    }
  };

  // Filter topics client-side by selected subject
  const filteredTopics = selectedSubject === 'all'
    ? topics
    : topics.filter(t => t.subject_name === selectedSubject);

  // Extract unique subjects for the filter
  const subjects = useMemo(() => {
    const uniqueSubjects = new Map<string, string>();
    topics.forEach(t => {
      if (t.subject_name && t.subject_name !== 'Unknown Subject') {
        uniqueSubjects.set(t.subject_name, t.subject_name);
      }
    });
    return Array.from(uniqueSubjects.values());
  }, [topics]);

  // Group topics by chapter
  const groupedByChapter = useMemo(() => {
    const groups: Record<string, TopicMastery[]> = {};
    filteredTopics.forEach(t => {
      const key = t.chapter_title;
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    return groups;
  }, [filteredTopics]);

  // Compute averages per component
  const averages = useMemo(() => {
    if (filteredTopics.length === 0) return {} as Record<MasteryKey, number>;
    const sums: Record<string, number> = {};
    MASTERY_COMPONENTS.forEach(c => { sums[c.key] = 0; });
    filteredTopics.forEach(t => {
      MASTERY_COMPONENTS.forEach(c => {
        sums[c.key] += (t[c.key as keyof TopicMastery] as number) || 0;
      });
    });
    const avgs: Record<string, number> = {};
    MASTERY_COMPONENTS.forEach(c => {
      avgs[c.key] = Math.round(sums[c.key] / filteredTopics.length);
    });
    return avgs as Record<MasteryKey, number>;
  }, [filteredTopics]);

  // Weakest areas: top 5 weakest topic-component pairs
  const weakestAreas = useMemo(() => {
    const pairs: { topic: TopicMastery; component: typeof MASTERY_COMPONENTS[number]; value: number }[] = [];
    filteredTopics.forEach(t => {
      MASTERY_COMPONENTS.forEach(c => {
        const val = (t[c.key as keyof TopicMastery] as number) || 0;
        pairs.push({ topic: t, component: c, value: val });
      });
    });
    pairs.sort((a, b) => a.value - b.value);
    return pairs.slice(0, 5);
  }, [filteredTopics]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-50 to-secondary-50 flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-16 h-16 bg-primary-200 rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Loading mastery heat map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-50 to-secondary-50">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-effect border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/progress" className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Weakness Heat Map</h1>
                <p className="text-xs text-gray-500">Mastery across all topics and components</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Subject Filter */}
        <div className="flex items-center gap-4 mb-6">
          <label className="text-sm font-medium text-gray-700">Filter by Subject:</label>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            title="Filter by subject"
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">All Subjects</option>
            {subjects.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Color Legend */}
        <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-white rounded-xl shadow-sm">
          <span className="text-sm font-medium text-gray-600">Legend:</span>
          <div className="flex items-center gap-1">
            <div className="w-6 h-6 rounded bg-red-500"></div>
            <span className="text-xs text-gray-500">&lt;40</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-6 h-6 rounded bg-orange-400"></div>
            <span className="text-xs text-gray-500">40-59</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-6 h-6 rounded bg-yellow-300"></div>
            <span className="text-xs text-gray-500">60-74</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-6 h-6 rounded bg-green-400"></div>
            <span className="text-xs text-gray-500">75-89</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-6 h-6 rounded bg-green-600"></div>
            <span className="text-xs text-gray-500">90+</span>
          </div>
        </div>

        {topics.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 shadow-md text-center">
            <span className="text-5xl block mb-4">📊</span>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No Mastery Data Yet</h2>
            <p className="text-gray-500 mb-6">Start learning topics to see your mastery heat map here.</p>
            <Link
              href="/subjects"
              className="inline-block px-6 py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 transition-colors"
            >
              Browse Subjects
            </Link>
          </div>
        ) : (
          <>
            {/* Heat Map Grid - Horizontally scrollable on mobile */}
            <div className="bg-white rounded-2xl shadow-md overflow-hidden mb-8">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-4 py-3 text-sm font-bold text-gray-700 sticky left-0 bg-white z-10 min-w-[200px]">
                        Topic
                      </th>
                      {MASTERY_COMPONENTS.map(c => (
                        <th key={c.key} className="px-2 py-3 text-center">
                          <span className="text-xs font-bold text-gray-600 hidden sm:inline">{c.label}</span>
                          <span className="text-xs font-bold text-gray-600 sm:hidden">{c.shortLabel}</span>
                        </th>
                      ))}
                      <th className="px-3 py-3 text-center text-xs font-bold text-gray-600">Total</th>
                      <th className="px-3 py-3 text-center text-xs font-bold text-gray-600">Band</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(groupedByChapter).map(([chapter, chapterTopics]) => (
                      <React.Fragment key={`chapter-${chapter}`}>
                        {/* Chapter Header Row */}
                        <tr className="bg-gray-50">
                          <td
                            colSpan={MASTERY_COMPONENTS.length + 3}
                            className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50"
                          >
                            {chapter}
                          </td>
                        </tr>
                        {/* Topic Rows */}
                        {chapterTopics.map(topic => (
                          <tr key={topic.topic_id} className="border-b border-gray-50 hover:bg-gray-50/50">
                            <td className="px-4 py-2 sticky left-0 bg-white z-10">
                              <p className="text-sm font-medium text-gray-800 truncate max-w-[200px]">{topic.topic_title}</p>
                              <p className="text-[10px] text-gray-400">{topic.subject_name}</p>
                            </td>
                            {MASTERY_COMPONENTS.map(c => {
                              const value = (topic[c.key as keyof TopicMastery] as number) || 0;
                              return (
                                <td key={c.key} className="px-1 py-2 text-center">
                                  <div
                                    className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-xs font-bold ${getMasteryColor(value)}`}
                                    title={`${c.label}: ${value}`}
                                  >
                                    {value}
                                  </div>
                                </td>
                              );
                            })}
                            <td className="px-2 py-2 text-center">
                              <span className="text-sm font-bold text-gray-900">{topic.mastery_total}</span>
                            </td>
                            <td className="px-2 py-2 text-center">
                              <span className={`text-[10px] px-2 py-1 rounded-full font-medium capitalize ${
                                topic.mastery_band === 'mastered' ? 'bg-green-100 text-green-700' :
                                topic.mastery_band === 'proficient' ? 'bg-blue-100 text-blue-700' :
                                topic.mastery_band === 'developing' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {topic.mastery_band}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}

                    {/* Summary Row */}
                    <tr className="bg-primary-50 border-t-2 border-primary-200">
                      <td className="px-4 py-3 sticky left-0 bg-primary-50 z-10">
                        <p className="text-sm font-bold text-primary-700">Average</p>
                        <p className="text-[10px] text-primary-500">{topics.length} topics</p>
                      </td>
                      {MASTERY_COMPONENTS.map(c => {
                        const avg = averages[c.key] || 0;
                        return (
                          <td key={c.key} className="px-1 py-3 text-center">
                            <div
                              className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-xs font-bold ${getMasteryColor(avg)}`}
                            >
                              {avg}
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-2 py-3 text-center">
                        <span className="text-sm font-bold text-primary-700">
                          {topics.length > 0 ? Math.round(topics.reduce((s, t) => s + t.mastery_total, 0) / topics.length) : 0}
                        </span>
                      </td>
                      <td className="px-2 py-3"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Weakest Areas */}
            {weakestAreas.length > 0 && (
              <div className="bg-white rounded-2xl shadow-md p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-1">Weakest Areas</h2>
                <p className="text-sm text-gray-500 mb-4">Your top 5 weakest topic-component pairs. Focus here for maximum improvement.</p>
                <div className="space-y-3">
                  {weakestAreas.map((item, i) => (
                    <div
                      key={`${item.topic.topic_id}-${item.component.key}`}
                      className={`flex items-center justify-between p-4 rounded-xl border ${getMasteryBgLight(item.value)}`}
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${getMasteryColor(item.value)}`}>
                          {item.value}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {item.topic.topic_title}
                          </p>
                          <p className="text-xs text-gray-500">
                            {item.component.label} &middot; {item.topic.chapter_title} &middot; {item.topic.subject_name}
                          </p>
                        </div>
                      </div>
                      <Link
                        href={`/guru?topic=${encodeURIComponent(item.topic.topic_title)}&focus=${item.component.key.replace('mastery_', '')}`}
                        className="flex-shrink-0 ml-4 px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors"
                      >
                        Practice Now
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// Mock data for development/fallback
function getMockData(): TopicMastery[] {
  return [
    { topic_id: '1', topic_title: 'Photosynthesis', chapter_title: 'Life Processes', subject_name: 'Science', mastery_score_recall: 82, mastery_score_comprehension: 71, mastery_score_application: 55, mastery_score_transfer: 40, mastery_score_retention: 68, mastery_score_metacognition: 45, mastery_score_independence: 50, mastery_total: 59, mastery_band: 'developing' },
    { topic_id: '2', topic_title: 'Linear Equations', chapter_title: 'Algebra', subject_name: 'Mathematics', mastery_score_recall: 90, mastery_score_comprehension: 85, mastery_score_application: 78, mastery_score_transfer: 65, mastery_score_retention: 80, mastery_score_metacognition: 70, mastery_score_independence: 72, mastery_total: 77, mastery_band: 'proficient' },
    { topic_id: '3', topic_title: 'Acids and Bases', chapter_title: 'Chemical Reactions', subject_name: 'Science', mastery_score_recall: 60, mastery_score_comprehension: 50, mastery_score_application: 35, mastery_score_transfer: 25, mastery_score_retention: 45, mastery_score_metacognition: 30, mastery_score_independence: 28, mastery_total: 39, mastery_band: 'emerging' },
    { topic_id: '4', topic_title: 'Quadratic Equations', chapter_title: 'Algebra', subject_name: 'Mathematics', mastery_score_recall: 75, mastery_score_comprehension: 68, mastery_score_application: 60, mastery_score_transfer: 52, mastery_score_retention: 70, mastery_score_metacognition: 55, mastery_score_independence: 48, mastery_total: 61, mastery_band: 'developing' },
    { topic_id: '5', topic_title: 'Tenses', chapter_title: 'Grammar', subject_name: 'English', mastery_score_recall: 95, mastery_score_comprehension: 92, mastery_score_application: 88, mastery_score_transfer: 80, mastery_score_retention: 90, mastery_score_metacognition: 85, mastery_score_independence: 82, mastery_total: 87, mastery_band: 'mastered' },
    { topic_id: '6', topic_title: 'French Revolution', chapter_title: 'Modern History', subject_name: 'Social Science', mastery_score_recall: 70, mastery_score_comprehension: 55, mastery_score_application: 42, mastery_score_transfer: 30, mastery_score_retention: 50, mastery_score_metacognition: 35, mastery_score_independence: 32, mastery_total: 45, mastery_band: 'emerging' },
    { topic_id: '7', topic_title: 'Respiration', chapter_title: 'Life Processes', subject_name: 'Science', mastery_score_recall: 78, mastery_score_comprehension: 65, mastery_score_application: 50, mastery_score_transfer: 38, mastery_score_retention: 60, mastery_score_metacognition: 42, mastery_score_independence: 40, mastery_total: 53, mastery_band: 'developing' },
    { topic_id: '8', topic_title: 'Triangles', chapter_title: 'Geometry', subject_name: 'Mathematics', mastery_score_recall: 88, mastery_score_comprehension: 80, mastery_score_application: 72, mastery_score_transfer: 60, mastery_score_retention: 75, mastery_score_metacognition: 65, mastery_score_independence: 58, mastery_total: 71, mastery_band: 'proficient' },
  ];
}
