/**
 * ═══════════════════════════════════════════════════════════════════
 *  LUX FAB DEDUPLICATOR — v1.0 (2026-05)
 *  Removes duplicate floating buttons (scroll-to-top, AI, WhatsApp,
 *  cart, etc.) that get rendered twice when a module is included
 *  more than once on the same page.
 *
 *  ➜ HOW TO USE
 *  Drop this ONE line at the very END of <body> in public/index.html
 *  (homepage) and any other page where duplicates appear:
 *
 *    <script src="/public/js/lux-fab-deduplicator.js" defer></script>
 *
 *  ➜ WHAT IT DOES
 *  1. After DOMContentLoaded, scans for elements matching common
 *     floating-button patterns (by ID, class, and position:fixed).
 *  2. Groups them by identity (same ID, same class signature, or
 *     same bounding-box position).
 *  3. Keeps the FIRST occurrence of each group, removes the others.
 *  4. Logs every removal to console with the element that was kept.
 *  5. Re-runs once after `load` event (catches lazy-injected FABs).
 *  6. Sets up a one-shot MutationObserver to catch any duplicate
 *     injected within the next 3 seconds (e.g. by deferred scripts).
 *
 *  ➜ DEBUGGING — paste in DevTools console to find ALL duplicates:
 *     window.LUX_FAB_DEDUP.scan()
 *
 *  ➜ MANUAL REMOVAL — to force-remove a specific duplicate by ID:
 *     window.LUX_FAB_DEDUP.removeById('fab-scroll-top', { keep: 0 })
 *
 * ═══════════════════════════════════════════════════════════════════
 */

(function (global) {
  'use strict';

  var DEBUG = true;
  function log() {
    if (!DEBUG) return;
    try { console.log.apply(console, ['[LUX-DEDUP]'].concat([].slice.call(arguments))); } catch (e) {}
  }

  // ─── KNOWN FLOATING BUTTON IDS (LUX ecosystem) ───────────────────
  var KNOWN_IDS = [
    'lux-fab-group',
    'fab-ai', 'fab-wa', 'fab-sync', 'fab-cart', 'fab-scroll-top',
    'lux-ai-chat',
    'scroll-top', 'scroll-to-top', 'back-to-top', 'btn-scroll-top',
    'lux-online-badge',
  ];

  // ─── KNOWN FLOATING BUTTON CLASS PATTERNS ────────────────────────
  var KNOWN_CLASS_PATTERNS = [
    /\bscroll-?to-?top\b/i,
    /\bback-?to-?top\b/i,
    /\bfab-?scroll\b/i,
    /\blux-fab\b/i,
    /\bfloating-?btn\b/i,
  ];

  // ─── REMOVE DUPLICATES BY ID ─────────────────────────────────────
  function removeById(id, opts) {
    opts = opts || {};
    var keep = typeof opts.keep === 'number' ? opts.keep : 0;
    // querySelectorAll('#id') returns only ONE node per the spec, even if
    // multiple elements share the id (HTML allows it though it's invalid).
    // We need [id='...'] to get them all.
    var nodes = document.querySelectorAll('[id="' + id + '"]');
    if (nodes.length < 2) return 0;
    var removed = 0;
    nodes.forEach(function (node, i) {
      if (i === keep) return;
      log('removing duplicate #' + id + ' (occurrence ' + i + ')', node);
      node.parentNode && node.parentNode.removeChild(node);
      removed++;
    });
    return removed;
  }

  // ─── REMOVE DUPLICATES BY CLASS PATTERN ──────────────────────────
  function removeByClassPattern(regex) {
    // Find all elements whose className matches the regex
    var all = document.querySelectorAll('*[class]');
    var matches = [];
    all.forEach(function (el) {
      if (regex.test(el.className || '')) matches.push(el);
    });
    if (matches.length < 2) return 0;
    // Keep only the first; remove rest
    var removed = 0;
    for (var i = 1; i < matches.length; i++) {
      // Skip if the duplicate is nested inside the first (unrelated)
      if (matches[0].contains(matches[i]) || matches[i].contains(matches[0])) continue;
      // Skip if they have different parents AND different positions
      // (might be legitimate distinct buttons, e.g. nav + footer)
      var b1 = matches[0].getBoundingClientRect();
      var b2 = matches[i].getBoundingClientRect();
      var nearSamePos = Math.abs(b1.right - b2.right) < 30 && Math.abs(b1.bottom - b2.bottom) < 30;
      if (!nearSamePos) continue;
      log('removing duplicate by class', regex.source, '(idx ' + i + ')', matches[i]);
      matches[i].parentNode && matches[i].parentNode.removeChild(matches[i]);
      removed++;
    }
    return removed;
  }

  // ─── REMOVE DUPLICATES BY FIXED POSITION ─────────────────────────
  // Catches anonymous floating buttons that share the same screen corner
  function removeByPosition(tolerance) {
    tolerance = tolerance || 15;
    var candidates = [];
    // Get all elements with position:fixed
    document.querySelectorAll('body *').forEach(function (el) {
      var cs = global.getComputedStyle(el);
      if (cs.position !== 'fixed') return;
      // Must be visible and reasonably small (a button, not a modal)
      var r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.width > 200 || r.height > 200) return;
      candidates.push({ el: el, r: r, cs: cs });
    });

    // Group by approximate position + size
    var groups = [];
    candidates.forEach(function (c) {
      var found = null;
      for (var i = 0; i < groups.length; i++) {
        var g = groups[i][0];
        if (Math.abs(g.r.right - c.r.right)   < tolerance &&
            Math.abs(g.r.bottom - c.r.bottom) < tolerance &&
            Math.abs(g.r.width - c.r.width)   < tolerance &&
            Math.abs(g.r.height - c.r.height) < tolerance) {
          found = groups[i]; break;
        }
      }
      if (found) found.push(c); else groups.push([c]);
    });

    var removed = 0;
    groups.forEach(function (g) {
      if (g.length < 2) return;
      // Don't remove if any are inside each other (parent/child)
      var safe = [];
      g.forEach(function (c) {
        var inside = false;
        for (var i = 0; i < safe.length; i++) {
          if (safe[i].el.contains(c.el) || c.el.contains(safe[i].el)) { inside = true; break; }
        }
        if (!inside) safe.push(c);
      });
      if (safe.length < 2) return;
      // Keep the first (presumably the "real" one); remove the rest
      for (var i = 1; i < safe.length; i++) {
        log('removing duplicate by position', safe[i].el);
        safe[i].el.parentNode && safe[i].el.parentNode.removeChild(safe[i].el);
        removed++;
      }
    });
    return removed;
  }

  // ─── DIAGNOSTIC SCAN — non-destructive, for DevTools ─────────────
  function scan() {
    var report = { byId: {}, byClass: {}, byPosition: [] };
    KNOWN_IDS.forEach(function (id) {
      var nodes = document.querySelectorAll('[id="' + id + '"]');
      if (nodes.length > 1) report.byId[id] = nodes.length;
    });
    KNOWN_CLASS_PATTERNS.forEach(function (regex) {
      var matches = document.querySelectorAll('*[class]');
      var count = 0;
      matches.forEach(function (el) { if (regex.test(el.className || '')) count++; });
      if (count > 1) report.byClass[regex.source] = count;
    });
    document.querySelectorAll('body *').forEach(function (el) {
      var cs = global.getComputedStyle(el);
      if (cs.position !== 'fixed') return;
      var r = el.getBoundingClientRect();
      if (r.width === 0 || r.width > 200) return;
      report.byPosition.push({
        tag: el.tagName.toLowerCase(),
        id:  el.id || '(no id)',
        cls: (el.className || '').slice(0, 40),
        pos: 'right:' + Math.round(global.innerWidth - r.right) + 'px bottom:' + Math.round(global.innerHeight - r.bottom) + 'px',
        size: Math.round(r.width) + '×' + Math.round(r.height),
      });
    });
    console.table(report.byPosition);
    console.log('Duplicate IDs:', report.byId);
    console.log('Duplicate classes:', report.byClass);
    return report;
  }

  // ─── MAIN — sweep through all detection strategies ───────────────
  function sweep() {
    var total = 0;
    KNOWN_IDS.forEach(function (id) { total += removeById(id); });
    KNOWN_CLASS_PATTERNS.forEach(function (regex) { total += removeByClassPattern(regex); });
    total += removeByPosition(15);
    if (total > 0) log('sweep complete — removed', total, 'duplicate floating element(s)');
    else log('sweep complete — no duplicates found');
    return total;
  }

  // ─── PUBLIC API ──────────────────────────────────────────────────
  global.LUX_FAB_DEDUP = {
    scan:               scan,
    sweep:              sweep,
    removeById:         removeById,
    removeByClassPattern: removeByClassPattern,
    removeByPosition:   removeByPosition,
    KNOWN_IDS:          KNOWN_IDS,
  };

  // ─── BOOT — run sweep at multiple lifecycle points ───────────────
  function boot() {
    sweep();
    // Re-run after window 'load' (when deferred scripts have injected FABs)
    global.addEventListener('load', function () { setTimeout(sweep, 200); });
    // Watch for late injections for 3 seconds
    var observer = new MutationObserver(function () {
      // Throttle: only run once per 300ms burst
      if (boot._pending) return;
      boot._pending = true;
      setTimeout(function () { boot._pending = false; sweep(); }, 300);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { observer.disconnect(); log('observer disconnected after 3s window'); }, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  log('v1.0 loaded — call LUX_FAB_DEDUP.scan() to diagnose, .sweep() to force a pass');

})(window);
