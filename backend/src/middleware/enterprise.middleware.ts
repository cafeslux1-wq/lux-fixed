/**
 * ══════════════════════════════════════════════════════════
 *  LUX SUPREME — Enterprise Middleware Suite
 *
 *  1. tenantMiddleware   → Strict tenant/branch extraction + validation
 *  2. requirePermission  → Granular RBAC (replaces requireRole)
 *  3. requestId          → Unique request tracking for all logs
 *  4. rateLimitByTenant  → Per-tenant rate limiting
 * ══════════════════════════════════════════════════════════
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import { sendUnauthorized, sendForbidden, sendError } from '../utils/response';
import { logger } from '../utils/logger';
import {
  Permission, StaffRole,
  roleHasPermission, getPermissionsForRole
} from '../types/permissions';
import { auditLog } from '../services/audit.service';

// ── Extend Express Request ────────────────────────────────────────────────
declare global {
  namespace Express {
    interface Request {
      requestId:   string;
      tenantId?:   string;
      branchId?:   string;
      user?:       StaffJWTPayload;
      customer?:   CustomerJWTPayload;
      permissions: Permission[];
    }
  }
}

export interface StaffJWTPayload {
  sub:         string;
  tenantId:    string;
  branchId:    string;
  role:        StaffRole;
  type:        'staff';
  permissions: Permission[];
  iat:         number;
  exp:         number;
}

export interface CustomerJWTPayload {
  sub:      string;
  tenantId: string;
  type:     'customer';
  phone:    string;
  iat:      number;
  exp:      number;
}

// ════════════════════════════════════════════════════════════════════════
//  1. REQUEST ID MIDDLEWARE
//  Adds a unique ID to every request for distributed tracing
// ════════════════════════════════════════════════════════════════════════
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = req.headers['x-request-id'] as string || `lux-${uuidv4().slice(0, 12)}`;
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}

// ════════════════════════════════════════════════════════════════════════
//  2. TENANT MIDDLEWARE (MANDATORY — runs on EVERY route)
//  Strict multi-tenant isolation. Sources:
//    a) JWT token payload (primary)
//    b) X-Tenant-Id + X-Branch-Id headers (for service-to-service)
//    c) Query param ?tenantSlug (public routes only)
// ════════════════════════════════════════════════════════════════════════
export async function tenantMiddleware(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  // Public routes that don't need tenant resolution
  const PUBLIC_PATHS = [
    '/health', '/api/v1', '/api/v1/auth/staff/login',
    '/api/v1/auth/staff/pin', '/api/v1/auth/staff/refresh',
    '/api/v1/customers/register', '/api/v1/customers/login',
    '/api/v1/menu/public', '/api/v1/courier/fee', '/api/v1/courier/track',
  ];

  const isPublic = PUBLIC_PATHS.some(p => req.path.startsWith(p));

  // Attempt JWT extraction
  const authHeader  = req.headers.authorization;
  const token       = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as StaffJWTPayload | CustomerJWTPayload;

      if (decoded.type === 'staff') {
        const staff = decoded as StaffJWTPayload;
        req.tenantId    = staff.tenantId;
        req.branchId    = staff.branchId;
        req.user        = staff;
        req.permissions = staff.permissions || getPermissionsForRole(staff.role);

      } else if (decoded.type === 'customer') {
        const cust = decoded as CustomerJWTPayload;
        req.tenantId    = cust.tenantId;
        req.customer    = cust;
        req.permissions = [];
      }

    } catch (err) {
      if (!isPublic) {
        if (err instanceof jwt.TokenExpiredError) {
          sendUnauthorized(res, 'Token expired — please refresh');
          return;
        }
        sendUnauthorized(res, 'Invalid authentication token');
        return;
      }
    }
  }

  // Header-based tenant (service-to-service or internal tools)
  if (!req.tenantId && req.headers['x-tenant-id']) {
    req.tenantId = req.headers['x-tenant-id'] as string;
    req.branchId = req.headers['x-branch-id'] as string;
  }

  // Public menu: resolve tenant from slug
  if (!req.tenantId && req.query.slug) {
    const slugResult = await query<{ id: string }>(
      `SELECT id FROM tenants WHERE slug = $1 AND is_active = true`,
      [req.query.slug]
    );
    if (slugResult.rows.length) {
      req.tenantId = slugResult.rows[0].id;
    }
  }

  // Enforce tenant on protected routes
  if (!isPublic && !req.tenantId) {
    sendUnauthorized(res, 'Tenant context required');
    return;
  }

  // Validate branch belongs to tenant (prevents cross-tenant branch injection)
  if (req.tenantId && req.branchId) {
    const branchCheck = await query<{ id: string }>(
      `SELECT id FROM branches WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
      [req.branchId, req.tenantId]
    );
    if (!branchCheck.rows.length) {
      logger.warn(`[SECURITY] Branch/tenant mismatch — tenantId: ${req.tenantId}, branchId: ${req.branchId}, requestId: ${req.requestId}`);
      sendForbidden(res, 'Branch does not belong to this tenant');
      return;
    }
  }

  next();
}

// ════════════════════════════════════════════════════════════════════════
//  3. GRANULAR RBAC MIDDLEWARE
//  requirePermission('order:void') replaces requireRole('manager')
//  More precise — a senior cashier can void if granted that permission.
// ════════════════════════════════════════════════════════════════════════
export function requirePermission(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendUnauthorized(res, 'Authentication required');
      return;
    }

    const userPermissions = req.permissions || getPermissionsForRole(req.user.role);

    // Check if user has ALL required permissions
    const missing = permissions.filter(p => !userPermissions.includes(p));

    if (missing.length > 0) {
      logger.warn(`[RBAC] Permission denied — user: ${req.user.sub}, role: ${req.user.role}, missing: ${missing.join(', ')}, path: ${req.path}, requestId: ${req.requestId}`);

      // Audit denied access attempts for security monitoring
      auditLog({
        tenantId:   req.tenantId,
        branchId:   req.branchId,
        actorId:    req.user.sub,
        actorType:  'staff',
        action:     'security.permission_denied',
        details:    { requiredPermissions: permissions, missingPermissions: missing, path: req.path },
        requestId:  req.requestId,
        ipAddress:  req.ip,
      }).catch(() => {}); // non-blocking

      sendForbidden(res, `Insufficient permissions: ${missing.join(', ')}`);
      return;
    }

    next();
  };
}

// ── Convenience: require staff auth (any authenticated staff) ─────────────
export function requireStaffAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.type !== 'staff') {
    sendUnauthorized(res, 'Staff authentication required');
    return;
  }
  next();
}

// ── Convenience: require customer auth ───────────────────────────────────
export function requireCustomerAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.customer || req.customer.type !== 'customer') {
    sendUnauthorized(res, 'Customer authentication required');
    return;
  }
  next();
}

// ── Optional auth (enhances public routes if logged in) ──────────────────
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  // tenantMiddleware already handled JWT extraction
  next();
}

// ── Same-branch enforcement for non-owners ────────────────────────────────
export function requireSameBranch(req: Request, res: Response, next: NextFunction): void {
  const targetBranchId = req.params.branchId || req.body?.branchId || req.query.branchId;
  if (!targetBranchId) { next(); return; }

  if (req.user && req.user.role !== 'owner' && req.user.branchId !== targetBranchId) {
    sendForbidden(res, 'You can only access data from your own branch');
    return;
  }
  next();
}

// ── Active shift check (cashier must have open shift to create orders) ────
export async function requireActiveShift(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  // Only enforce for POS order creation
  if (req.method !== 'POST' || !req.path.includes('/orders')) { next(); return; }
  // Drivers and managers are exempt
  if (['owner', 'manager', 'driver'].includes(req.user?.role || '')) { next(); return; }

  try {
    const shift = await query<{ id: string }>(
      `SELECT id FROM shifts WHERE branch_id = $1 AND staff_id = $2 AND status = 'open' LIMIT 1`,
      [req.branchId, req.user?.sub]
    );

    if (!shift.rows.length) {
      sendError(res, 'No active shift found — please open a shift before creating orders', 403);
      return;
    }
    next();
  } catch {
    next(); // Don't block on shift check failure
  }
}
