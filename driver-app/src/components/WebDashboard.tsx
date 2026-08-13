import React from 'react';
import { Banknote, Bell, MapPinned, Smartphone, Truck } from 'lucide-react';
import { useDriver } from '../context/DriverContext';
import { Heatmap } from './Heatmap';

export const WebDashboard: React.FC = () => {
  const { profile, isOnline, setIsOnline, language, setLanguage, hotspots, tipNotifications, activeOrder, setViewMode } = useDriver();
  return <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8 space-y-6">
    <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
      <div>
        <h1 className="text-2xl font-black text-white">Golapi Driver <span className="text-pink-500">Operations</span></h1>
        <p className="text-xs text-zinc-400 mt-1">{language === 'bn' ? 'লাইভ Firestore অর্ডার, লোকেশন ও আয়' : 'Live Firestore orders, location and earnings'}</p>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setLanguage(language === 'bn' ? 'en' : 'bn')} className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold">{language === 'bn' ? 'English' : 'বাংলা'}</button>
        <button onClick={() => setViewMode('mobile')} className="px-4 py-2 rounded-xl bg-pink-600 text-white font-bold text-xs flex items-center gap-2"><Smartphone className="w-4 h-4" />{language === 'bn' ? 'মোবাইল ভিউ' : 'Mobile view'}</button>
      </div>
    </header>

    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <article className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5"><Truck className="w-5 h-5 text-pink-400" /><p className="mt-3 text-xs text-zinc-400">{language === 'bn' ? 'ড্রাইভার স্ট্যাটাস' : 'Driver status'}</p><button onClick={() => setIsOnline(!isOnline)} className={`mt-1 font-black ${isOnline ? 'text-emerald-400' : 'text-zinc-300'}`}>{isOnline ? (language === 'bn' ? 'অনলাইন' : 'Online') : (language === 'bn' ? 'অফলাইন' : 'Offline')}</button></article>
      <article className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5"><Banknote className="w-5 h-5 text-emerald-400" /><p className="mt-3 text-xs text-zinc-400">{language === 'bn' ? 'আজকের আয়' : 'Today earnings'}</p><p className="text-2xl font-black text-white">৳{profile.todayEarnings.toFixed(2)}</p></article>
      <article className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5"><MapPinned className="w-5 h-5 text-pink-400" /><p className="mt-3 text-xs text-zinc-400">{language === 'bn' ? 'লাইভ সার্ভিস জোন' : 'Live service zones'}</p><p className="text-2xl font-black text-white">{hotspots.length}</p></article>
      <article className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5"><Bell className="w-5 h-5 text-amber-400" /><p className="mt-3 text-xs text-zinc-400">{language === 'bn' ? 'টিপ নোটিফিকেশন' : 'Tip notifications'}</p><p className="text-2xl font-black text-white">{tipNotifications.length}</p></article>
    </section>

    <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <article className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4"><div><h2 className="font-black text-white">{language === 'bn' ? 'লাইভ অপারেশন ম্যাপ' : 'Live operations map'}</h2><p className="text-xs text-zinc-400">{language === 'bn' ? 'Firestore branch, driver এবং assigned order coordinates' : 'Firestore branch, driver and assigned-order coordinates'}</p></div><Heatmap heightClass="h-[480px]" /></article>
      <article className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5"><h2 className="font-black text-white">{language === 'bn' ? 'সক্রিয় অর্ডার' : 'Active order'}</h2>{activeOrder ? <div className="mt-4 space-y-2"><p className="text-pink-400 font-black">{activeOrder.customerCode}</p><p className="text-sm text-white">{activeOrder.customerName}</p><p className="text-xs text-zinc-400">{activeOrder.customerAddress}</p><p className="text-xs text-emerald-400 font-bold">{activeOrder.status}</p></div> : <p className="mt-4 text-sm text-zinc-400">{language === 'bn' ? 'এই মুহূর্তে কোনো অর্ডার assigned নেই।' : 'No order is assigned right now.'}</p>}</article>
    </section>
  </div>;
};
