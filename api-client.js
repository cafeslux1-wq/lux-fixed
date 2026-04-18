/**
 * Cafés LUX — API Client v5.5 (Unified Production Version)
 * ✅ تم دمج جميع وظائف الإدارة، المبيعات، والجيمنج
 * ✅ إصلاح أخطاء: LuxAPI is not defined
 * ✅ إضافة الدوال المفقودة: activateStation و stationHeartbeat
 * ✅ دعم كامل لـ gaming.html و cafe-lux.html
 */

(function (window) {
  'use strict';

  // ── الرابط الأساسي ──────────────────────────────────────────────
  const BASE = (window.LUX_API_URL || 'https://cafeslux-api-production.up.railway.app').replace(/\/$/, '');

  // ── حالة النظام الداخلية ────────────────────────────────────────
  let _currentEmployee = null;
  let _online = false;

  // ── أداة fetch مركزية مع معالجة الأخطاء والوقت ───────────────────
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

    // ── نظام التهيئة ────────────────────────────────────────────────

    async init() {
      try {
        await req('/health');
        _online = true;
        this._updateStatusUI('#3DBE7A', '⟡ API Online');
        console.log("✅ LuxAPI: System Connected and Ready.");
      } catch (e) {
        _online = false;
        this._updateStatusUI('#E05252', '⟡ API Offline');
        console.warn("⚠️ LuxAPI: Connection failed.");
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

    // ── المنيو والمنتجات ───────────────────────────────────────────

    async getProducts() {
      const data = await req('/api/products');
      localStorage.setItem('lux_menu_cache', JSON.stringify(data));
      return data;
    },

    async fetchMenu() { return this.getProducts(); },

    async getFreshOffers() {
      try {
        const products = await this.getProducts();
        return products.slice(0, 4);
      } catch (e) { return []; }
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

    // ── نظام الجيمنج (Gaming) ───────────────────────────────────────

    // جلب قائمة الأجهزة (PS5, PS4...)
    async getGamingStations() {
      return req('/api/gaming/stations');
    },

    // تفعيل جهاز لفترة زمنية محددة
    async activateStation(stationId, hours) {
      return req('/api/gaming/activate', {
        method: 'POST',
        body: JSON.stringify({ stationId, hours, timestamp: Date.now() })
      });
    },

    // نبض الجهاز لتحديث الحالة النشطة
    async stationHeartbeat(stationId) {
      return req(`/api/gaming/stations/${stationId}/heartbeat`, { method: 'POST' });
    },

    // ── الطلبات والمعاملات ──────────────────────────────────────────

    async createOrder(orderData) {
      return req('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          id: orderData.id || `ORD-${Date.now()}`,
          customerName: orderData.customerName || 'Walk-in Customer',
          total: orderData.total,
          items: orderData.items,
          tableId: orderData.tableId || null,
          source: orderData.source || 'pos'
        })
      });
    },

    async saveTransaction(tx) {
      return req('/api/transactions', { method: 'POST', body: JSON.stringify(tx) });
    },

    // ── الموظفون والمصادقة ──────────────────────────────────────────

    async loginEmployeePIN(pin) {
      const result = await req('/api/auth/pin', {
        method: 'POST',
        body: JSON.stringify({ pin })
      });
      if (result && result.employee) _currentEmployee = result.employee;
      return result?.employee || null;
    },

    async logAttendance(employeeId, type) {
      return req(`/api/employees/${employeeId}/attendance`, {
        method: 'POST',
        body: JSON.stringify({ type, timestamp: new Date().toISOString() })
      });
    }
  };

  // ── التصدير والتشغيل التلقائي ────────────────────────────────────
  window.LuxAPI = LuxAPI;
  
  // دالة الفحص اليدوي
  window.checkApiStatus = function () { LuxAPI.init(); };

  // التشغيل فور جاهزية الملف
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    LuxAPI.init();
  } else {
    window.addEventListener('DOMContentLoaded', () => LuxAPI.init());
  }

})(window);