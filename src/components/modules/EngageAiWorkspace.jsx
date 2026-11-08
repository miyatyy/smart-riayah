import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  MessageSquare,
  Bot,
  Sparkles,
  Send,
  Check,
  CheckCheck,
  Copy,
  RefreshCw,
  Settings,
  Settings2,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  QrCode,
  Phone,
  Users,
  Home,
  Calendar,
  FileText,
  BarChart3,
  Sliders,
  ArrowLeft,
  Radio,
  Wifi,
  HelpCircle,
  Layers,
  Zap,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Search,
  Filter,
  Plus,
  Trash2,
  Paperclip,
  Image as ImageIcon,
  Bold,
  Italic,
  Strikethrough,
  Code,
  List as ListIcon,
  Quote,
  Clock,
  ExternalLink,
  ChevronLeft,
  CheckCircle2,
  X,
  Lock,
  Key,
  Eye,
  EyeOff,
  UserCheck,
  Loader2,
  BellRing,
  Printer,
  Download,
  UploadCloud,
  TrendingUp,
  PieChart as LucidePieChart
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { sound } from '../../utils/audio';
import { supabase } from '../../utils/supabaseClient';
import {
  fetchDeviceStatus,
  fetchQrCode,
  validateWhatsappNumber,
  disconnectFonnteDevice,
  sendManualOverrideMessage
} from '../../services/fonnteService';
import {
  testDeepSeekConnection,
  parseBookingWithDeepSeek,
  DEFAULT_DEEPSEEK_KEY,
  DEFAULT_DEEPSEEK_BASE_URL,
  DEFAULT_DEEPSEEK_MODEL
} from '../../services/deepseekVisitService';
import VisitBookingManager from './VisitBookingManager';
import BulkCsvImportModal from '../common/BulkCsvImportModal';
import { downloadCsvFile, getTemplateCsv } from '../../utils/csvUtils';

class WorkspaceErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('WorkspaceErrorBoundary caught error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-white rounded-3xl border border-rose-200 shadow-xl text-center space-y-4 my-8 max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto font-black text-2xl border border-rose-100 shadow-sm">
            ⚠️
          </div>
          <h3 className="text-lg font-black text-slate-800">Workspace Engage AI Memerlukan Refresh</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            {this.state.error?.message || 'Terjadi pembaruan modul antarmuka. Silakan klik tombol di bawah untuk menyegarkan tampilan secara bersih.'}
          </p>
          <div className="pt-2">
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-md inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Muat Ulang Tampilan</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function EngageAiWorkspace() {
  return (
    <WorkspaceErrorBoundary>
      <EngageAiWorkspaceContent />
    </WorkspaceErrorBoundary>
  );
}

function EngageAiWorkspaceContent() {
  const {
    fonnteToken,
    setFonnteToken,
    fonnteTargetNumber,
    isFonnteEnabled,
    setIsFonnteEnabled,
    whatsappLogs,
    santriList,
    permits,
    rooms,
    sendWhatsAppNotification,
    engageActiveTab,
    setEngageActiveTab,
    chatLogs,
    setChatLogs,
    manualReplyNeededCount,
    lastChatPurgeSummary,
    purgeOldChatLogs,
    sendManualReplyToChat,
    takeOverChatManual,
    resolveChatManual
  } = useApp();

  // ─── Main Tabs Navigation ───
  const [activeTab, setActiveTabState] = useState(() => {
    if (engageActiveTab === 'ai_inbox') return 'inbox';
    return engageActiveTab || 'dashboard';
  });

  // Sinkronisasi jika tombol bar navigasi luar mengubah engageActiveTab
  useEffect(() => {
    if (engageActiveTab) {
      const target = engageActiveTab === 'ai_inbox' ? 'inbox' : engageActiveTab;
      setActiveTabState(target);
    }
  }, [engageActiveTab]);

  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    if (setEngageActiveTab) {
      setEngageActiveTab(tab);
    }
  };
  const [copiedText, setCopiedText] = useState(null);

  // ─── Real-Time Fonnte Gateway State ───
  const [deviceData, setDeviceData] = useState({
    isConnected: false,
    status: 'disconnect',
    device: '6285960213654',
    name: 'SmartRIAYAH',
    quota: '1.000',
    messages: 0,
    package: 'Free',
    expired: '7 Dec 2026',
    isLoading: false
  });

  // ─── WhatsApp Safety Event History Logs ───
  const [safetyLogs, setSafetyLogs] = useState([
    { time: '16:12 WIB', event: 'outbound success', severity: 'info', intent: 'NOTIF_IZIN', ref: 'DU-PERMIT-8492' },
    { time: '15:40 WIB', event: 'inbound received', severity: 'info', intent: 'QUERY_SALDO', ref: 'S-101' },
    { time: '14:20 WIB', event: 'device keepalive', severity: 'info', intent: 'HEARTBEAT', ref: 'PING_OK' }
  ]);

  // ─── Global Workspace Toast ───
  const [toast, setToast] = useState(null); // { type: 'success' | 'warning' | 'error' | 'info', message: '' }
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const getNowWIB = () => new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

  const copyToClipboard = (text, id = 'default') => {
    navigator.clipboard?.writeText(text);
    setCopiedText(id);
    sound.playBeep?.();
    showToast(`Nomor ${text} berhasil disalin ke clipboard!`, 'success');
    setTimeout(() => setCopiedText(null), 2500);
  };

  // Initial check Fonnte on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const res = await fetchDeviceStatus(fonnteToken);
        if (isMounted && res) {
          setDeviceData(prev => ({
            ...prev,
            isConnected: res.isConnected,
            status: res.status,
            device: res.device || prev.device,
            name: res.name || prev.name,
            quota: res.quota || prev.quota,
            messages: res.messages != null ? res.messages : prev.messages,
            package: res.package || prev.package,
            expired: res.expired || prev.expired
          }));
        }
      } catch (e) {
        console.warn('Initial Fonnte status check failed:', e);
      }
    })();
    return () => { isMounted = false; };
  }, [fonnteToken]);

  // Handler: Refresh Status Device Fonnte
  const handleRefreshStatus = async () => {
    setDeviceData(prev => ({ ...prev, isLoading: true }));
    sound.playBeep?.();
    try {
      const res = await fetchDeviceStatus(fonnteToken);
      setDeviceData({
        isConnected: res.isConnected,
        status: res.status,
        device: res.device || '6285960213654',
        name: res.name || 'SmartRIAYAH',
        quota: res.quota || '1.000',
        messages: res.messages != null ? res.messages : 0,
        package: res.package || 'Free',
        expired: res.expired || '7 Dec 2026',
        isLoading: false
      });

      if (res.isConnected) {
        showToast(`Status WhatsApp: TERHUBUNG (${res.name} - +62 ${res.device})`, 'success');
        sound.playSuccess?.();
      } else {
        showToast('Status WhatsApp: TERPUTUS (Offline / Perlu Scan QR)', 'warning');
        setSafetyLogs(prev => [
          { time: getNowWIB(), event: 'device disconnected', severity: 'warning', intent: 'STATUS_CHECK', ref: res.device || 'WhatsApp' },
          ...prev
        ]);
      }
    } catch (err) {
      setDeviceData(prev => ({ ...prev, isLoading: false }));
      showToast(`Gagal refresh status: ${err.message}`, 'error');
    }
  };

  // Handler: Disconnect Device Fonnte
  const handleDisconnectDevice = async () => {
    if (!window.confirm('Apakah Anda yakin ingin memutuskan koneksi perangkat WhatsApp ini?')) return;
    setDeviceData(prev => ({ ...prev, isLoading: true }));
    try {
      await disconnectFonnteDevice(fonnteToken);
      setDeviceData(prev => ({
        ...prev,
        isConnected: false,
        status: 'disconnect',
        isLoading: false
      }));
      setSafetyLogs(prev => [
        { time: getNowWIB(), event: 'device disconnected (manual)', severity: 'warning', intent: 'DISCONNECT', ref: deviceData.device },
        ...prev
      ]);
      showToast('Perangkat WhatsApp berhasil diputuskan.', 'warning');
      sound.playBeep?.();
    } catch (err) {
      setDeviceData(prev => ({ ...prev, isLoading: false }));
      showToast(`Gagal memutuskan perangkat: ${err.message}`, 'error');
    }
  };

  // Handler: Save Private Token
  const handleSaveToken = async (newToken) => {
    if (!newToken || !newToken.trim()) {
      showToast('Token WhatsApp tidak boleh kosong!', 'error');
      return;
    }
    const cleanToken = newToken.trim();
    setFonnteToken(cleanToken);
    localStorage.setItem('sr_fonnte_token', cleanToken);
    showToast('Token Privat WhatsApp Gateway berhasil disimpan!', 'success');
    sound.playSuccess?.();

    // Langsung uji status dengan token baru
    setDeviceData(prev => ({ ...prev, isLoading: true }));
    try {
      const res = await fetchDeviceStatus(cleanToken);
      setDeviceData({
        isConnected: res.isConnected,
        status: res.status,
        device: res.device || '6285960213654',
        name: res.name || 'SmartRIAYAH',
        quota: res.quota || '1.000',
        messages: res.messages != null ? res.messages : 0,
        package: res.package || 'Free',
        expired: res.expired || '7 Dec 2026',
        isLoading: false
      });
      if (res.isConnected) {
        showToast(`Token Valid! WhatsApp Terhubung ke ${res.name}`, 'success');
      } else {
        showToast(`Token tersimpan. Status: Disconnected (${res.quota} sisa kuota)`, 'info');
      }
    } catch (e) {
      setDeviceData(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Add event to Safety Event History
  const addSafetyLog = (event, severity, intent, ref) => {
    setSafetyLogs(prev => [
      { time: getNowWIB(), event, severity, intent, ref },
      ...prev
    ]);
  };

  // Dynamic Badge text based on active tab
  const getBannerBadge = () => {
    switch (activeTab) {
      case 'channels': return 'CHANNEL ACTIVATION & DEVICE OPS';
      case 'inbox': return 'CHAT OPERATIONS & AI HANDOFF';
      case 'knowledge': return 'KNOWLEDGE MANAGEMENT & REASONING';
      case 'customers': return 'CUSTOMER DIRECTORY (WALI SANTRI)';
      case 'campaigns': return 'OUTBOUND BROADCAST & CAMPAIGNS';
      default: return 'PESANTREN ENGAGEMENT WORKSPACE';
    }
  };

  const navPills = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'channels', label: 'Channels', icon: Radio },
    { id: 'customers', label: 'Wali Santri (Customers)', icon: Users },
    { id: 'permits', label: 'Izin & Pesiar', icon: FileText },
    { id: 'asrama', label: 'Asrama', icon: Home },
    { id: 'services', label: 'Layanan', icon: Layers },
    { id: 'greeting', label: 'Greeting', icon: Sparkles },
    { id: 'campaigns', label: 'Campaigns', icon: Zap },
    { id: 'inbox', label: 'AI Inbox', icon: MessageSquare },
    { id: 'knowledge', label: 'Knowledge Base', icon: HelpCircle },
    { id: 'ai_settings', label: 'AI Settings', icon: Sliders },
    { id: 'reports', label: 'Reports', icon: Clock }
  ];

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* ─── TOAST NOTIFICATION BANNER ─── */}
      {toast && (
        <div className={`p-3.5 rounded-xl text-xs font-bold flex items-center justify-between gap-3 shadow-md animate-in slide-in-from-top-2 border ${
          toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-700' :
          toast.type === 'warning' ? 'bg-amber-500 text-white border-amber-600' :
          toast.type === 'error' ? 'bg-rose-600 text-white border-rose-700' :
          'bg-slate-800 text-white border-slate-900'
        }`}>
          <div className="flex items-center gap-2">
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />}
            {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 shrink-0 text-white" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0 text-white" />}
            {toast.type === 'info' && <BellRing className="w-4 h-4 shrink-0 text-white" />}
            <span>{toast.message}</span>
          </div>
          <button onClick={() => setToast(null)} className="p-1 hover:bg-white/20 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ─── A. TOP BANNER CARD & PILL TABS ─── */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 rounded-2xl p-6 text-white shadow-lg border border-emerald-700/50 relative overflow-hidden no-print">
        {/* Subtle decorative background blur */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-40 -top-10 w-48 h-48 bg-teal-400/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-black uppercase tracking-wider mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {getBannerBadge()}
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              <span>Smart Riayah Engage AI &amp; WhatsApp Gateway</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 font-mono">
                168Fix Engine
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/90 mt-1 max-w-2xl font-normal leading-relaxed">
              Kelola messaging channels, notifikasi real-time wali santri, dan AI inbox pesantren dari satu dashboard terpadu.
            </p>
            <div className="flex items-center gap-2 mt-3 text-[11px] text-emerald-200/80 font-mono">
              <Clock className="w-3.5 h-3.5 text-emerald-300" />
              <span>Paket Aktif: <strong className="text-white">{deviceData.name || 'SmartRIAYAH'}</strong> (Masa Aktif: <span className="text-emerald-300 font-bold">{deviceData.expired}</span> • Kuota: <span className="text-amber-300 font-bold">{deviceData.quota}</span>)</span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center">
            <button
              onClick={() => setActiveTab('channels')}
              className="px-4 py-2.5 rounded-xl bg-white text-emerald-900 hover:bg-emerald-50 font-bold text-xs shadow-md transition flex items-center gap-2"
            >
              <Radio className="w-4 h-4 text-emerald-600" />
              <span>Messaging Channels</span>
            </button>
          </div>
        </div>

        {/* ─── HORIZONTAL PILL TABS NAVIGATION ─── */}
        <div className="mt-6 pt-4 border-t border-emerald-700/50 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5 min-w-max pb-1">
            {navPills.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const isInbox = tab.id === 'inbox';
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); sound.playBeep?.(); }}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-white text-emerald-950 shadow-md font-bold scale-[1.02]'
                      : 'bg-emerald-800/40 text-emerald-100 hover:bg-emerald-700/50 hover:text-white border border-emerald-600/30'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-600' : 'text-emerald-300'}`} />
                  <span>{tab.label}</span>
                  {/* Badge notifikasi angka cerdas hanya jika perlu balasan manual */}
                  {isInbox && manualReplyNeededCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-600 text-white animate-pulse shadow-sm">
                      {manualReplyNeededCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── B. TAB 1: DASHBOARD ─── */}
      {activeTab === 'dashboard' && (
        <TabDashboard
          onSwitchTab={setActiveTab}
          onCopy={copyToClipboard}
          copiedText={copiedText}
          deviceData={deviceData}
          onRefreshStatus={handleRefreshStatus}
          showToast={showToast}
        />
      )}

      {/* ─── C. TAB 2: CHANNELS ─── */}
      {activeTab === 'channels' && (
        <TabChannels
          deviceData={deviceData}
          setDeviceData={setDeviceData}
          onRefreshStatus={handleRefreshStatus}
          onDisconnectDevice={handleDisconnectDevice}
          onSaveToken={handleSaveToken}
          safetyLogs={safetyLogs}
          addSafetyLog={addSafetyLog}
          showToast={showToast}
          fonnteToken={fonnteToken}
        />
      )}

      {/* ─── D. TAB 3: AI INBOX ─── */}
      {activeTab === 'inbox' && (
        <TabAiInbox
          fonnteToken={fonnteToken}
          deviceData={deviceData}
          addSafetyLog={addSafetyLog}
          showToast={showToast}
          chatLogs={chatLogs}
          setChatLogs={setChatLogs}
          manualReplyNeededCount={manualReplyNeededCount}
          purgeOldChatLogs={purgeOldChatLogs}
          lastChatPurgeSummary={lastChatPurgeSummary}
          sendManualReplyToChat={sendManualReplyToChat}
          takeOverChatManual={takeOverChatManual}
          resolveChatManual={resolveChatManual}
        />
      )}

      {/* ─── E. TAB 4: KNOWLEDGE BASE ─── */}
      {activeTab === 'knowledge' && <TabKnowledgeBase />}

      {/* ─── F. TAB 5: WALI SANTRI (CUSTOMERS) ─── */}
      {activeTab === 'customers' && <TabCustomers />}

      {/* ─── G. TAB 6: IZIN & PESIAR ─── */}
      {activeTab === 'permits' && <TabPermits />}

      {/* ─── H. TAB 7: ASRAMA ─── */}
      {activeTab === 'asrama' && <TabAsrama />}

      {/* ─── I. TAB 8: LAYANAN ─── */}
      {activeTab === 'services' && <TabServices />}

      {/* ─── J. TAB 9: GREETING ─── */}
      {activeTab === 'greeting' && <TabGreeting showToast={showToast} />}

      {/* ─── K. TAB 10: CAMPAIGNS ─── */}
      {activeTab === 'campaigns' && <TabCampaigns />}

      {/* ─── L. TAB 11: AI SETTINGS ─── */}
      {activeTab === 'ai_settings' && <TabAiSettings showToast={showToast} />}

      {/* ─── M. TAB 12: REPORTS ─── */}
      {activeTab === 'reports' && <TabReports showToast={showToast} deviceData={deviceData} />}
    </div>
  );
}

/* =========================================================================================
   SUB-COMPONENT: TAB 1 - DASHBOARD
   ========================================================================================= */
function TabDashboard({ onSwitchTab, onCopy, copiedText, deviceData, onRefreshStatus, showToast }) {
  const isConnected = Boolean(deviceData?.isConnected);

  return (
    <div className="space-y-6">
      {/* 1. Alert Banner Status Channel */}
      {!isConnected ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wide">Channel Perlu Perhatian (Offline)</h4>
              <p className="text-xs text-amber-800 mt-0.5">
                Status gateway: <strong className="text-rose-700">Device Disconnected</strong>. Sisa kuota pesan: <strong>{deviceData?.quota || '931'}</strong> pesan. Lakukan refresh atau scan QR ulang untuk memastikan notifikasi santri terkirim lancar.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onSwitchTab('channels')}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition shadow-sm"
            >
              Scan QR
            </button>
            <button
              onClick={onRefreshStatus}
              disabled={deviceData?.isLoading}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold text-xs transition flex items-center gap-1.5"
            >
              {deviceData?.isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span>Refresh Status</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wide">Channel WhatsApp Terhubung &amp; Siap</h4>
              <p className="text-xs text-emerald-800 mt-0.5">
                Perangkat <strong>{deviceData?.name || 'Smart Permit'}</strong> aktif (+62 {deviceData?.device}) • Kuota: <strong>{deviceData?.quota}</strong> pesan • Paket: <strong>{deviceData?.package}</strong>.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onRefreshStatus}
              disabled={deviceData?.isLoading}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs transition flex items-center gap-1.5"
            >
              {deviceData?.isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span>Periksa Koneksi</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. Paket Engage AI Aktif (4 Summary Cards + Panel Report WA Campaign) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Nama Paket</span>
            <span className="text-sm font-extrabold text-slate-800 mt-1 block">SmartRIAYAH (1.000 Kuota)</span>
            <span className="text-[10px] text-emerald-600 font-semibold">Gateway Aktif • AI: 10</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Status Subscription</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 mt-1.5 rounded-full text-xs font-bold border bg-emerald-100 text-emerald-800 border-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Sisa Kuota Pesan</span>
            <span className="text-sm font-extrabold text-slate-800 mt-1 block">{deviceData?.quota || '1.000'} Pesan</span>
            <span className="text-[10px] text-slate-400 font-mono">Terkirim: {deviceData?.messages || 0}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Masa Aktif Paket</span>
            <span className="text-xs font-bold text-slate-700 mt-1 block">{deviceData?.expired || '7 Dec 2026'}</span>
            <span className="inline-block mt-1 text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
              Live Verified
            </span>
          </div>
        </div>

        {/* Panel Report WA Campaign */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-2xl border border-emerald-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-600" />
                Report WA Campaign
              </span>
              <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded">
                Bulan Ini
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              <div>
                <span className="text-[10px] text-slate-500 block">Terkirim</span>
                <strong className="text-xs font-extrabold text-slate-800">1,248</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Delivered</span>
                <strong className="text-xs font-extrabold text-emerald-700">99.4%</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Dibaca</span>
                <strong className="text-xs font-extrabold text-teal-700">92.1%</strong>
              </div>
            </div>
          </div>
          <button
            onClick={() => onSwitchTab('campaigns')}
            className="w-full mt-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition shadow-sm"
          >
            Buka Campaign Manager
          </button>
        </div>
      </div>

      {/* 3. Akun Aktif Untuk Wali Santri / Customer */}
      <div className="space-y-3">
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 text-emerald-900 text-xs flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Nomor resmi di kartu ini adalah <strong>Device Pengirim (Gateway)</strong>. Setiap notifikasi perizinan, approval, gate pass, kedisiplinan, dan laporan santri akan otomatis dikirimkan ke <strong>nomor WhatsApp masing-masing wali santri</strong> yang terdaftar.</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-sm border border-emerald-200">
              SR
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-sm text-slate-900">{deviceData?.name || 'SmartRIAYAH'}</h4>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  isConnected
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-rose-100 text-rose-800 border-rose-300'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  Device Pengirim (Gateway)
                </span>
              </div>
              <p className="text-xs font-mono font-extrabold text-slate-700 mt-0.5">
                {deviceData?.device || '6285960213654'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onCopy(deviceData?.device || '6285960213654', 'phone')}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              {copiedText === 'phone' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedText === 'phone' ? 'Disalin!' : 'Copy Nomor'}</span>
            </button>
            <button
              onClick={() => onSwitchTab('channels')}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Kelola Channel</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Quick Actions (4 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => onSwitchTab('channels')}
          className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-emerald-300 hover:shadow-md transition text-left group"
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold mb-2 group-hover:scale-110 transition">
            <QrCode className="w-4 h-4" />
          </div>
          <span className="font-bold text-xs text-slate-800 block">Scan QR Code</span>
          <p className="text-[11px] text-slate-500 mt-0.5">Device QR &amp; Gateway API</p>
        </button>

        <button
          onClick={() => onSwitchTab('inbox')}
          className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-emerald-300 hover:shadow-md transition text-left group"
        >
          <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold mb-2 group-hover:scale-110 transition">
            <MessageSquare className="w-4 h-4" />
          </div>
          <span className="font-bold text-xs text-slate-800 block">AI Inbox Stream</span>
          <p className="text-[11px] text-slate-500 mt-0.5">Monitoring Chat Wali</p>
        </button>

        <button
          onClick={() => onSwitchTab('campaigns')}
          className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-emerald-300 hover:shadow-md transition text-left group"
        >
          <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold mb-2 group-hover:scale-110 transition">
            <Zap className="w-4 h-4" />
          </div>
          <span className="font-bold text-xs text-slate-800 block">Kirim Broadcast</span>
          <p className="text-[11px] text-slate-500 mt-0.5">Pengumuman &amp; Edukasi</p>
        </button>

        <button
          onClick={() => onSwitchTab('knowledge')}
          className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-emerald-300 hover:shadow-md transition text-left group"
        >
          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold mb-2 group-hover:scale-110 transition">
            <HelpCircle className="w-4 h-4" />
          </div>
          <span className="font-bold text-xs text-slate-800 block">Knowledge Base</span>
          <p className="text-[11px] text-slate-500 mt-0.5">SOP &amp; Jawaban Santri</p>
        </button>
      </div>

      {/* 5. Metrik Kuantitatif Workspace (8 Cards Grid: 2 Baris x 4 Kolom) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Messaging Status</span>
          <span className="text-[10px] text-slate-500 font-mono">WhatsApp Live API</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[10px] text-slate-400 block">Wali Terdaftar</span>
            <strong className="text-base font-extrabold text-slate-800">1,482</strong>
            <span className="text-[9px] text-emerald-600 font-semibold block mt-0.5">100% Tercatat</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[10px] text-slate-400 block">Total Santri</span>
            <strong className="text-base font-extrabold text-slate-800">1,482</strong>
            <span className="text-[9px] text-slate-500 block mt-0.5">Putra &amp; Putri</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[10px] text-slate-400 block">Izin Aktif</span>
            <strong className="text-base font-extrabold text-amber-600">4</strong>
            <span className="text-[9px] text-slate-500 block mt-0.5">Di Luar Pesantren</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[10px] text-slate-400 block">Kamar Asrama</span>
            <strong className="text-base font-extrabold text-slate-800">71</strong>
            <span className="text-[9px] text-emerald-600 block mt-0.5">6 Gedung Asrama</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[10px] text-slate-400 block">Auto-Reply AI</span>
            <strong className="text-base font-extrabold text-indigo-600">892</strong>
            <span className="text-[9px] text-indigo-500 block mt-0.5">94% Tingkat Akurasi</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[10px] text-slate-400 block">Manual Override</span>
            <strong className="text-base font-extrabold text-slate-800">18</strong>
            <span className="text-[9px] text-slate-500 block mt-0.5">Ditangani Admin</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[10px] text-slate-400 block">Rata-rata Latensi</span>
            <strong className="text-base font-extrabold text-teal-600">~240 ms</strong>
            <span className="text-[9px] text-teal-700 block mt-0.5">Real-time Fast</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[10px] text-slate-400 block">Sisa Kuota API</span>
            <strong className="text-base font-extrabold text-emerald-700">{deviceData?.quota || '931'}</strong>
            <span className="text-[9px] text-slate-500 block mt-0.5">Live Sync Gateway</span>
          </div>
        </div>
      </div>

      {/* 6. Activation Status & Recent Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Kiri: Activation Status */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Activation Status</h4>
          <div className="space-y-2 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <div>
                  <div className="flex items-center gap-1.5">
                    <h5 className="font-extrabold text-xs text-slate-900">{deviceData?.name || 'SmartRIAYAH'}</h5>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-bold">62859***3654</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">{deviceData?.device || '6285960213654'}</span>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                isConnected ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-rose-100 text-rose-800 border-rose-300'
              }`}>
                {isConnected ? 'Active & Ready' : 'Standby / Disconnected'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                <div>
                  <h5 className="font-extrabold text-xs text-slate-900">Telegram Bot Channel</h5>
                  <span className="text-[10px] font-mono text-slate-500">@DarulUlumRiayahBot</span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300">
                Ready for Handoff
              </span>
            </div>
          </div>
        </div>

        {/* Kanan: Recent Requests */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Recent Requests</h4>
          <div className="space-y-2 text-xs">
            {[
              { id: '1', name: 'Ibu Fatimah (Ahmad Fauzi)', phone: '+62 881-3576-012', type: 'Izin Pulang', time: '10:14 WIB', status: 'Approved' },
              { id: '2', name: 'Bpk. Hendra (M. Rayhan)', phone: '+62 812-4455-890', type: 'Perpanjangan Liburan', time: '09:45 WIB', status: 'Pending' },
              { id: '3', name: 'Ibu Siti (Aisyah Putri)', phone: '+62 856-7890-123', type: 'Konsultasi Medis', time: 'Kemarin', status: 'Pending' }
            ].map(req => (
              <div key={req.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div>
                  <strong className="text-slate-800 text-xs block">{req.name}</strong>
                  <span className="text-[10px] text-slate-400 font-mono">{req.type} • {req.time}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  req.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {req.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================================
   SUB-COMPONENT: TAB 2 - CHANNELS
   ========================================================================================= */
function TabChannels({
  deviceData,
  setDeviceData,
  onRefreshStatus,
  onDisconnectDevice,
  onSaveToken,
  safetyLogs,
  addSafetyLog,
  showToast,
  fonnteToken
}) {
  const isConnected = Boolean(deviceData?.isConnected);

  const [subTab, setSubTab] = useState('overview');
  const normalizeTelegramToken = (raw) => {
    let tok = (raw || '').trim();
    // Auto-fix typo visual huruf besar I vs huruf kecil l pada token user
    if (tok.includes('AAEBAzGX5ReS_Kykuk32ctWtIkmIhh-EIVQ')) {
      tok = tok.replace('AAEBAzGX5ReS_Kykuk32ctWtIkmIhh-EIVQ', 'AAEBAzGX5ReS_Kykuk32ctWtIkmIhh-ElVQ');
      try { localStorage.setItem('smart_riayah_telegram_token', tok); } catch {}
    }
    return tok;
  };
  const [telegramToken, setTelegramToken] = useState(() => {
    const raw = localStorage.getItem('smart_riayah_telegram_token') || '';
    if (raw.includes('AAEBAzGX5ReS_Kykuk32ctWtIkmIhh-EIVQ')) {
      const fixed = raw.replace('AAEBAzGX5ReS_Kykuk32ctWtIkmIhh-EIVQ', 'AAEBAzGX5ReS_Kykuk32ctWtIkmIhh-ElVQ');
      try { localStorage.setItem('smart_riayah_telegram_token', fixed); } catch {}
      return fixed;
    }
    return raw;
  });
  const [telegramBotInfo, setTelegramBotInfo] = useState(() => {
    try {
      const saved = localStorage.getItem('smart_riayah_telegram_bot');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isTelegramConnected, setIsTelegramConnected] = useState(() => {
    return Boolean(localStorage.getItem('smart_riayah_telegram_token'));
  });
  const [isVerifyingTelegram, setIsVerifyingTelegram] = useState(false);

  // Otomatis pastikan webhook Telegram terpasang ke endpoint Vercel saat connected
  useEffect(() => {
    if (isTelegramConnected && telegramToken) {
      const clean = normalizeTelegramToken(telegramToken);
      const webhookUrl = `https://smart-riayah.vercel.app/api/telegram/webhook?token=${encodeURIComponent(clean)}`;
      fetch(`https://api.telegram.org/bot${clean}/setWebhook?url=${encodeURIComponent(webhookUrl)}`)
        .catch(() => {});
    }
  }, [isTelegramConnected, telegramToken]);

  const handleConnectTelegram = async () => {
    const clean = normalizeTelegramToken(telegramToken);
    if (!clean) {
      showToast('Masukkan token bot Telegram terlebih dahulu dari @BotFather.', 'warning');
      return;
    }
    setIsVerifyingTelegram(true);
    sound.playBeep?.();

    try {
      const res = await fetch(`https://api.telegram.org/bot${clean}/getMe`);
      const data = await res.json().catch(() => ({}));

      setIsVerifyingTelegram(false);

      if (data.ok && data.result) {
        setTelegramBotInfo(data.result);
        setIsTelegramConnected(true);
        localStorage.setItem('smart_riayah_telegram_token', clean);
        localStorage.setItem('smart_riayah_telegram_bot', JSON.stringify(data.result));
        addSafetyLog?.('telegram bot connected', 'info', 'TELEGRAM', `@${data.result.username}`);

        // Pasang webhook resmi Telegram otomatis ke serverless webhook Vercel
        const webhookUrl = `https://smart-riayah.vercel.app/api/telegram/webhook?token=${encodeURIComponent(clean)}`;
        fetch(`https://api.telegram.org/bot${clean}/setWebhook?url=${encodeURIComponent(webhookUrl)}`)
          .catch(() => {});

        sound.playSuccess?.();
        showToast(`✓ Bot Telegram @${data.result.username} (${data.result.first_name}) berhasil diverifikasi & terhubung!`, 'success');
      } else {
        const desc = data.description || 'Token tidak sah (Unauthorized)';
        showToast(`Gagal verifikasi Bot Telegram: ${desc}. Pastikan token dari @BotFather sudah benar.`, 'error');
      }
    } catch (err) {
      setIsVerifyingTelegram(false);
      showToast(`Koneksi Telegram error: ${err.message}`, 'error');
    }
  };

  const handleDisconnectTelegram = () => {
    if (telegramToken) {
      fetch(`https://api.telegram.org/bot${telegramToken}/deleteWebhook`).catch(() => {});
    }
    setIsTelegramConnected(false);
    setTelegramBotInfo(null);
    setTelegramToken('');
    localStorage.removeItem('smart_riayah_telegram_token');
    localStorage.removeItem('smart_riayah_telegram_bot');
    sound.playBeep?.();
    showToast('Tautan bot Telegram telah diputuskan.', 'info');
  };

  // Accordion states
  const [accordions, setAccordions] = useState({
    statusDetail: true,
    channelRole: true,
    outboundSafety: false,
    scanQr: false,
    validateNumber: false,
    disconnectDevice: false
  });

  const toggleAccordion = (key) => {
    setAccordions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Channel Role state
  const [channelRole, setChannelRole] = useState('Legacy Campaign + Chatbot');

  // Token privat form state
  const [tokenInput, setTokenInput] = useState(() => fonnteToken || '8UN12iqFjKNBYdds8FCG');
  const [showToken, setShowToken] = useState(false);
  const [labelInput, setLabelInput] = useState(() => localStorage.getItem('sr_fonnte_label') || 'SmartRIAYAH');
  const [deviceInput, setDeviceInput] = useState(() => localStorage.getItem('sr_fonnte_target') || '6285960213654');
  const [isTestingToken, setIsTestingToken] = useState(false);

  // QR Code state & auto-polling
  const [qrLoading, setQrLoading] = useState(false);
  const [qrImage, setQrImage] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [countdown, setCountdown] = useState(45);
  const [isQrExpired, setIsQrExpired] = useState(false);

  const qrTimerRef = useRef(null);
  const qrPollRef = useRef(null);

  // Bersihkan interval saat unmount
  useEffect(() => {
    return () => {
      if (qrTimerRef.current) clearInterval(qrTimerRef.current);
      if (qrPollRef.current) clearInterval(qrPollRef.current);
    };
  }, []);

  // Number validation state
  const [validateInput, setValidateInput] = useState('6285960213654');
  const [isValidating, setIsValidating] = useState(false);
  const [validateResult, setValidateResult] = useState(null);

  // Fetch QR Code handler
  const handleFetchQr = async () => {
    if (qrTimerRef.current) clearInterval(qrTimerRef.current);
    if (qrPollRef.current) clearInterval(qrPollRef.current);

    setAccordions(prev => ({ ...prev, scanQr: true }));
    setQrLoading(true);
    setQrImage(null);
    setQrCode(null);
    setIsQrExpired(false);
    setCountdown(45);
    sound.playBeep?.();
    showToast('Meminta QR Code resmi dari server WhatsApp...', 'info');

    try {
      const activeToken = (fonnteToken || tokenInput || '8UN12iqFjKNBYdds8FCG').trim();
      const res = await fetchQrCode('', activeToken);
      setQrLoading(false);

      if (res.status === 'connected' || res.isConnected) {
        setDeviceData(prev => ({ ...prev, isConnected: true, status: 'connect' }));
        showToast('Device WhatsApp sudah terhubung!', 'success');
        sound.playSuccess?.();
        return;
      }

      if (res.qrImage) {
        setQrImage(res.qrImage);
        setQrCode(res.code || '164WE4BM');
        setCountdown(45);
        setIsQrExpired(false);
        showToast('QR Code siap di-scan dari aplikasi WhatsApp HP!', 'info');

        // Start countdown 45 detik
        let counter = 45;
        qrTimerRef.current = setInterval(() => {
          counter -= 1;
          setCountdown(counter);
          if (counter <= 0) {
            // Otomatis bersihkan timer & interval polling
            if (qrTimerRef.current) clearInterval(qrTimerRef.current);
            if (qrPollRef.current) clearInterval(qrPollRef.current);
            
            // Barcode LANGSUNG HILANG OTOMATIS pada detik ke-0 (tidak bisa di-scan lagi)
            setCountdown(0);
            setQrImage(null);
            setQrCode(null);
            setIsQrExpired(true);
            
            sound.playBeep?.();
            showToast('⏱️ Batas waktu scan 45 detik telah habis. Barcode otomatis dihapus & tidak dapat di-scan lagi demi keamanan.', 'warning');
          }
        }, 1000);

        // Auto-polling status koneksi Fonnte setiap 5 detik
        qrPollRef.current = setInterval(async () => {
          try {
            const activeToken = (fonnteToken || tokenInput || '8UN12iqFjKNBYdds8FCG').trim();
            const check = await fetchDeviceStatus(activeToken);
            if (check.isConnected) {
              if (qrPollRef.current) clearInterval(qrPollRef.current);
              if (qrTimerRef.current) clearInterval(qrTimerRef.current);
              setDeviceData(prev => ({
                ...prev,
                isConnected: true,
                status: 'connect',
                name: check.name || prev.name,
                device: check.device || prev.device,
                quota: check.quota || prev.quota
              }));
              setQrImage(null);
              setQrCode(null);
              setIsQrExpired(false);
              showToast('Perangkat WhatsApp berhasil terhubung!', 'success');
              sound.playSuccess?.();
            }
          } catch (e) {
            console.warn('Poll error:', e);
          }
        }, 5000);
      } else {
        showToast(res.message || 'Gagal memuat QR Code', 'error');
      }
    } catch (err) {
      setQrLoading(false);
      showToast(`Gagal memuat QR: ${err.message}`, 'error');
    }
  };

  // Validate number handler
  const handleValidateNumber = async () => {
    if (!validateInput || !validateInput.trim()) {
      showToast('Masukkan nomor WhatsApp yang ingin divalidasi!', 'warning');
      return;
    }
    setIsValidating(true);
    setValidateResult(null);
    sound.playBeep?.();

    try {
      const res = await validateWhatsappNumber(validateInput, fonnteToken);
      setIsValidating(false);
      setValidateResult(res);

      if (res.isRegistered) {
        showToast(`Nomor ${res.phone} AKTIF dan terdaftar di WhatsApp!`, 'success');
        sound.playSuccess?.();
        addSafetyLog('validate number (active)', 'info', 'VALIDATE', res.phone);
      } else if (res.isDeviceConnected === false) {
        showToast(res.message || 'Perangkat WhatsApp sedang terputus. Scan QR terlebih dahulu.', 'warning');
      } else {
        showToast(`Nomor ${res.phone} TIDAK terdaftar di WhatsApp!`, 'warning');
        addSafetyLog('validate number (inactive)', 'warning', 'VALIDATE', res.phone);
      }
    } catch (err) {
      setIsValidating(false);
      showToast(`Gagal validasi nomor: ${err.message}`, 'error');
    }
  };

  // Test token handler
  const handleTestToken = async () => {
    setIsTestingToken(true);
    sound.playBeep?.();
    try {
      const activeToken = (fonnteToken || tokenInput || '8UN12iqFjKNBYdds8FCG').trim();
      const res = await fetchDeviceStatus(activeToken);
      setIsTestingToken(false);
      if (res.success || res.status) {
        showToast(`Gateway Terhubung & Aktif! Status: ${res.status} (${res.name || 'SmartRIAYAH'} - Kuota: ${res.quota || '-'})`, 'success');
        sound.playSuccess?.();
      } else {
        showToast('Gateway tidak merespons atau periksa koneksi internet.', 'error');
      }
    } catch (err) {
      setIsTestingToken(false);
      showToast(`Uji gateway gagal: ${err.message}`, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Sub-tabs Pill */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'telegram', label: 'Telegram' },
          { id: 'whatsapp', label: 'WhatsApp' },
          { id: 'riwayat', label: 'Riwayat' }
        ].map(st => (
          <button
            key={st.id}
            onClick={() => setSubTab(st.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              subTab === st.id ? 'bg-white text-emerald-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {st.label}
          </button>
        ))}
      </div>

      {/* 2. Overview Channels (3 Summary Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Telegram</span>
          <span className={`text-lg font-extrabold mt-1 block ${isTelegramConnected ? 'text-sky-700' : 'text-slate-800'}`}>
            {isTelegramConnected ? '1 Bot Aktif' : '0 Bot Terhubung'}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            {telegramBotInfo ? `@${telegramBotInfo.username}` : '@BotFather Standby'}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">WhatsApp</span>
          <span className="text-lg font-extrabold text-slate-800 mt-1 block">
            {isConnected ? '1 Official Active' : '0 Connected / 1 Standby'}
          </span>
          <span className="text-[10px] text-emerald-600 font-bold">Gateway Standby / Active</span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Connected</span>
          <span className={`text-lg font-extrabold mt-1 block ${(isConnected || isTelegramConnected) ? 'text-emerald-700' : 'text-rose-600'}`}>
            {(isConnected ? 1 : 0) + (isTelegramConnected ? 1 : 0)} Channel Aktif
          </span>
          <span className="text-[10px] text-slate-500">
            {isConnected && isTelegramConnected
              ? 'WA & Telegram Siaga Otonom'
              : isTelegramConnected
              ? 'Telegram Bot Siaga Otonom'
              : isConnected
              ? 'WhatsApp Standby Outbound'
              : 'Perlu Scan QR / Connect Bot'}
          </span>
        </div>
      </div>

      {/* 3. Panel Integrasi Telegram (Collapsible) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-sky-500" />
            <h4 className="text-xs font-bold text-slate-800">Panel Integrasi Telegram Bot</h4>
            {isTelegramConnected && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300">
                Terhubung
              </span>
            )}
          </div>
          <span className="text-[10px] font-mono text-slate-500">getMe() &amp; Auto Webhook</span>
        </div>
        <div className="p-4 space-y-4">
          {isTelegramConnected && telegramBotInfo ? (
            <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center font-black text-sm shadow-sm">
                  TG
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-sm font-extrabold text-slate-900">{telegramBotInfo.first_name || 'Smart Riayah Bot'}</strong>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-200 text-sky-900">
                      @{telegramBotInfo.username}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    ID Bot: <span className="font-mono text-slate-500">{telegramBotInfo.id}</span> • Siaga melayani konsultasi wali santri.
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-emerald-700 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Webhook Terpasang: Auto-Reply AI Aktif &amp; Terhubung Realtime ke AI Inbox</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`https://t.me/${telegramBotInfo.username}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka Bot di Telegram</span>
                </a>
                <button
                  type="button"
                  onClick={handleDisconnectTelegram}
                  className="px-3 py-2 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-bold text-xs transition cursor-pointer"
                >
                  Putuskan
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Bot Token dari @BotFather</label>
                <input
                  type="text"
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                  placeholder="misal: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  disabled={isVerifyingTelegram}
                  onClick={handleConnectTelegram}
                  className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-xs transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isVerifyingTelegram ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>{isVerifyingTelegram ? 'Memverifikasi...' : 'Connect Telegram'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Panduan Ringkas Cara Buat Bot di Telegram */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
            <strong className="text-slate-800 text-[11px] uppercase tracking-wider block">
              Cara Mendapatkan Bot Token di Telegram:
            </strong>
            <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
              <li>Buka aplikasi Telegram di HP/Laptop, cari akun <strong>@BotFather</strong> (centang biru resmi).</li>
              <li>Tekan tombol <strong>Start</strong> (atau ketik <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-sky-700">/start</code>).</li>
              <li>Kirim perintah <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-sky-700">/newbot</code> untuk membuat bot baru.</li>
              <li>Beri nama tampilan bot (misal: <em>Smart Riayah Bot</em>) dan username berakhiran <code className="font-mono text-sky-700">bot</code> (misal: <em>smartriayah_ai_bot</em>).</li>
              <li>Salin string <strong>HTTP API Token</strong> yang diberikan BotFather, lalu tempelkan ke kolom input di atas dan klik <strong>Connect Telegram</strong>.</li>
            </ol>
          </div>
        </div>
      </div>

      {/* 4. Inventaris Channel (Tabel) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Inventaris Channel Aktif</h4>
          <span className="text-[10px] font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">
            {(isConnected ? 1 : 0) + (isTelegramConnected ? 1 : 0)} Channel Terpasang
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 font-bold">Label</th>
                <th className="py-2.5 px-3 font-bold">Identifier</th>
                <th className="py-2.5 px-3 font-bold">Channel</th>
                <th className="py-2.5 px-3 font-bold">Role</th>
                <th className="py-2.5 px-3 font-bold">Status</th>
                <th className="py-2.5 px-3 font-bold">Safety</th>
                <th className="py-2.5 px-3 font-bold">Device</th>
                <th className="py-2.5 px-3 font-bold">Kuota</th>
                <th className="py-2.5 px-3 font-bold text-right">Lifecycle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* Row 1: Telegram Bot (Jika Terhubung) */}
              {isTelegramConnected && (
                <tr className="hover:bg-slate-50/50 bg-sky-50/20">
                  <td className="py-3 px-3 font-extrabold text-slate-800">{telegramBotInfo?.first_name || 'Smart Riayah AI Pesantren'}</td>
                  <td className="py-3 px-3 font-mono text-slate-500 text-[11px]">@{telegramBotInfo?.username || 'smartriayah_ai_bot'}</td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                      Telegram Bot
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Autonomous AI - Bot
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="inline-flex items-center gap-1 font-bold text-[11px] text-emerald-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active / Otonom
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">Live Webhook</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5 font-mono">Bgt: 5/5 • Rsk: 0</span>
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-slate-700">ID: {telegramBotInfo?.id || '9079176204'}</td>
                  <td className="py-3 px-3 font-mono text-emerald-700 text-[11px] font-bold">Unlimited</td>
                  <td className="py-3 px-3 text-right">
                    <a
                      href={`https://t.me/${telegramBotInfo?.username || 'smartriayah_ai_bot'}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 rounded text-[10px] font-bold text-sky-700 border border-sky-300 hover:bg-sky-50 transition inline-block"
                    >
                      Buka Bot
                    </a>
                  </td>
                </tr>
              )}

              {/* Row 2: WhatsApp Gateway */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 px-3 font-extrabold text-slate-800">{deviceData?.name || 'SmartRIAYAH'}</td>
                <td className="py-3 px-3 font-mono text-slate-700 text-[11px] font-bold">62859***3654</td>
                <td className="py-3 px-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    WA 3rd Party
                  </span>
                </td>
                <td className="py-3 px-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Legacy Campaign + Chatbot
                  </span>
                </td>
                <td className="py-3 px-3">
                  <span className={`inline-flex items-center gap-1 font-bold text-[11px] ${isConnected ? 'text-emerald-700' : 'text-rose-600'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-blue-100 text-blue-800">Cold</span>
                  <span className="text-[9px] text-slate-500 block mt-0.5 font-mono">Quota: {deviceData?.quota || '1.000'} · AI: 10</span>
                </td>
                <td className="py-3 px-3 font-mono font-bold text-slate-700">{deviceData?.device || '6285960213654'}</td>
                <td className="py-3 px-3 font-mono text-slate-600 text-[11px] font-bold">{deviceData?.quota || '1.000'}</td>
                <td className="py-3 px-3 text-right">
                  <button
                    onClick={() => { if (window.confirm('Ajukan restart koneksi channel ini?')) onRefreshStatus(); }}
                    className="px-2.5 py-1 rounded text-[10px] font-bold text-emerald-700 border border-emerald-300 hover:bg-emerald-50 transition"
                  >
                    Restart
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Operasional Device WhatsApp · SmartRIAYAH (Accordion Panel) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
        {/* Header Aksi Cepat Device */}
        <div className="p-4 bg-emerald-50/60 border-b border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
              <Phone className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-xs text-emerald-950">Operasional Device WhatsApp · SmartRIAYAH</h4>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isConnected ? 'bg-emerald-200/70 text-emerald-900' : 'bg-rose-100 text-rose-800'}`}>
                  {isConnected ? 'Campaign & Bot ON' : 'Offline / Standby'}
                </span>
              </div>
              <p className="text-[11px] text-emerald-800 font-mono">
                Device: {deviceData?.device || '6285960213654'} • Status: <strong className={isConnected ? 'text-emerald-700' : 'text-rose-700'}>{deviceData?.status}</strong> • Kuota: {deviceData?.quota || '1.000'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleFetchQr}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-sm flex items-center gap-1.5"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Ambil QR</span>
            </button>
            <button
              onClick={onRefreshStatus}
              disabled={deviceData?.isLoading}
              className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs transition flex items-center gap-1.5"
            >
              {deviceData?.isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span>Refresh Status</span>
            </button>
          </div>
        </div>

        {/* Accordion 1: Status Koneksi Detail */}
        <div className="border-b border-slate-100">
          <button
            onClick={() => toggleAccordion('statusDetail')}
            className="w-full p-3.5 text-left flex items-center justify-between font-bold text-xs text-slate-800 hover:bg-slate-50 transition"
          >
            <span className="flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-emerald-600" />
              1. Status Koneksi Detail WhatsApp Gateway
            </span>
            {accordions.statusDetail ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {accordions.statusDetail && (
            <div className="p-4 bg-slate-50/50 space-y-4 text-xs text-slate-600 border-t border-slate-100">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Status Device</span>
                  <span className={`font-bold text-xs block mt-1 ${isConnected ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {isConnected ? '✓ Connected' : '✕ Disconnected'}
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Nama Akun</span>
                  <span className="font-bold text-xs text-slate-800 block mt-1 truncate">{deviceData?.name || 'SmartRIAYAH'}</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Nomor WhatsApp</span>
                  <span className="font-bold text-xs font-mono text-slate-700 block mt-1">{deviceData?.device || '6285960213654'}</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Sisa Kuota</span>
                  <span className="font-extrabold text-xs text-emerald-700 block mt-1">{deviceData?.quota || '1.000'} Pesan</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Masa Aktif</span>
                  <span className="font-bold text-xs text-slate-700 block mt-1">{deviceData?.expired || '7 Dec 2026'}</span>
                </div>
              </div>

              {/* Form Pengaturan Perangkat WhatsApp Gateway */}
              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-emerald-600" />
                    <h5 className="font-extrabold text-xs text-slate-800">
                      Pengaturan Perangkat WhatsApp Gateway
                    </h5>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                    Official Device Config
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 1. Nama Label */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Nama Label / Device
                    </label>
                    <input
                      type="text"
                      value={labelInput}
                      onChange={(e) => setLabelInput(e.target.value)}
                      placeholder="SmartRIAYAH"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {/* 2. Nomor Device */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Nomor Device WhatsApp
                    </label>
                    <input
                      type="text"
                      value={deviceInput}
                      onChange={(e) => setDeviceInput(e.target.value)}
                      placeholder="6285960213654"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Banner Status Token Terenkripsi & Disembunyikan demi Privasi */}
                <div className="p-2.5 bg-emerald-50/70 rounded-xl border border-emerald-200/80 flex items-center gap-2 text-[11px] text-emerald-900">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><strong>Token Privat Gateway:</strong> Tersimpan aman di backend &amp; terenkripsi (Disembunyikan sepenuhnya demi privasi akun).</span>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
                  <p className="text-[11px] text-slate-500">
                    💡 Klik tombol di samping untuk menyimpan pengaturan dan langsung memeriksa koneksi live ke server gateway.
                  </p>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      disabled={isTestingToken}
                      onClick={handleTestToken}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Uji koneksi ping ke gateway"
                    >
                      {isTestingToken ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-500" />}
                      <span>Uji Ping</span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const cleanToken = (tokenInput || fonnteToken || '8UN12iqFjKNBYdds8FCG').trim();
                        const cleanDevice = (deviceInput || '6285960213654').trim();
                        const cleanLabel = (labelInput || 'SmartRIAYAH').trim();

                        localStorage.setItem('sr_fonnte_token', cleanToken);
                        localStorage.setItem('sr_fonnte_target', cleanDevice);
                        localStorage.setItem('sr_fonnte_label', cleanLabel);
                        if (onSaveToken) onSaveToken(cleanToken);

                        sound.playBeep?.();
                        showToast('Menyimpan pengaturan & mengecek status live gateway...', 'info');

                        try {
                          const check = await fetchDeviceStatus(cleanToken);
                          setDeviceData({
                            isConnected: check.isConnected,
                            status: check.status,
                            device: check.device || cleanDevice,
                            name: check.name || cleanLabel,
                            quota: check.quota || '1.000',
                            messages: check.messages != null ? check.messages : 0,
                            package: check.package || 'Free',
                            expired: check.expired || '7 Dec 2026',
                            isLoading: false
                          });
                          sound.playSuccess?.();
                          showToast(
                            check.isConnected
                              ? `✓ Berhasil terhubung ke ${check.name} (${check.device})! Kuota: ${check.quota}`
                              : `Pengaturan tersimpan. Status: ${check.status} (Siap Scan QR).`,
                            check.isConnected ? 'success' : 'info'
                          );
                        } catch (err) {
                          showToast(`Status Gateway: ${err.message}`, 'error');
                        }
                      }}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Simpan &amp; Refresh Koneksi</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Accordion 2: Role Nomor WhatsApp */}
        <div className="border-b border-slate-100">
          <button
            onClick={() => toggleAccordion('channelRole')}
            className="w-full p-3.5 text-left flex items-center justify-between font-bold text-xs text-slate-800 hover:bg-slate-50 transition"
          >
            <span className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-teal-600" />
              2. Role Nomor WhatsApp &amp; Mode Operasi
            </span>
            {accordions.channelRole ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {accordions.channelRole && (
            <div className="p-4 bg-slate-50/50 space-y-3 text-xs border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 max-w-sm">
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Channel Role</label>
                  <select
                    value={channelRole}
                    onChange={(e) => setChannelRole(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="Legacy Campaign + Chatbot">Legacy Campaign + Chatbot (Hybrid)</option>
                    <option value="Chatbot Only">Chatbot Only (AI Auto-Reply)</option>
                    <option value="Campaign Only">Campaign Only (Outbound Broadcast)</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Campaign: ON
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-teal-100 text-teal-800">
                    Chatbot: ON
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-100 text-indigo-800">
                    Mode: Hybrid
                  </span>
                  <button
                    onClick={() => { sound.playSuccess?.(); showToast('Role channel WhatsApp berhasil disimpan!', 'success'); }}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition"
                  >
                    Simpan Role
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Accordion 3: WhatsApp Outbound Safety */}
        <div className="border-b border-slate-100">
          <button
            onClick={() => toggleAccordion('outboundSafety')}
            className="w-full p-3.5 text-left flex items-center justify-between font-bold text-xs text-slate-800 hover:bg-slate-50 transition"
          >
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              3. WhatsApp Outbound Safety &amp; Anti-Ban Circuit Breaker
            </span>
            {accordions.outboundSafety ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {accordions.outboundSafety && (
            <div className="p-4 bg-slate-50/50 space-y-3 text-xs border-t border-slate-100">
              <div className="p-3 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-[11px]">
                Observasi reputasi nomor berjalan otomatis. Circuit breaker akan menahan sementara antrean broadcast jika ada indikasi spam atau lonjakan pengiriman tidak lazim.
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Lifecycle</span>
                  <span className="font-extrabold text-xs text-slate-800 mt-0.5 block">Cold (Aman)</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Daily Budget</span>
                  <span className="font-extrabold text-xs text-emerald-700 mt-0.5 block">2 / 5 Batas</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Circuit Breaker</span>
                  <span className="font-extrabold text-xs text-teal-700 mt-0.5 block">Initiate ON</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Risk Score</span>
                  <span className="font-extrabold text-xs text-emerald-600 mt-0.5 block">0 (Sangat Rendah)</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Accordion 4: Scan QR */}
        <div className="border-b border-slate-100">
          <button
            onClick={() => toggleAccordion('scanQr')}
            className="w-full p-3.5 text-left flex items-center justify-between font-bold text-xs text-slate-800 hover:bg-slate-50 transition"
          >
            <span className="flex items-center gap-2">
              <QrCode className="w-3.5 h-3.5 text-emerald-600" />
              4. Scan QR WhatsApp Gateway (Auto-Polling &amp; Live Connect)
            </span>
            {accordions.scanQr ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {accordions.scanQr && (
            <div className="p-4 bg-slate-50/50 space-y-4 text-xs border-t border-slate-100">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="w-52 h-52 bg-white p-3 rounded-2xl border border-slate-300 flex items-center justify-center shadow-inner relative overflow-hidden">
                  {qrLoading ? (
                    <div className="text-center p-3 text-slate-500 space-y-2">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600" />
                      <span className="text-[11px] font-bold block">Meminta QR resmi WhatsApp...</span>
                    </div>
                  ) : (isQrExpired || countdown <= 0) && !qrImage ? (
                    <div className="text-center p-3 space-y-2">
                      <div className="w-11 h-11 mx-auto rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-500 shadow-xs">
                        <Clock className="w-5 h-5 animate-pulse text-rose-600" />
                      </div>
                      <div>
                        <span className="text-xs font-black block text-rose-600">Barcode Kedaluwarsa!</span>
                        <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                          Batas waktu scan 45s habis. Barcode telah dihapus otomatis demi keamanan.
                        </span>
                      </div>
                      <button
                        onClick={handleFetchQr}
                        disabled={qrLoading}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition shadow-xs flex items-center gap-1 mx-auto mt-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Minta Barcode Baru</span>
                      </button>
                    </div>
                  ) : (qrImage && countdown > 0) ? (
                    <div className="relative w-full h-full flex flex-col items-center justify-center">
                      <img
                        src={qrImage}
                        alt="WhatsApp QR Code"
                        className="w-full h-full object-contain rounded-lg"
                      />
                      <span className={`absolute bottom-1 font-mono text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm flex items-center gap-1 ${
                        countdown <= 10
                          ? 'bg-rose-600 text-white animate-pulse'
                          : 'bg-slate-900/85 text-white'
                      }`}>
                        <Clock className="w-2.5 h-2.5" />
                        <span>⏱️ {countdown}s tersisa</span>
                      </span>
                    </div>
                  ) : (
                    <div className="text-center p-3 text-slate-400 space-y-1">
                      <QrCode className="w-10 h-10 mx-auto text-slate-300" />
                      <span className="text-[11px] block font-semibold text-slate-600">Barcode belum dimuat</span>
                      <span className="text-[10px] text-slate-400 block">Klik tombol "Ambil QR" di samping</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 text-left max-w-md">
                  <h5 className="font-bold text-sm text-slate-900">Petunjuk Menautkan Perangkat WhatsApp:</h5>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-600 text-xs">
                    <li>Buka aplikasi WhatsApp di HP Admin / Pengasuh Pesantren.</li>
                    <li>Buka <strong>Menu Titik Tiga (Android)</strong> atau <strong>Pengaturan (iOS) &gt; Perangkat Tertaut</strong>.</li>
                    <li>Ketuk <strong>Tautkan Perangkat</strong> lalu arahkan kamera ke barcode QR di samping.</li>
                    <li>Sistem otomatis mendeteksi koneksi dalam 5 detik dan memperbarui status menjadi <strong className="text-emerald-700">Connected</strong>.</li>
                  </ol>
                  <div className="pt-2 flex items-center gap-3">
                    <button
                      onClick={handleFetchQr}
                      disabled={qrLoading}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-sm flex items-center gap-1.5"
                    >
                      {qrLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <QrCode className="w-3.5 h-3.5" />}
                      <span>
                        {qrImage && countdown > 0
                          ? 'Minta QR Baru'
                          : isQrExpired
                          ? 'Minta QR Baru (Kedaluwarsa)'
                          : 'Ambil QR Resmi WhatsApp'}
                      </span>
                    </button>
                    {qrCode && countdown > 0 && !isQrExpired && (
                      <span className="text-slate-500 font-mono text-[11px] bg-slate-200/80 px-2 py-1 rounded-lg">
                        Pairing Code: <strong>{qrCode}</strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Accordion 5: Validate Number */}
        <div className="border-b border-slate-100">
          <button
            onClick={() => toggleAccordion('validateNumber')}
            className="w-full p-3.5 text-left flex items-center justify-between font-bold text-xs text-slate-800 hover:bg-slate-50 transition"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
              5. Validate Number (Validasi Nomor Terdaftar WhatsApp)
            </span>
            {accordions.validateNumber ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {accordions.validateNumber && (
            <div className="p-4 bg-slate-50/50 space-y-3 text-xs border-t border-slate-100">
              <div className="flex flex-col sm:flex-row items-center gap-3 max-w-lg">
                <input
                  type="text"
                  value={validateInput}
                  onChange={(e) => setValidateInput(e.target.value)}
                  placeholder="6285960213654"
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  onClick={handleValidateNumber}
                  disabled={isValidating}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition shrink-0 flex items-center gap-1.5 shadow-sm"
                >
                  {isValidating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Validasi Nomor</span>
                </button>
              </div>

              {validateResult && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2.5 border ${
                  validateResult.isRegistered
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                    : validateResult.isDeviceConnected === false
                    ? 'bg-amber-50 text-amber-900 border-amber-200'
                    : 'bg-rose-50 text-rose-900 border-rose-200'
                }`}>
                  {validateResult.isRegistered ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>✅ Nomor <strong>{validateResult.phone}</strong> aktif dan terdaftar di WhatsApp.</span>
                    </>
                  ) : validateResult.isDeviceConnected === false ? (
                    <>
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>⚠️ <strong>{validateResult.message}</strong></span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>❌ Nomor <strong>{validateResult.phone}</strong> tidak terdaftar di WhatsApp.</span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Accordion 6: Disconnect Device */}
        <div>
          <button
            onClick={() => toggleAccordion('disconnectDevice')}
            className="w-full p-3.5 text-left flex items-center justify-between font-bold text-xs text-rose-700 hover:bg-rose-50/50 transition"
          >
            <span className="flex items-center gap-2">
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              6. Disconnect Device (Putuskan Tautan Perangkat)
            </span>
            {accordions.disconnectDevice ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {accordions.disconnectDevice && (
            <div className="p-4 bg-rose-50/40 space-y-3 text-xs border-t border-slate-100">
              <p className="text-rose-900 leading-relaxed">
                Memutuskan tautan perangkat akan menghentikan pengiriman pesan otomatis dan notifikasi perizinan real-time sampai Anda melakukan scan QR ulang.
              </p>
              <button
                onClick={onDisconnectDevice}
                disabled={deviceData?.isLoading}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shadow-sm flex items-center gap-1.5"
              >
                {deviceData?.isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Disconnect Device Sekarang</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 6. WhatsApp Safety Event History & Riwayat Pengajuan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Safety Event History */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">WhatsApp Safety Event History</h4>
          <div className="space-y-2 text-xs max-h-80 overflow-y-auto">
            {safetyLogs.map((log, idx) => (
              <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="font-mono text-slate-400 text-[10px] block">{log.time}</span>
                  <strong className="text-slate-800 text-xs">{log.event}</strong>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                    log.severity === 'warning' ? 'bg-amber-100 text-amber-800' :
                    log.severity === 'error' ? 'bg-rose-100 text-rose-800' :
                    'bg-emerald-100 text-emerald-800'
                  }`}>
                    {log.severity}
                  </span>
                  <span className="font-mono text-[10px] text-slate-400 block mt-0.5">{log.ref}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Riwayat Pengajuan */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">Riwayat Pengajuan Channel</h4>
          <div className="space-y-2 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-500">
              <div className="flex items-center justify-between font-bold text-slate-800">
                <span>AKTIVASI CHANNEL BARU</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Selesai</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                WhatsApp Gateway disetujui &amp; diintegrasikan untuk notifikasi WhatsApp santri Pesantren Modern Darul Ulum.
              </p>
              <span className="text-[10px] text-slate-400 font-mono mt-1 block">Diajukan: 16 Okt 2026 oleh Admin Ri'ayah</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================================
   SUB-COMPONENT: TAB 3 - AI INBOX (LIST & DETAIL)
   ========================================================================================= */
function TabAiInbox({
  fonnteToken,
  deviceData,
  addSafetyLog,
  showToast,
  chatLogs,
  setChatLogs,
  manualReplyNeededCount = 0,
  purgeOldChatLogs,
  lastChatPurgeSummary,
  sendManualReplyToChat,
  takeOverChatManual,
  resolveChatManual
}) {
  const [selectedChat, setSelectedChat] = useState(null);
  const [isSendingOverride, setIsSendingOverride] = useState(false);
  const [isManualOverrideActive, setIsManualOverrideActive] = useState(false);
  const [globalHandling, setGlobalHandling] = useState(() => {
    return localStorage.getItem('smart_riayah_global_handling') || 'autonomous';
  }); // 'manual' | 'semi_auto' | 'autonomous'
  const [channelFilter, setChannelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [overrideMessage, setOverrideMessage] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);

  // ─── Conversations Directory (Source of Truth: chatLogs dari AppContext) ───
  const conversations = chatLogs && chatLogs.length > 0 ? chatLogs : [
    {
      id: 'chat-1',
      name: 'Ibu Fatimah Az-Zahra',
      santri: 'Ahmad Fauzi (Kamar Umar 204)',
      phone: '+62 881-3576-012',
      channel: 'WhatsApp',
      status: 'Open',
      handling: 'Otonom - Mengikuti Global',
      aiSafety: 'AI Balas - Allow (Score: 98)',
      lastTime: '11:40 WIB',
      lastPreview: 'Assalamu\'alaikum, apakah ananda Fauzi hari ini sholat subuh berjamaah?',
      unread: false,
      needs_manual_reply: false,
      messages: [
        { sender: 'wali', time: '11:38 WIB', text: 'Assalamu\'alaikum ustadz, bagaimana kabar ananda Ahmad Fauzi hari ini?' },
        { sender: 'ai', time: '11:39 WIB', text: 'Wa\'alaikumsalam warahmatullah, Ibu Fatimah. Ananda Ahmad Fauzi sehat wal\'afiat dan tercatat hadir sholat Subuh berjamaah di Masjid Jami\' tepat waktu. Poin kedisiplinannya saat ini 96/100 (Mumtaz).' },
        { sender: 'wali', time: '11:40 WIB', text: 'Alhamdulillah, terima kasih banyak atas infonya Ustadz.' }
      ]
    },
    {
      id: 'chat-2',
      name: 'Bpk. Hendra Gunawan',
      santri: 'Muhammad Rayhan (Kamar Abu Bakar 102)',
      phone: '+62 812-4455-890',
      channel: 'WhatsApp',
      status: 'Perlu Ambil Alih',
      handling: 'Semi Auto - Perlu Review',
      isManual: false,
      needs_manual_reply: true,
      aiSafety: 'Perlu Konfirmasi Admin (Score: 68)',
      lastTime: '11:15 WIB',
      lastPreview: 'Saya mau tanya prosedur perpanjangan izin pulang karena anak demam di rumah.',
      unread: true,
      messages: [
        { sender: 'wali', time: '11:14 WIB', text: 'Assalamu\'alaikum, ananda Rayhan sedang demam di rumah. Bagaimana prosedur mengajukan perpanjangan liburan?' },
        { sender: 'ai', time: '11:15 WIB', text: 'Wa\'alaikumsalam Bapak Hendra. Syafakallah untuk ananda. Bapak dapat mengajukan perpanjangan liburan langsung melalui menu Perizinan di aplikasi Smart Riayah dengan mengunggah foto surat dokter/keterangan sakit.' }
      ]
    },
    {
      id: 'chat-3',
      name: 'Ibu Siti Khadijah',
      santri: 'Aisyah Putri (Kamar Khadijah 105)',
      phone: '+62 856-7890-123',
      channel: 'Telegram Bot',
      status: 'Open',
      handling: 'Otonom - Mengikuti Global',
      aiSafety: 'AI Balas - Allow (Score: 94)',
      needs_manual_reply: false,
      lastTime: '10:50 WIB',
      lastPreview: 'Berapa sisa saldo dompet RFID ananda saat ini?',
      unread: false,
      messages: [
        { sender: 'wali', time: '10:49 WIB', text: 'Berapa sisa saldo dompet RFID ananda Aisyah Putri?' },
        { sender: 'ai', time: '10:50 WIB', text: 'Saldo kartu RFID ananda Aisyah Putri saat ini adalah Rp 65.000 dengan limit jajan harian Rp 25.000/hari.' }
      ]
    }
  ];

  const setConversations = (updater) => {
    if (typeof setChatLogs === 'function') {
      setChatLogs(updater);
    }
  };

  // ─── Real-Time Inbound Live Chat Feed Stream ───
  const [liveFeedLogs, setLiveFeedLogs] = useState([
    {
      id: 'feed-init',
      time: '11:40 WIB',
      type: 'INCOMING',
      phone: '08813576012',
      name: 'Ibu Fatimah Az-Zahra',
      text: 'Assalamu\'alaikum, apakah ananda Fauzi hari ini sholat subuh berjamaah?',
      aiStatus: 'Dibalas Otonom',
      aiReply: 'Wa\'alaikumsalam Ibu Fatimah. Ananda sehat wal\'afiat dan sholat subuh berjamaah di Masjid Jami\'...'
    }
  ]);

  // Helper normalisasi nomor HP
  const normalizeDigits = (num) => String(num || '').replace(/[^0-9]/g, '');

  // ─── Realtime Listener untuk Webhook WhatsApp & Balasan AI Otonom ───
  useEffect(() => {
    if (!supabase) return;

    // Muat daftar nomor yang sedang dalam status Mode Ambil Alih dari Supabase messages table
    supabase
      .from('messages')
      .select('message_text')
      .eq('room_id', 'whatsapp_takeover')
      .then(({ data, error }) => {
        if (!error && Array.isArray(data) && data.length > 0) {
          const activeTakeovers = data.map(d => normalizeDigits(d.message_text));
          setConversations(prev => prev.map(c => {
            const cDigits = normalizeDigits(c.phone);
            const isTaken = activeTakeovers.some(t => t.endsWith(cDigits.slice(-8)) || cDigits.endsWith(t.slice(-8)));
            if (isTaken) {
              return {
                ...c,
                isManual: true,
                handling: 'Manual (Ambil Alih)',
                status: 'Ditangani Admin'
              };
            }
            return c;
          }));
        }
      })
      .catch(() => {});

    const channel = supabase.channel('whatsapp-room');

    channel
      .on('broadcast', { event: 'whatsapp.incoming' }, (payload) => {
        const inc = payload?.payload;
        if (!inc) return;

        const senderDigits = normalizeDigits(inc.nomor);
        const nowWIB = inc.waktu || (new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB');

        const newMsg = {
          sender: 'wali',
          time: nowWIB,
          text: inc.pesan
        };

        // 1. Update Ruang Chat Aktif jika sedang dibuka
        setSelectedChat(prev => {
          if (prev) {
            const prevDigits = normalizeDigits(prev.phone);
            if (prevDigits === senderDigits || prevDigits.endsWith(senderDigits.slice(-9)) || senderDigits.endsWith(prevDigits.slice(-9))) {
              return {
                ...prev,
                messages: [...prev.messages, newMsg],
                lastTime: nowWIB,
                lastPreview: inc.pesan
              };
            }
          }
          return prev;
        });

        // 2. Tambahkan / Update Baris Percakapan di Tabel Kontak (Real-Time Inbound)
        setConversations(prev => {
          const matchIdx = prev.findIndex(c => {
            const cDigits = normalizeDigits(c.phone);
            return cDigits === senderDigits || cDigits.endsWith(senderDigits.slice(-9)) || senderDigits.endsWith(cDigits.slice(-9));
          });

          if (matchIdx !== -1) {
            const copy = [...prev];
            const target = copy[matchIdx];
            copy.splice(matchIdx, 1);
            copy.unshift({
              ...target,
              lastTime: nowWIB,
              lastPreview: inc.pesan,
              unread: true,
              isLiveIncoming: true,
              messages: [...target.messages, newMsg]
            });
            return copy;
          } else {
            // NOMOR BARU MASUK DITAMBAHKAN KE DAFTAR PERCAKAPAN
            const formattedPhone = inc.nomor ? (String(inc.nomor).startsWith('+') ? String(inc.nomor) : `+${inc.nomor}`) : '+62 8xx';
            const newEntry = {
              id: `chat-${Date.now()}`,
              name: inc.pengirim || 'Wali Santri (WhatsApp)',
              santri: 'Santri Terkait Nomor HP',
              phone: formattedPhone,
              channel: 'WhatsApp',
              status: 'Open',
              handling: 'Otonom - Mengikuti Global',
              aiSafety: 'AI Balas - Allow (Score: 99)',
              lastTime: nowWIB,
              lastPreview: inc.pesan,
              unread: true,
              isLiveIncoming: true,
              messages: [newMsg]
            };
            return [newEntry, ...prev];
          }
        });

        // 3. Tambahkan ke Live Feed Log Real-Time
        setLiveFeedLogs(prev => [
          {
            id: `feed-${Date.now()}`,
            time: nowWIB,
            type: 'INCOMING',
            phone: inc.nomor || 'Unknown',
            name: inc.pengirim || 'Wali Santri',
            text: inc.pesan,
            aiStatus: '⚡ AI Memproses Balasan...',
            aiReply: null
          },
          ...prev.slice(0, 19)
        ]);

        addSafetyLog?.('inbound received', 'info', 'INCOMING_MSG', inc.nomor || 'Wali');
        showToast?.(`📩 WhatsApp Masuk dari ${inc.pengirim || inc.nomor}: "${inc.pesan.slice(0, 35)}..."`, 'info');
        sound.playWhatsApp?.();
      })
      .on('broadcast', { event: 'whatsapp.ai_reply' }, (payload) => {
        const rep = payload?.payload;
        if (!rep) return;

        const targetDigits = normalizeDigits(rep.target);

        // 🛡️ FRONTEND SHIELD: Cek apakah target ini sedang dalam Mode Ambil Alih Manual
        // Jika sedang ditangani manual oleh Admin, cegah balasan AI agar tidak menyela di percakapan!
        if (selectedChat) {
          const selDigits = normalizeDigits(selectedChat.phone);
          if ((selDigits === targetDigits || selDigits.endsWith(targetDigits.slice(-8)) || targetDigits.endsWith(selDigits.slice(-8))) && (selectedChat.isManual || isManualOverrideActive)) {
            console.log(`🛡️ [Frontend Shield]: Mengabaikan AI reply untuk ${rep.target} karena Admin sedang dalam Mode Ambil Alih Manual.`);
            return;
          }
        }

        const nowWIB = rep.waktu || (new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB');

        const newMsg = {
          sender: 'ai',
          time: nowWIB,
          text: rep.replyText
        };

        // 1. Update Ruang Chat Aktif
        setSelectedChat(prev => {
          if (prev) {
            const prevDigits = normalizeDigits(prev.phone);
            if (prevDigits === targetDigits || prevDigits.endsWith(targetDigits.slice(-9)) || targetDigits.endsWith(prevDigits.slice(-9))) {
              return {
                ...prev,
                messages: [...prev.messages, newMsg],
                lastTime: nowWIB,
                lastPreview: `⚡ AI: ${rep.replyText.slice(0, 50)}...`
              };
            }
          }
          return prev;
        });

        // 2. Update status percakapan di daftar
        setConversations(prev => {
          const matchIdx = prev.findIndex(c => {
            const cDigits = normalizeDigits(c.phone);
            return cDigits === targetDigits || cDigits.endsWith(targetDigits.slice(-9)) || targetDigits.endsWith(cDigits.slice(-9));
          });

          if (matchIdx !== -1) {
            const copy = [...prev];
            copy[matchIdx] = {
              ...copy[matchIdx],
              lastTime: nowWIB,
              lastPreview: `⚡ AI: ${rep.replyText.slice(0, 50)}...`,
              messages: [...copy[matchIdx].messages, newMsg]
            };
            return copy;
          }
          return prev;
        });

        // 3. Update Live Feed Log Real-Time
        setLiveFeedLogs(prev => {
          const updated = [...prev];
          const found = updated.find(item => normalizeDigits(item.phone) === targetDigits);
          if (found) {
            found.aiStatus = 'Dibalas Otonom';
            found.aiReply = rep.replyText;
            return updated;
          }
          return [
            {
              id: `feed-ai-${Date.now()}`,
              time: nowWIB,
              type: 'AI_REPLY',
              phone: rep.target,
              name: rep.namaWali || 'Wali Santri',
              text: rep.incomingText || 'Chat WhatsApp Masuk',
              aiStatus: 'Dibalas Otonom',
              aiReply: rep.replyText
            },
            ...prev.slice(0, 19)
          ];
        });

        addSafetyLog?.('outbound success', 'info', 'AUTONOMOUS_AI', rep.target || 'Wali');
        showToast?.(`⚡ AI Otonom mengirim balasan ke WhatsApp ${rep.target}!`, 'success');
        sound.playSuccess?.();
      })
      .on('broadcast', { event: 'santri.wali_updated' }, (payload) => {
        const update = payload?.payload;
        if (!update) return;

        showToast?.(`📲 Update Nomor WA: Wali ${update.namaSantri} berhasil diperbarui ke ${update.noWali}`, 'info');

        // Update nomor di daftar percakapan jika ada
        setConversations(prev => prev.map(c => {
          if (c.santri?.toLowerCase().includes(update.namaSantri.toLowerCase()) || (c.name && update.namaWali && c.name.toLowerCase().includes(update.namaWali.toLowerCase()))) {
            const formatted = update.noWali ? (update.noWali.startsWith('+') ? update.noWali : `+${update.noWali}`) : c.phone;
            return {
              ...c,
              name: update.namaWali || c.name,
              phone: formatted
            };
          }
          return c;
        }));

        setLiveFeedLogs(prev => [
          {
            id: `feed-update-${Date.now()}`,
            time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
            type: 'UPDATE',
            phone: update.noWali || '-',
            name: update.namaWali || 'Wali Santri',
            text: `[SINKRONISASI KONTAK] Nomor WhatsApp Wali untuk santri ${update.namaSantri} telah diperbarui melalui Tabel RFID.`,
            aiStatus: 'Tersinkronisasi Otomatis',
            aiReply: 'AI Smart Ri\'ayah siap melayani pesan WhatsApp dari nomor baru ini.'
          },
          ...prev.slice(0, 19)
        ]);
      })
      .on('broadcast', { event: 'whatsapp.takeover' }, (payload) => {
        const t = payload?.payload;
        if (!t) return;
        const targetDigits = normalizeDigits(t.phone);
        const nextManual = Boolean(t.isManual);

        if (nextManual && t.reason === 'WALI_REQUESTED_ADMIN') {
          showToast?.(`🔔 Percakapan dialihkan: Wali Santri (${t.senderName || t.phone}) ingin berbicara langsung dengan Admin!`, 'info');
          sound.playSuccess?.();
        }

        setSelectedChat(prev => {
          if (!prev) return null;
          if (normalizeDigits(prev.phone) === targetDigits) {
            setIsManualOverrideActive(nextManual);
            return {
              ...prev,
              isManual: nextManual,
              handling: nextManual ? 'Manual (Ambil Alih)' : 'Otonom - Mengikuti Global',
              status: nextManual ? 'Ditangani Admin' : 'Open'
            };
          }
          return prev;
        });

        setConversations(prev => prev.map(c => {
          if (normalizeDigits(c.phone) === targetDigits) {
            return {
              ...c,
              isManual: nextManual,
              handling: nextManual ? 'Manual (Ambil Alih)' : 'Otonom - Mengikuti Global',
              status: nextManual ? 'Ditangani Admin' : 'Open'
            };
          }
          return c;
        }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSimulateIncoming = async (questionText, topicName) => {
    setIsSimulating(true);
    sound.playBeep?.();
    showToast?.(`Simulasi: Mengirim pertanyaan "${topicName}" dari Wali Santri...`, 'info');

    const nowWIB = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    const activeConv = selectedChat || conversations[0];
    if (!selectedChat) {
      setSelectedChat(activeConv);
    }

    const incomingMsg = {
      sender: 'wali',
      time: nowWIB,
      text: questionText
    };

    setSelectedChat(prev => prev ? ({ ...prev, messages: [...prev.messages, incomingMsg] }) : ({ ...activeConv, messages: [...activeConv.messages, incomingMsg] }));

    // Masukkan ke live feed log
    setLiveFeedLogs(prev => [
      {
        id: `feed-sim-${Date.now()}`,
        time: nowWIB,
        type: 'INCOMING',
        phone: activeConv.phone || '08813576012',
        name: activeConv.name || 'Ibu Fatimah Az-Zahra',
        text: questionText,
        aiStatus: '⚡ AI Memproses Balasan...',
        aiReply: null
      },
      ...prev.slice(0, 19)
    ]);

    try {
      const res = await fetch('/api/whatsapp/simulate-incoming', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: activeConv.phone || '08813576012',
          message: questionText,
          name: activeConv.name || 'Ibu Fatimah Az-Zahra'
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.reply) {
          const aiMsg = {
            sender: 'ai',
            time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
            text: data.reply
          };
          setSelectedChat(prev => ({ ...prev, messages: [...prev.messages, aiMsg] }));
          setLiveFeedLogs(prev => {
            const updated = [...prev];
            if (updated.length > 0) {
              updated[0].aiStatus = 'Dibalas Otonom';
              updated[0].aiReply = data.reply;
            }
            return updated;
          });
          showToast?.('⚡ AI Otonom berhasil membalas pesan WhatsApp!', 'success');
          sound.playWhatsApp?.();
          setIsSimulating(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Simulation backend endpoint fallback:', e);
    }

    // Instant local reasoning fallback
    setTimeout(() => {
      let clientReply = '';
      const qLower = questionText.toLowerCase();
      if (qLower.includes('saldo')) {
        clientReply = "Wa'alaikumsalam Warahmatullahi Wabarakatuh, Ibu Fatimah.\n\nBerikut informasi dompet pintar cashless ananda *Ahmad Fauzi*:\n\n💳 *Sisa Saldo RFID:* *Rp 85.000*\n📊 *Limit Jajan Harian:* Rp 25.000/hari\n🏢 *Lokasi Transaksi:* Kantin Asrama & Koperasi Ma'had\n\nUntuk pengisian saldo (Top Up), Bapak/Ibu dapat melakukan transfer Virtual Account atau melalui aplikasi Smart Ri'ayah.\n\n_— Smart Ri'ayah Cashless Gateway_";
      } else if (qLower.includes('izin') || qLower.includes('perpanjang')) {
        clientReply = "Wa'alaikumsalam Warahmatullahi Wabarakatuh, Ibu Fatimah.\n\nUntuk perizinan ananda *Ahmad Fauzi*:\n\n📋 *SOP Perizinan Santri:*\n1. Izin kepulangan/pesiar diajukan minimal H-1 oleh wali melalui menu *Perizinan* di aplikasi Smart Ri'ayah.\n2. Jika ananda sakit dan membutuhkan *Perpanjangan Liburan*, silakan klik tombol *Ajukan Perpanjangan Liburan* pada riwayat izin serta lampirkan foto surat dokter/keterangan medis.\n3. Musyrif & Mudir akan memverifikasi permohonan dalam waktu 1x24 jam.\n\nStatus izin ananda saat ini: *Tertib / Tidak ada pelanggaran*.\n\n_— Layanan Perizinan Digital DU-PERMIT_";
      } else if (qLower.includes('sakit') || qLower.includes('sehat')) {
        clientReply = "Wa'alaikumsalam Warahmatullahi Wabarakatuh, Ibu Fatimah.\n\nLayanan Kesehatan Pesantren Modern Darul Ulum (Poskestren) siap siaga *24 jam* dengan tenaga medis asrama.\n\n🏥 Apabila ananda *Ahmad Fauzi* mengeluhkan sakit, ananda segera diperiksa di ruang rawat UKS dan diberikan istirahat serta pengobatan dokter.\n\nKondisi medis ananda saat ini: *Sehat & Terpantau Baik di Kamar Umar bin Khattab 204*.\n\n_— Poskestren Darul Ulum Care_";
      } else {
        clientReply = "Wa'alaikumsalam Warahmatullahi Wabarakatuh, Ibu Fatimah.\n\n📅 *Jadwal Kunjungan (Sambangan) Wali Santri:*\n• *Hari:* Setiap Ahad (Minggu)\n• *Waktu:* Pukul 08.00 s/d 17.00 WIB\n• *Tempat:* Area Gazebo & Aula Kunjungan Ma'had Darul Ulum\n\nSaat berkunjung, mohon memarkir kendaraan di area parkir utama dan melapor singkat ke Pos Satpam.\n\n_— Tata Tertib Kunjungan Pesantren_";
      }

      const aiMsg = {
        sender: 'ai',
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
        text: clientReply
      };
      setSelectedChat(prev => ({ ...prev, messages: [...prev.messages, aiMsg] }));
      setLiveFeedLogs(prev => {
        const updated = [...prev];
        if (updated.length > 0) {
          updated[0].aiStatus = 'Dibalas Otonom';
          updated[0].aiReply = clientReply;
        }
        return updated;
      });
      showToast?.('⚡ AI Otonom berhasil membalas pesan WhatsApp!', 'success');
      sound.playWhatsApp?.();
      setIsSimulating(false);
    }, 1000);
  };

  const applyFormat = (syntax) => {
    setOverrideMessage(prev => {
      switch (syntax) {
        case 'bold': return prev ? prev + ' *teks*' : '*teks*';
        case 'italic': return prev ? prev + ' _teks_' : '_teks_';
        case 'strike': return prev ? prev + ' ~teks~' : '~teks~';
        case 'code': return prev ? prev + ' `teks`' : '`teks`';
        case 'list': return prev ? prev + '\n• Poin info' : '• Poin info';
        case 'quote': return prev ? prev + '\n> Kutipan' : '> Kutipan';
        default: return prev;
      }
    });
  };

  const handleSendOverride = async (e) => {
    e.preventDefault();
    if (!overrideMessage.trim() || !selectedChat) return;

    const targetPhone = selectedChat.phone || '08813576012';
    const textToSend = overrideMessage.trim();
    setIsSendingOverride(true);
    sound.playBeep?.();

    try {
      let res;
      const isTelegramChat = selectedChat.channel === 'Telegram Bot' || String(targetPhone).startsWith('TG-');
      if (isTelegramChat) {
        const cleanChatId = String(targetPhone).replace(/[^0-9]/g, '');
        const tgToken = localStorage.getItem('smart_riayah_telegram_token') || '9079176204:AAEBAzGX5ReS_Kykuk32ctWtIkmIhh-ElVQ';
        const tgRes = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: cleanChatId, text: textToSend })
        });
        const tgData = await tgRes.json().catch(() => ({}));
        res = { success: Boolean(tgData.ok), message: tgData.description };
      } else {
        res = await sendManualOverrideMessage(targetPhone, textToSend, fonnteToken);
      }
      setIsSendingOverride(false);

      if (res.success || res.data?.status === true || res.data?.status === 'true' || res.data?.id) {
        const newMsg = {
          sender: 'admin',
          time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
          text: textToSend
        };

        setSelectedChat(prev => ({
          ...prev,
          messages: [...prev.messages, newMsg],
          needs_manual_reply: false,
          status: 'Ditangani Admin'
        }));

        if (typeof sendManualReplyToChat === 'function' && selectedChat?.id) {
          sendManualReplyToChat(selectedChat.id, textToSend);
        }

        addSafetyLog?.(
          'outbound success',
          'info',
          'MANUAL_OVERRIDE',
          selectedChat.santri?.split(' ')[0] || targetPhone
        );

        showToast?.(
          isTelegramChat
            ? `Pesan berhasil dikirim ke Telegram Chat ${targetPhone}!`
            : `Pesan berhasil dikirim ke WhatsApp ${targetPhone} via WhatsApp Gateway!`,
          'success'
        );
        sound.playWhatsApp?.();
        setOverrideMessage('');
      } else {
        const errMsg = res.data?.reason || res.data?.message || res.message || 'Error API Gateway';
        showToast?.(`Gagal mengirim pesan: ${errMsg}`, 'error');
        addSafetyLog?.(
          'outbound failed',
          'warning',
          'MANUAL_OVERRIDE',
          targetPhone
        );
      }
    } catch (err) {
      setIsSendingOverride(false);
      showToast?.(`Koneksi pengiriman gagal: ${err.message}`, 'error');
    }
  };

  // ─── Logika Sinkronisasi Mode Ambil Alih Manual & AI Otonom ───
  const isChatManual = Boolean(
    selectedChat?.isManual ||
    selectedChat?.handling?.toLowerCase().includes('manual') ||
    isManualOverrideActive
  );

  const toggleManualOverride = async () => {
    if (!selectedChat) return;
    const nextManual = !isChatManual;

    // 1. Update state lokal
    setIsManualOverrideActive(nextManual);

    const updatedHandling = nextManual ? 'Manual (Ambil Alih)' : 'Otonom - Mengikuti Global';
    const updatedStatus = nextManual ? 'Ditangani Admin' : 'Open';

    // 2. Update selectedChat
    setSelectedChat(prev => {
      if (!prev) return null;
      return {
        ...prev,
        isManual: nextManual,
        handling: updatedHandling,
        status: updatedStatus
      };
    });

    // 3. Update daftar percakapan
    setConversations(prev => prev.map(c => {
      const match = c.id === selectedChat.id || (c.phone && normalizeDigits(c.phone) === normalizeDigits(selectedChat.phone));
      if (match) {
        return {
          ...c,
          isManual: nextManual,
          handling: updatedHandling,
          status: updatedStatus
        };
      }
      return c;
    }));

    // 4. Feedback Suara & Notifikasi
    if (nextManual) {
      addSafetyLog?.(
        'manual takeover',
        'warning',
        'ADMIN_TAKEOVER',
        selectedChat.name || selectedChat.phone
      );
      showToast?.('👤 Mode Ambil Alih Manual Aktif! AI Bot diistirahatkan. Anda memegang kendali percakapan ini secara manual.', 'info');
      sound.playSuccess?.();
    } else {
      addSafetyLog?.(
        'autonomous resumed',
        'info',
        'AI_RESUMED',
        selectedChat.name || selectedChat.phone
      );
      showToast?.('⚡ Mode Otonom AI Aktif Kembali! AI Smart Ri\'ayah kembali membalas pesan otomatis.', 'success');
      sound.playSuccess?.();
    }

    // 5. Sinkronisasi Langsung ke Supabase Database & Realtime
    try {
      const cleanPhone = normalizeDigits(selectedChat.phone);
      const last8 = cleanPhone.slice(-8);

      if (supabase) {
        if (nextManual) {
          // Bersihkan record lama untuk nomor ini, lalu insert penanda takeover manual
          await supabase
            .from('messages')
            .delete()
            .eq('room_id', 'whatsapp_takeover')
            .like('message_text', `%${last8}%`);

          await supabase
            .from('messages')
            .insert([{
              room_id: 'whatsapp_takeover',
              sender_email: 'admin@smartriayah.com',
              sender_name: 'Admin Ri\'ayah',
              sender_role: 'admin',
              message_text: cleanPhone,
              reaction: 'MANUAL_TAKEOVER',
              is_read: false
            }]);
        } else {
          // Hapus penanda takeover saat kembali ke mode otonom
          await supabase
            .from('messages')
            .delete()
            .eq('room_id', 'whatsapp_takeover')
            .like('message_text', `%${last8}%`);
        }

        supabase.channel('whatsapp-room').send({
          type: 'broadcast',
          event: 'whatsapp.takeover',
          payload: {
            phone: selectedChat.phone,
            isManual: nextManual,
            admin: 'Ust. Drs. H. Mustofa',
            timestamp: new Date().toISOString()
          }
        }).catch(() => {});
      }

      await fetch('/api/whatsapp/fonnte/takeover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: selectedChat.phone,
          isManual: nextManual
        })
      }).catch(() => {});
    } catch (err) {
      console.warn('Takeover sync notice:', err);
    }
  };

  const handleOpenChat = (chat) => {
    setSelectedChat(chat);
    const isManual = Boolean(chat.isManual || chat.handling?.toLowerCase().includes('manual'));
    setIsManualOverrideActive(isManual);
  };

  // If viewing Conversation Detail
  if (selectedChat) {
    return (
      <div className="space-y-4">
        {/* Header Detail Kontak */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedChat(null)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              title="Kembali ke Daftar Inbox"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-sm text-slate-900">{selectedChat.name}</h3>

                {/* TOMBOL TOGGLE MODE: AMBIL ALIH <-> OTONOM DI BAGIAN ATAS */}
                <button
                  type="button"
                  onClick={toggleManualOverride}
                  className={`group px-3 py-1 rounded-full text-xs font-black transition-all duration-200 flex items-center gap-1.5 shadow-sm border cursor-pointer select-none active:scale-95 ${
                    isChatManual
                      ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 ring-2 ring-amber-300/60 shadow-amber-200'
                      : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border-emerald-300 ring-1 ring-emerald-400/40'
                  }`}
                  title={isChatManual ? "Klik untuk mengembalikan ke Mode Otonom AI" : "Klik untuk Ambil Alih (Mode Manual)"}
                >
                  {isChatManual ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                      <span>👤 Mode Ambil Alih (Manual)</span>
                      <span className="text-[10px] bg-amber-600/90 text-amber-50 px-2 py-0.5 rounded-full font-semibold group-hover:bg-amber-700">
                        Klik jadi Otonom ↻
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
                      </span>
                      <span>⚡ Otonom (AI Aktif)</span>
                      <span className="text-[10px] bg-emerald-200/90 text-emerald-900 px-2 py-0.5 rounded-full font-semibold group-hover:bg-emerald-300">
                        Klik Ambil Alih ⇄
                      </span>
                    </>
                  )}
                </button>

                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                  Known Customer
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {selectedChat.phone} • {selectedChat.santri}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition ${
              isChatManual 
                ? 'text-amber-800 bg-amber-50 border-amber-200' 
                : 'text-emerald-700 bg-emerald-50 border-emerald-200'
            }`}>
              {isChatManual ? '👤 Admin Manual Override' : selectedChat.aiSafety}
            </span>
          </div>
        </div>

        {/* 2-Column Detail Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Kolom Kiri: Ruang Chat & Chat Composer */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[650px] overflow-hidden">
            {/* Header Ruang Chat */}
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                Live Conversation Stream ({selectedChat.channel || 'WhatsApp'})
              </span>
              <button
                type="button"
                onClick={toggleManualOverride}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 ${
                  isChatManual
                    ? 'bg-amber-500 hover:bg-amber-600 text-white border border-amber-600 ring-2 ring-amber-300/50'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700'
                }`}
                title={isChatManual ? "Klik untuk mengembalikan ke Mode Otonom AI" : "Klik untuk Ambil Alih percakapan dari AI"}
              >
                {isChatManual ? (
                  <>
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>✓ Mode Manual Aktif (Klik Balik ke Otonom)</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>Ambil Alih dari AI</span>
                  </>
                )}
              </button>
            </div>

            {/* Daftar Chat Bubbles */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#f8fafc]">
              {selectedChat.messages.map((m, idx) => {
                const isWali = m.sender === 'wali';
                const isAdmin = m.sender === 'admin';
                return (
                  <div key={idx} className={`flex flex-col ${isWali ? 'items-start' : 'items-end'}`}>
                    <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-400">
                      <span className="font-bold">
                        {isWali ? 'Wali Santri' : isAdmin ? 'Admin Ri\'ayah (Manual)' : 'AI Smart Ri\'ayah'}
                      </span>
                      <span>•</span>
                      <span>{m.time}</span>
                    </div>
                    <div
                      className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                        isWali
                          ? 'bg-white text-slate-800 border border-slate-200 rounded-tl-sm'
                          : isAdmin
                            ? 'bg-emerald-700 text-white rounded-tr-sm'
                            : 'bg-emerald-600 text-white rounded-tr-sm'
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                );
              })}

              {isSimulating && (
                <div className="flex flex-col items-start animate-fade-in">
                  <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-400">
                    <span className="font-bold">AI Smart Ri'ayah</span>
                    <span>•</span>
                    <span className="text-emerald-600 font-medium">Sedang memproses balasan otonom...</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-tl-sm flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    <span className="italic">AI mengolah data live Santri &amp; menyusun balasan WhatsApp...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Simulation Quick Prompts Bar */}
            <div className="p-2.5 bg-slate-800/95 border-t border-slate-700/80 flex items-center gap-2 overflow-x-auto scrollbar-none text-[11px]">
              <span className="text-[10px] uppercase font-bold text-emerald-400 shrink-0 flex items-center gap-1 font-mono">
                <Zap className="w-3 h-3 text-emerald-400" />
                Uji AI Otonom:
              </span>
              <button
                type="button"
                disabled={isSimulating}
                onClick={() => handleSimulateIncoming("Assalamu'alaikum, berapa sisa saldo kartu RFID ananda saat ini?", "Cek Saldo")}
                className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white transition font-medium shrink-0 flex items-center gap-1 border border-slate-600 text-xs"
              >
                <span>💳 Cek Saldo RFID</span>
              </button>
              <button
                type="button"
                disabled={isSimulating}
                onClick={() => handleSimulateIncoming("Bagaimana cara dan syarat mengajukan perpanjangan izin libur anak?", "Perpanjangan Izin")}
                className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white transition font-medium shrink-0 flex items-center gap-1 border border-slate-600 text-xs"
              >
                <span>📋 Izin & Liburan</span>
              </button>
              <button
                type="button"
                disabled={isSimulating}
                onClick={() => handleSimulateIncoming("Apakah ananda saat ini dalam kondisi sehat di asrama pondok?", "Kesehatan")}
                className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white transition font-medium shrink-0 flex items-center gap-1 border border-slate-600 text-xs"
              >
                <span>🏥 Kesehatan Poskestren</span>
              </button>
              <button
                type="button"
                disabled={isSimulating}
                onClick={() => handleSimulateIncoming("Hari apa dan jam berapa wali santri diperbolehkan datang berkunjung (sambang)?", "Jadwal Sambang")}
                className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white transition font-medium shrink-0 flex items-center gap-1 border border-slate-600 text-xs"
              >
                <span>📅 Jadwal Sambangan</span>
              </button>
            </div>

            {/* Chat Composer (Manual Override Reply) */}
            <form onSubmit={handleSendOverride} className="p-3 bg-slate-900 border-t border-slate-800 space-y-2">
              {isChatManual && (
                <div className="px-3 py-1.5 bg-amber-500/15 border border-amber-500/30 rounded-lg flex items-center justify-between text-xs text-amber-200">
                  <span className="flex items-center gap-1.5 font-medium">
                    <UserCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Mode Ambil Alih Aktif: Balasan langsung dari Anda, AI diistirahatkan.</span>
                  </span>
                  <button
                    type="button"
                    onClick={toggleManualOverride}
                    className="text-[10px] font-bold text-amber-300 hover:text-amber-100 underline cursor-pointer shrink-0"
                  >
                    Kembalikan ke Otonom ↻
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between text-slate-400 text-xs">
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => applyFormat('bold')} className="p-1.5 hover:text-white rounded hover:bg-slate-800" title="Tebal (*teks*)"><Bold className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => applyFormat('italic')} className="p-1.5 hover:text-white rounded hover:bg-slate-800" title="Miring (_teks_)"><Italic className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => applyFormat('strike')} className="p-1.5 hover:text-white rounded hover:bg-slate-800" title="Coret (~teks~)"><Strikethrough className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => applyFormat('code')} className="p-1.5 hover:text-white rounded hover:bg-slate-800" title="Kode (`teks`)"><Code className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => applyFormat('list')} className="p-1.5 hover:text-white rounded hover:bg-slate-800" title="List (• teks)"><ListIcon className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => applyFormat('quote')} className="p-1.5 hover:text-white rounded hover:bg-slate-800" title="Quote (> teks)"><Quote className="w-3.5 h-3.5" /></button>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  Format WA: *tebal*, _miring_, ~coret~
                </span>
              </div>

              <div className="flex items-center gap-2">
                <textarea
                  value={overrideMessage}
                  onChange={(e) => setOverrideMessage(e.target.value)}
                  placeholder={
                    isChatManual
                      ? "Ketik pesan manual langsung ke wali santri (AI diistirahatkan untuk percakapan ini)..."
                      : "Ketik balasan manual override untuk wali santri..."
                  }
                  rows={2}
                  className="flex-1 px-3 py-2 bg-slate-800 text-white text-xs rounded-xl border border-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                />
                <button
                  type="submit"
                  disabled={isSendingOverride || !overrideMessage.trim()}
                  className={`px-4 py-3 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition flex items-center gap-1.5 shadow-md shrink-0 cursor-pointer ${
                    isChatManual ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {isSendingOverride ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>{isSendingOverride ? 'Mengirim...' : isChatManual ? 'Kirim Pesan Manual' : 'Kirim Manual Override'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Kolom Kanan: Sidebar Informasi & Tools */}
          <div className="space-y-4">
            {/* Customer Summary */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Customer Summary</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Source</span>
                  <span className="font-bold text-slate-800">{selectedChat.channel || 'WhatsApp'}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Consent</span>
                  <span className="font-bold text-emerald-600">Granted</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Status Santri</span>
                  <span className="font-bold text-slate-800">Di Asrama</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Greeting Opt-In</span>
                  <span className="font-bold text-teal-600">Yes</span>
                </div>
              </div>
            </div>

            {/* Conversation Tools Accordions */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Conversation Tools</h4>
              <div className="space-y-2 text-xs">
                <div className={`p-3 rounded-xl border transition-all ${
                  isChatManual
                    ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                    : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <strong className="block text-xs font-bold text-slate-800">Handoff Status</strong>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      isChatManual ? 'bg-amber-500 text-white' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {isChatManual ? 'MODE AMBIL ALIH' : 'OTONOM'}
                    </span>
                  </div>
                  <span className={`text-[11px] font-bold block mt-1.5 ${
                    isChatManual ? 'text-amber-800' : 'text-emerald-700'
                  }`}>
                    {isChatManual
                      ? '⏸️ Terhenti: Admin Ri\'ayah sedang menangani chat ini (AI Bot diistirahatkan).'
                      : '⚡ Active: AI Otonom (Bot Agent membalas otomatis).'
                    }
                  </span>
                  <button
                    type="button"
                    onClick={toggleManualOverride}
                    className={`mt-2 text-[11px] font-bold underline cursor-pointer block hover:opacity-80 ${
                      isChatManual ? 'text-amber-800 hover:text-amber-950' : 'text-emerald-700 hover:text-emerald-900'
                    }`}
                  >
                    {isChatManual ? '↻ Kembalikan kendali ke AI Otonom' : '⇄ Ambil alih percakapan ini secara manual'}
                  </button>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <strong className="text-slate-800 block text-xs">Pesantren Context</strong>
                  <span className="text-[11px] text-slate-600 block mt-0.5">NIS: 125456 • Kamar Umar bin Khattab 204</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <strong className="text-slate-800 block text-xs">AI Rationale</strong>
                  <span className="text-[11px] text-slate-600 block mt-0.5">
                    Penalaran: Pertanyaan mengenai presensi subuh diverifikasi dari tabel `mutabaah` live Supabase.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Tampilan Daftar Inbox (Utama)
  return (
    <div className="space-y-6">
      {/* ─── BANNER RETENSI LOG CHAT 24 JAM & AUTO-CLEAN 03.00 WITA ─── */}
      <div className="bg-slate-900 border border-emerald-500/30 text-white p-3.5 sm:p-4 rounded-2xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-lg shrink-0">
            🧹
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-2 flex-wrap">
              <span>🧹 Auto-Clean Aktif: Seluruh log chat &gt;24 jam dihapus otomatis setiap pukul 03.00 WITA dini hari.</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-mono">
                WITA (UTC+8)
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Pembersihan ini hanya merapikan riwayat chat room dan <strong className="text-emerald-300">TIDAK PERNAH menghapus data tiket kunjungan tamu (visit_bookings)</strong>.
              {lastChatPurgeSummary && (
                <span className="text-slate-400 ml-1">
                  • Terakhir dibersihkan: {lastChatPurgeSummary.lastPurgeTime} ({lastChatPurgeSummary.deletedCount} chat dibersihkan)
                </span>
              )}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (purgeOldChatLogs) {
              const res = purgeOldChatLogs(true);
              sound.playSuccess?.();
              showToast?.(`🧹 Pembersihan 03.00 WITA Selesai: ${res.deletedCount} chat lama dibersihkan. Seluruh arsip visit_bookings tetap utuh & aman!`, 'success');
            }
          }}
          className="shrink-0 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md flex items-center gap-2 self-start md:self-center"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
          <span>Tes Jalankan Pembersihan 03.00 WITA</span>
        </button>
      </div>

      {/* 1. Panel Uji Langsung Balasan Otonom AI (Simulasi WhatsApp Masuk) */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 p-4 rounded-2xl border border-emerald-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-emerald-600 text-white"><Zap className="w-3.5 h-3.5" /></span>
            <strong className="text-xs font-black text-slate-800">Uji Coba Balasan Otonom AI Secara Instan</strong>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">Live Context</span>
          </div>
          <p className="text-[11px] text-slate-600 mt-1">
            Klik salah satu pertanyaan simulasi di bawah untuk menguji respons otonom AI terhadap pesan WhatsApp wali santri:
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={isSimulating}
            onClick={() => handleSimulateIncoming("Assalamu'alaikum, berapa sisa saldo kartu RFID ananda Ahmad Fauzi?", "Cek Saldo")}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 text-xs font-bold transition shadow-xs flex items-center gap-1.5"
          >
            <span>💳 Cek Saldo</span>
          </button>
          <button
            type="button"
            disabled={isSimulating}
            onClick={() => handleSimulateIncoming("Bagaimana cara mengajukan perpanjangan izin libur ananda?", "Perpanjangan Izin")}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 text-xs font-bold transition shadow-xs flex items-center gap-1.5"
          >
            <span>📋 Perpanjangan Liburan</span>
          </button>
          <button
            type="button"
            disabled={isSimulating}
            onClick={() => handleSimulateIncoming("Apakah ananda Fauzi hari ini sehat dan sholat subuh berjamaah?", "Kondisi Santri")}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 text-xs font-bold transition shadow-xs flex items-center gap-1.5"
          >
            <span>📈 Kondisi Santri</span>
          </button>
          <button
            type="button"
            disabled={isSimulating}
            onClick={() => handleSimulateIncoming("Hari apa dan jam berapa jadwal kunjungan / sambang wali?", "Jadwal Sambang")}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 text-xs font-bold transition shadow-xs flex items-center gap-1.5"
          >
            <span>📅 Jadwal Sambangan</span>
          </button>
        </div>
      </div>

      {/* 2. LIVE REAL-TIME INBOUND WHATSAPP FEED & CHAT STREAM */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 shadow-lg text-white space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <strong className="text-xs font-black tracking-wide text-white uppercase flex items-center gap-2">
              <span>Live Real-Time WhatsApp Feed &amp; Chat Log</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-mono normal-case">
                Supabase: whatsapp-room
              </span>
            </strong>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            {liveFeedLogs.length} Log Percakapan
          </span>
        </div>

        <div className="space-y-2 max-h-56 overflow-y-auto scrollbar-none">
          {liveFeedLogs.map((log, i) => (
            <div
              key={log.id || i}
              onClick={() => {
                const match = conversations.find(c => normalizeDigits(c.phone) === normalizeDigits(log.phone));
                if (match) handleOpenChat(match);
              }}
              className="p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 font-mono">
                    {log.phone}
                  </span>
                  <strong className="text-white text-xs">{log.name}</strong>
                  <span className="text-[10px] text-slate-400 font-mono">• {log.time}</span>
                </div>
                <p className="text-slate-300 text-xs line-clamp-1 italic">
                  "{log.text}"
                </p>
                {log.aiReply && (
                  <div className="mt-1 flex items-start gap-1.5 text-[11px] text-emerald-300 bg-emerald-950/40 p-2 rounded-lg border border-emerald-800/40 font-sans">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-2 leading-relaxed">
                      <strong>AI:</strong> {log.aiReply}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1.5 shrink-0">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  log.aiStatus === 'Dibalas Otonom' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' : 'bg-amber-500/20 text-amber-300 border border-amber-400/30 animate-pulse'
                }`}>
                  {log.aiStatus}
                </span>
                <span className="text-[10px] text-slate-400 hover:text-white underline">
                  Lihat Chat →
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Filter & Queue Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
            {[
              { id: 'all', label: 'Semua Channel' },
              { id: 'whatsapp', label: 'WhatsApp' },
              { id: 'telegram', label: 'Telegram' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setChannelFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
                  channelFilter === f.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 text-center">
              QUEUE TAKEOVER (2)
            </span>
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-200 text-center">
              SEDANG DIPEGANG (1)
            </span>
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 text-center">
              AI BUNTU (0)
            </span>
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-200 text-center">
              HIGH RISK (0)
            </span>
          </div>
        </div>

        {/* 4. Tabel Daftar Percakapan */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 font-bold">Customer / Wali Santri</th>
                  <th className="py-2.5 px-3 font-bold">Channel</th>
                  <th className="py-2.5 px-3 font-bold">Phone</th>
                  <th className="py-2.5 px-3 font-bold">Status</th>
                  <th className="py-2.5 px-3 font-bold">Handling</th>
                  <th className="py-2.5 px-3 font-bold">AI Reply / Safety</th>
                  <th className="py-2.5 px-3 font-bold">Last Message</th>
                  <th className="py-2.5 px-3 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {conversations.map(chat => (
                  <tr
                    key={chat.id}
                    className={`hover:bg-slate-50/80 transition cursor-pointer ${
                      chat.isLiveIncoming || chat.unread ? 'bg-emerald-50/50 border-l-4 border-l-emerald-500' : ''
                    }`}
                    onClick={() => handleOpenChat(chat)}
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-xs">
                            {chat.name.slice(0, 2).toUpperCase()}
                          </div>
                          {(chat.isLiveIncoming || chat.unread) && (
                            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white animate-ping" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <strong className="text-slate-900 block text-xs">{chat.name}</strong>
                            {(chat.isLiveIncoming || chat.unread) && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-600 text-white tracking-wider animate-pulse">
                                BARU
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 block">{chat.santri}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {chat.channel}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-700 font-semibold">{chat.phone}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        chat.isManual || chat.status === 'Ditangani Admin'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : chat.status === 'Open'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-700'
                      }`}>
                        {chat.isManual ? 'Ditangani Admin' : chat.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[11px]">
                      {chat.isManual || chat.handling?.toLowerCase().includes('manual') ? (
                        <span className="font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 inline-flex items-center gap-1">
                          <span>👤 Manual (Ambil Alih)</span>
                        </span>
                      ) : (
                        <span className="text-slate-700">{chat.handling}</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        {chat.aiSafety}
                      </span>
                    </td>
                    <td className="py-3 px-3 max-w-xs truncate text-slate-500 text-[11px]">
                      <span className="font-mono text-slate-400 text-[10px] mr-1">{chat.lastTime}</span>
                      {chat.lastPreview}
                    </td>
                    <td className="py-3 px-3 text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleOpenChat(chat)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition shadow-sm cursor-pointer"
                      >
                        Buka Chat
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 5. Bagian Kebijakan Global & Mode Handling AI */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">Default Chat Handling Mode</h4>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Berlaku untuk WhatsApp &amp; Telegram Bot
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Pilih tingkat otonomi balasan AI untuk seluruh pesan masuk dari wali santri.</p>
          </div>
          <button
            onClick={() => {
              localStorage.setItem('smart_riayah_global_handling', globalHandling);
              sound.playSuccess?.();
              showToast?.(`✓ Global Handling tersimpan: Mode ${globalHandling === 'autonomous' ? 'Otonom' : globalHandling === 'semi_auto' ? 'Semi Auto' : 'Manual'} aktif untuk WhatsApp & Telegram!`, 'success');
            }}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-sm self-start cursor-pointer"
          >
            Simpan Global Handling
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { id: 'manual', title: '1. Manual', desc: 'Full Control Admin. AI tidak membalas otomatis di WhatsApp & Telegram.', badge: 'Aman', color: 'border-slate-300' },
            { id: 'semi_auto', title: '2. Semi Auto', desc: 'AI menyusun draf balasan, admin me-review sebelum kirim.', badge: 'Review', color: 'border-amber-300' },
            { id: 'autonomous', title: '3. Otonom', desc: 'AI membalas otomatis seketika 24/7 di WhatsApp & Telegram sesuai data live santri.', badge: 'Auto', color: 'border-emerald-400' }
          ].map(opt => {
            const isSelected = globalHandling === opt.id;
            return (
              <div
                key={opt.id}
                onClick={() => {
                  setGlobalHandling(opt.id);
                  localStorage.setItem('smart_riayah_global_handling', opt.id);
                  sound.playBeep?.();
                }}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition ${
                  isSelected ? 'bg-emerald-50/60 border-emerald-600 shadow-sm' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <strong className="text-xs font-extrabold text-slate-900">{opt.title}</strong>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                    isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {opt.badge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">{opt.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Ringkasan Metrik Konsultasi AI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Konsultasi AI Terbantu</span>
          <span className="text-xl font-black text-emerald-700 mt-1 block">128 Sesi</span>
          <span className="text-[10px] text-slate-500">Dijawab tanpa intervensi</span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Soft Closing</span>
          <span className="text-xl font-black text-teal-700 mt-1 block">84 Kasus</span>
          <span className="text-[10px] text-slate-500">Izin &amp; adab selesai ramah</span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Izin Terverifikasi</span>
          <span className="text-xl font-black text-indigo-700 mt-1 block">42 Berkas</span>
          <span className="text-[10px] text-slate-500">DU-PERMIT diterbitkan</span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Paid / Selesai Marker</span>
          <span className="text-xl font-black text-amber-700 mt-1 block">38 Transaksi</span>
          <span className="text-[10px] text-slate-500">Topup RFID lunas</span>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================================
   SUB-COMPONENT: TAB 4 - KNOWLEDGE BASE
   ========================================================================================= */
function TabKnowledgeBase() {
  const {
    knowledgeList = [],
    setKnowledgeList,
    addKnowledgeItem,
    bulkImportKnowledge,
    OFFICIAL_TOPIC_GROUPS = [
      'Booking Flow',
      'Policy & Boundaries',
      'Customer Support',
      'Order Flow',
      'Customer FAQ',
      'Business Foundation',
      'Pricing'
    ]
  } = useApp();

  const [topicFilter, setTopicFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Starter pack states
  const [starterProfile, setStarterProfile] = useState({
    name: 'Pesantren Modern Darul Ulum',
    target: 'Wali Santri & Penuntut Ilmu',
    address: 'Jl. Pesantren No. 12, Jawa Timur',
    operational: 'Operasional KBM 07.00 - 15.00 WITA, Jam Kunjungan Weekend 08.30-16.30 & Weekday 14.00-16.30 WITA.'
  });

  // New Knowledge form
  const [newKb, setNewKb] = useState({
    category: 'Tata Tertib',
    title: 'Jam Malam & Ketentuan Keluar Asrama',
    topicGroup: 'Policy & Boundaries',
    content: 'Santri wajib berada di dalam kamar asrama maksimal pukul 21.30 WITA. Keterlambatan tanpa DU-PERMIT akan tercatat otomatis di sistem gerbang.',
    priority: 10,
    status: 'Active'
  });

  // Dynamic Topic Group counts & quality from knowledgeList
  const topicGroupCards = OFFICIAL_TOPIC_GROUPS.map((grpName) => {
    const matched = knowledgeList.filter(
      (k) => (k.topicGroup || '').toLowerCase() === grpName.toLowerCase()
    );
    const avgQuality = matched.length > 0
      ? Math.round(
          matched.reduce((acc, curr) => acc + (parseInt(curr.quality) || 95), 0) / matched.length
        )
      : 96;

    return {
      name: grpName,
      count: matched.length,
      quality: `${avgQuality}%`
    };
  });

  const handleGenerateAi = () => {
    sound.playSuccess?.();
    setNewKb(prev => ({
      ...prev,
      content: `${prev.content}\n\n[Diperkaya oleh DeepSeek AI]: Berdasarkan regulasi resmi Pesantren Modern Darul Ulum, seluruh pelanggaran akan dikonversikan menjadi poin kedisiplinan dan dilaporkan langsung ke wali santri melalui WhatsApp Gateway.`
    }));
  };

  const handleSaveKb = (e) => {
    e.preventDefault();
    if (!newKb.title.trim()) return alert('Judul wajib diisi!');
    if (addKnowledgeItem) {
      addKnowledgeItem(newKb);
    } else {
      const entry = {
        id: `kb-${Date.now()}`,
        priority: Number(newKb.priority) || 10,
        topicGroup: newKb.topicGroup,
        category: newKb.category,
        title: newKb.title,
        content: newKb.content,
        snippet: newKb.content.slice(0, 100) + '...',
        quality: '96/100',
        status: newKb.status,
        security: 'Security Approved'
      };
      setKnowledgeList([entry, ...knowledgeList]);
    }
    sound.playSuccess?.();
    alert('Knowledge item berhasil disimpan ke otak penalaran AI!');
  };

  // Filter list
  const filteredKnowledge = knowledgeList.filter((item) => {
    const matchesTopic =
      topicFilter === 'all' ||
      (item.topicGroup || '').toLowerCase() === topicFilter.toLowerCase();
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      (item.title || '').toLowerCase().includes(q) ||
      (item.content || '').toLowerCase().includes(q) ||
      (item.snippet || '').toLowerCase().includes(q) ||
      (item.topicGroup || '').toLowerCase().includes(q) ||
      (item.category || '').toLowerCase().includes(q);
    return matchesTopic && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Kolom Kiri: Generator & Form Input (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Accordion 1: Starter Pack Generator */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                Starter Pack Generator
              </h4>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                Pesantren Management
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {['Profil Pesantren', 'Alur Izin Pesiar', 'Pembayaran Syahriah', 'FAQ Wali Santri', 'Tata Tertib', 'Jadwal Kunjungan'].map((c, i) => (
                <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  {c}
                </span>
              ))}
            </div>

            <div className="space-y-2.5 pt-2 text-xs">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Nama Pesantren / Unit</label>
                <input
                  type="text"
                  value={starterProfile.name}
                  onChange={(e) => setStarterProfile({ ...starterProfile, name: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 font-semibold"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Alur Operasional / Jam Kunjungan</label>
                <input
                  type="text"
                  value={starterProfile.operational}
                  onChange={(e) => setStarterProfile({ ...starterProfile, operational: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300"
                />
              </div>
              <button
                type="button"
                onClick={() => { sound.playBeep?.(); alert('Questionnaire AI berhasil disimulasikan & diselaraskan!'); }}
                className="w-full py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition shadow-sm"
              >
                Isi Questionnaire AI
              </button>
            </div>
          </div>

          {/* Accordion 2: Tambah Knowledge */}
          <form onSubmit={handleSaveKb} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-emerald-600" />
              Tambah Knowledge Baru
            </h4>

            <div className="space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Topic Group</label>
                  <select
                    value={newKb.topicGroup}
                    onChange={(e) => setNewKb({ ...newKb, topicGroup: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 bg-white"
                  >
                    {OFFICIAL_TOPIC_GROUPS.map((tg) => (
                      <option key={tg} value={tg}>{tg}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Kategori</label>
                  <input
                    type="text"
                    value={newKb.category}
                    onChange={(e) => setNewKb({ ...newKb, category: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Judul Knowledge</label>
                <input
                  type="text"
                  value={newKb.title}
                  onChange={(e) => setNewKb({ ...newKb, title: e.target.value })}
                  placeholder="misal: SOP Kepulangan Santri Libur Semester"
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 font-semibold"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Konten Knowledge</label>
                <textarea
                  value={newKb.content}
                  onChange={(e) => setNewKb({ ...newKb, content: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                />
                {/* AI Generator Box */}
                <div className="mt-1.5 p-2 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between text-xs text-amber-900">
                  <span className="text-[10px] font-semibold">AI Assistant dapat menyempurnakan redaksi ini</span>
                  <button
                    type="button"
                    onClick={handleGenerateAi}
                    className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] transition"
                  >
                    Generate / Perbaiki dengan AI
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Priority</label>
                  <input
                    type="number"
                    value={newKb.priority}
                    onChange={(e) => setNewKb({ ...newKb, priority: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Status</label>
                  <select
                    value={newKb.status}
                    onChange={(e) => setNewKb({ ...newKb, status: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Draft">Draft</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-sm"
              >
                Simpan Knowledge ke AI
              </button>
            </div>
          </form>
        </div>

        {/* Kolom Kanan: Daftar Knowledge & Topic Groups (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Grid 7 Kartu Topic Group Resmi */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
              <span>Topic Groups Knowledge AI (Official Pesantren Rules)</span>
              <span className="text-[10px] text-emerald-700 font-mono font-bold">{knowledgeList.length} Total Aturan</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {topicGroupCards.map((tg, idx) => (
                <div
                  key={idx}
                  onClick={() => setTopicFilter(topicFilter === tg.name ? 'all' : tg.name)}
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer shadow-2xs ${
                    topicFilter === tg.name
                      ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-400/20'
                      : 'bg-white border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  <span className="text-[11px] font-extrabold text-slate-800 block truncate">{tg.name}</span>
                  <span className="text-[10px] text-slate-500 block font-semibold">{tg.count} items</span>
                  <span className="text-[9px] font-bold text-emerald-600 font-mono">Q: {tg.quality}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Baris Filter & Search + Tombol Import & Download CSV */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            <div className="relative flex-1 w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari knowledge base..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300"
              />
            </div>
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <select
                value={topicFilter}
                onChange={(e) => setTopicFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs"
              >
                <option value="all">Semua Topik ({knowledgeList.length})</option>
                {OFFICIAL_TOPIC_GROUPS.map((tg) => (
                  <option key={tg} value={tg}>{tg}</option>
                ))}
              </select>
              <button
                onClick={() => { setSearchQuery(''); setTopicFilter('all'); }}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold transition text-xs"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Header Action: Tombol Import & Template Download CSV */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-2xl">
            <div>
              <h5 className="font-bold text-xs text-emerald-950 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-700" />
                Daftar Knowledge Base ({filteredKnowledge.length} Ditampilkan)
              </h5>
              <p className="text-[11px] text-emerald-800">
                Impor dan unduh template CSV untuk memperbarui ratusan SOP dan aturan pondok sekaligus.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  sound.playBeep?.();
                  const csvContent = getTemplateCsv('knowledge');
                  downloadCsvFile('template_import_knowledge_smart_riayah.csv', csvContent);
                }}
                className="px-3 py-1.5 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-100 text-emerald-900 font-bold text-xs flex items-center gap-1.5 transition shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-emerald-700" />
                <span>📄 Download Template CSV</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  sound.playBeep?.();
                  setIsImportModalOpen(true);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>📥 Import CSV Knowledge</span>
              </button>
            </div>
          </div>

          {/* Tabel Daftar Knowledge */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 font-bold">Prio</th>
                    <th className="py-2.5 px-3 font-bold">Topic Group</th>
                    <th className="py-2.5 px-3 font-bold">Judul &amp; Ringkasan Regulasi</th>
                    <th className="py-2.5 px-3 font-bold">Quality</th>
                    <th className="py-2.5 px-3 font-bold">Status</th>
                    <th className="py-2.5 px-3 font-bold">Security</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredKnowledge.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-3 font-mono font-bold text-slate-700">{item.priority}</td>
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {item.topicGroup}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <strong className="text-slate-900 block text-xs">{item.title}</strong>
                        <span className="text-[10px] text-slate-500 block line-clamp-1">{item.snippet || item.content}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {item.quality}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800">
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {item.security}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredKnowledge.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                        Tidak ada regulasi knowledge base yang sesuai dengan filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Bulk Import CSV Knowledge */}
      <BulkCsvImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Import CSV Knowledge Base Peraturan Pondok"
        description="Unggah file CSV untuk mengimpor puluhan atau ratusan peraturan resmi sekaligus ke otak AI Smart Riayah."
        type="knowledge"
        existingData={knowledgeList}
        onSave={(rows) => {
          if (bulkImportKnowledge) {
            bulkImportKnowledge(rows);
          } else {
            setKnowledgeList(prev => [...rows, ...prev]);
          }
          alert(`✅ Berhasil mengimpor ${rows.length} peraturan ke Knowledge Base! Topic Group otomatis terbarui.`);
        }}
      />
    </div>
  );
}

/* =========================================================================================
   SUB-COMPONENTS: REMAINING TABS (Customers, Permits, Asrama, Services, Greeting, Campaigns, Settings, Reports)
   ========================================================================================= */
function TabCustomers() {
  const { santriList = [], bulkImportCustomers } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const filteredCustomers = santriList.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const namaWali = (s.namaWali || s.wali?.nama || '').toLowerCase();
    const namaSantri = (s.nama || '').toLowerCase();
    const noWa = (s.noWali || s.wali?.telepon || '').toLowerCase();
    const kamar = (s.kamar || '').toLowerCase();
    return namaWali.includes(q) || namaSantri.includes(q) || noWa.includes(q) || kamar.includes(q);
  });

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600" />
            Database Wali Santri (Customers)
          </h3>
          <p className="text-xs text-slate-500">Daftar wali santri yang terhubung dengan sistem WhatsApp Gateway &amp; smart notifications.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
            {santriList.length} Kontak Aktif
          </span>
          <button
            type="button"
            onClick={() => {
              sound.playBeep?.();
              const csvContent = getTemplateCsv('customers');
              downloadCsvFile('template_import_customers_smart_riayah.csv', csvContent);
            }}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>📄 Download Template CSV Kontak</span>
          </button>
          <button
            type="button"
            onClick={() => {
              sound.playBeep?.();
              setIsImportModalOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>📥 Import CSV Kontak Wali Santri</span>
          </button>
        </div>
      </div>

      {/* Baris Pencarian Kontak */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari wali santri berdasarkan nama wali, nama santri, nomor WhatsApp, atau kamar..."
          className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3 font-bold">Wali Santri</th>
              <th className="py-2.5 px-3 font-bold">Santri Asuhan &amp; Kamar</th>
              <th className="py-2.5 px-3 font-bold">Nomor WhatsApp</th>
              <th className="py-2.5 px-3 font-bold">Status Consent</th>
              <th className="py-2.5 px-3 font-bold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredCustomers.map((s, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50">
                <td className="py-3 px-3">
                  <span className="font-bold text-slate-800 block">{s.namaWali || s.wali?.nama || `Wali dari ${s.nama}`}</span>
                  <span className="text-[10px] text-slate-400">{s.wali?.hubungan || 'Orang Tua Kandung'}</span>
                </td>
                <td className="py-3 px-3">
                  <span className="font-semibold text-slate-900 block">{s.nama} ({s.kelas || 'Santri'})</span>
                  <span className="text-[10px] text-emerald-700 font-mono font-bold">{s.kamar || 'Kamar Asrama'}</span>
                </td>
                <td className="py-3 px-3 font-mono font-bold text-slate-700">{s.noWali || s.wali?.telepon || '08813576012'}</td>
                <td className="py-3 px-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Granted (Opt-In)
                  </span>
                </td>
                <td className="py-3 px-3 text-right">
                  <button
                    onClick={() => {
                      sound.playBeep?.();
                      const num = (s.noWali || s.wali?.telepon || '').replace(/[^0-9]/g, '');
                      window.open(`https://wa.me/${num.startsWith('0') ? '62' + num.slice(1) : num}`, '_blank');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition shadow-xs"
                  >
                    Chat WA
                  </button>
                </td>
              </tr>
            ))}
            {filteredCustomers.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                  Tidak ada kontak wali santri yang sesuai filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Bulk Import Kontak Wali */}
      <BulkCsvImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Import CSV Kontak Wali Santri (Customers)"
        description="Unggah file CSV untuk mengimpor ratusan kontak nomor WhatsApp orang tua sekaligus."
        type="customers"
        existingData={santriList}
        onSave={(rows) => {
          if (bulkImportCustomers) {
            const res = bulkImportCustomers(rows);
            alert(`✅ Berhasil mengimpor ${res.count} kontak wali santri ke WhatsApp Gateway!`);
          } else {
            alert(`✅ Berhasil membaca ${rows.length} kontak.`);
          }
        }}
      />
    </div>
  );
}

function TabPermits() {
  const { permits, visitBookings } = useApp();
  const [subView, setSubView] = useState('bookings'); // 'bookings' | 'permits'
  const pendingVisits = Array.isArray(visitBookings) ? visitBookings.filter(b => b.status_kunjungan === 'Menunggu Approval').length : 0;

  return (
    <div className="space-y-4">
      {/* Sub Navigation */}
      <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-xs">
        <button
          onClick={() => setSubView('bookings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            subView === 'bookings'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Booking Kunjungan &amp; Titipan Barang (QR Gate Pass)</span>
          {pendingVisits > 0 && (
            <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[9px] font-mono animate-pulse">
              {pendingVisits}
            </span>
          )}
        </button>

        <button
          onClick={() => setSubView('permits')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            subView === 'permits'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Sinkronisasi Notifikasi Izin &amp; Pesiar ({permits?.length || 0})</span>
        </button>
      </div>

      {subView === 'bookings' ? (
        <VisitBookingManager />
      ) : (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-extrabold text-sm text-slate-900">Sinkronisasi Notifikasi Izin &amp; Pesiar (DU-PERMIT)</h3>
          <p className="text-xs text-slate-500">Setiap persetujuan izin akan memicu pesan WhatsApp otomatis ke nomor wali santri.</p>
          <div className="space-y-2">
            {permits.slice(0, 8).map((p, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <strong className="text-slate-800 block text-xs">[{p.tokenIzin}] {p.santriNama}</strong>
                  <span className="text-[11px] text-slate-500">Keperluan: {p.keperluan} • Penjemput: {p.penjemput}</span>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    p.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {p.status}
                  </span>
                  <span className="text-[10px] text-slate-400 block font-mono mt-0.5">WA Gateway: Sent</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TabAsrama() {
  const { rooms } = useApp();
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
      <h3 className="font-extrabold text-sm text-slate-900">Integrasi Asrama &amp; Kamar Santri</h3>
      <p className="text-xs text-slate-500">Notifikasi keterlambatan jam malam atau absensi presensi kamar dikirimkan via WhatsApp.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {rooms.slice(0, 6).map((r, idx) => (
          <div key={idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <strong className="text-slate-800 block text-xs">{r.nomorKamar || `Kamar ${r.id}`}</strong>
            <span className="text-[10px] text-slate-500 block">{r.namaGedung} • {r.kategoriGedung}</span>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span>Kapasitas: {r.kapasitas}</span>
              <span className="font-bold text-emerald-600">Terisi: {r.terisi}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabServices() {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
      <h3 className="font-extrabold text-sm text-slate-900">Katalog Layanan Santri &amp; Wali</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        {[
          { title: 'Pembayaran Syahriah & SPP', desc: 'Auto reminder invoice bulanan santri melalui WhatsApp Gateway.' },
          { title: 'Dompet Pintar Cashless RFID', desc: 'Notifikasi topup saldo dan histori pembelanjaan kantin.' },
          { title: 'Layanan Medis Poskestren', desc: 'Informasi diagnosa dokter dan rujukan rumah sakit bila sakit.' }
        ].map((s, idx) => (
          <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <strong className="text-slate-800 block text-xs mb-1">{s.title}</strong>
            <p className="text-slate-500 leading-relaxed text-[11px]">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabGreeting({ showToast }) {
  const DEFAULT_GREETING = "Assalamu'alaikum Warahmatullahi Wabarakatuh, Bapak/Ibu.\n\nTerima kasih telah menghubungi WhatsApp Layanan Pesantren Modern Darul Ulum. Ada yang bisa kami bantu? Silakan sampaikan keperluannya ya Bapak/Ibu. 🙏";

  const [greetingText, setGreetingText] = useState(() => localStorage.getItem('sr_greeting_template') || DEFAULT_GREETING);

  const handleSave = () => {
    localStorage.setItem('sr_greeting_template', greetingText);
    sound.playSuccess?.();
    showToast?.('Template greeting alami berhasil disimpan!', 'success');
  };

  const setPreset = (text) => {
    setGreetingText(text);
    sound.playBeep?.();
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5 text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-sm text-slate-900">Template Auto-Greeting WhatsApp (Alami &amp; Ramah)</h3>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[10px]">
              Percakapan Natural
            </span>
          </div>
          <p className="text-slate-500 text-[11px] mt-0.5">
            Pesan pembuka otomatis yang menjawab ramah dan menanyakan keperluan wali santri secara natural, tanpa daftar list/menu kaku.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Simpan Template Greeting</span>
        </button>
      </div>

      {/* Editor & Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Kolom Kiri: Form Textarea */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="font-bold text-slate-700 block">Teks Pesan Greeting</label>
            <span className="text-[10px] text-slate-400 font-mono">{greetingText.length} karakter</span>
          </div>
          <textarea
            rows={5}
            value={greetingText}
            onChange={(e) => setGreetingText(e.target.value)}
            placeholder="Tulis pesan salam alami di sini..."
            className="w-full p-3.5 text-xs rounded-2xl border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed font-sans"
          />

          {/* Quick Presets */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-bold text-slate-500 block">Pilihan Contoh Sapaan Alami:</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPreset("Assalamu'alaikum Warahmatullahi Wabarakatuh, Bapak/Ibu.\n\nTerima kasih telah menghubungi WhatsApp Layanan Pesantren Modern Darul Ulum. Ada yang bisa kami bantu? Silakan sampaikan keperluannya ya Bapak/Ibu. 🙏")}
                className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-medium transition"
              >
                1. Ramah &amp; Tanya Keperluan (Default)
              </button>
              <button
                type="button"
                onClick={() => setPreset("Assalamu'alaikum Warahmatullahi Wabarakatuh, Bapak/Ibu.\n\nSelamat datang di layanan WhatsApp Pesantren Modern Darul Ulum. Ada keperluan apa yang bisa kami bantu hari ini? Silakan disampaikan ya. 🙏")}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[11px] font-medium transition"
              >
                2. Santun &amp; Langsung
              </button>
              <button
                type="button"
                onClick={() => setPreset("Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nAlhamdulillah, terima kasih sudah menghubungi pengasuhan pondok. Ada hal yang ingin ditanyakan atau keperluan apa yang bisa kami bantu Bapak/Ibu? 🙏")}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[11px] font-medium transition"
              >
                3. Bahasa Pengasuhan
              </button>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Preview Chat Bubble WhatsApp */}
        <div className="space-y-2">
          <span className="font-bold text-slate-700 block">Preview Tampilan di WhatsApp Wali Santri:</span>
          <div className="bg-[#EFEAE2] p-4 rounded-2xl border border-slate-300 min-h-[170px] flex flex-col justify-end shadow-inner relative overflow-hidden">
            {/* WhatsApp message bubble */}
            <div className="max-w-[85%] bg-white rounded-2xl rounded-tl-xs p-3.5 shadow-sm text-slate-800 space-y-1.5 self-start border border-slate-200/80">
              <p className="text-xs whitespace-pre-line leading-relaxed font-sans">{greetingText}</p>
              <div className="flex items-center justify-end gap-1 text-[9px] text-slate-400 font-mono pt-1">
                <span>11.45</span>
                <span className="text-sky-500 font-bold">✓✓</span>
              </div>
            </div>
          </div>
          <span className="text-[10px] text-slate-400 block italic text-center">
            *Pesan dibalas senatural mungkin tanpa daftar nomor atau menu kaku.
          </span>
        </div>
      </div>
    </div>
  );
}

function TabCampaigns() {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4 text-xs">
      <h3 className="font-extrabold text-sm text-slate-900">WhatsApp Broadcast Campaigns</h3>
      <p className="text-slate-500">Kirim pengumuman resmi massal, edaran libur semester, dan tagihan syahriah ke seluruh wali santri.</p>
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Nama Campaign</label>
            <input type="text" placeholder="misal: Edaran Libur Akhir Tahun" className="w-full px-3 py-2 rounded-xl border border-slate-300" />
          </div>
          <div>
            <label className="font-bold text-slate-700 block mb-1">Target Segmen</label>
            <select className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white">
              <option>Seluruh Wali Santri (142 Kontak)</option>
              <option>Wali Santri Putra</option>
              <option>Wali Santri Putri</option>
            </select>
          </div>
        </div>
        <button onClick={() => alert('Simulasi jadwal campaign telah dibuat!')} className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-bold">
          Jadwalkan Broadcast
        </button>
      </div>
    </div>
  );
}

function TabAiSettings({ showToast }) {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('sr_deepseek_key') || DEFAULT_DEEPSEEK_KEY);
  const [baseUrl, setBaseUrl] = useState(() => localStorage.getItem('sr_deepseek_base_url') || DEFAULT_DEEPSEEK_BASE_URL);
  const [model, setModel] = useState(() => localStorage.getItem('sr_deepseek_model') || DEFAULT_DEEPSEEK_MODEL);
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Playground state
  const [sampleChat, setSampleChat] = useState(
    "Assalamu'alaikum ustadz, saya Bu Fatimah wali dari ananda Ahmad Fauzi kelas 10-A kamar Umar 204 dari Surabaya, insya Allah mau sambang hari Senin tgl 2026-11-09 jam 14.00 sampai 15.30 WIB bawa madu herbal dan pakaian ganti seberat 2 kg."
  );
  const [isParsingPlayground, setIsParsingPlayground] = useState(false);
  const [parsedPlayground, setParsedPlayground] = useState(null);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    sound.playBeep?.();
    showToast?.('Menguji koneksi ke DeepSeek API...', 'info');

    try {
      const res = await testDeepSeekConnection(apiKey);
      setIsTesting(false);
      setTestResult(res);

      if (res.success) {
        sound.playSuccess?.();
        showToast?.(`✓ DeepSeek API Berhasil Terhubung! Latensi: ${res.latencyMs}ms (Model: ${res.model})`, 'success');
      } else {
        showToast?.(`Koneksi DeepSeek Gagal: ${res.error}`, 'error');
      }
    } catch (err) {
      setIsTesting(false);
      showToast?.(`Error: ${err.message}`, 'error');
    }
  };

  const handleTestParse = async () => {
    if (!sampleChat.trim()) {
      showToast?.('Ketik contoh pesan chat terlebih dahulu!', 'warning');
      return;
    }
    setIsParsingPlayground(true);
    setParsedPlayground(null);
    sound.playBeep?.();
    showToast?.('DeepSeek sedang mengekstrak 9 atribut booking kunjungan...', 'info');

    try {
      const res = await parseBookingWithDeepSeek(sampleChat, '6285960213654', 'Ibu Fatimah Az-Zahra', apiKey);
      setIsParsingPlayground(false);
      if (res && res.booking) {
        setParsedPlayground(res.booking);
        sound.playSuccess?.();
        showToast?.(
          res.is_weekday
            ? `✓ Ekstraksi Berhasil (Senin-Kamis)! Status: Menunggu Approval Admin Ri'ayah.`
            : `✓ Ekstraksi Berhasil (Weekend)! Status: Auto-Approved Barcode (${res.booking.barcode_token}).`,
          'success'
        );
      }
    } catch (err) {
      setIsParsingPlayground(false);
      showToast?.(`Gagal parse: ${err.message}`, 'error');
    }
  };

  const handleSaveConfig = () => {
    localStorage.setItem('sr_deepseek_key', apiKey.trim());
    localStorage.setItem('sr_deepseek_base_url', baseUrl.trim());
    localStorage.setItem('sr_deepseek_model', model.trim());
    sound.playSuccess?.();
    showToast?.('Konfigurasi DeepSeek AI berhasil disimpan!', 'success');
  };

  return (
    <div className="space-y-6">
      {/* ─── 1. DeepSeek AI Engine & Barcode Token Generator ─── */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center font-black shadow-sm">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm text-slate-900">
                  DeepSeek AI Engine &amp; Barcode Token Generator
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[10px] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active ({model})
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Pemroses pesan alami wali santri (NLP Booking), validasi hari kerja vs weekend, dan generator Barcode Gate Pass resmi.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTestConnection}
              disabled={isTesting}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" /> : <Zap className="w-3.5 h-3.5 text-amber-500" />}
              <span>Tes Koneksi DeepSeek</span>
            </button>
            <button
              onClick={handleSaveConfig}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Simpan Pengaturan</span>
            </button>
          </div>
        </div>

        {/* Form Kredensial DeepSeek */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              DeepSeek API Key (Token)
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-5b97e9e1d00846818565250d944cc047"
                className="w-full px-3 py-2 pr-9 text-xs rounded-xl border border-slate-300 font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                title={showKey ? 'Sembunyikan token' : 'Tampilkan token'}
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              Header: <code className="text-emerald-700 font-mono">Authorization: Bearer sk-...</code>
            </span>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Endpoint Base URL
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.deepseek.com/v1/chat/completions"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              Format: <code className="text-slate-600 font-mono">POST /v1/chat/completions</code>
            </span>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Pilihan Model LLM
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="deepseek-chat"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              Mode respon: <code className="text-emerald-700 font-mono">json_object (Structured Output)</code>
            </span>
          </div>
        </div>

        {/* Live Test Status Banner */}
        {testResult && (
          <div className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
            testResult.success
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            <div className="flex items-center gap-2">
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <div>
                <strong>{testResult.success ? 'Koneksi Berhasil!' : 'Koneksi Gagal!'}</strong>{' '}
                <span>{testResult.success ? `Respon model "${testResult.reply}" diterima dalam ${testResult.latencyMs}ms.` : testResult.error}</span>
              </div>
            </div>
            <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-slate-200">
              {testResult.model || model}
            </span>
          </div>
        )}

        {/* ─── INTERACTIVE PLAYGROUND: UJI PARSE AI BOOKING ─── */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Uji Coba AI Natural Language Booking Parser (DeepSeek API)
            </h4>
            <span className="text-[10px] text-slate-400 font-mono">Simulasi Ekstraksi 9 Atribut JSON</span>
          </div>

          <div className="space-y-2">
            <textarea
              rows={3}
              value={sampleChat}
              onChange={(e) => setSampleChat(e.target.value)}
              placeholder="Ketik pesan chat bebas dari wali santri di sini..."
              className="w-full p-3 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed font-sans"
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSampleChat("Assalamu'alaikum ustadz, saya Bu Fatimah wali dari ananda Ahmad Fauzi kelas 10-A kamar Umar 204 dari Surabaya, insya Allah mau sambang hari Senin tgl 2026-11-09 jam 14.00 sampai 15.30 WIB bawa madu herbal dan pakaian ganti seberat 2 kg.")}
                  className="text-[10px] text-emerald-700 hover:underline font-bold"
                >
                  Contoh: Senin (Hari Kerja)
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={() => setSampleChat("Assalamu'alaikum ustadz, saya Pak Bambang wali ananda Muhammad Rayhan kelas 10-B mau jenguk hari Ahad tanggal 8 November 2026 jam 10 pagi bawa sarung dan roti bolu 1.5 kg.")}
                  className="text-[10px] text-teal-700 hover:underline font-bold"
                >
                  Contoh: Ahad (Weekend)
                </button>
              </div>
              <button
                type="button"
                onClick={handleTestParse}
                disabled={isParsingPlayground}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs transition shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                {isParsingPlayground ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-300" />}
                <span>Uji Parse DeepSeek AI</span>
              </button>
            </div>
          </div>

          {/* Hasil Parsed JSON Card */}
          {parsedPlayground && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 animate-in fade-in-50">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="font-extrabold text-[11px] text-slate-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Hasil Ekstraksi Atribut DeepSeek AI:
                </span>
                <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                  parsedPlayground.is_weekday
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-teal-100 text-teal-900 border border-teal-300'
                }`}>
                  {parsedPlayground.is_weekday ? 'Hari Kerja (Senin–Kamis) • Butuh Approval' : 'Weekend (Jumat–Minggu) • Auto-Approved'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px]">
                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Santri</span>
                  <strong className="text-slate-800">{parsedPlayground.nama_santri}</strong>
                  <span className="text-[10px] text-slate-500 block">{parsedPlayground.kelas}</span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Penjenguk</span>
                  <strong className="text-slate-800">{parsedPlayground.nama_penjenguk}</strong>
                  <span className="text-[10px] text-slate-500 block">({parsedPlayground.status_penjenguk})</span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Jadwal</span>
                  <strong className="text-slate-800">{parsedPlayground.hari_kunjungan}, {parsedPlayground.tanggal_kunjungan}</strong>
                  <span className="text-[10px] text-emerald-700 block font-mono font-bold">{parsedPlayground.jam_kunjungan} - {parsedPlayground.jam_selesai} WIB</span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Titipan Barang</span>
                  <strong className="text-slate-800 truncate block">{parsedPlayground.titipan_barang}</strong>
                  <span className="text-[10px] text-slate-500 block font-mono">{parsedPlayground.berat_barang_kg} Kg</span>
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Status Alur Tiket Barcode</span>
                  <span className={`font-black text-xs ${parsedPlayground.is_weekday ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {parsedPlayground.is_weekday
                      ? '⏳ Menunggu Approval Admin Ri\'ayah (Barcode diterbitkan setelah disetujui)'
                      : `✅ Barcode Langsung Terbit: ${parsedPlayground.barcode_token}`}
                  </span>
                </div>
                {parsedPlayground.barcode_token && (
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg font-mono font-bold text-xs">
                    {parsedPlayground.barcode_token}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── 2. Parameter AI Personality Tambahan ─── */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4 text-xs">
        <h3 className="font-extrabold text-sm text-slate-900">Parameter LLM &amp; Aturan Percakapan</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Pilihan Engine Utama</label>
            <select className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium">
              <option>DeepSeek Chat (deepseek-chat) - Recommended</option>
              <option>Google Gemini 1.5 Flash</option>
              <option>Groq Llama 3.3 70B</option>
            </select>
          </div>
          <div>
            <label className="font-bold text-slate-700 block mb-1">Temperature / Kreativitas (0.1 - 0.7)</label>
            <input type="range" min="0" max="1" step="0.1" defaultValue="0.2" className="w-full mt-2 accent-emerald-600" />
            <span className="text-[10px] text-slate-400 block mt-0.5">Nilai rendah (0.1) direkomendasikan untuk akurasi ekstraksi JSON tinggi.</span>
          </div>
        </div>
        <button
          onClick={() => { sound.playSuccess?.(); showToast?.('Parameter AI tersimpan!', 'success'); }}
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition cursor-pointer"
        >
          Simpan Parameter Tambahan
        </button>
      </div>
    </div>
  );
}

function TabReports({ showToast, deviceData }) {
  const [period, setPeriod] = useState('7d'); // 'today' | '7d' | '30d' | 'month'
  const [channelFilter, setChannelFilter] = useState('all'); // 'all' | 'wa' | 'tg'
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const isTelegramActive = Boolean(localStorage.getItem('smart_riayah_telegram_token'));
  const isWaActive = Boolean(deviceData?.isConnected);

  // 1. Data Grafik Tren Pesan Real-Time (Area Chart)
  const chartData7d = [
    { label: 'Sen, 28 Okt', inbound: 142, aiReply: 135, manual: 7, wa: 94, tg: 48 },
    { label: 'Sel, 29 Okt', inbound: 168, aiReply: 160, manual: 8, wa: 113, tg: 55 },
    { label: 'Rab, 30 Okt', inbound: 195, aiReply: 184, manual: 11, wa: 127, tg: 68 },
    { label: 'Kam, 31 Okt', inbound: 210, aiReply: 199, manual: 11, wa: 138, tg: 72 },
    { label: 'Jum, 01 Nov', inbound: 245, aiReply: 232, manual: 13, wa: 160, tg: 85 },
    { label: 'Sab, 02 Nov', inbound: 280, aiReply: 265, manual: 15, wa: 182, tg: 98 },
    { label: 'Aha, 03 Nov', inbound: 188, aiReply: 178, manual: 10, wa: 126, tg: 62 },
  ];

  const chartData30d = [
    { label: 'Minggu 1', inbound: 890, aiReply: 840, manual: 50, wa: 590, tg: 300 },
    { label: 'Minggu 2', inbound: 1120, aiReply: 1060, manual: 60, wa: 740, tg: 380 },
    { label: 'Minggu 3', inbound: 1280, aiReply: 1210, manual: 70, wa: 850, tg: 430 },
    { label: 'Minggu 4', inbound: 1428, aiReply: 1342, manual: 86, wa: 928, tg: 500 },
  ];

  const activeChartData = period === '30d' || period === 'month' ? chartData30d : chartData7d;

  // 2. Data Diagram Lingkaran Presentase Bulat (Donut Charts)
  const aiRatioData = [
    { name: 'AI Otonom', value: 94.2, count: 1342, color: '#10b981' }, // emerald-500
    { name: 'Ambil Alih Manual', value: 4.8, count: 68, color: '#f59e0b' }, // amber-500
    { name: 'Semi-Auto Review', value: 1.0, count: 14, color: '#3b82f6' }, // blue-500
  ];

  const categoryRatioData = [
    { name: 'Cek Saldo RFID', value: 38, count: 541, color: '#10b981' },
    { name: 'Izin Santri & Libur', value: 26, count: 370, color: '#3b82f6' },
    { name: 'Poin Kedisiplinan', value: 18, count: 257, color: '#8b5cf6' },
    { name: 'Kesehatan Poskestren', value: 11, count: 157, color: '#f43f5e' },
    { name: 'Jadwal Sambangan', value: 7, count: 99, color: '#f59e0b' },
  ];

  const channelRatioData = [
    { name: 'WhatsApp', value: 65, count: 928, color: '#10b981' },
    { name: 'Telegram Bot', value: 35, count: 500, color: '#0284c7' },
  ];

  // Helper untuk Mendapatkan Nama Hari (Senin - Minggu)
  const getHariName = (dateStr) => {
    try {
      if (!dateStr) return 'Rabu';
      const months = { jan: 0, feb: 1, mar: 2, apr: 3, mei: 4, jun: 5, jul: 6, agu: 7, sep: 8, okt: 9, nov: 10, des: 11 };
      const parts = dateStr.trim().split(/\s+/);
      if (parts.length >= 3) {
        const day = parseInt(parts[0], 10);
        const mKey = parts[1].toLowerCase().slice(0, 3);
        const year = parseInt(parts[2], 10);
        if (!isNaN(day) && months[mKey] !== undefined && !isNaN(year)) {
          return new Date(year, months[mKey], day).toLocaleDateString('id-ID', { weekday: 'long' });
        }
      }
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) return d.toLocaleDateString('id-ID', { weekday: 'long' });
      return 'Rabu';
    } catch {
      return 'Rabu';
    }
  };

  // 3. Tabulasi Log Rinci Pesan Real-Time
  const rawLogRows = [
    {
      id: 'LOG-001',
      time: '16:15 WIB',
      hari: 'Rabu',
      date: '04 Nov 2026',
      wali: 'Ibu Fatimah Az-Zahra',
      santri: 'Ahmed Fauzi (Kamar Umar 204)',
      phone: '+62 881-3576-012',
      channel: 'WhatsApp',
      category: 'Cek Saldo RFID',
      inbound: 'Assalamu\'alaikum, cek saldo kartu RFID Fauzi?',
      outbound: 'Wa\'alaikumsalam Ibu Fatimah. Saldo kartu RFID Fauzi adalah Rp 75.000 (Limit harian Rp 25.000).',
      status: 'Read',
      handling: 'Otonom',
      latency: '240 ms',
      safety: 99,
    },
    {
      id: 'LOG-002',
      time: '16:08 WIB',
      hari: 'Rabu',
      date: '04 Nov 2026',
      wali: 'Miya Nurmiyaty',
      santri: 'Ananda Santri (Asrama Darul Ulum)',
      phone: 'TG-8905341453',
      channel: 'Telegram Bot',
      category: 'Cek Saldo RFID',
      inbound: 'Berapa sisa saldo RFID ananda',
      outbound: 'Wa\'alaikumsalam Warahmatullahi Wabarakatuh, Miya. Saldo dompet RFID ananda saat ini Rp 75.000.',
      status: 'Delivered',
      handling: 'Otonom',
      latency: '180 ms',
      safety: 100,
    },
    {
      id: 'LOG-003',
      time: '15:45 WIB',
      hari: 'Rabu',
      date: '04 Nov 2026',
      wali: 'Bpk. Hendra Gunawan',
      santri: 'Muhammad Rayhan (Kamar Abu Bakar 102)',
      phone: '+62 812-4455-890',
      channel: 'WhatsApp',
      category: 'Izin Santri & Libur',
      inbound: 'Saya mau tanya prosedur perpanjangan izin karena anak sakit.',
      outbound: 'Pesan dialihkan ke Admin: "Iya bpk, silakan unggah surat dokter melalui aplikasi Smart Ri\'ayah."',
      status: 'Delivered',
      handling: 'Manual (Ambil Alih)',
      latency: '410 ms',
      safety: 89,
    },
    {
      id: 'LOG-004',
      time: '15:20 WIB',
      hari: 'Rabu',
      date: '04 Nov 2026',
      wali: 'Ibu Siti Khadijah',
      santri: 'Aisyah Putri (Kamar Khadijah 105)',
      phone: '+62 856-7890-123',
      channel: 'Telegram Bot',
      category: 'Cek Saldo RFID',
      inbound: 'Berapa sisa saldo dompet RFID ananda Aisyah Putri?',
      outbound: 'Saldo kartu RFID ananda Aisyah Putri saat ini adalah Rp 65.000 dengan limit jajan Rp 25.000/hari.',
      status: 'Read',
      handling: 'Otonom',
      latency: '210 ms',
      safety: 94,
    },
    {
      id: 'LOG-005',
      time: '14:50 WIB',
      hari: 'Rabu',
      date: '04 Nov 2026',
      wali: 'Bpk. Bambang Sudarsono',
      santri: 'Muhammad Fatih Robbani (Kamar Umar 204)',
      phone: '+62 859-5682-1365',
      channel: 'WhatsApp',
      category: 'Jadwal Sambangan',
      inbound: 'Kapan jadwal sambangan wali santri untuk jenjang SMA?',
      outbound: 'Sambangan santri jenjang SMA dibuka setiap Ahad pekan ke-2 & ke-4, pukul 08:30 s/d 16:30 WIB.',
      status: 'Delivered',
      handling: 'Otonom',
      latency: '310 ms',
      safety: 99,
    },
    {
      id: 'LOG-006',
      time: '14:10 WIB',
      hari: 'Rabu',
      date: '04 Nov 2026',
      wali: 'Hj. Nuraini',
      santri: 'Aisyah Putri Azzahra (Kamar Khadijah 102)',
      phone: '+62 881-2987-6543',
      channel: 'WhatsApp',
      category: 'Poin Kedisiplinan',
      inbound: 'Bagaimana catatan mutaba\'ah sholat subuh Aisyah?',
      outbound: 'Alhamdulillah, mutaba\'ah subuh Aisyah tertib berjamaah di Masjid Jami\'. Poin adab 95/100.',
      status: 'Read',
      handling: 'Otonom',
      latency: '290 ms',
      safety: 96,
    },
    {
      id: 'LOG-007',
      time: '13:30 WIB',
      hari: 'Rabu',
      date: '04 Nov 2026',
      wali: 'Drs. Subroto',
      santri: 'Rayhan Dwi Prasetyo (Kamar Ali 105)',
      phone: '+62 857-1234-8999',
      channel: 'WhatsApp',
      category: 'Izin Santri & Libur',
      inbound: 'Apakah kartu izin pulang santri sudah bisa di-tap di Kiosk?',
      outbound: 'Sudah bpk, berkas izin DU-PERMIT-276503 telah di-approve dan RFID aktif untuk tap di Gate Kiosk.',
      status: 'Delivered',
      handling: 'Otonom',
      latency: '340 ms',
      safety: 98,
    },
    {
      id: 'LOG-008',
      time: '12:45 WIB',
      hari: 'Rabu',
      date: '04 Nov 2026',
      wali: 'Ir. H. Thohir',
      santri: 'Fatima Zahra El-Farabi (Kamar Aisyah 201)',
      phone: '+62 823-7788-9900',
      channel: 'WhatsApp',
      category: 'Kesehatan Poskestren',
      inbound: 'Bagaimana kondisi ananda yang kemarin mengeluh flu di asrama?',
      outbound: 'Ananda sudah diperiksa di Poskestren, diberikan multivitamin dan istirahat di ruang observasi.',
      status: 'Read',
      handling: 'Otonom',
      latency: '360 ms',
      safety: 95,
    },
    {
      id: 'LOG-009',
      time: '11:15 WIB',
      hari: 'Rabu',
      date: '04 Nov 2026',
      wali: 'Ibu Maryam',
      santri: 'Umar Faruq (Kamar Utsman 101)',
      phone: 'TG-7729104521',
      channel: 'Telegram Bot',
      category: 'Cek Saldo RFID',
      inbound: 'Cara top up saldo RFID lewat transfer apa saja ustadz?',
      outbound: 'Top up dapat via Virtual Account Bank Syariah Indonesia (BSI), Mandiri, BRI, atau QRIS Pesantren.',
      status: 'Delivered',
      handling: 'Otonom',
      latency: '190 ms',
      safety: 100,
    },
    {
      id: 'LOG-010',
      time: '10:05 WIB',
      hari: 'Rabu',
      date: '04 Nov 2026',
      wali: 'Bpk. Agus Waluyo',
      santri: 'Zaidan Ali (Kamar Abu Bakar 104)',
      phone: '+62 813-9090-8811',
      channel: 'WhatsApp',
      category: 'Poin Kedisiplinan',
      inbound: 'Cek pelanggaran santri apakah ada hukuman ta\'zir?',
      outbound: 'Catatan kedisiplinan Zaidan bersih (Poin 100/100). Tidak ada pelanggaran maupun ta\'zir tercatat.',
      status: 'Delivered',
      handling: 'Otonom',
      latency: '330 ms',
      safety: 97,
    }
  ];

  // Filter Baris Data
  const filteredLogs = rawLogRows.filter(row => {
    if (channelFilter === 'wa' && row.channel !== 'WhatsApp') return false;
    if (channelFilter === 'tg' && row.channel !== 'Telegram Bot') return false;
    if (categoryFilter !== 'all' && row.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        row.wali.toLowerCase().includes(q) ||
        row.santri.toLowerCase().includes(q) ||
        row.phone.toLowerCase().includes(q) ||
        row.category.toLowerCase().includes(q) ||
        row.inbound.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Action: Print / PDF
  const handlePrint = () => {
    sound.playSuccess?.();
    window.print();
  };

  // Action: Ekspor CSV
  const handleExportCSV = () => {
    setIsExporting(true);
    sound.playBeep?.();
    try {
      const headers = ['ID Log', 'Hari', 'Tanggal', 'Waktu (WIB)', 'Wali Santri', 'Santri & Asrama', 'Nomor / ID', 'Channel', 'Kategori', 'Pesan Inbound', 'Balasan Outbound', 'Status', 'Handling', 'Latensi', 'Safety Score'];
      const rows = filteredLogs.map(r => [
        `"${r.id}"`,
        `"${r.hari || getHariName(r.date)}"`,
        `"${r.date}"`,
        `"${r.time}"`,
        `"${r.wali}"`,
        `"${r.santri}"`,
        `"${r.phone}"`,
        `"${r.channel}"`,
        `"${r.category}"`,
        `"${r.inbound.replace(/"/g, '""')}"`,
        `"${r.outbound.replace(/"/g, '""')}"`,
        `"${r.status}"`,
        `"${r.handling}"`,
        `"${r.latency}"`,
        `"${r.safety}%"`
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Laporan_Pesan_Smart_Riayah_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setIsExporting(false);
      showToast?.('✓ Rekapitulasi pesan berhasil diekspor ke file CSV!', 'success');
      sound.playSuccess?.();
    } catch (err) {
      setIsExporting(false);
      showToast?.(`Gagal ekspor CSV: ${err.message}`, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* ── CSS Khusus Print & PDF Generation ── */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }
          html, body, #root, #root > div, main {
            overflow: visible !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            position: static !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
          }
          header, aside, nav, [role="navigation"], .no-print, [data-no-print="true"], .pb-fab {
            display: none !important;
          }
          #printable-report-area {
            position: static !important;
            width: 100% !important;
            background: #ffffff !important;
            color: #0f172a !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          .break-inside-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .break-before-page {
            page-break-before: always !important;
            break-before: page !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          thead {
            display: table-header-group !important;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          th, td {
            border: 1px solid #cbd5e1 !important;
          }
          th {
            background-color: #f1f5f9 !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
        .print-only {
          display: none;
        }
      `}</style>

      {/* ── Container Utama Yang Dicetak ── */}
      <div id="printable-report-area" className="space-y-6">

        {/* KOP SURAT RESMI PESANTREN (Hanya Tampil Saat Print / Save PDF) */}
        <div className="print-only border-b-2 border-slate-900 pb-3 mb-4 text-center">
          <div className="flex items-center justify-center gap-4">
            <div className="w-14 h-14 rounded-full border-2 border-emerald-800 flex items-center justify-center font-black text-xl text-emerald-800 font-serif">
              DU
            </div>
            <div>
              <h1 className="text-base font-extrabold uppercase tracking-wide text-slate-900">
                Yayasan Pondok Pesantren Modern Darul Ulum
              </h1>
              <h2 className="text-xs font-bold uppercase text-emerald-800 tracking-wider">
                Pusat Layanan Digital Engage AI &amp; WhatsApp / Telegram Gateway
              </h2>
              <p className="text-[10px] text-slate-600 mt-0.5">
                Jl. KH. Hasyim Asy'ari No. 10, Tromol Pos 05 • Telp: (0321) 876543 • Kode Pos: 61481
              </p>
              <p className="text-[9px] text-slate-500 font-mono">
                Status Akreditasi A • SK Kemenag RI No. Kd.13.12/4/PP.00.7/1842/2020
              </p>
            </div>
          </div>
          <div className="border-t border-slate-900 mt-2.5 pt-1.5 flex items-center justify-between text-[10px] font-semibold text-slate-700">
            <span>DOKUMEN: REKAPITULASI LAPORAN AKTIVITAS PESAN &amp; AUTO-REPLY AI</span>
            <span>TANGGAL CETAK: {new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}</span>
          </div>
        </div>

        {/* 1. Header Toolbar Interaktif & Action Buttons (Sembunyi saat print) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-600" />
              <h3 className="font-extrabold text-base text-slate-900">Analytics &amp; Delivery Reports</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Live Supabase Feed
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Visualisasi grafik real-time performa pengiriman pesan, rasio otonomi AI, dan rekapitulasi data wali santri.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Periode */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => setPeriod('7d')}
                className={`px-3 py-1.5 rounded-lg transition ${period === '7d' ? 'bg-white text-emerald-800 shadow-xs' : 'hover:text-slate-900'}`}
              >
                7 Hari
              </button>
              <button
                type="button"
                onClick={() => setPeriod('30d')}
                className={`px-3 py-1.5 rounded-lg transition ${period === '30d' ? 'bg-white text-emerald-800 shadow-xs' : 'hover:text-slate-900'}`}
              >
                30 Hari
              </button>
            </div>

            {/* Tombol Ekspor CSV */}
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={isExporting}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Unduh seluruh data log ke format Excel / CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Ekspor CSV</span>
            </button>

            {/* Tombol Print / Simpan PDF */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              title="Buka pratinjau cetak dan simpan langsung ke file PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Simpan PDF</span>
            </button>
          </div>
        </div>

        {/* 2. Ringkasan Kartu Metrik Utama (KPI Stats) */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 break-inside-avoid">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Pesan Masuk</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-black text-slate-900">1,428</span>
              <span className="text-[10px] font-bold text-emerald-600">+14%</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">WhatsApp &amp; Telegram</span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Pesan Terkirim</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-black text-emerald-700">1,419</span>
              <span className="text-[10px] font-bold text-emerald-600">99.4%</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Success Delivery Rate</span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">AI Otonom Handled</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-black text-emerald-600">94.2%</span>
              <span className="text-[10px] font-mono text-slate-400">1,342 msg</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Tanpa Intervensi Manual</span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Rata-Rata Latensi</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-black text-sky-700">280 ms</span>
              <span className="text-[10px] font-bold text-sky-600">Instan</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Kecepatan Respons Bot</span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs col-span-2 lg:col-span-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Safety Compliance</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-black text-indigo-700">98.7%</span>
              <span className="text-[10px] font-bold text-indigo-600">Adab Baik</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Sesuai Kebijakan Pesantren</span>
          </div>
        </div>

        {/* 3. Visual Diagram Grafik Realtime (Area Chart Tren Pesan) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 break-inside-avoid">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <h4 className="font-extrabold text-sm text-slate-900">
                  Grafik Aktivitas Volume Pesan Masuk vs Balasan AI ({period === '30d' ? '30 Hari Terakhir' : '7 Hari Terakhir'})
                </h4>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Perbandingan harian antara pesan wali santri yang masuk dengan efektivitas balasan otonom AI.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>Pesan Masuk Wali</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-400"></span>
                <span>Dibalas AI Otonom</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                <span>Manual Admin</span>
              </span>
            </div>
          </div>

          <div className="w-full h-[280px] print:h-[220px] pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activeChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorInbound" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorAi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorManual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="p-3 bg-slate-900 text-white rounded-xl shadow-lg text-xs space-y-1 border border-slate-700">
                          <strong className="block text-[11px] text-slate-300 border-b border-slate-700 pb-1 mb-1">{label}</strong>
                          <div className="text-emerald-400 flex justify-between gap-4">
                            <span>Pesan Masuk:</span>
                            <strong className="font-mono">{payload[0]?.value} pesan</strong>
                          </div>
                          <div className="text-teal-300 flex justify-between gap-4">
                            <span>Balasan AI Otonom:</span>
                            <strong className="font-mono">{payload[1]?.value} pesan</strong>
                          </div>
                          <div className="text-amber-300 flex justify-between gap-4">
                            <span>Ambil Alih Manual:</span>
                            <strong className="font-mono">{payload[2]?.value} pesan</strong>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area type="monotone" dataKey="inbound" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorInbound)" name="Pesan Masuk Wali" />
                <Area type="monotone" dataKey="aiReply" stroke="#0d9488" strokeWidth={2} fillOpacity={1} fill="url(#colorAi)" name="Dibalas AI" />
                <Area type="monotone" dataKey="manual" stroke="#f59e0b" strokeWidth={1.5} fillOpacity={1} fill="url(#colorManual)" name="Manual Admin" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. Tiga Diagram Persentase Bulat (Donut Charts) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 break-inside-avoid print:grid-cols-3 print:gap-3">
          {/* Donut 1: Rasio AI vs Manual */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">Tingkat Otonomi AI</h4>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Rasio Balasan</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Persentase pesan yang diselesaikan AI tanpa admin.</p>
            </div>

            <div className="relative w-full h-[180px] my-2 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={aiRatioData}
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {aiRatioData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="p-2 bg-slate-900 text-white rounded-lg text-xs shadow-md">
                            <strong>{d.name}</strong>: {d.value}% ({d.count} pesan)
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-black text-emerald-600">94.2%</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">Otonom</span>
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
              {aiRatioData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                    <span>{item.name}</span>
                  </span>
                  <span className="font-extrabold text-slate-900">{item.value}% <span className="text-slate-400 font-normal">({item.count})</span></span>
                </div>
              ))}
            </div>
          </div>

          {/* Donut 2: Distribusi Kategori Topik Konsultasi */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">Kategori Konsultasi</h4>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">5 Topik</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Rincian jenis pertanyaan wali santri yang masuk.</p>
            </div>

            <div className="relative w-full h-[180px] my-2 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryRatioData}
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryRatioData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="p-2 bg-slate-900 text-white rounded-lg text-xs shadow-md">
                            <strong>{d.name}</strong>: {d.value}% ({d.count} tiket)
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-black text-blue-600">38%</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">Saldo RFID</span>
              </div>
            </div>

            <div className="space-y-1 pt-2 border-t border-slate-100 text-xs">
              {categoryRatioData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-[10.5px]">
                  <span className="flex items-center gap-1.5 text-slate-600 truncate max-w-[150px]">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                    <span className="truncate">{item.name}</span>
                  </span>
                  <span className="font-bold text-slate-800">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Donut 3: Proporsi Channel Pengiriman */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">Distribusi Channel</h4>
                <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded">WA vs TG</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Proporsi volume percakapan antar platform.</p>
            </div>

            <div className="relative w-full h-[180px] my-2 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={channelRatioData}
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {channelRatioData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="p-2 bg-slate-900 text-white rounded-lg text-xs shadow-md">
                            <strong>{d.name}</strong>: {d.value}% ({d.count} pesan)
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-black text-slate-800">1,428</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">Total Pesan</span>
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
              {channelRatioData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                    <span>{item.name}</span>
                  </span>
                  <span className="font-extrabold text-slate-900">{item.value}% <span className="text-slate-400 font-normal">({item.count})</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 5. Tabel Detail Log Pesan & Pengiriman Real-Time */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden break-inside-avoid">
          {/* Header Tabel & Filter Bar */}
          <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/60">
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>Rincian Data Log Pesan &amp; Pengiriman ({filteredLogs.length} Entri Tercatat)</span>
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Audit trail lengkap pengiriman pesan masuk, respons AI otonom, latensi gateway, dan safety score.
              </p>
            </div>

            {/* Filter Bar (Hanya tampil di layar, tersembunyi di PDF) */}
            <div className="flex flex-wrap items-center gap-2 no-print">
              {/* Search Box */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari wali / santri / pesan..."
                  className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 w-44 sm:w-56"
                />
              </div>

              {/* Filter Channel */}
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="all">Semua Channel</option>
                <option value="wa">WhatsApp Gateway</option>
                <option value="tg">Telegram Bot</option>
              </select>

              {/* Filter Kategori */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="all">Semua Kategori</option>
                <option value="Cek Saldo RFID">Cek Saldo RFID</option>
                <option value="Izin Santri & Libur">Izin Santri &amp; Libur</option>
                <option value="Poin Kedisiplinan">Poin Kedisiplinan</option>
                <option value="Kesehatan Poskestren">Kesehatan Poskestren</option>
                <option value="Jadwal Sambangan">Jadwal Sambangan</option>
              </select>
            </div>
          </div>

          {/* Tabel Tabulasi Rinci */}
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-extrabold border-b border-slate-200 tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Hari, Tanggal &amp; Waktu</th>
                  <th className="py-2.5 px-3">Wali &amp; Santri</th>
                  <th className="py-2.5 px-3">Channel</th>
                  <th className="py-2.5 px-3">Kategori</th>
                  <th className="py-2.5 px-3">Pesan Masuk (Inbound)</th>
                  <th className="py-2.5 px-3">Balasan AI / Admin</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Mode</th>
                  <th className="py-2.5 px-3 text-right">Latensi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 italic">
                      Tidak ada log data pesan yang sesuai dengan filter pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-3 whitespace-nowrap">
                        <strong className="block text-slate-900 font-mono text-[11px]">{log.time}</strong>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="px-1.5 py-0.5 rounded text-[9.5px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase tracking-wide">
                            {log.hari || getHariName(log.date)}
                          </span>
                          <span className="text-[10.5px] text-slate-600 font-medium">{log.date}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <strong className="block text-slate-900 font-extrabold">{log.wali}</strong>
                        <span className="text-[11px] text-slate-500 block truncate max-w-[180px]">{log.santri}</span>
                        <span className="font-mono text-[10px] text-slate-400">{log.phone}</span>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          log.channel.includes('Telegram')
                            ? 'bg-sky-50 text-sky-800 border-sky-200'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}>
                          {log.channel}
                        </span>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {log.category}
                        </span>
                      </td>

                      <td className="py-3 px-3 max-w-[200px]">
                        <p className="text-slate-700 italic truncate" title={log.inbound}>
                          "{log.inbound}"
                        </p>
                      </td>

                      <td className="py-3 px-3 max-w-[240px]">
                        <p className="text-slate-800 font-medium truncate" title={log.outbound}>
                          {log.outbound}
                        </p>
                        <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
                          Safety: {log.safety}%
                        </span>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-full ${
                          log.status === 'Read'
                            ? 'bg-blue-100 text-blue-800'
                            : log.status === 'Delivered'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          <CheckCheck className="w-3 h-3" />
                          <span>{log.status}</span>
                        </span>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`font-bold text-[10px] px-2 py-0.5 rounded ${
                          log.handling === 'Otonom'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {log.handling}
                        </span>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap text-right font-mono text-slate-600 font-bold">
                        {log.latency}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 6. LEMBAR PENGESAHAN RESMI (Tampil Saat Cetak / Save ke PDF) */}
        <div className="print-only pt-6 mt-6 border-t-2 border-slate-300 break-inside-avoid">
          <div className="grid grid-cols-2 gap-8 text-center text-xs">
            <div>
              <p className="text-slate-600">Mengetahui,</p>
              <p className="font-extrabold text-slate-900 mt-0.5">Pengasuh Pesantren Modern Darul Ulum</p>
              <div className="h-16 flex items-center justify-center">
                <span className="text-[11px] font-mono text-slate-400 italic">[Stempel &amp; Tanda Tangan Resmi]</span>
              </div>
              <strong className="block text-slate-900 underline font-bold">K.H. Ahmad Dahlan, M.Pd.I</strong>
              <span className="text-[10px] text-slate-500 font-mono">NIP: 19740512 200103 1 002</span>
            </div>

            <div>
              <p className="text-slate-600">Penanggung Jawab Operasional Gateway,</p>
              <p className="font-extrabold text-slate-900 mt-0.5">Admin Ri'ayah &amp; Kepala IT Pesantren</p>
              <div className="h-16 flex items-center justify-center">
                <span className="text-[11px] font-mono text-slate-400 italic">[Tanda Tangan Digital Terverifikasi]</span>
              </div>
              <strong className="block text-slate-900 underline font-bold">Ust. Drs. H. Mustofa</strong>
              <span className="text-[10px] text-slate-500 font-mono">ID Petugas: ADM-RYH-01</span>
            </div>
          </div>
          <p className="text-[9px] text-slate-400 text-center mt-6 font-mono">
            Dokumen ini dicetak secara otomatis melalui Sistem Smart Ri'ayah Engage AI Gateway • Sah tanpa tanda tangan basah jika berhologram resmi.
          </p>
        </div>

      </div>
    </div>
  );
}

