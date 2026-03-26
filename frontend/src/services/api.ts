// On Railway: same domain → use relative /api/v1
// On Vercel+separate backend: set VITE_API_URL=https://api.cafeslux.com/api/v1
const BASE = import.meta.env.VITE_API_URL || '/api/v1';

export const auth = {
  getToken:   () => localStorage.getItem('lux_token'),
  setToken:   (t: string) => localStorage.setItem('lux_token', t),
  setRefresh: (t: string) => localStorage.setItem('lux_refresh', t),
  getRefresh: () => localStorage.getItem('lux_refresh'),
  clearAll:   () => { ['lux_token','lux_refresh','lux_staff'].forEach(k => localStorage.removeItem(k)); },
  setStaff:   (s: unknown) => localStorage.setItem('lux_staff', JSON.stringify(s)),
  getStaff:   () => { try { return JSON.parse(localStorage.getItem('lux_staff') || 'null'); } catch { return null; } },
};

type FetchOpts = RequestInit & { idempotent?: boolean; _retry?: boolean };

async function apiFetch<T = unknown>(endpoint: string, opts: FetchOpts = {}): Promise<T> {
  const token = auth.getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  if (opts.idempotent) headers['X-Idempotency-Key'] = `lux-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  if (opts.body && typeof opts.body === 'object') opts.body = JSON.stringify(opts.body);
  const res  = await fetch(`${BASE}${endpoint}`, { ...opts, headers });
  const data = await res.json();
  if (res.status === 401 && !opts._retry) {
    const refreshed = await refreshTokens();
    if (refreshed) return apiFetch(endpoint, { ...opts, _retry: true });
    auth.clearAll(); window.location.href = '/login'; throw new Error('Session expired');
  }
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`) as Error & { errorCode?: string; shortages?: unknown[]; available?: number; required?: number };
    err.errorCode = data.errorCode; err.shortages = data.shortages;
    if (data.available !== undefined) err.available = data.available;
    if (data.required  !== undefined) err.required  = data.required;
    throw err;
  }
  return data as T;
}

async function refreshTokens(): Promise<boolean> {
  const refresh = auth.getRefresh(); if (!refresh) return false;
  try {
    const data = await apiFetch<{ data: { accessToken: string; refreshToken: string } }>('/auth/staff/refresh', { method:'POST', body: JSON.stringify({ refreshToken: refresh }) as unknown as BodyInit });
    auth.setToken(data.data.accessToken); auth.setRefresh(data.data.refreshToken); return true;
  } catch { return false; }
}

export interface StaffProfile { id: string; fullName: string; role: string; branchId: string; branchName: string; tenantId: string; permissions: string[] }
export interface MenuProduct { id: string; name: string; description?: string; price: number; imageUrl?: string; isSignature: boolean; isAvailable: boolean; stockAvailable: boolean; prepTimeMins: number; tags: string[]; modifiers: ModifierGroup[]; category: string }
export interface ModifierGroup { id: string; name: string; required: boolean; options: Array<{ label: string; priceAdjust: number }> }
export interface MenuCategory { id: string; name: string; icon?: string; products: MenuProduct[] }

export const API = {
  auth: {
    loginPin:      (staffId: string, pin: string, branchId: string) => apiFetch<{ data: { accessToken: string; staff: StaffProfile } }>('/auth/staff/pin', { method:'POST', body: { staffId, pin, branchId } as unknown as BodyInit }),
    loginPassword: (phone: string, password: string)                 => apiFetch<{ data: { accessToken: string; refreshToken: string; staff: StaffProfile } }>('/auth/staff/login', { method:'POST', body: { phone, password } as unknown as BodyInit }),
    branchStaff:   (branchId: string)                                => apiFetch<{ data: Array<{ id: string; name: string; role: string; initials: string; photoUrl: string | null }> }>(`/auth/staff/branch/${branchId}`),
    me:            () => apiFetch<{ data: StaffProfile }>('/auth/staff/me'),
    logout:        () => apiFetch('/auth/staff/logout', { method:'POST' }),
  },
  orders: {
    create:  (payload: Record<string, unknown>) => apiFetch<{ data: { orderId: string; total: number; sessionType: string } }>('/orders', { method:'POST', body: payload as unknown as BodyInit, idempotent: true }),
    list:    (params?: Record<string, string>)  => apiFetch<{ data: unknown[]; meta: { total: number } }>(`/orders?${new URLSearchParams(params)}`),
    status:  (id: string, status: string)       => apiFetch(`/orders/${id}/status`, { method:'PATCH', body: { status } as unknown as BodyInit }),
    void:    (id: string, reason?: string)      => apiFetch(`/orders/${id}/void`, { method:'POST', body: { reason } as unknown as BodyInit }),
    kds:     (branchId: string)                 => apiFetch<{ data: unknown[] }>(`/orders/kds/${branchId}`),
    summary: (branchId: string, date?: string)  => apiFetch<{ data: unknown }>(`/orders/summary?branchId=${branchId}${date ? `&date=${date}` : ''}`),
  },
  menu: {
    public:  (tenantSlug = 'lux', branchId?: string) => apiFetch<{ data: { categories: MenuCategory[]; tenant: { taxRate: number } } }>(`/menu/public/${tenantSlug}${branchId ? `?branchId=${branchId}` : ''}`),
    toggle:  (id: string)                            => apiFetch(`/menu/products/${id}/toggle`, { method:'PATCH' }),
    openQR:  (branchId: string, tableNumber: string) => apiFetch<{ data: { sessionToken: string; qrUrl: string } }>('/menu/qr/session', { method:'POST', body: { branchId, tableNumber } as unknown as BodyInit }),
    validateQR: (token: string)                      => apiFetch<{ data: { valid: boolean; tableNumber: string; branchId: string; tenantSlug: string } }>(`/menu/qr/session/${token}`),
    closeQR: (token: string)                         => apiFetch(`/menu/qr/session/${token}/close`, { method:'POST' }),
  },
  hr: {
    geofence:    ()             => apiFetch<{ data: { enabled: boolean; lat: number; lng: number; radiusM: number } }>('/hr/attendance/geofence'),
    clockIn:     (payload: Record<string, unknown>) => apiFetch('/hr/attendance/clock-in', { method:'POST', body: payload as unknown as BodyInit }),
    clockOut:    (payload?: Record<string, unknown>) => apiFetch('/hr/attendance/clock-out', { method:'POST', body: (payload || {}) as unknown as BodyInit }),
    todayAtt:    ()             => apiFetch('/hr/attendance/today'),
    tasks:       ()             => apiFetch('/hr/tasks/today'),
    submitTasks: (completions: unknown[]) => apiFetch('/hr/tasks/submit', { method:'POST', body: { completions } as unknown as BodyInit }),
    salfiya:     ()             => apiFetch('/hr/salfiya'),
    requestAdv:  (payload: Record<string, unknown>) => apiFetch('/hr/salfiya', { method:'POST', body: payload as unknown as BodyInit }),
    me:          ()             => apiFetch('/hr/me'),
  },
  billing: {
    plans:        ()             => apiFetch('/billing/plans'),
    subscription: ()             => apiFetch('/billing/subscription'),
    invoices:     ()             => apiFetch('/billing/invoices'),
    checkout:     (priceId: string) => apiFetch<{ data: { checkoutUrl: string } }>('/billing/checkout', { method:'POST', body: { priceId } as unknown as BodyInit }),
    portal:       ()             => apiFetch<{ data: { portalUrl: string } }>('/billing/portal', { method:'POST' }),
  },
  referral: {
    stats:       ()              => apiFetch('/referral/stats'),
    leaderboard: ()              => apiFetch('/referral/leaderboard'),
    payout:      (payload: Record<string, unknown>) => apiFetch('/referral/payout', { method:'POST', body: payload as unknown as BodyInit }),
  },
  admin: {
    kpis:         ()             => apiFetch('/admin/kpis'),
    overridePenalty: (payload: Record<string, unknown>) => apiFetch('/admin/penalty-override', { method:'POST', body: payload as unknown as BodyInit }),
  },
};
