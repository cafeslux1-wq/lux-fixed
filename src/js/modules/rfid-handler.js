/**
 * rfid-handler.js — RFID Card Reader — MAESTRO V12
 * Deps: getLS, setLS, toast, caisse, renderTicket, today
 */

const RFID_MAX_GAP_MS = 400;

function addManualRFID(){
  const uid = prompt('Code UID de la carte/bracelet:');
  if(!uid) return;
  const name = prompt('Nom du client:');
  if(!name) return;
  const phone = prompt('Telephone:') || '';
  const c = getLS('lux_clients_rfid',{});
  c[uid.toUpperCase()] = {uid:uid.toUpperCase(),name,phone,points:0,visits:0,since:today()};
  setLS('lux_clients_rfid',c);
  renderAdminClients();
  toast('Client RFID ajoute!');
}


let rfidBuffer = '';
let rfidTimer = null;
document.addEventListener('keydown', function(e){
  const tag = document.activeElement ? document.activeElement.tagName : '';
  if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT') return;
  if(e.key==='Enter'){
    if(rfidBuffer.length >= 4) handleRFID(rfidBuffer.trim().toUpperCase());
    rfidBuffer=''; clearTimeout(rfidTimer);
  } else if(e.key.length===1){
    rfidBuffer += e.key;
    clearTimeout(rfidTimer);
    rfidTimer = setTimeout(function(){ rfidBuffer=''; },400);
  }
});

function handleRFID(uid){
  const clients = getLS('lux_clients_rfid',{});
  if(clients[uid]){
    caisse.currentClient = clients[uid];
    toast('✅ Bienvenue ' + clients[uid].name + '!');
    renderTicket();
  } else {
    toast('📡 Nouvelle carte: ' + uid);
    const name = prompt('Nouvelle carte RFID: ' + uid + '\nNom du client:');
    if(!name) return;
    const phone = prompt('Telephone:') || '';
    clients[uid] = {uid,name,phone,points:0,visits:0,since:today()};
    setLS('lux_clients_rfid', clients);
    caisse.currentClient = clients[uid];
    renderTicket();
    toast('✅ ' + name + ' enregistre!');
  }
}

// ══════════════════════════
//  PAGE: COMMANDES WEB


window.handleRFID    = handleRFID;
window.addManualRFID = addManualRFID;
