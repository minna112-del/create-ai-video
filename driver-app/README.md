# Golapi Driver — GolapiShop Connected

Golapi Driver অ্যাপটি `golapishop.online` ওয়েবসাইটের একই Firebase project এবং Firestore data model ব্যবহার করে। এটি আলাদা demo backend বা mock order ব্যবহার করে না। Android APK live `/driver/` deployment চালায়, তাই web deploy হলে app-ও user action ছাড়াই সর্বশেষ release নেয়।

Production source-এ simulation button, test delivery, stock avatar, hardcoded offer,
fake earning/online-hour এবং Dhaka fallback route রাখা হয়নি। Orders, branches,
opportunities, tips, earnings, payout requests, profile ও preferences Firestore data থেকে আসে।

## মূল সংযোগ

- Firebase project: `golapishoponline`
- Driver authorization: `staff/{authUid}`
- Driver profile/status: `drivers/{driverId}`
- Assigned orders: `orders` যেখানে `driverId == currentDriverId`
- Payout requests: `payoutRequests`
- Backend order flow: `assigned → packed → picked_up → in_transit → delivered`

## Commit করার আগে

Unified repository root-এ এই ফাইলগুলো থাকতে হবে:

- `.github/workflows/build-mobile-apks.yml`
- root `package.json`, storefront source ও `netlify.toml`
- `customer-app/`
- `driver-app/`

Unified ZIP-এর ভেতরের ফাইলগুলো repository root-এ একই commit-এ রাখবেন।

## GitHub Actions APK build

Native shell source বদলালে `main`/`master` push-এ workflow চলবে। Manual build:

1. GitHub repository → **Actions**
2. **Build Golapi Customer and Driver APKs**
3. **Run workflow**
4. Build শেষ হলে Customer ও Driver—দুইটি APK artifact download করুন

## প্রয়োজনীয় Firebase setup

সম্পূর্ণ নির্দেশনা: [`docs/FIREBASE-SETUP-BN.md`](docs/FIREBASE-SETUP-BN.md)

## Local commands

```bash
npm install
npm run validate
npm run typecheck
npm run build
```

Android project তৈরি ও sync:

```bash
npx cap add android
npx cap sync android
npm run android:configure
```

## গুরুত্বপূর্ণ

Firestore Rules অন্ধভাবে replace করবেন না। Website, customer interface, admin dashboard এবং Driver app একই database ব্যবহার করে। [`docs/FIRESTORE-RULES-GUIDE-BN.md`](docs/FIRESTORE-RULES-GUIDE-BN.md)-এর permission checklist অনুসরণ করে existing rules-এর সঙ্গে merge করতে হবে।
