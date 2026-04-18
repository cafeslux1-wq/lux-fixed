/**
 * Cafés LUX — API Client v5.3 (Final Production Version)
 * ✅ تم حل مشكلة التصدير (Export) والتعرف على LuxAPI في المتصفح
 * ✅ تم حل مشكلة getFreshOffers و fetchMenu المفقودة
 * ✅ تمت إضافة getGamingStations لجلب أجهزة البلايستيشن
 */

(function (window) {
  'use strict';

  // ── الرابط الأساسي ──────────────────────────────────────────────
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

    async init() {
      try {
        await req('/health');
        _online = true;
        this._updateStatusUI('#3DBE7A', '⟡ API Online');
        console.log("✅ LuxAPI System Connected");
      } catch {
        _online = false;
        this._updateStatusUI('#E05252', '⟡ API Offline');
      }
    },

    _updateStatusUI(color, text) {
      const dot = document.getElementById('api-dot');
      if (dot) {
        dot.style.borderColor = color;
        dot.style.color = color;
        dot.textContent = text;
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

    async fetchMenu() {
      return this.getProducts();
    },

    async getFreshOffers() {
      try {
        const products = await this.getProducts();
        return products.slice(0, 4);
      } catch (e) {
        return [];
      }
    },

    async getCategories() {
      try {
        return await req('/api/categories');
      } catch {
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
          items:        orderData.items,
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

    // ── Gaming (المحطات والأجهزة) ──────────────────────────────────────

    async getGamingStations() {
      return req('/api/gaming/stations');
    },

    async activateGaming(stationId, hours) {
      return req('/api/gaming/activate', {
        method: 'POST',
        body: JSON.stringify({ stationId, hours, timestamp: Date.now() })
      });
    }
  };

  // ── التصدير والتشغيل النهائي ───────────────────────────────────────
  window.LuxAPI = LuxAPI;
  
  // دالة مساعدة للموافقة على الفحص
  window.checkApiStatus = function () { LuxAPI.init(); };

  // تشغيل التلقائي عند جاهزية الصفحة
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    LuxAPI.init();
  } else {
    window.addEventListener('DOMContentLoaded', () => LuxAPI.init());
  }

})(window);