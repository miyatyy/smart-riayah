import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Radio, 
  ShieldAlert, 
  ShieldCheck, 
  AlertOctagon, 
  Clock, 
  Camera, 
  UserCheck, 
  PhoneCall, 
  Flame, 
  Sparkles, 
  Lock, 
  Unlock, 
  CheckCircle, 
  XCircle,
  Wifi,
  Cpu,
  Layers,
  Zap,
  Volume2,
  BellRing,
  CreditCard,
  Terminal
} from 'lucide-react';
import { sound } from '../../utils/audio';
import VirtualOledDisplay from '../common/VirtualOledDisplay';
import RealtimePermitsTable from '../modules/RealtimePermitsTable';
import RealtimeGateLogsManager from '../modules/RealtimeGateLogsManager';
import FonnteSettingsBox from '../common/FonnteSettingsBox';
import SantriActivityAnalytics from '../modules/SantriActivityAnalytics';

export default function SecurityCommandCenter() {
  const { 
    santriList, 
    permits, 
    gateLogs, 
    gateState, 
    tapGateRFID, 
    simulateWarning30Min, 
    simulateOverdue,
    setIsRfidManagerModalOpen,
    isSerialConnected,
    connectSerial,
    disconnectSerial,
    lastScannedUid,
    setIsSerialMonitorOpen,
    activeRoleTab,
    setActiveRoleTab
  } = useApp();

  const activeTab = activeRoleTab === 'ai_security' ? 'ai_security' : 'gate';
  const setActiveTab = setActiveRoleTab;

  const [selectedSantriId, setSelectedSantriId] = useState('S-101'); // Default Ahmad Fauzi
  const [gateAction, setGateAction] = useState('EXIT'); // 'EXIT' or 'ENTRY'

  // Headcount calculation
  const totalPutra = 780;
  const totalPutri = 702;
  const totalAll = totalPutra + totalPutri; // 1482 Santri

  const allPermits = Array.isArray(permits) ? permits : [];
  const allSantri = Array.isArray(santriList) ? santriList : [];

  const activePermitsOut = allPermits.filter(p => p && (p.status === 'ACTIVE' || p.status === 'OVERDUE'));
  const countDiLuar = activePermitsOut.length;
  const countDiAsrama = totalAll - countDiLuar;
  const percentageDiAsrama = ((countDiAsrama / totalAll) * 100).toFixed(1);

  // Selected santri object
  const currentSantri = allSantri.find(s => s && s.id === selectedSantriId) || allSantri[0] || {
    id: 'S-101',
    nama: 'Ahmad Fauzi',
    rfidUid: '04:A1:2B:9C',
    nis: '125456',
    kamar: 'Umar bin Khattab 204',
    wali: { nama: 'Ibu Fatimah Az-Zahra' },
    foto: '/images/avatar_santri_putra.jpg'
  };
  const santriPermit = allPermits.find(p => p && (
    p.santriId === currentSantri?.id ||
    (currentSantri?.nama && p.santriNama && p.santriNama.trim().toLowerCase() === currentSantri.nama.trim().toLowerCase()) ||
    (allSantri.find(o => o.id === p.santriId)?.nama?.trim()?.toLowerCase() === currentSantri?.nama?.trim()?.toLowerCase())
  ) && (p.status === 'APPROVED' || p.status === 'ACTIVE' || p.status === 'OVERDUE' || p.status === 'PENDING'));

  // Live Timer for countdowns
  const [countdownMap, setCountdownMap] = useState({});

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const newMap = {};

      activePermitsOut.forEach(p => {
        const deadline = new Date(p.batasKembali).getTime();
        const diff = deadline - now;

        if (diff > 0) {
          const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
          const minutes = Math.floor((diff / (1000 * 60)) % 60);
          const seconds = Math.floor((diff / 1000) % 60);
          newMap[p.id] = {
            text: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
            isOverdue: false,
            isWarning: diff < 30 * 60 * 1000
          };
        } else {
          newMap[p.id] = {
            text: 'OVERDUE (TERLAMBAT)',
            isOverdue: true,
            isWarning: false
          };
        }
      });

      setCountdownMap(newMap);
    }, 1000);

    return () => clearInterval(interval);
  }, [activePermitsOut]);

  return (
    <div className="bg-slate-50 text-slate-800 min-h-screen pb-20 pt-4 px-4 sm:px-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Command Center Clean Topbar */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-xs">
              <Radio className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono uppercase bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded font-bold tracking-wider">
                  SECURITY COMMAND CENTER
                </span>
                <span className="text-emerald-700 text-xs font-mono font-medium flex items-center gap-1">
                  <Wifi className="w-3 h-3" /> IoT Turnstile ONLINE
                </span>
                <span className="text-slate-600 text-[10px] font-mono flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Multi-Akun Sync ({santriList.length} Santri)
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Pos Satpam & IoT Smart Turnstile Gate 01
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            {/* Hardware Web Serial USB Status & Connection Control (Intuitif Hijau/Merah) */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono shadow-xs transition ${
              isSerialConnected 
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              <span className={`h-2.5 w-2.5 rounded-full ${isSerialConnected ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`} />
              <span className="font-bold">
                {isSerialConnected ? 'ESP32 RC522: ONLINE' : 'ESP32 USB: BELUM TERSAMBUNG'}
              </span>
              {isSerialConnected ? (
                <button
                  onClick={disconnectSerial}
                  className="ml-1 text-[10px] text-rose-600 hover:text-rose-800 underline font-bold"
                  title="Putuskan Port Serial"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={connectSerial}
                  className="ml-1.5 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] shadow-xs transition"
                >
                  ⚡ Hubungkan USB
                </button>
              )}
            </div>

            <button
              onClick={() => setIsSerialMonitorOpen(true)}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition"
              title="Buka Live Serial Monitor Terminal"
            >
              <Terminal className="w-3.5 h-3.5 text-slate-600" />
              <span>Monitor Serial</span>
            </button>

            <button
              onClick={() => setIsRfidManagerModalOpen(true)}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition"
              title="Kelola & Pasangkan Kartu RFID"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Kelola Kartu RFID</span>
            </button>

            <button
              onClick={() => sound.playBeep()}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl border border-slate-200 transition"
              title="Test Sensor Beep"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveTab('gate')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs ${
              activeTab === 'gate'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Radio className="w-4 h-4 text-cyan-400" />
            <span>Simulator Smart Gate & Headcount</span>
          </button>

          <button
            onClick={() => setActiveTab('ai_security')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs ${
              activeTab === 'ai_security'
                ? 'bg-indigo-700 text-white shadow-indigo-200'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>🤖 AI Pola Gerbang & Kedisiplinan Santri (DeepSeek)</span>
          </button>
        </div>

        {/* TAB 2: AI POLA GERBANG & KEDISIPLINAN */}
        {activeTab === 'ai_security' && (
          <div className="space-y-6 animate-fade-in">
            <SantriActivityAnalytics />
          </div>
        )}

        {/* TAB 1: SMART GATE & HEADCOUNT COMMAND CENTER */}
        {activeTab === 'gate' && (
        <>
        {/* 1. LIVE DORMITORY HEADCOUNT WIDGET */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
            <span className="text-[11px] font-mono text-emerald-700 uppercase tracking-wider block mb-1 font-bold">
              TOTAL SANTRI DI ASRAMA
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 font-mono">{countDiAsrama.toLocaleString('id-ID')}</span>
              <span className="text-xs font-bold text-emerald-600">({percentageDiAsrama}%)</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Santri putra & putri di dalam kawasan asrama
            </p>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
            <span className="text-[11px] font-mono text-amber-700 uppercase tracking-wider block mb-1 font-bold">
              IZIN KELUAR AKTIF (DI LUAR)
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-amber-600 font-mono">{countDiLuar}</span>
              <span className="text-xs font-bold text-amber-700">Santri</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Terverifikasi lewat Smart Turnstile Gate
            </p>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
            <span className="text-[11px] font-mono text-cyan-700 uppercase tracking-wider block mb-1 font-bold">
              HEADCOUNT PUTRA & PUTRI
            </span>
            <div className="flex items-center justify-between text-xs font-mono font-bold pt-1">
              <span className="text-cyan-700">Putra: {totalPutra}</span>
              <span className="text-pink-700">Putri: {totalPutri}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden flex border border-slate-200">
              <div className="bg-cyan-500 h-full w-[52%]"></div>
              <div className="bg-pink-400 h-full w-[48%]"></div>
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
            <span className="text-[11px] font-mono text-rose-700 uppercase tracking-wider block mb-1 font-bold">
              STATUS KETERLAMBATAN (OVERDUE)
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-rose-600 font-mono">
                {permits.filter(p => p.status === 'OVERDUE').length}
              </span>
              <span className="text-xs font-bold text-rose-700 animate-pulse">ALARM AKTIF</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Auto-potong poin disiplin & kirim WA darurat
            </p>
          </div>
        </div>

        {/* Live WhatsApp Gateway Fast Settings Box */}
        <FonnteSettingsBox defaultExpanded={false} />

        {/* Hardware Serial Connection Reminder Banner */}
        {!isSerialConnected && (
          <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 text-xs shadow-xs">
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-amber-100 text-amber-700 rounded-xl border border-amber-200">
                <Radio className="w-5 h-5 animate-pulse" />
              </span>
              <div>
                <b className="text-slate-900 block text-sm">Alat Scanner RFID ESP32-S3 Belum Terhubung ke Browser</b>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  Kabel USB sudah tercolok ke laptop, namun browser perlu membuka port serial. Silakan klik tombol di samping untuk menyambungkan port USB.
                </p>
              </div>
            </div>
            <button
              onClick={connectSerial}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition shrink-0 flex items-center gap-1.5"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>Hubungkan Alat USB Sekarang</span>
            </button>
          </div>
        )}

        {/* 2. INTERACTIVE IOT TURNSTILE GATE & RFID SIMULATOR (FOKUS DI TENGAH LAYAR) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

          {/* Left: Gate Status Screen & Palang Barrier Simulation (7 Cols) */}
          <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              {/* Header Gate Monitor */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    gateState.status === 'GRANTED' ? 'bg-emerald-500 animate-ping' :
                    gateState.status === 'DENIED' ? 'bg-rose-500 animate-bounce' :
                    'bg-slate-400'
                  }`}></div>
                  <span className="font-mono text-xs font-bold text-slate-800 uppercase">
                    SMART TURNSTILE 01 • GERBANG ASRAMA
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="text-slate-500">SENSOR:</span>
                  <span className="text-emerald-700 font-bold">RFID RC522 13.56 MHz</span>
                </div>
              </div>

              {/* Status Outcome HUD Screen (Ukuran Besar & Jelas di Tengah Layar) */}
              <div className={`rounded-2xl p-5 border transition-all duration-300 ${
                gateState.status === 'GRANTED'
                  ? 'bg-emerald-50/90 border-emerald-300 shadow-xs'
                  : gateState.status === 'DENIED' || gateState.alarmStrobe
                  ? 'bg-rose-50/90 border-rose-300 shadow-xs animate-shake'
                  : 'bg-slate-50 border-slate-200'
              }`}>
                {/* Hologram Badge */}
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-[11px] font-mono font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                    gateState.status === 'GRANTED' ? 'bg-emerald-600 text-white' :
                    gateState.status === 'DENIED' ? 'bg-rose-600 text-white' :
                    'bg-slate-200 text-slate-700'
                  }`}>
                    {gateState.displayBadge || 'READY • STANDBY'}
                  </span>

                  <span className="font-mono text-xs text-slate-500">
                    STATUS:{' '}
                    <b className={
                      gateState.status === 'GRANTED' ? 'text-emerald-700' :
                      gateState.status === 'DENIED' ? 'text-rose-700' :
                      'text-slate-700'
                    }>{gateState.status}</b>
                  </span>
                </div>

                {/* Main Message Display */}
                <p className={`text-base sm:text-lg font-mono font-bold mb-4 leading-relaxed ${
                  gateState.status === 'GRANTED' ? 'text-emerald-950' :
                  gateState.status === 'DENIED' ? 'text-rose-950' :
                  'text-slate-800'
                }`}>
                  {gateState.message}
                </p>

                {/* CCTV Snapshot & Santri Match Verification */}
                <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-4 shadow-xs">
                  <div className="relative shrink-0">
                    <img
                      src={gateState?.snapshotUrl || currentSantri?.foto || '/images/avatar_santri_putra.jpg'}
                      alt="CCTV Snapshot"
                      className="w-16 h-16 rounded-xl object-cover border border-slate-200"
                    />
                    <div className="absolute top-1 left-1 bg-rose-600 text-white text-[8px] font-mono px-1 rounded flex items-center gap-0.5">
                      <Camera className="w-2.5 h-2.5" /> CCTV LIVE
                    </div>
                  </div>

                  <div className="flex-1 font-mono text-xs space-y-1">
                    <div className="text-slate-900 font-bold text-sm">
                      {gateState?.activeSantri?.nama || currentSantri?.nama || 'Ahmad Fauzi'}
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      UID RFID: <span className="text-emerald-700 font-bold">{gateState?.activeSantri?.rfidUid || currentSantri?.rfidUid || '04:A1:2B:9C'}</span> • NIS: {gateState?.activeSantri?.nis || currentSantri?.nis || '-'}
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      Kamar: {gateState?.activeSantri?.kamar || currentSantri?.kamar || '-'} • Wali: {gateState?.activeSantri?.wali?.nama || currentSantri?.wali?.nama || '-'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Turnstile Physical Tripod Barrier Visualization */}
            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono text-slate-500 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-slate-600" />
                  MEKANIK PALANG TURNSTILE (SERVO SOLENOID LOCK)
                </span>
                <span className={`text-xs font-mono font-bold flex items-center gap-1 ${
                  gateState.gateAngle !== 0 ? 'text-emerald-700' : 'text-slate-500'
                }`}>
                  {gateState.gateAngle !== 0 ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  {gateState.gateAngle !== 0 ? 'PALANG TERBUKA (UNLOCKED)' : 'PALANG TERKUNCI (LOCKED)'}
                </span>
              </div>

              {/* Physical Gate Graphic */}
              <div className="relative h-26 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center">
                {/* Turnstile Body Pedestal */}
                <div className="w-24 h-18 bg-white border border-slate-300 rounded-lg shadow-sm relative flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  </div>

                  {/* Turnstile Arms rotating */}
                  <div
                    className="absolute w-26 h-2 bg-gradient-to-r from-amber-500 to-amber-600 rounded-full shadow-sm transition-transform duration-700 origin-center"
                    style={{ transform: `rotate(${gateState.gateAngle}deg)` }}
                  ></div>
                </div>

                {/* Gate Floor Markers */}
                <div className="absolute bottom-2 left-6 right-6 flex justify-between text-[10px] font-mono text-slate-400">
                  <span>◄ ASRAMA (IN)</span>
                  <span>[TITIK SCAN RFID]</span>
                  <span>LUAR PONDOK (OUT) ►</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: RFID Tap Control Simulator Panel (5 Cols) */}
          <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-4">
                <Zap className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Simulasi Tap Kartu RFID Santri
                </h3>
              </div>

              {/* Select Santri to Tap */}
              <div className="space-y-3 mb-5">
                <label className="block text-xs font-mono text-slate-600 font-bold">
                  PILIH SANTRI YANG MENEMPELKAN KARTU:
                </label>
                <select
                  value={selectedSantriId}
                  onChange={(e) => setSelectedSantriId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {santriList.map(s => {
                    const permit = permits.find(p => p && (
                      p.santriId === s.id ||
                      (s.nama && p.santriNama && p.santriNama.trim().toLowerCase() === s.nama.trim().toLowerCase()) ||
                      (allSantri.find(o => o.id === p.santriId)?.nama?.trim()?.toLowerCase() === s.nama?.trim()?.toLowerCase())
                    ) && (p.status === 'APPROVED' || p.status === 'ACTIVE' || p.status === 'PENDING' || p.status === 'OVERDUE'));
                    return (
                      <option key={s.id} value={s.id}>
                        {s.nama} ({s.nis}) - [Izin: {permit ? permit.status : 'Tidak Ada'}]
                      </option>
                    );
                  })}
                </select>

                {/* Quick Info card about selected santri's permit status */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-mono space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">UID KARTU:</span>
                    <span className="text-slate-800 font-bold">{currentSantri?.rfidUid || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">STATUS IZIN:</span>
                    <span className={`font-bold ${
                      santriPermit?.status === 'APPROVED' ? 'text-emerald-700' :
                      santriPermit?.status === 'ACTIVE' ? 'text-blue-700' :
                      santriPermit?.status === 'OVERDUE' ? 'text-rose-700' :
                      santriPermit?.status === 'PENDING' ? 'text-amber-700' :
                      'text-slate-500'
                    }`}>
                      {santriPermit?.status || 'TIDAK MEMILIKI IZIN'}
                    </span>
                  </div>
                  {santriPermit && (
                    <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200">
                      Token: {santriPermit.tokenIzin} • Batas: {new Date(santriPermit.batasKembali).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                    </div>
                  )}
                </div>
              </div>

              {/* Action Mode Toggle: EXIT or ENTRY */}
              <div className="space-y-2 mb-5">
                <label className="block text-xs font-mono text-slate-600 font-bold">
                  ARAH LINTASAN GERBANG:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setGateAction('EXIT')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 font-mono ${
                      gateAction === 'EXIT'
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    <span>TAP KELUAR (EXIT)</span>
                  </button>
                  <button
                    onClick={() => setGateAction('ENTRY')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 font-mono ${
                      gateAction === 'ENTRY'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    <span>TAP MASUK (ENTRY)</span>
                  </button>
                </div>
              </div>

              {/* Main RFID Trigger Button */}
              <button
                onClick={() => tapGateRFID(selectedSantriId, gateAction)}
                className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all duration-150 flex items-center justify-center gap-2 shadow-xs ${
                  gateAction === 'EXIT'
                    ? 'bg-slate-800 hover:bg-slate-900 text-white active:scale-98'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-98'
                }`}
              >
                <Zap className="w-4 h-4 fill-current text-amber-300" />
                <span>TAP KARTU RFID 13.56 MHz SEKARANG</span>
              </button>
            </div>

            {/* Hint Box for Testing Scenarios */}
            <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
              <b className="text-slate-800 block font-mono">Petunjuk Pengujian Cepat:</b>
              <p>• <b>Skenario 1 (Valid):</b> Pilih <i>Zulfikar Ali</i> (APPROVED) &rarr; Tap Keluar.</p>
              <p>• <b>Skenario 2 (Anti-Bypass Lock):</b> Pilih <i>Ahmad Fauzi</i> (PENDING) &rarr; Tap Keluar.</p>
              <p>• <b>Skenario 3 (Check-In Selesai):</b> Pilih <i>Muhammad Rayhan</i> (ACTIVE) &rarr; Tap Masuk.</p>
            </div>
          </div>
        </div>

        {/* 2b. VIRTUAL OLED SSD1306 DISPLAY & BREADBOARD ACTUATOR MONITOR */}
        <VirtualOledDisplay />

        {/* 2c. REAL-TIME MINI TABLE: DAFTAR PERIZINAN SANTRI SMART GATE */}
        <RealtimePermitsTable />

        {/* 3. LIVE COUNTDOWN TIMER, H-30M WARNING & OVERDUE AUTO-ALARM (COMPACT SCROLLABLE BOX) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                Daftar Santri Sedang di Luar Pondok (Live Countdown & Alert)
              </h2>
              <p className="text-xs text-slate-500">
                Hitung mundur presisi real-time waktu nyata dengan fitur uji simulasi H-30m dan Auto-Overdue.
              </p>
            </div>
          </div>

          {activePermitsOut.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              Tidak ada santri yang sedang berstatus di luar pondok saat ini.
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {activePermitsOut.map(p => {
                const s = santriList.find(x => x.id === p.santriId);
                const timerInfo = countdownMap[p.id];
                const isOverdue = p.status === 'OVERDUE' || timerInfo?.isOverdue;

                return (
                  <div
                    key={p.id}
                    className={`p-4 rounded-xl border transition-all duration-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                      isOverdue
                        ? 'bg-rose-50 border-rose-300 shadow-xs animate-shake'
                        : 'bg-slate-50/80 border-slate-200'
                    }`}
                  >
                    {/* Santri identity & permit detail */}
                    <div className="flex items-center gap-3">
                      <img
                        src={s?.foto}
                        alt={s?.nama}
                        className={`w-12 h-12 rounded-xl object-cover border ${
                          isOverdue ? 'border-rose-400' : 'border-slate-200'
                        }`}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-sm">{s?.nama}</h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            isOverdue ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {isOverdue ? 'AUTO-ALARM: OVERDUE' : p.kategori}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-bold">
                            UID: {s?.rfidUid}
                          </span>
                          <span className="text-xs text-slate-500">
                            NIS: {s?.nis} • {s?.kamar} • Wali: {s?.wali.nama}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 italic">
                          "{p.keperluan}"
                        </p>
                      </div>
                    </div>

                    {/* Middle: Live Countdown Clock */}
                    <div className="text-center md:text-right font-mono">
                      <span className="text-[10px] text-slate-400 uppercase block">Sisa Waktu Izin:</span>
                      <span className={`text-xl sm:text-2xl font-black ${
                        isOverdue ? 'text-rose-600 animate-pulse' : 'text-amber-600'
                      }`}>
                        {timerInfo ? timerInfo.text : 'CALCULATING...'}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        Batas: {new Date(p.batasKembali).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                      </span>
                    </div>

                    {/* Right: Simulation Triggers & Emergency Contact */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {/* Emergency Contact Button for Security Guard */}
                      <a
                        href={`tel:${s?.wali.telepon}`}
                        className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-200 shadow-xs"
                        title="Hubungi Wali Santri Langsung"
                      >
                        <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{s?.wali.telepon}</span>
                      </a>

                      {/* Button: Simulasikan Sisa Waktu <= 30 Menit */}
                      {!isOverdue && (
                        <button
                          onClick={() => simulateWarning30Min(p.id)}
                          className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold transition border border-amber-200 shadow-xs"
                          title="Kirim Simulasi WA Peringatan 30 Menit"
                        >
                          Simulasi &le; 30 Mnt
                        </button>
                      )}

                      {/* Button: Simulasikan Terlambat (Overdue) -> Auto Point Cut & Auto Alarm */}
                      {!isOverdue && (
                        <button
                          onClick={() => simulateOverdue(p.id)}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1"
                        >
                          <AlertOctagon className="w-3.5 h-3.5" />
                          <span>Simulasi Overdue</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. REAL-TIME GATE ACCESS LOGS & PRINTABLE AUDIT LEDGER */}
        <RealtimeGateLogsManager />
        </>
        )}

      </div>
    </div>
  );
}
