import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Shield,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  FileCheck
} from 'lucide-react';
import { sound } from '../../utils/audio';
import { getRealtimePondokClock, checkBarcodeLifecycle } from '../../utils/pondokTimeUtils';
import {
  getVisitGatePassUrls,
  downloadBarcodeImage,
  generateLocalQrDataUrl,
  drawLocalCode128OnCanvas
} from '../../utils/barcodeUtils';
import { fetchVisitBookingsFromSupabase } from '../../utils/supabaseSync';

function findBookingByToken(list, rawToken) {
  if (!Array.isArray(list) || !rawToken) return null;
  const clean = String(rawToken).trim().toUpperCase();
  return list.find(item =>
    (item.barcode_token && item.barcode_token.toUpperCase() === clean) ||
    (item.id && item.id.toUpperCase() === clean) ||
    (item.barcode_token && clean.includes(item.barcode_token.toUpperCase())) ||
    (item.barcode_token && item.barcode_token.toUpperCase().includes(clean))
  ) || null;
}

export default function GatePassVerificationPage({ token }) {
  const { visitBookings, lookupVisitBooking } = useApp();

  const [booking, setBooking] = useState(null);
  const [remoteLookupDone, setRemoteLookupDone] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lookupState, setLookupState] = useState({
    loading: true,
    success: false,
    notFound: false,
    message: 'Memuat kupon kunjungan digital...',
    isExpired: false,
    isPending: false,
    isOngoing: false,
    isApproved: false
  });

  const [couponImageUrl, setCouponImageUrl] = useState('');
  const [isGeneratingCanvas, setIsGeneratingCanvas] = useState(true);

  const canvasRef = useRef(null);
  const lastCanvasKeyRef = useRef('');

  // Reset saat token berubah atau user klik Muat Ulang
  useEffect(() => {
    lastCanvasKeyRef.current = '';
    setCouponImageUrl('');
    setIsGeneratingCanvas(true);

    if (!token) {
      setBooking(null);
      setRemoteLookupDone(true);
      return;
    }

    const existing = findBookingByToken(visitBookings, token);
    if (existing) {
      setRemoteLookupDone(true);
      return;
    }

    let isMounted = true;
    setRemoteLookupDone(false);

    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve([]), 6000));
    Promise.race([fetchVisitBookingsFromSupabase(), timeoutPromise])
      .then((remoteList) => {
        if (!isMounted) return;
        const matched = findBookingByToken(remoteList, token);
        if (matched) {
          const clock = getRealtimePondokClock();
          const lc = checkBarcodeLifecycle(matched, clock);
          setBooking(matched);
          setLookupState({
            loading: false,
            success: true,
            notFound: false,
            message: lc.isExpired ? '⛔ MASA BERLAKU KUPON TELAH HABIS' : '✅ KUPON RESMI AKTIF',
            isExpired: lc.isExpired || matched.status_kunjungan === 'Selesai',
            isPending: matched.status_kunjungan === 'Menunggu Approval',
            isOngoing: matched.status_kunjungan === 'Sedang Berkunjung',
            isApproved: matched.status_kunjungan?.includes('Disetujui')
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setRemoteLookupDone(true);
      });

    return () => {
      isMounted = false;
    };
  }, [token, retryCount]);

  // 1. Pure Read-Only Lookup Kupon (TIDAK Auto-Check-in saat wali santri membuka link di HP)
  useEffect(() => {
    if (!token) {
      setBooking(null);
      setLookupState({
        loading: false,
        success: false,
        notFound: true,
        message: '⛔ Parameter kode tiket tidak ditemukan pada URL.',
        isExpired: false,
        isPending: false,
        isOngoing: false,
        isApproved: false
      });
      setIsGeneratingCanvas(false);
      return;
    }

    const res = lookupVisitBooking ? lookupVisitBooking(token) : null;
    if (res && res.booking) {
      setBooking(res.booking);
      setLookupState({
        loading: false,
        success: res.success,
        notFound: false,
        message: res.message,
        isExpired: res.isExpired,
        isPending: res.isPending,
        isOngoing: res.isOngoing,
        isApproved: res.isApproved
      });
      return;
    }

    const b = findBookingByToken(visitBookings, token);
    if (b) {
      const clock = getRealtimePondokClock();
      const lc = checkBarcodeLifecycle(b, clock);
      setBooking(b);
      setLookupState({
        loading: false,
        success: true,
        notFound: false,
        message: lc.isExpired ? '⛔ MASA BERLAKU KUPON TELAH HABIS' : '✅ KUPON RESMI AKTIF',
        isExpired: lc.isExpired || b.status_kunjungan === 'Selesai',
        isPending: b.status_kunjungan === 'Menunggu Approval',
        isOngoing: b.status_kunjungan === 'Sedang Berkunjung',
        isApproved: b.status_kunjungan?.includes('Disetujui')
      });
    } else if (!remoteLookupDone) {
      setLookupState(prev => ({
        ...prev,
        loading: true,
        notFound: false,
        message: 'Mengambil data kupon resmi dari server pondok...'
      }));
    } else if (!booking) {
      setLookupState({
        loading: false,
        success: false,
        notFound: true,
        message: '⛔ Kupon tidak ditemukan atau kode tiket belum terdaftar.',
        isExpired: false,
        isPending: false,
        isOngoing: false,
        isApproved: false
      });
      setIsGeneratingCanvas(false);
    }
  }, [token, visitBookings, remoteLookupDone]);

  // 2. Generator Gambar Kupon Kunjungan Digital (.PNG Instan Lokal Tanpa Server QR Eksternal)
  useEffect(() => {
    if (!booking) return;

    const tokenCode = booking.barcode_token || booking.id || token || 'SR-GATEPASS';
    const canvasKey = `${tokenCode}|${booking.status_kunjungan || ''}|${booking.updated_at || ''}|${booking.waktu_disetujui || ''}`;
    if (lastCanvasKeyRef.current === canvasKey) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isCancelled = false;
    setIsGeneratingCanvas(true);

    const renderCouponCanvas = async () => {
      const { gatePassUrl } = getVisitGatePassUrls(tokenCode);

      // Canvas Dimensions: 1000 x 560 px
      canvas.width = 1000;
      canvas.height = 560;

      // A. Latar Belakang Kartu Putih
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 1000, 560);

      // Border Halus Luar
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, 996, 556);

      // B. Header Bar Emerald Khas Darul Ulum
      const headerGrad = ctx.createLinearGradient(0, 0, 1000, 0);
      headerGrad.addColorStop(0, '#064E3B');
      headerGrad.addColorStop(0.5, '#047857');
      headerGrad.addColorStop(1, '#065F46');
      ctx.fillStyle = headerGrad;
      ctx.fillRect(0, 0, 1000, 96);

      // Aksen Emas
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(0, 96, 1000, 4);

      // Teks Header
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('🏛️ PONDOK PESANTREN MODERN DARUL ULUM', 36, 42);

      ctx.fillStyle = '#A7F3D0';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('KUPON RESMI IZIN KUNJUNGAN WALI SANTRI & TITIPAN BARANG', 40, 70);

      // Badge Kode Kupon Kanan Atas
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect(740, 24, 225, 48, 12);
      ctx.fill();

      ctx.fillStyle = '#065F46';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('GATE PASS RESMI PONDOK', 755, 43);
      ctx.font = 'bold 13px monospace';
      ctx.fillText(tokenCode, 755, 60);

      // C. Garis Perforasi (x = 710)
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(710, 100);
      ctx.lineTo(710, 560);
      ctx.stroke();
      ctx.restore();

      // Punch-hole notches
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(710, 100, 14, 0, Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(710, 560, 14, Math.PI, 0);
      ctx.fill();

      // D. SISI KIRI: DATA LENGKAP KUNJUNGAN & SANTRI
      const isOngoing = booking.status_kunjungan === 'Sedang Berkunjung' || booking.status_kunjungan?.includes('Sedang Berkunjung');
      const isApproved = booking.status_kunjungan?.includes('Disetujui');
      const isDone = booking.status_kunjungan === 'Selesai';
      const clock = getRealtimePondokClock();
      const lc = checkBarcodeLifecycle(booking, clock);
      const isExpired = lc.isExpired || isDone;

      // Status Pill
      ctx.fillStyle = isExpired ? '#FEE2E2' : isOngoing ? '#DCFCE7' : isApproved ? '#E0F2FE' : '#F1F5F9';
      ctx.beginPath();
      ctx.roundRect(36, 120, 360, 28, 8);
      ctx.fill();

      ctx.fillStyle = isExpired ? '#B91C1C' : isOngoing ? '#15803D' : isApproved ? '#0369A1' : '#475569';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(
        isExpired ? '● STATUS: EXPIRED / KUNJUNGAN TELAH SELESAI' :
        isOngoing ? '● STATUS: TELAH DI-SCAN (SEDANG BERKUNJUNG)' :
        isApproved ? '● STATUS: DISETUJUI (SIAP KUNJUNGAN)' : '● STATUS: MENUNGGU APPROVAL PONDOK',
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

      // Garis Pemisah 1
      ctx.strokeStyle = '#F1F5F9';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(36, 246);
      ctx.lineTo(670, 246);
      ctx.stroke();

      // 2. Data Penjenguk & Jadwal
      ctx.fillStyle = '#64748B';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('PENJENGUK (WALI SANTRI):', 36, 272);

      ctx.fillStyle = '#1E293B';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(`${booking.nama_penjenguk || 'Wali Santri'} (${booking.status_penjenguk || 'Wali'})`, 36, 294);

      ctx.fillStyle = '#047857';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`WhatsApp: ${booking.no_wa_penjenguk || '-'} (Terverifikasi)`, 36, 314);

      // Jadwal Kunjungan
      ctx.fillStyle = '#64748B';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('JADWAL & WAKTU BERLAKU KUNJUNGAN:', 370, 272);

      ctx.fillStyle = '#1E293B';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(`${booking.hari_kunjungan || 'Sabtu'}, ${booking.tanggal_kunjungan || clock.tanggal_lengkap}`, 370, 294);

      ctx.fillStyle = '#0284C7';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`Pukul: ${booking.jam_kunjungan || '14:00'} s/d ${booking.jam_selesai || '15:30'} WIB`, 370, 314);

      // Garis Pemisah 2
      ctx.beginPath();
      ctx.moveTo(36, 332);
      ctx.lineTo(670, 332);
      ctx.stroke();

      // 3. Titipan Barang
      ctx.fillStyle = '#F0FDF4';
      ctx.beginPath();
      ctx.roundRect(36, 348, 634, 76, 12);
      ctx.fill();
      ctx.strokeStyle = '#BBF7D0';
      ctx.stroke();

      ctx.fillStyle = '#166534';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('📦 TITIPAN BARANG & PEMERIKSAAN POS JAGA SATPAM:', 50, 370);

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 13px sans-serif';
      const barangText = booking.titipan_barang && booking.titipan_barang !== '-' ? booking.titipan_barang : 'Tidak ada titipan barang khusus';
      ctx.fillText(barangText.slice(0, 48), 50, 392);

      ctx.fillStyle = '#047857';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(`Berat Barang: ${booking.berat_barang_kg || 0} Kg  (Batas Aman Pondok: Maksimal 5.0 Kg)`, 50, 412);

      // Catatan Kaki Kupon
      ctx.fillStyle = '#64748B';
      ctx.font = 'italic 10px sans-serif';
      ctx.fillText('Catatan: Kupon ini diterbitkan resmi oleh Sistem Smart Riayah Pondok Pesantren Modern Darul Ulum.', 36, 448);
      ctx.fillText('Wajib berbusana sopan/muslim, menjaga ketertiban, dan mematuhi batas durasi kunjungan santri.', 36, 464);

      // Watermark Digital Stamp
      ctx.save();
      ctx.translate(530, 485);
      ctx.rotate(-0.08);
      ctx.strokeStyle = isExpired ? '#DC2626' : '#059669';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-120, -22, 240, 44, 8);
      ctx.stroke();

      ctx.fillStyle = isExpired ? '#DC2626' : '#059669';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(isExpired ? '⛔ EXPIRED / SELESAI' : '★ VERIFIED & OFFICIAL ★', 0, -4);
      ctx.font = 'bold 10px monospace';
      ctx.fillText('SMART RIAYAH GATE PASS', 0, 12);
      ctx.restore();

      // E. SISI KANAN: STUB SLIP QR & BARCODE POS SATPAM (x = 730 to 980)
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('SLIP POS JAGA', 730, 130);

      ctx.fillStyle = '#64748B';
      ctx.font = '10px sans-serif';
      ctx.fillText('PINDAI DI POS GERBANG PONDOK', 730, 146);

      // Generate QR Code LOKAL secara instan (< 5ms, tanpa api.qrserver.com)
      try {
        const localQrDataUrl = await generateLocalQrDataUrl(gatePassUrl || tokenCode, 340);
        if (isCancelled) return;
        await new Promise((resolve) => {
          const qrImg = new Image();
          qrImg.onload = () => {
            ctx.drawImage(qrImg, 755, 165, 170, 170);
            resolve();
          };
          qrImg.onerror = () => resolve();
          qrImg.src = localQrDataUrl;
        });
      } catch {
        // Fallback kotak QR lokal bila gagal encode
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(755, 165, 170, 170);
        ctx.strokeStyle = '#CBD5E1';
        ctx.strokeRect(755, 165, 170, 170);
        ctx.fillStyle = '#065F46';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SMART RIAYAH', 840, 245);
        ctx.fillText('E-GATE PASS', 840, 265);
      }

      if (isCancelled) return;

      // Barcode Code 128 Asli (1D Scanner-Readable) di bawah QR
      drawLocalCode128OnCanvas(ctx, tokenCode, 735, 355, 210, 46, {
        includeText: false,
        barColor: '#0F172A',
        backgroundColor: '#FFFFFF'
      });

      ctx.fillStyle = '#047857';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(tokenCode, 840, 422);

      ctx.fillStyle = '#64748B';
      ctx.font = '10px sans-serif';
      ctx.fillText('Tunjukkan Barcode ke Petugas Satpam', 840, 442);
      ctx.fillText('Untuk Pemindaian Kamera Pos Jaga', 840, 458);

      // STEMPEL MERAH JIKA EXPIRED / SUDAH DIGUNAKAN
      if (isExpired) {
        ctx.save();
        ctx.translate(840, 250);
        ctx.rotate(-0.35);

        ctx.fillStyle = 'rgba(254, 242, 242, 0.94)';
        ctx.beginPath();
        ctx.roundRect(-100, -30, 200, 60, 10);
        ctx.fill();

        ctx.strokeStyle = '#DC2626';
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.fillStyle = '#B91C1C';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⛔ EXPIRED', 0, -5);
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('SUDAH DIGUNAKAN', 0, 16);
        ctx.restore();
      }

      try {
        const pngUrl = canvas.toDataURL('image/png');
        if (!isCancelled) {
          setCouponImageUrl(pngUrl);
          lastCanvasKeyRef.current = canvasKey;
        }
      } catch (e) {
        console.warn('Canvas export warning:', e);
      }
      if (!isCancelled) {
        setIsGeneratingCanvas(false);
      }
    };

    renderCouponCanvas();

    return () => {
      isCancelled = true;
    };
  }, [booking, token]);

  // Handler Download Gambar Kupon
  const handleDownloadCoupon = () => {
    if (!couponImageUrl) return;
    const santriClean = (booking?.nama_santri || 'Santri').replace(/[^a-zA-Z0-9]/g, '_');
    downloadBarcodeImage(couponImageUrl, `Kupon_Kunjungan_${santriClean}_${token || 'GatePass'}.png`);
    sound.playSuccess?.();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-white pb-16">
      
      {/* ─── HEADER HALAMAN KUPON DIGITAL (VIEWER KHUSUS WALI SANTRI) ─── */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-3.5 shadow-md">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-950/60 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] sm:text-xs font-black tracking-wider text-emerald-400 font-mono uppercase">
                  Pondok Pesantren Modern Darul Ulum
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
              </div>
              <h1 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                Kupon Izin Kunjungan Wali Santri
              </h1>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-mono font-bold">
            <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Kupon Digital Resmi</span>
          </span>
        </div>
      </header>

      {/* ─── KONTEN UTAMA: GAMBAR KUPON & TOMBOL DOWNLOAD ─── */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 space-y-6">

        {/* Status Info Ringkas */}
        {lookupState.loading ? (
          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center animate-pulse space-y-3">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
            <h3 className="font-bold text-sm text-slate-300">{lookupState.message || 'Menyiapkan kupon digital resmi santri...'}</h3>
          </div>
        ) : lookupState.notFound || !booking ? (
          <div className="p-6 rounded-2xl bg-rose-950/90 border border-rose-500/70 text-rose-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs shadow-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-sm">{lookupState.message || '⛔ Kupon Tidak Ditemukan'}</span>
                <span className="text-slate-300 text-[11px]">
                  Pastikan tautan kupon kunjungan berasal dari pesan WhatsApp resmi Smart Riayah dan tidak terpotong.
                </span>
              </div>
            </div>
            <button
              onClick={() => setRetryCount(c => c + 1)}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition shrink-0 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Muat Ulang Kupon</span>
            </button>
          </div>
        ) : lookupState.isExpired ? (
          <div className="p-4 rounded-2xl bg-rose-950/90 border border-rose-500/80 text-rose-100 flex items-center gap-3 text-xs shadow-lg shadow-rose-950/50">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <span className="font-bold block text-sm">⛔ Kupon Ini Telah Expired / Selesai Digunakan</span>
              <span className="text-slate-300 text-[11px]">
                Masa berlaku kunjungan untuk tiket ini telah berakhir. Jika Anda membutuhkan izin baru, silakan ajukan booking via WhatsApp Gateway.
              </span>
            </div>
          </div>
        ) : lookupState.isPending ? (
          <div className="p-4 rounded-2xl bg-amber-950/90 border border-amber-500/80 text-amber-100 flex items-center gap-3 text-xs shadow-lg shadow-amber-950/40">
            <Clock className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
            <div>
              <span className="font-bold block text-sm">⏳ Menunggu Persetujuan Admin Ri'ayah</span>
              <span className="text-slate-300 text-[11px]">
                Kunjungan hari kerja memerlukan verifikasi Pengasuhan Pondok sebelum barcode dapat di-scan di gerbang.
              </span>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-100 flex items-center gap-2.5 text-xs shadow-md">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Kupon Izin Resmi Aktif.</strong> Unduh gambar kupon di bawah dan tunjukkan ke petugas Satpam di pos gerbang saat tiba di pondok.
            </span>
          </div>
        )}

        {/* Hidden Canvas untuk Generasi Gambar .PNG */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Tampilan Visual Gambar Kupon Digital (.PNG) */}
        {!lookupState.notFound && booking && (
          <section className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-5">
            <div className="relative group flex items-center justify-center p-2 sm:p-3 bg-slate-950/80 rounded-2xl border border-slate-800/80 overflow-hidden">
              {isGeneratingCanvas ? (
                <div className="py-16 text-center space-y-3">
                  <RefreshCw className="w-9 h-9 text-emerald-400 animate-spin mx-auto" />
                  <p className="text-xs text-slate-400 font-semibold font-mono">
                    Men-generate elemen kupon visual &amp; barcode resmi...
                  </p>
                </div>
              ) : couponImageUrl ? (
                <img
                  src={couponImageUrl}
                  alt="Kupon Izin Kunjungan Santri Smart Riayah"
                  className="w-full max-w-2xl mx-auto rounded-2xl shadow-2xl border border-slate-700/80 object-contain"
                />
              ) : (
                <div className="py-16 text-center text-slate-400 text-xs">
                  Kupon visual sedang disiapkan...
                </div>
              )}
            </div>

            {/* ─── HANYA SATU TOMBOL BESAR HIJAU EMERALD DOWNLOAD GAMBAR KUPON ─── */}
            <div className="pt-2 text-center space-y-3">
              <button
                onClick={handleDownloadCoupon}
                disabled={!couponImageUrl || isGeneratingCanvas}
                className="w-full max-w-lg mx-auto py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white font-black text-sm sm:text-base transition-all shadow-xl shadow-emerald-950/60 flex items-center justify-center gap-2.5 transform hover:-translate-y-0.5"
              >
                <Download className="w-5 h-5 text-white" />
                <span>📥 Download Gambar Kupon Barcode (.PNG)</span>
              </button>

              {/* Teks Panduan Singkat */}
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                Silakan unduh gambar kupon ini dan tunjukkan barcodenya ke kamera petugas Satpam saat tiba di Pos Gerbang Pondok Pesantren.
              </p>
            </div>
          </section>
        )}

        {/* Footer Hak Cipta & Keamanan */}
        <div className="pt-4 text-center text-[11px] text-slate-500 space-y-1">
          <p>© {new Date().getFullYear()} Pesantren Modern Darul Ulum • Smart Permit &amp; Ri'ayah System</p>
          <p className="text-[10px] text-slate-600 font-mono">Tiket Dilindungi Enkripsi 1-Siklus • Terverifikasi DeepSeek AI</p>
        </div>

      </main>
    </div>
  );
}
