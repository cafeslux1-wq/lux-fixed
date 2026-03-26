# LUX Supreme Intelligence v4.3
## Production-Grade Café SaaS Platform

---

## Part 4 — Migration Instructions

### Fresh Install (recommended)
```bash
# 1. Create DB
createdb lux_supreme

# 2. Run master schema (handles everything)
psql -U lux_admin -d lux_supreme -f prisma/schema_master_final.sql

# 3. Seed staff + default data
cd backend && npx ts-node ../prisma/seed.ts
```

### Upgrade Path (existing DB)
```bash
# Run in this exact order (all idempotent)
psql ... -f prisma/migrations/01_schema_enterprise.sql
psql ... -f prisma/migrations/02_schema_patch.sql
psql ... -f prisma/migrations/03_schema_billing.sql
psql ... -f prisma/migrations/04_schema_saas.sql
psql ... -f prisma/migrations/05_schema_staff.sql
psql ... -f prisma/migrations/06_schema_enforcement.sql
psql ... -f prisma/schema_master_final.sql   # final consolidation + missing columns
```

---

## Part 5 — Run Instructions

### Backend
```bash
cd backend
cp .env.example .env      # Edit with real values
npm install
npm run dev               # Development (ts-node-dev)
npm run build && npm start # Production
```

### Frontend
```bash
cd frontend
cp .env.example .env.local  # Edit with real API URL
npm install
npm run dev               # Development (localhost:3000)
npm run build             # Production (dist/)
```

### Verify
```bash
curl http://localhost:4000/health
# → {"status":"ok","ts":"..."}

curl http://localhost:4000/api/v1/billing/plans
# → {"success":true,"data":[...]}
```

---

## Part 6 — Final Assumptions / Secrets Required

| Variable | Source | Status |
|----------|--------|--------|
| `STRIPE_SECRET_KEY` | Stripe Dashboard → API Keys | ⚠ Required |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks | ⚠ Required |
| `JWT_SECRET` | `openssl rand -hex 64` | ⚠ Required |
| `DB_PASSWORD` | Your Neon/Render DB | ⚠ Required |
| `receipt_printer_ip` | Your LAN printer | Optional (printing disabled if null) |
| `kitchen_printer_ip` | Your LAN printer | Optional |
| `bar_printer_ip` | Your LAN printer | Optional |
| Stripe Price IDs | Stripe → Products | ⚠ Required for billing |
| Geofence coordinates | Real café GPS | ⚠ Required for staff clock-in |

---

## Routes

| URL | App | Auth |
|-----|-----|------|
| `/` | POS Tablet | PIN |
| `/kds` | Kitchen Display | PIN |
| `/staff` | Staff Portal | PIN |
| `/admin` | Super Admin | JWT (super_admin) |
| `/menu?qr=TOKEN` | QR Menu (customer) | None |

---

## File Count: 60 files in clean normalized structure
