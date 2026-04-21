'use client';

/**
 * ChartBuilder — simple bar / line / pie chart from tabular input.
 * No deps — raw SVG. Good for economics/statistics class.
 */

import { useMemo, useState } from 'react';

type ChartType = 'bar' | 'line' | 'pie';

interface Row { label: string; value: number; }

const COLORS = ['#6366f1', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16'];

export default function ChartBuilder() {
  const [type, setType] = useState<ChartType>('bar');
  const [title, setTitle] = useState('Monthly rainfall (mm)');
  const [rawData, setRawData] = useState(`Jan, 45
Feb, 32
Mar, 28
Apr, 15
May, 8
Jun, 120
Jul, 280
Aug, 250
Sep, 150
Oct, 60
Nov, 30
Dec, 20`);

  const rows: Row[] = useMemo(() => {
    return rawData.split('\n')
      .map((line) => {
        const parts = line.split(/[,\t]/).map((s) => s.trim());
        if (parts.length < 2) return null;
        const v = parseFloat(parts[1]);
        if (isNaN(v)) return null;
        return { label: parts[0], value: v };
      })
      .filter((r): r is Row => r !== null);
  }, [rawData]);

  const maxValue = Math.max(...rows.map((r) => r.value), 1);
  const total = rows.reduce((s, r) => s + r.value, 0);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-bold">📊 Data Chart Builder</h3>
        <div className="flex gap-1">
          {(['bar', 'line', 'pie'] as ChartType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              aria-label={t}
              className={`px-3 py-1 text-xs font-medium rounded capitalize ${type === t ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}
            >{t}</button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Chart title"
            aria-label="Chart title"
            className="w-full border border-gray-200 dark:border-gray-800 rounded px-2 py-1 text-sm mb-2 bg-white dark:bg-gray-950"
          />
          <textarea
            value={rawData}
            onChange={(e) => setRawData(e.target.value)}
            placeholder="Label, Value (one per line)"
            aria-label="Data"
            rows={10}
            className="w-full border border-gray-200 dark:border-gray-800 rounded px-2 py-1 text-sm font-mono bg-white dark:bg-gray-950"
          />
          <p className="text-xs text-gray-500 mt-1">One row per line: <code>Label, Value</code></p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <h4 className="text-sm font-semibold mb-2 text-center">{title}</h4>
          {rows.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">Enter data to see the chart.</p>
          ) : type === 'bar' ? (
            <svg viewBox={`0 0 ${Math.max(320, rows.length * 40)} 240`} className="w-full">
              {rows.map((r, i) => {
                const barH = (r.value / maxValue) * 180;
                const x = 20 + i * ((Math.max(320, rows.length * 40) - 40) / rows.length);
                const w = ((Math.max(320, rows.length * 40) - 40) / rows.length) - 6;
                return (
                  <g key={i}>
                    <rect x={x} y={200 - barH} width={w} height={barH} fill={COLORS[i % COLORS.length]} />
                    <text x={x + w / 2} y={215} textAnchor="middle" fontSize="9" fill="#6b7280">{r.label}</text>
                    <text x={x + w / 2} y={195 - barH} textAnchor="middle" fontSize="9" fontWeight="600">{r.value}</text>
                  </g>
                );
              })}
              <line x1="20" y1="200" x2={Math.max(320, rows.length * 40) - 20} y2="200" stroke="#6b7280" />
            </svg>
          ) : type === 'line' ? (
            <svg viewBox={`0 0 ${Math.max(320, rows.length * 40)} 240`} className="w-full">
              {rows.map((r, i) => {
                const x = 20 + i * ((Math.max(320, rows.length * 40) - 40) / Math.max(1, rows.length - 1));
                const y = 200 - (r.value / maxValue) * 180;
                return (
                  <g key={i}>
                    <circle cx={x} cy={y} r={3} fill={COLORS[0]} />
                    <text x={x} y={215} textAnchor="middle" fontSize="9" fill="#6b7280">{r.label}</text>
                  </g>
                );
              })}
              <polyline
                points={rows.map((r, i) => {
                  const x = 20 + i * ((Math.max(320, rows.length * 40) - 40) / Math.max(1, rows.length - 1));
                  const y = 200 - (r.value / maxValue) * 180;
                  return `${x},${y}`;
                }).join(' ')}
                fill="none"
                stroke={COLORS[0]}
                strokeWidth="2"
              />
              <line x1="20" y1="200" x2={Math.max(320, rows.length * 40) - 20} y2="200" stroke="#6b7280" />
            </svg>
          ) : (
            <svg viewBox="0 0 320 240" className="w-full">
              {(() => {
                let start = -Math.PI / 2;
                return rows.map((r, i) => {
                  const frac = r.value / total;
                  const end = start + frac * Math.PI * 2;
                  const x1 = 160 + 80 * Math.cos(start);
                  const y1 = 120 + 80 * Math.sin(start);
                  const x2 = 160 + 80 * Math.cos(end);
                  const y2 = 120 + 80 * Math.sin(end);
                  const largeArc = frac > 0.5 ? 1 : 0;
                  const path = `M 160 120 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z`;
                  const midAngle = (start + end) / 2;
                  const lx = 160 + 55 * Math.cos(midAngle);
                  const ly = 120 + 55 * Math.sin(midAngle);
                  start = end;
                  return (
                    <g key={i}>
                      <path d={path} fill={COLORS[i % COLORS.length]} stroke="#fff" strokeWidth="1.5" />
                      {frac > 0.05 && (
                        <text x={lx} y={ly} textAnchor="middle" fontSize="10" fontWeight="600" fill="#fff">
                          {(frac * 100).toFixed(0)}%
                        </text>
                      )}
                    </g>
                  );
                });
              })()}
              {rows.map((r, i) => (
                <g key={`lg-${i}`}>
                  <rect x={260} y={20 + i * 16} width={10} height={10} fill={COLORS[i % COLORS.length]} />
                  <text x={275} y={29 + i * 16} fontSize="9" fill="#1f2937">{r.label}</text>
                </g>
              ))}
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
