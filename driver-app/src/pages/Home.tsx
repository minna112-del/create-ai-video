import React from 'react';
import { Zap, Sparkles, MapPin, Flame } from 'lucide-react';
import { useDriver } from '../context/DriverContext';
import { Heatmap } from '../components/Heatmap';

export const Home: React.FC = () => {
  const {
    isOnline,
    setIsOnline,
    language,
    unableOnlineMessage,
    hotspots,
  } = useDriver();

  return (
    <div className="space-y-6 pb-24 md:pb-8 animate-in fade-in duration-300">
      {/* Desktop & Mobile Responsive Grid Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: live Driver status and actions */}
        <div className="lg:col-span-5 space-y-4">
          {/* Dynamic Status Alert Banner */}
          {!isOnline && (
            <div className="bg-gradient-to-r from-pink-950/80 via-zinc-900 to-zinc-900 border border-pink-600/40 rounded-2xl p-4 space-y-3 shadow-lg">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-ping"></span>
                <span>{language === 'bn' ? 'আপনি অফলাইনে আছেন' : 'You are offline'}</span>
              </h2>

              <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-pink-600/80 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  !
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {unableOnlineMessage || (language === 'bn' ? 'Assigned order পেতে অনলাইনে যান।' : 'Go online to receive assigned orders.')}
                </p>
              </div>
            </div>
          )}

          {/* Online Active Banner */}
          {isOnline && (
            <div className="bg-gradient-to-r from-emerald-950 via-zinc-900 to-zinc-900 border border-emerald-500/40 rounded-2xl p-4 flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-emerald-600/30 border border-emerald-500 text-emerald-400">
                  <Zap className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider">
                    {language === 'bn' ? 'আপনি এখন অনলাইনে আছেন' : 'You are Online'}
                  </p>
                  <p className="text-sm font-extrabold text-white">
                    {language === 'bn' ? 'অর্ডারের জন্য অপেক্ষা করা হচ্ছে...' : 'Waiting for incoming delivery...'}
                  </p>
                </div>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 font-bold animate-pulse">
                {language === 'bn' ? 'সক্রিয়' : 'Active'}
              </span>
            </div>
          )}

          {/* Big Main Action Button */}
          <div>
            <button
              id="btn-go-online-toggle"
              onClick={() => setIsOnline(!isOnline)}
              className={`w-full py-4 px-6 rounded-2xl font-black text-base shadow-xl transition-all duration-300 active:scale-98 flex items-center justify-center gap-2 ${
                isOnline
                  ? 'bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                  : 'bg-pink-600 hover:bg-pink-500 text-white shadow-pink-950/80 animate-pulse'
              }`}
            >
              <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-zinc-500' : 'bg-white animate-ping'}`} />
              <span>
                {isOnline
                  ? (language === 'bn' ? 'অফলাইনে যান' : 'Go Offline')
                  : (language === 'bn' ? 'অনলাইনে যান' : 'Go Online')}
              </span>
            </button>
          </div>

          {/* Real-time backend status */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-pink-400" />
              <span className="text-xs font-bold text-white">{language === 'bn' ? 'Golapi Shop রিয়েল-টাইম সংযোগ' : 'Golapi Shop Real-time Connection'}</span>
            </div>
            <p className="text-xs text-zinc-400 leading-normal">{language === 'bn' ? 'ড্যাশবোর্ড থেকে আপনার নামে অর্ডার অ্যাসাইন হলেই এখানে স্বয়ংক্রিয়ভাবে দেখা যাবে।' : 'Orders assigned to you from the dashboard appear here automatically.'}</p>
          </div>

          {/* Golapi Shop service area summary */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <Flame className="w-4 h-4 text-pink-500" />
                {language === 'bn' ? 'Golapi Shop ডেলিভারি এলাকা' : 'Golapi Shop Delivery Areas'}
              </span>
              <span className="text-[10px] text-pink-400 font-bold">লাইভ</span>
            </div>
            <div className="space-y-2 text-xs">{hotspots.length ? hotspots.map(zone => <div key={zone.id} className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between"><div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-pink-500" /><span className="text-zinc-200 font-medium">{zone.name}</span></div><span className="text-emerald-400 font-bold">{zone.surgeMultiplier}</span></div>) : <p className="text-zinc-400">{language === 'bn' ? 'Firestore-এ কোনো branch location প্রকাশ করা হয়নি।' : 'No branch location has been published in Firestore.'}</p>}</div>
          </div>
        </div>

        {/* Right Column: Full Interactive Leaflet Heatmap */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-bold text-zinc-400 tracking-wider uppercase">
              {language === 'bn' ? 'হটস্পোট ও চাহিদা মানচিত্র' : 'Hotspots & Demand Map'}
            </p>
            <span className="text-[11px] text-pink-400 font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-pink-500"></span>
              {language === 'bn' ? 'বাংলাদেশ ডেলিভারি মানচিত্র' : 'Bangladesh Delivery Map'}
            </span>
          </div>
          <div className="rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl">
            <Heatmap heightClass="h-[360px] md:h-[520px]" />
          </div>
        </div>
      </div>
    </div>
  );
};
