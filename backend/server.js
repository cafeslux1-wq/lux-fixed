// ═══════════════════════════════════════════════════════════════
//  CAFÉ LUX — Backend API v1.0
//  Node.js + Express + Prisma + PostgreSQL (Railway)
//  Deploy: railway up  |  Local: npm run dev
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const cors    = require('cors');
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const app    = express();
const prisma = new PrismaClient();
const PORT   = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'lux-secret-2026';

app.use(cors({ origin: process.env.FRONTEND_URL || 'https://cafeslux.com' }));
app.use(express.json());

// ── Auth middleware ──────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requis' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
}

// ── HEALTH ───────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', version: '1.0.0', cafe: 'LUX Taza' }));

// ═══════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════
app.post('/api/auth/login', async (req, res) => {
  const { username, password, role } = req.body;
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !await bcrypt.compare(password, user.passwordHash))
    return res.status(401).json({ error: 'Identifiants incorrects' });
  const token = jwt.sign({ id: user.id, username, role: user.role }, SECRET, { expiresIn: '24h' });
  res.json({ token, user: { id: user.id, username, role: user.role, name: user.name } });
});

// ═══════════════════════════════════════════════════════════
//  ORDERS
// ═══════════════════════════════════════════════════════════
app.get('/api/orders', auth, async (req, res) => {
  const { status, date, limit = 50, source } = req.query;
  const where = {};
  if (status) where.status = status;
  if (source) where.source = source;
  if (date) {
    const d = new Date(date);
    const next = new Date(d); next.setDate(d.getDate() + 1);
    where.createdAt = { gte: d, lt: next };
  }
  const orders = await prisma.order.findMany({
    where,
    include: { items: { include: { product: true } }, customer: true },
    orderBy: { createdAt: 'desc' },
    take: parseInt(limit),
  });
  res.json(orders);
});

app.post('/api/orders', async (req, res) => {
  const { customer, items, type, address, notes, payMethod, couponCode } = req.body;
  if (!items?.length) return res.status(400).json({ error: 'Articles requis' });

  // Validate coupon
  let discount = 0, coupon = null;
  if (couponCode) {
    coupon = await prisma.coupon.findUnique({ where: { code: couponCode.toUpperCase() } });
    if (coupon && coupon.usedCount < coupon.maxUses) {
      const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
      discount = coupon.type === 'pct' ? subtotal * coupon.value / 100 : coupon.value;
    }
  }

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const deliveryFee = type === 'delivery' && subtotal < 200 ? 15 : 0;
  const total = subtotal + deliveryFee - discount;

  // Find or create customer
  let cust = null;
  if (customer?.phone) {
    cust = await prisma.customer.upsert({
      where: { phone: customer.phone },
      update: { lastSeen: new Date() },
      create: { name: customer.name || '', phone: customer.phone },
    });
    // Add loyalty points
    const pts = Math.floor(subtotal / 10);
    await prisma.customer.update({
      where: { id: cust.id },
      data: { loyaltyPoints: { increment: pts } },
    });
  }

  const order = await prisma.order.create({
    data: {
      customerId: cust?.id,
      source: 'web',
      type,
      address: address || '',
      notes: notes || '',
      payMethod: payMethod || 'cash',
      subtotal, deliveryFee, discount, total,
      status: 'pending',
      items: {
        create: items.map(i => ({
          productId: i.productId || null,
          name: i.name,
          price: i.price,
          qty: i.qty,
        })),
      },
    },
    include: { items: true, customer: true },
  });

  // Update coupon usage
  if (coupon) await prisma.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } });

  // Send WhatsApp notification (via Twilio or WA Business API)
  // await sendWhatsApp(process.env.ADMIN_PHONE, formatOrderNotif(order));

  res.status(201).json(order);
});

app.patch('/api/orders/:id/status', auth, async (req, res) => {
  const { status } = req.body;
  const order = await prisma.order.update({
    where: { id: parseInt(req.params.id) },
    data: { status, updatedAt: new Date() },
  });
  res.json(order);
});

// ═══════════════════════════════════════════════════════════
//  PRODUCTS / MENU
// ═══════════════════════════════════════════════════════════
app.get('/api/menu', async (req, res) => {
  const categories = await prisma.category.findMany({
    include: { products: { where: { active: true }, orderBy: { sortOrder: 'asc' } } },
    orderBy: { sortOrder: 'asc' },
  });
  res.json(categories);
});

app.post('/api/products', auth, async (req, res) => {
  const { name, price, description, categoryId, imageUrl, isSignature } = req.body;
  const product = await prisma.product.create({
    data: { name, price, description, categoryId, imageUrl, isSignature: !!isSignature },
  });
  res.status(201).json(product);
});

app.patch('/api/products/:id', auth, async (req, res) => {
  const product = await prisma.product.update({
    where: { id: parseInt(req.params.id) },
    data: req.body,
  });
  res.json(product);
});

// ═══════════════════════════════════════════════════════════
//  CUSTOMERS & LOYALTY
// ═══════════════════════════════════════════════════════════
app.get('/api/customers', auth, async (req, res) => {
  const customers = await prisma.customer.findMany({
    include: { _count: { select: { orders: true } } },
    orderBy: { loyaltyPoints: 'desc' },
    take: 100,
  });
  res.json(customers);
});

app.get('/api/customers/:phone', async (req, res) => {
  const cust = await prisma.customer.findUnique({
    where: { phone: req.params.phone },
    include: {
      orders: { orderBy: { createdAt: 'desc' }, take: 10 },
      _count: { select: { orders: true } },
    },
  });
  if (!cust) return res.status(404).json({ error: 'Client non trouvé' });
  const level = cust.loyaltyPoints >= 600 ? 'diamond' : cust.loyaltyPoints >= 300 ? 'gold' :
                cust.loyaltyPoints >= 100 ? 'silver' : 'bronze';
  res.json({ ...cust, level });
});

// ═══════════════════════════════════════════════════════════
//  RESERVATIONS
// ═══════════════════════════════════════════════════════════
app.get('/api/reservations', auth, async (req, res) => {
  const { date } = req.query;
  const where = date ? { date } : {};
  const reservations = await prisma.reservation.findMany({
    where,
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
  });
  res.json(reservations);
});

app.post('/api/reservations', async (req, res) => {
  const { name, phone, date, time, guests, notes } = req.body;
  if (!name || !phone || !date || !time) return res.status(400).json({ error: 'Champs requis manquants' });
  // Check availability (max 4 per slot)
  const existing = await prisma.reservation.count({
    where: { date, time, status: { not: 'cancelled' } },
  });
  if (existing >= 4) return res.status(409).json({ error: 'Créneau complet' });
  const reservation = await prisma.reservation.create({
    data: { name, phone, date, time, guests: guests || 2, notes: notes || '', status: 'confirmed' },
  });
  res.status(201).json(reservation);
});

// ═══════════════════════════════════════════════════════════
//  ANALYTICS
// ═══════════════════════════════════════════════════════════
app.get('/api/analytics/summary', auth, async (req, res) => {
  const { period = '30d' } = req.query;
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const since = new Date(); since.setDate(since.getDate() - days);

  const [totalOrders, totalCA, avgTicket, topProducts, customerCount] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: since }, status: { not: 'cancelled' } } }),
    prisma.order.aggregate({ where: { createdAt: { gte: since } }, _sum: { total: true } }),
    prisma.order.aggregate({ where: { createdAt: { gte: since } }, _avg: { total: true } }),
    prisma.orderItem.groupBy({
      by: ['name'],
      where: { order: { createdAt: { gte: since } } },
      _sum: { qty: true },
      orderBy: { _sum: { qty: 'desc' } },
      take: 5,
    }),
    prisma.customer.count(),
  ]);

  res.json({
    period, days,
    totalOrders,
    totalCA: totalCA._sum.total || 0,
    avgTicket: avgTicket._avg.total || 0,
    topProducts,
    customerCount,
  });
});

// ═══════════════════════════════════════════════════════════
//  EXTERNAL DELIVERY (Glovo / Jumia webhook)
// ═══════════════════════════════════════════════════════════
app.post('/api/webhooks/glovo', async (req, res) => {
  const { order_id, customer, items, total, delivery_address } = req.body;
  const order = await prisma.order.create({
    data: {
      source: 'glovo',
      type: 'delivery',
      address: delivery_address || '',
      total: parseFloat(total),
      subtotal: parseFloat(total),
      status: 'pending',
      externalId: order_id,
      notes: 'Via Glovo',
      items: { create: items.map(i => ({ name: i.name, price: i.price, qty: i.quantity })) },
    },
  });
  res.json({ received: true, orderId: order.id });
});

app.post('/api/webhooks/jumia', async (req, res) => {
  const { id, items, amount, delivery } = req.body;
  const order = await prisma.order.create({
    data: {
      source: 'jumia',
      type: 'delivery',
      address: delivery?.address || '',
      total: parseFloat(amount),
      subtotal: parseFloat(amount),
      status: 'pending',
      externalId: String(id),
      notes: 'Via Jumia Food',
      items: { create: items.map(i => ({ name: i.name, price: i.unit_price, qty: i.quantity })) },
    },
  });
  res.json({ received: true });
});

// ═══════════════════════════════════════════════════════════
//  GIFT CARDS
// ═══════════════════════════════════════════════════════════
app.post('/api/gift-cards', async (req, res) => {
  const { sender, recipient, amount, phone, message } = req.body;
  const code = 'LUX-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  const expires = new Date(); expires.setFullYear(expires.getFullYear() + 1);
  const gc = await prisma.giftCard.create({
    data: { code, sender, recipient, amount: parseFloat(amount), balance: parseFloat(amount), phone, message: message || '', expires },
  });
  res.status(201).json(gc);
});

app.get('/api/gift-cards/:code', async (req, res) => {
  const gc = await prisma.giftCard.findUnique({ where: { code: req.params.code.toUpperCase() } });
  if (!gc) return res.status(404).json({ error: 'Code invalide' });
  res.json(gc);
});

// ═══════════════════════════════════════════════════════════
//  STOCK
// ═══════════════════════════════════════════════════════════
app.get('/api/stock', auth, async (req, res) => {
  const items = await prisma.stockItem.findMany({ orderBy: { name: 'asc' } });
  const alerts = items.filter(i => i.quantity <= i.minQuantity);
  res.json({ items, alerts });
});

app.patch('/api/stock/:id', auth, async (req, res) => {
  const item = await prisma.stockItem.update({
    where: { id: parseInt(req.params.id) },
    data: req.body,
  });
  res.json(item);
});

// ─── START ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✦ LUX API running on port ${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/health`);
  console.log(`  Orders: http://localhost:${PORT}/api/orders`);
});
