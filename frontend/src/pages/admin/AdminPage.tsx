// ─── CAFÉ LUX — Admin Page ────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../lib/store';
import type { Order, StockItem } from '../../lib/types';

// ─────────────────────────────────────────────────────────────────────
//  AdminPage — nested router for sub-sections
// ─────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { dispatch } = useApp();
  const navigate  = useNavigate();
  const location  = useLocation();
  const at = (p: string) => location.pathname.includes(p);

  const NAV = [
    { path: '/admin/orders',   icon: '📦', label: 'Commandes' },
    { path: '/admin/stock',    icon: '📦', label: 'Stock'     },
    { path: '/admin/staff',    icon: '👥', label: 'Employés'  },
    { path: '/analytics',      icon: '📊', label: 'Analytics' },
    { path: '/pos',            icon: '🧾', label: 'POS'       },
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#080808', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{ width: 200, background: '#0A0A0A', borderRight: '1px solid #1A1A1A', display: 'flex', flexDirection: 'column', padding: '20px 0' }}>
        <div style={{ padding: '0 16px 20px', fontFamily: '"Cinzel",serif', color: '#C9A84C', fontSize: 16, letterSpacing: 3, borderBottom: '1px solid #111' }}>
          ✦ ADMIN
        </div>
        <div style={{ padding: '12px 8px', flex: 1 }}>
          {NAV.map(n => (
            <button key={n.path} onClick={() => navigate(n.path)} style={{
              width: '100%', padding: '10px 12px', marginBottom: 4,
              background: at(n.path) ? 'rgba(201,168,76,.08)' : 'none',
              border: 'none', borderRadius: 8,
              color: at(n.path) ? '#C9A84C' : '#666',
              textAlign: 'left', cursor: 'pointer', fontSize: 13,
              borderLeft: `2px solid ${at(n.path) ? '#C9A84C' : 'transparent'}`,
              transition: '.12s',
            }}>
              {n.icon} {n.label}
            </button>
          ))}
        </div>
        <div style={{ padding: '12px 8px', borderTop: '1px solid #111' }}>
          <button onClick={() => dispatch({ type: 'LOGOUT' })} style={{ width: '100%', padding: '8px 12px', background: 'none', border: '1px solid #1A1A1A', borderRadius: 8, color: '#555', cursor: 'pointer', fontSize: 12 }}>
            Déconnexion
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
        <Routes>
          <Route path="orders" element={<AdminOrders />} />
          <Route path="stock"  element={<AdminStock />} />
          <Route path="staff"  element={<AdminStaff />} />
          <Route path="*"      element={<AdminOrders />} />
        </Routes>
      </div>
    </div>
  );
}

// ── Orders sub-page ────────────────────────────────────────────────────
function AdminOrders() {
  const { api, toast } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const data = await api.getOrders({ limit: '100' });
    setOrders(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);
  const statusColor: Record<string, string> = {
    pending: '#888', accepted: '#5B8DEF', preparing: '#C9A84C',
    ready: '#3DBE7A', done: '#3DBE7A', cancelled: '#E05252',
  };

  const updateStatus = async (id: number, status: Order['status']) => {
    await api.updateOrderStatus(id, status);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    toast(`✓ Statut mis à jour`, 'success');
  };

  return (
    <div>
      <h2 style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 26, color: '#F2EFE9', marginBottom: 16 }}>
        📦 Toutes les commandes
      </h2>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total',    val: orders.length },
          { label: 'En attente', val: orders.filter(o => o.status === 'pending').length, red: true },
          { label: 'Livraison', val: orders.filter(o => o.type === 'delivery').length },
          { label: 'CA total',  val: `${orders.reduce((s,o) => s + (o.total ?? 0), 0).toFixed(0)} MAD` },
        ].map(s => (
          <div key={s.label} style={{ background: '#0F0F0F', border: '1px solid #1A1A1A', borderRadius: 10, padding: '14px' }}>
            <div style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 28, color: (s as any).red ? '#E05252' : '#C9A84C' }}>{s.val}</div>
            <div style={{ fontSize: 10, color: '#555', marginTop: 3, textTransform: 'uppercase', letterSpacing: .5 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {['all','pending','preparing','done','cancelled'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '5px 14px', borderRadius: 16, fontSize: 11,
            border: `1px solid ${filter === f ? '#C9A84C' : '#1A1A1A'}`,
            background: filter === f ? 'rgba(201,168,76,.1)' : 'none',
            color: filter === f ? '#C9A84C' : '#555', cursor: 'pointer',
          }}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>
        ))}
        <button onClick={load} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16 }}>⟳</button>
      </div>

      {/* Orders list */}
      {loading ? (
        <div style={{ color: '#555', textAlign: 'center', padding: '40px' }}>Chargement…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(o => (
            <div key={o.id} style={{
              background: '#0F0F0F', border: `1px solid #1A1A1A`,
              borderLeft: `3px solid ${statusColor[o.status] ?? '#333'}`,
              borderRadius: 10, padding: '12px 14px',
              display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
            }}>
              <div style={{ fontFamily: '"Cormorant Garamond",serif', color: '#C9A84C', fontSize: 16, minWidth: 80 }}>
                #{String(o.id).slice(-6)}
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 13 }}>{o.customer} · {o.phone}</div>
                <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>
                  {o.type} · {o.date} {o.time}
                  {o.source && o.source !== 'web' && o.source !== 'pos' && (
                    <span style={{ marginLeft: 6, color: '#FF6E1A' }}>{o.source.toUpperCase()}</span>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#888', minWidth: 140 }}>
                {o.items.slice(0,2).map(i => `${i.qty}×${i.name}`).join(', ')}
                {o.items.length > 2 && <span style={{ color: '#555' }}> +{o.items.length - 2}</span>}
              </div>
              <div style={{ fontFamily: '"Cormorant Garamond",serif', color: '#C9A84C', fontSize: 16, minWidth: 80 }}>
                {o.total} MAD
              </div>
              <span style={{ fontSize: 10, color: statusColor[o.status], background: `${statusColor[o.status]}18`, padding: '2px 8px', borderRadius: 8, fontWeight: 600 }}>
                {o.status}
              </span>
              {o.status === 'pending' && (
                <button onClick={() => updateStatus(o.id, 'accepted')} style={{ padding: '5px 12px', background: 'rgba(91,141,239,.1)', border: '1px solid rgba(91,141,239,.3)', borderRadius: 6, color: '#5B8DEF', cursor: 'pointer', fontSize: 11 }}>
                  Accepter
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Stock sub-page ─────────────────────────────────────────────────────
function AdminStock() {
  const { api, toast } = useApp();
  const [stock, setStock] = useState<{ items: StockItem[]; alerts: StockItem[] }>({ items: [], alerts: [] });
  const [editing, setEditing] = useState<Record<number, number>>({});

  useEffect(() => {
    api.getStock().then(setStock);
  }, []);

  const saveQty = async (id: number) => {
    const qty = editing[id];
    if (qty === undefined) return;
    await api.updateStock(id, qty);
    toast('✓ Stock mis à jour', 'success');
    api.getStock().then(setStock);
    setEditing(e => { const n = {...e}; delete n[id]; return n; });
  };

  return (
    <div>
      <h2 style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 26, color: '#F2EFE9', marginBottom: 16 }}>📦 Gestion des stocks</h2>
      {stock.alerts.length > 0 && (
        <div style={{ background: 'rgba(224,82,82,.06)', border: '1px solid rgba(224,82,82,.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ color: '#E05252', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>⚠ {stock.alerts.length} alerte(s) stock critique</div>
          {stock.alerts.map(a => (
            <div key={a.id} style={{ fontSize: 11, color: '#888', marginTop: 3 }}>
              {a.name}: {a.quantity} {a.unit} (seuil: {a.minQuantity})
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {stock.items.map(item => {
          const alert = item.quantity <= item.minQuantity;
          return (
            <div key={item.id} style={{
              background: '#0F0F0F', border: `1px solid ${alert ? 'rgba(224,82,82,.3)' : '#1A1A1A'}`,
              borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13 }}>{item.name}</div>
                <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>Seuil: {item.minQuantity} {item.unit}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number" min="0"
                  value={editing[item.id] ?? item.quantity}
                  onChange={e => setEditing(prev => ({ ...prev, [item.id]: parseFloat(e.target.value) }))}
                  style={{ width: 70, padding: '6px 8px', background: '#111', border: '1px solid #1A1A1A', borderRadius: 6, color: '#F2EFE9', fontSize: 13, textAlign: 'center', outline: 'none' }}
                />
                <span style={{ fontSize: 11, color: '#555' }}>{item.unit}</span>
                {editing[item.id] !== undefined && (
                  <button onClick={() => saveQty(item.id)} style={{ padding: '5px 10px', background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.3)', borderRadius: 6, color: '#C9A84C', cursor: 'pointer', fontSize: 11 }}>✓</button>
                )}
              </div>
              {alert && <span style={{ color: '#E05252', fontSize: 18 }}>⚠</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Staff sub-page (placeholder) ───────────────────────────────────────
function AdminStaff() {
  return (
    <div>
      <h2 style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 26, color: '#F2EFE9', marginBottom: 16 }}>👥 Employés</h2>
      <div style={{ color: '#555', fontSize: 13 }}>Gestion du personnel via l'API Railway.</div>
    </div>
  );
}
