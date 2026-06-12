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
  self.skipWaiting(); // Força o Service Worker atualizado a ser ativado imediatamente
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch((err) => console.log('Erro ao pré-carregar recursos:', err));
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Removendo cache antigo:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Intercepta apenas requisições para o mesmo domínio
  if (url.origin !== self.location.origin) {
    return;
  }

  // Estratégia Network-First para a página principal (HTML)
  // Isso garante que se houver internet, o usuário sempre pegará a versão mais recente com os nomes corretos dos JS/CSS novos
  if (e.request.mode === 'navigate' || e.request.url.endsWith('/') || e.request.url.endsWith('index.html')) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Estratégia Cache-First com cache dinâmico para os demais assets (JS, CSS, imagens)
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(e.request).then((res) => {
        // Apenas faz cache dinâmico de assets do próprio app (ex: pasta assets, favicon, manifest)
        if (res.status === 200 && (
          e.request.url.includes('/assets/') ||
          e.request.url.includes('favicon.svg') ||
          e.request.url.includes('manifest.json')
        )) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
