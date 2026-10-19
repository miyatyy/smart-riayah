import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Sparkles, 
  Bot, 
  Send, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Award, 
  ShieldCheck, 
  TrendingUp, 
  RotateCcw, 
  Copy, 
  Check, 
  Printer, 
  Search, 
  Smartphone,
  ChevronDown,
  Info,
  Key,
  Cpu,
  Zap,
  X,
  Share2,
  ExternalLink,
  MessageSquare,
  Activity,
  HeartPulse,
  Radio,
  BookOpen,
  ShoppingBag,
  Sliders
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { sound } from '../../utils/audio';
import { getSantriActivityAnalytics } from '../../data/santriActivityData';
import { 
  DEFAULT_DEEPSEEK_TOKEN, 
  DEFAULT_MODEL, 
  REASONER_MODEL,
  ROLE_PERSPECTIVES,
  generateDeepSeekSantriAnalysis, 
  chatWithDeepSeekAgent,
  testDeepSeekConnection 
} from '../../utils/deepseekApi';

export default function SmartRiayahAiAgentModal() {
  const { 
    isAiAgentOpen, 
    setIsAiAgentOpen, 
    aiAgentActiveSantriId, 
    setAiAgentActiveSantriId,
    santriList,
    role,
    permits,
    medicalRecords,
    disciplineRecords,
    deepseekToken = DEFAULT_DEEPSEEK_TOKEN, 
    setDeepseekToken, 
    deepseekModel = DEFAULT_MODEL, 
    setDeepseekModel,
    sendWhatsAppNotification,
    sendFonnteWhatsApp,
    isFonnteEnabled
  } = useApp();

  const [activeTab, setActiveTab] = useState('evaluasi'); // 'evaluasi' | 'chat' | 'settings'
  const [selectedMonth, setSelectedMonth] = useState('2026-10');
  
  // Target santri
  const activeSantri = santriList.find(s => s.id === aiAgentActiveSantriId) || santriList[0];

  // AI Evaluation State
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [evaluationError, setEvaluationError] = useState(null);
  const [evalLatency, setEvalLatency] = useState(null);
  const [evalTokens, setEvalTokens] = useState(null);
  const [copiedEval, setCopiedEval] = useState(false);
  const [waSentNotice, setWaSentNotice] = useState(false);

  // Chat Agent State
  const [chatMessages, setChatMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Assalamu'alaikum! Saya **Smart Riayah AI Agent** berbasis **DeepSeek AI**.\n\nSaya siap membantu Anda mengevaluasi data diagram aktivitas harian ananda **${activeSantri?.nama || 'Santri'}**, mencakup kedisiplinan shalat di masjid jami', hafalan Al-Qur'an, dan transaksi kantin Smart POS. Ada yang ingin Anda ketahui?`
    }
  ]);
  const [inputChat, setInputChat] = useState('');
  const [isChatTyping, setIsChatTyping] = useState(false);
  const chatBottomRef = useRef(null);

  // Settings State
  const [tokenInput, setTokenInput] = useState(deepseekToken || DEFAULT_DEEPSEEK_TOKEN);
  const [modelInput, setModelInput] = useState(deepseekModel || DEFAULT_MODEL);
  const [isTestingPing, setIsTestingPing] = useState(false);
  const [pingResult, setPingResult] = useState(null);
  const [tokenSavedNotice, setTokenSavedNotice] = useState(false);

  // Perspective info
  const perspective = ROLE_PERSPECTIVES[role] || ROLE_PERSPECTIVES.parent;

  // Auto-scroll chat
  useEffect(() => {
    if (activeTab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatTyping, activeTab]);

  // When active santri changes, update welcome message and reset evaluation result
  useEffect(() => {
    if (activeSantri) {
      setEvaluationResult(null);
      setEvaluationError(null);
      setEvalLatency(null);
      setChatMessages([
        {
          id: `welcome-${activeSantri.id}-${Date.now()}`,
          role: 'assistant',
          content: `Assalamu'alaikum! Saya telah memuat data aktivitas harian santri **${activeSantri.nama}** (Kelas: ${activeSantri.kelas}, Kamar: ${activeSantri.kamar}).\n\nSilakan klik tombol **"⚡ Evaluasi Otomatis Diagram Harian"** atau ajukan pertanyaan spesifik melalui kolom chat di bawah.`
        }
      ]);
    }
  }, [activeSantri?.id]);

  if (!isAiAgentOpen) return null;

  // Compute base analytics from data
  const analytics = getSantriActivityAnalytics(activeSantri, selectedMonth);
  const { weeklyData, prayerBreakdown, totals, aiAnalysis: defaultAi } = analytics || {};

  // Find relevant medical and permit context
  const santriMedical = medicalRecords?.filter(m => m.santriId === activeSantri?.id) || [];
  const latestMed = santriMedical[0];
  const medNotes = latestMed ? `${latestMed.keluhan} (${latestMed.diagnosa})` : '-';
  const santriPermit = permits?.find(p => p.santriId === activeSantri?.id && (p.status === 'ACTIVE' || p.status === 'APPROVED' || p.status === 'PENDING'));
  const permitNotes = santriPermit ? `Izin ${santriPermit.kategori} (${santriPermit.status}) - Kembali: ${santriPermit.batasKembali}` : 'Tidak ada izin aktif';

  // Run Real DeepSeek AI Evaluation
  const handleRunEvaluation = async () => {
    setIsEvaluating(true);
    setEvaluationError(null);
    sound.playBeep?.();

    try {
      const activeTok = deepseekToken || DEFAULT_DEEPSEEK_TOKEN;
      const res = await generateDeepSeekSantriAnalysis({
        santri: activeSantri,
        month: selectedMonth,
        totals,
        prayerBreakdown,
        weeklyData,
        role,
        medicalNotes: medNotes,
        permitsNotes: permitNotes,
        token: activeTok,
        model: deepseekModel || DEFAULT_MODEL
      });

      if (res.success && res.data) {
        setEvaluationResult(res.data);
        setEvalLatency(res.latencyMs);
        setEvalTokens(res.tokensUsed);
        sound.playSuccess?.();
        try {
          confetti({ particleCount: 35, spread: 60, origin: { y: 0.85 } });
        } catch {}
      } else {
        setEvaluationError(res.error || 'Gagal memproses evaluasi DeepSeek. Beralih ke evaluasi lokal.');
        sound.playChime?.();
      }
    } catch (err) {
      setEvaluationError(err.message || 'Terjadi kesalahan saat memanggil DeepSeek API.');
    } finally {
      setIsEvaluating(false);
    }
  };

  // Send message in Chat Tab
  const handleSendChat = async (textToSend) => {
    const query = (textToSend || inputChat).trim();
    if (!query || isChatTyping) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query
    };

    setChatMessages(prev => [...prev, userMsg]);
    setInputChat('');
    setIsChatTyping(true);
    sound.playBeep?.();

    try {
      const activeTok = deepseekToken || DEFAULT_DEEPSEEK_TOKEN;
      const res = await chatWithDeepSeekAgent({
        messages: [...chatMessages, userMsg],
        santri: activeSantri,
        role,
        token: activeTok,
        model: deepseekModel || DEFAULT_MODEL
      });

      if (res.success && res.reply) {
        setChatMessages(prev => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: res.reply,
            latencyMs: res.latencyMs
          }
        ]);
        sound.playSuccess?.();
      } else {
        setChatMessages(prev => [
          ...prev,
          {
            id: `assistant-err-${Date.now()}`,
            role: 'assistant',
            content: `Maaf, terjadi kendala koneksi ke DeepSeek API: ${res.error || 'Server sibuk'}. Mohon periksa token di tab Pengaturan.`
          }
        ]);
      }
    } catch (err) {
      setChatMessages(prev => [
        ...prev,
        {
          id: `assistant-err-${Date.now()}`,
          role: 'assistant',
          content: `Kesalahan jaringan: ${err.message}`
        }
      ]);
    } finally {
      setIsChatTyping(false);
    }
  };

  // Quick Prompt Chips based on current active role
  const getQuickPrompts = () => {
    switch (role) {
      case 'parent':
        return [
          `Bagaimana hafalan Juz ${activeSantri?.tahfidzJuz} dan kehadiran shalat ananda?`,
          `Apakah pengeluaran kantin ananda wajar dan sesuai limit harian?`,
          `Tolong buatkan draf pesan WhatsApp penuh kasih sayang untuk ananda.`
        ];
      case 'musyrif':
        return [
          `Apakah ananda ${activeSantri?.nama} layak diizinkan pesiar akhir pekan besok?`,
          `Bagaimana rekam jejak sholat Subuh dan bangun pagi santri ini?`,
          `Rekomendasi tindakan ta'dib atau apresiasi apa yang paling mendidik?`
        ];
      case 'poskestren':
        return [
          `Apakah keluhan kesehatan santri ada kaitannya dengan pola shalat & belanja kantin?`,
          `Saran pola nutrisi dan istirahat asrama untuk memulihkan kebugaran santri.`,
          `Apakah santri ini perlu pembatasan kegiatan fisik di asrama?`
        ];
      case 'security':
        return [
          `Bagaimana pola jam tap gerbang santri ini saat keluar dan masuk asrama?`,
          `Apakah terdapat indikasi overstay atau risiko keterlambatan jam malam?`,
          `Instruksi apa yang perlu diperhatikan pos satpam saat santri ini tap RFID?`
        ];
      case 'kyai':
        return [
          `Ringkasan eksekutif perkembangan karakter dan adab santri ini secara holistik.`,
          `Seberapa konsisten capaian tahfidz dan ketepatan shaf pertama di masjid?`,
          `Rekomendasi pembinaan pimpinan untuk akselerasi prestasi santri ini.`
        ];
      case 'admin_riayah':
      case 'superadmin':
      default:
        return [
          `Sintesis rekam jejak mutaba'ah, RFID gate, dan smart POS secara terpadu.`,
          `Apakah saldo dan limit harian santri ini memerlukan penyesuaian sistem?`,
          `Buat laporan evaluasi ringkas untuk diarsipkan ke database pondok.`
        ];
    }
  };

  // Copy Evaluation Summary
  const handleCopySummary = () => {
    const data = evaluationResult || defaultAi;
    const textToCopy = `*LAPORAN EVALUASI AI AKTIVITAS SANTRI - SMART RIAYAH*
*Pesantren Modern Darul Ulum*
Periode: ${selectedMonth}
Role Evaluator: ${perspective.title}

Santri: ${activeSantri.nama} (NIS: ${activeSantri.nis}, Kamar: ${activeSantri.kamar})
Skor Harmoni Karakter: ${data.harmonyScore}/100 (${data.category})

Ringkasan AI:
${data.narrativeSummary}

3 Pilar Evaluasi:
- Spiritual (Masjid): ${data.pillars?.spiritual?.score}/100 - ${data.pillars?.spiritual?.summary}
- Tahfidz Qur'an: ${data.pillars?.quran?.score}/100 - ${data.pillars?.quran?.summary}
- Finansial POS: ${data.pillars?.finansial?.score}/100 - ${data.pillars?.finansial?.summary}

Rekomendasi Tindakan:
${data.recommendations?.map((r, i) => `${i + 1}. *${r.title}*: ${r.desc}`).join('\n')}

_Dianalisis secara real-time via DeepSeek AI Agent_`;

    navigator.clipboard.writeText(textToCopy);
    setCopiedEval(true);
    sound.playSuccess?.();
    setTimeout(() => setCopiedEval(false), 3000);
  };

  // Send WhatsApp to Wali Santri
  const handleSendWhatsAppToParent = () => {
    const data = evaluationResult || defaultAi;
    const msg = `*Assalamu'alaikum Wr. Wb. Bapak/Ibu ${activeSantri.wali.nama}*

Berikut adalah ringkasan evaluasi otomatis *AI Agent Smart Riayah (DeepSeek Engine)* untuk ananda *${activeSantri.nama}* di Pondok Pesantren Modern Darul Ulum periode ${selectedMonth}:

📊 *Skor Harmoni Karakter: ${data.harmonyScore}/100* (${data.category})
🕌 *Kehadiran Shalat Masjid:* ${totals?.mesjidTaps || 140} kali (${totals?.mesjidPct || 95}%)
📖 *Hafalan Al-Qur'an:* Juz ${activeSantri.tahfidzJuz} Mutqin
💳 *Rata-rata Belanja Kantin:* Rp ${(totals?.avgBelanjaPerHari || 9500).toLocaleString('id-ID')}/hari (Batas limit: Rp ${activeSantri.limitJajanHarian.toLocaleString('id-ID')})

💡 *Nasihat & Saran Pendampingan Orang Tua:*
${data.recommendations?.[0] ? `• *${data.recommendations[0].title}*: ${data.recommendations[0].desc}` : 'Tetap berikan motivasi dan doa terbaik.'}

Semoga ananda senantiasa istiqomah, sehat, dan berakhlak mulia.

_Hormat kami,_
*Pengasuhan Santri & Wali Kamar Smart Riayah*`;

    if (isFonnteEnabled && sendFonnteWhatsApp) {
      sendFonnteWhatsApp(activeSantri.wali.telepon, msg);
    } else {
      sendWhatsAppNotification?.(
        `${activeSantri.wali.nama} (Wali ${activeSantri.nama})`,
        activeSantri.wali.telepon,
        'AI_EVALUATION',
        msg
      );
    }

    setWaSentNotice(true);
    sound.playSuccess?.();
    setTimeout(() => setWaSentNotice(false), 4500);
  };

  // Test Ping DeepSeek
  const handleTestPing = async () => {
    setIsTestingPing(true);
    setPingResult(null);
    sound.playBeep?.();

    const res = await testDeepSeekConnection(tokenInput, modelInput);
    setIsTestingPing(false);
    setPingResult(res);

    if (res.success) {
      sound.playSuccess?.();
    }
  };

  // Save Settings
  const handleSaveSettings = (e) => {
    e.preventDefault();
    if (setDeepseekToken) setDeepseekToken(tokenInput.trim());
    if (setDeepseekModel) setDeepseekModel(modelInput);
    setTokenSavedNotice(true);
    sound.playSuccess?.();
    setTimeout(() => setTokenSavedNotice(false), 3000);
  };

  const activeAiData = evaluationResult || defaultAi;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto">
        
        {/* MODAL TOP HEADER */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0 border-b border-indigo-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 shadow-md shadow-indigo-500/20 text-white flex items-center justify-center relative">
              <Bot className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2 text-white">
                  Smart Riayah AI Agent
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  {deepseekModel || DEFAULT_MODEL}
                </span>
                <span className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-400/30">
                  Mode: {perspective.title}
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Asisten Cerdas Evaluasi Diagram Daily Activity Santri • DeepSeek API Terintegrasi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAiAgentOpen(false)}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              title="Tutup AI Agent"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SANTRI SELECTOR & ROLE CONTEXT BANNER */}
        <div className="bg-slate-100/90 border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Santri Selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <span>Santri Target:</span>
            </label>
            <div className="relative">
              <select
                value={activeSantri.id}
                onChange={(e) => setAiAgentActiveSantriId(e.target.value)}
                className="bg-white border border-slate-300 text-slate-800 font-bold text-xs rounded-xl px-3 py-1.5 pr-8 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden shadow-2xs"
              >
                {santriList.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.nama} ({s.kelas} - {s.kamar}) • {s.poinDisiplin} Poin
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>

            {/* Quick Status Pill */}
            <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold border ${
              activeSantri.poinDisiplin >= 90
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : activeSantri.poinDisiplin >= 75
                ? 'bg-sky-100 text-sky-800 border-sky-300'
                : 'bg-rose-100 text-rose-800 border-rose-300'
            }`}>
              {activeSantri.poinDisiplin >= 90 ? 'Mumtaz (90+)' : activeSantri.poinDisiplin >= 75 ? 'Jayyid (75+)' : 'Ta\'dib (<75)'}
            </span>
          </div>

          {/* Month Selector & Navigation Tabs */}
          <div className="flex items-center gap-2">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-white border border-slate-300 text-slate-700 font-medium text-xs rounded-xl px-2.5 py-1.5"
            >
              <option value="2026-10">Oktober 2026 (Aktif)</option>
              <option value="2026-09">September 2026</option>
              <option value="2026-08">Agustus 2026</option>
            </select>

            {/* Tabs */}
            <div className="bg-slate-200/80 p-0.5 rounded-xl flex items-center text-xs font-bold">
              <button
                onClick={() => setActiveTab('evaluasi')}
                className={`px-3 py-1 rounded-lg transition ${
                  activeTab === 'evaluasi' 
                    ? 'bg-white text-indigo-900 shadow-2xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Evaluasi Diagram
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`px-3 py-1 rounded-lg transition ${
                  activeTab === 'chat' 
                    ? 'bg-white text-indigo-900 shadow-2xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tanya AI (Chat)
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
                  activeTab === 'settings' 
                    ? 'bg-white text-indigo-900 shadow-2xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Konfigurasi Token DeepSeek"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">API</span>
              </button>
            </div>
          </div>
        </div>

        {/* NOTICES */}
        {waSentNotice && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2.5 text-xs text-emerald-800 flex items-center justify-between font-semibold animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>
                <b>Berhasil Terkirim!</b> Hasil evaluasi AI telah diteruskan ke nomor WhatsApp orang tua ({activeSantri.wali.nama} - {activeSantri.wali.telepon}).
              </span>
            </div>
            <button onClick={() => setWaSentNotice(false)} className="text-emerald-600 hover:text-emerald-900 font-bold">✕</button>
          </div>
        )}

        {tokenSavedNotice && (
          <div className="bg-cyan-50 border-b border-cyan-200 px-4 py-2.5 text-xs text-cyan-800 flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-cyan-600" />
            <span>Pengaturan DeepSeek AI Token dan Model berhasil disimpan!</span>
          </div>
        )}

        {/* MODAL MAIN CONTENT BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50">
          
          {/* TAB 1: EVALUASI DIAGRAM HARIAN */}
          {activeTab === 'evaluasi' && (
            <div className="space-y-5">
              
              {/* Top Quick Activity Snapshot from Diagram */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-100">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                      Data Masukan Diagram Harian
                    </span>
                    <h3 className="text-sm font-bold text-slate-800">
                      Rekap Aktivitas: {activeSantri.nama} • {selectedMonth}
                    </h3>
                  </div>

                  <button
                    onClick={handleRunEvaluation}
                    disabled={isEvaluating}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition disabled:opacity-50"
                  >
                    {isEvaluating ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                        <span>Menganalisis DeepSeek AI...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5 text-amber-300" />
                        <span>⚡ Evaluasi Otomatis (DeepSeek AI)</span>
                      </>
                    )}
                  </button>
                </div>

                {/* 4 Mini Cards representing the diagrams */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl">
                    <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Shalat di Masjid
                    </span>
                    <p className="text-base font-black text-emerald-950 mt-1">
                      {totals?.mesjidTaps || 140} <span className="text-xs font-normal text-emerald-700">waktu</span>
                    </p>
                    <span className="text-[10px] text-emerald-700 font-mono">
                      Subuh: {prayerBreakdown?.[0]?.hadir || 30}/30 hadir
                    </span>
                  </div>

                  <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl">
                    <span className="text-[11px] font-bold text-amber-800 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                      Tahfidz Qur'an
                    </span>
                    <p className="text-base font-black text-amber-950 mt-1">
                      Juz {activeSantri.tahfidzJuz} <span className="text-xs font-normal text-amber-700">Mutqin</span>
                    </p>
                    <span className="text-[10px] text-amber-700 font-mono">
                      {totals?.tahfidzSessions || 28} sesi halaqah
                    </span>
                  </div>

                  <div className="p-3 bg-sky-50/70 border border-sky-200/80 rounded-xl">
                    <span className="text-[11px] font-bold text-sky-800 flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5 text-sky-600" />
                      Smart POS Kantin
                    </span>
                    <p className="text-base font-black text-sky-950 mt-1">
                      Rp {(totals?.avgBelanjaPerHari || 9500).toLocaleString('id-ID')} <span className="text-[10px] font-normal text-sky-700">/hari</span>
                    </p>
                    <span className="text-[10px] text-sky-700 font-mono">
                      Limit Ortu: Rp {activeSantri.limitJajanHarian.toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="p-3 bg-purple-50/70 border border-purple-200/80 rounded-xl">
                    <span className="text-[11px] font-bold text-purple-800 flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-purple-600" />
                      Smart Gate Status
                    </span>
                    <p className="text-base font-black text-purple-950 mt-1">
                      {activeSantri.statusAsrama}
                    </p>
                    <span className="text-[10px] text-purple-700 font-mono truncate block">
                      Disiplin: {activeSantri.poinDisiplin}/100 Poin
                    </span>
                  </div>
                </div>
              </div>

              {/* Error Alert if any */}
              {evaluationError && (
                <div className="bg-rose-50 border border-rose-300 text-rose-800 p-3.5 rounded-2xl text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span><b>Peringatan API:</b> {evaluationError}</span>
                  </div>
                  <button
                    onClick={handleRunEvaluation}
                    className="px-2.5 py-1 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 transition"
                  >
                    Coba Lagi
                  </button>
                </div>
              )}

              {/* AI Evaluation Card */}
              <div className="bg-white rounded-3xl border border-indigo-100 shadow-lg p-5 sm:p-6 relative overflow-hidden">
                {/* Background ambient gradient */}
                <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-indigo-200/30 via-cyan-100/20 to-transparent rounded-full blur-2xl pointer-events-none" />

                {/* Score & Category Header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-4">
                    {/* Circle Score */}
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white flex flex-col items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
                      <span className="text-2xl sm:text-3xl font-black leading-none">
                        {activeAiData.harmonyScore}
                      </span>
                      <span className="text-[9px] uppercase font-bold tracking-wider opacity-80 mt-0.5">
                        Harmoni
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider font-mono">
                          Indeks Karakter AI
                        </span>
                        {evaluationResult ? (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold border border-emerald-300 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                            Live DeepSeek {evalLatency ? `(${evalLatency}ms)` : ''}
                          </span>
                        ) : (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                            Sintesis Cerdas
                          </span>
                        )}
                      </div>
                      <h4 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                        {activeAiData.category}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Evaluasi terintegrasi untuk role <b>{perspective.title}</b>
                      </p>
                    </div>
                  </div>

                  {/* Action Toolbar */}
                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <button
                      onClick={handleCopySummary}
                      className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                    >
                      {copiedEval ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedEval ? 'Tersalin' : 'Salin Teks'}</span>
                    </button>

                    <button
                      onClick={handleSendWhatsAppToParent}
                      className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                      title="Kirimkan hasil evaluasi ini ke nomor WhatsApp orang tua"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>Kirim ke WhatsApp Ortu</span>
                    </button>
                  </div>
                </div>

                {/* Role Specific Highlight Banner if available */}
                {activeAiData.roleSpecificInsight && (
                  <div className="mt-4 p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200/80 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-indigo-900 flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-indigo-600" />
                        {activeAiData.roleSpecificInsight.badge || `Insight Khusus: ${perspective.title}`}
                      </span>
                      {activeAiData.roleSpecificInsight.actionVerdict && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-200/80 text-indigo-900 font-mono">
                          {activeAiData.roleSpecificInsight.actionVerdict}
                        </span>
                      )}
                    </div>
                    <p className="text-indigo-950 font-medium">
                      {activeAiData.roleSpecificInsight.highlight}
                    </p>
                  </div>
                )}

                {/* Narrative Summary */}
                <div className="mt-4 text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200/70">
                  <p className="italic font-serif">
                    "{activeAiData.narrativeSummary}"
                  </p>
                </div>

                {/* 3 Pillars Card */}
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {/* Pillar 1: Spiritual */}
                  <div className="bg-emerald-50/60 border border-emerald-200/70 rounded-2xl p-3.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-emerald-900 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Spiritual & Masjid
                      </span>
                      <span className="text-xs font-mono font-bold text-emerald-700">
                        {activeAiData.pillars?.spiritual?.score || 95}/100
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-800 block mb-1">
                      {activeAiData.pillars?.spiritual?.label || 'Istiqomah'}
                    </span>
                    <p className="text-[11px] text-emerald-950 leading-snug">
                      {activeAiData.pillars?.spiritual?.summary || 'Konsistensi shalat fardhu di masjid terpantau sangat baik.'}
                    </p>
                  </div>

                  {/* Pillar 2: Quran */}
                  <div className="bg-amber-50/60 border border-amber-200/70 rounded-2xl p-3.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                        Tahfidz Al-Qur'an
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-700">
                        {activeAiData.pillars?.quran?.score || 92}/100
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-amber-800 block mb-1">
                      {activeAiData.pillars?.quran?.label || 'Progresif Mutqin'}
                    </span>
                    <p className="text-[11px] text-amber-950 leading-snug">
                      {activeAiData.pillars?.quran?.summary || `Hafalan Juz ${activeSantri.tahfidzJuz} mutqin dengan setoran lancar.`}
                    </p>
                  </div>

                  {/* Pillar 3: Financial */}
                  <div className="bg-sky-50/60 border border-sky-200/70 rounded-2xl p-3.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-sky-900 flex items-center gap-1">
                        <ShoppingBag className="w-3.5 h-3.5 text-sky-600" />
                        Finansial Smart POS
                      </span>
                      <span className="text-xs font-mono font-bold text-sky-700">
                        {activeAiData.pillars?.finansial?.score || 90}/100
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-sky-800 block mb-1">
                      {activeAiData.pillars?.finansial?.label || 'Terkendali & Hemat'}
                    </span>
                    <p className="text-[11px] text-sky-950 leading-snug">
                      {activeAiData.pillars?.finansial?.summary || 'Pengeluaran kantin dan laundry terkendali di bawah batas harian.'}
                    </p>
                  </div>
                </div>

                {/* Recommendations */}
                <div className="mt-5 space-y-2.5">
                  <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    Rekomendasi Tindakan Cerdas (Actionable Steps)
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {activeAiData.recommendations?.map((rec, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs">
                        <div className="flex items-center gap-1.5 text-indigo-900 font-bold mb-1">
                          <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-mono shrink-0">
                            {idx + 1}
                          </span>
                          <span className="truncate">{rec.title}</span>
                        </div>
                        <p className="text-slate-600 text-[11px] leading-relaxed">
                          {rec.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Switch to Chat link */}
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Ingin bertanya lebih rinci tentang diagram ini?</span>
                  <button
                    onClick={() => setActiveTab('chat')}
                    className="font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <span>Buka Chat AI Agent</span>
                    <Bot className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: TANYA AI AGENT (INTERACTIVE CHAT) */}
          {activeTab === 'chat' && (
            <div className="flex flex-col h-[60vh] sm:h-[65vh]">
              
              {/* Quick Prompt Chips */}
              <div className="pb-3 border-b border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Pertanyaan Cepat Sesuai Role ({perspective.title}):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {getQuickPrompts().map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendChat(prompt)}
                      className="text-[11px] bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-300 px-3 py-1.5 rounded-full transition text-left shadow-2xs font-medium"
                    >
                      💡 {prompt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat Messages Feed */}
              <div className="flex-1 overflow-y-auto py-4 space-y-3.5 pr-1">
                {chatMessages.map(msg => {
                  const isUser = msg.role === 'user';
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isUser && (
                        <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                          <Bot className="w-4 h-4" />
                        </div>
                      )}

                      <div
                        className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                          isUser
                            ? 'bg-indigo-600 text-white rounded-br-xs shadow-2xs'
                            : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs shadow-2xs'
                        }`}
                      >
                        <div className="whitespace-pre-line font-sans">
                          {msg.content}
                        </div>

                        {msg.latencyMs && (
                          <div className="mt-1 text-[9px] text-slate-400 font-mono text-right">
                            DeepSeek {msg.latencyMs}ms
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {isChatTyping && (
                  <div className="flex gap-2.5 items-center text-slate-400 text-xs font-mono">
                    <div className="w-7 h-7 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                      <Bot className="w-4 h-4 animate-bounce" />
                    </div>
                    <span className="animate-pulse">DeepSeek AI sedang menyusun jawaban...</span>
                  </div>
                )}

                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendChat();
                }}
                className="pt-3 border-t border-slate-200 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputChat}
                  onChange={(e) => setInputChat(e.target.value)}
                  placeholder={`Tanyakan apa saja seputar aktivitas ananda ${activeSantri.nama}...`}
                  className="flex-1 bg-white border border-slate-300 rounded-2xl px-4 py-2.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                />

                <button
                  type="submit"
                  disabled={!inputChat.trim() || isChatTyping}
                  className="p-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white shadow-md shadow-indigo-500/20 transition shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>

            </div>
          )}

          {/* TAB 3: SETTINGS & DEEPSEEK TOKEN */}
          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto space-y-5">
              
              <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-2xs">
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                  <div className="p-2.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Konfigurasi DeepSeek AI Token & Model
                    </h3>
                    <p className="text-xs text-slate-500">
                      Token API Anda tersimpan aman di browser dan digunakan untuk seluruh evaluasi cerdas di Smart Riayah.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      DeepSeek API Key (Token)
                    </label>
                    <input
                      type="password"
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                      placeholder="sk-..."
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Token default telah dikonfigurasi dengan kuota aktif dari akun Anda.
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Pilihan Model AI
                      </label>
                      <select
                        value={modelInput}
                        onChange={(e) => setModelInput(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold text-slate-800"
                      >
                        <option value="deepseek-chat">deepseek-chat (Cepat, Responsif)</option>
                        <option value="deepseek-reasoner">deepseek-reasoner (Penalaran CoT)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Endpoint Resmi
                      </label>
                      <input
                        type="text"
                        disabled
                        value="https://api.deepseek.com/chat/completions"
                        className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-500"
                      />
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={handleTestPing}
                      disabled={isTestingPing}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl transition flex items-center gap-1.5"
                    >
                      {isTestingPing ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-500" />}
                      <span>Uji Koneksi (Ping Test)</span>
                    </button>

                    <button
                      type="submit"
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition"
                    >
                      Simpan Pengaturan
                    </button>
                  </div>
                </form>

                {/* Ping Result Display */}
                {pingResult && (
                  <div className={`mt-4 p-3.5 rounded-2xl text-xs border ${
                    pingResult.success
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : 'bg-rose-50 border-rose-300 text-rose-900'
                  }`}>
                    <div className="flex items-center gap-2 font-bold">
                      {pingResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
                      <span>{pingResult.success ? 'Koneksi Berhasil!' : 'Koneksi Gagal'}</span>
                      <span className="font-mono text-[10px] ml-auto">
                        Latensi: {pingResult.latencyMs} ms
                      </span>
                    </div>
                    <p className="mt-1 text-[11px]">
                      {pingResult.message || pingResult.error}
                    </p>
                  </div>
                )}
              </div>

              {/* Informational Box */}
              <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-2xl text-xs text-indigo-950 space-y-1.5">
                <span className="font-bold flex items-center gap-1.5 text-indigo-900">
                  <Info className="w-3.5 h-3.5 text-indigo-600" />
                  Karakteristik Agent DeepSeek di Smart Riayah:
                </span>
                <ul className="list-disc pl-4 space-y-1 text-slate-600 text-[11px]">
                  <li>Otomatis membaca diagram RFID shalat masjid, tahfidz mingguan, dan pengeluaran POS kantin.</li>
                  <li>Menghasilkan skor harmoni objektif, kategori capaian santri, dan rekomendasi langkah nyata.</li>
                  <li>Disesuaikan secara cerdas untuk 7 role berbeda di pesantren tanpa perlu input manual.</li>
                </ul>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
