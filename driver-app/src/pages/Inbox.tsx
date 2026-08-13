import React, { useState } from 'react';
import { Award, Trash2, Heart, Check, BellRing } from 'lucide-react';
import { useDriver } from '../context/DriverContext';

export const Inbox: React.FC = () => {
  const { tipNotifications, sendThanksForTip, deleteTipNotification, language } = useDriver();
  const [activeCategory, setActiveCategory] = useState<'all' | 'message' | 'alert' | 'update' | 'delivery'>('all');

  const categories: Array<{ id: 'all' | 'message' | 'alert' | 'update' | 'delivery'; labelBn: string; labelEn: string }> = [
    { id: 'all', labelBn: 'সব', labelEn: 'All' },
    { id: 'message', labelBn: 'বার্তা', labelEn: 'Messages' },
    { id: 'alert', labelBn: 'সতর্কতা', labelEn: 'Alerts' },
    { id: 'update', labelBn: 'আপডেট', labelEn: 'Updates' },
    { id: 'delivery', labelBn: 'ডেলিভারি', labelEn: 'Delivery' },
  ];

  return (
    <div className="space-y-6 pb-24 md:pb-8 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-3">
        <div>
          <h2 className="text-2xl font-black text-white">{language === 'bn' ? 'ইনবক্স ও নোটিফিকেশন' : 'Inbox & Customer Tips'}</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            {language === 'bn' ? 'কাস্টমার টিপস, রাইড আপডেটস ও বার্তা পরিচালনা করুন' : 'Manage customer tip receipts, system notices and messages'}
          </p>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => {
            const isSelected = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-pink-600 text-white shadow-md shadow-pink-950 scale-105'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                {language === 'bn' ? cat.labelBn : cat.labelEn}
              </button>
            );
          })}
        </div>
      </div>

      {/* Section Subheader */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-bold text-zinc-400 tracking-wider uppercase">
          {language === 'bn' ? 'সাম্প্রতিক নোটিফিকেশন তালিকা' : 'Recent Tip Receipts'}
        </h3>
        <span className="text-[11px] text-pink-400 font-semibold">
          {tipNotifications.length} {language === 'bn' ? 'টি নোটিফিকেশন' : 'items'}
        </span>
      </div>

      {/* Notification List with Desktop Multi-column Grid */}
      {tipNotifications.length === 0 ? (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-12 text-center space-y-3">
          <BellRing className="w-12 h-12 text-zinc-600 mx-auto" />
          <p className="text-base font-bold text-zinc-300">
            {language === 'bn' ? 'কোন নোটিফিকেশন নেই' : 'No Notifications'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tipNotifications.map((item) => (
            <div
              key={item.id}
              className={`group bg-zinc-900 border hover:border-pink-500/50 rounded-2xl p-5 transition-all flex items-start gap-4 shadow-md ${
                item.read ? 'border-zinc-800/80 opacity-90' : 'border-pink-600/40 bg-zinc-900/90'
              }`}
            >
              {/* Pink Trophy/Tip Icon */}
              <div className="w-12 h-12 rounded-2xl bg-pink-950 text-pink-500 border border-pink-600/40 flex items-center justify-center shrink-0 mt-0.5">
                <Award className="w-6 h-6" />
              </div>

              {/* Message Details */}
              <div className="flex-1 space-y-2">
                <p className="font-extrabold text-base text-white leading-snug">
                  {language === 'bn'
                    ? `আপনি ৳${item.amount.toFixed(2)} টিপ পেয়েছেন!`
                    : `You received a ৳${item.amount.toFixed(2)} tip!`}
                </p>

                <p className="text-xs text-zinc-400 leading-normal">
                  {language === 'bn'
                    ? 'রসিদ দেখতে ট্যাপ করুন বা কাস্টমারকে ধন্যবাদ জানান...'
                    : 'Tap to view receipt or send a quick thank you note...'}
                </p>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-zinc-500 font-medium">
                    {language === 'bn' ? item.timeAgo : item.timeAgoEn}
                  </span>

                  {/* Send Thanks Interactive Button */}
                  <button
                    id={`btn-send-thanks-${item.id}`}
                    onClick={() => sendThanksForTip(item.id)}
                    className={`text-xs font-bold px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                      item.sentThanks
                        ? 'bg-emerald-950 border border-emerald-500/40 text-emerald-400'
                        : 'bg-pink-950 border border-pink-600/40 text-pink-400 hover:bg-pink-900 hover:text-pink-200 active:scale-95'
                    }`}
                  >
                    {item.sentThanks ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{language === 'bn' ? 'ধন্যবাদ পাঠানো হয়েছে ✓' : 'Thanks Sent ✓'}</span>
                      </>
                    ) : (
                      <>
                        <Heart className="w-3.5 h-3.5 fill-pink-500 text-pink-500" />
                        <span>{language === 'bn' ? 'ধন্যবাদ জানান' : 'Send Thanks'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Delete action button */}
              <button
                onClick={() => deleteTipNotification(item.id)}
                className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 p-1 transition-opacity"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

