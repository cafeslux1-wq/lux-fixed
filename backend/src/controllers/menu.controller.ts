import { Request, Response } from 'express';
import { query } from '../config/database';
import { sendSuccess, sendCreated, sendError, sendNotFound } from '../utils/response';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export async function getPublicMenu(req: Request, res: Response): Promise<void> {
  try {
    const tenantSlug = req.params.tenantSlug || (req.query.slug as string) || 'lux';
    const branchId   = req.query.branchId as string | undefined;
    const tenantResult = await query<{ id: string; name: string; settings: Record<string, unknown> }>(`SELECT id, name, settings FROM tenants WHERE slug=$1 AND is_active=true`, [tenantSlug]);
    if (!tenantResult.rows.length) { sendNotFound(res, 'Menu'); return; }
    const tenant = tenantResult.rows[0] as { id: string; name: string; settings: Record<string, unknown> };
    const [categories, products] = await Promise.all([
      query(`SELECT id, name, name_ar, name_fr, icon, sort_order FROM categories WHERE tenant_id=$1 AND is_active=true ORDER BY sort_order`, [tenant.id]),
      query(`SELECT id, category_id, name, name_ar, name_fr, description, base_price, image_url, is_signature, is_available, sort_order, modifiers, prep_time_mins, calories, tags, product_category FROM products WHERE tenant_id=$1 AND is_available=true AND NOT ('deleted'=ANY(tags)) ORDER BY sort_order, name`, [tenant.id]),
    ]);
    let stockUnavailable = new Set<string>();
    if (branchId) {
      const stockCheck = await query<{ product_id: string }>(`SELECT DISTINCT r.product_id FROM recipes r JOIN ingredients i ON i.id=r.ingredient_id AND i.branch_id=$1 WHERE r.product_id=ANY($2::uuid[]) AND i.current_stock<r.qty_needed`, [branchId, (products.rows as Array<{id: string}>).map(p => p.id)]);
      stockUnavailable = new Set(stockCheck.rows.map(r => r.product_id));
    }
    interface ProductRow { id: string; category_id: string | null; name: string; name_ar: string | null; name_fr: string | null; description: string | null; base_price: string; image_url: string | null; is_signature: boolean; is_available: boolean; sort_order: number; modifiers: unknown; prep_time_mins: number; calories: number | null; tags: string[] | null; product_category: string | null }
    const productRows = products.rows as unknown as ProductRow[];
    const productsByCategory: Record<string, ProductRow[]> = {};
    for (const p of productRows) { const k = p.category_id || 'other'; if (!productsByCategory[k]) productsByCategory[k] = []; productsByCategory[k].push(p); }
    interface CatRow { id: string; name: string; name_ar: string | null; name_fr: string | null; icon: string | null }
    const menu = (categories.rows as unknown as CatRow[]).filter(c => (productsByCategory[c.id] || []).length > 0).map(cat => ({ id: cat.id, name: cat.name, nameAr: cat.name_ar, nameFr: cat.name_fr, icon: cat.icon, products: (productsByCategory[cat.id] || []).map((p: ProductRow) => ({ id: p.id, name: p.name, nameAr: p.name_ar, nameFr: p.name_fr, description: p.description, price: parseFloat(p.base_price), imageUrl: p.image_url, isSignature: p.is_signature, isAvailable: p.is_available && !stockUnavailable.has(p.id), stockAvailable: !stockUnavailable.has(p.id), prepTimeMins: p.prep_time_mins, calories: p.calories, tags: p.tags || [], modifiers: p.modifiers || [], category: p.product_category || 'food' })) }));
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    sendSuccess(res, { tenant: { name: tenant.name, slug: tenantSlug, currency: (tenant.settings?.currency as string) || 'MAD', taxRate: (tenant.settings?.tax_rate as number) || 0.10 }, categories: menu, productCount: products.rows.length, generatedAt: new Date().toISOString() });
  } catch (err) { logger.error('[Menu] Public menu error:', err); sendError(res, 'Failed to fetch menu'); }
}

export async function openQRSession(req: Request, res: Response): Promise<void> {
  try {
    const { branchId, tableNumber } = req.body;
    const tenantId = req.tenantId!;
    const branchCheck = await query<{ id: string }>(`SELECT id FROM branches WHERE id=$1 AND tenant_id=$2 AND is_active=true`, [branchId, tenantId]);
    if (!branchCheck.rows.length) { sendNotFound(res, 'Branch'); return; }
    await query(`UPDATE qr_sessions SET is_active=false, closed_at=NOW() WHERE branch_id=$1 AND table_number=$2 AND is_active=true`, [branchId, tableNumber]);
    const token = uuidv4();
    const result = await query<{ id: string }>(`INSERT INTO qr_sessions (tenant_id, branch_id, table_number, session_token) VALUES ($1,$2,$3,$4) RETURNING id`, [tenantId, branchId, tableNumber, token]);
    const qrUrl = `${process.env.FRONTEND_URL || 'https://www.cafeslux.com'}/menu?qr=${token}`;
    sendCreated(res, { sessionId: result.rows[0].id, sessionToken: token, tableNumber, qrUrl, expiresIn: '4 hours' });
  } catch (err) { sendError(res, 'Failed to open QR session'); }
}

export async function validateQRSession(req: Request, res: Response): Promise<void> {
  try {
    const { token } = req.params;
    const result = await query<{ id: string; table_number: string; is_active: boolean; expires_at: string; tenant_id: string; branch_id: string }>(`SELECT id, table_number, is_active, expires_at, tenant_id, branch_id FROM qr_sessions WHERE session_token=$1`, [token]);
    if (!result.rows.length) { sendNotFound(res, 'QR Session'); return; }
    const session = result.rows[0];
    if (!session.is_active || new Date(session.expires_at) < new Date()) {
      res.status(401).json({ success: false, error: 'QR session expired — please ask staff to refresh', expired: true }); return;
    }
    const tenantResult = await query<{ slug: string }>(`SELECT slug FROM tenants WHERE id=$1`, [session.tenant_id]);
    sendSuccess(res, { valid: true, sessionId: session.id, tableNumber: session.table_number, tenantSlug: tenantResult.rows[0]?.slug || 'lux', branchId: session.branch_id });
  } catch { sendError(res, 'Failed to validate QR session'); }
}

export async function closeQRSession(req: Request, res: Response): Promise<void> {
  try {
    const { token } = req.params;
    const result = await query<{ table_number: string; orders_placed: number; total_spent: string }>(`UPDATE qr_sessions SET is_active=false, closed_at=NOW() WHERE session_token=$1 AND tenant_id=$2 AND is_active=true RETURNING table_number, orders_placed, total_spent`, [token, req.tenantId]);
    if (!result.rows.length) { sendError(res, 'Session not found or already closed', 404); return; }
    sendSuccess(res, { closed: true, tableNumber: result.rows[0].table_number, ordersPlaced: result.rows[0].orders_placed, totalSpent: parseFloat(result.rows[0].total_spent) });
  } catch { sendError(res, 'Failed to close QR session'); }
}

export async function toggleProductAvailability(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const result = await query<{ is_available: boolean }>(`UPDATE products SET is_available=NOT is_available, updated_at=NOW() WHERE id=$1 AND tenant_id=$2 RETURNING is_available`, [id, req.tenantId]);
    if (!result.rows.length) { sendNotFound(res, 'Product'); return; }
    sendSuccess(res, { productId: id, isAvailable: result.rows[0].is_available });
  } catch { sendError(res, 'Failed to toggle product'); }
}
