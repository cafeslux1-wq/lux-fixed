import { Router } from 'express';
import Joi from 'joi';
import { validate, paginationQuery, requireRole, requireSuperAdmin } from '../middleware/validate';
import { requirePermission } from '../middleware/enterprise.middleware';
import { checkStaffLimit } from '../middleware/checkSubscription';
import { PERMISSIONS } from '../types/permissions';
import { clockIn, clockOut, getTodayAttendance, getBranchGeofence, getTodayTasks, submitTasks, disputeTask, createSalfiyaRequest, getMyRequests, getMyProfile, getStaffRatings, getRatingsSummary, generatePayroll, submitStaffRating } from '../controllers/hr.controller';
import { getPublicMenu, openQRSession, validateQRSession, closeQRSession, toggleProductAvailability } from '../controllers/menu.controller';
import { listPlans, getMySubscription, createCheckout, openPortal, getInvoices, handleWebhook } from '../controllers/billing.controller';
import { getPlatformKPIs, getMyReferralStats, getReferralLeaderboard, requestPayout, overridePenalty, calculateProfitShare } from '../controllers/admin.controller';

// ─────────────────────────────────────────────────────────────────────────
// HR ROUTES
// ─────────────────────────────────────────────────────────────────────────
export const hrRoutes = Router();
// Attendance
hrRoutes.get('/attendance/geofence', getBranchGeofence);
hrRoutes.post('/attendance/clock-in', validate(Joi.object({ lat: Joi.number().optional(), lng: Joi.number().optional(), accuracyM: Joi.number().optional(), selfieUrl: Joi.string().optional(), note: Joi.string().optional() })), clockIn);
hrRoutes.post('/attendance/clock-out', validate(Joi.object({ lat: Joi.number().optional(), lng: Joi.number().optional(), note: Joi.string().optional() })), clockOut);
hrRoutes.get('/attendance/today', getTodayAttendance);
// Tasks
hrRoutes.get('/tasks/today', getTodayTasks);
hrRoutes.post('/tasks/submit', validate(Joi.object({ completions: Joi.array().items(Joi.object({ taskId: Joi.string().uuid().required(), isCompleted: Joi.boolean().required(), proofPhotoUrl: Joi.string().uri().optional(), evidenceImageUrl: Joi.string().optional() })).min(1).required() })), submitTasks);
hrRoutes.post('/tasks/:logId/dispute', requirePermission(PERMISSIONS.HR_VIEW), validate(Joi.object({ reason: Joi.string().max(300).optional() })), disputeTask);
// Salfiya
hrRoutes.get('/salfiya', getMyRequests);
hrRoutes.post('/salfiya', validate(Joi.object({ amount: Joi.number().positive().required(), reason: Joi.string().max(500).required(), urgency: Joi.string().valid('normal','urgent').default('normal') })), createSalfiyaRequest);
// Profile
hrRoutes.get('/me', getMyProfile);
// Ratings (manager)
hrRoutes.get('/ratings/summary', requirePermission(PERMISSIONS.HR_VIEW), getRatingsSummary);
hrRoutes.get('/ratings/:staffId', requirePermission(PERMISSIONS.HR_VIEW), getStaffRatings);
// Payroll
hrRoutes.post('/payroll/generate', requirePermission(PERMISSIONS.PAYROLL_RUN), validate(Joi.object({ branchId: Joi.string().uuid().required(), payPeriod: Joi.string().pattern(/^\d{4}-\d{2}$/).required() })), generatePayroll);

// ─────────────────────────────────────────────────────────────────────────
// MENU ROUTES
// ─────────────────────────────────────────────────────────────────────────
export const menuRoutes = Router();
menuRoutes.get('/public', getPublicMenu);
menuRoutes.get('/public/:tenantSlug', getPublicMenu);
menuRoutes.get('/qr/session/:token', validateQRSession);        // no auth — customer
menuRoutes.post('/qr/session', validate(Joi.object({ branchId: Joi.string().uuid().required(), tableNumber: Joi.string().min(1).max(20).required() })), openQRSession);
menuRoutes.post('/qr/session/:token/close', closeQRSession);
menuRoutes.patch('/products/:id/toggle', requirePermission(PERMISSIONS.MENU_EDIT), toggleProductAvailability);

// ─────────────────────────────────────────────────────────────────────────
// BILLING ROUTES
// ─────────────────────────────────────────────────────────────────────────
export const billingRoutes = Router();
billingRoutes.get('/plans', listPlans);                          // public
billingRoutes.post('/webhook', handleWebhook);                   // raw body, no auth
billingRoutes.get('/subscription', getMySubscription);
billingRoutes.get('/invoices', getInvoices);
billingRoutes.post('/checkout', validate(Joi.object({ priceId: Joi.string().required(), successPath: Joi.string().optional(), cancelPath: Joi.string().optional() })), createCheckout);
billingRoutes.post('/portal', openPortal);

// ─────────────────────────────────────────────────────────────────────────
// ADMIN / SAAS ROUTES
// ─────────────────────────────────────────────────────────────────────────
export const adminRoutes = Router();
adminRoutes.get('/admin/kpis', requireSuperAdmin, getPlatformKPIs);
adminRoutes.post('/admin/penalty-override', requireSuperAdmin, validate(Joi.object({ staffId: Joi.string().uuid().required(), type: Joi.string().valid('delay','task').required(), amount: Joi.number().min(0).required(), reason: Joi.string().optional() })), overridePenalty);
adminRoutes.post('/admin/profit-sharing/calculate', requireSuperAdmin, validate(Joi.object({ branchId: Joi.string().uuid().required(), shiftDate: Joi.string().isoDate().required(), shiftType: Joi.string().valid('morning','evening').required() })), calculateProfitShare);
adminRoutes.get('/referral/stats', getMyReferralStats);
adminRoutes.get('/referral/leaderboard', getReferralLeaderboard);
adminRoutes.post('/referral/payout', validate(Joi.object({ amount: Joi.number().positive().min(20).required(), iban: Joi.string().max(34).optional(), method: Joi.string().valid('bank_transfer','paypal').default('bank_transfer') })), requestPayout);

// ─────────────────────────────────────────────────────────────────────────
// CUSTOMER RATING ROUTE
// ─────────────────────────────────────────────────────────────────────────
export const customerRoutes = Router();
customerRoutes.post('/me/orders/:orderId/rate-staff', validate(Joi.object({ rating_stars: Joi.number().integer().min(1).max(5).required(), comment: Joi.string().max(500).optional().allow('') })), submitStaffRating);
