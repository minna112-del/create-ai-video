/* utils.js — helpers, constants, toast system */
const isDev = location.hostname==='localhost' || location.hostname==='127.0.0.1';
function devWarn(...a){ if(isDev) console.warn(...a); }

/* বাংলা কিবোর্ড থেকে টাইপ করা বাংলা সংখ্যা (০-৯) ইংরেজি সংখ্যায় (0-9) রূপান্তর করে।
   ⚠️ HTML-এর <input type="number"> শুধু ASCII 0-9 গ্রহণ করে — বাংলা সংখ্যা টাইপ করলে
   ব্রাউজার সেটা invalid ধরে বাদ দিয়ে দেয়, ফলে অ্যাডমিনকে বাধ্য হয়ে কিবোর্ড ইংরেজি
   মোডে বদলাতে হতো শুধু দাম/স্টক লেখার জন্য। এই ফাংশন input থেকে টাইপ করা মাত্রই
   বাংলা সংখ্যাকে ইংরেজিতে বদলে দেয়, যাতে বাংলা কিবোর্ড থেকেও সরাসরি লেখা যায়। */
function bnDigitsToEn(str){
  if(str == null) return str;
  const map = {'০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9','．':'.','،':','};
  return String(str).replace(/[০-৯．،]/g, ch => map[ch] || ch);
}
/* একটা numeric input-এ লাইভ বাংলা→ইংরেজি সংখ্যা রূপান্তর বসিয়ে দেয়, cursor position ঠিক রেখে। */
function normalizeDigitInput(el){
  if(!el) return;
  const before = el.value;
  const converted = bnDigitsToEn(before);
  if(converted !== before){
    const pos = el.selectionStart;
    el.value = converted;
    try{ el.setSelectionRange(pos, pos); }catch(e){}
  }
}

/* ⚠️ Security audit finding: customer-controllable ডেটা (নাম, ঠিকানা, ফোন, মেসেজ ইত্যাদি)
   admin.js-এর অনেক জায়গায় innerHTML দিয়ে সরাসরি বসানো হতো, escape ছাড়াই — কেউ যদি
   checkout ফর্মে নামের জায়গায় HTML/script ঢুকিয়ে দেয়, admin panel-এ সেটা execute হয়ে
   যেতে পারতো (stored XSS)। এই ফাংশনটা ব্যবহার করে সব user-input এখন escape করা হয়। */
function esc(str){
  if(str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* URL → protocol allowlist + escape — কোনো প্রোডাক্ট/রিভিউ ছবির URL (Firestore
   থেকে আসা, তাই "external data") সরাসরি src="${...}"-এ বসানোর আগে এটা ব্যবহার করা
   উচিত। শুধু http(s)/relative path/data:image allow করে, javascript:/অন্য যেকোনো
   protocol বাতিল করে দেয় (fallback ছবি দেখায়), আর quote-breakout আটকাতে esc() করে। */
const GOLAPI_IMG_PLACEHOLDER = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="%23FBF7F4"/><text x="200" y="210" font-size="28" text-anchor="middle" fill="%23C9BEB8">Golapi Shop</text></svg>');
function safeImgSrc(url, fallback=GOLAPI_IMG_PLACEHOLDER){
  if(!url) return fallback;
  const trimmed = String(url).trim();
  const allowedPattern = /^(https?:\/\/|\.?\/|data:image\/)/i;
  if(!allowedPattern.test(trimmed)) return fallback;
  return esc(trimmed);
}

function toast(msg,type='info'){
  const wrap = document.getElementById('toastWrap');
  if(!wrap) return;
  const t = document.createElement('div');
  t.className = 'toast ' + (type==='error'?'err':type==='success'?'ok':'');
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(()=>t.remove(), 3200);
}

const CATEGORIES = [
  {id:'medicine',label:'ঔষধ',labelEn:'Medicine',icon:'💊'},
  {id:'grocery',label:'মুদি বাজার',labelEn:'Grocery',icon:'🛒'},
  {id:'rice_pulses',label:'চাল-ডাল',labelEn:'Rice & Pulses',icon:'🌾'},
  {id:'spices',label:'মসলা',labelEn:'Spices',icon:'🌶️'},
  {id:'edible_oil',label:'ভোজ্য তেল',labelEn:'Edible Oil',icon:'🫙'},
  {id:'vegetables',label:'শাকসবজি ও ফল',labelEn:'Vegetables & Fruits',icon:'🥦'},
  {id:'fish_meat',label:'মাছ-মাংস',labelEn:'Fish & Meat',icon:'🐟'},
  {id:'dairy_bakery',label:'দুধ ও বেকারি',labelEn:'Dairy & Bakery',icon:'🥛'},
  {id:'frozen_food',label:'ফ্রোজেন ফুড',labelEn:'Frozen Food',icon:'🧊'},
  {id:'snacks',label:'নাস্তা ও চিপস',labelEn:'Snacks & Chips',icon:'🍿'},
  {id:'beverages',label:'পানীয় ও জুস',labelEn:'Beverages & Juice',icon:'🥤'},
  {id:'confectionery',label:'কনফেকশনারি',labelEn:'Confectionery',icon:'🍬'},
  {id:'stationery',label:'স্টেশনারি',labelEn:'Stationery',icon:'📒'},
  {id:'gas',label:'গ্যাস সিলিন্ডার',labelEn:'Gas Cylinder',icon:'🔥'},
  {id:'mobile',label:'মোবাইল এক্সেসরিজ',labelEn:'Mobile Accessories',icon:'📱'},
  {id:'electronics',label:'ইলেকট্রনিক',labelEn:'Electronics',icon:'🔌'},
  {id:'watch',label:'ঘড়ি ও ব্যাটারি',labelEn:'Watch & Battery',icon:'⌚'},
  {id:'cosmetics',label:'কসমেটিকস',labelEn:'Cosmetics',icon:'💄'},
  {id:'personal_care',label:'পার্সোনাল কেয়ার',labelEn:'Personal Care',icon:'🧴'},
  {id:'clothing',label:'জামা-কাপড়',labelEn:'Clothing',icon:'👕'},
  {id:'footwear',label:'জুতা',labelEn:'Footwear',icon:'👞'},
  {id:'jewelry',label:'গহনা ও এক্সেসরিজ',labelEn:'Jewelry & Accessories',icon:'💍'},
  {id:'furniture',label:'ফার্নিচার',labelEn:'Furniture',icon:'🪑'},
  {id:'kitchen_tools',label:'রান্নাঘরের সরঞ্জাম',labelEn:'Kitchen Tools',icon:'🍳'},
  {id:'toys',label:'খেলনা',labelEn:'Toys',icon:'🧸'},
  {id:'baby_care',label:'শিশু যত্ন',labelEn:'Baby Care',icon:'🍼'},
  {id:'home_care',label:'গৃহস্থালি ও পরিষ্কার-পরিচ্ছন্নতা',labelEn:'Home Care & Cleaning',icon:'🧹'},
  {id:'pet_care',label:'পোষা প্রাণীর যত্ন',labelEn:'Pet Care',icon:'🐾'},
  {id:'sports_fitness',label:'খেলাধুলা ও ফিটনেস',labelEn:'Sports & Fitness',icon:'🏋️'},
  {id:'books_gifts',label:'বই ও উপহার',labelEn:'Books & Gifts',icon:'📚'},
  {id:'religious',label:'ধর্মীয় সামগ্রী',labelEn:'Religious Items',icon:'🕌'},
  {id:'automobile',label:'বাইক ও গাড়ির এক্সেসরিজ',labelEn:'Bike & Auto Accessories',icon:'🏍️'},
  {id:'garden',label:'বাগান ও কৃষি',labelEn:'Garden & Agriculture',icon:'🌱'},
  {id:'others',label:'অন্যান্য',labelEn:'Others',icon:'🎁'}
];

const EMERGENCY_CATEGORIES = ['medicine','gas'];

const AREA_ZONES = {
  noakhali_sadar: ['চরমটুয়া','দাদপুর','নোয়ান্নই','কাদির হানিফ','বিনোদপুর','নোয়াখালী','ধর্মপুর','এওজবালিয়া','কালা দরাপ','অশ্বদিয়া','নেয়াজপুর','আন্ডারচর'],
  begumganj: ['আমান উল্যাপুর','গোপালপুর','জিরতলী','আলাইয়ারপুর','ছয়ানী','রাজগঞ্জ','একলাশপুর','বেগমগঞ্জ','মিরওয়ারিশপুর','নরোত্তমপুর','দূর্গাপুর','কুতুবপুর','রসুলপুর','হাজিপুর','শরীফপুর','কাদিরপুর']
};

const BRANCH_INFO = {
  noakhali_sadar:{label:'নোয়াখালী সদর',address:'মাইজদী বাজার, সদর, নোয়াখালী',managerName:'রিমন',managerPhone:'+880 1627-010060',bkashNumber:'01627010060',nagadNumber:'01627010060',lat:22.8710,lng:91.0996},
  begumganj:{label:'বেগমগঞ্জ',address:'চৌরাস্তা, বেগমগঞ্জ, নোয়াখালী',managerName:'সৃজন',managerPhone:'+880 1310-006959',bkashNumber:'01612057371',nagadNumber:'01310006959',lat:22.9412,lng:91.1119}
};

const AREA_LABELS = {noakhali_sadar:BRANCH_INFO.noakhali_sadar.label, begumganj:BRANCH_INFO.begumganj.label};

/* ============================================================
   DELIVERY ZONES — প্রতিটা শাখার নিচে Zone A/B/C (বৃত্তাকার — কেন্দ্র + radius)
   Admin Panel থেকে edit হয় ('setting'/'delivery_zones' ডকুমেন্টে সেভ থাকে),
   এখানে যেগুলো আছে সেগুলো ডিফল্ট (কখনো Firestore-এ কিছু না থাকলে এটাই ব্যবহার হবে)।
   ============================================================ */
const DELIVERY_ZONES = {
  noakhali_sadar: [
    { id:'sadar_a', label:'Zone A — কাছাকাছি এলাকা', radiusKm:3, fee:30 },
    { id:'sadar_b', label:'Zone B — মাঝারি দূরত্ব',   radiusKm:7, fee:50 },
    { id:'sadar_c', label:'Zone C — দূরবর্তী এলাকা',  radiusKm:12, fee:80 }
  ],
  begumganj: [
    { id:'begum_a', label:'Zone A — কাছাকাছি এলাকা', radiusKm:3, fee:30 },
    { id:'begum_b', label:'Zone B — মাঝারি দূরত্ব',   radiusKm:7, fee:50 },
    { id:'begum_c', label:'Zone C — দূরবর্তী এলাকা',  radiusKm:12, fee:80 }
  ]
};
// ⚠️ আগে এটা সরাসরি "if(!FB) return;" (bare variable, যেটা app.js-এ পরে declare হয়) আর
// সাথে সাথেই "loadLiveDeliveryZones();" কল হতো — তখন FB কোথাও declare-ই হয়নি, তাই
// "Can't find variable: FB" ReferenceError হতো। এখন window.__fb ব্যবহার করা হচ্ছে
// (যেটা সবসময় নিরাপদ, undefined হলেও error না দিয়ে falsy রিটার্ন করে) আর firebase-ready
// event না আসা পর্যন্ত কলই করা হয় না।
async function loadLiveDeliveryZones(){
  const FB = window.__fb;
  if(!FB) return;
  try{
    const snap = await FB.getDoc(FB.doc(FB.db,'setting','delivery_zones'));
    if(snap.exists() && snap.data().zones){
      Object.assign(DELIVERY_ZONES, snap.data().zones);
    }
  }catch(e){ devWarn('delivery zones load failed', e.message); }
}
if(window.__fb){ loadLiveDeliveryZones(); }
else { window.addEventListener('firebase-ready', loadLiveDeliveryZones); }

/* ============================================================
   BRANCH_INFO — Owner Dashboard-এর "🏢 শাখা ব্যবস্থাপনা" থেকে নতুন শাখা
   যোগ/এডিট করা হলে এখানে সাথে সাথে যোগ হয় ('setting'/'branches' ডকুমেন্টে
   সেভ থাকে)। উপরের হার্ডকোডেড মান শুধু ডিফল্ট/ফলব্যাক — Firestore-এ কিছু
   না থাকলে বা লোড ব্যর্থ হলে সাইট তখনও এই ২টা শাখা দিয়ে চলবে, ভাঙবে না।
   ============================================================ */
async function loadLiveBranches(){
  const FB = window.__fb;
  if(!FB) return;
  try{
    const snap = await FB.getDoc(FB.doc(FB.db,'setting','branches'));
    if(snap.exists() && snap.data().branches){
      Object.assign(BRANCH_INFO, snap.data().branches);
      Object.keys(BRANCH_INFO).forEach(id=>{ AREA_LABELS[id] = BRANCH_INFO[id].label; });
      document.dispatchEvent(new Event('branches-updated'));
    }
  }catch(e){ devWarn('branches load failed', e.message); }
}
if(window.__fb){ loadLiveBranches(); }
else { window.addEventListener('firebase-ready', loadLiveBranches); }

/* একটা GPS পয়েন্ট কোন zone-এ পড়ে সেটা বের করে — সবচেয়ে ছোট radius-এর zone প্রাধান্য পায়
   (যেমন Zone A ও Zone B দুটোর মধ্যেই পড়লে, বেশি নির্দিষ্ট/কাছের Zone A ধরা হয়) */
function findDeliveryZone(branchId, lat, lng){
  const branch = BRANCH_INFO[branchId];
  const zones = DELIVERY_ZONES[branchId];
  if(!branch || !zones) return null;
  const distKm = haversineKm(lat, lng, branch.lat, branch.lng);
  const matched = zones
    .filter(z => distKm <= z.radiusKm)
    .sort((a,b) => a.radiusKm - b.radiusKm)[0];
  return matched ? { ...matched, distanceKm: distKm, branchId } : null;
}

const ORDER_STATUS = {
  pending:{label:'পেন্ডিং',cls:'pending'}, confirmed:{label:'কনফার্মড',cls:'confirmed'},
  packed:{label:'প্যাকিং সম্পন্ন',cls:'confirmed'}, assigned:{label:'ড্রাইভার অ্যাসাইনড',cls:'confirmed'},
  picked_up:{label:'পিকআপ হয়েছে',cls:'confirmed'}, in_transit:{label:'ডেলিভারির পথে (লাইভ)',cls:'confirmed'},
  delivered:{label:'ডেলিভারি সম্পন্ন',cls:'delivered'}, cancelled:{label:'বাতিল',cls:'cancelled'}
};

const MED_LIST = [
  {icon:'🩺',name:'সহকারী অধ্যাপক ডাঃ আনোয়ার আহমেদ',spec:'মেডিসিন, গ্যাস্ট্রোলিভার, টিবি, এলার্জি, ডায়াবেটিস ও বক্ষব্যাধি বিশেষজ্ঞ',sched:'প্রতি শুক্রবার সকাল ৯টা - বিকাল ৪টা',addr:'নিউ জেনারেল ডায়াগনস্টিক এন্ড ডক্টরস চেম্বার, হাসপাতাল রোড, মাইজদী কোর্ট',serial:'01893-727666, 01897-692000'},
  {icon:'🩺',name:'ডাঃ আশিক আল মাহমুদ',spec:'মেডিসিন, ডায়াবেটিস, হরমোন, মাথাব্যথা ও আর্থাইটিস বিশেষজ্ঞ',sched:'প্রতি বৃহস্পতিবার সকাল ৯টা - সন্ধ্যা ৬টা',addr:'নিউ জেনারেল ডায়াগনস্টিক এন্ড ডক্টরস চেম্বার, হাসপাতাল রোড, মাইজদী কোর্ট',serial:'01893-727666, 01897-692000'},
  {icon:'🩺',name:'ডাঃ মোঃ মমিন উল্যাহ্',spec:'মেডিসিন, বাত-ব্যথা, উচ্চ রক্তচাপ, স্নায়ুরোগ, বক্ষব্যাধি ও ডায়াবেটিস বিশেষজ্ঞ',sched:'প্রতি শুক্রবার সকাল ৯টা - বিকাল ৪টা',addr:'নিউ জেনারেল ডায়াগনস্টিক এন্ড ডক্টরস চেম্বার, হাসপাতাল রোড, মাইজদী কোর্ট',serial:'01893-727666, 01897-692000'},
  {icon:'❤️',name:'ডাঃ মোঃ মীর হোসেন ভূঞাঁ (মিশন)',spec:'মেডিসিন, হৃদরোগ ও বাতজ্বর বিশেষজ্ঞ',sched:'প্রতি শুক্রবার সকাল ৯টা - বিকাল ৪টা',addr:'নিউ জেনারেল ডায়াগনস্টিক এন্ড ডক্টরস চেম্বার, হাসপাতাল রোড, মাইজদী কোর্ট',serial:'01893-727666, 01897-692000'},
  {icon:'👂',name:'সহযোগী অধ্যাপক ডাঃ কিশোর কুমার হালদার',spec:'নাক, কান, গলা রোগ বিশেষজ্ঞ ও হেড-নেক সার্জন',sched:'প্রতি শনিবার সকাল ১১টা - দুপুর ১টা',addr:'নিউ জেনারেল ডায়াগনস্টিক এন্ড ডক্টরস চেম্বার, হাসপাতাল রোড, মাইজদী কোর্ট',serial:'01893-727666, 01897-692000'},
  {icon:'🩺',name:'ডাঃ মুহাম্মদ আবদুল ওয়াজেদ',spec:'মেডিসিন, বক্ষব্যাধি, হৃদরোগ, বাত-ব্যথা, কোমর ব্যথা ও ডায়াবেটিস বিশেষজ্ঞ',sched:'প্রতিদিন দুপুর ২টা - রাত ৮টা (শুক্রবার বন্ধ)',addr:'নিউ জেনারেল ডায়াগনস্টিক এন্ড ডক্টরস চেম্বার, হাসপাতাল রোড, মাইজদী কোর্ট',serial:'01893-727666, 01897-692000'},
  {icon:'🧒',name:'ডাঃ মোঃ মিজানুর রহমান',spec:'নবজাতক ও শিশু স্বাস্থ্য বিশেষজ্ঞ',sched:'প্রতিদিন সকাল ৮টা - দুপুর ১২টা ও বিকাল ৪টা - রাত ৮টা',addr:'নিউ জেনারেল ডায়াগনস্টিক এন্ড ডক্টরস চেম্বার, হাসপাতাল রোড, মাইজদী কোর্ট',serial:'01893-727666, 01897-692000'},
  {icon:'👩‍⚕️',name:'ডাঃ খাদিজা ফালগুনি',spec:'প্রসূতি, গাইনী, বন্ধ্যাত্ব ও স্ত্রী রোগ বিশেষজ্ঞ, সার্জন',sched:'প্রতিদিন সকাল ১০টা - রাত ৮টা',addr:'নিউ জেনারেল ডায়াগনস্টিক এন্ড ডক্টরস চেম্বার, হাসপাতাল রোড, মাইজদী কোর্ট',serial:'01893-727666, 01897-692000'},
  {icon:'🩺',name:'ডাঃ দেব জ্যোতি ঘোষ',spec:'মেডিসিন, নিউরো মেডিসিন, হৃদরোগ, বক্ষব্যাধি, বাত-ব্যথা, গ্যাস্ট্রোলিভার ও ডায়াবেটিস বিশেষজ্ঞ',sched:'প্রতিদিন সকাল ১০টা - রাত ৮টা (রবিবার বন্ধ)',addr:'নিউ জেনারেল ডায়াগনস্টিক এন্ড ডক্টরস চেম্বার, হাসপাতাল রোড, মাইজদী কোর্ট',serial:'01893-727666, 01897-692000'},
  {icon:'🔪',name:'ডাঃ মোঃ কামরুজ্জামান আজাদ',spec:'জেনারেল সার্জারী ও ল্যাপারোস্কপিক সার্জারী বিশেষজ্ঞ',sched:'প্রতি শনিবার থেকে বুধবার',addr:'নিউ জেনারেল ডায়াগনস্টিক এন্ড ডক্টরস চেম্বার, হাসপাতাল রোড, মাইজদী কোর্ট',serial:'01893-727666, 01897-692000'},
  {icon:'🧴',name:'ডাঃ ওমর ফারুক শাহজালাল',spec:'চর্ম, যৌন ও এলার্জি রোগ চিকিৎসক',sched:'বৃহস্পতি-মঙ্গলবার সকাল ১০টা-দুপুর ২টা, বিকাল ৪টা-রাত ৮টা',addr:'নিউ জেনারেল ডায়াগনস্টিক এন্ড ডক্টরস চেম্বার, হাসপাতাল রোড, মাইজদী কোর্ট',serial:'01893-727666, 01897-692000'},
  {icon:'🔪',name:'ডাঃ মোঃ নাজমুল ইসলাম',spec:'সার্জারী বিশেষজ্ঞ, জেনারেল এন্ড ল্যাপারোস্কপিক সার্জন',sched:'প্রতিদিন',addr:'নিউ জেনারেল ডায়াগনস্টিক এন্ড ডক্টরস চেম্বার, হাসপাতাল রোড, মাইজদী কোর্ট',serial:'01893-727666, 01897-692000'},
  {icon:'🩺',name:'ডাঃ এম. এস. আরেফিন',spec:'মেডিসিন, নিউরোমেডিসিন, হৃদরোগ, বক্ষব্যাধি, বাত ব্যথা, কোমর ব্যথা, প্যারালাইসিস, গ্যাস্ট্রোলিভার ও ডায়াবেটিস বিশেষজ্ঞ',sched:'প্রতিদিন সকাল ১০টা - রাত ৯টা (শুক্রবার বন্ধ)',addr:'নিউ জেনারেল ডায়াগনস্টিক এন্ড ডক্টরস চেম্বার, হাসপাতাল রোড, মাইজদী কোর্ট',serial:'01893-727666, 01897-692000'},
  {icon:'🩺',name:'ডাঃ মোঃ গোলাম হায়দার',spec:'মেডিসিন, মা ও শিশু স্বাস্থ্য বিশেষজ্ঞ',sched:'সিরিয়াল অনুযায়ী',addr:'মিয়া ফার্মেসি, হাসপাতাল রোড',serial:'01711-196139'},
  {icon:'👩‍⚕️',name:'ডাঃ নীলিমা ইয়াসমিন',spec:'গাইনী, প্রসূতি, বন্ধ্যাত্ব ও স্ত্রীরোগ বিশেষজ্ঞ, সার্জন',sched:'প্রতিদিন দুপুর ৩টা - রাত ৯টা, শুক্রবার সকাল ৯টা - সন্ধ্যা ৭টা',addr:'রয়্যাল হসপিটাল ইউনিট-২, হাসপাতাল রোড, মাইজদী',serial:'01845-820226'}
];

const FAQ_LIST = [
  {q:'কাস্টম বাজার সেবা কীভাবে কাজ করে?',a:'আপনি আপনার বাজারের লিস্ট লিখে দিন, আমাদের ড্রাইভার সেই লিস্ট অনুযায়ী বাজার করে আপনার বাসায় পৌঁছে দেবে। অর্ডার কনফার্ম করার জন্য ১০০ টাকা বিকাশ পে বাধ্যতামূলক, বাকি টাকা ক্যাশ অন ডেলিভারি।'},
  {q:'ডেলিভারি চার্জ ও সময় কীভাবে ঠিক হয়?',a:'ডেলিভারি চার্জ ও সময় দুটোই নির্ভর করে আপনার অর্ডারের পরিমাণ (কতগুলো আইটেম) এবং আপনার ঠিকানার দূরত্বের (মাইলেজ) উপর। চেকআউটের সময় সঠিক চার্জ ও আনুমানিক সময় দেখানো হয় — আগে থেকে কোনো নির্দিষ্ট সময় প্রতিশ্রুতি দেওয়া হয় না, কারণ প্রতিটা অর্ডার আলাদা।'},
  {q:'কোন এলাকায় ডেলিভারি হয়?',a:'বর্তমানে নোয়াখালী সদর ও বেগমগঞ্জ উপজেলার নির্দিষ্ট এলাকায় ডেলিভারি হয়। ভবিষ্যতে আরো জোন যোগ হবে।'},
  {q:'কোন সময় অর্ডার করা যায়?',a:'যেকোনো সময় অর্ডার করতে পারেন। ডেলিভারি কখন পৌঁছাবে তা নির্ভর করে সেই মুহূর্তে অর্ডারের পরিমাণ ও দূরত্বের উপর — অর্ডার করার পর নির্দিষ্ট সময় জানিয়ে দেওয়া হবে।'},
  {q:'পেমেন্ট কীভাবে করব?',a:'ক্যাশ অন ডেলিভারি (COD), bKash, অথবা Nagad। জোন অনুযায়ী আলাদা bKash/Nagad নাম্বার চেকআউট পেজে দেখানো হয়।'},
  {q:'অর্ডার কীভাবে ট্র্যাক করব?',a:'"আমার অর্ডার" পেজে গিয়ে রিয়েল-টাইম অর্ডার স্ট্যাটাস ও ড্রাইভারের লাইভ লোকেশন দেখতে পারবেন।'},
  {q:'অর্ডার ক্যানসেল করা যায়?',a:'হ্যাঁ, ড্রাইভার পিকআপ শুরু করার আগে অর্ডার ক্যানসেল করা যায়। এরপর আর ক্যানসেল করা যাবে না।'},
  {q:'রিটার্ন/রিফান্ড কীভাবে?',a:'ডেলিভারির ২৪ ঘন্টার মধ্যে কোনো সমস্যা হলে রিটার্ন/রিফান্ড রিকোয়েস্ট করতে পারবেন। "আমার অর্ডার" পেজ থেকে রিফান্ড রিকোয়েস্ট করুন।'}
];

function money(n){ return '৳' + Number(n||0).toLocaleString('en-US'); }
function bn(n){ return String(n); }
function maskNid(nid){
  if(!nid || nid.length<4) return nid||'—';
  return nid.slice(0,2) + '•'.repeat(Math.max(nid.length-4,3)) + nid.slice(-2);
}
function skeletonCards(n=4){
  return Array.from({length:n}).map(()=>`<div class="pcard" style="pointer-events:none"><div class="imgwrap" style="background:linear-gradient(90deg,#131c2e 25%,#1a2740 50%,#131c2e 75%);background-size:200% 100%;animation:shimmer 1.4s infinite"></div><div class="pbody"><div style="height:12px;background:var(--line);border-radius:4px;margin-bottom:8px;width:80%"></div><div style="height:16px;background:var(--line);border-radius:4px;width:50%"></div></div></div>`).join('');
}

/* ---------- Lazy image fade-in fix ---------- */
/* load ইভেন্ট bubble করে না, তাই capture:true দিয়ে document-এ delegate করা হলো
   যাতে dynamically inject হওয়া (pcardHTML, admin table ইত্যাদি) সব img-ও কভার হয় */
document.addEventListener('load', function(e){
  const img = e.target;
  if(img && img.tagName === 'IMG' && img.hasAttribute('loading')){
    img.classList.add('loaded');
  }
}, true);

/* ⚠️ আগে setInterval দিয়ে প্রতি সেকেন্ডে পুরো DOM scan করা হতো (৩০ বার পর বন্ধ
   হতো ঠিকই, কিন্তু তাও অকারণে polling ছিল)। এখন সম্পূর্ণ event-driven —
   MutationObserver নতুন যোগ হওয়া <img loading="lazy"> ধরে ফেলে, আর প্রতিটার
   জন্য সরাসরি load/error ইভেন্ট বা .complete চেক করা হয় — কোনো periodic
   polling নেই, CPU/ব্যাটারি সম্পূর্ণ idle থাকে যতক্ষণ না নতুন ছবি আসে। */
function markLazyImageLoaded(img){
  if(img.complete && img.naturalWidth > 0){ img.classList.add('loaded'); return; }
  img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
}
document.querySelectorAll('img[loading="lazy"]:not(.loaded)').forEach(markLazyImageLoaded);
new MutationObserver(mutations => {
  for(const m of mutations){
    m.addedNodes.forEach(node => {
      if(node.nodeType !== 1) return;
      if(node.tagName === 'IMG' && node.loading === 'lazy') markLazyImageLoaded(node);
      else if(node.querySelectorAll) node.querySelectorAll('img[loading="lazy"]:not(.loaded)').forEach(markLazyImageLoaded);
    });
  }
}).observe(document.body, { childList: true, subtree: true });
/* ---------- Dark Mode Toggle (auto = system অনুযায়ী, ম্যানুয়াল হলে override) ---------- */
const ThemeToggle = {
  KEY: 'golapi_theme', // মান: 'light' | 'dark' | 'auto' (ডিফল্ট auto)
  mq: window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null,
  init(){
    const saved = localStorage.getItem(this.KEY) || 'auto';
    this.apply(saved);
    if(this.mq){
      const listener = () => { if((localStorage.getItem(this.KEY)||'auto')==='auto') this.apply('auto'); };
      if(this.mq.addEventListener) this.mq.addEventListener('change', listener);
      else if(this.mq.addListener) this.mq.addListener(listener); // পুরনো Safari ফলব্যাক
    }
  },
  apply(mode){
    let resolved = mode;
    if(mode==='auto') resolved = (this.mq && this.mq.matches) ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.setAttribute('data-theme-mode', mode); // 'auto'/'light'/'dark' — বাটনের আইকনের জন্য
  },
  toggle(){
    // চক্র: auto → light → dark → auto...
    const current = localStorage.getItem(this.KEY) || 'auto';
    const next = current==='auto' ? 'light' : current==='light' ? 'dark' : 'auto';
    localStorage.setItem(this.KEY, next);
    this.apply(next);
  }
};
ThemeToggle.init();

/* ═══════════════════════════════════════════════════════════
   Lazy JS Loader — admin/driver/zone-manager/payment/sms/memo/livemap
   এই ৭টা ফাইল আগে প্রতিটা কাস্টমারের প্রথম লোডেই ডাউনলোড+parse হতো,
   যদিও বেশিরভাগ ভিজিটর কখনো এগুলো ব্যবহারই করে না। এখন শুধু যখন সত্যিই
   দরকার (নির্দিষ্ট পেজে গেলে) তখনই লোড হয়, একবার লোড হলে আর দ্বিতীয়বার না।
   ═══════════════════════════════════════════════════════════ */
window.__loadedScripts = {};
window.loadScriptOnce = function(src){
  if(window.__loadedScripts[src]) return window.__loadedScripts[src];
  window.__loadedScripts[src] = new Promise((resolve, reject)=>{
    const s = document.createElement('script');
    s.src = src;
    const timeout = setTimeout(()=>fail(new Error('Script load timed out: '+src)), 15000);
    const fail = error => {
      clearTimeout(timeout);
      delete window.__loadedScripts[src];
      s.remove();
      reject(error);
    };
    s.onload = () => { clearTimeout(timeout); resolve(); };
    s.onerror = () => fail(new Error('Script load failed: '+src));
    document.head.appendChild(s);
  });
  return window.__loadedScripts[src];
};

/* ═══════════════════════════════════════════════════════════
   গ্লোবাল ইমেজ auto-retry — ধীর নেটওয়ার্কে (যেমন 2-3 KB/s) পেজ লোডের
   সময় একসাথে অনেক request (সব পেজ+JS+CSS+ফন্ট+ছবি) পাঠানো হয়, ফলে কিছু
   ছবির fetch ব্যর্থ/timeout হয়ে যায় — ব্রাউজার নিজে থেকে আর retry করে না,
   ছবিটা স্থায়ীভাবে ভাঙা থেকে যায়। এটা যেকোনো ভাঙা <img> ধরে, বিরতি দিয়ে
   সর্বোচ্চ ৩ বার আবার লোড করার চেষ্টা করে (network কম ব্যস্ত হওয়ার পর
   দ্বিতীয়/তৃতীয় চেষ্টায় সাধারণত সফল হয়)।
   ═══════════════════════════════════════════════════════════ */
document.addEventListener('error', function(e){
  const img = e.target;
  if(!(img instanceof HTMLImageElement)) return;
  if(img.dataset.retryCount === undefined) img.dataset.retryCount = '0';
  const retries = parseInt(img.dataset.retryCount, 10);
  if(retries >= 3) return; // ৩ বার চেষ্টার পরও ব্যর্থ হলে থেমে যাওয়া, infinite loop এড়াতে
  img.dataset.retryCount = String(retries + 1);
  const delay = 1500 * (retries + 1); // ১.৫সে, ৩সে, ৪.৫সে — ক্রমবর্ধমান বিরতি
  setTimeout(()=>{
    const originalSrc = img.src;
    img.src = ''; // cache-বাস্টিং রিলোড ট্রিগার করতে
    img.src = originalSrc + (originalSrc.includes('?') ? '&' : '?') + 'retry=' + Date.now();
  }, delay);
}, true); // capture phase-এ শোনা হয়, কারণ img-এর error ইভেন্ট bubble করে না
