/* Stracker Phase 3 offline app shell — scoped to this GitHub Pages project.
   No localStorage, round data, or remote API responses are modified. */
const CACHE = 'stracker-p3-shell-20261021-2';
const REQUIRED = ['./', './index.html', './home.css', './clubhouse/clubhouse.css', './clubhouse/clubhouse.js', './js/home.js'];
const OPTIONAL = ['./manifest.json', './images/-1-Logo+tag.png', './images/Home-Hdr-BG.png', './images/score-strip-hole.png'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(REQUIRED);
    await Promise.allSettled(OPTIONAL.map(path => cache.add(path)));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('stracker-p3-shell-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(new URL('./index.html', scope), response.clone());
        }
        return response;
      } catch (_) {
        return (await caches.match(new URL('./index.html', scope))) || Response.error();
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(request, {ignoreSearch:true});
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (_) { return Response.error(); }
  })());
});
