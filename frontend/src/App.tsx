import { useState, useEffect } from 'react'
const GOLD = '#C9A84C'
type R = '/'|'/menu'|'/portal/staff'|'/app/customer'
const MENU=[{id:'pdej',icon:'🍳',title:'Petit-Déjeuner',sub:'Café noir offert',items:[{n:'Classic Breakfast',p:22,s:'Pain, oeuf, olives, fromage'},{n:'Chamali',p:27,s:'2 oeufs, fromage, pain, jben'},{n:'Omelette au Fromage',p:30},{n:'Moroccan Breakfast',p:35,sig:true},{n:'Morning Lux',p:35,sig:true}]},{id:'cafes',icon:'☕',title:'Cafés Classiques',items:[{n:'Espresso',p:7},{n:'Espresso Prestige',p:9},{n:'Double Espresso',p:14},{n:'Café Séparé',p:12},{n:'Capsule',p:10},{n:'Lait Chocolat',p:12},{n:'Lait Chaud',p:9}]},{id:'cremeux',icon:'🥛',title:'Les Crémeux',items:[{n:'Café Crème',p:10},{n:'Cappuccino',p:12},{n:'Café Chocolat',p:14},{n:'Chocolat Fondu',p:20}]},{id:'infusions',icon:'🍵',title:'Infusions',items:[{n:'Thé Marocain',p:9},{n:'Golden Tea',p:9},{n:'Thé Royal',p:20,sig:true}]},{id:'jus',icon:'🥤',title:'Jus Frais',items:[{n:'Banane',p:15},{n:'Orange',p:16},{n:'Citron',p:16},{n:'Mangue',p:19},{n:'Avocat',p:20},{n:'Avocat Royal',p:25,sig:true}]},{id:'sig',icon:'⭐',title:'Signature Lux',items:[{n:'Lux Matcha Bloom',p:20,sig:true},{n:"Queen's Rose Coffee",p:30,sig:true},{n:'Mojito',p:25},{n:'Zaazaa Lux',p:35,sig:true}]},{id:'crepes',icon:'🥞',title:'Crêpes',items:[{n:'Crêpe Nutella',p:23},{n:'Crêpe Royale',p:30,sig:true},{n:'Crêpe Fromage',p:25},{n:'Crêpe Thon',p:35}]},{id:'soft',icon:'🥫',title:'Soft & Shakes',items:[{n:'Soda',p:12},{n:'Red Bull',p:20},{n:'Milkshake',p:35}]}]
function Home({go}:{go:(r:R)=>void}){
  const[v,sv]=useState(false)
  useEffect(()=>{setTimeout(()=>sv(true),80)},[])
  return <div style={{minHeight:'100vh',background:'#0A0A0A',color:'#F0EDE8',fontFamily:"'DM Sans',sans-serif",overflowY:'auto'}}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=DM+Sans:wght@300;400;600&display=swap');@keyframes fu{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}.a0{animation:fu .7s ease both}.a1{animation:fu .7s .12s ease both}.a2{animation:fu .7s .24s ease both}.a3{animation:fu .7s .36s ease both}.pc{transition:all .25s}.pc:hover{transform:translateY(-5px);border-color:${GOLD}!important}.mb:hover{background:${GOLD}!important;color:#000!important}.ab:hover{background:rgba(201,168,76,.1)!important}`}</style>
    <div style={{position:'fixed',top:'25%',left:'50%',transform:'translateX(-50%)',width:500,height:500,background:'radial-gradient(circle,rgba(201,168,76,.07) 0%,transparent 70%)',pointerEvents:'none'}}/>
    <section style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',padding:'40px 24px',opacity:v?1:0,transition:'opacity .4s',position:'relative',zIndex:1}}>
      <div className="a0" style={{width:68,height:68,borderRadius:16,background:`linear-gradient(135deg,${GOLD},#8B6E2F)`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Playfair Display',serif",fontSize:30,fontWeight:700,color:'#000',marginBottom:28,boxShadow:`0 0 40px rgba(201,168,76,.25)`}}>L</div>
      <h1 className="a1" style={{fontFamily:"'Playfair Display',serif",fontSize:'clamp(72px,13vw,130px)',fontWeight:700,lineHeight:1,marginBottom:10,background:`linear-gradient(135deg,#E8C97A,${GOLD},#8B6E2F)`,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>LUX</h1>
      <p className="a1" style={{fontSize:11,letterSpacing:'.35em',color:GOLD,marginBottom:20,opacity:.75}}>TAZA · CAFÉ & PÂTISSERIE · 2026</p>
      <h2 className="a2" style={{fontFamily:"'Playfair Display',serif",fontStyle:'italic',fontSize:'clamp(16px,2.5vw,22px)',fontWeight:400,color:'rgba(240,237,232,.6)',maxWidth:460,lineHeight:1.6,marginBottom:44}}>اكتشف أرقى نكهات القهوة والحلويات الفرنسية في قلب تازة</h2>
      <div className="a3" style={{display:'flex',gap:14,flexWrap:'wrap',justifyContent:'center',marginBottom:60}}>
        <button className="mb" onClick={()=>go('/menu')} style={{padding:'13px 34px',background:GOLD,color:'#000',border:'none',borderRadius:50,fontFamily:"'DM Sans',sans-serif",fontSize:14,fontWeight:600,cursor:'pointer',transition:'all .2s',boxShadow:`0 6px 28px rgba(201,168,76,.28)`}}>📖 تصفح المنيو الرقمي</button>
        <button className="ab" onClick={()=>go('/app/customer')} style={{padding:'13px 34px',background:'transparent',color:GOLD,border:`1.5px solid ${GOLD}`,borderRadius:50,fontFamily:"'DM Sans',sans-serif",fontSize:14,cursor:'pointer',transition:'all .2s'}}>📱 تحميل التطبيق</button>
      </div>
    </section>
    <div style={{height:1,background:`linear-gradient(90deg,transparent,${GOLD},transparent)`}}/>
    <section style={{padding:'64px 24px',background:'#0D0D0D'}}>
      <div style={{maxWidth:880,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:44}}>
          <p style={{fontSize:10,letterSpacing:'.28em',color:GOLD,marginBottom:10,opacity:.65}}>ACCÈS RAPIDE</p>
          <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:'clamp(20px,4vw,32px)',color:'#F0EDE8',fontWeight:400}}>بوابات النظام</h3>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(185px,1fr))',gap:13}}>
          {[{icon:'👥',label:'الموظفين',sub:'Staff Portal',path:'/portal/staff',c:GOLD},{icon:'📖',label:'المنيو',sub:'Menu Digital',path:'/menu',c:'#5B8DEF'},{icon:'📱',label:'الزبائن',sub:'Application',path:'/app/customer',c:'#E07830'},{icon:'📞',label:'اتصل بنا',sub:'+212 808 524 169',path:'tel:+212808524169',c:'#3DBE7A'}].map(item=>(
            <div key={item.path} className="pc" onClick={()=>item.path.startsWith('tel')?window.location.href=item.path:go(item.path as R)} style={{padding:'26px 18px',background:'#121212',border:'1px solid #1C1C1C',borderRadius:13,textAlign:'center',cursor:'pointer'}}>
              <div style={{fontSize:30,marginBottom:11}}>{item.icon}</div>
              <div style={{fontSize:14,fontWeight:600,color:'#F0EDE8',marginBottom:3}}>{item.label}</div>
              <div style={{fontSize:10,color:'#444',letterSpacing:'.05em'}}>{item.sub}</div>
              <div style={{width:26,height:2,background:item.c,borderRadius:2,margin:'13px auto 0',opacity:.55}}/>
            </div>
          ))}
        </div>
      </div>
    </section>
    <div style={{height:1,background:`linear-gradient(90deg,transparent,${GOLD},transparent)`}}/>
    <footer style={{padding:'18px',textAlign:'center',background:'#0A0A0A',fontSize:10,color:'#2A2A2A',letterSpacing:'.1em'}}>© 2026 CAFÉ LUX · TAZA · MAROC · +212 808 524 169</footer>
  </div>
}
function Menu({go}:{go:(r:R)=>void}){
  const[id,sid]=useState('pdej')
  const cat=MENU.find(c=>c.id===id)||MENU[0]
  return <div style={{minHeight:'100vh',background:'#FAF8F2',fontFamily:"'DM Sans',sans-serif",display:'flex',flexDirection:'column'}}>
    <style>{`.cb{transition:all .18s}.cb:hover{background:rgba(201,168,76,.1)!important;color:#1A0A00!important}.cb.on{background:${GOLD}!important;color:#000!important;font-weight:600}.mc{transition:all .18s;cursor:pointer}.mc:hover{border-color:${GOLD}!important;transform:translateY(-2px)}`}</style>
    <div style={{background:'linear-gradient(135deg,#1A0A00,#2D1500)',padding:'11px 18px',display:'flex',alignItems:'center',gap:12,position:'sticky',top:0,zIndex:10,flexShrink:0}}>
      <button onClick={()=>go('/')} style={{background:'rgba(255,255,255,.1)',border:'none',color:'#fff',padding:'6px 13px',borderRadius:7,cursor:'pointer',fontSize:12}}>← Retour</button>
      <span style={{fontFamily:"'Playfair Display',serif",color:GOLD,fontSize:16}}>★ Café Lux</span>
      <div style={{marginLeft:'auto',background:GOLD,color:'#000',padding:'6px 13px',borderRadius:16,fontSize:11,fontWeight:700}}>🚚 Livraison 15 DH</div>
    </div>
    <div style={{display:'flex',flex:1,overflow:'hidden'}}>
      <div style={{width:170,background:'#fff',padding:10,overflowY:'auto',flexShrink:0,borderRight:'1px solid #EDE5D5'}}>
        {MENU.map(c=><button key={c.id} className={`cb${id===c.id?' on':''}`} onClick={()=>sid(c.id)} style={{width:'100%',textAlign:'left',padding:'8px 9px',border:'none',background:'none',fontFamily:"'DM Sans',sans-serif",fontSize:12,cursor:'pointer',borderRadius:7,color:'#666',display:'flex',alignItems:'center',gap:6,marginBottom:2}}><span>{c.icon}</span><span>{c.title}</span></button>)}
      </div>
      <div style={{flex:1,padding:'18px 20px',overflowY:'auto'}}>
        <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:21,color:'#1A0A00',marginBottom:3}}>{cat.icon} {cat.title}</h2>
        {(cat as any).sub&&<p style={{fontSize:11,color:'#999',marginBottom:16}}>{(cat as any).sub}</p>}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(170px,1fr))',gap:10}}>
          {cat.items.map((it:any,i:number)=><div key={i} className="mc" style={{background:'#fff',border:`1.5px solid ${it.sig?'rgba(201,168,76,.4)':'#EDE5D5'}`,borderRadius:10,overflow:'hidden'}}>
            <div style={{width:'100%',height:95,background:it.sig?'linear-gradient(135deg,rgba(201,168,76,.15),rgba(201,168,76,.05))':'linear-gradient(135deg,#F5F0E5,#EDE5D5)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:30}}>{it.sig?'⭐':cat.icon}</div>
            <div style={{padding:'9px 11px'}}>
              <div style={{fontSize:12,fontWeight:600,color:'#1A0A00',marginBottom:3,lineHeight:1.3}}>{it.n}</div>
              {it.s&&<div style={{fontSize:10,color:'#999',marginBottom:6,lineHeight:1.4}}>{it.s}</div>}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:GOLD,fontWeight:600}}>{it.p} DH</span>
                {it.sig&&<span style={{background:'rgba(201,168,76,.15)',color:GOLD,fontSize:8,padding:'2px 6px',borderRadius:9,fontWeight:600}}>SIGNATURE</span>}
              </div>
            </div>
          </div>)}
        </div>
      </div>
    </div>
  </div>
}
function CustomerApp({go}:{go:(r:R)=>void}){
  return <div style={{minHeight:'100vh',background:'#0A0A0A',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:"'DM Sans',sans-serif",padding:24,textAlign:'center'}}>
    <div style={{width:68,height:68,borderRadius:16,background:`linear-gradient(135deg,${GOLD},#8B6E2F)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,fontWeight:700,color:'#000',marginBottom:20,fontFamily:"'Playfair Display',serif"}}>L</div>
    <h1 style={{fontFamily:"'Playfair Display',serif",color:GOLD,fontSize:30,marginBottom:6}}>Café LUX</h1>
    <p style={{color:'#444',fontSize:12,marginBottom:32,letterSpacing:'.12em'}}>APPLICATION ZIBANA · قريباً</p>
    <div style={{padding:'14px 22px',background:'rgba(201,168,76,.07)',borderRadius:11,border:`1px solid rgba(201,168,76,.18)`,maxWidth:280,marginBottom:24}}>
      <p style={{fontSize:12,color:GOLD,marginBottom:3,fontWeight:600}}>📞 للطلب الآن</p>
      <p style={{fontSize:18,color:'#F0EDE8',fontWeight:600}}>+212 808 524 169</p>
    </div>
    <button onClick={()=>go('/')} style={{padding:'9px 22px',background:'transparent',color:'#444',border:'1px solid #1C1C1C',borderRadius:50,cursor:'pointer',fontSize:12}}>← الرجوع للرئيسية</button>
  </div>
}
export default function App(){
  const[r,sr]=useState<R>('/')
  useEffect(()=>{
    const p=window.location.pathname
    if(p==='/menu') sr('/menu')
    else if(p==='/app/customer') sr('/app/customer')
    else sr('/')
  },[])
  const go=(p:R)=>{window.history.pushState({},'',p);sr(p)}
  if(r==='/menu') return <Menu go={go}/>
  if(r==='/app/customer') return <CustomerApp go={go}/>
  if(r==='/portal/staff') return <>{go('/')}</>
  return <Home go={go}/>
}
