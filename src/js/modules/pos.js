/**
 * pos.js — Point of Sale module.
 * Manages: menu rendering, cart, ticket, payment flow.
 * Extracted from cafe-lux.html.
 *
 * Dependencies: api/client.js, store/store.js, modules/toast.js
 */

import api           from '../api/client.js';
import { EP }        from '../api/endpoints.js';
import Store, { STORE_KEYS } from '../store/store.js';

// ── Local helpers ─────────────────────────────────────────────
const now   = () => new Date().toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit' });
const today = () => new Date().toLocaleDateString('fr-MA');
const fmtCA = (n) => parseFloat(n).toFixed(2) + ' DH';

// ── State ─────────────────────────────────────────────────────
const POS = {
  cart:          [],     // [{ name, price, qty }]
  selectedTable: null,
  mode:          'table',   // 'table' | 'takeaway' | 'delivery'

  // ── MENU ──────────────────────────────────────────────────
  async loadMenu() {
    try {
      let menu = Store.get(STORE_KEYS.MENU);
      if (!menu) {
        menu = await api.get(EP.MENU, { ttl: 120_000 });   // 2 min cache
        Store.set(STORE_KEYS.MENU, menu);
      }
      return menu;
    } catch {
      // Fallback to static menu constant if offline
      return window.MENU || [];
    }
  },

  async buildMenuSections(containerId = 'pos-menu-container') {
    const container = document.getElementById(containerId);
    if (!container) return;
    const menu = await this.loadMenu();
    container.innerHTML = menu.map(cat => this._renderCategory(cat)).join('');
    this._bindItemClicks(container);
  },

  _renderCategory(cat) {
    const items = (cat.items || cat.products || []).filter(i => i.active !== false);
    if (!items.length) return '';
    return `
      <div class="pos-section" data-cat="${cat.id || cat.name}">
        <div class="pos-section-title">
          <span>${cat.icon || ''}</span> ${cat.name || cat.title}
          <span class="badge badge-gray">${items.length}</span>
        </div>
        <div class="pos-items-grid">
          ${items.map(item => this._renderItem(item)).join('')}
        </div>
      </div>`;
  },

  _renderItem(item) {
    const name  = item.name || item.n;
    const price = item.price || item.p;
    const img   = item.imageUrl || item.img;
    const isSig = item.isSignature || item.sig;
    const imgHtml = img
      ? `<img class="pos-item-img" src="${img}" alt="" loading="lazy" onerror="this.style.display='none'">`
      : `<div class="pos-item-img" style="background:var(--bg3);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:22px">🍽️</div>`;

    return `
      <div class="pos-item ${isSig ? 'sig' : ''}" data-n="${name}" data-p="${price}">
        ${imgHtml}
        <div class="pos-item-name">${name}</div>
        <div class="pos-item-price">${price} DH</div>
      </div>`;
  },

  _bindItemClicks(container) {
    container.querySelectorAll('.pos-item').forEach(el => {
      el.addEventListener('click', () => {
        const name  = el.dataset.n;
        const price = parseFloat(el.dataset.p);
        this.addToCart(name, price);
        el.classList.add('flash');
        setTimeout(() => el.classList.remove('flash'), 200);
      });
    });
  },

  // ── CART ───────────────────────────────────────────────────
  addToCart(name, price, qty = 1) {
    const existing = this.cart.find(i => i.name === name);
    if (existing) {
      existing.qty += qty;
    } else {
      this.cart.push({ name, price, qty });
    }
    Store.set(STORE_KEYS.CART, [...this.cart]);
    this.renderTicket();
  },

  removeFromCart(name) {
    const idx = this.cart.findIndex(i => i.name === name);
    if (idx < 0) return;
    if (this.cart[idx].qty > 1) this.cart[idx].qty--;
    else this.cart.splice(idx, 1);
    Store.set(STORE_KEYS.CART, [...this.cart]);
    this.renderTicket();
  },

  clearCart() {
    this.cart = [];
    Store.set(STORE_KEYS.CART, []);
    this.renderTicket();
  },

  getTotal() {
    return this.cart.reduce((s, i) => s + i.price * i.qty, 0);
  },

  // ── TICKET RENDER ──────────────────────────────────────────
  renderTicket(ticketId = 'pos-ticket') {
    const container = document.getElementById(ticketId);
    if (!container) return;

    const itemsEl  = container.querySelector('.ticket-items');
    const totalEl  = container.querySelector('.ticket-total-amount');
    const emptyEl  = container.querySelector('.ticket-empty');

    if (!this.cart.length) {
      if (itemsEl)  itemsEl.innerHTML = '';
      if (totalEl)  totalEl.textContent = '0.00 DH';
      if (emptyEl)  emptyEl.style.display = 'flex';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    if (itemsEl) {
      itemsEl.innerHTML = this.cart.map(item => `
        <div class="ticket-row">
          <div class="ticket-qty">${item.qty}</div>
          <div class="ticket-name">${item.name}</div>
          <div class="ticket-price">${(item.price * item.qty).toFixed(2)} DH</div>
          <div class="ticket-rm" onclick="POS.removeFromCart('${item.name.replace(/'/g, "\\'")}')">×</div>
        </div>`).join('');
    }

    if (totalEl) totalEl.textContent = fmtCA(this.getTotal());
  },

  // ── TABLE ─────────────────────────────────────────────────
  selectTable(n) {
    this.selectedTable = n;
    this.mode = 'table';
    Store.set(STORE_KEYS.TABLE, n);
    this.renderTicket();
  },

  // ── PAYMENT ────────────────────────────────────────────────
  async pay(mode = 'cash') {
    if (!this.cart.length) return;

    const total = this.getTotal();
    const items = this.cart.map(i => ({ name: i.name, price: i.price, qty: i.qty }));

    const order = {
      source:    'pos',
      type:      this.mode,
      table:     this.selectedTable ? String(this.selectedTable) : null,
      payMethod: mode,
      subtotal:  total,
      total,
      items,
    };

    try {
      const result = await api.post(EP.ORDERS, order);
      if (result) {
        this._saveLocalTransaction({ ...order, id: result.ref, ts: now() });
        this.clearCart();
        Store.set('lastOrder', result);
        return result;
      }
    } catch (e) {
      // Offline fallback — save locally
      const ref = 'LOCAL-' + Date.now();
      this._saveLocalTransaction({ ...order, id: ref, ts: now() });
      this.clearCart();
      console.warn('[POS] Offline — saved locally', ref);
      return { ref, offline: true };
    }
  },

  _saveLocalTransaction(tx) {
    try {
      const key   = 'lux_transactions';
      const txs   = JSON.parse(localStorage.getItem(key) || '[]');
      txs.unshift({ ...tx, date: today(), time: now() });
      localStorage.setItem(key, JSON.stringify(txs.slice(0, 500)));
    } catch {}
  },

  // ── RECEIPT PRINT ──────────────────────────────────────────
  printReceipt(tx) {
    const win = window.open('', '_blank', 'width=380,height=600');
    const items = (tx.items || this.cart).map(i =>
      `<tr><td>${i.name}</td><td>×${i.qty}</td><td>${(i.price * i.qty).toFixed(2)} DH</td></tr>`
    ).join('');
    win.document.write(`<!DOCTYPE html><html><head><title>Receipt</title>
      <style>
        @page{size:auto;margin:4mm;}
        body{font-family:Arial,sans-serif;font-size:12px;color:#000;margin:0;padding:12px;}
        .logo{text-align:center;font-size:18px;font-weight:900;letter-spacing:4px;margin-bottom:4px;}
        .sub{text-align:center;font-size:9px;color:#666;margin-bottom:12px;}
        table{width:100%;border-collapse:collapse;}
        td{padding:4px 2px;}
        td:last-child{text-align:right;}
        .total{border-top:1px solid #000;padding-top:6px;font-weight:700;font-size:14px;}
        .footer{text-align:center;font-size:9px;color:#888;margin-top:12px;}
      </style></head><body>
      <div class="logo">✦ CAFÉ LUX</div>
      <div class="sub">Taza, Maroc · cafeslux.com</div>
      <div style="font-size:10px;color:#888;margin-bottom:8px">
        ${tx.table ? 'Table: ' + tx.table : 'À emporter'} · ${tx.ts || now()}
      </div>
      <table>${items}</table>
      <table><tr class="total"><td>TOTAL</td><td>${fmtCA(tx.total || this.getTotal())}</td></tr></table>
      <div class="footer">Merci pour votre visite! · شكراً</div>
      <script>window.onafterprint=function(){window.close()};window.onload=function(){window.print()};<\/script>
      </body></html>`);
    win.document.close();
  },
};

// Expose to global for inline onclick handlers
window.POS = POS;

export default POS;
