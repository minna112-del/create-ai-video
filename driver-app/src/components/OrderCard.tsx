import React, { useEffect, useState } from 'react';
import { Clock, MapPin, DollarSign, CheckCircle, XCircle } from 'lucide-react';
import { useDriver } from '../context/DriverContext';

export const OrderCard: React.FC = () => {
  const { activeOrder, acceptOrder, declineOrder, language } = useDriver();
  const [timer, setTimer] = useState<number>(30);

  useEffect(() => {
    if (activeOrder?.status === 'incoming') {
      setTimer(30);
      const interval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            declineOrder();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [activeOrder?.status]);

  if (!activeOrder || activeOrder.status !== 'incoming') return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4 transition-all animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-zinc-900 border border-pink-500/40 rounded-3xl p-5 shadow-2xl space-y-4">
        {/* Header alert */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-pink-500"></span>
            </span>
            <span className="text-pink-400 font-bold text-sm tracking-wide uppercase">
              {language === 'bn' ? 'নতুন ডেলিভারি অনুরোধ!' : 'New Delivery Request!'}
            </span>
          </div>
          <div className="flex items-center gap-1 bg-zinc-800 text-pink-400 px-3 py-1 rounded-full text-xs font-bold">
            <Clock className="w-3.5 h-3.5" />
            <span>{timer}s</span>
          </div>
        </div>

        {/* Fare & Restaurant details */}
        <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 flex items-center justify-between">
          <div>
            <div className="text-2xl font-black text-white flex items-center gap-1">
              <span className="text-pink-500">৳</span>
              <span>{activeOrder.estimatedEarnings.toFixed(2)}</span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              {language === 'bn' ? 'আনুমানিক আয় (টিপসহ)' : 'Estimated Earnings (incl. tip)'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-zinc-300">{activeOrder.distanceFormatted}</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {activeOrder.estTimeMin} {language === 'bn' ? 'মিনিট ড্রাইভ' : 'min drive'}
            </p>
          </div>
        </div>

        {/* Restaurant & Dropoff Location */}
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-pink-950/80 text-pink-400 border border-pink-600/40 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-pink-400 font-semibold">{language === 'bn' ? 'পিকআপ পয়েন্ট' : 'Pickup Location'}</p>
              <p className="font-bold text-white text-base">{activeOrder.restaurantName}</p>
              <p className="text-xs text-zinc-400">{activeOrder.restaurantAddress}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-950/80 text-blue-400 border border-blue-600/40 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-blue-400 font-semibold">{language === 'bn' ? 'ডেলিভারি ড্রপঅফ' : 'Dropoff Location'}</p>
              <p className="font-bold text-zinc-200">{activeOrder.customerName}</p>
              <p className="text-xs text-zinc-400">{activeOrder.customerAddress}</p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            id="btn-decline-order"
            onClick={declineOrder}
            className="w-full py-3.5 px-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <XCircle className="w-4 h-4 text-zinc-400" />
            <span>{language === 'bn' ? 'প্রত্যাখ্যান করুন' : 'Decline'}</span>
          </button>
          <button
            id="btn-accept-order"
            onClick={acceptOrder}
            className="w-full py-3.5 px-4 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-pink-900/40 transition-all active:scale-95 animate-pulse"
          >
            <CheckCircle className="w-4 h-4" />
            <span>{language === 'bn' ? 'গ্রহণ করুন' : 'Accept Trip'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
