'use client';

import { useState } from 'react';

/**
 * ReactionBalancer — balances chemical equations up to reasonable complexity.
 * Uses a simple brute-force search over small integer coefficients.
 *
 * Input format: "H2 + O2 = H2O" or "Fe + HCl -> FeCl3 + H2"
 */

interface ParsedMol {
  raw: string;
  formula: Record<string, number>;   // element → count
}

function parseFormula(text: string): Record<string, number> {
  const counts: Record<string, number> = {};
  // Match: element (1-2 letters) + optional digits, or parentheses groups
  const stack: Record<string, number>[] = [{}];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '(') { stack.push({}); i++; continue; }
    if (c === ')') {
      i++;
      let num = '';
      while (i < text.length && /\d/.test(text[i])) { num += text[i]; i++; }
      const mult = num ? parseInt(num, 10) : 1;
      const top = stack.pop()!;
      const prev = stack[stack.length - 1];
      for (const [el, n] of Object.entries(top)) {
        prev[el] = (prev[el] || 0) + n * mult;
      }
      continue;
    }
    if (/[A-Z]/.test(c)) {
      let sym = c;
      i++;
      if (i < text.length && /[a-z]/.test(text[i])) { sym += text[i]; i++; }
      let num = '';
      while (i < text.length && /\d/.test(text[i])) { num += text[i]; i++; }
      const n = num ? parseInt(num, 10) : 1;
      stack[stack.length - 1][sym] = (stack[stack.length - 1][sym] || 0) + n;
      continue;
    }
    // Skip any unexpected char
    i++;
  }
  return stack[0];
}

function parseEquation(eq: string): { reactants: ParsedMol[]; products: ParsedMol[] } {
  // Normalize arrows
  const normalized = eq.replace(/->|→|=/g, ' → ');
  const parts = normalized.split('→');
  if (parts.length !== 2) throw new Error('Equation must have exactly one = or → separator');
  const splitSide = (s: string): ParsedMol[] =>
    s.split('+').map((m) => ({ raw: m.trim(), formula: parseFormula(m.trim()) })).filter((m) => m.raw);
  return { reactants: splitSide(parts[0]), products: splitSide(parts[1]) };
}

function gcd(a: number, b: number): number { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }
function gcdArr(arr: number[]): number { return arr.reduce((g, x) => gcd(g, x), arr[0] || 1); }

function balanceBrute(reactants: ParsedMol[], products: ParsedMol[], maxCoeff = 10): number[] | null {
  const mols = [...reactants, ...products];
  const nReactants = reactants.length;
  const total = mols.length;

  // Collect all elements
  const elementsSet = new Set<string>();
  for (const m of mols) for (const el of Object.keys(m.formula)) elementsSet.add(el);
  const elements = Array.from(elementsSet);

  // Brute force over coefficient tuples up to maxCoeff
  const coeffs = new Array(total).fill(1);
  const check = (c: number[]): boolean => {
    for (const el of elements) {
      let lhs = 0, rhs = 0;
      for (let i = 0; i < nReactants; i++) lhs += (mols[i].formula[el] || 0) * c[i];
      for (let i = nReactants; i < total; i++) rhs += (mols[i].formula[el] || 0) * c[i];
      if (lhs !== rhs) return false;
    }
    return true;
  };

  // Search ordered by sum of coefficients so we find the smallest solution first
  for (let sum = total; sum <= total * maxCoeff; sum++) {
    const found = searchSum(coeffs, 0, sum, maxCoeff, check);
    if (found) return found;
  }
  return null;
}

function searchSum(buf: number[], idx: number, remaining: number, maxCoeff: number, check: (c: number[]) => boolean): number[] | null {
  if (idx === buf.length) {
    if (remaining !== 0) return null;
    if (check(buf)) {
      const g = gcdArr(buf);
      return buf.map((x) => x / g);
    }
    return null;
  }
  const maxHere = Math.min(maxCoeff, remaining - (buf.length - idx - 1));
  for (let v = 1; v <= maxHere; v++) {
    buf[idx] = v;
    const res = searchSum(buf, idx + 1, remaining - v, maxCoeff, check);
    if (res) return res;
  }
  return null;
}

export default function ReactionBalancer() {
  const [input, setInput] = useState('H2 + O2 = H2O');
  const [result, setResult] = useState<{ coeffs: number[]; reactants: ParsedMol[]; products: ParsedMol[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const balance = () => {
    setError(null);
    setResult(null);
    try {
      const { reactants, products } = parseEquation(input);
      if (reactants.length === 0 || products.length === 0) throw new Error('Both sides must have at least one compound');
      const coeffs = balanceBrute(reactants, products);
      if (!coeffs) throw new Error('Could not balance this equation (try simpler coefficients)');
      setResult({ coeffs, reactants, products });
    } catch (e: any) {
      setError(e.message);
    }
  };

  const formatSide = (mols: ParsedMol[], coeffs: number[], offset: number): string =>
    mols.map((m, i) => {
      const c = coeffs[offset + i];
      return (c === 1 ? '' : c) + m.raw;
    }).join(' + ');

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
      <h3 className="font-bold mb-3">⚗️ Reaction Balancer</h3>
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="H2 + O2 = H2O"
          aria-label="Chemical equation"
          className="flex-1 border border-gray-200 dark:border-gray-800 rounded px-3 py-2 font-mono bg-white dark:bg-gray-950"
        />
        <button
          type="button"
          onClick={balance}
          aria-label="Balance"
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded font-semibold"
        >Balance</button>
      </div>
      <p className="text-xs text-gray-500 mb-3">Use element symbols with counts: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">H2</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">Ca(OH)2</code>. Separate with + and use = or →.</p>

      {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded text-sm text-red-700">{error}</div>}
      {result && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 rounded-lg">
          <p className="font-mono text-lg">
            {formatSide(result.reactants, result.coeffs, 0)} → {formatSide(result.products, result.coeffs, result.reactants.length)}
          </p>
          <p className="text-xs text-gray-600 mt-2">Coefficients: {result.coeffs.join(', ')}</p>
        </div>
      )}
    </div>
  );
}
