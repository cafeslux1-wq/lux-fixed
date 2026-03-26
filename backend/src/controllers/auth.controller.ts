/**
 * ══════════════════════════════════════════════════════════
 *  LUX SUPREME — Enterprise Auth Controller (v4)
 *  Key changes:
 *  ✅ JWT payload now includes permissions[] array
 *  ✅ PIN always bcrypt hashed (never plaintext)
 *  ✅ Full audit trail on every auth event
 *  ✅ requestId in all log entries
 * ══════════════════════════════════════════════════════════
 */

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../config/database';
import { sendSuccess, sendError, sendUnauthorized, sendNotFound } from '../utils/response';
import { logger } from '../utils/logger';
import { auditLog } from '../services/audit.service';
import { getPermissionsForRole, type StaffRole } from '../types/permissions';
import type { StaffJWTPayload } from '../middleware/enterprise.middleware';

// ── Token factory ─────────────────────────────────────────────────────────
function makeAccessToken(staff: {
  id: string; tenant_id: string; branch_id: string; role: StaffRole;
}): string {
  const permissions = getPermissionsForRole(staff.role);
  const payload: Omit<StaffJWTPayload, 'iat' | 'exp'> = {
    sub:         staff.id,
    tenantId:    staff.tenant_id,
    branchId:    staff.branch_id,
    role:        staff.role,
    type:        'staff',
    permissions, // embedded in JWT for fast middleware checks
  };
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  } as jwt.SignOptions);
}

// ── Staff DB row ──────────────────────────────────────────────────────────
interface StaffRow {
  id: string; tenant_id: string; branch_id: string;
  full_name: string; phone: string; email: string | null;
  role: StaffRole; status: string;
  pin_code: string; password_hash: string | null;
  base_salary: string; avatar_url: string | null;
  contract_signed_at: string | null;
  branch_name: string; branch_city: string;
}

function sanitize(s: StaffRow) {
  return {
    id:             s.id,
    fullName:       s.full_name,
    phone:          s.phone,
    email:          s.email,
    role:           s.role,
    status:         s.status,
    photoUrl:       s.avatar_url,
    branchId:       s.branch_id,
    branchName:     s.branch_name,
    tenantId:       s.tenant_id,
    contractSigned: !!s.contract_signed_at,
    permissions:    getPermissionsForRole(s.role),
  };
}

// ── Password login ────────────────────────────────────────────────────────
export async function loginWithPassword(req: Request, res: Response): Promise<void> {
  const { phone, password } = req.body;

  const result = await query<StaffRow>(`
    SELECT s.*, b.name AS branch_name, b.city AS branch_city
    FROM staff s JOIN branches b ON b.id = s.branch_id
    WHERE s.phone = $1 AND s.status != 'terminated'
  `, [phone]);

  if (!result.rows.length || !result.rows[0].password_hash) {
    await auditLog({ actorType: 'system', action: 'auth.login_failed', details: { phone }, requestId: req.requestId, ipAddress: req.ip });
    sendUnauthorized(res, 'Invalid credentials');
    return;
  }

  const staff = result.rows[0];
  if (!staff.password_hash) { sendUnauthorized(res, "Password not set — use PIN login"); return; }
  const valid = await bcrypt.compare(password, staff.password_hash);

  if (!valid) {
    await auditLog({ tenantId: staff.tenant_id, branchId: staff.branch_id, actorId: staff.id, actorType: 'staff', action: 'auth.login_failed', details: { method: 'password' }, requestId: req.requestId, ipAddress: req.ip });
    sendUnauthorized(res, 'Invalid credentials');
    return;
  }

  const accessToken  = makeAccessToken(staff);
  const refreshToken = uuidv4() + '.' + uuidv4();
  await query(`UPDATE staff SET refresh_token = $1, last_login = NOW() WHERE id = $2`,
    [await bcrypt.hash(refreshToken, 6), staff.id]);

  await auditLog({ tenantId: staff.tenant_id, branchId: staff.branch_id, actorId: staff.id, actorType: 'staff', action: 'auth.login', details: { method: 'password', role: staff.role }, requestId: req.requestId, ipAddress: req.ip });

  logger.info(`✅ Login: ${staff.full_name} [${staff.role}] | requestId: ${req.requestId}`);
  sendSuccess(res, { accessToken, refreshToken, expiresIn: '8h', staff: sanitize(staff) });
}

// ── PIN login (POS) ───────────────────────────────────────────────────────
export async function loginWithPin(req: Request, res: Response): Promise<void> {
  const { staffId, pin, branchId } = req.body;

  const result = await query<StaffRow>(`
    SELECT s.*, b.name AS branch_name, b.city AS branch_city
    FROM staff s JOIN branches b ON b.id = s.branch_id
    WHERE s.id = $1 AND s.branch_id = $2 AND s.status = 'active'
  `, [staffId, branchId]);

  if (!result.rows.length) { sendUnauthorized(res, 'Staff not found'); return; }

  const staff = result.rows[0];

  // SECURITY: PIN is ALWAYS bcrypt compared — never plaintext
  const pinValid = await bcrypt.compare(pin.toString(), staff.pin_code);
  if (!pinValid) {
    await auditLog({ tenantId: staff.tenant_id, branchId: staff.branch_id, actorId: staff.id, actorType: 'staff', action: 'auth.pin_failed', requestId: req.requestId, ipAddress: req.ip });
    sendUnauthorized(res, 'Incorrect PIN');
    return;
  }

  const accessToken = makeAccessToken(staff);
  await query(`UPDATE staff SET last_login = NOW() WHERE id = $1`, [staff.id]);

  await auditLog({ tenantId: staff.tenant_id, branchId: staff.branch_id, actorId: staff.id, actorType: 'staff', action: 'auth.pin_login', details: { role: staff.role }, requestId: req.requestId, ipAddress: req.ip });

  sendSuccess(res, { accessToken, expiresIn: '8h', staff: sanitize(staff) });
}

// ── Change PIN (bcrypt always) ────────────────────────────────────────────
export async function changePin(req: Request, res: Response): Promise<void> {
  const { currentPin, newPin } = req.body;
  const staffId = req.user!.sub;

  const result = await query<{ pin_code: string }>(
    `SELECT pin_code FROM staff WHERE id = $1`, [staffId]
  );
  if (!result.rows.length) { sendNotFound(res, 'Staff'); return; }

  const valid = await bcrypt.compare(currentPin.toString(), result.rows[0].pin_code);
  if (!valid) { sendUnauthorized(res, 'Current PIN is incorrect'); return; }

  // Prevent reusing same PIN
  const samePin = await bcrypt.compare(newPin.toString(), result.rows[0].pin_code);
  if (samePin) { sendError(res, 'New PIN must be different from current PIN', 422); return; }

  const newHash = await bcrypt.hash(newPin.toString(), 12);
  await query(`UPDATE staff SET pin_code = $1 WHERE id = $2`, [newHash, staffId]);

  await auditLog({ tenantId: req.tenantId, branchId: req.branchId, actorId: staffId, actorType: 'staff', action: 'auth.pin_changed', requestId: req.requestId, ipAddress: req.ip });

  sendSuccess(res, { changed: true });
}

// ── Get branch staff list for PIN picker ──────────────────────────────────
export async function getBranchStaffList(req: Request, res: Response): Promise<void> {
  const { branchId } = req.params;
  const tenantId     = req.tenantId;

  // If tenantId present, validate branch belongs to tenant
  let branchCheck = 'WHERE s.branch_id = $1 AND s.status = \'active\'';
  const params: unknown[] = [branchId];

  if (tenantId) {
    branchCheck += ' AND b.tenant_id = $2';
    params.push(tenantId);
  }

  interface BranchStaffRow { id: string; full_name: string; role: string; avatar_url: string | null }
  const result = await query<BranchStaffRow>(`
    SELECT s.id, s.full_name, s.role, s.avatar_url
    FROM staff s JOIN branches b ON b.id = s.branch_id
    ${branchCheck}
    ORDER BY s.role, s.full_name
  `, params);

  sendSuccess(res, result.rows.map(s => ({
    id:       s.id,
    name:     s.full_name,
    role:     s.role,
    photoUrl: s.avatar_url,
    // Only include initials for display — never the PIN hash
    initials: s.full_name.split(' ').map((x: string) => x[0]).join('').slice(0, 2).toUpperCase(),
  })));
}

// ── Logout ────────────────────────────────────────────────────────────────
export async function logout(req: Request, res: Response): Promise<void> {
  if (req.user) {
    await query(`UPDATE staff SET refresh_token = NULL WHERE id = $1`, [req.user.sub]);
    await auditLog({ tenantId: req.tenantId, branchId: req.branchId, actorId: req.user.sub, actorType: 'staff', action: 'auth.logout', requestId: req.requestId });
  }
  sendSuccess(res, { loggedOut: true });
}

// ── Get current user ──────────────────────────────────────────────────────
export async function getMe(req: Request, res: Response): Promise<void> {
  const result = await query<StaffRow>(`
    SELECT s.*, b.name AS branch_name, b.city AS branch_city
    FROM staff s JOIN branches b ON b.id = s.branch_id
    WHERE s.id = $1 AND s.tenant_id = $2
  `, [req.user!.sub, req.tenantId]);

  if (!result.rows.length) { sendNotFound(res, 'Staff'); return; }
  sendSuccess(res, sanitize(result.rows[0]));
}
