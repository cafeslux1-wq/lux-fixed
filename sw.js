// ═══════════════════════════════════════════════════════════════════
//  CAFÉ LUX — Service Worker v2.1 (Railway & PostgreSQL Optimized)
//  إصلاح مشكلة الـ QR وتوجيه البيانات للسيرفر الجديد
// ═══════════════════════════════════════════════════════════════════

const APP_SHELL_CACHE = 'lux-shell-v2.1';
const ASSETS_CACHE    = 'lux-assets-v2.1';
const API_CACHE       = 'lux-api-v2.1';
const FONT_CACHE      = 'lux-fonts-v1';

// الرابط الموحد الجديد على Railway
const API_BASE = 'https://cafeslux-api-production.up.railway.app';

const APP_SHELL = ['/', '/index.html', '/manifest.json', '/api-client.js'];

const LUXURY_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,400&family=DM+Sans:wght@300;400;500;600&family=Cinzel:wght@400;600&display=swap',
];

// الأنماط التي سيتم التعامل معها بنظام Stale-While-Revalidate (الصور والخطوط)
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
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (!request.url.startsWith('http')) return;

  // 🛡️ حماية رقم الطاولة (CRITICAL FIX)
  // إذا كان الرابط يحتوي على معامل ?table أو ?t، لا تقم بالاعتراض بالـ Cache
  if (url.searchParams.has('table') || url.searchParams.has('t')) {
    event.respondWith(fetch(request));
    return;
  }

  // Fonts: CacheFirst
  if (/fonts\.(gstatic|googleapis)\.com/.test(url.hostname)) {
    event.respondWith(cacheFirst(request, FONT_CACHE));
    return;
  }

  // API Requests: NetworkFirst (إرسال الطلبات للسيرفر الجديد مباشرة)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstAPI(request));
    return;
  }

  // Images: StaleWhileRevalidate
  if (SWR_PATTERNS.some(p => p.test(url.pathname) || p.test(url.hostname))) {
    event.respondWith(staleWhileRevalidate(request, ASSETS_CACHE));
    return;
  }

  // App Shell: NetworkFirst
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
    return (await caches.match(req)) || caches.match('/index.html');
  }
}

async function networkFirstAPI(req) {
  try {
    const fresh = await fetch(req, { signal: AbortSignal.timeout(6000) });
    if (fresh.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'offline', message: 'السيرفر غير متاح حالياً' }), {
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

// ── MESSAGE HANDLER ───────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  
  if (event.data?.type === 'CACHE_MENU') {
    caches.open(API_CACHE).then(c =>
      fetch(`${API_BASE}/api/products`).then(r => { if (r.ok) c.put(`${API_BASE}/api/products`, r); }).catch(() => {})
    );
  }
});