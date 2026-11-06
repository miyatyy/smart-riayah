import { supabase } from './supabaseClient';

/**
 * Menyimpan data santri baru ke tabel 'santri' di database Supabase.
 *
 * Kolom tabel santri:
 * - id (string)
 * - nama_lengkap (string)
 * - nis (string/number)
 * - gender (string)
 * - kelas (string)
 * - kamar (string)
 * - rfid_uid (string)
 * - nama_wali (string)
 * - no_wali (string)
 * - saldo_rfid (number)
 * - limit_jajan_harian (number)
 * - poin_disiplin (number)
 * - status_asrama (string)
 *
 * @param {Object} santriData
 * @returns {Promise<{success: boolean, data?: any, error?: any}>}
 */
export async function insertSantriToSupabase(santriData) {
  const generatedId = santriData.id || `S-${Date.now().toString().slice(-4)}`;
  const gender = santriData.gender || 'L';
  const payload = {
    id: generatedId,
    nama_lengkap: (santriData.nama_lengkap || santriData.nama || '').trim(),
    nis: santriData.nis ? String(santriData.nis).trim() : `${Math.floor(125500 + Math.random() * 900)}`,
    gender: gender,
    kelas: santriData.kelas || (gender === 'P' ? '10-B (Putri)' : '10-A (Putra)'),
    kamar: santriData.kamar || santriData.kamar_id || santriData.kamarId || '',
    rfid_uid: (santriData.rfid_uid || santriData.rfidUid || '').trim().toUpperCase(),
    saldo_rfid: Number(santriData.saldo_rfid ?? santriData.saldoRfid ?? santriData.saldo_awal ?? santriData.saldoAwal) || 0,
    nama_wali: (santriData.nama_wali || santriData.waliNama || santriData.wali?.nama || '').trim(),
    no_wali: (santriData.no_wali || santriData.waliTelepon || santriData.wali?.telepon || '').replace(/[^0-9]/g, ''),
    limit_jajan_harian: Number(santriData.limit_jajan_harian || 25000),
    poin_disiplin: Number(santriData.poin_disiplin || 100),
    status_asrama: santriData.status_asrama || 'DI_ASRAMA'
  };

  try {
    console.log('📡 [Supabase insertSantri] Mengirim payload:', payload);

    const { data, error } = await supabase
      .from('santri')
      .insert([payload])
      .select();

    if (error) {
      console.error('❌ [Supabase insertSantri] Gagal menyimpan data ke tabel santri:', error);
      return { success: false, error };
    }

    console.log('✅ [Supabase insertSantri] Berhasil mendaftarkan santri:', data);
    return { success: true, data };
  } catch (err) {
    console.error('❌ [Supabase insertSantri] Exception tak terduga:', err);
    return { success: false, error: err };
  }
}

/**
 * Menghapus data santri dari database Supabase berdasarkan ID uniknya.
 * Eksekusi: supabase.from('santri').delete().eq('id', santriId)
 *
 * @param {string} santriId - ID unik santri (contoh: 'S-101')
 * @param {string} [santriNama] - Nama santri untuk log/pemberitahuan
 * @param {boolean} [skipConfirm] - Jika true, lewati window.confirm bawaan (cocok untuk custom modal)
 * @returns {Promise<{success: boolean, data?: any, error?: any, cancelled?: boolean}>}
 */
export async function deleteSantriData(santriId, santriNama = '', skipConfirm = false) {
  if (!santriId) {
    const errorMsg = 'ID Santri tidak valid atau kosong!';
    console.error('❌ [Supabase deleteSantriData]:', errorMsg);
    if (!skipConfirm) alert(`⚠️ Gagal: ${errorMsg}`);
    return { success: false, error: new Error(errorMsg) };
  }

  const label = santriNama ? `"${santriNama}" (ID: ${santriId})` : `santri ID: ${santriId}`;

  // Konfirmasi jika tidak skipConfirm
  if (!skipConfirm) {
    const isConfirmed = window.confirm(
      `⚠️ KONFIRMASI PENGHAPUSAN DATA SANTRI\n\nApakah Anda yakin ingin menghapus data ${label}?\n\nSemua data terkait santri ini di Supabase & Firebase akan dihapus permanen.`
    );
    if (!isConfirmed) {
      console.log('ℹ️ [Supabase deleteSantriData]: Penghapusan dibatalkan oleh pengguna.');
      return { success: false, cancelled: true };
    }
  }

  try {
    console.log(`📡 [Supabase deleteSantriData] Menghapus data ${label}...`);

    const { data, error } = await supabase
      .from('santri')
      .delete()
      .eq('id', santriId)
      .select();

    if (error) {
      console.error('❌ [Supabase deleteSantriData] Gagal menghapus santri dari Supabase:', error);
      if (!skipConfirm) {
        alert(`❌ Gagal menghapus data santri!\n\nDetail Error: ${error.message || JSON.stringify(error)}`);
      }
      return { success: false, error };
    }

    if (!skipConfirm) {
      alert(`🗑️ Sukses! Data santri ${label} telah berhasil dihapus dari database.`);
    }
    console.log(`✅ [Supabase deleteSantriData] Berhasil menghapus ${label} dari Supabase:`, data);
    return { success: true, data };
  } catch (err) {
    console.error('❌ [Supabase deleteSantriData] Exception tak terduga:', err);
    if (!skipConfirm) {
      alert(`❌ Terjadi kesalahan sistem saat menghapus santri:\n${err?.message || err}`);
    }
    return { success: false, error: err };
  }
}

