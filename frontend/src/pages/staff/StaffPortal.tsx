// ─── CAFÉ LUX — StaffPortalPage (/portal/staff) ───────────────────────
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { CAFE, PORTAL } from '../../lib/constants';
import type { Order } from '../../lib/types';

export default function StaffPortalPage() {
  const { api, state, dispatch, toast } = useApp();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'orders' | 'attendance'>('orders');

  const refresh = async () => {
    setLoading(true);
    const data = await api.getOrders({ limit: '60' });
    // Filter to active statuses
    setOrders(data.filter(o => ['pending','accepted','preparing','ready'].includes(o.status)));
    setLoading(false);
  };

  useEffect(() => { refresh(); const t = setInterval(refresh, 20_000); return () => clearInterval(t); }, []);

  const advanceStatus = async (id: number, current: Order['status']) => {
    const next: Partial<Record<Order['status'], Order['status']>> = {
      pending: 'accepted', accepted: 'preparing', preparing: 'ready', ready: 'done',
    };
    const status = next[current];
    if (!status) return;
    await api.updateOrderStatus(id, status);
    setOrders(prev => status === 'done' ? prev.filter(o => o.id !== id) : prev.map(o => o.id === id ? { ...o, status } : o));
    toast(`✓ Commande → ${status}`, 'success');
  };

  const cancelOrder = async (id: number) => {
    await api.updateOrderStatus(id, 'cancelled');
    setOrders(prev => prev.filter(o => o.id !== id));
    toast('Commande annulée', 'info');
  };

  const handleCheckIn = async (type: 'in' | 'out') => {
    if (!navigator.geolocation) { toast('GPS non disponible', 'error'); return; }
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const dist = haversine(coords, { lat: CAFE.lat, lng: CAFE.lng });
        if (dist > CAFE.gpsRadius) {
          toast(`⚠ Vous êtes à ${Math.round(dist)}m (max ${CAFE.gpsRadius}m)`, 'error');
          return;
        }
        await api.logAttendance(state.auth.user?.id ?? 'unknown', type, coords);
        toast(type === 'in' ? '✓ Arrivée enregistrée' : '✓ Départ enregistré', 'success');
      },
      () => toast('Erreur de géolocalisation', 'error'),
    );
  };

  const STATUS_COLOR: Record<string, string> = {
    pending:'#666', accepted:'#5B8DEF', preparing:'#C9A84C', ready:'#3DBE7A',
  };
  const STATUS_NEXT_LABEL: Partial<Record<Order['status'], string>> = {
    pending:'Accepter', accepted:'En préparation', preparing:'Prêt', ready:'Terminé',
  };

  const pendingCount = orders.filter(o => o.status === 'pending').length;

  return (
    <div style={{ background: '#080808', minHeight: '100vh', paddingBottom: 72 }}>
      {/* Header */}
      <div style={{ background: '#0A0A0A', borderBottom: '1px solid #111', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontFamily: '"Cinzel",serif', color: '#C9A84C', fontSize: 16, letterSpacing: 3 }}>✦ STAFF</div>
        <div style={{ fontSize: 11, color: '#444' }}>{state.auth.user?.name} · {state.auth.user?.role}</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {pendingCount > 0 && <span style={{ background: '#E05252', color: '#fff', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{pendingCount} en attente</span>}
          <button onClick={() => navigate(PORTAL.kds)} style={{ padding: '6px 12px', background: 'none', border: '1px solid #1A1A1A', borderRadius: 8, color: '#666', cursor: 'pointer', fontSize: 11 }}>📺 KDS</button>
          <button onClick={() => dispatch({ type: 'LOGOUT' })} style={{ padding: '6px 12px', background: 'none', border: '1px solid #111', borderRadius: 8, color: '#444', cursor: 'pointer', fontSize: 11 }}>Quitter</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #0D0D0D' }}>
        {([['orders','📦 Commandes'],['attendance','📍 Pointage']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '12px', background: 'none', border: 'none', borderBottom: `2px solid ${tab===t?'#C9A84C':'transparent'}`, color: tab===t?'#C9A84C':'#444', cursor: 'pointer', fontSize: 12 }}>{label}</button>
        ))}
      </div>

      <div style={{ padding: '16px', maxWidth: 700, margin: '0 auto' }}>
        {/* ORDERS */}
        {tab === 'orders' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 20, color: '#F2EFE9' }}>Commandes actives</div>
              <button onClick={refresh} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: 18 }}>⟳</button>
            </div>

            {loading ? <div style={{ textAlign: 'center', padding: '40px', color: '#444' }}>Chargement…</div>
            : orders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#444' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
                Aucune commande en attente
              </div>
            ) : orders.map(order => (
              <div key={order.id} style={{ background: '#0F0F0F', borderLeft: `3px solid ${STATUS_COLOR[order.status]??'#222'}`, border: `1px solid #1A1A1A`, borderRadius: 12, padding: '14px', marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontFamily: '"Cormorant Garamond",serif', color: '#C9A84C', fontSize: 16 }}>
                    #{String(order.id).slice(-6)}
                    {order.source !== 'web' && order.source !== 'pos' && <span style={{ fontSize: 10, color: '#888', marginLeft: 8 }}>{order.source?.toUpperCase()}</span>}
                  </div>
                  <span style={{ fontSize: 10, color: STATUS_COLOR[order.status], fontWeight: 700, textTransform: 'uppercase' }}>{order.status}</span>
                </div>
                <div style={{ fontSize: 11, color: '#555', marginBottom: 6 }}>
                  {order.customer} · {order.type} · {order.time}
                  {order.tableNum && ` · Table #${order.tableNum}`}
                </div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: order.notes ? 4 : 10 }}>
                  {order.items.map(i => `${i.qty}× ${i.name}`).join(' · ')}
                </div>
                {order.notes && <div style={{ fontSize: 11, color: '#C9A84C', fontStyle: 'italic', marginBottom: 10 }}>📝 {order.notes}</div>}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontFamily: '"Cormorant Garamond",serif', color: '#C9A84C', fontSize: 15 }}>{order.total} MAD</span>
                  {STATUS_NEXT_LABEL[order.status] && (
                    <button onClick={() => advanceStatus(order.id, order.status)} style={{ marginLeft: 'auto', padding: '6px 16px', background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.3)', borderRadius: 8, color: '#C9A84C', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      → {STATUS_NEXT_LABEL[order.status]}
                    </button>
                  )}
                  <button onClick={() => cancelOrder(order.id)} style={{ padding: '6px 10px', background: 'rgba(224,82,82,.06)', border: '1px solid rgba(224,82,82,.2)', borderRadius: 8, color: '#E05252', cursor: 'pointer', fontSize: 11 }}>✕</button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ATTENDANCE */}
        {tab === 'attendance' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>📍</div>
            <div style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 22, color: '#F2EFE9', marginBottom: 6 }}>Pointage GPS</div>
            <div style={{ fontSize: 12, color: '#555', marginBottom: 28, lineHeight: 1.6 }}>
              Rayon autorisé: {CAFE.gpsRadius}m<br/>
              <span style={{ fontSize: 10, color: '#444' }}>{CAFE.address}</span>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => handleCheckIn('in')} style={{ padding: '14px 28px', background: 'rgba(61,190,122,.1)', border: '1px solid rgba(61,190,122,.3)', borderRadius: 10, color: '#3DBE7A', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>📥 Arrivée</button>
              <button onClick={() => handleCheckIn('out')} style={{ padding: '14px 28px', background: 'rgba(224,82,82,.08)', border: '1px solid rgba(224,82,82,.2)', borderRadius: 10, color: '#E05252', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>📤 Départ</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── KDS Page ──────────────────────────────────────────────────────────
export function KDSPage() {
  const { api, toast } = useApp();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);

  const refresh = async () => {
    const data = await api.getOrders({ limit: '30' });
    setOrders(data.filter(o => ['accepted','preparing'].includes(o.status)));
  };

  useEffect(() => { refresh(); const t = setInterval(refresh, 10_000); return () => clearInterval(t); }, []);

  const markReady = async (id: number) => {
    await api.updateOrderStatus(id, 'ready');
    setOrders(prev => prev.filter(o => o.id !== id));
    toast('✅ Commande prête!', 'success');
  };

  return (
    <div style={{ background: '#050505', minHeight: '100vh', paddingBottom: 20 }}>
      <div style={{ background: '#0A0A0A', borderBottom: '1px solid #111', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ fontFamily: '"Cinzel",serif', color: '#C9A84C', fontSize: 20, letterSpacing: 4 }}>✦ KDS</div>
        <div style={{ fontSize: 11, color: '#444' }}>Cuisine · Préparation</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <span style={{ fontSize: 11, color: '#333' }}>{orders.length} en préparation</span>
          <button onClick={refresh} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: 18 }}>⟳</button>
          <button onClick={() => navigate(PORTAL.staff)} style={{ padding: '5px 12px', background: 'none', border: '1px solid #111', borderRadius: 6, color: '#444', cursor: 'pointer', fontSize: 11 }}>← Portail</button>
        </div>
      </div>

      {orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#222' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
          <div style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 22 }}>Cuisine libre</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16, padding: '20px' }}>
          {orders.map(order => (
            <div key={order.id} style={{ background: '#0F0F0F', border: `1px solid ${order.status==='preparing'?'rgba(201,168,76,.4)':'#1A1A1A'}`, borderRadius: 14, padding: '18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ fontFamily: '"Cormorant Garamond",serif', color: '#C9A84C', fontSize: 22 }}>#{String(order.id).slice(-6)}</div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 10, background: 'rgba(201,168,76,.1)', color: '#C9A84C', padding: '2px 8px', borderRadius: 8 }}>{order.type?.toUpperCase()}</span>
                  {order.tableNum && <div style={{ fontSize: 10, color: '#555', marginTop: 3 }}>Table #{order.tableNum}</div>}
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#444' }}>{order.time}</div>
              <div style={{ flex: 1 }}>
                {order.items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: '1px solid #0D0D0D', fontSize: 14 }}>
                    <span style={{ fontFamily: '"Cormorant Garamond",serif', color: '#C9A84C', fontSize: 18, minWidth: 22 }}>{item.qty}</span>
                    <span style={{ color: '#F2EFE9' }}>{item.name}</span>
                  </div>
                ))}
              </div>
              {order.notes && <div style={{ fontSize: 11, color: '#C9A84C', fontStyle: 'italic' }}>📝 {order.notes}</div>}
              <button onClick={() => markReady(order.id)} style={{ width: '100%', padding: '12px', background: 'rgba(61,190,122,.1)', border: '1px solid rgba(61,190,122,.3)', borderRadius: 8, color: '#3DBE7A', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
                ✅ Prêt — Appeler le service
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Haversine ─────────────────────────────────────────────────────────
function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const d1 = (a.lat - b.lat) * Math.PI / 180;
  const d2 = (a.lng - b.lng) * Math.PI / 180;
  const h = Math.sin(d1/2)**2 + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(d2/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1-h));
}
