/* BrewLite service worker (ADR 0032). It caches only content-hashed build assets, the icons and
 * the offline page, and serves the offline page when a navigation fails. Documents, RSC
 * payloads, Server Actions, the event streams and every API response go to the network, untouched. */
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = `brewlite-${VERSION}`;
const ICON_FILES =
  /^\/(icon-192|icon-512|icon-maskable-512|favicon-32|apple-touch-icon)\.png$|^\/(favicon|logo|logo-mono|symbol)\.svg$/;

/** 'network' | 'static' | 'navigation' — the whole routing decision, pure so a Node test can run it. */
function route(request) {
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return 'network';
  if (url.pathname.startsWith('/_next/static/') || ICON_FILES.test(url.pathname)) return 'static';
  if (request.mode === 'navigate') return 'navigation';
  return 'network';
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const page = await fetch('/offline', { cache: 'reload' });
      await cache.put('/offline', page.clone());
      // The offline page needs its own scripts and styles to work offline.
      const html = await page.text();
      const assets = [...html.matchAll(/\/_next\/static\/[^"'\\\s)]+/g)].map((m) => m[0]);
      const icons = ['/icon-192.png', '/icon-512.png', '/favicon.svg', '/logo.svg', '/symbol.svg'];
      await cache.addAll([...new Set([...assets, ...icons])]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) if (name !== CACHE) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const decision = route(event.request);
  if (decision === 'static') {
    event.respondWith(
      caches.match(event.request).then(
        (hit) =>
          hit ||
          fetch(event.request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(event.request, copy));
            }
            return response;
          }),
      ),
    );
  } else if (decision === 'navigation') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/offline')));
  }
});

if (typeof module !== 'undefined') module.exports = { route };
