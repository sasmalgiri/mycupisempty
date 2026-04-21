'use client';

import { useClientLocale, LOCALES, type Locale } from '@/lib/i18n';

export default function LocaleSwitcher({ compact = false }: { compact?: boolean }) {
  const [locale, setLocale] = useClientLocale();

  if (compact) {
    return (
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        aria-label="Language"
        className="text-xs bg-transparent border border-gray-300 rounded px-2 py-1 cursor-pointer"
      >
        {Object.entries(LOCALES).map(([code, info]) => (
          <option key={code} value={code}>
            {info.flag} {info.nativeLabel}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {Object.entries(LOCALES).map(([code, info]) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code as Locale)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            locale === code
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <span className="mr-1">{info.flag}</span>
          {info.nativeLabel}
        </button>
      ))}
    </div>
  );
}
