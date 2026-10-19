import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  ShieldCheck, 
  Check, 
  X, 
  Clock, 
  AlertTriangle, 
  Award, 
  Home, 
  Search, 
  Filter, 
  Send, 
  UserCheck, 
  Sparkles,
  ExternalLink,
  ChevronRight,
  Plus,
  CreditCard,
  BellRing,
  ClipboardList
} from 'lucide-react';
import RfidCardManager from '../modules/RfidCardManager';
import MusyrifAlarmMonitor from '../modules/MusyrifAlarmMonitor';
import RealtimePermitBoard from '../modules/RealtimePermitBoard';
import SantriActivityAnalytics from '../modules/SantriActivityAnalytics';

export default function MusyrifDashboard() {
  const { 
    santriList, 
    permits, 
    approvePermit, 
    rejectPermit, 
    disciplineRecords,
    addDisciplineRecord,
    rooms,
    reminderThresholdMinutes,
    activeRoleTab,
    setActiveRoleTab
  } = useApp();

  const [filterKategori, setFilterKategori] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const selectedTab = (activeRoleTab === 'approval' || activeRoleTab === 'active_permits' || activeRoleTab === 'points' || activeRoleTab === 'kamar' || activeRoleTab === 'alarm_monitor' || activeRoleTab === 'rfid_management' || activeRoleTab === 'ai_santri') ? activeRoleTab : 'approval';
  const setSelectedTab = setActiveRoleTab;

  // Modal State for adding point
  const [isAddPointOpen, setIsAddPointOpen] = useState(false);
  const [pointForm, setPointForm] = useState({
    santriId: 'S-101',
    jenis: 'REWARD',
    kategori: 'Prestasi / Adab',
    poin: 10,
    deskripsi: ''
  });

  const pendingPermits = permits.filter(p => p.status === 'PENDING');
  const activePermits = permits.filter(p => p.status === 'ACTIVE' || p.status === 'APPROVED' || p.status === 'OVERDUE');

  // Calculate santri nearing return deadline (H-X minutes)
  const now = Date.now();
  const warningPermitsCount = permits.filter(p => {
    if (p.status !== 'ACTIVE') return false;
    const diffMs = new Date(p.batasKembali).getTime() - now;
    const sisaMenit = diffMs / 60000;
    return sisaMenit <= (reminderThresholdMinutes || 30) && sisaMenit > 0;
  }).length;

  const filteredPermits = permits.filter(p => {
    const santri = santriList.find(s => s.id === p.santriId);
    const matchKategori = filterKategori === 'ALL' || p.kategori === filterKategori;
    const matchSearch = !searchQuery || 
      (santri && santri.nama.toLowerCase().includes(searchQuery.toLowerCase())) ||
      p.tokenIzin.toLowerCase().includes(searchQuery.toLowerCase());
    return matchKategori && matchSearch;
  });

  const handleCreatePoint = (e) => {
    e.preventDefault();
    if (!pointForm.deskripsi) return;
    addDisciplineRecord(
      pointForm.santriId,
      pointForm.jenis,
      pointForm.kategori,
      pointForm.jenis === 'REWARD' ? Math.abs(pointForm.poin) : -Math.abs(pointForm.poin),
      pointForm.deskripsi
    );
    setIsAddPointOpen(false);
    setPointForm({
      santriId: 'S-101',
      jenis: 'REWARD',
      kategori: 'Prestasi / Adab',
      poin: 10,
      deskripsi: ''
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 pb-24">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-emerald-900 text-white rounded-2xl p-6 shadow-lg border border-teal-700/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-teal-700/80 text-teal-200 text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider font-mono">
              ROLE: MUSYRIF / PENGASUH ASRAMA
            </span>
            <span className="text-gold-300 text-xs flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              Otorisasi Izin & Pembinaan Karakter
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Pusat Pengasuhan Santri & Multi-Tier Approval
          </h1>
          <p className="text-xs text-teal-100 max-w-2xl mt-1">
            Setujui izin dengan sinkronisasi instan ke IoT Turnstile Gate, kelola buku induk poin kedisiplinan santri, dan pantau kerapian kamar asrama.
          </p>
        </div>

        {/* Quick Pending Counter Pill */}
        <div className="flex items-center gap-3 bg-teal-950/70 p-3.5 rounded-xl border border-teal-600/40">
          <div className="text-right font-mono">
            <span className="text-[10px] text-teal-300 block uppercase font-bold">Antrean Butuh Otorisasi</span>
            <span className="text-2xl font-black text-amber-300">
              {pendingPermits.length} <span className="text-xs text-teal-400 font-normal">Permintaan</span>
            </span>
          </div>
          <div className="p-2.5 bg-amber-500/20 text-amber-300 rounded-xl border border-amber-400/30">
            <Clock className="w-6 h-6 animate-spin-slow" />
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      {/* Musyrif Early-Warning Top Notification Bar */}
      {warningPermitsCount > 0 && selectedTab !== 'alarm_monitor' && (
        <div 
          onClick={() => setSelectedTab('alarm_monitor')}
          className="bg-amber-500 hover:bg-amber-600 text-white p-3 sm:p-3.5 rounded-2xl shadow-md flex items-center justify-between cursor-pointer transition animate-pulse"
        >
          <div className="flex items-center gap-2.5">
            <BellRing className="w-5 h-5 text-amber-200 animate-bounce shrink-0" />
            <div>
              <span className="text-xs font-black block">
                ALARM PERINGATAN: {warningPermitsCount} Santri Mendekati Batas Waktu Izin (H-{reminderThresholdMinutes || 30}m)!
              </span>
              <span className="text-[11px] text-amber-100 hidden sm:inline">
                Pesan pengingat otomatis telah disiapkan untuk dikirim ke nomor WA wali santri.
              </span>
            </div>
          </div>
          <span className="text-[11px] bg-amber-700 hover:bg-amber-800 px-3 py-1.5 rounded-xl font-bold font-mono shrink-0 shadow-xs">
            Buka Panel Alarm ➜
          </span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="scroll-row gap-2">
          {[
            { id: 'approval', label: `Antrean Otorisasi (${pendingPermits.length})`, icon: ShieldCheck },
            { id: 'ai_santri', label: '🤖 AI Evaluasi Harian Santri', icon: Sparkles },
            { id: 'alarm_monitor', label: `🔔 Pantau & Alarm Pengingat (${warningPermitsCount})`, icon: BellRing },
            { id: 'active_permits', label: `📋 Papan Realtime & Log Book (${permits.length})`, icon: ClipboardList },
            { id: 'points', label: 'Buku Induk Poin', icon: Award },
            { id: 'kamar', label: 'Kamar Asrama', icon: Home },
            { id: 'rfid_management', label: '💳 Master Kartu RFID', icon: CreditCard }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = selectedTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap shadow-sm ${
                  isActive
                    ? 'bg-teal-700 text-white shadow-teal-200'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {selectedTab === 'points' && (
          <button
            onClick={() => setIsAddPointOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Catatan Karakter / Reward</span>
          </button>
        )}
      </div>

      {/* TAB 1: ANTREAN OTORISASI IZIN (1-TOUCH APPROVE/REJECT) */}
      {selectedTab === 'approval' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-teal-600" />
              Antrean Permintaan Izin Masuk (Memerlukan Otorisasi Musyrif)
            </h2>
            <span className="text-xs text-slate-500">
              Sinkronisasi real-time ke IoT Gate & WhatsApp Wali Santri
            </span>
          </div>

          {pendingPermits.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center mb-3">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 mb-1">
                Semua Izin Telah Diproses!
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Tidak ada santri dalam antrean perizinan saat ini. Buka tab Wali Santri untuk menyimulasikan pengajuan izin baru santri.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingPermits.map(permit => {
                const santri = santriList.find(s => s.id === permit.santriId);
                return (
                  <div
                    key={permit.id}
                    className="bg-white rounded-2xl border-2 border-amber-300 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Bar with Santri Profile */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={santri?.foto}
                            alt={santri?.nama}
                            className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-xs"
                          />
                          <div>
                            <h3 className="font-bold text-slate-900 text-sm leading-tight">
                              {santri?.nama}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-mono text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.2 rounded font-bold">
                                UID: {santri?.rfidUid}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                NIS: {santri?.nis}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Kls {santri?.kelas} • {santri?.kamar}
                            </p>
                            <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                              Poin Ri'ayah: {santri?.poinDisiplin}/100
                            </p>
                          </div>
                        </div>

                        <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2.5 py-1 rounded-full uppercase">
                          {permit.kategori}
                        </span>
                      </div>

                      {/* Detail Keperluan */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs mb-3 space-y-1.5">
                        <p className="text-slate-800">
                          <b className="text-slate-600">Alasan:</b> "{permit.keperluan}"
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-600 pt-1 border-t border-slate-200">
                          <div>
                            <span className="text-[10px] text-slate-400 block font-sans">Batas Kembali:</span>
                            <b className="text-rose-600">
                              {new Date(permit.batasKembali).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                            </b>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-sans">Penjemput:</span>
                            <b>{permit.penjemput}</b>
                          </div>
                        </div>
                      </div>

                      {/* Wali info */}
                      <div className="text-[11px] text-slate-500 flex items-center justify-between mb-4">
                        <span>Diajukan oleh: <b>{santri?.wali.nama}</b></span>
                        <span className="font-mono text-emerald-700 font-semibold">{santri?.wali.telepon}</span>
                      </div>
                    </div>

                    {/* Action Buttons: 1-Touch Approve & Reject */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => {
                          const catatan = prompt('Masukkan catatan persetujuan untuk santri & wali:', 'Disetujui. Harap kembali tepat waktu sebelum bel tidur asrama berbunyi.');
                          if (catatan !== null) {
                            approvePermit(permit.id, catatan);
                          }
                        }}
                        className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition shadow-sm"
                      >
                        <Check className="w-4 h-4" />
                        <span>APPROVE (SETUJUI)</span>
                      </button>

                      <button
                        onClick={() => {
                          const alasan = prompt('Alasan penolakan izin santri:', 'Jadwal asrama sedang padat atau alasan belum mendesak.');
                          if (alasan) {
                            rejectPermit(permit.id, alasan);
                          }
                        }}
                        className="flex items-center justify-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold py-2.5 px-3 rounded-xl text-xs transition"
                      >
                        <X className="w-4 h-4" />
                        <span>TOLAK IZIN</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PAPAN REALTIME & LOG BOOK PERIZINAN RESMI */}
      {selectedTab === 'active_permits' && (
        <RealtimePermitBoard />
      )}

      {/* TAB 3: BUKU INDUK POIN RI'AYAH */}
      {selectedTab === 'points' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Award className="w-5 h-5 text-gold-500" />
                Catatan Pengasuhan, Reward & Pelanggaran Santri
              </h3>
              <p className="text-xs text-slate-500">
                Termasuk catatan pelanggaran otomatis (Auto-Audit) dari keterlambatan gerbang turnstile.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {disciplineRecords.map(item => {
              const s = santriList.find(x => x.id === item.santriId);
              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border flex items-start justify-between gap-3 text-xs ${
                    item.jenis === 'REWARD'
                      ? 'bg-emerald-50/70 border-emerald-200'
                      : 'bg-rose-50/70 border-rose-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        item.jenis === 'REWARD' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                      }`}>
                        {item.jenis}
                      </span>
                      <span className="font-bold text-slate-900 text-sm">
                        {s?.nama} ({s?.kelas})
                      </span>
                      <span className="text-[11px] text-slate-500 font-semibold">• {item.kategori}</span>
                      <span className="text-[10px] text-slate-400 font-mono ml-auto">{item.tanggal}</span>
                    </div>

                    <p className="text-slate-700 mt-1">
                      {item.deskripsi}
                    </p>

                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1.5">
                      <span>Pencatat: <b>{item.pencatat}</b></span>
                      <span>•</span>
                      <span>Sisa Skor Santri: <b className="text-slate-700">{s?.poinDisiplin}/100</b></span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`text-xl font-black font-mono ${
                      item.poin > 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {item.poin > 0 ? `+${item.poin}` : item.poin}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: MANAJEMEN KAMAR ASRAMA */}
      {selectedTab === 'kamar' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {rooms.map(room => (
            <div key={room.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{room.nomorKamar}</h4>
                  <p className="text-[11px] text-slate-500">{room.namaGedung}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-bold">Skor Kerapian</span>
                  <span className="text-lg font-black text-emerald-600 font-mono">{room.skorKerapianTerakhir}/100</span>
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-700">
                <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                  <span className="text-slate-500">Ketua Kamar:</span>
                  <span className="font-bold text-slate-800">{room.ketuaKamar}</span>
                </div>
                <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                  <span className="text-slate-500">Piket Hari Ini:</span>
                  <span className="font-bold text-emerald-700">{room.jadwalPiketHariIni}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-teal-50/60 border border-teal-100 text-[11px]">
                  <b className="text-teal-900 block mb-0.5">Catatan Inspeksi Musyrif:</b>
                  <p className="text-slate-600 italic">"{room.catatanInspeksi}"</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB: ALARM MONITOR & LIVE EARLY-WARNING TRACKER */}
      {selectedTab === 'alarm_monitor' && (
        <div className="space-y-6 animate-fade-in">
          <MusyrifAlarmMonitor />
        </div>
      )}

      {/* TAB 5: DAFTAR & KELOLA KARTU IDENTITAS RFID */}
      {selectedTab === 'rfid_management' && (
        <RfidCardManager isModal={false} />
      )}

      {/* TAB 6: AI EVALUASI HARIAN SANTRI (DEEPSEEK AI) */}
      {selectedTab === 'ai_santri' && (
        <div className="space-y-6 animate-fade-in">
          <SantriActivityAnalytics />
        </div>
      )}

      {/* Modal Add Point */}
      {isAddPointOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto my-auto animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Award className="w-5 h-5 text-gold-500" />
                Tambah Catatan Smart Ri'ayah
              </h3>
              <button onClick={() => setIsAddPointOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePoint} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Pilih Santri</label>
                <select
                  value={pointForm.santriId}
                  onChange={(e) => setPointForm({ ...pointForm, santriId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold text-slate-800"
                >
                  {santriList.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.nama} ({s.kelas}) - Skor: {s.poinDisiplin}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jenis</label>
                  <select
                    value={pointForm.jenis}
                    onChange={(e) => setPointForm({ ...pointForm, jenis: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold"
                  >
                    <option value="REWARD">REWARD (Prestasi)</option>
                    <option value="PELANGGARAN">PELANGGARAN (Disiplin)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Besar Poin</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={pointForm.poin}
                    onChange={(e) => setPointForm({ ...pointForm, poin: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Kategori</label>
                <input
                  type="text"
                  value={pointForm.kategori}
                  onChange={(e) => setPointForm({ ...pointForm, kategori: e.target.value })}
                  placeholder="Contoh: Prestasi MQK / Kerapian Kamar"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Deskripsi Catatan</label>
                <textarea
                  rows="2"
                  value={pointForm.deskripsi}
                  onChange={(e) => setPointForm({ ...pointForm, deskripsi: e.target.value })}
                  placeholder="Jelaskan detail prestasi atau pelanggaran santri..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                ></textarea>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddPointOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow"
                >
                  Simpan & Kirim WA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
