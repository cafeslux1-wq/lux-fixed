import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { API } from '../../services/api';

function MRRChart({ data }: { data: Array<{date:string;mrr:number;tenants:number}> }) {
  const [hover, setHover] = useState<typeof data[0]|null>(null);
  if (!data?.length) return null;
  const W=600,H=160,PX=8,PY=16,iW=W-PX*2,iH=H-PY*2;
  const max=Math.max(...data.map(d=>d.mrr),1),min=Math.min(...data.map(d=>d.mrr));
  const toX=(i:number)=>PX+(i/(data.length-1))*iW;
  const toY=(v:number)=>PY+iH-((v-min)/(max-min||1))*iH;
  const linePath=data.map((d,i)=>`${i===0?'M':'L'}${toX(i).toFixed(1)},${toY(d.mrr).toFixed(1)}`).join(' ');
  const fillPath=`${linePath} L${toX(data.length-1)},${H} L${PX},${H} Z`;
  return (
    <div className="relative select-none">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" onMouseLeave={() => setHover(null)}>
        <defs><linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C9A84C" stopOpacity="0.2"/><stop offset="100%" stopColor="#C9A84C" stopOpacity="0"/></linearGradient></defs>
        <path d={fillPath} fill="url(#mrrFill)"/>
        <path d={linePath} fill="none" stroke="#C9A84C" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
        {data.map((d,i) => <rect key={i} x={toX(i)-6} y={PY} width={12} height={iH} fill="transparent" className="cursor-crosshair" onMouseEnter={() => setHover(d)}/>)}
        {hover && (() => { const idx=data.indexOf(hover),x=toX(idx),y=toY(hover.mrr); return <g><line x1={x} y1={PY} x2={x} y2={H-PY} stroke="rgba(201,168,76,0.2)" strokeWidth="1" strokeDasharray="3"/><circle cx={x} cy={y} r="5" fill="#C9A84C" stroke="#0D0D0D" strokeWidth="2"/></g>; })()}
      </svg>
      {hover&&<div className="absolute top-0 right-0 bg-[#1A1A1A] border border-white/[0.08] rounded-xl px-3 py-2 text-xs pointer-events-none"><p className="text-white/50 mb-1">{new Date(hover.date).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}</p><p className="text-[#C9A84C] font-semibold">{hover.mrr.toLocaleString('fr-FR')} DH</p><p className="text-white/40">{hover.tenants} cafés</p></div>}
    </div>
  );
}

const STATUS_CLS: Record<string,string> = { active:'bg-green-500/15 text-green-400', trialing:'bg-blue-500/15 text-blue-400', past_due:'bg-red-500/15 text-red-400', canceled:'bg-white/5 text-white/20' };

export default function SuperAdminDashboard() {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'revenue'|'ltv'>('revenue');
  const { data, isLoading, error } = useQuery({ queryKey:['admin-kpis'], queryFn: () => API.admin.kpis().then((r:any) => r.data), staleTime: 60_000, retry: false });

  if (isLoading) return <div className="flex h-full items-center justify-center bg-[#0D0D0D]"><div className="w-8 h-8 border-2 border-[#C9A84C]/30 border-t-[#C9A84C] rounded-full animate-spin"/></div>;
  if (error) return <div className="flex h-full items-center justify-center bg-[#0D0D0D] p-8 text-center"><div><span className="text-4xl">🔒</span><h2 className="font-serif text-xl mt-4">Accès refusé</h2><p className="text-white/40 text-sm mt-2">Super-admin uniquement.</p></div></div>;

  const { overview, revenue, churn, topTenants, mrrHistory, topReferrers, signupChart } = data || {};
  const sortedTenants = [...(topTenants||[])].sort((a:any,b:any) => sortBy==='ltv' ? b.lifetimeRevenue-a.lifetimeRevenue : b.monthlyRevenue-a.monthlyRevenue);
  const filtered = sortedTenants.filter((t:any) => !search || t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="bg-[#0D0D0D] text-white min-h-full font-sans">
      <div className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
        <div><h1 className="font-serif text-xl text-[#C9A84C]">Super Admin — Platform</h1><p className="text-white/30 text-xs mt-0.5">{new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</p></div>
        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/><span className="text-xs text-white/30">Live</span></div>
      </div>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[{label:'MRR',value:`${(revenue?.mrrMAD||0).toLocaleString('fr-FR')} DH`,sub:`ARR: ${((revenue?.arrMAD||0)).toLocaleString()} DH`,icon:'💰'},{label:'Actifs',value:overview?.activeTenants||0,sub:`${overview?.trialingTenants||0} en essai`,icon:'🏪'},{label:'Churn',value:`${churn?.rate||0}%`,sub:`${churn?.count||0} annulation(s)`,icon:'📉'},{label:'ARPU',value:`${(revenue?.arpu||0).toFixed(0)} DH`,sub:'Revenu moyen',icon:'📊'},{label:'LTV',value:`${(revenue?.ltv||0).toFixed(0)} DH`,sub:'Durée × ARPU',icon:'♾️'}].map(k => (
            <div key={k.label} className="bg-[#141414] border border-white/[0.06] rounded-2xl p-5">
              <div className="flex items-start justify-between mb-2"><p className="text-xs text-white/40 uppercase tracking-widest">{k.label}</p><span className="text-xl opacity-50">{k.icon}</span></div>
              <p className="font-serif text-3xl text-[#C9A84C]">{k.value}</p>
              {k.sub&&<p className="text-white/30 text-[11px] mt-0.5">{k.sub}</p>}
            </div>
          ))}
        </div>

        {/* MRR Chart */}
        {(mrrHistory||[]).length > 0 && (
          <div className="bg-[#141414] border border-white/[0.06] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-base">Croissance MRR — 90 jours</h3>
              <p className={`text-xs font-semibold ${(revenue?.mrrTrend||0)>=0?'text-green-400':'text-red-400'}`}>{(revenue?.mrrTrend||0)>=0?'↑':'↓'} {Math.abs(revenue?.mrrTrend||0).toFixed(1)}%</p>
            </div>
            <MRRChart data={mrrHistory}/>
          </div>
        )}

        {/* Leaderboard + Referrers */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[#141414] border border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between gap-3 flex-wrap">
              <h3 className="font-serif text-base">Top cafés</h3>
              <div className="flex items-center gap-2">
                {[['revenue','Revenu'],['ltv','LTV']].map(([k,l]) => <button key={k} onClick={() => setSortBy(k as any)} className={`text-[11px] px-3 py-1 rounded-lg transition-all ${sortBy===k?'bg-[#C9A84C] text-black font-bold':'bg-white/5 text-white/40 hover:text-white/60'}`}>{l}</button>)}
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Recherche…" className="bg-black/50 border border-white/[0.06] rounded-lg px-2.5 py-1 text-xs text-white outline-none w-28"/>
              </div>
            </div>
            <div className="divide-y divide-white/[0.03]">
              {filtered.slice(0,10).map((t:any, idx:number) => (
                <div key={t.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.01]">
                  <span className={`w-6 text-center font-serif text-sm flex-shrink-0 ${idx<3?'text-[#C9A84C]':'text-white/20'}`}>{idx<3?['🥇','🥈','🥉'][idx]:idx+1}</span>
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#C9A84C] to-[#8B6E2F] flex items-center justify-center text-[11px] font-bold text-black flex-shrink-0">{t.name.slice(0,2).toUpperCase()}</div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium text-white/90 truncate">{t.name}</p><p className="text-[10px] text-white/30">{t.plan} · {t.branches} branche{t.branches!==1?'s':''}</p></div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_CLS[t.status]||STATUS_CLS.active} flex-shrink-0`}>{t.status}</span>
                  <div className="text-right flex-shrink-0"><p className="text-sm font-semibold text-[#C9A84C]">{t.monthlyRevenue.toLocaleString()} DH</p><p className="text-[10px] text-white/25">LTV: {t.lifetimeRevenue.toLocaleString()}</p></div>
                </div>
              ))}
              {filtered.length===0&&<p className="text-center text-white/20 text-sm py-10">Aucun résultat</p>}
            </div>
          </div>
          <div className="bg-[#141414] border border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06]"><h3 className="font-serif text-base">Top Affiliés</h3></div>
            <div className="divide-y divide-white/[0.03]">
              {(topReferrers||[]).slice(0,8).map((r:any,i:number) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <span className={`w-5 text-xs font-serif flex-shrink-0 ${i<3?'text-[#C9A84C]':'text-white/20'}`}>{i+1}</span>
                  <div className="flex-1 min-w-0"><p className="text-sm text-white/80 truncate">{r.referrer_name}</p><p className="text-[10px] text-white/30">{r.active_referrals}/{r.total_referrals} actifs</p></div>
                  <p className="text-sm font-semibold text-[#C9A84C] flex-shrink-0">${parseFloat(r.total_earned||'0').toFixed(0)}</p>
                </div>
              ))}
              {!(topReferrers||[]).length&&<p className="text-center text-white/20 text-xs py-8">Aucun affilié</p>}
            </div>
          </div>
        </div>

        {/* Signup sparkline */}
        {(signupChart||[]).length > 0 && (
          <div className="bg-[#141414] border border-white/[0.06] rounded-2xl p-5">
            <h3 className="font-serif text-sm text-white/70 mb-3">Inscriptions — 30 jours</h3>
            <div className="flex items-end gap-1 h-12">
              {(signupChart||[]).map((d:any,i:number) => { const max=Math.max(...(signupChart||[]).map((x:any)=>x.count),1); return <div key={i} className="flex-1 group relative" title={`${d.date}: ${d.count}`}><div className="bg-[#C9A84C]/40 group-hover:bg-[#C9A84C] transition-colors rounded-sm" style={{height:`${(d.count/max)*100}%`,minHeight:d.count>0?'4px':'0'}}/></div>; })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
