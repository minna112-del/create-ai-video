import React, { useState } from 'react';
import { Loader2, LockKeyhole, Mail, Truck } from 'lucide-react';
import { useDriver } from '../context/DriverContext';

export const AuthScreen: React.FC = () => {
  const { login, authError, language } = useDriver();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try { await login(email.trim(), password); } finally { setBusy(false); }
  };

  return <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-5 font-['Hind_Siliguri',sans-serif]">
    <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900/90 p-7 shadow-2xl">
      <div className="mx-auto mb-5 h-16 w-16 rounded-2xl bg-pink-600 flex items-center justify-center shadow-lg shadow-pink-950"><Truck className="h-8 w-8" /></div>
      <h1 className="text-center text-3xl font-black">Golapi <span className="text-pink-500">Driver</span></h1>
      <p className="mt-2 text-center text-sm text-zinc-400">{language === 'bn' ? 'অনুমোদিত ড্রাইভার অ্যাকাউন্ট দিয়ে লগইন করুন' : 'Sign in with an approved driver account'}</p>
      <form onSubmit={submit} className="mt-7 space-y-4">
        <label className="block"><span className="mb-1.5 block text-xs font-bold text-zinc-300">{language === 'bn' ? 'ইমেইল' : 'Email'}</span><div className="flex items-center rounded-xl border border-zinc-700 bg-zinc-950 px-3"><Mail className="h-4 w-4 text-pink-500"/><input type="email" inputMode="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} className="w-full bg-transparent px-3 py-3.5 outline-none" /></div></label>
        <label className="block"><span className="mb-1.5 block text-xs font-bold text-zinc-300">{language === 'bn' ? 'পাসওয়ার্ড' : 'Password'}</span><div className="flex items-center rounded-xl border border-zinc-700 bg-zinc-950 px-3"><LockKeyhole className="h-4 w-4 text-pink-500"/><input type="password" autoComplete="current-password" minLength={6} required value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-transparent px-3 py-3.5 outline-none" /></div></label>
        {authError && <p className="rounded-xl border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">{authError}</p>}
        <button type="submit" disabled={busy} aria-busy={busy} className="w-full rounded-xl bg-pink-600 py-3.5 font-extrabold hover:bg-pink-500 disabled:opacity-60 flex items-center justify-center gap-2">{busy && <Loader2 className="h-4 w-4 animate-spin"/>}{language === 'bn' ? 'লগইন করুন' : 'Sign in'}</button>
      </form>
    </div>
  </div>;
};
