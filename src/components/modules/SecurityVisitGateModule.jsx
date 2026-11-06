import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Shield,
  QrCode,
  CreditCard,
  CheckCircle,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Clock,
  Package,
  User,
  Users,
  Search,
  Plus,
  Send,
  Smartphone,
  Check,
  RefreshCw,
  LogOut,
  Radio,
  FileText
} from 'lucide-react';
import { sound } from '../../utils/audio';
import { getRealtimePondokClock, calculateVisitCountdown } from '../../utils/pondokTimeUtils';

export default function SecurityVisitGateModule() {
  const {
    visitBookings,
    visitSettings,
    addVisitBooking,
    checkInVisitBooking,
    checkOutVisitBooking,
    verifyVisitBarcode,
    verifyVisitRfid,
    santriList,
    lastScannedUid,
    isSerialConnected
  } = useApp();

  // Verification input states
  const [barcodeInput, setBarcodeInput] = useState('');
  const [verificationResult, setVerificationResult] = useState(null); // { success, booking, message, isApproved }
  const [activeTabSub, setActiveTabSub] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'PENDING' | 'DONE'
  const [searchTable, setSearchTable] = useState('');

  // Live Clock Ticking Engine (1000ms)
  const [liveClock, setLiveClock] = useState(() => getRealtimePondokClock());

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveClock(getRealtimePondokClock());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  function calculateEndTime(minutesToAdd = 60) {
    const now = new Date();
    const end = new Date(now.getTime() + minutesToAdd * 60000);
    return end.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
  }

  // Form Input Manual Satpam state (auto-fill live clock & +1 hour end time)
  const [isManualFormOpen, setIsManualFormOpen] = useState(false);
  const [satpamForm, setSatpamForm] = useState(() => {
    const clock = getRealtimePondokClock();
    const [h, m] = clock.jam_menit.split(':').map(Number);
    const endH = String((h + 1) % 24).padStart(2, '0');
    const endM = String(m).padStart(2, '0');
    return {
      nama_santri: '',
      kelas: '',
      asal: '',
      tanggal_kunjungan: clock.tanggal_ymd,
      jam_kunjungan: clock.jam_menit,
      jam_selesai: `${endH}:${endM}`,
      titipan_barang: '',
      berat_barang_kg: 1.0,
      nama_penjenguk: '',
      status_penjenguk: 'Wali (Ayah/Ibu)',
      status_penjenguk_lainnya: '',
      no_wa_penjenguk: '081234567890'
    };
  });

  const handleOpenManualForm = () => {
    if (isManualFormOpen) {
      setIsManualFormOpen(false);
      return;
    }
    const clock = getRealtimePondokClock();
    const [h, m] = clock.jam_menit.split(':').map(Number);
    const endH = String((h + 1) % 24).padStart(2, '0');
    const endM = String(m).padStart(2, '0');
    setSatpamForm(prev => ({
      ...prev,
      tanggal_kunjungan: clock.tanggal_ymd,
      jam_kunjungan: clock.jam_menit,
      jam_selesai: `${endH}:${endM}`
    }));
    setIsManualFormOpen(true);
  };

  // Handle barcode verification
  const handleVerifyBarcode = (e) => {
    if (e) e.preventDefault();
    if (!barcodeInput.trim()) {
      sound.playBeep?.();
      alert('Silakan masukkan atau scan kode Barcode Kunjungan (WhatsApp)!');
      return;
    }
    const res = verifyVisitBarcode(barcodeInput);
    setVerificationResult(res);
    if (res.success) {
      sound.playSuccess?.();
    } else {
      sound.playAccessDenied?.();
    }
  };

  // Handle tap RFID verification
  const handleVerifyRfid = (uidToTest) => {
    const targetUid = uidToTest || lastScannedUid || '04:A1:2B:9C';
    const res = verifyVisitRfid(targetUid);
    setVerificationResult(res);
    if (res.success) {
      sound.playSuccess?.();
    } else {
      sound.playAccessDenied?.();
    }
  };

  // Auto-fill form when santri is selected
  const handleSelectSantri = (santriId) => {
    const s = santriList.find(item => item.id === santriId);
    if (s) {
      setSatpamForm(prev => ({
        ...prev,
        nama_santri: s.nama,
        kelas: `${s.kelas} (${s.kamar})`,
        asal: s.wali?.alamat?.split(',')?.pop()?.trim() || 'Surabaya',
        nama_penjenguk: s.wali?.nama || '',
        no_wa_penjenguk: s.wali?.telepon || ''
      }));
    }
  };

  // Handle manual submit by Satpam
  const handleSatpamSubmit = (e) => {
    e.preventDefault();
    if (!satpamForm.nama_santri || !satpamForm.nama_penjenguk) {
      alert('Nama Santri dan Nama Penjenguk wajib diisi!');
      return;
    }
    if (satpamForm.status_penjenguk === 'Lainnya' && !satpamForm.status_penjenguk_lainnya?.trim()) {
      alert('Silakan ketik keterangan status hubungan lainnya!');
      return;
    }

    const finalStatus = satpamForm.status_penjenguk === 'Lainnya' && satpamForm.status_penjenguk_lainnya?.trim()
      ? `Lainnya (${satpamForm.status_penjenguk_lainnya.trim()})`
      : satpamForm.status_penjenguk;

    const created = addVisitBooking({
      ...satpamForm,
      status_penjenguk: finalStatus,
      status_penjenguk_lainnya: satpamForm.status_penjenguk_lainnya?.trim() || '',
      booking_source: 'MANUAL_SATPAM',
      tanggal_kunjungan: new Date().toISOString().slice(0, 10),
      status_kunjungan: 'Sedang Berkunjung' // Langsung check-in saat diinput satpam
    });

    setVerificationResult({
      success: true,
      booking: created,
      message: '✅ DATA KUNJUNGAN MANUAL BERHASIL DICATAT & DISINKRONKAN KE ADMIN RI\'AYAH',
      isApproved: true
    });

    setIsManualFormOpen(false);
    // Reset form
    setSatpamForm({
      nama_santri: '',
      kelas: '',
      asal: '',
      jam_kunjungan: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':'),
      jam_selesai: calculateEndTime(visitSettings?.max_durasi_menit || 90),
      titipan_barang: '',
      berat_barang_kg: 1.0,
      nama_penjenguk: '',
      status_penjenguk: 'Wali (Ayah/Ibu)',
      status_penjenguk_lainnya: '',
      no_wa_penjenguk: '081234567890'
    });
  };

  const bookings = Array.isArray(visitBookings) ? visitBookings : [];

  const filteredList = bookings.filter(b => {
    if (activeTabSub === 'ACTIVE' && b.status_kunjungan !== 'Sedang Berkunjung') return false;
    if (activeTabSub === 'PENDING' && b.status_kunjungan !== 'Menunggu Approval') return false;
    if (activeTabSub === 'DONE' && b.status_kunjungan !== 'Selesai') return false;

    if (searchTable.trim()) {
      const q = searchTable.toLowerCase();
      return (
        b.nama_santri?.toLowerCase().includes(q) ||
        b.nama_penjenguk?.toLowerCase().includes(q) ||
        b.titipan_barang?.toLowerCase().includes(q) ||
        b.barcode_token?.toLowerCase().includes(q) ||
        b.no_wa_penjenguk?.includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 font-sans">
      {/* ─── BARIS STATUS JAM & HARI REAL-TIME (LIVE CLOCK & MODE SISTEM POS SATPAM) ─── */}
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-4 shadow-lg text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-3 font-sans">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shadow-inner shrink-0">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase font-mono flex items-center gap-1.5">
              <span>🕒 Waktu Sistem Real-Time (Pos Jaga Satpam)</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
            </div>
            <div className="text-sm sm:text-base font-extrabold text-white font-mono flex items-center gap-2 mt-0.5">
              <span>{liveClock.nama_hari}, {liveClock.tanggal_lengkap}</span>
              <span className="text-emerald-400 font-bold">•</span>
              <span className="text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40 font-bold">
                {liveClock.jam_menit_detik} WITA
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-right hidden lg:block">
            <div className="text-[10px] text-slate-400 font-medium">📅 Mode Sistem Hari Ini:</div>
          </div>
          {liveClock.is_weekday ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40 shadow-sm animate-pulse">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>HARI KERJA (SENIN–KAMIS) — Booking WA Wajib Approval Admin Ri'ayah &amp; Wajib Scan Barcode WA</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 shadow-sm">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>AKHIR PEKAN (JUMAT–MINGGU) — Auto-Approval Booking WA Aktif</span>
            </span>
          )}
        </div>
      </div>

      {/* ─── BAGIAN A: PANEL VERIFIKASI KEDATANGAN (SCAN BARCODE WA / TAP RFID) ─── */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-6 shadow-xl border border-slate-700 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-black tracking-tight text-white">
                Pos Jaga Keamanan: Verifikasi Kedatangan Tamu &amp; Titipan Barang
              </h3>
            </div>
            <p className="text-xs text-slate-300">
              Pindai Barcode Kunjungan (WhatsApp) atau Tap Kartu RFID untuk validasi izin masuk wali santri.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenManualForm}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{isManualFormOpen ? 'Tutup Form Manual' : 'Input Tamu Walk-In (Satpam)'}</span>
            </button>
          </div>
        </div>

        {/* 2 Metode Verifikasi: Barcode WA & Tap RFID */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
          {/* Metode 1: Scan Barcode WA */}
          <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <QrCode className="w-4 h-4" />
                1. Scan / Masukkan Barcode WhatsApp (Gate Pass)
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                Scan Cepat
              </span>
            </div>

            <form onSubmit={handleVerifyBarcode} className="flex gap-2">
              <input
                type="text"
                placeholder="Scan / ketik kode (contoh: GP-DU-FAUZI-9821)..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 font-mono font-bold"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1"
              >
                <span>Verifikasi</span>
              </button>
            </form>
          </div>

          {/* Metode 2: Tap Kartu RFID */}
          <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4" />
                2. Tap Kartu RFID Santri / Wali (RC522 13.56 MHz)
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${isSerialConnected ? 'bg-cyan-500/20 text-cyan-300' : 'bg-amber-500/20 text-amber-300'}`}>
                {isSerialConnected ? 'Hardware Online' : 'Simulasi Aktif'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleVerifyRfid('04:A1:2B:9C')}
                className="flex-1 py-2 px-3 rounded-xl bg-cyan-600/80 hover:bg-cyan-600 text-white text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <Radio className="w-4 h-4 text-cyan-200 animate-pulse" />
                <span>Simulasi Tap RFID Ahmad Fauzi (04:A1:2B:9C)</span>
              </button>
              <button
                type="button"
                onClick={() => handleVerifyRfid(lastScannedUid)}
                className="py-2 px-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold transition font-mono"
                title="Tap UID Terakhir"
              >
                Tap UID Terakhir
              </button>
            </div>
          </div>
        </div>

        {/* Kotak Hasil Validasi Ketat (Instant Visual Alert) */}
        {verificationResult && (
          <div className={`p-4 rounded-2xl border transition animate-fade-in ${
            verificationResult.success
              ? 'bg-emerald-950/80 border-emerald-500 text-emerald-100'
              : 'bg-rose-950/80 border-rose-500 text-rose-100'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                {verificationResult.success ? (
                  <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="font-black text-sm tracking-tight text-white">
                    {verificationResult.message}
                  </h4>
                  {verificationResult.booking && (
                    <div className="text-xs text-slate-200 mt-1 space-y-0.5">
                      <p>
                        Santri: <strong>{verificationResult.booking.nama_santri}</strong> ({verificationResult.booking.kelas}) • Asal: <strong>{verificationResult.booking.asal}</strong>
                      </p>
                      <p>
                        Penjenguk: <strong>{verificationResult.booking.nama_penjenguk}</strong> ({verificationResult.booking.status_penjenguk}) • No WA: <strong className="font-mono">{verificationResult.booking.no_wa_penjenguk}</strong>
                      </p>
                      <p>
                        📦 Titipan Barang: <strong>{verificationResult.booking.titipan_barang || '-'}</strong> (Berat: <strong className="text-cyan-300">{verificationResult.booking.berat_barang_kg || 0} Kg</strong>)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Tombol di Banner Hasil */}
              <div className="flex items-center gap-2 self-start sm:self-center">
                {verificationResult.success && verificationResult.booking && verificationResult.booking.status_kunjungan !== 'Sedang Berkunjung' && (
                  <button
                    onClick={() => {
                      checkInVisitBooking(verificationResult.booking.id, 'BARCODE');
                      setVerificationResult(prev => ({
                        ...prev,
                        booking: { ...prev.booking, status_kunjungan: 'Sedang Berkunjung' },
                        message: '✅ TAMU BERHASIL CHECK-IN: Silakan Memasuki Area Kunjungan Asrama'
                      }));
                    }}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition"
                  >
                    Check-In Masuk (Buka Gerbang)
                  </button>
                )}
                <button
                  onClick={() => setVerificationResult(null)}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg font-bold"
                >
                  Tutup Notifikasi
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── BAGIAN B: FORM INPUT MANUAL SATPAM (UNTUK TAMU LUPA BOOKING WA) ─── */}
      {isManualFormOpen && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              <div>
                <h4 className="font-bold text-sm text-slate-900">Form Pendaftaran Kunjungan Manual di Pos Satpam</h4>
                <p className="text-[11px] text-slate-500">
                  Untuk wali santri yang datang langsung tanpa booking WA. Data langsung tersinkron ke dashboard Admin Ri'ayah.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsManualFormOpen(false)}
              className="text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ✕ Tutup Form
            </button>
          </div>

          <form onSubmit={handleSatpamSubmit} className="space-y-4 text-xs">
            {/* 1. Pilih Santri Auto-Complete */}
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                1. Cari Santri (Otomatis Mengisi Kelas &amp; Asal Daerah):
              </label>
              <select
                onChange={(e) => handleSelectSantri(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-semibold focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">-- Pilih Nama Santri yang Dijenguk --</option>
                {santriList.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.nama} • {s.kelas} • {s.kamar} • Wali: {s.wali?.nama || '-'}
                  </option>
                ))}
              </select>
            </div>

            {/* 9 Field Lengkap */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nama Santri / Santriwati *</label>
                <input
                  type="text"
                  required
                  placeholder="Nama lengkap santri"
                  value={satpamForm.nama_santri}
                  onChange={(e) => setSatpamForm(prev => ({ ...prev, nama_santri: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Kelas &amp; Kamar Asrama</label>
                <input
                  type="text"
                  placeholder="Contoh: 10-A (Umar 204)"
                  value={satpamForm.kelas}
                  onChange={(e) => setSatpamForm(prev => ({ ...prev, kelas: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Asal Daerah (Kota/Kab)</label>
                <input
                  type="text"
                  placeholder="Contoh: Surabaya / Gresik"
                  value={satpamForm.asal}
                  onChange={(e) => setSatpamForm(prev => ({ ...prev, asal: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nama Lengkap Penjenguk *</label>
                <input
                  type="text"
                  required
                  placeholder="Nama orang tua / wali"
                  value={satpamForm.nama_penjenguk}
                  onChange={(e) => setSatpamForm(prev => ({ ...prev, nama_penjenguk: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Status Hubungan Penjenguk</label>
                <select
                  value={satpamForm.status_penjenguk}
                  onChange={(e) => setSatpamForm(prev => ({ ...prev, status_penjenguk: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-semibold"
                >
                  <option value="Wali (Ayah/Ibu)">Wali (Ayah/Ibu Kandung)</option>
                  <option value="Keluarga (Kakak/Adik/Kakek/Nenek)">Keluarga (Kakak/Adik/Kakek/Nenek)</option>
                  <option value="Kerabat">Kerabat / Paman / Bibi</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Nomor WhatsApp Aktif</label>
                <input
                  type="text"
                  placeholder="0812xxxxxxxx"
                  value={satpamForm.no_wa_penjenguk}
                  onChange={(e) => setSatpamForm(prev => ({ ...prev, no_wa_penjenguk: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono"
                />
              </div>
            </div>

            {/* Input Spesifik jika memilih status 'Lainnya' di Pos Satpam */}
            {satpamForm.status_penjenguk === 'Lainnya' && (
              <div className="bg-amber-50/80 border border-amber-300/80 rounded-2xl p-3 animate-fade-in space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-amber-900 text-xs flex items-center gap-1.5">
                    <span>Ketik Status Hubungan Lainnya *</span>
                  </label>
                  <span className="text-[10px] font-medium text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-full">
                    Wajib diisi spesifik
                  </span>
                </div>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Paman, Alumni, Tetangga Asal, Sopir Jemputan, dll"
                  value={satpamForm.status_penjenguk_lainnya || ''}
                  onChange={(e) => setSatpamForm(prev => ({ ...prev, status_penjenguk_lainnya: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs shadow-xs"
                  autoFocus
                />
                <p className="text-[10px] text-amber-700">
                  💡 Status ini akan langsung tersinkron ke log gerbang dan dashboard Admin Ri'ayah.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Hari &amp; Tanggal</label>
                <input
                  type="date"
                  value={satpamForm.tanggal_kunjungan}
                  onChange={(e) => setSatpamForm(prev => ({ ...prev, tanggal_kunjungan: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Jam Check-In Masuk</label>
                <input
                  type="text"
                  value={satpamForm.jam_kunjungan}
                  onChange={(e) => setSatpamForm(prev => ({ ...prev, jam_kunjungan: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Batas Jam Selesai (+1 Jam)</label>
                <input
                  type="text"
                  value={satpamForm.jam_selesai}
                  onChange={(e) => setSatpamForm(prev => ({ ...prev, jam_selesai: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Berat Titipan (Kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={satpamForm.berat_barang_kg}
                  onChange={(e) => setSatpamForm(prev => ({ ...prev, berat_barang_kg: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Daftar / Deskripsi Barang Titipan:</label>
              <input
                type="text"
                placeholder="Misal: Pakaian ganti, Vitamin, Uang saku Rp 100.000, Makanan ringan..."
                value={satpamForm.titipan_barang}
                onChange={(e) => setSatpamForm(prev => ({ ...prev, titipan_barang: e.target.value }))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsManualFormOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-sm flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>Simpan &amp; Kirim ke Admin Ri'ayah</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── BAGIAN C: TABEL OPERASIONAL HARIAN SATPAM (LENGKAP & INTERAKTIF) ─── */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden space-y-0">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h4 className="font-black text-sm text-slate-900 tracking-tight">
              Tabel Operasional Kunjungan Pos Jaga Keamanan
            </h4>
            <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              {filteredList.length} Tamu
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari santri / barang..."
                value={searchTable}
                onChange={(e) => setSearchTable(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {[
                { id: 'ALL', label: 'Semua' },
                { id: 'ACTIVE', label: 'Aktif di Area' },
                { id: 'PENDING', label: 'Menunggu' },
                { id: 'DONE', label: 'Selesai' }
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setActiveTabSub(sub.id)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                    activeTabSub === sub.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 9 Kolom Spesifikasi Lengkap Tabel Satpam */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                <th className="py-3 px-3">No / ID</th>
                <th className="py-3 px-3">Sumber</th>
                <th className="py-3 px-3">Nama Santri</th>
                <th className="py-3 px-3">Kelas &amp; Asal</th>
                <th className="py-3 px-3">Jam Masuk</th>
                <th className="py-3 px-3">Jam Selesai</th>
                <th className="py-3 px-3">Titipan Barang &amp; Berat</th>
                <th className="py-3 px-3">Nama Penjenguk &amp; Hubungan</th>
                <th className="py-3 px-3 text-center">Aksi Satpam</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-10 text-center text-slate-400">
                    <p className="font-semibold text-slate-600 text-xs">Belum ada catatan kunjungan di pos gerbang.</p>
                  </td>
                </tr>
              ) : (
                filteredList.map((item, index) => {
                  const isOngoing = item.status_kunjungan === 'Sedang Berkunjung';
                  const isApproved = item.status_kunjungan === 'Disetujui (Siap Datang)';
                  const isPending = item.status_kunjungan === 'Menunggu Approval';
                  const isDone = item.status_kunjungan === 'Selesai';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-3 font-mono text-[11px] font-bold text-slate-500">
                        {index + 1}. {item.id.slice(-7)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="space-y-1">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold inline-block ${
                            item.booking_source === 'WHATSAPP'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {item.booking_source === 'WHATSAPP' ? 'WA Booking' : 'Manual Satpam'}
                          </span>
                          {(item.created_at || item.waktu_chat_masuk) && (() => {
                            const ts = new Date(item.created_at || item.waktu_chat_masuk).getTime();
                            const diffMs = Date.now() - ts;
                            if (diffMs < 5 * 60 * 1000 && diffMs >= 0) {
                              const timeStr = new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace('.', ':');
                              return (
                                <span className="block text-[8px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1 py-0.2 rounded font-mono animate-pulse">
                                  Baru saja • {timeStr}
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">{item.nama_santri}</td>
                      <td className="py-3 px-3">
                        <div className="text-slate-800 font-semibold">{item.kelas}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{item.asal || 'Surabaya'}</div>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-800">
                        <div className="font-bold">{item.jam_kunjungan} WIB</div>
                        {item.jam_masuk_aktual && (
                          <div className="text-[10px] text-emerald-600 font-semibold font-mono mt-0.5">
                            Masuk: {item.jam_masuk_aktual}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600">
                        <div>{item.jam_selesai} WIB</div>
                        {isOngoing && (() => {
                          const cd = calculateVisitCountdown(item.jam_selesai, item.tanggal_kunjungan);
                          if (!cd) return null;
                          if (cd.isOverstay) {
                            return (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse mt-0.5">
                                <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                                ⚠️ Overstay ({cd.remainingText})
                              </span>
                            );
                          }
                          return (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-300 mt-0.5">
                              <Clock className="w-2.5 h-2.5 text-blue-600 animate-spin" />
                              ⏳ Sisa: {cd.remainingText}
                            </span>
                          );
                        })()}
                        {item.jam_keluar_aktual && (
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            Keluar: {item.jam_keluar_aktual}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-slate-700 max-w-[150px] truncate" title={item.titipan_barang}>
                          {item.titipan_barang || '-'}
                        </div>
                        <span className="text-[10px] font-mono font-bold text-cyan-800 bg-cyan-100 px-1.5 py-0.2 rounded mt-0.5 inline-block">
                          {item.berat_barang_kg || 0} Kg
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-800">{item.nama_penjenguk}</div>
                        <span className="text-[10px] text-slate-400">{item.status_penjenguk}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {isApproved && (
                          <button
                            onClick={() => checkInVisitBooking(item.id, 'MANUAL_SATPAM')}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition shadow-xs"
                          >
                            Check-In Datang
                          </button>
                        )}
                        {isOngoing && (
                          <button
                            onClick={() => checkOutVisitBooking(item.id)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold transition shadow-xs flex items-center gap-1 mx-auto"
                          >
                            <LogOut className="w-3 h-3" />
                            <span>Selesai / Pulang</span>
                          </button>
                        )}
                        {isPending && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                            Menunggu Approval
                          </span>
                        )}
                        {isDone && (
                          <span className="text-[10px] font-bold text-slate-400">
                            ✓ Selesai
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

