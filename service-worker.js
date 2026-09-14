const CACHE = 'foodlab-studio-v0.19.0';
const BOOT_GUARD_FILE = './boot-guard-v0154.js?v=0.19.0';
const MAINTENANCE_FILE = './maintenance-v0149.js?v=0.14.9';
const TEMPLATE_FILE = './data-templates-v0150.js?v=0.15.0';
const UNIVARIATE_FILE = './univariate-templates-v0151.js?v=0.15.1';
const UNIVARIATE_CHART_FIX_FILE = './univariate-chart-fixes-v0152.js?v=0.15.2';
const HISTOGRAM_LAYER_FIX_FILE = './histogram-layer-fix-v0153.js?v=0.15.3';
const PERF_FILE = './perf-v0154.js?v=0.15.4';
const SERIES_CONTROLS_FILE = './series-controls-v0160.js?v=0.16.0';
const AXIS_SCALE_FILE = './axis-scale-v0170.js?v=0.17.0';
const KDE_MODULE_FIX_FILE = './kde-module-fix-v0190.js?v=0.19.0';
const ASSETS = [
  './',
  './index.html',
  './styles.css?v=0.19.0',
  './app.js?v=0.19.0',
  './chart-fixes.js?v=0.19.0',
  './template-fixes.js?v=0.19.0',
  BOOT_GUARD_FILE,
  MAINTENANCE_FILE,
  TEMPLATE_FILE,
  UNIVARIATE_FILE,
  UNIVARIATE_CHART_FIX_FILE,
  HISTOGRAM_LAYER_FIX_FILE,
  PERF_FILE,
  SERIES_CONTROLS_FILE,
  AXIS_SCALE_FILE,
  KDE_MODULE_FIX_FILE
];

const isSameOrigin = request => new URL(request.url).origin === self.location.origin;
const isTemplateFixes = request => new URL(request.url).pathname.endsWith('/template-fixes.js');

function patchLoaderSource() {
  return `\n;(() => {\n` +
    `  const files = [\n` +
    `    ['foodlab-maintenance-v0149','./maintenance-v0149.js?v=0.14.9'],\n` +
    `    ['foodlab-data-templates-v0150','./data-templates-v0150.js?v=0.15.0'],\n` +
    `    ['foodlab-univariate-templates-v0151','./univariate-templates-v0151.js?v=0.15.1'],\n` +
    `    ['foodlab-univariate-chart-fixes-v0152','./univariate-chart-fixes-v0152.js?v=0.15.2'],\n` +
    `    ['foodlab-histogram-layer-fix-v0153','./histogram-layer-fix-v0153.js?v=0.15.3'],\n` +
    `    ['foodlab-perf-v0154','./perf-v0154.js?v=0.15.4'],\n` +
    `    ['foodlab-series-controls-v0160','./series-controls-v0160.js?v=0.16.0'],\n` +
    `    ['foodlab-axis-scale-v0170','./axis-scale-v0170.js?v=0.17.0'],\n` +
    `    ['foodlab-kde-module-fix-v0190','./kde-module-fix-v0190.js?v=0.19.0']\n` +
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
  const body = text.includes('foodlab-kde-module-fix-v0190') ? text : text + patchLoaderSource();
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
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
      if (cached) return isTemplateFixes(request) ? withPatchLoaders(cached) : cached;
      if (request.mode === 'navigate') {
        const shell = await caches.match('./index.html') || await caches.match('./');
        if (shell) return shell;
      }
      throw error;
    }
  })());
});
