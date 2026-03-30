import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../lib/store';

export function Navbar() {
  const { state } = useApp() as any;
  const navigate = useNavigate();
  const location = useLocation();
  const at = (p: string) => location.pathname === p || location.pathname.startsWith(p + '/');
  const cartQty = state?.cartQty ?? 0;
  const apiStatus = state?.apiStatus ?? 'online';
  const apiColor = apiStatus === 'online' ? '#3DBE7A' : apiStatus === 'offline' ? '#E05252' : '#555';

  return (
    <nav style={{ position:'sticky', top:0, zIndex:100, background:'rgba(8,8,8,.96)', backdropFilter:'blur(20px)', borderBottom:'1px solid #0D0D0D', padding:'0 16px', height:58, display:'flex', alignItems:'center', gap:8 }}>
      <button onClick={() => navigate('/')} style={{ background:'none', border:'none', cursor:'pointer', fontFamily:'"Cinzel",serif', color:'#C9A84C', fontSize:18, letterSpacing:5, padding:'0 8px', marginRight:6 }}>✦ LUX</button>
      <div style={{ display:'flex', gap:2, flex:1, overflow:'hidden' }}>
        {[{label:'Menu',path:'/menu'},{label:'Commander',path:'/order'},{label:'Business',path:'/business'}].map(({label,path}) => (
          <button key={path} onClick={() => navigate(path)} style={{ background:'none', border:'none', cursor:'pointer', padding:'6px 10px', borderRadius:8, fontSize:12, color:at(path)?'#C9A84C':'#666', fontWeight:at(path)?600:400, whiteSpace:'nowrap' }}>{label}</button>
        ))}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginLeft:'auto' }}>
        <div title={`API: ${apiStatus}`} style={{ width:6, height:6, borderRadius:'50%', background:apiColor, flexShrink:0 }} />
        <button onClick={() => navigate('/app/customer')} style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, padding:4, color:at('/app/customer')?'#C9A84C':'#555' }}>👤</button>
        <button onClick={() => navigate('/order')} style={{ position:'relative', background:'none', border:'none', cursor:'pointer', fontSize:18, padding:4 }}>
          🛒
          {cartQty > 0 && <span style={{ position:'absolute', top:-3, right:-3, background:'#C9A84C', color:'#000', width:17, height:17, borderRadius:'50%', fontSize:9, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>{cartQty}</span>}
        </button>
      </div>
    </nav>
  );
}

export function BottomNav() {
  const { state } = useApp() as any;
  const cartQty = state?.cartQty ?? 0;
  const navigate = useNavigate();
  const location = useLocation();
  const at = (p: string) => location.pathname === p || location.pathname.startsWith(p + '/');
  const tabs = [
    { icon:'🏠', label:'Accueil', path:'/' },
    { icon:'☕', label:'Menu', path:'/menu' },
    { icon:'🛒', label:'Panier', path:'/order', badge:cartQty },
    { icon:'💼', label:'Business', path:'/business' },
    { icon:'👤', label:'Compte', path:'/app/customer' },
  ];
  return (
    <div style={{ position:'fixed', left:0, right:0, bottom:0, zIndex:90, background:'rgba(8,8,8,.97)', backdropFilter:'blur(20px)', borderTop:'1px solid #0D0D0D', display:'grid', gridTemplateColumns:'repeat(5,1fr)' }}>
      {tabs.map(t => (
        <button key={t.path} onClick={() => navigate(t.path)} style={{ position:'relative', border:'none', background:'none', color:at(t.path)?'#C9A84C':'#666', padding:'10px 4px 12px', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
          <span style={{ fontSize:18 }}>{t.icon}</span>
          <span style={{ fontSize:10 }}>{t.label}</span>
          {t.badge ? <span style={{ position:'absolute', top:6, right:'28%', background:'#C9A84C', color:'#000', minWidth:16, height:16, padding:'0 4px', borderRadius:999, fontSize:9, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>{t.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}
