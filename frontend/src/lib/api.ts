// ─── CAFÉ LUX — API Client ────────────────────────────────────────────
import type {
  Order, OrderStatus, MenuCategory, Customer,
  Reservation, Review, GiftCard, StockItem, StaffUser, Coupon,
} from './types';
import { CAFE, STATIC_MENU, DEFAULT_COUPONS } from './constants';

const MENU_TTL = 5 * 60 * 1000; // 5 min

// ── localStorage helpers ───────────────────────────────────────────────
function ls<T>(key: string, def: T): T {
  try { return JSON.parse(localStorage.getItem(`lux_${key}`) ?? 'null') ?? def; }
  catch { return def; }
}
function lsSet(key: string, val: unknown) {
  localStorage.setItem(`lux_${key}`, JSON.stringify(val));
}

// ── Pending sync queue ────────────────────────────────────────────────
function enqueue(action: string, data: unknown) {
  const q = ls<Array<{ action: string; data: unknown; ts: number }>>('pending_sync', []);
  q.push({ action, data, ts: Date.now() });
  lsSet('pending_sync', q);
}

// ─────────────────────────────────────────────────────────────────────
export class LuxAPIClient {
  private token: string | null = localStorage.getItem('lux_auth_token');
  private memCache = new Map<string, { data: unknown; ts: number }>();

  // ── HTTP ──────────────────────────────────────────────────────────
  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const res = await fetch(`${CAFE.apiBase}${path}`, {
      method, headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(8000),
    });

    if (res.status === 401) {
      this.setToken(null);
      throw new Error('AUTH_EXPIRED');
    }
    if (!res.ok) throw new Error(`API_${res.status}`);
    return res.json() as Promise<T>;
  }

  private get  = <T>(p: string)              => this.req<T>('GET', p);
  private post = <T>(p: string, d: unknown)  => this.req<T>('POST', p, d);
  private patch= <T>(p: string, d: unknown)  => this.req<T>('PATCH', p, d);

  setToken(t: string | null) {
    this.token = t;
    t ? localStorage.setItem('lux_auth_token', t) : localStorage.removeItem('lux_auth_token');
  }

  // ── AUTH ─────────────────────────────────────────────────────────
  async loginAdmin(username: string, password: string) {
    const data = await this.post<{ token: string; user: StaffUser }>('/api/auth/login', { username, password });
    this.setToken(data.token);
    return data;
  }

  async authenticateStaffPin(staffId: string, pin: string): Promise<StaffUser & { token: string }> {
    try {
      const data = await this.post<StaffUser & { token: string }>('/api/v1/auth/staff/pin', { staffId, pin });
      this.setToken(data.token);
      return data;
    } catch {
      // Local fallback
      const pins   = ls<Record<string, string>>('staff_pins', {});
      const emps   = ls<StaffUser[]>('employees', []);
      const emp    = emps.find(e => e.id === staffId);
      if (!emp) throw new Error('STAFF_NOT_FOUND');
      const correct = pins[staffId] ?? '1234';
      if (pin !== correct) throw new Error('INVALID_PIN');
      const tok = `local_${staffId}_${Date.now()}`;
      this.setToken(tok);
      return { ...emp, token: tok };
    }
  }

  // ── MENU ─────────────────────────────────────────────────────────
  async getPublicMenu(force = false): Promise<MenuCategory[]> {
    const key = 'menu_public';
    const mem = this.memCache.get(key);
    if (!force && mem && Date.now() - mem.ts < MENU_TTL)
      return mem.data as MenuCategory[];

    try {
      let data: MenuCategory[];
      try   { data = await this.get<MenuCategory[]>('/api/v1/menu/public'); }
      catch { data = await this.get<MenuCategory[]>('/api/menu'); }

      this.memCache.set(key, { data, ts: Date.now() });
      lsSet('menu_cache', data);
      lsSet('menu_cache_ts', Date.now());
      return data;
    } catch {
      const cached = ls<MenuCategory[]>('menu_cache', []);
      return cached.length ? cached : STATIC_MENU;
    }
  }

  // ── ORDERS ───────────────────────────────────────────────────────
  async createOrder(order: Omit<Order, 'id' | 'date' | 'time' | 'status' | 'source'>): Promise<Order> {
    const now  = new Date();
    const local: Order = {
      ...order,
      id: Date.now(), source: 'web', status: 'pending',
      date: now.toLocaleDateString('fr-MA'),
      time: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      _local: true,
    };
    const orders = ls<Order[]>('web_orders', []);
    orders.unshift(local);
    lsSet('web_orders', orders);

    try {
      const saved = await this.post<Order>('/api/orders', order);
      const updated = ls<Order[]>('web_orders', []).map(o => o._local && o.id === local.id ? saved : o);
      lsSet('web_orders', updated);
      return saved;
    } catch {
      enqueue('createOrder', order);
      return local;
    }
  }

  async getOrders(params: Record<string, string> = {}): Promise<Order[]> {
    try {
      const qs   = new URLSearchParams(params).toString();
      const data = await this.get<Order[]>(`/api/orders${qs ? `?${qs}` : ''}`);
      // Merge with local
      const local   = ls<Order[]>('web_orders', []);
      const merged  = [...data];
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
      await this.patch(`/api/orders/${id}/status`, { status });
    } catch {
      enqueue('updateOrderStatus', { id, status });
    }
  }

  // ── POS TRANSACTIONS ─────────────────────────────────────────────
  async saveTransaction(tx: unknown): Promise<void> {
    const txs = ls<unknown[]>('transactions', []);
    txs.unshift(tx);
    lsSet('transactions', txs.slice(0, 500));
    try {
      await this.post('/api/transactions', tx);
    } catch {
      enqueue('saveTransaction', tx);
    }
  }

  async getTransactions(params: Record<string, string> = {}): Promise<unknown[]> {
    try {
      const qs = new URLSearchParams(params).toString();
      return await this.get<unknown[]>(`/api/transactions${qs ? `?${qs}` : ''}`);
    } catch {
      return ls<unknown[]>('transactions', []);
    }
  }

  // ── STOCK ────────────────────────────────────────────────────────
  async getStock(): Promise<{ items: StockItem[]; alerts: StockItem[] }> {
    try {
      return await this.get<{ items: StockItem[]; alerts: StockItem[] }>('/api/stock');
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
      await this.patch(`/api/stock/${id}`, { quantity });
    } catch {
      enqueue('updateStock', { id, quantity });
    }
  }

  // ── CUSTOMERS ────────────────────────────────────────────────────
  async getCustomer(phone: string): Promise<Customer | null> {
    try {
      const data = await this.get<Customer>(`/api/customers/${encodeURIComponent(phone)}`);
      const all  = ls<Record<string, Customer>>('web_customers', {});
      all[phone] = data;
      lsSet('web_customers', all);
      return data;
    } catch {
      return ls<Record<string, Customer>>('web_customers', {})[phone] ?? null;
    }
  }

  // ── RESERVATIONS ─────────────────────────────────────────────────
  async getReservations(date?: string): Promise<Reservation[]> {
    try {
      const qs = date ? `?date=${date}` : '';
      return await this.get<Reservation[]>(`/api/reservations${qs}`);
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
      const saved = await this.post<Reservation>('/api/reservations', res);
      const updated = ls<Reservation[]>('reservations', []).map(r => r._local && r.id === local.id ? saved : r);
      lsSet('reservations', updated);
      return saved;
    } catch {
      enqueue('createReservation', res);
      return local;
    }
  }

  // ── REVIEWS ──────────────────────────────────────────────────────
  async getReviews(): Promise<Review[]> {
    try {
      const data = await this.get<Review[]>('/api/reviews');
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
      return await this.post<Review>('/api/reviews', review);
    } catch {
      enqueue('createReview', review);
      return local;
    }
  }

  // ── GIFT CARDS ───────────────────────────────────────────────────
  async createGiftCard(gc: Omit<GiftCard, 'id' | 'code' | 'balance' | 'status' | 'created'>): Promise<GiftCard> {
    try {
      const saved = await this.post<GiftCard>('/api/gift-cards', gc);
      const all = ls<GiftCard[]>('gift_cards', []);
      all.unshift(saved);
      lsSet('gift_cards', all);
      return saved;
    } catch {
      const code = `LUX-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
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
      return await this.get<GiftCard>(`/api/gift-cards/${code.toUpperCase()}`);
    } catch {
      return ls<GiftCard[]>('gift_cards', []).find(g => g.code === code.toUpperCase()) ?? null;
    }
  }

  // ── COUPONS ──────────────────────────────────────────────────────
  async validateCoupon(code: string, subtotal: number): Promise<{ valid: boolean; coupon?: Coupon; error?: string }> {
    try {
      return await this.post<{ valid: boolean; coupon?: Coupon; error?: string }>('/api/coupons/validate', { code, subtotal });
    } catch {
      const c = ls<Coupon[]>('coupons', DEFAULT_COUPONS).find(x => x.code === code.toUpperCase());
      if (!c) return { valid: false, error: 'Code invalide' };
      if (subtotal < c.minOrder) return { valid: false, error: `Minimum ${c.minOrder} MAD requis` };
      return { valid: true, coupon: c };
    }
  }

  // ── ATTENDANCE ───────────────────────────────────────────────────
  async logAttendance(empId: string, type: 'in' | 'out', coords?: { lat: number; lng: number }): Promise<void> {
    const rec = { empId, type, time: new Date().toISOString(), ...coords };
    const att = ls<unknown[]>('presences', []);
    att.unshift(rec);
    lsSet('presences', att);
    try {
      await this.post('/api/staff/attendance', rec);
    } catch {
      enqueue('logAttendance', rec);
    }
  }

  // ── ANALYTICS ────────────────────────────────────────────────────
  async getAnalytics(period = '30d'): Promise<unknown> {
    try {
      return await this.get(`/api/analytics/summary?period=${period}`);
    } catch {
      return null;
    }
  }

  // ── HEALTH & SYNC ────────────────────────────────────────────────
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
    const queue = ls<Array<{ action: string; data: unknown }>>('pending_sync', []);
    if (!queue.length) return 0;
    const remaining: typeof queue = [];
    let synced = 0;

    for (const item of queue) {
      try {
        const d = item.data as Record<string, unknown>;
        switch (item.action) {
          case 'createOrder':       await this.post('/api/orders', d); break;
          case 'updateOrderStatus': await this.patch(`/api/orders/${d.id}/status`, { status: d.status }); break;
          case 'saveTransaction':   await this.post('/api/transactions', d); break;
          case 'createReservation': await this.post('/api/reservations', d); break;
          case 'createReview':      await this.post('/api/reviews', d); break;
          case 'updateStock':       await this.patch(`/api/stock/${d.id}`, { quantity: d.quantity }); break;
          case 'logAttendance':     await this.post('/api/staff/attendance', d); break;
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
