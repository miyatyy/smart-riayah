import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  Calendar,
  Sparkles,
  Award,
  ShoppingBag,
  Menu,
  ShieldCheck,
  BellRing,
  ClipboardList,
  Radio,
  Users,
  Activity,
  Building2,
  UserPlus,
  CreditCard,
  Cpu,
  Layers,
  HeartPulse,
  PlusCircle,
  ShieldAlert,
  TrendingUp,
  Smartphone
} from 'lucide-react';
import { sound } from '../../utils/audio';

// Bottom navigation configuration tailored per role (Top 4 actions + 1 Menu button)
const MOBILE_NAV_CONFIG = {
  superadmin: [
    { id: 'diagnostics', label: 'IoT Live', icon: Cpu },
    { id: 'users', label: 'Akun', icon: Users },
    { id: 'rfid_pairing', label: 'Scan RFID', icon: Radio },
    { id: 'ai_agent', label: 'AI Agent', icon: Sparkles, isAi: true },
  ],
  admin_riayah: [
    { id: 'rooms', label: 'Gedung', icon: Building2 },
    { id: 'onboarding', label: 'Santri', icon: UserPlus },
    { id: 'rfid_cards', label: 'Kartu RFID', icon: CreditCard },
    { id: 'gate_logs', label: 'Log Gate', icon: ClipboardList },
  ],
  parent: [
    { id: 'permit', label: 'Izin', icon: Calendar },
    { id: 'aktivitas', label: 'Aktivitas', icon: Sparkles, isAi: true },
    { id: 'riayah', label: 'Poin', icon: Award },
    { id: 'cashless', label: 'Dompet', icon: ShoppingBag },
  ],
  musyrif: [
    { id: 'approval', label: 'Otorisasi', icon: ShieldCheck, hasBadge: 'pending' },
    { id: 'alarm_monitor', label: 'Alarm', icon: BellRing, hasBadge: 'warning' },
    { id: 'active_permits', label: 'Papan Izin', icon: ClipboardList },
    { id: 'ai_santri', label: 'AI Santri', icon: Sparkles, isAi: true },
  ],
  security: [
    { id: 'gate', label: 'Gate 01', icon: Radio },
    { id: 'headcount', label: 'Headcount', icon: Users, hasBadge: 'diluar' },
    { id: 'logs', label: 'Audit Log', icon: Activity },
    { id: 'ai_security', label: 'Pola AI', icon: Sparkles, isAi: true },
  ],
  poskestren: [
    { id: 'rekam_medis', label: 'Medis', icon: HeartPulse },
    { id: 'periksa_baru', label: 'Periksa', icon: PlusCircle },
    { id: 'rujukan_rs', label: 'Rujukan', icon: ShieldAlert },
    { id: 'ai_health', label: 'AI Medis', icon: Sparkles, isAi: true },
  ],
  kyai: [
    { id: 'ringkasan', label: 'Ringkasan', icon: TrendingUp },
    { id: 'tren_izin', label: 'Tren Izin', icon: Activity },
    { id: 'rapor_adab', label: 'Rapor', icon: Award },
    { id: 'ai_executive', label: 'AI Holistik', icon: Sparkles, isAi: true },
  ],
};

export default function MobileBottomNav({ onOpenFlutterModal }) {
  const {
    role,
    activeRoleTab,
    setActiveRoleTab,
    setIsMobileSidebarOpen,
    permits,
    santriList,
    reminderThresholdMinutes
  } = useApp();

  // Badges calculation
  const pendingPermitsCount = permits.filter(p => p.status === 'PENDING').length;
  const santriDiLuar = santriList.filter(s => s.statusAsrama === 'DI_LUAR' || s.statusAsrama === 'TERLAMBAT').length;
  const now = Date.now();
  const warningPermitsCount = permits.filter(p => {
    if (p.status !== 'ACTIVE') return false;
    const diff = (new Date(p.batasKembali).getTime() - now) / 60000;
    return diff <= (reminderThresholdMinutes || 30) && diff > 0;
  }).length;

  const navItems = MOBILE_NAV_CONFIG[role] || MOBILE_NAV_CONFIG.parent;

  const handleNavClick = (id) => {
    sound.playBeep?.();
    setActiveRoleTab(id);
  };

  const getBadgeValue = (badgeType) => {
    if (badgeType === 'pending' && pendingPermitsCount > 0) return pendingPermitsCount;
    if (badgeType === 'warning' && warningPermitsCount > 0) return warningPermitsCount;
    if (badgeType === 'diluar' && santriDiLuar > 0) return santriDiLuar;
    return null;
  };

  return (
    <nav
      aria-label="Mobile Navigation Bar"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] px-2 py-1.5 transition-all select-none"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeRoleTab === item.id;
          const badgeVal = item.hasBadge ? getBadgeValue(item.hasBadge) : null;

          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-150 active:scale-95 min-w-[56px] ${
                isActive
                  ? 'text-emerald-700 font-bold'
                  : 'text-slate-500 hover:text-slate-800 font-medium'
              }`}
            >
              <div className="relative">
                <div
                  className={`p-1 rounded-xl transition-all ${
                    isActive
                      ? 'bg-emerald-100/90 text-emerald-700 shadow-xs ring-1 ring-emerald-300'
                      : item.isAi
                      ? 'text-indigo-600'
                      : ''
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>

                {/* Badge indicator */}
                {badgeVal !== null && (
                  <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center border-2 border-white animate-pulse">
                    {badgeVal}
                  </span>
                )}

                {/* AI dot */}
                {item.isAi && !isActive && (
                  <span className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                )}
              </div>

              <span className={`text-[10px] mt-0.5 tracking-tight truncate max-w-[62px] ${
                isActive ? 'text-emerald-800 font-bold' : 'text-slate-600'
              }`}>
                {item.label}
              </span>
            </button>
          );
        })}

        {/* 5th Button: Drawer Menu / More */}
        <button
          onClick={() => {
            sound.playBeep?.();
            setIsMobileSidebarOpen(true);
          }}
          className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-slate-500 hover:text-slate-900 active:scale-95 transition-all min-w-[56px]"
          title="Buka Menu Lengkap & Pengaturan"
        >
          <div className="p-1 rounded-xl hover:bg-slate-100 transition">
            <Menu className="w-5 h-5 text-slate-700" />
          </div>
          <span className="text-[10px] text-slate-600 font-medium mt-0.5">
            Menu
          </span>
        </button>
      </div>
    </nav>
  );
}
