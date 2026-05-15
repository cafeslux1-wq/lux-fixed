/**
 * sockets/socket.client.js — FIXED V12.1
 *
 * FIXES:
 *  1. URL reads from window.LUX_API_URL (no more hardcoded string)
 *  2. Added event buffering: events received before .on() is called are queued
 *     → eliminates race condition between module load and socket connect
 *  3. Added reconnect handler that re-fetches pricing (happy hour sync)
 */

import { SOCKET_EVENTS } from '../constants/events.constants.js';

// ── FIX 1: Use env-configured URL ────────────────────────────────────
const BASE_URL = () =>
  window.LUX_API_URL
  || window.LUX_CONFIG?.apiUrl
  || 'https://cafeslux-api-production.up.railway.app';

// ── FIX 2: Event buffering ────────────────────────────────────────────
// Events received before a subscriber registers are held here (max 50ms window)
const _buffer   = {};    // { event: [data, ...] }
const _listeners = {};   // { event: Set<fn> }

function _buffer_push(event, data) {
  if (!_buffer[event]) _buffer[event] = [];
  _buffer[event].push(data);
  // Auto-flush after 100ms — by then all module subscribers should be registered
  setTimeout(() => {
    if (_buffer[event]) {
      _buffer[event].forEach(d => _dispatch(event, d));
      delete _buffer[event];
    }
  }, 100);
}

function _dispatch(event, data) {
  (_listeners[event] || new Set()).forEach(fn => {
    try { fn(data); } catch (e) { console.error('[Socket:dispatch]', event, e); }
  });
}

function on(event, handler) {
  if (!_listeners[event]) _listeners[event] = new Set();
  _listeners[event].add(handler);
  // Deliver any buffered events immediately
  (_buffer[event] || []).forEach(d => handler(d));
  if (_buffer[event]) delete _buffer[event];
  return () => _listeners[event]?.delete(handler);
}

// ── Connection state ──────────────────────────────────────────────────
let _socket    = null;
let _connected = false;
let _rooms     = new Set();

const SocketClient = {
  // ── Connect ────────────────────────────────────────────────────────
  connect(rooms = ['admin', 'gaming']) {
    if (_socket?.connected) { rooms.forEach(r => this.join(r)); return this; }
    if (!window.io) {
      console.warn('[Socket] socket.io-client not loaded — real-time disabled');
      return this;
    }

    _socket = io(BASE_URL(), {
      transports:           ['websocket', 'polling'],
      reconnectionDelay:    2000,
      reconnectionAttempts: 10,
    });

    _socket.on('connect', () => {
      _connected = true;
      console.log('[Socket] Connected:', _socket.id);
      _dispatch('connected', { id: _socket.id });
      _rooms.forEach(r => _socket.emit('join:' + r));

      // ── FIX 3: Re-fetch pricing on every reconnect (happy hour) ────
      import('../services/api/client.js').then(({ default: api }) => {
        import('../js/api/endpoints.js').then(({ EP }) => {
          api.get(EP.PRICING, { ttl: 0 }).then(pricing => {
            if (pricing) {
              import('../stores/gaming.store.js').then(({ default: GamingStore }) => {
                GamingStore.set('pricing', pricing);
                console.log('[Socket] Pricing refreshed on reconnect');
              });
            }
          }).catch(() => {});
        });
      });
    });

    _socket.on('disconnect', (reason) => {
      _connected = false;
      _dispatch('disconnected', { reason });
      console.warn('[Socket] Disconnected:', reason);
    });

    // ── Forward all known events (with buffering) ──────────────────
    Object.values(SOCKET_EVENTS).forEach(event => {
      _socket.on(event, (data) => {
        // If no subscribers yet, buffer it
        if (!_listeners[event]?.size) {
          _buffer_push(event, data);
        } else {
          _dispatch(event, data);
        }
      });
    });

    rooms.forEach(r => this.join(r));
    return this;
  },

  // ── Room management ────────────────────────────────────────────────
  join(room) {
    _rooms.add(room);
    _socket?.emit('join:' + room);
    return this;
  },

  // ── Subscribe ──────────────────────────────────────────────────────
  on,

  // ── Emit ───────────────────────────────────────────────────────────
  emit(event, data) { _socket?.emit(event, data); },

  // ── Disconnect ─────────────────────────────────────────────────────
  disconnect() {
    _socket?.disconnect();
    _socket = null;
    _connected = false;
  },

  get connected() { return _connected; },
  get id()        { return _socket?.id; },
};

export default SocketClient;
export { SOCKET_EVENTS, on as onSocket };
