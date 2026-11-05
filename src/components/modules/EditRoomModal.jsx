import React, { useState, useEffect } from 'react';
import { 
  Pencil, 
  X, 
  Home, 
  Users, 
  UserCheck, 
  ClipboardList, 
  Check, 
  AlertCircle,
  Layers
} from 'lucide-react';

/**
 * Komponen EditRoomModal
 * Modal pop-up untuk memperbarui data kamar asrama:
 * - Nama / Nomor Kamar
 * - Kapasitas Kasur
 * - Ketua Kamar
 * - Catatan Inspeksi Kebersihan & Kedisiplinan
 */
export default function EditRoomModal({ isOpen, room, onClose, onSave }) {
  const [formData, setFormData] = useState({
    nomorKamar: '',
    lantai: 1,
    kapasitas: 8,
    ketuaKamar: '',
    catatanInspeksi: ''
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sinkronisasi data saat room yang dipilih berubah atau modal dibuka
  useEffect(() => {
    if (room) {
      setFormData({
        nomorKamar: room.nomorKamar || '',
        lantai: room.lantai || 1,
        kapasitas: room.kapasitas || 8,
        ketuaKamar: room.ketuaKamar || '',
        catatanInspeksi: room.catatanInspeksi || ''
      });
      setErrors({});
    }
  }, [room, isOpen]);

  // Listener tombol Escape untuk menutup modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !room) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Hapus pesan error saat pengguna mulai mengetik ulang
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.nomorKamar.trim()) {
      newErrors.nomorKamar = 'Nama / nomor kamar wajib diisi';
    }
    const lt = parseInt(formData.lantai);
    if (isNaN(lt) || lt < 1) {
      newErrors.lantai = 'Lantai minimal 1';
    } else if (lt > 20) {
      newErrors.lantai = 'Lantai maksimal 20';
    }
    const cap = parseInt(formData.kapasitas);
    if (isNaN(cap) || cap < 1) {
      newErrors.kapasitas = 'Kapasitas minimal 1 orang / ranjang';
    } else if (cap > 50) {
      newErrors.kapasitas = 'Kapasitas maksimal 50 orang';
    }
    if (!formData.ketuaKamar.trim()) {
      newErrors.ketuaKamar = 'Ketua kamar wajib diisi';
    }
    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      onSave(room.id, {
        nomorKamar: formData.nomorKamar.trim(),
        lantai: parseInt(formData.lantai) || 1,
        kapasitas: parseInt(formData.kapasitas),
        ketuaKamar: formData.ketuaKamar.trim(),
        catatanInspeksi: formData.catatanInspeksi.trim()
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl max-w-lg w-full overflow-hidden my-auto transform transition-all duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 backdrop-blur-md rounded-2xl border border-white/20 text-white shadow-xs">
              <Pencil className="w-5 h-5 text-emerald-100" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                Edit Data Kamar
              </h3>
              <p className="text-xs text-emerald-100/90 font-medium">
                {room.namaGedung || 'Asrama Santri'} • Lt. {room.lantai || 1}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors duration-150"
            title="Tutup Modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs text-slate-700">
          {/* Input 1: Nama / Nomor Kamar */}
          <div>
            <label className="block font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
              <Home className="w-3.5 h-3.5 text-emerald-600" />
              Nama / Nomor Kamar
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.nomorKamar}
              onChange={(e) => handleChange('nomorKamar', e.target.value)}
              placeholder="Contoh: Kamar 204 atau Umar bin Khattab 204"
              className={`w-full bg-slate-50/70 border rounded-xl px-3.5 py-2.5 text-slate-900 font-medium text-xs focus:bg-white focus:outline-none focus:ring-2 transition-all ${
                errors.nomorKamar 
                  ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20' 
                  : 'border-slate-200 focus:border-emerald-600 focus:ring-emerald-500/20'
              }`}
            />
            {errors.nomorKamar && (
              <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.nomorKamar}
              </p>
            )}
          </div>

          {/* Grid: Lantai & Kapasitas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Input Lantai */}
            <div>
              <label className="block font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-600" />
                Lantai Asrama (LT)
                <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={formData.lantai}
                  onChange={(e) => handleChange('lantai', e.target.value)}
                  placeholder="1"
                  className={`w-full bg-slate-50/70 border rounded-xl px-3.5 py-2.5 text-slate-900 font-mono font-bold text-sm focus:bg-white focus:outline-none focus:ring-2 transition-all ${
                    errors.lantai 
                      ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20' 
                      : 'border-slate-200 focus:border-emerald-600 focus:ring-emerald-500/20'
                  }`}
                />
                <span className="absolute right-3.5 top-2.5 text-slate-400 font-medium text-xs pointer-events-none">
                  Lt. {formData.lantai || 1}
                </span>
              </div>
              {errors.lantai && (
                <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.lantai}
                </p>
              )}
            </div>

            {/* Input Kapasitas */}
            <div>
              <label className="block font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-600" />
                Kapasitas (Kasur)
                <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={formData.kapasitas}
                  onChange={(e) => handleChange('kapasitas', e.target.value)}
                  placeholder="8"
                  className={`w-full bg-slate-50/70 border rounded-xl px-3.5 py-2.5 text-slate-900 font-mono font-bold text-sm focus:bg-white focus:outline-none focus:ring-2 transition-all ${
                    errors.kapasitas 
                      ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20' 
                      : 'border-slate-200 focus:border-emerald-600 focus:ring-emerald-500/20'
                  }`}
                />
                <span className="absolute right-3.5 top-2.5 text-slate-400 font-medium text-xs pointer-events-none">
                  Kasur
                </span>
              </div>
              {errors.kapasitas && (
                <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.kapasitas}
                </p>
              )}
            </div>
          </div>

          {/* Input 3: Ketua Kamar */}
          <div>
            <label className="block font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
              Ketua Kamar (Santri Penanggung Jawab)
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.ketuaKamar}
              onChange={(e) => handleChange('ketuaKamar', e.target.value)}
              placeholder="Nama santri ketua kamar..."
              className={`w-full bg-slate-50/70 border rounded-xl px-3.5 py-2.5 text-slate-900 font-medium text-xs focus:bg-white focus:outline-none focus:ring-2 transition-all ${
                errors.ketuaKamar 
                  ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20' 
                  : 'border-slate-200 focus:border-emerald-600 focus:ring-emerald-500/20'
              }`}
            />
            {errors.ketuaKamar && (
              <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.ketuaKamar}
              </p>
            )}
          </div>

          {/* Input 4: Catatan Inspeksi */}
          <div>
            <label className="block font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5 text-emerald-600" />
              Catatan Inspeksi & Kedisiplinan
            </label>
            <textarea
              rows={3}
              value={formData.catatanInspeksi}
              onChange={(e) => handleChange('catatanInspeksi', e.target.value)}
              placeholder="Catatan kebersihan, kerapian lemari, sarana prasarana kamar..."
              className="w-full bg-slate-50/70 border border-slate-200 rounded-xl p-3 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all resize-none"
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Dapat dibaca oleh Musyrif dan Pengasuhan saat evaluasi harian.
            </span>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors duration-150"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 active:scale-98 transition-all duration-150 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
