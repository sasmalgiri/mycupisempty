'use client';

/**
 * TimelineViewer — horizontal history timeline with zoom + click-to-expand.
 * Accepts events array; preset for Indian history.
 */

import { useMemo, useState } from 'react';

export interface TimelineEvent {
  year: number;          // negative = BCE
  title: string;
  description: string;
  category?: 'politics' | 'culture' | 'science' | 'religion' | 'war' | 'economics';
}

const CATEGORY_COLORS: Record<string, string> = {
  politics: '#6366f1',
  culture: '#ec4899',
  science: '#14b8a6',
  religion: '#f59e0b',
  war: '#ef4444',
  economics: '#84cc16',
};

const INDIAN_HISTORY: TimelineEvent[] = [
  { year: -2500, title: 'Indus Valley Civilization', description: 'One of the world\'s oldest urban civilizations; cities like Harappa and Mohenjo-daro.', category: 'culture' },
  { year: -1500, title: 'Vedic Period begins', description: 'Composition of the Rigveda; emergence of Vedic society and early Hinduism.', category: 'religion' },
  { year: -563, title: 'Birth of Gautama Buddha', description: 'Founder of Buddhism; born in Lumbini.', category: 'religion' },
  { year: -599, title: 'Birth of Mahavira', description: '24th Tirthankara; reorganized Jainism.', category: 'religion' },
  { year: -326, title: 'Alexander enters India', description: 'Greek invasion reaches the Indus; battle at the Hydaspes.', category: 'war' },
  { year: -322, title: 'Mauryan Empire founded', description: 'Chandragupta Maurya defeats the Nandas; first pan-Indian empire.', category: 'politics' },
  { year: -269, title: 'Ashoka becomes emperor', description: 'Expands Mauryan empire; later embraces Buddhism after Kalinga war.', category: 'politics' },
  { year: 320, title: 'Gupta Empire begins', description: 'Classical age of India; flourishing of science, math, art.', category: 'politics' },
  { year: 499, title: 'Aryabhata writes Aryabhatiya', description: 'Introduces decimal system, zero, and trigonometry.', category: 'science' },
  { year: 712, title: 'Arab conquest of Sindh', description: 'Muhammad bin Qasim conquers Sindh.', category: 'war' },
  { year: 1192, title: 'Battle of Tarain', description: 'Muhammad Ghori defeats Prithviraj Chauhan; Delhi Sultanate begins.', category: 'war' },
  { year: 1526, title: 'Mughal Empire founded', description: 'Babur defeats Ibrahim Lodi at First Battle of Panipat.', category: 'politics' },
  { year: 1556, title: 'Akbar becomes emperor', description: 'Expands Mughal empire; policy of religious tolerance.', category: 'politics' },
  { year: 1600, title: 'East India Company chartered', description: 'British East India Company formed.', category: 'economics' },
  { year: 1757, title: 'Battle of Plassey', description: 'British defeat Siraj-ud-Daulah; foothold of colonial rule.', category: 'war' },
  { year: 1857, title: 'First War of Independence', description: 'Sepoy Mutiny / revolt against British rule.', category: 'war' },
  { year: 1885, title: 'Indian National Congress founded', description: 'Platform for Indian political voice.', category: 'politics' },
  { year: 1919, title: 'Jallianwala Bagh massacre', description: 'British troops fire on peaceful gathering in Amritsar.', category: 'politics' },
  { year: 1930, title: 'Salt March (Dandi)', description: 'Gandhi\'s nonviolent civil disobedience against salt tax.', category: 'politics' },
  { year: 1947, title: 'Independence & Partition', description: 'India becomes independent on 15 August; partitioned into India and Pakistan.', category: 'politics' },
  { year: 1950, title: 'Constitution of India adopted', description: '26 January; India becomes a republic.', category: 'politics' },
  { year: 1991, title: 'Economic liberalization', description: 'Rao-Manmohan reforms open the economy.', category: 'economics' },
];

interface Props { events?: TimelineEvent[]; title?: string; }

export default function TimelineViewer({ events = INDIAN_HISTORY, title = 'Indian History Timeline' }: Props) {
  const [selected, setSelected] = useState<TimelineEvent | null>(null);
  const [zoom, setZoom] = useState(1);

  const sorted = useMemo(() => [...events].sort((a, b) => a.year - b.year), [events]);
  const minYear = sorted[0]?.year ?? 0;
  const maxYear = sorted[sorted.length - 1]?.year ?? 0;
  const span = Math.max(1, maxYear - minYear);

  const widthPx = 1200 * zoom;

  const formatYear = (y: number) => y < 0 ? `${-y} BCE` : y === 0 ? '0' : `${y} CE`;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-bold">📜 {title}</h3>
        <div className="flex gap-1">
          <button type="button" onClick={() => setZoom(Math.max(0.5, zoom - 0.25))} aria-label="Zoom out" className="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-800 rounded">−</button>
          <button type="button" onClick={() => setZoom(1)} aria-label="Reset zoom" className="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-800 rounded">{(zoom * 100).toFixed(0)}%</button>
          <button type="button" onClick={() => setZoom(Math.min(4, zoom + 0.25))} aria-label="Zoom in" className="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-800 rounded">+</button>
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-lg bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-gray-950 dark:to-gray-900">
        <div style={{ width: `${widthPx}px`, height: 200, position: 'relative' }}>
          {/* Axis line */}
          <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-gray-400" />

          {/* Year marks — every ~500 years or so */}
          {[...Array(Math.ceil(span / 250) + 1)].map((_, i) => {
            const y = minYear + i * 250;
            if (y > maxYear + 125) return null;
            const pct = ((y - minYear) / span) * 100;
            return (
              <div key={i} className="absolute top-0 bottom-0 text-[10px] text-gray-500" style={{ left: `${pct}%` }}>
                <div className="w-px h-full bg-gray-300" />
                <span className="absolute top-1 -translate-x-1/2">{formatYear(y)}</span>
              </div>
            );
          })}

          {/* Events */}
          {sorted.map((e, i) => {
            const pct = ((e.year - minYear) / span) * 100;
            const above = i % 2 === 0;
            const color = CATEGORY_COLORS[e.category || ''] || '#6366f1';
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSelected(e)}
                aria-label={e.title}
                title={`${formatYear(e.year)} — ${e.title}`}
                className="absolute -translate-x-1/2 text-xs cursor-pointer hover:scale-110 transition-transform"
                style={{
                  left: `${pct}%`,
                  top: above ? '15%' : '60%',
                }}
              >
                <div className="px-2 py-1 rounded-lg shadow-md whitespace-nowrap max-w-[140px] truncate" style={{ backgroundColor: color, color: '#fff' }}>
                  {e.title}
                </div>
                <div className="text-[10px] text-gray-700 dark:text-gray-300 mt-0.5">{formatYear(e.year)}</div>
                <div className="w-1 h-4 mx-auto" style={{ backgroundColor: color, marginTop: above ? 4 : -28 }} />
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <div className="mt-3 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-bold">{selected.title}</h4>
            <button type="button" onClick={() => setSelected(null)} aria-label="Close" className="text-gray-500 text-xl">×</button>
          </div>
          <p className="text-xs text-gray-500 mb-2">{formatYear(selected.year)}{selected.category ? ` · ${selected.category}` : ''}</p>
          <p className="text-sm">{selected.description}</p>
        </div>
      )}
    </div>
  );
}
