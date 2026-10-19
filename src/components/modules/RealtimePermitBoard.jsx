import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Zap, 
  Search, 
  Filter, 
  Printer, 
  Download, 
  Send, 
  Sparkles, 
  Home, 
  Compass, 
  ShieldCheck, 
  UserCheck, 
  Calendar, 
  ArrowRight, 
  Check, 
  X, 
  ExternalLink,
  Phone,
  DoorOpen,
  FileSpreadsheet,
  Building,
  RotateCcw
} from 'lucide-react';
import { sound } from '../../utils/audio';

export default function RealtimePermitBoard() {
  const { 
    santriList, 
    permits, 
    rooms, 
    reminderThresholdMinutes, 
    tapGateRFID, 
    sendEarlyWarningReminder, 
    sendWhatsAppNotification 
  } = useApp();

  const [activeTab, setActiveTab] = useState('board'); // 'board' (Papan Visual) | 'logbook' (Buku Induk Tabel)
  const [filterGender, setFilterGender] = useState('ALL'); // 'ALL' | 'L' (Putra) | 'P' (Putri)
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'ACTIVE' (OTW) | 'APPROVED' | 'OVERDUE' | 'COMPLETED' | 'DI_ASRAMA'
  const [filterKategori, setFilterKategori] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [showPrintPreviewModal, setShowPrintPreviewModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Live timer tick every 1 second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Live Formatted Date & Clock
  const currentDateObj = new Date(currentTime);
  const formattedTodayDate = currentDateObj.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const formattedClock = currentDateObj.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }) + ' WIB';

  // Helper to format ISO time
  const formatTimeOnly = (iso) => {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    } catch {
      return iso;
    }
  };

  const formatDateShort = (iso) => {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    } catch {
      return iso;
    }
  };

  // Compile Comprehensive Data: All Santri with their latest Permit Status
  const santriStatusData = santriList.map(santri => {
    // Find active permit
    const activePermit = permits.find(p => p.santriId === santri.id && (p.status === 'ACTIVE' || p.status === 'OVERDUE'));
    const approvedPermit = permits.find(p => p.santriId === santri.id && p.status === 'APPROVED');
    const completedPermit = permits.find(p => p.santriId === santri.id && p.status === 'COMPLETED');
    const pendingPermit = permits.find(p => p.santriId === santri.id && p.status === 'PENDING');

    const currentPermit = activePermit || approvedPermit || pendingPermit || completedPermit || null;

    let derivedStatus = 'DI_ASRAMA';
    if (activePermit) {
      derivedStatus = activePermit.status === 'OVERDUE' ? 'OVERDUE' : 'ACTIVE';
    } else if (approvedPermit) {
      derivedStatus = 'APPROVED';
    } else if (santri.statusAsrama === 'DI_LUAR' || santri.statusAsrama === 'TERLAMBAT') {
      derivedStatus = santri.statusAsrama === 'TERLAMBAT' ? 'OVERDUE' : 'ACTIVE';
    } else if (completedPermit && completedPermit.waktuKembaliAktual) {
      // Completed today
      derivedStatus = 'COMPLETED';
    }

    // Calculate countdown if active permit
    let remainingMs = 0;
    let isWarning = false;
    let isOverdue = false;
    if (activePermit && activePermit.batasKembali) {
      remainingMs = new Date(activePermit.batasKembali).getTime() - currentTime;
      isOverdue = remainingMs <= 0 || activePermit.status === 'OVERDUE';
      const remainingMinutes = remainingMs / 60000;
      isWarning = !isOverdue && remainingMinutes <= (reminderThresholdMinutes || 30);
    }

    return {
      santri,
      permit: currentPermit,
      activePermit,
      derivedStatus,
      isWarning,
      isOverdue,
      remainingMs
    };
  });

  // KPI Calculations
  const totalSantri = santriList.length;
  const countPutra = santriList.filter(s => s.gender === 'L').length;
  const countPutri = santriList.filter(s => s.gender === 'P').length;
  
  const diAsramaCount = santriStatusData.filter(d => d.derivedStatus === 'DI_ASRAMA').length;
  const siapKeluarCount = santriStatusData.filter(d => d.derivedStatus === 'APPROVED').length;
  const sedangKeluarOtwCount = santriStatusData.filter(d => d.derivedStatus === 'ACTIVE').length;
  const overdueCount = santriStatusData.filter(d => d.derivedStatus === 'OVERDUE').length;
  const kritisCount = santriStatusData.filter(d => d.isWarning).length;
  const completedCount = santriStatusData.filter(d => d.derivedStatus === 'COMPLETED').length;

  // Filtered List
  const filteredData = santriStatusData.filter(item => {
    const { santri, permit, derivedStatus, isWarning } = item;

    // Filter Gender
    if (filterGender === 'L' && santri.gender !== 'L') return false;
    if (filterGender === 'P' && santri.gender !== 'P') return false;

    // Filter Status
    if (filterStatus === 'ACTIVE' && derivedStatus !== 'ACTIVE') return false;
    if (filterStatus === 'APPROVED' && derivedStatus !== 'APPROVED') return false;
    if (filterStatus === 'OVERDUE' && derivedStatus !== 'OVERDUE') return false;
    if (filterStatus === 'WARNING' && !isWarning) return false;
    if (filterStatus === 'COMPLETED' && derivedStatus !== 'COMPLETED') return false;
    if (filterStatus === 'DI_ASRAMA' && derivedStatus !== 'DI_ASRAMA') return false;

    // Filter Kategori
    if (filterKategori !== 'ALL' && (!permit || permit.kategori.toLowerCase() !== filterKategori.toLowerCase())) {
      return false;
    }

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = santri.nama.toLowerCase().includes(q);
      const matchNis = santri.nis.includes(q);
      const matchUid = santri.rfidUid.toLowerCase().includes(q);
      const matchRoom = santri.kamar.toLowerCase().includes(q);
      const matchToken = permit && permit.tokenIzin ? permit.tokenIzin.toLowerCase().includes(q) : false;
      if (!matchName && !matchNis && !matchUid && !matchRoom && !matchToken) {
        return false;
      }
    }

    return true;
  });

  // Export CSV Data
  const handleExportCSV = () => {
    const headers = [
      'No',
      'Tanggal Izin',
      'Token Izin',
      'NIS',
      'Nama Santri',
      'Gender (L/P)',
      'Kelas',
      'Kamar Asrama',
      'Kategori',
      'Keperluan / Alasan',
      'Penjemput',
      'Waktu Keluar',
      'Batas Kembali',
      'Waktu Masuk',
      'Status Izin',
      'Musyrif Penyetuju'
    ];

    const rows = permits.map((p, idx) => {
      const s = santriList.find(item => item.id === p.santriId);
      return [
        idx + 1,
        formatDateShort(p.waktuKeluarRencana || p.waktuApproval),
        `"${p.tokenIzin || '-'}"`,
        `"${s?.nis || '-'}"`,
        `"${s?.nama || '-'}"`,
        s?.gender === 'L' ? 'Putra (L)' : 'Putri (P)',
        `"${s?.kelas || '-'}"`,
        `"${s?.kamar || '-'}"`,
        `"${p.kategori}"`,
        `"${(p.keperluan || '-').replace(/"/g, '""')}"`,
        `"${p.penjemput || 'Mandiri'}"`,
        formatTimeOnly(p.waktuKeluarAktual),
        formatTimeOnly(p.batasKembali),
        formatTimeOnly(p.waktuKembaliAktual),
        p.status,
        `"${p.musyrifPenyetuju || 'Ust. M. Syukron'}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `LogBook_Perizinan_Darul_Ulum_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    sound.playSuccess();
    showToast('File Log Book format CSV/Excel berhasil diunduh!');
  };

  // Trigger Print to PDF
  const handlePrintToPdf = () => {
    sound.playSuccess();
    window.print();
  };

  return (
    <div className="space-y-6 text-slate-800">
      
      {/* 1. Header Papan Realtime Hari Ini */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-950 text-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-emerald-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              PAPAN KONTROL REAL-TIME HARI INI
            </span>
            <span className="text-gold-300 text-xs flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Sinkronisasi Gerbang IoT ESP32-S3
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Papan Status Santri & Santriwati Hari Ini
          </h1>
          <p className="text-xs text-slate-300 max-w-2xl mt-1 leading-relaxed">
            Pantau santri yang sedang berada di asrama, siap melintas, sedang di luar/OTW di jalan, maupun yang sudah kembali secara real-time. Lengkap dengan Buku Induk Log Book yang siap dicetak ke format PDF.
          </p>
        </div>

        {/* Live Date & Digital Clock Card */}
        <div className="bg-slate-950/80 border border-emerald-500/30 rounded-2xl p-3.5 text-right font-mono shrink-0 shadow-lg">
          <div className="flex items-center justify-end gap-1.5 text-emerald-400 text-xs font-bold mb-0.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span>{formattedTodayDate}</span>
          </div>
          <div className="text-2xl font-black text-gold-300 tracking-wider">
            {formattedClock}
          </div>
          <span className="text-[10px] text-slate-400 uppercase tracking-widest block mt-0.5">
            WAKTU OPERASIONAL ASRAMA
          </span>
        </div>
      </div>

      {/* Success Toast */}
      {toastMessage && (
        <div className="bg-emerald-50 border-2 border-emerald-400 text-emerald-900 p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 shadow-md animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 2. Real-Time KPI Cards (6 Status Per Hari Ini) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Card 1: Di Asrama */}
        <div 
          onClick={() => setFilterStatus(filterStatus === 'DI_ASRAMA' ? 'ALL' : 'DI_ASRAMA')}
          className={`p-3.5 rounded-2xl border transition cursor-pointer ${
            filterStatus === 'DI_ASRAMA' 
              ? 'bg-slate-900 text-white border-slate-700 shadow-md ring-2 ring-emerald-500' 
              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase">DI ASRAMA</span>
            <Home className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">{diAsramaCount}</div>
          <span className="text-[10px] text-slate-500">Santri di Pondok</span>
        </div>

        {/* Card 2: Siap Keluar (Approved) */}
        <div 
          onClick={() => setFilterStatus(filterStatus === 'APPROVED' ? 'ALL' : 'APPROVED')}
          className={`p-3.5 rounded-2xl border transition cursor-pointer ${
            filterStatus === 'APPROVED' 
              ? 'bg-cyan-950 text-white border-cyan-700 shadow-md ring-2 ring-cyan-500' 
              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase">SIAP KELUAR</span>
            <UserCheck className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="text-2xl font-black text-cyan-600">{siapKeluarCount}</div>
          <span className="text-[10px] text-slate-500">Izin Approved</span>
        </div>

        {/* Card 3: OTW di Jalan / Sedang Keluar */}
        <div 
          onClick={() => setFilterStatus(filterStatus === 'ACTIVE' ? 'ALL' : 'ACTIVE')}
          className={`p-3.5 rounded-2xl border transition cursor-pointer ${
            filterStatus === 'ACTIVE' 
              ? 'bg-amber-950 text-white border-amber-600 shadow-md ring-2 ring-amber-500' 
              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase">OTW / DI JALAN</span>
            <Compass className="w-4 h-4 text-amber-500 animate-spin-slow" />
          </div>
          <div className="text-2xl font-black text-amber-600">{sedangKeluarOtwCount}</div>
          <span className="text-[10px] text-slate-500">Sedang di Luar</span>
        </div>

        {/* Card 4: Kritis (Mendekati Batas) */}
        <div 
          onClick={() => setFilterStatus(filterStatus === 'WARNING' ? 'ALL' : 'WARNING')}
          className={`p-3.5 rounded-2xl border transition cursor-pointer ${
            filterStatus === 'WARNING' 
              ? 'bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-300' 
              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase">H-{reminderThresholdMinutes || 30}M KRITIS</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700">{kritisCount}</div>
          <span className="text-[10px] text-slate-500">Alarm Aktif</span>
        </div>

        {/* Card 5: Terlambat / Overdue */}
        <div 
          onClick={() => setFilterStatus(filterStatus === 'OVERDUE' ? 'ALL' : 'OVERDUE')}
          className={`p-3.5 rounded-2xl border transition cursor-pointer ${
            filterStatus === 'OVERDUE' 
              ? 'bg-rose-950 text-white border-rose-600 shadow-md ring-2 ring-rose-500' 
              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase">TERLAMBAT</span>
            <AlertTriangle className="w-4 h-4 text-rose-600 animate-bounce" />
          </div>
          <div className="text-2xl font-black text-rose-600">{overdueCount}</div>
          <span className="text-[10px] text-slate-500">Melewati Batas</span>
        </div>

        {/* Card 6: Kembali Hari Ini (Completed) */}
        <div 
          onClick={() => setFilterStatus(filterStatus === 'COMPLETED' ? 'ALL' : 'COMPLETED')}
          className={`p-3.5 rounded-2xl border transition cursor-pointer ${
            filterStatus === 'COMPLETED' 
              ? 'bg-teal-950 text-white border-teal-600 shadow-md ring-2 ring-teal-500' 
              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase">SUDAH KEMBALI</span>
            <CheckCircle2 className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-black text-teal-600">{completedCount}</div>
          <span className="text-[10px] text-slate-500">Check-in Hari Ini</span>
        </div>
      </div>

      {/* 3. Navigation View Switcher (Papan Realtime vs Buku Log Book) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('board')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs transition ${
              activeTab === 'board'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/20'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>1. Papan Real-Time Hari Ini (Visual Board)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('logbook')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs transition ${
              activeTab === 'logbook'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/20'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>2. Buku Log Book Perizinan ({permits.length})</span>
          </button>
        </div>

        {/* Action Buttons: Export & Print PDF */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition shadow-xs"
            title="Download Log Book format CSV / Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">Export Excel / CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPrintPreviewModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-950/20 transition"
            title="Buka Lembar Dokumen Resmi & Cetak PDF"
          >
            <Printer className="w-4 h-4 text-gold-300" />
            <span>🖨️ Cetak Log Book (PDF)</span>
          </button>
        </div>
      </div>

      {/* 4. Filter & Search Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          {/* Gender Filter Buttons */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 mr-1 hidden sm:inline">Santri:</span>
            {[
              { id: 'ALL', label: `Semua (${totalSantri})` },
              { id: 'L', label: `Santri Putra (${countPutra})` },
              { id: 'P', label: `Santriwati Putri (${countPutri})` }
            ].map(g => (
              <button
                key={g.id}
                type="button"
                onClick={() => setFilterGender(g.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  filterGender === g.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          {/* Search Box & Category Select */}
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari nama santri, NIS, kamar, token..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={filterKategori}
              onChange={(e) => setFilterKategori(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">Semua Kategori</option>
              <option value="Pesiar">Pesiar</option>
              <option value="Pulang">Pulang</option>
              <option value="Berobat">Berobat</option>
              <option value="Urgent">Urgent</option>
            </select>

            {(filterStatus !== 'ALL' || filterGender !== 'ALL' || filterKategori !== 'ALL' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setFilterStatus('ALL');
                  setFilterGender('ALL');
                  setFilterKategori('ALL');
                  setSearchQuery('');
                }}
                className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl text-xs font-bold"
                title="Reset Semua Filter"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 5. TAB 1: PAPAN REAL-TIME HARI INI (VISUAL BOARD GRID) */}
      {activeTab === 'board' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
            <span>MENAMPILKAN: <b className="text-slate-800">{filteredData.length} Santri</b></span>
            <span>STATUS: SINKRON GATE TERAKHIR {formattedClock}</span>
          </div>

          {filteredData.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800">Tidak ada santri yang cocok dengan filter</h3>
              <p className="text-xs text-slate-500 mt-1">Coba sesuaikan kata kunci pencarian atau ubah filter status.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredData.map(({ santri, permit, derivedStatus, isWarning, isOverdue, remainingMs }) => {
                const diffMin = Math.round(remainingMs / 60000);

                return (
                  <div
                    key={santri.id}
                    className={`bg-white rounded-3xl border-2 p-5 shadow-sm transition flex flex-col justify-between ${
                      derivedStatus === 'OVERDUE' ? 'border-rose-400 bg-rose-50/20 shadow-rose-100' :
                      isWarning ? 'border-amber-400 bg-amber-50/20 shadow-amber-100 animate-pulse' :
                      derivedStatus === 'ACTIVE' ? 'border-amber-300 shadow-amber-50/50' :
                      derivedStatus === 'APPROVED' ? 'border-cyan-300 bg-cyan-50/10' :
                      'border-slate-200'
                    }`}
                  >
                    <div>
                      {/* Top Bar Card */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={santri.foto}
                            alt={santri.nama}
                            className="w-12 h-12 rounded-2xl object-cover border border-slate-300 shadow-xs shrink-0"
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-bold text-slate-900 text-sm leading-tight">
                                {santri.nama}
                              </h3>
                              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                santri.gender === 'L' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                              }`}>
                                {santri.gender === 'L' ? 'Putra' : 'Putri'}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500 block mt-0.5">
                              NIS: {santri.nis} • Kls {santri.kelas}
                            </span>
                            <span className="text-[10px] text-slate-600 font-mono block">
                              {santri.kamar}
                            </span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="text-right">
                          {derivedStatus === 'OVERDUE' && (
                            <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white animate-bounce shadow-xs">
                              🚨 TERLAMBAT
                            </span>
                          )}
                          {derivedStatus === 'ACTIVE' && isWarning && (
                            <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white animate-pulse shadow-xs">
                              ⚠️ H-{reminderThresholdMinutes}M KRITIS
                            </span>
                          )}
                          {derivedStatus === 'ACTIVE' && !isWarning && (
                            <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                              🚶‍♂️ DI JALAN (OTW)
                            </span>
                          )}
                          {derivedStatus === 'APPROVED' && (
                            <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-100 text-cyan-900 border border-cyan-300">
                              🎫 SIAP KELUAR
                            </span>
                          )}
                          {derivedStatus === 'COMPLETED' && (
                            <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-100 text-teal-800 border border-teal-300">
                              ✅ SUDAH KEMBALI
                            </span>
                          )}
                          {derivedStatus === 'DI_ASRAMA' && (
                            <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-300">
                              🏠 DI ASRAMA
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Detail Izin jika ada */}
                      {permit && (
                        <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 text-xs space-y-1.5 mb-3">
                          <div className="flex items-center justify-between font-mono text-[11px]">
                            <span className="text-slate-500">Kategori: <b className="text-slate-800">{permit.kategori}</b></span>
                            <span className="text-teal-700 font-bold">{permit.tokenIzin}</span>
                          </div>
                          <p className="text-slate-700 italic text-[11px] line-clamp-2">
                            "{permit.keperluan}"
                          </p>

                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-[11px] font-mono">
                            <div>
                              <span className="text-[10px] text-slate-400 block font-sans">Jam Keluar:</span>
                              <b className="text-slate-800">{formatTimeOnly(permit.waktuKeluarAktual || permit.waktuKeluarRencana)}</b>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block font-sans">Batas Kembali:</span>
                              <b className={isOverdue ? 'text-rose-600' : 'text-emerald-700'}>
                                {formatTimeOnly(permit.batasKembali)}
                              </b>
                            </div>
                          </div>

                          {/* Countdown Bar if ACTIVE */}
                          {derivedStatus === 'ACTIVE' && (
                            <div className={`mt-2 p-2 rounded-xl text-center font-mono text-xs font-bold ${
                              isOverdue ? 'bg-rose-100 text-rose-900 border border-rose-300' :
                              isWarning ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                              'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            }`}>
                              {isOverdue 
                                ? `MELEWATI BATAS: ${Math.abs(diffMin)} Menit` 
                                : `SISA WAKTU DI LUAR: ${diffMin} Menit`
                              }
                            </div>
                          )}
                        </div>
                      )}

                      {/* Info Wali Santri */}
                      <div className="text-[11px] text-slate-500 flex items-center justify-between mb-3 font-mono">
                        <span className="truncate max-w-[170px]">Wali: <b>{santri.wali?.nama}</b></span>
                        <span className="text-emerald-700 font-bold">{santri.wali?.telepon}</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                      {derivedStatus === 'ACTIVE' || derivedStatus === 'OVERDUE' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              tapGateRFID(santri.id, 'ENTRY');
                              showToast(`Check-In berhasil! ${santri.nama} telah kembali ke asrama.`);
                            }}
                            className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs"
                          >
                            <DoorOpen className="w-3.5 h-3.5" />
                            <span>Check-In Kembali</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              sendEarlyWarningReminder(permit?.id);
                              showToast(`Pesan pengingat dikirim ke WA ${santri.wali?.nama}`);
                            }}
                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
                            title="Kirim pesan WhatsApp pengingat ke wali"
                          >
                            <Send className="w-4 h-4 text-emerald-600" />
                          </button>
                        </>
                      ) : derivedStatus === 'APPROVED' ? (
                        <button
                          type="button"
                          onClick={() => {
                            tapGateRFID(santri.id, 'EXIT');
                            showToast(`Gerbang dibuka! ${santri.nama} melintas keluar.`);
                          }}
                          className="w-full py-2 px-3 bg-cyan-700 hover:bg-cyan-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                        >
                          <Zap className="w-3.5 h-3.5 text-gold-300" />
                          <span>Buka Gerbang (Tap Keluar)</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-mono text-center w-full py-1">
                          {derivedStatus === 'COMPLETED' ? 'Izin Hari Ini Telah Selesai Ditutup' : 'Santri Berada di Dalam Asrama'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 6. TAB 2: BUKU INDUK LOG BOOK PERIZINAN RESMI (TABEL) */}
      {activeTab === 'logbook' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-black text-slate-900">
                Buku Induk Log Book Perizinan Santri & Santriwati
              </h3>
              <p className="text-xs text-slate-500">
                Daftar arsip resmi seluruh permohonan izin keluar-masuk gerbang pesantren untuk pelaporan berkala.
              </p>
            </div>
            
            <span className="text-xs font-mono bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700">
              Total Arsip: <b>{permits.length} Data</b>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-slate-50 text-slate-600 font-black uppercase text-[10px] tracking-wider border-y border-slate-200">
                <tr>
                  <th className="py-3 px-3">No</th>
                  <th className="py-3 px-3">Token & Tgl</th>
                  <th className="py-3 px-3">Santri / Nis</th>
                  <th className="py-3 px-3">L/P</th>
                  <th className="py-3 px-3">Kelas & Asrama</th>
                  <th className="py-3 px-3">Kategori</th>
                  <th className="py-3 px-3">Keperluan</th>
                  <th className="py-3 px-3">Penjemput</th>
                  <th className="py-3 px-3">Keluar</th>
                  <th className="py-3 px-3">Batas Kembali</th>
                  <th className="py-3 px-3">Masuk</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Penyetuju</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px]">
                {permits.map((p, idx) => {
                  const s = santriList.find(item => item.id === p.santriId);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3 font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-3 font-mono">
                        <span className="font-bold text-slate-900 block">{p.tokenIzin}</span>
                        <span className="text-[10px] text-slate-500">{formatDateShort(p.waktuKeluarRencana || p.waktuApproval)}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-900 block">{s?.nama}</span>
                        <span className="text-[10px] text-slate-500 font-mono">NIS: {s?.nis}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          s?.gender === 'L' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                        }`}>
                          {s?.gender === 'L' ? 'L' : 'P'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="block font-medium text-slate-800">{s?.kelas}</span>
                        <span className="text-[10px] text-slate-500 truncate max-w-[120px] block">{s?.kamar}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold text-[10px]">
                          {p.kategori}
                        </span>
                      </td>
                      <td className="py-3 px-3 max-w-xs truncate text-slate-700" title={p.keperluan}>
                        {p.keperluan}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {p.penjemput || 'Mandiri'}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-700 font-bold">
                        {formatTimeOnly(p.waktuKeluarAktual)}
                      </td>
                      <td className="py-3 px-3 font-mono text-rose-700 font-bold">
                        {formatTimeOnly(p.batasKembali)}
                      </td>
                      <td className="py-3 px-3 font-mono text-emerald-700 font-bold">
                        {formatTimeOnly(p.waktuKembaliAktual)}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                          p.status === 'COMPLETED' ? 'bg-teal-100 text-teal-800' :
                          p.status === 'ACTIVE' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                          p.status === 'OVERDUE' ? 'bg-rose-100 text-rose-800 font-black' :
                          p.status === 'APPROVED' ? 'bg-cyan-100 text-cyan-800' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[10px] text-slate-600 truncate max-w-[100px]">
                        {p.musyrifPenyetuju || 'Ust. M. Syukron'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. MODAL PRATINJAU CETAK DOKUMEN LOG BOOK RESMI (PDF PREVIEW) */}
      {showPrintPreviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto no-print">
          <div className="bg-white rounded-3xl max-w-5xl w-full p-6 shadow-2xl border border-slate-300 space-y-5 animate-fade-in my-auto max-h-[92vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    Pratinjau Dokumen Cetak Log Book Perizinan (Format PDF Resmi)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Format siap cetak A4 Landscape lengkap dengan Kop Pesantren dan Kolom Tanda Tangan Pengasuhan.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintToPdf}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 transition"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak / Simpan PDF Sekarang</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPrintPreviewModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl border border-slate-200 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* DOCUMENT BODY PREVIEW */}
            <div className="border border-slate-300 rounded-2xl p-6 bg-slate-50 shadow-inner">
              
              {/* KOP SURAT RESMI PESANTREN */}
              <div className="text-center pb-4 border-b-2 border-double border-slate-800 mb-4">
                <h2 className="text-xl font-black uppercase tracking-wider text-slate-900 font-serif">
                  PESANTREN MODERN DARUL ULUM
                </h2>
                <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-800">
                  BIRO PENGASUHAN SANTRI & RI'AYAH ASRAMA PUTRA - PUTRI
                </h4>
                <p className="text-[10px] text-slate-600 mt-0.5">
                  Jl. Pesantren No. 01, Kompleks Smart Gate & RFID Ecosystem | Telp: (031) 8989-1234 | Email: riayah@darululum.ac.id
                </p>
                <div className="text-center font-bold text-xs uppercase bg-slate-200/80 py-1 rounded-md mt-2 tracking-widest border border-slate-400">
                  BUKU INDUK CATATAN LOG BOOK PERIZINAN KELUAR - MASUK SANTRI (HARIAN)
                </div>
                <div className="flex justify-between items-center text-[10px] font-mono text-slate-600 mt-1">
                  <span>Hari / Tanggal Cetak: <b>{formattedTodayDate}</b></span>
                  <span>Jam Cetak: <b>{formattedClock}</b></span>
                </div>
              </div>

              {/* TABLE DOCUMENT */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[10px] font-mono border-collapse border border-slate-400">
                  <thead>
                    <tr className="bg-slate-200 text-slate-900 text-center font-bold">
                      <th className="border border-slate-400 py-1.5 px-1 w-8">No</th>
                      <th className="border border-slate-400 py-1.5 px-2">Token Izin</th>
                      <th className="border border-slate-400 py-1.5 px-2">Nama Santri</th>
                      <th className="border border-slate-400 py-1.5 px-1">L/P</th>
                      <th className="border border-slate-400 py-1.5 px-2">Kelas / Kamar</th>
                      <th className="border border-slate-400 py-1.5 px-2">Kategori</th>
                      <th className="border border-slate-400 py-1.5 px-3">Keperluan & Alasan</th>
                      <th className="border border-slate-400 py-1.5 px-2">Jam Keluar</th>
                      <th className="border border-slate-400 py-1.5 px-2">Batas Jam</th>
                      <th className="border border-slate-400 py-1.5 px-2">Jam Masuk</th>
                      <th className="border border-slate-400 py-1.5 px-2">Status</th>
                      <th className="border border-slate-400 py-1.5 px-2">Penyetuju</th>
                    </tr>
                  </thead>
                  <tbody>
                    {permits.map((p, idx) => {
                      const s = santriList.find(item => item.id === p.santriId);
                      return (
                        <tr key={p.id} className="text-slate-800">
                          <td className="border border-slate-400 py-1 px-1 text-center font-bold">{idx + 1}</td>
                          <td className="border border-slate-400 py-1 px-2 font-bold">{p.tokenIzin}</td>
                          <td className="border border-slate-400 py-1 px-2 font-bold font-sans">{s?.nama}</td>
                          <td className="border border-slate-400 py-1 px-1 text-center">{s?.gender}</td>
                          <td className="border border-slate-400 py-1 px-2">{s?.kelas} - {s?.kamar}</td>
                          <td className="border border-slate-400 py-1 px-2 text-center uppercase">{p.kategori}</td>
                          <td className="border border-slate-400 py-1 px-3 text-[9px] font-sans">{p.keperluan}</td>
                          <td className="border border-slate-400 py-1 px-2 text-center">{formatTimeOnly(p.waktuKeluarAktual)}</td>
                          <td className="border border-slate-400 py-1 px-2 text-center font-bold">{formatTimeOnly(p.batasKembali)}</td>
                          <td className="border border-slate-400 py-1 px-2 text-center">{formatTimeOnly(p.waktuKembaliAktual)}</td>
                          <td className="border border-slate-400 py-1 px-2 text-center font-bold uppercase">{p.status}</td>
                          <td className="border border-slate-400 py-1 px-2 text-[9px]">{p.musyrifPenyetuju || 'Ust. M. Syukron'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* KOLOM TANDA TANGAN 3 PEJABAT */}
              <div className="grid grid-cols-3 gap-4 pt-8 text-center text-xs font-sans mt-4 border-t border-slate-300">
                <div>
                  <span className="text-slate-500 block text-[10px]">Mengetahui,</span>
                  <b className="text-slate-800 block text-[11px] mt-0.5">Musyrif / Pengasuh Asrama</b>
                  <div className="h-16 flex items-center justify-center">
                    <span className="text-[10px] text-slate-300 italic">[Tanda Tangan & Stempel]</span>
                  </div>
                  <b className="underline text-[11px] text-slate-900 block">Ust. M. Syukron, M.Pd.</b>
                  <span className="text-[10px] text-slate-500 font-mono">NIP: 19840512 201001 1 002</span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[10px]">Pemeriksa Gerbang,</span>
                  <b className="text-slate-800 block text-[11px] mt-0.5">Koordinator Satpam / Gate Keeper</b>
                  <div className="h-16 flex items-center justify-center">
                    <span className="text-[10px] text-slate-300 italic">[Tanda Tangan & Stempel]</span>
                  </div>
                  <b className="underline text-[11px] text-slate-900 block">Bpk. H. Bambang Subagyo</b>
                  <span className="text-[10px] text-slate-500 font-mono">ID: SEC-DARUL-ULUM</span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[10px]">Menyetujui,</span>
                  <b className="text-slate-800 block text-[11px] mt-0.5">Kepala Biro Ri'ayah & Kedisiplinan</b>
                  <div className="h-16 flex items-center justify-center">
                    <span className="text-[10px] text-slate-300 italic">[Tanda Tangan & Stempel]</span>
                  </div>
                  <b className="underline text-[11px] text-slate-900 block">K.H. Ahmad Dahlan, Lc., M.A.</b>
                  <span className="text-[10px] text-slate-500 font-mono">NIP: 19720315 199903 1 001</span>
                </div>
              </div>
            </div>

            {/* Bottom Modal Actions */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500 font-mono">
                💡 Tip: Pilih <b>"Save as PDF"</b> pada dialog cetak browser Anda untuk menyimpan file PDF ke laptop.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPrintPreviewModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={handlePrintToPdf}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak / Simpan PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. HIDDEN STANDALONE PRINTABLE DOCUMENT (Specifically visible to @media print for 100% clean PDF) */}
      <div id="printable-logbook-document" className="hidden">
        {/* KOP SURAT RESMI */}
        <div style={{ textAlign: 'center', borderBottom: '3px double #000', paddingBottom: '10px', marginBottom: '15px' }}>
          <h1 style={{ fontSize: '18pt', fontWeight: 'bold', margin: '0', textTransform: 'uppercase', fontFamily: 'serif' }}>
            PESANTREN MODERN DARUL ULUM
          </h1>
          <h2 style={{ fontSize: '11pt', fontWeight: 'bold', margin: '3px 0', textTransform: 'uppercase', color: '#047857' }}>
            BIRO PENGASUHAN SANTRI & RI'AYAH ASRAMA PUTRA - PUTRI
          </h2>
          <p style={{ fontSize: '8pt', margin: '0', color: '#4b5563' }}>
            Jl. Pesantren No. 01, Kompleks Smart Gate & RFID Ecosystem | Telp: (031) 8989-1234 | Email: riayah@darululum.ac.id
          </p>
          <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '10pt', textTransform: 'uppercase', background: '#f3f4f6', padding: '4px', margin: '8px 0 4px', border: '1px solid #9ca3af' }}>
            BUKU INDUK CATATAN LOG BOOK PERIZINAN KELUAR - MASUK SANTRI & SANTRIWATI (HARIAN)
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8pt', color: '#374151' }}>
            <span>Hari / Tanggal Cetak: <b>{formattedTodayDate}</b></span>
            <span>Jam Rekapitulasi: <b>{formattedClock}</b></span>
            <span>Total Arsip Terdata: <b>{permits.length} Santri</b></span>
          </div>
        </div>

        {/* PRINT TABLE */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8pt', fontFamily: 'monospace' }}>
          <thead>
            <tr style={{ backgroundColor: '#e5e7eb', textAlign: 'center', fontWeight: 'bold' }}>
              <th style={{ border: '1px solid #4b5563', padding: '5px 3px', width: '25px' }}>No</th>
              <th style={{ border: '1px solid #4b5563', padding: '5px' }}>Token Izin</th>
              <th style={{ border: '1px solid #4b5563', padding: '5px', textAlign: 'left' }}>Nama Santri</th>
              <th style={{ border: '1px solid #4b5563', padding: '5px', width: '30px' }}>L/P</th>
              <th style={{ border: '1px solid #4b5563', padding: '5px', textAlign: 'left' }}>Kelas / Kamar</th>
              <th style={{ border: '1px solid #4b5563', padding: '5px' }}>Kategori</th>
              <th style={{ border: '1px solid #4b5563', padding: '5px', textAlign: 'left' }}>Keperluan / Alasan</th>
              <th style={{ border: '1px solid #4b5563', padding: '5px' }}>Penjemput</th>
              <th style={{ border: '1px solid #4b5563', padding: '5px' }}>Keluar</th>
              <th style={{ border: '1px solid #4b5563', padding: '5px' }}>Batas</th>
              <th style={{ border: '1px solid #4b5563', padding: '5px' }}>Masuk</th>
              <th style={{ border: '1px solid #4b5563', padding: '5px' }}>Status</th>
              <th style={{ border: '1px solid #4b5563', padding: '5px' }}>Penyetuju</th>
            </tr>
          </thead>
          <tbody>
            {permits.map((p, idx) => {
              const s = santriList.find(item => item.id === p.santriId);
              return (
                <tr key={p.id}>
                  <td style={{ border: '1px solid #9ca3af', padding: '4px', textAlign: 'center' }}>{idx + 1}</td>
                  <td style={{ border: '1px solid #9ca3af', padding: '4px', fontWeight: 'bold' }}>{p.tokenIzin}</td>
                  <td style={{ border: '1px solid #9ca3af', padding: '4px', fontWeight: 'bold', fontFamily: 'sans-serif' }}>{s?.nama}</td>
                  <td style={{ border: '1px solid #9ca3af', padding: '4px', textAlign: 'center' }}>{s?.gender}</td>
                  <td style={{ border: '1px solid #9ca3af', padding: '4px' }}>{s?.kelas} - {s?.kamar}</td>
                  <td style={{ border: '1px solid #9ca3af', padding: '4px', textAlign: 'center', textTransform: 'uppercase' }}>{p.kategori}</td>
                  <td style={{ border: '1px solid #9ca3af', padding: '4px', fontSize: '7.5pt', fontFamily: 'sans-serif' }}>{p.keperluan}</td>
                  <td style={{ border: '1px solid #9ca3af', padding: '4px' }}>{p.penjemput || 'Mandiri'}</td>
                  <td style={{ border: '1px solid #9ca3af', padding: '4px', textAlign: 'center' }}>{formatTimeOnly(p.waktuKeluarAktual)}</td>
                  <td style={{ border: '1px solid #9ca3af', padding: '4px', textAlign: 'center', fontWeight: 'bold' }}>{formatTimeOnly(p.batasKembali)}</td>
                  <td style={{ border: '1px solid #9ca3af', padding: '4px', textAlign: 'center' }}>{formatTimeOnly(p.waktuKembaliAktual)}</td>
                  <td style={{ border: '1px solid #9ca3af', padding: '4px', textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase' }}>{p.status}</td>
                  <td style={{ border: '1px solid #9ca3af', padding: '4px', fontSize: '7.5pt' }}>{p.musyrifPenyetuju || 'Ust. M. Syukron'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* TANDA TANGAN CETAK */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', textAlign: 'center', marginTop: '30px', pageBreakInside: 'avoid', fontFamily: 'sans-serif', fontSize: '9pt' }}>
          <div>
            <span>Mengetahui,</span><br />
            <b>Musyrif / Pengasuh Asrama</b>
            <div style={{ height: '55px' }}></div>
            <b style={{ textDecoration: 'underline' }}>Ust. M. Syukron, M.Pd.</b><br />
            <span style={{ fontSize: '8pt', fontFamily: 'monospace' }}>NIP: 19840512 201001 1 002</span>
          </div>

          <div>
            <span>Pemeriksa Gerbang,</span><br />
            <b>Koordinator Satpam & Gate Keeper</b>
            <div style={{ height: '55px' }}></div>
            <b style={{ textDecoration: 'underline' }}>Bpk. H. Bambang Subagyo</b><br />
            <span style={{ fontSize: '8pt', fontFamily: 'monospace' }}>ID: SEC-DARUL-ULUM</span>
          </div>

          <div>
            <span>Menyetujui,</span><br />
            <b>Kepala Biro Ri'ayah & Kedisiplinan</b>
            <div style={{ height: '55px' }}></div>
            <b style={{ textDecoration: 'underline' }}>K.H. Ahmad Dahlan, Lc., M.A.</b><br />
            <span style={{ fontSize: '8pt', fontFamily: 'monospace' }}>NIP: 19720315 199903 1 001</span>
          </div>
        </div>
      </div>
    </div>
  );
}
