import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function SmartHomeHero() {
  const navigate = useNavigate();
  return (
    <section style={{ position:'relative', overflow:'hidden', borderBottom:'1px solid rgba(255,255,255,.08)', background:'#080808', color:'#F2EFE9', padding:'96px 24px 72px' }}>
      <div style={{ pointerEvents:'none', position:'absolute', inset:0, background:'radial-gradient(circle at top, rgba(201,168,76,.12), transparent 45%)' }} />
      <div style={{ position:'relative', maxWidth:1180, margin:'0 auto', display:'grid', gap:24, alignItems:'center', gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))' }}>
        <div>
          <div style={{ marginBottom:14, fontSize:11, letterSpacing:5, textTransform:'uppercase', color:'#C9A84C' }}>Café LUX · Taza</div>
          <h1 style={{ fontFamily:'"Cormorant Garamond",serif', fontWeight:300, fontSize:'clamp(46px,8vw,88px)', lineHeight:0.96, margin:0 }}>
            Menu premium.<br/>Commande simple.<br/><span style={{ color:'#C9A84C' }}>Expérience LUX.</span>
          </h1>
          <p style={{ marginTop:22, maxWidth:560, fontSize:16, lineHeight:1.8, color:'#B6B1A7' }}>
            Découvrez nos boissons signatures, commandez en ligne et profitez d'une expérience café moderne, élégante et rapide.
            Si vous gérez un café, découvrez aussi LUX SaaS.
          </p>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginTop:28 }}>
            <button onClick={() => navigate('/menu')} style={{ padding:'14px 28px', borderRadius:12, border:'none', background:'#C9A84C', color:'#000', fontWeight:700, cursor:'pointer' }}>Voir le menu</button>
            <button onClick={() => navigate('/order')} style={{ padding:'14px 28px', borderRadius:12, border:'1px solid rgba(255,255,255,.12)', background:'transparent', color:'#F2EFE9', cursor:'pointer' }}>Commander</button>
          </div>
        </div>
        <div style={{ display:'grid', gap:14 }}>
          <div style={{ borderRadius:24, border:'1px solid rgba(255,255,255,.08)', background:'rgba(255,255,255,.04)', backdropFilter:'blur(16px)', padding:24 }}>
            <div style={{ marginBottom:8, fontSize:11, letterSpacing:4, textTransform:'uppercase', color:'#C9A84C' }}>Pour les clients</div>
            <h3 style={{ fontFamily:'"Cormorant Garamond",serif', fontSize:34, margin:0 }}>Menu, livraison, fidélité</h3>
            <p style={{ marginTop:10, fontSize:14, lineHeight:1.8, color:'#B6B1A7' }}>Commandes en ligne, suivi, rewards et wallet dans une seule expérience élégante.</p>
            <button onClick={() => navigate('/app/customer')} style={{ marginTop:18, padding:'12px 20px', borderRadius:12, border:'1px solid rgba(201,168,76,.25)', background:'transparent', color:'#C9A84C', cursor:'pointer' }}>Ouvrir l'espace client</button>
          </div>
          <div style={{ borderRadius:24, border:'1px solid rgba(201,168,76,.25)', background:'linear-gradient(135deg,#120A00,rgba(201,168,76,.08))', padding:24 }}>
            <div style={{ marginBottom:8, fontSize:11, letterSpacing:4, textTransform:'uppercase', color:'#C9A84C' }}>Pour les professionnels</div>
            <h3 style={{ fontFamily:'"Cormorant Garamond",serif', fontSize:34, margin:0, color:'#C9A84C' }}>LUX SaaS</h3>
            <p style={{ marginTop:10, fontSize:14, lineHeight:1.8, color:'#D7D0C4' }}>POS, commandes en ligne, RH, analytics, fidélité et delivery dans une seule plateforme.</p>
            <button onClick={() => navigate('/business')} style={{ marginTop:18, padding:'12px 20px', borderRadius:12, border:'none', background:'#C9A84C', color:'#000', fontWeight:700, cursor:'pointer' }}>Découvrir LUX SaaS</button>
          </div>
        </div>
      </div>
    </section>
  );
}
