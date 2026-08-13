import React from 'react';
import { Home, Compass, Banknote, Mail, Menu } from 'lucide-react';
import { useDriver } from '../context/DriverContext';
import { TabType } from '../types';

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab, language, tipNotifications } = useDriver();

  const unreadTips = tipNotifications.filter((n) => !n.read).length;

  const tabs: { id: TabType; icon: React.FC<{ className?: string }>; labelBn: string; labelEn: string; badge?: number }[] = [
    { id: 'home', icon: Home, labelBn: 'হোম', labelEn: 'Home' },
    { id: 'discover', icon: Compass, labelBn: 'ডিসকভার', labelEn: 'Discover' },
    { id: 'earnings', icon: Banknote, labelBn: 'আয়', labelEn: 'Earnings' },
    { id: 'inbox', icon: Mail, labelBn: 'ইনবক্স', labelEn: 'Inbox', badge: unreadTips },
    { id: 'menu', icon: Menu, labelBn: 'মেনু', labelEn: 'Menu' },
  ];

  return (
    <nav id="bottom-nav-bar" className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 border-t border-zinc-800/80 backdrop-blur-lg px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] max-w-md mx-auto transition-all">
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const label = language === 'bn' ? tab.labelBn : tab.labelEn;

          return (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={label}
              className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'text-pink-500 font-bold scale-105'
                  : 'text-zinc-400 hover:text-zinc-200 font-medium'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                {tab.badge && tab.badge > 0 ? (
                  <span className="absolute -top-1.5 -right-2 bg-pink-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                    {tab.badge}
                  </span>
                ) : null}
              </div>
              <span className="text-[11px] mt-1 tracking-tight">{label}</span>
              {isActive && (
                <div className="absolute -bottom-1 w-2 h-1 bg-pink-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
