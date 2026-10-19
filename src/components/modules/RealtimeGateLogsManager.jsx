import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Printer, 
  Download, 
  Clock, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Radio, 
  ShieldAlert, 
  Calendar,
  X,
  FileText,
  UserCheck,
  Building2,
  RefreshCw,
  Camera
} from 'lucide-react';
import { sound } from '../../utils/audio';

export default function RealtimeGateLogsManager() {
  const { gateLogs, santriList, permits } = useApp();

  // Live ticking clock per second
  const [currentClock, setCurrentClock] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTimeLive = currentClock.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }) + ' WIB';

  const formattedDateToday = currentClock.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDirection, setFilterDirection] = useState('ALL'); // 'ALL' | 'TAP_KELUAR' | 'TAP_MASUK' | 'DENIED'
  const [filterGender, setFilterGender] = useState('ALL'); // 'ALL' | 'L' | 'P'
  const [filterDateRange, setFilterDateRange] = useState('TODAY'); // 'TODAY' | 'ALL'
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Today's YYYY-MM-DD
  const todayStr = useMemo(() => {
    return currentClock.toISOString().split('T')[0];
  }, [currentClock]);

  // Enriched logs with santri details
  const enrichedLogs = useMemo(() => {
    const list = Array.isArray(gateLogs) ? gateLogs : [];
    const allSantri = Array.isArray(santriList) ? santriList : [];
    return list.map(log => {
      if (!log) return null;
      const santri = allSantri.find(s => s && (s.id === log.santriId || s.rfidUid === log.rfidUid));
      const isToday = Boolean(log.timestamp && String(log.timestamp).startsWith(todayStr));
      const nama = String(log.santriNama || santri?.nama || '');
      const gender = santri?.gender || (nama.toLowerCase().includes('putri') ? 'P' : 'L');
      return {
        ...log,
        santri,
        isToday,
        gender
      };
    }).filter(Boolean);
  }, [gateLogs, santriList, todayStr]);

  // Statistics calculation
  const stats = useMemo(() => {
    const todayLogs = enrichedLogs.filter(l => l && l.isToday);
    const totalToday = todayLogs.length;
    const exitToday = todayLogs.filter(l => l.tipe === 'TAP_KELUAR' && l.status === 'VERIFIED').length;
    const entryToday = todayLogs.filter(l => l.tipe === 'TAP_MASUK' && l.status === 'VERIFIED').length;
    const deniedToday = todayLogs.filter(l => l.status === 'DENIED' || l.tipe === 'BLOCKED_CARD_ATTEMPT').length;
    const allSantri = Array.isArray(santriList) ? santriList : [];
    const activeOutCount = allSantri.filter(s => s && (s.statusAsrama === 'DI_LUAR' || s.statusAsrama === 'TERLAMBAT')).length;

    return {
      totalToday,
      exitToday,
      entryToday,
      deniedToday,
      activeOutCount
    };
  }, [enrichedLogs, santriList]);

  // Filtered logs for display & export
  const filteredLogs = useMemo(() => {
    return enrichedLogs.filter(log => {
      // Date filter
      if (filterDateRange === 'TODAY' && !log.isToday) return false;

      // Direction / Status filter
      if (filterDirection === 'TAP_KELUAR' && (log.tipe !== 'TAP_KELUAR' || log.status !== 'VERIFIED')) return false;
      if (filterDirection === 'TAP_MASUK' && (log.tipe !== 'TAP_MASUK' || log.status !== 'VERIFIED')) return false;
      if (filterDirection === 'DENIED' && log.status !== 'DENIED' && log.tipe !== 'BLOCKED_CARD_ATTEMPT') return false;

      // Gender filter
      if (filterGender !== 'ALL' && log.gender !== filterGender) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const namaMatch = (log.santriNama || '').toLowerCase().includes(q);
        const uidMatch = (log.rfidUid || '').toLowerCase().includes(q);
        const nisMatch = (log.santri?.nis || '').toLowerCase().includes(q);
        const remarksMatch = (log.remarks || '').toLowerCase().includes(q);
        const gateMatch = (log.gateId || '').toLowerCase().includes(q);
        if (!namaMatch && !uidMatch && !nisMatch && !remarksMatch && !gateMatch) return false;
      }

      return true;
    });
  }, [enrichedLogs, filterDateRange, filterDirection, filterGender, searchQuery]);

  // Handle Export CSV
  const exportToCSV = () => {
    sound.playSuccess();
    const headers = ['No', 'Waktu', 'Nama Santri', 'NIS', 'L/P', 'Kelas', 'Kamar', 'UID RFID', 'Arah Gerbang', 'Status', 'Catatan / Token'];
    const rows = filteredLogs.map((l, idx) => [
      idx + 1,
      new Date(l.timestamp).toLocaleString('id-ID'),
      `"${l.santriNama || l.santri?.nama || 'Unknown'}"`,
      l.santri?.nis || '-',
      l.gender || '-',
      l.santri?.kelas || '-',
      `"${l.santri?.kamar || '-'}"`,
      l.rfidUid,
      l.tipe === 'TAP_KELUAR' ? 'KELUAR (EXIT)' : l.tipe === 'TAP_MASUK' ? 'MASUK (ENTRY)' : 'PERCOBAAN ILEGAL',
      l.status,
      `"${l.remarks || '-'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Log_Keluar_Masuk_Santri_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle Native Print to PDF
  const triggerPrintPdf = () => {
    sound.playSuccess();
    window.print();
  };

  return (
    <div className="space-y-5">
      
      {/* 1. Header Banner Real-Time */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                LIVE GATE ACCESS AUDIT
              </span>
              <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                {formattedDateToday}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-wide">
              Log Aktivitas Keluar & Masuk Santri Real-Time
            </h2>
            <p className="text-xs text-slate-500">
              Audit jejak fisik lintasan Smart Turnstile Gate RC522 (13.56 MHz), verifikasi izin, anti-bypass lock, dan ekspor dokumen resmi.
            </p>
          </div>

          {/* Right Action: Live Clock & Print PDF button */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-2xl flex items-center gap-2 shadow-xs">
              <Clock className="w-4 h-4 text-emerald-600 animate-spin-slow" />
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-mono block leading-none">WAKTU AKTUAL:</span>
                <span className="font-mono font-bold text-sm text-slate-900">{formattedTimeLive}</span>
              </div>
            </div>

            <button
              onClick={() => {
                sound.playBeep();
                setIsPrintModalOpen(true);
              }}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl shadow-xs flex items-center gap-2 transition"
            >
              <Printer className="w-4 h-4" />
              <span>🖨️ Cetak Dokumen PDF</span>
            </button>

            <button
              onClick={exportToCSV}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl border border-slate-200 flex items-center gap-1.5 transition"
              title="Unduh Data Excel/CSV"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. 5 KPI Counter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-1">
            TOTAL TAP HARI INI
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono">{stats.totalToday}</span>
            <span className="text-[11px] text-slate-500 font-bold">Aktivitas</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">Sensor RC522 Gerbang</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] font-mono text-blue-600 uppercase tracking-wider block mb-1">
            TAP KELUAR (EXIT)
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-700 font-mono">{stats.exitToday}</span>
            <span className="text-[11px] text-blue-600 font-bold">Santri</span>
          </div>
          <span className="text-[10px] text-blue-500 block mt-1">Izin resmi terverifikasi</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] font-mono text-emerald-700 uppercase tracking-wider block mb-1">
            TAP MASUK (CHECK-IN)
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700 font-mono">{stats.entryToday}</span>
            <span className="text-[11px] text-emerald-600 font-bold">Santri</span>
          </div>
          <span className="text-[10px] text-emerald-600 block mt-1">Kembali ke asrama</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] font-mono text-rose-600 uppercase tracking-wider block mb-1">
            AKSES DITOLAK (DENIED)
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-700 font-mono">{stats.deniedToday}</span>
            <span className="text-[11px] text-rose-600 font-bold">Insiden</span>
          </div>
          <span className="text-[10px] text-rose-500 block mt-1">Tanpa izin / kartu hilang</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs col-span-2 sm:col-span-1">
          <span className="text-[10px] font-mono text-amber-700 uppercase tracking-wider block mb-1">
            SEDANG DI LUAR
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-700 font-mono">{stats.activeOutCount}</span>
            <span className="text-[11px] text-amber-600 font-bold">Santri</span>
          </div>
          <span className="text-[10px] text-amber-600 block mt-1">Belum check-in masuk</span>
        </div>
      </div>

      {/* 3. Filter Bar & Search */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama santri, NIS, UID RFID, atau keterangan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter options */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Filter Direction */}
            <select
              value={filterDirection}
              onChange={(e) => setFilterDirection(e.target.value)}
              className="bg-white border border-slate-200 text-xs font-semibold text-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            >
              <option value="ALL">Semua Lintasan</option>
              <option value="TAP_KELUAR">Tap Keluar (EXIT)</option>
              <option value="TAP_MASUK">Tap Masuk (ENTRY)</option>
              <option value="DENIED">Akses Ditolak (DENIED)</option>
            </select>

            {/* Filter Gender */}
            <select
              value={filterGender}
              onChange={(e) => setFilterGender(e.target.value)}
              className="bg-white border border-slate-200 text-xs font-semibold text-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            >
              <option value="ALL">Semua Santri (L & P)</option>
              <option value="L">Santri Putra (L)</option>
              <option value="P">Santriwati Putri (P)</option>
            </select>

            {/* Filter Date Range */}
            <select
              value={filterDateRange}
              onChange={(e) => setFilterDateRange(e.target.value)}
              className="bg-white border border-slate-200 text-xs font-semibold text-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            >
              <option value="TODAY">Khusus Hari Ini</option>
              <option value="ALL">Semua Riwayat Log</option>
            </select>
          </div>
        </div>

        {/* Counter of active filtered items */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
          <span>Menampilkan <b className="text-emerald-700">{filteredLogs.length}</b> transaksi dari total <b className="text-slate-800">{gateLogs.length}</b> data log aktivitas.</span>
          {(searchQuery || filterDirection !== 'ALL' || filterGender !== 'ALL' || filterDateRange !== 'TODAY') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterDirection('ALL');
                setFilterGender('ALL');
                setFilterDateRange('TODAY');
              }}
              className="text-emerald-700 hover:text-emerald-800 font-semibold"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* 4. Live Activity Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Waktu Lintasan</th>
                <th className="py-3.5 px-4">Identitas Santri</th>
                <th className="py-3.5 px-4">UID RFID & Gerbang</th>
                <th className="py-3.5 px-4">Arah Gerbang</th>
                <th className="py-3.5 px-4">Status Verifikasi</th>
                <th className="py-3.5 px-4">Keterangan / Surat Izin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-10 text-center text-slate-400">
                    Tidak ada catatan aktivitas gerbang yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const s = log.santri;
                  const dateObj = new Date(log.timestamp);
                  const jam = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';
                  const tgl = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });

                  const isExit = log.tipe === 'TAP_KELUAR';
                  const isEntry = log.tipe === 'TAP_MASUK';
                  const isDenied = log.status === 'DENIED' || log.tipe === 'BLOCKED_CARD_ATTEMPT';

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition">
                      
                      {/* 1. Time */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-bold text-slate-900 block">{jam}</span>
                        <span className="text-[10px] text-slate-500">{tgl} • {log.id}</span>
                      </td>

                      {/* 2. Santri Identity */}
                      <td className="py-3.5 px-4 font-sans">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={log.snapshotUrl || s?.foto || '/images/avatar_santri_putra.jpg'}
                            alt="Santri"
                            className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0 shadow-2xs"
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 text-xs">{log.santriNama || s?.nama}</span>
                              <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                log.gender === 'P' ? 'bg-pink-50 text-pink-700 border border-pink-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}>
                                {log.gender === 'P' ? 'PUTRI' : 'PUTRA'}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500 block font-mono">
                              NIS: {s?.nis || '-'} • {s?.kelas || '-'} • {s?.kamar || '-'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 3. UID RFID & Gate ID */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-bold text-slate-900 block tracking-wide">{log.rfidUid}</span>
                        <span className="text-[10px] text-slate-500 font-sans">{log.gateId || 'GATE-01 (Turnstile)'}</span>
                      </td>

                      {/* 4. Direction */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-sans">
                        {isExit && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            TAP KELUAR (EXIT)
                          </span>
                        )}
                        {isEntry && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                            TAP MASUK (ENTRY)
                          </span>
                        )}
                        {isDenied && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            PERCOBAAN ILEGAL
                          </span>
                        )}
                      </td>

                      {/* 5. Status Verification */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-sans">
                        {log.status === 'VERIFIED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            VERIFIED (SAH)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            DENIED (DITOLAK)
                          </span>
                        )}
                      </td>

                      {/* 6. Remarks */}
                      <td className="py-3.5 px-4 font-sans text-slate-600 max-w-xs text-xs">
                        {log.remarks || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Print Preview Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-300 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-teal-700" />
                <h3 className="text-base font-bold text-slate-900">
                  Pratinjau Cetak Log Aktivitas Gerbang (A4 Landscape)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={triggerPrintPdf}
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 transition"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak / Simpan PDF Sekarang</span>
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Body showing printable document */}
            <div className="p-6 overflow-y-auto bg-slate-100 flex-1">
              <div className="bg-white p-8 rounded-xl shadow border border-slate-200 font-sans text-xs">
                
                {/* Official Pesantren Letterhead */}
                <div className="border-b-2 border-slate-900 pb-4 mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full border-2 border-emerald-800 flex items-center justify-center font-serif font-black text-emerald-800 text-2xl tracking-tighter shrink-0">
                      DU
                    </div>
                    <div>
                      <h1 className="text-lg font-black text-slate-900 uppercase tracking-wide">
                        PESANTREN MODERN DARUL ULUM
                      </h1>
                      <h2 className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                        BIRO PENGASUHAN SANTRI & KOMANDO KEAMANAN POS GERBANG
                      </h2>
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        Jl. KH. Hasyim Asy'ari No. 10 Peterongan, Jombang - Jawa Timur 61481 • Telp: (0321) 861234 • Email: riayah@darululum.ac.id
                      </p>
                    </div>
                  </div>
                  <div className="text-right font-mono text-[10px] text-slate-600">
                    <p><b>KODE DOK:</b> DU-SEC-AUDIT-2026</p>
                    <p><b>TANGGAL CETAK:</b> {currentClock.toLocaleDateString('id-ID')}</p>
                    <p><b>WAKTU:</b> {formattedTimeLive}</p>
                  </div>
                </div>

                {/* Document Title */}
                <div className="text-center my-4">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider underline">
                    BUKU LOG AUDIT AKTIVITAS KELUAR MASUK SANTRI / SANTRIWATI (SMART GATE)
                  </h3>
                  <p className="text-[10px] text-slate-600 mt-1">
                    Rekapitulasi resmi transaksi lintasan Turnstile Gate 01 berbasis Kartu RFID 13.56 MHz per tanggal {formattedDateToday}.
                  </p>
                </div>

                {/* Table */}
                <table className="w-full text-left text-[10px] border border-slate-300 mt-4 mb-6">
                  <thead className="bg-slate-100 text-slate-800 font-bold uppercase border-b border-slate-300">
                    <tr>
                      <th className="p-2 border-r border-slate-300 text-center w-8">No</th>
                      <th className="p-2 border-r border-slate-300">Waktu</th>
                      <th className="p-2 border-r border-slate-300">Nama Santri</th>
                      <th className="p-2 border-r border-slate-300 text-center">NIS</th>
                      <th className="p-2 border-r border-slate-300 text-center">L/P</th>
                      <th className="p-2 border-r border-slate-300">Kamar Asrama</th>
                      <th className="p-2 border-r border-slate-300">UID RFID</th>
                      <th className="p-2 border-r border-slate-300">Arah Gerbang</th>
                      <th className="p-2 border-r border-slate-300 text-center">Status</th>
                      <th className="p-2">Keterangan / Token Izin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredLogs.map((l, index) => {
                      const d = new Date(l.timestamp);
                      const timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';
                      return (
                        <tr key={l.id} className={index % 2 === 1 ? 'bg-slate-50' : ''}>
                          <td className="p-2 border-r border-slate-300 text-center font-mono">{index + 1}</td>
                          <td className="p-2 border-r border-slate-300 font-mono whitespace-nowrap">{timeStr}</td>
                          <td className="p-2 border-r border-slate-300 font-bold">{l.santriNama || l.santri?.nama}</td>
                          <td className="p-2 border-r border-slate-300 text-center font-mono">{l.santri?.nis || '-'}</td>
                          <td className="p-2 border-r border-slate-300 text-center font-bold">{l.gender}</td>
                          <td className="p-2 border-r border-slate-300">{l.santri?.kamar || '-'}</td>
                          <td className="p-2 border-r border-slate-300 font-mono font-bold text-slate-800">{l.rfidUid}</td>
                          <td className="p-2 border-r border-slate-300 font-bold">
                            {l.tipe === 'TAP_KELUAR' ? 'KELUAR (EXIT)' : l.tipe === 'TAP_MASUK' ? 'MASUK (ENTRY)' : 'PERCOBAAN ILEGAL'}
                          </td>
                          <td className="p-2 border-r border-slate-300 text-center font-bold">
                            {l.status === 'VERIFIED' ? 'VERIFIED' : 'DENIED'}
                          </td>
                          <td className="p-2 text-slate-700">{l.remarks || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* 3 Column Official Signatures */}
                <div className="grid grid-cols-3 gap-6 text-center text-[10px] pt-6 border-t border-slate-200">
                  <div>
                    <p className="text-slate-500 mb-1">Petugas Jaga Gerbang:</p>
                    <p className="font-bold text-slate-800">Komandan Satpam Pos Gerbang</p>
                    <div className="h-16 flex items-end justify-center">
                      <span className="font-bold border-b border-slate-800 px-4 pb-0.5">( Komandan Sutrisno )</span>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-0.5">NIP: 19840215.2010.01</p>
                  </div>

                  <div>
                    <p className="text-slate-500 mb-1">Mengetahui Verifikasi:</p>
                    <p className="font-bold text-slate-800">Musyrif Pengasuhan Asrama</p>
                    <div className="h-16 flex items-end justify-center">
                      <span className="font-bold border-b border-slate-800 px-4 pb-0.5">( Ust. M. Syukron, M.Pd. )</span>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-0.5">NIP: 19890520.2014.02</p>
                  </div>

                  <div>
                    <p className="text-slate-500 mb-1">Mengesahkan:</p>
                    <p className="font-bold text-slate-800">Kepala Biro Ri'ayah Santri</p>
                    <div className="h-16 flex items-end justify-center">
                      <span className="font-bold border-b border-slate-800 px-4 pb-0.5">( Ust. Drs. H. Mustofa )</span>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-0.5">NIP: 19740810.1999.03</p>
                  </div>
                </div>

              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-3 bg-slate-50 border-t border-slate-200 rounded-b-3xl">
              <span className="text-xs text-slate-500">
                Format Cetak: <b>A4 Landscape</b> • Margin Standar Resmi
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  Tutup
                </button>
                <button
                  onClick={triggerPrintPdf}
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 transition"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak / Save as PDF</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Hidden Container Isolated exclusively for Window.print() */}
      <div id="printable-gatelog-document" className="hidden">
        <div style={{ padding: '15px', fontFamily: 'Arial, sans-serif', color: '#000', fontSize: '10pt' }}>
          
          {/* Letterhead */}
          <div style={{ borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '14pt', fontWeight: 'bold' }}>PESANTREN MODERN DARUL ULUM</h2>
              <h4 style={{ margin: '2px 0', fontSize: '10pt', color: '#047857' }}>BIRO PENGASUHAN SANTRI & KOMANDO KEAMANAN POS GERBANG</h4>
              <p style={{ margin: 0, fontSize: '8pt', color: '#555' }}>Jl. KH. Hasyim Asy'ari No. 10 Peterongan, Jombang - Jawa Timur 61481 • (0321) 861234</p>
            </div>
            <div style={{ textAlign: 'right', fontSize: '8pt' }}>
              <div><b>NO DOKUMEN:</b> DU-SEC-AUDIT-2026</div>
              <div><b>TANGGAL CETAK:</b> {currentClock.toLocaleDateString('id-ID')}</div>
              <div><b>WAKTU:</b> {formattedTimeLive}</div>
            </div>
          </div>

          <div style={{ textAlign: 'center', margin: '10px 0' }}>
            <h3 style={{ margin: 0, textDecoration: 'underline', fontSize: '12pt' }}>
              BUKU LOG AUDIT AKTIVITAS KELUAR MASUK SANTRI / SANTRIWATI (SMART GATE)
            </h3>
            <p style={{ margin: '4px 0', fontSize: '8pt', color: '#444' }}>
              Rekapitulasi resmi transaksi lintasan Turnstile Gate 01 berbasis Kartu RFID 13.56 MHz per tanggal {formattedDateToday}.
            </p>
          </div>

          {/* Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8pt', marginTop: '10px' }} border="1" cellPadding="4">
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9' }}>
                <th style={{ width: '25px', textAlign: 'center' }}>No</th>
                <th>Waktu</th>
                <th>Nama Santri</th>
                <th style={{ textAlign: 'center' }}>NIS</th>
                <th style={{ textAlign: 'center' }}>L/P</th>
                <th>Kamar Asrama</th>
                <th>UID RFID</th>
                <th>Arah Gerbang</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th>Keterangan / Token Izin</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((l, idx) => {
                const d = new Date(l.timestamp);
                const timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';
                return (
                  <tr key={l.id}>
                    <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{timeStr}</td>
                    <td><b>{l.santriNama || l.santri?.nama}</b></td>
                    <td style={{ textAlign: 'center' }}>{l.santri?.nis || '-'}</td>
                    <td style={{ textAlign: 'center' }}>{l.gender}</td>
                    <td>{l.santri?.kamar || '-'}</td>
                    <td><b>{l.rfidUid}</b></td>
                    <td>{l.tipe === 'TAP_KELUAR' ? 'KELUAR (EXIT)' : l.tipe === 'TAP_MASUK' ? 'MASUK (ENTRY)' : 'PERCOBAAN ILEGAL'}</td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{l.status}</td>
                    <td>{l.remarks || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Signatures */}
          <div style={{ marginTop: '25px', display: 'flex', justifyContent: 'space-between', fontSize: '8.5pt', textAlign: 'center' }}>
            <div style={{ width: '30%' }}>
              <p style={{ margin: 0 }}>Petugas Jaga Gerbang:</p>
              <p style={{ margin: '2px 0', fontWeight: 'bold' }}>Komandan Satpam Pos Gerbang</p>
              <div style={{ height: '50px' }}></div>
              <p style={{ margin: 0, fontWeight: 'bold', borderBottom: '1px solid #000', display: 'inline-block', padding: '0 10px' }}>
                ( Komandan Sutrisno )
              </p>
              <p style={{ margin: '2px 0', fontSize: '7.5pt' }}>NIP: 19840215.2010.01</p>
            </div>

            <div style={{ width: '30%' }}>
              <p style={{ margin: 0 }}>Mengetahui Verifikasi:</p>
              <p style={{ margin: '2px 0', fontWeight: 'bold' }}>Musyrif Pengasuhan Asrama</p>
              <div style={{ height: '50px' }}></div>
              <p style={{ margin: 0, fontWeight: 'bold', borderBottom: '1px solid #000', display: 'inline-block', padding: '0 10px' }}>
                ( Ust. M. Syukron, M.Pd. )
              </p>
              <p style={{ margin: '2px 0', fontSize: '7.5pt' }}>NIP: 19890520.2014.02</p>
            </div>

            <div style={{ width: '30%' }}>
              <p style={{ margin: 0 }}>Mengesahkan:</p>
              <p style={{ margin: '2px 0', fontWeight: 'bold' }}>Kepala Biro Ri'ayah Santri</p>
              <div style={{ height: '50px' }}></div>
              <p style={{ margin: 0, fontWeight: 'bold', borderBottom: '1px solid #000', display: 'inline-block', padding: '0 10px' }}>
                ( Ust. Drs. H. Mustofa )
              </p>
              <p style={{ margin: '2px 0', fontSize: '7.5pt' }}>NIP: 19740810.1999.03</p>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
