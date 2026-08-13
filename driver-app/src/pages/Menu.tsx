import React from 'react';
import {
  Compass,
  Wallet,
  User,
  HelpCircle,
  SlidersHorizontal,
  ChevronRight,
  Star,
  LogOut,
  Award,
} from 'lucide-react';
import { useDriver } from '../context/DriverContext';

export const Menu: React.FC = () => {
  const { profile, language, setActiveTab, setShowPreferencesModal, setShowProfileModal, logout } = useDriver();

  const menuItems = [
    {
      id: 'account',
      icon: User,
      titleBn: 'একাউন্ট এডিট',
      titleEn: 'Edit Profile & Vehicle',
      highlight: true,
      action: () => setShowProfileModal(true),
    },
    {
      id: 'discover',
      icon: Compass,
      titleBn: 'ডিসকভার',
      titleEn: 'Discover',
      action: () => setActiveTab('discover'),
    },
    {
      id: 'wallet',
      icon: Wallet,
      titleBn: 'ওয়ালেট',
      titleEn: 'Wallet',
      action: () => setActiveTab('earnings'),
    },
    {
      id: 'preferences',
      icon: SlidersHorizontal,
      titleBn: 'পছন্দসমূহ (ডেলিভারি সেটিংস)',
      titleEn: 'Preferences (Delivery Settings)',
      highlight: true,
      action: () => setShowPreferencesModal(true),
    },
    {
      id: 'help',
      icon: HelpCircle,
      titleBn: 'সহায়তা হটলাইন',
      titleEn: 'Help & Support Hotline',
      action: () => { window.location.href = 'tel:16222'; },
    },
    {
      id: 'logout',
      icon: LogOut,
      titleBn: 'লগআউট',
      titleEn: 'Sign out',
      action: () => void logout(),
    },
  ];

  return (
    <div className="space-y-6 pb-24 md:pb-8 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="border-b border-zinc-800/80 pb-3">
        <h2 className="text-2xl font-black text-white">{language === 'bn' ? 'একাউন্ট ও মেনু' : 'Account & Menu Console'}</h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          {language === 'bn' ? 'ড্রাইভার প্রোফাইল, পয়েন্ট, সেটিংস এবং ডেলিভারি কাস্টমাইজেশন' : 'Manage your driver credentials, rewards and trip settings'}
        </p>
      </div>

      {/* Profile Header Card */}
      <div 
        onClick={() => setShowProfileModal(true)}
        className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-pink-950/40 border border-zinc-800 rounded-3xl p-6 flex items-center justify-between shadow-xl cursor-pointer hover:border-pink-500/50 transition-all"
      >
        <div className="flex items-center gap-4">
          <div className="relative">
            <img
              src={profile.avatar}
              alt={profile.name}
              className="w-20 h-20 rounded-2xl object-cover border-2 border-pink-500 shadow-lg"
            />
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-pink-600 border-2 border-zinc-900 flex items-center justify-center text-white text-xs">
              ★
            </div>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl font-black text-white">
              {language === 'bn' ? profile.name : profile.nameEn}
            </h2>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-pink-600 text-white font-bold text-xs shadow-md shadow-pink-950 flex items-center gap-1">
                <Award className="w-4 h-4" />
                <span>{language === 'bn' ? profile.tier : profile.tierEn}</span>
              </span>
              <span className="text-xs text-zinc-300 font-bold flex items-center gap-1 bg-zinc-950 px-3 py-1 rounded-full border border-zinc-800">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>{profile.rating} Rating</span>
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={(event) => { event.stopPropagation(); setShowPreferencesModal(true); }}
          className="hidden md:flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-lg shadow-pink-950 transition-all active:scale-95"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>{language === 'bn' ? 'ডেলিভারি ফিল্টার পরিবর্তন' : 'Edit Delivery Filter'}</span>
        </button>
      </div>

      {/* Menu Grid Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={item.action}
              className={`p-4 flex items-center justify-between text-left hover:bg-zinc-800/80 rounded-2xl transition-all border shadow-sm ${
                item.highlight
                  ? 'bg-pink-950/40 border-pink-600/50 text-pink-300'
                  : 'bg-zinc-900 border-zinc-800/80 text-zinc-200'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    item.highlight
                      ? 'bg-pink-600 text-white shadow-md'
                      : 'bg-zinc-950 text-pink-400 border border-zinc-800'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className={`font-bold text-sm ${item.highlight ? 'text-pink-300' : 'text-zinc-200'}`}>
                    {language === 'bn' ? item.titleBn : item.titleEn}
                  </p>
                </div>
              </div>

              <ChevronRight className="w-5 h-5 text-zinc-500" />
            </button>
          );
        })}
      </div>
    </div>
  );
};
