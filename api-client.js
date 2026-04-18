/**
 * Cafés LUX — API Client v5.6 (Unified Production Version)
 * ✅ إصلاح خطأ getStations المفقودة
 * ✅ توحيد المسارات مع السيرفر (Railway)
 */

(function (window) {
  'use strict';

  // الرابط الأساسي للسيرفر على Railway
  const BASE = 'https://cafeslux-api-production.up.railway.app';

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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  }

  const LuxAPI = {
    // 1. نظام جلب البيانات الحقيقي (لإصلاح خطأ الإدارة)
    async getStations() {
      try {
        // تنبيه: السيرفر قد يستخدم /api/gaming/stations أو /stations
        // بناءً على هيكلة مشروعك، نستخدم المسار الموحد:
        return await req('/api/gaming/stations');
      } catch (e) {
        console.error("⚠️ LuxAPI: Connection failed at line 55.", e);
        return []; // إرجاع مصفوفة فارغة لمنع انهيار الصفحة
      }
    },

    // 2. نظام التهيئة وفحص الاتصال
    async init() {
      try {
        // فحص الصحة (Health Check)
        const res = await fetch(`${BASE}/health`).catch(() => ({ ok: false }));
        if (res.ok) {
          console.log("✅ LuxAPI: Connected to Railway.");
          this._updateStatusUI('#3DBE7A', '⟡ API Online');
        } else {
          throw new Error();
        }
      } catch (e) {
        console.warn("⚠️ LuxAPI: Connection failed.");
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

    // 3. نظام الجيمنج (Gaming Functions)
    async activateStation(stationId, hours) {
      return req('/api/gaming/activate', {
        method: 'POST',
        body: JSON.stringify({ stationId, hours, timestamp: Date.now() })
      });
    },

    async deactivateStation(stationId) {
        return req(`/api/gaming/stations/${stationId}/deactivate`, { method: 'POST' });
    },

    async stationHeartbeat(stationId) {
      return req(`/api/gaming/stations/${stationId}/heartbeat`, { method: 'POST' });
    },

    // 4. نظام المنتجات والطلبات
    async getProducts() { return req('/api/products'); },
    async createOrder(orderData) {
      return req('/api/orders', {
        method: 'POST',
        body: JSON.stringify(orderData)
      });
    }
  };

  window.LuxAPI = LuxAPI;
  
  if (document.readyState === 'complete') {
    LuxAPI.init();
  } else {
    window.addEventListener('load', () => LuxAPI.init());
  }

})(window);