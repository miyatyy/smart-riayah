import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

/**
 * ============================================================================
 * KONFIGURASI FIREBASE CLIENT (SMART RI'AYAH)
 * Project ID: project-78a1c2b7-f463-45cb-8ca
 * Console: https://console.firebase.google.com/project/project-78a1c2b7-f463-45cb-8ca/overview
 * ============================================================================
 */

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "project-78a1c2b7-f463-45cb-8ca.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "project-78a1c2b7-f463-45cb-8ca",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "project-78a1c2b7-f463-45cb-8ca.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};

// Inisialisasi Firebase App secara aman (mencegah duplikasi instance & crash jika apiKey belum diisi)
let app = null;
let db = null;
let auth = null;
let storage = null;

try {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey.trim() !== '') {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
    console.log('🔥 [Firebase] Terhubung ke project:', firebaseConfig.projectId);
  } else {
    console.info('ℹ️ [Firebase] Siap: Silakan lengkapi VITE_FIREBASE_API_KEY di file .env dari Firebase Console Anda.');
  }
} catch (error) {
  console.error('❌ [Firebase] Inisialisasi gagal:', error);
}

export { app, db, auth, storage };
