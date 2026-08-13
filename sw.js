/* sw.js — Golapi Shop Offline Service Worker (network-first) */
const CACHE = 'golapi-v90-staff-shell-footer-leak-fixed';
const OFFLINE_URL = '/offline.html';
/* ⚠️ আগে এখানে admin/driver/zone-manager/checkout/account ইত্যাদি সব পেজ+JS
   pre-cache হতো — যদিও page-loader.js/router.js এগুলো lazy করে দিয়েছে, Service
   Worker নিজে থেকেই আবার সব ডাউনলোড করে ফেলতো ব্যাকগ্রাউন্ডে, lazy-loading-এর
   পুরো সুবিধা নষ্ট করে দিয়ে। এখন শুধু সাধারণ browsing-এর জন্য একদম-প্রথমেই-দরকার
   এমন ফাইলগুলোই pre-cache হয়। বাকি সব (admin/driver/checkout/myorders ইত্যাদি)
   Router.go()-এর সময় স্বাভাবিক network-first fetch দিয়েই লোড হয় (এখনো cache
   হয়, শুধু install-এর সময় জোর করে আগে থেকে না)। */
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  OFFLINE_URL,
  '/css/style.css',
  '/css/components.css',
  '/css/home.css',
  '/css/runtime.css',
  '/js/core/translations-en.js',
  '/js/core/i18n.js',
  '/js/core/app-registry.js',
  '/js/core/business-os-runtime.js',
  '/js/utils.js',
  '/js/data.js',
  '/js/store.js',
  '/js/services.js',
  '/js/router.js',
  '/js/auth.js',
  '/js/widgets.js',
  '/js/pages.js',
  '/js/page-loader.js',
  '/js/app.js',
  '/js/update-check.js',
  '/js/deep-links.js',
  '/js/firebase-init.js',
  '/pages/home.html',
  '/pages/listing.html',
  '/pages/product.html',
  '/pages/topbar.html',
  '/pages/header.html',
  '/pages/mobnav.html',
  '/pages/toast.html',
  '/pages/modals.html',
  '/icons/head_logo.webp',
  '/icons/head_logo-192.webp',
  '/icons/head_logo-512.webp',
  '/icons/homepage_head_banner.webp',
  '/icons/dr_logo.webp',
  '/icons/chat_logo.webp',
  '/icons/driver_logo.webp',
  '/icons/team-mahsin-card.webp',
  '/icons/team-mahsin.webp',
  '/icons/team-abdurrahman.webp',
  '/icons/team-hridoy.webp',
  '/icons/team-rimon.webp',
  '/icons/team-srijon.webp',
  '/icons/team-jashim.webp',
  '/icons/team-roni.webp',
  '/icons/team-babu.webp',
  '/icons/team-mohsinbabul.webp'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(async cache => {
      // ⚠️ আগে সব asset একসঙ্গে parallel request হতো — slow নেটওয়ার্কে bandwidth-এ চাপ পড়তো।
      // এখন ৪টা করে ব্যাচে, ধারাবাহিকভাবে লোড হয়।
      const BATCH_SIZE = 4;
      const results = [];
      for (let i = 0; i < ASSETS.length; i += BATCH_SIZE) {
        const batch = ASSETS.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.allSettled(batch.map(asset => cache.add(asset)));
        results.push(...batchResults);
      }

      const failed = results
        .map((result, index) => ({ result, asset: ASSETS[index] }))
        .filter(entry => entry.result.status === 'rejected');

      if (failed.length) {
        console.warn(
          '[service-worker] কিছু asset pre-cache করা যায়নি:',
          failed.map(entry => entry.asset)
        );
      }
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))),
      self.clients.claim()
    ]).then(() => self.clients.matchAll({ type: 'window' }))
      .then(clientsArr => clientsArr.forEach(c => c.postMessage({ type: 'SW_UPDATED', version: CACHE })))
  );
});

const MAX_CACHE_ENTRIES = 120; // ⚠️ আগে কোনো সীমা ছিল না — মোবাইল ব্রাউজার storage সময়ের সাথে ফুলে যেতে পারতো

async function trimCache(cacheName, maxEntries){
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if(keys.length <= maxEntries) return;
  // সবচেয়ে পুরনো entry-গুলো (তালিকার শুরুর দিকে) মুছে ফেলা
  const toDelete = keys.length - maxEntries;
  for(let i = 0; i < toDelete; i++){ await cache.delete(keys[i]); }
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // ⚠️⚠️ CRITICAL FIX: আগে এখানে origin চেক ছিল না — তাই এই fetch handler
  // same-origin static file-এর পাশাপাশি cross-origin request-ও (firestore.googleapis.com,
  // gstatic.com ইত্যাদি) ধরে ফেলতো এবং নিচের ৮ সেকেন্ড timeout race-এর ভেতর ঢুকিয়ে দিতো।
  // Firestore-এর onSnapshot (real-time listener) স্লো/সীমিত নেটওয়ার্কে WebChannel
  // long-polling ব্যবহার করে — এটা একটা দীর্ঘস্থায়ী (৩০+ সেকেন্ড) খোলা connection,
  // যেটা সার্ভার থেকে নতুন ডেটা আসার অপেক্ষায় থাকে। আমাদের ৮ সেকেন্ড timeout সেই
  // connection-টাকেই "ব্যর্থ" ধরে বাতিল করে দিতো বারবার — ফলে নতুন প্রোডাক্ট
  // যোগ করলে Firestore real-time আপডেট কাস্টমারের কাছে পৌঁছাতোই না (যদিও admin-এর
  // নিজের one-time getDocs() লোড ঠিকই কাজ করতো, তাই admin panel-এ প্রোডাক্ট
  // দেখা যেত কিন্তু কাস্টমারের সাইটে যেত না — ঠিক এই উপসর্গটাই রিপোর্ট হয়েছিল)।
  // এখন cross-origin request একদমই intercept করা হয় না — সরাসরি ব্রাউজারের
  // native নেটওয়ার্কিং-এ চলে যায়, কোনো cache/timeout logic প্রযোজ্য না।
  if (new URL(request.url).origin !== self.location.origin) return;

  // /driver/ is a separately built React application in the same repository.
  // Let its own hashed assets and navigation responses bypass the storefront
  // cache so an older cached storefront /driver route can never cover it.
  const requestUrl = new URL(request.url);
  if (requestUrl.pathname === '/app-version.json') return;
  if (requestUrl.pathname === '/driver' || requestUrl.pathname.startsWith('/driver/')) return;

  // ⚠️ আগে img retry-এর সময় যোগ করা "?retry=timestamp" প্যারামিটার সহ প্রতিটা
  // চেষ্টা আলাদা cache entry হিসেবে জমা হতো (কখনো মুছতো না)। এখন এই ধরনের
  // one-off cache-busting URL কখনোই cache-এ সেভ করা হয় না।
  const isRetryBust = /[?&]retry=\d+/.test(request.url);
  // ⚠️ আগে same-origin-এর যেকোনো সফল GET response cache হতো (query-string URL,
  // dynamic response সহ)। এখন শুধু নির্দিষ্ট static file extension/path allowlist
  // অনুযায়ী cache হয় — cache-এ অপ্রয়োজনীয় entry জমা হওয়া বন্ধ।
  const cacheableAllowlist = /\.(html|js|css|webp|png|jpg|jpeg|svg|json|woff2?)$/i;
  const isCacheableStatic = cacheableAllowlist.test(requestUrl.pathname) || request.mode === 'navigate';

  event.respondWith((async () => {
    // ⚠️ আগে cache-এ কপি থাকা বা না-থাকা নির্বিশেষে সবসময় একই ৪ সেকেন্ড timeout
    // ব্যবহার হতো। কিন্তু cache থাকলে fallback হিসেবে যথেষ্ট ভালো, তাই দ্রুত
    // (২ সেকেন্ড) network না পেলেই cache থেকে দেখানো যায় — অন্যদিকে cache-এ
    // কিছুই না থাকলে (fallback করার কিছু নেই), তাড়াহুড়ো করে request বাতিল না
    // করে একটু বেশি সময় (৮ সেকেন্ড) network-কে সুযোগ দেওয়া হয়।
    const cachedMatch = isCacheableStatic ? await caches.match(request) : null;
    const timeoutMs = cachedMatch ? 2000 : 8000;

    try {
      const response = await Promise.race([
        fetch(request),
        new Promise((_, reject) => setTimeout(() => reject(new Error('sw-timeout')), timeoutMs))
      ]);
      if (response && response.ok && !isRetryBust && isCacheableStatic && request.url.startsWith(self.location.origin)) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => {
          cache.put(request, copy);
          trimCache(CACHE, MAX_CACHE_ENTRIES);
        }).catch(() => {});
      }
      return response;
    } catch (e) {
      if (cachedMatch) return cachedMatch;
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') return caches.match(OFFLINE_URL);
      return Response.error();
    }
  })());
});

/* ═══════════════════════════════════════════════════════════
   Firebase Cloud Messaging — ব্যাকগ্রাউন্ড push notification
   (আগে firebase-messaging-sw.js-এ আলাদা register হতো, একই origin-এ
   দুটো আলাদা SW একসাথে থাকতে পারে না বলে এখানেই merge করে দেওয়া হলো —
   এখন শুধু এই একটা sw.js-ই register হবে, js/app.js থেকে)
   ═══════════════════════════════════════════════════════════ */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBdtIlcoPFFqzkI6X9KOIH-f4QAyEfH4o8",
  authDomain: "golapishoponline.firebaseapp.com",
  projectId: "golapishoponline",
  storageBucket: "golapishoponline.firebasestorage.app",
  messagingSenderId: "871653454194",
  appId: "1:871653454194:web:67e207a7df46503169edeb"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  self.registration.showNotification(
    payload.notification?.title || 'নতুন অর্ডার!',
    {
      body: payload.notification?.body || 'নতুন অর্ডার এসেছে',
      icon: '/icons/head_logo.webp',
      badge: '/icons/head_logo.webp',
      tag: 'order-' + Date.now(),
      renotify: true,
      vibrate: [300, 100, 300],
      requireInteraction: true,
      data: payload.data || {}
    }
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin) && 'focus' in c) {
          c.postMessage({ type: 'OPEN_ZM' });
          return c.focus();
        }
      }
      return clients.openWindow(self.location.origin + '#zone-manager');
    })
  );
});
