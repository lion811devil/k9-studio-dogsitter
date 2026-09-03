// K9 Studio Dogsitter 12.9.52 — Service Worker aggiornamento affidabile
const K9_SW_VERSION='12.9.52';
const CACHE=`k9-studio-${K9_SW_VERSION}`;

const APP_SHELL=[
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css?v=12.9.52',
  './js/core.js?v=12.9.52',
  './js/periods.js?v=12.9.52',
  './js/settings.js?v=12.9.52',
  './js/pdf-engine.js?v=12.9.52',
  './js/operations.js?v=12.9.52',
  './js/app.js?v=12.9.52',
  './assets/logo.png',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(APP_SHELL))
      .catch(()=>null)
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(
        keys.filter(k=>k.startsWith('k9-studio-')&&k!==CACHE).map(k=>caches.delete(k))
      ))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;

  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.includes('/storage/')||url.pathname.includes('/rest/')||url.pathname.includes('/auth/'))return;

  if(req.mode==='navigate'){
    event.respondWith(
      fetch(req,{cache:'no-store'})
        .then(res=>{
          if(res.ok){
            const copy=res.clone();
            caches.open(CACHE).then(c=>c.put('./index.html',copy));
          }
          return res;
        })
        .catch(()=>caches.match('./index.html'))
    );
    return;
  }

  const isCode=/\.(?:js|css)$/i.test(url.pathname);
  const isStatic=/\.(?:png|jpg|jpeg|svg|webmanifest)$/i.test(url.pathname);

  // Codice applicativo: rete prima, cache solo come fallback offline.
  if(isCode){
    event.respondWith(
      fetch(req,{cache:'no-store'})
        .then(res=>{
          if(res.ok){
            const copy=res.clone();
            caches.open(CACHE).then(c=>c.put(req,copy));
          }
          return res;
        })
        .catch(()=>caches.match(req))
    );
    return;
  }

  if(isStatic){
    event.respondWith(
      caches.match(req).then(cached=>{
        const network=fetch(req,{cache:'no-store'})
          .then(res=>{
            if(res.ok){
              const copy=res.clone();
              caches.open(CACHE).then(c=>c.put(req,copy));
            }
            return res;
          })
          .catch(()=>cached);
        return cached||network;
      })
    );
  }
});
