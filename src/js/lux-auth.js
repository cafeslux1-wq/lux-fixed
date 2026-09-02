/* ─────────────────────────────────────────────────────────────
 * lux-auth.js — Deux jetons, deux mondes
 *
 * Le site fait cohabiter deux publics sur le même navigateur :
 *
 *   · le CLIENT   — « Mon Espace », menu, suivi de commande
 *   · le PERSONNEL — POS, KDS, dashboard, livreur, Carte LUX
 *
 * Jusqu'ici les deux écrivaient dans la même case 'lux_token'.
 * Un serveur qui consultait son solde client écrasait donc son
 * jeton employé, et se retrouvait avec « Accès refusé » sur la
 * caisse sans comprendre pourquoi. Le contraire arrivait aussi :
 * un client sur la tablette du café héritait d'un jeton staff.
 *
 * Ici : deux clés distinctes, et une migration automatique de
 * l'ancienne clé vers la bonne case selon le rôle inscrit dans
 * le jeton lui-même.
 *
 *   <script src="../src/js/lux-auth.js"></script>
 *
 *   LuxAuth.staff.get()            // jeton employé ou ''
 *   LuxAuth.staff.set(token)
 *   LuxAuth.customer.get()         // jeton client ou ''
 *   LuxAuth.role(token)            // 'ADMIN' | 'CUSTOMER' | null
 *   LuxAuth.staff.headers()        // { Authorization: 'Bearer …' }
 * ───────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';

  var STAFF_KEY = 'lux_staff_token';
  var CUSTOMER_KEY = 'lux_customer_token';
  var LEGACY_KEYS = ['lux_token', 'admin_token', 'maestro_token'];

  var STAFF_ROLES = ['ADMIN', 'MANAGER', 'CASHIER', 'KITCHEN', 'STAFF'];

  function read(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function write(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function drop(k) { try { localStorage.removeItem(k); } catch (e) {} }

  // Un JWT porte son rôle en clair dans la charge utile. On le lit
  // sans vérifier la signature : c'est le serveur qui valide. Ici on
  // veut seulement savoir DANS QUELLE CASE ranger le jeton.
  function role(token) {
    var t = token || '';
    if (!t || t.indexOf('.') === -1) return null;
    try {
      var part = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      var pad = part.length % 4 ? new Array(5 - (part.length % 4)).join('=') : '';
      var payload = JSON.parse(atob(part + pad));
      return (payload.role || '').toUpperCase() || null;
    } catch (e) {
      return null;
    }
  }

  // Un jeton expiré vaut un jeton absent : autant le supprimer tout
  // de suite plutôt que de laisser l'utilisateur découvrir le
  // problème au milieu d'un encaissement.
  function expired(token) {
    var t = token || '';
    if (!t || t.indexOf('.') === -1) return true;
    try {
      var part = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      var pad = part.length % 4 ? new Array(5 - (part.length % 4)).join('=') : '';
      var exp = JSON.parse(atob(part + pad)).exp;
      return exp ? (Date.now() / 1000) > exp : false;
    } catch (e) {
      return false;
    }
  }

  function bucket(key, expectStaff) {
    return {
      key: key,
      get: function () {
        var t = read(key);
        if (t && expired(t)) { drop(key); return ''; }
        return t;
      },
      set: function (t) {
        if (!t) return drop(key);
        var r = role(t);
        // On refuse de ranger un jeton dans la mauvaise case : c'est
        // exactement l'erreur que ce module existe pour empêcher.
        var isStaff = r ? STAFF_ROLES.indexOf(r) !== -1 : expectStaff;
        if (isStaff !== expectStaff) {
          console.warn('[LuxAuth] jeton de rôle', r, 'refusé pour la case', key);
          return;
        }
        write(key, t);
      },
      clear: function () { drop(key); },
      role: function () { return role(read(key)); },
      headers: function () {
        var t = this.get();
        return t ? { Authorization: 'Bearer ' + t } : {};
      },
    };
  }

  var staff = bucket(STAFF_KEY, true);
  var customer = bucket(CUSTOMER_KEY, false);

  // ── Migration ────────────────────────────────────────────
  // Les appareils déjà en service portent un jeton dans l'ancienne
  // clé. On le déplace vers la bonne case d'après son rôle, une
  // seule fois, sans déconnecter personne. Les jetons factices
  // hérités du mode hors ligne ('maestro_session_bypass') sont
  // supprimés : ils ne valent rien côté serveur.
  (function migrate() {
    LEGACY_KEYS.forEach(function (k) {
      var t = read(k);
      if (!t) return;
      drop(k);

      if (t.indexOf('.') === -1) return;      // pas un JWT → poubelle
      if (expired(t)) return;

      var r = role(t);
      if (r && STAFF_ROLES.indexOf(r) !== -1) {
        if (!read(STAFF_KEY)) write(STAFF_KEY, t);
      } else if (r === 'CUSTOMER') {
        if (!read(CUSTOMER_KEY)) write(CUSTOMER_KEY, t);
      }
    });
  })();

  global.LuxAuth = {
    staff: staff,
    customer: customer,
    role: role,
    expired: expired,
    STAFF_ROLES: STAFF_ROLES,

    // Déconnexion complète (bouton « quitter » d'un poste partagé)
    clearAll: function () {
      staff.clear();
      customer.clear();
      LEGACY_KEYS.forEach(drop);
    },
  };
})(window);
