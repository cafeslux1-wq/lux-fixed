// ═══════════════════════════════════════════════════════════════════
//  CAFÉ LUX — API Client v3.0  (Production-Ready, Railway-First)
//  ─────────────────────────────────────────────────────────────────
//  • Railway is the single source of truth. localStorage is ONLY:
//      – a transient cache (read-through, never relied on for mutations)
//      – an offline queue (flushed automatically when connection returns)
//  • Fresh reads: getFresh*() helpers that never return cached data
//    (used by admin panels — FIX 13).
//  • Gift-card wallet logic: redeemGiftCard() deducts on server, returns
//    the authoritative remaining balance (FIX 9).
//  • Full CRUD with DELETE / PATCH for every admin-managed resource
//    including reservations, employees, offers, customers (FIX 12).
//  • RFID / PIN authentication endpoints.
//  • Heartbeat for gaming stations.
//  • Tracks the active employee (session) so every mutation carries
//    Employee-Id automatically.
// ═══════════════════════════════════════════════════════════════════

(function(window) {
  'use strict';

  // ── CONFIG ─────────────────────────────────────────────────────
  const API_BASE      = window.LUX_API_URL || 'https://cafeslux-api-production.up.railway.app';
  const LS_PREFIX     = 'lux_';
  const SYNC_INTERVAL = 30000;   // background queue flush / health check
  const CACHE_TTL     = 30000;   // default in-memory cache TTL (ms)
  const REQ_TIMEOUT   = 12000;   // per-request timeout

  // ── STATE ──────────────────────────────────────────────────────
  let _token      = localStorage.getItem('lux_auth_token') || null;
  let _empSession = _readEmp();                // { id, name, role, pin?, rfid? }
  let _isOnline   = navigator.onLine;
  let _cache      = {};

  function _readEmp(){
    try { return JSON.parse(localStorage.getItem('lux_emp_session') || 'null'); }
    catch { return null; }
  }

  window.addEventListener('online',  () => { _isOnline = true;  _showNetworkBanner('online');  LuxAPI._flushPending(); });
  window.addEventListener('offline', () => { _isOnline = false; _showNetworkBanner('offline'); });

  // ── NETWORK BANNER ─────────────────────────────────────────────
  function _showNetworkBanner(state) {
    let b = document.getElementById('lux-net-banner');
    if (!b) {
      b = document.createElement('div');
      b.id = 'lux-net-banner';
      b.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);z-index:9999;padding:8px 20px;border-radius:20px;font-size:12px;font-weight:600;transition:all .3s;pointer-events:none;opacity:0';
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

  // ── HTTP CORE ──────────────────────────────────────────────────
  async function _req(method, path, data, opts = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (_token && !opts.skipAuth)  headers['Authorization'] = 'Bearer ' + _token;
    // v4.2: X-Employee-Id header removed — Railway CORS preflight blocked it.
    // Employee tagging is still done via _withEmp() in the request body for
    // orders / transactions. This keeps CORS clean without needing server changes.

    const fetchOpts = { method, headers };
    if (data !== undefined) fetchOpts.body = JSON.stringify(data);

    // Timeout guard
    const ctl = ('AbortController' in window) ? new AbortController() : null;
    if (ctl) { fetchOpts.signal = ctl.signal; setTimeout(() => ctl.abort(), REQ_TIMEOUT); }

    const res = await fetch(API_BASE + path, fetchOpts);

    if (res.status === 401) {
      _token = null;
      localStorage.removeItem('lux_auth_token');
      localStorage.removeItem('lux_session');
      if (!path.includes('/auth/') && /cafe-lux|admin/i.test(window.location.pathname)) {
        window.location.replace('index.html');
      }
    }

    // Try to parse JSON even on error so caller can surface server error messages
    let body = null;
    try { body = await res.json(); } catch { /* no-json response */ }

    if (!res.ok) {
      const err = new Error((body && body.error) || ('API ' + res.status + ': ' + path));
      err.status = res.status;
      err.body   = body;
      throw err;
    }
    return body;
  }
  const _get    = (p)     => _req('GET',    p);
  const _post   = (p, d)  => _req('POST',   p, d);
  const _patch  = (p, d)  => _req('PATCH',  p, d);
  const _put    = (p, d)  => _req('PUT',    p, d);
  const _del    = (p)     => _req('DELETE', p);

  // ── CACHE (read-through only) ──────────────────────────────────
  function _getCache(key)                   { const e=_cache[key]; return e && e.t>Date.now() ? e.v : null; }
  function _setCache(key, v, ttl = CACHE_TTL) { _cache[key] = { v, t: Date.now() + ttl }; }
  function _invalidate(/*...keys*/)         { for (const k of arguments) delete _cache[k]; }

  // ── LOCAL STORAGE HELPERS (cache + offline queue only) ─────────
  function _ls(key, def)    { try { return JSON.parse(localStorage.getItem(LS_PREFIX+key)) ?? def; } catch { return def; } }
  function _lsSet(key, val) { try { localStorage.setItem(LS_PREFIX+key, JSON.stringify(val)); } catch {} }

  // ── OFFLINE QUEUE ──────────────────────────────────────────────
  function _queue(action, data) {
    const q = _ls('pending_sync', []);
    q.push({ action, data, ts: Date.now() });
    _lsSet('pending_sync', q);
  }

  // ── SHARED EMPLOYEE SYNC (cafe-lux.html reads lux_employees) ──
  function _syncEmployeesShared(emps) {
    try {
      const shared = (emps || []).map(e => ({
        id: e.id,
        name: e.name,
        initials: (e.name || '').split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2),
        role: e.role || 'service',
        status: e.endDate ? 'off' : 'active',
        phone: e.phone || '',
        since: e.startDate || '',
        salary: e.salary || 0,
        cin: e.cin || '',
        address: e.address || ''
      }));
      localStorage.setItem('lux_employees', JSON.stringify(shared));
    } catch (e) { console.warn('[LUX] Shared sync failed:', e); }
  }

  // ═══════════════════════════════════════════════════════════════
  const LuxAPI = {

    // ── INTROSPECTION ─────────────────────────────────────────────
    isOnline:   () => _isOnline,
    hasAuth:    () => !!_token,
    getBase:    () => API_BASE,
    currentEmployee: () => _empSession,

    // ═══════════════════════════════════════════════════════════════
    //  AUTHENTICATION — Admin (JWT) & Employee (PIN / RFID)
    // ═══════════════════════════════════════════════════════════════

    async login(username, password) {
      const data = await _req('POST', '/api/auth/login', { username, password }, { skipAuth: true });
      _token = data.token;
      localStorage.setItem('lux_auth_token', _token);
      return data;
    },

    logout() {
      _token = null;
      _empSession = null;
      localStorage.removeItem('lux_auth_token');
      localStorage.removeItem('lux_session');
      localStorage.removeItem('lux_emp_session');
    },

    /**
     * Employee PIN login — for POS operators.
     * Server expected to validate and return { id, name, role, ... }
     * If server endpoint isn't live, falls back to checking lux_employees cache.
     */
    async loginEmployeePIN(pin) {
      if (!pin) throw new Error('PIN requis');
      try {
        const emp = await _req('POST', '/api/auth/employee-pin', { pin }, { skipAuth: true });
        _empSession = emp;
        localStorage.setItem('lux_emp_session', JSON.stringify(emp));
        return emp;
      } catch (e) {
        if (e.status === 401 || e.status === 404 || e.status === 400) throw new Error('PIN invalide');
        // network error → try local cache as last resort (offline scenario)
        const list = JSON.parse(localStorage.getItem('lux_employees') || '[]');
        const emp  = list.find(x => String(x.pin || '') === String(pin));
        if (!emp) throw new Error('PIN invalide (hors ligne)');
        _empSession = emp;
        localStorage.setItem('lux_emp_session', JSON.stringify(emp));
        return emp;
      }
    },

    /**
     * RFID / Dallas key login.
     * The reader emits the UID as a fast keystroke burst followed by Enter
     * (HID keyboard emulation — most common integration mode).
     * See cafe-lux.html for the global keystroke detector that calls this.
     */
    async loginEmployeeRFID(cardUid) {
      if (!cardUid) throw new Error('Badge invalide');
      try {
        const emp = await _req('POST', '/api/auth/employee-rfid', { rfid: cardUid }, { skipAuth: true });
        _empSession = emp;
        localStorage.setItem('lux_emp_session', JSON.stringify(emp));
        return emp;
      } catch (e) {
        if (e.status === 401 || e.status === 404 || e.status === 400) throw new Error('Badge non reconnu');
        const list = JSON.parse(localStorage.getItem('lux_employees') || '[]');
        const emp  = list.find(x => String(x.rfid || '').toUpperCase() === String(cardUid).toUpperCase());
        if (!emp) throw new Error('Badge non reconnu (hors ligne)');
        _empSession = emp;
        localStorage.setItem('lux_emp_session', JSON.stringify(emp));
        return emp;
      }
    },

    switchEmployee() {
      _empSession = null;
      localStorage.removeItem('lux_emp_session');
    },

    // ═══════════════════════════════════════════════════════════════
    //  ORDERS
    // ═══════════════════════════════════════════════════════════════

    async getOrders(params = {}) {
      if (!_isOnline) return _ls('web_orders', []);
      try {
        const qs   = new URLSearchParams(params).toString();
        const data = await _get('/api/orders' + (qs ? '?' + qs : ''));
        _lsSet('web_orders', data);
        return data;
      } catch { return _ls('web_orders', []); }
    },

    async getFreshOrders(params = {}) {
      const qs = new URLSearchParams(params).toString();
      const data = await _get('/api/orders' + (qs ? '?' + qs : ''));
      _lsSet('web_orders', data);
      return data;
    },

    async createOrder(order) {
      // Tag with active employee
      const payload = { ..._withEmp(order) };

      const local = { ...payload, id: Date.now(), status: 'pending', _local: true };
      const all = _ls('web_orders', []); all.unshift(local); _lsSet('web_orders', all);

      if (!_isOnline) { _queue('createOrder', payload); return local; }
      try {
        const saved = await _post('/api/orders', payload);
        const updated = _ls('web_orders', []).map(o => o._local && o.id === local.id ? saved : o);
        _lsSet('web_orders', updated);
        return saved;
      } catch { _queue('createOrder', payload); return local; }
    },

    async updateOrderStatus(id, status) {
      const orders = _ls('web_orders', []);
      const o = orders.find(x => x.id === id);
      if (o) { o.status = status; _lsSet('web_orders', orders); }
      if (!_isOnline) { _queue('updateOrder', { id, status }); return; }
      try { return await _patch('/api/orders/' + id + '/status', { status }); }
      catch { _queue('updateOrder', { id, status }); }
    },

    async deleteOrder(id) {
      if (!_isOnline) { _queue('deleteOrder', { id }); return; }
      try { return await _del('/api/orders/' + id); }
      catch { _queue('deleteOrder', { id }); }
    },

    // ═══════════════════════════════════════════════════════════════
    //  MENU & PRODUCTS
    // ═══════════════════════════════════════════════════════════════

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

    async getFreshMenu() {
      _invalidate('menu');
      const data = await _get('/api/menu');
      _setCache('menu', data, 300000);
      _lsSet('menu_cache', data);
      return data;
    },

    async getProducts(params = {}) {
      if (!_isOnline) return _ls('products_cache', []);
      try {
        const qs   = new URLSearchParams(params).toString();
        const data = await _get('/api/products' + (qs ? '?' + qs : ''));
        _lsSet('products_cache', data);
        return data;
      } catch { return _ls('products_cache', []); }
    },

    async getFreshProducts(params = {}) {
      const qs   = new URLSearchParams(params).toString();
      const data = await _get('/api/products' + (qs ? '?' + qs : ''));
      _lsSet('products_cache', data);
      _invalidate('menu');
      return data;
    },

    async createProduct(product) {
      const saved = await _post('/api/products', product);
      _invalidate('menu'); _lsSet('products_cache', []);
      return saved;
    },
    async updateProduct(id, updates) {
      const saved = await _patch('/api/products/' + id, updates);
      _invalidate('menu');
      return saved;
    },
    async deleteProduct(id) {
      const result = await _del('/api/products/' + id);
      _invalidate('menu'); _lsSet('products_cache', []);
      return result;
    },
    async getCategories() {
      if (!_isOnline) return [];
      try { return await _get('/api/categories'); } catch { return []; }
    },

    // ── OFFERS (admin) — FIX 12 ────────────────────────────────────
    // Offers are products with isOffer=true (per server-patches note §3).
    async getOffers() {
      if (!_isOnline) return _ls('offers_cache', []);
      try {
        const data = await _get('/api/products?isOffer=true');
        _lsSet('offers_cache', data);
        return data;
      } catch { return _ls('offers_cache', []); }
    },
    async getFreshOffers() {
      const data = await _get('/api/products?isOffer=true');
      _lsSet('offers_cache', data);
      return data;
    },
    async createOffer(offer) {
      const saved = await _post('/api/products', { ...offer, isOffer: true });
      _invalidate('menu'); _lsSet('offers_cache', []); _lsSet('products_cache', []);
      return saved;
    },
    async updateOffer(id, updates) {
      const saved = await _patch('/api/products/' + id, updates);
      _invalidate('menu'); _lsSet('offers_cache', []);
      return saved;
    },
    async deleteOffer(id) {
      const result = await _del('/api/products/' + id);
      _invalidate('menu'); _lsSet('offers_cache', []); _lsSet('products_cache', []);
      return result;
    },

    // ═══════════════════════════════════════════════════════════════
    //  CUSTOMERS — FIX 13 (fresh read from Railway)
    // ═══════════════════════════════════════════════════════════════

    async getCustomers() {
      if (!_isOnline) {
        const local = _ls('web_customers', {});
        return Object.values(local).map(c => ({
          name: c.name, phone: c.phone,
          loyaltyPoints: c.points || c.loyaltyPoints || 0,
          _count: { orders: (c.orders || []).length }
        }));
      }
      try {
        const data = await _get('/api/customers');
        _lsSet('customers_list', data);
        return data;
      } catch { return _ls('customers_list', []); }
    },

    /** FIX 13 — fresh, bypasses cache. Used by admin panel. */
    async getFreshCustomers() {
      const data = await _get('/api/customers');
      _lsSet('customers_list', data);
      return data;
    },

    async getCustomer(phone) {
      if (!phone) return null;
      if (!_isOnline) return _ls('web_customers', {})[phone] || null;
      try {
        const data = await _get('/api/customers/' + encodeURIComponent(phone));
        const all = _ls('web_customers', {}); all[phone] = data; _lsSet('web_customers', all);
        return data;
      } catch { return _ls('web_customers', {})[phone] || null; }
    },

    async registerCustomer(customer) {
      const local = { ...customer, id: customer.id || Date.now(), points: 0 };
      const all = _ls('web_customers', {}); all[customer.phone] = local; _lsSet('web_customers', all);

      if (!_isOnline) { _queue('registerCustomer', customer); return local; }
      try {
        const saved = await _post('/api/customers', customer);
        // Refresh admin list cache so admin panel sees the new customer immediately
        _lsSet('customers_list', []);
        return saved;
      } catch { _queue('registerCustomer', customer); return local; }
    },

    async updateCustomer(phone, updates) {
      if (!_isOnline) { _queue('updateCustomer', { phone, ...updates }); return null; }
      try {
        const saved = await _patch('/api/customers/' + encodeURIComponent(phone), updates);
        _lsSet('customers_list', []);
        return saved;
      } catch { _queue('updateCustomer', { phone, ...updates }); }
    },

    async deleteCustomer(phone) {
      if (!_isOnline) { _queue('deleteCustomer', { phone }); return; }
      try {
        const result = await _del('/api/customers/' + encodeURIComponent(phone));
        _lsSet('customers_list', []);
        const all = _ls('web_customers', {}); delete all[phone]; _lsSet('web_customers', all);
        return result;
      } catch { _queue('deleteCustomer', { phone }); }
    },

    async loginCustomer(phone, password) {
      if (!_isOnline) {
        const c = _ls('web_customers', {})[phone];
        if (c && (!c.password || c.password === password)) return c;
        return null;
      }
      try { return await _post('/api/auth/customer', { phone, password }); }
      catch { const c = _ls('web_customers', {})[phone]; return c || null; }
    },

    // ═══════════════════════════════════════════════════════════════
    //  RESERVATIONS — FIX 12 (CRUD) + dedupe support
    // ═══════════════════════════════════════════════════════════════

    async getReservations(date) {
      if (!_isOnline) {
        const all = _ls('reservations', []);
        return date ? all.filter(r => r.date === date) : all;
      }
      try {
        const data = await _get('/api/reservations' + (date ? '?date=' + date : ''));
        _lsSet('reservations', data);
        return data;
      } catch { return _ls('reservations', []); }
    },

    async getFreshReservations(date) {
      const data = await _get('/api/reservations' + (date ? '?date=' + date : ''));
      _lsSet('reservations', data);
      return data;
    },

    async createReservation(res) {
      // Dedup guard on client too — server also checks (server-patches §4)
      const pending = _ls('reservations', []);
      const dup = pending.find(r =>
        r.phone === res.phone && r.date === res.date &&
        r.time  === res.time  && r.status !== 'cancelled'
      );
      if (dup) return { ...dup, _duplicate: true };

      const local = { ...res, id: Date.now(), status: 'confirmed', _local: true };
      const all = _ls('reservations', []); all.unshift(local); _lsSet('reservations', all);

      if (!_isOnline) { _queue('createReservation', res); return local; }
      try {
        const saved = await _post('/api/reservations', res);
        // Replace the local placeholder with the server record
        const updated = _ls('reservations', []).map(r => r._local && r.id === local.id ? saved : r);
        _lsSet('reservations', updated);
        return saved;
      } catch { _queue('createReservation', res); return local; }
    },

    async updateReservation(id, updates) {
      // Optimistic local update
      const all = _ls('reservations', []);
      const r = all.find(x => x.id === id);
      if (r) { Object.assign(r, updates); _lsSet('reservations', all); }

      if (!_isOnline) { _queue('updateReservation', { id, ...updates }); return r; }
      try {
        const saved = await _patch('/api/reservations/' + id, updates);
        // Sync back
        const list = _ls('reservations', []).map(x => x.id === id ? saved : x);
        _lsSet('reservations', list);
        return saved;
      } catch { _queue('updateReservation', { id, ...updates }); return r; }
    },

    async confirmReservation(id) { return this.updateReservation(id, { status: 'confirmed' }); },
    async cancelReservation(id)  { return this.updateReservation(id, { status: 'cancelled' }); },

    async deleteReservation(id) {
      const all = _ls('reservations', []).filter(r => r.id !== id);
      _lsSet('reservations', all);
      if (!_isOnline) { _queue('deleteReservation', { id }); return; }
      try { return await _del('/api/reservations/' + id); }
      catch { _queue('deleteReservation', { id }); }
    },

    // ═══════════════════════════════════════════════════════════════
    //  REVIEWS
    // ═══════════════════════════════════════════════════════════════

    async getReviews() {
      if (!_isOnline) return _ls('reviews', []);
      try { const d = await _get('/api/reviews'); _lsSet('reviews', d); return d; }
      catch { return _ls('reviews', []); }
    },

    async createReview(review) {
      const local = { ...review, id: Date.now(), _local: true };
      const all = _ls('reviews', []); all.unshift(local); _lsSet('reviews', all);
      if (!_isOnline) { _queue('createReview', review); return local; }
      try { return await _post('/api/reviews', review); }
      catch { _queue('createReview', review); return local; }
    },

    // ═══════════════════════════════════════════════════════════════
    //  ANALYTICS / DASHBOARD
    // ═══════════════════════════════════════════════════════════════

    async getAnalytics(period = '30d') {
      if (!_isOnline) return null;
      try { return await _get('/api/analytics/summary?period=' + period); } catch { return null; }
    },
    async getDashboard() {
      if (!_isOnline) return null;
      try { return await _get('/api/analytics/dashboard'); } catch { return null; }
    },
    async trackEvent(category, action, label) {
      if (_isOnline && _token) _post('/api/analytics/event', { category, action, label }).catch(() => {});
    },

    // ═══════════════════════════════════════════════════════════════
    //  STOCK
    // ═══════════════════════════════════════════════════════════════

    async getStock() {
      if (!_isOnline) return { items: [], alerts: [] };
      try { return await _get('/api/stock'); } catch { return { items: [], alerts: [] }; }
    },
    async updateStock(id, qty) {
      _queue('updateStock', { id, qty });
      if (_isOnline) await _patch('/api/stock/' + id, { quantity: qty }).catch(() => {});
    },

    // ═══════════════════════════════════════════════════════════════
    //  GIFT CARDS — FIX 9 (wallet logic: initial − spent = remaining)
    // ═══════════════════════════════════════════════════════════════

    async createGiftCard(gc) {
      // gc: { code, amount, recipient, expires, ... }
      // Initial balance == amount.
      const payload = { ...gc, balance: gc.balance ?? gc.amount };
      if (!_isOnline) {
        const local = { ...payload, id: Date.now(), _local: true };
        const all = _ls('gift_cards', []); all.unshift(local); _lsSet('gift_cards', all);
        _queue('createGiftCard', payload);
        return local;
      }
      try {
        const saved = await _post('/api/gift-cards', payload);
        const all = _ls('gift_cards', []); all.unshift(saved); _lsSet('gift_cards', all);
        return saved;
      } catch (e) {
        const local = { ...payload, id: Date.now(), _local: true };
        const all = _ls('gift_cards', []); all.unshift(local); _lsSet('gift_cards', all);
        _queue('createGiftCard', payload);
        return local;
      }
    },

    /**
     * Check a gift card — returns { code, amount, balance, expires, ... } or null.
     * `balance` is the REMAINING balance (authoritative from server).
     */
    async checkGiftCard(code) {
      if (!code) return null;
      const up = String(code).toUpperCase();
      if (_isOnline) {
        try { return await _get('/api/gift-cards/' + up); }
        catch (e) { if (e.status === 404) return null; }
      }
      return _ls('gift_cards', []).find(g => g.code === up) || null;
    },

    /**
     * Redeem a gift card — FIX 9.
     * Server deducts `amount` from balance atomically and returns
     * { code, amount, balance, deducted, remaining }.
     *
     * Throws a user-friendly Error on 400/402/404/410 with .status set.
     * Returns the server response on success.
     *
     * Usage:
     *   try {
     *     const r = await LuxAPI.redeemGiftCard('LUX-XYZ', 50);
     *     alert(`Restant: ${r.remaining} DH`);
     *   } catch (e) {
     *     if (e.status === 402) alert('Solde insuffisant: ' + e.body.balance);
     *     else alert(e.message);
     *   }
     */
    async redeemGiftCard(code, amount) {
      if (!code)            throw new Error('Code requis');
      if (!amount || amount <= 0) throw new Error('Montant invalide');
      if (!_isOnline)       throw new Error('Connexion requise pour utiliser la carte cadeau');

      const up = String(code).toUpperCase();
      try {
        const result = await _post('/api/gift-cards/' + up + '/redeem', { amount });
        // Update local cache with new remaining balance
        const all = _ls('gift_cards', []);
        const idx = all.findIndex(g => g.code === up);
        if (idx >= 0) { all[idx].balance = result.remaining; _lsSet('gift_cards', all); }
        return result;
      } catch (e) {
        // Normalise common codes
        if (e.status === 404) e.message = 'Code invalide';
        if (e.status === 410) e.message = 'Carte expirée';
        if (e.status === 402) e.message = 'Solde insuffisant (disponible: ' + (e.body && e.body.balance) + ' DH)';
        if (e.status === 400) e.message = e.message || 'Montant invalide';
        throw e;
      }
    },

    async getGiftCards() {
      if (!_isOnline) return _ls('gift_cards', []);
      try {
        const data = await _get('/api/gift-cards');
        _lsSet('gift_cards', data);
        return data;
      } catch { return _ls('gift_cards', []); }
    },

    // ═══════════════════════════════════════════════════════════════
    //  COUPONS
    // ═══════════════════════════════════════════════════════════════

    async validateCoupon(code, subtotal) {
      if (_isOnline) {
        try { return await _post('/api/coupons/validate', { code, subtotal }); } catch {}
      }
      const local = _ls('coupons', []).find(c => c.code === String(code).toUpperCase());
      if (!local) return { valid: false, error: 'Code invalide' };
      if (subtotal < (local.minOrder || 0)) return { valid: false, error: 'Minimum ' + local.minOrder + ' MAD requis' };
      return { valid: true, coupon: local };
    },

    // ═══════════════════════════════════════════════════════════════
    //  TRANSACTIONS (POS — every sale is logged with employee)
    // ═══════════════════════════════════════════════════════════════

    async saveTransaction(tx) {
      const payload = _withEmp(tx);
      const all = _ls('transactions', []); all.unshift(payload); _lsSet('transactions', all.slice(0, 500));
      if (_isOnline && _token) _post('/api/transactions', payload).catch(() => _queue('saveTransaction', payload));
      else _queue('saveTransaction', payload);
      return payload;
    },

    async getTransactions(params = {}) {
      if (!_isOnline) return _ls('transactions', []);
      try { return await _get('/api/transactions?' + new URLSearchParams(params)); }
      catch { return _ls('transactions', []); }
    },

    // ═══════════════════════════════════════════════════════════════
    //  STAFF / ATTENDANCE
    // ═══════════════════════════════════════════════════════════════

    async getStaff() {
      if (!_isOnline) return _ls('employees', []);
      try { const d = await _get('/api/staff'); _lsSet('employees', d); return d; }
      catch { return _ls('employees', []); }
    },

    async logAttendance(empId, type, coords) {
      const rec = {
        empId, type,
        time: new Date().toISOString(),
        lat: coords?.lat, lng: coords?.lng
      };
      const att = _ls('presences', []); att.unshift(rec); _lsSet('presences', att);
      if (_isOnline) _post('/api/staff/attendance', rec).catch(() => {});
    },

    // ═══════════════════════════════════════════════════════════════
    //  EMPLOYEES — FIX 13 (fresh read) + FIX 12 (CRUD)
    // ═══════════════════════════════════════════════════════════════

    async getEmployees() {
      if (!_isOnline) return _ls('employees_full', []);
      try {
        const d = await _get('/api/employees');
        _lsSet('employees_full', d);
        _syncEmployeesShared(d);
        return d;
      } catch { return _ls('employees_full', []); }
    },

    /** FIX 13 — always hits Railway, bypasses cache. */
    async getFreshEmployees() {
      const d = await _get('/api/employees');
      _lsSet('employees_full', d);
      _syncEmployeesShared(d);
      return d;
    },

    async createEmployee(emp) {
      if (!_isOnline) {
        const local = { ...emp, id: emp.id || 'e' + Date.now(), _local: true };
        const all = _ls('employees_full', []); all.push(local); _lsSet('employees_full', all);
        _syncEmployeesShared(all);
        _queue('createEmployee', emp);
        return local;
      }
      // Server-first when online → new employee visible in admin immediately (FIX 13)
      try {
        const saved = await _post('/api/employees', emp);
        const all = _ls('employees_full', []); all.push(saved); _lsSet('employees_full', all);
        _syncEmployeesShared(all);
        return saved;
      } catch (e) {
        const local = { ...emp, id: emp.id || 'e' + Date.now(), _local: true };
        const all = _ls('employees_full', []); all.push(local); _lsSet('employees_full', all);
        _syncEmployeesShared(all);
        _queue('createEmployee', emp);
        return local;
      }
    },

    async updateEmployee(id, updates) {
      const all = _ls('employees_full', []);
      const idx = all.findIndex(e => e.id === id);
      if (idx >= 0) { Object.assign(all[idx], updates); _lsSet('employees_full', all); _syncEmployeesShared(all); }

      if (!_isOnline) { _queue('updateEmployee', { id, ...updates }); return all[idx]; }
      try {
        const saved = await _patch('/api/employees/' + id, updates);
        const list = _ls('employees_full', []).map(e => e.id === id ? saved : e);
        _lsSet('employees_full', list); _syncEmployeesShared(list);
        return saved;
      } catch { _queue('updateEmployee', { id, ...updates }); return all[idx]; }
    },

    async deleteEmployee(id) {
      const all = _ls('employees_full', []).filter(e => e.id !== id);
      _lsSet('employees_full', all); _syncEmployeesShared(all);
      if (!_isOnline) { _queue('deleteEmployee', { id }); return; }
      try { await _del('/api/employees/' + id); }
      catch { _queue('deleteEmployee', { id }); }
    },

    // ── Employee join request (admin approval workflow) ────────────
    async submitJoinRequest(req) {
      // req: { name, phone, role, cin, ... }
      if (!_isOnline) { _queue('submitJoinRequest', req); return { ...req, _queued: true }; }
      try { return await _post('/api/employees/join-requests', req); }
      catch (e) { _queue('submitJoinRequest', req); return { ...req, _queued: true }; }
    },
    async getJoinRequests() {
      if (!_isOnline) return _ls('join_requests', []);
      try {
        const d = await _get('/api/employees/join-requests');
        _lsSet('join_requests', d);
        return d;
      } catch { return _ls('join_requests', []); }
    },
    async approveJoinRequest(id) {
      return _patch('/api/employees/join-requests/' + id, { status: 'approved' });
    },
    async rejectJoinRequest(id) {
      return _patch('/api/employees/join-requests/' + id, { status: 'rejected' });
    },

    // ═══════════════════════════════════════════════════════════════
    //  PAYROLL
    // ═══════════════════════════════════════════════════════════════

    async getPayroll(empId, month) {
      const key = 'payroll_' + (empId || 'all');
      if (!_isOnline) return _ls(key, []);
      try {
        const qs = new URLSearchParams();
        if (empId) qs.set('empId', empId);
        if (month) qs.set('month', month);
        const d = await _get('/api/payroll?' + qs);
        _lsSet(key, d);
        return d;
      } catch { return _ls(key, []); }
    },

    async addPayrollEntry(entry) {
      if (!_isOnline) {
        const local = { ...entry, id: entry.id || 's' + Date.now() };
        const all = _ls('payroll_all', []); all.unshift(local); _lsSet('payroll_all', all);
        _queue('addPayrollEntry', entry);
        return local;
      }
      try { return await _post('/api/payroll', entry); }
      catch {
        const local = { ...entry, id: entry.id || 's' + Date.now() };
        const all = _ls('payroll_all', []); all.unshift(local); _lsSet('payroll_all', all);
        _queue('addPayrollEntry', entry);
        return local;
      }
    },

    async updatePayrollEntry(id, updates) {
      const all = _ls('payroll_all', []);
      const e = all.find(x => x.id === id);
      if (e) { Object.assign(e, updates); _lsSet('payroll_all', all); }
      if (!_isOnline) { _queue('updatePayrollEntry', { id, ...updates }); return e; }
      try { return await _patch('/api/payroll/' + id, updates); }
      catch { _queue('updatePayrollEntry', { id, ...updates }); return e; }
    },

    async deletePayrollEntry(id) {
      const all = _ls('payroll_all', []).filter(x => x.id !== id);
      _lsSet('payroll_all', all);
      if (!_isOnline) { _queue('deletePayrollEntry', { id }); return; }
      try { return await _del('/api/payroll/' + id); }
      catch { _queue('deletePayrollEntry', { id }); }
    },

    // ═══════════════════════════════════════════════════════════════
    //  ADVANCE REQUESTS (avance sur salaire)
    // ═══════════════════════════════════════════════════════════════

    async getAdvanceRequests(empId) {
      if (!_isOnline) return _ls('advance_requests', []);
      try {
        const qs = empId ? '?empId=' + empId : '';
        const d = await _get('/api/advance-requests' + qs);
        _lsSet('advance_requests', d);
        return d;
      } catch { return _ls('advance_requests', []); }
    },

    async createAdvanceRequest(req) {
      if (!_isOnline) {
        const local = { ...req, id: req.id || 'r' + Date.now(), status: 'pending' };
        const all = _ls('advance_requests', []); all.unshift(local); _lsSet('advance_requests', all);
        _queue('createAdvanceRequest', req);
        return local;
      }
      try { return await _post('/api/advance-requests', req); }
      catch {
        const local = { ...req, id: req.id || 'r' + Date.now(), status: 'pending' };
        const all = _ls('advance_requests', []); all.unshift(local); _lsSet('advance_requests', all);
        _queue('createAdvanceRequest', req);
        return local;
      }
    },

    async updateAdvanceRequest(id, updates) {
      const all = _ls('advance_requests', []);
      const r = all.find(x => x.id === id);
      if (r) { Object.assign(r, updates); _lsSet('advance_requests', all); }
      if (!_isOnline) { _queue('updateAdvanceRequest', { id, ...updates }); return r; }
      try { return await _patch('/api/advance-requests/' + id, updates); }
      catch { _queue('updateAdvanceRequest', { id, ...updates }); return r; }
    },

    async approveAdvanceRequest(id) { return this.updateAdvanceRequest(id, { status: 'approved' }); },
    async rejectAdvanceRequest(id)  { return this.updateAdvanceRequest(id, { status: 'rejected' }); },

    // ═══════════════════════════════════════════════════════════════
    //  GAMING STATIONS — activation + heartbeat
    // ═══════════════════════════════════════════════════════════════

    async getStations() {
      if (!_isOnline) return _ls('gaming_stations', []);
      try {
        const d = await _get('/api/gaming/stations');
        _lsSet('gaming_stations', d);
        return d;
      } catch { return _ls('gaming_stations', []); }
    },

    async getFreshStations() {
      const d = await _get('/api/gaming/stations');
      _lsSet('gaming_stations', d);
      return d;
    },

    /**
     * Activate a gaming station. Matches server.js /api/gaming/activate.
     * Returns { success, expiry }.
     */
    async activateStation(stationId, hours, userId, paymentRef) {
      if (!_isOnline) throw new Error('Connexion requise pour activer la station');
      return await _post('/api/gaming/activate', {
        stationId, hours, userId,
        paymentRef: paymentRef || ('LOCAL-' + Date.now())
      });
    },

    async deactivateStation(stationId) {
      if (!_isOnline) throw new Error('Connexion requise');
      return await _post('/api/gaming/deactivate', { stationId });
    },

    /** Heartbeat — called every ~30s by the gaming dashboard */
    async stationHeartbeat(stationId) {
      if (!_isOnline) return null;
      try { return await _post('/api/gaming/heartbeat', { stationId, ts: Date.now() }); }
      catch { return null; }
    },

    async manualTopUp(stationId, minutes, amount, method) {
      if (!_isOnline) { _queue('manualTopUp', { stationId, minutes, amount, method }); return null; }
      try {
        return await _post('/api/gaming/topup', { stationId, minutes, amount, method: method || 'cash' });
      } catch { _queue('manualTopUp', { stationId, minutes, amount, method }); return null; }
    },

    // ═══════════════════════════════════════════════════════════════
    //  SAAS LEADS
    // ═══════════════════════════════════════════════════════════════

    async saveSaasLead(lead) {
      if (_isOnline) {
        try { return await _req('POST', '/api/saas/leads', lead, { skipAuth: true }); }
        catch (e) { console.warn('[LUX] SaaS lead:', e.message); }
      }
      const leads = _ls('saas_leads', []); leads.push({ ...lead, ts: new Date().toISOString() }); _lsSet('saas_leads', leads);
      return { success: true, offline: true };
    },

    // ═══════════════════════════════════════════════════════════════
    //  SMART SYNC — offline queue flush
    // ═══════════════════════════════════════════════════════════════

    async _flushPending() {
      if (window._luxFlushing) return;
      const queue = _ls('pending_sync', []);
      if (!queue.length || !_isOnline) return;
      window._luxFlushing = true;

      const remaining = [];
      for (const item of queue) {
        try {
          switch (item.action) {
            case 'createOrder':           await _post('/api/orders', item.data); break;
            case 'updateOrder':           await _patch('/api/orders/' + item.data.id + '/status', { status: item.data.status }); break;
            case 'deleteOrder':           await _del('/api/orders/' + item.data.id); break;
            case 'createReservation':     await _post('/api/reservations', item.data); break;
            case 'updateReservation':     await _patch('/api/reservations/' + item.data.id, item.data); break;
            case 'deleteReservation':     await _del('/api/reservations/' + item.data.id); break;
            case 'createReview':          await _post('/api/reviews', item.data); break;
            case 'saveTransaction':       await _post('/api/transactions', item.data); break;
            case 'updateStock':           await _patch('/api/stock/' + item.data.id, { quantity: item.data.qty }); break;
            case 'createEmployee':        await _post('/api/employees', item.data); break;
            case 'updateEmployee':        await _patch('/api/employees/' + item.data.id, item.data); break;
            case 'deleteEmployee':        await _del('/api/employees/' + item.data.id); break;
            case 'addPayrollEntry':       await _post('/api/payroll', item.data); break;
            case 'updatePayrollEntry':    await _patch('/api/payroll/' + item.data.id, item.data); break;
            case 'deletePayrollEntry':    await _del('/api/payroll/' + item.data.id); break;
            case 'createAdvanceRequest':  await _post('/api/advance-requests', item.data); break;
            case 'updateAdvanceRequest':  await _patch('/api/advance-requests/' + item.data.id, item.data); break;
            case 'registerCustomer':      await _post('/api/customers', item.data); break;
            case 'updateCustomer':        await _patch('/api/customers/' + encodeURIComponent(item.data.phone), item.data); break;
            case 'deleteCustomer':        await _del('/api/customers/' + encodeURIComponent(item.data.phone)); break;
            case 'createGiftCard':        await _post('/api/gift-cards', item.data); break;
            case 'submitJoinRequest':     await _post('/api/employees/join-requests', item.data); break;
            case 'manualTopUp':           await _post('/api/gaming/topup', item.data); break;
            default:                      remaining.push(item);
          }
        } catch { remaining.push(item); }
      }
      _lsSet('pending_sync', remaining);
      window._luxFlushing = false;

      const synced = queue.length - remaining.length;
      if (synced > 0) console.log('[LUX API] Synced', synced, 'items');
    },

    // ═══════════════════════════════════════════════════════════════
    //  HEALTH CHECK
    // ═══════════════════════════════════════════════════════════════

    async checkHealth() {
      if (window._luxHealthChecking) return null;
      window._luxHealthChecking = true;
      try {
        const ctl = new AbortController();
        setTimeout(() => ctl.abort(), 4000);
        const data = await fetch(API_BASE + '/health', { signal: ctl.signal }).then(r => r.json());
        _isOnline = true;
        window._luxHealthChecking = false;
        return data;
      } catch {
        _isOnline = false;
        window._luxHealthChecking = false;
        return null;
      }
    },

    // ═══════════════════════════════════════════════════════════════
    //  INIT
    // ═══════════════════════════════════════════════════════════════

    async init() {
      await this.checkHealth();
      if (_isOnline) this._flushPending();

      setInterval(async () => {
        if (!_isOnline) { await this.checkHealth(); return; }
        const pending = _ls('pending_sync', []);
        if (pending.length > 0) await this._flushPending();
      }, SYNC_INTERVAL);

      console.log('[LUX API v3.0]', _isOnline ? 'Online → ' + API_BASE : 'Offline (localStorage fallback)');
      return _isOnline;
    }
  };

  // ── helper: attach the current employee id to a payload ───────
  function _withEmp(obj) {
    if (!_empSession) return obj;
    return { ...obj, employeeId: _empSession.id, employeeName: _empSession.name };
  }

  window.LuxAPI = LuxAPI;

})(window);
