/**
 * i18n — multilingual framework.
 *
 * India's TAM is multilingual. BYJU'S and Embibe lead here. We scaffold
 * English + Hindi + Bengali now; more regional languages slot in by adding
 * a translations file and registering in LOCALES.
 *
 * Usage:
 *   import { t, useLocale } from '@/lib/i18n';
 *   t('nav.dashboard') — returns string in current locale
 *   const { locale, setLocale } = useLocale(); — client-side switcher
 *
 * Missing keys fall back to English, then to the raw key — never crashes.
 */

'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { bn } from './bengali';

export type Locale = 'en' | 'hi' | 'bn';

export const LOCALES: Record<Locale, { label: string; nativeLabel: string; flag: string }> = {
  en: { label: 'English', nativeLabel: 'English', flag: '🇬🇧' },
  hi: { label: 'Hindi', nativeLabel: 'हिन्दी', flag: '🇮🇳' },
  bn: { label: 'Bengali', nativeLabel: 'বাংলা', flag: '🇧🇩' },
};

// ============================================================
// Hindi translations — mirror of the Bengali keys
// ============================================================

const hi: Record<string, string> = {
  // Navigation
  'nav.dashboard': 'डैशबोर्ड',
  'nav.daily_mix': 'आज का पाठ',
  'nav.my_development': 'मेरा विकास',
  'nav.subjects': 'विषय',
  'nav.learning_engine': 'सीखने का तरीक़ा',
  'nav.ai_guru': 'AI गुरु',
  'nav.methods': 'विधियाँ',
  'nav.activities': 'गतिविधियाँ',
  'nav.challenges': 'चुनौतियाँ',
  'nav.flashcards': 'फ्लैशकार्ड',
  'nav.habits': 'आदतें',
  'nav.reflect': 'आत्ममंथन',
  'nav.goals': 'लक्ष्य',
  'nav.live_quiz': 'लाइव क्विज़',
  'nav.parent': 'अभिभावक',
  'nav.my_style': 'मेरी शैली',
  'nav.progress': 'प्रगति',
  'nav.achievements': 'उपलब्धियाँ',
  'nav.settings': 'सेटिंग्स',
  'nav.logout': 'लॉग आउट',

  // Dashboard
  'dashboard.xp': 'अनुभव अंक',
  'dashboard.streak': 'निरंतरता',
  'dashboard.level': 'स्तर',
  'dashboard.todays_goal': 'आज का लक्ष्य',
  'dashboard.start_daily_mix': 'आज का पाठ शुरू करें →',
  'dashboard.retake_assessment': 'आकलन फिर से लें',
  'dashboard.your_subjects': 'आपके विषय',
  'dashboard.view_all': 'सभी देखें →',
  'dashboard.complete': 'पूरा',
  'dashboard.accuracy': 'सटीकता',
  'dashboard.welcome_back': 'वापसी पर स्वागत है',
  'dashboard.good_morning': 'सुप्रभात',
  'dashboard.good_afternoon': 'शुभ दोपहर',
  'dashboard.good_evening': 'शुभ संध्या',

  // Daily Mix
  'daily_mix.title': 'आज का पाठ',
  'daily_mix.welcome': 'आपके आज के अनुकूलित ५ चरण',
  'daily_mix.start': 'शुरू करें',
  'daily_mix.next_step': 'अगला चरण',
  'daily_mix.finish': 'पूरा करें',
  'daily_mix.well_done': 'शाबाश!',

  // Common
  'common.loading': 'लोड हो रहा है...',
  'common.save': 'सहेजें',
  'common.cancel': 'रद्द करें',
  'common.continue': 'जारी रखें',
  'common.back': 'वापस',
  'common.next': 'अगला',
  'common.submit': 'जमा करें',
  'common.try_again': 'फिर कोशिश करें',
  'common.correct': 'सही',
  'common.wrong': 'ग़लत',
  'common.skip': 'छोड़ें',

  // Exam Mode
  'exam.start': 'परीक्षा शुरू करें',
  'exam.time_remaining': 'बचा समय',
  'exam.submit': 'जमा करें',
  'exam.question_of': 'प्रश्न {n} / {total}',
  'exam.mark_for_review': 'समीक्षा के लिए चिह्नित करें',
  'exam.analysis': 'विश्लेषण',

  // AI Guru
  'guru.title': 'AI गुरु',
  'guru.ask_anything': 'कोई भी प्रश्न पूछें',
  'guru.socratic_mode': 'सॉक्रेटिक मोड',
  'guru.direct_mode': 'सीधा मोड',
  'guru.teach_back_mode': 'मुझे सिखाओ मोड',

  // Reminders
  'reminder.streak_save': 'अपनी निरंतरता बचाएँ',
  'reminder.comeback': 'आपका कप आपका इंतज़ार कर रहा है',
  'reminder.fragile': 'कुछ विषय लगभग याद हो गए हैं',

  // Photo solve
  'photo.snap': 'समस्या की फोटो लें',
  'photo.solving': 'हल कर रहे हैं...',
  'photo.try_again': 'साफ फोटो लें और दोबारा कोशिश करें',

  // Leagues
  'league.weekly': 'साप्ताहिक लीग',
  'league.your_rank': 'आपकी रैंक',
  'league.opt_in': 'लीग में शामिल हों',
  'league.opt_out': 'लीग से बाहर',
  'league.promotion_zone': 'पदोन्नति क्षेत्र',
  'league.safe_zone': 'सुरक्षित क्षेत्र',
};

// ============================================================
// Fallback English dictionary — keys that appear in other locales
// ============================================================

const en: Record<string, string> = {
  'nav.dashboard': 'Dashboard',
  'nav.daily_mix': 'Daily Mix',
  'nav.my_development': 'My Development',
  'nav.subjects': 'Subjects',
  'nav.learning_engine': 'Learning Engine',
  'nav.ai_guru': 'AI Guru',
  'nav.methods': 'Methods',
  'nav.activities': 'Activities',
  'nav.challenges': 'Challenges',
  'nav.flashcards': 'Flashcards',
  'nav.habits': 'Habits',
  'nav.reflect': 'Reflect',
  'nav.goals': 'Goals',
  'nav.live_quiz': 'Live Quiz',
  'nav.parent': 'Parent',
  'nav.my_style': 'My Style',
  'nav.progress': 'Progress',
  'nav.achievements': 'Achievements',
  'nav.settings': 'Settings',
  'nav.logout': 'Log out',
  'dashboard.xp': 'XP',
  'dashboard.streak': 'Streak',
  'dashboard.level': 'Level',
  'dashboard.todays_goal': 'Today\'s Goal',
  'dashboard.start_daily_mix': 'Start Daily Mix →',
  'dashboard.your_subjects': 'Your Subjects',
  'dashboard.view_all': 'View All →',
  'dashboard.complete': 'complete',
  'dashboard.accuracy': 'accuracy',
  'dashboard.welcome_back': 'Welcome back',
  'dashboard.good_morning': 'Good morning',
  'dashboard.good_afternoon': 'Good afternoon',
  'dashboard.good_evening': 'Good evening',
  'daily_mix.title': 'Daily Mix',
  'daily_mix.welcome': 'Your personalized 5 steps for today',
  'daily_mix.start': 'Start',
  'daily_mix.next_step': 'Next step',
  'daily_mix.finish': 'Finish',
  'daily_mix.well_done': 'Well done!',
  'common.loading': 'Loading...',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.continue': 'Continue',
  'common.back': 'Back',
  'common.next': 'Next',
  'common.submit': 'Submit',
  'common.try_again': 'Try again',
  'common.correct': 'Correct',
  'common.wrong': 'Wrong',
  'common.skip': 'Skip',
  'exam.start': 'Start Exam',
  'exam.time_remaining': 'Time remaining',
  'exam.submit': 'Submit',
  'exam.question_of': 'Question {n} of {total}',
  'exam.mark_for_review': 'Mark for review',
  'exam.analysis': 'Analysis',
  'guru.title': 'AI Guru',
  'guru.ask_anything': 'Ask anything',
  'guru.socratic_mode': 'Socratic mode',
  'guru.direct_mode': 'Direct mode',
  'guru.teach_back_mode': 'Teach-back mode',
  'reminder.streak_save': 'Save your streak',
  'reminder.comeback': 'Your cup is waiting',
  'reminder.fragile': 'A few topics are almost stuck',
  'photo.snap': 'Snap the problem',
  'photo.solving': 'Solving...',
  'photo.try_again': 'Take a clearer photo and try again',
  'league.weekly': 'Weekly League',
  'league.your_rank': 'Your rank',
  'league.opt_in': 'Join the league',
  'league.opt_out': 'Leave the league',
  'league.promotion_zone': 'Promotion zone',
  'league.safe_zone': 'Safe zone',
};

const TRANSLATIONS: Record<Locale, Record<string, string>> = {
  en,
  hi,
  bn,
};

// ============================================================
// Translation function — globally accessible
// ============================================================

let currentLocale: Locale = 'en';

export function setGlobalLocale(locale: Locale) {
  currentLocale = locale;
  if (typeof window !== 'undefined') {
    try { localStorage.setItem('mcie_locale', locale); } catch {}
  }
}

export function getGlobalLocale(): Locale {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('mcie_locale') as Locale;
      if (stored && stored in LOCALES) return stored;
    } catch {}
  }
  return currentLocale;
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const locale = getGlobalLocale();
  const dict = TRANSLATIONS[locale] || en;
  let value = dict[key] ?? en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      value = value.replace(`{${k}}`, String(v));
    }
  }
  return value;
}

// ============================================================
// React hook + context
// ============================================================

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (ctx) return ctx;
  // Fallback when no provider — use global state
  return {
    locale: getGlobalLocale(),
    setLocale: setGlobalLocale,
    t,
  };
}

export function useT() {
  const { t: tr } = useLocale();
  return tr;
}

// Standalone hook for client components
export function useClientLocale(): [Locale, (l: Locale) => void] {
  const [locale, setLocaleState] = useState<Locale>('en');
  useEffect(() => {
    const initial = getGlobalLocale();
    setLocaleState(initial);
  }, []);
  const setLocale = (l: Locale) => {
    setGlobalLocale(l);
    setLocaleState(l);
  };
  return [locale, setLocale];
}

export { LocaleContext };
