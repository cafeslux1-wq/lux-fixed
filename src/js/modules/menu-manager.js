/**
 * src/js/modules/menu-manager.js
 * Menu Manager — MAESTRO V12
 *
 * Handles:
 *   - Fetching menu data from API
 *   - Rendering category tabs
 *   - Rendering product grid
 *   - Search/filter
 *   - Quick-add to cart
 *
 * Used by: pos.module.js, index.html (page-pos)
 * Exposes: window.MenuManager
 */

import api           from '../api/client.js';
import { EP }        from '../api/endpoints.js';
import OrdersStore   from '../stores/orders.store.js';

const MenuManager = {
  _menu:        [],
  _activeCat:   null,
  _container:   null,

  // ── Fetch ───────────────────────────────────────────────────
  async load() {
    try {
      const menu = await api.get(EP.MENU, { ttl: 120_000 });
      this._menu = menu || window.MENU || [];
      return this._menu;
    } catch {
      this._menu = window.MENU || [];
      return this._menu;
    }
  },

  // ── Render category tabs ────────────────────────────────────
  renderCategories(tabsContainerId = 'pos-cat-tabs') {
    const el = document.getElementById(tabsContainerId);
    if (!el || !this._menu.length) return;

    el.innerHTML = this._menu.map((cat, i) => `
      <button class="pos-cat-btn ${i === 0 ? 'active' : ''}"
              data-cat-id="${cat.id}"
              onclick="MenuManager.showCategory('${cat.id}', this)">
        ${cat.icon || ''} ${cat.name || cat.title}
      </button>`).join('');

    // Auto-show first category
    if (this._menu[0]) this.showCategory(this._menu[0].id);
  },

  // ── Show items for a category ───────────────────────────────
  showCategory(catId, btnEl) {
    this._activeCat = catId;

    // Update active tab
    document.querySelectorAll('.pos-cat-btn').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    const cat   = this._menu.find(c => String(c.id) === String(catId));
    const items = cat ? (cat.items || cat.products || []).filter(i => i.active !== false) : [];
    this.renderItems(items);
  },

  // ── Render product grid ─────────────────────────────────────
  renderItems(items, gridId = 'pos-items-grid') {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    if (!items.length) {
      grid.innerHTML = '<div class="muted" style="padding:20px;grid-column:1/-1">Aucun article dans cette catégorie</div>';
      return;
    }

    grid.innerHTML = items.map(item => {
      const name  = item.name || item.n;
      const price = item.price || item.p;
      const img   = item.imageUrl || item.img;
      const isSig = item.isSignature || item.sig;
      return `
        <div class="pos-item ${isSig ? 'sig' : ''}"
             data-name="${name}" data-price="${price}"
             onclick="MenuManager.addItemToCart('${name.replace(/'/g, "\\'")}', ${price})">
          ${img
            ? `<img class="pos-item-img" src="${img}" alt="${name}" loading="lazy" onerror="this.style.display='none'">`
            : `<div class="pos-item-img" style="background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:20px">🍽️</div>`}
          <div class="pos-item-name">${name}</div>
          <div class="pos-item-price">${price} DH</div>
        </div>`;
    }).join('');
  },

  // ── Add item to cart ────────────────────────────────────────
  addItemToCart(name, price) {
    OrdersStore.addToCart({ name, price });

    // Flash animation
    const items = document.querySelectorAll(`.pos-item[data-name="${name}"]`);
    items.forEach(el => {
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 200);
    });

    // Delegate to POS module if available
    if (window.POS_MODULE?.renderTicket) POS_MODULE.renderTicket();
    else if (window.POS?.addToCart) POS.addToCart(name, price);
  },

  // ── Search / filter ─────────────────────────────────────────
  search(query, gridId = 'pos-items-grid') {
    if (!query.trim()) {
      if (this._activeCat) this.showCategory(this._activeCat);
      return;
    }
    const q     = query.toLowerCase();
    const all   = this._menu.flatMap(c => c.items || c.products || [])
                             .filter(i => i.active !== false && (i.name || i.n || '').toLowerCase().includes(q));
    this.renderItems(all, gridId);
  },

  // ── Full init ───────────────────────────────────────────────
  async init(tabsId = 'pos-cat-tabs', gridId = 'pos-items-grid') {
    await this.load();
    this.renderCategories(tabsId);
    if (this._menu[0]) this.showCategory(this._menu[0].id);
    // Wire search input if present
    const searchEl = document.getElementById('menu-search');
    if (searchEl) searchEl.addEventListener('input', e => this.search(e.target.value, gridId));
  },
};

window.MenuManager = MenuManager;
export default MenuManager;
