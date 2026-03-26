import { PoolClient } from 'pg';
import { query } from '../config/database';

export class OutOfStockError extends Error {
  public readonly code = 'OUT_OF_STOCK';
  public readonly items: StockShortage[];
  constructor(items: StockShortage[]) {
    super(`Insufficient stock: ${items.map(i => i.ingredientName).join(', ')}`);
    this.name = 'OutOfStockError'; this.items = items;
  }
}
export class WalletInsufficientError extends Error {
  public readonly code = 'WALLET_INSUFFICIENT';
  public readonly available: number; public readonly required: number;
  constructor(available: number, required: number) {
    super(`Wallet balance insufficient: ${available.toFixed(2)} DH available, ${required.toFixed(2)} DH required`);
    this.name = 'WalletInsufficientError'; this.available = available; this.required = required;
  }
}
export class PaymentFailedError extends Error {
  public readonly code = 'PAYMENT_FAILED';
  constructor(detail: string) { super(detail); this.name = 'PaymentFailedError'; }
}

export interface StockShortage { productName: string; ingredientId: string; ingredientName: string; unit: string; needed: number; available: number; deficit: number }
export interface OrderItem { productId?: string; productName: string; quantity: number; modifiers?: Record<string, string> }
export interface DeductionAlert { ingredientId: string; ingredientName: string; unit: string; newStock: number; minStock: number; alertLevel: 'warning' | 'critical' | 'out_of_stock' }

export async function preflightStockCheck(items: OrderItem[], branchId: string): Promise<{ ok: boolean; shortages: StockShortage[] }> {
  const productIds = items.filter(i => i.productId).map(i => i.productId!);
  if (!productIds.length) return { ok: true, shortages: [] };
  const recipeResult = await query<{ product_id: string; ingredient_id: string; ingredient_name: string; qty_needed: string; unit: string; current_stock: string }>(
    `SELECT r.product_id, i.id AS ingredient_id, i.name AS ingredient_name, r.qty_needed, r.unit, i.current_stock FROM recipes r JOIN ingredients i ON i.id = r.ingredient_id AND i.branch_id = $2 WHERE r.product_id = ANY($1::uuid[])`,
    [productIds, branchId]
  );
  const recipeMap: Record<string, typeof recipeResult.rows> = {};
  for (const row of recipeResult.rows) { if (!recipeMap[row.product_id]) recipeMap[row.product_id] = []; recipeMap[row.product_id].push(row); }
  const shortages: StockShortage[] = [];
  for (const item of items) {
    if (!item.productId) continue;
    for (const line of recipeMap[item.productId] || []) {
      const needed = parseFloat(line.qty_needed) * item.quantity;
      const available = parseFloat(line.current_stock);
      if (available < needed) shortages.push({ productName: item.productName, ingredientId: line.ingredient_id, ingredientName: line.ingredient_name, unit: line.unit, needed, available, deficit: parseFloat((needed - available).toFixed(3)) });
    }
  }
  return { ok: shortages.length === 0, shortages };
}

export async function atomicStockDeduction(client: PoolClient, items: OrderItem[], branchId: string, orderId: string, requestId: string): Promise<{ alerts: DeductionAlert[] }> {
  const alerts: DeductionAlert[] = [];
  const productIds = items.filter(i => i.productId).map(i => i.productId!);
  if (!productIds.length) return { alerts };
  const recipeResult = await client.query<{ product_id: string; ingredient_id: string; ingredient_name: string; qty_needed: string; unit: string; current_stock: string; min_stock: string }>(
    `SELECT r.product_id, i.id AS ingredient_id, i.name AS ingredient_name, r.qty_needed, r.unit, i.current_stock, i.min_stock FROM recipes r JOIN ingredients i ON i.id = r.ingredient_id AND i.branch_id = $2 WHERE r.product_id = ANY($1::uuid[]) ORDER BY i.id FOR UPDATE OF i`,
    [productIds, branchId]
  );
  const deductionMap: Record<string, { ingredientName: string; unit: string; totalQty: number; currentStock: number; minStock: number }> = {};
  for (const line of recipeResult.rows) {
    const orderItem = items.find(i => i.productId === line.product_id);
    if (!orderItem) continue;
    const ingId = line.ingredient_id;
    if (!deductionMap[ingId]) deductionMap[ingId] = { ingredientName: line.ingredient_name, unit: line.unit, totalQty: 0, currentStock: parseFloat(line.current_stock), minStock: parseFloat(line.min_stock) };
    deductionMap[ingId].totalQty += parseFloat(line.qty_needed) * orderItem.quantity;
  }
  for (const [ingId, data] of Object.entries(deductionMap)) {
    if (data.currentStock < data.totalQty) throw new OutOfStockError([{ productName: 'Unknown', ingredientId: ingId, ingredientName: data.ingredientName, unit: data.unit, needed: data.totalQty, available: data.currentStock, deficit: parseFloat((data.totalQty - data.currentStock).toFixed(3)) }]);
    const newStock = parseFloat((data.currentStock - data.totalQty).toFixed(4));
    await client.query(`UPDATE ingredients SET current_stock = $1 WHERE id = $2 AND branch_id = $3`, [newStock, ingId, branchId]);
    await client.query(`INSERT INTO stock_movements (ingredient_id, branch_id, movement_type, delta, stock_after, reference_id, note) VALUES ($1,$2,'sale',$3,$4,$5,$6)`, [ingId, branchId, -data.totalQty, newStock, orderId, `Order | reqId:${requestId}`]);
    if (newStock <= data.minStock) {
      const pct = data.minStock > 0 ? (newStock / data.minStock) * 100 : 100;
      alerts.push({ ingredientId: ingId, ingredientName: data.ingredientName, unit: data.unit, newStock, minStock: data.minStock, alertLevel: newStock <= 0 ? 'out_of_stock' : pct <= 50 ? 'critical' : 'warning' });
    }
  }
  return { alerts };
}

export async function atomicWalletDeduction(client: PoolClient, customerId: string, tenantId: string, amount: number, orderId: string): Promise<{ newBalance: number }> {
  const result = await client.query<{ wallet_balance: string }>(`SELECT wallet_balance FROM customers WHERE id = $1 AND tenant_id = $2 FOR UPDATE`, [customerId, tenantId]);
  if (!result.rows.length) throw new PaymentFailedError('Customer not found');
  const balance = parseFloat(result.rows[0].wallet_balance);
  if (balance < amount) throw new WalletInsufficientError(balance, amount);
  const newBalance = parseFloat((balance - amount).toFixed(2));
  await client.query(`UPDATE customers SET wallet_balance = $1, updated_at = NOW() WHERE id = $2`, [newBalance, customerId]);
  await client.query(`INSERT INTO wallet_transactions (customer_id, amount, balance_after, transaction_type, reference_id, payment_method) VALUES ($1,$2,$3,'payment',$4,'wallet')`, [customerId, -amount, newBalance, orderId]);
  return { newBalance };
}
