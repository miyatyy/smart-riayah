import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Calendar,
  Clock,
  Package,
  UserCheck,
  CheckCircle,
  XCircle,
  AlertCircle,
  QrCode,
  Smartphone,
  Shield,
  Search,
  Filter,
  Sliders,
  Sparkles,
  Download,
  Copy,
  Printer,
  ChevronDown,
  ChevronUp,
  Plus,
  RefreshCw,
  Send,
  Eye,
  Check,
  ArrowRight,
  Bot,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { sound } from '../../utils/audio';
import { parseBookingWithDeepSeek } from '../../services/deepseekVisitService';
import { getRealtimePondokClock, calculateVisitCountdown, checkBarcodeLifecycle } from '../../utils/pondokTimeUtils';
import { getBarcodeImageUrl, getVisitGatePassUrls, downloadBarcodeImage, generateLocalQrDataUrl } from '../../utils/barcodeUtils';
import { LocalQrImage, LocalCode128Image } from '../common/LocalBarcodeImages';

export default function VisitBookingManager({ isCompact = false }) {
  const {
    visitBookings,
    visitSettings,
    updateVisitSettings,
    approveVisitBooking,
    rejectVisitBooking,
    checkInVisitBooking,
    checkOutVisitBooking,
    simulateWaBooking,
    santriList,
    addVisitBooking,
    isFonnteEnabled,
    resendBarcodeToWa
  } = useApp();

  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL' | 'APPROVED_LOGS' | 'PENDING' | 'WEEKEND' | 'SATPAM' | 'ACTIVE' | 'COMPLETED'
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSimulateModalOpen, setIsSimulateModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [selectedBookingForPass, setSelectedBookingForPass] = useState(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [customWaChat, setCustomWaChat] = useState("Assalamu'alaikum ustadz, saya Ibu Arbainah wali ananda Nurmiyaty kelas 10-B Putri kamar Khadijah 105 dari Surabaya, mau sambang hari Senin jam 14.00 WIB bawa madu herbal 2 kg.");
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [toastNotification, setToastNotification] = useState(null);

  // Live Clock Ticking Engine (1000ms)
  const [liveClock, setLiveClock] = useState(() => getRealtimePondokClock());

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveClock(getRealtimePondokClock());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Settings local state
  const [localSettings, setLocalSettings] = useState({ ...visitSettings });

  // Manual input form state (auto-fill real-time clock)
  const [manualForm, setManualForm] = useState(() => {
    const clock = getRealtimePondokClock();
    const [h, m] = clock.jam_menit.split(':').map(Number);
    const endH = String((h + 1) % 24).padStart(2, '0');
    const endM = String(m).padStart(2, '0');
    return {
      nama_santri: '',
      kelas: '',
      asal: '',
      jam_kunjungan: clock.jam_menit,
      jam_selesai: `${endH}:${endM}`,
      titipan_barang: '',
      berat_barang_kg: 1.0,
      nama_penjenguk: '',
      status_penjenguk: 'Wali Santri',
      status_penjenguk_lainnya: '',
      no_wa_penjenguk: '',
      tanggal_kunjungan: clock.tanggal_ymd
    };
  });

  const handleOpenManualModal = () => {
    const clock = getRealtimePondokClock();
    const [h, m] = clock.jam_menit.split(':').map(Number);
    const endH = String((h + 1) % 24).padStart(2, '0');
    const endM = String(m).padStart(2, '0');
    setManualForm(prev => ({
      ...prev,
      tanggal_kunjungan: clock.tanggal_ymd,
      jam_kunjungan: clock.jam_menit,
      jam_selesai: `${endH}:${endM}`
    }));
    setIsManualModalOpen(true);
  };

  // Calculate metrics
  const bookings = Array.isArray(visitBookings) ? visitBookings : [];
  const todayStr = new Date().toISOString().slice(0, 10);
  
  const isPendingApprovalStatus = (status) => {
    const s = String(status || '').toLowerCase();
    return s.includes('menunggu approval') || s.includes('menunggu') || s === 'pending';
  };

  const totalHariIni = bookings.filter(b => b.tanggal_kunjungan === todayStr || b.status_kunjungan === 'Sedang Berkunjung').length;
  const pendingWeekday = bookings.filter(b => isPendingApprovalStatus(b.status_kunjungan || b.status)).length;
  const autoApprovedWeekend = bookings.filter(b => b.approval_type === 'AUTO_WEEKEND').length;
  const approvedVisitsCount = bookings.filter(b => 
    b.status_kunjungan === 'Disetujui (Siap Datang)' || 
    b.approval_type === 'AUTO_WEEKEND' || 
    (b.barcode_token && !isPendingApprovalStatus(b.status_kunjungan || b.status) && b.status_kunjungan !== 'Ditolak')
  ).length;
  const totalBeratTitipan = bookings.reduce((sum, b) => sum + (Number(b.berat_barang_kg) || 0), 0).toFixed(1);

  // Filter bookings
  const filteredBookings = bookings.filter(b => {
    // Tab filter
    if (activeFilter === 'APPROVED_LOGS' && !(
      b.status_kunjungan === 'Disetujui (Siap Datang)' || 
      b.approval_type === 'AUTO_WEEKEND' || 
      (b.barcode_token && !isPendingApprovalStatus(b.status_kunjungan || b.status) && b.status_kunjungan !== 'Ditolak')
    )) return false;
    if (activeFilter === 'PENDING' && !isPendingApprovalStatus(b.status_kunjungan || b.status)) return false;
    if (activeFilter === 'WEEKEND' && b.approval_type !== 'AUTO_WEEKEND') return false;
    if (activeFilter === 'SATPAM' && b.booking_source !== 'MANUAL_SATPAM') return false;
    if (activeFilter === 'ACTIVE' && b.status_kunjungan !== 'Sedang Berkunjung') return false;
    if (activeFilter === 'COMPLETED' && b.status_kunjungan !== 'Selesai') return false;

    // Date filter
    if (dateFilter && b.tanggal_kunjungan !== dateFilter) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSantri = b.nama_santri?.toLowerCase().includes(q);
      const matchPenjenguk = b.nama_penjenguk?.toLowerCase().includes(q);
      const matchWa = b.no_wa_penjenguk?.includes(q);
      const matchKelas = b.kelas?.toLowerCase().includes(q);
      const matchBarang = b.titipan_barang?.toLowerCase().includes(q);
      const matchToken = b.barcode_token?.toLowerCase().includes(q);
      return matchSantri || matchPenjenguk || matchWa || matchKelas || matchBarang || matchToken;
    }

    return true;
  });

  const handleSaveSettings = (e) => {
    e.preventDefault();
    updateVisitSettings(localSettings);
    setIsSettingsOpen(false);
  };

  const handleSantriSelect = (santriId) => {
    const s = santriList.find(item => item.id === santriId);
    if (s) {
      setManualForm(prev => ({
        ...prev,
        nama_santri: s.nama,
        kelas: `${s.kelas} (${s.kamar})`,
        asal: s.wali?.alamat?.split(',')?.pop()?.trim() || 'Surabaya',
        nama_penjenguk: s.wali?.nama || '',
        no_wa_penjenguk: s.wali?.telepon || ''
      }));
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualForm.nama_santri || !manualForm.nama_penjenguk) {
      alert('Nama Santri dan Nama Penjenguk wajib diisi!');
      return;
    }
    if (manualForm.status_penjenguk === 'Lainnya' && !manualForm.status_penjenguk_lainnya?.trim()) {
      alert('Silakan ketik keterangan status penjenguk lainnya!');
      return;
    }

    const finalStatus = manualForm.status_penjenguk === 'Lainnya' && manualForm.status_penjenguk_lainnya?.trim()
      ? `Lainnya (${manualForm.status_penjenguk_lainnya.trim()})`
      : manualForm.status_penjenguk;

    addVisitBooking({
      ...manualForm,
      status_penjenguk: finalStatus,
      status_penjenguk_lainnya: manualForm.status_penjenguk_lainnya?.trim() || '',
      booking_source: 'MANUAL_SATPAM'
    });
    setIsManualModalOpen(false);
    // Reset form
    setManualForm({
      nama_santri: '',
      kelas: '',
      asal: '',
      jam_kunjungan: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':'),
      jam_selesai: '',
      titipan_barang: '',
      berat_barang_kg: 1.0,
      nama_penjenguk: '',
      status_penjenguk: 'Wali Santri',
      status_penjenguk_lainnya: '',
      no_wa_penjenguk: '',
      tanggal_kunjungan: new Date().toISOString().slice(0, 10)
    });
  };

  const handleAiSimulate = async () => {
    if (!customWaChat.trim()) return;
    setIsAiParsing(true);
    sound.playBeep?.();
    try {
      const res = await parseBookingWithDeepSeek(customWaChat);
      setIsAiParsing(false);
      if (res && res.booking) {
        addVisitBooking(res.booking);
        setIsSimulateModalOpen(false);
        sound.playSuccess?.();
      }
    } catch (e) {
      setIsAiParsing(false);
      alert('Gagal memproses AI DeepSeek: ' + e.message);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard?.writeText(text);
    setCopiedToken(true);
    sound.playBeep?.();
    setTimeout(() => setCopiedToken(false), 2000);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* ─── BARIS STATUS JAM & HARI REAL-TIME (LIVE CLOCK & MODE SISTEM) ─── */}
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-4 shadow-lg text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-3 font-sans">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shadow-inner shrink-0">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase font-mono flex items-center gap-1.5">
              <span>🕒 Waktu Sistem Real-Time</span>
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

      {/* ─── 1. HEADER & 4 KARTU METRIK UTAMA ─── */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-3xl p-6 sm:p-7 shadow-xl border border-emerald-700/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold tracking-wider uppercase font-mono flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                Live QR Gate Pass &amp; WhatsApp Integration
              </span>
              <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-[10px] font-mono">
                Aturan Hari: Senin–Kamis vs Weekend
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Manajemen Kunjungan, Titipan Barang &amp; Booking WA</span>
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100/80 mt-1 max-w-2xl leading-relaxed">
              Pusat kendali operasional sambangan santri terintegrasi WhatsApp Gateway, sistem verifikasi barcode digital satpam, dan audit titipan barang harian.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap self-start lg:self-center">
            <button
              onClick={() => setIsSimulateModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-xs shadow-md transition flex items-center gap-2"
            >
              <Smartphone className="w-4 h-4 text-emerald-100" />
              <span>Simulasi Booking WA</span>
            </button>
            <button
              onClick={handleOpenManualModal}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4 text-emerald-300" />
              <span>Input Tamu Manual</span>
            </button>
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs transition flex items-center justify-center"
              title="Pengaturan Batas Kunjungan"
            >
              <Sliders className="w-4 h-4 text-emerald-300" />
            </button>
          </div>
        </div>

        {/* 4 Kartu Metrik Kunjungan */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mt-6 pt-6 border-t border-emerald-800/60">
          <div className="bg-emerald-950/50 border border-emerald-700/40 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-300 font-mono uppercase tracking-wider">
                TOTAL KUNJUNGAN HARI INI
              </span>
              <Calendar className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl sm:text-3xl font-black text-white font-mono">{totalHariIni}</span>
              <span className="text-[11px] text-emerald-300 font-semibold">Tamu</span>
            </div>
            <p className="text-[10px] text-emerald-200/70 mt-1">Kuota: max {visitSettings.kuota_harian_weekend}/hari</p>
          </div>

          <div className="bg-amber-950/40 border border-amber-600/40 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-amber-300 font-mono uppercase tracking-wider">
                MENUNGGU APPROVAL (SENIN–KAMIS)
              </span>
              <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl sm:text-3xl font-black text-amber-300 font-mono">{pendingWeekday}</span>
              <span className="text-[11px] text-amber-200 font-semibold">Perlu Review</span>
            </div>
            <p className="text-[10px] text-amber-200/70 mt-1">Wajib persetujuan Admin Ri'ayah</p>
          </div>

          <div className="bg-teal-950/40 border border-teal-600/40 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-teal-300 font-mono uppercase tracking-wider">
                AUTO-APPROVED (WEEKEND)
              </span>
              <CheckCircle className="w-4 h-4 text-teal-400" />
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl sm:text-3xl font-black text-teal-300 font-mono">{autoApprovedWeekend}</span>
              <span className="text-[11px] text-teal-200 font-semibold">Instan</span>
            </div>
            <p className="text-[10px] text-teal-200/70 mt-1">Jumat–Minggu: Barcode langsung terbit</p>
          </div>

          <div className="bg-cyan-950/40 border border-cyan-600/40 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-cyan-300 font-mono uppercase tracking-wider">
                TOTAL TITIPAN BARANG
              </span>
              <Package className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl sm:text-3xl font-black text-cyan-300 font-mono">{totalBeratTitipan}</span>
              <span className="text-[11px] text-cyan-200 font-semibold">Kg</span>
            </div>
            <p className="text-[10px] text-cyan-200/70 mt-1">Pemeriksaan di Pos Satpam</p>
          </div>
        </div>
      </div>

      {/* ─── 2. PANEL PENGATURAN BATAS KUNJUNGAN (COLLAPSIBLE) ─── */}
      {isSettingsOpen && (
        <div className="bg-white rounded-2xl border border-emerald-200 p-5 shadow-sm space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-sm text-slate-800">Pengaturan Batas Kunjungan &amp; Auto-Approval (Admin Ri'ayah)</h3>
            </div>
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ✕ Tutup
            </button>
          </div>

          <form onSubmit={handleSaveSettings} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Jam Buka Layanan</label>
              <input
                type="time"
                value={localSettings.jam_operasional_mulai}
                onChange={(e) => setLocalSettings(prev => ({ ...prev, jam_operasional_mulai: e.target.value }))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-1 focus:ring-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Jam Tutup Layanan</label>
              <input
                type="time"
                value={localSettings.jam_operasional_selesai}
                onChange={(e) => setLocalSettings(prev => ({ ...prev, jam_operasional_selesai: e.target.value }))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-1 focus:ring-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Max Durasi Sambangan</label>
              <select
                value={localSettings.max_durasi_menit}
                onChange={(e) => setLocalSettings(prev => ({ ...prev, max_durasi_menit: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-1 focus:ring-emerald-500 font-semibold"
              >
                <option value="60">60 Menit (1 Jam)</option>
                <option value="90">90 Menit (1.5 Jam)</option>
                <option value="120">120 Menit (2 Jam)</option>
                <option value="180">180 Menit (3 Jam)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Kuota Harian (Senin–Kamis)</label>
              <input
                type="number"
                value={localSettings.kuota_harian_weekday}
                onChange={(e) => setLocalSettings(prev => ({ ...prev, kuota_harian_weekday: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-1 focus:ring-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Kuota Harian (Weekend)</label>
              <input
                type="number"
                value={localSettings.kuota_harian_weekend}
                onChange={(e) => setLocalSettings(prev => ({ ...prev, kuota_harian_weekend: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-1 focus:ring-emerald-500 font-mono"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="autoApproveWeekendToggle"
                  checked={localSettings.auto_approve_weekend}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, auto_approve_weekend: e.target.checked }))}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                />
                <label htmlFor="autoApproveWeekendToggle" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Auto-Approval Khusus Hari Jumat, Sabtu &amp; Minggu (Barcode Langsung Terbit ke WA Wali Santri)
                </label>
              </div>

              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-sm"
              >
                Simpan Konfigurasi
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Toast Feedback Pengiriman Barcode */}
      {toastNotification && (
        <div className="p-3.5 rounded-2xl bg-teal-600 text-white text-xs font-bold flex items-center justify-between gap-3 shadow-md animate-in slide-in-from-top-2 border border-teal-700">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-white" />
            <span>{toastNotification}</span>
          </div>
          <button onClick={() => setToastNotification(null)} className="p-1 hover:bg-white/20 rounded">
            ✕
          </button>
        </div>
      )}

      {/* ─── 3. TABEL MONITORING KUNJUNGAN & BOOKING WHATSAPP ─── */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden space-y-0">
        {/* Table Top Controls & Filter */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Quick Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
            {[
              { id: 'ALL', label: `Semua (${bookings.length})` },
              { id: 'APPROVED_LOGS', label: `📜 Log Approval & Kirim Barcode (${approvedVisitsCount})` },
              { id: 'PENDING', label: `Perlu Approval (${pendingWeekday})`, badge: pendingWeekday > 0 },
              { id: 'WEEKEND', label: `Booking Weekend (${autoApprovedWeekend})` },
              { id: 'SATPAM', label: 'Input Satpam' },
              { id: 'ACTIVE', label: 'Sedang Berkunjung' },
              { id: 'COMPLETED', label: 'Selesai' }
            ].map(chip => (
              <button
                key={chip.id}
                onClick={() => { setActiveFilter(chip.id); sound.playBeep?.(); }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                  activeFilter === chip.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{chip.label}</span>
                {chip.badge && (
                  <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping" />
                )}
              </button>
            ))}
          </div>

          {/* Search & Date Controls */}
          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari santri / penjenguk / WA..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
              />
            </div>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 text-slate-600 font-mono"
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter('')}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Tabel Data 7 Kolom Spesifikasi */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                <th className="py-3 px-4">1. Waktu &amp; Sumber</th>
                <th className="py-3 px-4">2. Santri &amp; Kamar</th>
                <th className="py-3 px-4">3. Data Penjenguk</th>
                <th className="py-3 px-4">4. Jam Sambangan</th>
                <th className="py-3 px-4">5. Titipan Barang</th>
                <th className="py-3 px-4">6. Status &amp; Aturan Hari</th>
                <th className="py-3 px-4 text-center">7. Aksi Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <Package className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600 text-xs">Tidak ada data jadwal kunjungan yang cocok.</p>
                    <p className="text-[11px] text-slate-400">Gunakan tombol "Simulasi Booking WA" untuk menguji alur.</p>
                  </td>
                </tr>
              ) : (
                filteredBookings.map((b) => {
                  const isWaiting = isPendingApprovalStatus(b.status_kunjungan || b.status);
                  const isWeekend = b.approval_type === 'AUTO_WEEKEND' || ['Jumat', 'Sabtu', 'Minggu'].includes(b.hari_kunjungan);
                  const isOngoing = b.status_kunjungan === 'Sedang Berkunjung';
                  const isCompleted = b.status_kunjungan === 'Selesai';
                  const isApproved = b.status_kunjungan === 'Disetujui (Siap Datang)' || b.status_kunjungan?.includes('Disetujui');

                  return (
                    <tr key={b.id} className="hover:bg-slate-50/60 transition">
                      {/* Kolom 1: Waktu & Sumber */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                              b.booking_source?.includes('WHATSAPP')
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {b.booking_source?.includes('WHATSAPP') ? (
                                <>
                                  <Smartphone className="w-2.5 h-2.5" />
                                  Via WhatsApp AI
                                </>
                              ) : (
                                <>
                                  <Shield className="w-2.5 h-2.5" />
                                  Input Satpam
                                </>
                              )}
                            </span>
                            {(b.created_at || b.waktu_chat_masuk) && (() => {
                              const ts = new Date(b.created_at || b.waktu_chat_masuk).getTime();
                              const diffMs = Date.now() - ts;
                              if (diffMs < 5 * 60 * 1000 && diffMs >= 0) {
                                const timeStr = new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace('.', ':');
                                return (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse font-mono">
                                    Baru saja • {timeStr}
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                          <div className="font-bold text-slate-800 text-xs">
                            {b.hari_kunjungan}, {b.tanggal_kunjungan}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono block">ID: {b.id}</span>
                        </div>
                      </td>

                      {/* Kolom 2: Nama Santri & Kelas */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-xs">{b.nama_santri}</div>
                        <div className="text-[11px] text-slate-600 font-medium">{b.kelas}</div>
                        <span className="text-[10px] text-slate-400 font-mono">Asal: {b.asal || 'Surabaya'}</span>
                      </td>

                      {/* Kolom 3: Data Penjenguk */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">{b.nama_penjenguk}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-600">
                            {b.status_penjenguk}
                          </span>
                          <span className="text-[10px] font-mono text-emerald-700">
                            {b.no_wa_penjenguk}
                          </span>
                        </div>
                      </td>

                      {/* Kolom 4: Jam Kunjungan */}
                      <td className="py-3 px-4 font-mono">
                        <div className="text-slate-800 font-bold">
                          {b.jam_kunjungan} - {b.jam_selesai || '15:30'} WIB
                        </div>
                        {isOngoing && (() => {
                          const cd = calculateVisitCountdown(b.jam_selesai, b.tanggal_kunjungan);
                          if (!cd) {
                            return (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 animate-pulse mt-0.5">
                                <Clock className="w-2.5 h-2.5" />
                                Aktif di Area Kunjungan
                              </span>
                            );
                          }
                          if (cd.isOverstay) {
                            return (
                              <div className="mt-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                                  <AlertCircle className="w-2.5 h-2.5 text-rose-600" />
                                  ⚠️ Waktu Habis ({cd.remainingText})
                                </span>
                              </div>
                            );
                          }
                          return (
                            <div className="mt-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                                <Clock className="w-2.5 h-2.5 text-blue-600 animate-spin" />
                                ⏳ Sisa: {cd.remainingText}
                              </span>
                            </div>
                          );
                        })()}
                        {b.jam_masuk_aktual && (
                          <div className="text-[10px] text-emerald-600 font-mono mt-0.5">
                            Masuk: {b.jam_masuk_aktual}
                          </div>
                        )}
                        {b.jam_keluar_aktual && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            Keluar: {b.jam_keluar_aktual}
                          </div>
                        )}
                        {isCompleted && !b.jam_keluar_aktual && (
                          <span className="text-[10px] text-slate-400">
                            Selesai {b.jam_checkout_aktual || ''}
                          </span>
                        )}
                      </td>

                      {/* Kolom 5: Titipan Barang & Berat (Kg) */}
                      <td className="py-3 px-4">
                        <div className="text-slate-700 max-w-xs truncate" title={b.titipan_barang}>
                          {b.titipan_barang || '-'}
                        </div>
                        <div className="mt-1">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-cyan-100 text-cyan-800">
                            ⚖️ {b.berat_barang_kg || 0} Kg
                          </span>
                        </div>
                      </td>

                      {/* Kolom 6: Status & Tipe Approval */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          {isWaiting && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                              Menunggu Approval
                            </span>
                          )}
                          {isApproved && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-300">
                              <CheckCircle className="w-3 h-3 text-teal-600" />
                              Disetujui (Siap Datang)
                            </span>
                          )}
                          {isOngoing && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 animate-pulse">
                              <UserCheck className="w-3 h-3 text-blue-600" />
                              Sedang Berkunjung
                            </span>
                          )}
                          {isCompleted && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              <Check className="w-3 h-3 text-slate-500" />
                              Selesai Check-Out
                            </span>
                          )}
                          {b.status_kunjungan === 'Ditolak' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              Ditolak Admin
                            </span>
                          )}

                          <div className="text-[10px] font-mono text-slate-500">
                            {isWeekend ? (
                              <span className="text-teal-700 font-bold">Auto-Approved Weekend</span>
                            ) : (
                              <span className="text-amber-700 font-bold">Aturan Weekday (Senin-Kamis)</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Kolom 7: Aksi Admin */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {isWaiting ? (
                            <>
                              <button
                                onClick={() => approveVisitBooking(b.id)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition shadow-xs flex items-center gap-1"
                                title="Setujui permohonan kunjungan dan kirim Barcode Gate Pass via WhatsApp"
                              >
                                <Check className="w-3 h-3" />
                                <span>Setujui &amp; Kirim Barcode WA</span>
                              </button>
                              <button
                                onClick={() => {
                                  const reason = prompt('Masukkan alasan penolakan kunjungan santri:', 'Jadwal pondok padat/Ujian madrasah');
                                  if (reason) rejectVisitBooking(b.id, reason);
                                }}
                                className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] transition border border-rose-200"
                                title="Tolak permohonan kunjungan"
                              >
                                Tolak
                              </button>
                            </>
                          ) : (
                            <div className="flex flex-col items-center gap-1.5 justify-center">
                              <div className="flex items-center gap-1.5 justify-center flex-wrap">
                                {/* Tombol Kirim Ulang Barcode ke WA */}
                                {(() => {
                                  const lifecycle = checkBarcodeLifecycle(b, liveClock);
                                  if (lifecycle.status === 'EXPIRED_COMPLETED' || lifecycle.status === 'EXPIRED_DATE_PAST') {
                                    return (
                                      <button
                                        disabled
                                        className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-400 font-bold text-[10px] cursor-not-allowed border border-slate-200 flex items-center gap-1"
                                        title={lifecycle.message}
                                      >
                                        <span>🔒 Masa Kunjungan Berakhir</span>
                                      </button>
                                    );
                                  }
                                  return (
                                    <button
                                      onClick={async () => {
                                        if (typeof resendBarcodeToWa === 'function') {
                                          const res = await resendBarcodeToWa(b.id);
                                          if (res.success) {
                                            setToastNotification(res.message);
                                            sound.playSuccess?.();
                                            setTimeout(() => setToastNotification(null), 5000);
                                          } else {
                                            alert(res.message);
                                          }
                                        }
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-[10px] transition shadow-xs flex items-center gap-1"
                                      title={`Kirim ulang tiket barcode resmi ke nomor WhatsApp Wali (${b.no_wa_penjenguk})`}
                                    >
                                      <Send className="w-3 h-3" />
                                      <span>📲 Kirim Ulang Barcode ke WA</span>
                                    </button>
                                  );
                                })()}

                                <button
                                  onClick={() => setSelectedBookingForPass(b)}
                                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] transition border border-slate-200 flex items-center gap-1"
                                  title="Lihat detail tiket & QR code"
                                >
                                  <QrCode className="w-3 h-3 text-emerald-600" />
                                  <span>Lihat Tiket</span>
                                </button>
                                <button
                                  onClick={() => {
                                    const token = b.barcode_token || b.id;
                                    const { gatePassUrl } = getVisitGatePassUrls(token);
                                    window.open(gatePassUrl, '_blank');
                                    sound.playSuccess?.();
                                  }}
                                  className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[10px] transition border border-emerald-200 flex items-center gap-1 shadow-2xs"
                                  title="Buka simulasi scan E-Kupon langsung di tab baru"
                                >
                                  <ExternalLink className="w-3 h-3 text-emerald-600" />
                                  <span className="hidden sm:inline">Kupon</span>
                                </button>
                              </div>

                              {b.waktu_kirim_ulang_wa && (
                                <span className="text-[9px] text-teal-700 font-mono font-medium">
                                  📲 Dikirim ulang: {b.waktu_kirim_ulang_wa}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── 4. MODAL E-TICKET BARCODE WHATSAPP (QR GATE PASS RESMI) ─── */}
      {selectedBookingForPass && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-emerald-300 overflow-hidden animate-scale-up">
            {/* Header Tiket */}
            <div className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white p-5 text-center relative">
              <span className="text-[10px] tracking-widest uppercase font-mono font-bold text-emerald-200 block mb-0.5">
                PONDOK PESANTREN MODERN DARUL ULUM
              </span>
              <h3 className="text-base font-black tracking-tight">E-TICKET QR GATE PASS KUNJUNGAN</h3>
              <p className="text-[11px] text-emerald-100/80 mt-0.5">
                Tunjukkan Barcode ini kepada Satpam di Pos Penjagaan Gerbang Utama
              </p>
              <button
                onClick={() => setSelectedBookingForPass(null)}
                className="absolute top-4 right-4 text-white/70 hover:text-white font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Badan Tiket & Visual Barcode */}
            <div className="p-6 space-y-5 text-center">
              {/* Visual Box QR & Barcode Nyata (Real Scannable Image) */}
              {(() => {
                const token = selectedBookingForPass.barcode_token || selectedBookingForPass.id;
                const { gatePassUrl, qrCodeUrl, linearBarcodeUrl } = getVisitGatePassUrls(token);

                return (
                  <div className="p-4 bg-slate-50 border-2 border-dashed border-emerald-400/80 rounded-2xl space-y-4">
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                      {/* Format 1: 2D QR Code Image (Instan Lokal) */}
                      <div className="flex flex-col items-center">
                        <div className="w-36 h-36 bg-white p-1 rounded-xl border border-slate-200 shadow-xs flex items-center justify-center overflow-hidden group relative">
                          <LocalQrImage
                            value={gatePassUrl || token}
                            size={320}
                            fallbackSrc={qrCodeUrl}
                            alt={`QR Code Pass - ${token}`}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <span className="text-[10px] font-mono font-bold text-slate-500 mt-1 uppercase tracking-wider">
                          QR Code 2D (Smartphone / Gate)
                        </span>
                      </div>

                      {/* Format 2: 1D Linear Barcode 128 Image (Instan Lokal) */}
                      <div className="flex flex-col items-center justify-center sm:border-l sm:border-slate-100 sm:pl-4">
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-center overflow-hidden max-w-[220px]">
                          <LocalCode128Image
                            value={token}
                            fallbackSrc={linearBarcodeUrl}
                            alt={`Barcode 128 - ${token}`}
                            className="h-16 object-contain"
                          />
                        </div>
                        <span className="text-[10px] font-mono font-bold text-slate-500 mt-1 uppercase tracking-wider">
                          Barcode 1D (Code 128 Laser Satpam)
                        </span>
                      </div>
                    </div>

                    <div className="font-mono text-xs font-bold text-slate-800 tracking-wider">
                      KODE TOKEN: <span className="text-emerald-700 font-extrabold">{token || 'MENUNGGU APPROVAL'}</span>
                    </div>

                    <div className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 py-1.5 px-3 rounded-xl flex items-center justify-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Gambar barcode di atas aktif &amp; siap di-scan langsung oleh kamera / barcode scanner pos gerbang</span>
                    </div>
                  </div>
                );
              })()}

              {/* Data Detail Tiket */}
              <div className="text-left bg-slate-50 p-4 rounded-2xl space-y-2 text-xs border border-slate-200/80">
                <div className="flex justify-between">
                  <span className="text-slate-500">Santri yang Dijenguk:</span>
                  <strong className="text-slate-900">{selectedBookingForPass.nama_santri}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Kelas / Asrama:</span>
                  <span className="text-slate-800 font-semibold">{selectedBookingForPass.kelas}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Nama Penjenguk:</span>
                  <strong className="text-slate-900">{selectedBookingForPass.nama_penjenguk} ({selectedBookingForPass.status_penjenguk})</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Hari &amp; Tanggal:</span>
                  <span className="text-emerald-700 font-bold">{selectedBookingForPass.hari_kunjungan}, {selectedBookingForPass.tanggal_kunjungan}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Jam Kunjungan:</span>
                  <span className="font-mono font-bold text-slate-800">{selectedBookingForPass.jam_kunjungan} - {selectedBookingForPass.jam_selesai} WIB</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="text-slate-500">Titipan Barang:</span>
                  <span className="text-slate-800 font-semibold max-w-[200px] text-right truncate">
                    {selectedBookingForPass.titipan_barang || '-'} ({selectedBookingForPass.berat_barang_kg || 0} Kg)
                  </span>
                </div>
              </div>

              {/* Action Buttons Tiket */}
              {(() => {
                const token = selectedBookingForPass.barcode_token || selectedBookingForPass.id;
                const { qrCodeUrl, gatePassUrl } = getVisitGatePassUrls(token);

                return (
                  <div className="space-y-2.5 pt-1">
                    {/* Tombol Utama: Buka Halaman Kupon (Simulasi Scan Link HP) */}
                    <button
                      onClick={() => {
                        window.open(gatePassUrl, '_blank');
                        sound.playSuccess?.();
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs transition shadow-md flex items-center justify-center gap-2"
                      title="Membuka simulasi tampilan scan link kupon resmi di halaman baru"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>🔗 Buka Halaman Kupon (Simulasi Scan Link)</span>
                    </button>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => copyToClipboard(gatePassUrl)}
                        className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition flex items-center justify-center gap-1.5 border border-slate-200"
                        title="Salin link halaman kupon kunjungan WhatsApp"
                      >
                        {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                        <span>{copiedToken ? 'Disalin!' : 'Copy Link Kupon WA'}</span>
                      </button>
                      <button
                        onClick={async () => {
                          const localPng = await generateLocalQrDataUrl(gatePassUrl || token, 500).catch(() => qrCodeUrl);
                          downloadBarcodeImage(localPng || qrCodeUrl, `Barcode_GatePass_${selectedBookingForPass.nama_santri}.png`);
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs transition flex items-center justify-center gap-1.5"
                        title="Unduh file gambar QR Code ke laptop/HP"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Unduh QR</span>
                      </button>
                      <button
                        onClick={() => window.open(qrCodeUrl, '_blank')}
                        className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center justify-center gap-1"
                        title="Buka gambar QR penuh"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Lihat QR</span>
                      </button>
                      <button
                        onClick={() => { window.print(); sound.playBeep?.(); }}
                        className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Cetak</span>
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ─── 5. MODAL SIMULASI BOOKING WHATSAPP (TESTING PRAKTIS) ─── */}
      {isSimulateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-900">Simulasi Chat Booking WhatsApp Masuk</h3>
              </div>
              <button
                onClick={() => setIsSimulateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Pilih skenario simulasi pesan yang dikirimkan oleh Wali Santri ke nomor WhatsApp Gateway pesantren:
            </p>

            <div className="space-y-3">
              <button
                onClick={() => {
                  simulateWaBooking('WEEKEND');
                  setIsSimulateModalOpen(false);
                }}
                className="w-full p-4 rounded-2xl bg-teal-50 hover:bg-teal-100 border border-teal-200 text-left transition space-y-1 group"
              >
                <div className="flex items-center justify-between">
                  <strong className="text-xs text-teal-900 font-bold group-hover:text-teal-950 flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-teal-600" />
                    Skenario 1: Kunjungan Hari JUMAT / WEEKEND (Auto-Approved)
                  </strong>
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-teal-200 text-teal-800">
                    Instan Barcode
                  </span>
                </div>
                <p className="text-[11px] text-teal-800">
                  Wali mengajukan kunjungan hari Jumat/Sabtu/Minggu. Sistem langsung menerbitkan Barcode Gate Pass otomatis detik itu juga tanpa perlu klik Admin.
                </p>
              </button>

              <button
                onClick={() => {
                  simulateWaBooking('WEEKDAY');
                  setIsSimulateModalOpen(false);
                }}
                className="w-full p-4 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-left transition space-y-1 group"
              >
                <div className="flex items-center justify-between">
                  <strong className="text-xs text-amber-900 font-bold group-hover:text-amber-950 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600" />
                    Skenario 2: Kunjungan Hari SENIN–KAMIS (Butuh Approval)
                  </strong>
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-amber-200 text-amber-800">
                    Menunggu Admin
                  </span>
                </div>
                <p className="text-[11px] text-amber-800">
                  Wali mengajukan kunjungan hari kerja. Permohonan masuk ke antrean "Menunggu Approval", dan barcode baru terkirim setelah Admin Ri'ayah menyetujui.
                </p>
              </button>

              {/* Skenario 3: Input Bebas Chat Wali via DeepSeek AI Parser */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <strong className="text-xs text-emerald-950 font-bold flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    Skenario 3: AI DeepSeek Natural Language Parser (Teks Bebas)
                  </strong>
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-200 text-emerald-900 font-mono">
                    deepseek-chat
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={customWaChat}
                  onChange={(e) => setCustomWaChat(e.target.value)}
                  placeholder="Ketik teks pesan WhatsApp bebas dari wali santri..."
                  className="w-full p-2.5 text-xs rounded-xl border border-emerald-300 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed font-sans"
                />
                <button
                  type="button"
                  onClick={handleAiSimulate}
                  disabled={isAiParsing}
                  className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  {isAiParsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                  <span>{isAiParsing ? 'Mengekstrak via DeepSeek AI...' : 'Ekstrak & Simulasikan via DeepSeek AI'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── 6. MODAL INPUT TAMU MANUAL (WALK-IN) ─── */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-900">Input Tamu Walk-In (Admin / Satpam)</h3>
              </div>
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Pilih Cepat dari Data Santri Pondok:</label>
                <select
                  onChange={(e) => handleSantriSelect(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                >
                  <option value="">-- Pilih Nama Santri (Auto-Fill Kelas &amp; Asal) --</option>
                  {santriList.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.nama} ({s.kelas} - {s.kamar})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Nama Santri *</label>
                  <input
                    type="text"
                    required
                    value={manualForm.nama_santri}
                    onChange={(e) => setManualForm(prev => ({ ...prev, nama_santri: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Kelas / Kamar Asrama</label>
                  <input
                    type="text"
                    value={manualForm.kelas}
                    onChange={(e) => setManualForm(prev => ({ ...prev, kelas: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Nama Penjenguk *</label>
                  <input
                    type="text"
                    required
                    value={manualForm.nama_penjenguk}
                    onChange={(e) => setManualForm(prev => ({ ...prev, nama_penjenguk: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Status Penjenguk</label>
                  <select
                    value={manualForm.status_penjenguk}
                    onChange={(e) => setManualForm(prev => ({ ...prev, status_penjenguk: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                  >
                    <option value="Wali Santri">Wali Santri (Orang Tua)</option>
                    <option value="Keluarga Inti">Keluarga Inti (Kakak/Adik/Kakek)</option>
                    <option value="Kerabat">Kerabat / Saudara</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
              </div>

              {/* Input Spesifik jika memilih status 'Lainnya' */}
              {manualForm.status_penjenguk === 'Lainnya' && (
                <div className="bg-amber-50/80 border border-amber-300/80 rounded-2xl p-3 animate-fade-in space-y-1.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-amber-900 text-xs flex items-center gap-1.5">
                      <span>Ketik Status / Hubungan Lainnya *</span>
                    </label>
                    <span className="text-[10px] font-medium text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-full">
                      Wajib diisi spesifik
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Paman, Alumni, Tetangga, Sopir Jemputan, dll"
                    value={manualForm.status_penjenguk_lainnya || ''}
                    onChange={(e) => setManualForm(prev => ({ ...prev, status_penjenguk_lainnya: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs shadow-xs"
                    autoFocus
                  />
                  <p className="text-[10px] text-amber-700">
                    💡 Keterangan ini akan langsung dicatat pada data kunjungan santri dan tiket barcode resmi.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tanggal Kunjungan</label>
                  <input
                    type="date"
                    value={manualForm.tanggal_kunjungan}
                    onChange={(e) => setManualForm(prev => ({ ...prev, tanggal_kunjungan: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Jam Mulai</label>
                  <input
                    type="text"
                    value={manualForm.jam_kunjungan}
                    onChange={(e) => setManualForm(prev => ({ ...prev, jam_kunjungan: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Berat Titipan (Kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={manualForm.berat_barang_kg}
                    onChange={(e) => setManualForm(prev => ({ ...prev, berat_barang_kg: parseFloat(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Deskripsi Titipan Barang:</label>
                <input
                  type="text"
                  placeholder="Contoh: Pakaian, Vitamin, Uang saku, dll"
                  value={manualForm.titipan_barang}
                  onChange={(e) => setManualForm(prev => ({ ...prev, titipan_barang: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-sm"
                >
                  Simpan &amp; Terbitkan Kunjungan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

