/* Stracker Phase 3 offline shell — network-first with offline fallback.
   This worker caches app files only. It never deletes round data in localStorage/IndexedDB. */
const CACHE = 'stracker-p3-shell-20261023-3';
const REQUIRED = ['./', './index.html', './home.css', './clubhouse/clubhouse.css', './clubhouse/clubhouse.js', './js/home.js'];
const OPTIONAL = ['./manifest.json', './images/-1-Logo+tag.png', './images/Home-Hdr-BG.png', './images/score-strip-hole.png'];
const shellURL = new URL('./index.html', self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Reload from the server rather than copying potentially stale HTTP-cached files.
    await cache.addAll(REQUIRED.map(path => new Request(new URL(path, self.registration.scope), { cache: 'reload' })));
    await Promise.allSettled(OPTIONAL.map(path =>
      cache.add(new Request(new URL(path, self.registration.scope), { cache: 'reload' }))));
    // Wait until existing controlled pages close before activating a new worker.
    // Never take over an in-progress scoring session automatically.
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('stracker-p3-shell-') && key !== CACHE)
      .map(key => caches.delete(key)));
    // Do not seize control of pages already running an older app version.
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;

  event.respondWith((async () => {
    try {
      // Always prefer current files while online, including navigation and scripts.
      const response = await fetch(new Request(request, { cache: 'no-cache' }));
      if (response.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE);
        // Cache index.html as the common offline navigation fallback.
        // Only the actual app entry page may refresh the offline shell.
        // Never overwrite index.html with an unrelated navigation response.
        if (request.mode !== 'navigate' || url.href === shellURL || url.href === new URL('./', self.registration.scope).href) {
          const key = request.mode === 'navigate' ? shellURL : request;
          await cache.put(key, response.clone());
        }
      }
      return response;
    } catch (_) {
      const cached = request.mode === 'navigate'
        ? await caches.match(shellURL)
        : await caches.match(request, { ignoreSearch: true });
      return cached || Response.error();
    }
  })());
});
