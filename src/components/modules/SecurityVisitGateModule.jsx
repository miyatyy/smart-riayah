import React, { useState, useEffect, useRef } from 'react';
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
  FileText,
  ExternalLink,
  Copy,
  Camera,
  CameraOff,
  Upload,
  CheckCircle2,
  Scan,
  Maximize2
} from 'lucide-react';
import { sound } from '../../utils/audio';
import { getRealtimePondokClock, calculateVisitCountdown, checkBarcodeLifecycle } from '../../utils/pondokTimeUtils';
import { getVisitGatePassUrls } from '../../utils/barcodeUtils';
import { Html5Qrcode } from 'html5-qrcode';

// Ekstraksi Pintar Kode Barcode (Mendukung Raw SR-..., URL ?gatepass=SR-..., dan /gate-pass/SR-...)
export function extractBarcodeToken(raw) {
  if (!raw) return '';
  const text = String(raw).trim();
  if (text.includes('gatepass=')) {
    const match = text.match(/gatepass=([^&]+)/i);
    if (match) return decodeURIComponent(match[1]).trim().toUpperCase();
  }
  if (text.includes('/gate-pass/')) {
    const parts = text.split('/gate-pass/');
    if (parts[1]) {
      const cleanPart = parts[1].split('?')[0].split('#')[0];
      return decodeURIComponent(cleanPart).trim().toUpperCase();
    }
  }
  return text.toUpperCase();
}

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

  // Verification & Camera States
  const [barcodeInput, setBarcodeInput] = useState('');
  const [activeTabSub, setActiveTabSub] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'PENDING' | 'DONE'
  const [searchTable, setSearchTable] = useState('');

  // Live Camera Scanner States
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const html5QrCodeRef = useRef(null);
  const fileInputRef = useRef(null);

  // Modal Pop-Up Hasil Scan Kamera Satpam
  const [scanModalResult, setScanModalResult] = useState(null); // { isOpen, success, isExpired, title, message, booking }

  // Live Clock Ticking Engine (1000ms)
  const [liveClock, setLiveClock] = useState(() => getRealtimePondokClock());
  const [toastCheckIn, setToastCheckIn] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveClock(getRealtimePondokClock());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 1. Inisialisasi Deteksi Kamera WebRTC
  useEffect(() => {
    Html5Qrcode.getCameras().then(devices => {
      if (devices && devices.length > 0) {
        setCameras(devices);
        // Prioritaskan kamera belakang jika ada, jika tidak gunakan kamera pertama
        const backCam = devices.find(d => 
          d.label?.toLowerCase().includes('back') || 
          d.label?.toLowerCase().includes('belakang') ||
          d.label?.toLowerCase().includes('environment')
        );
        setSelectedCameraId(backCam ? backCam.id : devices[0].id);
      }
    }).catch(err => {
      console.warn('WebRTC Camera discovery note:', err);
    });

    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // 2. Real-Time BroadcastChannel listener for check-ins from other tabs
  useEffect(() => {
    let bc;
    try {
      bc = new BroadcastChannel('smart_riayah_visit_channel');
      bc.onmessage = (event) => {
        if (event.data?.type === 'VISIT_CHECKIN' && event.data?.booking) {
          const b = event.data.booking;
          setToastCheckIn(b);
          sound.playSuccess?.();
          setTimeout(() => setToastCheckIn(null), 8000);
        }
      };
    } catch (e) {}

    return () => {
      if (bc) bc.close();
    };
  }, []);

  // 3. FUNGSI PEMROSESAN UTAMA HASIL SCAN BARCODE (KAMERA / UPLOAD / USB SCANNER)
  const handleProcessScannedBarcode = (rawCode, source = 'CAMERA') => {
    if (!rawCode) return;
    const token = extractBarcodeToken(rawCode).trim().toUpperCase();
    const bookings = Array.isArray(visitBookings) ? visitBookings : [];

    // Helper: ekstrak potensi nama santri dari kode tiket (misal: GP-DU-NURMIYATY-1027 -> NURMIYATY)
    let extractedNameFromToken = '';
    const gpMatch = token.match(/^GP[-_]DU[-_]([A-Z0-9]+?)(?:[-_]\d+)?$/i);
    if (gpMatch && gpMatch[1]) {
      extractedNameFromToken = gpMatch[1].toUpperCase();
    }

    // 1. Cari booking yang cocok di daftar visitBookings
    let booking = bookings.find(b => {
      const bToken = String(b.barcode_token || '').toUpperCase();
      const bId = String(b.id || '').toUpperCase();
      const bSantri = String(b.nama_santri || '').toUpperCase();
      const bNis = String(b.nis || '').toUpperCase();
      const bPhone = String(b.no_wa_penjenguk || '').replace(/\D/g, '');
      const cleanTokenPhone = token.replace(/\D/g, '');

      // A. Match persis barcode token atau ID
      if (bToken && bToken === token) return true;
      if (bId && bId === token) return true;

      // B. Substring barcode token
      if (bToken && (token.includes(bToken) || bToken.includes(token))) return true;

      // C. Match jika token mengandung nama santri (contoh: GP-DU-NURMIYATY-1027 vs Nurmiyaty)
      if (extractedNameFromToken && bSantri && (bSantri.includes(extractedNameFromToken) || extractedNameFromToken.includes(bSantri.replace(/[^A-Z]/g, '').slice(0, 6)))) {
        return true;
      }

      // D. Match jika Satpam mengetik nama santri langsung
      if (token.length >= 3 && bSantri && bSantri.includes(token)) return true;

      // E. Match NIS
      if (bNis && bNis === token) return true;

      // F. Match No WA Wali
      if (cleanTokenPhone.length >= 8 && bPhone && (bPhone.includes(cleanTokenPhone) || cleanTokenPhone.includes(bPhone))) return true;

      return false;
    });

    // 2. Jika tidak ada di visitBookings, cari di database santri (santriList) untuk auto-check-in walk-in
    if (!booking) {
      const sList = Array.isArray(santriList) ? santriList : [];
      const searchTarget = extractedNameFromToken || token;

      const matchedSantri = sList.find(s => {
        const sName = String(s.nama || '').toUpperCase();
        const sNis = String(s.nis || '').toUpperCase();
        const sRfid = String(s.rfidUid || '').toUpperCase();
        const sPhone = String(s.noWali || '').replace(/\D/g, '');
        const cleanPhone = token.replace(/\D/g, '');

        if (sName && searchTarget.length >= 3 && (sName.includes(searchTarget) || searchTarget.includes(sName.replace(/[^A-Z]/g, '').slice(0, 6)))) {
          return true;
        }
        if (sNis && sNis === token) return true;
        if (sRfid && sRfid === token) return true;
        if (cleanPhone.length >= 8 && sPhone && (sPhone.includes(cleanPhone) || cleanPhone.includes(sPhone))) return true;
        return false;
      });

      if (matchedSantri) {
        const clock = getRealtimePondokClock();
        const [h, m] = clock.jam_menit.split(':').map(Number);
        const endH = String((h + 1) % 24).padStart(2, '0');
        const endM = String(m).padStart(2, '0');

        const newWalkinBooking = {
          id: `VST-${clock.tanggal_ymd.replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
          booking_source: 'MANUAL_SATPAM',
          nama_santri: matchedSantri.nama,
          santri_id: matchedSantri.id,
          nis: matchedSantri.nis,
          kelas: matchedSantri.kelas,
          kamar: matchedSantri.kamar || matchedSantri.asrama || 'Asrama Pondok',
          asal: matchedSantri.asal || 'Surabaya',
          tanggal_kunjungan: clock.tanggal_ymd,
          hari_kunjungan: clock.nama_hari,
          jam_kunjungan: clock.jam_menit,
          jam_selesai: `${endH}:${endM}`,
          titipan_barang: 'Titipan Wali Santri (Pos Gerbang)',
          berat_barang_kg: 1.0,
          nama_penjenguk: matchedSantri.namaWali || 'Wali Santri',
          status_penjenguk: 'Wali Santri',
          no_wa_penjenguk: matchedSantri.noWali || '',
          rfid_uid: matchedSantri.rfidUid || null,
          barcode_token: token,
          status_kunjungan: 'Sedang Berkunjung',
          jam_masuk_aktual: clock.jam_menit_detik,
          jam_checkin_aktual: clock.jam_menit,
          metode_verifikasi: source || 'INPUT_MANUAL_SATPAM',
          created_at: new Date().toISOString()
        };

        const updated = checkInVisitBooking(newWalkinBooking, source);
        sound.playSuccess?.();
        setScanModalResult({
          isOpen: true,
          success: true,
          title: '✅ CHECK-IN POS SATPAM BERHASIL (WALK-IN RESMI)',
          message: `Kupon [${token}] berhasil diverifikasi untuk santri ${matchedSantri.nama} (${matchedSantri.kelas}). Wali santri resmi check-in dan tercatat di area pondok.`,
          booking: updated || newWalkinBooking
        });
        return;
      }

      sound.playAccessDenied?.();
      setScanModalResult({
        isOpen: true,
        success: false,
        title: '⛔ TIKET TIDAK DITEMUKAN',
        message: `Kode tiket [${token}] tidak terdaftar di database pondok. Pastikan wali santri menunjukkan kupon resmi yang sah.`,
        booking: null
      });
      return;
    }

    // Jika booking ditemukan: sinkronkan barcode_token jika sebelumnya beda
    if (!booking.barcode_token || (token.startsWith('GP-DU-') && booking.barcode_token !== token)) {
      booking.barcode_token = token;
    }

    const clock = getRealtimePondokClock();
    const lc = checkBarcodeLifecycle(booking, clock);

    // Jika sudah sedang berkunjung: beri info bahwa sudah di dalam
    if (booking.status_kunjungan === 'Sedang Berkunjung' || booking.status_kunjungan?.includes('Sedang Berkunjung')) {
      sound.playSuccess?.();
      setScanModalResult({
        isOpen: true,
        success: true,
        title: 'ℹ️ TAMU SUDAH BERADA DI DALAM PONDOK',
        message: `Wali ${booking.nama_penjenguk} (Wali ${booking.nama_santri}) sudah check-in pada pukul ${booking.jam_masuk_aktual || booking.jam_checkin_aktual || 'sebelumnya'} WITA.`,
        booking
      });
      return;
    }

    // Jika tiket sudah checkout / expired tanggal lewat:
    if (lc.status === 'EXPIRED_COMPLETED' || lc.status === 'EXPIRED_DATE_PAST') {
      sound.playAccessDenied?.();
      setScanModalResult({
        isOpen: true,
        success: false,
        isExpired: true,
        title: lc.badgeLabel,
        message: lc.message,
        booking
      });
      return;
    }

    // Jika tidak valid untuk scan otomatis (misal jadwal hari kerja/beda tanggal),
    // BERIKAN OPSI DISPENSASI KHUSUS SATPAM daripada memblokir total!
    if (!lc.isValidForScan) {
      sound.playAccessDenied?.();
      setScanModalResult({
        isOpen: true,
        success: false,
        canDispensasi: true,
        title: lc.badgeLabel,
        message: `${lc.message}\n\nWali santri telah tiba di pos gerbang. Apakah Satpam ingin memberikan izin masuk khusus (dispensasi kedatangan) hari ini?`,
        booking
      });
      return;
    }

    // Tiket Sah: Lakukan Check-In Otomatis!
    const updated = checkInVisitBooking(booking.id || booking, source);
    sound.playSuccess?.();
    setScanModalResult({
      isOpen: true,
      success: true,
      title: '✅ SCAN BERHASIL — PENJENGUK TERDAFTAR & RESMI CHECK-IN',
      message: 'Barcode gate pass sah! Wali santri telah tercatat secara resmi di pos jaga satpam & tersinkron ke dashboard Admin Ri\'ayah.',
      booking: updated || booking
    });
  };

  // 4. Nyalakan Kamera Live
  const startCamera = async (camId) => {
    setCameraError('');
    setIsCameraStarting(true);
    const targetCam = camId || selectedCameraId;

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('satpam-camera-viewfinder');
      }

      if (html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }

      const cameraConfig = targetCam ? targetCam : { facingMode: 'environment' };

      await html5QrCodeRef.current.start(
        cameraConfig,
        {
          fps: 12,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1.0
        },
        (decodedText) => {
          handleProcessScannedBarcode(decodedText, 'LIVE_CAMERA');
        },
        () => {
          // ignore scan frame misses
        }
      );
      setIsCameraActive(true);
      sound.playBeep?.();
    } catch (err) {
      console.error('Kamera gagal dinyalakan:', err);
      setCameraError(err?.message || 'Tidak dapat mengakses kamera. Pastikan izin kamera telah disetujui di browser.');
      setIsCameraActive(false);
    } finally {
      setIsCameraStarting(false);
    }
  };

  // 5. Matikan Kamera Live
  const stopCamera = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (e) {}
    }
    setIsCameraActive(false);
  };

  // 6. Scan dari File Upload Gambar (.PNG)
  const handleUploadImageScan = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      let qrScanner = html5QrCodeRef.current;
      if (!qrScanner) {
        qrScanner = new Html5Qrcode('satpam-camera-viewfinder');
        html5QrCodeRef.current = qrScanner;
      }
      const decodedText = await qrScanner.scanFile(file, true);
      handleProcessScannedBarcode(decodedText, 'FILE_UPLOAD');
    } catch (err) {
      console.warn('Scan gambar file error:', err);
      sound.playAccessDenied?.();
      alert('⚠️ Barcode atau QR Code tidak terdeteksi pada gambar kupon yang diunggah. Pastikan gambar kupon jelas.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 7. Input Cepat / USB Barcode Scanner Submit
  const handleManualBarcodeInput = (e) => {
    e.preventDefault();
    if (!barcodeInput.trim()) {
      alert('Silakan ketik atau scan kode barcode!');
      return;
    }
    handleProcessScannedBarcode(barcodeInput, 'USB_BARCODE_SCANNER');
    setBarcodeInput('');
  };

  // Form Input Walk-in Manual Satpam state
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
    setIsManualFormOpen(!isManualFormOpen);
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
  };

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

  const handleSatpamSubmit = (e) => {
    e.preventDefault();
    if (!satpamForm.nama_santri || !satpamForm.nama_penjenguk) {
      alert('Nama Santri dan Nama Penjenguk wajib diisi!');
      return;
    }
    const finalStatus = satpamForm.status_penjenguk === 'Lainnya' && satpamForm.status_penjenguk_lainnya?.trim()
      ? `Lainnya (${satpamForm.status_penjenguk_lainnya.trim()})`
      : satpamForm.status_penjenguk;

    const created = addVisitBooking({
      ...satpamForm,
      status_penjenguk: finalStatus,
      booking_source: 'MANUAL_SATPAM',
      tanggal_kunjungan: new Date().toISOString().slice(0, 10),
      status_kunjungan: 'Sedang Berkunjung'
    });

    handleProcessScannedBarcode(created.barcode_token || created.id, 'MANUAL_SATPAM');
    setIsManualFormOpen(false);
  };

  const bookings = Array.isArray(visitBookings) ? visitBookings : [];

  // DAFTAR PENGUNJUNG YANG SEDANG BERKUNJUNG (AKTIF DI AREA / SUDAH DI-SCAN)
  const activeVisitingGuests = bookings
    .filter(b => b.status_kunjungan === 'Sedang Berkunjung' || b.status_kunjungan?.includes('Sedang Berkunjung'))
    .sort((a, b) => {
      // Yang baru di-scan ditaruh paling atas
      const timeA = a.jam_masuk_aktual || a.jam_checkin_aktual || '00:00';
      const timeB = b.jam_masuk_aktual || b.jam_checkin_aktual || '00:00';
      return timeB.localeCompare(timeA);
    });

  // Filter untuk tabel arsip umum di bawah
  const filteredList = bookings.filter(b => {
    const bOngoing = b.status_kunjungan === 'Sedang Berkunjung' || b.status_kunjungan?.includes('Sedang Berkunjung');
    if (activeTabSub === 'ACTIVE' && !bOngoing) return false;
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
      
      {/* ─── SCOPED KEYFRAME ANIMATION UNTUK LASER KAMERA & CENTANG HIJAU ─── */}
      <style>{`
        @keyframes laserSweepVertical {
          0% { top: 10%; opacity: 0.3; }
          50% { opacity: 1; }
          100% { top: 90%; opacity: 0.3; }
        }
        @keyframes checkmarkScaleUp {
          0% { transform: scale(0.7); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes checkmarkDraw {
          0% { stroke-dashoffset: 48; }
          100% { stroke-dashoffset: 0; }
        }
        .anim-camera-laser {
          animation: laserSweepVertical 2.2s ease-in-out infinite alternate;
        }
        .anim-checkmark-box {
          animation: checkmarkScaleUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .anim-checkmark-stroke {
          stroke-dasharray: 48;
          stroke-dashoffset: 0;
          animation: checkmarkDraw 0.6s ease-in-out forwards;
        }
      `}</style>

      {/* ─── BARIS STATUS WAKTU REAL-TIME POS JAGA SATPAM ─── */}
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-4 shadow-lg text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-3 font-sans">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shadow-inner shrink-0">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase font-mono flex items-center gap-1.5">
              <span>🕒 Waktu Real-Time Pos Gerbang Utama</span>
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
          <button
            onClick={handleOpenManualForm}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-md flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>+ Input Tamu Walk-In (Satpam)</span>
          </button>
        </div>
      </div>

      {/* ─── TOAST NOTIFIKASI CHECK-IN DARI BROADCAST ─── */}
      {toastCheckIn && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xl flex items-center justify-between gap-3 animate-fade-in text-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-200 animate-bounce" />
            <div>
              <span className="font-bold">🔔 TAMU TELAH SCAN BARCODE &amp; CHECK-IN:</span>
              <span className="ml-1.5 font-medium">
                {toastCheckIn.nama_penjenguk} (Wali {toastCheckIn.nama_santri}) • Jam: {toastCheckIn.jam_masuk_aktual || 'WITA'}
              </span>
            </div>
          </div>
          <button onClick={() => setToastCheckIn(null)} className="text-white/80 hover:text-white font-bold">✕</button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          PANEL UTAMA: KAMERA PEMINDAI KUPON BARCODE WALI SANTRI
          ───────────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border-2 border-emerald-500/60 rounded-3xl p-5 sm:p-6 shadow-2xl text-white space-y-5 relative overflow-hidden">
        
        {/* Background Ambient Glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header Panel Kamera */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg text-white tracking-tight">
                  📷 Kamera Pemindai Kupon Barcode Wali Santri
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                  Live Scanner
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Arahkan kamera ke gambar kupon di HP wali santri untuk verifikasi check-in otomatis.
              </p>
            </div>
          </div>

          {/* Tombol Kontrol Kamera Live */}
          <div className="flex items-center gap-2 flex-wrap">
            {cameras.length > 1 && isCameraActive && (
              <select
                value={selectedCameraId}
                onChange={(e) => {
                  setSelectedCameraId(e.target.value);
                  startCamera(e.target.value);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold focus:outline-none focus:border-emerald-500"
              >
                {cameras.map((c, i) => (
                  <option key={c.id} value={c.id}>
                    {c.label || `Kamera ${i + 1}`}
                  </option>
                ))}
              </select>
            )}

            {isCameraActive ? (
              <button
                onClick={stopCamera}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shadow-md flex items-center gap-1.5"
              >
                <CameraOff className="w-4 h-4" />
                <span>⏹️ Matikan Kamera</span>
              </button>
            ) : (
              <button
                onClick={() => startCamera(selectedCameraId)}
                disabled={isCameraStarting}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition shadow-lg shadow-emerald-500/30 flex items-center gap-2"
              >
                {isCameraStarting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Mempersiapkan Kamera...</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 text-slate-950" />
                    <span>📷 Aktifkan Kamera Scan Barcode</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Error Kamera Notice */}
        {cameraError && (
          <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/80 text-rose-200 text-xs flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{cameraError}</span>
          </div>
        )}

        {/* ─── KOTAK VIEWFINDER KAMERA LIVE ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* Kolom Kiri Viewfinder Kamera (lg:col-span-7) */}
          <div className="lg:col-span-7 bg-black/60 rounded-2xl border border-slate-800 p-3 sm:p-4 relative overflow-hidden flex flex-col items-center justify-center min-h-[280px]">
            
            {/* Viewfinder Video Container dari html5-qrcode (Harus Selalu Ada di DOM) */}
            <div 
              id="satpam-camera-viewfinder" 
              className={`w-full max-w-sm rounded-xl overflow-hidden relative shadow-2xl ${isCameraActive ? 'block' : 'hidden'}`}
              style={{ minHeight: '260px' }}
            />

            {/* Laser Line Scanning Effect saat Kamera Aktif */}
            {isCameraActive && (
              <div className="absolute inset-x-8 sm:inset-x-16 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] z-20 pointer-events-none anim-camera-laser" />
            )}

            {/* Tampilan Standby saat Kamera Belum Dinyalakan */}
            {!isCameraActive && (
              <div className="py-12 px-4 text-center space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-emerald-400 shadow-inner">
                  <Scan className="w-8 h-8 animate-pulse" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-200">Kamera Pemindai Sedang Nonaktif</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
                    Klik tombol <strong>"📷 Aktifkan Kamera Scan Barcode"</strong> di atas, atau gunakan opsi alternatif di samping jika menggunakan laptop.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Kolom Kanan: 2 Opsi Bantu Scanner (lg:col-span-5) */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* OPSI 1: SCAN DARI UPLOAD GAMBAR KUPON (.PNG) */}
            <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-400 flex items-center gap-1.5">
                  <Upload className="w-4 h-4" />
                  1. Scan dari Upload Gambar Kupon (.PNG)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-mono">
                  Demo &amp; File
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">
                Pilih file gambar kupon (.PNG) yang telah diunduh wali santri untuk membaca barcodenya secara instan:
              </p>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleUploadImageScan}
                className="hidden"
                id="satpam-file-input"
              />
              <label
                htmlFor="satpam-file-input"
                className="w-full py-2.5 px-3 rounded-xl bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition shadow-sm"
              >
                <Upload className="w-4 h-4" />
                <span>🖼️ Pilih File Gambar Kupon (.PNG)</span>
              </label>
            </div>

            {/* OPSI 2: INPUT CEPAT / USB BARCODE SCANNER */}
            <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <QrCode className="w-4 h-4" />
                  2. Input Cepat / Alat Tembak Barcode USB
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                  Manual / Scanner
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">
                Scan menggunakan pistol barcode USB atau ketik kode kupon lalu tekan Enter:
              </p>

              <form onSubmit={handleManualBarcodeInput} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ketik kode (GP-DU-..., SR-...) / Nama Santri..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 font-mono font-bold"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1"
                >
                  <span>Proses</span>
                </button>
              </form>
              <div className="text-[10px] text-slate-400 flex items-center justify-between">
                <span>Contoh: <code className="text-emerald-300">GP-DU-NURMIYATY-1027</code> atau ketik nama santri</span>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL POP-UP HASIL SCAN KAMERA SATPAM (ANIMASI CENTANG HIJAU)
          ───────────────────────────────────────────────────────────── */}
      {scanModalResult && scanModalResult.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border-2 border-emerald-500 rounded-3xl p-6 sm:p-7 max-w-lg w-full text-white shadow-2xl space-y-5 animate-scale-up">
            
            {/* Animasi Centang Hijau / Silang Merah */}
            <div className="text-center space-y-3">
              {scanModalResult.success ? (
                <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 mx-auto flex items-center justify-center rounded-full bg-emerald-500/20 border-2 border-emerald-400 anim-checkmark-box shadow-xl shadow-emerald-500/30">
                  <svg className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-400" viewBox="0 0 52 52">
                    <circle
                      className="stroke-current text-emerald-500/30"
                      strokeWidth="4"
                      fill="none"
                      cx="26"
                      cy="26"
                      r="23"
                    />
                    <path
                      className="stroke-current text-emerald-400 anim-checkmark-stroke"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                      d="M14.1 27.2l7.1 7.2 16.7-16.8"
                    />
                  </svg>
                </div>
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 mx-auto flex items-center justify-center rounded-full bg-rose-500/20 border-2 border-rose-400 shadow-xl shadow-rose-500/30">
                  <XCircle className="w-10 h-10 text-rose-400" />
                </div>
              )}

              <div>
                <h3 className={`font-black text-lg sm:text-xl tracking-tight ${scanModalResult.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {scanModalResult.title}
                </h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {scanModalResult.message}
                </p>
              </div>
            </div>

            {/* Rincian Tamu yang Berhasil Check-In */}
            {scanModalResult.booking && (
              <div className="bg-black/50 p-4 rounded-2xl border border-slate-800 text-xs space-y-2 font-sans">
                <div className="grid grid-cols-2 gap-2 pb-2 border-b border-slate-800">
                  <div>
                    <span className="text-slate-400 block text-[10px] font-mono">NAMA SANTRI:</span>
                    <strong className="text-sm text-white font-bold">{scanModalResult.booking.nama_santri}</strong>
                    <span className="text-[10px] text-emerald-400 block font-mono">{scanModalResult.booking.kelas} ({scanModalResult.booking.asal || 'Surabaya'})</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-mono">PENJENGUK (TAMU):</span>
                    <strong className="text-sm text-white font-bold">{scanModalResult.booking.nama_penjenguk}</strong>
                    <span className="text-[10px] text-slate-300 block">{scanModalResult.booking.status_penjenguk || 'Wali Santri'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px] font-mono">WAKTU CHECK-IN AKTUAL:</span>
                    <strong className="text-emerald-300 font-mono font-bold text-sm">
                      {scanModalResult.booking.jam_masuk_aktual || liveClock.jam_menit_detik} WITA
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-mono">BATAS JAM SELESAI:</span>
                    <strong className="text-cyan-300 font-mono font-bold text-sm">
                      {scanModalResult.booking.jam_selesai} WITA
                    </strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 text-[11px]">
                  <span className="text-slate-400 block text-[10px] font-mono">TITIPAN BARANG:</span>
                  <div className="flex items-center justify-between text-slate-200 mt-0.5">
                    <span className="truncate">{scanModalResult.booking.titipan_barang || 'Tidak ada titipan khusus'}</span>
                    <span className="font-mono font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30 shrink-0 ml-2">
                      {scanModalResult.booking.berat_barang_kg || 0} Kg
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Tombol Aksi Modal Satpam */}
            <div className="pt-1 space-y-2">
              {scanModalResult.canDispensasi && scanModalResult.booking && (
                <button
                  onClick={() => {
                    const b = scanModalResult.booking;
                    const updated = checkInVisitBooking(b.id || b, 'DISPENSASI_SATPAM');
                    sound.playSuccess?.();
                    setScanModalResult({
                      isOpen: true,
                      success: true,
                      title: '✅ CHECK-IN DISPENSASI SATPAM BERHASIL',
                      message: `Wali santri ${b.nama_penjenguk} (Wali ${b.nama_santri}) resmi diberikan izin masuk khusus dan tercatat di area pondok.`,
                      booking: updated || {
                        ...b,
                        status_kunjungan: 'Sedang Berkunjung',
                        jam_masuk_aktual: liveClock.jam_menit_detik
                      }
                    });
                  }}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow-lg flex items-center justify-center gap-2 animate-pulse"
                >
                  <Check className="w-4 h-4" />
                  <span>✓ Izinkan Check-In Khusus (Dispensasi Pos Satpam Hari Ini)</span>
                </button>
              )}

              <button
                onClick={() => setScanModalResult(null)}
                className={`w-full py-3 rounded-xl ${
                  scanModalResult.success
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black'
                    : 'bg-slate-700 hover:bg-slate-600 text-white font-bold'
                } text-xs transition shadow-lg flex items-center justify-center gap-2`}
              >
                <Check className="w-4 h-4" />
                <span>{scanModalResult.success ? '✓ Tutup & Lanjutkan Pemantauan Pos Gerbang' : 'Tutup'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TABEL UTAMA: DAFTAR OTOMATIS WALI SANTRI YANG SEDANG BERKUNJUNG
          (TERVERIFIKASI KAMERA / SATPAM DENGAN HITUNG MUNDUR SISA WAKTU)
          ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border-2 border-emerald-500/40 shadow-md overflow-hidden space-y-0">
        
        {/* Header Tabel Pengunjung Aktif */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-b border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-black text-sm text-slate-900 tracking-tight flex items-center gap-2">
                <span>📋 Daftar Otomatis Wali Santri yang Sedang Berkunjung (Terverifikasi Kamera/Satpam)</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
              </h4>
              <p className="text-[11px] text-slate-500">
                Tamu yang berhasil di-scan otomatis muncul di baris teratas dengan hitung mundur sisa waktu kunjungan.
              </p>
            </div>
          </div>

          <span className="px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-mono font-black shadow-xs">
            {activeVisitingGuests.length} Tamu Aktif di Pondok
          </span>
        </div>

        {/* Tabel Pengunjung Aktif */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                <th className="py-3 px-3">No</th>
                <th className="py-3 px-3">Santri &amp; Kelas</th>
                <th className="py-3 px-3">Penjenguk (Wali)</th>
                <th className="py-3 px-3">Jam Masuk (Check-In)</th>
                <th className="py-3 px-3">Sisa Waktu Kunjungan</th>
                <th className="py-3 px-3">Titipan Barang &amp; Berat</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-center">Aksi Satpam</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeVisitingGuests.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-400">
                    <p className="font-semibold text-slate-600 text-xs">
                      Saat ini belum ada tamu yang sedang berkunjung di dalam area pondok.
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Silakan arahkan kamera scan ke kupon wali santri untuk mencatat check-in otomatis.
                    </p>
                  </td>
                </tr>
              ) : (
                activeVisitingGuests.map((item, idx) => {
                  const cd = calculateVisitCountdown(item.jam_selesai, item.tanggal_kunjungan);

                  return (
                    <tr key={item.id} className="hover:bg-emerald-50/40 transition">
                      <td className="py-3 px-3 font-mono font-bold text-slate-500">
                        {idx + 1}.
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{item.nama_santri}</div>
                        <div className="text-[10px] text-emerald-700 font-semibold">{item.kelas}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-800">{item.nama_penjenguk}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{item.status_penjenguk} • {item.no_wa_penjenguk}</div>
                      </td>
                      <td className="py-3 px-3 font-mono">
                        <div className="text-emerald-700 font-bold">
                          {item.jam_masuk_aktual || item.jam_checkin_aktual || item.jam_kunjungan} WITA
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Batas: {item.jam_selesai} WITA
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono">
                        {cd && cd.isOverstay ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            Overstay ({cd.remainingText})
                          </span>
                        ) : cd ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                            <Clock className="w-3 h-3 text-blue-600 animate-spin" />
                            ⏳ {cd.remainingText}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-slate-700 truncate max-w-[140px]">{item.titipan_barang || '-'}</div>
                        <span className="text-[10px] font-mono font-bold text-cyan-800 bg-cyan-100 px-1.5 py-0.2 rounded mt-0.5 inline-block">
                          {item.berat_barang_kg || 0} Kg
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1 shadow-2xs">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Sudah Scan &amp; Sedang Berkunjung</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => {
                            if (confirm(`Konfirmasi kepulangan tamu ${item.nama_penjenguk} (Wali ${item.nama_santri})? Barcode akan dihanguskan.`)) {
                              checkOutVisitBooking(item.id);
                              sound.playSuccess?.();
                            }
                          }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black transition shadow-xs flex items-center gap-1 mx-auto"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>🏁 Selesai Berkunjung (Check-Out)</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* ─── FORM INPUT WALK-IN MANUAL SATPAM (MODAL TOGGLE) ─── */}
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
              ✕ Tutup
            </button>
          </div>

          <form onSubmit={handleSatpamSubmit} className="space-y-3 text-xs">
            {/* Quick Auto-fill dari Santri Terdaftar */}
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Pilih Cepat dari Data Santri Terdaftar:
              </label>
              <select
                onChange={(e) => handleSelectSantri(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-semibold"
              >
                <option value="">-- Pilih Santri Terdaftar (Opsional) --</option>
                {santriList.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.nama} ({s.kelas} - {s.kamar})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nama Santri *</label>
                <input
                  type="text"
                  required
                  placeholder="Nama Lengkap Santri"
                  value={satpamForm.nama_santri}
                  onChange={(e) => setSatpamForm(prev => ({ ...prev, nama_santri: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Kelas &amp; Kamar</label>
                <input
                  type="text"
                  placeholder="Misal: 10-A (Umar 204)"
                  value={satpamForm.kelas}
                  onChange={(e) => setSatpamForm(prev => ({ ...prev, kelas: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Asal Daerah</label>
                <input
                  type="text"
                  placeholder="Misal: Surabaya"
                  value={satpamForm.asal}
                  onChange={(e) => setSatpamForm(prev => ({ ...prev, asal: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nama Penjenguk (Wali) *</label>
                <input
                  type="text"
                  required
                  placeholder="Nama Lengkap Penjenguk"
                  value={satpamForm.nama_penjenguk}
                  onChange={(e) => setSatpamForm(prev => ({ ...prev, nama_penjenguk: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Hubungan</label>
                <select
                  value={satpamForm.status_penjenguk}
                  onChange={(e) => setSatpamForm(prev => ({ ...prev, status_penjenguk: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
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
                placeholder="Misal: Pakaian ganti, Vitamin, Makanan ringan..."
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
                <span>Simpan &amp; Check-In Langsung</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TABEL ARSIP LOG SELURUH KUNJUNGAN POS JAGA
          ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden space-y-0">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h4 className="font-black text-sm text-slate-900 tracking-tight">
              Arsip Seluruh Log Kunjungan Pos Jaga Keamanan
            </h4>
            <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              {filteredList.length} Catatan
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
                <th className="py-3 px-3">Nama Penjenguk</th>
                <th className="py-3 px-3 text-center">Status / Aksi</th>
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
                  const isOngoing = item.status_kunjungan === 'Sedang Berkunjung' || item.status_kunjungan?.includes('Sedang Berkunjung');
                  const isApproved = (item.status_kunjungan === 'Disetujui (Siap Datang)' || item.status_kunjungan === 'Disetujui' || item.status_kunjungan?.includes('Disetujui')) && !isOngoing;
                  const isPending = item.status_kunjungan === 'Menunggu Approval';
                  const isDone = item.status_kunjungan === 'Selesai';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-3 font-mono text-[11px] font-bold text-slate-500">
                        {index + 1}. {item.id.replace('VST-', '#')}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold inline-flex items-center gap-1 ${
                          item.booking_source?.includes('WHATSAPP') || item.barcode_token
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {item.booking_source?.includes('WHATSAPP') || item.barcode_token ? 'Via WhatsApp' : 'Manual Satpam'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{item.nama_santri}</div>
                        {item.barcode_token && (
                          <span className="text-[9px] font-mono font-bold text-emerald-800 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200 mt-0.5 inline-block">
                            {item.barcode_token}
                          </span>
                        )}
                      </td>
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
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-slate-700 max-w-[140px] truncate">{item.titipan_barang || '-'}</div>
                        <span className="text-[10px] font-mono font-bold text-cyan-800 bg-cyan-100 px-1.5 py-0.2 rounded mt-0.5 inline-block">
                          {item.berat_barang_kg || 0} Kg
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-800">{item.nama_penjenguk}</div>
                        <span className="text-[10px] text-slate-400">{item.status_penjenguk}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {isOngoing ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Sedang Berkunjung
                            </span>
                          ) : isDone ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              ✓ Selesai
                            </span>
                          ) : isApproved ? (
                            <button
                              onClick={() => handleProcessScannedBarcode(item.barcode_token || item.id, 'MANUAL_TABLE')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition shadow-xs flex items-center gap-1"
                            >
                              <CheckCircle className="w-3 h-3" />
                              <span>Check-In</span>
                            </button>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                              Menunggu
                            </span>
                          )}

                          {/* Tombol Lihat Kupon */}
                          <button
                            onClick={() => {
                              const token = item.barcode_token || item.id;
                              const { gatePassUrl } = getVisitGatePassUrls(token);
                              window.open(gatePassUrl, '_blank');
                              sound.playSuccess?.();
                            }}
                            className="px-1.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition border border-slate-200 flex items-center gap-0.5"
                            title="Buka Halaman Kupon (.PNG)"
                          >
                            <ExternalLink className="w-3 h-3 text-emerald-600" />
                            <span className="hidden sm:inline">Kupon</span>
                          </button>
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

    </div>
  );
}
