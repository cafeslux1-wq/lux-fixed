/**
 * gaming.js — Gaming Lounge module.
 * Manages: station grid, session booking, timers, alarm, TV control.
 * Fully decoupled from POS.
 */

import api          from '../api/client.js';
import { EP }       from '../api/endpoints.js';
import Store, { STORE_KEYS } from '../store/store.js';
import Toast        from './toast.js';

// ── Pricing (synced from server via Socket.io) ─────────────────
const PRICING = { ps5: 30, ps4: 20, xbox: 25, pc: 15 };

function getPrice(station) {
  const custom  = (Store.get(STORE_KEYS.PRICING) || {}).custom || {};
  const global  = (Store.get(STORE_KEYS.PRICING) || {}).global || PRICING;
  return custom[station.id] ?? global[station.type] ?? 20;
}

// Keep pricing in sync with Socket.io updates
Store.on(STORE_KEYS.PRICING, (p) => {
  if (p?.global) Object.assign(PRICING, p.global);
});

// ── Alarm state ───────────────────────────────────────────────
const alarmingStations = new Set();
let alarmAudio = null;

function triggerAlarm(stationId) {
  if (alarmingStations.has(stationId)) return;
  alarmingStations.add(stationId);
  const card = document.querySelector(`.station-card[data-id="${stationId}"]`);
  if (card) card.classList.add('alarming');
  if (!alarmAudio) {
    alarmAudio = new Audio();
    // Simple beep via AudioContext
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 880;
    gain.gain.value = 0.15;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.3);
    setTimeout(() => ctx.close(), 500);
  }
  Gaming.renderStations();
}

function dismissAlarm(stationId) {
  alarmingStations.delete(stationId);
  const card = document.querySelector(`.station-card[data-id="${stationId}"]`);
  if (card) card.classList.remove('alarming');
  if (!alarmingStations.size) alarmAudio = null;
  Gaming.renderStations();
}

// ── Timer rendering ───────────────────────────────────────────
function formatTimer(endsAt) {
  const diff = new Date(endsAt) - Date.now();
  if (diff <= 0) return '00:00';
  const h  = Math.floor(diff / 3_600_000);
  const m  = Math.floor((diff % 3_600_000) / 60_000);
  const s  = Math.floor((diff % 60_000) / 1000);
  return h > 0
    ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ── GAMING MODULE ─────────────────────────────────────────────
const Gaming = {
  _containerId: 'stations-grid',
  _prevStatuses: {},

  // ── Load & render stations ──────────────────────────────────
  async loadStations(force = false) {
    try {
      const data = await api.get(EP.STATIONS, { ttl: force ? 0 : 8_000 });
      Store.set(STORE_KEYS.STATIONS, data);
      return data;
    } catch (e) {
      console.error('[Gaming] loadStations failed:', e.message);
      return Store.get(STORE_KEYS.STATIONS, []);
    }
  },

  async renderStations(containerId = this._containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const stations   = Store.get(STORE_KEYS.STATIONS, []);
    const prevStatus = this._prevStatuses;

    // Detect alarm: active → available transitions
    stations.forEach(s => {
      if (prevStatus[s.id] === 'active' && s.status === 'available') {
        triggerAlarm(s.id);
      }
      prevStatus[s.id] = s.status;
    });

    container.innerHTML = stations.map(s => this._renderCard(s)).join('');
    this._bindCardEvents(container);
  },

  _renderCard(station) {
    const s         = station;
    const session   = s.currentSession;
    const status    = s.status;
    const isActive  = status === 'active';
    const isWaiting = status === 'awaiting_activation';
    const isAlarming = alarmingStations.has(s.id);
    const price     = getPrice(s);

    const statusLabel = { available:'Disponible', active:'En Cours', awaiting_activation:'En Attente', maintenance:'Maintenance' };
    const dotClass    = { available:'available', active:'active', awaiting_activation:'awaiting', maintenance:'maintenance' };

    return `
    <div class="station-card ${dotClass[status] || ''} ${isAlarming ? 'alarming' : ''}"
         data-id="${s.id}" data-status="${status}">

      <span class="station-type-badge">${(s.type||'PS5').toUpperCase()}</span>

      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
        <span class="station-status-dot ${dotClass[status]||''}"></span>
        <span style="font-size:10px;color:var(--muted)">${statusLabel[status]||status}</span>
      </div>

      <div class="station-label">${s.label}</div>

      ${session ? `
        <div class="station-player">${session.playerName}</div>
        <div class="station-sub">${session.hours}h · ${session.total} MAD · ${session.paymentMethod}</div>
        <div class="station-timer" data-ends="${session.endsAt}">${formatTimer(session.endsAt)}</div>
      ` : `
        <div class="station-sub" style="margin-top:8px">${price} MAD/heure</div>
      `}

      <div class="station-actions">
        ${status === 'available' ? `
          <button class="station-btn" onclick="Gaming.openBooking(${s.id})">⚡ Activer</button>
        ` : ''}
        ${status === 'awaiting_activation' ? `
          <button class="station-btn confirm" onclick="Gaming.confirm(${s.id})">✅ Confirmer</button>
          <button class="station-btn end"     onclick="Gaming.end(${s.id})">⏹ Annuler</button>
        ` : ''}
        ${isActive ? `
          <button class="station-btn end" onclick="Gaming.end(${s.id})">⏹ Terminer</button>
        ` : ''}
        ${isAlarming ? `
          <button class="station-btn alarm-dismiss" onclick="Gaming.dismissAlarm(${s.id})">🔕 Session terminée — Acquitter</button>
        ` : ''}
      </div>
    </div>`;
  },

  _bindCardEvents(container) {
    // Timers auto-update
    setInterval(() => {
      container.querySelectorAll('.station-timer[data-ends]').forEach(el => {
        el.textContent = formatTimer(el.dataset.ends);
      });
    }, 1000);
  },

  // ── Booking modal ───────────────────────────────────────────
  openBooking(stationId) {
    const stations = Store.get(STORE_KEYS.STATIONS, []);
    const station  = stations.find(s => s.id === stationId);
    if (!station) return;

    const price = getPrice(station);
    const plans = [0.5, 1, 1.5, 2, 3, 4].map(h => ({
      hours: h,
      price: Math.round(h * price * 2) / 2,
      label: h === 0.5 ? '30 min' : `${h}h`,
    }));

    // Render booking modal — requires a modal component in the page
    const modal = document.getElementById('booking-modal');
    if (!modal) {
      // Inline fallback
      this._inlineBooking(station, plans);
      return;
    }

    modal.querySelector('.modal-station-name').textContent = station.label;
    const plansContainer = modal.querySelector('.plans-grid');
    plansContainer.innerHTML = plans.map(p => `
      <div class="booking-plan" data-hours="${p.hours}" data-price="${p.price}">
        <div class="booking-plan-hours">${p.label}</div>
        <div class="booking-plan-price">${p.price} MAD</div>
      </div>`).join('');

    plansContainer.querySelectorAll('.booking-plan').forEach(el => {
      el.addEventListener('click', () => {
        plansContainer.querySelectorAll('.booking-plan').forEach(p => p.classList.remove('selected'));
        el.classList.add('selected');
        modal.dataset.hours = el.dataset.hours;
        modal.dataset.price = el.dataset.price;
      });
    });

    modal.dataset.stationId = stationId;
    modal.classList.add('open');
  },

  _inlineBooking(station, plans) {
    const choice = plans.find(p => p.hours === 1) || plans[1];
    const name   = prompt(`Nom du joueur (${station.label} — ${choice.price} MAD/h):`);
    if (name === null) return;
    const phone  = prompt('Téléphone (optionnel):') || '';
    this.activate(station.id, name, phone, choice.hours, 'cash');
  },

  // ── API Actions ─────────────────────────────────────────────
  async activate(stationId, playerName, phone = '', hours = 1, paymentMethod = 'cash') {
    try {
      const result = await api.post(EP.ACTIVATE, { stationId, playerName, phone, hours, paymentMethod });
      if (result?.success) {
        Toast.show(`⚡ ${result.station?.label} activée · ${result.session?.total} MAD`, 'success');
        await this.loadStations(true);
        this.renderStations();
        // Close booking modal
        document.getElementById('booking-modal')?.classList.remove('open');
      }
      return result;
    } catch (e) {
      Toast.show('❌ ' + e.message, 'error');
      throw e;
    }
  },

  async confirm(stationId) {
    try {
      await api.post(EP.CONFIRM(stationId));
      Toast.show('✅ Session confirmée', 'success');
      await this.loadStations(true);
      this.renderStations();
    } catch (e) { Toast.show('❌ ' + e.message, 'error'); }
  },

  async end(stationId) {
    try {
      await api.post(EP.DEACTIVATE(stationId));
      Toast.show('🔓 Session terminée', 'gold');
      await this.loadStations(true);
      this.renderStations();
    } catch (e) { Toast.show('❌ ' + e.message, 'error'); }
  },

  dismissAlarm(stationId) {
    dismissAlarm(stationId);
  },

  // ── Sync loop ───────────────────────────────────────────────
  startSync(intervalMs = 8000) {
    this.loadStations(true).then(() => this.renderStations());
    this._syncInterval = setInterval(async () => {
      await this.loadStations(true);
      this.renderStations();
    }, intervalMs);
  },

  stopSync() {
    clearInterval(this._syncInterval);
  },

  // ── Stats bar ───────────────────────────────────────────────
  async renderStats(containerId = 'gaming-stats') {
    const container = document.getElementById(containerId);
    if (!container) return;
    try {
      const stats = await api.get(EP.GAMING_STATS, { ttl: 15_000 });
      container.innerHTML = `
        <span class="badge badge-gold">⚡ ${stats.activeSessions} actives</span>
        <span class="badge badge-green">${stats.revenueToday} MAD aujourd'hui</span>`;
    } catch {}
  },
};

// Expose globally for inline handlers
window.Gaming = Gaming;

export default Gaming;
