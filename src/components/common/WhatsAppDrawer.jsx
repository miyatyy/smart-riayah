import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  MessageSquare, 
  X, 
  Send, 
  CheckCheck, 
  Phone, 
  Video, 
  MoreVertical, 
  ShieldAlert, 
  BellRing, 
  Sparkles,
  Volume2,
  Settings2,
  Copy,
  Check,
  Zap
} from 'lucide-react';
import { sound } from '../../utils/audio';
import FonnteSettingsBox from './FonnteSettingsBox';

export default function WhatsAppDrawer() {
  const { 
    whatsappLogs, 
    isWaDrawerOpen, 
    setIsWaDrawerOpen, 
    unreadWaCount, 
    setUnreadWaCount,
    sendWhatsAppNotification,
    isFonnteEnabled,
    fonnteTargetNumber
  } = useApp();

  const [testCustomMsg, setTestCustomMsg] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const handleManualTestSend = (e) => {
    e.preventDefault();
    if (!testCustomMsg.trim()) return;
    sendWhatsAppNotification(
      'Ibu Fatimah Az-Zahra (Wali Ahmad Fauzi)',
      fonnteTargetNumber || '08813576012',
      'MANUAL_TEST',
      testCustomMsg
    );
    setTestCustomMsg('');
  };

  const copyJournalData = (msg) => {
    const latText = msg.latencyMs != null ? `${msg.latencyMs} ms (${msg.latencySec} detik)` : 'Simulasi / Offline';
    const copyContent = `[DATA JURNAL SMART PERMIT & WA GATEWAY]\nWaktu: ${msg.waktu}\nTipe Event: ${msg.tipe}\nPenerima: ${msg.penerima} (${msg.nomor})\n⏱️ Latensi WA API: ${latText}\nStatus: ${msg.apiStatus || 'OK'}`;
    navigator.clipboard?.writeText(copyContent);
    setCopiedId(msg.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getBadgeStyle = (tipe) => {
    switch (tipe) {
      case 'OVERDUE_ALARM':
      case 'OVERDUE_ALERT':
      case 'SECURITY_ALERT':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'WARNING_30M':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'GATE_EXIT':
      case 'GATE_ENTRY':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'PERMIT_APPROVED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'PERMIT_REJECTED':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'GATEWAY_TEST':
        return 'bg-teal-100 text-teal-800 border-teal-300';
      case 'HOSPITAL_REFERRAL':
      case 'HEALTH_NOTIF':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'CASHLESS_NOTIF':
        return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <>
      {/* Floating Bottom-Right Trigger Button when closed */}
      {!isWaDrawerOpen && (
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={() => {
              setIsWaDrawerOpen(true);
              setUnreadWaCount(0);
              sound.playBeep();
            }}
            className="group flex items-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-full shadow-2xl transition-all duration-200 transform hover:scale-105 border-2 border-white"
          >
            <div className="relative">
              <MessageSquare className="w-6 h-6" />
              {unreadWaCount > 0 && (
                <span className="animate-ping absolute -top-2 -right-2 bg-rose-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {unreadWaCount}
                </span>
              )}
            </div>
            <div className="text-left font-sans hidden sm:block">
              <div className="text-xs font-bold leading-none flex items-center gap-1.5">
                <span>Live WhatsApp Gateway</span>
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
              </div>
              <div className="text-[10px] text-emerald-100 mt-0.5 flex items-center gap-1">
                <span>{whatsappLogs.length} notifikasi</span>
                <span>•</span>
                <span className="font-mono font-bold text-emerald-200">
                  {isFonnteEnabled ? 'Fonnte ON' : 'Simulasi'}
                </span>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Floating Smartphone Mockup Drawer */}
      {isWaDrawerOpen && (
        <div className="fixed inset-x-3 bottom-20 sm:bottom-6 sm:inset-x-auto sm:right-6 z-50 w-auto sm:w-full max-w-sm sm:max-w-md bg-white rounded-2xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col h-[650px] max-h-[85vh] transition-all animate-in slide-in-from-bottom-5">
          {/* WhatsApp Header */}
          <div className="bg-[#075e54] text-white px-4 py-3 flex items-center justify-between shrink-0 shadow">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src="https://images.unsplash.com/photo-1544717305-2782549b5136?w=100&auto=format&fit=crop&q=80"
                  alt="Wali"
                  className="w-10 h-10 rounded-full object-cover border-2 border-emerald-300"
                />
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-[#075e54] rounded-full"></span>
              </div>
              <div>
                <h3 className="font-bold text-sm leading-tight flex items-center gap-1.5">
                  Ibu Fatimah Az-Zahra
                  <span className="text-[10px] bg-emerald-800/80 px-1.5 py-0.5 rounded text-emerald-200">Wali</span>
                </h3>
                <p className="text-[11px] text-emerald-100 flex items-center gap-1">
                  <span>Smart Gateway Online</span>
                  <span>•</span>
                  <span>+62 {fonnteTargetNumber || '881-3576-012'}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowSettings(!showSettings)}
                title="Buka / Tutup Pengaturan Fonnte Gateway"
                className={`p-1.5 rounded-full transition ${
                  showSettings ? 'bg-emerald-800 text-gold-300' : 'hover:bg-emerald-800 text-emerald-200'
                }`}
              >
                <Settings2 className="w-4 h-4" />
              </button>
              <button 
                onClick={() => sound.playWhatsApp()}
                title="Test Audio Chime"
                className="p-1.5 hover:bg-emerald-800 rounded-full transition text-emerald-200"
              >
                <Volume2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsWaDrawerOpen(false)}
                className="p-1.5 hover:bg-emerald-800 rounded-full transition text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Subheader info banner with quick settings toggle */}
          <div className="bg-[#128c7e] text-white/95 px-3 py-1.5 text-[11px] flex items-center justify-between">
            <span className="flex items-center gap-1 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-gold-300" />
              <span>Fonnte Real-Time WhatsApp API Gateway</span>
            </span>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="text-[10px] bg-emerald-950/60 hover:bg-emerald-950 text-emerald-200 px-2 py-0.5 rounded transition flex items-center gap-1 font-mono font-bold"
            >
              <span>{showSettings ? 'Tutup Pengaturan' : '⚙️ Pengaturan Fonnte'}</span>
            </button>
          </div>

          {/* Settings Box Drawer Component */}
          {showSettings && (
            <div className="p-2.5 bg-slate-950 border-b border-emerald-500/30 shrink-0 max-h-[300px] overflow-y-auto">
              <FonnteSettingsBox variant="compact" defaultExpanded={true} />
            </div>
          )}

          {/* Chat Messages Body with WhatsApp Style Wallpaper */}
          <div 
            className="flex-1 p-3 overflow-y-auto space-y-3 bg-[#efeae2]"
            style={{
              backgroundImage: 'radial-gradient(#d1d7db 1px, transparent 1px)',
              backgroundSize: '16px 16px'
            }}
          >
            {/* Encryption notice */}
            <div className="text-center my-1">
              <span className="bg-[#ffeecd] text-slate-700 text-[10px] px-3 py-1 rounded-md shadow-sm border border-amber-200 inline-block font-sans">
                🔒 Terhubung otomatis ke API Fonnte & Sensor RFID ESP32-S3 Smart Turnstile.
              </span>
            </div>

            {whatsappLogs.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                Belum ada notifikasi WhatsApp terkirim. Lakukan aksi perizinan atau tap kartu RFID di gerbang!
              </div>
            ) : (
              whatsappLogs.map((msg) => (
                <div key={msg.id} className="flex flex-col items-start max-w-[95%]">
                  <div className="bg-white rounded-lg rounded-tl-none p-3 shadow-sm border border-slate-200 text-slate-800 text-xs leading-relaxed w-full">
                    {/* Badge Tipe */}
                    <div className="flex items-center justify-between gap-2 mb-1.5 pb-1 border-b border-slate-100">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getBadgeStyle(msg.tipe)}`}>
                        {msg.tipe.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {msg.waktu}
                      </span>
                    </div>

                    {/* Sender context */}
                    <div className="text-[11px] font-bold text-emerald-800 mb-1 flex items-center justify-between">
                      <span>Pesantren Modern Darul Ulum:</span>
                      <span className="text-[9px] text-slate-400 font-mono">Ke: {msg.nomor || 'Testing'}</span>
                    </div>

                    {/* Body Text */}
                    <p className="whitespace-pre-line text-slate-700 font-sans">
                      {msg.pesan}
                    </p>

                    {/* Latency & Journal Recording Badge (Pencatatan Latensi untuk Data Jurnal) */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Prompt-mandated badge format: ⏱️ Latensi WA API: XXX ms (X.XX detik) */}
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded shadow-xs">
                          ⏱️ Latensi WA API: {msg.latencyMs != null ? `${msg.latencyMs} ms (${msg.latencySec} detik)` : (msg.apiStatus === 'SENDING' ? 'Mengirim...' : '~250 ms (Simulasi)')}
                        </span>

                        {msg.apiStatus === 'SUCCESS' && (
                          <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold font-mono">
                            ✓ 200 OK
                          </span>
                        )}
                        {msg.apiStatus && msg.apiStatus !== 'SUCCESS' && msg.apiStatus !== 'SENDING' && msg.apiStatus !== 'SIMULATED' && (
                          <span className="text-[9px] bg-rose-100 text-rose-700 border border-rose-300 px-1.5 py-0.5 rounded font-mono font-bold" title={msg.apiStatus}>
                            {String(msg.apiStatus).slice(0, 15)}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => copyJournalData(msg)}
                        title="Salin Data Pengujian Latensi untuk Jurnal Ilmiah"
                        className="text-[10px] text-slate-500 hover:text-emerald-700 font-medium flex items-center gap-1 bg-slate-100 hover:bg-emerald-50 px-2 py-0.5 rounded transition"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-600 font-bold">Disalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Salin Jurnal</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Footer receipt */}
                    <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-slate-400">
                      <span>Terkirim ke: {msg.penerima.split('(')[0]}</span>
                      <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Test message sender bar */}
          <form onSubmit={handleManualTestSend} className="p-2.5 bg-[#f0f2f5] border-t border-slate-200 flex items-center gap-2">
            <input
              type="text"
              value={testCustomMsg}
              onChange={(e) => setTestCustomMsg(e.target.value)}
              placeholder="Ketik pesan broadcast manual..."
              className="flex-1 px-3 py-2 bg-white rounded-full text-xs border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button
              type="submit"
              className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full transition shadow"
              title="Kirim Pesan Manual"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
