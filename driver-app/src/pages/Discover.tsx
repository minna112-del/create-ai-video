import React, { useEffect, useState } from 'react';
import { Calendar, CheckCircle2, Loader2, Tag } from 'lucide-react';
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { useDriver } from '../context/DriverContext';
import { db } from '../lib/firebase';

interface Opportunity {
  id: string;
  titleBn?: string; titleEn?: string; rewardBn?: string; rewardEn?: string;
  scheduleBn?: string; scheduleEn?: string; tagBn?: string; tagEn?: string;
  active?: boolean; startsAt?: unknown; endsAt?: unknown;
}

export const Discover: React.FC = () => {
  const { language, currentUser, driverId } = useDriver();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => onSnapshot(collection(db, 'driverOpportunities'), snapshot => {
    const rows = snapshot.docs.map(item => ({ id: item.id, ...item.data() } as Opportunity));
    setOpportunities(rows.filter(item => item.active !== false));
    setLoading(false);
  }, () => { setOpportunities([]); setLoading(false); }), []);

  useEffect(() => {
    if (!driverId) return;
    return onSnapshot(collection(db, 'drivers', driverId, 'opportunityOptIns'), snapshot => {
      setSelected(new Set(snapshot.docs.map(item => item.id)));
    });
  }, [driverId]);

  const optIn = async (opportunity: Opportunity) => {
    if (!currentUser || !driverId || selected.has(opportunity.id)) return;
    setSavingId(opportunity.id);
    try {
      await setDoc(doc(db, 'drivers', driverId, 'opportunityOptIns', opportunity.id), {
        opportunityId: opportunity.id, driverId, driverUid: currentUser.uid, status: 'active', createdAt: serverTimestamp()
      });
    } finally { setSavingId(null); }
  };

  return <div className="space-y-6 pb-24 md:pb-8 animate-in fade-in duration-300">
    <div className="border-b border-zinc-800/80 pb-3">
      <h2 className="text-2xl font-black text-white">{language === 'bn' ? 'সক্রিয় সুযোগ' : 'Active Opportunities'}</h2>
      <p className="text-xs text-zinc-400 mt-0.5">{language === 'bn' ? 'অপারেশন টিম প্রকাশিত লাইভ বোনাস ও ডেলিভারি প্রোগ্রাম' : 'Live bonus and delivery programs published by Operations'}</p>
    </div>

    {loading ? <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-pink-500" /></div> : opportunities.length === 0 ? (
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-12 text-center">
        <Calendar className="w-12 h-12 text-zinc-600 mx-auto" />
        <h3 className="mt-3 text-lg font-black text-white">{language === 'bn' ? 'এখন কোনো সক্রিয় সুযোগ নেই' : 'No active opportunities'}</h3>
        <p className="mt-1 text-xs text-zinc-400">{language === 'bn' ? 'নতুন প্রোগ্রাম প্রকাশ হলে এখানে স্বয়ংক্রিয়ভাবে দেখা যাবে।' : 'New programs will appear here automatically when published.'}</p>
      </div>
    ) : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {opportunities.map(opportunity => {
        const joined = selected.has(opportunity.id);
        return <article key={opportunity.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-pink-950 border border-pink-600/40 text-pink-400 text-[10px] font-bold"><Tag className="w-3 h-3" />{language === 'bn' ? opportunity.tagBn || 'সুযোগ' : opportunity.tagEn || 'Opportunity'}</span>
              <span className="text-[11px] text-zinc-400">{language === 'bn' ? opportunity.scheduleBn : opportunity.scheduleEn}</span>
            </div>
            <h3 className="font-extrabold text-white text-base">{language === 'bn' ? opportunity.titleBn : opportunity.titleEn || opportunity.titleBn}</h3>
            <p className="text-pink-400 font-black text-sm">{language === 'bn' ? opportunity.rewardBn : opportunity.rewardEn || opportunity.rewardBn}</p>
          </div>
          <button type="button" onClick={() => void optIn(opportunity)} disabled={joined || savingId === opportunity.id} className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 ${joined ? 'bg-emerald-950 border border-emerald-500/40 text-emerald-300' : 'bg-pink-600 hover:bg-pink-500 text-white disabled:opacity-60'}`}>
            {savingId === opportunity.id ? <Loader2 className="w-4 h-4 animate-spin" /> : joined ? <CheckCircle2 className="w-4 h-4" /> : null}
            {joined ? (language === 'bn' ? 'যোগ দেওয়া হয়েছে' : 'Joined') : (language === 'bn' ? 'যোগ দিন' : 'Opt In')}
          </button>
        </article>;
      })}
    </div>}
  </div>;
};
