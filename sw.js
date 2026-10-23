/* Stracker Phase 3 offline shell — network-first with offline fallback.
   This worker caches app files only. It never deletes round data in localStorage/IndexedDB. */
const CACHE = 'stracker-p3-shell-20261023-6';
const RELEASE = '20261023-6';
const REQUIRED = ['./index.html', './home.css', './clubhouse/clubhouse.css', './clubhouse/clubhouse.js', './js/home.js'];
const OPTIONAL = ['./manifest.json', './images/-1-Logo+tag.png', './images/Home-Hdr-BG.png', './images/score-strip-hole.png'];
const shellURL = new URL('./index.html', self.registration.scope).href;

// Diagnostics and controlled activation; only the page can request an early switch.
self.addEventListener('message', event => {
  if (event.data?.type === 'STRACKER_VERSION') {
    event.ports?.[0]?.postMessage({ release: RELEASE, cache: CACHE });
  }
  if (event.data?.type === 'STRACKER_ACTIVATE_WHEN_SAFE') {
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Reload from the server rather than copying potentially stale HTTP-cached files.
    await cache.addAll(REQUIRED.map(path => new Request(new URL(path, self.registration.scope), { cache: 'reload' })));
    // Refuse to install an internally inconsistent release. Keep the previous
    // worker and its offline cache intact if deployment is incomplete.
    const html = await (await cache.match(new URL('./index.html', self.registration.scope))).text();
    const js = await (await cache.match(new URL('./js/home.js', self.registration.scope))).text();
    if (!html.includes(`const PAGE_RELEASE = '${RELEASE}'`) ||
        !js.includes(`window.STRACKER_HOME_JS_RELEASE = '${RELEASE}'`)) {
      throw new Error('Stracker release mismatch; preserving previous offline version');
    }
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

// Serve one coherent cached release for all app-shell files.
// Online updates are acquired through registration.update(), not individual file fetches.
const shellPaths = new Set([...REQUIRED, ...OPTIONAL].map(path =>
  new URL(path, self.registration.scope).pathname));
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const navigation = request.mode === 'navigate';
    const isAppNavigation = navigation &&
      (url.pathname === scope.pathname || url.pathname === new URL('./index.html', scope).pathname);
    const shellKey = isAppNavigation ? shellURL : request;
    const isShell = isAppNavigation || (!navigation && shellPaths.has(url.pathname));

    if (isShell) {
      const cached = await cache.match(shellKey, { ignoreSearch: true });
      if (cached) return cached;
      // Never mix network assets with a partially populated offline shell.
      // A failed installation cannot activate, so this is a defensive guard.
      return Response.error();
    }
    try {
      const response = await fetch(new Request(request, { cache: 'no-cache' }));
      if (response.ok && response.type === 'basic' && !navigation) {
        // Cache failures must not turn a successful network request into an error.
        try { await cache.put(request, response.clone()); } catch (err) {
          console.warn('Stracker cache write unavailable', err);
        }
      }
      return response;
    } catch (_) {
      const cached = navigation
        ? await cache.match(shellURL)
        : await cache.match(request, { ignoreSearch: true });
      return cached || Response.error();
    }
  })());
});
