import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  CreditCard, 
  Zap, 
  ArrowRight, 
  Play, 
  Wallet, 
  Smartphone,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

/**
 * المكون الرئيسي لواجهة الزبون - Lux Gaming
 * يتميز بنظام دفع مدمج وعداد وقت لحظي
 */
const App = () => {
  // --- حالة الجلسة ---
  const [session, setSession] = useState({
    active: false,
    timeLeft: 0, // بالثواني
    stationId: "05",
    pricePerHour: 30
  });

  const [view, setView] = useState('home'); // home, payment, active
  const [loading, setLoading] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState(null);

  // --- منطق العداد التنازلي ---
  useEffect(() => {
    let timer;
    if (session.active && session.timeLeft > 0) {
      timer = setInterval(() => {
        setSession(prev => ({
          ...prev,
          timeLeft: prev.timeLeft - 1
        }));
      }, 1000);
    } else if (session.timeLeft === 0 && session.active) {
      setSession(prev => ({ ...prev, active: false }));
      setView('home');
    }
    return () => clearInterval(timer);
  }, [session.active, session.timeLeft]);

  // --- تنسيق الوقت ---
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // --- محاكاة عملية الدفع وتفعيل السيرفر ---
  const handlePayment = async (method) => {
    setLoading(true);
    setSelectedMethod(method);
    
    // محاكاة الاتصال بـ API السيرفر (server.js)
    setTimeout(() => {
      setSession({
        ...session,
        active: true,
        timeLeft: 3600 // إضافة ساعة واحدة (3600 ثانية)
      });
      setView('active');
      setLoading(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-slate-100 p-6 flex flex-col items-center justify-center font-sans" dir="rtl">
      {/* خلفية جمالية */}
      <div className="fixed inset-0 -z-10 overflow-hidden opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-500 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600 rounded-full blur-[120px]"></div>
      </div>

      <div className="w-full max-w-md bg-zinc-900/80 border border-zinc-800 rounded-[2.5rem] p-8 backdrop-blur-2xl shadow-2xl overflow-hidden relative">
        
        {/* رأس الصفحة */}
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-white">LUX <span className="text-cyan-400 font-light">GAMING</span></h1>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Station #{session.stationId}</p>
          </div>
          <div className="bg-zinc-800 p-3 rounded-2xl">
            <Zap className="text-cyan-400" size={20} />
          </div>
        </header>

        {/* عرض الشاشة الرئيسية (قبل الدفع) */}
        {view === 'home' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-10">
              <div className="w-20 h-20 bg-cyan-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-cyan-500/20">
                <Play className="text-cyan-400" size={32} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">مرحباً بك في لوكس 🎮</h2>
              <p className="text-zinc-500 text-sm leading-relaxed px-4">الشاشة مغلقة حالياً. اختر باقة الوقت التي تناسبك للبدء فوراً.</p>
            </div>
            
            <div className="grid grid-cols-1 gap-4 mb-6">
              <button 
                onClick={() => setView('payment')}
                className="group flex justify-between items-center bg-white text-black p-5 rounded-3xl font-black transition-all hover:scale-[1.02]"
              >
                <span>باقة الساعة الواحدة</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm">30 DH</span>
                  <ArrowRight size={18} />
                </div>
              </button>
              <button 
                onClick={() => setView('payment')}
                className="group flex justify-between items-center bg-zinc-800 border border-zinc-700 text-white p-5 rounded-3xl font-black transition-all hover:bg-zinc-700"
              >
                <span>باقة الساعتين</span>
                <div className="flex items-center gap-2 text-cyan-400">
                  <span className="text-sm">50 DH</span>
                  <ArrowRight size={18} />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* عرض خيارات الدفع */}
        {view === 'payment' && (
          <div className="animate-in zoom-in-95 duration-300">
            <button onClick={() => setView('home')} className="mb-6 text-zinc-500 text-sm font-bold">← العودة</button>
            <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
              <CreditCard className="text-cyan-400" /> اختر طريقة الدفع
            </h3>
            
            {loading ? (
              <div className="py-12 text-center space-y-4">
                <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-cyan-400 font-bold animate-pulse text-sm">جاري تأمين العملية وفتح الشاشة...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { name: 'Google Pay', icon: Smartphone, color: 'text-white' },
                  { name: 'PayPal', icon: Wallet, color: 'text-blue-400' },
                  { name: 'بطاقة بنكية', icon: CreditCard, color: 'text-cyan-400' },
                  { name: 'نقداً (عند الكاونتر)', icon: Clock, color: 'text-green-500' }
                ].map((method) => (
                  <button 
                    key={method.name}
                    onClick={() => handlePayment(method.name)}
                    className="w-full flex items-center justify-between bg-zinc-950/50 border border-zinc-800 p-5 rounded-2xl hover:border-cyan-500/50 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <method.icon className={method.color} size={20} />
                      <span className="font-bold text-sm">{method.name}</span>
                    </div>
                    <ArrowRight size={14} className="text-zinc-700 group-hover:text-cyan-400" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* عرض العداد التنازلي النشط */}
        {view === 'active' && (
          <div className="animate-in fade-in duration-700 text-center">
            <div className="mb-8">
              <CheckCircle className="text-green-500 mx-auto mb-4" size={48} />
              <h3 className="text-2xl font-black text-white">استمتع باللعب!</h3>
              <p className="text-zinc-500 text-sm">تم فتح إشارة الشاشة بنجاح</p>
            </div>

            <div className="relative w-56 h-56 mx-auto mb-10 flex items-center justify-center">
              <div className="z-10">
                <div className={`text-5xl font-mono font-black ${session.timeLeft < 300 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                  {formatTime(session.timeLeft)}
                </div>
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-[0.2em] mt-2">الوقت المتبقي</p>
              </div>
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle cx="112" cy="112" r="100" fill="none" stroke="#18181b" strokeWidth="8" />
                <circle 
                  cx="112" cy="112" r="100" 
                  fill="none" 
                  stroke={session.timeLeft < 300 ? '#ef4444' : '#22d3ee'} 
                  strokeWidth="8" 
                  strokeDasharray="628" 
                  strokeDashoffset={628 - (628 * session.timeLeft / 3600)} 
                  className="transition-all duration-1000"
                />
              </svg>
            </div>

            {session.timeLeft < 300 && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl mb-6 flex items-center gap-3 text-red-500 text-xs font-bold animate-bounce">
                <AlertTriangle size={16} /> رصيدك أوشك على الانتهاء!
              </div>
            )}

            <button 
              onClick={() => setView('payment')}
              className="w-full bg-zinc-800 border border-zinc-700 py-5 rounded-[2rem] font-black text-cyan-400 hover:bg-zinc-700 transition-all flex items-center justify-center gap-3"
            >
              <Clock size={20} /> تمديد الوقت +
            </button>
          </div>
        )}

        {/* تذييل الصفحة */}
        <footer className="mt-8 text-center">
          <p className="text-[9px] text-zinc-700 font-bold uppercase tracking-[0.4em]">Powered by Maestro x Lux AI</p>
        </footer>
      </div>
    </div>
  );
};

export default App;