const CACHE_NAME = 'epi-gel-v1';
const ASSETS = [
  '/CONTROLE-DE-EPI-GEL/',
  '/CONTROLE-DE-EPI-GEL/index.html',
  '/CONTROLE-DE-EPI-GEL/favicon.svg',
  '/CONTROLE-DE-EPI-GEL/manifest.json',
  '/CONTROLE-DE-EPI-GEL/icon-192.png',
  '/CONTROLE-DE-EPI-GEL/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(() => {});
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request);
    })
  );
});
