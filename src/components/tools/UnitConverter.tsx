'use client';

import { useState } from 'react';

/** UnitConverter — length / mass / temperature / energy / speed / area / volume / time / pressure */

interface UnitDef { key: string; label: string; toBase: (v: number) => number; fromBase: (v: number) => number; }

type Category = 'length' | 'mass' | 'temperature' | 'energy' | 'speed' | 'area' | 'volume' | 'time' | 'pressure';

const UNITS: Record<Category, { base: string; units: UnitDef[] }> = {
  length: {
    base: 'meter',
    units: [
      { key: 'm',  label: 'meter',      toBase: v => v,           fromBase: v => v },
      { key: 'cm', label: 'centimeter', toBase: v => v / 100,     fromBase: v => v * 100 },
      { key: 'mm', label: 'millimeter', toBase: v => v / 1000,    fromBase: v => v * 1000 },
      { key: 'km', label: 'kilometer', toBase: v => v * 1000,    fromBase: v => v / 1000 },
      { key: 'in', label: 'inch',      toBase: v => v * 0.0254,  fromBase: v => v / 0.0254 },
      { key: 'ft', label: 'foot',      toBase: v => v * 0.3048,  fromBase: v => v / 0.3048 },
      { key: 'yd', label: 'yard',      toBase: v => v * 0.9144,  fromBase: v => v / 0.9144 },
      { key: 'mi', label: 'mile',      toBase: v => v * 1609.34, fromBase: v => v / 1609.34 },
    ],
  },
  mass: {
    base: 'kilogram',
    units: [
      { key: 'kg', label: 'kilogram', toBase: v => v,         fromBase: v => v },
      { key: 'g',  label: 'gram',     toBase: v => v / 1000,  fromBase: v => v * 1000 },
      { key: 'mg', label: 'milligram', toBase: v => v / 1e6,  fromBase: v => v * 1e6 },
      { key: 't',  label: 'tonne',    toBase: v => v * 1000,  fromBase: v => v / 1000 },
      { key: 'lb', label: 'pound',    toBase: v => v * 0.4536,fromBase: v => v / 0.4536 },
      { key: 'oz', label: 'ounce',    toBase: v => v * 0.02835, fromBase: v => v / 0.02835 },
    ],
  },
  temperature: {
    base: 'kelvin',
    units: [
      { key: 'C', label: 'Celsius',    toBase: v => v + 273.15,         fromBase: v => v - 273.15 },
      { key: 'F', label: 'Fahrenheit', toBase: v => (v - 32) * 5/9 + 273.15, fromBase: v => (v - 273.15) * 9/5 + 32 },
      { key: 'K', label: 'Kelvin',     toBase: v => v,                   fromBase: v => v },
    ],
  },
  energy: {
    base: 'joule',
    units: [
      { key: 'J',   label: 'joule',       toBase: v => v,          fromBase: v => v },
      { key: 'kJ',  label: 'kilojoule',   toBase: v => v * 1000,   fromBase: v => v / 1000 },
      { key: 'cal', label: 'calorie',     toBase: v => v * 4.184,  fromBase: v => v / 4.184 },
      { key: 'kcal',label: 'kilocalorie', toBase: v => v * 4184,   fromBase: v => v / 4184 },
      { key: 'Wh',  label: 'watt-hour',   toBase: v => v * 3600,   fromBase: v => v / 3600 },
      { key: 'kWh', label: 'kilowatt-hour', toBase: v => v * 3.6e6, fromBase: v => v / 3.6e6 },
      { key: 'eV',  label: 'electron-volt', toBase: v => v * 1.602e-19, fromBase: v => v / 1.602e-19 },
    ],
  },
  speed: {
    base: 'm/s',
    units: [
      { key: 'm/s',  label: 'meters/sec',     toBase: v => v,           fromBase: v => v },
      { key: 'km/h', label: 'km/hour',        toBase: v => v / 3.6,     fromBase: v => v * 3.6 },
      { key: 'mph',  label: 'miles/hour',     toBase: v => v * 0.4470,  fromBase: v => v / 0.4470 },
      { key: 'knot', label: 'knot',           toBase: v => v * 0.5144,  fromBase: v => v / 0.5144 },
    ],
  },
  area: {
    base: 'm²',
    units: [
      { key: 'm2',  label: 'm²',      toBase: v => v,          fromBase: v => v },
      { key: 'cm2', label: 'cm²',     toBase: v => v / 1e4,    fromBase: v => v * 1e4 },
      { key: 'km2', label: 'km²',     toBase: v => v * 1e6,    fromBase: v => v / 1e6 },
      { key: 'ha',  label: 'hectare', toBase: v => v * 1e4,    fromBase: v => v / 1e4 },
      { key: 'ac',  label: 'acre',    toBase: v => v * 4046.86,fromBase: v => v / 4046.86 },
    ],
  },
  volume: {
    base: 'liter',
    units: [
      { key: 'L',   label: 'liter',      toBase: v => v,           fromBase: v => v },
      { key: 'mL',  label: 'milliliter', toBase: v => v / 1000,    fromBase: v => v * 1000 },
      { key: 'm3',  label: 'm³',         toBase: v => v * 1000,    fromBase: v => v / 1000 },
      { key: 'gal', label: 'US gallon',  toBase: v => v * 3.78541, fromBase: v => v / 3.78541 },
    ],
  },
  time: {
    base: 'second',
    units: [
      { key: 's',   label: 'second', toBase: v => v,        fromBase: v => v },
      { key: 'min', label: 'minute', toBase: v => v * 60,   fromBase: v => v / 60 },
      { key: 'h',   label: 'hour',   toBase: v => v * 3600, fromBase: v => v / 3600 },
      { key: 'd',   label: 'day',    toBase: v => v * 86400,fromBase: v => v / 86400 },
    ],
  },
  pressure: {
    base: 'pascal',
    units: [
      { key: 'Pa',  label: 'pascal',     toBase: v => v,          fromBase: v => v },
      { key: 'kPa', label: 'kilopascal', toBase: v => v * 1000,   fromBase: v => v / 1000 },
      { key: 'bar', label: 'bar',        toBase: v => v * 100000, fromBase: v => v / 100000 },
      { key: 'atm', label: 'atmosphere', toBase: v => v * 101325, fromBase: v => v / 101325 },
      { key: 'psi', label: 'psi',        toBase: v => v * 6894.76,fromBase: v => v / 6894.76 },
    ],
  },
};

export default function UnitConverter() {
  const [cat, setCat] = useState<Category>('length');
  const [value, setValue] = useState<string>('1');
  const [from, setFrom] = useState(UNITS.length.units[0].key);
  const [to, setTo] = useState(UNITS.length.units[1].key);

  const units = UNITS[cat].units;
  const fromUnit = units.find(u => u.key === from) || units[0];
  const toUnit = units.find(u => u.key === to) || units[0];
  const numValue = parseFloat(value);
  const result = !isNaN(numValue) ? toUnit.fromBase(fromUnit.toBase(numValue)) : NaN;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
      <h3 className="font-bold mb-3">📏 Unit Converter</h3>
      <div className="flex flex-wrap gap-1 mb-3">
        {(Object.keys(UNITS) as Category[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setCat(c);
              setFrom(UNITS[c].units[0].key);
              setTo(UNITS[c].units[1]?.key || UNITS[c].units[0].key);
            }}
            aria-label={c}
            className={`px-3 py-1 rounded text-xs font-medium capitalize ${cat === c ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}
          >{c}</button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Value"
          className="w-24 border border-gray-200 dark:border-gray-800 rounded px-2 py-1 bg-white dark:bg-gray-950"
        />
        <select value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From unit" className="border border-gray-200 dark:border-gray-800 rounded px-2 py-1 bg-white dark:bg-gray-950 text-sm">
          {units.map(u => <option key={u.key} value={u.key}>{u.label}</option>)}
        </select>
        <span>=</span>
        <div className="flex-1 text-right font-mono font-bold text-lg text-primary-700 dark:text-primary-300">
          {isNaN(result) ? '—' : formatResult(result)}
        </div>
        <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="To unit" className="border border-gray-200 dark:border-gray-800 rounded px-2 py-1 bg-white dark:bg-gray-950 text-sm">
          {units.map(u => <option key={u.key} value={u.key}>{u.label}</option>)}
        </select>
      </div>
    </div>
  );
}

function formatResult(n: number): string {
  if (Math.abs(n) < 0.0001 || Math.abs(n) >= 1e9) return n.toExponential(4);
  return n.toPrecision(6).replace(/\.?0+$/, '');
}
