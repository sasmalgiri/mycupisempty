'use client';

/**
 * ManipulableSlot — drop into any concept card. Looks up the
 * registered manipulable for the topic and renders the matching
 * existing interactive component (graph plotter, physics sim, etc.).
 *
 * Falls back to a labelled placeholder if no manipulable is registered
 * (so concept cards always have a default interactive surface — even if
 * the actual interactive isn't wired yet).
 */

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Lazy-load existing interactive components so we don't bloat
// every concept card if it doesn't need them.
const GraphPlotter = dynamic(() => import('@/components/tools/GraphPlotter').catch(() => () => null), { ssr: false });
const MoleculeViewer = dynamic(() => import('@/components/tools/MoleculeViewer').catch(() => () => null), { ssr: false });
const PhysicsSim = dynamic(() => import('@/components/tools/PhysicsSim').catch(() => () => null), { ssr: false });
const PeriodicTable = dynamic(() => import('@/components/tools/PeriodicTable').catch(() => () => null), { ssr: false });
const TimelineViewer = dynamic(() => import('@/components/tools/TimelineViewer').catch(() => () => null), { ssr: false });

interface Item {
  manipulable: string;
  config: Record<string, any>;
}

interface Props {
  topicId?: string;
  subject?: string;
  className?: string;
}

export default function ManipulableSlot({ topicId, subject, className = '' }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const qs = new URLSearchParams();
    if (topicId) qs.set('topicId', topicId);
    if (subject) qs.set('subject', subject);
    fetch(`/api/manipulables?${qs.toString()}`)
      .then((r) => r.json())
      .then((d) => setItems(d?.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [topicId, subject]);

  if (loading) return null;
  if (items.length === 0) return null;

  const item = items[0];
  switch (item.manipulable) {
    case 'graph_plotter':
      return <div className={className}><GraphPlotter {...(item.config as any)} /></div>;
    case 'molecule_viewer':
      return <div className={className}><MoleculeViewer {...(item.config as any)} /></div>;
    case 'physics_sim':
      return <div className={className}><PhysicsSim {...(item.config as any)} /></div>;
    case 'periodic_table':
      return <div className={className}><PeriodicTable {...(item.config as any)} /></div>;
    case 'timeline':
      return <div className={className}><TimelineViewer {...(item.config as any)} /></div>;
    default:
      return (
        <div className={`p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 text-center text-xs text-gray-500 ${className}`}>
          Interactive ({item.manipulable}) registered but not yet wired into this slot.
        </div>
      );
  }
}
