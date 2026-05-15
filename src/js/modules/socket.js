/**
 * socket.js — Socket.io client manager for lux-fixed.
 * Connects once, routes events to Store + callbacks.
 */

import Store, { STORE_KEYS } from '../store/store.js';
import { BASE_URL } from '../api/endpoints.js';

let _socket = null;

const SocketClient = {
  /** Connect to server Socket.io */
  connect(rooms = []) {
    if (_socket?.connected) return;

    if (!window.io) {
      console.warn('[Socket] Socket.io client not loaded');
      return;
    }

    _socket = io(BASE_URL, { transports: ['websocket', 'polling'] });

    _socket.on('connect', () => {
      console.log('[Socket] Connected:', _socket.id);
      Store.set(STORE_KEYS.ONLINE, true);
      rooms.forEach(r => _socket.emit('join:' + r));
    });

    _socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      Store.set(STORE_KEYS.ONLINE, false);
    });

    // ── Gaming events ────────────────────────────────────────
    _socket.on('STATION_UPDATED', (data) => {
      const stations = Store.get(STORE_KEYS.STATIONS, []);
      const updated  = stations.map(s => s.id === data.id ? { ...s, ...data } : s);
      Store.set(STORE_KEYS.STATIONS, updated);
    });

    // ── Pricing ──────────────────────────────────────────────
    _socket.on('pricing:update', (data) => {
      Store.merge(STORE_KEYS.PRICING, data);
      console.log('[Socket] Pricing updated', data);
    });

    // ── Orders ───────────────────────────────────────────────
    _socket.on('NEW_ORDER', (data) => {
      Store.set('latestOrder', data);
    });

    // ── Optimizer alerts ─────────────────────────────────────
    _socket.on('optimizer:alert', (alert) => {
      const alerts = Store.get('alerts', []);
      Store.set('alerts', [alert, ...alerts.slice(0, 9)]);
    });

    // ── AI insights ──────────────────────────────────────────
    _socket.on('ai:insight', (insight) => {
      Store.set('latestInsight', insight);
    });
  },

  /** Join a room */
  join(room) {
    _socket?.emit('join:' + room);
  },

  /** Emit an event */
  emit(event, data) {
    _socket?.emit(event, data);
  },

  /** Disconnect */
  disconnect() {
    _socket?.disconnect();
    _socket = null;
  },

  get connected() { return !!_socket?.connected; },
};

export default SocketClient;
