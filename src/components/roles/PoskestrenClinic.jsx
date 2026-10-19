import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  HeartPulse, 
  Activity, 
  AlertCircle, 
  Plus, 
  Send, 
  CheckCircle, 
  Hospital, 
  FileText, 
  Pill, 
  UserCheck, 
  ShieldAlert,
  Sparkles
} from 'lucide-react';
import SantriActivityAnalytics from '../modules/SantriActivityAnalytics';

export default function PoskestrenClinic() {
  const { 
    santriList, 
    medicalRecords, 
    addMedicalRecord, 
    referToHospital,
    activeRoleTab,
    setActiveRoleTab
  } = useApp();

  const activeTab = activeRoleTab === 'ai_health' ? 'ai_health' : 'rekam_medis';
  const setActiveTab = setActiveRoleTab;

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formData, setFormData] = useState({
    santriId: 'S-101',
    keluhan: '',
    diagnosa: '',
    tindakan: '',
    statusIstirahat: 'ISTIRAHAT_ASRAMA',
    durasiIstirahat: '1 Hari',
    butuhRujukanRs: false,
    rsRujukan: 'RS Nahdlatul Ulama'
  });

  const [referralNotice, setReferralNotice] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.keluhan || !formData.diagnosa) {
      alert('Harap isi keluhan dan diagnosa medis!');
      return;
    }

    addMedicalRecord({
      santriId: formData.santriId,
      keluhan: formData.keluhan,
      diagnosa: formData.diagnosa,
      tindakan: formData.tindakan,
      statusIstirahat: formData.statusIstirahat,
      durasiIstirahat: formData.durasiIstirahat,
      butuhRujukanRs: formData.butuhRujukanRs,
      rsRujukan: formData.butuhRujukanRs ? formData.rsRujukan : null
    });

    if (formData.butuhRujukanRs) {
      referToHospital(formData.santriId, formData.rsRujukan, formData.diagnosa);
      setReferralNotice(true);
      setTimeout(() => setReferralNotice(false), 5000);
    }

    setIsAddOpen(false);
    setFormData({
      santriId: 'S-101',
      keluhan: '',
      diagnosa: '',
      tindakan: '',
      statusIstirahat: 'ISTIRAHAT_ASRAMA',
      durasiIstirahat: '1 Hari',
      butuhRujukanRs: false,
      rsRujukan: 'RS Nahdlatul Ulama'
    });
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Clinic Header Banner */}
      <div className="bg-gradient-to-r from-rose-900 via-rose-800 to-pink-900 text-white rounded-2xl p-6 shadow-lg border border-rose-700/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-rose-700/80 text-rose-200 text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider font-mono">
              ROLE: PETUGAS POSKESTREN
            </span>
            <span className="text-pink-200 text-xs flex items-center gap-1">
              <HeartPulse className="w-3.5 h-3.5" />
              Klinik Kesehatan & Layanan Medis Asrama
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Pos Kesehatan Pesantren (Poskestren Terpadu)
          </h1>
          <p className="text-xs text-rose-100 max-w-2xl mt-1">
            Kelola rekam medis santri, surat istirahat asrama, serta fitur rujukan rumah sakit luar yang otomatis terintegrasi ke Smart Permit dan notifikasi WhatsApp orang tua.
          </p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-2 bg-white text-rose-900 hover:bg-rose-50 px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition"
        >
          <Plus className="w-4 h-4" />
          <span>Pemeriksaan Baru / Rujukan RS</span>
        </button>
      </div>

      {referralNotice && (
        <div className="bg-purple-50 border border-purple-300 text-purple-900 p-4 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hospital className="w-5 h-5 text-purple-600" />
            <span>
              <b>Rujukan Rumah Sakit Berhasil!</b> Tiket izin berobat telah otomatis diterbitkan di Smart Gate dan notifikasi resmi dikirim ke WhatsApp orang tua.
            </span>
          </div>
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase block">Total Rekam Medis</span>
          <span className="text-2xl font-black text-slate-800 font-mono">{medicalRecords.length} Catatan</span>
          <p className="text-[10px] text-slate-400 mt-0.5">Pemeriksaan klinik aktif</p>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase block">Santri Istirahat Asrama</span>
          <span className="text-2xl font-black text-rose-600 font-mono">
            {medicalRecords.filter(m => m.statusIstirahat === 'ISTIRAHAT_ASRAMA').length} Santri
          </span>
          <p className="text-[10px] text-slate-400 mt-0.5">Dispensasi kegiatan madrasah</p>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase block">Rujukan RS Luar Terbit</span>
          <span className="text-2xl font-black text-purple-600 font-mono">
            {medicalRecords.filter(m => m.butuhRujukanRs).length} Rujukan
          </span>
          <p className="text-[10px] text-slate-400 mt-0.5">Terintegrasi izin berobat Smart Gate</p>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('rekam_medis')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs ${
            activeTab === 'rekam_medis'
              ? 'bg-rose-700 text-white'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Buku Rekam Medis ({medicalRecords.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ai_health')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs ${
            activeTab === 'ai_health'
              ? 'bg-indigo-700 text-white shadow-indigo-200'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>🤖 AI Pola Aktivitas & Kesehatan Santri (DeepSeek)</span>
        </button>
      </div>

      {/* TAB 2: AI POLA AKTIVITAS & MEDIS */}
      {activeTab === 'ai_health' && (
        <div className="space-y-6 animate-fade-in">
          <SantriActivityAnalytics />
        </div>
      )}

      {/* TAB 1: Medical Records Table */}
      {activeTab === 'rekam_medis' && (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-5 h-5 text-rose-600" />
            Buku Induk Rekam Medis Santri
          </h3>
          <span className="text-xs text-slate-500">
            Terhubung ke WhatsApp & Profil Santri
          </span>
        </div>

        <div className="space-y-3">
          {medicalRecords.map(med => {
            const s = santriList.find(x => x.id === med.santriId);
            return (
              <div
                key={med.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white transition space-y-2 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">
                      {s?.nama}
                    </span>
                    <span className="text-slate-500">({s?.kelas} • {s?.kamar})</span>
                    <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded">
                      {med.diagnosa}
                    </span>
                  </div>

                  <span className="text-[10px] text-slate-400 font-mono">
                    {med.tanggal}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 bg-white p-3 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Keluhan & Gejala:</span>
                    <p className="font-medium">{med.keluhan}</p>
                    {s?.penyakitKhusus && s.penyakitKhusus !== '-' && (
                      <span className="text-[10px] text-rose-600 block mt-1 font-bold">
                        ⚠️ Alergi / Riwayat Khusus: {s.penyakitKhusus}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Tindakan Medis & Resep:</span>
                    <p className="font-medium text-emerald-800">{med.tindakan}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded font-bold ${
                      med.statusIstirahat === 'RUJUKAN_RS'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {med.statusIstirahat.replace('_', ' ')}
                    </span>
                    {med.durasiIstirahat && (
                      <span className="text-slate-500 font-mono">({med.durasiIstirahat})</span>
                    )}
                  </div>

                  <span className="text-slate-400">
                    Tenaga Medis: <b>{med.petugasKlinik}</b>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* Modal Pemeriksaan Baru */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 my-auto overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 shrink-0 bg-white">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-rose-600" />
                Input Catatan Medis & Rujukan Rumah Sakit
              </h3>
              <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Pilih Santri yang Sakit</label>
                <select
                  value={formData.santriId}
                  onChange={(e) => setFormData({ ...formData, santriId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold text-slate-800"
                >
                  {santriList.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.nama} ({s.kelas}) - {s.kamar}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Keluhan Santri</label>
                <input
                  type="text"
                  required
                  value={formData.keluhan}
                  onChange={(e) => setFormData({ ...formData, keluhan: e.target.value })}
                  placeholder="Contoh: Demam tinggi 38.5C, pusing, mual"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Diagnosa Klinis</label>
                <input
                  type="text"
                  required
                  value={formData.diagnosa}
                  onChange={(e) => setFormData({ ...formData, diagnosa: e.target.value })}
                  placeholder="Contoh: Faringitis Akut / Suspect Demam Berdarah"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tindakan & Resep Obat</label>
                <textarea
                  rows="2"
                  value={formData.tindakan}
                  onChange={(e) => setFormData({ ...formData, tindakan: e.target.value })}
                  placeholder="Contoh: Paracetamol 500mg 3x1, Amoxicillin, istirahat total"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status Istirahat</label>
                  <select
                    value={formData.statusIstirahat}
                    onChange={(e) => setFormData({ ...formData, statusIstirahat: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold"
                  >
                    <option value="ISTIRAHAT_ASRAMA">Istirahat di Kamar Asrama</option>
                    <option value="RAWAT_INAP_POSKESTREN">Rawat Inap Poskestren</option>
                    <option value="RUJUKAN_RS">Rujukan Rumah Sakit Luar</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Durasi</label>
                  <input
                    type="text"
                    value={formData.durasiIstirahat}
                    onChange={(e) => setFormData({ ...formData, durasiIstirahat: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                  />
                </div>
              </div>

              {/* Toggle Rujukan RS Luar */}
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-purple-900">
                  <input
                    type="checkbox"
                    checked={formData.butuhRujukanRs}
                    onChange={(e) => setFormData({ ...formData, butuhRujukanRs: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                  <span>Ajukan Rujukan ke Rumah Sakit Luar (Auto Smart Permit)</span>
                </label>

                {formData.butuhRujukanRs && (
                  <div>
                    <label className="block text-[11px] text-purple-800 font-semibold mb-1">
                      Nama Rumah Sakit Rujukan:
                    </label>
                    <input
                      type="text"
                      value={formData.rsRujukan}
                      onChange={(e) => setFormData({ ...formData, rsRujukan: e.target.value })}
                      className="w-full bg-white border border-purple-300 rounded-lg p-2 text-xs"
                    />
                    <p className="text-[10px] text-purple-700 mt-1">
                      ⚡ Sistem akan otomatis menerbitkan Izin Berobat Smart Gate & mengirim WhatsApp ke orang tua santri.
                    </p>
                  </div>
                )}
              </div>

              </div>

              <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow"
                >
                  Simpan & Kirim Notifikasi WA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
