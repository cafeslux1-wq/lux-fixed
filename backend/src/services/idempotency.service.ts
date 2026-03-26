import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { logger } from '../utils/logger';

const IDEMPOTENCY_TTL_HOURS = 24;

export async function checkIdempotencyKey(key: string, tenantId: string, endpoint: string):
  Promise<{ isDuplicate: boolean; cachedResponse?: unknown; orderId?: string }> {
  const result = await query<{ response_body: unknown; order_id: string | null }>(
    `SELECT response_body, order_id FROM idempotency_keys WHERE key = $1 AND tenant_id = $2 AND expires_at > NOW()`,
    [key, tenantId]
  );
  if (result.rows.length) {
    return { isDuplicate: true, cachedResponse: result.rows[0].response_body, orderId: result.rows[0].order_id || undefined };
  }
  return { isDuplicate: false };
}

export async function storeIdempotencyKey(key: string, tenantId: string, endpoint: string, responseStatus: number, responseBody: unknown, orderId?: string): Promise<void> {
  await query(
    `INSERT INTO idempotency_keys (key, tenant_id, endpoint, response_status, response_body, order_id, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6, NOW() + INTERVAL '${IDEMPOTENCY_TTL_HOURS} hours')
     ON CONFLICT (key) DO NOTHING`,
    [key, tenantId, endpoint, responseStatus, JSON.stringify(responseBody), orderId || null]
  );
}

export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== 'POST') { next(); return; }
  const key = req.headers['x-idempotency-key'] as string;
  if (!key) { next(); return; }
  if (key.length > 100) { res.status(422).json({ success: false, error: 'X-Idempotency-Key must be ≤100 chars' }); return; }
  (req as Request & { idempotencyKey?: string }).idempotencyKey = key;
  next();
}

export async function cleanupExpiredKeys(): Promise<number> {
  const result = await query(`DELETE FROM idempotency_keys WHERE expires_at < NOW()`);
  const deleted = result.rowCount || 0;
  if (deleted > 0) logger.info(`[Idempotency] Cleaned ${deleted} expired keys`);
  return deleted;
}
