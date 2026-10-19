import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Send, 
  Key, 
  Smartphone, 
  Radio, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  Sparkles,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { sound } from '../../utils/audio';

export default function FonnteSettingsBox({ variant = 'compact', defaultExpanded = true }) {
  const { 
    fonnteToken, 
    setFonnteToken, 
    fonnteTargetNumber, 
    setFonnteTargetNumber, 
    isFonnteEnabled, 
    setIsFonnteEnabled, 
    testFonnteWhatsApp,
    isSendingFonnte,
    lastFonnteLatency,
    fonnteStatus
  } = useApp();

  const [copiedToken, setCopiedToken] = useState(false);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleCopyToken = () => {
    navigator.clipboard?.writeText(fonnteToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleTestSend = async () => {
    sound.playBeep();
    await testFonnteWhatsApp();
  };

  return (
    <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-4 shadow-xl text-slate-100 font-sans">
      {/* Header with status badge & toggle collapse */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-950 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h4 className="text-xs font-black text-white tracking-wide flex items-center gap-1.5">
              <span>LIVE FONNTE WHATSAPP GATEWAY</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                isFonnteEnabled 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}>
                {isFonnteEnabled ? 'API AKTIF (REAL-TIME)' : 'SIMULASI (OFF)'}
              </span>
            </h4>
            <p className="text-[10px] text-slate-400">
              Notifikasi otomatis perizinan & tap fisik RFID ESP32-S3 ke WhatsApp
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle Switch */}
          <label className="flex items-center cursor-pointer select-none" title="Aktifkan / Nonaktifkan Pengiriman WhatsApp Asli via Fonnte">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={isFonnteEnabled}
                onChange={(e) => {
                  sound.playBeep();
                  setIsFonnteEnabled(e.target.checked);
                }}
              />
              <div className={`block w-10 h-5 rounded-full transition-colors ${
                isFonnteEnabled ? 'bg-emerald-500' : 'bg-slate-700'
              }`}></div>
              <div className={`dot absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform ${
                isFonnteEnabled ? 'transform translate-x-5' : ''
              }`}></div>
            </div>
          </label>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-slate-400 hover:text-white transition rounded-lg hover:bg-slate-800"
            title={isExpanded ? 'Sembunyikan Pengaturan' : 'Tampilkan Pengaturan'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="pt-3 space-y-3">
          {/* Grid Input: Token & Target Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Input Fonnte API Token */}
            <div>
              <label className="text-[10px] font-bold text-slate-300 flex items-center justify-between mb-1">
                <span className="flex items-center gap-1">
                  <Key className="w-3 h-3 text-emerald-400" />
                  Fonnte API Token:
                </span>
                <button
                  type="button"
                  onClick={handleCopyToken}
                  className="text-[9px] text-emerald-400 hover:underline flex items-center gap-0.5"
                  title="Salin Token"
                >
                  {copiedToken ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedToken ? 'Tersalin' : 'Salin'}</span>
                </button>
              </label>
              <input
                type="text"
                value={fonnteToken}
                onChange={(e) => setFonnteToken(e.target.value)}
                placeholder="Contoh: XvFjdLyyvBgNUbXBZYzZ"
                className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-1.5 text-xs font-mono text-emerald-300 focus:outline-none transition shadow-inner"
              />
            </div>

            {/* Input Target Phone Number */}
            <div>
              <label className="text-[10px] font-bold text-slate-300 flex items-center justify-between mb-1">
                <span className="flex items-center gap-1">
                  <Smartphone className="w-3 h-3 text-emerald-400" />
                  Nomor WA Tujuan (Wali / Testing):
                </span>
                <span className="text-[9px] text-slate-400 font-mono">
                  Default: 08813576012
                </span>
              </label>
              <input
                type="text"
                value={fonnteTargetNumber}
                onChange={(e) => setFonnteTargetNumber(e.target.value)}
                placeholder="Contoh: 08813576012"
                className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-1.5 text-xs font-mono text-white focus:outline-none transition shadow-inner"
              />
            </div>
          </div>

          {/* Action Row: Test Send & Latency Badge */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Latency badge for journal */}
              <div className="flex items-center gap-1 bg-slate-950 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                <span className="text-[10px] text-slate-400 font-mono">⏱️ Latensi Terakhir:</span>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {lastFonnteLatency != null ? `${lastFonnteLatency} ms (${(lastFonnteLatency / 1000).toFixed(2)} detik)` : 'Siap Uji'}
                </span>
              </div>

              {fonnteStatus && (
                <span className={`text-[10px] px-2 py-0.5 rounded font-mono flex items-center gap-1 ${
                  fonnteStatus.success 
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' 
                    : 'bg-rose-950 text-rose-300 border border-rose-500/30'
                }`}>
                  {fonnteStatus.success ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <AlertCircle className="w-3 h-3 text-rose-400" />}
                  <span className="truncate max-w-[200px]">{fonnteStatus.message}</span>
                </span>
              )}
            </div>

            {/* Test Send Button */}
            <button
              onClick={handleTestSend}
              disabled={isSendingFonnte}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-lg ${
                isSendingFonnte
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/50'
              }`}
            >
              {isSendingFonnte ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Mengirim via Fonnte...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>📲 Tes Kirim WA Sekarang</span>
                </>
              )}
            </button>
          </div>

          <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              Endpoint: <code className="text-cyan-300 font-mono">POST https://api.fonnte.com/send</code>
            </span>
            <span className="text-emerald-400/80 font-mono">
              Country Code: 62 (Indonesia)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
