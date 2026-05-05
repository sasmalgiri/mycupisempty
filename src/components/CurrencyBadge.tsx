'use client';

/**
 * CurrencyBadge — shows when a piece of content was last verified.
 *
 * Phase 8's freshness pipeline writes last_verified_at on every refresh.
 * This badge surfaces that timestamp on Wonder facts, blogs, tricks, and
 * videos. Turns amber after 6 months as a hint that the audience should
 * flag the item if anything reads off.
 */

interface Props {
  lastVerifiedAt?: string | null;
  evergreen?: boolean;
  className?: string;
}

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6;

function formatVerifiedDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export default function CurrencyBadge({ lastVerifiedAt, evergreen, className = '' }: Props) {
  if (evergreen) {
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 ${className}`}>
        ⏳ evergreen
      </span>
    );
  }
  if (!lastVerifiedAt) return null;
  const ts = new Date(lastVerifiedAt);
  const ageMs = Date.now() - ts.getTime();
  const stale = ageMs > SIX_MONTHS_MS;
  const cls = stale
    ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${cls} ${className}`}>
      {stale ? '⚠' : '✓'} verified {formatVerifiedDate(ts)}
      {stale && <span className="ml-1 italic">— flag if outdated</span>}
    </span>
  );
}
