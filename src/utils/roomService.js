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
 * @returns {Promise<{success: boolean, cancelled?: boolean, error?: any}>}
 */
export async function deleteRoomData(roomId, roomName = '') {
  // 1. Validasi parameter ID
  if (!roomId) {
    const errorMsg = 'ID Kamar tidak valid atau tidak ditemukan!';
    console.error('❌ [Supabase deleteRoomData]:', errorMsg);
    alert(`⚠️ Gagal: ${errorMsg}`);
    return { success: false, error: new Error(errorMsg) };
  }

  // 2. Dialog konfirmasi hapus kepada pengguna (window.confirm)
  const displayName = roomName ? `"${roomName}" (ID: ${roomId})` : `kamar ID: ${roomId}`;
  const isConfirmed = window.confirm(
    `⚠️ KONFIRMASI PENGHAPUSAN KAMAR\n\nApakah Anda yakin ingin menghapus data ${displayName}?\n\nData yang dihapus tidak dapat dipulihkan kembali.`
  );

  // Jika pengguna membatalkan (klik Cancel)
  if (!isConfirmed) {
    console.log('ℹ️ [Supabase deleteRoomData]: Penghapusan dibatalkan oleh pengguna.');
    return { success: false, cancelled: true };
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
    alert(`🗑️ Sukses! Data kamar ${displayName} telah berhasil dihapus dari database.`);
    console.log('✅ [Supabase deleteRoomData] Sukses menghapus kamar:', roomId);
    
    return { success: true, data };
  } catch (error) {
    // 6. Tangani error & tampilkan alert gagal
    const errorMessage = error?.message || 'Gagal menghapus data kamar dari database.';
    console.error('❌ [Supabase deleteRoomData] Error:', error);
    alert(`❌ Terjadi Kesalahan Saat Menghapus Kamar!\n\nDetail Error: ${errorMessage}`);
    
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
