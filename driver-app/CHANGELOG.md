# Changelog

## 2.4.1
- Connected the Android shell directly to the deployed `/driver/` application
- Added automatic release detection and safe refresh while no delivery/form is active
- Removed simulation/test controls, hardcoded offers/dates/referral, stock avatars and fake time metrics
- Replaced Dhaka fallback coordinates with nullable real coordinates and address navigation
- Loaded branches and opportunities from Firestore with real empty states
- Derived tips and earnings from delivered orders; synced preferences to the Driver record
- Added Customer + Driver APK matrix workflow with optional stable release signing

## 1.3.0
- Added route-level lazy loading for pages, dashboards and heavy modal flows
- Split Firebase, React, map and UI vendor bundles for faster startup
- Added reproducible `package-lock.json` installs and changed CI to `npm ci`
- Replaced conflicting Dhaka/New York map placeholders with verified Golapi Shop Noakhali and Zone-B service zones
- Map now uses saved/live driver coordinates and escapes Firestore-sourced marker labels
- Inactive, suspended and resigned driver accounts are blocked during authentication
- Revalidated TypeScript, project integration and production build

## 1.2.0
- Full frontend UI/UX audit and responsive fixes
- Repaired broken menu/header actions
- Corrected payout feedback and transaction sorting
- Added accessibility, safe-area and reduced-motion support
- Fixed Inbox currency and menu duplicate identifiers


## 1.1.0 — GolapiShop exact-flow integration

- Backend order flow corrected to `assigned → packed → picked_up → in_transit → delivered`.
- Removed writes of unsupported website `arrived` status; `arrived` remains UI-only while backend stays `in_transit`.
- Live location starts when delivery changes to `in_transit`.
- Added project integration validator.
- Added Android manifest permission configurator for network, vibration and precise/coarse location.
- Upgraded and pinned Capacitor packages to 8.4.2.
- GitHub Actions now uses Node 22 and Java 21.
- Added Bengali Firebase setup, Firestore Rules integration and commit/build documentation.
