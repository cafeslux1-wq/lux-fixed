// ─── CAFÉ LUX — HomePage (public) ────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar, BottomNav } from '../../components/layout/Navbar';
import { MenuCard } from '../../components/menu/MenuCard';
import { useApp } from '../../lib/store';
import { CAFE, SEED_REVIEWS, getLoyaltyLevel } from '../../lib/constants';
import type { MenuCategory, Review } from '../../lib/types';

export default function HomePage() {
  const { api, dispatch, toast, state } = useApp();
  const navigate = useNavigate();
  const [cats, setCats]       = useState<MenuCategory[]>(state.menuCategories);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(!state.menuCategories.length);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [menu, revs] = await Promise.all([
        api.getPublicMenu(),
        api.getReviews().catch(() => SEED_REVIEWS),
      ]);
      setCats(menu);
      dispatch({ type: 'SET_MENU', payload: { cats: menu, ts: Date.now() } });
      setReviews(revs.length ? revs : SEED_REVIEWS);
      setLoading(false);
    })();
  }, []);

  // Signatures only for hero preview
  const signatures = cats.flatMap(c => c.products.filter(p => p.isSignature)).slice(0, 4);

  return (
    <div style={{ background: '#080808', minHeight: '100vh', paddingBottom: 80 }}>
      <Navbar />

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section style={{
        textAlign: 'center', padding: '60px 20px 40px',
        background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(201,168,76,.07) 0%, transparent 70%)',
        borderBottom: '1px solid #111',
      }}>
        <div style={{ fontFamily: '"Cinzel",serif', fontSize: 11, letterSpacing: 5, color: '#C9A84C', marginBottom: 16 }}>
          ✦ TAZA · MAROC
        </div>
        <h1 style={{
          fontFamily: '"Cormorant Garamond",serif',
          fontSize: 'clamp(36px,8vw,72px)', fontWeight: 300,
          color: '#F2EFE9', margin: '0 0 14px', lineHeight: 1.1,
        }}>
          L'Art du Café<br/>
          <span style={{ color: '#C9A84C', fontStyle: 'italic' }}>À Taza</span>
        </h1>
        <p style={{ fontSize: 14, color: '#777', maxWidth: 480, margin: '0 auto 32px', lineHeight: 1.7 }}>
          Signatures LUX, crêpes artisanales & pâtisseries fines.
          Livraison disponible · Réservations ouvertes.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/menu')} style={{
            padding: '13px 32px', background: '#C9A84C', color: '#000',
            border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}>
            Commander →
          </button>
          <button onClick={() => navigate('/reserve')} style={{
            padding: '13px 32px', background: 'transparent', color: '#C9A84C',
            border: '1px solid rgba(201,168,76,.4)', borderRadius: 8, fontSize: 14, cursor: 'pointer',
          }}>
            Réserver une table
          </button>
        </div>

        {/* Info pills */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
          {[
            `📍 ${CAFE.address}`,
            `⏰ ${CAFE.hours}`,
            '🛵 Livraison Taza',
            '⭐ 4.8/5',
          ].map(t => (
            <span key={t} style={{
              padding: '5px 14px', borderRadius: 20,
              background: 'rgba(255,255,255,.04)', border: '1px solid #1A1A1A',
              fontSize: 11, color: '#666',
            }}>{t}</span>
          ))}
        </div>
      </section>

      {/* ── Signature Highlights ───────────────────────────────────── */}
      <section style={{ padding: '40px 20px 0', maxWidth: 900, margin: '0 auto' }}>
        <SectionHeader title="Signatures LUX" sub="Nos créations exclusives" onMore={() => navigate('/menu')} />
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14 }}>
            {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14 }}>
            {signatures.map(item => <MenuCard key={item.id} item={item} />)}
          </div>
        )}
      </section>

      {/* ── Delivery Banner ───────────────────────────────────────── */}
      <section style={{ padding: '30px 20px', maxWidth: 900, margin: '0 auto' }}>
        <div
          onClick={() => navigate('/cart')}
          style={{
            background: 'linear-gradient(135deg,#1A0A00,#0F0800)',
            border: '1px solid rgba(201,168,76,.2)',
            borderRadius: 16, padding: '22px 24px',
            display: 'flex', alignItems: 'center', gap: 16,
            cursor: 'pointer', transition: 'border-color .15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(201,168,76,.4)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(201,168,76,.2)')}
        >
          <span style={{ fontSize: 36, flexShrink: 0 }}>🛵</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 20, color: '#C9A84C', marginBottom: 4 }}>
              Livraison à domicile · Taza
            </div>
            <div style={{ fontSize: 12, color: '#666', lineHeight: 1.5 }}>
              15 MAD · Gratuite dès 200 MAD · ETA 30–45 min<br/>
              <span style={{ color: '#888' }}>Commandez en ligne — payez à la livraison ou en ligne</span>
            </div>
          </div>
          <div style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 28, color: '#C9A84C', flexShrink: 0 }}>→</div>
        </div>
      </section>

      {/* ── All Categories Grid ───────────────────────────────────── */}
      <section style={{ padding: '0 20px 30px', maxWidth: 900, margin: '0 auto' }}>
        <SectionHeader title="Le Menu Complet" sub={`${cats.reduce((s,c)=>s+c.products.length,0)} produits`} onMore={() => navigate('/menu')} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
          {cats.map(cat => (
            <button
              key={cat.id}
              onClick={() => navigate(`/menu#cat-${cat.id}`)}
              style={{
                background: '#0F0F0F', border: '1px solid #1A1A1A',
                borderRadius: 12, padding: '16px 12px', cursor: 'pointer',
                textAlign: 'center', transition: 'border-color .15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(201,168,76,.3)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#1A1A1A')}
            >
              <div style={{ fontSize: 28, marginBottom: 6 }}>{cat.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#F2EFE9' }}>{cat.name}</div>
              <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>{cat.products.length} items</div>
            </button>
          ))}
        </div>
      </section>

      {/* ── Loyalty Teaser ───────────────────────────────────────── */}
      <section style={{ padding: '0 20px 30px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{
          background: 'linear-gradient(135deg,rgba(201,168,76,.06),rgba(201,168,76,.02))',
          border: '1px solid rgba(201,168,76,.15)',
          borderRadius: 16, padding: '24px',
        }}>
          <div style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 22, color: '#C9A84C', marginBottom: 8 }}>
            🏆 Programme Fidélité LUX
          </div>
          <p style={{ fontSize: 12, color: '#777', marginBottom: 16, lineHeight: 1.6 }}>
            Cumulez des points à chaque commande. Débloquez Bronze, Silver, Gold & Diamond.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {['🥉 Bronze','🥈 Silver','🥇 Gold','💎 Diamond'].map(l => (
              <span key={l} style={{
                padding: '4px 12px', borderRadius: 12,
                background: 'rgba(255,255,255,.04)', border: '1px solid #1A1A1A',
                fontSize: 11, color: '#888',
              }}>{l}</span>
            ))}
          </div>
          <button onClick={() => navigate('/account')} style={{
            padding: '10px 24px', background: 'rgba(201,168,76,.1)',
            border: '1px solid rgba(201,168,76,.3)', borderRadius: 8,
            color: '#C9A84C', fontSize: 13, cursor: 'pointer',
          }}>
            Voir mon compte →
          </button>
        </div>
      </section>

      {/* ── Reviews ──────────────────────────────────────────────── */}
      <section style={{ padding: '0 20px 30px', maxWidth: 900, margin: '0 auto' }}>
        <SectionHeader title="Avis Clients" sub={`${reviews.length} avis vérifiés`} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
          {reviews.slice(0, 3).map(r => (
            <div key={r.id} style={{
              background: '#0F0F0F', border: '1px solid #1A1A1A',
              borderRadius: 12, padding: '16px',
            }}>
              <div style={{ color: '#C9A84C', fontSize: 14, marginBottom: 8 }}>
                {'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}
              </div>
              <p style={{ fontSize: 12, color: '#AAA', lineHeight: 1.6, marginBottom: 12, fontStyle: 'italic' }}>
                "{r.text}"
              </p>
              <div style={{ fontSize: 11, color: '#555', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#888', fontWeight: 500 }}>{r.name}</span>
                {r.verified && <span style={{ color: '#3DBE7A' }}>✓ Vérifié</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid #111', padding: '24px 20px',
        textAlign: 'center', fontSize: 11, color: '#444',
      }}>
        <div style={{ fontFamily: '"Cinzel",serif', color: '#C9A84C', fontSize: 16, marginBottom: 8, letterSpacing: 4 }}>
          ✦ LUX
        </div>
        <div>{CAFE.address} · {CAFE.phone}</div>
        <div style={{ marginTop: 6 }}>
          <a href={`https://wa.me/${CAFE.whatsapp.replace(/\D/g,'')}`}
            target="_blank" rel="noreferrer"
            style={{ color: '#3DBE7A', textDecoration: 'none' }}>
            📲 WhatsApp
          </a>
          {' · '}
          <span>{CAFE.hours}</span>
        </div>
      </footer>

      <BottomNav />
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────
function SectionHeader({ title, sub, onMore }: { title: string; sub?: string; onMore?: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
      <div>
        <div style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 22, color: '#F2EFE9' }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{sub}</div>}
      </div>
      {onMore && (
        <button onClick={onMore} style={{
          background: 'none', border: 'none', color: '#C9A84C',
          fontSize: 12, cursor: 'pointer', fontFamily: '"Cormorant Garamond",serif',
        }}>
          Voir tout →
        </button>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={{ background: '#0F0F0F', border: '1px solid #1A1A1A', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ paddingTop: '66%', background: '#1A1A1A', animation: 'shimmer 1.4s infinite', backgroundSize: '200% 100%', backgroundImage: 'linear-gradient(90deg,#1A1A1A 25%,#222 50%,#1A1A1A 75%)' }}/>
      <div style={{ padding: '12px 14px' }}>
        <div style={{ height: 14, background: '#1A1A1A', borderRadius: 4, marginBottom: 8 }}/>
        <div style={{ height: 10, background: '#111', borderRadius: 4, width: '60%' }}/>
      </div>
    </div>
  );
}
