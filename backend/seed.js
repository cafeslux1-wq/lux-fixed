// ── Seed: Initial data for Café LUX ──────────────────────
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Café LUX database...');

  // Admin user
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: await bcrypt.hash('lux2026admin', 10),
      name: 'Admin LUX',
      role: 'admin',
    },
  });

  // Categories + Products
  const cats = [
    { name: 'Petit-Déjeuner', icon: '🍳', products: [
      { name: 'Classic Breakfast', price: 22, description: 'Pain, oeuf, olives, fromage, confiture, Danone, JO' },
      { name: 'Moroccan Breakfast', price: 35, description: 'Khlii, 2 oeufs, pain, olives, JO', isSignature: true },
      { name: 'Morning Lux', price: 35, description: '2 oeufs, fromage, pain, salade de fruits, JO', isSignature: true },
    ]},
    { name: 'Cafés Classiques', icon: '☕', products: [
      { name: 'Espresso', price: 7 },
      { name: 'Cappuccino', price: 12 },
      { name: 'Café Crème', price: 10 },
    ]},
    { name: 'Signature LUX', icon: '⭐', products: [
      { name: 'Lux Matcha Bloom', price: 20, description: 'Matcha premium + crémeux', isSignature: true },
      { name: "Queen's Rose Coffee", price: 30, description: 'Café lait, Milka, dattes, amandes', isSignature: true },
      { name: 'Zaazaa Lux', price: 35, description: 'Must Try!', isSignature: true },
    ]},
    { name: 'Infusions', icon: '🍵', products: [
      { name: 'Thé Marocain', price: 9 },
      { name: 'Thé Royal', price: 20, description: '+7 gâteaux marocains', isSignature: true },
    ]},
  ];

  for (const [i, cat] of cats.entries()) {
    const category = await prisma.category.upsert({
      where: { id: i + 1 },
      update: {},
      create: { name: cat.name, icon: cat.icon, sortOrder: i },
    });
    for (const [j, prod] of cat.products.entries()) {
      await prisma.product.create({
        data: { ...prod, categoryId: category.id, sortOrder: j, active: true },
      }).catch(() => {});
    }
  }

  // Default coupons
  const coupons = [
    { code: 'RAMADAN20', type: 'pct', value: 20, maxUses: 100 },
    { code: 'BIENVENUE10', type: 'pct', value: 10, maxUses: 50 },
    { code: 'LUXVIP15', type: 'pct', value: 15, minOrder: 50, maxUses: 30 },
    { code: 'LIVRAISON', type: 'delivery', value: 15, minOrder: 100, maxUses: 200 },
  ];
  for (const coupon of coupons) {
    await prisma.coupon.upsert({
      where: { code: coupon.code },
      update: {},
      create: coupon,
    });
  }

  // Stock items
  const stockItems = [
    { name: 'Café Arabica', unit: 'kg', quantity: 15, minQuantity: 5 },
    { name: 'Matcha Premium', unit: 'kg', quantity: 3, minQuantity: 1 },
    { name: 'Lait entier', unit: 'L', quantity: 45, minQuantity: 20 },
    { name: 'Sucre canne', unit: 'kg', quantity: 25, minQuantity: 10 },
    { name: 'Farine crêpes', unit: 'kg', quantity: 18, minQuantity: 8 },
  ];
  for (const item of stockItems) {
    await prisma.stockItem.create({ data: item }).catch(() => {});
  }

  console.log('✅ Database seeded successfully!');
  console.log('   Admin: username=admin, password=lux2026admin');
}

main().catch(console.error).finally(() => prisma.$disconnect());
