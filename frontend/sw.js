/* Cristal Water Enterprise — V22 ORE Safe Service Worker
   - Não faz cache destrutiva de navegações com redirect.
   - Mantém fila offline para mutações quando não existe rede.
   - Evita erros Chrome: redirected response with redirect mode not follow.
*/
const CACHE = 'cristalwater-v22-6-15-professional-ui';
const DB_NAME = 'cristalwater-v22-offline';
const DB_VERSION = 2;
const PAYLOAD_STORE = 'PayloadQueue';
const MEDIA_STORE = 'MediaQueue';

const APP_SHELL = [
  '/',
  '/login',
  '/admin-dashboard',
  '/technician-login',
  '/technician',
  '/manifest.json',
  '/cristal-assist.css',
  '/cristal-assist.js',
  '/cristal-help-data.js',
  '/cw-enterprise-sidebar.js',
  '/enterprise-ui.css'
];

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PAYLOAD_STORE)) db.createObjectStore(PAYLOAD_STORE, { keyPath: 'id', autoIncrement: true });
      if (!db.objectStoreNames.contains(MEDIA_STORE)) db.createObjectStore(MEDIA_STORE, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function put(storeName, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).add(value);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function getAll(storeName) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function remove(storeName, id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function queueRequest(request) {
  const clone = request.clone();
  const headers = {};
  clone.headers.forEach((value, key) => { headers[key] = value; });
  const body = await clone.arrayBuffer();
  const record = { url: clone.url, method: clone.method, headers, body, createdAt: Date.now(), status: 'PENDING_SYNC' };
  const contentType = headers['content-type'] || '';
  const isMedia = clone.url.includes('/photos') || clone.url.includes('/media') || contentType.includes('multipart/form-data');
  await put(isMedia ? MEDIA_STORE : PAYLOAD_STORE, record);
  if (self.registration.sync) {
    try { await self.registration.sync.register('cristalwater-v22-sync'); } catch (_) {}
  }
  return new Response(JSON.stringify({ ok: true, offline: true, status: 'PENDING_SYNC' }), { status: 202, headers: { 'Content-Type': 'application/json' } });
}

async function replayStore(storeName) {
  const items = await getAll(storeName);
  for (const item of items) {
    try {
      const res = await fetch(item.url, { method: item.method, headers: item.headers, body: item.body, redirect: 'follow' });
      if (!res.ok) break;
      await remove(storeName, item.id);
    } catch (_) { break; }
  }
}

async function syncQueues() {
  await replayStore(PAYLOAD_STORE);
  await replayStore(MEDIA_STORE);
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL).catch(() => null)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  if (!url.href.startsWith(self.location.origin)) return;

  const dynamicAdminAsset =
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/admin') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.includes('cw-');

  if (req.method === 'GET' && dynamicAdminAsset) {
    event.respondWith(fetch(req, { redirect: 'follow', cache: 'no-store' }).catch(() => caches.match(req)));
    return;
  }

  // Navegações HTML: nunca guardar redirects no cache. Isto elimina o erro redirect-mode no Chrome.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req, { redirect: 'follow' }).catch(() => caches.match('/admin-dashboard').then(cached => cached || caches.match('/'))));
    return;
  }

  if (req.method === 'GET') {
    event.respondWith(fetch(req, { redirect: 'follow' }).then(res => {
      if (res && res.ok && res.type === 'basic' && !res.redirected) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => null);
      }
      return res;
    }).catch(() => caches.match(req)));
    return;
  }

  event.respondWith(fetch(req.clone(), { redirect: 'follow' }).catch(() => queueRequest(req)));
});

self.addEventListener('sync', event => {
  if (event.tag === 'cristalwater-v22-sync') event.waitUntil(syncQueues());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'FORCE_SYNC') event.waitUntil(syncQueues());
});
