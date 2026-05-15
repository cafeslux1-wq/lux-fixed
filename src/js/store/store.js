/**
 * store.js — Lightweight pub/sub global state.
 * Keeps gaming and POS in sync without any framework.
 *
 * Usage:
 *   import Store from '../store/store.js';
 *   Store.set('cart', items);
 *   Store.on('cart', (items) => renderTicket(items));
 */

const _state     = {};
const _listeners = {};

const Store = {
  /** Get current value */
  get(key, fallback = null) {
    return _state[key] !== undefined ? _state[key] : fallback;
  },

  /** Set value and notify listeners */
  set(key, value) {
    _state[key] = value;
    (_listeners[key] || []).forEach(fn => fn(value));
  },

  /** Update (merge) object value */
  merge(key, partial) {
    const prev = _state[key] || {};
    this.set(key, { ...prev, ...partial });
  },

  /** Subscribe to changes */
  on(key, fn) {
    if (!_listeners[key]) _listeners[key] = [];
    _listeners[key].push(fn);
    return () => this.off(key, fn); // returns unsubscribe fn
  },

  /** Unsubscribe */
  off(key, fn) {
    _listeners[key] = (_listeners[key] || []).filter(f => f !== fn);
  },
};

// ── Pre-defined keys ─────────────────────────────────────────
export const STORE_KEYS = {
  TOKEN:        'token',
  USER:         'user',
  CART:         'cart',
  TABLE:        'selectedTable',
  STATIONS:     'stations',
  PRICING:      'pricing',
  MENU:         'menu',
  ONLINE:       'online',
  ACTIVE_PAGE:  'activePage',
};

export default Store;
