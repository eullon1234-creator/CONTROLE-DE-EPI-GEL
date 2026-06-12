const CACHE_NAME = 'epi-gel-v1';

// Detecta o base path dinamicamente a partir do próprio sw.js
const BASE = self.location.pathname.replace(/\/sw\.js$/, '') || '';

const ASSETS = [
  `${BASE}/`,
  `${BASE}/index.html`,
  `${BASE}/favicon.svg`,
  `${BASE}/manifest.json`,
  `${BASE}/icon-192.png`,
  `${BASE}/icon-512.png`
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
