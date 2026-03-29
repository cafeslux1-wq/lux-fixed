// ─── CAFÉ LUX — CustomerAppPage (/app/customer) ───────────────────────
// App-like layout: wallet, rewards, offers, history, QR entry, tracking
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar, BottomNav } from '../../components/layout/Navbar';
import { useApp } from '../../lib/store';
import { getLoyaltyLevel, LOYALTY_LEVELS, DEFAULT_COUPONS } from '../../lib/constants';
import type { Customer, Order } from '../../lib/types';

type AppTab = 'home' | 'wallet' | 'rewards' | 'offers' | 'history';

export default function CustomerAppPage() {
  const { api, toast } = useApp();
  const navigate = useNavigate();

  const [tab, setTab]         = useState<AppTab>('home');
  const [phone, setPhone]     = useState('');
  const [inputPhone, setInputPhone] = useState('');
  const [cust, setCust]       = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);

  // Auto-load if phone cached
  useEffect(() => {
    const saved = localStorage.getItem('lux_my_phone');
    if (saved) { setPhone(saved); loadCustomer(saved); }
  }, []);

  const loadCustomer = async (ph: string) => {
    setLoading(true);
    const data = await api.getCustomer(ph);
    setCust(data);
    if (data) localStorage.setItem('lux_my_phone', ph);
    setLoading(false);
  };

  const handleLogin = async () => {
    if (!inputPhone.trim()) { toast('Entrez votre numéro', 'error'); return; }
    const ph = inputPhone.trim();
    setPhone(ph);
    await loadCustomer(ph);
    if (!cust) toast('Passez votre première commande pour créer votre compte', 'info');
  };

  const handleLogout = () => {
    localStorage.removeItem('lux_my_phone');
    setCust(null);
    setPhone('');
    setInputPhone('');
  };

  // ── Login screen ─────────────────────────────────────────────────
  if (!cust && !loading) {
    return (
      <div style={{ background: '#080808', minHeight: '100vh', paddingBottom: 80 }}>
        <Navbar />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: 24 }}>
          <div style={{ fontFamily: '"Cinzel",serif', fontSize: 32, color: '#C9A84C', marginBottom: 6 }}>✦ LUX</div>
          <div style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 24, color: '#F2EFE9', marginBottom: 6 }}>Mon Espace Client</div>
          <p style={{ fontSize: 12, color: '#666', marginBottom: 32, textAlign: 'center', maxWidth: 300 }}>
            Entrez votre numéro pour accéder à vos points, commandes et offres exclusives.
          </p>
          <div style={{ width: '100%', maxWidth: 320 }}>
            <input
              value={inputPhone}
              onChange={e => setInputPhone(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="+212 6XX XXX XXX"
              type="tel"
              style={{ width: '100%', padding: '13px 16px', background: '#0F0F0F', border: '1px solid #1A1A1A', borderRadius: 10, color: '#F2EFE9', fontSize: 14, outline: 'none', marginBottom: 10, textAlign: 'center', letterSpacing: 1 }}
            />
            <button onClick={handleLogin} style={{ width: '100%', padding: '13px', background: '#C9A84C', color: '#000', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              Accéder à mon compte
            </button>
            <button onClick={() => navigate('/order')} style={{ width: '100%', padding: '11px', marginTop: 8, background: 'none', border: '1px solid #1A1A1A', borderRadius: 10, color: '#777', fontSize: 13, cursor: 'pointer' }}>
              Commander sans compte
            </button>
            <p style={{ fontSize: 10, color: '#444', textAlign: 'center', marginTop: 16 }}>
              Votre compte est créé automatiquement à la première commande.
            </p>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ background: '#080808', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: '"Cinzel",serif', color: '#C9A84C', fontSize: 14, letterSpacing: 4 }}>⟳ LUX</div>
      </div>
    );
  }

  const level   = getLoyaltyLevel(cust?.loyaltyPoints ?? 0);
  const nextLvl = LOYALTY_LEVELS[LOYALTY_LEVELS.findIndex(l => l.id === level.id) + 1];
  const progress = nextLvl
    ? Math.round(((cust?.loyaltyPoints ?? 0) - level.min) / (nextLvl.min - level.min) * 100)
    : 100;
  const pendingOrders = (cust?.orders ?? []).filter(o => ['pending','accepted','preparing','ready'].includes(o.status));

  return (
    <div style={{ background: '#080808', minHeight: '100vh', paddingBottom: 80 }}>
      <Navbar />

      {/* ── Header card ─────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(160deg,#1A0A00,#2D1500,#1A0A00)',
        borderBottom: '1px solid rgba(201,168,76,.15)',
        padding: '20px 20px 0',
      }}>
        {/* User info row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'rgba(201,168,76,.15)', border: '1px solid rgba(201,168,76,.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: '"Cormorant Garamond",serif', fontSize: 20, color: '#C9A84C',
          }}>
            {(cust?.name ?? phone).slice(0, 1).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{cust?.name || 'Client LUX'}</div>
            <div style={{ fontSize: 11, color: '#666' }}>{phone}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: '#555' }}>{level.icon} {level.name}</div>
            <div style={{ fontSize: 10, color: '#444', marginTop: 2 }}>
              {pendingOrders.length > 0 && (
                <span style={{ color: '#C9A84C' }}>{pendingOrders.length} en cours</span>
              )}
            </div>
          </div>
        </div>

        {/* Points & progress */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#666', marginBottom: 6 }}>
            <span>{level.icon} {level.name}</span>
            {nextLvl && <span>{nextLvl.icon} {nextLvl.name} ({nextLvl.min} pts)</span>}
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
            <div style={{ height: '100%', width: `${Math.min(progress, 100)}%`, background: 'linear-gradient(90deg,#8B6E2F,#C9A84C)', borderRadius: 2, transition: 'width .8s ease' }}/>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 32, color: '#C9A84C', lineHeight: 1 }}>
              {cust?.loyaltyPoints ?? 0}
              <span style={{ fontSize: 12, color: '#8B6E2F', marginLeft: 4 }}>pts</span>
            </div>
            {nextLvl && (
              <div style={{ fontSize: 11, color: '#555', textAlign: 'right', alignSelf: 'flex-end' }}>
                encore {nextLvl.min - (cust?.loyaltyPoints ?? 0)} pts
              </div>
            )}
          </div>
        </div>

        {/* App tabs */}
        <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,.05)', marginTop: 4 }}>
          {([
            ['home',    '🏠', 'Accueil'],
            ['wallet',  '💳', 'Wallet'],
            ['rewards', '🏆', 'Récompenses'],
            ['offers',  '🎟', 'Offres'],
            ['history', '📋', 'Historique'],
          ] as [AppTab, string, string][]).map(([t, icon, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '10px 4px', background: 'none', border: 'none',
                borderBottom: `2px solid ${tab === t ? '#C9A84C' : 'transparent'}`,
                color: tab === t ? '#C9A84C' : '#555',
                cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              }}
            >
              <span style={{ fontSize: 16 }}>{icon}</span>
              <span style={{ fontSize: 9, whiteSpace: 'nowrap' }}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ────────────────────────────────────────── */}
      <div style={{ padding: '20px 16px', maxWidth: 600, margin: '0 auto' }}>

        {/* HOME tab */}
        {tab === 'home' && (
          <div>
            {/* Active orders alert */}
            {pendingOrders.length > 0 && (
              <div style={{ background: 'rgba(201,168,76,.06)', border: '1px solid rgba(201,168,76,.2)', borderRadius: 12, padding: '14px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>🛵</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{pendingOrders.length} commande(s) en cours</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                    {pendingOrders[0]?.status} — {pendingOrders[0]?.total} MAD
                  </div>
                </div>
                <button onClick={() => navigate('/track')} style={{ padding: '6px 12px', background: '#C9A84C', color: '#000', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  Suivre →
                </button>
              </div>
            )}

            {/* Quick actions */}
            <div style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 20, color: '#F2EFE9', marginBottom: 14 }}>Actions rapides</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 20 }}>
              {[
                { icon: '☕', label: 'Commander', sub: 'Menu complet', action: () => navigate('/order') },
                { icon: '📍', label: 'Suivi commande', sub: 'Statut en temps réel', action: () => navigate('/track') },
                { icon: '📅', label: 'Réserver une table', sub: 'Disponibilités', action: () => navigate('/reserve') },
                { icon: '🎁', label: 'Carte cadeau', sub: 'Offrir LUX', action: () => navigate('/gift-cards') },
              ].map(a => (
                <button key={a.label} onClick={a.action} style={{
                  background: '#0F0F0F', border: '1px solid #1A1A1A', borderRadius: 12,
                  padding: '16px', cursor: 'pointer', textAlign: 'left', transition: 'border-color .15s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(201,168,76,.3)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#1A1A1A')}
                >
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{a.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#F2EFE9' }}>{a.label}</div>
                  <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{a.sub}</div>
                </button>
              ))}
            </div>

            {/* QR ordering entry */}
            <div style={{
              background: 'linear-gradient(135deg,#0F0F0F,#161616)',
              border: '1px solid #1A1A1A',
              borderRadius: 14, padding: '18px', marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{ width: 56, height: 56, background: '#C9A84C', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>
                📱
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Commander via QR</div>
                <div style={{ fontSize: 11, color: '#666', lineHeight: 1.5 }}>
                  Scannez le QR de votre table pour commander directement depuis votre siège.
                </div>
              </div>
              <button onClick={() => navigate('/menu')} style={{ padding: '8px 14px', background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.25)', borderRadius: 8, color: '#C9A84C', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Voir menu →
              </button>
            </div>

            <button onClick={handleLogout} style={{ width: '100%', padding: '10px', background: 'none', border: '1px solid #111', borderRadius: 8, color: '#444', fontSize: 12, cursor: 'pointer' }}>
              Se déconnecter
            </button>
          </div>
        )}

        {/* WALLET tab */}
        {tab === 'wallet' && (
          <div>
            <div style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 22, color: '#F2EFE9', marginBottom: 16 }}>💳 Wallet LUX</div>

            {/* Digital loyalty card */}
            <div style={{
              background: 'linear-gradient(135deg,#1A0A00 0%,#2D1500 50%,#1A0A00 100%)',
              border: '1px solid rgba(201,168,76,.3)',
              borderRadius: 18, padding: '24px', marginBottom: 16, position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', right: -30, top: -30, fontSize: 140, opacity: 0.04, lineHeight: 1 }}>✦</div>
              <div style={{ fontFamily: '"Cinzel",serif', fontSize: 11, color: '#C9A84C', letterSpacing: 4, marginBottom: 14 }}>✦ CAFÉ LUX FIDÉLITÉ</div>
              <div style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 52, color: '#C9A84C', lineHeight: 1, marginBottom: 4 }}>
                {cust?.loyaltyPoints ?? 0}
                <span style={{ fontSize: 16, color: '#8B6E2F', marginLeft: 6 }}>points</span>
              </div>
              <div style={{ fontSize: 16, color: '#F2EFE9', marginBottom: 4, fontWeight: 500 }}>
                {cust?.name || phone}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', marginBottom: 16 }}>
                {level.icon} {level.name.toUpperCase()} MEMBER
              </div>
              {/* Decorative dots */}
              <div style={{ display: 'flex', gap: 6 }}>
                {Array.from({length: 4}).map((_,i) => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(201,168,76,.3)' }}/>
                ))}
              </div>
            </div>

            {/* Points activity */}
            <div style={{ background: '#0F0F0F', border: '1px solid #1A1A1A', borderRadius: 12, padding: '16px', marginBottom: 16 }}>
              <div style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 18, color: '#F2EFE9', marginBottom: 12 }}>Activité récente</div>
              {(cust?.orders ?? []).slice(0, 5).length === 0 ? (
                <div style={{ fontSize: 12, color: '#555', textAlign: 'center', padding: '20px 0' }}>Aucune activité — passez votre première commande!</div>
              ) : (
                (cust?.orders ?? []).slice(0, 5).map((o, i) => {
                  const pts = Math.floor((o.total ?? 0) / 10);
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #111' }}>
                      <div>
                        <div style={{ fontSize: 12, color: '#AAA' }}>Commande #{String(o.id).slice(-6)}</div>
                        <div style={{ fontSize: 10, color: '#555' }}>{o.date}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: '#C9A84C' }}>+{pts} pts</div>
                        <div style={{ fontSize: 10, color: '#555' }}>{o.total} MAD</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Gift cards held */}
            <div style={{ background: '#0F0F0F', border: '1px solid #1A1A1A', borderRadius: 12, padding: '16px' }}>
              <div style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 18, color: '#F2EFE9', marginBottom: 12 }}>Cartes Cadeau</div>
              <button onClick={() => navigate('/gift-cards')} style={{ width: '100%', padding: '10px', background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.2)', borderRadius: 8, color: '#C9A84C', cursor: 'pointer', fontSize: 13 }}>
                🎁 Acheter / Vérifier une carte cadeau
              </button>
            </div>
          </div>
        )}

        {/* REWARDS tab */}
        {tab === 'rewards' && (
          <div>
            <div style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 22, color: '#F2EFE9', marginBottom: 16 }}>🏆 Récompenses</div>

            {LOYALTY_LEVELS.map((lvl, i) => {
              const earned  = (cust?.loyaltyPoints ?? 0) >= lvl.min;
              const current = lvl.id === level.id;
              return (
                <div key={lvl.id} style={{
                  background: current ? 'rgba(201,168,76,.06)' : '#0F0F0F',
                  border: `1px solid ${current ? 'rgba(201,168,76,.3)' : '#1A1A1A'}`,
                  borderRadius: 12, padding: '16px', marginBottom: 10, opacity: earned ? 1 : 0.5,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <span style={{ fontSize: 28 }}>{lvl.icon}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: lvl.color }}>{lvl.name}</div>
                      <div style={{ fontSize: 10, color: '#555' }}>{lvl.min}+ points</div>
                    </div>
                    {current && <span style={{ marginLeft: 'auto', fontSize: 10, background: 'rgba(201,168,76,.1)', color: '#C9A84C', padding: '2px 8px', borderRadius: 8 }}>Votre niveau</span>}
                    {!earned && <span style={{ marginLeft: 'auto', fontSize: 12, color: '#555' }}>🔒</span>}
                  </div>
                  {lvl.perks.map(p => (
                    <div key={p} style={{ display: 'flex', gap: 8, fontSize: 12, color: earned ? '#AAA' : '#444', marginBottom: 4 }}>
                      <span style={{ color: earned ? '#C9A84C' : '#333', flexShrink: 0 }}>{earned ? '✓' : '○'}</span>{p}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* OFFERS tab */}
        {tab === 'offers' && (
          <div>
            <div style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 22, color: '#F2EFE9', marginBottom: 16 }}>🎟 Offres & Codes</div>
            {DEFAULT_COUPONS.map(c => (
              <div key={c.code} style={{
                background: '#0F0F0F', border: '1px solid #1A1A1A',
                borderRadius: 12, padding: '16px', marginBottom: 10,
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{c.label}</div>
                  <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
                    {c.minOrder > 0 ? `Minimum ${c.minOrder} MAD` : 'Sans minimum'}
                  </div>
                </div>
                <div>
                  <div style={{
                    fontFamily: 'monospace', fontSize: 13, color: '#C9A84C',
                    background: 'rgba(201,168,76,.08)', border: '1px dashed rgba(201,168,76,.3)',
                    borderRadius: 6, padding: '4px 10px', letterSpacing: 1,
                  }}>
                    {c.code}
                  </div>
                  <button
                    onClick={() => { navigator.clipboard?.writeText(c.code).catch(()=>{}); toast('✓ Code copié!', 'success'); }}
                    style={{ width: '100%', marginTop: 4, padding: '4px', background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 10 }}
                  >
                    Copier
                  </button>
                </div>
              </div>
            ))}
            <div style={{ fontSize: 11, color: '#444', textAlign: 'center', marginTop: 8 }}>
              Utilisez ces codes au moment de la commande dans "/order"
            </div>
          </div>
        )}

        {/* HISTORY tab */}
        {tab === 'history' && (
          <div>
            <div style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 22, color: '#F2EFE9', marginBottom: 16 }}>📋 Historique</div>
            {(cust?.orders ?? []).length === 0 ? (
              <div style={{ textAlign: 'center', color: '#555', padding: '40px 0' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
                Aucune commande passée.
                <br />
                <button onClick={() => navigate('/order')} style={{ marginTop: 12, padding: '10px 20px', background: '#C9A84C', color: '#000', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                  Commander maintenant
                </button>
              </div>
            ) : (
              (cust?.orders ?? []).map((o, i) => {
                const statusColor: Record<string, string> = { pending:'#888', accepted:'#5B8DEF', preparing:'#C9A84C', ready:'#3DBE7A', done:'#3DBE7A', cancelled:'#E05252' };
                return (
                  <div key={i} style={{ background: '#0F0F0F', border: '1px solid #1A1A1A', borderRadius: 12, padding: '14px', marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ fontFamily: '"Cormorant Garamond",serif', color: '#C9A84C', fontSize: 16 }}>
                        #{String(o.id).slice(-6)}
                      </div>
                      <span style={{ fontSize: 10, color: statusColor[o.status] ?? '#888', fontWeight: 600, textTransform: 'uppercase' }}>
                        {o.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>{o.date} · {o.type}</div>
                    <div style={{ fontSize: 12, color: '#AAA', marginBottom: 8 }}>
                      {o.items?.slice(0, 3).map(i => `${i.qty}× ${i.name}`).join(', ')}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: '#555' }}>{o.payMethod}</span>
                      <span style={{ fontFamily: '"Cormorant Garamond",serif', color: '#C9A84C', fontSize: 16 }}>{o.total} MAD</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
