/**
 * src/js/modules/ui-effects.js
 * UI Effects & Visual Layer — MAESTRO V12
 *
 * Handles:
 *   - Toast notifications (gold/success/error)
 *   - Real-time clock
 *   - Page transition animations
 *   - Notification badge (unread alerts)
 *   - Table number badge (customer mode)
 *   - Scroll-to-top
 *
 * No dependencies on business logic — pure UI.
 * Exposes: window.UI
 */

const UI = {
  // ── Toast ───────────────────────────────────────────────────
  _toastEl:    null,
  _toastTimer: null,

  toast(msg, type = '', duration = 3000) {
    if (!this._toastEl) {
      this._toastEl = document.getElementById('lux-toast');
    }
    if (!this._toastEl) return;

    this._toastEl.textContent = msg;
    this._toastEl.className   = `show${type ? ' toast-' + type : ''}`;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      if (this._toastEl) this._toastEl.className = '';
    }, duration);
  },

  success: (msg, d) => UI.toast(msg, 'success', d),
  error:   (msg, d) => UI.toast(msg, 'error',   d),
  gold:    (msg, d) => UI.toast(msg, 'gold',    d),

  // ── Clock ────────────────────────────────────────────────────
  startClock(elId = 'main-clock') {
    const el = document.getElementById(elId);
    if (!el) return;
    const tick = () => {
      el.textContent = new Date().toLocaleTimeString('fr-MA', {
        hour:   '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    };
    tick();
    setInterval(tick, 1000);
  },

  // ── Notification badge ───────────────────────────────────────
  setBadge(elId, count) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent  = count > 0 ? `${count}` : '';
    el.style.display = count > 0 ? 'inline-flex' : 'none';
  },

  // ── Table badge (customer QR scan) ───────────────────────────
  showTableBadge(tableNum) {
    const existing = document.getElementById('lux-table-badge');
    if (existing) existing.remove();

    const badge = document.createElement('div');
    badge.id    = 'lux-table-badge';
    badge.style.cssText = [
      'position:fixed', 'top:64px', 'left:50%',
      'transform:translateX(-50%)',
      'background:var(--gold)', 'color:#000',
      'padding:4px 20px', 'border-radius:20px',
      'font-size:11px', 'font-weight:700',
      'letter-spacing:2px', 'z-index:150',
      'pointer-events:none', 'white-space:nowrap',
      'box-shadow:0 2px 12px rgba(201,168,76,.4)',
    ].join(';');
    badge.textContent = '✦ TABLE ' + tableNum;
    document.body.appendChild(badge);
  },

  // ── Page transition ──────────────────────────────────────────
  flashPage(pageEl) {
    if (!pageEl) return;
    pageEl.style.opacity = '0';
    requestAnimationFrame(() => {
      pageEl.style.transition = 'opacity .2s ease';
      pageEl.style.opacity    = '1';
    });
  },

  // ── Loading spinner for async sections ───────────────────────
  setLoading(elId, loading, msg = 'Chargement...') {
    const el = document.getElementById(elId);
    if (!el) return;
    if (loading) {
      el.dataset.prevHtml = el.innerHTML;
      el.innerHTML = `<div class="muted" style="padding:20px;text-align:center">${msg}</div>`;
    } else if (el.dataset.prevHtml) {
      el.innerHTML = el.dataset.prevHtml;
      delete el.dataset.prevHtml;
    }
  },

  // ── Smooth scroll to element ─────────────────────────────────
  scrollTo(elId) {
    document.getElementById(elId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  // ── Init all effects ─────────────────────────────────────────
  init() {
    this.startClock();

    // Table badge from URL
    const p = new URLSearchParams(window.location.search);
    const table = p.get('table') || p.get('table_id') || p.get('qr');
    if (table) this.showTableBadge(table);

    // Ripple effect on nav-tabs
    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.addEventListener('click', function(e) {
        const ripple  = document.createElement('span');
        ripple.className = 'nav-ripple';
        ripple.style.cssText = `
          position:absolute;border-radius:50%;background:rgba(201,168,76,.3);
          width:30px;height:30px;margin:-15px 0 0 -15px;
          animation:ripple .4s ease;pointer-events:none;
          left:${e.offsetX}px;top:${e.offsetY}px;`;
        this.style.position = 'relative';
        this.style.overflow  = 'hidden';
        this.appendChild(ripple);
        setTimeout(() => ripple.remove(), 400);
      });
    });
  },
};

// ── Auto-init when DOM ready ──────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => UI.init());
} else {
  UI.init();
}

window.UI = UI;
export default UI;
