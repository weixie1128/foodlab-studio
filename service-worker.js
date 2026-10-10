const CACHE = 'foodlab-studio-v0.96.1';
const ASSETS = [
  './',
  './index.html',
  './styles.css?v=0.96.1',
  './boot-guard-v0154.js?v=0.96.1',
  './app.js?v=0.96.1',
  './chart-fixes.js?v=0.96.1',
  './template-fixes.js?v=0.96.1'
];

const isSameOrigin = request => new URL(request.url).origin === self.location.origin;

async function cachePut(request, response) {
  if (!response || !response.ok || response.type === 'opaque') return;
  try {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  } catch (e) { /* ignore */ }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(ASSETS.map(asset => cache.add(asset)));
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
  const request = event.request;
  if (request.method !== 'GET' || !isSameOrigin(request)) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(request, { cache: 'no-store' });
      await cachePut(request, response);
      return response;
    } catch (error) {
      const cached = await caches.match(request) || await caches.match(request, { ignoreSearch: true });
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const shell = await caches.match('./index.html') || await caches.match('./');
        if (shell) return shell;
      }
      throw error;
    }
  })());
});
