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

// Web Push: the send-message-push edge function posts { title, body, data }
// as the notification payload. Every step is defensive for the same reason
// as above — a malformed payload here must not break the SW's event loop.
self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let payload = {};
      try {
        payload = event.data ? event.data.json() : {};
      } catch (e) {
        payload = { title: 'TcFit', body: event.data ? event.data.text() : '' };
      }
      try {
        await self.registration.showNotification(payload.title || 'TcFit', {
          body: payload.body || '',
          icon: '/icon.png',
          badge: '/icon.png',
          data: payload.data || {},
        });
      } catch (e) {
        // no-op: nothing we can do if showNotification itself is unavailable/rejected
      }
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  try {
    event.notification.close();
  } catch (e) {}

  const data = (event.notification && event.notification.data) || {};
  let url = '/';
  if (data.type === 'chat') {
    const params = [];
    if (data.personalId) params.push('chatPersonalId=' + encodeURIComponent(data.personalId));
    if (data.studentId) params.push('chatStudentId=' + encodeURIComponent(data.studentId));
    if (params.length > 0) url = '/?' + params.join('&');
  }

  event.waitUntil(
    (async () => {
      try {
        const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of windowClients) {
          if ('focus' in client) {
            if ('navigate' in client) {
              try { await client.navigate(url); } catch (e) {}
            }
            await client.focus();
            return;
          }
        }
        if (clients.openWindow) await clients.openWindow(url);
      } catch (e) {
        // no-op
      }
    })()
  );
});
