/**
 * ══════════════════════════════════════════════════════════
 *  LUX SUPREME — Orders Controller  FINAL v4.3
 *
 *  Key addition over v4.2:
 *  After DB commit, the post-commit emitter flushes AND
 *  kitchen/bar printing is triggered in PARALLEL.
 *  Neither socket emission nor printing ever blocks the HTTP response.
 *
 *  Execution order:
 *  ① withTransaction { all DB work }      → commit
 *  ② res.status(201).json(...)            → client gets response IMMEDIATELY
 *  ③ Promise.all([                        → runs asynchronously, no await on caller side
 *       emitter.flush(),                  → socket events to KDS + POS rooms
 *       printKitchenTickets(...),         → ESC/POS to kitchen/bar printers
 *     ]).catch(log)                       → print failure never crashes the process
 * ══════════════════════════════════════════════════════════
 */

import { Request, Response } from 'express';
import { withTransaction, query, queryPaginated } from '../config/database';
import { sendSuccess, sendError, sendNotFound, sendForbidden, sendPaginated } from '../utils/response';
import { logger } from '../utils/logger';
import { auditLog } from '../services/audit.service';
import { preflightStockCheck, atomicStockDeduction, atomicWalletDeduction, OutOfStockError, WalletInsufficientError, PaymentFailedError } from '../services/stock-guard.service';
import { checkIdempotencyKey, storeIdempotencyKey } from '../services/idempotency.service';
import { createPostCommitEmitter } from '../services/post-commit-emitter.service';
import { printKitchenTickets, printCustomerReceipt, type KitchenTicketData, type ReceiptData } from '../services/printing.service';
import type { PoolClient } from 'pg';

// ── Types ─────────────────────────────────────────────────────────────────
interface OrderItemInput {
  productId?:   string;
  productName:  string;
  unitPrice:    number;
  quantity:     number;
  modifiers?:   Record<string, string>;
  notes?:       string;
  category?:    string;   // 'drink' | 'food' — for printer routing
}

// ── Status machine ────────────────────────────────────────────────────────
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending:   ['accepted','cancelled'],
  accepted:  ['preparing','cancelled'],
  preparing: ['ready'],
  ready:     ['delivered'],
  delivered: ['paid'],
  paid:      [],
  cancelled: [],
  refunded:  [],
};

const STATUS_TS: Record<string, string> = {
  accepted:  'accepted_at',
  preparing: 'preparing_at',
  ready:     'ready_at',
  delivered: 'delivered_at',
  paid:      'paid_at',
};

// ════════════════════════════════════════════════════════════════════════
//  CREATE ORDER — Full atomic flow + parallel post-commit actions
// ════════════════════════════════════════════════════════════════════════
export async function createOrder(req: Request, res: Response): Promise<void> {
  const {
    branchId, tableNumber, orderType = 'dine_in',
    source, sessionType, qrSessionToken,
    customerId, items, paymentMethod,
    walletAmount: walletAmountInput = 0, loyaltyUsed = 0,
    notes, customerNotes, externalId, idempotencyKey: bodyKey,
  } = req.body;

  const tenantId  = req.tenantId!;
  const staffId   = req.user?.sub || null;
  const requestId = req.requestId;

  const resolvedSessionType = qrSessionToken ? 'qr_menu' : sessionType || (staffId ? 'pos' : 'web');
  const resolvedSource      = source || (resolvedSessionType === 'qr_menu' ? 'qr_code' : 'pos');

  // ── [1] Idempotency ───────────────────────────────────────────────────
  const idempKey = (req as Request & { idempotencyKey?: string }).idempotencyKey || bodyKey;
  if (idempKey) {
    const { isDuplicate, cachedResponse, orderId } = await checkIdempotencyKey(idempKey, tenantId, 'POST /orders');
    if (isDuplicate) {
      logger.info(`[Orders] Idempotent replay: ${idempKey} → ${orderId}`);
      res.status(200).json(cachedResponse);
      return;
    }
  }

  // ── [2] Validate branch ───────────────────────────────────────────────
  const branchResult = await query<{ settings: Record<string, number> }>(
    `SELECT settings FROM branches WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
    [branchId, tenantId]
  );
  if (!branchResult.rows.length) { sendError(res, 'Branch not found', 404); return; }
  const taxRate = branchResult.rows[0].settings?.tax_rate ?? 0.10;

  // ── [3] QR session validation ─────────────────────────────────────────
  let resolvedTable = tableNumber;
  if (resolvedSessionType === 'qr_menu' && qrSessionToken) {
    const sess = await query<{ table_number: string; is_active: boolean }>(
      `SELECT table_number, is_active FROM qr_sessions WHERE session_token = $1 AND branch_id = $2 AND expires_at > NOW()`,
      [qrSessionToken, branchId]
    );
    if (!sess.rows.length || !sess.rows[0].is_active) {
      res.status(401).json({ success: false, error: 'QR session expired', expired: true });
      return;
    }
    if (!resolvedTable) resolvedTable = sess.rows[0].table_number;
  }

  // ── [4] Pre-flight stock check ────────────────────────────────────────
  const stockCheck = await preflightStockCheck(items, branchId);
  if (!stockCheck.ok) {
    await query(`
      INSERT INTO order_failures (tenant_id, branch_id, idempotency_key, failure_type, failure_detail, staff_id, customer_id)
      VALUES ($1,$2,$3,'OUT_OF_STOCK',$4,$5,$6)
    `, [tenantId, branchId, idempKey || null, JSON.stringify({ shortages: stockCheck.shortages }), staffId, customerId || null]).catch(() => {});
    res.status(422).json({ success: false, errorCode: 'OUT_OF_STOCK', error: 'Insufficient stock', shortages: stockCheck.shortages });
    return;
  }

  // ── [5] Totals ────────────────────────────────────────────────────────
  const subtotal  = (items as OrderItemInput[]).reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const tax       = parseFloat((subtotal * taxRate).toFixed(2));
  const gross     = parseFloat((subtotal + tax).toFixed(2));
  const walletAmt = paymentMethod === 'wallet' ? gross : paymentMethod === 'mixed' ? (parseFloat(walletAmountInput) || 0) : 0;

  // Pre-check wallet (outside TX — fail fast)
  if (walletAmt > 0 && customerId) {
    const wCheck = await query<{ wallet_balance: string }>(`SELECT wallet_balance FROM customers WHERE id = $1 AND tenant_id = $2`, [customerId, tenantId]);
    const bal = parseFloat(wCheck.rows[0]?.wallet_balance || '0');
    if (bal < walletAmt) {
      res.status(402).json({ success: false, errorCode: 'WALLET_INSUFFICIENT', error: 'Wallet balance insufficient', available: bal, required: walletAmt });
      return;
    }
  }

  // ── [6] PostCommitEmitter setup ───────────────────────────────────────
  const emitter = createPostCommitEmitter();

  try {
    // ── [7] SINGLE ATOMIC TRANSACTION ─────────────────────────────────
    const result = await withTransaction(async (client: PoolClient) => {

      // 7a. Loyalty
      let loyaltyDiscount = 0;
      if (loyaltyUsed > 0 && customerId) {
        const cr = await client.query<{ loyalty_stars: number }>(`SELECT loyalty_stars FROM customers WHERE id = $1 AND tenant_id = $2 FOR UPDATE`, [customerId, tenantId]);
        const stars = Math.min(loyaltyUsed, cr.rows[0]?.loyalty_stars || 0);
        if (stars >= 10) {
          loyaltyDiscount = Math.floor(stars / 10) * 15;
          await client.query(`UPDATE customers SET loyalty_stars = loyalty_stars - $1 WHERE id = $2`, [stars, customerId]);
        }
      }

      const finalTotal = parseFloat((gross - loyaltyDiscount).toFixed(2));
      const initStatus = resolvedSessionType === 'pos' ? 'accepted' : 'pending';

      // 7b. Insert order
      const { rows: [{ id: orderId, order_number: orderNumber }] } = await client.query<{ id: string; order_number: number }>(`
        INSERT INTO orders (
          tenant_id, branch_id, staff_id, customer_id, source, order_type,
          table_number, external_id, session_type, idempotency_key,
          subtotal, tax_rate, tax_amount, discount_amount, total_amount,
          loyalty_used, payment_method, status, notes, customer_notes,
          accepted_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
        RETURNING id,
          (SELECT COUNT(*) FROM orders WHERE branch_id = $2 AND DATE(created_at) = CURRENT_DATE) + 1 AS order_number
      `, [
        tenantId, branchId, staffId, customerId || null, resolvedSource, orderType,
        resolvedTable || null, externalId || null, resolvedSessionType, idempKey || null,
        subtotal.toFixed(2), taxRate, tax.toFixed(2), loyaltyDiscount.toFixed(2),
        finalTotal.toFixed(2), loyaltyUsed, paymentMethod || null, initStatus,
        notes || null, customerNotes || null,
        initStatus === 'accepted' ? new Date().toISOString() : null,
      ]);

      // 7c. Line items
      for (const item of items as OrderItemInput[]) {
        await client.query(`INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, subtotal, modifiers, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [orderId, item.productId || null, item.productName, item.unitPrice, item.quantity, (item.unitPrice * item.quantity).toFixed(2), JSON.stringify(item.modifiers || {}), item.notes || null]);
      }

      // 7d. Stock deduction (row-locked)
      const { alerts: stockAlerts } = await atomicStockDeduction(client, items, branchId, orderId, requestId);

      // 7e. Wallet deduction (row-locked)
      let newWalletBalance: number | null = null;
      if (walletAmt > 0 && customerId) {
        const wr = await atomicWalletDeduction(client, customerId, tenantId, walletAmt, orderId);
        newWalletBalance = wr.newBalance;
      }

      // 7f. QR session update
      if (resolvedSessionType === 'qr_menu' && qrSessionToken) {
        await client.query(`UPDATE qr_sessions SET orders_placed = orders_placed + 1, total_spent = total_spent + $1 WHERE session_token = $2`, [finalTotal, qrSessionToken]).catch(() => {});
      }

      // ── Queue socket events (NOT emitted yet — inside TX) ─────────────
      const kdsPayload = {
        orderId, tableNumber: resolvedTable, source: resolvedSource, sessionType: resolvedSessionType,
        items: (items as OrderItemInput[]).map(i => ({ name: i.productName, qty: i.quantity, modifiers: i.modifiers, notes: i.notes })),
        notes, customerNotes, createdAt: new Date().toISOString(), priority: 'normal',
      };
      emitter.queue('order:new',     { room: 'kds', tenantId, branchId }, kdsPayload);
      emitter.queue('order:created', { room: 'pos', tenantId, branchId }, { orderId, tableNumber: resolvedTable, total: finalTotal, source: resolvedSource, sessionType: resolvedSessionType });

      if (newWalletBalance !== null && customerId) {
        emitter.queue('wallet:payment', { room: 'customer', tenantId, recipientId: customerId }, { orderId, amount: walletAmt, newBalance: newWalletBalance });
      }
      for (const alert of stockAlerts) {
        emitter.queue('stock:low', { room: 'branch', tenantId, branchId }, alert);
        if (alert.alertLevel === 'critical' || alert.alertLevel === 'out_of_stock') {
          emitter.queue('stock:critical', { room: 'owner', tenantId }, { branchId, name: alert.ingredientName });
        }
      }
      if (customerId) {
        emitter.queue('order:confirmed', { room: 'customer', tenantId, recipientId: customerId }, { orderId, total: finalTotal });
      }

      return { orderId, finalTotal, stockAlerts, newWalletBalance, orderNumber: Number(orderNumber || 1) };
    });

    // ── [8] RESPOND TO CLIENT IMMEDIATELY ────────────────────────────────
    // Do NOT await socket or print — respond first, run async after
    const successBody = { success: true, data: { orderId: result.orderId, total: result.finalTotal, sessionType: resolvedSessionType } };
    if (idempKey) await storeIdempotencyKey(idempKey, tenantId, 'POST /orders', 201, successBody, result.orderId);

    await auditLog({ tenantId, branchId, actorId: staffId, actorType: 'staff', action: 'order.create', targetId: result.orderId, targetType: 'order', details: { source: resolvedSource, total: result.finalTotal, itemCount: (items as OrderItemInput[]).length }, requestId, ipAddress: req.ip });

    logger.info(`[Orders] ✅ ${result.orderId} | ${resolvedSessionType} | ${result.finalTotal} DH`);
    res.status(201).json(successBody);

    // ── [9] PARALLEL POST-COMMIT (fire-and-forget) ─────────────────────
    // Both run async AFTER response is sent — never block client
    Promise.all([
      // 9a. Socket emissions (zero ghost-order risk — post-commit)
      Promise.resolve().then(() => emitter.flush()),

      // 9b. Kitchen / bar printing
      printKitchenTickets({
        tenantId, branchId,
        orderId:      result.orderId,
        tableNumber:  resolvedTable || null,
        source:       resolvedSource,
        notes:        notes || null,
        items:        (items as OrderItemInput[]).map(i => ({
          name:      i.productName,
          quantity:  i.quantity,
          modifiers: i.modifiers,
          notes:     i.notes,
          category:  i.category,
        })),
        createdAt: new Date().toISOString(),
        priority:  'normal',
      }).catch(err => logger.warn(`[Orders] Print failed (non-blocking): ${err.message}`)),

    ]).catch(err => logger.error('[Orders] Post-commit action error:', err));

  } catch (err) {
    emitter.discard();
    if (err instanceof OutOfStockError)       { res.status(422).json({ success: false, errorCode: 'OUT_OF_STOCK', error: err.message, shortages: err.items }); return; }
    if (err instanceof WalletInsufficientError){ res.status(402).json({ success: false, errorCode: 'WALLET_INSUFFICIENT', error: err.message, available: err.available, required: err.required }); return; }
    if (err instanceof PaymentFailedError)     { res.status(402).json({ success: false, errorCode: 'PAYMENT_FAILED', error: err.message }); return; }
    logger.error(`[Orders] Create failed | reqId=${requestId}`, err);
    sendError(res, `Order failed: ${(err as Error).message}`);
  }
}

// ════════════════════════════════════════════════════════════════════════
//  UPDATE STATUS — KDS lifecycle + print receipt on 'paid'
// ════════════════════════════════════════════════════════════════════════
export async function updateOrderStatus(req: Request, res: Response): Promise<void> {
  const { id }     = req.params;
  const { status } = req.body;
  const tenantId   = req.tenantId!;

  const { rows } = await query<{
    status: string; branch_id: string; customer_id: string | null;
    is_voided: boolean; table_number: string | null; total_amount: string;
    session_type: string; staff_id: string | null; subtotal: string;
    tax_rate: string; tax_amount: string; discount_amount: string;
    payment_method: string | null; created_at: string;
  }>(`
    SELECT o.*, s.full_name AS staff_name
    FROM orders o
    LEFT JOIN staff s ON s.id = o.staff_id
    WHERE o.id = $1 AND o.tenant_id = $2
  `, [id, tenantId]);

  if (!rows.length) { sendNotFound(res, 'Order'); return; }
  const order = rows[0];
  if (order.is_voided) { sendForbidden(res, 'Cannot update a voided order'); return; }

  const allowed = VALID_TRANSITIONS[order.status] || [];
  if (!allowed.includes(status)) {
    sendError(res, `Cannot transition '${order.status}' → '${status}'. Allowed: [${allowed.join(', ')}]`, 422);
    return;
  }

  const emitter = createPostCommitEmitter();

  try {
    await withTransaction(async (client: PoolClient) => {
      const tsCol    = STATUS_TS[status];
      const tsClause = tsCol ? `, ${tsCol} = NOW()` : '';
      await client.query(`UPDATE orders SET status = $1${tsClause}, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`, [status, id, tenantId]);

      const payload = { orderId: id, status, previousStatus: order.status, table: order.table_number, sessionType: order.session_type, timestamp: new Date().toISOString() };
      if (['accepted','preparing','ready'].includes(status)) emitter.queue('order:status', { room: 'kds', tenantId, branchId: order.branch_id }, payload);
      if (['ready','delivered','paid'].includes(status))     emitter.queue('order:status', { room: 'pos', tenantId, branchId: order.branch_id }, payload);
      emitter.queue('order:status', { room: 'branch', tenantId, branchId: order.branch_id }, payload);

      const customerMessages: Record<string, string> = { preparing: '🍳 En préparation', ready: '✅ Prête!', delivered: '🎉 Livrée!', paid: '✅ Payée!' };
      if (order.customer_id && customerMessages[status]) {
        emitter.queue('order:status', { room: 'customer', tenantId, recipientId: order.customer_id }, { orderId: id, status, message: customerMessages[status] });
      }
    });

    sendSuccess(res, { orderId: id, status, previousStatus: order.status });

    // Post-commit: flush + print receipt if order is now paid
    Promise.all([
      Promise.resolve().then(() => emitter.flush()),

      status === 'paid' ? (async () => {
        // Fetch items for receipt
        const itemsResult = await query<{ product_name: string; quantity: number; unit_price: string; modifiers: Record<string, string> }>(`SELECT product_name, quantity, unit_price, modifiers FROM order_items WHERE order_id = $1`, [id]);
        const frontendUrl = process.env.FRONTEND_URL || 'https://www.cafeslux.com';
        const receiptData: ReceiptData = {
          tenantId, branchId: order.branch_id, orderId: id,
          orderNumber: Date.now(),
          tableNumber: order.table_number, source: order.session_type,
          staffName: null,
          items: itemsResult.rows.map(i => ({ name: i.product_name, quantity: i.quantity, unitPrice: parseFloat(i.unit_price), modifiers: i.modifiers || {} })),
          subtotal: parseFloat(order.subtotal),
          taxRate:  parseFloat(order.tax_rate),
          taxAmount: parseFloat(order.tax_amount),
          discountAmount: parseFloat(order.discount_amount),
          totalAmount: parseFloat(order.total_amount),
          paymentMethod: order.payment_method || 'cash',
          paidAt: new Date().toISOString(),
          ratingUrl: `${frontendUrl}/rate/${id}`,
        };
        return printCustomerReceipt(receiptData);
      })().catch(err => logger.warn(`[Orders] Receipt print failed: ${err.message}`))
      : Promise.resolve(),

    ]).catch(err => logger.error('[Orders] Post-commit status error:', err));

    await auditLog({ tenantId, branchId: order.branch_id, actorId: req.user?.sub, actorType: 'staff', action: `order.status.${status}`, targetId: id, targetType: 'order', details: { from: order.status, to: status }, requestId: req.requestId });

  } catch (err) {
    emitter.discard();
    sendError(res, 'Failed to update order status');
  }
}

// ════════════════════════════════════════════════════════════════════════
//  VOID ORDER
// ════════════════════════════════════════════════════════════════════════
export async function voidOrder(req: Request, res: Response): Promise<void> {
  const { id }     = req.params;
  const { reason } = req.body;
  const tenantId   = req.tenantId!;

  const { rows } = await query<{ status: string; branch_id: string; total_amount: string; is_voided: boolean; table_number: string | null }>(
    `SELECT status, branch_id, total_amount, is_voided, table_number FROM orders WHERE id = $1 AND tenant_id = $2`, [id, tenantId]
  );
  if (!rows.length) { sendNotFound(res, 'Order'); return; }
  const order = rows[0];
  if (order.is_voided) { sendError(res, 'Already voided', 409); return; }
  if (['paid','delivered'].includes(order.status)) { sendForbidden(res, 'Use refund for paid orders'); return; }

  const emitter = createPostCommitEmitter();
  try {
    await withTransaction(async (client: PoolClient) => {
      await client.query(`UPDATE orders SET is_voided = true, void_reason = $1, voided_by = $2, voided_at = NOW(), status = 'cancelled' WHERE id = $3`, [reason || 'No reason', req.user?.sub, id]);
      await client.query(`INSERT INTO void_alerts (branch_id, order_id, voided_by, amount, reason) VALUES ($1,$2,$3,$4,$5)`, [order.branch_id, id, req.user?.sub, order.total_amount, reason]);
      const payload = { orderId: id, amount: parseFloat(order.total_amount), table: order.table_number, reason, timestamp: new Date().toISOString() };
      emitter.queue('fraud:void',   { room: 'owner',  tenantId }, payload);
      emitter.queue('order:voided', { room: 'branch', tenantId, branchId: order.branch_id }, payload);
      emitter.queue('order:voided', { room: 'pos',    tenantId, branchId: order.branch_id }, payload);
    });

    sendSuccess(res, { voided: true });
    Promise.resolve().then(() => emitter.flush()).catch(() => {});
    await auditLog({ tenantId, branchId: order.branch_id, actorId: req.user?.sub, actorType: 'staff', action: 'order.void', targetId: id, targetType: 'order', details: { reason }, requestId: req.requestId });
  } catch (err) {
    emitter.discard();
    sendError(res, 'Failed to void order');
  }
}

// ── KDS live feed ──────────────────────────────────────────────────────────
export async function getKDSOrders(req: Request, res: Response): Promise<void> {
  const branchId = req.params.branchId || req.branchId!;
  const result   = await query(`SELECT * FROM v_kds_live WHERE branch_id = $1 AND tenant_id = $2`, [branchId, req.tenantId]);
  sendSuccess(res, result.rows);
}

// ── List orders ────────────────────────────────────────────────────────────
export async function listOrders(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const branchId = req.user?.role === 'owner' ? (req.query.branchId as string) : req.branchId;
  const { status, source, sessionType, from, to, page = 1, limit = 30 } = req.query;
  let where = 'WHERE o.tenant_id = $1'; const params: unknown[] = [tenantId]; let idx = 2;
  if (branchId)    { where += ` AND o.branch_id = $${idx++}`;      params.push(branchId); }
  if (status)      { where += ` AND o.status = $${idx++}`;          params.push(status); }
  if (source)      { where += ` AND o.source = $${idx++}`;          params.push(source); }
  if (sessionType) { where += ` AND o.session_type = $${idx++}`;    params.push(sessionType); }
  if (from)        { where += ` AND DATE(o.created_at) >= $${idx++}`; params.push(from); }
  if (to)          { where += ` AND DATE(o.created_at) <= $${idx++}`; params.push(to); }
  const result = await queryPaginated(`SELECT o.id,o.source,o.session_type,o.status,o.table_number,o.total_amount,o.is_voided,o.created_at,o.accepted_at,o.preparing_at,o.ready_at,o.delivered_at,o.paid_at,s.full_name AS staff_name,b.name AS branch_name FROM orders o LEFT JOIN staff s ON s.id=o.staff_id JOIN branches b ON b.id=o.branch_id ${where} ORDER BY o.created_at DESC`, params, Number(page), Number(limit));
  sendPaginated(res, result.rows, result.total, result.page, result.per_page);
}

// ── Daily summary ──────────────────────────────────────────────────────────
export async function getDailySummary(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const branchId = (req.query.branchId as string) || req.branchId!;
  const date     = (req.query.date as string) || new Date().toISOString().slice(0,10);
  const [summary, topProducts, bySession] = await Promise.all([
    query(`SELECT COUNT(*) FILTER (WHERE NOT is_voided) AS total_orders, COALESCE(SUM(total_amount) FILTER (WHERE NOT is_voided),0) AS total_revenue, COALESCE(AVG(EXTRACT(EPOCH FROM (ready_at-accepted_at))/60) FILTER (WHERE ready_at IS NOT NULL AND accepted_at IS NOT NULL),0) AS avg_prep_min FROM orders WHERE branch_id=$1 AND tenant_id=$2 AND DATE(created_at)=$3`, [branchId,tenantId,date]),
    query(`SELECT oi.product_name, SUM(oi.quantity) AS qty, SUM(oi.subtotal) AS revenue FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.branch_id=$1 AND o.tenant_id=$2 AND DATE(o.created_at)=$3 AND NOT o.is_voided GROUP BY oi.product_name ORDER BY revenue DESC LIMIT 10`, [branchId,tenantId,date]),
    query(`SELECT session_type, COUNT(*) FILTER(WHERE NOT is_voided) AS orders, COALESCE(SUM(total_amount) FILTER(WHERE NOT is_voided),0) AS revenue FROM orders WHERE branch_id=$1 AND tenant_id=$2 AND DATE(created_at)=$3 GROUP BY session_type`, [branchId,tenantId,date]),
  ]);
  sendSuccess(res, { date, summary: summary.rows[0], topProducts: topProducts.rows, bySessionType: bySession.rows });
}
