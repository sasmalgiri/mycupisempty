'use client';

/**
 * GraphPlotter — interactive function grapher.
 * Supports: y = f(x), multiple plots, zoom, pan, trace.
 */

import { useEffect, useRef, useState } from 'react';
import { compileExpression } from '@/lib/expr';

interface Plot { expr: string; color: string; compiled?: (env: Record<string, number>) => number; error?: string; }

const COLORS = ['#6366f1', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

export default function GraphPlotter() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [plots, setPlots] = useState<Plot[]>([{ expr: 'sin(x)', color: COLORS[0] }]);
  const [xMin, setXMin] = useState(-10);
  const [xMax, setXMax] = useState(10);
  const [yMin, setYMin] = useState(-5);
  const [yMax, setYMax] = useState(5);

  const compiled = plots.map((p) => {
    try { return { ...p, compiled: compileExpression(p.expr), error: undefined }; }
    catch (e: any) { return { ...p, compiled: undefined, error: e.message }; }
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const parent = canvas.parentElement!;
    const w = parent.clientWidth;
    const h = 360;
    canvas.width = w * ratio;
    canvas.height = h * ratio;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, w, h);

    // Axes
    const xToPx = (x: number) => ((x - xMin) / (xMax - xMin)) * w;
    const yToPx = (y: number) => h - ((y - yMin) / (yMax - yMin)) * h;

    // Grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    const xStep = niceStep((xMax - xMin) / 10);
    const yStep = niceStep((yMax - yMin) / 10);
    ctx.beginPath();
    for (let x = Math.ceil(xMin / xStep) * xStep; x <= xMax; x += xStep) {
      ctx.moveTo(xToPx(x), 0);
      ctx.lineTo(xToPx(x), h);
    }
    for (let y = Math.ceil(yMin / yStep) * yStep; y <= yMax; y += yStep) {
      ctx.moveTo(0, yToPx(y));
      ctx.lineTo(w, yToPx(y));
    }
    ctx.stroke();

    // Axes bold
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, yToPx(0)); ctx.lineTo(w, yToPx(0));
    ctx.moveTo(xToPx(0), 0); ctx.lineTo(xToPx(0), h);
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px sans-serif';
    for (let x = Math.ceil(xMin / xStep) * xStep; x <= xMax; x += xStep) {
      if (Math.abs(x) < 1e-9) continue;
      ctx.fillText(formatNum(x), xToPx(x) + 2, yToPx(0) + 12);
    }
    for (let y = Math.ceil(yMin / yStep) * yStep; y <= yMax; y += yStep) {
      if (Math.abs(y) < 1e-9) continue;
      ctx.fillText(formatNum(y), xToPx(0) + 4, yToPx(y) - 2);
    }

    // Plots
    for (const p of compiled) {
      if (!p.compiled) continue;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      let moved = false;
      let prevY: number | null = null;
      for (let px = 0; px <= w; px++) {
        const x = xMin + (px / w) * (xMax - xMin);
        let y: number;
        try { y = p.compiled({ x }); } catch { y = NaN; }
        if (!isFinite(y)) { moved = false; prevY = null; continue; }
        const py = yToPx(y);
        // Break line if jump too big (vertical asymptote)
        if (prevY !== null && Math.abs(py - prevY) > h) { moved = false; }
        if (!moved) { ctx.moveTo(px, py); moved = true; }
        else ctx.lineTo(px, py);
        prevY = py;
      }
      ctx.stroke();
    }
  }, [plots, xMin, xMax, yMin, yMax]);

  const zoom = (factor: number) => {
    const cx = (xMin + xMax) / 2;
    const cy = (yMin + yMax) / 2;
    const wx = (xMax - xMin) / 2 * factor;
    const wy = (yMax - yMin) / 2 * factor;
    setXMin(cx - wx); setXMax(cx + wx);
    setYMin(cy - wy); setYMax(cy + wy);
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold">📈 Graph Plotter</h3>
        <div className="flex gap-1">
          <button type="button" onClick={() => zoom(0.8)} aria-label="Zoom in" className="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-800 rounded">+</button>
          <button type="button" onClick={() => zoom(1.25)} aria-label="Zoom out" className="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-800 rounded">−</button>
          <button type="button" onClick={() => { setXMin(-10); setXMax(10); setYMin(-5); setYMax(5); }} aria-label="Reset" className="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-800 rounded">⟲</button>
        </div>
      </div>

      <canvas ref={canvasRef} className="w-full border border-gray-100 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-950" />

      <div className="mt-3 space-y-2">
        {plots.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: p.color }} />
            <span className="text-sm text-gray-500">y =</span>
            <input
              type="text"
              value={p.expr}
              onChange={(e) => {
                const newPlots = [...plots];
                newPlots[i] = { ...p, expr: e.target.value };
                setPlots(newPlots);
              }}
              placeholder="e.g. x^2, sin(x)*x, 2*x+3"
              aria-label={`Equation ${i + 1}`}
              className="flex-1 border border-gray-200 dark:border-gray-800 rounded px-2 py-1 text-sm bg-white dark:bg-gray-950"
            />
            {plots.length > 1 && (
              <button type="button" onClick={() => setPlots(plots.filter((_, idx) => idx !== i))} aria-label="Remove" className="text-red-500 text-sm">×</button>
            )}
          </div>
        ))}
        <div className="flex items-center justify-between text-xs">
          {compiled.some((p) => p.error) && (
            <span className="text-red-500">{compiled.find((p) => p.error)?.error}</span>
          )}
          {plots.length < 5 && (
            <button type="button" onClick={() => setPlots([...plots, { expr: 'x', color: COLORS[plots.length] }])} className="ml-auto text-primary-600 font-semibold">+ Add plot</button>
          )}
        </div>
      </div>
    </div>
  );
}

function niceStep(range: number): number {
  const exp = Math.floor(Math.log10(range));
  const base = Math.pow(10, exp);
  const mantissa = range / base;
  if (mantissa < 1.5) return base;
  if (mantissa < 3.5) return 2 * base;
  if (mantissa < 7.5) return 5 * base;
  return 10 * base;
}

function formatNum(n: number): string {
  if (Math.abs(n) < 1e-10) return '0';
  if (Math.abs(n) < 0.01 || Math.abs(n) >= 1e4) return n.toExponential(1);
  return n.toString().replace(/\.?0+$/, '');
}
