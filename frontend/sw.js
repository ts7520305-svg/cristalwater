/* Public application shell only. Operational writes are owned by the field outbox. */
importScripts('/cw-push-session.js');
const CACHE = 'cristalwater-field-20260921-v96';
const APP_SHELL = ['/technician-field-mode','/technician-login','/cw-auth.js','/technician-auth-guard.js','/cw-field-offline.js','/cw-pump-reminders.js','/cw-field-reminders.js','/cw-field-recovery.js','/cw-field-photos.js','/cw-browser-push.js','/cw-push-session.js','/cw-proposal-requests.js','/cw-proposal-editor.js','/js/offline/offline-gps.js','/technician-gps','/technician-gps.js','/technician-field-mode.js','/cw-ui-feedback.js','/cw-auth-download.js','/crystal-os-v2-shell.js','/crystal-os-v2-nav.js','/cw-ui-kit.css','/cw-field-professional.css','/ui/foundation.css','/ui/core/navigation-context.js','/ui/design-system.js','/ui/state-adapter-v2.js'];
self.addEventListener('install', event => {
  APP_SHELL.push('/cw-field-write-store.js', '/cw-field-internal-alert.js', '/cw-field-route-preview.js', '/cw-legacy-route-cache.js', '/js/offline/offline-queue.js', '/js/offline/offline-photos.js', '/technician', '/technician.html', '/technician.js', '/logo-cristalwater.png');
  APP_SHELL.push('/socket.io/socket.io.js', '/js/theme.js', '/js/pwa/install-prompt.js', '/js/push/push-init.js', '/js/push/push-realtime.js', '/cristal-help-data.js', '/cristal-assist.js', '/cristal-assist.css', '/css/splash.css', '/css/crystal-v25.css', '/icons/icon-512.png', '/icons/icon-192.png');
  APP_SHELL.push('/cw-field-day-review.js', '/crystal-os-v2-phase2-adapter.css', '/ui/design-system.css');
  APP_SHELL.push('/cw-legacy-visit-drafts.js');
  APP_SHELL.push('/cw-field-alert-journal.js', '/cw-field-stock-request.js', '/cw-field-problem-report.js', '/technician-new-client', '/technician-new-client.js', '/cw-field-intake-review.js');
  APP_SHELL.push('/cw-shared-navigation.css');
  APP_SHELL.push('/cw-field-route-cache.js', '/cw-field-documents.js', '/cw-extra-visit-correction.js', '/field-equipment-maintenance.js');
  APP_SHELL.push('/cw-legacy-workday.js','/cw-incomplete-workflow.js','/cw-field-incomplete.js','/cw-field-visit-drafts.js');
  event.waitUntil(caches.open(CACHE).then(cache=>Promise.all(APP_SHELL.map(url=>cache.add(url)))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('cristalwater-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (url.origin !== self.location.origin || request.method !== 'GET' || url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return;
  event.respondWith((async()=>{
    const cacheReady = caches.open(CACHE).catch(()=>null);
    try {
      const response = await fetch(request);
      if (response.ok && !response.redirected) {
        const copy = response.clone();
        // Cache availability must never delay or replace a valid network response.
        event.waitUntil(cacheReady.then(cache=>cache?.put(request, copy)).catch(()=>null));
      }
      return response;
    } catch (_) {
      const cache = await cacheReady;
      const cached = await cache?.match(request, {ignoreSearch:request.mode==='navigate'}).catch(()=>null);
      return cached || new Response('Página indisponível sem ligação. Abra previamente o modo de campo com rede.', {status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }
  })());
});

self.addEventListener('push', event => {
  event.waitUntil((async()=>{
    let data={};try{data=event.data?.json()||{}}catch{}
    const state=await self.CWPushSession.read(),message=self.CWPushSession.presentation(data,state);
    if(!message)return;
    let target;try{target=new URL(data.url||'/technician-field-mode',self.location.origin)}catch{target=new URL('/login',self.location.origin)}
    const own=state.known&&state.owner===data.owner;
    await self.registration.showNotification(message.title,{body:message.body,tag:data.tag||'cristalwater-alert',renotify:true,requireInteraction:true,data:{owner:typeof data.owner==='string'?data.owner:null,url:own&&target.origin===self.location.origin?target.href:self.location.origin+'/login'}});
  })());
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||'/technician-field-mode',self.location.origin);
  if(target.origin!==self.location.origin)return;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{
    const existing=windows.find(client=>new URL(client.url).origin===target.origin);
    if(existing){await existing.navigate(target.href);return existing.focus()}
    return self.clients.openWindow(target.href);
  }));
});
