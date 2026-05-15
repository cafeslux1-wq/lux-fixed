/**
 * pos-core.js — POS Core Engine — MAESTRO V12
 * Deps: caisse, MENU, IMGS, getLS, setLS, toast, fmtCA, showPage, LuxAPI
 */

// ── Menu & Tables ─────────────────────────────────────────────
function buildMenuSections(){
  MENU.forEach(function(cat){
    const el = document.getElementById('ms-' + cat.id);
    if(!el) return;
    let h = '';
    h += '<div class="m-cat-lbl">' + cat.icon + ' ' + cat.title + '</div>';
    h += '<div class="m-grid">';
    cat.items.forEach(function(it){
      const sig = it.sig ? ' sig' : '';
      const imgSrc = it.img && IMGS[it.img] ? IMGS[it.img] : null;
      const imgHtml = imgSrc
        ? '<img class="m-img" src="' + imgSrc + '">'
        : '';
      h += '<div class="m-card' + sig + '" data-n="' + esc(it.n) + '" data-p="' + it.p + '">';
      h += imgHtml;
      h += '<div class="m-name">' + it.n + '</div>';
      h += '<div class="m-price">' + it.p + ' DH</div>';
      h += '</div>';
    });
    h += '</div>';
    el.innerHTML = h;
    el.querySelectorAll('.m-card').forEach(function(card){
      card.addEventListener('click', function(){
        const n = this.getAttribute('data-n');
        const p = parseFloat(this.getAttribute('data-p'));
        addToCart(n, p);
      });
    });
  });
}

function buildTables(){
  const grid = document.getElementById('tbl-grid');
  if(!grid) return;
  let h = '';
  const occ = [2,3,5,7,8,11];
  for(let i=1; i<=12; i++){
    const isOcc = occ.indexOf(i) >= 0;
    const isSel = caisse.selectedTable === i;
    let cls = 'tbl-btn';
    if(isSel) cls += ' sel';
    else if(isOcc) cls += ' occ';
    h += '<div class="' + cls + '" data-tbl="' + i + '">';
    h += '<div class="tbl-num">' + i + '</div>';
    h += '<div class="tbl-st">' + (isSel ? 'Sélec' : isOcc ? 'Occupée' : 'Libre') + '</div>';
    h += '</div>';
  }
  grid.innerHTML = h;
  grid.querySelectorAll('.tbl-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      selectTable(parseInt(this.getAttribute('data-tbl')));
    });
  });
}

function selectTable(n){
  if(caisse.selectedTable) caisse.tableOrders[caisse.selectedTable] = caisse.cart.slice();
  caisse.selectedTable = n;
  caisse.cart = (caisse.tableOrders[n] || []).slice();
  buildTables();
  setEl('pos-title', 'Table ' + n);
  renderTicket();
}

function addTakeaway(){
  const id = 'E' + caisse.takeawayCount++;
  if(caisse.selectedTable) caisse.tableOrders[caisse.selectedTable] = caisse.cart.slice();
  caisse.selectedTable = id;
  caisse.cart = (caisse.tableOrders[id] || []).slice();
  setEl('pos-title', 'A Emporter — ' + id);
  buildTables();
  renderTicket();
  toast('Nouveau ticket emporter: ' + id);
}

function addToCart(n, p){
  if(!caisse.selectedTable){ toast('⚠ Selectionnez une table'); return; }
  // v4.1: match by both short and long name keys (incoming WEB orders may use either)
  const ex = caisse.cart.filter(function(c){ return (c.n||c.name) === n; })[0];
  if(ex){
    var curQ = Number(ex.q != null ? ex.q : ex.qty) || 0;
    ex.q = curQ + 1; ex.qty = ex.q; // keep both in sync
  } else {
    caisse.cart.push({ n:n, p:Number(p)||0, q:1, name:n, price:Number(p)||0, qty:1 });
  }
  renderTicket();
  toast('✓ ' + n);
}

function rmFromCart(n){
  const ex = caisse.cart.filter(function(c){ return (c.n||c.name)===n; })[0];
  if(ex){
    var curQ = Number(ex.q != null ? ex.q : ex.qty) || 0;
    if(curQ > 1){ ex.q = curQ - 1; ex.qty = ex.q; }
    else caisse.cart = caisse.cart.filter(function(c){ return (c.n||c.name) !== n; });
  }
  renderTicket();
}

function clearCart(){
  caisse.cart = [];
  if(caisse.selectedTable) caisse.tableOrders[caisse.selectedTable] = [];
  renderTicket();
}

function renderTicket(){
  const el = document.getElementById('ticket-items');
  if(!el) return;
  if(!caisse.cart.length){
    el.innerHTML = '<div style="color:var(--muted);font-size:11px;text-align:center;padding:16px">Aucun article</div>';
  } else {
    let h = '';
    caisse.cart.forEach(function(c){
      // v4.1: tolerate both {n,p,q} and {name,price,qty} — defaults guard against NaN/undefined
      const itemName = c.n || c.name || '—';
      const itemQty  = Number(c.q != null ? c.q : c.qty) || 1;
      const itemP    = Number(c.p != null ? c.p : c.price) || 0;
      const safeName = esc(itemName);
      h += '<div class="t-item">';
      h += '<div class="t-qty">' + itemQty + '</div>';
      h += '<div class="t-name">' + itemName + '</div>';
      h += '<div class="t-price">' + (itemP*itemQty).toFixed(2) + ' DH</div>';
      h += '<button class="t-rm" data-n="' + safeName + '">x</button>';
      h += '</div>';
    });
    el.innerHTML = h;
    el.querySelectorAll('.t-rm').forEach(function(btn){
      btn.addEventListener('click', function(){ rmFromCart(this.getAttribute('data-n')); });
    });
  }
  // v4.1: also tolerate both field shapes in subtotal computation
  const sub = caisse.cart.reduce(function(s,c){
    const p = Number(c.p != null ? c.p : c.price) || 0;
    const q = Number(c.q != null ? c.q : c.qty) || 0;
    return s + p*q;
  }, 0);
  const tva = sub * 0.1;
  setEl('t-sub', sub.toFixed(2) + ' DH');
  setEl('t-tva', tva.toFixed(2) + ' DH');
  setEl('t-total', (sub+tva).toFixed(2) + ' DH');
  
  // RFID client
  const rfidDisp = document.getElementById('rfid-display');
  if(rfidDisp && caisse.currentClient){
    rfidDisp.textContent = '👤 ' + caisse.currentClient.name + ' — ' + (caisse.currentClient.points||0) + ' pts';
    rfidDisp.style.color = 'var(--green)';
  }
}

function pay(mode){
  if(!caisse.cart.length){ toast('⚠ Aucun article'); return; }
  // v4.1: tolerate both {p,q} and {price,qty} shapes
  const sub = caisse.cart.reduce(function(s,c){
    const p = Number(c.p != null ? c.p : c.price) || 0;
    const q = Number(c.q != null ? c.q : c.qty) || 0;
    return s + p*q;
  }, 0);
  const total = sub * 1.1;
  
  const tx = {
    id: Date.now(),
    date: today(),
    time: now(),
    table: caisse.selectedTable || '-',
    items: caisse.cart.slice(),
    subtotal: sub.toFixed(2),
    tva: (sub*0.1).toFixed(2),
    total: total.toFixed(2),
    mode: mode,
    client: caisse.currentClient ? caisse.currentClient.name : null,
    type: String(caisse.selectedTable).charAt(0)==='E' ? 'takeaway' : 'table'
  };
  
  const txs = getLS('lux_transactions',[]);
  txs.unshift(tx);
  setLS('lux_transactions', txs.slice(0,500));
  // Sync to API
  if(typeof LuxAPI !== 'undefined') LuxAPI.saveTransaction(tx).catch(()=>{});
  
  // Daily summary
  const daily = getLS('lux_daily',{});
  if(daily.date !== today()){ daily.ca=0; daily.orders=0; daily.date=today(); }
  daily.ca = (parseFloat(daily.ca||0)+total).toFixed(2);
  daily.orders = (daily.orders||0) + 1;
  setLS('lux_daily', daily);
  
  // Loyalty points
  if(caisse.currentClient){
    const pts = Math.floor(sub/10);
    caisse.currentClient.points = (caisse.currentClient.points||0)+pts;
    caisse.currentClient.visits = (caisse.currentClient.visits||0)+1;
    const rfidClients = getLS('lux_clients_rfid',{});
    rfidClients[caisse.currentClient.uid] = caisse.currentClient;
    setLS('lux_clients_rfid', rfidClients);
    if(pts) toast('⭐ +' + pts + ' points fidelite pour ' + caisse.currentClient.name);
  }
  
  printTicket(tx);
  caisse.cart = [];
  if(caisse.selectedTable) caisse.tableOrders[caisse.selectedTable] = [];
  caisse.currentClient = null;
  renderTicket();
  caisse.todayCA += total;
  caisse.todayOrders++;
  toast('✅ ' + mode + ' — ' + total.toFixed(2) + ' DH encaisse');
}

function ensureTicketPrintOverlay(){
  var ov = document.getElementById('lux-ticket-print-overlay');
  if(ov) return ov;
  ov = document.createElement('div');
  ov.id = 'lux-ticket-print-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(255,255,255,.98);z-index:9999;display:none;overflow:auto;padding:20px;';
  ov.innerHTML = '<div style="position:fixed;top:16px;right:16px"><button onclick="closeTicketPrintOverlay()" style="padding:10px 14px;border:none;border-radius:10px;background:#111;color:#fff;cursor:pointer;font-weight:700">Fermer</button></div><div id="lux-ticket-print-sheet" style="max-width:320px;margin:0 auto;background:#fff;color:#000"></div>';
  document.body.appendChild(ov);
  return ov;
}
function closeTicketPrintOverlay(){
  var ov = document.getElementById('lux-ticket-print-overlay');
  if(ov) ov.style.display = 'none';
}
window.addEventListener('afterprint', closeTicketPrintOverlay);
function printTicket(tx){
  const items = tx.items.map(function(i){
    return '<tr><td>' + i.n + '</td><td style="text-align:right">' + i.q + '</td><td style="text-align:right">' + (i.p*i.q).toFixed(2) + ' DH</td></tr>';
  }).join('');
  const html = '<div style="font-family:monospace;font-size:12px;width:280px;margin:0 auto;padding:10px;background:#fff;color:#000">'
    + '<h2 style="text-align:center">CAFE LUX</h2>'
    + '<p style="text-align:center;font-size:10px">Residence Ziat N28 - Taza | +212 808524169</p>'
    + '<div style="border-top:1px dashed #000;margin:6px 0"></div>'
    + '<p>' + tx.date + ' ' + tx.time + ' | ' + tx.table + ' | ' + tx.mode + '</p>'
    + (tx.client ? '<p>Client: ' + tx.client + '</p>' : '')
    + '<div style="border-top:1px dashed #000;margin:6px 0"></div>'
    + '<table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Article</th><th>Qte</th><th>Prix</th></tr></thead>'
    + '<tbody>' + items + '</tbody></table>'
    + '<div style="border-top:1px dashed #000;margin:6px 0"></div>'
    + '<p>Sous-total: ' + tx.subtotal + ' DH | TVA: ' + tx.tva + ' DH</p>'
    + '<p style="font-weight:bold">TOTAL: ' + tx.total + ' DH</p>'
    + '<div style="border-top:1px dashed #000;margin:6px 0"></div>'
    + '<p style="text-align:center">Merci! www.cafeslux.com</p>'
    + '</div>';
  var ov = ensureTicketPrintOverlay();
  document.getElementById('lux-ticket-print-sheet').innerHTML = html;
  ov.style.display = 'block';
  setTimeout(function(){ window.print(); }, 120);
}

// ── MENU TABS ──
function switchMenuTab(tabId, btn){
  document.querySelectorAll('.m-sec').forEach(function(s){ s.classList.remove('active'); });
  document.querySelectorAll('.m-tab').forEach(function(b){ b.classList.remove('active'); });
  const sec = document.getElementById('ms-' + tabId);
  if(sec) sec.classList.add('active');
  if(btn) btn.classList.add('active');
}



// ── Web Orders ────────────────────────────────────────────────
function renderWebOrders(){
  // Pull from API if online
  if(typeof LuxAPI !== 'undefined' && LuxAPI.isOnline()){
    LuxAPI.getOrders({status:'pending',limit:30}).then(apiOrders=>{
      if(!apiOrders||!apiOrders.length) return;
      const local = getLS('lux_web_orders',[]);
      const merged = [...apiOrders];
      local.forEach(lo=>{ if(!merged.find(ao=>ao.id===lo.id)) merged.push(lo); });
      merged.sort((a,b)=>b.id-a.id);
      setLS('lux_web_orders', merged.slice(0,100));
      _renderWebOrdersUI(merged);
    }).catch(()=>{ _renderWebOrdersUI(getLS('lux_web_orders',[])); });
    return;
  }
  _renderWebOrdersUI(getLS('lux_web_orders',[]));
}
function _renderWebOrdersUI(orders){
  const el = document.getElementById('web-orders-grid');
  if(!el) return;
  
  const pendingCount = orders.filter(function(o){return o.status==='pending';}).length;
  const badge = document.getElementById('web-badge');
  if(badge){ badge.textContent = pendingCount; badge.style.display = pendingCount ? 'inline' : 'none'; }
  
  if(!orders.length){
    el.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--muted);padding:40px">Aucune commande web</div>';
    return;
  }
  let h = '';
  orders.sort(function(a,b){return b.id-a.id;}).forEach(function(o){
    const isPending = o.status==='pending';
    h += '<div class="web-card ' + (isPending?'pending':o.status==='done'?'done':'') + '">';
    h += '<div class="web-id">🌐 Commande #' + String(o.id).slice(-6) + '</div>';
    h += '<div style="font-size:11px;margin-bottom:4px">👤 ' + (o.customer||o.name||'?') + (o.phone?' · '+o.phone:'') + '</div>';
    // v4.1: tolerate {n,q} and {name,qty}; fall back gracefully
    var itemsStr = (Array.isArray(o.items) ? o.items : []).map(function(i){
      var q = i.q != null ? i.q : (i.qty != null ? i.qty : 1);
      var n = i.n || i.name || '—';
      return q + 'x ' + n;
    }).join(' · ');
    h += '<div class="web-items">' + (itemsStr || '—') + '</div>';
    h += '<div class="web-footer">';
    h += '<span style="font-family:Playfair Display,serif;color:var(--gold);font-size:15px">' + (o.total || '0.00') + ' DH</span>';
    h += '<span class="badge ' + (isPending?'r':o.status==='accepted'?'gold':'g') + '">' + (isPending?'En attente':o.status==='accepted'?'Acceptee':'Terminee') + '</span>';
    h += '</div>';
    if(o.notes) h += '<div style="font-size:10px;color:var(--muted);margin-top:5px">📝 ' + o.notes + '</div>';
    if(isPending){
      h += '<div style="display:flex;gap:6px;margin-top:10px">';
      h += '<button class="btn sm solid" data-woid="' + o.id + '" onclick="acceptWebOrder(this)">✓ Accepter</button>';
      h += '<button class="btn sm red" data-woid="' + o.id + '" onclick="rejectWebOrder(this)">✗ Refuser</button>';
      h += '</div>';
    }
    h += '</div>';
  });
  el.innerHTML = h;
}

// v4.1 FIX: Normalize order item shapes — tolerate both short (n/p/q) and
// long (name/price/qty) keys. Defaults prevent undefined/NaN in renderTicket.
function _normalizeItem(item){
  if(!item || typeof item !== 'object') return { n:'—', p:0, q:1 };
  var name  = item.n     || item.name    || item.productName || item.full_name || '—';
  var price = item.p     != null ? item.p
            : item.price != null ? item.price
            : item.unitPrice != null ? item.unitPrice : 0;
  var qty   = item.q     != null ? item.q
            : item.qty   != null ? item.qty
            : item.quantity != null ? item.quantity : 1;
  // Coerce to numbers, fall back on NaN guard
  price = Number(price); if(!isFinite(price)) price = 0;
  qty   = Number(qty);   if(!isFinite(qty) || qty <= 0) qty = 1;
  return { n:String(name), p:price, q:qty, name:String(name), price:price, qty:qty };
}
function _normalizeItems(items){
  if(!Array.isArray(items)) return [];
  return items.map(_normalizeItem);
}

function acceptWebOrder(btn){
  const id = parseInt(btn.getAttribute('data-woid'));
  const orders = getLS('lux_web_orders',[]);
  const o = orders.filter(function(x){return x.id===id;})[0];
  if(!o) return;
  o.status = 'accepted';
  setLS('lux_web_orders', orders);
  if(typeof LuxAPI !== 'undefined') LuxAPI.updateOrderStatus(id, 'accepted').catch(()=>{});
  // v4.1: Normalize every item so renderTicket never sees undefined/NaN
  const safeItems = _normalizeItems(o.items);
  // Load into POS
  const takeId = 'WEB' + String(id).slice(-4);
  caisse.tableOrders[takeId] = safeItems.slice();
  caisse.selectedTable = takeId;
  caisse.cart = safeItems.slice();
  setEl('pos-title', 'Web — ' + (o.customer || o.name || o.phone || ''));
  renderWebOrders();
  renderTicket();
  showPage('pos');
  toast('🌐 Commande chargée dans la caisse!');
}

function rejectWebOrder(btn){
  const id = parseInt(btn.getAttribute('data-woid'));
  const orders = getLS('lux_web_orders',[]);
  const o = orders.filter(function(x){return x.id===id;})[0];
  if(o){ o.status='rejected'; setLS('lux_web_orders',orders); 
    if(typeof LuxAPI !== 'undefined') LuxAPI.updateOrderStatus(id, 'rejected').catch(()=>{}); }
  renderWebOrders();
  toast('✗ Commande refusee');
}

// Poll web orders
setInterval(function(){
  if(document.getElementById('p-web') && document.getElementById('p-web').classList.contains('active'))
    renderWebOrders();
  // Badge update
  const pending = getLS('lux_web_orders',[]).filter(function(o){return o.status==='pending';});
  const badge = document.getElementById('web-badge');
  if(badge){ badge.textContent=pending.length; badge.style.display=pending.length?'inline':'none'; }
}, 4000);

// ══════════════════════════
//  PAGE: ADMINISTRATION
// ══════════════════════════


// ── KDS + QR Tables ───────────────────────────────────────────
function renderKDS(){
  var el = document.getElementById('kds-grid');
  if(!el) return;
  var orders = getLS('lux_web_orders', []).filter(function(o){ return (o.status||'pending') !== 'delivered'; });
  if(!orders.length){ el.innerHTML = '<div class="card" style="grid-column:1/-1;text-align:center;color:var(--muted)">Aucune commande à préparer.</div>'; return; }
  el.innerHTML = orders.slice(0,12).map(function(o, idx){
    // v4.1: tolerate both {n,q} and {name,qty} shapes
    var items = (o.items||[]).map(function(i){
      var qty  = i.q != null ? i.q : (i.qty != null ? i.qty : 1);
      var name = i.n || i.name || '—';
      return '<div style="font-size:12px;color:var(--text);margin-bottom:4px">• '+qty+' × '+name+'</div>';
    }).join('');
    var type = o.type === 'delivery' ? '🛵 Livraison' : (o.type === 'table' ? '🪑 Sur place' : '🥡 Emporter');
    return '<div class="card" style="border-color:rgba(201,168,76,.3)">'+
      '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px"><div style="font-family:Playfair Display,serif;color:var(--gold);font-size:16px">Commande #'+String(o.id).slice(-6)+'</div><span class="badge gold">'+type+'</span></div>'+
      '<div style="font-size:11px;color:var(--muted);margin-bottom:10px">'+(o.customer||'Client')+' · '+(o.time||'')+'</div>'+
      '<div style="margin-bottom:12px">'+items+'</div>'+
      '<div style="display:flex;justify-content:space-between;align-items:center"><strong style="color:var(--gold)">'+(o.total||0)+' DH</strong><button class="btn sm solid" onclick="markKdsReady('+o.id+')">Prête</button></div>'+
    '</div>';
  }).join('');
}
function markKdsReady(id){
  var orders = getLS('lux_web_orders', []);
  orders = orders.map(function(o){ if(o.id===id){ o.status='ready'; } return o; });
  setLS('lux_web_orders', orders);
  renderKDS(); renderWebOrders(); toast('✅ Commande marquée prête');
}
function renderQRTables(){
  var el = document.getElementById('qr-grid');
  if(!el) return;
  var base = window.location.origin + window.location.pathname.replace(/[^/]+$/, '') + 'cafe-lux.html?mode=site&tab=menu';
  var html='';
  for(var i=1;i<=12;i++){
    var url = base + '&table=' + i;
    var qrImg = 'https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl='+encodeURIComponent(url)+'&choe=UTF-8&chld=H|2';
    html += '<div class="card" style="text-align:center">'+
      '<div style="font-family:Playfair Display,serif;color:var(--gold);font-size:24px;margin-bottom:6px">Table '+i+'</div>'+
      '<div style="font-size:11px;color:var(--muted);margin-bottom:10px">QR menu public</div>'+
      '<div style="background:#fff;border-radius:12px;padding:8px;display:inline-block;margin-bottom:10px"><img src="'+qrImg+'" width="140" height="140" alt="QR Table '+i+'" style="display:block;border-radius:6px"></div>'+
      '<div style="display:flex;gap:8px;justify-content:center"><button class="btn sm" onclick="copyQrLink('+i+')">📋 Copier</button><button class="btn sm solid" onclick="printQrCard('+i+')">🖨 Imprimer</button></div>'+
    '</div>';
  }
  el.innerHTML = html;
}
function copyQrLink(i){
  var url = window.location.origin + window.location.pathname.replace(/[^/]+$/, '') + 'cafe-lux.html?mode=site&tab=menu&table=' + i;
  navigator.clipboard.writeText(url).then(function(){ toast('🔗 Lien table '+i+' copié'); }).catch(function(){ toast(url); });
}
function printQrCard(i){
  var url = window.location.origin + window.location.pathname.replace(/[^/]+$/, '') + 'cafe-lux.html?mode=site&tab=menu&table=' + i;
  var qrImg = 'https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl='+encodeURIComponent(url)+'&choe=UTF-8&chld=H|2';
  var w = window.open('', '', 'width=420,height=620');
  if(!w) return;
  w.document.write('<!DOCTYPE html><html><head><title>QR Table '+i+'</title><style>'
    +'body{font-family:serif;text-align:center;padding:30px;background:#fff;color:#000}'
    +'.logo{font-size:28px;letter-spacing:6px;color:#8B6E2F;margin-bottom:4px}'
    +'.sub{font-size:10px;letter-spacing:3px;color:#888;margin-bottom:16px}'
    +'img{border:3px solid #C9A84C;border-radius:12px;padding:8px;background:#fff}'
    +'.tnum{font-size:42px;color:#C9A84C;font-weight:700;margin:14px 0 6px}'
    +'.hint{font-size:12px;color:#555;margin-top:8px}'
    +'.url{font-size:9px;color:#AAA;margin-top:4px}'
    +'</style></head><body>'
    +'<div class="logo">✦ LUX</div>'
    +'<div class="sub">CAFÉ & PÂTISSERIE · TAZA</div>'
    +'<img src="'+qrImg+'" width="200" height="200" alt="QR">'
    +'<div class="tnum">TABLE '+i+'</div>'
    +'<div class="hint">📱 Scannez pour commander directement</div>'
    +'<div class="url">cafeslux.com · +212 808524169</div>'
    +'</body></html>');
  w.document.close();
  setTimeout(function(){try{w.focus();w.print();}catch(e){}}, 800);
}



// ── Checkout mode router ──────────────────────────────────────
<script>
(function(){
  function setModeBadge(){
    try{
      var mode = new URLSearchParams(location.search).get('mode') || 'hub';
      var map = {pos:'POS',admin:'ADMIN',stock:'STOCK',kds:'KDS',staff:'STAFF',qr:'QR',site:'SITE',web:'WEB'};
      var el = document.getElementById('mode-badge');
      if(el) el.textContent = '✦ Mode: ' + (map[mode] || mode.toUpperCase());
    }catch(e){}
  }
  window.adminQuickAction = function(action){
    if(action === 'add-product'){ renderAdmin('menu'); setTimeout(function(){ openProductModal(null); }, 120); return; }
    if(action === 'stock'){ renderAdmin('stock'); return; }
    if(action === 'tx'){ renderAdmin('tx'); return; }
    if(action === 'refresh'){
      var active = document.querySelector('.admin-nav.active');
      if(active){ renderAdmin(active.getAttribute('data-ap')); }
      checkApiStatus && checkApiStatus();
      toast && toast('Suite Luxury actualisée');
      return;
    }
  };
  setTimeout(setModeBadge, 50);
})();
// ── MON ESPACE LUX: order lookup ──────────────────────────
function lookupMyOrders(){
  var phone = (document.getElementById('acc-phone-lookup')||{}).value||'';
  if(!phone){ toast('⚠ Entrez votre numéro de téléphone'); return; }
  var orders = getLS('lux_web_orders',[]);
  var mine = orders.filter(function(o){ return (o.phone||'').includes(phone.replace(/\D/g,'')); });
  var el = document.getElementById('my-orders-list');
  if(!el) return;
  if(!mine.length){
    el.innerHTML='<div style="font-size:12px;color:#999;text-align:center;padding:10px">Aucune commande trouvée pour ce numéro.</div>';
    return;
  }
  el.innerHTML = mine.slice(0,5).map(function(o){
    var statusColor = o.status==='done' ? '#3DBE7A' : '#C9A84C';
    var statusLabel = o.status==='done' ? '✅ Livré' : '⏳ En cours';
    return '<div style="border:1px solid #EDE5D5;border-radius:8px;padding:10px;margin-bottom:8px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center">'
      +'<span style="font-weight:700;font-size:12px">#'+String(o.id).slice(-6)+'</span>'
      +'<span style="font-size:11px;color:'+statusColor+'">'+statusLabel+'</span>'
      +'</div>'
      +'<div style="font-size:11px;color:#666;margin-top:4px">'+o.date+' · '+o.total+' DH</div>'
      +'<div style="font-size:11px;color:#444;margin-top:2px">'+(o.items||[]).map(function(i){return i.n;}).join(', ')+'</div>'
      +'</div>';
  }).join('');
}

// ── Order gift card ────────────────────────────────────────
function orderGiftCard(){
  var msg = encodeURIComponent('✦ Je souhaite commander une Carte Cadeau Café LUX. Pouvez-vous me contacter pour les détails? Merci!');
  window.open('https://wa.me/212677717201?text='+msg,'_blank');
}


</script>


// ── Exports ───────────────────────────────────────────────────
['buildMenuSections','switchMenuTab','buildTables','selectTable','addTakeaway',
 'addToCart','rmFromCart','clearCart','renderTicket','pay','printTicket',
 'ensureTicketPrintOverlay','closeTicketPrintOverlay',
 'renderWebOrders','acceptWebOrder','rejectWebOrder',
 'renderKDS','markKdsReady','renderQRTables','copyQrLink','printQrCard'
].forEach(function(fn){ if(typeof eval(fn)==='function') window[fn]=eval(fn); });
