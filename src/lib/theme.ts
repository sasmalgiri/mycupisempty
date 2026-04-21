/**
 * Theme — light/dark/auto. Persisted across sessions.
 *
 * Tailwind already supports `dark:` variants with `class` strategy. We just
 * need to toggle the `dark` class on <html> and persist the choice.
 */

'use client';

import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'auto';

const STORAGE_KEY = 'mcie_theme';

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'auto';
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'auto') return v;
  } catch {}
  return 'auto';
}

export function applyTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  let effective: 'light' | 'dark' = 'light';
  if (theme === 'auto') {
    effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } else {
    effective = theme;
  }
  root.classList.toggle('dark', effective === 'dark');
  root.style.colorScheme = effective;
  try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>('auto');

  useEffect(() => {
    const initial = getStoredTheme();
    setThemeState(initial);
    applyTheme(initial);

    // Watch system preference when on auto
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => { if (getStoredTheme() === 'auto') applyTheme('auto'); };
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    applyTheme(t);
  };

  return [theme, setTheme];
}
