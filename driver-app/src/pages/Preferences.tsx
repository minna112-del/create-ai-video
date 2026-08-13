import React from 'react';
import { SlidersHorizontal, Check, ShieldCheck, RefreshCw, X, ArrowLeft } from 'lucide-react';
import { useDriver } from '../context/DriverContext';

export const PreferencesModal: React.FC = () => {
  const {
    preferences,
    updatePreferences,
    resetPreferences,
    language,
    showPreferencesModal,
    setShowPreferencesModal,
  } = useDriver();

  if (!showPreferencesModal) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 sm:rounded-3xl h-full sm:h-auto max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header matching Screenshot 6 */}
        <div className="sticky top-0 z-10 bg-zinc-950 border-b border-zinc-800 p-4 flex items-center justify-between">
          <button
            onClick={() => setShowPreferencesModal(false)}
            className="p-2 text-zinc-300 hover:text-white rounded-full bg-zinc-900"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-black text-white">
            {language === 'bn' ? 'পছন্দসমূহ' : 'Preferences'}
          </h2>
          <button
            onClick={() => setShowPreferencesModal(false)}
            className="p-2 text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body matching Screenshot 6 */}
        <div className="flex-1 p-4 overflow-y-auto space-y-5 pb-24">
          {/* Main Trip Type Toggle */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
            <span className="font-extrabold text-sm text-white">
              {language === 'bn' ? 'সব ধরনের ট্রিপ গ্রহণ করুন' : 'Accept All Trip Types'}
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.acceptAllTrips}
                onChange={(e) => updatePreferences('acceptAllTrips', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
            </label>
          </div>

          {/* Services Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-bold text-zinc-400 tracking-wider uppercase">
                {language === 'bn' ? 'সেবা' : 'Services'}
              </p>
              <button
                onClick={() => updatePreferences('acceptShopAndDeliver', !preferences.acceptShopAndDeliver)}
                className="text-xs text-pink-400 hover:underline font-bold"
              >
                {language === 'bn' ? 'আরও দেখুন' : 'See More'}
              </button>
            </div>

            <div className="bg-zinc-900 border border-pink-500/40 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pink-950 border border-pink-600/40 text-pink-400 flex items-center justify-center">
                  🛍️
                </div>
                <div>
                  <p className="font-bold text-sm text-white">{language === 'bn' ? 'ডেলিভারি' : 'Deliveries'}</p>
                  <p className="text-[11px] text-zinc-400">Standard & Express Food Deliveries</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.acceptDeliveries}
                onChange={(e) => updatePreferences('acceptDeliveries', e.target.checked)}
                className="w-5 h-5 accent-pink-600 rounded cursor-pointer"
              />
            </div>
          </div>

          {/* Filters & Add-ons Section */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-zinc-400 tracking-wider uppercase px-1">
              {language === 'bn' ? 'ট্রিপ ফিল্টার ও অ্যাড-অন' : 'Trip Filters & Add-ons'}
            </p>

            {/* Accept Cash */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="font-bold text-sm text-white">{language === 'bn' ? 'ক্যাশ গ্রহণ করুন' : 'Accept Cash'}</p>
                <p className="text-[11px] text-zinc-400">Cash on Delivery Orders</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.acceptCash}
                  onChange={(e) => updatePreferences('acceptCash', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
              </label>
            </div>

            {/* Max Delivery Distance */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm text-white">
                    {language === 'bn' ? 'সর্বোচ্চ ডেলিভারি দূরত্ব' : 'Max Delivery Distance'}
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    {language === 'bn' ? 'আপনার সীমার মধ্যে ট্রিপ পান' : 'Receive trip requests within your limit'}
                  </p>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 bg-pink-950 border border-pink-600/40 text-pink-300 rounded-lg">
                  {preferences.noLimitDistance
                    ? (language === 'bn' ? 'সীমা নেই' : 'No Limit')
                    : `${preferences.maxDistanceKm} km`}
                </span>
              </div>

              <input
                type="range"
                min="2"
                max="30"
                value={preferences.maxDistanceKm}
                disabled={preferences.noLimitDistance}
                onChange={(e) => updatePreferences('maxDistanceKm', parseInt(e.target.value))}
                className="w-full accent-pink-600 cursor-pointer"
              />

              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-zinc-500">2 km</span>
                <button
                  onClick={() => updatePreferences('noLimitDistance', !preferences.noLimitDistance)}
                  className="text-[11px] font-bold text-pink-400 hover:underline"
                >
                  {preferences.noLimitDistance ? 'Set Limit' : (language === 'bn' ? 'সীমা নেই' : 'No Limit')}
                </button>
                <span className="text-[10px] text-zinc-500">30 km</span>
              </div>
            </div>

            {/* Shop & Deliver */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="font-bold text-sm text-white">
                  {language === 'bn' ? 'দোকান থেকে কিনে ডেলিভারি' : 'Shop & Deliver'}
                </p>
                <p className="text-[11px] text-zinc-400">Grocery & Retail Orders</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.shopAndDeliver}
                  onChange={(e) => updatePreferences('shopAndDeliver', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
              </label>
            </div>
          </div>

          {/* Equipment Section */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-zinc-400 tracking-wider uppercase px-1">
              {language === 'bn' ? 'সরঞ্জাম' : 'Equipment'}
            </p>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-pink-500" />
                  <p className="font-bold text-sm text-white">
                    {language === 'bn' ? 'ইনসুলেটেড ব্যাগ' : 'Insulated Bag'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.insulatedBagVerified}
                    onChange={(e) => updatePreferences('insulatedBagVerified', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
                </label>
              </div>
              <p className="text-[11px] text-zinc-400 leading-normal">
                {language === 'bn'
                  ? 'মার্চেন্টের কাছ থেকে ইনসুলেটেড ব্যাগ প্রমাণস্বরূপ অর্ডারের সাথে সজ্জিত রাখুন।'
                  : 'Keep your insulated thermal bag ready for hot/cold merchant pickups.'}
              </p>
            </div>
          </div>
        </div>

        {/* Footer Reset Button matching Screenshot 6 */}
        <div className="sticky bottom-0 bg-zinc-950 p-4 border-t border-zinc-800">
          <button
            id="btn-reset-preferences"
            onClick={resetPreferences}
            className="w-full py-3.5 px-4 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-pink-950 transition-all active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
            <span>{language === 'bn' ? 'রিসেট' : 'Reset All Settings'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
