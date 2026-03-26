import { useState } from 'react';
import { useOfflineQueue, type QueuedOrder } from '../../hooks/useOfflineQueue';
import clsx from 'clsx';

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  pending:  { label: 'En attente',   classes: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
  syncing:  { label: 'Synchro…',    classes: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  synced:   { label: 'Synchronisé', classes: 'bg-green-500/10 text-green-400 border-green-500/30' },
  failed:   { label: 'Échec',       classes: 'bg-red-500/10 text-red-400 border-red-500/30' },
};

function EntryRow({ entry, onRetry, onRemove }: { entry: QueuedOrder; onRetry: (id:string) => void; onRemove: (id:string) => void }) {
  const cfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.pending;
  const time = new Date(entry.enqueuedAt).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
  return (
    <div className="flex items-start gap-3 p-3 bg-[#1A1A1A] rounded-xl border border-white/[0.06]">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-white truncate">
            {(entry.payload as any).tableNumber ? `Table ${(entry.payload as any).tableNumber}` : 'À Emporter'} — {(entry.payload as any).items?.length||0} article(s)
          </p>
          <span className="text-[10px] text-white/30 flex-shrink-0">{time}</span>
        </div>
        {entry.failureReason && <p className="text-[10px] text-red-400/70 mt-0.5 truncate">{entry.failureReason}</p>}
        <div className="flex items-center gap-2 mt-1.5">
          <span className={clsx('inline-flex items-center text-[10px] px-2 py-0.5 rounded-full border', cfg.classes)}>{cfg.label}</span>
          {(entry.status==='failed'||entry.status==='pending') && <button onClick={() => onRetry(entry.id)} className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors">↺ Réessayer</button>}
          {(entry.status==='synced'||entry.status==='failed') && <button onClick={() => onRemove(entry.id)} className="text-[10px] text-white/20 hover:text-white/50 transition-colors ml-auto">✕</button>}
        </div>
      </div>
    </div>
  );
}

export default function OfflineQueueWidget() {
  const { queue, syncing, pendingCount, failedCount, syncedCount, flushQueue, retryEntry, removeEntry, clearSynced, isOnline } = useOfflineQueue();
  const [open, setOpen] = useState(false);
  const totalActive = pendingCount + failedCount;
  if (totalActive===0 && syncedCount===0 && isOnline) return null;
  return (
    <div className="relative">
      <button onClick={() => setOpen(o=>!o)}
        className={clsx('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
          !isOnline?'bg-yellow-500/10 border-yellow-500/30 text-yellow-400':
          failedCount>0?'bg-red-500/10 border-red-500/30 text-red-400':
          pendingCount>0?'bg-blue-500/10 border-blue-500/30 text-blue-400':
          'bg-green-500/10 border-green-500/30 text-green-400')}>
        {syncing&&<div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin"/>}
        {!isOnline?'📵 Hors ligne':failedCount>0?`⚠ ${failedCount} échec(s)`:pendingCount>0?`⬆ ${pendingCount} sync…`:`✓ ${syncedCount} synch.`}
      </button>
      {open&&(
        <div className="absolute top-full right-0 mt-2 w-80 bg-[#141414] border border-white/[0.08] rounded-2xl shadow-xl z-50 overflow-hidden">
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
            <h4 className="font-serif text-sm text-[#C9A84C]">File de sync</h4>
            <div className="flex gap-2">
              {pendingCount>0&&isOnline&&<button onClick={flushQueue} disabled={syncing} className="border border-[#C9A84C]/40 text-[#C9A84C] text-[11px] px-3 py-1.5 rounded-lg hover:bg-[#C9A84C]/10">{syncing?'…':'↺ Sync'}</button>}
              {syncedCount>0&&<button onClick={clearSynced} className="bg-white/5 border border-white/[0.06] text-white/70 text-[11px] px-3 py-1.5 rounded-lg">Effacer</button>}
              <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white/60 text-xs">✕</button>
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto p-3 space-y-2">
            {queue.length===0?<p className="text-center text-white/30 text-xs py-6">File vide ✓</p>:queue.map(entry=><EntryRow key={entry.id} entry={entry} onRetry={retryEntry} onRemove={removeEntry}/>)}
          </div>
          {!isOnline&&<div className="p-3 bg-yellow-500/5 border-t border-yellow-500/20"><p className="text-[10px] text-yellow-400/80 text-center">Synchronisation automatique à la reconnexion.</p></div>}
        </div>
      )}
    </div>
  );
}
