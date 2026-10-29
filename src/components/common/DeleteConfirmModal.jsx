import React, { useState } from 'react';
import { Trash2, AlertTriangle, X, Loader2 } from 'lucide-react';

/**
 * ============================================================================
 * SMART RI'AYAH - DELETE CONFIRMATION MODAL
 * Modal konfirmasi penghapusan data dengan perlindungan anti salah klik,
 * indikator loading, dan notifikasi bahwa data dihapus permanen dari Supabase & Firebase.
 * ============================================================================
 */

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Konfirmasi Hapus Data",
  message = "Apakah Anda yakin ingin menghapus data ini secara permanen?",
  itemName = "",
  itemId = "",
  itemType = "Data",
  warningNote = "Tindakan ini tidak dapat dibatalkan. Data akan dihapus permanen dari basis data Supabase & Firebase Firestore.",
  isLoading = false
}) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden my-auto transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Danger Accent */}
        <div className="bg-rose-50/80 border-b border-rose-100 p-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-md shadow-rose-500/20 shrink-0">
              <Trash2 className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-rose-600 block">
                Peringatan Hapus Data ({itemType})
              </span>
              <h3 className="text-lg font-black text-slate-900 leading-tight">
                {title}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-white/80 transition disabled:opacity-50"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 sm:p-6 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            {message}
          </p>

          {/* Target Item Detail Box */}
          {(itemName || itemId) && (
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Kategori:</span>
                <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded-lg border border-slate-200 text-[11px]">
                  {itemType}
                </span>
              </div>
              {itemName && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Nama/Label:</span>
                  <span className="font-black text-slate-900 text-right truncate max-w-[200px]">
                    {itemName}
                  </span>
                </div>
              )}
              {itemId && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">ID Database:</span>
                  <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[11px]">
                    {itemId}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Warning Callout */}
          <div className="flex items-start gap-2.5 p-3.5 bg-amber-50 border border-amber-200/80 rounded-2xl text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-snug">
              {warningNote}
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-100 p-4 sm:p-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-white font-bold text-xs transition disabled:opacity-50"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs shadow-md shadow-rose-600/20 flex items-center gap-2 transition disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menghapus...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Ya, Hapus Permanen</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

