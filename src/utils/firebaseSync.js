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
 * FIREBASE FIRESTORE SYNC SERVICE (SMART RI'AYAH)
 * Menyinkronkan seluruh kategori data ke Google Firebase Firestore:
 * - santri
 * - rooms
 * - permits
 * - gate_logs
 * - discipline_records
 * - medical_records
 * - rfid_transactions
 * - mutabaah
 * ============================================================================
 */

export async function syncSantriToFirebase(santri) {
  if (!db || !santri?.id) return;
  try {
    const ref = doc(db, 'santri', String(santri.id));
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
    const ref = doc(db, 'permits', String(permit.id));
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
    const ref = doc(db, 'rooms', String(room.id));
    await setDoc(ref, {
      ...room,
      updatedAt: serverTimestamp()
    }, { merge: true });
    console.log('🔥 [Firebase Firestore] Kamar tersinkron:', room.id);
  } catch (error) {
    console.warn('⚠️ [Firebase] Gagal simpan kamar:', error.message);
  }
}

export async function deleteRoomFromFirebase(roomId) {
  if (!db || !roomId) return;
  try {
    const ref = doc(db, 'rooms', String(roomId));
    await deleteDoc(ref);
    console.log('🔥 [Firebase Firestore] Kamar dihapus:', roomId);
  } catch (error) {
    console.warn('⚠️ [Firebase] Gagal hapus kamar:', error.message);
  }
}

export async function syncDisciplineToFirebase(record) {
  if (!db || !record?.id) return;
  try {
    const ref = doc(db, 'discipline_records', String(record.id));
    await setDoc(ref, {
      ...record,
      updatedAt: serverTimestamp()
    }, { merge: true });
    console.log('🔥 [Firebase Firestore] Kedisiplinan tersinkron:', record.id);
  } catch (error) {
    console.warn('⚠️ [Firebase] Gagal simpan kedisiplinan:', error.message);
  }
}

export async function syncMedicalToFirebase(record) {
  if (!db || !record?.id) return;
  try {
    const ref = doc(db, 'medical_records', String(record.id));
    await setDoc(ref, {
      ...record,
      updatedAt: serverTimestamp()
    }, { merge: true });
    console.log('🔥 [Firebase Firestore] Rekam Medis tersinkron:', record.id);
  } catch (error) {
    console.warn('⚠️ [Firebase] Gagal simpan rekam medis:', error.message);
  }
}

export async function syncRfidTransactionToFirebase(trx) {
  if (!db || !trx?.id) return;
  try {
    const ref = doc(db, 'rfid_transactions', String(trx.id));
    await setDoc(ref, {
      ...trx,
      updatedAt: serverTimestamp()
    }, { merge: true });
    console.log('🔥 [Firebase Firestore] Transaksi RFID tersinkron:', trx.id);
  } catch (error) {
    console.warn('⚠️ [Firebase] Gagal simpan transaksi RFID:', error.message);
  }
}

export async function syncMutabaahToFirebase(record) {
  if (!db || !record) return;
  try {
    const docId = `${record.santriId || record.santri_id}_${record.tanggal || new Date().toISOString().split('T')[0]}`;
    const ref = doc(db, 'mutabaah', docId);
    await setDoc(ref, {
      ...record,
      updatedAt: serverTimestamp()
    }, { merge: true });
    console.log('🔥 [Firebase Firestore] Mutabaah tersinkron:', docId);
  } catch (error) {
    console.warn('⚠️ [Firebase] Gagal simpan mutabaah:', error.message);
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
