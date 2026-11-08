import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { sound } from '../utils/audio';
import { webSerial } from '../utils/webSerial';
import { DEFAULT_DEEPSEEK_TOKEN, testDeepSeekConnection } from '../utils/deepseekApi';
import { getRealtimePondokClock, checkBarcodeLifecycle } from '../utils/pondokTimeUtils';
import {
  generateBarcodeToken,
  getGatePassDirectUrl,
  getVisitGatePassUrls,
  getGatePassTokenFromUrl
} from '../utils/barcodeUtils';
import { deleteRoomData } from '../utils/roomService';
import { deleteSantriData } from '../utils/santriService';
import { supabase } from '../utils/supabaseClient';
import { syncRoomToFirebase } from '../utils/firebaseSync';
import { sendWhatsAppBroadcast } from '../utils/whatsappRealtime';
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
  syncBookingStatusToSupabase
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
      case 'musyrif': return 'approval';
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
      const fullList = missing.length > 0 ? [...parsed, ...missing] : parsed;
      const res = autoConsolidateSantriAndPermits(fullList, []);
      return res.santriList;
    } catch {
      return INITIAL_SANTRI;
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

  // ─── RIWAYAT CHAT INBOX WHATSAPP & AUTO-DELETE RETENSI 24 JAM (03.00 WITA) ───
  const [chatLogs, setChatLogs] = useState(() => {
    try {
      const saved = localStorage.getItem('sr_chat_logs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}

    const now = Date.now();
    return [
      {
        id: 'chat-1',
        name: 'Ibu Fatimah Az-Zahra',
        santri: 'Ahmad Fauzi (Kamar Umar 204)',
        sender_phone: '628813576012',
        phone: '+62 881-3576-012',
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
          { id: 'm-1', sender: 'wali', time: '11:38 WITA', text: "Assalamu'alaikum ustadz, bagaimana kabar ananda Ahmad Fauzi hari ini?", timestamp: new Date(now - 3600000).toISOString() },
          { id: 'm-2', sender: 'ai', time: '11:39 WITA', text: "Wa'alaikumsalam warahmatullah, Ibu Fatimah. Ananda Ahmad Fauzi sehat wal'afiat dan tercatat hadir sholat Subuh berjamaah tepat waktu.", timestamp: new Date(now - 3500000).toISOString() },
          { id: 'm-3', sender: 'wali', time: '11:40 WITA', text: "Alhamdulillah, terima kasih banyak atas infonya Ustadz.", timestamp: new Date(now - 1800000).toISOString() }
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

  const sendManualReplyToChat = (chatId, replyText) => {
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

    if (targetChat && (targetChat.phone || targetChat.sender_phone)) {
      sendWhatsAppNotification(
        targetChat.name,
        targetChat.sender_phone || targetChat.phone,
        'ADMIN_MANUAL_REPLY',
        `*[PESANTREN MODERN DARUL ULUM - BALASAN ADMIN]*\nAssalamu'alaikum Wr. Wb. Bapak/Ibu ${targetChat.name}.\n\n${replyText.trim()}\n\n_Pesan ini dikirim langsung oleh Pengasuhan/Admin Ri'ayah Pondok._`
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
    return saved;
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
    setFonnteTargetNumberState(val);
    localStorage.setItem('sr_fonnte_target', val);
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

  // 5b. Musyrif Early-Warning & Alarm Reminder System Settings
  const [reminderThresholdMinutes, setReminderThresholdMinutes] = useState(() => {
    const saved = localStorage.getItem('sr_reminder_threshold');
    return saved ? Number(saved) : 30; // Default H-30 Menit
  });

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
  }, []);

  // =========================================================================
  // 6. Cross-Tab & Cross-Browser Real-Time Sync Engine
  // =========================================================================
  const isApplyingRemoteSync = useRef(false);
  const syncVersionRef = useRef(0);
  const isServerSyncSupportedRef = useRef(true);

  // Apply synced data payload to state
  const applySyncedData = useCallback((payload) => {
    if (!payload) return;
    isApplyingRemoteSync.current = true;
    try {
      let incomingSantri = payload.santriList;
      let incomingPermits = payload.permits;
      if (Array.isArray(incomingSantri) && Array.isArray(incomingPermits)) {
        const consolidated = autoConsolidateSantriAndPermits(incomingSantri, incomingPermits);
        incomingSantri = consolidated.santriList;
        incomingPermits = consolidated.permits;
      }
      if (Array.isArray(incomingSantri)) setSantriList(incomingSantri);
      if (Array.isArray(incomingPermits)) setPermits(incomingPermits);
      if (Array.isArray(payload.gateLogs)) setGateLogs(payload.gateLogs);
      if (Array.isArray(payload.disciplineRecords)) setDisciplineRecords(payload.disciplineRecords);
      if (Array.isArray(payload.mutabaahList)) setMutabaahList(payload.mutabaahList);
      if (Array.isArray(payload.medicalRecords)) setMedicalRecords(payload.medicalRecords);
      if (Array.isArray(payload.rooms)) setRooms(payload.rooms);
      if (Array.isArray(payload.rfidTransactions)) setRfidTransactions(payload.rfidTransactions);
      if (Array.isArray(payload.whatsappLogs)) setWhatsappLogs(payload.whatsappLogs);
      if (Array.isArray(payload.blacklistedUids)) setBlacklistedUids(payload.blacklistedUids);
      if (payload.reminderThresholdMinutes) setReminderThresholdMinutes(payload.reminderThresholdMinutes);
      if (payload.version) syncVersionRef.current = payload.version;
    } finally {
      setTimeout(() => {
        isApplyingRemoteSync.current = false;
      }, 150);
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

    // 1. Ambil data awal dari Supabase jika tersedia
    fetchAllDataFromSupabase()
      .then((remoteData) => {
        if (!isMounted || !remoteData) return;
        if (remoteData.santriList?.length) setSantriList(remoteData.santriList);
        if (remoteData.rooms?.length) {
          setRooms(prev => {
            const saved = localStorage.getItem('sr_rooms');
            if (!saved) return remoteData.rooms;
            try {
              const localRooms = JSON.parse(saved);
              if (!Array.isArray(localRooms) || localRooms.length === 0) return remoteData.rooms;
              return remoteData.rooms.map(remote => {
                const local = localRooms.find(l => String(l.id) === String(remote.id));
                if (!local) return remote;
                if (local.updated_at && (!remote.updated_at || new Date(local.updated_at) >= new Date(remote.updated_at))) {
                  return { ...remote, ...local };
                }
                return remote;
              });
            } catch {
              return remoteData.rooms;
            }
          });
        }
        // Ambil data kamar dari backend lokal (PostgreSQL / pgAdmin) jika server aktif
        fetch('/api/rooms')
          .then(res => res.json())
          .then(resData => {
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
        if (remoteData.permits?.length) setPermits(remoteData.permits);
        if (remoteData.gateLogs?.length) setGateLogs(remoteData.gateLogs);
        if (remoteData.disciplineRecords?.length) setDisciplineRecords(remoteData.disciplineRecords);
        if (remoteData.medicalRecords?.length) setMedicalRecords(remoteData.medicalRecords);
        if (remoteData.rfidTransactions?.length) setRfidTransactions(remoteData.rfidTransactions);
        if (remoteData.mutabaahList?.length) setMutabaahList(remoteData.mutabaahList);
        if (remoteData.visitBookings?.length) {
          setVisitBookings(prev => {
            const remoteMap = new Map();
            remoteData.visitBookings.forEach(b => remoteMap.set(b.id, b));
            const merged = [...remoteData.visitBookings];
            (prev || []).forEach(local => {
              if (!remoteMap.has(local.id)) {
                merged.push(local);
              }
            });
            try {
              localStorage.setItem('sr_visit_bookings', JSON.stringify(merged));
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
      })
      .catch((err) => {
        console.warn('⚠️ Gagal fetch data awal Supabase (fallback ke cache):', err);
      });

    // 2. Berlangganan Realtime Postgres Changes seluruh kategori tabel Supabase
    const unsubscribe = subscribeToAllTablesRealtime({
      onSantriChange: (payload) => {
        if (!isMounted) return;
        if (payload.eventType === 'INSERT' && payload.new) {
          const item = dbToSantri(payload.new);
          setSantriList(prev => [item, ...prev.filter(s => s.id !== item.id)]);
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          const item = dbToSantri(payload.new);
          setSantriList(prev => prev.map(s => s.id === item.id ? { ...s, ...item } : s));
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
              const bookingData = { ...booking, _supabaseMessageId: payload.new.id };
              if (payload.eventType === 'INSERT') {
                sound.playSuccess?.();
                setVisitBookings(prev => {
                  const exists = prev.some(item => item.id === booking.id);
                  const updated = exists 
                    ? prev.map(item => item.id === booking.id ? bookingData : item)
                    : [bookingData, ...prev];
                  try {
                    localStorage.setItem('sr_visit_bookings', JSON.stringify(updated));
                  } catch (e) {}
                  return updated;
                });
              } else if (payload.eventType === 'UPDATE') {
                setVisitBookings(prev => {
                  const updated = prev.map(item => item.id === booking.id ? bookingData : item);
                  try {
                    localStorage.setItem('sr_visit_bookings', JSON.stringify(updated));
                  } catch (e) {}
                  return updated;
                });
              }
            }
          } catch (err) {
            console.warn('Realtime visit_bookings_log error:', err);
          }
          return; // Jangan dimasukkan ke WhatsApp Chat Logs biasa
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
      }
    });

    return () => {
      isMounted = false;
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
          const exists = prev.some(b => b.id === payload.id);
          if (exists) return prev;
          const updated = [payload, ...prev];
          try {
            localStorage.setItem('sr_visit_bookings', JSON.stringify(updated));
          } catch (e) {
            console.warn('Failed to save visit bookings from realtime:', e);
          }
          return updated;
        });
      })
      .on('broadcast', { event: 'whatsapp.visit_booking_updated' }, ({ payload }) => {
        if (!isMounted || !payload?.id) return;
        setVisitBookings(prev => {
          const updated = prev.map(b => b.id === payload.id ? { ...b, ...payload } : b);
          try {
            localStorage.setItem('sr_visit_bookings', JSON.stringify(updated));
          } catch (e) {}
          return updated;
        });
      })
      .subscribe((status) => {
        console.log('📡 [AppContext Supabase Realtime whatsapp-room] Status:', status);
      });

    return () => {
      isMounted = false;
      supabase.removeChannel(waChannel);
    };
  }, []);

  // Direct instant fetch for visit_bookings_log from Supabase on mount
  useEffect(() => {
    let isMounted = true;
    fetchVisitBookingsFromSupabase()
      .then(remoteBookings => {
        if (!isMounted || !Array.isArray(remoteBookings) || remoteBookings.length === 0) return;
        setVisitBookings(prev => {
          const remoteMap = new Map();
          remoteBookings.forEach(b => remoteMap.set(b.id, b));
          const merged = [...remoteBookings];
          (prev || []).forEach(local => {
            if (!remoteMap.has(local.id)) {
              merged.push(local);
            }
          });
          try {
            localStorage.setItem('sr_visit_bookings', JSON.stringify(merged));
          } catch (e) {}
          return merged;
        });
      })
      .catch(err => {
        console.warn('Direct fetch visit bookings warning:', err);
      });

    return () => { isMounted = false; };
  }, []);

  // Server-side sync via /api/sync (Cross-profile, cross-browser, incognito sync)
  useEffect(() => {
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

    // Fast polling to detect updates from other accounts / browser windows
    pollInterval = setInterval(async () => {
      if (!isServerSyncSupportedRef.current || !isMounted) return;
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
                  applySyncedData(fullData.data);
                  syncVersionRef.current = fullData.version;
                }
              }
            }
          }
        }
      } catch {}
    }, 2500);

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [applySyncedData]);

  // Debounced push to /api/sync and BroadcastChannel when local state updates
  useEffect(() => {
    if (isApplyingRemoteSync.current) return;

    const timer = setTimeout(() => {
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
        setWhatsappLogs,
        blacklistedUids,
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
    }, 350);

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

  // Helper to format time now WIB
  const getNowWIB = () => {
    const d = new Date();
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
  };

  const getIsoNow = () => new Date().toISOString();

  // Helper: Ambil nomor HP wali santri secara konsisten & normalisasi ke format 628...
  const resolveWaliPhone = (santri, fallbackNumber = null) => {
    if (!santri) return fallbackNumber || fonnteTargetNumber || '6285960213654';
    const raw = santri.wali?.telepon || santri.no_wali || santri.waliTelepon || santri.noWali || fallbackNumber || '';
    if (!raw) return fonnteTargetNumber || '6285960213654';
    let clean = String(raw).replace(/[^0-9]/g, '');
    if (clean.startsWith('08')) {
      clean = '628' + clean.slice(2);
    } else if (clean.startsWith('8')) {
      clean = '628' + clean.slice(1);
    }
    return clean || fonnteTargetNumber || '6285960213654';
  };

  // 3. FUNGSI PENGIRIMAN OTOMATIS KE API FONNTE (https://api.fonnte.com/send)
  const sendFonnteWhatsApp = async (targetNumber, messageText, eventType = 'GENERAL', mediaUrl = null) => {
    const token = (fonnteToken || defaultFonnteToken || '').trim();
    // Prioritaskan nomor tujuan wali santri aktual, fallback hanya jika nomor kosong
    const rawTarget = targetNumber || fonnteTargetNumber || '6285960213654';
    let cleanTarget = String(rawTarget).replace(/[^0-9]/g, '');
    if (cleanTarget.startsWith('08')) {
      cleanTarget = '628' + cleanTarget.slice(2);
    } else if (cleanTarget.startsWith('8')) {
      cleanTarget = '628' + cleanTarget.slice(1);
    }

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
    let cleanTarget = String(rawTarget).replace(/[^0-9]/g, '');
    if (cleanTarget.startsWith('08')) {
      cleanTarget = '628' + cleanTarget.slice(2);
    } else if (cleanTarget.startsWith('8')) {
      cleanTarget = '628' + cleanTarget.slice(1);
    }

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
    sendWhatsAppNotification(
      `${santri.wali?.nama || 'Wali Santri'} (Wali ${santri.nama})`,
      resolveWaliPhone(santri),
      'PERMIT_SUBMITTED',
      `Assalamu'alaikum ${santri.wali?.nama || 'Bapak/Ibu Wali'}, pengajuan izin ${data.kategori} ananda ${santri.nama} (${santri.kelas}) telah terkirim ke antrean pengasuh asrama. Status: MENUNGGU PERSETUJUAN (PENDING).`
    );
  };

  // 2. Approve Permit (Role: Musyrif & Admin)
  const approvePermit = (permitId, catatan = 'Disetujui. Harap jaga adab santri selama di luar pondok.', customBatasKembali = null) => {
    sound.playSuccess();
    try {
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.8 } });
    } catch {}

    const permit = permits.find(p => p.id === permitId);
    if (!permit) return;
    const santri = santriList.find(s => s.id === permit.santriId);

    const isExtension = permit.status === 'EXTEND_REQUESTED' || permit.is_extension || permit.isExtension;
    const finalBatasKembali = customBatasKembali || permit.requested_return_date || permit.requestedReturnDate || permit.batasKembali;

    const updatedPermit = {
      ...permit,
      status: 'APPROVED',
      is_extension: false,
      isExtension: false,
      batasKembali: finalBatasKembali,
      return_date: finalBatasKembali,
      musyrifPenyetuju: 'Ust. M. Syukron, M.Pd.',
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
      const notifPesan = isExtension
        ? `🕌 *[SMART PERMIT DARUL ULUM - PERPANJANGAN DISETUJUI]*\nAssalamu'alaikum Wali dari *${santri.nama}*, permohonan perpanjangan izin telah *DISETUJUI* sampai batas waktu baru: ${finalBatasKembali ? new Date(finalBatasKembali).toLocaleString('id-ID') : '-'}.`
        : `🕌 *[SMART PERMIT DARUL ULUM - IZIN DISETUJUI]*\nAssalamu'alaikum Wali dari *${santri.nama}* (${santri.kelas || 'Santri'} / ${santri.kamar || 'Asrama'}), permohonan izin *${permit.kategori || permit.reason}* untuk keperluan *${permit.keperluan || permit.reason}* telah *DISETUJUI* oleh Musyrif. Santri sudah dapat melakukan Tap Kartu RFID di Smart Gate.`;
      sendWhatsAppNotification(
        `${santri.wali?.nama || 'Wali Santri'} (Wali ${santri.nama})`,
        resolveWaliPhone(santri),
        'PERMIT_APPROVED',
        notifPesan
      );
    }
  };

  // 3. Reject Permit (Role: Musyrif)
  const rejectPermit = (permitId, alasan = 'Kegiatan asrama padat/alasan belum mendesak.') => {
    sound.playAccessDenied();
    const permit = permits.find(p => p.id === permitId);
    if (!permit) return;
    const santri = santriList.find(s => s.id === permit.santriId);

    const updatedPermit = {
      ...permit,
      status: 'REJECTED',
      musyrifPenyetuju: 'Ust. M. Syukron, M.Pd.',
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
      sendWhatsAppNotification(
        `${santri.wali?.nama || 'Wali Santri'} (Wali ${santri.nama})`,
        resolveWaliPhone(santri),
        'PERMIT_REJECTED',
        `Assalamu'alaikum ${santri.wali?.nama || 'Bapak/Ibu Wali'}, mohon maaf pengajuan izin ${permit.kategori} ananda ${santri.nama} TIDAK DISETUJUI oleh Pengasuh Asrama. Alasan: "${alasan}".`
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
      penjemput: data.penjemput || 'Izin Mandiri / Musyrif On-Site',
      waktuKeluarRencana: data.waktuKeluarRencana || getIsoNow(),
      batasKembali: data.batasKembali || new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
      status: openGateImmediately ? 'ACTIVE' : 'APPROVED',
      musyrifPenyetuju: 'Ust. M. Syukron (Express Kiosk)',
      waktuApproval: getIsoNow(),
      waktuKeluarAktual: openGateImmediately ? getIsoNow() : null,
      waktuKembaliAktual: null,
      tokenIzin: tokenIzin,
      catatanMusyrif: data.catatan || 'Izin Cepat Kiosk / Admin On-Site'
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

      sendWhatsAppNotification(
        `${santri.wali?.nama || 'Wali Santri'} (Wali ${santri.nama})`,
        resolveWaliPhone(santri),
        'GATE_EXIT',
        `Assalamu'alaikum ${santri.wali?.nama || 'Bapak/Ibu Wali'}. PEMBERITAHUAN RESMI: Ananda ${santri.nama} (${santri.kelas}) telah mendapatkan IZIN CEPAT [${newPermit.kategori}] (${newPermit.keperluan}) dan telah melewati Gerbang Utama pada pukul ${jamKeluar}. Batas kembali: ${batasJam}. Terima kasih.`
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
      sendWhatsAppNotification(
        `${santri.wali?.nama || 'Wali Santri'} (Wali ${santri.nama})`,
        resolveWaliPhone(santri),
        'PERMIT_APPROVED',
        `Assalamu'alaikum ${santri.wali?.nama || 'Bapak/Ibu Wali'}. Pengajuan Izin Cepat [${newPermit.kategori}] (${newPermit.keperluan}) ananda ${santri.nama} telah DISETUJUI (APPROVED) dengan Token [${tokenIzin}]. Kartu RFID ananda kini AKTIF dan siap di-tap di Gerbang Utama.`
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
            line5: 'HARAP HUBUNGI MUSYRIF',
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
        musyrifPenyetuju: initialPermitStatus !== 'PENDING' ? 'Ust. M. Syukron, M.Pd.' : null,
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
  const updateSantriCard = (santriId, updatedData) => {
    let syncedSantri = null;

    setSantriList(prev => prev.map(s => {
      if (s.id === santriId) {
        const updatedWali = {
          ...(s.wali || {}),
          ...(updatedData.wali || {}),
          nama: updatedData.waliNama !== undefined ? updatedData.waliNama : (updatedData.wali?.nama || s.wali?.nama || `Wali ${s.nama}`),
          telepon: updatedData.waliTelepon !== undefined ? updatedData.waliTelepon : (updatedData.wali?.telepon || s.wali?.telepon || ''),
          hubungan: updatedData.waliHubungan !== undefined ? updatedData.waliHubungan : (updatedData.wali?.hubungan || s.wali?.hubungan || 'Orang Tua / Wali'),
          alamat: updatedData.waliAlamat !== undefined ? updatedData.waliAlamat : (updatedData.wali?.alamat || s.wali?.alamat || '-')
        };

        syncedSantri = {
          ...s,
          ...updatedData,
          wali: updatedWali,
          rfidUid: updatedData.rfidUid ? updatedData.rfidUid.trim().toUpperCase() : s.rfidUid
        };
        return syncedSantri;
      }
      return s;
    }));

    if (syncedSantri) {
      // 1. Simpan permanen ke Supabase PostgreSQL & Firebase
      syncSantriToSupabase(syncedSantri);

      // 2. Siarkan perubahan nomor wali baru ke seluruh sesi & WhatsApp Gateway
      try {
        const waChannel = supabase.channel('whatsapp-room');
        waChannel.send({
          type: 'broadcast',
          event: 'santri.wali_updated',
          payload: {
            santriId: syncedSantri.id,
            namaSantri: syncedSantri.nama,
            namaWali: syncedSantri.wali?.nama,
            noWali: syncedSantri.wali?.telepon,
            rfidUid: syncedSantri.rfidUid
          }
        });
      } catch (e) {
        console.warn('Realtime broadcast wali update failed:', e);
      }
    }

    sound.playSuccess();
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

    sendWhatsAppNotification(
      `${santri.wali?.nama || 'Wali Santri'} (Wali ${santri.nama})`,
      resolveWaliPhone(santri),
      'WARNING_30M',
      `⏳ *[PENGINGAT SMART GATE - SISA WAKTU PERIZINAN]*\nAssalamu'alaikum Wr. Wb. Bpk/Ibu Wali dari *${santri.nama}* (${santri.kelas}).\nWaktu perizinan ananda (*${permit.kategori}*) tersisa *${sisaMenit} menit* lagi (Batas kembali: *${batasJam}*).\nMohon ananda segera bersiap kembali ke pesantren tepat waktu untuk menghindari catatan pelanggaran kedisiplinan. Syukron. — Musyrif Asrama Darul Ulum`
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
          musyrifPenyetuju: 'Ust. M. Syukron, M.Pd.',
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

  // Auto-check live permits every 15s for automatic early-warning reminder & overdue detection
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      permits.forEach(p => {
        if (p.status === 'ACTIVE') {
          const diffMs = new Date(p.batasKembali).getTime() - now;
          const sisaMenit = diffMs / 60000;

          // Auto-send WhatsApp reminder if within threshold and not yet sent
          if (sisaMenit <= reminderThresholdMinutes && sisaMenit > 0 && isAutoSendWaReminder && !p.reminderSent) {
            sendEarlyWarningReminder(p.id);
          }

          // Auto-overdue if time has expired
          if (diffMs <= 0) {
            simulateOverdue(p.id);
          }
        }
      });
    }, 15000);

    return () => clearInterval(timer);
  }, [permits, reminderThresholdMinutes, isAutoSendWaReminder, isAlarmSoundEnabled]);

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
      id: `RM-${Date.now().toString().slice(-4)}`,
      namaGedung: roomData.namaGedung,
      kategoriGedung: roomData.kategoriGedung || 'PUTRA',
      nomorKamar: roomData.nomorKamar,
      lantai: parseInt(roomData.lantai || 1),
      kapasitas: parseInt(roomData.kapasitas || 8),
      terisi: parseInt(roomData.terisi || 0),
      ketuaKamar: roomData.ketuaKamar || 'Belum Ditentukan',
      skorKerapianTerakhir: 90,
      jadwalPiketHariIni: 'Jadwal Reguler',
      catatanInspeksi: roomData.catatanInspeksi || 'Kamar siap huni.'
    };
    setRooms(prev => [...prev, newRoom]);

    // Simpan kamar baru ke Google Firebase Firestore
    syncRoomToFirebase(newRoom);

    // Simpan kamar baru ke backend lokal (PostgreSQL / pgAdmin) jika backend aktif
    fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRoom)
    }).catch(() => {});

    // Simpan kamar baru ke database Supabase
    try {
      const { data, error } = await supabase
        .from('rooms')
        .insert([{
          id: newRoom.id,
          nama_gedung: newRoom.namaGedung,
          kategori_gedung: newRoom.kategoriGedung,
          nomor_kamar: newRoom.nomorKamar,
          lantai: newRoom.lantai,
          kapasitas: newRoom.kapasitas,
          terisi: newRoom.terisi,
          ketua_kamar: newRoom.ketuaKamar,
          skor_kerapian_terakhir: newRoom.skorKerapianTerakhir,
          jadwal_piket_hari_ini: newRoom.jadwalPiketHariIni,
          catatan_inspeksi: newRoom.catatanInspeksi
        }])
        .select();

      if (error) {
        console.warn('⚠️ [Supabase addRoom] Warning saat menyimpan kamar ke Supabase:', error.message);
      } else {
        console.log('✅ [Supabase addRoom] Kamar baru berhasil disimpan ke Supabase:', data);
      }

      // Sync juga ke tabel 'kamar' Supabase (kompatibilitas dual-table)
      await supabase.from('kamar').insert([{
        nama_kamar: `${newRoom.nomorKamar} - Lt. ${newRoom.lantai}`,
        asrama: newRoom.namaGedung,
        kapasitas: newRoom.kapasitas,
        ketua: newRoom.ketuaKamar,
        catatan: `Keterisian: ${newRoom.terisi} / ${newRoom.kapasitas} Kasur. ${newRoom.catatanInspeksi}`
      }]).catch(() => {});
    } catch (err) {
      console.warn('⚠️ [Supabase addRoom] Exception saat menyimpan ke Supabase:', err);
    }
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
    
    // 1. Simpan ke Supabase & Firebase
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

    // 1. Simpan ke Supabase & Firebase
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
  const [visitBookings, setVisitBookings] = useState(() => {
    try {
      const saved = localStorage.getItem('sr_visit_bookings');
      if (saved) return JSON.parse(saved);
      return INITIAL_VISIT_BOOKINGS;
    } catch {
      return INITIAL_VISIT_BOOKINGS;
    }
  });

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
      const cleanPhone = (row.no_wa_wali || row.no_wali || row.telepon_wali || '').replace(/[^0-9]/g, '');
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
          telepon: cleanPhone || '08813576012',
          alamat: row.asal_daerah || 'Surabaya'
        },
        namaWali: row.nama_wali || `Wali dari ${row.nama_santri || 'Santri'}`,
        noWali: cleanPhone || '08813576012',
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
      const cleanPhone = (r.no_wa_wali || r.no_wali || '').replace(/[^0-9]/g, '');
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
            setVisitBookings(event.data.payload);
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
            setVisitBookings(parsed);
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
      nama_santri: bookingData.nama_santri || 'Ahmad Fauzi',
      kelas: bookingData.kelas || '10-A',
      asal: bookingData.asal || 'Surabaya',
      tanggal_kunjungan: tgl,
      hari_kunjungan: hari,
      jam_kunjungan: bookingData.jam_kunjungan || clock.jam_menit,
      jam_selesai: bookingData.jam_selesai || '15:30',
      titipan_barang: bookingData.titipan_barang || '-',
      berat_barang_kg: parseFloat(bookingData.berat_barang_kg) || 0,
      nama_penjenguk: bookingData.nama_penjenguk || 'Wali Santri',
      status_penjenguk: bookingData.status_penjenguk || 'Wali Santri',
      status_penjenguk_lainnya: bookingData.status_penjenguk_lainnya || '',
      no_wa_penjenguk: bookingData.no_wa_penjenguk || fonnteTargetNumber || '081234567890',
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
          `✅ *[BOOKING KUNJUNGAN DISETUJUI OTOMATIS - WEEKEND]*\nAssalamu'alaikum Wr. Wb. Bapak/Ibu *${newBooking.nama_penjenguk}*.\n\nPermohonan sambangan ananda *${newBooking.nama_santri}* (${newBooking.kelas}) pada hari *${hari}, ${tgl}* pukul *${newBooking.jam_kunjungan} - ${newBooking.jam_selesai} WIB* telah *DISETUJUI OTOMATIS*.\n\n📦 *Titipan Barang:* ${newBooking.titipan_barang} (${newBooking.berat_barang_kg} Kg)\n🎫 *Nomor Kupon Resmi:* *${barcodeToken}*\n\n🔗 *Link Kupon & Status Scan (Bisa Diklik Langsung):*\n${gatePassUrl}\n\n📷 *Gambar Kupon QR Gate Pass (Bisa Di-scan Kamera HP):*\n${qrCodeUrl}\n\nSilakan klik link di atas atau perlihatkan kupon QR Code kepada Satpam di Gerbang Utama Pesantren Modern Darul Ulum untuk verifikasi scan saat tiba di pondok.`,
          qrCodeUrl
        );
      } else {
        sendWhatsAppNotification(
          `${newBooking.nama_penjenguk} (Wali ${newBooking.nama_santri})`,
          targetPhone,
          'VISIT_WAITING_APPROVAL',
          `⏳ *[PERMOHONAN KUNJUNGAN TERCATAT - HARI KERJA]*\nAssalamu'alaikum Wr. Wb. Bapak/Ibu *${newBooking.nama_penjenguk}*.\n\nPermohonan kunjungan ananda *${newBooking.nama_santri}* untuk hari kerja (*${hari}, ${tgl}*) telah tercatat dan sedang *MENUNGGU PERSETUJUAN* Admin Ri'ayah.\n\nGambar Barcode Gate Pass resmi akan dikirimkan otomatis ke WhatsApp ini setelah permohonan disetujui Pengasuhan.`
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
      `🎉 *[PERMOHONAN KUNJUNGAN DISETUJUI ADMIN RI'AYAH]*\nAssalamu'alaikum Wr. Wb. Bapak/Ibu *${booking.nama_penjenguk}*.\n\nPermohonan kunjungan ananda *${booking.nama_santri}* (${booking.kelas}) untuk hari *${booking.hari_kunjungan}, ${booking.tanggal_kunjungan}* pukul *${booking.jam_kunjungan} - ${booking.jam_selesai} WIB* telah *DISETUJUI* oleh Admin Ri'ayah Pondok.\n\n📦 *Titipan Barang:* ${booking.titipan_barang} (${booking.berat_barang_kg} Kg)\n🎫 *Nomor Kupon Resmi:* *${barcodeToken}*\n\n🔗 *Link Kupon & Status Scan (Bisa Diklik Langsung):*\n${gatePassUrl}\n\n📷 *Gambar Kupon QR Gate Pass (Bisa Di-scan Kamera HP):*\n${qrCodeUrl}\n\nSilakan klik link di atas atau perlihatkan kupon QR Code kepada Satpam di Pos Gerbang untuk verifikasi check-in masuk pondok.`,
      qrCodeUrl
    );

    // Sinkronkan ke Supabase & siarkan update
    syncBookingStatusToSupabase(updatedBooking, 'VISIT_APPROVED');

    sound.playSuccess?.();
  };

  const rejectVisitBooking = (bookingId, reason = 'Kunjungan di luar kuota / agenda pondok padat') => {
    const booking = visitBookings.find(b => b.id === bookingId);
    if (!booking) return;

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
      `❌ *[PERMOHONAN KUNJUNGAN BELUM DAPAT DISETUJUI]*\nAssalamu'alaikum Wr. Wb. Bapak/Ibu *${booking.nama_penjenguk}*.\n\nMohon maaf, permohonan kunjungan ananda *${booking.nama_santri}* untuk tanggal *${booking.tanggal_kunjungan}* belum dapat disetujui oleh Pengasuhan Pondok.\nAlasan: "${reason}".\nSilakan ajukan kembali pada hari berkunjung resmi (Jumat, Sabtu, atau Minggu).`
    );

    // Sinkronkan ke Supabase & siarkan update
    syncBookingStatusToSupabase(updatedBooking, 'VISIT_REJECTED');

    sound.playBeep?.();
  };

  const checkInVisitBooking = (bookingId, method = 'BARCODE') => {
    const clock = getRealtimePondokClock();
    let updatedBooking = null;
    const cleanId = String(bookingId || '').trim().toUpperCase();

    setVisitBookings(prev => {
      const next = prev.map(b => {
        const matchId = String(b.id || '').toUpperCase() === cleanId;
        const matchToken = b.barcode_token && b.barcode_token.toUpperCase() === cleanId;
        if (matchId || matchToken) {
          updatedBooking = {
            ...b,
            status_kunjungan: 'Sedang Berkunjung',
            jam_masuk_aktual: clock.jam_menit_detik,
            jam_checkin_aktual: clock.jam_menit,
            metode_verifikasi: method
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
      // 1. Simpan ke database Supabase agar tersinkron lintas device/browser
      syncBookingStatusToSupabase(updatedBooking, 'VISIT_CHECKIN');

      // 2. Broadcast ke seluruh tab / halaman secara realtime
      try {
        const bc = new BroadcastChannel('smart_riayah_visit_channel');
        bc.postMessage({ type: 'VISIT_CHECKIN', booking: updatedBooking, scanner: method });
        bc.close();
      } catch (e) {}

      // 3. Notifikasi Lonceng Top Bar Admin Ri'ayah
      const notifText = `📷 Scan Pos Satpam: ${updatedBooking.nama_penjenguk} (Wali dari ${updatedBooking.nama_santri}) telah tiba dan berhasil scan barcode di gerbang pukul ${clock.jam_menit} WITA.`;
      setNotifications(prev => [
        {
          id: `NOTIF-GATE-${Date.now()}`,
          type: 'GATE_ARRIVED',
          title: 'Tamu Tiba di Gerbang (Pos Satpam)',
          message: notifText,
          time: clock.jam_menit_detik,
          read: false,
          booking: updatedBooking
        },
        ...prev
      ]);

      // 4. Kirim notifikasi WA ke nomor wali santri bahwa tamu telah check-in di pos gerbang
      if (updatedBooking.no_wa_penjenguk) {
        sendWhatsAppNotification(
          `${updatedBooking.nama_penjenguk} (Wali ${updatedBooking.nama_santri})`,
          updatedBooking.no_wa_penjenguk,
          'VISIT_CHECKIN_GATE',
          `🚪 *[CHECK-IN GERBANG PONDOK BERHASIL]*\nAssalamu'alaikum Wr. Wb. Bapak/Ibu *${updatedBooking.nama_penjenguk}*.\n\nSelamat datang di Pesantren Modern Darul Ulum. Verifikasi E-Barcode gate pass untuk ananda *${updatedBooking.nama_santri}* (${updatedBooking.kelas}) telah *BERHASIL DICATAT* di Pos Jaga Satpam pada pukul *${clock.jam_menit} WITA*.\n\n⏳ Batas waktu kunjungan hingga pukul *${updatedBooking.jam_selesai || 'selesai'} WITA*. Mohon menjaga ketertiban dan adab bertamu di lingkungan asrama.`
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
        sendWhatsAppNotification(
          `${updatedBooking.nama_penjenguk} (Wali ${updatedBooking.nama_santri})`,
          updatedBooking.no_wa_penjenguk,
          'VISIT_CHECKOUT_GATE',
          `✅ *[KUNJUNGAN SELESAI / CHECK-OUT]*\nAssalamu'alaikum Wr. Wb. Bapak/Ibu *${updatedBooking.nama_penjenguk}*.\n\nTerima kasih telah mengunjungi ananda *${updatedBooking.nama_santri}* di Pesantren Modern Darul Ulum. Data kepulangan/check-out telah dicatat sistem pada pukul *${clock.jam_menit} WITA*.\nSemoga ananda semakin betah dan bersemangat menuntut ilmu. Hati-hati di perjalanan pulang. Barakallahu fiikum.`
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

    const booking = visitBookings.find(b => 
      (b.barcode_token && b.barcode_token.toUpperCase() === clean) ||
      (b.id && b.id.toUpperCase() === clean) ||
      (b.barcode_token && clean.includes(b.barcode_token.toUpperCase())) ||
      (b.barcode_token && b.barcode_token.toUpperCase().includes(clean))
    );

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

    // Cari booking berdasarkan barcode_token, id, atau substring
    let booking = visitBookings.find(b => 
      (b.barcode_token && b.barcode_token.toUpperCase() === clean) ||
      (b.id && b.id.toUpperCase() === clean) ||
      (b.barcode_token && clean.includes(b.barcode_token.toUpperCase())) ||
      (b.barcode_token && b.barcode_token.toUpperCase().includes(clean))
    );

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
      sendWhatsAppNotification(
        `${updatedBooking.nama_penjenguk} (Wali ${updatedBooking.nama_santri})`,
        updatedBooking.no_wa_penjenguk,
        'VISIT_CHECKIN_GATE',
        `🚪 *[TIKET KUNJUNGAN BERHASIL DI-SCAN & CHECK-IN MASUK]*\nAssalamu'alaikum Wr. Wb. Bapak/Ibu *${updatedBooking.nama_penjenguk}*.\n\nE-Kupon Kunjungan untuk ananda *${updatedBooking.nama_santri}* (${updatedBooking.kelas}) telah *BERHASIL DI-SCAN* di sistem Smart Riayah pada pukul *${clock.jam_menit} WITA*.\n\n⏳ Batas durasi kunjungan hingga pukul *${updatedBooking.jam_selesai || '16:30'} WITA*. Silakan tunjukkan kupon digital kepada Satpam di Pos Jaga Gerbang.`
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

    if (lifecycle.isExpired) {
      sound.playBeep?.();
      return {
        success: false,
        message: `Tidak dapat mengirim ulang: ${lifecycle.message}`,
        isExpired: true
      };
    }

    const token = booking.barcode_token || booking.id;
    const { qrCodeUrl, gatePassUrl } = getVisitGatePassUrls(token);
    const targetPhone = booking.no_wa_penjenguk || fonnteTargetNumber || '6285960213654';
    const waktuKirim = `${clock.jam_menit} WITA`;

    const waMessage = `🎫 *[PENGIRIMAN ULANG TIKET BARCODE KUNJUNGAN - SMART RIAYAH]*\nAssalamu'alaikum Wr. Wb. Bapak/Ibu *${booking.nama_penjenguk}*.\n\nBerikut kami kirimkan ulang E-Barcode Gate Pass untuk kunjungan ananda *${booking.nama_santri}* (${booking.kelas || 'Santri'}):\n\n📅 *Jadwal Sambangan:* ${booking.hari_kunjungan}, ${booking.tanggal_kunjungan}\n⏰ *Jam Operasional:* ${booking.jam_kunjungan} - ${booking.jam_selesai || '16:30'} WITA\n📦 *Titipan Barang:* ${booking.titipan_barang || '-'} (${booking.berat_barang_kg || 0} Kg)\n🎫 *Kode Kupon Resmi:* *${token}*\n\n🔗 *Link Kupon & Status Scan (Bisa Diklik Langsung):*\n${gatePassUrl}\n\n📷 *Gambar Kupon QR Gate Pass (Bisa Di-scan Kamera HP):*\n${qrCodeUrl}\n\n_Catatan: Barcode dikirim ulang pada ${waktuKirim}. Tiket hanya berlaku selama jam kunjungan dan otomatis hangus setelah selesai check-out di Pos Satpam._`;

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
      nama_penjenguk: sampleSantri.wali?.nama || 'Ibu Fatimah Az-Zahra',
      status_penjenguk: 'Wali Santri',
      no_wa_penjenguk: sampleSantri.wali?.telepon || fonnteTargetNumber || '081234567890',
      rfid_uid: sampleSantri.rfidUid
    });
  };

  // ─── PENGURUS OSIS: SISTEM PELAPORAN KELAKUAN SANTRI/WATI SE-PONDOK ───
  const [osisReports, setOsisReports] = useState(() => {
    try {
      const saved = localStorage.getItem('sr_osis_reports');
      return saved ? JSON.parse(saved) : INITIAL_OSIS_REPORTS;
    } catch {
      return INITIAL_OSIS_REPORTS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('sr_osis_reports', JSON.stringify(osisReports));
    } catch (e) {}
  }, [osisReports]);

  const submitOsisReport = (reportData) => {
    const clock = getRealtimePondokClock();
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
      created_at: new Date().toISOString()
    };

    setOsisReports(prev => [newReport, ...prev]);

    // Lonceng Notifikasi ke Admin Ri'ayah
    setNotifications(prev => [
      {
        id: `NOTIF-OSIS-${Date.now()}`,
        type: 'OSIS_REPORT_NEW',
        title: '📋 Laporan Kelakuan Santri dari OSIS',
        message: `[${newReport.bidangOsis}] melaporkan ananda ${newReport.santriNama} (${newReport.kelas}): "${newReport.jenis}". Menunggu verifikasi Admin Ri'ayah.`,
        time: clock.jam_menit_detik,
        read: false,
        reportId: newReport.id
      },
      ...prev
    ]);

    sound.playSuccess?.();
    return newReport;
  };

  const verifyOsisReport = (reportId, action = 'APPROVE', refinedData = {}) => {
    const clock = getRealtimePondokClock();
    let targetReport = null;

    setOsisReports(prev => prev.map(rep => {
      if (rep.id === reportId) {
        targetReport = {
          ...rep,
          status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          jenis: refinedData.jenis !== undefined ? refinedData.jenis : rep.jenis,
          keterangan: refinedData.keterangan !== undefined ? refinedData.keterangan : rep.keterangan,
          poin: refinedData.poin !== undefined ? Number(refinedData.poin) : rep.poin,
          tazir: refinedData.tazir !== undefined ? refinedData.tazir : rep.tazir,
          adminNote: refinedData.adminNote || (action === 'APPROVE' ? 'Disetujui resmi oleh Admin Ri\'ayah' : 'Ditolak oleh Admin Ri\'ayah'),
          verified_at: new Date().toISOString(),
          verified_by: currentUser?.nama || 'Admin Ri\'ayah'
        };
        return targetReport;
      }
      return rep;
    }));

    if (action === 'APPROVE' && targetReport) {
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
          sendWhatsAppNotification(
            `${targetSantri.wali?.nama || 'Wali Santri'} (Wali ${targetReport.santriNama})`,
            noWa,
            'DISCIPLINE_NOTICE',
            `${statusIcon} *[CATATAN RESMI KEDISIPLINAN & PERILAKU SANTRI]*\nAssalamu'alaikum Wr. Wb. Bapak/Ibu Wali dari *${targetReport.santriNama}* (${targetReport.kelas || targetSantri.kelas}).\n\nTercatat laporan ${categoryLabel.toLowerCase()} santri oleh *${targetReport.bidangOsis}* yang telah diverifikasi resmi oleh Biro Pengasuhan Santri (Admin Ri'ayah):\n\n• *Perihal:* ${targetReport.jenis}\n• *Keterangan:* ${targetReport.keterangan}\n• *Penyesuaian Poin:* ${poinValue > 0 ? '+' : ''}${poinValue} Poin\n• *Sisa Poin Disiplin:* ${updatedPoints}/100 Poin\n${targetReport.tazir ? `• *Arahan / Tindakan:* ${targetReport.tazir}\n` : ''}\nMohon dukungan dan doa dari Bapak/Ibu agar ananda senantiasa istiqomah dalam menuntut ilmu dan berakhlak mulia di pondok.`
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

        // 16. OSIS Discipline Reports Engine
        osisReports,
        setOsisReports,
        submitOsisReport,
        verifyOsisReport
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);

