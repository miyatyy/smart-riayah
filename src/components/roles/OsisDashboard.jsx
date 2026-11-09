import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Shield,
  ShieldAlert,
  Award,
  Sparkles,
  Users,
  Search,
  CheckCircle2,
  Clock,
  Send,
  UserCheck,
  AlertTriangle,
  BookOpen,
  Filter,
  CheckCircle,
  XCircle,
  HeartHandshake,
  Loader2,
  Edit3,
  Trash2,
  Database,
  X,
  Check
} from 'lucide-react';
import { sound } from '../../utils/audio';
import { getRealtimePondokClock } from '../../utils/pondokTimeUtils';

export default function OsisDashboard() {
  const {
    currentUser,
    santriList,
    osisReports,
    submitOsisReport,
    updateOsisReport,
    deleteOsisReport
  } = useApp();

  const [clock, setClock] = useState(() => getRealtimePondokClock());
  React.useEffect(() => {
    const timer = setInterval(() => setClock(getRealtimePondokClock()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter & Pencarian Santri
  const [santriFilter, setSantriFilter] = useState('ALL'); // 'ALL' | 'PUTRI' | 'PUTRA'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSantri, setSelectedSantri] = useState(null);

  // Form State Laporan OSIS
  const [bidangOsis, setBidangOsis] = useState('OSIS Kamtib Banat (Putri)');
  const [kategori, setKategori] = useState('PELANGGARAN'); // 'PELANGGARAN' | 'PRESTASI' | 'IBADAH'
  const [jenis, setJenis] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [poin, setPoin] = useState(-10);
  const [tazir, setTazir] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successAlert, setSuccessAlert] = useState(null);

  // Filter Riwayat Laporan & State Edit/Delete CRUD
  const [historyFilter, setHistoryFilter] = useState('ALL'); // 'ALL' | 'PENDING_ADMIN' | 'APPROVED' | 'REJECTED'
  const [historySearch, setHistorySearch] = useState('');
  const [editingReport, setEditingReport] = useState(null);

  // Presets Cepat
  const PRESETS = [
    { label: 'Terlambat Berjamaah (-10)', jenis: 'Terlambat Sholat Berjamaah di Masjid', poin: -10, kategori: 'PELANGGARAN', tazir: 'Membaca Al-Qur\'an 1/2 Juz di serambi masjid setelah sholat.' },
    { label: 'Pelanggaran Bahasa (-5)', jenis: 'Melanggar Disiplin Bahasa Resmi (Bilingual)', poin: -5, kategori: 'PELANGGARAN', tazir: 'Menghafal 20 kosakata baru bahasa Arab/Inggris.' },
    { label: 'Kamar Tidak Rapi (-5)', jenis: 'Kamar/Lemari Berantakan saat Sidak Kamtib', poin: -5, kategori: 'PELANGGARAN', tazir: 'Membersihkan dan merapikan kamar bersama tim piket.' },
    { label: 'Keluar Tanpa Izin Kamtib (-25)', jenis: 'Melanggar Batas Asrama Tanpa Izin Kamtib', poin: -25, kategori: 'PELANGGARAN', tazir: 'Pembersihan aula utama dan menghadap Musyrif Asrama.' },
    { label: 'Imam Sholat / Muadzin (+10)', jenis: 'Bertugas Muadzin / Imam Sholat Rawatib', poin: 10, kategori: 'PRESTASI', tazir: 'Apresiasi pengurus dan teladan santri.' },
    { label: 'Juara Lomba / Khitobah (+15)', jenis: 'Juara Pidato / Khitobah 3 Bahasa Pondok', poin: 15, kategori: 'PRESTASI', tazir: 'Teladan kemampuan bahasa santri se-pondok.' },
    { label: 'Kerapian Teladan Kamar (+10)', jenis: 'Kamar Terbersih & Paling Rapi Mingguan', poin: 10, kategori: 'PRESTASI', tazir: 'Penghargaan tim kebersihan asrama.' }
  ];

  // Santri List Filtered
  const filteredSantri = useMemo(() => {
    return (santriList || []).filter(s => {
      // Filter Gender
      if (santriFilter === 'PUTRI' && s.gender !== 'P') return false;
      if (santriFilter === 'PUTRA' && s.gender !== 'L') return false;

      // Filter Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nama = (s.nama || s.nama_lengkap || '').toLowerCase();
        const nis = String(s.nis || '').toLowerCase();
        const kamar = (s.kamar || '').toLowerCase();
        const kelas = (s.kelas || '').toLowerCase();
        const uid = (s.rfidUid || s.rfid_uid || '').toLowerCase();
        return nama.includes(q) || nis.includes(q) || kamar.includes(q) || kelas.includes(q) || uid.includes(q);
      }
      return true;
    });
  }, [santriList, santriFilter, searchQuery]);

  // Handler Submit
  const handleSubmitReport = (e) => {
    e.preventDefault();

    if (!selectedSantri) {
      sound.playBeep?.();
      alert('⚠️ Harap pilih santri atau santriwati yang akan dilaporkan terlebih dahulu dari daftar di sebelah kiri!');
      return;
    }

    if (!jenis.trim()) {
      sound.playBeep?.();
      alert('Harap isi Perihal / Jenis Pelanggaran atau Prestasi!');
      return;
    }

    if (!keterangan.trim()) {
      sound.playBeep?.();
      alert('Harap isi Deskripsi / Kronologi Kejadian!');
      return;
    }

    setIsSubmitting(true);

    const reportPayload = {
      santriId: selectedSantri.id,
      santriNama: selectedSantri.nama || selectedSantri.nama_lengkap,
      gender: selectedSantri.gender || 'L',
      kelas: selectedSantri.kelas || '',
      kamar: selectedSantri.kamar || '',
      bidangOsis,
      pelaporNama: currentUser?.nama || 'Pengurus Kamtib OSIS',
      kategori,
      jenis: jenis.trim(),
      keterangan: keterangan.trim(),
      poin: Number(poin),
      tazir: tazir.trim()
    };

    try {
      const newReport = submitOsisReport(reportPayload);

      setSuccessAlert(`✅ Laporan untuk ananda ${reportPayload.santriNama} berhasil dikirim ke Admin Ri'ayah dengan ID [${newReport.id}].`);
      sound.playSuccess?.();

      // Reset Form
      setJenis('');
      setKeterangan('');
      setTazir('');
      setPoin(-10);
      setKategori('PELANGGARAN');

      setTimeout(() => setSuccessAlert(null), 7000);
    } catch (err) {
      console.error('Error submitting OSIS report:', err);
      alert('Gagal mengirim laporan: ' + (err.message || 'Terjadi kesalahan sistem'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered History
  const filteredHistory = useMemo(() => {
    return (osisReports || []).filter(rep => {
      if (historyFilter !== 'ALL' && rep.status !== historyFilter) return false;
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase().trim();
        const text = `${rep.id} ${rep.santriNama} ${rep.bidangOsis} ${rep.jenis} ${rep.keterangan} ${rep.kamar}`.toLowerCase();
        return text.includes(q);
      }
      return true;
    });
  }, [osisReports, historyFilter, historySearch]);

  const handleSaveEditReport = (e) => {
    e.preventDefault();
    if (!editingReport?.id) return;
    if (!editingReport.jenis?.trim() || !editingReport.keterangan?.trim()) {
      alert('Perihal dan kronologi kejadian tidak boleh kosong!');
      return;
    }
    const res = updateOsisReport?.(editingReport.id, {
      bidangOsis: editingReport.bidangOsis,
      kategori: editingReport.kategori,
      jenis: editingReport.jenis.trim(),
      poin: Number(editingReport.poin || 0),
      keterangan: editingReport.keterangan.trim(),
      tazir: (editingReport.tazir || '').trim()
    });
    if (res) {
      setSuccessAlert(`✏️ Laporan [${editingReport.id}] atas nama ${editingReport.santriNama} berhasil diperbarui (Supabase & MongoDB Sync).`);
      setTimeout(() => setSuccessAlert(null), 6000);
    }
    setEditingReport(null);
  };

  const handleDeleteReport = (rep) => {
    const ok = window.confirm(
      `🗑️ KONFIRMASI HAPUS LAPORAN OSIS\n\nID: ${rep.id}\nSantri: ${rep.santriNama} (${rep.kelas || '-'})\nPerihal: ${rep.jenis}\n\nLaporan akan dihapus permanen dari database (Supabase & MongoDB). Lanjutkan?`
    );
    if (!ok) return;
    deleteOsisReport?.(rep.id);
    setSuccessAlert(`🗑️ Laporan [${rep.id}] atas nama ${rep.santriNama} telah dihapus dari database.`);
    setTimeout(() => setSuccessAlert(null), 6000);
  };

  return (
    <div className="space-y-6 pb-16 animate-fade-in">
      {/* ─── 1. HEADER POSKO OSIS & LIVE CLOCK WITA ─── */}
      <div className="bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-emerald-500/10 blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 rounded-full text-[11px] font-bold text-emerald-300">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>PORTAL KEDISIPLINAN OSIS PONDOK TERPADU</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              <span>📋 Posko OSIS: Input Perilaku Santri/Wati Se-Pondok</span>
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/80 max-w-2xl leading-relaxed">
              Pusat pencatatan pelanggaran, ketertiban asrama (Kamtib Banin & Banat), ubudiyah sholat berjamaah, serta apresiasi prestasi santri se-pondok.
            </p>
          </div>

          {/* Jam Real-time WITA & User Info */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/15 text-right">
              <div className="text-[10px] text-emerald-300 uppercase tracking-wider font-mono font-bold flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Waktu WITA (UTC+8)</span>
              </div>
              <div className="text-lg font-mono font-black text-white">
                {clock.jam_menit_detik}
              </div>
              <div className="text-[10px] text-emerald-200/80">
                {clock.hari_teks}, {clock.tanggal_teks}
              </div>
            </div>

            <div className="bg-emerald-500/20 border border-emerald-400/40 px-3.5 py-2 rounded-2xl flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-xs shadow-inner">
                👮
              </div>
              <div>
                <div className="text-xs font-bold text-white leading-tight">
                  {currentUser?.nama || 'Presidium OSIS'}
                </div>
                <div className="text-[10px] text-emerald-300 font-mono">
                  Role: Pengurus OSIS
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 2. BANNER ISOLASI KEAMANAN & FLOW VERIFIKASI ADMIN RI'AYAH ─── */}
      <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl p-4 flex items-start gap-3 text-amber-900">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed space-y-1">
          <strong className="font-black text-amber-800 block text-sm">
            🔒 Mode Internal Pengurus OSIS: Laporan Dialirkan ke Admin Ri'ayah
          </strong>
          <p className="text-slate-700">
            Seluruh laporan kelakuan santri/santriwati yang Anda kirimkan <b>TIDAK langsung dikirim ke WhatsApp orang tua</b>, melainkan masuk terlebih dahulu ke antrean <b>Verifikasi Admin Ri'ayah (Biro Pengasuhan Santri)</b>. Admin Ri'ayah akan memvalidasi kronologi, menyesuaikan poin secara objektif, lalu mengesahkan sinkronisasi ke sistem resmi pondok.
          </p>
        </div>
      </div>

      {successAlert && (
        <div className="bg-emerald-50 border-2 border-emerald-500/40 rounded-2xl p-4 flex items-center justify-between text-emerald-900 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2 text-xs font-bold">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successAlert}</span>
          </div>
          <button onClick={() => setSuccessAlert(null)} className="text-emerald-700 hover:text-emerald-950 font-bold text-xs">
            ✕ Tutup
          </button>
        </div>
      )}

      {/* ─── 3. SPLIT LAYOUT 2 KOLOM (KIRI: ROSTER SANTRI SE-PONDOK | KANAN: FORM INPUT LAPORAN) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* KOLOM KIRI (5 Kolom): Pemilih Santri/Wati Se-Pondok */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 space-y-4 flex flex-col h-[650px]">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              <span>Daftar Santri & Santriwati ({filteredSantri.length})</span>
            </h3>
            <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              Koneksi Supabase Aktif
            </span>
          </div>

          {/* Tab Filter Gender: Semua / Putri / Putra */}
          <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-2xl text-xs font-bold">
            <button
              onClick={() => setSantriFilter('ALL')}
              className={`py-1.5 rounded-xl transition ${santriFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Semua ({santriList.length})
            </button>
            <button
              onClick={() => setSantriFilter('PUTRI')}
              className={`py-1.5 rounded-xl transition flex items-center justify-center gap-1 ${santriFilter === 'PUTRI' ? 'bg-rose-50 text-rose-700 shadow-xs border border-rose-200' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <span>🧕 Putri</span>
              <span className="text-[10px] font-mono">({santriList.filter(s => s.gender === 'P').length})</span>
            </button>
            <button
              onClick={() => setSantriFilter('PUTRA')}
              className={`py-1.5 rounded-xl transition flex items-center justify-center gap-1 ${santriFilter === 'PUTRA' ? 'bg-teal-50 text-teal-700 shadow-xs border border-teal-200' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <span>👳 Putra</span>
              <span className="text-[10px] font-mono">({santriList.filter(s => s.gender === 'L').length})</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Cari Nama / NIS / Kamar / Tap Kartu RFID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Roster Santri List (Scrollable) */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
            {filteredSantri.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Tidak ada santri yang sesuai filter pencarian.
              </div>
            ) : (
              filteredSantri.map((s) => {
                const isSelected = selectedSantri?.id === s.id;
                const isPutri = s.gender === 'P';

                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      setSelectedSantri(s);
                      sound.playBeep?.();
                    }}
                    className={`pt-2 p-3 rounded-2xl cursor-pointer transition flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-emerald-50 border-2 border-emerald-500 shadow-sm'
                        : 'hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
                        isPutri ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {isPutri ? '🧕' : '👳'}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-xs truncate flex items-center gap-1.5">
                          <span>{s.nama || s.nama_lengkap}</span>
                          {isSelected && <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono truncate">
                          NIS: {s.nis || '-'} • {s.kelas || '-'}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {s.kamar || 'Kamar belum ditentukan'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className={`text-[11px] font-black font-mono ${
                        (s.poinDisiplin ?? 100) >= 80 ? 'text-emerald-700' : (s.poinDisiplin ?? 100) >= 50 ? 'text-amber-700' : 'text-rose-700'
                      }`}>
                        {s.poinDisiplin ?? 100} Poin
                      </div>
                      <span className="text-[9px] text-slate-400 uppercase font-bold">
                        Disiplin
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* KOLOM KANAN (7 Kolom): Formulir Input Laporan OSIS */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-600" />
                <span>Formulir Laporan Kelakuan Santri</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Isi form ini dengan jujur & objektif. Hasil laporan akan diverifikasi oleh Admin Ri'ayah.
              </p>
            </div>
            {selectedSantri && (
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                ✓ Santri Terpilih
              </span>
            )}
          </div>

          {/* Kartu Profil Santri Terpilih */}
          {selectedSantri ? (
            <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
              selectedSantri.gender === 'P' ? 'bg-rose-50/60 border-rose-200' : 'bg-emerald-50/60 border-emerald-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 ${
                  selectedSantri.gender === 'P' ? 'bg-rose-200 text-rose-800' : 'bg-emerald-200 text-emerald-900'
                }`}>
                  {selectedSantri.gender === 'P' ? '🧕' : '👳'}
                </div>
                <div>
                  <h4 className="font-black text-sm text-slate-900">
                    {selectedSantri.nama || selectedSantri.nama_lengkap}
                  </h4>
                  <p className="text-xs text-slate-600 font-medium">
                    NIS: {selectedSantri.nis || '-'} • Kelas: {selectedSantri.kelas || '-'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Kamar: {selectedSantri.kamar || '-'}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs text-slate-500 font-medium">Poin Saat Ini</div>
                <div className="text-lg font-mono font-black text-emerald-800">
                  {selectedSantri.poinDisiplin ?? 100} / 100
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span><b>Belum ada santri yang dipilih.</b> Silakan klik salah satu nama santri/santriwati pada daftar di sebelah kiri.</span>
            </div>
          )}

          {/* Preset Tombol Cepat */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Pilihan Cepat Masalah / Prestasi Sering Terjadi:</span>
            </label>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scroll-row">
              {PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setJenis(p.jenis);
                    setPoin(p.poin);
                    setKategori(p.kategori);
                    setTazir(p.tazir);
                    sound.playBeep?.();
                  }}
                  className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold whitespace-nowrap transition border border-slate-200 shrink-0"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Form Fields */}
          <form onSubmit={handleSubmitReport} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Bidang OSIS Pelapor:
                </label>
                <select
                  value={bidangOsis}
                  onChange={(e) => setBidangOsis(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-300 font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                >
                  <option value="OSIS Kamtib Banat (Putri)">OSIS Kamtib Banat (Putri)</option>
                  <option value="OSIS Kamtib Banin (Putra)">OSIS Kamtib Banin (Putra)</option>
                  <option value="OSIS Ubudiyah (Ibadah & Sholat)">OSIS Ubudiyah (Ibadah & Sholat)</option>
                  <option value="OSIS Bahasa (Arab & Inggris)">OSIS Bahasa (Arab & Inggris)</option>
                  <option value="OSIS Kebersihan & Lingkungan">OSIS Kebersihan & Lingkungan</option>
                  <option value="OSIS Olahraga & Seni">OSIS Olahraga & Seni</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Kategori Laporan:
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setKategori('PELANGGARAN');
                      if (poin > 0) setPoin(-10);
                    }}
                    className={`py-2 px-2 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 ${
                      kategori === 'PELANGGARAN'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Pelanggaran</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setKategori('PRESTASI');
                      if (poin < 0) setPoin(10);
                    }}
                    className={`py-2 px-2 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 ${
                      kategori === 'PRESTASI'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Award className="w-3.5 h-3.5 shrink-0" />
                    <span>Prestasi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setKategori('IBADAH');
                      if (poin < 0) setPoin(5);
                    }}
                    className={`py-2 px-2 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 ${
                      kategori === 'IBADAH'
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>🕌 Ibadah</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Perihal / Jenis Kejadian:
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Terlambat Sholat Shubuh, Melanggar Jam Malam..."
                  value={jenis}
                  onChange={(e) => setJenis(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-300 focus:outline-none focus:border-emerald-500 font-semibold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Rekomendasi Poin:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={poin}
                    onChange={(e) => setPoin(parseInt(e.target.value) || 0)}
                    className={`w-full px-3 py-2 text-xs rounded-xl font-mono font-bold text-center border focus:outline-none ${
                      poin < 0
                        ? 'bg-rose-50 border-rose-300 text-rose-700'
                        : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    }`}
                  />
                  <span className="text-xs font-bold text-slate-500">Poin</span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Keterangan & Kronologi Kejadian:
              </label>
              <textarea
                rows={3}
                placeholder="Jelaskan secara detail kronologi kejadian, tempat, waktu, dan saksi bila ada..."
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-300 focus:outline-none focus:border-emerald-500 leading-relaxed"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Rekomendasi Ta'zir / Tindakan Pembinaan (Opsional):
              </label>
              <input
                type="text"
                placeholder="Contoh: Membaca Al-Qur'an 1 juz, membersihkan teras masjid, piket kamar..."
                value={tazir}
                onChange={(e) => setTazir(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-300 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Submit Action Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3.5 px-4 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-200 shadow-md ${
                !selectedSantri
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-2 border-dashed border-amber-300 shadow-none cursor-pointer'
                  : isSubmitting
                  ? 'bg-teal-700 text-white cursor-wait opacity-90'
                  : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-emerald-200 active:scale-[0.99] cursor-pointer'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>⚡ Mengirim Laporan ke Admin Ri'ayah...</span>
                </>
              ) : !selectedSantri ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-600 animate-pulse" />
                  <span>👈 1. Pilih Santri / Santriwati di Kolom Kiri Terlebih Dahulu</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-white" />
                  <span>🚀 2. Kirim Laporan Kedisiplinan [{selectedSantri.nama || selectedSantri.nama_lengkap}] ke Admin Ri'ayah</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* ─── 4. TABEL RIWAYAT LAPORAN OSIS & STATUS VERIFIKASI ADMIN RI'AYAH (FULL CRUD) ─── */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden space-y-0">
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 via-emerald-50/30 to-slate-50 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-black text-sm text-slate-900 tracking-tight flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-700" />
                <span>Riwayat Pengiriman Laporan Kedisiplinan OSIS</span>
              </h4>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <Database className="w-3 h-3" />
                <span>CRUD DB: Supabase &amp; MongoDB Aktif</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Buat, baca, perbarui (Update), atau hapus (Delete) laporan kelakuan santri secara real-time sebelum/sesudah diverifikasi Admin Ri'ayah.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Cari Riwayat */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Cari di riwayat..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-emerald-500 w-full sm:w-44"
              />
            </div>

            {/* Filter Status Riwayat */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl text-xs font-bold overflow-x-auto">
              <button
                onClick={() => setHistoryFilter('ALL')}
                className={`px-3 py-1 rounded-xl transition whitespace-nowrap ${historyFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}
              >
                Semua ({osisReports.length})
              </button>
              <button
                onClick={() => setHistoryFilter('PENDING_ADMIN')}
                className={`px-3 py-1 rounded-xl transition whitespace-nowrap ${historyFilter === 'PENDING_ADMIN' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-500'}`}
              >
                Menunggu ({osisReports.filter(r => r.status === 'PENDING_ADMIN').length})
              </button>
              <button
                onClick={() => setHistoryFilter('APPROVED')}
                className={`px-3 py-1 rounded-xl transition whitespace-nowrap ${historyFilter === 'APPROVED' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500'}`}
              >
                Disetujui ({osisReports.filter(r => r.status === 'APPROVED').length})
              </button>
              <button
                onClick={() => setHistoryFilter('REJECTED')}
                className={`px-3 py-1 rounded-xl transition whitespace-nowrap ${historyFilter === 'REJECTED' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-500'}`}
              >
                Ditolak ({osisReports.filter(r => r.status === 'REJECTED').length})
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <th className="py-3 px-3">ID &amp; Waktu</th>
                <th className="py-3 px-3">Santri &amp; Kamar</th>
                <th className="py-3 px-3">Bidang OSIS</th>
                <th className="py-3 px-3">Perihal &amp; Kronologi</th>
                <th className="py-3 px-3 text-center">Poin</th>
                <th className="py-3 px-3">Tindakan / Ta'zir</th>
                <th className="py-3 px-3 text-center">Status Verifikasi</th>
                <th className="py-3 px-3 text-center">Aksi CRUD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    Belum ada riwayat laporan pada kategori status ini.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((rep) => {
                  const isPending = rep.status === 'PENDING_ADMIN';
                  const isApproved = rep.status === 'APPROVED';
                  const isRejected = rep.status === 'REJECTED';

                  return (
                    <tr key={rep.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-3 font-mono">
                        <div className="font-bold text-slate-800 text-[11px]">{rep.id}</div>
                        <div className="text-[10px] text-slate-400">{rep.tanggal} • {rep.waktu}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 flex items-center gap-1">
                          <span>{rep.gender === 'P' ? '🧕' : '👳'}</span>
                          <span>{rep.santriNama}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">{rep.kelas} • {rep.kamar}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {rep.bidangOsis}
                        </span>
                        <div className="text-[9px] text-slate-400 mt-0.5">Pelapor: {rep.pelaporNama}</div>
                      </td>
                      <td className="py-3 px-3 max-w-[240px]">
                        <div className="font-bold text-slate-800">{rep.jenis}</div>
                        <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mt-0.5">
                          {rep.keterangan}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold">
                        <span className={`px-2 py-0.5 rounded text-[11px] ${
                          Number(rep.poin) < 0
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {Number(rep.poin) > 0 ? `+${rep.poin}` : rep.poin}
                        </span>
                      </td>
                      <td className="py-3 px-3 max-w-[180px]">
                        <div className="text-slate-700 text-[11px] font-medium truncate" title={rep.tazir}>
                          {rep.tazir || '-'}
                        </div>
                        {rep.adminNote && (
                          <div className="text-[9px] text-amber-700 font-medium italic mt-0.5">
                            Note Admin: {rep.adminNote}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {isPending && (
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-800 border border-amber-300 rounded-full text-[10px] font-bold inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-600 animate-spin" />
                            Menunggu Admin
                          </span>
                        )}
                        {isApproved && (
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-[10px] font-bold inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Disetujui
                          </span>
                        )}
                        {isRejected && (
                          <span className="px-2.5 py-1 bg-rose-100 text-rose-800 border border-rose-300 rounded-full text-[10px] font-bold inline-flex items-center gap-1">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            Ditolak
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingReport({ ...rep })}
                            className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-[10px] font-bold transition inline-flex items-center gap-1"
                            title="Edit / Perbarui Laporan di Database"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteReport(rep)}
                            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[10px] font-bold transition inline-flex items-center gap-1"
                            title="Hapus Laporan dari Database"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Hapus</span>
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

      {/* MODAL EDIT / UPDATE LAPORAN OSIS (CRUD) */}
      {editingReport && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <form
            onSubmit={handleSaveEditReport}
            className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-sky-600" />
                  <span>Edit Laporan Kedisiplinan ({editingReport.id})</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Santri: <b>{editingReport.santriNama}</b> ({editingReport.kelas} • {editingReport.kamar})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingReport(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Bidang OSIS</label>
                <select
                  value={editingReport.bidangOsis || 'OSIS Kamtib'}
                  onChange={(e) => setEditingReport({ ...editingReport, bidangOsis: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-semibold"
                >
                  <option value="OSIS Kamtib Banat (Putri)">OSIS Kamtib Banat (Putri)</option>
                  <option value="OSIS Kamtib Banin (Putra)">OSIS Kamtib Banin (Putra)</option>
                  <option value="OSIS Ubudiyah (Ibadah & Sholat)">OSIS Ubudiyah (Ibadah & Sholat)</option>
                  <option value="OSIS Bahasa (Arab & Inggris)">OSIS Bahasa (Arab & Inggris)</option>
                  <option value="OSIS Kebersihan & Lingkungan">OSIS Kebersihan & Lingkungan</option>
                  <option value="OSIS Olahraga & Seni">OSIS Olahraga & Seni</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Kategori</label>
                <select
                  value={editingReport.kategori || 'PELANGGARAN'}
                  onChange={(e) => setEditingReport({ ...editingReport, kategori: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-semibold"
                >
                  <option value="PELANGGARAN">PELANGGARAN</option>
                  <option value="PRESTASI">PRESTASI</option>
                  <option value="IBADAH">IBADAH</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="font-bold text-slate-700 block mb-1">Perihal / Jenis Kejadian</label>
                <input
                  type="text"
                  value={editingReport.jenis || ''}
                  onChange={(e) => setEditingReport({ ...editingReport, jenis: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-semibold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Poin</label>
                <input
                  type="number"
                  value={editingReport.poin ?? 0}
                  onChange={(e) => setEditingReport({ ...editingReport, poin: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-mono font-bold text-center"
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="font-bold text-slate-700 block mb-1">Keterangan &amp; Kronologi</label>
              <textarea
                rows={3}
                value={editingReport.keterangan || ''}
                onChange={(e) => setEditingReport({ ...editingReport, keterangan: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 leading-relaxed"
              />
            </div>

            <div className="text-xs">
              <label className="font-bold text-slate-700 block mb-1">Tindakan / Ta'zir Pembinaan</label>
              <input
                type="text"
                value={editingReport.tazir || ''}
                onChange={(e) => setEditingReport({ ...editingReport, tazir: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingReport(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Check className="w-4 h-4" />
                <span>Simpan Update ke Database</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

