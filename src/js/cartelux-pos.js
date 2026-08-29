/* ─────────────────────────────────────────────────────────────
 * cartelux-pos.js — Carte LUX côté caisse (Sunmi D3 Pro)
 *
 * Autonome : injecte son CSS et sa fenêtre, ne dépend d'aucune
 * librairie. À charger après le script du POS :
 *
 *   <script src="/js/cartelux-pos.js"></script>
 *   <script>
 *     CarteLUX.init({
 *       apiBase: 'https://cafeslux-api.up.railway.app',
 *       getToken: () => localStorage.getItem('token'),
 *       getAmount: () => panier.total,            // montant du ticket en cours
 *       onSuccess: (r) => finaliserCommande(r),   // vider le panier, etc.
 *     });
 *   </script>
 *
 * Trois façons de lire une carte, dans cet ordre de préférence :
 *  1. NFC natif — Web NFC (Chrome Android, HTTPS obligatoire) ;
 *  2. lecteur externe en mode clavier — la plupart des lecteurs USB
 *     et le SDK Sunmi tapent l'UID puis Entrée : on l'attrape ;
 *  3. caméra pour le QR (BarcodeDetector) ou saisie manuelle.
 * ───────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';

  var CFG = {
    apiBase: '',
    getToken: function () { return localStorage.getItem('token') || ''; },
    getAmount: function () { return 0; },
    onSuccess: null,
    onError: null,
    print: null,          // (data) => void — brancher ici l'imprimante Sunmi
    cafeName: 'Café LUX',
    pinThreshold: 200,
  };

  var state = {
    card: null,           // fiche renvoyée par /lookup
    identifier: null,
    type: null,
    mode: 'BALANCE',      // BALANCE | POINTS
    busy: false,
    nfcReader: null,
    videoStream: null,
    scanTimer: null,
    keybuf: '',
    keytime: 0,
  };

  // ── Styles ────────────────────────────────────────────────
  var CSS = [
    '.clx-overlay{position:fixed;inset:0;background:rgba(10,12,16,.78);backdrop-filter:blur(6px);',
    'display:none;align-items:center;justify-content:center;z-index:99999;padding:16px;font-family:inherit}',
    '.clx-overlay.clx-open{display:flex}',
    '.clx-sheet{width:100%;max-width:420px;max-height:92vh;overflow:auto;background:#14171d;color:#f2efe8;',
    'border:1px solid rgba(201,168,106,.35);border-radius:20px;padding:20px;box-shadow:0 24px 60px rgba(0,0,0,.55)}',
    '.clx-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}',
    '.clx-eyebrow{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#c9a86a}',
    '.clx-title{font-size:19px;font-weight:600;margin:2px 0 0}',
    '.clx-x{background:none;border:0;color:#8b9099;font-size:26px;line-height:1;padding:4px 8px;cursor:pointer}',
    '.clx-scan{text-align:center;padding:22px 8px}',
    '.clx-wave{width:88px;height:88px;margin:0 auto 14px;border-radius:50%;border:2px solid rgba(201,168,106,.5);',
    'display:flex;align-items:center;justify-content:center;font-size:34px;animation:clxpulse 1.8s ease-out infinite}',
    '@keyframes clxpulse{0%{box-shadow:0 0 0 0 rgba(201,168,106,.35)}100%{box-shadow:0 0 0 26px rgba(201,168,106,0)}}',
    '@media (prefers-reduced-motion:reduce){.clx-wave{animation:none}}',
    '.clx-hint{color:#9aa0aa;font-size:13px;margin:0 0 16px}',
    '.clx-client{display:flex;align-items:center;gap:12px;padding:12px;background:#1b1f27;border-radius:14px;margin-bottom:12px}',
    '.clx-avatar{width:46px;height:46px;border-radius:50%;background:#c9a86a;color:#14171d;display:flex;align-items:center;',
    'justify-content:center;font-weight:700;font-size:18px;overflow:hidden;flex:none}',
    '.clx-avatar img{width:100%;height:100%;object-fit:cover}',
    '.clx-name{font-size:16px;font-weight:600}',
    '.clx-sub{font-size:12px;color:#8b9099}',
    '.clx-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}',
    '.clx-tile{padding:12px;border-radius:14px;border:1.5px solid #262b34;background:#1b1f27;text-align:left;cursor:pointer;',
    'color:inherit;font:inherit;min-height:76px}',
    '.clx-tile[aria-pressed="true"]{border-color:#c9a86a;background:#20242d}',
    '.clx-tile .k{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8b9099}',
    '.clx-tile .v{font-size:20px;font-weight:700;margin-top:4px}',
    '.clx-tile .u{font-size:11px;color:#8b9099;margin-top:2px}',
    '.clx-field{margin-bottom:14px}',
    '.clx-quick{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}',
    '.clx-chip{flex:1 1 60px;min-width:60px;min-height:44px;padding:10px 8px;border-radius:11px;border:1.5px solid #262b34;',
    'background:#1b1f27;color:#f2efe8;font:inherit;font-weight:600;font-size:15px;cursor:pointer}',
    '.clx-chip:disabled{opacity:.35;cursor:not-allowed}',
    '.clx-chip:focus-visible{outline:3px solid #c9a86a;outline-offset:2px}',
    '.clx-equiv{font-size:12px;color:#c9a86a;margin-top:8px;min-height:16px}',
    '.clx-label{display:block;font-size:12px;color:#9aa0aa;margin-bottom:6px}',
    '.clx-input{width:100%;padding:14px;font-size:20px;font-weight:600;background:#0f1216;color:#f2efe8;',
    'border:1.5px solid #262b34;border-radius:12px;box-sizing:border-box}',
    '.clx-input:focus{outline:2px solid #c9a86a;outline-offset:1px;border-color:#c9a86a}',
    '.clx-actions{display:grid;gap:10px}',
    '.clx-btn{padding:16px;border-radius:14px;border:0;font-size:16px;font-weight:600;cursor:pointer;min-height:56px}',
    '.clx-btn:focus-visible{outline:3px solid #c9a86a;outline-offset:2px}',
    '.clx-primary{background:#c9a86a;color:#14171d}',
    '.clx-primary:disabled{opacity:.5;cursor:not-allowed}',
    '.clx-ghost{background:transparent;color:#9aa0aa;border:1px solid #262b34}',
    '.clx-msg{padding:12px;border-radius:12px;font-size:13px;margin-bottom:12px;display:none}',
    '.clx-msg.clx-show{display:block}',
    '.clx-err{background:rgba(214,84,74,.14);color:#f2a49c;border:1px solid rgba(214,84,74,.35)}',
    '.clx-ok{background:rgba(96,168,120,.14);color:#9ddcb2;border:1px solid rgba(96,168,120,.35)}',
    '.clx-video{width:100%;border-radius:14px;background:#000;margin-bottom:12px;display:none}',
    '.clx-video.clx-show{display:block}',
    '.clx-receipt{background:#1b1f27;border-radius:14px;padding:16px;margin-bottom:14px;font-size:14px}',
    '.clx-line{display:flex;justify-content:space-between;padding:5px 0}',
    '.clx-line.big{font-size:19px;font-weight:700;border-top:1px dashed #333a45;margin-top:8px;padding-top:10px}',
  ].join('');

  // ── Fenêtre ───────────────────────────────────────────────
  var HTML =
    '<div class="clx-sheet" role="dialog" aria-modal="true" aria-labelledby="clx-title">' +
    '  <div class="clx-head">' +
    '    <div><div class="clx-eyebrow">Carte LUX</div><h2 class="clx-title" id="clx-title">Approchez la carte</h2></div>' +
    '    <button class="clx-x" data-clx="close" aria-label="Fermer">&times;</button>' +
    '  </div>' +
    '  <div class="clx-msg" data-clx="msg"></div>' +
    '  <div data-clx="body"></div>' +
    '</div>';

  var el = {};

  function mount() {
    if (el.overlay) return;
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var overlay = document.createElement('div');
    overlay.className = 'clx-overlay';
    overlay.innerHTML = HTML;
    document.body.appendChild(overlay);

    el.overlay = overlay;
    el.body = overlay.querySelector('[data-clx="body"]');
    el.msg = overlay.querySelector('[data-clx="msg"]');
    el.title = overlay.querySelector('.clx-title');

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
      if (e.target.closest('[data-clx="close"]')) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('clx-open')) close();
    });
  }

  function show(msg, kind) {
    el.msg.textContent = msg || '';
    el.msg.className = 'clx-msg' + (msg ? ' clx-show ' + (kind === 'ok' ? 'clx-ok' : 'clx-err') : '');
  }

  function money(n) { return (Math.round((Number(n) || 0) * 100) / 100).toFixed(2) + ' DH'; }
  function initials(name) {
    return String(name || 'C').trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
  }

  // ── Écran 1 : lecture de la carte ─────────────────────────
  function renderScan() {
    el.title.textContent = 'Approchez la carte';
    el.body.innerHTML =
      '<div class="clx-scan">' +
      '  <div class="clx-wave">💳</div>' +
      '  <p class="clx-hint" data-clx="hint">Posez la carte sur le lecteur, ou scannez le QR du client.</p>' +
      '</div>' +
      '<video class="clx-video" data-clx="video" playsinline muted></video>' +
      '<div class="clx-field">' +
      '  <label class="clx-label" for="clx-manual">Saisie manuelle (UID ou code LUXQ)</label>' +
      '  <input class="clx-input" id="clx-manual" data-clx="manual" autocomplete="off" placeholder="LUXQ-…">' +
      '</div>' +
      '<div class="clx-actions">' +
      '  <button class="clx-btn clx-primary" data-clx="submit-manual">Rechercher le client</button>' +
      '  <button class="clx-btn clx-ghost" data-clx="camera">Scanner le QR avec la caméra</button>' +
      '</div>';

    var input = el.body.querySelector('[data-clx="manual"]');
    el.body.querySelector('[data-clx="submit-manual"]').onclick = function () {
      var v = input.value.trim();
      if (!v) return show('Entrez un identifiant ou approchez la carte.');
      lookup(v, null);
    };
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); el.body.querySelector('[data-clx="submit-manual"]').click(); }
    });
    el.body.querySelector('[data-clx="camera"]').onclick = startCamera;

    startNfc();
  }

  // ── Écran 2 : fiche client + montant ──────────────────────
  function renderCard() {
    var c = state.card;
    el.title.textContent = 'Client identifié';

    var suggested = Number(CFG.getAmount() || 0);
    var pointsForAmount = suggested > 0 ? Math.ceil(suggested / (c.pointValueDH || 0.1)) : 0;

    el.body.innerHTML =
      '<div class="clx-client">' +
      '  <div class="clx-avatar">' +
      (c.customer.avatarUrl ? '<img src="' + c.customer.avatarUrl + '" alt="">' : initials(c.customer.name)) +
      '  </div>' +
      '  <div>' +
      '    <div class="clx-name">' + escapeHtml(c.customer.name) + '</div>' +
      '    <div class="clx-sub">' + escapeHtml(c.customer.phone || c.cardNumber || 'Carte LUX') + '</div>' +
      '  </div>' +
      '</div>' +
      '<div class="clx-grid">' +
      '  <button class="clx-tile" data-clx="mode-balance" aria-pressed="true">' +
      '    <div class="k">Solde</div><div class="v">' + money(c.walletBalance) + '</div><div class="u">Payer en dirhams</div>' +
      '  </button>' +
      '  <button class="clx-tile" data-clx="mode-points" aria-pressed="false">' +
      '    <div class="k">Points</div><div class="v">' + c.pointsAvailable + '</div><div class="u">≈ ' + money(c.pointsValueDH) + '</div>' +
      '  </button>' +
      '</div>' +
      '<div class="clx-field">' +
      '  <label class="clx-label" for="clx-amount" data-clx="amount-label">Montant à débiter (DH)</label>' +
      '  <input class="clx-input" id="clx-amount" data-clx="amount" type="number" inputmode="decimal" min="0" step="0.5" value="' +
      (suggested > 0 ? suggested : '') + '">' +
      '  <div class="clx-quick" data-clx="quick" style="display:none"></div>' +
      '  <div class="clx-equiv" data-clx="equiv"></div>' +
      '</div>' +
      '<div class="clx-field" data-clx="pin-field" style="display:none">' +
      '  <label class="clx-label" for="clx-pin">Code PIN de la carte</label>' +
      '  <input class="clx-input" id="clx-pin" data-clx="pin" type="password" inputmode="numeric" autocomplete="off">' +
      '</div>' +
      '<div class="clx-actions">' +
      '  <button class="clx-btn clx-primary" data-clx="confirm">Confirmer le paiement</button>' +
      '  <button class="clx-btn clx-ghost" data-clx="back">Lire une autre carte</button>' +
      '</div>';

    var amountInput = el.body.querySelector('[data-clx="amount"]');
    var amountLabel = el.body.querySelector('[data-clx="amount-label"]');
    var quickRow = el.body.querySelector('[data-clx="quick"]');
    var equiv = el.body.querySelector('[data-clx="equiv"]');
    var tileBalance = el.body.querySelector('[data-clx="mode-balance"]');
    var tilePoints = el.body.querySelector('[data-clx="mode-points"]');
    var pinField = el.body.querySelector('[data-clx="pin-field"]');

    // Raccourcis du coup de feu : le caissier tape rarement un nombre,
    // il appuie sur 50 ou 100. « Tout » prend le solde de points entier.
    var PRESETS = [50, 100, 200];

    function buildQuick() {
      quickRow.innerHTML = '';
      PRESETS.forEach(function (n) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'clx-chip';
        b.textContent = n;
        b.disabled = n > c.pointsAvailable;
        b.onclick = function () { amountInput.value = n; refresh(); };
        quickRow.appendChild(b);
      });
      if (c.pointsAvailable > 0) {
        var all = document.createElement('button');
        all.type = 'button';
        all.className = 'clx-chip';
        all.textContent = 'Tout (' + c.pointsAvailable + ')';
        all.style.flexBasis = '100%';
        all.onclick = function () { amountInput.value = c.pointsAvailable; refresh(); };
        quickRow.appendChild(all);
      }
    }

    function setMode(mode) {
      state.mode = mode;
      tileBalance.setAttribute('aria-pressed', String(mode === 'BALANCE'));
      tilePoints.setAttribute('aria-pressed', String(mode === 'POINTS'));

      if (mode === 'BALANCE') {
        // Dirhams : on pré-remplit avec le total du ticket.
        amountLabel.textContent = 'Montant à débiter (DH)';
        amountInput.step = '0.5';
        amountInput.value = suggested > 0 ? suggested : '';
        quickRow.style.display = 'none';
      } else {
        // Points : on saisit un NOMBRE DE POINTS, jamais une conversion.
        // Le champ reste vide pour que personne ne valide un chiffre
        // qu'il n'a pas choisi.
        amountLabel.textContent = 'Nombre de points à retirer';
        amountInput.step = '1';
        amountInput.value = '';
        quickRow.style.display = 'flex';
        buildQuick();
      }
      refresh();
    }

    function refresh() {
      var v = Number(amountInput.value) || 0;

      if (state.mode === 'POINTS') {
        // Équivalence indicative, pour le client qui demande
        // « ça fait combien ? ». Le serveur recalcule de son côté.
        equiv.textContent = v > 0
          ? v + ' points ≈ ' + money(v * (c.pointValueDH || 0.1)) + ' de réduction'
          : (suggested > 0 ? 'Ticket en cours : ' + money(suggested) + ' (≈ ' + pointsForAmount + ' points)' : '');
      } else {
        equiv.textContent = v > 0 ? 'Reste après paiement : ' + money(c.walletBalance - v) : '';
      }

      if (!c.requiresPin) return;
      var dh = state.mode === 'BALANCE' ? v : v * (c.pointValueDH || 0.1);
      pinField.style.display = dh >= CFG.pinThreshold ? 'block' : 'none';
    }

    tileBalance.onclick = function () { setMode('BALANCE'); };
    tilePoints.onclick = function () { setMode('POINTS'); };
    amountInput.addEventListener('input', refresh);
    el.body.querySelector('[data-clx="back"]').onclick = function () { state.card = null; show(''); renderScan(); };
    el.body.querySelector('[data-clx="confirm"]').onclick = function () {
      var value = Number(amountInput.value);
      if (state.mode === 'POINTS') value = Math.trunc(value); // un point est entier
      if (!(value > 0)) {
        return show(state.mode === 'POINTS'
          ? 'Entrez un nombre de points supérieur à zéro.'
          : 'Entrez un montant supérieur à zéro.');
      }
      if (state.mode === 'BALANCE' && value > c.walletBalance) {
        return show('Solde insuffisant : ' + money(c.walletBalance) + ' disponibles.');
      }
      if (state.mode === 'POINTS' && value > c.pointsAvailable) {
        return show('Points insuffisants : ' + c.pointsAvailable + ' disponibles.');
      }
      var pin = pinField.style.display !== 'none' ? el.body.querySelector('[data-clx="pin"]').value.trim() : null;
      process(value, pin, this);
    };

    setMode('BALANCE');
  }

  // ── Écran 3 : ticket ──────────────────────────────────────
  function renderReceipt(r) {
    el.title.textContent = 'Paiement accepté';
    var isPoints = r.deductionType === 'POINTS';

    el.body.innerHTML =
      '<div class="clx-receipt">' +
      '  <div class="clx-line"><span>Client</span><strong>' + escapeHtml(r.customer.name) + '</strong></div>' +
      '  <div class="clx-line"><span>Mode</span><strong>' + (isPoints ? 'Points fidélité' : 'Solde LUX') + '</strong></div>' +
      (isPoints
        ? '  <div class="clx-line"><span>Points utilisés</span><strong>' + r.pointsDeducted + '</strong></div>'
        : '') +
      '  <div class="clx-line"><span>Nouveau solde</span><strong>' + money(r.walletBalance) + '</strong></div>' +
      '  <div class="clx-line"><span>Points restants</span><strong>' + r.pointsAvailable + '</strong></div>' +
      '  <div class="clx-line big"><span>' + (isPoints ? 'Valeur de la remise' : 'Débité') + '</span><span>' +
      money(r.valueDH) + '</span></div>' +
      '</div>' +
      '<div class="clx-actions">' +
      '  <button class="clx-btn clx-primary" data-clx="print">Imprimer le ticket</button>' +
      '  <button class="clx-btn clx-ghost" data-clx="close">Terminer</button>' +
      '</div>';

    el.body.querySelector('[data-clx="print"]').onclick = function () { printReceipt(r); };
  }

  // ── Réseau ────────────────────────────────────────────────
  function api(path, options) {
    var opts = options || {};
    return fetch(CFG.apiBase + path, {
      method: opts.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + CFG.getToken(),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var e = new Error(data.error || 'Erreur réseau');
          e.code = data.code;
          throw e;
        }
        return data;
      });
    });
  }

  function lookup(identifier, type) {
    if (state.busy) return;
    state.busy = true;
    show('');
    stopCamera();

    var kind = type || (/LUXQ/i.test(identifier) ? 'QR' : /^[0-9A-Fa-f:\-\s]{6,32}$/.test(identifier) ? 'NFC' : 'QR');
    var url = '/api/carte-lux/lookup?identifier=' + encodeURIComponent(identifier) + '&type=' + kind;

    api(url)
      .then(function (card) {
        state.card = card;
        state.identifier = identifier;
        state.type = kind;
        renderCard();
      })
      .catch(function (err) {
        show(err.message || 'Carte introuvable');
        if (typeof CFG.onError === 'function') CFG.onError(err);
      })
      .then(function () { state.busy = false; });
  }

  function process(value, pin, button) {
    if (state.busy) return;
    state.busy = true;
    if (button) { button.disabled = true; button.textContent = 'Traitement…'; }
    show('');

    api('/api/carte-lux/process', {
      method: 'POST',
      body: {
        identifier: state.identifier,
        type: state.type,
        amountToDeduce: value,
        deductionType: state.mode,
        unit: state.mode === 'POINTS' ? 'POINTS' : 'DH',
        pin: pin || undefined,
        // Clé d'idempotence : si le réseau coupe et que la caisse
        // renvoie, le serveur ne débite pas deux fois.
        reference: 'clx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        label: CFG.cafeName + ' — caisse',
      },
    })
      .then(function (r) {
        renderReceipt(r);
        show(r.duplicate ? 'Opération déjà enregistrée.' : 'Paiement enregistré.', 'ok');
        if (typeof CFG.onSuccess === 'function') CFG.onSuccess(r);
      })
      .catch(function (err) {
        show(err.message || 'Paiement refusé');
        if (button) { button.disabled = false; button.textContent = 'Confirmer le paiement'; }
        if (typeof CFG.onError === 'function') CFG.onError(err);
      })
      .then(function () { state.busy = false; });
  }

  // ── Lecture NFC (Web NFC, Chrome Android en HTTPS) ────────
  function startNfc() {
    var hint = el.body.querySelector('[data-clx="hint"]');
    if (!('NDEFReader' in global)) {
      if (hint) hint.textContent = 'Lecteur NFC externe, QR ou saisie manuelle. (NFC intégré non disponible sur ce navigateur.)';
      return;
    }
    try {
      var reader = new global.NDEFReader();
      state.nfcReader = reader;
      reader.scan().then(function () {
        if (hint) hint.textContent = 'Lecteur NFC actif. Posez la carte sur le dos du terminal.';
      }).catch(function () {
        if (hint) hint.textContent = 'NFC refusé par le terminal. Utilisez le QR ou la saisie manuelle.';
      });
      reader.onreading = function (event) {
        // serialNumber = UID de la puce ("04:a2:b3:…").
        var uid = event.serialNumber || '';
        // Une carte encodée par nos soins peut aussi porter le jeton en NDEF.
        if (!uid && event.message) {
          for (var i = 0; i < event.message.records.length; i++) {
            var rec = event.message.records[i];
            if (rec.recordType === 'text') {
              uid = new TextDecoder().decode(rec.data);
              break;
            }
          }
        }
        if (uid) lookup(uid, /LUXQ/i.test(uid) ? 'QR' : 'NFC');
      };
    } catch (e) {
      if (hint) hint.textContent = 'NFC indisponible. Utilisez le QR ou la saisie manuelle.';
    }
  }

  // ── Lecteur externe en mode clavier ───────────────────────
  // Les lecteurs USB/Sunmi tapent l'identifiant très vite puis Entrée.
  // On ne capture que si aucun champ n'a le focus.
  function keyboardWedge(e) {
    var tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    var now = Date.now();
    if (now - state.keytime > 120) state.keybuf = '';
    state.keytime = now;

    if (e.key === 'Enter') {
      var code = state.keybuf.trim();
      state.keybuf = '';
      if (code.length >= 6) {
        open();
        lookup(code, null);
      }
      return;
    }
    if (e.key.length === 1) state.keybuf += e.key;
  }

  // ── Caméra + QR ───────────────────────────────────────────
  function startCamera() {
    var video = el.body.querySelector('[data-clx="video"]');
    if (!video) return;

    if (!('BarcodeDetector' in global)) {
      return show('Ce terminal ne sait pas décoder le QR par caméra. Utilisez le lecteur ou la saisie manuelle.');
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(function (stream) {
        state.videoStream = stream;
        video.srcObject = stream;
        video.classList.add('clx-show');
        video.play();

        var detector = new global.BarcodeDetector({ formats: ['qr_code'] });
        state.scanTimer = setInterval(function () {
          detector.detect(video).then(function (codes) {
            if (codes && codes.length) {
              var value = codes[0].rawValue;
              stopCamera();
              lookup(value, 'QR');
            }
          }).catch(function () { /* image non exploitable, on réessaie */ });
        }, 400);
      })
      .catch(function () { show('Caméra inaccessible. Autorisez l\u2019accès ou saisissez le code.'); });
  }

  function stopCamera() {
    if (state.scanTimer) { clearInterval(state.scanTimer); state.scanTimer = null; }
    if (state.videoStream) {
      state.videoStream.getTracks().forEach(function (t) { t.stop(); });
      state.videoStream = null;
    }
    var video = el.overlay && el.overlay.querySelector('[data-clx="video"]');
    if (video) video.classList.remove('clx-show');
  }

  // ── Ticket ────────────────────────────────────────────────
  function printReceipt(r) {
    // Imprimante intégrée Sunmi : si l'application Android expose un
    // pont (window.SunmiPrinter / AndroidPrinter), on l'utilise.
    if (typeof CFG.print === 'function') return CFG.print(r);
    var bridge = global.SunmiPrinter || global.AndroidPrinter;
    if (bridge && typeof bridge.printText === 'function') {
      bridge.printText(
        CFG.cafeName + '\n' +
        'Carte LUX\n' +
        'Client : ' + r.customer.name + '\n' +
        (r.deductionType === 'POINTS' ? 'Points utilises : ' + r.pointsDeducted + '\n' : '') +
        'Debite : ' + money(r.valueDH) + '\n' +
        'Nouveau solde : ' + money(r.walletBalance) + '\n' +
        'Points restants : ' + r.pointsAvailable + '\n' +
        new Date(r.createdAt || Date.now()).toLocaleString('fr-FR') + '\n\n',
      );
      return;
    }

    var w = global.open('', '_blank', 'width=320,height=520');
    if (!w) return show('Autorisez les fenêtres pour imprimer, ou branchez l\u2019imprimante Sunmi.');
    w.document.write(
      '<html><head><title>Ticket Carte LUX</title><style>' +
      'body{font-family:monospace;font-size:13px;padding:10px;width:280px}' +
      'h3{text-align:center;margin:0 0 10px}hr{border:0;border-top:1px dashed #999}' +
      'div{display:flex;justify-content:space-between;padding:3px 0}' +
      '</style></head><body>' +
      '<h3>' + CFG.cafeName + '</h3><hr>' +
      '<div><span>Client</span><span>' + escapeHtml(r.customer.name) + '</span></div>' +
      '<div><span>Mode</span><span>' + (r.deductionType === 'POINTS' ? 'Points' : 'Solde') + '</span></div>' +
      (r.deductionType === 'POINTS' ? '<div><span>Points</span><span>-' + r.pointsDeducted + '</span></div>' : '') +
      '<div><span>Debite</span><span>' + money(r.valueDH) + '</span></div>' +
      '<hr>' +
      '<div><span>Solde</span><span>' + money(r.walletBalance) + '</span></div>' +
      '<div><span>Points</span><span>' + r.pointsAvailable + '</span></div>' +
      '<div><span>Ticket</span><span>' + String(r.transactionId).slice(-8).toUpperCase() + '</span></div>' +
      '<div><span>Date</span><span>' + new Date(r.createdAt || Date.now()).toLocaleString('fr-FR') + '</span></div>' +
      '</body></html>',
    );
    w.document.close();
    w.focus();
    w.print();
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  // ── API publique ──────────────────────────────────────────
  function open() {
    mount();
    el.overlay.classList.add('clx-open');
    if (!state.card) renderScan();
  }

  function close() {
    stopCamera();
    if (state.nfcReader) state.nfcReader.onreading = null;
    state.card = null;
    state.identifier = null;
    state.busy = false;
    if (el.overlay) el.overlay.classList.remove('clx-open');
  }

  global.CarteLUX = {
    init: function (options) {
      Object.keys(options || {}).forEach(function (k) { CFG[k] = options[k]; });
      mount();
      document.addEventListener('keydown', keyboardWedge);
      return this;
    },
    open: open,
    close: close,
    // Pour brancher un bouton « Carte LUX » du POS :
    //   <button onclick="CarteLUX.open()">Carte LUX</button>
    lookup: function (identifier, type) { open(); lookup(identifier, type || null); },
  };
})(window);
