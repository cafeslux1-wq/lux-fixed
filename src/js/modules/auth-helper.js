/**
 * auth-helper.js — Auth & Staff — MAESTRO V12
 * Deps: getLS, setLS, toast, EMPLOYEES_DEFAULT, showPage, renderAdmin
 */

// ── Staff Management ──────────────────────────────────────────
function renderStaff(){
  const employees = getLS('lux_employees', EMPLOYEES_DEFAULT);
  const presences = getLS('lux_presences',{});
  const payroll = getLS('lux_payroll',{});
  const el = document.getElementById('staff-grid');
  if(!el) return;
  
  const active = employees.filter(function(e){return presences[e.id+'_'+today()]&&presences[e.id+'_'+today()].in;}).length;
  setEl('st-total', employees.length);
  setEl('st-present', active);
  setEl('st-absent', employees.length - active);

  let h = '';
  employees.forEach(function(emp){
    const pKey = emp.id + '_' + today();
    const presence = presences[pKey] || {};
    const isIn = !!presence.in;
    const pay = payroll[emp.id] || {};
    const salary = Number(pay.salary || emp.salary || 0);
    const avances = Number(pay.avances || 0);
    const primes = Number(pay.primes || 0);
    const deductions = Number(pay.deductions || 0);
    const net = salary + primes - avances - deductions;

    h += '<div class="staff-card" style="position:relative">';
    // Avatar + Badge
    h += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">';
    h += '<div class="staff-av">' + (emp.initials||emp.name.slice(0,2).toUpperCase()) + '</div>';
    h += '<div style="flex:1">';
    h += '<div class="staff-name">' + emp.name + '</div>';
    h += '<div class="staff-role">' + (emp.role||'—') + '</div>';
    h += '</div>';
    h += '<span class="badge ' + (emp.status==='off'?'r':'g') + '">' + (emp.status==='off'?'Inactif':'Actif') + '</span>';
    h += '</div>';

    // Personal info
    h += '<div style="font-size:10px;color:var(--muted);line-height:2;margin-bottom:10px;border-top:1px solid var(--border);padding-top:8px">';
    h += '📞 ' + (emp.phone||'Non renseigné') + '<br>';
    h += '🪪 CIN: ' + (emp.cin||'—') + '<br>';
    h += '📍 ' + (emp.address||'—') + '<br>';
    h += '📅 Depuis: ' + (emp.since||'—');
    h += '</div>';

    // Financial section
    h += '<div style="background:rgba(201,168,76,.06);border:1px solid rgba(201,168,76,.15);border-radius:10px;padding:10px;margin-bottom:10px">';
    h += '<div style="font-size:9px;color:var(--gold);font-weight:600;letter-spacing:1px;margin-bottom:8px">💰 COMPTE FINANCIER</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px">';
    h += '<div>Salaire de base</div><div style="text-align:right;color:var(--gold);font-weight:600">' + salary.toLocaleString() + ' DH</div>';
    h += '<div>Avances/Tisbiqat</div><div style="text-align:right;color:var(--red)">-' + avances.toLocaleString() + ' DH</div>';
    h += '<div>Primes/Bonus</div><div style="text-align:right;color:var(--green)">+' + primes.toLocaleString() + ' DH</div>';
    h += '<div>Deductions</div><div style="text-align:right;color:var(--red)">-' + deductions.toLocaleString() + ' DH</div>';
    h += '</div>';
    h += '<div style="border-top:1px solid rgba(201,168,76,.2);margin-top:8px;padding-top:6px;display:flex;justify-content:space-between;font-weight:700;font-size:12px">';
    h += '<span>Net a payer</span><span style="color:' + (net>=0?'var(--green)':'var(--red)') + '">' + net.toLocaleString() + ' DH</span>';
    h += '</div></div>';

    // Presence
    if(presence.in) h += '<div style="font-size:10px;color:var(--green);margin-bottom:4px">🟢 Arrive: ' + presence.in + '</div>';
    if(presence.out) h += '<div style="font-size:10px;color:var(--red);margin-bottom:4px">🔴 Parti: ' + presence.out + '</div>';

    // Action buttons
    h += '<button class="presence-btn ' + (isIn&&!presence.out?'out':'in') + '" data-eid="' + emp.id + '" data-ein="' + (isIn?'1':'0') + '" onclick="togglePresence(this)">';
    h += isIn && !presence.out ? '🔴 Marquer depart' : '🟢 Marquer arrivee';
    h += '</button>';
    h += '<div style="display:flex;gap:6px;margin-top:8px">';
    h += '<button class="btn sm" data-eid="' + emp.id + '" onclick="openEditEmployee(\'' + emp.id + '\')" style="flex:1">✏ Modifier</button>';
    h += '<button class="btn sm" data-eid="' + emp.id + '" onclick="openPayroll(\'' + emp.id + '\')" style="flex:1;border-color:var(--green);color:var(--green)">💰 Finances</button>';
    h += '</div>';
    h += '</div>';
  });
  el.innerHTML = h;
}

function togglePresence(btn){
  const eid = btn.getAttribute('data-eid');
  const isIn = btn.getAttribute('data-ein') === '1';
  const presences = getLS('lux_presences',{});
  const pKey = eid + '_' + today();
  if(!presences[pKey]) presences[pKey] = {};
  if(!isIn){ presences[pKey].in = now(); }
  else { presences[pKey].out = now(); }
  setLS('lux_presences', presences);
  renderStaff();
  toast(isIn ? '🔴 Depart enregistre' : '🟢 Arrivee enregistree');
  if(window.LuxAPI) LuxAPI.logAttendance(eid, isIn?'out':'in').catch(function(){});
}

// ── Employee Edit Modal (replaces prompt-based editing) ──
function openEditEmployee(eid){
  const emps = getLS('lux_employees', EMPLOYEES_DEFAULT);
  const emp = emps.find(function(e){return e.id===eid;});
  if(!emp) return;
  var html = '<div style="position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px" id="emp-modal" onclick="if(event.target===this)this.remove()">'
    +'<div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;padding:24px;width:100%;max-width:460px;max-height:85vh;overflow-y:auto">'
    +'<div style="font-family:Playfair Display,serif;color:var(--gold);font-size:16px;margin-bottom:16px">✏ Modifier — '+emp.name+'</div>'
    +'<div style="display:grid;gap:10px">'
    +'<div><label style="font-size:10px;color:var(--muted)">Nom complet</label><input id="em-name" value="'+esc(emp.name)+'" style="width:100%;padding:9px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;outline:none"></div>'
    +'<div><label style="font-size:10px;color:var(--muted)">Role</label><input id="em-role" value="'+esc(emp.role||'')+'" style="width:100%;padding:9px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;outline:none"></div>'
    +'<div><label style="font-size:10px;color:var(--muted)">Telephone</label><input id="em-phone" value="'+esc(emp.phone||'')+'" style="width:100%;padding:9px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;outline:none"></div>'
    +'<div><label style="font-size:10px;color:var(--muted)">CIN (Carte Nationale)</label><input id="em-cin" value="'+esc(emp.cin||'')+'" style="width:100%;padding:9px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;outline:none;text-transform:uppercase"></div>'
    +'<div><label style="font-size:10px;color:var(--muted)">Adresse</label><input id="em-addr" value="'+esc(emp.address||'')+'" style="width:100%;padding:9px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;outline:none"></div>'
    +'<div><label style="font-size:10px;color:var(--muted)">Salaire de base (DH)</label><input id="em-salary" type="number" value="'+(emp.salary||0)+'" style="width:100%;padding:9px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;outline:none"></div>'
    +'</div>'
    +'<div style="display:flex;gap:8px;margin-top:16px">'
    +'<button class="btn" onclick="document.getElementById(\'emp-modal\').remove()" style="flex:1">Annuler</button>'
    +'<button class="btn solid" onclick="saveEditEmployee(\''+eid+'\')" style="flex:1">💾 Enregistrer</button>'
    +'</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function saveEditEmployee(eid){
  var emps = getLS('lux_employees', EMPLOYEES_DEFAULT);
  var emp = emps.find(function(e){return e.id===eid;});
  if(!emp) return;
  emp.name = document.getElementById('em-name').value.trim() || emp.name;
  emp.role = document.getElementById('em-role').value.trim() || emp.role;
  emp.phone = document.getElementById('em-phone').value.trim();
  emp.cin = document.getElementById('em-cin').value.trim().toUpperCase();
  emp.address = document.getElementById('em-addr').value.trim();
  emp.salary = Number(document.getElementById('em-salary').value) || emp.salary || 0;
  emp.initials = emp.name.split(' ').map(function(x){return x[0]||'';}).join('').slice(0,2).toUpperCase();
  setLS('lux_employees', emps);
  document.getElementById('emp-modal').remove();
  renderStaff();
  toast('✅ ' + emp.name + ' modifie');
  if(window.LuxAPI) LuxAPI.updateEmployee(eid, emp).catch(function(){});
}

// ── Payroll Modal ──
function openPayroll(eid){
  var emps = getLS('lux_employees', EMPLOYEES_DEFAULT);
  var emp = emps.find(function(e){return e.id===eid;});
  if(!emp) return;
  var payroll = getLS('lux_payroll',{});
  var pay = payroll[eid] || {};
  var html = '<div style="position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px" id="pay-modal" onclick="if(event.target===this)this.remove()">'
    +'<div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;padding:24px;width:100%;max-width:420px">'
    +'<div style="font-family:Playfair Display,serif;color:var(--gold);font-size:16px;margin-bottom:16px">💰 Finances — '+emp.name+'</div>'
    +'<div style="display:grid;gap:10px">'
    +'<div><label style="font-size:10px;color:var(--muted)">Salaire de base (DH)</label><input id="py-sal" type="number" value="'+(pay.salary||emp.salary||0)+'" style="width:100%;padding:9px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;outline:none"></div>'
    +'<div><label style="font-size:10px;color:var(--muted)">Avances / Tisbiqat (DH)</label><input id="py-av" type="number" value="'+(pay.avances||0)+'" style="width:100%;padding:9px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;outline:none"></div>'
    +'<div><label style="font-size:10px;color:var(--muted)">Primes / Bonus (DH)</label><input id="py-pr" type="number" value="'+(pay.primes||0)+'" style="width:100%;padding:9px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;outline:none"></div>'
    +'<div><label style="font-size:10px;color:var(--muted)">Deductions / Sanctions (DH)</label><input id="py-ded" type="number" value="'+(pay.deductions||0)+'" style="width:100%;padding:9px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;outline:none"></div>'
    +'<div><label style="font-size:10px;color:var(--muted)">Note</label><input id="py-note" value="'+esc(pay.note||'')+'" style="width:100%;padding:9px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;outline:none"></div>'
    +'</div>'
    +'<div style="display:flex;gap:8px;margin-top:16px">'
    +'<button class="btn" onclick="document.getElementById(\'pay-modal\').remove()" style="flex:1">Annuler</button>'
    +'<button class="btn solid" onclick="savePayroll(\''+eid+'\')" style="flex:1">💾 Enregistrer</button>'
    +'</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function savePayroll(eid){
  var payroll = getLS('lux_payroll',{});
  payroll[eid] = {
    salary: Number(document.getElementById('py-sal').value)||0,
    avances: Number(document.getElementById('py-av').value)||0,
    primes: Number(document.getElementById('py-pr').value)||0,
    deductions: Number(document.getElementById('py-ded').value)||0,
    note: document.getElementById('py-note').value.trim(),
    updated: new Date().toISOString()
  };
  setLS('lux_payroll', payroll);
  document.getElementById('pay-modal').remove();
  renderStaff();
  toast('✅ Donnees financieres enregistrees');
  if(window.LuxAPI) LuxAPI.addPayrollEntry({empId:eid,...payroll[eid]}).catch(function(){});
}

function editEmployee(btn){ openEditEmployee(btn.getAttribute('data-eid')); }

function addEmployee(){
  var html = '<div style="position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px" id="add-modal" onclick="if(event.target===this)this.remove()">'
    +'<div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;padding:24px;width:100%;max-width:420px">'
    +'<div style="font-family:Playfair Display,serif;color:var(--gold);font-size:16px;margin-bottom:16px">+ Nouvel Employe</div>'
    +'<div style="display:grid;gap:10px">'
    +'<div><label style="font-size:10px;color:var(--muted)">Nom complet *</label><input id="na-name" style="width:100%;padding:9px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;outline:none"></div>'
    +'<div><label style="font-size:10px;color:var(--muted)">Role *</label><input id="na-role" placeholder="Serveur, Barista, Caissier..." style="width:100%;padding:9px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;outline:none"></div>'
    +'<div><label style="font-size:10px;color:var(--muted)">Telephone</label><input id="na-phone" style="width:100%;padding:9px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;outline:none"></div>'
    +'<div><label style="font-size:10px;color:var(--muted)">CIN</label><input id="na-cin" style="width:100%;padding:9px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;outline:none;text-transform:uppercase"></div>'
    +'<div><label style="font-size:10px;color:var(--muted)">Salaire (DH)</label><input id="na-salary" type="number" value="1300" style="width:100%;padding:9px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;outline:none"></div>'
    +'</div>'
    +'<div style="display:flex;gap:8px;margin-top:16px">'
    +'<button class="btn" onclick="document.getElementById(\'add-modal\').remove()" style="flex:1">Annuler</button>'
    +'<button class="btn solid" onclick="saveNewEmployee()" style="flex:1">✓ Ajouter</button>'
    +'</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function saveNewEmployee(){
  var name = document.getElementById('na-name').value.trim();
  if(!name){toast('⚠ Nom requis');return;}
  var emps = getLS('lux_employees', EMPLOYEES_DEFAULT);
  var newEmp = {
    id: 'E' + (Date.now()%100000),
    name: name,
    initials: name.split(' ').map(function(x){return x[0]||'';}).join('').slice(0,2).toUpperCase(),
    role: document.getElementById('na-role').value.trim()||'Service',
    phone: document.getElementById('na-phone').value.trim(),
    cin: document.getElementById('na-cin').value.trim().toUpperCase(),
    salary: Number(document.getElementById('na-salary').value)||1300,
    status:'active', since: today(), address:''
  };
  emps.push(newEmp);
  setLS('lux_employees', emps);
  document.getElementById('add-modal').remove();
  renderStaff();
  toast('✅ ' + name + ' ajoute!');
  if(window.LuxAPI) LuxAPI.createEmployee(newEmp).catch(function(){});
}


// ── PIN Auth System ───────────────────────────────────────────
<script>
// ═══════════════════════════════════════════════════════════════
// FIX 11 · EMPLOYEE AUTH CONTROLLER (PIN + RFID)
// ═══════════════════════════════════════════════════════════════
(function(){
  'use strict';

  var _pinBuffer = '';
  var _rfidBuffer = '';
  var _rfidLastKeyTs = 0;
  var _rfidActive = false;
  // Any key-gap longer than this (ms) → human typing, reset buffer.
  // HID keyboard emulators typically emit keys < 15ms apart.
  var RFID_MAX_GAP_MS = 40;
  var RFID_MIN_LENGTH = 4;
  var _authRequired = false;   // set by init based on mode

  function $(id){ return document.getElementById(id); }

  function setErr(msg){
    var el = $('emp-auth-err');
    if(el) el.textContent = msg || '';
  }

  function renderPinDots(){
    var dots = document.querySelectorAll('#emp-pin-dots .emp-pin-dot');
    dots.forEach(function(d, i){
      d.classList.toggle('filled', i < _pinBuffer.length);
    });
  }

  window.empAuthTab = function(method){
    document.querySelectorAll('.emp-auth-tab').forEach(function(t){
      t.classList.toggle('active', t.getAttribute('data-method') === method);
    });
    document.querySelectorAll('.emp-auth-panel').forEach(function(p){
      p.classList.remove('active');
    });
    var panel = $('emp-auth-' + method);
    if(panel) panel.classList.add('active');
    setErr('');
    if(method === 'pin'){ _pinBuffer = ''; renderPinDots(); }
  };

  window.empPinPress = function(n){
    if(_pinBuffer.length >= 6) return;
    _pinBuffer += n;
    renderPinDots();
    setErr('');
    // Auto-submit when 4 digits entered
    if(_pinBuffer.length === 4) setTimeout(empPinSubmit, 200);
  };

  window.empPinClear = function(){
    _pinBuffer = '';
    renderPinDots();
    setErr('');
  };

  window.empPinSubmit = async function(){
    if(_pinBuffer.length < 4){ setErr('PIN trop court (min 4 chiffres)'); return; }
    if(typeof LuxAPI === 'undefined'){ setErr('API client indisponible'); return; }
    try {
      var emp = await LuxAPI.loginEmployeePIN(_pinBuffer);
      _onAuthSuccess(emp);
    } catch(e){
      setErr(e.message || 'PIN invalide');
      _pinBuffer = '';
      renderPinDots();
    }
  };

  async function _handleRFIDScan(uid){
    if(typeof LuxAPI === 'undefined'){ setErr('API client indisponible'); return; }
    try {
      var emp = await LuxAPI.loginEmployeeRFID(uid);
      _onAuthSuccess(emp);
    } catch(e){
      setErr(e.message || 'Badge non reconnu');
    }
  }

  function _onAuthSuccess(emp){
    setErr('');
    if(typeof toast === 'function') toast('✓ Bienvenue ' + (emp.name || 'Employé'));
    _updateEmployeeBadge(emp);
    closeEmpAuth();
  }

  function _updateEmployeeBadge(emp){
    var badge = $('emp-badge');
    var nameEl = $('emp-badge-name');
    if(badge && nameEl){
      nameEl.textContent = (emp && emp.name) ? emp.name : '—';
      badge.style.display = emp ? 'inline-flex' : 'none';
    }
  }

  window.openEmpAuth = function(options){
    options = options || {};
    _pinBuffer = '';
    _rfidBuffer = '';
    renderPinDots();
    setErr('');
    if(options.sub) {
      var subEl = $('emp-auth-sub');
      if(subEl) subEl.textContent = options.sub;
    }
    var ov = $('emp-auth-ov');
    if(ov) ov.classList.add('open');
    // Focus hidden input to capture RFID keystrokes
    setTimeout(function(){
      var cap = $('emp-rfid-capture');
      if(cap) cap.focus();
    }, 50);
  };

  window.closeEmpAuth = function(){
    var ov = $('emp-auth-ov');
    if(ov) ov.classList.remove('open');
  };

  // Trigger switch from the topbar badge
  window.openSwitchEmployee = function(){
    if(typeof LuxAPI !== 'undefined') LuxAPI.switchEmployee();
    _updateEmployeeBadge(null);
    openEmpAuth({ sub: 'Changer d\'employé — scannez ou entrez votre PIN' });
  };

  // ═══════════════════════════════════════════════════════════════
  // RFID / DALLAS KEY — Global keystroke detector
  // ───────────────────────────────────────────────────────────────
  // The reader emits characters as fast HID keyboard keystrokes ending with Enter.
  // We distinguish reader from human by measuring inter-key gap (< 40ms = reader).
  // ═══════════════════════════════════════════════════════════════
  document.addEventListener('keydown', function(ev){
    // Only act when auth overlay is open OR when no input/textarea is focused
    var ov = $('emp-auth-ov');
    var overlayOpen = ov && ov.classList.contains('open');
    var active = document.activeElement;
    var typingInField = active && ['INPUT','TEXTAREA','SELECT'].indexOf(active.tagName) !== -1
                      && active.id !== 'emp-rfid-capture';
    if(!overlayOpen && typingInField) return; // don't hijack normal typing

    var now = Date.now();
    var gap = now - _rfidLastKeyTs;
    _rfidLastKeyTs = now;

    if(ev.key === 'Enter'){
      if(_rfidActive && _rfidBuffer.length >= RFID_MIN_LENGTH){
        ev.preventDefault();
        var uid = _rfidBuffer;
        _rfidBuffer = '';
        _rfidActive = false;
        // If overlay is closed and a reader scan arrived → open overlay with progress
        if(!overlayOpen) openEmpAuth({ sub: 'Badge détecté — vérification...' });
        _handleRFIDScan(uid);
      } else {
        _rfidBuffer = '';
        _rfidActive = false;
      }
      return;
    }

    // Only printable characters are part of a UID
    if(ev.key.length !== 1) return;

    // Gap test: small gap → reader is transmitting
    if(gap < RFID_MAX_GAP_MS){
      _rfidActive = true;
      _rfidBuffer += ev.key;
      if(_rfidBuffer.length > 64) _rfidBuffer = _rfidBuffer.slice(-64); // cap
    } else {
      // Either first key of a scan (ambiguous) or human typing
      _rfidActive = false;
      _rfidBuffer = ev.key; // start fresh; if next key comes fast → it's a reader
    }
  }, true);

  // ═══════════════════════════════════════════════════════════════
  // INIT — decide whether to require auth based on URL mode
  // ═══════════════════════════════════════════════════════════════
  function _needsAuth(mode){
    // POS + admin + staff + kds require employee auth; site and ext don't.
    var PROTECTED = ['pos','admin','staff','kds','stock','home'];
    return PROTECTED.indexOf(mode) !== -1;
  }

  window.addEventListener('DOMContentLoaded', function(){
    try {
      var params = new URLSearchParams(window.location.search);
      var mode = params.get('mode') || 'home';
      _authRequired = _needsAuth(mode);

      // Restore any existing employee session
      var existing = (typeof LuxAPI !== 'undefined') ? LuxAPI.currentEmployee() : null;
      if(existing){
        _updateEmployeeBadge(existing);
      } else if(_authRequired){
        // Show the auth overlay
        setTimeout(function(){ openEmpAuth({}); }, 150);
      }
    } catch(e){ console.warn('[LUX Auth]', e); }
  });

})();
</script>


// ── Exports ───────────────────────────────────────────────────
['renderStaff','togglePresence','openEditEmployee','saveEditEmployee',
 'openPayroll','savePayroll','editEmployee','addEmployee','saveNewEmployee'
].forEach(function(fn){ try{window[fn]=eval(fn);}catch(e){} });
