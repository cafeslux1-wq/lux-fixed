// ═══════════════════════════════════════════════════════════════
//  CAFÉ LUX — Server Patches Required for v3.8 Client
//  Add these endpoints to server.js (Railway)
// ═══════════════════════════════════════════════════════════════

// ── 1. GIFT CARD REDEEM (deduct balance) ────────────────────────
// POST /api/gift-cards/:code/redeem
// Body: { amount: number }
// Returns: { code, amount, balance, deducted }
app.post('/api/gift-cards/:code/redeem', async (req, res) => {
  try {
    const { amount } = req.body;
    const code = req.params.code.toUpperCase();
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Montant invalide' });

    const gc = await prisma.giftCard.findUnique({ where: { code } });
    if (!gc) return res.status(404).json({ error: 'Code invalide' });
    if (new Date(gc.expires) < new Date()) return res.status(410).json({ error: 'Carte expirée' });
    if (gc.balance < amount) return res.status(402).json({ error: 'Solde insuffisant', balance: gc.balance });

    const updated = await prisma.giftCard.update({
      where: { code },
      data: { balance: gc.balance - amount }
    });
    res.json({
      code: updated.code,
      amount: updated.amount,
      balance: updated.balance,
      deducted: amount,
      remaining: updated.balance
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 2. RESERVATION STATUS UPDATE (cancel) ───────────────────────
// PATCH /api/reservations/:id
// Body: { status: 'cancelled' | 'confirmed' }
app.patch('/api/reservations/:id', auth, async (req, res) => {
  try {
    const data = {};
    if (req.body.status) data.status = req.body.status;
    if (req.body.notes) data.notes = req.body.notes;
    const r = await prisma.reservation.update({
      where: { id: parseInt(req.params.id) },
      data
    });
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 3. PRODUCTS with OFFER tag (if using isOffer flag) ──────────
// Already works with current GET /api/products if schema has isOffer
// If not, add to schema.prisma:
//   isOffer Boolean @default(false)
//   emoji   String?
//   tag     String?

// ── 4. DEDUPE RESERVATIONS AT CREATE (prevent double entries) ──
// Replace existing POST /api/reservations with this enhanced version:
app.post('/api/reservations', async (req, res) => {
  try {
    const { name, phone, date, time, guests, notes } = req.body;
    if (!name || !phone || !date || !time) return res.status(400).json({ error: 'Champs requis manquants' });

    // DEDUP CHECK — prevent creating same reservation twice
    const existing = await prisma.reservation.findFirst({
      where: { phone, date, time, status: { not: 'cancelled' } }
    });
    if (existing) return res.status(200).json({ ...existing, _duplicate: true });

    // Capacity check (max 4 reservations per slot)
    const count = await prisma.reservation.count({
      where: { date, time, status: { not: 'cancelled' } }
    });
    if (count >= 4) return res.status(409).json({ error: 'Créneau complet' });

    const created = await prisma.reservation.create({
      data: { name, phone, date, time, guests: guests || 2, notes: notes || '', status: 'confirmed' }
    });
    res.status(201).json(created);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
