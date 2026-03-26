import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API } from '../../services/api';
import { useGeofence } from '../../hooks/useGeofence';
import { CameraCapture } from './CameraCapture';

const DEFAULT_TARGET = { lat: 34.21670000, lng: -4.01670000, radiusM: 20 };
type Tab = 'clock' | 'tasks' | 'salfiya' | 'profile';

function Stars({ v }: { v: number }) {
  return <span className="flex gap-0.5">{Array.from({length:5},(_,i)=><svg key={i} className={`w-3 h-3 ${i<Math.round(v)?'text-[#C9A84C]':'text-white/15'}`} viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>)}</span>;
}

// ── CLOCK TAB ─────────────────────────────────────────────────────────────
function ClockTab() {
  const qc = useQueryClient();
  type Step = 'idle'|'gps'|'selfie'|'preview'|'submitting'|'done';
  const [step, setStep]     = useState<Step>('idle');
  const [selfieUrl, setSelfie] = useState<string|null>(null);
  const [result, setResult] = useState<{ok:boolean;msg:string;penaltyDH?:number}|null>(null);
  const { data: fenceData } = useQuery({ queryKey:['geofence'], queryFn: () => API.hr.geofence().then((r:any) => r.data) });
  const target = fenceData?.enabled ? { lat: parseFloat(fenceData.lat), lng: parseFloat(fenceData.lng), radiusM: fenceData.radiusM || fenceData.radius_m } : DEFAULT_TARGET;
  const geo = useGeofence(step === 'gps' || step === 'selfie' || step === 'preview' ? target : null);
  const { data: att } = useQuery({ queryKey:['today-att'], queryFn: () => API.hr.todayAtt().then((r:any) => r.data), refetchInterval: 30_000 });
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const isClockedIn  = !!att?.today?.clock_in && !att?.today?.clock_out;
  const isClockedOut = !!att?.today?.clock_out;

  function startFlow() {
    if (isClockedIn) { handleClockOut(); return; }
    setStep('gps'); setSelfie(null); setResult(null);
  }
  useEffect(() => { if (step === 'gps' && geo.isInside) setTimeout(() => setStep('selfie'), 600); }, [step, geo.isInside]);

  async function submitClockIn() {
    if (!selfieUrl || !geo.lat || !geo.lng) return;
    setStep('submitting');
    try {
      const res: any = await API.hr.clockIn({ lat: geo.lat, lng: geo.lng, accuracyM: geo.accuracyM, selfieUrl });
      setResult({ ok: true, msg: res.data.message, penaltyDH: res.data.delayPenalty });
      qc.invalidateQueries({ queryKey:['today-att'] }); qc.invalidateQueries({ queryKey:['my-profile'] });
      setStep('done');
    } catch (e: any) {
      setResult({ ok: false, msg: e.message || 'Erreur' }); setStep('idle');
    }
  }

  async function handleClockOut() {
    try { await API.hr.clockOut(); qc.invalidateQueries({ queryKey:['today-att'] }); qc.invalidateQueries({ queryKey:['my-profile'] }); } catch {}
  }

  return (
    <div className="flex flex-col items-center px-4 pt-6 pb-28 min-h-full">
      <p className="font-mono text-5xl text-white font-light tracking-widest mb-1 tabular-nums">{now.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</p>
      <p className="text-white/30 text-sm mb-6">{now.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}</p>
      {att?.schedule && <div className="w-full bg-[#141414] border border-white/[0.06] rounded-xl px-4 py-3 mb-4 flex items-center justify-between"><div><p className="text-white/30 text-[10px] uppercase tracking-wide">Shift planifié</p><p className="text-white font-semibold text-sm">{att.schedule.start_time} — {att.schedule.end_time}</p></div>{att.today?.delay_penalty > 0 && <div className="text-right"><p className="text-red-400 text-sm font-bold animate-pulse">-{att.today.delay_penalty} DH</p><p className="text-red-400/60 text-[10px]">{att.today.delay_minutes} min retard</p></div>}</div>}
      <div className="w-full bg-[#C9A84C]/5 border border-[#C9A84C]/15 rounded-xl px-4 py-2.5 mb-6"><p className="text-[#C9A84C] text-[11px] text-center">⏱ Grâce: <strong>10 min</strong> · Retard: <strong>10 DH/heure</strong> · GPS + Selfie requis</p></div>
      {(step === 'idle' || step === 'done') && (
        <div className="relative flex items-center justify-center mb-6" style={{width:200,height:200}}>
          {!isClockedIn && !isClockedOut && <><div className="absolute w-44 h-44 rounded-full bg-[#C9A84C]/10" style={{animation:'ripple 1.8s ease-out infinite'}}/><div className="absolute w-44 h-44 rounded-full bg-[#C9A84C]/5" style={{animation:'ripple 1.8s ease-out infinite',animationDelay:'0.6s'}}/></>}
          <style>{`@keyframes ripple{to{transform:scale(2.5);opacity:0}}`}</style>
          <button onClick={startFlow} disabled={isClockedOut}
            className={`relative w-40 h-40 rounded-full flex flex-col items-center justify-center gap-2 transition-all duration-300 active:scale-95 disabled:opacity-40 ${isClockedOut?'bg-white/5 border-2 border-white/10 cursor-not-allowed':isClockedIn?'bg-gradient-to-br from-red-600 to-red-800 shadow-[0_0_50px_rgba(239,68,68,0.3)] border-2 border-red-500/40':'bg-gradient-to-br from-[#C9A84C] to-[#8B6E2F] shadow-[0_0_50px_rgba(201,168,76,0.3)] border-2 border-[#C9A84C]/40'}`}>
            {isClockedOut?<><span className="text-3xl">✅</span><span className="text-white/40 text-xs">Journée terminée</span></>:isClockedIn?<><span className="text-3xl">⏹</span><span className="text-white font-bold">Départ</span></>:<><span className="text-3xl">▶</span><span className="text-black font-bold text-lg">Arrivée</span><span className="text-black/60 text-[11px]">GPS + Selfie requis</span></>}
          </button>
        </div>
      )}
      {step === 'gps' && (
        <div className="w-full space-y-3 mb-4">
          <div className={`rounded-2xl border p-5 transition-all ${geo.isInside?'bg-green-500/10 border-green-500/30':geo.status==='outside'?'bg-red-500/10 border-red-500/30':'bg-[#141414] border-white/[0.06]'}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${geo.isInside?'bg-green-500/20':geo.isLoading?'bg-[#C9A84C]/20':'bg-red-500/20'}`}>
                {geo.isLoading?<div className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin text-[#C9A84C]"/>:geo.isInside?'✅':geo.status==='outside'?'🚫':'📍'}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Vérification GPS</p>
                <p className={`text-xs mt-0.5 ${geo.isInside?'text-green-400':geo.status==='outside'?'text-red-400':'text-white/40'}`}>{geo.isLoading?'Localisation en cours…':geo.isInside?`✓ Dans le café (${geo.distanceM}m)`:geo.errorMsg||'En attente du GPS…'}</p>
              </div>
            </div>
            {geo.accuracyM && <div><div className="flex justify-between text-[10px] text-white/30 mb-1"><span>Précision GPS</span><span className={geo.accuracyM<10?'text-green-400':geo.accuracyM<30?'text-yellow-400':'text-red-400'}>±{geo.accuracyM.toFixed(0)}m</span></div><div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${geo.accuracyM<10?'bg-green-400':geo.accuracyM<30?'bg-yellow-400':'bg-red-400'}`} style={{width:`${Math.min(100,Math.max(10,100-geo.accuracyM*2))}%`}}/></div></div>}
          </div>
          <button onClick={() => setStep('idle')} className="w-full py-3 rounded-xl border border-white/[0.06] text-white/40 text-sm hover:text-white/60 transition-colors">Annuler</button>
        </div>
      )}
      {step === 'selfie' && (
        <div className="w-full space-y-3">
          <div className="bg-[#C9A84C]/5 border border-[#C9A84C]/20 rounded-xl px-4 py-2.5 flex items-center gap-2"><span className="text-green-400 text-sm">✓ GPS validé</span><span className="text-white/20 mx-1">·</span><span className="text-[#C9A84C] text-sm font-semibold">📸 Prenez votre selfie</span></div>
          <CameraCapture facing="user" label="Selfie de pointage" onCapture={(d) => { setSelfie(d); setStep('preview'); }} onCancel={() => setStep('idle')} />
        </div>
      )}
      {step === 'preview' && selfieUrl && (
        <div className="w-full space-y-3">
          <p className="text-center text-white/50 text-sm">Confirmez votre selfie</p>
          <div className="w-40 h-40 mx-auto rounded-2xl overflow-hidden border-2 border-[#C9A84C]/40 relative shadow-xl"><img src={selfieUrl} alt="Selfie" className="w-full h-full object-cover" style={{transform:'scaleX(-1)'}}/><div className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center"><svg className="w-3.5 h-3.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M2 6l3 3 5-5" strokeLinecap="round"/></svg></div></div>
          <div className="bg-[#141414] border border-white/[0.06] rounded-xl px-4 py-3 flex items-center gap-3"><span className="text-green-400">📍</span><div><p className="text-white/80 text-xs font-semibold">Localisation vérifiée</p><p className="text-white/30 text-[10px]">{geo.distanceM}m du café</p></div></div>
          <div className="flex gap-3">
            <button onClick={() => { setSelfie(null); setStep('selfie'); }} className="flex-1 py-3 rounded-xl border border-white/[0.06] text-white/50 text-sm hover:border-white/15 transition-colors">🔄 Reprendre</button>
            <button onClick={submitClockIn} className="flex-1 py-3 rounded-xl bg-[#C9A84C] text-black font-bold text-sm hover:bg-[#E8C97A] transition-colors active:scale-[0.98]">✓ Confirmer</button>
          </div>
        </div>
      )}
      {step === 'submitting' && <div className="flex flex-col items-center gap-3 py-8"><div className="w-12 h-12 border-2 border-[#C9A84C]/30 border-t-[#C9A84C] rounded-full animate-spin"/><p className="text-white/50 text-sm">Enregistrement…</p></div>}
      {result && <div className={`w-full mt-4 p-4 rounded-2xl border ${result.ok?'bg-green-500/10 border-green-500/20':'bg-red-500/10 border-red-500/20'}`}><p className={`text-sm font-semibold ${result.ok?'text-green-300':'text-red-300'}`}>{result.msg}</p>{result.penaltyDH && result.penaltyDH > 0 && <p className="text-red-400 font-bold text-base mt-1">-{result.penaltyDH} DH déduits du salaire</p>}</div>}
      {isClockedIn && att?.today?.clock_in && <div className="w-full mt-4 bg-[#141414] border border-white/[0.06] rounded-xl p-4 text-center"><p className="text-green-400 text-sm">Arrivée: {new Date(att.today.clock_in).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</p></div>}
    </div>
  );
}

// ── TASKS TAB ─────────────────────────────────────────────────────────────
function TasksTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey:['today-tasks'], queryFn: () => API.hr.tasks().then((r:any) => r.data) });
  const [completed, setCompleted] = useState<Record<string,boolean>>({});
  const [photos, setPhotos] = useState<Record<string,string>>({});
  const [cameraTask, setCameraTask] = useState<string|null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!data) return;
    const init: Record<string,boolean> = {};
    for (const tasks of Object.values(data.tasksByCategory||{}) as unknown[]) for (const t of tasks as any[]) init[t.id] = t.isCompleted;
    setCompleted(init);
  }, [data]);

  const allTasks = Object.values(data?.tasksByCategory||{}).flat() as any[];
  const doneCount = Object.values(completed).filter(Boolean).length;
  const progress  = allTasks.length > 0 ? (doneCount / allTasks.length) * 100 : 0;
  const pendingFines = allTasks.filter(t => !completed[t.id]).reduce((s:number,t:any) => s+t.penalty, 0);

  async function saveAll() {
    setSaving(true);
    const completions = allTasks.map(t => ({ taskId: t.id, isCompleted: !!completed[t.id], proofPhotoUrl: photos[t.id]||undefined, evidenceImageUrl: photos[t.id]||undefined }));
    await API.hr.submitTasks(completions);
    setSaving(false); setSaved(true);
    qc.invalidateQueries({ queryKey:['today-tasks'] }); qc.invalidateQueries({ queryKey:['my-profile'] });
    setTimeout(() => setSaved(false), 2000);
  }

  const CAT: Record<string,{label:string;icon:string}> = { opening:{label:'Ouverture',icon:'🌅'}, service:{label:'En service',icon:'⚡'}, closing:{label:'Fermeture',icon:'🌙'}, hygiene:{label:'Hygiène',icon:'🧽'}, security:{label:'Sécurité',icon:'🔒'} };

  if (isLoading) return <div className="flex items-center justify-center h-48"><div className="w-7 h-7 border-2 border-[#C9A84C]/30 border-t-[#C9A84C] rounded-full animate-spin"/></div>;
  if (cameraTask) {
    const taskName = allTasks.find(t => t.id === cameraTask)?.name || 'Tâche';
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="p-4 flex items-center gap-3"><button onClick={() => setCameraTask(null)} className="text-white/40 hover:text-white/70 p-1"><svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/></svg></button><div><p className="text-[#C9A84C] font-semibold text-sm">Photo requise</p><p className="text-white/40 text-xs truncate max-w-xs">{taskName}</p></div></div>
        <div className="flex-1 px-4 pb-4"><CameraCapture facing="environment" label="Photo de la tâche" onCapture={(d) => { setPhotos(p => ({...p,[cameraTask]:d})); setCompleted(p => ({...p,[cameraTask]:true})); setCameraTask(null); setToast('📸 Photo enregistrée — tâche validée!'); setTimeout(() => setToast(''),2500); }} onCancel={() => setCameraTask(null)} /></div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-28">
      <div className="bg-[#141414] border border-white/[0.06] rounded-2xl p-4 mb-4">
        <div className="flex justify-between items-center mb-2"><span className="text-white/50 text-sm">{doneCount}/{allTasks.length} tâches</span><span className={`text-sm font-bold ${progress===100?'text-green-400':'text-[#C9A84C]'}`}>{progress.toFixed(0)}%</span></div>
        <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-[#C9A84C] to-[#E8C97A] transition-all duration-500" style={{width:`${progress}%`}}/></div>
        {pendingFines > 0 && <p className="text-red-400/70 text-xs mt-2 font-medium">⚠ Pénalité potentielle: <strong className="text-red-400">{pendingFines} DH</strong></p>}
      </div>
      <div className="bg-red-500/5 border border-red-500/15 rounded-xl px-4 py-2.5 mb-4"><p className="text-red-400/80 text-xs text-center"><strong>📋 25 DH</strong> par tâche manquée · <strong>100 DH</strong> pour fausse déclaration</p></div>
      {Object.entries(data?.tasksByCategory||{}).map(([cat,tasks]) => {
        const meta = CAT[cat]||{label:cat,icon:'📋'};
        return (
          <div key={cat} className="mb-5">
            <p className="text-[10px] text-white/30 uppercase tracking-widest flex items-center gap-1.5 mb-2">{meta.icon} {meta.label}</p>
            <div className="space-y-2">
              {(tasks as any[]).map(task => (
                <div key={task.id} className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all ${completed[task.id]?'bg-[#C9A84C]/8 border-[#C9A84C]/25':'bg-[#141414] border-white/[0.06]'}`}>
                  {task.requiresPhoto ? (
                    <button onClick={() => !completed[task.id] && setCameraTask(task.id)} className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${completed[task.id]&&photos[task.id]?'bg-[#C9A84C] text-black':'bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30 active:scale-90'}`}>
                      {completed[task.id]&&photos[task.id]?<svg className="w-5 h-5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M2 6l3 3 5-5" strokeLinecap="round"/></svg>:<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>}
                    </button>
                  ) : (
                    <button onClick={() => setCompleted(p => ({...p,[task.id]:!p[task.id]}))} className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all active:scale-90 ${completed[task.id]?'bg-[#C9A84C] text-black':'bg-white/[0.06] border border-white/15 text-white/30 hover:border-white/30'}`}>
                      {completed[task.id]&&<svg className="w-5 h-5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M2 6l3 3 5-5" strokeLinecap="round"/></svg>}
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm transition-all ${completed[task.id]?'text-white/50 line-through':'text-white/90'}`}>{task.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {task.requiresPhoto && <span className={`text-[10px] flex items-center gap-0.5 ${photos[task.id]?'text-green-400/70':'text-blue-400/70'}`}>📸 {photos[task.id]?'Photo prise ✓':'Photo obligatoire'}</span>}
                      {!completed[task.id] && <span className="text-[10px] text-red-400/40">-{task.penalty} DH</span>}
                    </div>
                  </div>
                  {completed[task.id]&&photos[task.id]&&<img src={photos[task.id]} alt="proof" className="w-10 h-10 rounded-lg object-cover border border-[#C9A84C]/30 flex-shrink-0"/>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <button onClick={saveAll} disabled={saving} className={`w-full py-4 rounded-2xl font-bold text-sm transition-all active:scale-[0.98] ${saved?'bg-green-500 text-white':'bg-[#C9A84C] text-black hover:bg-[#E8C97A]'}`}>
        {saving?<span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"/>Sauvegarde…</span>:saved?'✓ Sauvegardé!':'Enregistrer les tâches'}
      </button>
      {toast && <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#141414] border border-[#C9A84C]/30 text-[#C9A84C] text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl z-50">{toast}</div>}
    </div>
  );
}

// ── SALFIYA TAB ───────────────────────────────────────────────────────────
function SalfiyaTab() {
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [urgency, setUrgency] = useState<'normal'|'urgent'>('normal');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ok:boolean;text:string}|null>(null);
  const { data: requests } = useQuery({ queryKey:['my-requests'], queryFn: () => API.hr.salfiya().then((r:any) => r.data) });

  async function submit() {
    if (!amount || !reason) return;
    setSubmitting(true);
    try {
      await API.hr.requestAdv({ amount: parseFloat(amount), reason, urgency });
      setMsg({ ok:true, text:'Demande soumise ✓' }); setAmount(''); setReason('');
      qc.invalidateQueries({ queryKey:['my-requests'] }); qc.invalidateQueries({ queryKey:['my-profile'] });
    } catch (e:any) { setMsg({ ok:false, text: e.message||'Erreur' }); }
    setSubmitting(false); setTimeout(() => setMsg(null), 3000);
  }

  const STATUS_CLS: Record<string,string> = { pending:'bg-yellow-500/15 text-yellow-400', manager_approved:'bg-blue-500/15 text-blue-400', approved:'bg-green-500/15 text-green-400', paid:'bg-green-500/15 text-green-400', rejected:'bg-red-500/15 text-red-400' };
  const STATUS_LBL: Record<string,string> = { pending:'En attente', manager_approved:'Approuvé manager', approved:'Approuvé', paid:'Versé 💰', rejected:'Refusé' };

  return (
    <div className="px-4 pt-4 pb-28">
      <div className="bg-[#141414] border border-white/[0.06] rounded-2xl p-5 mb-4">
        <h3 className="font-serif text-sm text-[#C9A84C] mb-4">Nouvelle demande</h3>
        <div className="space-y-3">
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Montant (DH)" className="w-full bg-[#1A1A1A] border border-white/[0.06] focus:border-[#C9A84C]/40 rounded-xl px-3 py-2.5 text-sm text-white outline-none"/>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Motif de la demande…" className="w-full bg-[#1A1A1A] border border-white/[0.06] focus:border-[#C9A84C]/40 rounded-xl px-3 py-2.5 text-sm text-white outline-none resize-none"/>
          <div className="flex gap-2">
            {(['normal','urgent'] as const).map(u => <button key={u} onClick={() => setUrgency(u)} className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${urgency===u?(u==='urgent'?'bg-red-500/20 text-red-400 border border-red-500/30':'bg-[#C9A84C]/20 text-[#C9A84C] border border-[#C9A84C]/30'):'bg-white/5 text-white/40 border border-white/[0.06]'}`}>{u==='normal'?'🟡 Normal':'🔴 Urgent'}</button>)}
          </div>
        </div>
        {msg && <div className={`mt-3 p-3 rounded-xl text-xs text-center ${msg.ok?'bg-green-500/10 text-green-400':'bg-red-500/10 text-red-400'}`}>{msg.text}</div>}
        <button onClick={submit} disabled={submitting||!amount||!reason} className="w-full mt-4 py-3.5 rounded-xl bg-[#C9A84C] text-black font-bold text-sm hover:bg-[#E8C97A] transition-colors disabled:opacity-40">{submitting?'Envoi…':'Soumettre'}</button>
      </div>
      <div className="space-y-2">
        {(requests||[]).map((r:any) => (
          <div key={r.id} className="bg-[#141414] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center justify-between"><p className="font-semibold text-white text-sm">{r.amount} DH</p><span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ${STATUS_CLS[r.status]||'bg-white/5 text-white/30'}`}>{STATUS_LBL[r.status]||r.status}</span></div>
            {r.reason && <p className="text-white/40 text-xs mt-1 truncate">{r.reason}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PROFILE TAB ───────────────────────────────────────────────────────────
function ProfileTab() {
  const { data: profile, isLoading } = useQuery({ queryKey:['my-profile'], queryFn: () => API.hr.me().then((r:any) => r.data), staleTime: 30_000, refetchInterval: 60_000 });
  if (isLoading) return <div className="flex items-center justify-center h-48"><div className="w-7 h-7 border-2 border-[#C9A84C]/30 border-t-[#C9A84C] rounded-full animate-spin"/></div>;
  if (!profile) return null;
  const sal = profile.salary;
  const totalPenalties = (sal?.delayPenalties||0) + (sal?.taskPenalties||0);
  const hasPenalties   = totalPenalties > 0;
  return (
    <div className="px-4 pt-4 pb-28">
      <div className="flex flex-col items-center text-center mb-6">
        <div className="relative mb-3">{profile.avatar_url?<img src={profile.avatar_url} alt={profile.full_name} className="w-20 h-20 rounded-full object-cover border-2 border-[#C9A84C]/40"/>:<div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#C9A84C] to-[#8B6E2F] flex items-center justify-center font-serif text-3xl font-bold text-black">{profile.full_name?.charAt(0).toUpperCase()}</div>}</div>
        <h2 className="font-serif text-xl text-white">{profile.full_name}</h2>
        <p className="text-[#C9A84C] text-sm capitalize mt-0.5">{profile.role}</p>
        <p className="text-white/30 text-xs">{profile.branch_name}</p>
        {profile.avg_rating > 0 && <div className="flex items-center gap-1.5 mt-2"><Stars v={profile.avg_rating}/><span className="text-white/40 text-xs">({profile.rating_count})</span></div>}
      </div>
      {sal && (
        <div className={`rounded-2xl p-5 mb-4 border transition-all duration-500 ${hasPenalties?'bg-red-500/5 border-red-500/20':'bg-[#141414] border-white/[0.06]'}`}>
          <div className="flex items-center justify-between mb-4"><h3 className="font-serif text-sm text-[#C9A84C]">Salaire — mois en cours</h3>{hasPenalties&&<span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full font-semibold animate-pulse">⚠ Pénalités actives</span>}</div>
          <div className="space-y-2.5">
            {[{label:'Salaire de base',value:`+ ${sal.base?.toFixed(2)} DH`,cls:'text-white'},{label:'Retards',value:sal.delayPenalties>0?`− ${sal.delayPenalties?.toFixed(2)} DH`:'0 DH',cls:sal.delayPenalties>0?'text-red-400 font-bold':'text-white/25'},{label:'Tâches manquées',value:sal.taskPenalties>0?`− ${sal.taskPenalties?.toFixed(2)} DH`:'0 DH',cls:sal.taskPenalties>0?'text-red-400 font-bold':'text-white/25'},{label:'Avances Salfiya',value:sal.advances>0?`− ${sal.advances?.toFixed(2)} DH`:'0 DH',cls:sal.advances>0?'text-orange-400':'text-white/25'},{label:'Prime partage',value:sal.profitShare>0?`+ ${sal.profitShare?.toFixed(2)} DH`:'0 DH',cls:sal.profitShare>0?'text-green-400':'text-white/25'}].map(row=><div key={row.label} className="flex items-center justify-between"><span className="text-white/50 text-sm">{row.label}</span><span className={`text-sm font-medium ${row.cls}`}>{row.value}</span></div>)}
            <div className="border-t border-white/[0.06] pt-2.5 flex items-center justify-between"><span className="font-semibold text-white text-sm">Net estimé</span><span className={`font-serif text-2xl font-bold transition-colors duration-500 ${sal.netPreview>=0?'text-[#C9A84C]':'text-red-400'}`}>{sal.netPreview?.toFixed(2)} DH</span></div>
          </div>
          {hasPenalties&&<div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl p-3"><p className="text-red-400 text-xs text-center"><strong>Impact immédiat:</strong> −{totalPenalties.toFixed(2)} DH déduits</p></div>}
        </div>
      )}
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────
export default function StaffPortal() {
  const [tab, setTab] = useState<Tab>('clock');
  const tabs = [{id:'clock',label:'Pointage',icon:'⏱'},{id:'tasks',label:'Tâches',icon:'✅'},{id:'salfiya',label:'Salfiya',icon:'💸'},{id:'profile',label:'Profil',icon:'👤'}] as const;
  return (
    <div className="bg-[#0D0D0D] text-white min-h-screen font-sans flex flex-col max-w-md mx-auto relative overflow-hidden">
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/[0.06] flex-shrink-0 bg-[#0D0D0D] z-10">
        <div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#C9A84C] to-[#8B6E2F] flex items-center justify-center font-serif text-base font-bold text-black">L</div><div><p className="font-serif text-[#C9A84C] text-sm">LUX Staff Portal</p><p className="text-white/20 text-[10px]">{new Date().toLocaleDateString('fr-FR')}</p></div></div>
        <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"/><span className="text-white/25 text-xs">En ligne</span></div>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {tab==='clock'&&<ClockTab/>}{tab==='tasks'&&<TasksTab/>}{tab==='salfiya'&&<SalfiyaTab/>}{tab==='profile'&&<ProfileTab/>}
      </div>
      <nav className="flex px-2 py-2 border-t border-white/[0.06] bg-[#141414]/95 backdrop-blur-xl flex-shrink-0">
        {tabs.map(t=><button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all ${tab===t.id?'bg-[#C9A84C]/10':''}`}><span className="text-lg">{t.icon}</span><span className={`text-[10px] font-medium ${tab===t.id?'text-[#C9A84C]':'text-white/30'}`}>{t.label}</span></button>)}
      </nav>
    </div>
  );
}
