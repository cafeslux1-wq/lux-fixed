import Stripe from 'stripe';
import { query, withTransaction } from '../config/database';
import { logger } from '../utils/logger';

if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY required');

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

interface PlanRow { id: string; stripe_price_id: string; name: string; display_name: string; price_monthly_mad: string; max_branches: number; max_staff: number; max_orders_daily: number; features: unknown; sort_order: number }
export async function getPlans(): Promise<PlanRow[]> {
  const result = await query<PlanRow>(`SELECT id, stripe_price_id, name, display_name, price_monthly_mad, max_branches, max_staff, max_orders_daily, features, sort_order FROM billing_plans WHERE is_active = true ORDER BY sort_order`);
  return result.rows;
}

export async function createStripeCustomer(tenantId: string, tenantName: string, email: string): Promise<string> {
  const customer = await stripe.customers.create({ name: tenantName, email, metadata: { tenantId } });
  await query(`UPDATE tenants SET stripe_customer_id = $1 WHERE id = $2`, [customer.id, tenantId]);
  await query(`UPDATE subscriptions SET stripe_customer_id = $1 WHERE tenant_id = $2`, [customer.id, tenantId]);
  logger.info(`[Stripe] Customer ${customer.id} for tenant ${tenantId}`);
  return customer.id;
}

export async function ensureStripeCustomer(tenantId: string): Promise<string> {
  const result = await query<{ stripe_customer_id: string | null; name: string; email: string }>(
    `SELECT t.stripe_customer_id, t.name, s.email FROM tenants t LEFT JOIN staff s ON s.tenant_id = t.id AND s.role = 'owner' WHERE t.id = $1 LIMIT 1`, [tenantId]
  );
  if (!result.rows.length) throw new Error('Tenant not found');
  const { stripe_customer_id, name, email } = result.rows[0];
  if (stripe_customer_id) return stripe_customer_id;
  return createStripeCustomer(tenantId, name, email || `${tenantId}@lux.ma`);
}

export async function createCheckoutSession(params: { tenantId: string; priceId: string; successUrl: string; cancelUrl: string }): Promise<Stripe.Checkout.Session> {
  const customerId = await ensureStripeCustomer(params.tenantId);
  return stripe.checkout.sessions.create({ customer: customerId, mode: 'subscription', line_items: [{ price: params.priceId, quantity: 1 }], success_url: params.successUrl, cancel_url: params.cancelUrl, metadata: { tenantId: params.tenantId }, allow_promotion_codes: true });
}

export async function createPortalSession(tenantId: string, returnUrl: string): Promise<Stripe.BillingPortal.Session> {
  const customerId = await ensureStripeCustomer(tenantId);
  return stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
}

export function constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET not set');
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

export async function syncSubscriptionToDB(sub: Stripe.Subscription): Promise<void> {
  const tenantId = sub.metadata?.tenantId;
  if (!tenantId) { logger.warn('[Stripe] Subscription missing tenantId metadata'); return; }
  const priceId = sub.items.data[0]?.price?.id;
  await withTransaction(async (client) => {
    const planResult = await client.query<{ id: string; name: string }>(`SELECT id, name FROM billing_plans WHERE stripe_price_id = $1`, [priceId]);
    const planId = planResult.rows[0]?.id; const planName = planResult.rows[0]?.name || 'pro';
    await client.query(`INSERT INTO subscriptions (tenant_id, plan_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, status, current_period_start, current_period_end, cancel_at_period_end) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (tenant_id) DO UPDATE SET plan_id=$2, stripe_subscription_id=$4, stripe_price_id=$5, status=$6, current_period_start=$7, current_period_end=$8, cancel_at_period_end=$9, updated_at=NOW()`,
      [tenantId, planId, sub.customer as string, sub.id, priceId, sub.status, new Date(sub.current_period_start * 1000).toISOString(), new Date(sub.current_period_end * 1000).toISOString(), sub.cancel_at_period_end]);
    await client.query(`UPDATE tenants SET stripe_customer_id=$1, plan=$2 WHERE id=$3`, [sub.customer as string, planName, tenantId]);
  });
}

export async function getSubscription(tenantId: string) {
  const result = await query(`SELECT s.id, s.status, s.stripe_subscription_id, s.stripe_customer_id, s.cancel_at_period_end, s.trial_ends_at, s.current_period_start, s.current_period_end, s.payment_method_brand, s.payment_method_last4, s.payment_method_exp, s.canceled_at, bp.name AS plan_name, bp.display_name AS plan_display, bp.price_monthly_mad, bp.max_branches, bp.max_staff, bp.max_orders_daily, bp.features FROM subscriptions s JOIN billing_plans bp ON bp.id = s.plan_id WHERE s.tenant_id = $1`, [tenantId]);
  return result.rows[0] || null;
}
