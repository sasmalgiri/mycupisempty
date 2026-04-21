/* eslint-disable no-restricted-globals */
/**
 * Service Worker — offline-first with network fallback.
 *
 * Caches static shell + last 50 GET responses for API routes that matter
 * offline (dashboard, daily-mix, flashcards, mastery, student-state).
 *
 * Strategy:
 *   - Static assets: cache-first
 *   - HTML pages: network-first, fall back to cache, then to offline shell
 *   - GET API responses: stale-while-revalidate
 *   - POST/mutation: network-only, queue in IndexedDB if offline (future)
 */

const VERSION = 'v3';
const STATIC_CACHE = `mcie-static-${VERSION}`;
const RUNTIME_CACHE = `mcie-runtime-${VERSION}`;
const OFFLINE_URL = '/offline.html';

// Core shell to always cache
const CORE_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(CORE_ASSETS).catch(() => {})),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Same-origin only for caching logic
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin) return;

  // Skip service worker script itself
  if (url.pathname === '/sw.js') return;

  // HTML navigation — network first, fallback to cache, then offline shell
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match(OFFLINE_URL)),
        ),
    );
    return;
  }

  // API routes — stale-while-revalidate (only cache safe reads)
  if (url.pathname.startsWith('/api/')) {
    // Skip auth-sensitive mutation-adjacent endpoints
    const nonCacheable = ['/api/auth', '/api/ai/', '/api/photo-solve', '/api/practice-generate', '/api/flashcards/generate'];
    if (nonCacheable.some((p) => url.pathname.startsWith(p))) return;

    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone()).catch(() => {});
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
    return;
  }

  // Static assets (JS, CSS, images, fonts) — cache-first with background update
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        fetch(req).then((res) => {
          if (res.ok) {
            caches.open(STATIC_CACHE).then((cache) => cache.put(req, res.clone())).catch(() => {});
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(OFFLINE_URL));
    }),
  );
});

// Listen for messages from client (e.g. manual cache purge)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    event.waitUntil(
      self.registration.showNotification(payload.title || 'MyCupIsEmpty', {
        body: payload.body || '',
        icon: '/assets/icon-192.png',
        badge: '/assets/icon-192.png',
        data: payload.data || {},
        actions: payload.actions || [],
        tag: payload.tag || 'mcie-reminder',
      }),
    );
  } catch {}
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
