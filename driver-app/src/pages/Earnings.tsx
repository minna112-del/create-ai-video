import React, { useState } from 'react';
import { HelpCircle, ChevronRight, Wallet, ArrowUpRight, Clock, CheckCircle2, TrendingUp, Calendar } from 'lucide-react';
import { useDriver } from '../context/DriverContext';

export const Earnings: React.FC = () => {
  const { profile, language, setShowCashOutModal, isPayoutSuccess, earningsDays, payoutTransactions } = useDriver();
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);

  return (
    <div className="space-y-6 pb-24 md:pb-8 animate-in fade-in duration-300">
      {/* Header title & Help icon */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
        <div>
          <h2 className="text-2xl font-black text-white">{language === 'bn' ? 'আয় ও ওয়ালেট কনসোল' : 'Earnings & Wallet Console'}</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            {language === 'bn' ? 'আপনার দৈনিক ও সাপ্তাহিক ইনকাম বিশ্লেষণ' : 'Track your daily performance, payouts and trips'}
          </p>
        </div>
        <button
          onClick={() => { window.location.href = 'tel:16222'; }}
          className="flex items-center gap-1.5 text-xs text-pink-400 hover:text-pink-300 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
          <span>{language === 'bn' ? 'সহায়তা' : 'Help'}</span>
        </button>
      </div>

      {/* Responsive Grid for Desktop Application View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left / Primary Earnings Card */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-zinc-400 font-semibold">
                  {language === 'bn' ? 'আজকের যাচাইকৃত আয়' : 'Verified earnings today'}
                </p>
                <div className="text-4xl font-black text-white tracking-tight flex items-center gap-1">
                  <span className="text-pink-500">৳</span>
                  <span>{profile.todayEarnings.toFixed(2)}</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-pink-950/80 border border-pink-600/40 flex items-center justify-center text-pink-400">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>

            {/* Metric Grid */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-zinc-800">
              <div className="bg-zinc-950/80 p-3 rounded-2xl border border-zinc-800/80">
                <span className="text-[11px] text-zinc-400">{language === 'bn' ? 'আজ সক্রিয় ডেলিভারি' : 'Active delivery time'}</span>
                <p className="font-bold text-sm text-zinc-100 mt-0.5">{earningsDays.at(-1)?.activeHours || 0} {language === 'bn' ? 'ঘণ্টা' : 'hrs'}</p>
              </div>
              <div className="bg-zinc-950/80 p-3 rounded-2xl border border-zinc-800/80">
                <span className="text-[11px] text-zinc-400">{language === 'bn' ? '৭ দিনের আয়' : '7-day earnings'}</span>
                <p className="font-bold text-sm text-zinc-100 mt-0.5">৳{profile.weeklyEarnings.toFixed(2)}</p>
              </div>
              <div className="bg-zinc-950/80 p-3 rounded-2xl border border-zinc-800/80">
                <span className="text-[11px] text-zinc-400">{language === 'bn' ? 'মোট ট্রিপ' : 'Completed Trips'}</span>
                <p className="font-bold text-sm text-zinc-100 mt-0.5">{profile.totalTrips > 0 ? profile.totalTrips : 0}</p>
              </div>
              <div className="bg-zinc-950/80 p-3 rounded-2xl border border-zinc-800/80">
                <span className="text-[11px] text-zinc-400">{language === 'bn' ? 'ড্রাইভার পয়েন্ট' : 'Reward Points'}</span>
                <p className="font-bold text-sm text-pink-400 mt-0.5">{profile.points}</p>
              </div>
            </div>

            {/* "বিস্তারিত দেখুন" Button */}
            <button
              id="btn-earnings-details"
              onClick={() => setShowDetailsModal(true)}
              className="w-full py-3.5 px-4 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-sm shadow-lg shadow-pink-950 transition-all active:scale-95"
            >
              {language === 'bn' ? 'ব্র্রেকডাউন ও বিস্তারিত দেখুন' : 'View Detailed History'}
            </button>
          </div>

          {/* Wallet Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-white">{language === 'bn' ? 'ওয়ালেট ব্যালেন্স' : 'Wallet Balance'}</h3>
              <Wallet className="w-5 h-5 text-pink-400" />
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-pink-400 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span>
                <span>{language === 'bn' ? 'Golapi পার্স ব্যালেন্স' : 'Golapi Pay Balance'}</span>
              </div>

              <div className="text-3xl font-black text-white flex items-center gap-1">
                <span className="text-pink-500">৳</span>
                <span>{profile.walletBalance.toFixed(2)}</span>
              </div>

              <p className="text-[11px] text-zinc-400">
                {language === 'bn'
                  ? 'প্রতি ট্রিপ শেষে স্বয়ংক্রিয়ভাবে প্রদান করা হবে'
                  : 'Automatically transferred after each completed trip.'}
              </p>
            </div>

            {/* Instant Cash Out / Payout Button */}
            <div className="space-y-2">
              <button
                id="btn-instant-payout"
                onClick={() => setShowCashOutModal(true)}
                disabled={profile.walletBalance <= 0}
                className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                  profile.walletBalance > 0
                    ? 'bg-pink-600 hover:bg-pink-500 text-white shadow-lg shadow-pink-950 active:scale-95'
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>
                  {language === 'bn' ? 'ইনস্ট্যান্ট ক্যাশ আউট করুন (bKash/নগদ/ব্যাংক)' : 'Instant Cash Out (bKash/Nagad)'}
                </span>
              </button>

              {payoutTransactions.length > 0 && (
                <div className="pt-2 space-y-1.5">
                  <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                    {language === 'bn' ? 'সাম্প্রতিক ক্যাশ আউট ইতিহাস' : 'Recent Cash Outs'}
                  </p>
                  {payoutTransactions.slice(0, 2).map((tx) => (
                    <div key={tx.id} className="p-2.5 bg-zinc-950 border border-zinc-800/80 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-white">৳{tx.amount.toFixed(2)}</span>
                        <span className="text-zinc-500 ml-2">via {tx.method}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${tx.status === 'rejected' ? 'text-red-400 bg-red-950/80 border-red-500/30' : 'text-emerald-400 bg-emerald-950/80 border-emerald-500/30'}`}>
                        {tx.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Weekly Breakdown Table for Desktop */}
        <div className="lg:col-span-6 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-pink-400" />
              <span>{language === 'bn' ? 'সাপ্তাহিক আয়ের ইতিহাস' : 'Weekly Earnings Breakdown'}</span>
            </h3>
            <span className="text-xs text-pink-400 font-bold">
              {earningsDays.length} {language === 'bn' ? 'দিন রেকর্ড' : 'Days Recorded'}
            </span>
          </div>

          <div className="space-y-3">
            {earningsDays.map((day, idx) => (
              <div
                key={idx}
                className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800/80 flex items-center justify-between hover:border-pink-500/40 transition-colors"
              >
                <div className="space-y-0.5">
                  <p className="font-bold text-sm text-white">
                    {language === 'bn' ? day.dayName : day.dayNameEn} {day.dateNum}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {day.trips} {language === 'bn' ? 'ট্রিপ সম্পন্ন' : 'trips'} • {day.activeHours}h{' '}
                    {language === 'bn' ? 'সক্রিয় ছিলেন' : 'active'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-black text-pink-400 text-base">৳{day.amount.toFixed(2)}</span>
                  <p className="text-[10px] text-emerald-400 font-bold">✓ Complete</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Details Breakdown Modal */}
      {showDetailsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-lg space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-extrabold text-lg text-white">
                {language === 'bn' ? 'সাপ্তাহিক আয়ের ইতিহাস' : 'Weekly Earnings History'}
              </h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-zinc-400 hover:text-white text-xs font-bold px-2.5 py-1 bg-zinc-800 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              {earningsDays.map((day, idx) => (
                <div key={idx} className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-xs text-white">
                      {language === 'bn' ? day.dayName : day.dayNameEn} {day.dateNum}
                    </p>
                    <p className="text-[10px] text-zinc-400">
                      {day.trips} {language === 'bn' ? 'ট্রিপ' : 'trips'} • {day.activeHours}h {language === 'bn' ? 'সক্রিয়' : 'active'}
                    </p>
                  </div>
                  <span className="font-black text-pink-400 text-sm">৳{day.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowDetailsModal(false)}
              className="w-full py-3 bg-pink-600 rounded-2xl text-white font-bold text-sm"
            >
              {language === 'bn' ? 'বন্ধ করুন' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
