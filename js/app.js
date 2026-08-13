let FB = null;
let firebaseStarted = false;

/* ⚠️ এতদিন যত রিট্রাই/fallback লজিক বানানো হয়েছে (onSnapshot timeout → getDocs,
   getDocs ব্যর্থ হলে আবার চেষ্টা) — এগুলো সবই 'firebase-ready' ইভেন্ট ফায়ার হওয়ার
   পরের ধাপ। কিন্তু যদি Firebase SDK নিজেই (gstatic.com থেকে import) কোনো কারণে
   (নেটওয়ার্ক ব্লক, খুবই ধীর গতি, CDN সমস্যা) কখনো লোড না হয়, 'firebase-ready'
   কখনো fire-ই হয় না — আর নিচের কোনো retry logic-ই কখনো চালু হওয়ার সুযোগ পায় না,
   ব্যবহারকারী স্থায়ীভাবে skeleton দেখতে থাকে কোনো ব্যাখ্যা বা উপায় ছাড়াই।
   এই watchdog সেই সবচেয়ে-প্রথম ধাপটাই পাহারা দেয়। */
setTimeout(() => {
  if (!window.__fb && !firebaseStarted) {
    // ⚠️ আগে এখানে একটা floating লাল banner দেখানো হতো ("সংযোগ স্থাপন করতে
    // সমস্যা হচ্ছে")। এখন সেটা সরিয়ে দেওয়া হলো — grid-এর ভেতরেই retry
    // বাটনসহ error UI দেখানো হয় (ProductStore.handleFirebaseUnavailable →
    // Home.render()-এর error state), তাই আলাদা popup আর দরকার নেই।
    if (typeof ProductStore !== 'undefined') {
      try { ProductStore.handleFirebaseUnavailable(); } catch (e) { console.error(e); }
    }
  }
}, 15000);

/* ⚠️ bug fix (orphan pending order): payment.js শুধু checkout পেজে lazy-load
   হয়, তাই এই check-টা এখানে self-contained রাখা হলো যাতে অ্যাপ যেকোনো পেজ
   দিয়ে শুরু হলেও কাজ করে। localStorage-এ আগের সেশনের অসম্পূর্ণ online payment
   পাওয়া গেলে একটা মনে করিয়ে দেওয়ার ব্যানার দেখায়; ট্যাপ করলেই payment.js
   lazy-load করে modal আবার খোলে। */
async function checkPendingPaymentBanner() {
  let pending;
  try { pending = JSON.parse(localStorage.getItem('golapi_pending_payment') || 'null'); } catch (e) { return; }
  if (!pending || !pending.orderId) return;
  if (Date.now() - (pending.at || 0) > 48 * 60 * 60 * 1000) {
    try { localStorage.removeItem('golapi_pending_payment'); } catch (e) {}
    return;
  }
  if (!FB) return;
  try {
    const snap = await FB.getDoc(FB.doc(FB.db, 'orders', pending.orderId));
    if (!snap.exists() || snap.data().paymentStatus !== 'pending_submission') {
      try { localStorage.removeItem('golapi_pending_payment'); } catch (e) {}
      return;
    }
    const banner = document.createElement('div');
    banner.id = 'pendingPaymentBanner';
    banner.style.cssText = 'position:fixed;bottom:90px;left:16px;right:16px;background:#F0B429;color:#1a1200;padding:12px 14px;border-radius:12px;font-size:13px;z-index:9997;box-shadow:0 8px 24px rgba(0,0,0,.25);display:flex;align-items:center;gap:10px';
    banner.innerHTML = `<span style="flex:1">⏳ অর্ডার #${(pending.orderNo || '').replace(/</g,'')}-এর পেমেন্ট এখনো বাকি আছে</span>
      <button id="pendingPaymentResumeBtn" style="background:#1a1200;color:#fff;border:none;padding:7px 12px;border-radius:8px;font-weight:600;font-size:12px;white-space:nowrap">পেমেন্ট করুন</button>
      <button id="pendingPaymentDismissBtn" style="background:transparent;color:#1a1200;border:none;font-size:16px;padding:0 4px" aria-label="বন্ধ করুন">✕</button>`;
    document.body.appendChild(banner);
    document.getElementById('pendingPaymentDismissBtn').onclick = () => banner.remove();
    document.getElementById('pendingPaymentResumeBtn').onclick = async () => {
      banner.remove();
      await window.loadScriptOnce('./js/payment.js').catch(() => {});
      if (typeof PaymentGateway !== 'undefined') {
        PaymentGateway.reopenModal(pending.method, pending.amount, pending.orderId, pending.zone);
      }
    };
  } catch (e) { console.error('Pending payment check failed:', e.message); }
}

function startFirebaseFeatures() {
  if (firebaseStarted || !window.__fb) return;

  firebaseStarted = true;
  FB = window.__fb;
  window.FB = FB;

  /*
   * Auth-এর কোনো সমস্যা হলেও product loading বন্ধ হবে না।
   */
  try {
    Auth.init();
  } catch (error) {
    console.error('Auth initialization failed:', error);
  }

  /*
   * Product sync আলাদাভাবে অবশ্যই শুরু হবে।
   */
  try {
    ProductStore.startLiveSync();
  } catch (error) {
    console.error('Product sync initialization failed:', error);
  }

  /* আগের সেশনে payment modal বাতিল/ব্রাউজার বন্ধ হওয়ার কারণে অসম্পূর্ণ থেকে
     যাওয়া online payment থাকলে মনে করিয়ে দেয় (bug fix: orphan pending order)।
     ⚠️ payment.js শুধু checkout পেজেই লোড হয় (lazy), তাই এখানে সরাসরি
     PaymentGateway ব্যবহার না করে শুধু check + banner এখানেই self-contained
     রাখা হলো — customer ব্যানারে ট্যাপ করলে তখনই payment.js lazy-load হবে। */
  try { checkPendingPaymentBanner(); } catch (error) { console.error('Pending payment check failed:', error); }
}

window.addEventListener(
  'firebase-ready',
  startFirebaseFeatures
);

/*
 * Firebase module আগে ready হয়ে গেলে সরাসরি শুরু করবে।
 */
if (window.__fb) {
  startFirebaseFeatures();
}
var currentLang = I18n.language();
function applyLang(){ currentLang = I18n.apply(document); }
function toggleLang(){ currentLang = I18n.toggle(); }
applyLang();

/* ---------- Cart abandonment reminder (client-side, no backend needed) ---------- */
function checkCartAbandonment(){
  try{
    const items = JSON.parse(localStorage.getItem('golapi_cart')||'{}');
    const count = Object.values(items).reduce((a,b)=>a+b,0);
    if(count<=0) return;
    const updatedAt = parseInt(localStorage.getItem('golapi_cart_time')||'0',10);
    if(!updatedAt) return;
    const ageMs = Date.now()-updatedAt;
    const oneHour = 60*60*1000;
    if(ageMs < oneHour) return;
    const today = new Date().toDateString();
    const lastShown = localStorage.getItem('golapi_cart_reminder_date');
    if(lastShown===today) return;
    localStorage.setItem('golapi_cart_reminder_date', today);
    setTimeout(()=>{
      toast(`🛍️ আপনার কার্টে ${count} টি পণ্য রয়ে গেছে — এখনই চেকআউট করে ফেলুন!`,'success');
    }, 1800);
  }catch(e){}
}

function initApp(){
  // ⚠️ আগে ProductStore.loadFromCache() শুধু startLiveSync()-এর ভেতরে চলতো, যেটা
  // Firebase ready হওয়ার আগে কখনো ডাকা হতো না। ফলে ব্রাউজারে valid cache থাকা
  // সত্ত্বেও Firebase load দেরি/ব্যর্থ হলে সেই cache দেখানো হতো না। এখন Firebase-এর
  // অপেক্ষা ছাড়াই, Router.go('home') কল হওয়ার আগেই cache load করা হচ্ছে —
  // Home.render() প্রথমবার চলার সময়ই cached পণ্য (থাকলে) দেখাবে।
  if (typeof ProductStore !== 'undefined' && !ProductStore.loaded) {
    ProductStore.loadFromCache();
  }

  const path=window.location.pathname.toLowerCase();
  const role=new URLSearchParams(window.location.search).get('role');
  const hash=window.location.hash.replace('#','');

  if(role==='driver'){
    Router.go('driver',{}, {skipHistory:true});
  } else if(role==='zone-manager'||role==='manager'){
    Router.go('zone-manager',{}, {skipHistory:true});
  } else if(hash && (document.getElementById('page-'+hash) || (window.__lazyPages||[]).includes(hash))){
    Router.go(hash,{}, {skipHistory:true});
  } else if(!Router.navigate(path)) {
    Router.go('home',{}, {skipHistory:true});
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      // ⚠️ আগে 'load' event-এই সাথে সাথে Service Worker install শুরু হতো, যেটা
      // ঠিক তখনই চলা Firebase SDK/Firestore network request-গুলোর সাথে bandwidth
      // নিয়ে প্রতিযোগিতা করতো (দুর্বল নেটওয়ার্কে product loading আরও দেরি হতো)।
      // এখন সামান্য (১.৫ সেকেন্ড) দেরি করে registration শুরু হয়, যাতে product
      // ডেটা আগে network priority পায়।
      await new Promise(r => setTimeout(r, 1500));
      try {
        // ═══════════════════════════════════════════════════════════
        // SELF-HEALING: এই ফিক্সের আগে যেসব ভিজিটরের ব্রাউজারে পুরনো/আটকে
        // থাকা service worker বা cache রয়ে গেছে, তাদের জন্য automatic
        // পরিষ্কার — Settings-এ গিয়ে ম্যানুয়ালি কিছু করতে হবে না। এটা
        // localStorage-এ একটা version marker রাখে, marker না মিললে
        // (মানে এই ব্রাউজার পুরনো কোনো ভার্সন থেকে আসছে) সব service worker
        // registration ও cache মুছে একবার reload করে, তারপর normal flow।
        const HEAL_VERSION = 'v5-access-checkout-atomic';
        const storedVersion = localStorage.getItem('golapi_heal_version');
        // ⚠️ আগে একদম নতুন ব্রাউজারেও (যেখানে পুরনো cache/SW কিছুই নেই, তাই
        // পরিষ্কার করার কিছু নেই) এই marker না থাকার কারণে unregister+cache
        // delete+reload চলতো — নতুন কাস্টমারের জন্য শুধু শুধু আরেকটা reload
        // ও দ্বিতীয়বার skeleton দেখা লাগতো। এখন আগে থেকে কোনো service worker
        // registration আদৌ আছে কিনা দেখে নেওয়া হয় — না থাকলে সরাসরি marker
        // সেট করে normal flow-এ চলে যাওয়া হয়, অকারণ reload ছাড়াই।
        const existingRegs = await navigator.serviceWorker.getRegistrations();
        if (storedVersion !== HEAL_VERSION && !sessionStorage.getItem('golapi_healing_done')) {
          if (existingRegs.length === 0) {
            localStorage.setItem('golapi_heal_version', HEAL_VERSION);
          } else {
            sessionStorage.setItem('golapi_healing_done', '1');
            for (const reg of existingRegs) { await reg.unregister(); }
            if (window.caches) {
              const keys = await caches.keys();
              await Promise.all(keys.map(k => caches.delete(k)));
            }
            localStorage.setItem('golapi_heal_version', HEAL_VERSION);
            window.location.reload();
            return; // reload হয়ে যাচ্ছে, নিচের normal registration আর দরকার নেই এই পাসে
          }
        }

        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none'
        });

        // ⚠️ আগে সেশনে একবারই update() চলতো (sessionStorage গেট দিয়ে) — ফলে
        // ট্যাব বন্ধ না করে রিফ্রেশ করলে নতুন ভার্সন থাকলেও সার্ভারে চেকই
        // হতো না, ব্যবহারকারীকে বারবার ম্যানুয়ালি ট্যাব বন্ধ/ক্যাশ ক্লিয়ার
        // করতে হতো। এখন প্রতিটা পেজ লোডেই update() চলবে (হালকা একটা মাত্র
        // HEAD-জাতীয় রিকোয়েস্ট, বড় কোনো bandwidth খরচ না) যাতে নতুন ভার্সন
        // দ্রুত ধরা পড়ে।
        await registration.update();

        // নতুন worker control নিলে reload করে latest files দেখানো হয় — কিন্তু
        // কাস্টমার যদি সেই মুহূর্তে checkout/cart-এ থাকে (মাঝপথে অর্ডার/পেমেন্ট),
        // তাহলে reload disrupt করবে বলে সেটা এড়ানো হচ্ছে; home/listing/product
        // browsing-এর সময় হলে স্বাভাবিকভাবে reload হবে।
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (sessionStorage.getItem('golapi_sw_reloaded') === '1') return;
          const disruptivePages = ['checkout', 'cart'];
          if (typeof Router !== 'undefined' && disruptivePages.includes(Router.current)) {
            devWarn('SW update হয়েছে, কিন্তু checkout/cart-এ থাকায় reload পিছিয়ে দেওয়া হলো');
            return;
          }
          sessionStorage.setItem('golapi_sw_reloaded', '1');
          window.location.reload();
        });
      } catch (error) {
        console.warn('Service worker registration failed:', error);
      }
    });
  }

  checkCartAbandonment();
}
document.addEventListener('pages-ready',initApp);

/* ⚠️ iOS/Android উভয় ব্রাউজারের back-forward cache (bfcache) — ব্যাক জেসচার/সোয়াইপ
   করলে ব্রাউজার মাঝে মাঝে আগের "freeze" করা পেজ অবস্থা (স্ক্রিপ্ট আবার না চালিয়েই)
   ফিরিয়ে আনে। যদি সেই freeze হওয়ার মুহূর্তে পেজ এখনো লোডিং/skeleton অবস্থায়
   ছিল, bfcache থেকে ফিরে এসেও সেই একই আটকে থাকা অবস্থাই দেখা যায় — যদিও
   আসল কোড ঠিকই আছে। এটা ধরে, দরকার হলে একবার fresh reload করানো হয়। */
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    if (typeof ProductStore !== 'undefined' && !ProductStore.loaded) {
      window.location.reload();
    }
  }
});
