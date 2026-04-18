/**
 * Cafés LUX — API Client v5.0 (Production Ready)
 * ✅ يُصدَّر كـ window.LuxAPI (متوافق مع <script src> العادي)
 * ✅ يستخدم window.LUX_API_URL المُعرَّف في cafe-lux.html
 * ✅ يغطي جميع الـ Endpoints المطلوبة في cafe-lux.html
 */

(function (window) {
  'use strict';

  // ── الرابط الأساسي ──────────────────────────────────────────────
  // يقرأ من window.LUX_API_URL إذا كان مُعرَّفًا، وإلا يستخدم Railway
  const BASE = (window.LUX_API_URL || 'https://cafeslux-api-production.up.railway.app').replace(/\/$/, '');

  // ── حالة الموظف الحالي (Session داخلي) ──────────────────────────
  let _currentEmployee = null;
  let _online = false;

  // ── أداة fetch مركزية مع timeout ─────────────────────────────────
  async function req(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    try {
      const res = await fetch(BASE + path, {
        ...options,
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
      });
      clearTimeout(timer);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return await res.json();
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  }

  // ══════════════════════════════════════════════════════════════════
  const LuxAPI = {

    // ── نظام التهيئة والاتصال ────────────────────────────────────────

    /** تهيئة الـ Client والتحقق من الاتصال */
    async init() {
      try {
        await req('/health');
        _online = true;
        const dot = document.getElementById('api-dot');
        if (dot) { dot.style.borderColor = '#3DBE7A'; dot.style.color = '#3DBE7A'; dot.textContent = '⟡ API Online'; }
      } catch {
        _online = false;
        const dot = document.getElementById('api-dot');
        if (dot) { dot.style.borderColor = '#E05252'; dot.style.color = '#E05252'; dot.textContent = '⟡ API Offline'; }
      }
    },

    isOnline() { return _online; },

    currentEmployee() { return _currentEmployee; },

    switchEmployee() { _currentEmployee = null; },

    // ── المنتجات والكاتيجوريز ─────────────────────────────────────────

    async getProducts() {
      const data = await req('/api/products');
      localStorage.setItem('lux_menu_cache', JSON.stringify(data));
      return data;
    },

    async getCategories() {
      try {
        return await req('/api/categories');
      } catch {
        // إرجاع كاتيجوريز مُستخرجة من الـ Cache إذا فشل الاتصال
        const cached = JSON.parse(localStorage.getItem('lux_menu_cache') || '[]');
        const cats = [...new Set(cached.map(p => p.category).filter(Boolean))];
        return cats.map(c => ({ name: c }));
      }
    },

    async createProduct(payload) {
      return req('/api/products', { method: 'POST', body: JSON.stringify(payload) });
    },

    async updateProduct(id, payload) {
      return req(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    },

    async deleteProduct(id) {
      return req(`/api/products/${id}`, { method: 'DELETE' });
    },

    // ── الطلبات (Orders) ──────────────────────────────────────────────

    async getOrders({ status, limit } = {}) {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (limit)  params.set('limit', limit);
      const qs = params.toString();
      return req(`/api/orders${qs ? '?' + qs : ''}`);
    },

    async createOrder(orderData) {
      return req('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          id:           orderData.id || `ORD-${Date.now()}`,
          customerName: orderData.customerName || 'Walk-in Customer',
          total:        orderData.total,
          items:        orderData.items,   // [{name, price, qty}]
          tableId:      orderData.tableId || null,
          source:       orderData.source  || 'pos'
        })
      });
    },

    async updateOrderStatus(id, status) {
      return req(`/api/orders/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
    },

    // ── الطاولات والـ QR ──────────────────────────────────────────────

    async getTableOrders(tableId) {
      return req(`/api/orders?tableId=${tableId}&status=pending`);
    },

    // ── المعاملات المالية ────────────────────────────────────────────

    async saveTransaction(tx) {
      return req('/api/transactions', { method: 'POST', body: JSON.stringify(tx) });
    },

    async getTransactions({ from, to, employeeId } = {}) {
      const p = new URLSearchParams();
      if (from)       p.set('from', from);
      if (to)         p.set('to', to);
      if (employeeId) p.set('employeeId', employeeId);
      return req(`/api/transactions${p.toString() ? '?' + p : ''}`);
    },

    // ── المخزون (Stock) ───────────────────────────────────────────────

    async getStock() {
      return req('/api/stock');
    },

    async updateStock(id, quantity) {
      return req(`/api/stock/${id}`, { method: 'PUT', body: JSON.stringify({ quantity }) });
    },

    // ── الموظفون ──────────────────────────────────────────────────────

    async getEmployees() {
      return req('/api/employees');
    },

    async createEmployee(emp) {
      return req('/api/employees', { method: 'POST', body: JSON.stringify(emp) });
    },

    async updateEmployee(id, emp) {
      return req(`/api/employees/${id}`, { method: 'PUT', body: JSON.stringify(emp) });
    },

    async logAttendance(employeeId, type) {
      return req(`/api/employees/${employeeId}/attendance`, {
        method: 'POST',
        body: JSON.stringify({ type, timestamp: new Date().toISOString() })
      });
    },

    async addPayrollEntry(entry) {
      return req('/api/payroll', { method: 'POST', body: JSON.stringify(entry) });
    },

    // ── المصادقة (Auth) ───────────────────────────────────────────────

    async loginEmployeePIN(pin) {
      const result = await req('/api/auth/pin', {
        method: 'POST',
        body: JSON.stringify({ pin })
      });
      if (result && result.employee) {
        _currentEmployee = result.employee;
        _online = true;
      }
      return result?.employee || null;
    },

    async loginEmployeeRFID(uid) {
      const result = await req('/api/auth/rfid', {
        method: 'POST',
        body: JSON.stringify({ uid })
      });
      if (result && result.employee) {
        _currentEmployee = result.employee;
        _online = true;
      }
      return result?.employee || null;
    },

    // ── Dashboard ─────────────────────────────────────────────────────

    async getDashboard() {
      return req('/api/dashboard');
    },

    // ── Gaming ────────────────────────────────────────────────────────

    async activateGaming(stationId, hours) {
      return req('/api/gaming/activate', {
        method: 'POST',
        body: JSON.stringify({ stationId, hours, timestamp: Date.now() })
      });
    }
  };

  // ── تصدير عالمي ──────────────────────────────────────────────────
  window.LuxAPI = LuxAPI;

  // ── دالة checkApiStatus المستدعاة مباشرة من cafe-lux.html ─────────
  window.checkApiStatus = function () { LuxAPI.init(); };

})(window);
