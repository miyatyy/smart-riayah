import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Terminal, 
  X, 
  Trash2, 
  Zap, 
  Radio, 
  HelpCircle, 
  CheckCircle2, 
  AlertTriangle,
  Send,
  Cpu,
  RefreshCw
} from 'lucide-react';
import { sound } from '../../utils/audio';

export default function SerialMonitorModal() {
  const { 
    isSerialMonitorOpen, 
    setIsSerialMonitorOpen,
    isSerialConnected,
    connectSerial,
    disconnectSerial,
    serialRawLogs,
    sendCustomCommand,
    processRfidTap,
    lastScannedUid,
    isRfidModuleEnabled,
    setIsRfidModuleEnabled
  } = useApp();

  const [selectedBaud, setSelectedBaud] = useState(115200);
  const [manualUid, setManualUid] = useState('53:57:98:0F');
  const [commandInput, setCommandInput] = useState('');

  if (!isSerialMonitorOpen) return null;

  const handleReconnectWithBaud = async (baud) => {
    setSelectedBaud(baud);
    if (isSerialConnected) {
      await disconnectSerial();
    }
    try {
      await connectSerial(baud);
    } catch {}
  };

  const handleSendManual = (e) => {
    e.preventDefault();
    if (!manualUid.trim()) return;
    sound.playSuccess();
    processRfidTap(manualUid.trim());
  };

  const handleSendCommand = async (e) => {
    e.preventDefault();
    if (!commandInput.trim()) return;
    await sendCustomCommand(commandInput.trim());
    setCommandInput('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-950 text-cyan-400 rounded-2xl border border-cyan-500/30 shadow-md">
              <Terminal className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">
                  Live Web Serial Monitor & Diagnostik Hardware
                </h3>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border ${
                  isSerialConnected 
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500' 
                    : 'bg-amber-950 text-amber-300 border-amber-600'
                }`}>
                  {isSerialConnected ? '● PORT TERHUBUNG' : '○ PORT TERPUTUS'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Monitor komunikasi real-time antara mikrokontroler ESP32-S3 RC522 dengan browser Chrome/Edge
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsSerialMonitorOpen(false)}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Baud Rate & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/70 p-3 rounded-2xl border border-slate-800 shrink-0 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px]">Baud Rate:</span>
            <div className="flex items-center gap-1">
              {[115200, 9600].map(b => (
                <button
                  key={b}
                  type="button"
                  onClick={() => handleReconnectWithBaud(b)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition text-xs ${
                    selectedBaud === b 
                      ? 'bg-cyan-600 text-slate-950 shadow-sm' 
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {b} bps
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px]">Modul RFID:</span>
            <button
              onClick={() => setIsRfidModuleEnabled(!isRfidModuleEnabled)}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs ${
                isRfidModuleEnabled ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
              }`}
            >
              {isRfidModuleEnabled ? 'ON (Aktif)' : 'OFF (Nonaktif)'}
            </button>

            {isSerialConnected ? (
              <button
                onClick={disconnectSerial}
                className="px-3 py-1 bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-300 rounded-lg font-bold border border-slate-700"
              >
                Putus Port
              </button>
            ) : (
              <button
                onClick={() => connectSerial(selectedBaud)}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow"
              >
                ⚡ Sambungkan USB
              </button>
            )}
          </div>
        </div>

        {/* Main Terminal Output */}
        <div className="flex-1 bg-black rounded-2xl p-4 border border-slate-800 font-mono text-[11px] overflow-y-auto min-h-[180px] max-h-[260px] space-y-1.5 shadow-inner">
          <div className="flex items-center justify-between text-slate-500 pb-1.5 border-b border-slate-900 text-[10px]">
            <span>LOG MONITOR PENERIMAAN SERIAL (RX / TX)</span>
            <span>{serialRawLogs.length} Pesan</span>
          </div>

          {serialRawLogs.length === 0 ? (
            <div className="py-8 text-center text-slate-500 italic space-y-1">
              <p>Belum ada data masuk dari kabel serial USB.</p>
              <p className="text-[10px] text-slate-600">
                Silakan tempelkan kartu RFID pada alat RC522 Anda.
              </p>
            </div>
          ) : (
            serialRawLogs.map((log, idx) => (
              <div key={idx} className="flex items-start gap-2 animate-fade-in">
                <span className="text-slate-600 shrink-0 text-[10px]">
                  {new Date(log.timestamp).toLocaleTimeString('id-ID')}
                </span>
                <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0 ${
                  log.type === 'RX' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                  log.type === 'TX' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' :
                  log.type === 'ERROR' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                  'bg-slate-900 text-slate-400'
                }`}>
                  {log.type}
                </span>
                <span className={`break-all ${
                  log.type === 'RX' ? 'text-emerald-300 font-bold' : 
                  log.type === 'TX' ? 'text-cyan-300' : 
                  log.type === 'ERROR' ? 'text-rose-400' : 
                  'text-slate-400'
                }`}>
                  {log.text}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Manual Test UID & Serial Command Sender */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0 pt-2 border-t border-slate-800">
          {/* Test UID Tap Form */}
          <form onSubmit={handleSendManual} className="flex items-center gap-2">
            <input
              type="text"
              value={manualUid}
              onChange={(e) => setManualUid(e.target.value)}
              placeholder="Contoh: 53:57:98:0F"
              className="flex-1 bg-slate-950 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1 shrink-0 shadow"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Simulasi Tap</span>
            </button>
          </form>

          {/* Test Send Serial Command to ESP32 */}
          <form onSubmit={handleSendCommand} className="flex items-center gap-2">
            <input
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              placeholder="Perintah (misal: CMD:OPEN_GATE)"
              className="flex-1 bg-slate-950 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-emerald-400"
            />
            <button
              type="submit"
              disabled={!isSerialConnected}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl flex items-center gap-1 shrink-0 shadow"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Kirim USB</span>
            </button>
          </form>
        </div>

        {/* 4 Point Hardware Diagnostics Checklist */}
        <div className="bg-slate-950/60 rounded-2xl p-3 border border-slate-800 text-[11px] text-slate-300 space-y-1.5 shrink-0">
          <span className="font-bold text-cyan-400 flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5" /> Checklist Masalah Fisik Sensor RC522:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-slate-400">
            <div>• <b>Buzzer/LED Breadboard:</b> Jika kartu ditempel dan buzzer/LED fisik tidak berbunyi, modul RC522 belum membaca kartu secara fisik.</div>
            <div>• <b>Tipe Kartu:</b> Pastikan kartu bertipe <b>13.56 MHz (Mifare)</b>, bukan kartu 125 kHz (EM4100).</div>
            <div>• <b>Kabel Jumper SPI:</b> Pastikan pin 3.3V, GND, SDA (GPIO 10), SCK (GPIO 12), MOSI (GPIO 11), MISO (GPIO 13) menancap kencang.</div>
            <div>• <b>Baud Rate Sketch:</b> Jika di Arduino IDE tertulis <code>Serial.begin(9600)</code>, klik tombol <b>9600 bps</b> di atas.</div>
          </div>
        </div>

      </div>
    </div>
  );
}
