import React, { useState } from 'react';
import { 
  Wifi, 
  Radio, 
  Cpu, 
  MessageSquare, 
  CheckCircle2, 
  Clock, 
  Zap, 
  ArrowDownLeft, 
  ArrowUpRight, 
  RefreshCw, 
  ShieldCheck, 
  Activity,
  Layers,
  Sparkles
} from 'lucide-react';
import useWhatsAppSocket from '../../hooks/useWhatsAppSocket';
import { sound } from '../../utils/audio';

/**
 * ============================================================================
 * SMART RI'AYAH - SUPABASE REALTIME WHATSAPP LIVE MONITOR
 * Channel: 'whatsapp-room'
 * Panel live stream pesan masuk dan laporan status pengiriman WhatsApp
 * menggunakan Supabase Realtime Broadcast tanpa server WebSocket eksternal.
 * ============================================================================
 */

export default function WhatsAppSocketLiveMonitor({ onIncomingReceived = () => {} }) {
  const {
    connectionStatus,
    isConnected,
    eventHistory,
    simulateIncomingMessage,
    simulateStatusUpdate
  } = useWhatsAppSocket({
    onIncomingMessage: (msg) => {
      sound.playWhatsApp();
      onIncomingReceived(msg);
    },
    onStatusUpdate: () => {
      sound.playBeep();
    }
  });

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            Supabase Realtime Subscribed
          </span>
        );
      case 'connecting':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            Menghubungkan ke whatsapp-room...
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
            <span className="w-2 h-2 rounded-full bg-slate-500"></span>
            Realtime Standby
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 text-slate-100">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-emerald-950 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              WhatsApp Realtime Live Stream
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            Ditenagai oleh <b>Supabase Realtime Broadcast & Postgres Changes</b> pada channel <code className="text-emerald-400 font-mono">whatsapp-room</code>. Aktif langsung di Vercel tanpa perlu server WebSocket terpisah.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {getStatusBadge()}
          <span className="text-[11px] font-mono font-bold px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-emerald-300">
            #whatsapp-room
          </span>
        </div>
      </div>

      {/* Architecture Cards Info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-bold">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Realtime Engine:
            </span>
            <span className="font-mono text-emerald-400 text-[10px]">Cloud Active</span>
          </div>
          <p className="text-xs font-mono font-black text-slate-200">Supabase Realtime</p>
          <span className="text-[10px] text-slate-500 block">Serverless WebSockets bawaan</span>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-bold">
              <Wifi className="w-3.5 h-3.5 text-cyan-400" />
              Channel Siaran:
            </span>
            <span className="font-mono text-cyan-400 text-[10px]">Bi-directional</span>
          </div>
          <p className="text-xs font-mono font-black text-slate-200">whatsapp-room</p>
          <span className="text-[10px] text-slate-500 block">Broadcast & Postgres Changes</span>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-bold">
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              Total Live Event:
            </span>
            <span className="font-mono text-amber-400 text-[10px]">Buffer 50</span>
          </div>
          <p className="text-xs font-mono font-black text-slate-200">{eventHistory.length} Event Diterima</p>
          <span className="text-[10px] text-slate-500 block">Streaming instan tanpa refresh</span>
        </div>
      </div>

      {/* Action Controls & Simulation Buttons */}
      <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-gold-400" />
          Uji Coba Siaran Realtime (Broadcast):
        </span>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => simulateIncomingMessage()}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs"
            title="Kirim simulasi pesan WhatsApp masuk dari wali santri"
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Simulasi Pesan Masuk Wali</span>
          </button>

          <button
            type="button"
            onClick={() => simulateStatusUpdate({ status: 'DELIVERED', latencyMs: 145 })}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition border border-slate-700"
            title="Kirim simulasi laporan status pesan terkirim (Delivery Report)"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Simulasi DLR (Terkirim)</span>
          </button>
        </div>
      </div>

      {/* Live Event Stream Feed */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span className="font-bold flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            Live Stream Feed ({eventHistory.length})
          </span>
          <span className="text-[10px] text-slate-500">Auto-update via Supabase Realtime</span>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 max-h-64 overflow-y-auto space-y-2 font-mono text-xs divide-y divide-slate-800/60">
          {eventHistory.length === 0 ? (
            <div className="py-6 text-center text-slate-500 text-xs">
              <p>Menunggu event real-time dari Supabase channel <code className="text-emerald-400">whatsapp-room</code>...</p>
              <p className="text-[11px] text-slate-600 mt-1">Klik tombol <b>"Simulasi Pesan Masuk Wali"</b> di atas untuk menguji siaran real-time.</p>
            </div>
          ) : (
            eventHistory.map((item) => {
              const isIncoming = item.event === 'whatsapp.incoming';
              const isStatus = item.event === 'whatsapp.status';

              return (
                <div key={item.id} className="pt-2 first:pt-0 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                        isIncoming 
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40' 
                          : isStatus 
                          ? 'bg-cyan-950 text-cyan-300 border-cyan-500/40' 
                          : 'bg-amber-950 text-amber-300 border-amber-500/40'
                      }`}>
                        {item.event}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {item.data?.pengirim || item.data?.penerima || 'Gateway'}
                      </span>
                      {item.data?.nomor && (
                        <span className="text-[10px] text-slate-500">
                          ({item.data.nomor})
                        </span>
                      )}
                    </div>

                    <p className="text-slate-300 font-sans text-xs">
                      {item.data?.pesan || item.data?.keterangan || JSON.stringify(item.data)}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-500 block">
                      {item.timestamp}
                    </span>
                    {item.data?.latencyMs && (
                      <span className="text-[10px] text-emerald-400 font-bold block">
                        ⚡ {item.data.latencyMs} ms
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
