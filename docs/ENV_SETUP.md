# LUX SUPREME — Environment Setup

## backend/.env (copy from .env.example)

```env
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://www.cafeslux.com

# PostgreSQL (Neon / Render)
DB_HOST=ep-xxx.eu-west-2.aws.neon.tech
DB_PORT=5432
DB_NAME=lux_supreme
DB_USER=lux_admin
DB_PASSWORD=CHANGE_ME
DB_SSL=true

# JWT (generate: openssl rand -hex 64)
JWT_SECRET=CHANGE_64_CHAR_HEX
JWT_REFRESH_SECRET=CHANGE_64_CHAR_HEX_DIFFERENT
JWT_EXPIRES_IN=8h
JWT_REFRESH_EXPIRES_IN=30d

# Stripe
STRIPE_SECRET_KEY=sk_live_CHANGE
STRIPE_WEBHOOK_SECRET=whsec_CHANGE
STRIPE_PUBLISHABLE_KEY=pk_live_CHANGE

# CORS
CORS_ORIGINS=https://www.cafeslux.com,https://cafeslux.com

# Logging
LOG_LEVEL=info
```

## frontend/.env.local

```env
VITE_API_URL=https://lux-supreme-api.onrender.com/api/v1
VITE_BRANCH_ID=b0000000-0000-0000-0000-000000000001
VITE_TENANT_ID=a0000000-0000-0000-0000-000000000001
VITE_TENANT_SLUG=lux
VITE_FRONTEND_URL=https://www.cafeslux.com
```

## Printer IPs (set in DB after deploy)

```sql
UPDATE branches SET settings = settings || '{
  "receipt_printer_ip": "192.168.1.101",
  "kitchen_printer_ip": "192.168.1.102",
  "bar_printer_ip":     "192.168.1.103"
}'::jsonb WHERE id = 'b0000000-0000-0000-0000-000000000001';
```

## Stripe Setup (15 min)

1. Stripe Dashboard → Products → Create 3 products (Starter/Pro/Enterprise)
2. Copy Price IDs → run:
```sql
UPDATE billing_plans SET stripe_price_id='price_REAL' WHERE name='starter';
UPDATE billing_plans SET stripe_price_id='price_REAL' WHERE name='pro';
UPDATE billing_plans SET stripe_price_id='price_REAL' WHERE name='enterprise';
```
3. Webhooks → Add endpoint: `https://your-api/api/v1/billing/webhook`
   Events: checkout.session.completed, customer.subscription.*, invoice.payment_*
4. Copy Signing Secret → STRIPE_WEBHOOK_SECRET

## Geofence (update to real coordinates)

```sql
UPDATE branch_geofences SET lat=34.XXXXXXXX, lng=-4.XXXXXXXX, radius_m=20
WHERE branch_id='b0000000-0000-0000-0000-000000000001';
```
