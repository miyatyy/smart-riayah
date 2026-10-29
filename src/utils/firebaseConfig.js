import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getAnalytics, isSupported } from 'firebase/analytics';

/**
 * ============================================================================
 * KONFIGURASI FIREBASE CLIENT (SMART RI'AYAH)
 * Project ID: project-78a1c2b7-f463-45cb-8ca
 * Console: https://console.firebase.google.com/project/project-78a1c2b7-f463-45cb-8ca/overview
 * ============================================================================
 */

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB2f_VF6eASARQmMTMqcr251oWKo70GREc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "project-78a1c2b7-f463-45cb-8ca.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "project-78a1c2b7-f463-45cb-8ca",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "project-78a1c2b7-f463-45cb-8ca.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "24105619082",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:24105619082:web:d562dbc5525bbbe1806773",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-7PX45CNFMB"
};

// Inisialisasi Firebase App secara aman
let app = null;
let db = null;
let auth = null;
let storage = null;
let analytics = null;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  db = getFirestore(app);
  auth = getAuth(app);
  storage = getStorage(app);

  // Inisialisasi Analytics hanya di browser environment
  if (typeof window !== 'undefined') {
    isSupported().then(supported => {
      if (supported) {
        analytics = getAnalytics(app);
        console.log('📊 [Firebase Analytics] Terhubung:', firebaseConfig.measurementId);
      }
    }).catch(err => {
      console.warn('ℹ️ [Firebase Analytics] Not supported in this environment:', err.message);
    });
  }

  console.log('🔥 [Firebase] Berhasil terhubung ke project:', firebaseConfig.projectId);
} catch (error) {
  console.error('❌ [Firebase] Inisialisasi gagal:', error);
}

export { app, db, auth, storage, analytics };
