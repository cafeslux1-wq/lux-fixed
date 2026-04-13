(function(window) {
  "use strict";

  if (typeof document === "undefined") return;

  var METHODS = {
    cash: {
      label: "Cash",
      caption: "Immediate cash settlement"
    },
    carte: {
      label: "Card / CMI",
      caption: "Secure card payment"
    },
    giftcard: {
      label: "Gift Card",
      caption: "Redeem a gift balance"
    }
  };

  var state = {
    order: null,
    method: "cash",
    step: 1,
    lastResult: null
  };

  function id(value) {
    return document.getElementById(value);
  }

  function fmtAmount() {
    if (!state.order) return "0 MAD";
    if (state.order.amountLabel) return state.order.amountLabel;
    var total = Number(state.order.total || 0);
    var currency = state.order.currency || "MAD";
    return total.toFixed(2) + " " + currency;
  }

  function visibleMethods() {
    var requested = state.order && Array.isArray(state.order.methods) && state.order.methods.length
      ? state.order.methods
      : Object.keys(METHODS);
    return requested.filter(function(key) {
      return !!METHODS[key];
    });
  }

  function build() {
    if (id("lux-pay-overlay")) return;

    var overlay = document.createElement("div");
    overlay.id = "lux-pay-overlay";
    overlay.className = "lux-pay-overlay";
    overlay.innerHTML = ''
      + '<div class="lux-pay-card" role="dialog" aria-modal="true" aria-labelledby="lux-pay-title">'
      + '  <div class="lux-pay-head">'
      + '    <div>'
      + '      <div class="lux-pay-logo">\u2726 LUX</div>'
      + '      <div class="lux-pay-kicker">SECURED MAESTRO PAYMENT</div>'
      + '    </div>'
      + '    <div class="lux-pay-amount" id="lux-pay-amount">0 MAD</div>'
      + '    <button class="lux-pay-close" id="lux-pay-close" type="button" aria-label="Close">\u00d7</button>'
      + '  </div>'
      + '  <div class="lux-pay-steps">'
      + '    <div class="lux-pay-step is-active" data-step="1"><span>1</span> Method</div>'
      + '    <div class="lux-pay-step" data-step="2"><span>2</span> Details</div>'
      + '    <div class="lux-pay-step" data-step="3"><span>3</span> Confirmation</div>'
      + '  </div>'
      + '  <div class="lux-pay-body">'
      + '    <section class="lux-pay-panel" data-panel="1">'
      + '      <h3 class="lux-pay-title" id="lux-pay-title">Choose a payment method</h3>'
      + '      <div class="lux-pay-methods" id="lux-pay-methods"></div>'
      + '      <div class="lux-pay-actions">'
      + '        <button class="lux-pay-primary" id="lux-pay-next" type="button">Continuer</button>'
      + '        <button class="lux-pay-secondary" id="lux-pay-cancel" type="button">Cancel</button>'
      + '      </div>'
      + '    </section>'
      + '    <section class="lux-pay-panel" data-panel="2" hidden>'
      + '      <h3 class="lux-pay-title" id="lux-pay-detail-title">Payment details</h3>'
      + '      <div id="lux-pay-detail-body"></div>'
      + '      <div class="lux-pay-message" id="lux-pay-message"></div>'
      + '      <div class="lux-pay-actions">'
      + '        <button class="lux-pay-secondary" id="lux-pay-back" type="button">Back</button>'
      + '        <button class="lux-pay-primary" id="lux-pay-submit" type="button">Continuer</button>'
      + '      </div>'
      + '    </section>'
      + '    <section class="lux-pay-panel" data-panel="3" hidden>'
      + '      <div class="lux-pay-success" id="lux-pay-success">'
      + '        <div class="lux-pay-success-icon">\u2713</div>'
      + '        <div class="lux-pay-success-title">Payment confirmed</div>'
      + '        <div class="lux-pay-success-copy" id="lux-pay-success-copy">The order has been completed.</div>'
      + '        <div class="lux-pay-ref" id="lux-pay-ref">MAE-000000</div>'
      + '        <button class="lux-pay-primary" id="lux-pay-finish" type="button">Close</button>'
      + '      </div>'
      + '    </section>'
      + '  </div>'
      + '</div>';

    document.body.appendChild(overlay);
    injectCss();

    id("lux-pay-close").addEventListener("click", close);
    id("lux-pay-cancel").addEventListener("click", close);
    id("lux-pay-next").addEventListener("click", function() { setStep(2); });
    id("lux-pay-back").addEventListener("click", function() { setStep(1); });
    id("lux-pay-submit").addEventListener("click", submit);
    id("lux-pay-finish").addEventListener("click", finish);
    overlay.addEventListener("click", function(event) {
      if (event.target === overlay) close();
    });
  }

  function injectCss() {
    if (id("lux-pay-css")) return;
    var style = document.createElement("style");
    style.id = "lux-pay-css";
    style.textContent = ''
      + '.lux-pay-overlay{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(5,6,10,.72);backdrop-filter:blur(8px);z-index:2200;padding:18px;}'
      + '.lux-pay-overlay.open{display:flex;}'
      + '.lux-pay-card{width:min(100%,460px);background:#f7f3ea;color:#161616;border-radius:28px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.45);}'
      + '.lux-pay-head{display:flex;align-items:flex-start;gap:12px;padding:20px 22px;background:linear-gradient(135deg,#140d03,#241605 60%,#34240d);color:#f4e7c3;position:relative;}'
      + '.lux-pay-logo{font:700 28px/1 Georgia,serif;letter-spacing:.14em;color:#e4c264;}'
      + '.lux-pay-kicker{font-size:10px;letter-spacing:.18em;color:rgba(255,255,255,.56);margin-top:6px;text-transform:uppercase;}'
      + '.lux-pay-amount{margin-left:auto;font:700 32px/1.1 Georgia,serif;color:#f2d478;padding-right:30px;}'
      + '.lux-pay-close{position:absolute;top:14px;right:16px;border:none;background:none;color:rgba(255,255,255,.55);font-size:28px;cursor:pointer;}'
      + '.lux-pay-steps{display:grid;grid-template-columns:repeat(3,1fr);background:#f0e6d6;border-bottom:1px solid rgba(0,0,0,.08);}'
      + '.lux-pay-step{padding:12px 10px;font-size:11px;text-align:center;color:#8d8677;border-bottom:2px solid transparent;}'
      + '.lux-pay-step span{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:999px;background:#ddd1ba;color:#5d5340;font-weight:700;margin-right:6px;}'
      + '.lux-pay-step.is-active{color:#3a2b12;border-bottom-color:#c9a84c;}'
      + '.lux-pay-step.is-active span{background:#c9a84c;color:#111;}'
      + '.lux-pay-body{padding:22px;}'
      + '.lux-pay-title{font-size:16px;margin:0 0 16px;color:#171717;}'
      + '.lux-pay-methods{display:grid;gap:12px;}'
      + '.lux-pay-method{border:1px solid rgba(0,0,0,.1);border-radius:18px;padding:14px 16px;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease;}'
      + '.lux-pay-method:hover{transform:translateY(-1px);border-color:rgba(201,168,76,.55);box-shadow:0 10px 22px rgba(0,0,0,.08);}'
      + '.lux-pay-method.is-active{border-color:#c9a84c;background:rgba(201,168,76,.12);}'
      + '.lux-pay-method-copy strong{display:block;font-size:14px;color:#181818;}'
      + '.lux-pay-method-copy span{display:block;margin-top:4px;font-size:12px;color:#6f675c;}'
      + '.lux-pay-check{width:22px;height:22px;border-radius:999px;border:1px solid rgba(0,0,0,.12);display:flex;align-items:center;justify-content:center;font-size:12px;color:transparent;background:#fff;}'
      + '.lux-pay-method.is-active .lux-pay-check{background:#16110a;border-color:#16110a;color:#e8c96d;}'
      + '.lux-pay-actions{display:flex;gap:10px;margin-top:18px;}'
      + '.lux-pay-primary,.lux-pay-secondary{flex:1;border-radius:16px;padding:14px 16px;font:600 14px/1.1 system-ui,sans-serif;cursor:pointer;transition:transform .16s ease,opacity .16s ease;}'
      + '.lux-pay-primary{border:1px solid #0f1116;background:linear-gradient(135deg,#c9a84c,#efd98c);color:#111;}'
      + '.lux-pay-primary:hover{transform:translateY(-1px);}'
      + '.lux-pay-secondary{border:1px solid rgba(0,0,0,.12);background:#fff;color:#404040;}'
      + '.lux-pay-detail-box{border:1px solid rgba(0,0,0,.08);border-radius:18px;padding:16px;background:#fff;}'
      + '.lux-pay-detail-box h4{margin:0 0 8px;font-size:14px;color:#1d1d1d;}'
      + '.lux-pay-detail-box p{margin:0;color:#6c6458;font-size:12px;line-height:1.6;}'
      + '.lux-pay-field{display:flex;flex-direction:column;gap:8px;margin-top:14px;}'
      + '.lux-pay-field label{font-size:12px;color:#574e43;font-weight:600;}'
      + '.lux-pay-field input{border:1px solid rgba(0,0,0,.12);border-radius:14px;padding:13px 14px;font-size:14px;background:#fff;color:#191919;}'
      + '.lux-pay-hint{font-size:11px;color:#7a7165;margin-top:8px;}'
      + '.lux-pay-message{min-height:18px;margin-top:12px;font-size:12px;color:#b44747;}'
      + '.lux-pay-success{text-align:center;padding:12px 6px 2px;}'
      + '.lux-pay-success-icon{width:68px;height:68px;border-radius:999px;margin:0 auto 14px;background:rgba(61,190,122,.15);display:flex;align-items:center;justify-content:center;color:#1b9b5a;font-size:30px;font-weight:700;}'
      + '.lux-pay-success-title{font-size:21px;font-weight:700;color:#171717;}'
      + '.lux-pay-success-copy{margin-top:8px;color:#6c6458;line-height:1.6;font-size:13px;}'
      + '.lux-pay-ref{margin:16px auto 0;padding:10px 14px;border-radius:999px;background:#111;color:#ecd584;display:inline-flex;font:700 12px/1.2 ui-monospace,Consolas,monospace;letter-spacing:.08em;}'
      + '@media (max-width:560px){.lux-pay-card{border-radius:24px;}.lux-pay-body{padding:18px;}.lux-pay-head{padding:18px 18px 20px;}.lux-pay-amount{font-size:28px;}.lux-pay-actions{flex-direction:column;}}';
    document.head.appendChild(style);
  }

  function setStep(next) {
    state.step = next;
    Array.prototype.forEach.call(document.querySelectorAll(".lux-pay-step"), function(node) {
      var active = Number(node.getAttribute("data-step")) === next;
      node.classList.toggle("is-active", active);
    });
    Array.prototype.forEach.call(document.querySelectorAll(".lux-pay-panel"), function(node) {
      node.hidden = Number(node.getAttribute("data-panel")) !== next;
    });
    renderDetails();
  }

  function renderMethods() {
    var host = id("lux-pay-methods");
    if (!host) return;
    host.innerHTML = visibleMethods().map(function(key) {
      var method = METHODS[key];
      return ''
        + '<button class="lux-pay-method' + (key === state.method ? ' is-active' : '') + '" type="button" data-method="' + key + '">'
        + '  <div class="lux-pay-method-copy"><strong>' + method.label + '</strong><span>' + method.caption + '</span></div>'
        + '  <div class="lux-pay-check">\u2713</div>'
        + '</button>';
    }).join("");
    Array.prototype.forEach.call(host.querySelectorAll("[data-method]"), function(button) {
      button.addEventListener("click", function() {
        state.method = this.getAttribute("data-method");
        renderMethods();
        renderDetails();
      });
    });
  }

  function renderDetails() {
    var detailHost = id("lux-pay-detail-body");
    if (!detailHost) return;

    if (state.step === 1) {
      renderMethods();
      return;
    }

    var html = "";
    if (state.method === "cash") {
      html = ''
        + '<div class="lux-pay-detail-box">'
        + '  <h4>Cash collection</h4>'
        + '  <p>The cashier will close the order immediately and print the MAESTRO receipt.</p>'
        + '</div>';
    } else if (state.method === "carte") {
      html = ''
        + '<div class="lux-pay-detail-box">'
        + '  <h4>CMI secure payment</h4>'
        + '  <p>Proceed with the card terminal or the bank card flow, then confirm to finalize the sale.</p>'
        + '  <div class="lux-pay-field"><label for="lux-pay-card-ref">Authorization or last 4 digits</label><input id="lux-pay-card-ref" type="text" placeholder="CMI / 1234"></div>'
        + '</div>';
    } else {
      html = ''
        + '<div class="lux-pay-detail-box">'
        + '  <h4>Gift Card redemption</h4>'
        + '  <p>Enter the gift card code. The balance is verified before the ticket is issued.</p>'
        + '  <div class="lux-pay-field"><label for="lux-pay-gift-code">Gift card code</label><input id="lux-pay-gift-code" type="password" placeholder="LUX-GIFT-0000" autocomplete="off"></div>'
        + '  <div class="lux-pay-hint">Codes are checked with NextaGlobal / MAESTRO data before payment confirmation.</div>'
        + '</div>';
    }
    detailHost.innerHTML = html;
    id("lux-pay-message").textContent = "";
  }

  async function submit() {
    var button = id("lux-pay-submit");
    var message = id("lux-pay-message");
    if (!button || !message) return;

    message.textContent = "";
    button.disabled = true;
    button.textContent = "Processing...";

    try {
      var result = {
        payMethod: state.method,
        method: state.method,
        label: METHODS[state.method].label,
        ref: makeRef(state.method),
        amount: Number(state.order && state.order.total || 0),
        currency: state.order && state.order.currency || "MAD"
      };

      if (state.method === "carte") {
        var cardRef = id("lux-pay-card-ref");
        result.cardReference = cardRef && cardRef.value ? cardRef.value.trim() : "";
      }

      if (state.method === "giftcard") {
        var codeInput = id("lux-pay-gift-code");
        var code = codeInput && codeInput.value ? codeInput.value.trim().toUpperCase() : "";
        if (!code) throw new Error("Gift card code is required.");
        if (!window.LuxAPI || typeof window.LuxAPI.checkGiftCard !== "function") {
          throw new Error("Gift card verification is unavailable.");
        }
        var giftCard = await window.LuxAPI.checkGiftCard(code);
        if (!giftCard) throw new Error("Gift card not found.");
        var balance = Number(giftCard.balance != null ? giftCard.balance : giftCard.amount || 0);
        if (balance < Number(state.order && state.order.total || 0)) {
          throw new Error("Gift card balance is not enough.");
        }
        result.giftCard = {
          code: code,
          balance: balance,
          holder: giftCard.holder || giftCard.customer || ""
        };
      }

      if (state.order && typeof state.order.submitCallback === "function") {
        await Promise.resolve(state.order.submitCallback(result));
      }

      state.lastResult = result;
      id("lux-pay-ref").textContent = result.ref;
      id("lux-pay-success-copy").textContent = METHODS[state.method].label + " payment confirmed. The ticket is now closed.";
      setStep(3);
    } catch (error) {
      message.textContent = error && error.message ? error.message : "Payment failed. Please try again.";
    } finally {
      button.disabled = false;
      button.textContent = "Continuer";
    }
  }

  function makeRef(method) {
    var stamp = Date.now().toString(36).toUpperCase();
    return "MAE-" + (method || "PAY").toUpperCase() + "-" + stamp.slice(-6);
  }

  function finish() {
    close();
    if (state.order && typeof state.order.onClose === "function") {
      state.order.onClose(state.lastResult || null);
    }
  }

  function close() {
    var overlay = id("lux-pay-overlay");
    if (!overlay) return;
    overlay.classList.remove("open");
    state.step = 1;
    state.lastResult = null;
    if (id("lux-pay-message")) id("lux-pay-message").textContent = "";
  }

  function open(order) {
    build();
    state.order = Object.assign({
      methods: ["cash", "carte", "giftcard"],
      total: 0,
      currency: "MAD",
      defaultMethod: "cash"
    }, order || {});
    state.method = METHODS[state.order.defaultMethod] ? state.order.defaultMethod : visibleMethods()[0] || "cash";
    state.step = 1;
    state.lastResult = null;

    id("lux-pay-amount").textContent = fmtAmount();
    renderMethods();
    renderDetails();
    setStep(1);
    id("lux-pay-overlay").classList.add("open");
  }

  window.LuxPayment = {
    open: open,
    close: close,
    finish: finish,
    submit: submit
  };
})(window);
