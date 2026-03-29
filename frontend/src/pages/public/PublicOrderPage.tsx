// ─── CAFÉ LUX — PublicOrderPage (/order) ─────────────────────────────
// Canonical order entry — replaces /cart. Includes menu browsing → checkout.
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar, BottomNav } from '../../components/layout/Navbar';
import { MenuCard } from '../../components/menu/MenuCard';
import { useApp } from '../../lib/store';
import { DELIVERY } from '../../lib/constants';
import type { OrderType, MenuCategory } from '../../lib/types';

type Step = 'browse' | 'checkout' | 'payment' | 'done';
type PayMode = 'cash' | 'card' | 'gift';

export default function PublicOrderPage() {
  const { state, dispatch, api, toast, cart, cartTotal, cartQty, cartDiscount, cartDeliveryFee, cartGrandTotal } = useApp();
  const navigate = useNavigate();

  const [step, setStep]           = useState<Step>(cart.length ? 'checkout' : 'browse');
  const [cats, setCats]           = useState<MenuCategory[]>(state.menuCategories);
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const [loading, setLoading]     = useState(!state.menuCategories.length);
  const [search, setSearch]       = useState('');
  const [name, setName]           = useState('');
  const [phone, setPhone]         = useState('');
  const [address, setAddress]     = useState('');
  const [notes, setNotes]         = useState('');
  const [orderType, setOrderType] = useState<OrderType>(state.orderType);
  const [couponCode, setCouponCode] = useState('');
  const [payMode, setPayMode]     = useState<PayMode>('cash');
  const [gcCode, setGcCode]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [orderId, setOrderId]     = useState<number | null>(null);

  useEffect(() => {
    // Load cached phone
    const ph = localStorage.getItem('lux_my_phone');
    if (ph) setPhone(ph);
    // Reload menu
    api.getPublicMenu().then(data => {
      setCats(data);
      dispatch({ type: 'SET_MENU', payload: { cats: data, ts: Date.now() } });
      setActiveCat(data[0]?.id ?? null);
      setLoading(false);
    });
  }, []);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    const res = await api.validateCoupon(couponCode.trim(), cartTotal);
    if (res.valid && res.coupon) {
      dispatch({ type: 'COUPON_APPLY', payload: res.coupon });
      toast(`🎉 ${res.coupon.label}`, 'success');
      setCouponCode('');
    } else {
      toast(res.error ?? 'Code invalide', 'error');
    }
  };

  const handleSubmitOrder = async () => {
    if (!name.trim() || !phone.trim()) { toast('Nom et téléphone requis', 'error'); return; }
    if (orderType === 'delivery' && !address.trim()) { toast('Adresse requise pour la livraison', 'error'); return; }

    if (payMode === 'gift' && gcCode.trim()) {
      const gc = await api.checkGiftCard(gcCode.trim());
      if (!gc || gc.status !== 'active') { toast('Carte cadeau invalide', 'error'); return; }
      if (gc.balance < cartGrandTotal) { toast(`Solde insuffisant: ${gc.balance} MAD`, 'error'); return; }
    }

    setSubmitting(true);
    try {
      const order = await api.createOrder({
        customer:    name,
        phone,
        type:        orderType,
        address:     orderType === 'delivery' ? address : '',
        notes,
        items:       cart.map(c => ({ name: c.item.name, price: c.item.price, qty: c.qty })),
        subtotal:    cartTotal,
        deliveryFee: cartDeliveryFee,
        discount:    cartDiscount,
        total:       cartGrandTotal,
        payMethod:   payMode,
        tableNum:    state.tableNum,
        couponCode:  state.activeCoupon?.code,
      });
      setOrderId(order.id);
      localStorage.setItem('lux_my_phone', phone);
      dispatch({ type: 'CART_CLEAR' });
      setStep('done');
      toast('✓ Commande confirmée!', 'success');
    } catch {
      toast('Erreur lors de la commande, réessayez', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Products for current view ──────────────────────────────────────
  const filteredCats = cats.map(c => ({
    ...c,
    products: search
      ? c.products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
      : c.products,
  })).filter(c => c.products.length > 0);

  const activeProducts = search
    ? filteredCats.flatMap(c => c.products)
    : (cats.find(c => c.id === activeCat)?.products ?? []);

  // ═══════════════════════════════════════════════════════
  //  STEP: DONE
  // ═══════════════════════════════════════════════════════
  if (step === 'done') {
    return (
      <div style={{ background: '#080808', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 380 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
          <div style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 30, color: '#C9A84C', marginBottom: 8 }}>Commande confirmée!</div>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>Réf: #{orderId}</div>
          {orderType === 'delivery' && (
            <div style={{ background: 'rgba(61,190,122,.06)', border: '1px solid rgba(61,190,122,.2)', borderRadius: 10, padding: '12px', marginBottom: 16, fontSize: 13, color: '#3DBE7A' }}>
              🛵 Livraison estimée: {DELIVERY.etaMin}–{DELIVERY.etaMax} min
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
            <button onClick={() => navigate('/track')} style={{ padding: '12px 24px', background: '#C9A84C', color: '#000', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
              Suivre ma commande
            </button>
            <button onClick={() => navigate('/')} style={{ padding: '12px 24px', background: 'none', border: '1px solid #1A1A1A', color: '#777', borderRadius: 8, cursor: 'pointer' }}>
              Accueil
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#080808', minHeight: '100vh', paddingBottom: 80 }}>
      <Navbar />

      {/* ── Step indicator ─────────────────────────────────────── */}
      <div style={{ display: 'flex', borderBottom: '1px solid #111' }}>
        {([
          ['browse',   '1. Menu'],
          ['checkout', '2. Livraison'],
          ['payment',  '3. Paiement'],
        ] as [Step, string][]).map(([s, label]) => (
          <button key={s} onClick={() => cart.length > 0 && setStep(s)} style={{
            flex: 1, padding: '13px 8px', background: 'none', border: 'none',
            borderBottom: `2px solid ${step === s ? '#C9A84C' : 'transparent'}`,
            color: step === s ? '#C9A84C' : '#555',
            fontSize: 12, cursor: cart.length > 0 ? 'pointer' : 'default',
          }}>{label}</button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════
           STEP 1: BROWSE MENU
         ═══════════════════════════════════════════════════════ */}
      {step === 'browse' && (
        <>
          {/* Category + search strip */}
          <div style={{ position: 'sticky', top: 58, zIndex: 40, background: 'rgba(8,8,8,.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #111', padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Recherche rapide…"
              style={{ padding: '8px 14px', background: '#0F0F0F', border: '1px solid #1A1A1A', borderRadius: 8, color: '#F2EFE9', fontSize: 12, outline: 'none' }}
            />
            {!search && (
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
                {cats.map(c => (
                  <button key={c.id} onClick={() => setActiveCat(c.id)} style={{
                    padding: '5px 14px', borderRadius: 16, whiteSpace: 'nowrap',
                    border: `1px solid ${activeCat === c.id ? '#C9A84C' : '#1A1A1A'}`,
                    background: activeCat === c.id ? 'rgba(201,168,76,.1)' : 'transparent',
                    color: activeCat === c.id ? '#C9A84C' : '#666',
                    fontSize: 11, cursor: 'pointer',
                  }}>{c.icon} {c.name}</button>
                ))}
              </div>
            )}
          </div>

          <div style={{ padding: '12px 14px', maxWidth: 900, margin: '0 auto' }}>
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, paddingTop: 8 }}>
                {Array.from({length: 6}).map((_,i) => (
                  <div key={i} style={{ background: '#0F0F0F', borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ paddingTop: '66%', background: 'linear-gradient(90deg,#111 25%,#1A1A1A 50%,#111 75%)', backgroundSize: '200%', animation: 'shimmer 1.4s infinite' }}/>
                    <div style={{ padding: '12px 14px' }}>
                      <div style={{ height: 13, background: '#1A1A1A', borderRadius: 4, marginBottom: 6 }}/>
                      <div style={{ height: 10, background: '#111', borderRadius: 4, width: '60%' }}/>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {search ? (
                  // Search results — flat grid
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, paddingTop: 8 }}>
                    {activeProducts.map(item => <MenuCard key={item.id} item={item} />)}
                  </div>
                ) : (
                  // Single category view
                  <div>
                    {activeCat && (
                      <div style={{ paddingTop: 10 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
                          {activeProducts.map(item => <MenuCard key={item.id} item={item} />)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Floating cart button */}
          {cartQty > 0 && (
            <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 60 }}>
              <button onClick={() => setStep('checkout')} style={{
                padding: '13px 32px', background: '#C9A84C', color: '#000', border: 'none',
                borderRadius: 30, fontWeight: 700, fontSize: 15, cursor: 'pointer',
                boxShadow: '0 4px 24px rgba(201,168,76,.4)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{ background: 'rgba(0,0,0,.2)', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>{cartQty}</span>
                Valider — {cartGrandTotal.toFixed(2)} MAD →
              </button>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
           STEP 2: CHECKOUT (delivery + customer info)
         ═══════════════════════════════════════════════════════ */}
      {step === 'checkout' && (
        <div style={{ padding: '20px 16px', maxWidth: 560, margin: '0 auto' }}>
          {/* Cart summary */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 20, color: '#F2EFE9', marginBottom: 12 }}>Récapitulatif</div>
            {cart.map(({ item, qty }) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #111' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button onClick={() => dispatch({ type: 'CART_REMOVE', payload: item.id })} style={qtyBtn}>−</button>
                  <span style={{ fontSize: 13, fontWeight: 600, minWidth: 18, textAlign: 'center' }}>{qty}</span>
                  <button onClick={() => dispatch({ type: 'CART_ADD', payload: item })} style={qtyBtn}>+</button>
                </div>
                <div style={{ fontFamily: '"Cormorant Garamond",serif', color: '#C9A84C', fontSize: 15, minWidth: 60, textAlign: 'right' }}>
                  {(item.price * qty).toFixed(2)}
                </div>
              </div>
            ))}

            {/* Coupon */}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <input value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())} placeholder="CODE PROMO" style={{ flex: 1, padding: '8px 12px', background: '#0F0F0F', border: '1px solid #1A1A1A', borderRadius: 8, color: '#F2EFE9', fontSize: 12, letterSpacing: 1, outline: 'none' }} />
              <button onClick={applyCoupon} style={{ padding: '8px 14px', background: 'transparent', border: '1px solid rgba(201,168,76,.35)', borderRadius: 8, color: '#C9A84C', fontSize: 12, cursor: 'pointer' }}>Appliquer</button>
            </div>
            {state.activeCoupon && (
              <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', background: 'rgba(61,190,122,.06)', border: '1px solid rgba(61,190,122,.15)', borderRadius: 8, padding: '7px 12px', fontSize: 11, color: '#3DBE7A' }}>
                🎉 {state.activeCoupon.label}
                <button onClick={() => dispatch({ type: 'COUPON_CLEAR' })} style={{ background: 'none', border: 'none', color: '#3DBE7A', cursor: 'pointer' }}>✕</button>
              </div>
            )}
          </div>

          {/* Order type */}
          <div style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 20, color: '#F2EFE9', marginBottom: 12 }}>Type de commande</div>
          {([
            { t:'table'    as OrderType, icon:'🪑', label:'Sur place',  sub:`Table #${state.tableNum ?? '?'}` },
            { t:'takeaway' as OrderType, icon:'🎁', label:'À emporter', sub:'Prêt en ~10 min' },
            { t:'delivery' as OrderType, icon:'🛵', label:'Livraison',  sub:`${DELIVERY.fee} MAD · Gratuit >200 MAD · ${DELIVERY.etaMin}-${DELIVERY.etaMax} min` },
          ]).map(o => (
            <div key={o.t} onClick={() => { setOrderType(o.t); dispatch({ type: 'CART_SET_TYPE', payload: o.t }); }} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 10, cursor: 'pointer', marginBottom: 8,
              border: `2px solid ${orderType === o.t ? '#C9A84C' : '#1A1A1A'}`,
              background: orderType === o.t ? 'rgba(201,168,76,.06)' : '#0F0F0F', transition: '.12s',
            }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>{o.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{o.label}</div>
                <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{o.sub}</div>
              </div>
              {orderType === o.t && <span style={{ color: '#C9A84C', fontSize: 16 }}>✓</span>}
            </div>
          ))}

          {/* Customer info */}
          <div style={{ marginTop: 20 }}>
            <Fld label="Nom *" value={name} onChange={setName} placeholder="Ahmed Benjelloun" />
            <Fld label="Téléphone *" value={phone} onChange={setPhone} placeholder="+212 6XX XXX XXX" type="tel" />
            {orderType === 'delivery' && <Fld label="Adresse *" value={address} onChange={setAddress} placeholder="Rue, quartier, Taza" />}
            <Fld label="Notes" value={notes} onChange={setNotes} placeholder="Sans sucre, allergie…" />
          </div>

          {/* Totals */}
          <div style={{ background: '#0F0F0F', border: '1px solid #1A1A1A', borderRadius: 10, padding: '14px', marginTop: 16 }}>
            <Row label="Sous-total"    val={`${cartTotal.toFixed(2)} MAD`} />
            {cartDeliveryFee > 0 && <Row label="Livraison"   val={`+${cartDeliveryFee.toFixed(2)} MAD`} />}
            {cartDiscount > 0    && <Row label="Réduction"   val={`-${cartDiscount.toFixed(2)} MAD`} green />}
            <Row label="Total"         val={`${cartGrandTotal.toFixed(2)} MAD`} bold />
          </div>

          <button onClick={() => setStep('payment')} style={{ width: '100%', padding: '14px', background: '#C9A84C', color: '#000', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer', marginTop: 16 }}>
            Choisir le paiement →
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
           STEP 3: PAYMENT
         ═══════════════════════════════════════════════════════ */}
      {step === 'payment' && (
        <div style={{ padding: '20px 16px', maxWidth: 560, margin: '0 auto' }}>
          <div style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 22, color: '#F2EFE9', marginBottom: 16 }}>Mode de paiement</div>

          {([
            { id:'cash' as PayMode, icon:'💵', label:'Espèces',       sub: orderType==='delivery' ? 'À la livraison' : 'En caisse' },
            { id:'card' as PayMode, icon:'💳', label:'Carte bancaire', sub:'CMI · Visa · Mastercard' },
            { id:'gift' as PayMode, icon:'🎁', label:'Carte cadeau',   sub:'Code LUX-XXXX' },
          ]).map(o => (
            <div key={o.id} onClick={() => setPayMode(o.id)} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 10, cursor: 'pointer', marginBottom: 8,
              border: `2px solid ${payMode === o.id ? '#C9A84C' : '#1A1A1A'}`,
              background: payMode === o.id ? 'rgba(201,168,76,.06)' : '#0F0F0F', transition: '.12s',
            }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>{o.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{o.label}</div>
                <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{o.sub}</div>
              </div>
              {payMode === o.id && <span style={{ color: '#C9A84C', fontSize: 16 }}>✓</span>}
            </div>
          ))}

          {payMode === 'gift' && (
            <input value={gcCode} onChange={e => setGcCode(e.target.value.toUpperCase())} placeholder="LUX-XXXX" style={{ width: '100%', padding: '11px 14px', background: '#0F0F0F', border: '1px solid rgba(201,168,76,.3)', borderRadius: 8, color: '#F2EFE9', fontSize: 14, letterSpacing: 2, outline: 'none', textAlign: 'center', marginBottom: 12 }} />
          )}

          <div style={{ background: '#0F0F0F', border: '1px solid #1A1A1A', borderRadius: 10, padding: '14px', marginBottom: 16 }}>
            <Row label="Total" val={`${cartGrandTotal.toFixed(2)} MAD`} bold />
            <div style={{ fontSize: 10, color: '#555', marginTop: 4 }}>{name} · {phone}</div>
          </div>

          <button onClick={handleSubmitOrder} disabled={submitting} style={{ width: '100%', padding: '14px', background: '#C9A84C', color: '#000', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}>
            {submitting ? '⟳ En cours…' : `✓ Confirmer — ${cartGrandTotal.toFixed(2)} MAD`}
          </button>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────
function Row({ label, val, green, bold }: { label: string; val: string; green?: boolean; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', fontWeight: bold ? 600 : 400 }}>
      <span style={{ color: '#666' }}>{label}</span>
      <span style={{ color: green ? '#3DBE7A' : bold ? '#C9A84C' : '#F2EFE9' }}>{val}</span>
    </div>
  );
}

function Fld({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ width: '100%', padding: '10px 14px', background: '#0F0F0F', border: '1px solid #1A1A1A', borderRadius: 8, color: '#F2EFE9', fontSize: 13, outline: 'none' }} />
    </div>
  );
}

const qtyBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: '50%', border: '1px solid #1A1A1A',
  background: '#111', color: '#AAA', cursor: 'pointer', fontSize: 16,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
