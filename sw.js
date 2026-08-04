const CACHE = 'k9-dogsitter-10.0.0';
const STATIC = [
  './', './index.html', './css/styles.css?v=10.0.0', './config.js?v=10.0.0',
  './js/core.js?v=10.0.0', './js/periods.js?v=10.0.0', './js/settings.js?v=10.0.0',
  './js/pdf-engine.js?v=10.0.0', './js/operations.js?v=10.0.0', './js/app.js?v=10.0.0', './manifest.webmanifest',
  './assets/logo.png', './assets/icon-192.png', './assets/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(STATIC.map(async url => {
      const response = await fetch(url, { cache: 'reload' });
      if (!response.ok) throw new Error(`Risorsa non disponibile: ${url}`);
      await cache.put(url, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const isNavigation = event.request.mode === 'navigate';
  const isCritical = isNavigation || /\.(?:html|js|css)$/.test(url.pathname) || url.pathname.endsWith('/');
  if (isCritical) {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request, { cache: 'no-store' });
        if (response.ok && response.type === 'basic') {
          const cache = await caches.open(CACHE);
          await cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        return (await caches.match(event.request)) || (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(CACHE);
      await cache.put(event.request, response.clone());
    }
    return response;
  })());
});
