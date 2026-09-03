# Golapi Shop Refactor Report / রিফ্যাক্টর রিপোর্ট

## v2.4 unified Website + Customer APK + Driver APK

- একই repository থেকে Netlify website, `/driver/` web app, Customer APK এবং Driver APK পরিচালিত হয়।
- Customer/Driver Android shell live HTTPS deploy চালায়; website deploy-ই app content update। Visible app সর্বোচ্চ পাঁচ মিনিটে নতুন release দেখে নিরাপদ অবস্থায় নিজে refresh করে।
- Active checkout/staff form বা live Driver delivery চলাকালে forced refresh হয় না; পরের safe state/launch-এ update নেয়।
- Driver-এর simulation/test delivery, hardcoded offer/date/referral, fake earnings hours, stock avatar এবং Dhaka fallback coordinate অপসারণ করা হয়েছে।
- Driver orders, branches, opportunities, tips, earnings, payouts, profile ও preferences live Firestore records থেকে আসে।
- এক GitHub Actions matrix Customer ও Driver APK বানায়; configured secrets থাকলে stable signed release, না থাকলে test APK তৈরি হয়।
- সব public, Admin, Business OS এবং staff dashboard-এর canonical URL `docs/DASHBOARD-URLS-BN.md`-এ নথিভুক্ত।

- One repository now owns the Netlify storefront, `/driver/` web app, Customer APK, and Driver APK.
- Both Android shells load the live HTTPS deployment, making a site deployment the app-content update.
- Driver mock/simulation paths were removed in favor of live Firestore data and honest empty states.
- A single matrix workflow builds both Android applications and supports stable release signing.

## v2.2 production audit / প্রোডাকশন অডিট

- Firebase ready event-এর আগে `window.FB` bridge তৈরি হয়েছে; Admin, Attendance, Payroll, CRM, HR/Finance ERP ও Company OS আর ভুল connection error দেখাবে না।
- Document Office পুরোনো Firebase alias বাদ দিয়ে canonical SDK facade ব্যবহার করছে।
- Checkout-এর live price, stock, coupon limit, wallet balance, stock decrement, coupon usage এবং order write এখন একই Firestore transaction-এ atomic।
- Transaction commit হওয়ার পরে local confirmation UI ব্যর্থ হলেও customer-কে পুনরায় order দিতে বলা হয় না; duplicate order ঝুঁকি বন্ধ।
- ২৭টি staff workspace-এর catalog, route metadata এবং access role একটি registry-তে এসেছে। Direct clean URL-ও active staff profile ও permission matrix ছাড়া protected office খুলবে না।
- Permission Matrix schema v3-এ নতুন ৯টি ERP workspace যোগ হয়েছে; পুরোনো schema v2 installation in-memory compatibility পায়।
- Inactive, suspended বা resigned staff-এর Company OS access বন্ধ। Company OS launcher অনুমোদিত app list-এর বাইরে route খুলতে পারে না।
- Service Worker cache ও self-heal version bump করা হয়েছে।

- The Firebase-ready lifecycle now exposes the canonical SDK facade consistently to every admin/ERP controller.
- Document Office uses the current Firebase API instead of obsolete aliases.
- Live pricing, stock, coupon quota, wallet balance, inventory decrement, coupon usage, and order creation are committed in one Firestore transaction.
- All 27 staff workspaces share one catalog and route-access policy; protected clean URLs verify an active staff profile and permissions.
- Permission Matrix schema v3 adds all current ERP offices while preserving compatibility for existing schema v2 deployments.

## Outcome / ফলাফল

Golapi Shop Online-এর customer storefront, account, checkout, admin, dashboard এবং 27টি staff workspace একটি central route registry, reusable page loader এবং site-wide bilingual runtime-এর অধীনে আনা হয়েছে।

The customer storefront, account, checkout, admin, dashboards, and 27 staff workspaces now use one route registry, one reusable page loader, and a site-wide bilingual runtime.

## Architecture / আর্কিটেকচার

- `js/core/app-registry.js`: page, route alias, lazy script, staff status এবং controller-এর single source of truth।
- `js/core/i18n.js`: static fragment, lazy page, modal, toast এবং dynamically rendered UI-এর Bangla/English lifecycle।
- `js/core/business-os-runtime.js`: persistent Business OS session heartbeat, Screen Wake Lock request, visibility recovery এবং cleanup।
- `js/page-loader.js`: timeout-protected reusable fragment fetch, request deduplication এবং deferred footer loading।
- `js/router.js`: registry-based dependency loading, controller invocation এবং staff layout switching।

## Fixed / সমাধান

- চার জায়গায় থাকা route/page/script/controller duplication এক registry-তে আনা হয়েছে।
- CRM ও Procurement dashboard/ERP-এর 10টি duplicate DOM ID namespace করা হয়েছে।
- Admin order search control পুনরুদ্ধার করা হয়েছে।
- Zone Manager COD summary ও escalation panels পুনরুদ্ধার করা হয়েছে।
- ব্যর্থ lazy script পুনরায় load করা যায়; rejected promise আর স্থায়ীভাবে cache হয় না।
- অব্যবহৃত Address/Tracking prototype, FAQ/Reviews renderer, Referral block এবং SMS failure loader সরানো হয়েছে।
- Service Worker cache version ও core asset list আপডেট করা হয়েছে।

## Bilingual coverage / দ্বিভাষিক কভারেজ

Language switch এখন সব 50টি HTML view/partial এবং controller-generated dynamic content-এ কাজ করে। Existing exact `data-bn`/`data-en` copy সর্বোচ্চ অগ্রাধিকার পায়; বাকি legacy text central dictionary ও fallback renderer-এর মাধ্যমে English mode-এ রূপান্তরিত হয়। Brand, product name, staff name এবং user-entered data অপরিবর্তিত থাকে।

The language switch now covers all 50 HTML views/partials and controller-generated dynamic content. Existing exact `data-bn`/`data-en` copy has the highest priority; remaining legacy copy is handled by the central dictionary and fallback renderer. Brand names, product names, staff names, and user-entered data remain unchanged.

- `js/core/translations-en.js`-এ 2,337টি যাচাইকৃত static UI phrase-এর English copy আছে।
- Exact lookup এবং first-character bucket ব্যবহারের কারণে প্রতিটি DOM mutation-এ পুরো dictionary scan হয় না।
- Phone, email, URL, record-like number, customer data এবং secret/key translation input-এর বাইরে রাখা হয়েছে।
- Unmapped Bangla নাম অনুমান করে transliterate করা হয় না; dynamic product/customer/staff/place name অক্ষুণ্ণ থাকে।
- Offline page এবং installable app shortcuts-ও Bangla/English copy পেয়েছে।

- `js/core/translations-en.js` contains English copy for 2,337 verified static UI phrases.
- Exact lookup and first-character buckets avoid scanning the full dictionary on every DOM mutation.
- Phone numbers, emails, URLs, record-like numbers, customer data, and secrets/keys were excluded from translation input.
- Unmapped Bangla names are never guessed or transliterated, preserving dynamic product, customer, staff, and place names.
- The offline page and installable app shortcuts also include Bangla/English copy.

## Business OS always-on behavior / সবসময় সক্রিয় আচরণ

Company OS একবার খোলা হলে SPA-এর অন্য page-এ গেলেও runtime session বন্ধ হয় না। সমর্থিত secure browser-এ Screen Wake Lock display সচল রাখে। Browser tab background/hidden হলে browser নিজে Wake Lock release করতে পারে; tab visible হলে runtime স্বয়ংক্রিয়ভাবে আবার request করে এবং current state/time পুনরায় sync করে। Normal website code দিয়ে browser/OS-এর hidden-tab throttling সম্পূর্ণ নিষ্ক্রিয় করা নিরাপত্তাজনিত কারণে সম্ভব নয়।

After Company OS is opened, its runtime session stays active across other SPA pages. On supported secure browsers, Screen Wake Lock keeps the display awake. A browser may release the lock when the tab becomes hidden; the runtime automatically requests it again and resynchronizes state/time when the tab becomes visible. Browser/OS hidden-tab throttling cannot be completely disabled by normal website code for security and battery reasons.

Screen Wake Lock requires HTTPS and browser support. The runtime stays logically active while hidden and restores the wake lock, clock, connection state, and subscribers when the tab becomes visible again.

## Deploy / ডিপ্লয়

ZIP-এর ভেতরের সম্পূর্ণ source একই commit-এ upload করুন। পুরোনো source-এর ওপর শুধু কয়েকটি file আলাদাভাবে বসাবেন না। Markdown report website চালাতে বাধ্যতামূলক নয়।

Upload the complete extracted source in one commit. Do not overlay only a few files onto an older source. The Markdown report is not required at runtime.
