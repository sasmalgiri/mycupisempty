'use client';

/**
 * Model3DViewer — interactive 3D model for STEM concepts.
 *
 * Uses Google's <model-viewer> web component (loaded via CDN script tag).
 * Zero bundle impact — only loads the ~200KB web component when a viewer
 * is actually mounted on a page. Supports orbit, pan, AR mode on devices
 * that support WebXR (Android + iOS).
 *
 * Accepts either a GLB/GLTF URL or one of our built-in models.
 *
 * Why this matters: BYJU'S has 3D anatomy/physics. Khan has PhET iframes.
 * We embed 3D natively for concepts where a text explanation falls flat
 * (atomic orbitals, lens geometry, human organs, molecule shapes).
 */

import { useEffect, useRef, useState } from 'react';

// Curated starter library of free/public models for common K-12 concepts
export const BUILTIN_MODELS: Record<string, { label: string; url: string; subject: string; description: string }> = {
  earth: {
    label: 'Earth',
    url: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb', // placeholder — replace with Earth model
    subject: 'Geography',
    description: 'Rotate to explore continents and oceans.',
  },
  heart: {
    label: 'Human Heart',
    url: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
    subject: 'Biology',
    description: 'Four chambers — identify right/left atrium, right/left ventricle.',
  },
  dna: {
    label: 'DNA Helix',
    url: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
    subject: 'Biology',
    description: 'Double-helix structure with base pairs.',
  },
  // Replace the placeholder URLs with actual GLB files hosted in /public/models/ when content is added.
};

interface Model3DViewerProps {
  src?: string;                    // GLB/GLTF URL
  builtin?: keyof typeof BUILTIN_MODELS;
  alt?: string;
  poster?: string;
  cameraControls?: boolean;
  autoRotate?: boolean;
  ar?: boolean;
  height?: number;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': any;
    }
  }
}

let scriptLoaded = false;
let scriptLoadPromise: Promise<void> | null = null;

function loadModelViewerScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;
  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined') return resolve();
    if (document.querySelector('script[data-model-viewer]')) {
      scriptLoaded = true;
      return resolve();
    }
    const s = document.createElement('script');
    s.type = 'module';
    s.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js';
    s.setAttribute('data-model-viewer', 'true');
    s.onload = () => { scriptLoaded = true; resolve(); };
    s.onerror = () => reject(new Error('Failed to load model-viewer'));
    document.head.appendChild(s);
  });
  return scriptLoadPromise;
}

export default function Model3DViewer({
  src,
  builtin,
  alt,
  poster,
  cameraControls = true,
  autoRotate = true,
  ar = true,
  height = 400,
}: Model3DViewerProps) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const model = builtin ? BUILTIN_MODELS[builtin] : null;
  const modelSrc = src || model?.url;
  const altText = alt || model?.label || '3D model';

  useEffect(() => {
    loadModelViewerScript()
      .then(() => setReady(true))
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg text-sm">
        3D viewer couldn&apos;t load. Check your connection.
      </div>
    );
  }

  if (!modelSrc) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 rounded-lg text-sm text-gray-500">
        No 3D model specified.
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden" ref={containerRef}>
      {model && (
        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div>
            <span className="font-semibold text-sm">{model.label}</span>
            <span className="text-xs text-gray-500 ml-2">· {model.subject}</span>
          </div>
          <span className="text-xs text-gray-500">Drag to rotate · Scroll to zoom</span>
        </div>
      )}
      {ready ? (
        <model-viewer
          src={modelSrc}
          alt={altText}
          poster={poster}
          camera-controls={cameraControls ? true : undefined}
          auto-rotate={autoRotate ? true : undefined}
          ar={ar ? true : undefined}
          ar-modes="webxr scene-viewer quick-look"
          style={{ width: '100%', height: `${height}px`, background: 'transparent' }}
          loading="lazy"
        />
      ) : (
        <div style={{ height: `${height}px` }} className="flex items-center justify-center text-gray-500 text-sm">
          Loading 3D viewer…
        </div>
      )}
      {model?.description && (
        <div className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800">
          {model.description}
        </div>
      )}
    </div>
  );
}
