import { useEffect, useRef } from 'react';

/**
 * MT Studio: ড্রাইভার সাধারণত এই অ্যাপ চালু রেখেই গাড়ি চালান/ডেলিভারি করেন —
 * তাই স্ক্রিন নিজে থেকে বন্ধ হয়ে যাওয়া (screen timeout) খুবই বিরক্তিকর।
 * এই hook Screen Wake Lock API ব্যবহার করে অ্যাপ খোলা থাকা পর্যন্ত ডিসপ্লে
 * সচল রাখে। ব্রাউজার/OS নিজে থেকেই ট্যাব ব্যাকগ্রাউন্ডে গেলে wake lock ছেড়ে
 * দেয় (স্পেসিফিকেশন অনুযায়ী) — visibilitychange listener দিয়ে সামনে ফিরলে
 * আবার রিকোয়েস্ট করা হয়, তাই ম্যানুয়াল কিছু করা লাগে না।
 *
 * এই hook সরাসরি navigator.wakeLock ব্যবহার করে বলে Capacitor-এর ভেতরে
 * (native WebView) এবং সাধারণ মোবাইল ব্রাউজারে — দুই জায়গাতেই কাজ করে,
 * কোনো আলাদা native plugin ছাড়াই।
 */
export function useWakeLock(enabled: boolean = true): void {
  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!('wakeLock' in navigator)) {
      console.warn('[useWakeLock] এই ব্রাউজারে Screen Wake Lock সমর্থিত নয়');
      return;
    }

    let cancelled = false;

    async function requestLock() {
      if (document.visibilityState !== 'visible') return;
      if (wakeLockRef.current && !wakeLockRef.current.released) return;
      try {
        const lock = await (navigator as any).wakeLock.request('screen');
        if (cancelled) {
          // এই সময়ের মধ্যে component unmount হয়ে গেলে সাথে সাথেই ছেড়ে দাও
          lock.release().catch(() => {});
          return;
        }
        wakeLockRef.current = lock;
        lock.addEventListener('release', () => {
          wakeLockRef.current = null;
        }, { once: true });
      } catch (error) {
        console.warn('[useWakeLock] request ব্যর্থ:', (error as Error)?.message);
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') requestLock();
    }

    requestLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current && !wakeLockRef.current.released) {
        wakeLockRef.current.release().catch(() => {});
      }
      wakeLockRef.current = null;
    };
  }, [enabled]);
}
