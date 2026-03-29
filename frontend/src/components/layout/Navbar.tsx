// ─── CAFÉ LUX — Navbar ────────────────────────────────────────────────
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { CAFE } from '../../lib/constants';

interface NavbarProps {
  transparent?: boolean;
}

export function Navbar({ transparent = false }: NavbarProps) {
  const { cartQty, state } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const at = (p: string) => location.pathname === p;

  const apiDotColor =
    state.apiStatus === 'online'  ? '#3DBE7A' :
    state.apiStatus === 'offline' ? '#E05252' : '#555';

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: transparent ? 'transparent' : 'rgba(8,8,8,.96)',
      backdropFilter: transparent ? 'none' : 'blur(20px)',
      borderBottom: transparent ? 'none' : '1px solid #1A1A1A',
      padding: '0 20px', height: 58,
      display: 'flex', alignItems: 'center', gap: 4,
    }}>
      {/* Logo */}
      <button
        onClick={() => navigate('/')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: '"Cinzel",serif', color: '#C9A84C',
          fontSize: 18, letterSpacing: 5, padding: '0 8px',
          marginRight: 4,
        }}
      >
        ✦ LUX
      </button>

      {/* Nav links */}
      <div style={{ display: 'flex', gap: 2, flex: 1, overflow: 'hidden' }}>
        {[
          { label: 'Menu',      path: '/menu'    },
          { label: 'Réserver',  path: '/reserve' },
          { label: 'Suivi',     path: '/track'   },
          { label: 'Compte',    path: '/account' },
        ].map(({ label, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '6px 10px', borderRadius: 8, fontSize: 12,
              color: at(path) ? '#C9A84C' : '#888',
              fontWeight: at(path) ? 600 : 400,
              whiteSpace: 'nowrap',
              transition: 'color .15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
        {/* API dot */}
        <div
          title={`API: ${state.apiStatus}`}
          style={{ width: 7, height: 7, borderRadius: '50%', background: apiDotColor }}
        />
        {/* Cart */}
        <button
          onClick={() => navigate('/cart')}
          style={{
            position: 'relative', background: 'none', border: 'none',
            cursor: 'pointer', fontSize: 18, padding: 4,
          }}
        >
          🛒
          {cartQty > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -4,
              background: '#C9A84C', color: '#000',
              width: 18, height: 18, borderRadius: '50%',
              fontSize: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {cartQty}
            </span>
          )}
        </button>
      </div>
    </nav>
  );
}

// ─── Mobile bottom tab bar ────────────────────────────────────────────
export function BottomNav() {
  const { cartQty } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const at = (p: string) => location.pathname === p;

  const tabs = [
    { icon: '🏠', label: 'Accueil', path: '/'        },
    { icon: '☕', label: 'Menu',    path: '/menu'    },
    { icon: '🛒', label: 'Panier', path: '/cart',  badge: cartQty },
    { icon: '📍', label: 'Suivi',  path: '/track'   },
    { icon: '👤', label: 'Compte', path: '/account' },
  ];

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#0F0F0F', borderTop: '1px solid #1A1A1A',
      display: 'flex', zIndex: 80, paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {tabs.map(t => (
        <button
          key={t.path}
          onClick={() => navigate(t.path)}
          style={{
            flex: 1, padding: '8px 0 6px',
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 2, position: 'relative',
          }}
        >
          <span style={{ fontSize: 20 }}>{t.icon}</span>
          <span style={{ fontSize: 9, color: at(t.path) ? '#C9A84C' : '#555' }}>{t.label}</span>
          {t.badge ? (
            <span style={{
              position: 'absolute', top: 4, right: '30%',
              background: '#C9A84C', color: '#000',
              width: 16, height: 16, borderRadius: '50%',
              fontSize: 9, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {t.badge}
            </span>
          ) : null}
          {at(t.path) && (
            <div style={{ position: 'absolute', bottom: 0, left: '25%', right: '25%', height: 2, background: '#C9A84C', borderRadius: 1 }}/>
          )}
        </button>
      ))}
    </div>
  );
}
