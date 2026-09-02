/* ─────────────────────────────────────────────────────────────
 * lux-orders.js — Le cycle de vie d'une commande, en un seul endroit
 *
 * Jusqu'ici chaque écran décidait seul de ce qu'il fallait faire
 * d'une commande : la cuisine la clôturait alors que le livreur
 * l'attendait, le client voyait « en préparation » une heure après
 * avoir été livré. Ce fichier définit LA règle, et les trois
 * écrans s'y conforment.
 *
 *   PENDING ──(admin valide l'espèce)──▶ APPROVED
 *   APPROVED ──(cuisine commence)─────▶ PREPARING
 *   PREPARING ──(cuisine a fini)──────▶ READY
 *
 *   READY, sur place / à emporter ────▶ COMPLETED   (cuisine : « Servie »)
 *   READY, livraison ─────────────────▶ DELIVERING  (livreur : « Je pars »)
 *   DELIVERING ───────────────────────▶ COMPLETED   (livreur : « Livrée »)
 *
 * Règle qui évite le conflit principal : une commande EN LIVRAISON
 * n'est jamais clôturée par la cuisine. Elle sort du tableau de la
 * cuisine dès qu'elle est prête, et c'est le livreur qui la termine.
 * Sinon la cuisine faisait disparaître du téléphone du livreur une
 * commande qu'il tenait dans les mains.
 *
 * Utilisation :
 *   <script src="../src/js/lux-orders.js"></script>
 *   LuxOrders.live({ apiBase: API, onChange: refresh });
 * ───────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';

  var STATUS = {
    PENDING:    { label: 'En attente de validation', color: '#d99a4a', step: 0 },
    APPROVED:   { label: 'Validée',                  color: '#c9a84c', step: 0 },
    PREPARING:  { label: 'En préparation',           color: '#c9a84c', step: 1 },
    READY:      { label: 'Prête',                    color: '#4ade80', step: 1 },
    DELIVERING: { label: 'En livraison',             color: '#4aa3d9', step: 2 },
    COMPLETED:  { label: 'Terminée',                 color: '#4ade80', step: 3 },
    CANCELLED:  { label: 'Annulée',                  color: '#d6544a', step: -1 },
  };

  // Une commande est une livraison si elle est marquée telle, ou si
  // elle porte une adresse. Les commandes créées avant l'ajout du
  // champ n'ont que l'adresse : les ignorer les rendait invisibles.
  function isDelivery(o) {
    if (!o) return false;
    return Boolean(o.isDelivery)
      || Boolean(o.deliveryAddress || o.address)
      || /livr|delivery/i.test(String(o.type || ''));
  }

  // Ce que la CUISINE doit encore traiter.
  // Une livraison prête ne la concerne plus : elle attend le livreur.
  function inKitchen(o) {
    var st = String((o && o.status) || '').toUpperCase();
    if (['COMPLETED', 'CANCELLED', 'DELIVERING'].indexOf(st) !== -1) return false;
    if (st === 'READY' && isDelivery(o)) return false;
    return true;
  }

  // Ce que le LIVREUR doit voir : les livraisons prêtes, plus les
  // siennes déjà en route.
  function forDriver(o) {
    var st = String((o && o.status) || '').toUpperCase();
    if (!isDelivery(o)) return false;
    return ['APPROVED', 'PREPARING', 'READY', 'DELIVERING'].indexOf(st) !== -1;
  }

  // L'action suivante autorisée pour un écran donné.
  // Retourne null quand cet écran n'a rien à faire : c'est ce qui
  // empêche deux personnes de se marcher dessus.
  function nextAction(o, screen) {
    var st = String((o && o.status) || '').toUpperCase();
    var deliv = isDelivery(o);

    if (screen === 'kitchen') {
      if (st === 'APPROVED' || st === 'PENDING') return { status: 'PREPARING', label: '👨‍🍳 Commencer' };
      if (st === 'PREPARING') return { status: 'READY', label: '🍳 Marquer prête' };
      // Prête + sur place → la cuisine clôture.
      // Prête + livraison → personne ici, le livreur prend la suite.
      if (st === 'READY' && !deliv) return { status: 'COMPLETED', label: '📤 Servie' };
      return null;
    }

    if (screen === 'driver') {
      if (st === 'READY' && deliv) return { action: 'PICKUP', label: '🛵 Je pars' };
      if (st === 'DELIVERING') return { action: 'DELIVERED', label: '✅ Livrée' };
      return null;
    }

    return null;
  }

  /* ── Temps réel ────────────────────────────────────────────
     Socket.io est déjà dans le projet. Chaque écran s'abonne aux
     mêmes événements : un changement fait par la cuisine apparaît
     chez le livreur et chez le client dans la seconde, sans
     rafraîchissement manuel.

     Le sondage périodique reste en secours : une caisse qui perd
     la websocket ne doit pas cesser de voir les commandes.
  ─────────────────────────────────────────────────────────── */
  var socket = null;

  function live(opts) {
    var o = opts || {};
    var onChange = typeof o.onChange === 'function' ? o.onChange : function () {};
    var apiBase = o.apiBase || '';

    function connect() {
      if (!global.io || socket) return;
      try {
        socket = global.io(apiBase, { transports: ['websocket', 'polling'] });

        socket.on('connect', function () {
          socket.emit('staff:join');
          if (o.orderId) socket.emit('track:join', o.orderId);
        });

        // Tous les événements du projet mènent au même geste :
        // rafraîchir. On ne tente pas de patcher l'état localement,
        // c'est la source d'incohérences la plus fréquente.
        ['order:new', 'order:update', 'order:approved', 'order:rejected',
         'order:deleted', 'order:delivery', 'order_updated', 'driver_location',
        ].forEach(function (ev) {
          socket.on(ev, function (payload) { onChange(ev, payload); });
        });
      } catch (e) { /* on reste en sondage */ }
    }

    if (global.io) connect();
    else {
      var sc = document.createElement('script');
      sc.src = 'https://unpkg.com/socket.io-client@4/dist/socket.io.min.js';
      sc.onload = connect;
      sc.onerror = function () { /* sondage seul */ };
      document.head.appendChild(sc);
    }

    return { disconnect: function () { if (socket) { socket.disconnect(); socket = null; } } };
  }

  global.LuxOrders = {
    STATUS: STATUS,
    isDelivery: isDelivery,
    inKitchen: inKitchen,
    forDriver: forDriver,
    nextAction: nextAction,
    live: live,
    label: function (st) {
      var s = STATUS[String(st || '').toUpperCase()];
      return s ? s.label : String(st || '');
    },
    color: function (st) {
      var s = STATUS[String(st || '').toUpperCase()];
      return s ? s.color : '#8b9099';
    },
  };
})(window);
