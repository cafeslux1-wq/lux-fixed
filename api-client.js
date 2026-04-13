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

  // ── SYNC EMPLOYEES TO SHARED KEY (cafe-lux.html reads lux_employees) ──
  function _normalizePosEmployee(raw, index) {
    raw = raw || {};
    const id = String(raw.id || raw.employeeId || ('E' + String((index || 0) + 1).padStart(3, '0')));
    const username = String(raw.username || raw.login || raw.name || ('cashier' + ((index || 0) + 1))).trim().toLowerCase().replace(/\s+/g, '');
    const pins = _ls('pins_v1', {});
    const pin = String(raw.pin || raw.password || pins[id] || '1234');
    const accountNumber = String(raw.accountNumber || raw.account || raw.code || id).toUpperCase();
    const rfidCode = String(raw.rfidCode || raw.rfid || raw.badgeCode || ('RFID-' + id)).toUpperCase();
    const dallasKey = String(raw.dallasKey || raw.dallas || ('DALLAS-' + id)).toUpperCase();
    const accessCodes = Array.from(new Set([id, username, accountNumber, rfidCode, dallasKey].concat(raw.accessCodes || []).map(v => String(v || '').trim()).filter(Boolean)));
    return {
      id, name: raw.name || raw.fullName || username, role: raw.role || raw.position || 'Cashier',
      username, password: String(raw.password || pin), pin,
      accountNumber, rfidCode, dallasKey, accessCodes,
      initials: (raw.name || username).split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0,2),
      status: raw.endDate ? 'off' : 'active',
      phone: raw.phone || '', since: raw.startDate || '', salary: raw.salary || 0,
      cin: raw.cin || '', address: raw.address || ''
    };
  }

  function _syncEmployeesShared(emps) {
    try {
      const shared = (emps || []).map((e, index) => _normalizePosEmployee(e, index));
      localStorage.setItem('lux_employees', JSON.stringify(shared));
    } catch(e) { console.warn('[LUX] Shared sync failed:', e); }
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
      if (!_isOnline) return _ls('categories_cache', []);
      try {
        const data = await _get('/api/categories');
        _lsSet('categories_cache', data);
        return data;
      } catch { return _ls('categories_cache', []); }
    },
    async getPosCatalog() {
      const fallback = {
        menu: _ls('menu_cache', []),
        products: _ls('products_cache', []),
        categories: _ls('categories_cache', []),
      };

      try {
        const [menu, products, categories] = await Promise.all([
          this.getMenu().catch(() => fallback.menu),
          this.getProducts().catch(() => fallback.products),
          this.getCategories().catch(() => fallback.categories),
        ]);

        return {
          menu: Array.isArray(menu) ? menu : fallback.menu,
          products: Array.isArray(products) ? products : fallback.products,
          categories: Array.isArray(categories) ? categories : fallback.categories,
        };
      } catch {
        return fallback;
      }
    },

    // ── CUSTOMERS ─────────────────────────────────────────────────
    async getCustomers() {
      if (!_isOnline) {
        const local = _ls('web_customers',{});
        return Object.values(local).map(c => ({name:c.name,phone:c.phone,loyaltyPoints:c.points||c.loyaltyPoints||0,_count:{orders:(c.orders||[]).length}}));
      }
      try {
        const data = await _get('/api/customers');
        _lsSet('customers_list', data);
        return data;
      } catch { return _ls('customers_list', []); }
    },
    async getCustomer(phone) {
      if (!phone) return null;
      if (!_isOnline) return _ls('web_customers',{})[phone] || null;
      try {
        const data = await _get('/api/customers/'+encodeURIComponent(phone));
        const all = _ls('web_customers',{}); all[phone]=data; _lsSet('web_customers',all);
        return data;
      } catch { return _ls('web_customers',{})[phone] || null; }
    },
    async registerCustomer(customer) {
      const local = { ...customer, id: customer.id || Date.now(), points: 0 };
      const all = _ls('web_customers',{}); all[customer.phone] = local; _lsSet('web_customers', all);
      if (!_isOnline) { _queue('registerCustomer', customer); return local; }
      try { return await _post('/api/customers', customer); }
      catch { _queue('registerCustomer', customer); return local; }
    },
    async loginCustomer(phone, password) {
      if (!_isOnline) {
        const c = _ls('web_customers',{})[phone];
        if (c && (!c.password || c.password === password)) return c;
        return null;
      }
      try { return await _post('/api/auth/customer', { phone, password }); }
      catch { const c = _ls('web_customers',{})[phone]; return c || null; }
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
    async commitGiftCardUsage(code, amount) {
      const upper = String(code || '').trim().toUpperCase();
      const debit = Number(amount || 0);
      const cards = _ls('gift_cards', []);
      const card = cards.find(g => String(g.code || '').toUpperCase() === upper);
      if (card) {
        const current = Number(card.balance != null ? card.balance : card.amount || 0);
        card.balance = Math.max(0, +(current - debit).toFixed(2));
        _lsSet('gift_cards', cards);
      }
      if (_isOnline) {
        try { return await _post('/api/gift-cards/use', { code: upper, amount: debit }); } catch {}
      }
      return card || null;
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
      const cashier = tx && tx.cashier ? tx.cashier : { id: tx.employeeId || null, name: tx.employeeName || '' };
      const normalized = Object.assign({}, tx, {
        employeeId: tx.employeeId || (cashier && cashier.id) || null,
        employeeName: tx.employeeName || (cashier && cashier.name) || '',
        cashier: cashier,
        items: (tx.items || []).map(item => ({
          n: item.n || item.name || 'Item',
          p: Number(item.p != null ? item.p : item.price || 0),
          q: Number(item.q != null ? item.q : item.quantity || 1),
          modifiers: item.modifiers || [],
          note: item.note || '',
          image: item.image || ''
        }))
      });
      const all = _ls('transactions',[]); all.unshift(normalized); _lsSet('transactions', all.slice(0,500));
      if (normalized.paymentMethod === 'giftcard' && normalized.giftCard && normalized.giftCard.code) {
        await LuxAPI.commitGiftCardUsage(normalized.giftCard.code, normalized.total);
      }
      if (_isOnline && _token) _post('/api/transactions',normalized).catch(()=>_queue('saveTransaction',normalized));
      else _queue('saveTransaction',normalized);
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

    // ── EMPLOYEE CRUD ─────────────────────────────────────────────
    async getEmployees() {
      if (!_isOnline) return _ls('employees_full', []);
      try {
        const d = await _get('/api/employees');
        _lsSet('employees_full', d);
        return d;
      } catch { return _ls('employees_full', []); }
    },
    async getPosEmployees() {
      const full = await LuxAPI.getEmployees().catch(() => []);
      if (Array.isArray(full) && full.length) return full.map(_normalizePosEmployee);
      return (_ls('employees_full', []).concat(_ls('employees', []))).map(_normalizePosEmployee);
    },
    async findEmployeeByAccessCode(code) {
      const upper = String(code || '').trim().toUpperCase();
      if (!upper) return null;
      const pool = await LuxAPI.getPosEmployees().catch(() => []);
      return pool.find(emp => (emp.accessCodes || []).some(v => String(v || '').trim().toUpperCase() === upper)) || null;
    },
    async createEmployee(emp) {
      const local = { ...emp, id: emp.id || 'e' + Date.now() };
      const all = _ls('employees_full', []); all.push(local); _lsSet('employees_full', all);
      // Also sync to shared lux_employees key
      _syncEmployeesShared(all);
      if (!_isOnline) { _queue('createEmployee', local); return local; }
      try { const saved = await _post('/api/employees', emp); return saved; }
      catch { _queue('createEmployee', local); return local; }
    },
    async updateEmployee(id, updates) {
      const all = _ls('employees_full', []);
      const idx = all.findIndex(e => e.id === id);
      if (idx >= 0) { Object.assign(all[idx], updates); _lsSet('employees_full', all); _syncEmployeesShared(all); }
      if (!_isOnline) { _queue('updateEmployee', { id, ...updates }); return all[idx]; }
      try { return await _patch('/api/employees/' + id, updates); }
      catch { _queue('updateEmployee', { id, ...updates }); return all[idx]; }
    },
    async deleteEmployee(id) {
      let all = _ls('employees_full', []);
      all = all.filter(e => e.id !== id); _lsSet('employees_full', all); _syncEmployeesShared(all);
      if (!_isOnline) { _queue('deleteEmployee', { id }); return; }
      try { await _del('/api/employees/' + id); } catch { _queue('deleteEmployee', { id }); }
    },

    // ── PAYROLL ───────────────────────────────────────────────────
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
      const local = { ...entry, id: entry.id || 's' + Date.now() };
      const all = _ls('payroll_all', []); all.unshift(local); _lsSet('payroll_all', all);
      if (!_isOnline) { _queue('addPayrollEntry', local); return local; }
      try { return await _post('/api/payroll', entry); }
      catch { _queue('addPayrollEntry', local); return local; }
    },
    async updatePayrollEntry(id, updates) {
      const all = _ls('payroll_all', []);
      const e = all.find(x => x.id === id);
      if (e) { Object.assign(e, updates); _lsSet('payroll_all', all); }
      if (!_isOnline) { _queue('updatePayrollEntry', { id, ...updates }); return e; }
      try { return await _patch('/api/payroll/' + id, updates); }
      catch { _queue('updatePayrollEntry', { id, ...updates }); return e; }
    },

    // ── ADVANCE REQUESTS ──────────────────────────────────────────
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
      const local = { ...req, id: req.id || 'r' + Date.now(), status: 'pending' };
      const all = _ls('advance_requests', []); all.unshift(local); _lsSet('advance_requests', all);
      if (!_isOnline) { _queue('createAdvanceRequest', local); return local; }
      try { return await _post('/api/advance-requests', req); }
      catch { _queue('createAdvanceRequest', local); return local; }
    },
    async updateAdvanceRequest(id, updates) {
      const all = _ls('advance_requests', []);
      const r = all.find(x => x.id === id);
      if (r) { Object.assign(r, updates); _lsSet('advance_requests', all); }
      if (!_isOnline) { _queue('updateAdvanceRequest', { id, ...updates }); return r; }
      try { return await _patch('/api/advance-requests/' + id, updates); }
      catch { _queue('updateAdvanceRequest', { id, ...updates }); return r; }
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
      if (window._luxFlushing) return; // prevent concurrent flushes
      const queue = _ls('pending_sync',[]);
      if (!queue.length || !_isOnline) return;
      window._luxFlushing = true;
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
            case 'createEmployee':    await _post('/api/employees', item.data); break;
            case 'updateEmployee':    await _patch('/api/employees/'+item.data.id, item.data); break;
            case 'deleteEmployee':    await _del('/api/employees/'+item.data.id); break;
            case 'addPayrollEntry':   await _post('/api/payroll', item.data); break;
            case 'updatePayrollEntry':await _patch('/api/payroll/'+item.data.id, item.data); break;
            case 'createAdvanceRequest': await _post('/api/advance-requests', item.data); break;
            case 'updateAdvanceRequest': await _patch('/api/advance-requests/'+item.data.id, item.data); break;
            case 'registerCustomer': await _post('/api/customers', item.data); break;
            default: remaining.push(item);
          }
        } catch { remaining.push(item); }
      }
      _lsSet('pending_sync', remaining);
      window._luxFlushing = false;
      if (queue.length - remaining.length > 0)
        console.log('[LUX API] Synced', queue.length - remaining.length, 'items');
    },

    // ── HEALTH CHECK ──────────────────────────────────────────────
    async checkHealth() {
      if (window._luxHealthChecking) return null; // debounce concurrent health checks
      window._luxHealthChecking = true;
      try {
        const data = await fetch(API_BASE+'/health', { signal:AbortSignal.timeout(4000) }).then(r=>r.json());
        _isOnline = true;
        window._luxHealthChecking = false;
        return data;
      } catch {
        _isOnline = false;
        window._luxHealthChecking = false;
        return null;
      }
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
