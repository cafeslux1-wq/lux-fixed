import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { sendError } from '../utils/response';
import { query } from '../config/database';
import { PERMISSIONS } from '../types/permissions';

// ── Joi Validation ────────────────────────────────────────────────────────
type ValidationTarget = 'body' | 'query' | 'params';

export function validate(schema: Joi.Schema, target: ValidationTarget = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[target], { abortEarly: false, stripUnknown: true });
    if (error) {
      const msg = error.details.map(d => d.message).join(', ');
      sendError(res, msg, 422);
      return;
    }
    req[target] = value;
    next();
  };
}

export const paginationQuery = Joi.object({
  page:        Joi.number().integer().min(1).default(1),
  limit:       Joi.number().integer().min(1).max(200).default(30),
  branchId:    Joi.string().uuid().optional(),
  status:      Joi.string().optional(),
  from:        Joi.string().isoDate().optional(),
  to:          Joi.string().isoDate().optional(),
  source:      Joi.string().optional(),
  sessionType: Joi.string().optional(),
  date:        Joi.string().isoDate().optional(),
  search:      Joi.string().optional(),
});

// ── RBAC middleware ───────────────────────────────────────────────────────
export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = req.user?.role;
    if (!userRole || !roles.includes(userRole)) {
      res.status(403).json({ success: false, error: `Required role: ${roles.join(' | ')}. You have: ${userRole || 'none'}` });
      return;
    }
    next();
  };
}

// ── Super-admin guard ─────────────────────────────────────────────────────
export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await query<{ is_super_admin: boolean }>(
      `SELECT is_super_admin FROM tenants WHERE id = $1`,
      [req.tenantId]
    );
    if (!result.rows[0]?.is_super_admin) {
      res.status(403).json({ success: false, error: 'Super-admin access required' });
      return;
    }
    next();
  } catch {
    res.status(500).json({ success: false, error: 'Auth check failed' });
  }
}
