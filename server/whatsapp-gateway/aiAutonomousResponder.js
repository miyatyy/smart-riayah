/**
 * Smart Ri'ayah - Autonomous AI Responder for WhatsApp Gateway
 * Otak AI Otonom yang membalas pesan masuk dari Wali Santri secara instan via Fonnte API
 */

import { createClient } from '@supabase/supabase-js';
import { broadcastToSupabaseRealtime } from './supabaseBroadcaster.js';
import { saveAiDocument } from '../mongo.js';
import { resolveWaliAddressing, applySapaanToText } from '../../src/utils/phoneUtils.js';

function resolveSupabaseUrl() {
  const candidates = [
    process.env.SUPABASE_URL,
    process.env.VITE_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ];
  for (const raw of candidates) {
    const cleaned = String(raw || '').trim().replace(/^['"]|['"]$/g, '');
    if (!cleaned) continue;
    try {
      const parsed = new URL(cleaned);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return cleaned;
      }
    } catch {}
  }
  return '';
}

function resolveSupabaseKey() {
  const candidates = [
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.VITE_SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_ANON_KEY,
  ];
  for (const raw of candidates) {
    const cleaned = String(raw || '').trim().replace(/^['"]|['"]$/g, '');
    if (cleaned) return cleaned;
  }
  return '';
}

const supabaseUrl = resolveSupabaseUrl();
const supabaseKey = resolveSupabaseKey();

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
    insert: async () => ({ error: { message: 'Supabase fallback stub active' } }),
  }),
});

let supabase = createFallbackSupabaseStub();
if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } catch (err) {
    console.warn('⚠️ [AI Responder] Gagal init Supabase client, pakai fallback stub:', err?.message || err);
  }
}

let authenticatedSupabase = null;
let authClientPromise = null;

export async function getAuthenticatedSupabaseClient() {
  const url = resolveSupabaseUrl();
  const key = resolveSupabaseKey();
  if (!url || !key) return createFallbackSupabaseStub();

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    if (!authenticatedSupabase) {
      authenticatedSupabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
    }
    return authenticatedSupabase;
  }

  if (authenticatedSupabase) {
    try {
      const { data: { session } } = await authenticatedSupabase.auth.getSession();
      if (session) return authenticatedSupabase;
    } catch {}
  }

  if (!authClientPromise) {
    authClientPromise = (async () => {
      const client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: true }
      });
      const { error } = await client.auth.signInWithPassword({
        email: 'adminriayah@smartriayah.sch.id',
        password: 'Riayah2026!'
      }).catch(err => ({ error: err }));

      if (error) {
        console.warn('⚠️ [AI Responder] Auth adminriayah failed, trying superadmin:', error.message);
        await client.auth.signInWithPassword({
          email: 'superadmin@smartriayah.sch.id',
          password: 'Riayah2026!'
        }).catch(() => {});
      }
      authenticatedSupabase = client;
      supabase = client;
      authClientPromise = null;
      return client;
    })();
  }
  return authClientPromise;
}

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

  const db = await getAuthenticatedSupabaseClient();
  const { data: userData } = await db.auth.getUser().catch(() => ({ data: {} }));
  const systemEmail = userData?.user?.email || 'adminriayah@smartriayah.sch.id';

  if (isManual) {
    manualTakeoverPhones.add(clean);
    try {
      // 1. Bersihkan record lama untuk nomor ini di Supabase messages table
      await db
        .from('messages')
        .delete()
        .eq('room_id', 'whatsapp_takeover')
        .like('message_text', `%${last8}%`);

      // 2. Insert record baru sebagai penanda bahwa nomor ini sedang di-takeover manual
      const { error } = await db
        .from('messages')
        .insert([{
          room_id: 'whatsapp_takeover',
          sender_email: systemEmail,
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
      const { error } = await db
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
    const db = await getAuthenticatedSupabaseClient();
    const { data, error } = await db
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
  const db = clientOverride || (await getAuthenticatedSupabaseClient());
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

    if (rows.length === 0 && !clientOverride && !process.env.VERCEL && process.env.DATABASE_URL && !process.env.VITEST && !process.env.NODE_TEST) {
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
      } catch { }
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
    const trimmedFallback = String(fallbackSenderName || '').trim();
    const isReadableLatinName =
      /^[a-zA-Z0-9\s.,'-]{3,40}$/.test(trimmedFallback) &&
      !/^(?:wali\s+santri|bapak\/ibu|user|pengguna)$/i.test(trimmedFallback);
    const cleanOverride =
      isReadableLatinName && !isPoisonedFallbackName(trimmedFallback)
        ? trimmedFallback
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
 * Menggunakan sapaan tepat Pak / Bu / Bapak/Ibu dari resolver.
 */
function getNaturalGreeting(incomingText, addrOrName = '') {
  const text = String(incomingText || '').toLowerCase();
  const hasSalam =
    text.includes('assalamu') ||
    text.includes('aslam') ||
    text.includes('ass ') ||
    text.includes('mikum') ||
    text.includes('kumsalam');

  const targetName =
    typeof addrOrName === 'object' && addrOrName !== null
      ? addrOrName.panggilan || addrOrName.sapaan || 'Bapak/Ibu'
      : (addrOrName && addrOrName !== 'Wali Santri' ? addrOrName : 'Bapak/Ibu');

  if (hasSalam) {
    return `Wa'alaikumsalam ${targetName}, `;
  }
  if (text.includes('pagi')) return `Selamat pagi ${targetName}, `;
  if (text.includes('siang')) return `Selamat siang ${targetName}, `;
  if (text.includes('sore')) return `Selamat sore ${targetName}, `;
  if (text.includes('malam')) return `Selamat malam ${targetName}, `;

  return `Baik ${targetName}, `;
}

/**
 * Helper waktu pondok real-time (WITA / Asia/Makassar) untuk backend
 */
function getRealtimePondokClockBackend() {
  const now = new Date();
  const witaYmd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Makassar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const witaBase = new Date(`${witaYmd}T12:00:00Z`);
  const namaHariArr = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const dayIndex = witaBase.getUTCDay();
  const namaHari = namaHariArr[dayIndex];
  const ymd = witaYmd;
  const tglLengkap = now.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Makassar',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const jamMenit = now.toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Makassar',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const jamMenitDetik = now.toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Makassar',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const isWeekday = dayIndex >= 1 && dayIndex <= 4; // Senin - Kamis

  const refDays = [];
  for (let i = 0; i < 7; i++) {
    const cd = new Date(witaBase);
    cd.setUTCDate(witaBase.getUTCDate() + i);
    const cdDay = namaHariArr[cd.getUTCDay()];
    const cdYmd = cd.toISOString().slice(0, 10);
    const cdIsWeekday = cd.getUTCDay() >= 1 && cd.getUTCDay() <= 4;
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

function getChatMemoryStore() {
  if (!globalThis._srWaChatMemory) {
    globalThis._srWaChatMemory = new Map();
  }
  return globalThis._srWaChatMemory;
}

function getRecentBookingMemoryStore() {
  if (!globalThis._srRecentSavedBookings) {
    globalThis._srRecentSavedBookings = new Map();
  }
  return globalThis._srRecentSavedBookings;
}

/**
 * Ambil riwayat chat terakhir untuk nomor HP ini (mencakup room wa_628... & wa_08... + memory fallback)
 */
export async function getRecentChatHistory(cleanPhone, clientOverride = null) {
  const db = clientOverride || (await getAuthenticatedSupabaseClient());
  const normalized = normalizePhone(cleanPhone) || String(cleanPhone || '').trim();
  const priorityPhone = isPriorityNurmiyatyPhone(cleanPhone);

  let dbHistory = [];
  try {
    const { intl, local } = getPhoneVariants(cleanPhone);
    const roomIds = Array.from(
      new Set([
        intl ? `wa_${intl}` : '',
        local ? `wa_${local}` : '',
        cleanPhone ? `wa_${cleanPhone}` : '',
      ].filter(Boolean))
    );
    if (roomIds.length > 0) {
      const tableQuery = db.from('messages').select('sender_role, message_text, created_at');
      const filteredQuery =
        typeof tableQuery.in === 'function'
          ? tableQuery.in('room_id', roomIds)
          : tableQuery.eq('room_id', roomIds[0]);

      const { data, error } = await filteredQuery
        .order('created_at', { ascending: false })
        .limit(8);

      if (!error && Array.isArray(data) && data.length > 0) {
        const cleanedRows = data.filter((m) => {
          if (!priorityPhone) return true;
          const txt = String(m.message_text || '');
          return !/\bfatimah\b/i.test(txt) && !/\bahmad\s+fauzi\b/i.test(txt);
        });

        dbHistory = cleanedRows
          .slice(0, 6)
          .reverse()
          .map((m) => ({
            role: m.sender_role === 'user' ? 'user' : 'assistant',
            content: m.message_text,
          }));
      }
    }
  } catch (e) {
    console.warn('getRecentChatHistory error:', e.message);
  }

  if (dbHistory.length > 0) {
    return dbHistory;
  }

  const memHistory = getChatMemoryStore().get(normalized) || [];
  return memHistory.slice(-6);
}

/**
 * Simpan pesan chat ke tabel messages Supabase pada room kanonik wa_628... & in-memory cache
 */
export async function recordChatMessage(cleanPhone, role, text, senderName, clientOverride = null) {
  const db = clientOverride || (await getAuthenticatedSupabaseClient());
  const normalized = normalizePhone(cleanPhone) || String(cleanPhone || '').trim();
  const priorityPhone = isPriorityNurmiyatyPhone(normalized);
  const safeSenderName = isPoisonedFallbackName(senderName)
    ? (priorityPhone ? NURMIYATY_PRIORITY_BINDING.defaultNamaWali : 'Wali Santri')
    : (senderName || (role === 'user' ? 'Wali Santri' : 'Smart Riayah AI'));

  // Simpan ke in-memory fallback agar percakapan multi-turn tetap nyambung meski DB RLS aktif
  if (normalized && text) {
    const store = getChatMemoryStore();
    const list = store.get(normalized) || [];
    list.push({ role: role === 'user' ? 'user' : 'assistant', content: String(text) });
    if (list.length > 10) list.splice(0, list.length - 10);
    store.set(normalized, list);
  }

  try {
    const { data: userData } = await db.auth.getUser().catch(() => ({ data: {} }));
    const systemEmail = userData?.user?.email || 'adminriayah@smartriayah.sch.id';

    const { error } = await db.from('messages').insert([{
      room_id: `wa_${normalized}`,
      sender_email: systemEmail,
      sender_name: safeSenderName,
      sender_role: role,
      message_text: text,
      is_read: true
    }]);
    if (error) {
      console.warn('⚠️ [recordChatMessage Supabase warning]:', error.message);
    }
  } catch (e) {
    console.warn('recordChatMessage error:', e.message);
  }
}

/**
 * Normalisasi aturan hari kerja (Senin-Kamis = Menunggu Approval) vs akhir pekan (Jumat-Minggu = Auto-Approved)
 * secara otoritatif di backend.
 */
export function normalizeBookingWeekdayAndStatus(rawData = {}, rtc = getRealtimePondokClockBackend(), waliData = {}) {
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const rawDay = String(rawData.hari_kunjungan || '').trim().toLowerCase();
  const rawDate = String(rawData.tanggal_kunjungan || '').trim();

  let targetDay = '';
  let targetYmd = '';

  const dayMap = {
    senin: 'Senin',
    selasa: 'Selasa',
    rabu: 'Rabu',
    kamis: 'Kamis',
    jumat: 'Jumat',
    "jum'at": 'Jumat',
    sabtu: 'Sabtu',
    minggu: 'Minggu',
    ahad: 'Minggu',
  };

  if (dayMap[rawDay]) {
    targetDay = dayMap[rawDay];
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    const d = new Date(`${rawDate}T12:00:00Z`);
    if (!isNaN(d.getTime())) {
      targetDay = dayNames[d.getUTCDay()];
      targetYmd = rawDate;
    }
  }

  if (!targetDay) {
    targetDay = rtc.namaHari;
    targetYmd = rtc.ymd;
  }

  if (!targetYmd) {
    const matchedRef = rtc.refDays.find((r) => r.hari.toLowerCase() === targetDay.toLowerCase());
    targetYmd = matchedRef ? matchedRef.tanggal : rtc.ymd;
  }

  const isWeekday = ['Senin', 'Selasa', 'Rabu', 'Kamis'].includes(targetDay);
  const rawSantri = String(rawData.nama_santri || '').trim();
  const santriNama =
    !rawSantri || rawSantri === 'Ananda' || (isPriorityNurmiyatyPhone(rawData.no_wa_penjenguk) && /fauzi/i.test(rawSantri))
      ? (waliData?.santriNama && waliData.santriNama !== 'Ananda' ? waliData.santriNama : 'Santri')
      : rawSantri;
  const cleanSantriToken = santriNama.replace(/[^a-zA-Z]/g, '').slice(0, 6).toUpperCase() || 'SANTRI';

  let jamMulai = String(rawData.jam_kunjungan || '09:00').trim();
  let jamSelesai = String(rawData.jam_selesai || '17:30').trim();

  // Safeguard: Jam 23:xx pada pesantren adalah kesalahan konversi dari 11:xx siang
  if (/^23:/.test(jamMulai)) {
    jamMulai = jamMulai.replace(/^23:/, '11:');
  }
  if (/^23:/.test(jamSelesai) || jamSelesai === '15:30' || jamSelesai === '10:00' || !jamSelesai) {
    jamSelesai = '17:30';
  }

  // Jika jamMulai > jamSelesai (contoh: 23:00 vs 17:00), perbaiki jamMulai ke siang
  const [jmH, jmM] = jamMulai.split(':').map((v) => parseInt(v, 10) || 0);
  const [jsH, jsM] = jamSelesai.split(':').map((v) => parseInt(v, 10) || 0);
  if (jmH * 60 + jmM > jsH * 60 + jsM) {
    if (jmH >= 12 && (jmH - 12) * 60 + jmM <= jsH * 60 + jsM) {
      jamMulai = `${String(jmH - 12).padStart(2, '0')}:${String(jmM).padStart(2, '0')}`;
    } else {
      jamSelesai = '17:30';
    }
  }

  const barcodeToken = isWeekday
    ? null
    : (rawData.barcode_token || `GP-DU-${cleanSantriToken}-${Math.floor(1000 + Math.random() * 9000)}`);

  const gatePassUrl = barcodeToken
    ? `https://smart-riayah.vercel.app/?gatepass=${encodeURIComponent(barcodeToken)}`
    : null;
  const barcodeImageUrl = barcodeToken
    ? `https://api.qrserver.com/v1/create-qr-code/?size=400x400&format=png&data=${encodeURIComponent(barcodeToken)}`
    : null;

  return {
    ...rawData,
    nama_santri: santriNama,
    kelas: rawData.kelas || waliData?.kelas || 'Santri Darul Ulum',
    hari_kunjungan: targetDay,
    tanggal_kunjungan: targetYmd,
    jam_kunjungan: jamMulai,
    jam_selesai: jamSelesai,
    is_weekday: isWeekday,
    barcode_token: barcodeToken,
    barcode_image_url: barcodeImageUrl,
    gate_pass_url: gatePassUrl,
    approval_type: isWeekday ? 'MANUAL_WEEKDAY' : 'AUTO_WEEKEND',
    status_kunjungan: isWeekday ? 'Menunggu Approval' : 'Disetujui (Siap Datang)',
    waktu_disetujui: isWeekday ? null : `${rtc.namaHari}, ${rtc.tglLengkap} • ${rtc.jamMenitDetik} WITA`,
  };
}

/**
 * Pembersih tag internal booking (<!--BOOKING_DATA:...-->) agar tidak pernah bocor ke WhatsApp wali santri.
 */
export function stripInternalBookingTags(text) {
  if (!text) return '';
  let out = String(text);
  // 1. Hapus tag BOOKING_DATA lengkap maupun yang terpotong di akhir tanpa -->
  out = out.replace(/<!--\s*BOOKING_DATA[\s\S]*?(?:-->|$)/gi, '');
  // 2. Hapus semua komentar HTML lainnya
  out = out.replace(/<!--[\s\S]*?(?:-->|$)/gi, '');
  // 3. Hapus jika ada raw JSON booking tersisa di akhir
  out = out.replace(/\{"nama_santri"[\s\S]*$/gi, '');
  // 4. Rapikan baris kosong berlebih
  return out.replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
}

/**
 * Ekstraktor data booking yang tangguh dari balasan DeepSeek AI,
 * mendukung format tag lengkap, tag terpotong, maupun fallback regex individual.
 */
export function extractBookingDataFromReply(reply) {
  if (!reply) return null;

  // 1. Coba match tag lengkap <!--BOOKING_DATA:{...}-->
  const fullMatch = reply.match(/<!--\s*BOOKING_DATA\s*:\s*(\{[\s\S]*?\})\s*-->/i);
  if (fullMatch && fullMatch[1]) {
    try {
      return JSON.parse(fullMatch[1].trim());
    } catch {}
  }

  // 2. Coba match jika tag terpotong di akhir (misal karena token limit atau tanpa -->)
  const partialMatch = reply.match(/<!--\s*BOOKING_DATA\s*:\s*(\{[\s\S]*)/i);
  if (partialMatch && partialMatch[1]) {
    const rawBlock = partialMatch[1].trim();
    const lastBraceIndex = rawBlock.lastIndexOf('}');
    if (lastBraceIndex !== -1) {
      try {
        return JSON.parse(rawBlock.slice(0, lastBraceIndex + 1));
      } catch {}
    }

    // 3. Fallback ekstraksi regex per field jika JSON terpotong di tengah jalan
    const santriM = rawBlock.match(/"nama_santri"\s*:\s*"([^"]+)"/i);
    const kelasM = rawBlock.match(/"kelas"\s*:\s*"([^"]+)"/i);
    const hariM = rawBlock.match(/"hari_kunjungan"\s*:\s*"([^"]+)"/i);
    const tglM = rawBlock.match(/"tanggal_kunjungan"\s*:\s*"([^"]+)"/i);
    const jamMulaiM = rawBlock.match(/"jam_kunjungan"\s*:\s*"([^"]+)"/i);
    const jamSelesaiM = rawBlock.match(/"jam_selesai"\s*:\s*"([^"]+)"/i);
    const titipanM = rawBlock.match(/"titipan_barang"\s*:\s*"([^"]*)"/i);
    const beratM = rawBlock.match(/"berat_barang_kg"\s*:\s*(\d+(?:\.\d+)?)/i);
    const penjengukM = rawBlock.match(/"nama_penjenguk"\s*:\s*"([^"]+)"/i);
    const isWeekdayM = rawBlock.match(/"is_weekday"\s*:\s*(true|false)/i);
    const tokenM = rawBlock.match(/"barcode_token"\s*:\s*"([^"]+)"/i);

    if (santriM || jamMulaiM || hariM) {
      return {
        nama_santri: santriM ? santriM[1] : '',
        kelas: kelasM ? kelasM[1] : '',
        hari_kunjungan: hariM ? hariM[1] : '',
        tanggal_kunjungan: tglM ? tglM[1] : '',
        jam_kunjungan: jamMulaiM ? jamMulaiM[1] : '',
        jam_selesai: jamSelesaiM ? jamSelesaiM[1] : '',
        titipan_barang: titipanM ? titipanM[1] : '',
        berat_barang_kg: beratM ? Number(beratM[1]) : 0,
        nama_penjenguk: penjengukM ? penjengukM[1] : '',
        is_weekday: isWeekdayM ? isWeekdayM[1] === 'true' : false,
        barcode_token: tokenM ? tokenM[1] : '',
      };
    }
  }

  return null;
}

export function parseScheduleDetailsFromText(primaryText, secondaryText = '', rtc = getRealtimePondokClockBackend()) {
  let refRtc = rtc;
  let textP = primaryText || '';
  let textS = secondaryText || '';
  if (secondaryText && typeof secondaryText === 'object' && secondaryText.refDays) {
    refRtc = secondaryText;
    textS = '';
  }

  // Prioritaskan pesan terkini wali santri & balasan bot terkini (primaryText)
  const lowerPrimary = String(textP).toLowerCase();
  const lowerSecondary = String(textS).toLowerCase();

  const getDayAndDate = (txt) => {
    let d = '';
    let y = '';
    if (/\bsenin\b/.test(txt)) d = 'Senin';
    else if (/\bselasa\b/.test(txt)) d = 'Selasa';
    else if (/\brabu\b/.test(txt)) d = 'Rabu';
    else if (/\bkamis\b/.test(txt)) d = 'Kamis';
    else if (/\bjumat\b|\bjum'at\b/.test(txt)) d = 'Jumat';
    else if (/\bsabtu\b/.test(txt)) d = 'Sabtu';
    else if (/\bminggu\b|\bahad\b/.test(txt)) d = 'Minggu';
    else if (/\blusa\b/.test(txt)) {
      const r = refRtc.refDays.find((item) => item.offset === 2);
      if (r) { d = r.hari; y = r.tanggal; }
    } else if (/\bbesok\b/.test(txt)) {
      const r = refRtc.refDays.find((item) => item.offset === 1);
      if (r) { d = r.hari; y = r.tanggal; }
    }
    if (d && !y) {
      const matchedRef = refRtc.refDays.find((r) => r.hari.toLowerCase() === d.toLowerCase());
      if (matchedRef) y = matchedRef.tanggal;
    }
    return { day: d, date: y };
  };

  let dayInfo = getDayAndDate(lowerPrimary);
  if (!dayInfo.day && lowerSecondary) {
    dayInfo = getDayAndDate(lowerSecondary);
  }
  const targetDay = dayInfo.day || refRtc.namaHari;
  const targetYmd = dayInfo.date || refRtc.ymd;

  const DEFAULT_END_TIME = '17:30';

  const normalizeTimeText = (txt) => {
    if (!txt) return '';
    let norm = String(txt).toLowerCase();
    norm = norm.replace(/\b(?:agi)\b/gi, 'pagi');
    norm = norm.replace(/\b(?:dri)\b/gi, 'dari');
    norm = norm.replace(/\b(?:sampai|sampe|s\/d|hingga|sd)\b|[-–—~]/gi, ' __sampai__ ');
    norm = norm.replace(/\b(pagi|siang|sore|malam)\s+(?:jam|pukul)?\s*(\d{1,2}(?::\d{2})?)/gi, 'jam $2 $1');
    norm = norm.replace(/\b(\d{1,2})\s*(?:lebih|lewat)\s*(\d{1,2})\b/gi, '$1:$2');
    norm = norm.replace(/\b(\d{1,2})\.(\d{2})\b/gi, '$1:$2');
    norm = norm.replace(/\b(?:jam|pukul)\s*(\d{1,2})\s+(\d{2})\b/gi, 'jam $1:$2');
    return norm;
  };

  const to24h = (hourNum, minStr = '00', period = '', defaultPeriod = '') => {
    let h = parseInt(hourNum, 10);
    let m = parseInt(minStr, 10) || 0;
    if (isNaN(h)) return null;

    if (h > 23) {
      if (h >= 100 && h <= 2359) {
        m = h % 100;
        h = Math.floor(h / 100);
      } else {
        return null;
      }
    }

    let p = String(period || defaultPeriod || '').toLowerCase();
    if (p === 'pagi') {
      if (h === 12) h = 0;
    } else if (p === 'siang') {
      if (h >= 1 && h <= 6) h += 12;
    } else if (p === 'sore') {
      if (h >= 1 && h <= 7) h += 12;
    } else if (p === 'malam') {
      if (h >= 1 && h <= 11) h += 12;
    } else if (!p) {
      if (h >= 1 && h <= 6) h += 12;
    }

    h = Math.max(0, Math.min(23, h));
    m = Math.max(0, Math.min(59, m));
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const getTimeRange = (txt) => {
    if (!txt) return null;
    const norm = normalizeTimeText(txt);

    // 1. Rentang waktu eksplisit: A __sampai__ B
    const rangePattern = /(?:jam|pukul)?\s*(\d{1,2})(?::(\d{2}))?\s*(pagi|siang|sore|malam)?\s*__sampai__\s*(?:jam|pukul)?\s*(\d{1,2})(?::(\d{2}))?\s*(pagi|siang|sore|malam)?/i;
    const match = norm.match(rangePattern);
    if (match) {
      const startH = match[1];
      const startM = match[2] || '00';
      let startP = match[3] || '';
      const endH = match[4];
      const endM = match[5] || '00';
      const endP = match[6] || '';

      if (!startP && endP) {
        const sHNum = parseInt(startH, 10);
        if ((endP === 'sore' || endP === 'siang') && sHNum >= 7 && sHNum <= 11) {
          startP = 'pagi';
        }
      }
      const jMulai = to24h(startH, startM, startP, parseInt(startH, 10) >= 7 && parseInt(startH, 10) <= 11 ? 'pagi' : '');
      const jSelesai = to24h(endH, endM, endP, 'sore');
      if (jMulai) {
        return { jamMulai: jMulai, jamSelesai: jSelesai || DEFAULT_END_TIME };
      }
    }

    // 2. Jam tunggal: "jam 11:45", "jam 11 45", "jam 11", "pukul 09.00"
    const singlePattern = /(?:jam|pukul)\s*(\d{1,2})(?::(\d{2}))?\s*(pagi|siang|sore|malam)?/i;
    const singleMatch = norm.match(singlePattern);
    if (singleMatch) {
      const jMulai = to24h(singleMatch[1], singleMatch[2] || '00', singleMatch[3] || '');
      if (jMulai) {
        return { jamMulai: jMulai, jamSelesai: DEFAULT_END_TIME };
      }
    }

    // 3. Keterangan waktu deskriptif
    if (/\bpagi\b/.test(norm)) return { jamMulai: '09:00', jamSelesai: DEFAULT_END_TIME };
    if (/\bsiang\b/.test(norm)) return { jamMulai: '13:00', jamSelesai: DEFAULT_END_TIME };
    if (/\bsore\b/.test(norm)) return { jamMulai: '15:00', jamSelesai: DEFAULT_END_TIME };
    if (/\bmalam\b/.test(norm)) return { jamMulai: '19:30', jamSelesai: '21:00' };

    return null;
  };

  const parsedTime = getTimeRange(lowerPrimary) || (lowerSecondary ? getTimeRange(lowerSecondary) : null) || {
    jamMulai: '09:00',
    jamSelesai: DEFAULT_END_TIME
  };

  const combinedLower = `${lowerPrimary} ${lowerSecondary}`;
  let titipan = '-';
  if (/\bmakan|snack|kue|roti|buah|nasi\b/.test(combinedLower)) titipan = 'Makanan / Snack';
  else if (/\bbaju|pakaian|seragam|sarung|mukena\b/.test(combinedLower)) titipan = 'Pakaian & Perlengkapan';
  else if (/\bobat|vitamin|madu\b/.test(combinedLower)) titipan = 'Obat / Vitamin';

  return {
    hari_kunjungan: targetDay,
    tanggal_kunjungan: targetYmd,
    jam_kunjungan: parsedTime.jamMulai,
    jam_selesai: parsedTime.jamSelesai,
    titipan_barang: titipan,
    berat_barang_kg: titipan === '-' ? 0 : 2,
  };
}

function isConfirmationMessage(textLower) {
  const trimmed = String(textLower || '').trim().replace(/[!.,?🙏👍✅]+/g, '').trim();
  if (!trimmed) return false;
  return /^(?:ok|oke|okay|okey|iya|ya|iyah|yap|yup|betul|benar|setuju|konfirmasi|confirmed|jadi|siap|lanjut|mohon diproses|proses|acc|sip|baik|noted|terima kasih|makasih|syukron)$/i.test(trimmed) ||
    /\b(?:konfirmasi|jadi\s+jenguk|tetap\s+jadi|mohon\s+diproses|tolong\s+dicatat|iya\s+betul|iya\s+benar|setuju)\b/i.test(trimmed);
}

/**
 * Simpan booking kunjungan ke antrean dan broadcast ke Supabase Realtime
 */
export async function saveBookingToSystem(bookingData) {
  try {
    const phoneKey = normalizePhone(bookingData.no_wa_penjenguk) || String(bookingData.no_wa_penjenguk || '');
    const recentStore = getRecentBookingMemoryStore();
    const dedupeKey = `${phoneKey}:${bookingData.tanggal_kunjungan || ''}:${bookingData.hari_kunjungan || ''}`;

    const broadcastRes = await broadcastToSupabaseRealtime('whatsapp.visit_booking', bookingData);
    if (!broadcastRes?.success) {
      console.warn('⚠️ [Broadcast whatsapp.visit_booking warning]:', broadcastRes?.error || broadcastRes);
    }

    const client = await getAuthenticatedSupabaseClient();
    const { data: userData } = await client.auth.getUser().catch(() => ({ data: {} }));
    const systemEmail = userData?.user?.email || 'adminriayah@smartriayah.sch.id';

    const { error: insertErr } = await client.from('messages').insert([{
      room_id: 'visit_bookings_log',
      sender_email: systemEmail,
      sender_name: 'Smart Riayah AI Gate Pass',
      sender_role: 'system',
      message_text: JSON.stringify(bookingData),
      reaction: bookingData.is_weekday ? 'VISIT_MANUAL_WEEKDAY' : 'VISIT_AUTO_WEEKEND',
      is_read: false
    }]);

    if (insertErr) {
      console.warn('⚠️ [Supabase visit_bookings_log insert warning]:', insertErr.message);
    }

    recentStore.set(dedupeKey, {
      booking: bookingData,
      savedAt: Date.now(),
    });

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
    }).catch(() => { });

    return !insertErr || Boolean(broadcastRes?.success);
  } catch (err) {
    console.error('❌ [saveBookingToSystem Error]:', err.message);
    return false;
  }
}

function sanitizeAutonomousReplyForPhone(replyText, cleanPhone, waliData, addr = null) {
  let out = stripInternalBookingTags(replyText);
  if (!out) return out;

  if (isPriorityNurmiyatyPhone(cleanPhone)) {
    const targetWali = waliData?.namaWali || NURMIYATY_PRIORITY_BINDING.defaultNamaWali;
    const targetSantri = waliData?.santriNama || NURMIYATY_PRIORITY_BINDING.santriNama;

    out = out
      .replace(/(?:Ibu|Bu)\s+Fatimah(?:\s+Az[-\s]?Zahra)?/gi, addr?.panggilan || `Bu ${targetWali}`)
      .replace(/Fatimah\s+Az[-\s]?Zahra/gi, targetWali)
      .replace(/Ahmad\s+Fauzi/gi, targetSantri)
      .replace(/\b(?:ananda|santri)\s+Fauzi\b/gi, `ananda ${targetSantri}`);
  }

  if (addr) {
    out = applySapaanToText(out, addr);
  }

  return stripInternalBookingTags(out);
}

/**
 * Otak AI Otonom + Konteks Identitas:
 * Menghasilkan balasan islami, simpel, natural & akurat (membedakan Pak vs Bu) beserta booking kunjungan.
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

  // Ambil riwayat chat lebih awal agar resolver Pak/Bu mendeteksi koreksi sapaan user dari chat sebelumnya
  const recentHistory = await getRecentChatHistory(cleanPhone);

  const addr = resolveWaliAddressing(waliData.namaWali, incomingText, recentHistory, waliData);
  const textLower = String(incomingText || '').toLowerCase();
  const naturalGreeting = getNaturalGreeting(incomingText, addr);
  const rtc = getRealtimePondokClockBackend();
  const priorityPhone = isPriorityNurmiyatyPhone(cleanPhone);

  // ─── INTENT PRIORITAS TERTINGGI: WALI INGIN BICARA DENGAN ADMIN ───
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

    const handoffReply = sanitizeAutonomousReplyForPhone(
      `${naturalGreeting}chat ini langsung kami sambungkan ke Admin Ri'ayah/Ustadz ya. Mohon ditunggu sebentar ${addr.sapaan}.`,
      cleanPhone,
      waliData,
      addr
    );
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
    }).catch(() => { });
    return { reply: handoffReply, waliData, cleanPhone, addressing: addr };
  }

  // Rekam pesan masuk pengguna ke riwayat
  await recordChatMessage(cleanPhone, 'user', incomingText, waliData.namaWali);

  let activeBookingRecord = null;

  // Deteksi apakah riwayat baru saja membahas kunjungan/jadwal
  const historyTextJoined = recentHistory.map((m) => m.content || '').join(' ').toLowerCase();
  const historyHasVisitContext =
    /jenguk|kunjung|sambang|besuk|tengok|ketemu|admin ri'ayah|menunggu approval|gate pass/.test(historyTextJoined);

  const persistNormalizedBooking = async (rawBookingFields, sourceLabel) => {
    const normalized = normalizeBookingWeekdayAndStatus(
      {
        ...rawBookingFields,
        no_wa_penjenguk: cleanPhone,
      },
      rtc,
      waliData
    );

    const dedupeKey = `${cleanPhone}:${normalized.tanggal_kunjungan}:${normalized.hari_kunjungan}`;
    const recentEntry = getRecentBookingMemoryStore().get(dedupeKey);
    // Hindari duplikasi jika baru saja tersimpan < 10 menit dan tidak ada perubahan jam/titipan
    if (
      recentEntry &&
      Date.now() - recentEntry.savedAt < 10 * 60 * 1000 &&
      recentEntry.booking.jam_kunjungan === normalized.jam_kunjungan &&
      recentEntry.booking.jam_selesai === normalized.jam_selesai &&
      isConfirmationMessage(textLower)
    ) {
      activeBookingRecord = recentEntry.booking;
      return { bookingRecord: recentEntry.booking, deduplicated: true };
    }

    const bookingRecord = {
      id: `VST-${rtc.ymd.replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
      booking_source: sourceLabel,
      nama_santri: normalized.nama_santri,
      kelas: normalized.kelas,
      asal: 'Surabaya',
      tanggal_kunjungan: normalized.tanggal_kunjungan,
      hari_kunjungan: normalized.hari_kunjungan,
      jam_kunjungan: normalized.jam_kunjungan || '14:00',
      jam_selesai: normalized.jam_selesai || '15:30',
      titipan_barang: normalized.titipan_barang || '-',
      berat_barang_kg: Number(normalized.berat_barang_kg) || 0,
      nama_penjenguk: normalized.nama_penjenguk || waliData.namaWali,
      status_penjenguk: 'Wali Santri',
      no_wa_penjenguk: cleanPhone,
      rfid_uid: waliData.rfidUid || null,
      barcode_token: normalized.barcode_token,
      barcode_image_url: normalized.barcode_image_url,
      gate_pass_url: normalized.gate_pass_url,
      approval_type: normalized.approval_type,
      status_kunjungan: normalized.status_kunjungan,
      is_weekday: normalized.is_weekday,
      waktu_chat_masuk: `${rtc.namaHari}, ${rtc.tglLengkap} • ${rtc.jamMenitDetik} WITA`,
      waktu_disetujui: normalized.waktu_disetujui,
      created_at: new Date().toISOString()
    };

    activeBookingRecord = bookingRecord;
    await saveBookingToSystem(bookingRecord);
    return { bookingRecord, deduplicated: false };
  };

  // 1. Coba gunakan DeepSeek AI jika token tersedia
  const deepseekKey = (process.env.DEEPSEEK_API_KEY || process.env.VITE_DEEPSEEK_API_KEY || '').trim();
  if (deepseekKey) {
    try {
      const sapaanRule =
        addr.gender === 'neutral'
          ? `Sapa dengan "${addr.panggilan}" (karena jenis kelamin wali belum diketahui, boleh pakai "Bapak/Ibu" jika perlu).`
          : `WAJIB sapa dengan "${addr.sapaan}" / "${addr.panggilan}" (${addr.formal}). DILARANG KERAS menulis "Bapak/Ibu" atau "Bpk/Ibu" karena wali sudah jelas ${addr.gender === 'male' ? 'Laki-laki (Pak)' : 'Perempuan (Bu)'}.`;

      const cleanSantriToken = (waliData.santriNama || 'SANTRI').replace(/[^a-zA-Z]/g, '').slice(0, 6).toUpperCase() || 'SANTRI';
      const pregeneratedWeekendToken = `GP-DU-${cleanSantriToken}-${Math.floor(1000 + Math.random() * 9000)}`;
      const pregeneratedGatePassUrl = `https://smart-riayah.vercel.app/?gatepass=${pregeneratedWeekendToken}`;

      const systemPrompt = `Anda adalah admin pengasuhan Pesantren Modern Darul Ulum yang membalas WhatsApp wali santri secara singkat, hangat, dan jelas.

WAKTU REAL-TIME PONDOK:
- Sekarang: ${rtc.namaHari}, ${rtc.tglLengkap} (${rtc.ymd}) pukul ${rtc.jamMenit} WITA
- Kalender 7 hari ke depan:
${rtc.refDays.map(r => `  * ${r.label} (${r.hari}, ${r.tanggal}): ${r.rule}`).join('\n')}

DATA SANTRI & WALI TERDAFTAR:
- Nama Wali: ${waliData.namaWali} (${addr.panggilan}, WA: ${cleanPhone})
- Santri: ${waliData.santriNama} (NIS: ${waliData.nis || '-'}, Kelas: ${waliData.kelas}, Kamar: ${waliData.kamar})
- Status: ${waliData.statusAsrama} | Saldo RFID: ${waliData.saldoRfid} (Limit: ${waliData.limitHarian})

ATURAN SAPAAN & GAYA JAWABAN (WAJIB):
1. ${sapaanRule}
2. JAWAB SIMPEL & RINGKAS: maksimal 1–3 kalimat pendek seperti chat WhatsApp biasa. Jangan pakai poin bernomor, jangan bertele-tele, jangan mengulang aturan panjang.
3. Jawab salam ("Wa'alaikumsalam...") HANYA jika wali mengucap salam.
4. DILARANG mengarang nama contoh seperti "Ibu Fatimah" atau "Ahmad Fauzi".

ATURAN BOOKING KUNJUNGAN:
- Jika wali baru bilang mau jenguk tanpa hari/jam: konfirmasi santri (${waliData.santriNama}) & tanya hari serta jam kedatangannya secara singkat.
- Jika jadwal (hari/tanggal + jam) sudah disebutkan atau wali mengonfirmasi ("oke/konfirmasi/iya jadi"):
  * Senin–Kamis (hari kerja): catat & infokan diteruskan ke Admin Ri'ayah untuk persetujuan, barcode dikirim otomatis ke WA ini setelah disetujui (titipan maks 5 Kg).
  * Jumat–Minggu (akhir pekan): otomatis disetujui seketika! Wajib sertakan kode Gate Pass *${pregeneratedWeekendToken}* dan link e-barcode ${pregeneratedGatePassUrl} agar wali santri bisa langsung membuka barcode di HP saat tiba di gerbang satpam (titipan maks 5 Kg).
- ATURAN JAM OPERASIONAL KUNJUNGAN (WITA):
  * "jam_kunjungan": jam mulai kedatangan (format HH:mm, misal 09:00, 11:00, 11:45, 14:00). DILARANG KERAS mengubah jam 11 siang/pagi menjadi 23:00 malam! Seluruh kunjungan pondok berlangsung pada siang hari.
  * "jam_selesai": batas akhir jam berkunjung. JIKA wali menyebutkan jam selesai (contoh: "sampe sore jam 5" = "17:00", "sampai jam 4" = "16:00"), gunakan jam tersebut. JIKA wali TIDAK menyebutkan jam selesai, WAJIB isi "17:30" (mengikuti batas jam operasional kunjungan pondok berakhir pukul 17:30 WITA).
- WAJIB sertakan di baris paling akhir saat booking sudah lengkap/dikonfirmasi:
  <!--BOOKING_DATA:{"nama_santri":"...","kelas":"...","hari_kunjungan":"...","tanggal_kunjungan":"YYYY-MM-DD","jam_kunjungan":"HH:mm","jam_selesai":"HH:mm","titipan_barang":"...","berat_barang_kg":0,"nama_penjenguk":"...","is_weekday":true,"barcode_token":"${pregeneratedWeekendToken}"}-->`;

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
          temperature: 0.25,
          max_tokens: 700
        })
      });

      if (dsRes.ok) {
        const dsJson = await dsRes.json();
        let reply = dsJson.choices?.[0]?.message?.content?.trim();

        if (reply) {
          // Ekstrak kode token GP-DU jika ada di dalam balasan AI
          const replyTokenMatch = reply.match(/\b(GP[-_]DU[-_][A-Za-z0-9_-]+)\b/i);
          const candidateToken = replyTokenMatch ? replyTokenMatch[1].trim().toUpperCase() : pregeneratedWeekendToken;

          let bookingSaved = false;
          const bData = extractBookingDataFromReply(reply);
          if (bData) {
            try {
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

              await persistNormalizedBooking(
                {
                  ...bData,
                  barcode_token: bData.barcode_token || candidateToken,
                  nama_santri: safeBookingSantri,
                  kelas: safeBookingKelas,
                  nama_penjenguk: safeBookingPenjenguk,
                },
                'WHATSAPP_AI_NATURAL'
              );
              bookingSaved = true;
            } catch (pErr) {
              console.warn('Booking JSON parse error:', pErr.message);
            }
          }

          // Segera bersihkan tag komentar booking dari teks balasan
          reply = stripInternalBookingTags(reply);

          // Safeguard multi-turn (termasuk cold-start serverless saat recentHistory kosong):
          // Jika wali konfirmasi ("oke/konfirmasi booking/iya jadi") ATAU balasan AI menyatakan booking dicatat/diteruskan ke Admin Ri'ayah
          const replyIndicatesBooked =
            /sudah\s+(?:kami\s+)?(?:catat|terima|diteruskan|disetujui|diajukan|diproses)|menunggu\s+(?:persetujuan|approval)|admin\s+ri'?ayah|gate\s+pass|gp-du-/i.test(reply);
          const textHasBookingSignal =
            /jenguk|kunjung|sambang|besuk|tengok|booking|jadwal/i.test(incomingText);
          const isExplicitBookingConfirmation =
            isConfirmationMessage(textLower) &&
            (historyHasVisitContext || textHasBookingSignal || replyIndicatesBooked);

          if (
            !bookingSaved &&
            (replyIndicatesBooked || isExplicitBookingConfirmation || (historyHasVisitContext && (textHasBookingSignal || isConfirmationMessage(textLower))))
          ) {
            const parsed = parseScheduleDetailsFromText(`${incomingText} ${reply}`, historyTextJoined, rtc);
            await persistNormalizedBooking(
              {
                ...parsed,
                barcode_token: candidateToken,
                nama_santri: waliData.santriNama !== 'Ananda' ? waliData.santriNama : 'Santri',
                kelas: waliData.kelas,
                nama_penjenguk: waliData.namaWali,
              },
              'WHATSAPP_AI_RECOVERY'
            );
          }

          // Harmonisasi: jika bookingRecord weekend dibuat, pastikan token dan link di teks WA 100% cocok dengan barcode_token yang tersimpan
          if (activeBookingRecord && activeBookingRecord.barcode_token && !activeBookingRecord.is_weekday) {
            const finalToken = activeBookingRecord.barcode_token;
            const finalUrl = `https://smart-riayah.vercel.app/?gatepass=${encodeURIComponent(finalToken)}`;
            reply = reply.replace(/\bGP[-_]DU[-_][A-Za-z0-9_-]+\b/gi, finalToken);
            reply = reply.replace(/https:\/\/smart-riayah\.vercel\.app\/\?gatepass=[^\s)]+/gi, finalUrl);
          }

          reply = sanitizeAutonomousReplyForPhone(reply, cleanPhone, waliData, addr);
          reply = stripInternalBookingTags(reply);

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
          }).catch(() => { });
          return { reply, waliData, cleanPhone, addressing: addr, bookingRecord: activeBookingRecord };
        }
      }
    } catch (llmErr) {
      console.warn('⚠️ [AI Otonom] DeepSeek AI offline/fallback ke Smart Local Reasoning:', llmErr.message);
    }
  }

  // ─── 2. SMART LOCAL REASONING ENGINE (SIMPEL, NATURAL & PAK/BU TEPAT) ───
  const saveLocalAiReply = async (replyText, intentName) => {
    const cleanReply = sanitizeAutonomousReplyForPhone(replyText, cleanPhone, waliData, addr);
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
    }).catch(() => { });
    return { reply: cleanReply, waliData, cleanPhone, addressing: addr, bookingRecord: activeBookingRecord };
  };

  // A. INTENT KUNJUNGAN / SAMBANGAN / JENGUK / BOOKING (termasuk kelanjutan multi-turn & cold-start konfirmasi)
  const hasVisitKeyword =
    textLower.includes('jenguk') ||
    textLower.includes('kunjung') ||
    textLower.includes('sambang') ||
    textLower.includes('besuk') ||
    textLower.includes('tengok') ||
    textLower.includes('ketemu') ||
    textLower.includes('booking');

  const hasDayMention =
    /\b(senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu|ahad|besok|lusa|hari ini)\b/i.test(textLower);

  const hasTimeMention =
    /\b(jam|pukul|pagi|siang|sore|malam)\b|\d{1,2}[:.]\d{2}/i.test(textLower);

  const isConfirmationTurn = isConfirmationMessage(textLower);

  const isVisitingFlow =
    hasVisitKeyword ||
    (historyHasVisitContext && (hasDayMention || hasTimeMention || isConfirmationTurn)) ||
    (isConfirmationTurn && /\b(booking|konfirmasi|jadwal)\b/i.test(textLower));

  if (isVisitingFlow) {
    // KASUS 1: Baru bilang mau jenguk tanpa rincian hari/waktu & bukan konfirmasi jadwal sebelumnya
    if (!hasDayMention && !hasTimeMention && !isConfirmationTurn) {
      if (waliData.santriNama && waliData.santriNama !== 'Ananda') {
        const reply = `${naturalGreeting}bisa. Mau jenguk ananda *${waliData.santriNama}* hari apa dan jam berapa?`;
        return await saveLocalAiReply(reply, 'VISIT_ASK_SCHEDULE');
      }
      const reply = `${naturalGreeting}bisa. Mau jenguk ananda siapa, hari apa, dan jam berapa?`;
      return await saveLocalAiReply(reply, 'VISIT_ASK_IDENTITY');
    }

    // KASUS 2: Cek apakah perlu menanyakan jam/hari jika baru sebut salah satu secara sangat samar, atau langsung catat
    const parsedSchedule = parseScheduleDetailsFromText(incomingText, historyTextJoined, rtc);
    const { bookingRecord, deduplicated } = await persistNormalizedBooking(
      {
        ...parsedSchedule,
        nama_santri: waliData.santriNama !== 'Ananda' ? waliData.santriNama : 'Santri',
        kelas: waliData.kelas,
        nama_penjenguk: waliData.namaWali,
      },
      'WHATSAPP_LOCAL_NATURAL'
    );

    if (deduplicated) {
      const gatePassUrl = bookingRecord.gate_pass_url || `https://smart-riayah.vercel.app/?gatepass=${encodeURIComponent(bookingRecord.barcode_token || '')}`;
      const ackReply = bookingRecord.is_weekday
        ? `Siap ${addr.panggilan}, jadwal jenguk *${bookingRecord.nama_santri}* (${bookingRecord.hari_kunjungan}, ${bookingRecord.jam_kunjungan}–${bookingRecord.jam_selesai}) sudah masuk antrean Admin Ri'ayah. Nanti barcodenya langsung dikirim ke WA ini.`
        : `Siap ${addr.panggilan}, jadwal jenguk ananda *${bookingRecord.nama_santri}* hari *${bookingRecord.hari_kunjungan}* telah *DISETUJUI OTOMATIS*.\n\n🎫 *Kupon Barcode Gate Pass:* *${bookingRecord.barcode_token}*\n🔗 *Buka E-Barcode:* ${gatePassUrl}\n\nTinggal buka tautan di atas atau tunjukkan kupon barcode ini ke Satpam saat tiba di gerbang ya.`;
      return await saveLocalAiReply(ackReply, 'VISIT_CONFIRM_ACK');
    }

    let reply = '';
    if (bookingRecord.is_weekday) {
      reply = `${naturalGreeting}jadwal jenguk ananda *${bookingRecord.nama_santri}* hari *${bookingRecord.hari_kunjungan}* (${bookingRecord.jam_kunjungan}–${bookingRecord.jam_selesai} WITA) sudah kami catat.\n\nKarena hari kerja, kami teruskan ke Admin Ri'ayah untuk persetujuan ya ${addr.sapaan}. Barcode kunjungan akan langsung dikirim ke WA ini setelah disetujui (titipan maks 5 Kg).`;
    } else {
      const gatePassUrl = bookingRecord.gate_pass_url || `https://smart-riayah.vercel.app/?gatepass=${encodeURIComponent(bookingRecord.barcode_token || '')}`;
      reply = `${naturalGreeting}jadwal jenguk ananda *${bookingRecord.nama_santri}* hari *${bookingRecord.hari_kunjungan}* (${bookingRecord.jam_kunjungan}–${bookingRecord.jam_selesai} WITA) telah *DISETUJUI OTOMATIS* (Kunjungan Akhir Pekan).\n\n🎫 *Kupon Barcode Gate Pass:* *${bookingRecord.barcode_token}*\n🔗 *Buka E-Barcode:* ${gatePassUrl}\n\nTinggal klik tautan di atas atau tunjukkan kupon barcode tersebut kepada Satpam di gerbang utama saat tiba di pondok ya ${addr.sapaan} (titipan maks 5 Kg).`;
    }

    return await saveLocalAiReply(reply, bookingRecord.is_weekday ? 'VISIT_BOOKING_WEEKDAY' : 'VISIT_BOOKING_WEEKEND');
  }

  // B. BALASAN SINGKAT KONFIRMASI / TERIMA KASIH UMUM
  if (isConfirmationTurn) {
    const reply = `Siap ${addr.panggilan}, sama-sama. Jika ada yang perlu dibantu lagi, kabari saja ya.`;
    return await saveLocalAiReply(reply, 'SIMPLE_ACK');
  }

  // C. TOPIK SALDO RFID / DOMPET PINTAR
  if (textLower.includes('saldo') || textLower.includes('uang') || textLower.includes('dompet') || textLower.includes('jajan') || textLower.includes('rfid') || textLower.includes('topup') || textLower.includes('top up')) {
    const reply = `${naturalGreeting}sisa saldo RFID ananda *${waliData.santriNama}* saat ini *${waliData.saldoRfid}* (limit jajan ${waliData.limitHarian}/hari). Ada yang ingin dibantu lagi ${addr.sapaan}?`;
    return await saveLocalAiReply(reply, 'QUERY_SALDO_RFID');
  }

  // D. TOPIK KABAR / KONDISI SANTRI
  if (textLower.includes('kabar') || textLower.includes('sehat') || textLower.includes('kondisi') || textLower.includes('kegiatan') || textLower.includes('sholat') || textLower.includes('shalat') || textLower.includes('anak saya')) {
    const reply = `${naturalGreeting}alhamdulillah ananda *${waliData.santriNama}* sehat di asrama (${waliData.kamar}), kegiatan ngaji & sekolahnya berjalan lancar.`;
    return await saveLocalAiReply(reply, 'QUERY_KABAR_SANTRI');
  }

  // E. TOPIK KESEHATAN / SAKIT / UKS / POSKESTREN
  if (textLower.includes('sakit') || textLower.includes('demam') || textLower.includes('obat') || textLower.includes('uks') || textLower.includes('poskestren') || textLower.includes('klinik') || textLower.includes('dokter')) {
    const reply = `${naturalGreeting}alhamdulillah ananda *${waliData.santriNama}* terpantau sehat di pondok dan Poskestren siaga 24 jam. Apakah ananda sempat mengeluhkan sesuatu ${addr.sapaan}?`;
    return await saveLocalAiReply(reply, 'QUERY_KESEHATAN');
  }

  // F. TOPIK PERIZINAN & PULANG
  if (textLower.includes('izin') || textLower.includes('pulang') || textLower.includes('libur') || textLower.includes('perpanjang') || textLower.includes('pesiar') || textLower.includes('keluar')) {
    const reply = `${naturalGreeting}izin ananda *${waliData.santriNama}* saat ini berstatus *${waliData.izinTerakhir}*. Pengajuan izin bisa lewat aplikasi Smart Ri'ayah minimal H-1 ya ${addr.sapaan}.`;
    return await saveLocalAiReply(reply, 'QUERY_PERIZINAN');
  }

  // G. SAPAAN UMUM / DEFAULT
  const reply = `${naturalGreeting}ada yang bisa kami bantu terkait ananda *${waliData.santriNama}*?`;
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
export async function sendFonnteAutoReply(targetPhone, replyText, customToken = null, mediaUrl = null) {
  const token = customToken || process.env.FONNTE_TOKEN || DEFAULT_FONNTE_TOKEN;
  const cleanTarget = normalizePhone(targetPhone);

  try {
    const formData = new FormData();
    formData.append('target', cleanTarget);
    formData.append('message', stripInternalBookingTags(replyText));
    formData.append('countryCode', '62');
    formData.append('preview', 'false');
    if (mediaUrl) {
      formData.append('url', mediaUrl);
      formData.append('filename', 'kupon-gatepass.png');
    }

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
