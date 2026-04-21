'use client';

/**
 * DrawingCanvas — write math problems by hand, send to vision AI for OCR + solve.
 *
 * Photomath has handwriting recognition. Khanmigo doesn't. We bridge this
 * with a simple Canvas-based drawing surface:
 *   - Student writes the problem with finger/stylus/mouse
 *   - On submit, we snapshot to PNG base64 and send to the photo-solve API
 *     (which uses Grok vision to read handwriting)
 *   - AI responds with solution (Socratic by default)
 *
 * Benefits over just typing: handwriting preserves spatial layout of
 * equations (fractions, square roots, exponents) which is often what students
 * are learning to render.
 */

import { useEffect, useRef, useState } from 'react';

interface DrawingCanvasProps {
  onSolve?: (imageBase64: string) => void;
  onClear?: () => void;
  mode?: 'pen' | 'eraser';
  initialHeight?: number;
}

export default function DrawingCanvas({ onSolve, onClear, initialHeight = 280 }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Handle high-DPI / retina displays
    const ratio = window.devicePixelRatio || 1;
    const parent = canvas.parentElement!;
    const cssWidth = parent.clientWidth;
    const cssHeight = initialHeight;
    canvas.width = cssWidth * ratio;
    canvas.height = cssHeight * ratio;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cssWidth, cssHeight);
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, [initialHeight]);

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
    if (isErasing) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 18;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = 2.5;
    }
    setDrawing(true);
    setEmpty(false);
  };

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
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
    onClear?.();
  };

  const submitDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas || empty) return;
    const base64 = canvas.toDataURL('image/png');
    onSolve?.(base64);
  };

  return (
    <div className="border-2 border-gray-200 dark:border-gray-700 rounded-xl p-3 bg-white dark:bg-gray-900">
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsErasing(false)}
            aria-label="Pen"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${!isErasing ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
          >✏️ Pen</button>
          <button
            type="button"
            onClick={() => setIsErasing(true)}
            aria-label="Eraser"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${isErasing ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
          >🧽 Erase</button>
          <button
            type="button"
            onClick={clearCanvas}
            aria-label="Clear"
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
          >🗑️ Clear</button>
        </div>
        <button
          type="button"
          onClick={submitDrawing}
          disabled={empty}
          aria-label="Submit drawing"
          className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-primary-600 to-secondary-600 text-white disabled:opacity-50"
        >Solve ✨</button>
      </div>
      <canvas
        ref={canvasRef}
        className="w-full border border-gray-100 dark:border-gray-800 rounded-lg cursor-crosshair touch-none"
        onPointerDown={handleStart}
        onPointerMove={handleMove}
        onPointerUp={handleEnd}
        onPointerCancel={handleEnd}
      />
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        Write your problem with your finger or stylus. AI will read it and help you solve.
      </p>
    </div>
  );
}
