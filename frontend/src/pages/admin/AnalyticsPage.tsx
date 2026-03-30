// ─── CAFÉ LUX — Analytics Page ───────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { useApp } from '../../lib/store';

export default function AnalyticsPage() {
  const { api } = useApp();
  const [data, setData]     = useState<any>(null);
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getAnalytics(period).then(d => { setData(d); setLoading(false); });
  }, [period]);

  // Local fallback from localStorage
  const localTxs    = JSON.parse(localStorage.getItem('lux_transactions')    ?? '[]') as any[];
  const localOrders = JSON.parse(localStorage.getItem('lux_web_orders')      ?? '[]') as any[];
  const localCusts  = JSON.parse(localStorage.getItem('lux_web_customers')   ?? '{}') as Record<string, any>;

  const totalCA     = localTxs.reduce((s: number, t: any) => s + parseFloat(t.total ?? 0), 0)
                    + localOrders.reduce((s: number, o: any) => s + parseFloat(o.total ?? 0), 0);
  const totalOrders = localTxs.length + localOrders.length;
  const avgTicket   = totalOrders ? totalCA / totalOrders : 0;
  const custCount   = Object.keys(localCusts).length;

  const kpis = data ? [
    { label: 'CA Total',           val: `${(data.totalCA ?? totalCA).toFixed(0)} MAD` },
    { label: 'Commandes',          val: data.totalOrders ?? totalOrders },
    { label: 'Ticket moyen',       val: `${(data.avgTicket ?? avgTicket).toFixed(1)} MAD` },
    { label: 'Clients fidélité',   val: data.customerCount ?? custCount },
  ] : [
    { label: 'CA Total (local)',   val: `${totalCA.toFixed(0)} MAD` },
    { label: 'Commandes (local)',  val: totalOrders },
    { label: 'Ticket moyen',       val: `${avgTicket.toFixed(1)} MAD` },
    { label: 'Clients fidélité',   val: custCount },
  ];

  // Top products from local
  const prodMap: Record<string, number> = {};
  localTxs.forEach((t: any) => (t.items ?? []).forEach((i: any) => { prodMap[i.n] = (prodMap[i.n] ?? 0) + i.p * i.q; }));
  const topProds = Object.entries(prodMap).sort((a,b) => b[1]-a[1]).slice(0, 6);
  const maxProd  = topProds[0]?.[1] ?? 1;

  return (
    <div style={{ background: '#080808', minHeight: '100vh', padding: '24px 20px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 28, color: '#C9A84C' }}>📊 Analytics LUX</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['7d','30d','90d'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: '5px 14px', borderRadius: 16, fontSize: 11, cursor: 'pointer',
              border: `1px solid ${period === p ? '#C9A84C' : '#1A1A1A'}`,
              background: period === p ? 'rgba(201,168,76,.1)' : 'none',
              color: period === p ? '#C9A84C' : '#555',
            }}>{p}</button>
          ))}
        </div>
      </div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12, marginBottom: 24 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: '#0F0F0F', border: '1px solid #1A1A1A', borderRadius: 12, padding: '16px' }}>
            <div style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 30, color: '#C9A84C' }}>{k.val}</div>
            <div style={{ fontSize: 10, color: '#555', marginTop: 4, textTransform: 'uppercase', letterSpacing: .5 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Top products */}
      {topProds.length > 0 && (
        <div style={{ background: '#0F0F0F', border: '1px solid #1A1A1A', borderRadius: 14, padding: '18px', marginBottom: 16 }}>
          <div style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 20, color: '#F2EFE9', marginBottom: 14 }}>
            🏆 Top Produits
          </div>
          {topProds.map(([name, ca]) => (
            <div key={name} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: '#AAA' }}>{name.slice(0, 28)}</span>
                <span style={{ color: '#C9A84C' }}>{ca.toFixed(0)} MAD</span>
              </div>
              <div style={{ height: 4, background: '#111', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${ca/maxProd*100}%`, background: 'linear-gradient(90deg,#8B6E2F,#C9A84C)', transition: 'width .6s ease', borderRadius: 2 }}/>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Note if using local data */}
      {!data && (
        <div style={{ fontSize: 11, color: '#444', textAlign: 'center', marginTop: 20 }}>
          ⚠ Analytics depuis localStorage — Connectez l'API Railway pour des données en temps réel
        </div>
      )}
    </div>
  );
}
