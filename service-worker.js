const CACHE = 'foodlab-studio-v0.15.0';
const MAINTENANCE_FILE = './maintenance-v0149.js?v=0.14.9';
const TEMPLATE_FILE = './data-templates-v0150.js?v=0.15.0';
const ASSETS = [
  './',
  './index.html',
  './styles.css?v=0.14.8',
  './app.js?v=0.14.8',
  './chart-fixes.js?v=0.14.8',
  './template-fixes.js?v=0.14.8',
  MAINTENANCE_FILE,
  TEMPLATE_FILE
];

const isSameOrigin = request => new URL(request.url).origin === self.location.origin;
const isTemplateFixes = request => new URL(request.url).pathname.endsWith('/template-fixes.js');

function patchLoaderSource() {
  return `\n;(() => {\n` +
    `  const files = [\n` +
    `    ['foodlab-maintenance-v0149','./maintenance-v0149.js?v=0.14.9'],\n` +
    `    ['foodlab-data-templates-v0150','./data-templates-v0150.js?v=0.15.0']\n` +
    `  ];\n` +
    `  files.forEach(([id,src]) => {\n` +
    `    if (document.getElementById(id)) return;\n` +
    `    const s = document.createElement('script');\n` +
    `    s.id = id; s.src = src; s.async = false;\n` +
    `    (document.head || document.documentElement).appendChild(s);\n` +
    `  });\n` +
    `})();\n`;
}

async function withPatchLoaders(response) {
  if (!response || !response.ok) return response;
  const text = await response.text();
  const headers = new Headers(response.headers);
  headers.set('content-type', 'application/javascript; charset=utf-8');
  headers.delete('content-length');
  headers.delete('content-encoding');
  const body = text.includes('foodlab-data-templates-v0150') ? text : text + patchLoaderSource();
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function cachePut(request, response) {
  if (!response || !response.ok || response.type === 'opaque') return;
  const cache = await caches.open(CACHE);
  await cache.put(request, response.clone());
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
      let response = await fetch(request, { cache: 'no-store' });
      if (isTemplateFixes(request)) response = await withPatchLoaders(response);
      await cachePut(request, response);
      return response;
    } catch (error) {
      const cached = await caches.match(request) || await caches.match(request, { ignoreSearch: true });
      if (cached) {
        if (isTemplateFixes(request)) return withPatchLoaders(cached);
        return cached;
      }
      if (request.mode === 'navigate') {
        const shell = await caches.match('./index.html') || await caches.match('./');
        if (shell) return shell;
      }
      throw error;
    }
  })());
});
