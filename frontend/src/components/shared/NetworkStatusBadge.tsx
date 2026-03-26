/**
 * LUX SUPREME — NetworkStatusBadge
 * Shows 🟢 Online / 🔴 Offline / 🟡 Syncing status.
 * Offline: queues orders locally + offers window.print() fallback.
 */
import { useState, useEffect } from 'react';
import { useOfflineQueue } from '../../hooks/useOfflineQueue';

export function NetworkStatusBadge() {
  const { pendingCount, failedCount, syncing, flushQueue, isOnline } = useOfflineQueue();
  const [isVisible, setIsVisible]  = useState(false);
  const [popupOpen, setPopupOpen]  = useState(false);

  // Show badge when offline or has pending items
  useEffect(() => {
    setIsVisible(!isOnline || pendingCount > 0 || failedCount > 0 || syncing);
  }, [isOnline, pendingCount, failedCount, syncing]);

  if (!isVisible) return null;

  const color = !isOnline ? 'red' : syncing ? 'yellow' : failedCount > 0 ? 'red' : 'yellow';
  const label = !isOnline ? 'Hors ligne'
    : syncing             ? 'Synchronisation…'
    : failedCount > 0     ? `${failedCount} échec(s)`
    : `${pendingCount} en attente`;
  const dot   = !isOnline ? 'bg-red-400' : syncing ? 'bg-yellow-400 animate-pulse' : 'bg-yellow-400';

  return (
    <div className="relative">
      <button
        onClick={() => setPopupOpen(p => !p)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
          color === 'red'
            ? 'bg-red-500/10 border-red-500/30 text-red-400'
            : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
        }`}
      >
        <div className={`w-2 h-2 rounded-full ${dot}`} />
        {label}
        {pendingCount > 0 && <span className="bg-current/20 px-1.5 rounded-full">{pendingCount}</span>}
      </button>

      {popupOpen && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-[#141414] border border-white/[0.08] rounded-2xl shadow-xl z-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-white">Statut de connexion</h4>
            <button onClick={() => setPopupOpen(false)} className="text-white/30 hover:text-white/60">✕</button>
          </div>

          {!isOnline && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-3">
              <p className="text-red-300 text-xs font-semibold">📵 Vous êtes hors ligne</p>
              <p className="text-red-300/60 text-[11px] mt-1">
                Les commandes sont sauvegardées localement et seront synchronisées automatiquement à la reconnexion.
              </p>
            </div>
          )}

          {pendingCount > 0 && (
            <div className="mb-3">
              <p className="text-yellow-400 text-xs mb-2">{pendingCount} commande(s) en attente de synchronisation</p>
              {isOnline && (
                <button onClick={() => { flushQueue(); setPopupOpen(false); }}
                  className="w-full py-2 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-xs rounded-xl hover:bg-yellow-500/30 transition-colors">
                  ↺ Synchroniser maintenant
                </button>
              )}
            </div>
          )}

          {failedCount > 0 && (
            <p className="text-red-400 text-xs">⚠ {failedCount} commande(s) en échec permanent — vérifiez les erreurs dans la file.</p>
          )}

          <p className="text-white/20 text-[10px] mt-3 text-center">
            {isOnline ? '🟢 Connexion rétablie' : '🔴 En attente de connexion…'}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Print fallback (offline) ──────────────────────────────────────────────
// Call when printing fails due to offline state
export function printHTMLFallback(htmlContent: string): void {
  const win = window.open('', '_blank', 'width=400,height=600');
  if (win) {
    win.document.write(htmlContent);
    win.document.close();
  } else {
    // If popup blocked, create blob URL
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.target   = '_blank';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}
