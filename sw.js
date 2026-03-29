// ═══════════════════════════════════════════════════════════════════
//  CAFÉ LUX — Service Worker v2.0
//  Luxury offline-first caching strategy
// ═══════════════════════════════════════════════════════════════════

const APP_SHELL_CACHE = 'lux-shell-v2';
const ASSETS_CACHE    = 'lux-assets-v2';
const API_CACHE       = 'lux-api-v2';
const FONT_CACHE      = 'lux-fonts-v1';
const API_BASE        = 'https://cafeslux-api-production.up.railway.app';

const APP_SHELL = ['/', '/index.html', '/manifest.json', '/api-client.js'];

const LUXURY_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,400&family=DM+Sans:wght@300;400;500;600&family=Cinzel:wght@400;600&display=swap',
];

const CACHEABLE_API = ['/api/menu', '/api/v1/menu/public', '/api/reviews'];
const SWR_PATTERNS  = [/\.(png|jpg|jpeg|webp|gif|svg|ico)$/, /fonts\.gstatic\.com/];

// ── INSTALL ──────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      caches.open(APP_SHELL_CACHE).then(c => c.addAll(APP_SHELL).catch(() => {})),
      caches.open(FONT_CACHE).then(c => c.addAll(LUXURY_ASSETS).catch(() => {})),
    ]).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  const keep = [APP_SHELL_CACHE, ASSETS_CACHE, API_CACHE, FONT_CACHE];
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !keep.includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── FETCH ────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (!request.url.startsWith('http')) return;
  if (/google-analytics|googletagmanager/.test(request.url)) return;

  const url = new URL(request.url);

  // Fonts: CacheFirst (permanent)
  if (/fonts\.(gstatic|googleapis)\.com/.test(url.hostname)) {
    event.respondWith(cacheFirst(request, FONT_CACHE));
    return;
  }

  // Cacheable API: NetworkFirst
  if (CACHEABLE_API.some(p => url.pathname.startsWith(p))) {
    event.respondWith(networkFirstAPI(request));
    return;
  }

  // Images: StaleWhileRevalidate
  if (SWR_PATTERNS.some(p => p.test(url.pathname) || p.test(url.hostname))) {
    event.respondWith(staleWhileRevalidate(request, ASSETS_CACHE));
    return;
  }

  // App Shell + navigation: NetworkFirst
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirstShell(request));
  }
});

// ── STRATEGIES ───────────────────────────────────────────────────────
async function cacheFirst(req, name) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh.ok) (await caches.open(name)).put(req, fresh.clone());
    return fresh;
  } catch {
    return new Response('', { status: 503 });
  }
}

async function networkFirstShell(req) {
  try {
    const fresh = await fetch(req, { signal: AbortSignal.timeout(5000) });
    if (fresh.ok) (await caches.open(APP_SHELL_CACHE)).put(req, fresh.clone());
    return fresh;
  } catch {
    return (await caches.match(req)) ||
           (req.destination === 'document' ? caches.match('/index.html') : null) ||
           new Response('Offline', { status: 503 });
  }
}

async function networkFirstAPI(req) {
  try {
    const fresh = await fetch(req, { signal: AbortSignal.timeout(6000) });
    if (fresh.ok) (await caches.open(API_CACHE)).put(req, fresh.clone());
    return fresh;
  } catch {
    const cached = await caches.match(req, { cacheName: API_CACHE });
    if (cached) {
      const h = new Headers(cached.headers);
      h.set('X-LUX-Cache', 'stale');
      return new Response(cached.body, { status: 200, headers: h });
    }
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function staleWhileRevalidate(req, name) {
  const cache   = await caches.open(name);
  const cached  = await cache.match(req);
  const promise = fetch(req).then(f => { if (f.ok) cache.put(req, f.clone()); return f; }).catch(() => null);
  return cached ?? (await promise) ?? new Response('', { status: 503 });
}

// ── PUSH NOTIFICATIONS ───────────────────────────────────────────────
self.addEventListener('push', event => {
  let d = { title: '✦ Café LUX', body: '', url: '/', tag: 'lux' };
  try { if (event.data) d = { ...d, ...event.data.json() }; } catch {}
  event.waitUntil(
    self.registration.showNotification(d.title, {
      body: d.body, icon: '/icons/icon-192.png', badge: '/icons/badge-72.png',
      vibrate: [150, 75, 150], tag: d.tag, renotify: true,
      data: { url: d.url },
      actions: [{ action: 'open', title: '📱 Ouvrir' }, { action: 'dismiss', title: '✕' }],
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(all => {
      const w = all.find(c => c.url.includes(self.location.origin));
      return w ? w.focus().then(c => c.navigate(url)) : clients.openWindow(url);
    })
  );
});

// ── BACKGROUND SYNC ──────────────────────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'lux-sync-orders') {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(all =>
        all.forEach(c => c.postMessage({ type: 'LUX_SYNC_REQUESTED' }))
      )
    );
  }
});

// ── MESSAGE HANDLER ───────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'CACHE_MENU') {
    caches.open(API_CACHE).then(c =>
      fetch(`${API_BASE}/api/v1/menu/public`).then(r => { if (r.ok) c.put(`${API_BASE}/api/v1/menu/public`, r); }).catch(() => {})
    );
  }
  if (event.data?.type === 'SHOW_NOTIFICATION') {
    const { title = '✦ Café LUX', body, url = '/' } = event.data;
    self.registration.showNotification(title, { body, icon: '/icons/icon-192.png', data: { url } });
  }
});
