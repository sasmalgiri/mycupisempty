'use client';

import { useState } from 'react';
import { evalExpression } from '@/lib/expr';

/**
 * Scientific Calculator with history + keyboard + expression mode.
 */

interface HistoryEntry { expr: string; result: string; }

const BUTTONS: Array<{ label: string; insert?: string; action?: string; className?: string }> = [
  { label: 'C', action: 'clear', className: 'bg-red-100 text-red-700 dark:bg-red-900/40' },
  { label: '(', insert: '(' }, { label: ')', insert: ')' },
  { label: '÷', insert: '/' },
  { label: 'sin', insert: 'sin(' }, { label: 'cos', insert: 'cos(' }, { label: 'tan', insert: 'tan(' },
  { label: '×', insert: '*' },
  { label: 'ln', insert: 'ln(' }, { label: 'log', insert: 'log(' }, { label: '√', insert: 'sqrt(' },
  { label: '−', insert: '-' },
  { label: 'π', insert: 'pi' }, { label: 'e', insert: 'e' }, { label: '^', insert: '^' },
  { label: '+', insert: '+' },
  { label: '7', insert: '7' }, { label: '8', insert: '8' }, { label: '9', insert: '9' },
  { label: '%', insert: '%' },
  { label: '4', insert: '4' }, { label: '5', insert: '5' }, { label: '6', insert: '6' },
  { label: '!', insert: '!' },
  { label: '1', insert: '1' }, { label: '2', insert: '2' }, { label: '3', insert: '3' },
  { label: 'Ans', action: 'ans' },
  { label: '0', insert: '0' }, { label: '.', insert: '.' },
  { label: '=', action: 'equals', className: 'bg-primary-600 text-white col-span-2' },
];

export default function ScientificCalculator() {
  const [expr, setExpr] = useState('');
  const [result, setResult] = useState('0');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const press = (b: typeof BUTTONS[0]) => {
    setError(null);
    if (b.action === 'clear') { setExpr(''); setResult('0'); return; }
    if (b.action === 'ans') { setExpr(expr + result); return; }
    if (b.action === 'equals') {
      try {
        // Replace factorial
        const processed = expr.replace(/(\d+(?:\.\d+)?|\))!/g, 'factorial($1)');
        const r = evalExpression(processed.includes('factorial')
          ? processed.replace(/factorial\(([^)]+)\)/g, (_, v) => String(factorial(Number(v))))
          : processed);
        if (!isFinite(r)) throw new Error('Undefined');
        const str = formatResult(r);
        setResult(str);
        setHistory((h) => [{ expr, result: str }, ...h].slice(0, 10));
      } catch (e: any) { setError(e.message || 'Invalid expression'); }
      return;
    }
    if (b.insert) setExpr(expr + b.insert);
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
      <h3 className="font-bold mb-3">🧮 Scientific Calculator</h3>

      <input
        type="text"
        value={expr}
        onChange={(e) => { setExpr(e.target.value); setError(null); }}
        placeholder="Type or tap buttons…"
        aria-label="Expression"
        className="w-full text-right font-mono text-lg border border-gray-200 dark:border-gray-800 rounded px-3 py-2 bg-gray-50 dark:bg-gray-950 mb-1"
      />
      <div className="text-right font-mono text-2xl font-bold text-primary-700 dark:text-primary-300 mb-3 min-h-[32px]">
        {error ? <span className="text-red-500 text-sm">{error}</span> : result}
      </div>

      <div className="grid grid-cols-5 gap-1">
        {BUTTONS.map((b, i) => (
          <button
            key={i}
            type="button"
            onClick={() => press(b)}
            aria-label={b.label}
            className={`px-2 py-2 rounded-lg text-sm font-semibold transition-colors ${b.className || 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
          >{b.label}</button>
        ))}
      </div>

      {history.length > 0 && (
        <div className="mt-3 border-t border-gray-100 dark:border-gray-800 pt-2">
          <div className="text-xs text-gray-500 mb-1">History</div>
          <ul className="text-xs space-y-0.5 max-h-24 overflow-y-auto">
            {history.map((h, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="font-mono text-gray-600 dark:text-gray-400 truncate">{h.expr}</span>
                <span className="font-mono font-semibold">= {h.result}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) return NaN;
  if (n > 170) return Infinity;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function formatResult(n: number): string {
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return n.toString();
  if (Math.abs(n) < 1e-6 || Math.abs(n) >= 1e10) return n.toExponential(6);
  return n.toPrecision(10).replace(/\.?0+$/, '');
}
