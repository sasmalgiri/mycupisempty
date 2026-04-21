'use client';

/**
 * DiagramExplorer — labeled biology / anatomy diagrams with click-to-reveal.
 */

import { useState } from 'react';

interface Label { id: string; name: string; description: string; x: number; y: number; }
interface Diagram { id: string; title: string; subject: string; viewBox: string; svg: string; labels: Label[]; }

const DIAGRAMS: Diagram[] = [
  {
    id: 'plant_cell',
    title: 'Plant Cell',
    subject: 'Biology',
    viewBox: '0 0 400 300',
    svg: `
      <rect x="40" y="40" width="320" height="220" rx="20" fill="#bbf7d0" stroke="#16a34a" stroke-width="2"/>
      <circle cx="200" cy="150" r="40" fill="#86efac" stroke="#16a34a" stroke-width="2"/>
      <circle cx="200" cy="150" r="15" fill="#166534"/>
      <ellipse cx="110" cy="100" rx="20" ry="12" fill="#4ade80" stroke="#166534" stroke-width="1.5"/>
      <ellipse cx="290" cy="105" rx="22" ry="13" fill="#4ade80" stroke="#166534" stroke-width="1.5"/>
      <ellipse cx="120" cy="220" rx="18" ry="10" fill="#4ade80" stroke="#166534" stroke-width="1.5"/>
      <rect x="60" y="55" width="280" height="12" fill="#22c55e" stroke="#16a34a" stroke-width="1"/>
      <rect x="250" y="180" width="80" height="50" fill="#fbbf24" stroke="#d97706" stroke-width="1.5" opacity="0.5"/>
    `,
    labels: [
      { id: 'cell_wall', name: 'Cell Wall', description: 'Rigid outer boundary made of cellulose. Provides shape and support.', x: 45, y: 50 },
      { id: 'membrane', name: 'Cell Membrane', description: 'Inside the wall; selectively permeable. Controls what enters/exits.', x: 70, y: 62 },
      { id: 'nucleus', name: 'Nucleus', description: 'Control center. Contains DNA with genetic instructions.', x: 200, y: 150 },
      { id: 'chloroplast', name: 'Chloroplast', description: 'Contains chlorophyll. Site of photosynthesis — makes food from sunlight.', x: 110, y: 100 },
      { id: 'vacuole', name: 'Vacuole', description: 'Large storage sac. Holds water, nutrients, and waste. Gives cell turgor.', x: 280, y: 200 },
    ],
  },
  {
    id: 'heart',
    title: 'Human Heart',
    subject: 'Biology',
    viewBox: '0 0 400 300',
    svg: `
      <path d="M 200 250 C 100 200, 80 100, 150 80 C 175 70, 195 90, 200 110 C 205 90, 225 70, 250 80 C 320 100, 300 200, 200 250 Z" fill="#ef4444" stroke="#991b1b" stroke-width="2"/>
      <path d="M 200 110 L 200 240" stroke="#991b1b" stroke-width="1.5"/>
      <path d="M 150 130 L 250 130" stroke="#991b1b" stroke-width="1.5"/>
      <text x="170" y="120" font-size="10" fill="#fff">RA</text>
      <text x="220" y="120" font-size="10" fill="#fff">LA</text>
      <text x="170" y="195" font-size="10" fill="#fff">RV</text>
      <text x="220" y="195" font-size="10" fill="#fff">LV</text>
      <line x1="150" y1="80" x2="150" y2="40" stroke="#2563eb" stroke-width="4"/>
      <line x1="250" y1="80" x2="250" y2="40" stroke="#dc2626" stroke-width="4"/>
    `,
    labels: [
      { id: 'ra', name: 'Right Atrium (RA)', description: 'Receives deoxygenated blood from body via superior/inferior vena cava.', x: 170, y: 120 },
      { id: 'la', name: 'Left Atrium (LA)', description: 'Receives oxygenated blood from lungs via pulmonary veins.', x: 220, y: 120 },
      { id: 'rv', name: 'Right Ventricle (RV)', description: 'Pumps deoxygenated blood to lungs via pulmonary artery.', x: 170, y: 195 },
      { id: 'lv', name: 'Left Ventricle (LV)', description: 'Pumps oxygenated blood to body via aorta. Thickest wall.', x: 220, y: 195 },
      { id: 'vena_cava', name: 'Vena Cava', description: 'Brings deoxygenated blood from body to right atrium.', x: 150, y: 60 },
      { id: 'aorta', name: 'Aorta', description: 'Largest artery. Carries oxygenated blood from left ventricle to body.', x: 250, y: 60 },
    ],
  },
  {
    id: 'digestion',
    title: 'Digestive System',
    subject: 'Biology',
    viewBox: '0 0 300 400',
    svg: `
      <ellipse cx="150" cy="50" rx="35" ry="25" fill="#fef3c7" stroke="#d97706" stroke-width="2"/>
      <line x1="150" y1="75" x2="150" y2="130" stroke="#d97706" stroke-width="3"/>
      <ellipse cx="150" cy="170" rx="45" ry="30" fill="#fed7aa" stroke="#c2410c" stroke-width="2"/>
      <path d="M 150 200 Q 110 230, 130 270 Q 170 300, 150 340" fill="none" stroke="#c2410c" stroke-width="8" opacity="0.5"/>
      <path d="M 115 310 Q 180 320, 190 340 L 150 350" fill="#fbbf24" stroke="#92400e" stroke-width="2" opacity="0.7"/>
    `,
    labels: [
      { id: 'mouth', name: 'Mouth', description: 'Chewing + saliva. Amylase starts breaking starch into sugar.', x: 150, y: 50 },
      { id: 'esophagus', name: 'Esophagus', description: 'Muscular tube. Peristalsis pushes food to stomach.', x: 150, y: 100 },
      { id: 'stomach', name: 'Stomach', description: 'Acid + pepsin digest proteins. Food becomes chyme.', x: 150, y: 170 },
      { id: 'small_intestine', name: 'Small Intestine', description: 'Most nutrient absorption. Villi give huge surface area.', x: 140, y: 290 },
      { id: 'large_intestine', name: 'Large Intestine', description: 'Absorbs water. Forms feces for excretion.', x: 170, y: 330 },
    ],
  },
];

export default function DiagramExplorer() {
  const [selected, setSelected] = useState<Diagram>(DIAGRAMS[0]);
  const [clicked, setClicked] = useState<Label | null>(null);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-bold">🔖 Labeled Diagram Explorer</h3>
        <select
          value={selected.id}
          onChange={(e) => { setSelected(DIAGRAMS.find((d) => d.id === e.target.value) || DIAGRAMS[0]); setClicked(null); }}
          aria-label="Select diagram"
          className="border border-gray-200 dark:border-gray-800 rounded px-2 py-1 text-sm bg-white dark:bg-gray-950"
        >
          {DIAGRAMS.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
        </select>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <svg viewBox={selected.viewBox} className="w-full" style={{ maxHeight: 320 }}>
            <g dangerouslySetInnerHTML={{ __html: selected.svg }} />
            {selected.labels.map((l) => (
              <g key={l.id} onClick={() => setClicked(l)} style={{ cursor: 'pointer' }}>
                <circle cx={l.x} cy={l.y} r={8} fill={clicked?.id === l.id ? '#6366f1' : '#fff'} stroke="#1f2937" strokeWidth="2" />
                <text x={l.x} y={l.y + 3} textAnchor="middle" fontSize="9" fontWeight="bold" fill={clicked?.id === l.id ? '#fff' : '#1f2937'}>
                  {selected.labels.indexOf(l) + 1}
                </text>
              </g>
            ))}
          </svg>
        </div>
        <div>
          {clicked ? (
            <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
              <h4 className="font-bold mb-2">{clicked.name}</h4>
              <p className="text-sm text-gray-700 dark:text-gray-300">{clicked.description}</p>
            </div>
          ) : (
            <div className="p-4 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800">
              <p className="text-sm text-gray-500">Click a numbered dot on the diagram to learn about that part.</p>
              <ol className="mt-2 text-xs space-y-1 list-decimal pl-5">
                {selected.labels.map((l) => <li key={l.id}>{l.name}</li>)}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
