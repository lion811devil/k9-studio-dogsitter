// K9 Studio Dogsitter 12.8.7 — Service Worker stabile
const K9_SW_VERSION='12.8.7';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',()=>{});
