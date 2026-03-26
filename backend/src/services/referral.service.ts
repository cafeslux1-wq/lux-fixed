import { query, withTransaction } from '../config/database';
import { logger } from '../utils/logger';

const COMMISSION_RATE = 0.20;

export function generateReferralCode(tenantId: string): string {
  const hash = Buffer.from(tenantId).toString('base64').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  return `LUX-${hash.slice(0, 8)}`;
}

export async function assignReferralCode(tenantId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = attempt === 0
      ? Buffer.from(tenantId).toString('base64').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 8)
      : Math.random().toString(36).slice(2, 10).toUpperCase();
    const code = `LUX-${suffix}`;
    try {
      await query(`UPDATE tenants SET referral_code = $1 WHERE id = $2`, [code, tenantId]);
      return code;
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code !== '23505') throw e;
    }
  }
  throw new Error('Could not generate unique referral code');
}

export async function handleReferralOnSignup(newTenantId: string, refCode: string | null | undefined): Promise<void> {
  if (!refCode) return;
  const referrerResult = await query<{ id: string }>(`SELECT id FROM tenants WHERE referral_code = $1 AND is_active = true`, [refCode.toUpperCase().trim()]);
  if (!referrerResult.rows.length) { logger.warn(`[Referral] Unknown ref code: ${refCode}`); return; }
  const referrerId = referrerResult.rows[0].id;
  if (referrerId === newTenantId) return;
  await withTransaction(async (client) => {
    await client.query(`UPDATE tenants SET referred_by = $1 WHERE id = $2`, [referrerId, newTenantId]);
    await client.query(`INSERT INTO referrals (referrer_tenant_id, referred_tenant_id, referral_code_used, status) VALUES ($1,$2,$3,'pending') ON CONFLICT (referred_tenant_id) DO NOTHING`, [referrerId, newTenantId, refCode.toUpperCase().trim()]);
  });
  logger.info(`[Referral] ${referrerId} → ${newTenantId}`);
}

export async function processReferralCommission(params: { referredTenantId: string; grossAmount: number; currency: string; stripeInvoiceId: string; periodMonth: string }): Promise<void> {
  const { referredTenantId, grossAmount, currency, stripeInvoiceId, periodMonth } = params;
  const referralResult = await query<{ id: string; referrer_tenant_id: string; status: string }>(`SELECT id, referrer_tenant_id, status FROM referrals WHERE referred_tenant_id = $1`, [referredTenantId]);
  if (!referralResult.rows.length) return;
  const referral = referralResult.rows[0];
  const commission = parseFloat((grossAmount * COMMISSION_RATE).toFixed(2));
  await withTransaction(async (client) => {
    await client.query(`INSERT INTO commissions (referral_id, referrer_tenant_id, referred_tenant_id, stripe_invoice_id, gross_amount, commission_rate, commission_amount, currency, status, period_month) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9) ON CONFLICT (referral_id, period_month) DO NOTHING`, [referral.id, referral.referrer_tenant_id, referredTenantId, stripeInvoiceId, grossAmount, COMMISSION_RATE, commission, currency, periodMonth]);
    if (referral.status === 'pending') {
      await client.query(`UPDATE referrals SET status = 'active', activated_at = NOW(), last_commission_at = NOW(), lifetime_earned = lifetime_earned + $1 WHERE id = $2`, [commission, referral.id]);
    } else {
      await client.query(`UPDATE referrals SET last_commission_at = NOW(), lifetime_earned = lifetime_earned + $1 WHERE id = $2`, [commission, referral.id]);
    }
    await client.query(`UPDATE tenants SET referral_balance = referral_balance + $1 WHERE id = $2`, [commission, referral.referrer_tenant_id]);
  });
  logger.info(`[Commission] +$${commission} to ${referral.referrer_tenant_id}`);
}

export async function handleReferralChurn(referredTenantId: string): Promise<void> {
  await query(`UPDATE referrals SET status = 'churned' WHERE referred_tenant_id = $1`, [referredTenantId]);
}

export async function getReferralStats(tenantId: string) {
  const [referrals, earnings, balance] = await Promise.all([
    query(`SELECT r.id, r.status, r.activated_at, r.lifetime_earned, r.created_at, t.name AS referred_name, t.plan AS referred_plan FROM referrals r JOIN tenants t ON t.id = r.referred_tenant_id WHERE r.referrer_tenant_id = $1 ORDER BY r.created_at DESC`, [tenantId]),
    query<{ total_paid: string; pending: string; total_commissions: string }>(`SELECT COALESCE(SUM(commission_amount) FILTER (WHERE status='paid_out'),0) AS total_paid, COALESCE(SUM(commission_amount) FILTER (WHERE status='pending'),0) AS pending, COUNT(*) AS total_commissions FROM commissions WHERE referrer_tenant_id = $1`, [tenantId]),
    query<{ referral_balance: string; referral_code: string }>(`SELECT referral_balance, referral_code FROM tenants WHERE id = $1`, [tenantId]),
  ]);
  return { referralCode: balance.rows[0]?.referral_code || '', balance: parseFloat(balance.rows[0]?.referral_balance || '0'), totalPaid: parseFloat(earnings.rows[0]?.total_paid || '0'), pendingEarnings: parseFloat(earnings.rows[0]?.pending || '0'), totalReferrals: referrals.rows.length, activeReferrals: referrals.rows.filter(r => r.status === 'active').length, referrals: referrals.rows };
}
