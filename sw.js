const CACHE = 'k9-dogsitter-7.8.0';
const STATIC = [
  './',
  './index.html',
  './css/styles.css?v=7.8.0',
  './config.js?v=7.0.0',
  './js/pdf-engine.js?v=7.8.0',
  './js/app.js?v=7.8.0',
  './manifest.webmanifest',
  './assets/logo.png',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(STATIC))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  const isNavigation = event.request.mode === 'navigate';
  const isCritical = isNavigation || /\.(?:html|js|css)$/.test(url.pathname) || url.pathname.endsWith('/');

  if (isCritical) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(async () => {
          const hit = await caches.match(event.request);
          return hit || caches.match('./index.html');
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(hit => hit || fetch(event.request).then(response => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
      }
      return response;
    }))
  );
});
