const CACHE_NAME = 'facedoor-cache-v1';
const OFFLINE_URL = 'index.html';
const toCache = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json'
];
self.addEventListener('install', ev=>{
  ev.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(toCache)).then(self.skipWaiting()));
});
self.addEventListener('activate', ev=>{ ev.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', ev=>{
  ev.respondWith(caches.match(ev.request).then(resp=>resp || fetch(ev.request).then(r=>{ if(ev.request.method==='GET') { caches.open(CACHE_NAME).then(c=>c.put(ev.request, r.clone())); } return r; }).catch(()=>caches.match(OFFLINE_URL))));
});
