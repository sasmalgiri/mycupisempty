'use client';

/**
 * GeometryConstructor — interactive geometry with protractor, compass, ruler.
 * Click to place points; auto-draws lines/circles and measures angles.
 */

import { useEffect, useRef, useState } from 'react';

type Tool = 'point' | 'line' | 'circle' | 'angle' | 'ruler' | 'erase';
interface Pt { x: number; y: number; label: string; }

export default function GeometryConstructor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('point');
  const [points, setPoints] = useState<Pt[]>([]);
  const [lines, setLines] = useState<Array<[number, number]>>([]);
  const [circles, setCircles] = useState<Array<{ c: number; r: number }>>([]);
  const [angles, setAngles] = useState<Array<[number, number, number]>>([]);
  const [pending, setPending] = useState<number[]>([]);

  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, lines, circles, angles, pending]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const w = canvas.parentElement!.clientWidth;
    const h = 400;
    canvas.width = w * ratio; canvas.height = h * ratio;
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);

    // Grid
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#f3f4f6'; ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    // Lines
    ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 2;
    for (const [a, b] of lines) {
      if (points[a] && points[b]) {
        ctx.beginPath(); ctx.moveTo(points[a].x, points[a].y); ctx.lineTo(points[b].x, points[b].y); ctx.stroke();
        // Show length
        const dx = points[b].x - points[a].x, dy = points[b].y - points[a].y;
        const len = Math.sqrt(dx * dx + dy * dy);
        ctx.fillStyle = '#6b7280'; ctx.font = '11px sans-serif';
        ctx.fillText(`${(len / 20).toFixed(1)} u`, (points[a].x + points[b].x) / 2 + 4, (points[a].y + points[b].y) / 2 - 4);
      }
    }

    // Circles
    ctx.strokeStyle = '#8b5cf6'; ctx.lineWidth = 2;
    for (const { c, r } of circles) {
      if (points[c]) {
        ctx.beginPath();
        ctx.arc(points[c].x, points[c].y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Angles
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.5;
    for (const [a, vertex, b] of angles) {
      if (points[a] && points[vertex] && points[b]) {
        const va = points[vertex];
        const ang1 = Math.atan2(points[a].y - va.y, points[a].x - va.x);
        const ang2 = Math.atan2(points[b].y - va.y, points[b].x - va.x);
        ctx.beginPath(); ctx.arc(va.x, va.y, 24, ang1, ang2); ctx.stroke();
        let deg = Math.abs((ang2 - ang1) * 180 / Math.PI);
        if (deg > 180) deg = 360 - deg;
        ctx.fillStyle = '#ef4444'; ctx.font = 'bold 12px sans-serif';
        ctx.fillText(`${deg.toFixed(0)}°`, va.x + 30 * Math.cos((ang1 + ang2) / 2), va.y + 30 * Math.sin((ang1 + ang2) / 2));
      }
    }

    // Points
    ctx.fillStyle = '#6366f1';
    for (const [i, p] of points.entries()) {
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1f2937'; ctx.font = 'bold 12px sans-serif';
      ctx.fillText(p.label, p.x + 8, p.y - 8);
      ctx.fillStyle = '#6366f1';
    }

    // Pending (selection highlight)
    ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2.5;
    for (const idx of pending) {
      if (points[idx]) {
        ctx.beginPath(); ctx.arc(points[idx].x, points[idx].y, 9, 0, Math.PI * 2); ctx.stroke();
      }
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Snap to existing point if within 12px
    let hitIdx = -1;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (Math.hypot(p.x - x, p.y - y) < 12) { hitIdx = i; break; }
    }

    if (tool === 'point') {
      const label = String.fromCharCode(65 + points.length); // A, B, C…
      setPoints([...points, { x, y, label }]);
      return;
    }

    if (tool === 'erase') {
      if (hitIdx >= 0) {
        setPoints(points.filter((_, i) => i !== hitIdx));
        setLines(lines.filter(([a, b]) => a !== hitIdx && b !== hitIdx));
        setCircles(circles.filter(({ c }) => c !== hitIdx));
        setAngles(angles.filter(([a, v, b]) => a !== hitIdx && v !== hitIdx && b !== hitIdx));
      }
      return;
    }

    const idx = hitIdx >= 0 ? hitIdx : points.length;
    if (hitIdx < 0) {
      const label = String.fromCharCode(65 + points.length);
      setPoints([...points, { x, y, label }]);
    }

    const nextPending = [...pending, idx];

    if (tool === 'line' && nextPending.length === 2) {
      setLines([...lines, [nextPending[0], nextPending[1]]]);
      setPending([]);
    } else if (tool === 'circle' && nextPending.length === 2) {
      const [cIdx, rIdx] = nextPending;
      const c = points[cIdx] || { x, y, label: '' };
      const r = points[rIdx] || { x, y, label: '' };
      const radius = Math.hypot(c.x - r.x, c.y - r.y);
      setCircles([...circles, { c: cIdx, r: radius }]);
      setPending([]);
    } else if (tool === 'angle' && nextPending.length === 3) {
      setAngles([...angles, [nextPending[0], nextPending[1], nextPending[2]]]);
      setPending([]);
    } else if (tool === 'ruler' && nextPending.length === 2) {
      setLines([...lines, [nextPending[0], nextPending[1]]]);
      setPending([]);
    } else {
      setPending(nextPending);
    }
  };

  const clearAll = () => {
    setPoints([]); setLines([]); setCircles([]); setAngles([]); setPending([]);
  };

  const helpText: Record<Tool, string> = {
    point: 'Click anywhere to place a point',
    line: 'Click two points to draw a line (length shown)',
    circle: 'Click center, then click a point on circumference',
    angle: 'Click three points: A → vertex → B (angle at vertex shown)',
    ruler: 'Click two points to measure distance',
    erase: 'Click a point to remove it and everything connected',
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
      <h3 className="font-bold mb-3">📐 Geometry Constructor</h3>
      <div className="flex flex-wrap gap-1 mb-2">
        {(['point', 'line', 'circle', 'angle', 'ruler', 'erase'] as Tool[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setTool(t); setPending([]); }}
            aria-label={t}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${tool === t ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
          >{t}</button>
        ))}
        <button
          type="button"
          onClick={clearAll}
          aria-label="Clear"
          className="ml-auto px-3 py-1.5 rounded-lg text-sm font-medium bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
        >🗑️ Clear</button>
      </div>
      <p className="text-xs text-gray-500 mb-2">{helpText[tool]}</p>
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className="w-full border border-gray-200 dark:border-gray-800 rounded-lg cursor-crosshair"
      />
    </div>
  );
}
