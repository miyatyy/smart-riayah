import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Trash2,
  Edit3,
  PlusCircle,
  Search,
  ChevronDown,
  ChevronUp,
  Server,
  Cloud,
  Laptop,
  X,
  Check,
  Loader2,
  Bot
} from 'lucide-react';
import {
  checkMongoHealth,
  fetchAiLogsFromMongo,
  saveAiToMongo,
  updateAiLogInMongo,
  deleteAiLogFromMongo
} from '../../utils/mongoAiService';
import { sound } from '../../utils/audio';

const COLLECTION_LABELS = {
  ALL: 'Semua Koleksi AI',
  ai_evaluations: 'ai_evaluations (DeepSeek Analisis)',
  ai_chat_logs: 'ai_chat_logs (AI Chat & WA Bot)',
  ai_whatsapp_bookings: 'ai_whatsapp_bookings (Parser Tamu)',
  ai_logs: 'ai_logs (Umum)'
};

export default function MongoDbAiMonitor({ variant = 'light' }) {
  const isDark = variant === 'dark';

  const [health, setHealth] = useState(null);
  const [logs, setLogs] = useState([]);
  const [counts, setCounts] = useState({
    osis_reports: 0,
    ai_evaluations: 0,
    ai_chat_logs: 0,
    ai_whatsapp_bookings: 0,
    ai_logs: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeCollection, setActiveCollection] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCompassGuide, setShowCompassGuide] = useState(false);
  const [actionNotice, setActionNotice] = useState(null);
  const [editingDoc, setEditingDoc] = useState(null);
  const [isMutating, setIsMutating] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [hRes, lRes] = await Promise.all([
        checkMongoHealth(),
        fetchAiLogsFromMongo({ collection: activeCollection, limit: 100 })
      ]);
      setHealth(hRes);
      if (hRes?.counts) {
        setCounts(prev => ({ ...prev, ...hRes.counts }));
      }
      if (lRes?.counts) {
        setCounts(prev => ({ ...prev, ...lRes.counts }));
      }
      setLogs(Array.isArray(lRes?.data) ? lRes.data : []);
    } catch (err) {
      console.warn('MongoDbAiMonitor loadData warning:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeCollection]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showNotice = (msg) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 5500);
  };

  const handleTestWriteAi = async () => {
    setIsMutating(true);
    try {
      const res = await saveAiToMongo('ai_logs', {
        source: 'MONITOR_DIAGNOSTIC_TEST',
        model: 'deepseek-chat',
        santriNama: 'Uji Koneksi MongoDB AI',
        summary: 'Uji tulis dokumen AI ke MongoDB database smart_riayah berhasil.',
        adminNote: 'Dibuat dari panel Monitor MongoDB & AI'
      });
      if (res?.savedToMongo) {
        sound.playSuccess?.();
        showNotice(`✅ Dokumen uji AI [${res.id}] berhasil tersimpan di koleksi MongoDB (${res.collection})!`);
        await loadData();
      } else {
        sound.playBeep?.();
        showNotice(`⚠️ MongoDB belum aktif saat ini (${res?.warning || health?.error || 'cek MONGODB_URI / MongoDB Community Server'}).`);
      }
    } finally {
      setIsMutating(false);
    }
  };

  const handleSaveEditDoc = async (e) => {
    e.preventDefault();
    if (!editingDoc?.id) return;
    setIsMutating(true);
    try {
      const targetCol = editingDoc.ai_collection || 'ai_logs';
      const res = await updateAiLogInMongo(editingDoc.id, targetCol, {
        summary: editingDoc.summary || '',
        adminNote: editingDoc.adminNote || '',
        status: editingDoc.status || 'VERIFIED'
      });
      if (res?.success) {
        sound.playSuccess?.();
        showNotice(`✏️ Dokumen AI [${editingDoc.id}] diperbarui di MongoDB (${targetCol}).`);
        setEditingDoc(null);
        await loadData();
      } else {
        alert('Gagal update log AI: ' + (res?.message || res?.error || 'MongoDB offline'));
      }
    } finally {
      setIsMutating(false);
    }
  };

  const handleDeleteDoc = async (doc) => {
    const ok = window.confirm(
      `🗑️ Hapus dokumen AI [${doc.id}] dari koleksi MongoDB (${doc.ai_collection || 'ai_logs'})?`
    );
    if (!ok) return;
    setIsMutating(true);
    try {
      const res = await deleteAiLogFromMongo(doc.id, doc.ai_collection || 'ALL');
      if (res?.success) {
        sound.playBeep?.();
        showNotice(`🗑️ Dokumen AI [${doc.id}] berhasil dihapus dari MongoDB.`);
        await loadData();
      } else {
        alert('Gagal menghapus dokumen AI: ' + (res?.message || res?.error || 'MongoDB offline'));
      }
    } finally {
      setIsMutating(false);
    }
  };

  const filteredLogs = logs.filter((doc) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const raw = JSON.stringify(doc).toLowerCase();
    return raw.includes(q);
  });

  const getDocSummary = (doc) => {
    if (doc.summary) return doc.summary;
    if (doc.replyText) return doc.replyText;
    if (doc.reply) return doc.reply;
    if (doc.analysis?.narrativeSummary) return doc.analysis.narrativeSummary;
    if (doc.narrativeSummary) return doc.narrativeSummary;
    if (doc.parsed?.nama_santri) {
      return `Booking Kunjungan: ${doc.parsed.nama_santri} (${doc.parsed.tanggal_kunjungan || '-'} ${doc.parsed.jam_kunjungan || ''})`;
    }
    if (doc.userPrompt) return `Prompt: ${doc.userPrompt}`;
    if (doc.incomingMessage) return `WA Masuk: ${doc.incomingMessage}`;
    return `Dokumen AI (${doc.ai_collection || 'ai_logs'})`;
  };

  const cardBg = isDark
    ? 'bg-slate-900/90 border-slate-800 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';

  const subCardBg = isDark
    ? 'bg-slate-950/70 border-slate-800 text-slate-300'
    : 'bg-slate-50 border-slate-200 text-slate-700';

  return (
    <div className={`rounded-3xl border p-5 sm:p-6 shadow-sm space-y-5 ${cardBg}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/20 pb-4">
        <div className="flex items-start gap-3">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
            health?.connected
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-500'
              : 'bg-amber-500/15 border-amber-500/40 text-amber-500'
          }`}>
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`font-black text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>
                🗄️ MongoDB AI &amp; OSIS Persistent Storage
              </h3>
              {health?.connected ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-500 border border-emerald-500/40 inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>TERHUBUNG ({health.mode} • {health.latencyMs ?? 0}ms)</span>
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-500 border border-amber-500/40 inline-flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>{health?.mode || 'BELUM TERHUBUNG'}</span>
                </span>
              )}
            </div>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Seluruh hasil evaluasi DeepSeek AI, Chat AI Agent, Auto-Responder WA, dan OSIS Reports otomatis tersimpan ke database MongoDB (<code className="font-mono">{health?.dbName || 'smart_riayah'}</code>).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleTestWriteAi}
            disabled={isMutating}
            className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-60"
          >
            {isMutating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlusCircle className="w-3.5 h-3.5" />}
            <span>Test Simpan AI ke Mongo</span>
          </button>

          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-xs font-bold text-emerald-500 flex items-center justify-between">
          <span>{actionNotice}</span>
          <button type="button" onClick={() => setActionNotice(null)} className="text-xs underline ml-2">Tutup</button>
        </div>
      )}

      {/* Status Info / Error Bar when Offline */}
      {health && !health.connected && (
        <div className={`p-3.5 rounded-2xl border text-xs space-y-1 ${
          isDark ? 'bg-amber-950/30 border-amber-700/50 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}>
          <div className="font-bold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Koneksi MongoDB Belum Aktif ({health.mode})</span>
          </div>
          <p className="text-[11px] opacity-90">
            Detail: <code className="font-mono">{health.error || 'MONGODB_URI belum mengarah ke server MongoDB yang menyala.'}</code>. Sistem tetap berjalan aman melalui Supabase &amp; cache lokal. Klik panduan di bawah untuk menghubungkan MongoDB Compass.
          </p>
        </div>
      )}

      {/* Collection Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { key: 'osis_reports', label: 'osis_reports', desc: 'Laporan OSIS CRUD', color: 'text-emerald-500' },
          { key: 'ai_evaluations', label: 'ai_evaluations', desc: 'Analisis DeepSeek', color: 'text-indigo-500' },
          { key: 'ai_chat_logs', label: 'ai_chat_logs', desc: 'Chat AI & Bot WA', color: 'text-cyan-500' },
          { key: 'ai_whatsapp_bookings', label: 'ai_whatsapp_bookings', desc: 'Booking AI Parser', color: 'text-amber-500' },
          { key: 'ai_logs', label: 'ai_logs', desc: 'Log AI Umum', color: 'text-purple-500' }
        ].map(item => (
          <div key={item.key} className={`p-3 rounded-2xl border ${subCardBg}`}>
            <div className="text-[10px] font-mono font-bold opacity-80 truncate">{item.label}</div>
            <div className={`text-xl font-black font-mono mt-0.5 ${item.color}`}>
              {counts[item.key] ?? 0}
            </div>
            <div className="text-[10px] opacity-70 truncate">{item.desc}</div>
          </div>
        ))}
      </div>

      {/* Accordion: Panduan Sinkronisasi MongoDB Compass */}
      <div className={`rounded-2xl border overflow-hidden ${subCardBg}`}>
        <button
          type="button"
          onClick={() => setShowCompassGuide(!showCompassGuide)}
          className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-left"
        >
          <span className="flex items-center gap-2">
            <Laptop className="w-4 h-4 text-emerald-500" />
            <span>📘 Panduan Sinkronisasi MongoDB Server dengan Aplikasi MongoDB Compass di Laptop</span>
          </span>
          {showCompassGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showCompassGuide && (
          <div className={`p-4 border-t text-xs space-y-3 leading-relaxed ${
            isDark ? 'border-slate-800 text-slate-300' : 'border-slate-200 text-slate-700'
          }`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="font-black text-emerald-600 flex items-center gap-1.5 mb-1">
                  <Cloud className="w-4 h-4" />
                  <span>Opsi 1: Sinkron Website Live Vercel ↔ Compass (Direkomendasikan)</span>
                </div>
                <ol className="list-decimal ml-4 space-y-1 text-[11px]">
                  <li>MongoDB Compass di laptop hanya <b>aplikasi viewer</b>; Vercel cloud tidak bisa mengakses localhost laptop Anda.</li>
                  <li>Buat cluster gratis <b>MongoDB Atlas (Free Tier M0)</b> dan izinkan Network Access <code className="font-mono">0.0.0.0/0</code>.</li>
                  <li>Salin connection string <code className="font-mono">mongodb+srv://user:pass@cluster.../smart_riayah</code>.</li>
                  <li>Masukkan string itu ke <b>Vercel → Settings → Environment Variables</b> (<code className="font-mono">MONGODB_URI</code>) lalu redeploy.</li>
                  <li>Paste URI yang sama ke <b>MongoDB Compass → New Connection</b> agar data live Vercel tampil langsung di Compass laptop Anda.</li>
                </ol>
              </div>

              <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="font-black text-cyan-600 flex items-center gap-1.5 mb-1">
                  <Server className="w-4 h-4" />
                  <span>Opsi 2: Sinkron Mode Lokal Laptop (localhost:27017)</span>
                </div>
                <ol className="list-decimal ml-4 space-y-1 text-[11px]">
                  <li>Download &amp; install <b>MongoDB Community Server (.msi Windows x64)</b> (centang <i>Install MongoDB as a Service</i>).</li>
                  <li>Di file <code className="font-mono">.env</code> proyek sudah terset <code className="font-mono">MONGODB_URI=mongodb://127.0.0.1:27017/smart_riayah</code>.</li>
                  <li>Jalankan backend lokal (<code className="font-mono">npm run server</code>) dan frontend (<code className="font-mono">npm run dev</code>).</li>
                  <li>Di aplikasi <b>MongoDB Compass</b> laptop Anda, sambungkan ke <code className="font-mono">mongodb://127.0.0.1:27017</code> lalu klik Refresh untuk melihat koleksi <code className="font-mono">smart_riayah</code>.</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filter & Search Bar for AI Records */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {Object.entries(COLLECTION_LABELS).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveCollection(key)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition whitespace-nowrap ${
                activeCollection === key
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : isDark
                  ? 'bg-slate-800 text-slate-400 hover:text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari log AI / santri / model..."
            className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border focus:outline-none ${
              isDark
                ? 'bg-slate-950 border-slate-700 text-white focus:border-indigo-500'
                : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-500'
            }`}
          />
        </div>
      </div>

      {/* Records List */}
      {isLoading ? (
        <div className="py-10 text-center text-xs opacity-70 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
          <span>Memuat dokumen AI dari MongoDB...</span>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className={`p-8 rounded-2xl border border-dashed text-center text-xs space-y-1 ${subCardBg}`}>
          <Bot className="w-8 h-8 text-indigo-400 mx-auto opacity-75" />
          <p className="font-bold">Belum ada dokumen AI yang terbaca dari MongoDB pada filter ini.</p>
          <p className="text-[11px] opacity-75">
            {health?.connected
              ? 'Coba jalankan Evaluasi DeepSeek AI, Chat AI Agent, WA Auto-Responder, atau klik "Test Simpan AI ke Mongo".'
              : 'Hubungkan MongoDB Atlas / Community Server terlebih dahulu agar riwayat AI persisten terbaca di sini.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200/20">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className={`font-bold uppercase text-[10px] tracking-wider border-b ${
                isDark ? 'bg-slate-950/80 text-slate-400 border-slate-800' : 'bg-slate-50 text-slate-500 border-slate-200'
              }`}>
                <th className="py-2.5 px-3">ID &amp; Koleksi</th>
                <th className="py-2.5 px-3">Subjek / Model</th>
                <th className="py-2.5 px-3">Ringkasan Hasil AI</th>
                <th className="py-2.5 px-3">Waktu</th>
                <th className="py-2.5 px-3 text-center">CRUD</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-slate-800/70' : 'divide-slate-100'}`}>
              {filteredLogs.slice(0, 40).map((doc, idx) => (
                <tr key={doc.id || `${doc.ai_collection || 'ai'}-${idx}`} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                  <td className="py-2.5 px-3 font-mono">
                    <div className="font-bold text-[11px]">{doc.id || '-'}</div>
                    <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                      {doc.ai_collection || 'ai_logs'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-bold">
                      {doc.santriNama || doc.namaWali || doc.parsed?.nama_santri || doc.senderPhone || doc.source || 'Smart Riayah AI'}
                    </div>
                    <div className="text-[10px] font-mono opacity-75">
                      {doc.model || 'deepseek-chat'} {doc.latencyMs ? `• ${doc.latencyMs}ms` : ''}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 max-w-md">
                    <p className="line-clamp-2 text-[11px] leading-relaxed">{getDocSummary(doc)}</p>
                    {doc.adminNote && (
                      <span className="text-[10px] text-amber-500 italic block mt-0.5">
                        Note: {doc.adminNote}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[10px] opacity-75 whitespace-nowrap">
                    {doc.created_at ? new Date(doc.created_at).toLocaleString('id-ID') : '-'}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingDoc({
                          ...doc,
                          summary: getDocSummary(doc),
                          adminNote: doc.adminNote || '',
                          status: doc.status || 'VERIFIED'
                        })}
                        className="p-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-500 border border-sky-500/30"
                        title="Edit Catatan / Ringkasan Log AI"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDoc(doc)}
                        className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 border border-rose-500/30"
                        title="Hapus Log AI dari MongoDB"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Edit Dokumen AI */}
      {editingDoc && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEditDoc}
            className={`max-w-lg w-full rounded-3xl p-5 border shadow-2xl space-y-3 ${
              isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-500/20">
              <h4 className="font-black text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span>Edit Dokumen MongoDB ({editingDoc.id})</span>
              </h4>
              <button type="button" onClick={() => setEditingDoc(null)} className="p-1 rounded-lg opacity-70 hover:opacity-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs space-y-2">
              <div>
                <label className="font-bold block mb-1">Ringkasan / Summary AI</label>
                <textarea
                  rows={3}
                  value={editingDoc.summary || ''}
                  onChange={(e) => setEditingDoc({ ...editingDoc, summary: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl border text-xs ${
                    isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'
                  }`}
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Catatan Verifikasi Admin</label>
                <input
                  type="text"
                  value={editingDoc.adminNote || ''}
                  onChange={(e) => setEditingDoc({ ...editingDoc, adminNote: e.target.value })}
                  placeholder="Catatan tambahan..."
                  className={`w-full px-3 py-2 rounded-xl border text-xs ${
                    isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'
                  }`}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingDoc(null)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'}`}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isMutating}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Simpan Update MongoDB</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
