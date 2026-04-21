'use client';

/**
 * PWA Installer — registers service worker + shows install prompt.
 *
 * Drop this component once in the root layout. It does three things:
 *   1. Registers /sw.js on mount
 *   2. Captures the `beforeinstallprompt` event
 *   3. Shows a non-intrusive install banner when conditions are right
 *      (user has opened the app 3+ times, not yet installed, not dismissed)
 */

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstaller() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    // Register service worker
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .catch((err) => console.warn('SW registration failed:', err));

    // Track visits
    try {
      const visits = parseInt(localStorage.getItem('mcie_visits') || '0', 10) + 1;
      localStorage.setItem('mcie_visits', String(visits));
    } catch {}

    // Capture install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);

      try {
        const visits = parseInt(localStorage.getItem('mcie_visits') || '0', 10);
        const dismissedAt = parseInt(localStorage.getItem('mcie_install_dismissed') || '0', 10);
        const daysSinceDismiss = dismissedAt ? (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24) : 99;
        if (visits >= 3 && daysSinceDismiss > 7) setShow(true);
      } catch {
        setShow(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!prompt) return;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') {
        setShow(false);
        setPrompt(null);
      }
    } catch (err) {
      console.warn('Install prompt failed:', err);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    try { localStorage.setItem('mcie_install_dismissed', String(Date.now())); } catch {}
  };

  if (!show || !prompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 bg-white rounded-2xl shadow-2xl border border-primary-100 p-4 z-50">
      <div className="flex items-start gap-3">
        <div className="text-3xl">📱</div>
        <div className="flex-1">
          <p className="font-semibold text-sm mb-1">Install MyCupIsEmpty</p>
          <p className="text-xs text-gray-600 mb-3">
            Works offline, loads instantly. Add it to your home screen.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleInstall}
              className="flex-1 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold"
            >
              Install
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
