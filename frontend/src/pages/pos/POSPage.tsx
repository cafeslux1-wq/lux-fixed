// ─── CAFÉ LUX — POS Workspace ────────────────────────────────────────
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { CAFE } from '../../lib/constants';
import type { MenuCategory, MenuItem, CartItem } from '../../lib/types';

type PayMode = 'Especes' | 'CB' | 'Ticket R.' | 'Encaissement';

interface POSCart { item: MenuItem; qty: number }

export default function POSPage() {
  const { api, state, dispatch, toast } = useApp();
  const navigate = useNavigate();

  const [cats, setCats]         = useState<MenuCategory[]>([]);
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const [cart, setCart]         = useState<POSCart[]>([]);
  const [tableNum, setTableNum] = useState('');
  const [orderType, setOrderType] = useState<'table'|'takeaway'>('table');
  const [payMode, setPayMode]   = useState<PayMode>('Especes');
  const [notes, setNotes]       = useState('');
  const [loading, setLoading]   = useState(true);
  const [processing, setProcessing] = useState(false);
  const [search, setSearch]     = useState('');
  const [ticketVisible, setTicketVisible] = useState(false);
  const [lastTxId, setLastTxId] = useState<number | null>(null);

  useEffect(() => {
    api.getPublicMenu().then(data => {
      setCats(data);
      setActiveCat(data[0]?.id ?? null);
      setLoading(false);
    });
  }, []);

  // ── Cart helpers ─────────────────────────────────────────────────
  const addItem = useCallback((item: MenuItem) => {
    setCart(prev => {
      const ex = prev.find(c => c.item.id === item.id);
      return ex
        ? prev.map(c => c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c)
        : [...prev, { item, qty: 1 }];
    });
  }, []);

  const removeItem = useCallback((id: number) => {
    setCart(prev => {
      const ex = prev.find(c => c.item.id === id);
      if (!ex) return prev;
      return ex.qty > 1
        ? prev.map(c => c.item.id === id ? { ...c, qty: c.qty - 1 } : c)
        : prev.filter(c => c.item.id !== id);
    });
  }, []);

  const clearCart = () => { setCart([]); setNotes(''); setTableNum(''); };

  // ── Totals ───────────────────────────────────────────────────────
  const subtotal = cart.reduce((s, c) => s + c.item.price * c.qty, 0);
  const tva      = Math.round(subtotal * CAFE_TVA * 100) / 100;
  const total    = subtotal;

  // ── Pay ──────────────────────────────────────────────────────────
  const handlePay = async () => {
    if (!cart.length) { toast('Panier vide', 'error'); return; }
    setProcessing(true);

    const txId = Date.now();
    const now  = new Date();
    const tx = {
      id: txId,
      date: now.toLocaleDateString('fr-MA'),
      time: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      type: orderType,
      table: orderType === 'table' ? tableNum : null,
      items: cart.map(c => ({ n: c.item.name, p: c.item.price, q: c.qty })),
      subtotal: total.toFixed(2),
      total: total.toFixed(2),
      tva: tva.toFixed(2),
      mode: payMode,
      notes,
      staff: state.auth.user?.name ?? 'POS',
      source: 'pos',
    };

    try {
      await api.saveTransaction(tx);
      setLastTxId(txId);
      setTicketVisible(true);
      toast(`✓ ${total.toFixed(2)} MAD encaissé — ${payMode}`, 'success');
      clearCart();
    } catch {
      toast('Erreur lors de l\'enregistrement', 'error');
    } finally {
      setProcessing(false);
    }
  };

  // ── Products shown ───────────────────────────────────────────────
  const activeCatObj = cats.find(c => c.id === activeCat);
  const products = search
    ? cats.flatMap(c => c.products).filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase())
      )
    : (activeCatObj?.products ?? []);

  // ── TICKET PRINT MODAL ───────────────────────────────────────────
  if (ticketVisible && lastTxId) {
    const txs: any[] = JSON.parse(localStorage.getItem('lux_transactions') ?? '[]');
    const tx = txs.find(t => t.id === lastTxId);

    return (
      <div style={{ background: '#080808', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: '#fff', color: '#000', borderRadius: 12, padding: '24px', maxWidth: 320, width: '100%', fontFamily: 'monospace', fontSize: 12 }}>
          <div style={{ textAlign: 'center', borderBottom: '1px dashed #ccc', paddingBottom: 12, marginBottom: 12 }}>
            <div style={{ fontFamily: 'serif', fontSize: 20, fontWeight: 700, letterSpacing: 4 }}>✦ LUX</div>
            <div style={{ fontSize: 10, color: '#666' }}>Café & Pâtisserie · Taza</div>
            <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>{tx?.date} {tx?.time}</div>
          </div>
          {tx?.items.map((i: any, idx: number) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>{i.q}× {i.n.slice(0, 22)}</span>
              <span>{(i.p * i.q).toFixed(2)}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px dashed #ccc', marginTop: 10, paddingTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
              <span>TOTAL</span>
              <span>{tx?.total} MAD</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', marginTop: 4 }}>
              <span>{tx?.mode}</span>
              <span>TVA incl.: {tx?.tva} MAD</span>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: 14, fontSize: 10, color: '#aaa' }}>
            Merci et à bientôt!<br/>
            {CAFE.phone} · cafeslux.com
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={() => window.print()} style={{ flex: 1, padding: '10px', background: '#C9A84C', color: '#000', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
              🖨 Imprimer
            </button>
            <button onClick={() => setTicketVisible(false)} style={{ flex: 1, padding: '10px', background: '#f5f5f5', color: '#333', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              Fermer
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN POS UI ──────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100vh', background: '#080808', overflow: 'hidden' }}>

      {/* LEFT: Menu panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid #1A1A1A' }}>

        {/* POS Header */}
        <div style={{ background: '#0A0A0A', borderBottom: '1px solid #1A1A1A', padding: '0 16px', height: 52, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ fontFamily: '"Cinzel",serif', color: '#C9A84C', fontSize: 16, letterSpacing: 3 }}>✦ POS</div>
          <div style={{ flex: 1 }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Recherche rapide…"
              style={{ width: '100%', padding: '7px 12px', background: '#111', border: '1px solid #1A1A1A', borderRadius: 8, color: '#F2EFE9', fontSize: 12, outline: 'none' }}
            />
          </div>
          <button onClick={() => navigate('/admin')} style={{ padding: '6px 12px', background: 'none', border: '1px solid #1A1A1A', borderRadius: 8, color: '#555', cursor: 'pointer', fontSize: 11 }}>Admin</button>
          <button onClick={() => dispatch({ type: 'LOGOUT' })} style={{ padding: '6px 12px', background: 'none', border: '1px solid #1A1A1A', borderRadius: 8, color: '#555', cursor: 'pointer', fontSize: 11 }}>✕ Quitter</button>
        </div>

        {/* Category tabs */}
        {!search && (
          <div style={{ display: 'flex', gap: 4, padding: '8px 12px', overflowX: 'auto', flexShrink: 0, borderBottom: '1px solid #111', scrollbarWidth: 'none' }}>
            {cats.map(c => (
              <button key={c.id} onClick={() => setActiveCat(c.id)} style={{
                padding: '6px 14px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0,
                border: `1px solid ${activeCat === c.id ? '#C9A84C' : '#1A1A1A'}`,
                background: activeCat === c.id ? 'rgba(201,168,76,.1)' : 'transparent',
                color: activeCat === c.id ? '#C9A84C' : '#666',
                fontSize: 11, cursor: 'pointer',
              }}>
                {c.icon} {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Products grid */}
        <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
          {loading ? (
            <div style={{ color: '#555', textAlign: 'center', paddingTop: 40 }}>Chargement…</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 8 }}>
              {products.map(item => (
                <button
                  key={item.id}
                  onClick={() => addItem(item)}
                  style={{
                    background: '#0F0F0F', border: '1px solid #1A1A1A',
                    borderRadius: 10, padding: '12px 10px', cursor: 'pointer',
                    textAlign: 'left', transition: 'border-color .1s',
                    position: 'relative',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(201,168,76,.4)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#1A1A1A')}
                >
                  {item.isSignature && (
                    <div style={{ position: 'absolute', top: 6, right: 6, fontSize: 8, color: '#C9A84C' }}>✦</div>
                  )}
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#F2EFE9', marginBottom: 4, lineHeight: 1.3 }}>
                    {item.name}
                  </div>
                  <div style={{ fontFamily: '"Cormorant Garamond",serif', color: '#C9A84C', fontSize: 16 }}>
                    {item.price} MAD
                  </div>
                  {/* Cart qty badge */}
                  {cart.find(c => c.item.id === item.id) && (
                    <div style={{
                      position: 'absolute', bottom: 6, right: 6,
                      background: '#C9A84C', color: '#000',
                      width: 18, height: 18, borderRadius: '50%',
                      fontSize: 10, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {cart.find(c => c.item.id === item.id)?.qty}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Ticket/Cart panel */}
      <div style={{ width: 300, display: 'flex', flexDirection: 'column', background: '#0A0A0A' }}>

        {/* Order type + table */}
        <div style={{ padding: '12px', borderBottom: '1px solid #111', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {(['table','takeaway'] as const).map(t => (
              <button key={t} onClick={() => setOrderType(t)} style={{
                flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 11,
                border: `1px solid ${orderType === t ? '#C9A84C' : '#1A1A1A'}`,
                background: orderType === t ? 'rgba(201,168,76,.1)' : 'transparent',
                color: orderType === t ? '#C9A84C' : '#555', cursor: 'pointer',
              }}>
                {t === 'table' ? '🪑 Table' : '🎁 Emporter'}
              </button>
            ))}
          </div>
          {orderType === 'table' && (
            <input
              value={tableNum} onChange={e => setTableNum(e.target.value)}
              placeholder="N° table (ex: 5)"
              style={{ width: '100%', padding: '7px 10px', background: '#111', border: '1px solid #1A1A1A', borderRadius: 7, color: '#F2EFE9', fontSize: 12, outline: 'none' }}
            />
          )}
        </div>

        {/* Cart items */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#333', padding: '40px 0', fontSize: 12 }}>
              Appuyez sur un produit pour l'ajouter
            </div>
          ) : (
            cart.map(({ item, qty }) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #111' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{item.name}</div>
                  <div style={{ fontSize: 10, color: '#555' }}>{item.price} MAD</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button onClick={() => removeItem(item.id)} style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid #222', background: '#111', color: '#888', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                  <span style={{ fontSize: 13, fontWeight: 600, minWidth: 16, textAlign: 'center' }}>{qty}</span>
                  <button onClick={() => addItem(item)} style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid #222', background: '#111', color: '#C9A84C', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
                <div style={{ fontFamily: '"Cormorant Garamond",serif', color: '#C9A84C', fontSize: 14, minWidth: 52, textAlign: 'right' }}>
                  {(item.price * qty).toFixed(2)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Notes */}
        {cart.length > 0 && (
          <div style={{ padding: '0 12px 8px', flexShrink: 0 }}>
            <input
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Notes (sans sucre, allergie…)"
              style={{ width: '100%', padding: '7px 10px', background: '#111', border: '1px solid #1A1A1A', borderRadius: 7, color: '#F2EFE9', fontSize: 11, outline: 'none' }}
            />
          </div>
        )}

        {/* Totals + Pay */}
        <div style={{ borderTop: '1px solid #1A1A1A', padding: '12px', flexShrink: 0 }}>
          {cart.length > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#555', marginBottom: 4 }}>
                <span>Sous-total</span><span>{subtotal.toFixed(2)} MAD</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#555', marginBottom: 8 }}>
                <span>TVA 10%</span><span>{tva.toFixed(2)} MAD</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: '"Cormorant Garamond",serif', fontSize: 22, color: '#C9A84C', marginBottom: 10 }}>
                <span>TOTAL</span><span>{total.toFixed(2)} MAD</span>
              </div>

              {/* Payment mode */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                {(['Especes','CB','Ticket R.','Encaissement'] as PayMode[]).map(m => (
                  <button key={m} onClick={() => setPayMode(m)} style={{
                    padding: '7px 4px', borderRadius: 7, fontSize: 11,
                    border: `1px solid ${payMode === m ? '#C9A84C' : '#1A1A1A'}`,
                    background: payMode === m ? 'rgba(201,168,76,.1)' : '#0A0A0A',
                    color: payMode === m ? '#C9A84C' : '#555', cursor: 'pointer',
                  }}>{m}</button>
                ))}
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handlePay}
              disabled={!cart.length || processing}
              style={{
                flex: 1, padding: '13px', background: cart.length ? '#C9A84C' : '#1A1A1A',
                color: cart.length ? '#000' : '#333', border: 'none', borderRadius: 10,
                fontWeight: 700, fontSize: 15, cursor: cart.length ? 'pointer' : 'not-allowed',
              }}
            >
              {processing ? '⟳' : `✓ Encaisser`}
            </button>
            {cart.length > 0 && (
              <button onClick={clearCart} style={{ padding: '13px 12px', background: 'rgba(224,82,82,.08)', border: '1px solid rgba(224,82,82,.2)', borderRadius: 10, color: '#E05252', cursor: 'pointer', fontSize: 14 }}>
                ✕
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const CAFE_TVA = 0.10;
