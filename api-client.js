
// ═══════════════════════════════════════════════════════════════════
//  CAFÉ LUX — API Client v1.0
//  Connects frontend to Railway backend API
//  Falls back to localStorage when offline
// ═══════════════════════════════════════════════════════════════════

(function(window) {
  'use strict';

  // ── CONFIG ─────────────────────────────────────────────────────
  const API_BASE = window.LUX_API_URL || 'https://api.cafeslux.com';
  const LS_PREFIX = 'lux_';
  const SYNC_INTERVAL = 30000; // 30s

  // ── STATE ──────────────────────────────────────────────────────
  let _token = localStorage.getItem('lux_auth_token') || null;
  let _isOnline = navigator.onLine;
  let _pendingSync = [];
  let _cache = {};

  window.addEventListener('online',  () => { _isOnline = true;  LuxAPI._flushPending(); _showNetworkBanner('online'); });
  window.addEventListener('offline', () => { _isOnline = false; _showNetworkBanner('offline'); });

  // ── NETWORK BANNER ─────────────────────────────────────────────
  function _showNetworkBanner(state) {
    let banner = document.getElementById('lux-network-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'lux-network-banner';
      banner.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);z-index:9999;padding:8px 20px;border-radius:20px;font-size:12px;font-weight:600;transition:all .3s;pointer-events:none;';
      document.body.appendChild(banner);
    }
    if (state === 'online') {
      banner.style.background = 'rgba(61,190,122,.9)';
      banner.style.color = '#fff';
      banner.textContent = '✓ Connexion rétablie — Synchronisation...';
      setTimeout(() => banner.style.opacity = '0', 2500);
    } else {
      banner.style.opacity = '1';
      banner.style.background = 'rgba(224,82,82,.9)';
      banner.style.color = '#fff';
      banner.textContent = '⚠ Hors ligne — Mode local activé';
    }
  }

  // ── HTTP HELPERS ───────────────────────────────────────────────
  async function _req(method, path, data, skipAuth) {
    const headers = { 'Content-Type': 'application/json' };
    if (_token && !skipAuth) headers['Authorization'] = 'Bearer ' + _token;
    const opts = { method, headers };
    if (data) opts.body = JSON.stringify(data);
    const res = await fetch(API_BASE + path, opts);
    if (res.status === 401) { _token = null; localStorage.removeItem('lux_auth_token'); }
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    return res.json();
  }

  function _get(path)         { return _req('GET', path); }
  function _post(path, data)  { return _req('POST', path, data); }
  function _patch(path, data) { return _req('PATCH', path, data); }
  function _del(path)         { return _req('DELETE', path); }

  // ── CACHE ──────────────────────────────────────────────────────
  function _getCache(key) { return _cache[key] || null; }
  function _setCache(key, data, ttl = 30000) {
    _cache[key] = data;
    setTimeout(() => delete _cache[key], ttl);
  }

  // ── LOCAL FALLBACK ─────────────────────────────────────────────
  function _ls(key, def) {
    try { return JSON.parse(localStorage.getItem(LS_PREFIX + key)) || def; } catch { return def; }
  }
  function _lsSet(key, val) {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(val));
  }

  // ── PENDING QUEUE (offline writes) ─────────────────────────────
  function _queuePending(action, data) {
    const q = _ls('pending_sync', []);
    q.push({ action, data, ts: Date.now() });
    _lsSet('pending_sync', q);
    _pendingSync.push({ action, data });
  }

  // ── MAIN API OBJECT ─────────────────────────────────────────────
  const LuxAPI = {

    isOnline: () => _isOnline,
    hasAuth:  () => !!_token,

    // ── AUTH ─────────────────────────────────────────────────────
    async login(username, password) {
      const data = await _post('/api/auth/login', { username, password });
      _token = data.token;
      localStorage.setItem('lux_auth_token', _token);
      return data;
    },

    logout() {
      _token = null;
      localStorage.removeItem('lux_auth_token');
    },

    // ── ORDERS ───────────────────────────────────────────────────
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
      // Optimistic local save
      const localOrders = _ls('web_orders', []);
      const localOrder = { ...order, id: Date.now(), status: 'pending', _local: true };
      localOrders.unshift(localOrder);
      _lsSet('web_orders', localOrders);

      if (!_isOnline) {
        _queuePending('createOrder', order);
        return localOrder;
      }
      try {
        const saved = await _post('/api/orders', order);
        // Replace local order with server order
        const updated = _ls('web_orders', []).map(o => o._local && o.id === localOrder.id ? saved : o);
        _lsSet('web_orders', updated);
        return saved;
      } catch (e) {
        _queuePending('createOrder', order);
        return localOrder;
      }
    },

    async updateOrderStatus(id, status) {
      // Local update first
      const orders = _ls('web_orders', []);
      const o = orders.find(x => x.id === id);
      if (o) { o.status = status; _lsSet('web_orders', orders); }

      if (!_isOnline) { _queuePending('updateOrder', { id, status }); return; }
      try { await _patch('/api/orders/' + id + '/status', { status }); }
      catch { _queuePending('updateOrder', { id, status }); }
    },

    // ── MENU ─────────────────────────────────────────────────────
    async getMenu() {
      const cached = _getCache('menu');
      if (cached) return cached;
      if (!_isOnline) return _ls('menu_cache', []);
      try {
        const data = await _get('/api/menu');
        _setCache('menu', data, 300000); // 5 min cache
        _lsSet('menu_cache', data);
        return data;
      } catch { return _ls('menu_cache', []); }
    },

    // ── CUSTOMERS ────────────────────────────────────────────────
    async getCustomer(phone) {
      if (!phone) return null;
      if (!_isOnline) return _ls('web_customers', {})[phone] || null;
      try {
        const data = await _get('/api/customers/' + encodeURIComponent(phone));
        const all = _ls('web_customers', {});
        all[phone] = data;
        _lsSet('web_customers', all);
        return data;
      } catch { return _ls('web_customers', {})[phone] || null; }
    },

    async updateCustomer(phone, updates) {
      const all = _ls('web_customers', {});
      if (!all[phone]) all[phone] = { phone, points: 0, orders: [] };
      Object.assign(all[phone], updates);
      _lsSet('web_customers', all);
      // Server sync async
      if (_isOnline) _post('/api/customers/' + encodeURIComponent(phone), updates).catch(() => {});
    },

    // ── RESERVATIONS ─────────────────────────────────────────────
    async getReservations(date) {
      if (!_isOnline) {
        const all = _ls('reservations', []);
        return date ? all.filter(r => r.date === date) : all;
      }
      try {
        const qs = date ? '?date=' + date : '';
        return await _get('/api/reservations' + qs);
      } catch { return _ls('reservations', []); }
    },

    async createReservation(res) {
      const all = _ls('reservations', []);
      const local = { ...res, id: Date.now(), status: 'confirmed', _local: true };
      all.unshift(local); _lsSet('reservations', all);

      if (!_isOnline) { _queuePending('createReservation', res); return local; }
      try {
        const saved = await _post('/api/reservations', res);
        const updated = _ls('reservations', []).map(r => r._local && r.id === local.id ? saved : r);
        _lsSet('reservations', updated);
        return saved;
      } catch { _queuePending('createReservation', res); return local; }
    },

    // ── REVIEWS ──────────────────────────────────────────────────
    async getReviews() {
      if (!_isOnline) return _ls('reviews', []);
      try {
        const data = await _get('/api/reviews');
        _lsSet('reviews', data);
        return data;
      } catch { return _ls('reviews', []); }
    },

    async createReview(review) {
      const all = _ls('reviews', []);
      const local = { ...review, id: Date.now(), _local: true };
      all.unshift(local); _lsSet('reviews', all);
      if (!_isOnline) { _queuePending('createReview', review); return local; }
      try { return await _post('/api/reviews', review); }
      catch { _queuePending('createReview', review); return local; }
    },

    // ── ANALYTICS ────────────────────────────────────────────────
    async getAnalytics(period = '30d') {
      if (!_isOnline) return null;
      try { return await _get('/api/analytics/summary?period=' + period); }
      catch { return null; }
    },

    async trackEvent(category, action, label) {
      const events = _ls('analytics_events', []);
      events.unshift({ category, action, label, ts: new Date().toISOString() });
      _lsSet('analytics_events', events.slice(0, 500));
      if (_isOnline && _token) {
        _post('/api/analytics/event', { category, action, label }).catch(() => {});
      }
    },

    // ── STOCK ────────────────────────────────────────────────────
    async getStock() {
      if (!_isOnline) return { items: [], alerts: [] };
      try { return await _get('/api/stock'); }
      catch { return { items: [], alerts: [] }; }
    },

    async updateStock(id, qty) {
      _queuePending('updateStock', { id, qty });
      if (_isOnline) _patch('/api/stock/' + id, { quantity: qty }).catch(() => {});
    },

    // ── GIFT CARDS ───────────────────────────────────────────────
    async createGiftCard(gc) {
      const all = _ls('gift_cards', []);
      const local = { ...gc, id: Date.now(), status: 'active' };
      all.unshift(local); _lsSet('gift_cards', all);
      if (_isOnline) {
        try {
          const saved = await _post('/api/gift-cards', gc);
          const updated = _ls('gift_cards', []).map(g => g.id === local.id ? saved : g);
          _lsSet('gift_cards', updated);
          return saved;
        } catch {}
      }
      return local;
    },

    async checkGiftCard(code) {
      if (_isOnline) {
        try { return await _get('/api/gift-cards/' + code.toUpperCase()); } catch {}
      }
      return _ls('gift_cards', []).find(g => g.code === code.toUpperCase()) || null;
    },

    // ── COUPONS ──────────────────────────────────────────────────
    async validateCoupon(code, subtotal) {
      if (_isOnline) {
        try { return await _post('/api/coupons/validate', { code, subtotal }); } catch {}
      }
      const local = _ls('coupons', []).find(c => c.code === code.toUpperCase());
      if (!local) return { valid: false, error: 'Code invalide' };
      if (subtotal < (local.minOrder || 0)) return { valid: false, error: `Minimum ${local.minOrder} MAD requis` };
      return { valid: true, coupon: local };
    },

    // ── TRANSACTIONS (POS) ───────────────────────────────────────
    async saveTransaction(tx) {
      const all = _ls('transactions', []);
      all.unshift(tx); _lsSet('transactions', all.slice(0, 500));
      if (_isOnline && _token) {
        _post('/api/transactions', tx).catch(() => _queuePending('saveTransaction', tx));
      } else {
        _queuePending('saveTransaction', tx);
      }
    },

    async getTransactions(params = {}) {
      if (!_isOnline) return _ls('transactions', []);
      try { return await _get('/api/transactions?' + new URLSearchParams(params)); }
      catch { return _ls('transactions', []); }
    },

    // ── STAFF ────────────────────────────────────────────────────
    async getStaff() {
      if (!_isOnline) return _ls('employees', []);
      try {
        const data = await _get('/api/staff');
        _lsSet('employees', data);
        return data;
      } catch { return _ls('employees', []); }
    },

    async logAttendance(empId, type, coords) {
      const att = _ls('presences', []);
      const record = { empId, type, time: new Date().toISOString(), lat: coords?.lat, lng: coords?.lng };
      att.unshift(record); _lsSet('presences', att);
      if (_isOnline) _post('/api/staff/attendance', record).catch(() => {});
    },

    // ── SYNC PENDING ─────────────────────────────────────────────
    async _flushPending() {
      const queue = _ls('pending_sync', []);
      if (!queue.length || !_isOnline) return;
      const remaining = [];
      for (const item of queue) {
        try {
          switch (item.action) {
            case 'createOrder':      await _post('/api/orders', item.data); break;
            case 'updateOrder':      await _patch('/api/orders/' + item.data.id + '/status', { status: item.data.status }); break;
            case 'createReservation': await _post('/api/reservations', item.data); break;
            case 'createReview':     await _post('/api/reviews', item.data); break;
            case 'saveTransaction':  await _post('/api/transactions', item.data); break;
            case 'updateStock':      await _patch('/api/stock/' + item.data.id, { quantity: item.data.qty }); break;
            default: remaining.push(item);
          }
        } catch { remaining.push(item); }
      }
      _lsSet('pending_sync', remaining);
      if (queue.length - remaining.length > 0) {
        console.log('[LUX API] Synced ' + (queue.length - remaining.length) + ' pending items');
      }
    },

    // ── HEALTH CHECK ─────────────────────────────────────────────
    async checkHealth() {
      try {
        const data = await fetch(API_BASE + '/health', { signal: AbortSignal.timeout(3000) }).then(r => r.json());
        _isOnline = true;
        return data;
      } catch {
        _isOnline = false;
        return null;
      }
    },

    // ── INIT ─────────────────────────────────────────────────────
    async init() {
      await this.checkHealth();
      if (_isOnline) this._flushPending();
      setInterval(() => this._flushPending(), SYNC_INTERVAL);
      console.log('[LUX API] Ready —', _isOnline ? 'Online (' + API_BASE + ')' : 'Offline (localStorage mode)');
      return _isOnline;
    }
  };

  window.LuxAPI = LuxAPI;

})(window);
