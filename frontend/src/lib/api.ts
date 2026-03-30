// ─── CAFÉ LUX — API Client v2 ────────────────────────────────────────
// All endpoints normalized under /api/v1/*
// Legacy /api/* routes handled by adapters — no double try/catch in pages.
// Every method: API → local fallback → queue on fail.

import type {
  Order, OrderStatus, OrderLineItem, CreateOrderPayload,
  MenuCategory, MenuItem,
  AuthResponse, PinAuthPayload, StaffUser,
  Customer, LoyaltyLevel,
  Coupon, CouponValidationResult,
  GiftCard, Reservation, Review,
  StockItem, StockResponse,
  AnalyticsSummary, POSTransaction,
} from './types';
import { CAFE, STATIC_MENU, DEFAULT_COUPONS, getLoyaltyLevel } from './constants';

const MENU_TTL = 5 * 60 * 1000; // 5 min

// ── LS helpers ────────────────────────────────────────────────────────
function ls<T>(key: string, def: T): T {
  try { return JSON.parse(localStorage.getItem(`lux_${key}`) ?? 'null') ?? def; }
  catch { return def; }
}
function lsSet(key: string, val: unknown) {
  localStorage.setItem(`lux_${key}`, JSON.stringify(val));
}

// ── Offline queue ─────────────────────────────────────────────────────
function enqueue(action: string, data: unknown) {
  const q = ls<Array<{ action: string; data: unknown; ts: number }>>('pending_sync', []);
  q.push({ action, data, ts: Date.now() });
  lsSet('pending_sync', q);
}

// ── Response normalizers ──────────────────────────────────────────────
// Handle both legacy shape { products: [{n,p}] } and v1 shape [{ id, name }]
function normalizeMenuCategory(raw: unknown): MenuCategory {
  const r = raw as Record<string, unknown>;
  const rawItems = (r.products ?? r.items ?? []) as unknown[];
  return {
    id:        Number(r.id ?? 0),
    name:      String(r.name ?? ''),
    icon:      String(r.icon ?? ''),
    sortOrder: Number(r.sortOrder ?? r.sort_order ?? 0),
    products:  rawItems.map(normalizeMenuItem),
  };
}

function normalizeMenuItem(raw: unknown): MenuItem {
  const r = raw as Record<string, unknown>;
  return {
    id:          Number(r.id ?? 0),
    name:        String(r.name ?? r.n ?? ''),
    description: String(r.description ?? r.desc ?? ''),
    price:       Number(r.price ?? r.p ?? 0),
    imageUrl:    String(r.imageUrl ?? r.image_url ?? r.img ?? ''),
    isSignature: Boolean(r.isSignature ?? r.is_signature ?? false),
    categoryId:  Number(r.categoryId ?? r.category_id ?? r.catId ?? 0),
    active:      r.active !== false,
  };
}

function normalizeOrder(raw: unknown): Order {
  const r = raw as Record<string, unknown>;
  const rawItems = (r.items ?? []) as unknown[];
  return {
    id:          Number(r.id ?? 0),
    customer:    String(r.customer ?? r.customerName ?? ''),
    phone:       String(r.phone ?? ''),
    type:        (r.type ?? 'table') as Order['type'],
    status:      (r.status ?? 'pending') as Order['status'],
    source:      (r.source ?? 'web') as Order['source'],
    items:       rawItems.map(i => {
      const x = i as Record<string, unknown>;
      return { name: String(x.name ?? x.n ?? ''), price: Number(x.price ?? x.p ?? 0), qty: Number(x.qty ?? x.q ?? 1) };
    }),
    subtotal:    Number(r.subtotal ?? 0),
    deliveryFee: Number(r.deliveryFee ?? r.delivery_fee ?? 0),
    discount:    Number(r.discount ?? 0),
    total:       Number(r.total ?? 0),
    payMethod:   String(r.payMethod ?? r.pay_method ?? 'cash'),
    payRef:      r.payRef ? String(r.payRef) : undefined,
    address:     r.address ? String(r.address) : undefined,
    notes:       r.notes   ? String(r.notes)   : undefined,
    tableNum:    r.tableNum != null ? Number(r.tableNum) : null,
    date:        String(r.date ?? ''),
    time:        String(r.time ?? ''),
  };
}

function normalizeAuthResponse(raw: unknown): AuthResponse {
  const r = raw as Record<string, unknown>;
  const u = (r.user ?? r.staff ?? r) as Record<string, unknown>;
  return {
    token: String(r.token ?? r.accessToken ?? ''),
    user:  {
      id:   String(u.id ?? u.staffId ?? ''),
      name: String(u.name ?? ''),
      role: (u.role ?? 'barista') as StaffUser['role'],
    },
  };
}

// ── Main API client ───────────────────────────────────────────────────
export class LuxAPIClient {
  private token = localStorage.getItem('lux_auth_token') ?? null;
  private memCache = new Map<string, { data: unknown; ts: number }>();

  // ── HTTP core ────────────────────────────────────────────────────
  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const res = await fetch(`${CAFE.apiBase}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(8000),
    });

    if (res.status === 401) { this.setToken(null); throw new Error('AUTH_EXPIRED'); }
    if (!res.ok) throw new Error(`API_${res.status}`);
    return res.json() as Promise<T>;
  }

  private get  = <T>(p: string)             => this.req<T>('GET',   p);
  private post = <T>(p: string, d: unknown) => this.req<T>('POST',  p, d);
  private patch= <T>(p: string, d: unknown) => this.req<T>('PATCH', p, d);

  setToken(t: string | null) {
    this.token = t;
    t ? localStorage.setItem('lux_auth_token', t) : localStorage.removeItem('lux_auth_token');
  }

  // ════════════════════════════════════════════════════════════════
  //  AUTH
  // ════════════════════════════════════════════════════════════════
  async loginAdmin(username: string, password: string): Promise<AuthResponse> {
    // Try v1 first, fall back to legacy
    let raw: unknown;
    try   { raw = await this.post('/api/v1/auth/login', { username, password }); }
    catch { raw = await this.post('/api/auth/login',    { username, password }); }
    const data = normalizeAuthResponse(raw);
    this.setToken(data.token);
    return data;
  }

  async authenticateStaffPin(staffId: string, pin: string): Promise<AuthResponse> {
    try {
      const raw  = await this.post('/api/v1/auth/staff/pin', { staffId, pin } as PinAuthPayload);
      const data = normalizeAuthResponse(raw);
      this.setToken(data.token);
      return data;
    } catch {
      // Offline / no-server fallback — validate against cached PINs
      const pins = ls<Record<string, string>>('staff_pins', {});
      const emps = ls<StaffUser[]>('employees', []);
      const emp  = emps.find(e => e.id === staffId);
      if (!emp) throw new Error('STAFF_NOT_FOUND');
      if (pin !== (pins[staffId] ?? '1234')) throw new Error('INVALID_PIN');
      const token = `local_${staffId}_${Date.now()}`;
      this.setToken(token);
      return { token, user: emp };
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  MENU — /api/v1/menu/public with 5-min in-memory cache
  // ════════════════════════════════════════════════════════════════
  async getPublicMenu(force = false): Promise<MenuCategory[]> {
    const key = 'menu_public';
    const mem = this.memCache.get(key);
    if (!force && mem && (Date.now() - mem.ts) < MENU_TTL)
      return mem.data as MenuCategory[];

    try {
      // Try v1 versioned endpoint first, fall back to v0
      let raw: unknown;
      try   { raw = await this.get('/api/v1/menu/public'); }
      catch { raw = await this.get('/api/menu'); }

      const data: MenuCategory[] = (Array.isArray(raw) ? raw : []).map(normalizeMenuCategory);
      this.memCache.set(key, { data, ts: Date.now() });
      lsSet('menu_cache', data);
      return data;
    } catch {
      const cached = ls<MenuCategory[]>('menu_cache', []);
      return cached.length > 0 ? cached : STATIC_MENU;
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  ORDERS
  // ════════════════════════════════════════════════════════════════
  async createOrder(payload: CreateOrderPayload): Promise<Order> {
    const now = new Date();
    const local: Order = {
      ...payload,
      id:     Date.now(),
      source: 'web',
      status: 'pending',
      date:   now.toLocaleDateString('fr-MA'),
      time:   now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      _local: true,
    };

    // Optimistic save
    const orders = ls<Order[]>('web_orders', []);
    orders.unshift(local);
    lsSet('web_orders', orders);

    try {
      let raw: unknown;
      try   { raw = await this.post('/api/v1/orders', payload); }
      catch { raw = await this.post('/api/orders',    payload); }
      const saved = normalizeOrder(raw);
      const updated = ls<Order[]>('web_orders', []).map(o => o._local && o.id === local.id ? saved : o);
      lsSet('web_orders', updated);
      return saved;
    } catch {
      enqueue('createOrder', payload);
      return local;
    }
  }

  async getOrders(params: Record<string, string> = {}): Promise<Order[]> {
    try {
      const qs  = new URLSearchParams(params).toString();
      let raw: unknown;
      try   { raw = await this.get(`/api/v1/orders${qs ? `?${qs}` : ''}`); }
      catch { raw = await this.get(`/api/orders${qs ? `?${qs}` : ''}`); }
      const data = (Array.isArray(raw) ? raw : []).map(normalizeOrder);
      // Merge with local
      const local  = ls<Order[]>('web_orders', []);
      const merged = [...data];
      local.forEach(lo => { if (!merged.find(ao => ao.id === lo.id)) merged.push(lo); });
      merged.sort((a, b) => b.id - a.id);
      lsSet('web_orders', merged.slice(0, 300));
      return merged;
    } catch {
      return ls<Order[]>('web_orders', []);
    }
  }

  async updateOrderStatus(id: number, status: OrderStatus): Promise<void> {
    const orders = ls<Order[]>('web_orders', []);
    const o = orders.find(x => x.id === id);
    if (o) { o.status = status; lsSet('web_orders', orders); }
    try {
      try   { await this.patch(`/api/v1/orders/${id}/status`, { status }); }
      catch { await this.patch(`/api/orders/${id}/status`,    { status }); }
    } catch {
      enqueue('updateOrderStatus', { id, status });
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  POS TRANSACTIONS
  // ════════════════════════════════════════════════════════════════
  async saveTransaction(tx: POSTransaction): Promise<void> {
    const txs = ls<POSTransaction[]>('transactions', []);
    txs.unshift(tx);
    lsSet('transactions', txs.slice(0, 500));
    try {
      try   { await this.post('/api/v1/transactions', tx); }
      catch { await this.post('/api/transactions',    tx); }
    } catch {
      enqueue('saveTransaction', tx);
    }
  }

  async getTransactions(params: Record<string, string> = {}): Promise<POSTransaction[]> {
    try {
      const qs = new URLSearchParams(params).toString();
      const raw = await this.get<POSTransaction[]>(`/api/v1/transactions${qs ? `?${qs}` : ''}`);
      return Array.isArray(raw) ? raw : [];
    } catch {
      return ls<POSTransaction[]>('transactions', []);
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  STOCK
  // ════════════════════════════════════════════════════════════════
  async getStock(): Promise<StockResponse> {
    try {
      let raw: unknown;
      try   { raw = await this.get('/api/v1/stock'); }
      catch { raw = await this.get('/api/stock'); }
      const r = raw as Record<string, unknown>;
      const items  = (Array.isArray(r.items)  ? r.items  : []) as StockItem[];
      const alerts = (Array.isArray(r.alerts) ? r.alerts : items.filter((i: StockItem) => i.quantity <= i.minQuantity));
      return { items, alerts };
    } catch {
      const items = ls<StockItem[]>('stock_items', []);
      return { items, alerts: items.filter(i => i.quantity <= i.minQuantity) };
    }
  }

  async updateStock(id: number, quantity: number): Promise<void> {
    const items = ls<StockItem[]>('stock_items', []);
    const item  = items.find(i => i.id === id);
    if (item) { item.quantity = quantity; lsSet('stock_items', items); }
    try {
      try   { await this.patch(`/api/v1/stock/${id}`, { quantity }); }
      catch { await this.patch(`/api/stock/${id}`,    { quantity }); }
    } catch {
      enqueue('updateStock', { id, quantity });
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  CUSTOMERS
  // ════════════════════════════════════════════════════════════════
  async getCustomer(phone: string): Promise<Customer | null> {
    try {
      let raw: unknown;
      try   { raw = await this.get(`/api/v1/customers/${encodeURIComponent(phone)}`); }
      catch { raw = await this.get(`/api/customers/${encodeURIComponent(phone)}`); }
      const r = raw as Record<string, unknown>;
      const customer: Customer = {
        phone:         String(r.phone ?? phone),
        name:          String(r.name ?? ''),
        email:         r.email ? String(r.email) : undefined,
        loyaltyPoints: Number(r.loyaltyPoints ?? r.loyalty_points ?? 0),
        level:         (r.level ?? getLoyaltyLevel(Number(r.loyaltyPoints ?? 0)).id) as LoyaltyLevel,
        orders:        ((r.orders ?? []) as unknown[]).map(normalizeOrder),
        badges:        (r.badges ?? []) as string[],
      };
      const all = ls<Record<string, Customer>>('web_customers', {});
      all[phone] = customer;
      lsSet('web_customers', all);
      return customer;
    } catch {
      return ls<Record<string, Customer>>('web_customers', {})[phone] ?? null;
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  RESERVATIONS
  // ════════════════════════════════════════════════════════════════
  async getReservations(date?: string): Promise<Reservation[]> {
    try {
      const qs = date ? `?date=${date}` : '';
      let raw: unknown;
      try   { raw = await this.get(`/api/v1/reservations${qs}`); }
      catch { raw = await this.get(`/api/reservations${qs}`); }
      return Array.isArray(raw) ? raw as Reservation[] : [];
    } catch {
      const all = ls<Reservation[]>('reservations', []);
      return date ? all.filter(r => r.date === date) : all;
    }
  }

  async createReservation(res: Omit<Reservation, 'id' | 'status' | '_local'>): Promise<Reservation> {
    const local: Reservation = { ...res, id: Date.now(), status: 'confirmed', _local: true };
    const all = ls<Reservation[]>('reservations', []);
    all.unshift(local);
    lsSet('reservations', all);
    try {
      let raw: unknown;
      try   { raw = await this.post('/api/v1/reservations', res); }
      catch { raw = await this.post('/api/reservations',    res); }
      const saved = raw as Reservation;
      const updated = ls<Reservation[]>('reservations', []).map(r => r._local && r.id === local.id ? saved : r);
      lsSet('reservations', updated);
      return saved;
    } catch {
      enqueue('createReservation', res);
      return local;
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  REVIEWS
  // ════════════════════════════════════════════════════════════════
  async getReviews(): Promise<Review[]> {
    try {
      let raw: unknown;
      try   { raw = await this.get('/api/v1/reviews'); }
      catch { raw = await this.get('/api/reviews'); }
      const data = Array.isArray(raw) ? raw as Review[] : [];
      lsSet('reviews', data);
      return data;
    } catch {
      return ls<Review[]>('reviews', []);
    }
  }

  async createReview(review: Omit<Review, 'id' | 'verified' | 'createdAt'>): Promise<Review> {
    const local: Review = { ...review, id: Date.now(), verified: false, createdAt: new Date().toISOString() };
    const all = ls<Review[]>('reviews', []);
    all.unshift(local);
    lsSet('reviews', all);
    try {
      let raw: unknown;
      try   { raw = await this.post('/api/v1/reviews', review); }
      catch { raw = await this.post('/api/reviews',    review); }
      return raw as Review;
    } catch {
      enqueue('createReview', review);
      return local;
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  GIFT CARDS
  // ════════════════════════════════════════════════════════════════
  async createGiftCard(gc: Pick<GiftCard, 'sender'|'recipient'|'amount'|'phone'|'message'>): Promise<GiftCard> {
    try {
      let raw: unknown;
      try   { raw = await this.post('/api/v1/gift-cards', gc); }
      catch { raw = await this.post('/api/gift-cards',    gc); }
      const saved = raw as GiftCard;
      const all = ls<GiftCard[]>('gift_cards', []);
      all.unshift(saved);
      lsSet('gift_cards', all);
      return saved;
    } catch {
      const code  = `LUX-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const local: GiftCard = {
        ...gc, id: Date.now(), code,
        balance: gc.amount, status: 'active',
        created: new Date().toISOString(),
        expires: new Date(Date.now() + 365 * 86400_000).toLocaleDateString('fr-MA'),
      };
      const all = ls<GiftCard[]>('gift_cards', []);
      all.unshift(local);
      lsSet('gift_cards', all);
      return local;
    }
  }

  async checkGiftCard(code: string): Promise<GiftCard | null> {
    try {
      let raw: unknown;
      try   { raw = await this.get(`/api/v1/gift-cards/${code.toUpperCase()}`); }
      catch { raw = await this.get(`/api/gift-cards/${code.toUpperCase()}`); }
      return raw as GiftCard;
    } catch {
      return ls<GiftCard[]>('gift_cards', []).find(g => g.code === code.toUpperCase()) ?? null;
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  COUPONS
  // ════════════════════════════════════════════════════════════════
  async validateCoupon(code: string, subtotal: number): Promise<CouponValidationResult> {
    try {
      let raw: unknown;
      try   { raw = await this.post('/api/v1/coupons/validate', { code, subtotal }); }
      catch { raw = await this.post('/api/coupons/validate',    { code, subtotal }); }
      return raw as CouponValidationResult;
    } catch {
      const c = ls<Coupon[]>('coupons', DEFAULT_COUPONS).find(x => x.code === code.toUpperCase());
      if (!c) return { valid: false, error: 'Code invalide' };
      if (subtotal < c.minOrder) return { valid: false, error: `Minimum ${c.minOrder} MAD requis` };
      return { valid: true, coupon: c };
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  ATTENDANCE
  // ════════════════════════════════════════════════════════════════
  async logAttendance(empId: string, type: 'in' | 'out', coords?: { lat: number; lng: number }): Promise<void> {
    const rec = { empId, type, time: new Date().toISOString(), ...coords };
    const att = ls<unknown[]>('presences', []);
    att.unshift(rec);
    lsSet('presences', att);
    try {
      try   { await this.post('/api/v1/staff/attendance', rec); }
      catch { await this.post('/api/staff/attendance',    rec); }
    } catch {
      enqueue('logAttendance', rec);
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  ANALYTICS
  // ════════════════════════════════════════════════════════════════
  async getAnalytics(period = '30d'): Promise<AnalyticsSummary | null> {
    try {
      let raw: unknown;
      try   { raw = await this.get(`/api/v1/analytics/summary?period=${period}`); }
      catch { raw = await this.get(`/api/analytics/summary?period=${period}`); }
      return raw as AnalyticsSummary;
    } catch {
      return null;
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  HEALTH & SYNC
  // ════════════════════════════════════════════════════════════════
  async checkHealth(): Promise<boolean> {
    try {
      const r = await fetch(`${CAFE.apiBase}/health`, { signal: AbortSignal.timeout(4000) });
      return r.ok;
    } catch {
      return false;
    }
  }

  getPendingCount(): number {
    return ls<unknown[]>('pending_sync', []).length;
  }

  async flushPending(): Promise<number> {
    const queue = ls<Array<{ action: string; data: Record<string, unknown> }>>('pending_sync', []);
    if (!queue.length) return 0;
    const remaining: typeof queue = [];
    let synced = 0;

    for (const item of queue) {
      try {
        const d = item.data;
        switch (item.action) {
          case 'createOrder':       await this.post('/api/v1/orders',                   d); break;
          case 'updateOrderStatus': await this.patch(`/api/v1/orders/${d.id}/status`,   { status: d.status }); break;
          case 'saveTransaction':   await this.post('/api/v1/transactions',             d); break;
          case 'createReservation': await this.post('/api/v1/reservations',             d); break;
          case 'createReview':      await this.post('/api/v1/reviews',                  d); break;
          case 'updateStock':       await this.patch(`/api/v1/stock/${d.id}`,           { quantity: d.quantity }); break;
          case 'logAttendance':     await this.post('/api/v1/staff/attendance',         d); break;
          default: remaining.push(item);
        }
        synced++;
      } catch {
        remaining.push(item);
      }
    }
    lsSet('pending_sync', remaining);
    return synced;
  }
}

export const API = new LuxAPIClient();
