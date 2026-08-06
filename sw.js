const CACHE = 'k9-dogsitter-12.8.0';
const APP_SHELL = [
  './index.html',
  './css/styles.css?v=12.8.0',
  './config.js?v=12.8.0',
  './js/core.js?v=12.8.0',
  './js/periods.js?v=12.8.0',
  './js/settings.js?v=12.8.0',
  './js/pdf-engine.js?v=12.8.0',
  './js/operations.js?v=12.8.0',
  './js/app.js?v=12.8.0',
  './manifest.webmanifest',
  './assets/logo.png',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const url of APP_SHELL) {
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (response.ok) await cache.put(url, response.clone());
      } catch (_) {}
    }
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
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request, { cache: 'no-store' });
        if (fresh.ok) {
          const cache = await caches.open(CACHE);
          await cache.put('./index.html', fresh.clone());
        }
        return fresh;
      } catch (_) {
        return (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  const critical = /\.(?:js|css|html)$/.test(url.pathname);
  if (critical) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request, { cache: 'no-store' });
        if (fresh.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(event.request, fresh.clone());
        }
        return fresh;
      } catch (_) {
        return (await caches.match(event.request)) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    const fresh = await fetch(event.request);
    if (fresh.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(event.request, fresh.clone());
    }
    return fresh;
  })());
});
