import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { sound } from '../utils/audio';
import { webSerial } from '../utils/webSerial';
import { DEFAULT_DEEPSEEK_TOKEN, testDeepSeekConnection } from '../utils/deepseekApi';
import { getRealtimePondokClock, checkBarcodeLifecycle, calculateVisitCountdown } from '../utils/pondokTimeUtils';
import {
  generateBarcodeToken,
  getGatePassDirectUrl,
  getVisitGatePassUrls,
  getGatePassTokenFromUrl
} from '../utils/barcodeUtils';
import { deleteRoomData, getRoomOccupants, isSantriInRoom } from '../utils/roomService';
import { deleteSantriData } from '../utils/santriService';
import { supabase } from '../utils/supabaseClient';
import { sendWhatsAppBroadcast } from '../utils/whatsappRealtime';
import { normalizePhone, isSamePhone, resolveWaliAddressing } from '../utils/phoneUtils';
import {
  fetchAllDataFromSupabase,
  subscribeToAllTablesRealtime,
  syncSantriToSupabase,
  deleteSantriFromSupabase,
  syncRoomToSupabase,
  deleteRoomFromSupabase,
  syncPermitToSupabase,
  deletePermitFromSupabase,
  syncGateLogToSupabase,
  syncDisciplineToSupabase,
  syncMedicalToSupabase,
  syncRfidTransactionToSupabase,
  syncMutabaahToSupabase,
  dbToSantri,
  dbToRoom,
  dbToPermit,
  dbToGateLog,
  dbToDiscipline,
  dbToMedical,
  dbToRfidTransaction,
  dbToMessage,
  syncMessageToSupabase,
  fetchVisitBookingsFromSupabase,
  syncBookingStatusToSupabase,
  dbToOsisReport,
  fetchOsisReportsFromSupabase,
  createOsisReportInDb,
  updateOsisReportInDb,
  deleteOsisReportFromDb
} from '../utils/supabaseSync';
import {
  INITIAL_SANTRI,
  INITIAL_PERMITS,
  INITIAL_GATE_LOGS,
  INITIAL_DISCIPLINE,
  INITIAL_MUTABAAH,
  INITIAL_MEDICAL_RECORDS,
  INITIAL_ROOMS,
  INITIAL_RFID_TRANSACTIONS,
  INITIAL_WHATSAPP_LOGS,
  INITIAL_ACCOUNTS,
  INITIAL_BLACKLIST,
  INITIAL_VISIT_BOOKINGS,
  INITIAL_VISIT_SETTINGS,
  INITIAL_OSIS_REPORTS
} from '../data/seedData';
import {
  INITIAL_KNOWLEDGE_BASE,
  OFFICIAL_TOPIC_GROUPS,
  buildVisitingHoursAndRulesReply
} from '../data/knowledgeBaseData';
import { insertSantriToSupabase } from '../utils/santriService';

const STANDBY_OLED = {
  mode: 'STANDBY',
  line1: 'PESANTREN DARUL ULUM',
  line2: 'SMART GATE READY',
  line3: 'SILAKAN TAP KARTU RFID SANTRI...',
  line4: 'STATUS: SIAP STANDBY',
  line5: 'RC522 13.56 MHz AKTIF',
  ledHijau: false,
  ledKuning: false,
  ledMerah: false,
  buzzer: false,
  lastCommandSent: null,
  activeSantri: null
};

const VISIT_STATUS_RANK = {
  'Menunggu Approval': 1,
  'Menunggu Approval Admin Ri\'ayah': 1,
  'Disetujui (Auto-Approved Weekend)': 2,
  'Disetujui (Siap Datang)': 2,
  'Disetujui': 2,
  'Sedang Berkunjung': 3,
  'Selesai': 4,
  'Ditolak': 4
};

function getVisitBookingTimestamp(b) {
  if (!b || typeof b !== 'object') return 0;
  return Math.max(
    Date.parse(b.updated_at || 0) || 0,
    Date.parse(b.waktu_disetujui || 0) || 0,
    Date.parse(b.created_at || 0) || 0,
    Date.parse(b.waktu_chat_masuk || 0) || 0
  );
}

/**
 * Menguji apakah dua array objek memiliki isi yang setara secara dangkal (shallow identity),
 * sehingga React dapat mempertahankan referensi lama dan menghindari re-render berantai tak perlu.
 */
function areArraysEqualShallow(arr1, arr2) {
  if (arr1 === arr2) return true;
  if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
  if (arr1.length !== arr2.length) return false;
  for (let i = 0; i < arr1.length; i++) {
    const a = arr1[i];
    const b = arr2[i];
    if (a === b) continue;
    if (!a || !b) return false;
    if (typeof a !== 'object' || typeof b !== 'object') {
      if (a !== b) return false;
      continue;
    }
    if (a.id !== b.id) return false;
    if (a.updated_at !== b.updated_at) return false;
    if (a.status !== b.status) return false;
    if (a.status_kunjungan !== b.status_kunjungan) return false;
    if (a.rfidUid !== b.rfidUid) return false;
    if (a.nama !== b.nama) return false;
    
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (let j = 0; j < keysA.length; j++) {
      const k = keysA[j];
      if (a[k] !== b[k]) return false;
    }
  }
  return true;
}

/**
 * Menggabungkan daftar visitBookings tanpa menimpa booking WA terbaru oleh state /api/sync
 * yang belum lengkap atau masih menggunakan data seed lama.
 * Mengembalikan referensi array yang sama (currentList) jika tidak ada perubahan aktual,
 * sehingga mencegah render loop & flickering di UI admin ri'ayah.
 */
function mergeVisitBookingsLists(currentList = [], incomingList = []) {
  if (!Array.isArray(incomingList) || incomingList.length === 0) {
    const { consolidated } = consolidateDuplicateVisitBookings(Array.isArray(currentList) ? currentList : []);
    return consolidated;
  }
  const currentArray = Array.isArray(currentList) ? currentList : [];
  if (currentArray.length === 0) {
    const { consolidated } = consolidateDuplicateVisitBookings(incomingList);
    return consolidated;
  }

  const mergedMap = new Map();
  let hasRealChanges = false;

  for (const item of currentArray) {
    if (item?.id) mergedMap.set(String(item.id), item);
  }

  for (const candidate of incomingList) {
    if (!candidate?.id) continue;
    const key = String(candidate.id);
    const existing = mergedMap.get(key);
    if (!existing) {
      mergedMap.set(key, candidate);
      hasRealChanges = true;
      continue;
    }

    const existingRank = VISIT_STATUS_RANK[existing.status_kunjungan] || 0;
    const candidateRank = VISIT_STATUS_RANK[candidate.status_kunjungan] || 0;
    const existingTs = getVisitBookingTimestamp(existing);
    const candidateTs = getVisitBookingTimestamp(candidate);

    const useCandidate = candidateRank > existingRank || (candidateRank === existingRank && candidateTs >= existingTs);
    const targetObj = useCandidate
      ? { ...existing, ...candidate, _supabaseMessageId: candidate._supabaseMessageId || existing._supabaseMessageId }
      : { ...candidate, ...existing, _supabaseMessageId: existing._supabaseMessageId || candidate._supabaseMessageId };

    // Verifikasi apakah properti benar-benar berubah dari existing
    let itemChanged = false;
    const keysA = Object.keys(targetObj);
    for (let i = 0; i < keysA.length; i++) {
      const k = keysA[i];
      if (targetObj[k] !== existing[k]) {
        itemChanged = true;
        break;
      }
    }
    if (!itemChanged) {
      const keysB = Object.keys(existing);
      for (let i = 0; i < keysB.length; i++) {
        const k = keysB[i];
        if (targetObj[k] !== existing[k]) {
          itemChanged = true;
          break;
        }
      }
    }

    if (itemChanged) {
      mergedMap.set(key, targetObj);
      hasRealChanges = true;
    }
  }

  const allItems = Array.from(mergedMap.values());
  const { consolidated, hasChanges: wasConsolidated } = consolidateDuplicateVisitBookings(allItems);

  if (!hasRealChanges && !wasConsolidated && mergedMap.size === currentArray.length) {
    return currentList;
  }

  return consolidated;
}

/**
 * Utility: Konsolidasi dan eliminasi data ganda (doubling) booking kunjungan santri.
 * Menggabungkan beberapa data booking yang merujuk pada santri yang sama, wali yang sama,
 * dan tanggal kunjungan yang sama (misal saat proses chat WhatsApp multi-turn).
 */
export function consolidateDuplicateVisitBookings(list = []) {
  if (!Array.isArray(list) || list.length === 0) {
    return { consolidated: [], redundantMessageIds: [], hasChanges: false };
  }

  const isTestBooking = (b) => Boolean(
    b?.is_test ||
    String(b?.id || '').includes('TEST') ||
    String(b?.barcode_token || '').includes('TEST') ||
    /simulasi/i.test(String(b?.titipan_barang || ''))
  );

  const grouped = new Map();
  const redundantMessageIds = [];
  let hasChanges = false;

  for (const item of list) {
    if (!item) continue;
    const isTest = isTestBooking(item);
    const dateKey = String(item.tanggal_kunjungan || '').trim();
    const rawPhone = item.no_wa_penjenguk || item.phone || item.whatsapp_penjenguk || '';
    const phoneClean = normalizePhone(rawPhone) || String(rawPhone).replace(/[^0-9]/g, '');
    const santriClean = String(item.nama_santri || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

    // Kunci unik: jika item test simulasi, beri namespace terpisah agar tidak menimpa data real
    const compositeKey = isTest 
      ? `TEST|${item.id || item.barcode_token}`
      : `${dateKey}|${phoneClean || 'no_phone'}|${santriClean || item.id}`;

    if (!grouped.has(compositeKey)) {
      grouped.set(compositeKey, { ...item });
    } else {
      hasChanges = true;
      const existing = grouped.get(compositeKey);

      const tsExist = getVisitBookingTimestamp(existing);
      const tsNew = getVisitBookingTimestamp(item);

      const isOngoing = (b) => b?.status_kunjungan === 'Sedang Berkunjung' || String(b?.status_kunjungan || '').includes('Sedang Berkunjung');
      const isCompleted = (b) => b?.status_kunjungan === 'Selesai' || String(b?.status_kunjungan || '').includes('Selesai');
      const isApproved = (b) => String(b?.status_kunjungan || '').includes('Disetujui');

      let chooseNew = false;

      // ATURAN 1: Tamu yang sedang berkunjung (Sedang Berkunjung) di area pondok adalah prioritas mutlak
      if (isOngoing(item) && !isOngoing(existing)) {
        chooseNew = true;
      } else if (isOngoing(existing) && !isOngoing(item)) {
        // Hanya ganti jika item baru adalah checkout resmi untuk ID YANG SAMA dan tercatat sesudahnya
        if (existing.id && item.id && existing.id === item.id && isCompleted(item) && tsNew >= tsExist) {
          chooseNew = true;
        } else {
          chooseNew = false;
        }
      } else if (tsNew > tsExist) {
        // Record baru dibuat lebih belakangan:
        // Jika record baru aktif ('Disetujui') dan record lama sudah 'Selesai' di sesi jam sebelumnya:
        // Record baru yang aktif harus menang!
        chooseNew = true;
      } else if (tsNew === tsExist) {
        // Jika timestamp sama, pilih yang jamnya spesifik bukan default generic 09:00-17:30
        const isDefaultHours = (b) => (b.jam_kunjungan === '09:00' && b.jam_selesai === '17:30');
        if (isDefaultHours(existing) && !isDefaultHours(item)) {
          chooseNew = true;
        } else if (isApproved(item) && !isApproved(existing)) {
          chooseNew = true;
        } else if (item.barcode_token && !existing.barcode_token) {
          chooseNew = true;
        }
      }

      // Gabungkan field sehingga field valid (barcode, url) tidak hilang
      const winner = chooseNew ? { ...existing, ...item } : { ...item, ...existing };
      const loser = chooseNew ? existing : item;

      // Bersihkan residual jam keluar jika statusnya aktif
      if (isOngoing(winner) || isApproved(winner)) {
        winner.jam_keluar_aktual = null;
        winner.jam_checkout_aktual = null;
        winner.is_used_completed = false;
        winner.is_barcode_expired = false;
      }

      if (loser._supabaseMessageId && loser._supabaseMessageId !== winner._supabaseMessageId) {
        redundantMessageIds.push(loser._supabaseMessageId);
      }

      grouped.set(compositeKey, winner);
    }
  }

  const consolidated = Array.from(grouped.values()).sort(
    (a, b) => getVisitBookingTimestamp(b) - getVisitBookingTimestamp(a)
  );

  return { consolidated, redundantMessageIds, hasChanges };
}

// Utility: Consolidate duplicate Santri profiles (e.g. lowercase vs capitalized names)
// and re-link all permits, logs, and RFID cards to the unified canonical profile.
export const autoConsolidateSantriAndPermits = (rawSantriList = [], rawPermits = []) => {
  if (!Array.isArray(rawSantriList)) return { santriList: rawSantriList, permits: rawPermits, hasChanges: false };

  const nameMap = new Map();
  const idRedirectionMap = {};
  let hasChanges = false;

  for (const s of rawSantriList) {
    if (!s || !s.nama) continue;
    const normName = s.nama.trim().toLowerCase();

    if (!nameMap.has(normName)) {
      nameMap.set(normName, { ...s });
    } else {
      hasChanges = true;
      const canonical = nameMap.get(normName);
      idRedirectionMap[s.id] = canonical.id;

      // Prefer properly capitalized name
      if (s.nama[0] === s.nama[0].toUpperCase() && canonical.nama[0] === canonical.nama[0].toLowerCase()) {
        canonical.nama = s.nama;
      }
      // Prioritize active physical UID (e.g. '53:57:98:0F') over auto-generated or missing UIDs
      if (s.rfidUid && (!canonical.rfidUid || s.rfidUid === '53:57:98:0F' || (canonical.rfidUid.startsWith('AUTO-') && !s.rfidUid.startsWith('AUTO-')))) {
        canonical.rfidUid = s.rfidUid;
      }
      // Keep active out status if any duplicate had DI_LUAR
      if (s.statusAsrama === 'DI_LUAR' && canonical.statusAsrama === 'DI_ASRAMA') {
        canonical.statusAsrama = s.statusAsrama;
      }
      // Retain the higher balance
      if (s.saldoRfid && s.saldoRfid > canonical.saldoRfid) {
        canonical.saldoRfid = s.saldoRfid;
      }
    }
  }

  const consolidatedSantri = Array.from(nameMap.values());

  // Link permits to canonical santri IDs
  let consolidatedPermits = Array.isArray(rawPermits) ? rawPermits.map(p => {
    if (!p) return p;

    if (idRedirectionMap[p.santriId]) {
      hasChanges = true;
      const newId = idRedirectionMap[p.santriId];
      const targetCanonical = consolidatedSantri.find(s => s.id === newId);
      return {
        ...p,
        santriId: newId,
        santriNama: targetCanonical ? targetCanonical.nama : p.santriNama
      };
    }

    // Match by name if permit was filed under duplicate/different ID
    const currentOwner = consolidatedSantri.find(s => s.id === p.santriId);
    if (!currentOwner && p.santriNama) {
      const matchByName = consolidatedSantri.find(s => s.nama.trim().toLowerCase() === p.santriNama.trim().toLowerCase());
      if (matchByName) {
        hasChanges = true;
        return {
          ...p,
          santriId: matchByName.id,
          santriNama: matchByName.nama
        };
      }
    }

    return p;
  }) : [];

  return {
    santriList: consolidatedSantri,
    permits: consolidatedPermits,
    hasChanges,
    idRedirectionMap
  };
};

// Migrasi & normalisasi record santri (sinkronisasi nomor WA ke 628... dan binding prioritas Nurmiyaty)
function normalizeSantriRecord(s) {
  if (!s || typeof s !== 'object') return s;
  const rawTel = s.wali?.telepon || s.noWali || s.no_wali || s.waliTelepon || '';
  const cleanTel = normalizePhone(rawTel);

  const isNurmiyatyTarget =
    s.id === 'S-107' ||
    String(s.nama || '').trim().toLowerCase() === 'nurmiyaty' ||
    String(s.rfidUid || '').trim().toUpperCase() === '53:57:98:0F' ||
    String(s.nis || '').trim() === '126146';

  const currentWaliName = String(s.wali?.nama || s.namaWali || s.nama_wali || '').trim();
  const isPoisonedOrGenericWali =
    !currentWaliName ||
    /fatimah/i.test(currentWaliName) ||
    /bapak\/ibu wali/i.test(currentWaliName) ||
    /^wali dari /i.test(currentWaliName) ||
    /^wali santri$/i.test(currentWaliName);

  const nextWaliName =
    s.id === 'S-101' && /fatimah/i.test(currentWaliName)
      ? 'Wali Demo Putra'
      : isNurmiyatyTarget && isPoisonedOrGenericWali
        ? 'Arbainah'
        : currentWaliName || `Wali ${s.nama || 'Santri'}`;

  const isPlaceholderTel =
    !cleanTel ||
    cleanTel === '6281234567890' ||
    cleanTel === '6281299887766';

  const nextTel =
    isNurmiyatyTarget && isPlaceholderTel
      ? '628813576012'
      : cleanTel;

  const isOldNurmiyatyNis = !s.nis || String(s.nis).trim() === '46764644';
  const nextNis = isNurmiyatyTarget && isOldNurmiyatyNis ? '126146' : String(s.nis || '');
  const nextKelas =
    isNurmiyatyTarget && (!s.kelas || s.kelas === '11-IPA (Putri)')
      ? '10-B Putri'
      : s.kelas;
  const nextKamar =
    isNurmiyatyTarget && (!s.kamar || s.kamar === 'Aisyah 201')
      ? 'Khadijah 105'
      : s.kamar;
  const nextRfidUid =
    isNurmiyatyTarget && (!s.rfidUid || String(s.rfidUid).startsWith('AUTO-'))
      ? '53:57:98:0F'
      : (s.rfidUid || '');

  return {
    ...s,
    nis: nextNis,
    kelas: nextKelas,
    kamar: nextKamar,
    rfidUid: nextRfidUid,
    namaWali: nextWaliName,
    noWali: nextTel,
    wali: {
      ...(s.wali || {}),
      nama: nextWaliName,
      hubungan: s.wali?.hubungan || 'Orang Tua Kandung',
      telepon: nextTel,
      alamat: s.wali?.alamat || 'Surabaya',
    },
  };
}

function syncChatLogsWithSantriList(rawLogs, currentSantriList = []) {
  if (!Array.isArray(rawLogs)) return [];
  const list = Array.isArray(currentSantriList) ? currentSantriList : [];
  const nurmiyaty = list.find(
    (s) =>
      s &&
      (s.id === 'S-107' ||
        String(s.nama || '').trim().toLowerCase() === 'nurmiyaty' ||
        String(s.rfidUid || '').trim().toUpperCase() === '53:57:98:0F')
  );

  return rawLogs.map((c) => {
    if (!c || typeof c !== 'object') return c;
    const chatPhoneRaw = c.sender_phone || c.phone || '';
    const isPriorityChat =
      c.id === 'chat-1' ||
      isSamePhone(chatPhoneRaw, '628813576012') ||
      (nurmiyaty && nurmiyaty.wali?.telepon && isSamePhone(chatPhoneRaw, nurmiyaty.wali.telepon)) ||
      (c.santri && c.santri.toLowerCase().includes('nurmiyaty'));

    if (!isPriorityChat) {
      // Tetap normalisasi bila nama wali beracun Ibu Fatimah Az-Zahra pada thread non-prioritas
      if (/fatimah/i.test(c.name || '')) {
        return { ...c, name: 'Wali Demo Putra' };
      }
      return c;
    }

    const waliName = nurmiyaty?.wali?.nama || nurmiyaty?.namaWali || (c.name && !/fatimah/i.test(c.name) ? c.name : 'Arbainah');
    const santriName = nurmiyaty?.nama || 'Nurmiyaty';
    const kelasLabel = nurmiyaty?.kelas || '10-B Putri';
    const kamarLabel = nurmiyaty?.kamar || 'Khadijah 105';
    const canonicalPhone = normalizePhone(nurmiyaty?.wali?.telepon || nurmiyaty?.noWali || chatPhoneRaw || '628813576012') || '628813576012';

    const isPoisonedThread =
      /fatimah/i.test(c.name || '') ||
      /ahmad fauzi/i.test(c.santri || '');

    const rawMsgs = Array.isArray(c.messages) ? c.messages : [];
    const cleanedMessages = rawMsgs
      .filter((m) => {
        if (!m || !m.text) return false;
        // Buang pesan simulasi lama Ahmad Fauzi / Fatimah pada thread Nurmiyaty (kecuali m-1 / m-2 yang direwrite bersih)
        if (m.id === 'm-1' || m.id === 'm-2') return true;
        return !/ahmad fauzi|ibu fatimah|bu fatimah/i.test(m.text);
      })
      .map((m) => {
        if (m.id === 'm-1' && /ahmad fauzi|fatimah/i.test(m.text || '')) {
          return {
            ...m,
            text: `Assalamu'alaikum ustadz, bagaimana kabar ananda ${santriName} hari ini?`
          };
        }
        if (m.id === 'm-2' && /ahmad fauzi|fatimah/i.test(m.text || '')) {
          return {
            ...m,
            text: `Wa'alaikumsalam warahmatullah, ${waliName}. Ananda ${santriName} sehat wal'afiat dan tercatat hadir sholat Subuh berjamaah tepat waktu.`
          };
        }
        return m;
      });

    return {
      ...c,
      name: isPoisonedThread || nurmiyaty ? waliName : c.name,
      santri: isPoisonedThread || nurmiyaty ? `${santriName} (${kelasLabel} • ${kamarLabel})` : c.santri,
      sender_phone: canonicalPhone,
      phone: `+${canonicalPhone}`,
      messages: cleanedMessages,
    };
  });
}

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  // 1. Authentication & System Accounts State (8 Roles Terpadu)
  const [accounts, setAccounts] = useState(() => {
    try {
      const saved = localStorage.getItem('sr_accounts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Selalu pastikan seluruh akun sistem (termasuk ACC-08 OSIS) terdaftar
          const existingRoles = new Set(parsed.map(a => a.role));
          const missingAccounts = INITIAL_ACCOUNTS.filter(a => !existingRoles.has(a.role));
          if (missingAccounts.length > 0) {
            const merged = [...parsed, ...missingAccounts];
            try { localStorage.setItem('sr_accounts', JSON.stringify(merged)); } catch (_) {}
            return merged;
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn('⚠️ Gagal membaca sr_accounts dari localStorage:', e);
    }
    return INITIAL_ACCOUNTS;
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('sr_is_authenticated') === 'true';
  });

  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('sr_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Current view: 'landing' | 'login' | 'dashboard'
  const [currentView, setCurrentView] = useState(() => {
    const savedAuth = localStorage.getItem('sr_is_authenticated') === 'true';
    const savedView = localStorage.getItem('sr_current_view');
    if (savedAuth) return 'dashboard';
    return savedView || 'landing';
  });

  const [loginRoleTarget, setLoginRoleTarget] = useState(null);

  // Direct Gate Pass Token Handler (?gatepass=SR-... / /gate-pass/SR-...)
  const [activeGatePassToken, setActiveGatePassToken] = useState(() => {
    return getGatePassTokenFromUrl();
  });

  useEffect(() => {
    const handleUrlChange = () => {
      const token = getGatePassTokenFromUrl();
      if (token) {
        setActiveGatePassToken(token);
      }
    };
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  const openGatePass = (token) => {
    if (!token) return;
    setActiveGatePassToken(token);
    try {
      const newUrl = `${window.location.origin}/?gatepass=${encodeURIComponent(token)}`;
      window.history.pushState({ gatepass: token }, '', newUrl);
    } catch (e) {}
  };

  const clearGatePassToken = () => {
    setActiveGatePassToken(null);
    try {
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    } catch (e) {}
  };

  // 2. Role State: 'superadmin' | 'admin_riayah' | 'parent' | 'musyrif' | 'security' | 'poskestren' | 'kyai'
  const [role, setRole] = useState(() => {
    return localStorage.getItem('sr_active_role') || 'parent';
  });

  const getDefaultTabForRole = (r) => {
    switch(r) {
      case 'superadmin': return 'diagnostics';
      case 'admin_riayah': return 'rooms';
      case 'parent': return 'permit';
      case 'musyrif': return 'active_permits';
      case 'security': return 'gate';
      case 'poskestren': return 'rekam_medis';
      case 'kyai': return 'ringkasan';
      case 'osis': return 'osis_posko';
      default: return 'rooms';
    }
  };

  const [activeRoleTab, setActiveRoleTab] = useState(() => getDefaultTabForRole(role));

  useEffect(() => {
    setActiveRoleTab(getDefaultTabForRole(role));
  }, [role]);

  // 3. Active Santri (For Wali Santri View & Quick Card Selection)
  const [activeSantriId, setActiveSantriId] = useState('S-101');

  // 4. Main Entities backed by LocalStorage (with Auto-Merge & Deduplication)
  const [santriList, setSantriList] = useState(() => {
    try {
      const saved = localStorage.getItem('sr_santri');
      const initial = saved ? JSON.parse(saved) : INITIAL_SANTRI;
      const parsed = Array.isArray(initial) ? initial : INITIAL_SANTRI;
      const existingIds = new Set(parsed.map(s => s.id));
      const missing = INITIAL_SANTRI.filter(s => !existingIds.has(s.id));
      const fullList = (missing.length > 0 ? [...parsed, ...missing] : parsed).map(normalizeSantriRecord);
      const res = autoConsolidateSantriAndPermits(fullList, []);
      return res.santriList.map(normalizeSantriRecord);
    } catch {
      return INITIAL_SANTRI.map(normalizeSantriRecord);
    }
  });

  const [permits, setPermits] = useState(() => {
    try {
      const saved = localStorage.getItem('sr_permits');
      const initial = saved ? JSON.parse(saved) : INITIAL_PERMITS;
      const parsed = Array.isArray(initial) ? initial : INITIAL_PERMITS;
      const existingIds = new Set(parsed.map(p => p.id));
      const missing = INITIAL_PERMITS.filter(p => !existingIds.has(p.id));
      const fullList = missing.length > 0 ? [...parsed, ...missing] : parsed;
      return fullList;
    } catch {
      return INITIAL_PERMITS;
    }
  });

  const [gateLogs, setGateLogs] = useState(() => {
    const saved = localStorage.getItem('sr_gate_logs');
    return saved ? JSON.parse(saved) : INITIAL_GATE_LOGS;
  });

  const [disciplineRecords, setDisciplineRecords] = useState(() => {
    const saved = localStorage.getItem('sr_discipline');
    return saved ? JSON.parse(saved) : INITIAL_DISCIPLINE;
  });

  const [mutabaahList, setMutabaahList] = useState(() => {
    const saved = localStorage.getItem('sr_mutabaah');
    return saved ? JSON.parse(saved) : INITIAL_MUTABAAH;
  });

  const [medicalRecords, setMedicalRecords] = useState(() => {
    const saved = localStorage.getItem('sr_medical');
    return saved ? JSON.parse(saved) : INITIAL_MEDICAL_RECORDS;
  });

  const [rooms, setRooms] = useState(() => {
    const saved = localStorage.getItem('sr_rooms');
    return saved ? JSON.parse(saved) : INITIAL_ROOMS;
  });

  const [rfidTransactions, setRfidTransactions] = useState(() => {
    const saved = localStorage.getItem('sr_rfid_trx');
    return saved ? JSON.parse(saved) : INITIAL_RFID_TRANSACTIONS;
  });

  const [whatsappLogs, setWhatsappLogs] = useState(() => {
    const saved = localStorage.getItem('sr_whatsapp');
    return saved ? JSON.parse(saved) : INITIAL_WHATSAPP_LOGS;
  });

  // ─── 14. MANAJEMEN KUNJUNGAN, TITIPAN BARANG & BOOKING WHATSAPP (QR GATE PASS) ───
  const [visitBookings, setVisitBookings] = useState(() => {
    try {
      const saved = localStorage.getItem('sr_visit_bookings');
      if (saved) {
        const parsed = JSON.parse(saved);
        const { consolidated } = consolidateDuplicateVisitBookings(parsed);
        return consolidated;
      }
      const { consolidated } = consolidateDuplicateVisitBookings(INITIAL_VISIT_BOOKINGS);
      return consolidated;
    } catch {
      return INITIAL_VISIT_BOOKINGS;
    }
  });

  // ─── PENGURUS OSIS: SISTEM PELAPORAN KELAKUAN SANTRI/WATI SE-PONDOK (DB CRUD) ───
  const getDeletedOsisIds = () => {
    try {
      const raw = localStorage.getItem('sr_deleted_osis_ids');
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  };

  const markOsisIdDeleted = (id) => {
    if (!id) return;
    try {
      const set = getDeletedOsisIds();
      set.add(String(id));
      localStorage.setItem('sr_deleted_osis_ids', JSON.stringify(Array.from(set)));
    } catch {}
  };

  const [osisReports, setOsisReports] = useState(() => {
    try {
      const deletedSet = getDeletedOsisIds();
      const saved = localStorage.getItem('sr_osis_reports');
      const base = saved ? JSON.parse(saved) : INITIAL_OSIS_REPORTS;
      return Array.isArray(base) ? base.filter(r => r && !deletedSet.has(String(r.id))) : INITIAL_OSIS_REPORTS;
    } catch {
      return INITIAL_OSIS_REPORTS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('sr_osis_reports', JSON.stringify(osisReports));
    } catch (e) {}
  }, [osisReports]);

  // ─── RIWAYAT CHAT INBOX WHATSAPP & AUTO-DELETE RETENSI 24 JAM (03.00 WITA) ───
  const [chatLogs, setChatLogs] = useState(() => {
    try {
      const saved = localStorage.getItem('sr_chat_logs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return syncChatLogsWithSantriList(parsed, santriList);
        }
      }
    } catch (e) {}

    const now = Date.now();
    const prioritySantri = (Array.isArray(santriList) ? santriList : []).find(
      (s) =>
        s &&
        (s.id === 'S-107' ||
          String(s.nama || '').trim().toLowerCase() === 'nurmiyaty' ||
          String(s.rfidUid || '').trim().toUpperCase() === '53:57:98:0F')
    );
    const priorityWaliName = prioritySantri?.wali?.nama || prioritySantri?.namaWali || 'Arbainah';
    const prioritySantriName = prioritySantri?.nama || 'Nurmiyaty';
    const priorityKelas = prioritySantri?.kelas || '10-B Putri';
    const priorityKamar = prioritySantri?.kamar || 'Khadijah 105';
    const priorityPhone = normalizePhone(prioritySantri?.wali?.telepon || prioritySantri?.noWali || '628813576012') || '628813576012';

    return [
      {
        id: 'chat-1',
        name: priorityWaliName,
        santri: `${prioritySantriName} (${priorityKelas} • ${priorityKamar})`,
        sender_phone: priorityPhone,
        phone: `+${priorityPhone}`,
        channel: 'WhatsApp',
        status: 'Selesai',
        handling_mode: 'OTONOM',
        handling: 'Otonom - Mengikuti Global',
        aiSafety: 'AI Balas - Allow (Score: 98)',
        needs_manual_reply: false,
        created_at: new Date(now - 3600000).toISOString(),
        last_message_at: new Date(now - 1800000).toISOString(),
        lastTime: '11:40 WITA',
        lastPreview: 'Alhamdulillah, terima kasih banyak atas infonya Ustadz.',
        unread: false,
        messages: [
          { id: 'm-1', sender: 'wali', time: '11:38 WITA', text: `Assalamu'alaikum ustadz, bagaimana kabar ananda ${prioritySantriName} hari ini?`, timestamp: new Date(now - 3600000).toISOString() },
          { id: 'm-2', sender: 'ai', time: '11:39 WITA', text: `Wa'alaikumsalam warahmatullah, ${priorityWaliName}. Ananda ${prioritySantriName} sehat wal'afiat dan tercatat hadir sholat Subuh berjamaah tepat waktu.`, timestamp: new Date(now - 3500000).toISOString() },
          { id: 'm-3', sender: 'wali', time: '11:40 WITA', text: 'Alhamdulillah, terima kasih banyak atas infonya Ustadz.', timestamp: new Date(now - 1800000).toISOString() }
        ]
      },
      {
        id: 'chat-2',
        name: 'Bpk. Hendra Gunawan',
        santri: 'Muhammad Rayhan (Kamar Abu Bakar 102)',
        sender_phone: '628124455890',
        phone: '+62 812-4455-890',
        channel: 'WhatsApp',
        status: 'Perlu Ambil Alih',
        handling_mode: 'SEMI_AUTO',
        handling: 'Semi Auto - Menunggu Review',
        aiSafety: 'Perlu Konfirmasi Admin (Score: 68)',
        needs_manual_reply: true,
        created_at: new Date(now - 7200000).toISOString(),
        last_message_at: new Date(now - 900000).toISOString(),
        lastTime: '11:15 WITA',
        lastPreview: 'Saya mau minta izin khusus ananda pulang karena nenek sakit keras, bagaimana suratnya?',
        unread: true,
        messages: [
          { id: 'm-4', sender: 'wali', time: '11:14 WITA', text: "Assalamu'alaikum, ananda Rayhan neneknya sakit keras di RS. Kami mohon izin menjemput sekarang, bagaimana prosedurnya ustadz?", timestamp: new Date(now - 900000).toISOString() }
        ]
      },
      {
        id: 'chat-3',
        name: 'Ibu Siti Khadijah',
        santri: 'Aisyah Putri (Kamar Khadijah 105)',
        sender_phone: '628567890123',
        phone: '+62 856-7890-123',
        channel: 'Telegram Bot',
        status: 'Selesai',
        handling_mode: 'OTONOM',
        handling: 'Otonom - Mengikuti Global',
        aiSafety: 'AI Balas - Allow (Score: 94)',
        needs_manual_reply: false,
        created_at: new Date(now - 14400000).toISOString(),
        last_message_at: new Date(now - 7200000).toISOString(),
        lastTime: '10:50 WITA',
        lastPreview: 'Berapa sisa saldo dompet RFID ananda saat ini?',
        unread: false,
        messages: [
          { id: 'm-5', sender: 'wali', time: '10:49 WITA', text: "Berapa sisa saldo dompet RFID ananda Aisyah Putri?", timestamp: new Date(now - 7200000).toISOString() },
          { id: 'm-6', sender: 'ai', time: '10:50 WITA', text: "Saldo kartu RFID ananda Aisyah Putri saat ini adalah Rp 65.000 dengan limit jajan harian Rp 25.000/hari.", timestamp: new Date(now - 7100000).toISOString() }
        ]
      }
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem('sr_chat_logs', JSON.stringify(chatLogs));
    } catch (e) {
      console.warn('Failed to save chatLogs to localStorage:', e);
    }
  }, [chatLogs]);

  const [lastChatPurgeSummary, setLastChatPurgeSummary] = useState(() => {
    try {
      const saved = localStorage.getItem('sr_last_chat_purge');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Reaktif hitung berapa percakapan aktif yang butuh balasan / intervensi manual admin
  const manualReplyNeededCount = chatLogs.filter(c => c.needs_manual_reply === true).length;

  /**
   * Pembersihan Otomatis Log Chat (Retensi 24 Jam)
   * Hanya menghapus riwayat chat_logs yang usianya melebihi 24 jam.
   * TIDAK PERNAH menghapus visit_bookings (arsip tiket kunjungan & barcode tetap utuh & aman).
   */
  const purgeOldChatLogs = useCallback((isManualTrigger = false) => {
    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    setChatLogs(prev => {
      const retained = [];
      prev.forEach(chat => {
        const msgTime = new Date(chat.last_message_at || chat.created_at || now).getTime();
        const ageMs = now - msgTime;
        if (ageMs >= TWENTY_FOUR_HOURS) {
          deletedCount++;
        } else {
          retained.push(chat);
        }
      });

      // Jika tombol tes demo diklik dan tidak ada chat >24 jam, hapus chat pertama yang sudah selesai agar admin bisa melihat efek nyata
      if (isManualTrigger && deletedCount === 0 && retained.length > 2) {
        const doneIdx = retained.findIndex(c => !c.needs_manual_reply && c.status === 'Selesai');
        if (doneIdx !== -1) {
          retained.splice(doneIdx, 1);
          deletedCount = 1;
        }
      }

      try {
        localStorage.setItem('sr_chat_logs', JSON.stringify(retained));
      } catch (e) {}
      return retained;
    });

    const clock = getRealtimePondokClock();
    const summary = {
      lastPurgeTime: `${clock.tanggal_lengkap} • ${clock.jam_menit_detik} WITA`,
      deletedCount,
      isManual: isManualTrigger,
      status: 'Pembersihan 03.00 WITA Selesai'
    };

    setLastChatPurgeSummary(summary);
    try {
      localStorage.setItem('sr_last_chat_purge', JSON.stringify(summary));
    } catch (e) {}

    return summary;
  }, []);

  // Scheduler Pemantauan Jam 03:00:00 WITA (Asia/Makassar / UTC+8)
  useEffect(() => {
    const checkSchedule = () => {
      const clock = getRealtimePondokClock();
      if (clock.jam_menit === '03:00') {
        const lastPurgeDate = localStorage.getItem('sr_last_purge_date');
        if (lastPurgeDate !== clock.tanggal_ymd) {
          console.log('🧹 [SCHEDULER 03:00 WITA] Menjalankan pembersihan otomatis chat_logs >24 jam...');
          purgeOldChatLogs(false);
          localStorage.setItem('sr_last_purge_date', clock.tanggal_ymd);
        }
      }
    };

    const intervalId = setInterval(checkSchedule, 25000);
    return () => clearInterval(intervalId);
  }, [purgeOldChatLogs]);

  const sendManualReplyToChat = (chatId, replyText, shouldSendWa = true) => {
    if (!replyText || !replyText.trim()) return;
    const clock = getRealtimePondokClock();
    const timeStr = `${clock.jam_menit} WITA`;

    let targetChat = null;
    setChatLogs(prev => {
      const next = prev.map(chat => {
        if (chat.id === chatId) {
          const newMsg = {
            id: `msg-${Date.now()}`,
            sender: 'admin',
            text: replyText.trim(),
            time: timeStr,
            timestamp: new Date().toISOString()
          };
          targetChat = {
            ...chat,
            messages: [...(chat.messages || []), newMsg],
            lastTime: timeStr,
            lastPreview: replyText.trim(),
            last_message_at: new Date().toISOString(),
            status: 'Ditangani Admin',
            handling_mode: 'MANUAL',
            needs_manual_reply: false // Mengurangi manualReplyNeededCount secara real-time!
          };
          return targetChat;
        }
        return chat;
      });
      try {
        localStorage.setItem('sr_chat_logs', JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    if (shouldSendWa && targetChat && (targetChat.phone || targetChat.sender_phone)) {
      const cleanText = replyText.trim();
      const adminMessage = cleanText.includes('diambil alih')
        ? cleanText
        : `${cleanText}\n\n_(Sedang diambil alih Admin)_`;

      sendWhatsAppNotification(
        targetChat.name,
        targetChat.sender_phone || targetChat.phone,
        'ADMIN_MANUAL_REPLY',
        adminMessage
      );
    }

    sound.playSuccess?.();
    return targetChat;
  };

  const takeOverChatManual = (chatId) => {
    setChatLogs(prev => {
      const next = prev.map(c => {
        if (c.id === chatId) {
          return {
            ...c,
            handling_mode: 'MANUAL',
            status: 'Perlu Ambil Alih',
            needs_manual_reply: true
          };
        }
        return c;
      });
      try {
        localStorage.setItem('sr_chat_logs', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
    sound.playBeep?.();
  };

  const resolveChatManual = (chatId) => {
    setChatLogs(prev => {
      const next = prev.map(c => {
        if (c.id === chatId) {
          return {
            ...c,
            status: 'Selesai',
            needs_manual_reply: false
          };
        }
        return c;
      });
      try {
        localStorage.setItem('sr_chat_logs', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
    sound.playSuccess?.();
  };


  // Real-Time WhatsApp Gateway Configuration (Fonnte API)
  const defaultFonnteToken = (import.meta.env.VITE_FONNTE_TOKEN || '').trim();
  const [fonnteToken, setFonnteTokenState] = useState(() => {
    const saved = localStorage.getItem('sr_fonnte_token');
    if (!saved || saved === 'XvFjdLyyvBgNUbXBZYzZ') {
      if (defaultFonnteToken) localStorage.setItem('sr_fonnte_token', defaultFonnteToken);
      return defaultFonnteToken;
    }
    return saved;
  });
  const [fonnteTargetNumber, setFonnteTargetNumberState] = useState(() => {
    const saved = localStorage.getItem('sr_fonnte_target');
    if (!saved || saved === '08813576012') {
      localStorage.setItem('sr_fonnte_target', '6285960213654');
      return '6285960213654';
    }
    return normalizePhone(saved) || saved;
  });
  const [isFonnteEnabled, setIsFonnteEnabledState] = useState(() => {
    const saved = localStorage.getItem('sr_fonnte_enabled');
    return saved !== null ? saved === 'true' : true;
  });
  const [lastFonnteLatency, setLastFonnteLatency] = useState(null);
  const [isSendingFonnte, setIsSendingFonnte] = useState(false);
  const [fonnteStatus, setFonnteStatus] = useState(null);

  const setFonnteToken = (val) => {
    setFonnteTokenState(val);
    localStorage.setItem('sr_fonnte_token', val);
  };
  const setFonnteTargetNumber = (val) => {
    const clean = normalizePhone(val) || val;
    setFonnteTargetNumberState(clean);
    localStorage.setItem('sr_fonnte_target', clean);
  };
  const setIsFonnteEnabled = (val) => {
    setIsFonnteEnabledState(val);
    localStorage.setItem('sr_fonnte_enabled', String(val));
  };

  // DeepSeek AI Character & Analytics Configuration
  const [deepseekToken, setDeepseekTokenState] = useState(() => {
    return localStorage.getItem('sr_deepseek_token') || DEFAULT_DEEPSEEK_TOKEN;
  });
  const [deepseekModel, setDeepseekModelState] = useState(() => {
    return localStorage.getItem('sr_deepseek_model') || 'deepseek-chat';
  });

  const setDeepseekToken = (val) => {
    setDeepseekTokenState(val);
    localStorage.setItem('sr_deepseek_token', val);
  };
  const setDeepseekModel = (val) => {
    setDeepseekModelState(val);
    localStorage.setItem('sr_deepseek_model', val);
  };

  // Blacklisted / Revoked Lost Cards
  const [blacklistedUids, setBlacklistedUids] = useState(() => {
    const saved = localStorage.getItem('sr_blacklisted_uids');
    return saved ? JSON.parse(saved) : INITIAL_BLACKLIST;
  });

  // Hardware Scan Active Listener (for Onboarding & Lost Card Replacement form capture)
  const hardwareScanListenerRef = useRef(null);
  const setHardwareScanCallback = useCallback((callbackFn) => {
    hardwareScanListenerRef.current = callbackFn;
  }, []);

  // 5. UI Modals, Drawers & Sidebar
  const [isWaDrawerOpen, _setIsWaDrawerOpen] = useState(false);
  const [engageActiveTab, setEngageActiveTab] = useState('dashboard');

  const navigateToAiInbox = () => {
    if (role !== 'admin_riayah') {
      setRole('admin_riayah');
    }
    setActiveRoleTab('whatsapp_manager');
    setEngageActiveTab('inbox');
    _setIsWaDrawerOpen(false);
    setUnreadWaCount(0);
    sound.playBeep?.();
  };

  const setIsWaDrawerOpen = (open) => {
    if (open) {
      // Langsung alihkan ke AI Inbox tanpa memunculkan floating drawer popup
      navigateToAiInbox();
    } else {
      _setIsWaDrawerOpen(false);
    }
  };
  const [unreadWaCount, setUnreadWaCount] = useState(0);
  const [isRfidModalOpen, setIsRfidModalOpen] = useState(false);
  const [isSerialMonitorOpen, setIsSerialMonitorOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isAiAgentOpen, setIsAiAgentOpen] = useState(false);
  const [aiAgentActiveSantriId, setAiAgentActiveSantriId] = useState('S-101');
  const openAiAgentForSantri = (santriId) => {
    if (santriId) setAiAgentActiveSantriId(santriId);
    setIsAiAgentOpen(true);
    sound.playChime?.();
  };
  const [isRfidManagerModalOpen, _setIsRfidManagerModalOpen] = useState(false);
  const setIsRfidManagerModalOpen = (open) => {
    if (open) {
      if (role !== 'admin_riayah' && role !== 'superadmin') {
        setRole('admin_riayah');
      }
      setActiveRoleTab('rfid_cards');
      _setIsRfidManagerModalOpen(false);
    } else {
      _setIsRfidManagerModalOpen(false);
    }
  };

  // 5b. Universal Early-Warning & Alarm Reminder System Settings (Minimal 15 Menit & Universal untuk Kunjungan & Santri)
  const [reminderThresholdMinutes, setReminderThresholdMinutesState] = useState(() => {
    const saved = localStorage.getItem('sr_reminder_threshold');
    return saved ? Math.max(15, Number(saved) || 15) : 15; // Default & Minimal H-15 Menit
  });

  const setReminderThresholdMinutes = useCallback((val) => {
    setReminderThresholdMinutesState(prev => {
      const resolved = typeof val === 'function' ? val(prev) : val;
      return Math.max(15, Number(resolved) || 15);
    });
  }, []);

  const [isAutoSendWaReminder, setIsAutoSendWaReminder] = useState(() => {
    const saved = localStorage.getItem('sr_auto_send_wa_reminder');
    return saved !== null ? saved === 'true' : true; // Default auto-send ON
  });

  const [isAlarmSoundEnabled, setIsAlarmSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('sr_alarm_sound_enabled');
    return saved !== null ? saved === 'true' : true; // Default alarm sound ON
  });

  useEffect(() => {
    localStorage.setItem('sr_reminder_threshold', String(reminderThresholdMinutes));
  }, [reminderThresholdMinutes]);

  useEffect(() => {
    localStorage.setItem('sr_auto_send_wa_reminder', String(isAutoSendWaReminder));
  }, [isAutoSendWaReminder]);

  useEffect(() => {
    localStorage.setItem('sr_alarm_sound_enabled', String(isAlarmSoundEnabled));
  }, [isAlarmSoundEnabled]);

  // 6. RFID Card Management, Web Serial & Virtual OLED SSD1306 Actuators
  const [lastScannedUid, setLastScannedUid] = useState(() => {
    return localStorage.getItem('sr_last_uid') || '04:E5:6F:04';
  });
  const [lastScannedTime, setLastScannedTime] = useState(null);
  const [isSerialConnected, setIsSerialConnected] = useState(false);
  const [serialRawLogs, setSerialRawLogs] = useState([]);
  const [highlightedSantriId, setHighlightedSantriId] = useState(null);
  const [oledState, setOledState] = useState(STANDBY_OLED);

  // 6b. RFID Module Hardware & Scanning Switch (ON/OFF)
  const [isRfidModuleEnabled, setIsRfidModuleEnabledState] = useState(() => {
    const saved = localStorage.getItem('sr_rfid_module_enabled');
    return saved !== null ? saved === 'true' : true; // Default ON
  });
  const isRfidModuleEnabledRef = useRef(isRfidModuleEnabled);
  useEffect(() => {
    isRfidModuleEnabledRef.current = isRfidModuleEnabled;
  }, [isRfidModuleEnabled]);

  const setIsRfidModuleEnabled = (val) => {
    setIsRfidModuleEnabledState(prev => {
      const nextVal = typeof val === 'function' ? val(prev) : val;
      localStorage.setItem('sr_rfid_module_enabled', String(nextVal));
      isRfidModuleEnabledRef.current = nextVal;
      if (!nextVal) {
        sound.playBeep();
        setOledState({
          mode: 'STANDBY',
          line1: 'SMART RIAYAH GATE',
          line2: 'MODUL RFID: NONAKTIF',
          line3: 'SCANNER RC522: OFF',
          line4: 'KONTROL ADMIN AKTIF',
          accentColor: '#EF4444'
        });
      } else {
        sound.playSuccess();
        setOledState({
          mode: 'STANDBY',
          line1: 'SMART RIAYAH GATE',
          line2: 'MODUL RFID: AKTIF',
          line3: 'SILAKAN TAP KARTU',
          line4: 'RC522 STANDBY (ON)',
          accentColor: '#10B981'
        });
      }
      return nextVal;
    });
  };

  // 7. IoT Turnstile Gate Interactive State
  const [gateState, setGateState] = useState({
    status: 'IDLE', // 'IDLE' | 'SCANNING' | 'GRANTED' | 'DENIED'
    gateAngle: 0, // 0 closed, -75 open
    displayBadge: null, // text
    message: 'GATE 01 - STANDBY READY (TAP KARTU RFID 13.56 MHz)',
    activeSantri: null,
    snapshotUrl: null,
    alarmStrobe: false
  });

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('sr_active_role', role);
  }, [role]);

  useEffect(() => {
    localStorage.setItem('sr_accounts', JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    localStorage.setItem('sr_is_authenticated', String(isAuthenticated));
  }, [isAuthenticated]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('sr_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('sr_current_user');
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('sr_current_view', currentView);
  }, [currentView]);

  useEffect(() => {
    localStorage.setItem('sr_rooms', JSON.stringify(rooms));
  }, [rooms]);

  useEffect(() => {
    localStorage.setItem('sr_blacklisted_uids', JSON.stringify(blacklistedUids));
  }, [blacklistedUids]);

  useEffect(() => {
    localStorage.setItem('sr_santri', JSON.stringify(santriList));
  }, [santriList]);

  useEffect(() => {
    localStorage.setItem('sr_permits', JSON.stringify(permits));
  }, [permits]);

  useEffect(() => {
    localStorage.setItem('sr_gate_logs', JSON.stringify(gateLogs));
  }, [gateLogs]);

  useEffect(() => {
    localStorage.setItem('sr_discipline', JSON.stringify(disciplineRecords));
  }, [disciplineRecords]);

  useEffect(() => {
    localStorage.setItem('sr_medical', JSON.stringify(medicalRecords));
  }, [medicalRecords]);

  useEffect(() => {
    localStorage.setItem('sr_rfid_trx', JSON.stringify(rfidTransactions));
  }, [rfidTransactions]);

  useEffect(() => {
    localStorage.setItem('sr_whatsapp', JSON.stringify(whatsappLogs));
  }, [whatsappLogs]);

  useEffect(() => {
    if (lastScannedUid) {
      localStorage.setItem('sr_last_uid', lastScannedUid);
    }
  }, [lastScannedUid]);

  // On-mount: Auto-heal & synchronize duplicate santri profiles and unlinked permits
  useEffect(() => {
    const res = autoConsolidateSantriAndPermits(santriList, permits);
    if (res.hasChanges) {
      setSantriList(res.santriList);
      setPermits(res.permits);
      localStorage.setItem('sr_santri', JSON.stringify(res.santriList));
      localStorage.setItem('sr_permits', JSON.stringify(res.permits));
    }

    // Auto-heal & synchronize duplicate visit bookings and clean redundant Supabase messages
    setVisitBookings(prev => {
      const { consolidated, redundantMessageIds, hasChanges } = consolidateDuplicateVisitBookings(prev);
      if (hasChanges) {
        try {
          localStorage.setItem('sr_visit_bookings', JSON.stringify(consolidated));
        } catch (e) {}
        if (redundantMessageIds.length > 0) {
          supabase
            .from('messages')
            .delete()
            .in('id', redundantMessageIds)
            .catch(() => {});
        }
        return consolidated;
      }
      return prev;
    });
  }, []);

  // =========================================================================
  // 6. Cross-Tab & Cross-Browser Real-Time Sync Engine
  // =========================================================================
  const isApplyingRemoteSync = useRef(false);
  const syncVersionRef = useRef(0);
  const isServerSyncSupportedRef = useRef(true);
  const lastSyncedFingerprintRef = useRef('');

  // Apply synced data payload to state
  const applySyncedData = useCallback((payload) => {
    if (!payload) return;
    isApplyingRemoteSync.current = true;
    try {
      let incomingSantri = Array.isArray(payload.santriList)
        ? payload.santriList.map(normalizeSantriRecord)
        : payload.santriList;
      let incomingPermits = payload.permits;
      if (Array.isArray(incomingSantri) && Array.isArray(incomingPermits)) {
        const consolidated = autoConsolidateSantriAndPermits(incomingSantri, incomingPermits);
        incomingSantri = consolidated.santriList.map(normalizeSantriRecord);
        incomingPermits = consolidated.permits;
      }
      if (Array.isArray(incomingSantri)) {
        setSantriList(prev => areArraysEqualShallow(prev, incomingSantri) ? prev : incomingSantri);
      }
      if (Array.isArray(incomingPermits)) {
        setPermits(prev => areArraysEqualShallow(prev, incomingPermits) ? prev : incomingPermits);
      }
      if (Array.isArray(payload.gateLogs)) {
        setGateLogs(prev => areArraysEqualShallow(prev, payload.gateLogs) ? prev : payload.gateLogs);
      }
      if (Array.isArray(payload.disciplineRecords)) {
        setDisciplineRecords(prev => areArraysEqualShallow(prev, payload.disciplineRecords) ? prev : payload.disciplineRecords);
      }
      if (Array.isArray(payload.mutabaahList)) {
        setMutabaahList(prev => areArraysEqualShallow(prev, payload.mutabaahList) ? prev : payload.mutabaahList);
      }
      if (Array.isArray(payload.medicalRecords)) {
        setMedicalRecords(prev => areArraysEqualShallow(prev, payload.medicalRecords) ? prev : payload.medicalRecords);
      }
      if (Array.isArray(payload.rooms)) {
        setRooms(prev => areArraysEqualShallow(prev, payload.rooms) ? prev : payload.rooms);
      }
      if (Array.isArray(payload.rfidTransactions)) {
        setRfidTransactions(prev => areArraysEqualShallow(prev, payload.rfidTransactions) ? prev : payload.rfidTransactions);
      }
      if (Array.isArray(payload.whatsappLogs)) {
        setWhatsappLogs(prev => areArraysEqualShallow(prev, payload.whatsappLogs) ? prev : payload.whatsappLogs);
      }
      if (Array.isArray(payload.blacklistedUids)) {
        setBlacklistedUids(prev => areArraysEqualShallow(prev, payload.blacklistedUids) ? prev : payload.blacklistedUids);
      }
      if (Array.isArray(payload.osisReports)) {
        const deletedSet = getDeletedOsisIds();
        const incomingOsis = payload.osisReports.filter(r => r && !deletedSet.has(String(r.id)));
        setOsisReports(prev => areArraysEqualShallow(prev, incomingOsis) ? prev : incomingOsis);
      }
      if (Array.isArray(payload.visitBookings)) {
        setVisitBookings(prev => {
          const merged = mergeVisitBookingsLists(prev, payload.visitBookings);
          if (merged === prev) return prev;
          try {
            localStorage.setItem('sr_visit_bookings', JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }
      if (payload.reminderThresholdMinutes) {
        setReminderThresholdMinutes(prev => prev === payload.reminderThresholdMinutes ? prev : payload.reminderThresholdMinutes);
      }
      if (payload.version) syncVersionRef.current = payload.version;

      // Catat fingerprint state agar debounced push tidak memantulkan data kembali ke server
      lastSyncedFingerprintRef.current = JSON.stringify({
        s: incomingSantri?.length,
        p: incomingPermits?.length,
        pl: incomingPermits?.[0]?.id,
        ps: incomingPermits?.[0]?.status,
        r: payload.rooms?.length,
        b: payload.blacklistedUids?.length,
        v: payload.visitBookings?.length,
        vl: payload.visitBookings?.[0]?.id,
        vs: payload.visitBookings?.[0]?.status_kunjungan,
        o: payload.osisReports?.length,
        ol: payload.osisReports?.[0]?.id,
        os: payload.osisReports?.[0]?.status,
        g: payload.gateLogs?.length,
        gl: payload.gateLogs?.[0]?.id
      });
    } finally {
      setTimeout(() => {
        isApplyingRemoteSync.current = false;
      }, 1000);
    }
  }, []);

  // Instant Cross-Tab sync via BroadcastChannel
  useEffect(() => {
    let channel;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        channel = new BroadcastChannel('smart_riayah_sync_channel');
        channel.onmessage = (event) => {
          if (event.data && event.data.type === 'STATE_UPDATE' && event.data.payload) {
            if (event.data.version > syncVersionRef.current) {
              syncVersionRef.current = event.data.version;
              applySyncedData(event.data.payload);
            }
          }
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel sync init:', e);
    }

    return () => {
      if (channel) channel.close();
    };
  }, [applySyncedData]);

  // --------------------------------------------------------------------------
  // SUPABASE REALTIME & INITIAL DATA SYNC (Semua Kategori Database)
  // --------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    const applySupabaseSnapshot = (remoteData) => {
      if (!isMounted || !remoteData) return;
      if (remoteData.santriList?.length) {
        const normalizedRemoteSantri = remoteData.santriList.map(normalizeSantriRecord);
        setSantriList(normalizedRemoteSantri);
        setChatLogs(prev => syncChatLogsWithSantriList(prev, normalizedRemoteSantri));
      }
      if (remoteData.rooms?.length) {
        setRooms(remoteData.rooms);
        try {
          localStorage.setItem('sr_rooms', JSON.stringify(remoteData.rooms));
        } catch {}
      }
      if (remoteData.permits?.length) setPermits(remoteData.permits);
      if (remoteData.gateLogs?.length) setGateLogs(remoteData.gateLogs);
      if (remoteData.disciplineRecords?.length) setDisciplineRecords(remoteData.disciplineRecords);
      if (remoteData.medicalRecords?.length) setMedicalRecords(remoteData.medicalRecords);
      if (remoteData.rfidTransactions?.length) setRfidTransactions(remoteData.rfidTransactions);
      if (remoteData.mutabaahList?.length) setMutabaahList(remoteData.mutabaahList);
      if (remoteData.visitBookings?.length) {
        setVisitBookings(prev => {
          const merged = mergeVisitBookingsLists(prev, remoteData.visitBookings);
          try {
            localStorage.setItem('sr_visit_bookings', JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }
      if (remoteData.osisReports?.length) {
        const deletedSet = getDeletedOsisIds();
        setOsisReports(prev => {
          const mergedMap = new Map();
          (prev || []).forEach(r => {
            if (r?.id && !deletedSet.has(String(r.id))) mergedMap.set(r.id, r);
          });
          remoteData.osisReports.forEach(r => {
            if (!r?.id || deletedSet.has(String(r.id))) return;
            const existing = mergedMap.get(r.id);
            const existingTs = new Date(existing?.updated_at || existing?.created_at || 0).getTime();
            const remoteTs = new Date(r.updated_at || r.created_at || 0).getTime();
            if (!existing || remoteTs >= existingTs) {
              mergedMap.set(r.id, { ...existing, ...r });
            }
          });
          const merged = Array.from(mergedMap.values()).sort(
            (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
          );
          try {
            localStorage.setItem('sr_osis_reports', JSON.stringify(merged));
          } catch (e) {}
          return merged;
        });
      }
      if (remoteData.messages?.length) {
        const formatted = remoteData.messages.map(msg => ({
          id: msg.id,
          penerima: msg.receiverRole || 'Pesantren Darul Ulum',
          nomor: msg.senderEmail || 'Mobile App',
          tipe: 'LIVE_CHAT',
          pesan: `${msg.senderName} (${msg.senderRole}): ${msg.messageText}`,
          status: msg.isRead ? 'DELIVERED' : 'SENT',
          waktu: new Date(msg.createdAt).toLocaleTimeString('id-ID'),
          reaction: msg.reaction
        }));
        setWhatsappLogs(prev => {
          const existingIds = new Set(formatted.map(f => f.id));
          return [...formatted, ...prev.filter(p => !existingIds.has(p.id))];
        });
      }
    };

    const loadSupabaseSnapshot = () => {
      fetchAllDataFromSupabase()
        .then(applySupabaseSnapshot)
        .catch((err) => {
          console.warn('⚠️ Gagal fetch data awal Supabase (fallback ke cache):', err);
        });
    };

    // 1. Ambil data awal dari Supabase jika tersedia
    loadSupabaseSnapshot();

    // Validasi sesi Supabase Auth agar token JWT & RLS selalu sinkron
    supabase.auth.getSession()
      .then(({ data }) => {
        if (!isMounted) return;
        if (data?.session) {
          // Token terautentikasi siap, ambil data lengkap dari Supabase
          loadSupabaseSnapshot();
        } else if (localStorage.getItem('sr_is_authenticated') === 'true') {
          console.warn('⚠️ [Auth] Sesi Supabase Auth belum aktif/kedaluwarsa; mengarahkan ke halaman login agar sinkronisasi RLS berjalan normal.');
          setIsAuthenticated(false);
          setCurrentUser(null);
          setCurrentView('login');
          try {
            localStorage.removeItem('sr_is_authenticated');
            localStorage.removeItem('sr_current_user');
            localStorage.removeItem('sr_current_view');
          } catch {}
        }
      })
      .catch(() => {});

    // Sinkronkan ulang ketika sesi autentikasi Supabase login / refresh / logout
    let authSubscription = null;
    try {
      const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        if (!isMounted) return;
        if ((event === 'INITIAL_SESSION' && session) || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          loadSupabaseSnapshot();
        } else if (event === 'SIGNED_OUT') {
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      });
      authSubscription = authListener?.subscription || null;
    } catch (e) {
      console.warn('Supabase auth listener init warning:', e);
    }

    // Ambil data kamar dari backend lokal (PostgreSQL / pgAdmin) jika server aktif
    fetch('/api/rooms')
      .then(res => res.json())
      .then(resData => {
        if (!isMounted) return;
        if (resData?.success && Array.isArray(resData?.data) && resData.data.length > 0) {
          console.log('📦 [AppContext] Data kamar berhasil disinkronkan dari PostgreSQL pgAdmin:', resData.data.length);
          setRooms(resData.data.map(r => ({
            id: r.id,
            namaGedung: r.nama_gedung,
            kategoriGedung: r.kategori_gedung,
            nomorKamar: r.nomor_kamar,
            lantai: r.lantai,
            kapasitas: r.kapasitas,
            terisi: r.terisi,
            ketuaKamar: r.ketua_kamar,
            skorKerapianTerakhir: r.skor_kerapian_terakhir,
            jadwalPiketHariIni: r.jadwal_piket_hari_ini,
            catatanInspeksi: r.catatan_inspeksi,
            updated_at: r.updated_at
          })));
        }
      })
      .catch(() => {});

    // 2. Berlangganan Realtime Postgres Changes seluruh kategori tabel Supabase
    const unsubscribe = subscribeToAllTablesRealtime({
      onSantriChange: (payload) => {
        if (!isMounted) return;
        if (payload.eventType === 'INSERT' && payload.new) {
          const item = normalizeSantriRecord(dbToSantri(payload.new));
          setSantriList(prev => {
            const exists = prev.some(
              s => s.id === item.id ||
                (item.rfidUid && s.rfidUid && s.rfidUid.toUpperCase() === item.rfidUid.toUpperCase())
            );
            if (exists) {
              return prev.map(s => {
                const match = s.id === item.id ||
                  (item.rfidUid && s.rfidUid && s.rfidUid.toUpperCase() === item.rfidUid.toUpperCase());
                if (!match) return s;
                return {
                  ...s,
                  ...item,
                  wali: {
                    ...(s.wali || {}),
                    ...(item.wali || {}),
                    hubungan: item.wali?.hubungan || s.wali?.hubungan || 'Orang Tua Kandung',
                    alamat: item.wali?.alamat || s.wali?.alamat || 'Surabaya',
                  },
                };
              });
            }
            return [item, ...prev];
          });
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          const item = normalizeSantriRecord(dbToSantri(payload.new));
          setSantriList(prev => prev.map(s => {
            const match = s.id === item.id ||
              (item.rfidUid && s.rfidUid && s.rfidUid.toUpperCase() === item.rfidUid.toUpperCase());
            if (!match) return s;
            return {
              ...s,
              ...item,
              wali: {
                ...(s.wali || {}),
                ...(item.wali || {}),
                hubungan: item.wali?.hubungan || s.wali?.hubungan || 'Orang Tua Kandung',
                alamat: item.wali?.alamat || s.wali?.alamat || 'Surabaya',
              },
            };
          }));
          setChatLogs(logs => syncChatLogsWithSantriList(logs, [item]));
        } else if (payload.eventType === 'DELETE' && payload.old) {
          setSantriList(prev => prev.filter(s => s.id !== payload.old.id));
        }
      },
      onRoomChange: (payload) => {
        if (!isMounted) return;
        if (payload.eventType === 'INSERT' && payload.new) {
          const item = dbToRoom(payload.new);
          setRooms(prev => [...prev.filter(r => r.id !== item.id), item]);
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          const item = dbToRoom(payload.new);
          setRooms(prev => prev.map(r => r.id === item.id ? { ...r, ...item } : r));
        } else if (payload.eventType === 'DELETE' && payload.old) {
          setRooms(prev => prev.filter(r => r.id !== payload.old.id));
        }
      },
      onPermitChange: (payload) => {
        if (!isMounted) return;
        if (payload.eventType === 'INSERT' && payload.new) {
          const item = dbToPermit(payload.new);
          setPermits(prev => [item, ...prev.filter(p => p.id !== item.id)]);
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          const item = dbToPermit(payload.new);
          setPermits(prev => prev.map(p => p.id === item.id ? { ...p, ...item } : p));
        } else if (payload.eventType === 'DELETE' && payload.old) {
          setPermits(prev => prev.filter(p => p.id !== payload.old.id));
        }
      },
      onMessageChange: (payload) => {
        if (!isMounted) return;

        // Cek jika ini adalah data booking kunjungan wali santri (room_id: visit_bookings_log)
        if (payload.new && payload.new.room_id === 'visit_bookings_log') {
          try {
            const booking = JSON.parse(payload.new.message_text);
            if (booking && booking.id) {
              if (typeof booking.jam_kunjungan === 'string' && /^23:/.test(booking.jam_kunjungan)) {
                booking.jam_kunjungan = booking.jam_kunjungan.replace(/^23:/, '11:');
              }
              if (!booking.jam_selesai || booking.jam_selesai === '15:30' || booking.jam_selesai === '10:00' || /^23:/.test(booking.jam_selesai)) {
                booking.jam_selesai = '17:30';
              }
              const bookingData = { ...booking, _supabaseMessageId: payload.new.id };
              if (payload.eventType === 'INSERT') {
                sound.playSuccess?.();
              }
              if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                setVisitBookings(prev => {
                  const updated = mergeVisitBookingsLists(prev, [bookingData]);
                  try {
                    localStorage.setItem('sr_visit_bookings', JSON.stringify(updated));
                  } catch {}
                  return updated;
                });
              }
            }
          } catch (err) {
            console.warn('Realtime visit_bookings_log error:', err);
          }
          return; // Jangan dimasukkan ke WhatsApp Chat Logs biasa
        }

        // Cek jika ini adalah data laporan OSIS fallback (room_id: osis_reports_log)
        if (payload.new && payload.new.room_id === 'osis_reports_log') {
          try {
            const report = JSON.parse(payload.new.message_text);
            const deletedSet = getDeletedOsisIds();
            if (report && report.id && !deletedSet.has(String(report.id))) {
              if (payload.eventType === 'INSERT') {
                setOsisReports(prev => {
                  const exists = prev.some(r => r.id === report.id);
                  const updated = exists
                    ? prev.map(r => r.id === report.id ? { ...r, ...report } : r)
                    : [report, ...prev];
                  try { localStorage.setItem('sr_osis_reports', JSON.stringify(updated)); } catch {}
                  return updated;
                });
              } else if (payload.eventType === 'UPDATE') {
                setOsisReports(prev => {
                  const exists = prev.some(r => r.id === report.id);
                  const updated = exists
                    ? prev.map(r => r.id === report.id ? { ...r, ...report } : r)
                    : [report, ...prev];
                  try { localStorage.setItem('sr_osis_reports', JSON.stringify(updated)); } catch {}
                  return updated;
                });
              }
            }
          } catch (err) {
            console.warn('Realtime osis_reports_log error:', err);
          }
          return;
        }

        if (payload.eventType === 'INSERT' && payload.new) {
          const msg = dbToMessage(payload.new);
          sound.playWhatsApp();
          setWhatsappLogs(prev => [
            {
              id: msg.id,
              penerima: msg.receiverRole || 'Pesantren Modern Darul Ulum',
              nomor: msg.senderEmail || 'Mobile App',
              tipe: 'LIVE_CHAT',
              pesan: `${msg.senderName} (${msg.senderRole}): ${msg.messageText}`,
              status: msg.isRead ? 'DELIVERED' : 'SENT',
              waktu: new Date(msg.createdAt).toLocaleTimeString('id-ID'),
              reaction: msg.reaction
            },
            ...prev.filter(m => m.id !== msg.id)
          ]);
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          const msg = dbToMessage(payload.new);
          setWhatsappLogs(prev => prev.map(m => m.id === msg.id ? { ...m, reaction: msg.reaction, status: msg.isRead ? 'READ' : m.status } : m));
        }
      },
      onGateLogInsert: (row) => {
        if (!isMounted || !row) return;
        const item = dbToGateLog(row);
        setGateLogs(prev => [item, ...prev.filter(g => g.id !== item.id)]);
      },
      onDisciplineInsert: (row) => {
        if (!isMounted || !row) return;
        const item = dbToDiscipline(row);
        setDisciplineRecords(prev => [item, ...prev.filter(d => d.id !== item.id)]);
      },
      onMedicalInsert: (row) => {
        if (!isMounted || !row) return;
        const item = dbToMedical(row);
        setMedicalRecords(prev => [item, ...prev.filter(m => m.id !== item.id)]);
      },
      onRfidTransactionInsert: (row) => {
        if (!isMounted || !row) return;
        const item = dbToRfidTransaction(row);
        setRfidTransactions(prev => [item, ...prev.filter(t => t.id !== item.id)]);
      },
      onOsisReportChange: (payload) => {
        if (!isMounted) return;
        const deletedSet = getDeletedOsisIds();
        if (payload.eventType === 'INSERT' && payload.new) {
          const item = dbToOsisReport(payload.new);
          if (!item?.id || deletedSet.has(String(item.id))) return;
          setOsisReports(prev => {
            const updated = [item, ...prev.filter(r => r.id !== item.id)];
            try { localStorage.setItem('sr_osis_reports', JSON.stringify(updated)); } catch {}
            return updated;
          });
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          const item = dbToOsisReport(payload.new);
          if (!item?.id || deletedSet.has(String(item.id))) return;
          setOsisReports(prev => {
            const exists = prev.some(r => r.id === item.id);
            const updated = exists
              ? prev.map(r => r.id === item.id ? { ...r, ...item } : r)
              : [item, ...prev];
            try { localStorage.setItem('sr_osis_reports', JSON.stringify(updated)); } catch {}
            return updated;
          });
        } else if (payload.eventType === 'DELETE' && payload.old?.id) {
          markOsisIdDeleted(payload.old.id);
          setOsisReports(prev => {
            const updated = prev.filter(r => r.id !== payload.old.id);
            try { localStorage.setItem('sr_osis_reports', JSON.stringify(updated)); } catch {}
            return updated;
          });
        }
      }
    });

    return () => {
      isMounted = false;
      authSubscription?.unsubscribe();
      unsubscribe();
    };
  }, []);

  // 3. Berlangganan Supabase Realtime Broadcast Channel: 'whatsapp-room'
  useEffect(() => {
    let isMounted = true;
    const waChannel = supabase.channel('whatsapp-room', {
      config: {
        broadcast: { self: false }
      }
    });

    waChannel
      .on('broadcast', { event: 'whatsapp.status' }, ({ payload }) => {
        if (!isMounted || !payload?.id) return;
        setWhatsappLogs(prev => prev.map(m => {
          if (m.id === payload.id) {
            return {
              ...m,
              apiStatus: payload.status || m.apiStatus,
              latencyMs: payload.latencyMs ?? m.latencyMs,
              latencySec: payload.latencySec ?? m.latencySec
            };
          }
          return m;
        }));
      })
      .on('broadcast', { event: 'whatsapp.incoming' }, ({ payload }) => {
        if (!isMounted || !payload) return;
        sound.playWhatsApp();
        const incomingEntry = {
          id: payload.id || `IN-${Date.now()}`,
          waktu: payload.waktu || getNowWIB(),
          penerima: 'Pesantren Modern Darul Ulum',
          pengirim: payload.pengirim || 'Wali Santri',
          nomor: payload.nomor || '08xxxxxxxxxx',
          tipe: 'PESAN_MASUK_WALI',
          pesan: payload.pesan,
          latencyMs: payload.latencyMs || null,
          apiStatus: 'DELIVERED',
          isIncoming: true
        };
        setWhatsappLogs(prev => [incomingEntry, ...prev]);
        setUnreadWaCount(prev => prev + 1);
      })
      .on('broadcast', { event: 'whatsapp.ai_reply' }, ({ payload }) => {
        if (!isMounted || !payload) return;
        const replyEntry = {
          id: payload.id || `AI-${Date.now()}`,
          waktu: payload.waktu || getNowWIB(),
          penerima: payload.namaWali || 'Wali Santri',
          pengirim: 'Smart Ri\'ayah AI Bot',
          nomor: payload.target,
          tipe: 'BALASAN_AI_OTONOM',
          pesan: payload.replyText,
          apiStatus: payload.dispatched ? 'DELIVERED' : 'FAILED',
          isIncoming: false
        };
        setWhatsappLogs(prev => [replyEntry, ...prev]);
      })
      .on('broadcast', { event: 'whatsapp.visit_booking' }, ({ payload }) => {
        if (!isMounted || !payload?.id) return;
        sound.playSuccess?.();
        setVisitBookings(prev => {
          const updated = mergeVisitBookingsLists(prev, [payload]);
          try {
            localStorage.setItem('sr_visit_bookings', JSON.stringify(updated));
          } catch (e) {
            console.warn('Failed to save visit bookings from realtime:', e);
          }
          return updated;
        });
        // Persist via authenticated browser session ke Supabase DB jika webhook serverless hanya punya key anon
        syncBookingStatusToSupabase(
          payload,
          payload.is_weekday ? 'VISIT_MANUAL_WEEKDAY' : 'VISIT_AUTO_WEEKEND'
        ).catch(() => {});
      })
      .on('broadcast', { event: 'whatsapp.visit_booking_updated' }, ({ payload }) => {
        if (!isMounted || !payload?.id) return;
        setVisitBookings(prev => {
          const updated = mergeVisitBookingsLists(prev, [payload]);
          try {
            localStorage.setItem('sr_visit_bookings', JSON.stringify(updated));
          } catch {}
          return updated;
        });
      })
      .on('broadcast', { event: 'osis.report_created' }, ({ payload }) => {
        if (!isMounted || !payload?.id || getDeletedOsisIds().has(String(payload.id))) return;
        sound.playSuccess?.();
        setOsisReports(prev => {
          const exists = prev.some(r => r.id === payload.id);
          if (exists) return prev;
          const updated = [payload, ...prev];
          try {
            localStorage.setItem('sr_osis_reports', JSON.stringify(updated));
          } catch (e) {}
          return updated;
        });
      })
      .on('broadcast', { event: 'osis.report_verified' }, ({ payload }) => {
        if (!isMounted || !payload?.id || getDeletedOsisIds().has(String(payload.id))) return;
        setOsisReports(prev => {
          const updated = prev.map(r => r.id === payload.id ? { ...r, ...payload } : r);
          try {
            localStorage.setItem('sr_osis_reports', JSON.stringify(updated));
          } catch (e) {}
          return updated;
        });
      })
      .on('broadcast', { event: 'osis.report_updated' }, ({ payload }) => {
        if (!isMounted || !payload?.id || getDeletedOsisIds().has(String(payload.id))) return;
        setOsisReports(prev => {
          const exists = prev.some(r => r.id === payload.id);
          const updated = exists
            ? prev.map(r => r.id === payload.id ? { ...r, ...payload } : r)
            : [payload, ...prev];
          try {
            localStorage.setItem('sr_osis_reports', JSON.stringify(updated));
          } catch (e) {}
          return updated;
        });
      })
      .on('broadcast', { event: 'osis.report_deleted' }, ({ payload }) => {
        if (!isMounted || !payload?.id) return;
        markOsisIdDeleted(payload.id);
        setOsisReports(prev => {
          const updated = prev.filter(r => r.id !== payload.id);
          try {
            localStorage.setItem('sr_osis_reports', JSON.stringify(updated));
          } catch (e) {}
          return updated;
        });
      })
      .on('broadcast', { event: 'santri.wali_updated' }, ({ payload }) => {
        if (!isMounted || !payload) return;
        const cleanNewPhone = normalizePhone(payload.noWali || '');
        const cleanOldPhone = normalizePhone(payload.oldNoWali || '');

        setSantriList(prev => prev.map(s => {
          const isMatch =
            (payload.santriId && s.id === payload.santriId) ||
            (payload.rfidUid && s.rfidUid && s.rfidUid.toUpperCase() === String(payload.rfidUid).toUpperCase()) ||
            (payload.namaSantri && s.nama && s.nama.trim().toLowerCase() === String(payload.namaSantri).trim().toLowerCase());
          if (!isMatch) return s;
          return {
            ...s,
            namaWali: payload.namaWali || s.namaWali || s.wali?.nama,
            noWali: cleanNewPhone || s.noWali || s.wali?.telepon,
            wali: {
              ...(s.wali || {}),
              nama: payload.namaWali || s.wali?.nama,
              telepon: cleanNewPhone || s.wali?.telepon,
            },
          };
        }));

        setChatLogs(prev => prev.map(c => {
          const matchSantri =
            payload.namaSantri &&
            c.santri &&
            c.santri.toLowerCase().includes(String(payload.namaSantri).toLowerCase());
          const matchPhone =
            (cleanNewPhone && isSamePhone(c.sender_phone || c.phone, cleanNewPhone)) ||
            (cleanOldPhone && isSamePhone(c.sender_phone || c.phone, cleanOldPhone));
          if (!matchSantri && !matchPhone) return c;
          const nextPhone = cleanNewPhone || normalizePhone(c.sender_phone || c.phone);
          return {
            ...c,
            name: payload.namaWali || c.name,
            sender_phone: nextPhone || c.sender_phone,
            phone: nextPhone ? `+${nextPhone}` : c.phone,
          };
        }));
      })
      .subscribe((status) => {
        console.log('📡 [AppContext Supabase Realtime whatsapp-room] Status:', status);
      });

    return () => {
      isMounted = false;
      supabase.removeChannel(waChannel);
    };
  }, []);

  // Direct instant fetch & periodic refresh for visit_bookings_log & osis_reports
  useEffect(() => {
    let isMounted = true;

    const refreshVisitBookings = () => {
      fetchVisitBookingsFromSupabase()
        .then(remoteBookings => {
          if (!isMounted || !Array.isArray(remoteBookings) || remoteBookings.length === 0) return;
          setVisitBookings(prev => {
            const merged = mergeVisitBookingsLists(prev, remoteBookings);
            try {
              localStorage.setItem('sr_visit_bookings', JSON.stringify(merged));
            } catch {}
            return merged;
          });
        })
        .catch(err => {
          console.warn('Direct fetch visit bookings warning:', err);
        });
    };

    refreshVisitBookings();
    const visitRefreshTimer = setInterval(refreshVisitBookings, 15000);
    const handleFocusRefresh = () => refreshVisitBookings();
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocusRefresh);
    }

    fetchOsisReportsFromSupabase()
      .then(remoteReports => {
        if (!isMounted || !Array.isArray(remoteReports) || remoteReports.length === 0) return;
        const deletedSet = getDeletedOsisIds();
        setOsisReports(prev => {
          const mergedMap = new Map();
          (prev || []).forEach(r => {
            if (r?.id && !deletedSet.has(String(r.id))) mergedMap.set(r.id, r);
          });
          remoteReports.forEach(r => {
            if (!r?.id || deletedSet.has(String(r.id))) return;
            const existing = mergedMap.get(r.id);
            const existingTs = new Date(existing?.updated_at || existing?.created_at || 0).getTime();
            const remoteTs = new Date(r.updated_at || r.created_at || 0).getTime();
            if (!existing || remoteTs >= existingTs) {
              mergedMap.set(r.id, { ...existing, ...r });
            }
          });
          const merged = Array.from(mergedMap.values()).sort(
            (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
          );
          try {
            localStorage.setItem('sr_osis_reports', JSON.stringify(merged));
          } catch (e) {}
          return merged;
        });
      })
      .catch(err => {
        console.warn('Direct fetch OSIS reports warning:', err);
      });

    return () => {
      isMounted = false;
      clearInterval(visitRefreshTimer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleFocusRefresh);
      }
    };
  }, []);

  // Server-side sync via /api/sync (Cross-profile, cross-browser, incognito sync)
  useEffect(() => {
    // Saat wali santri membuka halaman E-Kupon standalone tanpa login, lewati polling /api/sync agar kupon terbuka seketika
    if (activeGatePassToken && !isAuthenticated) return;

    let isMounted = true;
    let pollInterval = null;

    const fetchServerSync = async () => {
      try {
        const res = await fetch('/api/sync');
        // If endpoint is not found or not implemented, gracefully disable remote server sync
        if (res.status === 404 || res.status === 405) {
          isServerSyncSupportedRef.current = false;
          return;
        }
        if (!res.ok) return;

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          isServerSyncSupportedRef.current = false;
          return;
        }

        const result = await res.json();
        if (result && result.data && result.version && result.version > syncVersionRef.current) {
          if (isMounted) {
            applySyncedData(result.data);
            syncVersionRef.current = result.version;
          }
        } else if (!result || !result.data) {
          // Initialize server with current state if server file is empty
          const currentSnapshot = {
            santriList,
            permits,
            gateLogs,
            disciplineRecords,
            mutabaahList,
            medicalRecords,
            rooms,
            rfidTransactions,
            whatsappLogs,
            blacklistedUids,
            reminderThresholdMinutes
          };
          const newVer = Date.now();
          syncVersionRef.current = newVer;
          fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ version: newVer, data: currentSnapshot })
          }).catch(() => {});
        }
      } catch (err) {
        // Safe to ignore network glitches or dev environment initializations
      }
    };

    fetchServerSync();

    // Periodic polling to detect updates from other accounts / browser windows
    pollInterval = setInterval(async () => {
      if (!isServerSyncSupportedRef.current || !isMounted) return;
      if (typeof document !== 'undefined' && document.hidden) return; // Tidak polling saat tab tidak aktif
      try {
        const verRes = await fetch('/api/sync/version');
        if (verRes.status === 404 || verRes.status === 405) {
          isServerSyncSupportedRef.current = false;
          if (pollInterval) clearInterval(pollInterval);
          return;
        }
        if (!verRes.ok) return;

        const contentType = verRes.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          isServerSyncSupportedRef.current = false;
          if (pollInterval) clearInterval(pollInterval);
          return;
        }

        const verData = await verRes.json();
        if (verData.version && verData.version > syncVersionRef.current) {
          const res = await fetch('/api/sync');
          if (res.ok) {
            const resType = res.headers.get('content-type') || '';
            if (resType.includes('application/json')) {
              const fullData = await res.json();
              if (fullData.data && fullData.version > syncVersionRef.current) {
                if (isMounted) {
                  syncVersionRef.current = fullData.version;
                  applySyncedData(fullData.data);
                }
              }
            }
          }
        }
      } catch {}
    }, 20000);

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [applySyncedData, activeGatePassToken, isAuthenticated]);

  // Debounced push to /api/sync and BroadcastChannel when local state updates
  useEffect(() => {
    if (isApplyingRemoteSync.current) return;
    if (activeGatePassToken && !isAuthenticated) return;

    const timer = setTimeout(() => {
      const payloadFingerprint = JSON.stringify({
        s: santriList?.length,
        p: permits?.length,
        pl: permits?.[0]?.id,
        ps: permits?.[0]?.status,
        r: rooms?.length,
        b: blacklistedUids?.length,
        v: visitBookings?.length,
        vl: visitBookings?.[0]?.id,
        vs: visitBookings?.[0]?.status_kunjungan,
        o: osisReports?.length,
        ol: osisReports?.[0]?.id,
        os: osisReports?.[0]?.status,
        g: gateLogs?.length,
        gl: gateLogs?.[0]?.id
      });

      if (lastSyncedFingerprintRef.current === payloadFingerprint) {
        return; // Data identik dengan state server/sync terakhir, batalkan POST untuk hindari ping-pong loop
      }
      lastSyncedFingerprintRef.current = payloadFingerprint;

      const payload = {
        santriList,
        permits,
        gateLogs,
        disciplineRecords,
        mutabaahList,
        medicalRecords,
        rooms,
        rfidTransactions,
        whatsappLogs,
        blacklistedUids,
        osisReports,
        visitBookings,
        reminderThresholdMinutes
      };
      const newVer = Date.now();
      syncVersionRef.current = newVer;

      // Broadcast to other tabs of same profile
      try {
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const channel = new BroadcastChannel('smart_riayah_sync_channel');
          channel.postMessage({ type: 'STATE_UPDATE', version: newVer, payload });
          channel.close();
        }
      } catch {}

      // Push to server for other profiles and browsers (only if server sync is available)
      if (isServerSyncSupportedRef.current) {
        fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ version: newVer, data: payload })
        }).catch(() => {});
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [
    santriList,
    permits,
    gateLogs,
    disciplineRecords,
    mutabaahList,
    medicalRecords,
    rooms,
    rfidTransactions,
    whatsappLogs,
    blacklistedUids,
    osisReports,
    visitBookings,
    reminderThresholdMinutes
  ]);

  // Clean up Web Serial when tab is closed/refreshed so COM port lock is released immediately
  useEffect(() => {
    const handleUnload = () => {
      webSerial.disconnect().catch(() => {});
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);

  // Hook Web Serial events
  useEffect(() => {
    const unsubEvent = webSerial.addListener((event, data) => {
      if (event === 'RFID_TAG') {
        processRfidTap(data.uid);
      } else if (event === 'CONNECT') {
        setIsSerialConnected(true);
      } else if (event === 'DISCONNECT') {
        setIsSerialConnected(false);
      }
    });

    const unsubLog = webSerial.addRawLogListener((logEntry) => {
      setSerialRawLogs(prev => [logEntry, ...prev.slice(0, 39)]);
    });

    return () => {
      unsubEvent();
      unsubLog();
    };
  }, [santriList, permits, activeRoleTab]);

  // Helper to format time now WITA (Zona Waktu Resmi Pesantren Darul Ulum)
  const getNowWITA = () => {
    const clock = getRealtimePondokClock?.();
    if (clock?.jam_menit) return `${clock.jam_menit} WITA`;
    const d = new Date();
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WITA';
  };
  const getNowWIB = getNowWITA;

  const getIsoNow = () => new Date().toISOString();

  // Helper: Ambil nomor HP wali santri secara konsisten & normalisasi ke format 628...
  const resolveWaliPhone = (santri, fallbackNumber = null) => {
    const fallbackClean = normalizePhone(fallbackNumber || fonnteTargetNumber || '6285960213654') || '6285960213654';
    if (!santri) return fallbackClean;
    const raw = santri.wali?.telepon || santri.no_wali || santri.waliTelepon || santri.noWali || fallbackNumber || '';
    if (!raw) return fallbackClean;
    return normalizePhone(raw) || fallbackClean;
  };

  // 3. FUNGSI PENGIRIMAN OTOMATIS KE API FONNTE (https://api.fonnte.com/send)
  const sendFonnteWhatsApp = async (targetNumber, messageText, eventType = 'GENERAL', mediaUrl = null) => {
    const token = (fonnteToken || defaultFonnteToken || '').trim();
    // Prioritaskan nomor tujuan wali santri aktual, fallback hanya jika nomor kosong
    const rawTarget = targetNumber || fonnteTargetNumber || '6285960213654';
    const cleanTarget = normalizePhone(rawTarget) || '6285960213654';

    let latencyMs = 0;
    let latencySec = '0.00';
    let apiStatus = 'SIMULATED';
    let apiResponse = null;

    if (isFonnteEnabled && token) {
      setIsSendingFonnte(true);
      const t0 = performance.now();
      try {
        const formData = new FormData();
        formData.append('target', cleanTarget);
        formData.append('message', messageText);
        formData.append('countryCode', '62');
        formData.append('preview', 'false');
        if (mediaUrl) {
          formData.append('url', mediaUrl);
        }

        const response = await fetch('https://api.fonnte.com/send', {
          method: 'POST',
          headers: {
            Authorization: token,
          },
          body: formData,
        });

        const t1 = performance.now();
        latencyMs = Math.round(t1 - t0);
        latencySec = (latencyMs / 1000).toFixed(2);
        setLastFonnteLatency(latencyMs);

        const resData = await response.json().catch(() => null);
        apiResponse = resData;

        if (response.ok && (resData?.status === true || resData?.status === 'true' || resData?.id)) {
          apiStatus = 'SUCCESS';
          setFonnteStatus({
            success: true,
            message: `Terkirim ke ${cleanTarget} (${latencyMs} ms)`,
            timestamp: Date.now()
          });
        } else {
          const errMsg = resData?.reason || resData?.message || `HTTP ${response.status}`;
          apiStatus = `ERROR: ${errMsg}`;
          setFonnteStatus({
            success: false,
            message: `Gagal: ${errMsg} (${latencyMs} ms)`,
            timestamp: Date.now()
          });
        }
      } catch (err) {
        const t1 = performance.now();
        latencyMs = Math.round(t1 - t0);
        latencySec = (latencyMs / 1000).toFixed(2);
        apiStatus = `ERR: ${err.message}`;
        setFonnteStatus({
          success: false,
          message: `Koneksi gagal: ${err.message}`,
          timestamp: Date.now()
        });
      } finally {
        setIsSendingFonnte(false);
      }
    } else {
      setFonnteStatus({
        success: true,
        message: 'Mode Simulasi (API Nonaktif)',
        timestamp: Date.now()
      });
    }

    return { latencyMs, latencySec, apiStatus, apiResponse, target: cleanTarget };
  };

  const testFonnteWhatsApp = async () => {
    const target = fonnteTargetNumber || '6285960213654';
    const testMsg = `📲 *[TES KONEKSI LIVE WHATSAPP GATEWAY]*\nAssalamu'alaikum Warahmatullahi Wabarakatuh.\n\nSistem Real-Time IoT Smart Gate & Smart Ri'ayah Pesantren Modern Darul Ulum berhasil terhubung ke WhatsApp Gateway Pesantren!\n\n• Waktu Pengujian: *${getNowWIB()}*\n• Target Uji: *${target}*\n• Status Gateway: *ONLINE & TERVERIFIKASI*\n\n_Pesan ini dikirim otomatis untuk validasi latensi & konektivitas data jurnal ilmiah._`;
    
    await sendWhatsAppNotification(
      `Pengujian WhatsApp Gateway (${target})`,
      target,
      'GATEWAY_TEST',
      testMsg
    );
  };

  // Helper to push WhatsApp Notification with Fonnte Real-Time Dispatch & Latency Tracking
  const sendWhatsAppNotification = async (penerima, nomor, tipe, pesan, mediaUrl = null) => {
    sound.playWhatsApp();
    const id = `WA-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Prioritaskan nomor telepon wali santri penerima pesan aktual
    const rawTarget = nomor || fonnteTargetNumber || '6285960213654';
    const cleanTarget = normalizePhone(rawTarget) || '6285960213654';

    const newMsg = {
      id,
      waktu: getNowWIB(),
      penerima,
      nomor: cleanTarget, // ✅ Ditujukan tepat ke nomor HP wali santri
      tipe,
      pesan,
      mediaUrl: mediaUrl || null,
      latencyMs: null,
      latencySec: null,
      apiStatus: isFonnteEnabled ? 'SENDING' : 'SIMULATED',
      fonnteEnabled: isFonnteEnabled
    };

    setWhatsappLogs(prev => [newMsg, ...prev]);
    setUnreadWaCount(prev => prev + 1);

    // Broadcast ke Supabase Realtime channel 'whatsapp-room'
    sendWhatsAppBroadcast('whatsapp.notification', newMsg);

    // Call Fonnte API asynchronously in background langsung ke nomor wali santri
    try {
      const res = await sendFonnteWhatsApp(cleanTarget, pesan, tipe, mediaUrl);
      setWhatsappLogs(prev => prev.map(m => {
        if (m.id === id) {
          return {
            ...m,
            latencyMs: res.latencyMs,
            latencySec: res.latencySec,
            apiStatus: res.apiStatus,
            apiResponse: res.apiResponse,
            nomor: res.target || m.nomor
          };
        }
        return m;
      }));

      // Broadcast pembaruan status pengiriman ke Supabase Realtime
      sendWhatsAppBroadcast('whatsapp.status', {
        id,
        status: res.apiStatus === 'SUCCESS' ? 'DELIVERED' : 'SENT',
        latencyMs: res.latencyMs,
        latencySec: res.latencySec,
        nomor: res.target || newMsg.nomor
      });
    } catch (e) {
      console.error('Error in sendWhatsAppNotification Fonnte dispatch:', e);
    }
  };

  // 1. Submit Permit (Role: Wali / Santri)
  const submitPermit = (data) => {
    sound.playBeep();
    const santri = santriList.find(s => s.id === data.santriId) || santriList[0];
    const newPermit = {
      id: `PRM-${Date.now().toString().slice(-4)}`,
      santriId: data.santriId,
      kategori: data.kategori,
      keperluan: data.keperluan,
      penjemput: data.penjemput || 'Wali Santri Mandiri',
      waktuKeluarRencana: data.waktuKeluarRencana,
      batasKembali: data.batasKembali,
      status: 'PENDING',
      musyrifPenyetuju: null,
      waktuApproval: null,
      waktuKeluarAktual: null,
      waktuKembaliAktual: null,
      tokenIzin: `DU-${santri.nis}-${Math.floor(1000 + Math.random() * 9000)}`,
      catatanMusyrif: ''
    };

    setPermits(prev => [newPermit, ...prev]);
    syncPermitToSupabase(newPermit);

    // Push notification to WhatsApp
    const submitAddr = resolveWaliAddressing(santri.wali?.nama || 'Wali Santri');
    sendWhatsAppNotification(
      `${santri.wali?.nama || 'Wali Santri'} (Wali ${santri.nama})`,
      resolveWaliPhone(santri),
      'PERMIT_SUBMITTED',
      `Assalamu'alaikum ${submitAddr.panggilan}, pengajuan izin ${data.kategori} ananda ${santri.nama} (${santri.kelas}) telah terkirim ke antrean Admin Ri'ayah. Status: MENUNGGU PERSETUJUAN (PENDING).`
    );
  };

  // 2. Approve Permit (Role: Admin Ri'ayah)
  const approvePermit = (permitId, catatan = 'Disetujui oleh Admin Ri\'ayah. Harap jaga adab santri selama di luar pondok.', customBatasKembali = null) => {
    sound.playSuccess();
    try {
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.8 } });
    } catch {}

    const permit = permits.find(p => p.id === permitId);
    if (!permit) return;
    const santri = santriList.find(s => s.id === permit.santriId);
    const approverLabel = currentUser?.role === 'admin_riayah'
      ? (currentUser.nama || "Admin Ri'ayah (Ust. Drs. H. Mustofa)")
      : "Admin Ri'ayah (Ust. Drs. H. Mustofa)";

    const isExtension = permit.status === 'EXTEND_REQUESTED' || permit.is_extension || permit.isExtension;
    const finalBatasKembali = customBatasKembali || permit.requested_return_date || permit.requestedReturnDate || permit.batasKembali;

    const updatedPermit = {
      ...permit,
      status: 'APPROVED',
      is_extension: false,
      isExtension: false,
      batasKembali: finalBatasKembali,
      return_date: finalBatasKembali,
      musyrifPenyetuju: approverLabel,
      waktuApproval: getIsoNow(),
      catatanMusyrif: catatan
    };
    syncPermitToSupabase(updatedPermit);

    setPermits(prev => prev.map(p => {
      if (p.id === permitId) {
        return updatedPermit;
      }
      return p;
    }));

    if (santri) {
      const approveAddr = resolveWaliAddressing(santri.wali?.nama || 'Wali Santri');
      const notifPesan = isExtension
        ? `🕌 *[SMART PERMIT DARUL ULUM - PERPANJANGAN DISETUJUI]*\nAssalamu'alaikum ${approveAddr.panggilan}, permohonan perpanjangan izin *${santri.nama}* telah *DISETUJUI* Admin Ri'ayah sampai batas waktu baru: ${finalBatasKembali ? new Date(finalBatasKembali).toLocaleString('id-ID') : '-'}.`
        : `🕌 *[SMART PERMIT DARUL ULUM - IZIN DISETUJUI]*\nAssalamu'alaikum ${approveAddr.panggilan}, permohonan izin *${permit.kategori || permit.reason}* ananda *${santri.nama}* (${santri.kelas || 'Santri'}) untuk keperluan *${permit.keperluan || permit.reason}* telah *DISETUJUI* oleh Admin Ri'ayah. Santri sudah dapat Tap Kartu RFID di Smart Gate.`;
      sendWhatsAppNotification(
        `${santri.wali?.nama || 'Wali Santri'} (Wali ${santri.nama})`,
        resolveWaliPhone(santri),
        'PERMIT_APPROVED',
        notifPesan
      );
    }
  };

  // 3. Reject Permit (Role: Admin Ri'ayah)
  const rejectPermit = (permitId, alasan = 'Kegiatan asrama padat/alasan belum mendesak.') => {
    sound.playAccessDenied();
    const permit = permits.find(p => p.id === permitId);
    if (!permit) return;
    const santri = santriList.find(s => s.id === permit.santriId);
    const approverLabel = currentUser?.role === 'admin_riayah'
      ? (currentUser.nama || "Admin Ri'ayah (Ust. Drs. H. Mustofa)")
      : "Admin Ri'ayah (Ust. Drs. H. Mustofa)";

    const updatedPermit = {
      ...permit,
      status: 'REJECTED',
      musyrifPenyetuju: approverLabel,
      waktuApproval: getIsoNow(),
      catatanMusyrif: `DITOLAK: ${alasan}`
    };
    syncPermitToSupabase(updatedPermit);

    setPermits(prev => prev.map(p => {
      if (p.id === permitId) {
        return updatedPermit;
      }
      return p;
    }));

    if (santri) {
      const rejectAddr = resolveWaliAddressing(santri.wali?.nama || 'Wali Santri');
      sendWhatsAppNotification(
        `${santri.wali?.nama || 'Wali Santri'} (Wali ${santri.nama})`,
        resolveWaliPhone(santri),
        'PERMIT_REJECTED',
        `Assalamu'alaikum ${rejectAddr.panggilan}, mohon maaf pengajuan izin ${permit.kategori} ananda ${santri.nama} TIDAK DISETUJUI oleh Admin Ri'ayah. Alasan: "${alasan}".`
      );
    }
  };

  // 3b. Create Express Permit (Quick On-Site RFID Permit / Kiosk)
  const createExpressPermit = (data, openGateImmediately = false) => {
    sound.playSuccess();
    const santri = santriList.find(s => s.id === data.santriId) || santriList[0];
    const permitId = `PRM-${Date.now().toString().slice(-4)}`;
    const tokenIzin = `DU-${santri.nis}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newPermit = {
      id: permitId,
      santriId: santri.id,
      kategori: data.kategori || 'PESIAR',
      keperluan: data.keperluan || 'Izin Cepat Santri',
      penjemput: data.penjemput || "Izin Mandiri / Admin Ri'ayah",
      waktuKeluarRencana: data.waktuKeluarRencana || getIsoNow(),
      batasKembali: data.batasKembali || new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
      status: openGateImmediately ? 'ACTIVE' : 'APPROVED',
      musyrifPenyetuju: "Admin Ri'ayah (Express Kiosk)",
      waktuApproval: getIsoNow(),
      waktuKeluarAktual: openGateImmediately ? getIsoNow() : null,
      waktuKembaliAktual: null,
      tokenIzin: tokenIzin,
      catatanMusyrif: data.catatan || 'Izin Cepat Kiosk / Admin Ri\'ayah'
    };

    setPermits(prev => [newPermit, ...prev]);
    syncPermitToSupabase(newPermit);

    if (openGateImmediately) {
      setSantriList(prev => prev.map(s => s.id === santri.id ? { ...s, statusAsrama: 'DI_LUAR' } : s));

      // Actuate hardware Web Serial ESP32-S3
      webSerial.sendCommand('LED_GREEN:ON;BUZZER:CHIME_GRANTED;GATE:OPEN\n');

      const jamKeluar = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
      const batasJam = new Date(newPermit.batasKembali).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

      setOledState({
        mode: 'GRANTED',
        line1: 'SMART GATE DARUL ULUM',
        line2: `NAMA : ${santri.nama.toUpperCase().slice(0, 16)}`,
        line3: `IZIN : ${newPermit.kategori.slice(0, 12)} (EXPRESS)`,
        line4: 'STATUS: GERBANG DIBUKA',
        line5: `KEMBALI: ${batasJam}`,
        ledHijau: true,
        ledMerah: false,
        buzzer: true,
        lastCommandSent: 'LED_GREEN:ON;BUZZER:CHIME_GRANTED;GATE:OPEN',
        activeSantri: santri
      });

      setGateState({
        status: 'GRANTED',
        gateAngle: -75,
        displayBadge: 'VERIFIED - EXPRESS PERMIT PASS',
        message: `AKSES DITERIMA: Izin Cepat [${newPermit.kategori}] disetujui! Selamat jalan ananda ${santri.nama}. Batas kembali: ${batasJam}.`,
        activeSantri: santri,
        snapshotUrl: santri.foto,
        alarmStrobe: false
      });

      const newLog = {
        id: `LOG-${Date.now().toString().slice(-4)}`,
        timestamp: getIsoNow(),
        santriId: santri.id,
        santriNama: santri.nama,
        rfidUid: santri.rfidUid,
        gateId: 'GATE-01 (Turnstile Utama)',
        tipe: 'TAP_KELUAR',
        status: 'VERIFIED',
        remarks: `EXPRESS PERMIT PASS: ${newPermit.kategori} (${newPermit.keperluan})`,
        snapshotUrl: santri.foto
      };
      setGateLogs(prev => [newLog, ...prev]);
      syncGateLogToSupabase(newLog);

      const waliAddr = resolveWaliAddressing(santri.wali?.nama || 'Wali Santri', '', [], { namaWali: santri.wali?.nama });
      sendWhatsAppNotification(
        `${santri.wali?.nama || 'Wali Santri'} (Wali ${santri.nama})`,
        resolveWaliPhone(santri),
        'GATE_EXIT',
        `Assalamu'alaikum ${waliAddr.panggilan}. PEMBERITAHUAN RESMI: Ananda ${santri.nama} (${santri.kelas}) telah mendapatkan IZIN CEPAT [${newPermit.kategori}] (${newPermit.keperluan}) dan telah melewati Gerbang Utama pada pukul ${jamKeluar}. Batas kembali: ${batasJam}. Terima kasih.`
      );

      setTimeout(() => {
        setGateState(prev => ({
          ...prev,
          status: 'IDLE',
          gateAngle: 0,
          message: 'GATE 01 - STANDBY READY (TAP KARTU RFID 13.56 MHz)',
          alarmStrobe: false
        }));
        setOledState(STANDBY_OLED);
        webSerial.sendCommand('LED_GREEN:OFF;GATE:CLOSE\n');
      }, 4500);

    } else {
      const waliAddr = resolveWaliAddressing(santri.wali?.nama || 'Wali Santri', '', [], { namaWali: santri.wali?.nama });
      sendWhatsAppNotification(
        `${santri.wali?.nama || 'Wali Santri'} (Wali ${santri.nama})`,
        resolveWaliPhone(santri),
        'PERMIT_APPROVED',
        `Assalamu'alaikum ${waliAddr.panggilan}. Pengajuan Izin Cepat [${newPermit.kategori}] (${newPermit.keperluan}) ananda ${santri.nama} telah DISETUJUI (APPROVED) oleh Admin Ri'ayah dengan Token [${tokenIzin}]. Kartu RFID ananda kini AKTIF dan siap di-tap di Gerbang Utama.`
      );
    }

    return newPermit;
  };

  // 4. Interactive IoT Turnstile Gate RFID Tap Simulator & Actuator Synchronizer
  const tapGateRFID = (santriId, actionType = 'EXIT') => {
    sound.playBeep();
    const santri = santriList.find(s => s.id === santriId);
    if (!santri) return;

    setHighlightedSantriId(santriId);
    setTimeout(() => setHighlightedSantriId(null), 5000);

    setGateState(prev => ({
      ...prev,
      status: 'SCANNING',
      message: `MEMINDAI UID RFID [${santri.rfidUid}]... MEMERIKSA OTORISASI SMART GATE...`,
      activeSantri: santri,
      snapshotUrl: santri.foto,
      alarmStrobe: false
    }));

    setTimeout(() => {
      if (actionType === 'EXIT') {
        // Find approved permit for this santri (flexible matching by santriId OR santri name)
        const validPermit = permits.find(p => {
          if (p.status !== 'APPROVED') return false;
          if (p.santriId === santri.id) return true;
          const owner = santriList.find(s => s.id === p.santriId);
          if (owner && owner.nama && santri.nama && owner.nama.trim().toLowerCase() === santri.nama.trim().toLowerCase()) return true;
          if (p.santriNama && santri.nama && p.santriNama.trim().toLowerCase() === santri.nama.trim().toLowerCase()) return true;
          return false;
        });

        if (validPermit) {
          // SCENARIO 1: VALID & APPROVED EXIT
          sound.playSuccess();
          try {
            confetti({ particleCount: 75, spread: 70, origin: { y: 0.6 } });
          } catch {}

          const jamKeluar = getNowWIB();
          const batasJam = new Date(validPermit.batasKembali).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

          // Update permit to ACTIVE & ensure bound to current santri
          setPermits(prev => prev.map(p => {
            if (p.id === validPermit.id) {
              return {
                ...p,
                santriId: santri.id,
                santriNama: santri.nama,
                status: 'ACTIVE',
                waktuKeluarAktual: getIsoNow()
              };
            }
            return p;
          }));

          // Update santri status
          setSantriList(prev => prev.map(s => {
            if (s.id === santri.id || (s.nama && santri.nama && s.nama.trim().toLowerCase() === santri.nama.trim().toLowerCase())) {
              return { ...s, statusAsrama: 'DI_LUAR' };
            }
            return s;
          }));

          // Send serial command to ESP32-S3 breadboard
          webSerial.sendCommand('CMD:OPEN_GATE\n');

          // Update Virtual OLED Display (SSD1306 + LED Hijau GPIO 16 + Buzzer GPIO 15)
          setOledState({
            mode: 'APPROVED',
            line1: 'VERIFIED - GERBANG DIBUKA',
            line2: `NAMA: ${santri.nama.toUpperCase()}`,
            line3: `${santri.kelas} / ${santri.kamar}`,
            line4: `KEP: ${validPermit.keperluan.slice(0, 24)}`,
            line5: `BATAS: ${batasJam}`,
            ledHijau: true,
            ledMerah: false,
            buzzer: true,
            lastCommandSent: 'CMD:OPEN_GATE',
            activeSantri: santri
          });

          // Gate Screen Hologram Green & Open Barrier
          setGateState({
            status: 'GRANTED',
            gateAngle: -75, // Open barrier
            displayBadge: 'VERIFIED - ENTRY PERMIT APPROVED',
            message: 'ACCESS GRANTED: SILAKAN MELINTAS - HAVE A BLESSED DAY!',
            activeSantri: santri,
            snapshotUrl: santri.foto,
            alarmStrobe: false
          });

          // Gate log
          const newLog = {
            id: `LOG-${Date.now().toString().slice(-4)}`,
            timestamp: getIsoNow(),
            santriId: santri.id,
            santriNama: santri.nama,
            rfidUid: santri.rfidUid,
            gateId: 'GATE-01 (Turnstile Utama)',
            tipe: 'TAP_KELUAR',
            status: 'VERIFIED',
            remarks: `Izin ${validPermit.kategori} Terverifikasi (${validPermit.tokenIzin})`,
            snapshotUrl: santri.foto
          };
          setGateLogs(prev => [newLog, ...prev]);
      syncGateLogToSupabase(newLog);

          // WhatsApp to Wali (Automatic Fonnte Notification on RFID Tap Keluar)
          const cardUid = santri.rfidUid || '04:A1:2B:9C';
          sendWhatsAppNotification(
            `${santri.wali?.nama || 'Wali Santri'} (Wali ${santri.nama})`,
            resolveWaliPhone(santri),
            'GATE_EXIT',
            `✅ *[LAPORAN SMART GATE - SANTRI KELUAR]*\nAssalamu'alaikum, ananda *${santri.nama}* (UID Kartu: \`${cardUid}\`) telah melakukan Tap keluar di Smart Gate pada pukul *${jamKeluar}*.\n• Keperluan: ${validPermit.keperluan}\n• Batas Kembali: *${batasJam}*\nTerima kasih.`
          );

          // Auto-close gate barrier and return OLED to standby after 4.5s
          setTimeout(() => {
            setGateState(prev => ({
              ...prev,
              status: 'IDLE',
              gateAngle: 0,
              message: 'GATE 01 - STANDBY READY (TAP KARTU RFID 13.56 MHz)',
              alarmStrobe: false
            }));
            setOledState(STANDBY_OLED);
          }, 4500);

        } else {
          // SCENARIO 2: ILLEGAL / ANTI-BYPASS LOCK
          sound.playTripleBuzzer();
          sound.playAccessDenied();

          // Send serial command to ESP32-S3 breadboard
          webSerial.sendCommand('CMD:DENY_GATE\n');

          const pendingPermit = permits.find(p => (p.santriId === santri.id || (p.santriNama && santri.nama && p.santriNama.trim().toLowerCase() === santri.nama.trim().toLowerCase())) && p.status === 'PENDING');
          const reasonText = pendingPermit ? 'IZIN MASIH PENDING' : 'TIDAK ADA SURAT IZIN RESMI';

          // Update Virtual OLED Display (SSD1306 + LED Merah GPIO 17 + Buzzer Alarm GPIO 15)
          setOledState({
            mode: 'DENIED',
            line1: 'ACCESS DENIED! (ANTI-BYPASS)',
            line2: `NAMA: ${santri.nama.toUpperCase()}`,
            line3: `STATUS: ${reasonText}`,
            line4: 'PALANG GERBANG TERKUNCI!',
            line5: "HUBUNGI ADMIN RI'AYAH",
            ledHijau: false,
            ledMerah: true,
            buzzer: true,
            lastCommandSent: 'CMD:DENY_GATE',
            activeSantri: santri
          });

          setGateState({
            status: 'DENIED',
            gateAngle: 0, // Locked
            displayBadge: 'ACCESS DENIED - ANTI-BYPASS LOCK',
            message: 'PALANG GERBANG TERKUNCI: TIDAK ADA IZIN AKTIF ATAU STATUS MASIH PENDING!',
            activeSantri: santri,
            snapshotUrl: santri.foto,
            alarmStrobe: true
          });

          const newLog = {
            id: `LOG-${Date.now().toString().slice(-4)}`,
            timestamp: getIsoNow(),
            santriId: santri.id,
            santriNama: santri.nama,
            rfidUid: santri.rfidUid,
            gateId: 'GATE-01 (Turnstile Utama)',
            tipe: 'ILLEGAL_ATTEMPT',
            status: 'DENIED',
            remarks: 'ANTI-BYPASS LOCK: Percobaan keluar tanpa persetujuan izin resmi',
            snapshotUrl: santri.foto
          };
          setGateLogs(prev => [newLog, ...prev]);
      syncGateLogToSupabase(newLog);

          // Automatic WhatsApp Security Alert (Anti-Bypass Lock)
          const jamRealTime = getNowWIB();
          const cardUid = santri.rfidUid || 'UID-UNKNOWN';
          sendWhatsAppNotification(
            `${santri.wali?.nama || 'Wali Santri'} (Wali ${santri.nama})`,
            resolveWaliPhone(santri),
            'SECURITY_ALERT',
            `🚨 *[PERINGATAN KEAMANAN SMART GATE]*\nTerdeteksi percobaan Tap Kartu RFID tanpa izin aktif oleh *${santri.nama}* (UID: \`${cardUid}\`) pada pukul *${jamRealTime}*. Palang gerbang otomatis dikunci (Anti-Bypass).`
          );

          setTimeout(() => {
            setGateState(prev => ({
              ...prev,
              status: 'IDLE',
              alarmStrobe: false,
              message: 'GATE 01 - STANDBY READY (TAP KARTU RFID 13.56 MHz)'
            }));
            setOledState(STANDBY_OLED);
          }, 4000);
        }

      } else {
        // SCENARIO 3: CHECK-IN KEMBALI (TAP MASUK)
        sound.playWelcomeChime();
        sound.playSuccess();

        // Send serial command to ESP32-S3 breadboard
        webSerial.sendCommand('CMD:WELCOME_BACK\n');

        const activePermit = permits.find(p => {
          if (p.status !== 'ACTIVE' && p.status !== 'OVERDUE') return false;
          if (p.santriId === santri.id) return true;
          const owner = santriList.find(s => s.id === p.santriId);
          if (owner && owner.nama && santri.nama && owner.nama.trim().toLowerCase() === santri.nama.trim().toLowerCase()) return true;
          if (p.santriNama && santri.nama && p.santriNama.trim().toLowerCase() === santri.nama.trim().toLowerCase()) return true;
          return false;
        });

        if (activePermit) {
          setPermits(prev => prev.map(p => {
            if (p.id === activePermit.id) {
              return {
                ...p,
                santriId: santri.id,
                santriNama: santri.nama,
                status: 'COMPLETED',
                waktuKembaliAktual: getIsoNow()
              };
            }
            return p;
          }));
        }

        setSantriList(prev => prev.map(s => {
          if (s.id === santri.id || (s.nama && santri.nama && s.nama.trim().toLowerCase() === santri.nama.trim().toLowerCase())) {
            return { ...s, statusAsrama: 'DI_ASRAMA' };
          }
          return s;
        }));

        // Update Virtual OLED Display (SSD1306 + LED Hijau GPIO 16)
        setOledState({
          mode: 'WELCOME_BACK',
          line1: 'CHECK-IN BERHASIL',
          line2: 'SELAMAT DATANG KEMBALI',
          line3: `NAMA: ${santri.nama.toUpperCase()}`,
          line4: 'STATUS: COMPLETED (SELESAI)',
          line5: 'ASRAMA: SUDAH DI PONDOK',
          ledHijau: true,
          ledMerah: false,
          buzzer: true,
          lastCommandSent: 'CMD:WELCOME_BACK',
          activeSantri: santri
        });

        setGateState({
          status: 'GRANTED',
          gateAngle: -75,
          displayBadge: 'WELCOME BACK - CHECK-IN COMPLETED',
          message: 'ACCESS GRANTED: SELAMAT DATANG KEMBALI DI PONDOK PESANTREN!',
          activeSantri: santri,
          snapshotUrl: santri.foto,
          alarmStrobe: false
        });

        const newLog = {
          id: `LOG-${Date.now().toString().slice(-4)}`,
          timestamp: getIsoNow(),
          santriId: santri.id,
          santriNama: santri.nama,
          rfidUid: santri.rfidUid,
          gateId: 'GATE-01 (Turnstile Masuk)',
          tipe: 'TAP_MASUK',
          status: 'VERIFIED',
          remarks: `Check-in Asrama Sukses. Izin ${activePermit?.kategori || 'Umum'} selesai ditutup.`,
          snapshotUrl: santri.foto
        };
        setGateLogs(prev => [newLog, ...prev]);
      syncGateLogToSupabase(newLog);

        const jamMasuk = getNowWIB();
        const cardUid = santri.rfidUid || '04:A1:2B:9C';
        sendWhatsAppNotification(
          `${santri.wali?.nama || 'Wali Santri'} (Wali ${santri.nama})`,
          resolveWaliPhone(santri),
          'GATE_ENTRY',
          `🏡 *[LAPORAN SMART GATE - TIBA DI ASRAMA]*\nAlhamdulillah, ananda *${santri.nama}* (UID Kartu: \`${cardUid}\`) telah tiba kembali dengan selamat dan melakukan Check-In di Smart Gate pada pukul *${jamMasuk}*. Status izin dinyatakan selesai (*COMPLETED*).`
        );

        setTimeout(() => {
          setGateState(prev => ({
            ...prev,
            status: 'IDLE',
            gateAngle: 0,
            message: 'GATE 01 - STANDBY READY (TAP KARTU RFID 13.56 MHz)',
            alarmStrobe: false
          }));
          setOledState(STANDBY_OLED);
        }, 4000);
      }
    }, 700);
  };

  // 4b. Auto-Process Hardware RFID Scan (From ESP32-S3 Web Serial or Virtual Scanner)
  const processRfidTap = (uid, explicitAction = null) => {
    if (!uid) return;
    const cleanUid = uid.trim().toUpperCase();

    // Check if RFID Module is turned OFF
    if (!isRfidModuleEnabledRef.current) {
      sound.playBeep();
      setOledState({
        mode: 'DENIED',
        line1: 'MODUL RFID NONAKTIF',
        line2: 'STATUS: SWITCH OFF',
        line3: 'PEMBACAAN DITOLAK',
        line4: `UID: ${cleanUid.slice(0, 11)}`,
        accentColor: '#EF4444'
      });
      setTimeout(() => {
        setOledState({
          mode: 'STANDBY',
          line1: 'SMART RIAYAH GATE',
          line2: 'MODUL RFID: NONAKTIF',
          line3: 'SCANNER RC522: OFF',
          line4: 'KONTROL ADMIN AKTIF',
          accentColor: '#EF4444'
        });
      }, 3000);
      return;
    }

    setLastScannedUid(cleanUid);
    setLastScannedTime(new Date());

    // 1. Check if an active form is listening for hardware scan (e.g. Onboarding or Lost Card Replacement)
    if (typeof hardwareScanListenerRef.current === 'function') {
      sound.playSuccess();
      hardwareScanListenerRef.current(cleanUid);
      return;
    }

    // 2. Check if card UID is Blacklisted / Revoked (Lost Card)
    const revokedInfo = blacklistedUids.find(
      b => b.uid.replace(/[\s-]/g, ':').toUpperCase() === cleanUid.replace(/[\s-]/g, ':').toUpperCase()
    );

    // Search santri by UID (case & colon insensitive)
    const santri = santriList.find(
      s => s.rfidUid.replace(/[\s-]/g, ':').toUpperCase() === cleanUid.replace(/[\s-]/g, ':').toUpperCase()
    );

    if (revokedInfo) {
      sound.playTripleBuzzer();
      sound.playAccessDenied();
      webSerial.sendCommand('CMD:DENY_GATE\n');

      setOledState({
        mode: 'DENIED',
        line1: 'AKSES DITOLAK! (BLOKIR)',
        line2: `UID: ${cleanUid}`,
        line3: 'KARTU DIBLOKIR / RUSAK',
        line4: 'DILAPORKAN HILANG!',
        line5: 'HUBUNGI ADMIN RI\'AYAH',
        ledHijau: false,
        ledMerah: true,
        buzzer: true,
        lastCommandSent: 'CMD:DENY_GATE',
        activeSantri: santri || null
      });

      setGateState({
        status: 'DENIED',
        gateAngle: 0,
        displayBadge: 'KARTU DIBLOKIR / DILAPORKAN HILANG',
        message: `AKSES DITOLAK: Kartu RFID [${cleanUid}] telah DIBLOKIR / DILAPORKAN HILANG! (${revokedInfo.reason}). Palang gerbang terkunci otomatis.`,
        activeSantri: santri || null,
        snapshotUrl: santri?.foto || '/images/avatar_santri_putra.jpg',
        alarmStrobe: true
      });

      const newLog = {
        id: `LOG-${Date.now().toString().slice(-4)}`,
        timestamp: getIsoNow(),
        santriId: santri ? santri.id : 'REVOKED_CARD',
        santriNama: santri ? `${santri.nama} (KARTU BLOKIR)` : `Kartu Diblokir (${cleanUid})`,
        rfidUid: cleanUid,
        gateId: 'GATE-01 (Turnstile Utama)',
        tipe: 'BLOCKED_CARD_ATTEMPT',
        status: 'DENIED',
        remarks: `ANTI-BYPASS LOCK: Percobaan akses dengan kartu DIBLOKIR/HILANG (UID: ${cleanUid} - ${revokedInfo.reason})`,
        snapshotUrl: santri ? santri.foto : '/images/avatar_santri_putra.jpg'
      };
      setGateLogs(prev => [newLog, ...prev]);
      syncGateLogToSupabase(newLog);

      // Security Alert to Admin / Wali for Blocked Card
      const santriNama = santri ? santri.nama : `Kartu UID ${cleanUid}`;
      sendWhatsAppNotification(
        santri ? `${santri.wali?.nama || 'Wali Santri'} (Wali ${santri.nama})` : 'Keamanan Pesantren',
        resolveWaliPhone(santri),
        'SECURITY_ALERT',
        `🚨 *[PERINGATAN KEAMANAN SMART GATE]*\nTerdeteksi percobaan Tap Kartu RFID DIBLOKIR / RUSAK (${revokedInfo.reason}) oleh *${santriNama}* (UID: \`${cleanUid}\`) pada pukul *${getNowWIB()}*. Palang gerbang otomatis dikunci (Anti-Bypass).`
      );

      setTimeout(() => {
        setGateState(prev => ({
          ...prev,
          status: 'IDLE',
          alarmStrobe: false,
          message: 'GATE 01 - STANDBY READY (TAP KARTU RFID 13.56 MHz)'
        }));
        setOledState(STANDBY_OLED);
      }, 4500);

      return;
    }

    if (santri) {
      setHighlightedSantriId(santri.id);
      setTimeout(() => setHighlightedSantriId(null), 5000);

      if (explicitAction) {
        tapGateRFID(santri.id, explicitAction);
      } else {
        // Auto-detect direction based on santri's current permit status (with flexible name fallback)
        const approvedPermit = permits.find(p => {
          if (p.status !== 'APPROVED') return false;
          if (p.santriId === santri.id) return true;
          const owner = santriList.find(s => s.id === p.santriId);
          return (owner && owner.nama && santri.nama && owner.nama.trim().toLowerCase() === santri.nama.trim().toLowerCase()) ||
                 (p.santriNama && santri.nama && p.santriNama.trim().toLowerCase() === santri.nama.trim().toLowerCase());
        });
        const activePermit = permits.find(p => {
          if (p.status !== 'ACTIVE' && p.status !== 'OVERDUE') return false;
          if (p.santriId === santri.id) return true;
          const owner = santriList.find(s => s.id === p.santriId);
          return (owner && owner.nama && santri.nama && owner.nama.trim().toLowerCase() === santri.nama.trim().toLowerCase()) ||
                 (p.santriNama && santri.nama && p.santriNama.trim().toLowerCase() === santri.nama.trim().toLowerCase());
        });

        if (approvedPermit) {
          tapGateRFID(santri.id, 'EXIT');
        } else if (activePermit) {
          tapGateRFID(santri.id, 'ENTRY');
        } else {
          // If user is currently on Kiosk Izin Cepat tab, capture the santri for express permit activation
          if (activeRoleTab === 'express_kiosk') {
            sound.playSuccess();
            setOledState({
              mode: 'KIOSK',
              line1: 'KIOSK IZIN CEPAT',
              line2: santri.nama.toUpperCase(),
              line3: `NIS: ${santri.nis}`,
              line4: 'KARTU TERDETEKSI (OK)',
              line5: 'PILIH KEPERLUAN IZIN',
              ledHijau: true,
              ledMerah: false
            });
            return;
          }
          // Belum izin / PENDING / REJECTED -> Exit attempt to trigger Anti-Bypass
          tapGateRFID(santri.id, 'EXIT');
        }
      }
    } else {
      // Unregistered / Unknown Card Tapped
      sound.playTripleBuzzer();
      webSerial.sendCommand('CMD:DENY_GATE\n');

      setOledState({
        mode: 'UNREGISTERED',
        line1: 'ACCESS DENIED! (KARTU ASING)',
        line2: `UID: ${cleanUid}`,
        line3: 'KARTU BELUM TERDAFTAR',
        line4: 'TEKAN KELOLA KARTU RFID',
        line5: 'UNTUK MENAUTKAN SANTRI',
        ledHijau: false,
        ledMerah: true,
        buzzer: true,
        lastCommandSent: 'CMD:DENY_GATE',
        activeSantri: null
      });

      const newLog = {
        id: `LOG-${Date.now().toString().slice(-4)}`,
        timestamp: getIsoNow(),
        santriId: 'UNREGISTERED',
        santriNama: `Kartu Belum Terdaftar (${cleanUid})`,
        rfidUid: cleanUid,
        gateId: 'GATE-01 (Turnstile Utama)',
        tipe: 'ILLEGAL_ATTEMPT',
        status: 'DENIED',
        remarks: `ANTI-BYPASS LOCK: Kartu fisik UID [${cleanUid}] belum terdaftar dalam sistem pondok`,
        snapshotUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
      };
      setGateLogs(prev => [newLog, ...prev]);
      syncGateLogToSupabase(newLog);

      setTimeout(() => {
        setOledState(STANDBY_OLED);
      }, 4500);
    }
  };

  // 4c. RFID Card Management: Link existing santri to card without changing permit history
  const linkCardToSantri = (santriId, newUid) => {
    const formattedUid = newUid.trim().toUpperCase();
    setSantriList(prev => prev.map(s => {
      if (s.id === santriId) {
        return { ...s, rfidUid: formattedUid };
      }
      return s;
    }));
    setLastScannedUid(formattedUid);
    sound.playSuccess();
  };

  // 4d. RFID Card Management: Register new santri with fresh RFID card & initial permit
  const registerNewSantriCard = (santriData, initialPermitStatus = 'APPROVED') => {
    const formattedUid = santriData.rfidUid.trim().toUpperCase();
    const newId = `S-${Date.now().toString().slice(-4)}`;
    const newSantri = {
      id: newId,
      nis: santriData.nis || `${Math.floor(125500 + Math.random() * 900)}`,
      nama: santriData.nama,
      kelas: santriData.kelas || '10-A',
      gender: santriData.gender || 'L',
      kamar: santriData.kamar || 'Umar bin Khattab 204',
      rfidUid: formattedUid,
      foto: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      wali: {
        nama: santriData.waliNama || `Wali dari ${santriData.nama}`,
        hubungan: 'Orang Tua / Wali',
        telepon: santriData.waliTelepon || '0812-3456-7890',
        alamat: santriData.alamat || 'Surabaya'
      },
      saldoRfid: 125000,
      limitJajanHarian: 25000,
      poinDisiplin: 100,
      tahfidzJuz: 1,
      statusAsrama: initialPermitStatus === 'ACTIVE' || initialPermitStatus === 'OVERDUE' ? 'DI_LUAR' : 'DI_ASRAMA',
      penyakitKhusus: '-'
    };

    setSantriList(prev => {
      // Jika kartu dialihkan dari santri lama, lepas rfidUid dari santri lama
      let cleaned = prev;
      if (santriData.isReassigned || santriData.reassignedFromUid) {
        cleaned = cleaned.map(s => {
          if (s.id !== newId && (s.rfidUid === formattedUid || s.rfid_uid === formattedUid)) {
            return { ...s, rfidUid: '', statusKartu: 'NONAKTIF' };
          }
          return s;
        });
      }

      // Cek apakah santri sudah ada (by ID atau nama yang sama)
      const existingIdx = cleaned.findIndex(s => 
        s.id === newId || 
        (s.nama && newSantri.nama && s.nama.trim().toLowerCase() === newSantri.nama.trim().toLowerCase())
      );
      if (existingIdx !== -1) {
        const copy = [...cleaned];
        copy[existingIdx] = { ...copy[existingIdx], ...newSantri };
        return copy;
      }
      return [newSantri, ...cleaned];
    });

    setLastScannedUid(formattedUid);
    syncSantriToSupabase(newSantri);

    if (initialPermitStatus && initialPermitStatus !== 'TIDAK_ADA') {
      const isOverdue = initialPermitStatus === 'OVERDUE';
      const newPermit = {
        id: `PRM-${Date.now().toString().slice(-4)}`,
        santriId: newId,
        kategori: 'Pesiar',
        keperluan: 'Keperluan santri & aktivasi kartu identitas RFID perdana',
        penjemput: 'Wali Santri Mandiri',
        waktuKeluarRencana: getIsoNow(),
        batasKembali: isOverdue 
          ? new Date(Date.now() - 3600 * 1000).toISOString()
          : new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
        status: initialPermitStatus,
        musyrifPenyetuju: initialPermitStatus !== 'PENDING' ? "Admin Ri'ayah (Ust. Drs. H. Mustofa)" : null,
        waktuApproval: initialPermitStatus !== 'PENDING' ? getIsoNow() : null,
        waktuKeluarAktual: (initialPermitStatus === 'ACTIVE' || initialPermitStatus === 'OVERDUE') ? getIsoNow() : null,
        waktuKembaliAktual: null,
        tokenIzin: `DU-${newSantri.nis}-${Math.floor(1000 + Math.random() * 9000)}`,
        catatanMusyrif: initialPermitStatus === 'REJECTED' ? 'DITOLAK: Masih dalam masa orientasi' : 'Disetujui. Kartu perdana aktif.'
      };
      setPermits(prev => [newPermit, ...prev]);
    syncPermitToSupabase(newPermit);
    }
    sound.playSuccess();
  };

  // 4e. RFID Card Management: Update existing santri card info & wali contact
  const updateSantriCard = async (santriId, updatedData) => {
    const existingTarget = santriList.find(s => s.id === santriId);
    if (!existingTarget) {
      return { success: false, error: new Error('Data santri tidak ditemukan.') };
    }

    const previousRfidUid = existingTarget.rfidUid || '';
    const previousNis = existingTarget.nis || '';
    const previousNama = existingTarget.nama || '';
    const oldNoWali = normalizePhone(existingTarget.wali?.telepon || existingTarget.noWali || '');

    const rawWaliPhone =
      updatedData.waliTelepon !== undefined
        ? updatedData.waliTelepon
        : (updatedData.wali?.telepon ?? existingTarget.wali?.telepon ?? existingTarget.noWali ?? '');
    const normalizedTelepon = normalizePhone(rawWaliPhone) || String(rawWaliPhone || '').trim();
    const resolvedWaliNama =
      updatedData.waliNama !== undefined
        ? String(updatedData.waliNama).trim()
        : (updatedData.wali?.nama || existingTarget.wali?.nama || existingTarget.namaWali || `Wali ${existingTarget.nama}`);

    const updatedWali = {
      ...(existingTarget.wali || {}),
      ...(updatedData.wali || {}),
      nama: resolvedWaliNama,
      telepon: normalizedTelepon,
      hubungan: updatedData.waliHubungan !== undefined ? updatedData.waliHubungan : (updatedData.wali?.hubungan || existingTarget.wali?.hubungan || 'Orang Tua / Wali'),
      alamat: updatedData.waliAlamat !== undefined ? updatedData.waliAlamat : (updatedData.wali?.alamat || existingTarget.wali?.alamat || '-')
    };

    const syncedSantri = {
      ...existingTarget,
      ...updatedData,
      namaWali: resolvedWaliNama,
      noWali: normalizedTelepon,
      wali: updatedWali,
      rfidUid: updatedData.rfidUid ? updatedData.rfidUid.trim().toUpperCase() : existingTarget.rfidUid
    };

    // 1. Simpan permanen ke Supabase PostgreSQL & verifikasi berhasil sebelum commit state
    const syncResult = await syncSantriToSupabase(syncedSantri, {
      previousRfidUid,
      previousNis,
      previousNama
    });

    if (syncResult && syncResult.success === false) {
      sound.playError?.();
      return syncResult;
    }

    // 2. Commit perubahan ke state & localStorage agar sinkron secara real-time di frontend
    setSantriList(prev => {
      const next = prev.map(s => (s.id === santriId ? syncedSantri : s));
      try {
        localStorage.setItem('sr_santri', JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    setChatLogs(prev => {
      const next = prev.map(c => {
        const matchSantri =
          syncedSantri.nama &&
          c.santri &&
          c.santri.toLowerCase().includes(syncedSantri.nama.toLowerCase());
        const matchOldPhone = oldNoWali && isSamePhone(c.sender_phone || c.phone, oldNoWali);
        const matchNewPhone = normalizedTelepon && isSamePhone(c.sender_phone || c.phone, normalizedTelepon);
        if (!matchSantri && !matchOldPhone && !matchNewPhone) return c;
        return {
          ...c,
          name: resolvedWaliNama || c.name,
          sender_phone: normalizedTelepon || c.sender_phone,
          phone: normalizedTelepon ? `+${normalizedTelepon}` : c.phone
        };
      });
      try {
        localStorage.setItem('sr_chat_logs', JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    // 3. Siarkan perubahan nama & nomor wali baru ke seluruh sesi & WhatsApp Gateway
    try {
      await sendWhatsAppBroadcast('santri.wali_updated', {
        santriId: syncedSantri.id,
        namaSantri: syncedSantri.nama,
        namaWali: resolvedWaliNama,
        noWali: normalizedTelepon,
        oldNoWali,
        rfidUid: syncedSantri.rfidUid
      });
    } catch (e) {
      console.warn('Realtime broadcast wali update failed:', e);
    }

    sound.playSuccess();
    return syncResult || { success: true, data: syncedSantri };
  };

  // 4f. Penempatan & Manajemen Kamar Asrama (CRUD Penghuni Kamar)
  const assignSantriToRoom = async (santriId, room) => {
    const existingTarget = santriList.find(s => s.id === santriId);
    if (!existingTarget) {
      return { success: false, error: new Error('Data santri tidak ditemukan.') };
    }
    const roomLabel = room.nomorKamar || room.nama_kamar || 'Kamar Santri';
    const result = await updateSantriCard(santriId, {
      kamar: roomLabel,
      kamarId: room.id,
    });

    if (result && result.success !== false) {
      const nextSantriList = santriList.map(s =>
        s.id === santriId ? { ...s, kamar: roomLabel, kamarId: room.id } : s
      );
      const nextCount = getRoomOccupants(room, nextSantriList).length;
      updateRoom(room.id, { terisi: nextCount });
    }
    return result;
  };

  const removeSantriFromRoom = async (santriId) => {
    const existingTarget = santriList.find(s => s.id === santriId);
    if (!existingTarget) {
      return { success: false, error: new Error('Data santri tidak ditemukan.') };
    }
    const oldKamarId = existingTarget.kamarId;
    const oldKamar = existingTarget.kamar;
    const result = await updateSantriCard(santriId, {
      kamar: '',
      kamarId: null,
    });

    if (result && result.success !== false) {
      const nextSantriList = santriList.map(s =>
        s.id === santriId ? { ...s, kamar: '', kamarId: null } : s
      );
      const targetRoom = rooms.find(r =>
        (oldKamarId && r.id === oldKamarId) ||
        (oldKamar && isSantriInRoom(existingTarget, r))
      );
      if (targetRoom) {
        const nextCount = getRoomOccupants(targetRoom, nextSantriList).length;
        updateRoom(targetRoom.id, { terisi: nextCount });
      }
    }
    return result;
  };

  const moveSantriRoom = async (santriId, newRoom) => {
    return await assignSantriToRoom(santriId, newRoom);
  };

  // Web Serial Port connection functions
  const connectSerial = async () => {
    try {
      const connected = await webSerial.connect(115200);
      if (connected) {
        setIsSerialConnected(true);
        sound.playSuccess();
      }
    } catch (err) {
      alert(`Gagal koneksi serial: ${err.message}`);
    }
  };

  const disconnectSerial = async () => {
    await webSerial.disconnect();
    setIsSerialConnected(false);
  };

  const sendCustomCommand = async (cmd) => {
    await webSerial.sendCommand(cmd);
  };

  // 5. Send Official Early-Warning Reminder to Wali Santri (Configurable H-X Menit)
  const sendEarlyWarningReminder = (permitId) => {
    const permit = permits.find(p => p.id === permitId);
    if (!permit) return;
    const santri = santriList.find(s => s.id === permit.santriId);
    if (!santri) return;

    sound.playWhatsApp();
    if (isAlarmSoundEnabled) {
      sound.playReminderChime();
    }

    const diffMs = new Date(permit.batasKembali).getTime() - Date.now();
    const sisaMenit = Math.max(1, Math.round(diffMs / 60000));
    const batasJam = new Date(permit.batasKembali).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

    // Nyalakan LED Kuning Virtual di Layar Laptop (Emulasi Software) & OLED Screen
    setOledState({
      mode: 'WARNING',
      line1: 'PERINGATAN WAKTU ASRAMA',
      line2: santri.nama.toUpperCase(),
      line3: `SISA WAKTU: ${sisaMenit} MENIT`,
      line4: `BATAS KEMBALI: ${batasJam}`,
      line5: 'LED KUNING LAYAR: ON (AUTO WA SENT)',
      ledHijau: false,
      ledKuning: true,
      ledMerah: false,
      buzzer: false,
      lastCommandSent: 'VIRTUAL:LED_YELLOW_ACTIVE',
      activeSantri: santri
    });
    setTimeout(() => {
      setOledState(STANDBY_OLED);
    }, 4500);

    const waliAddr = resolveWaliAddressing(santri.wali?.nama || 'Wali Santri', '', [], { namaWali: santri.wali?.nama });
    sendWhatsAppNotification(
      `${santri.wali?.nama || 'Wali Santri'} (Wali ${santri.nama})`,
      resolveWaliPhone(santri),
      'WARNING_30M',
      `⏳ *[PENGINGAT SMART GATE - SISA WAKTU PERIZINAN]*\nAssalamu'alaikum Wr. Wb. ${waliAddr.panggilan} (Wali dari *${santri.nama}* - ${santri.kelas}).\nWaktu perizinan ananda (*${permit.kategori}*) tersisa *${sisaMenit} menit* lagi (Batas kembali: *${batasJam}*).\nMohon ananda segera bersiap kembali ke pesantren tepat waktu untuk menghindari catatan pelanggaran kedisiplinan. Syukron. — Admin Ri'ayah Darul Ulum`
    );

    setPermits(prev => prev.map(p => {
      if (p.id === permitId) {
        return {
          ...p,
          reminderSent: true,
          reminderSentAt: getIsoNow()
        };
      }
      return p;
    }));
  };

  // 5c. Send Official Visit Early-Warning Reminder to Visiting Wali (Configurable H-X Menit, Min 15M)
  const sendVisitWarningReminder = (bookingId) => {
    const booking = visitBookings.find(b => b.id === bookingId);
    if (!booking) return;

    sound.playWhatsApp?.();
    if (isAlarmSoundEnabled) {
      sound.playReminderChime?.();
    }

    const cd = calculateVisitCountdown(booking.jam_selesai, booking.tanggal_kunjungan);
    const sisaMenit = cd ? Math.max(1, Math.round(cd.diffMs / 60000)) : reminderThresholdMinutes;
    const jamSelesai = (booking.jam_selesai || '17:30').replace(/^23:/, '17:30');

    // Nyalakan LED Kuning Virtual di Layar Laptop & Virtual OLED Screen
    setOledState({
      mode: 'WARNING',
      line1: 'PENGINGAT BATAS KUNJUNGAN',
      line2: (booking.nama_santri || 'SANTRI').toUpperCase(),
      line3: `WALI: ${(booking.nama_penjenguk || 'WALI SANTRI').toUpperCase()}`,
      line4: `SISA WAKTU: ${sisaMenit} MENIT`,
      line5: `BATAS SELESAI: ${jamSelesai} WITA`,
      ledHijau: false,
      ledKuning: true,
      ledMerah: false,
      buzzer: false,
      lastCommandSent: 'VIRTUAL:LED_YELLOW_ACTIVE'
    });
    setTimeout(() => {
      setOledState(STANDBY_OLED);
    }, 4500);

    const targetPhone = booking.no_wa_penjenguk || booking.whatsapp_penjenguk || booking.nomor_wa || booking.phone;
    if (targetPhone) {
      const waliAddr = resolveWaliAddressing(booking.nama_penjenguk || 'Wali Santri', '', [], { namaWali: booking.nama_penjenguk });
      sendWhatsAppNotification(
        `${booking.nama_penjenguk || 'Wali Santri'} (Wali ${booking.nama_santri})`,
        targetPhone,
        'WARNING_VISIT_TIME',
        `⏳ *[PENGINGAT SMART GATE - SISA WAKTU KUNJUNGAN]*\nAssalamu'alaikum Wr. Wb. ${waliAddr.panggilan} (Wali dari *${booking.nama_santri}* - ${booking.kelas || ''}).\nWaktu berkunjung ananda tersisa *${sisaMenit} menit* lagi (Batas akhir kunjungan: *${jamSelesai} WITA*).\nMohon bersiap untuk menyelesaikan kunjungan dan melakukan konfirmasi check-out di Pos Jaga Satpam gerbang utama sebelum batas waktu berakhir. Syukron. — Pos Keamanan & Admin Ri'ayah Darul Ulum`
      );
    }

    setVisitBookings(prev => {
      const updated = prev.map(b => {
        if (b.id === bookingId) {
          return {
            ...b,
            reminderSent: true,
            reminderSentAt: getIsoNow()
          };
        }
        return b;
      });
      try {
        localStorage.setItem('sr_visit_bookings', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  // Broadcast warning reminder to all active visiting guests nearing expiry
  const broadcastAllVisitWarningReminders = () => {
    let count = 0;
    visitBookings.forEach(b => {
      const isOngoing = b.status_kunjungan === 'Sedang Berkunjung' || b.status_kunjungan?.includes('Sedang Berkunjung');
      if (isOngoing && b.jam_selesai) {
        const cd = calculateVisitCountdown(b.jam_selesai, b.tanggal_kunjungan);
        if (cd && !cd.isOverstay && (cd.diffMs / 60000) <= reminderThresholdMinutes) {
          sendVisitWarningReminder(b.id);
          count++;
        }
      }
    });
    return count;
  };

  // Simulate Visit Guest near expiry for live testing alarm & warning
  const simulateVisitNearExpiry = (minutesLeft = 10) => {
    const clock = getRealtimePondokClock();
    const now = new Date();
    const targetTime = new Date(now.getTime() + minutesLeft * 60 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    const newJamSelesai = `${pad(targetTime.getHours())}:${pad(targetTime.getMinutes())}`;

    setVisitBookings(prev => {
      const active = prev.find(b => b.status_kunjungan === 'Sedang Berkunjung' || b.status_kunjungan?.includes('Sedang Berkunjung'));
      if (active) {
        const updated = prev.map(b => b.id === active.id ? {
          ...b,
          jam_selesai: newJamSelesai,
          reminderSent: false,
          overdueAlertTriggered: false
        } : b);
        try { localStorage.setItem('sr_visit_bookings', JSON.stringify(updated)); } catch (e) {}
        return updated;
      }

      const mockGuest = {
        id: `VST-${clock.tanggal_ymd.replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
        booking_source: 'SIMULASI_ALARM',
        nama_santri: 'Nurmiyaty',
        santri_id: 1,
        kelas: '10-B (Putri)',
        asal: 'Surabaya',
        tanggal_kunjungan: clock.tanggal_ymd,
        hari_kunjungan: clock.nama_hari,
        jam_kunjungan: clock.jam_menit,
        jam_selesai: newJamSelesai,
        titipan_barang: 'Kue & Perlengkapan Asrama (Simulasi Alarm)',
        berat_barang_kg: 2.0,
        nama_penjenguk: 'Arbainah (Wali Santri)',
        status_penjenguk: 'Wali Santri',
        no_wa_penjenguk: '081234567890',
        barcode_token: 'GP-DU-NURMIYATY-TEST',
        status_kunjungan: 'Sedang Berkunjung',
        jam_masuk_aktual: clock.jam_menit_detik,
        jam_checkin_aktual: clock.jam_menit,
        metode_verifikasi: 'SIMULASI_ALARM_POS_SATPAM',
        reminderSent: false,
        created_at: new Date().toISOString()
      };
      const updated = [mockGuest, ...prev];
      try { localStorage.setItem('sr_visit_bookings', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });

    if (isAlarmSoundEnabled) {
      sound.playReminderChime?.();
    }
  };

  // Helper: Trigger Virtual Yellow LED on Laptop Screen (Warning / Test / Notification)
  const triggerYellowLedVirtual = (durationMs = 4000, message = 'PERINGATAN WAKTU (H-X)') => {
    sound.playReminderChime();
    setOledState(prev => ({
      ...prev,
      mode: 'WARNING',
      line1: 'STATUS: PERINGATAN (WARNING)',
      line2: message,
      line3: 'LED KUNING VIRTUAL LAYAR AKTIF',
      line4: 'EMULASI SOFTWARE TANPA PIN FISIK',
      line5: new Date().toLocaleTimeString('id-ID') + ' WIB',
      ledHijau: false,
      ledKuning: true,
      ledMerah: false,
      buzzer: true
    }));

    setTimeout(() => {
      setOledState(STANDBY_OLED);
    }, durationMs);
  };

  // Broadcast warning reminder to all santri currently nearing expiry
  const broadcastAllWarningReminders = () => {
    const warningPermits = permits.filter(p => {
      if (p.status !== 'ACTIVE') return false;
      const diffMs = new Date(p.batasKembali).getTime() - Date.now();
      const sisaMenit = diffMs / 60000;
      return sisaMenit <= reminderThresholdMinutes && sisaMenit > 0;
    });

    warningPermits.forEach(p => {
      sendEarlyWarningReminder(p.id);
    });

    return warningPermits.length;
  };

  // Simulate Santri near expiry for live testing
  const simulateSantriNearExpiry = (santriId, minutesLeft = 20) => {
    const targetSantri = santriList.find(s => s.id === santriId) || santriList[0];
    const newBatas = new Date(Date.now() + minutesLeft * 60 * 1000).toISOString();

    setPermits(prev => {
      const exists = prev.find(p => p.santriId === targetSantri.id);
      if (exists) {
        return prev.map(p => p.id === exists.id ? {
          ...p,
          status: 'ACTIVE',
          waktuKeluarAktual: getIsoNow(),
          batasKembali: newBatas,
          reminderSent: false
        } : p);
      } else {
        const dummyPermit = {
          id: `PRM-${Date.now().toString().slice(-4)}`,
          santriId: targetSantri.id,
          kategori: 'PESIAR',
          keperluan: 'Beli ATK & Keperluan Asrama',
          penjemput: 'Izin Mandiri',
          waktuKeluarRencana: getIsoNow(),
          waktuKeluarAktual: getIsoNow(),
          batasKembali: newBatas,
          status: 'ACTIVE',
          musyrifPenyetuju: "Admin Ri'ayah (Ust. Drs. H. Mustofa)",
          waktuApproval: getIsoNow(),
          tokenIzin: `DU-${targetSantri.nis}-9988`,
          reminderSent: false
        };
        return [dummyPermit, ...prev];
      }
    });

    setSantriList(prev => prev.map(s => s.id === targetSantri.id ? { ...s, statusAsrama: 'DI_LUAR' } : s));

    if (isAlarmSoundEnabled) {
      sound.playReminderChime();
    }
  };

  // Legacy alias for compatibility
  const simulateWarning30Min = (permitId) => {
    sendEarlyWarningReminder(permitId);
  };

  // 6. Simulate Overdue & Auto Disciplinary Violation Point Deduction
  const simulateOverdue = (permitId) => {
    sound.playOverdueAlarm();
    const permit = permits.find(p => p.id === permitId);
    if (!permit) return;
    const santri = santriList.find(s => s.id === permit.santriId);
    if (!santri) return;

    // Update permit to OVERDUE
    setPermits(prev => prev.map(p => {
      if (p.id === permitId) {
        return { ...p, status: 'OVERDUE' };
      }
      return p;
    }));

    // Update santri status to TERLAMBAT & deduct -15 points automatically!
    setSantriList(prev => prev.map(s => {
      if (s.id === santri.id) {
        return {
          ...s,
          statusAsrama: 'TERLAMBAT',
          poinDisiplin: Math.max(0, s.poinDisiplin - 15)
        };
      }
      return s;
    }));

    // Automatic Violation Entry in Smart Ri'ayah
    const newViolation = {
      id: `DISC-${Date.now().toString().slice(-4)}`,
      santriId: santri.id,
      tanggal: new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }),
      jenis: 'PELANGGARAN',
      kategori: 'Keterlambatan Smart Gate (Overdue)',
      poin: -15,
      deskripsi: `[AUTO-AUDIT IOT GATE] Terdeteksi terlambat melewati batas waktu izin ${permit.kategori} tanpa konfirmasi darurat.`,
      pencatat: 'Smart Gate Real-Time Audit Daemon'
    };
    setDisciplineRecords(prev => [newViolation, ...prev]);

    // Push High Priority Emergency Alarm WhatsApp
    const batasJamOverdue = new Date(permit.batasKembali).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    sendWhatsAppNotification(
      `${santri.wali?.nama || 'Wali Santri'} (Wali ${santri.nama})`,
      resolveWaliPhone(santri),
      'OVERDUE_ALARM',
      `🚨 *[PERINGATAN SISTEM - SANTRI TERLAMBAT / OVERDUE]*\nAssalamu'alaikum Wr. Wb. Wali dari *${santri.nama}* (${santri.kelas}).\nAnanda terdeteksi *BELUM KEMBALI* ke pondok melewati batas waktu yang ditentukan (*${batasJamOverdue}*).\nSesuai regulasi Smart Ri'ayah, poin kedisiplinan otomatis dipotong *-15 poin*. Mohon segera hubungi Pos Keamanan Pondok: 0811-2233-4455.`
    );
  };

  // Auto-check live permits & visit bookings every 15s for early-warning alarm & overdue detection
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();

      // 1. Check Santri Permits (Izin Keluar / Pesiar / Pulang)
      permits.forEach(p => {
        if (p.status === 'ACTIVE') {
          const diffMs = new Date(p.batasKembali).getTime() - now;
          const sisaMenit = diffMs / 60000;

          // Auto-send WhatsApp reminder if within threshold and not yet sent
          if (sisaMenit <= reminderThresholdMinutes && sisaMenit > 0 && !p.reminderSent) {
            if (isAutoSendWaReminder) {
              sendEarlyWarningReminder(p.id);
            } else if (isAlarmSoundEnabled) {
              sound.playReminderChime?.();
            }
          }

          // Auto-overdue if time has expired
          if (diffMs <= 0) {
            simulateOverdue(p.id);
          }
        }
      });

      // 2. Check Active Visit Bookings (Wali Santri Sedang Berkunjung)
      visitBookings.forEach(b => {
        const isOngoing = b.status_kunjungan === 'Sedang Berkunjung' || b.status_kunjungan?.includes('Sedang Berkunjung');
        if (isOngoing && b.jam_selesai) {
          const cd = calculateVisitCountdown(b.jam_selesai, b.tanggal_kunjungan);
          if (cd) {
            const sisaMenit = cd.diffMs / 60000;

            // Warning threshold: e.g. <= reminderThresholdMinutes & not yet sent
            if (sisaMenit <= reminderThresholdMinutes && sisaMenit > 0 && !b.reminderSent) {
              if (isAutoSendWaReminder) {
                sendVisitWarningReminder(b.id);
              } else if (isAlarmSoundEnabled) {
                sound.playReminderChime?.();
              }
            }

            // Overstay alarm sound
            if (cd.isOverstay && !b.overdueAlertTriggered) {
              if (isAlarmSoundEnabled) {
                sound.playOverdueAlarm?.();
              }
              b.overdueAlertTriggered = true;
            }
          }
        }
      });
    }, 15000);

    return () => clearInterval(timer);
  }, [permits, visitBookings, reminderThresholdMinutes, isAutoSendWaReminder, isAlarmSoundEnabled]);

  // 7. Add Discipline Record
  const addDisciplineRecord = (santriId, jenis, kategori, poin, deskripsi) => {
    const santri = santriList.find(s => s.id === santriId);
    const newRecord = {
      id: `DISC-${Date.now().toString().slice(-4)}`,
      santriId,
      tanggal: new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }),
      jenis,
      kategori,
      poin: parseInt(poin),
      deskripsi,
      pencatat: 'Ust. M. Syukron (Musyrif)'
    };
    setDisciplineRecords(prev => [newRecord, ...prev]);
    syncDisciplineToSupabase(newRecord);

    if (santri) {
      syncSantriToSupabase({
        ...santri,
        poinDisiplin: Math.max(0, Math.min(100, santri.poinDisiplin + parseInt(poin)))
      });
    }

    setSantriList(prev => prev.map(s => {
      if (s.id === santriId) {
        return {
          ...s,
          poinDisiplin: Math.max(0, Math.min(100, s.poinDisiplin + parseInt(poin)))
        };
      }
      return s;
    }));

    if (santri) {
      sendWhatsAppNotification(
        `${santri.wali?.nama || 'Wali Santri'} (Wali ${santri.nama})`,
        resolveWaliPhone(santri),
        jenis === 'REWARD' ? 'REWARD_NOTIF' : 'DISCIPLINE_NOTIF',
        `Catatan Pengasuhan Smart Ri'ayah: Ananda ${santri.nama} mendapatkan catatan ${jenis} (${poin > 0 ? '+' : ''}${poin} poin) - Kategori: ${kategori}. "${deskripsi}". Total Poin Sekarang: ${Math.max(0, santri.poinDisiplin + parseInt(poin))}/100.`
      );
    }
  };

  // 8. Add Medical Record & Hospital Referral
  const addMedicalRecord = (recordData) => {
    sound.playBeep();
    const newRecord = {
      id: `MED-${Date.now().toString().slice(-3)}`,
      ...recordData,
      tanggal: new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }),
      petugasKlinik: 'dr. Nurul Aini (Dokter Poskestren)'
    };
    setMedicalRecords(prev => [newRecord, ...prev]);
    syncMedicalToSupabase(newRecord);

    const santri = santriList.find(s => s.id === recordData.santriId);
    if (santri) {
      sendWhatsAppNotification(
        `${santri.wali?.nama || 'Wali Santri'} (Wali ${santri.nama})`,
        resolveWaliPhone(santri),
        'HEALTH_NOTIF',
        `Pemberitahuan Poskestren: Ananda ${santri.nama} telah diperiksa di Klinik Asrama dengan keluhan: "${recordData.keluhan}". Diagnosa: ${recordData.diagnosa}. Tindakan: ${recordData.tindakan}. Status: ${recordData.statusIstirahat}.`
      );
    }
  };

  // Hospital Referral helper: auto-creates Smart Permit
  const referToHospital = (santriId, rsName, diagnosa) => {
    sound.playSuccess();
    const santri = santriList.find(s => s.id === santriId);
    if (!santri) return;

    const newPermit = {
      id: `PRM-${Date.now().toString().slice(-4)}`,
      santriId,
      kategori: 'Berobat',
      keperluan: `Rujukan Medis Poskestren ke ${rsName} (Diagnosa: ${diagnosa})`,
      penjemput: 'Ambulans Poskestren & Petugas Pendamping',
      waktuKeluarRencana: getIsoNow(),
      batasKembali: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
      status: 'APPROVED',
      musyrifPenyetuju: 'dr. Nurul Aini (Poskestren) & Pengasuhan',
      waktuApproval: getIsoNow(),
      waktuKeluarAktual: null,
      waktuKembaliAktual: null,
      tokenIzin: `DU-MED-${santri.nis}-${Math.floor(1000 + Math.random() * 9000)}`,
      catatanMusyrif: `Surat rujukan resmi telah diterbitkan ke ${rsName}.`
    };

    setPermits(prev => [newPermit, ...prev]);
    syncPermitToSupabase(newPermit);

    sendWhatsAppNotification(
      `${santri.wali?.nama || 'Wali Santri'} (Wali ${santri.nama})`,
      resolveWaliPhone(santri),
      'HOSPITAL_REFERRAL',
      `PEMBERITAHUAN RUJUKAN MEDIS DARURAT: Ananda ${santri.nama} membutuhkan penanganan lebih lanjut dan dirujuk ke ${rsName}. Izin Smart Gate kategori "Berobat" telah otomatis diterbitkan oleh Poskestren.`
    );
  };

  // 9. RFID Ecosystem: Cashless Kantin, Limit, Library, Laundry
  const setDailySpendLimit = (santriId, newLimit) => {
    setSantriList(prev => prev.map(s => {
      if (s.id === santriId) {
        return { ...s, limitJajanHarian: parseInt(newLimit) };
      }
      return s;
    }));
  };

  const addCashlessTransaction = (santriId, tipe, nominal, merchant, keterangan) => {
    sound.playBeep();
    const santri = santriList.find(s => s.id === santriId);
    if (!santri) return;

    if (santri.saldoRfid < nominal) {
      sound.playAccessDenied();
      alert('Transaksi Ditolak: Saldo RFID Kartu Santri tidak mencukupi!');
      return;
    }

    const newSaldo = santri.saldoRfid - nominal;

    setSantriList(prev => prev.map(s => {
      if (s.id === santriId) {
        return { ...s, saldoRfid: newSaldo };
      }
      return s;
    }));

    const newTrx = {
      id: `TRX-${Date.now().toString().slice(-4)}`,
      santriId,
      tanggal: new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }),
      tipe,
      nominal: parseInt(nominal),
      merchant,
      keterangan,
      saldoAkhir: newSaldo
    };

    setRfidTransactions(prev => [newTrx, ...prev]);

    // Send cashless notification to Wali
    sendWhatsAppNotification(
      `${santri.wali?.nama || 'Wali Santri'} (Wali ${santri.nama})`,
      resolveWaliPhone(santri),
      'CASHLESS_NOTIF',
      `Laporan Transaksi Smart Card: Ananda ${santri.nama} baru saja bertransaksi di ${merchant} sebesar Rp ${parseInt(nominal).toLocaleString('id-ID')} (${keterangan}). Sisa Saldo RFID: Rp ${newSaldo.toLocaleString('id-ID')}.`
    );
  };

  // 10. Authentication System (7 Roles)
  const login = (email, password) => {
    const cleanEmail = email.trim().toLowerCase();
    const account = accounts.find(a => a.email.toLowerCase() === cleanEmail);

    if (!account) {
      sound.playAccessDenied();
      return { 
        success: false, 
        error: `Email "${email}" tidak terdaftar dalam sistem. Silakan periksa kembali atau pilih akun demo di bawah!` 
      };
    }

    if (account.password !== password) {
      sound.playAccessDenied();
      return { 
        success: false, 
        error: 'Password tidak sesuai! Silakan periksa kembali huruf besar/kecil password Anda.' 
      };
    }

    // Success
    sound.playSuccess();
    try {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    } catch {}

    setCurrentUser(account);
    setRole(account.role);
    setIsAuthenticated(true);
    setCurrentView('dashboard');
    setLoginRoleTarget(null);

    return { success: true, user: account };
  };

  const logout = () => {
    sound.playBeep();
    supabase.auth.signOut().catch(() => {});
    try {
      localStorage.removeItem('sr_is_authenticated');
      localStorage.removeItem('sr_current_user');
      localStorage.removeItem('sr_active_role');
      localStorage.removeItem('sr_current_view');
      window.history.replaceState({}, '', '/');
    } catch {}
    setIsAuthenticated(false);
    setCurrentUser(null);
    setCurrentView('landing');
    setLoginRoleTarget(null);
  };

  const navigateTo = (view, roleTarget = null) => {
    setCurrentView(view);
    if (roleTarget) {
      setLoginRoleTarget(roleTarget);
    }
  };

  const switchRoleWithAuth = (targetRole) => {
    // If Super Admin, allow instant bypass preview
    if (currentUser?.role === 'superadmin') {
      sound.playSuccess();
      setRole(targetRole);
      return;
    }

    // Otherwise, redirect to login page for that target role
    sound.playBeep();
    setLoginRoleTarget(targetRole);
    setCurrentView('login');
  };

  // 11. Admin Ri'ayah & Super Admin: Room & Dormitory Builder
  const addBuilding = (namaGedung, kategoriGedung = 'PUTRA') => {
    sound.playSuccess();
    const newRoom = {
      id: `RM-${Date.now().toString().slice(-4)}`,
      namaGedung: namaGedung.trim(),
      kategoriGedung,
      nomorKamar: 'Kamar 101',
      lantai: 1,
      kapasitas: 8,
      terisi: 0,
      ketuaKamar: 'Belum Ditentukan',
      skorKerapianTerakhir: 90,
      jadwalPiketHariIni: 'Jadwal Reguler',
      catatanInspeksi: 'Gedung dan kamar baru terdaftar di sistem.'
    };
    setRooms(prev => [...prev, newRoom]);
  };

  const addRoom = async (roomData) => {
    sound.playSuccess();
    const newRoom = {
      id: roomData.id || `RM-${Date.now().toString().slice(-4)}`,
      namaGedung: roomData.namaGedung,
      kategoriGedung: roomData.kategoriGedung || 'PUTRA',
      nomorKamar: roomData.nomorKamar,
      lantai: parseInt(roomData.lantai || 1, 10),
      kapasitas: parseInt(roomData.kapasitas || 8, 10),
      terisi: parseInt(roomData.terisi || 0, 10),
      ketuaKamar: roomData.ketuaKamar || 'Belum Ditentukan',
      skorKerapianTerakhir: 90,
      jadwalPiketHariIni: 'Jadwal Reguler',
      catatanInspeksi: roomData.catatanInspeksi || 'Kamar siap huni.',
      updated_at: new Date().toISOString()
    };
    setRooms(prev => {
      const next = [...prev.filter(r => r.id !== newRoom.id), newRoom];
      try { localStorage.setItem('sr_rooms', JSON.stringify(next)); } catch {}
      return next;
    });

    // Simpan kamar baru ke Supabase PostgreSQL
    syncRoomToSupabase(newRoom);

    // Simpan kamar baru ke backend lokal jika aktif
    fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRoom)
    }).catch(() => {});
  };

  const updateRoomCapacity = (roomId, newCapacity) => {
    const cap = parseInt(newCapacity);
    if (isNaN(cap) || cap < 1) return;
    const existing = rooms.find(r => r.id === roomId) || {};
    const fullRoom = { 
      ...existing, 
      id: roomId, 
      kapasitas: cap,
      updated_at: new Date().toISOString()
    };
    
    // 1. Simpan ke Supabase
    syncRoomToSupabase(fullRoom);

    // 2. Simpan ke database PostgreSQL / pgAdmin lokal
    fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullRoom)
    }).then(res => res.json()).then(data => {
      console.log('✅ [AppContext] Kapasitas kamar tersimpan ke PostgreSQL:', roomId, data);
    }).catch(err => console.warn('⚠️ Gagal simpan ke PostgreSQL:', err.message));

    // 3. Update state lokal & localStorage
    setRooms(prev => {
      const next = prev.map(r => (r.id === roomId ? fullRoom : r));
      try { localStorage.setItem('sr_rooms', JSON.stringify(next)); } catch {}
      return next;
    });
    sound.playSuccess();
  };

  const updateRoom = (roomId, updatedData) => {
    const existing = rooms.find(r => r.id === roomId) || {};
    const fullRoom = {
      ...existing,
      ...updatedData,
      id: roomId,
      nomorKamar: updatedData.nomorKamar !== undefined ? updatedData.nomorKamar : existing.nomorKamar,
      lantai: updatedData.lantai !== undefined ? (parseInt(updatedData.lantai, 10) || 1) : (existing.lantai || 1),
      kapasitas: updatedData.kapasitas !== undefined ? Math.max(1, parseInt(updatedData.kapasitas) || 1) : existing.kapasitas,
      ketuaKamar: updatedData.ketuaKamar !== undefined ? updatedData.ketuaKamar : existing.ketuaKamar,
      catatanInspeksi: updatedData.catatanInspeksi !== undefined ? updatedData.catatanInspeksi : existing.catatanInspeksi,
      terisi: updatedData.terisi !== undefined ? parseInt(updatedData.terisi, 10) : (existing.terisi || 0),
      updated_at: new Date().toISOString()
    };

    // 1. Simpan ke Supabase
    syncRoomToSupabase(fullRoom);

    // 2. Simpan ke database PostgreSQL / pgAdmin lokal
    fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullRoom)
    }).then(res => res.json()).then(data => {
      console.log('✅ [AppContext] Data kamar berhasil tersimpan otomatis ke PostgreSQL:', roomId, data);
    }).catch(err => console.warn('⚠️ Gagal simpan ke PostgreSQL:', err.message));

    // 3. Update state lokal & localStorage
    setRooms(prev => {
      const next = prev.map(r => r.id === roomId ? fullRoom : r);
      try { localStorage.setItem('sr_rooms', JSON.stringify(next)); } catch {}
      return next;
    });
    sound.playSuccess();
  };

  const deleteRoom = async (roomId, roomName, skipConfirm = false) => {
    const result = await deleteRoomData(roomId, roomName, skipConfirm);
    if (result.success) {
      deleteRoomFromSupabase(roomId);
      setRooms(prev => prev.filter(r => r.id !== roomId));
      sound.playSuccess();
    }
    return result;
  };

  const deleteSantri = async (santriId, santriNama = '', skipConfirm = false) => {
    const result = await deleteSantriData(santriId, santriNama, skipConfirm);
    if (result.success) {
      deleteSantriFromSupabase(santriId);
      const targetSantri = santriList.find(s => s.id === santriId);
      setSantriList(prev => prev.filter(s => s.id !== santriId));

      // Kurangi okupansi kasur kamar terkait jika ada
      if (targetSantri && (targetSantri.kamarId || targetSantri.kamar)) {
        setRooms(prev => prev.map(r => {
          if ((targetSantri.kamarId && String(r.id) === String(targetSantri.kamarId)) ||
              (targetSantri.kamar && (
                r.nomorKamar.toLowerCase().includes(targetSantri.kamar.toLowerCase()) || 
                targetSantri.kamar.toLowerCase().includes(r.nomorKamar.toLowerCase())
              ))) {
            const updated = { ...r, terisi: Math.max(0, r.terisi - 1) };
            syncRoomToSupabase(updated);
            fetch('/api/rooms', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updated)
            }).catch(() => {});
            return updated;
          }
          return r;
        }));
      }

      sound.playSuccess();
    }
    return result;
  };

  const deletePermit = async (permitId) => {
    if (!permitId) return { success: false };
    try {
      const { error } = await supabase.from('permits').delete().eq('id', permitId);
      if (error) {
        console.warn('⚠️ [Supabase deletePermit] Error:', error.message);
      }
      deletePermitFromSupabase(permitId);
      setPermits(prev => prev.filter(p => p.id !== permitId));
      sound.playSuccess();
      return { success: true };
    } catch (err) {
      console.error('❌ [AppContext deletePermit] Exception:', err);
      return { success: false, error: err };
    }
  };

  // 12. Admin Ri'ayah: Onboarding Santri Baru & Live Hardware RFID Tap Integration
  const addNewSantri = (santriData) => {
    const formattedUid = santriData.rfidUid ? santriData.rfidUid.trim().toUpperCase() : `04:${Math.floor(10 + Math.random() * 89)}:${Math.floor(10 + Math.random() * 89)}:${Math.floor(10 + Math.random() * 89)}`;
    const newId = santriData.id || `S-${Date.now().toString().slice(-4)}`;
    const gender = santriData.gender || 'L';
    const defaultAvatar = gender === 'P' ? '/images/avatar_santri_putri.jpg' : '/images/avatar_santri_putra.jpg';

    const newSantri = {
      id: newId,
      nis: santriData.nis || `${Math.floor(125500 + Math.random() * 900)}`,
      nama: santriData.nama,
      kelas: santriData.kelas || (gender === 'P' ? '10-B (Putri)' : '10-A (Putra)'),
      gender,
      kamarId: santriData.kamarId || null,
      kamar: santriData.kamar || (gender === 'P' ? 'Asrama Putri Khadijah 105' : 'Umar bin Khattab 204'),
      rfidUid: formattedUid,
      foto: santriData.foto || defaultAvatar,
      wali: {
        nama: santriData.waliNama || `Wali dari ${santriData.nama}`,
        hubungan: santriData.waliHubungan || 'Orang Tua Kandung',
        telepon: santriData.waliTelepon || '0812-3456-7890',
        alamat: santriData.alamat || 'Surabaya'
      },
      saldoRfid: parseInt(santriData.saldoRfid ?? santriData.saldoAwal ?? 100000),
      limitJajanHarian: 25000,
      poinDisiplin: 100,
      tahfidzJuz: parseInt(santriData.tahfidzAwal || 1),
      statusAsrama: 'DI_ASRAMA',
      penyakitKhusus: santriData.penyakitKhusus || '-'
    };

    setSantriList(prev => {
      // Jika kartu dialihkan dari santri lama, lepas rfidUid dari santri lama
      let cleaned = prev;
      if (santriData.isReassigned || santriData.reassignedFromUid) {
        cleaned = cleaned.map(s => {
          if (s.id !== newId && (s.rfidUid === formattedUid || s.rfid_uid === formattedUid)) {
            return { ...s, rfidUid: '', statusKartu: 'NONAKTIF' };
          }
          return s;
        });
      }

      // Cek apakah santri sudah ada (by ID atau nama yang sama)
      const existingIdx = cleaned.findIndex(s => 
        s.id === newId || 
        (s.nama && newSantri.nama && s.nama.trim().toLowerCase() === newSantri.nama.trim().toLowerCase())
      );
      if (existingIdx !== -1) {
        const copy = [...cleaned];
        copy[existingIdx] = { ...copy[existingIdx], ...newSantri };
        return copy;
      }
      return [newSantri, ...cleaned];
    });

    setLastScannedUid(formattedUid);
    syncSantriToSupabase(newSantri);

    // Auto-update room occupancy count
    if (santriData.kamar || santriData.kamarId) {
      setRooms(prev => prev.map(r => {
        if ((santriData.kamarId && String(r.id) === String(santriData.kamarId)) ||
            (santriData.kamar && (
              r.nomorKamar.toLowerCase().includes(santriData.kamar.toLowerCase()) || 
              santriData.kamar.toLowerCase().includes(r.nomorKamar.toLowerCase())
            ))) {
          const updated = { ...r, terisi: Math.min(r.kapasitas, r.terisi + 1) };
          syncRoomToSupabase(updated);
          fetch('/api/rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updated)
          }).catch(() => {});
          return updated;
        }
        return r;
      }));
    }

    sound.playSuccess();
    try {
      confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
    } catch {}

    // Send Welcome WhatsApp Notification to Wali Santri
    sendWhatsAppNotification(
      `${newSantri.wali?.nama || 'Wali Santri'} (Wali ${newSantri.nama})`,
      resolveWaliPhone(newSantri),
      'SANTRI_REGISTERED',
      `Ahlan wa Sahlan! Pendaftaran santri baru ananda ${newSantri.nama} (NIS: ${newSantri.nis}) di Pesantren Modern Darul Ulum telah BERHASIL. Kartu pintar RFID Smart Permit [${formattedUid}] telah aktif dan siap digunakan di seluruh fasilitas pondok.`
    );
  };

  // 13. Admin Ri'ayah: Lost Card Replacement & Blacklisting
  const replaceLostCard = (santriId, newUid, reason = 'Kartu fisik dilaporkan hilang/rusak') => {
    const santri = santriList.find(s => s.id === santriId);
    if (!santri) return { success: false, error: 'Santri tidak ditemukan!' };

    const oldUid = santri.rfidUid;
    const cleanNewUid = newUid.trim().toUpperCase();

    // Check if newUid is already used by another active santri
    const isAlreadyUsed = santriList.some(s => s.id !== santriId && s.rfidUid.toUpperCase() === cleanNewUid);
    if (isAlreadyUsed) {
      sound.playAccessDenied();
      return { success: false, error: `UID ${cleanNewUid} sudah digunakan oleh santri lain!` };
    }

    // 1. Blacklist old card UID
    const blacklistEntry = {
      id: `BLK-${Date.now().toString().slice(-4)}`,
      uid: oldUid,
      santriId: santri.id,
      santriNama: santri.nama,
      reason: reason || 'Kartu dilaporkan hilang oleh santri',
      date: new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }),
      status: 'REVOKED'
    };
    setBlacklistedUids(prev => [blacklistEntry, ...prev]);

    // 2. Link new card UID to santri (retaining balance, discipline points, permit history)
    setSantriList(prev => prev.map(s => {
      if (s.id === santriId) {
        return { ...s, rfidUid: cleanNewUid };
      }
      return s;
    }));

    setLastScannedUid(cleanNewUid);
    sound.playSuccess();

    // 3. Send WhatsApp Alert to Wali Santri
    sendWhatsAppNotification(
      `${santri.wali?.nama || 'Wali Santri'} (Wali ${santri.nama})`,
      resolveWaliPhone(santri),
      'CARD_REPLACED',
      `Pemberitahuan Admin Ri'ayah: Kartu lama RFID ananda ${santri.nama} (UID: ${oldUid}) telah RESMI DINONAKTIFKAN (STATUS BLOKIR) karena ${reason}. Kartu baru (UID: ${cleanNewUid}) telah aktif dengan seluruh saldo dan riwayat tetap aman.`
    );

    return { success: true };
  };

  const unblockCard = (uid) => {
    sound.playSuccess();
    setBlacklistedUids(prev => prev.filter(b => b.uid.toUpperCase() !== uid.trim().toUpperCase()));
  };

  // 14. Super Admin: Account & Credential Management
  const updateAccount = (accountId, updatedData) => {
    setAccounts(prev => prev.map(a => {
      if (a.id === accountId) {
        return { ...a, ...updatedData };
      }
      return a;
    }));
    sound.playSuccess();
  };

  const addAccount = (newAcc) => {
    const acc = {
      id: `ACC-${Date.now().toString().slice(-3)}`,
      ...newAcc
    };
    setAccounts(prev => [...prev, acc]);
    sound.playSuccess();
  };

  // 15. Super Admin: Export / Import Database JSON
  const exportSystemData = () => {
    const exportObject = {
      exportTimestamp: new Date().toISOString(),
      system: "Smart Permit & Smart Ri'ayah Pesantren Modern Darul Ulum",
      version: "3.8",
      accounts,
      santriList,
      permits,
      gateLogs,
      disciplineRecords,
      mutabaahList,
      medicalRecords,
      rooms,
      rfidTransactions,
      whatsappLogs,
      blacklistedUids
    };

    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(exportObject, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `smart_riayah_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    sound.playSuccess();
  };

  const importSystemData = (jsonData) => {
    try {
      const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      if (data.santriList) setSantriList(data.santriList);
      if (data.permits) setPermits(data.permits);
      if (data.gateLogs) setGateLogs(data.gateLogs);
      if (data.disciplineRecords) setDisciplineRecords(data.disciplineRecords);
      if (data.mutabaahList) setMutabaahList(data.mutabaahList);
      if (data.medicalRecords) setMedicalRecords(data.medicalRecords);
      if (data.rooms) setRooms(data.rooms);
      if (data.rfidTransactions) setRfidTransactions(data.rfidTransactions);
      if (data.whatsappLogs) setWhatsappLogs(data.whatsappLogs);
      if (data.accounts) setAccounts(data.accounts);
      if (data.blacklistedUids) setBlacklistedUids(data.blacklistedUids);
      sound.playSuccess();
      return { success: true };
    } catch (err) {
      sound.playAccessDenied();
      return { success: false, error: err.message };
    }
  };

  // ─── 14. MANAJEMEN KUNJUNGAN, TITIPAN BARANG & BOOKING WHATSAPP (QR GATE PASS) ───
  const [visitSettings, setVisitSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('sr_visit_settings');
      if (saved) return JSON.parse(saved);
      return INITIAL_VISIT_SETTINGS;
    } catch {
      return INITIAL_VISIT_SETTINGS;
    }
  });

  // ─── 15. KNOWLEDGE BASE PERATURAN PONDOK & BULK IMPORTER ───
  const [knowledgeList, setKnowledgeList] = useState(() => {
    try {
      const saved = localStorage.getItem('sr_knowledge_base');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return INITIAL_KNOWLEDGE_BASE;
    } catch {
      return INITIAL_KNOWLEDGE_BASE;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('sr_knowledge_base', JSON.stringify(knowledgeList));
    } catch (e) {
      console.warn('Failed to save knowledge base:', e);
    }
  }, [knowledgeList]);

  const addKnowledgeItem = (item) => {
    const newItem = {
      id: item.id || `kb-${Date.now()}`,
      priority: Number(item.priority) || 10,
      topicGroup: item.topic_group || item.topicGroup || 'Policy & Boundaries',
      category: item.kategori || item.category || 'policy',
      title: item.judul || item.title || 'Untitled Knowledge',
      content: item.konten || item.content || '',
      snippet: (item.konten || item.content || item.snippet || '').slice(0, 100) + '...',
      quality: item.quality || '95/100',
      status: item.status || 'Active',
      security: item.security || 'Security Approved'
    };
    setKnowledgeList(prev => [newItem, ...prev]);
    sound.playSuccess();
    return newItem;
  };

  const bulkImportKnowledge = (rows) => {
    if (!Array.isArray(rows) || rows.length === 0) return { success: false, count: 0 };
    const mapped = rows.map((r, i) => ({
      id: `kb-import-${Date.now()}-${i}`,
      priority: Number(r.priority) || (i + 1) * 5,
      topicGroup: r.topic_group || r.topicGroup || 'Policy & Boundaries',
      category: r.kategori || r.category || 'policy',
      title: r.judul || r.title || `Peraturan Pondok ${i + 1}`,
      content: r.konten || r.content || '',
      snippet: (r.konten || r.content || '').slice(0, 110) + '...',
      quality: r.quality || '96/100',
      status: r.status || 'Active',
      security: r.security || 'Security Approved'
    }));

    setKnowledgeList(prev => [...mapped, ...prev]);
    sound.playSuccess();
    return { success: true, count: mapped.length };
  };

  // ─── BULK IMPORT 3-IN-1: SANTRI, KAMAR ASRAMA, RFID, & WALI SANTRI ───
  const bulkImportSantri = async (rows) => {
    if (!Array.isArray(rows) || rows.length === 0) {
      return { success: false, count: 0, error: 'Data santri kosong' };
    }

    const newSantriList = [];
    const roomsDelta = {}; // roomKey -> count

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const gender = (row.kategori_asrama || '').toUpperCase().includes('PUTRI') || 
                     (row.kelas || '').toLowerCase().includes('putri') || 
                     (row.kategori_asrama || '').toUpperCase() === 'P' ? 'P' : 'L';
      const defaultAvatar = gender === 'P' ? '/images/avatar_santri_putri.jpg' : '/images/avatar_santri_putra.jpg';
      const rawNis = row.nis ? String(row.nis).trim() : `${Math.floor(125500 + Math.random() * 900)}`;
      const santriId = row.id || `S-${rawNis.slice(-4) || (Date.now() + i).toString().slice(-4)}`;
      const rawUid = (row.rfid_uid || row.rfidUid || '').trim().toUpperCase() || 
                     `04:${Math.floor(10 + Math.random() * 89)}:${Math.floor(10 + Math.random() * 89)}:${Math.floor(10 + Math.random() * 89)}`;
      const cleanPhone = normalizePhone(row.no_wa_wali || row.no_wali || row.telepon_wali || '');
      const fallbackPhone = normalizePhone(fonnteTargetNumber || '');
      const kamarName = row.kamar_asrama || row.kamar || (gender === 'P' ? 'Khadijah 105' : 'Umar bin Khattab 204');

      const santriObj = {
        id: santriId,
        nis: rawNis,
        nama: row.nama_santri || row.nama_lengkap || row.nama || `Santri Baru ${i + 1}`,
        kelas: row.kelas || (gender === 'P' ? '10-B (Putri)' : '10-A (Putra)'),
        gender,
        kamar: kamarName,
        rfidUid: rawUid,
        statusKartu: (row.status_kartu || 'ACTIVE').toUpperCase(),
        foto: defaultAvatar,
        wali: {
          nama: row.nama_wali || `Wali dari ${row.nama_santri || 'Santri'}`,
          hubungan: row.status_wali || 'Orang Tua Kandung',
          telepon: cleanPhone || fallbackPhone,
          alamat: row.asal_daerah || 'Surabaya'
        },
        namaWali: row.nama_wali || `Wali dari ${row.nama_santri || 'Santri'}`,
        noWali: cleanPhone || fallbackPhone,
        statusConsent: 'Granted',
        saldoRfid: Number(row.saldo_rfid || 100000),
        limitJajanHarian: 25000,
        poinDisiplin: Number(row.poin_disiplin || 100),
        tahfidzJuz: 1,
        statusAsrama: 'DI_ASRAMA',
        penyakitKhusus: '-'
      };

      newSantriList.push(santriObj);

      // Track room occupancy delta
      if (kamarName) {
        const kLower = kamarName.toLowerCase();
        roomsDelta[kLower] = (roomsDelta[kLower] || 0) + 1;
      }

      // Sync ke Supabase santri table (background / async)
      insertSantriToSupabase({
        id: santriId,
        nama_lengkap: santriObj.nama,
        nis: santriObj.nis,
        gender: santriObj.gender,
        kelas: santriObj.kelas,
        kamar: santriObj.kamar,
        rfid_uid: santriObj.rfidUid,
        nama_wali: santriObj.namaWali,
        no_wali: santriObj.noWali,
        saldo_rfid: santriObj.saldoRfid,
        limit_jajan_harian: santriObj.limitJajanHarian,
        poin_disiplin: santriObj.poinDisiplin,
        status_asrama: santriObj.statusAsrama
      }).catch(err => console.warn('Supabase bulk santri insert warning:', err));
    }

    // 1. Update santriList state (gabungkan dengan deduping berdasarkan NIS atau ID)
    setSantriList(prev => {
      const existingIds = new Set(prev.map(s => String(s.id)));
      const existingNis = new Set(prev.map(s => String(s.nis)));
      const filteredIncoming = newSantriList.filter(s => !existingIds.has(String(s.id)) && !existingNis.has(String(s.nis)));
      const updated = [...filteredIncoming, ...prev];
      try {
        localStorage.setItem('sr_santri', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save sr_santri to localStorage:', e);
      }
      return updated;
    });

    // 2. Update occupancy kuota kamar (1. Kamar Asrama)
    setRooms(prev => {
      const updatedRooms = prev.map(r => {
        let addedCount = 0;
        const rName = `${r.namaGedung} ${r.nomorKamar}`.toLowerCase();
        for (const [kName, count] of Object.entries(roomsDelta)) {
          if (rName.includes(kName) || kName.includes(r.nomorKamar.toLowerCase())) {
            addedCount += count;
          }
        }
        if (addedCount > 0) {
          const newTerisi = Math.min(r.kapasitas, r.terisi + addedCount);
          const updated = { ...r, terisi: newTerisi };
          syncRoomToSupabase(updated);
          return updated;
        }
        return r;
      });
      try {
        localStorage.setItem('sr_rooms', JSON.stringify(updatedRooms));
      } catch (e) {
        console.warn('Failed to save sr_rooms to localStorage:', e);
      }
      return updatedRooms;
    });

    sound.playSuccess();
    return { success: true, count: newSantriList.length };
  };

  // ─── BULK IMPORT RFID CARDS ───
  const bulkImportRfid = (rows) => {
    if (!Array.isArray(rows) || rows.length === 0) return { success: false, count: 0 };
    let updatedCount = 0;
    const rfidMap = new Map();
    rows.forEach(r => {
      const uid = (r.rfid_uid || r.rfidUid || '').trim().toUpperCase();
      const nis = String(r.nis || '').trim();
      const nama = String(r.nama_santri || r.nama || '').trim().toLowerCase();
      if (uid) {
        if (nis) rfidMap.set(`nis:${nis}`, { uid, status: r.status_kartu || 'ACTIVE' });
        if (nama) rfidMap.set(`nama:${nama}`, { uid, status: r.status_kartu || 'ACTIVE' });
      }
    });

    setSantriList(prev => {
      const updated = prev.map(s => {
        const match = rfidMap.get(`nis:${String(s.nis).trim()}`) || rfidMap.get(`nama:${String(s.nama).trim().toLowerCase()}`);
        if (match) {
          updatedCount++;
          const newObj = { ...s, rfidUid: match.uid, statusKartu: match.status };
          syncSantriToSupabase(newObj);
          return newObj;
        }
        return s;
      });
      localStorage.setItem('sr_santri', JSON.stringify(updated));
      return updated;
    });

    sound.playSuccess();
    return { success: true, count: updatedCount || rows.length };
  };

  // ─── BULK IMPORT WALI SANTRI (CUSTOMERS) ───
  const bulkImportCustomers = (rows) => {
    if (!Array.isArray(rows) || rows.length === 0) return { success: false, count: 0 };
    let count = 0;
    const custMap = new Map();
    rows.forEach(r => {
      const cleanPhone = normalizePhone(r.no_wa_wali || r.no_wali || r.telepon_wali || '');
      const namaWali = r.nama_wali || r.namaWali;
      const namaSantri = String(r.nama_santri || r.santri || '').trim().toLowerCase();
      if (namaSantri) {
        custMap.set(namaSantri, { cleanPhone, namaWali, statusWali: r.status_wali || 'Orang Tua Kandung' });
      }
    });

    setSantriList(prev => {
      const updated = prev.map(s => {
        const match = custMap.get(String(s.nama).trim().toLowerCase());
        if (match) {
          count++;
          const newObj = {
            ...s,
            namaWali: match.namaWali || s.namaWali,
            noWali: match.cleanPhone || s.noWali,
            statusConsent: 'Granted',
            wali: {
              ...s.wali,
              nama: match.namaWali || s.wali?.nama,
              telepon: match.cleanPhone || s.wali?.telepon,
              hubungan: match.statusWali || s.wali?.hubungan
            }
          };
          syncSantriToSupabase(newObj);
          return newObj;
        }
        return s;
      });
      localStorage.setItem('sr_santri', JSON.stringify(updated));
      return updated;
    });

    sound.playSuccess();
    return { success: true, count: count || rows.length };
  };

  // Cross-Tab Real-Time Sync (BroadcastChannel & Storage Event)
  useEffect(() => {
    let bc = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel('smart_riayah_visit_channel');
        bc.onmessage = (event) => {
          if (event.data?.type === 'SYNC_VISITS' && Array.isArray(event.data?.payload)) {
            setVisitBookings(prev => {
              const merged = mergeVisitBookingsLists(prev, event.data.payload);
              return merged === prev ? prev : merged;
            });
          }
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel setup error:', e);
    }

    const handleStorage = (e) => {
      if (e.key === 'sr_visit_bookings' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setVisitBookings(prev => {
              const merged = mergeVisitBookingsLists(prev, parsed);
              return merged === prev ? prev : merged;
            });
          }
        } catch (err) {
          console.warn('Storage sync error:', err);
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('sr_visit_bookings', JSON.stringify(visitBookings));
      // Broadcast to other tabs immediately
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('smart_riayah_visit_channel');
        bc.postMessage({
          type: 'SYNC_VISITS',
          payload: visitBookings,
          updated_at: new Date().toISOString()
        });
        bc.close();
      }
    } catch (e) {
      console.warn('Failed to save visit bookings:', e);
    }
  }, [visitBookings]);

  useEffect(() => {
    try {
      localStorage.setItem('sr_visit_settings', JSON.stringify(visitSettings));
    } catch (e) {
      console.warn('Failed to save visit settings:', e);
    }
  }, [visitSettings]);

  const updateVisitSettings = (newSettings) => {
    setVisitSettings(prev => ({ ...prev, ...newSettings }));
    sound.playSuccess?.();
  };

  const getDayName = (dateStr) => {
    if (!dateStr) return 'Jumat';
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Jumat';
    return dayNames[d.getDay()];
  };

  const addVisitBooking = (bookingData) => {
    const clock = getRealtimePondokClock();
    const todayStr = clock.tanggal_ymd;
    const tgl = bookingData.tanggal_kunjungan || todayStr;
    const hari = bookingData.hari_kunjungan || getDayName(tgl);
    const isWeekend = ['Jumat', 'Sabtu', 'Minggu'].includes(hari);

    const cleanPhone = (bookingData.no_wa_penjenguk || '').replace(/[^0-9]/g, '');
    const cleanSantri = (bookingData.nama_santri || '').trim().toLowerCase();

    // ─── ANTI-DOUBLING: Cek sesi booking aktif pada tanggal yang sama (15-Minute Consolidation Window) ───
    const existingIndex = visitBookings.findIndex(b => {
      if (b.status_kunjungan === 'Selesai' || b.status_kunjungan === 'Ditolak') return false;
      const bDate = b.tanggal_kunjungan || todayStr;
      if (bDate !== tgl) return false;
      const bPhone = (b.no_wa_penjenguk || '').replace(/[^0-9]/g, '');
      const bSantri = (b.nama_santri || '').trim().toLowerCase();
      const matchPhone = cleanPhone && bPhone && (cleanPhone === bPhone || cleanPhone.endsWith(bPhone) || bPhone.endsWith(cleanPhone));
      const matchSantri = cleanSantri && bSantri && (cleanSantri === bSantri || cleanSantri.includes(bSantri) || bSantri.includes(cleanSantri));
      return matchPhone || matchSantri;
    });

    if (existingIndex !== -1) {
      const existing = visitBookings[existingIndex];
      const mergedWeight = parseFloat(bookingData.berat_barang_kg) > 0 ? parseFloat(bookingData.berat_barang_kg) : existing.berat_barang_kg;
      const mergedItems = (bookingData.titipan_barang && bookingData.titipan_barang !== '-') 
        ? (existing.titipan_barang && existing.titipan_barang !== '-' ? `${existing.titipan_barang}, ${bookingData.titipan_barang}` : bookingData.titipan_barang)
        : existing.titipan_barang;

      const mergedBooking = {
        ...existing,
        titipan_barang: mergedItems,
        berat_barang_kg: mergedWeight,
        jam_kunjungan: bookingData.jam_kunjungan || existing.jam_kunjungan,
        jam_selesai: bookingData.jam_selesai || existing.jam_selesai,
        nama_penjenguk: bookingData.nama_penjenguk || existing.nama_penjenguk,
        status_penjenguk: bookingData.status_penjenguk || existing.status_penjenguk,
        no_wa_penjenguk: bookingData.no_wa_penjenguk || existing.no_wa_penjenguk,
        asal: bookingData.asal || existing.asal,
        kelas: bookingData.kelas || existing.kelas,
        updated_at: clock.timestamp_iso
      };

      setVisitBookings(prev => {
        const next = [...prev];
        next[existingIndex] = mergedBooking;
        try {
          localStorage.setItem('sr_visit_bookings', JSON.stringify(next));
        } catch (e) {}
        return next;
      });

      syncBookingStatusToSupabase(mergedBooking, 'VISIT_UPDATED');
      sound.playSuccess?.();
      return mergedBooking;
    }

    const bookingId = bookingData.id || `VST-${clock.tanggal_ymd.replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
    const cleanSantriName = (bookingData.nama_santri || 'Santri').replace(/[^a-zA-Z]/g, '').slice(0, 6).toUpperCase();

    let approvalType = 'MANUAL_WEEKDAY';
    let statusKunjungan = 'Menunggu Approval';
    let barcodeToken = null;
    let waktuDisetujui = null;

    if (bookingData.booking_source === 'MANUAL_SATPAM') {
      approvalType = isWeekend ? 'AUTO_WEEKEND' : 'MANUAL_WEEKDAY';
      statusKunjungan = bookingData.status_kunjungan || (isWeekend ? 'Disetujui (Siap Datang)' : 'Sedang Berkunjung');
      barcodeToken = bookingData.barcode_token || generateBarcodeToken(cleanSantriName);
      waktuDisetujui = clock.timestamp_iso;
    } else if (isWeekend && visitSettings.auto_approve_weekend) {
      approvalType = 'AUTO_WEEKEND';
      statusKunjungan = 'Disetujui (Siap Datang)';
      barcodeToken = bookingData.barcode_token || generateBarcodeToken(cleanSantriName);
      waktuDisetujui = clock.timestamp_iso;
    } else {
      approvalType = 'MANUAL_WEEKDAY';
      statusKunjungan = 'Menunggu Approval';
      barcodeToken = null;
    }

    const { qrCodeUrl: initialQrUrl, linearBarcodeUrl: initialBarcodeUrl, gatePassUrl: initialGatePassUrl } = barcodeToken
      ? getVisitGatePassUrls(barcodeToken)
      : {};

    const newBooking = {
      id: bookingId,
      booking_source: bookingData.booking_source || 'WHATSAPP',
      nama_santri: bookingData.nama_santri || 'Santri Terdaftar',
      kelas: bookingData.kelas || '10-A',
      asal: bookingData.asal || 'Surabaya',
      tanggal_kunjungan: tgl,
      hari_kunjungan: hari,
      jam_kunjungan: (bookingData.jam_kunjungan || clock.jam_menit).replace(/^23:/, '11:'),
      jam_selesai: (bookingData.jam_selesai || '17:30').replace(/^23:/, '17:30'),
      titipan_barang: bookingData.titipan_barang || '-',
      berat_barang_kg: parseFloat(bookingData.berat_barang_kg) || 0,
      nama_penjenguk: bookingData.nama_penjenguk || 'Wali Santri',
      status_penjenguk: bookingData.status_penjenguk || 'Wali Santri',
      status_penjenguk_lainnya: bookingData.status_penjenguk_lainnya || '',
      no_wa_penjenguk: normalizePhone(bookingData.no_wa_penjenguk || fonnteTargetNumber || '6285960213654') || '6285960213654',
      rfid_uid: bookingData.rfid_uid || null,
      barcode_token: barcodeToken,
      barcode_image_url: initialQrUrl || null,
      barcode_linear_url: initialBarcodeUrl || null,
      gate_pass_url: initialGatePassUrl || null,
      approval_type: approvalType,
      status_kunjungan: statusKunjungan,
      waktu_chat_masuk: bookingData.waktu_chat_masuk || clock.timestamp_iso,
      waktu_disetujui: waktuDisetujui || bookingData.waktu_disetujui || null,
      jam_masuk_aktual: bookingData.jam_masuk_aktual || (statusKunjungan === 'Sedang Berkunjung' ? clock.jam_menit_detik : null),
      jam_keluar_aktual: bookingData.jam_keluar_aktual || null,
      jam_checkin_aktual: bookingData.jam_checkin_aktual || (statusKunjungan === 'Sedang Berkunjung' ? clock.jam_menit : null),
      jam_checkout_aktual: bookingData.jam_checkout_aktual || null,
      created_at: clock.timestamp_iso
    };

    setVisitBookings(prev => {
      const next = [newBooking, ...prev];
      try {
        localStorage.setItem('sr_visit_bookings', JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    // Simpan ke Supabase agar tersinkron lintas perangkat/peran
    syncBookingStatusToSupabase(newBooking, statusKunjungan === 'Disetujui (Siap Datang)' ? 'VISIT_APPROVED' : 'VISIT_CREATED');

    // Kirim notifikasi WhatsApp via Fonnte Gateway
    const targetPhone = newBooking.no_wa_penjenguk;
    const newBookingAddr = resolveWaliAddressing(newBooking.nama_penjenguk);
    if (newBooking.booking_source?.includes('WHATSAPP')) {
      if (statusKunjungan === 'Disetujui (Siap Datang)') {
        const { qrCodeUrl, linearBarcodeUrl, gatePassUrl } = getVisitGatePassUrls(barcodeToken);
        newBooking.barcode_image_url = qrCodeUrl;
        newBooking.barcode_linear_url = linearBarcodeUrl;
        newBooking.gate_pass_url = gatePassUrl;

        sendWhatsAppNotification(
          `${newBooking.nama_penjenguk} (Wali ${newBooking.nama_santri})`,
          targetPhone,
          'VISIT_AUTO_APPROVED',
          `✅ *Booking Kunjungan Disetujui (Weekend)*\nAssalamu'alaikum ${newBookingAddr.panggilan}, kunjungan ananda *${newBooking.nama_santri}* (${newBooking.kelas}) pada *${hari}, ${tgl}* pukul *${newBooking.jam_kunjungan}-${newBooking.jam_selesai}* disetujui otomatis.\n\n🎫 Kupon: *${barcodeToken}*\n🔗 Gate Pass: ${gatePassUrl}\n📷 QR: ${qrCodeUrl}\nTunjukkan kupon ini ke Satpam Gerbang Utama.`,
          qrCodeUrl
        );
      } else {
        sendWhatsAppNotification(
          `${newBooking.nama_penjenguk} (Wali ${newBooking.nama_santri})`,
          targetPhone,
          'VISIT_WAITING_APPROVAL',
          `⏳ *Permohonan Kunjungan Tercatat (Hari Kerja)*\nAssalamu'alaikum ${newBookingAddr.panggilan}, booking kunjungan ananda *${newBooking.nama_santri}* untuk *${hari}, ${tgl}* (${newBooking.jam_kunjungan}-${newBooking.jam_selesai}) sudah masuk ke Admin Ri'ayah dan sedang menunggu persetujuan.\n\nBarcode Gate Pass akan dikirim otomatis setelah disetujui.`
        );
      }
    }

    sound.playSuccess?.();
    return newBooking;
  };

  const approveVisitBooking = (bookingId) => {
    const booking = visitBookings.find(b => b.id === bookingId);
    if (!booking) return;

    const clock = getRealtimePondokClock();
    const cleanSantriName = (booking.nama_santri || 'Santri').replace(/[^a-zA-Z]/g, '').slice(0, 6).toUpperCase();
    const barcodeToken = booking.barcode_token || generateBarcodeToken(cleanSantriName);
    const { qrCodeUrl, linearBarcodeUrl, gatePassUrl } = getVisitGatePassUrls(barcodeToken);
    const bookingAddr = resolveWaliAddressing(booking.nama_penjenguk);

    const updatedBooking = {
      ...booking,
      status_kunjungan: 'Disetujui (Siap Datang)',
      barcode_token: barcodeToken,
      barcode_image_url: qrCodeUrl,
      barcode_linear_url: linearBarcodeUrl,
      gate_pass_url: gatePassUrl,
      waktu_disetujui: clock.timestamp_iso
    };

    setVisitBookings(prev => {
      const next = prev.map(b => b.id === bookingId ? updatedBooking : b);
      try {
        localStorage.setItem('sr_visit_bookings', JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    sendWhatsAppNotification(
      `${booking.nama_penjenguk} (Wali ${booking.nama_santri})`,
      booking.no_wa_penjenguk,
      'VISIT_APPROVED_ADMIN',
      `🎉 *Kunjungan Disetujui Admin Ri'ayah*\nAssalamu'alaikum ${bookingAddr.panggilan}, kunjungan ananda *${booking.nama_santri}* (${booking.kelas}) pada *${booking.hari_kunjungan}, ${booking.tanggal_kunjungan}* pukul *${booking.jam_kunjungan}-${booking.jam_selesai}* telah *DISETUJUI*.\n\n🎫 Kupon: *${barcodeToken}*\n🔗 Gate Pass: ${gatePassUrl}\n📷 QR: ${qrCodeUrl}\nTunjukkan QR/kupon ini kepada Satpam saat tiba di pondok.`,
      qrCodeUrl
    );

    // Sinkronkan ke Supabase & siarkan update
    syncBookingStatusToSupabase(updatedBooking, 'VISIT_APPROVED');

    sound.playSuccess?.();
  };

  const rejectVisitBooking = (bookingId, reason = 'Kunjungan di luar kuota / agenda pondok padat') => {
    const booking = visitBookings.find(b => b.id === bookingId);
    if (!booking) return;

    const bookingAddr = resolveWaliAddressing(booking.nama_penjenguk);
    const updatedBooking = {
      ...booking,
      status_kunjungan: 'Ditolak',
      catatan_penolakan: reason
    };

    setVisitBookings(prev => {
      const next = prev.map(b => b.id === bookingId ? updatedBooking : b);
      try {
        localStorage.setItem('sr_visit_bookings', JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    sendWhatsAppNotification(
      `${booking.nama_penjenguk} (Wali ${booking.nama_santri})`,
      booking.no_wa_penjenguk,
      'VISIT_REJECTED',
      `❌ *Permohonan Kunjungan Ditolak*\nAssalamu'alaikum ${bookingAddr.panggilan}, mohon maaf permohonan kunjungan ananda *${booking.nama_santri}* (${booking.tanggal_kunjungan}) belum dapat disetujui.\nAlasan: "${reason}".\nSilakan ajukan ulang pada hari kunjungan resmi (Jumat–Minggu).`
    );

    // Sinkronkan ke Supabase & siarkan update
    syncBookingStatusToSupabase(updatedBooking, 'VISIT_REJECTED');

    sound.playBeep?.();
  };

  const checkInVisitBooking = (bookingOrId, method = 'BARCODE') => {
    const clock = getRealtimePondokClock();
    let updatedBooking = null;
    const isObject = typeof bookingOrId === 'object' && bookingOrId !== null;
    const targetObj = isObject ? bookingOrId : null;
    const cleanId = String(isObject ? (bookingOrId.id || bookingOrId.barcode_token || '') : (bookingOrId || '')).trim().toUpperCase();

    setVisitBookings(prev => {
      let foundExisting = false;
      const next = prev.map(b => {
        const matchId = String(b.id || '').toUpperCase() === cleanId;
        const matchToken = b.barcode_token && b.barcode_token.toUpperCase() === cleanId;
        const matchObjId = targetObj && String(b.id || '').toUpperCase() === String(targetObj.id || '').toUpperCase();
        if (matchId || matchToken || matchObjId) {
          foundExisting = true;
          updatedBooking = {
            ...b,
            ...(targetObj || {}),
            status_kunjungan: 'Sedang Berkunjung',
            jam_masuk_aktual: clock.jam_menit_detik,
            jam_checkin_aktual: clock.jam_menit,
            metode_verifikasi: method
          };
          return updatedBooking;
        }
        return b;
      });

      if (!foundExisting && targetObj) {
        updatedBooking = {
          ...targetObj,
          status_kunjungan: 'Sedang Berkunjung',
          jam_masuk_aktual: clock.jam_menit_detik,
          jam_checkin_aktual: clock.jam_menit,
          metode_verifikasi: method
        };
        const updatedList = [updatedBooking, ...prev];
        try {
          localStorage.setItem('sr_visit_bookings', JSON.stringify(updatedList));
        } catch (e) {}
        return updatedList;
      }

      try {
        localStorage.setItem('sr_visit_bookings', JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    if (updatedBooking) {
      // 1. Simpan ke database Supabase agar tersinkron lintas device/browser
      syncBookingStatusToSupabase(updatedBooking, 'VISIT_CHECKIN');

      // 2. Broadcast ke seluruh tab / halaman secara realtime
      try {
        const bc = new BroadcastChannel('smart_riayah_visit_channel');
        bc.postMessage({ type: 'VISIT_CHECKIN', booking: updatedBooking, scanner: method });
        bc.close();
      } catch (e) {}

      // 3. Kirim notifikasi WA ke nomor wali santri bahwa tamu telah check-in di pos gerbang
      if (updatedBooking.no_wa_penjenguk) {
        const waliAddr = resolveWaliAddressing(updatedBooking.nama_penjenguk || 'Wali Santri', '', [], { namaWali: updatedBooking.nama_penjenguk });
        sendWhatsAppNotification(
          `${updatedBooking.nama_penjenguk} (Wali ${updatedBooking.nama_santri})`,
          updatedBooking.no_wa_penjenguk,
          'VISIT_CHECKIN_GATE',
          `🚪 *[CHECK-IN GERBANG PONDOK BERHASIL]*\nAssalamu'alaikum Wr. Wb. *${waliAddr.panggilan}*.\n\nSelamat datang di Pesantren Modern Darul Ulum. Verifikasi E-Barcode gate pass untuk ananda *${updatedBooking.nama_santri}* (${updatedBooking.kelas}) telah *BERHASIL DICATAT* di Pos Jaga Satpam pada pukul *${clock.jam_menit} WITA*.\n\n⏳ Batas waktu kunjungan hingga pukul *${updatedBooking.jam_selesai || 'selesai'} WITA*. Mohon menjaga ketertiban dan adab bertamu di lingkungan asrama.`
        );
      }
    }

    sound.playSuccess?.();
    return updatedBooking;
  };

  const checkOutVisitBooking = (bookingId) => {
    const clock = getRealtimePondokClock();
    let updatedBooking = null;

    setVisitBookings(prev => {
      const next = prev.map(b => {
        if (b.id === bookingId) {
          updatedBooking = {
            ...b,
            status_kunjungan: 'Selesai',
            jam_keluar_aktual: clock.jam_menit_detik,
            jam_checkout_aktual: clock.jam_menit
          };
          return updatedBooking;
        }
        return b;
      });
      try {
        localStorage.setItem('sr_visit_bookings', JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    if (updatedBooking) {
      // 1. Simpan ke database Supabase
      syncBookingStatusToSupabase(updatedBooking, 'VISIT_CHECKOUT');

      // 2. Kirim pesan terima kasih via WhatsApp ke wali santri
      if (updatedBooking.no_wa_penjenguk) {
        const waliAddr = resolveWaliAddressing(updatedBooking.nama_penjenguk || 'Wali Santri', '', [], { namaWali: updatedBooking.nama_penjenguk });
        sendWhatsAppNotification(
          `${updatedBooking.nama_penjenguk} (Wali ${updatedBooking.nama_santri})`,
          updatedBooking.no_wa_penjenguk,
          'VISIT_CHECKOUT_GATE',
          `✅ *[KUNJUNGAN SELESAI / CHECK-OUT]*\nAssalamu'alaikum Wr. Wb. *${waliAddr.panggilan}*.\n\nTerima kasih telah mengunjungi ananda *${updatedBooking.nama_santri}* di Pesantren Modern Darul Ulum. Data kepulangan/check-out telah dicatat sistem pada pukul *${clock.jam_menit} WITA*.\nSemoga ananda semakin betah dan bersemangat menuntut ilmu. Hati-hati di perjalanan pulang. Barakallahu fiikum.`
        );
      }
    }

    sound.playBeep?.();
    return updatedBooking;
  };

  const verifyVisitBarcode = (tokenOrInput) => {
    if (!tokenOrInput || !tokenOrInput.trim()) {
      return { success: false, message: 'Masukkan kode barcode kunjungan' };
    }
    const clean = tokenOrInput.trim().toUpperCase();
    const booking = visitBookings.find(b => 
      (b.barcode_token && b.barcode_token.toUpperCase() === clean) ||
      (b.id && b.id.toUpperCase() === clean) ||
      (b.no_wa_penjenguk && b.no_wa_penjenguk.includes(clean))
    );

    if (!booking) {
      return { 
        success: false, 
        message: '⛔ TIDAK TERDAFTAR / KODE BARCODE TIDAK VALID',
        isApproved: false
      };
    }

    const clock = getRealtimePondokClock();
    const lifecycle = checkBarcodeLifecycle(booking, clock);

    if (lifecycle.isExpired) {
      return {
        success: false,
        booking,
        message: lifecycle.message,
        isExpired: true,
        alreadyCompleted: lifecycle.status === 'EXPIRED_COMPLETED',
        lifecycle
      };
    }

    if (lifecycle.isBeforeHours) {
      return {
        success: false,
        booking,
        message: lifecycle.message,
        isBeforeHours: true,
        lifecycle
      };
    }

    if (lifecycle.isFuture) {
      return {
        success: false,
        booking,
        message: lifecycle.message,
        isFuture: true,
        lifecycle
      };
    }

    if (lifecycle.isPending) {
      return {
        success: false,
        booking,
        message: lifecycle.message,
        isPending: true,
        isApproved: false,
        lifecycle
      };
    }

    if (lifecycle.isVisiting) {
      return {
        success: true,
        booking,
        message: `✅ STATUS: SEDANG BERKUNJUNG (Check-In Masuk Pukul ${booking.jam_masuk_aktual || booking.jam_checkin_aktual || 'WITA'})`,
        isApproved: true,
        isOngoing: true,
        lifecycle
      };
    }

    return {
      success: true,
      booking,
      message: '✅ VERIFIKASI BERHASIL: Barcode Aktif & Wali Santri Disetujui',
      isApproved: true,
      lifecycle
    };
  };

  const verifyVisitRfid = (uid) => {
    if (!uid) return { success: false, message: 'UID Kartu RFID tidak valid' };
    const cleanUid = uid.trim().toUpperCase();
    
    const booking = visitBookings.find(b => 
      (b.rfid_uid && b.rfid_uid.toUpperCase() === cleanUid) ||
      santriList.some(s => s.rfidUid && s.rfidUid.toUpperCase() === cleanUid && s.nama === b.nama_santri)
    );

    if (booking) {
      return verifyVisitBarcode(booking.barcode_token || booking.id);
    }

    const santri = santriList.find(s => s.rfidUid && s.rfidUid.toUpperCase() === cleanUid);
    if (santri) {
      return {
        success: true,
        santri,
        isSantriCard: true,
        message: `✅ Kartu Santri ${santri.nama} (${santri.kelas}) terdeteksi di Pos Satpam.`
      };
    }

    return { success: false, message: '⛔ KARTU RFID TIDAK TERDAFTAR DI DATABASE PONDOK' };
  };

  // Pure Read-Only Lookup Kupon Kunjungan (Untuk HP Wali Santri — Tanpa Auto-Check-in)
  const lookupVisitBooking = (token) => {
    if (!token) return { success: false, message: 'Kode kupon gate pass tidak valid', booking: null };
    const clean = String(token).trim().toUpperCase();
    const clock = getRealtimePondokClock();

    const isCleanTest = clean.includes('TEST');

    // 1. Exact match barcode_token atau ID
    let booking = (visitBookings || []).find(b => 
      (b.barcode_token && b.barcode_token.toUpperCase() === clean) ||
      (b.id && b.id.toUpperCase() === clean)
    );

    // 2. Substring match
    if (!booking) {
      booking = (visitBookings || []).find(b => {
        const bToken = String(b.barcode_token || '').toUpperCase();
        if (!bToken) return false;
        if (!isCleanTest && (bToken.includes('TEST') || String(b.id || '').includes('TEST') || /simulasi/i.test(b.titipan_barang))) return false;
        return clean.includes(bToken) || bToken.includes(clean);
      });
    }

    // Smart fuzzy match berdasarkan nama santri di dalam token tiket (GP-DU-[NAMA]-...)
    if (!booking) {
      const tokenMatch = clean.match(/^GP[-_]DU[-_]([A-Z0-9]+?)(?:[-_]\d+)?$/i);
      if (tokenMatch && tokenMatch[1]) {
        const namePart = tokenMatch[1].toUpperCase();
        const candidates = (visitBookings || []).filter(b => {
          if (!isCleanTest && (String(b.barcode_token || '').includes('TEST') || String(b.id || '').includes('TEST') || /simulasi/i.test(b.titipan_barang))) return false;
          const bSantri = String(b.nama_santri || '').toUpperCase().replace(/[^A-Z]/g, '');
          const bToken = String(b.barcode_token || '').toUpperCase();
          if (bSantri && (bSantri.includes(namePart) || namePart.includes(bSantri.slice(0, 5)))) return true;
          if (bToken && (bToken.includes(namePart) || namePart.includes(bToken.replace(/^GP[-_]DU[-_]/, '').split(/[-_]/)[0]))) return true;
          return false;
        });

        if (candidates.length > 0) {
          candidates.sort((a, b) => {
            const rankStatus = (st) => {
              if (st === 'Sedang Berkunjung' || String(st).includes('Sedang Berkunjung')) return 10;
              if (String(st).includes('Disetujui')) return 8;
              if (String(st).includes('Menunggu')) return 5;
              return 1;
            };
            const rA = rankStatus(a.status_kunjungan);
            const rB = rankStatus(b.status_kunjungan);
            if (rA !== rB) return rB - rA;
            return (Date.parse(b.created_at || b.updated_at || 0) || 0) - (Date.parse(a.created_at || a.updated_at || 0) || 0);
          });
          booking = candidates[0];
        }
      }
    }

    // Fallback: Jika tiket GP-DU berasal dari bot resmi tapi belum tersinkron, cocokkan dari santriList
    if (!booking) {
      const tokenMatch = clean.match(/^GP[-_]DU[-_]([A-Z0-9]+?)(?:[-_]\d+)?$/i);
      if (tokenMatch && tokenMatch[1] && Array.isArray(santriList)) {
        const namePart = tokenMatch[1].toUpperCase();
        const matchedSantri = santriList.find(s => {
          const sName = String(s.nama || '').toUpperCase().replace(/[^A-Z]/g, '');
          return sName.includes(namePart) || namePart.includes(sName.slice(0, 5));
        });
        if (matchedSantri) {
          booking = {
            id: `VST-AUTO-${clean.replace(/[^A-Z0-9]/g, '')}`,
            barcode_token: clean,
            nama_santri: matchedSantri.nama,
            kelas: matchedSantri.kelas,
            kamar: matchedSantri.kamar || matchedSantri.asrama || 'Asrama Pondok',
            asal: matchedSantri.asal || 'Surabaya',
            tanggal_kunjungan: clock.tanggal_ymd,
            hari_kunjungan: clock.nama_hari,
            jam_kunjungan: '09:00',
            jam_selesai: '17:00',
            titipan_barang: 'Titipan Wali Santri (Maks 5 Kg)',
            berat_barang_kg: 1.0,
            nama_penjenguk: matchedSantri.namaWali || 'Wali Santri',
            status_penjenguk: 'Wali Santri',
            no_wa_penjenguk: matchedSantri.noWali || '',
            approval_type: 'AUTO_WEEKEND',
            status_kunjungan: 'Disetujui (Siap Datang)',
            waktu_disetujui: `${clock.nama_hari}, ${clock.tanggal_lengkap} • ${clock.jam_menit} WITA`,
            created_at: new Date().toISOString()
          };
        }
      }
    }

    if (!booking) {
      return {
        success: false,
        message: '⛔ TIKET TIDAK DITEMUKAN / KODE KUPON TIDAK TERDAFTAR',
        booking: null,
        isApproved: false
      };
    }

    const lifecycle = checkBarcodeLifecycle(booking, clock);
    const isOngoing = booking.status_kunjungan === 'Sedang Berkunjung' || booking.status_kunjungan?.includes('Sedang Berkunjung');
    const isDone = booking.status_kunjungan === 'Selesai';
    const isApproved = (booking.status_kunjungan === 'Disetujui (Siap Datang)' || booking.status_kunjungan?.includes('Disetujui')) && !isOngoing && !isDone;

    return {
      success: true,
      booking,
      lifecycle,
      isExpired: lifecycle.isExpired || isDone,
      isBeforeHours: lifecycle.isBeforeHours,
      isFuture: lifecycle.isFuture,
      isPending: lifecycle.isPending,
      isApproved,
      isOngoing,
      isDone,
      message: lifecycle.isExpired ? '⛔ MASA BERLAKU KUPON TELAH HABIS / SELESAI DIGUNAKAN' : '✅ KUPON RESMI AKTIF'
    };
  };

  const verifyAndScanTicket = (token) => {
    if (!token) return { success: false, message: 'Kode kupon gate pass tidak valid' };
    const clean = String(token).trim().toUpperCase();
    const clock = getRealtimePondokClock();
    const formattedScanTime = `${clock.nama_hari}, ${clock.tanggal_lengkap} • ${clock.jam_menit_detik} WITA`;

    const isCleanTest = clean.includes('TEST');

    // 1. Exact match barcode_token atau id
    let booking = (visitBookings || []).find(b => 
      (b.barcode_token && b.barcode_token.toUpperCase() === clean) ||
      (b.id && b.id.toUpperCase() === clean)
    );

    // 2. Substring match
    if (!booking) {
      booking = (visitBookings || []).find(b => {
        const bToken = String(b.barcode_token || '').toUpperCase();
        if (!bToken) return false;
        if (!isCleanTest && (bToken.includes('TEST') || String(b.id || '').includes('TEST') || /simulasi/i.test(b.titipan_barang))) return false;
        return clean.includes(bToken) || bToken.includes(clean);
      });
    }

    // Smart fuzzy match berdasarkan nama santri di token
    if (!booking) {
      const tokenMatch = clean.match(/^GP[-_]DU[-_]([A-Z0-9]+?)(?:[-_]\d+)?$/i);
      if (tokenMatch && tokenMatch[1]) {
        const namePart = tokenMatch[1].toUpperCase();
        const candidates = (visitBookings || []).filter(b => {
          if (!isCleanTest && (String(b.barcode_token || '').includes('TEST') || String(b.id || '').includes('TEST') || /simulasi/i.test(b.titipan_barang))) return false;
          const bSantri = String(b.nama_santri || '').toUpperCase().replace(/[^A-Z]/g, '');
          const bToken = String(b.barcode_token || '').toUpperCase();
          if (bSantri && (bSantri.includes(namePart) || namePart.includes(bSantri.slice(0, 5)))) return true;
          if (bToken && (bToken.includes(namePart) || namePart.includes(bToken.replace(/^GP[-_]DU[-_]/, '').split(/[-_]/)[0]))) return true;
          return false;
        });

        if (candidates.length > 0) {
          candidates.sort((a, b) => {
            const rankStatus = (st) => {
              if (st === 'Sedang Berkunjung' || String(st).includes('Sedang Berkunjung')) return 10;
              if (String(st).includes('Disetujui')) return 8;
              if (String(st).includes('Menunggu')) return 5;
              return 1;
            };
            const rA = rankStatus(a.status_kunjungan);
            const rB = rankStatus(b.status_kunjungan);
            if (rA !== rB) return rB - rA;
            return (Date.parse(b.created_at || b.updated_at || 0) || 0) - (Date.parse(a.created_at || a.updated_at || 0) || 0);
          });
          booking = candidates[0];
        }
      }
    }

    if (!booking) {
      return {
        success: false,
        message: '⛔ TIKET TIDAK DITEMUKAN / KODE KUPON TIDAK TERDAFTAR',
        booking: null,
        isApproved: false
      };
    }

    const lifecycle = checkBarcodeLifecycle(booking, clock);

    if (lifecycle.isExpired) {
      return {
        success: false,
        message: lifecycle.message,
        booking,
        isExpired: true,
        isDone: lifecycle.status === 'EXPIRED_COMPLETED',
        lifecycle
      };
    }

    if (lifecycle.isBeforeHours) {
      return {
        success: false,
        message: lifecycle.message,
        booking,
        isBeforeHours: true,
        lifecycle
      };
    }

    if (lifecycle.isFuture) {
      return {
        success: false,
        message: lifecycle.message,
        booking,
        isFuture: true,
        lifecycle
      };
    }

    if (lifecycle.isPending) {
      return {
        success: false,
        message: '⏳ MENUNGGU APPROVAL ADMIN RI\'AYAH (KUNJUNGAN HARI KERJA)',
        booking,
        isPending: true,
        isApproved: false,
        lifecycle
      };
    }

    // Jika sudah sedang berkunjung (sudah di-scan sebelumnya)
    if (booking.status_kunjungan === 'Sedang Berkunjung' || booking.status_kunjungan === 'Sedang Berkunjung (Telah Di-Scan)') {
      return {
        success: true,
        message: '✅ TIKET SAH & PENGUNJUNG SEDANG BERADA DI AREA PONDOK',
        booking,
        isOngoing: true,
        isApproved: true,
        lifecycle
      };
    }

    // Tiket sah dan aktif untuk scan check-in: otomatis ubah status & catat waktu scan!
    let updatedBooking = {
      ...booking,
      status_kunjungan: 'Sedang Berkunjung',
      waktu_scan_aktual: formattedScanTime,
      jam_masuk_aktual: booking.jam_masuk_aktual || clock.jam_menit_detik,
      jam_checkin_aktual: booking.jam_checkin_aktual || clock.jam_menit,
      metode_verifikasi: 'SCAN_DIRECT_QR'
    };

    setVisitBookings(prev => {
      const next = prev.map(b => b.id === booking.id ? updatedBooking : b);
      try {
        localStorage.setItem('sr_visit_bookings', JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    syncBookingStatusToSupabase(updatedBooking, 'VISIT_CHECKIN');

    // Broadcast realtime event ke seluruh tab & pos satpam
    try {
      const bc = new BroadcastChannel('smart_riayah_visit_channel');
      bc.postMessage({ type: 'VISIT_CHECKIN', booking: updatedBooking });
      bc.close();
    } catch (e) {}

    if (updatedBooking.no_wa_penjenguk) {
      const waliAddr = resolveWaliAddressing(updatedBooking.nama_penjenguk || 'Wali Santri', '', [], { namaWali: updatedBooking.nama_penjenguk });
      sendWhatsAppNotification(
        `${updatedBooking.nama_penjenguk} (Wali ${updatedBooking.nama_santri})`,
        updatedBooking.no_wa_penjenguk,
        'VISIT_CHECKIN_GATE',
        `🚪 *[TIKET KUNJUNGAN BERHASIL DI-SCAN & CHECK-IN MASUK]*\nAssalamu'alaikum Wr. Wb. *${waliAddr.panggilan}*.\n\nE-Kupon Kunjungan untuk ananda *${updatedBooking.nama_santri}* (${updatedBooking.kelas}) telah *BERHASIL DI-SCAN* di sistem Smart Riayah pada pukul *${clock.jam_menit} WITA*.\n\n⏳ Batas durasi kunjungan hingga pukul *${updatedBooking.jam_selesai || '16:30'} WITA*. Silakan tunjukkan kupon digital kepada Satpam di Pos Jaga Gerbang.`
      );
    }
    sound.playSuccess?.();

    return {
      success: true,
      message: '✅ TIKET KUNJUNGAN SAH & TELAH DI-SCAN',
      booking: updatedBooking,
      isApproved: true,
      isOngoing: true,
      scannedNow: true,
      lifecycle
    };
  };

  /**
   * Mengirim Ulang Barcode Gate Pass ke WhatsApp Wali Santri
   * Khusus untuk kunjungan yang sudah disetujui (baik manual maupun otomatis weekend)
   * Hanya diizinkan jika tiket belum kedaluwarsa & belum selesai.
   */
  const resendBarcodeToWa = (bookingId) => {
    const booking = visitBookings.find(b => b.id === bookingId);
    if (!booking) return { success: false, message: 'Data kunjungan tidak ditemukan.' };

    const clock = getRealtimePondokClock();
    const lifecycle = checkBarcodeLifecycle(booking, clock);

    if (lifecycle.status === 'EXPIRED_COMPLETED' || lifecycle.status === 'EXPIRED_DATE_PAST') {
      sound.playBeep?.();
      return {
        success: false,
        message: `Tidak dapat mengirim ulang: ${lifecycle.message}`,
        isExpired: true
      };
    }

    const token = booking.barcode_token || booking.id;
    const { qrCodeUrl, gatePassUrl } = getVisitGatePassUrls(token);
    const targetPhone = normalizePhone(booking.no_wa_penjenguk || fonnteTargetNumber || '6285960213654') || '6285960213654';
    const waktuKirim = `${clock.jam_menit} WITA`;

    const waliAddr = resolveWaliAddressing(booking.nama_penjenguk || 'Wali Santri', '', [], { namaWali: booking.nama_penjenguk });
    const waMessage = `🎫 *[PENGIRIMAN ULANG TIKET BARCODE KUNJUNGAN - SMART RIAYAH]*\nAssalamu'alaikum Wr. Wb. *${waliAddr.panggilan}*.\n\nBerikut kami kirimkan ulang E-Barcode Gate Pass untuk kunjungan ananda *${booking.nama_santri}* (${booking.kelas || 'Santri'}):\n\n📅 *Jadwal Sambangan:* ${booking.hari_kunjungan}, ${booking.tanggal_kunjungan}\n⏰ *Jam Operasional:* ${booking.jam_kunjungan} - ${booking.jam_selesai || '16:30'} WITA\n📦 *Titipan Barang:* ${booking.titipan_barang || '-'} (${booking.berat_barang_kg || 0} Kg)\n🎫 *Kode Kupon Resmi:* *${token}*\n\n🔗 *Link Kupon & Status Scan (Bisa Diklik Langsung):*\n${gatePassUrl}\n\n📷 *Gambar Kupon QR Gate Pass (Bisa Di-scan Kamera HP):*\n${qrCodeUrl}\n\n_Catatan: Barcode dikirim ulang pada ${waktuKirim}. Tiket hanya berlaku selama jam kunjungan dan otomatis hangus setelah selesai check-out di Pos Satpam._`;

    sendWhatsAppNotification(
      `${booking.nama_penjenguk} (Wali ${booking.nama_santri})`,
      targetPhone,
      'VISIT_RESEND_BARCODE',
      waMessage,
      qrCodeUrl
    );

    const updated = {
      ...booking,
      waktu_kirim_ulang_wa: waktuKirim,
      barcode_image_url: qrCodeUrl,
      gate_pass_url: gatePassUrl
    };

    setVisitBookings(prev => {
      const next = prev.map(b => b.id === bookingId ? updated : b);
      try {
        localStorage.setItem('sr_visit_bookings', JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    syncBookingStatusToSupabase(updated, 'VISIT_RESEND_BARCODE');
    sound.playSuccess?.();

    return {
      success: true,
      message: `Barcode kunjungan berhasil dikirim ulang ke nomor WhatsApp Wali Santri ${targetPhone}!`,
      waktuKirim
    };
  };


  const simulateWaBooking = (dayType = 'WEEKEND') => {
    const isWeekend = dayType === 'WEEKEND';
    const today = new Date();
    const targetDate = new Date();
    if (isWeekend) {
      targetDate.setDate(today.getDate() + ((5 - today.getDay() + 7) % 7 || 7));
    } else {
      targetDate.setDate(today.getDate() + ((4 - today.getDay() + 7) % 7 || 7));
    }
    const tglStr = targetDate.toISOString().slice(0, 10);
    const hariStr = getDayName(tglStr);

    const sampleSantri = santriList[Math.floor(Math.random() * Math.min(santriList.length, 5))] || santriList[0];

    const sampleItems = [
      { titip: 'Kitab Kuning, Pakaian Baru, Madu Herbal & Susu Steril', berat: 3.2 },
      { titip: 'Kacamata baca santri, Vitamin C, & Uang Saku', berat: 1.5 },
      { titip: 'Buku Pelajaran Madrasah, Sarung Sutra & Roti Bolu', berat: 2.8 },
      { titip: 'Sepatu Olahraga, Sabun Mandi & Buah-buahan', berat: 4.5 }
    ];
    const picked = sampleItems[Math.floor(Math.random() * sampleItems.length)];

    return addVisitBooking({
      booking_source: 'WHATSAPP',
      nama_santri: sampleSantri.nama,
      kelas: `${sampleSantri.kelas} (${sampleSantri.kamar})`,
      asal: sampleSantri.wali?.alamat?.split(',')?.pop()?.trim() || 'Surabaya',
      tanggal_kunjungan: tglStr,
      hari_kunjungan: hariStr,
      jam_kunjungan: '14:00',
      jam_selesai: '15:30',
      titipan_barang: picked.titip,
      berat_barang_kg: picked.berat,
      nama_penjenguk: sampleSantri.wali?.nama || sampleSantri.namaWali || 'Wali Santri',
      status_penjenguk: 'Wali Santri',
      no_wa_penjenguk: normalizePhone(sampleSantri.wali?.telepon || sampleSantri.noWali || fonnteTargetNumber || '6285960213654') || '6285960213654',
      rfid_uid: sampleSantri.rfidUid
    });
  };

  // ─── PENGURUS OSIS: SISTEM PELAPORAN KELAKUAN SANTRI/WATI SE-PONDOK (CRUD PENUH DB) ───
  const submitOsisReport = (reportData) => {
    const clock = getRealtimePondokClock();
    const nowIso = new Date().toISOString();
    const newReport = {
      id: `OSIS-${Date.now().toString().slice(-6)}`,
      santriId: reportData.santriId,
      santriNama: reportData.santriNama,
      gender: reportData.gender || 'L',
      kelas: reportData.kelas || '',
      kamar: reportData.kamar || '',
      bidangOsis: reportData.bidangOsis || 'OSIS Kamtib',
      pelaporNama: reportData.pelaporNama || (currentUser?.nama || 'Pengurus OSIS'),
      kategori: reportData.kategori || 'PELANGGARAN', // 'PELANGGARAN' | 'PRESTASI' | 'IBADAH'
      jenis: reportData.jenis || 'Catatan Kedisiplinan',
      keterangan: reportData.keterangan || '',
      poin: Number(reportData.poin || 0),
      tazir: reportData.tazir || reportData.tindakan || '',
      status: 'PENDING_ADMIN',
      tanggal: reportData.tanggal || clock.tanggal_ymd,
      waktu: reportData.waktu || clock.jam_menit,
      created_at: nowIso,
      updated_at: nowIso
    };

    const nextReports = [newReport, ...osisReports];
    setOsisReports(prev => {
      const updated = [newReport, ...prev.filter(r => r.id !== newReport.id)];
      try { localStorage.setItem('sr_osis_reports', JSON.stringify(updated)); } catch {}
      return updated;
    });

    // Simpan persisten secara asinkron (non-blocking) ke Supabase & MongoDB CRUD API
    createOsisReportInDb(newReport).catch((e) => {
      console.warn('createOsisReportInDb async warning:', e?.message || e);
    });

    // Siarkan ke seluruh tab & perangkat via Supabase Realtime & BroadcastChannel
    try {
      const waChannel = supabase.channel('whatsapp-room');
      waChannel.send({
        type: 'broadcast',
        event: 'osis.report_created',
        payload: newReport
      });
    } catch (e) {
      console.warn('Realtime broadcast osis.report_created error:', e);
    }

    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('smart_riayah_sync_channel');
        bc.postMessage({
          type: 'STATE_UPDATE',
          version: Date.now(),
          payload: { osisReports: nextReports }
        });
        bc.close();
      }
    } catch (e) {}

    sound.playSuccess?.();
    return newReport;
  };

  const updateOsisReport = (reportId, updatedFields = {}) => {
    const existing = osisReports.find(r => r.id === reportId);
    if (!existing) return null;

    const nowIso = new Date().toISOString();
    const updatedReport = {
      ...existing,
      ...updatedFields,
      id: existing.id,
      poin: updatedFields.poin !== undefined ? Number(updatedFields.poin) : Number(existing.poin || 0),
      updated_at: nowIso
    };

    const nextReports = osisReports.map(r => (r.id === reportId ? updatedReport : r));
    setOsisReports(prev => {
      const updated = prev.map(r => (r.id === reportId ? updatedReport : r));
      try { localStorage.setItem('sr_osis_reports', JSON.stringify(updated)); } catch {}
      return updated;
    });

    // Sinkronkan pembaruan poin santri bila laporan ini sudah berstatus APPROVED dan poin diubah
    if (existing.status === 'APPROVED' && updatedFields.poin !== undefined) {
      const oldPoin = Number(existing.poin || 0);
      const newPoin = Number(updatedReport.poin || 0);
      const poinDelta = newPoin - oldPoin;
      if (poinDelta !== 0 && existing.santriId) {
        const targetSantri = santriList.find(s => s.id === existing.santriId);
        if (targetSantri) {
          const adjustedPoints = Math.max(0, Math.min(100, (targetSantri.poinDisiplin ?? 100) + poinDelta));
          setSantriList(prev => prev.map(s => (s.id === existing.santriId ? { ...s, poinDisiplin: adjustedPoints } : s)));
          syncSantriToSupabase({ ...targetSantri, poinDisiplin: adjustedPoints });
        }
      }
    }

    // Update persisten di Supabase & MongoDB CRUD API
    updateOsisReportInDb(updatedReport).catch((e) => {
      console.warn('updateOsisReportInDb async warning:', e?.message || e);
    });

    try {
      const waChannel = supabase.channel('whatsapp-room');
      waChannel.send({
        type: 'broadcast',
        event: 'osis.report_updated',
        payload: updatedReport
      });
    } catch (e) {}

    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('smart_riayah_sync_channel');
        bc.postMessage({
          type: 'STATE_UPDATE',
          version: Date.now(),
          payload: { osisReports: nextReports }
        });
        bc.close();
      }
    } catch (e) {}

    sound.playSuccess?.();
    return updatedReport;
  };

  const deleteOsisReport = (reportId) => {
    if (!reportId) return false;
    markOsisIdDeleted(reportId);

    const remaining = osisReports.filter(r => r.id !== reportId);
    setOsisReports(remaining);
    try {
      localStorage.setItem('sr_osis_reports', JSON.stringify(remaining));
    } catch {}

    // Hapus persisten di Supabase & MongoDB CRUD API
    deleteOsisReportFromDb(reportId).catch((e) => {
      console.warn('deleteOsisReportFromDb async warning:', e?.message || e);
    });

    try {
      const waChannel = supabase.channel('whatsapp-room');
      waChannel.send({
        type: 'broadcast',
        event: 'osis.report_deleted',
        payload: { id: reportId }
      });
    } catch (e) {}

    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('smart_riayah_sync_channel');
        bc.postMessage({
          type: 'STATE_UPDATE',
          version: Date.now(),
          payload: { osisReports: remaining }
        });
        bc.close();
      }
    } catch (e) {}

    sound.playBeep?.();
    return true;
  };

  const verifyOsisReport = (reportId, action = 'APPROVE', refinedData = {}) => {
    const clock = getRealtimePondokClock();
    const existingReport = osisReports.find(rep => rep.id === reportId);
    if (!existingReport) return null;

    const nowIso = new Date().toISOString();
    const wasAlreadyApproved = existingReport.status === 'APPROVED';

    const targetReport = {
      ...existingReport,
      status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      jenis: refinedData.jenis !== undefined ? refinedData.jenis : existingReport.jenis,
      keterangan: refinedData.keterangan !== undefined ? refinedData.keterangan : existingReport.keterangan,
      poin: refinedData.poin !== undefined ? Number(refinedData.poin) : Number(existingReport.poin || 0),
      tazir: refinedData.tazir !== undefined ? refinedData.tazir : existingReport.tazir,
      adminNote: refinedData.adminNote || (action === 'APPROVE' ? 'Disetujui resmi oleh Admin Ri\'ayah' : 'Ditolak oleh Admin Ri\'ayah'),
      verified_at: nowIso,
      verified_by: currentUser?.nama || 'Admin Ri\'ayah',
      updated_at: nowIso
    };

    const nextReports = osisReports.map(rep => (rep.id === reportId ? targetReport : rep));
    setOsisReports(prev => {
      const updated = prev.map(rep => (rep.id === reportId ? targetReport : rep));
      try { localStorage.setItem('sr_osis_reports', JSON.stringify(updated)); } catch {}
      return updated;
    });

    // Update status persisten di Supabase & MongoDB
    updateOsisReportInDb(targetReport).catch((e) => {
      console.warn('verifyOsisReport updateOsisReportInDb warning:', e?.message || e);
    });

    // Siarkan status verifikasi ke seluruh tab & perangkat
    try {
      const waChannel = supabase.channel('whatsapp-room');
      waChannel.send({
        type: 'broadcast',
        event: 'osis.report_verified',
        payload: targetReport
      });
    } catch (e) {}

    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('smart_riayah_sync_channel');
        bc.postMessage({
          type: 'STATE_UPDATE',
          version: Date.now(),
          payload: { osisReports: nextReports }
        });
        bc.close();
      }
    } catch (e) {}

    if (action === 'APPROVE' && !wasAlreadyApproved) {
      // 1. Masukkan ke catatan disiplin resmi pondok
      const poinValue = Number(targetReport.poin || 0);
      const categoryLabel = poinValue < 0 ? 'Pelanggaran' : 'Prestasi';
      
      const officialDiscipline = {
        id: `DISC-${Date.now().toString().slice(-4)}`,
        santriId: targetReport.santriId,
        santriNama: targetReport.santriNama,
        tanggal: clock.tanggal_ymd,
        waktu: clock.jam_menit,
        jenis: targetReport.jenis,
        kategori: categoryLabel,
        poin: poinValue,
        deskripsi: targetReport.keterangan,
        tindakan: targetReport.tazir || 'Pembinaan Asrama',
        pencatat: `Pengurus ${targetReport.bidangOsis} (${targetReport.pelaporNama || 'Kamtib'}) • Verifikasi Admin Ri'ayah`
      };

      setDisciplineRecords(prev => [officialDiscipline, ...prev]);
      syncDisciplineToSupabase(officialDiscipline);

      // 2. Update poin disiplin santri di state & Supabase
      const targetSantri = santriList.find(s => s.id === targetReport.santriId);
      if (targetSantri) {
        const updatedPoints = Math.max(0, Math.min(100, (targetSantri.poinDisiplin ?? 100) + poinValue));
        syncSantriToSupabase({
          ...targetSantri,
          poinDisiplin: updatedPoints
        });

        setSantriList(prev => prev.map(s => {
          if (s.id === targetReport.santriId) {
            return { ...s, poinDisiplin: updatedPoints };
          }
          return s;
        }));

        // 3. Notifikasi WhatsApp ke Wali Santri jika disetujui
        if (targetSantri.wali?.telepon || targetSantri.waliTelepon) {
          const noWa = targetSantri.wali?.telepon || targetSantri.waliTelepon;
          const statusIcon = poinValue < 0 ? '⚠️' : '🌟';
          const waliAddr = resolveWaliAddressing(targetSantri.wali?.nama || 'Wali Santri', '', [], { namaWali: targetSantri.wali?.nama });
          sendWhatsAppNotification(
            `${targetSantri.wali?.nama || 'Wali Santri'} (Wali ${targetReport.santriNama})`,
            noWa,
            'DISCIPLINE_NOTICE',
            `${statusIcon} *[CATATAN RESMI KEDISIPLINAN & PERILAKU SANTRI]*\nAssalamu'alaikum Wr. Wb. *${waliAddr.panggilan}* (Wali dari *${targetReport.santriNama}* - ${targetReport.kelas || targetSantri.kelas}).\n\nTercatat laporan ${categoryLabel.toLowerCase()} santri oleh *${targetReport.bidangOsis}* yang telah diverifikasi resmi oleh Biro Pengasuhan Santri (Admin Ri'ayah):\n\n• *Perihal:* ${targetReport.jenis}\n• *Keterangan:* ${targetReport.keterangan}\n• *Penyesuaian Poin:* ${poinValue > 0 ? '+' : ''}${poinValue} Poin\n• *Sisa Poin Disiplin:* ${updatedPoints}/100 Poin\n${targetReport.tazir ? `• *Arahan / Tindakan:* ${targetReport.tazir}\n` : ''}\nMohon dukungan dan doa dari ${waliAddr.sapaan} agar ananda senantiasa istiqomah dalam menuntut ilmu dan berakhlak mulia di pondok.`
          );
        }
      }

      sound.playSuccess?.();
    } else {
      sound.playBeep?.();
    }

    return targetReport;
  };

  // Reset to seed data
  const resetAllDataToDefault = () => {
    localStorage.clear();
    setAccounts(INITIAL_ACCOUNTS);
    setSantriList(INITIAL_SANTRI);
    setPermits(INITIAL_PERMITS);
    setGateLogs(INITIAL_GATE_LOGS);
    setDisciplineRecords(INITIAL_DISCIPLINE);
    setMutabaahList(INITIAL_MUTABAAH);
    setMedicalRecords(INITIAL_MEDICAL_RECORDS);
    setRooms(INITIAL_ROOMS);
    setRfidTransactions(INITIAL_RFID_TRANSACTIONS);
    setWhatsappLogs(INITIAL_WHATSAPP_LOGS);
    setBlacklistedUids(INITIAL_BLACKLIST);
    setVisitBookings(INITIAL_VISIT_BOOKINGS);
    setVisitSettings(INITIAL_VISIT_SETTINGS);
    setKnowledgeList(INITIAL_KNOWLEDGE_BASE);
    setOsisReports(INITIAL_OSIS_REPORTS);
    setActiveSantriId('S-101');
    sound.playSuccess();
  };

  return (
    <AppContext.Provider
      value={{
        // Auth & Navigation
        accounts,
        setAccounts,
        isAuthenticated,
        setIsAuthenticated,
        currentUser,
        setCurrentUser,
        currentView,
        setCurrentView,
        loginRoleTarget,
        setLoginRoleTarget,
        login,
        logout,
        navigateTo,
        switchRoleWithAuth,
        updateAccount,
        addAccount,

        // Core Roles & Entities
        role,
        setRole,
        activeRoleTab,
        setActiveRoleTab,
        activeSantriId,
        setActiveSantriId,
        santriList,
        permits,
        gateLogs,
        disciplineRecords,
        mutabaahList,
        medicalRecords,
        rooms,
        rfidTransactions,
        whatsappLogs,
        setWhatsappLogs,
        blacklistedUids,
        setBlacklistedUids,

        // Setting Builder & Dormitory Admin
        addBuilding,
        addRoom,
        updateRoomCapacity,
        updateRoom,
        deleteRoom,
        assignSantriToRoom,
        removeSantriFromRoom,
        moveSantriRoom,
        addNewSantri,
        deleteSantri,
        deletePermit,
        replaceLostCard,
        unblockCard,
        setHardwareScanCallback,
        hardwareScanCallback: hardwareScanListenerRef.current,

        // Hardware & Database Manager
        exportSystemData,
        importSystemData,

        // UI Modals, Drawers & Sidebar
        isWaDrawerOpen,
        setIsWaDrawerOpen,
        engageActiveTab,
        setEngageActiveTab,
        navigateToAiInbox,
        unreadWaCount,
        setUnreadWaCount,
        isRfidModalOpen,
        setIsRfidModalOpen,
        isSerialMonitorOpen,
        setIsSerialMonitorOpen,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        isMobileSidebarOpen,
        setIsMobileSidebarOpen,
        gateState,
        setGateState,
        lastScannedUid,
        setLastScannedUid,
        lastScannedTime,
        isSerialConnected,
        isRfidModuleEnabled,
        setIsRfidModuleEnabled,
        serialRawLogs,
        isRfidManagerModalOpen,
        setIsRfidManagerModalOpen,
        highlightedSantriId,
        setHighlightedSantriId,
        oledState,
        setOledState,

        // Actuators & Processes
        processRfidTap,
        linkCardToSantri,
        registerNewSantriCard,
        updateSantriCard,
        connectSerial,
        disconnectSerial,
        sendCustomCommand,
        submitPermit,
        approvePermit,
        rejectPermit,
        createExpressPermit,
        tapGateRFID,
        reminderThresholdMinutes,
        setReminderThresholdMinutes,
        isAutoSendWaReminder,
        setIsAutoSendWaReminder,
        isAlarmSoundEnabled,
        setIsAlarmSoundEnabled,
        sendEarlyWarningReminder,
        broadcastAllWarningReminders,
        simulateSantriNearExpiry,
        triggerYellowLedVirtual,
        simulateWarning30Min,
        simulateOverdue,
        addDisciplineRecord,
        addMedicalRecord,
        referToHospital,
        setDailySpendLimit,
        addCashlessTransaction,
        resetAllDataToDefault,
        sendWhatsAppNotification,

        // Live Fonnte WhatsApp Gateway
        fonnteToken,
        setFonnteToken,
        fonnteTargetNumber,
        setFonnteTargetNumber,
        isFonnteEnabled,
        setIsFonnteEnabled,
        lastFonnteLatency,
        isSendingFonnte,
        fonnteStatus,
        sendFonnteWhatsApp,
        testFonnteWhatsApp,

        // 13b. AI Inbox Chat Logs & 03:00 WITA Purge Scheduler
        chatLogs,
        setChatLogs,
        manualReplyNeededCount,
        lastChatPurgeSummary,
        purgeOldChatLogs,
        sendManualReplyToChat,
        takeOverChatManual,
        resolveChatManual,

        // 14. Visit Booking & WhatsApp Gate Pass
        visitBookings,
        setVisitBookings,
        visitSettings,
        setVisitSettings,
        updateVisitSettings,
        addVisitBooking,
        approveVisitBooking,
        rejectVisitBooking,
        resendBarcodeToWa,
        checkInVisitBooking,
        checkOutVisitBooking,
        verifyVisitBarcode,
        verifyVisitRfid,
        lookupVisitBooking,
        verifyAndScanTicket,
        activeGatePassToken,
        setActiveGatePassToken,
        openGatePass,
        clearGatePassToken,
        simulateWaBooking,
        sendVisitWarningReminder,
        broadcastAllVisitWarningReminders,
        simulateVisitNearExpiry,

        // DeepSeek AI Character & Activity Engine
        deepseekToken,
        setDeepseekToken,
        deepseekModel,
        setDeepseekModel,
        testDeepSeekConnection,
        isAiAgentOpen,
        setIsAiAgentOpen,
        aiAgentActiveSantriId,
        setAiAgentActiveSantriId,
        openAiAgentForSantri,

        // 15. Knowledge Base & Bulk CSV Importers
        knowledgeList,
        setKnowledgeList,
        addKnowledgeItem,
        bulkImportKnowledge,
        bulkImportSantri,
        bulkImportRfid,
        bulkImportCustomers,
        OFFICIAL_TOPIC_GROUPS,
        buildVisitingHoursAndRulesReply,

        // 16. OSIS Discipline Reports Engine (Full Database CRUD)
        osisReports,
        setOsisReports,
        submitOsisReport,
        verifyOsisReport,
        updateOsisReport,
        deleteOsisReport
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);

