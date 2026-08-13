import React from 'react';
import {
  Home,
  Compass,
  Banknote,
  Mail,
  Menu as MenuIcon,
  SlidersHorizontal,
  Globe,
  Star,
  Shield,
} from 'lucide-react';
import { useDriver } from '../context/DriverContext';
import { TabType } from '../types';

export const DesktopSidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    isOnline,
    setIsOnline,
    language,
    setLanguage,
    profile,
    tipNotifications,
    setShowPreferencesModal,
  } = useDriver();

  const unreadTips = tipNotifications.filter((n) => !n.read).length;

  const navItems: { id: TabType; icon: React.FC<{ className?: string }>; labelBn: string; labelEn: string; badge?: number }[] = [
    { id: 'home', icon: Home, labelBn: 'হোম (মানচিত্র ও ট্রিপ)', labelEn: 'Home & Map' },
    { id: 'discover', icon: Compass, labelBn: 'ডিসকভার (বুস্ট ও অফার)', labelEn: 'Discover & Boosts' },
    { id: 'earnings', icon: Banknote, labelBn: 'আয় ও ওয়ালেট', labelEn: 'Earnings & Wallet' },
    { id: 'inbox', icon: Mail, labelBn: 'ইনবক্স ও টিপস', labelEn: 'Inbox & Tips', badge: unreadTips },
    { id: 'menu', icon: MenuIcon, labelBn: 'মেনু ও একাউন্ট', labelEn: 'Menu & Account' },
  ];

  return (
    <aside id="desktop-sidebar" className="hidden md:flex flex-col w-72 bg-zinc-900/95 border-r border-zinc-800/80 p-5 h-screen sticky top-0 justify-between shrink-0 select-none backdrop-blur-xl">
      {/* Top Brand & Status Section */}
      <div className="space-y-6">
        {/* Logo & Title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-pink-600 text-white font-black text-xl shadow-lg shadow-pink-950">
              ✿
            </div>
            <div>
              <h1 className="font-extrabold text-lg text-white tracking-tight flex items-center gap-1">
                Golapi <span className="text-pink-500 font-black">Driver</span>
              </h1>
              <p className="text-[11px] text-zinc-400 font-medium">Operations Edition</p>
            </div>
          </div>

          {/* Language Switcher */}
          <button
            onClick={() => setLanguage(language === 'bn' ? 'en' : 'bn')}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Language / ভাষা"
          >
            <Globe className="w-3.5 h-3.5 text-pink-500" />
            <span className="font-semibold">{language === 'bn' ? 'বাংলা' : 'EN'}</span>
          </button>
        </div>

        {/* Quick Driver Profile Card */}
        <div className="bg-gradient-to-r from-zinc-950 via-zinc-950 to-pink-950/40 border border-zinc-800/90 rounded-2xl p-3.5 flex items-center gap-3 shadow-inner">
          <img
            src={profile.avatar}
            alt={profile.name}
            className="w-12 h-12 rounded-xl object-cover border-2 border-pink-500 shrink-0"
          />
          <div className="space-y-0.5 overflow-hidden">
            <h3 className="font-bold text-sm text-white truncate">
              {language === 'bn' ? profile.name : profile.nameEn}
            </h3>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-md bg-pink-950 border border-pink-600/40 text-pink-300 font-bold text-[10px]">
                {language === 'bn' ? profile.tier : profile.tierEn}
              </span>
              <span className="text-zinc-400 font-semibold flex items-center gap-0.5">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span>{profile.rating}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Online Toggle Button */}
        <button
          id="desktop-btn-go-online"
          onClick={() => setIsOnline(!isOnline)}
          className={`w-full py-3 px-4 rounded-2xl font-extrabold text-sm shadow-xl transition-all active:scale-98 flex items-center justify-center gap-2.5 ${
            isOnline
              ? 'bg-emerald-950 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/80'
              : 'bg-pink-600 hover:bg-pink-500 text-white shadow-pink-950 animate-pulse'
          }`}
        >
          <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-ping' : 'bg-white'}`} />
          <span>
            {isOnline
              ? (language === 'bn' ? 'অনলাইনে আছেন (সক্রিয়)' : 'Online (Active)')
              : (language === 'bn' ? 'অনলাইনে যান' : 'Go Online')}
          </span>
        </button>

        {/* Navigation Items */}
        <nav className="space-y-1.5 pt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const label = language === 'bn' ? item.labelBn : item.labelEn;

            return (
              <button
                key={item.id}
                id={`desktop-nav-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between p-3 rounded-2xl font-bold text-xs transition-all ${
                  isActive
                    ? 'bg-pink-600 text-white shadow-lg shadow-pink-950'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-950 border border-transparent hover:border-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </div>
                {item.badge && item.badge > 0 ? (
                  <span className="bg-pink-950 border border-pink-500 text-pink-300 text-[10px] font-black px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}

          <button
            id="desktop-nav-preferences"
            onClick={() => setShowPreferencesModal(true)}
            className="w-full flex items-center justify-between p-3 rounded-2xl font-bold text-xs text-pink-400 hover:bg-pink-950/40 border border-pink-600/30 transition-all mt-2"
          >
            <div className="flex items-center gap-3">
              <SlidersHorizontal className="w-4 h-4" />
              <span>{language === 'bn' ? 'ডেলিভারি পছন্দসমূহ' : 'Trip Preferences'}</span>
            </div>
          </button>
        </nav>
      </div>

      {/* Support action */}
      <div className="space-y-3 pt-4 border-t border-zinc-800/80">
        <div className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
          <span className="flex items-center gap-1.5 font-medium">
            <Shield className="w-3.5 h-3.5 text-pink-500" />
            <span>24/7 Driver Hotline</span>
          </span>
          <span className="text-white font-bold">16222</span>
        </div>
      </div>
    </aside>
  );
};
