const CACHE='foodlab-studio-v0.13.8';
const ASSETS=['./','./index.html','./styles.css?v=0.13.8','./app.js?v=0.13.8','./chart-fixes.js?v=0.13.8','./template-fixes.js?v=0.13.8'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==location.origin)return;
  event.respondWith(fetch(event.request,{cache:'no-store'}).then(res=>{
    const copy=res.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return res;
  }).catch(()=>caches.match(event.request)));
});
