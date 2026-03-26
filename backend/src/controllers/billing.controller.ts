import { Request, Response } from 'express';
import Stripe from 'stripe';
import { query, withTransaction } from '../config/database';
import { sendSuccess, sendCreated, sendError, sendNotFound } from '../utils/response';
import { logger } from '../utils/logger';
import { auditLog } from '../services/audit.service';
import { stripe, getPlans, createCheckoutSession, createPortalSession, constructEvent, syncSubscriptionToDB, getSubscription, ensureStripeCustomer } from '../services/stripe.service';
import { processReferralCommission, handleReferralChurn } from '../services/referral.service';
import { invalidateSubscriptionCache } from '../middleware/checkSubscription';

export async function listPlans(req: Request, res: Response): Promise<void> {
  try {
    const plans = await getPlans();
    sendSuccess(res, plans.map(p => ({ id: p.id, name: p.name, displayName: p.display_name, priceMonthlyMAD: parseFloat(p.price_monthly_mad), stripePriceId: p.stripe_price_id, limits: { branches: p.max_branches, staff: p.max_staff, ordersDaily: p.max_orders_daily }, features: p.features })));
  } catch (err) { sendError(res, 'Failed to fetch plans'); }
}

export async function getMySubscription(req: Request, res: Response): Promise<void> {
  try {
    const sub = await getSubscription(req.tenantId!) as Record<string, unknown> | null;
    if (!sub) { sendNotFound(res, 'Subscription'); return; }
    const now = new Date();
    const daysLeft = sub.current_period_end ? Math.max(0, Math.ceil((new Date(sub.current_period_end as string).getTime() - now.getTime()) / 86400000)) : null;
    const trialDaysLeft = sub.trial_ends_at && sub.status === 'trialing' ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at as string).getTime() - now.getTime()) / 86400000)) : null;
    sendSuccess(res, { ...sub, isActive: ['active','trialing'].includes(sub['status'] as string), daysLeft, trialDaysLeft, paymentMethod: sub['payment_method_last4'] ? { brand: sub['payment_method_brand'], last4: sub['payment_method_last4'], exp: sub['payment_method_exp'] } : null });
  } catch (err) { sendError(res, 'Failed to fetch subscription'); }
}

export async function createCheckout(req: Request, res: Response): Promise<void> {
  try {
    const { priceId, successPath = '/billing?success=1', cancelPath = '/billing' } = req.body;
    const tenantId    = req.tenantId!;
    const frontendUrl = process.env.FRONTEND_URL || 'https://www.cafeslux.com';
    const planCheck   = await query(`SELECT id FROM billing_plans WHERE stripe_price_id=$1 AND is_active=true`, [priceId]);
    if (!planCheck.rows.length) { sendError(res, 'Invalid plan', 422); return; }
    const session = await createCheckoutSession({ tenantId, priceId, successUrl: `${frontendUrl}${successPath}&session_id={CHECKOUT_SESSION_ID}`, cancelUrl: `${frontendUrl}${cancelPath}` });
    await auditLog({ tenantId, actorId: req.user?.sub, actorType: 'staff', action: 'billing.checkout_created', details: { priceId }, requestId: req.requestId });
    sendSuccess(res, { checkoutUrl: session.url, sessionId: session.id });
  } catch (err) { sendError(res, `Checkout failed: ${(err as Error).message}`); }
}

export async function openPortal(req: Request, res: Response): Promise<void> {
  try {
    const frontendUrl = process.env.FRONTEND_URL || 'https://www.cafeslux.com';
    const session = await createPortalSession(req.tenantId!, `${frontendUrl}/billing`);
    sendSuccess(res, { portalUrl: session.url });
  } catch (err) { sendError(res, `Portal failed: ${(err as Error).message}`); }
}

export async function getInvoices(req: Request, res: Response): Promise<void> {
  try {
    const result = await query(`SELECT stripe_invoice_id, amount_due, amount_paid, currency, status, invoice_url, invoice_pdf, period_start, period_end, paid_at, created_at FROM invoices WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 24`, [req.tenantId]);
    sendSuccess(res, result.rows.map((inv: Record<string, unknown>) => ({ id: inv['stripe_invoice_id'], amount: parseFloat(inv['amount_due'] as string), paid: parseFloat(inv['amount_paid'] as string || '0'), currency: (inv['currency'] as string || '').toUpperCase(), status: inv['status'], invoiceUrl: inv['invoice_url'], pdfUrl: inv['invoice_pdf'], paidAt: inv['paid_at'], createdAt: inv['created_at'] })));
  } catch { sendError(res, 'Failed to fetch invoices'); }
}

export async function handleWebhook(req: Request, res: Response): Promise<void> {
  const signature = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;
  try { event = constructEvent(req.body as Buffer, signature); }
  catch (err) { logger.warn('[Stripe] Webhook verification failed:', (err as Error).message); res.status(400).json({ error: 'Invalid signature' }); return; }

  const existing = await query(`SELECT processed FROM stripe_events WHERE stripe_event_id=$1`, [event.id]);
  if (existing.rows.length && existing.rows[0].processed) { res.json({ received: true, duplicate: true }); return; }

  await query(`INSERT INTO stripe_events (stripe_event_id, event_type, payload) VALUES ($1,$2,$3) ON CONFLICT (stripe_event_id) DO NOTHING`, [event.id, event.type, JSON.stringify(event.data.object)]).catch(() => {});

  try {
    await processWebhookEvent(event);
    await query(`UPDATE stripe_events SET processed=true WHERE stripe_event_id=$1`, [event.id]);
    res.json({ received: true });
  } catch (err) {
    const msg = (err as Error).message;
    logger.error(`[Stripe] Event processing failed: ${event.type}`, err);
    await query(`UPDATE stripe_events SET processed=false, error_message=$1 WHERE stripe_event_id=$2`, [msg, event.id]);
    res.json({ received: true, error: msg });
  }
}

async function processWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === 'subscription' && session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        await syncSubscriptionToDB(sub);
      }
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await syncSubscriptionToDB(event.data.object as Stripe.Subscription);
      break;
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const tenantId = sub.metadata?.tenantId;
      if (!tenantId) break;
      await withTransaction(async (client) => {
        await client.query(`UPDATE subscriptions SET status='canceled', canceled_at=NOW(), updated_at=NOW() WHERE tenant_id=$1`, [tenantId]);
        await client.query(`UPDATE tenants SET plan='canceled' WHERE id=$1`, [tenantId]);
      });
      await handleReferralChurn(tenantId);
      invalidateSubscriptionCache(tenantId);
      break;
    }
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      const tenantId   = await resolveTenantFromCustomer(customerId);
      if (!tenantId) break;
      const periodMonth = invoice.period_start ? new Date(invoice.period_start * 1000).toISOString().slice(0,7) : new Date().toISOString().slice(0,7);
      await withTransaction(async (client) => {
        await client.query(`UPDATE subscriptions SET status='active', updated_at=NOW() WHERE stripe_customer_id=$1`, [customerId]);
        await client.query(`UPDATE tenants SET total_revenue=COALESCE(total_revenue,0)+$1, first_payment_at=COALESCE(first_payment_at,NOW()) WHERE id=$2`, [(invoice.amount_paid || 0)/100, tenantId]);
        await client.query(`INSERT INTO invoices (tenant_id, stripe_invoice_id, stripe_customer_id, amount_due, amount_paid, currency, status, invoice_url, invoice_pdf, period_start, period_end, paid_at) VALUES ($1,$2,$3,$4,$5,$6,'paid',$7,$8,$9,$10,$11) ON CONFLICT (stripe_invoice_id) DO UPDATE SET status='paid', amount_paid=EXCLUDED.amount_paid, paid_at=EXCLUDED.paid_at`,
          [tenantId, invoice.id, customerId, (invoice.amount_due||0)/100, (invoice.amount_paid||0)/100, invoice.currency, invoice.hosted_invoice_url, invoice.invoice_pdf, invoice.period_start ? new Date(invoice.period_start*1000).toISOString() : null, invoice.period_end ? new Date(invoice.period_end*1000).toISOString() : null, new Date().toISOString()]);
      });
      const grossUSD = (invoice.amount_paid || 0) / 100;
      if (grossUSD > 0) await processReferralCommission({ referredTenantId: tenantId, grossAmount: grossUSD, currency: invoice.currency, stripeInvoiceId: invoice.id, periodMonth });
      invalidateSubscriptionCache(tenantId);
      logger.info(`[Stripe] Payment succeeded: tenant ${tenantId} — $${grossUSD}`);
      break;
    }
    case 'invoice.payment_failed': {
      const invoice  = event.data.object as Stripe.Invoice;
      const tenantId = await resolveTenantFromCustomer(invoice.customer as string);
      if (!tenantId) break;
      await query(`UPDATE subscriptions SET status='past_due', updated_at=NOW() WHERE stripe_customer_id=$1`, [invoice.customer as string]);
      invalidateSubscriptionCache(tenantId);
      logger.warn(`[Stripe] Payment FAILED: tenant ${tenantId}`);
      break;
    }
    default: logger.debug(`[Stripe] Unhandled: ${event.type}`);
  }
}

async function resolveTenantFromCustomer(customerId: string): Promise<string | null> {
  const result = await query<{ tenant_id: string }>(`SELECT tenant_id FROM subscriptions WHERE stripe_customer_id=$1`, [customerId]);
  return result.rows[0]?.tenant_id || null;
}
