import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBdtIlcoPFFqzkI6X9KOIH-f4QAyEfH4o8',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'golapishoponline.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'golapishoponline',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'golapishoponline.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '871653454194',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:871653454194:web:67e207a7df46503169edeb',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
// functions/index.js-এর setGlobalOptions({ region: 'asia-south1' })-এর সাথে region মিলিয়ে
// রাখা জরুরি — না মিললে httpsCallable() 'not-found'/'internal' error দেয়।
export const functions = getFunctions(app, 'asia-south1');
