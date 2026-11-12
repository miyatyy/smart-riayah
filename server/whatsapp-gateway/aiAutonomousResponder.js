/**
 * Smart Ri'ayah - Autonomous AI Responder for WhatsApp Gateway
 * Otak AI Otonom yang membalas pesan masuk dari Wali Santri secara instan via Fonnte API
 */

import { createClient } from '@supabase/supabase-js';
import { broadcastToSupabaseRealtime } from './supabaseBroadcaster.js';
import { saveAiDocument } from '../mongo.js';

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';

const createFallbackSupabaseStub = () => ({
  from: () => ({
    select: () => ({
      maybeSingle: async () => ({ data: null }),
      eq: () => ({
        like: async () => ({ data: null }),
        order: () => ({ limit: async () => ({ data: [] }) }),
      }),
      in: () => ({
        order: () => ({ limit: async () => ({ data: [] }) }),
      }),
      or: async () => ({ data: [] }),
    }),
    delete: () => ({ eq: () => ({ like: async () => ({}) }) }),
    insert: async () => ({}),
  }),
});

const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : createFallbackSupabaseStub();

const DEFAULT_FONNTE_TOKEN = (process.env.FONNTE_TOKEN || process.env.VITE_FONNTE_TOKEN || '').trim();

/**
 * Pengikatan prioritas untuk nomor Wali 628813576012 / 08813576012 -> Santri Nurmiyaty
 */
export const NURMIYATY_PRIORITY_BINDING = Object.freeze({
  phoneIntl: '628813576012',
  phoneLocal: '08813576012',
  santriNama: 'Nurmiyaty',
  nis: '126146',
  kelas: '10-B Putri',
  kamar: 'Khadijah 105',
  rfidUid: '53:57:98:0F',
  defaultNamaWali: 'Arbainah',
});

function isPoisonedFallbackName(name) {
  const lower = String(name || '').trim().toLowerCase();
  if (!lower) return false;
  return /\b(?:ibu\s+)?fatimah(?:\s+az[-\s]?zahra)?\b/i.test(lower);
}

// In-memory set penyimpan nomor HP yang sedang diambil alih manual oleh Admin Ri'ayah
export const manualTakeoverPhones = new Set();

/**
 * Simpan / perbarui status Mode Ambil Alih Manual ke Supabase & In-Memory Cache
 */
export async function setManualTakeover(phone, isManual) {
  const clean = normalizePhone(phone);
  const digits = String(clean).replace(/[^0-9]/g, '');
  if (!digits) return false;
  const last8 = digits.slice(-8);

  if (isManual) {
    manualTakeoverPhones.add(clean);
    try {
      // 1. Bersihkan record lama untuk nomor ini di Supabase messages table
      await supabase
        .from('messages')
        .delete()
        .eq('room_id', 'whatsapp_takeover')
        .like('message_text', `%${last8}%`);

      // 2. Insert record baru sebagai penanda bahwa nomor ini sedang di-takeover manual
      const { error } = await supabase
        .from('messages')
        .insert([{
          room_id: 'whatsapp_takeover',
          sender_email: 'admin@smartriayah.com',
          sender_name: 'Admin Ri\'ayah',
          sender_role: 'admin',
          message_text: clean,
          reaction: 'MANUAL_TAKEOVER',
          is_read: false
        }]);

      if (error) {
        console.warn('⚠️ [Supabase setManualTakeover insert error]:', error.message);
      } else {
        console.log(`✅ [Supabase setManualTakeover SUCCESS]: ${clean} kini dalam MODE AMBIL ALIH MANUAL`);
      }
    } catch (err) {
      console.warn('⚠️ [Supabase setManualTakeover exception]:', err.message);
    }
    return true;
  } else {
    manualTakeoverPhones.delete(clean);
    const alt = clean.startsWith('62') ? '0' + clean.slice(2) : (clean.startsWith('0') ? '62' + clean.slice(1) : clean);
    manualTakeoverPhones.delete(alt);

    try {
      // Hapus status takeover dari Supabase messages table
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('room_id', 'whatsapp_takeover')
        .like('message_text', `%${last8}%`);

      if (error) {
        console.warn('⚠️ [Supabase removeManualTakeover error]:', error.message);
      } else {
        console.log(`✅ [Supabase removeManualTakeover SUCCESS]: ${clean} dikembalikan ke MODE OTONOM`);
      }
    } catch (err) {
      console.warn('⚠️ [Supabase removeManualTakeover exception]:', err.message);
    }
    return false;
  }
}

/**
 * Cek apakah nomor sedang dalam Mode Ambil Alih Manual (Cek In-Memory & Supabase)
 */
export async function isPhoneInManualTakeover(phone) {
  const clean = normalizePhone(phone);
  const digits = String(clean).replace(/[^0-9]/g, '');
  if (!digits) return false;
  const last8 = digits.slice(-8);

  // 1. Cek in-memory set (fast path)
  if (manualTakeoverPhones.has(clean)) return true;
  for (const p of manualTakeoverPhones) {
    if (clean.endsWith(p.slice(-8)) || p.endsWith(clean.slice(-8))) {
      return true;
    }
  }

  // 2. Cek Supabase (persistent across all Vercel Serverless Lambdas)
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('message_text, reaction')
      .eq('room_id', 'whatsapp_takeover');

    if (!error && Array.isArray(data) && data.length > 0) {
      const match = data.some(row => {
        const rowDigits = String(row.message_text || '').replace(/[^0-9]/g, '');
        return rowDigits && (rowDigits.endsWith(last8) || digits.endsWith(rowDigits.slice(-8)));
      });

      if (match) {
        console.log(`🔒 [Supabase Verified]: Nomor ${clean} TERBUKTI sedang dalam MODE AMBIL ALIH MANUAL oleh Admin!`);
        manualTakeoverPhones.add(clean);
        return true;
      }
    }
  } catch (err) {
    console.warn('⚠️ [Check Takeover Supabase Error]:', err.message);
  }

  return false;
}

// Database referensi cepat Wali & Santri Pesantren Darul Ulum (tanpa data hardcode Ibu Fatimah / fallback salah santri)
const KNOWN_WALI_MAP = {
  '08124455890': {
    namaWali: 'Bpk. Hendra Gunawan',
    santriNama: 'Muhammad Rayhan',
    nis: '125457',
    kelas: '11-IPA 1',
    kamar: 'Kamar Abu Bakar 102 Lt. 1',
    saldoRfid: 'Rp 82.000',
    limitHarian: 'Rp 30.000',
    poinDisiplin: '88/100 (Jayyid Jiddan)',
    statusAsrama: 'Sedang Izin Pulang (Batas Kembali: Ahad 17.00 WIB)',
    izinTerakhir: 'Izin Sakit / Rawat Jalan'
  },
  '628124455890': {
    namaWali: 'Bpk. Hendra Gunawan',
    santriNama: 'Muhammad Rayhan',
    nis: '125457',
    kelas: '11-IPA 1',
    kamar: 'Kamar Abu Bakar 102 Lt. 1',
    saldoRfid: 'Rp 82.000',
    limitHarian: 'Rp 30.000',
    poinDisiplin: '88/100 (Jayyid Jiddan)',
    statusAsrama: 'Sedang Izin Pulang (Batas Kembali: Ahad 17.00 WIB)',
    izinTerakhir: 'Izin Sakit / Rawat Jalan'
  },
  '08567890123': {
    namaWali: 'Ibu Siti Khadijah',
    santriNama: 'Aisyah Putri',
    nis: '2024003',
    kelas: '10-C (Putri)',
    kamar: 'Kamar Khadijah 105 Lt. 1',
    saldoRfid: 'Rp 65.000',
    limitHarian: 'Rp 25.000',
    poinDisiplin: '94/100 (Mumtaz)',
    statusAsrama: 'Di Asrama (Kondisi Sehat di Asrama Putri)',
    izinTerakhir: 'Tertib / Izin Sambangan Keluarga'
  },
  '628567890123': {
    namaWali: 'Ibu Siti Khadijah',
    santriNama: 'Aisyah Putri',
    nis: '2024003',
    kelas: '10-C (Putri)',
    kamar: 'Kamar Khadijah 105 Lt. 1',
    saldoRfid: 'Rp 65.000',
    limitHarian: 'Rp 25.000',
    poinDisiplin: '94/100 (Mumtaz)',
    statusAsrama: 'Di Asrama (Kondisi Sehat di Asrama Putri)',
    izinTerakhir: 'Tertib / Izin Sambangan Keluarga'
  }
};

/**
 * Normalisasi nomor HP Indonesia: ubah 08..., +628..., 00628..., 6208..., JID @s.whatsapp.net menjadi kanonik 628...
 * Mempertahankan ID Telegram (TG-...).
 */
export function normalizePhone(raw) {
  if (raw === null || raw === undefined) return '';
  const trimmed = String(raw).trim();
  if (!trimmed) return '';

  if (trimmed.toUpperCase().startsWith('TG-')) {
    return trimmed;
  }

  const cleanJid = trimmed.split('@')[0].split(':')[0];
  let digits = cleanJid.replace(/[^0-9]/g, '');
  if (!digits) return '';

  if (digits.startsWith('0062')) {
    digits = '62' + digits.slice(4);
  }
  if (digits.startsWith('6208')) {
    digits = '628' + digits.slice(4);
  } else if (digits.startsWith('620')) {
    digits = '62' + digits.slice(3);
  }

  if (digits.startsWith('08')) {
    digits = '628' + digits.slice(2);
  } else if (digits.startsWith('0') && digits.length >= 9) {
    digits = '62' + digits.slice(1);
  } else if (digits.startsWith('8') && digits.length >= 8) {
    digits = '628' + digits.slice(1);
  }

  return digits;
}

/**
 * Kembalikan kedua format 628... & 08... beserta varian umum untuk query Supabase dual-format
 */
export function getPhoneVariants(raw) {
  const intl = normalizePhone(raw);
  if (!intl || intl.toUpperCase().startsWith('TG-')) {
    return {
      intl,
      local: '',
      plusIntl: '',
      bare: '',
      last8: '',
      last9: '',
      variants: intl ? [intl] : [],
    };
  }

  const local = intl.startsWith('62') ? '0' + intl.slice(2) : intl;
  const plusIntl = '+' + intl;
  const bare = intl.startsWith('62') ? intl.slice(2) : intl;
  const last8 = bare.length >= 8 ? bare.slice(-8) : intl.slice(-8);
  const last9 = bare.length >= 9 ? bare.slice(-9) : intl.slice(-9);
  const dashedLocal =
    local.length >= 10 ? `${local.slice(0, 4)}-${local.slice(4, 8)}-${local.slice(8)}` : '';

  const variants = Array.from(
    new Set([intl, local, plusIntl, bare, dashedLocal].filter(Boolean))
  );

  return { intl, local, plusIntl, bare, last8, last9, variants };
}

export function isSamePhone(a, b) {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.toUpperCase().startsWith('TG-') || nb.toUpperCase().startsWith('TG-')) {
    return na.toUpperCase() === nb.toUpperCase();
  }
  const minLen = Math.min(na.length, nb.length);
  if (minLen >= 8) {
    return na.slice(-8) === nb.slice(-8);
  }
  return false;
}

export function isPriorityNurmiyatyPhone(phone) {
  return isSamePhone(phone, NURMIYATY_PRIORITY_BINDING.phoneIntl);
}

function formatWaliDisplayName(rawWali, { isPriorityNurmiyaty = false } = {}) {
  const clean = String(rawWali || '').trim();
  if (!clean || /^bapak\/ibu wali/i.test(clean) || /^wali dari /i.test(clean)) {
    return isPriorityNurmiyaty ? NURMIYATY_PRIORITY_BINDING.defaultNamaWali : 'Wali Santri';
  }
  if (isPoisonedFallbackName(clean)) {
    return isPriorityNurmiyaty ? NURMIYATY_PRIORITY_BINDING.defaultNamaWali : 'Wali Santri';
  }
  return clean;
}

export function buildWaliProfileFromRow(row, { isPriorityNurmiyaty = false } = {}) {
  if (!row) return null;
  const rawSantriName = String(row.nama_lengkap || row.nama || '').trim();
  const isNurmiyatyRow =
    rawSantriName.toLowerCase().includes('nurmiyat') ||
    String(row.nis || '').trim() === NURMIYATY_PRIORITY_BINDING.nis ||
    String(row.rfid_uid || row.rfidUid || '').trim().toUpperCase() === NURMIYATY_PRIORITY_BINDING.rfidUid;

  const usePriorityDefaults = isPriorityNurmiyaty && isNurmiyatyRow;
  const namaWali = formatWaliDisplayName(row.nama_wali || row.wali?.nama, {
    isPriorityNurmiyaty: usePriorityDefaults || isPriorityNurmiyaty,
  });

  const santriNama = rawSantriName || (usePriorityDefaults ? NURMIYATY_PRIORITY_BINDING.santriNama : 'Santri');
  const nis = String(row.nis || '').trim() || (usePriorityDefaults ? NURMIYATY_PRIORITY_BINDING.nis : '-');
  const kelas = String(row.kelas || '').trim() || (usePriorityDefaults ? NURMIYATY_PRIORITY_BINDING.kelas : 'Santri Darul Ulum');
  const kamar = String(row.kamar || '').trim() || (usePriorityDefaults ? NURMIYATY_PRIORITY_BINDING.kamar : 'Asrama Darul Ulum');
  const rfidUid = String(row.rfid_uid || row.rfidUid || '').trim().toUpperCase() || (usePriorityDefaults ? NURMIYATY_PRIORITY_BINDING.rfidUid : null);

  return {
    santriId: row.id || null,
    namaWali,
    santriNama,
    nis,
    kelas,
    kamar,
    rfidUid,
    noWali: normalizePhone(row.no_wali || row.wali?.telepon || (isPriorityNurmiyaty ? NURMIYATY_PRIORITY_BINDING.phoneIntl : '')),
    saldoRfid: `Rp ${Number(row.saldo_rfid ?? row.saldo_awal ?? 0).toLocaleString('id-ID')}`,
    limitHarian: `Rp ${Number(row.limit_jajan_harian ?? 25000).toLocaleString('id-ID')}`,
    poinDisiplin: `${row.poin_disiplin ?? 100}/100 (Mumtaz)`,
    statusAsrama:
      row.status_asrama === 'DI_ASRAMA'
        ? 'Di Asrama (Aktif Sholat Berjamaah & Halaqah)'
        : row.status_asrama || 'Di Lingkungan Pondok',
    izinTerakhir: 'Tertib di Asrama',
  };
}

export function selectBestSantriCandidate(rows, senderPhone) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const { intl, local, variants } = getPhoneVariants(senderPhone);
  const priorityPhone = isPriorityNurmiyatyPhone(senderPhone);

  let bestRow = null;
  let bestScore = -1;

  for (const row of rows) {
    if (!row) continue;
    const rowNoRaw = String(row.no_wali || row.wali?.telepon || '').trim();
    const rowNoNorm = normalizePhone(rowNoRaw);
    const phoneExactMatch = Boolean(
      rowNoNorm &&
      (rowNoNorm === intl || variants.some((v) => normalizePhone(v) === rowNoNorm || v === rowNoRaw))
    );
    const phoneFuzzyMatch = !phoneExactMatch && isSamePhone(rowNoRaw, senderPhone);

    const rowName = String(row.nama_lengkap || row.nama || '').trim().toLowerCase();
    const rowNis = String(row.nis || '').trim();
    const rowUid = String(row.rfid_uid || row.rfidUid || '').trim().toUpperCase();
    const isNurmiyatyRow =
      rowName.includes('nurmiyat') ||
      rowNis === NURMIYATY_PRIORITY_BINDING.nis ||
      rowUid === NURMIYATY_PRIORITY_BINDING.rfidUid;

    if (!phoneExactMatch && !phoneFuzzyMatch && !(priorityPhone && isNurmiyatyRow)) {
      continue;
    }

    let score = 0;
    if (priorityPhone && isNurmiyatyRow) {
      score += 1000;
    }
    if (phoneExactMatch) {
      score += 120;
    } else if (phoneFuzzyMatch) {
      score += 90;
    }
    if (row.nama_wali && !isPoisonedFallbackName(row.nama_wali)) {
      score += 15;
    }
    if (rowUid === NURMIYATY_PRIORITY_BINDING.rfidUid && priorityPhone) {
      score += 50;
    }
    if (rowNoRaw === local || rowNoRaw === intl) {
      score += 10;
    }

    if (score > bestScore) {
      bestScore = score;
      bestRow = row;
    } else if (score === bestScore && bestRow) {
      const currTs = new Date(row.updated_at || row.created_at || 0).getTime();
      const bestTs = new Date(bestRow.updated_at || bestRow.created_at || 0).getTime();
      if (currTs > bestTs) {
        bestRow = row;
      }
    }
  }

  return bestRow;
}

/**
 * Cari data Santri & Wali real-time dari Supabase dengan pencocokan dua format (08... & 628...)
 * dan prioritas pengikatan 628813576012/08813576012 -> Nurmiyaty.
 */
export async function findLiveSantriByPhone(cleanPhone, clientOverride = null) {
  const db = clientOverride || supabase;
  const priorityPhone = isPriorityNurmiyatyPhone(cleanPhone);

  try {
    const { intl, local, plusIntl, last8, last9 } = getPhoneVariants(cleanPhone);
    let rows = [];

    if (intl.length >= 7 || priorityPhone) {
      const orFilters = [];
      if (intl) orFilters.push(`no_wali.eq.${intl}`);
      if (local && local !== intl) orFilters.push(`no_wali.eq.${local}`);
      if (plusIntl) orFilters.push(`no_wali.eq.${plusIntl}`);
      if (last9 && last9.length >= 8) orFilters.push(`no_wali.ilike.%${last9}`);
      if (last8 && last8.length >= 8) orFilters.push(`no_wali.ilike.%${last8}`);
      if (priorityPhone) {
        orFilters.push('nama_lengkap.ilike.%nurmiyat%');
        orFilters.push(`nis.eq.${NURMIYATY_PRIORITY_BINDING.nis}`);
        orFilters.push(`rfid_uid.eq.${NURMIYATY_PRIORITY_BINDING.rfidUid}`);
      }

      const santriTable = db.from('santri');
      const selectRes = santriTable.select('*');

      if (selectRes && typeof selectRes.or === 'function' && orFilters.length > 0) {
        const { data, error } = await selectRes.or(orFilters.join(','));
        if (!error && Array.isArray(data)) {
          rows = data;
        }
      }

      if (rows.length === 0) {
        const { data, error } = await db.from('santri').select('*');
        if (!error && Array.isArray(data)) {
          rows = data;
        }
      }
    }

    if (rows.length === 0 && !clientOverride && !process.env.VITEST && !process.env.NODE_TEST) {
      try {
        const pgMod = await import('../db.js').catch(() => null);
        if (pgMod?.query) {
          const params = [intl || '', local || '', `%${last8 || ''}`];
          const sql = priorityPhone
            ? `SELECT * FROM santri WHERE no_wali IN ($1, $2) OR no_wali LIKE $3 OR nis = '${NURMIYATY_PRIORITY_BINDING.nis}' OR UPPER(COALESCE(rfid_uid,'')) = '${NURMIYATY_PRIORITY_BINDING.rfidUid}' OR LOWER(COALESCE(nama_lengkap,'')) LIKE '%nurmiyat%' LIMIT 15`
            : `SELECT * FROM santri WHERE no_wali IN ($1, $2) OR no_wali LIKE $3 LIMIT 15`;
          const pgRes = await pgMod.query(sql, params).catch(() => null);
          if (pgRes?.rows?.length) {
            rows = pgRes.rows;
          }
        }
      } catch {}
    }

    const matched = selectBestSantriCandidate(rows, cleanPhone);
    if (matched) {
      const profile = buildWaliProfileFromRow(matched, { isPriorityNurmiyaty: priorityPhone });
      console.log(`🎯 [Supabase Match]: Nomor ${cleanPhone} -> Santri ${profile.santriNama} (Wali: ${profile.namaWali})`);
      return profile;
    }
  } catch (err) {
    console.warn('⚠️ [findLiveSantriByPhone error]:', err.message);
  }
  return null;
}

/**
 * Resolusi identitas lengkap Wali & Santri (Live Supabase -> Priority Nurmiyaty -> Known Map -> Neutral)
 * Tanpa pernah memfallback ke data palsu "Ibu Fatimah".
 */
export async function resolveWaliIdentity(senderPhone, fallbackSenderName = '', clientOverride = null) {
  const { intl, local } = getPhoneVariants(senderPhone);
  const priorityPhone = isPriorityNurmiyatyPhone(senderPhone);

  const liveWali = await findLiveSantriByPhone(intl || senderPhone, clientOverride);
  if (liveWali) {
    return liveWali;
  }

  const mapped = KNOWN_WALI_MAP[intl] || KNOWN_WALI_MAP[local] || KNOWN_WALI_MAP[String(senderPhone || '').trim()];
  if (mapped && !isPoisonedFallbackName(mapped.namaWali)) {
    return {
      ...mapped,
      noWali: intl,
    };
  }

  if (priorityPhone) {
    const cleanOverride =
      fallbackSenderName &&
      fallbackSenderName !== 'Wali Santri' &&
      !isPoisonedFallbackName(fallbackSenderName)
        ? fallbackSenderName
        : NURMIYATY_PRIORITY_BINDING.defaultNamaWali;

    return {
      santriId: 'S-107',
      namaWali: cleanOverride,
      santriNama: NURMIYATY_PRIORITY_BINDING.santriNama,
      nis: NURMIYATY_PRIORITY_BINDING.nis,
      kelas: NURMIYATY_PRIORITY_BINDING.kelas,
      kamar: NURMIYATY_PRIORITY_BINDING.kamar,
      rfidUid: NURMIYATY_PRIORITY_BINDING.rfidUid,
      noWali: NURMIYATY_PRIORITY_BINDING.phoneIntl,
      saldoRfid: 'Rp 150.000',
      limitHarian: 'Rp 30.000',
      poinDisiplin: '100/100 (Mumtaz)',
      statusAsrama: 'Di Asrama (Aktif Sholat Berjamaah & Halaqah)',
      izinTerakhir: 'Tertib di Asrama',
    };
  }

  const cleanFallbackName =
    fallbackSenderName && !isPoisonedFallbackName(fallbackSenderName)
      ? fallbackSenderName
      : 'Bapak/Ibu Wali Santri';

  return {
    santriId: null,
    namaWali: cleanFallbackName,
    santriNama: 'Ananda',
    nis: '-',
    kelas: 'Santri Darul Ulum',
    kamar: 'Asrama Pesantren',
    rfidUid: null,
    noWali: intl,
    saldoRfid: 'Rp 75.000',
    limitHarian: 'Rp 25.000',
    poinDisiplin: '95/100',
    statusAsrama: 'Di Lingkungan Pondok',
    izinTerakhir: 'Tertib',
  };
}

/**
 * Helper salam natural: Hanya menjawab salam jika lawan bicara mengucap salam
 */
function getNaturalGreeting(incomingText, name = '') {
  const text = String(incomingText || '').toLowerCase();
  const hasSalam =
    text.includes('assalamu') ||
    text.includes('aslam') ||
    text.includes('ass ') ||
    text.includes('mikum') ||
    text.includes('kumsalam');

  const targetName = name && name !== 'Wali Santri' ? name : 'Bapak/Ibu';

  if (hasSalam) {
    return `Wa'alaikumsalam ${targetName}. `;
  }
  if (text.includes('pagi')) return `Selamat pagi ${targetName}. `;
  if (text.includes('siang')) return `Selamat siang ${targetName}. `;
  if (text.includes('sore')) return `Selamat sore ${targetName}. `;
  if (text.includes('malam')) return `Selamat malam ${targetName}. `;

  return `Halo ${targetName}, `;
}

/**
 * Helper waktu pondok real-time (WITA / Asia/Makassar) untuk backend
 */
function getRealtimePondokClockBackend() {
  const d = new Date();
  const namaHariArr = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const dayIndex = d.getDay();
  const namaHari = namaHariArr[dayIndex];
  const ymd = d.toISOString().slice(0, 10);
  const tglLengkap = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const jamMenit = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
  const jamMenitDetik = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const isWeekday = dayIndex >= 1 && dayIndex <= 4; // Senin - Kamis

  const refDays = [];
  for (let i = 0; i < 7; i++) {
    const cd = new Date(d);
    cd.setDate(d.getDate() + i);
    const cdDay = namaHariArr[cd.getDay()];
    const cdYmd = cd.toISOString().slice(0, 10);
    const cdIsWeekday = cd.getDay() >= 1 && cd.getDay() <= 4;
    refDays.push({
      offset: i,
      label: i === 0 ? 'Hari ini' : (i === 1 ? 'Besok' : (i === 2 ? 'Lusa' : `${cdDay} depan`)),
      hari: cdDay,
      tanggal: cdYmd,
      is_weekday: cdIsWeekday,
      rule: cdIsWeekday ? 'Wajib Approval Admin Ri\'ayah' : 'Auto-Approved (Langsung Terbit Barcode)'
    });
  }

  return {
    dayIndex,
    namaHari,
    ymd,
    tglLengkap,
    jamMenit,
    jamMenitDetik,
    isWeekday,
    refDays
  };
}

/**
 * Ambil riwayat chat terakhir untuk nomor HP ini (mencakup room wa_628... & wa_08...)
 * agar percakapan berkesinambungan tanpa terbawa nama contoh lama (Ibu Fatimah / Ahmad Fauzi).
 */
export async function getRecentChatHistory(cleanPhone, clientOverride = null) {
  const db = clientOverride || supabase;
  try {
    const { intl, local } = getPhoneVariants(cleanPhone);
    const roomIds = Array.from(
      new Set([
        intl ? `wa_${intl}` : '',
        local ? `wa_${local}` : '',
        cleanPhone ? `wa_${cleanPhone}` : '',
      ].filter(Boolean))
    );
    if (roomIds.length === 0) return [];

    const tableQuery = db.from('messages').select('sender_role, message_text, created_at');
    const filteredQuery =
      typeof tableQuery.in === 'function'
        ? tableQuery.in('room_id', roomIds)
        : tableQuery.eq('room_id', roomIds[0]);

    const { data, error } = await filteredQuery
      .order('created_at', { ascending: false })
      .limit(8);

    if (!error && Array.isArray(data)) {
      const priorityPhone = isPriorityNurmiyatyPhone(cleanPhone);
      const cleanedRows = data.filter((m) => {
        if (!priorityPhone) return true;
        const txt = String(m.message_text || '');
        return !/\bfatimah\b/i.test(txt) && !/\bahmad\s+fauzi\b/i.test(txt);
      });

      return cleanedRows
        .slice(0, 6)
        .reverse()
        .map((m) => ({
          role: m.sender_role === 'user' ? 'user' : 'assistant',
          content: m.message_text,
        }));
    }
  } catch (e) {
    console.warn('getRecentChatHistory error:', e.message);
  }
  return [];
}

/**
 * Simpan pesan chat ke tabel messages Supabase pada room kanonik wa_628...
 */
export async function recordChatMessage(cleanPhone, role, text, senderName, clientOverride = null) {
  const db = clientOverride || supabase;
  const normalized = normalizePhone(cleanPhone) || String(cleanPhone || '').trim();
  const priorityPhone = isPriorityNurmiyatyPhone(normalized);
  const safeSenderName = isPoisonedFallbackName(senderName)
    ? (priorityPhone ? NURMIYATY_PRIORITY_BINDING.defaultNamaWali : 'Wali Santri')
    : (senderName || (role === 'user' ? 'Wali Santri' : 'Smart Riayah AI'));

  try {
    await db.from('messages').insert([{
      room_id: `wa_${normalized}`,
      sender_email: role === 'user' ? `${normalized}@whatsapp.user` : 'ai@smartriayah.com',
      sender_name: safeSenderName,
      sender_role: role,
      message_text: text,
      is_read: true
    }]);
  } catch (e) {
    console.warn('recordChatMessage error:', e.message);
  }
}

/**
 * Simpan booking kunjungan ke antrean dan broadcast ke Supabase Realtime
 */
export async function saveBookingToSystem(bookingData) {
  try {
    await broadcastToSupabaseRealtime('whatsapp.visit_booking', bookingData);

    await supabase.from('messages').insert([{
      room_id: 'visit_bookings_log',
      sender_email: 'ai@smartriayah.com',
      sender_name: 'Smart Riayah AI Gate Pass',
      sender_role: 'system',
      message_text: JSON.stringify(bookingData),
      reaction: bookingData.is_weekday ? 'VISIT_MANUAL_WEEKDAY' : 'VISIT_AUTO_WEEKEND',
      is_read: false
    }]);

    console.log(`🎫 [Visit Booking Saved]: ${bookingData.id} for ${bookingData.nama_santri} (${bookingData.hari_kunjungan}) - ${bookingData.status_kunjungan}`);

    // Simpan juga data booking AI ke MongoDB collection 'ai_whatsapp_bookings'
    await saveAiDocument('ai_whatsapp_bookings', {
      id: `AI-BOOK-${bookingData.id}`,
      bookingId: bookingData.id,
      santriNama: bookingData.nama_santri,
      rfid_uid: bookingData.rfid_uid || null,
      sender: bookingData.no_wa_penjenguk,
      senderName: bookingData.nama_penjenguk,
      ai_engine: bookingData.booking_source || 'AI_AUTONOMOUS_RESPONDER',
      is_weekday: bookingData.is_weekday,
      barcode_token: bookingData.barcode_token,
      status_kunjungan: bookingData.status_kunjungan,
      booking: bookingData
    }).catch(() => {});

    return true;
  } catch (err) {
    console.error('❌ [saveBookingToSystem Error]:', err.message);
    return false;
  }
}

function sanitizeAutonomousReplyForPhone(replyText, cleanPhone, waliData) {
  let out = String(replyText || '').trim();
  if (!out || !isPriorityNurmiyatyPhone(cleanPhone)) return out;

  const targetWali = waliData?.namaWali || NURMIYATY_PRIORITY_BINDING.defaultNamaWali;
  const targetSantri = waliData?.santriNama || NURMIYATY_PRIORITY_BINDING.santriNama;

  out = out
    .replace(/(?:Ibu|Bu)\s+Fatimah(?:\s+Az[-\s]?Zahra)?/gi, targetWali)
    .replace(/Fatimah\s+Az[-\s]?Zahra/gi, targetWali)
    .replace(/Ahmad\s+Fauzi/gi, targetSantri)
    .replace(/\b(?:ananda|santri)\s+Fauzi\b/gi, `ananda ${targetSantri}`);

  return out;
}

/**
 * Otak AI Otonom + Konteks Identitas:
 * Menghasilkan balasan islami, natural & akurat beserta objek identitas wali/santri yang terverifikasi.
 */
export async function generateAutonomousReplyWithContext(
  senderPhone,
  incomingText,
  senderName = 'Wali Santri',
  resolvedIdentityOverride = null
) {
  const cleanPhone = normalizePhone(senderPhone) || String(senderPhone || '').trim();
  const safeInputName = isPoisonedFallbackName(senderName) ? '' : senderName;

  // 1. Resolusi identitas lengkap dari Supabase / Prioritas Nurmiyaty / Fallback netral
  const waliData =
    resolvedIdentityOverride ||
    (await resolveWaliIdentity(cleanPhone || senderPhone, safeInputName));

  const textLower = String(incomingText || '').toLowerCase();
  const naturalGreeting = getNaturalGreeting(incomingText, waliData.namaWali);
  const rtc = getRealtimePondokClockBackend();
  const priorityPhone = isPriorityNurmiyatyPhone(cleanPhone);

  // ─── INTENT PRIORITAS TERTINGGI: CLOSINGAN / WALI INGIN BICARA DENGAN ADMIN ───
  const isAdminRequest =
    textLower.includes('bicara sama admin') ||
    textLower.includes('bicara dengan admin') ||
    textLower.includes('ngomong sama admin') ||
    textLower.includes('ngomong dengan admin') ||
    textLower.includes('hubungkan ke admin') ||
    textLower.includes('hubungi admin') ||
    textLower.includes('panggil admin') ||
    textLower.includes('minta nomor admin') ||
    textLower.includes('kontak admin') ||
    textLower.includes('bicara ustadz') ||
    textLower.includes('bicara dengan ustadz') ||
    textLower.includes('ngomong sama ustadz') ||
    textLower.includes('pengasuh pondok') ||
    textLower.includes('apakah ini dengan admin') ||
    textLower.includes('apakah ini admin') ||
    textLower.includes('apakah dengan admin') ||
    textLower.includes('ini admin kah') ||
    textLower.includes('apakah admin') ||
    textLower.includes('mau admin') ||
    textLower.includes('bisa bicara langsung') ||
    textLower.includes('bicara langsung');

  if (isAdminRequest) {
    console.log(`🔔 [Smart Handoff Triggered]: Wali ${cleanPhone} meminta bicara dengan Admin! Mengalihkan ke Mode Manual.`);

    await setManualTakeover(cleanPhone, true);

    try {
      await broadcastToSupabaseRealtime('whatsapp.takeover', {
        phone: cleanPhone,
        isManual: true,
        reason: 'WALI_REQUESTED_ADMIN',
        senderName: waliData.namaWali,
        santriNama: waliData.santriNama,
        admin: 'Ust. Drs. H. Mustofa',
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Takeover broadcast warning:', e.message);
    }

    const handoffReply = `${naturalGreeting}percakapan ini sekarang kami alihkan langsung ke *Admin Ri'ayah / Ustadz Musyrif Asrama* ya.\n\nUstadz akan segera membaca dan membalas pesan Bapak/Ibu secara langsung di sini. Mohon ditunggu sebentar ya Bapak/Ibu. 🙏`;
    await recordChatMessage(cleanPhone, 'user', incomingText, waliData.namaWali);
    await recordChatMessage(cleanPhone, 'assistant', handoffReply, 'Smart Ri\'ayah AI');
    await saveAiDocument('ai_chat_logs', {
      channel: String(senderPhone).startsWith('TG-') ? 'Telegram' : 'WhatsApp',
      senderPhone: cleanPhone,
      senderName: waliData.namaWali,
      santriNama: waliData.santriNama,
      engine: 'SMART_HANDOFF_TRIGGER',
      intent: 'ADMIN_HANDOFF',
      prompt: incomingText,
      reply: handoffReply
    }).catch(() => {});
    return { reply: handoffReply, waliData, cleanPhone };
  }

  // Rekam pesan masuk pengguna ke riwayat
  await recordChatMessage(cleanPhone, 'user', incomingText, waliData.namaWali);

  // Ambil riwayat chat sebelumnya agar percakapan nyambung
  const recentHistory = await getRecentChatHistory(cleanPhone);

  // 1. Coba gunakan DeepSeek AI jika token tersedia
  const deepseekKey = (process.env.DEEPSEEK_API_KEY || process.env.VITE_DEEPSEEK_API_KEY || '').trim();
  if (deepseekKey) {
    try {
      const systemPrompt = `Anda adalah pengasuh/ustadz ramah dan cerdas di Pesantren Modern Darul Ulum yang membalas pesan WhatsApp wali santri.

WAKTU SISTEM PONDOK REAL-TIME SAAT INI:
- Hari & Tanggal: ${rtc.namaHari}, ${rtc.tglLengkap} (Format YMD: ${rtc.ymd})
- Jam: ${rtc.jamMenit} WITA
- Referensi Kalender 7 Hari Ke Depan:
${rtc.refDays.map(r => `  * [${r.label}] -> ${r.hari}, ${r.tanggal} (${r.rule})`).join('\n')}

DATA SANTRI DI SISTEM (SUMBER KEBENARAN UTAMA):
- Nama Wali Terdaftar: ${waliData.namaWali} (No. WA: ${cleanPhone})
- Santri Terdaftar: ${waliData.santriNama} (NIS: ${waliData.nis || '-'}, Kelas: ${waliData.kelas}, Kamar: ${waliData.kamar}, UID RFID: ${waliData.rfidUid || '-'})
- Status Asrama: ${waliData.statusAsrama}, Saldo RFID: ${waliData.saldoRfid}, Limit Harian: ${waliData.limitHarian}

ATURAN MUTLAK IDENTITAS:
- WAJIB merujuk nama wali "${waliData.namaWali}" dan nama santri "${waliData.santriNama}" sesuai DATA SANTRI DI SISTEM di atas.
- DILARANG KERAS mengarang, menebak, atau memakai nama contoh/placeholder seperti "Ibu Fatimah", "Ibu Fatimah Az-Zahra", atau "Ahmad Fauzi" jika tidak tercantum di DATA SANTRI DI SISTEM.

PANDUAN KOMUNIKASI & ALUR BOOKING KUNJUNGAN:
1. BAHASA HARUS NATURAL, SANTUN, DAN NYAMBUNG:
   - Jawab secara luwes, bersahabat, dan langsung ke inti pertanyaan orang tua.
   - JANGAN PERNAH membuat daftar menu nomor (1, 2, 3...) atau format kaku robotik.
   - JANGAN menyemburkan template panjang atau brosur peraturan. Percakapan harus santai dan mengalir.

2. MENJAWAB SALAM SEPERLUNYA:
   - Jawab salam ("Wa'alaikumsalam...") HANYA JIKA orang tua memang mengucap salam.
   - Jika orang tua TIDAK mengucap salam (misal hanya bilang "mau jenguk anak", "bisa nengok gak", atau "halo"), JANGAN menjawab dengan salam panjang "Wa'alaikumsalam Warahmatullahi Wabarakatuh". Gunakan sapaan wajar ("Halo Bapak/Ibu", "Iya Bapak/Ibu", dll).

3. ALUR PENGUMPULAN DATA BOOKING KUNJUNGAN SECARA BERTAHAP:
   - Jika orang tua bilang ingin menjenguk/nengok anak:
     a) Jika belum jelas nama santrinya: tanyakan secara santai atas nama santri siapa dan kelas berapa, serta rencana berkunjung hari apa dan jam berapa. (Jika di data sistem sudah terdaftar ananda ${waliData.santriNama}, Anda boleh langsung mengonfirmasi dengan ramah: "Bisa Bapak/Ibu. Mau menjenguk ananda ${waliData.santriNama} ya? Rencana berkunjung hari apa dan jam berapa?").
     b) Jika nama santri sudah ada tapi belum menyebutkan hari/jam: tanyakan rencana berkunjung hari apa dan jam berapa, serta apakah ada titipan barang/makanan yang mau dibawa.
     c) Jika data kunjungan SUDAH LENGKAP (ada nama santri, hari/tanggal, dan perkiraan jam):
        - Cek hari kunjungannya:
          * JIKA SENIN, SELASA, RABU, atau KAMIS (HARI KERJA / WEEKDAY):
            Kunjungan hari kerja membutuhkan persetujuan Admin Ri'ayah.
            Beri tahu bahwa permohonan kunjungan di hari kerja sudah dicatat dan sedang diteruskan ke Admin Ri'ayah untuk persetujuan. Barcode kunjungan resmi akan dikirim otomatis ke WhatsApp ini segera setelah disetujui. Ingatkan titipan barang maksimal 5 Kg.
          * JIKA JUMAT, SABTU, atau MINGGU (AKHIR PEKAN / WEEKEND):
            Kunjungan akhir pekan LANGSUNG DISETUJUI OTOMATIS (Auto-Approved)!
            Beri tahu bahwa kunjungan sudah langsung disetujui otomatis. Berikan kode Barcode Gate Pass (contoh format: GP-DU-[NAMA]-[4 ANGKA]). Beritahu untuk menunjukkan pesan/barcode ke satpam di pos gerbang dan titipan maks 5 Kg.
        - PENTING: Saat data booking kunjungan berhasil difinalkan, sertakan DI BARIS TERAKHIR tag JSON penanda booking berikut:
          <!--BOOKING_DATA:{"nama_santri":"...","kelas":"...","hari_kunjungan":"...","tanggal_kunjungan":"YYYY-MM-DD","jam_kunjungan":"HH:mm","jam_selesai":"HH:mm","titipan_barang":"...","berat_barang_kg":...,"nama_penjenguk":"...","is_weekday":true/false,"barcode_token":"..."}-->

4. PERTANYAAN LAIN (KABAR, SALDO, KESEHATAN, IZIN):
   - Jawab secara wajar dan to the point sesuai data santri yang ada.`;

      const messagesPayload = [
        { role: 'system', content: systemPrompt },
        ...recentHistory.slice(-4),
        { role: 'user', content: incomingText }
      ];

      const dsRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${deepseekKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: messagesPayload,
          temperature: 0.3,
          max_tokens: 350
        })
      });

      if (dsRes.ok) {
        const dsJson = await dsRes.json();
        let reply = dsJson.choices?.[0]?.message?.content?.trim();

        if (reply) {
          // Deteksi apakah DeepSeek menyertakan tag data booking
          const bookingMatch = reply.match(/<!--BOOKING_DATA:(.*?)-->/s);
          if (bookingMatch && bookingMatch[1]) {
            try {
              const bData = JSON.parse(bookingMatch[1]);
              const rawBookingSantri = String(bData.nama_santri || '').trim();
              const rawBookingPenjenguk = String(bData.nama_penjenguk || '').trim();

              const safeBookingSantri =
                !rawBookingSantri || (priorityPhone && /fauzi/i.test(rawBookingSantri))
                  ? waliData.santriNama
                  : rawBookingSantri;
              const safeBookingKelas =
                !bData.kelas || (priorityPhone && /fauzi/i.test(rawBookingSantri))
                  ? waliData.kelas
                  : bData.kelas;
              const safeBookingPenjenguk =
                !rawBookingPenjenguk || isPoisonedFallbackName(rawBookingPenjenguk)
                  ? waliData.namaWali
                  : rawBookingPenjenguk;

              const cleanSantri = (safeBookingSantri || 'Santri').replace(/[^a-zA-Z]/g, '').slice(0, 6).toUpperCase();
              const isWkday = Boolean(bData.is_weekday);
              const barcode = bData.barcode_token || (isWkday ? null : `GP-DU-${cleanSantri}-${Math.floor(1000 + Math.random() * 9000)}`);

              const bookingRecord = {
                id: `VST-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
                booking_source: 'WHATSAPP_AI_NATURAL',
                nama_santri: safeBookingSantri,
                kelas: safeBookingKelas,
                asal: 'Surabaya',
                tanggal_kunjungan: bData.tanggal_kunjungan || rtc.ymd,
                hari_kunjungan: bData.hari_kunjungan || rtc.namaHari,
                jam_kunjungan: bData.jam_kunjungan || '14:00',
                jam_selesai: bData.jam_selesai || '15:30',
                titipan_barang: bData.titipan_barang || '-',
                berat_barang_kg: Number(bData.berat_barang_kg) || 0,
                nama_penjenguk: safeBookingPenjenguk,
                status_penjenguk: 'Wali Santri',
                no_wa_penjenguk: cleanPhone,
                rfid_uid: waliData.rfidUid || null,
                barcode_token: barcode,
                approval_type: isWkday ? 'MANUAL_WEEKDAY' : 'AUTO_WEEKEND',
                status_kunjungan: isWkday ? 'Menunggu Approval' : 'Disetujui (Auto-Approved Weekend)',
                is_weekday: isWkday,
                waktu_chat_masuk: `${rtc.namaHari}, ${rtc.tglLengkap} • ${rtc.jamMenitDetik} WITA`,
                waktu_disetujui: isWkday ? null : `${rtc.namaHari}, ${rtc.tglLengkap} • ${rtc.jamMenitDetik} WITA`,
                created_at: new Date().toISOString()
              };

              // Simpan ke sistem booking & broadcast ke dashboard
              await saveBookingToSystem(bookingRecord);
            } catch (pErr) {
              console.warn('Booking JSON parse error:', pErr.message);
            }

            // Bersihkan tag booking agar WhatsApp hanya menerima pesan percakapan yang bersih
            reply = reply.replace(/<!--BOOKING_DATA:(.*?)-->/s, '').trim();
          }

          reply = sanitizeAutonomousReplyForPhone(reply, cleanPhone, waliData);

          // Rekam balasan asisten ke database chat & MongoDB AI Logs
          await recordChatMessage(cleanPhone, 'assistant', reply, 'Smart Ri\'ayah AI');
          await saveAiDocument('ai_chat_logs', {
            channel: String(senderPhone).startsWith('TG-') ? 'Telegram' : 'WhatsApp',
            senderPhone: cleanPhone,
            senderName: waliData.namaWali,
            santriNama: waliData.santriNama,
            engine: 'DEEPSEEK_AI',
            model: 'deepseek-chat',
            tokensUsed: dsJson.usage || null,
            prompt: incomingText,
            reply
          }).catch(() => {});
          return { reply, waliData, cleanPhone };
        }
      }
    } catch (llmErr) {
      console.warn('⚠️ [AI Otonom] DeepSeek AI offline/fallback ke Smart Local Reasoning:', llmErr.message);
    }
  }

  // ─── 2. SMART LOCAL REASONING ENGINE (FALLBACK NATURAL BERBASIS KONTEKS) ───
  const saveLocalAiReply = async (replyText, intentName) => {
    const cleanReply = sanitizeAutonomousReplyForPhone(replyText, cleanPhone, waliData);
    await recordChatMessage(cleanPhone, 'assistant', cleanReply, 'Smart Ri\'ayah AI');
    await saveAiDocument('ai_chat_logs', {
      channel: String(senderPhone).startsWith('TG-') ? 'Telegram' : 'WhatsApp',
      senderPhone: cleanPhone,
      senderName: waliData.namaWali,
      santriNama: waliData.santriNama,
      engine: 'SMART_LOCAL_REASONING',
      intent: intentName,
      prompt: incomingText,
      reply: cleanReply
    }).catch(() => {});
    return { reply: cleanReply, waliData, cleanPhone };
  };

  // A. INTENT KUNJUNGAN / SAMBANGAN / JENGUK
  const isVisiting =
    textLower.includes('jenguk') ||
    textLower.includes('kunjung') ||
    textLower.includes('sambang') ||
    textLower.includes('besuk') ||
    textLower.includes('tengok') ||
    textLower.includes('ketemu');

  if (isVisiting) {
    const hasDayMention =
      textLower.includes('senin') ||
      textLower.includes('selasa') ||
      textLower.includes('rabu') ||
      textLower.includes('kamis') ||
      textLower.includes('jumat') ||
      textLower.includes('sabtu') ||
      textLower.includes('minggu') ||
      textLower.includes('besok') ||
      textLower.includes('lusa') ||
      textLower.includes('hari ini');

    const hasTimeMention =
      textLower.includes('jam') ||
      textLower.includes('pukul') ||
      textLower.includes('siang') ||
      textLower.includes('pagi') ||
      textLower.includes('sore') ||
      /\d{1,2}[:.]\d{2}/.test(textLower);

    // KASUS 1: Baru bilang mau jenguk (belum ada rincian waktu/anak)
    if (!hasDayMention && !hasTimeMention) {
      if (waliData.santriNama && waliData.santriNama !== 'Ananda') {
        const reply = `${naturalGreeting}bisa Bapak/Ibu. Mau menjenguk ananda *${waliData.santriNama}* ya? Rencananya mau datang hari apa dan perkiraan jam berapa?`;
        return await saveLocalAiReply(reply, 'VISIT_ASK_SCHEDULE');
      }
      const reply = `${naturalGreeting}bisa Bapak/Ibu. Mau menjenguk ananda atas nama siapa dan kelas berapa ya? Rencananya mau berkunjung hari apa dan jam berapa?`;
      return await saveLocalAiReply(reply, 'VISIT_ASK_IDENTITY');
    }

    // KASUS 2: Sudah sebut hari/waktu kunjungan -> Kumpulkan data dan masukkan ke sistem booking!
    let targetDayName = 'Minggu';
    let targetYmd = rtc.ymd;
    let isWeekdayBooking = false;

    if (textLower.includes('senin')) { targetDayName = 'Senin'; isWeekdayBooking = true; }
    else if (textLower.includes('selasa')) { targetDayName = 'Selasa'; isWeekdayBooking = true; }
    else if (textLower.includes('rabu')) { targetDayName = 'Rabu'; isWeekdayBooking = true; }
    else if (textLower.includes('kamis')) { targetDayName = 'Kamis'; isWeekdayBooking = true; }
    else if (textLower.includes('jumat')) { targetDayName = 'Jumat'; isWeekdayBooking = false; }
    else if (textLower.includes('sabtu')) { targetDayName = 'Sabtu'; isWeekdayBooking = false; }
    else if (textLower.includes('minggu')) { targetDayName = 'Minggu'; isWeekdayBooking = false; }
    else if (textLower.includes('besok')) {
      const matchBesok = rtc.refDays.find(r => r.offset === 1);
      if (matchBesok) {
        targetDayName = matchBesok.hari;
        targetYmd = matchBesok.tanggal;
        isWeekdayBooking = matchBesok.is_weekday;
      }
    } else {
      targetDayName = rtc.namaHari;
      targetYmd = rtc.ymd;
      isWeekdayBooking = rtc.isWeekday;
    }

    const matchedRef = rtc.refDays.find(r => r.hari.toLowerCase() === targetDayName.toLowerCase());
    if (matchedRef) {
      targetYmd = matchedRef.tanggal;
    }

    const targetSantriName = waliData.santriNama !== 'Ananda' ? waliData.santriNama : 'Santri';
    const cleanSantriName = targetSantriName.replace(/[^a-zA-Z]/g, '').slice(0, 6).toUpperCase();
    const barcode = isWeekdayBooking ? null : `GP-DU-${cleanSantriName}-${Math.floor(1000 + Math.random() * 9000)}`;

    const bookingRecord = {
      id: `VST-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
      booking_source: 'WHATSAPP_LOCAL_NATURAL',
      nama_santri: targetSantriName,
      kelas: waliData.kelas,
      asal: 'Surabaya',
      tanggal_kunjungan: targetYmd,
      hari_kunjungan: targetDayName,
      jam_kunjungan: '14:00',
      jam_selesai: '15:30',
      titipan_barang: textLower.includes('makan') ? 'Makanan / Snack' : (textLower.includes('baju') ? 'Pakaian & Perlengkapan' : '-'),
      berat_barang_kg: 2,
      nama_penjenguk: waliData.namaWali,
      status_penjenguk: 'Wali Santri',
      no_wa_penjenguk: cleanPhone,
      rfid_uid: waliData.rfidUid || null,
      barcode_token: barcode,
      approval_type: isWeekdayBooking ? 'MANUAL_WEEKDAY' : 'AUTO_WEEKEND',
      status_kunjungan: isWeekdayBooking ? 'Menunggu Approval' : 'Disetujui (Auto-Approved Weekend)',
      is_weekday: isWeekdayBooking,
      waktu_chat_masuk: `${rtc.namaHari}, ${rtc.tglLengkap} • ${rtc.jamMenitDetik} WITA`,
      waktu_disetujui: isWeekdayBooking ? null : `${rtc.namaHari}, ${rtc.tglLengkap} • ${rtc.jamMenitDetik} WITA`,
      created_at: new Date().toISOString()
    };

    // Masukkan data booking ke sistem
    await saveBookingToSystem(bookingRecord);

    let reply = '';
    if (isWeekdayBooking) {
      reply = `${naturalGreeting}jadwal kunjungan untuk ananda *${targetSantriName}* pada hari *${targetDayName}* sudah kami catat di sistem ya.\n\nKarena kunjungannya di hari kerja (${targetDayName}), permohonan ini kami teruskan dulu ke Admin Ri'ayah untuk persetujuan. Barcode kunjungannya akan langsung dikirimkan ke WhatsApp ini begitu disetujui ya Bapak/Ibu.\n\nSebagai catatan, barang atau makanan titipan maksimal 5 Kg ya.`;
    } else {
      reply = `${naturalGreeting}kunjungan untuk ananda *${targetSantriName}* pada hari *${targetDayName}* sudah *langsung disetujui otomatis* di sistem pondok.\n\n🎫 *Barcode Gate Pass Anda:* *${barcode}*\n\nNanti pas tiba di gerbang, tinggal perlihatkan pesan barcode ini ke petugas satpam di pos jaga ya. Titipan barang maksimal 5 Kg. Semoga perjalanannya lancar ya Bapak/Ibu.`;
    }

    return await saveLocalAiReply(reply, isWeekdayBooking ? 'VISIT_BOOKING_WEEKDAY' : 'VISIT_BOOKING_WEEKEND');
  }

  // B. TOPIK SALDO RFID / DOMPET PINTAR
  if (textLower.includes('saldo') || textLower.includes('uang') || textLower.includes('dompet') || textLower.includes('jajan') || textLower.includes('rfid') || textLower.includes('topup') || textLower.includes('top up')) {
    const reply = `${naturalGreeting}alhamdulillah sisa saldo kartu RFID ananda *${waliData.santriNama}* saat ini *${waliData.saldoRfid}* dengan limit jajan ${waliData.limitHarian} per hari.\n\nAda yang perlu kami bantu untuk pengisian saldo atau kebutuhan ananda?`;
    return await saveLocalAiReply(reply, 'QUERY_SALDO_RFID');
  }

  // C. TOPIK KABAR / KONDISI SANTRI
  if (textLower.includes('kabar') || textLower.includes('sehat') || textLower.includes('kondisi') || textLower.includes('kegiatan') || textLower.includes('sholat') || textLower.includes('shalat') || textLower.includes('anak saya')) {
    const reply = `${naturalGreeting}alhamdulillah ananda *${waliData.santriNama}* saat ini dalam kondisi sehat wal'afiat di asrama (${waliData.kamar}). Aktivitas mengaji, sholat berjamaah, dan sekolah berjalan dengan baik.\n\nAda pesan khusus yang ingin disampaikan untuk ananda?`;
    return await saveLocalAiReply(reply, 'QUERY_KABAR_SANTRI');
  }

  // D. TOPIK KESEHATAN / SAKIT / UKS / POSKESTREN
  if (textLower.includes('sakit') || textLower.includes('demam') || textLower.includes('obat') || textLower.includes('uks') || textLower.includes('poskestren') || textLower.includes('klinik') || textLower.includes('dokter')) {
    const reply = `${naturalGreeting}alhamdulillah ananda *${waliData.santriNama}* terpantau sehat di pondok. Petugas kesehatan Poskestren juga siaga 24 jam mendampingi santri. Apakah ananda sempat mengeluhkan sesuatu saat menelepon?`;
    return await saveLocalAiReply(reply, 'QUERY_KESEHATAN');
  }

  // E. TOPIK PERIZINAN & PULANG
  if (textLower.includes('izin') || textLower.includes('pulang') || textLower.includes('libur') || textLower.includes('perpanjang') || textLower.includes('pesiar') || textLower.includes('keluar')) {
    const reply = `${naturalGreeting}untuk perizinan ananda *${waliData.santriNama}*, permohonan dapat diajukan via aplikasi Smart Ri'ayah minimal H-1 ya. Status izin ananda saat ini: *${waliData.izinTerakhir}*. Ada izin apa yang ingin diajukan untuk ananda?`;
    return await saveLocalAiReply(reply, 'QUERY_PERIZINAN');
  }

  // F. SAPAAN UMUM / DEFAULT
  const reply = `${naturalGreeting}ada yang bisa kami bantu terkait ananda *${waliData.santriNama}* di Pesantren Modern Darul Ulum? Silakan disampaikan ya Bapak/Ibu. 🙏`;
  return await saveLocalAiReply(reply, 'GENERAL_GREETING');
}

/**
 * Otak AI Otonom (Wrapper kompatibilitas): Mengembalikan string balasan saja.
 */
export async function generateAutonomousReply(senderPhone, incomingText, senderName = 'Wali Santri') {
  const res = await generateAutonomousReplyWithContext(senderPhone, incomingText, senderName);
  return res.reply;
}

/**
 * Mengirim pesan balasan otomatis via Fonnte REST API (/send)
 */
export async function sendFonnteAutoReply(targetPhone, replyText, customToken = null) {
  const token = customToken || process.env.FONNTE_TOKEN || DEFAULT_FONNTE_TOKEN;
  const cleanTarget = normalizePhone(targetPhone);

  try {
    const formData = new FormData();
    formData.append('target', cleanTarget);
    formData.append('message', replyText);
    formData.append('countryCode', '62');
    formData.append('preview', 'false');

    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { Authorization: token },
      body: formData,
    });

    const data = await response.json().catch(() => ({}));
    const isSuccess = response.ok && (data.status === true || data.status === 'true' || Boolean(data.id));

    console.log(`🤖 [AI Otonom Dispatched to ${cleanTarget}]:`, isSuccess ? 'SUCCESS' : 'FAILED', data);
    return { success: isSuccess, data };
  } catch (err) {
    console.error('❌ [AI Otonom Dispatch Error]:', err.message);
    return { success: false, error: err.message };
  }
}
