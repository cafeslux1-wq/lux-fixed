// ── MAESTRO V12: قفل لمنع حلقة إعادة التشغيل المفرغة ──
if (window.__MAESTRO_IS_RUNNING) {
    console.warn("⚠️ تم حظر محاولة إعادة التشغيل المكررة!");
    throw new Error("Halted Double Bootstrap"); // يوقف الكود المكرر فوراً
}
window.__MAESTRO_IS_RUNNING = true;

/**
 * main.js — MAESTRO V12 Bootstrap (No ES6 imports — global scope)
 * Loaded as plain <script defer> — compatible with GitHub Pages
 * Depends on: api-client.js loaded first (provides window.LuxAPI, window.EP)
 */

(function () {
  'use strict';

  var API_URL = window.LUX_API_URL || 'https://cafeslux-api-production.up.railway.app';


  // ── Toast ─────────────────────────────────────────────────
  function toast(msg, type, duration) {
    var el = document.getElementById('lux-toast');
    if (!el) return;
    el.textContent = msg;
    el.className   = 'show' + (type ? ' toast-' + type : '');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.className = ''; }, duration || 3000);
  }
  window.luxToast = toast;

  // ── Clock ─────────────────────────────────────────────────
  function startClock() {
    var el = document.getElementById('main-clock');
    if (!el) return;
    var tick = function () {
      el.textContent = new Date().toLocaleTimeString('fr-MA', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    };
    tick();
    setInterval(tick, 1000);
  }

  // ── Router ─────────────────────────────────────────────────
  var _activePage = 'home';
  var _initialized = {};

  function goPage(page) {
    _activePage = page;
    // Let the nuclear navigator handle DOM — we only handle data
    lazyInit(page);
  }
  // Global: luxNavigate in index.html takes priority for DOM;
  // goPage in main.js handles data loading only.
  // index.html's window.load bridge will hook these together.
  window._mainGoPage = goPage;   // expose for bridge
  window.showPinModal = function(dest) {
    if (window.luxShowPin) {
      luxShowPin(dest ? function() {
        if (window.luxNavigate) window.luxNavigate(dest);
        else goPage(dest);
      } : null);
    } else if (dest) {
      if (window.luxNavigate) window.luxNavigate(dest);
      else goPage(dest);
    }
  };

  function lazyInit(page) {
    if (_initialized[page]) return;
    _initialized[page] = true;
    if (page === 'pos')       initPOS();
    if (page === 'gaming')    initGaming();
    if (page === 'dashboard') initDashboard();
    if (page === 'home')      initHome();
  }

  // ── Dashboard / Home ───────────────────────────────────────
  function initHome() {
    loadDashboardStats('dashboard-stats');
  }

  function initDashboard() {
    loadDashboardStats('dashboard-stats-full');
  }

  function loadDashboardStats(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    var api = window.LuxAPI;
    if (!api) { el.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:8px">⏳ Connexion...</div>'; return; }

    // FIX: /api/stats is PUBLIC — no token required. Falls back gracefully.
    var token = api.getToken ? api.getToken() : localStorage.getItem('lux_token');
    var endpoint = token ? '/api/dashboard' : '/api/stats';

    api.get(endpoint, { ttl: 15000 }).then(function (data) {
      var ordersToday    = data.orders_today    || (data.cafe  && data.cafe.ordersToday)    || 0;
      var revenueToday   = data.revenue_today   || (data.cafe  && data.cafe.revenueToday)   || 0;
      var activeSessions = data.active_sessions || (data.gaming && data.gaming.activeSessions) || 0;
      var gamingRevenue  = data.gaming_revenue  || (data.gaming && data.gaming.revenueToday) || 0;
      var pendingOrders  = data.pending_orders  || (data.cafe  && data.cafe.pendingOrders)  || 0;
      var co             = data.combined        || {};
      var totalRevenue   = co.totalRevenue      || (parseFloat(revenueToday||0) + parseFloat(gamingRevenue||0));
      el.innerHTML = [
        kpi('Commandes',  ordersToday,                           ''),
        kpi('CA Café',    parseFloat(revenueToday||0).toFixed(2)  + ' MAD', 'green'),
        kpi('Sessions',   activeSessions,                        'blue'),
        kpi('CA Gaming',  parseFloat(gamingRevenue||0).toFixed(2) + ' MAD', 'gold'),
        kpi('En attente', pendingOrders,                         'red'),
        kpi('TOTAL JOUR', parseFloat(totalRevenue||0).toFixed(2) + ' MAD', 'green'),
      ].join('');
    }).catch(function (e) {
      if (e && e.status === 401) {
        el.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:10px">🔒 Stats admin. <button onclick="luxShowPin(function(){loadDashboardStats(\'' + containerId + '\')})" style="background:none;border:1px solid rgba(201,168,76,.4);color:var(--gold,#C9A84C);padding:4px 12px;border-radius:8px;cursor:pointer;font-size:11px;margin-left:6px">Connexion PIN</button></div>';
      } else {
        el.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:8px">⚠️ Hors ligne</div>';
      }
    });
  }

  function kpi(label, value, color) {
    var colors = { green: 'var(--green)', blue: 'var(--blue)', gold: 'var(--gold)', red: 'var(--red)', '': 'var(--gold)' };
    return '<div class="kpi"><div class="kpi-label">' + label + '</div>' +
           '<div class="kpi-value" style="color:' + (colors[color] || colors['']) + '">' + value + '</div></div>';
  }

  // ── POS ───────────────────────────────────────────────────
  var _cart = [];

  function initPOS() {
    var api = window.LuxAPI;
    if (!api) return;
    api.get('/api/menu', { ttl: 120000 }).then(function (menu) {
      renderMenu(menu);
    }).catch(function () {
      var g = document.getElementById('pos-items-grid');
      if (g) g.innerHTML = '<div class="muted" style="padding:20px">Menu indisponible</div>';
    });
  }

  function renderMenu(menu) {
    var tabs = document.getElementById('pos-cat-tabs');
    var grid = document.getElementById('pos-items-grid');
    if (!tabs || !grid || !menu || !menu.length) return;

    tabs.innerHTML = menu.map(function (cat, i) {
      return '<button class="pos-cat-btn' + (i === 0 ? ' active' : '') + '"' +
             ' onclick="luxShowCat(' + cat.id + ', this)">' +
             (cat.icon || '') + ' ' + cat.name + '</button>';
    }).join('');

    window._luxMenu = menu;
    if (menu[0]) luxShowCat(menu[0].id);
  }

  window.luxShowCat = function (catId, btn) {
    document.querySelectorAll('.pos-cat-btn').forEach(function (b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    var cat   = (window._luxMenu || []).find(function (c) { return c.id == catId; });
    var items = cat ? (cat.items || cat.products || []).filter(function (i) { return i.active !== false; }) : [];
    var grid  = document.getElementById('pos-items-grid');
    if (!grid) return;
    grid.innerHTML = items.map(function (item) {
      var name  = item.name || item.n;
      var price = item.price || item.p;
      var img   = item.imageUrl || item.img;
      return '<div class="pos-item" onclick="luxAddToCart(\'' + name.replace(/'/g, "\\'") + '\',' + price + ')">' +
             (img ? '<img class="pos-item-img" src="' + img + '" loading="lazy" onerror="this.style.display=\'none\'">' :
                    '<div class="pos-item-img" style="background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:20px">🍽️</div>') +
             '<div class="pos-item-name">' + name + '</div>' +
             '<div class="pos-item-price">' + price + ' DH</div></div>';
    }).join('') || '<div class="muted" style="padding:20px">Aucun article</div>';
  };

  window.luxAddToCart = function (name, price) {
    var ex = _cart.find(function (i) { return i.name === name; });
    if (ex) { ex.qty++; } else { _cart.push({ name: name, price: price, qty: 1 }); }
    renderTicket();
  };

  window.luxRemoveFromCart = function (name) {
    var idx = _cart.findIndex(function (i) { return i.name === name; });
    if (idx < 0) return;
    if (_cart[idx].qty > 1) _cart[idx].qty--;
    else _cart.splice(idx, 1);
    renderTicket();
  };

  window.luxClearCart = function () { _cart = []; renderTicket(); };

  function renderTicket() {
    var itemsEl = document.getElementById('ticket-items');
    var totalEl = document.getElementById('ticket-total');
    if (!_cart.length) {
      if (itemsEl) itemsEl.innerHTML = '<div class="ticket-empty" style="display:flex;align-items:center;justify-content:center;height:100px;color:var(--muted);font-size:12px">Sélectionnez des articles...</div>';
      if (totalEl) totalEl.textContent = '0.00 DH';
      return;
    }
    if (itemsEl) {
      itemsEl.innerHTML = _cart.map(function (i) {
        return '<div class="ticket-row">' +
               '<div class="ticket-qty">' + i.qty + '</div>' +
               '<div class="ticket-name">' + i.name + '</div>' +
               '<div class="ticket-price">' + (i.price * i.qty).toFixed(2) + ' DH</div>' +
               '<div class="ticket-rm" onclick="luxRemoveFromCart(\'' + i.name.replace(/'/g, "\\'") + '\')">×</div></div>';
      }).join('');
    }
    var total = _cart.reduce(function (s, i) { return s + i.price * i.qty; }, 0);
    if (totalEl) totalEl.textContent = total.toFixed(2) + ' DH';
  }

  window.luxPay = function (method) {
    if (!_cart.length) return;
    var total = _cart.reduce(function (s, i) { return s + i.price * i.qty; }, 0);
    var api   = window.LuxAPI;
    if (!api) { el.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:8px">⏳ Connexion...</div>'; return; }
    api.post('/api/orders', {
      source: 'pos', type: 'table', payMethod: method,
      subtotal: total, total: total,
      items: _cart.map(function (i) { return { name: i.name, price: i.price, qty: i.qty }; }),
    }).then(function (r) {
      toast('✅ Commande #' + r.ref + ' · ' + total.toFixed(2) + ' DH', 'success');
      window.luxClearCart();
    }).catch(function (e) {
      toast('❌ ' + e.message, 'error');
    });
  };

  // ── Gaming ─────────────────────────────────────────────────
  // FIX: Single polling interval, stored so it can be cleared.
  // FIX: Timer intervals managed separately — cleared before each re-render.
  var _gamingPollId  = null;
  var _stationTimers = [];   // track per-station timer IDs

  function initGaming() {
    loadStations();
    // SINGLE interval — 10s. Never re-created.
    if (_gamingPollId) clearInterval(_gamingPollId);
    _gamingPollId = setInterval(loadStations, 10000);
  }

  function loadStations() {
    var api = window.LuxAPI;
    if (!api) return;
    // ttl:0 = always fresh; but ONE request per 10s from setInterval
    api.get('/api/gaming/stations', { ttl: 0 }).then(function (stations) {
      renderStations(stations);
    }).catch(function () {});
  }

  function clearStationTimers() {
    // FIX: kill all accumulated timer intervals before re-rendering
    _stationTimers.forEach(function (id) { clearInterval(id); });
    _stationTimers = [];
  }

  function renderStations(stations) {
    var grid = document.getElementById('stations-grid');
    if (!grid) return;

    // FIX: clear old timers BEFORE destroying the DOM elements they reference
    clearStationTimers();

    if (!stations || !stations.length) {
      grid.innerHTML = '<div style="color:var(--muted);padding:20px">Aucune station disponible</div>';
      return;
    }

    var dotClassMap = { available:'available', active:'active', awaiting_activation:'awaiting', maintenance:'maintenance' };
    var labelMap    = { available:'Disponible', active:'En Cours', awaiting_activation:'En Attente', maintenance:'Maintenance' };

    grid.innerHTML = stations.map(function (s) {
      var session  = s.currentSession;
      var dc = dotClassMap[s.status] || '';
      var lbl = labelMap[s.status] || s.status;
      return '<div class="station-card ' + dc + '" data-id="' + s.id + '">' +
             '<span class="station-type-badge">' + (s.type||'PS5').toUpperCase() + '</span>' +
             '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">' +
             '<span class="station-status-dot ' + dc + '"></span>' +
             '<span style="font-size:10px;color:var(--muted)">' + lbl + '</span></div>' +
             '<div class="station-label">' + s.label + '</div>' +
             (session
               ? '<div class="station-player">' + session.playerName + '</div>' +
                 '<div class="station-sub">' + session.hours + 'h · ' + session.total + ' MAD</div>' +
                 '<div class="station-timer" data-ends="' + session.endsAt + '">⏱</div>'
               : '<div class="station-sub" style="margin-top:6px">Disponible</div>') +
             '<div class="station-actions">' +
             (s.status === 'available'           ? '<button class="station-btn" onclick="luxActivateStation('+s.id+')">⚡ Activer</button>' : '') +
             (s.status === 'awaiting_activation' ? '<button class="station-btn confirm" onclick="luxConfirmStation('+s.id+')">✅ Confirmer</button>' : '') +
             (s.status === 'active'              ? '<button class="station-btn end" onclick="luxEndStation('+s.id+')">⏹ Terminer</button>' : '') +
             '</div></div>';
    }).join('');

    // FIX: create timers AFTER rendering, store IDs for later cleanup
    grid.querySelectorAll('.station-timer[data-ends]').forEach(function (el) {
      var id = setInterval(function () {
        var diff = new Date(el.dataset.ends) - Date.now();
        if (diff <= 0) { el.textContent = '⏰ 00:00'; return; }
        var m = Math.floor(diff / 60000);
        var s2 = Math.floor((diff % 60000) / 1000);
        el.textContent = String(m).padStart(2,'0') + ':' + String(s2).padStart(2,'0');
      }, 1000);
      _stationTimers.push(id);
    });
  }

  window.luxActivateStation = function (id) {
    var name  = prompt('Nom du joueur:') || 'Joueur';
    var hours = parseFloat(prompt('Durée (heures):') || '1');
    if (!hours) return;
    var api = window.LuxAPI;
    if (!api) return;
    api.post('/api/gaming/activate', { stationId: id, playerName: name, hours: hours, paymentMethod: 'cash' })
      .then(function () { toast('⚡ Activé', 'success'); loadStations(); })
      .catch(function (e) { toast('❌ ' + e.message, 'error'); });
  };

  window.luxConfirmStation = function (id) {
    var api = window.LuxAPI;
    if (!api) return;
    api.post('/api/gaming/stations/' + id + '/confirm')
      .then(function () { toast('✅ Confirmé', 'success'); loadStations(); })
      .catch(function (e) { toast('❌ ' + e.message, 'error'); });
  };

  window.luxEndStation = function (id) {
    var api = window.LuxAPI;
    if (!api) return;
    api.post('/api/gaming/stations/' + id + '/deactivate')
      .then(function () { toast('🔓 Session terminée', 'gold'); loadStations(); })
      .catch(function (e) { toast('❌ ' + e.message, 'error'); });
  };

  // ── Auth / PIN ──────────────────────────────────────────────
  var _pinResolve = null;  // resolve callback for pending 401 retries

  function luxShowPin(onSuccess) {
    _pinResolve = onSuccess || null;
    var modal = document.getElementById('pin-modal');
    if (!modal) { injectPinModal(); modal = document.getElementById('pin-modal'); }
    if (modal) modal.style.display = 'flex';
    setTimeout(function () {
      var inp = document.getElementById('pin-input');
      if (inp) inp.focus();
    }, 100);
  }
  window.luxShowPin = luxShowPin;

  function luxSubmitPin() {
    var inp = document.getElementById('pin-input');
    if (!inp || !inp.value) return;
    var pin = inp.value;
    inp.value = '';
    var api = window.LuxAPI;
    if (!api) return;

    api.loginPin(pin).then(function (data) {
      if (data && data.token) {
        toast('✅ Connecté · ' + ((data.employee && data.employee.name) || 'Admin'), 'success');
        var modal = document.getElementById('pin-modal');
        if (modal) modal.style.display = 'none';
        // Retry pending request
        if (_pinResolve) { _pinResolve(); _pinResolve = null; }
        // Reload current page section
        var ap = _activePage;
        _initialized = {};
        goPage(ap);
      } else {
        toast('❌ PIN incorrect', 'error');
      }
    }).catch(function () {
      toast('❌ PIN incorrect', 'error');
    });
  }
  window.luxSubmitPin = luxSubmitPin;

 function injectPinModal() {
    var div = document.createElement('div');
    div.id = 'pin-modal';
    div.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.85);backdrop-filter:blur(8px);z-index:9000;align-items:center;justify-content:center';
    div.innerHTML = [
      '<div style="background:var(--bg2,#131313);border:1px solid rgba(201,168,76,.3);border-radius:20px;padding:32px;width:92%;max-width:320px;text-align:center">',
      '<div style="font-family:serif;color:var(--gold,#C9A84C);font-size:18px;letter-spacing:3px;margin-bottom:6px">✦ ACCÈS</div>',
      '<div style="color:var(--muted,rgba(240,232,213,.45));font-size:11px;margin-bottom:20px">Entrez votre code PIN</div>',
      '<input id="pin-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="• • • •"',
      ' style="width:100%;text-align:center;background:var(--bg3,#1A1A1A);border:1px solid rgba(201,168,76,.3);border-radius:10px;',
      'color:var(--text,#F0E8D5);padding:14px;font-size:22px;letter-spacing:8px;outline:none;box-sizing:border-box;margin-bottom:14px"',
      // 👇 تم تصحيح علامات التنصيص هنا (\'Enter\')
      ' onkeydown="if(event.key===\'Enter\')luxSubmitPin()">',
      '<button onclick="luxSubmitPin()" style="width:100%;padding:12px;background:linear-gradient(135deg,#8B6E2F,#C9A84C);border:none;border-radius:10px;color:#000;font-weight:700;font-size:13px;cursor:pointer;letter-spacing:1px;margin-bottom:8px">ENTRER</button>',
      // 👇 وتم تصحيح علامات التنصيص هنا (\'pin-modal\' و \'none\')
      '<button onclick="document.getElementById(\'pin-modal\').style.display=\'none\'" style="width:100%;padding:8px;background:none;border:1px solid rgba(201,168,76,.2);border-radius:10px;color:var(--muted);font-size:11px;cursor:pointer">Annuler</button>',
      '</div>'
    ].join('');
    document.body.appendChild(div);
    
    // Close on backdrop click
    div.addEventListener('click', function (e) {
      if (e.target === div) div.style.display = 'none';
    });
  }

  function initPinForm() {
    // Legacy: support old #pin-form if present
    var form = document.getElementById('pin-form');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var pin = form.querySelector('input[type="password"]');
      if (!pin || !pin.value) return;
      var api = window.LuxAPI;
      if (!api) return;
      api.loginPin(pin.value).then(function (data) {
        if (data && data.token) toast('✅ Connecté · ' + ((data.employee && data.employee.name) || ''), 'success');
      }).catch(function () { toast('❌ PIN incorrect', 'error'); });
    });
  }

  // ── Customer mode / QR ─────────────────────────────────────
  function detectCustomerMode() {
    var p = new URLSearchParams(window.location.search);
    var table = p.get('table') || p.get('table_id') || p.get('qr');
    if (table) {
      var badge = document.getElementById('ticket-table');
      if (badge) { badge.textContent = 'Table ' + table; badge.style.display = 'inline-block'; }
    }
  }

  // ── Nav wiring ──────────────────────────────────────────────
  function wireNav() {
    document.querySelectorAll('.nav-tab').forEach(function (btn) {
      btn.addEventListener('click', function () { goPage(btn.dataset.page); });
    });
    // PIN button in topbar (admin-only tab click = show PIN if not authenticated)
    document.querySelectorAll('.nav-tab.admin-only').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        var api = window.LuxAPI;
        if (api && !api.getToken()) {
          e.stopImmediatePropagation();
          luxShowPin(function () { goPage(btn.dataset.page); });
        }
      }, true); // capture phase to run before goPage
    });
  }

  // ── Service Worker cache bust ───────────────────────────────
  function bustOldServiceWorkers() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      regs.forEach(function (r) {
        // Unregister old SWs from previous deployments
        if (r.scope && r.scope.indexOf('cafeslux.com') !== -1) {
          r.unregister().then(function () {
            console.log('[SW] Unregistered stale service worker:', r.scope);
          });
        }
      });
    }).catch(function () {});
    // Clear old caches
    if ('caches' in window) {
      caches.keys().then(function (keys) {
        keys.forEach(function (key) {
          if (key.indexOf('lux-') !== -1 && key !== 'lux-v12') {
            caches.delete(key);
            console.log('[SW] Deleted old cache:', key);
          }
        });
      });
    }
  }

  // ── Bootstrap ───────────────────────────────────────────────
  function bootstrap() {
    bustOldServiceWorkers();
    startClock();
    wireNav();
    detectCustomerMode();
    initPinForm();

    // Wait for LuxAPI to be ready (api-client.js loads with defer)
    // Poll up to 3s — covers any race condition
    var apiWaitMs = 0;
    var apiCheck = setInterval(function () {
      apiWaitMs += 50;
      if (window.LuxAPI) {
        clearInterval(apiCheck);
        initHome();
        console.log('[MAESTRO V12] LuxAPI ready ✓ (waited ' + apiWaitMs + 'ms)');
      } else if (apiWaitMs >= 3000) {
        clearInterval(apiCheck);
        // Show connectivity warning instead of hard "API non disponible"
        var el = document.getElementById('dashboard-stats');
        if (el) el.innerHTML = '<div style="color:var(--muted);padding:16px;font-size:12px">⚠️ Connexion en cours... <button onclick="location.reload()" style="background:none;border:1px solid var(--border2,rgba(201,168,76,.3));color:var(--gold,#C9A84C);padding:4px 12px;border-radius:8px;cursor:pointer;margin-left:8px;font-size:11px">Recharger</button></div>';
        console.warn('[MAESTRO V12] LuxAPI not available after 3s — check api-client.js path');
      }
    }, 50);

    // Init home page on load
    // Wire pay buttons
    window.POS = {
      clearCart: window.luxClearCart,
      pay:       window.luxPay,
    };
    // Wire booking modal
    window.BookingSystem = {
      _bookWith: function (method) {
        var modal     = document.getElementById('booking-modal');
        var name      = document.getElementById('booking-name')  ? document.getElementById('booking-name').value.trim()  || 'Joueur' : 'Joueur';
        var phone     = document.getElementById('booking-phone') ? document.getElementById('booking-phone').value.trim() || '' : '';
        var hours     = parseFloat(modal && modal.dataset.hours)     || 1;
        var stationId = parseInt(modal && modal.dataset.stationId)   || 0;
        if (!stationId) return;
        modal.style.display = 'none';
        window.luxActivateStation(stationId, name, phone, hours, method);
      },
    };
    console.log('[MAESTRO V12] Bootstrap complete ✓');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

}());
