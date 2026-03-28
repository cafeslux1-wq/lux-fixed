import{useState,useEffect}from'react'
const G='#C9A84C'
type R='/'|'/menu'|'/portal/pos'|'/app/customer'

// Images served from /menu/ static folder
const I:Record<string,string>={
  'Classic Breakfast':'/public/menu/classic_breakfast.jpg',
  'Omelette au Fromage':'/public/menu/omelette_fromage.jpg',
  'Moroccan Breakfast':'/public/menu/moroccan_breakfast.jpg',
  'Espresso':'/public/menu/espresso.jpg','Espresso Prestige':'/public/menu/espresso_prestige.jpg',
  'Double Espresso':'/public/menu/double_espresso.jpg','Capsule':'/public/menu/capsule.jpg',
  'Lait Chocolat':'/public/menu/lait_chocolat.jpg','Lait Chaud':'/public/menu/lait_chaud.jpg',
  'Lait Verveine':'/public/menu/lait_verveine.jpg','Lait Aromatisé':'/public/menu/lait_aromatise.jpg',
  'Café Crème':'/public/menu/cafe_creme.jpg','Cappuccino':'/public/menu/cappuccino.jpg',
  'Café Chocolat':'/public/menu/cafe_chocolat.jpg','Chocolat Fondu':'/public/menu/chocolat_fondu.jpg',
  'Thé Marocain':'/public/menu/the_marocain.jpg','Golden Tea':'/public/menu/golden_tea.jpg',
  'Thé Royal':'/public/menu/the_royal.jpg','Banane':'/public/menu/banane.jpg','Pomme':'/public/menu/pomme.jpg',
  'Orange':'/public/menu/orange.jpg','Citron':'/public/menu/citron.jpg',
  'Fruits de Saison':'/public/menu/fruits_saison.jpg','Mangue':'/public/menu/mangue.jpg',
  'Ananas':'/public/menu/ananas.jpg','Avocat':'/public/menu/avocat.jpg',
  'Avocat Royal':'/public/menu/avocat_royal.jpg','Mojito':'/public/menu/mojito.jpg',
  'Panache LUX':'/public/menu/panache_lux.jpg','Cocktail Royal':'/public/menu/cocktail_royal.jpg',
  'Zaazaa Lux':'/public/menu/zaazaa_lux.jpg','Crêpe Royale':'/public/menu/crepe_royale.jpg',
  'Crêpe Fromage':'/public/menu/crepe_fromage.jpg','Pack Crêpes':'/public/menu/pack_crepes.jpg',
  'LUX Power Toast':'/public/menu/lux_power_toast.jpg','Meskouta':'/public/menu/meskouta.jpg',
  'Cake Prestige':'/public/menu/cake_prestige.jpg','Sablés 7pcs':'/public/menu/sables_7pcs.jpg',
  'Sellou Portion':'/public/menu/sellou_portion.jpg','Plateau Gâteaux':'/public/menu/plateau_gateaux.jpg',
  'Sellou 1 Kg':'/public/menu/sellou_1kg.jpg','Salade Fruits Royale':'/public/menu/salade_royale.jpg',
  'Soda':'/public/menu/soda.jpg','Red Bull':'/public/menu/red_bull.jpg','Milkshake Classic':'/public/menu/milkshake.jpg',
}
const M=[
{id:'pdej',icon:'🍳',title:'Petit-Déjeuner',sub:'Café noir offert',items:[
{n:'Classic Breakfast',p:22,s:'Pain, oeuf, olives, fromage'},{n:'Chamali',p:27,s:'2 oeufs, fromage, pain, jben'},
{n:'Omelette au Fromage',p:30},{n:'Moroccan Breakfast',p:35,sig:1},{n:'Morning Lux',p:35,sig:1}]},
{id:'cafes',icon:'☕',title:'Cafés Classiques',items:[
{n:'Espresso',p:7},{n:'Espresso Prestige',p:9},{n:'Double Espresso',p:14},
{n:'Café Séparé',p:12},{n:'Capsule',p:10},{n:'Lait Chocolat',p:12},{n:'Lait Chaud',p:9}]},
{id:'cremeux',icon:'🥛',title:'Les Crémeux',items:[
{n:'Café Crème',p:10},{n:'Cappuccino',p:12},{n:'Café Chocolat',p:14},{n:'Chocolat Fondu',p:20}]},
{id:'infusions',icon:'🍵',title:'Infusions',items:[
{n:'Thé Marocain',p:9},{n:'Golden Tea',p:9,s:'Tisane, Verveine, Lipton'},{n:'Thé Royal',p:20,sig:1,s:'+7 gâteaux'}]},
{id:'jus',icon:'🥤',title:'Jus Frais',items:[
{n:'Banane',p:15},{n:'Pomme',p:15},{n:'Orange',p:16},{n:'Citron',p:16},
{n:'Mangue',p:19},{n:'Ananas',p:19},{n:'Avocat',p:20},{n:'Avocat Royal',p:25,sig:1}]},
{id:'sig',icon:'⭐',title:'Signature Lux',items:[
{n:'Lux Matcha Bloom',p:20,sig:1},{n:"Queen's Rose Coffee",p:30,sig:1},
{n:'Mojito',p:25},{n:'Panache LUX',p:25},{n:'Cocktail Royal',p:30},{n:'Zaazaa Lux',p:35,sig:1}]},
{id:'crepes',icon:'🥞',title:'Crêpes',items:[
{n:'Crêpe Nutella',p:23},{n:'Crêpe Royale',p:30,sig:1},{n:'Crêpe Fromage',p:25},{n:'Crêpe Thon',p:35}]},
{id:'resto',icon:'🍽',title:'Restaurant',items:[
{n:'LUX Power Toast',p:25,sig:1},{n:'Harira',p:14},{n:'Meskouta',p:5},
{n:'Cake Prestige',p:10},{n:'Sablés 7pcs',p:13},{n:'Plateau Gâteaux',p:100},{n:'Salade Fruits Royale',p:40}]},
{id:'soft',icon:'🥫',title:'Soft & Shakes',items:[
{n:'Soda',p:12,s:'Coca, 7up, Fanta'},{n:'Red Bull',p:20},{n:'Milkshake Classic',p:35}]}
]
function Img({n,h,icon}:{n:string,h:number,icon:string}){
const[ok,sok]=useState(!!I[n])
return I[n]&&ok
?<img src={I[n]} alt={n} style={{width:'100%',height:h,objectFit:'cover'}} onError={()=>sok(false)}/>
:<div style={{width:'100%',height:h,background:'linear-gradient(135deg,rgba(201,168,76,.15),rgba(201,168,76,.05))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:h/3}}>{icon}</div>
}
function Home({go}:{go:(r:R)=>void}){
const[v,sv]=useState(false)
useEffect(()=>{setTimeout(()=>sv(true),80)},[])
return<div style={{minHeight:'100vh',background:'#0A0A0A',color:'#F0EDE8',fontFamily:"'DM Sans',sans-serif",overflowY:'auto'}}>
<style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=DM+Sans:wght@300;400;600&display=swap');
@keyframes fu{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
.a0{animation:fu .7s ease both}.a1{animation:fu .7s .12s ease both}.a2{animation:fu .7s .24s ease both}.a3{animation:fu .7s .36s ease both}
.pc{transition:all .25s}.pc:hover{transform:translateY(-5px);border-color:${G}!important}
.mb:hover{background:${G}!important;color:#000!important}.ab:hover{background:rgba(201,168,76,.1)!important}`}</style>
<div style={{position:'fixed',top:'25%',left:'50%',transform:'translateX(-50%)',width:500,height:500,background:'radial-gradient(circle,rgba(201,168,76,.07) 0%,transparent 70%)',pointerEvents:'none'}}/>
<section style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',padding:'40px 24px',opacity:v?1:0,transition:'opacity .4s',position:'relative',zIndex:1}}>
<div className="a0" style={{width:68,height:68,borderRadius:16,background:`linear-gradient(135deg,${G},#8B6E2F)`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Playfair Display',serif",fontSize:30,fontWeight:700,color:'#000',marginBottom:28,boxShadow:`0 0 40px rgba(201,168,76,.25)`}}>L</div>
<h1 className="a1" style={{fontFamily:"'Playfair Display',serif",fontSize:'clamp(72px,13vw,130px)',fontWeight:700,lineHeight:1,marginBottom:10,background:`linear-gradient(135deg,#E8C97A,${G},#8B6E2F)`,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>LUX</h1>
<p className="a1" style={{fontSize:11,letterSpacing:'.35em',color:G,marginBottom:20,opacity:.75}}>TAZA · CAFÉ & PÂTISSERIE · 2026</p>
<h2 className="a2" style={{fontFamily:"'Playfair Display',serif",fontStyle:'italic',fontSize:'clamp(16px,2.5vw,22px)',fontWeight:400,color:'rgba(240,237,232,.6)',maxWidth:460,lineHeight:1.6,marginBottom:44}}>اكتشف أرقى نكهات القهوة والحلويات الفرنسية في قلب تازة</h2>
<div className="a3" style={{display:'flex',gap:14,flexWrap:'wrap',justifyContent:'center',marginBottom:60}}>
<button className="mb" onClick={()=>go('/menu')} style={{padding:'13px 34px',background:G,color:'#000',border:'none',borderRadius:50,fontSize:14,fontWeight:600,cursor:'pointer',transition:'all .2s',boxShadow:`0 6px 28px rgba(201,168,76,.28)`}}>📖 تصفح المنيو الرقمي</button>
<button className="ab" onClick={()=>go('/app/customer')} style={{padding:'13px 34px',background:'transparent',color:G,border:`1.5px solid ${G}`,borderRadius:50,fontSize:14,cursor:'pointer',transition:'all .2s'}}>📱 تحميل التطبيق</button>
</div>
</section>
<div style={{height:1,background:`linear-gradient(90deg,transparent,${G},transparent)`}}/>
<section style={{padding:'64px 24px',background:'#0D0D0D'}}>
<div style={{maxWidth:880,margin:'0 auto',textAlign:'center',marginBottom:44}}>
<p style={{fontSize:10,letterSpacing:'.28em',color:G,marginBottom:10,opacity:.65}}>ACCÈS RAPIDE</p>
<h3 style={{fontFamily:"'Playfair Display',serif",fontSize:'clamp(20px,4vw,32px)',color:'#F0EDE8',fontWeight:400}}>بوابات النظام</h3>
</div>
<div style={{maxWidth:880,margin:'0 auto',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(185px,1fr))',gap:13}}>
{[{icon:'👥',label:'الموظفين',sub:'Staff Portal',path:'/portal/staff',c:G},{icon:'🖥️',label:'نظام POS',sub:'Point de Vente',path:'/portal/pos',c:'#3DBE7A'},{icon:'📖',label:'المنيو',sub:'Menu Digital',path:'/menu',c:'#5B8DEF'},{icon:'📞',label:'اتصل بنا',sub:'+212 808 524 169',path:'tel',c:'#E07830'}].map(x=>(
<div key={x.path} className="pc" onClick={()=>x.path==='tel'?window.location.href='tel:+212808524169':go(x.path as R)} style={{padding:'26px 18px',background:'#121212',border:'1px solid #1C1C1C',borderRadius:13,textAlign:'center',cursor:'pointer'}}>
<div style={{fontSize:30,marginBottom:11}}>{x.icon}</div>
<div style={{fontSize:14,fontWeight:600,color:'#F0EDE8',marginBottom:3}}>{x.label}</div>
<div style={{fontSize:10,color:'#444',letterSpacing:'.05em'}}>{x.sub}</div>
<div style={{width:26,height:2,background:x.c,borderRadius:2,margin:'13px auto 0',opacity:.55}}/>
</div>))}
</div>
</section>
<div style={{height:1,background:`linear-gradient(90deg,transparent,${G},transparent)`}}/>
<footer style={{padding:'18px',textAlign:'center',background:'#0A0A0A',fontSize:10,color:'#2A2A2A',letterSpacing:'.1em'}}>© 2026 CAFÉ LUX · TAZA · MAROC · +212 808 524 169</footer>
</div>
}
function Menu({go}:{go:(r:R)=>void}){
const[id,sid]=useState('pdej')
const cat=M.find((c:any)=>c.id===id)||M[0]
return<div style={{height:'100vh',background:'#FAF8F2',fontFamily:"'DM Sans',sans-serif",display:'flex',flexDirection:'column',overflow:'hidden'}}>
<style>{`.cb{transition:all .18s}.cb:hover{background:rgba(201,168,76,.1)!important;color:#1A0A00!important}.cb.on{background:${G}!important;color:#000!important;font-weight:600}.mc{transition:all .18s;cursor:pointer}.mc:hover{border-color:${G}!important;transform:translateY(-2px);box-shadow:0 6px 20px rgba(201,168,76,.1)}`}</style>
<div style={{background:'linear-gradient(135deg,#1A0A00,#2D1500)',padding:'11px 18px',display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
<button onClick={()=>go('/')} style={{background:'rgba(255,255,255,.1)',border:'none',color:'#fff',padding:'6px 13px',borderRadius:7,cursor:'pointer',fontSize:12}}>← Retour</button>
<span style={{fontFamily:"'Playfair Display',serif",color:G,fontSize:17}}>★ Café Lux</span>
<div style={{marginLeft:'auto',background:G,color:'#000',padding:'6px 14px',borderRadius:16,fontSize:11,fontWeight:700}}>🚚 Livraison 15 DH — Gratuite dès 200 DH</div>
</div>
<div style={{display:'flex',flex:1,overflow:'hidden'}}>
<div style={{width:172,background:'#fff',padding:10,overflowY:'auto',flexShrink:0,borderRight:'1px solid #EDE5D5'}}>
{M.map((c:any)=><button key={c.id} className={`cb${id===c.id?' on':''}`} onClick={()=>sid(c.id)} style={{width:'100%',textAlign:'left',padding:'8px 9px',border:'none',background:'none',fontSize:12,cursor:'pointer',borderRadius:7,color:'#666',display:'flex',alignItems:'center',gap:6,marginBottom:2}}><span>{c.icon}</span><span>{c.title}</span></button>)}
</div>
<div style={{flex:1,padding:'18px 20px',overflowY:'auto'}}>
<h2 style={{fontFamily:"'Playfair Display',serif",fontSize:21,color:'#1A0A00',marginBottom:3}}>{(cat as any).icon} {(cat as any).title}</h2>
{(cat as any).sub&&<p style={{fontSize:11,color:'#888',marginBottom:14}}>{(cat as any).sub}</p>}
<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(165px,1fr))',gap:10}}>
{(cat as any).items.map((it:any,i:number)=>(
<div key={i} className="mc" style={{background:'#fff',border:`1.5px solid ${it.sig?'rgba(201,168,76,.4)':'#EDE5D5'}`,borderRadius:11,overflow:'hidden'}}>
<Img n={it.n} h={105} icon={(cat as any).icon}/>
<div style={{padding:'9px 11px'}}>
<div style={{fontSize:12,fontWeight:600,color:'#1A0A00',marginBottom:3,lineHeight:1.3}}>{it.n}</div>
{it.s&&<div style={{fontSize:10,color:'#999',marginBottom:6}}>{it.s}</div>}
<div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<span style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:G,fontWeight:600}}>{it.p} DH</span>
{it.sig&&<span style={{background:'rgba(201,168,76,.15)',color:G,fontSize:8,padding:'2px 6px',borderRadius:9,fontWeight:600}}>SIGNATURE</span>}
</div></div></div>))}
</div></div></div></div>
}
function POS({go}:{go:(r:R)=>void}){
const[table,setTable]=useState<number|null>(null)
const[cart,setCart]=useState<{n:string,p:number,q:number}[]>([])
const[catId,setCatId]=useState('pdej')
const cat=M.find((c:any)=>c.id===catId)||M[0]
const add=(n:string,p:number)=>setCart(prev=>{const e=prev.find(c=>c.n===n);if(e)return prev.map(c=>c.n===n?{...c,q:c.q+1}:c);return[...prev,{n,p,q:1}]})
const rm=(n:string)=>setCart(prev=>{const e=prev.find(c=>c.n===n);if(!e)return prev;if(e.q>1)return prev.map(c=>c.n===n?{...c,q:c.q-1}:c);return prev.filter(c=>c.n!==n)})
const total=cart.reduce((s,c)=>s+c.p*c.q,0)
return<div style={{height:'100vh',background:'#0D0D0D',display:'flex',flexDirection:'column',fontFamily:"'DM Sans',sans-serif",overflow:'hidden'}}>
<style>{`.pt{cursor:pointer;transition:all .15s}.pt:hover{border-color:${G}!important}.mc2{cursor:pointer;transition:all .15s;border:1px solid #1E1E1E}.mc2:hover{border-color:${G}!important;background:#1A1A1A!important}.ctab{cursor:pointer;transition:all .15s;border-bottom:2px solid transparent}.ctab:hover{color:#F0EDE8!important}.ctab.on{color:${G}!important;border-bottom-color:${G}!important}`}</style>
<div style={{background:'#131313',borderBottom:'1px solid #1E1E1E',padding:'10px 16px',display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
<button onClick={()=>go('/')} style={{background:'rgba(255,255,255,.07)',border:'1px solid #222',color:'#888',padding:'5px 12px',borderRadius:7,cursor:'pointer',fontSize:12}}>←</button>
<span style={{fontFamily:"'Playfair Display',serif",color:G,fontSize:16}}>LUX POS</span>
{table&&<span style={{background:'rgba(201,168,76,.15)',color:G,padding:'3px 10px',borderRadius:10,fontSize:12,fontWeight:600}}>{table===99?'Emporter':`Table ${table}`}</span>}
<span style={{marginLeft:'auto',color:'#444',fontSize:11}}>{new Date().toLocaleTimeString('fr-MA',{hour:'2-digit',minute:'2-digit'})}</span>
</div>
<div style={{flex:1,display:'flex',overflow:'hidden'}}>
<div style={{width:140,background:'#111',borderRight:'1px solid #1A1A1A',padding:12,overflowY:'auto',flexShrink:0}}>
<div style={{fontSize:10,color:'#444',marginBottom:10,letterSpacing:'.1em'}}>TABLES</div>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
{[1,2,3,4,5,6,7,8,9,10,11,12].map(t=>(
<div key={t} className="pt" onClick={()=>setTable(t)} style={{aspectRatio:'1',background:table===t?'rgba(201,168,76,.2)':'#1A1A1A',border:`1px solid ${table===t?G:'#222'}`,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:600,color:table===t?G:'#666'}}>{t}</div>))}
</div>
<button onClick={()=>setTable(99)} style={{width:'100%',marginTop:10,padding:'8px',background:'rgba(91,141,239,.15)',color:'#5B8DEF',border:'1px solid rgba(91,141,239,.3)',borderRadius:8,cursor:'pointer',fontSize:11,fontWeight:600}}>+ Emporter</button>
</div>
<div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
<div style={{display:'flex',background:'#0F0F0F',borderBottom:'1px solid #1A1A1A',overflowX:'auto',flexShrink:0}}>
{M.map((c:any)=><button key={c.id} className={`ctab${catId===c.id?' on':''}`} onClick={()=>setCatId(c.id)} style={{padding:'10px 14px',border:'none',background:'none',color:'#444',cursor:'pointer',fontSize:11,whiteSpace:'nowrap',fontFamily:"'DM Sans',sans-serif"}}>{c.icon} {c.title}</button>)}
</div>
<div style={{flex:1,padding:12,overflowY:'auto',display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))',gap:8,alignContent:'start'}}>
{(cat as any).items.map((it:any,i:number)=>(
<div key={i} className="mc2" onClick={()=>{if(!table){alert('Choisissez une table!');return}add(it.n,it.p)}} style={{background:'#151515',borderRadius:10,overflow:'hidden'}}>
<Img n={it.n} h={75} icon={(cat as any).icon}/>
<div style={{padding:'7px 9px'}}>
<div style={{fontSize:11,fontWeight:600,color:'#D0CCC8',lineHeight:1.3,marginBottom:3}}>{it.n}</div>
<div style={{fontFamily:"'Playfair Display',serif",fontSize:13,color:G,fontWeight:600}}>{it.p} DH</div>
</div></div>))}
</div></div>
<div style={{width:210,background:'#111',borderLeft:'1px solid #1A1A1A',display:'flex',flexDirection:'column',flexShrink:0}}>
<div style={{padding:'12px 14px',borderBottom:'1px solid #1A1A1A',fontFamily:"'Playfair Display',serif",color:G,fontSize:14}}>🧾 {table?(table===99?'Emporter':`Table ${table}`):'Ticket'}</div>
<div style={{flex:1,overflowY:'auto',padding:'8px 12px'}}>
{cart.length===0?<div style={{color:'#333',fontSize:11,textAlign:'center',padding:'20px 0'}}>Aucun article</div>
:cart.map(c=><div key={c.n} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 0',borderBottom:'1px solid #1A1A1A'}}>
<div style={{flex:1,fontSize:11,color:'#D0CCC8',lineHeight:1.3}}>{c.n}</div>
<button onClick={()=>rm(c.n)} style={{width:18,height:18,background:'#1E1E1E',border:'none',color:'#666',borderRadius:4,cursor:'pointer',fontSize:12}}>-</button>
<span style={{fontSize:11,color:G,minWidth:14,textAlign:'center'}}>{c.q}</span>
<button onClick={()=>add(c.n,c.p)} style={{width:18,height:18,background:'#1E1E1E',border:'none',color:'#666',borderRadius:4,cursor:'pointer',fontSize:12}}>+</button>
<div style={{fontSize:11,color:'#888',minWidth:36,textAlign:'right'}}>{c.p*c.q} DH</div>
</div>)}
</div>
<div style={{padding:'12px',borderTop:'1px solid #1A1A1A'}}>
<div style={{display:'flex',justifyContent:'space-between',marginBottom:8,paddingBottom:8,borderBottom:'1px solid #1A1A1A'}}>
<span style={{color:'#F0EDE8',fontWeight:600}}>Total TTC</span>
<span style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:G,fontWeight:600}}>{(total*1.1).toFixed(0)} DH</span>
</div>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:8}}>
{['💵 Espèces','💳 CB'].map(m=><button key={m} onClick={()=>{if(cart.length){alert(`✅ ${(total*1.1).toFixed(0)} DH\n${m}`);setCart([]);setTable(null)}}} style={{padding:'8px',background:'#1A1A1A',border:'1px solid #2A2A2A',color:'#888',borderRadius:8,cursor:'pointer',fontSize:11}}>{m}</button>)}
</div>
<button onClick={()=>{if(cart.length){alert(`✅ Encaissé: ${(total*1.1).toFixed(0)} DH`);setCart([]);setTable(null)}}} style={{width:'100%',padding:'11px',background:G,color:'#000',border:'none',borderRadius:9,fontWeight:700,cursor:'pointer',fontSize:13}}>✓ Encaisser</button>
{cart.length>0&&<button onClick={()=>setCart([])} style={{width:'100%',marginTop:6,padding:'7px',background:'transparent',border:'1px solid #1E1E1E',color:'#444',borderRadius:9,cursor:'pointer',fontSize:11}}>Vider le ticket</button>}
</div></div></div></div>
}
function CustomerApp({go}:{go:(r:R)=>void}){
const[tab,setTab]=useState<'order'|'wallet'|'rewards'>('order')
const[cart,setCart]=useState<{n:string,p:number,q:number}[]>([])
const pts=340
const add=(n:string,p:number)=>setCart(prev=>{const e=prev.find(c=>c.n===n);if(e)return prev.map(c=>c.n===n?{...c,q:c.q+1}:c);return[...prev,{n,p,q:1}]})
const total=cart.reduce((s,c)=>s+c.p*c.q,0)
const QK=M.flatMap((c:any)=>c.items).filter((it:any)=>it.sig||it.p<=20).slice(0,8)
return<div style={{minHeight:'100vh',background:'#0A0A0A',fontFamily:"'DM Sans',sans-serif",color:'#F0EDE8'}}>
<style>{`.tab{cursor:pointer;transition:all .18s;border-bottom:2px solid transparent}.tab:hover{color:#F0EDE8!important}.tab.on{color:${G}!important;border-bottom-color:${G}!important}`}</style>
<div style={{background:'#111',padding:'12px 18px',display:'flex',alignItems:'center',gap:12,borderBottom:'1px solid #1A1A1A'}}>
<button onClick={()=>go('/')} style={{background:'none',border:'1px solid #222',color:'#555',padding:'5px 11px',borderRadius:7,cursor:'pointer',fontSize:12}}>←</button>
<span style={{fontFamily:"'Playfair Display',serif",color:G,fontSize:17}}>Café LUX</span>
<div style={{marginLeft:'auto',background:'rgba(201,168,76,.12)',color:G,padding:'4px 12px',borderRadius:16,fontSize:12,fontWeight:600}}>⭐ {pts} pts</div>
</div>
<div style={{display:'flex',background:'#0D0D0D',borderBottom:'1px solid #1A1A1A'}}>
{([['order','🛒 طلب'],['wallet','💰 محفظة'],['rewards','🎁 مكافآت']] as [typeof tab,string][]).map(([t,l])=>(
<button key={t} className={`tab${tab===t?' on':''}`} onClick={()=>setTab(t)} style={{flex:1,padding:'12px',border:'none',background:'none',color:'#444',cursor:'pointer',fontSize:13,fontFamily:"'DM Sans',sans-serif"}}>{l}</button>))}
</div>
{tab==='order'&&<div style={{padding:16}}>
<h3 style={{fontFamily:"'Playfair Display',serif",color:G,fontSize:18,marginBottom:16}}>طلب سريع</h3>
<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(145px,1fr))',gap:10,marginBottom:20}}>
{QK.map((it:any,i:number)=>(
<div key={i} onClick={()=>add(it.n,it.p)} style={{background:'#111',border:'1px solid #1A1A1A',borderRadius:10,overflow:'hidden',cursor:'pointer'}}>
<Img n={it.n} h={90} icon="⭐"/>
<div style={{padding:'8px 10px'}}>
<div style={{fontSize:11,fontWeight:600,color:'#D0CCC8',marginBottom:4}}>{it.n}</div>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<span style={{color:G,fontWeight:600,fontSize:13}}>{it.p} DH</span>
<span style={{background:'rgba(201,168,76,.15)',color:G,fontSize:16,borderRadius:'50%',width:22,height:22,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700}}>+</span>
</div></div></div>))}
</div>
{cart.length>0&&<div style={{background:'#111',border:'1px solid #1A1A1A',borderRadius:12,padding:14}}>
<div style={{fontWeight:600,marginBottom:10}}>🛒 سلة الطلب</div>
{cart.map(c=><div key={c.n} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid #1A1A1A',fontSize:12}}>
<span style={{color:'#888'}}>{c.q}x {c.n}</span><span style={{color:G}}>{c.p*c.q} DH</span></div>)}
<div style={{display:'flex',justifyContent:'space-between',marginTop:10,fontWeight:700}}>
<span>المجموع</span><span style={{color:G,fontFamily:"'Playfair Display',serif",fontSize:18}}>{total} DH</span></div>
<button onClick={()=>{alert(`✅ طلبك وصل!\n${total} DH — +${Math.floor(total/5)} نقطة`);setCart([])}} style={{width:'100%',marginTop:12,padding:'12px',background:G,color:'#000',border:'none',borderRadius:9,fontWeight:700,cursor:'pointer',fontSize:14}}>تأكيد الطلب 🚀</button>
</div>}
</div>}
{tab==='wallet'&&<div style={{padding:16}}>
<div style={{background:'linear-gradient(135deg,#1A1400,#2D2200)',border:`1px solid rgba(201,168,76,.3)`,borderRadius:16,padding:24,marginBottom:16,textAlign:'center'}}>
<div style={{fontSize:11,color:'rgba(201,168,76,.6)',letterSpacing:'.2em',marginBottom:8}}>SOLDE WALLET</div>
<div style={{fontFamily:"'Playfair Display',serif",fontSize:42,color:G,fontWeight:700}}>150 DH</div>
</div>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
{[50,100,200,500].map(a=><button key={a} onClick={()=>alert(`+${a} DH!\nBonus: +${Math.floor(a*.1)} DH`)} style={{padding:'14px',background:'#111',border:'1px solid #1A1A1A',borderRadius:10,color:'#F0EDE8',cursor:'pointer',fontSize:14,fontWeight:600}}>+{a} DH<div style={{fontSize:10,color:G,marginTop:3}}>+{Math.floor(a*.1)} bonus</div></button>)}
</div>
<div style={{background:'#111',borderRadius:12,padding:14}}>
{[{t:'Café + Croissant',m:-38,d:"Aujourd'hui 09:15"},{t:'Recharge Wallet',m:100,d:'Hier 14:30'},{t:'Morning Lux',m:-35,d:'Lundi 08:45'}].map((tx,i)=>(
<div key={i} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #1A1A1A',fontSize:12}}>
<div><div style={{color:'#D0CCC8'}}>{tx.t}</div><div style={{color:'#444',fontSize:10,marginTop:2}}>{tx.d}</div></div>
<span style={{color:tx.m>0?'#3DBE7A':'#E05252',fontWeight:600}}>{tx.m>0?'+':''}{tx.m} DH</span></div>))}
</div></div>}
{tab==='rewards'&&<div style={{padding:16}}>
<div style={{background:'linear-gradient(135deg,#0A1A0A,#102210)',border:'1px solid rgba(61,190,122,.2)',borderRadius:16,padding:20,marginBottom:16,textAlign:'center'}}>
<div style={{fontFamily:"'Playfair Display',serif",fontSize:40,color:'#3DBE7A',fontWeight:700}}>{pts}</div>
<div style={{fontSize:11,color:'#555',marginTop:4}}>10 DH = 1 point · 100 pts = 10 DH offerts</div>
</div>
{[{p:50,l:'Espresso offert',i:'☕'},{p:100,l:'Cappuccino offert',i:'🥛'},{p:200,l:'-20% sur commande',i:'🎫'},{p:350,l:'Petit-Déjeuner offert',i:'🍳'}].map((r,i)=>(
<div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'12px',background:'#111',border:`1px solid ${pts>=r.p?'rgba(61,190,122,.3)':'#1A1A1A'}`,borderRadius:10,marginBottom:8}}>
<div style={{fontSize:26}}>{r.i}</div>
<div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{r.l}</div><div style={{fontSize:11,color:'#555',marginTop:2}}>{r.p} pts</div></div>
<button onClick={()=>pts>=r.p?alert(`✅ ${r.l}!`):alert(`${r.p-pts} pts manquants`)} style={{padding:'6px 14px',background:pts>=r.p?'#3DBE7A':'#1A1A1A',color:pts>=r.p?'#000':'#444',border:'none',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:600}}>{pts>=r.p?'Utiliser':'Bientôt'}</button>
</div>))}
</div>}
</div>
}
export default function App(){
const[r,sr]=useState<R>('/')
useEffect(()=>{
const sync=()=>{const p=window.location.pathname as R;sr(['/menu','/portal/pos','/app/customer'].includes(p)?p:'/')}
sync();window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync)
},[])
const go=(p:R)=>{window.history.pushState({},'',p);sr(p)}
if(r==='/menu')return<Menu go={go}/>
if(r==='/portal/pos')return<POS go={go}/>
if(r==='/app/customer')return<CustomerApp go={go}/>
return<Home go={go}/>
}

