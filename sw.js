// K9 Studio Dogsitter 12.9.35 — Service Worker app-shell
const K9_SW_VERSION='12.9.35';
const CACHE=`k9-studio-${K9_SW_VERSION}`;
const APP_SHELL=[
  './','./index.html','./manifest.webmanifest','./css/styles.css',
  './js/core.js','./js/periods.js','./js/settings.js','./js/pdf-engine.js','./js/operations.js','./js/app.js',
  './assets/logo.png','./assets/icon-192.png','./assets/icon-512.png'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP_SHELL)).catch(()=>null).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('k9-studio-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.includes('/storage/')||url.pathname.includes('/rest/')||url.pathname.includes('/auth/'))return;
  if(req.mode==='navigate'){
    event.respondWith(fetch(req).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put('./index.html',copy));return res}).catch(()=>caches.match('./index.html')));
    return;
  }
  const isStatic=/\.(?:css|js|png|jpg|jpeg|svg|webmanifest)$/i.test(url.pathname);
  if(!isStatic)return;
  event.respondWith(caches.match(req,{ignoreSearch:true}).then(cached=>{
    const network=fetch(req).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy))}return res}).catch(()=>cached);
    return cached||network;
  }));
});
