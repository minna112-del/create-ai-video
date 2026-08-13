import React, { useState } from 'react';
import { X, ArrowLeft, CheckCircle2, DollarSign, Wallet, ShieldCheck, Zap } from 'lucide-react';
import { useDriver } from '../context/DriverContext';
import type { PayoutTransaction } from '../types';

export const CashOutModal: React.FC = () => {
  const {
    showCashOutModal,
    setShowCashOutModal,
    profile,
    requestDetailedPayout,
    isPayoutSuccess,
    language,
  } = useDriver();

  const [selectedMethod, setSelectedMethod] = useState<PayoutTransaction['method']>('bKash');
  const [accountNumber, setAccountNumber] = useState<string>(profile.phone || '');
  const [amount, setAmount] = useState<string>(profile.walletBalance > 0 ? profile.walletBalance.toString() : '');

  if (!showCashOutModal) return null;

  const numAmount = parseFloat(amount) || 0;
  const isValidAmount = numAmount > 0 && numAmount <= profile.walletBalance;

  const handleWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValidAmount && accountNumber.trim().length >= 11) {
      requestDetailedPayout(numAmount, selectedMethod, accountNumber.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 sm:rounded-3xl h-full sm:h-auto max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-zinc-950 border-b border-zinc-800 p-4 flex items-center justify-between">
          <button
            onClick={() => setShowCashOutModal(false)}
            className="p-2 text-zinc-300 hover:text-white rounded-full bg-zinc-900"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-black text-white">
            {language === 'bn' ? 'ইনস্ট্যান্ট ক্যাশ আউট' : 'Instant Cash Out'}
          </h2>
          <button
            onClick={() => setShowCashOutModal(false)}
            className="p-2 text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {isPayoutSuccess ? (
          <div className="p-8 text-center space-y-4 my-auto animate-in zoom-in-95">
            <div className="w-20 h-20 bg-emerald-950 border-2 border-emerald-500 rounded-full flex items-center justify-center mx-auto text-emerald-400 shadow-xl shadow-emerald-950">
              <CheckCircle2 className="w-10 h-10 animate-bounce" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white">
                {language === 'bn' ? 'পেআউট অনুরোধ গ্রহণ করা হয়েছে!'  : 'Payout Request Submitted!' }
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                {language === 'bn'
                  ? `৳${numAmount.toFixed(2)} পেআউট অনুরোধ প্রক্রিয়াধীন আছে` 
                  : `Your ৳${numAmount.toFixed(2)} payout request is being processed` }
              </p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-xs space-y-1.5 text-left">
              <div className="flex justify-between text-zinc-400">
                <span>{language === 'bn' ? 'পেমেন্ট মেথড:' : 'Payment Method:'}</span>
                <span className="font-bold text-white">{selectedMethod}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>{language === 'bn' ? 'অ্যাকাউন্ট নম্বর:' : 'Account No:'}</span>
                <span className="font-bold text-white">{accountNumber}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>{language === 'bn' ? 'চার্জ:' : 'Cashout Fee:'}</span>
                <span className="font-bold text-emerald-400">৳০.০০ (ফ্রি)</span>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleWithdraw} className="p-5 flex-1 overflow-y-auto space-y-5">
            {/* Wallet Balance Display */}
            <div className="bg-gradient-to-r from-pink-950/60 via-zinc-900 to-zinc-900 border border-pink-600/40 rounded-2xl p-4 flex items-center justify-between shadow-lg">
              <div>
                <span className="text-xs font-bold text-pink-400 tracking-wider uppercase">
                  {language === 'bn' ? 'উত্তোলনযোগ্য ব্যালেন্স' : 'Withdrawable Balance'}
                </span>
                <div className="text-3xl font-black text-white flex items-center gap-1 mt-0.5">
                  <span className="text-pink-500">৳</span>
                  <span>{profile.walletBalance.toFixed(2)}</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-pink-600/20 border border-pink-500/40 flex items-center justify-center text-pink-400">
                <Wallet className="w-6 h-6" />
              </div>
            </div>

            {/* Method Selection (bKash, Nagad, Rocket, Bank) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 tracking-wider uppercase block">
                {language === 'bn' ? 'পেমেন্ট মেথড নির্বাচন করুন' : 'Select Payment Method'}
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { id: 'bKash', name: 'bKash (বিকাশ)', color: 'border-pink-500/60 text-pink-400 bg-pink-950/40' },
                  { id: 'Nagad', name: 'Nagad (নগদ)', color: 'border-orange-500/60 text-orange-400 bg-orange-950/40' },
                  { id: 'Rocket', name: 'Rocket (রকেট)', color: 'border-purple-500/60 text-purple-400 bg-purple-950/40' },
                  { id: 'Bank', name: 'Bank Transfer (ব্যাংক)', color: 'border-blue-500/60 text-blue-400 bg-blue-950/40' },
                ].map((item) => {
                  const isSelected = selectedMethod === item.id;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => setSelectedMethod(item.id as PayoutTransaction['method'])}
                      className={`p-3.5 rounded-2xl border text-xs font-bold text-left transition-all ${
                        isSelected
                          ? `${item.color} shadow-md ring-2 ring-pink-500/50 scale-[1.02]`
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{item.name}</span>
                        {isSelected && <Zap className="w-3.5 h-3.5 fill-pink-500 text-pink-500" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Account Number */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-400 tracking-wider uppercase block">
                {selectedMethod === 'Bank'
                  ? (language === 'bn' ? 'ব্যাংক অ্যাকাউন্ট নম্বর' : 'Bank Account Number')
                  : (language === 'bn' ? `${selectedMethod} মোবাইল নম্বর` : `${selectedMethod} Mobile Number`)}
              </label>
              <input
                type="text"
                inputMode={selectedMethod === 'Bank' ? 'text' : 'numeric'}
                autoComplete="off"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder={selectedMethod === 'Bank' ? 'ব্যাংক অ্যাকাউন্ট নম্বর' : '01XXXXXXXXX'}
                className="w-full p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-white font-bold text-sm focus:border-pink-500 outline-none"
                required
              />
            </div>

            {/* Withdrawal Amount */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-400 tracking-wider uppercase block">
                  {language === 'bn' ? 'উত্তোলনের পরিমাণ (৳)' : 'Withdrawal Amount (৳)'}
                </label>
                <button
                  type="button"
                  onClick={() => setAmount(profile.walletBalance.toString())}
                  className="text-xs font-bold text-pink-400 hover:underline"
                >
                  {language === 'bn' ? 'সব টাকা (Max)' : 'Withdraw All'}
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-500 font-black text-lg">৳</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  max={profile.walletBalance}
                  min="50"
                  step="10"
                  className="w-full p-3.5 pl-9 rounded-2xl bg-zinc-900 border border-zinc-800 text-white font-black text-lg focus:border-pink-500 outline-none"
                  required
                />
              </div>
              {numAmount > profile.walletBalance && (
                <p className="text-xs text-red-400 font-bold mt-1">
                  {language === 'bn' ? 'ব্যালেন্সের চেয়ে বেশি টাকা ক্যাশ আউট করা সম্ভব নয়' : 'Insufficient balance'}
                </p>
              )}
            </div>

            {/* Security Guarantee Note */}
            <div className="p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-xl flex items-center gap-2.5 text-xs text-zinc-400">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>
                {language === 'bn'
                  ? 'গোলপী ড্রাইভার ইনস্ট্যান্ট পেআউট সার্ভিস ২৪/৭ সচল থাকে। কোনো ট্রানজেকশন ফি নেই।'
                  : 'Instant payouts are processed 24/7 with zero transaction fees.'}
              </span>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={!isValidAmount || accountNumber.trim().length < 11}
                className="w-full py-4 px-6 rounded-2xl bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white font-black text-base shadow-xl shadow-pink-950 transition-all active:scale-98 flex items-center justify-center gap-2"
              >
                <span>
                  {language === 'bn'
                    ? `৳${numAmount.toFixed(2)} ক্যাশ আউট করুন`
                    : `Cash Out ৳${numAmount.toFixed(2)}`}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
