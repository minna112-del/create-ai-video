import React, { useState } from 'react';
import { X, ArrowLeft, CheckCircle } from 'lucide-react';
import { useDriver } from '../context/DriverContext';

export const ProfileModal: React.FC = () => {
  const { showProfileModal, setShowProfileModal, profile, updateProfile, language } = useDriver();

  const [phone, setPhone] = useState(profile.phone);
  const [vehicleType, setVehicleType] = useState(profile.vehicleType || 'Motorbike (বাইক)');
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!showProfileModal) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      phone,
      vehicleType,
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      setShowProfileModal(false);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 sm:rounded-3xl h-full sm:h-auto max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-zinc-950 border-b border-zinc-800 p-4 flex items-center justify-between">
          <button
            onClick={() => setShowProfileModal(false)}
            className="p-2 text-zinc-300 hover:text-white rounded-full bg-zinc-900"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-black text-white">
            {language === 'bn' ? 'ড্রাইভার প্রোফাইল এডিট' : 'Edit Driver Profile'}
          </h2>
          <button
            onClick={() => setShowProfileModal(false)}
            className="p-2 text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 flex-1 overflow-y-auto space-y-5">
          {savedSuccess && (
            <div className="p-3 bg-emerald-950 border border-emerald-500/40 text-emerald-300 rounded-2xl text-xs font-bold text-center flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>{language === 'bn' ? 'প্রোফাইল আপডেট সম্পন্ন হয়েছে!' : 'Profile updated successfully!'}</span>
            </div>
          )}

          {/* Official profile photo is managed by the CEO/Admin from People Operations. */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-400 tracking-wider uppercase block">
              {language === 'bn' ? 'অফিশিয়াল প্রোফাইল ছবি' : 'Official Profile Photo'}
            </label>
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800">
              <img
                src={profile.avatar || '/icons/driver_logo.webp'}
                alt=""
                className="w-12 h-12 rounded-2xl object-cover border border-zinc-700"
                onError={(event) => { event.currentTarget.src = '/icons/driver_logo.webp'; }}
              />
              <p className="text-xs text-zinc-400 leading-relaxed">
                {language === 'bn'
                  ? 'এই ছবি CEO/Admin অফিস থেকে সেট করা হবে। আপনি নিজে পরিবর্তন করতে পারবেন না।'
                  : 'This photo is set by the CEO/Admin office and cannot be changed by the driver.'}
              </p>
            </div>
          </div>

          {/* Official identity is managed by the staff office. */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-400 tracking-wider uppercase block">
              {language === 'bn' ? 'অফিশিয়াল নাম' : 'Official Name'}
            </label>
            <input type="text" value={language === 'bn' ? profile.name : profile.nameEn} readOnly className="w-full p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-zinc-400 font-bold text-sm" />
          </div>

          {/* Mobile Phone */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-400 tracking-wider uppercase block">
              {language === 'bn' ? 'ফোন নম্বর' : 'Phone Number'}
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-white font-bold text-sm focus:border-pink-500 outline-none"
              required
            />
          </div>

          {/* Vehicle Type */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-400 tracking-wider uppercase block">
              {language === 'bn' ? 'যানবাহনের ধরন' : 'Vehicle Type'}
            </label>
            <select
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              className="w-full p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-white font-bold text-sm focus:border-pink-500 outline-none"
            >
              <option value="Motorbike (বাইক)">Motorbike (মোটরবাইক)</option>
              <option value="Scooter (স্কুটার)">Scooter (স্কুটার)</option>
              <option value="Bicycle (সাইকেল)">Bicycle (সাইকেল)</option>
              <option value="Covered Van (কাভার্ড ভ্যান)">Covered Van (কাভার্ড ভ্যান)</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full py-4 px-6 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white font-black text-base shadow-xl shadow-pink-950 transition-all active:scale-98"
          >
            {language === 'bn' ? 'পরিবর্তন সংরক্ষণ করুন' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
};
