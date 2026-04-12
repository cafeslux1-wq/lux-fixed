(function(window){
  "use strict";

  if (typeof document === "undefined") return;

  var LS = {
    lang: "lux_pos_language",
    currency: "lux_pos_currency",
    trust: "lux_pos_trustscore"
  };
  var RATES = Object.assign({ MAD: 1, USD: 0.1, EUR: 0.09 }, window.LUX_CURRENCY_RATES || {});
  var SVG_FALLBACK = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 380"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#151515"/><stop offset="1" stop-color="#2a2313"/></linearGradient></defs><rect width="600" height="380" fill="url(#g)"/><circle cx="470" cy="86" r="90" fill="rgba(201,168,76,.18)"/><circle cx="100" cy="300" r="120" fill="rgba(91,141,239,.12)"/><text x="50%" y="46%" font-family="Georgia,serif" font-size="52" fill="#C9A84C" text-anchor="middle">✦ LUX</text><text x="50%" y="60%" font-family="Arial,sans-serif" font-size="22" fill="#f5f0e8" text-anchor="middle">MAESTRO POS</text></svg>'
  );
  var TEXT = {
    fr: {k:"✦ MAESTRO POS · NextaGlobal",t:"Caisse mondiale, premium et fluide.",s:"Grille a gauche, ticket fixe a droite, modificateurs, TrustScore et paiement unifie.",svc:"Flux de service",svcNote:"Passez de la table au pickup ou a la livraison sans quitter la caisse.",cust:"Client & TrustScore",custNote:"Le telephone active le suivi fidelite.",search:"Recherche rapide",searchPh:"Produit ou categorie...",phone:"Telephone",phonePh:"+212 ...",name:"Nom client",namePh:"Nom ou alias",table:"Numero de table",tablePh:"Ex: 7",delivery:"Adresse / note livraison",deliveryPh:"Quartier, repere, instruction...",ai:"✦ Suggestion intelligente",clear:"Vider le ticket",tableMode:"Sur place",pickup:"Retrait",deliveryMode:"Livraison",cart:"Ticket MAESTRO",cartSub:"Panier premium synchronise avec MAESTRO OS.",all:"Tout voir",empty:"Aucun article dans le ticket.",loading:"Chargement du catalogue...",sub:"Sous-total",tax:"TVA 10%",total:"Total TTC",base:"Base MAESTRO",cash:"Cash",card:"Carte CMI",checkout:"Encaisser",added:"Article ajoute au ticket",needTable:"Selectionnez une table.",needPhone:"Ajoutez un numero ou une carte RFID.",needDelivery:"Ajoutez une adresse ou une note livraison.",modTitle:"Personnaliser l'article",confirm:"Ajouter au ticket",cancel:"Annuler",notes:"Instruction",notesPh:"Sans mousse, extra chaud...",powered:"Powered by MAESTRO OS — A subsidiary of NextaGlobal Holding",guest:"Client discret",loyal:"Client fidele",vip:"Client VIP"},
    en: {k:"✦ MAESTRO POS · NextaGlobal",t:"Global luxury checkout, built for speed.",s:"Grid on the left, pinned ticket on the right, modifiers, TrustScore and unified payment.",svc:"Service flow",svcNote:"Switch between table, pickup and delivery without leaving the POS.",cust:"Customer & TrustScore",custNote:"Phone tracking powers loyalty.",search:"Quick search",searchPh:"Product or category...",phone:"Phone",phonePh:"+212 ...",name:"Customer name",namePh:"Name or alias",table:"Table number",tablePh:"Ex: 7",delivery:"Delivery note / address",deliveryPh:"District, landmark, instruction...",ai:"✦ Smart suggestion",clear:"Clear ticket",tableMode:"Dine-in",pickup:"Pickup",deliveryMode:"Delivery",cart:"MAESTRO Ticket",cartSub:"Premium cart synced with MAESTRO OS.",all:"All items",empty:"No items in the ticket.",loading:"Loading catalog...",sub:"Subtotal",tax:"VAT 10%",total:"Grand total",base:"MAESTRO base",cash:"Cash",card:"CMI Card",checkout:"Checkout",added:"Item added to the ticket",needTable:"Select a table first.",needPhone:"Add a phone number or RFID guest.",needDelivery:"Add a delivery note or address.",modTitle:"Customize item",confirm:"Add to ticket",cancel:"Cancel",notes:"Instruction",notesPh:"No foam, extra hot...",powered:"Powered by MAESTRO OS — A subsidiary of NextaGlobal Holding",guest:"Silent profile",loyal:"Loyal guest",vip:"VIP guest"},
    ar: {k:"✦ MAESTRO POS · NextaGlobal",t:"واجهة كاشي عالمية فاخرة وسريعة.",s:"شبكة بيع يسارًا، تذكرة ثابتة يمينًا، موديفايرز وTrustScore ودفع موحد.",svc:"نوع الخدمة",svcNote:"بدّل بين الطاولة والاستلام والتوصيل بدون مغادرة الواجهة.",cust:"العميل و TrustScore",custNote:"رقم الهاتف يفعّل تتبع الولاء.",search:"بحث سريع",searchPh:"منتج أو فئة...",phone:"الهاتف",phonePh:"+212 ...",name:"اسم العميل",namePh:"اسم أو لقب",table:"رقم الطاولة",tablePh:"مثال: 7",delivery:"ملاحظة / عنوان التوصيل",deliveryPh:"حي، معلم قريب، تعليمات...",ai:"✦ اقتراح ذكي",clear:"تفريغ التذكرة",tableMode:"داخل المقهى",pickup:"استلام",deliveryMode:"توصيل",cart:"تذكرة MAESTRO",cartSub:"سلة فاخرة متزامنة مع MAESTRO OS.",all:"كل الأصناف",empty:"لا توجد عناصر داخل التذكرة.",loading:"جاري تحميل الكتالوج...",sub:"المجموع الفرعي",tax:"ضريبة 10%",total:"الإجمالي",base:"الأساس MAESTRO",cash:"كاش",card:"بطاقة CMI",checkout:"تحصيل",added:"تمت إضافة المنتج",needTable:"اختر طاولة أولًا.",needPhone:"أدخل رقم الهاتف أو RFID.",needDelivery:"أدخل عنوانًا أو ملاحظة للتوصيل.",modTitle:"تخصيص المنتج",confirm:"إضافة للتذكرة",cancel:"إلغاء",notes:"تعليمات",notesPh:"بدون رغوة، ساخن جدًا...",powered:"Powered by MAESTRO OS — A subsidiary of NextaGlobal Holding",guest:"عميل جديد",loyal:"عميل وفي",vip:"عميل VIP"}
  };
  var STATE = {
    lang: read(LS.lang, "fr"),
    currency: read(LS.currency, "MAD"),
    catalog: [],
    category: "all",
    search: "",
    mode: "table",
    table: "",
    ref: "",
    phone: "",
    name: "",
    delivery: "",
    focus: "",
    ready: false,
    swipe: false,
    draft: null,
    lastSelection: ""
  };

  function read(key, fallback){ try { var raw = localStorage.getItem(key); return raw == null ? fallback : JSON.parse(raw); } catch(e){ return fallback; } }
  function write(key, value){ try { localStorage.setItem(key, JSON.stringify(value)); } catch(e){} }
  function say(msg){ if (typeof toast === "function") toast(msg); }
  function tx(key){ return (TEXT[TEXT[STATE.lang] ? STATE.lang : "fr"] || TEXT.fr)[key] || key; }
  function norm(v){ return String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  function slug(v){ return norm(v).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""); }
  function esc(v){ return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
  function moneyMad(v){ return new Intl.NumberFormat("fr-MA",{style:"currency",currency:"MAD",minimumFractionDigits:2}).format(Number(v || 0)); }
  function money(v){
    var meta = { MAD:{l:"fr-MA",c:"MAD"}, USD:{l:"en-US",c:"USD"}, EUR:{l:"fr-FR",c:"EUR"} }[STATE.currency] || {l:"fr-MA",c:"MAD"};
    return new Intl.NumberFormat(meta.l,{style:"currency",currency:meta.c,minimumFractionDigits:2}).format(Number(v || 0) * Number(RATES[STATE.currency] || 1));
  }
  function localize(copy){
    if (!copy || typeof copy !== "object") return "";
    return copy[STATE.lang] || copy.fr || copy.en || "";
  }
  function icon(label){
    var v = norm(label);
    if (/break|dej|petit/.test(v)) return "🍳";
    if (/cafe|coffee|espresso/.test(v)) return "☕";
    if (/creme|milk/.test(v)) return "🥛";
    if (/infusion|tea|the/.test(v)) return "🍵";
    if (/jus|juice|smooth|shake/.test(v)) return "🥤";
    if (/crepe/.test(v)) return "🥞";
    if (/restaurant|resto|toast|harira/.test(v)) return "🍽";
    if (/soft|soda/.test(v)) return "🥫";
    if (/signature|lux/.test(v)) return "⭐";
    return "✦";
  }

  function ensureTrust(){
    if (window.TrustScore && typeof TrustScore.recordTransaction === "function" && typeof TrustScore.getProfile === "function") return;
    window.TrustScore = {
      getProfile: function(phone){
        var data = read(LS.trust, {});
        return data[String(phone || "").replace(/\s+/g, "")] || null;
      },
      recordTransaction: function(payload){
        var clean = String((payload && payload.phone) || "").replace(/\s+/g, "");
        if (!clean) return null;
        var data = read(LS.trust, {});
        var item = data[clean] || { phone: clean, customer: "", visits: 0, points: 0, spendMad: 0 };
        item.customer = payload.customer || item.customer || "";
        item.visits += 1;
        item.points += Math.max(1, Math.floor(Number(payload.amount || 0) / 10));
        item.spendMad += Number(payload.amount || 0);
        item.updatedAt = Date.now();
        data[clean] = item;
        write(LS.trust, data);
        return item;
      }
    };
  }

  function tier(profile){
    if (!profile) return { label: tx("guest"), tone: "guest", note: tx("custNote") };
    if ((profile.points || 0) >= 120 || (profile.visits || 0) >= 8) return { label: tx("vip"), tone: "vip", note: profile.visits + " visits · " + profile.points + " pts" };
    return { label: tx("loyal"), tone: "loyal", note: profile.visits + " visits · " + profile.points + " pts" };
  }

  function rawCatalog(payload){
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.menu) && payload.menu.length) return payload.menu;
    if (payload && Array.isArray(payload.products) && payload.products.length) {
      var categories = {};
      (payload.categories || []).forEach(function(cat){
        var id = String(cat.id || slug(cat.name || cat.title || "general"));
        categories[id] = { id: id, title: cat.name || cat.title || "General", icon: icon(cat.name || cat.title || "General"), items: [] };
      });
      payload.products.forEach(function(product){
        if (product.active === false) return;
        var id = String(product.categoryId || "general");
        if (!categories[id]) categories[id] = { id: id, title: product.categoryName || "General", icon: icon(product.categoryName || "General"), items: [] };
        categories[id].items.push({
          n: product.name,
          p: Number(product.price || 0),
          s: product.description || "",
          sig: !!product.isSignature,
          img: product.imageKey || slug(product.name),
          imageUrl: product.image || product.imageUrl || ""
        });
      });
      return Object.keys(categories).map(function(id){ return categories[id]; });
    }
    return [];
  }

  function catalog(payload){
    return rawCatalog(payload).filter(function(cat){
      return cat && Array.isArray(cat.items) && cat.items.length;
    }).map(function(cat){
      var id = String(cat.id || slug(cat.title || cat.name || "general"));
      var title = cat.title || cat.name || "General";
      return {
        id: id,
        title: title,
        icon: cat.icon || icon(title),
        items: cat.items.map(function(item){
          return {
            n: item.n || item.name || "Untitled",
            p: Number(item.p != null ? item.p : item.price || 0),
            s: item.s || item.description || "",
            sig: !!(item.sig || item.isSignature),
            img: item.img || item.imageKey || slug(item.n || item.name || "item"),
            imageUrl: item.imageUrl || item.image || "",
            categoryId: id,
            categoryTitle: title
          };
        })
      };
    });
  }

  function staticCatalog(){
    try { return catalog(typeof MENU !== "undefined" ? MENU : []); } catch(e){ return []; }
  }

  function selectedKey(){ return String(typeof caisse !== "undefined" && caisse.selectedTable != null ? caisse.selectedTable : ""); }
  function cloneCart(cart){ return (cart || []).map(function(line){ return JSON.parse(JSON.stringify(line)); }); }
  function lineKey(line, seed){ return [line.n, (line.modifiers || []).map(function(m){ return m.label; }).join("-"), line.note || "", seed || 0].join("::"); }
  function syncRFID(){
    if (typeof caisse === "undefined" || !caisse.currentClient) return;
    if (!STATE.phone && caisse.currentClient.phone) STATE.phone = caisse.currentClient.phone;
    if (!STATE.name && caisse.currentClient.name) STATE.name = caisse.currentClient.name;
  }
  function ensureKeys(){
    if (typeof caisse === "undefined" || !Array.isArray(caisse.cart)) return;
    caisse.cart = caisse.cart.map(function(line, index){
      if (!line.key) line.key = lineKey(line, index);
      if (!line.displayName) line.displayName = line.n;
      return line;
    });
  }
  function saveBucket(){
    if (typeof caisse === "undefined") return;
    var key = selectedKey();
    if (key) caisse.tableOrders[key] = cloneCart(caisse.cart);
  }
  function restoreBucket(key){
    if (typeof caisse === "undefined") return;
    caisse.selectedTable = key;
    caisse.cart = cloneCart(caisse.tableOrders[key] || []);
  }

  function syncSelection(force){
    var current = selectedKey();
    if (!force && current === STATE.lastSelection) return;
    STATE.lastSelection = current;
    if (!current) return;
    if (/^\d+$/.test(current)) {
      STATE.mode = "table";
      STATE.table = current;
      STATE.ref = "";
    } else if (/^D/i.test(current) || /^DEL/i.test(current)) {
      STATE.mode = "delivery";
      STATE.ref = current;
    } else {
      STATE.mode = "pickup";
      STATE.ref = current;
    }
  }

  function setMode(mode, options){
    if (typeof caisse === "undefined") return;
    options = options || {};
    saveBucket();
    STATE.mode = mode;
    if (mode === "table") {
      STATE.ref = "";
      STATE.table = String(options.table || STATE.table || 1);
      restoreBucket(STATE.table);
    } else if (mode === "pickup") {
      if (options.fresh || !STATE.ref || !/^WEB/i.test(STATE.ref) && !/^E/i.test(STATE.ref)) STATE.ref = "E" + String(caisse.takeawayCount++);
      restoreBucket(STATE.ref);
    } else {
      if (options.fresh || !STATE.ref || !/^D/i.test(STATE.ref)) STATE.ref = "D" + String(Date.now()).slice(-4);
      restoreBucket(STATE.ref);
    }
    STATE.focus = "";
    renderPOS();
  }

  function injectTopbar(){
    if (document.getElementById("maestro-topbar-controls")) return;
    var host = document.querySelector(".topbar-right");
    if (!host) return;
    var wrap = document.createElement("div");
    wrap.className = "maestro-topbar-group";
    wrap.id = "maestro-topbar-controls";
    wrap.innerHTML = '<select class="maestro-topbar-control" id="maestro-lang"><option value="fr">FR</option><option value="en">EN</option><option value="ar">AR</option></select><select class="maestro-topbar-control" id="maestro-currency"><option value="MAD">MAD</option><option value="USD">USD</option><option value="EUR">EUR</option></select>';
    host.insertBefore(wrap, host.firstChild);
    document.getElementById("maestro-lang").value = STATE.lang;
    document.getElementById("maestro-currency").value = STATE.currency;
    document.getElementById("maestro-lang").addEventListener("change", function(){
      STATE.lang = this.value;
      write(LS.lang, STATE.lang);
      document.body.classList.toggle("pos-lang-ar", STATE.lang === "ar");
      renderPOS();
    });
    document.getElementById("maestro-currency").addEventListener("change", function(){
      STATE.currency = this.value;
      write(LS.currency, STATE.currency);
      renderProducts();
      renderTicket();
    });
  }

  function scaffold(){
    if (STATE.ready) return;
    var page = document.getElementById("p-pos");
    if (!page) return;
    page.innerHTML = '' +
      '<div class="maestro-pos-shell">' +
      '  <section class="maestro-pos-main">' +
      '    <div class="maestro-hero">' +
      '      <div><div class="maestro-kicker" id="mp-k"></div><div class="maestro-title" id="mp-t"></div><div class="maestro-subtitle" id="mp-s"></div></div>' +
      '      <div class="maestro-hero-actions"><button class="maestro-hero-btn" id="mp-ai" type="button"></button><button class="maestro-hero-btn" id="mp-clear" type="button"></button></div>' +
      '    </div>' +
      '    <div class="maestro-main-scroll">' +
      '      <div class="maestro-main-grid">' +
      '        <div class="maestro-card"><div class="maestro-card-head"><div><div class="maestro-card-title" id="mp-svc-title"></div><div class="maestro-card-note" id="mp-svc-note"></div></div><div class="maestro-card-note" id="mp-order-ref"></div></div><div class="maestro-service-switch" id="mp-modes"></div><div class="maestro-table-grid" id="mp-tables"></div></div>' +
      '        <div class="maestro-card"><div class="maestro-card-head"><div><div class="maestro-card-title" id="mp-cust-title"></div><div class="maestro-card-note" id="mp-cust-note"></div></div></div><div class="maestro-fields"><div class="maestro-field"><label id="mp-phone-l"></label><input id="mp-phone" type="tel"></div><div class="maestro-field"><label id="mp-name-l"></label><input id="mp-name" type="text"></div><div class="maestro-field" id="mp-table-wrap"><label id="mp-table-l"></label><input id="mp-table" type="number" min="1" max="24"></div><div class="maestro-field maestro-field--span" id="mp-delivery-wrap"><label id="mp-delivery-l"></label><textarea id="mp-delivery" rows="3"></textarea></div><div class="maestro-field maestro-field--span"><label id="mp-search-l"></label><input id="mp-search" type="search"></div></div><div class="maestro-trust-card" id="mp-trust" style="margin-top:12px"></div><div class="maestro-ai-card" id="mp-insight" style="margin-top:12px"></div></div>' +
      '      </div>' +
      '      <div class="maestro-category-strip" id="mp-cats"></div>' +
      '      <div id="mp-products"></div>' +
      '      <div class="maestro-powered" id="mp-powered"></div>' +
      '    </div>' +
      '  </section>' +
      '  <aside class="maestro-pos-cart"><div class="maestro-cart-head"><h3 id="mp-cart-t"></h3><p id="mp-cart-s"></p></div><div class="maestro-cart-body" id="mp-cart-body"></div><div class="maestro-cart-footer" id="mp-cart-footer"></div></aside>' +
      '  <button class="maestro-mobile-fab" id="mp-fab" type="button"></button>' +
      '  <div class="maestro-mobile-sheet" id="mp-sheet"><div class="maestro-mobile-sheet-panel" id="mp-sheet-panel"><div class="maestro-sheet-handle" id="mp-sheet-handle"></div><div class="maestro-sheet-title" id="mp-sheet-title"></div><div class="maestro-cart-body" id="mp-mobile-body"></div><div class="maestro-cart-footer" id="mp-mobile-footer"></div></div></div>' +
      '</div>' +
      '<div id="maestro-pos-modal"><div class="maestro-modal-card"><div class="maestro-modal-head"><div><h3 id="mp-modal-t"></h3><div class="maestro-subtitle" id="mp-modal-s"></div></div><button class="maestro-modal-close" id="mp-modal-x" type="button">×</button></div><div class="maestro-modifier-grid" id="mp-modal-groups"></div><div class="maestro-field maestro-field--span" style="margin-top:16px"><label id="mp-notes-l"></label><textarea id="mp-notes" rows="3"></textarea></div><div class="maestro-modal-actions"><button class="maestro-modal-btn" id="mp-modal-cancel" type="button"></button><button class="maestro-modal-btn maestro-modal-btn--primary" id="mp-modal-confirm" type="button"></button></div></div></div>';

    document.getElementById("mp-ai").addEventListener("click", function(){ applySuggestion(true); });
    document.getElementById("mp-clear").addEventListener("click", clearCart);
    document.getElementById("mp-fab").addEventListener("click", function(){ toggleSheet(true); });
    document.getElementById("mp-phone").addEventListener("input", function(){ STATE.phone = this.value.trim(); renderTrust(); renderTicket(); });
    document.getElementById("mp-name").addEventListener("input", function(){ STATE.name = this.value.trim(); renderTrust(); });
    document.getElementById("mp-table").addEventListener("input", function(){
      STATE.table = String(this.value || "").replace(/\D/g, "").slice(0, 2);
      if (STATE.table) { saveBucket(); restoreBucket(STATE.table); }
      renderPOS();
    });
    document.getElementById("mp-delivery").addEventListener("input", function(){ STATE.delivery = this.value.trim(); renderTicket(); });
    document.getElementById("mp-search").addEventListener("input", function(){ STATE.search = this.value; STATE.focus = ""; renderProducts(); });
    document.getElementById("mp-modal-x").addEventListener("click", closeModal);
    document.getElementById("mp-modal-cancel").addEventListener("click", closeModal);
    document.getElementById("mp-modal-confirm").addEventListener("click", confirmModal);
    document.getElementById("maestro-pos-modal").addEventListener("click", function(e){ if (e.target.id === "maestro-pos-modal") closeModal(); });
    STATE.ready = true;
  }

  function translate(){
    document.body.classList.toggle("pos-lang-ar", STATE.lang === "ar");
    document.getElementById("mp-k").textContent = tx("k");
    document.getElementById("mp-t").textContent = tx("t");
    document.getElementById("mp-s").textContent = tx("s");
    document.getElementById("mp-svc-title").textContent = tx("svc");
    document.getElementById("mp-svc-note").textContent = tx("svcNote");
    document.getElementById("mp-cust-title").textContent = tx("cust");
    document.getElementById("mp-cust-note").textContent = tx("custNote");
    document.getElementById("mp-phone-l").textContent = tx("phone");
    document.getElementById("mp-phone").placeholder = tx("phonePh");
    document.getElementById("mp-name-l").textContent = tx("name");
    document.getElementById("mp-name").placeholder = tx("namePh");
    document.getElementById("mp-table-l").textContent = tx("table");
    document.getElementById("mp-table").placeholder = tx("tablePh");
    document.getElementById("mp-delivery-l").textContent = tx("delivery");
    document.getElementById("mp-delivery").placeholder = tx("deliveryPh");
    document.getElementById("mp-search-l").textContent = tx("search");
    document.getElementById("mp-search").placeholder = tx("searchPh");
    document.getElementById("mp-ai").textContent = tx("ai");
    document.getElementById("mp-clear").textContent = tx("clear");
    document.getElementById("mp-cart-t").textContent = tx("cart");
    document.getElementById("mp-cart-s").textContent = tx("cartSub");
    document.getElementById("mp-sheet-title").textContent = tx("cart");
    document.getElementById("mp-modal-t").textContent = tx("modTitle");
    document.getElementById("mp-modal-cancel").textContent = tx("cancel");
    document.getElementById("mp-modal-confirm").textContent = tx("confirm");
    document.getElementById("mp-notes-l").textContent = tx("notes");
    document.getElementById("mp-notes").placeholder = tx("notesPh");
    document.getElementById("mp-powered").textContent = tx("powered");
  }

  function loadCatalog(force){
    if (window.__maestroPosCatalogPromise && !force) return window.__maestroPosCatalogPromise;
    renderProducts(true);
    window.__maestroPosCatalogPromise = Promise.resolve().then(function(){
      if (window.LuxAPI && typeof LuxAPI.getPosCatalog === "function") return LuxAPI.getPosCatalog();
      if (window.LuxAPI && typeof LuxAPI.getMenu === "function") return LuxAPI.getMenu();
      return [];
    }).then(function(data){
      STATE.catalog = catalog(data);
      if (!STATE.catalog.length) STATE.catalog = staticCatalog();
    }).catch(function(){
      STATE.catalog = staticCatalog();
    }).finally(function(){
      renderCats();
      renderProducts();
      renderTrust();
    });
    return window.__maestroPosCatalogPromise;
  }

  function tables(){
    syncSelection(false);
    var wrap = document.getElementById("mp-table-wrap");
    var del = document.getElementById("mp-delivery-wrap");
    var grid = document.getElementById("mp-tables");
    var modes = [
      { key: "table", label: tx("tableMode") },
      { key: "pickup", label: tx("pickup") },
      { key: "delivery", label: tx("deliveryMode") }
    ];
    document.getElementById("mp-modes").innerHTML = modes.map(function(mode){
      return '<button class="maestro-switch-btn' + (STATE.mode === mode.key ? ' active' : '') + '" type="button" data-mode="' + mode.key + '">' + mode.label + "</button>";
    }).join("");
    document.getElementById("mp-modes").querySelectorAll("[data-mode]").forEach(function(button){
      button.addEventListener("click", function(){ setMode(this.getAttribute("data-mode"), { fresh: this.getAttribute("data-mode") !== "table" && this.getAttribute("data-mode") !== STATE.mode }); });
    });

    wrap.style.display = STATE.mode === "table" ? "flex" : "none";
    del.style.display = STATE.mode === "delivery" ? "flex" : "none";
    if (STATE.mode !== "table") { grid.style.display = "none"; }
    else {
      grid.style.display = "grid";
      grid.innerHTML = "";
      for (var i = 1; i <= 12; i += 1) {
        var key = String(i);
        var busy = typeof caisse !== "undefined" && caisse.tableOrders && caisse.tableOrders[key] && caisse.tableOrders[key].length;
        var active = STATE.table === key;
        var stateLabel = active ? (STATE.lang === "ar" ? "محددة" : STATE.lang === "en" ? "Active" : "Selectionnee") : busy ? (STATE.lang === "ar" ? "مشغولة" : STATE.lang === "en" ? "Busy" : "Occupee") : (STATE.lang === "ar" ? "فارغة" : STATE.lang === "en" ? "Free" : "Libre");
        var card = document.createElement("button");
        card.className = "maestro-table-btn" + (active ? " active" : "") + (busy ? " busy" : "");
        card.type = "button";
        card.setAttribute("data-table", key);
        card.innerHTML = '<span class="maestro-table-no">' + key + '</span><span class="maestro-table-state">' + stateLabel + "</span>";
        card.addEventListener("click", function(){ selectTable(this.getAttribute("data-table")); });
        grid.appendChild(card);
      }
    }
    document.getElementById("mp-order-ref").textContent = (STATE.mode === "table" ? "T" + (STATE.table || "—") : (STATE.ref || "—"));
  }

  function renderCats(){
    var bar = document.getElementById("mp-cats");
    if (!bar) return;
    var cats = [{ id: "all", icon: "✦", title: tx("all") }].concat(STATE.catalog);
    bar.innerHTML = cats.map(function(cat){
      return '<button class="maestro-category-btn' + (STATE.category === cat.id ? ' active' : '') + '" type="button" data-cat="' + esc(cat.id) + '">' + (cat.icon ? cat.icon + " " : "") + esc(cat.title) + "</button>";
    }).join("");
    bar.querySelectorAll("[data-cat]").forEach(function(button){
      button.addEventListener("click", function(){
        STATE.category = this.getAttribute("data-cat");
        renderCats();
        renderProducts();
      });
    });
  }

  function visibleCatalog(){
    var search = norm(STATE.search);
    return STATE.catalog.map(function(cat){
      return {
        id: cat.id,
        title: cat.title,
        icon: cat.icon,
        items: cat.items.filter(function(item){
          var hay = norm([item.n, item.s, cat.title].join(" "));
          return (!search || hay.indexOf(search) >= 0) && (STATE.category === "all" || STATE.category === cat.id);
        })
      };
    }).filter(function(cat){ return cat.items.length; });
  }

  function image(item){
    return {
      src: item.imageUrl && /^https?:/i.test(item.imageUrl) ? item.imageUrl : "https://cafeslux.com/assets/menu/" + (item.img || slug(item.n)) + ".jpg",
      fallback: (typeof IMGS !== "undefined" && IMGS[item.img]) || SVG_FALLBACK
    };
  }

  window.maestroPosImageFallback = function(el){
    if (el.dataset.fallbackApplied === "1") return;
    el.dataset.fallbackApplied = "1";
    el.src = el.getAttribute("data-fallback") || SVG_FALLBACK;
  };

  function renderProducts(loading){
    var root = document.getElementById("mp-products");
    if (!root) return;
    if (loading && !STATE.catalog.length) { root.innerHTML = '<div class="maestro-card"><div class="maestro-card-note">' + tx("loading") + "</div></div>"; return; }
    var sections = visibleCatalog();
    if (!sections.length) { root.innerHTML = '<div class="maestro-card"><div class="maestro-card-note">' + tx("loading") + "</div></div>"; return; }
    root.innerHTML = sections.map(function(cat){
      return '<section class="maestro-product-section"><div class="maestro-section-title"><h3>' + cat.icon + ' ' + esc(cat.title) + '</h3><span>' + cat.items.length + '</span></div><div class="maestro-product-grid">' + cat.items.map(function(item){
        var img = image(item);
        return '<article class="maestro-product-card' + (norm(STATE.focus) === norm(item.n) ? ' maestro-product-card--highlight' : '') + '" data-product="' + esc(item.n) + '"><div class="maestro-product-media">' + (item.sig ? '<div class="maestro-product-badge">✦ Signature</div>' : '') + '<img src="' + img.src + '" data-fallback="' + img.fallback + '" alt="' + esc(item.n) + '" onerror="window.maestroPosImageFallback(this)"></div><div class="maestro-product-body"><div class="maestro-product-head"><div class="maestro-product-name">' + esc(item.n) + '</div><div class="maestro-product-price">' + money(item.p) + '</div></div><div class="maestro-product-desc">' + esc(item.s || "") + '</div><div class="maestro-product-footer"><div class="maestro-product-meta"><span class="maestro-meta-pill">' + cat.icon + ' ' + esc(cat.title) + '</span></div><button class="maestro-add-btn" type="button">' + tx("confirm") + '</button></div></div></article>';
      }).join("") + "</div></section>";
    }).join("");
    root.querySelectorAll("[data-product]").forEach(function(card){
      card.addEventListener("click", function(e){
        if (e.target && e.target.tagName === "BUTTON") e.stopPropagation();
        var item = find(this.getAttribute("data-product"));
        if (item) openModal(item);
      });
    });
  }

  function find(name){
    var item = null;
    STATE.catalog.some(function(cat){
      item = cat.items.find(function(entry){ return entry.n === name; });
      return !!item;
    });
    return item;
  }

  function modifierGroups(item){
    var key = norm([item.categoryTitle, item.categoryId, item.n].join(" "));
    if (/jus|shake|smooth|soft|mojito|cocktail|panache/.test(key)) {
      return [
        {
          id: "sweet",
          title: localize({ fr: "Sucre", en: "Sweetness", ar: "السكر" }),
          type: "single",
          options: [
            { v: "normal", l: localize({ fr: "Normal", en: "Normal", ar: "عادي" }), p: 0, show: false, checked: true },
            { v: "light", l: localize({ fr: "Peu sucre", en: "Light sugar", ar: "سكر خفيف" }), p: 0, show: true },
            { v: "none", l: localize({ fr: "Sans sucre", en: "No sugar", ar: "بدون سكر" }), p: 0, show: true }
          ]
        },
        {
          id: "texture",
          title: localize({ fr: "Texture", en: "Texture", ar: "القوام" }),
          type: "single",
          options: [
            { v: "classic", l: localize({ fr: "Classique", en: "Classic", ar: "كلاسيكي" }), p: 0, show: false, checked: true },
            { v: "ice", l: localize({ fr: "Glace pilee", en: "Crushed ice", ar: "ثلج مجروش" }), p: 0, show: true },
            { v: "thick", l: localize({ fr: "Mix epais", en: "Thick blend", ar: "قوام كثيف" }), p: 0, show: true }
          ]
        }
      ];
    }
    return [
      {
        id: "sugar",
        title: localize({ fr: "Sucre", en: "Sugar", ar: "السكر" }),
        type: "single",
        options: [
          { v: "normal", l: localize({ fr: "Normal", en: "Regular", ar: "عادي" }), p: 0, show: false, checked: true },
          { v: "extra", l: localize({ fr: "Plus sucre", en: "Extra sugar", ar: "سكر إضافي" }), p: 0, show: true },
          { v: "none", l: localize({ fr: "Sans sucre", en: "No sugar", ar: "بدون سكر" }), p: 0, show: true }
        ]
      },
      {
        id: "milk",
        title: localize({ fr: "Lait", en: "Milk", ar: "الحليب" }),
        type: "single",
        options: [
          { v: "classic", l: localize({ fr: "Lait classique", en: "Classic milk", ar: "حليب عادي" }), p: 0, show: false, checked: true },
          { v: "oat", l: localize({ fr: "Lait d'avoine", en: "Oat milk", ar: "حليب الشوفان" }), p: 4, show: true },
          { v: "almond", l: localize({ fr: "Lait d'amande", en: "Almond milk", ar: "حليب اللوز" }), p: 5, show: true }
        ]
      },
      {
        id: "extras",
        title: localize({ fr: "Extras", en: "Extras", ar: "إضافات" }),
        type: "multi",
        options: [
          { v: "shot", l: localize({ fr: "Shot extra", en: "Extra shot", ar: "شوت إضافي" }), p: 4, show: true },
          { v: "cream", l: localize({ fr: "Chantilly", en: "Whipped cream", ar: "كريمة مخفوقة" }), p: 4, show: true },
          { v: "croissant", l: localize({ fr: "Croissant", en: "Croissant", ar: "كرواسون" }), p: 12, show: true }
        ]
      }
    ];
  }

  function openModal(item){
    if (!item) return;
    if (STATE.mode === "table" && !STATE.table) { say("⚠ " + tx("needTable")); return; }
    if (STATE.mode === "pickup" && !selectedKey()) setMode("pickup", { fresh: true });
    if (STATE.mode === "delivery" && !selectedKey()) setMode("delivery", { fresh: true });
    STATE.draft = { item: item, groups: modifierGroups(item) };
    document.getElementById("mp-modal-t").textContent = item.n;
    document.getElementById("mp-modal-s").textContent = item.s || tx("modTitle");
    document.getElementById("mp-notes").value = "";
    document.getElementById("mp-modal-groups").innerHTML = STATE.draft.groups.map(function(group){
      return '<div class="maestro-mod-group"><h4>' + group.title + '</h4>' + group.options.map(function(option){
        var type = group.type === "multi" ? "checkbox" : "radio";
        var name = group.type === "multi" ? group.id + ":" + option.v : group.id;
        return '<label class="maestro-mod-option"><span>' + option.l + (option.p ? " +" + money(option.p) : "") + '</span><input type="' + type + '" name="' + name + '" value="' + option.v + '"' + (option.checked ? " checked" : "") + "></label>";
      }).join("") + "</div>";
    }).join("");
    document.getElementById("maestro-pos-modal").classList.add("open");
  }

  function closeModal(){
    STATE.draft = null;
    document.getElementById("maestro-pos-modal").classList.remove("open");
  }

  function confirmModal(){
    if (!STATE.draft) return;
    var modifiers = [];
    var root = document.getElementById("mp-modal-groups");
    STATE.draft.groups.forEach(function(group){
      if (group.type === "single") {
        var chosen = root.querySelector('input[name="' + group.id + '"]:checked');
        var option = chosen ? group.options.find(function(entry){ return entry.v === chosen.value; }) : null;
        if (option && option.show) modifiers.push({ label: option.l, price: option.p || 0 });
      } else {
        group.options.forEach(function(option){
          var input = root.querySelector('input[name="' + group.id + ':' + option.v + '"]');
          if (input && input.checked) modifiers.push({ label: option.l, price: option.p || 0 });
        });
      }
    });
    var note = document.getElementById("mp-notes").value.trim();
    var line = {
      n: STATE.draft.item.n,
      displayName: STATE.draft.item.n,
      p: Number(STATE.draft.item.p) + modifiers.reduce(function(sum, mod){ return sum + Number(mod.price || 0); }, 0),
      q: 1,
      modifiers: modifiers,
      note: note,
      img: STATE.draft.item.img,
      s: STATE.draft.item.s || ""
    };
    line.key = lineKey(line, Date.now());
    ensureKeys();
    caisse.cart.push(line);
    saveBucket();
    closeModal();
    renderTicket();
    say("✓ " + tx("added"));
  }

  function summary(){
    ensureKeys();
    var sub = (caisse.cart || []).reduce(function(sum, line){ return sum + Number(line.p || 0) * Number(line.q || 0); }, 0);
    return { sub: sub, tax: sub * 0.1, total: sub * 1.1 };
  }

  function renderTrust(){
    syncRFID();
    var profile = window.TrustScore ? TrustScore.getProfile(STATE.phone || (caisse.currentClient && caisse.currentClient.phone) || "") : null;
    var info = tier(profile);
    document.getElementById("mp-trust").innerHTML = '<div class="maestro-trust-badge">' + info.label + '</div><div class="maestro-trust-copy">' + info.note + "</div>" + (profile ? '<div class="maestro-trust-copy">' + moneyMad(profile.spendMad || 0) + "</div>" : "");
    var tip = suggestion();
    document.getElementById("mp-insight").innerHTML = '<div class="maestro-trust-badge">LUX AI</div><div class="maestro-ai-copy">' + tip.text + "</div>";
  }

  function serviceLabel(){
    if (STATE.mode === "table") return tx("tableMode") + " · T" + (STATE.table || "—");
    if (STATE.mode === "delivery") return tx("deliveryMode") + " · " + (STATE.ref || "—");
    return tx("pickup") + " · " + (STATE.ref || "—");
  }

  function cartMarkup(){
    ensureKeys();
    var stats = summary();
    var count = (caisse.cart || []).reduce(function(sum, line){ return sum + Number(line.q || 0); }, 0);
    var body = !caisse.cart.length
      ? '<div class="maestro-cart-empty">' + tx("empty") + "</div>"
      : '<div class="maestro-cart-list">' + caisse.cart.map(function(line){
          var meta = [];
          if (line.modifiers && line.modifiers.length) meta.push(line.modifiers.map(function(mod){ return mod.label; }).join(" · "));
          if (line.note) meta.push(line.note);
          return '<div class="maestro-cart-item"><div class="maestro-cart-row"><div><div class="maestro-cart-item-name">' + esc(line.displayName || line.n) + '</div><div class="maestro-cart-item-meta">' + esc(meta.join(" · ") || line.s || "") + '</div></div><div class="maestro-product-price">' + money(Number(line.p || 0) * Number(line.q || 0)) + '</div></div><div class="maestro-cart-controls"><button class="maestro-qty-btn" type="button" data-qty="' + esc(line.key) + '" data-delta="-1">−</button><div class="maestro-qty-number">' + line.q + '</div><button class="maestro-qty-btn" type="button" data-qty="' + esc(line.key) + '" data-delta="1">+</button></div></div>';
        }).join("") + "</div>";
    var footer = '<div class="maestro-summary-row"><span>' + tx("sub") + '</span><span>' + money(stats.sub) + '</span></div><div class="maestro-summary-row"><span>' + tx("tax") + '</span><span>' + money(stats.tax) + '</span></div><div class="maestro-summary-row"><span>' + tx("base") + '</span><span>' + moneyMad(stats.total) + '</span></div><div class="maestro-summary-total"><span>' + tx("total") + '</span><strong>' + money(stats.total) + '</strong></div><div class="maestro-summary-caption">' + serviceLabel() + '</div><div class="maestro-pay-grid"><button class="maestro-pay-btn" type="button" data-pay="cash">' + tx("cash") + '</button><button class="maestro-pay-btn" type="button" data-pay="carte">' + tx("card") + '</button><button class="maestro-pay-btn maestro-pay-btn--main" type="button" data-pay="smart">' + tx("checkout") + '</button></div><div class="maestro-powered">' + tx("powered") + "</div>";
    return { body: body, footer: footer, count: count, total: stats.total };
  }

  function bindCart(root){
    if (!root) return;
    root.querySelectorAll("[data-qty]").forEach(function(button){
      button.addEventListener("click", function(){
        ensureKeys();
        var target = (caisse.cart || []).find(function(line){ return line.key === button.getAttribute("data-qty"); });
        if (!target) return;
        target.q += Number(button.getAttribute("data-delta"));
        if (target.q <= 0) caisse.cart = caisse.cart.filter(function(line){ return line.key !== target.key; });
        saveBucket();
        renderTicket();
      });
    });
    root.querySelectorAll("[data-pay]").forEach(function(button){
      button.addEventListener("click", function(){ pay(this.getAttribute("data-pay") === "smart" ? null : this.getAttribute("data-pay")); });
    });
  }

  function renderTicket(){
    scaffold();
    translate();
    tables();
    renderTrust();
    document.getElementById("mp-phone").value = STATE.phone || "";
    document.getElementById("mp-name").value = STATE.name || "";
    document.getElementById("mp-table").value = STATE.table || "";
    document.getElementById("mp-delivery").value = STATE.delivery || "";
    document.getElementById("mp-search").value = STATE.search || "";
    var card = cartMarkup();
    document.getElementById("mp-cart-body").innerHTML = card.body;
    document.getElementById("mp-cart-footer").innerHTML = card.footer;
    document.getElementById("mp-mobile-body").innerHTML = card.body;
    document.getElementById("mp-mobile-footer").innerHTML = card.footer;
    bindCart(document.getElementById("mp-cart-body"));
    bindCart(document.getElementById("mp-cart-footer"));
    bindCart(document.getElementById("mp-mobile-body"));
    bindCart(document.getElementById("mp-mobile-footer"));
    document.getElementById("mp-fab").textContent = tx("cart") + " · " + card.count + " · " + money(card.total);
  }

  function suggestion(){
    var hour = new Date().getHours();
    if (hour < 11) return { item: firstMatch(["espresso", "cafe", "morning", "breakfast", "croissant"]), text: STATE.lang === "ar" ? "الصباح: اقترح قهوة مع كرواسون أو فطور كامل." : STATE.lang === "en" ? "Morning: suggest coffee with pastry or breakfast." : "Matin: proposez cafe + viennoiserie ou petit-dejeuner." };
    if (hour < 16) return { item: firstMatch(["toast", "harira", "jus", "orange"]), text: STATE.lang === "ar" ? "الظهيرة: ارفع التذكرة بتوست أو حريرة أو عصير طازج." : STATE.lang === "en" ? "Lunch: push toast, harira or fresh juice." : "Midi: poussez toast, harira ou jus frais." };
    if (hour < 20) return { item: firstMatch(["cappuccino", "crepe", "cake", "chocolat"]), text: STATE.lang === "ar" ? "بعد الظهر: الكابتشينو والكريب يحولان بسرعة." : STATE.lang === "en" ? "Afternoon: cappuccino and crepe convert fast." : "Apres-midi: cappuccino et crepe convertissent vite." };
    return { item: firstMatch(["lux", "signature", "cocktail", "panache", "mojito"]), text: STATE.lang === "ar" ? "المساء: ركّز على المشروبات السيغنتشر والباناش." : STATE.lang === "en" ? "Evening: lead with signature drinks and panache." : "Soir: misez sur les signatures et panache." };
  }

  function firstMatch(words){
    var found = null;
    STATE.catalog.some(function(cat){
      found = cat.items.find(function(item){ return words.some(function(word){ return norm([item.n, item.s, cat.title].join(" ")).indexOf(word) >= 0; }); });
      return !!found;
    });
    return found;
  }

  function applySuggestion(showToast){
    var tip = suggestion();
    if (tip.item) {
      STATE.category = tip.item.categoryId;
      STATE.focus = tip.item.n;
      renderCats();
      renderProducts();
    }
    if (showToast) say("✦ " + tip.text);
  }

  function validateCheckout(){
    if (STATE.mode === "table" && !STATE.table) { say("⚠ " + tx("needTable")); return false; }
    if (STATE.mode === "delivery" && !STATE.delivery) { say("⚠ " + tx("needDelivery")); return false; }
    return true;
  }

  function txPayload(payment){
    var stats = summary();
    return {
      id: Date.now(),
      date: typeof today === "function" ? today() : new Date().toLocaleDateString("fr-MA"),
      time: typeof now === "function" ? now() : new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      table: STATE.mode === "table" ? STATE.table : STATE.ref,
      serviceMode: STATE.mode,
      currency: STATE.currency,
      fxRate: Number(RATES[STATE.currency] || 1),
      items: (caisse.cart || []).map(function(line){
        var extras = [];
        if (line.modifiers && line.modifiers.length) extras.push(line.modifiers.map(function(mod){ return mod.label; }).join(" · "));
        if (line.note) extras.push(line.note);
        return { n: extras.length ? line.n + " — " + extras.join(" · ") : line.n, p: Number(line.p || 0), q: Number(line.q || 0), modifiers: line.modifiers || [], note: line.note || "" };
      }),
      subtotal: stats.sub.toFixed(2),
      tva: stats.tax.toFixed(2),
      total: stats.total.toFixed(2),
      totalDisplay: money(stats.total),
      mode: payment.payMethod || payment.method || "cash",
      client: STATE.name || (caisse.currentClient && caisse.currentClient.name) || null,
      phone: STATE.phone || (caisse.currentClient && caisse.currentClient.phone) || null,
      ref: payment.ref || "",
      notes: STATE.mode === "delivery" ? STATE.delivery : ""
    };
  }

  function finishPayment(payment){
    ensureTrust();
    var record = txPayload(payment || {});
    var rows = typeof getLS === "function" ? getLS("lux_transactions", []) : read("lux_transactions", []);
    rows.unshift(record);
    if (typeof setLS === "function") setLS("lux_transactions", rows.slice(0, 500));
    else write("lux_transactions", rows.slice(0, 500));
    if (window.LuxAPI && typeof LuxAPI.saveTransaction === "function") LuxAPI.saveTransaction(record).catch(function(){});
    var profile = TrustScore.recordTransaction({ phone: record.phone, customer: record.client, amount: Number(record.total), ref: record.ref, source: "pos" });
    if (typeof caisse !== "undefined" && caisse.currentClient && profile) {
      caisse.currentClient.points = profile.points;
      caisse.currentClient.visits = profile.visits;
      if (typeof setLS === "function" && caisse.currentClient.uid) {
        var clients = getLS("lux_clients_rfid", {});
        clients[caisse.currentClient.uid] = caisse.currentClient;
        setLS("lux_clients_rfid", clients);
      }
    }
    if (typeof printTicket === "function") printTicket(record);
    caisse.cart = [];
    if (selectedKey()) caisse.tableOrders[selectedKey()] = [];
    STATE.focus = "";
    toggleSheet(false);
    renderTicket();
    say("✅ " + tx("checkout"));
  }

  function pay(method){
    if (typeof caisse === "undefined" || !caisse.cart || !caisse.cart.length) { say("⚠ " + tx("empty")); return; }
    if (!validateCheckout()) return;
    var stats = summary();
    say("✦ " + tx("checkout"));
    var payload = {
      total: (Number(stats.total) * Number(RATES[STATE.currency] || 1)).toFixed(2),
      baseTotal: stats.total.toFixed(2),
      amountLabel: money(stats.total),
      currency: STATE.currency,
      customerPhone: STATE.phone || (caisse.currentClient && caisse.currentClient.phone) || "",
      customerName: STATE.name || (caisse.currentClient && caisse.currentClient.name) || "",
      phone: STATE.phone || (caisse.currentClient && caisse.currentClient.phone) || "",
      name: STATE.name || (caisse.currentClient && caisse.currentClient.name) || "",
      source: "pos",
      methods: method ? [method] : ["cash", "carte"],
      defaultMethod: method || "cash",
      submitCallback: finishPayment
    };
    if (window.LuxPayment && typeof LuxPayment.open === "function") { LuxPayment.open(payload); return; }
    finishPayment({ payMethod: method || "cash", ref: "LUX-OFFLINE" });
  }

  function toggleSheet(open){
    var sheet = document.getElementById("mp-sheet");
    if (!sheet) return;
    sheet.classList.toggle("open", typeof open === "boolean" ? open : !sheet.classList.contains("open"));
  }

  function bindSwipe(){
    if (STATE.swipe) return;
    var handle = document.getElementById("mp-sheet-handle");
    var panel = document.getElementById("mp-sheet-panel");
    if (!handle || !panel) return;
    var start = 0, delta = 0, moving = false;
    handle.addEventListener("pointerdown", function(e){ moving = true; start = e.clientY; delta = 0; panel.style.transition = "none"; handle.setPointerCapture(e.pointerId); });
    handle.addEventListener("pointermove", function(e){ if (!moving) return; delta = Math.max(0, e.clientY - start); panel.style.transform = "translateY(" + delta + "px)"; });
    handle.addEventListener("pointerup", function(){ if (!moving) return; moving = false; panel.style.transition = ""; panel.style.transform = ""; if (delta > 90) toggleSheet(false); else toggleSheet(true); });
    STATE.swipe = true;
  }

  function renderPOS(){
    scaffold();
    translate();
    tables();
    renderCats();
    renderProducts();
    renderTrust();
    renderTicket();
    bindSwipe();
  }

  function addTakeaway(){ setMode("pickup", { fresh: true }); }
  function selectTable(table){ STATE.table = String(table); setMode("table", { table: STATE.table }); }
  function clearCart(){ if (typeof caisse === "undefined") return; caisse.cart = []; saveBucket(); renderTicket(); }
  function addToCart(itemOrName, price){ var item = typeof itemOrName === "object" ? itemOrName : find(itemOrName); if (!item) item = { n: itemOrName, p: Number(price || 0), s: "", img: slug(itemOrName), categoryId: "manual", categoryTitle: "Manual" }; openModal(item); }
  function rmFromCart(key){ ensureKeys(); var line = (caisse.cart || []).find(function(entry){ return entry.key === key || entry.n === key; }); if (!line) return; line.q -= 1; if (line.q <= 0) caisse.cart = caisse.cart.filter(function(entry){ return entry.key !== line.key; }); saveBucket(); renderTicket(); }

  window.buildMenuSections = function(){ scaffold(); renderPOS(); if (!STATE.catalog.length) loadCatalog(); };
  window.buildTables = tables;
  window.renderTicket = renderTicket;
  window.addTakeaway = addTakeaway;
  window.selectTable = selectTable;
  window.addToCart = addToCart;
  window.rmFromCart = rmFromCart;
  window.clearCart = clearCart;
  window.pay = pay;
  window.switchMenuTab = function(category){
    var target = String(category || "all");
    var match = STATE.catalog.find(function(cat){
      return cat.id === target || cat.title === target || norm(cat.title) === norm(target);
    });
    STATE.category = match ? match.id : (target === "all" ? "all" : (STATE.category || "all"));
    renderCats();
    renderProducts();
  };

  function init(){
    if (typeof caisse === "undefined") return;
    ensureTrust();
    injectTopbar();
    scaffold();
    syncSelection(true);
    loadCatalog();
    renderPOS();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(window);
