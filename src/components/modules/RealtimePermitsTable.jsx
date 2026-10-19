import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Zap, 
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Radio
} from 'lucide-react';

export default function RealtimePermitsTable() {
  const { 
    santriList, 
    permits, 
    highlightedSantriId, 
    processRfidTap,
    lastScannedUid 
  } = useApp();

  // Sort permits so active, approved, and overdue are prioritized at top
  const sortedPermits = [...permits].sort((a, b) => {
    const priority = { OVERDUE: 1, APPROVED: 2, ACTIVE: 3, PENDING: 4, REJECTED: 5, COMPLETED: 6 };
    return (priority[a.status] || 99) - (priority[b.status] || 99);
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              Daftar Real-Time Perizinan Santri Smart Gate
              <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-mono font-bold animate-pulse">
                LIVE SYNC
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Ter-highlight otomatis dan berubah statusnya secara real-time saat kartu fisik di-tap ke sensor RC522.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-400">TOTAL: <b className="text-white">{sortedPermits.length}</b> Izin</span>
          <span className="text-slate-600">|</span>
          <span className="text-emerald-400 font-bold">
            {permits.filter(p => p.status === 'APPROVED').length} Approved
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-rose-400 font-bold">
            {permits.filter(p => p.status === 'OVERDUE').length} Overdue
          </span>
        </div>
      </div>

      {/* Mini Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-y border-slate-800">
            <tr>
              <th className="py-2.5 px-3">Nama Santri & UID Kartu</th>
              <th className="py-2.5 px-3">Keperluan / Kategori</th>
              <th className="py-2.5 px-3">Batas Waktu</th>
              <th className="py-2.5 px-3">Status Izin</th>
              <th className="py-2.5 px-3 text-center">Uji Tap Langsung</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {sortedPermits.map(permit => {
              const santri = santriList.find(s => s.id === permit.santriId);
              const isHighlighted = highlightedSantriId === permit.santriId;

              return (
                <tr
                  key={permit.id}
                  className={`transition-all duration-300 ${
                    isHighlighted
                      ? 'bg-cyan-950/80 ring-2 ring-cyan-400 font-bold'
                      : 'hover:bg-slate-800/50'
                  }`}
                >
                  {/* Nama Santri & UID Kartu */}
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2.5">
                      <div className="relative shrink-0">
                        <img
                          src={santri?.foto}
                          alt={santri?.nama}
                          className={`w-9 h-9 rounded-xl object-cover border ${
                            isHighlighted ? 'border-cyan-400 shadow-cyan-400/50 shadow-sm' : 'border-slate-700'
                          }`}
                        />
                        {isHighlighted && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-cyan-400 rounded-full animate-ping"></span>
                        )}
                      </div>
                      <div>
                        <span className="font-sans font-bold text-white block leading-tight text-xs">
                          {santri?.nama}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="bg-slate-950 text-gold-300 border border-slate-700 px-1.5 py-0.2 rounded text-[10px] font-bold">
                            UID: {santri?.rfidUid}
                          </span>
                          <span className="text-slate-400 text-[10px] font-sans">
                            {santri?.kelas}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Keperluan */}
                  <td className="py-2.5 px-3 text-slate-300 max-w-xs font-sans text-[11px]">
                    <span className="text-[10px] font-mono text-cyan-300 font-bold block">
                      [{permit.kategori}]
                    </span>
                    <span className="truncate block" title={permit.keperluan}>
                      {permit.keperluan}
                    </span>
                  </td>

                  {/* Batas Waktu */}
                  <td className="py-2.5 px-3 text-slate-300">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>
                        {new Date(permit.batasKembali).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 block">
                      Token: {permit.tokenIzin}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="py-2.5 px-3">
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full inline-block ${
                      permit.status === 'APPROVED' ? 'bg-emerald-950 text-emerald-300 border border-emerald-400 shadow-emerald-950 shadow' :
                      permit.status === 'ACTIVE' ? 'bg-blue-950 text-blue-300 border border-blue-400 animate-pulse' :
                      permit.status === 'OVERDUE' ? 'bg-rose-950 text-rose-300 border border-rose-500 animate-bounce' :
                      permit.status === 'REJECTED' ? 'bg-rose-950/80 text-rose-400 border border-rose-800' :
                      permit.status === 'COMPLETED' ? 'bg-slate-800 text-slate-300 border border-slate-700' :
                      'bg-amber-950 text-amber-300 border border-amber-500/40'
                    }`}>
                      {permit.status}
                    </span>
                  </td>

                  {/* Uji Tap Langsung */}
                  <td className="py-2.5 px-3 text-center">
                    <button
                      onClick={() => {
                        if (santri) {
                          processRfidTap(santri.rfidUid);
                        }
                      }}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/30 rounded-lg text-[10px] font-bold font-mono transition inline-flex items-center gap-1"
                      title={`Simulasikan Tap Kartu RFID ${santri?.nama}`}
                    >
                      <Zap className="w-3 h-3 text-cyan-400" />
                      <span>Tap RFID</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
