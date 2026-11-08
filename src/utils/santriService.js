import { supabase } from './supabaseClient';

/**
 * Utility pengecekan kemiripan nama santri untuk mendeteksi variasi ejaan
 * (contoh: 'Nurmiyati' vs 'Nurmiyaty', 'Dewi' vs 'Dewi Sartika')
 */
export function isNameSimilar(a, b) {
  if (!a || !b) return false;
  const s1 = a.trim().toLowerCase().replace(/[^a-z0-9]/g, '').replace(/y$/, 'i');
  const s2 = b.trim().toLowerCase().replace(/[^a-z0-9]/g, '').replace(/y$/, 'i');
  if (s1 === s2) return true;
  if (s1.includes(s2) || s2.includes(s1)) return true;
  if (s1.length >= 4 && s2.length >= 4 && (s1.startsWith(s2.slice(0, 5)) || s2.startsWith(s1.slice(0, 5)))) return true;
  return false;
}

/**
 * Menyimpan data santri baru atau memperbarui data santri ke tabel 'santri' di database Supabase.
 * Menangani secara cerdas:
 * 1. Deteksi duplikasi rfid_uid sebelum insert untuk mencegah 409 unique constraint error ("santri_rfid_uid_key").
 * 2. Jika santri yang sama (nama / NIS / ID cocok), lakukan UPDATE otomatis tanpa membuat duplikat ID.
 * 3. Jika kartu dialihkan (options.reassignCard: true), lepaskan rfid_uid dari santri lama terlebih dahulu.
 * 4. Jika kartu milik santri lain dan bukan reassign, kembalikan pesan ramah & detail pemilik saat ini.
 *
 * Kolom tabel santri:
 * - id (string, misal 'S-101')
 * - nama_lengkap (string)
 * - nis (string/number)
 * - gender (string)
 * - kelas (string)
 * - kamar (string)
 * - rfid_uid (string, UNIQUE)
 * - nama_wali (string)
 * - no_wali (string)
 * - saldo_rfid (number)
 * - limit_jajan_harian (number)
 * - poin_disiplin (number)
 * - status_asrama (string)
 * - updated_at (timestamp)
 *
 * @param {Object} santriData
 * @param {Object} [options]
 * @param {boolean} [options.reassignCard] - Jika true, alihkan kartu dari pemilik lama ke santri ini
 * @param {boolean} [options.forceUpdate] - Jika true, paksa update record jika ditemukan
 * @returns {Promise<{success: boolean, isUpdated?: boolean, isReassigned?: boolean, reassignedFrom?: string, duplicateUid?: boolean, existingSantri?: any, data?: any, error?: any, message?: string}>}
 */
export async function insertSantriToSupabase(santriData, options = {}) {
  const generatedId = santriData.id || `S-${Date.now().toString().slice(-4)}`;
  const gender = santriData.gender || 'L';
  const cleanUid = (santriData.rfid_uid || santriData.rfidUid || '').trim().toUpperCase();
  const cleanNama = (santriData.nama_lengkap || santriData.nama || '').trim();
  const cleanNis = santriData.nis ? String(santriData.nis).trim() : `${Math.floor(125500 + Math.random() * 900)}`;
  const cleanNoWali = (santriData.no_wali || santriData.waliTelepon || santriData.wali?.telepon || '').replace(/[^0-9]/g, '');

  const payload = {
    id: generatedId,
    nama_lengkap: cleanNama,
    nis: cleanNis,
    gender: gender,
    kelas: santriData.kelas || (gender === 'P' ? '10-B (Putri)' : '10-A (Putra)'),
    kamar: santriData.kamar || santriData.kamar_id || santriData.kamarId || '',
    rfid_uid: cleanUid || null,
    saldo_rfid: Number(santriData.saldo_rfid ?? santriData.saldoRfid ?? santriData.saldo_awal ?? santriData.saldoAwal) || 0,
    nama_wali: (santriData.nama_wali || santriData.waliNama || santriData.wali?.nama || '').trim(),
    no_wali: cleanNoWali,
    limit_jajan_harian: Number(santriData.limit_jajan_harian || 25000),
    poin_disiplin: Number(santriData.poin_disiplin || 100),
    status_asrama: santriData.status_asrama || 'DI_ASRAMA',
    updated_at: new Date().toISOString()
  };

  try {
    console.log('📡 [Supabase insertSantri] Memproses payload santri:', payload);

    // 1. Cek apakah ada record yang menggunakan rfid_uid ini di Supabase
    let existingSantriByUid = null;
    if (cleanUid) {
      const { data: matchRows, error: checkUidErr } = await supabase
        .from('santri')
        .select('*')
        .ilike('rfid_uid', cleanUid)
        .limit(1);

      if (!checkUidErr && matchRows && matchRows.length > 0) {
        existingSantriByUid = matchRows[0];
      }
    }

    // 2. Cek apakah ada record dengan ID yang sama
    let existingSantriById = null;
    if (payload.id) {
      const { data: matchIdRows, error: checkIdErr } = await supabase
        .from('santri')
        .select('*')
        .eq('id', payload.id)
        .limit(1);

      if (!checkIdErr && matchIdRows && matchIdRows.length > 0) {
        existingSantriById = matchIdRows[0];
      }
    }

    // 3. Logika Penanganan Duplikasi / Update
    if (existingSantriByUid) {
      const isSameStudent = 
        (existingSantriById && existingSantriById.id === existingSantriByUid.id) ||
        isNameSimilar(cleanNama, existingSantriByUid.nama_lengkap) ||
        (existingSantriByUid.nis && String(existingSantriByUid.nis) === cleanNis) ||
        options.forceUpdate;

      if (isSameStudent) {
        // Santri yang sama: UPDATE datanya tanpa membuat id baru
        console.log(`ℹ️ [Supabase insertSantri] Santri "${cleanNama}" cocok dengan data tersimpan (ID: ${existingSantriByUid.id}). Memperbarui data...`);
        const updatePayload = {
          ...payload,
          id: existingSantriByUid.id
        };

        const { data: updatedData, error: updateErr } = await supabase
          .from('santri')
          .update(updatePayload)
          .eq('id', existingSantriByUid.id)
          .select();

        if (updateErr) {
          console.error('❌ [Supabase insertSantri] Gagal update santri:', updateErr);
          return { success: false, error: updateErr };
        }

        console.log('✅ [Supabase insertSantri] Berhasil memperbarui data santri:', updatedData);
        return {
          success: true,
          isUpdated: true,
          isSameSantri: true,
          data: updatedData?.[0] || updatePayload,
          message: `Data santri "${cleanNama}" (ID: ${existingSantriByUid.id}) berhasil diperbarui!`
        };
      }

      // Santri berbeda tapi kartu sama
      if (options.reassignCard) {
        // Alihkan kartu: lepas rfid_uid dari seluruh record yang menggunakan kartu ini
        console.log(`🔄 [Supabase insertSantri] Melepaskan kartu [${cleanUid}] dari "${existingSantriByUid.nama_lengkap}" (ID: ${existingSantriByUid.id})...`);
        await supabase
          .from('santri')
          .update({ rfid_uid: null, updated_at: new Date().toISOString() })
          .ilike('rfid_uid', cleanUid);

        // Simpan santri baru
        const { data: insertedData, error: insertErr } = await supabase
          .from('santri')
          .upsert([payload], { onConflict: 'id' })
          .select();

        if (insertErr) {
          console.error('❌ [Supabase insertSantri] Gagal menyimpan santri setelah alih kartu:', insertErr);
          return { success: false, error: insertErr };
        }

        console.log(`✅ [Supabase insertSantri] Berhasil mengalihkan kartu ke "${cleanNama}":`, insertedData);
        return {
          success: true,
          isReassigned: true,
          reassignedFrom: existingSantriByUid.nama_lengkap,
          reassignedFromId: existingSantriByUid.id,
          data: insertedData?.[0] || payload,
          message: `Kartu RFID [${cleanUid}] berhasil dialihkan dari "${existingSantriByUid.nama_lengkap}" ke "${cleanNama}".`
        };
      }

      // Santri berbeda dan bukan reassign -> kembalikan pesan duplikasi yang informatif
      console.warn(`⚠️ [Supabase insertSantri] Kartu [${cleanUid}] sudah dipakai oleh "${existingSantriByUid.nama_lengkap}".`);
      return {
        success: false,
        duplicateUid: true,
        existingSantri: existingSantriByUid,
        error: {
          code: '23505',
          message: `Kartu RFID [${cleanUid}] sudah terdaftar atas nama "${existingSantriByUid.nama_lengkap}" (NIS: ${existingSantriByUid.nis || '-'}).`
        }
      };
    }

    // 4. Jika ID sudah ada (misal update santri tanpa collision UID)
    if (existingSantriById) {
      const { data: updatedData, error: updateErr } = await supabase
        .from('santri')
        .update(payload)
        .eq('id', payload.id)
        .select();

      if (updateErr) {
        console.error('❌ [Supabase insertSantri] Gagal update via id:', updateErr);
        return { success: false, error: updateErr };
      }

      return {
        success: true,
        isUpdated: true,
        data: updatedData?.[0] || payload,
        message: `Data santri "${cleanNama}" berhasil diperbarui!`
      };
    }

    // 5. Insert santri baru secara bersih
    const { data: insertedData, error: insertError } = await supabase
      .from('santri')
      .insert([payload])
      .select();

    if (insertError) {
      // Jika terjadi race condition atau constraint violation tak terduga (code 23505 / santri_rfid_uid_key / duplicate key)
      if (
        insertError.code === '23505' ||
        insertError.message?.includes('santri_rfid_uid_key') ||
        insertError.message?.toLowerCase().includes('duplicate key')
      ) {
        console.warn('⚠️ [Supabase insertSantri] Terdeteksi constraint unik rfid_uid, mencoba pemulihan otomatis...');
        
        const { data: conflictRows } = await supabase
          .from('santri')
          .select('*')
          .ilike('rfid_uid', cleanUid)
          .limit(1);

        const conflictRow = (conflictRows && conflictRows.length > 0) ? conflictRows[0] : null;

        if (conflictRow) {
          const namesMatch = isNameSimilar(cleanNama, conflictRow.nama_lengkap);

          if (namesMatch || options.forceUpdate) {
            const { data: recoverData } = await supabase
              .from('santri')
              .update({ ...payload, id: conflictRow.id })
              .eq('id', conflictRow.id)
              .select();

            return {
              success: true,
              isUpdated: true,
              data: recoverData?.[0] || payload,
              message: `Data santri "${cleanNama}" berhasil disinkronkan ke Supabase!`
            };
          }

          if (options.reassignCard) {
            await supabase
              .from('santri')
              .update({ rfid_uid: null, updated_at: new Date().toISOString() })
              .eq('id', conflictRow.id);

            const { data: retryData } = await supabase
              .from('santri')
              .insert([payload])
              .select();

            return {
              success: true,
              isReassigned: true,
              reassignedFrom: conflictRow.nama_lengkap,
              data: retryData?.[0] || payload,
              message: `Kartu RFID [${cleanUid}] berhasil dialihkan ke "${cleanNama}".`
            };
          }

          return {
            success: false,
            duplicateUid: true,
            existingSantri: conflictRow,
            error: {
              code: '23505',
              message: `Kartu RFID [${cleanUid}] sudah terdaftar untuk "${conflictRow.nama_lengkap}".`
            }
          };
        }

        // Jika conflictRow tidak terbaca dari SELECT, tetapi nama santri cocok / santri update
        const { data: directUpdate, error: directUpdateErr } = await supabase
          .from('santri')
          .update(payload)
          .ilike('rfid_uid', cleanUid)
          .select();

        if (!directUpdateErr && directUpdate && directUpdate.length > 0) {
          return {
            success: true,
            isUpdated: true,
            data: directUpdate[0],
            message: `Data santri dengan kartu [${cleanUid}] berhasil diperbarui di Supabase!`
          };
        }

        // Tetap kembalikan duplicateUid: true agar tidak memicu alert error mentah
        return {
          success: false,
          duplicateUid: true,
          existingSantri: { nama_lengkap: 'Santri Terdaftar di Database', rfid_uid: cleanUid },
          error: {
            code: '23505',
            message: `Kartu RFID [${cleanUid}] sudah terdaftar di database Supabase.`
          }
        };
      }

      console.error('❌ [Supabase insertSantri] Gagal menyimpan data:', insertError);
      return { success: false, error: insertError };
    }

    console.log('✅ [Supabase insertSantri] Berhasil mendaftarkan santri baru:', insertedData);
    return { success: true, data: insertedData?.[0] || payload, message: `Santri "${cleanNama}" berhasil didaftarkan!` };
  } catch (err) {
    console.error('❌ [Supabase insertSantri] Exception:', err);
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
