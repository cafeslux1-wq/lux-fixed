import { useEffect, useState } from 'react'

type Navigate = (path: any) => void

const GOLD = '#C9A84C'

export default function HomePage({ navigate }: { navigate: Navigate }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setTimeout(() => setVisible(true), 100)
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0A0A0A',
      color: '#F0EDE8',
      fontFamily: "'DM Sans', sans-serif",
      overflowX: 'hidden',
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />

      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shimmer { 0%,100% { opacity:.6; } 50% { opacity:1; } }
        @keyframes pulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.04); } }
        .hero-title { animation: fadeUp .8s ease both; }
        .hero-sub { animation: fadeUp .8s .15s ease both; }
        .hero-btns { animation: fadeUp .8s .3s ease both; }
        .portal-card { transition: all .25s ease; }
        .portal-card:hover { transform: translateY(-4px); border-color: ${GOLD} !important; }
        .menu-btn:hover { background: ${GOLD} !important; color: #000 !important; transform: scale(1.03); }
        .app-btn:hover { background: rgba(201,168,76,.12) !important; transform: scale(1.03); }
        .gold-line { background: linear-gradient(90deg, transparent, ${GOLD}, transparent); height:1px; }
        .grain { position:fixed; inset:0; pointer-events:none; opacity:.03; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E"); z-index:0; }
      `}</style>

      <div className="grain" />

      {/* ── HERO ─────────────────────────────────────────── */}
      <section style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '0 24px',
        position: 'relative',
        zIndex: 1,
        opacity: visible ? 1 : 0,
        transition: 'opacity .4s',
      }}>
        {/* Radial glow */}
        <div style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          width: '600px',
          height: '600px',
          background: `radial-gradient(circle, rgba(201,168,76,.08) 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />

        {/* Logo mark */}
        <div style={{
          width: 72,
          height: 72,
          borderRadius: 18,
          background: `linear-gradient(135deg, ${GOLD}, #8B6E2F)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Playfair Display', serif",
          fontSize: 32,
          fontWeight: 700,
          color: '#000',
          marginBottom: 32,
          animation: 'fadeUp .6s ease both',
          boxShadow: `0 0 40px rgba(201,168,76,.3)`,
        }}>L</div>

        <h1 className="hero-title" style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 'clamp(64px, 12vw, 120px)',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          lineHeight: 1,
          marginBottom: 12,
          background: `linear-gradient(135deg, #E8C97A, ${GOLD}, #8B6E2F)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>LUX</h1>

        <p style={{
          fontSize: 12,
          letterSpacing: '0.35em',
          color: GOLD,
          marginBottom: 24,
          animation: 'fadeUp .8s .1s ease both',
          opacity: .8,
        }}>TAZA · CAFÉ & PÂTISSERIE · 2026</p>

        <h2 className="hero-sub" style={{
          fontFamily: "'Playfair Display', serif",
          fontStyle: 'italic',
          fontSize: 'clamp(18px, 3vw, 26px)',
          fontWeight: 400,
          color: 'rgba(240,237,232,.65)',
          maxWidth: 520,
          lineHeight: 1.5,
          marginBottom: 48,
        }}>
          اكتشف أرقى نكهات القهوة والحلويات الفرنسية في قلب تازة
        </h2>

        <div className="hero-btns" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            className="menu-btn"
            onClick={() => navigate('/menu')}
            style={{
              padding: '14px 36px',
              background: GOLD,
              color: '#000',
              border: 'none',
              borderRadius: 50,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all .2s',
              boxShadow: `0 8px 32px rgba(201,168,76,.3)`,
            }}>
            📖 تصفح المنيو الرقمي
          </button>
          <button
            className="app-btn"
            onClick={() => navigate('/app/customer')}
            style={{
              padding: '14px 36px',
              background: 'transparent',
              color: GOLD,
              border: `1.5px solid ${GOLD}`,
              borderRadius: 50,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 15,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all .2s',
            }}>
            📱 تحميل التطبيق
          </button>
        </div>

        {/* Scroll hint */}
        <div style={{
          position: 'absolute',
          bottom: 32,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          opacity: .4,
          animation: 'shimmer 2s infinite',
        }}>
          <div style={{ width: 1, height: 40, background: GOLD }} />
          <span style={{ fontSize: 10, letterSpacing: '.15em', color: GOLD }}>SCROLL</span>
        </div>
      </section>

      {/* ── GOLD DIVIDER ──────────────────────────────────── */}
      <div className="gold-line" />

      {/* ── PORTALS SECTION ───────────────────────────────── */}
      <section style={{
        padding: '80px 24px',
        background: '#0D0D0D',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <p style={{ fontSize: 11, letterSpacing: '.25em', color: GOLD, marginBottom: 12, opacity: .7 }}>ACCÈS RAPIDE</p>
            <h3 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 'clamp(24px, 4vw, 36px)',
              color: '#F0EDE8',
              fontWeight: 400,
            }}>بوابات النظام</h3>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
          }}>
            {[
              { icon: '⚙️', label: 'الإدارة', sub: 'Administration', path: '/portal/admin', color: '#5B8DEF' },
              { icon: '👥', label: 'الموظفين', sub: 'Staff Portal', path: '/portal/staff', color: GOLD },
              { icon: '🖥️', label: 'نظام POS', sub: 'Point de Vente', path: '/portal/pos', color: '#3DBE7A' },
              { icon: '💎', label: 'الزبائن', sub: 'Application Client', path: '/app/customer', color: '#E07830' },
            ].map((item) => (
              <div
                key={item.path}
                className="portal-card"
                onClick={() => navigate(item.path as any)}
                style={{
                  padding: '32px 24px',
                  background: '#131313',
                  border: '1px solid #1E1E1E',
                  borderRadius: 16,
                  textAlign: 'center',
                  cursor: 'pointer',
                }}>
                <div style={{ fontSize: 36, marginBottom: 16 }}>{item.icon}</div>
                <div style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: '#F0EDE8',
                  marginBottom: 4,
                }}>{item.label}</div>
                <div style={{ fontSize: 11, color: '#555', letterSpacing: '.05em' }}>{item.sub}</div>
                <div style={{
                  width: 32,
                  height: 2,
                  background: item.color,
                  borderRadius: 2,
                  margin: '16px auto 0',
                  opacity: .6,
                }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────── */}
      <div className="gold-line" />
      <footer style={{
        padding: '24px',
        textAlign: 'center',
        background: '#0A0A0A',
        fontSize: 11,
        color: '#333',
        letterSpacing: '.1em',
        zIndex: 1,
        position: 'relative',
      }}>
        © 2026 CAFÉ LUX · TAZA · MAROC · +212 808 524 169
      </footer>
    </div>
  )
}
