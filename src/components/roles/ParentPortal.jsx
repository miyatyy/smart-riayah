import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  CreditCard, 
  Send, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Award, 
  BookOpen, 
  Sparkles, 
  HeartHandshake, 
  ShoppingBag, 
  Shield, 
  Calendar, 
  User, 
  Activity, 
  ChevronRight,
  Flame,
  Check,
  Smartphone,
  Sliders
} from 'lucide-react';
import SantriActivityAnalytics from '../modules/SantriActivityAnalytics';

export default function ParentPortal() {
  const { 
    santriList, 
    activeSantriId, 
    setActiveSantriId, 
    permits, 
    submitPermit, 
    disciplineRecords,
    mutabaahList,
    medicalRecords,
    rfidTransactions,
    setDailySpendLimit,
    activeRoleTab,
    setActiveRoleTab,
    openAiAgentForSantri
  } = useApp();

  const activeTab = (activeRoleTab === 'permit' || activeRoleTab === 'aktivitas' || activeRoleTab === 'riayah' || activeRoleTab === 'ibadah' || activeRoleTab === 'cashless' || activeRoleTab === 'kesehatan') ? activeRoleTab : 'permit';
  const setActiveTab = setActiveRoleTab;

  // Form State
  const [formData, setFormData] = useState({
    kategori: 'Pesiar',
    keperluan: '',
    penjemput: '',
    waktuKeluarRencana: '',
    batasKembali: ''
  });

  const [formSubmittedNotice, setFormSubmittedNotice] = useState(false);

  const activeSantri = santriList.find(s => s.id === activeSantriId) || santriList[0];
  const santriPermits = permits.filter(p => p.santriId === activeSantri.id);
  const santriDiscipline = disciplineRecords.filter(d => d.santriId === activeSantri.id);
  const santriMutabaah = mutabaahList.find(m => m.santriId === activeSantri.id) || mutabaahList[0];
  const santriMedical = medicalRecords.filter(m => m.santriId === activeSantri.id);
  const santriTrx = rfidTransactions.filter(t => t.santriId === activeSantri.id);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!formData.keperluan || !formData.batasKembali) {
      alert('Harap isi alasan keperluan dan batas waktu kembali!');
      return;
    }

    submitPermit({
      santriId: activeSantri.id,
      kategori: formData.kategori,
      keperluan: formData.keperluan,
      penjemput: formData.penjemput || activeSantri.wali.nama,
      waktuKeluarRencana: formData.waktuKeluarRencana || new Date().toISOString().slice(0, 16),
      batasKembali: formData.batasKembali
    });

    setFormData({
      kategori: 'Pesiar',
      keperluan: '',
      penjemput: '',
      waktuKeluarRencana: '',
      batasKembali: ''
    });

    setFormSubmittedNotice(true);
    setTimeout(() => setFormSubmittedNotice(false), 5000);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return <span className="bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1"><Clock className="w-3 h-3" /> MENUNGGU PERSETUJUAN</span>;
      case 'APPROVED':
        return <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> DISETUJUI (SIAP TAP GATE)</span>;
      case 'ACTIVE':
        return <span className="bg-blue-100 text-blue-800 border border-blue-300 px-2.5 py-0.5 rounded-full text-xs font-bold animate-pulse flex items-center gap-1"><Flame className="w-3 h-3" /> SEDANG DI LUAR</span>;
      case 'OVERDUE':
        return <span className="bg-rose-100 text-rose-800 border border-rose-300 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 animate-bounce"><AlertCircle className="w-3 h-3" /> TERLAMBAT (OVERDUE)</span>;
      case 'COMPLETED':
        return <span className="bg-slate-100 text-slate-700 border border-slate-300 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1"><Check className="w-3 h-3" /> SELESAI (KEMBALI)</span>;
      case 'REJECTED':
        return <span className="bg-red-100 text-red-800 border border-red-300 px-2.5 py-0.5 rounded-full text-xs font-bold">DITOLAK</span>;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-20 pt-4 px-4 sm:px-6">
      {/* Mobile-first simulated banner */}
      <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-emerald-700" />
          <span className="text-xs font-bold text-emerald-900">
            Aplikasi Wali Santri & Santri Mobile
          </span>
        </div>
        {/* Quick Santri Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-600 font-medium">Pilih Santri:</label>
          <select
            value={activeSantriId}
            onChange={(e) => setActiveSantriId(e.target.value)}
            className="text-xs font-bold bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-800 focus:ring-1 focus:ring-emerald-500"
          >
            {santriList.map(s => (
              <option key={s.id} value={s.id}>
                {s.nama} ({s.kelas})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Santri RFID Smart Card Virtual Badge */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-tr from-emerald-900 via-emerald-800 to-teal-900 text-white p-5 sm:p-6 shadow-xl border border-emerald-600/40 mb-6">
        {/* Decorative holographic chip & curves */}
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-emerald-500/10 blur-2xl"></div>
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <div className="text-right">
            <p className="text-[10px] text-emerald-300 uppercase tracking-widest font-mono">13.56 MHz RFID CARD</p>
            <p className="text-xs font-mono font-bold text-gold-300">UID: {activeSantri.rfidUid}</p>
          </div>
          <div className="w-9 h-7 rounded bg-amber-400/90 border border-amber-300 flex items-center justify-center shadow-inner">
            <div className="w-6 h-4 border border-amber-800/40 rounded-sm grid grid-cols-2 gap-0.5 p-0.5">
              <div className="bg-amber-600/60 rounded-xs"></div>
              <div className="bg-amber-600/60 rounded-xs"></div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <img
            src={activeSantri.foto}
            alt={activeSantri.nama}
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 border-gold-400 shadow-md"
          />
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] bg-emerald-700/80 text-emerald-200 px-2 py-0.5 rounded font-mono font-semibold">
                NIS: {activeSantri.nis}
              </span>
              <span className="text-[11px] bg-gold-500/20 text-gold-300 border border-gold-400/30 px-2 py-0.5 rounded font-semibold">
                Kelas: {activeSantri.kelas}
              </span>
              <span className="text-[11px] font-mono bg-emerald-950/80 text-cyan-300 border border-cyan-400/40 px-2 py-0.5 rounded font-bold">
                UID: {activeSantri.rfidUid}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {activeSantri.nama}
            </h1>
            <p className="text-xs text-emerald-200 flex items-center gap-1.5">
              <span>{activeSantri.kamar}</span>
              <span>•</span>
              <span>Wali: {activeSantri.wali.nama}</span>
            </p>

            {/* Status Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                activeSantri.statusAsrama === 'DI_ASRAMA'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                  : activeSantri.statusAsrama === 'TERLAMBAT'
                  ? 'bg-rose-500/30 text-rose-300 border border-rose-400/40 animate-pulse'
                  : 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
              }`}>
                ● Status Asrama: {activeSantri.statusAsrama.replace('_', ' ')}
              </span>

              <span className="text-[11px] font-semibold bg-emerald-950/60 text-gold-300 px-2 py-0.5 rounded-full border border-gold-500/30">
                Poin Ri'ayah: <b>{activeSantri.poinDisiplin}/100</b>
              </span>

              <span className="text-[11px] font-semibold bg-emerald-950/60 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-600/40">
                Saldo RFID: <b>Rp {activeSantri.saldoRfid.toLocaleString('id-ID')}</b>
              </span>

              <button
                onClick={() => setActiveTab('aktivitas')}
                className="text-[11px] font-bold bg-indigo-500/30 hover:bg-indigo-500/50 text-indigo-200 px-2.5 py-0.5 rounded-full border border-indigo-400/40 flex items-center gap-1 transition shadow-xs cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-gold-300" />
                <span>Lihat Diagram</span>
              </button>

              <button
                onClick={() => openAiAgentForSantri?.(activeSantri.id)}
                className="text-[11px] font-bold bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white px-3 py-0.5 rounded-full border border-indigo-300/40 flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                title="Buka AI Agent Konsultasi Santri"
              >
                <Sparkles className="w-3 h-3 text-cyan-200" />
                <span>🤖 Tanya AI Agent</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 border-b border-slate-200">
        {[
          { id: 'permit', label: 'Smart Permit (Izin)', icon: Calendar },
          { id: 'aktivitas', label: 'Diagram Aktivitas & AI', icon: Sparkles, isAi: true },
          { id: 'riayah', label: 'Buku Poin & Karakter', icon: Award },
          { id: 'ibadah', label: 'Ibadah & Tahfidz', icon: BookOpen },
          { id: 'cashless', label: 'Smart Card & POS', icon: ShoppingBag },
          { id: 'kesehatan', label: 'Poskestren', icon: Activity }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-md'
                  : tab.isAi
                  ? 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className={`w-4 h-4 ${tab.isAi && !isActive ? 'text-indigo-600' : ''}`} />
              <span>{tab.label}</span>
              {tab.isAi && !isActive && (
                <span className="bg-indigo-600 text-white text-[9px] px-1.5 py-0.2 rounded font-mono font-bold">
                  AI
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: SMART PERMIT (Pengajuan & Riwayat Izin) */}
      {activeTab === 'permit' && (
        <div className="space-y-6">
          {formSubmittedNotice && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-4 rounded-xl text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>
                  <b>Alhamdulillah!</b> Formulir izin berhasil diajukan ke antrean Musyrif Asrama dan terhubung ke simulasi WhatsApp.
                </span>
              </div>
            </div>
          )}

          {/* Form Pengajuan Izin */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-600" />
                  Formulir Pengajuan Izin Santri
                </h3>
                <p className="text-xs text-slate-500">
                  Ajukan perizinan resmi keluar pondok terhubung langsung dengan Smart Turnstile Gate.
                </p>
              </div>
              <span className="text-[11px] font-mono bg-emerald-50 text-emerald-700 px-2 py-1 rounded font-bold border border-emerald-200">
                Otorisasi Multi-Tier
              </span>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Kategori Izin */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kategori Izin <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.kategori}
                    onChange={(e) => setFormData({ ...formData, kategori: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-slate-800 font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="Pesiar">Pesiar (Keluar Harian/Belanja)</option>
                    <option value="Pulang Bermalam">Pulang Bermalam (Acara Keluarga)</option>
                    <option value="Berobat">Berobat (Klinik/RS Luar)</option>
                  </select>
                </div>

                {/* Penjemput / Pendamping */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Penjemput / Pendamping
                  </label>
                  <input
                    type="text"
                    value={formData.penjemput}
                    onChange={(e) => setFormData({ ...formData, penjemput: e.target.value })}
                    placeholder={`Contoh: ${activeSantri.wali.nama} / Paman`}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Waktu Rencana Keluar */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Waktu Keluar <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.waktuKeluarRencana}
                    onChange={(e) => setFormData({ ...formData, waktuKeluarRencana: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-slate-800 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Batas Waktu Kembali */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Batas Waktu Wajib Kembali (Deadlock Gate) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.batasKembali}
                    onChange={(e) => setFormData({ ...formData, batasKembali: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-rose-200 rounded-xl px-3 py-2.5 text-slate-800 font-mono focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Alasan Keperluan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alasan & Keperluan Terinci <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows="2"
                  required
                  value={formData.keperluan}
                  onChange={(e) => setFormData({ ...formData, keperluan: e.target.value })}
                  placeholder="Jelaskan tujuan izin secara jelas untuk ditinjau oleh Musyrif Asrama..."
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                ></textarea>
              </div>

              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md"
              >
                <Send className="w-4 h-4" />
                <span>Kirim Pengajuan Izin ke Musyrif Asrama</span>
              </button>
            </form>
          </div>

          {/* Riwayat & Status Izin Santri Ini */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              Riwayat Izin {activeSantri.nama}
            </h3>

            {santriPermits.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                Belum ada riwayat izin yang diajukan untuk santri ini.
              </p>
            ) : (
              <div className="space-y-3">
                {santriPermits.map((p) => (
                  <div
                    key={p.id}
                    className="border border-slate-200 rounded-xl p-4 hover:border-emerald-300 transition bg-slate-50/50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-800">
                          {p.tokenIzin}
                        </span>
                        <span className="text-[10px] font-mono text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.2 rounded font-bold">
                          UID: {activeSantri.rfidUid}
                        </span>
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                          {p.kategori}
                        </span>
                      </div>
                      {getStatusBadge(p.status)}
                    </div>

                    <p className="text-xs text-slate-700 mb-2">
                      <b>Keperluan:</b> {p.keperluan}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-500 font-mono bg-white p-2.5 rounded-lg border border-slate-200">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Rencana / Aktual Keluar:</span>
                        <b>{new Date(p.waktuKeluarRencana).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</b>
                        {p.waktuKeluarAktual && (
                          <span className="text-blue-600 ml-1">
                            (Tap: {new Date(p.waktuKeluarAktual).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })})
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Batas Waktu Kembali:</span>
                        <b className="text-rose-600">{new Date(p.batasKembali).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</b>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Penjemput / Pendamping:</span>
                        <b>{p.penjemput}</b>
                      </div>
                    </div>

                    {p.catatanMusyrif && (
                      <div className="mt-2 text-[11px] text-slate-600 bg-emerald-50/80 border border-emerald-100 p-2 rounded">
                        <span className="font-bold text-emerald-800">Catatan Pengasuh:</span> {p.catatanMusyrif}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: DIAGRAM AKTIVITAS BULANAN & KESIMPULAN AI */}
      {activeTab === 'aktivitas' && (
        <SantriActivityAnalytics activeSantri={activeSantri} />
      )}

      {/* TAB 2: SMART RI'AYAH (Kedisiplinan & Poin) */}
      {activeTab === 'riayah' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Award className="w-5 h-5 text-gold-500" />
                  Buku Induk Karakter & Kedisiplinan
                </h3>
                <p className="text-xs text-slate-500">
                  Evaluasi adab, kedisiplinan gerbang, dan catatan prestasi akademik/pesantren.
                </p>
              </div>

              {/* Score Indicator */}
              <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">Indeks Adab & Disiplin</span>
                  <span className="text-2xl font-black text-emerald-600">
                    {activeSantri.poinDisiplin} <span className="text-xs text-slate-400 font-normal">/ 100</span>
                  </span>
                </div>
                <div className={`p-2.5 rounded-xl ${activeSantri.poinDisiplin >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  <Shield className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* Riwayat Poin */}
            <div className="space-y-3">
              {santriDiscipline.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  Belum ada catatan pelanggaran atau penghargaan untuk santri ini.
                </p>
              ) : (
                santriDiscipline.map(item => (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
                      item.jenis === 'REWARD'
                        ? 'bg-emerald-50/60 border-emerald-200'
                        : 'bg-rose-50/60 border-rose-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          item.jenis === 'REWARD' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                        }`}>
                          {item.jenis}
                        </span>
                        <span className="text-xs font-bold text-slate-800">
                          {item.kategori}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {item.tanggal}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700">
                        {item.deskripsi}
                      </p>
                      <span className="text-[10px] text-slate-400 block mt-1">
                        Pencatat: {item.pencatat}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`text-base font-black font-mono ${
                        item.poin > 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {item.poin > 0 ? `+${item.poin}` : item.poin}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: IBADAH & TAHFIDZ (Mutaba'ah Yaumiyah) */}
      {activeTab === 'ibadah' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
            <h3 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-600" />
              Mutaba'ah Yaumiyah & Presensi Shalat Berjamaah
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Pencatatan kehadiran shalat fardhu di Masjid Jami' via tap RFID Smart Card.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
              {[
                { name: 'Subuh', status: santriMutabaah.subuh },
                { name: 'Dzuhur', status: santriMutabaah.dzuhur },
                { name: 'Ashar', status: santriMutabaah.ashar },
                { name: 'Maghrib', status: santriMutabaah.maghrib },
                { name: 'Isya', status: santriMutabaah.isya }
              ].map((s, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">{s.name}</span>
                  <div className="my-1.5 flex justify-center">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  </div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                    Masjid Tap
                  </span>
                </div>
              ))}
            </div>

            {/* Tahfidz Section */}
            <div className="bg-gradient-to-r from-emerald-900 to-teal-900 text-white p-5 rounded-2xl border border-emerald-700/60 shadow">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3 pb-3 border-b border-emerald-800">
                <div>
                  <span className="text-[10px] font-bold text-gold-300 uppercase tracking-widest font-mono">
                    PROGRES TAHFIDZ AL-QUR'AN
                  </span>
                  <h4 className="text-lg font-bold">
                    Capaian Hafalan: Juz {santriMutabaah.tahfidz?.juz || activeSantri.tahfidzJuz} Mutqin
                  </h4>
                </div>
                <span className="bg-gold-500 text-slate-900 font-black px-3 py-1 rounded-full text-xs shadow">
                  Predikat: {santriMutabaah.tahfidz?.predikat || 'MUMTAZ'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-emerald-950/60 p-3 rounded-xl border border-emerald-700/40">
                  <span className="text-[10px] text-emerald-300 block">Ziyadah (Setoran Baru):</span>
                  <p className="font-bold text-sm">Surah {santriMutabaah.tahfidz?.surah || 'An-Nisa'} Ayat {santriMutabaah.tahfidz?.ayat || '1-14'}</p>
                </div>
                <div className="bg-emerald-950/60 p-3 rounded-xl border border-emerald-700/40">
                  <span className="text-[10px] text-emerald-300 block">Muroja'ah Rutin:</span>
                  <p className="font-bold text-sm">{santriMutabaah.tahfidz?.murojaah || 'Juz 1-3 Lancar'}</p>
                </div>
                <div className="bg-emerald-950/60 p-3 rounded-xl border border-emerald-700/40">
                  <span className="text-[10px] text-emerald-300 block">Musyrif Halaqah:</span>
                  <p className="font-bold text-sm">{santriMutabaah.tahfidz?.ustadz || 'Ust. Hafizhuddin'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SMART CARD & CASHLESS KANTIN */}
      {activeTab === 'cashless' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-emerald-600" />
                  Dompet Digital & Smart Card Santri (IdeaPOS)
                </h3>
                <p className="text-xs text-slate-500">
                  Pantau jajan santri di kantin, laundry asrama, dan atur batasan jajan harian orang tua.
                </p>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Sisa Saldo RFID</span>
                <span className="text-2xl font-black text-emerald-700 font-mono">
                  Rp {activeSantri.saldoRfid.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            {/* Daily Spending Limit Controller from Parents */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-amber-700" />
                    Batas Jajan Harian dari Orang Tua (Parental Spending Cap)
                  </h4>
                  <p className="text-[11px] text-amber-800">
                    Sistem Smart POS akan otomatis menolak transaksi jika akumulasi belanja harian melebihi limit.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold font-mono text-slate-800">Rp</span>
                  <input
                    type="number"
                    step="5000"
                    value={activeSantri.limitJajanHarian}
                    onChange={(e) => setDailySpendLimit(activeSantri.id, e.target.value)}
                    className="w-28 text-xs font-bold bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:ring-1 focus:ring-amber-500"
                  />
                  <span className="text-[10px] text-slate-500">/ hari</span>
                </div>
              </div>
            </div>

            {/* Riwayat Transaksi */}
            <h4 className="text-xs font-bold text-slate-700 mb-2">Riwayat Transaksi Terakhir</h4>
            <div className="space-y-2">
              {santriTrx.map(trx => (
                <div key={trx.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                  <div>
                    <div className="font-bold text-slate-800">{trx.merchant}</div>
                    <div className="text-[11px] text-slate-500">{trx.keterangan}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{trx.tanggal}</div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-rose-600 font-mono">
                      -Rp {trx.nominal.toLocaleString('id-ID')}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      Sisa: Rp {trx.saldoAkhir.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: POSKESTREN & KESEHATAN */}
      {activeTab === 'kesehatan' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-rose-600" />
                  Rekam Medis Klinik Asrama (Poskestren)
                </h3>
                <p className="text-xs text-slate-500">
                  Histori riwayat keluhan, resep obat, istirahat asrama, dan rujukan rumah sakit.
                </p>
              </div>
              <span className="text-xs bg-rose-50 text-rose-700 px-2.5 py-1 rounded-full font-bold border border-rose-200">
                Penyakit Khusus: {activeSantri.penyakitKhusus}
              </span>
            </div>

            {santriMedical.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                Alhamdulillah, tidak ada riwayat keluhan sakit dalam kurun waktu aktif.
              </p>
            ) : (
              <div className="space-y-3">
                {santriMedical.map(med => (
                  <div key={med.id} className="p-4 border border-slate-200 rounded-xl bg-slate-50 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{med.diagnosa}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{med.tanggal}</span>
                    </div>
                    <p className="text-slate-600">
                      <b>Keluhan:</b> {med.keluhan}
                    </p>
                    <p className="text-slate-600">
                      <b>Tindakan/Resep:</b> {med.tindakan}
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded text-[10px] font-bold">
                        {med.statusIstirahat}
                      </span>
                      <span className="text-slate-400 text-[10px]">
                        Pemeriksa: {med.petugasKlinik}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
