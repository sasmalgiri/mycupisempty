'use client';

/**
 * IndiaMap — simplified clickable India SVG with states + optional data layer.
 * Uses a compact hand-drawn SVG (not geographically precise, but clear for K-12).
 *
 * Future: swap `PATHS` with real TopoJSON via d3-geo for precision.
 */

import { useState } from 'react';

interface StateInfo {
  id: string;
  name: string;
  capital: string;
  // Population in crore (rough 2021 estimates — educational accuracy, not census-grade)
  population: number;
  // Approximate SVG path (simplified)
  path: string;
  // Centroid for label
  cx: number; cy: number;
  languages: string[];
}

const STATES: StateInfo[] = [
  // Simplified rectangular approximations — educational purpose only
  { id: 'JK', name: 'Jammu & Kashmir', capital: 'Srinagar', population: 1.3, languages: ['Urdu', 'Kashmiri', 'Dogri'], cx: 260, cy: 60, path: 'M 220 30 L 310 30 L 320 100 L 240 110 Z' },
  { id: 'HP', name: 'Himachal Pradesh', capital: 'Shimla', population: 0.7, languages: ['Hindi'], cx: 280, cy: 130, path: 'M 240 110 L 320 100 L 330 160 L 260 170 Z' },
  { id: 'PB', name: 'Punjab', capital: 'Chandigarh', population: 2.8, languages: ['Punjabi'], cx: 240, cy: 170, path: 'M 210 150 L 260 170 L 270 210 L 220 215 Z' },
  { id: 'HR', name: 'Haryana', capital: 'Chandigarh', population: 2.5, languages: ['Hindi'], cx: 275, cy: 200, path: 'M 260 170 L 310 180 L 315 220 L 270 220 Z' },
  { id: 'UK', name: 'Uttarakhand', capital: 'Dehradun', population: 1.0, languages: ['Hindi'], cx: 330, cy: 180, path: 'M 315 160 L 380 170 L 385 215 L 320 210 Z' },
  { id: 'DL', name: 'Delhi', capital: 'New Delhi', population: 2.0, languages: ['Hindi', 'Punjabi', 'Urdu'], cx: 290, cy: 215, path: 'M 280 210 L 305 210 L 305 230 L 280 230 Z' },
  { id: 'RJ', name: 'Rajasthan', capital: 'Jaipur', population: 7.0, languages: ['Hindi', 'Rajasthani'], cx: 225, cy: 260, path: 'M 160 220 L 290 230 L 295 320 L 180 340 L 150 280 Z' },
  { id: 'UP', name: 'Uttar Pradesh', capital: 'Lucknow', population: 22.0, languages: ['Hindi', 'Urdu'], cx: 360, cy: 250, path: 'M 295 220 L 440 230 L 445 300 L 300 310 Z' },
  { id: 'BR', name: 'Bihar', capital: 'Patna', population: 12.0, languages: ['Hindi', 'Maithili'], cx: 470, cy: 260, path: 'M 445 230 L 510 235 L 515 290 L 450 295 Z' },
  { id: 'GJ', name: 'Gujarat', capital: 'Gandhinagar', population: 7.0, languages: ['Gujarati'], cx: 170, cy: 360, path: 'M 100 310 L 220 320 L 230 400 L 120 410 L 90 360 Z' },
  { id: 'MP', name: 'Madhya Pradesh', capital: 'Bhopal', population: 8.5, languages: ['Hindi'], cx: 320, cy: 340, path: 'M 220 320 L 420 320 L 420 380 L 220 400 Z' },
  { id: 'MH', name: 'Maharashtra', capital: 'Mumbai', population: 12.5, languages: ['Marathi'], cx: 260, cy: 430, path: 'M 160 400 L 380 395 L 380 470 L 170 480 Z' },
  { id: 'CG', name: 'Chhattisgarh', capital: 'Raipur', population: 3.0, languages: ['Hindi', 'Chhattisgarhi'], cx: 400, cy: 380, path: 'M 375 340 L 450 340 L 450 410 L 380 420 Z' },
  { id: 'JH', name: 'Jharkhand', capital: 'Ranchi', population: 3.7, languages: ['Hindi', 'Santali'], cx: 475, cy: 320, path: 'M 450 290 L 520 295 L 525 350 L 460 355 Z' },
  { id: 'WB', name: 'West Bengal', capital: 'Kolkata', population: 10.0, languages: ['Bengali'], cx: 530, cy: 320, path: 'M 520 260 L 570 265 L 575 380 L 525 385 Z' },
  { id: 'OD', name: 'Odisha', capital: 'Bhubaneswar', population: 4.5, languages: ['Odia'], cx: 475, cy: 420, path: 'M 430 395 L 525 395 L 520 460 L 440 465 Z' },
  { id: 'KA', name: 'Karnataka', capital: 'Bengaluru', population: 6.7, languages: ['Kannada'], cx: 280, cy: 510, path: 'M 220 480 L 340 475 L 340 555 L 230 560 Z' },
  { id: 'GA', name: 'Goa', capital: 'Panaji', population: 0.15, languages: ['Konkani'], cx: 210, cy: 485, path: 'M 200 475 L 220 475 L 220 495 L 200 495 Z' },
  { id: 'AP', name: 'Andhra Pradesh', capital: 'Amaravati', population: 5.0, languages: ['Telugu'], cx: 380, cy: 500, path: 'M 340 460 L 440 460 L 440 540 L 345 550 Z' },
  { id: 'TG', name: 'Telangana', capital: 'Hyderabad', population: 3.5, languages: ['Telugu'], cx: 365, cy: 450, path: 'M 340 420 L 425 420 L 430 465 L 345 465 Z' },
  { id: 'TN', name: 'Tamil Nadu', capital: 'Chennai', population: 7.2, languages: ['Tamil'], cx: 340, cy: 580, path: 'M 280 560 L 400 555 L 395 620 L 295 625 Z' },
  { id: 'KL', name: 'Kerala', capital: 'Thiruvananthapuram', population: 3.4, languages: ['Malayalam'], cx: 265, cy: 585, path: 'M 240 560 L 285 555 L 290 625 L 250 630 Z' },
  { id: 'AS', name: 'Assam', capital: 'Dispur', population: 3.1, languages: ['Assamese'], cx: 610, cy: 260, path: 'M 580 240 L 660 240 L 660 290 L 585 290 Z' },
];

type DataLayer = 'none' | 'population' | 'language';

export default function IndiaMap() {
  const [selected, setSelected] = useState<StateInfo | null>(null);
  const [layer, setLayer] = useState<DataLayer>('none');

  const getColor = (s: StateInfo): string => {
    if (layer === 'population') {
      if (s.population > 15) return '#7c3aed';
      if (s.population > 8) return '#8b5cf6';
      if (s.population > 4) return '#a78bfa';
      if (s.population > 1.5) return '#c4b5fd';
      return '#ede9fe';
    }
    if (layer === 'language') {
      const primary = s.languages[0];
      const colorMap: Record<string, string> = {
        Hindi: '#f59e0b', Bengali: '#14b8a6', Tamil: '#ef4444', Telugu: '#3b82f6',
        Kannada: '#8b5cf6', Malayalam: '#10b981', Marathi: '#f97316', Gujarati: '#ec4899',
        Punjabi: '#fbbf24', Odia: '#06b6d4', Assamese: '#84cc16', Urdu: '#6366f1',
        Konkani: '#a855f7', Kashmiri: '#0ea5e9',
      };
      return colorMap[primary] || '#e5e7eb';
    }
    return selected?.id === s.id ? '#6366f1' : '#fef3c7';
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-bold">🗺️ India Map — Interactive</h3>
        <div className="flex gap-1">
          {(['none', 'population', 'language'] as DataLayer[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLayer(l)}
              aria-label={l}
              className={`px-3 py-1 text-xs font-medium rounded capitalize ${layer === l ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}
            >{l === 'none' ? 'Default' : l}</button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 p-2">
          <svg viewBox="0 0 720 680" className="w-full" style={{ maxHeight: 500 }}>
            {STATES.map((s) => (
              <g key={s.id} onClick={() => setSelected(s)} style={{ cursor: 'pointer' }}>
                <path
                  d={s.path}
                  fill={getColor(s)}
                  stroke="#1f2937"
                  strokeWidth={selected?.id === s.id ? 2 : 0.8}
                />
                <text
                  x={s.cx} y={s.cy}
                  textAnchor="middle"
                  fontSize="10" fontWeight="600"
                  fill="#1f2937"
                  style={{ pointerEvents: 'none' }}
                >
                  {s.id}
                </text>
              </g>
            ))}
          </svg>
          {layer === 'population' && (
            <div className="mt-1 flex justify-between text-[10px] text-gray-500 px-2">
              <span>&lt; 1.5 cr</span><span>1.5–4</span><span>4–8</span><span>8–15</span><span>&gt; 15 cr</span>
            </div>
          )}
        </div>
        <div>
          {selected ? (
            <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
              <h4 className="font-bold text-lg mb-1">{selected.name}</h4>
              <dl className="text-sm space-y-1">
                <div><dt className="inline text-gray-500">Capital:</dt> <dd className="inline font-semibold">{selected.capital}</dd></div>
                <div><dt className="inline text-gray-500">Population:</dt> <dd className="inline font-semibold">~{selected.population} crore</dd></div>
                <div><dt className="inline text-gray-500">Languages:</dt> <dd className="inline font-semibold">{selected.languages.join(', ')}</dd></div>
              </dl>
            </div>
          ) : (
            <div className="p-4 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800">
              <p className="text-sm text-gray-500 mb-2">Click a state to see details.</p>
              <p className="text-xs text-gray-400">
                Note: this is a simplified educational map. State shapes are approximations for classroom use, not geographically precise.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
