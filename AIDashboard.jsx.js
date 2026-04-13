import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Tv, 
  TrendingUp, 
  Activity, 
  Camera, 
  DollarSign, 
  Zap, 
  ShieldCheck, 
  Power,
  Settings,
  Bell,
  Search,
  Plus
} from 'lucide-react';

/**
 * لوحة تحكم المدير - Lux Management Dashboard
 * تتيح مراقبة النادي في الوقت الفعلي والتحكم في المحطات برمجياً
 */
const App = () => {
  const [activeTab, setActiveTab] = useState('overview');
  
  // بيانات تجريبية للمحطات
  const stations = [
    { id: 1, name: 'PS5 Pro - VIP', status: 'Active', user: 'أحمد العلمي', time: '01:45:20', revenue: 60, power: '185W' },
    { id: 2, name: 'PS5 Slim - 02', status: 'Inactive', user: '-', time: '00:00:00', revenue: 0, power: '12W' },
    { id: 3, name: 'PS5 Pro - 03', status: 'Warning', user: 'ياسين بناني', time: '00:04:12', revenue: 30, power: '178W' },
    { id: 4, name: 'PS5 Slim - 04', status: 'Active', user: 'إدريس مهدي', time: '02:11:05', revenue: 90, power: '182W' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex font-sans" dir="rtl">
      
      {/* القائمة الجانبية */}
      <aside className="w-72 bg-slate-900/50 border-l border-slate-800 flex flex-col p-8 sticky top-0 h-screen">
        <div className="mb-12">
          <h2 className="text-3xl font-black text-cyan-400 tracking-tighter italic">LUX <span className="text-white font-normal">PRO</span></h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">نظام الإدارة المؤتمت</p>
        </div>

        <nav className="flex-1 space-y-4">
          {[
            { id: 'overview', label: 'الرئيسية', icon: LayoutDashboard },
            { id: 'stations', label: 'المحطات', icon: Tv },
            { id: 'vision', label: 'المراقبة AI', icon: Camera },
            { id: 'finance', label: 'المالية', icon: TrendingUp },
            { id: 'settings', label: 'الإعدادات', icon: Settings },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold transition-all ${
                activeTab === item.id ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' : 'text-slate-500 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="pt-8 border-t border-slate-800">
          <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">سيرفر Railway: متصل</span>
            </div>
            <p className="text-[10px] text-slate-600 font-bold tracking-widest uppercase">Version 2.8.5 AI</p>
          </div>
        </div>
      </aside>

      {/* المحتوى الرئيسي */}
      <main className="flex-1 p-12 overflow-y-auto">
        
        {/* رأس الصفحة */}
        <header className="flex justify-between items-start mb-16">
          <div>
            <h1 className="text-5xl font-black text-white mb-3 tracking-tighter">إحصائيات <span className="text-cyan-400">نادي لوكس</span></h1>
            <p className="text-slate-500 text-lg">تحليل شامل لعمليات المقهى والجيمنج الموحدة.</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 relative cursor-pointer">
              <Bell size={24} className="text-slate-400" />
              <span className="absolute top-3 left-3 w-2 h-2 bg-cyan-500 rounded-full border-2 border-slate-900"></span>
            </div>
            <button className="bg-cyan-500 text-black px-8 py-4 rounded-2xl font-black flex items-center gap-3 hover:bg-cyan-400 transition-all">
              <Plus size={20} /> شحن يدوي (كاش)
            </button>
          </div>
        </header>

        {/* بطاقات KPI السريعة */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {[
            { label: 'إيرادات اليوم', val: '1,420 DH', sub: '+12% عن الأمس', icon: DollarSign, color: 'text-green-500' },
            { label: 'نسبة الإشغال', val: '75%', sub: '3/4 محطات نشطة', icon: Activity, color: 'text-cyan-400' },
            { label: 'كفاءة AI', val: '99.9%', sub: 'أتمتة كاملة', icon: ShieldCheck, color: 'text-purple-400' },
            { label: 'استهلاك الطاقة', val: '540W', sub: 'توفير 5% اليوم', icon: Zap, color: 'text-amber-400' },
          ].map((stat, i) => (
            <div key={i} className="bg-slate-900/50 border border-slate-800 p-8 rounded-[2.5rem] hover:border-slate-700 transition-all group">
              <div className={`p-4 rounded-2xl w-fit mb-6 bg-slate-800 group-hover:scale-110 transition-transform ${stat.color}`}>
                <stat.icon size={24} />
              </div>
              <p className="text-slate-500 text-xs font-bold uppercase mb-2">{stat.label}</p>
              <h3 className="text-2xl font-black text-white">{stat.val}</h3>
              <p className="text-[10px] text-slate-600 mt-2 font-bold">{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* عرض المحطات */}
        <div className="mb-10 flex justify-between items-end">
          <h3 className="text-2xl font-black flex items-center gap-4">
            <Tv className="text-cyan-400" /> إدارة المحطات المباشرة
          </h3>
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
            <input 
              type="text" 
              placeholder="البحث عن محطة أو زبون..." 
              className="bg-slate-900 border border-slate-800 rounded-xl py-3 pr-12 pl-6 text-xs focus:outline-none focus:border-cyan-500 transition-all w-72" 
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {stations.map(station => (
            <div key={station.id} className={`bg-slate-900 border ${station.status === 'Warning' ? 'border-amber-500/30' : 'border-slate-800'} rounded-[3rem] p-8 flex flex-col transition-all hover:bg-slate-900/80`}>
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-6">
                  <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-2xl font-black ${
                    station.status === 'Active' ? 'bg-cyan-500/10 text-cyan-400' : 
                    station.status === 'Warning' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-600'
                  }`}>
                    {station.id}
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white">{station.name}</h4>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{station.power} • IP: 192.168.1.{10+station.id}</p>
                  </div>
                </div>
                <div className={`px-4 py-2 rounded-full text-[10px] font-black uppercase ${
                  station.status === 'Active' ? 'bg-green-500/10 text-green-500' : 
                  station.status === 'Warning' ? 'bg-amber-500/10 text-amber-500 animate-pulse' : 'bg-red-500/10 text-red-500'
                }`}>
                  {station.status === 'Inactive' ? 'الإشارة مقطوعة' : 'متصل ونشط'}
                </div>
              </div>

              <div className="flex justify-between items-end mb-8 bg-slate-950/50 p-6 rounded-3xl border border-slate-900/50">
                <div>
                  <p className="text-slate-600 text-[10px] font-black uppercase mb-1">الزبون الحالي</p>
                  <p className="font-bold text-slate-200">{station.user}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-600 text-[10px] font-black uppercase mb-1">الوقت المتبقي</p>
                  <p className={`text-3xl font-mono font-black ${station.status === 'Warning' ? 'text-amber-500' : 'text-white'}`}>{station.time}</p>
                </div>
              </div>

              <div className="flex gap-4">
                <button className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2">
                  <Plus size={18} /> تمديد
                </button>
                <button className={`flex-1 font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 ${
                  station.status === 'Inactive' ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' : 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white'
                }`}>
                  <Power size={18} /> {station.status === 'Inactive' ? 'إعادة الإشارة' : 'قطع الإشارة'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* توصية AI الذكية */}
        <div className="bg-gradient-to-r from-cyan-600/20 to-purple-600/20 border border-cyan-500/20 p-10 rounded-[3.5rem] flex flex-col lg:flex-row items-center justify-between gap-10">
          <div className="flex items-center gap-8">
            <div className="w-20 h-20 bg-cyan-500 rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-cyan-500/40">
              <Zap className="text-black" size={32} />
            </div>
            <div>
              <h4 className="text-2xl font-black text-white mb-2">رؤية المساعد الذكي (Lux AI)</h4>
              <p className="text-slate-400 text-lg leading-relaxed max-w-xl">اكتشف النظام أن ذروة الزبائن تبدأ بعد 45 دقيقة. نقترح تفعيل عرض "باقة الساعة الثالثة" بنصف السعر لزيادة الإيرادات بنسبة 18%.</p>
            </div>
          </div>
          <button className="bg-white text-black px-10 py-5 rounded-[2rem] font-black text-lg hover:scale-105 transition-all shadow-xl">تطبيق الاقتراح الآن</button>
        </div>

      </main>
    </div>
  );
};

export default App;