// ─── CAFÉ LUX — AdminPortalPage (/portal/admin) ───────────────────────
import React, { useEffect, useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { PORTAL } from '../../lib/constants';
import type { Order, StockItem } from '../../lib/types';

export default function AdminPortalPage() {
  const { dispatch } = useApp();
  const navigate  = useNavigate();
  const location  = useLocation();
  const at = (p: string) => location.pathname.includes(p);

  const NAV = [
    { path: '/portal/admin/orders',    icon: '📦', label: 'Commandes' },
    { path: '/portal/admin/stock',     icon: '📦', label: 'Stock'     },
    { path: PORTAL.analytics,          icon: '📊', label: 'Analytics' },
    { path: PORTAL.pos,                icon: '🧾', label: 'POS'       },
    { path: PORTAL.kds,                icon: '📺', label: 'KDS'       },
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#080808', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{ width: 196, background: '#0A0A0A', borderRight: '1px solid #0D0D0D', display: 'flex', flexDirection: 'column', padding: '0', flexShrink: 0 }}>
        <div style={{ padding: '18px 16px', fontFamily: '"Cinzel",serif', color: '#C9A84C', fontSize: 15, letterSpacing: 3, borderBottom: '1px solid #0D0D0D' }}>
          ✦ ADMIN
        </div>
        <div style={{ padding: '10px 8px', flex: 1 }}>
          {NAV.map(n => (
            <button key={n.path} onClick={() => navigate(n.path)} style={{
              width: '100%', padding: '9px 12px', marginBottom: 3,
              background: at(n.path) ? 'rgba(201,168,76,.08)' : 'none',
              border: 'none', borderRadius: 8,
              color: at(n.path) ? '#C9A84C' : '#555',
              textAlign: 'left', cursor: 'pointer', fontSize: 13,
              borderLeft: `2px solid ${at(n.path) ? '#C9A84C' : 'transparent'}`,
            }}>
              {n.icon} {n.label}
            </button>
          ))}
        </div>
        <div style={{ padding: '10px 8px', borderTop: '1px solid #0D0D0D' }}>
          <button onClick={() => dispatch({ type: 'LOGOUT' })} style={{ width: '100%', padding: '8px 12px', background: 'none', border: '1px solid #111', borderRadius: 8, color: '#444', cursor: 'pointer', fontSize: 12 }}>Déconnexion</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
        <Routes>
          <Route path="orders" element={<AdminOrders />} />
          <Route path="stock"  element={<AdminStock />}  />
          <Route path="*"      element={<AdminOrders />} />
        </Routes>
      </div>
    </div>
  );
}

// ── Admin Orders ──────────────────────────────────────────────────────
function AdminOrders() {
  const { api, toast } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const data = await api.getOrders({ limit: '150' });
    setOrders(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);
  const S: Record<string, string> = { pending:'#666', accepted:'#5B8DEF', preparing:'#C9A84C', ready:'#3DBE7A', done:'#3DBE7A', cancelled:'#E05252' };

  const updateStatus = async (id: number, status: Order['status']) => {
    await api.updateOrderStatus(id, status);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    toast('✓ Statut mis à jour', 'success');
  };

  return (
    <div>
      <h2 style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 26, color: '#F2EFE9', marginBottom: 16 }}>📦 Commandes</h2>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total',      val: orders.length,                                                      red: false },
          { label: 'En attente', val: orders.filter(o => o.status==='pending').length,                    red: true  },
          { label: 'Livraisons', val: orders.filter(o => o.type==='delivery').length,                     red: false },
          { label: 'CA',         val: `${orders.reduce((s,o) => s + (o.total??0), 0).toFixed(0)} MAD`,   red: false },
        ].map(k => (
          <div key={k.label} style={{ background: '#0F0F0F', border: '1px solid #1A1A1A', borderRadius: 10, padding: '14px' }}>
            <div style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 26, color: k.red ? '#E05252' : '#C9A84C' }}>{k.val}</div>
            <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: .5, marginTop: 3 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {['all','pending','preparing','ready','done','cancelled'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '4px 12px', borderRadius: 14, fontSize: 11, border: `1px solid ${filter===f?'#C9A84C':'#1A1A1A'}`, background: filter===f?'rgba(201,168,76,.1)':'none', color: filter===f?'#C9A84C':'#444', cursor: 'pointer' }}>
            {f.charAt(0).toUpperCase()+f.slice(1)}
          </button>
        ))}
        <button onClick={load} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: 16 }}>⟳</button>
      </div>

      {/* List */}
      {loading ? <div style={{ color: '#444', textAlign: 'center', padding: '40px' }}>Chargement…</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(o => (
            <div key={o.id} style={{ background: '#0F0F0F', borderLeft: `3px solid ${S[o.status]??'#222'}`, border: '1px solid #1A1A1A', borderRadius: 10, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: '"Cormorant Garamond",serif', color: '#C9A84C', fontSize: 15, minWidth: 70 }}>#{String(o.id).slice(-6)}</div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 12 }}>{o.customer} · {o.phone}</div>
                <div style={{ fontSize: 10, color: '#555', marginTop: 1 }}>{o.type} · {o.date} {o.time}{o.source&&o.source!=='web'&&o.source!=='pos'?` · ${o.source.toUpperCase()}`:''}</div>
              </div>
              <div style={{ fontSize: 11, color: '#666', minWidth: 130 }}>
                {o.items.slice(0,2).map(i=>`${i.qty}×${i.name}`).join(', ')}
                {o.items.length>2&&<span style={{color:'#333'}}> +{o.items.length-2}</span>}
              </div>
              <span style={{ fontFamily: '"Cormorant Garamond",serif', color: '#C9A84C', fontSize: 14, minWidth: 70 }}>{o.total} MAD</span>
              <span style={{ fontSize: 10, color: S[o.status], background: `${S[o.status]}15`, padding: '2px 8px', borderRadius: 8, fontWeight: 600 }}>{o.status}</span>
              {o.status === 'pending' && (
                <button onClick={() => updateStatus(o.id,'accepted')} style={{ padding: '4px 10px', background: 'rgba(91,141,239,.1)', border: '1px solid rgba(91,141,239,.3)', borderRadius: 6, color: '#5B8DEF', cursor: 'pointer', fontSize: 11 }}>Accepter</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Admin Stock ───────────────────────────────────────────────────────
function AdminStock() {
  const { api, toast } = useApp();
  const [stock, setStock] = useState<{ items: StockItem[]; alerts: StockItem[] }>({ items: [], alerts: [] });
  const [edits, setEdits] = useState<Record<number, number>>({});

  useEffect(() => { api.getStock().then(setStock); }, []);

  const save = async (id: number) => {
    const qty = edits[id];
    if (qty === undefined) return;
    await api.updateStock(id, qty);
    toast('✓ Stock mis à jour', 'success');
    api.getStock().then(setStock);
    setEdits(e => { const n={...e}; delete n[id]; return n; });
  };

  return (
    <div>
      <h2 style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 26, color: '#F2EFE9', marginBottom: 16 }}>📦 Stocks</h2>
      {stock.alerts.length > 0 && (
        <div style={{ background: 'rgba(224,82,82,.05)', border: '1px solid rgba(224,82,82,.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ color: '#E05252', fontSize: 12, fontWeight: 600, marginBottom: 5 }}>⚠ {stock.alerts.length} article(s) en stock critique</div>
          {stock.alerts.map(a => <div key={a.id} style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{a.name}: {a.quantity} {a.unit} (min: {a.minQuantity})</div>)}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {stock.items.map(item => {
          const alert = item.quantity <= item.minQuantity;
          return (
            <div key={item.id} style={{ background: '#0F0F0F', border: `1px solid ${alert?'rgba(224,82,82,.3)':'#1A1A1A'}`, borderRadius: 10, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13 }}>{item.name}</div>
                <div style={{ fontSize: 10, color: '#444', marginTop: 1 }}>Seuil min: {item.minQuantity} {item.unit}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="number" min="0" value={edits[item.id] ?? item.quantity} onChange={e => setEdits(p => ({...p,[item.id]:parseFloat(e.target.value)}))} style={{ width: 68, padding: '5px 8px', background: '#111', border: '1px solid #1A1A1A', borderRadius: 6, color: '#F2EFE9', fontSize: 13, textAlign: 'center', outline: 'none' }} />
                <span style={{ fontSize: 11, color: '#444' }}>{item.unit}</span>
                {edits[item.id] !== undefined && <button onClick={() => save(item.id)} style={{ padding: '4px 10px', background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.3)', borderRadius: 6, color: '#C9A84C', cursor: 'pointer', fontSize: 11 }}>✓</button>}
              </div>
              {alert && <span style={{ color: '#E05252', fontSize: 16 }}>⚠</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
