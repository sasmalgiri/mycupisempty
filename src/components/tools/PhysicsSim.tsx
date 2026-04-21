'use client';

/**
 * PhysicsSim — interactive simulations for K-12 physics.
 * Modes: pendulum, projectile, wave, circuit.
 */

import { useEffect, useRef, useState } from 'react';

type Mode = 'pendulum' | 'projectile' | 'wave' | 'circuit';

export default function PhysicsSim() {
  const [mode, setMode] = useState<Mode>('pendulum');

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-bold">🔬 Physics Lab</h3>
        <div className="flex gap-1 flex-wrap">
          {(['pendulum', 'projectile', 'wave', 'circuit'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-label={m}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${mode === m ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
            >{m}</button>
          ))}
        </div>
      </div>

      {mode === 'pendulum' && <Pendulum />}
      {mode === 'projectile' && <Projectile />}
      {mode === 'wave' && <Wave />}
      {mode === 'circuit' && <Circuit />}
    </div>
  );
}

// ============================================================
// Pendulum — simple harmonic + damping
// ============================================================

function Pendulum() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [length, setLength] = useState(150);
  const [gravity, setGravity] = useState(9.8);
  const [damping, setDamping] = useState(0.005);
  const [running, setRunning] = useState(true);
  const stateRef = useRef({ theta: Math.PI / 4, omega: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const w = canvas.parentElement!.clientWidth;
    const h = 300;
    canvas.width = w * ratio; canvas.height = h * ratio;
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);

    let raf: any;
    const pivotX = w / 2;
    const pivotY = 30;
    const dt = 0.02;

    const step = () => {
      const s = stateRef.current;
      if (running) {
        const a = -(gravity / (length / 50)) * Math.sin(s.theta) - damping * s.omega;
        s.omega += a * dt;
        s.theta += s.omega * dt;
      }
      ctx.fillStyle = '#f9fafb'; ctx.fillRect(0, 0, w, h);
      // Pivot
      ctx.fillStyle = '#1f2937';
      ctx.beginPath(); ctx.arc(pivotX, pivotY, 5, 0, Math.PI * 2); ctx.fill();
      const bobX = pivotX + length * Math.sin(s.theta);
      const bobY = pivotY + length * Math.cos(s.theta);
      // String
      ctx.strokeStyle = '#6b7280'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(pivotX, pivotY); ctx.lineTo(bobX, bobY); ctx.stroke();
      // Bob
      ctx.fillStyle = '#6366f1';
      ctx.beginPath(); ctx.arc(bobX, bobY, 18, 0, Math.PI * 2); ctx.fill();

      // Readouts
      ctx.fillStyle = '#374151'; ctx.font = '12px sans-serif';
      ctx.fillText(`θ = ${(s.theta * 180 / Math.PI).toFixed(1)}°`, 10, 20);
      ctx.fillText(`ω = ${s.omega.toFixed(2)} rad/s`, 10, 36);
      ctx.fillText(`T = 2π√(L/g) = ${(2 * Math.PI * Math.sqrt((length / 50) / gravity)).toFixed(2)} s`, 10, 52);

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [length, gravity, damping, running]);

  return (
    <div>
      <canvas ref={canvasRef} className="w-full rounded-lg bg-gray-50 border border-gray-200 dark:border-gray-800" />
      <div className="mt-3 space-y-2 text-sm">
        <label className="flex items-center gap-2">Length
          <input type="range" min={50} max={250} value={length} onChange={(e) => setLength(Number(e.target.value))} aria-label="Length" className="flex-1" />
          <span className="w-10 text-right">{length}</span>
        </label>
        <label className="flex items-center gap-2">Gravity (g)
          <input type="range" min={1} max={25} step={0.1} value={gravity} onChange={(e) => setGravity(Number(e.target.value))} aria-label="Gravity" className="flex-1" />
          <span className="w-10 text-right">{gravity.toFixed(1)}</span>
        </label>
        <label className="flex items-center gap-2">Damping
          <input type="range" min={0} max={0.05} step={0.001} value={damping} onChange={(e) => setDamping(Number(e.target.value))} aria-label="Damping" className="flex-1" />
          <span className="w-12 text-right">{damping.toFixed(3)}</span>
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={() => setRunning(!running)} className="px-3 py-1.5 rounded bg-primary-600 text-white">{running ? 'Pause' : 'Play'}</button>
          <button type="button" onClick={() => { stateRef.current = { theta: Math.PI / 4, omega: 0 }; }} className="px-3 py-1.5 rounded bg-gray-100 dark:bg-gray-800">Reset</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Projectile motion
// ============================================================

function Projectile() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [v0, setV0] = useState(50);
  const [angle, setAngle] = useState(45);
  const [g, setG] = useState(9.8);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const w = canvas.parentElement!.clientWidth;
    const h = 300;
    canvas.width = w * ratio; canvas.height = h * ratio;
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.fillStyle = '#f9fafb'; ctx.fillRect(0, 0, w, h);

    const rad = (angle * Math.PI) / 180;
    const vx = v0 * Math.cos(rad);
    const vy = v0 * Math.sin(rad);
    const range = (v0 * v0 * Math.sin(2 * rad)) / g;
    const maxH = (vy * vy) / (2 * g);
    const tFlight = (2 * vy) / g;

    // Scale to fit
    const scaleX = (w - 40) / Math.max(range, 10);
    const scaleY = (h - 40) / Math.max(maxH, 10);
    const scale = Math.min(scaleX, scaleY, 4);

    // Ground
    ctx.strokeStyle = '#6b7280'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(20, h - 20); ctx.lineTo(w - 20, h - 20); ctx.stroke();

    // Trajectory
    ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let t = 0; t <= tFlight; t += 0.02) {
      const x = 20 + vx * t * scale;
      const y = h - 20 - (vy * t - 0.5 * g * t * t) * scale;
      if (t === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Velocity arrow
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, h - 20);
    ctx.lineTo(20 + vx * scale * 0.5, h - 20 - vy * scale * 0.5);
    ctx.stroke();

    // Readouts
    ctx.fillStyle = '#374151'; ctx.font = '12px sans-serif';
    ctx.fillText(`Range = ${range.toFixed(1)} m`, 10, 20);
    ctx.fillText(`Max height = ${maxH.toFixed(1)} m`, 10, 36);
    ctx.fillText(`Flight time = ${tFlight.toFixed(2)} s`, 10, 52);
  }, [v0, angle, g]);

  return (
    <div>
      <canvas ref={canvasRef} className="w-full rounded-lg bg-gray-50 border border-gray-200 dark:border-gray-800" />
      <div className="mt-3 space-y-2 text-sm">
        <label className="flex items-center gap-2">v₀ (m/s)
          <input type="range" min={5} max={100} value={v0} onChange={(e) => setV0(Number(e.target.value))} aria-label="Initial velocity" className="flex-1" />
          <span className="w-10 text-right">{v0}</span>
        </label>
        <label className="flex items-center gap-2">Angle (°)
          <input type="range" min={0} max={90} value={angle} onChange={(e) => setAngle(Number(e.target.value))} aria-label="Launch angle" className="flex-1" />
          <span className="w-10 text-right">{angle}</span>
        </label>
        <label className="flex items-center gap-2">Gravity
          <input type="range" min={1} max={25} step={0.1} value={g} onChange={(e) => setG(Number(e.target.value))} aria-label="Gravity" className="flex-1" />
          <span className="w-10 text-right">{g.toFixed(1)}</span>
        </label>
      </div>
    </div>
  );
}

// ============================================================
// Transverse wave
// ============================================================

function Wave() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [amp, setAmp] = useState(40);
  const [freq, setFreq] = useState(1);
  const [wavelength, setWavelength] = useState(100);
  const tRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const w = canvas.parentElement!.clientWidth;
    const h = 240;
    canvas.width = w * ratio; canvas.height = h * ratio;
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);

    let raf: any;
    const step = () => {
      tRef.current += 0.03;
      ctx.fillStyle = '#f9fafb'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#e5e7eb';
      ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();

      ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 2;
      ctx.beginPath();
      const k = (2 * Math.PI) / wavelength;
      const omega = 2 * Math.PI * freq;
      for (let x = 0; x < w; x++) {
        const y = h / 2 - amp * Math.sin(k * x - omega * tRef.current);
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.fillStyle = '#374151'; ctx.font = '12px sans-serif';
      ctx.fillText(`v = f × λ = ${(freq * wavelength).toFixed(1)} (arbitrary units)`, 10, 20);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [amp, freq, wavelength]);

  return (
    <div>
      <canvas ref={canvasRef} className="w-full rounded-lg bg-gray-50 border border-gray-200 dark:border-gray-800" />
      <div className="mt-3 space-y-2 text-sm">
        <label className="flex items-center gap-2">Amplitude
          <input type="range" min={5} max={80} value={amp} onChange={(e) => setAmp(Number(e.target.value))} aria-label="Amplitude" className="flex-1" />
          <span className="w-10 text-right">{amp}</span>
        </label>
        <label className="flex items-center gap-2">Frequency
          <input type="range" min={0.1} max={5} step={0.1} value={freq} onChange={(e) => setFreq(Number(e.target.value))} aria-label="Frequency" className="flex-1" />
          <span className="w-10 text-right">{freq.toFixed(1)}</span>
        </label>
        <label className="flex items-center gap-2">Wavelength
          <input type="range" min={20} max={300} value={wavelength} onChange={(e) => setWavelength(Number(e.target.value))} aria-label="Wavelength" className="flex-1" />
          <span className="w-10 text-right">{wavelength}</span>
        </label>
      </div>
    </div>
  );
}

// ============================================================
// Simple DC Circuit (Ohm's law demo)
// ============================================================

function Circuit() {
  const [voltage, setVoltage] = useState(12);
  const [resistance, setResistance] = useState(4);
  const current = voltage / resistance;
  const power = voltage * current;

  return (
    <div className="space-y-3">
      <div className="bg-gray-50 dark:bg-gray-950 rounded-lg p-6">
        <svg viewBox="0 0 400 200" className="w-full">
          {/* Battery */}
          <line x1="50" y1="100" x2="50" y2="80" stroke="#1f2937" strokeWidth="2" />
          <line x1="40" y1="80" x2="60" y2="80" stroke="#1f2937" strokeWidth="3" />
          <line x1="35" y1="120" x2="65" y2="120" stroke="#1f2937" strokeWidth="2" />
          <line x1="50" y1="100" x2="50" y2="120" stroke="#1f2937" strokeWidth="2" />
          <text x="15" y="95" fontSize="12">+</text>
          <text x="15" y="135" fontSize="12">−</text>
          <text x="75" y="105" fontSize="11" fill="#6b7280">{voltage} V</text>
          {/* Wire */}
          <line x1="50" y1="80" x2="350" y2="80" stroke="#1f2937" strokeWidth="2" />
          <line x1="50" y1="120" x2="150" y2="120" stroke="#1f2937" strokeWidth="2" />
          <line x1="250" y1="120" x2="350" y2="120" stroke="#1f2937" strokeWidth="2" />
          <line x1="350" y1="80" x2="350" y2="120" stroke="#1f2937" strokeWidth="2" />
          {/* Resistor (zigzag) */}
          <polyline points="150,120 160,110 170,130 180,110 190,130 200,110 210,130 220,110 230,130 240,110 250,120" fill="none" stroke="#ef4444" strokeWidth="2" />
          <text x="175" y="150" fontSize="11" fill="#6b7280">R = {resistance} Ω</text>
          {/* Current arrows */}
          <text x="190" y="75" fontSize="11" fill="#6366f1">I = {current.toFixed(2)} A →</text>
        </svg>
      </div>
      <div className="space-y-2 text-sm">
        <label className="flex items-center gap-2">Voltage (V)
          <input type="range" min={1} max={48} value={voltage} onChange={(e) => setVoltage(Number(e.target.value))} aria-label="Voltage" className="flex-1" />
          <span className="w-10 text-right">{voltage}</span>
        </label>
        <label className="flex items-center gap-2">Resistance (Ω)
          <input type="range" min={1} max={50} value={resistance} onChange={(e) => setResistance(Number(e.target.value))} aria-label="Resistance" className="flex-1" />
          <span className="w-10 text-right">{resistance}</span>
        </label>
        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
          <p className="font-mono">I = V / R = {voltage} / {resistance} = <strong>{current.toFixed(2)} A</strong></p>
          <p className="font-mono">P = V × I = {voltage} × {current.toFixed(2)} = <strong>{power.toFixed(2)} W</strong></p>
        </div>
      </div>
    </div>
  );
}
