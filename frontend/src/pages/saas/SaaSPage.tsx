import React from 'react';
import { useNavigate } from 'react-router-dom';

const features = [
  { icon:'🧾', title:'Caisse POS Intelligente', desc:'Interface tactile optimisée. Tables, tickets, TVA automatique, mode hors ligne.' },
  { icon:'🌐', title:'Site Web + Commandes', desc:'Menu digital, commandes en ligne, paiement et suivi en temps réel.' },
  { icon:'🛵', title:'Livraison & Intégrations', desc:'Gestion livraison interne + Glovo/Jumia dans une seule interface.' },
  { icon:'🏆', title:'Fidélité Clients', desc:'Bronze, Silver, Gold, Diamond avec points, badges et coupons.' },
  { icon:'📊', title:'Analytics', desc:'CA, ticket moyen, top produits, rapport mensuel et vision temps réel.' },
  { icon:'👥', title:'Gestion RH', desc:'Planning, pointage GPS, portail employés et suivi opérationnel.' },
];

export default function SaaSPage() {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight:'100vh', background:'#080808', color:'#F2EFE9', paddingBottom:40 }}>
      <header style={{ position:'sticky', top:0, zIndex:50, borderBottom:'1px solid rgba(255,255,255,.08)', background:'rgba(8,8,8,.88)', backdropFilter:'blur(18px)' }}>
        <div style={{ maxWidth:1240, margin:'0 auto', padding:'16px 24px', display:'flex', alignItems:'center', gap:16 }}>
          <button onClick={() => navigate('/')} style={{ border:'none', background:'none', color:'#C9A84C', fontFamily:'"Cinzel",serif', letterSpacing:4, cursor:'pointer', fontSize:18 }}>✦ LUX SaaS</button>
          <div style={{ marginLeft:'auto', display:'flex', gap:12 }}>
            <button onClick={() => navigate('/menu')} style={{ border:'1px solid rgba(255,255,255,.1)', background:'transparent', color:'#F2EFE9', borderRadius:999, padding:'10px 16px', cursor:'pointer' }}>Voir le menu</button>
            <button onClick={() => navigate('/order')} style={{ background:'#C9A84C', color:'#000', border:'none', borderRadius:999, padding:'10px 18px', fontWeight:700, cursor:'pointer' }}>Tester la commande</button>
          </div>
        </div>
      </header>

      <section style={{ position:'relative', overflow:'hidden', padding:'120px 24px 84px', textAlign:'center' }}>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at center, rgba(201,168,76,.08), transparent 55%)' }} />
        <div style={{ position:'relative', maxWidth:1040, margin:'0 auto' }}>
          <div style={{ display:'inline-flex', border:'1px solid rgba(201,168,76,.25)', borderRadius:999, padding:'8px 16px', fontSize:11, letterSpacing:4, textTransform:'uppercase', color:'#C9A84C' }}>Nouveau · Maroc 2026</div>
          <h1 style={{ fontFamily:'"Cormorant Garamond",serif', fontSize:'clamp(54px,8vw,98px)', fontWeight:300, lineHeight:0.96, margin:'24px 0 0' }}>
            Le système <span style={{ color:'#C9A84C' }}>tout-en-un</span><br/>pour votre café
          </h1>
          <p style={{ maxWidth:720, margin:'24px auto 0', color:'#B6B1A7', fontSize:17, lineHeight:1.85 }}>
            POS, commandes en ligne, livraison, fidélité, staff, analytics. Une seule plateforme, pensée pour les cafés marocains.
          </p>
        </div>
      </section>

      <section style={{ maxWidth:1180, margin:'0 auto', padding:'0 24px 70px' }}>
        <div style={{ display:'grid', gap:16, gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))' }}>
          {features.map((f) => (
            <div key={f.title} style={{ borderRadius:18, border:'1px solid rgba(255,255,255,.08)', background:'rgba(255,255,255,.04)', padding:22 }}>
              <div style={{ fontSize:30, marginBottom:12 }}>{f.icon}</div>
              <h3 style={{ fontFamily:'"Cormorant Garamond",serif', fontSize:28, color:'#C9A84C', margin:0 }}>{f.title}</h3>
              <p style={{ marginTop:10, color:'#B6B1A7', lineHeight:1.8, fontSize:14 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
