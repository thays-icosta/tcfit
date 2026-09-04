// Deliberately does no offline caching of its own — its only job is to make
// sure nothing (Android's WebAPK cache, an old registered SW, etc.) can keep
// serving a stale build once a new one is deployed.
const CACHE_ALLOWLIST = [];

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !CACHE_ALLOWLIST.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request));
});
