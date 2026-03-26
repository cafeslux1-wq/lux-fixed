import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MenuProduct, StaffProfile } from '../services/api';

export interface CartItem { productId?: string; productName: string; unitPrice: number; quantity: number; modifiers?: Record<string, string>; notes?: string }
export type TableStatus = 'free' | 'occupied';
export interface TableState { number: string; status: TableStatus; cartItems: CartItem[] }

interface AppStore {
  staff: StaffProfile | null; isLoggedIn: boolean;
  setStaff: (s: StaffProfile | null) => void;
  selectedTable: string | null; tables: Record<string, TableState>; takeawaySeq: number;
  selectTable: (n: string) => void;
  addTakeaway: () => string;
  addToCart: (product: MenuProduct, modifiers?: Record<string, string>, notes?: string) => void;
  removeFromCart: (productName: string) => void;
  clearCart: () => void;
  getCart: () => CartItem[];
  cartSubtotal: () => number;
  kdsOrders: unknown[]; addKDSOrder: (o: unknown) => void; updateOrderStatus: (id: string, status: string) => void;
  stockAlerts: Array<{ name: string; level: string }>; addStockAlert: (a: { name: string; level: string }) => void; clearAlerts: () => void;
  dashboardData: unknown; updateDashboard: (d: unknown) => void;
}

export const useAppStore = create<AppStore>()(persist(
  (set, get) => ({
    staff: null, isLoggedIn: false,
    setStaff: (staff) => set({ staff, isLoggedIn: !!staff }),
    selectedTable: null, takeawaySeq: 1,
    tables: Object.fromEntries([...Array(12)].map((_,i) => [String(i+1), { number: String(i+1), status: 'free' as TableStatus, cartItems: [] }])),
    selectTable: (n) => set({ selectedTable: n }),
    addTakeaway: () => { const seq = get().takeawaySeq; const id = `E${seq}`; set(s => ({ takeawaySeq: seq+1, selectedTable: id, tables: { ...s.tables, [id]: { number: id, status: 'occupied', cartItems: [] } } })); return id; },
    addToCart: (product, modifiers, notes) => {
      const table = get().selectedTable; if (!table) return;
      set(s => {
        const current = s.tables[table]?.cartItems || [];
        const idx = current.findIndex(c => c.productName === product.name && JSON.stringify(c.modifiers) === JSON.stringify(modifiers));
        const updated = idx >= 0 ? current.map((c,i) => i===idx ? { ...c, quantity: c.quantity+1 } : c) : [...current, { productId: product.id, productName: product.name, unitPrice: product.price, quantity: 1, modifiers, notes }];
        return { tables: { ...s.tables, [table]: { ...s.tables[table], status: 'occupied', cartItems: updated } } };
      });
    },
    removeFromCart: (productName) => {
      const table = get().selectedTable; if (!table) return;
      set(s => { const current = s.tables[table]?.cartItems || []; let idx = -1; for (let i = current.length - 1; i >= 0; i--) { if (current[i].productName === productName) { idx = i; break; } } if (idx < 0) return s; const updated = current[idx].quantity > 1 ? current.map((c,i) => i===idx ? { ...c, quantity: c.quantity-1 } : c) : current.filter((_,i) => i!==idx); return { tables: { ...s.tables, [table]: { ...s.tables[table], cartItems: updated } } }; });
    },
    clearCart: () => { const table = get().selectedTable; if (!table) return; set(s => ({ tables: { ...s.tables, [table]: { ...s.tables[table], cartItems: [], status: 'free' } } })); },
    getCart: () => { const table = get().selectedTable; return table ? get().tables[table]?.cartItems || [] : []; },
    cartSubtotal: () => get().getCart().reduce((s,c) => s + c.unitPrice * c.quantity, 0),
    kdsOrders: [] as unknown[], addKDSOrder: (o: unknown) => set(s => ({ kdsOrders: [o, ...s.kdsOrders].slice(0,50) })), updateOrderStatus: (id: string, status: string) => set(s => ({ kdsOrders: s.kdsOrders.map((o: Record<string,unknown>) => (o as Record<string,unknown>)['id']===id ? { ...o, status } : o) })),
    stockAlerts: [] as Array<{name: string; level: string}>, addStockAlert: (a: {name: string; level: string}) => set(s => ({ stockAlerts: [a, ...s.stockAlerts].slice(0,20) })), clearAlerts: () => set({ stockAlerts: [] }),
    dashboardData: null as unknown, updateDashboard: (d: unknown) => set({ dashboardData: d }),
  }),
  { name: 'lux-pos-state', partialize: (s) => ({ staff: s.staff, isLoggedIn: s.isLoggedIn, tables: s.tables, takeawaySeq: s.takeawaySeq }) }
));
