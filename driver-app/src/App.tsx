import React, { lazy, Suspense } from 'react';
import { DriverProvider, useDriver } from './context/DriverContext';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { DesktopSidebar } from './components/DesktopSidebar';
import { SlidersHorizontal } from 'lucide-react';
import { AuthScreen } from './components/AuthScreen';

const Home = lazy(() => import('./pages/Home').then(module => ({ default: module.Home })));
const Discover = lazy(() => import('./pages/Discover').then(module => ({ default: module.Discover })));
const Earnings = lazy(() => import('./pages/Earnings').then(module => ({ default: module.Earnings })));
const Inbox = lazy(() => import('./pages/Inbox').then(module => ({ default: module.Inbox })));
const Menu = lazy(() => import('./pages/Menu').then(module => ({ default: module.Menu })));
const PreferencesModal = lazy(() => import('./pages/Preferences').then(module => ({ default: module.PreferencesModal })));
const OrderCard = lazy(() => import('./components/OrderCard').then(module => ({ default: module.OrderCard })));
const ActiveOrderModal = lazy(() => import('./components/ActiveOrderModal').then(module => ({ default: module.ActiveOrderModal })));
const WebDashboard = lazy(() => import('./components/WebDashboard').then(module => ({ default: module.WebDashboard })));
const CashOutModal = lazy(() => import('./components/CashOutModal').then(module => ({ default: module.CashOutModal })));
const ProfileModal = lazy(() => import('./components/ProfileModal').then(module => ({ default: module.ProfileModal })));

const LoadingScreen = () => (
  <div className="min-h-[40vh] text-pink-400 flex items-center justify-center font-bold" role="status" aria-live="polite">
    Golapi Driver লোড হচ্ছে…
  </div>
);

const MainAppContent: React.FC = () => {
  const {
    activeTab,
    viewMode,
    isOnline,
    setIsOnline,
    language,
    profile,
    setShowPreferencesModal,
    authReady,
    currentUser,
  } = useDriver();

  if (!authReady) return <div className="min-h-screen bg-zinc-950 text-pink-500 flex items-center justify-center font-bold">Golapi Driver লোড হচ্ছে…</div>;
  if (!currentUser) return <AuthScreen />;

  if (viewMode === 'dashboard') {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <div className="min-h-screen bg-zinc-950 text-white font-['Hind_Siliguri',_'Plus_Jakarta_Sans',_sans-serif]">
          <WebDashboard />
          <OrderCard />
          <ActiveOrderModal />
          <PreferencesModal />
        </div>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <div className="min-h-screen bg-zinc-950 text-zinc-100 font-['Hind_Siliguri',_'Plus_Jakarta_Sans',_sans-serif] selection:bg-pink-600 selection:text-white">
      {/* 
        LAYOUT ARCHITECTURE:
        - Mobile View (< md): Centered single mobile container with top Header & bottom BottomNav.
        - Desktop View (>= md): Full-screen desktop application layout with left DesktopSidebar and fluid main workspace.
      */}

      {/* Desktop Responsive Full App Layout */}
      <div className="hidden md:flex min-h-screen bg-zinc-950 text-zinc-100">
        <DesktopSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Desktop Navigation Bar */}
          <header className="sticky top-0 z-30 bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800/80 px-8 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-black text-white capitalize tracking-tight flex items-center gap-2">
                <span>Golapi Driver</span>
                <span className="text-pink-500 font-bold">•</span>
                <span className="text-pink-400 font-extrabold text-sm uppercase tracking-wider bg-pink-950/80 border border-pink-600/40 px-3 py-0.5 rounded-full">
                  {activeTab}
                </span>
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                {language === 'bn'
                  ? 'ডেক্সটপ অ্যাপ্লিকেশন ড্যাশবোর্ড • রিয়েল-টাইম নেভিগেশন ও ইনকাম ট্র্যাকার'
                  : 'Desktop Application Suite • Real-time Navigation & Earnings Console'}
              </p>
            </div>

            <div className="flex items-center gap-4">
              {/* Wallet quick balance */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-2 flex items-center gap-2">
                <span className="text-xs text-zinc-400 font-bold">{language === 'bn' ? 'ওয়ালেট' : 'Wallet'}:</span>
                <span className="text-sm font-black text-pink-400">৳{profile.walletBalance.toFixed(2)}</span>
              </div>

              {/* Preferences Modal Trigger */}
              <button
                onClick={() => setShowPreferencesModal(true)}
                className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 hover:text-white hover:border-pink-500/50 transition-colors"
                title="Trip Preferences"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Desktop Main Content Workspace */}
          <main className="flex-1 p-8 max-w-7xl w-full mx-auto overflow-y-auto">
            {activeTab === 'home' && <Home />}
            {activeTab === 'discover' && <Discover />}
            {activeTab === 'earnings' && <Earnings />}
            {activeTab === 'inbox' && <Inbox />}
            {activeTab === 'menu' && <Menu />}
          </main>
        </div>
      </div>

      {/* Mobile Screen Layout (< md) */}
      <div className="md:hidden max-w-md mx-auto min-h-screen flex flex-col bg-zinc-950 shadow-2xl relative border-x border-zinc-900">
        <Header />

        <main className="flex-1 px-4 pt-3 pb-28 overflow-y-auto">
          {activeTab === 'home' && <Home />}
          {activeTab === 'discover' && <Discover />}
          {activeTab === 'earnings' && <Earnings />}
          {activeTab === 'inbox' && <Inbox />}
          {activeTab === 'menu' && <Menu />}
        </main>

        <BottomNav />
      </div>

      {/* Shared Modals and Overlays */}
      <OrderCard />
      <ActiveOrderModal />
      <PreferencesModal />
      <CashOutModal />
      <ProfileModal />
      </div>
    </Suspense>
  );
};

export default function App() {
  return (
    <DriverProvider>
      <MainAppContent />
    </DriverProvider>
  );
}
