'use client';

import { useState } from 'react';
import { ELEMENTS, CATEGORY_COLORS, type Element } from '@/lib/periodic-table';

/** Interactive periodic table with click-to-inspect + search */

export default function PeriodicTable() {
  const [selected, setSelected] = useState<Element | null>(null);
  const [search, setSearch] = useState('');

  const filtered = search ? ELEMENTS.filter((e) =>
    e.symbol.toLowerCase().includes(search.toLowerCase()) ||
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.z.toString() === search,
  ) : ELEMENTS;
  const matchSet = new Set(filtered.map((e) => e.z));

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-bold">🧪 Periodic Table</h3>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by symbol, name, or Z…"
          aria-label="Search elements"
          className="border border-gray-200 dark:border-gray-800 rounded px-2 py-1 text-sm bg-white dark:bg-gray-950"
        />
      </div>

      <div className="overflow-x-auto">
        <div className="grid gap-[2px] min-w-[900px]" style={{ gridTemplateColumns: 'repeat(18, minmax(0, 1fr))' }}>
          {ELEMENTS.map((el) => {
            const highlighted = search === '' || matchSet.has(el.z);
            return (
              <button
                key={el.z}
                type="button"
                onClick={() => setSelected(el)}
                aria-label={`${el.name} (${el.symbol})`}
                title={el.name}
                className={`aspect-square flex flex-col items-center justify-center rounded text-[10px] transition-opacity ${highlighted ? 'opacity-100' : 'opacity-25'}`}
                style={{
                  gridRow: el.row,
                  gridColumn: el.col,
                  backgroundColor: CATEGORY_COLORS[el.category] || CATEGORY_COLORS.unknown,
                  color: '#1f2937',
                }}
              >
                <span className="text-[8px] opacity-70">{el.z}</span>
                <span className="font-bold text-xs">{el.symbol}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
          <span key={cat} className="flex items-center gap-1 capitalize">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
            {cat}
          </span>
        ))}
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="mt-4 p-4 rounded-lg border-2" style={{ backgroundColor: CATEGORY_COLORS[selected.category] + '40', borderColor: CATEGORY_COLORS[selected.category] }}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-4xl font-black">{selected.symbol}</div>
              <div className="text-lg font-semibold">{selected.name}</div>
            </div>
            <button type="button" onClick={() => setSelected(null)} aria-label="Close" className="text-gray-500 text-2xl">×</button>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div><dt className="inline text-gray-500">Z:</dt> <dd className="inline font-semibold">{selected.z}</dd></div>
            <div><dt className="inline text-gray-500">Mass:</dt> <dd className="inline font-semibold">{selected.mass}</dd></div>
            <div><dt className="inline text-gray-500">Group:</dt> <dd className="inline font-semibold">{selected.group ?? '—'}</dd></div>
            <div><dt className="inline text-gray-500">Period:</dt> <dd className="inline font-semibold">{selected.period}</dd></div>
            <div><dt className="inline text-gray-500">Category:</dt> <dd className="inline font-semibold capitalize">{selected.category}</dd></div>
            <div><dt className="inline text-gray-500">Phase:</dt> <dd className="inline font-semibold capitalize">{selected.phase}</dd></div>
            <div className="col-span-2"><dt className="inline text-gray-500">Configuration:</dt> <dd className="inline font-mono font-semibold">{selected.ec}</dd></div>
          </dl>
        </div>
      )}
    </div>
  );
}
