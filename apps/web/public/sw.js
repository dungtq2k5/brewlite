const CACHE_NAME = 'brewlite-static-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(caches.match(event.request).then((res) => res || fetch(event.request)));
    return;
  }

  event.respondWith(fetch(event.request).catch(() => caches.match('/offline')));
});
