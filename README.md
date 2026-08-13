# Golapi Shop Online — Unified Repository

এই repository-তেই customer storefront, admin/Business OS, Customer Android shell
এবং নিজস্ব delivery Driver app রাখা হয়েছে। Storefront source root-এ, Customer
Capacitor shell `customer-app/`-এ এবং React/Vite/Capacitor Driver source
`driver-app/`-এ থাকে। Netlify `npm run build` চালিয়ে একই deploy-এর মধ্যে
storefront `/` এবং Driver app `/driver/` URL-এ প্রকাশ করে।

- Website deploy: repository root Netlify-তে connect করুন; build configuration
  `netlify.toml` থেকেই নেওয়া হবে।
- Driver web app: `https://www.golapishop.online/driver/`
- Customer ও Driver APK: GitHub Actions-এর `Build Golapi Customer and Driver APKs`
  workflow manually run করলে একই run-এ দুইটি artifact তৈরি হয়।
- Firebase: storefront ও Driver app একই Firebase project/collections ব্যবহার করে।
- Dashboard URL: `docs/DASHBOARD-URLS-BN.md`।

## Website update = App update

Customer APK live `https://www.golapishop.online/` এবং Driver APK live
`https://www.golapishop.online/driver/` চালায়। তাই website/Driver web deploy হলেই
installed app পরের launch-এ সর্বশেষ UI/logic নেয়; app খোলা থাকলে release checker
সর্বোচ্চ পাঁচ মিনিটের মধ্যে নতুন deploy দেখে নিজে refresh করে। Customer বা Driver-কে
APK download/install করতে হয় না।

শুধু native Android package, permission বা Capacitor engine বদলালে নতুন signed APK
লাগে। Normal Android security অনুযায়ী Play Store/MDM/device-owner ছাড়া কোনো app
নিজের APK silently replace করতে পারে না। একই signing key ব্যবহার করলে নতুন APK
পুরোনোটির ওপর install করা যায়; workflow `ANDROID_KEYSTORE_*` GitHub secrets পেলে
stable signed release APK বানায়, না পেলে শুধু test APK বানায়।

পুরোনো আলাদা Customer/Driver repository বা Driver ZIP আর দরকার নেই।

# Previous project documentation

নোয়াখালী সদর ও বেগমগঞ্জের নিজস্ব অনলাইন শপ — মুদি, ঔষধ, গ্যাস, কসমেটিকস, কাস্টম বাজার ও স্বাস্থ্য সেবা (ডাক্তার এপয়েন্টমেন্ট/সিরিয়াল বুকিং সহায়তা)। PWA আর্কিটেকচার, Firebase ব্যাকএন্ড, Google Maps-ভিত্তিক লোকেশন সিস্টেম।

🔗 লাইভ সাইট: https://www.golapishop.online

---

## 🏗️ আর্কিটেকচার — Page Split (হালকা, দ্রুত লোড)

```
index.html (~3 KB স্কেলিটন, শুধু <div id="slot-...">/<main id="pageContainer"> থাকে)
  │
  ├─ js/page-loader.js  ── সব পেজ ও পার্শিয়াল "pages/" ফোল্ডার থেকে fetch করে
  │                         (⚠️ কোনো আলাদা "partials/" ফোল্ডার নেই — সবকিছু pages/-এ)
  │
  ├─ slot-topbar        ← pages/topbar.html
  ├─ slot-header        ← pages/header.html
  ├─ slot-cart-drawer   ← pages/cart-drawer.html
  ├─ pageContainer      ← pages/home.html, listing.html, product.html, checkout.html ...
  ├─ slot-footer        ← pages/footer.html
  ├─ slot-mobnav        ← pages/mobnav.html
  ├─ slot-chat          ← pages/chat-widget.html
  ├─ slot-modals        ← pages/modals.html (auth, location picker, ইত্যাদি সব মডাল এখানে)
  └─ slot-toast         ← pages/toast.html
```

**লোড হওয়ার ক্রম:**
1. `index.html` লোড হয় → স্পিনার দেখায়
2. `page-loader.js` blocking shared partials এবং প্রথম-দরকারি `home`, `listing`, `product` page load করে; footer idle time-এ load হয়
3. Checkout/account/order এবং ২৭টি **staff workspace** lazy-load হয় — শুধু `Router.go()` কল হলে তখনই আনা হয়
4. সব রেডি হলে `pages-ready` ইভেন্ট ফায়ার হয়, স্পিনার সরে যায়

**রাউটিং:**
- `js/core/app-registry.js` — route, lazy script, staff catalog ও access metadata-এর single source of truth
- `js/router.js` — `Router.go(page, params)` দিয়ে পেজ বদলানো; shared `StaffAccess` gate Firebase Auth, active staff profile এবং permission matrix যাচাই করে
- `js/deep-links.js` — TWA/native app path-based রাউটিং (`/driver`, `/manager` ইত্যাদি URL থেকে সরাসরি সঠিক পেজ খোলে)
- `netlify.toml` — SPA fallback rewrite (`/driver`, `/manager`, `/*` → `index.html`)

---

## 📁 ফাইল কাঠামো

| ফোল্ডার/ফাইল | কী আছে |
|---|---|
| `pages/*.html` | সব পেজ **ও** পার্শিয়াল (header/footer/topbar/mobnav/chat-widget/modals/toast সহ) |
| `css/style.css` | মূল ডিজাইন সিস্টেম — cream/rose/ink কালার টোকেন, dark mode override |
| `css/components.css` | Icon সিস্টেম (emoji-free line icons), ফুটার/হিরো/quick-category কম্পোনেন্ট |
| `js/utils.js` | কনস্ট্যান্ট (CATEGORIES, BRANCH_INFO, DELIVERY_ZONES), হেল্পার ফাংশন, ThemeToggle |
| `js/location.js` | LocationPicker (Google Maps সার্চ+পিন) + LocationService (GPS/battery শেয়ার্ড লজিক) |
| `js/livemap.js` | কাস্টমার-facing লাইভ ট্র্যাকিং ম্যাপ (Leaflet/OpenStreetMap — ফ্রি) |
| `js/pages.js` | Home, Listing, PDP, Cart, Checkout, CustomBazar — মূল কাস্টমার লজিক |
| `js/core/app-registry.js` | ৪২টি route, ২৭টি staff workspace, controller ও lazy dependency registry |
| `js/core/i18n.js` | Static ও dynamic বাংলা/English UI lifecycle |
| `driver-app/` | React Driver web app ও Capacitor Android shell — live orders, GPS, earnings, payout ও navigation |
| `customer-app/` | Customer Capacitor Android shell — live storefront URL |
| `js/admin.js` | Admin Dashboard — প্রোডাক্ট, অর্ডার, Delivery Pricing, Delivery Zone এডিটর |
| `js/zone-manager.js` | শাখা ম্যানেজার পোর্টাল |
| `js/firebase-init.js` | Firebase config, Auth/Firestore/Storage/Messaging সেটআপ, push token registration |
| `sw.js` | PWA offline cache এবং Firebase background push handler—একটি service worker-এ একীভূত |

---

## 🎨 ডিজাইন সিস্টেম

- **থিম:** Cream ব্যাকগ্রাউন্ড + Rose/Pink প্রাইমারি অ্যাকসেন্ট (ব্র্যান্ড নাম "গোলাপি" থেকে অনুপ্রাণিত) + গাঢ় ink ব্যান্ড (footer/topbar/বাটনে)
- **Dark Mode:** Auto (সিস্টেম অনুযায়ী) / Light / Manual toggle — `html[data-theme]` অ্যাট্রিবিউট দিয়ে নিয়ন্ত্রিত, `--ink-band` টোকেন mode-independent রাখা হয়েছে (footer/topbar dark mode-এ ভেঙে না যায়)
- **Icon সিস্টেম:** কোনো emoji নেই (`js` লাইব্রেরি ছাড়া CSS mask-based line icon, `components.css`-এ `.ic-*` ক্লাস)
- **Typography:** Hind Siliguri (বাংলা), Poppins (নাম্বার/হেডিং অ্যাকসেন্ট)

---

## 📍 লোকেশন সিস্টেম

- **Google Maps** (Places Autocomplete + Geocoding + Distance Matrix) — `index.html`-এ `window.GOOGLE_MAPS_API_KEY` বসাতে হয়
- **Delivery Zone:** প্রতিটা শাখার (সদর/বেগমগঞ্জ) নিচে বৃত্তাকার Zone A/B/C (radius + flat fee) — Admin Panel থেকে লাইভ-এডিটেবল, `setting/delivery_zones` Firestore ডকুমেন্টে সেভ থাকে
- **Checkout-এ লোকেশন বাধ্যতামূলক** — ম্যাপে পিন না করলে অর্ডার confirm হয় না; Zone-এর বাইরে হলে ব্লক
- **Customer tracking** (`location.js`, `livemap.js`) এবং **Driver tracking** (`driver-app/src/context/DriverContext.tsx`) একই order-এর Firestore coordinates/status ব্যবহার করে।

---

## 🚚 ড্রাইভার ও ট্র্যাকিং

- Accept/Reject workflow (নতুন অর্ডার assign হলে ড্রাইভার প্রথমে accept করে, reject করলে admin-এর কাছে ফিরে যায়)
- লাইভ GPS status, battery %, last-update টাইমার
- Google Maps নেভিগেশন (সঠিক GPS পিন থাকলে সেটাই ব্যবহার হয়, না থাকলে টেক্সট ঠিকানা fallback)
- কাস্টমারকে Call/SMS/Chat — সব এক জায়গায়
- কাস্টমার-facing লাইভ ট্র্যাকিং (Leaflet, বাইক আইকন heading অনুযায়ী ঘোরে) + ETA countdown

---

## 🔔 Push Notification

- Firebase Cloud Messaging — VAPID key `firebase-init.js`-এ সেট করা আছে
- `registerPushToken()` — permission আগে থেকেই granted থাকলে token সেভ করে (`fcmTokens` কালেকশনে); স্বয়ংক্রিয় prompt দেখায় না
- `sw.js` — ব্যাকগ্রাউন্ড নোটিফিকেশন রিসিভ করে
- ⚠️ **এখনো বাকি:** actual notification **পাঠানোর** ট্রিগার (Cloud Function দরকার — Blaze plan + Firebase CLI/কম্পিউটার লাগবে, iPhone থেকে সম্ভব না)

---

## 💰 Delivery Pricing (Admin-editable)

Admin Panel → সেটিংস → "🚚 ডেলিভারি প্রাইসিং":
- Base Charge, Per KM Charge, প্রতি আইটেম চার্জ, Free Delivery threshold, Delivery Radius, Max Distance
- সেভ করলেই `setting/delivery` Firestore ডকুমেন্টে যায় এবং **সাথে সাথে লাইভ** (রিফ্রেশ/ডিপ্লয় লাগে না)

---

## 🔑 চালু করার আগে যা বসাতে হবে

| জায়গা | কী বসাতে হবে |
|---|---|
| `index.html` | `window.GOOGLE_MAPS_API_KEY` — Maps JavaScript API + Places API + Distance Matrix API + Geocoding API enabled থাকতে হবে, billing চালু থাকতে হবে |
| `js/firebase-init.js` | `VAPID_KEY` (Firebase Console → Project Settings → Cloud Messaging → Web Push certificates) |
| `js/utils.js` | `BRANCH_INFO`-এর `lat`/`lng` — বাস্তব শাখায় দাঁড়িয়ে GPS দিয়ে যাচাই করে বসানো উচিত |

## 🚀 ডিপ্লয়মেন্ট নোট

- **Netlify** — `netlify.toml`-এ SPA rewrite + security headers + TWA `assetlinks.json` হেডার সেট করা আছে
- **Cache বাম্প করতে ভুলো না** — `sw.js`-এর `CACHE = 'golapi-vX'` সংখ্যা প্রতিবার বড় আপডেটে বাড়াতে হবে, নইলে পুরনো ইউজারদের কাছে পুরনো ভার্সন cache-এ আটকে থাকবে
- **Native live shells** — Customer ও Driver Capacitor config live HTTPS deploy চালায়; Android project ও APK একই repository workflow থেকে তৈরি হয়।
