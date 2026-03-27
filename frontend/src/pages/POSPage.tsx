type Navigate = (path: any) => void
const GOLD = '#C9A84C'

export default function POSPage({ navigate }: { navigate: Navigate }) {
  return (
    <div style={{ minHeight:'100vh', background:'#0D0D0D', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ fontSize:48, marginBottom:16 }}>🖥️</div>
      <h2 style={{ fontFamily:"'Playfair Display',serif", color:GOLD, fontSize:28, marginBottom:8 }}>نظام POS</h2>
      <p style={{ color:'#555', fontSize:14, marginBottom:32 }}>Point de Vente — Accès Caissier</p>
      <button onClick={() => navigate('/portal/staff')} style={{ padding:'12px 28px', background:GOLD, color:'#000', border:'none', borderRadius:50, fontWeight:600, cursor:'pointer', fontSize:14 }}>
        ← Retour au portail
      </button>
    </div>
  )
}
