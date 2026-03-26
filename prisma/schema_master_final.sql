-- ═══════════════════════════════════════════════════════════════════════
--  LUX SUPREME — MASTER CONSOLIDATED SCHEMA
--  Single source of truth — run on fresh or existing DB
--  Combines all packs in correct dependency order
--
--  RUN ORDER:
--  1. schema_master_final.sql  (this file — full stack)
--
--  Safe to re-run: all statements are idempotent
-- ═══════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ════════ [0] ENUM TYPES ══════════════════════════════════════════════════
DO $$ BEGIN CREATE TYPE staff_role AS ENUM ('owner','manager','cashier','barista','waiter','cook','driver','patissier','cleaner'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE order_source AS ENUM ('pos','qr_code','order_ahead','web','glovo','yassir','kaoul','jumia','courier'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE order_type AS ENUM ('dine_in','takeaway','delivery','courier'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE order_status AS ENUM ('pending','accepted','preparing','ready','served','delivered','paid','cancelled','refunded'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE payment_method AS ENUM ('cash','card','wallet','meal_voucher','nfc','mixed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE courier_status AS ENUM ('pending','assigned','picked_up','in_transit','delivered','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE shift_status AS ENUM ('open','closed','flagged'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'preparing'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'paid'; EXCEPTION WHEN others THEN NULL; END $$;

-- ════════ [1] TENANTS & BRANCHES ═════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tenants (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name               VARCHAR(100) NOT NULL,
    slug               VARCHAR(50)  UNIQUE NOT NULL,
    plan               VARCHAR(20)  DEFAULT 'trialing',
    is_active          BOOLEAN      DEFAULT true,
    is_super_admin     BOOLEAN      DEFAULT false,
    settings           JSONB        DEFAULT '{}',
    stripe_customer_id VARCHAR(100) UNIQUE,
    referral_code      VARCHAR(20)  UNIQUE,
    referred_by        UUID REFERENCES tenants(id) ON DELETE SET NULL,
    referral_balance   DECIMAL(12,2) DEFAULT 0,
    total_revenue      DECIMAL(14,2) DEFAULT 0,
    first_payment_at   TIMESTAMPTZ,
    created_at         TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS branches (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name       VARCHAR(100) NOT NULL,
    city       VARCHAR(50)  NOT NULL,
    address    TEXT,
    phone      VARCHAR(30),
    latitude   DECIMAL(10,8),
    longitude  DECIMAL(11,8),
    is_active  BOOLEAN  DEFAULT true,
    -- Printer IPs stored in settings JSON:
    -- settings->>'receipt_printer_ip', 'kitchen_printer_ip', 'bar_printer_ip'
    settings   JSONB    DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_branches_tenant ON branches(tenant_id);

-- ════════ [2] STAFF ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS staff (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id          UUID NOT NULL REFERENCES branches(id),
    tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    full_name          VARCHAR(100) NOT NULL,
    email              VARCHAR(150) UNIQUE,
    phone              VARCHAR(30)  UNIQUE NOT NULL,
    pin_code           VARCHAR(255) NOT NULL,
    password_hash      VARCHAR(255),
    role               staff_role NOT NULL,
    base_salary        DECIMAL(12,2) DEFAULT 0,
    joining_date       DATE DEFAULT CURRENT_DATE,
    avatar_url         TEXT,
    avg_rating         DECIMAL(3,2) DEFAULT 0,
    rating_count       INT DEFAULT 0,
    status             VARCHAR(20) DEFAULT 'active',
    refresh_token      TEXT,
    last_login         TIMESTAMPTZ,
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    updated_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_staff_branch ON staff(branch_id);
CREATE INDEX IF NOT EXISTS idx_staff_tenant ON staff(tenant_id);

-- ════════ [3] ATTENDANCE (enforcement columns) ════════════════════════════
CREATE TABLE IF NOT EXISTS attendance (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id              UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    branch_id             UUID NOT NULL REFERENCES branches(id),
    work_date             DATE NOT NULL DEFAULT CURRENT_DATE,
    clock_in              TIMESTAMPTZ,
    clock_out             TIMESTAMPTZ,
    clock_in_lat          DECIMAL(11,8),
    clock_in_lng          DECIMAL(11,8),
    clock_in_lat_precise  DECIMAL(11,8),
    clock_in_lng_precise  DECIMAL(11,8),
    clock_in_accuracy_m   DECIMAL(8,2),
    clock_in_selfie_url   TEXT,
    geofence_passed       BOOLEAN DEFAULT false,
    selfie_verified       BOOLEAN DEFAULT false,
    hours_worked          DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE WHEN clock_out IS NOT NULL
          THEN EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600.0 ELSE NULL END
    ) STORED,
    expected_start        TIME,
    delay_minutes         INT DEFAULT 0,
    delay_penalty         DECIMAL(8,2) DEFAULT 0,
    clock_in_note         TEXT,
    clock_out_note        TEXT,
    UNIQUE(staff_id, work_date)
);
CREATE INDEX IF NOT EXISTS idx_attendance_staff ON attendance(staff_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date  ON attendance(work_date);

-- Geo-fence config per branch
CREATE TABLE IF NOT EXISTS branch_geofences (
    id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL UNIQUE REFERENCES branches(id) ON DELETE CASCADE,
    lat       DECIMAL(11,8) NOT NULL,
    lng       DECIMAL(11,8) NOT NULL,
    radius_m  INT DEFAULT 20,
    is_active BOOLEAN DEFAULT true
);

-- Clock-in audit log
CREATE TABLE IF NOT EXISTS clock_in_attempts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id        UUID NOT NULL REFERENCES staff(id),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    attempted_at    TIMESTAMPTZ DEFAULT NOW(),
    lat             DECIMAL(11,8),
    lng             DECIMAL(11,8),
    accuracy_m      DECIMAL(8,2),
    distance_m      DECIMAL(8,2),
    geofence_passed BOOLEAN NOT NULL,
    selfie_url      TEXT,
    failure_reason  TEXT
);

-- ════════ [4] CUSTOMERS & LOYALTY ════════════════════════════════════════
CREATE TABLE IF NOT EXISTS customers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    full_name       VARCHAR(100) NOT NULL,
    phone           VARCHAR(20)  UNIQUE NOT NULL,
    email           VARCHAR(150) UNIQUE,
    nfc_tag_id      VARCHAR(100) UNIQUE,
    wallet_balance  DECIMAL(12,2) DEFAULT 0 CHECK (wallet_balance >= 0),
    loyalty_stars   INT DEFAULT 0,
    total_spent     DECIMAL(12,2) DEFAULT 0,
    tier            VARCHAR(20)   DEFAULT 'bronze',
    password_hash   VARCHAR(255),
    refresh_token   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id      UUID NOT NULL REFERENCES customers(id),
    amount           DECIMAL(12,2) NOT NULL,
    balance_after    DECIMAL(12,2) NOT NULL,
    transaction_type VARCHAR(30) NOT NULL,
    reference_id     UUID,
    payment_method   VARCHAR(30),
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ════════ [5] MENU ════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS categories (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name       VARCHAR(100) NOT NULL,
    name_ar    VARCHAR(100),
    name_fr    VARCHAR(100),
    icon       VARCHAR(10),
    sort_order SMALLINT DEFAULT 0,
    is_active  BOOLEAN  DEFAULT true
);

CREATE TABLE IF NOT EXISTS products (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id    UUID REFERENCES categories(id) ON DELETE SET NULL,
    name           VARCHAR(100) NOT NULL,
    name_ar        VARCHAR(100),
    name_fr        VARCHAR(100),
    description    TEXT,
    base_price     DECIMAL(12,2) NOT NULL CHECK (base_price >= 0),
    image_url      TEXT,
    is_signature   BOOLEAN DEFAULT false,
    is_available   BOOLEAN DEFAULT true,
    sort_order     SMALLINT DEFAULT 0,
    modifiers      JSONB DEFAULT '[]',
    prep_time_mins SMALLINT DEFAULT 5,
    -- category for printer routing: 'food' | 'drink' | 'dessert'
    product_category VARCHAR(20) DEFAULT 'food',
    tags           TEXT[] DEFAULT '{}',
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id, is_available) WHERE is_available = true;

-- ════════ [6] INVENTORY ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ingredients (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id     UUID NOT NULL REFERENCES branches(id),
    name          VARCHAR(100) NOT NULL,
    unit          VARCHAR(20)  NOT NULL,
    current_stock DECIMAL(12,3) DEFAULT 0 CHECK (current_stock >= 0),
    min_stock     DECIMAL(12,3) DEFAULT 0,
    cost_per_unit DECIMAL(10,4) DEFAULT 0,
    supplier      VARCHAR(100),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_stock_non_negative CHECK (current_stock >= 0)
);
CREATE INDEX IF NOT EXISTS idx_ingredients_branch ON ingredients(branch_id, current_stock, min_stock);

CREATE TABLE IF NOT EXISTS recipes (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    qty_needed    DECIMAL(12,4) NOT NULL CHECK (qty_needed > 0),
    unit          VARCHAR(20)   NOT NULL,
    UNIQUE(product_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS stock_movements (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    branch_id     UUID NOT NULL REFERENCES branches(id),
    movement_type VARCHAR(20) NOT NULL,
    delta         DECIMAL(12,4) NOT NULL,
    stock_after   DECIMAL(12,4) NOT NULL,
    reference_id  UUID,
    note          TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ════════ [7] ORDERS (all columns from all packs) ════════════════════════
CREATE TABLE IF NOT EXISTS orders (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id        UUID NOT NULL REFERENCES branches(id),
    tenant_id        UUID NOT NULL REFERENCES tenants(id),
    staff_id         UUID REFERENCES staff(id) ON DELETE SET NULL,
    customer_id      UUID REFERENCES customers(id) ON DELETE SET NULL,
    source           order_source  NOT NULL DEFAULT 'pos',
    order_type       order_type    NOT NULL DEFAULT 'dine_in',
    session_type     VARCHAR(20)   DEFAULT 'pos' CHECK (session_type IN ('pos','qr_menu','app','web','delivery')),
    table_number     VARCHAR(20),
    external_id      VARCHAR(100),
    idempotency_key  VARCHAR(100)  UNIQUE,
    subtotal         DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_rate         DECIMAL(5,4)  DEFAULT 0.10,
    tax_amount       DECIMAL(12,2) DEFAULT 0,
    discount_amount  DECIMAL(12,2) DEFAULT 0,
    total_amount     DECIMAL(12,2) NOT NULL DEFAULT 0,
    loyalty_used     INT DEFAULT 0,
    payment_method   payment_method,
    status           order_status  DEFAULT 'pending',
    is_voided        BOOLEAN       DEFAULT false,
    void_reason      TEXT,
    voided_by        UUID REFERENCES staff(id),
    voided_at        TIMESTAMPTZ,
    -- KDS timestamps
    accepted_at      TIMESTAMPTZ,
    preparing_at     TIMESTAMPTZ,
    ready_at         TIMESTAMPTZ,
    delivered_at     TIMESTAMPTZ,
    paid_at          TIMESTAMPTZ,
    notes            TEXT,
    customer_notes   TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_branch   ON orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant   ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status   ON orders(tenant_id, status) WHERE is_voided = false;
CREATE INDEX IF NOT EXISTS idx_orders_created  ON orders(tenant_id, branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_idemp    ON orders(idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS order_items (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id   UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name VARCHAR(100) NOT NULL,
    unit_price   DECIMAL(12,2) NOT NULL,
    quantity     SMALLINT NOT NULL DEFAULT 1,
    subtotal     DECIMAL(12,2) NOT NULL,
    modifiers    JSONB DEFAULT '{}',
    notes        TEXT
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- ════════ [8] STABILITY / IDEMPOTENCY ════════════════════════════════════
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key             VARCHAR(100) PRIMARY KEY,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    endpoint        VARCHAR(100) NOT NULL,
    response_status INT DEFAULT 200,
    response_body   JSONB,
    order_id        UUID REFERENCES orders(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    expires_at      TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);

CREATE TABLE IF NOT EXISTS order_failures (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID REFERENCES tenants(id),
    branch_id       UUID REFERENCES branches(id),
    idempotency_key VARCHAR(100),
    failure_type    VARCHAR(40) NOT NULL,
    failure_detail  JSONB,
    staff_id        UUID REFERENCES staff(id),
    customer_id     UUID REFERENCES customers(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS qr_sessions (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id),
    branch_id     UUID NOT NULL REFERENCES branches(id),
    table_number  VARCHAR(20) NOT NULL,
    session_token VARCHAR(100) UNIQUE NOT NULL,
    customer_id   UUID REFERENCES customers(id),
    is_active     BOOLEAN DEFAULT true,
    orders_placed INT DEFAULT 0,
    total_spent   DECIMAL(12,2) DEFAULT 0,
    opened_at     TIMESTAMPTZ DEFAULT NOW(),
    closed_at     TIMESTAMPTZ,
    expires_at    TIMESTAMPTZ DEFAULT NOW() + INTERVAL '4 hours'
);
CREATE INDEX IF NOT EXISTS idx_qr_sessions_token ON qr_sessions(session_token) WHERE is_active = true;

-- ════════ [9] BILLING & SUBSCRIPTIONS ════════════════════════════════════
CREATE TABLE IF NOT EXISTS billing_plans (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_product_id VARCHAR(100) UNIQUE,
    stripe_price_id   VARCHAR(100) UNIQUE NOT NULL,
    name              VARCHAR(50) NOT NULL,
    display_name      VARCHAR(100) NOT NULL,
    price_monthly_mad DECIMAL(10,2) NOT NULL,
    max_branches      SMALLINT DEFAULT 1,
    max_staff         SMALLINT DEFAULT 10,
    max_orders_daily  INT DEFAULT 200,
    features          JSONB DEFAULT '[]',
    is_active         BOOLEAN DEFAULT true,
    sort_order        SMALLINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id              UUID NOT NULL UNIQUE REFERENCES tenants(id),
    plan_id                UUID NOT NULL REFERENCES billing_plans(id),
    stripe_customer_id     VARCHAR(100) UNIQUE,
    stripe_subscription_id VARCHAR(100) UNIQUE,
    stripe_price_id        VARCHAR(100),
    status                 VARCHAR(30) DEFAULT 'trialing' CHECK (status IN ('trialing','active','past_due','canceled','unpaid','incomplete','paused')),
    trial_ends_at          TIMESTAMPTZ DEFAULT NOW() + INTERVAL '14 days',
    current_period_start   TIMESTAMPTZ,
    current_period_end     TIMESTAMPTZ,
    canceled_at            TIMESTAMPTZ,
    cancel_at_period_end   BOOLEAN DEFAULT false,
    payment_method_brand   VARCHAR(20),
    payment_method_last4   VARCHAR(4),
    payment_method_exp     VARCHAR(7),
    created_at             TIMESTAMPTZ DEFAULT NOW(),
    updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id),
    stripe_invoice_id VARCHAR(100) UNIQUE NOT NULL,
    stripe_customer_id VARCHAR(100),
    amount_due        DECIMAL(10,2) NOT NULL,
    amount_paid       DECIMAL(10,2) DEFAULT 0,
    currency          VARCHAR(3) DEFAULT 'usd',
    status            VARCHAR(20),
    invoice_url       TEXT,
    invoice_pdf       TEXT,
    period_start      TIMESTAMPTZ,
    period_end        TIMESTAMPTZ,
    paid_at           TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stripe_events (
    stripe_event_id VARCHAR(100) PRIMARY KEY,
    event_type      VARCHAR(100) NOT NULL,
    tenant_id       UUID REFERENCES tenants(id),
    payload         JSONB,
    processed       BOOLEAN DEFAULT false,
    error_message   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ════════ [10] HR — PAYROLL, TASKS, PROFIT-SHARING ═══════════════════════
CREATE TABLE IF NOT EXISTS task_templates (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    role            VARCHAR(30) NOT NULL,
    task_name       VARCHAR(200) NOT NULL,
    task_name_fr    VARCHAR(200),
    category        VARCHAR(50),
    sort_order      SMALLINT DEFAULT 0,
    requires_photo  BOOLEAN DEFAULT false,
    default_penalty DECIMAL(8,2) DEFAULT 25.00,
    is_active       BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS daily_task_logs (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id            UUID NOT NULL REFERENCES staff(id),
    branch_id           UUID NOT NULL REFERENCES branches(id),
    task_id             UUID NOT NULL REFERENCES task_templates(id),
    task_date           DATE NOT NULL DEFAULT CURRENT_DATE,
    is_completed        BOOLEAN DEFAULT false,
    completed_at        TIMESTAMPTZ,
    proof_photo_url     TEXT,
    evidence_image_url  TEXT,
    evidence_captured_at TIMESTAMPTZ,
    penalty_applied     DECIMAL(8,2) DEFAULT 0,
    penalty_reason      VARCHAR(50),
    is_disputed         BOOLEAN DEFAULT false,
    disputed_by         UUID REFERENCES staff(id),
    disputed_at         TIMESTAMPTZ,
    dispute_note        TEXT,
    UNIQUE(staff_id, task_id, task_date)
);
CREATE INDEX IF NOT EXISTS idx_task_logs_staff ON daily_task_logs(staff_id, task_date);

CREATE TABLE IF NOT EXISTS staff_requests (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id      UUID NOT NULL REFERENCES staff(id),
    branch_id     UUID NOT NULL REFERENCES branches(id),
    type          VARCHAR(20) NOT NULL,
    amount        DECIMAL(12,2) NOT NULL,
    reason        TEXT,
    urgency       VARCHAR(10) DEFAULT 'normal',
    status        VARCHAR(30) DEFAULT 'pending',
    reviewed_by   UUID REFERENCES staff(id),
    authorized_by UUID REFERENCES staff(id),
    paid_by       UUID REFERENCES staff(id),
    approved_at   TIMESTAMPTZ,
    paid_at       TIMESTAMPTZ,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_records (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id          UUID NOT NULL REFERENCES staff(id),
    branch_id         UUID NOT NULL REFERENCES branches(id),
    pay_period        VARCHAR(7) NOT NULL,
    base_salary       DECIMAL(12,2) NOT NULL,
    delay_penalties   DECIMAL(12,2) DEFAULT 0,
    task_penalties    DECIMAL(12,2) DEFAULT 0,
    advances_deducted DECIMAL(12,2) DEFAULT 0,
    profit_share      DECIMAL(12,2) DEFAULT 0,
    bonus             DECIMAL(12,2) DEFAULT 0,
    net_salary        DECIMAL(12,2) NOT NULL,
    status            VARCHAR(20) DEFAULT 'pending',
    paid_at           TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(staff_id, pay_period)
);

-- ★ NEW: Profit-sharing logs (idempotent per staff+shift)
CREATE TABLE IF NOT EXISTS profit_sharing_logs (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id      UUID NOT NULL REFERENCES staff(id),
    branch_id     UUID NOT NULL REFERENCES branches(id),
    shift_date    DATE NOT NULL,
    shift_type    VARCHAR(10) NOT NULL CHECK (shift_type IN ('morning','evening')),
    shift_revenue DECIMAL(14,2) NOT NULL,
    bonus_pct     DECIMAL(5,2) NOT NULL,
    bonus_amount  DECIMAL(12,2) NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(staff_id, shift_date, shift_type)
);

CREATE TABLE IF NOT EXISTS shift_schedules (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id  UUID NOT NULL REFERENCES branches(id),
    staff_id   UUID NOT NULL REFERENCES staff(id),
    shift_date DATE NOT NULL,
    shift_type VARCHAR(20) DEFAULT 'regular',
    start_time TIME NOT NULL,
    end_time   TIME NOT NULL,
    notes      TEXT
);
CREATE INDEX IF NOT EXISTS idx_schedule_staff ON shift_schedules(staff_id, shift_date);

-- ════════ [11] STAFF RATINGS (internal) ══════════════════════════════════
CREATE TABLE IF NOT EXISTS staff_ratings (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    staff_id     UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    customer_id  UUID REFERENCES customers(id) ON DELETE SET NULL,
    branch_id    UUID NOT NULL REFERENCES branches(id),
    rating_stars SMALLINT NOT NULL CHECK (rating_stars BETWEEN 1 AND 5),
    comment      TEXT,
    is_internal  BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(order_id, customer_id)
);
CREATE INDEX IF NOT EXISTS idx_ratings_staff ON staff_ratings(staff_id);

-- ════════ [12] REFERRALS & COMMISSIONS ═══════════════════════════════════
CREATE TABLE IF NOT EXISTS referrals (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_tenant_id  UUID NOT NULL REFERENCES tenants(id),
    referred_tenant_id  UUID NOT NULL UNIQUE REFERENCES tenants(id),
    referral_code_used  VARCHAR(20) NOT NULL,
    status              VARCHAR(20) DEFAULT 'pending',
    activated_at        TIMESTAMPTZ,
    lifetime_earned     DECIMAL(12,2) DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commissions (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referral_id        UUID NOT NULL REFERENCES referrals(id),
    referrer_tenant_id UUID NOT NULL REFERENCES tenants(id),
    referred_tenant_id UUID NOT NULL REFERENCES tenants(id),
    stripe_invoice_id  VARCHAR(100),
    gross_amount       DECIMAL(12,2) NOT NULL,
    commission_rate    DECIMAL(5,4) DEFAULT 0.20,
    commission_amount  DECIMAL(12,2) NOT NULL,
    currency           VARCHAR(3) DEFAULT 'usd',
    status             VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','paid_out','cancelled')),
    period_month       VARCHAR(7),
    approved_at        TIMESTAMPTZ,
    paid_out_at        TIMESTAMPTZ,
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(referral_id, period_month)
);

CREATE TABLE IF NOT EXISTS payout_requests (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    amount      DECIMAL(12,2) NOT NULL,
    method      VARCHAR(30) DEFAULT 'bank_transfer',
    iban        VARCHAR(34),
    status      VARCHAR(20) DEFAULT 'pending',
    processed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ════════ [13] SECURITY & AUDIT ══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS audit_logs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID REFERENCES tenants(id),
    branch_id   UUID REFERENCES branches(id),
    actor_id    UUID,
    actor_type  VARCHAR(20),
    action      VARCHAR(100) NOT NULL,
    target_id   UUID,
    target_type VARCHAR(50),
    details     JSONB DEFAULT '{}',
    request_id  VARCHAR(50),
    ip_address  INET,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS void_alerts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    order_id        UUID NOT NULL REFERENCES orders(id),
    voided_by       UUID NOT NULL REFERENCES staff(id),
    amount          DECIMAL(12,2) NOT NULL,
    reason          TEXT,
    severity        VARCHAR(10) DEFAULT 'medium',
    is_acknowledged BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_permission_overrides (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id    UUID NOT NULL REFERENCES staff(id),
    permission  VARCHAR(60) NOT NULL,
    granted     BOOLEAN DEFAULT true,
    granted_by  UUID REFERENCES staff(id),
    reason      TEXT,
    expires_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(staff_id, permission)
);

-- ════════ [14] MRR SNAPSHOTS ══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS mrr_snapshots (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    snapshot_date   DATE NOT NULL UNIQUE,
    mrr_mad         DECIMAL(14,2) NOT NULL,
    active_tenants  INT NOT NULL,
    new_tenants     INT DEFAULT 0,
    churned_tenants INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ════════ [15] FUNCTIONS & TRIGGERS ══════════════════════════════════════
CREATE OR REPLACE FUNCTION trigger_set_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DO $$ BEGIN CREATE TRIGGER set_updated_at_orders BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER set_updated_at_staff  BEFORE UPDATE ON staff  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION refresh_staff_rating() RETURNS TRIGGER AS $$
BEGIN
  UPDATE staff SET avg_rating = (SELECT AVG(rating_stars)::DECIMAL(3,2) FROM staff_ratings WHERE staff_id = NEW.staff_id), rating_count = (SELECT COUNT(*) FROM staff_ratings WHERE staff_id = NEW.staff_id) WHERE id = NEW.staff_id;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DO $$ BEGIN CREATE TRIGGER trg_refresh_staff_rating AFTER INSERT OR UPDATE ON staff_ratings FOR EACH ROW EXECUTE FUNCTION refresh_staff_rating(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION auto_flag_void() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.amount >= 200 THEN UPDATE void_alerts SET severity='high', is_acknowledged=false WHERE id=NEW.id;
  ELSIF NEW.amount >= 100 THEN UPDATE void_alerts SET severity='medium' WHERE id=NEW.id;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DO $$ BEGIN CREATE TRIGGER auto_flag_void_trigger AFTER INSERT ON void_alerts FOR EACH ROW EXECUTE FUNCTION auto_flag_void(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys() RETURNS void AS $$ BEGIN DELETE FROM idempotency_keys WHERE expires_at < NOW(); END; $$ LANGUAGE plpgsql;

-- ════════ [16] KDS VIEW ═══════════════════════════════════════════════════
CREATE OR REPLACE VIEW v_kds_live AS
SELECT o.id, o.tenant_id, o.branch_id, o.table_number, o.source, o.session_type,
  o.status, o.notes, o.customer_notes, o.created_at, o.accepted_at, o.preparing_at,
  EXTRACT(EPOCH FROM (NOW()-o.created_at))/60 AS total_age_min,
  EXTRACT(EPOCH FROM (NOW()-COALESCE(o.preparing_at,o.accepted_at,o.created_at)))/60 AS stage_age_min,
  CASE WHEN EXTRACT(EPOCH FROM (NOW()-o.created_at))/60>15 THEN 'critical'
       WHEN EXTRACT(EPOCH FROM (NOW()-o.created_at))/60>8  THEN 'urgent' ELSE 'normal' END AS priority,
  JSON_AGG(JSON_BUILD_OBJECT('name',oi.product_name,'qty',oi.quantity,'modifiers',oi.modifiers,'notes',oi.notes) ORDER BY oi.id) AS items
FROM orders o JOIN order_items oi ON oi.order_id=o.id
WHERE o.status IN ('accepted','preparing','ready') AND o.is_voided=false AND o.created_at > NOW()-INTERVAL '6 hours'
GROUP BY o.id ORDER BY CASE o.status WHEN 'accepted' THEN 1 WHEN 'preparing' THEN 2 WHEN 'ready' THEN 3 ELSE 4 END, o.created_at;

-- ════════ [17] SEED DATA ══════════════════════════════════════════════════
INSERT INTO tenants (id, name, slug, plan, is_super_admin, settings) VALUES
  ('a0000000-0000-0000-0000-000000000001','LUX Café Group','lux','enterprise',true,
   '{"currency":"MAD","timezone":"Africa/Casablanca","tax_rate":0.10,"profit_sharing_pct":5}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO branches (id, tenant_id, name, city, address, phone, latitude, longitude, settings) VALUES
  ('b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001',
   'LUX Taza','Taza','Résidence Ziat N°28, Taza','+212808524169',34.21670000,-4.01670000,
   '{"tax_rate":0.10,"profit_sharing_pct":5,"receipt_printer_ip":null,"kitchen_printer_ip":null,"bar_printer_ip":null}'),
  ('b0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001',
   'LUX Fès','Fès','Bd Mohammed V, Fès','+212535000000',34.0339,-5.0003,'{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO branch_geofences (branch_id, lat, lng, radius_m) VALUES
  ('b0000000-0000-0000-0000-000000000001', 34.21670000, -4.01670000, 20)
ON CONFLICT (branch_id) DO NOTHING;

INSERT INTO billing_plans (stripe_price_id, name, display_name, price_monthly_mad, max_branches, max_staff, max_orders_daily, features, sort_order)
VALUES
  ('price_lux_starter',    'starter',    'LUX Starter',    299,  1,  5,  150,  '["POS","QR Menu","Basic Analytics"]'::jsonb, 1),
  ('price_lux_pro',        'pro',        'LUX Pro',        699,  3,  20, 1000, '["All Starter","HR","Courier","Analytics"]'::jsonb, 2),
  ('price_lux_enterprise', 'enterprise', 'LUX Enterprise', 1499, 99, 999, 999999, '["Unlimited","API","SLA 99.9%"]'::jsonb, 3)
ON CONFLICT (stripe_price_id) DO NOTHING;
