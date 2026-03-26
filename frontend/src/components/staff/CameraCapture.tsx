import { useEffect } from 'react';
import { useCameraCapture, type CameraFacing } from '../../hooks/useCameraCapture';

interface Props {
  facing?:   CameraFacing;
  onCapture: (dataUrl: string) => void;
  onCancel?: () => void;
  label?:    string;
}

export function CameraCapture({ facing = 'user', onCapture, onCancel, label = 'Prendre une photo' }: Props) {
  const { videoRef, canvasRef, state, startCamera, capture, retake, stopCamera } = useCameraCapture(facing);
  useEffect(() => { startCamera(); return () => stopCamera(); }, []);

  function handleCapture() { const d = capture(); if (d) onCapture(d); }

  if (state.error) return (
    <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-5 text-center aspect-video flex flex-col items-center justify-center">
      <p className="text-4xl mb-3">📷</p>
      <p className="text-red-400 text-sm font-semibold mb-1">Caméra inaccessible</p>
      <p className="text-red-300/60 text-xs mb-4 leading-relaxed">{state.error}</p>
      <div className="flex gap-2">
        <button onClick={startCamera} className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-2 rounded-xl text-sm hover:bg-red-500/30 transition-colors">Réessayer</button>
        {onCancel && <button onClick={onCancel} className="text-white/30 text-sm hover:text-white/50 px-4 py-2 transition-colors">Annuler</button>}
      </div>
    </div>
  );

  return (
    <div className="rounded-2xl overflow-hidden bg-black relative aspect-video">
      <canvas ref={canvasRef} className="hidden" />
      {state.photoDataUrl
        ? <img src={state.photoDataUrl} alt="Captured" className="w-full h-full object-cover" style={{ transform: facing === 'user' ? 'scaleX(-1)' : 'none' }} />
        : <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay style={{ transform: facing === 'user' ? 'scaleX(-1)' : 'none' }} />
      }
      {!state.isReady && !state.photoDataUrl && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-[#C9A84C]/30 border-t-[#C9A84C] rounded-full animate-spin" />
          <p className="text-white/50 text-xs">Activation caméra…</p>
        </div>
      )}
      {state.isReady && !state.photoDataUrl && facing === 'user' && (
        <div className="absolute inset-6 pointer-events-none">
          {['top-0 left-0 border-t border-l','top-0 right-0 border-t border-r','bottom-0 left-0 border-b border-l','bottom-0 right-0 border-b border-r'].map((cls,i) => (
            <div key={i} className={`absolute w-6 h-6 ${cls} border-[#C9A84C] rounded-sm`} />
          ))}
        </div>
      )}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full">
        <p className="text-[#C9A84C] text-[11px] font-semibold">{label}</p>
      </div>
      <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
        {!state.photoDataUrl ? (
          <div className="flex items-center justify-center gap-4">
            {onCancel && <button onClick={onCancel} className="text-white/50 text-xs hover:text-white/80 px-3 py-2 transition-colors">Annuler</button>}
            <button onClick={handleCapture} disabled={!state.isReady}
              className="w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-xl active:scale-90 transition-transform disabled:opacity-40">
              <div className="w-10 h-10 rounded-full border-2 border-black bg-white" />
            </button>
            {onCancel && <div className="w-16" />}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3">
            <button onClick={retake} className="flex-1 py-2.5 rounded-xl border border-white/20 text-white/70 text-sm hover:border-white/40 transition-colors">🔄 Reprendre</button>
            <button onClick={handleCapture} className="flex-1 py-2.5 rounded-xl bg-[#C9A84C] text-black text-sm font-bold hover:bg-[#E8C97A] transition-colors">✓ Utiliser</button>
          </div>
        )}
      </div>
    </div>
  );
}
