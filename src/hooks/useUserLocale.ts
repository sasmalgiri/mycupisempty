'use client';

/**
 * useUserLocale — returns the student's preferred language ('en' | 'hi' | 'bn').
 * Cached in localStorage so it's synchronous on subsequent reads and cheap for
 * components that just need a locale for TTS, date formatting, etc.
 */

import { useEffect, useState } from 'react';
import type { Locale } from '@/lib/i18n';

const CACHE_KEY = 'mcie_user_locale';
const VALID: Locale[] = ['en', 'hi', 'bn'];

function readCache(): Locale | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = localStorage.getItem(CACHE_KEY);
    if (v && VALID.includes(v as Locale)) return v as Locale;
  } catch {}
  return null;
}

export function useUserLocale(): Locale {
  const [locale, setLocale] = useState<Locale>(() => readCache() || 'en');

  useEffect(() => {
    if (readCache()) return;  // already cached, skip fetch
    fetch('/api/onboarding-prefill')
      .then((r) => r.json())
      .then((d) => {
        const lang = d?.profile?.language;
        if (lang && VALID.includes(lang)) {
          try { localStorage.setItem(CACHE_KEY, lang); } catch {}
          setLocale(lang);
        }
      })
      .catch(() => {});
  }, []);

  return locale;
}
