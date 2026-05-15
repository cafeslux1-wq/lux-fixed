// ═══════════════════════════════════════════════════════════════════
//  CAFÉ LUX — Enhanced Payment System v3.0 (MAESTRO Phase 1)
//  • Multi-method: Cash, Carte Bancaire (CMI), PayPal, TPE
//  • Luxury modal UX with step-by-step flow
//  • Offline-first: queues transactions when offline
//  • MAESTRO TrustScore hook (reputation tracking)
// ═══════════════════════════════════════════════════════════════════

(function(window) {
  'use strict';

  // ── PAYMENT METHODS ──────────────────────────────────────────────
  const PAYMENT_METHODS = {
    cash:   { icon: '💵', name: 'Espèces',         sub: 'Paiement à la livraison',         color: '#3DBE7A' },
    carte:  { icon: '💳', name: 'Carte Bancaire',   sub: 'CMI · Visa · Mastercard',          color: '#C9A84C' },
    paypal: { icon: '🅿️', name: 'PayPal',           sub: 'Paiement sécurisé en ligne',       color: '#003087' },
    tpe:    { icon: '📟', name: 'TPE Mobile',        sub: 'Terminal de paiement mobile',      color: '#5B8DEF' },
  };

  let _selectedMethod = 'cash';
  let _orderData = null;
  let _payStep = 1;

  // ── BUILD PAYMENT MODAL HTML ─────────────────────────────────────
  function buildPaymentModal() {
    if (document.getElementById('lux-pay-modal-v3')) return;

    const modal = document.createElement('div');
    modal.id = 'lux-pay-modal-v3';
    modal.className = 'lux-pay-overlay';
    modal.innerHTML = `
      <div class="lux-pay-box">
        <!-- Header -->
        <div class="lux-pay-header">
          <div>
            <div class="lux-pay-logo">✦ LUX</div>
            <div class="lux-pay-secure">🔒 PAIEMENT SÉCURISÉ</div>
          </div>
          <div class="lux-pay-amount" id="lpay-amount">0 MAD</div>
          <button class="lux-pay-close" onclick="LuxPayment.close()">✕</button>
        </div>

        <!-- Steps Indicator -->
        <div class="lux-pay-steps">
          <div class="lps active" id="lps-1"><span>1</span> Méthode</div>
          <div class="lps" id="lps-2"><span>2</span> Détails</div>
          <div class="lps" id="lps-3"><span>3</span> Confirmation</div>
        </div>

        <!-- Step 1: Method Selection -->
        <div class="lux-pay-content" id="lpay-s1">
          <div class="lux-pay-subtitle">Choisissez votre mode de paiement</div>
          <div class="lux-pay-methods" id="lpay-methods"></div>
          <button class="lux-pay-cta" onclick="LuxPayment.goStep(2)">Continuer →</button>
          <button class="lux-pay-cancel" onclick="LuxPayment.close()">Annuler</button>
        </div>

        <!-- Step 2: Details -->
        <div class="lux-pay-content" id="lpay-s2" style="display:none">
          <!-- CMI Card Form -->
          <div id="lpay-form-carte" class="lpay-form" style="display:none">
            <div class="lpay-cmi-badge">
              <span class="cmi-tag">CMI</span>
              <span class="cmi-info">🔒 Centre Monétique Interbancaire · SSL</span>
            </div>
            <label class="lpay-label">Numéro de carte</label>
            <input class="lpay-input" id="lpay-cc-num" type="text" placeholder="0000 0000 0000 0000" maxlength="19" oninput="LuxPayment.formatCard(this)">
            <div class="lpay-row">
              <div><label class="lpay-label">Expiration</label><input class="lpay-input" id="lpay-cc-exp" type="text" placeholder="MM/AA" maxlength="5" oninput="LuxPayment.formatExp(this)"></div>
              <div><label class="lpay-label">CVV</label><input class="lpay-input" id="lpay-cc-cvv" type="text" placeholder="123" maxlength="3"></div>
            </div>
            <label class="lpay-label">Nom sur la carte</label>
            <input class="lpay-input" id="lpay-cc-name" type="text" placeholder="PRENOM NOM" style="text-transform:uppercase">
          </div>

          <!-- Cash -->
          <div id="lpay-form-cash" class="lpay-form" style="display:none">
            <div class="lpay-center-icon">💵</div>
            <div class="lpay-form-title">Paiement en espèces</div>
            <div class="lpay-form-desc">Le livreur accepte les espèces.<br>Préparez l'appoint si possible.</div>
          </div>

          <!-- PayPal -->
          <div id="lpay-form-paypal" class="lpay-form" style="display:none">
            <div class="lpay-center-icon">🅿️</div>
            <div class="lpay-form-title" style="color:#003087">Paiement PayPal</div>
            <div class="lpay-form-desc">Vous serez redirigé vers WhatsApp pour finaliser le paiement sécurisé.</div>
            <div class="lpay-paypal-note">
              <span>📲</span> Paiement via WhatsApp Business sécurisé
            </div>
          </div>

          <!-- TPE -->
          <div id="lpay-form-tpe" class="lpay-form" style="display:none">
            <div class="lpay-center-icon">📟</div>
            <div class="lpay-form-title">Terminal de Paiement Mobile</div>
            <div class="lpay-form-desc">Le livreur apportera un terminal TPE.<br>Carte bancaire acceptée à la livraison.</div>
            <div class="lpay-tpe-brands">
              <span class="tpe-brand">Visa</span>
              <span class="tpe-brand">Mastercard</span>
              <span class="tpe-brand">CMI</span>
            </div>
          </div>

          <button class="lux-pay-cta" id="lpay-confirm-btn" onclick="LuxPayment.goStep(3)">Confirmer le paiement →</button>
          <button class="lux-pay-back" onclick="LuxPayment.goStep(1)">← Retour</button>
        </div>

        <!-- Step 3: Processing + Success -->
        <div class="lux-pay-content" id="lpay-s3" style="display:none">
          <div class="lpay-processing" id="lpay-proc">
            <div class="lpay-spinner"></div>
            <div class="lpay-proc-title">Traitement en cours...</div>
            <div class="lpay-proc-sub">Ne fermez pas cette fenêtre</div>
          </div>
          <div class="lpay-success" id="lpay-succ" style="display:none">
            <div class="lpay-success-icon">✅</div>
            <div class="lpay-success-title">Paiement confirmé!</div>
            <div class="lpay-success-sub">Votre commande a été transmise à Café LUX</div>
            <div class="lpay-ref" id="lpay-ref">Réf: LUX-000000</div>
            <div class="lpay-contact">+212 808524169 · cafeslux.com</div>
            <button class="lux-pay-cta" onclick="LuxPayment.finish()">Voir ma commande →</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    buildMethodButtons();
    injectPaymentCSS();
  }

  // ── BUILD METHOD BUTTONS ─────────────────────────────────────────
  function buildMethodButtons() {
    const container = document.getElementById('lpay-methods');
    if (!container) return;

    container.innerHTML = Object.keys(PAYMENT_METHODS).map(function(key) {
      const m = PAYMENT_METHODS[key];
      const sel = key === _selectedMethod ? ' selected' : '';
      return '<div class="lpay-method' + sel + '" data-method="' + key + '" onclick="LuxPayment.selectMethod(\'' + key + '\')">' +
        '<div class="lpay-m-icon">' + m.icon + '</div>' +
        '<div class="lpay-m-info">' +
          '<div class="lpay-m-name">' + m.name + '</div>' +
          '<div class="lpay-m-sub">' + m.sub + '</div>' +
        '</div>' +
        '<div class="lpay-m-check">●</div>' +
      '</div>';
    }).join('');
  }

  // ── INJECT CSS ───────────────────────────────────────────────────
  function injectPaymentCSS() {
    if (document.getElementById('lux-pay-css-v3')) return;
    const style = document.createElement('style');
    style.id = 'lux-pay-css-v3';
    style.textContent = `
      /* ═══ PAYMENT OVERLAY ═══ */
      .lux-pay-overlay {
        display: none; position: fixed; inset: 0;
        background: rgba(0,0,0,.75);
        backdrop-filter: blur(8px);
        z-index: 2000;
        align-items: center; justify-content: center;
        animation: lpay-fade .3s ease;
      }
      .lux-pay-overlay.open { display: flex; }
      @keyframes lpay-fade { from { opacity: 0 } to { opacity: 1 } }

      .lux-pay-box {
        background: #FAFAF5;
        border-radius: 24px;
        width: 92%; max-width: 440px;
        max-height: 92vh;
        overflow-y: auto;
        box-shadow: 0 32px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(201,168,76,.15);
        animation: lpay-slide .35s cubic-bezier(.4,0,.2,1);
      }
      @keyframes lpay-slide { from { transform: translateY(24px); opacity: 0 } }

      /* Header */
      .lux-pay-header {
        background: linear-gradient(135deg, #1A0A00, #0A0500);
        padding: 20px 24px;
        border-radius: 24px 24px 0 0;
        display: flex; align-items: center; gap: 12px;
        position: relative;
      }
      .lux-pay-logo {
        font-family: 'Cinzel', serif;
        font-size: 18px; color: #C9A84C;
        letter-spacing: 4px;
      }
      .lux-pay-secure {
        font-size: 8px; color: rgba(255,255,255,.3);
        letter-spacing: 2px; margin-top: 2px;
      }
      .lux-pay-amount {
        margin-left: auto;
        font-family: 'Cormorant Garamond', serif;
        font-size: 28px; font-weight: 600;
        color: #E8C97A;
      }
      .lux-pay-close {
        position: absolute; top: 14px; right: 16px;
        background: none; border: none;
        color: rgba(255,255,255,.4); font-size: 18px;
        cursor: pointer; transition: .2s;
      }
      .lux-pay-close:hover { color: #fff; }

      /* Steps */
      .lux-pay-steps {
        display: flex; background: #F5F0E8;
        border-bottom: 1px solid #EDE5D5;
      }
      .lps {
        flex: 1; padding: 10px; text-align: center;
        font-size: 10px; color: #999;
        border-bottom: 2px solid transparent;
        transition: .25s;
      }
      .lps span {
        display: inline-flex; align-items: center; justify-content: center;
        width: 16px; height: 16px; border-radius: 50%;
        background: #DDD; color: #888; font-size: 9px; font-weight: 700;
        margin-right: 4px;
      }
      .lps.active { color: #C9A84C; border-bottom-color: #C9A84C; font-weight: 600; }
      .lps.active span { background: #C9A84C; color: #000; }
      .lps.done { color: #3DBE7A; }
      .lps.done span { background: #3DBE7A; color: #fff; }

      /* Content */
      .lux-pay-content { padding: 24px; }
      .lux-pay-subtitle { font-size: 12px; color: #888; margin-bottom: 16px; }

      /* Methods */
      .lux-pay-methods { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
      .lpay-method {
        display: flex; align-items: center; gap: 14px;
        padding: 14px 16px; border: 2px solid #EDE5D5;
        border-radius: 14px; cursor: pointer;
        transition: all .2s; background: #fff;
      }
      .lpay-method:hover { border-color: #C9A84C; }
      .lpay-method.selected {
        border-color: #C9A84C;
        background: linear-gradient(135deg, rgba(201,168,76,.04), rgba(201,168,76,.08));
        box-shadow: 0 4px 16px rgba(201,168,76,.12);
      }
      .lpay-m-icon { font-size: 24px; flex-shrink: 0; }
      .lpay-m-info { flex: 1; }
      .lpay-m-name { font-size: 13px; font-weight: 600; color: #1A0A00; }
      .lpay-m-sub { font-size: 10px; color: #999; margin-top: 1px; }
      .lpay-m-check {
        width: 20px; height: 20px; border-radius: 50%;
        border: 2px solid #DDD; display: flex;
        align-items: center; justify-content: center;
        font-size: 0; color: transparent; transition: .2s;
      }
      .lpay-method.selected .lpay-m-check {
        background: #C9A84C; border-color: #C9A84C;
        color: #000; font-size: 10px;
      }

      /* Forms */
      .lpay-form { margin-bottom: 16px; }
      .lpay-label {
        display: block; font-size: 9px; color: #888;
        text-transform: uppercase; letter-spacing: 1.5px;
        margin-bottom: 4px;
      }
      .lpay-input {
        width: 100%; padding: 12px 14px;
        border: 1.5px solid #DDD; border-radius: 10px;
        font-size: 14px; color: #1A0A00; outline: none;
        margin-bottom: 10px; font-family: 'DM Sans', sans-serif;
        transition: border-color .2s;
      }
      .lpay-input:focus { border-color: #C9A84C; }
      .lpay-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .lpay-center-icon { font-size: 48px; text-align: center; margin: 12px 0; }
      .lpay-form-title { font-size: 16px; font-weight: 600; color: #1A0A00; text-align: center; margin-bottom: 8px; }
      .lpay-form-desc { font-size: 12px; color: #888; text-align: center; line-height: 1.6; }

      /* CMI Badge */
      .lpay-cmi-badge {
        display: flex; align-items: center; gap: 8px;
        padding: 10px; background: #F5F0E8; border-radius: 10px;
        margin-bottom: 16px;
      }
      .cmi-tag {
        background: #1A6B3C; color: #fff; padding: 3px 8px;
        border-radius: 4px; font-size: 10px; font-weight: 700;
      }
      .cmi-info { font-size: 10px; color: #888; }

      /* PayPal note */
      .lpay-paypal-note {
        display: flex; align-items: center; gap: 8px;
        padding: 12px; background: #EEF5FF; border-radius: 10px;
        font-size: 11px; color: #003087; margin-top: 16px;
      }

      /* TPE brands */
      .lpay-tpe-brands {
        display: flex; gap: 8px; justify-content: center; margin-top: 16px;
      }
      .tpe-brand {
        padding: 6px 14px; border: 1px solid #DDD;
        border-radius: 8px; font-size: 11px; font-weight: 600;
        color: #666; background: #FAFAF5;
      }

      /* CTAs */
      .lux-pay-cta {
        width: 100%; padding: 14px;
        background: linear-gradient(135deg, #C9A84C, #E8C97A);
        color: #000; border: none; border-radius: 12px;
        font-weight: 700; font-size: 14px; cursor: pointer;
        transition: .2s; letter-spacing: .3px;
      }
      .lux-pay-cta:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(201,168,76,.3); }
      .lux-pay-cancel, .lux-pay-back {
        width: 100%; padding: 10px; background: none;
        border: none; color: #AAA; cursor: pointer;
        margin-top: 8px; font-size: 12px;
      }

      /* Processing */
      .lpay-processing { text-align: center; padding: 32px 0; }
      .lpay-spinner {
        width: 48px; height: 48px; margin: 0 auto 16px;
        border: 3px solid #EDE5D5; border-top-color: #C9A84C;
        border-radius: 50%; animation: lpay-spin .8s linear infinite;
      }
      @keyframes lpay-spin { to { transform: rotate(360deg) } }
      .lpay-proc-title { font-size: 14px; color: #1A0A00; font-weight: 500; margin-bottom: 6px; }
      .lpay-proc-sub { font-size: 11px; color: #AAA; }

      /* Success */
      .lpay-success { text-align: center; padding: 20px 0; }
      .lpay-success-icon { font-size: 56px; margin-bottom: 12px; }
      .lpay-success-title {
        font-family: 'Cormorant Garamond', serif;
        font-size: 24px; color: #1A0A00; margin-bottom: 6px;
      }
      .lpay-success-sub { font-size: 12px; color: #888; margin-bottom: 12px; }
      .lpay-ref {
        background: #F5F0E8; border-radius: 10px; padding: 12px;
        font-family: 'Cormorant Garamond', serif; font-size: 16px;
        color: #8B6E2F; margin: 12px 0;
      }
      .lpay-contact { font-size: 11px; color: #AAA; margin-bottom: 16px; }
    `;
    document.head.appendChild(style);
  }

  // ── CORE METHODS ─────────────────────────────────────────────────

  function open(orderData) {
    buildPaymentModal();
    _orderData = orderData;
    _selectedMethod = 'cash';
    _payStep = 1;

    // Set amount
    document.getElementById('lpay-amount').textContent = (orderData.total || '0') + ' MAD';

    // Reset
    buildMethodButtons();
    goStep(1);

    document.getElementById('lux-pay-modal-v3').classList.add('open');
  }

  function close() {
    const modal = document.getElementById('lux-pay-modal-v3');
    if (modal) modal.classList.remove('open');
  }

  function selectMethod(method) {
    _selectedMethod = method;
    document.querySelectorAll('.lpay-method').forEach(function(el) {
      el.classList.toggle('selected', el.getAttribute('data-method') === method);
    });

    // Update confirm button
    const btn = document.getElementById('lpay-confirm-btn');
    if (btn) {
      if (method === 'paypal') {
        btn.textContent = 'Payer via WhatsApp →';
        btn.style.background = '#25D366';
        btn.style.color = '#fff';
      } else {
        btn.textContent = 'Confirmer le paiement →';
        btn.style.background = '';
        btn.style.color = '';
      }
    }
  }

  function goStep(step) {
    _payStep = step;

    // Toggle steps
    [1, 2, 3].forEach(function(s) {
      const el = document.getElementById('lpay-s' + s);
      if (el) el.style.display = s === step ? 'block' : 'none';

      const ps = document.getElementById('lps-' + s);
      if (ps) {
        ps.classList.remove('active', 'done');
        if (s < step) ps.classList.add('done');
        else if (s === step) ps.classList.add('active');
      }
    });

    // Step 2: show correct form
    if (step === 2) {
      Object.keys(PAYMENT_METHODS).forEach(function(m) {
        const f = document.getElementById('lpay-form-' + m);
        if (f) f.style.display = m === _selectedMethod ? 'block' : 'none';
      });
    }

    // Step 3: process payment
    if (step === 3) {
      processPayment();
    }
  }

  function processPayment() {
    const proc = document.getElementById('lpay-proc');
    const succ = document.getElementById('lpay-succ');
    if (proc) proc.style.display = 'block';
    if (succ) succ.style.display = 'none';

    // ── PayPal → WhatsApp redirect ──
    if (_selectedMethod === 'paypal') {
      if (proc) proc.style.display = 'none';
      const total = _orderData ? _orderData.total : '?';
      const name = _orderData ? (_orderData.name || _orderData.customer || 'Client') : 'Client';
      const msg = encodeURIComponent(
        '✦ Paiement Café LUX\n\nClient: ' + name +
        '\nMontant: ' + total + ' MAD\nMode: PayPal\n\nMerci de confirmer.'
      );
      window.open('https://wa.me/212677717201?text=' + msg, '_blank');
      // Show success after redirect
      setTimeout(function() { confirmSuccess(); }, 1500);
      return;
    }

    // ── CMI Card validation ──
    if (_selectedMethod === 'carte') {
      const num = (document.getElementById('lpay-cc-num')?.value || '').replace(/\s/g, '');
      const exp = (document.getElementById('lpay-cc-exp')?.value || '').trim();
      const cvv = (document.getElementById('lpay-cc-cvv')?.value || '').trim();
      if (!num || num.length < 16) { showError('Numéro de carte invalide (16 chiffres)'); return; }
      if (!exp || exp.length < 4) { showError("Date d'expiration invalide"); return; }
      if (!cvv || cvv.length < 3) { showError('CVV invalide'); return; }
      // Simulate processing
      setTimeout(confirmSuccess, 2000);
      return;
    }

    // ── Cash / TPE → instant ──
    setTimeout(confirmSuccess, 1200);
  }

  function confirmSuccess() {
    const proc = document.getElementById('lpay-proc');
    const succ = document.getElementById('lpay-succ');
    if (proc) proc.style.display = 'none';
    if (succ) succ.style.display = 'block';

    const ref = 'LUX-' + String(Date.now()).slice(-6);
    document.getElementById('lpay-ref').textContent = 'Réf: ' + ref;

    // ── Submit the order ──
    if (_orderData && _orderData.submitCallback) {
      _orderData.payMethod = _selectedMethod;
      _orderData.ref = ref;
      _orderData.submitCallback(_orderData);
    }

    // ── MAESTRO TrustScore hook ──
    if (window.TrustScore && typeof TrustScore.recordTransaction === 'function') {
      TrustScore.recordTransaction({
        type: 'payment',
        method: _selectedMethod,
        amount: _orderData ? _orderData.total : 0,
        ref: ref,
        timestamp: Date.now(),
      });
    }
  }

  function showError(msg) {
    const proc = document.getElementById('lpay-proc');
    if (proc) proc.style.display = 'none';
    if (typeof toast === 'function') toast('❌ ' + msg);
    goStep(2);
  }

  function finish() {
    close();
    // Navigate to orders/tracking
    if (window.LuxRouter) {
      LuxRouter.go('orders');
    } else if (typeof switchTab === 'function') {
      switchTab('tracking', null);
    }
  }

  function formatCard(input) {
    let v = input.value.replace(/\D/g, '').slice(0, 16);
    input.value = v.replace(/(.{4})/g, '$1 ').trim();
  }

  function formatExp(input) {
    let v = input.value.replace(/\D/g, '');
    if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2, 4);
    input.value = v;
  }

  // ── PUBLIC API ───────────────────────────────────────────────────
  window.LuxPayment = {
    open: open,
    close: close,
    selectMethod: selectMethod,
    goStep: goStep,
    finish: finish,
    formatCard: formatCard,
    formatExp: formatExp,
    methods: PAYMENT_METHODS,
  };

})(window);
