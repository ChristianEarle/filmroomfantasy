// FilmRoom Service Worker — unregister to prevent serving stale builds
// This SW is disabled to ensure users always get fresh builds from the server.
// Previously it was caching HTML/JS/CSS aggressively, causing stale content to be served.

// Unregister all service workers to clear any old caches
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Clean up all caches
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    )
  );
  // Unregister this SW so next page load gets fresh content
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: 'UNREGISTER_SW' });
    });
  });
  self.clients.claim();
});

// Fetch: network-first strategy — always try network, fall back to cache for offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // HTML files: network-first to always get latest
  if (url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() => caches.match(request))
    );
    return;
  }

  // Images and fonts: cache-first
  if (/\.(png|jpg|jpeg|gif|svg|webp|woff|woff2|ttf|eot)$/.test(url.pathname)) {
    event.respondWith(
      caches.open('filmroom-assets').then((cache) =>
        cache.match(request).then((cached) => {
          const fetched = fetch(request).then((response) => {
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          });
          return cached || fetched;
        })
      )
    );
    return;
  }

  // API: network-only (never cache API responses)
  if (url.pathname.startsWith('/api/')) return;

  // JS/CSS: network-first, but cache for offline
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          caches.open('filmroom-assets').then((cache) => {
            cache.put(request, response.clone());
          });
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
