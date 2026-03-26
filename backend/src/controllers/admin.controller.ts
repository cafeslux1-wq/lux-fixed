import { Request, Response } from 'express';
import { query } from '../config/database';
import { sendSuccess, sendError } from '../utils/response';
import { logger } from '../utils/logger';
import { getReferralStats } from '../services/referral.service';
import { calculateShiftProfitSharing } from '../services/profit-sharing.service';

interface KPIOverview { total_tenants: string; active: string; trialing: string; past_due: string }
interface MRRRow { mrr_mad: string; paying_tenants: string; arpu_mad: string }
interface ChurnRow { churned: string }
interface TenantRow { id: string; name: string; plan: string; sub_status: string; plan_display: string; monthly_revenue: string; current_period_end: string | null; lifetime_revenue: string; tenure_months: string; branches: string; staff_count: string }
interface SignupRow { date: string; count: string }
interface MRRSnapshotRow { snapshot_date: string; mrr_mad: string; active_tenants: number }
interface ReferrerRow { referrer_name: string; total_referrals: string; active_referrals: string; total_earned: string }

export async function getPlatformKPIs(req: Request, res: Response): Promise<void> {
  try {
    const [ov1, mrr1, churn1, tenants1, signup1, hist1, ref1] = await Promise.all([
      query<KPIOverview>(`SELECT COUNT(*) AS total_tenants, COUNT(*) FILTER (WHERE s.status='active') AS active, COUNT(*) FILTER (WHERE s.status='trialing') AS trialing, COUNT(*) FILTER (WHERE s.status='past_due') AS past_due FROM tenants t LEFT JOIN subscriptions s ON s.tenant_id=t.id WHERE t.is_active=true AND t.is_super_admin=false`),
      query<MRRRow>(`SELECT COALESCE(SUM(bp.price_monthly_mad),0) AS mrr_mad, COUNT(DISTINCT s.tenant_id) AS paying_tenants, CASE WHEN COUNT(DISTINCT s.tenant_id)>0 THEN COALESCE(SUM(bp.price_monthly_mad),0)/COUNT(DISTINCT s.tenant_id) ELSE 0 END AS arpu_mad FROM subscriptions s JOIN billing_plans bp ON bp.id=s.plan_id WHERE s.status='active'`),
      query<ChurnRow>(`SELECT COUNT(*) AS churned FROM subscriptions WHERE status='canceled' AND canceled_at>=DATE_TRUNC('month',NOW())`),
      query<TenantRow>(`SELECT t.id, t.name, t.plan, s.status AS sub_status, bp.display_name AS plan_display, CAST(bp.price_monthly_mad AS TEXT) AS monthly_revenue, s.current_period_end, COALESCE(CAST(t.total_revenue AS TEXT),'0') AS lifetime_revenue, '0' AS tenure_months, CAST((SELECT COUNT(*) FROM branches b WHERE b.tenant_id=t.id) AS TEXT) AS branches, CAST((SELECT COUNT(*) FROM staff st WHERE st.tenant_id=t.id AND st.status='active') AS TEXT) AS staff_count FROM tenants t JOIN subscriptions s ON s.tenant_id=t.id JOIN billing_plans bp ON bp.id=s.plan_id WHERE t.is_active=true AND t.is_super_admin=false ORDER BY bp.price_monthly_mad DESC LIMIT 20`),
      query<SignupRow>(`SELECT CAST(DATE(created_at) AS TEXT) AS date, CAST(COUNT(*) AS TEXT) AS count FROM tenants WHERE created_at>=NOW()-INTERVAL '30 days' AND is_super_admin=false GROUP BY DATE(created_at) ORDER BY date`),
      query<MRRSnapshotRow>(`SELECT CAST(snapshot_date AS TEXT) AS snapshot_date, CAST(mrr_mad AS TEXT) AS mrr_mad, active_tenants FROM mrr_snapshots WHERE snapshot_date>=CURRENT_DATE-INTERVAL '90 days' ORDER BY snapshot_date`),
      query<ReferrerRow>(`SELECT t.name AS referrer_name, CAST(COUNT(r.id) AS TEXT) AS total_referrals, CAST(COUNT(r.id) FILTER (WHERE r.status='active') AS TEXT) AS active_referrals, CAST(COALESCE(SUM(c.commission_amount),0) AS TEXT) AS total_earned FROM tenants t JOIN referrals r ON r.referrer_tenant_id=t.id LEFT JOIN commissions c ON c.referrer_tenant_id=t.id AND c.status!='cancelled' GROUP BY t.id, t.name HAVING COUNT(r.id)>0 ORDER BY total_earned DESC LIMIT 10`),
    ]);

    const ov  = ov1.rows[0];
    const mrr = mrr1.rows[0];
    const active  = parseInt(ov?.active || '0');
    const churned = parseInt(churn1.rows[0]?.churned || '0');
    const churnRate = (active + churned) > 0 ? parseFloat((churned / (active + churned) * 100).toFixed(2)) : 0;
    const mrrMAD = parseFloat(mrr?.mrr_mad || '0');
    const arpu   = parseFloat(mrr?.arpu_mad || '0');
    const ltv    = churnRate > 0 ? parseFloat((arpu * Math.min(1 / (churnRate / 100), 36)).toFixed(2)) : parseFloat((arpu * 12).toFixed(2));

    sendSuccess(res, {
      overview: { totalTenants: parseInt(ov?.total_tenants || '0'), activeTenants: active, trialingTenants: parseInt(ov?.trialing || '0'), pastDue: parseInt(ov?.past_due || '0'), payingTenants: parseInt(mrr?.paying_tenants || '0') },
      revenue:  { mrrMAD, arrMAD: mrrMAD * 12, arpu, ltv, mrrTrend: 0 },
      churn:    { count: churned, rate: churnRate },
      topTenants: tenants1.rows.map(t => ({ id: t.id, name: t.name, plan: t.plan_display, status: t.sub_status, monthlyRevenue: parseFloat(t.monthly_revenue || '0'), lifetimeRevenue: parseFloat(t.lifetime_revenue || '0'), tenureMonths: parseFloat(t.tenure_months || '0'), branches: parseInt(t.branches), staff: parseInt(t.staff_count), renewsAt: t.current_period_end })),
      mrrHistory:   hist1.rows.map(r => ({ date: r.snapshot_date, mrr: parseFloat(r.mrr_mad), tenants: r.active_tenants })),
      topReferrers: ref1.rows.map(r => ({ name: r.referrer_name, totalReferrals: parseInt(r.total_referrals), activeReferrals: parseInt(r.active_referrals), totalEarned: parseFloat(r.total_earned) })),
      signupChart:  signup1.rows,
      generatedAt:  new Date().toISOString(),
    });
  } catch (err) { logger.error('[Admin] KPI failed:', err); sendError(res, 'Failed to fetch KPIs'); }
}

export async function getMyReferralStats(req: Request, res: Response): Promise<void> {
  try { sendSuccess(res, await getReferralStats(req.tenantId!)); }
  catch { sendError(res, 'Failed'); }
}

export async function getReferralLeaderboard(_req: Request, res: Response): Promise<void> {
  try {
    const result = await query<ReferrerRow>(`SELECT t.name AS referrer_name, CAST(COUNT(r.id) AS TEXT) AS total_referrals, CAST(COUNT(r.id) FILTER (WHERE r.status='active') AS TEXT) AS active_referrals, CAST(COALESCE(SUM(c.commission_amount),0) AS TEXT) AS total_earned FROM tenants t JOIN referrals r ON r.referrer_tenant_id=t.id LEFT JOIN commissions c ON c.referrer_tenant_id=t.id AND c.status!='cancelled' WHERE t.is_active=true GROUP BY t.id, t.name HAVING COUNT(r.id)>0 ORDER BY total_earned DESC LIMIT 20`);
    sendSuccess(res, result.rows);
  } catch { sendError(res, 'Failed'); }
}

export async function requestPayout(req: Request, res: Response): Promise<void> {
  try {
    const { amount, iban, method = 'bank_transfer' } = req.body as { amount: number; iban?: string; method?: string };
    const balResult = await query<{ referral_balance: string }>(`SELECT referral_balance FROM tenants WHERE id=$1`, [req.tenantId!]);
    const balance = parseFloat(balResult.rows[0]?.referral_balance || '0');
    if (amount > balance) { sendError(res, `Insufficient balance: ${balance.toFixed(2)} available`, 402); return; }
    if (amount < 20) { sendError(res, 'Minimum payout is 20', 422); return; }
    await query(`INSERT INTO payout_requests (tenant_id, amount, method, iban) VALUES ($1,$2,$3,$4)`, [req.tenantId!, amount, method, iban || null]);
    const d = new Date(); d.setMonth(d.getMonth() + 1, 1);
    sendSuccess(res, { requested: true, amount, estimatedDate: d.toISOString().slice(0, 10) });
  } catch { sendError(res, 'Payout failed'); }
}

export async function overridePenalty(req: Request, res: Response): Promise<void> {
  try {
    const { staffId, type, amount, reason } = req.body as { staffId: string; type: string; amount: number; reason?: string };
    if (type === 'delay') await query(`UPDATE attendance SET delay_penalty=$1 WHERE staff_id=$2 AND work_date=CURRENT_DATE`, [amount, staffId]);
    else if (type === 'task') await query(`UPDATE daily_task_logs SET penalty_applied=$1, dispute_note=$2 WHERE staff_id=$3 AND task_date=CURRENT_DATE`, [amount, reason || 'Admin override', staffId]);
    sendSuccess(res, { overridden: true, staffId, type, newAmount: amount });
  } catch { sendError(res, 'Override failed'); }
}

export async function calculateProfitShare(req: Request, res: Response): Promise<void> {
  try {
    const { branchId, shiftDate, shiftType } = req.body as { branchId: string; shiftDate: string; shiftType: 'morning' | 'evening' };
    sendSuccess(res, await calculateShiftProfitSharing(branchId, shiftDate, shiftType));
  } catch (err) { sendError(res, `Profit sharing failed: ${(err as Error).message}`); }
}
