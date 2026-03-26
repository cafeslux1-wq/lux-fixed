/**
 * ══════════════════════════════════════════════════════════
 *  LUX SUPREME — Recipe-Based Inventory Deduction Service
 *  Automatically deducts ingredients when an order is placed.
 *  Emits real-time stock:low alerts if thresholds are crossed.
 * ══════════════════════════════════════════════════════════
 */

import { PoolClient } from 'pg';
import { query, withTransaction } from '../config/database';
import { logger } from '../utils/logger';
import { emitToBranch, emitToOwner, Rooms } from '../services/socket.service';

// ── Types ─────────────────────────────────────────────────────────────────
interface OrderItem {
  productId?:  string;
  productName: string;
  quantity:    number;
}

interface DeductionResult {
  success:         boolean;
  deductions:      IngredientDeduction[];
  lowStockAlerts:  LowStockAlert[];
  unavailableItems: string[];
}

interface IngredientDeduction {
  ingredientId:   string;
  ingredientName: string;
  unit:           string;
  deducted:       number;
  remaining:      number;
  belowMinimum:   boolean;
}

interface LowStockAlert {
  ingredientId:   string;
  name:           string;
  unit:           string;
  currentStock:   number;
  minimumStock:   number;
  alertLevel:     'warning' | 'critical' | 'out_of_stock';
}

// ════════════════════════════════════════════════════════════════════════
//  MAIN DEDUCTION FUNCTION
//  Called inside orders.controller.ts after order is created.
//  Runs atomically in the same transaction as order creation.
// ════════════════════════════════════════════════════════════════════════
export async function deductIngredientsForOrder(
  client:    PoolClient,
  items:     OrderItem[],
  branchId:  string,
  tenantId:  string,
  orderId:   string,
  requestId?: string,
): Promise<DeductionResult> {

  const deductions:      IngredientDeduction[] = [];
  const lowStockAlerts:  LowStockAlert[]        = [];
  const unavailableItems: string[]              = [];

  for (const item of items) {
    if (!item.productId) continue;

    // Fetch recipe for this product
    const recipeResult = await client.query<{
      ingredient_id: string;
      ingredient_name: string;
      qty_needed: string;
      unit: string;
      current_stock: string;
      min_stock: string;
    }>(`
      SELECT
        r.ingredient_id,
        i.name AS ingredient_name,
        r.qty_needed,
        r.unit,
        i.current_stock,
        i.min_stock
      FROM recipes r
      JOIN ingredients i ON i.id = r.ingredient_id AND i.branch_id = $2
      WHERE r.product_id = $1
      ORDER BY i.name
    `, [item.productId, branchId]);

    if (!recipeResult.rows.length) continue; // No recipe = no deduction

    const totalToDeduct = item.quantity;

    for (const recipeRow of recipeResult.rows) {
      const qtyNeeded    = parseFloat(recipeRow.qty_needed) * totalToDeduct;
      const currentStock = parseFloat(recipeRow.current_stock);

      // Check if we have enough stock
      if (currentStock < qtyNeeded) {
        unavailableItems.push(
          `${item.productName} (needs ${qtyNeeded}${recipeRow.unit} of ${recipeRow.ingredient_name}, only ${currentStock}${recipeRow.unit} available)`
        );
        // In production mode: log but don't block the order
        // Kitchen will manage. Stock goes to 0 not negative.
        logger.warn(`[Inventory] Insufficient stock: ${recipeRow.ingredient_name} — need ${qtyNeeded}, have ${currentStock} | requestId: ${requestId}`);
      }

      // Atomically deduct (floor at 0)
      const newStockResult = await client.query<{
        current_stock: string;
        min_stock: string;
      }>(`
        UPDATE ingredients
        SET current_stock = GREATEST(0, current_stock - $1)
        WHERE id = $2 AND branch_id = $3
        RETURNING current_stock, min_stock
      `, [qtyNeeded, recipeRow.ingredient_id, branchId]);

      if (!newStockResult.rows.length) continue;

      const newStock   = parseFloat(newStockResult.rows[0].current_stock);
      const minStock   = parseFloat(newStockResult.rows[0].min_stock);
      const belowMin   = newStock <= minStock;

      // Log movement
      await client.query(`
        INSERT INTO stock_movements (
          ingredient_id, branch_id, movement_type,
          delta, stock_after, reference_id, note
        ) VALUES ($1, $2, 'sale', $3, $4, $5, $6)
      `, [
        recipeRow.ingredient_id, branchId,
        -qtyNeeded, newStock, orderId,
        `Auto-deducted: ${item.quantity}x ${item.productName}`,
      ]);

      deductions.push({
        ingredientId:   recipeRow.ingredient_id,
        ingredientName: recipeRow.ingredient_name,
        unit:           recipeRow.unit,
        deducted:       qtyNeeded,
        remaining:      newStock,
        belowMinimum:   belowMin,
      });

      // Build low-stock alert if threshold crossed
      if (belowMin) {
        const stockPct = minStock > 0 ? (newStock / minStock) * 100 : 100;
        lowStockAlerts.push({
          ingredientId:  recipeRow.ingredient_id,
          name:          recipeRow.ingredient_name,
          unit:          recipeRow.unit,
          currentStock:  newStock,
          minimumStock:  minStock,
          alertLevel:    newStock <= 0 ? 'out_of_stock' : stockPct <= 50 ? 'critical' : 'warning',
        });
      }
    }
  }

  return { success: true, deductions, lowStockAlerts, unavailableItems };
}

// ════════════════════════════════════════════════════════════════════════
//  EMIT LOW-STOCK ALERTS (called AFTER transaction commits)
//  Separated from deduction to avoid emitting if transaction rolls back
// ════════════════════════════════════════════════════════════════════════
export function emitStockAlerts(
  tenantId:  string,
  branchId:  string,
  alerts:    LowStockAlert[],
  orderId:   string,
): void {
  if (!alerts.length) return;

  const critical = alerts.filter(a => a.alertLevel === 'critical' || a.alertLevel === 'out_of_stock');
  const warnings = alerts.filter(a => a.alertLevel === 'warning');

  // Emit to branch staff (manager + cashier see this)
  emitToBranch(tenantId, branchId, 'stock:low', {
    orderId,
    triggeredAt:  new Date().toISOString(),
    critical:     critical.length,
    warnings:     warnings.length,
    items:        alerts.map(a => ({
      name:         a.name,
      unit:         a.unit,
      currentStock: a.currentStock,
      minimumStock: a.minimumStock,
      level:        a.alertLevel,
    })),
  });

  // Critical items also alert the owner
  if (critical.length > 0) {
    emitToOwner(tenantId, 'stock:critical', {
      branchId,
      items:      critical.map(a => a.name).join(', '),
      count:      critical.length,
      timestamp:  new Date().toISOString(),
    });

    logger.warn(`[Stock] CRITICAL low stock in branch ${branchId}: ${critical.map(a => a.name).join(', ')}`);
  }
}

// ════════════════════════════════════════════════════════════════════════
//  PRE-ORDER AVAILABILITY CHECK
//  Call this before creating an order to warn the POS cashier
// ════════════════════════════════════════════════════════════════════════
export async function checkOrderFeasibility(
  items:    OrderItem[],
  branchId: string,
): Promise<{ feasible: boolean; warnings: string[]; blockers: string[] }> {

  const warnings: string[] = [];
  const blockers: string[] = [];

  for (const item of items) {
    if (!item.productId) continue;

    const recipeResult = await query<{
      ingredient_name: string;
      qty_needed: string;
      current_stock: string;
      min_stock: string;
    }>(`
      SELECT
        i.name AS ingredient_name,
        r.qty_needed * $3 AS qty_needed,
        i.current_stock,
        i.min_stock
      FROM recipes r
      JOIN ingredients i ON i.id = r.ingredient_id AND i.branch_id = $2
      WHERE r.product_id = $1
    `, [item.productId, branchId, item.quantity]);

    for (const row of recipeResult.rows) {
      const needed  = parseFloat(row.qty_needed);
      const current = parseFloat(row.current_stock);
      const minimum = parseFloat(row.min_stock);

      if (current < needed) {
        blockers.push(`${item.productName}: stock insuffisant (${row.ingredient_name})`);
      } else if (current - needed < minimum) {
        warnings.push(`${item.productName}: cet article va mettre ${row.ingredient_name} sous le seuil minimum`);
      }
    }
  }

  return {
    feasible: blockers.length === 0,
    warnings,
    blockers,
  };
}
