// ═══════════════════════════════════════════════════════════════════
//  CAFÉ LUX — API Client v2.0  (Production-Ready)
//  • Correct API_BASE → cafeslux-api-production.up.railway.app
//  • Smart sync: flushes only when pending items exist
//  • Full CRUD: products, categories, dashboard
//  • Auth guard: 401 → redirect to index.html
// ═══════════════════════════════════════════════════════════════════

(function(window) {
  'use strict';

  // ── CONFIG ─────────────────────────────────────────────────────
  const API_BASE     = window.LUX_API_URL || 'https://cafeslux-api-production.up.railway.app';
  const LS_PREFIX    = 'lux_';
  const SYNC_INTERVAL = 30000; // 30 seconds

  // ── STATE ──────────────────────────────────────────────────────
  let _token    = localStorage.getItem('lux_auth_token') || null;
  let _isOnline = navigator.onLine;
  let _cache    = {};

  window.addEventListener('online',  () => { _isOnline = true;  _showNetworkBanner('online');  LuxAPI._flushPending(); });
  window.addEventListener('offline', () => { _isOnline = false; _showNetworkBanner('offline'); });

  // ── NETWORK BANNER ─────────────────────────────────────────────
  function _showNetworkBanner(state) {
    let b = document.getElementById('lux-net-banner');
    if (!b) {
      b = document.createElement('div');
      b.id = 'lux-net-banner';
      b.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);z-index:9999;padding:8px 20px;border-radius:20px;font-size:12px;font-weight:600;transition:all .3s;pointer-events:none;opacity:0;';
      document.body.appendChild(b);
    }
    if (state === 'online') {
      b.style.background = 'rgba(61,190,122,.92)'; b.style.color = '#fff';
      b.textContent = '✓ Connexion rétablie — Synchronisation...';
      b.style.opacity = '1';
      setTimeout(() => { b.style.opacity = '0'; }, 2500);
    } else {
      b.style.background = 'rgba(224,82,82,.92)'; b.style.color = '#fff';
      b.textContent = '⚠ Hors ligne — Mode local activé';
      b.style.opacity = '1';
    }
  }

  // ── HTTP HELPERS ───────────────────────────────────────────────
  async function _req(method, path, data, skipAuth) {
    const headers = { 'Content-Type': 'application/json' };
    if (_token && !skipAuth) headers['Authorization'] = 'Bearer ' + _token;
    const opts = { method, headers };
    if (data) opts.body = JSON.stringify(data);
    const res = await fetch(API_BASE + path, opts);
    if (res.status === 401) {
      _token = null;
      localStorage.removeItem('lux_auth_token');
      localStorage.removeItem('lux_session');
      // Only redirect if not already on index
      if (!path.includes('/auth/') && window.location.pathname.includes('cafe-lux')) {
        window.location.replace('index.html');
      }
    }
    if (!res.ok) throw new Error('API ' + res.status + ': ' + path);
    return res.json();
  }
  const _get   = p     => _req('GET',    p);
  const _post  = (p,d) => _req('POST',   p, d);
  const _patch = (p,d) => _req('PATCH',  p, d);
  const _del   = p     => _req('DELETE', p);

  // ── CACHE ──────────────────────────────────────────────────────
  function _getCache(key)           { return _cache[key] || null; }
  function _setCache(key, data, ttl=30000) { _cache[key]=data; setTimeout(()=>delete _cache[key], ttl); }

  // ── LOCAL STORAGE ──────────────────────────────────────────────
  function _ls(key, def)    { try { return JSON.parse(localStorage.getItem(LS_PREFIX+key)) || def; } catch { return def; } }
  function _lsSet(key, val) { localStorage.setItem(LS_PREFIX+key, JSON.stringify(val)); }

  // ── PENDING QUEUE ──────────────────────────────────────────────
  function _queue(action, data) {
    const q = _ls('pending_sync', []);
    q.push({ action, data, ts: Date.now() });
    _lsSet('pending_sync', q);
  }

  // ────────────────────────────────────────────────────────────────
  const LuxAPI = {

    isOnline: () => _isOnline,
    hasAuth:  () => !!_token,

    // ── AUTH ──────────────────────────────────────────────────────
    async login(username, password) {
      const data = await _post('/api/auth/login', { username, password });
      _token = data.token;
      localStorage.setItem('lux_auth_token', _token);
      return data;
    },
    logout() {
      _token = null;
      localStorage.removeItem('lux_auth_token');
      localStorage.removeItem('lux_session');
    },

    // ── ORDERS ────────────────────────────────────────────────────
    async getOrders(params = {}) {
      if (!_isOnline) return _ls('web_orders', []);
      try {
        const qs = new URLSearchParams(params).toString();
        const data = await _get('/api/orders' + (qs ? '?' + qs : ''));
        _lsSet('web_orders', data);
        return data;
      } catch { return _ls('web_orders', []); }
    },
    async createOrder(order) {
      const local = { ...order, id: Date.now(), status:'pending', _local:true };
      const all = _ls('web_orders', []); all.unshift(local); _lsSet('web_orders', all);
      if (!_isOnline) { _queue('createOrder', order); return local; }
      try {
        const saved = await _post('/api/orders', order);
        const updated = _ls('web_orders',[]).map(o => o._local && o.id===local.id ? saved : o);
        _lsSet('web_orders', updated);
        return saved;
      } catch { _queue('createOrder', order); return local; }
    },
    async updateOrderStatus(id, status) {
      const orders = _ls('web_orders',[]); const o = orders.find(x=>x.id===id);
      if (o) { o.status=status; _lsSet('web_orders', orders); }
      if (!_isOnline) { _queue('updateOrder', { id, status }); return; }
      try { await _patch('/api/orders/'+id+'/status', { status }); }
      catch { _queue('updateOrder', { id, status }); }
    },

    // ── MENU ──────────────────────────────────────────────────────
    async getMenu() {
      const cached = _getCache('menu');
      if (cached) return cached;
      if (!_isOnline) return _ls('menu_cache', []);
      try {
        const data = await _get('/api/menu');
        _setCache('menu', data, 300000);
        _lsSet('menu_cache', data);
        return data;
      } catch { return _ls('menu_cache', []); }
    },

    // ── PRODUCTS CRUD (Admin) ─────────────────────────────────────
    async getProducts(params = {}) {
      if (!_isOnline) return _ls('products_cache', []);
      try {
        const qs = new URLSearchParams(params).toString();
        const data = await _get('/api/products' + (qs ? '?' + qs : ''));
        _lsSet('products_cache', data);
        return data;
      } catch { return _ls('products_cache', []); }
    },
    async createProduct(product) {
      const saved = await _post('/api/products', product);
      delete _cache['menu']; _lsSet('products_cache', []);
      return saved;
    },
    async updateProduct(id, updates) {
      const saved = await _patch('/api/products/'+id, updates);
      delete _cache['menu'];
      return saved;
    },
    async deleteProduct(id) {
      const result = await _del('/api/products/'+id);
      delete _cache['menu']; _lsSet('products_cache', []);
      return result;
    },
    async getCategories() {
      if (!_isOnline) return [];
      try { return await _get('/api/categories'); }
      catch { return []; }
    },

    // ── CUSTOMERS ─────────────────────────────────────────────────
    async getCustomer(phone) {
      if (!phone) return null;
      if (!_isOnline) return _ls('web_customers',{})[phone] || null;
      try {
        const data = await _get('/api/customers/'+encodeURIComponent(phone));
        const all = _ls('web_customers',{}); all[phone]=data; _lsSet('web_customers',all);
        return data;
      } catch { return _ls('web_customers',{})[phone] || null; }
    },

    // ── RESERVATIONS ──────────────────────────────────────────────
    async getReservations(date) {
      if (!_isOnline) { const all=_ls('reservations',[]); return date ? all.filter(r=>r.date===date) : all; }
      try { return await _get('/api/reservations' + (date ? '?date='+date : '')); }
      catch { return _ls('reservations',[]); }
    },
    async createReservation(res) {
      const local = { ...res, id:Date.now(), status:'confirmed', _local:true };
      const all = _ls('reservations',[]); all.unshift(local); _lsSet('reservations',all);
      if (!_isOnline) { _queue('createReservation', res); return local; }
      try {
        const saved = await _post('/api/reservations', res);
        const updated = _ls('reservations',[]).map(r => r._local&&r.id===local.id ? saved : r);
        _lsSet('reservations', updated);
        return saved;
      } catch { _queue('createReservation', res); return local; }
    },

    // ── REVIEWS ───────────────────────────────────────────────────
    async getReviews() {
      if (!_isOnline) return _ls('reviews',[]);
      try { const d=await _get('/api/reviews'); _lsSet('reviews',d); return d; }
      catch { return _ls('reviews',[]); }
    },
    async createReview(review) {
      const local = { ...review, id:Date.now(), _local:true };
      const all = _ls('reviews',[]); all.unshift(local); _lsSet('reviews',all);
      if (!_isOnline) { _queue('createReview', review); return local; }
      try { return await _post('/api/reviews', review); }
      catch { _queue('createReview', review); return local; }
    },

    // ── ANALYTICS / DASHBOARD ─────────────────────────────────────
    async getAnalytics(period = '30d') {
      if (!_isOnline) return null;
      try { return await _get('/api/analytics/summary?period='+period); } catch { return null; }
    },
    async getDashboard() {
      if (!_isOnline) return null;
      try { return await _get('/api/analytics/dashboard'); } catch { return null; }
    },
    async trackEvent(category, action, label) {
      if (_isOnline && _token) _post('/api/analytics/event', { category, action, label }).catch(()=>{});
    },

    // ── STOCK ──────────────────────────────────────────────────────
    async getStock() {
      if (!_isOnline) return { items:[], alerts:[] };
      try { return await _get('/api/stock'); } catch { return { items:[], alerts:[] }; }
    },
    async updateStock(id, qty) {
      _queue('updateStock', { id, qty });
      if (_isOnline) await _patch('/api/stock/'+id, { quantity: qty }).catch(()=>{});
    },

    // ── GIFT CARDS ────────────────────────────────────────────────
    async createGiftCard(gc) {
      const all=_ls('gift_cards',[]); const local={...gc,id:Date.now()}; all.unshift(local); _lsSet('gift_cards',all);
      if (_isOnline) try { return await _post('/api/gift-cards',gc); } catch {}
      return local;
    },
    async checkGiftCard(code) {
      if (_isOnline) try { return await _get('/api/gift-cards/'+code.toUpperCase()); } catch {}
      return _ls('gift_cards',[]).find(g=>g.code===code.toUpperCase()) || null;
    },

    // ── COUPONS ───────────────────────────────────────────────────
    async validateCoupon(code, subtotal) {
      if (_isOnline) try { return await _post('/api/coupons/validate', { code, subtotal }); } catch {}
      const local = _ls('coupons',[]).find(c=>c.code===code.toUpperCase());
      if (!local) return { valid:false, error:'Code invalide' };
      if (subtotal < (local.minOrder||0)) return { valid:false, error:'Minimum '+local.minOrder+' MAD requis' };
      return { valid:true, coupon:local };
    },

    // ── TRANSACTIONS ──────────────────────────────────────────────
    async saveTransaction(tx) {
      const all = _ls('transactions',[]); all.unshift(tx); _lsSet('transactions', all.slice(0,500));
      if (_isOnline && _token) _post('/api/transactions',tx).catch(()=>_queue('saveTransaction',tx));
      else _queue('saveTransaction',tx);
    },
    async getTransactions(params = {}) {
      if (!_isOnline) return _ls('transactions',[]);
      try { return await _get('/api/transactions?' + new URLSearchParams(params)); }
      catch { return _ls('transactions',[]); }
    },

    // ── STAFF ─────────────────────────────────────────────────────
    async getStaff() {
      if (!_isOnline) return _ls('employees',[]);
      try { const d=await _get('/api/staff'); _lsSet('employees',d); return d; }
      catch { return _ls('employees',[]); }
    },
    async logAttendance(empId, type, coords) {
      const rec = { empId, type, time:new Date().toISOString(), lat:coords?.lat, lng:coords?.lng };
      const att = _ls('presences',[]); att.unshift(rec); _lsSet('presences',att);
      if (_isOnline) _post('/api/staff/attendance', rec).catch(()=>{});
    },

    // ── SAAS LEADS ────────────────────────────────────────────────
    async saveSaasLead(lead) {
      if (_isOnline) {
        try { return await _req('POST', '/api/saas/leads', lead, true); }
        catch(e) { console.warn('[LUX] SaaS lead:', e.message); }
      }
      const leads = _ls('saas_leads',[]); leads.push({...lead,ts:new Date().toISOString()}); _lsSet('saas_leads',leads);
      return { success:true, offline:true };
    },

    // ── SMART SYNC ────────────────────────────────────────────────
    async _flushPending() {
      const queue = _ls('pending_sync',[]);
      if (!queue.length || !_isOnline) return;
      const remaining = [];
      for (const item of queue) {
        try {
          switch(item.action) {
            case 'createOrder':       await _post('/api/orders', item.data); break;
            case 'updateOrder':       await _patch('/api/orders/'+item.data.id+'/status', { status:item.data.status }); break;
            case 'createReservation': await _post('/api/reservations', item.data); break;
            case 'createReview':      await _post('/api/reviews', item.data); break;
            case 'saveTransaction':   await _post('/api/transactions', item.data); break;
            case 'updateStock':       await _patch('/api/stock/'+item.data.id, { quantity:item.data.qty }); break;
            default: remaining.push(item);
          }
        } catch { remaining.push(item); }
      }
      _lsSet('pending_sync', remaining);
      if (queue.length - remaining.length > 0)
        console.log('[LUX API] Synced', queue.length - remaining.length, 'items');
    },

    // ── HEALTH CHECK ──────────────────────────────────────────────
    async checkHealth() {
      try {
        const data = await fetch(API_BASE+'/health', { signal:AbortSignal.timeout(4000) }).then(r=>r.json());
        _isOnline = true;
        return data;
      } catch { _isOnline = false; return null; }
    },

    // ── INIT ──────────────────────────────────────────────────────
    async init() {
      await this.checkHealth();
      if (_isOnline) this._flushPending();
      // Smart interval: only flush when queue has items, else just health-check
      setInterval(async () => {
        if (!_isOnline) { await this.checkHealth(); return; }
        const pending = _ls('pending_sync',[]);
        if (pending.length > 0) await this._flushPending();
      }, SYNC_INTERVAL);
      console.log('[LUX API v2.0]', _isOnline ? 'Online → '+API_BASE : 'Offline (localStorage)');
      return _isOnline;
    }
  };

  window.LuxAPI = LuxAPI;

})(window);
