/**
 * constants/events.constants.js — FIXED V12.1
 *
 * FIXES:
 *  - Added STATION_STATUS.MAINTENANCE (was missing → maintenance cards rendered incorrectly)
 *  - Added ORDER_CANCELLED, SESSION_ALERT, STOCK_ALERT to SOCKET_EVENTS (backend emits these)
 *  - Removed join:* room events (those are outgoing, not incoming subscriptions)
 */

export const SOCKET_EVENTS = {
  // Gaming
  STATION_UPDATED:  'STATION_UPDATED',
  SESSION_STARTED:  'SESSION_STARTED',
  SESSION_ENDED:    'SESSION_ENDED',
  SESSION_ALERT:    'SESSION_ALERT',     // ← ADDED: backend emits this

  // Orders
  NEW_ORDER:        'NEW_ORDER',
  ORDER_UPDATED:    'ORDER_UPDATED',
  ORDER_CANCELLED:  'ORDER_CANCELLED',  // ← ADDED: backend emits this

  // System
  PRICING_UPDATE:   'pricing:update',
  OPTIMIZER_ALERT:  'optimizer:alert',
  AI_INSIGHT:       'ai:insight',
  STOCK_ALERT:      'stock:alert',
  NEW_LEAD:         'saas:new_lead',   // SaaS lead registration      // ← ADDED: backend emits this

  // Connection
  PONG:             'pong',
  ROOM_JOINED:      'room:joined',
};

export const ORDER_STATUS = {
  PENDING:    'pending',
  ACCEPTED:   'accepted',
  PREPARING:  'preparing',
  READY:      'ready',
  DELIVERED:  'delivered',
  DONE:       'done',
  CANCELLED:  'cancelled',
};

export const STATION_STATUS = {
  AVAILABLE:    'available',
  ACTIVE:       'active',
  AWAITING:     'awaiting_activation',
  MAINTENANCE:  'maintenance',           // ← ADDED: was missing
};

export const PAYMENT_METHODS = {
  CASH:       'cash',
  CARD:       'card',
  STRIPE:     'stripe',
  TPE:        'tpe',
  GOOGLEPAY:  'googlepay',
};

export const PAGES = {
  HOME:       'home',
  POS:        'pos',
  GAMING:     'gaming',
  DASHBOARD:  'dashboard',
  ANALYTICS:  'analytics',
  AI:         'ai',
  STAFF:      'staff',
};
