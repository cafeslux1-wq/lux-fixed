import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { API, type MenuProduct } from '../../services/api';
import { useAppStore } from '../../hooks/useStore';
import { useSocket } from '../../hooks/useSocket';
import { useOfflineQueue } from '../../hooks/useOfflineQueue';
import { NetworkStatusBadge } from '../shared/NetworkStatusBadge';

const BRANCH_ID   = import.meta.env.VITE_BRANCH_ID   || 'b0000000-0000-0000-0000-000000000001';
const TENANT_SLUG = import.meta.env.VITE_TENANT_SLUG || 'lux';
const TAX_RATE    = 0.10;

function TableGrid() {
  const { tables, selectedTable, selectTable, addTakeaway } = useAppStore();
  const tableNums = Object.keys(tables).filter(k => !k.startsWith('E'));
  const takeaways = Object.keys(tables).filter(k => k.startsWith('E'));
  return (
    <div className="flex-1 overflow-y-auto p-3">
      <p className="text-[10px] text-white/40 uppercase tracking-widest mb-2 px-1">Tables</p>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {tableNums.map(num => {
          const t = tables[num]; const isSel = selectedTable === num; const hasItems = (t?.cartItems||[]).length > 0;
          return <button key={num} onClick={() => selectTable(num)} className={clsx('aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200 text-sm active:scale-95', isSel&&'bg-[#C9A84C] text-black border-2 border-[#C9A84C] shadow-[0_0_24px_rgba(201,168,76,0.3)]', !isSel&&hasItems&&'bg-[#C9A84C]/10 border-2 border-[#C9A84C]/40 text-[#C9A84C]', !isSel&&!hasItems&&'bg-[#141414] border border-white/[0.06] text-white/70 hover:border-[#C9A84C]/30 hover:text-white')}>
            <span className="font-serif text-lg font-bold leading-none">{num}</span>
            <span className={clsx('text-[9px] leading-none', isSel?'text-black/60':'opacity-60')}>{isSel?'●':hasItems?`${(t?.cartItems||[]).length} art.`:'Libre'}</span>
          </button>;
        })}
      </div>
      <p className="text-[10px] text-white/40 uppercase tracking-widest mb-2 px-1">À Emporter</p>
      <button onClick={() => addTakeaway()} className="w-full py-2.5 rounded-lg border border-[#C9A84C]/40 text-[#C9A84C] hover:bg-[#C9A84C]/10 text-xs font-semibold mb-2 transition-all">+ Nouveau ticket</button>
      {takeaways.map(id => {
        const t = tables[id]; const isSel = selectedTable === id;
        return <button key={id} onClick={() => selectTable(id)} className={clsx('w-full py-2 px-3 rounded-lg text-xs text-left transition-all mb-1.5', isSel?'bg-[#C9A84C] text-black':'bg-[#141414] border border-white/[0.06] text-white/60 hover:border-[#C9A84C]/30')}>📦 {id} — {(t?.cartItems||[]).length} article(s)</button>;
      })}
    </div>
  );
}

function MenuPanel({ onProductSelect }: { onProductSelect: (p: MenuProduct) => void }) {
  const [activeCat, setActiveCat] = useState<string|null>(null);
  const [search, setSearch] = useState('');
  const { data: menuData } = useQuery({ queryKey:['menu',TENANT_SLUG,BRANCH_ID], queryFn: () => API.menu.public(TENANT_SLUG, BRANCH_ID), staleTime: 60_000, refetchInterval: 120_000 });
  const categories = menuData?.data?.categories || [];
  if (!activeCat && categories.length) setTimeout(() => setActiveCat(categories[0]?.id), 0);
  const activeProducts = search.trim()
    ? categories.flatMap(c => c.products).filter(p => p.name.toLowerCase().includes(search.toLowerCase()) && p.isAvailable)
    : categories.find(c => c.id === activeCat)?.products.filter(p => p.isAvailable) || [];
  return (
    <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
      <div className="flex gap-2 px-3 pt-3 pb-0 overflow-x-auto flex-shrink-0">
        {categories.map(cat => <button key={cat.id} onClick={() => { setActiveCat(cat.id); setSearch(''); }} className={clsx('flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all', activeCat===cat.id?'bg-[#C9A84C] text-black':'bg-[#141414] text-white/60 border border-white/[0.06] hover:border-[#C9A84C]/40')}>{cat.icon && <span className="mr-1.5">{cat.icon}</span>}{cat.name}</button>)}
      </div>
      <div className="px-3 pt-3 flex-shrink-0"><input type="text" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-[#141414] border border-white/[0.06] focus:border-[#C9A84C]/40 rounded-lg px-3 py-2.5 text-sm text-white/90 outline-none transition-colors" /></div>
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 content-start">
        {activeProducts.map(product => (
          <button key={product.id} onClick={() => onProductSelect(product)} disabled={!product.isAvailable||!product.stockAvailable}
            className={clsx('group relative rounded-xl overflow-hidden border text-left transition-all duration-200 active:scale-[0.97]', product.isAvailable&&product.stockAvailable?'bg-[#141414] border-white/[0.06] hover:border-[#C9A84C]/40 hover:-translate-y-0.5':'bg-[#141414] border-white/[0.04] opacity-50 cursor-not-allowed')}>
            {product.imageUrl?<img src={product.imageUrl} alt={product.name} className="w-full h-20 object-cover"/>:<div className="w-full h-20 bg-[#1A1A1A] flex items-center justify-center text-3xl">🍽</div>}
            {product.isSignature&&<div className="absolute top-2 left-2"><span className="bg-[#C9A84C]/15 text-[#C9A84C] border border-[#C9A84C]/30 text-[9px] font-bold px-2 py-0.5 rounded-full">⭐</span></div>}
            {!product.stockAvailable&&<div className="absolute inset-0 bg-black/60 flex items-center justify-center"><span className="text-[10px] bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full">Épuisé</span></div>}
            <div className="p-2.5"><p className="text-xs font-semibold text-white leading-tight line-clamp-2">{product.name}</p><p className="font-serif text-sm text-[#C9A84C] mt-1">{product.price} DH</p></div>
          </button>
        ))}
        {activeProducts.length===0&&<div className="col-span-full flex flex-col items-center justify-center py-16 text-white/30"><span className="text-4xl mb-3">🔍</span><p className="text-sm">Aucun article trouvé</p></div>}
      </div>
    </div>
  );
}

function TicketPanel() {
  const { selectedTable, getCart, removeFromCart, clearCart, cartSubtotal, staff } = useAppStore();
  const { enqueue, isOnline } = useOfflineQueue();
  const [payMethod, setPayMethod] = useState<'cash'|'card'|'wallet'|'mixed'>('cash');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{msg:string;type:'ok'|'err'}|null>(null);
  const cart = getCart(); const subtotal = cartSubtotal(); const tax = subtotal * TAX_RATE; const total = subtotal + tax;
  const showToast = (msg: string, type: 'ok'|'err' = 'ok') => { setToast({msg,type}); setTimeout(() => setToast(null), 2800); };

  async function handlePay() {
    if (!cart.length || !selectedTable) return;
    setLoading(true);
    const ikey = `pos-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const payload = { branchId: BRANCH_ID, tableNumber: selectedTable.startsWith('E')?undefined:selectedTable, orderType: selectedTable.startsWith('E')?'takeaway':'dine_in', sessionType:'pos', items: cart, paymentMethod: payMethod };
    try {
      if (!isOnline) { await enqueue(payload as any, ikey, 'Appareil hors ligne'); clearCart(); showToast('📵 Commande sauvegardée hors ligne'); return; }
      await API.orders.create(payload as any);
      clearCart(); showToast(`✅ Encaissé — ${total.toFixed(2)} DH`);
    } catch (e: any) {
      if (e.errorCode === 'OUT_OF_STOCK') { showToast('⚠ Stock insuffisant', 'err'); }
      else if (e.errorCode === 'WALLET_INSUFFICIENT') { showToast('⚠ Solde wallet insuffisant', 'err'); }
      else { await enqueue(payload as any, ikey, e.message); clearCart(); showToast('📵 Sauvegardé (erreur réseau)'); }
    } finally { setLoading(false); }
  }

  return (
    <div className="w-60 flex-shrink-0 bg-[#141414] border-l border-white/[0.06] flex flex-col relative">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
        <h3 className="font-serif text-[#C9A84C] text-sm">{selectedTable?selectedTable.startsWith('E')?`📦 ${selectedTable}`:`🪑 Table ${selectedTable}`:'— Sélectionnez —'}</h3>
        {cart.length>0&&<button onClick={clearCart} className="text-white/30 hover:text-red-400 text-xs transition-colors">Vider</button>}
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {cart.length===0?<div className="flex flex-col items-center justify-center h-full text-white/20 text-xs text-center gap-2"><span className="text-3xl">🛒</span>Aucun article</div>:cart.map((item,i) => (
          <div key={i} className="flex items-center gap-2 bg-[#1A1A1A] rounded-lg px-2.5 py-2">
            <div className="w-6 h-6 bg-[#C9A84C]/15 border border-[#C9A84C]/30 rounded flex items-center justify-center text-[11px] font-bold text-[#C9A84C] flex-shrink-0">{item.quantity}</div>
            <div className="flex-1 min-w-0"><p className="text-[11px] font-medium text-white truncate">{item.productName}</p>{item.modifiers&&Object.values(item.modifiers).length>0&&<p className="text-[9px] text-white/30 truncate">{Object.values(item.modifiers).join(' · ')}</p>}</div>
            <div className="text-right flex-shrink-0"><p className="text-[11px] text-[#C9A84C]">{(item.unitPrice*item.quantity).toFixed(2)} DH</p><button onClick={() => removeFromCart(item.productName)} className="text-[9px] text-white/20 hover:text-red-400 transition-colors">−1</button></div>
          </div>
        ))}
      </div>
      {cart.length>0&&(
        <div className="flex-shrink-0 border-t border-white/[0.06]">
          <div className="px-3 py-2 space-y-1 text-xs">
            <div className="flex justify-between text-white/50"><span>Sous-total HT</span><span>{subtotal.toFixed(2)} DH</span></div>
            <div className="flex justify-between text-white/50"><span>TVA 10%</span><span>{tax.toFixed(2)} DH</span></div>
            <div className="flex justify-between font-bold text-white pt-1 border-t border-white/[0.06]"><span>Total TTC</span><span className="font-serif text-base text-[#C9A84C]">{total.toFixed(2)} DH</span></div>
          </div>
          <div className="px-3 pb-2 grid grid-cols-2 gap-1.5">
            {(['cash','card','wallet','mixed'] as const).map(m => <button key={m} onClick={() => setPayMethod(m)} className={clsx('py-2 rounded-lg text-[11px] font-semibold border transition-all', payMethod===m?'bg-[#C9A84C]/20 text-[#C9A84C] border-[#C9A84C]/50':'bg-[#141414] text-white/50 border-white/[0.06] hover:border-[#C9A84C]/30')}>{({cash:'💵 Espèces',card:'💳 Carte',wallet:'📱 Wallet',mixed:'↔ Mixte'})[m]}</button>)}
          </div>
          <div className="px-3 pb-3"><button onClick={handlePay} disabled={loading||!cart.length||!selectedTable} className="bg-[#C9A84C] hover:bg-[#E8C97A] text-black font-bold w-full py-3.5 rounded-xl text-sm disabled:opacity-40 transition-all">
            {loading?<span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"/>Traitement…</span>:`✓ Encaisser ${total.toFixed(2)} DH`}
          </button></div>
        </div>
      )}
      {toast&&<div className={clsx('absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-xl z-50 whitespace-nowrap',toast.type==='ok'?'bg-[#141414] border border-[#C9A84C]/30 text-[#C9A84C]':'bg-[#141414] border border-red-500/30 text-red-400')}>{toast.msg}</div>}
    </div>
  );
}

export default function POSDashboard({ onLogout }: { onLogout: () => void }) {
  const { staff, stockAlerts, clearAlerts } = useAppStore();
  const [modifierTarget, setModifierTarget] = useState<MenuProduct|null>(null);
  const { addToCart } = useAppStore();
  useSocket();

  function handleProductSelect(product: MenuProduct) {
    if ((product.modifiers||[]).length > 0) { setModifierTarget(product); } else { addToCart(product); }
  }

  return (
    <div className="flex flex-col h-full bg-[#0D0D0D]">
      <header className="flex-shrink-0 h-14 bg-[#141414] border-b border-white/[0.06] flex items-center px-4 gap-3 z-10">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C9A84C] to-[#8B6E2F] flex items-center justify-center font-serif text-lg font-bold text-black">L</div>
        <div><p className="font-serif text-[#C9A84C] text-sm leading-none">Café LUX</p><p className="text-[10px] text-white/30">Smart POS v4.3</p></div>
        <div className="flex-1" />
        <NetworkStatusBadge />
        {stockAlerts.length>0&&<button onClick={clearAlerts} className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 px-3 py-1.5 rounded-lg text-red-400 text-xs hover:bg-red-500/20 transition-colors">⚠ {stockAlerts.length} alerte{stockAlerts.length>1?'s':''}</button>}
        {staff&&<div className="flex items-center gap-2.5 bg-[#1A1A1A] border border-white/[0.06] rounded-lg px-3 py-1.5"><div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#C9A84C] to-[#8B6E2F] flex items-center justify-center text-[11px] font-bold text-black">{staff.fullName?.split(' ').map((x:string) => x[0]).join('').slice(0,2)}</div><div className="hidden sm:block"><p className="text-xs font-semibold text-white leading-none">{staff.fullName?.split(' ')[0]}</p><p className="text-[9px] text-white/40 capitalize">{staff.role}</p></div></div>}
        <button onClick={onLogout} className="text-white/30 hover:text-white/70 text-xs transition-colors px-2">Déconnexion</button>
      </header>
      <div className="flex-1 flex overflow-hidden">
        <div className="w-52 flex-shrink-0 bg-[#141414] border-r border-white/[0.06] flex flex-col"><TableGrid /></div>
        <MenuPanel onProductSelect={handleProductSelect} />
        <TicketPanel />
      </div>
      {modifierTarget&&(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#141414] border border-white/[0.08] rounded-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-white/[0.06] flex items-start justify-between">
              <div><h3 className="font-serif text-lg text-white">{modifierTarget.name}</h3><p className="text-[#C9A84C] text-sm mt-0.5">{modifierTarget.price} DH</p></div>
              <button onClick={() => setModifierTarget(null)} className="text-white/40 hover:text-white/70 p-1">✕</button>
            </div>
            <div className="p-5">
              {modifierTarget.modifiers?.map(group => (
                <div key={group.id} className="mb-4">
                  <p className="text-sm font-semibold text-white mb-2">{group.name}</p>
                  <div className="flex flex-wrap gap-2">{group.options.map(opt => <button key={opt.label} onClick={() => { addToCart(modifierTarget, {[group.id]: opt.label}); setModifierTarget(null); }} className="px-3 py-2 rounded-lg text-sm bg-[#1A1A1A] text-white/70 border border-white/[0.06] hover:border-[#C9A84C]/40 transition-all">{opt.label}{opt.priceAdjust>0&&<span className="text-[10px] opacity-60 ml-1">+{opt.priceAdjust}</span>}</button>)}</div>
                </div>
              ))}
              <div className="flex gap-3 mt-4">
                <button onClick={() => setModifierTarget(null)} className="flex-1 py-3 border border-white/[0.06] rounded-xl text-white/50 text-sm">Annuler</button>
                <button onClick={() => { addToCart(modifierTarget); setModifierTarget(null); }} className="flex-1 py-3 bg-[#C9A84C] text-black font-bold rounded-xl text-sm">Ajouter sans option</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
