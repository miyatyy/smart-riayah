import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  CreditCard, 
  Search, 
  Link2, 
  UserPlus, 
  Edit3, 
  Check, 
  X, 
  Sparkles, 
  Cpu, 
  Radio, 
  CheckCircle, 
  AlertCircle, 
  Zap, 
  Copy, 
  RefreshCw,
  Phone,
  Home,
  ShieldCheck,
  UserCheck,
  Send,
  DoorOpen,
  Wifi,
  CheckCircle2
} from 'lucide-react';
import { sound } from '../../utils/audio';

export default function RfidCardManager({ isModal = false, onClose = () => {}, defaultView = 'table' }) {
  const [activeSubTab, setActiveSubTab] = useState(defaultView);

  React.useEffect(() => {
    if (defaultView) {
      setActiveSubTab(defaultView);
    }
  }, [defaultView]);
  const { 
    santriList, 
    permits, 
    lastScannedUid, 
    setLastScannedUid,
    lastScannedTime, 
    isSerialConnected,
    connectSerial,
    disconnectSerial,
    linkCardToSantri, 
    registerNewSantriCard, 
    updateSantriCard,
    processRfidTap,
    createExpressPermit,
    sendWhatsAppNotification,
    isFonnteEnabled
  } = useApp();

  const [isTestingWa, setIsTestingWa] = useState(false);

  const [quickPermitSantri, setQuickPermitSantri] = useState(null);
  const [quickPermitForm, setQuickPermitForm] = useState({
    kategori: 'PESIAR',
    keperluan: 'Beli Buku & Kebutuhan ATK',
    durasiJam: '3',
    penjemput: 'Izin Mandiri Santri'
  });

  // Custom duration states for Quick Permit Modal
  const [quickDurationMode, setQuickDurationMode] = useState('PRESET'); // 'PRESET' | 'CUSTOM_UNIT' | 'EXACT_DATETIME'
  const [quickCustomVal, setQuickCustomVal] = useState(4);
  const [quickCustomUnit, setQuickCustomUnit] = useState('JAM');
  const [quickCustomDateTime, setQuickCustomDateTime] = useState(() => {
    const d = new Date(Date.now() + 3 * 3600 * 1000);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });

  const getQuickCalculatedBatas = () => {
    if (quickDurationMode === 'EXACT_DATETIME') {
      if (quickCustomDateTime) {
        const d = new Date(quickCustomDateTime);
        if (!isNaN(d.getTime())) return d;
      }
      return new Date(Date.now() + 3 * 3600 * 1000);
    }
    if (quickDurationMode === 'CUSTOM_UNIT') {
      const val = Math.max(1, Number(quickCustomVal) || 1);
      if (quickCustomUnit === 'MENIT') return new Date(Date.now() + val * 60 * 1000);
      if (quickCustomUnit === 'HARI') return new Date(Date.now() + val * 24 * 3600 * 1000);
      return new Date(Date.now() + val * 3600 * 1000);
    }
    const hours = Number(quickPermitForm.durasiJam || 3);
    return new Date(Date.now() + hours * 3600 * 1000);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExistingSantriId, setSelectedExistingSantriId] = useState(santriList[0]?.id || 'S-101');
  const [successNotice, setSuccessNotice] = useState(null);

  // Form for Opsi B: Tambah Kartu & Santri Baru
  const [newSantriForm, setNewSantriForm] = useState({
    uid: lastScannedUid || '04:77:88:99',
    nama: '',
    nis: '',
    kelas: '10-A',
    kamar: 'Umar bin Khattab 204',
    gender: 'L',
    waliNama: '',
    waliTelepon: '',
    initialPermitStatus: 'APPROVED' // 'APPROVED' | 'ACTIVE' | 'OVERDUE' | 'REJECTED' | 'TIDAK_ADA'
  });

  // State for Editing an existing santri's card & biodata (termasuk nomor WA wali baru)
  const [editingSantri, setEditingSantri] = useState(null);
  const [editForm, setEditForm] = useState({
    rfidUid: '',
    nama: '',
    nis: '',
    kelas: '',
    kamar: '',
    waliNama: '',
    waliTelepon: '',
    waliHubungan: 'Orang Tua / Wali',
    statusAsrama: 'DI_ASRAMA'
  });

  // Keep UID synced whenever user taps a new physical card or virtual tap
  React.useEffect(() => {
    if (lastScannedUid) {
      setNewSantriForm(prev => {
        if (prev.uid !== lastScannedUid) {
          sound.playSuccess();
          return { ...prev, uid: lastScannedUid };
        }
        return prev;
      });
    }
  }, [lastScannedTime, lastScannedUid]);

  const showNotification = (msg) => {
    setSuccessNotice(msg);
    sound.playSuccess();
    setTimeout(() => setSuccessNotice(null), 4500);
  };

  // Handler Opsi A: Tautkan UID ke Santri yang Sudah Ada
  const handleLinkExisting = (e) => {
    e.preventDefault();
    const uidToUse = lastScannedUid || newSantriForm.uid;
    if (!uidToUse) {
      alert('Silakan tap kartu fisik terlebih dahulu atau ketikkan UID!');
      return;
    }

    const santriTarget = santriList.find(s => s.id === selectedExistingSantriId);
    if (!santriTarget) return;

    linkCardToSantri(selectedExistingSantriId, uidToUse);
    showNotification(`✅ Kartu UID [${uidToUse}] berhasil dipasangkan ke ananda ${santriTarget.nama} tanpa mengubah riwayat izin!`);
  };

  // Handler Opsi B: Tambah Kartu & Identitas Santri Baru
  const handleRegisterNewSantri = (e) => {
    e.preventDefault();
    if (!newSantriForm.nama.trim()) {
      alert('Nama lengkap santri wajib diisi!');
      return;
    }

    const uidToUse = newSantriForm.uid || lastScannedUid || '04:AA:BB:CC';

    registerNewSantriCard({
      rfidUid: uidToUse,
      nama: newSantriForm.nama.trim(),
      nis: newSantriForm.nis.trim() || `${Math.floor(125500 + Math.random() * 900)}`,
      kelas: newSantriForm.kelas,
      kamar: newSantriForm.kamar,
      gender: newSantriForm.gender,
      waliNama: newSantriForm.waliNama || `Bapak/Ibu Wali dari ${newSantriForm.nama}`,
      waliTelepon: newSantriForm.waliTelepon || '0812-9988-7766'
    }, newSantriForm.initialPermitStatus);

    showNotification(`✅ Santri baru ${newSantriForm.nama} berhasil didaftarkan dengan Kartu RFID UID [${uidToUse}] dan Status Izin [${newSantriForm.initialPermitStatus}]!`);

    // Reset Form
    setNewSantriForm({
      uid: lastScannedUid || '04:88:99:AA',
      nama: '',
      nis: '',
      kelas: '10-A',
      kamar: 'Umar bin Khattab 204',
      gender: 'L',
      waliNama: '',
      waliTelepon: '',
      initialPermitStatus: 'APPROVED'
    });
  };

  // Start Editing Biodata & Kontak Wali
  const handleStartEdit = (santri) => {
    setEditingSantri(santri);
    setEditForm({
      rfidUid: santri.rfidUid || '',
      nama: santri.nama || '',
      nis: santri.nis || '',
      kelas: santri.kelas || '',
      kamar: santri.kamar || '',
      waliNama: santri.wali?.nama || '',
      waliTelepon: santri.wali?.telepon || '',
      waliHubungan: santri.wali?.hubungan || 'Orang Tua / Wali',
      statusAsrama: santri.statusAsrama || 'DI_ASRAMA'
    });
  };

  // Save Edit (Memperbarui Biodata Santri & Nomor WA Wali Tanpa Hapus/Blokir Kartu)
  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editingSantri) return;
    updateSantriCard(editingSantri.id, editForm);
    showNotification(`✅ Biodata & No. WA Wali Santri [${editForm.nama}] berhasil diperbarui ke: ${editForm.waliTelepon || '-'}. Kartu RFID [${editForm.rfidUid}] tetap aktif terhubung!`);
    setEditingSantri(null);
  };

  // Uji Kirim WhatsApp ke Nomor Baru Wali Santri secara langsung dari Modal Edit
  const handleTestWaToNewNumber = async () => {
    if (!editForm.waliTelepon) {
      alert('Silakan ketikkan Nomor WhatsApp Wali Santri terlebih dahulu!');
      return;
    }
    setIsTestingWa(true);
    sound.playWhatsApp();
    await sendWhatsAppNotification(
      `${editForm.waliNama || 'Wali'} (Wali ${editForm.nama})`,
      editForm.waliTelepon,
      'GATEWAY_TEST',
      `📲 *[VERIFIKASI NOMOR WHATSAPP WALI SANTRI - DARUL ULUM]*\nAssalamu'alaikum Warahmatullahi Wabarakatuh.\nBpk/Ibu ${editForm.waliNama || 'Wali Santri'},\n\nNomor WhatsApp Anda telah BERHASIL DIPERBARUI dan diverifikasi di sistem Smart Ri'ayah & Smart Gate untuk ananda *${editForm.nama}* (NIS: ${editForm.nis || '-'}).\n\nNotifikasi perizinan santri, laporan tap gerbang RFID keluar/masuk, serta peringatan batas waktu akan otomatis dikirimkan ke nomor ini. Terima kasih.`
    );
    setIsTestingWa(false);
    showNotification(`📲 Pesan tes WhatsApp berhasil dikirim ke nomor baru: ${editForm.waliTelepon}`);
  };

  // Open Quick Permit Modal
  const handleOpenQuickPermit = (santri) => {
    setQuickPermitSantri(santri);
    setQuickPermitForm({
      kategori: 'PESIAR',
      keperluan: 'Beli Buku & Kebutuhan ATK',
      durasiJam: '3',
      penjemput: 'Izin Mandiri Santri'
    });
  };

  // Execute Quick Permit from Modal
  const handleSaveQuickPermit = (openGateImmediately = false) => {
    if (!quickPermitSantri) return;

    const targetBatas = getQuickCalculatedBatas();
    const batasDate = targetBatas.toISOString();
    const formattedBatas = targetBatas.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

    createExpressPermit({
      santriId: quickPermitSantri.id,
      kategori: quickPermitForm.kategori,
      keperluan: quickPermitForm.keperluan,
      penjemput: quickPermitForm.penjemput,
      waktuKeluarRencana: new Date().toISOString(),
      batasKembali: batasDate,
      catatan: 'Diterbitkan melalui Tabel Kartu RFID'
    }, openGateImmediately);

    if (openGateImmediately) {
      showNotification(`✅ Izin cepat [${quickPermitForm.kategori}] disetujui (Kembali: ${formattedBatas}) & PALANG GERBANG DIBUKA untuk ${quickPermitSantri.nama}!`);
    } else {
      showNotification(`✅ Izin cepat [${quickPermitForm.kategori}] disetujui! Kartu RFID ${quickPermitSantri.nama} kini AKTIF (Batas: ${formattedBatas}) dan siap di-tap di gerbang.`);
    }

    setQuickPermitSantri(null);
  };

  // Filter santri for table
  const filteredSantri = santriList.filter(s => {
    const q = searchQuery.toLowerCase();
    return s.nama.toLowerCase().includes(q) ||
           s.rfidUid.toLowerCase().includes(q) ||
           s.nis.toLowerCase().includes(q) ||
           s.kamar.toLowerCase().includes(q);
  });

  const content = (
    <div className="space-y-6 text-slate-800">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-cyan-900 via-slate-900 to-teal-950 text-white rounded-2xl p-5 sm:p-6 shadow-xl border border-cyan-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 text-xs px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider">
              RFID CARD MANAGEMENT SYSTEM
            </span>
            <span className="text-gold-300 text-xs flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Mifare 13.56 MHz (ISO 14443A)
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            💳 Daftar & Kelola Kartu Identitas RFID Santri
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl mt-1">
            Tangkap UID kartu fisik secara otomatis saat ditempelkan ke modul RC522 (ESP32-S3), tautkan ke santri yang sudah ada, atau daftarkan kartu kosong baru.
          </p>
        </div>

        {isModal && (
          <button
            onClick={onClose}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Success Notification Alert */}
      {successNotice && (
        <div className="bg-emerald-50 border-2 border-emerald-400 text-emerald-900 p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 shadow-md animate-fade-in">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* 2. Sub-Page Switcher (Pemisah Halaman: Tabel Kartu Terdaftar vs Scanner & Pasangkan Kartu) */}
      <div className="bg-slate-100/80 border border-slate-200 p-1.5 rounded-2xl flex flex-wrap gap-2 shadow-xs">
        <button
          type="button"
          onClick={() => setActiveSubTab('table')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition ${
            activeSubTab === 'table'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>1. Tabel Seluruh Kartu Terdaftar ({santriList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('pairing')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition ${
            activeSubTab === 'pairing'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>2. Scanner & Pasangkan Kartu Baru (ESP32-S3 RC522)</span>
        </button>
      </div>

      {/* 3. AUTO-SCAN DETECTION & PAIRING BOX (HALAMAN TERSENDIRI) */}
      {activeSubTab === 'pairing' && (
        <div className="bg-white text-slate-800 rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-5 animate-fade-in">
        {/* Detection Status Box */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border-2 border-emerald-300 flex items-center justify-center text-emerald-600 shadow-xs">
                <Radio className="w-6 h-6 animate-pulse" />
              </div>
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white animate-ping"></span>
            </div>
            <div>
              <span className="text-[11px] font-mono text-emerald-700 uppercase tracking-widest font-black block">
                DETEKSI OTOMATIS SCANNER BREADBOARD RC522:
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <h3 className="text-xl sm:text-2xl font-black font-mono text-emerald-950 tracking-wider">
                  UID Terakhir di-Tap: [{lastScannedUid || 'MENUNGGU KARTU DITEMPELKAN...'}]
                </h3>
              </div>
              <p className="text-[11px] text-slate-500">
                {lastScannedTime 
                  ? `Terdeteksi pada pukul ${new Date(lastScannedTime).toLocaleTimeString('id-ID')} WIB (Sinkronisasi Web Serial ESP32-S3)`
                  : 'Tempelkan kartu RFID fisik Anda ke modul RC522 pada breadboard ESP32-S3.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Status & Sambungkan USB Serial ESP32 */}
            <button
              type="button"
              onClick={isSerialConnected ? disconnectSerial : connectSerial}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs ${
                isSerialConnected 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100' 
                  : 'bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100 animate-pulse'
              }`}
              title={isSerialConnected ? "ESP32 Terhubung via USB Serial" : "Klik untuk menghubungkan USB Serial ESP32"}
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>{isSerialConnected ? '🟢 USB ESP32 Terhubung' : '🔌 Hubungkan USB ESP32'}</span>
            </button>

            {/* Tombol Auto-Detect / Simulasi Tap */}
            <button
              type="button"
              onClick={() => {
                const sampleUids = ['04:E5:6F:04', '04:A1:2B:9C', '04:D4:5E:F3', '04:7B:8C:9D', '04:99:A1:B2', '04:CA:12:34'];
                const randomUid = sampleUids[Math.floor(Math.random() * sampleUids.length)];
                if (setLastScannedUid) setLastScannedUid(randomUid);
                processRfidTap(randomUid);
                sound.playSuccess();
              }}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition"
              title="Simulasikan Tap Kartu Acak / Auto-Detect"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>⚡ Tap Kartu Baru (Auto-Detect)</span>
            </button>
          </div>
        </div>

        {/* Two Action Panels: Opsi A and Opsi B */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* OPSI A: Pasangkan ke Santri yang Sudah Ada */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center gap-2 pb-2.5 border-b border-slate-200 mb-3">
                <Link2 className="w-4 h-4 text-emerald-600" />
                <h4 className="font-bold text-slate-900 text-sm">
                  Opsi A: Pasangkan ke Santri yang Sudah Ada
                </h4>
              </div>
              <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                Tautkan UID kartu fisik yang baru di-tap ke santri yang sudah ada di sistem tanpa menghapus atau mengubah riwayat izin mereka.
              </p>

              {/* Status Banner Opsi A */}
              {lastScannedUid ? (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center justify-between mb-3 shadow-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-bold text-emerald-950">KARTU TERDETEKSI: </span>
                      <span className="font-mono text-emerald-700 font-bold tracking-wider">{lastScannedUid}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-emerald-700 font-mono font-bold">Siap Ditautkan</span>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                  <span>Tempelkan kartu fisik ke reader RC522 untuk mendeteksi nomor UID...</span>
                </div>
              )}

              <form onSubmit={handleLinkExisting} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-mono text-slate-700 mb-1 font-bold">
                    PILIH SANTRI SASARAN:
                  </label>
                  <select
                    value={selectedExistingSantriId}
                    onChange={(e) => setSelectedExistingSantriId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  >
                    {santriList.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.nama} ({s.nis}) - UID Saat Ini: [{s.rfidUid}]
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs font-mono flex items-center justify-between">
                  <div>
                    <span className="text-slate-500 block text-[10px]">UID YANG AKAN DITAUTKAN:</span>
                    <span className="text-emerald-700 font-black text-sm tracking-wider">
                      {lastScannedUid || newSantriForm.uid || '04:XX:XX:XX'}
                    </span>
                  </div>
                  {lastScannedUid && (
                    <span className="text-[10px] text-emerald-700 font-sans font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Otomatis Terisi
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-xs"
                >
                  <Link2 className="w-4 h-4" />
                  <span>Tautkan Kartu ke Santri Ini Sekarang</span>
                </button>
              </form>
            </div>
          </div>

          {/* OPSI B: Tambah Kartu & Identitas Santri Baru */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 pb-2.5 border-b border-slate-200">
              <UserPlus className="w-4 h-4 text-emerald-600" />
              <h4 className="font-bold text-slate-900 text-sm">
                Opsi B: Beri Nama & Daftarkan Santri Baru
              </h4>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Form cepat untuk memberi nama identitas baru pada kartu RFID kosong/santri baru lengkap dengan pengaturan izin awal.
            </p>

            {/* Status Banner Opsi B */}
            {newSantriForm.uid ? (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold text-emerald-950">KARTU BARU TERDETEKSI: </span>
                    <span className="font-mono text-emerald-700 font-bold tracking-wider">{newSantriForm.uid}</span>
                  </div>
                </div>
                {lastScannedUid && lastScannedUid !== newSantriForm.uid && (
                  <button
                    type="button"
                    onClick={() => setNewSantriForm(prev => ({ ...prev, uid: lastScannedUid }))}
                    className="text-[10px] text-emerald-700 hover:text-emerald-900 font-mono font-bold underline"
                  >
                    Pakai UID: {lastScannedUid}
                  </button>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                <span>Silakan tempelkan kartu baru ke reader RC522...</span>
              </div>
            )}

            <form onSubmit={handleRegisterNewSantri} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-mono text-slate-700 font-bold">UID KARTU (OTOMATIS):</label>
                    {lastScannedUid && lastScannedUid !== newSantriForm.uid && (
                      <button
                        type="button"
                        onClick={() => setNewSantriForm(prev => ({ ...prev, uid: lastScannedUid }))}
                        className="text-[9px] text-emerald-700 hover:underline font-mono font-bold"
                      >
                        Pakai: {lastScannedUid}
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={newSantriForm.uid}
                    onChange={(e) => setNewSantriForm({ ...newSantriForm, uid: e.target.value.toUpperCase() })}
                    placeholder="XX:XX:XX:XX"
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-700 font-bold mb-1">NAMA LENGKAP SANTRI:</label>
                  <input
                    type="text"
                    value={newSantriForm.nama}
                    onChange={(e) => setNewSantriForm({ ...newSantriForm, nama: e.target.value })}
                    placeholder="Nama santri..."
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-mono text-slate-700 font-bold mb-1">NIS:</label>
                  <input
                    type="text"
                    value={newSantriForm.nis}
                    onChange={(e) => setNewSantriForm({ ...newSantriForm, nis: e.target.value })}
                    placeholder="125462"
                    className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-700 font-bold mb-1">KELAS:</label>
                  <input
                    type="text"
                    value={newSantriForm.kelas}
                    onChange={(e) => setNewSantriForm({ ...newSantriForm, kelas: e.target.value })}
                    placeholder="10-A"
                    className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-700 font-bold mb-1">KAMAR ASRAMA:</label>
                  <input
                    type="text"
                    value={newSantriForm.kamar}
                    onChange={(e) => setNewSantriForm({ ...newSantriForm, kamar: e.target.value })}
                    placeholder="Kamar 204"
                    className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-mono text-slate-700 font-bold mb-1">NO. WA WALI SANTRI:</label>
                  <input
                    type="text"
                    value={newSantriForm.waliTelepon}
                    onChange={(e) => setNewSantriForm({ ...newSantriForm, waliTelepon: e.target.value })}
                    placeholder="0812-3456-7890"
                    className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-700 font-bold mb-1">STATUS IZIN AWAL:</label>
                  <select
                    value={newSantriForm.initialPermitStatus}
                    onChange={(e) => setNewSantriForm({ ...newSantriForm, initialPermitStatus: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  >
                    <option value="APPROVED">APPROVED (Siap Tap Buka Gerbang)</option>
                    <option value="ACTIVE">ACTIVE (Sedang di Luar Pondok)</option>
                    <option value="OVERDUE">OVERDUE (Terlambat Pulang)</option>
                    <option value="REJECTED">REJECTED / BELUM IZIN (Anti-Bypass)</option>
                    <option value="TIDAK_ADA">TIDAK ADA IZIN</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-xs"
              >
                <UserPlus className="w-4 h-4" />
                <span>Simpan Santri & Aktifkan Kartu RFID Baru</span>
              </button>
            </form>
          </div>
        </div>
      </div>
      )}

      {/* 4. TABEL DAFTAR KARTU RFID TERDAFTAR LENGKAP (HALAMAN TERSENDIRI) */}
      {activeSubTab === 'table' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4 animate-fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-teal-600" />
              Tabel Daftar Seluruh Kartu RFID Terdaftar
            </h3>
            <p className="text-xs text-slate-500">
              Total {santriList.length} kartu RFID santri aktif terintegrasi dengan Turnstile Gate dan Buku Induk Ri'ayah.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari santri, UID, atau kamar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Petunjuk Pengubahan Nomor WhatsApp Wali Santri */}
        <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-emerald-950">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-700 flex items-center justify-center shrink-0">
              <Phone className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-emerald-900 flex items-center gap-1.5">
                <span>Pembaruan Nomor Telepon / WhatsApp Wali Santri:</span>
                <span className="text-[10px] bg-emerald-200 text-emerald-900 font-mono px-2 py-0.2 rounded-full font-bold">
                  Buku Induk & WhatsApp Gateway
                </span>
              </p>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                Jika santri/wati memiliki nomor WA wali yang baru, cukup klik tombol <b className="text-emerald-950 bg-emerald-200/60 px-1.5 py-0.2 rounded">"Edit Biodata & WA"</b> di kolom aksi. Kartu RFID fisik (UID) tetap aktif terhubung tanpa perlu menghapus atau memblokir kartu!
              </p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-y border-slate-200">
              <tr>
                <th className="py-3 px-3">UID Kartu RFID (Hex)</th>
                <th className="py-3 px-3">Nama Identitas Santri</th>
                <th className="py-3 px-3">NIS & Kelas / Asrama</th>
                <th className="py-3 px-3">Status Kartu</th>
                <th className="py-3 px-3">Status Izin Saat Ini</th>
                <th className="py-3 px-3 text-center">Aksi & Uji Tap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSantri.map(s => {
                const permit = permits.find(p => p.santriId === s.id && (p.status === 'APPROVED' || p.status === 'ACTIVE' || p.status === 'OVERDUE' || p.status === 'PENDING'));
                const permitStatus = permit ? permit.status : 'TIDAK ADA IZIN';

                return (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition">
                    {/* UID */}
                    <td className="py-3 px-3 font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 bg-amber-50 border border-amber-300 text-amber-900 px-2.5 py-1 rounded-lg">
                          {s.rfidUid}
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(s.rfidUid);
                            showNotification(`UID [${s.rfidUid}] disalin ke clipboard!`);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded"
                          title="Salin UID"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Mifare Classic 1K</span>
                    </td>

                    {/* Nama Santri & Kontak WhatsApp Wali */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={s.foto}
                          alt={s.nama}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-2xs"
                        />
                        <div>
                          <span className="font-bold text-slate-900 block leading-tight">{s.nama}</span>
                          <span className="text-[10px] font-mono text-teal-700 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200 inline-block mt-0.5">
                            UID: {s.rfidUid}
                          </span>
                          {/* Kontak WhatsApp Wali Santri */}
                          <div className="flex items-center gap-1 text-[11px] text-emerald-800 font-medium mt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                            <span className="text-slate-500 text-[10px]">{s.wali?.nama || 'Wali'}:</span>
                            <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 text-[10px]">
                              {s.wali?.telepon || 'Belum diisi'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* NIS & Kelas */}
                    <td className="py-3 px-3">
                      <span className="font-mono text-slate-700 block">NIS: {s.nis}</span>
                      <span className="text-slate-500 text-[11px]">{s.kelas} • {s.kamar}</span>
                    </td>

                    {/* Status Kartu */}
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-300 text-[10px] font-bold px-2.5 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Aktif / Terhubung
                      </span>
                    </td>

                    {/* Status Izin Saat Ini */}
                    <td className="py-3 px-3">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full inline-block ${
                        permitStatus === 'APPROVED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                        permitStatus === 'ACTIVE' ? 'bg-blue-100 text-blue-800 border border-blue-300 animate-pulse' :
                        permitStatus === 'OVERDUE' ? 'bg-rose-100 text-rose-800 border border-rose-300 font-black animate-bounce' :
                        permitStatus === 'PENDING' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {permitStatus}
                      </span>
                      {permit && (
                        <span className="text-[10px] text-slate-400 block font-mono mt-0.5">
                          {permit.tokenIzin}
                        </span>
                      )}
                    </td>

                    {/* Aksi */}
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {permitStatus !== 'ACTIVE' && permitStatus !== 'APPROVED' && (
                          <button
                            onClick={() => handleOpenQuickPermit(s)}
                            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1 transition shadow-xs"
                            title="Aktifkan Izin Cepat Sekarang"
                          >
                            <Send className="w-3.5 h-3.5 text-emerald-600" />
                            <span>+ Izin Cepat</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleStartEdit(s)}
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1 transition shadow-xs"
                          title="Edit Biodata Santri & Ganti Nomor WA Wali"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Edit Biodata & WA</span>
                        </button>

                        <button
                          onClick={() => processRfidTap(s.rfidUid)}
                          className="px-2.5 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-300 rounded-lg text-xs font-bold font-mono flex items-center gap-1 transition"
                          title="Uji Tap Kartu Ini di Smart Gate"
                        >
                          <Zap className="w-3.5 h-3.5 text-cyan-600" />
                          <span>Tap Gate</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* EDIT BIODATA & NOMOR WHATSAPP WALI SANTRI MODAL */}
      {editingSantri && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 my-auto overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 shrink-0 bg-white">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <Edit3 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base leading-tight">
                    Edit Biodata & No. WA Wali Santri
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Santri: <b className="text-slate-800">{editingSantri.nama}</b> (NIS: {editingSantri.nis})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingSantri(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs">
                {/* Non-Destructive Banner */}
                <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3 flex items-start gap-2.5 text-emerald-950">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">
                    <p className="font-bold text-emerald-900">Kartu RFID Fisik Tetap Aktif & Terhubung</p>
                    <p className="text-emerald-800">
                      Anda dapat memperbarui nomor WhatsApp wali santri atau biodata di bawah ini kapan saja. Kartu fisik UID <span className="font-mono font-bold bg-white px-1 py-0.2 rounded border border-emerald-300">{editForm.rfidUid}</span> tetap aman dan tidak perlu dihapus atau diblokir.
                    </p>
                  </div>
                </div>

                {/* Section 1: Data Kontak Wali Santri (WhatsApp Gateway) */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="text-[11px] font-black uppercase text-emerald-800 flex items-center gap-1.5 tracking-wider font-mono">
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                      1. Kontak Wali Santri (Terkoneksi WA Gateway)
                    </span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full font-bold">
                      Fonnte API Ready
                    </span>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Nomor Telepon / WhatsApp Wali Santri (Tujuan Notifikasi):
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editForm.waliTelepon}
                        onChange={(e) => setEditForm({ ...editForm, waliTelepon: e.target.value })}
                        placeholder="Contoh: 08813576012 atau 081234567890"
                        className="flex-1 bg-white border border-slate-300 focus:border-emerald-500 rounded-xl p-2.5 font-mono font-bold text-slate-900 text-xs focus:outline-none transition shadow-2xs"
                        required
                      />
                      <button
                        type="button"
                        onClick={handleTestWaToNewNumber}
                        disabled={isTestingWa || !editForm.waliTelepon}
                        className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shrink-0 ${
                          isTestingWa || !editForm.waliTelepon
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                        }`}
                        title="Kirim pesan uji coba ke nomor baru ini via Fonnte"
                      >
                        {isTestingWa ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Menguji...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>📲 Tes WA</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Pesan persetujuan izin, tap keluar gerbang, dan peringatan keterlambatan akan dikirimkan ke nomor ini.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Nama Lengkap Wali:</label>
                      <input
                        type="text"
                        value={editForm.waliNama}
                        onChange={(e) => setEditForm({ ...editForm, waliNama: e.target.value })}
                        placeholder="Contoh: Ibu Fatimah Az-Zahra"
                        className="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-medium text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Hubungan Keluarga:</label>
                      <select
                        value={editForm.waliHubungan}
                        onChange={(e) => setEditForm({ ...editForm, waliHubungan: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-medium text-xs focus:outline-none focus:border-emerald-500"
                      >
                        <option value="Ibu Kandung">Ibu Kandung</option>
                        <option value="Ayah Kandung">Ayah Kandung</option>
                        <option value="Orang Tua / Wali">Orang Tua / Wali</option>
                        <option value="Kakak Kandung">Kakak Kandung</option>
                        <option value="Paman / Bibi">Paman / Bibi</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section 2: Data Santri & Kartu RFID */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
                  <div className="pb-2 border-b border-slate-200">
                    <span className="text-[11px] font-black uppercase text-slate-700 flex items-center gap-1.5 tracking-wider font-mono">
                      <CreditCard className="w-3.5 h-3.5 text-cyan-600" />
                      2. Identitas Santri & Kartu RFID Fisik
                    </span>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">UID Kartu RFID (Hex):</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editForm.rfidUid}
                        onChange={(e) => setEditForm({ ...editForm, rfidUid: e.target.value.toUpperCase() })}
                        placeholder="04:XX:XX:XX"
                        className="flex-1 bg-white border border-slate-300 rounded-xl p-2.5 font-mono font-bold text-amber-800 text-sm focus:outline-none focus:border-cyan-500"
                        required
                      />
                      {lastScannedUid && lastScannedUid !== editForm.rfidUid && (
                        <button
                          type="button"
                          onClick={() => setEditForm({ ...editForm, rfidUid: lastScannedUid })}
                          className="px-2.5 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-xl font-bold text-[10px] shrink-0"
                          title="Gunakan UID Terakhir di-Scan Reader"
                        >
                          Pakai UID: {lastScannedUid}
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nama Lengkap Santri:</label>
                    <input
                      type="text"
                      value={editForm.nama}
                      onChange={(e) => setEditForm({ ...editForm, nama: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 focus:outline-none focus:border-cyan-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">NIS:</label>
                      <input
                        type="text"
                        value={editForm.nis}
                        onChange={(e) => setEditForm({ ...editForm, nis: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Kelas:</label>
                      <input
                        type="text"
                        value={editForm.kelas}
                        onChange={(e) => setEditForm({ ...editForm, kelas: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Kamar Asrama:</label>
                      <input
                        type="text"
                        value={editForm.kamar}
                        onChange={(e) => setEditForm({ ...editForm, kamar: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingSantri(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-950/20 transition flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan Perubahan Biodata & WA</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK PERMIT MODAL */}
      {quickPermitSantri && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 my-auto overflow-hidden animate-fade-in">
            {/* Header (sticky/pinned) */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 shrink-0 bg-white">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <Send className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base leading-snug">
                    Aktifkan Izin Cepat via Kartu RFID
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Santri: <b className="text-slate-800">{quickPermitSantri.nama}</b> (NIS: {quickPermitSantri.nis})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setQuickPermitSantri(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
              {/* Santri Card Pill */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center gap-3">
                <img
                  src={quickPermitSantri.foto}
                  alt={quickPermitSantri.nama}
                  className="w-11 h-11 rounded-xl object-cover border border-emerald-500 shadow-2xs shrink-0"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-900 block">{quickPermitSantri.nama}</span>
                  <span className="text-slate-500 block text-[11px]">
                    Kelas: {quickPermitSantri.kelas} | Asrama: {quickPermitSantri.kamar}
                  </span>
                  <span className="font-mono text-gold-700 bg-amber-50 px-2 py-0.5 rounded text-[10px] font-bold border border-amber-200 inline-block mt-0.5">
                    UID Kartu: {quickPermitSantri.rfidUid}
                  </span>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kategori Izin</label>
                  <select
                    value={quickPermitForm.kategori}
                    onChange={(e) => setQuickPermitForm({ ...quickPermitForm, kategori: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800"
                  >
                    <option value="PESIAR">PESIAR (Keluar Singkat Beberap Jam)</option>
                    <option value="BEROBAT">BEROBAT (Periksa ke Klinik / RS)</option>
                    <option value="PULANG">PULANG (Pulang Bermalam Bersama Wali)</option>
                    <option value="URGENT">URGENT (Keperluan Mendesak)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tujuan & Alasan</label>
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {[
                      'Beli Buku & ATK',
                      'Periksa ke Klinik Medis',
                      'Dijemput Orang Tua',
                      'Kebutuhan Kamar'
                    ].map(chip => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setQuickPermitForm({ ...quickPermitForm, keperluan: chip })}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-emerald-100 text-[10px] rounded-lg text-slate-600 border border-slate-200"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={quickPermitForm.keperluan}
                    onChange={(e) => setQuickPermitForm({ ...quickPermitForm, keperluan: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-medium"
                    required
                  />
                </div>

                {/* Durasi Izin Custom Section */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 flex-wrap gap-2">
                    <label className="block font-bold text-slate-800 text-xs">Durasi Izin (Kustom Musyrif):</label>
                    <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setQuickDurationMode('PRESET')}
                        className={`px-2 py-0.5 rounded ${quickDurationMode === 'PRESET' ? 'bg-emerald-600 text-white' : 'text-slate-600'}`}
                      >
                        Preset
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickDurationMode('CUSTOM_UNIT')}
                        className={`px-2 py-0.5 rounded ${quickDurationMode === 'CUSTOM_UNIT' ? 'bg-emerald-600 text-white' : 'text-slate-600'}`}
                      >
                        Kustom
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickDurationMode('EXACT_DATETIME')}
                        className={`px-2 py-0.5 rounded ${quickDurationMode === 'EXACT_DATETIME' ? 'bg-emerald-600 text-white' : 'text-slate-600'}`}
                      >
                        Jam Tepat
                      </button>
                    </div>
                  </div>

                  {quickDurationMode === 'PRESET' && (
                    <select
                      value={quickPermitForm.durasiJam}
                      onChange={(e) => setQuickPermitForm({ ...quickPermitForm, durasiJam: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 font-bold text-xs"
                    >
                      <option value="1">1 Jam</option>
                      <option value="2">2 Jam</option>
                      <option value="3">3 Jam</option>
                      <option value="5">5 Jam</option>
                      <option value="8">8 Jam (Hari ini)</option>
                      <option value="24">1 Hari</option>
                      <option value="72">3 Hari</option>
                    </select>
                  )}

                  {quickDurationMode === 'CUSTOM_UNIT' && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={quickCustomVal}
                        onChange={(e) => setQuickCustomVal(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-20 bg-white border border-slate-300 rounded-xl p-2 text-center text-xs font-bold"
                      />
                      <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-slate-200 text-xs">
                        {['MENIT', 'JAM', 'HARI'].map(u => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => setQuickCustomUnit(u)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${quickCustomUnit === u ? 'bg-emerald-600 text-white' : 'text-slate-600'}`}
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {quickDurationMode === 'EXACT_DATETIME' && (
                    <input
                      type="datetime-local"
                      value={quickCustomDateTime}
                      onChange={(e) => setQuickCustomDateTime(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold"
                    />
                  )}

                  <div className="bg-emerald-950 text-emerald-200 text-[11px] p-2.5 rounded-xl flex items-center justify-between font-mono">
                    <span>ESTIMASI KEMBALI:</span>
                    <b className="text-white">{getQuickCalculatedBatas().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB ({Math.round((getQuickCalculatedBatas() - Date.now()) / 60000)} Menit)</b>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1 text-xs">Penjemput</label>
                    <input
                      type="text"
                      value={quickPermitForm.penjemput}
                      onChange={(e) => setQuickPermitForm({ ...quickPermitForm, penjemput: e.target.value })}
                      placeholder="Contoh: Mandiri / Wali Santri"
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-medium"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons Footer (sticky/pinned) */}
            <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setQuickPermitSantri(null)}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={() => handleSaveQuickPermit(false)}
                className="w-full sm:flex-1 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Terbitkan Izin Saja (APPROVED)</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveQuickPermit(true)}
                className="w-full sm:flex-1 py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition shadow-md shadow-emerald-950/20"
              >
                <DoorOpen className="w-3.5 h-3.5 text-gold-300" />
                <span>⚡ Buka Gerbang Langsung</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
        <div className="bg-slate-50 rounded-3xl max-w-5xl w-full p-4 sm:p-6 shadow-2xl border border-slate-300 max-h-[92vh] overflow-y-auto">
          {content}
        </div>
      </div>
    );
  }

  return content;
}
