import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Bell, 
  BellRing, 
  Clock, 
  AlertTriangle, 
  Send, 
  Volume2, 
  VolumeX, 
  Sliders, 
  CheckCircle2, 
  ShieldAlert, 
  UserCheck, 
  MessageSquare, 
  Phone, 
  ExternalLink, 
  RotateCcw,
  Zap,
  Sparkles,
  DoorOpen,
  Info
} from 'lucide-react';
import { sound } from '../../utils/audio';

export default function MusyrifAlarmMonitor() {
  const { 
    santriList, 
    permits, 
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
    oledState,
    tapGateRFID
  } = useApp();

  const [currentTime, setCurrentTime] = useState(Date.now());
  const [customMinutesInput, setCustomMinutesInput] = useState(String(reminderThresholdMinutes));
  const [successToast, setSuccessToast] = useState(null);

  // Live timer tick every 1 second for live countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter santri currently outside: ACTIVE or OVERDUE
  const activePermits = permits.filter(p => p.status === 'ACTIVE' || p.status === 'OVERDUE');

  // Categorize permits by time status
  const analyzedPermits = activePermits.map(permit => {
    const santri = santriList.find(s => s.id === permit.santriId);
    const batasMs = new Date(permit.batasKembali).getTime();
    const diffMs = batasMs - currentTime;
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffSeconds = Math.floor((diffMs % 60000) / 1000);

    const isOverdue = diffMs <= 0 || permit.status === 'OVERDUE';
    const isWarning = !isOverdue && diffMinutes <= reminderThresholdMinutes;
    const isSafe = !isOverdue && !isWarning;

    return {
      permit,
      santri,
      diffMs,
      diffMinutes,
      diffSeconds,
      isOverdue,
      isWarning,
      isSafe
    };
  });

  const warningCount = analyzedPermits.filter(p => p.isWarning).length;
  const overdueCount = analyzedPermits.filter(p => p.isOverdue).length;
  const safeCount = analyzedPermits.filter(p => p.isSafe).length;

  const showToast = (msg) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4500);
  };

  const handleApplyCustomMinutes = (e) => {
    e.preventDefault();
    const val = parseInt(customMinutesInput, 10);
    if (!isNaN(val) && val >= 5 && val <= 360) {
      setReminderThresholdMinutes(val);
      showToast(`Ambang batas alarm pengingat berhasil diatur ke H-${val} Menit.`);
    } else {
      alert('Harap masukkan angka batas waktu antara 5 hingga 360 menit!');
    }
  };

  return (
    <div className="space-y-6 text-slate-800">
      
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-amber-900 via-slate-900 to-teal-950 text-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-amber-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="bg-amber-500/20 text-amber-300 border border-amber-400/40 text-xs px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
              <BellRing className="w-3.5 h-3.5 text-amber-300 animate-bounce" />
              MUSYRIF EARLY-WARNING & ALARM SYSTEM
            </span>
            <span className="text-gold-300 text-xs flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Auto-Sync WhatsApp Gateway
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            🔔 Sistem Alarm Pengingat & Pantau Santri di Luar
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl mt-1 leading-relaxed">
            Pengawas asrama dapat memantau hitung mundur batas izin santri secara real-time. Sistem otomatis membunyikan alarm dan mengirimkan pesan WhatsApp pengingat ke wali santri sebelum batas waktu berakhir.
          </p>
        </div>

        {/* Quick Metric Pills */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-950/80 px-3 py-2 rounded-2xl border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 block font-mono">DI LUAR</span>
            <span className="text-base font-black text-cyan-300">{activePermits.length}</span>
          </div>
          <div className={`px-3 py-2 rounded-2xl border text-center ${warningCount > 0 ? 'bg-amber-950 border-amber-500 text-amber-300 animate-pulse' : 'bg-slate-950/80 border-slate-800 text-slate-400'}`}>
            <span className="text-[10px] block font-mono">H-{reminderThresholdMinutes}M KRITIS</span>
            <span className="text-base font-black">{warningCount}</span>
          </div>
          <div className={`px-3 py-2 rounded-2xl border text-center ${overdueCount > 0 ? 'bg-rose-950 border-rose-500 text-rose-300 animate-bounce' : 'bg-slate-950/80 border-slate-800 text-slate-400'}`}>
            <span className="text-[10px] block font-mono">TERLAMBAT</span>
            <span className="text-base font-black">{overdueCount}</span>
          </div>
        </div>
      </div>

      {/* 1.5 Virtual LED Monitor Screen Widget (Green, Yellow Virtual, Red) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
              INDIKATOR STATUS MONITORING (LAMPU LED LAYAR LAPTOP)
            </span>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-mono border border-amber-500/30">
              LED Kuning: Virtual Layar Laptop
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            IoT Fisik: 2 LED (Hijau & Merah) • Layar Laptop: 3 LED Lengkap (+ Kuning)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* LED Hijau: Waktu Aman */}
          <div className={`p-3.5 rounded-2xl border transition-all flex items-center gap-3.5 ${
            safeCount > 0 || oledState?.ledHijau
              ? 'bg-emerald-950/80 border-emerald-500 shadow-emerald-500/20 shadow-md'
              : 'bg-slate-950/50 border-slate-800 text-slate-500'
          }`}>
            <div className="relative">
              <div className={`w-7 h-7 rounded-full border-2 transition-all ${
                safeCount > 0 || oledState?.ledHijau
                  ? 'bg-emerald-400 border-white shadow-emerald-400/80 shadow-md scale-105'
                  : 'bg-emerald-950/40 border-emerald-900'
              }`}></div>
              {(safeCount > 0 || oledState?.ledHijau) && (
                <span className="absolute -inset-1 rounded-full bg-emerald-400/30 animate-ping"></span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black font-mono text-emerald-400">LED HIJAU (AMAN)</span>
                <span className="text-[9px] bg-emerald-900/60 text-emerald-300 px-1.5 rounded">Fisik GPIO 17</span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                {safeCount} Santri di luar dalam batas aman (&gt;H-{reminderThresholdMinutes}m)
              </p>
            </div>
          </div>

          {/* LED Kuning: Virtual Layar Laptop (H-X Menit Masa Kritis) */}
          <div className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
            warningCount > 0 || oledState?.ledKuning
              ? 'bg-amber-950/90 border-amber-400 shadow-amber-500/40 shadow-lg animate-pulse'
              : 'bg-slate-950/50 border-slate-800 text-slate-500'
          }`}>
            <div className="flex items-center gap-3.5">
              <div className="relative">
                <div className={`w-7 h-7 rounded-full border-2 transition-all ${
                  warningCount > 0 || oledState?.ledKuning
                    ? 'bg-amber-400 border-white shadow-amber-400/90 shadow-md scale-110'
                    : 'bg-amber-950/40 border-amber-900'
                }`}></div>
                {(warningCount > 0 || oledState?.ledKuning) && (
                  <span className="absolute -inset-1 rounded-full bg-amber-400/40 animate-ping"></span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black font-mono text-amber-300">LED KUNING (KRITIS)</span>
                  <span className="text-[9px] bg-amber-500/20 text-amber-300 font-bold px-1.5 rounded border border-amber-500/30">
                    💻 Virtual Layar
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  {warningCount > 0 ? `${warningCount} Santri mendekati batas waktu!` : 'Tidak ada santri kritis saat ini'}
                </p>
              </div>
            </div>

            <button
              onClick={() => triggerYellowLedVirtual?.(3500, `UJI COBA LED KUNING VIRTUAL`)}
              className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/30 rounded-xl text-[10px] font-bold font-mono transition shrink-0"
              title="Tes nyala LED Kuning di layar laptop"
            >
              Tes Nyala
            </button>
          </div>

          {/* LED Merah: Overdue / Terlambat */}
          <div className={`p-3.5 rounded-2xl border transition-all flex items-center gap-3.5 ${
            overdueCount > 0 || oledState?.ledMerah
              ? 'bg-rose-950/90 border-rose-500 shadow-rose-500/40 shadow-lg animate-pulse'
              : 'bg-slate-950/50 border-slate-800 text-slate-500'
          }`}>
            <div className="relative">
              <div className={`w-7 h-7 rounded-full border-2 transition-all ${
                overdueCount > 0 || oledState?.ledMerah
                  ? 'bg-rose-500 border-white shadow-rose-500/80 shadow-md scale-105'
                  : 'bg-rose-950/40 border-rose-900'
              }`}></div>
              {(overdueCount > 0 || oledState?.ledMerah) && (
                <span className="absolute -inset-1 rounded-full bg-rose-500/30 animate-ping"></span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black font-mono text-rose-400">LED MERAH (TERLAMBAT)</span>
                <span className="text-[9px] bg-rose-900/60 text-rose-300 px-1.5 rounded">Fisik GPIO 18</span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                {overdueCount > 0 ? `${overdueCount} Santri melewati batas waktu!` : 'Nihil santri terlambat'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Success Toast */}
      {successToast && (
        <div className="bg-emerald-50 border-2 border-emerald-400 text-emerald-900 p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 shadow-md animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* 2. Top Warning Banner (If Santri Nearing Expiry) */}
      {warningCount > 0 && (
        <div className="bg-amber-50 border-2 border-amber-400 text-amber-950 p-4 sm:p-5 rounded-3xl shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-900/30">
              <BellRing className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                  PERINGATAN DINI MUSYRIF
                </span>
                <span className="text-xs font-bold font-mono">
                  {warningCount} Santri Mendekati Batas Waktu (H-{reminderThresholdMinutes} Menit)
                </span>
              </div>
              <p className="text-xs text-amber-800 mt-1">
                Ada santri yang waktu izinnya akan segera habis. Kirim pesan pengingat ke wali santri agar segera bersiap kembali ke pesantren.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const count = broadcastAllWarningReminders();
                showToast(`Pesan pengingat berhasil dikirimkan ke ${count} wali santri via WhatsApp Gateway!`);
              }}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow transition"
            >
              <Send className="w-4 h-4" />
              <span>Broadcast WA ke Semua Wali Kritis</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Panel Pengaturan Alarm & Threshold H- Menit */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">
                Konfigurasi Ambang Batas Waktu Alarm (H- Berapa Menit)
              </h3>
              <p className="text-xs text-slate-500">
                Pilih atau ketik durasi waktu sebelum izin berakhir untuk memicu alarm browser & notifikasi WhatsApp otomatis.
              </p>
            </div>
          </div>

          {/* Audio Test Button */}
          <button
            onClick={() => sound.playReminderChime()}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Volume2 className="w-4 h-4 text-amber-600" />
            <span>Uji Bunyi Lonceng Alarm</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          
          {/* Preset Buttons */}
          <div className="lg:col-span-7 space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              Pilihan Preset Cepat Batas Pengingat:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { min: 15, label: 'H-15 Menit', desc: 'Mendesak' },
                { min: 30, label: 'H-30 Menit', desc: 'Standar Pesantren' },
                { min: 45, label: 'H-45 Menit', desc: 'Waktu Longgar' },
                { min: 60, label: 'H-60 Menit (1 Jam)', desc: 'Persiapan Jauh' }
              ].map(preset => (
                <button
                  key={preset.min}
                  type="button"
                  onClick={() => {
                    setReminderThresholdMinutes(preset.min);
                    setCustomMinutesInput(String(preset.min));
                    showToast(`Batas alarm diatur ke ${preset.label}`);
                  }}
                  className={`p-3 rounded-2xl border text-left transition ${
                    reminderThresholdMinutes === preset.min
                      ? 'bg-amber-500 text-white border-amber-600 shadow-md shadow-amber-900/20 font-bold'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <span className="block text-xs font-black">{preset.label}</span>
                  <span className={`block text-[10px] mt-0.5 ${reminderThresholdMinutes === preset.min ? 'text-amber-100' : 'text-slate-400'}`}>
                    {preset.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Minute Form */}
          <div className="lg:col-span-5 bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              Atur Menit Kustom (Bebas):
            </label>
            <form onSubmit={handleApplyCustomMinutes} className="flex items-center gap-2">
              <input
                type="number"
                min="5"
                max="360"
                value={customMinutesInput}
                onChange={(e) => setCustomMinutesInput(e.target.value)}
                placeholder="Contoh: 30"
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold shrink-0 transition"
              >
                Terapkan
              </button>
            </form>
            <span className="text-[10px] text-slate-500 block">
              Saat ini aktif: Peringatan dipicu <b>{reminderThresholdMinutes} menit</b> sebelum batas kembali.
            </span>
          </div>

        </div>

        {/* Toggles & Simulator Actions */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
              <input
                type="checkbox"
                checked={isAutoSendWaReminder}
                onChange={(e) => {
                  setIsAutoSendWaReminder(e.target.checked);
                  showToast(e.target.checked ? 'Kirim Otomatis WA Pengingat: DIAKTIFKAN' : 'Kirim Otomatis WA Pengingat: DIMATIKAN');
                }}
                className="w-4 h-4 text-emerald-600 rounded"
              />
              <span>Kirim Otomatis Pesan WA ke Wali saat Masuk Batas Waktu</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
              <input
                type="checkbox"
                checked={isAlarmSoundEnabled}
                onChange={(e) => {
                  setIsAlarmSoundEnabled(e.target.checked);
                  showToast(e.target.checked ? 'Alarm Audio Browser: AKTIF' : 'Alarm Audio Browser: MUTE');
                }}
                className="w-4 h-4 text-amber-600 rounded"
              />
              <span>Bunyikan Alarm Audio di Browser Musyrif</span>
            </label>
          </div>

          {/* Simulator Button */}
          <button
            onClick={() => {
              const target = santriList[0]?.id || 'S-101';
              simulateSantriNearExpiry(target, 20);
              showToast(`Simulasi berhasil! Santri ${santriList[0]?.nama || 'Santri'} sekarang berstatus keluar dengan sisa waktu 20 menit (Memicu Alarm H-${reminderThresholdMinutes}m).`);
            }}
            className="px-3.5 py-1.5 bg-gradient-to-r from-amber-600 to-teal-700 hover:from-amber-500 hover:to-teal-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition shrink-0"
            title="Simulasikan santri dengan sisa waktu 20 menit untuk menguji alarm"
          >
            <Zap className="w-3.5 h-3.5 text-gold-300" />
            <span>Simulasi Uji Alarm (Set Santri ke Sisa 20m)</span>
          </button>
        </div>

      </div>

      {/* 4. Live Cards: Santri yang Sedang Berada di Luar Pondok */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Clock className="w-5 h-5 text-teal-600" />
            Daftar Live Santri Sedang di Luar Asrama ({activePermits.length} Santri)
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            Pembaruan Detik Real-Time ({new Date(currentTime).toLocaleTimeString('id-ID')} WIB)
          </span>
        </div>

        {analyzedPermits.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
              <UserCheck className="w-7 h-7" />
            </div>
            <h4 className="font-bold text-slate-800 text-base">
              Alhamdulillah, Seluruh Santri Berada di Dalam Asrama
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Saat ini tidak ada santri yang sedang keluar izin. Jika ingin menguji alarm peringatan dini, klik tombol <b>"Simulasi Uji Alarm"</b> di atas.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analyzedPermits.map(({ permit, santri, diffMs, diffMinutes, diffSeconds, isOverdue, isWarning, isSafe }) => {
              if (!santri) return null;

              const batasJam = new Date(permit.batasKembali).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
              const jamKeluar = permit.waktuKeluarAktual 
                ? new Date(permit.waktuKeluarAktual).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
                : '14:00 WIB';

              return (
                <div
                  key={permit.id}
                  className={`bg-white rounded-3xl border-2 p-5 shadow-sm space-y-4 transition-all duration-300 ${
                    isOverdue
                      ? 'border-rose-400 bg-rose-50/20 shadow-rose-900/10 shadow-lg'
                      : isWarning
                      ? 'border-amber-400 bg-amber-50/20 shadow-amber-900/10 shadow-lg ring-1 ring-amber-400/50'
                      : 'border-slate-200'
                  }`}
                >
                  {/* Top Bar: Santri Profile & Countdown */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={santri.foto}
                        alt={santri.nama}
                        className={`w-12 h-12 rounded-2xl object-cover border-2 shadow-xs ${
                          isOverdue ? 'border-rose-500' : isWarning ? 'border-amber-500' : 'border-emerald-500'
                        }`}
                      />
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{santri.nama}</h4>
                        <span className="text-[11px] text-slate-500 block">
                          NIS: {santri.nis} • {santri.kelas} • {santri.kamar}
                        </span>
                        <span className="font-mono text-[10px] text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                          UID: {santri.rfidUid}
                        </span>
                      </div>
                    </div>

                    {/* Countdown Badge */}
                    <div className="text-right">
                      {isOverdue ? (
                        <div className="bg-rose-600 text-white px-3 py-1 rounded-xl text-center shadow-md animate-bounce">
                          <span className="block text-[9px] font-black uppercase tracking-wider">TERLAMBAT</span>
                          <span className="block text-xs font-black font-mono">
                            LEWAT {Math.abs(diffMinutes)}m
                          </span>
                        </div>
                      ) : isWarning ? (
                        <div className="bg-amber-500 text-white px-3 py-1 rounded-xl text-center shadow-md animate-pulse">
                          <span className="block text-[9px] font-black uppercase tracking-wider">⚠️ BATAS KRITIS</span>
                          <span className="block text-xs font-black font-mono">
                            {diffMinutes}m {Math.abs(diffSeconds)}s
                          </span>
                        </div>
                      ) : (
                        <div className="bg-emerald-50 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-xl text-center font-mono">
                          <span className="block text-[9px] font-bold text-emerald-600">SISA WAKTU</span>
                          <span className="block text-xs font-bold">
                            {diffMinutes}m {diffSeconds}s
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Detail Info Permintaan */}
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-bold">Kategori: <b className="text-slate-800">{permit.kategori}</b></span>
                      <span className="text-slate-500 font-mono">Token: <b>{permit.tokenIzin}</b></span>
                    </div>
                    <p className="text-slate-700 italic">
                      "{permit.keperluan}"
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1 border-t border-slate-200">
                      <div>
                        <span className="text-[10px] text-slate-400 font-sans block">Jam Keluar:</span>
                        <b className="text-slate-700">{jamKeluar}</b>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-sans block">Batas Kembali:</span>
                        <b className={isOverdue ? 'text-rose-600' : isWarning ? 'text-amber-700' : 'text-emerald-700'}>
                          {batasJam}
                        </b>
                      </div>
                    </div>
                  </div>

                  {/* Wali Info & Status WhatsApp Reminder */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] pt-1">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Wali: <b>{santri.wali.nama}</b> ({santri.wali.telepon})</span>
                    </div>

                    <div>
                      {permit.reminderSent ? (
                        <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>WA Terkirim {permit.reminderSentAt ? new Date(permit.reminderSentAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg text-[10px] font-medium">
                          Belum Dikirimkan Pengingat
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => {
                        sendEarlyWarningReminder(permit.id);
                        showToast(`Pesan pengingat dikirim ke nomor WA ${santri.wali.nama} (${santri.wali.telepon})!`);
                      }}
                      className="py-2.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs"
                    >
                      <Bell className="w-3.5 h-3.5 text-amber-600" />
                      <span>Kirim WA Pengingat</span>
                    </button>

                    <button
                      onClick={() => {
                        tapGateRFID(santri.id, 'ENTRY');
                        showToast(`Santri ${santri.nama} berhasil check-in kembali ke asrama.`);
                      }}
                      className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs"
                    >
                      <DoorOpen className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Tap Check-in Kembali</span>
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
