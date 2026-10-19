import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Radio, 
  CreditCard, 
  Send, 
  Zap, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  UserCheck, 
  Sparkles, 
  MessageSquare, 
  Home, 
  Search, 
  ShieldCheck, 
  RefreshCw,
  Phone,
  DoorOpen,
  Check,
  X,
  Sliders,
  Calendar,
  Settings2,
  Power,
  PowerOff
} from 'lucide-react';
import { sound } from '../../utils/audio';

export default function ExpressPermitKiosk() {
  const { 
    santriList, 
    permits, 
    lastScannedUid, 
    lastScannedTime, 
    isSerialConnected, 
    connectSerial, 
    disconnectSerial,
    isRfidModuleEnabled,
    setIsRfidModuleEnabled,
    createExpressPermit, 
    tapGateRFID,
    processRfidTap
  } = useApp();

  const [scannedSantri, setScannedSantri] = useState(null);
  const [successNotice, setSuccessNotice] = useState(null);

  // Form state
  const [permitForm, setPermitForm] = useState({
    kategori: 'PESIAR',
    keperluan: 'Beli Buku & Kebutuhan ATK',
    durasiJam: '3',
    penjemput: 'Izin Mandiri Santri',
    catatan: 'Diterbitkan via Kiosk Izin Cepat Mandiri'
  });

  // Custom duration states for Musyrif/ah
  const [durationMode, setDurationMode] = useState('PRESET'); // 'PRESET' | 'CUSTOM_UNIT' | 'EXACT_DATETIME'
  const [customValue, setCustomValue] = useState(4);
  const [customUnit, setCustomUnit] = useState('JAM'); // 'MENIT' | 'JAM' | 'HARI'

  const getDefaultDateTimeLocal = (hoursAhead = 3) => {
    const d = new Date(Date.now() + hoursAhead * 3600 * 1000);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const [customDateTime, setCustomDateTime] = useState(getDefaultDateTimeLocal(3));

  // Compute exact return date
  const getCalculatedBatasKembali = () => {
    if (durationMode === 'EXACT_DATETIME') {
      if (customDateTime) {
        const d = new Date(customDateTime);
        if (!isNaN(d.getTime())) return d;
      }
      return new Date(Date.now() + 3 * 3600 * 1000);
    }
    
    if (durationMode === 'CUSTOM_UNIT') {
      const val = Math.max(1, Number(customValue) || 1);
      if (customUnit === 'MENIT') {
        return new Date(Date.now() + val * 60 * 1000);
      }
      if (customUnit === 'HARI') {
        return new Date(Date.now() + val * 24 * 3600 * 1000);
      }
      // default JAM
      return new Date(Date.now() + val * 3600 * 1000);
    }

    // Default PRESET
    const hours = Number(permitForm.durasiJam || 3);
    return new Date(Date.now() + hours * 3600 * 1000);
  };

  const targetBatasDate = getCalculatedBatasKembali();
  const formatTimeOnly = (d) => d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
  const formatFullDate = (d) => {
    const isToday = d.toDateString() === new Date().toDateString();
    const isTomorrow = new Date(Date.now() + 24 * 3600 * 1000).toDateString() === d.toDateString();
    let prefix = isToday ? 'Hari ini' : isTomorrow ? 'Besok' : d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });
    return `${prefix}, ${formatTimeOnly(d)}`;
  };

  // Quick chips for reasons
  const quickReasons = [
    'Beli Buku & Perlengkapan ATK',
    'Periksa Kesehatan ke Faskes / Apotek',
    'Dijemput Keluarga / Acara Mendesak',
    'Kebutuhan Logistik Kamar & Asrama',
    'Tugas Khusus Pembina / Organisasi'
  ];

  // Auto-detect santri whenever lastScannedUid or lastScannedTime changes
  useEffect(() => {
    if (lastScannedUid) {
      const cleanScanned = lastScannedUid.replace(/[\s-]/g, ':').toUpperCase();
      const found = santriList.find(s => 
        s.rfidUid && s.rfidUid.replace(/[\s-]/g, ':').toUpperCase() === cleanScanned
      );
      if (found) {
        sound.playBeep();
        setScannedSantri(found);
      }
    }
  }, [lastScannedUid, lastScannedTime, santriList]);

  // Check if current scanned santri already has permit (support ID & name-based cross matching)
  const activePermit = scannedSantri 
    ? permits.find(p => {
        if (!p) return false;
        const isMatch = p.santriId === scannedSantri.id || 
          (p.santriNama && scannedSantri.nama && p.santriNama.trim().toLowerCase() === scannedSantri.nama.trim().toLowerCase()) ||
          (santriList.find(s => s.id === p.santriId)?.nama?.trim()?.toLowerCase() === scannedSantri.nama?.trim()?.toLowerCase());
        return isMatch && (p.status === 'APPROVED' || p.status === 'ACTIVE' || p.status === 'OVERDUE' || p.status === 'PENDING');
      })
    : null;

  const handleQuickChipSelect = (reason) => {
    setPermitForm(prev => ({ ...prev, keperluan: reason }));
  };

  const handleKategoriSelect = (kat) => {
    setPermitForm(prev => {
      let defaultReason = prev.keperluan;
      if (kat === 'BEROBAT') defaultReason = 'Periksa Kesehatan ke Faskes / Apotek';
      if (kat === 'PULANG') defaultReason = 'Dijemput Keluarga / Keperluan Keluarga';
      if (kat === 'PESIAR') defaultReason = 'Beli Buku & Kebutuhan ATK';
      return { ...prev, kategori: kat, keperluan: defaultReason };
    });
  };

  const handleExecutePermit = (openGateImmediately = false) => {
    if (!scannedSantri) return;

    const batasKembali = getCalculatedBatasKembali().toISOString();

    createExpressPermit({
      santriId: scannedSantri.id,
      kategori: permitForm.kategori,
      keperluan: permitForm.keperluan,
      penjemput: permitForm.penjemput,
      waktuKeluarRencana: new Date().toISOString(),
      batasKembali: batasKembali,
      catatan: permitForm.catatan
    }, openGateImmediately);

    if (openGateImmediately) {
      setSuccessNotice(`✅ Izin Cepat [${permitForm.kategori}] disetujui & PALANG GERBANG DIBUKA! Batas kembali: ${formatFullDate(targetBatasDate)}. Selamat jalan ${scannedSantri.nama}.`);
    } else {
      setSuccessNotice(`✅ Izin Cepat [${permitForm.kategori}] disetujui! Kartu RFID ${scannedSantri.nama} kini AKTIF (Batas: ${formatFullDate(targetBatasDate)}) dan siap di-tap di gerbang.`);
    }

    setTimeout(() => {
      setSuccessNotice(null);
    }, 6000);
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Header Kiosk */}
      <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-teal-950 text-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-emerald-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-gold-300" />
              EXPRESS TAP-TO-PERMIT KIOSK
            </span>
            <span className="text-gold-300 text-xs flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Aktivasi Izin Cepat Seketika
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            ⚡ Kiosk Izin Cepat via Scan Kartu RFID
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl mt-1 leading-relaxed">
            Solusi praktis santri yang berstatus <b>"TIDAK ADA IZIN"</b>: Cukup tempelkan kartu RFID pada alat RC522 (ESP32-S3), data santri otomatis terbaca, dan izin dapat langsung diaktifkan atau langsung membuka gerbang saat itu juga!
          </p>
        </div>

        {/* Hardware & RFID Module ON/OFF Control Center */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
          {/* Main RFID Module ON / OFF Toggle Switch */}
          <div className={`flex items-center gap-3 px-3.5 py-2 rounded-2xl border transition-all shadow-lg ${
            isRfidModuleEnabled 
              ? 'bg-slate-950/90 border-emerald-500/60 shadow-emerald-950/40 ring-1 ring-emerald-500/30' 
              : 'bg-slate-950/90 border-rose-500/60 shadow-rose-950/40 ring-1 ring-rose-500/30'
          }`}>
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-xl ${isRfidModuleEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                {isRfidModuleEnabled ? <Radio className="w-4 h-4 animate-pulse" /> : <PowerOff className="w-4 h-4" />}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-mono tracking-wider uppercase text-slate-400 leading-none">
                  Modul RFID RC522
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`h-2 w-2 rounded-full ${isRfidModuleEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                  <span className={`text-xs font-bold leading-none ${isRfidModuleEnabled ? 'text-emerald-300' : 'text-rose-400'}`}>
                    {isRfidModuleEnabled ? 'AKTIF (ON)' : 'NONAKTIF (OFF)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Toggle Button Switch */}
            <button
              type="button"
              onClick={() => setIsRfidModuleEnabled(prev => !prev)}
              title={isRfidModuleEnabled ? 'Klik untuk mematikan modul pembacaan RFID' : 'Klik untuk menyalakan modul pembacaan RFID'}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                isRfidModuleEnabled 
                  ? 'bg-emerald-600 border-emerald-400 focus:ring-emerald-500' 
                  : 'bg-slate-700 border-slate-600 focus:ring-rose-500'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out mt-0.5 ${
                  isRfidModuleEnabled ? 'translate-x-5' : 'translate-x-0.5 bg-slate-300'
                }`}
              />
            </button>
          </div>

          {/* Hardware Connection Status Pill */}
          <div className="flex items-center gap-2 bg-slate-950/80 px-3.5 py-2 rounded-2xl border border-slate-700/80 text-xs font-mono">
            <span className={`h-2.5 w-2.5 rounded-full ${isSerialConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
            <span className="text-slate-200">
              {isSerialConnected ? 'ESP32-S3: ONLINE' : 'SIMULATOR MODE'}
            </span>
            {isSerialConnected ? (
              <button
                onClick={disconnectSerial}
                className="ml-2 px-2 py-1 bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-300 text-[10px] rounded-lg font-bold border border-slate-700 transition"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={connectSerial}
                className="ml-2 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] rounded-lg font-bold transition shadow-sm"
              >
                Hubungkan Alat
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Success Notification Alert */}
      {successNotice && (
        <div className="bg-emerald-50 border-2 border-emerald-400 text-emerald-900 p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 shadow-md animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* 2. Interactive Area: Scanner & Permit Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Live RFID Card Scanner Target */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl p-5 shadow-2xl text-white space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className={`text-xs font-mono font-bold flex items-center gap-2 uppercase ${isRfidModuleEnabled ? 'text-cyan-400' : 'text-rose-400'}`}>
                {isRfidModuleEnabled ? (
                  <>
                    <Radio className="w-4 h-4 animate-pulse text-cyan-300" />
                    Target Scanner RC522 (13.56 MHz)
                  </>
                ) : (
                  <>
                    <PowerOff className="w-4 h-4 text-rose-400" />
                    Target Scanner RC522 (NONAKTIF)
                  </>
                )}
              </span>
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono font-bold ${
                  isRfidModuleEnabled 
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-600' 
                    : 'bg-rose-950 text-rose-300 border-rose-700'
                }`}>
                  {isRfidModuleEnabled ? '● MODUL ON' : '○ MODUL OFF'}
                </span>
                <span className="text-[10px] bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-700 font-mono hidden sm:inline-block">
                  BREADBOARD ESP32-S3
                </span>
              </div>
            </div>

            {/* Pulsing Scan Target Zone or Disabled Overlay */}
            {isRfidModuleEnabled ? (
              <div className="relative border-2 border-dashed border-cyan-500/40 rounded-2xl p-6 text-center bg-slate-950/60 flex flex-col items-center justify-center space-y-3">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-600 to-teal-800 flex items-center justify-center text-white shadow-xl shadow-cyan-950">
                    <CreditCard className="w-8 h-8 text-gold-300" />
                  </div>
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-slate-950 animate-ping"></span>
                </div>

                <div>
                  <h4 className="font-bold text-sm text-white">
                    {scannedSantri ? `Kartu Terdeteksi: ${scannedSantri.nama}` : 'Tempelkan Kartu Fisik RFID Santri'}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    UID Terakhir: <b className="font-mono text-gold-300">[{lastScannedUid || 'MENUNGGU KARTU...'}]</b>
                  </p>
                  {lastScannedTime && (
                    <span className="text-[10px] text-cyan-400 font-mono block mt-0.5">
                      Terdeteksi pukul {new Date(lastScannedTime).toLocaleTimeString('id-ID')} WIB
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="relative border-2 border-dashed border-rose-500/40 rounded-2xl p-6 text-center bg-rose-950/20 flex flex-col items-center justify-center space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-900 to-slate-900 border border-rose-700/50 flex items-center justify-center text-rose-300 shadow-xl">
                  <PowerOff className="w-8 h-8 text-rose-400" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-rose-200">
                    Modul Scanner RFID Sedang Dinonaktifkan (OFF)
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                    Pembacaan kartu fisik RC522 maupun tap simulasi ditangguhkan sementara.
                  </p>
                  <button
                    onClick={() => setIsRfidModuleEnabled(true)}
                    className="mt-3 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-950 transition flex items-center gap-1.5 mx-auto"
                  >
                    <Zap className="w-3.5 h-3.5 text-gold-300" />
                    Nyalakan Modul RFID Sekarang
                  </button>
                </div>
              </div>
            )}

            {/* Quick Demo Simulator Buttons */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-slate-400 font-bold">
                  Uji Cepat Tap Santri (Pilih Santri yang Belum Ada Izin):
                </span>
                {!isRfidModuleEnabled && (
                  <span className="text-[10px] text-rose-400 font-mono">
                    ⚠️ Module OFF
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(() => {
                  const seen = new Set();
                  const uniqueDemoSantri = [];
                  for (const s of santriList) {
                    const norm = (s.nama || '').trim().toLowerCase();
                    if (!seen.has(norm)) {
                      seen.add(norm);
                      uniqueDemoSantri.push(s);
                    }
                  }
                  return uniqueDemoSantri.slice(0, 4).map(s => {
                    const p = permits.find(x => {
                      if (!x) return false;
                      const isMatch = x.santriId === s.id || 
                        (x.santriNama && s.nama && x.santriNama.trim().toLowerCase() === s.nama.trim().toLowerCase()) ||
                        (santriList.find(o => o.id === x.santriId)?.nama?.trim()?.toLowerCase() === s.nama?.trim()?.toLowerCase());
                      return isMatch && (x.status === 'APPROVED' || x.status === 'ACTIVE');
                    });
                    return (
                      <button
                        key={s.id}
                        onClick={() => {
                          if (!isRfidModuleEnabled) {
                            sound.playBeep();
                            return;
                          }
                          processRfidTap(s.rfidUid);
                          setScannedSantri(s);
                        }}
                        className={`text-left p-2 rounded-xl border text-xs transition flex items-center gap-2 ${
                          !isRfidModuleEnabled 
                            ? 'opacity-40 cursor-not-allowed bg-slate-950 border-slate-800 text-slate-500' 
                            : scannedSantri?.id === s.id || scannedSantri?.nama?.trim().toLowerCase() === s.nama?.trim().toLowerCase()
                              ? 'bg-emerald-950/80 border-emerald-400 text-white ring-1 ring-emerald-400'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <img
                          src={s.foto}
                          alt={s.nama}
                          className="w-7 h-7 rounded-lg object-cover shrink-0 border border-slate-700"
                        />
                        <div className="truncate">
                          <span className="font-bold block truncate text-[11px]">{s.nama}</span>
                          <span className="text-[9px] text-slate-400 font-mono block truncate">
                            {p ? p.status : 'TIDAK ADA IZIN'}
                          </span>
                        </div>
                      </button>
                    );
                  });
                })()}
              </div>
            </div>

            {scannedSantri && (
              <button
                onClick={() => setScannedSantri(null)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset / Scan Santri Lainnya</span>
              </button>
            )}

          </div>
        </div>

        {/* Right Column: Identity Card & Express Permit Form */}
        <div className="lg:col-span-7 space-y-4">
          {scannedSantri ? (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-5 sm:p-6 space-y-5 animate-fade-in">
              
              {/* Santri Identity Banner */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3.5">
                  <img
                    src={scannedSantri.foto}
                    alt={scannedSantri.nama}
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-500 shadow-md"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base sm:text-lg font-black text-slate-900">
                        {scannedSantri.nama}
                      </h3>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                        NIS: {scannedSantri.nis}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Kelas: <b className="text-slate-700">{scannedSantri.kelas}</b> | Asrama: <b className="text-slate-700">{scannedSantri.kamar}</b>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-emerald-600" />
                      Wali: <span className="font-semibold">{scannedSantri.wali.nama}</span> ({scannedSantri.wali.telepon})
                    </p>
                  </div>
                </div>

                {/* Status Pill */}
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-mono">STATUS SAAT INI:</span>
                  <span className={`text-xs font-black px-3 py-1 rounded-xl inline-block mt-0.5 ${
                    activePermit?.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                    activePermit?.status === 'ACTIVE' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                    activePermit?.status === 'OVERDUE' ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-bounce' :
                    'bg-slate-100 text-slate-700 border border-slate-300'
                  }`}>
                    {activePermit ? activePermit.status : 'BELUM ADA SURAT IZIN'}
                  </span>
                </div>
              </div>

              {/* Notice if already approved */}
              {activePermit?.status === 'APPROVED' && (
                <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs text-emerald-900">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-bold block">Kartu ini SUDAH MEMILIKI IZIN DISETUJUI ({activePermit.kategori})</span>
                      <span className="text-[11px] text-emerald-700">Token Izin: <b>{activePermit.tokenIzin}</b>. Santri siap tap gerbang untuk keluar!</span>
                    </div>
                  </div>
                  <button
                    onClick={() => tapGateRFID(scannedSantri.id, 'EXIT')}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shrink-0 shadow-xs"
                  >
                    Buka Gerbang Sekarang
                  </button>
                </div>
              )}

              {/* Form Input Izin Cepat */}
              <div className="space-y-4">
                
                {/* 1. Pilih Kategori Izin */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    1. Pilih Kategori Izin:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'PESIAR', label: 'Pesiar Singkat', desc: 'Keluar beberapa jam' },
                      { id: 'BEROBAT', label: 'Berobat / Medis', desc: 'Periksa ke faskes' },
                      { id: 'PULANG', label: 'Pulang ke Rumah', desc: 'Bermalam keluarga' },
                      { id: 'URGENT', label: 'Keperluan Mendesak', desc: 'Urusan penting' }
                    ].map(kat => (
                      <button
                        key={kat.id}
                        type="button"
                        onClick={() => handleKategoriSelect(kat.id)}
                        className={`p-2.5 rounded-xl border text-left transition ${
                          permitForm.kategori === kat.id
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-1 ring-emerald-500 font-bold'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className="text-xs block font-bold">{kat.label}</span>
                        <span className="text-[10px] text-slate-500 block">{kat.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Keperluan & Quick Chips */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    2. Tujuan / Keperluan Izin:
                  </label>
                  
                  {/* Quick Chips */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {quickReasons.map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => handleQuickChipSelect(r)}
                        className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
                          permitForm.keperluan === r
                            ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        + {r}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    value={permitForm.keperluan}
                    onChange={(e) => setPermitForm({ ...permitForm, keperluan: e.target.value })}
                    placeholder="Tuliskan alasan / keperluan izin santri..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* 3. Durasi & Batas Waktu Kembali (Full Custom Musyrif/ah) */}
                <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                    <div>
                      <label className="block text-xs font-black text-slate-800">
                        3. Durasi Izin & Batas Waktu Kembali:
                      </label>
                      <span className="text-[11px] text-slate-500">
                        Pilih preset pondok atau atur durasi bebas kustom oleh Musyrif/ah
                      </span>
                    </div>

                    {/* Mode Switcher Buttons */}
                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => setDurationMode('PRESET')}
                        className={`px-2.5 py-1 rounded-lg transition ${
                          durationMode === 'PRESET'
                            ? 'bg-emerald-600 text-white shadow-xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        ⚡ Preset
                      </button>
                      <button
                        type="button"
                        onClick={() => setDurationMode('CUSTOM_UNIT')}
                        className={`px-2.5 py-1 rounded-lg transition ${
                          durationMode === 'CUSTOM_UNIT'
                            ? 'bg-emerald-600 text-white shadow-xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        ⏱️ Kustom Waktu
                      </button>
                      <button
                        type="button"
                        onClick={() => setDurationMode('EXACT_DATETIME')}
                        className={`px-2.5 py-1 rounded-lg transition ${
                          durationMode === 'EXACT_DATETIME'
                            ? 'bg-emerald-600 text-white shadow-xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        📅 Jam Tepat
                      </button>
                    </div>
                  </div>

                  {/* Mode 1: PRESET PONDOK */}
                  {durationMode === 'PRESET' && (
                    <div className="space-y-2">
                      <select
                        value={permitForm.durasiJam}
                        onChange={(e) => setPermitForm({ ...permitForm, durasiJam: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
                      >
                        <option value="1">1 Jam (Kembali: {new Date(Date.now() + 1 * 3600 * 1000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB)</option>
                        <option value="2">2 Jam (Kembali: {new Date(Date.now() + 2 * 3600 * 1000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB)</option>
                        <option value="3">3 Jam (Kembali: {new Date(Date.now() + 3 * 3600 * 1000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB)</option>
                        <option value="4">4 Jam (Kembali: {new Date(Date.now() + 4 * 3600 * 1000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB)</option>
                        <option value="5">5 Jam (Kembali: {new Date(Date.now() + 5 * 3600 * 1000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB)</option>
                        <option value="8">8 Jam (Sampai Sore 17:30 WIB)</option>
                        <option value="24">1 Hari (Besok Pagi 07:00 WIB)</option>
                        <option value="72">3 Hari (Izin Pulang Bermalam)</option>
                      </select>

                      {/* Quick Preset Pills */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Pilih Cepat:</span>
                        {[
                          { val: '1', label: '1 Jam' },
                          { val: '2', label: '2 Jam' },
                          { val: '3', label: '3 Jam' },
                          { val: '4', label: '4 Jam' },
                          { val: '5', label: '5 Jam' },
                          { val: '8', label: '8 Jam' },
                          { val: '24', label: '1 Hari' },
                          { val: '72', label: '3 Hari' }
                        ].map(p => (
                          <button
                            key={p.val}
                            type="button"
                            onClick={() => setPermitForm({ ...permitForm, durasiJam: p.val })}
                            className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${
                              permitForm.durasiJam === p.val
                                ? 'bg-emerald-600 text-white border-emerald-600 font-black shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 font-medium'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mode 2: CUSTOM NUMBER & UNIT (JAM / MENIT / HARI) */}
                  {durationMode === 'CUSTOM_UNIT' && (
                    <div className="space-y-3 bg-white p-3.5 rounded-xl border border-slate-200">
                      <div className="flex flex-col sm:flex-row items-center gap-3">
                        <div className="w-full sm:flex-1">
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Berapa Lama Santri Diizinkan:
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              max="365"
                              value={customValue}
                              onChange={(e) => setCustomValue(Math.max(1, parseInt(e.target.value, 10) || 1))}
                              className="w-24 bg-slate-50 border-2 border-emerald-500 rounded-xl p-2.5 text-center text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                            
                            {/* Satuan Buttons */}
                            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                              {['MENIT', 'JAM', 'HARI'].map(unit => (
                                <button
                                  key={unit}
                                  type="button"
                                  onClick={() => setCustomUnit(unit)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${
                                    customUnit === unit
                                      ? 'bg-emerald-600 text-white shadow-xs'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                >
                                  {unit}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Quick Modifier Chips */}
                        <div className="w-full sm:w-auto">
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">
                            Pilih Cepat:
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {customUnit === 'MENIT' && (
                              [15, 30, 45, 60, 90, 120].map(m => (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => setCustomValue(m)}
                                  className={`px-2 py-1 text-[11px] font-mono rounded-lg border transition ${customValue === m ? 'bg-emerald-600 text-white border-emerald-600 font-bold' : 'bg-slate-100 text-slate-700 border-slate-200'}`}
                                >
                                  {m}m
                                </button>
                              ))
                            )}
                            {customUnit === 'JAM' && (
                              [1, 2, 3, 4, 6, 8, 12].map(j => (
                                <button
                                  key={j}
                                  type="button"
                                  onClick={() => setCustomValue(j)}
                                  className={`px-2 py-1 text-[11px] font-mono rounded-lg border transition ${customValue === j ? 'bg-emerald-600 text-white border-emerald-600 font-bold' : 'bg-slate-100 text-slate-700 border-slate-200'}`}
                                >
                                  {j} Jam
                                </button>
                              ))
                            )}
                            {customUnit === 'HARI' && (
                              [1, 2, 3, 4, 7, 14].map(h => (
                                <button
                                  key={h}
                                  type="button"
                                  onClick={() => setCustomValue(h)}
                                  className={`px-2 py-1 text-[11px] font-mono rounded-lg border transition ${customValue === h ? 'bg-emerald-600 text-white border-emerald-600 font-bold' : 'bg-slate-100 text-slate-700 border-slate-200'}`}
                                >
                                  {h} Hari
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mode 3: EXACT DATETIME PICKER */}
                  {durationMode === 'EXACT_DATETIME' && (
                    <div className="space-y-2.5 bg-white p-3.5 rounded-xl border border-slate-200">
                      <label className="block text-[11px] font-bold text-slate-600">
                        Tentukan Tanggal & Jam Santri Wajib Sudah Tiba di Asrama:
                      </label>
                      <input
                        type="datetime-local"
                        value={customDateTime}
                        onChange={(e) => setCustomDateTime(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-emerald-500 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />

                      {/* Quick Shortcut Buttons */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Jadwal Asrama:</span>
                        {[
                          { label: 'Sore Ini (17:30)', hours: 17, minutes: 30, daysOffset: 0 },
                          { label: 'Malam Ini (20:30)', hours: 20, minutes: 30, daysOffset: 0 },
                          { label: 'Besok Pagi (07:00)', hours: 7, minutes: 0, daysOffset: 1 },
                          { label: 'Besok Sore (17:00)', hours: 17, minutes: 0, daysOffset: 1 }
                        ].map(preset => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              const d = new Date();
                              d.setDate(d.getDate() + preset.daysOffset);
                              d.setHours(preset.hours, preset.minutes, 0, 0);
                              const year = d.getFullYear();
                              const month = String(d.getMonth() + 1).padStart(2, '0');
                              const day = String(d.getDate()).padStart(2, '0');
                              const hours = String(d.getHours()).padStart(2, '0');
                              const minutes = String(d.getMinutes()).padStart(2, '0');
                              setCustomDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);
                            }}
                            className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 border border-slate-200 transition font-medium"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Calculated Return Time Summary Badge */}
                  <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 text-white rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border border-emerald-500/40 shadow-inner">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
                        <Clock className="w-4 h-4 animate-spin-slow" />
                      </div>
                      <div>
                        <span className="text-[10px] text-emerald-300 block font-mono uppercase font-bold">
                          BATAS WAKTU KEMBALI SANTRI:
                        </span>
                        <span className="text-sm font-black text-white tracking-wide">
                          {formatFullDate(targetBatasDate)}
                        </span>
                      </div>
                    </div>

                    <div className="bg-emerald-900/60 border border-emerald-400/30 px-3 py-1.5 rounded-lg text-right">
                      <span className="text-[10px] text-emerald-300 block font-mono">TOTAL ESTIMASI:</span>
                      <span className="text-xs font-black text-gold-300">
                        {Math.max(1, Math.round((targetBatasDate - Date.now()) / 60000))} Menit ({((targetBatasDate - Date.now()) / 3600000).toFixed(1)} Jam)
                      </span>
                    </div>
                  </div>

                  {/* 4. Penjemput Field */}
                  <div className="pt-1">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      4. Penjemput / Pendamping:
                    </label>
                    <input
                      type="text"
                      value={permitForm.penjemput}
                      onChange={(e) => setPermitForm({ ...permitForm, penjemput: e.target.value })}
                      placeholder="Contoh: Mandiri / Wali Santri / Ustadz Pendamping"
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* WhatsApp Notification Live Preview */}
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3 flex items-start gap-2.5 text-xs">
                  <MessageSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-emerald-950 block text-[11px]">
                      Notifikasi WhatsApp Otomatis ke Wali Santri:
                    </span>
                    <p className="text-[11px] text-emerald-800 font-mono mt-0.5 leading-relaxed">
                      "Pemberitahuan: Ananda {scannedSantri.nama} telah mendapatkan izin {permitForm.kategori} ({permitForm.keperluan}) dan estimasi kembali pada {formatFullDate(targetBatasDate)}."
                    </p>
                  </div>
                </div>

                {/* Two Action Buttons */}
                <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                  
                  {/* Action 1: Setujui Izin Saja */}
                  <button
                    type="button"
                    onClick={() => handleExecutePermit(false)}
                    className="w-full sm:flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition shadow-sm"
                  >
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Terbitkan Izin Saja (APPROVED)</span>
                  </button>

                  {/* Action 2: Setujui & Buka Gerbang Langsung */}
                  <button
                    type="button"
                    onClick={() => handleExecutePermit(true)}
                    className="w-full sm:flex-1 py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-900/30 ring-2 ring-emerald-400/50"
                  >
                    <DoorOpen className="w-4 h-4 text-gold-300" />
                    <span>⚡ Terbitkan & Buka Gerbang (One-Tap Pass)</span>
                  </button>

                </div>

              </div>

            </div>
          ) : (
            /* Standby Prompt when no card is scanned */
            <div className="bg-slate-900/40 border-2 border-dashed border-slate-700 rounded-3xl p-8 sm:p-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-3 min-h-[360px]">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isRfidModuleEnabled ? 'bg-slate-800 border border-slate-700 text-slate-500' : 'bg-rose-950/40 border border-rose-800/60 text-rose-400'}`}>
                {isRfidModuleEnabled ? <CreditCard className="w-8 h-8" /> : <PowerOff className="w-8 h-8" />}
              </div>
              <h3 className="text-base font-bold text-slate-200">
                {isRfidModuleEnabled 
                  ? 'Menunggu Pembacaan Kartu RFID Santri' 
                  : 'Modul Pembacaan RFID Sedang Dinonaktifkan (OFF)'}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                {isRfidModuleEnabled 
                  ? 'Silakan tempelkan kartu RFID pada modul scanner RC522 (ESP32-S3), atau klik salah satu santri pada tombol uji cepat di sebelah kiri untuk menampilkan formulir perizinan instan.'
                  : 'Aktifkan switch modul RFID pada banner di atas atau klik tombol di bawah ini agar alat RC522 mulai mendeteksi kartu santri kembali.'}
              </p>
              {!isRfidModuleEnabled && (
                <button
                  type="button"
                  onClick={() => setIsRfidModuleEnabled(true)}
                  className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-950 transition flex items-center gap-2"
                >
                  <Zap className="w-4 h-4 text-gold-300" />
                  <span>Aktifkan Modul RFID Sekarang</span>
                </button>
              )}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
