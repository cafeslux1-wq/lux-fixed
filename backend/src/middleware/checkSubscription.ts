import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { logger } from '../utils/logger';

interface SubCache {
  status:         string;
  planName:       string;
  maxBranches:    number;
  maxStaff:       number;
  maxOrdersDaily: number;
  periodEnd:      string | null;
  fetchedAt:      number;
}

const subCache = new Map<string, SubCache>();
const CACHE_TTL = 60_000;

export function invalidateSubscriptionCache(tenantId: string): void {
  subCache.delete(tenantId);
}

async function fetchSub(tenantId: string): Promise<SubCache | null> {
  const cached = subCache.get(tenantId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached;

  const result = await query<{ status: string; name: string; max_branches: number; max_staff: number; max_orders_daily: number; current_period_end: string | null }>(
    `SELECT s.status, bp.name, bp.max_branches, bp.max_staff, bp.max_orders_daily, s.current_period_end
     FROM subscriptions s JOIN billing_plans bp ON bp.id = s.plan_id WHERE s.tenant_id = $1`,
    [tenantId]
  );
  if (!result.rows.length) return null;
  const r = result.rows[0];
  const sub: SubCache = { status: r.status, planName: r.name, maxBranches: r.max_branches, maxStaff: r.max_staff, maxOrdersDaily: r.max_orders_daily, periodEnd: r.current_period_end, fetchedAt: Date.now() };
  subCache.set(tenantId, sub);
  return sub;
}

export async function checkSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
  const tenantId = req.tenantId;
  if (!tenantId || req.path.startsWith('/billing') || req.path.startsWith('/auth')) { next(); return; }
  try {
    const sub = await fetchSub(tenantId);
    if (!sub) { next(); return; }
    if (['active','trialing'].includes(sub.status)) {
      req.subscriptionLimits = { maxBranches: sub.maxBranches, maxStaff: sub.maxStaff, maxOrdersDaily: sub.maxOrdersDaily, planName: sub.planName };
      next(); return;
    }
    if (sub.status === 'past_due') {
      const daysPast = sub.periodEnd ? (Date.now() - new Date(sub.periodEnd).getTime()) / 86400000 : 0;
      if (daysPast > 7 && ['POST','PUT','PATCH','DELETE'].includes(req.method) && !req.path.startsWith('/orders')) {
        res.status(402).json({ success: false, errorCode: 'SUBSCRIPTION_PAST_DUE', error: 'Paiement en attente', upgradeUrl: '/billing' }); return;
      }
      req.subscriptionLimits = { maxBranches: sub.maxBranches, maxStaff: sub.maxStaff, maxOrdersDaily: sub.maxOrdersDaily, planName: sub.planName, isPastDue: true };
      next(); return;
    }
    if (['canceled','unpaid','incomplete'].includes(sub.status) && req.method !== 'GET') {
      res.status(402).json({ success: false, errorCode: 'SUBSCRIPTION_INACTIVE', error: 'Abonnement inactif', upgradeUrl: '/billing' }); return;
    }
    next();
  } catch (err) {
    logger.error('[Subscription] Check failed — allowing request:', (err as Error).message);
    next();
  }
}

export async function checkOrderLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.method !== 'POST') { next(); return; }
  const limits = req.subscriptionLimits;
  const tenantId = req.tenantId;
  if (!limits || !tenantId) { next(); return; }
  try {
    const r = await query<{ count: string }>(`SELECT COUNT(*) AS count FROM orders WHERE tenant_id = $1 AND DATE(created_at) = CURRENT_DATE AND NOT is_voided`, [tenantId]);
    if (parseInt(r.rows[0]?.count || '0') >= limits.maxOrdersDaily) {
      res.status(402).json({ success: false, errorCode: 'PLAN_LIMIT_ORDERS', error: `Limite ${limits.maxOrdersDaily} commandes/jour atteinte`, upgradeUrl: '/billing' }); return;
    }
    next();
  } catch { next(); }
}

export async function checkStaffLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.method !== 'POST') { next(); return; }
  const limits = req.subscriptionLimits;
  const tenantId = req.tenantId;
  if (!limits || !tenantId) { next(); return; }
  try {
    const r = await query<{ count: string }>(`SELECT COUNT(*) AS count FROM staff WHERE tenant_id = $1 AND status != 'terminated'`, [tenantId]);
    if (parseInt(r.rows[0]?.count || '0') >= limits.maxStaff) {
      res.status(402).json({ success: false, errorCode: 'PLAN_LIMIT_STAFF', error: `Limite ${limits.maxStaff} employés atteinte`, upgradeUrl: '/billing' }); return;
    }
    next();
  } catch { next(); }
}
