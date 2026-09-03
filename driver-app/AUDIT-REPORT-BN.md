# Golapi Driver — UI/UX ও Frontend Audit

## সংক্ষিপ্ত অডিট

প্রকল্পের সব React/TypeScript/CSS source, shared navigation, forms, modal, mobile layout এবং desktop dashboard পর্যালোচনা করা হয়েছে। এটি traditional multi-page HTML project নয়; Vite + React single-page application। তাই প্রতিটি page component আলাদাভাবে audit করা হয়েছে।

## Page-wise গুরুত্বপূর্ণ সংশোধন

- **Login:** email/password autocomplete, mobile input mode, loading accessibility এবং submit semantics উন্নত।
- **Home:** bottom navigation overlap প্রতিরোধে স্থায়ী content spacing ও viewport-safe layout।
- **Discover:** shared responsive rules, reduced-motion support এবং horizontal overflow protection।
- **Earnings:** ভাঙা alert button-এর পরিবর্তে কার্যকর support hotline; payout result আর “টাকা পাঠানো হয়েছে” বলে ভুল দাবি করে না।
- **Inbox:** বাংলা টাকা/English view-এ ভুল dollar symbol সংশোধন; category typing নিরাপদ করা হয়েছে।
- **Menu:** duplicate ID, dead alert actions, profile/settings routing, referral share/copy এবং support call ঠিক করা হয়েছে।
- **Header/Navigation:** safety button কার্যকর, active page accessibility, iPhone/Android safe-area এবং keyboard focus state যোগ।
- **Payout:** transaction date sorting formatted text নয়, প্রকৃত timestamp দিয়ে করা হচ্ছে; account input mobile-friendly।
- **Shared UI:** long dynamic content wrapping, 320px minimum viewport, horizontal overflow, focus-visible এবং reduced-motion support যোগ।

## Final recheck

- Project validator: passed
- TypeScript/TSX syntax transpilation: passed
- Broken `alert()` UI actions: removed
- Duplicate menu identifiers: fixed
- Mobile bottom navigation overlap: fixed
- Source imports/relative paths: validator passed
- Live Firestore-only mock scan: passed
- Capacitor Customer/Driver Android project generation: passed
- Live HTTPS URL ও manifest permissions: passed
- Stable release-signing Gradle injection: passed
- Vite production build: passed

স্থানীয় runner-এ Gradle distribution domain network policy-তে blocked ছিল; repository workflow GitHub-hosted runner-এ Gradle download ও দুইটি APK build করবে।
