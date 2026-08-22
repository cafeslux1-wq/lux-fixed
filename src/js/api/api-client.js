/**
 * ═══════════════════════════════════════════════════════════════
 *  CAFÉ LUX — api-client.js  v3.0  (MAESTRO Core Engine)
 *  src/js/api/api-client.js
 *
 *  ✅ Zero dependencies — works as plain <script defer>
 *  ✅ Request metadata fingerprint (source page, timestamp)
 *  ✅ TTL cache in localStorage — survives offline / power cut
 *  ✅ Auto-retry (3 attempts, exponential backoff)
 *  ✅ 401 interceptor — clears token, emits lux:unauthorized
 *  ✅ WhatsApp fallback when Railway is unreachable
 *  ✅ Offline queue — replays mutations when back online
 *  ✅ Shared by all 18 standalone pages
 * ═══════════════════════════════════════════════════════════════
 */

(function (global) {
  'use strict';

  // ── Constants ───────────────────────────────────────────────
  var VERSION   = '3.0.0';
  var API_BASE  = global.LUX_API_URL || 'https://cafeslux-api-production.up.railway.app';
  var WA_NUMBER = '212677717201';
  var CACHE_KEY = 'lux_api_cache_v3';
  var TOKEN_KEY = 'lux_token';
  var QUEUE_KEY = 'lux_offline_queue';

  // ── Page fingerprint ─────────────────────────────────────────
  function detectSource() {
    var path = global.location.pathname.toLowerCase();
    var map = {
      'menu':'menu','commander':'menu','reservations':'reservations',
      'reservation':'reservations','gaming':'gaming','pos':'pos',
      'admin':'admin','dashboard':'dashboard','kds':'kds',
      'portal':'portal','saas':'saas','offres':'offers',
      'mon-espace':'account','index':'gateway',
    };
    var parts = path.split('/').filter(Boolean);
    for (var i = parts.length - 1; i >= 0; i--) {
      var seg = parts[i].replace('.html','');
      if (map[seg]) return map[seg];
    }
    return 'gateway';
  }
  var PAGE_SOURCE = detectSource();

  // ── Token Store ──────────────────────────────────────────────
  var TokenStore = {
    get:   function() { try { return localStorage.getItem(TOKEN_KEY); }  catch(e) { return null; } },
    set:   function(t){ try { localStorage.setItem(TOKEN_KEY, t); }       catch(e) {} },
    clear: function() { try { localStorage.removeItem(TOKEN_KEY); }       catch(e) {} },
    valid: function() { return !!this.get(); },
  };

  // ── localStorage Cache ───────────────────────────────────────
  var Cache = {
    _d: null,
    _load: function() {
      if (this._d) return this._d;
      try { this._d = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); }
      catch(e) { this._d = {}; }
      return this._d;
    },
    _save: function() {
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(this._d)); } catch(e) {}
    },
    get: function(key) {
      var e = this._load()[key];
      if (!e) return null;
      if (Date.now() > e.exp) { delete this._d[key]; this._save(); return null; }
      return e.val;
    },
    set: function(key, val, ttl) {
      this._load()[key] = { val:val, exp:Date.now()+(ttl||900000), ts:Date.now() };
      this._save();
    },
    del: function(prefix) {
      var d = this._load();
      Object.keys(d).forEach(function(k){ if(k.indexOf(prefix)!==-1) delete d[k]; });
      this._save();
    },
  };

  // ── Offline Queue ────────────────────────────────────────────
  var OfflineQueue = {
    _get: function() { try { return JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]'); } catch(e){return[];} },
    _set: function(q){ try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch(e){} },
    push: function(e){ var q=this._get(); q.push(Object.assign({},e,{_at:Date.now()})); this._set(q); },
    flush: function() {
      var q=this._get(); if(!q.length) return;
      this._set([]);
      q.forEach(function(e){ _request(e.path,e.method,e.body,{_noRetry:true}).catch(function(){}); });
    },
    size: function(){ return this._get().length; },
  };

  // ── Connectivity ─────────────────────────────────────────────
  var _online = typeof navigator.onLine === 'undefined' ? true : navigator.onLine;
  global.addEventListener('online',  function(){ _online=true;  OfflineQueue.flush(); _emit('lux:online',{}); });
  global.addEventListener('offline', function(){ _online=false; _emit('lux:offline',{}); });

  function _emit(name, detail) {
    try { global.dispatchEvent(new CustomEvent(name,{detail:detail})); } catch(e) {}
  }

  // ── Metadata fingerprint ─────────────────────────────────────
  function _meta(path, method) {
    return { _src: PAGE_SOURCE, _v: VERSION, _ts: Date.now(), _path: path, _m: method };
  }

  // ── Fetch with retry ─────────────────────────────────────────
  function _fetchWithRetry(url, cfg, retries) {
    return fetch(url, cfg).catch(function(err) {
      if (retries <= 1) throw err;
      return new Promise(function(r){ setTimeout(r, (4-retries)*800); })
        .then(function(){ return _fetchWithRetry(url, cfg, retries-1); });
    });
  }

  // ── WhatsApp fallback ────────────────────────────────────────
  function _waFallback(body, type) {
    try {
      var msg;
      if (type === 'order') {
        var items = (body.items||[]).map(function(i){ return (i.qty||i.q||1)+'x '+(i.name||i.n)+' ('+(i.price||i.p)+' DH)'; }).join(', ');
        var c = body.customer||{}; var name=(typeof c==='string')?c:(c.name||'?'); var phone=(c.phone||body.phone||'?');
        msg = '\u{1F6D2} COMMANDE (hors-ligne)\n\nClient: '+name+' ('+phone+')\nSource: '+PAGE_SOURCE+'\nArticles: '+(items||'—')+'\nTotal: '+(body.total||0)+' DH\nPaiement: '+(body.payMethod||'?')+'\n\n\u26A0\uFE0F Mode hors-ligne — confirmer SVP';
      } else {
        msg = '\u{1F4C5} RÉSERVATION (hors-ligne)\n\nNom: '+(body.name||'?')+'\nTél: '+(body.phone||'?')+'\nDate: '+(body.date||'?')+' à '+(body.time||'?')+'\nPersonnes: '+(body.guests||2);
      }
      setTimeout(function(){ global.open('https://wa.me/'+WA_NUMBER+'?text='+encodeURIComponent(msg),'_blank'); }, 400);
    } catch(e) {}
  }

  // ── Core request ─────────────────────────────────────────────
  function _request(path, method, body, opts) {
    method = (method||'GET').toUpperCase();
    opts   = opts || {};
    var url  = API_BASE + path;
    var cKey = method + ':' + url;

    // Return from cache for GET
    if (method==='GET' && opts.ttl!==0) {
      var cached = Cache.get(cKey);
      if (cached) return Promise.resolve(cached);
    }

    // Build headers
    var headers = { 'Content-Type':'application/json' };
    var tok = TokenStore.get();
    if (tok) headers['Authorization'] = 'Bearer ' + tok;

    // Attach metadata to write operations
    var payload = null;
    if (body) {
      payload = (method!=='GET' && method!=='DELETE')
        ? Object.assign({}, body, { _meta: _meta(path, method) })
        : body;
    }

    var cfg = { method:method, headers:headers };
    if (payload) cfg.body = JSON.stringify(payload);

    // Queue if offline (mutations only)
    if (!_online && method!=='GET') {
      OfflineQueue.push({ path:path, method:method, body:body });
      if (path.indexOf('/orders')!==-1 && body)      _waFallback(body,'order');
      if (path.indexOf('/reservations')!==-1 && body) _waFallback(body,'reservation');
      var offErr = new Error('offline'); offErr.status=0; offErr._offline=true;
      return Promise.reject(offErr);
    }

    var retries = opts._noRetry ? 1 : 3;

    return _fetchWithRetry(url, cfg, retries)
      .then(function(res) {
        return res.json().catch(function(){ return {}; }).then(function(data) {
          if (!res.ok) {
            if (res.status===401) { TokenStore.clear(); _emit('lux:unauthorized',{path:path}); }
            var err = new Error(data.error||data.message||'HTTP '+res.status);
            err.status=res.status; err.data=data; err._lux=true;
            throw err;
          }
          if (method==='GET' && opts.ttl!==0) Cache.set(cKey, data, opts.ttl||900000);
          if (method!=='GET') {
            var seg = path.split('/').filter(Boolean);
            if (seg.length>=2) Cache.del('GET:'+API_BASE+'/'+seg.slice(0,2).join('/'));
          }
          return data;
        });
      })
      .catch(function(err) {
        // Network down on mutation → queue it
        if (!err._lux && method!=='GET') {
          OfflineQueue.push({ path:path, method:method, body:body });
          if (path.indexOf('/orders')!==-1 && body)       _waFallback(body,'order');
          if (path.indexOf('/reservations')!==-1 && body)  _waFallback(body,'reservation');
        }
        // Serve stale GET cache
        if (method==='GET') {
          var stale = Cache.get(cKey);
          if (stale) return stale;
        }
        throw err;
      });
  }

  // ── Endpoint map ─────────────────────────────────────────────
var EP = {
    LOGIN:'api/auth/login', // 👈 هنا المشكلة (مفقود حرف الشرطة المائلة /)
    PIN_LOGIN:'/api/auth/pin',
    GOOGLE_LOGIN: '/api/auth/google',
    ME:'/api/auth/me',
    CATEGORIES:'/api/categories', PRODUCTS:'/api/products', MENU:'/api/menu',
    ORDERS:'/api/orders',
    ORDER:        function(id){ return '/api/orders/'+id; },
    ORDER_STATUS: function(id){ return '/api/orders/'+id+'/status'; },
    RESERVATIONS:'/api/reservations',
    RESERVATION:  function(id){ return '/api/reservations/'+id; },
    RESERVATION_STATUS: function(id){ return '/api/reservations/'+id+'/status'; },
    STATIONS:'/api/gaming/stations',
    STATION:  function(id){ return '/api/gaming/stations/'+id; },
    ACTIVATE:'/api/gaming/activate',
    CONFIRM:    function(id){ return '/api/gaming/stations/'+id+'/confirm'; },
    DEACTIVATE: function(id){ return '/api/gaming/stations/'+id+'/deactivate'; },
    GAMING_STATS:'/api/gaming/stats', PRICING:'/api/gaming/pricing',
    DASHBOARD:'/api/dashboard', STATS:'/api/stats',
    CUSTOMERS:'/api/customers', CUSTOMER:function(id){ return '/api/customers/'+id; },
    EMPLOYEES:'/api/employees', EMPLOYEE:function(id){ return '/api/employees/'+id; },
    TRANSACTIONS:'/api/transactions', TX_WEB:'/api/transactions/web',
    STOCK:'/api/stock', SAAS_LEADS:'/api/saas/register-lead',
    AI_CHAT:'/api/ai/chat', AI_INSIGHTS:'/api/ai/insights',
    VERIFY_PAYMENT:'/api/gaming/verify-payment',
    STRIPE_INTENT:'/api/stripe/create-intent',
  };

  // ── Public API ───────────────────────────────────────────────
  var LuxAPI = {
    // HTTP
    get:    function(p,o)  { return _request(p,'GET',null,o); },
    post:   function(p,b)  { return _request(p,'POST',b); },
    patch:  function(p,b)  { return _request(p,'PATCH',b); },
    put:    function(p,b)  { return _request(p,'PUT',b); },
    delete: function(p)    { return _request(p,'DELETE'); },
    // Auth
    loginPin: function(pin) {
      return _request(EP.PIN_LOGIN,'POST',{pin:pin}).then(function(d){
        if(d&&d.token) TokenStore.set(d.token); return d;
      });
    },
    logout:          function()  { TokenStore.clear(); _emit('lux:logout',{}); },
    isAuthenticated: function()  { return TokenStore.valid(); },
    getToken:        function()  { return TokenStore.get(); },
    setToken:        function(t) { TokenStore.set(t); },
    // Convenience
    getMenu:    function()    { return _request(EP.MENU,'GET',null,{ttl:1800000}); },
    createOrder:function(b)   { return _request(EP.ORDERS,'POST',Object.assign({},b,{source:b.source||PAGE_SOURCE})); },
    getOrders:  function(p)   { var q=p?'?'+new URLSearchParams(p):''; return _request(EP.ORDERS+q,'GET',null,{ttl:0}); },
    updateOrderStatus: function(id,s){ return _request(EP.ORDER_STATUS(id),'PATCH',{status:s}); },
    createReservation: function(b) {
      return _request(EP.RESERVATIONS,'POST',b).catch(function(e){
        if(e._offline||e.status===0) _waFallback(b,'reservation'); throw e;
      });
    },
    getReservations: function(d)  { var q=d?'?date='+d:''; return _request(EP.RESERVATIONS+q,'GET',null,{ttl:120000}); },
    getStations:     function()   { return _request(EP.STATIONS,'GET',null,{ttl:0}); },
    activateStation: function(b)  { return _request(EP.ACTIVATE,'POST',b); },
    confirmStation:  function(id) { return _request(EP.CONFIRM(id),'POST'); },
    deactivateStation:function(id){ return _request(EP.DEACTIVATE(id),'POST'); },
    getStats:  function() {
      var p = TokenStore.get() ? EP.DASHBOARD : EP.STATS;
      return _request(p,'GET',null,{ttl:15000});
    },
    upsertCustomer: function(b) { return _request(EP.CUSTOMERS,'POST',b); },
    registerLead:   function(b) { return _request(EP.SAAS_LEADS,'POST',b); },
    aiChat: function(msg,lang)  { return _request(EP.AI_CHAT,'POST',{message:msg,lang:lang||'fr'}); },
    // Offline
    waFallback:  _waFallback,
    flushQueue:  function() { OfflineQueue.flush(); },
    queueSize:   function() { return OfflineQueue.size(); },
    // Cache
    invalidate:  function(p) { Cache.del(p); },
    clearCache:  function()  { Cache._d={}; try{localStorage.removeItem(CACHE_KEY);}catch(e){} },
    // Status
    isOnline:    function()  { return _online; },
    getSource:   function()  { return PAGE_SOURCE; },
    version:     VERSION,
    BASE_URL:    API_BASE,
    EP:          EP,
  };

  global.LuxAPI   = LuxAPI;
  global.EP       = EP;
  global.BASE_URL = API_BASE;

  // Auto-flush on load
  if (_online && OfflineQueue.size()>0) setTimeout(function(){ OfflineQueue.flush(); }, 1000);

  // UI badge wiring
  global.addEventListener('lux:offline', function(){
    var el=document.getElementById('lux-online-badge');
    if(el){el.textContent='⚠️ Hors ligne';el.style.background='#E74C3C';el.style.display='flex';}
  });
  global.addEventListener('lux:online', function(){
    var el=document.getElementById('lux-online-badge');
    if(el) el.style.display='none';
  });

  console.log('[LUX API] v'+VERSION+' · source:'+PAGE_SOURCE+' · online:'+_online+' · queue:'+OfflineQueue.size());

}(window));
