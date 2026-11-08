import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Users,
  Shield,
  ShieldCheck,
  Radio,
  HeartPulse,
  TrendingUp,
  Building2,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Wifi,
  Cpu,
  Layers,
  X,
  LogOut,
  UserPlus,
  ShieldAlert,
  Award,
  BookOpen,
  Send,
  Home,
  Activity,
  PlusCircle,
  ExternalLink,
  Zap,
  BellRing,
  ClipboardList,
  Smartphone,
  ChevronDown,
  MessageSquare,
  Calendar,
  Package
} from 'lucide-react';
import { sound } from '../../utils/audio';

/* ─────────────────────────────────────────────
   ROLE CONFIG
───────────────────────────────────────────── */
const ROLE_CONFIG = {
  superadmin: {
    label: 'Super Admin',
    accent: '#22d3ee',
    headerBg: 'bg-slate-900',
    activeBg: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
    activeIcon: 'bg-cyan-500 text-white',
    hoverBg: 'hover:bg-slate-800/70 hover:text-slate-200',
    badge: 'bg-cyan-950 text-cyan-300 border border-cyan-800',
    isLight: false,
  },
  admin_riayah: {
    label: "Admin Ri'ayah",
    accent: '#10b981',
    headerBg: 'bg-emerald-950',
    activeBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    activeIcon: 'bg-emerald-500 text-white',
    hoverBg: 'hover:bg-slate-800/70 hover:text-slate-200',
    badge: 'bg-emerald-950 text-emerald-300 border border-emerald-800',
    isLight: false,
  },
  parent: {
    label: 'Wali Santri',
    accent: '#0d9488',
    headerBg: 'bg-teal-600',
    activeBg: 'bg-teal-500/10 text-teal-700 border-teal-400/40',
    activeIcon: 'bg-teal-500 text-white',
    hoverBg: 'hover:bg-slate-100 hover:text-slate-800',
    badge: 'bg-teal-100 text-teal-800 border border-teal-300',
    isLight: true,
  },
  musyrif: {
    label: 'Musyrif',
    accent: '#818cf8',
    headerBg: 'bg-indigo-950',
    activeBg: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40',
    activeIcon: 'bg-indigo-500 text-white',
    hoverBg: 'hover:bg-slate-800/70 hover:text-slate-200',
    badge: 'bg-indigo-950 text-indigo-300 border border-indigo-800',
    isLight: false,
  },
  security: {
    label: 'Satpam',
    accent: '#f59e0b',
    headerBg: 'bg-amber-950',
    activeBg: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    activeIcon: 'bg-amber-500 text-slate-900',
    hoverBg: 'hover:bg-slate-800/70 hover:text-slate-200',
    badge: 'bg-amber-950 text-amber-300 border border-amber-800',
    isLight: false,
  },
  poskestren: {
    label: 'Poskestren',
    accent: '#fb7185',
    headerBg: 'bg-rose-950',
    activeBg: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
    activeIcon: 'bg-rose-500 text-white',
    hoverBg: 'hover:bg-slate-800/70 hover:text-slate-200',
    badge: 'bg-rose-950 text-rose-300 border border-rose-800',
    isLight: false,
  },
  kyai: {
    label: 'Pimpinan',
    accent: '#fbbf24',
    headerBg: 'bg-yellow-950',
    activeBg: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/40',
    activeIcon: 'bg-yellow-500 text-slate-900',
    hoverBg: 'hover:bg-slate-800/70 hover:text-slate-200',
    badge: 'bg-yellow-950 text-yellow-300 border border-yellow-800',
    isLight: false,
  },
  osis: {
    label: 'Pengurus OSIS',
    accent: '#14b8a6',
    headerBg: 'bg-teal-950',
    activeBg: 'bg-teal-500/15 text-teal-300 border-teal-500/40',
    activeIcon: 'bg-teal-500 text-white',
    hoverBg: 'hover:bg-slate-800/70 hover:text-slate-200',
    badge: 'bg-teal-950 text-teal-300 border border-teal-800',
    isLight: false,
  },
};

/* ─────────────────────────────────────────────
   MENU ITEMS per role
───────────────────────────────────────────── */
function getMenuItems(role, { 
  permits = [], 
  rooms = [], 
  santriList = [], 
  blacklistedUids = [], 
  gateLogs = [], 
  medicalRecords = [], 
  pendingPermitsCount = 0, 
  warningPermitsCount = 0, 
  santriDiLuar = 0, 
  pendingVisitsCount = 0, 
  manualReplyNeededCount = 0,
  pendingOsisCount = 0,
  osisReportsCount = 0
} = {}) {
  switch (role) {
    case 'superadmin':
      return [
        { id: 'diagnostics', label: 'Diagnostik IoT', icon: Cpu, badge: 'Live' },
        { id: 'users', label: 'Kelola Akun', icon: Users, badge: '7 Role' },
        { id: 'database', label: 'Database', icon: Layers, badge: 'JSON' },
        { id: 'rfid_cards', label: 'Kartu RFID', icon: CreditCard, badge: `${santriList.length}` },
        { id: 'rfid_pairing', label: 'Scanner RFID', icon: Radio, badge: 'Scan' },
        { id: 'express_kiosk', label: 'Kiosk Izin', icon: Zap, badge: 'Cepat' },
        { id: 'ai_agent', label: 'AI Agent', icon: Sparkles, badge: 'AI', highlight: true },
      ];
    case 'admin_riayah':
      return [
        { id: 'rooms', label: 'Gedung & Kamar', icon: Building2, badge: `${rooms.length}` },
        { id: 'onboarding', label: 'Santri Baru', icon: UserPlus, badge: 'Daftar' },
        { id: 'lost_card', label: 'Ganti Kartu', icon: CreditCard, badge: 'Revoke' },
        { id: 'blacklist', label: 'Kartu Blokir', icon: ShieldAlert, badge: `${blacklistedUids.length}`, urgent: blacklistedUids.length > 0 },
        { id: 'rfid_cards', label: 'Tabel RFID', icon: CreditCard, badge: `${santriList.length}` },
        { id: 'rfid_pairing', label: 'Scanner RFID', icon: Radio, badge: 'Scan' },
        { id: 'express_kiosk', label: 'Kiosk Izin', icon: Zap, badge: 'Cepat' },
        { id: 'visit_bookings', label: 'Kunjungan Tamu', icon: Calendar, badge: pendingVisitsCount > 0 ? `${pendingVisitsCount} Menunggu` : 'QR Pass', urgent: pendingVisitsCount > 0 },
        { id: 'osis_verification', label: 'Verifikasi OSIS', icon: Shield, badge: pendingOsisCount > 0 ? `${pendingOsisCount} Baru` : null, urgent: pendingOsisCount > 0 },
        { id: 'gate_logs', label: 'Log Gerbang', icon: ClipboardList, badge: `${gateLogs.length}` },
        { id: 'whatsapp_manager', label: 'WhatsApp', icon: Smartphone, badge: manualReplyNeededCount > 0 ? `${manualReplyNeededCount}` : null, urgent: manualReplyNeededCount > 0 },
        { id: 'ai_analytics', label: 'AI Evaluasi', icon: Sparkles, badge: 'AI', highlight: true },
      ];
    case 'parent':
      return [
        { id: 'permit', label: 'Surat Izin', icon: Send, badge: `${permits.length}` },
        { id: 'aktivitas', label: 'Aktivitas & AI', icon: Sparkles, badge: 'AI', highlight: true },
        { id: 'riayah', label: 'Poin Disiplin', icon: ShieldCheck, badge: "Ri'ayah" },
        { id: 'ibadah', label: 'Ibadah', icon: BookOpen, badge: "Qur'an" },
        { id: 'cashless', label: 'Dompet RFID', icon: CreditCard, badge: 'POS' },
        { id: 'kesehatan', label: 'Medis', icon: HeartPulse, badge: 'UKS' },
      ];
    case 'musyrif':
      return [
        { id: 'approval', label: 'Otorisasi Izin', icon: ShieldCheck, badge: pendingPermitsCount > 0 ? `${pendingPermitsCount}` : null, urgent: pendingPermitsCount > 0 },
        { id: 'alarm_monitor', label: 'Alarm Pantau', icon: BellRing, badge: warningPermitsCount > 0 ? `${warningPermitsCount}` : null, urgent: warningPermitsCount > 0 },
        { id: 'active_permits', label: 'Papan Real-Time', icon: ClipboardList, badge: `${permits.length}` },
        { id: 'points', label: 'Buku Poin', icon: Award, badge: 'Disiplin' },
        { id: 'kamar', label: 'Inspeksi Kamar', icon: Home, badge: 'Kamar' },
        { id: 'ai_santri', label: 'AI Evaluasi', icon: Sparkles, badge: 'AI', highlight: true },
      ];
    case 'security':
      return [
        { id: 'gate', label: 'Gate Gerbang', icon: Radio, badge: 'Gate 01' },
        { id: 'pos_kunjungan', label: 'Pos Kunjungan', icon: Package, badge: pendingVisitsCount > 0 ? `${pendingVisitsCount} Menunggu` : 'QR Pass', urgent: pendingVisitsCount > 0 },
        { id: 'headcount', label: 'Live Headcount', icon: Users, badge: `${santriDiLuar} Luar`, urgent: santriDiLuar > 0 },
        { id: 'logs', label: 'Log Audit', icon: Activity, badge: `${gateLogs.length}` },
        { id: 'ai_security', label: 'AI Pola', icon: Sparkles, badge: 'AI', highlight: true },
      ];
    case 'poskestren':
      return [
        { id: 'rekam_medis', label: 'Rekam Medis', icon: HeartPulse, badge: `${medicalRecords.length}` },
        { id: 'periksa_baru', label: 'Periksa Baru', icon: PlusCircle, badge: 'Input' },
        { id: 'rujukan_rs', label: 'Rujukan RS', icon: ShieldAlert, badge: 'Darurat' },
        { id: 'ai_health', label: 'AI Medis', icon: Sparkles, badge: 'AI', highlight: true },
      ];
    case 'kyai':
      return [
        { id: 'ringkasan', label: 'Ringkasan', icon: TrendingUp, badge: 'Overview' },
        { id: 'tren_izin', label: 'Tren Izin', icon: Activity, badge: 'Grafik' },
        { id: 'rapor_adab', label: 'Rapor Adab', icon: Award, badge: 'Nilai' },
        { id: 'ai_executive', label: 'AI Holistik', icon: Sparkles, badge: 'AI', highlight: true },
      ];
    case 'osis':
      return [
        { id: 'osis_posko', label: 'Posko OSIS', icon: Shield, badge: 'Posko' },
        { id: 'osis_input', label: 'Input Kelakuan', icon: UserPlus, badge: 'Input' },
        { id: 'osis_riwayat', label: 'Riwayat Laporan', icon: ClipboardList, badge: `${osisReportsCount || 0}` },
      ];
    default:
      return [];
  }
}

const ROLES_LIST = [
  { id: 'superadmin', name: 'Super Admin', emoji: '🔧' },
  { id: 'admin_riayah', name: "Admin Ri'ayah", emoji: '🏛️' },
  { id: 'parent', name: 'Wali Santri', emoji: '👨‍👩‍👧' },
  { id: 'musyrif', name: 'Musyrif', emoji: '📋' },
  { id: 'security', name: 'Satpam Gate', emoji: '🛡️' },
  { id: 'poskestren', name: 'Poskestren', emoji: '🏥' },
  { id: 'kyai', name: 'Pimpinan Mudir', emoji: '👳' },
  { id: 'osis', name: 'Pengurus OSIS', emoji: '👮' },
];

/* ─────────────────────────────────────────────
   TOOLTIP
───────────────────────────────────────────── */
function Tooltip({ label, badge, isLight }) {
  return (
    <div className={`
      absolute left-full top-1/2 -translate-y-1/2 ml-3 z-[200]
      px-3 py-2 rounded-xl shadow-2xl border min-w-max pointer-events-none
      ${isLight
        ? 'bg-white text-slate-900 border-slate-200'
        : 'bg-slate-800 text-white border-slate-700'
      }
    `}>
      <div className="text-xs font-bold">{label}</div>
      {badge && <div className="text-[10px] text-slate-400 font-mono mt-0.5">{badge}</div>}
      <span className={`absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent ${isLight ? 'border-r-white' : 'border-r-slate-800'}`} />
    </div>
  );
}

/* ─────────────────────────────────────────────
   SIDEBAR COMPONENT
───────────────────────────────────────────── */
export default function Sidebar({ onOpenFlutterModal }) {
  const {
    role,
    setRole,
    currentUser,
    logout,
    permits,
    rooms,
    santriList,
    blacklistedUids,
    gateLogs,
    medicalRecords,
    activeRoleTab,
    setActiveRoleTab,
    setIsRfidModalOpen,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
    reminderThresholdMinutes,
    setIsWaDrawerOpen,
    unreadWaCount,
    setUnreadWaCount,
    isFonnteEnabled,
    visitBookings,
    manualReplyNeededCount,
    osisReports
  } = useApp();

  const [showDevSwitcher, setShowDevSwitcher] = useState(false);
  const [hoveredItem, setHoveredItem] = useState(null);

  // Stats
  const pendingPermitsCount = permits.filter(p => p.status === 'PENDING').length;
  const santriDiLuar = santriList.filter(s => s.statusAsrama === 'DI_LUAR' || s.statusAsrama === 'TERLAMBAT').length;
  const pendingVisitsCount = Array.isArray(visitBookings) 
    ? visitBookings.filter(b => b.status_kunjungan === 'Menunggu Approval').length 
    : 0;
  const pendingOsisCount = Array.isArray(osisReports)
    ? osisReports.filter(r => r.status === 'PENDING_ADMIN').length
    : 0;
  const osisReportsCount = Array.isArray(osisReports) ? osisReports.length : 0;
  const now = Date.now();
  const warningPermitsCount = permits.filter(p => {
    if (p.status !== 'ACTIVE') return false;
    const diff = (new Date(p.batasKembali).getTime() - now) / 60000;
    return diff <= (reminderThresholdMinutes || 30) && diff > 0;
  }).length;

  const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.superadmin;
  const isLight = cfg.isLight;

  const menuItems = getMenuItems(role, {
    permits, rooms, santriList, blacklistedUids, gateLogs, medicalRecords,
    pendingPermitsCount, warningPermitsCount, santriDiLuar, pendingVisitsCount,
    manualReplyNeededCount, pendingOsisCount, osisReportsCount
  });

  const handleMenuClick = (id) => {
    sound.playBeep();
    setActiveRoleTab(id);
    if (window.innerWidth < 1024) setIsMobileSidebarOpen(false);
  };

  // On mobile/tablet, the sidebar drawer is always full width and expanded
  const isCollapsed = isSidebarCollapsed && !isMobileSidebarOpen;

  // Theme tokens
  const sidebarBg = isLight ? 'bg-white border-slate-200' : 'bg-slate-950 border-slate-800/60';
  const textBase = isLight ? 'text-slate-700' : 'text-slate-300';
  const textMuted = isLight ? 'text-slate-400' : 'text-slate-600';
  const borderColor = isLight ? 'border-slate-100' : 'border-slate-800/60';
  const sectionLabelColor = isLight ? 'text-slate-400' : 'text-slate-600';

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      <aside className={`
        fixed top-0 bottom-0 left-0 z-50 flex flex-col border-r transition-all duration-300 ease-in-out shadow-2xl
        ${sidebarBg}
        w-72 max-w-[85vw] ${isSidebarCollapsed ? 'lg:w-[68px]' : 'lg:w-64'}
        ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>

        {/* ═══ HEADER ═══ */}
        <div className={`shrink-0 ${cfg.headerBg} flex items-center gap-3 px-3 py-3.5`}>
          <div className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-white/15 border border-white/20">
            <Building2 className="w-5 h-5 text-white" />
          </div>

          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-white font-black text-sm leading-tight">Smart Permit</div>
              <div className="text-white/65 text-[10px] font-semibold">&amp; Smart Ri'ayah</div>
            </div>
          )}

          {/* Collapse / Close buttons */}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg bg-white/10 hover:bg-white/25 text-white/80 hover:text-white transition shrink-0 ml-auto"
            title={isSidebarCollapsed ? 'Buka' : 'Perkecil'}
          >
            {isSidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setIsMobileSidebarOpen(false)}
            className="lg:hidden flex items-center justify-center w-7 h-7 rounded-lg bg-white/10 hover:bg-white/25 text-white/80 transition shrink-0 ml-auto"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ═══ USER PROFILE ═══ */}
        {currentUser && (
          <div className={`shrink-0 flex items-center gap-2.5 px-3 py-3 border-b ${borderColor} ${isCollapsed ? 'justify-center' : ''}`}>
            <div className="relative shrink-0">
              <img
                src={currentUser.avatar || '/images/avatar_santri_putra.jpg'}
                alt={currentUser.nama}
                className="w-8 h-8 rounded-full object-cover"
                style={{ outline: `2px solid ${cfg.accent}`, outlineOffset: '1px' }}
              />
              <span
                className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
                style={{ background: cfg.accent, borderColor: isLight ? 'white' : '#0f172a' }}
              />
            </div>

            {!isCollapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-bold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {currentUser.nama}
                  </div>
                  <div className="text-[10px] font-semibold truncate" style={{ color: cfg.accent }}>
                    {cfg.label}
                  </div>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold shrink-0 ${cfg.badge}`}>
                  {currentUser.role === 'superadmin' ? 'DEV' : 'ON'}
                </span>
              </>
            )}
          </div>
        )}

        {/* ═══ NAV ═══ */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {!isCollapsed && (
            <div className={`px-2 pb-2 text-[10px] font-bold uppercase tracking-widest ${sectionLabelColor}`}>
              Menu Utama
            </div>
          )}

          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeRoleTab === item.id;

            return (
              <div
                key={item.id}
                className="relative"
                onMouseEnter={() => isCollapsed && setHoveredItem(item.id)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <button
                  onClick={() => handleMenuClick(item.id)}
                  title={!isCollapsed ? item.label : undefined}
                  className={`
                    w-full flex items-center rounded-xl transition-all duration-150 group
                    ${isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-2.5 py-2.5'}
                    ${isActive
                      ? `border ${cfg.activeBg} font-semibold`
                      : `border border-transparent ${cfg.hoverBg} ${textBase}`
                    }
                  `}
                >
                  {/* Icon box */}
                  <div className={`
                    shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150
                    ${isActive
                      ? cfg.activeIcon
                      : isLight
                        ? 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700'
                        : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-slate-200'
                    }
                  `}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>

                  {/* Label + badge */}
                  {!isCollapsed && (
                    <>
                      <span className="flex-1 text-xs font-semibold text-left leading-tight truncate">
                        {item.label}
                      </span>
                      {item.badge && (
                        <span className={`
                          text-[9px] px-1.5 py-0.5 rounded-md font-bold leading-none shrink-0
                          ${item.urgent
                            ? 'bg-red-500 text-white animate-pulse'
                            : item.highlight
                              ? isLight
                                ? 'bg-indigo-100 text-indigo-600'
                                : 'bg-indigo-500/20 text-indigo-300'
                              : isLight
                                ? 'bg-slate-100 text-slate-500'
                                : 'bg-slate-800 text-slate-400'
                          }
                        `}>
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}

                  {/* Urgent dot (collapsed) */}
                  {isCollapsed && item.urgent && item.badge && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  )}
                </button>

                {/* Tooltip on collapsed hover */}
                {isCollapsed && hoveredItem === item.id && (
                  <Tooltip label={item.label} badge={item.badge} isLight={isLight} />
                )}
              </div>
            );
          })}
        </nav>

        {/* ═══ BOTTOM ACTIONS ═══ */}
        <div className={`shrink-0 border-t ${borderColor} px-2 py-3 space-y-1.5`}>

          {/* Live WhatsApp Gateway Button in Sidebar (HANYA DITAMPILKAN UNTUK ROLE ADMIN RI'AYAH) */}
          {role === 'admin_riayah' && (
            !isCollapsed ? (
              <button
                onClick={() => {
                  setActiveRoleTab('whatsapp_manager');
                  setUnreadWaCount(0);
                  sound.playBeep?.();
                  if (window.innerWidth < 1024) setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition group ${
                  isLight
                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm'
                    : 'bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-300 border border-emerald-800/60 shadow-sm'
                }`}
                title="Buka Live WhatsApp Gateway"
              >
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-500 group-hover:scale-110 transition" />
                    {manualReplyNeededCount > 0 && (
                      <span className="absolute -top-1 -right-1.5 bg-rose-600 text-white text-[9px] min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center font-bold shadow-sm animate-pulse">
                        {manualReplyNeededCount}
                      </span>
                    )}
                  </div>
                  <span>WhatsApp Gateway</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                  isLight ? 'bg-emerald-200/70 text-emerald-800' : 'bg-emerald-500/20 text-emerald-300'
                }`}>
                  {isFonnteEnabled ? 'Live' : 'Simulasi'}
                </span>
              </button>
            ) : (
              <div className="flex justify-center">
                <button
                  onClick={() => {
                    setActiveRoleTab('whatsapp_manager');
                    setUnreadWaCount(0);
                    sound.playBeep?.();
                  }}
                  className={`p-2 rounded-xl transition relative ${
                    isLight ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700' : 'bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-400'
                  }`}
                  title="Buka Live WhatsApp Gateway"
                >
                  <MessageSquare className="w-4 h-4" />
                  {manualReplyNeededCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[9px] min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center font-bold">
                      {manualReplyNeededCount}
                    </span>
                  )}
                </button>
              </div>
            )
          )}

          {/* Posko Pengurus OSIS Button in Sidebar (Khusus Admin Ri'ayah & Super Admin) */}
          {(role === 'admin_riayah' || role === 'superadmin') && (
            !isCollapsed ? (
              <button
                onClick={() => {
                  sound.playSuccess();
                  setRole('osis');
                  if (window.innerWidth < 1024) setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition group ${
                  isLight
                    ? 'bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 shadow-sm'
                    : 'bg-teal-950/60 hover:bg-teal-900/70 text-teal-300 border border-teal-800/60 shadow-sm'
                }`}
                title="Buka Posko Pengurus OSIS (Input Kelakuan Santri/Wati)"
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-teal-400 group-hover:scale-110 transition" />
                  <span>Posko Pengurus OSIS</span>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                  isLight ? 'bg-teal-200/70 text-teal-800' : 'bg-teal-500/20 text-teal-300'
                }`}>
                  Baru
                </span>
              </button>
            ) : (
              <div className="flex justify-center">
                <button
                  onClick={() => {
                    sound.playSuccess();
                    setRole('osis');
                  }}
                  className={`p-2 rounded-xl transition relative ${
                    isLight ? 'bg-teal-50 hover:bg-teal-100 text-teal-700' : 'bg-teal-950/60 hover:bg-teal-900/70 text-teal-400'
                  }`}
                  title="Buka Posko Pengurus OSIS"
                >
                  <Shield className="w-4 h-4" />
                </button>
              </div>
            )
          )}

          {/* Quick Back to Admin Ri'ayah if currently in OSIS role */}
          {role === 'osis' && !isCollapsed && (
            <button
              onClick={() => {
                sound.playSuccess();
                setRole('admin_riayah');
                if (window.innerWidth < 1024) setIsMobileSidebarOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700 shadow-sm cursor-pointer"
              title="Kembali ke Dashboard Admin Ri'ayah"
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Kembali ke Admin Ri'ayah</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Dev Role Switcher */}
          {(currentUser?.role === 'superadmin' || currentUser?.role === 'admin_riayah' || !currentUser) && !isCollapsed && (
            <div>
              <button
                onClick={() => setShowDevSwitcher(!showDevSwitcher)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition
                  ${isLight
                    ? 'bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200'
                    : 'bg-cyan-950/50 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/50'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Ganti / Preview Role (8 Role)</span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDevSwitcher ? 'rotate-180' : ''}`} />
              </button>

              {showDevSwitcher && (
                <div className={`mt-1 p-1.5 rounded-xl border space-y-0.5
                  ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'}
                `}>
                  {ROLES_LIST.map(r => (
                    <button
                      key={r.id}
                      onClick={() => { setRole(r.id); sound.playSuccess(); setShowDevSwitcher(false); }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition flex items-center gap-2
                        ${role === r.id
                          ? 'bg-cyan-800 text-cyan-100'
                          : isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-slate-800 text-slate-300'
                        }`}
                    >
                      <span>{r.emoji}</span>
                      <span className="flex-1">{r.name}</span>
                      {role === r.id && <span className="text-cyan-400 text-[9px] font-bold">AKTIF</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Logout */}
          {!isCollapsed ? (
            <button
              onClick={() => { if (window.confirm('Keluar dari sesi ini?')) logout(); }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition
                ${isLight
                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200'
                  : 'bg-rose-950/40 hover:bg-rose-900/50 text-rose-400 border border-rose-900/50'
                }`}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar / Ganti Role</span>
            </button>
          ) : (
            <div className="flex justify-center">
              <button
                onClick={() => { if (window.confirm('Keluar?')) logout(); }}
                className={`p-2 rounded-xl transition
                  ${isLight ? 'bg-rose-50 hover:bg-rose-100 text-rose-600' : 'bg-rose-950/40 hover:bg-rose-900/50 text-rose-400'}
                `}
                title="Keluar"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* ═══ FOOTER ═══ */}
        {!isCollapsed && (
          <div className={`shrink-0 px-4 py-2 border-t ${borderColor} flex items-center justify-between`}>
            <span className={`text-[9px] font-mono ${textMuted}`}>Darul Ulum © 2026</span>
            <span className="text-[9px] font-bold" style={{ color: cfg.accent }}>v3.8</span>
          </div>
        )}
      </aside>
    </>
  );
}
