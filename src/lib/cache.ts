/**
 * Cache Layer — simple in-memory LRU with TTL, module-level per process.
 *
 * Used to memoize expensive aggregations (StudentState, mastery maps,
 * main-brain snapshots) so consecutive requests from the same user within
 * a short window don't re-run the full query + compute chain.
 *
 * Runs inside Next.js server processes — NOT shared across instances in a
 * load-balanced deployment. For cross-instance caching, swap the backing
 * store with Redis / Upstash. The public API here is store-agnostic.
 *
 * Invalidation hooks are keyed by user_id so any signal-writing route can
 * cheaply bust a user's cached state without touching other users.
 */

interface Entry<V> {
  value: V;
  expiresAt: number;
  insertedAt: number;
}

interface CacheInstance<V> {
  get: (key: string) => V | undefined;
  set: (key: string, value: V) => void;
  invalidate: (key: string) => void;
  invalidateByPrefix: (prefix: string) => void;
  size: () => number;
  clear: () => void;
}

export function createCache<V>(options: { ttlMs: number; maxSize?: number }): CacheInstance<V> {
  const ttlMs = options.ttlMs;
  const maxSize = options.maxSize ?? 1000;
  const store = new Map<string, Entry<V>>();

  const evictExpired = () => {
    const now = Date.now();
    for (const [k, entry] of store.entries()) {
      if (entry.expiresAt <= now) store.delete(k);
    }
  };

  const evictOldestIfNeeded = () => {
    if (store.size <= maxSize) return;
    // Evict 10% of oldest entries by insertedAt
    const sorted = Array.from(store.entries()).sort((a, b) => a[1].insertedAt - b[1].insertedAt);
    const toEvict = Math.max(1, Math.floor(maxSize * 0.1));
    for (let i = 0; i < toEvict && i < sorted.length; i++) {
      store.delete(sorted[i][0]);
    }
  };

  return {
    get(key: string): V | undefined {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= Date.now()) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key: string, value: V): void {
      const now = Date.now();
      store.set(key, { value, expiresAt: now + ttlMs, insertedAt: now });
      evictOldestIfNeeded();
      // Opportunistically clean expired ~1% of sets
      if (Math.random() < 0.01) evictExpired();
    },
    invalidate(key: string): void {
      store.delete(key);
    },
    invalidateByPrefix(prefix: string): void {
      for (const k of Array.from(store.keys())) {
        if (k.startsWith(prefix)) store.delete(k);
      }
    },
    size(): number {
      return store.size;
    },
    clear(): void {
      store.clear();
    },
  };
}

// ============================================================
// Global caches for the app's hottest aggregations
// ============================================================

// StudentState — rebuilt from signals + tables. TTL 60s.
export const studentStateCache = createCache<any>({ ttlMs: 60_000, maxSize: 500 });

// Mastery maps — depend on many tables. TTL 2 min.
export const masteryCache = createCache<any>({ ttlMs: 120_000, maxSize: 500 });

// Main-brain snapshot — heavy join across companions. TTL 5 min.
export const mainBrainCache = createCache<any>({ ttlMs: 300_000, maxSize: 500 });

// Daily briefing — regenerated per day; TTL 30 min.
export const briefingCache = createCache<any>({ ttlMs: 30 * 60_000, maxSize: 500 });

// Method calibration — expensive bandit recomputation. TTL 5 min.
export const calibrationCache = createCache<any>({ ttlMs: 300_000, maxSize: 500 });

// ============================================================
// Invalidation helper — call on any write that changes the user's state
// ============================================================

/**
 * Bust all caches for a given user. Safe to call from signal-write paths,
 * session completion, companion turn, etc. Cheap — just drops map entries.
 */
export function invalidateUserCaches(userId: string): void {
  const prefix = `u:${userId}`;
  studentStateCache.invalidateByPrefix(prefix);
  masteryCache.invalidateByPrefix(prefix);
  mainBrainCache.invalidateByPrefix(prefix);
  briefingCache.invalidateByPrefix(prefix);
  calibrationCache.invalidateByPrefix(prefix);
}

/**
 * Compute an "age bucket" key so cache keys change only when the underlying
 * data would meaningfully change. For a student's state, we bucket per
 * day-of-year + quarter-of-hour to get fresh-enough output without thrashing.
 */
export function cacheKey(userId: string, namespace: string, extra: string = ''): string {
  return `u:${userId}:${namespace}${extra ? ':' + extra : ''}`;
}

/**
 * Wrap an async producer with caching. Usage:
 *
 *   const state = await cached(
 *     studentStateCache,
 *     cacheKey(userId, 'state'),
 *     () => buildStudentState(supabase, userId)
 *   );
 */
export async function cached<V>(
  cache: CacheInstance<V>,
  key: string,
  producer: () => Promise<V>,
): Promise<V> {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const value = await producer();
  cache.set(key, value);
  return value;
}
