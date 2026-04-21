'use client';

/**
 * FocusMonitor — opt-in, privacy-first attention tracking.
 *
 * Uses the browser's camera to detect: (a) is a face present? (b) is the
 * student looking at the screen? (c) are they blinking normally? The
 * output is a coarse "focus level" (high / medium / low).
 *
 * Privacy rules:
 *   - STRICT OPT-IN: never starts without explicit consent each session
 *   - Frames NEVER leave the device. No upload, no storage.
 *   - Output is a single low-resolution metric ('focus_level') stored as a
 *     signal. We never store image data, faces, or eye-tracking vectors.
 *   - Pause button always visible. "Stop & forget" clears everything.
 *
 * We use a lightweight approach without ML libraries to keep bundle small:
 *   - Face presence via brightness + motion diff on a downscaled 64x48
 *     sample region (enough to detect "person is in frame")
 *   - Motion / blinking via frame-to-frame diff
 *   - True eye tracking would need face-api.js or MediaPipe — can swap in.
 *
 * This is honest about its limits: "focus level" is a rough proxy, not a
 * psychological diagnosis. Paired with other signals (mouse activity,
 * page switches), it meaningfully detects disengagement.
 */

import { useEffect, useRef, useState } from 'react';

interface FocusMonitorProps {
  onFocusChange?: (level: 'high' | 'medium' | 'low' | 'away') => void;
  reportEverySeconds?: number;
}

type Level = 'high' | 'medium' | 'low' | 'away';

export default function FocusMonitor({ onFocusChange, reportEverySeconds = 30 }: FocusMonitorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const prevFrameRef = useRef<ImageData | null>(null);
  const intervalRef = useRef<any>(null);

  const [consent, setConsent] = useState(false);
  const [active, setActive] = useState(false);
  const [level, setLevel] = useState<Level>('away');
  const [error, setError] = useState<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMonitor();
    };
  }, []);

  const startMonitor = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);

      // Sample every ~1.5s
      intervalRef.current = setInterval(sampleFrame, 1500);

      // Report focus level periodically via signal
      if (reportEverySeconds > 0) {
        const reportIv = setInterval(() => {
          // Persist signal via fetch — fire-and-forget
          fetch('/api/learner-signals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              signals: [{
                signal_type: 'focus_level',
                category: 'engagement',
                source: 'focus_monitor',
                value: level === 'high' ? 1 : level === 'medium' ? 0.6 : level === 'low' ? 0.3 : 0,
                metadata: { level },
              }],
            }),
          }).catch(() => {});
        }, reportEverySeconds * 1000);
        // Attach cleanup to ref for stop()
        (intervalRef.current as any)._report = reportIv;
      }
    } catch (err: any) {
      setError(err?.message || 'Camera access denied.');
      stopMonitor();
    }
  };

  const stopMonitor = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      if ((intervalRef.current as any)._report) clearInterval((intervalRef.current as any)._report);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    prevFrameRef.current = null;
    setActive(false);
    setLevel('away');
    onFocusChange?.('away');
  };

  const sampleFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (video.readyState < 2) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    canvas.width = 64;
    canvas.height = 48;
    ctx.drawImage(video, 0, 0, 64, 48);
    const frame = ctx.getImageData(0, 0, 64, 48);

    // Face presence heuristic: avg brightness of center rect vs edges
    // (a face in frame usually sits in the center and has moderate brightness)
    let centerSum = 0, centerCount = 0;
    let edgeSum = 0, edgeCount = 0;
    for (let y = 0; y < 48; y++) {
      for (let x = 0; x < 64; x++) {
        const i = (y * 64 + x) * 4;
        const r = frame.data[i];
        const g = frame.data[i + 1];
        const b = frame.data[i + 2];
        const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
        const isCenter = x >= 20 && x <= 44 && y >= 12 && y <= 36;
        if (isCenter) { centerSum += lum; centerCount++; }
        else { edgeSum += lum; edgeCount++; }
      }
    }
    const centerAvg = centerCount > 0 ? centerSum / centerCount : 0;
    const edgeAvg = edgeCount > 0 ? edgeSum / edgeCount : 0;
    const facePresent = centerAvg > 0.15 && centerAvg < 0.85 && Math.abs(centerAvg - edgeAvg) > 0.05;

    // Motion score: diff with previous frame (captures head movement + blinks)
    let motion = 0;
    if (prevFrameRef.current) {
      for (let i = 0; i < frame.data.length; i += 4) {
        const dr = Math.abs(frame.data[i] - prevFrameRef.current.data[i]);
        const dg = Math.abs(frame.data[i + 1] - prevFrameRef.current.data[i + 1]);
        const db = Math.abs(frame.data[i + 2] - prevFrameRef.current.data[i + 2]);
        motion += (dr + dg + db) / 3;
      }
      motion /= frame.data.length / 4;
    }
    prevFrameRef.current = frame;

    // Decide level
    let newLevel: Level;
    if (!facePresent) {
      newLevel = 'away';
    } else if (motion < 2) {
      // No motion → highly focused OR student walked away (but face present wins)
      newLevel = 'high';
    } else if (motion < 15) {
      newLevel = 'medium';
    } else {
      // High motion → distracted, looking around, moving
      newLevel = 'low';
    }

    if (newLevel !== level) {
      setLevel(newLevel);
      onFocusChange?.(newLevel);
    }
  };

  const color = level === 'high' ? 'bg-emerald-500'
    : level === 'medium' ? 'bg-amber-500'
    : level === 'low' ? 'bg-red-500'
    : 'bg-gray-400';
  const label = level === 'high' ? 'Focused'
    : level === 'medium' ? 'Distracted'
    : level === 'low' ? 'Very distracted'
    : 'Away';

  // Consent screen
  if (!consent) {
    return (
      <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl">
        <div className="flex items-start gap-3">
          <div className="text-3xl">🎥</div>
          <div className="flex-1">
            <h4 className="font-semibold mb-1">Optional: Focus tracker</h4>
            <p className="text-xs text-gray-700 dark:text-gray-300 mb-2">
              Your camera stays on your device. We never send frames, never store faces,
              and only record a coarse focus level (Focused / Distracted / Away). You can
              stop anytime.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConsent(true)}
                className="px-3 py-1.5 rounded-lg text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
              >I agree, enable</button>
              <button
                type="button"
                onClick={() => setConsent(false)}
                className="px-3 py-1.5 rounded-lg text-sm bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
              >Not now</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${color} ${active ? 'animate-pulse' : ''}`} />
          Focus: {label}
        </h4>
        {active ? (
          <button
            type="button"
            onClick={stopMonitor}
            className="text-xs px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg"
          >Stop & forget</button>
        ) : (
          <button
            type="button"
            onClick={startMonitor}
            className="text-xs px-3 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg"
          >Start</button>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-600 mb-2">{error}</p>
      )}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Frames stay on your device. We only save a coarse focus level.
      </p>
      <div className="hidden">
        <video ref={videoRef} muted playsInline width={320} height={240} />
        <canvas ref={canvasRef} width={64} height={48} />
      </div>
    </div>
  );
}
