/**
 * ══════════════════════════════════════════════════════════
 *  LUX SUPREME — KDS Dashboard (Kitchen Display System)
 *
 *  Landscape-optimized Kanban: Accepted | Preparing | Ready
 *  SLA Timers:  yellow at 5 min  ·  red at 10 min  ·  critical flash > 15 min
 *  Socket:      tenant:{id}:branch:{id}:kds room
 *  Actions:     Staff taps card to advance status
 * ══════════════════════════════════════════════════════════
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';

const API         = import.meta.env.VITE_API_URL || '';
const SOCKET_URL  = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api/v1', '')
  : window.location.origin;
const BRANCH_ID   = import.meta.env.VITE_BRANCH_ID   || 'b0000000-0000-0000-0000-000000000001';
const AUTH_TOKEN  = () => localStorage.getItem('lux_token') || '';
const AUTH_HDR    = () => ({ Authorization: `Bearer ${AUTH_TOKEN()}` });

// ── Types ─────────────────────────────────────────────────────────────────
interface KDSItem  { name: string; qty: number; modifiers?: Record<string, string>; notes?: string }
interface KDSOrder {
  id:             string;
  tableNumber:    string | null;
  source:         string;
  sessionType:    string;
  status:         'accepted' | 'preparing' | 'ready';
  notes:          string | null;
  customerNotes:  string | null;
  items:          KDSItem[];
  createdAt:      string;
  acceptedAt:     string | null;
  preparingAt:    string | null;
  totalAgeMin:    number;
  stageAgeMin:    number;
  priority:       'normal' | 'urgent' | 'critical';
}

// ── SLA helpers ───────────────────────────────────────────────────────────
function getAgeMinutes(isoTime: string): number {
  return (Date.now() - new Date(isoTime).getTime()) / 60000;
}

type SLALevel = 'ok' | 'warning' | 'danger' | 'critical';
function getSLA(ageMin: number): SLALevel {
  if (ageMin >= 15) return 'critical';
  if (ageMin >= 10) return 'danger';
  if (ageMin >= 5)  return 'warning';
  return 'ok';
}

const SLA_STYLES: Record<SLALevel, { card: string; timer: string; glow: string }> = {
  ok:       { card: 'border-white/[0.08] bg-[#141414]',   timer: 'text-white/40',   glow: '' },
  warning:  { card: 'border-yellow-500/40 bg-yellow-500/5', timer: 'text-yellow-400', glow: 'shadow-[0_0_20px_rgba(234,179,8,0.15)]' },
  danger:   { card: 'border-red-500/50 bg-red-500/8',      timer: 'text-red-400',    glow: 'shadow-[0_0_30px_rgba(239,68,68,0.2)]' },
  critical: { card: 'border-red-500/70 bg-red-500/10 animate-pulse', timer: 'text-red-400 font-bold animate-pulse', glow: 'shadow-[0_0_40px_rgba(239,68,68,0.3)]' },
};

const STATUS_NEXT: Record<KDSOrder['status'], string> = {
  accepted:  'preparing',
  preparing: 'ready',
  ready:     'delivered',
};

const COLUMNS: Array<{ key: KDSOrder['status']; label: string; icon: string; accent: string }> = [
  { key: 'accepted',  label: 'Nouvelles',   icon: '🔔', accent: 'text-blue-400' },
  { key: 'preparing', label: 'En Cuisine',  icon: '🍳', accent: 'text-orange-400' },
  { key: 'ready',     label: 'Prêtes',      icon: '✅', accent: 'text-green-400' },
];

// ── Live timer display ────────────────────────────────────────────────────
function LiveTimer({ startIso }: { startIso: string }) {
  const [mins, setMins] = useState(getAgeMinutes(startIso));
  useEffect(() => {
    const t = setInterval(() => setMins(getAgeMinutes(startIso)), 10_000);
    return () => clearInterval(t);
  }, [startIso]);
  const sla = getSLA(mins);
  const fmt = mins >= 60 ? `${Math.floor(mins/60)}h${String(Math.round(mins%60)).padStart(2,'0')}m` : `${Math.round(mins)} min`;
  return <span className={`text-sm font-mono font-bold tabular-nums ${SLA_STYLES[sla].timer}`}>{fmt}</span>;
}

// ── Order card ────────────────────────────────────────────────────────────
function OrderCard({ order, onAdvance, advancing }: {
  order:    KDSOrder;
  onAdvance: (id: string, nextStatus: string) => void;
  advancing: boolean;
}) {
  const ageMin = getAgeMinutes(order.createdAt);
  const sla    = getSLA(ageMin);
  const styles = SLA_STYLES[sla];
  const next   = STATUS_NEXT[order.status];

  return (
    <div
      className={`rounded-2xl border p-4 flex flex-col gap-3 transition-all duration-300 cursor-pointer active:scale-[0.98] select-none ${styles.card} ${styles.glow}`}
      onClick={() => !advancing && onAdvance(order.id, next)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-lg font-serif font-bold ${order.tableNumber ? 'text-[#C9A84C]' : 'text-white/70'}`}>
              {order.tableNumber ? `Table ${order.tableNumber}` : order.source.toUpperCase()}
            </span>
            {order.sessionType === 'qr_menu' && (
              <span className="text-[10px] bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-full">QR</span>
            )}
          </div>
          <p className="text-white/25 text-[11px] mt-0.5">
            {new Date(order.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <LiveTimer startIso={order.createdAt} />
          {sla !== 'ok' && (
            <p className={`text-[10px] mt-0.5 ${SLA_STYLES[sla].timer}`}>
              {sla === 'critical' ? '🚨 URGENT!' : sla === 'danger' ? '⚠ RETARD' : '⏱ ATTENTION'}
            </p>
          )}
        </div>
      </div>

      {/* Items */}
      <ul className="space-y-1.5 flex-1">
        {order.items.map((item, i) => (
          <li key={i} className="text-sm">
            <span className="font-bold text-white">{item.qty}×</span>
            <span className="text-white/90 ml-1">{item.name}</span>
            {Object.values(item.modifiers || {}).length > 0 && (
              <span className="block text-[11px] text-white/40 ml-4">
                → {Object.values(item.modifiers!).join(' · ')}
              </span>
            )}
            {item.notes && <span className="block text-[11px] text-[#C9A84C]/70 ml-4 italic">[{item.notes}]</span>}
          </li>
        ))}
      </ul>

      {/* Notes */}
      {(order.notes || order.customerNotes) && (
        <div className="bg-[#C9A84C]/8 border border-[#C9A84C]/20 rounded-lg px-3 py-2 text-xs text-[#C9A84C]/80">
          {order.notes || order.customerNotes}
        </div>
      )}

      {/* Action button */}
      <button
        disabled={advancing}
        className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all ${
          advancing
            ? 'bg-white/5 text-white/30'
            : order.status === 'ready'
              ? 'bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30'
              : 'bg-[#C9A84C]/15 border border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/25'
        }`}
      >
        {advancing ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin"/>
            Mise à jour…
          </span>
        ) : order.status === 'accepted'  ? '▶ Commencer la préparation'
          : order.status === 'preparing' ? '✓ Marquer Prête'
          : '📤 Servir / Livrer'}
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
//  MAIN KDS DASHBOARD
// ════════════════════════════════════════════════════════════════════════
export default function KDSDashboard() {
  const qc = useQueryClient();
  const [orders,     setOrders]     = useState<KDSOrder[]>([]);
  const [advancing,  setAdvancing]  = useState<Record<string, boolean>>({});
  const [connected,  setConnected]  = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const socketRef = useRef<Socket | null>(null);

  // Live clock for header
  const [clock, setClock] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(t); }, []);

  // ── Fetch initial KDS state ───────────────────────────────────────────
  useQuery({
    queryKey: ['kds-orders', BRANCH_ID],
    queryFn:  async () => {
      const res  = await fetch(`${API}/orders/kds/${BRANCH_ID}`, { headers: AUTH_HDR() });
      const data = await res.json();
      setOrders(data.data || []);
      setLastUpdate(new Date());
      return data.data;
    },
    refetchInterval: 30_000,   // Polling fallback if socket disconnects
  });

  // ── Socket.io ─────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      auth:       { token: AUTH_TOKEN() },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect',    () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    // New order arrives at KDS
    socket.on('order:new', (payload: KDSOrder) => {
      setOrders(prev => [{ ...payload, status: 'accepted' } as KDSOrder, ...prev]);
      setLastUpdate(new Date());
      // Audio alert (browser beep)
      try { new Audio('data:audio/wav;base64,UklGRlYAAABXQVZFZm10IBAAAA...').play().catch(() => {}); } catch {}
    });

    // Status update
    socket.on('order:status', (payload: { orderId: string; status: string }) => {
      setOrders(prev => {
        if (['delivered','paid','cancelled'].includes(payload.status)) {
          return prev.filter(o => o.id !== payload.orderId);
        }
        return prev.map(o => o.id === payload.orderId ? { ...o, status: payload.status as KDSOrder['status'] } : o);
      });
      setLastUpdate(new Date());
    });

    // Void
    socket.on('order:voided', (payload: { orderId: string }) => {
      setOrders(prev => prev.filter(o => o.id !== payload.orderId));
    });

    return () => { socket.disconnect(); socketRef.current = null; };
  }, []);

  // ── Advance order status ──────────────────────────────────────────────
  const advance = useCallback(async (orderId: string, nextStatus: string) => {
    setAdvancing(p => ({ ...p, [orderId]: true }));
    try {
      await fetch(`${API}/orders/${orderId}/status`, {
        method:  'PATCH',
        headers: { ...AUTH_HDR(), 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: nextStatus }),
      });
      // Socket event will update state reactively
    } catch (err) {
      console.error('[KDS] Status update failed:', err);
    } finally {
      setAdvancing(p => ({ ...p, [orderId]: false }));
    }
  }, []);

  // ── Group by status ───────────────────────────────────────────────────
  const byStatus = Object.fromEntries(
    COLUMNS.map(col => [col.key, orders.filter(o => o.status === col.key).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())])
  );

  const totalActive  = orders.length;
  const criticalCount = orders.filter(o => getAgeMinutes(o.createdAt) >= 10).length;

  return (
    <div className="bg-[#0D0D0D] text-white min-h-screen flex flex-col overflow-hidden font-sans">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 h-14 bg-[#141414] border-b border-white/[0.06] flex items-center px-6 gap-4 z-10">
        {/* Logo */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C9A84C] to-[#8B6E2F] flex items-center justify-center font-serif text-xl font-bold text-black">L</div>
          <div>
            <p className="font-serif text-[#C9A84C] text-sm leading-none">Cuisine LUX</p>
            <p className="text-white/25 text-[10px]">Affichage Cuisine</p>
          </div>
        </div>

        <div className="flex-1" />

        {/* Critical alert */}
        {criticalCount > 0 && (
          <div className="flex items-center gap-2 bg-red-500/15 border border-red-500/30 px-3 py-1.5 rounded-xl animate-pulse">
            <span className="text-red-400 text-sm font-bold">🚨 {criticalCount} URGENT{criticalCount > 1 ? 'S' : ''}</span>
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm">
          <span className="text-white/40">{totalActive} commande{totalActive !== 1 ? 's' : ''} active{totalActive !== 1 ? 's' : ''}</span>
          <span className="text-white/20">|</span>
          <span className="text-white/40 text-xs">{lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>

        {/* Live clock */}
        <span className="font-mono text-lg text-white/80 tabular-nums flex-shrink-0">
          {clock.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </span>

        {/* Connection status */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`}/>
          <span className={`text-xs ${connected ? 'text-white/30' : 'text-red-400'}`}>{connected ? 'Live' : 'Hors ligne'}</span>
        </div>
      </header>

      {/* ── Kanban columns ─────────────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-3 gap-0 overflow-hidden">
        {COLUMNS.map(col => {
          const colOrders  = byStatus[col.key] || [];
          const hasUrgent  = colOrders.some(o => getAgeMinutes(o.createdAt) >= 10);

          return (
            <div key={col.key} className="flex flex-col border-r border-white/[0.06] last:border-r-0 overflow-hidden">
              {/* Column header */}
              <div className={`flex-shrink-0 px-4 py-3 border-b flex items-center justify-between ${
                hasUrgent ? 'border-red-500/30 bg-red-500/5' : 'border-white/[0.06] bg-[#0F0F0F]'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{col.icon}</span>
                  <h2 className={`font-serif text-base ${col.accent}`}>{col.label}</h2>
                </div>
                <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${
                  colOrders.length > 0
                    ? hasUrgent
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-white/10 text-white/70'
                    : 'text-white/15'
                }`}>
                  {colOrders.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {colOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-white/15 text-center">
                    <span className="text-4xl mb-2 opacity-30">{col.icon}</span>
                    <p className="text-xs">Aucune commande</p>
                  </div>
                ) : (
                  colOrders.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onAdvance={advance}
                      advancing={!!advancing[order.id]}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Bottom SLA legend ──────────────────────────────────────────── */}
      <footer className="flex-shrink-0 h-8 bg-[#141414] border-t border-white/[0.06] flex items-center justify-center gap-6 text-[11px] text-white/30">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-white/20"/>Normal (&lt;5 min)</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400"/>Attention (5–10 min)</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400"/>Retard (10–15 min)</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"/>Urgent (&gt;15 min)</span>
      </footer>
    </div>
  );
}
