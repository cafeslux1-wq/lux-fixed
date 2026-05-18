/**
 * ═══════════════════════════════════════════════════════════════════
 *  LUX SESSION BRIDGE — v1.0 (2026-05)
 *  Unifies authentication across all Café LUX pages.
 *  Eliminates the "Votre Commande" double-login at checkout.
 *
 *  ➜ HOW TO USE
 *  Drop this ONE line in the <head> of every page that has a
 *  checkout / order / reservation form (menu, gaming, offres, etc.):
 *
 *    <script src="/public/js/lux-session-bridge.js" defer></script>
 *
 *  That's it. No other code change required.
 *
 *  ➜ WHAT IT DOES (in order, on every page load)
 *  1. Reads the Bearer token from localStorage (lux_token, set by
 *     Mon Espace login). Falls back to legacy lux_customer_session.
 *  2. If a token exists, calls /api/auth/customer/me to get the
 *     fresh profile (name, phone, email, loyaltyPoints, level).
 *  3. Mirrors the profile into legacy localStorage keys so older
 *     pages (menu's "Votre Commande" modal) see the same session.
 *  4. Exposes window.LUX_SESSION API (matches Mon Espace contract).
 *  5. Auto-fills any input that has data-lux-autofill="name|phone|email".
 *  6. Auto-fills checkout modals by common ID patterns (order-name,
 *     customer-name, cart-name, ps-name, fname, lname, phone, etc.).
 *  7. Hides the auth/login step on any modal that has
 *     data-lux-skip-if-authed (or matches known modal IDs).
 *  8. Fires `lux:session-ready` event when the profile is available.
 *  9. Wraps fetch() so any POST to /api/orders, /api/transactions/web,
 *     /api/reservations automatically receives the Bearer token
 *     AND has customer/phone fields injected if missing.
 *
 *  ➜ EVENTS
 *    window.addEventListener('lux:session-ready', e => {
 *      // e.detail = { name, phone, email, token, level, points, discount }
 *    });
 *    window.addEventListener('lux:session-cleared', e => { ... });
 *
 *  ➜ API
 *    window.LUX_SESSION.isAuthenticated() → boolean
 *    window.LUX_SESSION.getToken()        → string | null
 *    window.LUX_SESSION.getProfile()      → object | null
 *    window.LUX_SESSION.refresh()         → Promise<profile>
 *    window.LUX_SESSION.logout()          → void
 *    window.LUX_SESSION.placeOrder({items,total,mode,notes}) → Promise<{ref,points}>
 *
 * ═══════════════════════════════════════════════════════════════════
 */

(function (global) {
  'use strict';

  // ─── CONFIG ──────────────────────────────────────────────────────
  var API_BASE  = global.LUX_API_URL || 'https://cafeslux-api-production.up.railway.app';
  var TOKEN_KEY        = 'lux_token';                  // Mon Espace JWT
  var LEGACY_KEY       = 'lux_customer_session';       // Menu page legacy
  var CACHE_KEY        = 'lux_session_cache';          // Last fetched profile
  var CACHE_TTL_MS     = 5 * 60 * 1000;                // 5 minutes
  var DEBUG            = true;

  function log() {
    if (!DEBUG) return;
    try { console.log.apply(console, ['[LUX-BRIDGE]'].concat([].slice.call(arguments))); } catch (e) {}
  }

  // ─── TOKEN / STORAGE HELPERS ─────────────────────────────────────
  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || null; } catch (e) { return null; }
  }
  function setToken(t) {
    try { if (t) localStorage.setItem(TOKEN_KEY, t); } catch (e) {}
  }
  function clearToken() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(LEGACY_KEY);
      localStorage.removeItem(CACHE_KEY);
    } catch (e) {}
  }
  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || !obj._ts || Date.now() - obj._ts > CACHE_TTL_MS) return null;
      return obj.profile;
    } catch (e) { return null; }
  }
  function writeCache(profile) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ _ts: Date.now(), profile: profile }));
    } catch (e) {}
  }

  // ─── STATE ───────────────────────────────────────────────────────
  var _profile = null;
  var _readyResolvers = [];
  var _readyPromise = new Promise(function (r) { _readyResolvers.push(r); });

  function _setProfile(p) {
    _profile = p;
    if (p) {
      // Mirror to legacy key for backward compatibility
      try {
        localStorage.setItem(LEGACY_KEY, JSON.stringify({
          name: p.name, phone: p.phone, email: p.email || '',
          points: p.loyaltyPoints || 0, level: p.level || 'Bronze',
          created: p.createdAt || new Date().toISOString(),
        }));
      } catch (e) {}
      writeCache(p);
      emit('lux:session-ready', p);
      _readyResolvers.forEach(function (r) { r(p); });
      _readyResolvers = [];
      // Now run all the auto-fill hooks
      _autoFillAll();
    } else {
      emit('lux:session-cleared', {});
    }
  }

  function emit(name, detail) {
    try { global.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch (e) {}
  }

  // ─── FETCH PROFILE FROM SERVER ───────────────────────────────────
  async function fetchProfile() {
    var tok = getToken();
    if (!tok) { _setProfile(null); return null; }

    // Try cache first for instant fill (then refresh in background)
    var cached = readCache();
    if (cached) {
      log('using cached profile, refreshing in background...');
      _setProfile(cached);
    }

    try {
      var res = await fetch(API_BASE + '/api/auth/customer/me', {
        headers: { 'Authorization': 'Bearer ' + tok, 'Accept': 'application/json' },
      });
      if (res.status === 401) {
        log('token rejected (401) — clearing session');
        clearToken();
        _setProfile(null);
        return null;
      }
      if (!res.ok) {
        log('profile fetch failed:', res.status);
        return cached || null;
      }
      var p = await res.json();
      log('profile loaded for', p.name);
      _setProfile(p);
      return p;
    } catch (e) {
      log('profile fetch network error — using cache if available');
      // Network down — keep cached profile
      return cached || null;
    }
  }

  // ─── AUTO-FILL ENGINE ────────────────────────────────────────────
  // Common field IDs/names used in checkout forms across LUX pages
  var FIELD_PATTERNS = {
    name:  ['order-name','customer-name','cart-name','ps-name','fname','first-name','client-name','pf-fname','reg-name','acct-name','user-name','nom','name'],
    lname: ['lname','last-name','pf-lname'],
    phone: ['order-phone','customer-phone','cart-phone','ps-phone','phone','tel','telephone','pf-phone','reg-phone','acct-phone','client-phone'],
    email: ['order-email','customer-email','ps-email','email','pf-email','reg-email','user-email'],
  };

  function _findInput(idCandidates) {
    for (var i = 0; i < idCandidates.length; i++) {
      var el = document.getElementById(idCandidates[i]);
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return el;
      // Try by name attribute
      var byName = document.querySelector('input[name="' + idCandidates[i] + '"], textarea[name="' + idCandidates[i] + '"]');
      if (byName) return byName;
    }
    return null;
  }

  function _splitName(full) {
    var parts = (full || '').trim().split(/\s+/);
    return { first: parts[0] || '', last: parts.slice(1).join(' ') || '' };
  }

  function autoFillForms(profile) {
    if (!profile) return 0;
    var filled = 0;
    var split = _splitName(profile.name || '');

    // 1. data-lux-autofill attribute (explicit opt-in, preferred)
    var attrEls = document.querySelectorAll('[data-lux-autofill]');
    attrEls.forEach(function (el) {
      if (el.value && el.dataset.luxOverwrite !== 'true') return; // don't overwrite user input
      var key = el.dataset.luxAutofill;
      var val = '';
      if (key === 'name' || key === 'fullname') val = profile.name || '';
      else if (key === 'firstname' || key === 'fname') val = split.first;
      else if (key === 'lastname' || key === 'lname') val = split.last;
      else if (key === 'phone') val = profile.phone || '';
      else if (key === 'email') val = profile.email || '';
      if (val) {
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        filled++;
      }
    });

    // 2. Fallback by common IDs/names
    var nameEl = _findInput(FIELD_PATTERNS.name);
    if (nameEl && !nameEl.value && profile.name) {
      // For pf-fname / fname: use first name only
      if (/fname|first/i.test(nameEl.id || nameEl.name || '')) nameEl.value = split.first;
      else nameEl.value = profile.name;
      nameEl.dispatchEvent(new Event('input', { bubbles: true }));
      filled++;
    }
    var lnameEl = _findInput(FIELD_PATTERNS.lname);
    if (lnameEl && !lnameEl.value && split.last) {
      lnameEl.value = split.last;
      lnameEl.dispatchEvent(new Event('input', { bubbles: true }));
      filled++;
    }
    var phoneEl = _findInput(FIELD_PATTERNS.phone);
    if (phoneEl && !phoneEl.value && profile.phone) {
      phoneEl.value = profile.phone;
      phoneEl.dispatchEvent(new Event('input', { bubbles: true }));
      filled++;
    }
    var emailEl = _findInput(FIELD_PATTERNS.email);
    if (emailEl && !emailEl.value && profile.email) {
      emailEl.value = profile.email;
      emailEl.dispatchEvent(new Event('input', { bubbles: true }));
      filled++;
    }

    if (filled) log('auto-filled', filled, 'input(s) from session');
    return filled;
  }

  function _autoFillAll() {
    if (!_profile) return;
    autoFillForms(_profile);
    _hideAuthSteps();
    _attachOnVisible();
  }

  // Hide elements marked as "skip if authenticated"
  function _hideAuthSteps() {
    if (!_profile) return;
    var hidden = 0;
    document.querySelectorAll('[data-lux-skip-if-authed]').forEach(function (el) {
      el.style.display = 'none';
      hidden++;
    });
    // Known auth step IDs (menu page conventions)
    ['acct-login','acct-register','acct-tab-login','acct-tab-register','login-step','auth-step','checkout-auth-prompt']
      .forEach(function (id) {
        var el = document.getElementById(id);
        if (el && el.style) { el.style.display = 'none'; hidden++; }
      });
    if (hidden) log('hid', hidden, 'auth step(s) — user already authenticated');

    // Insert a badge into known checkout modals
    var badgeTargets = [
      'votre-commande-modal','order-modal','checkout-modal','cart-modal',
      'order-form','checkout-form','cart-form'
    ];
    badgeTargets.forEach(function (id) {
      var modal = document.getElementById(id);
      if (modal && !modal.querySelector('.lux-session-badge')) {
        var badge = document.createElement('div');
        badge.className = 'lux-session-badge';
        badge.style.cssText = 'display:flex;align-items:center;gap:8px;background:linear-gradient(135deg,rgba(61,190,122,.08),rgba(61,190,122,.02));border:1px solid rgba(61,190,122,.25);border-radius:10px;padding:9px 12px;margin-bottom:14px;font-size:11px;color:#3dbe7a;line-height:1.4';
        badge.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:#3dbe7a;box-shadow:0 0 12px #3dbe7a"></span>' +
                          '<span>Connecté : <strong style="color:#fff">' + (_profile.name || '—') + '</strong> · pas besoin de re-saisir vos coordonnées</span>';
        // Insert at the top of the modal
        var first = modal.firstElementChild;
        if (first) modal.insertBefore(badge, first); else modal.appendChild(badge);
      }
    });
  }

  // Watch for dynamically-opened modals (the menu page opens the checkout on click)
  function _attachOnVisible() {
    var seen = new WeakSet();
    var obs = new MutationObserver(function () {
      if (!_profile) return;
      document.querySelectorAll('input,textarea,select').forEach(function (el) {
        if (seen.has(el)) return;
        seen.add(el);
      });
      // Re-run fill for any newly visible inputs
      autoFillForms(_profile);
      _hideAuthSteps();
    });
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style','class'] });
  }

  // ─── FETCH WRAPPER — auto-injects token + customer data ──────────
  var _origFetch = global.fetch.bind(global);
  global.fetch = function (input, init) {
    init = init || {};
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var isLuxApi = url.indexOf(API_BASE) === 0 || url.indexOf('/api/') === 0;
    if (!isLuxApi) return _origFetch(input, init);

    // Inject Bearer token if not already set
    var tok = getToken();
    if (tok) {
      init.headers = init.headers || {};
      // Normalize headers
      if (init.headers instanceof Headers) {
        if (!init.headers.has('Authorization')) init.headers.set('Authorization', 'Bearer ' + tok);
      } else {
        if (!init.headers['Authorization'] && !init.headers['authorization']) {
          init.headers['Authorization'] = 'Bearer ' + tok;
        }
      }
    }

    // For order/transaction POSTs, auto-inject customer info if missing
    var method = (init.method || 'GET').toUpperCase();
    var isOrderEndpoint = /\/api\/(orders|transactions\/web|reservations)/.test(url);
    if (method === 'POST' && isOrderEndpoint && _profile && init.body) {
      try {
        var body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
        if (body && typeof body === 'object') {
          if (!body.customer && _profile.name) body.customer = _profile.name;
          if (!body.phone    && _profile.phone) body.phone    = _profile.phone;
          if (!body.email    && _profile.email) body.email    = _profile.email;
          // Re-stringify only if we actually changed something
          init.body = JSON.stringify(body);
          log('auto-injected customer/phone into', url);
        }
      } catch (e) {}
    }

    return _origFetch(input, init);
  };

  // ─── PUBLIC API — window.LUX_SESSION ─────────────────────────────
  global.LUX_SESSION = {
    isAuthenticated: function () { return !!_profile; },
    getToken:        function () { return getToken(); },
    getCustomer:     function () { return _profile ? JSON.parse(JSON.stringify(_profile)) : null; },
    getProfile:      function () {
      if (!_profile) return null;
      return {
        name:     _profile.name,
        phone:    _profile.phone,
        email:    _profile.email,
        token:    getToken(),
        level:    _profile.level || 'Bronze',
        points:   _profile.loyaltyPoints || 0,
        discount: _profile.discount || 0,
      };
    },
    ready:    function () { return _readyPromise; },  // await LUX_SESSION.ready()
    refresh:  function () { return fetchProfile(); },
    logout:   function () { clearToken(); _profile = null; emit('lux:session-cleared', {}); },
    fillForm: function () { return autoFillForms(_profile); },

    /**
     * Place an order using the session profile.
     * Other pages call: await LUX_SESSION.placeOrder({ items, total })
     * The customer name + phone + token are injected automatically.
     */
    placeOrder: async function (order) {
      if (!_profile) throw new Error('Non authentifié');
      if (!order || !order.items || !order.total) throw new Error('items + total requis');
      var ref = 'WEB-' + Date.now();
      var payload = {
        ref:       ref,
        id:        Date.now(),
        date:      new Date().toISOString().slice(0, 10),
        time:      new Date().toTimeString().slice(0, 5),
        type:      order.type || 'delivery',
        items:     order.items.map(function (i) {
          return { name: i.name || i.n, qty: i.qty || i.q || 1, price: i.price || i.p || 0,
                   n: i.name || i.n, q: i.qty || i.q || 1, p: i.price || i.p || 0 };
        }),
        subtotal:  order.subtotal || order.total,
        total:     order.total,
        tva:       order.tva || 0,
        mode:      order.mode || 'card',
        notes:     'Session LUX · ' + (order.notes || ''),
        customer:  _profile.name,
        phone:     _profile.phone,
      };
      var res = await fetch(API_BASE + '/api/transactions/web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur création commande');
      // Refresh profile to get updated loyalty
      fetchProfile();
      return { ref: ref, total: order.total, points: Math.floor(order.total / 10) };
    },
  };

  // ─── BOOT ────────────────────────────────────────────────────────
  function boot() {
    log('booting · token:', getToken() ? 'present' : 'none');
    // Synchronously fill from cache if available (instant, before network)
    var cached = readCache();
    if (cached) {
      _profile = cached;
      _autoFillAll();
      log('instant-filled from cache for', cached.name);
    }
    // Then refresh from server (async)
    fetchProfile();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  log('v1.0 loaded · API:', API_BASE);

})(window);
