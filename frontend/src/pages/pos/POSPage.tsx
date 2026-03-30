// ─── CAFÉ LUX — POSPortalPage (/portal/pos) ──────────────────────────
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { PORTAL, TVA } from '../../lib/constants';
import type { MenuCategory, MenuItem, POSTransaction } from '../../lib/types';

type PayMode = 'Especes' | 'CB' | 'Ticket R.' | 'Encaissement';

interface POSCart { item: MenuItem; qty: number }

export default function POSPortalPage() {
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
  const [lastTicket, setLastTicket] = useState<POSTransaction | null>(null);

  useEffect(() => {
    api.getPublicMenu().then(data => {
      setCats(data);
      setActiveCat(data[0]?.id ?? null);
      setLoading(false);
    });
  }, []);

  const addItem = useCallback((item: MenuItem) => {
    setCart(prev => {
      const ex = prev.find(c => c.item.id === item.id);
      return ex ? prev.map(c => c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c)
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

  // clearCart: resets cart + form only — does NOT touch lastTicket
  // Use resetAll() to also clear the ticket (for "Nouvelle commande")
  const clearCart = () => { setCart([]); setNotes(''); setTableNum(''); };
  const resetAll  = () => { clearCart(); setLastTicket(null); };

  const subtotal = cart.reduce((s, c) => s + c.item.price * c.qty, 0);
  const tva      = Math.round(subtotal * TVA * 100) / 100;
  const total    = subtotal;

  const handlePay = async () => {
    if (!cart.length) { toast('Panier vide', 'error'); return; }
    setProcessing(true);
    const now = new Date();
    const tx: POSTransaction = {
      id:       Date.now(),
      date:     now.toLocaleDateString('fr-MA'),
      time:     now.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }),
      type:     orderType,
      table:    orderType === 'table' ? tableNum : undefined,
      items:    cart.map(c => ({ n: c.item.name, p: c.item.price, q: c.qty })),
      subtotal: total.toFixed(2),
      total:    total.toFixed(2),
      tva:      tva.toFixed(2),
      mode:     payMode,
      notes,
      staff:    state.auth.user?.name ?? 'POS',
      source:   'pos',
    };
    try {
      await api.saveTransaction(tx);
      setLastTicket(tx);
      clearCart();   // clear cart only — ticket stays visible until "Nouvelle commande"
      toast(`✓ ${total.toFixed(2)} MAD — ${payMode}`, 'success');
    } catch {
      toast('Erreur enregistrement', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const activeProducts = search
    ? cats.flatMap(c => c.products).filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : (cats.find(c => c.id === activeCat)?.products ?? []);

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#080808', overflow: 'hidden' }}>

      {/* LEFT: Menu */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid #0D0D0D' }}>
        {/* Header */}
        <div style={{ background: '#0A0A0A', borderBottom: '1px solid #0D0D0D', padding: '0 14px', height: 50, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ fontFamily: '"Cinzel",serif', color: '#C9A84C', fontSize: 16, letterSpacing: 3 }}>✦ POS</div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Recherche…" style={{ flex: 1, padding: '6px 10px', background: '#111', border: '1px solid #111', borderRadius: 7, color: '#F2EFE9', fontSize: 12, outline: 'none' }} />
          <button onClick={() => navigate(PORTAL.admin)} style={{ padding: '5px 10px', background: 'none', border: '1px solid #111', borderRadius: 7, color: '#444', cursor: 'pointer', fontSize: 11 }}>Admin</button>
          <button onClick={() => dispatch({ type: 'LOGOUT' })} style={{ padding: '5px 10px', background: 'none', border: '1px solid #111', borderRadius: 7, color: '#444', cursor: 'pointer', fontSize: 11 }}>✕</button>
        </div>

        {/* Categories */}
        {!search && (
          <div style={{ display: 'flex', gap: 4, padding: '7px 12px', overflowX: 'auto', flexShrink: 0, borderBottom: '1px solid #0D0D0D', scrollbarWidth: 'none' }}>
            {cats.map(c => (
              <button key={c.id} onClick={() => setActiveCat(c.id)} style={{ padding: '5px 12px', borderRadius: 18, whiteSpace: 'nowrap', flexShrink: 0, border: `1px solid ${activeCat===c.id?'#C9A84C':'#111'}`, background: activeCat===c.id?'rgba(201,168,76,.1)':'transparent', color: activeCat===c.id?'#C9A84C':'#555', fontSize: 11, cursor: 'pointer' }}>
                {c.icon} {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Products */}
        <div style={{ flex: 1, overflow: 'auto', padding: '10px 12px' }}>
          {loading ? (
            <div style={{ color: '#333', textAlign: 'center', paddingTop: 40 }}>Chargement…</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 7 }}>
              {activeProducts.map(item => {
                const inCart = cart.find(c => c.item.id === item.id);
                return (
                  <button key={item.id} onClick={() => addItem(item)} style={{ background: '#0F0F0F', border: '1px solid #1A1A1A', borderRadius: 9, padding: '10px 8px', cursor: 'pointer', textAlign: 'left', position: 'relative', transition: 'border-color .1s' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor='rgba(201,168,76,.4)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor='#1A1A1A')}
                  >
                    {item.isSignature && <div style={{ position: 'absolute', top: 4, right: 4, fontSize: 8, color: '#C9A84C' }}>✦</div>}
                    <div style={{ fontSize: 11, fontWeight: 500, color: '#F2EFE9', marginBottom: 3, lineHeight: 1.3 }}>{item.name}</div>
                    <div style={{ fontFamily: '"Cormorant Garamond",serif', color: '#C9A84C', fontSize: 14 }}>{item.price} MAD</div>
                    {inCart && (
                      <div style={{ position: 'absolute', bottom: 4, right: 4, background: '#C9A84C', color: '#000', width: 16, height: 16, borderRadius: '50%', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {inCart.qty}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Ticket */}
      <div style={{ width: 290, display: 'flex', flexDirection: 'column', background: '#0A0A0A' }}>
        {/* Order type */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid #0D0D0D', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            {(['table','takeaway'] as const).map(t => (
              <button key={t} onClick={() => setOrderType(t)} style={{ flex: 1, padding: '6px 0', borderRadius: 7, fontSize: 11, border: `1px solid ${orderType===t?'#C9A84C':'#111'}`, background: orderType===t?'rgba(201,168,76,.1)':'transparent', color: orderType===t?'#C9A84C':'#444', cursor: 'pointer' }}>
                {t==='table'?'🪑 Table':'🎁 Emporter'}
              </button>
            ))}
          </div>
          {orderType === 'table' && (
            <input value={tableNum} onChange={e => setTableNum(e.target.value)} placeholder="N° table" style={{ width: '100%', padding: '6px 10px', background: '#111', border: '1px solid #111', borderRadius: 7, color: '#F2EFE9', fontSize: 12, outline: 'none' }} />
          )}
        </div>

        {/* Cart */}
        <div style={{ flex: 1, overflow: 'auto', padding: '6px 12px' }}>
          {lastTicket ? (
            <div style={{ textAlign: 'center', padding: '20px 10px' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
              <div style={{ fontFamily: '"Cormorant Garamond",serif', color: '#C9A84C', fontSize: 18, marginBottom: 4 }}>Encaissé!</div>
              <div style={{ fontSize: 12, color: '#555', marginBottom: 16 }}>{lastTicket.total} MAD · {lastTicket.mode}</div>
              <button onClick={() => window.print()} style={{ width: '100%', padding: '8px', background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.3)', borderRadius: 8, color: '#C9A84C', cursor: 'pointer', fontSize: 12, marginBottom: 6 }}>🖨 Imprimer ticket</button>
              <button onClick={resetAll} style={{ width: '100%', padding: '8px', background: 'none', border: '1px solid #111', borderRadius: 8, color: '#555', cursor: 'pointer', fontSize: 12 }}>Nouvelle commande</button>
            </div>
          ) : cart.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#222', padding: '40px 0', fontSize: 12 }}>Appuyez sur un produit</div>
          ) : (
            cart.map(({ item, qty }) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', borderBottom: '1px solid #0D0D0D' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 500 }}>{item.name}</div>
                  <div style={{ fontSize: 10, color: '#444' }}>{item.price} MAD</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button onClick={() => removeItem(item.id)} style={{ width: 20, height: 20, borderRadius: '50%', border: '1px solid #1A1A1A', background: '#111', color: '#777', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                  <span style={{ fontSize: 12, fontWeight: 600, minWidth: 14, textAlign: 'center' }}>{qty}</span>
                  <button onClick={() => addItem(item)} style={{ width: 20, height: 20, borderRadius: '50%', border: '1px solid #1A1A1A', background: '#111', color: '#C9A84C', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
                <div style={{ fontFamily: '"Cormorant Garamond",serif', color: '#C9A84C', fontSize: 13, minWidth: 50, textAlign: 'right' }}>
                  {(item.price*qty).toFixed(2)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Notes */}
        {cart.length > 0 && !lastTicket && (
          <div style={{ padding: '0 12px 6px', flexShrink: 0 }}>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes…" style={{ width: '100%', padding: '6px 10px', background: '#111', border: '1px solid #111', borderRadius: 7, color: '#F2EFE9', fontSize: 11, outline: 'none' }} />
          </div>
        )}

        {/* Footer */}
        {!lastTicket && (
          <div style={{ borderTop: '1px solid #0D0D0D', padding: '10px 12px', flexShrink: 0 }}>
            {cart.length > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#444', marginBottom: 2 }}><span>Sous-total</span><span>{subtotal.toFixed(2)} MAD</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#444', marginBottom: 6 }}><span>TVA 10%</span><span>{tva.toFixed(2)} MAD</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: '"Cormorant Garamond",serif', fontSize: 20, color: '#C9A84C', marginBottom: 8 }}><span>TOTAL</span><span>{total.toFixed(2)} MAD</span></div>
                {/* Pay modes */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 8 }}>
                  {(['Especes','CB','Ticket R.','Encaissement'] as PayMode[]).map(m => (
                    <button key={m} onClick={() => setPayMode(m)} style={{ padding: '6px 4px', borderRadius: 7, fontSize: 10, border: `1px solid ${payMode===m?'#C9A84C':'#111'}`, background: payMode===m?'rgba(201,168,76,.1)':'#0A0A0A', color: payMode===m?'#C9A84C':'#444', cursor: 'pointer' }}>{m}</button>
                  ))}
                </div>
              </>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={handlePay} disabled={!cart.length||processing} style={{ flex: 1, padding: '12px', background: cart.length?'#C9A84C':'#111', color: cart.length?'#000':'#333', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: cart.length?'pointer':'not-allowed' }}>
                {processing?'⟳':'✓ Encaisser'}
              </button>
              {cart.length > 0 && (
                <button onClick={resetAll} style={{ padding: '12px 10px', background: 'rgba(224,82,82,.07)', border: '1px solid rgba(224,82,82,.2)', borderRadius: 9, color: '#E05252', cursor: 'pointer', fontSize: 14 }}>✕</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
