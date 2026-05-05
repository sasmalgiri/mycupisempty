'use client';

/**
 * AR Textbook Scan — point the camera at an NCERT/state-board page,
 * companion explains. v1: stub UI that captures a frame from the device
 * camera and routes it through Magic Notes + companion-explain. Real AR
 * overlays land in a follow-up; this commit installs the surface so the
 * scaffold is real.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      setError('Camera not available on this device.');
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.onloadedmetadata = () => setReady(true);
        }
      })
      .catch((err) => setError(err?.message || 'Camera permission denied.'));
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(v, 0, 0);
    const dataUrl = c.toDataURL('image/jpeg', 0.85);
    setCaptured(dataUrl);
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Scan your textbook</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Point your camera at an NCERT or state-board page. We&apos;ll capture the frame and your companion can explain. AR overlays land in a follow-up.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-sm text-rose-800 dark:text-rose-200">
          {error}
        </div>
      )}

      {!captured ? (
        <div className="space-y-3">
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted
            className="w-full aspect-video rounded-2xl bg-black object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />
          <button
            type="button"
            onClick={capture}
            disabled={!ready}
            className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold"
          >
            {ready ? '📸 Capture frame' : 'Waiting for camera…'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <img src={captured} alt="captured" className="w-full rounded-2xl" />
          <div className="flex gap-2">
            <Link
              href="/magic-notes"
              className="flex-1 text-center py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold"
            >
              Send to Magic Notes →
            </Link>
            <button type="button" onClick={() => setCaptured(null)} className="px-4 py-3 text-xs text-gray-500 hover:text-gray-800">
              Retake
            </button>
          </div>
          <p className="text-[10px] text-gray-500">
            Right now this scan stays on your device — companion-explain wiring lands when the OCR provider is connected.
          </p>
        </div>
      )}
    </div>
  );
}
