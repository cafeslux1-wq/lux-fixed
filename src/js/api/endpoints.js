/**
 * js/api/endpoints.js — FIXED V12.1
 *
 * FIXES:
 *  - Added DASHBOARD constant (was missing — dashboard.module was hardcoding)
 *  - Added AI_CHAT, AI_INSIGHTS, AI_ALERTS (ai.module was hardcoding)
 *  - Added GAMING_STATS shorthand
 *  - Renamed CONFIRM/DEACTIVATE to functions for clarity
 */

export const BASE_URL = window.LUX_API_URL
  || window.LUX_CONFIG?.apiUrl
  || 'https://cafeslux-api-production.up.railway.app';

export const EP = {
  // Auth
  LOGIN:          '/api/auth/login',
  PIN_LOGIN:      '/api/auth/pin',
  ME:             '/api/auth/me',

  // Menu
  CATEGORIES:     '/api/categories',
  PRODUCTS:       '/api/products',
  MENU:           '/api/menu',

  // Orders
  ORDERS:         '/api/orders',
  ORDER:          (id) => `/api/orders/${id}`,
  ORDER_STATUS:   (id) => `/api/orders/${id}/status`,

  // Gaming
  STATIONS:       '/api/gaming/stations',
  STATION:        (id) => `/api/gaming/stations/${id}`,
  ACTIVATE:       '/api/gaming/activate',
  CONFIRM:        (id) => `/api/gaming/stations/${id}/confirm`,
  DEACTIVATE:     (id) => `/api/gaming/stations/${id}/deactivate`,
  GAMING_STATS:   '/api/gaming/stats',                          // ← was missing
  PRICING:        '/api/gaming/pricing',
  VERIFY_PAYMENT: '/api/gaming/verify-payment',

  // Dashboard
  DASHBOARD:      '/api/dashboard',                             // ← ADDED
  STATS:          '/api/stats',

  // AI                                                         // ← ALL ADDED
  AI_CHAT:        '/api/ai/chat',
  AI_INSIGHTS:    '/api/ai/insights',
  AI_ALERTS:      '/api/ai/alerts',
  AI_CONTEXT:     '/api/ai/context',

  // Customers
  CUSTOMERS:      '/api/customers',
  CUSTOMER:       (id) => `/api/customers/${id}`,
  LOYALTY:        (id) => `/api/customers/${id}/loyalty`,

  // Reservations
  RESERVATIONS:   '/api/reservations',
  RES_STATUS:     (id) => `/api/reservations/${id}/status`,

  // Employees
  EMPLOYEES:      '/api/employees',
  EMPLOYEE:       (id) => `/api/employees/${id}`,

  // Stock
  STOCK:          '/api/stock',
  STOCK_ITEM:     (id) => `/api/stock/${id}`,

  // Gift cards
  GIFTCARDS:      '/api/giftcards',
  REVIEWS:        '/api/reviews',
};
