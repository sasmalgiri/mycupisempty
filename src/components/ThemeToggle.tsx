'use client';

import { useTheme, type Theme } from '@/lib/theme';

export default function ThemeToggle() {
  const [theme, setTheme] = useTheme();

  const options: Array<{ value: Theme; label: string; icon: string }> = [
    { value: 'light', label: 'Light', icon: '☀️' },
    { value: 'auto',  label: 'Auto',  icon: '💻' },
    { value: 'dark',  label: 'Dark',  icon: '🌙' },
  ];

  return (
    <div className="inline-flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setTheme(o.value)}
          aria-label={`${o.label} theme`}
          title={`${o.label} theme`}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            theme === o.value
              ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <span className="mr-1">{o.icon}</span>
          {o.label}
        </button>
      ))}
    </div>
  );
}
