'use client';

/**
 * Whiteboard — shared drawing surface with AI collaboration.
 *
 * Student draws the problem. Presses "Ask AI". The canvas is snapshot to
 * vision AI which responds with a worked solution in a side panel, preserving
 * the student's drawing underneath. Different from DrawingCanvas in that:
 *
 *   - Multi-color pen + adjustable stroke width
 *   - Save/load state (draft persists via localStorage)
 *   - AI responses are shown side-by-side, not overlaid
 *   - "Clear AI" leaves drawing intact; "Clear Canvas" wipes drawing only
 *
 * Future: could overlay AI annotations (colored strokes from SVG paths the
 * AI returns) directly on the student's drawing. That requires the AI to
 * output coordinates, which current vision API doesn't do reliably — so we
 * use a side panel for now.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import RichContent from '@/components/RichContent';

interface WhiteboardProps {
  subjectId?: string;
  topicId?: string;
  defaultMode?: 'socratic' | 'direct';
  initialPrompt?: string;
  storageKey?: string;
}

const PEN_COLORS = [
  { label: 'Black', value: '#1f2937' },
  { label: 'Blue',  value: '#2563eb' },
  { label: 'Red',   value: '#dc2626' },
  { label: 'Green', value: '#16a34a' },
];

export default function Whiteboard({
  subjectId, topicId, defaultMode = 'socratic', initialPrompt = '', storageKey = 'mcie_whiteboard',
}: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState('#1f2937');
  const [width, setWidth] = useState(2.5);
  const [erasing, setErasing] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [empty, setEmpty] = useState(true);
  const [mode, setMode] = useState<'socratic' | 'direct'>(defaultMode);
  const [aiResponse, setAiResponse] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string>(initialPrompt);

  // Size + retina
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement!;
    const ratio = window.devicePixelRatio || 1;
    const cssWidth = parent.clientWidth;
    const cssHeight = 340;
    canvas.width = cssWidth * ratio;
    canvas.height = cssHeight * ratio;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cssWidth, cssHeight);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Restore saved drawing
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, cssWidth, cssHeight);
          setEmpty(false);
        };
        img.src = saved;
      }
    } catch {}
  }, [storageKey]);

  const persistDrawing = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const data = canvas.toDataURL('image/png');
      localStorage.setItem(storageKey, data);
    } catch {}
  }, [storageKey]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleStart = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    if (erasing) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 20;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
    }
    setDrawing(true);
    setEmpty(false);
  };

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleEnd = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try { canvas.releasePointerCapture(e.pointerId); } catch {}
    setDrawing(false);
    persistDrawing();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const ratio = window.devicePixelRatio || 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width / ratio, canvas.height / ratio);
    setEmpty(true);
    try { localStorage.removeItem(storageKey); } catch {}
  };

  const askAI = async () => {
    const canvas = canvasRef.current;
    if (!canvas || empty) return;
    setError(null);
    setAiLoading(true);
    setAiResponse('');
    try {
      const base64 = canvas.toDataURL('image/png');
      const response = await fetch('/api/photo-solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mode,
          subjectId,
          topicId,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.solution) {
        throw new Error(data.error || 'AI could not read the drawing');
      }
      const prefix = hint ? `You asked: "${hint}"\n\n` : '';
      setAiResponse(prefix + data.solution);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-bold flex items-center gap-2">🎨 Whiteboard</h3>
        <div className="flex items-center gap-2 text-xs">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="wb-mode"
              checked={mode === 'socratic'}
              onChange={() => setMode('socratic')}
              aria-label="Socratic mode"
            />
            Socratic
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="wb-mode"
              checked={mode === 'direct'}
              onChange={() => setMode('direct')}
              aria-label="Direct mode"
            />
            Solve
          </label>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center flex-wrap gap-2 mb-2">
        {PEN_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => { setColor(c.value); setErasing(false); }}
            aria-label={`${c.label} pen`}
            title={c.label}
            className={`w-7 h-7 rounded-full border-2 ${color === c.value && !erasing ? 'border-gray-900 dark:border-white' : 'border-gray-300 dark:border-gray-700'}`}
            style={{ backgroundColor: c.value }}
          />
        ))}
        <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 ml-1">
          <input
            type="range"
            min={1}
            max={8}
            step={0.5}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            aria-label="Stroke width"
            className="w-20"
          />
          <span>{width}px</span>
        </label>
        <button
          type="button"
          onClick={() => setErasing(!erasing)}
          aria-label="Eraser"
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${erasing ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
        >🧽 Erase</button>
        <button
          type="button"
          onClick={clearCanvas}
          aria-label="Clear canvas"
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
        >🗑️ Clear</button>
        <button
          type="button"
          onClick={askAI}
          disabled={empty || aiLoading}
          aria-label="Ask AI"
          className="ml-auto px-4 py-1.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-primary-600 to-secondary-600 text-white disabled:opacity-50"
        >{aiLoading ? 'Thinking…' : 'Ask AI ✨'}</button>
      </div>

      <input
        type="text"
        value={hint}
        onChange={(e) => setHint(e.target.value)}
        placeholder="Optional: describe what you're stuck on…"
        aria-label="Question hint"
        className="w-full border border-gray-200 dark:border-gray-800 rounded-lg p-2 text-sm mb-2 bg-white dark:bg-gray-950"
      />

      <canvas
        ref={canvasRef}
        className="w-full border border-gray-100 dark:border-gray-800 rounded-lg cursor-crosshair touch-none"
        onPointerDown={handleStart}
        onPointerMove={handleMove}
        onPointerUp={handleEnd}
        onPointerCancel={handleEnd}
      />

      {error && (
        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {aiResponse && (
        <div className="mt-3 p-4 bg-primary-50 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-800 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-primary-700 dark:text-primary-300 uppercase">AI Response</span>
            <button
              type="button"
              onClick={() => setAiResponse('')}
              aria-label="Close response"
              className="text-xs text-gray-500 hover:text-gray-900"
            >Clear AI</button>
          </div>
          <RichContent text={aiResponse} className="text-sm" />
        </div>
      )}
    </div>
  );
}
