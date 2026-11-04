import React, { useState } from 'react';
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
  Eye,
  UserCheck
} from 'lucide-react';
import { sound } from '../../utils/audio';

export default function EngageAiWorkspace() {
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
    sendWhatsAppNotification
  } = useApp();

  // ─── Main Tabs Navigation ───
  const [activeTab, setActiveTab] = useState('dashboard');
  const [copiedText, setCopiedText] = useState(null);

  const copyToClipboard = (text, id = 'default') => {
    navigator.clipboard?.writeText(text);
    setCopiedText(id);
    sound.playBeep?.();
    setTimeout(() => setCopiedText(null), 2500);
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
      {/* ─── A. TOP BANNER CARD & PILL TABS ─── */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 rounded-2xl p-6 text-white shadow-lg border border-emerald-700/50 relative overflow-hidden">
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
              Kelola messaging channels Fonnte, notifikasi real-time wali santri, dan AI inbox pesantren dari satu dashboard terpadu.
            </p>
            <div className="flex items-center gap-2 mt-3 text-[11px] text-emerald-200/80 font-mono">
              <Clock className="w-3.5 h-3.5 text-emerald-300" />
              <span>Paket Aktif: <strong className="text-white">Smart Riayah Pro</strong> (Berakhir 16 Nov 2026 - <span className="text-emerald-300 font-bold">Sisa 12 Hari</span>)</span>
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
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── B. TAB 1: DASHBOARD ─── */}
      {activeTab === 'dashboard' && <TabDashboard onSwitchTab={setActiveTab} onCopy={copyToClipboard} copiedText={copiedText} />}

      {/* ─── C. TAB 2: CHANNELS ─── */}
      {activeTab === 'channels' && <TabChannels />}

      {/* ─── D. TAB 3: AI INBOX ─── */}
      {activeTab === 'inbox' && <TabAiInbox />}

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
      {activeTab === 'greeting' && <TabGreeting />}

      {/* ─── K. TAB 10: CAMPAIGNS ─── */}
      {activeTab === 'campaigns' && <TabCampaigns />}

      {/* ─── L. TAB 11: AI SETTINGS ─── */}
      {activeTab === 'ai_settings' && <TabAiSettings />}

      {/* ─── M. TAB 12: REPORTS ─── */}
      {activeTab === 'reports' && <TabReports />}
    </div>
  );
}

/* =========================================================================================
   SUB-COMPONENT: TAB 1 - DASHBOARD
   ========================================================================================= */
function TabDashboard({ onSwitchTab, onCopy, copiedText }) {
  const { isFonnteEnabled, fonnteTargetNumber, santriList } = useApp();

  return (
    <div className="space-y-6">
      {/* 1. Alert Banner Status Channel */}
      <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wide">Channel Perlu Perhatian</h4>
            <p className="text-xs text-amber-800 mt-0.5">
              Status gateway: <strong>{isFonnteEnabled ? 'Fonnte Connected & Standby' : 'Device Disconnected'}</strong>. Lakukan refresh atau scan QR ulang bila diperlukan untuk memastikan notifikasi wali santri lancar.
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
            onClick={() => sound.playBeep?.()}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold text-xs transition"
          >
            Refresh Status
          </button>
        </div>
      </div>

      {/* 2. Paket Engage AI Aktif (4 Summary Cards + Panel Report WA Campaign) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Nama Paket</span>
            <span className="text-sm font-extrabold text-slate-800 mt-1 block">Smart Riayah Pro</span>
            <span className="text-[10px] text-emerald-600 font-semibold">Enterprise Pesantren</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Status Subscription</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 mt-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Mulai Aktif</span>
            <span className="text-xs font-bold text-slate-700 mt-1 block">16 Okt 2026</span>
            <span className="text-[10px] text-slate-400 font-mono">10:00 WIB</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Berakhir</span>
            <span className="text-xs font-bold text-slate-700 mt-1 block">16 Nov 2026</span>
            <span className="inline-block mt-1 text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
              Sisa 12 Hari
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
          <span>Kalau wali santri bertanya akun mana yang aktif, admin bisa langsung copy nama akun atau nomor berikut dari dashboard ini.</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-sm border border-emerald-200">
              DU
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-sm text-slate-900">Pesantren Modern Darul Ulum Official</h4>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Connected
                </span>
              </div>
              <p className="text-xs font-mono font-extrabold text-slate-700 mt-0.5">
                +62 {fonnteTargetNumber || '881-3576-012'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onCopy(fonnteTargetNumber || '08813576012', 'phone')}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center gap-1.5"
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
          className="p-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-left transition shadow-sm group"
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition">
            <Radio className="w-4 h-4" />
          </div>
          <h4 className="font-extrabold text-xs text-slate-900 mt-2.5">WhatsApp Channel</h4>
          <p className="text-[11px] text-slate-500 mt-0.5">Device QR &amp; API Fonnte</p>
        </button>
        <button
          onClick={() => onSwitchTab('customers')}
          className="p-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-left transition shadow-sm group"
        >
          <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center group-hover:scale-105 transition">
            <Users className="w-4 h-4" />
          </div>
          <h4 className="font-extrabold text-xs text-slate-900 mt-2.5">Wali Santri / Customer</h4>
          <p className="text-[11px] text-slate-500 mt-0.5">Database &amp; Consent</p>
        </button>
        <button
          onClick={() => onSwitchTab('inbox')}
          className="p-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-left transition shadow-sm group"
        >
          <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center group-hover:scale-105 transition">
            <MessageSquare className="w-4 h-4" />
          </div>
          <h4 className="font-extrabold text-xs text-slate-900 mt-2.5">AI Inbox</h4>
          <p className="text-[11px] text-slate-500 mt-0.5">Chat &amp; Manual Override</p>
        </button>
        <button
          onClick={() => onSwitchTab('campaigns')}
          className="p-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-left transition shadow-sm group"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-105 transition">
            <Zap className="w-4 h-4" />
          </div>
          <h4 className="font-extrabold text-xs text-slate-900 mt-2.5">Campaigns</h4>
          <p className="text-[11px] text-slate-500 mt-0.5">Broadcast Syahriah &amp; Izin</p>
        </button>
      </div>

      {/* 5. Grid 8 Kartu Metrik Utama (2 Baris x 4 Kolom) */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Ringkasan Metrik Operasional Real-Time</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Row 1 */}
          <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Subscription</span>
            <span className="text-sm font-extrabold text-slate-900 mt-1 block">Active</span>
            <span className="text-[10px] text-emerald-600 font-semibold">Pro Enterprise</span>
          </div>
          <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Messaging Status</span>
            <span className="text-sm font-extrabold text-emerald-700 mt-1 block">Connected</span>
            <span className="text-[10px] text-slate-500 font-mono">Fonnte Live API</span>
          </div>
          <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Wali Santri Terdaftar</span>
            <span className="text-sm font-extrabold text-slate-900 mt-1 block">{santriList.length || 142} Kontak</span>
            <span className="text-[10px] text-teal-600 font-semibold">100% Terverifikasi</span>
          </div>
          <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">AI Services</span>
            <span className="text-sm font-extrabold text-slate-900 mt-1 block">6 Layanan Aktif</span>
            <span className="text-[10px] text-indigo-600 font-semibold">Izin, Tahfidz, POS, Medis</span>
          </div>

          {/* Row 2 */}
          <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-rose-500 block">Urgent Inbox</span>
            <span className="text-sm font-extrabold text-rose-700 mt-1 block">3 Chat Review</span>
            <span className="text-[10px] text-rose-600 font-semibold">Butuh Respon Cepat</span>
          </div>
          <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-amber-500 block">Unread Inbox</span>
            <span className="text-sm font-extrabold text-amber-700 mt-1 block">5 Pesan Baru</span>
            <span className="text-[10px] text-slate-500">Dari Wali Santri</span>
          </div>
          <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">AI Usage Periode Aktif</span>
            <span className="text-sm font-extrabold text-slate-900 mt-1 block">1,842 Tokens</span>
            <span className="text-[10px] text-emerald-600 font-semibold">42 Percakapan AI</span>
          </div>
          <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Message Sent Periode Aktif</span>
            <span className="text-sm font-extrabold text-slate-900 mt-1 block">386 Pesan</span>
            <span className="text-[10px] text-emerald-600 font-semibold">Outbound Sukses</span>
          </div>
        </div>
      </div>

      {/* 6. Activation Status & Recent Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Kiri: Activation Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Activation Status</h4>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <h5 className="font-extrabold text-xs text-slate-900">Darul Ulum Main Fonnte Channel</h5>
                <span className="text-[11px] text-slate-500 font-mono">+62 881-***-6012</span>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              Active Channel
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
            Perangkat terhubung penuh dengan webhook inbound &amp; outbound. Siap melayani pesan pengajuan izin, mutaba'ah, dan konsultasi otomatis.
          </p>
        </div>

        {/* Kanan: Recent Requests */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Recent Requests</h4>
            <div className="flex items-center gap-1">
              <span className="text-[9px] px-2 py-0.5 rounded font-bold bg-amber-100 text-amber-800">Pending (3)</span>
              <span className="text-[9px] px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">Approved (12)</span>
              <span className="text-[9px] px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-600">All</span>
            </div>
          </div>
          <div className="space-y-2">
            {[
              { id: '1', name: 'Ibu Fatimah (Ahmad Fauzi)', phone: '+62 881-3576-012', type: 'Izin Pulang', time: '10:14 WIB', status: 'Approved' },
              { id: '2', name: 'Bpk. Hendra (M. Rayhan)', phone: '+62 812-4455-890', type: 'Perpanjangan Liburan', time: '09:45 WIB', status: 'Pending' },
              { id: '3', name: 'Ibu Siti (Aisyah Putri)', phone: '+62 856-7890-123', type: 'Konsultasi Medis', time: 'Kemarin', status: 'Pending' }
            ].map(req => (
              <div key={req.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                <div>
                  <strong className="text-slate-800 block text-xs">{req.name}</strong>
                  <span className="text-[10px] text-slate-400 font-mono">{req.phone} • {req.type}</span>
                </div>
                <div className="text-right">
                  <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full ${
                    req.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {req.status}
                  </span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">{req.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 7. Customer Consent Snapshot (3 Cards) */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Customer Consent Snapshot</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Granted (Disetujui)</span>
              <span className="text-xl font-black text-emerald-700 mt-1 block">128 Wali</span>
              <span className="text-[10px] text-slate-500">Menerima broadcast resmi</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Pending (Menunggu)</span>
              <span className="text-xl font-black text-amber-700 mt-1 block">11 Wali</span>
              <span className="text-[10px] text-slate-500">Verifikasi nomor HP</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Revoked (Dicabut)</span>
              <span className="text-xl font-black text-rose-700 mt-1 block">3 Wali</span>
              <span className="text-[10px] text-slate-500">Opt-out dari pesan broadcast</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
              <X className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================================
   SUB-COMPONENT: TAB 2 - CHANNELS
   ========================================================================================= */
function TabChannels() {
  const { fonnteToken, setFonnteToken, fonnteTargetNumber, isFonnteEnabled } = useApp();

  const [subTab, setSubTab] = useState('overview');
  const [telegramToken, setTelegramToken] = useState('');
  const [isTelegramConnected, setIsTelegramConnected] = useState(false);

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
  const [validateInput, setValidateInput] = useState('08813576012');
  const [validateResult, setValidateResult] = useState(null);
  const [qrCodeGenerated, setQrCodeGenerated] = useState(false);

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
          <span className="text-lg font-extrabold text-slate-800 mt-1 block">1 Bot Siap Pakai</span>
          <span className="text-[10px] text-slate-500 font-mono">@DarulUlumRiayahBot</span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">WhatsApp</span>
          <span className="text-lg font-extrabold text-slate-800 mt-1 block">Official 0 / Fonnte 1</span>
          <span className="text-[10px] text-emerald-600 font-bold">Fonnte 3rd Party Active</span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Connected</span>
          <span className="text-lg font-extrabold text-emerald-700 mt-1 block">1 Channel Aktif</span>
          <span className="text-[10px] text-slate-500">Standby Outbound &amp; Inbound</span>
        </div>
      </div>

      {/* 3. Panel Integrasi Telegram (Collapsible) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-sky-500" />
            <h4 className="text-xs font-bold text-slate-800">Panel Integrasi Telegram Bot</h4>
          </div>
          <span className="text-[10px] font-mono text-slate-500">getMe() &amp; Auto Webhook</span>
        </div>
        <div className="p-4 space-y-3">
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
                onClick={() => {
                  if (!telegramToken.trim()) return alert('Masukkan token bot Telegram terlebih dahulu.');
                  setIsTelegramConnected(true);
                  sound.playSuccess?.();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition shadow-sm"
              >
                {isTelegramConnected ? '✓ Telegram Terhubung' : 'Connect Telegram'}
              </button>
            </div>
          </div>
          <p className="text-[10px] text-slate-400">
            Setelah terhubung, bot Telegram akan otomatis mendengarkan pesan masuk santri dan meneruskannya ke AI Inbox.
          </p>
        </div>
      </div>

      {/* 4. Inventaris Channel (Tabel) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Inventaris Channel Aktif</h4>
          <span className="text-[10px] font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">1 Channel Tersimpan</span>
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
                <th className="py-2.5 px-3 font-bold">Updated</th>
                <th className="py-2.5 px-3 font-bold text-right">Lifecycle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 px-3 font-extrabold text-slate-800">Pesantren Darul Ulum</td>
                <td className="py-3 px-3 font-mono text-slate-500 text-[11px]">fonnte-main-01</td>
                <td className="py-3 px-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    WA 3rd Party
                  </span>
                </td>
                <td className="py-3 px-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {channelRole}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-700 text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Connected
                  </span>
                </td>
                <td className="py-3 px-3">
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-blue-100 text-blue-800">Cold</span>
                  <span className="text-[9px] text-slate-400 block mt-0.5 font-mono">Bgt: 2/5 • Rsk: 0</span>
                </td>
                <td className="py-3 px-3 font-mono font-bold text-slate-700">+62 {fonnteTargetNumber || '8813576012'}</td>
                <td className="py-3 px-3 text-slate-400 font-mono text-[10px]">Hari ini, 16:34 WIB</td>
                <td className="py-3 px-3 text-right">
                  <button
                    onClick={() => { if (window.confirm('Ajukan hapus channel ini?')) alert('Permohonan hapus dikirim.'); }}
                    className="px-2.5 py-1 rounded text-[10px] font-bold text-rose-600 border border-rose-300 hover:bg-rose-50 transition"
                  >
                    Ajukan Hapus
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Operasional Device Fonnte (Accordion Panel) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
        {/* Header Aksi Cepat Device */}
        <div className="p-4 bg-emerald-50/60 border-b border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
              <Phone className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-xs text-emerald-950">Operasional Device Fonnte Terpasang</h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-200/70 text-emerald-900">
                  Campaign ON
                </span>
              </div>
              <p className="text-[11px] text-emerald-800 font-mono">Device: 08813576012 • Status: connected</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                toggleAccordion('scanQr');
                setQrCodeGenerated(true);
              }}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-sm flex items-center gap-1.5"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Ambil QR</span>
            </button>
            <button
              onClick={() => { sound.playBeep?.(); alert('Status koneksi Fonnte berhasil diperbarui: ONLINE.'); }}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs transition flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
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
              1. Status Koneksi Detail Fonnte
            </span>
            {accordions.statusDetail ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {accordions.statusDetail && (
            <div className="p-4 bg-slate-50/50 space-y-3 text-xs text-slate-600 border-t border-slate-100">
              <p>
                Nomor WhatsApp terhubung melalui layanan Fonnte REST API Gateway. Status sinkronisasi real-time memeriksa webhook incoming and outgoing setiap detik.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Token API Fonnte</span>
                  <span className="font-mono text-xs font-bold text-slate-700 block mt-1">
                    {fonnteToken ? `${fonnteToken.slice(0, 6)}••••••••••••` : 'XvFjdLyyvBgNUbXBZYzZ'}
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Webhook Endpoint</span>
                    <span className="font-mono text-[11px] text-emerald-700 font-bold block mt-0.5">https://smart-riayah.vercel.app/api/wa/webhook</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Accordion 2: Role Nomor Fonnte */}
        <div className="border-b border-slate-100">
          <button
            onClick={() => toggleAccordion('channelRole')}
            className="w-full p-3.5 text-left flex items-center justify-between font-bold text-xs text-slate-800 hover:bg-slate-50 transition"
          >
            <span className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-teal-600" />
              2. Role Nomor Fonnte &amp; Mode Operasi
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
                    onClick={() => { sound.playSuccess?.(); alert('Role channel Fonnte berhasil disimpan!'); }}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition"
                  >
                    Simpan Role
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Accordion 3: Fonnte Outbound Safety */}
        <div className="border-b border-slate-100">
          <button
            onClick={() => toggleAccordion('outboundSafety')}
            className="w-full p-3.5 text-left flex items-center justify-between font-bold text-xs text-slate-800 hover:bg-slate-50 transition"
          >
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              3. Fonnte Outbound Safety &amp; Anti-Ban Circuit Breaker
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
              4. Scan QR WhatsApp Fonnte
            </span>
            {accordions.scanQr ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {accordions.scanQr && (
            <div className="p-4 bg-slate-50/50 space-y-4 text-xs border-t border-slate-100">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="w-44 h-44 bg-white p-3 rounded-2xl border border-slate-300 flex items-center justify-center shadow-inner">
                  {qrCodeGenerated ? (
                    <img
                      src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=FONNTE-SMART-RIAYAH-PAIRING-SESSION"
                      alt="Fonnte QR"
                      className="w-full h-full object-contain rounded-lg"
                    />
                  ) : (
                    <div className="text-center p-3 text-slate-400">
                      <QrCode className="w-10 h-10 mx-auto text-slate-300" />
                      <span className="text-[11px] block mt-1 font-semibold">Klik "Ambil QR" untuk memuat barcode</span>
                    </div>
                  )}
                </div>
                <div className="space-y-2 text-left max-w-md">
                  <h5 className="font-bold text-sm text-slate-900">Petunjuk Menautkan Perangkat:</h5>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600 text-xs">
                    <li>Buka aplikasi WhatsApp di HP Admin Pesantren.</li>
                    <li>Buka Menu Titik Tiga / Pengaturan &gt; Perangkat Tertaut.</li>
                    <li>Ketuk <strong>Tautkan Perangkat</strong> lalu arahkan kamera ke barcode di samping.</li>
                  </ol>
                  <div className="pt-2 flex items-center gap-3">
                    <button
                      onClick={() => { setQrCodeGenerated(true); sound.playBeep?.(); }}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-sm"
                    >
                      Ambil QR Baru
                    </button>
                    <span className="text-slate-400 font-mono text-[11px]">Pairing Code: <strong>164WE4BM</strong></span>
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
                  placeholder="08xxxxxxxxxx"
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  onClick={() => {
                    setValidateResult({ valid: true, number: validateInput, name: 'Wali Santri Aktif' });
                    sound.playSuccess?.();
                  }}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition shrink-0"
                >
                  Validasi Nomor
                </button>
              </div>
              {validateResult && (
                <div className="p-3 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Nomor <strong>{validateResult.number}</strong> terdaftar aktif di WhatsApp!</span>
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
              <p className="text-rose-900">
                Memutuskan tautan perangkat akan menghentikan pengiriman pesan otomatis dan notifikasi perizinan real-time sampai Anda melakukan scan QR ulang.
              </p>
              <button
                onClick={() => { if (window.confirm('Yakin ingin memutuskan koneksi Fonnte?')) alert('Device disconnected.'); }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shadow-sm"
              >
                Disconnect Device Sekarang
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
          <div className="space-y-2 text-xs">
            {[
              { time: '16:12 WIB', event: 'outbound success', severity: 'info', intent: 'NOTIF_IZIN', ref: 'DU-PERMIT-8492' },
              { time: '15:40 WIB', event: 'inbound received', severity: 'info', intent: 'QUERY_SALDO', ref: 'S-101' },
              { time: '14:20 WIB', event: 'device keepalive', severity: 'info', intent: 'HEARTBEAT', ref: 'PING_OK' }
            ].map((log, idx) => (
              <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="font-mono text-slate-400 text-[10px] block">{log.time}</span>
                  <strong className="text-slate-800 text-xs">{log.event}</strong>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 uppercase">
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
                Fonnte Gateway disetujui &amp; diintegrasikan untuk notifikasi WhatsApp santri Pesantren Modern Darul Ulum.
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
function TabAiInbox() {
  const [selectedChat, setSelectedChat] = useState(null);
  const [globalHandling, setGlobalHandling] = useState('autonomous'); // 'manual' | 'semi_auto' | 'autonomous'
  const [channelFilter, setChannelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [overrideMessage, setOverrideMessage] = useState('');

  // Sample conversations
  const [conversations, setConversations] = useState([
    {
      id: 'chat-1',
      name: 'Ibu Fatimah Az-Zahra',
      santri: 'Ahmad Fauzi (Kamar Umar 204)',
      phone: '+62 881-3576-012',
      channel: 'WhatsApp Fonnte',
      status: 'Open',
      handling: 'Otonom - Mengikuti Global',
      aiSafety: 'AI Balas - Allow (Score: 98)',
      lastTime: '16:20 WIB',
      lastPreview: 'Assalamu\'alaikum, apakah ananda Fauzi hari ini sholat subuh berjamaah?',
      unread: false,
      messages: [
        { sender: 'wali', time: '16:18 WIB', text: 'Assalamu\'alaikum ustadz, bagaimana kabar ananda Ahmad Fauzi hari ini?' },
        { sender: 'ai', time: '16:19 WIB', text: 'Wa\'alaikumsalam warahmatullah, Ibu Fatimah. Ananda Ahmad Fauzi sehat wal\'afiat dan tercatat hadir sholat Subuh berjamaah di Masjid Jami\' tepat waktu. Poin kedisiplinannya saat ini 96/100 (Mumtaz).' },
        { sender: 'wali', time: '16:20 WIB', text: 'Alhamdulillah, terima kasih banyak atas infonya Ustadz.' }
      ]
    },
    {
      id: 'chat-2',
      name: 'Bpk. Hendra Gunawan',
      santri: 'Muhammad Rayhan (Kamar Abu Bakar 102)',
      phone: '+62 812-4455-890',
      channel: 'WhatsApp Fonnte',
      status: 'Perlu Ambil Alih',
      handling: 'Semi Auto',
      aiSafety: 'AI Balas - Allow (Score: 89)',
      lastTime: '15:45 WIB',
      lastPreview: 'Saya mau tanya prosedur perpanjangan izin pulang karena anak demam di rumah.',
      unread: true,
      messages: [
        { sender: 'wali', time: '15:45 WIB', text: 'Assalamu\'alaikum, ananda Rayhan sedang demam di rumah. Bagaimana prosedur mengajukan perpanjangan liburan?' },
        { sender: 'ai', time: '15:46 WIB', text: 'Wa\'alaikumsalam Bapak Hendra. Syafakallah untuk ananda. Bapak dapat mengajukan perpanjangan liburan langsung melalui menu Perizinan di aplikasi Smart Riayah dengan mengunggah foto surat dokter/keterangan sakit.' }
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
      lastTime: '14:10 WIB',
      lastPreview: 'Berapa sisa saldo dompet RFID ananda saat ini?',
      unread: false,
      messages: [
        { sender: 'wali', time: '14:10 WIB', text: 'Berapa sisa saldo dompet RFID ananda Aisyah Putri?' },
        { sender: 'ai', time: '14:10 WIB', text: 'Saldo kartu RFID ananda Aisyah Putri saat ini adalah Rp 65.000 dengan limit jajan harian Rp 25.000/hari.' }
      ]
    }
  ]);

  const handleSendOverride = (e) => {
    e.preventDefault();
    if (!overrideMessage.trim() || !selectedChat) return;

    const newMsg = {
      sender: 'admin',
      time: 'Baru saja',
      text: overrideMessage
    };

    setSelectedChat(prev => ({
      ...prev,
      messages: [...prev.messages, newMsg]
    }));

    setOverrideMessage('');
    sound.playWhatsApp?.();
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
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-slate-900">{selectedChat.name}</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  Otonom
                </span>
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
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              {selectedChat.aiSafety}
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
                Live Conversation Stream (WhatsApp Fonnte)
              </span>
              <button
                onClick={() => alert('Mode ambil alih manual aktif! AI diistirahatkan untuk percakapan ini.')}
                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] transition"
              >
                Ambil Alih dari AI
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
            </div>

            {/* Chat Composer (Manual Override Reply) */}
            <form onSubmit={handleSendOverride} className="p-3 bg-slate-900 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <div className="flex items-center gap-1">
                  <button type="button" className="p-1.5 hover:text-white rounded" title="Tebal (*teks*)"><Bold className="w-3.5 h-3.5" /></button>
                  <button type="button" className="p-1.5 hover:text-white rounded" title="Miring (_teks_)"><Italic className="w-3.5 h-3.5" /></button>
                  <button type="button" className="p-1.5 hover:text-white rounded" title="Coret (~teks~)"><Strikethrough className="w-3.5 h-3.5" /></button>
                  <button type="button" className="p-1.5 hover:text-white rounded" title="Kode (`teks`)"><Code className="w-3.5 h-3.5" /></button>
                  <button type="button" className="p-1.5 hover:text-white rounded" title="List"><ListIcon className="w-3.5 h-3.5" /></button>
                  <button type="button" className="p-1.5 hover:text-white rounded" title="Quote"><Quote className="w-3.5 h-3.5" /></button>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  Format WA: *tebal*, _miring_, ~coret~
                </span>
              </div>

              <div className="flex items-center gap-2">
                <textarea
                  value={overrideMessage}
                  onChange={(e) => setOverrideMessage(e.target.value)}
                  placeholder="Ketik balasan manual override untuk wali santri..."
                  rows={2}
                  className="flex-1 px-3 py-2 bg-slate-800 text-white text-xs rounded-xl border border-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                />
                <button
                  type="submit"
                  className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition flex items-center gap-1.5 shadow-md shrink-0"
                >
                  <Send className="w-4 h-4" />
                  <span>Kirim Override</span>
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
                  <span className="font-bold text-slate-800">WhatsApp Fonnte</span>
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
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <strong className="text-slate-800 block text-xs">Handoff Status</strong>
                  <span className="text-[11px] text-emerald-700 font-bold block mt-0.5">Active: AI Otonom (Bot Agent)</span>
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
      {/* 1. 4 Kartu Ringkasan Atas */}
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

      {/* 2. Policy Global Aktif (5 Kartu) */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Policy Global AI Aktif</h4>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
          <div className="p-2.5 rounded-xl bg-white border border-slate-200">
            <span className="text-[9px] font-bold text-slate-400 uppercase block">Unknown Number</span>
            <strong className="text-slate-800 text-[11px] block mt-0.5">Allow Auto Processing</strong>
          </div>
          <div className="p-2.5 rounded-xl bg-white border border-slate-200">
            <span className="text-[9px] font-bold text-slate-400 uppercase block">Handling Role</span>
            <strong className="text-emerald-700 text-[11px] block mt-0.5">AI Otonom</strong>
          </div>
          <div className="p-2.5 rounded-xl bg-white border border-slate-200">
            <span className="text-[9px] font-bold text-slate-400 uppercase block">First Reply Delay</span>
            <strong className="text-slate-800 text-[11px] block mt-0.5">Acak 12d - 25d</strong>
          </div>
          <div className="p-2.5 rounded-xl bg-white border border-slate-200">
            <span className="text-[9px] font-bold text-slate-400 uppercase block">Typing Natural</span>
            <strong className="text-teal-700 text-[11px] block mt-0.5">Aktif</strong>
          </div>
          <div className="p-2.5 rounded-xl bg-white border border-slate-200">
            <span className="text-[9px] font-bold text-slate-400 uppercase block">Consent &amp; Auto Create</span>
            <strong className="text-emerald-700 text-[11px] block mt-0.5">Consent On</strong>
          </div>
        </div>
      </div>

      {/* 3. Default Chat Handling (3 Selectable Cards) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">Default Chat Handling Mode</h4>
            <p className="text-xs text-slate-500 mt-0.5">Pilih tingkat otonomi balasan AI untuk seluruh pesan masuk dari wali santri.</p>
          </div>
          <button
            onClick={() => { sound.playSuccess?.(); alert('Pengaturan Global Handling tersimpan!'); }}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-sm self-start"
          >
            Simpan Global Handling
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { id: 'manual', title: '1. Manual', desc: 'Full Control Admin. AI tidak membalas otomatis.', badge: 'Aman', color: 'border-slate-300' },
            { id: 'semi_auto', title: '2. Semi Auto', desc: 'AI menyusun draf balasan, admin me-review sebelum kirim.', badge: 'Review', color: 'border-amber-300' },
            { id: 'autonomous', title: '3. Otonom', desc: 'AI membalas otomatis seketika sesuai data live & policy.', badge: 'Auto', color: 'border-emerald-400' }
          ].map(opt => {
            const isSelected = globalHandling === opt.id;
            return (
              <div
                key={opt.id}
                onClick={() => { setGlobalHandling(opt.id); sound.playBeep?.(); }}
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

      {/* 4. Filter & Queue Bar */}
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

        {/* 5. Tabel Daftar Percakapan */}
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
                  <tr key={chat.id} className="hover:bg-slate-50/60 transition cursor-pointer" onClick={() => setSelectedChat(chat)}>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-xs">
                          {chat.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <strong className="text-slate-900 block text-xs">{chat.name}</strong>
                          <span className="text-[10px] text-slate-400 block">{chat.santri}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {chat.channel}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-700">{chat.phone}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        chat.status === 'Open' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {chat.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[11px] text-slate-600">{chat.handling}</td>
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
                        onClick={() => setSelectedChat(chat)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition shadow-sm"
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
    </div>
  );
}

/* =========================================================================================
   SUB-COMPONENT: TAB 4 - KNOWLEDGE BASE
   ========================================================================================= */
function TabKnowledgeBase() {
  const [topicFilter, setTopicFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Starter pack states
  const [starterProfile, setStarterProfile] = useState({
    name: 'Pesantren Modern Darul Ulum',
    target: 'Wali Santri & Penuntut Ilmu',
    address: 'Jl. Pesantren No. 12, Jawa Timur',
    operational: 'Operasional KBM 07.00 - 15.00 WIB, Jam Malam 21.30 WIB.'
  });

  // New Knowledge form
  const [newKb, setNewKb] = useState({
    category: 'Tata Tertib',
    title: 'Jam Malam & Ketentuan Keluar Asrama',
    topicGroup: 'Tata Tertib',
    content: 'Santri wajib berada di dalam kamar asrama maksimal pukul 21.30 WIB. Keterlambatan tanpa DU-PERMIT akan tercatat otomatis di sistem gerbang.',
    priority: 100,
    status: 'Active'
  });

  const [knowledgeList, setKnowledgeList] = useState([
    { id: 'kb-1', priority: 100, topicGroup: 'Tata Tertib', category: 'Kedisiplinan', title: 'Aturan Jam Malam Asrama & Pintu Gerbang', snippet: 'Batas toleransi jam malam pukul 21.30 WIB...', quality: '95/100', status: 'Active', security: 'Security Approved' },
    { id: 'kb-2', priority: 95, topicGroup: 'Alur Perizinan', category: 'DU-PERMIT', title: 'SOP Pengajuan Izin Pulang & Berobat Santri', snippet: 'Izin diajukan wali minimal H-1 sebelum keberangkatan...', quality: '92/100', status: 'Active', security: 'Security Approved' },
    { id: 'kb-3', priority: 90, topicGroup: 'Layanan Wali', category: 'Keuangan', title: 'Ketentuan Dompet Pintar Cashless RFID & Limit Jajan', snippet: 'Uang saku santri dikelola secara nontunai melalui kartu RFID...', quality: '88/100', status: 'Active', security: 'Security Approved' },
    { id: 'kb-4', priority: 85, topicGroup: 'FAQ Santri', category: 'Kesehatan', title: 'SOP Pelayanan Medis UKS & Rujukan Rumah Sakit', snippet: 'Pemeriksaan awal dilakukan di Poskestren pesantren...', quality: '85/100', status: 'Active', security: 'Security Approved' }
  ]);

  const handleGenerateAi = () => {
    sound.playSuccess?.();
    setNewKb(prev => ({
      ...prev,
      content: `${prev.content}\n\n[Diperkaya oleh AI]: Berdasarkan regulasi resmi Pesantren Modern Darul Ulum, seluruh pelanggaran akan dikonversikan menjadi poin kedisiplinan dan dilaporkan langsung ke wali santri melalui WhatsApp Gateway.`
    }));
  };

  const handleSaveKb = (e) => {
    e.preventDefault();
    if (!newKb.title.trim()) return alert('Judul wajib diisi!');
    const entry = {
      id: `kb-${Date.now()}`,
      priority: Number(newKb.priority) || 100,
      topicGroup: newKb.topicGroup,
      category: newKb.category,
      title: newKb.title,
      snippet: newKb.content.slice(0, 60) + '...',
      quality: '90/100',
      status: newKb.status,
      security: 'Security Approved'
    };
    setKnowledgeList([entry, ...knowledgeList]);
    sound.playSuccess?.();
    alert('Knowledge item berhasil disimpan ke otak penalaran AI!');
  };

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
              {['Profil Pesantren', 'Alur Izin Pesiar', 'Pembayaran Syahriah', 'FAQ Wali Santri', 'Tata Tertib', 'Jam Kunjungan'].map((c, i) => (
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
                    <option value="Tata Tertib">Tata Tertib</option>
                    <option value="Alur Perizinan">Alur Perizinan</option>
                    <option value="Layanan Wali">Layanan Wali</option>
                    <option value="FAQ Santri">FAQ Santri</option>
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
          {/* Grid 8 Kartu Topic Group */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Topic Groups Knowledge AI</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[
                { name: 'Tata Tertib', count: 8, quality: '95%' },
                { name: 'Layanan Wali', count: 12, quality: '92%' },
                { name: 'Profil Pondok', count: 5, quality: '98%' },
                { name: 'Policy Rules', count: 6, quality: '91%' },
                { name: 'Alur Izin', count: 14, quality: '96%' },
                { name: 'FAQ Santri', count: 20, quality: '89%' },
                { name: 'Info Asrama', count: 7, quality: '94%' },
                { name: 'Jadwal Sholat', count: 4, quality: '99%' }
              ].map((tg, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-white border border-slate-200 text-center shadow-xs">
                  <span className="text-[11px] font-extrabold text-slate-800 block truncate">{tg.name}</span>
                  <span className="text-[10px] text-slate-500 block">{tg.count} items</span>
                  <span className="text-[9px] font-bold text-emerald-600 font-mono">Q: {tg.quality}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Baris Filter & Search */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-2 text-xs">
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
            <select
              value={topicFilter}
              onChange={(e) => setTopicFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white"
            >
              <option value="all">Semua Topik</option>
              <option value="Tata Tertib">Tata Tertib</option>
              <option value="Alur Perizinan">Alur Perizinan</option>
            </select>
            <button
              onClick={() => { setSearchQuery(''); setTopicFilter('all'); }}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold transition"
            >
              Reset
            </button>
          </div>

          {/* Tabel Daftar Knowledge */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 font-bold">Prio</th>
                    <th className="py-2.5 px-3 font-bold">Topik</th>
                    <th className="py-2.5 px-3 font-bold">Judul &amp; Ringkasan</th>
                    <th className="py-2.5 px-3 font-bold">Quality</th>
                    <th className="py-2.5 px-3 font-bold">Status</th>
                    <th className="py-2.5 px-3 font-bold">Security</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {knowledgeList.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-3 font-mono font-bold text-slate-700">{item.priority}</td>
                      <td className="py-3 px-3 font-semibold text-slate-700">{item.topicGroup}</td>
                      <td className="py-3 px-3">
                        <strong className="text-slate-900 block text-xs">{item.title}</strong>
                        <span className="text-[10px] text-slate-400 block line-clamp-1">{item.snippet}</span>
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
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================================
   SUB-COMPONENTS: REMAINING TABS (Customers, Permits, Asrama, Services, Greeting, Campaigns, Settings, Reports)
   ========================================================================================= */
function TabCustomers() {
  const { santriList } = useApp();
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-extrabold text-sm text-slate-900">Database Wali Santri (Customers)</h3>
          <p className="text-xs text-slate-500">Daftar wali santri yang terhubung dengan sistem WhatsApp Gateway &amp; smart notifications.</p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
          {santriList.length || 142} Kontak Aktif
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3 font-bold">Wali Santri</th>
              <th className="py-2.5 px-3 font-bold">Santri Asuhan</th>
              <th className="py-2.5 px-3 font-bold">Nomor WhatsApp</th>
              <th className="py-2.5 px-3 font-bold">Status Consent</th>
              <th className="py-2.5 px-3 font-bold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {santriList.slice(0, 6).map((s, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50">
                <td className="py-3 px-3 font-bold text-slate-800">{s.namaWali || `Wali dari ${s.nama}`}</td>
                <td className="py-3 px-3">{s.nama} ({s.kamar || 'Kamar 204'})</td>
                <td className="py-3 px-3 font-mono text-slate-700">{s.noWali || '08813576012'}</td>
                <td className="py-3 px-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Granted (Opt-In)
                  </span>
                </td>
                <td className="py-3 px-3 text-right">
                  <button
                    onClick={() => alert(`Kirim pesan WA tes ke ${s.namaWali || s.nama}`)}
                    className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px]"
                  >
                    Kirim WA
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabPermits() {
  const { permits } = useApp();
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
      <h3 className="font-extrabold text-sm text-slate-900">Sinkronisasi Notifikasi Izin &amp; Pesiar (DU-PERMIT)</h3>
      <p className="text-xs text-slate-500">Setiap persetujuan izin akan memicu pesan WhatsApp otomatis ke nomor wali santri.</p>
      <div className="space-y-2">
        {permits.slice(0, 5).map((p, idx) => (
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
          { title: 'Pembayaran Syahriah & SPP', desc: 'Auto reminder invoice bulanan santri melalui WhatsApp Fonnte.' },
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

function TabGreeting() {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4 text-xs">
      <h3 className="font-extrabold text-sm text-slate-900">Template Auto-Greeting WhatsApp</h3>
      <p className="text-slate-500">Pesan otomatis yang dikirimkan saat wali santri pertama kali menghubungi WhatsApp resmi.</p>
      <div className="p-4 rounded-xl bg-slate-900 text-emerald-200 font-mono space-y-2">
        <p>Assalamu'alaikum Warahmatullahi Wabarakatuh.</p>
        <p>Selamat datang di Layanan Informasi Resmi Pesantren Modern Darul Ulum.</p>
        <p>Ketik "INFO" untuk mengecek kegiatan santri, atau "IZIN" untuk prosedur perizinan.</p>
      </div>
      <button onClick={() => alert('Template salam berhasil diperbarui!')} className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold">
        Simpan Template Greeting
      </button>
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

function TabAiSettings() {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4 text-xs">
      <h3 className="font-extrabold text-sm text-slate-900">AI Personality &amp; LLM Configuration</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="font-bold text-slate-700 block mb-1">Model LLM Engine</label>
          <select className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white">
            <option>Google Gemini 1.5 Flash (Default)</option>
            <option>Groq Llama 3.3 70B</option>
            <option>DeepSeek Chat</option>
            <option>OpenAI GPT-4o Mini</option>
          </select>
        </div>
        <div>
          <label className="font-bold text-slate-700 block mb-1">Temperature / Kreativitas</label>
          <input type="range" min="0" max="1" step="0.1" defaultValue="0.7" className="w-full mt-2" />
        </div>
      </div>
      <button onClick={() => alert('Konfigurasi AI disimpan!')} className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold">
        Simpan Parameter AI
      </button>
    </div>
  );
}

function TabReports() {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4 text-xs">
      <h3 className="font-extrabold text-sm text-slate-900">Analytics &amp; Delivery Reports</h3>
      <p className="text-slate-500">Statistik latensi pesan WhatsApp dan performa auto-reply AI 24/7.</p>
      <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center font-mono text-slate-500">
        📊 [Grafik Aktivitas Outbound WhatsApp 30 Hari Terakhir: 99.4% Delivery Rate • Rata-rata Latensi: 420 ms]
      </div>
    </div>
  );
}

