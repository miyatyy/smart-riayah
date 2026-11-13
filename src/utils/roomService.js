import { supabase } from './supabaseClient';

/**
 * Memperbarui data kamar di Supabase Database.
 * 
 * @param {string|number} roomId - ID unik kamar yang akan diupdate
 * @param {Object} updatedData - Data baru kamar
 * @returns {Promise<{success: boolean, data?: any, error?: any}>}
 */
export async function updateRoomData(roomId, updatedData) {
  if (!roomId) {
    const errorMsg = 'ID Kamar wajib disertakan untuk melakukan update data!';
    console.error('❌ [Supabase updateRoomData]:', errorMsg);
    alert(`⚠️ Gagal: ${errorMsg}`);
    return { success: false, error: new Error(errorMsg) };
  }

  const payload = {
    nomor_kamar: updatedData.nomorKamar || updatedData.nama_kamar || updatedData.namaKamar,
    kapasitas: updatedData.kapasitas ? parseInt(updatedData.kapasitas, 10) : undefined,
    ketua_kamar: updatedData.ketuaKamar || updatedData.ketua || updatedData.ketua_kamar,
    catatan_inspeksi: updatedData.catatanInspeksi !== undefined ? updatedData.catatanInspeksi : updatedData.catatan,
    updated_at: new Date().toISOString()
  };

  Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

  try {
    const { data, error } = await supabase
      .from('rooms')
      .update(payload)
      .eq('id', roomId)
      .select();

    if (error) throw error;

    const roomName = payload.nomor_kamar || `ID: ${roomId}`;
    alert(`✅ Berhasil! Data kamar "${roomName}" telah berhasil diperbarui di database.`);
    
    console.log('✅ [Supabase updateRoomData] Sukses:', { roomId, data });
    return { success: true, data };
  } catch (error) {
    const errorMessage = error?.message || 'Terjadi kesalahan pada koneksi server database.';
    console.error('❌ [Supabase updateRoomData] Error:', error);
    alert(`❌ Gagal memperbarui data kamar!\nDetail Error: ${errorMessage}`);
    return { success: false, error };
  }
}

/**
 * Menghapus data kamar dari Supabase Database dengan konfirmasi dialog.
 * 
 * @param {string|number} roomId - ID unik kamar yang akan dihapus
 * @param {string} [roomName] - Nama kamar untuk ditampilkan pada pop-up konfirmasi
 * @param {boolean} [skipConfirm] - Jika true, lewati window.confirm bawaan (cocok untuk custom modal)
 * @returns {Promise<{success: boolean, cancelled?: boolean, error?: any}>}
 */
export async function deleteRoomData(roomId, roomName = '', skipConfirm = false) {
  // 1. Validasi parameter ID
  if (!roomId) {
    const errorMsg = 'ID Kamar tidak valid atau tidak ditemukan!';
    console.error('❌ [Supabase deleteRoomData]:', errorMsg);
    if (!skipConfirm) alert(`⚠️ Gagal: ${errorMsg}`);
    return { success: false, error: new Error(errorMsg) };
  }

  const displayName = roomName ? `"${roomName}" (ID: ${roomId})` : `kamar ID: ${roomId}`;

  // 2. Dialog konfirmasi hapus kepada pengguna (window.confirm) jika tidak skipConfirm
  if (!skipConfirm) {
    const isConfirmed = window.confirm(
      `⚠️ KONFIRMASI PENGHAPUSAN KAMAR\n\nApakah Anda yakin ingin menghapus data ${displayName}?\n\nData yang dihapus tidak dapat dipulihkan kembali.`
    );

    // Jika pengguna membatalkan (klik Cancel)
    if (!isConfirmed) {
      console.log('ℹ️ [Supabase deleteRoomData]: Penghapusan dibatalkan oleh pengguna.');
      return { success: false, cancelled: true };
    }
  }

  try {
    // 3. Eksekusi query DELETE ke Supabase
    const { data, error } = await supabase
      .from('rooms')
      .delete()
      .eq('id', roomId);

    // 4. Tangani error dari Supabase
    if (error) {
      throw error;
    }

    // 5. Alert pemberitahuan berhasil
    if (!skipConfirm) {
      alert(`🗑️ Sukses! Data kamar ${displayName} telah berhasil dihapus dari database.`);
    }
    console.log('✅ [Supabase deleteRoomData] Sukses menghapus kamar:', roomId);
    
    return { success: true, data };
  } catch (error) {
    // 6. Tangani error & tampilkan alert gagal
    const errorMessage = error?.message || 'Gagal menghapus data kamar dari database.';
    console.error('❌ [Supabase deleteRoomData] Error:', error);
    if (!skipConfirm) {
      alert(`❌ Terjadi Kesalahan Saat Menghapus Kamar!\n\nDetail Error: ${errorMessage}`);
    }
    
    return { success: false, error };
  }
}

/**
 * Berlangganan (Subscribe) perubahan Realtime tabel 'rooms' di Supabase.
 * Menangkap event INSERT, UPDATE, dan DELETE secara otomatis.
 * 
 * @param {Object} handlers - Callback functions
 * @param {Function} [handlers.onInsert] - Dipanggil saat data kamar baru ditambahkan
 * @param {Function} [handlers.onUpdate] - Dipanggil saat data kamar diperbarui
 * @param {Function} [handlers.onDelete] - Dipanggil saat data kamar dihapus
 * @returns {Function} Unsubscribe cleanup function
 */
export function subscribeToRoomChanges({ onInsert, onUpdate, onDelete }) {
  const channel = supabase
    .channel('realtime:rooms_sync')
    .on(
      'postgres_changes',
      {
        event: '*', // Listen ke semua event (INSERT, UPDATE, DELETE)
        schema: 'public',
        table: 'rooms',
      },
      (payload) => {
        console.log('⚡ [Supabase Realtime] Perubahan terdeteksi:', payload.eventType, payload);

        if (payload.eventType === 'INSERT' && onInsert) {
          onInsert(payload.new);
        } else if (payload.eventType === 'UPDATE' && onUpdate) {
          onUpdate(payload.new);
        } else if (payload.eventType === 'DELETE' && onDelete) {
          onDelete(payload.old);
        }
      }
    )
    .subscribe((status) => {
      console.log('📡 [Supabase Realtime] Status koneksi channel:', status);
    });

  // Mengembalikan fungsi unbind / cleanup untuk dipanggil saat component unmount
  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Mengecek apakah santri tertentu menempati kamar yang diberikan.
 * Memeriksa pencocokan ID kamar, label teks kamar, nomor kamar, dan kategori gedung (Putra/Putri).
 */
export function isSantriInRoom(santri, room) {
  if (!santri || !room) return false;

  const roomIdStr = room.id ? String(room.id).trim().toLowerCase() : '';
  const roomNomor = String(room.nomorKamar || '').trim().toLowerCase();
  const roomGedung = String(room.namaGedung || '').trim().toLowerCase();
  const isRoomPutri = room.kategoriGedung === 'PUTRI';

  // 1. Direct kamarId match
  if (santri.kamarId) {
    const sKamarIdStr = String(santri.kamarId).trim().toLowerCase();
    if (roomIdStr && sKamarIdStr === roomIdStr) return true;
    if (roomNomor && sKamarIdStr === roomNomor) return true;
  }

  // 2. Kamar text matching
  const sKamar = String(santri.kamar || '').trim().toLowerCase();
  if (!sKamar || sKamar === '-' || sKamar.includes('belum')) return false;

  // Gender safety: Santriwati (Putri) tidak boleh di kamar Putra, dan sebaliknya
  const isSantriPutri = santri.gender === 'P' || (santri.kelas && santri.kelas.toLowerCase().includes('putri'));
  if (room.kategoriGedung && ((isRoomPutri && !isSantriPutri) || (!isRoomPutri && isSantriPutri))) {
    return false;
  }

  // Exact room name match
  if (roomNomor && sKamar === roomNomor) return true;

  // String inclusion (contoh: 'Asrama Putri Siti Aisyah - Kamar 202' contains 'kamar 202')
  if (roomNomor && sKamar.includes(roomNomor)) return true;

  // Nomor kamar contains sKamar jika sKamar minimal 3 karakter
  if (roomNomor && sKamar.length >= 3 && roomNomor.includes(sKamar)) return true;

  // Digits matching dalam gedung / konteks yang sama
  const sDigits = (sKamar.match(/\d+/) || [])[0];
  const rDigits = (roomNomor.match(/\d+/) || [])[0];
  if (sDigits && rDigits && sDigits === rDigits) {
    const buildingKeywords = ['aisyah', 'khadijah', 'umar', 'khattab', 'abu bakar', 'utsman', 'ali', 'khalid'];
    const sFound = buildingKeywords.filter(k => sKamar.includes(k));
    const rFound = buildingKeywords.filter(k => roomGedung.includes(k) || roomNomor.includes(k));
    if (sFound.length > 0 && rFound.length > 0) {
      return sFound.some(k => rFound.includes(k));
    }
    return true;
  }

  return false;
}

/**
 * Mengambil daftar santri yang menempati kamar tertentu.
 */
export function getRoomOccupants(room, santriList = []) {
  if (!room || !Array.isArray(santriList)) return [];
  return santriList.filter(s => isSantriInRoom(s, room));
}
