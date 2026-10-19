import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { sound } from '../utils/audio';
import { webSerial } from '../utils/webSerial';
import { DEFAULT_DEEPSEEK_TOKEN, testDeepSeekConnection } from '../utils/deepseekApi';
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
  INITIAL_BLACKLIST
} from '../data/seedData';

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
  // 1. Authentication & System Accounts State (7 Roles)
  const [accounts, setAccounts] = useState(() => {
    const saved = localStorage.getItem('sr_accounts');
    return saved ? JSON.parse(saved) : INITIAL_ACCOUNTS;
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

  // Real-Time WhatsApp Gateway Configuration (Fonnte API)
  const [fonnteToken, setFonnteTokenState] = useState(() => {
    return localStorage.getItem('sr_fonnte_token') || 'XvFjdLyyvBgNUbXBZYzZ';
  });
  const [fonnteTargetNumber, setFonnteTargetNumberState] = useState(() => {
    return localStorage.getItem('sr_fonnte_target') || '08813576012';
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
  const [isWaDrawerOpen, setIsWaDrawerOpen] = useState(false);
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

  // Server-side sync via /api/sync (Cross-profile, cross-browser, incognito sync)
  useEffect(() => {
    let isMounted = true;

    const fetchServerSync = async () => {
      try {
        const res = await fetch('/api/sync');
        if (!res.ok) return;
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
        // Dev server might not have middleware ready yet, safe to ignore
      }
    };

    fetchServerSync();

    // Fast polling every 1200ms to detect updates from other accounts / browser windows
    const interval = setInterval(async () => {
      try {
        const verRes = await fetch('/api/sync/version');
        if (!verRes.ok) return;
        const verData = await verRes.json();
        if (verData.version && verData.version > syncVersionRef.current) {
          const res = await fetch('/api/sync');
          if (res.ok) {
            const fullData = await res.json();
            if (fullData.data && fullData.version > syncVersionRef.current) {
              if (isMounted) {
                applySyncedData(fullData.data);
                syncVersionRef.current = fullData.version;
              }
            }
          }
        }
      } catch {}
    }, 1200);

    return () => {
      isMounted = false;
      clearInterval(interval);
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

      // Push to server for other profiles and browsers
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: newVer, data: payload })
      }).catch(() => {});
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

  // 3. FUNGSI PENGIRIMAN OTOMATIS KE API FONNTE (https://api.fonnte.com/send)
  const sendFonnteWhatsApp = async (targetNumber, messageText, eventType = 'GENERAL') => {
    const token = (fonnteToken || 'XvFjdLyyvBgNUbXBZYzZ').trim();
    // Gunakan nomor tujuan testing/wali santri (default 08813576012)
    const rawTarget = fonnteTargetNumber || targetNumber || '08813576012';
    const cleanTarget = rawTarget.replace(/[^0-9]/g, '');

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
    const target = fonnteTargetNumber || '08813576012';
    const testMsg = `📲 *[TES KONEKSI LIVE WHATSAPP GATEWAY - FONNTE]*\nAssalamu'alaikum Warahmatullahi Wabarakatuh.\n\nSistem Real-Time IoT Smart Gate & Smart Ri'ayah Pesantren Modern Darul Ulum berhasil terhubung ke Fonnte API Gateway!\n\n• Waktu Pengujian: *${getNowWIB()}*\n• Target Uji: *${target}*\n• Endpoint: *https://api.fonnte.com/send*\n• Status Gateway: *ONLINE & TERVERIFIKASI*\n\n_Pesan ini dikirim otomatis untuk validasi latensi & konektivitas data jurnal ilmiah._`;
    
    await sendWhatsAppNotification(
      `Pengujian Fonnte API (${target})`,
      target,
      'GATEWAY_TEST',
      testMsg
    );
  };

  // Helper to push WhatsApp Notification with Fonnte Real-Time Dispatch & Latency Tracking
  const sendWhatsAppNotification = async (penerima, nomor, tipe, pesan) => {
    sound.playWhatsApp();
    const id = `WA-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newMsg = {
      id,
      waktu: getNowWIB(),
      penerima,
      nomor: fonnteTargetNumber || nomor || '08813576012',
      tipe,
      pesan,
      latencyMs: null,
      latencySec: null,
      apiStatus: isFonnteEnabled ? 'SENDING' : 'SIMULATED',
      fonnteEnabled: isFonnteEnabled
    };

    setWhatsappLogs(prev => [newMsg, ...prev]);
    setUnreadWaCount(prev => prev + 1);

    // Call Fonnte API asynchronously in background
    try {
      const res = await sendFonnteWhatsApp(nomor, pesan, tipe);
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

    // Push notification to WhatsApp
    sendWhatsAppNotification(
      `${santri.wali.nama} (Wali ${santri.nama})`,
      santri.wali.telepon,
      'PERMIT_SUBMITTED',
      `Assalamu'alaikum ${santri.wali.nama}, pengajuan izin ${data.kategori} ananda ${santri.nama} (${santri.kelas}) telah terkirim ke antrean pengasuh asrama. Status: MENUNGGU PERSETUJUAN (PENDING).`
    );
  };

  // 2. Approve Permit (Role: Musyrif)
  const approvePermit = (permitId, catatan = 'Disetujui. Harap jaga adab santri selama di luar pondok.', customBatasKembali = null) => {
    sound.playSuccess();
    try {
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.8 } });
    } catch {}

    const permit = permits.find(p => p.id === permitId);
    if (!permit) return;
    const santri = santriList.find(s => s.id === permit.santriId);

    setPermits(prev => prev.map(p => {
      if (p.id === permitId) {
        return {
          ...p,
          status: 'APPROVED',
          batasKembali: customBatasKembali || p.batasKembali,
          musyrifPenyetuju: 'Ust. M. Syukron, M.Pd.',
          waktuApproval: getIsoNow(),
          catatanMusyrif: catatan
        };
      }
      return p;
    }));

    if (santri) {
      sendWhatsAppNotification(
        `${santri.wali?.nama || 'Wali Santri'} (Wali ${santri.nama})`,
        santri.wali?.telepon || fonnteTargetNumber,
        'PERMIT_APPROVED',
        `🕌 *[SMART PERMIT DARUL ULUM - IZIN DISETUJUI]*\nAssalamu'alaikum Wali dari *${santri.nama}* (${santri.kelas || 'Santri'} / ${santri.kamar || 'Asrama'}), permohonan izin *${permit.kategori}* untuk keperluan *${permit.keperluan}* telah *DISETUJUI* oleh Musyrif. Santri sudah dapat melakukan Tap Kartu RFID di Smart Gate.`
      );
    }
  };

  // 3. Reject Permit (Role: Musyrif)
  const rejectPermit = (permitId, alasan = 'Kegiatan asrama padat/alasan belum mendesak.') => {
    sound.playAccessDenied();
    const permit = permits.find(p => p.id === permitId);
    if (!permit) return;
    const santri = santriList.find(s => s.id === permit.santriId);

    setPermits(prev => prev.map(p => {
      if (p.id === permitId) {
        return {
          ...p,
          status: 'REJECTED',
          musyrifPenyetuju: 'Ust. M. Syukron, M.Pd.',
          waktuApproval: getIsoNow(),
          catatanMusyrif: `DITOLAK: ${alasan}`
        };
      }
      return p;
    }));

    if (santri) {
      sendWhatsAppNotification(
        `${santri.wali.nama} (Wali ${santri.nama})`,
        santri.wali.telepon,
        'PERMIT_REJECTED',
        `Assalamu'alaikum ${santri.wali.nama}, mohon maaf pengajuan izin ${permit.kategori} ananda ${santri.nama} TIDAK DISETUJUI oleh Pengasuh Asrama. Alasan: "${alasan}".`
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

      sendWhatsAppNotification(
        `${santri.wali.nama} (Wali ${santri.nama})`,
        santri.wali.telepon,
        'GATE_EXIT',
        `Assalamu'alaikum ${santri.wali.nama}. PEMBERITAHUAN RESMI: Ananda ${santri.nama} (${santri.kelas}) telah mendapatkan IZIN CEPAT [${newPermit.kategori}] (${newPermit.keperluan}) dan telah melewati Gerbang Utama pada pukul ${jamKeluar}. Batas kembali: ${batasJam}. Terima kasih.`
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
        `${santri.wali.nama} (Wali ${santri.nama})`,
        santri.wali.telepon,
        'PERMIT_APPROVED',
        `Assalamu'alaikum ${santri.wali.nama}. Pengajuan Izin Cepat [${newPermit.kategori}] (${newPermit.keperluan}) ananda ${santri.nama} telah DISETUJUI (APPROVED) dengan Token [${tokenIzin}]. Kartu RFID ananda kini AKTIF dan siap di-tap di Gerbang Utama.`
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

          // WhatsApp to Wali (Automatic Fonnte Notification on RFID Tap Keluar)
          const cardUid = santri.rfidUid || '04:A1:2B:9C';
          sendWhatsAppNotification(
            `${santri.wali?.nama || 'Wali Santri'} (Wali ${santri.nama})`,
            santri.wali?.telepon || fonnteTargetNumber,
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

          // Automatic WhatsApp Security Alert (Anti-Bypass Lock)
          const jamRealTime = getNowWIB();
          const cardUid = santri.rfidUid || 'UID-UNKNOWN';
          sendWhatsAppNotification(
            `${santri.wali?.nama || 'Wali Santri'} (Wali ${santri.nama})`,
            santri.wali?.telepon || fonnteTargetNumber,
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

        const jamMasuk = getNowWIB();
        const cardUid = santri.rfidUid || '04:A1:2B:9C';
        sendWhatsAppNotification(
          `${santri.wali?.nama || 'Wali Santri'} (Wali ${santri.nama})`,
          santri.wali?.telepon || fonnteTargetNumber,
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

      // Security Alert to Admin / Wali for Blocked Card
      const santriNama = santri ? santri.nama : `Kartu UID ${cleanUid}`;
      sendWhatsAppNotification(
        santri ? `${santri.wali?.nama || 'Wali'} (Wali ${santri.nama})` : 'Keamanan Pesantren',
        santri?.wali?.telepon || fonnteTargetNumber,
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

    setSantriList(prev => [newSantri, ...prev]);
    setLastScannedUid(formattedUid);

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
    }
    sound.playSuccess();
  };

  // 4e. RFID Card Management: Update existing santri card info & wali contact
  const updateSantriCard = (santriId, updatedData) => {
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

        return {
          ...s,
          ...updatedData,
          wali: updatedWali,
          rfidUid: updatedData.rfidUid ? updatedData.rfidUid.trim().toUpperCase() : s.rfidUid
        };
      }
      return s;
    }));
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
      santri.wali?.telepon || fonnteTargetNumber,
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
      santri.wali?.telepon || fonnteTargetNumber,
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
        `${santri.wali.nama} (Wali ${santri.nama})`,
        santri.wali.telepon,
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

    const santri = santriList.find(s => s.id === recordData.santriId);
    if (santri) {
      sendWhatsAppNotification(
        `${santri.wali.nama} (Wali ${santri.nama})`,
        santri.wali.telepon,
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

    sendWhatsAppNotification(
      `${santri.wali.nama} (Wali ${santri.nama})`,
      santri.wali.telepon,
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
      `${santri.wali.nama} (Wali ${santri.nama})`,
      santri.wali.telepon,
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

  const addRoom = (roomData) => {
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
  };

  const updateRoomCapacity = (roomId, newCapacity) => {
    const cap = parseInt(newCapacity);
    if (isNaN(cap) || cap < 1) return;
    setRooms(prev => prev.map(r => {
      if (r.id === roomId) {
        return { ...r, kapasitas: cap };
      }
      return r;
    }));
    sound.playSuccess();
  };

  // 12. Admin Ri'ayah: Onboarding Santri Baru & Live Hardware RFID Tap Integration
  const addNewSantri = (santriData) => {
    const formattedUid = santriData.rfidUid ? santriData.rfidUid.trim().toUpperCase() : `04:${Math.floor(10 + Math.random() * 89)}:${Math.floor(10 + Math.random() * 89)}:${Math.floor(10 + Math.random() * 89)}`;
    const newId = `S-${Date.now().toString().slice(-4)}`;
    const gender = santriData.gender || 'L';
    const defaultAvatar = gender === 'P' ? '/images/avatar_santri_putri.jpg' : '/images/avatar_santri_putra.jpg';

    const newSantri = {
      id: newId,
      nis: santriData.nis || `${Math.floor(125500 + Math.random() * 900)}`,
      nama: santriData.nama,
      kelas: santriData.kelas || (gender === 'P' ? '10-B (Putri)' : '10-A (Putra)'),
      gender,
      kamar: santriData.kamar || (gender === 'P' ? 'Asrama Putri Khadijah 105' : 'Umar bin Khattab 204'),
      rfidUid: formattedUid,
      foto: santriData.foto || defaultAvatar,
      wali: {
        nama: santriData.waliNama || `Wali dari ${santriData.nama}`,
        hubungan: santriData.waliHubungan || 'Orang Tua Kandung',
        telepon: santriData.waliTelepon || '0812-3456-7890',
        alamat: santriData.alamat || 'Surabaya'
      },
      saldoRfid: parseInt(santriData.saldoAwal || 100000),
      limitJajanHarian: 25000,
      poinDisiplin: 100,
      tahfidzJuz: parseInt(santriData.tahfidzAwal || 1),
      statusAsrama: 'DI_ASRAMA',
      penyakitKhusus: santriData.penyakitKhusus || '-'
    };

    setSantriList(prev => [newSantri, ...prev]);
    setLastScannedUid(formattedUid);

    // Auto-update room occupancy count
    if (santriData.kamar) {
      setRooms(prev => prev.map(r => {
        if (r.nomorKamar.toLowerCase().includes(santriData.kamar.toLowerCase()) || 
            santriData.kamar.toLowerCase().includes(r.nomorKamar.toLowerCase())) {
          return { ...r, terisi: Math.min(r.kapasitas, r.terisi + 1) };
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
      `${newSantri.wali.nama} (Wali ${newSantri.nama})`,
      newSantri.wali.telepon,
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
      `${santri.wali.nama} (Wali ${santri.nama})`,
      santri.wali.telepon,
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
        blacklistedUids,
        setBlacklistedUids,

        // Setting Builder & Dormitory Admin
        addBuilding,
        addRoom,
        updateRoomCapacity,
        addNewSantri,
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
        openAiAgentForSantri
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);

