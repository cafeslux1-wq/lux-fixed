// ═══════════════════════════════════════════════════════════════
//  POS FOCUS MODE — Café LUX v3.2
//  Add this script to cafe-lux.html before </body>
//  When mode=pos&focus=1, hides: Accueil, Administration, Employes, Site Public
// ═══════════════════════════════════════════════════════════════
(function(){
  'use strict';
  var params = new URLSearchParams(window.location.search);
  var mode = params.get('mode');
  var focus = params.get('focus');
  
  // Also check localStorage flag
  var posFlag = localStorage.getItem('lux_pos_focus');
  
  if(mode === 'pos' && (focus === '1' || posFlag === '1')){
    function hidePOSNav(){
      // Hide navigation buttons that shouldn't appear in POS
      var hideLabels = ['accueil','administration','admin','employes','employés','site public','site','home'];
      var allBtns = document.querySelectorAll('button, a, .nav-btn, .tab-btn, [role="tab"]');
      allBtns.forEach(function(btn){
        var text = (btn.textContent || '').trim().toLowerCase();
        var dataMode = (btn.getAttribute('data-mode') || '').toLowerCase();
        for(var i = 0; i < hideLabels.length; i++){
          if(text.indexOf(hideLabels[i]) !== -1 || dataMode === hideLabels[i]){
            btn.style.display = 'none';
            break;
          }
        }
      });
      
      // Also inject a CSS rule to hide by common selectors
      var style = document.createElement('style');
      style.textContent = [
        '.nav-home, .nav-admin, .nav-staff, .nav-public,',
        '[data-tab="home"], [data-tab="admin"], [data-tab="staff"], [data-tab="public"],',
        '[data-mode="home"], [data-mode="admin"], [data-mode="staff"],',
        '.btn-accueil, .btn-admin, .btn-employes, .btn-public',
        '{ display: none !important; }'
      ].join('');
      document.head.appendChild(style);
    }
    
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', function(){ setTimeout(hidePOSNav, 200); });
    } else {
      setTimeout(hidePOSNav, 200);
    }
  }
  
  // Clean up POS flag when leaving
  window.addEventListener('beforeunload', function(){
    if(mode !== 'pos') localStorage.removeItem('lux_pos_focus');
  });
})();
