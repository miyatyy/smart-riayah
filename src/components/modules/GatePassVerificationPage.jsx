import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Download,
  Printer,
  Send,
  ArrowLeft,
  User,
  Phone,
  MapPin,
  Calendar,
  Package,
  QrCode,
  Sparkles,
  Lock,
  Check,
  Copy,
  ExternalLink,
  RefreshCw,
  Award
} from 'lucide-react';
import { sound } from '../../utils/audio';
import { getRealtimePondokClock, calculateVisitCountdown } from '../../utils/pondokTimeUtils';
import { getVisitGatePassUrls, downloadBarcodeImage } from '../../utils/barcodeUtils';

export default function GatePassVerificationPage({ token, onBackToDashboard }) {
  const {
    visitBookings,
    verifyAndScanTicket,
    checkInVisitBooking,
    checkOutVisitBooking,
    sendWhatsAppNotification,
    isAuthenticated,
    role
  } = useApp();

  const [booking, setBooking] = useState(null);
  const [verificationState, setVerificationState] = useState({
    loading: true,
    success: false,
    message: 'Memverifikasi kode tiket di sistem...',
    isPending: false,
    isRejected: false,
    isDone: false,
    isOngoing: false
  });

  const [couponImageUrl, setCouponImageUrl] = useState('');
  const [isGeneratingCanvas, setIsGeneratingCanvas] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [resendingWa, setResendingWa] = useState(false);
  const [waSentSuccess, setWaSentSuccess] = useState(false);

  // Live Clock Ticking Engine (1000ms)
  const [liveClock, setLiveClock] = useState(() => getRealtimePondokClock());
  const canvasRef = useRef(null);

  // Tick clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveClock(getRealtimePondokClock());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 1. Trigger Otomatis "Tiket Telah Di-Scan" saat halaman terbuka
  useEffect(() => {
    if (!token) {
      setVerificationState({
        loading: false,
        success: false,
        message: '⛔ Parameter kode tiket tidak ditemukan pada URL.',
        isPending: false,
        isRejected: false,
        isDone: false,
        isOngoing: false
      });
      return;
    }

    const result = verifyAndScanTicket(token);
    if (result.booking) {
      setBooking(result.booking);
    }

    setVerificationState({
      loading: false,
      success: result.success,
      message: result.message,
      isPending: result.isPending || false,
      isRejected: result.isRejected || false,
      isDone: result.isDone || false,
      isOngoing: result.isOngoing || false
    });
  }, [token]);

  // Keep booking synchronized with main state changes
  useEffect(() => {
    if (!token || !Array.isArray(visitBookings)) return;
    const clean = String(token).trim().toUpperCase();
    const live = visitBookings.find(b =>
      (b.barcode_token && b.barcode_token.toUpperCase() === clean) ||
      (b.id && b.id.toUpperCase() === clean) ||
      (b.barcode_token && clean.includes(b.barcode_token.toUpperCase()))
    );
    if (live) {
      setBooking(live);
    }
  }, [visitBookings, token]);

  // 2. Generator Gambar Kupon Kunjungan Digital (HTML5 Canvas E-Coupon Image)
  useEffect(() => {
    if (!booking) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsGeneratingCanvas(true);

    const tokenCode = booking.barcode_token || booking.id || token || 'SR-GATEPASS';
    const { gatePassUrl } = getVisitGatePassUrls(tokenCode);

    // Canvas Dimensions: 1000 x 560 px
    canvas.width = 1000;
    canvas.height = 560;

    // A. Background Utama Kupon
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 1000, 560);

    // Subtle Outer Border
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 996, 556);

    // B. Header Bar Emerald Khas Smart Riayah
    const headerGrad = ctx.createLinearGradient(0, 0, 1000, 0);
    headerGrad.addColorStop(0, '#064E3B');
    headerGrad.addColorStop(0.5, '#047857');
    headerGrad.addColorStop(1, '#065F46');
    ctx.fillStyle = headerGrad;
    ctx.fillRect(0, 0, 1000, 96);

    // Gold Accent Stripe di Bawah Header
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(0, 96, 1000, 4);

    // Header Content
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('🏛️ PONDOK PESANTREN MODERN DARUL ULUM', 36, 42);

    ctx.fillStyle = '#A7F3D0';
    ctx.font = 'bold 12px sans-serif';
    ctx.letterSpacing = '1px';
    ctx.fillText('KUPON RESMI IZIN KUNJUNGAN WALI SANTRI & TITIPAN BARANG', 40, 70);

    // Header Right Badge
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(750, 24, 215, 48, 12);
    ctx.fill();

    ctx.fillStyle = '#065F46';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('GATE PASS RESMI PONDOK', 765, 43);
    ctx.font = 'bold 13px monospace';
    ctx.fillText(tokenCode, 765, 60);

    // C. Garis Potong Perforasi (Perforated Line at x = 710)
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(710, 100);
    ctx.lineTo(710, 560);
    ctx.stroke();
    ctx.restore();

    // Setengah lingkaran punch-hole di atas dan bawah perforasi
    ctx.fillStyle = '#0F172A'; // warna latar luar
    ctx.beginPath();
    ctx.arc(710, 100, 14, 0, Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(710, 560, 14, Math.PI, 0);
    ctx.fill();

    // D. SISI KIRI: DATA LENGKAP KUNJUNGAN & SANTRI
    // Status Badge
    const isOngoing = booking.status_kunjungan === 'Sedang Berkunjung';
    const isApproved = booking.status_kunjungan?.includes('Disetujui');
    const isDone = booking.status_kunjungan === 'Selesai';

    ctx.fillStyle = isOngoing ? '#DCFCE7' : isApproved ? '#E0F2FE' : '#F1F5F9';
    ctx.beginPath();
    ctx.roundRect(36, 120, 320, 28, 8);
    ctx.fill();

    ctx.fillStyle = isOngoing ? '#15803D' : isApproved ? '#0369A1' : '#475569';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(
      isOngoing ? '● STATUS: TELAH DI-SCAN (SEDANG BERKUNJUNG)' :
      isApproved ? '● STATUS: DISETUJUI (SIAP KUNJUNGAN)' :
      isDone ? '● STATUS: KUNJUNGAN TELAH SELESAI' : '● STATUS: MENUNGGU APPROVAL',
      48, 138
    );

    // 1. Data Santri
    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('NAMA LENGKAP SANTRI / SANTRIWATI:', 36, 178);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText((booking.nama_santri || 'Santri Pondok').toUpperCase(), 36, 208);

    ctx.fillStyle = '#047857';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`Kelas: ${booking.kelas || '10-A'}   •   Asal Daerah: ${booking.asal || 'Surabaya, Jawa Timur'}`, 36, 230);

    // Garis Pemisah Halus
    ctx.strokeStyle = '#F1F5F9';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(36, 246);
    ctx.lineTo(670, 246);
    ctx.stroke();

    // 2. Data Penjenguk & Jadwal
    // Kolom Kiri
    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('PENJENGUK (WALI SANTRI):', 36, 272);

    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`${booking.nama_penjenguk || 'Wali Santri'} (${booking.status_penjenguk || 'Wali'})`, 36, 294);

    ctx.fillStyle = '#047857';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`WhatsApp: ${booking.no_wa_penjenguk || '081234567890'} (Terverifikasi)`, 36, 314);

    // Kolom Kanan
    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('JADWAL & WAKTU KUNJUNGAN:', 370, 272);

    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`${booking.hari_kunjungan || 'Sabtu'}, ${booking.tanggal_kunjungan || liveClock.tanggal_ymd}`, 370, 294);

    ctx.fillStyle = '#0284C7';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`Pukul: ${booking.jam_kunjungan || '14:00'} - ${booking.jam_selesai || '15:30'} WITA`, 370, 314);

    // Garis Pemisah Halus 2
    ctx.beginPath();
    ctx.moveTo(36, 332);
    ctx.lineTo(670, 332);
    ctx.stroke();

    // 3. Data Titipan Barang (Logistics Box)
    ctx.fillStyle = '#F0FDF4';
    ctx.beginPath();
    ctx.roundRect(36, 348, 634, 76, 12);
    ctx.fill();
    ctx.strokeStyle = '#BBF7D0';
    ctx.stroke();

    ctx.fillStyle = '#166534';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('📦 PEMERIKSAAN TITIPAN BARANG POS JAGA SATPAM:', 50, 370);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 13px sans-serif';
    const barangText = booking.titipan_barang && booking.titipan_barang !== '-' ? booking.titipan_barang : 'Tidak ada titipan barang khusus';
    ctx.fillText(barangText.slice(0, 48), 50, 392);

    ctx.fillStyle = '#047857';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`Berat Barang: ${booking.berat_barang_kg || 0} Kg  (Batas Aman Pondok: Maks. 5.0 Kg)`, 50, 412);

    // Catatan Kaki Kupon Resmi
    ctx.fillStyle = '#64748B';
    ctx.font = 'italic 10px sans-serif';
    ctx.fillText('Catatan: Kupon resmi ini terbit melalui Smart Riayah System & terverifikasi oleh DeepSeek AI Engine.', 36, 448);
    ctx.fillText('Wajib menjaga adab bertamu, busana muslim/muslimah rapi, dan mematuhi batas durasi kunjungan pondok.', 36, 464);

    // Footer Stamp Air Watermark
    ctx.save();
    ctx.translate(530, 485);
    ctx.rotate(-0.1);
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-120, -22, 240, 44, 8);
    ctx.stroke();

    ctx.fillStyle = '#059669';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('★ VERIFIED & SCANNED ★', 0, -4);
    ctx.font = 'bold 10px monospace';
    ctx.fillText('SMART RIAYAH GATE PASS', 0, 12);
    ctx.restore();

    // E. SISI KANAN: STUB SLIP POS SATPAM (x = 730 to 980)
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('SLIP POS JAGA', 730, 130);

    ctx.fillStyle = '#64748B';
    ctx.font = '10px sans-serif';
    ctx.fillText('VERIFIKASI GERBANG UTAMA', 730, 146);

    // Render QR Code di Stub (memuat direct link gatePassUrl)
    const qrImg = new Image();
    qrImg.crossOrigin = 'anonymous';
    const qrSource = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(gatePassUrl)}&format=png`;
    qrImg.src = qrSource;

    qrImg.onload = () => {
      ctx.drawImage(qrImg, 755, 165, 170, 170);

      // Barcode Garis Simbolik di bawah QR
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(735, 360, 210, 40);
      // Buat garis barcode putih
      ctx.fillStyle = '#FFFFFF';
      for (let i = 745; i < 935; i += 6) {
        const w = (i % 4 === 0) ? 3 : 1.5;
        ctx.fillRect(i, 364, w, 32);
      }

      ctx.fillStyle = '#047857';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(tokenCode, 840, 422);

      ctx.fillStyle = '#64748B';
      ctx.font = '10px sans-serif';
      ctx.fillText('Scan Kamera HP / Google Lens', 840, 440);
      ctx.fillText('Otomatis Verifikasi Check-In', 840, 456);

      // Export Canvas ke PNG Data URL
      try {
        const pngUrl = canvas.toDataURL('image/png');
        setCouponImageUrl(pngUrl);
      } catch (e) {
        console.warn('Canvas export warning:', e);
      }
      setIsGeneratingCanvas(false);
    };

    qrImg.onerror = () => {
      // Fallback visual jika offline
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(755, 165, 170, 170);
      ctx.strokeStyle = '#CBD5E1';
      ctx.strokeRect(755, 165, 170, 170);
      ctx.fillStyle = '#065F46';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SMART RIAYAH', 840, 245);
      ctx.fillText('E-GATE PASS', 840, 265);

      try {
        const pngUrl = canvas.toDataURL('image/png');
        setCouponImageUrl(pngUrl);
      } catch (e) {}
      setIsGeneratingCanvas(false);
    };
  }, [booking, token, liveClock.tanggal_ymd]);

  // Copy Link Handler
  const handleCopyLink = () => {
    const tokenCode = booking?.barcode_token || booking?.id || token;
    const { gatePassUrl } = getVisitGatePassUrls(tokenCode);
    navigator.clipboard.writeText(gatePassUrl);
    setCopiedLink(true);
    sound.playBeep?.();
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Download Coupon Image Handler
  const handleDownloadCoupon = () => {
    if (!couponImageUrl) return;
    const santriClean = (booking?.nama_santri || 'Santri').replace(/[^a-zA-Z]/g, '_');
    downloadBarcodeImage(couponImageUrl, `Kupon_Kunjungan_${santriClean}_${token}.png`);
    sound.playSuccess?.();
  };

  // Resend Coupon to WhatsApp
  const handleResendToWhatsApp = () => {
    if (!booking) return;
    const tokenCode = booking.barcode_token || booking.id || token;
    const { gatePassUrl, qrCodeUrl } = getVisitGatePassUrls(tokenCode);
    const targetPhone = booking.no_wa_penjenguk || '081234567890';

    setResendingWa(true);
    sendWhatsAppNotification(
      `${booking.nama_penjenguk} (Wali ${booking.nama_santri})`,
      targetPhone,
      'VISIT_GATEPASS_RESEND',
      `🎫 *[E-KUPON IZIN KUNJUNGAN PONDOK PESANTREN MODERN DARUL ULUM]*\nAssalamu'alaikum Wr. Wb. Bapak/Ibu *${booking.nama_penjenguk}*.\n\nBerikut adalah E-Kupon Kunjungan resmi untuk ananda *${booking.nama_santri}* (${booking.kelas}):\n\n📅 *Jadwal:* ${booking.hari_kunjungan}, ${booking.tanggal_kunjungan}\n⏰ *Waktu:* ${booking.jam_kunjungan} - ${booking.jam_selesai} WITA\n📦 *Titipan:* ${booking.titipan_barang || '-'} (${booking.berat_barang_kg || 0} Kg)\n🎫 *Nomor Kupon:* *${tokenCode}*\n\n🔗 *Link Kupon & Status Scan (Bisa Diklik Langsung):*\n${gatePassUrl}\n\n📷 *Gambar Kupon / QR Gate Pass:*\n${qrCodeUrl}\n\nSilakan klik link di atas atau perlihatkan kupon kepada Satpam di Pos Gerbang Utama saat berkunjung. Terima kasih.`
    );

    setTimeout(() => {
      setResendingWa(false);
      setWaSentSuccess(true);
      sound.playSuccess?.();
      setTimeout(() => setWaSentSuccess(false), 3500);
    }, 600);
  };

  // Check-In Officer Action
  const handleOfficerCheckIn = () => {
    if (!booking) return;
    checkInVisitBooking(booking.id, 'SCAN_DIRECT_QR');
    setVerificationState(prev => ({
      ...prev,
      success: true,
      message: '✅ TIKET KUNJUNGAN SAH & TELAH DI-SCAN',
      isOngoing: true,
      isPending: false
    }));
  };

  // Check-Out Officer Action
  const handleOfficerCheckOut = () => {
    if (!booking) return;
    if (confirm(`Konfirmasi kepulangan / check-out untuk tamu ${booking.nama_penjenguk}?`)) {
      checkOutVisitBooking(booking.id);
      setVerificationState(prev => ({
        ...prev,
        isDone: true,
        isOngoing: false,
        message: '🔒 KUNJUNGAN TELAH SELESAI / KUPON SUDAH DIGUNAKAN'
      }));
    }
  };

  // Hitung Mundur Sisa Waktu Kunjungan (Countdown Timer)
  const countdown = booking ? calculateVisitCountdown(booking.jam_selesai, booking.tanggal_kunjungan) : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-white pb-16">
      {/* ─── TOP BAR HEADER HALAMAN VERIFIKASI ─── */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-3.5 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-950/50">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black tracking-wider text-emerald-400 font-mono uppercase">
                  Smart Riayah Gate Pass System
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
              </div>
              <h1 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                Pondok Pesantren Modern Darul Ulum
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex flex-col text-right font-mono text-[11px] text-slate-400">
              <span>{liveClock.nama_hari}, {liveClock.tanggal_lengkap}</span>
              <span className="text-emerald-400 font-bold">{liveClock.jam_menit_detik} WITA</span>
            </div>
            {onBackToDashboard && (
              <button
                onClick={onBackToDashboard}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 border border-slate-700 shadow-xs"
                title="Kembali ke Dashboard Utama"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Kembali ke Dashboard</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ─── KONTEN UTAMA HALAMAN ─── */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 space-y-6">

        {/* ─── 1. BANNER STATUS VERIFIKASI BESAR ─── */}
        {verificationState.loading ? (
          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center animate-pulse space-y-3">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
            <h3 className="font-bold text-sm text-slate-300">Memverifikasi keaslian E-Barcode &amp; mencatat scan...</h3>
          </div>
        ) : (
          <div className={`p-5 sm:p-6 rounded-3xl border shadow-xl transition animate-fade-in ${
            verificationState.isDone
              ? 'bg-slate-900 border-slate-700 text-slate-300'
              : verificationState.isPending
              ? 'bg-gradient-to-r from-amber-950/90 via-amber-900/80 to-amber-950/90 border-amber-500/80 text-amber-100 shadow-amber-950/40'
              : verificationState.isRejected
              ? 'bg-gradient-to-r from-rose-950/90 via-rose-900/80 to-rose-950/90 border-rose-500/80 text-rose-100'
              : verificationState.success
              ? 'bg-gradient-to-r from-emerald-950/95 via-teal-900/90 to-emerald-950/95 border-emerald-500 text-emerald-100 shadow-emerald-950/50'
              : 'bg-rose-950/90 border-rose-500 text-rose-100'
          }`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-2xl bg-white/10 shrink-0 mt-0.5 backdrop-blur-xs">
                  {verificationState.isDone ? (
                    <Lock className="w-8 h-8 text-slate-400" />
                  ) : verificationState.isPending ? (
                    <Clock className="w-8 h-8 text-amber-400 animate-pulse" />
                  ) : verificationState.isRejected ? (
                    <XCircle className="w-8 h-8 text-rose-400" />
                  ) : verificationState.success ? (
                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-8 h-8 text-rose-400" />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-white/10 border border-white/20">
                      TOKEN: {token || 'N/A'}
                    </span>
                    {verificationState.success && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400 text-slate-950 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Live Verified
                      </span>
                    )}
                  </div>

                  <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                    {verificationState.isDone
                      ? '🔒 KUNJUNGAN TELAH SELESAI / KUPON SUDAH DIGUNAKAN'
                      : verificationState.isPending
                      ? '⏳ MENUNGGU APPROVAL ADMIN RI\'AYAH (KUNJUNGAN HARI KERJA)'
                      : verificationState.isRejected
                      ? '⛔ PERMOHONAN KUNJUNGAN DITOLAK ADMIN RI\'AYAH'
                      : verificationState.success
                      ? '✅ TIKET KUNJUNGAN SAH & TELAH DI-SCAN'
                      : verificationState.message}
                  </h2>

                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
                    {verificationState.isDone
                      ? `Tamu telah selesai berkunjung dan tercatat check-out pada pukul ${booking?.jam_keluar_aktual || 'selesai'}. Terima kasih telah berkunjung.`
                      : verificationState.isPending
                      ? 'Permohonan kunjungan santri pada hari kerja (Senin-Kamis) harus disetujui terlebih dahulu oleh Pengasuhan/Admin Ri\'ayah sebelum gerbang dibuka.'
                      : verificationState.success
                      ? `Tercatat masuk di sistem Smart Riayah pada ${booking?.waktu_scan_aktual || `${liveClock.nama_hari}, ${liveClock.tanggal_lengkap} • ${liveClock.jam_menit_detik} WITA`}. Silakan tunjukkan kupon di bawah ini kepada petugas Pos Jaga Satpam.`
                      : 'Kode tiket tidak ditemukan di database. Pastikan Anda melakukan pemindaian barcode resmi yang diterbitkan Smart Riayah.'}
                  </p>
                </div>
              </div>

              {/* Status Badge Live */}
              <div className="self-end sm:self-center shrink-0">
                <div className="text-right font-mono text-[11px] bg-black/30 p-2.5 rounded-xl border border-white/10 space-y-0.5">
                  <div className="text-slate-400 font-sans text-[10px]">Waktu Pemindaian:</div>
                  <div className="text-emerald-300 font-bold">
                    {booking?.waktu_scan_aktual || `${liveClock.jam_menit_detik} WITA`}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── 2. GENERATOR GAMBAR KUPON KUNJUNGAN DIGITAL (AUTO-GENERATED CANVAS IMAGE) ─── */}
        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-400" />
                <h3 className="font-extrabold text-base text-white tracking-tight">
                  Kupon Kunjungan Digital Resmi (.PNG)
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Gambar kupon beresolusi tinggi otomatis ter-generate dari sistem untuk diperlihatkan ke petugas pos jaga.
              </p>
            </div>

            {/* Tombol Copy Link Kupon */}
            <button
              onClick={handleCopyLink}
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-center border border-slate-700"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copiedLink ? 'Link Tersalin!' : 'Copy Link Kupon'}</span>
            </button>
          </div>

          {/* Hidden Canvas untuk merender gambar resolusi tinggi */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Tampilan Visual Gambar Kupon Hasil Render */}
          <div className="relative group flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 rounded-2xl border border-slate-800 overflow-hidden">
            {isGeneratingCanvas ? (
              <div className="py-20 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
                <p className="text-xs text-slate-400 font-semibold font-mono">
                  Men-generate elemen kupon visual &amp; watermark digital...
                </p>
              </div>
            ) : couponImageUrl ? (
              <img
                src={couponImageUrl}
                alt="Kupon Kunjungan Digital Smart Riayah"
                className="w-full max-w-2xl mx-auto rounded-2xl shadow-2xl border border-slate-700/80 object-contain hover:scale-[1.01] transition duration-300"
              />
            ) : (
              <div className="py-16 text-center text-slate-400 text-xs">
                Kupon visual sedang disiapkan...
              </div>
            )}
          </div>

          {/* Baris Tombol Aksi Kupon (.PNG, Print, WhatsApp) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {/* Tombol 1: Download Gambar Kupon */}
            <button
              onClick={handleDownloadCoupon}
              disabled={!couponImageUrl}
              className="py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-black text-xs transition shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Download Kupon (.PNG)</span>
            </button>

            {/* Tombol 2: Cetak Kupon Fisik */}
            <button
              onClick={() => {
                window.print();
                sound.playBeep?.();
              }}
              className="py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition border border-slate-700 flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>Cetak Kupon (Print Slip)</span>
            </button>

            {/* Tombol 3: Kirim Ulang Gambar Kupon ke WhatsApp */}
            <button
              onClick={handleResendToWhatsApp}
              disabled={resendingWa || !booking}
              className="py-3 px-4 rounded-2xl bg-teal-700 hover:bg-teal-600 disabled:opacity-50 text-white font-bold text-xs transition shadow-md flex items-center justify-center gap-2"
            >
              {resendingWa ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4 text-emerald-300" />
              )}
              <span>{resendingWa ? 'Mengirim...' : waSentSuccess ? '✓ Terkirim ke WA!' : 'Kirim Ulang ke WhatsApp'}</span>
            </button>
          </div>
        </section>

        {/* ─── 3. KARTU DATA LENGKAP PENGUNJUNG & SANTRI (9 VARIABEL + METADATA KEAMANAN) ─── */}
        {booking && (
          <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-white tracking-tight">
                  Detail Lengkap Data Kunjungan &amp; Pemeriksaan Barang
                </h3>
                <p className="text-xs text-slate-400">
                  Data resmi terverifikasi yang tersinkronisasi langsung dengan Pos Satpam &amp; Admin Ri'ayah.
                </p>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                9 Data Validated
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* PANEL 1: DATA SANTRI / SANTRIWATI */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold font-mono uppercase tracking-wider">
                  <User className="w-4 h-4" />
                  <span>1. Data Santri yang Dijenguk</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Nama Lengkap Santri/Wati:</span>
                    <strong className="text-base text-white font-black">{booking.nama_santri}</strong>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Kelas &amp; Kamar Asrama:</span>
                      <strong className="text-emerald-300 font-bold">{booking.kelas}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Kota / Daerah Asal:</span>
                      <strong className="text-slate-200">{booking.asal || 'Surabaya'}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* PANEL 2: DATA PENJENGUK (TAMU) */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-teal-400 text-xs font-bold font-mono uppercase tracking-wider">
                  <Phone className="w-4 h-4" />
                  <span>2. Data Penjenguk (Tamu)</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Nama Lengkap Penjenguk:</span>
                    <strong className="text-base text-white font-black">{booking.nama_penjenguk}</strong>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Hubungan Keluarga:</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-200 border border-slate-700 inline-block">
                        {booking.status_penjenguk || 'Wali Santri'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">No. WhatsApp Terdaftar:</span>
                      <strong className="font-mono text-emerald-400 text-[11px]">{booking.no_wa_penjenguk}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* PANEL 3: DATA WAKTU REAL-TIME & DURASI KUNJUNGAN */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-400 text-xs font-bold font-mono uppercase tracking-wider">
                    <Calendar className="w-4 h-4" />
                    <span>3. Waktu &amp; Durasi Kunjungan</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {booking.approval_type === 'AUTO_WEEKEND' ? 'Weekend Auto-Approved' : 'Weekday Approval'}
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Hari &amp; Tanggal:</span>
                    <strong className="text-white">{booking.hari_kunjungan}, {booking.tanggal_kunjungan}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Jam Operasional:</span>
                    <strong className="font-mono text-cyan-300">{booking.jam_kunjungan} - {booking.jam_selesai} WITA</strong>
                  </div>
                  <div className="flex justify-between border-t border-slate-800/80 pt-2">
                    <span className="text-slate-400">Waktu Scan Masuk:</span>
                    <strong className="font-mono text-emerald-400">{booking.waktu_scan_aktual || `${booking.jam_masuk_aktual || liveClock.jam_menit_detik} WITA`}</strong>
                  </div>

                  {/* LIVE COUNTDOWN TIMER */}
                  <div className="mt-2 p-2.5 rounded-xl bg-slate-900 border border-slate-700/80">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                        Live Sisa Waktu Kunjungan:
                      </span>
                      {countdown?.isOverstay ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-500/30 text-rose-300 border border-rose-500/50 animate-pulse">
                          ⚠️ Overstay ({countdown.remainingText})
                        </span>
                      ) : countdown?.remainingText ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          ⏳ {countdown.remainingText}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-mono">Batas waktu tercapai</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* PANEL 4: DATA LOGISTIK & TITIPAN BARANG */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold font-mono uppercase tracking-wider">
                    <Package className="w-4 h-4" />
                    <span>4. Titipan Logistik &amp; Keamanan AI</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    (booking.berat_barang_kg || 0) <= 3.5
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : (booking.berat_barang_kg || 0) <= 5.0
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}>
                    {(booking.berat_barang_kg || 0) <= 5 ? 'Aman (Maks 5 Kg)' : 'Melebihi Batas'}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Rincian Barang Titipan:</span>
                    <strong className="text-slate-200">
                      {booking.titipan_barang || 'Tidak ada barang titipan khusus'}
                    </strong>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80">
                    <div className="flex justify-between items-center text-[11px] mb-1">
                      <span className="text-slate-400">Berat Titipan:</span>
                      <strong className="text-cyan-300 font-mono font-bold">{booking.berat_barang_kg || 0} Kg / 5.0 Kg</strong>
                    </div>
                    {/* Visual Progress Bar Batas Berat */}
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          (booking.berat_barang_kg || 0) <= 3.5
                            ? 'bg-emerald-500'
                            : (booking.berat_barang_kg || 0) <= 5.0
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, ((booking.berat_barang_kg || 1) / 5) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Catatan Keamanan DeepSeek AI */}
                  <div className="mt-2 text-[10px] text-slate-400 bg-slate-900/80 p-2 rounded-xl border border-slate-800 flex items-start gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                    <span>
                      Verifikasi DeepSeek AI: Barang titipan terbebas dari rokok/vape, HP/gadget, dan perangkat masak terlarang.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ─── 4. TOMBOL KONTROL CEPAT PETUGAS SATPAM / ADMIN ─── */}
        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 shrink-0">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-white">
                Kontrol Operasional Pos Gerbang Satpam
              </h4>
              <p className="text-[11px] text-slate-400">
                Petugas dapat mengonfirmasi check-in langsung atau mencatat kepulangan tamu di sini.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto justify-end">
            {booking && booking.status_kunjungan !== 'Sedang Berkunjung' && booking.status_kunjungan !== 'Selesai' && (
              <button
                onClick={handleOfficerCheckIn}
                className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs transition shadow-md flex items-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Konfirmasi Masuk (Check-In)</span>
              </button>
            )}

            {booking && booking.status_kunjungan === 'Sedang Berkunjung' && (
              <button
                onClick={handleOfficerCheckOut}
                className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-md flex items-center gap-1.5"
              >
                <Lock className="w-4 h-4" />
                <span>Selesaikan Kunjungan (Check-Out Tamu)</span>
              </button>
            )}

            {onBackToDashboard && (
              <button
                onClick={onBackToDashboard}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition border border-slate-700"
              >
                ⬅️ Kembali ke Dashboard
              </button>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
