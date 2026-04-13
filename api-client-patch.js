// ═══════════════════════════════════════════════════════════════
//  api-client.js — PATCH pour le nouveau endpoint /api/transactions/web
//
//  PROBLÈME: saveTransaction() dans api-client.js appelle
//            POST /api/transactions avec le token auth.
//            En mode client (pas de token), → 401 → 404 apparent.
//
//  SOLUTION: Modifier saveTransaction() pour utiliser le nouveau
//            endpoint public /api/transactions/web
//
//  ► REMPLACER la méthode saveTransaction dans api-client.js:
// ═══════════════════════════════════════════════════════════════

// ── AVANT (code existant dans api-client.js) ──────────────────
//
//  async saveTransaction(tx) {
//    const all = _ls('transactions',[]); all.unshift(tx); _lsSet('transactions', all.slice(0,500));
//    if (_isOnline && _token) _post('/api/transactions',tx).catch(()=>_queue('saveTransaction',tx));
//    else _queue('saveTransaction',tx);
//  },


// ── APRÈS (code de remplacement) ──────────────────────────────
//
//  async saveTransaction(tx) {
//    const all = _ls('transactions',[]); all.unshift(tx); _lsSet('transactions', all.slice(0,500));
//    if (!_isOnline) { _queue('saveTransaction', tx); return; }
//    // Route auth (POS) ou publique (Web) selon le contexte
//    const endpoint = _token ? '/api/transactions' : '/api/transactions/web';
//    try { await _req(_token ? 'POST' : 'POST', endpoint, tx, !_token); }
//    catch { _queue('saveTransaction', tx); }
//  },


// ── ET modifier _flushPending pour le même pattern ────────────
//
//  Dans _flushPending(), remplacer:
//    case 'saveTransaction': await _post('/api/transactions', item.data); break;
//
//  Par:
//    case 'saveTransaction':
//      const ep = _token ? '/api/transactions' : '/api/transactions/web';
//      await _req('POST', ep, item.data, !_token);
//      break;
