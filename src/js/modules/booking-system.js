/**
 * src/js/modules/booking-system.js
 * Booking Modal Controller — MAESTRO V12
 *
 * Handles the gaming station booking modal:
 *   - Plan selection
 *   - Player info input
 *   - Payment method selection
 *   - Delegates activation to Gaming module
 *
 * Auto-initializes when DOM is ready.
 * Exposes: window.BookingSystem for inline onclick handlers.
 */

import Gaming from './gaming.js';

const BookingSystem = {
  _modal:    null,
  _stationId: null,

  init() {
    this._modal = document.getElementById('booking-modal');
    if (!this._modal) return;

    // Close on overlay click
    this._modal.addEventListener('click', (e) => {
      if (e.target === this._modal) this.close();
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
  },

  open(stationId, plans = []) {
    if (!this._modal) this.init();
    this._stationId = stationId;

    // Update modal title
    const titleEl = this._modal.querySelector('.modal-station-name');
    if (titleEl) titleEl.textContent = `Station #${stationId}`;

    // Render plans grid
    const grid = this._modal.querySelector('.plans-grid');
    if (grid && plans.length) {
      grid.innerHTML = plans.map(p => `
        <div class="booking-plan ${p.selected ? 'selected' : ''}"
             data-hours="${p.hours}" data-price="${p.price}"
             onclick="BookingSystem.selectPlan(this, ${p.hours}, ${p.price})">
          <div class="booking-plan-hours">${p.label}</div>
          <div class="booking-plan-price">${p.price} MAD</div>
        </div>`).join('');
      // Auto-select first plan
      const first = grid.querySelector('.booking-plan');
      if (first) this.selectPlan(first, plans[0].hours, plans[0].price);
    }

    // Show modal
    this._modal.style.display = 'flex';
    requestAnimationFrame(() => this._modal.classList.add('open'));

    // Focus player name input
    setTimeout(() => document.getElementById('booking-name')?.focus(), 100);
  },

  selectPlan(el, hours, price) {
    this._modal?.querySelectorAll('.booking-plan').forEach(p => p.classList.remove('selected'));
    el.classList.add('selected');
    if (this._modal) {
      this._modal.dataset.hours = hours;
      this._modal.dataset.price = price;
    }
  },

  close() {
    if (!this._modal) return;
    this._modal.classList.remove('open');
    this._modal.style.display = 'none';
    // Clear inputs
    const nameEl  = document.getElementById('booking-name');
    const phoneEl = document.getElementById('booking-phone');
    if (nameEl)  nameEl.value  = '';
    if (phoneEl) phoneEl.value = '';
  },

  /**
   * _bookWith — called by pay-btn onclick in booking modal HTML
   * Routes payment to Gaming.activate()
   */
  _bookWith(method) {
    const modal     = document.getElementById('booking-modal');
    const name      = document.getElementById('booking-name')?.value.trim()  || 'Joueur';
    const phone     = document.getElementById('booking-phone')?.value.trim() || '';
    const hours     = parseFloat(modal?.dataset.hours)    || 1;
    const stationId = parseInt(modal?.dataset.stationId)  || this._stationId;

    if (!stationId) { console.warn('[Booking] No stationId'); return; }

    this.close();

    // Delegate to Gaming module
    if (window.GAMING_MODULE?.activate) {
      GAMING_MODULE.activate(stationId, name, phone, hours, method);
    } else if (window.Gaming?.activate) {
      Gaming.activate(stationId, name, phone, hours, method);
    } else {
      console.error('[Booking] Gaming module not available');
    }
  },
};

// ── Auto-init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => BookingSystem.init());

// ── Global exposure for inline onclick handlers ───────────────
window.BookingSystem = BookingSystem;

// ── Backward-compat: keep window.Gaming._bookWith working ────
if (!window.Gaming) window.Gaming = {};
window.Gaming._bookWith = (method) => BookingSystem._bookWith(method);

export default BookingSystem;
