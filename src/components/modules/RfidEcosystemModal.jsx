import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  CreditCard, 
  X, 
  ShoppingBag, 
  BookOpen, 
  Sparkles, 
  Layers, 
  CheckCircle, 
  Building, 
  Zap,
  Scale
} from 'lucide-react';
import { sound } from '../../utils/audio';

export default function RfidEcosystemModal() {
  const { 
    isRfidModalOpen, 
    setIsRfidModalOpen, 
    santriList, 
    addCashlessTransaction 
  } = useApp();

  const [activeTab, setActiveTab] = useState('kantin'); // 'kantin' | 'attendance' | 'perpustakaan_laundry'
  const [selectedSantriId, setSelectedSantriId] = useState('S-101');
  const [jajanItem, setJajanItem] = useState({
    nama: 'Paket Nasi Ayam Penyet + Es Teh',
    harga: 15000,
    merchant: 'Kantin Santri Barokah (IdeaPOS)'
  });
  const [laundryKg, setLaundryKg] = useState(2.5);
  const [notice, setNotice] = useState(null);

  if (!isRfidModalOpen) return null;

  const currentSantri = santriList.find(s => s.id === selectedSantriId) || santriList[0];

  const handleSimulateKantin = () => {
    sound.playBeep();
    addCashlessTransaction(
      selectedSantriId,
      'KANTIN_POS',
      jajanItem.harga,
      jajanItem.merchant,
      jajanItem.nama
    );
    setNotice(`✅ Transaksi ${jajanItem.nama} (Rp ${jajanItem.harga.toLocaleString('id-ID')}) Berhasil! Notifikasi otomatis terkirim ke WhatsApp Wali Santri.`);
    setTimeout(() => setNotice(null), 4000);
  };

  const handleSimulateLaundry = () => {
    sound.playBeep();
    const biaya = Math.round(laundryKg * 6000);
    addCashlessTransaction(
      selectedSantriId,
      'LAUNDRY',
      biaya,
      'Unit Laundry Asrama Putri/Putra',
      `Cuci Kiloan ${laundryKg} Kg (Timbangan RFID Digital)`
    );
    setNotice(`✅ Laundry ${laundryKg} Kg (Rp ${biaya.toLocaleString('id-ID')}) Berhasil dicatat ke kartu RFID!`);
    setTimeout(() => setNotice(null), 4000);
  };

  const handleSimulateMasjidAttendance = () => {
    sound.playSuccess();
    setNotice(`✅ Presensi RFID Shalat Maghrib Berjamaah ananda ${currentSantri.nama} tercatat di Server Masjid Jami'!`);
    setTimeout(() => setNotice(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gold-100 text-gold-700">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">
                Simulasi Ekosistem Multi-Purpose RFID Smart Card 13.56 MHz
              </h3>
              <p className="text-xs text-slate-500">
                1 Kartu Santri untuk Seluruh Layanan Pesantren Modern Darul Ulum
              </p>
            </div>
          </div>
          <button 
            onClick={() => setIsRfidModalOpen(false)}
            className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Santri Card Preview */}
        <div className="bg-gradient-to-r from-emerald-900 to-teal-900 text-white rounded-2xl p-4 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <img 
              src={currentSantri.foto} 
              alt={currentSantri.nama} 
              className="w-12 h-12 rounded-xl object-cover border border-emerald-400"
            />
            <div>
              <span className="text-[10px] text-emerald-300 font-mono">UID: {currentSantri.rfidUid}</span>
              <h4 className="font-bold text-sm text-white">{currentSantri.nama}</h4>
              <p className="text-emerald-200">Kls {currentSantri.kelas} • {currentSantri.kamar}</p>
            </div>
          </div>

          <div className="text-right font-mono">
            <span className="text-[10px] text-emerald-300 block">Sisa Saldo RFID</span>
            <span className="text-base font-bold text-gold-300">
              Rp {currentSantri.saldoRfid.toLocaleString('id-ID')}
            </span>
            <span className="text-[10px] text-slate-300 block">
              Limit Jajan: Rp {currentSantri.limitJajanHarian.toLocaleString('id-ID')}/hr
            </span>
          </div>
        </div>

        {/* Santri Switcher within Modal */}
        <div className="flex items-center justify-between text-xs">
          <label className="text-slate-600 font-bold">Pilih Kartu Santri:</label>
          <select
            value={selectedSantriId}
            onChange={(e) => setSelectedSantriId(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 font-semibold"
          >
            {santriList.map(s => (
              <option key={s.id} value={s.id}>
                {s.nama} ({s.nis}) - Saldo: Rp {s.saldoRfid.toLocaleString('id-ID')}
              </option>
            ))}
          </select>
        </div>

        {/* Notice banner */}
        {notice && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 gap-2 border-b border-slate-100 pb-2">
          {[
            { id: 'kantin', label: '1. Cashless Kantin (POS)', icon: ShoppingBag },
            { id: 'attendance', label: '2. Presensi Shalat IoT', icon: Building },
            { id: 'perpustakaan_laundry', label: '3. Laundry & Perpustakaan', icon: Scale }
          ].map(t => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.label.split(' ')[1]}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: KANTIN CASHLESS */}
        {activeTab === 'kantin' && (
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Simulasi kasir kantin pondok (IdeaPOS). Saldo terpotong otomatis dari kartu RFID, mematuhi batas jajan orang tua, dan mengirim struk via WhatsApp.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { nama: 'Nasi Ayam Geprek + Es Teh', harga: 15000, merchant: 'Kantin Barokah' },
                { nama: 'Roti Bakar Keju + Susu Jahe', harga: 10000, merchant: 'Kafetaria Asrama' },
                { nama: 'Kitab / Alat Tulis Santri', harga: 22000, merchant: 'Koperasi Pondok' }
              ].map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => setJajanItem(item)}
                  className={`p-3 rounded-xl border cursor-pointer transition ${
                    jajanItem.nama === item.nama
                      ? 'border-emerald-500 bg-emerald-50/60 shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <p className="font-bold text-slate-800">{item.nama}</p>
                  <p className="text-[11px] text-slate-500">{item.merchant}</p>
                  <p className="font-mono font-bold text-emerald-700 mt-1">
                    Rp {item.harga.toLocaleString('id-ID')}
                  </p>
                </div>
              ))}
            </div>

            <button
              onClick={handleSimulateKantin}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              <span>TAP KARTU RFID: BAYAR RP {jajanItem.harga.toLocaleString('id-ID')}</span>
            </button>
          </div>
        )}

        {/* TAB 2: ATTENDANCE IoT */}
        {activeTab === 'attendance' && (
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Sensor RFID Reader terpasang di 6 titik pilar Masjid Jami'. Santri cukup menempelkan kartu saat adzan berkumandang untuk presensi kehadiran otomatis.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">Sensor: RFID Pillar 03 - Masjid Jami'</span>
                <span className="text-emerald-600 font-mono font-bold">ONLINE (WiFi ESP32)</span>
              </div>
              <p className="text-slate-500 text-[11px]">
                Waktu Ibadah Aktif: Shalat Maghrib Berjamaah
              </p>
            </div>

            <button
              onClick={handleSimulateMasjidAttendance}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
            >
              <Building className="w-4 h-4" />
              <span>TAP KARTU RFID: PRESENSI SHALAT BERJAMAAH MASJID</span>
            </button>
          </div>
        )}

        {/* TAB 3: PERPUSTAKAAN & LAUNDRY */}
        {activeTab === 'perpustakaan_laundry' && (
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Integrasi timbangan digital RFID asrama untuk pencatatan laundry santri otomatis dan peminjaman buku perpustakaan.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">Timbangan Laundry Digital Asrama</span>
                <span className="font-mono text-emerald-700 font-bold">Rp 6.000 / Kg</span>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-slate-600">Berat Pakaian:</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="10"
                  value={laundryKg}
                  onChange={(e) => setLaundryKg(parseFloat(e.target.value) || 1)}
                  className="w-24 bg-white border border-slate-300 rounded-lg p-1.5 font-bold font-mono"
                />
                <span className="font-mono text-slate-500">Kg (Total: Rp {(Math.round(laundryKg * 6000)).toLocaleString('id-ID')})</span>
              </div>
            </div>

            <button
              onClick={handleSimulateLaundry}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
            >
              <Scale className="w-4 h-4" />
              <span>TAP KARTU RFID: PROSES TIMBANGAN LAUNDRY</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
