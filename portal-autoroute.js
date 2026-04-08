// ═══════════════════════════════════════════════════════════════
//  PORTAL AUTO-ROUTE — Café LUX v3.2
//  Add this script to portal.html <head> or before </body>
//  Handles ?mode=staff to bypass the choice screen
// ═══════════════════════════════════════════════════════════════
(function(){
  'use strict';
  var params = new URLSearchParams(window.location.search);
  var mode = params.get('mode');
  
  if(mode === 'staff'){
    // Auto-click the staff button or hide the gateway
    // Wait for DOM then trigger staff portal entry
    function autoEnterStaff(){
      // Strategy 1: Find and click the staff button
      var staffBtns = document.querySelectorAll('button, a, [onclick]');
      for(var i = 0; i < staffBtns.length; i++){
        var btn = staffBtns[i];
        var text = (btn.textContent || '').trim();
        var onclick = btn.getAttribute('onclick') || '';
        if(text.indexOf('STAFF') !== -1 || text.indexOf('بوابة الموظفين') !== -1 || 
           onclick.indexOf('staff') !== -1 || onclick.indexOf('employe') !== -1){
          btn.click();
          return;
        }
      }
      // Strategy 2: Hide the gateway/choice screen
      var gateway = document.querySelector('.portal-gateway, .gateway, .choice-screen, #portal-gateway');
      if(gateway){
        gateway.style.display = 'none';
      }
      // Strategy 3: Show staff content directly
      var staffSection = document.querySelector('#staff-section, .staff-portal, [data-mode="staff"], #tab-staff');
      if(staffSection){
        staffSection.style.display = 'block';
        staffSection.classList.add('active');
      }
    }
    
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', function(){
        setTimeout(autoEnterStaff, 100);
      });
    } else {
      setTimeout(autoEnterStaff, 100);
    }
  }
  
  // Also handle ?mode=admin
  if(mode === 'admin'){
    function autoEnterAdmin(){
      var adminBtns = document.querySelectorAll('button, a, [onclick]');
      for(var i = 0; i < adminBtns.length; i++){
        var btn = adminBtns[i];
        var text = (btn.textContent || '').trim();
        var onclick = btn.getAttribute('onclick') || '';
        if(text.indexOf('ADMIN') !== -1 || text.indexOf('نظام الإدارة') !== -1 || 
           onclick.indexOf('admin') !== -1){
          btn.click();
          return;
        }
      }
    }
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', function(){ setTimeout(autoEnterAdmin, 100); });
    } else {
      setTimeout(autoEnterAdmin, 100);
    }
  }
})();
