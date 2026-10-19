import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  TrendingUp, 
  Award, 
  ShieldCheck, 
  AlertTriangle, 
  Users, 
  Printer, 
  Calendar, 
  FileSpreadsheet, 
  Sparkles,
  Building,
  CheckCircle2
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  Legend 
} from 'recharts';
import SantriActivityAnalytics from '../modules/SantriActivityAnalytics';

export default function ExecutiveAnalytics() {
  const { santriList, permits, disciplineRecords, activeRoleTab, setActiveRoleTab } = useApp();
  const activeTab = activeRoleTab === 'ai_executive' ? 'ai_executive' : 'ringkasan';
  const setActiveTab = setActiveRoleTab;

  // Weekly Trend Mock data
  const permitTrendData = [
    { hari: 'Senin', pesiar: 4, pulang: 1, berobat: 2 },
    { hari: 'Selasa', pesiar: 3, pulang: 0, berobat: 3 },
    { hari: 'Rabu', pesiar: 6, pulang: 2, berobat: 1 },
    { hari: 'Kamis', pesiar: 5, pulang: 1, berobat: 4 },
    { hari: 'Jumat', pesiar: 18, pulang: 8, berobat: 2 },
    { hari: 'Sabtu', pesiar: 24, pulang: 14, berobat: 1 },
    { hari: 'Ahad', pesiar: 32, pulang: 19, berobat: 2 }
  ];

  // Category Distribution
  const categoryData = [
    { name: 'Pesiar Harian', value: 45, color: '#059669' },
    { name: 'Pulang Bermalam', value: 28, color: '#f59e0b' },
    { name: 'Berobat Luar', value: 12, color: '#e11d48' }
  ];

  // Discipline Distribution
  const disciplineSummaryData = [
    { range: '90 - 100 (Mumtaz)', santri: 4 },
    { range: '80 - 89 (Jayyid)', santri: 1 },
    { range: '70 - 79 (Maqbul)', santri: 0 },
    { range: '< 70 (Perlu Pembinaan)', santri: 1 }
  ];

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Kyai Executive Banner */}
      <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-emerald-950 text-white rounded-2xl p-6 shadow-xl border border-amber-600/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-amber-600/80 text-amber-100 text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider font-mono">
              ROLE: PIMPINAN PONDOK / KYAI
            </span>
            <span className="text-gold-300 text-xs flex items-center gap-1 font-arabic">
              الرعاية والتربية الإسلامية
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Executive Analytics & Decision Support System (DSS)
          </h1>
          <p className="text-xs text-slate-300 max-w-2xl mt-1">
            Dasbor eksekutif pimpinan untuk memantau integritas ekosistem perizinan Smart Gate, dinamika pembinaan santri, serta rekapitulasi data akreditasi pesantren.
          </p>
        </div>

        <button
          onClick={handlePrintReport}
          className="flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-slate-950 px-4 py-2.5 rounded-xl font-bold text-xs shadow-lg transition"
        >
          <Printer className="w-4 h-4" />
          <span>Cetak Rekap Laporan Bulanan</span>
        </button>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('ringkasan')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs ${
            activeTab === 'ringkasan'
              ? 'bg-amber-800 text-white'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Ringkasan Eksekutif & DSS</span>
        </button>

        <button
          onClick={() => setActiveTab('ai_executive')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs ${
            activeTab === 'ai_executive'
              ? 'bg-indigo-700 text-white shadow-indigo-200'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>🤖 AI Evaluasi Holistik Santri (DeepSeek)</span>
        </button>
      </div>

      {/* TAB 2: AI EVALUASI HOLISTIK SANTRI */}
      {activeTab === 'ai_executive' && (
        <div className="space-y-6 animate-fade-in">
          <SantriActivityAnalytics />
        </div>
      )}

      {/* TAB 1: EXECUTIVE RINGKASAN */}
      {activeTab === 'ringkasan' && (
      <>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase text-slate-500">Kepatuhan Smart Gate</span>
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 font-mono">94.8%</span>
            <span className="text-xs font-bold text-emerald-600">+2.4% bln ini</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Santri kembali tepat waktu sebelum deadlock gate
          </p>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase text-slate-500">Rata-rata Skor Adab</span>
            <Award className="w-5 h-5 text-gold-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 font-mono">89.2</span>
            <span className="text-xs font-bold text-slate-400">/ 100</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Evaluasi holistik Smart Ri'ayah seluruh asrama
          </p>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase text-slate-500">Kehadiran Shalat Masjid</span>
            <Building className="w-5 h-5 text-teal-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 font-mono">97.5%</span>
            <span className="text-xs font-bold text-teal-600">Presensi RFID</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Shalat 5 waktu berjamaah di Masjid Jami'
          </p>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase text-slate-500">Total Izin Minggu Ini</span>
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 font-mono">85</span>
            <span className="text-xs font-bold text-slate-500">Tiket</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Puncak keluar pada hari libur Ahad
          </p>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* 1. Weekly Permit Trends Area Chart (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Tren Fluktuasi Izin Keluar Mingguan
              </h3>
              <p className="text-xs text-slate-500">
                Data real-time verifikasi keluar gerbang turnstile berdasarkan hari
              </p>
            </div>
            <span className="text-xs font-mono bg-emerald-50 text-emerald-700 px-2 py-1 rounded font-bold">
              Bulan Berjalan
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={permitTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPesiar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorPulang" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="hari" tick={{ fontSize: 11 }} stroke="#64748b" />
                <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, borderColor: '#e2e8f0' }} />
                <Area type="monotone" dataKey="pesiar" stroke="#059669" fillOpacity={1} fill="url(#colorPesiar)" name="Pesiar" />
                <Area type="monotone" dataKey="pulang" stroke="#f59e0b" fillOpacity={1} fill="url(#colorPulang)" name="Pulang Bermalam" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Category Pie Chart (5 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-800">
              Distribusi Kategori Izin Santri
            </h3>
            <p className="text-xs text-slate-500">
              Proporsi jenis perizinan yang disetujui pengasuh
            </p>
          </div>

          <div className="h-48 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex justify-center gap-4 text-xs font-semibold">
            {categoryData.map((c, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }}></span>
                <span className="text-slate-700">{c.name} ({c.value}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Second Row: Ri'ayah Distribution & Executive Policy Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Ri'ayah Character Distribution Bar Chart (6 Cols) */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-800">
              Distribusi Indeks Kedisiplinan Santri
            </h3>
            <p className="text-xs text-slate-500">
              Segmentasi santri berdasarkan akumulasi skor buku induk Ri'ayah
            </p>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={disciplineSummaryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="range" tick={{ fontSize: 10 }} stroke="#64748b" />
                <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="santri" fill="#047857" radius={[6, 6, 0, 0]} name="Jumlah Santri" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI & Islamic Executive Insight (6 Cols) */}
        <div className="lg:col-span-6 bg-emerald-950 text-white rounded-2xl p-6 shadow-sm border border-emerald-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-gold-400" />
              <h3 className="font-bold text-base text-gold-300">
                Rekomendasi Kebijakan Pengasuhan (Executive Guidance)
              </h3>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-emerald-100">
              <div className="bg-emerald-900/60 p-3 rounded-xl border border-emerald-700/50">
                <b className="text-white block mb-1">1. Pola Keterlambatan Gerbang pada Hari Ahad:</b>
                Sebesar 80% keterlambatan pesiar terjadi antara pukul 17:00 - 17:30 WIB akibat kemacetan akses luar. Disarankan menetapkan batas toleransi jam kembali maksimal 16:45 WIB sebelum azan Maghrib berkumandang.
              </div>

              <div className="bg-emerald-900/60 p-3 rounded-xl border border-emerald-700/50">
                <b className="text-white block mb-1">2. Efektivitas Auto-Audit Overdue:</b>
                Sejak diterapkannya sistem pemotongan poin disiplin otomatis via IoT Smart Gate, angka santri yang kembali terlambat menurun hingga 42% dibanding metode manual buku perizinan konvensional.
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-emerald-800/80 flex items-center justify-between text-xs text-emerald-300">
            <span>Darul Ulum Decision Support Engine</span>
            <span className="font-mono">Status: Verified</span>
          </div>
        </div>

      </div>
      </>
      )}
    </div>
  );
}
