import { supabase } from './supabaseClient';

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
    kamar_id: s.kamarId || s.kamar_id || null,
    kamar: s.kamar || '',
    rfid_uid: s.rfidUid ? s.rfidUid.trim().toUpperCase() : null,
    nama_wali: s.wali?.nama || s.waliNama || s.nama_wali || '',
    no_wali: s.wali?.telepon || s.waliTelepon || s.no_wali || '',
    saldo_rfid: Number(s.saldoRfid ?? s.saldo_rfid ?? s.saldoAwal ?? 0),
    saldo_awal: Number(s.saldoAwal ?? s.saldo_awal ?? s.saldoRfid ?? 0),
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
    kamarId: row.kamar_id || null,
    kamar: row.kamar || '',
    rfidUid: row.rfid_uid || '',
    foto: row.foto_url || defaultAvatar,
    wali: {
      nama: row.nama_wali || `Wali dari ${row.nama_lengkap || 'Santri'}`,
      hubungan: 'Orang Tua Kandung',
      telepon: row.no_wali || '0812-3456-7890',
      alamat: 'Surabaya'
    },
    saldoRfid: Number(row.saldo_rfid ?? row.saldo_awal ?? 0),
    limitJajanHarian: Number(row.limit_jajan_harian ?? 25000),
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
    id: p.id,
    santri_id: p.santriId || p.santri_id,
    santri_nama: p.santriNama || p.santri_nama || '',
    kategori: p.kategori || 'Pesiar',
    keperluan: p.keperluan || '',
    penjemput: p.penjemput || '',
    waktu_keluar_rencana: p.waktuKeluarRencana ? new Date(p.waktuKeluarRencana).toISOString() : null,
    batas_kembali: p.batasKembali ? new Date(p.batasKembali).toISOString() : null,
    status: p.status || 'PENDING',
    musyrif_penyetuju: p.musyrifPenyetuju || p.musyrif_penyetuju || null,
    waktu_approval: p.waktuApproval ? new Date(p.waktuApproval).toISOString() : null,
    waktu_keluar_aktual: p.waktuKeluarAktual ? new Date(p.waktuKeluarAktual).toISOString() : null,
    waktu_kembali_aktual: p.waktuKembaliAktual ? new Date(p.waktuKembaliAktual).toISOString() : null,
    token_izin: p.tokenIzin || p.token_izin || `DU-${Date.now().toString().slice(-4)}`,
    catatan_musyrif: p.catatanMusyrif || p.catatan_musyrif || ''
  };
}

export function dbToPermit(row) {
  if (!row) return null;
  return {
    id: row.id,
    santriId: row.santri_id,
    santriNama: row.santri_nama,
    kategori: row.kategori,
    keperluan: row.keperluan,
    penjemput: row.penjemput,
    waktuKeluarRencana: row.waktu_keluar_rencana,
    batasKembali: row.batas_kembali,
    status: row.status,
    musyrifPenyetuju: row.musyrif_penyetuju,
    waktuApproval: row.waktu_approval,
    waktuKeluarAktual: row.waktu_keluar_aktual,
    waktuKembaliAktual: row.waktu_kembali_aktual,
    tokenIzin: row.token_izin,
    catatanMusyrif: row.catatan_musyrif
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
// 2. SUPABASE WRITE ACTIONS (UPSERT & INSERT KE DATABASE)
// ----------------------------------------------------------------------------

export async function syncSantriToSupabase(santri) {
  try {
    const payload = santriToDb(santri);
    if (!payload) return;
    const { error } = await supabase.from('santri').upsert([payload], { onConflict: 'id' });
    if (error) console.warn('⚠️ [Supabase Sync Santri]:', error.message);
  } catch (err) {
    console.warn('⚠️ [Supabase Sync Santri Error]:', err);
  }
}

export async function syncRoomToSupabase(room) {
  try {
    const payload = roomToDb(room);
    if (!payload) return;
    const { error } = await supabase.from('rooms').upsert([payload], { onConflict: 'id' });
    if (error) console.warn('⚠️ [Supabase Sync Room]:', error.message);
  } catch (err) {
    console.warn('⚠️ [Supabase Sync Room Error]:', err);
  }
}

export async function deleteRoomFromSupabase(roomId) {
  try {
    const { error } = await supabase.from('rooms').delete().eq('id', roomId);
    if (error) console.warn('⚠️ [Supabase Delete Room]:', error.message);
  } catch (err) {
    console.warn('⚠️ [Supabase Delete Room Error]:', err);
  }
}

export async function syncPermitToSupabase(permit) {
  try {
    const payload = permitToDb(permit);
    if (!payload) return;
    const { error } = await supabase.from('permits').upsert([payload], { onConflict: 'id' });
    if (error) console.warn('⚠️ [Supabase Sync Permit]:', error.message);
  } catch (err) {
    console.warn('⚠️ [Supabase Sync Permit Error]:', err);
  }
}

export async function syncGateLogToSupabase(log) {
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
  try {
    const payload = mutabaahToDb(record);
    if (!payload) return;
    const { error } = await supabase.from('evaluasi_harian').insert([payload]);
    if (error) console.warn('⚠️ [Supabase Sync Mutabaah]:', error.message);
  } catch (err) {
    console.warn('⚠️ [Supabase Sync Mutabaah Error]:', err);
  }
}

// ----------------------------------------------------------------------------
// 3. FETCH SELURUH KATEGORI DATA AWAL DARI SUPABASE
// ----------------------------------------------------------------------------

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
    supabase.from('evaluasi_harian').select('*').order('tanggal', { ascending: false }).limit(50)
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

  console.log('✅ [Supabase] Selesai sinkronisasi awal data:', Object.keys(output));
  return output;
}

// ----------------------------------------------------------------------------
// 4. BERLANGGANAN (SUBSCRIBE) REALTIME PERUBAHAN SELURUH TABEL
// ----------------------------------------------------------------------------

export function subscribeToAllTablesRealtime(callbacks = {}) {
  const channel = supabase
    .channel('smart-riayah-realtime-all')
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
    // 3. Permits
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'permits' },
      (payload) => {
        console.log('⚡ [Realtime Permits]:', payload.eventType, payload.new || payload.old);
        if (callbacks.onPermitChange) callbacks.onPermitChange(payload);
      }
    )
    // 4. Gate Logs
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'gate_logs' },
      (payload) => {
        console.log('⚡ [Realtime Gate Log]:', payload.new);
        if (callbacks.onGateLogInsert) callbacks.onGateLogInsert(payload.new);
      }
    )
    // 5. Pelanggaran / Discipline
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'pelanggaran' },
      (payload) => {
        console.log('⚡ [Realtime Pelanggaran]:', payload.new);
        if (callbacks.onDisciplineInsert) callbacks.onDisciplineInsert(payload.new);
      }
    )
    // 6. Rekam Medis
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'rekam_medis' },
      (payload) => {
        console.log('⚡ [Realtime Rekam Medis]:', payload.new);
        if (callbacks.onMedicalInsert) callbacks.onMedicalInsert(payload.new);
      }
    )
    // 7. RFID Transactions
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'rfid_transactions' },
      (payload) => {
        console.log('⚡ [Realtime RFID Trx]:', payload.new);
        if (callbacks.onRfidTransactionInsert) callbacks.onRfidTransactionInsert(payload.new);
      }
    )
    .subscribe((status) => {
      console.log('🌐 [Supabase Realtime Channel Status]:', status);
      if (callbacks.onStatusChange) callbacks.onStatusChange(status);
    });

  return () => {
    supabase.removeChannel(channel);
  };
}

