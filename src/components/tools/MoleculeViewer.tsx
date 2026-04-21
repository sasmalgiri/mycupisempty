'use client';

/**
 * MoleculeViewer — simple 2D molecular structure renderer.
 * Reads a compact format and draws atoms as colored circles connected by bonds.
 *
 * Extensible: replace with 3Dmol.js / jsmol for 3D later. For now 2D is
 * sufficient for K-12 (water, methane, CO2, ethanol, etc.)
 */

import { useState } from 'react';

interface Atom { symbol: string; x: number; y: number; }
interface Bond { a: number; b: number; order: 1 | 2 | 3; }
interface Molecule { name: string; formula: string; atoms: Atom[]; bonds: Bond[]; }

const ATOM_COLORS: Record<string, string> = {
  H: '#d1d5db', C: '#1f2937', O: '#dc2626', N: '#2563eb',
  S: '#eab308', P: '#ea580c', F: '#16a34a', Cl: '#16a34a',
  Br: '#a16207', Na: '#8b5cf6', K: '#8b5cf6', Ca: '#059669',
};

const ATOM_RADIUS: Record<string, number> = {
  H: 8, C: 12, O: 12, N: 12, S: 14, P: 14, F: 12, Cl: 14, Br: 16,
};

const MOLECULES: Record<string, Molecule> = {
  water: {
    name: 'Water', formula: 'H₂O',
    atoms: [{ symbol: 'O', x: 150, y: 100 }, { symbol: 'H', x: 100, y: 140 }, { symbol: 'H', x: 200, y: 140 }],
    bonds: [{ a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 }],
  },
  methane: {
    name: 'Methane', formula: 'CH₄',
    atoms: [
      { symbol: 'C', x: 150, y: 100 },
      { symbol: 'H', x: 100, y: 60 }, { symbol: 'H', x: 200, y: 60 },
      { symbol: 'H', x: 100, y: 140 }, { symbol: 'H', x: 200, y: 140 },
    ],
    bonds: [{ a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 }, { a: 0, b: 3, order: 1 }, { a: 0, b: 4, order: 1 }],
  },
  co2: {
    name: 'Carbon Dioxide', formula: 'CO₂',
    atoms: [{ symbol: 'C', x: 150, y: 100 }, { symbol: 'O', x: 80, y: 100 }, { symbol: 'O', x: 220, y: 100 }],
    bonds: [{ a: 0, b: 1, order: 2 }, { a: 0, b: 2, order: 2 }],
  },
  ammonia: {
    name: 'Ammonia', formula: 'NH₃',
    atoms: [
      { symbol: 'N', x: 150, y: 100 },
      { symbol: 'H', x: 90, y: 70 }, { symbol: 'H', x: 210, y: 70 }, { symbol: 'H', x: 150, y: 160 },
    ],
    bonds: [{ a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 }, { a: 0, b: 3, order: 1 }],
  },
  ethanol: {
    name: 'Ethanol', formula: 'C₂H₆O',
    atoms: [
      { symbol: 'C', x: 90, y: 100 }, { symbol: 'C', x: 150, y: 100 },
      { symbol: 'O', x: 210, y: 100 }, { symbol: 'H', x: 260, y: 100 },
      { symbol: 'H', x: 60, y: 70 }, { symbol: 'H', x: 60, y: 130 },
      { symbol: 'H', x: 90, y: 150 }, { symbol: 'H', x: 150, y: 60 }, { symbol: 'H', x: 150, y: 150 },
    ],
    bonds: [
      { a: 0, b: 1, order: 1 }, { a: 1, b: 2, order: 1 }, { a: 2, b: 3, order: 1 },
      { a: 0, b: 4, order: 1 }, { a: 0, b: 5, order: 1 }, { a: 0, b: 6, order: 1 },
      { a: 1, b: 7, order: 1 }, { a: 1, b: 8, order: 1 },
    ],
  },
  glucose: {
    name: 'Glucose (simplified)', formula: 'C₆H₁₂O₆',
    atoms: [
      { symbol: 'C', x: 80, y: 120 }, { symbol: 'C', x: 130, y: 90 },
      { symbol: 'C', x: 180, y: 120 }, { symbol: 'C', x: 180, y: 170 },
      { symbol: 'O', x: 130, y: 195 }, { symbol: 'C', x: 80, y: 170 },
      { symbol: 'O', x: 230, y: 100 }, { symbol: 'O', x: 50, y: 80 },
    ],
    bonds: [
      { a: 0, b: 1, order: 1 }, { a: 1, b: 2, order: 1 }, { a: 2, b: 3, order: 1 },
      { a: 3, b: 4, order: 1 }, { a: 4, b: 5, order: 1 }, { a: 5, b: 0, order: 1 },
      { a: 2, b: 6, order: 1 }, { a: 0, b: 7, order: 1 },
    ],
  },
};

export default function MoleculeViewer() {
  const [selected, setSelected] = useState<string>('water');
  const mol = MOLECULES[selected];

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-bold">🧬 Molecule Viewer</h3>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          aria-label="Select molecule"
          className="border border-gray-200 dark:border-gray-800 rounded px-2 py-1 text-sm bg-white dark:bg-gray-950"
        >
          {Object.entries(MOLECULES).map(([key, m]) => (
            <option key={key} value={key}>{m.name} ({m.formula})</option>
          ))}
        </select>
      </div>

      <div className="bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 p-2">
        <svg viewBox="0 0 300 250" className="w-full" style={{ maxHeight: 320 }}>
          {/* Bonds */}
          {mol.bonds.map((b, i) => {
            const a1 = mol.atoms[b.a];
            const a2 = mol.atoms[b.b];
            const offset = b.order === 2 ? 3 : b.order === 3 ? 6 : 0;
            return (
              <g key={i}>
                <line x1={a1.x} y1={a1.y} x2={a2.x} y2={a2.y} stroke="#374151" strokeWidth="2" />
                {b.order >= 2 && (
                  <line
                    x1={a1.x + offset} y1={a1.y + offset}
                    x2={a2.x + offset} y2={a2.y + offset}
                    stroke="#374151" strokeWidth="2"
                  />
                )}
                {b.order === 3 && (
                  <line
                    x1={a1.x - offset} y1={a1.y - offset}
                    x2={a2.x - offset} y2={a2.y - offset}
                    stroke="#374151" strokeWidth="2"
                  />
                )}
              </g>
            );
          })}
          {/* Atoms */}
          {mol.atoms.map((a, i) => (
            <g key={i}>
              <circle
                cx={a.x} cy={a.y}
                r={ATOM_RADIUS[a.symbol] || 12}
                fill={ATOM_COLORS[a.symbol] || '#6b7280'}
                stroke="#000" strokeWidth="0.5"
              />
              <text
                x={a.x} y={a.y + 4}
                textAnchor="middle" fontSize="11" fontWeight="bold"
                fill={a.symbol === 'C' || a.symbol === 'N' ? '#fff' : '#000'}
                style={{ pointerEvents: 'none' }}
              >{a.symbol}</text>
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        {Array.from(new Set(mol.atoms.map((a) => a.symbol))).map((s) => (
          <span key={s} className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: ATOM_COLORS[s] || '#6b7280' }} />
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
