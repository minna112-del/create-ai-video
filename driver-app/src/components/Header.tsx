import React from 'react';
import { Shield, SlidersHorizontal, Trash2, Globe, Laptop, Smartphone } from 'lucide-react';
import { useDriver } from '../context/DriverContext';

export const Header: React.FC = () => {
  const {
    language,
    setLanguage,
    activeTab,
    setShowPreferencesModal,
    clearAllInbox,
    viewMode,
    setViewMode,
  } = useDriver();

  return (
    <header id="golapi-header" className="sticky top-0 z-30 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800/80 px-4 py-3 flex items-center justify-between transition-all">
      {/* Brand & Logo */}
      <div className="flex items-center gap-2">
        <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-pink-950/60 border border-pink-600/40 text-pink-500">
          {/* Flower / Lotus icon representation */}
          <svg className="w-5 h-5 fill-current text-pink-500 animate-pulse" viewBox="0 0 24 24">
            <path d="M12 2C12 2 14.5 6.5 14.5 9.5C14.5 11 13.5 12 12 12C10.5 12 9.5 11 9.5 9.5C9.5 6.5 12 2 12 2ZM12 22C12 22 9.5 17.5 9.5 14.5C9.5 13 10.5 12 12 12C13.5 12 14.5 13 14.5 14.5C14.5 17.5 12 22 12 22ZM2 12C2 12 6.5 9.5 9.5 9.5C11 9.5 12 10.5 12 12C12 13.5 11 14.5 9.5 14.5C6.5 14.5 2 12 2 12ZM22 12C22 12 17.5 14.5 14.5 14.5C13 14.5 12 13.5 12 12C12 10.5 13 9.5 14.5 9.5C17.5 9.5 22 12 22 12Z" />
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-lg tracking-tight text-white flex items-center gap-1">
            Golapi <span className="text-pink-500 font-extrabold">Driver</span>
          </span>
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex items-center gap-2">
        {/* Language Switcher */}
        <button
          id="btn-language-toggle"
          onClick={() => setLanguage(language === 'bn' ? 'en' : 'bn')}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
          title="Change language / ভাষা পরিবর্তন করুন"
        >
          <Globe className="w-3.5 h-3.5 text-pink-500" />
          <span className="font-medium">{language === 'bn' ? 'বাংলা' : 'English'}</span>
        </button>

        {/* View Mode Toggle (Mobile / Web Dashboard) */}
        <button
          id="btn-view-mode-toggle"
          onClick={() => setViewMode(viewMode === 'mobile' ? 'dashboard' : 'mobile')}
          className={`p-2 rounded-full border text-xs transition-colors ${
            viewMode === 'dashboard'
              ? 'bg-pink-600 border-pink-500 text-white'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
          }`}
          title={viewMode === 'mobile' ? 'Switch to Operations Web Dashboard' : 'Switch to Mobile App View'}
        >
          {viewMode === 'mobile' ? <Laptop className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
        </button>

        {/* Context-aware action icons */}
        {activeTab === 'inbox' ? (
          <button
            id="btn-clear-inbox"
            onClick={clearAllInbox}
            className="p-2 text-zinc-400 hover:text-pink-400 transition-colors rounded-full hover:bg-zinc-900"
            title="Clear all inbox messages"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        ) : (
          <>
            <a
              id="btn-safety-shield"
              href="tel:16222"
              className="p-2 text-zinc-300 hover:text-pink-400 transition-colors rounded-full hover:bg-zinc-900"
              title="Safety Center / সহায়তা হটলাইন"
              aria-label="সহায়তা হটলাইনে কল করুন"
            >
              <Shield className="w-5 h-5 text-zinc-300" />
            </a>
            <button
              id="btn-open-preferences"
              onClick={() => setShowPreferencesModal(true)}
              className="p-2 text-zinc-300 hover:text-pink-400 transition-colors rounded-full hover:bg-zinc-900"
              title="Preferences / পছন্দসমূহ"
            >
              <SlidersHorizontal className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
    </header>
  );
};
