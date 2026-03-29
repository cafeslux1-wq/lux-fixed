// ─── CAFÉ LUX — Staff Portal ─────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { CAFE } from '../../lib/constants';
import type { Order } from '../../lib/types';

export default function StaffPortal() {
  const { api, state, dispatch, toast } = useApp();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'orders' | 'attendance' | 'schedule'>('orders');
  const [checkedIn, setCheckedIn] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const data = await api.getOrders({ status: 'pending,accepted,preparing,ready', limit: '50' });
    setOrders(data);
    setLoading(false);
  };

  useEffect(() => { refresh(); const t = setInterval(refresh, 20_000); return () => clearInterval(t); }, []);

  const updateStatus = async (id: number, status: Order['status']) => {
    await api.updateOrderStatus(id, status);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    toast(`✓ Commande ${id} → ${status}`, 'success');
  };

  const handleCheckIn = async (type: 'in' | 'out') => {
    if (!navigator.geolocation) { toast('GPS non disponible', 'error'); return; }
    navigator.geolocation.getCurrentPosition(async pos => {
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const dist = getDistance(coords, { lat: CAFE.lat, lng: CAFE.lng });
      if (dist > CAFE.gpsRadius) {
        toast(`⚠ Vous êtes à ${Math.round(dist)}m du café (max ${CAFE.gpsRadius}m)`, 'error');
        return;
      }
      await api.logAttendance(state.auth.user?.id ?? 'unknown', type, coords);
      setCheckedIn(type === 'in');
      toast(type === 'in' ? '✓ Pointage d\'arrivée enregistré' : '✓ Pointage de départ enregistré', 'success');
    }, () => toast('Erreur GPS', 'error'));
  };

  const STATUS_NEXT: Partial<Record<Order['status'], Order['status']>> = {
    pending:   'accepted',
    accepted:  'preparing',
    preparing: 'ready',
    ready:     'done',
  };

  const STATUS_COLOR: Record<string, string> = {
    pending:   '#888', accepted: '#5B8DEF', preparing: '#C9A84C', ready: '#3DBE7A',
  };

  const pendingCount = orders.filter(o => o.status === 'pending').length;

  return (
    <div style={{ background: '#080808', minHeight: '100vh', paddingBottom: 72 }}>
      {/* Header */}
      <div style={{ background: '#0F0F0F', borderBottom: '1px solid #1A1A1A', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontFamily: '"Cinzel",serif', color: '#C9A84C', fontSize: 16, letterSpacing: 3 }}>✦ LUX</div>
        <div style={{ fontSize: 12, color: '#555' }}>Portail {state.auth.user?.role}</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {pendingCount > 0 && (
            <span style={{ background: '#E05252', color: '#fff', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
              {pendingCount} en attente
            </span>
          )}
          <button onClick={() => navigate('/kds')} style={{ padding: '6px 12px', background: 'none', border: '1px solid #1A1A1A', borderRadius: 8, color: '#888', cursor: 'pointer', fontSize: 11 }}>📺 KDS</button>
          <button onClick={() => dispatch({ type: 'LOGOUT' })} style={{ padding: '6px 12px', background: 'none', border: '1px solid #1A1A1A', borderRadius: 8, color: '#555', cursor: 'pointer', fontSize: 11 }}>Quitter</button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #111' }}>
        {([['orders','📦 Commandes'],['attendance','📍 Pointage'],['schedule','📅 Planning']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '12px 8px', background: 'none', border: 'none',
            borderBottom: `2px solid ${tab === t ? '#C9A84C' : 'transparent'}`,
            color: tab === t ? '#C9A84C' : '#555', cursor: 'pointer', fontSize: 12,
          }}>{label}</button>
        ))}
      </div>

      <div style={{ padding: '16px', maxWidth: 700, margin: '0 auto' }}>

        {/* ORDERS TAB */}
        {tab === 'orders' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 20, color: '#F2EFE9' }}>
                Commandes actives
              </div>
              <button onClick={refresh} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 18 }}>⟳</button>
            </div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#555' }}>Chargement…</div>
            ) : orders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#555' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>✓</div>
                Aucune commande en attente
              </div>
            ) : (
              orders.map(order => (
                <div key={order.id} style={{
                  background: '#0F0F0F', border: `1px solid ${STATUS_COLOR[order.status] ?? '#1A1A1A'}30`,
                  borderLeft: `3px solid ${STATUS_COLOR[order.status] ?? '#1A1A1A'}`,
                  borderRadius: 12, padding: '14px', marginBottom: 10,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontFamily: '"Cormorant Garamond",serif', color: '#C9A84C', fontSize: 16 }}>
                      #{String(order.id).slice(-6)}
                      {order.source !== 'pos' && (
                        <span style={{ fontSize: 10, color: '#888', marginLeft: 8 }}>{order.source?.toUpperCase()}</span>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: STATUS_COLOR[order.status], fontWeight: 600 }}>
                      {order.status.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>
                    {order.customer} · {order.type} · {order.time}
                    {order.tableNum && ` · Table #${order.tableNum}`}
                  </div>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
                    {order.items.map(i => `${i.qty}× ${i.name}`).join(' · ')}
                  </div>
                  {order.notes && (
                    <div style={{ fontSize: 11, color: '#C9A84C', marginBottom: 10, fontStyle: 'italic' }}>
                      📝 {order.notes}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontFamily: '"Cormorant Garamond",serif', color: '#C9A84C', fontSize: 16 }}>
                      {order.total} MAD
                    </span>
                    {STATUS_NEXT[order.status] && (
                      <button
                        onClick={() => updateStatus(order.id, STATUS_NEXT[order.status]!)}
                        style={{ marginLeft: 'auto', padding: '7px 16px', background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.3)', borderRadius: 8, color: '#C9A84C', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                      >
                        → {STATUS_NEXT[order.status]}
                      </button>
                    )}
                    <button
                      onClick={() => updateStatus(order.id, 'cancelled')}
                      style={{ padding: '7px 12px', background: 'rgba(224,82,82,.08)', border: '1px solid rgba(224,82,82,.2)', borderRadius: 8, color: '#E05252', cursor: 'pointer', fontSize: 11 }}
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* ATTENDANCE TAB */}
        {tab === 'attendance' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📍</div>
            <div style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 22, color: '#F2EFE9', marginBottom: 8 }}>
              Pointage GPS
            </div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 24 }}>
              Vous devez être dans un rayon de {CAFE.gpsRadius}m du café.<br/>
              <span style={{ fontSize: 10 }}>{CAFE.address}</span>
            </div>
            {state.auth.user && (
              <div style={{ marginBottom: 24, fontSize: 14, color: '#888' }}>
                {state.auth.user.name} · {state.auth.user.role}
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => handleCheckIn('in')} style={{
                padding: '14px 28px', background: 'rgba(61,190,122,.1)', border: '1px solid rgba(61,190,122,.3)',
                borderRadius: 10, color: '#3DBE7A', fontWeight: 700, cursor: 'pointer', fontSize: 14,
              }}>
                📥 Arrivée
              </button>
              <button onClick={() => handleCheckIn('out')} style={{
                padding: '14px 28px', background: 'rgba(224,82,82,.08)', border: '1px solid rgba(224,82,82,.25)',
                borderRadius: 10, color: '#E05252', fontWeight: 700, cursor: 'pointer', fontSize: 14,
              }}>
                📤 Départ
              </button>
            </div>
            {checkedIn && (
              <div style={{ marginTop: 20, fontSize: 12, color: '#3DBE7A' }}>
                ✓ Statut: En service
              </div>
            )}
          </div>
        )}

        {/* SCHEDULE TAB */}
        {tab === 'schedule' && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#555' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📅</div>
            <div style={{ fontSize: 14, marginBottom: 6 }}>Planning de la semaine</div>
            <div style={{ fontSize: 11, color: '#444' }}>Géré par l'Admin depuis le tableau de bord.</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  KDSPage — Kitchen Display System
// ─────────────────────────────────────────────────────────────────────
export function KDSPage() {
  const { api, toast } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const navigate = useNavigate();

  const refresh = async () => {
    const data = await api.getOrders({ status: 'accepted,preparing', limit: '30' });
    setOrders(data);
  };

  useEffect(() => { refresh(); const t = setInterval(refresh, 10_000); return () => clearInterval(t); }, []);

  const markReady = async (id: number) => {
    await api.updateOrderStatus(id, 'ready');
    setOrders(prev => prev.filter(o => o.id !== id));
    toast('✅ Commande prête!', 'success');
  };

  return (
    <div style={{ background: '#050505', minHeight: '100vh', padding: '0 0 20px' }}>
      {/* KDS Header */}
      <div style={{
        background: '#0A0A0A', borderBottom: '1px solid #1A1A1A',
        padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div style={{ fontFamily: '"Cinzel",serif', color: '#C9A84C', fontSize: 20, letterSpacing: 4 }}>✦ KDS</div>
        <div style={{ fontSize: 12, color: '#555' }}>Cuisine · Préparation</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#444' }}>{orders.length} en préparation</span>
          <button onClick={refresh} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 18 }}>⟳</button>
          <button onClick={() => navigate('/staff')} style={{ padding: '6px 12px', background: 'none', border: '1px solid #1A1A1A', borderRadius: 6, color: '#555', cursor: 'pointer', fontSize: 11 }}>← Portail</button>
        </div>
      </div>

      {orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#333' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
          <div style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 22 }}>Cuisine libre</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16, padding: '20px' }}>
          {orders.map(order => (
            <div key={order.id} style={{
              background: '#0F0F0F', border: `1px solid ${order.status === 'preparing' ? 'rgba(201,168,76,.4)' : '#1A1A1A'}`,
              borderRadius: 14, padding: '18px', display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontFamily: '"Cormorant Garamond",serif', color: '#C9A84C', fontSize: 22 }}>
                  #{String(order.id).slice(-6)}
                </div>
                <div style={{ display: 'flex', gap: 6, flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: 10, background: 'rgba(201,168,76,.1)', color: '#C9A84C', padding: '2px 8px', borderRadius: 8 }}>
                    {order.type?.toUpperCase()}
                  </span>
                  {order.tableNum && (
                    <span style={{ fontSize: 10, color: '#666' }}>Table #{order.tableNum}</span>
                  )}
                </div>
              </div>

              {/* Timer (rough) */}
              <div style={{ fontSize: 11, color: '#555' }}>{order.time}</div>

              {/* Items */}
              <div style={{ flex: 1 }}>
                {order.items.map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 10, padding: '6px 0',
                    borderBottom: '1px solid #111', fontSize: 14,
                  }}>
                    <span style={{ fontFamily: '"Cormorant Garamond",serif', color: '#C9A84C', fontSize: 18, minWidth: 24 }}>{item.qty}</span>
                    <span style={{ color: '#F2EFE9' }}>{item.name}</span>
                  </div>
                ))}
              </div>

              {/* Notes */}
              {order.notes && (
                <div style={{ fontSize: 11, color: '#C9A84C', fontStyle: 'italic' }}>📝 {order.notes}</div>
              )}

              {/* Action */}
              <button onClick={() => markReady(order.id)} style={{
                width: '100%', padding: '12px',
                background: 'rgba(61,190,122,.1)', border: '1px solid rgba(61,190,122,.3)',
                borderRadius: 8, color: '#3DBE7A', fontWeight: 700, cursor: 'pointer', fontSize: 14,
              }}>
                ✅ Prêt — Appeler le service
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── GPS distance helper (Haversine) ───────────────────────────────────
function getDistance(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R  = 6371000;
  const d1 = (a.lat - b.lat) * Math.PI / 180;
  const d2 = (a.lng - b.lng) * Math.PI / 180;
  const h  = Math.sin(d1/2)**2 + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(d2/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1-h));
}
