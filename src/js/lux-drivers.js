/* ─────────────────────────────────────────────────────────────
 * lux-drivers.js — « Chauffeurs à proximité »
 *
 * Annuaire des livreurs Café LUX : disponibilité, services,
 * profil vérifié, performance et demande de course.
 *
 * Autonome : injecte son CSS et sa fenêtre. Aucune dépendance.
 *
 *   <script src="../src/js/lux-drivers.js"></script>
 *   <script>LuxDrivers.init({ apiBase: window.LUX_API_URL });</script>
 *   <button onclick="LuxDrivers.open()">Chauffeurs à proximité</button>
 *
 * Ce que le public voit : prénom, statut, véhicule, courses
 * effectuées et note. Jamais le téléphone du livreur — c'est lui
 * qui rappelle après avoir accepté. Cela évite les appels
 * sauvages hors service et protège son numéro personnel.
 * ───────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';

  var CFG = {
    apiBase: '',
    whatsapp: '212677717201',   // numéro du café pour le chat
    cafeName: 'Café LUX',
  };

  var S = { list: [], current: null, tab: 'services', accepted: false };
  var el = {};

  var CSS = [
    '.lxd-ov{position:fixed;inset:0;z-index:9994;display:none;align-items:flex-end;justify-content:center;',
    'background:rgba(6,6,6,.86);backdrop-filter:blur(6px)}',
    '.lxd-ov.on{display:flex}',
    '.lxd-sheet{width:100%;max-width:460px;max-height:92vh;overflow:auto;background:#faf5e9;color:#2b2517;',
    'border-radius:22px 22px 0 0}',
    '@media(min-width:520px){.lxd-ov{align-items:center}.lxd-sheet{border-radius:22px}}',

    '.lxd-hd{background:linear-gradient(160deg,#d6a92b,#c9911f);padding:22px 20px 26px;color:#fff;position:relative}',
    '.lxd-x{position:absolute;top:14px;right:14px;background:rgba(255,255,255,.9);border:0;width:36px;height:36px;',
    'border-radius:50%;font-size:19px;cursor:pointer;color:#2b2517}',
    '.lxd-back{position:absolute;top:14px;left:14px;background:rgba(255,255,255,.9);border:0;width:36px;height:36px;',
    'border-radius:50%;font-size:17px;cursor:pointer;color:#2b2517}',
    '.lxd-ttl{font-size:21px;font-weight:700;margin:0}',
    '.lxd-sub{font-size:12.5px;opacity:.9;margin-top:3px}',

    '.lxd-body{padding:16px 18px 24px}',
    '.lxd-card{display:flex;gap:13px;align-items:center;background:#fffdf7;border:1px solid #ecdfc0;',
    'border-radius:15px;padding:14px;margin-bottom:11px;cursor:pointer;width:100%;text-align:left;font:inherit;color:inherit}',
    '.lxd-card:focus-visible{outline:3px solid #c9911f;outline-offset:2px}',
    '.lxd-av{width:52px;height:52px;flex:none;border-radius:50%;background:#f2e4c4;color:#b8860b;',
    'display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;position:relative}',
    '.lxd-av .st{position:absolute;right:1px;bottom:1px;width:13px;height:13px;border-radius:50%;',
    'border:2.5px solid #fffdf7;background:#8a8578}',
    '.lxd-av .st.on{background:#2eb872}',
    '.lxd-nm{font-size:16.5px;font-weight:700;display:flex;align-items:center;gap:6px}',
    '.lxd-vf{color:#1d74f5;font-size:14px}',
    '.lxd-rl{font-size:12.5px;color:#7d7565;margin-top:2px}',
    '.lxd-mt{display:flex;gap:14px;font-size:12px;color:#7d7565;margin-top:7px}',
    '.lxd-mt b{color:#2b2517}',

    '.lxd-big{text-align:center;padding:4px 0 6px}',
    '.lxd-big .lxd-av{width:92px;height:92px;font-size:38px;margin:0 auto 12px;border:3px solid rgba(255,255,255,.8)}',
    '.lxd-pill{display:inline-flex;align-items:center;gap:5px;padding:6px 14px;border-radius:999px;',
    'background:rgba(255,255,255,.25);font-size:12.5px;margin:0 3px}',

    '.lxd-stats{display:flex;background:#fffdf7;border:1px solid #ecdfc0;border-radius:15px;margin:-18px 0 16px;',
    'position:relative;z-index:1}',
    '.lxd-stat{flex:1;text-align:center;padding:15px 8px}',
    '.lxd-stat+.lxd-stat{border-left:1px solid #ecdfc0}',
    '.lxd-stat .v{font-size:19px;font-weight:700}',
    '.lxd-stat .k{font-size:11.5px;color:#7d7565;margin-top:2px}',

    '.lxd-tabs{display:flex;background:#fffdf7;border:1px solid #ecdfc0;border-radius:13px;padding:4px;margin-bottom:14px}',
    '.lxd-tab{flex:1;padding:11px;border:0;background:none;border-radius:10px;font:inherit;font-size:13.5px;',
    'font-weight:600;color:#7d7565;cursor:pointer;min-height:44px}',
    '.lxd-tab[aria-selected="true"]{background:#d6a92b;color:#fff}',

    '.lxd-box{background:#fffdf7;border:1px solid #ecdfc0;border-radius:15px;padding:15px;margin-bottom:11px}',
    '.lxd-row{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:13.5px}',
    '.lxd-row+.lxd-row{margin-top:11px;padding-top:11px;border-top:1px solid #f0e6d0}',
    '.lxd-price{color:#c9911f;font-weight:700}',
    '.lxd-tag{font-size:11.5px;padding:4px 10px;border-radius:999px;background:#e7f6ee;color:#1c8a52}',
    '.lxd-tag.off{background:#f0ece3;color:#7d7565}',

    '.lxd-terms{display:flex;gap:9px;align-items:flex-start;font-size:12.5px;color:#5a5344;margin:14px 2px}',
    '.lxd-terms input{width:19px;height:19px;margin:0;flex:none;accent-color:#c9911f}',
    '.lxd-terms a{color:#c9911f}',

    '.lxd-acts{display:flex;gap:9px;margin-top:6px}',
    '.lxd-btn{flex:1;padding:14px;border-radius:12px;border:1.5px solid #d6a92b;background:transparent;',
    'color:#b8860b;font:inherit;font-size:14px;font-weight:600;cursor:pointer;min-height:50px}',
    '.lxd-btn.fill{background:#d6a92b;color:#fff;border-color:#d6a92b}',
    '.lxd-btn:disabled{opacity:.45;cursor:not-allowed}',
    '.lxd-in{width:100%;padding:13px;font-size:15px;border:1.5px solid #ecdfc0;border-radius:11px;',
    'background:#fff;margin-bottom:10px;box-sizing:border-box;font:inherit;color:#2b2517}',
    '.lxd-in:focus{outline:2px solid #c9911f;outline-offset:1px}',
    '.lxd-lb{font-size:12px;color:#7d7565;margin-bottom:5px;display:block}',
    '.lxd-msg{padding:12px;border-radius:11px;font-size:13px;margin-bottom:12px;display:none;line-height:1.5}',
    '.lxd-msg.on{display:block}',
    '.lxd-err{background:#fdeceb;color:#a8362c;border:1px solid #f3c8c3}',
    '.lxd-ok{background:#e7f6ee;color:#1c8a52;border:1px solid #b9e2cc}',
    '.lxd-empty{text-align:center;color:#7d7565;font-size:13.5px;padding:36px 14px;line-height:1.7}',
  ].join('');

  function mount() {
    if (el.ov) return;
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    var ov = document.createElement('div');
    ov.className = 'lxd-ov';
    ov.innerHTML = '<div class="lxd-sheet" role="dialog" aria-modal="true" aria-label="Chauffeurs à proximité">'
      + '<div class="lxd-hd" data-lxd="head"></div>'
      + '<div class="lxd-body"><div class="lxd-msg" data-lxd="msg"></div><div data-lxd="body"></div></div>'
      + '</div>';
    document.body.appendChild(ov);

    el.ov = ov;
    el.head = ov.querySelector('[data-lxd="head"]');
    el.body = ov.querySelector('[data-lxd="body"]');
    el.msg = ov.querySelector('[data-lxd="msg"]');

    ov.addEventListener('click', function (e) {
      if (e.target === ov) close();
      if (e.target.closest('[data-lxd="close"]')) close();
      if (e.target.closest('[data-lxd="back"]')) renderList();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && ov.classList.contains('on')) close();
    });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  function say(t, k) {
    el.msg.textContent = t || '';
    el.msg.className = 'lxd-msg' + (t ? ' on ' + (k === 'ok' ? 'lxd-ok' : 'lxd-err') : '');
  }

  /* ── Liste ─────────────────────────────────────────────── */
  function renderList() {
    S.current = null;
    say('');
    el.head.innerHTML = '<button class="lxd-x" data-lxd="close" aria-label="Fermer">&times;</button>'
      + '<h2 class="lxd-ttl">Chauffeurs à proximité</h2>'
      + '<div class="lxd-sub">Les meilleurs prestataires près de vous</div>';

    if (!S.list.length) {
      el.body.innerHTML = '<div class="lxd-empty">Aucun chauffeur enregistré pour le moment.<br>'
        + 'Appelez le café pour une livraison.</div>';
      return;
    }

    el.body.innerHTML = S.list.map(function (d, i) {
      return '<button class="lxd-card" data-i="' + i + '">'
        + '<div class="lxd-av">' + esc(d.initial) + '<span class="st' + (d.online ? ' on' : '') + '"></span></div>'
        + '<div style="flex:1">'
        + '  <div class="lxd-nm">' + esc(d.name)
        +      (d.verified ? ' <span class="lxd-vf" title="Vérifié">✔</span>' : '') + '</div>'
        + '  <div class="lxd-rl">🛵 ' + esc(d.vehicle) + '</div>'
        + '  <div class="lxd-mt">'
        + '    <span>⭐ <b>' + (d.rating != null ? d.rating : 'Nouv.') + '</b></span>'
        + '    <span>📦 <b>' + d.totalOrders + '</b> courses</span>'
        + '    <span>' + (d.online ? '🟢 En ligne' : '⚫ Hors ligne') + '</span>'
        + '  </div>'
        + '</div></button>';
    }).join('');

    Array.prototype.forEach.call(el.body.querySelectorAll('.lxd-card'), function (c) {
      c.onclick = function () { renderProfile(S.list[Number(c.dataset.i)]); };
    });
  }

  /* ── Fiche chauffeur ───────────────────────────────────── */
  function renderProfile(d) {
    S.current = d;
    S.tab = 'services';
    S.accepted = false;
    say('');

    el.head.innerHTML = '<button class="lxd-back" data-lxd="back" aria-label="Retour">‹</button>'
      + '<button class="lxd-x" data-lxd="close" aria-label="Fermer">&times;</button>'
      + '<div class="lxd-big">'
      + '  <div class="lxd-av">' + esc(d.initial) + '</div>'
      + '  <h2 class="lxd-ttl">' + esc(d.name) + '</h2>'
      + '  <div style="margin-top:10px">'
      + '    <span class="lxd-pill">' + (d.online ? '🟢 En ligne' : '🌙 Hors ligne') + '</span>'
      + '    <span class="lxd-pill">' + (d.verified ? '✔ Vérifié' : '⏳ Non vérifié') + '</span>'
      + '  </div>'
      + '</div>';

    el.body.innerHTML =
      '<div class="lxd-stats">'
      + '  <div class="lxd-stat"><div class="v">' + (d.rating != null ? '⭐ ' + d.rating : '—') + '</div>'
      + '    <div class="k">' + d.reviewsCount + ' avis</div></div>'
      + '  <div class="lxd-stat"><div class="v">' + d.totalOrders + '</div><div class="k">courses</div></div>'
      + '</div>'
      + '<div class="lxd-tabs">'
      + '  <button class="lxd-tab" data-tab="services" aria-selected="true">📦 Services</button>'
      + '  <button class="lxd-tab" data-tab="about" aria-selected="false">ℹ️ À propos</button>'
      + '</div>'
      + '<div data-lxd="tabbody"></div>';

    Array.prototype.forEach.call(el.body.querySelectorAll('.lxd-tab'), function (t) {
      t.onclick = function () {
        S.tab = t.dataset.tab;
        Array.prototype.forEach.call(el.body.querySelectorAll('.lxd-tab'), function (x) {
          x.setAttribute('aria-selected', String(x.dataset.tab === S.tab));
        });
        renderTab();
      };
    });
    renderTab();
  }

  function renderTab() {
    var d = S.current;
    var box = el.body.querySelector('[data-lxd="tabbody"]');

    if (S.tab === 'about') {
      box.innerHTML =
        '<div class="lxd-box">'
        + '  <div style="font-weight:700;margin-bottom:11px">👤 Profil du chauffeur</div>'
        + '  <div class="lxd-row"><span>Vérifié</span><b>' + (d.verified ? 'Oui' : 'Non') + '</b></div>'
        + '  <div class="lxd-row"><span>Véhicule</span><b>' + esc(d.vehicle) + '</b></div>'
        + '  <div class="lxd-row"><span>Disponibilité</span><b>' + (d.online ? 'En ligne' : 'Hors ligne') + '</b></div>'
        + '</div>'
        + '<div class="lxd-box">'
        + '  <div style="font-weight:700;margin-bottom:11px">📊 Performance</div>'
        + '  <div class="lxd-row"><span>Commandes totales</span><b>' + d.totalOrders + '</b></div>'
        + '  <div class="lxd-row"><span>Note moyenne</span><b>'
        +      (d.rating != null ? '⭐ ' + d.rating + ' / 5' : 'Pas encore noté') + '</b></div>'
        + '  <div class="lxd-row"><span>Avis</span><b>' + d.reviewsCount + ' avis</b></div>'
        + '</div>'
        + (d.bio ? '<div class="lxd-box">' + esc(d.bio) + '</div>' : '');
      return;
    }

    box.innerHTML =
      '<div class="lxd-box">'
      + '  <div class="lxd-row">'
      + '    <div><div style="font-weight:700;font-size:15px">Delivery</div>'
      + '      <div class="lxd-price">Contacter pour le prix</div></div>'
      + '    <span class="lxd-tag' + (d.online ? '' : ' off') + '">'
      +        (d.online ? '● Disponible' : '● Indisponible') + '</span>'
      + '  </div>'
      + '</div>'
      + '<label class="lxd-terms">'
      + '  <input type="checkbox" data-lxd="terms">'
      + '  <span>J\u2019accepte les <a href="#" onclick="return false">termes et conditions</a> du service de livraison.</span>'
      + '</label>'
      + '<div data-lxd="form" style="display:none">'
      + '  <label class="lxd-lb" for="lxd-phone">Votre téléphone *</label>'
      + '  <input class="lxd-in" id="lxd-phone" type="tel" inputmode="tel" placeholder="06XXXXXXXX">'
      + '  <label class="lxd-lb" for="lxd-addr">Adresse de livraison</label>'
      + '  <input class="lxd-in" id="lxd-addr" placeholder="Quartier, rue, repère…">'
      + '  <label class="lxd-lb" for="lxd-note">Détail de la course</label>'
      + '  <input class="lxd-in" id="lxd-note" placeholder="Ce qu\u2019il faut livrer ou récupérer">'
      + '</div>'
      + '<div class="lxd-acts">'
      + '  <button class="lxd-btn" data-lxd="chat">💬 Chat</button>'
      + '  <button class="lxd-btn fill" data-lxd="ask" disabled>Demander maintenant</button>'
      + '</div>';

    var terms = box.querySelector('[data-lxd="terms"]');
    var ask = box.querySelector('[data-lxd="ask"]');
    var form = box.querySelector('[data-lxd="form"]');

    terms.onchange = function () {
      S.accepted = terms.checked;
      // Le bouton reste inerte tant que les conditions ne sont pas
      // acceptées : c'est la seule trace d'accord qu'on garde.
      ask.disabled = !terms.checked || !d.online;
      form.style.display = terms.checked ? 'block' : 'none';
      if (terms.checked && !d.online) {
        say('Ce chauffeur est hors ligne. Choisissez-en un autre ou appelez le café.', 'err');
      } else {
        say('');
      }
    };

    box.querySelector('[data-lxd="chat"]').onclick = function () {
      var msg = 'Bonjour, je souhaite contacter ' + d.name + ' pour une livraison ('
        + CFG.cafeName + ').';
      global.open('https://wa.me/' + CFG.whatsapp + '?text=' + encodeURIComponent(msg), '_blank');
    };

    ask.onclick = function () {
      var phone = (box.querySelector('#lxd-phone').value || '').trim();
      if (phone.length < 6) return say('Entrez un téléphone valide pour être rappelé.');

      ask.disabled = true;
      ask.textContent = 'Envoi…';

      fetch(CFG.apiBase + '/api/delivery/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: d.id,
          phone: phone,
          address: (box.querySelector('#lxd-addr').value || '').trim() || undefined,
          note: (box.querySelector('#lxd-note').value || '').trim() || undefined,
        }),
      })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.j.error || 'Envoi impossible');
          box.innerHTML = '<div class="lxd-box" style="text-align:center">'
            + '<div style="font-size:40px">✅</div>'
            + '<div style="font-weight:700;margin-top:8px">Demande envoyée</div>'
            + '<div style="font-size:13px;color:#7d7565;margin-top:6px;line-height:1.6">'
            + esc(d.name) + ' est prévenu et vous rappelle sur le ' + esc(phone) + '.</div>'
            + '</div>';
        })
        .catch(function (e) {
          ask.disabled = false;
          ask.textContent = 'Demander maintenant';
          say(e.message);
        });
    };
  }

  /* ── Chargement ────────────────────────────────────────── */
  function load() {
    return fetch(CFG.apiBase + '/api/delivery/drivers')
      .then(function (r) { return r.json(); })
      .then(function (list) { S.list = Array.isArray(list) ? list : []; })
      .catch(function () { S.list = []; });
  }

  function open() {
    mount();
    el.ov.classList.add('on');
    el.body.innerHTML = '<div class="lxd-empty">Chargement…</div>';
    el.head.innerHTML = '<button class="lxd-x" data-lxd="close">&times;</button>'
      + '<h2 class="lxd-ttl">Chauffeurs à proximité</h2>';
    load().then(renderList);
  }

  function close() { if (el.ov) el.ov.classList.remove('on'); }

  global.LuxDrivers = {
    init: function (o) {
      Object.keys(o || {}).forEach(function (k) { CFG[k] = o[k]; });
      mount();
      return this;
    },
    open: open,
    close: close,
  };
})(window);
