// ═══════════════════════════════════════════════════════════════════
//  CAFÉ LUX — SPA Router v3.0 (MAESTRO Phase 1)
//  • Unified bottom navigation bar (7 tabs)
//  • URL parameter routing (?view=menu, ?view=booking, etc.)
//  • Smart Auth Guard: public = free, staff/admin = PIN
//  • Enhanced payment modal (Cash, Carte, PayPal, TPE)
//  • History API integration (no page reloads)
// ═══════════════════════════════════════════════════════════════════

(function(window) {
  'use strict';

  // ── ROUTE DEFINITIONS ────────────────────────────────────────────
  const PUBLIC_VIEWS = ['menu','offers','orders','account','giftcard','booking','saas'];
  const PRIVATE_VIEWS = ['pos','admin','kds','staff','stock'];
  const ALL_VIEWS = [...PUBLIC_VIEWS, ...PRIVATE_VIEWS];

  const VIEW_TAB_MAP = {
    menu:     { icon: '✦', label: 'Menu',        tab: 'menu' },
    offers:   { icon: '🌟', label: 'Offres',      tab: 'offers' },
    orders:   { icon: '📦', label: 'Commandes',   tab: 'tracking' },
    account:  { icon: '👤', label: 'Compte',      tab: 'account' },
    giftcard: { icon: '🎁', label: 'Cadeau',      tab: 'giftcard' },
    booking:  { icon: '📅', label: 'Réserver',    tab: 'reservation' },
    saas:     { icon: '✦', label: 'LUX SaaS',    tab: 'saas', external: true },
  };

  // ── STATE ────────────────────────────────────────────────────────
  let currentView = 'menu';
  let navbarInjected = false;

  // ── URL PARAM ROUTER ─────────────────────────────────────────────
  function getViewFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') || params.get('v') || null;
  }

  function setURLView(view, replace) {
    const url = new URL(window.location);
    url.searchParams.set('view', view);
    if (replace) {
      history.replaceState({ view }, '', url);
    } else {
      history.pushState({ view }, '', url);
    }
  }

  // ── SMART AUTH GUARD ─────────────────────────────────────────────
  function isPublicView(view) {
    return PUBLIC_VIEWS.includes(view);
  }

  function hasValidSession() {
    try {
      const raw = localStorage.getItem('lux_session');
      const session = raw ? JSON.parse(raw) : null;
      return session && session.expires && Date.now() < session.expires;
    } catch { return false; }
  }

  function navigateToView(view, opts) {
    opts = opts || {};

    // ── External views (LUX SaaS) ──
    if (VIEW_TAB_MAP[view] && VIEW_TAB_MAP[view].external) {
      window.open('lux-saas.html', '_blank');
      return;
    }

    // ── Private views → PIN Guard ──
    if (PRIVATE_VIEWS.includes(view)) {
      if (!hasValidSession()) {
        const pinTarget = view === 'stock' ? 'admin' : view;
        if (typeof askPIN === 'function') askPIN(pinTarget);
        return;
      }
      // Session valid → redirect to cafe-lux.html
      window.location.href = 'cafe-lux.html?mode=' + view;
      return;
    }

    // ── Public views → direct access ──
    const gw = document.getElementById('gateway');
    if (gw && !gw.classList.contains('gone')) {
      gw.classList.add('hidden');
      document.getElementById('main-site').style.display = 'block';
      setTimeout(function() { gw.classList.add('gone'); }, 520);
    }

    // Map view → internal tab name
    const tabInfo = VIEW_TAB_MAP[view];
    const tabName = tabInfo ? tabInfo.tab : 'menu';

    currentView = view;
    if (!opts.noURL) setURLView(view, opts.replace);
    switchTab(tabName, null);
    updateNavbar(view);

    // Special init hooks
    if (tabName === 'reservation' && typeof initReservation === 'function') initReservation();
    if (view === 'menu' && typeof buildMenu === 'function') buildMenu();
  }

  // ── BOTTOM NAVBAR ────────────────────────────────────────────────
  function injectNavbar() {
    if (navbarInjected) return;
    navbarInjected = true;

    const nav = document.createElement('nav');
    nav.id = 'lux-bottom-nav';
    nav.innerHTML = Object.keys(VIEW_TAB_MAP).map(function(key) {
      const v = VIEW_TAB_MAP[key];
      const active = key === currentView ? ' active' : '';
      return '<button class="bnav-btn' + active + '" data-view="' + key + '" onclick="LuxRouter.go(\'' + key + '\')">' +
        '<span class="bnav-icon">' + v.icon + '</span>' +
        '<span class="bnav-label">' + v.label + '</span>' +
        '</button>';
    }).join('');

    document.body.appendChild(nav);

    // Inject CSS
    const style = document.createElement('style');
    style.id = 'lux-bnav-css';
    style.textContent = `
      /* ═══════════════════════════════════════════
         BOTTOM NAVIGATION — Luxury Ultra
      ═══════════════════════════════════════════ */
      #lux-bottom-nav {
        position: fixed;
        bottom: 0; left: 0; right: 0;
        z-index: 900;
        display: flex;
        align-items: stretch;
        height: 64px;
        background: linear-gradient(180deg, rgba(8,8,8,.92) 0%, rgba(8,8,8,.98) 100%);
        backdrop-filter: blur(20px) saturate(1.4);
        -webkit-backdrop-filter: blur(20px) saturate(1.4);
        border-top: 1px solid rgba(201,168,76,.15);
        padding: 0 4px;
        padding-bottom: env(safe-area-inset-bottom, 0);
        box-shadow: 0 -4px 32px rgba(0,0,0,.6);
      }

      .bnav-btn {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 3px;
        background: none;
        border: none;
        cursor: pointer;
        padding: 6px 2px;
        position: relative;
        transition: all .25s cubic-bezier(.4,0,.2,1);
        -webkit-tap-highlight-color: transparent;
      }
      .bnav-btn::before {
        content: '';
        position: absolute;
        top: 0; left: 50%; transform: translateX(-50%);
        width: 0; height: 2px;
        background: linear-gradient(90deg, var(--gold-d), var(--gold), var(--gold-d));
        border-radius: 0 0 4px 4px;
        transition: width .3s cubic-bezier(.4,0,.2,1);
      }
      .bnav-btn.active::before { width: 28px; }
      .bnav-btn:active { transform: scale(.92); }

      .bnav-icon {
        font-size: 18px;
        line-height: 1;
        transition: transform .2s;
        filter: grayscale(1) opacity(.5);
      }
      .bnav-btn.active .bnav-icon {
        filter: none;
        transform: scale(1.15);
        text-shadow: 0 0 12px rgba(201,168,76,.4);
      }

      .bnav-label {
        font-family: 'DM Sans', sans-serif;
        font-size: 9px;
        font-weight: 500;
        letter-spacing: .3px;
        color: var(--dim);
        transition: color .2s;
      }
      .bnav-btn.active .bnav-label {
        color: var(--gold);
        font-weight: 600;
      }

      /* Push main content above navbar */
      #main-site { padding-bottom: 72px; }
      body { padding-bottom: env(safe-area-inset-bottom, 0); }

      /* Hide navbar on gateway */
      #gateway ~ #lux-bottom-nav { display: none; }
      body.lux-app-active #lux-bottom-nav { display: flex; }

      /* Responsive: smaller on very small screens */
      @media (max-width: 380px) {
        .bnav-label { font-size: 8px; }
        .bnav-icon { font-size: 16px; }
        #lux-bottom-nav { height: 58px; }
      }

      /* Landscape: compact */
      @media (max-height: 480px) and (orientation: landscape) {
        #lux-bottom-nav { height: 48px; }
        .bnav-icon { font-size: 14px; }
        .bnav-label { display: none; }
      }
    `;
    document.head.appendChild(style);
  }

  function updateNavbar(view) {
    const btns = document.querySelectorAll('.bnav-btn');
    btns.forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-view') === view);
    });
  }

  function showNavbar() {
    document.body.classList.add('lux-app-active');
    injectNavbar();
  }

  // ── HISTORY API HANDLER ──────────────────────────────────────────
  window.addEventListener('popstate', function(e) {
    if (e.state && e.state.view) {
      navigateToView(e.state.view, { noURL: true });
    } else {
      const urlView = getViewFromURL();
      if (urlView) navigateToView(urlView, { noURL: true });
    }
  });

  // ── INIT ─────────────────────────────────────────────────────────
  function initRouter() {
    const urlView = getViewFromURL();
    const pathRouted = window._luxPathRouted; // set by existing URL router

    if (urlView && isPublicView(urlView)) {
      showNavbar();
      navigateToView(urlView, { replace: true });
    } else if (urlView && PRIVATE_VIEWS.includes(urlView)) {
      navigateToView(urlView, { replace: true });
    }
    // If no ?view= param, let existing gateway handle it
  }

  // ── PATCH: Override enterPublic functions to activate navbar ──────
  const _origEnterPublic = window.enterPublic;
  window.enterPublic = function() {
    if (_origEnterPublic) _origEnterPublic();
    showNavbar();
    updateNavbar('menu');
    setURLView('menu', true);
    currentView = 'menu';
  };

  const _origEnterOffers = window.enterPublicOffers;
  window.enterPublicOffers = function() {
    if (_origEnterOffers) _origEnterOffers();
    showNavbar();
    updateNavbar('offers');
    setURLView('offers', true);
    currentView = 'offers';
  };

  const _origEnterMonEspace = window.enterMonEspace;
  window.enterMonEspace = function() {
    if (_origEnterMonEspace) _origEnterMonEspace();
    showNavbar();
    updateNavbar('account');
    setURLView('account', true);
    currentView = 'account';
  };

  const _origEnterReservation = window.enterReservation;
  window.enterReservation = function() {
    if (_origEnterReservation) _origEnterReservation();
    showNavbar();
    updateNavbar('booking');
    setURLView('booking', true);
    currentView = 'booking';
  };

  const _origEnterTracking = window.enterTracking;
  window.enterTracking = function() {
    if (_origEnterTracking) _origEnterTracking();
    showNavbar();
    updateNavbar('orders');
    setURLView('orders', true);
    currentView = 'orders';
  };

  // ── PATCH: switchTab to also update navbar ───────────────────────
  const _origSwitchTab = window.switchTab;
  window.switchTab = function(tab, btn) {
    if (_origSwitchTab) _origSwitchTab(tab, btn);
    // Reverse map tab → view
    const reverseMap = {};
    Object.keys(VIEW_TAB_MAP).forEach(function(k) {
      reverseMap[VIEW_TAB_MAP[k].tab] = k;
    });
    const view = reverseMap[tab];
    if (view) {
      currentView = view;
      updateNavbar(view);
    }
  };

  // ── PUBLIC API ───────────────────────────────────────────────────
  window.LuxRouter = {
    go: function(view) { navigateToView(view); },
    current: function() { return currentView; },
    init: initRouter,
    showNavbar: showNavbar,
    views: ALL_VIEWS,
  };

  // ── AUTO-INIT ────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRouter);
  } else {
    // Defer to let existing code init first
    setTimeout(initRouter, 100);
  }

})(window);
