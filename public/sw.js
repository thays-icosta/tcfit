// Deliberately does no offline caching of its own — its only job is to make
// sure nothing (Android's WebAPK cache, an old registered SW, etc.) can keep
// serving a stale build once a new one is deployed. Every step is defensive:
// an old/limited WebView's missing API or a network hiccup here must never
// throw an uncaught exception that could take the install/activate lifecycle
// (and the page relying on it) down with it.
const CACHE_ALLOWLIST = [];

self.addEventListener('install', () => {
  try {
    self.skipWaiting();
  } catch (e) {
    // no-op: worst case this SW activates on the next load instead of immediately
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        if (self.caches && typeof caches.keys === 'function') {
          const keys = await caches.keys();
          await Promise.all(
            keys
              .filter((k) => !CACHE_ALLOWLIST.includes(k))
              .map((k) => caches.delete(k).catch(() => {}))
          );
        }
      } catch (e) {
        // Cache Storage isn't available/failed on this device — nothing to clean up, move on.
      }
      try {
        if (self.clients && typeof self.clients.claim === 'function') {
          await self.clients.claim();
        }
      } catch (e) {
        // no-op
      }
    })()
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  try {
    event.respondWith(
      fetch(event.request).catch(() => new Response('', { status: 504, statusText: 'Offline' }))
    );
  } catch (e) {
    // If even wiring up respondWith throws, let the browser handle the request itself.
  }
});
