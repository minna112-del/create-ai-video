import React, { useState } from 'react';
import {
  Phone,
  ArrowLeft,
  Menu,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Navigation,
  Key,
  HelpCircle,
  ShoppingBag,
  Sparkles,
  MapPin,
} from 'lucide-react';
import { useDriver } from '../context/DriverContext';
import { Heatmap } from './Heatmap';

export const ActiveOrderModal: React.FC = () => {
  const { activeOrder, advanceOrderStatus, cancelActiveOrder, language } = useDriver();
  const [verifiedOrder, setVerifiedOrder] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);

  if (!activeOrder || activeOrder.status === 'idle' || activeOrder.status === 'incoming') {
    return null;
  }

  const isPickingUp = activeOrder.status === 'picking_up' || activeOrder.status === 'verifying';
  const isDelivering = activeOrder.status === 'delivering' || activeOrder.status === 'arrived';
  const isCompleted = activeOrder.status === 'completed';

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col h-full overflow-y-auto max-w-md mx-auto shadow-2xl transition-all">
      {/* Top Header bar matching Screenshot 6 */}
      <div className="sticky top-0 z-30 bg-zinc-950 border-b border-zinc-800/80 px-4 py-3 flex items-center justify-between">
        <button
          id="btn-order-back"
          onClick={() => setShowHelpModal(true)}
          className="p-2 text-zinc-300 hover:text-white rounded-full bg-zinc-900"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 bg-pink-950/60 border border-pink-600/40 px-3 py-1.5 rounded-full">
          <span className="w-2 h-2 rounded-full bg-pink-500 animate-ping"></span>
          <span className="text-pink-300 text-xs font-bold">
            {activeOrder.distanceFormatted}
          </span>
        </div>

        <button
          id="btn-order-menu"
          onClick={() => setShowHelpModal(true)}
          className="p-2 text-zinc-300 hover:text-white rounded-full bg-zinc-900"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content View */}
      <div className="flex-1 p-4 space-y-4 pb-28">
        {/* Navigation Map View matching Screenshot 7 */}
        <div className="relative space-y-2">
          {/* Banner instruction */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-pink-600 text-white flex items-center justify-center font-bold">
                <Navigation className="w-4 h-4 transform -rotate-45" />
              </div>
              <div>
                <p className="text-xs text-zinc-400 font-semibold">
                  {isPickingUp
                    ? (language === 'bn' ? 'পিকআপের দিকে যান' : 'Heading to Pickup')
                    : (language === 'bn' ? 'ড্রপঅফের দিকে যান' : 'Heading to Dropoff')}
                </p>
                <p className="text-sm font-bold text-white">
                  {isPickingUp ? activeOrder.restaurantAddress : activeOrder.customerAddress}
                </p>
              </div>
            </div>
            <button
              id="btn-nav-external"
              onClick={() => {
                const coords = isPickingUp ? activeOrder.pickupCoords : activeOrder.dropoffCoords;
                const address = isPickingUp ? activeOrder.restaurantAddress : activeOrder.customerAddress;
                const destination = coords ? `${coords[0]},${coords[1]}` : address;
                window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`, '_blank', 'noopener,noreferrer');
              }}
              className="px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold shadow-md"
            >
              {language === 'bn' ? 'নেভিগেশন' : 'Navigate'}
            </button>
          </div>

          <Heatmap heightClass="h-[220px]" />
        </div>

        {/* Pickup Screen matching Screenshot 6 */}
        {isPickingUp && (
          <div className="space-y-4">
            {/* Restaurant Info Card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-lg font-extrabold text-white">{activeOrder.restaurantName}</h3>
                <p className="text-xs text-zinc-400">{activeOrder.restaurantAddress}</p>
              </div>
              <a
                href={`tel:${activeOrder.customerPhone}`}
                className="w-10 h-10 rounded-full bg-pink-600 text-white flex items-center justify-center hover:bg-pink-500 shadow-lg shadow-pink-950"
              >
                <Phone className="w-5 h-5" />
              </a>
            </div>

            {/* Business Note Box */}
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 space-y-1.5">
              <p className="text-xs font-bold text-zinc-400 tracking-wider uppercase">
                {language === 'bn' ? 'ব্যবসার নোট' : 'Business Note'}
              </p>
              <p className="text-sm font-semibold text-zinc-200">{activeOrder.businessNote}</p>
            </div>

            {/* Customer Item Card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-pink-400 font-bold">{activeOrder.customerName}</p>
                <p className="text-sm font-extrabold text-white mt-0.5">
                  {activeOrder.customerCode} • {activeOrder.itemCount} {language === 'bn' ? 'টি আইটেম' : 'item'}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-500" />
            </div>

            {/* Order Verification Button */}
            <button
              id="btn-verify-order"
              onClick={() => setVerifiedOrder(!verifiedOrder)}
              className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm border transition-all flex items-center justify-center gap-2 ${
                verifiedOrder
                  ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                  : 'bg-pink-950/60 border-pink-600/60 text-pink-300 hover:bg-pink-900'
              }`}
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>
                {verifiedOrder
                  ? (language === 'bn' ? 'অর্ডার যাচাই করা হয়েছে ✓' : 'Order Verified ✓')
                  : (language === 'bn' ? 'অর্ডার যাচাই করুন' : 'Verify Order')}
              </span>
            </button>

            {/* Support section */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-bold text-zinc-400">{language === 'bn' ? 'সহায়তা ও সহায়তা' : 'Support & Assistance'}</p>
              <button
                id="btn-trip-help"
                onClick={() => setShowHelpModal(true)}
                className="w-full flex items-center justify-between p-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-xs text-pink-400 font-bold"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-pink-500" />
                  <span>{language === 'bn' ? 'ট্রিপ সহায়তা' : 'Trip Assistance'}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500" />
              </button>
            </div>
          </div>
        )}

        {/* Dropoff Screen matching Requirement 4 */}
        {isDelivering && (
          <div className="space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-400 font-bold">{language === 'bn' ? 'কাস্টমার ড্রপঅফ' : 'Customer Dropoff'}</p>
                  <h3 className="text-lg font-extrabold text-white">{activeOrder.customerName}</h3>
                </div>
                <a
                  href={`tel:${activeOrder.customerPhone}`}
                  className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-500 shadow-lg"
                >
                  <Phone className="w-5 h-5" />
                </a>
              </div>
              <p className="text-xs text-zinc-400">{activeOrder.customerAddress}</p>
            </div>

          </div>
        )}

        {/* Completed Receipt view */}
        {isCompleted && (
          <div className="bg-zinc-900 border border-pink-500/40 rounded-3xl p-6 text-center space-y-4 animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-pink-950 text-pink-500 border-2 border-pink-500 flex items-center justify-center mx-auto">
              <Sparkles className="w-8 h-8 animate-bounce" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">
                {language === 'bn' ? 'ডেলিভারি সম্পন্ন হয়েছে!' : 'Delivery Completed!'}
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                {language === 'bn' ? 'আপনার অ্যাকাউন্টে আয় যোগ করা হয়েছে' : 'Earnings added to your Golapi Wallet'}
              </p>
            </div>
            <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
              <span className="text-3xl font-black text-pink-500">৳{activeOrder.estimatedEarnings.toFixed(2)}</span>
              <p className="text-xs text-zinc-400 mt-1">{language === 'bn' ? 'ট্রিপ ভাড়া + কাস্টমার টিপ' : 'Trip Fare + Tip'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Sticky Action Button matching Screenshot 6 */}
      <div className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto p-4 bg-zinc-950/90 border-t border-zinc-800 backdrop-blur-md">
        <button
          id="btn-complete-step"
          onClick={advanceOrderStatus}
          className="w-full py-4 px-6 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white font-black text-base shadow-xl shadow-pink-950 transition-all active:scale-98 flex items-center justify-center gap-2"
        >
          <span>
            {activeOrder.status === 'picking_up' && (language === 'bn' ? 'প্যাকিং সম্পন্ন করুন' : 'Mark Packed')}
            {activeOrder.status === 'verifying' && (language === 'bn' ? 'পিকআপ সম্পন্ন করুন' : 'Complete Pickup')}
            {activeOrder.status === 'delivering' && (language === 'bn' ? 'রওনা দিন ও লাইভ লোকেশন চালু করুন' : 'Start Delivery & Live Location')}
            {activeOrder.status === 'arrived' && (language === 'bn' ? 'ডেলিভারি সম্পন্ন করুন' : 'Complete Delivery')}
            {isCompleted && (language === 'bn' ? 'হোমে ফিরে যান' : 'Return to Home')}
          </span>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-lg text-white">{language === 'bn' ? 'ট্রিপ সহায়তা কেন্দ্র' : 'Trip Help Center'}</h3>
            <div className="space-y-2">
              <button
                onClick={() => {
                  cancelActiveOrder();
                  setShowHelpModal(false);
                }}
                className="w-full text-left p-3 rounded-xl bg-zinc-800 text-red-400 font-bold text-xs hover:bg-zinc-700"
              >
                {language === 'bn' ? 'ট্রিপ বাতিল করুন (অর্ডার স্টক নাই)' : 'Cancel Trip (Store out of stock)'}
              </button>
              <button
                onClick={() => setShowHelpModal(false)}
                className="w-full text-left p-3 rounded-xl bg-zinc-800 text-zinc-200 font-bold text-xs hover:bg-zinc-700"
              >
                {language === 'bn' ? 'কাস্টমার বা সাপোর্টে কল করুন' : 'Call Support Dispatch'}
              </button>
            </div>
            <button
              onClick={() => setShowHelpModal(false)}
              className="w-full py-2 bg-zinc-800 rounded-xl text-xs font-bold text-zinc-400"
            >
              {language === 'bn' ? 'বন্ধ করুন' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
