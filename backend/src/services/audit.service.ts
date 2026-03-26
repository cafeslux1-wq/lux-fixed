/**
 * ══════════════════════════════════════════════════════════
 *  LUX SUPREME — Audit Trail Service
 *  "Who did what, where, and when?"
 *
 *  Logs all sensitive actions:
 *   - Order voids / refunds
 *   - Wallet adjustments
 *   - Inventory overrides
 *   - Price changes
 *   - Payroll runs
 *   - Login events
 *   - Permission denials
 *   - Data exports
 * ══════════════════════════════════════════════════════════
 */

import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { logger } from '../utils/logger';

// ── Audit Entry Interface ─────────────────────────────────────────────────
export interface AuditEntry {
  tenantId?:    string | null;
  branchId?:    string | null;
  actorId?:     string | null;
  actorType:    'staff' | 'customer' | 'system' | 'api';
  action:       string;        // e.g. 'order.void', 'wallet.adjust', 'menu.price_change'
  targetId?:    string | null;
  targetType?:  string | null;
  details?:     Record<string, unknown>;
  requestId?:   string;
  ipAddress?:   string;
  userAgent?:   string;
}

// ── Core audit log function (non-blocking) ────────────────────────────────
export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    await query(`
      INSERT INTO audit_logs (
        tenant_id, branch_id, actor_id, actor_type,
        action, target_id, target_type,
        details, request_id, ip_address, user_agent,
        created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
    `, [
      entry.tenantId   || null,
      entry.branchId   || null,
      entry.actorId    || null,
      entry.actorType,
      entry.action,
      entry.targetId   || null,
      entry.targetType || null,
      JSON.stringify(entry.details || {}),
      entry.requestId  || null,
      entry.ipAddress  || null,
      entry.userAgent  || null,
    ]);
  } catch (err) {
    // Audit logging must NEVER break the main flow
    logger.error('[Audit] Failed to write audit log:', {
      action: entry.action,
      error: (err as Error).message,
    });
  }
}

// ── Express middleware: auto-audit sensitive routes ───────────────────────
// Add to specific routes you want automatically tracked
export function withAudit(action: string, getTargetId?: (req: Request) => string | undefined) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Intercept response to audit after success
    const originalJson = res.json.bind(res);
    res.json = function(data: unknown) {
      const statusCode = res.statusCode;
      if (statusCode >= 200 && statusCode < 300) {
        auditLog({
          tenantId:   req.tenantId,
          branchId:   req.branchId,
          actorId:    req.user?.sub || req.customer?.sub || null,
          actorType:  req.user ? 'staff' : req.customer ? 'customer' : 'system',
          action,
          targetId:   getTargetId ? getTargetId(req) : req.params.id,
          targetType: action.split('.')[0],
          details:    {
            method:    req.method,
            path:      req.path,
            body:      sanitizeBody(req.body),
            response:  typeof data === 'object' && data !== null && 'data' in (data as Record<string, unknown>)
              ? 'success'
              : 'response',
          },
          requestId:  req.requestId,
          ipAddress:  req.ip,
          userAgent:  req.headers['user-agent'],
        }).catch(() => {});
      }
      return originalJson(data);
    };
    next();
  };
}

// ── Audit Query Service ───────────────────────────────────────────────────
export interface AuditQueryParams {
  tenantId:    string;
  branchId?:   string;
  actorId?:    string;
  action?:     string;
  targetType?: string;
  from?:       string;
  to?:         string;
  page?:       number;
  limit?:      number;
}

export async function queryAuditLogs(params: AuditQueryParams) {
  const { tenantId, branchId, actorId, action, targetType, from, to, page = 1, limit = 50 } = params;

  let where = 'WHERE al.tenant_id = $1';
  const queryParams: unknown[] = [tenantId];
  let idx = 2;

  if (branchId)   { where += ` AND al.branch_id = $${idx++}`;   queryParams.push(branchId); }
  if (actorId)    { where += ` AND al.actor_id = $${idx++}`;    queryParams.push(actorId); }
  if (action)     { where += ` AND al.action ILIKE $${idx++}`;  queryParams.push(`%${action}%`); }
  if (targetType) { where += ` AND al.target_type = $${idx++}`; queryParams.push(targetType); }
  if (from)       { where += ` AND al.created_at >= $${idx++}`; queryParams.push(from); }
  if (to)         { where += ` AND al.created_at <= $${idx++}`; queryParams.push(to + ' 23:59:59'); }

  const offset = (page - 1) * limit;

  const [dataResult, countResult] = await Promise.all([
    query(`
      SELECT
        al.id, al.actor_type, al.action,
        al.target_id, al.target_type, al.details,
        al.request_id, al.ip_address, al.created_at,
        s.full_name AS actor_name, s.role AS actor_role,
        b.name AS branch_name
      FROM audit_logs al
      LEFT JOIN staff    s ON s.id = al.actor_id AND al.actor_type = 'staff'
      LEFT JOIN branches b ON b.id = al.branch_id
      ${where}
      ORDER BY al.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...queryParams, limit, offset]),

    query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM audit_logs al ${where}`,
      queryParams
    ),
  ]);

  return {
    rows:     dataResult.rows,
    total:    parseInt(countResult.rows[0]?.count || '0'),
    page,
    per_page: limit,
    pages:    Math.ceil(parseInt(countResult.rows[0]?.count || '0') / limit),
  };
}

// ── Sanitize request body for audit (remove sensitive fields) ─────────────
function sanitizeBody(body: Record<string, unknown>): Record<string, unknown> {
  if (!body || typeof body !== 'object') return {};
  const SENSITIVE = ['password', 'pin', 'pin_code', 'password_hash', 'signature_data', 'card_number'];
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    sanitized[key] = SENSITIVE.includes(key) ? '[REDACTED]' : value;
  }
  return sanitized;
}

// ── Audit summary report ──────────────────────────────────────────────────
export async function getAuditSummary(tenantId: string, branchId?: string, days = 7) {
  const params: unknown[] = [tenantId, days];
  let branchClause = '';
  if (branchId) { branchClause = `AND branch_id = $3`; params.push(branchId); }

  const result = await query(`
    SELECT
      action,
      COUNT(*) AS count,
      COUNT(DISTINCT actor_id) AS unique_actors,
      MAX(created_at) AS last_occurrence
    FROM audit_logs
    WHERE tenant_id = $1
      AND created_at >= NOW() - ($2 || ' days')::INTERVAL
      ${branchClause}
    GROUP BY action
    ORDER BY count DESC
    LIMIT 20
  `, params);

  return result.rows;
}
