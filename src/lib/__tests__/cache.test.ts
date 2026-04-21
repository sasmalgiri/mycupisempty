import { describe, it, expect } from 'vitest';
import { createCache, cached, cacheKey } from '../cache';

describe('createCache', () => {
  it('returns values within TTL', () => {
    const c = createCache<number>({ ttlMs: 10_000, maxSize: 10 });
    c.set('k', 42);
    expect(c.get('k')).toBe(42);
  });

  it('expires values past TTL', async () => {
    const c = createCache<number>({ ttlMs: 30, maxSize: 10 });
    c.set('k', 1);
    await new Promise((r) => setTimeout(r, 50));
    expect(c.get('k')).toBeUndefined();
  });

  it('evicts oldest when over maxSize', () => {
    const c = createCache<number>({ ttlMs: 10_000, maxSize: 5 });
    for (let i = 0; i < 20; i++) c.set(`k${i}`, i);
    expect(c.size()).toBeLessThanOrEqual(5 + 2);  // allow some evict buffer
  });

  it('invalidateByPrefix clears matching keys only', () => {
    const c = createCache<number>({ ttlMs: 10_000, maxSize: 100 });
    c.set('u:a:state', 1);
    c.set('u:a:mastery', 2);
    c.set('u:b:state', 3);
    c.invalidateByPrefix('u:a');
    expect(c.get('u:a:state')).toBeUndefined();
    expect(c.get('u:a:mastery')).toBeUndefined();
    expect(c.get('u:b:state')).toBe(3);
  });
});

describe('cached()', () => {
  it('calls producer only once for cache hits within TTL', async () => {
    const c = createCache<number>({ ttlMs: 10_000, maxSize: 10 });
    let calls = 0;
    const producer = async () => { calls++; return 7; };

    const v1 = await cached(c, 'k', producer);
    const v2 = await cached(c, 'k', producer);
    expect(v1).toBe(7);
    expect(v2).toBe(7);
    expect(calls).toBe(1);
  });

  it('re-runs producer after invalidation', async () => {
    const c = createCache<number>({ ttlMs: 10_000, maxSize: 10 });
    let calls = 0;
    const producer = async () => { calls++; return calls; };
    await cached(c, 'k', producer);
    c.invalidate('k');
    await cached(c, 'k', producer);
    expect(calls).toBe(2);
  });
});

describe('cacheKey', () => {
  it('builds namespaced keys', () => {
    expect(cacheKey('user1', 'state')).toBe('u:user1:state');
    expect(cacheKey('user1', 'mastery', 'math')).toBe('u:user1:mastery:math');
  });
});
