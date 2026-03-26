import { useState, useEffect } from 'react';
import { API, auth } from '../../services/api';
import { useAppStore } from '../../hooks/useStore';

const BRANCH_ID = import.meta.env.VITE_BRANCH_ID || 'b0000000-0000-0000-0000-000000000001';
const ROLE_LABELS: Record<string,string> = { owner:'Propriétaire', manager:'Manager', cashier:'Caissier(e)', barista:'Barista', waiter:'Serveur(se)', cook:'Cuisinier', driver:'Livreur(se)', patissier:'Pâtissier(e)', cleaner:'Nettoyage' };
const ROLE_COLORS: Record<string,string> = { owner:'badge-gold', manager:'bg-blue-500/15 text-blue-400', cashier:'bg-green-500/15 text-green-400', barista:'bg-orange-500/15 text-orange-400', default:'badge-gold' };

interface StaffCard { id: string; name: string; role: string; initials: string; photoUrl: string | null }

export default function PinLogin({ onSuccess }: { onSuccess: () => void }) {
  const [staff,    setStaff]   = useState<StaffCard[]>([]);
  const [selected, setSelected] = useState<StaffCard|null>(null);
  const [pin,      setPin]     = useState('');
  const [loading,  setLoading] = useState(false);
  const [error,    setError]   = useState('');
  const [loadingStaff, setLoadingStaff] = useState(true);
  const { setStaff: setGlobalStaff } = useAppStore();

  useEffect(() => {
    API.auth.branchStaff(BRANCH_ID).then(r => setStaff(r.data)).catch(() => setError('Impossible de charger le personnel')).finally(() => setLoadingStaff(false));
  }, []);

  useEffect(() => { if (pin.length >= 4 && selected) handleLogin(); }, [pin]);

  async function handleLogin() {
    if (!selected || pin.length < 4) return;
    setLoading(true); setError('');
    try {
      const res = await API.auth.loginPin(selected.id, pin, BRANCH_ID);
      auth.setToken(res.data.accessToken); auth.setStaff(res.data.staff); setGlobalStaff(res.data.staff); onSuccess();
    } catch { setError('PIN incorrect — réessayez'); setPin(''); }
    finally { setLoading(false); }
  }

  function handlePinKey(key: string) {
    if (loading) return;
    if (key === 'del') { setPin(p => p.slice(0,-1)); setError(''); }
    else if (pin.length < 6) setPin(p => p + key);
  }

  if (!selected) return (
    <div className="flex flex-col items-center justify-center h-full bg-black animate-fade-in p-8">
      <div className="mb-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#C9A84C] to-[#8B6E2F] flex items-center justify-center text-3xl font-serif font-bold text-black mx-auto mb-4">L</div>
        <h1 className="font-serif text-2xl text-[#C9A84C]">Café LUX</h1>
        <p className="text-white/40 text-sm mt-1">Sélectionnez votre profil</p>
      </div>
      {loadingStaff ? <div className="flex gap-3">{[1,2,3].map(i => <div key={i} className="w-28 h-32 lux-card rounded-xl animate-pulse" />)}</div> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-w-2xl w-full">
          {staff.map(s => (
            <button key={s.id} onClick={() => { setSelected(s); setPin(''); setError(''); }}
              className="lux-card rounded-xl p-5 flex flex-col items-center gap-3 hover:border-[#C9A84C]/40 hover:bg-[#C9A84C]/5 active:scale-95 transition-all duration-200 group">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#C9A84C] to-[#8B6E2F] flex items-center justify-center font-serif text-xl font-bold text-black">{s.initials}</div>
              <div className="text-center"><p className="text-sm font-semibold text-white truncate max-w-[100px]">{s.name.split(' ')[0]}</p><span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold mt-1 ${ROLE_COLORS[s.role]||ROLE_COLORS.default}`}>{ROLE_LABELS[s.role]||s.role}</span></div>
            </button>
          ))}
        </div>
      )}
      {error && <p className="mt-6 text-red-400 text-sm bg-red-500/10 px-4 py-2 rounded-lg">{error}</p>}
    </div>
  );

  return (
    <div className="flex flex-col items-center justify-center h-full bg-black p-8">
      <button onClick={() => { setSelected(null); setPin(''); setError(''); }} className="absolute top-6 left-6 text-white/40 hover:text-white/70 text-sm flex items-center gap-2 transition-colors">← Retour</button>
      <div className="mb-8 text-center">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#C9A84C] to-[#8B6E2F] flex items-center justify-center font-serif text-2xl font-bold text-black mx-auto mb-4">{selected.initials}</div>
        <h2 className="font-serif text-xl text-white">{selected.name}</h2>
        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold mt-2 ${ROLE_COLORS[selected.role]||ROLE_COLORS.default}`}>{ROLE_LABELS[selected.role]||selected.role}</span>
      </div>
      <div className="flex gap-4 mb-6">{[0,1,2,3,4,5].map(i => <div key={i} className={`w-4 h-4 rounded-full transition-all duration-150 ${i < pin.length ? 'bg-[#C9A84C] scale-110' : 'bg-white/10 border border-white/20'}`} />)}</div>
      {error && <p className="mb-4 text-red-400 text-sm text-center">{error}</p>}
      <div className="grid grid-cols-3 gap-3 w-64">
        {['1','2','3','4','5','6','7','8','9','','0','del'].map((k,i) => {
          if (!k) return <div key={i} />;
          return <button key={k} onClick={() => handlePinKey(k)} disabled={loading}
            className={`h-16 rounded-xl font-semibold text-xl transition-all duration-150 active:scale-90 ${k==='del'?'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 text-base':'bg-[#141414] border border-white/[0.06] text-white hover:border-[#C9A84C]/40 hover:bg-[#C9A84C]/5 hover:text-[#C9A84C]'} disabled:opacity-30`}>
            {k === 'del' ? <span className="flex items-center justify-center"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" /></svg></span> : k}
          </button>;
        })}
      </div>
      {loading && <div className="mt-6 flex items-center gap-2 text-[#C9A84C] text-sm"><div className="w-4 h-4 border-2 border-[#C9A84C]/30 border-t-[#C9A84C] rounded-full animate-spin" />Authentification…</div>}
    </div>
  );
}
