// ═══════════════════════════════════════════════════════════════
// Café LUX — Service Worker v4.2
// FIX: Preserves query strings (?table=N) for QR scan routing
// ═══════════════════════════════════════════════════════════════

const CACHE_NAME = 'lux-v4.2-' + new Date().toISOString().slice(0,10);
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/api-client.js',
  '/manifest.json'
];

// ── Install: pre-cache core assets ─────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clear old caches ─────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch handler ──────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // CRITICAL FIX: Never cache/intercept URLs with query parameters.
  // This ensures ?table=N QR scans always reach the live page with the param intact.
  if(url.search && url.search.length > 1){
    // Pass through to network with the URL unchanged
    event.respondWith(fetch(req));
    return;
  }

  // Never intercept API calls
  if(url.pathname.startsWith('/api/') || url.hostname.includes('railway.app')){
    return; // let browser handle
  }

  // Never intercept POST/PUT/PATCH/DELETE — only cache GETs
  if(req.method !== 'GET'){
    return;
  }

  // Standard cache-first strategy for static assets
  event.respondWith(
    caches.match(req).then(cached => {
      if(cached){
        // Return cache, refresh in background
        fetch(req).then(fresh => {
          if(fresh && fresh.status === 200){
            caches.open(CACHE_NAME).then(c => c.put(req, fresh.clone()));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(req).then(fresh => {
        if(fresh && fresh.status === 200 && url.origin === self.location.origin){
          const copy = fresh.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
        }
        return fresh;
      }).catch(() => caches.match('/index.html'));
    })
  );
});

// ── Message handler: force update ──────────────────────────────
self.addEventListener('message', event => {
  if(event.data === 'SKIP_WAITING'){
    self.skipWaiting();
  }
});
