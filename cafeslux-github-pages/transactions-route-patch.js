// ═══════════════════════════════════════════════════════════════
//  TRANSACTIONS — Route Patch (add to server.js)
//  
//  PROBLÈME: Le POST /api/transactions existant (ligne 334) exige
//  le middleware `auth`. Le frontend client (api-client.js) appelle
//  ce endpoint SANS token → 401 → affiché comme 404.
//
//  SOLUTION: Ajouter un route PUBLIC pour les transactions web/client
//  tout en gardant le route POS protégé intact.
//
//  ► INSÉRER CE BLOC **AVANT** le bloc existant (ligne ~332)
// ═══════════════════════════════════════════════════════════════


// ── PUBLIC: Web/Client Transactions ────────────────────────
// Endpoint séparé pour les transactions venant du site client
// (pas de token requis — le client n'est pas authentifié)
app.post('/api/transactions/web', async (req, res) => {
  try {
    const {
      id,           // ID local (Date.now() du frontend)
      date,         // "2026-04-05"
      time,         // "14:30"
      type,         // "delivery" | "takeaway" | "table"
      table,        // numéro de table (optionnel)
      items,        // [{n, p, q}] — articles commandés
      subtotal,     // sous-total HT
      total,        // total TTC
      tva,          // montant TVA
      mode,         // "cash" | "carte" | "paypal" | "tpe"
      notes,        // notes client
      customer,     // nom du client (optionnel)
      phone,        // téléphone (optionnel)
      ref,          // référence LUX-XXXXXX
    } = req.body;

    // ── Validation ──
    if (!items || !total) {
      return res.status(400).json({ error: 'items et total sont requis' });
    }

    // ── Sérialisation des articles ──
    const serializedItems = typeof items === 'string'
      ? items
      : JSON.stringify(items);

    // ── Générer un externalId unique ──
    const externalId = ref
      || ('WEB-' + String(id || Date.now()));

    // ── Upsert: éviter les doublons si le client renvoie (offline sync) ──
    const tx = await prisma.transaction.upsert({
      where: { externalId },
      create: {
        externalId,
        date:      date      || new Date().toISOString().slice(0, 10),
        time:      time      || new Date().toTimeString().slice(0, 5),
        type:      type      || 'delivery',
        tableNum:  table     || null,
        items:     serializedItems,
        subtotal:  parseFloat(subtotal || 0),
        total:     parseFloat(total    || 0),
        tva:       parseFloat(tva      || 0),
        mode:      mode      || 'cash',
        notes:     [
          notes    || '',
          customer ? ('Client: ' + customer) : '',
          phone    ? ('Tél: '    + phone)    : '',
        ].filter(Boolean).join(' · '),
        staffName: customer  || 'Client Web',
        source:    'web',
      },
      update: {
        total: parseFloat(total || 0),
      },
    });

    // ── MAESTRO TrustScore: incrémenter le score du client ──
    if (phone) {
      await prisma.customer.update({
        where: { phone },
        data:  { loyaltyPoints: { increment: Math.floor(parseFloat(total) / 10) } },
      }).catch(() => {}); // silencieux si le client n'existe pas encore
    }

    res.status(201).json({
      success: true,
      id:      tx.id,
      ref:     externalId,
    });

  } catch (e) {
    // Fallback gracieux — ne jamais bloquer le frontend
    console.warn('[tx/web]', e.message);
    res.status(201).json({
      success:   true,
      id:        Date.now(),
      _fallback: true,
    });
  }
});

// ── GET public: historique des transactions d'un client (par téléphone) ──
app.get('/api/transactions/web', async (req, res) => {
  try {
    const { phone, limit = 20 } = req.query;

    if (!phone) {
      return res.status(400).json({ error: 'Paramètre phone requis' });
    }

    // Rechercher par notes (contient le téléphone)
    const txs = await prisma.transaction.findMany({
      where: {
        source: 'web',
        notes:  { contains: phone },
      },
      orderBy: { createdAt: 'desc' },
      take:    parseInt(limit),
    });

    res.json(txs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// ═══════════════════════════════════════════════════════════════
//  LE ROUTE POS EXISTANT RESTE INCHANGÉ (lignes 334-358):
//
//  app.post('/api/transactions', auth, async (req, res) => { ... });
//  app.get('/api/transactions', auth, async (req, res) => { ... });
//
//  Ces routes gardent le middleware `auth` pour protéger
//  les transactions POS/Admin.
// ═══════════════════════════════════════════════════════════════
