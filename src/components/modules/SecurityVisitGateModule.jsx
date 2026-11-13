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
  Maximize2,
  Calendar,
  Download,
  FileSpreadsheet,
  BarChart3,
  Filter,
  X,
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  Sliders
} from 'lucide-react';
import { sound } from '../../utils/audio';
import { getRealtimePondokClock, calculateVisitCountdown, checkBarcodeLifecycle } from '../../utils/pondokTimeUtils';
import { getVisitGatePassUrls } from '../../utils/barcodeUtils';
import { downloadCsvFile, generateCsv } from '../../utils/csvUtils';
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
    isSerialConnected,
    reminderThresholdMinutes,
    setReminderThresholdMinutes,
    isAutoSendWaReminder,
    setIsAutoSendWaReminder,
    isAlarmSoundEnabled,
    setIsAlarmSoundEnabled,
    sendVisitWarningReminder,
    broadcastAllVisitWarningReminders,
    simulateVisitNearExpiry
  } = useApp();

  // Ambang Batas & Alarm States
  const [customMinutesInput, setCustomMinutesInput] = useState(String(reminderThresholdMinutes || 15));
  const [alarmSuccessToast, setAlarmSuccessToast] = useState(null);

  const showAlarmToast = (msg) => {
    setAlarmSuccessToast(msg);
    setTimeout(() => setAlarmSuccessToast(null), 4500);
  };

  const handleApplyCustomMinutes = (e) => {
    e.preventDefault();
    const val = parseInt(customMinutesInput, 10);
    if (!isNaN(val) && val >= 15 && val <= 360) {
      setReminderThresholdMinutes(val);
      showAlarmToast(`Ambang batas pengingat berhasil diatur ke H-${val} Menit.`);
    } else {
      alert('Harap masukkan angka batas waktu minimal 15 menit (antara 15 hingga 360 menit)!');
    }
  };

  // Verification & Camera States
  const [barcodeInput, setBarcodeInput] = useState('');
  const [activeVisitorTab, setActiveVisitorTab] = useState('ACTIVE_VISITS'); // 'ACTIVE_VISITS' | 'ALARM_CONFIG' | 'LOGS_ARCHIVE' | 'ALL'
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

  // Lock body scroll & aktifkan tombol Escape saat modal hasil scan terbuka
  useEffect(() => {
    if (scanModalResult?.isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') setScanModalResult(null);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = prevOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [scanModalResult?.isOpen]);

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

    const isCleanTest = token.includes('TEST');
    const isTestItem = (b) => Boolean(
      b?.is_test ||
      String(b?.id || '').includes('TEST') ||
      String(b?.barcode_token || '').includes('TEST') ||
      /simulasi/i.test(String(b?.titipan_barang || ''))
    );

    // 1. Cari booking yang cocok di daftar visitBookings
    const candidates = bookings.filter(b => {
      if (!isCleanTest && isTestItem(b)) return false;
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

    let booking = null;
    if (candidates.length > 0) {
      candidates.sort((a, b) => {
        const rankStatus = (st) => {
          if (st === 'Sedang Berkunjung' || String(st).includes('Sedang Berkunjung')) return 10;
          if (String(st).includes('Disetujui')) return 8;
          if (String(st).includes('Menunggu')) return 5;
          return 1;
        };
        const rA = rankStatus(a.status_kunjungan);
        const rB = rankStatus(b.status_kunjungan);
        if (rA !== rB) return rB - rA;
        return (Date.parse(b.created_at || b.updated_at || 0) || 0) - (Date.parse(a.created_at || a.updated_at || 0) || 0);
      });
      booking = candidates[0];
    }

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
  const todayYmd = liveClock.tanggal_ymd;

  // DAFTAR PENGUNJUNG YANG SEDANG BERKUNJUNG HARI INI SAJA (REAL-TIME POS GERBANG SESUAI HARI INI)
  const activeVisitingGuests = bookings
    .filter(b => {
      const isOngoing = b.status_kunjungan === 'Sedang Berkunjung' || b.status_kunjungan?.includes('Sedang Berkunjung');
      if (!isOngoing) return false;
      const bDate = b.tanggal_kunjungan || b.tanggal_masuk || (b.jam_masuk_aktual ? todayYmd : '');
      return bDate === todayYmd;
    })
    .sort((a, b) => {
      // Yang baru di-scan ditaruh paling atas
      const timeA = a.jam_masuk_aktual || a.jam_checkin_aktual || '00:00';
      const timeB = b.jam_masuk_aktual || b.jam_checkin_aktual || '00:00';
      return timeB.localeCompare(timeA);
    });

  // Analisis Ambang Batas Pengingat & Overstay Tamu Berkunjung Hari Ini
  const warningGuests = activeVisitingGuests.filter(item => {
    const cd = calculateVisitCountdown(item.jam_selesai, item.tanggal_kunjungan);
    return cd && !cd.isOverstay && (cd.diffMs / 60000) <= reminderThresholdMinutes;
  });

  const overdueGuests = activeVisitingGuests.filter(item => {
    const cd = calculateVisitCountdown(item.jam_selesai, item.tanggal_kunjungan);
    return cd && cd.isOverstay;
  });

  // Deteksi kunjungan hari lampau yang belum selesai (agar tidak overstay ribuan menit)
  const stalePastVisits = bookings.filter(b => {
    const isOngoing = b.status_kunjungan === 'Sedang Berkunjung' || b.status_kunjungan?.includes('Sedang Berkunjung');
    if (!isOngoing) return false;
    const bDate = b.tanggal_kunjungan || b.tanggal_masuk;
    return bDate && bDate < todayYmd;
  });

  const handleResolvePastVisits = () => {
    if (stalePastVisits.length === 0) return;
    if (window.confirm(`Tutup & arsipkan otomatis ${stalePastVisits.length} kunjungan dari hari sebelumnya yang belum di-check out?`)) {
      stalePastVisits.forEach(v => {
        checkOutVisitBooking(v.id);
      });
      sound.playSuccess?.();
    }
  };

  // State & Perhitungan Rekap Bulanan Otomatis Satpam
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7)); // 'YYYY-MM'

  const monthlyBookings = bookings.filter(b => {
    const d = b.tanggal_kunjungan || b.tanggal_masuk || b.created_at?.slice(0, 10);
    return d && d.startsWith(selectedMonth);
  });

  const monthlyMetrics = {
    total: monthlyBookings.length,
    selesai: monthlyBookings.filter(b => b.status_kunjungan === 'Selesai').length,
    aktif: monthlyBookings.filter(b => b.status_kunjungan === 'Sedang Berkunjung' || b.status_kunjungan?.includes('Sedang Berkunjung')).length,
    titipanKg: monthlyBookings.reduce((sum, b) => sum + (Number(b.berat_barang_kg) || 0), 0).toFixed(1),
    weekend: monthlyBookings.filter(b => b.approval_type === 'AUTO_WEEKEND' || ['Jumat', 'Sabtu', 'Minggu', 'Ahad'].includes(b.hari_kunjungan)).length,
  };

  const handleExportMonthlyCsvSatpam = () => {
    const headers = [
      'No',
      'ID Kunjungan',
      'Tanggal',
      'Hari',
      'Nama Santri',
      'Kelas',
      'Kamar',
      'Nama Penjenguk',
      'Status Penjenguk',
      'No WA',
      'Jam Masuk',
      'Jam Selesai',
      'Barang Titipan',
      'Berat (Kg)',
      'Status Kunjungan',
      'Sumber Booking',
      'Kode Barcode'
    ];

    const rows = monthlyBookings.map((b, idx) => ({
      'No': idx + 1,
      'ID Kunjungan': b.id,
      'Tanggal': b.tanggal_kunjungan || '-',
      'Hari': b.hari_kunjungan || '-',
      'Nama Santri': b.nama_santri || '-',
      'Kelas': b.kelas || '-',
      'Kamar': b.kamar || '-',
      'Nama Penjenguk': b.nama_penjenguk || '-',
      'Status Penjenguk': b.status_penjenguk || '-',
      'No WA': b.no_wa_penjenguk || '-',
      'Jam Masuk': b.jam_masuk_aktual || b.jam_checkin_aktual || b.jam_kunjungan || '-',
      'Jam Selesai': b.jam_selesai || '-',
      'Barang Titipan': b.titipan_barang || '-',
      'Berat (Kg)': b.berat_barang_kg || 0,
      'Status Kunjungan': b.status_kunjungan || '-',
      'Sumber Booking': b.booking_source || (b.barcode_token ? 'WhatsApp' : 'Manual Satpam'),
      'Kode Barcode': b.barcode_token || '-'
    }));

    const csv = generateCsv(headers, rows);
    downloadCsvFile(`Rekap_Kunjungan_Satpam_${selectedMonth}`, csv);
    sound.playSuccess?.();
  };

  // Filter untuk tabel arsip umum di bawah
  const filteredList = (activeTabSub === 'MONTHLY_RECAP' ? monthlyBookings : bookings).filter(b => {
    const bOngoing = b.status_kunjungan === 'Sedang Berkunjung' || b.status_kunjungan?.includes('Sedang Berkunjung');
    const bDate = b.tanggal_kunjungan || b.tanggal_masuk || (b.jam_masuk_aktual ? todayYmd : '');

    if (activeTabSub === 'TODAY' && bDate !== todayYmd) return false;
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
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setScanModalResult(null);
          }}
        >
          <div className="relative bg-slate-900 border-2 border-emerald-500 rounded-3xl p-4 sm:p-6 max-w-md sm:max-w-lg w-full text-white shadow-2xl space-y-3 sm:space-y-3.5 animate-scale-up max-h-[92vh] flex flex-col justify-between my-auto">
            
            {/* Tombol Tutup X di Sudut Kanan Atas */}
            <button
              type="button"
              onClick={() => setScanModalResult(null)}
              aria-label="Tutup Jendela"
              className="absolute top-3 right-3 sm:top-4 sm:right-4 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition border border-slate-700 shadow-md z-20 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Animasi Centang Hijau / Silang Merah */}
            <div className="text-center space-y-2 pt-0.5">
              {scanModalResult.success ? (
                <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 mx-auto flex items-center justify-center rounded-full bg-emerald-500/20 border-2 border-emerald-400 anim-checkmark-box shadow-xl shadow-emerald-500/30">
                  <svg className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-400" viewBox="0 0 52 52">
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
                <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 mx-auto flex items-center justify-center rounded-full bg-rose-500/20 border-2 border-rose-400 shadow-xl shadow-rose-500/30">
                  <XCircle className="w-7 h-7 sm:w-8 sm:h-8 text-rose-400" />
                </div>
              )}

              <div>
                <h3 className={`font-black text-base sm:text-lg tracking-tight ${scanModalResult.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {scanModalResult.title}
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5 leading-snug">
                  {scanModalResult.message}
                </p>
              </div>
            </div>

            {/* Rincian Tamu yang Berhasil Check-In */}
            {scanModalResult.booking && (
              <div className="bg-black/50 p-3 sm:p-3.5 rounded-2xl border border-slate-800 text-xs space-y-2 font-sans">
                <div className="grid grid-cols-2 gap-2 pb-2 border-b border-slate-800">
                  <div>
                    <span className="text-slate-400 block text-[9px] sm:text-[10px] font-mono">NAMA SANTRI:</span>
                    <strong className="text-xs sm:text-sm text-white font-bold block truncate">{scanModalResult.booking.nama_santri}</strong>
                    <span className="text-[9px] sm:text-[10px] text-emerald-400 block font-mono truncate">{scanModalResult.booking.kelas} ({scanModalResult.booking.asal || 'Surabaya'})</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] sm:text-[10px] font-mono">PENJENGUK (TAMU):</span>
                    <strong className="text-xs sm:text-sm text-white font-bold block truncate">{scanModalResult.booking.nama_penjenguk}</strong>
                    <span className="text-[9px] sm:text-[10px] text-slate-300 block truncate">{scanModalResult.booking.status_penjenguk || 'Wali Santri'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-0.5 text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[9px] sm:text-[10px] font-mono">WAKTU CHECK-IN AKTUAL:</span>
                    <strong className="text-emerald-300 font-mono font-bold text-xs sm:text-sm">
                      {scanModalResult.booking.jam_masuk_aktual || liveClock.jam_menit_detik} WITA
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] sm:text-[10px] font-mono">BATAS JAM SELESAI:</span>
                    <strong className="text-cyan-300 font-mono font-bold text-xs sm:text-sm">
                      {(scanModalResult.booking.jam_selesai || '17:30').replace(/^23:/, '17:30')} WITA
                    </strong>
                  </div>
                </div>

                <div className="pt-1.5 border-t border-slate-800 text-[11px]">
                  <span className="text-slate-400 block text-[9px] sm:text-[10px] font-mono">TITIPAN BARANG:</span>
                  <div className="flex items-center justify-between text-slate-200 mt-0.5">
                    <span className="text-xs truncate">{scanModalResult.booking.titipan_barang || 'Tidak ada titipan khusus'}</span>
                    <span className="font-mono font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30 shrink-0 ml-2 text-xs">
                      {scanModalResult.booking.berat_barang_kg || 0} Kg
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Tombol Aksi Modal Satpam */}
            <div className="pt-0.5 space-y-2">
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
                  className="w-full py-2.5 sm:py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow-lg flex items-center justify-center gap-2 animate-pulse cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>✓ Izinkan Check-In Khusus (Dispensasi Pos Satpam Hari Ini)</span>
                </button>
              )}

              <button
                onClick={() => setScanModalResult(null)}
                className={`w-full py-2.5 sm:py-3 rounded-xl ${
                  scanModalResult.success
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black'
                    : 'bg-slate-700 hover:bg-slate-600 text-white font-bold'
                } text-xs transition shadow-lg flex items-center justify-center gap-2 cursor-pointer`}
              >
                <Check className="w-4 h-4" />
                <span>{scanModalResult.success ? '✓ Tutup & Lanjutkan Pemantauan Pos Gerbang' : 'Tutup'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ─── BANNER PERINGATAN KUNJUNGAN HARI LAMPAU YANG BELUM CHECK-OUT ─── */}
      {stalePastVisits.length > 0 && (
        <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 animate-bounce" />
            <div className="text-xs">
              <span className="font-bold">⚠️ Perhatian Pos Satpam:</span>
              <span className="ml-1">
                Terdapat <strong>{stalePastVisits.length}</strong> kunjungan dari hari lampau yang belum di-check out (tersangkut di sistem).
              </span>
            </div>
          </div>
          <button
            onClick={handleResolvePastVisits}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition shadow-sm shrink-0 flex items-center gap-1.5 active:scale-95"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Tutup &amp; Arsipkan Selesai ({stalePastVisits.length})</span>
          </button>
        </div>
      )}

      {/* ─── TOAST NOTIFIKASI SUKSES ALARM & PENGINGAT ─── */}
      {alarmSuccessToast && (
        <div className="bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300 p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between gap-2.5 shadow-lg animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{alarmSuccessToast}</span>
          </div>
          <button onClick={() => setAlarmSuccessToast(null)} className="text-emerald-300 hover:text-white font-bold">✕</button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          NAVIGASI TAB KONTEN POS KUNJUNGAN (HEMAT RUANG & COMPACT)
          ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-2 sm:p-2.5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveVisitorTab('ACTIVE_VISITS')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
              activeVisitorTab === 'ACTIVE_VISITS'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 text-emerald-300" />
            <span>📋 Daftar Tamu Aktif ({activeVisitingGuests.length})</span>
            {warningGuests.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] bg-amber-500 text-slate-950 rounded-full font-black animate-pulse">
                {warningGuests.length} Kritis
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveVisitorTab('ALARM_CONFIG')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
              activeVisitorTab === 'ALARM_CONFIG'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-950/40'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <BellRing className={`w-4 h-4 ${activeVisitorTab === 'ALARM_CONFIG' ? 'text-slate-950' : 'text-amber-400'}`} />
            <span>🔔 Kontrol &amp; Uji Pengingat</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              activeVisitorTab === 'ALARM_CONFIG' ? 'bg-amber-600 text-white' : 'bg-amber-500/20 text-amber-300'
            }`}>
              H-{reminderThresholdMinutes}M
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveVisitorTab('LOGS_ARCHIVE')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
              activeVisitorTab === 'LOGS_ARCHIVE'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
            <span>📜 Arsip Log &amp; Rekap ({bookings.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveVisitorTab('ALL')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeVisitorTab === 'ALL'
                ? 'bg-slate-700 text-white shadow-md'
                : 'bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Tampilkan semua tabel & kontrol di satu layar"
          >
            <span>📑 Semua</span>
          </button>
        </div>

        <div className="hidden md:flex items-center gap-2 text-[11px] font-mono text-slate-400 pr-2">
          <span>Status Pengingat:</span>
          <span className="inline-flex items-center gap-1 font-bold text-amber-400">
            <Clock className="w-3 h-3" />
            H-{reminderThresholdMinutes}M
          </span>
          <span className="text-slate-600">•</span>
          <span className={isAlarmSoundEnabled ? 'text-emerald-400' : 'text-slate-500'}>
            Audio: {isAlarmSoundEnabled ? 'ON' : 'MUTE'}
          </span>
          <span className="text-slate-600">•</span>
          <span className={isAutoSendWaReminder ? 'text-emerald-400' : 'text-slate-500'}>
            Auto-WA: {isAutoSendWaReminder ? 'ON' : 'OFF'}
          </span>
        </div>
      </div>

      {/* ─── BANNER OVERSTAY JIKA ADA TAMU MELEWATI BATAS WAKTU ─── */}
      {overdueGuests.length > 0 && (activeVisitorTab === 'ACTIVE_VISITS' || activeVisitorTab === 'ALL') && (
        <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-rose-950 border-2 border-rose-500/80 rounded-3xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-rose-200 shadow-xl animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/40">
              <AlertTriangle className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-rose-600 text-white uppercase tracking-wider">
                  🚨 OVERSTAY POS GERBANG ({overdueGuests.length} TAMU)
                </span>
                <span className="text-xs font-extrabold text-rose-300 font-mono">
                  Waktu Kunjungan Telah Habis
                </span>
              </div>
              <p className="text-xs text-rose-100/90 mt-1 leading-snug">
                Terdapat tamu yang telah melewati jam selesai kunjungan namun belum check-out di pos gerbang utama. Segera hubungi wali santri untuk penyelesaian kunjungan.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── BANNER EARLY WARNING JIKA ADA TAMU MENDEKATI BATAS WAKTU (H-15 MENIT ATAU KUSTOM) ─── */}
      {warningGuests.length > 0 && (activeVisitorTab === 'ACTIVE_VISITS' || activeVisitorTab === 'ALL') && (
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 border-2 border-amber-500/80 rounded-2xl p-3.5 sm:p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-amber-200 shadow-xl animate-pulse">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/40">
              <BellRing className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-amber-500 text-slate-950 uppercase tracking-wider">
                  ⏳ PERINGATAN DINI SATPAM (H-{reminderThresholdMinutes} MENIT)
                </span>
                <span className="text-xs font-extrabold text-amber-300 font-mono">
                  {warningGuests.length} Tamu Mendekati Batas Akhir Kunjungan
                </span>
              </div>
              <p className="text-xs text-amber-100/90 mt-0.5 leading-snug">
                Waktu berkunjung segera berakhir. Kirimkan pengingat WhatsApp resmi ke wali santri agar bersiap menuju pos gerbang.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => {
                const count = broadcastAllVisitWarningReminders?.() || warningGuests.length;
                showAlarmToast(`Pesan pengingat batas waktu kunjungan berhasil dikirim ke ${count} wali santri via WhatsApp!`);
              }}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow-lg flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Kirim WA Pengingat ke Semua ({warningGuests.length})</span>
            </button>
            <button
              onClick={() => setActiveVisitorTab('ALARM_CONFIG')}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-400/40 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Atur Alarm</span>
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          PANEL KONTROL ALARM & PENGINGAT BATAS KUNJUNGAN (COMPACT & SLIM)
          ───────────────────────────────────────────────────────────── */}
      {(activeVisitorTab === 'ALARM_CONFIG' || activeVisitorTab === 'ALL') && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl text-white space-y-3.5 animate-fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0">
                <BellRing className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-black text-xs sm:text-sm text-white tracking-tight">
                    🔔 Panel Kontrol Alarm &amp; Pengingat Batas Kunjungan
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40">
                    Aktif H-{reminderThresholdMinutes}M
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Konfigurasi alarm audio &amp; notifikasi WhatsApp otomatis saat waktu kunjungan wali santri tersisa H-X menit.
                </p>
              </div>
            </div>

            {/* Quick Test Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => sound.playReminderChime?.()}
                className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="Uji bunyi lonceng pengingat"
              >
                <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Tes Lonceng</span>
              </button>
              <button
                type="button"
                onClick={() => sound.playOverdueAlarm?.()}
                className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30 text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="Uji bunyi sirine overdue"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>Tes Sirine</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  simulateVisitNearExpiry?.(10);
                  showAlarmToast('Simulasi tamu kritis (<10 Menit) berhasil dipicu untuk pengujian alarm!');
                }}
                className="px-2.5 py-1 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
                title="Simulasikan kunjungan yang sisa waktunya < 10 menit"
              >
                <span>🧪 Uji Tamu Kritis</span>
              </button>
              {activeVisitorTab === 'ALARM_CONFIG' && (
                <button
                  type="button"
                  onClick={() => setActiveVisitorTab('ACTIVE_VISITS')}
                  className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                  title="Kembali melihat tabel tamu aktif"
                >
                  <span>← Tabel Tamu Aktif</span>
                </button>
              )}
            </div>
          </div>

          {/* Preset & Custom Minutes Grid (Diperkecil & Ramping) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            
            {/* Preset Buttons */}
            <div className="md:col-span-7 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider font-mono block">
                Preset Cepat Ambang Batas:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { min: 15, label: 'H-15 Menit', badge: 'Min/Default' },
                  { min: 30, label: 'H-30 Menit', badge: 'Standar' },
                  { min: 45, label: 'H-45 Menit', badge: 'Longgar' },
                  { min: 60, label: 'H-60 Menit', badge: '1 Jam' }
                ].map(preset => (
                  <button
                    key={preset.min}
                    type="button"
                    onClick={() => {
                      setReminderThresholdMinutes(preset.min);
                      setCustomMinutesInput(String(preset.min));
                      showAlarmToast(`Ambang batas pengingat diatur ke ${preset.label}`);
                    }}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      reminderThresholdMinutes === preset.min
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-black'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    }`}
                  >
                    <span>{preset.label}</span>
                    <span className={`text-[9px] px-1 rounded font-mono ${
                      reminderThresholdMinutes === preset.min ? 'bg-amber-600 text-white' : 'bg-slate-900 text-slate-400'
                    }`}>
                      {preset.badge}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Form Menit Kustom */}
            <div className="md:col-span-5 bg-slate-800/70 p-2.5 rounded-xl border border-slate-700 space-y-1">
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider font-mono block">
                Atur Menit Kustom (Minimal 15 Menit):
              </span>
              <form onSubmit={handleApplyCustomMinutes} className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="15"
                  max="360"
                  value={customMinutesInput}
                  onChange={(e) => setCustomMinutesInput(e.target.value)}
                  placeholder="Min 15..."
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1 text-xs font-bold text-white focus:outline-none focus:border-amber-400 font-mono"
                />
                <button
                  type="submit"
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-black shrink-0 transition cursor-pointer"
                >
                  Terapkan
                </button>
              </form>
            </div>

          </div>

          {/* Status Sakelar & Toggles (Horizontal Ramping) */}
          <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-3.5">
              <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-300 text-[11px]">
                <input
                  type="checkbox"
                  checked={isAlarmSoundEnabled}
                  onChange={(e) => {
                    setIsAlarmSoundEnabled(e.target.checked);
                    showAlarmToast(e.target.checked ? '🔊 Alarm Suara Browser: DIAKTIFKAN' : '🔇 Alarm Suara Browser: DIMUTE');
                  }}
                  className="w-3.5 h-3.5 text-amber-500 rounded"
                />
                <span className="flex items-center gap-1">
                  {isAlarmSoundEnabled ? <Volume2 className="w-3 h-3 text-amber-400" /> : <VolumeX className="w-3 h-3 text-slate-500" />}
                  <span>Alarm Audio {isAlarmSoundEnabled ? '(Aktif)' : '(Mute)'}</span>
                </span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-300 text-[11px]">
                <input
                  type="checkbox"
                  checked={isAutoSendWaReminder}
                  onChange={(e) => {
                    setIsAutoSendWaReminder(e.target.checked);
                    showAlarmToast(e.target.checked ? '📲 Kirim Otomatis WA: DIAKTIFKAN' : '📲 Kirim Otomatis WA: DIMATIKAN');
                  }}
                  className="w-3.5 h-3.5 text-emerald-500 rounded"
                />
                <span className="flex items-center gap-1">
                  <Send className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Kirim Otomatis WA {isAutoSendWaReminder ? '(Aktif)' : '(Nonaktif)'}</span>
                </span>
              </label>
            </div>

            <div className="text-[10px] font-mono text-slate-400">
              <span>Tamu Kritis (&lt;{reminderThresholdMinutes}M): </span>
              <strong className={warningGuests.length > 0 ? 'text-amber-400 font-bold' : 'text-slate-300'}>{warningGuests.length}</strong>
              <span className="mx-1">•</span>
              <span>Overstay: </span>
              <strong className={overdueGuests.length > 0 ? 'text-rose-400 font-bold' : 'text-slate-300'}>{overdueGuests.length}</strong>
            </div>
          </div>

        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TABEL UTAMA: DAFTAR REAL-TIME WALI SANTRI SEDANG CHECK-IN HARI INI
          (TERVERIFIKASI KAMERA / SATPAM DENGAN HITUNG MUNDUR SISA WAKTU)
          ───────────────────────────────────────────────────────────── */}
      {(activeVisitorTab === 'ACTIVE_VISITS' || activeVisitorTab === 'ALL') && (
        <div className="bg-white rounded-3xl border-2 border-emerald-500/40 shadow-md overflow-hidden space-y-0">
          
          {/* Header Tabel Pengunjung Aktif Hari Ini */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-b border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-black text-sm text-slate-900 tracking-tight flex items-center gap-2">
                  <span>📋 Daftar Real-Time Wali Santri Sedang Check-In Hari Ini ({liveClock.nama_hari}, {liveClock.tanggal_lengkap})</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                </h4>
                <p className="text-[11px] text-slate-500">
                  Data real-time tamu yang berkunjung hari ini di pondok. Tamu yang berhasil di-scan otomatis muncul di baris teratas dengan hitung mundur.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveVisitorTab('ALARM_CONFIG')}
                className="px-2.5 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 border border-amber-300 text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Buka panel konfigurasi ambang batas & uji alarm"
              >
                <BellRing className="w-3.5 h-3.5 text-amber-600" />
                <span>Alarm: H-{reminderThresholdMinutes}M</span>
                <span className="text-[10px] text-amber-700 underline font-normal">Ubah</span>
              </button>

              <span className="px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-mono font-black shadow-xs">
                {activeVisitingGuests.length} Tamu Aktif Hari Ini
              </span>
            </div>
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
                  const isOverstay = cd && cd.isOverstay;
                  const isWarning = cd && !cd.isOverstay && (cd.diffMs / 60000) <= reminderThresholdMinutes;

                  return (
                    <tr 
                      key={item.id} 
                      className={`transition ${
                        isOverstay 
                          ? 'bg-rose-50/80 hover:bg-rose-100/60 border-l-4 border-l-rose-500' 
                          : isWarning 
                            ? 'bg-amber-50/80 hover:bg-amber-100/60 border-l-4 border-l-amber-500' 
                            : 'hover:bg-emerald-50/40'
                      }`}
                    >
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
                        {isOverstay ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            Overstay ({cd.remainingText})
                          </span>
                        ) : isWarning ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                            <BellRing className="w-3 h-3 text-amber-600" />
                            ⏳ Hampir Habis ({cd.remainingText})
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
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 shadow-2xs ${
                          isOverstay
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : isWarning
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        }`}>
                          <CheckCircle2 className={`w-3 h-3 ${isOverstay ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-emerald-600'}`} />
                          <span>{isOverstay ? 'Overstay di Pondok' : isWarning ? 'Kritis Batas Waktu' : 'Sedang Berkunjung'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5">
                          {/* Tombol Ingatkan WA jika mendekati batas waktu */}
                          <button
                            type="button"
                            onClick={() => {
                              sendVisitWarningReminder?.(item.id);
                              showAlarmToast(`Pesan pengingat batas waktu berhasil dikirimkan ke nomor WhatsApp ${item.nama_penjenguk} (${item.no_wa_penjenguk || 'wali'})!`);
                            }}
                            className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition shadow-xs flex items-center gap-1 cursor-pointer active:scale-95 ${
                              item.reminderSent
                                ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300'
                                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black'
                            }`}
                            title={item.reminderSent ? 'Pengingat WA telah dikirim. Klik untuk kirim ulang.' : 'Kirim pesan pengingat WA batas waktu ke wali santri'}
                          >
                            <Send className="w-3 h-3" />
                            <span>{item.reminderSent ? '✓ WA Terkirim' : '📲 Ingatkan WA'}</span>
                          </button>

                          {/* Tombol Selesai (Check-Out) */}
                          <button
                            onClick={() => {
                              if (confirm(`Konfirmasi kepulangan tamu ${item.nama_penjenguk} (Wali ${item.nama_santri})? Barcode akan dihanguskan.`)) {
                                checkOutVisitBooking(item.id);
                                sound.playSuccess?.();
                              }
                            }}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black transition shadow-xs flex items-center gap-1 cursor-pointer active:scale-95"
                          >
                            <LogOut className="w-3 h-3" />
                            <span>🏁 Check-Out</span>
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

        {/* Footer Shortcut ke Arsip */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>Menampilkan daftar tamu yang sedang berada di dalam area pondok hari ini.</span>
          <button
            type="button"
            onClick={() => setActiveVisitorTab('LOGS_ARCHIVE')}
            className="font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer transition"
          >
            <span>Buka Arsip Seluruh Log &amp; Rekap Bulanan ({bookings.length})</span>
            <span>→</span>
          </button>
        </div>

      </div>
      )}

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
          TABEL ARSIP LOG SELURUH KUNJUNGAN POS JAGA & REKAP BULANAN
          ───────────────────────────────────────────────────────────── */}
      {(activeVisitorTab === 'LOGS_ARCHIVE' || activeVisitorTab === 'ALL') && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden space-y-0">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h4 className="font-black text-sm text-slate-900 tracking-tight">
              {activeTabSub === 'MONTHLY_RECAP' ? '📊 Rekap Bulanan Otomatis Kunjungan Pos Satpam' : 'Arsip Seluruh Log Kunjungan Pos Jaga Keamanan'}
            </h4>
            <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              {filteredList.length} Catatan
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-48 sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari santri / barang..."
                value={searchTable}
                onChange={(e) => setSearchTable(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
              {[
                { id: 'ALL', label: 'Semua' },
                { id: 'TODAY', label: 'Hari Ini' },
                { id: 'ACTIVE', label: 'Aktif di Area' },
                { id: 'PENDING', label: 'Menunggu' },
                { id: 'DONE', label: 'Selesai' },
                { id: 'MONTHLY_RECAP', label: '📊 Rekap Bulanan' }
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setActiveTabSub(sub.id)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition whitespace-nowrap ${
                    activeTabSub === sub.id ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* JIKA MEMILIH TAB REKAP BULANAN: TAMPILKAN CONTROLLER BULAN + KPI CARDS + TOMBOL CSV */}
        {activeTabSub === 'MONTHLY_RECAP' && (
          <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-50/70 via-teal-50/50 to-slate-50 border-b border-emerald-100 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-700">Pilih Periode Bulan:</span>
                </div>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl border border-emerald-300 bg-white font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportMonthlyCsvSatpam}
                  className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>📥 Unduh Rekap CSV ({selectedMonth})</span>
                </button>
              </div>
            </div>

            {/* 5 KPI Ringkasan Bulanan */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
              <div className="bg-white p-3 rounded-2xl border border-emerald-100 shadow-2xs">
                <span className="text-[10px] text-slate-400 font-mono block uppercase">TOTAL TAMU BULAN INI</span>
                <span className="text-lg font-black text-slate-800 font-mono mt-0.5 block">{monthlyMetrics.total}</span>
              </div>
              <div className="bg-white p-3 rounded-2xl border border-emerald-100 shadow-2xs">
                <span className="text-[10px] text-emerald-600 font-mono block uppercase">SELESAI (CHECK-OUT)</span>
                <span className="text-lg font-black text-emerald-700 font-mono mt-0.5 block">{monthlyMetrics.selesai}</span>
              </div>
              <div className="bg-white p-3 rounded-2xl border border-emerald-100 shadow-2xs">
                <span className="text-[10px] text-teal-600 font-mono block uppercase">SEDANG AKTIF</span>
                <span className="text-lg font-black text-teal-700 font-mono mt-0.5 block">{monthlyMetrics.aktif}</span>
              </div>
              <div className="bg-white p-3 rounded-2xl border border-emerald-100 shadow-2xs">
                <span className="text-[10px] text-cyan-600 font-mono block uppercase">TOTAL TITIPAN</span>
                <span className="text-lg font-black text-cyan-700 font-mono mt-0.5 block">{monthlyMetrics.titipanKg} Kg</span>
              </div>
              <div className="bg-white p-3 rounded-2xl border border-emerald-100 shadow-2xs col-span-2 sm:col-span-1">
                <span className="text-[10px] text-indigo-600 font-mono block uppercase">KUNJUNGAN WEEKEND</span>
                <span className="text-lg font-black text-indigo-700 font-mono mt-0.5 block">{monthlyMetrics.weekend}</span>
              </div>
            </div>
          </div>
        )}

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
                        <div className="font-bold">{(item.jam_kunjungan || '09:00').replace(/^23:/, '11:')} WITA</div>
                        {item.jam_masuk_aktual && (
                          <div className="text-[10px] text-emerald-600 font-semibold font-mono mt-0.5">
                            Masuk: {item.jam_masuk_aktual}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600">
                        <div>{(item.jam_selesai || '17:30').replace(/^23:/, '17:30')} WITA</div>
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
      )}

    </div>
  );
}
