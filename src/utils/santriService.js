import { supabase } from './supabaseClient';

/**
 * Menyimpan data santri baru ke tabel 'santri' di database Supabase.
 *
 * Kolom tabel santri:
 * - nama_lengkap (string)
 * - nis (string/number)
 * - gender (string)
 * - kamar_id (foreign key / id kamar)
 * - rfid_uid (string)
 * - saldo_awal (number)
 * - nama_wali (string)
 *
 * @param {Object} santriData
 * @returns {Promise<{success: boolean, data?: any, error?: any}>}
 */
export async function insertSantriToSupabase(santriData) {
  const payload = {
    nama_lengkap: (santriData.nama_lengkap || santriData.nama || '').trim(),
    nis: santriData.nis ? String(santriData.nis).trim() : `${Math.floor(125500 + Math.random() * 900)}`,
    gender: santriData.gender || 'L',
    kamar_id: santriData.kamar_id || santriData.kamarId || null,
    rfid_uid: (santriData.rfid_uid || santriData.rfidUid || '').trim().toUpperCase(),
    saldo_awal: Number(santriData.saldo_awal ?? santriData.saldoAwal) || 0,
    nama_wali: (santriData.nama_wali || santriData.waliNama || '').trim()
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

