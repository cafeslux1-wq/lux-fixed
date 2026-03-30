// ─── CAFÉ LUX — Shared Types & API Contracts ─────────────────────────
// All shapes match backend schema.prisma exactly.
// API v1 responses are normalized here — adapters in api.ts handle legacy shapes.

// ── Menu ──────────────────────────────────────────────────────────────
export interface MenuCategory {
  id:        number;
  name:      string;
  icon:      string;
  sortOrder: number;
  products:  MenuItem[];
}

export interface MenuItem {
  id:          number;
  name:        string;
  description: string;
  price:       number;
  imageUrl:    string;   // '' when missing — use getMenuImageSrc()
  isSignature: boolean;
  categoryId:  number;
  active:      boolean;
}

// ── Cart ──────────────────────────────────────────────────────────────
export interface CartItem {
  item: MenuItem;
  qty:  number;
}

// ── Orders ────────────────────────────────────────────────────────────
export type OrderType   = 'table' | 'takeaway' | 'delivery';
export type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'delivered' | 'done' | 'cancelled';
export type OrderSource = 'pos' | 'web' | 'glovo' | 'jumia';

export interface OrderLineItem {
  name:  string;
  price: number;
  qty:   number;
}

// Canonical order shape — matches server response
export interface Order {
  id:          number;
  customer:    string;
  phone:       string;
  type:        OrderType;
  status:      OrderStatus;
  source:      OrderSource;
  items:       OrderLineItem[];
  subtotal:    number;
  deliveryFee: number;
  discount:    number;
  total:       number;
  payMethod:   string;
  payRef?:     string;
  address?:    string;
  notes?:      string;
  tableNum?:   number | null;
  date:        string;  // 'DD/MM/YYYY' local
  time:        string;  // 'HH:MM'
  _local?:     boolean; // optimistic pre-sync
}

// Payload sent to POST /api/v1/orders
export interface CreateOrderPayload {
  customer:    string;
  phone:       string;
  type:        OrderType;
  address:     string;
  notes:       string;
  items:       OrderLineItem[];
  subtotal:    number;
  deliveryFee: number;
  discount:    number;
  total:       number;
  payMethod:   string;
  tableNum?:   number | null;
  couponCode?: string;
}

// ── Auth ──────────────────────────────────────────────────────────────
export type StaffRole = 'admin' | 'barista' | 'service' | 'kitchen' | 'caissiere';

export interface StaffUser {
  id:    string;
  name:  string;
  role:  StaffRole;
  token?: string;
}

// Normalized response from both /api/auth/login and /api/v1/auth/staff/pin
export interface AuthResponse {
  token: string;
  user:  StaffUser;
}

// Payload for PIN auth
export interface PinAuthPayload {
  staffId: string;
  pin:     string;
}

// ── Customers ─────────────────────────────────────────────────────────
export type LoyaltyLevel = 'bronze' | 'silver' | 'gold' | 'diamond';

export interface Customer {
  phone:         string;
  name:          string;
  email?:        string;
  loyaltyPoints: number;
  level:         LoyaltyLevel;
  orders:        Order[];
  badges?:       string[];
  lastSeen?:     string;
}

// ── Coupons ───────────────────────────────────────────────────────────
export interface Coupon {
  code:      string;
  type:      'pct' | 'fixed' | 'delivery';
  value:     number;
  label:     string;
  minOrder:  number;
  maxUses:   number;
  usedCount?: number;
}

export interface CouponValidationResult {
  valid:   boolean;
  coupon?: Coupon;
  error?:  string;
}

// ── Gift Cards ────────────────────────────────────────────────────────
export interface GiftCard {
  id:        number;
  code:      string;
  sender:    string;
  recipient: string;
  amount:    number;
  balance:   number;
  phone:     string;
  message?:  string;
  status:    'active' | 'used' | 'expired';
  expires:   string;
  created:   string;
}

// ── Reservations ──────────────────────────────────────────────────────
export interface Reservation {
  id:      number;
  name:    string;
  phone:   string;
  date:    string;
  time:    string;
  guests:  number;
  notes?:  string;
  status:  'confirmed' | 'cancelled' | 'completed';
  _local?: boolean;
}

// ── Stock ─────────────────────────────────────────────────────────────
export interface StockItem {
  id:          number;
  name:        string;
  unit:        string;
  quantity:    number;
  minQuantity: number;
  supplier?:   string;
}

export interface StockResponse {
  items:  StockItem[];
  alerts: StockItem[];
}

// ── Reviews ───────────────────────────────────────────────────────────
export interface Review {
  id:        number;
  name:      string;
  phone?:    string;
  stars:     number;
  text:      string;
  verified:  boolean;
  createdAt: string;
}

// ── Employees ─────────────────────────────────────────────────────────
export interface Employee {
  id:     string;
  name:   string;
  role:   StaffRole;
  salary: number;
  phone:  string;
  active: boolean;
}

// ── Analytics ─────────────────────────────────────────────────────────
export interface AnalyticsSummary {
  period:        string;
  totalOrders:   number;
  totalCA:       number;
  avgTicket:     number;
  customerCount: number;
  topProducts:   Array<{ name: string; _sum: { qty: number } }>;
}

// ── POS Transaction ───────────────────────────────────────────────────
export interface POSTransaction {
  id:       number;
  date:     string;
  time:     string;
  type:     'table' | 'takeaway';
  table?:   string;
  items:    Array<{ n: string; p: number; q: number }>;
  subtotal: string;
  total:    string;
  tva:      string;
  mode:     string;
  notes?:   string;
  staff?:   string;
  source:   'pos';
}

// ── App State ─────────────────────────────────────────────────────────
export type AuthScope = 'public' | 'staff' | 'admin';
export interface AuthState {
  user:  StaffUser | null;
  token: string | null;
  scope: AuthScope;
}

export type ToastType = 'success' | 'error' | 'info' | 'warning';
export interface Toast {
  id:   string;
  msg:  string;
  type: ToastType;
}

export type Action =
  | { type: 'SET_AUTH';         payload: AuthState }
  | { type: 'LOGOUT' }
  | { type: 'CART_ADD';         payload: MenuItem }
  | { type: 'CART_REMOVE';      payload: number }
  | { type: 'CART_SET_QTY';     payload: { id: number; qty: number } }
  | { type: 'CART_CLEAR' }
  | { type: 'CART_SET_TYPE';    payload: OrderType }
  | { type: 'CART_SET_TABLE';   payload: number | null }
  | { type: 'COUPON_APPLY';     payload: Coupon }
  | { type: 'COUPON_CLEAR' }
  | { type: 'SET_ONLINE';       payload: boolean }
  | { type: 'SET_SYNC_PENDING'; payload: number }
  | { type: 'SET_API_STATUS';   payload: 'unknown' | 'online' | 'offline' }
  | { type: 'TOAST_ADD';        payload: { msg: string; type: ToastType } }
  | { type: 'TOAST_REMOVE';     payload: string }
  | { type: 'SET_MENU';         payload: { cats: MenuCategory[]; ts: number } };

export interface AppState {
  auth:             AuthState;
  cart:             CartItem[];
  orderType:        OrderType;
  tableNum:         number | null;
  activeCoupon:     Coupon | null;
  isOnline:         boolean;
  syncPending:      number;
  apiStatus:        'unknown' | 'online' | 'offline';
  toastQueue:       Toast[];
  menuCategories:   MenuCategory[];
  menuLastFetched:  number;
}
