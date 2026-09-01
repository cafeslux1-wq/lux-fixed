/* ─────────────────────────────────────────────────────────────
 * lux-tracking.js — Suivi de commande en direct (côté client)
 *
 * Autonome : injecte son CSS et sa fenêtre, aucune dépendance
 * obligatoire. Leaflet et Socket.io sont chargés à la demande,
 * seulement quand ils servent.
 *
 * Intégration (une ligne dans index.html, mon-espace, menu…) :
 *
 *   <script src="../src/js/lux-tracking.js"></script>
 *   <script>
 *     LuxTracking.init({ apiBase: window.LUX_API_URL });
 *     // Après validation d'une commande :
 *     LuxTracking.follow(orderId);
 *   </script>
 *
 * follow() mémorise la commande : si le client ferme l'onglet et
 * revient, le suivi reprend tout seul jusqu'à la livraison.
 *
 * Transport : Socket.io si disponible, sinon interrogation
 * périodique. Le suivi ne doit jamais dépendre d'une seule voie —
 * un client qui ne voit plus sa commande appelle le café.
 * ───────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';

  var CFG = {
    apiBase: '',
    pollMs: 8000,
    autoResume: true,
    onDelivered: null,
    cafeName: 'Café LUX',
  };

  var KEY = 'lux_tracking_order';

  var S = {
    orderId: null,
    data: null,
    socket: null,
    timer: null,
    map: null,
    driverMarker: null,
    destMarker: null,
    line: null,
    ratingOpen: false,
    stars: { global: 0, food: 0, delivery: 0 },
  };

  var STEPS = [
    { key: 'RECEIVED',         icon: '📝', label: 'Commande reçue',   sub: 'Le comptoir a votre commande' },
    { key: 'PREPARING',        icon: '☕', label: 'En préparation',   sub: 'Nos baristas s\u2019en occupent' },
    { key: 'OUT_FOR_DELIVERY', icon: '🛵', label: 'En route',         sub: 'Le livreur arrive vers vous' },
    { key: 'DELIVERED',        icon: '✅', label: 'Livrée',           sub: 'Bon appétit !' },
  ];

  /* ── Styles ────────────────────────────────────────────── */
  var CSS = [
    '.lxt-fab{position:fixed;right:16px;bottom:88px;z-index:9990;display:none;align-items:center;gap:8px;',
    'padding:12px 16px;border-radius:999px;background:#141414;color:#e8c97a;border:1px solid rgba(201,168,76,.4);',
    'box-shadow:0 10px 30px rgba(0,0,0,.5);font:inherit;font-size:13px;font-weight:600;cursor:pointer}',
    '.lxt-fab.on{display:flex}',
    '.lxt-dot{width:8px;height:8px;border-radius:50%;background:#4ade80;animation:lxtblink 1.6s infinite}',
    '@keyframes lxtblink{0%,100%{opacity:1}50%{opacity:.25}}',
    '@media (prefers-reduced-motion:reduce){.lxt-dot{animation:none}}',

    '.lxt-overlay{position:fixed;inset:0;z-index:9995;display:none;align-items:flex-end;justify-content:center;',
    'background:rgba(6,6,6,.86);backdrop-filter:blur(6px)}',
    '.lxt-overlay.on{display:flex}',
    '.lxt-sheet{width:100%;max-width:460px;max-height:92vh;overflow:auto;background:#111;color:#f0ece4;',
    'border:1px solid rgba(201,168,76,.28);border-radius:22px 22px 0 0;padding:20px}',
    '@media(min-width:520px){.lxt-overlay{align-items:center}.lxt-sheet{border-radius:22px}}',

    '.lxt-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px}',
    '.lxt-eyebrow{font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:#c9a84c}',
    '.lxt-ref{font-size:18px;font-weight:700;margin-top:3px}',
    '.lxt-x{background:none;border:0;color:#8b9099;font-size:26px;line-height:1;padding:2px 8px;cursor:pointer}',

    '.lxt-eta{background:#181818;border:1px solid rgba(255,255,255,.06);border-radius:14px;',
    'padding:12px 14px;margin-bottom:16px;font-size:13px;color:#cfc9bd;line-height:1.6}',

    '.lxt-steps{position:relative;margin:0 0 18px;padding:0;list-style:none}',
    '.lxt-step{display:flex;gap:14px;padding-bottom:20px;position:relative}',
    '.lxt-step:last-child{padding-bottom:0}',
    '.lxt-step::before{content:"";position:absolute;left:17px;top:36px;bottom:-2px;width:2px;background:#2a2a2a}',
    '.lxt-step:last-child::before{display:none}',
    '.lxt-step.done::before{background:#c9a84c}',
    '.lxt-bullet{width:36px;height:36px;flex:none;border-radius:50%;background:#1c1c1c;border:1.5px solid #2f2f2f;',
    'display:flex;align-items:center;justify-content:center;font-size:16px;z-index:1}',
    '.lxt-step.done .lxt-bullet{background:rgba(201,168,76,.14);border-color:#c9a84c}',
    '.lxt-step.now .lxt-bullet{background:#c9a84c;border-color:#c9a84c;',
    'box-shadow:0 0 0 6px rgba(201,168,76,.14)}',
    '.lxt-lbl{font-size:14.5px;font-weight:600;color:#6b6b6b;padding-top:7px}',
    '.lxt-step.done .lxt-lbl,.lxt-step.now .lxt-lbl{color:#f0ece4}',
    '.lxt-sub{font-size:11.5px;color:#7d7d7d;margin-top:2px}',
    '.lxt-time{font-size:11px;color:#c9a84c;margin-top:2px}',

    '.lxt-map{height:220px;border-radius:14px;overflow:hidden;margin-bottom:14px;background:#161616;display:none}',
    '.lxt-map.on{display:block}',
    '.lxt-stale{font-size:11.5px;color:#d99a4a;margin:-8px 0 14px}',

    '.lxt-driver{display:flex;align-items:center;gap:12px;background:#181818;border-radius:14px;',
    'padding:12px;margin-bottom:14px;display:none}',
    '.lxt-driver.on{display:flex}',
    '.lxt-av{width:42px;height:42px;border-radius:50%;background:#c9a84c;color:#111;flex:none;',
    'display:flex;align-items:center;justify-content:center;font-size:20px}',
    '.lxt-call{margin-left:auto;padding:9px 14px;border-radius:10px;background:rgba(201,168,76,.14);',
    'border:1px solid rgba(201,168,76,.35);color:#e8c97a;text-decoration:none;font-size:13px}',

    '.lxt-items{border-top:1px dashed #2a2a2a;padding-top:12px;font-size:13px;color:#b9b3a8}',
    '.lxt-line{display:flex;justify-content:space-between;padding:4px 0}',
    '.lxt-line.tot{font-size:16px;font-weight:700;color:#f0ece4;border-top:1px dashed #2a2a2a;margin-top:8px;padding-top:10px}',

    '.lxt-rate{text-align:center}',
    '.lxt-stars{display:flex;justify-content:center;gap:6px;margin:8px 0 4px}',
    '.lxt-star{background:none;border:0;font-size:32px;line-height:1;cursor:pointer;padding:2px;',
    'filter:grayscale(1);opacity:.35;transition:opacity .15s}',
    '.lxt-star.lit{filter:none;opacity:1}',
    '.lxt-star:focus-visible{outline:2px solid #c9a84c;outline-offset:2px;border-radius:6px}',
    '.lxt-rlbl{font-size:12px;color:#8b9099;margin-top:10px}',
    '.lxt-ta{width:100%;min-height:78px;background:#0d0d0d;color:#f0ece4;border:1px solid #2a2a2a;',
    'border-radius:12px;padding:12px;font:inherit;font-size:14px;margin:12px 0;box-sizing:border-box;resize:vertical}',
    '.lxt-btn{width:100%;padding:15px;border-radius:12px;border:0;font:inherit;font-size:15px;font-weight:600;',
    'cursor:pointer;min-height:52px;margin-bottom:8px}',
    '.lxt-gold{background:#c9a84c;color:#111}',
    '.lxt-ghost{background:transparent;color:#8b9099;border:1px solid #2a2a2a}',
    '.lxt-btn:disabled{opacity:.5;cursor:not-allowed}',
    '.lxt-msg{padding:11px;border-radius:11px;font-size:12.5px;margin-bottom:12px;display:none;line-height:1.5}',
    '.lxt-msg.on{display:block}',
    '.lxt-err{background:rgba(214,84,74,.14);color:#f2a49c;border:1px solid rgba(214,84,74,.32)}',
    '.lxt-ok{background:rgba(74,222,128,.12);color:#9ddcb2;border:1px solid rgba(74,222,128,.3)}',
  ].join('');

  var el = {};

  function mount() {
    if (el.overlay) return;

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var fab = document.createElement('button');
    fab.className = 'lxt-fab';
    fab.innerHTML = '<span class="lxt-dot"></span> Suivre ma commande';
    fab.onclick = openSheet;
    document.body.appendChild(fab);

    var ov = document.createElement('div');
    ov.className = 'lxt-overlay';
    ov.innerHTML = '<div class="lxt-sheet" role="dialog" aria-modal="true" aria-label="Suivi de commande">'
      + '<div class="lxt-head">'
      + '  <div><div class="lxt-eyebrow">' + esc(CFG.cafeName) + '</div><div class="lxt-ref" data-lxt="ref">—</div></div>'
      + '  <button class="lxt-x" data-lxt="close" aria-label="Fermer">&times;</button>'
      + '</div>'
      + '<div class="lxt-msg" data-lxt="msg"></div>'
      + '<div data-lxt="body"></div>'
      + '</div>';
    document.body.appendChild(ov);

    el.overlay = ov;
    el.fab = fab;
    el.body = ov.querySelector('[data-lxt="body"]');
    el.msg = ov.querySelector('[data-lxt="msg"]');
    el.ref = ov.querySelector('[data-lxt="ref"]');

    ov.addEventListener('click', function (e) {
      if (e.target === ov || e.target.closest('[data-lxt="close"]')) closeSheet();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && ov.classList.contains('on')) closeSheet();
    });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  function money(n) { return (Math.round((Number(n) || 0) * 100) / 100).toFixed(2) + ' DH'; }
  function hhmm(d) {
    if (!d) return '';
    var t = new Date(d);
    return t.getHours() + 'h' + String(t.getMinutes()).padStart(2, '0');
  }
  function say(text, kind) {
    el.msg.textContent = text || '';
    el.msg.className = 'lxt-msg' + (text ? ' on ' + (kind === 'ok' ? 'lxt-ok' : 'lxt-err') : '');
  }

  /* ── Rendu ─────────────────────────────────────────────── */
  function render() {
    var d = S.data;
    if (!d) return;

    el.ref.textContent = 'Commande ' + d.ref;

    if (d.cancelled) {
      el.body.innerHTML = '<div class="lxt-eta">Cette commande a été annulée. '
        + 'Contactez le comptoir si vous pensez qu\u2019il s\u2019agit d\u2019une erreur.</div>';
      return;
    }

    var stepsHtml = STEPS.map(function (st, i) {
      var cls = i < d.stepIndex ? 'done' : (i === d.stepIndex ? 'done now' : '');
      var stamp = '';
      if (st.key === 'RECEIVED') stamp = hhmm(d.timestamps.createdAt);
      if (st.key === 'PREPARING') stamp = hhmm(d.timestamps.preparingAt);
      if (st.key === 'OUT_FOR_DELIVERY') stamp = hhmm(d.timestamps.pickedUpAt);
      if (st.key === 'DELIVERED') stamp = hhmm(d.timestamps.deliveredAt);

      return '<li class="lxt-step ' + cls + '">'
        + '<div class="lxt-bullet">' + st.icon + '</div>'
        + '<div><div class="lxt-lbl">' + st.label + '</div>'
        + '<div class="lxt-sub">' + (i === d.stepIndex ? st.sub : '') + '</div>'
        + (stamp && i <= d.stepIndex ? '<div class="lxt-time">' + stamp + '</div>' : '')
        + '</div></li>';
    }).join('');

    var itemsHtml = (d.items || []).map(function (it) {
      return '<div class="lxt-line"><span>' + it.quantity + ' × ' + esc(it.name) + '</span>'
        + '<span>' + money(it.price * it.quantity) + '</span></div>';
    }).join('');

    el.body.innerHTML =
      '<div class="lxt-eta">' + etaText(d) + '</div>'
      + '<div class="lxt-map" data-lxt="map"></div>'
      + '<div data-lxt="stale"></div>'
      + '<div class="lxt-driver" data-lxt="driver"></div>'
      + '<ul class="lxt-steps">' + stepsHtml + '</ul>'
      + (itemsHtml
        ? '<div class="lxt-items">' + itemsHtml
          + '<div class="lxt-line tot"><span>Total</span><span>' + money(d.totalAmount) + '</span></div></div>'
        : '');

    renderDriver(d);
    renderMap(d);

    // Livrée et pas encore notée : on demande l'avis tout de suite,
    // c'est le seul moment où le client s'en souvient vraiment.
    if (d.step === 'DELIVERED' && !d.rated && !S.ratingOpen) {
      setTimeout(function () { renderRating(); }, 900);
    }
  }

  function etaText(d) {
    if (d.step === 'DELIVERED') return 'Commande livrée à ' + hhmm(d.timestamps.deliveredAt) + '. Merci !';
    if (d.step === 'OUT_FOR_DELIVERY') {
      return d.driver && d.driver.name
        ? esc(d.driver.name) + ' est en route avec votre commande.'
        : 'Votre commande est partie en livraison.';
    }
    if (d.step === 'PREPARING') return 'Votre commande est en cours de préparation au comptoir.';
    return 'Commande enregistrée. Le comptoir la prend en charge.';
  }

  function renderDriver(d) {
    var box = el.body.querySelector('[data-lxt="driver"]');
    if (!box || !d.driver || d.step !== 'OUT_FOR_DELIVERY') return;

    box.className = 'lxt-driver on';
    box.innerHTML = '<div class="lxt-av">🛵</div>'
      + '<div><div style="font-weight:600;font-size:14px">' + esc(d.driver.name) + '</div>'
      + '<div class="lxt-sub">Votre livreur</div></div>'
      + (d.driver.phone
        ? '<a class="lxt-call" href="tel:' + esc(d.driver.phone) + '">📞 Appeler</a>'
        : '');
  }

  /* ── Carte (Leaflet, chargé à la demande) ──────────────── */
  function renderMap(d) {
    var box = el.body.querySelector('[data-lxt="map"]');
    var stale = el.body.querySelector('[data-lxt="stale"]');
    if (!box) return;

    var hasPoint = d.driver && d.driver.lat != null;
    if (d.step !== 'OUT_FOR_DELIVERY' || !hasPoint) return;

    box.classList.add('on');

    // Une position figée depuis plusieurs minutes n'est pas du direct.
    // Le dire évite au client de croire que le livreur est arrêté.
    if (stale && d.driver.fresh === false) {
      stale.innerHTML = '<div class="lxt-stale">⚠ Dernière position connue à '
        + hhmm(d.driver.updatedAt) + ' — le GPS du livreur ne répond plus.</div>';
    } else if (stale) {
      stale.innerHTML = '';
    }

    loadLeaflet(function (ok) {
      if (!ok) {
        box.innerHTML = '<div style="padding:16px;font-size:12.5px;color:#8b9099">'
          + 'Carte indisponible hors connexion. Le livreur est en route.</div>';
        return;
      }
      drawMap(box, d);
    });
  }

  function loadLeaflet(cb) {
    if (global.L) return cb(true);

    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);

    var sc = document.createElement('script');
    sc.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    sc.onload = function () { cb(true); };
    sc.onerror = function () { cb(false); };
    document.head.appendChild(sc);
  }

  function drawMap(box, d) {
    var L = global.L;
    var pos = [d.driver.lat, d.driver.lng];

    if (!S.map || S.mapBox !== box) {
      box.innerHTML = '';
      S.map = L.map(box, { zoomControl: false, attributionControl: false }).setView(pos, 15);
      S.mapBox = box;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(S.map);
      S.driverMarker = null;
      S.destMarker = null;
      S.line = null;
    }

    var scooter = L.divIcon({
      html: '<div style="font-size:26px;line-height:1">🛵</div>',
      className: '', iconSize: [30, 30], iconAnchor: [15, 15],
    });

    if (!S.driverMarker) S.driverMarker = L.marker(pos, { icon: scooter }).addTo(S.map);
    else S.driverMarker.setLatLng(pos);

    if (d.destination) {
      var dest = [d.destination.lat, d.destination.lng];
      if (!S.destMarker) {
        S.destMarker = L.marker(dest, {
          icon: L.divIcon({ html: '<div style="font-size:24px">📍</div>', className: '', iconSize: [26, 26], iconAnchor: [13, 24] }),
        }).addTo(S.map);
      }
      var pts = [pos, dest];
      if (!S.line) S.line = L.polyline(pts, { color: '#c9a84c', weight: 3, dashArray: '6 8' }).addTo(S.map);
      else S.line.setLatLngs(pts);
      S.map.fitBounds(L.latLngBounds(pts).pad(0.35));
    } else {
      S.map.setView(pos);
    }

    setTimeout(function () { if (S.map) S.map.invalidateSize(); }, 120);
  }

  /* ── Notation ──────────────────────────────────────────── */
  function renderRating() {
    S.ratingOpen = true;
    openSheet();

    el.body.innerHTML =
      '<div class="lxt-rate">'
      + '  <div style="font-size:40px;margin-bottom:6px">🌟</div>'
      + '  <div style="font-size:17px;font-weight:600">Comment était votre commande ?</div>'
      + '  <div class="lxt-sub" style="margin-top:4px">Votre avis nous aide à nous améliorer.</div>'

      + '  <div class="lxt-rlbl">Note globale</div>'
      + '  <div class="lxt-stars" data-lxt="stars-global"></div>'
      + '  <div class="lxt-rlbl">Qualité des produits</div>'
      + '  <div class="lxt-stars" data-lxt="stars-food"></div>'
      + '  <div class="lxt-rlbl">Livraison</div>'
      + '  <div class="lxt-stars" data-lxt="stars-delivery"></div>'

      + '  <textarea class="lxt-ta" data-lxt="comment" placeholder="Un mot sur votre expérience (facultatif)"></textarea>'
      + '  <button class="lxt-btn lxt-gold" data-lxt="send">Envoyer mon avis</button>'
      + '  <button class="lxt-btn lxt-ghost" data-lxt="skip">Plus tard</button>'
      + '</div>';

    ['global', 'food', 'delivery'].forEach(function (kind) {
      var row = el.body.querySelector('[data-lxt="stars-' + kind + '"]');
      for (var i = 1; i <= 5; i++) {
        (function (n) {
          var b = document.createElement('button');
          b.className = 'lxt-star';
          b.textContent = '⭐';
          b.setAttribute('aria-label', n + ' étoile' + (n > 1 ? 's' : ''));
          b.onclick = function () {
            S.stars[kind] = n;
            Array.prototype.forEach.call(row.children, function (c, idx) {
              c.classList.toggle('lit', idx < n);
            });
          };
          row.appendChild(b);
        })(i);
      }
    });

    el.body.querySelector('[data-lxt="skip"]').onclick = function () {
      S.ratingOpen = false;
      closeSheet();
    };

    el.body.querySelector('[data-lxt="send"]').onclick = function () {
      if (!S.stars.global) return say('Choisissez au moins une note globale.');
      var btn = this;
      btn.disabled = true;
      btn.textContent = 'Envoi…';

      fetch(CFG.apiBase + '/api/orders/' + encodeURIComponent(S.orderId) + '/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: S.stars.global,
          foodRating: S.stars.food || undefined,
          deliveryRating: S.stars.delivery || undefined,
          comment: el.body.querySelector('[data-lxt="comment"]').value.trim() || undefined,
        }),
      })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.d.error || 'Envoi impossible');
          S.ratingOpen = false;
          stop();
          el.body.innerHTML = '<div class="lxt-rate"><div style="font-size:44px">🙏</div>'
            + '<div style="font-size:17px;font-weight:600;margin-top:8px">Merci pour votre retour !</div>'
            + '<div class="lxt-sub" style="margin-top:6px">À très bientôt au ' + esc(CFG.cafeName) + '.</div>'
            + '<button class="lxt-btn lxt-gold" style="margin-top:18px" data-lxt="close">Fermer</button></div>';
        })
        .catch(function (e) {
          btn.disabled = false;
          btn.textContent = 'Envoyer mon avis';
          say(e.message);
        });
    };
  }

  /* ── Données ───────────────────────────────────────────── */
  function refresh() {
    if (!S.orderId) return Promise.resolve();
    return fetch(CFG.apiBase + '/api/orders/' + encodeURIComponent(S.orderId) + '/tracking')
      .then(function (r) {
        if (r.status === 404) { stop(); throw new Error('Commande introuvable'); }
        return r.json();
      })
      .then(function (d) {
        S.data = d;
        el.fab.classList.add('on');
        if (el.overlay.classList.contains('on') && !S.ratingOpen) render();

        if (d.step === 'DELIVERED') {
          if (typeof CFG.onDelivered === 'function') CFG.onDelivered(d);
          // On arrête d'interroger : soit l'avis est donné, soit
          // le client l'a repoussé — inutile de sonder indéfiniment.
          if (d.rated) stop();
          else if (!S.ratingOpen) { openSheet(); render(); }
        }
      })
      .catch(function () { /* réseau instable : la prochaine passe réessaiera */ });
  }

  function connectSocket() {
    if (!global.io || S.socket) return;
    try {
      S.socket = global.io(CFG.apiBase, { transports: ['websocket', 'polling'] });
      S.socket.on('connect', function () { S.socket.emit('track:join', S.orderId); });

      S.socket.on('order_updated', function (d) {
        if (!d || d.id !== S.orderId) return;
        S.data = d;
        if (el.overlay.classList.contains('on') && !S.ratingOpen) render();
        if (d.step === 'DELIVERED' && !d.rated && !S.ratingOpen) { openSheet(); render(); }
      });

      // Position seule : on met à jour le marqueur sans tout redessiner,
      // sinon la carte clignoterait toutes les dix secondes.
      S.socket.on('driver_location', function (d) {
        if (!d || d.orderId !== S.orderId || !S.data) return;
        S.data.driver = S.data.driver || {};
        S.data.driver.lat = d.driverLocation.lat;
        S.data.driver.lng = d.driverLocation.lng;
        S.data.driver.fresh = true;
        S.data.driver.updatedAt = d.updatedAt;
        if (S.map && S.driverMarker) {
          S.driverMarker.setLatLng([d.driverLocation.lat, d.driverLocation.lng]);
          if (S.line && S.data.destination) {
            S.line.setLatLngs([[d.driverLocation.lat, d.driverLocation.lng],
                               [S.data.destination.lat, S.data.destination.lng]]);
          }
        } else if (el.overlay.classList.contains('on')) {
          render();
        }
      });
    } catch (e) { /* on reste en interrogation périodique */ }
  }

  function loadSocketIo(cb) {
    if (global.io) return cb();
    var sc = document.createElement('script');
    sc.src = 'https://unpkg.com/socket.io-client@4/dist/socket.io.min.js';
    sc.onload = cb;
    sc.onerror = function () { cb(); };
    document.head.appendChild(sc);
  }

  /* ── API publique ──────────────────────────────────────── */
  function openSheet() { mount(); el.overlay.classList.add('on'); say(''); if (S.data && !S.ratingOpen) render(); }
  function closeSheet() { if (el.overlay) el.overlay.classList.remove('on'); }

  function follow(orderId) {
    if (!orderId) return;
    mount();
    S.orderId = String(orderId);
    S.data = null;
    try { localStorage.setItem(KEY, S.orderId); } catch (e) {}

    refresh();
    if (S.timer) clearInterval(S.timer);
    S.timer = setInterval(refresh, CFG.pollMs);

    loadSocketIo(connectSocket);
  }

  function stop() {
    if (S.timer) { clearInterval(S.timer); S.timer = null; }
    if (S.socket) { try { S.socket.emit('track:leave', S.orderId); S.socket.disconnect(); } catch (e) {} S.socket = null; }
    try { localStorage.removeItem(KEY); } catch (e) {}
    if (el.fab) el.fab.classList.remove('on');
  }

  global.LuxTracking = {
    init: function (options) {
      Object.keys(options || {}).forEach(function (k) { CFG[k] = options[k]; });
      mount();

      // Reprise après fermeture de l'onglet : le client retrouve
      // son suivi sans rien faire.
      if (CFG.autoResume) {
        try {
          var saved = localStorage.getItem(KEY);
          if (saved) follow(saved);
        } catch (e) {}
      }
      return this;
    },
    follow: follow,
    open: openSheet,
    close: closeSheet,
    stop: stop,
    current: function () { return S.data; },
  };
})(window);
