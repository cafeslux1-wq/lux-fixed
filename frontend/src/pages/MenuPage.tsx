import { useState } from 'react'

type Navigate = (path: any) => void

const GOLD = '#C9A84C'

const MENU = [
  { id: 'pdej', icon: '🍳', title: 'Petit-Déjeuner', sub: 'Café noir offert', items: [
    { n: 'Classic Breakfast', p: 22, s: 'Pain, oeuf, olives, fromage, confiture, Danone, JO' },
    { n: 'Chamali', p: 27, s: '2 oeufs, fromage, pain, jben, olives, JO, boisson chaude' },
    { n: 'Omelette au Fromage', p: 30, s: 'Pain, omelette fromage rouge & mozzarella, JO' },
    { n: 'Moroccan Breakfast', p: 35, s: 'Khlii, 2 oeufs, pain, olives, JO, boisson chaude', sig: true },
    { n: 'Morning Lux', p: 35, s: '2 oeufs, fromage, pain, salade de fruits, JO', sig: true },
  ]},
  { id: 'cafes', icon: '☕', title: 'Cafés Classiques', items: [
    { n: 'Espresso', p: 7 },
    { n: 'Espresso Prestige', p: 9 },
    { n: 'Double Espresso', p: 14 },
    { n: 'Café Séparé', p: 12 },
    { n: 'Capsule', p: 10 },
    { n: 'Lait Chocolat', p: 12 },
    { n: 'Lait Chaud', p: 9 },
    { n: 'Lait Verveine', p: 12 },
    { n: 'Lait Aromatisé', p: 10 },
  ]},
  { id: 'cremeux', icon: '🥛', title: 'Les Crémeux', items: [
    { n: 'Café Crème', p: 10 },
    { n: 'Cappuccino', p: 12 },
    { n: 'Café Chocolat', p: 14 },
    { n: 'Chocolat Fondu', p: 20 },
  ]},
  { id: 'infusions', icon: '🍵', title: 'Infusions', items: [
    { n: 'Thé Marocain', p: 9 },
    { n: 'Golden Tea', p: 9, s: 'Tisane, Verveine, Lipton' },
    { n: 'Thé Royal', p: 20, sig: true, s: '+7 gâteaux marocains' },
  ]},
  { id: 'jus', icon: '🥤', title: 'Jus Purs Frais', items: [
    { n: 'Banane', p: 15 },
    { n: 'Pomme', p: 15 },
    { n: 'Orange', p: 16 },
    { n: 'Citron', p: 16 },
    { n: 'Fruits de Saison', p: 18 },
    { n: 'Mangue', p: 19 },
    { n: 'Ananas', p: 19 },
    { n: 'Avocat', p: 20 },
    { n: 'Avocat Royal', p: 25, sig: true, s: '+ fruits secs' },
  ]},
  { id: 'sig', icon: '⭐', title: 'Signature Lux', items: [
    { n: 'Lux Matcha Bloom', p: 20, sig: true, s: 'Matcha premium + crémeux, avec 2 gâteaux' },
    { n: "Queen's Rose Coffee", p: 30, sig: true, s: 'Café lait, Milka, dattes, amandes, gâteaux' },
    { n: 'Mojito', p: 25 },
    { n: 'Panache LUX', p: 25, s: 'Orange ou lait' },
    { n: 'Cocktail Royal', p: 30 },
    { n: 'Zaazaa Lux', p: 35, sig: true, s: 'Must Try!' },
  ]},
  { id: 'crepes', icon: '🥞', title: 'Crêpes', items: [
    { n: 'Crêpe Nutella', p: 23 },
    { n: 'Crêpe Fruits', p: 26 },
    { n: 'Crêpe Royale', p: 30, sig: true, s: 'Chocolat, banane, noix' },
    { n: 'Crêpe Fromage', p: 25 },
    { n: 'Crêpe Thon Fromage', p: 35 },
    { n: 'Pack Crêpes', p: 35, s: '5 crêpes nature' },
  ]},
  { id: 'resto', icon: '🍽', title: 'Restaurant', items: [
    { n: 'LUX Power Toast', p: 25, sig: true, s: 'Oeufs, thon, fromage, pain de mie, légumes' },
    { n: 'Harira', p: 14 },
    { n: 'Meskouta', p: 5 },
    { n: 'Cake Prestige', p: 10 },
    { n: 'Sablés 7pcs', p: 13 },
    { n: 'Sellou Portion', p: 10 },
    { n: 'Plateau Gâteaux', p: 100 },
    { n: 'Sellou 1 Kg', p: 100 },
    { n: 'Salade Fruits Royale', p: 40, s: 'Citron, Orange, Ananas, Mangue, Avocat, Banane' },
  ]},
  { id: 'soft', icon: '🥫', title: 'Soft & Shakes', items: [
    { n: 'Soda', p: 12, s: 'Coca, 7up, Fanta' },
    { n: 'Red Bull', p: 20 },
    { n: 'Milkshake Classic', p: 35, s: 'Fraise, Banane ou Vanille' },
  ]},
]

export default function MenuPage({ navigate }: { navigate: Navigate }) {
  const [activeId, setActiveId] = useState('pdej')
  const activeCategory = MENU.find(c => c.id === activeId) || MENU[0]

  return (
    <div style={{
      minHeight: '100vh',
      background: '#FAF8F2',
      fontFamily: "'DM Sans', sans-serif",
      display: 'flex',
      flexDirection: 'column',
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />

      <style>{`
        .cat-btn { transition: all .2s; }
        .cat-btn:hover { background: rgba(201,168,76,.1) !important; color: #1A0A00 !important; }
        .cat-btn.active { background: ${GOLD} !important; color: #000 !important; font-weight: 600; }
        .menu-card { transition: all .2s; cursor: pointer; }
        .menu-card:hover { border-color: ${GOLD} !important; transform: translateY(-3px); box-shadow: 0 8px 24px rgba(201,168,76,.12); }
        .back-btn:hover { background: rgba(0,0,0,.06) !important; }
      `}</style>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1A0A00, #2D1500)',
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <button
          className="back-btn"
          onClick={() => navigate('/')}
          style={{
            background: 'rgba(255,255,255,.1)',
            border: 'none',
            color: '#fff',
            padding: '7px 14px',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 13,
          }}>← Retour</button>

        <div style={{ fontFamily: "'Playfair Display', serif", color: GOLD, fontSize: 18 }}>★ Café Lux</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', letterSpacing: '.1em' }}>
          CAFÉ & PÂTISSERIE · TAZA
        </div>

        <div style={{
          marginLeft: 'auto',
          background: GOLD,
          color: '#000',
          padding: '8px 16px',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 700,
        }}>
          🚚 Livraison 15 DH — Gratuite dès 200 DH
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1 }}>
        {/* Sidebar categories */}
        <div style={{
          width: 180,
          background: '#fff',
          padding: 12,
          overflowY: 'auto',
          flexShrink: 0,
          borderRight: '1px solid #EDE5D5',
          position: 'sticky',
          top: 53,
          height: 'calc(100vh - 53px)',
        }}>
          <div style={{ fontSize: 11, color: '#999', marginBottom: 10, fontWeight: 600, letterSpacing: '.05em' }}>
            MENU
          </div>
          {MENU.map(cat => (
            <button
              key={cat.id}
              className={`cat-btn ${activeId === cat.id ? 'active' : ''}`}
              onClick={() => setActiveId(cat.id)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '9px 10px',
                border: 'none',
                background: 'none',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                cursor: 'pointer',
                borderRadius: 8,
                color: '#666',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                marginBottom: 2,
              }}>
              <span>{cat.icon}</span>
              <span>{cat.title}</span>
            </button>
          ))}
        </div>

        {/* Menu items */}
        <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto' }}>
          <h2 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 24,
            color: '#1A0A00',
            marginBottom: 4,
          }}>
            {activeCategory.icon} {activeCategory.title}
          </h2>
          {(activeCategory as any).sub && (
            <p style={{ fontSize: 12, color: '#999', marginBottom: 20 }}>{(activeCategory as any).sub}</p>
          )}

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 12,
          }}>
            {activeCategory.items.map((item: any, i) => (
              <div
                key={i}
                className="menu-card"
                style={{
                  background: '#fff',
                  border: `1.5px solid ${item.sig ? 'rgba(201,168,76,.4)' : '#EDE5D5'}`,
                  borderRadius: 12,
                  overflow: 'hidden',
                }}>
                {/* Image placeholder */}
                <div style={{
                  width: '100%',
                  height: 110,
                  background: item.sig
                    ? 'linear-gradient(135deg, rgba(201,168,76,.15), rgba(201,168,76,.05))'
                    : 'linear-gradient(135deg, #F5F0E5, #EDE5D5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 36,
                }}>
                  {item.sig ? '⭐' : activeCategory.icon}
                </div>

                <div style={{ padding: '10px 12px' }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#1A0A00',
                    marginBottom: 3,
                    lineHeight: 1.3,
                  }}>{item.n}</div>

                  {item.s && (
                    <div style={{
                      fontSize: 10,
                      color: '#999',
                      marginBottom: 8,
                      lineHeight: 1.4,
                    }}>{item.s}</div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontFamily: "'Playfair Display', serif",
                      fontSize: 16,
                      color: GOLD,
                      fontWeight: 600,
                    }}>{item.p} DH</span>

                    {item.sig && (
                      <span style={{
                        background: 'rgba(201,168,76,.15)',
                        color: GOLD,
                        fontSize: 9,
                        padding: '2px 7px',
                        borderRadius: 10,
                        fontWeight: 600,
                        letterSpacing: '.05em',
                      }}>SIGNATURE</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
