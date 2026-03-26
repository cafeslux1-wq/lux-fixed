/**
 * LUX SUPREME — Database Seed
 * Run: npx ts-node prisma/seed.ts
 * Requires: DATABASE_URL or individual DB env vars
 */
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'lux_supreme',
  user:     process.env.DB_USER     || 'lux_admin',
  password: process.env.DB_PASSWORD || '',
  ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const TENANT_ID  = 'a0000000-0000-0000-0000-000000000001';
const BRANCH_TAZA = 'b0000000-0000-0000-0000-000000000001';
const BRANCH_FES  = 'b0000000-0000-0000-0000-000000000002';

const STAFF = [
  { id: 's0000000-0000-0000-0000-000000000001', name: 'Owner LUX',     role: 'owner',     pin: '0000', pass: 'owner@lux2025',   branch: BRANCH_TAZA, phone: '+2120000000001', salary: 0 },
  { id: 's0000000-0000-0000-0000-000000000002', name: 'Fatima Tahiri', role: 'cashier',   pin: '1111', pass: 'fatima2025',      branch: BRANCH_TAZA, phone: '+2120000000002', salary: 4500 },
  { id: 's0000000-0000-0000-0000-000000000003', name: 'Youssef Benali',role: 'barista',   pin: '2222', pass: 'youssef2025',     branch: BRANCH_TAZA, phone: '+2120000000003', salary: 4000 },
  { id: 's0000000-0000-0000-0000-000000000004', name: 'Aicha Lahlou',  role: 'waiter',    pin: '3333', pass: 'aicha2025',       branch: BRANCH_TAZA, phone: '+2120000000004', salary: 3800 },
  { id: 's0000000-0000-0000-0000-000000000005', name: 'Hassan Idrissi',role: 'patissier', pin: '4444', pass: 'hassan2025',      branch: BRANCH_TAZA, phone: '+2120000000005', salary: 4200 },
  { id: 's0000000-0000-0000-0000-000000000006', name: 'Sara Belhaj',   role: 'driver',    pin: '5555', pass: 'sara2025',        branch: BRANCH_TAZA, phone: '+2120000000006', salary: 3500 },
  { id: 's0000000-0000-0000-0000-000000000007', name: 'Karim Ziani',   role: 'cook',      pin: '6666', pass: 'karim2025',       branch: BRANCH_FES,  phone: '+2120000000007', salary: 4000 },
  { id: 's0000000-0000-0000-0000-000000000008', name: 'Manager Fes',   role: 'manager',   pin: '7777', pass: 'manager2025',     branch: BRANCH_FES,  phone: '+2120000000008', salary: 6000 },
];

async function main() {
  console.log('🌱 Starting seed...');
  const client = await pool.connect();
  try {
    for (const s of STAFF) {
      const pinHash  = await bcrypt.hash(s.pin, 12);
      const passHash = await bcrypt.hash(s.pass, 12);
      await client.query(`
        INSERT INTO staff (id, branch_id, tenant_id, full_name, phone, pin_code, password_hash, role, base_salary, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active')
        ON CONFLICT (id) DO UPDATE SET full_name=$4, pin_code=$6, password_hash=$7, base_salary=$9
      `, [s.id, s.branch, TENANT_ID, s.name, s.phone, pinHash, passHash, s.role, s.salary]);
      console.log(`  ✅ Staff: ${s.name} (${s.role}, PIN: ${s.pin})`);
    }

    // Seed subscription for Taza branch
    await client.query(`
      INSERT INTO subscriptions (tenant_id, plan_id, status)
      SELECT $1, id, 'active' FROM billing_plans WHERE name='pro' LIMIT 1
      ON CONFLICT (tenant_id) DO NOTHING
    `, [TENANT_ID]);
    console.log('  ✅ Subscription: pro/active');

    // Seed geofence
    await client.query(`INSERT INTO branch_geofences (branch_id, lat, lng, radius_m) VALUES ($1, 34.21670000, -4.01670000, 20) ON CONFLICT (branch_id) DO NOTHING`, [BRANCH_TAZA]);
    console.log('  ✅ Geofence: Taza (34.2167, -4.0167, 20m)');

    // MRR snapshot
    await client.query('SELECT take_mrr_snapshot()').catch(() => {});
    console.log('  ✅ MRR snapshot taken');

    console.log('\n✅ Seed complete!');
    console.log('\n📋 Staff credentials:');
    STAFF.forEach(s => console.log(`   ${s.name.padEnd(20)} PIN: ${s.pin}  Pass: ${s.pass}`));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error('❌ Seed failed:', err); process.exit(1); });
