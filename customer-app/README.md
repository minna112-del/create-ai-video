# Golapi Customer Android shell

এই folder আলাদা ecommerce source নয়। Customer APK `https://www.golapishop.online/`
live deploy চালায়, তাই website-এর product, cart, checkout, auth, profile, orders এবং
customer UI-ই app-এর real UI। Duplicate product data বা mock API নেই।

Repository root-এর `Build Golapi Customer and Driver APKs` workflow একই run-এ
Customer ও Driver APK তৈরি করে। Website deploy-এর পর Customer app নতুন release
নিজে শনাক্ত ও refresh করে; web-only পরিবর্তনের জন্য APK পুনরায় install লাগে না।

Android package/permission/Capacitor engine বদলালে stable signing key-সহ নতুন APK
build করতে হবে। সাধারণ sideloaded Android app Play Store/MDM/device-owner ছাড়া
নিজের native package silently replace করতে পারে না।
