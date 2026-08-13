import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup, updateProfile,
  signInWithPhoneNumber, RecaptchaVerifier
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, setDoc, getDoc, getDocs, addDoc,
  updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot,
  serverTimestamp, increment, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

/* ⚠️ আগে analytics ও messaging module উপরে static import করা হতো (app/auth/firestore/
   storage-এর সাথে একই import গ্রুপে)। ES module-এর নিয়ম অনুযায়ী একটা <script type="module">-এর
   ভেতরের সব static import সম্পূর্ণ ডাউনলোড/parse না হওয়া পর্যন্ত নিচের একটা লাইনও রান হয় না।
   ফলে analytics/messaging ফাইল দুটো (যেগুলো non-critical — না থাকলেও সাইট চলে) কোনো কারণে
   স্লো/ব্যর্থ হলে — auth, db, storage সহ পুরো Firebase-ই কখনো চালু হতো না, আর ব্যবহারকারী
   স্থায়ীভাবে "সংযোগ স্থাপন করতে সমস্যা হচ্ছে" স্ক্রিনে আটকে থাকতো, যদিও মূল সংযোগে কোনো
   সমস্যা ছিল না। এখন এই দুটো module dynamic import() দিয়ে আলাদা করা হলো — এগুলো ব্যর্থ হলেও
   core Firebase (auth/db/storage) সাথে সাথে চালু হয়ে যাবে। */

const firebaseConfig = {
  apiKey: "AIzaSyBdtIlcoPFFqzkI6X9KOIH-f4QAyEfH4o8",
  authDomain: "golapishoponline.firebaseapp.com",
  projectId: "golapishoponline",
  storageBucket: "golapishoponline.firebasestorage.app",
  messagingSenderId: "871653454194",
  appId: "1:871653454194:web:67e207a7df46503169edeb",
  measurementId: "G-EZX9JH30DB"
};

try{
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);
  const functions = getFunctions(app, 'asia-south1');

  window.__fb = {
    auth, db, storage, functions, GoogleAuthProvider,
    onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
    signOut, signInWithPopup, updateProfile,
    signInWithPhoneNumber, RecaptchaVerifier,
    collection, doc, setDoc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
    query, where, orderBy, limit, onSnapshot, serverTimestamp, increment, runTransaction,
    storageRef, uploadBytes, getDownloadURL, httpsCallable
  };
  // Classic staff/ERP scripts use both the lexical `FB` binding and
  // `window.FB` readiness checks. Keep one canonical SDK facade available
  // through both paths before announcing that Firebase is ready.
  window.FB = window.__fb;
  window.dispatchEvent(new Event('firebase-ready'));

  /* ---------- Analytics: lazy-loaded, ৫সে পরে, ব্যর্থ হলেও কোনো প্রভাব নেই ---------- */
  setTimeout(() => {
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js")
      .then(({ getAnalytics, isSupported }) => isSupported().then(ok => { if (ok) getAnalytics(app); }))
      .catch(()=>{});
  }, 5000);

  /* ---------- FCM: customer push token capture (lazy-loaded messaging module) ---------- */
  /* VAPID key — Firebase Console > Project Settings > Cloud Messaging > Web Push certificates */
  const VAPID_KEY = 'BPRxIznMoYaznW3dnf-OcB-MSplrzV6xA2bWWbPENH37-iAelbKjcwO50XbGMirLpNu6w4XZBr7kwZLPepf9KRQ';

  async function registerPushToken(userId){
    try{
      const { getMessaging, getToken, isSupported: messagingIsSupported } =
        await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js");
      const supported = await messagingIsSupported();
      if(!supported || !('Notification' in window)) return;
      // ⚠️ আগে login হলেই স্বয়ংক্রিয়ভাবে notification permission popup আসতো —
      // অনেক mobile browser এটা block করে বা বিরক্তিকর মনে করে। এখন শুধু
      // permission আগে থেকেই 'granted' থাকলে (আগে কখনো manually অনুমতি দেওয়া
      // হয়েছিল) নীরবে token রেজিস্টার হয় — নতুন করে prompt কখনো auto-দেখানো হয় না,
      // সেটা এখন শুধু "নোটিফিকেশন চালু করুন" বাটনে ট্যাপ করলেই হয় (NotifHelper)।
      if(Notification.permission !== 'granted') return;
      const messaging = getMessaging(app);
      const swReg = await navigator.serviceWorker.getRegistration('/');
      const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
      if(token){
        await setDoc(doc(db,'fcmTokens', userId), { token, updatedAt: serverTimestamp() }, { merge:true });
      }
    }catch(e){ console.warn('FCM token error', e.message); }
  }
  window.__fb.registerPushToken = registerPushToken;

  onAuthStateChanged(auth, user=>{
    if(user) registerPushToken(user.uid);
  });

}catch(initErr){
  console.error('Firebase initialization failed:', initErr);
}
