type Navigate = (path: any) => void
const GOLD = '#C9A84C'

export default function CustomerApp({ navigate }: { navigate: Navigate }) {
  return (
    <div style={{ minHeight:'100vh', background:'#0A0A0A', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:"'DM Sans',sans-serif", padding:24, textAlign:'center' }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />

      <div style={{ width:80, height:80, borderRadius:20, background:`linear-gradient(135deg,${GOLD},#8B6E2F)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:36, marginBottom:24, fontFamily:"'Playfair Display',serif", fontWeight:700, color:'#000' }}>L</div>

      <h1 style={{ fontFamily:"'Playfair Display',serif", color:GOLD, fontSize:36, marginBottom:8 }}>Café LUX</h1>
      <p style={{ color:'#555', fontSize:14, marginBottom:40, letterSpacing:'.1em' }}>APPLICATION ZIBANA · قريباً</p>

      <div style={{ display:'flex', flexDirection:'column', gap:12, width:'100%', maxWidth:320 }}>
        <button style={{ padding:'16px 24px', background:'#1A1A1A', color:'#F0EDE8', border:`1px solid #2E2E2E`, borderRadius:14, fontFamily:"'DM Sans',sans-serif", fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
          <span style={{ fontSize:24 }}>🍎</span>
          <div style={{ textAlign:'left' }}>
            <div style={{ fontSize:10, color:'#666', letterSpacing:'.08em' }}>BIENTÔT SUR</div>
            <div style={{ fontWeight:600 }}>App Store</div>
          </div>
        </button>

        <button style={{ padding:'16px 24px', background:'#1A1A1A', color:'#F0EDE8', border:`1px solid #2E2E2E`, borderRadius:14, fontFamily:"'DM Sans',sans-serif", fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
          <span style={{ fontSize:24 }}>🤖</span>
          <div style={{ textAlign:'left' }}>
            <div style={{ fontSize:10, color:'#666', letterSpacing:'.08em' }}>BIENTÔT SUR</div>
            <div style={{ fontWeight:600 }}>Google Play</div>
          </div>
        </button>
      </div>

      <div style={{ marginTop:40, padding:'16px 24px', background:'rgba(201,168,76,.08)', borderRadius:12, border:`1px solid rgba(201,168,76,.2)`, maxWidth:320 }}>
        <p style={{ fontSize:13, color:GOLD, marginBottom:4, fontWeight:600 }}>📞 للطلب الآن</p>
        <p style={{ fontSize:18, color:'#F0EDE8', fontWeight:600 }}>+212 808 524 169</p>
        <p style={{ fontSize:11, color:'#555', marginTop:4 }}>Livraison 15 DH — Gratuite dès 200 DH</p>
      </div>

      <button onClick={() => navigate('/')} style={{ marginTop:32, padding:'10px 24px', background:'transparent', color:'#555', border:'1px solid #222', borderRadius:50, cursor:'pointer', fontSize:13 }}>
        ← الرجوع للرئيسية
      </button>
    </div>
  )
}
