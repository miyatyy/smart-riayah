import { supabase } from './supabaseClient';
import {
  syncSantriToFirebase,
  deleteSantriFromFirebase,
  syncRoomToFirebase,
  deleteRoomFromFirebase,
  syncPermitToFirebase,
  deletePermitFromFirebase,
  syncGateLogToFirebase,
  syncDisciplineToFirebase,
  syncMedicalToFirebase,
  syncRfidTransactionToFirebase,
  syncMutabaahToFirebase
} from './firebaseSync';

/**
 * ============================================================================
 * SMART RI'AYAH - SUPABASE FULL REALTIME SYNC SERVICE
 * Menghubungkan seluruh kategori data: Santri, Kamar, Izin (Permits),
 * Gate Logs, Kedisiplinan, Rekam Medis, Transaksi RFID & Evaluasi Harian.
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// 1. DATA TRANSFORMERS (Frontend CamelCase <--> Supabase Snake_Case)
// ----------------------------------------------------------------------------

export function santriToDb(s) {
  if (!s) return null;
  return {
    id: s.id,
    nis: s.nis ? String(s.nis).trim() : null,
    nama_lengkap: s.nama || s.nama_lengkap || '',
    gender: s.gender || 'L',
    kelas: s.kelas || '10-A',
    kamar: s.kamar || '',
    rfid_uid: s.rfidUid ? s.rfidUid.trim().toUpperCase() : null,
    nama_wali: s.wali?.nama || s.waliNama || s.nama_wali || '',
    no_wali: s.wali?.telepon || s.waliTelepon || s.no_wali || '',
    saldo_rfid: Number(s.saldoRfid ?? s.saldo_rfid ?? s.saldoAwal ?? 0),
    limit_jajan_harian: Number(s.limitJajanHarian ?? 25000),
    poin_disiplin: Number(s.poinDisiplin ?? 100),
    status_asrama: s.statusAsrama || 'DI_ASRAMA',
    foto_url: s.foto || s.foto_url || null,
    updated_at: new Date().toISOString()
  };
}

export function dbToSantri(row) {
  if (!row) return null;
  const gender = row.gender || 'L';
  const defaultAvatar = gender === 'P' ? '/images/avatar_santri_putri.jpg' : '/images/avatar_santri_putra.jpg';
  return {
    id: row.id,
    nis: String(row.nis || ''),
    nama: row.nama_lengkap || row.nama || '',
    kelas: row.kelas || (gender === 'P' ? '10-B (Putri)' : '10-A (Putra)'),
    gender: gender,
    kamarId: row.kamar || null,
    kamar: row.kamar || '',
    rfidUid: row.rfid_uid || '',
    foto: row.foto_url || defaultAvatar,
    wali: {
      nama: row.nama_wali || `Wali dari ${row.nama_lengkap || 'Santri'}`,
      hubungan: 'Orang Tua Kandung',
      telepon: row.no_wali || '0812-3456-7890',
      alamat: 'Surabaya'
    },
    saldoRfid: Number(row.saldo_rfid ?? 0),
    limit_jajan_harian: Number(row.limit_jajan_harian ?? 25000),
    poinDisiplin: Number(row.poin_disiplin ?? 100),
    tahfidzJuz: 1,
    statusAsrama: row.status_asrama || 'DI_ASRAMA',
    penyakitKhusus: '-'
  };
}

export function roomToDb(r) {
  if (!r) return null;
  return {
    id: r.id,
    nama_gedung: r.namaGedung || r.nama_gedung || 'Asrama Santri',
    kategori_gedung: r.kategoriGedung || r.kategori_gedung || 'PUTRA',
    nomor_kamar: r.nomorKamar || r.nomor_kamar || '',
    lantai: parseInt(r.lantai || 1, 10),
    kapasitas: parseInt(r.kapasitas || 8, 10),
    terisi: parseInt(r.terisi || 0, 10),
    ketua_kamar: r.ketuaKamar || r.ketua_kamar || 'Belum Ditentukan',
    skor_kerapian_terakhir: parseInt(r.skorKerapianTerakhir ?? r.skor_kerapian_terakhir ?? 90, 10),
    jadwal_piket_hari_ini: r.jadwalPiketHariIni || r.jadwal_piket_hari_ini || 'Jadwal Reguler',
    catatan_inspeksi: r.catatanInspeksi || r.catatan_inspeksi || 'Kamar siap huni.',
    updated_at: new Date().toISOString()
  };
}

export function dbToRoom(row) {
  if (!row) return null;
  return {
    id: row.id,
    namaGedung: row.nama_gedung || 'Asrama Santri',
    kategoriGedung: row.kategori_gedung || 'PUTRA',
    nomorKamar: row.nomor_kamar || '',
    lantai: parseInt(row.lantai || 1, 10),
    kapasitas: parseInt(row.kapasitas || 8, 10),
    terisi: parseInt(row.terisi || 0, 10),
    ketuaKamar: row.ketua_kamar || 'Belum Ditentukan',
    skorKerapianTerakhir: parseInt(row.skor_kerapian_terakhir ?? 90, 10),
    jadwalPiketHariIni: row.jadwal_piket_hari_ini || 'Jadwal Reguler',
    catatanInspeksi: row.catatan_inspeksi || 'Kamar siap huni.'
  };
}

export function permitToDb(p) {
  if (!p) return null;
  return {
    id: p.id || `PRM-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    permit_code: p.permit_code || p.permitCode || p.tokenIzin || p.token_izin || `DU-${p.santriId || Date.now()}`,
    santri_id: p.santri_id || p.santriId || '',
    santri_name: p.santri_name || p.santriNama || p.santriName || '',
    room_name: p.room_name || p.roomName || p.kamar || '',
    reason: p.reason || p.keperluan || p.kategori || 'Izin Keluar Asrama',
    pickup_by: p.pickup_by || p.pickupBy || p.penjemput || 'Wali Santri Mandiri',
    start_date: p.start_date || p.startDate || (p.waktuKeluarRencana ? new Date(p.waktuKeluarRencana).toISOString() : new Date().toISOString()),
    return_date: p.return_date || p.returnDate || (p.batasKembali ? new Date(p.batasKembali).toISOString() : null),
    status: p.status || 'PENDING',
    is_extension: Boolean(p.is_extension ?? p.isExtension ?? (p.status === 'EXTEND_REQUESTED')),
    extension_reason: p.extension_reason || p.extensionReason || p.alasanPerpanjangan || null,
    requested_return_date: p.requested_return_date || p.requestedReturnDate || (p.perpanjanganSampai ? new Date(p.perpanjanganSampai).toISOString() : null),
    created_at: p.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

export function dbToPermit(row) {
  if (!row) return null;
  return {
    id: row.id,
    permit_code: row.permit_code || row.token_izin || `DU-${row.id}`,
    permitCode: row.permit_code,
    tokenIzin: row.permit_code || row.token_izin || `DU-${row.id}`,
    santriId: row.santri_id,
    santri_id: row.santri_id,
    santriNama: row.santri_name || row.santri_nama || '',
    santri_name: row.santri_name || '',
    kategori: row.reason ? (row.reason.includes('Pulang') ? 'Pulang Bermalam' : row.reason.includes('Sakit') ? 'Sakit' : row.reason.includes('Berobat') ? 'Izin Berobat' : 'Pesiar') : 'Pesiar',
    keperluan: row.reason || '',
    reason: row.reason || '',
    penjemput: row.pickup_by || 'Wali Santri Mandiri',
    pickup_by: row.pickup_by || 'Wali Santri Mandiri',
    room_name: row.room_name || '',
    kamar: row.room_name || '',
    waktuKeluarRencana: row.start_date,
    start_date: row.start_date,
    batasKembali: row.return_date,
    return_date: row.return_date,
    status: row.status,
    is_extension: Boolean(row.is_extension),
    isExtension: Boolean(row.is_extension),
    extension_reason: row.extension_reason,
    extensionReason: row.extension_reason,
    requested_return_date: row.requested_return_date,
    requestedReturnDate: row.requested_return_date,
    musyrifPenyetuju: row.status === 'APPROVED' ? 'Ust. M. Syukron, M.Pd.' : null,
    waktuApproval: row.updated_at,
    waktuKeluarAktual: row.status === 'DI_LUAR' || row.status === 'COMPLETED' ? row.start_date : null,
    waktuKembaliAktual: row.status === 'COMPLETED' ? row.updated_at : null,
    catatanMusyrif: row.extension_reason ? `Perpanjangan: ${row.extension_reason}` : '',
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export function messageToDb(m) {
  if (!m) return null;
  return {
    id: m.id || `MSG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    room_id: m.room_id || m.roomId || 'general',
    sender_email: m.sender_email || m.senderEmail || '',
    sender_name: m.sender_name || m.senderName || m.sender || 'Pengguna',
    sender_role: m.sender_role || m.senderRole || 'Wali Santri',
    receiver_role: m.receiver_role || m.receiverRole || 'ALL',
    message_text: m.message_text || m.messageText || m.text || m.pesan || '',
    reaction: typeof m.reaction === 'object' ? JSON.stringify(m.reaction) : (m.reaction || null),
    is_read: Boolean(m.is_read ?? m.isRead),
    created_at: m.created_at || m.timestamp || new Date().toISOString()
  };
}

export function dbToMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    roomId: row.room_id,
    room_id: row.room_id,
    senderEmail: row.sender_email,
    sender_email: row.sender_email,
    senderName: row.sender_name,
    sender_name: row.sender_name,
    sender: row.sender_name,
    senderRole: row.sender_role,
    sender_role: row.sender_role,
    receiverRole: row.receiver_role,
    receiver_role: row.receiver_role,
    messageText: row.message_text,
    message_text: row.message_text,
    text: row.message_text,
    pesan: row.message_text,
    reaction: row.reaction,
    isRead: Boolean(row.is_read),
    is_read: Boolean(row.is_read),
    createdAt: row.created_at,
    created_at: row.created_at,
    timestamp: row.created_at
  };
}

export function gateLogToDb(g) {
  if (!g) return null;
  return {
    id: g.id || `LOG-${Date.now().toString().slice(-4)}`,
    santri_id: g.santriId || g.santri_id || null,
    santri_nama: g.santriNama || g.santri_nama || '',
    rfid_uid: g.rfidUid ? g.rfidUid.trim().toUpperCase() : null,
    gate_id: g.gateId || g.gate_id || 'GATE-01',
    tipe: g.tipe || 'TAP_KELUAR',
    status: g.status || 'VERIFIED',
    remarks: g.remarks || '',
    snapshot_url: g.snapshotUrl || g.snapshot_url || null,
    created_at: g.timestamp ? new Date(g.timestamp).toISOString() : new Date().toISOString()
  };
}

export function dbToGateLog(row) {
  if (!row) return null;
  return {
    id: row.id,
    timestamp: row.created_at || new Date().toISOString(),
    santriId: row.santri_id,
    santriNama: row.santri_nama,
    rfidUid: row.rfid_uid,
    gateId: row.gate_id,
    tipe: row.tipe,
    status: row.status,
    remarks: row.remarks,
    snapshotUrl: row.snapshot_url
  };
}

export function disciplineToDb(d) {
  if (!d) return null;
  return {
    id: d.id || `DISC-${Date.now().toString().slice(-4)}`,
    santri_id: d.santriId || d.santri_id,
    tanggal: d.tanggal ? new Date(d.tanggal).toISOString() : new Date().toISOString(),
    jenis: d.jenis || 'PELANGGARAN',
    kategori: d.kategori || 'Kedisiplinan',
    poin: Number(d.poin || 0),
    deskripsi: d.deskripsi || '',
    pencatat: d.pencatat || 'Musyrif'
  };
}

export function dbToDiscipline(row) {
  if (!row) return null;
  return {
    id: row.id,
    santriId: row.santri_id,
    tanggal: row.tanggal,
    jenis: row.jenis,
    kategori: row.kategori,
    poin: Number(row.poin || 0),
    deskripsi: row.deskripsi,
    pencatat: row.pencatat
  };
}

export function medicalToDb(m) {
  if (!m) return null;
  return {
    id: m.id || `MED-${Date.now().toString().slice(-4)}`,
    santri_id: m.santriId || m.santri_id,
    tanggal: m.tanggal ? new Date(m.tanggal).toISOString() : new Date().toISOString(),
    keluhan: m.keluhan || '',
    diagnosa: m.diagnosa || '',
    tindakan: m.tindakan || '',
    status_istirahat: m.statusIstirahat || m.status_istirahat || 'ISTIRAHAT_ASRAMA',
    durasi_istirahat: m.durasiIstirahat || m.durasi_istirahat || '1 Hari',
    butuh_rujukan_rs: Boolean(m.butuhRujukanRs ?? m.butuh_rujukan_rs),
    rs_rujukan: m.rsRujukan || m.rs_rujukan || null,
    petugas_klinik: m.petugasKlinik || m.petugas_klinik || 'dr. Poskestren'
  };
}

export function dbToMedical(row) {
  if (!row) return null;
  return {
    id: row.id,
    santriId: row.santri_id,
    tanggal: row.tanggal,
    keluhan: row.keluhan,
    diagnosa: row.diagnosa,
    tindakan: row.tindakan,
    statusIstirahat: row.status_istirahat,
    durasiIstirahat: row.durasi_istirahat,
    butuhRujukanRs: Boolean(row.butuh_rujukan_rs),
    rsRujukan: row.rs_rujukan,
    petugasKlinik: row.petugas_klinik
  };
}

export function rfidTransactionToDb(t) {
  if (!t) return null;
  return {
    id: t.id || `TRX-${Date.now().toString().slice(-4)}`,
    santri_id: t.santriId || t.santri_id,
    tanggal: t.tanggal ? new Date(t.tanggal).toISOString() : new Date().toISOString(),
    tipe: t.tipe || 'KANTIN_POS',
    nominal: Number(t.nominal || 0),
    merchant: t.merchant || 'Kantin Pesantren',
    keterangan: t.keterangan || '',
    saldo_akhir: Number(t.saldoAkhir ?? t.saldo_akhir ?? 0)
  };
}

export function dbToRfidTransaction(row) {
  if (!row) return null;
  return {
    id: row.id,
    santriId: row.santri_id,
    tanggal: row.tanggal,
    tipe: row.tipe,
    nominal: Number(row.nominal || 0),
    merchant: row.merchant,
    keterangan: row.keterangan,
    saldoAkhir: Number(row.saldo_akhir || 0)
  };
}

export function mutabaahToDb(m) {
  if (!m) return null;
  return {
    santri_id: m.santriId || m.santri_id,
    tanggal: m.tanggal || new Date().toISOString().split('T')[0],
    shalat_subuh: m.subuh || m.shalat_subuh || 'BERJAMAAH_MASJID',
    shalat_dzuhur: m.dzuhur || m.shalat_dzuhur || 'BERJAMAAH_MASJID',
    shalat_ashar: m.ashar || m.shalat_ashar || 'BERJAMAAH_MASJID',
    shalat_maghrib: m.maghrib || m.shalat_maghrib || 'BERJAMAAH_MASJID',
    shalat_isya: m.isya || m.shalat_isya || 'BERJAMAAH_MASJID',
    dhuha: Boolean(m.dhuha),
    qiyamullail: Boolean(m.qiyamullail),
    tahfidz_surah: m.tahfidz?.surah || m.tahfidz_surah || 'An-Naba',
    tahfidz_ayat: m.tahfidz?.ayat || m.tahfidz_ayat || '1-10',
    tahfidz_juz: Number(m.tahfidz?.juz ?? m.tahfidz_juz ?? 1),
    tahfidz_predikat: m.tahfidz?.predikat || m.tahfidz_predikat || 'MUMTAZ',
    tahfidz_nilai: m.tahfidz?.predikat === 'MUMTAZ' ? 'A' : 'B'
  };
}

export function dbToMutabaah(row) {
  if (!row) return null;
  return {
    santriId: row.santri_id,
    tanggal: row.tanggal,
    subuh: row.shalat_subuh,
    dzuhur: row.shalat_dzuhur,
    ashar: row.shalat_ashar,
    maghrib: row.shalat_maghrib,
    isya: row.shalat_isya,
    dhuha: Boolean(row.dhuha),
    qiyamullail: Boolean(row.qiyamullail),
    tahfidz: {
      surah: row.tahfidz_surah,
      ayat: row.tahfidz_ayat,
      juz: row.tahfidz_juz,
      predikat: row.tahfidz_predikat,
      murojaah: 'Lancar',
      ustadz: 'Musyrif Tahfidz'
    }
  };
}

// ----------------------------------------------------------------------------
// 2. SUPABASE & FIREBASE WRITE ACTIONS (DUAL-SYNC DATABASE)
// ----------------------------------------------------------------------------

export async function syncSantriToSupabase(santri) {
  // Sync ke Google Firebase Firestore
  syncSantriToFirebase(santri);

  try {
    const payload = santriToDb(santri);
    if (!payload) return;
    const { error } = await supabase.from('santri').upsert([payload], { onConflict: 'id' });
    if (error) console.warn('⚠️ [Supabase Sync Santri]:', error.message);
  } catch (err) {
    console.warn('⚠️ [Supabase Sync Santri Error]:', err);
  }
}

export async function deleteSantriFromSupabase(santriId) {
  // Hapus di Google Firebase Firestore
  deleteSantriFromFirebase(santriId);

  try {
    const { error } = await supabase.from('santri').delete().eq('id', santriId);
    if (error) console.warn('⚠️ [Supabase Delete Santri]:', error.message);
  } catch (err) {
    console.warn('⚠️ [Supabase Delete Santri Error]:', err);
  }
}

export async function syncRoomToSupabase(room) {
  // Sync ke Google Firebase Firestore
  syncRoomToFirebase(room);

  try {
    const payload = roomToDb(room);
    if (!payload) return;

    // 1. Coba upsert ke tabel 'rooms'
    const { error: upsertErr } = await supabase.from('rooms').upsert([payload], { onConflict: 'id' });
    if (upsertErr) {
      console.warn('⚠️ [Supabase Upsert rooms failed, retrying update]:', upsertErr.message);
      // Fallback coba update
      await supabase.from('rooms').update(payload).eq('id', payload.id).catch(() => {});
    }

    // 2. Sync ke tabel 'kamar' di Supabase (kompatibilitas dual-table)
    const kamarPayload = {
      nama_kamar: `${payload.nomor_kamar} - Lt. ${payload.lantai}`,
      asrama: payload.nama_gedung,
      lantai: payload.lantai,
      kapasitas: payload.kapasitas,
      terisi: payload.terisi,
      ketua: payload.ketua_kamar,
      catatan: `Keterisian: ${payload.terisi} / ${payload.kapasitas} Kasur (${Math.round((payload.terisi / Math.max(1, payload.kapasitas)) * 100)}%). ${payload.catatan_inspeksi}`,
      updated_at: new Date().toISOString()
    };

    // Coba update berdasarkan nama_kamar atau kamar_id
    await supabase.from('kamar').update(kamarPayload).ilike('nama_kamar', `%${payload.nomor_kamar}%`).catch(() => {});
  } catch (err) {
    console.warn('⚠️ [Supabase Sync Room Error]:', err);
  }
}

export async function deleteRoomFromSupabase(roomId) {
  // Hapus di Google Firebase Firestore
  deleteRoomFromFirebase(roomId);

  try {
    const { error } = await supabase.from('rooms').delete().eq('id', roomId);
    if (error) console.warn('⚠️ [Supabase Delete Room]:', error.message);
  } catch (err) {
    console.warn('⚠️ [Supabase Delete Room Error]:', err);
  }
}

export async function syncPermitToSupabase(permit) {
  // Sync ke Google Firebase Firestore
  syncPermitToFirebase(permit);

  try {
    const payload = permitToDb(permit);
    if (!payload) return;
    const { error } = await supabase.from('permits').upsert([payload], { onConflict: 'id' });
    if (error) console.warn('⚠️ [Supabase Sync Permit]:', error.message);
  } catch (err) {
    console.warn('⚠️ [Supabase Sync Permit Error]:', err);
  }
}

export async function deletePermitFromSupabase(permitId) {
  // Hapus di Google Firebase Firestore
  deletePermitFromFirebase(permitId);

  try {
    const { error } = await supabase.from('permits').delete().eq('id', permitId);
    if (error) console.warn('⚠️ [Supabase Delete Permit]:', error.message);
  } catch (err) {
    console.warn('⚠️ [Supabase Delete Permit Error]:', err);
  }
}

export async function syncGateLogToSupabase(log) {
  // Sync ke Google Firebase Firestore
  syncGateLogToFirebase(log);

  try {
    const payload = gateLogToDb(log);
    if (!payload) return;
    const { error } = await supabase.from('gate_logs').insert([payload]);
    if (error) console.warn('⚠️ [Supabase Sync GateLog]:', error.message);
  } catch (err) {
    console.warn('⚠️ [Supabase Sync GateLog Error]:', err);
  }
}

export async function syncDisciplineToSupabase(record) {
  // Sync ke Google Firebase Firestore
  syncDisciplineToFirebase(record);

  try {
    const payload = disciplineToDb(record);
    if (!payload) return;
    const { error } = await supabase.from('pelanggaran').insert([payload]);
    if (error) console.warn('⚠️ [Supabase Sync Discipline]:', error.message);
  } catch (err) {
    console.warn('⚠️ [Supabase Sync Discipline Error]:', err);
  }
}

export async function syncMedicalToSupabase(record) {
  // Sync ke Google Firebase Firestore
  syncMedicalToFirebase(record);

  try {
    const payload = medicalToDb(record);
    if (!payload) return;
    const { error } = await supabase.from('rekam_medis').insert([payload]);
    if (error) console.warn('⚠️ [Supabase Sync Medical]:', error.message);
  } catch (err) {
    console.warn('⚠️ [Supabase Sync Medical Error]:', err);
  }
}

export async function syncRfidTransactionToSupabase(trx) {
  // Sync ke Google Firebase Firestore
  syncRfidTransactionToFirebase(trx);

  try {
    const payload = rfidTransactionToDb(trx);
    if (!payload) return;
    const { error } = await supabase.from('rfid_transactions').insert([payload]);
    if (error) console.warn('⚠️ [Supabase Sync RFID Trx]:', error.message);
  } catch (err) {
    console.warn('⚠️ [Supabase Sync RFID Trx Error]:', err);
  }
}

export async function syncMutabaahToSupabase(record) {
  // Sync ke Google Firebase Firestore
  syncMutabaahToFirebase(record);

  try {
    const payload = mutabaahToDb(record);
    if (!payload) return;
    const { error } = await supabase.from('evaluasi_harian').insert([payload]);
    if (error) console.warn('⚠️ [Supabase Sync Mutabaah]:', error.message);
  } catch (err) {
    console.warn('⚠️ [Supabase Sync Mutabaah Error]:', err);
  }
}

export async function syncMessageToSupabase(message) {
  try {
    const payload = messageToDb(message);
    if (!payload) return { success: false, error: 'Empty payload' };
    const { data, error } = await supabase.from('messages').insert([payload]);
    if (error) {
      console.warn('⚠️ [Supabase Sync Message]:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true, data };
  } catch (err) {
    console.warn('⚠️ [Supabase Sync Message Error]:', err);
    return { success: false, error: err.message };
  }
}

export async function updateMessageReactionInSupabase(messageId, reaction) {
  try {
    const { data, error } = await supabase
      .from('messages')
      .update({ reaction: typeof reaction === 'object' ? JSON.stringify(reaction) : reaction })
      .eq('id', messageId);
    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.warn('⚠️ [Supabase Update Reaction Error]:', err);
    return { success: false, error: err.message };
  }
}

export async function updatePermitStatusInSupabase(permitId, status, extra = {}) {
  try {
    const payload = {
      status,
      updated_at: new Date().toISOString(),
      ...extra
    };
    const { data, error } = await supabase.from('permits').update(payload).eq('id', permitId);
    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.warn('⚠️ [Supabase Update Permit Status Error]:', err);
    return { success: false, error: err.message };
  }
}

// ----------------------------------------------------------------------------
// 3. FETCH SELURUH KATEGORI DATA AWAL DARI SUPABASE
// ----------------------------------------------------------------------------

export async function fetchVisitBookingsFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', 'visit_bookings_log')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.warn('⚠️ [Supabase] Gagal mengambil visit_bookings_log:', error.message);
      return [];
    }

    const bookings = [];
    if (Array.isArray(data)) {
      for (const row of data) {
        try {
          const parsed = JSON.parse(row.message_text);
          if (parsed && parsed.id) {
            bookings.push({
              ...parsed,
              _supabaseMessageId: row.id
            });
          }
        } catch (e) {
          console.warn('Gagal parse visit booking JSON dari Supabase messages:', row.id, e);
        }
      }
    }
    return bookings;
  } catch (err) {
    console.warn('fetchVisitBookingsFromSupabase error:', err);
    return [];
  }
}

export async function syncBookingStatusToSupabase(booking, reaction = 'VISIT_APPROVED') {
  try {
    if (booking._supabaseMessageId) {
      await supabase
        .from('messages')
        .update({
          message_text: JSON.stringify(booking),
          reaction,
          is_read: true
        })
        .eq('id', booking._supabaseMessageId);
    } else {
      const { data: rows } = await supabase
        .from('messages')
        .select('id, message_text')
        .eq('room_id', 'visit_bookings_log')
        .order('created_at', { ascending: false })
        .limit(50);

      if (rows && rows.length > 0) {
        const found = rows.find(r => {
          try {
            const p = JSON.parse(r.message_text);
            return p.id === booking.id;
          } catch {
            return false;
          }
        });

        if (found) {
          await supabase
            .from('messages')
            .update({
              message_text: JSON.stringify(booking),
              reaction,
              is_read: true
            })
            .eq('id', found.id);
        }
      }
    }

    // Broadcast across realtime channel 'whatsapp-room'
    const channel = supabase.channel('whatsapp-room');
    await channel.send({
      type: 'broadcast',
      event: 'whatsapp.visit_booking_updated',
      payload: booking
    });
  } catch (err) {
    console.warn('⚠️ [Supabase] syncBookingStatusToSupabase warning:', err.message);
  }
}

export async function fetchAllDataFromSupabase() {
  console.log('🔄 [Supabase] Mengambil seluruh kategori data dari Supabase...');

  const results = await Promise.allSettled([
    supabase.from('santri').select('*').order('created_at', { ascending: false }),
    supabase.from('rooms').select('*').order('created_at', { ascending: true }),
    supabase.from('permits').select('*').order('created_at', { ascending: false }),
    supabase.from('gate_logs').select('*').order('created_at', { ascending: false }).limit(50),
    supabase.from('pelanggaran').select('*').order('created_at', { ascending: false }).limit(50),
    supabase.from('rekam_medis').select('*').order('created_at', { ascending: false }).limit(50),
    supabase.from('rfid_transactions').select('*').order('created_at', { ascending: false }).limit(50),
    supabase.from('evaluasi_harian').select('*').order('tanggal', { ascending: false }).limit(50),
    supabase.from('messages').select('*').neq('room_id', 'visit_bookings_log').order('created_at', { ascending: true }).limit(100),
    fetchVisitBookingsFromSupabase()
  ]);

  const output = {};

  if (results[0].status === 'fulfilled' && !results[0].value.error && results[0].value.data?.length > 0) {
    output.santriList = results[0].value.data.map(dbToSantri);
  }
  if (results[1].status === 'fulfilled' && !results[1].value.error && results[1].value.data?.length > 0) {
    output.rooms = results[1].value.data.map(dbToRoom);
  }
  if (results[2].status === 'fulfilled' && !results[2].value.error && results[2].value.data?.length > 0) {
    output.permits = results[2].value.data.map(dbToPermit);
  }
  if (results[3].status === 'fulfilled' && !results[3].value.error && results[3].value.data?.length > 0) {
    output.gateLogs = results[3].value.data.map(dbToGateLog);
  }
  if (results[4].status === 'fulfilled' && !results[4].value.error && results[4].value.data?.length > 0) {
    output.disciplineRecords = results[4].value.data.map(dbToDiscipline);
  }
  if (results[5].status === 'fulfilled' && !results[5].value.error && results[5].value.data?.length > 0) {
    output.medicalRecords = results[5].value.data.map(dbToMedical);
  }
  if (results[6].status === 'fulfilled' && !results[6].value.error && results[6].value.data?.length > 0) {
    output.rfidTransactions = results[6].value.data.map(dbToRfidTransaction);
  }
  if (results[7].status === 'fulfilled' && !results[7].value.error && results[7].value.data?.length > 0) {
    output.mutabaahList = results[7].value.data.map(dbToMutabaah);
  }
  if (results[8].status === 'fulfilled' && !results[8].value.error && results[8].value.data?.length > 0) {
    output.messages = results[8].value.data.map(dbToMessage);
  }
  if (results[9].status === 'fulfilled' && Array.isArray(results[9].value) && results[9].value.length > 0) {
    output.visitBookings = results[9].value;
  }

  console.log('✅ [Supabase] Selesai sinkronisasi awal data:', Object.keys(output));
  return output;
}

// ----------------------------------------------------------------------------
// 4. BERLANGGANAN (SUBSCRIBE) REALTIME PERUBAHAN SELURUH TABEL
// ----------------------------------------------------------------------------

export function subscribeToAllTablesRealtime(callbacks = {}) {
  const channel = supabase
    .channel('web-realtime-sync')
    // 1. Santri
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'santri' },
      (payload) => {
        console.log('⚡ [Realtime Santri]:', payload.eventType, payload.new || payload.old);
        if (callbacks.onSantriChange) callbacks.onSantriChange(payload);
      }
    )
    // 2. Rooms
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rooms' },
      (payload) => {
        console.log('⚡ [Realtime Rooms]:', payload.eventType, payload.new || payload.old);
        if (callbacks.onRoomChange) callbacks.onRoomChange(payload);
      }
    )
    // 3. Permits (Realtime 2-Arah Web & Mobile)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'permits' },
      (payload) => {
        console.log('⚡ [Realtime Permits]:', payload.eventType, payload.new || payload.old);
        if (callbacks.onPermitChange) callbacks.onPermitChange(payload);
      }
    )
    // 4. Messages (Live Chat & Emoji Reactions)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'messages' },
      (payload) => {
        console.log('⚡ [Realtime Messages]:', payload.eventType, payload.new || payload.old);
        if (callbacks.onMessageChange) callbacks.onMessageChange(payload);
      }
    )
    // 5. Gate Logs
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'gate_logs' },
      (payload) => {
        console.log('⚡ [Realtime Gate Log]:', payload.new);
        if (callbacks.onGateLogInsert) callbacks.onGateLogInsert(payload.new);
      }
    )
    // 6. Pelanggaran / Discipline
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'pelanggaran' },
      (payload) => {
        console.log('⚡ [Realtime Pelanggaran]:', payload.new);
        if (callbacks.onDisciplineInsert) callbacks.onDisciplineInsert(payload.new);
      }
    )
    // 7. Rekam Medis
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'rekam_medis' },
      (payload) => {
        console.log('⚡ [Realtime Rekam Medis]:', payload.new);
        if (callbacks.onMedicalInsert) callbacks.onMedicalInsert(payload.new);
      }
    )
    // 8. RFID Transactions
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'rfid_transactions' },
      (payload) => {
        console.log('⚡ [Realtime RFID Trx]:', payload.new);
        if (callbacks.onRfidTransactionInsert) callbacks.onRfidTransactionInsert(payload.new);
      }
    )
    .subscribe((status) => {
      console.log('🌐 [Supabase Realtime Channel Status (web-realtime-sync)]:', status);
      if (callbacks.onStatusChange) callbacks.onStatusChange(status);
    });

  return () => {
    supabase.removeChannel(channel);
  };
}

