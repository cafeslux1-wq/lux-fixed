// backend/src/routes/orders.routes.ts
import { Router } from 'express';
import Joi from 'joi';
import { validate, paginationQuery } from '../middleware/validate';
import { requirePermission } from '../middleware/enterprise.middleware';
import { idempotencyMiddleware } from '../services/idempotency.service';
import { checkOrderLimit } from '../middleware/checkSubscription';
import { PERMISSIONS } from '../types/permissions';
import { createOrder, listOrders, updateOrderStatus, voidOrder, getKDSOrders, getDailySummary } from '../controllers/orders.controller';

const router = Router();
const itemSchema = Joi.object({ productId: Joi.string().uuid().optional(), productName: Joi.string().max(100).required(), unitPrice: Joi.number().positive().required(), quantity: Joi.number().integer().min(1).max(99).required(), modifiers: Joi.object().pattern(Joi.string(), Joi.string()).optional(), notes: Joi.string().max(200).optional(), category: Joi.string().optional() });
const createSchema = Joi.object({ branchId: Joi.string().uuid().required(), tableNumber: Joi.string().max(20).optional(), orderType: Joi.string().valid('dine_in','takeaway','delivery','courier').default('dine_in'), source: Joi.string().optional(), sessionType: Joi.string().valid('pos','qr_menu','app','web','delivery').optional(), qrSessionToken: Joi.string().max(100).optional(), customerId: Joi.string().uuid().optional(), items: Joi.array().items(itemSchema).min(1).required(), paymentMethod: Joi.string().valid('cash','card','wallet','nfc','mixed','meal_voucher').optional(), walletAmount: Joi.number().positive().optional(), loyaltyUsed: Joi.number().integer().min(0).optional(), notes: Joi.string().max(500).optional(), customerNotes: Joi.string().max(500).optional(), externalId: Joi.string().max(100).optional(), idempotencyKey: Joi.string().max(100).optional() });
router.get('/summary', validate(paginationQuery, 'query'), getDailySummary);
router.get('/kds/:branchId', requirePermission(PERMISSIONS.KDS_VIEW), getKDSOrders);
router.post('/', idempotencyMiddleware, checkOrderLimit, requirePermission(PERMISSIONS.ORDER_CREATE), validate(createSchema), createOrder);
router.get('/', requirePermission(PERMISSIONS.ORDER_VIEW), validate(paginationQuery, 'query'), listOrders);
router.patch('/:id/status', requirePermission(PERMISSIONS.KDS_UPDATE_STATUS), validate(Joi.object({ status: Joi.string().valid('accepted','preparing','ready','delivered','paid','cancelled').required() })), updateOrderStatus);
router.post('/:id/void', requirePermission(PERMISSIONS.ORDER_VOID), validate(Joi.object({ reason: Joi.string().max(300).optional() })), voidOrder);
export default router;
