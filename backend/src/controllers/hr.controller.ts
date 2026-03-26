import { Request, Response } from 'express';
import { query, withTransaction } from '../config/database';
import { sendSuccess, sendCreated, sendError, sendNotFound } from '../utils/response';
import { logger } from '../utils/logger';
import { auditLog } from '../services/audit.service';
import { getStaffProfitShareForPeriod } from '../services/profit-sharing.service';

const GRACE_PERIOD_MINUTES = 10;
const PENALTY_PER_HOUR_DH  = 10;

function haversineMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180, φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180, Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── CLOCK-IN (enforced: geo-fence + selfie) ───────────────────────────────
export async function clockIn(req: Request, res: Response): Promise<void> {
  try {
    const staffId  = req.user!.sub;
    const branchId = req.branchId!;
    const { lat, lng, accuracyM, selfieUrl, note } = req.body;

    if (lat == null || lng == null) { sendError(res, 'GPS coordinates required', 422); return; }
    if (!selfieUrl)                  { sendError(res, 'Selfie required for clock-in', 422); return; }

    // Geo-fence check
    const fenceResult = await query<{ lat: string; lng: string; radius_m: number; is_active: boolean }>(
      `SELECT lat, lng, radius_m, is_active FROM branch_geofences WHERE branch_id = $1`, [branchId]
    );
    let geofencePassed = true;
    let distanceM = 0;
    if (fenceResult.rows.length && fenceResult.rows[0].is_active) {
      const fence = fenceResult.rows[0];
      distanceM   = haversineMetres(parseFloat(lat), parseFloat(lng), parseFloat(fence.lat), parseFloat(fence.lng));
      geofencePassed = distanceM <= fence.radius_m;
    }

    // Log attempt always
    await query(`INSERT INTO clock_in_attempts (staff_id, branch_id, lat, lng, accuracy_m, distance_m, geofence_passed, selfie_url, failure_reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [staffId, branchId, lat, lng, accuracyM || null, distanceM.toFixed(2), geofencePassed, selfieUrl, geofencePassed ? null : `Outside perimeter: ${distanceM.toFixed(1)}m`]);

    if (!geofencePassed) {
      res.status(403).json({ success: false, errorCode: 'OUTSIDE_GEOFENCE', error: `Vous devez être dans le café. Distance: ${distanceM.toFixed(0)}m (max: ${fenceResult.rows[0]?.radius_m || 20}m)`, distanceM: parseFloat(distanceM.toFixed(1)) });
      return;
    }

    // Delay penalty
    const schedResult = await query<{ start_time: string }>(`SELECT start_time FROM shift_schedules WHERE staff_id = $1 AND branch_id = $2 AND shift_date = CURRENT_DATE LIMIT 1`, [staffId, branchId]);
    const now = new Date();
    let delayMinutes = 0, delayPenalty = 0, expectedStart: string | null = null;
    if (schedResult.rows[0]?.start_time) {
      expectedStart = schedResult.rows[0].start_time;
      const [h, m] = expectedStart.split(':').map(Number);
      const scheduled = new Date(now); scheduled.setHours(h, m, 0, 0);
      delayMinutes = Math.max(0, Math.floor((now.getTime() - scheduled.getTime()) / 60000));
      if (delayMinutes > GRACE_PERIOD_MINUTES) delayPenalty = Math.ceil((delayMinutes - GRACE_PERIOD_MINUTES) / 60) * PENALTY_PER_HOUR_DH;
    }

    const result = await query<{ id: string }>(`
      INSERT INTO attendance (staff_id, branch_id, work_date, clock_in, clock_in_lat, clock_in_lng, clock_in_lat_precise, clock_in_lng_precise, clock_in_accuracy_m, clock_in_selfie_url, geofence_passed, selfie_verified, expected_start, delay_minutes, delay_penalty, clock_in_note)
      VALUES ($1,$2,CURRENT_DATE,NOW(),$3,$4,$5,$6,$7,$8,true,true,$9,$10,$11,$12)
      ON CONFLICT (staff_id, work_date) DO UPDATE SET clock_in=NOW(), clock_in_lat=$3, clock_in_lng=$4, clock_in_lat_precise=$5, clock_in_lng_precise=$6, clock_in_accuracy_m=$7, clock_in_selfie_url=$8, geofence_passed=true, selfie_verified=true, delay_minutes=$10, delay_penalty=$11, clock_in_note=$12
      RETURNING id`,
      [staffId, branchId, parseFloat(lat), parseFloat(lng), parseFloat(lat), parseFloat(lng), accuracyM ? parseFloat(accuracyM) : null, selfieUrl, expectedStart, delayMinutes, delayPenalty, note || null]);

    sendSuccess(res, { attendanceId: result.rows[0].id, clockedInAt: now.toISOString(), distanceM: parseFloat(distanceM.toFixed(1)), expectedStart, delayMinutes, delayPenalty, isLate: delayMinutes > GRACE_PERIOD_MINUTES, message: delayPenalty > 0 ? `⚠ ${delayMinutes} min retard — pénalité: ${delayPenalty} DH` : '✅ Pointage vérifié' });
  } catch (err) { sendError(res, `Clock-in failed: ${(err as Error).message}`); }
}

export async function clockOut(req: Request, res: Response): Promise<void> {
  try {
    const staffId = req.user!.sub;
    const { note, lat, lng } = req.body;
    const result = await query<{ id: string; clock_in: string; delay_penalty: string }>(
      `UPDATE attendance SET clock_out=NOW(), clock_out_lat=$1, clock_out_lng=$2, clock_out_note=$3 WHERE staff_id=$4 AND work_date=CURRENT_DATE AND clock_in IS NOT NULL RETURNING id, clock_in, delay_penalty`,
      [lat || null, lng || null, note || null, staffId]);
    if (!result.rows.length) { sendError(res, 'No active clock-in found', 404); return; }
    const rec = result.rows[0];
    const hoursWorked = ((Date.now() - new Date(rec.clock_in).getTime()) / 3600000).toFixed(2);
    sendSuccess(res, { clockedOutAt: new Date().toISOString(), hoursWorked: parseFloat(hoursWorked), delayPenalty: parseFloat(rec.delay_penalty || '0') });
  } catch (err) { sendError(res, 'Clock-out failed'); }
}

export async function getTodayAttendance(req: Request, res: Response): Promise<void> {
  try {
    const staffId = req.user!.sub;
    const [att, schedule] = await Promise.all([
      query(`SELECT id, clock_in, clock_out, hours_worked, expected_start, delay_minutes, delay_penalty, clock_in_selfie_url, geofence_passed FROM attendance WHERE staff_id=$1 AND work_date=CURRENT_DATE`, [staffId]),
      query(`SELECT start_time, end_time, shift_type FROM shift_schedules WHERE staff_id=$1 AND shift_date=CURRENT_DATE LIMIT 1`, [staffId]),
    ]);
    sendSuccess(res, { today: att.rows[0] || null, schedule: schedule.rows[0] || null, graceMinutes: GRACE_PERIOD_MINUTES, penaltyPerHour: PENALTY_PER_HOUR_DH });
  } catch (err) { sendError(res, 'Failed to fetch attendance'); }
}

export async function getBranchGeofence(req: Request, res: Response): Promise<void> {
  try {
    const result = await query(`SELECT lat, lng, radius_m FROM branch_geofences WHERE branch_id=$1 AND is_active=true`, [req.branchId]);
    sendSuccess(res, result.rows.length ? { enabled: true, ...result.rows[0] } : { enabled: false });
  } catch { sendError(res, 'Failed to fetch geofence'); }
}

// ── TASKS ──────────────────────────────────────────────────────────────────
export async function getTodayTasks(req: Request, res: Response): Promise<void> {
  try {
    const staffId = req.user!.sub;
    interface StaffBasic { role: string; full_name: string; branch_id: string }
    const staffResult = await query<StaffBasic>(`SELECT role, full_name, branch_id FROM staff WHERE id=$1`, [staffId]);
    if (!staffResult.rows.length) { sendNotFound(res, 'Staff'); return; }
    const { role, full_name } = staffResult.rows[0];
    interface TaskTpl { id: string; task_name: string; task_name_fr: string | null; category: string; sort_order: number; requires_photo: boolean; default_penalty: string }
    const templates = await query<TaskTpl>(`SELECT id, task_name, task_name_fr, category, sort_order, requires_photo, default_penalty FROM task_templates WHERE tenant_id=$1 AND role=$2 AND is_active=true ORDER BY category, sort_order`, [req.tenantId, role]);
    interface TaskLog { task_id: string; is_completed: boolean; completed_at: string | null; proof_photo_url: string | null; evidence_image_url: string | null; penalty_applied: string; penalty_reason: string | null; is_disputed: boolean }
    const logs = await query<TaskLog>(`SELECT task_id, is_completed, completed_at, proof_photo_url, evidence_image_url, penalty_applied, penalty_reason, is_disputed FROM daily_task_logs WHERE staff_id=$1 AND task_date=CURRENT_DATE`, [staffId]);
    const logMap = Object.fromEntries(logs.rows.map(l => [l.task_id, l]));
    const tasks = templates.rows.map(t => ({ id: t.id, name: t.task_name_fr || t.task_name, category: t.category, sortOrder: t.sort_order, requiresPhoto: t.requires_photo, penalty: parseFloat(t.default_penalty), log: logMap[t.id] || null, isCompleted: logMap[t.id]?.is_completed || false, isDisputed: logMap[t.id]?.is_disputed || false }));
    const byCategory: Record<string, typeof tasks> = {};
    for (const t of tasks) { if (!byCategory[t.category]) byCategory[t.category] = []; byCategory[t.category].push(t); }
    sendSuccess(res, { staffName: full_name, role, date: new Date().toISOString().slice(0,10), tasksByCategory: byCategory, summary: { total: tasks.length, completed: tasks.filter(t => t.isCompleted).length, pending: tasks.filter(t => !t.isCompleted).length, pendingPenaltyIfMissed: tasks.filter(t => !t.isCompleted).reduce((s,t) => s+t.penalty, 0) } });
  } catch (err) { sendError(res, 'Failed to fetch tasks'); }
}

export async function submitTasks(req: Request, res: Response): Promise<void> {
  try {
    const staffId = req.user!.sub;
    const branchId = req.branchId!;
    const { completions } = req.body as { completions: Array<{ taskId: string; isCompleted: boolean; proofPhotoUrl?: string; evidenceImageUrl?: string }> };
    await withTransaction(async (client) => {
      for (const c of completions) {
        await client.query(`INSERT INTO daily_task_logs (staff_id, branch_id, task_id, task_date, is_completed, completed_at, proof_photo_url, evidence_image_url, evidence_captured_at) VALUES ($1,$2,$3,CURRENT_DATE,$4,$5,$6,$7,$8) ON CONFLICT (staff_id, task_id, task_date) DO UPDATE SET is_completed=EXCLUDED.is_completed, completed_at=CASE WHEN EXCLUDED.is_completed THEN NOW() ELSE NULL END, proof_photo_url=COALESCE(EXCLUDED.proof_photo_url, daily_task_logs.proof_photo_url), evidence_image_url=COALESCE(EXCLUDED.evidence_image_url, daily_task_logs.evidence_image_url), evidence_captured_at=CASE WHEN EXCLUDED.evidence_image_url IS NOT NULL THEN NOW() ELSE daily_task_logs.evidence_captured_at END`,
          [staffId, branchId, c.taskId, c.isCompleted, c.isCompleted ? new Date().toISOString() : null, c.proofPhotoUrl || null, c.evidenceImageUrl || null, c.evidenceImageUrl ? new Date().toISOString() : null]);
      }
    });
    sendSuccess(res, { submitted: completions.length, completedCount: completions.filter(c => c.isCompleted).length });
  } catch (err) { sendError(res, `Task submission failed: ${(err as Error).message}`); }
}

export async function disputeTask(req: Request, res: Response): Promise<void> {
  try {
    const { logId } = req.params;
    const { reason } = req.body;
    const result = await query(`UPDATE daily_task_logs SET is_disputed=true, disputed_by=$1, disputed_at=NOW(), dispute_note=$2, penalty_applied=100, penalty_reason='false_claim' WHERE id=$3 AND is_disputed=false RETURNING staff_id`, [req.user?.sub, reason || 'Tâche non effectuée', logId]);
    if (!result.rows.length) { sendError(res, 'Log not found or already disputed', 404); return; }
    sendSuccess(res, { disputed: true, penaltyApplied: 100 });
  } catch (err) { sendError(res, 'Dispute failed'); }
}

// ── SALFIYA ─────────────────────────────────────────────────────────────
export async function createSalfiyaRequest(req: Request, res: Response): Promise<void> {
  try {
    const staffId = req.user!.sub;
    const { amount, reason, urgency = 'normal' } = req.body;
    const salaryResult = await query<{ base_salary: string }>(`SELECT base_salary FROM staff WHERE id=$1`, [staffId]);
    const base = parseFloat(salaryResult.rows[0]?.base_salary || '0');
    if (amount > base * 0.5) { sendError(res, `Advance cannot exceed 50% of salary (max ${(base*0.5).toFixed(2)} DH)`, 422); return; }
    const result = await query<{ id: string }>(`INSERT INTO staff_requests (staff_id, branch_id, type, amount, reason, urgency, status) VALUES ($1,$2,'advance',$3,$4,$5,'pending') RETURNING id`, [staffId, req.branchId, amount, reason, urgency]);
    sendCreated(res, { requestId: result.rows[0].id, amount, status: 'pending' });
  } catch (err) { sendError(res, 'Request failed'); }
}

export async function getMyRequests(req: Request, res: Response): Promise<void> {
  try {
    const staffId = req.user!.sub;
    const result = await query(`SELECT id, type, amount, reason, urgency, status, created_at, paid_at FROM staff_requests WHERE staff_id=$1 ORDER BY created_at DESC LIMIT 20`, [staffId]);
    sendSuccess(res, { data: result.rows });
  } catch { sendError(res, 'Failed'); }
}

// ── PROFILE + SALARY PREVIEW ─────────────────────────────────────────────
export async function getMyProfile(req: Request, res: Response): Promise<void> {
  try {
    const staffId  = req.user!.sub;
    const tenantId = req.tenantId!;
    interface ProfileRow { id: string; full_name: string; role: string; phone: string; email: string | null; base_salary: string; joining_date: string; status: string; avg_rating: string; rating_count: number; avatar_url: string | null; branch_name: string; today_shift_start: string | null; today_shift_end: string | null }
    const staffResult = await query<ProfileRow>(`SELECT s.id, s.full_name, s.role, s.phone, s.email, s.base_salary, s.joining_date, s.status, s.avg_rating, s.rating_count, s.avatar_url, b.name AS branch_name, (SELECT start_time FROM shift_schedules WHERE staff_id=s.id AND shift_date=CURRENT_DATE LIMIT 1) AS today_shift_start, (SELECT end_time FROM shift_schedules WHERE staff_id=s.id AND shift_date=CURRENT_DATE LIMIT 1) AS today_shift_end FROM staff s JOIN branches b ON b.id=s.branch_id WHERE s.id=$1 AND s.tenant_id=$2`, [staffId, tenantId]);
    if (!staffResult.rows.length) { sendNotFound(res, 'Staff'); return; }
    const profile = staffResult.rows[0];
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
    const today      = now.toISOString().slice(0,10);
    const [delayRes, taskRes, advRes, profitRes] = await Promise.all([
      query<{ total: string }>(`SELECT COALESCE(SUM(delay_penalty),0)::TEXT AS total FROM attendance WHERE staff_id=$1 AND work_date BETWEEN $2 AND $3`, [staffId, monthStart, today]),
      query<{ total: string }>(`SELECT COALESCE(SUM(penalty_applied),0)::TEXT AS total FROM daily_task_logs WHERE staff_id=$1 AND task_date BETWEEN $2 AND $3`, [staffId, monthStart, today]),
      query<{ total: string }>(`SELECT COALESCE(SUM(amount),0)::TEXT AS total FROM staff_requests WHERE staff_id=$1 AND status='paid' AND DATE(paid_at)>=$2`, [staffId, monthStart]),
      getStaffProfitShareForPeriod(staffId, monthStart, today).catch(() => 0),
    ]);
    const base = parseFloat(profile.base_salary);
    const delayPenalties = parseFloat(delayRes.rows[0]?.total || '0');
    const taskPenalties  = parseFloat(taskRes.rows[0]?.total || '0');
    const advances       = parseFloat(advRes.rows[0]?.total || '0');
    const profitShare    = typeof profitRes === 'number' ? profitRes : 0;
    const netPreview     = parseFloat((base - delayPenalties - taskPenalties - advances + profitShare).toFixed(2));
    sendSuccess(res, { ...profile, salary: { base, delayPenalties, taskPenalties, advances, profitShare, netPreview } });
  } catch (err) { sendError(res, 'Failed to fetch profile'); }
}

// ── RATINGS MANAGEMENT (manager view) ────────────────────────────────────
export async function getStaffRatings(req: Request, res: Response): Promise<void> {
  try {
    const { staffId } = req.params;
    const [ratings, summary] = await Promise.all([
      query(`SELECT sr.id, sr.rating_stars, sr.comment, sr.created_at, o.table_number FROM staff_ratings sr JOIN orders o ON o.id=sr.order_id WHERE sr.staff_id=$1 AND sr.is_internal=true ORDER BY sr.created_at DESC LIMIT 50`, [staffId]),
      query(`SELECT ROUND(AVG(rating_stars)::NUMERIC,2) AS avg, COUNT(*) AS total FROM staff_ratings WHERE staff_id=$1 AND is_internal=true`, [staffId]),
    ]);
    sendSuccess(res, { summary: summary.rows[0], ratings: ratings.rows });
  } catch { sendError(res, 'Failed to fetch ratings'); }
}

export async function getRatingsSummary(req: Request, res: Response): Promise<void> {
  try {
    const branchId = (req.query.branchId as string) || req.branchId!;
    const result = await query(`SELECT s.id AS staff_id, s.full_name, s.role, s.avatar_url, s.avg_rating, s.rating_count FROM staff s WHERE s.branch_id=$1 AND s.status='active' ORDER BY s.avg_rating DESC NULLS LAST`, [branchId]);
    sendSuccess(res, result.rows);
  } catch { sendError(res, 'Failed'); }
}

// ── PAYROLL ───────────────────────────────────────────────────────────────
export async function generatePayroll(req: Request, res: Response): Promise<void> {
  try {
    const { branchId, payPeriod } = req.body;
    interface StaffPayroll { id: string; full_name: string; base_salary: string }
    const staffList = await query<StaffPayroll>(`SELECT id, full_name, base_salary FROM staff WHERE branch_id=$1 AND status='active'`, [branchId]);
    const [yearStr, monthStr] = payPeriod.split('-');
    const periodStart = `${yearStr}-${monthStr}-01`;
    const periodEnd   = new Date(parseInt(yearStr), parseInt(monthStr), 0).toISOString().slice(0,10);
    const records = [];
    for (const s of staffList.rows) {
      const [delayRes, taskRes, advRes, profitRes] = await Promise.all([
        query<{ total: string }>(`SELECT COALESCE(SUM(delay_penalty),0)::TEXT AS total FROM attendance WHERE staff_id=$1 AND work_date BETWEEN $2 AND $3`, [s.id, periodStart, periodEnd]),
        query<{ total: string }>(`SELECT COALESCE(SUM(penalty_applied),0)::TEXT AS total FROM daily_task_logs WHERE staff_id=$1 AND task_date BETWEEN $2 AND $3`, [s.id, periodStart, periodEnd]),
        query<{ total: string }>(`SELECT COALESCE(SUM(amount),0)::TEXT AS total FROM staff_requests WHERE staff_id=$1 AND status='paid' AND DATE(paid_at) BETWEEN $2 AND $3`, [s.id, periodStart, periodEnd]),
        getStaffProfitShareForPeriod(s.id, periodStart, periodEnd).catch(() => 0),
      ]);
      const base     = parseFloat(s.base_salary);
      const delays   = parseFloat(delayRes.rows[0]?.total || '0');
      const tasks    = parseFloat(taskRes.rows[0]?.total || '0');
      const advances = parseFloat(advRes.rows[0]?.total || '0');
      const profit   = typeof profitRes === 'number' ? profitRes : 0;
      const net      = parseFloat((base - delays - tasks - advances + profit).toFixed(2));
      await query(`INSERT INTO payroll_records (staff_id, branch_id, pay_period, base_salary, delay_penalties, task_penalties, advances_deducted, profit_share, net_salary, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending') ON CONFLICT (staff_id, pay_period) DO UPDATE SET delay_penalties=$5, task_penalties=$6, advances_deducted=$7, profit_share=$8, net_salary=$9`, [s.id, branchId, payPeriod, base, delays, tasks, advances, profit, net]);
      records.push({ staffId: s.id, staffName: s.full_name, base, delays, tasks, advances, profitShare: profit, net });
    }
    sendSuccess(res, { payPeriod, generated: records.length, records });
  } catch (err) { sendError(res, `Payroll generation failed: ${(err as Error).message}`); }
}

// ── SUBMIT STAFF RATING (from customer app) ───────────────────────────────
export async function submitStaffRating(req: Request, res: Response): Promise<void> {
  try {
    const { orderId } = req.params;
    const { rating_stars, comment } = req.body;
    const customerId = req.customer?.sub;
    const orderResult = await query<{ id: string; staff_id: string | null; branch_id: string; status: string }>(`SELECT id, staff_id, branch_id, status FROM orders WHERE id=$1 AND customer_id=$2 AND tenant_id=$3`, [orderId, customerId, req.tenantId]);
    if (!orderResult.rows.length) { sendNotFound(res, 'Order'); return; }
    const order = orderResult.rows[0];
    if (!['delivered','paid','served'].includes(order.status)) { sendError(res, 'Order must be delivered or paid', 422); return; }
    if (!order.staff_id) { sendError(res, 'No staff assigned to this order', 422); return; }
    const result = await query<{ id: string }>(`INSERT INTO staff_ratings (order_id, staff_id, customer_id, branch_id, rating_stars, comment, is_internal) VALUES ($1,$2,$3,$4,$5,$6,true) ON CONFLICT (order_id, customer_id) DO UPDATE SET rating_stars=EXCLUDED.rating_stars, comment=EXCLUDED.comment RETURNING id`, [orderId, order.staff_id, customerId, order.branch_id, rating_stars, comment || null]);
    sendCreated(res, { ratingId: result.rows[0].id, stars: rating_stars });
  } catch (err) { sendError(res, `Rating failed: ${(err as Error).message}`); }
}
