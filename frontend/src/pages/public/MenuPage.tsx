// ─── CAFÉ LUX — MenuPage ─────────────────────────────────────────────
import React, { useEffect, useState, useRef } from 'react';
import { Navbar, BottomNav } from '../../components/layout/Navbar';
import { MenuCard } from '../../components/menu/MenuCard';
import { useApp } from '../../lib/store';
import type { MenuCategory } from '../../lib/types';

export default function MenuPage() {
  const { api, dispatch, state } = useApp();
  const [cats, setCats]         = useState<MenuCategory[]>(state.menuCategories);
  const [loading, setLoading]   = useState(!state.menuCategories.length);
  const [search, setSearch]     = useState('');
  const [activeId, setActiveId] = useState<number | null>(null);
  const sectionRefs             = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await api.getPublicMenu();
      setCats(data);
      dispatch({ type: 'SET_MENU', payload: { cats: data, ts: Date.now() } });
      setActiveId(data[0]?.id ?? null);
      setLoading(false);
    })();
  }, []);

  // Hash scroll on mount (from homepage category links)
  useEffect(() => {
    const hash = window.location.hash.replace('#cat-', '');
    if (hash) {
      const id = parseInt(hash, 10);
      if (!isNaN(id)) {
        setTimeout(() => {
          sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setActiveId(id);
        }, 300);
      }
    }
  }, [cats]);

  const filtered = cats.map(c => ({
    ...c,
    products: search
      ? c.products.filter(p =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.description.toLowerCase().includes(search.toLowerCase())
        )
      : c.products,
  })).filter(c => c.products.length > 0);

  const scrollToCategory = (id: number) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveId(id);
  };

  return (
    <div style={{ background: '#080808', minHeight: '100vh', paddingBottom: 80 }}>
      <Navbar />

      {/* ── Sticky header with search ──────────────────────────── */}
      <div style={{
        position: 'sticky', top: 58, zIndex: 40,
        background: 'rgba(8,8,8,.97)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid #111', padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un produit…"
          style={{
            width: '100%', padding: '9px 14px',
            background: '#0F0F0F', border: '1px solid #1A1A1A',
            borderRadius: 8, color: '#F2EFE9', fontSize: 13, outline: 'none',
          }}
        />
        {/* Category pills */}
        {!loading && !search && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
            {cats.map(c => (
              <button
                key={c.id}
                onClick={() => scrollToCategory(c.id)}
                style={{
                  padding: '5px 14px', borderRadius: 16, whiteSpace: 'nowrap',
                  border: '1px solid',
                  borderColor: activeId === c.id ? '#C9A84C' : '#1A1A1A',
                  background: activeId === c.id ? 'rgba(201,168,76,.1)' : 'transparent',
                  color: activeId === c.id ? '#C9A84C' : '#666',
                  fontSize: 12, cursor: 'pointer', transition: '.12s',
                }}
              >
                {c.icon} {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Menu categories ────────────────────────────────────── */}
      <div style={{ padding: '0 16px', maxWidth: 900, margin: '0 auto' }}>
        {loading ? (
          <div style={{ padding: '40px 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 14 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ background: '#0F0F0F', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ paddingTop: '66%', background: 'linear-gradient(90deg,#111 25%,#1A1A1A 50%,#111 75%)', backgroundSize: '200%', animation: 'shimmer 1.4s infinite' }}/>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ height: 14, background: '#1A1A1A', borderRadius: 4, marginBottom: 8 }}/>
                  <div style={{ height: 10, background: '#111', borderRadius: 4, width: '60%' }}/>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#555' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
            <div>Aucun résultat pour "{search}"</div>
          </div>
        ) : (
          filtered.map(cat => (
            <div
              key={cat.id}
              id={`cat-${cat.id}`}
              ref={el => { sectionRefs.current[cat.id] = el; }}
              style={{ paddingTop: 28, scrollMarginTop: 140 }}
            >
              {/* Category header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 24 }}>{cat.icon}</span>
                <div>
                  <div style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 22, color: '#F2EFE9' }}>
                    {cat.name}
                  </div>
                  <div style={{ fontSize: 10, color: '#555' }}>{cat.products.length} produits</div>
                </div>
              </div>

              {/* Products grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))',
                gap: 12,
                marginBottom: 8,
              }}>
                {cat.products.map(item => (
                  <MenuCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}
