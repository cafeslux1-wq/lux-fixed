// ─── CAFÉ LUX — Public Pages (Tracking, Reserve, Account, GiftCard) ──
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar, BottomNav } from '../../components/layout/Navbar';
import { useApp } from '../../lib/store';
import { CAFE } from '../../lib/constants';
import type { Order, Reservation, Review } from '../../lib/types';

// ─────────────────────────────────────────────────────────────────────
//  TrackingPage
// ─────────────────────────────────────────────────────────────────────
export function TrackingPage() {
  const { api } = useApp();
  const [phone, setPhone]     = useState('');
  const [orders, setOrders]   = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    const cust = await api.getCustomer(phone.trim());
    const allOrders = await api.getOrders({ limit: '30' });
    setOrders(allOrders.filter(o => o.phone === phone.trim()));
    setSearched(true);
    setLoading(false);
  };

  const STATUS_LABELS: Record<string, { label: string; color: string; icon: string }> = {
    pending:   { label: 'En attente',     color: '#888',    icon: '⏳' },
    accepted:  { label: 'Acceptée',       color: '#5B8DEF', icon: '✓'  },
    preparing: { label: 'En préparation', color: '#C9A84C', icon: '👨‍🍳' },
    ready:     { label: 'Prête',          color: '#3DBE7A', icon: '✅'  },
    delivered: { label: 'Livrée',         color: '#3DBE7A', icon: '🛵'  },
    done:      { label: 'Terminée',       color: '#3DBE7A', icon: '✓'  },
    cancelled: { label: 'Annulée',        color: '#E05252', icon: '✕'  },
  };

  return (
    <div style={{ background: '#080808', minHeight: '100vh', paddingBottom: 80 }}>
      <Navbar />
      <div style={{ padding: '24px 16px', maxWidth: 560, margin: '0 auto' }}>
        <h1 style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 28, color: '#C9A84C', marginBottom: 6 }}>
          📍 Suivi de commande
        </h1>
        <p style={{ fontSize: 12, color: '#666', marginBottom: 24 }}>
          Entrez votre numéro de téléphone pour voir vos commandes.
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+212 6XX XXX XXX"
            type="tel"
            onKeyDown={e => e.key === 'Enter' && search()}
            style={{ flex: 1, padding: '11px 14px', background: '#0F0F0F', border: '1px solid #1A1A1A', borderRadius: 8, color: '#F2EFE9', fontSize: 13, outline: 'none' }}
          />
          <button onClick={search} disabled={loading} style={{ padding: '11px 20px', background: '#C9A84C', color: '#000', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
            {loading ? '⟳' : 'Chercher'}
          </button>
        </div>

        {searched && orders.length === 0 && (
          <div style={{ textAlign: 'center', color: '#555', padding: '40px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
            Aucune commande trouvée pour ce numéro.
          </div>
        )}

        {orders.map(order => {
          const s = STATUS_LABELS[order.status] ?? STATUS_LABELS.pending;
          return (
            <div key={order.id} style={{ background: '#0F0F0F', border: '1px solid #1A1A1A', borderRadius: 12, padding: '16px', marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontFamily: '"Cormorant Garamond",serif', color: '#C9A84C', fontSize: 16 }}>
                  #{String(order.id).slice(-6)}
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: s.color, background: `${s.color}18`, padding: '3px 10px', borderRadius: 10 }}>
                  {s.icon} {s.label}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>
                {order.date} à {order.time} · {order.type}
              </div>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
                {order.items.map(i => `${i.qty}x ${i.name}`).join(', ')}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#555' }}>{order.payMethod}</span>
                <span style={{ fontFamily: '"Cormorant Garamond",serif', color: '#C9A84C', fontSize: 16 }}>
                  {order.total} MAD
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <BottomNav />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  ReservePage
// ─────────────────────────────────────────────────────────────────────
export function ReservePage() {
  const { api, toast } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', phone: '', date: '', time: '', guests: 2, notes: '' });
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);

  const SLOTS = ['07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
                 '12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30',
                 '17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30'];

  const upd = (k: keyof typeof form, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    const { name, phone, date, time } = form;
    if (!name || !phone || !date || !time) { toast('Tous les champs obligatoires', 'error'); return; }
    setLoading(true);
    try {
      await api.createReservation({ ...form });
      setDone(true);
      toast('✓ Réservation confirmée!', 'success');
    } catch {
      toast('Créneau indisponible, choisissez un autre.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div style={{ background: '#080808', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>🪑</div>
          <div style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 26, color: '#C9A84C', marginBottom: 8 }}>Table réservée!</div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 20 }}>
            {form.date} à {form.time} · {form.guests} personne(s)<br/>
            Nous vous attendons chez Café LUX!
          </div>
          <button onClick={() => navigate('/')} style={{ padding: '12px 28px', background: '#C9A84C', color: '#000', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#080808', minHeight: '100vh', paddingBottom: 80 }}>
      <Navbar />
      <div style={{ padding: '24px 16px', maxWidth: 500, margin: '0 auto' }}>
        <h1 style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 28, color: '#C9A84C', marginBottom: 6 }}>
          📅 Réserver une table
        </h1>
        <p style={{ fontSize: 12, color: '#666', marginBottom: 24 }}>{CAFE.hours} · 7j/7</p>

        <F label="Nom complet *">
          <input value={form.name} onChange={e => upd('name', e.target.value)} placeholder="Ahmed Benjelloun" style={inputS} />
        </F>
        <F label="Téléphone *">
          <input value={form.phone} onChange={e => upd('phone', e.target.value)} type="tel" placeholder="+212 6XX XXX XXX" style={inputS} />
        </F>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <F label="Date *">
            <input value={form.date} onChange={e => upd('date', e.target.value)} type="date" min={new Date().toISOString().split('T')[0]} style={inputS} />
          </F>
          <F label="Heure *">
            <select value={form.time} onChange={e => upd('time', e.target.value)} style={inputS}>
              <option value="">Choisir</option>
              {SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </F>
        </div>
        <F label="Nombre de personnes">
          <div style={{ display: 'flex', gap: 8 }}>
            {[1,2,3,4,5,6,7,8].map(n => (
              <button key={n} onClick={() => upd('guests', n)} style={{
                width: 38, height: 38, borderRadius: 8,
                border: `1px solid ${form.guests === n ? '#C9A84C' : '#1A1A1A'}`,
                background: form.guests === n ? 'rgba(201,168,76,.1)' : '#0F0F0F',
                color: form.guests === n ? '#C9A84C' : '#777',
                cursor: 'pointer', fontSize: 13,
              }}>{n}</button>
            ))}
          </div>
        </F>
        <F label="Notes (optionnel)">
          <textarea value={form.notes} onChange={e => upd('notes', e.target.value)} placeholder="Anniversaire, chaise bébé…" rows={3} style={{ ...inputS, resize: 'none', height: 'auto' }}/>
        </F>

        <button onClick={submit} disabled={loading} style={{ width: '100%', padding: '14px', background: '#C9A84C', color: '#000', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer', marginTop: 8 }}>
          {loading ? '⟳ Réservation…' : '✓ Confirmer la réservation'}
        </button>
      </div>
      <BottomNav />
    </div>
  );
}



// ─────────────────────────────────────────────────────────────────────
//  GiftCardPage
// ─────────────────────────────────────────────────────────────────────
export function GiftCardPage() {
  const { api, toast } = useApp();
  const [amount, setAmount]   = useState(100);
  const [form, setForm]       = useState({ sender: '', recipient: '', phone: '', message: '' });
  const [checkCode, setCheckCode] = useState('');
  const [checkResult, setCheckResult] = useState<string>('');
  const [generated, setGenerated] = useState<{ code: string; amount: number } | null>(null);
  const upd = (k: keyof typeof form, v: string) => setForm(f => ({...f, [k]: v}));

  const purchase = async () => {
    if (!form.sender || !form.recipient || !form.phone) { toast('Informations requises', 'error'); return; }
    const gc = await api.createGiftCard({ ...form, amount, expires: '', message: form.message });
    setGenerated({ code: gc.code, amount });
    toast(`🎁 Carte ${gc.code} générée!`, 'success');
  };

  const checkBalance = async () => {
    if (!checkCode.trim()) return;
    const gc = await api.checkGiftCard(checkCode.trim());
    if (!gc)                    setCheckResult('❌ Code invalide');
    else if (gc.status !== 'active') setCheckResult(`Carte utilisée · Solde: 0 MAD`);
    else                        setCheckResult(`✅ Solde disponible: ${gc.balance} MAD`);
  };

  return (
    <div style={{ background: '#080808', minHeight: '100vh', paddingBottom: 80 }}>
      <Navbar />
      <div style={{ padding: '24px 16px', maxWidth: 500, margin: '0 auto' }}>
        <h1 style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 28, color: '#C9A84C', marginBottom: 8 }}>🎁 Carte Cadeau LUX</h1>
        <p style={{ fontSize: 12, color: '#666', marginBottom: 24 }}>Offrez une expérience LUX à vos proches.</p>

        {generated ? (
          <div style={{ textAlign: 'center', padding: '24px', background: 'linear-gradient(135deg,#1A0A00,#2D1500)', border: '1px solid rgba(201,168,76,.3)', borderRadius: 16, marginBottom: 20 }}>
            <div style={{ fontFamily: '"Cinzel",serif', fontSize: 14, color: '#C9A84C', letterSpacing: 3, marginBottom: 12 }}>✦ LUX · TAZA</div>
            <div style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 52, color: '#C9A84C', lineHeight: 1 }}>{generated.amount}<span style={{ fontSize: 20, color: '#8B6E2F' }}> MAD</span></div>
            <div style={{ fontFamily: 'monospace', fontSize: 20, color: 'rgba(255,255,255,.5)', letterSpacing: 4, margin: '16px 0 4px' }}>{generated.code}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.2)' }}>Valable 1 an · cafeslux.com</div>
          </div>
        ) : (
          <>
            {/* Amount selector */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {[50, 100, 150, 200].map(a => (
                <button key={a} onClick={() => setAmount(a)} style={{
                  flex: 1, padding: '10px 0', fontFamily: '"Cormorant Garamond",serif', fontSize: 16,
                  border: `1.5px solid ${amount === a ? '#C9A84C' : '#1A1A1A'}`,
                  background: amount === a ? 'rgba(201,168,76,.1)' : '#0F0F0F',
                  color: amount === a ? '#C9A84C' : '#777', cursor: 'pointer', borderRadius: 8,
                }}>{a} MAD</button>
              ))}
            </div>

            <F2 label="Votre nom *">
              <input value={form.sender} onChange={e => upd('sender', e.target.value)} placeholder="Votre prénom" style={inputS} />
            </F2>
            <F2 label="Destinataire *">
              <input value={form.recipient} onChange={e => upd('recipient', e.target.value)} placeholder="Nom du destinataire" style={inputS} />
            </F2>
            <F2 label="Téléphone pour recevoir le code *">
              <input value={form.phone} onChange={e => upd('phone', e.target.value)} type="tel" placeholder="+212 6XX XXX XXX" style={inputS} />
            </F2>
            <F2 label="Message (optionnel)">
              <input value={form.message} onChange={e => upd('message', e.target.value)} placeholder="Bon anniversaire!" style={inputS} />
            </F2>

            <button onClick={purchase} style={{ width: '100%', padding: '14px', background: '#C9A84C', color: '#000', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              🎁 Générer la carte — {amount} MAD
            </button>
          </>
        )}

        {/* Check balance */}
        <div style={{ marginTop: 28, background: '#0F0F0F', border: '1px solid #1A1A1A', borderRadius: 12, padding: '16px' }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Vérifier un solde</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={checkCode} onChange={e => setCheckCode(e.target.value.toUpperCase())} placeholder="LUX-XXXX" style={{ flex: 1, ...inputS, letterSpacing: 2, textAlign: 'center' }} />
            <button onClick={checkBalance} style={{ padding: '9px 14px', background: 'transparent', border: '1px solid rgba(201,168,76,.3)', borderRadius: 8, color: '#C9A84C', cursor: 'pointer', fontSize: 12 }}>Vérifier</button>
          </div>
          {checkResult && <div style={{ fontSize: 12, marginTop: 8, color: checkResult.includes('✅') ? '#3DBE7A' : '#E05252' }}>{checkResult}</div>}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Shared helpers
// ─────────────────────────────────────────────────────────────────────
const inputS: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  background: '#0F0F0F', border: '1px solid #1A1A1A',
  borderRadius: 8, color: '#F2EFE9', fontSize: 13, outline: 'none',
};

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}

function F2({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: '#666', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}
