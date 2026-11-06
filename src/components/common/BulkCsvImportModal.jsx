import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  Download,
  AlertTriangle,
  CheckCircle2,
  X,
  Loader2,
  Search,
  Eye,
  Layers,
  Database
} from 'lucide-react';
import { parseCsv, getTemplateCsv, downloadCsvFile } from '../../utils/csvUtils';
import { sound } from '../../utils/audio';

export default function BulkCsvImportModal({
  isOpen,
  onClose,
  title = 'Bulk Import CSV',
  description = 'Unggah file CSV untuk mengimpor ratusan data sekaligus.',
  type = 'santri', // 'knowledge' | 'santri' | 'rfid' | 'customers'
  onSave,
  existingData = []
}) {
  const [file, setFile] = useState(null);
  const [parsedResult, setParsedResult] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [statusMessage, setStatusMessage] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    sound.playBeep?.();
    const csvContent = getTemplateCsv(type);
    const filename = `template_import_${type}_smart_riayah.csv`;
    downloadCsvFile(filename, csvContent);
  };

  const processFile = (selectedFile) => {
    if (!selectedFile) return;
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      alert('File harus berformat .csv!');
      return;
    }

    setFile(selectedFile);
    setStatusMessage(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const res = parseCsv(text);
        if (res.errors && res.errors.length > 0 && res.totalRows === 0) {
          alert(`Gagal membaca CSV: ${res.errors.join(', ')}`);
          return;
        }

        // Analisis Duplikat Sederhana
        let duplicateCount = 0;
        if (Array.isArray(existingData) && existingData.length > 0) {
          const existingNis = new Set(existingData.map(d => String(d.nis || '').trim()).filter(Boolean));
          const existingUids = new Set(existingData.map(d => String(d.rfid_uid || d.rfidUid || '').trim().toUpperCase()).filter(Boolean));
          const existingTitles = new Set(existingData.map(d => String(d.title || d.judul || '').trim().toLowerCase()).filter(Boolean));

          res.rows.forEach(r => {
            const nis = String(r.nis || '').trim();
            const uid = String(r.rfid_uid || '').trim().toUpperCase();
            const judul = String(r.judul || r.title || '').trim().toLowerCase();

            if ((nis && existingNis.has(nis)) || (uid && existingUids.has(uid)) || (judul && existingTitles.has(judul))) {
              duplicateCount++;
            }
          });
        }

        res.duplicateCount = duplicateCount;
        setParsedResult(res);
        sound.playSuccess?.();
      } catch (err) {
        alert(`Kesalahan saat memproses CSV: ${err.message}`);
      }
    };
    reader.readAsText(selectedFile, 'UTF-8');
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  };

  const handleSaveAll = async () => {
    if (!parsedResult || parsedResult.totalRows === 0) return;
    if (!onSave) {
      alert('Fungsi onSave tidak didefinisikan!');
      return;
    }

    setIsProcessing(true);
    setProgressPercent(10);
    sound.playBeep?.();

    try {
      // Simulasikan progress bar visual saat menyimpan ratusan baris data
      const interval = setInterval(() => {
        setProgressPercent(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 15;
        });
      }, 100);

      const result = await onSave(parsedResult.rows);
      clearInterval(interval);
      setProgressPercent(100);

      if (result?.success) {
        sound.playSuccess?.();
        setStatusMessage({
          type: 'success',
          text: result.message || `Berhasil mengimpor ${result.count || parsedResult.totalRows} data ke dalam sistem!`
        });
        setTimeout(() => {
          onClose();
          // Reset
          setFile(null);
          setParsedResult(null);
          setStatusMessage(null);
          setIsProcessing(false);
          setProgressPercent(0);
        }, 1200);
      } else {
        setStatusMessage({
          type: 'error',
          text: result?.error || 'Gagal menyimpan seluruh data CSV.'
        });
        setIsProcessing(false);
      }
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Terjadi kesalahan sistem saat menyimpan.'
      });
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedResult(null);
    setStatusMessage(null);
    setIsProcessing(false);
    setProgressPercent(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Filter preview rows
  const filteredRows = parsedResult?.rows.filter(r => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return Object.values(r).some(v => String(v).toLowerCase().includes(q));
  }) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        
        {/* Header Modal */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-emerald-50 via-teal-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <span>{title}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold uppercase tracking-wider">
                  Bulk CSV Engine
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">{description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Unduh contoh format CSV yang valid"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Download Template CSV</span>
            </button>
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="w-8 h-8 rounded-xl hover:bg-slate-200/70 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body Modal */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          
          {/* Status Message Alert */}
          {statusMessage && (
            <div className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-semibold ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : 'bg-rose-50 text-rose-900 border border-rose-200'
            }`}>
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Area Upload File / Dropzone */}
          {!parsedResult && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/30 hover:bg-emerald-50/60 transition p-8 rounded-3xl text-center cursor-pointer space-y-3"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-inner">
                <UploadCloud className="w-7 h-7" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-slate-800">Tarik & Letakkan File .CSV ke Sini</h4>
                <p className="text-xs text-slate-500 mt-1">atau klik untuk memilih file dari komputer Anda</p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2 text-[11px] text-slate-400">
                <FileText className="w-3.5 h-3.5" />
                <span>Format kolom: RFC 4180 • Otomatis mendeteksi tanda kutip & baris panjang</span>
              </div>
            </div>
          )}

          {/* Preview Parsed Data */}
          {parsedResult && (
            <div className="space-y-3">
              {/* Statistik Berkas */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-slate-800">{file?.name}</span>
                  <span className="text-slate-400">({(file?.size / 1024).toFixed(1)} KB)</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold font-mono">
                    {parsedResult.totalRows} Baris Terbaca
                  </span>
                  {parsedResult.duplicateCount > 0 && (
                    <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {parsedResult.duplicateCount} Kemungkinan Duplikat
                    </span>
                  )}
                  <button
                    onClick={handleReset}
                    className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold cursor-pointer transition"
                  >
                    Ganti File
                  </button>
                </div>
              </div>

              {/* Progress Bar saat simpan */}
              {isProcessing && (
                <div className="space-y-1.5 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Sedang memproses & menyinkronkan data...
                    </span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-emerald-200 overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 transition-all duration-300 rounded-full"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Search Bar pada Preview */}
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Saring pratinjau data..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <span className="text-xs text-slate-500 font-semibold shrink-0">
                  Menampilkan {filteredRows.length} dari {parsedResult.totalRows} data
                </span>
              </div>

              {/* Tabel Pratinjau (Maksimal Scrollable) */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100 text-slate-600 sticky top-0 uppercase font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3 w-10 text-center">No</th>
                      {parsedResult.headers.map((h, i) => (
                        <th key={i} className="py-2 px-3 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredRows.slice(0, 50).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80">
                        <td className="py-2 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                        {parsedResult.headers.map((h, cIdx) => (
                          <td key={cIdx} className="py-2 px-3 text-slate-700 max-w-[200px] truncate" title={row[h]}>
                            {row[h] || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredRows.length > 50 && (
                <p className="text-[10px] text-slate-400 text-center italic">
                  * Pratinjau membatasi 50 baris pertama di layar. Seluruh {parsedResult.totalRows} baris akan tetap disimpan seutuhnya saat Anda mengklik tombol simpan.
                </p>
              )}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            <span>Tersinkronisasi otomatis ke Database Supabase & IoT Gate.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={handleSaveAll}
              disabled={!parsedResult || parsedResult.totalRows === 0 || isProcessing}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs transition flex items-center gap-2 shadow-sm cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyimpan {parsedResult?.totalRows} Data...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Simpan Semua ({parsedResult?.totalRows || 0} Data)</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

