import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  initializeAuth,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

/*
 * Production Firebase config is intentionally pinned here.
 * Firebase web config is public client configuration, not a secret. Keeping one
 * canonical config prevents Netlify/Vite environment variables from silently
 * pointing the Driver app at a different Firebase project.
 */
const firebaseConfig = {
  apiKey: 'AIzaSyBdtIlcoPFFqzkI6X9KOIH-f4QAyEfH4o8',
  authDomain: 'golapishoponline.firebaseapp.com',
  projectId: 'golapishoponline',
  storageBucket: 'golapishoponline.firebasestorage.app',
  messagingSenderId: '871653454194',
  appId: '1:871653454194:web:67e207a7df46503169edeb',
};

const app = initializeApp(firebaseConfig);

/*
 * Explicit persistence order makes authentication robust on mobile Safari and
 * embedded/webview contexts. If local/session storage is unavailable, Firebase
 * can still keep the current session in memory instead of failing sign-in.
 */
export const auth = initializeAuth(app, {
  persistence: [browserLocalPersistence, browserSessionPersistence, inMemoryPersistence],
});

export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'asia-south1');
