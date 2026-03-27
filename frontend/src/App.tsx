import { useState, useEffect } from 'react'

// ── Types ────────────────────────────────────────────────
type Route = '/' | '/menu' | '/portal/staff' | '/portal/pos' | '/app/customer'
const GOLD = '#C9A84C'

// ── Menu Data ────────────────────────────────────────────
const MENU_DATA = [
  { id:'pdej', icon:'🍳', title:'Petit-Déjeuner', sub:'Café noir offert', items:[
    {n:'Classic Breakfast',p:22,s:'Pain, oeuf, olives, fromage, confiture, Danone, JO'},
    {n:'Chamali',p:27,s:'2 oeufs, fromage, pain, jben, olives, JO, boisson chaude'},
    {n:'Omelette au Fromage',p:30,s:'Pain, omelette fromage rouge & mozzarella, JO'},
    {n:'Moroccan Breakfast',p:35,s:'Khlii, 2 oeufs, pain, olives, JO, boisson chaude',sig:true},
    {n:'Morning Lux',p:35,s:'2 oeufs, fromage, pain, salade de fruits, JO',sig:true},
  ]},
  { id:'cafes', icon:'☕', title:'Cafés Classiques', items:[
    {n:'Espresso',p:7},{n:'Espresso Prestige',p:9},{n:'Double Espresso',p:14},
    {n:'Café Séparé',p:12},{n:'Capsule',p:10},{n:'Lait Chocolat',p:12},
    {n:'Lait Chaud',p:9},{n:'Lait Verveine',p:12},{n:'Lait Aromatisé',p:10},
  ]},
  { id:'cremeux', icon:'🥛', title:'Les Crémeux', items:[
    {n:'Café Crème',p:10},{n:'Cappuccino',p:12},{n:'Café Chocolat',p:14},{n:'Chocolat Fondu',p:20},
  ]},
  { id:'infusions', icon:'🍵', title:'Infusions', items:[
    {n:'Thé Marocain',p:9},{n:'Golden Tea',p:9,s:'Tisane, Verveine, Lipton'},
    {n:'Thé Royal',p:20,sig:true,s:'+7 gâteaux marocains'},
  ]},
  { id:'jus', icon:'🥤', title:'Jus Purs Frais', items:[
    {n:'Banane',p:15},{n:'Pomme',p:15},{n:'Orange',p:16},{n:'Citron',p:16},
    {n:'Fruits de Saison',p:18},{n:'Mangue',p:19},{n:'Ananas',p:19},
    {n:'Avocat',p:20},{n:'Avocat Royal',p:25,sig:true,s:'+ fruits secs'},
  ]},
  { id:'sig', icon:'⭐', title:'Signature Lux', items:[
    {n:'Lux Matcha Bloom',p:20,sig:true,s:'Matcha premium + crémeux, avec 2 gâteaux'},
    {n:"Queen's Rose Coffee",p:30,sig:true,s:'Café lait, Milka, dattes, amandes, gâteaux'},
    {n:'Mojito',p:25},{n:'Panache LUX',p:25,s:'Orange ou lait'},
    {n:'Cocktail Royal',p:30},{n:'Zaazaa Lux',p:35,sig:true,s:'Must Try!'},
  ]},
  { id:'crepes', icon:'🥞', title:'Crêpes', items:[
    {n:'Crêpe Nutella',p:23},{n:'Crêpe Fruits',p:26},
    {n:'Crêpe Royale',p:30,sig:true,s:'Chocolat, banane, noix'},
    {n:'Crêpe Fromage',p:25},{n:'Crêpe Thon Fromage',p:35},{n:'Pack Crêpes',p:35,s:'5 crêpes nature'},
  ]},
  { id:'resto', icon:'🍽', title:'Restaurant', items:[
    {n:'LUX Power Toast',p:25,sig:true,s:'Oeufs, thon, fromage, pain de mie, légumes'},
    {n:'Harira',p:14},{n:'Meskouta',p:5},{n:'Cake Prestige',p:10},
    {n:'Sablés 7pcs',p:13},{n:'Sellou Portion',p:10},
    {n:'Plateau Gâteaux',p:100},{n:'Sellou 1 Kg',p:100},
    {n:'Salade Fruits Royale',p:40,s:'Citron, Orange, Ananas, Mangue, Avocat, Banane'},
  ]},
  { id:'soft', icon:'🥫', title:'Soft & Shakes', items:[
    {n:'Soda',p:12,s:'Coca, 7up, Fanta'},{n:'Red Bull',p:20},
    {n:'Milkshake Classic',p:35,s:'Fraise, Banane ou Vanille'},
  ]},
]

// ── HomePage ─────────────────────────────────────────────
function HomePage({ navigate }: { navigate: (r:Route)=>void }) {
  const [vis, setVis] = useState(false)
  useEffect(() => { setTimeout(() => setVis(true), 80) }, [])
  return (
    <div style={{minHeight:'100vh',background:'#0A0A0A',color:'#F0EDE8',fontFamily:"'DM Sans',sans-serif",overflowY:'auto',overflowX:'hidden'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=DM+Sans:wght@300;400;600&display=swap');
        @keyframes fu{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes glow{0%,100%{opacity:.5}50%{opacity:1}}
        .fu0{animation:fu .7s ease both}
        .fu1{animation:fu .7s .12s ease both}
        .fu2{animation:fu .7s .24s ease both}
        .fu3{animation:fu .7s .36s ease both}
        .pc{transition:all .25s}
        .pc:hover{transform:translateY(-5px);border-color:${GOLD}!important}
        .mb:hover{background:${GOLD}!important;color:#000!important}
        .ab:hover{background:rgba(201,168,76,.1)!important}
      `}</style>

      {/* Glow */}
      <div style={{position:'fixed',top:'25%',left:'50%',transform:'translateX(-50%)',width:500,height:500,background:'radial-gradient(circle,rgba(201,168,76,.07) 0%,transparent 70%)',pointerEvents:'none',zIndex:0}}/>

      <section style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',padding:'40px 24px',position:'relative',zIndex:1,opacity:vis?1:0,transition:'opacity .4s'}}>

        {/* Logo */}
        <div className="fu0" style={{width:68,height:68,borderRadius:16,background:`linear-gradient(135deg,${GOLD},#8B6E2F)`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Playfair Display',serif",fontSize:30,fontWeight:700,color:'#000',marginBottom:28,boxShadow:`0 0 40px rgba(201,168,76,.25)`}}>L</div>

        {/* Title */}
        <h1 className="fu1" style={{fontFamily:"'Playfair Display',serif",fontSize:'clamp(72px,13vw,130px)',fontWeight:700,lineHeight:1,marginBottom:10,background:`linear-gradient(135deg,#E8C97A,${GOLD},#8B6E2F)`,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>LUX</h1>

        <p className="fu1" style={{fontSize:11,letterSpacing:'.35em',color:GOLD,marginBottom:20,opacity:.75}}>TAZA · CAFÉ & PÂTISSERIE · 2026</p>

        <h2 className="fu2" style={{fontFamily:"'Playfair Display',serif",fontStyle:'italic',fontSize:'clamp(17px,2.5vw,24px)',fontWeight:400,color:'rgba(240,237,232,.6)',maxWidth:480,lineHeight:1.6,marginBottom:44}}>
          اكتشف أرقى نكهات القهوة والحلويات الفرنسية في قلب تازة
        </h2>

        {/* CTA Buttons */}
        <div className="fu3" style={{display:'flex',gap:14,flexWrap:'wrap',justifyContent:'center',marginBottom:64}}>
          <button className="mb" onClick={()=>navigate('/menu')} style={{padding:'13px 34px',background:GOLD,color:'#000',border:'none',borderRadius:50,fontFamily:"'DM Sans',sans-serif",fontSize:14,fontWeight:600,cursor:'pointer',transition:'all .2s',boxShadow:`0 6px 28px rgba(201,168,76,.28)`}}>
            📖 تصفح المنيو الرقمي
          </button>
          <button className="ab" onClick={()=>navigate('/app/customer')} style={{padding:'13px 34px',background:'transparent',color:GOLD,border:`1.5px solid ${GOLD}`,borderRadius:50,fontFamily:"'DM Sans',sans-serif",fontSize:14,fontWeight:500,cursor:'pointer',transition:'all .2s'}}>
            📱 تحميل التطبيق
          </button>
        </div>

        {/* Scroll line */}
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,opacity:.35,animation:'glow 2.5s infinite'}}>
          <div style={{width:1,height:36,background:GOLD}}/>
          <span style={{fontSize:9,letterSpacing:'.2em',color:GOLD}}>SCROLL</span>
        </div>
      </section>

      {/* Gold divider */}
      <div style={{height:1,background:`linear-gradient(90deg,transparent,${GOLD},transparent)`}}/>

      {/* Portal section */}
      <section style={{padding:'72px 24px',background:'#0D0D0D'}}>
        <div style={{maxWidth:900,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:48}}>
            <p style={{fontSize:10,letterSpacing:'.28em',color:GOLD,marginBottom:10,opacity:.65}}>ACCÈS RAPIDE</p>
            <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:'clamp(22px,4vw,34px)',color:'#F0EDE8',fontWeight:400}}>بوابات النظام</h3>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:14}}>
            {[
              {icon:'👥',label:'الموظفين',sub:'Staff Portal',path:'/portal/staff',c:GOLD},
              {icon:'🖥️',label:'نظام POS',sub:'Point de Vente',path:'/portal/pos',c:'#3DBE7A'},
              {icon:'📖',label:'المنيو',sub:'Menu Digital',path:'/menu',c:'#5B8DEF'},
              {icon:'📱',label:'الزبائن',sub:'Application',path:'/app/customer',c:'#E07830'},
            ].map(item=>(
              <div key={item.path} className="pc" onClick={()=>navigate(item.path as Route)} style={{padding:'28px 20px',background:'#121212',border:'1px solid #1C1C1C',borderRadius:14,textAlign:'center',cursor:'pointer'}}>
                <div style={{fontSize:32,marginBottom:12}}>{item.icon}</div>
                <div style={{fontSize:15,fontWeight:600,color:'#F0EDE8',marginBottom:3}}>{item.label}</div>
                <div style={{fontSize:10,color:'#444',letterSpacing:'.05em'}}>{item.sub}</div>
                <div style={{width:28,height:2,background:item.c,borderRadius:2,margin:'14px auto 0',opacity:.55}}/>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <div style={{height:1,background:`linear-gradient(90deg,transparent,${GOLD},transparent)`}}/>
      <footer style={{padding:'20px',textAlign:'center',background:'#0A0A0A',fontSize:10,color:'#2A2A2A',letterSpacing:'.1em'}}>
        © 2026 CAFÉ LUX · TAZA · MAROC · +212 808 524 169
      </footer>
    </div>
  )
}

// ── MenuPage ─────────────────────────────────────────────
function MenuPage({ navigate }: { navigate: (r:Route)=>void }) {
  const [activeId, setActiveId] = useState('pdej')
  const cat = MENU_DATA.find(c=>c.id===activeId)||MENU_DATA[0]
  return (
    <div style={{minHeight:'100vh',background:'#FAF8F2',fontFamily:"'DM Sans',sans-serif",display:'flex',flexDirection:'column'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@400;600&display=swap');
        .cb{transition:all .18s}.cb:hover{background:rgba(201,168,76,.1)!important;color:#1A0A00!important}
        .cb.on{background:${GOLD}!important;color:#000!important;font-weight:600}
        .mc{transition:all .18s;cursor:pointer}.mc:hover{border-color:${GOLD}!important;transform:translateY(-3px);box-shadow:0 6px 20px rgba(201,168,76,.1)}
      `}</style>

      {/* Header */}
      <div style={{background:'linear-gradient(135deg,#1A0A00,#2D1500)',padding:'12px 18px',display:'flex',alignItems:'center',gap:12,position:'sticky',top:0,zIndex:10,flexShrink:0}}>
        <button onClick={()=>navigate('/')} style={{background:'rgba(255,255,255,.1)',border:'none',color:'#fff',padding:'6px 14px',borderRadius:8,cursor:'pointer',fontSize:13}}>← Retour</button>
        <span style={{fontFamily:"'Playfair Display',serif",color:GOLD,fontSize:17}}>★ Café Lux</span>
        <span style={{fontSize:10,color:'rgba(255,255,255,.35)',letterSpacing:'.1em'}}>TAZA</span>
        <div style={{marginLeft:'auto',background:GOLD,color:'#000',padding:'7px 14px',borderRadius:18,fontSize:11,fontWeight:700}}>
          🚚 Livraison 15 DH — Gratuite dès 200 DH
        </div>
      </div>

      {/* Body */}
      <div style={{display:'flex',flex:1,overflow:'hidden'}}>
        {/* Sidebar */}
        <div style={{width:175,background:'#fff',padding:10,overflowY:'auto',flexShrink:0,borderRight:'1px solid #EDE5D5'}}>
          <div style={{fontSize:10,color:'#999',marginBottom:8,fontWeight:600,letterSpacing:'.05em'}}>MENU</div>
          {MENU_DATA.map(c=>(
            <button key={c.id} className={`cb${activeId===c.id?' on':''}`} onClick={()=>setActiveId(c.id)}
              style={{width:'100%',textAlign:'left',padding:'8px 9px',border:'none',background:'none',fontFamily:"'DM Sans',sans-serif",fontSize:12,cursor:'pointer',borderRadius:7,color:'#666',display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
              <span>{c.icon}</span><span>{c.title}</span>
            </button>
          ))}
        </div>

        {/* Items */}
        <div style={{flex:1,padding:'18px 22px',overflowY:'auto'}}>
          <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:'#1A0A00',marginBottom:3}}>{cat.icon} {cat.title}</h2>
          {(cat as any).sub && <p style={{fontSize:11,color:'#999',marginBottom:18}}>{(cat as any).sub}</p>}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(175px,1fr))',gap:11}}>
            {cat.items.map((item:any,i:number)=>(
              <div key={i} className="mc" style={{background:'#fff',border:`1.5px solid ${item.sig?'rgba(201,168,76,.4)':'#EDE5D5'}`,borderRadius:11,overflow:'hidden'}}>
                <div style={{width:'100%',height:100,background:item.sig?'linear-gradient(135deg,rgba(201,168,76,.15),rgba(201,168,76,.05))':'linear-gradient(135deg,#F5F0E5,#EDE5D5)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:32}}>
                  {item.sig?'⭐':cat.icon}
                </div>
                <div style={{padding:'9px 11px'}}>
                  <div style={{fontSize:12,fontWeight:600,color:'#1A0A00',marginBottom:3,lineHeight:1.3}}>{item.n}</div>
                  {item.s&&<div style={{fontSize:10,color:'#999',marginBottom:7,lineHeight:1.4}}>{item.s}</div>}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:GOLD,fontWeight:600}}>{item.p} DH</span>
                    {item.sig&&<span style={{background:'rgba(201,168,76,.15)',color:GOLD,fontSize:8,padding:'2px 6px',borderRadius:9,fontWeight:600,letterSpacing:'.05em'}}>SIGNATURE</span>}
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

// ── CustomerApp ───────────────────────────────────────────
function CustomerApp({ navigate }: { navigate: (r:Route)=>void }) {
  return (
    <div style={{minHeight:'100vh',background:'#0A0A0A',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:"'DM Sans',sans-serif",padding:24,textAlign:'center'}}>
      <div style={{width:72,height:72,borderRadius:18,background:`linear-gradient(135deg,${GOLD},#8B6E2F)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:30,fontWeight:700,color:'#000',marginBottom:22,fontFamily:"'Playfair Display',serif"}}>L</div>
      <h1 style={{fontFamily:"'Playfair Display',serif",color:GOLD,fontSize:32,marginBottom:6}}>Café LUX</h1>
      <p style={{color:'#444',fontSize:13,marginBottom:36,letterSpacing:'.12em'}}>APPLICATION ZIBANA · قريباً</p>
      <div style={{display:'flex',flexDirection:'column',gap:11,width:'100%',maxWidth:300,marginBottom:32}}>
        {[{icon:'🍎',store:'App Store'},{icon:'🤖',store:'Google Play'}].map(b=>(
          <button key={b.store} style={{padding:'15px 22px',background:'#161616',color:'#F0EDE8',border:'1px solid #2A2A2A',borderRadius:13,fontFamily:"'DM Sans',sans-serif",fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
            <span style={{fontSize:22}}>{b.icon}</span>
            <div style={{textAlign:'left'}}><div style={{fontSize:9,color:'#555',letterSpacing:'.08em'}}>BIENTÔT SUR</div><div style={{fontWeight:600}}>{b.store}</div></div>
          </button>
        ))}
      </div>
      <div style={{padding:'14px 22px',background:'rgba(201,168,76,.07)',borderRadius:11,border:`1px solid rgba(201,168,76,.18)`,maxWidth:300}}>
        <p style={{fontSize:12,color:GOLD,marginBottom:3,fontWeight:600}}>📞 للطلب الآن</p>
        <p style={{fontSize:17,color:'#F0EDE8',fontWeight:600}}>+212 808 524 169</p>
        <p style={{fontSize:10,color:'#444',marginTop:3}}>Livraison 15 DH — Gratuite dès 200 DH</p>
      </div>
      <button onClick={()=>navigate('/')} style={{marginTop:28,padding:'9px 22px',background:'transparent',color:'#444',border:'1px solid #1C1C1C',borderRadius:50,cursor:'pointer',fontSize:12}}>← الرجوع للرئيسية</button>
    </div>
  )
}

// ── POSPage ───────────────────────────────────────────────
function POSPage({ navigate }: { navigate: (r:Route)=>void }) {
  return (
    <div style={{minHeight:'100vh',background:'#0D0D0D',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:"'DM Sans',sans-serif",textAlign:'center'}}>
      <div style={{fontSize:44,marginBottom:14}}>🖥️</div>
      <h2 style={{fontFamily:"'Playfair Display',serif",color:GOLD,fontSize:26,marginBottom:6}}>نظام POS</h2>
      <p style={{color:'#444',fontSize:13,marginBottom:28}}>Point de Vente — Accès Caissier</p>
      <button onClick={()=>navigate('/portal/staff')} style={{padding:'11px 26px',background:GOLD,color:'#000',border:'none',borderRadius:50,fontWeight:600,cursor:'pointer',fontSize:13}}>← بوابة الموظفين</button>
    </div>
  )
}

// ── Main App Router ───────────────────────────────────────
export default function App() {
  const [route, setRoute] = useState<Route>('/')

  useEffect(() => {
    const path = window.location.pathname
    const valid: Route[] = ['/', '/menu', '/portal/staff', '/portal/pos', '/app/customer']
    setRoute(valid.includes(path as Route) ? path as Route : '/')
  }, [])

  const navigate = (path: Route) => {
    window.history.pushState({}, '', path)
    setRoute(path)
  }

  // Portal/staff → existing PinLogin (keep original route)
  if (route === '/portal/staff') {
    // Redirect to root where PinLogin lives
    window.history.replaceState({}, '', '/')
    setRoute('/')
  }

  switch (route) {
    case '/menu':         return <MenuPage navigate={navigate} />
    case '/portal/pos':   return <POSPage navigate={navigate} />
    case '/app/customer': return <CustomerApp navigate={navigate} />
    default:              return <HomePage navigate={navigate} />
  }
}
