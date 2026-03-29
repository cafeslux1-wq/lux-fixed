// ─── PageLoader ───────────────────────────────────────────────────────
import React from 'react';

export function PageLoader() {
  return (
    <div className="lux-loader">
      <div className="lux-loader__ring" />
      <span className="lux-loader__label">LUX</span>
      <style>{`
        .lux-loader{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:14px;}
        .lux-loader__ring{width:36px;height:36px;border:3px solid #1E1E1E;border-top-color:#C9A84C;border-radius:50%;animation:spin .7s linear infinite;}
        .lux-loader__label{font-family:"Cinzel",serif;color:#C9A84C;font-size:13px;letter-spacing:4px;}
      `}</style>
    </div>
  );
}

// ─── SyncBar ──────────────────────────────────────────────────────────
import { useApp } from '../../lib/store';

export function SyncBar() {
  const { state } = useApp();
  if (state.isOnline && state.syncPending === 0) return null;

  const isOffline  = !state.isOnline;
  const bgColor    = isOffline ? 'rgba(224,82,82,.1)'   : 'rgba(201,168,76,.08)';
  const borderColor= isOffline ? 'rgba(224,82,82,.25)'  : 'rgba(201,168,76,.2)';
  const textColor  = isOffline ? '#E05252'               : '#C9A84C';

  return (
    <div style={{
      background: bgColor, borderBottom: `1px solid ${borderColor}`,
      padding: '6px 16px', fontSize: 11, color: textColor,
      display: 'flex', alignItems: 'center', gap: 8, zIndex: 50,
    }}>
      <span>{isOffline ? '⚠' : '⟳'}</span>
      <span>
        {isOffline
          ? 'Mode hors ligne — données sauvegardées localement'
          : `Synchronisation… ${state.syncPending} en attente`}
      </span>
      {isOffline && (
        <span style={{ marginLeft: 'auto', opacity: 0.5 }}>
          Reconnexion automatique
        </span>
      )}
    </div>
  );
}

// ─── ToastStack ───────────────────────────────────────────────────────
export function ToastStack() {
  const { state, dispatch } = useApp();
  const { toastQueue } = state;

  React.useEffect(() => {
    if (!toastQueue.length) return;
    const last = toastQueue[toastQueue.length - 1];
    const t = setTimeout(() => dispatch({ type: 'TOAST_REMOVE', payload: last.id }), 2800);
    return () => clearTimeout(t);
  }, [toastQueue]);

  if (!toastQueue.length) return null;

  const colors: Record<string, string> = {
    success: 'rgba(61,190,122,.95)',
    error:   'rgba(224,82,82,.95)',
    warning: 'rgba(224,120,48,.95)',
    info:    'rgba(201,168,76,.95)',
  };

  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%',
      transform: 'translateX(-50%)', zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center',
      pointerEvents: 'none',
    }}>
      {toastQueue.map(t => (
        <div key={t.id} style={{
          background: colors[t.type] ?? colors.info,
          color: '#000', padding: '10px 22px', borderRadius: 20,
          fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
          boxShadow: '0 4px 20px rgba(0,0,0,.5)',
          animation: 'fadeUp .25s ease',
        }}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ─── Skeleton (for loading states) ───────────────────────────────────
export function Skeleton({ w = '100%', h = 20, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: 'linear-gradient(90deg,#1A1A1A 25%,#222 50%,#1A1A1A 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s ease infinite',
    }}/>
  );
}
