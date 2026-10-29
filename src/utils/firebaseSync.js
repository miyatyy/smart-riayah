import { db } from './firebaseConfig';
import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';

/**
 * ============================================================================
 * FIREBASE FIRESTORE SYNC HELPER (SMART RI'AYAH)
 * Menyinkronkan data santri, kartu RFID, permit & gate logs ke Google Firebase Firestore.
 * ============================================================================
 */

export async function syncSantriToFirebase(santri) {
  if (!db || !santri?.id) return;
  try {
    const ref = doc(db, 'santri', santri.id);
    await setDoc(ref, {
      ...santri,
      updatedAt: serverTimestamp()
    }, { merge: true });
    console.log('🔥 [Firebase Firestore] Santri tersinkron:', santri.id);
  } catch (error) {
    console.warn('⚠️ [Firebase] Gagal simpan santri:', error.message);
  }
}

export async function syncGateLogToFirebase(log) {
  if (!db || !log) return;
  try {
    const colRef = collection(db, 'gate_logs');
    await addDoc(colRef, {
      ...log,
      createdAt: serverTimestamp()
    });
    console.log('🔥 [Firebase Firestore] Gate log tersimpan');
  } catch (error) {
    console.warn('⚠️ [Firebase] Gagal simpan gate log:', error.message);
  }
}

export async function syncPermitToFirebase(permit) {
  if (!db || !permit?.id) return;
  try {
    const ref = doc(db, 'permits', permit.id);
    await setDoc(ref, {
      ...permit,
      updatedAt: serverTimestamp()
    }, { merge: true });
    console.log('🔥 [Firebase Firestore] Permit tersinkron:', permit.id);
  } catch (error) {
    console.warn('⚠️ [Firebase] Gagal simpan permit:', error.message);
  }
}

export async function syncRoomToFirebase(room) {
  if (!db || !room?.id) return;
  try {
    const ref = doc(db, 'rooms', room.id);
    await setDoc(ref, {
      ...room,
      updatedAt: serverTimestamp()
    }, { merge: true });
    console.log('🔥 [Firebase Firestore] Kamar tersinkron:', room.id);
  } catch (error) {
    console.warn('⚠️ [Firebase] Gagal simpan kamar:', error.message);
  }
}

export function subscribeToFirebaseCollection(collectionName, onUpdate) {
  if (!db) return () => {};
  try {
    const colRef = collection(db, collectionName);
    return onSnapshot(colRef, (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      onUpdate(items);
    }, (error) => {
      console.warn(`⚠️ [Firebase] Error subscribe ${collectionName}:`, error.message);
    });
  } catch (err) {
    console.warn(`⚠️ [Firebase] Subscribe exception ${collectionName}:`, err);
    return () => {};
  }
}
