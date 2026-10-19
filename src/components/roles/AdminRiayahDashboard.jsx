import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Building2, 
  Users, 
  CreditCard, 
  PlusCircle, 
  Wrench, 
  ShieldAlert, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Radio, 
  Search, 
  Edit3, 
  Sparkles, 
  RefreshCw, 
  Check, 
  X, 
  UserPlus, 
  PhoneCall, 
  Home, 
  Layers, 
  RotateCcw,
  Wifi,
  Trash2,
  Unlock,
  Lock,
  ChevronRight,
  ArrowRight,
  Zap,
  ClipboardList,
  FileText,
  Printer,
  Smartphone
} from 'lucide-react';
import { sound } from '../../utils/audio';
import RfidCardManager from '../modules/RfidCardManager';
import ExpressPermitKiosk from '../modules/ExpressPermitKiosk';
import RealtimeGateLogsManager from '../modules/RealtimeGateLogsManager';
import FonnteDeviceManager from '../modules/FonnteDeviceManager';
import SantriActivityAnalytics from '../modules/SantriActivityAnalytics';

export default function AdminRiayahDashboard() {
  const { 
    rooms, 
    addRoom, 
    updateRoomCapacity, 
    addBuilding, 
    santriList, 
    addNewSantri, 
    replaceLostCard, 
    blacklistedUids, 
    unblockCard, 
    linkCardToSantri,
    setHardwareScanCallback, 
    isSerialConnected,
    connectSerial,
    disconnectSerial,
    processRfidTap,
    activeRoleTab,
    setActiveRoleTab,
    lastScannedUid,
    setLastScannedUid,
    lastScannedTime,
    gateLogs,
    isFonnteEnabled
  } = useApp();

  const activeTab = (activeRoleTab === 'rooms' || activeRoleTab === 'onboarding' || activeRoleTab === 'lost_card' || activeRoleTab === 'blacklist' || activeRoleTab === 'rfid_cards' || activeRoleTab === 'rfid_pairing' || activeRoleTab === 'express_kiosk' || activeRoleTab === 'gate_logs' || activeRoleTab === 'whatsapp_manager' || activeRoleTab === 'ai_analytics') ? activeRoleTab : 'rooms';
  const setActiveTab = setActiveRoleTab;
  const [selectedGenderFilter, setSelectedGenderFilter] = useState('ALL'); // 'ALL' | 'PUTRA' | 'PUTRI'
  
  // Room Edit Modal
  const [editingRoom, setEditingRoom] = useState(null);
  const [newCapacityInput, setNewCapacityInput] = useState('');
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [newRoomForm, setNewRoomForm] = useState({
    namaGedung: 'Asrama Putra Umar bin Khattab',
    kategoriGedung: 'PUTRA',
    nomorKamar: 'Kamar 205',
    lantai: 2,
    kapasitas: 10,
    ketuaKamar: '',
    catatanInspeksi: 'Kamar baru siap huni.'
  });

  // Onboarding Form
  const [onboardingForm, setOnboardingForm] = useState({
    nama: '',
    nis: '',
    gender: 'L',
    kamar: '',
    rfidUid: '',
    waliNama: '',
    waliHubungan: 'Orang Tua Kandung',
    waliTelepon: '',
    alamat: 'Surabaya',
    saldoAwal: 100000,
    tahfidzAwal: 1,
    penyakitKhusus: '-'
  });

  // Lost Card Replacement Form
  const [replacementForm, setReplacementForm] = useState({
    santriId: '',
    newUid: '',
    reason: 'Kartu fisik dilaporkan hilang di area pesantren'
  });

  // Hardware Scan Active Mode ('onboarding' | 'replacement' | null)
  const [activeScanMode, setActiveScanMode] = useState(null);

  // 1. Reactive Auto-fill newUid whenever an RFID card is tapped while on lost_card tab
  useEffect(() => {
    if (activeTab === 'lost_card' && lastScannedUid) {
      setReplacementForm(prev => {
        if (prev.newUid !== lastScannedUid) {
          sound.playSuccess();
          return { ...prev, newUid: lastScannedUid };
        }
        return prev;
      });
    }
  }, [lastScannedTime, lastScannedUid, activeTab]);

  // 2. Reactive Auto-fill rfidUid whenever an RFID card is tapped while on onboarding tab
  useEffect(() => {
    if (activeTab === 'onboarding' && lastScannedUid) {
      setOnboardingForm(prev => {
        if (prev.rfidUid !== lastScannedUid) {
          sound.playSuccess();
          return { ...prev, rfidUid: lastScannedUid };
        }
        return prev;
      });
    }
  }, [lastScannedTime, lastScannedUid, activeTab]);

  // 3. Set hardware scanner direct callback when in activeScanMode or when on onboarding / lost_card tab
  useEffect(() => {
    if (activeScanMode === 'onboarding' || activeTab === 'onboarding') {
      setHardwareScanCallback((scannedUid) => {
        setOnboardingForm(prev => ({ ...prev, rfidUid: scannedUid }));
        setActiveScanMode(null);
        sound.playSuccess();
      });
    } else if (activeScanMode === 'replacement' || activeTab === 'lost_card') {
      setHardwareScanCallback((scannedUid) => {
        setReplacementForm(prev => ({ ...prev, newUid: scannedUid }));
        setActiveScanMode(null);
        sound.playSuccess();
      });
    } else {
      setHardwareScanCallback(null);
    }

    return () => setHardwareScanCallback(null);
  }, [activeScanMode, activeTab, setHardwareScanCallback]);

  const handleSimulateCardTap = (targetUid = null) => {
    sound.playSuccess();
    const generatedUid = targetUid || [
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0'),
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0'),
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0'),
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
    ].join(':').toUpperCase();

    if (setLastScannedUid) {
      setLastScannedUid(generatedUid);
    }

    if (activeTab === 'lost_card') {
      setReplacementForm(prev => ({ ...prev, newUid: generatedUid }));
      setActiveScanMode(null);
    } else {
      setOnboardingForm(prev => ({ ...prev, rfidUid: generatedUid }));
      setActiveScanMode(null);
    }
  };

  // Filtered rooms
  const filteredRooms = rooms.filter(r => {
    if (selectedGenderFilter === 'ALL') return true;
    return r.kategoriGedung === selectedGenderFilter;
  });

  // Total Statistics
  const totalKapasitas = rooms.reduce((acc, r) => acc + (r.kapasitas || 0), 0);
  const totalTerisi = santriList.length;
  const sisaSlot = Math.max(0, totalKapasitas - totalTerisi);

  // Available rooms for Onboarding gender
  const availableRoomsForOnboarding = rooms.filter(r => {
    const isGenderMatch = onboardingForm.gender === 'P' ? r.kategoriGedung === 'PUTRI' : r.kategoriGedung === 'PUTRA';
    return isGenderMatch && (r.terisi < r.kapasitas);
  });

  // Handle Submit Onboarding
  const handleOnboardingSubmit = (e) => {
    e.preventDefault();
    if (!onboardingForm.nama || !onboardingForm.waliNama || !onboardingForm.waliTelepon) {
      alert('Harap isi Nama Santri, Nama Wali, dan Nomor WhatsApp Wali!');
      return;
    }

    if (!onboardingForm.kamar) {
      alert('Harap pilih kamar asrama untuk santri baru!');
      return;
    }

    addNewSantri(onboardingForm);

    alert(`Pendaftaran santri baru "${onboardingForm.nama}" BERHASIL! Akun, kartu RFID, dan kamar asrama telah tersinkron.`);
    setOnboardingForm({
      nama: '',
      nis: '',
      gender: 'L',
      kamar: '',
      rfidUid: '',
      waliNama: '',
      waliHubungan: 'Orang Tua Kandung',
      waliTelepon: '',
      alamat: 'Surabaya',
      saldoAwal: 100000,
      tahfidzAwal: 1,
      penyakitKhusus: '-'
    });
  };

  // Handle Lost Card Replacement Submit
  const handleReplacementSubmit = (e) => {
    e.preventDefault();
    if (!replacementForm.santriId) {
      alert('Harap pilih santri yang kehilangan kartu!');
      return;
    }
    if (!replacementForm.newUid) {
      alert('Harap tap atau masukkan UID kartu baru pengganti!');
      return;
    }

    const res = replaceLostCard(replacementForm.santriId, replacementForm.newUid, replacementForm.reason);
    if (res.success) {
      alert('Kartu lama berhasil DIBLOKIR! Kartu pengganti baru telah aktif terikat dengan profil santri.');
      setReplacementForm({
        santriId: '',
        newUid: '',
        reason: 'Kartu fisik dilaporkan hilang di area pesantren'
      });
    } else {
      alert(`Gagal ganti kartu: ${res.error}`);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-24">
      
      {/* 1. Header Admin Ri'ayah */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-xs">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Admin Ri'ayah & Setting Builder
              </h1>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 font-mono font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                MASTER ASRAMA & RFID
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Tata Kelola Kapasitas Kamar Asrama (Putra & Putri), Onboarding Santri Baru, & Layanan Kartu Hilang (Revocation)
            </p>
          </div>
        </div>

        {/* Quick Summary Pill & Quick WA Gateway Shortcut */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 text-xs font-mono flex items-center gap-3 shadow-xs">
            <div>
              <span className="text-slate-400 block text-[10px]">TOTAL TERISI</span>
              <span className="text-emerald-700 font-bold">{totalTerisi} Santri</span>
            </div>
            <div className="w-px h-6 bg-slate-200" />
            <div>
              <span className="text-slate-400 block text-[10px]">KUOTA KOSONG</span>
              <span className="text-cyan-700 font-bold">{sisaSlot} Kasur</span>
            </div>
            <div className="w-px h-6 bg-slate-200" />
            <div>
              <span className="text-slate-400 block text-[10px]">KARTU BLOKIR</span>
              <span className="text-rose-600 font-bold">{blacklistedUids.length} Kartu</span>
            </div>
          </div>

          <button
            onClick={() => { setActiveTab('whatsapp_manager'); sound.playBeep(); }}
            className={`px-3.5 py-2 rounded-xl border text-xs font-mono flex items-center gap-2 transition shadow-xs ${
              activeTab === 'whatsapp_manager'
                ? 'bg-emerald-600 border-emerald-700 text-white'
                : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-800'
            }`}
            title="Buka Embedded Fonnte WhatsApp Device & QR Manager"
          >
            <Smartphone className="w-4 h-4 text-emerald-600" />
            <div className="text-left">
              <span className="text-[10px] block leading-tight font-bold">WA GATEWAY</span>
              <span className="font-bold text-[11px]">{isFonnteEnabled ? 'FONNTE LIVE' : 'SIMULASI'}</span>
            </div>
          </button>
        </div>
      </div>

      {/* 2. Navigation Tabs (Clean Responsive Horizontal Bar) */}
      <div className="scroll-row border-b border-slate-200 gap-1 pb-1 text-xs">
        <button
          onClick={() => { setActiveTab('rooms'); setActiveScanMode(null); }}
          className={`flex items-center gap-2 py-2.5 px-3.5 font-bold transition rounded-t-xl shrink-0 ${
            activeTab === 'rooms'
              ? 'border-b-2 border-emerald-600 text-emerald-800 bg-emerald-50/70'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>1. Kamar Asrama</span>
        </button>

        <button
          onClick={() => { setActiveTab('onboarding'); setActiveScanMode(null); }}
          className={`flex items-center gap-2 py-2.5 px-3.5 font-bold transition rounded-t-xl shrink-0 ${
            activeTab === 'onboarding'
              ? 'border-b-2 border-emerald-600 text-emerald-800 bg-emerald-50/70'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>2. Onboarding Santri</span>
        </button>

        <button
          onClick={() => { setActiveTab('lost_card'); setActiveScanMode(null); }}
          className={`flex items-center gap-2 py-2.5 px-3.5 font-bold transition rounded-t-xl shrink-0 ${
            activeTab === 'lost_card'
              ? 'border-b-2 border-emerald-600 text-emerald-800 bg-emerald-50/70'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>3. Kartu Hilang (Revoke)</span>
        </button>

        <button
          onClick={() => { setActiveTab('blacklist'); setActiveScanMode(null); }}
          className={`flex items-center gap-2 py-2.5 px-3.5 font-bold transition rounded-t-xl shrink-0 ${
            activeTab === 'blacklist'
              ? 'border-b-2 border-emerald-600 text-emerald-800 bg-emerald-50/70'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>4. Kartu Blokir ({blacklistedUids.length})</span>
        </button>

        <button
          onClick={() => { setActiveTab('rfid_cards'); setActiveScanMode(null); }}
          className={`flex items-center gap-2 py-2.5 px-3.5 font-bold transition rounded-t-xl shrink-0 ${
            activeTab === 'rfid_cards'
              ? 'border-b-2 border-emerald-600 text-emerald-800 bg-emerald-50/70'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          }`}
        >
          <CreditCard className="w-4 h-4 text-emerald-600" />
          <span>5. Tabel Kartu ({santriList.length})</span>
        </button>

        <button
          onClick={() => { setActiveTab('rfid_pairing'); setActiveScanMode(null); }}
          className={`flex items-center gap-2 py-2.5 px-3.5 font-bold transition rounded-t-xl shrink-0 ${
            activeTab === 'rfid_pairing'
              ? 'border-b-2 border-cyan-600 text-cyan-800 bg-cyan-50/70'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          }`}
        >
          <Radio className="w-4 h-4 text-cyan-600" />
          <span>6. Scanner RC522</span>
        </button>

        <button
          onClick={() => { setActiveTab('express_kiosk'); setActiveScanMode(null); }}
          className={`flex items-center gap-2 py-2.5 px-3.5 font-bold transition rounded-t-xl shrink-0 ${
            activeTab === 'express_kiosk'
              ? 'border-b-2 border-amber-600 text-amber-800 bg-amber-50/70 font-black'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          }`}
        >
          <Zap className="w-4 h-4 text-amber-500" />
          <span>7. Kiosk Izin Cepat</span>
        </button>

        <button
          onClick={() => { setActiveTab('gate_logs'); setActiveScanMode(null); }}
          className={`flex items-center gap-2 py-2.5 px-3.5 font-bold transition rounded-t-xl shrink-0 ${
            activeTab === 'gate_logs'
              ? 'border-b-2 border-emerald-600 text-emerald-800 bg-emerald-50/70 font-black'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          }`}
        >
          <ClipboardList className="w-4 h-4 text-emerald-600" />
          <span>8. Log & Cetak ({gateLogs.length})</span>
        </button>

        <button
          onClick={() => { setActiveTab('whatsapp_manager'); setActiveScanMode && setActiveScanMode(null); }}
          className={`flex items-center gap-2 py-2.5 px-3.5 font-bold transition rounded-t-xl shrink-0 ${
            activeTab === 'whatsapp_manager'
              ? 'border-b-2 border-emerald-600 text-emerald-800 bg-emerald-50/70 font-black'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          }`}
        >
          <Smartphone className="w-4 h-4 text-emerald-600" />
          <span>9. Fonnte WA Gateway</span>
        </button>

        <button
          onClick={() => { setActiveTab('ai_analytics'); setActiveScanMode && setActiveScanMode(null); }}
          className={`flex items-center gap-2 py-2.5 px-3.5 font-bold transition rounded-t-xl shrink-0 ${
            activeTab === 'ai_analytics'
              ? 'border-b-2 border-indigo-600 text-indigo-800 bg-indigo-50/70 font-black'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          }`}
        >
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <span>10. AI Evaluasi Santri</span>
        </button>
      </div>

      {/* BUILDER 1: PENGATURAN KAPASITAS GEDUNG & KAMAR */}
      {activeTab === 'rooms' && (
        <div className="space-y-6">
          
          {/* Top Filter & Add Room Action */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/90 p-4 rounded-xl shadow-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-600 mr-1">Kategori Asrama:</span>
              <button
                onClick={() => setSelectedGenderFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  selectedGenderFilter === 'ALL'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Semua Asrama ({rooms.length})
              </button>
              <button
                onClick={() => setSelectedGenderFilter('PUTRA')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  selectedGenderFilter === 'PUTRA'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Asrama Putra (Santri)
              </button>
              <button
                onClick={() => setSelectedGenderFilter('PUTRI')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  selectedGenderFilter === 'PUTRI'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Asrama Putri (Santriwati)
              </button>
            </div>

            <button
              onClick={() => setShowAddRoomModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Tambah Kamar Baru</span>
            </button>
          </div>

          {/* Room Cards Grid with Live Occupancy Progress Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredRooms.map((room) => {
              const capacity = room.kapasitas || 8;
              const occupied = santriList.filter(s => s.kamar.toLowerCase().includes(room.nomorKamar.toLowerCase()) || room.nomorKamar.toLowerCase().includes(s.kamar.toLowerCase())).length || room.terisi || 0;
              const percent = Math.min(100, Math.round((occupied / capacity) * 100));
              const isFull = occupied >= capacity;
              const isPutri = room.kategoriGedung === 'PUTRI';

              return (
                <div 
                  key={room.id}
                  className={`bg-white border rounded-2xl p-5 shadow-xs hover:shadow-sm space-y-4 transition ${
                    isPutri ? 'border-teal-200' : 'border-emerald-200'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                        isPutri 
                          ? 'bg-teal-50 text-teal-800 border-teal-200' 
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}>
                        {isPutri ? 'ASRAMA PUTRI (SANTRIWATI)' : 'ASRAMA PUTRA (SANTRI)'}
                      </span>
                      <h4 className="text-base font-black text-slate-900 mt-1">
                        {room.nomorKamar} — Lt. {room.lantai}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {room.namaGedung}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setEditingRoom(room);
                        setNewCapacityInput(String(room.kapasitas));
                      }}
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition"
                      title="Edit Kapasitas Kamar"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Occupancy Indicator Bar */}
                  <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-500">Keterisian:</span>
                      <span className={`font-bold ${isFull ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {occupied} / {capacity} Kasur ({percent}%)
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          isFull 
                            ? 'bg-rose-500' 
                            : percent > 80 
                            ? 'bg-amber-500' 
                            : 'bg-emerald-600'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                      <span>Sisa Kuota: <b className="text-slate-800">{Math.max(0, capacity - occupied)} kasur</b></span>
                      <span>Ketua: <b className="text-slate-800">{room.ketuaKamar}</b></span>
                    </div>
                  </div>

                  {/* Sanitasi & Kebersihan */}
                  <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-800 font-bold block mb-0.5">Catatan Inspeksi:</span>
                    <p className="line-clamp-2 text-slate-500">{room.catatanInspeksi}</p>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* BUILDER 2: ONBOARDING SANTRI / SANTRIWATI BARU */}
      {activeTab === 'onboarding' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs max-w-4xl mx-auto space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <UserPlus className="w-6 h-6 text-emerald-600" />
              <h3 className="text-lg font-black text-slate-900">
                Formulir Onboarding Santri / Santriwati Baru Masuk Pondok
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Daftarkan santri baru ke database, tempatkan di kamar asrama berkuota, dan tautkan kartu fisik RFID dari alat ESP32-S3.
            </p>
          </div>

          <form onSubmit={handleOnboardingSubmit} className="space-y-6 text-xs">
            
            {/* Step 1: Identitas Santri & Gender */}
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
                1. Identitas Santri & Kategori Gender
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-slate-700 mb-1 font-semibold">Nama Lengkap Santri</label>
                  <input
                    type="text"
                    value={onboardingForm.nama}
                    onChange={(e) => setOnboardingForm({ ...onboardingForm, nama: e.target.value })}
                    placeholder="contoh: Muhammad Danial Hakim"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1 font-semibold">Nomor Induk Santri (NIS)</label>
                  <input
                    type="text"
                    value={onboardingForm.nis}
                    onChange={(e) => setOnboardingForm({ ...onboardingForm, nis: e.target.value })}
                    placeholder="contoh: 125462"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Gender Selection with Automatic Avatar Preview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-slate-700 mb-1 font-semibold">Kategori Gender</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setOnboardingForm({ ...onboardingForm, gender: 'L', kamar: '' })}
                      className={`p-3 rounded-2xl border flex items-center gap-3 transition ${
                        onboardingForm.gender === 'L'
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-900 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <img 
                        src="/images/avatar_santri_putra.jpg" 
                        alt="Santri Putra" 
                        className="w-10 h-10 rounded-full object-cover border border-emerald-400" 
                      />
                      <div className="text-left">
                        <span className="font-bold block text-xs">Santri (Putra)</span>
                        <span className="text-[10px] text-emerald-700">Asrama Putra</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOnboardingForm({ ...onboardingForm, gender: 'P', kamar: '' })}
                      className={`p-3 rounded-2xl border flex items-center gap-3 transition ${
                        onboardingForm.gender === 'P'
                          ? 'bg-teal-50 border-teal-400 text-teal-900 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <img 
                        src="/images/avatar_santri_putri.jpg" 
                        alt="Santriwati Putri" 
                        className="w-10 h-10 rounded-full object-cover border border-teal-400" 
                      />
                      <div className="text-left">
                        <span className="font-bold block text-xs">Santriwati (Putri)</span>
                        <span className="text-[10px] text-teal-700">Asrama Putri</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Room Placement Dropdown */}
                <div>
                  <label className="block text-slate-700 mb-1 font-semibold">Penempatan Kamar Asrama</label>
                  <select
                    value={onboardingForm.kamar}
                    onChange={(e) => setOnboardingForm({ ...onboardingForm, kamar: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    required
                  >
                    <option value="">-- Pilih Kamar Berkuota Kosong --</option>
                    {availableRoomsForOnboarding.map((r) => {
                      const sisa = r.kapasitas - r.terisi;
                      return (
                        <option key={r.id} value={`${r.namaGedung} - ${r.nomorKamar}`}>
                          {r.namaGedung} ({r.nomorKamar}) — Sisa Kuota: {sisa} kasur
                        </option>
                      );
                    })}
                  </select>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    *Kamar otomatis difilter sesuai gender (Putra/Putri) dan hanya menampilkan kamar dengan kuota tersedia.
                  </span>
                </div>
              </div>
            </div>

            {/* Step 2: Integrasi Scan Kartu RFID Baru & Auto-Fill UID (White & Clean Theme) */}
            <div className="bg-slate-50/80 p-5 sm:p-6 rounded-2xl border border-slate-200 space-y-5 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                      2. Tautkan Kartu Pintar RFID RC522 (13.56 MHz)
                    </span>
                    <span className="text-[10px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                      AUTO-DETECT ON TAP
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Tempelkan kartu fisik baru ke reader RC522 di ESP32-S3 atau gunakan tombol simulasi tap di bawah. UID akan langsung terisi otomatis!
                  </p>
                </div>

                {/* Scan Button from IoT */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSimulateCardTap()}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition"
                    title="Simulasikan tempel kartu fisik baru"
                  >
                    <Zap className="w-4 h-4 text-amber-300" />
                    <span>⚡ Tap Kartu Baru (Auto-Detect)</span>
                  </button>

                  {lastScannedUid && lastScannedUid !== onboardingForm.rfidUid && (
                    <button
                      type="button"
                      onClick={() => handleSimulateCardTap(lastScannedUid)}
                      className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-mono font-bold rounded-xl transition shadow-xs"
                      title="Gunakan UID yang baru saja ditempelkan"
                    >
                      <span>Gunakan UID: {lastScannedUid}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Status Banner */}
              {onboardingForm.rfidUid ? (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <div className="font-bold text-sm text-emerald-950">
                        KARTU RFID TERDETEKSI: <span className="font-mono text-emerald-700 tracking-wider font-black">{onboardingForm.rfidUid}</span>
                      </div>
                      <p className="text-[11px] text-emerald-800 mt-0.5">
                        Kartu fisik 13.56 MHz terverifikasi dan siap diaktivasi menjadi kartu identitas resmi santri/wati.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOnboardingForm(prev => ({ ...prev, rfidUid: '' }))}
                    className="text-xs text-rose-600 hover:text-rose-800 font-bold underline ml-2"
                  >
                    Ganti Kartu
                  </button>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs flex items-center gap-2.5 shadow-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                  <span>Reader RC522 Standby: Tempelkan kartu fisik santri ke alat IoT ESP32-S3 atau klik tombol "⚡ Tap Kartu Baru" di atas...</span>
                </div>
              )}

              {/* Input Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 mb-1 font-semibold text-xs">
                    Kode UID Kartu RFID (Otomatis Terisi saat Tap)
                  </label>
                  <input
                    type="text"
                    value={onboardingForm.rfidUid}
                    onChange={(e) => setOnboardingForm({ ...onboardingForm, rfidUid: e.target.value.toUpperCase() })}
                    placeholder="contoh: 53:57:98:0F"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-mono text-sm font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    required
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    *Tersinkron dengan frekuensi kartu Mifare Classic 13.56 MHz.
                  </span>
                </div>

                <div>
                  <label className="block text-slate-700 mb-1 font-semibold text-xs">Saldo Awal Kartu Dompet Pintar (Rp)</label>
                  <input
                    type="number"
                    value={onboardingForm.saldoAwal}
                    onChange={(e) => setOnboardingForm({ ...onboardingForm, saldoAwal: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    *Dapat digunakan transaksi di Kantin & Koperasi Pesantren.
                  </span>
                </div>
              </div>

              {/* LIVE DIGITAL SMART CARD IDENTITY PREVIEW */}
              <div className="pt-3 border-t border-slate-200">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-2.5">
                  PRATINJAU KARTU IDENTITAS RESMI SANTRI (SMART CARD 13.56 MHz):
                </span>
                
                <div className="max-w-md bg-white border-2 border-emerald-500/80 rounded-2xl p-4 shadow-sm relative overflow-hidden text-slate-800 font-sans">
                  {/* Subtle watermarked badge */}
                  <div className="absolute -right-4 -bottom-4 w-28 h-28 rounded-full border-4 border-emerald-100 flex items-center justify-center font-serif font-black text-emerald-100/60 text-6xl pointer-events-none select-none">
                    DU
                  </div>

                  <div className="flex items-center justify-between border-b border-emerald-100 pb-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center font-serif font-black text-white text-xs shadow-xs">
                        DU
                      </div>
                      <div>
                        <div className="text-[10px] font-black tracking-wider uppercase leading-none text-emerald-950">PESANTREN MODERN DARUL ULUM</div>
                        <div className="text-[8px] text-emerald-700 font-mono font-semibold">SMART PERMIT & MULTI-PURPOSE CARD</div>
                      </div>
                    </div>
                    <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
                  </div>

                  <div className="flex items-center gap-3">
                    <img
                      src={onboardingForm.gender === 'P' ? '/images/avatar_santri_putri.jpg' : '/images/avatar_santri_putra.jpg'}
                      alt="Foto Santri"
                      className="w-14 h-16 rounded-xl object-cover border-2 border-emerald-200 shadow-xs shrink-0"
                    />
                    <div className="flex-1 space-y-0.5 text-xs">
                      <div className="font-black text-sm text-slate-900 tracking-wide">
                        {onboardingForm.nama || '(Nama Santri/Wati)'}
                      </div>
                      <div className="text-[11px] text-emerald-700 font-mono font-bold">
                        NIS: {onboardingForm.nis || 'OTOMATIS'} • {onboardingForm.gender === 'P' ? 'SANTRIWATI (P)' : 'SANTRI (L)'}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Kamar: <span className="font-semibold text-slate-900">{onboardingForm.kamar || '(Pilih Kamar di Atas)'}</span>
                      </div>
                      <div className="pt-1 flex items-center justify-between text-[10px] font-mono">
                        <span className="text-emerald-700 font-bold">
                          UID: {onboardingForm.rfidUid || 'MENUNGGU TAP...'}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          onboardingForm.rfidUid ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}>
                          {onboardingForm.rfidUid ? 'RESMI TERDAFTAR' : 'STANDBY'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Step 3: Data Wali Santri & WhatsApp Gateway */}
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
                3. Data Orang Tua / Wali Santri (Terkoneksi Live WhatsApp Gateway)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-700 mb-1 font-semibold">Nama Lengkap Wali</label>
                  <input
                    type="text"
                    value={onboardingForm.waliNama}
                    onChange={(e) => setOnboardingForm({ ...onboardingForm, waliNama: e.target.value })}
                    placeholder="contoh: Bapak H. Bambang Sugianto"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1 font-semibold">Hubungan Keluarga</label>
                  <input
                    type="text"
                    value={onboardingForm.waliHubungan}
                    onChange={(e) => setOnboardingForm({ ...onboardingForm, waliHubungan: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1 font-semibold">Nomor WhatsApp Wali</label>
                  <input
                    type="text"
                    value={onboardingForm.waliTelepon}
                    onChange={(e) => setOnboardingForm({ ...onboardingForm, waliTelepon: e.target.value })}
                    placeholder="0812-3456-7890"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-7 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs flex items-center gap-2 transition"
              >
                <Check className="w-4 h-4" />
                <span>Simpan & Daftarkan Santri Baru</span>
              </button>
            </div>

          </form>
        </div>
      )}

      {/* BUILDER 3: PENGGANTIAN KARTU HILANG / RUSAK (LOST CARD REPLACEMENT) */}
      {activeTab === 'lost_card' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs max-w-3xl mx-auto space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-rose-600" />
              <h3 className="text-lg font-black text-slate-900">
                Layanan Penggantian Kartu Hilang / Rusak (Card Revocation & Replacement)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Saat kartu santri dilaporkan hilang, UID lama akan langsung <b>DIBLOKIR</b> sehingga tidak dapat disalahgunakan di gerbang. Seluruh saldo, poin ri'ayah, dan riwayat santri tetap aman terikat ke UID baru.
            </p>
          </div>

          <form onSubmit={handleReplacementSubmit} className="space-y-5 text-xs">
            
            {/* Step 1: Select Santri */}
            <div>
              <label className="block text-slate-700 mb-1.5 font-bold">Pilih Santri yang Kehilangan Kartu</label>
              <select
                value={replacementForm.santriId}
                onChange={(e) => setReplacementForm({ ...replacementForm, santriId: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                required
              >
                <option value="">-- Pilih Nama Santri --</option>
                {santriList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nama} ({s.nis}) — Kamar: {s.kamar} — UID Saat Ini: [{s.rfidUid}]
                  </option>
                ))}
              </select>
            </div>

            {/* Display Selected Santri Card Information */}
            {replacementForm.santriId && (() => {
              const selectedSantri = santriList.find(s => s.id === replacementForm.santriId);
              if (!selectedSantri) return null;

              return (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-rose-800">
                    <span className="flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-rose-600" />
                      KARTU LAMA YANG AKAN DIBLOKIR:
                    </span>
                    <span className="font-mono bg-rose-100 px-2 py-0.5 rounded text-rose-800 border border-rose-300">
                      UID: {selectedSantri.rfidUid}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Jika kartu fisik lama [{selectedSantri.rfidUid}] di-tap di gerbang IoT, sistem anti-bypass akan langsung menolak dan menampilkan status <b>"KARTU DIBLOKIR / DILAPORKAN HILANG"</b> di layar Virtual OLED.
                  </p>
                </div>
              );
            })()}

            {/* Step 2: Reason */}
            <div>
              <label className="block text-slate-700 mb-1.5 font-bold">Alasan Penggantian Kartu</label>
              <input
                type="text"
                value={replacementForm.reason}
                onChange={(e) => setReplacementForm({ ...replacementForm, reason: e.target.value })}
                placeholder="contoh: Kartu terjatuh di lapangan dan hilang / chip retak"
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                required
              />
            </div>

            {/* Step 3: Scan Replacement Card */}
            <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-3.5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                    Tap Kartu RFID Fisik Pengganti yang Baru
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Gunakan kartu polos baru yang belum pernah terdaftar di sistem.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Status & Sambungkan USB Serial ESP32 */}
                  <button
                    type="button"
                    onClick={isSerialConnected ? disconnectSerial : connectSerial}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs ${
                      isSerialConnected 
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' 
                        : 'bg-rose-50 text-rose-800 border border-rose-300'
                    }`}
                    title={isSerialConnected ? "ESP32 Terhubung via USB Serial" : "Klik untuk menghubungkan USB Serial ESP32"}
                  >
                    <Wifi className="w-3.5 h-3.5" />
                    <span>{isSerialConnected ? '🟢 USB ESP32 Terhubung' : '🔌 Hubungkan USB ESP32'}</span>
                  </button>

                  {/* Tombol Auto-Detect / Simulasi Tap */}
                  <button
                    type="button"
                    onClick={() => handleSimulateCardTap()}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition"
                    title="Simulasikan tempel kartu fisik baru"
                  >
                    <Zap className="w-4 h-4 text-amber-300" />
                    <span>⚡ Tap Kartu Baru (Auto-Detect)</span>
                  </button>
                </div>
              </div>

              {/* Status Banner */}
              {replacementForm.newUid ? (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <div className="font-bold text-sm text-emerald-950">
                        KARTU PENGGANTI TERDETEKSI: <span className="font-mono text-emerald-700 tracking-wider font-black">{replacementForm.newUid}</span>
                      </div>
                      <p className="text-[11px] text-emerald-800 mt-0.5">
                        Kartu baru siap ditautkan menggantikan UID lama yang akan diblokir permanen.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplacementForm(prev => ({ ...prev, newUid: '' }))}
                    className="text-xs text-rose-600 hover:text-rose-800 font-bold underline ml-2"
                  >
                    Ganti Kartu
                  </button>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                    <span>
                      {isSerialConnected 
                        ? 'Modul RC522 Aktif: Silakan tempelkan kartu RFID baru ke reader ESP32-S3 sekarang...'
                        : 'Jika menggunakan alat IoT fisik, klik tombol "🔌 Hubungkan USB ESP32" di atas, atau klik "⚡ Tap Kartu Baru" untuk simulasi.'}
                    </span>
                  </div>

                  {lastScannedUid && lastScannedUid !== replacementForm.newUid && (
                    <button
                      type="button"
                      onClick={() => setReplacementForm(prev => ({ ...prev, newUid: lastScannedUid }))}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-mono font-bold rounded-lg shrink-0 transition"
                      title="Gunakan UID yang terakhir kali di-tap"
                    >
                      ⚡ Gunakan UID: {lastScannedUid}
                    </button>
                  )}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-600 text-xs font-semibold">
                    UID Kartu Pengganti Baru (Otomatis Terisi saat Tap)
                  </label>
                  {lastScannedUid && !replacementForm.newUid && (
                    <button
                      type="button"
                      onClick={() => setReplacementForm(prev => ({ ...prev, newUid: lastScannedUid }))}
                      className="text-[11px] text-emerald-700 hover:text-emerald-800 underline font-mono"
                    >
                      Pakai UID Terakhir: {lastScannedUid}
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={replacementForm.newUid}
                  onChange={(e) => setReplacementForm({ ...replacementForm, newUid: e.target.value.toUpperCase() })}
                  placeholder="contoh: 04:9A:8B:7C"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-mono text-sm font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  required
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-xs flex items-center justify-center gap-2 transition"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Blokir UID Kartu Lama & Tautkan Kartu Pengganti Baru</span>
              </button>
            </div>

          </form>
        </div>
      )}

      {/* BUILDER 4: DAFTAR KARTU DIBLOKIR (BLACKLIST / REVOCATION AUDIT) */}
      {activeTab === 'blacklist' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-500" />
                <span>Daftar Kartu RFID yang Diblokir (Revoked / Lost Card Audit)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Kartu-kartu di bawah ini akan langsung memicu alarm penolakan dan layar OLED SSD1306 "KARTU DIBLOKIR / DILAPORKAN HILANG" jika di-tap di gerbang.
              </p>
            </div>

            <span className="text-xs bg-rose-50 text-rose-700 font-mono font-bold px-3 py-1 rounded-full border border-rose-200">
              {blacklistedUids.length} Kartu Aktif Diblokir
            </span>
          </div>

          {blacklistedUids.length === 0 ? (
            <div className="p-8 text-center text-slate-400 italic text-xs">
              Tidak ada kartu yang sedang diblokir saat ini. Seluruh kartu santri berstatus normal.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-mono text-[10px]">
                    <th className="py-3 px-3 font-bold">UID Kartu Diblokir</th>
                    <th className="py-3 px-3 font-bold">Nama Santri Asal</th>
                    <th className="py-3 px-3 font-bold">Alasan Pemblokiran</th>
                    <th className="py-3 px-3 font-bold">Tanggal Laporan</th>
                    <th className="py-3 px-3 font-bold">Status Gate</th>
                    <th className="py-3 px-3 text-right font-bold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {blacklistedUids.map((b) => (
                    <tr key={b.id || b.uid} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-3 font-mono font-bold text-rose-600 text-sm">
                        {b.uid}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="font-bold text-slate-900">{b.santriNama}</span>
                      </td>
                      <td className="py-3.5 px-3 text-slate-600">
                        {b.reason}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-slate-500">
                        {b.date}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="text-[10px] bg-rose-50 text-rose-700 px-2.5 py-0.5 rounded-full border border-rose-200 font-bold">
                          DENIED / LOCKED
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {b.santriId && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Aktifkan kembali kartu UID ${b.uid} untuk santri ${b.santriNama}?`)) {
                                  linkCardToSantri(b.santriId, b.uid);
                                  unblockCard(b.uid);
                                  alert(`Kartu ${b.uid} berhasil dibuka blokirnya dan telah aktif kembali untuk ananda ${b.santriNama}!`);
                                }
                              }}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs"
                              title="Pulihkan dan tautkan kembali ke santri ini"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Pulihkan ke {b.santriNama?.split(' ')[0]}</span>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (window.confirm(`Buka blokir UID ${b.uid} (kartu bebas dan bisa ditautkan ke siapa saja)?`)) {
                                unblockCard(b.uid);
                              }
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs transition flex items-center gap-1 border border-slate-200"
                            title="Hapus dari daftar blokir / blacklist"
                          >
                            <Unlock className="w-3 h-3 text-amber-600" />
                            <span>Buka Blokir Saja</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* BUILDER 5: TABEL KARTU RFID TERDAFTAR (HALAMAN TERSENDIRI LENGKAP) */}
      {activeTab === 'rfid_cards' && (
        <div className="space-y-6 animate-fade-in">
          <RfidCardManager defaultView="table" isModal={false} />
        </div>
      )}

      {/* BUILDER 6: SCANNER & PASANGKAN KARTU RFID (HALAMAN TERSENDIRI LENGKAP) */}
      {activeTab === 'rfid_pairing' && (
        <div className="space-y-6 animate-fade-in">
          <RfidCardManager defaultView="pairing" isModal={false} />
        </div>
      )}

      {/* BUILDER 7: KIOSK IZIN CEPAT VIA RFID SCAN */}
      {activeTab === 'express_kiosk' && (
        <div className="space-y-6 animate-fade-in">
          <ExpressPermitKiosk />
        </div>
      )}

      {/* BUILDER 8: LOG AKTIVITAS KELUAR MASUK SANTRI REAL-TIME & CETAK PDF */}
      {activeTab === 'gate_logs' && (
        <div className="space-y-6 animate-fade-in">
          <RealtimeGateLogsManager />
        </div>
      )}

      {/* BUILDER 9: 📱 EMBEDDED FONNTE WHATSAPP DEVICE & QR MANAGER */}
      {activeTab === 'whatsapp_manager' && (
        <div className="space-y-6 animate-fade-in">
          <FonnteDeviceManager />
        </div>
      )}

      {/* BUILDER 10: AI EVALUASI SANTRI TERPADU & DEEPSEEK ENGINE */}
      {activeTab === 'ai_analytics' && (
        <div className="space-y-6 animate-fade-in">
          <SantriActivityAnalytics />
        </div>
      )}

      {/* MODAL: EDIT ROOM CAPACITY */}
      {editingRoom && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-xl max-h-[90vh] overflow-y-auto my-auto animate-fade-in text-slate-800">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-emerald-600" />
              <span>Edit Kapasitas {editingRoom.nomorKamar}</span>
            </h3>

            <p className="text-xs text-slate-500">
              Gedung: {editingRoom.namaGedung} ({editingRoom.kategoriGedung})
            </p>

            <div>
              <label className="block text-xs text-slate-700 mb-1 font-semibold">Kapasitas Maksimal Kasur</label>
              <input
                type="number"
                value={newCapacityInput}
                onChange={(e) => setNewCapacityInput(e.target.value)}
                min="1"
                max="50"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                *Contoh: ubah dari 10 menjadi 15 kasur sesuai penambahan ranjang baru.
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setEditingRoom(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs hover:bg-slate-200 transition font-medium"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  updateRoomCapacity(editingRoom.id, newCapacityInput);
                  setEditingRoom(null);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-xs"
              >
                Simpan Kapasitas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD NEW ROOM */}
      {showAddRoomModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-xl max-h-[90vh] overflow-y-auto my-auto animate-fade-in text-slate-800">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-emerald-600" />
              <span>Tambah Kamar Asrama Baru</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 mb-1 font-semibold">Kategori Asrama</label>
                <select
                  value={newRoomForm.kategoriGedung}
                  onChange={(e) => setNewRoomForm({ ...newRoomForm, kategoriGedung: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                >
                  <option value="PUTRA">Asrama Putra (Santri)</option>
                  <option value="PUTRI">Asrama Putri (Santriwati)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-semibold">Nama Gedung Asrama</label>
                <input
                  type="text"
                  value={newRoomForm.namaGedung}
                  onChange={(e) => setNewRoomForm({ ...newRoomForm, namaGedung: e.target.value })}
                  placeholder="contoh: Asrama Putri Siti Aisyah"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1 font-semibold">Nomor Kamar</label>
                  <input
                    type="text"
                    value={newRoomForm.nomorKamar}
                    onChange={(e) => setNewRoomForm({ ...newRoomForm, nomorKamar: e.target.value })}
                    placeholder="contoh: Kamar 101"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1 font-semibold">Kapasitas (Kasur)</label>
                  <input
                    type="number"
                    value={newRoomForm.kapasitas}
                    onChange={(e) => setNewRoomForm({ ...newRoomForm, kapasitas: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-semibold">Ketua Kamar / Musyrif Pendamping</label>
                <input
                  type="text"
                  value={newRoomForm.ketuaKamar}
                  onChange={(e) => setNewRoomForm({ ...newRoomForm, ketuaKamar: e.target.value })}
                  placeholder="contoh: Siti Maryam"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowAddRoomModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs hover:bg-slate-200 transition font-medium"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  addRoom(newRoomForm);
                  setShowAddRoomModal(false);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-xs"
              >
                Simpan Kamar Baru
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
