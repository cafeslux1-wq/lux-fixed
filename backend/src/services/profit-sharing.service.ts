/**
 * ══════════════════════════════════════════════════════════
 *  LUX SUPREME — Profit-Sharing Engine
 *
 *  Runs at end of each shift (14:00 for morning, 23:30 for evening).
 *  Formula: BonusPerStaff = (ShiftRevenue × bonusPct) / activeStaffCount
 *
 *  Triggered by:
 *  1. Cron job in server.ts (2× daily)
 *  2. Manual trigger: POST /api/v1/hr/profit-sharing/calculate
 *
 *  Idempotent: UNIQUE (staff_id, shift_date, shift_type) prevents double-calc.
 * ══════════════════════════════════════════════════════════
 */

import { query, withTransaction } from '../config/database';
import { logger } from '../utils/logger';

export type ShiftType = 'morning' | 'evening';

interface ShiftWindow {
  type:      ShiftType;
  startHour: number;   // inclusive
  endHour:   number;   // exclusive
}

const SHIFTS: ShiftWindow[] = [
  { type: 'morning', startHour: 6,  endHour: 14 },
  { type: 'evening', startHour: 14, endHour: 23 },
];

// Default bonus percentage — can be overridden per tenant in settings
const DEFAULT_BONUS_PCT = 5; // 5% of shift revenue split among active staff

// ── Determine which shift a given hour falls in ───────────────────────────
export function resolveShift(hourUTC: number, tzOffsetHours = 1): ShiftType {
  const localHour = (hourUTC + tzOffsetHours + 24) % 24;
  for (const s of SHIFTS) {
    if (localHour >= s.startHour && localHour < s.endHour) return s.type;
  }
  return 'evening'; // default
}

// ════════════════════════════════════════════════════════════════════════
//  CALCULATE SHIFT PROFIT-SHARING
// ════════════════════════════════════════════════════════════════════════
export interface ProfitSharingResult {
  branchId:        string;
  shiftDate:       string;
  shiftType:       ShiftType;
  totalRevenue:    number;
  bonusPct:        number;
  totalBonusPool:  number;
  activeStaff:     number;
  bonusPerStaff:   number;
  distributions:   Array<{ staffId: string; staffName: string; bonusAmount: number }>;
}

export async function calculateShiftProfitSharing(
  branchId:   string,
  shiftDate:  string,  // 'YYYY-MM-DD'
  shiftType:  ShiftType,
): Promise<ProfitSharingResult> {

  const shift = SHIFTS.find(s => s.type === shiftType)!;

  // ── [1] Fetch revenue for this shift window ───────────────────────────
  const revenueResult = await query<{ total: string }>(`
    SELECT COALESCE(SUM(total_amount), 0) AS total
    FROM orders
    WHERE branch_id = $1
      AND DATE(created_at AT TIME ZONE 'Africa/Casablanca') = $2
      AND EXTRACT(HOUR FROM created_at AT TIME ZONE 'Africa/Casablanca') >= $3
      AND EXTRACT(HOUR FROM created_at AT TIME ZONE 'Africa/Casablanca') < $4
      AND is_voided = false
      AND status IN ('paid','delivered')
  `, [branchId, shiftDate, shift.startHour, shift.endHour]);

  const totalRevenue = parseFloat(revenueResult.rows[0]?.total || '0');

  // ── [2] Fetch bonus % from branch/tenant settings ─────────────────────
  const settingsResult = await query<{ settings: Record<string, number> }>(
    `SELECT settings FROM branches WHERE id = $1`, [branchId]
  );
  const bonusPct = settingsResult.rows[0]?.settings?.profit_sharing_pct ?? DEFAULT_BONUS_PCT;

  // ── [3] Find staff who worked this shift (clocked in during window) ───
  const staffResult = await query<{ staff_id: string; full_name: string }>(`
    SELECT DISTINCT a.staff_id, s.full_name
    FROM attendance a
    JOIN staff s ON s.id = a.staff_id
    WHERE a.branch_id = $1
      AND a.work_date = $2
      AND a.clock_in IS NOT NULL
      AND EXTRACT(HOUR FROM a.clock_in AT TIME ZONE 'Africa/Casablanca') >= $3
      AND EXTRACT(HOUR FROM a.clock_in AT TIME ZONE 'Africa/Casablanca') < $4
      AND s.status = 'active'
      AND s.role IN ('barista','cashier','waiter','cook','patissier')
  `, [branchId, shiftDate, shift.startHour, shift.endHour]);

  const activeStaff   = staffResult.rows.length;
  const totalBonusPool = parseFloat((totalRevenue * bonusPct / 100).toFixed(2));
  const bonusPerStaff  = activeStaff > 0
    ? parseFloat((totalBonusPool / activeStaff).toFixed(2))
    : 0;

  // ── [4] Record distributions (idempotent) ────────────────────────────
  const distributions: ProfitSharingResult['distributions'] = [];

  await withTransaction(async (client) => {
    // Ensure profit_sharing_logs table exists (idempotent check via ON CONFLICT)
    for (const staff of staffResult.rows) {
      await client.query(`
        INSERT INTO profit_sharing_logs
          (staff_id, branch_id, shift_date, shift_type,
           shift_revenue, bonus_pct, bonus_amount)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (staff_id, shift_date, shift_type) DO UPDATE SET
          bonus_amount  = EXCLUDED.bonus_amount,
          shift_revenue = EXCLUDED.shift_revenue
      `, [
        staff.staff_id, branchId, shiftDate, shiftType,
        totalRevenue, bonusPct, bonusPerStaff,
      ]);

      distributions.push({
        staffId:     staff.staff_id,
        staffName:   staff.full_name,
        bonusAmount: bonusPerStaff,
      });
    }
  });

  logger.info(
    `[ProfitShare] Branch ${branchId} | ${shiftType} ${shiftDate} | ` +
    `Rev: ${totalRevenue} DH | Pool: ${totalBonusPool} DH | ` +
    `${activeStaff} staff × ${bonusPerStaff} DH`
  );

  return {
    branchId, shiftDate, shiftType, totalRevenue,
    bonusPct, totalBonusPool, activeStaff, bonusPerStaff, distributions,
  };
}

// ════════════════════════════════════════════════════════════════════════
//  CRON TRIGGER (call from server.ts)
//  Runs at 14:05 (end of morning) and 23:05 (end of evening)
// ════════════════════════════════════════════════════════════════════════
export async function runDailyProfitSharing(): Promise<void> {
  const now       = new Date();
  const hourLocal = (now.getUTCHours() + 1 + 24) % 24; // Africa/Casablanca UTC+1
  const shiftType = hourLocal >= 14 ? 'morning' : 'evening';
  // If it's ~14h → calculate morning; if ~23h → calculate evening
  const shiftDate = now.toISOString().slice(0, 10);

  const branches = await query<{ id: string; tenant_id: string }>(
    `SELECT id, tenant_id FROM branches WHERE is_active = true`
  );

  const results = await Promise.allSettled(
    branches.rows.map(b => calculateShiftProfitSharing(b.id, shiftDate, shiftType))
  );

  const errors = results.filter(r => r.status === 'rejected');
  if (errors.length) {
    logger.error(`[ProfitShare] ${errors.length} branch(es) failed:`, errors.map(e => (e as PromiseRejectedResult).reason?.message));
  }

  logger.info(`[ProfitShare] Cron complete: ${results.length - errors.length}/${results.length} branches`);
}

// ── Get staff's profit-sharing earnings for payroll ───────────────────────
export async function getStaffProfitShareForPeriod(
  staffId:     string,
  periodStart: string,
  periodEnd:   string,
): Promise<number> {
  const result = await query<{ total: string }>(`
    SELECT COALESCE(SUM(bonus_amount), 0) AS total
    FROM profit_sharing_logs
    WHERE staff_id = $1 AND shift_date BETWEEN $2 AND $3
  `, [staffId, periodStart, periodEnd]);
  return parseFloat(result.rows[0]?.total || '0');
}
