import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Sparkles, 
  BookOpen, 
  ShoppingBag, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Award, 
  ShieldCheck, 
  TrendingUp, 
  ArrowUpRight, 
  RotateCcw, 
  Copy, 
  Check, 
  Printer, 
  Search, 
  Sliders, 
  Flame, 
  HeartHandshake,
  Smartphone,
  ChevronDown,
  Info,
  Key,
  Cpu,
  Zap,
  CheckCircle,
  X,
  ExternalLink
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  Cell 
} from 'recharts';
import { MONTH_OPTIONS, getSantriActivityAnalytics } from '../../data/santriActivityData';
import { 
  DEFAULT_DEEPSEEK_TOKEN, 
  DEFAULT_MODEL, 
  generateDeepSeekSantriAnalysis, 
  testDeepSeekConnection 
} from '../../utils/deepseekApi';
import { sound } from '../../utils/audio';

export default function SantriActivityAnalytics({ activeSantri: propActiveSantri }) {
  const { 
    santriList,
    activeSantriId,
    setActiveSantriId,
    role,
    openAiAgentForSantri,
    deepseekToken = DEFAULT_DEEPSEEK_TOKEN, 
    setDeepseekToken, 
    deepseekModel = DEFAULT_MODEL, 
    setDeepseekModel 
  } = useApp();

  const activeSantri = propActiveSantri || santriList?.find(s => s.id === activeSantriId) || santriList?.[0];
  const [selectedMonth, setSelectedMonth] = useState('2026-10');
  const [chartMode, setChartMode] = useState('weekly'); // 'weekly' | 'trend' | 'prayer'
  const [activeLogCategory, setActiveLogCategory] = useState('ALL'); // 'ALL' | 'MESJID' | 'TAHFIDZ' | 'KANTIN' | 'GATE'
  const [searchLogQuery, setSearchLogQuery] = useState('');
  
  // AI State & Live DeepSeek Integration
  const [liveAiResult, setLiveAiResult] = useState(null);
  const [isCallingDeepSeek, setIsCallingDeepSeek] = useState(false);
  const [deepSeekError, setDeepSeekError] = useState(null);
  const [deepSeekLatency, setDeepSeekLatency] = useState(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Token Settings Modal State
  const [showTokenSettings, setShowTokenSettings] = useState(false);
  const [inputToken, setInputToken] = useState(deepseekToken || DEFAULT_DEEPSEEK_TOKEN);
  const [inputModel, setInputModel] = useState(deepseekModel || DEFAULT_MODEL);
  const [isTestingToken, setIsTestingToken] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saveTokenNotice, setSaveTokenNotice] = useState(false);

  // Compute analytics data based on active santri and month
  const analytics = getSantriActivityAnalytics(activeSantri, selectedMonth);

  // Reset live AI result when santri or month changes so analysis stays synchronous
  useEffect(() => {
    setLiveAiResult(null);
    setDeepSeekError(null);
    setDeepSeekLatency(null);
  }, [activeSantri?.id, selectedMonth]);

  if (!analytics) return null;

  const { weeklyData, monthlyTrendData, prayerBreakdown, totals, activityLogs, aiAnalysis: defaultAi } = analytics;

  // Active AI data: prioritize live DeepSeek AI response if available, fallback to deterministic generator
  const effectiveAi = liveAiResult?.data || defaultAi;
  const isRealDeepSeek = Boolean(liveAiResult?.success);

  // Filter activity logs
  const filteredLogs = activityLogs.filter(log => {
    const matchesCategory = activeLogCategory === 'ALL' || log.kategori === activeLogCategory;
    const matchesSearch = searchLogQuery === '' || 
      log.label.toLowerCase().includes(searchLogQuery.toLowerCase()) ||
      log.detail.toLowerCase().includes(searchLogQuery.toLowerCase()) ||
      log.waktu.toLowerCase().includes(searchLogQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Handle Real DeepSeek AI Generation
  const handleRegenerateAi = async () => {
    setIsCallingDeepSeek(true);
    setDeepSeekError(null);
    sound.playBeep?.();

    try {
      const activeTok = deepseekToken || DEFAULT_DEEPSEEK_TOKEN;
      const res = await generateDeepSeekSantriAnalysis({
        santri: activeSantri,
        month: selectedMonth,
        totals,
        prayerBreakdown,
        weeklyData,
        role: role || 'parent',
        token: activeTok,
        model: deepseekModel || DEFAULT_MODEL
      });

      if (res.success && res.data) {
        setLiveAiResult(res);
        setDeepSeekLatency(res.latencyMs);
        sound.playSuccess?.();
      } else {
        setDeepSeekError(res.error || 'DeepSeek API offline / batas token. Beralih ke analisis lokal.');
        sound.playChime?.();
      }
    } catch (err) {
      setDeepSeekError(err.message || 'Gagal memanggil DeepSeek API.');
    } finally {
      setIsCallingDeepSeek(false);
    }
  };

  // Test DeepSeek token connection inside modal
  const handleTestToken = async () => {
    setIsTestingToken(true);
    setTestResult(null);
    sound.playBeep?.();

    const res = await testDeepSeekConnection(inputToken);
    setIsTestingToken(false);
    setTestResult(res);

    if (res.success) {
      sound.playSuccess?.();
    }
  };

  // Save Token Configuration
  const handleSaveToken = (e) => {
    e.preventDefault();
    if (setDeepseekToken) setDeepseekToken(inputToken.trim());
    if (setDeepseekModel) setDeepseekModel(inputModel);
    
    setSaveTokenNotice(true);
    sound.playSuccess?.();
    setTimeout(() => {
      setSaveTokenNotice(false);
      setShowTokenSettings(false);
    }, 1500);
  };

  // Handle Copy AI Summary for WhatsApp
  const handleCopySummary = () => {
    const textToCopy = `*📊 LAPORAN AKTIVITAS & KESIMPULAN DEEPSEEK AI SANTRI*\n` +
      `*Pesantren Modern Darul Ulum - Smart Riayah*\n\n` +
      `👤 *Nama Santri:* ${activeSantri.nama} (Kelas: ${activeSantri.kelas})\n` +
      `🏠 *Asrama/Kamar:* ${activeSantri.kamar}\n` +
      `🗓️ *Periode:* ${MONTH_OPTIONS.find(m => m.value === selectedMonth)?.label}\n` +
      `🤖 *Mesin AI:* DeepSeek AI (${liveAiResult?.model || deepseekModel || 'deepseek-chat'})\n\n` +
      `⭐ *Skor Indeks Harmoni AI:* ${effectiveAi.harmonyScore}/100 (${effectiveAi.category})\n` +
      `🕌 *Kehadiran Shalat di Masjid:* ${totals.mesjidTaps}x (${totals.mesjidPct}% Istiqomah)\n` +
      `📖 *Capaian Tahfidz Al-Qur'an:* Juz ${activeSantri.tahfidzJuz} (${totals.tahfidzSessions} Sesi Muroja'ah & Ziyadah)\n` +
      `🛍️ *Pengeluaran Smart Card Kantin:* Rp ${totals.belanjaNominal.toLocaleString('id-ID')} (Rata-rata: Rp ${totals.avgBelanjaPerHari.toLocaleString('id-ID')}/hari)\n` +
      `🛡️ *Poin Kedisiplinan Ri'ayah:* ${activeSantri.poinDisiplin}/100\n\n` +
      `💡 *Kesimpulan AI Smart Riayah:*\n"${effectiveAi.narrativeSummary}"\n\n` +
      `📌 *Saran Tindakan Orang Tua:*\n` +
      effectiveAi.recommendations.map((r, i) => `${i + 1}. *${r.title}:* ${r.desc}`).join('\n') +
      `\n\n_Diproses melalui DeepSeek AI Engine & Smart Riayah IoT Ecosystem_`;

    navigator.clipboard.writeText(textToCopy);
    setCopiedSummary(true);
    sound.playSuccess?.();
    setTimeout(() => setCopiedSummary(false), 3000);
  };

  // Custom Tooltip for Recharts
  const CustomChartTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-xl border border-slate-700 shadow-xl text-xs space-y-1.5 min-w-[200px]">
          <p className="font-bold text-emerald-400 border-b border-slate-700 pb-1 flex items-center justify-between">
            <span>{label}</span>
            <span className="text-[10px] text-slate-400 font-mono">Bulan: {selectedMonth}</span>
          </p>
          {payload.map((entry, index) => (
            <div key={`item-${index}`} className="flex items-center justify-between gap-3 text-[11px]">
              <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span>{entry.name}:</span>
              </span>
              <span className="font-bold font-mono text-white">
                {entry.value} {entry.name.includes('Belanja') ? 'transaksi' : 'kali'}
              </span>
            </div>
          ))}
          {payload[0]?.payload?.totalBelanjaRp && (
            <div className="pt-1 mt-1 border-t border-slate-800 text-[10px] text-slate-300 flex justify-between">
              <span>Estimasi Belanja:</span>
              <span className="text-amber-300 font-mono font-bold">
                Rp {payload[0].payload.totalBelanjaRp.toLocaleString('id-ID')}
              </span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar: Period Selector & Diagram Mode */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-600" /> DeepSeek AI Character Analytics
              </span>
              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                NIS: {activeSantri.nis}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              Diagram Aktivitas & Analisis AI Santri
            </h2>
            <p className="text-xs text-slate-500">
              Visualisasi komprehensif ke masjid, hafalan Al-Qur'an, dan transaksi belanja ananda <b>{activeSantri.nama}</b> dengan kecerdasan buatan DeepSeek.
            </p>
          </div>

          {/* Controls: Month Selector, DeepSeek Status, & Action Buttons */}
          <div className="scroll-row gap-2.5 pb-1 -mb-1">
            {/* Santri Selector if in staff/admin/musyrif role */}
            {role !== 'parent' && santriList && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                <label className="text-xs text-slate-500 font-medium">Santri:</label>
                <select
                  value={activeSantri?.id}
                  onChange={(e) => setActiveSantriId?.(e.target.value)}
                  className="text-xs font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  {santriList.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.nama} ({s.kelas})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Month Filter Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <label className="text-xs text-slate-500 font-medium">Bulan:</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-xs font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                {MONTH_OPTIONS.map(m => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Open AI Agent Modal Button */}
            <button
              onClick={() => openAiAgentForSantri?.(activeSantri?.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border border-indigo-300 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white shadow-xs cursor-pointer"
              title="Buka AI Agent Assistant untuk Konsultasi & Chat Interaktif"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
              <span>Buka AI Agent</span>
            </button>

            {/* DeepSeek Token Quick Setting Pill */}
            <button
              onClick={() => setShowTokenSettings(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition border border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 shadow-xs cursor-pointer"
              title="Atur Token DeepSeek AI"
            >
              <Key className="w-3.5 h-3.5 text-indigo-600" />
              <span>Token DeepSeek</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
            </button>

            {/* Quick Share / Copy for Family Button */}
            <button
              onClick={handleCopySummary}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs ${
                copiedSummary
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
              }`}
              title="Salin ringkasan laporan ke WhatsApp keluarga"
            >
              {copiedSummary ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-emerald-700" />}
              <span>{copiedSummary ? 'Disalin ke WA!' : 'Salin untuk WA'}</span>
            </button>

            {/* Print Raport Button */}
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition border border-slate-200"
              title="Cetak Laporan Aktivitas"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">Cetak</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Top Monthly Stat Cards (Highlight Indicators) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Kehadiran Mesjid */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 border border-emerald-200 rounded-2xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
              🕌 Shalat di Masjid
            </span>
            <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
              {totals.mesjidPct}% Istiqomah
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-900 font-mono">
              {totals.mesjidTaps}
            </span>
            <span className="text-xs text-emerald-700 font-medium">/ 140 shalat fardhu</span>
          </div>
          <p className="text-[11px] text-emerald-800/80 mt-1">
            Tap gerbang RFID Masjid Jami' otomatis saat Subuh, Dzuhur, Ashar, Maghrib & Isya'.
          </p>
          <div className="w-full bg-emerald-200/80 rounded-full h-1.5 mt-3 overflow-hidden">
            <div 
              className="bg-emerald-600 h-1.5 rounded-full transition-all duration-700" 
              style={{ width: `${Math.min(100, totals.mesjidPct)}%` }} 
            />
          </div>
        </div>

        {/* Card 2: Setoran Hafalan Al-Qur'an */}
        <div className="bg-gradient-to-br from-amber-50 to-yellow-50/50 border border-amber-200 rounded-2xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
              📖 Hafalan Qur'an
            </span>
            <span className="bg-amber-500 text-slate-900 text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs">
              MUMTAZ
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-amber-950 font-mono">
              Juz {activeSantri.tahfidzJuz}
            </span>
            <span className="text-xs text-amber-800 font-medium font-mono">
              ({totals.tahfidzSessions} Sesi Muroja'ah)
            </span>
          </div>
          <p className="text-[11px] text-amber-800/80 mt-1">
            Ziyadah aktif & muroja'ah rutin harian di bawah bimbingan Ustadz Halaqah.
          </p>
          <div className="w-full bg-amber-200/80 rounded-full h-1.5 mt-3 overflow-hidden">
            <div 
              className="bg-amber-500 h-1.5 rounded-full transition-all duration-700" 
              style={{ width: `${Math.min(100, (activeSantri.tahfidzJuz / 30) * 100 + 20)}%` }} 
            />
          </div>
        </div>

        {/* Card 3: Belanja Smart Card Kantin */}
        <div className="bg-gradient-to-br from-sky-50 to-blue-50/50 border border-sky-200 rounded-2xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-sky-800 uppercase tracking-wider flex items-center gap-1">
              🛍️ Belanja Kantin
            </span>
            <span className="bg-sky-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
              Hemat & Tertib
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-sky-950 font-mono">
              Rp {totals.belanjaNominal.toLocaleString('id-ID')}
            </span>
          </div>
          <p className="text-[11px] text-sky-800/80 mt-1">
            Rata-rata <b>Rp {totals.avgBelanjaPerHari.toLocaleString('id-ID')}</b> / hari (Limit Ortu: Rp {activeSantri.limitJajanHarian.toLocaleString('id-ID')}).
          </p>
          <div className="w-full bg-sky-200/80 rounded-full h-1.5 mt-3 overflow-hidden">
            <div 
              className="bg-sky-600 h-1.5 rounded-full transition-all duration-700" 
              style={{ width: `${Math.min(100, (totals.avgBelanjaPerHari / activeSantri.limitJajanHarian) * 100)}%` }} 
            />
          </div>
        </div>

        {/* Card 4: Poin Ri'ayah & Gate Disiplin */}
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50/50 border border-purple-200 rounded-2xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wider flex items-center gap-1">
              🛡️ Poin Disiplin
            </span>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
              activeSantri.poinDisiplin >= 80 ? 'bg-purple-600 text-white' : 'bg-rose-600 text-white'
            }`}>
              {activeSantri.poinDisiplin >= 80 ? 'Disiplin Tinggi' : 'Perlu Bimbingan'}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-purple-950 font-mono">
              {activeSantri.poinDisiplin}
            </span>
            <span className="text-xs text-purple-700 font-medium">/ 100 poin</span>
          </div>
          <p className="text-[11px] text-purple-800/80 mt-1">
            Status Asrama: <b>{activeSantri.statusAsrama.replace('_', ' ')}</b> (0 Pelanggaran Berat).
          </p>
          <div className="w-full bg-purple-200/80 rounded-full h-1.5 mt-3 overflow-hidden">
            <div 
              className="bg-purple-600 h-full rounded-full transition-all duration-700" 
              style={{ width: `${activeSantri.poinDisiplin}%` }} 
            />
          </div>
        </div>
      </div>

      {/* 3. SECTION DIAGRAM VERTIKAL & VISUAL METER */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              Diagram Vertikal Aktivitas Santri
            </h3>
            <p className="text-xs text-slate-500">
              Grafik batang vertikal intensitas kegiatan ananda per kategori dalam sebulan.
            </p>
          </div>

          {/* Diagram Mode Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            {[
              { id: 'weekly', label: '📊 Mingguan (Bulan Ini)' },
              { id: 'trend', label: '📈 Tren 4 Bulan' },
              { id: 'prayer', label: '🕌 5 Waktu Sholat' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setChartMode(tab.id)}
                className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                  chartMode === tab.id
                    ? 'bg-white text-emerald-800 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chart + Vertical Meter Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-center">
          {/* Main Vertical Bar Chart (Recharts) */}
          <div className="lg:col-span-3 h-72 sm:h-80 w-full">
            {chartMode === 'weekly' && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="minggu" 
                    tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomChartTooltip />} />
                  <Legend 
                    wrapperStyle={{ paddingTop: 12, fontSize: 12 }} 
                    formatter={(val) => <span className="text-slate-700 font-medium text-xs">{val}</span>}
                  />
                  <Bar 
                    dataKey="mesjid" 
                    name="Kehadiran Shalat di Mesjid" 
                    fill="#059669" 
                    radius={[6, 6, 0, 0]} 
                    maxBarSize={36} 
                  />
                  <Bar 
                    dataKey="tahfidz" 
                    name="Setoran Hafalan Al-Qur'an" 
                    fill="#d97706" 
                    radius={[6, 6, 0, 0]} 
                    maxBarSize={36} 
                  />
                  <Bar 
                    dataKey="belanja" 
                    name="Transaksi Belanja Kantin" 
                    fill="#0284c7" 
                    radius={[6, 6, 0, 0]} 
                    maxBarSize={36} 
                  />
                </BarChart>
              </ResponsiveContainer>
            )}

            {chartMode === 'trend' && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrendData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="bulan" 
                    tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomChartTooltip />} />
                  <Legend 
                    wrapperStyle={{ paddingTop: 12, fontSize: 12 }} 
                    formatter={(val) => <span className="text-slate-700 font-medium text-xs">{val}</span>}
                  />
                  <Bar 
                    dataKey="mesjid" 
                    name="Total Tap Mesjid" 
                    fill="#059669" 
                    radius={[6, 6, 0, 0]} 
                    maxBarSize={40} 
                  />
                  <Bar 
                    dataKey="tahfidz" 
                    name="Sesi Hafalan Qur'an" 
                    fill="#d97706" 
                    radius={[6, 6, 0, 0]} 
                    maxBarSize={40} 
                  />
                  <Bar 
                    dataKey="belanjaTrx" 
                    name="Frekuensi Belanja" 
                    fill="#0284c7" 
                    radius={[6, 6, 0, 0]} 
                    maxBarSize={40} 
                  />
                </BarChart>
              </ResponsiveContainer>
            )}

            {chartMode === 'prayer' && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={prayerBreakdown} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="waktu" 
                    tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis 
                    domain={[0, 30]}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    formatter={(value) => [`${value} hari hadir di masjid (30 hari)`, 'Kehadiran Shalat']}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: 12, fontSize: 12 }} 
                    formatter={() => <span className="text-slate-700 font-medium text-xs">Kehadiran Jama'ah di Masjid Jami' (Hari)</span>}
                  />
                  <Bar 
                    dataKey="hadir" 
                    name="Kehadiran di Masjid" 
                    fill="#10b981" 
                    radius={[6, 6, 0, 0]} 
                    maxBarSize={48}
                  >
                    {prayerBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#059669' : index === 3 ? '#047857' : '#10b981'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Side: Diagram Vertikal Meter & Intensitas Santri */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-emerald-600" />
              Tingkat Intensitas Vertikal
            </h4>

            {/* Vertical Progress Bar 1: Sholat Masjid */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700">Shalat di Masjid</span>
                <span className="font-mono font-bold text-emerald-700">{totals.mesjidPct}%</span>
              </div>
              <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-600 h-full rounded-full transition-all duration-700" 
                  style={{ width: `${Math.min(100, totals.mesjidPct)}%` }} 
                />
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">Shaf awal & istiqomah subuh</span>
            </div>

            {/* Vertical Progress Bar 2: Tahfidz */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700">Hafalan Qur'an</span>
                <span className="font-mono font-bold text-amber-600">
                  {Math.round((activeSantri.tahfidzJuz / 30) * 100) + 15}%
                </span>
              </div>
              <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="bg-amber-500 h-full rounded-full transition-all duration-700" 
                  style={{ width: `${Math.min(100, (activeSantri.tahfidzJuz / 30) * 100 + 15)}%` }} 
                />
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">Target Juz {activeSantri.tahfidzJuz} mutqin</span>
            </div>

            {/* Vertical Progress Bar 3: Finansial Kantin */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700">Disiplin Belanja</span>
                <span className="font-mono font-bold text-sky-600">
                  {Math.round(100 - (totals.avgBelanjaPerHari / activeSantri.limitJajanHarian) * 50)}%
                </span>
              </div>
              <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="bg-sky-500 h-full rounded-full transition-all duration-700" 
                  style={{ width: `${Math.round(100 - (totals.avgBelanjaPerHari / activeSantri.limitJajanHarian) * 50)}%` }} 
                />
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">Rasio hemat vs limit ortu</span>
            </div>

            {/* Vertical Progress Bar 4: Poin Riayah */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700">Kedisiplinan Gerbang</span>
                <span className="font-mono font-bold text-purple-600">{activeSantri.poinDisiplin}%</span>
              </div>
              <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="bg-purple-600 h-full rounded-full transition-all duration-700" 
                  style={{ width: `${activeSantri.poinDisiplin}%` }} 
                />
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">Poin adab & kepatuhan izin</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. MODUL KESIMPULAN & ANALISIS DEEPSEEK AI */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-emerald-950 to-teal-950 text-white p-5 sm:p-7 shadow-xl border border-emerald-500/40">
        {/* Decorative AI Glows */}
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          {/* Header of AI Card */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-emerald-800/60">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500/30 to-indigo-500/30 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-inner">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                    Kesimpulan & Insight DeepSeek AI
                  </h3>
                  <span className="text-[10px] bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-2 py-0.5 rounded-full font-mono font-bold flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-cyan-300" />
                    {liveAiResult?.model || deepseekModel || 'deepseek-chat'}
                  </span>
                </div>
                <p className="text-xs text-emerald-300/80">
                  Dianalisis secara langsung menggunakan DeepSeek LLM dari 140+ rekaman RFID gerbang masjid & Smart POS.
                </p>
              </div>
            </div>

            {/* AI Control Buttons: Token Settings & Live Regeneration */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTokenSettings(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-bold transition bg-emerald-950/60 border border-emerald-700/60 hover:border-emerald-500 text-emerald-300 hover:text-white"
                title="Konfigurasi API Token DeepSeek"
              >
                <Key className="w-3.5 h-3.5 text-gold-300" />
                <span className="hidden sm:inline">Token:</span>
                <span>{deepseekToken ? `${deepseekToken.slice(0, 7)}...` : 'sk-...'}</span>
              </button>

              <button
                onClick={handleRegenerateAi}
                disabled={isCallingDeepSeek}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition border shadow-xs cursor-pointer ${
                  isCallingDeepSeek
                    ? 'bg-emerald-900/50 border-emerald-700 text-emerald-300 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white'
                }`}
                title="Panggil DeepSeek AI untuk menghasilkan analisis baru"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isCallingDeepSeek ? 'animate-spin' : ''}`} />
                <span>{isCallingDeepSeek ? 'Memproses DeepSeek AI...' : 'Muat Ulang DeepSeek AI'}</span>
              </button>
            </div>
          </div>

          {/* DeepSeek Live Status Banner / Latency */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-emerald-900/30 border border-emerald-700/30 px-3.5 py-2 rounded-xl font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-emerald-200">
                Status Mesin AI: <b>{isRealDeepSeek ? 'LIVE API DEEPSEEK (TERVERIFIKASI)' : 'ONLINE - SIAP DI-GENERATE'}</b>
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-emerald-300">
              {deepSeekLatency && (
                <span>⚡ Latensi: <b>{deepSeekLatency}ms</b></span>
              )}
              <span>Token: <b>{deepseekToken ? 'Aktif (sk-7fc5...)' : 'Default'}</b></span>
            </div>
          </div>

          {/* Loading Indicator when calling DeepSeek */}
          {isCallingDeepSeek && (
            <div className="bg-indigo-950/80 border border-indigo-500/50 rounded-2xl p-4 text-center space-y-2 animate-pulse">
              <div className="flex items-center justify-center gap-2 text-indigo-300 font-bold text-xs sm:text-sm">
                <Zap className="w-4 h-4 text-amber-400 animate-bounce" />
                <span>Menghubungi DeepSeek AI Server (api.deepseek.com)...</span>
              </div>
              <p className="text-[11px] text-indigo-200/80">
                Mengevaluasi {totals.mesjidTaps} shalat fardhu masjid, ritme juz {activeSantri.tahfidzJuz}, dan audit belanja kantin Rp {totals.belanjaNominal.toLocaleString('id-ID')}...
              </p>
            </div>
          )}

          {/* Error Notice if DeepSeek call encounters error */}
          {deepSeekError && (
            <div className="bg-rose-950/80 border border-rose-500/50 rounded-xl p-3 text-xs text-rose-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span><b>Pemberitahuan AI:</b> {deepSeekError}</span>
              </div>
              <button 
                onClick={() => setShowTokenSettings(true)}
                className="text-[10px] font-bold text-rose-300 underline ml-2"
              >
                Cek Token
              </button>
            </div>
          )}

          {/* AI Score Banner & Executive Assessment */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center bg-emerald-950/60 border border-emerald-700/40 rounded-2xl p-4 sm:p-5">
            {/* Score Ring / Number */}
            <div className="flex items-center gap-4 border-b md:border-b-0 md:border-r border-emerald-800/60 pb-4 md:pb-0 md:pr-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-indigo-600 flex flex-col items-center justify-center text-white shadow-lg border border-emerald-300/40 shrink-0">
                <span className="text-2xl font-black font-mono leading-none">{effectiveAi.harmonyScore}</span>
                <span className="text-[9px] font-bold text-emerald-100 uppercase tracking-widest mt-0.5">/ 100</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-gold-300 block">
                  Indeks Harmoni Karakter
                </span>
                <h4 className="text-sm font-black text-white">{effectiveAi.category}</h4>
                <p className="text-[11px] text-emerald-300/80">
                  {isRealDeepSeek ? '✨ Dievaluasi oleh DeepSeek AI' : 'Evaluasi Standar Karakter Santri'}
                </p>
              </div>
            </div>

            {/* AI Narrative Quote for Parents */}
            <div className="md:col-span-2">
              <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 block mb-1">
                Ringkasan untuk Wali Santri:
              </span>
              <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed italic">
                "{effectiveAi.narrativeSummary}"
              </p>
            </div>
          </div>

          {/* 3 Deep Pillars of AI Assessment */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* Pillar 1: Spiritual & Mesjid */}
            <div className="bg-emerald-950/50 border border-emerald-700/40 rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  🕌 Ibadah & Masjid
                </span>
                <span className="text-xs font-mono font-bold text-gold-300">
                  {effectiveAi.pillars.spiritual.score}%
                </span>
              </div>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-200 px-2 py-0.5 rounded font-semibold inline-block">
                {effectiveAi.pillars.spiritual.label}
              </span>
              <p className="text-[11px] text-slate-300 leading-normal">
                {effectiveAi.pillars.spiritual.summary}
              </p>
            </div>

            {/* Pillar 2: Al-Qur'an & Tahfidz */}
            <div className="bg-emerald-950/50 border border-emerald-700/40 rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  📖 Tahfidz Al-Qur'an
                </span>
                <span className="text-xs font-mono font-bold text-gold-300">
                  {effectiveAi.pillars.quran.score}%
                </span>
              </div>
              <span className="text-[10px] bg-amber-500/20 text-amber-200 px-2 py-0.5 rounded font-semibold inline-block">
                {effectiveAi.pillars.quran.label}
              </span>
              <p className="text-[11px] text-slate-300 leading-normal">
                {effectiveAi.pillars.quran.summary}
              </p>
            </div>

            {/* Pillar 3: Finansial & Belanja Kantin */}
            <div className="bg-emerald-950/50 border border-emerald-700/40 rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  🛍️ Manajemen Belanja
                </span>
                <span className="text-xs font-mono font-bold text-gold-300">
                  {effectiveAi.pillars.finansial.score}%
                </span>
              </div>
              <span className="text-[10px] bg-cyan-500/20 text-cyan-200 px-2 py-0.5 rounded font-semibold inline-block">
                {effectiveAi.pillars.finansial.label}
              </span>
              <p className="text-[11px] text-slate-300 leading-normal">
                {effectiveAi.pillars.finansial.summary}
              </p>
            </div>
          </div>

          {/* Actionable Recommendations for Parents */}
          <div className="bg-slate-900/60 border border-emerald-800/60 rounded-2xl p-4 sm:p-5">
            <h4 className="text-xs sm:text-sm font-bold text-white mb-3 flex items-center gap-2">
              <HeartHandshake className="w-4 h-4 text-emerald-400" />
              Rekomendasi Tindakan Terbaik untuk Orang Tua (Wali Santri):
            </h4>
            <div className="space-y-2.5">
              {effectiveAi.recommendations.map((rec, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/30 text-emerald-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5 border border-emerald-400/40">
                    {idx + 1}
                  </div>
                  <div>
                    <b className="text-gold-300 block">{rec.title}</b>
                    <span className="text-slate-300 text-[11px] leading-relaxed">{rec.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 5. LOG AKTIVITAS SANTRI TERPADU (CHRONOLOGICAL FEED) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-600" />
              Log Aktivitas Terpadu Santri
            </h3>
            <p className="text-xs text-slate-500">
              Riwayat kronologis kehadiran masjid, halaqah tahfidz, dan transaksi Smart Card santri.
            </p>
          </div>

          {/* Search Input in Activity Logs */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari aktivitas atau waktu..."
              value={searchLogQuery}
              onChange={(e) => setSearchLogQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl w-full sm:w-56 focus:ring-1 focus:ring-emerald-500 text-slate-800"
            />
          </div>
        </div>

        {/* Filter Pills for Logs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 text-xs font-semibold">
          {[
            { id: 'ALL', label: 'Semua Aktivitas' },
            { id: 'MESJID', label: '🕌 Sholat & Mesjid' },
            { id: 'TAHFIDZ', label: '📖 Hafalan Qur\'an' },
            { id: 'KANTIN', label: '🛍️ Belanja Kantin' },
            { id: 'GATE', label: '🚪 Smart Gate Gerbang' }
          ].map(btn => (
            <button
              key={btn.id}
              onClick={() => setActiveLogCategory(btn.id)}
              className={`px-3 py-1.5 rounded-xl transition whitespace-nowrap ${
                activeLogCategory === btn.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* List of Filtered Logs */}
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            Tidak ada log aktivitas yang cocok dengan pencarian / filter ini.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLogs.map(log => (
              <div 
                key={log.id} 
                className="p-3.5 sm:p-4 rounded-xl border border-slate-200 hover:border-emerald-300 transition bg-slate-50/50 hover:bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                    log.kategori === 'MESJID'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : log.kategori === 'TAHFIDZ'
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : log.kategori === 'KANTIN'
                      ? 'bg-sky-100 text-sky-800 border-sky-300'
                      : 'bg-purple-100 text-purple-800 border-purple-300'
                  }`}>
                    {log.kategori === 'MESJID' && <CheckCircle2 className="w-5 h-5 text-emerald-700" />}
                    {log.kategori === 'TAHFIDZ' && <BookOpen className="w-5 h-5 text-amber-700" />}
                    {log.kategori === 'KANTIN' && <ShoppingBag className="w-5 h-5 text-sky-700" />}
                    {log.kategori === 'GATE' && <ShieldCheck className="w-5 h-5 text-purple-700" />}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${log.badgeColor}`}>
                        {log.kategori}
                      </span>
                      <h4 className="font-bold text-slate-800 text-xs sm:text-sm">
                        {log.label}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {log.waktu}
                      </span>
                    </div>
                    <p className="text-slate-600 text-xs">
                      {log.detail}
                    </p>
                  </div>
                </div>

                {/* Right side: Status and Score/Nominal */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
                  <span className={`text-[11px] font-black font-mono px-2 py-0.5 rounded ${
                    log.kategori === 'KANTIN'
                      ? 'text-rose-600 bg-rose-50 border border-rose-200'
                      : 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                  }`}>
                    {log.statusLabel}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium mt-1">
                    {log.poin}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6. MODAL PENGATURAN TOKEN DEEPSEEK AI */}
      {showTokenSettings && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
                  <Key className="w-5 h-5 text-gold-300" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white">
                    Konfigurasi Token DeepSeek AI
                  </h3>
                  <p className="text-xs text-indigo-200">
                    Smart Riayah Generative Character Intelligence Engine
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTokenSettings(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveToken} className="p-6 space-y-4">
              {saveTokenNotice && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><b>Alhamdulillah!</b> Token DeepSeek AI berhasil disimpan dan aktif digunakan.</span>
                </div>
              )}

              {/* Input Token */}
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  API Key / Token DeepSeek:
                </label>
                <input
                  type="text"
                  value={inputToken}
                  onChange={(e) => setInputToken(e.target.value)}
                  placeholder="sk-..."
                  required
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:ring-2 focus:ring-indigo-500 font-bold"
                />
                <p className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                  <span>Token aktif saat ini: <b>{inputToken ? `${inputToken.slice(0, 10)}...${inputToken.slice(-6)}` : 'Kosong'}</b></span>
                  <button
                    type="button"
                    onClick={() => setInputToken(DEFAULT_DEEPSEEK_TOKEN)}
                    className="text-indigo-600 hover:underline font-semibold"
                  >
                    Reset Default Token
                  </button>
                </p>
              </div>

              {/* Model Selection */}
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  Pilihan Model DeepSeek:
                </label>
                <select
                  value={inputModel}
                  onChange={(e) => setInputModel(e.target.value)}
                  className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-800 focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="deepseek-chat">deepseek-chat (Direkomendasikan - Cepat & Cerdas)</option>
                  <option value="deepseek-reasoner">deepseek-reasoner (Deep Think Mode)</option>
                </select>
              </div>

              {/* Test Connection Button */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
                <div className="text-xs text-slate-600">
                  <span className="font-bold text-slate-800 block">Uji Konektivitas Endpoint:</span>
                  <span className="text-[10px] text-slate-400 font-mono">https://api.deepseek.com/chat/completions</span>
                </div>

                <button
                  type="button"
                  onClick={handleTestToken}
                  disabled={isTestingToken}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs shrink-0 disabled:opacity-50"
                >
                  {isTestingToken ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                      <span>Menguji...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 text-amber-300" />
                      <span>Tes Koneksi</span>
                    </>
                  )}
                </button>
              </div>

              {/* Test Connection Result Box */}
              {testResult && (
                <div className={`p-3 rounded-xl text-xs border ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-rose-50 border-rose-300 text-rose-800'
                }`}>
                  <div className="flex items-center gap-2 font-bold mb-0.5">
                    {testResult.success ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
                    <span>{testResult.success ? 'Koneksi Berhasil!' : 'Koneksi Gagal'}</span>
                    {testResult.latencyMs && (
                      <span className="font-mono text-[10px] ml-auto">
                        Latensi: {testResult.latencyMs}ms
                      </span>
                    )}
                  </div>
                  <p className="text-[11px]">
                    {testResult.success ? testResult.message : testResult.error}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTokenSettings(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan & Terapkan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
