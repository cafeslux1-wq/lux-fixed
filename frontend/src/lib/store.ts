// ─── CAFÉ LUX — State Store ───────────────────────────────────────────
import React, {
  createContext, useContext, useReducer,
  useEffect, useCallback, useMemo, useRef,
} from 'react';
import type { AppState, Action, MenuCategory, Coupon, MenuItem, OrderType, AuthScope } from './types';
import { API } from './api';

// ── Initial state ──────────────────────────────────────────────────────
export const initialState: AppState = {
  auth: {
    user:   JSON.parse(localStorage.getItem('lux_staff_session') ?? 'null'),
    token:  localStorage.getItem('lux_auth_token'),
    scope: (localStorage.getItem('lux_auth_scope') ?? 'public') as AuthScope,
  },
  cart: [],
  orderType: 'table',
  tableNum: null,
  activeCoupon: null,
  isOnline: navigator.onLine,
  syncPending: 0,
  apiStatus: 'unknown',
  toastQueue: [],
  menuCategories: [],
  menuLastFetched: 0,
};

// ── Reducer ───────────────────────────────────────────────────────────
export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {

    case 'SET_AUTH':
      localStorage.setItem('lux_staff_session', JSON.stringify(action.payload.user));
      localStorage.setItem('lux_auth_token',    action.payload.token ?? '');
      localStorage.setItem('lux_auth_scope',    action.payload.scope);
      return { ...state, auth: action.payload };

    case 'LOGOUT':
      localStorage.removeItem('lux_staff_session');
      localStorage.removeItem('lux_auth_token');
      localStorage.setItem('lux_auth_scope', 'public');
      return { ...state, auth: { user: null, token: null, scope: 'public' } };

    case 'CART_ADD': {
      const existing = state.cart.find(c => c.item.id === action.payload.id);
      return {
        ...state,
        cart: existing
          ? state.cart.map(c => c.item.id === action.payload.id ? { ...c, qty: c.qty + 1 } : c)
          : [...state.cart, { item: action.payload, qty: 1 }],
      };
    }

    case 'CART_REMOVE': {
      const existing = state.cart.find(c => c.item.id === action.payload);
      if (!existing) return state;
      return {
        ...state,
        cart: existing.qty > 1
          ? state.cart.map(c => c.item.id === action.payload ? { ...c, qty: c.qty - 1 } : c)
          : state.cart.filter(c => c.item.id !== action.payload),
      };
    }

    case 'CART_SET_QTY': {
      if (action.payload.qty <= 0)
        return { ...state, cart: state.cart.filter(c => c.item.id !== action.payload.id) };
      return { ...state, cart: state.cart.map(c => c.item.id === action.payload.id ? { ...c, qty: action.payload.qty } : c) };
    }

    case 'CART_CLEAR':
      return { ...state, cart: [], activeCoupon: null };

    case 'CART_SET_TYPE':
      return { ...state, orderType: action.payload };

    case 'CART_SET_TABLE':
      return { ...state, tableNum: action.payload };

    case 'COUPON_APPLY':
      return { ...state, activeCoupon: action.payload };

    case 'COUPON_CLEAR':
      return { ...state, activeCoupon: null };

    case 'SET_ONLINE':
      return { ...state, isOnline: action.payload };

    case 'SET_SYNC_PENDING':
      return { ...state, syncPending: action.payload };

    case 'SET_API_STATUS':
      return { ...state, apiStatus: action.payload };

    case 'TOAST_ADD': {
      const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      return { ...state, toastQueue: [...state.toastQueue.slice(-4), { ...action.payload, id }] };
    }

    case 'TOAST_REMOVE':
      return { ...state, toastQueue: state.toastQueue.filter(t => t.id !== action.payload) };

    case 'SET_MENU':
      return { ...state, menuCategories: action.payload.cats, menuLastFetched: action.payload.ts };

    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────
export interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  api: typeof API;
  toast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  // Cart computed
  cartTotal:      number;
  cartQty:        number;
  cartDiscount:   number;
  cartDeliveryFee: number;
  cartGrandTotal: number;
  // Helpers
  isAuthed: (scope: 'staff' | 'admin') => boolean;
  addToCart: (item: MenuItem) => void;
  removeFromCart: (id: number) => void;
}

export const AppContext = createContext<AppContextValue>(null!);
export const useApp = () => useContext(AppContext);

// ── Provider ──────────────────────────────────────────────────────────
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const syncRef = useRef<ReturnType<typeof setInterval>>();

  const toast = useCallback((msg: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    dispatch({ type: 'TOAST_ADD', payload: { msg, type } });
  }, []);

  // ── Cart memos ──────────────────────────────────────────────────
  const cartTotal = useMemo(
    () => state.cart.reduce((s, c) => s + c.item.price * c.qty, 0),
    [state.cart],
  );
  const cartQty = useMemo(
    () => state.cart.reduce((s, c) => s + c.qty, 0),
    [state.cart],
  );
  const cartDeliveryFee = useMemo(
    () => (state.orderType === 'delivery' && cartTotal < 200 ? 15 : 0),
    [state.orderType, cartTotal],
  );
  const cartDiscount = useMemo(() => {
    if (!state.activeCoupon) return 0;
    const { type, value } = state.activeCoupon;
    if (type === 'pct')      return Math.round(cartTotal * value) / 100;
    if (type === 'fixed')    return Math.min(value, cartTotal);
    if (type === 'delivery') return cartDeliveryFee;
    return 0;
  }, [state.activeCoupon, cartTotal, cartDeliveryFee]);
  const cartGrandTotal = useMemo(
    () => cartTotal + cartDeliveryFee - cartDiscount,
    [cartTotal, cartDeliveryFee, cartDiscount],
  );

  const isAuthed = useCallback((scope: 'staff' | 'admin') => {
    const map: Record<string, number> = { public: 0, staff: 1, admin: 2 };
    return (map[state.auth.scope] ?? 0) >= (map[scope] ?? 1);
  }, [state.auth.scope]);

  const addToCart    = useCallback((item: MenuItem) => dispatch({ type: 'CART_ADD', payload: item }), []);
  const removeFromCart = useCallback((id: number)   => dispatch({ type: 'CART_REMOVE', payload: id }), []);

  // ── Online/offline ──────────────────────────────────────────────
  useEffect(() => {
    const goOnline = async () => {
      dispatch({ type: 'SET_ONLINE',     payload: true    });
      dispatch({ type: 'SET_API_STATUS', payload: 'online' });
      const synced = await API.flushPending();
      if (synced > 0) toast(`✓ ${synced} opération(s) synchronisée(s)`, 'success');
      dispatch({ type: 'SET_SYNC_PENDING', payload: API.getPendingCount() });
    };
    const goOffline = () => {
      dispatch({ type: 'SET_ONLINE',     payload: false    });
      dispatch({ type: 'SET_API_STATUS', payload: 'offline' });
    };
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // ── Health + periodic sync ───────────────────────────────────────
  useEffect(() => {
    const tick = async () => {
      const ok = await API.checkHealth();
      dispatch({ type: 'SET_API_STATUS', payload: ok ? 'online' : 'offline' });
      if (ok) {
        const synced = await API.flushPending();
        dispatch({ type: 'SET_SYNC_PENDING', payload: API.getPendingCount() });
        if (synced > 0) toast(`⟳ ${synced} synchronisé(s)`, 'success');
      }
    };
    tick();
    syncRef.current = setInterval(tick, 30_000);
    return () => clearInterval(syncRef.current);
  }, []);

  // ── URL ?table= detection ────────────────────────────────────────
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const t = parseInt(p.get('table') ?? '', 10);
    if (!isNaN(t) && t >= 1 && t <= 30) {
      dispatch({ type: 'CART_SET_TABLE', payload: t });
      dispatch({ type: 'CART_SET_TYPE',  payload: 'table' });
    }
  }, []);

  // ── SW message: sync requested ───────────────────────────────────
  useEffect(() => {
    const handler = async (e: MessageEvent) => {
      if (e.data?.type === 'LUX_SYNC_REQUESTED') {
        const synced = await API.flushPending();
        dispatch({ type: 'SET_SYNC_PENDING', payload: API.getPendingCount() });
        if (synced > 0) toast(`⟳ ${synced} synchronisé(s)`, 'success');
      }
    };
    navigator.serviceWorker?.addEventListener('message', handler);
    return () => navigator.serviceWorker?.removeEventListener('message', handler);
  }, []);

  const ctx: AppContextValue = {
    state, dispatch, api: API,
    toast, cartTotal, cartQty, cartDiscount, cartDeliveryFee, cartGrandTotal,
    isAuthed, addToCart, removeFromCart,
  };

  return <AppContext.Provider value={ctx}>{children}</AppContext.Provider>;
}
