import React, { useState, useMemo } from 'react';
import {
  X,
  UserPlus,
  Search,
  Users,
  Home,
  CheckCircle2,
  AlertCircle,
  Filter,
  ArrowRightLeft,
  Sparkles,
  Layers
} from 'lucide-react';
import { sound } from '../../utils/audio';

/**
 * Modal untuk memasukkan / menempatkan Santri & Santriwati terdaftar ke dalam kamar asrama.
 * Mendukung filter khusus Santriwati (Putri) vs Santri (Putra), status belum ada kamar,
 * dan pemindahan kamar secara cepat dengan sinkronisasi ke Supabase.
 */
export default function AssignSantriToRoomModal({
  isOpen,
  room,
  onClose,
  santriList = [],
  onAssignSantri,
  onAssignBatch
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('unassigned'); // 'unassigned' | 'all' | 'assigned'
  const [genderFilter, setGenderFilter] = useState('AUTO'); // 'AUTO' | 'P' | 'L' | 'ALL'
  const [selectedIds, setSelectedIds] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  if (!isOpen || !room) return null;

  const isPutri = room.kategoriGedung === 'PUTRI';
  const targetGender = genderFilter === 'AUTO' ? (isPutri ? 'P' : 'L') : genderFilter;
  const genderLabel = isPutri ? 'Santriwati' : 'Santri';

  // Hitung penghuni kamar saat ini
  const currentOccupants = santriList.filter(s =>
    (s.kamarId && String(s.kamarId) === String(room.id)) ||
    (s.kamar && (
      s.kamar.toLowerCase().includes(room.nomorKamar.toLowerCase()) ||
      room.nomorKamar.toLowerCase().includes(s.kamar.toLowerCase())
    ))
  );

  const capacity = room.kapasitas || 8;
  const occupiedCount = currentOccupants.length;
  const remainingSlots = Math.max(0, capacity - occupiedCount);

  // Filter santri sesuai gender, pencarian, dan status kamar
  const candidateSantri = useMemo(() => {
    return santriList.filter(s => {
      // 1. Filter Gender
      if (targetGender !== 'ALL') {
        const sGender = s.gender ? s.gender.toUpperCase() : (s.kelas && s.kelas.includes('Putri') ? 'P' : 'L');
        if (sGender !== targetGender) return false;
      }

      // 2. Jangan tampilkan santri yang SUDAH ADA di kamar ini
      const isAlreadyInThisRoom = (s.kamarId && String(s.kamarId) === String(room.id)) ||
        (s.kamar && (
          s.kamar.toLowerCase().includes(room.nomorKamar.toLowerCase()) ||
          room.nomorKamar.toLowerCase().includes(s.kamar.toLowerCase())
        ));
      if (isAlreadyInThisRoom) return false;

      // 3. Filter Status Kamar
      const hasRoom = s.kamar && s.kamar !== '-' && !s.kamar.toLowerCase().includes('belum');
      if (filterMode === 'unassigned' && hasRoom) return false;
      if (filterMode === 'assigned' && !hasRoom) return false;

      // 4. Pencarian Teks
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nama = (s.nama || s.nama_lengkap || '').toLowerCase();
        const nis = String(s.nis || '').toLowerCase();
        const kelas = (s.kelas || '').toLowerCase();
        const kamar = (s.kamar || '').toLowerCase();
        const wali = (s.wali?.nama || s.nama_wali || '').toLowerCase();
        return nama.includes(q) || nis.includes(q) || kelas.includes(q) || kamar.includes(q) || wali.includes(q);
      }

      return true;
    });
  }, [santriList, room, targetGender, filterMode, searchQuery]);

  // Hitung jumlah santri yang belum punya kamar
  const unassignedCount = useMemo(() => {
    return santriList.filter(s => {
      if (targetGender !== 'ALL') {
        const sGender = s.gender ? s.gender.toUpperCase() : (s.kelas && s.kelas.includes('Putri') ? 'P' : 'L');
        if (sGender !== targetGender) return false;
      }
      return !s.kamar || s.kamar === '-' || s.kamar.toLowerCase().includes('belum');
    }).length;
  }, [santriList, targetGender]);

  // Handler toggle checkbox santri
  const toggleSelectSantri = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(item => item !== id));
    } else {
      if (selectedIds.length >= remainingSlots) {
        sound.playError?.();
        setNotification({
          type: 'warning',
          message: `Sisa kuota kasur kamar ini hanya tersisa ${remainingSlots} ranjang.`
        });
        return;
      }
      setSelectedIds(prev => [...prev, id]);
    }
  };

  // Handler memasukkan 1 santri
  const handleAssignSingle = async (santri) => {
    if (remainingSlots <= 0) {
      sound.playError?.();
      setNotification({
        type: 'error',
        message: `Kamar ${room.nomorKamar} sudah penuh (${capacity} kasur). Tidak bisa menambah penghuni lagi.`
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (onAssignSantri) {
        await onAssignSantri(santri.id, room);
      }
      sound.playSuccess?.();
      setNotification({
        type: 'success',
        message: `✅ ${genderLabel} "${santri.nama}" berhasil ditempatkan di ${room.nomorKamar}!`
      });
      setSelectedIds(prev => prev.filter(id => id !== santri.id));
    } catch (err) {
      sound.playError?.();
      setNotification({
        type: 'error',
        message: `Gagal menempatkan santri: ${err.message}`
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler batch memasukkan banyak santri terpilih
  const handleAssignSelected = async () => {
    if (selectedIds.length === 0) return;
    if (selectedIds.length > remainingSlots) {
      sound.playError?.();
      setNotification({
        type: 'error',
        message: `Jumlah terpilih (${selectedIds.length}) melebihi sisa kasur kosong (${remainingSlots}).`
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (onAssignBatch) {
        await onAssignBatch(selectedIds, room);
      } else if (onAssignSantri) {
        for (const sid of selectedIds) {
          await onAssignSantri(sid, room);
        }
      }
      sound.playSuccess?.();
      setNotification({
        type: 'success',
        message: `🎉 Berhasil memasukkan ${selectedIds.length} ${genderLabel} ke ${room.nomorKamar}!`
      });
      setSelectedIds([]);
    } catch (err) {
      sound.playError?.();
      setNotification({
        type: 'error',
        message: `Gagal memproses penempatan santri: ${err.message}`
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col transform transition-all duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className={`p-4 sm:p-5 border-b text-white flex items-center justify-between ${
          isPutri 
            ? 'bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-700 border-teal-800'
            : 'bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 border-emerald-800'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shadow-inner">
              <UserPlus className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/30 uppercase">
                  {isPutri ? 'ASRAMA PUTRI (SANTRIWATI)' : 'ASRAMA PUTRA (SANTRI)'}
                </span>
                <span className="text-[11px] text-teal-100 font-mono">Lt. {room.lantai}</span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white mt-0.5 tracking-tight">
                Masukkan {genderLabel} ke {room.nomorKamar}
              </h3>
              <p className="text-xs text-white/80">
                {room.namaGedung} • Ketua: <b>{room.ketuaKamar || '-'}</b>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-2xl transition"
            title="Tutup (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Kapasitas Kamar Saat Ini */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Home className="w-4 h-4 text-emerald-600" />
            <span className="text-slate-600">Status Keterisian:</span>
            <span className="font-bold text-slate-800">
              {occupiedCount} / {capacity} Kasur Terisi
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">Sisa Kuota Kosong:</span>
            <span className={`px-2.5 py-0.5 rounded-full font-mono font-bold text-xs ${
              remainingSlots > 0
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-rose-100 text-rose-800 border border-rose-300'
            }`}>
              {remainingSlots} Kasur Tersedia
            </span>
          </div>
        </div>

        {/* Notifikasi Alert */}
        {notification && (
          <div className={`mx-4 sm:mx-6 mt-3 p-3 rounded-2xl text-xs flex items-center justify-between gap-2 border animate-fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : notification.type === 'warning'
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}>
            <div className="flex items-center gap-2">
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span className="font-medium">{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-slate-600 text-xs font-bold px-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 space-y-3 bg-white">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Cari nama ${genderLabel.toLowerCase()}, NIS, kelas, atau wali...`}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <button
              type="button"
              onClick={() => setFilterMode('unassigned')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
                filterMode === 'unassigned'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>Belum Ada Kamar</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                filterMode === 'unassigned' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {unassignedCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition ${
                filterMode === 'all'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua {genderLabel} Terdaftar
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('assigned')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 ${
                filterMode === 'assigned'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <ArrowRightLeft className="w-3 h-3" />
              <span>Pindah dari Kamar Lain</span>
            </button>

            {/* Gender Toggle jika ingin melihat lintas santri */}
            <div className="ml-auto flex items-center gap-1 text-[11px] text-slate-500">
              <span>Filter:</span>
              <select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
                className="bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-bold focus:outline-none"
              >
                <option value="AUTO">Khusus {genderLabel} ({targetGender})</option>
                <option value="P">Santriwati (P)</option>
                <option value="L">Santri (L)</option>
                <option value="ALL">Semua Gender</option>
              </select>
            </div>
          </div>
        </div>

        {/* Daftar Calon Santriwati / Santri */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-2.5 flex-1 divide-y divide-slate-100">
          {candidateSantri.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <Users className="w-10 h-10 text-slate-300 mx-auto" />
              <div className="text-sm font-bold text-slate-700">
                Tidak ada {genderLabel.toLowerCase()} yang cocok dengan filter
              </div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {filterMode === 'unassigned'
                  ? `Semua ${genderLabel.toLowerCase()} terdaftar sudah memiliki kamar asrama. Gunakan tab "Semua ${genderLabel}" untuk memindahkan santri.`
                  : 'Coba ubah kata kunci pencarian Anda.'}
              </p>
            </div>
          ) : (
            candidateSantri.map(s => {
              const isSelected = selectedIds.includes(s.id);
              const hasRoom = s.kamar && s.kamar !== '-' && !s.kamar.toLowerCase().includes('belum');

              return (
                <div
                  key={s.id}
                  className={`pt-2.5 pb-2.5 px-3 rounded-2xl flex items-center justify-between gap-3 transition border ${
                    isSelected
                      ? 'bg-emerald-50/70 border-emerald-300'
                      : 'bg-white hover:bg-slate-50 border-slate-200/70'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Checkbox Multi-Select */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectSantri(s.id)}
                      disabled={remainingSlots <= 0 && !isSelected}
                      className="w-4 h-4 text-emerald-600 rounded-md border-slate-300 focus:ring-emerald-500 cursor-pointer shrink-0"
                    />

                    {/* Avatar */}
                    <img
                      src={s.foto || (s.gender === 'P' ? '/images/avatar_santri_putri.jpg' : '/images/avatar_santri_putra.jpg')}
                      alt={s.nama}
                      className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                    />

                    {/* Info Santri */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-slate-900 truncate">
                          {s.nama || s.nama_lengkap}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          {s.kelas || '10'}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        NIS: {s.nis || '-'} • RFID: [{s.rfidUid || 'Belum Ada'}]
                      </div>

                      <div className="text-[11px] flex items-center gap-1.5 mt-0.5">
                        <span className="text-slate-400">Kamar Saat Ini:</span>
                        {hasRoom ? (
                          <span className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                            {s.kamar}
                          </span>
                        ) : (
                          <span className="font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[10px]">
                            Belum Ada Kamar
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tombol Aksi Single Assign */}
                  <div className="shrink-0 flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={isSubmitting || remainingSlots <= 0}
                      onClick={() => handleAssignSingle(s)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                        remainingSlots <= 0
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                          : isPutri
                          ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-2xs'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                      }`}
                      title={`Masukkan ke ${room.nomorKamar}`}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>{hasRoom ? 'Pindahkan' : '+ Masukkan'}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Aksi Batch & Tutup */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            {selectedIds.length > 0 ? (
              <span>
                Terpilih: <b className="text-emerald-700">{selectedIds.length} {genderLabel}</b> (Sisa Kuota: {remainingSlots})
              </span>
            ) : (
              <span>
                Tersisa <b>{remainingSlots}</b> kuota ranjang di kamar ini.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition"
            >
              Tutup
            </button>

            {selectedIds.length > 0 && (
              <button
                type="button"
                disabled={isSubmitting || selectedIds.length > remainingSlots}
                onClick={handleAssignSelected}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Masukkan {selectedIds.length} {genderLabel} Terpilih</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
