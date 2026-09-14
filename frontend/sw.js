/* Public application shell only. Operational writes are owned by the field outbox. */
const CACHE = 'cristalwater-field-20260914-v1';
const APP_SHELL = ['/technician-field-mode','/technician-login','/cw-auth.js','/technician-auth-guard.js','/cw-field-offline.js','/cw-field-photos.js','/technician-field-mode.js','/cw-ui-feedback.js','/cw-auth-download.js','/crystal-os-v2-shell.js','/crystal-os-v2-nav.js','/cw-ui-kit.css','/ui/foundation.css','/ui/core/navigation-context.js','/ui/design-system.js','/ui/state-adapter-v2.js'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache=>Promise.all(APP_SHELL.map(url=>cache.add(url).catch(()=>null)))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('cristalwater-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (url.origin !== self.location.origin || request.method !== 'GET' || url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return;
  event.respondWith((async()=>{
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      if (response.ok && !response.redirected) await cache.put(request, response.clone());
      return response;
    } catch (_) {
      const cached = await cache.match(request, {ignoreSearch:request.mode==='navigate'});
      return cached || new Response('Página indisponível sem ligação. Abra previamente o modo de campo com rede.', {status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }
  })());
});
