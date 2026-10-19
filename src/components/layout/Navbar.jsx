import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Menu,
  CreditCard,
  MessageSquare,
  Volume2,
  Radio,
  Users,
  ShieldCheck,
  HeartPulse,
  TrendingUp,
  LogOut,
  Cpu,
  Wrench,
  Bot,
  Wifi,
  WifiOff,
  ChevronDown,
  Home,
  Activity,
  Bell,
} from 'lucide-react';
import { sound } from '../../utils/audio';

// ─── Role config — icon + short label + color ───────────────────────────────
const ROLE_META = {
  superadmin:   { label: 'Super Admin',  icon: Cpu,        color: 'text-cyan-400',    bg: 'bg-cyan-950',   ring: 'ring-cyan-700' },
  admin_riayah: { label: 'Admin Ri\'ayah', icon: Wrench,   color: 'text-emerald-300', bg: 'bg-emerald-950', ring: 'ring-emerald-700' },
  parent:       { label: 'Wali Santri',  icon: Users,      color: 'text-emerald-700', bg: 'bg-emerald-50',  ring: 'ring-emerald-300' },
  musyrif:      { label: 'Musyrif',      icon: ShieldCheck, color: 'text-teal-700',   bg: 'bg-teal-50',    ring: 'ring-teal-300' },
  security:     { label: 'Keamanan',    icon: Radio,       color: 'text-cyan-400',    bg: 'bg-slate-900',  ring: 'ring-cyan-500' },
  poskestren:   { label: 'Klinik',       icon: HeartPulse,  color: 'text-rose-700',   bg: 'bg-rose-50',    ring: 'ring-rose-300' },
  kyai:         { label: 'Pimpinan',     icon: TrendingUp,  color: 'text-amber-700',  bg: 'bg-amber-50',   ring: 'ring-amber-300' },
};

// ─── Simple Tooltip wrapper ──────────────────────────────────────────────────
function Tip({ label, children, side = 'bottom' }) {
  const [show, setShow] = useState(false);
  const posClass = side === 'bottom'
    ? 'top-full mt-2 left-1/2 -translate-x-1/2'
    : 'top-full mt-2 right-0';

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      {show && label && (
        <div className={`absolute ${posClass} z-50 pointer-events-none`}>
          <div className="bg-slate-900 text-white text-[11px] font-medium px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap">
            {label}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Icon-only action button ─────────────────────────────────────────────────
function NavBtn({ icon: Icon, onClick, tooltip, badge, variant = 'ghost', className = '' }) {
  const base = 'relative flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-400';
  const variants = {
    ghost:   'bg-transparent hover:bg-slate-100 text-slate-500 hover:text-slate-800',
    wa:      'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/25',
    ai:      'bg-gradient-to-br from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white shadow-md shadow-indigo-500/25',
    danger:  'bg-transparent hover:bg-rose-50 text-slate-400 hover:text-rose-600',
  };

  return (
    <Tip label={tooltip} side="bottom">
      <button onClick={onClick} className={`${base} ${variants[variant]} ${className}`}>
        <Icon className="w-4 h-4" />
        {badge > 0 && (
          <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white animate-bounce">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
        {/* AI pulse dot */}
        {variant === 'ai' && (
          <span className="absolute top-1 right-1 flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-300 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
          </span>
        )}
      </button>
    </Tip>
  );
}

export default function Navbar({ onOpenFlutterModal }) {
  const {
    role,
    setRole,
    currentUser,
    logout,
    santriList,
    unreadWaCount,
    setUnreadWaCount,
    isWaDrawerOpen,
    setIsWaDrawerOpen,
    setActiveRoleTab,
    setIsMobileSidebarOpen,
    isSerialConnected,
    connectSerial,
    disconnectSerial,
    setIsSerialMonitorOpen,
    setIsAiAgentOpen,
  } = useApp();

  const [time, setTime] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);

  // Live clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const meta = ROLE_META[role] || ROLE_META.parent;
  const RoleIcon = meta.icon;

  const santriDiLuar = santriList.filter(s => s.statusAsrama === 'DI_LUAR' || s.statusAsrama === 'TERLAMBAT').length;
  const santriDiPondok = santriList.length - santriDiLuar;

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-100 shadow-sm">
      <div className="px-4 h-14 flex items-center justify-between gap-3">

        {/* ── LEFT: Hamburger (mobile) + Role badge ─────────────────── */}
        <div className="flex items-center gap-2.5 min-w-0">

          {/* Mobile hamburger */}
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="lg:hidden flex items-center justify-center w-9 h-9 rounded-xl hover:bg-slate-100 text-slate-500 transition"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Role pill — compact, icon + short name only */}
          <Tip label={`Mode aktif: ${meta.label}`} side="bottom">
            <div className={`flex items-center gap-1.5 px-2 py-1 sm:px-2.5 rounded-xl ring-1 ${meta.bg} ${meta.ring} cursor-default select-none`}>
              <RoleIcon className={`w-3.5 h-3.5 ${meta.color} shrink-0`} />
              <span className={`text-[11px] sm:text-xs font-bold ${meta.color}`}>
                {meta.label}
              </span>
            </div>
          </Tip>

          {/* Santri headcount — mini stat, desktop only */}
          <Tip label={`${santriDiPondok} di pondok · ${santriDiLuar} di luar`} side="bottom">
            <div className="hidden xl:flex items-center gap-2 bg-slate-50 px-2.5 py-1 rounded-xl ring-1 ring-slate-200 text-xs font-mono cursor-default">
              <span className="flex items-center gap-1 text-emerald-700 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                {santriDiPondok}
              </span>
              <span className="text-slate-300">·</span>
              <span className="flex items-center gap-1 text-amber-600 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                {santriDiLuar}
              </span>
              <Activity className="w-3 h-3 text-slate-400" />
            </div>
          </Tip>
        </div>

        {/* ── RIGHT: Action icons + user avatar ─────────────────────── */}
        <div className="flex items-center gap-1">

          {/* Live time — small, unobtrusive */}
          <span className="hidden md:block text-[11px] font-mono text-slate-400 px-2 tabular-nums select-none">
            {time}
          </span>

          <div className="w-px h-5 bg-slate-200 mx-1 hidden md:block" />

          {/* Sound test (laptop/tablet only) */}
          <NavBtn
            icon={Volume2}
            onClick={() => sound.playSuccess()}
            tooltip="Uji suara notifikasi"
            className="hidden sm:flex"
          />

          {/* ESP32 hardware status (laptop/desktop only) */}
          <NavBtn
            icon={isSerialConnected ? Wifi : WifiOff}
            onClick={() => isSerialConnected ? setIsSerialMonitorOpen(true) : connectSerial()}
            tooltip={isSerialConnected ? 'ESP32 terhubung — klik untuk monitor' : 'ESP32 offline — klik untuk sambungkan'}
            className={`hidden sm:flex ${isSerialConnected ? '!text-emerald-600 hover:!bg-emerald-50' : '!text-amber-500 hover:!bg-amber-50'}`}
          />

          {/* RFID Card Manager (laptop/tablet) */}
          <NavBtn
            icon={CreditCard}
            onClick={() => {
              if (role !== 'admin_riayah' && role !== 'superadmin') setRole('admin_riayah');
              setActiveRoleTab('rfid_cards');
            }}
            tooltip="Kelola kartu RFID santri"
            className="hidden md:flex"
          />

          {/* Flutter Mobile & REST API Integration */}
          <NavBtn
            icon={Smartphone}
            onClick={onOpenFlutterModal}
            tooltip="Integrasi Mobile Flutter & REST API"
            className="hidden sm:flex !text-cyan-700 hover:!bg-cyan-50"
          />

          <div className="w-px h-5 bg-slate-200 mx-1 hidden sm:block" />

          {/* WhatsApp Gateway */}
          <NavBtn
            icon={MessageSquare}
            onClick={() => { setIsWaDrawerOpen(!isWaDrawerOpen); setUnreadWaCount(0); }}
            tooltip="WhatsApp Gateway"
            badge={unreadWaCount}
            variant="wa"
          />

          {/* AI Agent */}
          <NavBtn
            icon={Bot}
            onClick={() => { setIsAiAgentOpen(true); sound.playSuccess?.(); }}
            tooltip="Smart Riayah AI Agent"
            variant="ai"
          />

          <div className="w-px h-5 bg-slate-200 mx-1" />

          {/* User avatar + dropdown */}
          {currentUser && (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(v => !v)}
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-slate-100 transition group"
              >
                <img
                  src={currentUser.avatar || '/images/avatar_santri_putra.jpg'}
                  alt={currentUser.nama}
                  className="w-7 h-7 rounded-full object-cover ring-2 ring-emerald-400 ring-offset-1"
                />
                <span className="hidden lg:block text-xs font-semibold text-slate-700 max-w-[100px] truncate">
                  {currentUser.nama?.split(' ')[0]}
                </span>
                <ChevronDown className={`hidden lg:block w-3.5 h-3.5 text-slate-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown */}
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-50 animate-fade-in">
                  {/* User info */}
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-800 truncate">{currentUser.nama}</p>
                    <p className="text-[11px] text-emerald-600 font-mono mt-0.5">{meta.label}</p>
                  </div>

                  {/* Quick links */}
                  <button
                    onClick={() => { setShowUserMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-slate-600 hover:bg-slate-50 transition text-left"
                  >
                    <Home className="w-3.5 h-3.5 text-slate-400" />
                    Dashboard
                  </button>

                  <button
                    onClick={() => { setIsSerialMonitorOpen(true); setShowUserMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-slate-600 hover:bg-slate-50 transition text-left"
                  >
                    <Cpu className="w-3.5 h-3.5 text-slate-400" />
                    Serial Monitor ESP32
                    {isSerialConnected
                      ? <span className="ml-auto text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">ON</span>
                      : <span className="ml-auto text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">OFF</span>
                    }
                  </button>

                  <button
                    onClick={() => { onOpenFlutterModal?.(); setShowUserMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-slate-600 hover:bg-slate-50 transition text-left"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-cyan-600" />
                    Integrasi Flutter Mobile
                    <span className="ml-auto text-[10px] bg-cyan-100 text-cyan-800 px-1.5 py-0.5 rounded-full font-bold">API</span>
                  </button>

                  <div className="my-1 mx-3 border-t border-slate-100" />

                  {/* Logout */}
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      if (window.confirm('Keluar dari sesi ini?')) logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-rose-600 hover:bg-rose-50 transition text-left font-semibold"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
