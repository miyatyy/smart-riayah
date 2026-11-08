import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  ArrowLeft, 
  ShieldCheck, 
  Sparkles, 
  Building2, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  ArrowRight,
  Cpu,
  Wrench,
  Users,
  Radio,
  HeartPulse,
  TrendingUp,
  QrCode,
  Wifi,
  Smartphone,
  Shield,
  CheckCircle2,
  Scan,
  Zap,
  Activity
} from 'lucide-react';
import { sound } from '../../utils/audio';

export default function LoginPage() {
  const { login, navigateTo, loginRoleTarget, accounts } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDemoPanelOpen, setIsDemoPanelOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Auto pre-fill if navigated with a specific role target from landing page
  useEffect(() => {
    if (loginRoleTarget && accounts?.length > 0) {
      const matched = accounts.find(a => a.role === loginRoleTarget);
      if (matched) {
        setEmail(matched.email);
        setPassword(matched.password);
      }
    } else if (accounts?.length > 0 && !email) {
      // Default to Super Admin or Admin Ri'ayah for developer convenience
      const defaultAcc = accounts[0];
      setEmail(defaultAcc.email);
      setPassword(defaultAcc.password);
    }
  }, [loginRoleTarget, accounts]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim()) {
      setErrorMessage('Harap masukkan Email atau Username Anda.');
      sound.playAccessDenied();
      return;
    }

    if (!password) {
      setErrorMessage('Harap masukkan Password Anda.');
      sound.playAccessDenied();
      return;
    }

    setLoading(true);
    setTimeout(() => {
      const res = login(email, password);
      setLoading(false);
      if (!res.success) {
        setErrorMessage(res.error);
      }
    }, 300);
  };

  const handleSelectDemoAccount = (acc) => {
    sound.playBeep();
    setEmail(acc.email);
    setPassword(acc.password);
    setErrorMessage('');
  };

  const roleIcons = {
    superadmin: Cpu,
    admin_riayah: Wrench,
    parent: Users,
    musyrif: ShieldCheck,
    security: Radio,
    poskestren: HeartPulse,
    kyai: TrendingUp
  };

  return (
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-slate-50 font-sans selection:bg-emerald-500 selection:text-white">
      
      {/* ─── SCOPED KEYFRAME ANIMATIONS (PURE CSS 60FPS) ─── */}
      <style>{`
        @keyframes laserScan {
          0% { top: 6%; opacity: 0.2; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { top: 92%; opacity: 0.2; }
        }
        @keyframes floatSlow1 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(-0.5deg); }
        }
        @keyframes floatSlow2 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(8px) rotate(0.8deg); }
        }
        @keyframes floatSlow3 {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-7px); }
        }
        @keyframes streamFlow {
          0% { stroke-dashoffset: 48; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes radarPulse {
          0% { transform: scale(0.92); opacity: 0.6; }
          50% { transform: scale(1.05); opacity: 0.2; }
          100% { transform: scale(0.92); opacity: 0.6; }
        }
        @keyframes radarSweepSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-laser-scan {
          animation: laserScan 2.4s ease-in-out infinite alternate;
        }
        .animate-float-1 {
          animation: floatSlow1 5.5s ease-in-out infinite;
        }
        .animate-float-2 {
          animation: floatSlow2 6.5s ease-in-out infinite;
        }
        .animate-float-3 {
          animation: floatSlow3 4.8s ease-in-out infinite;
        }
        .animate-stream-flow {
          stroke-dasharray: 6 6;
          animation: streamFlow 1.6s linear infinite;
        }
        .animate-radar-pulse {
          animation: radarPulse 4s ease-in-out infinite;
        }
        .animate-radar-spin {
          animation: radarSweepSpin 22s linear infinite;
        }
      `}</style>

      {/* ─────────────────────────────────────────────────────────────
          KOLOM SEBELAH KIRI (lg:col-span-7)
          PANGGUNG ANIMASI SISTEM KEAMANAN & PERIZINAN PONDOK PESANTREN
          ───────────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:col-span-7 relative flex-col justify-between p-8 xl:p-12 bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-950 text-white overflow-hidden border-r border-emerald-800/40">
        
        {/* Background Grid Pattern & Ambient Glows */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(16, 185, 129, 0.4) 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }}
        />
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* 1. HEADER KIRI ATAS */}
        <div className="relative z-20 flex items-center justify-between gap-4">
          <button
            onClick={() => navigateTo('landing')}
            className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/15 transition text-xs font-semibold shadow-sm group"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-400 group-hover:-translate-x-0.5 transition-transform" />
            <span>← Kembali ke Beranda</span>
          </button>

          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 text-emerald-200 text-[11px] font-mono tracking-wide shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            <span>Smart Security &amp; Gate Permit System • Live 24/7</span>
          </div>
        </div>

        {/* 2. PUSAT ANIMASI BERGERAK (INTERACTIVE SECURITY & PERMIT HUB) */}
        <div className="relative z-10 my-auto py-8 flex flex-col items-center justify-center">
          
          {/* Radar & Shield Visual Container */}
          <div className="relative w-[380px] h-[380px] xl:w-[440px] xl:h-[440px] flex items-center justify-center">
            
            {/* Lapisan 1: Lingkaran Radar Konsentris */}
            <div className="absolute inset-0 rounded-full border border-emerald-500/20 animate-radar-pulse" />
            <div className="absolute inset-10 rounded-full border border-emerald-400/25 animate-radar-pulse" style={{ animationDelay: '1s' }} />
            <div className="absolute inset-20 rounded-full border border-teal-400/20 animate-radar-pulse" style={{ animationDelay: '2s' }} />
            <div className="absolute inset-28 rounded-full border border-dashed border-emerald-400/30 animate-radar-spin" />

            {/* Radar Crosshairs */}
            <div className="absolute inset-x-0 top-1/2 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent pointer-events-none" />
            <div className="absolute inset-y-0 left-1/2 w-[1px] bg-gradient-to-b from-transparent via-emerald-500/30 to-transparent pointer-events-none" />

            {/* Center Core: Perisai Keamanan Gerbang Pesantren */}
            <div className="relative z-20 w-24 h-24 xl:w-28 xl:h-28 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-700 p-0.5 shadow-2xl shadow-emerald-500/40 flex items-center justify-center">
              <div className="w-full h-full rounded-[22px] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center text-center p-2 relative overflow-hidden border border-emerald-400/30">
                <div className="absolute -top-6 -right-6 w-14 h-14 bg-emerald-400/30 rounded-full blur-md" />
                <ShieldCheck className="w-9 h-9 xl:w-11 xl:h-11 text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
                <span className="text-[9px] font-black tracking-widest text-emerald-200 mt-1 uppercase">SMART RI'AYAH</span>
                <span className="text-[7px] font-mono text-emerald-400/80">DARUL ULUM</span>
              </div>
            </div>

            {/* Lapisan 3: Animated SVG Data Streams (Aliran Data Bercahaya) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-15 overflow-visible">
              <defs>
                <linearGradient id="streamGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.2" />
                </linearGradient>
                <linearGradient id="streamGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#34d399" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#059669" stopOpacity="0.2" />
                </linearGradient>
              </defs>

              {/* Path dari Kartu RFID (Kiri Atas) ke Pusat Server */}
              <path
                d="M 60 40 Q 120 130 180 180"
                fill="none"
                stroke="url(#streamGrad1)"
                strokeWidth="2"
                className="animate-stream-flow"
              />
              {/* Path dari Pusat Server ke QR Gate Pass (Kanan Atas) */}
              <path
                d="M 220 180 Q 280 120 340 40"
                fill="none"
                stroke="url(#streamGrad2)"
                strokeWidth="2"
                className="animate-stream-flow"
              />
              {/* Path ke Status Card Bawah */}
              <path
                d="M 190 230 Q 190 280 120 320"
                fill="none"
                stroke="url(#streamGrad1)"
                strokeWidth="1.5"
                className="animate-stream-flow"
              />
              <path
                d="M 210 230 Q 220 280 290 320"
                fill="none"
                stroke="url(#streamGrad2)"
                strokeWidth="1.5"
                className="animate-stream-flow"
              />
            </svg>

            {/* Lapisan 2: Visual Kartu Smart RFID Santri (Melayang di Kiri Atas dengan Laser Scanner) */}
            <div className="absolute -top-8 -left-12 xl:-left-16 z-30 animate-float-1">
              <div className="relative w-56 xl:w-64 rounded-2xl bg-gradient-to-br from-emerald-900/90 via-slate-900/90 to-emerald-950/90 p-3.5 backdrop-blur-xl border border-emerald-500/50 shadow-2xl shadow-emerald-950/80 text-xs overflow-hidden">
                {/* Laser Scanning Beam */}
                <div className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] z-20 animate-laser-scan pointer-events-none" />
                
                {/* Header Kartu */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-emerald-500/20">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-md bg-emerald-600 flex items-center justify-center font-black text-[9px] text-white">DU</div>
                    <div>
                      <div className="text-[8px] font-black text-emerald-100 uppercase tracking-wider">SMART RFID CARD</div>
                      <div className="text-[7px] font-mono text-emerald-400">13.56 MHz Mifare</div>
                    </div>
                  </div>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                </div>

                {/* Body Kartu */}
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-11 rounded-lg bg-emerald-950/80 border border-emerald-400/40 flex items-center justify-center shrink-0 overflow-hidden relative">
                    <Users className="w-5 h-5 text-emerald-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-100 text-[11px] truncate">M. Fatih Robbani</div>
                    <div className="text-[9px] text-emerald-300 font-mono">NIS: 125456 • 10-A</div>
                    <div className="text-[8px] text-slate-300 font-mono mt-0.5">UID: 04:A1:2B:9C</div>
                  </div>
                </div>

                {/* Footer Tag */}
                <div className="mt-2 pt-1.5 border-t border-emerald-500/20 flex items-center justify-between text-[8px] font-mono">
                  <span className="text-emerald-300 flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5 text-amber-400" /> RC522 Reader OK
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 font-bold">
                    ACTIVE
                  </span>
                </div>
              </div>
            </div>

            {/* Lapisan 2: Visual E-Coupon QR Gate Pass (Melayang di Kanan Atas dengan Scanner Viewfinder) */}
            <div className="absolute -top-6 -right-12 xl:-right-16 z-30 animate-float-2">
              <div className="relative w-56 xl:w-64 rounded-2xl bg-gradient-to-br from-teal-900/90 via-slate-900/90 to-teal-950/90 p-3.5 backdrop-blur-xl border border-teal-500/50 shadow-2xl shadow-teal-950/80 text-xs overflow-hidden">
                {/* Viewfinder Corners */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-teal-500/20">
                  <div className="flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-teal-400" />
                    <div>
                      <div className="text-[8px] font-black text-teal-100 uppercase tracking-wider">E-GATE PASS VERIFIED</div>
                      <div className="text-[7px] font-mono text-teal-400">Scan via Satpam HP</div>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-[8px] font-bold text-teal-300 bg-teal-500/20 px-1.5 py-0.5 rounded border border-teal-400/40">
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" /> VALID
                  </span>
                </div>

                {/* Content Barcode & Info */}
                <div className="flex items-center gap-2.5">
                  <div className="w-11 h-11 rounded-lg bg-white p-1 shrink-0 flex items-center justify-center">
                    <QrCode className="w-full h-full text-slate-900" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="font-bold text-slate-100 text-[10px] truncate">H. Bambang Sudarsono</div>
                    <div className="text-[8px] text-teal-200">Wali Santri (Kunjungan)</div>
                    <div className="text-[8px] font-mono text-emerald-300">GP-DU-202611-OK</div>
                  </div>
                </div>

                {/* Live Status Pill */}
                <div className="mt-2 pt-1.5 border-t border-teal-500/20 flex items-center justify-between text-[8px] font-mono">
                  <span className="text-teal-300 flex items-center gap-1">
                    <Smartphone className="w-2.5 h-2.5 text-teal-400" /> WA Notif Terkirim
                  </span>
                  <span className="text-emerald-400 font-bold">CHECK-IN</span>
                </div>
              </div>
            </div>

          </div>

          {/* Lapisan 4: 3 Kartu Floating Live Security Status (Bergerak Melayang Bergantian) */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl z-20">
            {/* Status 1: RFID Turnstile */}
            <div className="p-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 text-left shadow-lg hover:border-emerald-400/40 transition animate-float-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  <Scan className="w-3.5 h-3.5" />
                </div>
                <div className="font-bold text-[11px] text-white">Turnstile RFID Gate</div>
              </div>
              <p className="text-[10px] text-emerald-100/80 leading-snug">
                ESP32-S3 reader membaca kartu santri &amp; menyinkronkan izin real-time.
              </p>
            </div>

            {/* Status 2: QR Gate Pass Satpam */}
            <div className="p-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 text-left shadow-lg hover:border-teal-400/40 transition animate-float-1" style={{ animationDelay: '1.2s' }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-400/30">
                  <Smartphone className="w-3.5 h-3.5" />
                </div>
                <div className="font-bold text-[11px] text-white">QR Gate Pass Satpam</div>
              </div>
              <p className="text-[10px] text-teal-100/80 leading-snug">
                Verifikasi barcode wali santri &amp; catat titipan barang tanpa antre.
              </p>
            </div>

            {/* Status 3: RBAC & Kurasi Berjenjang */}
            <div className="p-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 text-left shadow-lg hover:border-emerald-400/40 transition animate-float-2" style={{ animationDelay: '2.4s' }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  <Shield className="w-3.5 h-3.5" />
                </div>
                <div className="font-bold text-[11px] text-white">7-Role Multi-Akses</div>
              </div>
              <p className="text-[10px] text-emerald-100/80 leading-snug">
                Otorisasi berjenjang: Pengasuh, Admin Ri'ayah, Satpam, &amp; Wali Santri.
              </p>
            </div>
          </div>

        </div>

        {/* 3. FOOTER KIRI BAWAH (BRANDING & KEUNGGULAN SISTEM) */}
        <div className="relative z-20 space-y-3 pt-4 border-t border-emerald-800/50">
          <div>
            <h1 className="text-xl xl:text-2xl font-black text-white tracking-tight leading-snug">
              Sistem Keamanan, Perizinan Gerbang &amp; Ri'ayah Pesantren Terpadu
            </h1>
            <p className="text-xs text-emerald-200/80 mt-1 leading-relaxed max-w-xl">
              Integrasi Smart Card RFID RC522, E-Barcode Kunjungan Wali Santri, dan Notifikasi WhatsApp Gateway Otomatis untuk Pondok Pesantren Modern Darul Ulum.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-600/40 text-[10px] font-mono text-emerald-300">
              <Lock className="w-3 h-3 text-emerald-400" /> Enkripsi Tiket 1-Siklus
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-600/40 text-[10px] font-mono text-emerald-300">
              <Activity className="w-3 h-3 text-teal-400" /> Deteksi Real-Time WITA
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-600/40 text-[10px] font-mono text-emerald-300">
              <ShieldCheck className="w-3 h-3 text-emerald-400" /> Proteksi Multi-Role
            </span>
          </div>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          KOLOM SEBELAH KANAN (lg:col-span-5)
          AREA FORM LOGIN MODERN & TERFOKUS
          ───────────────────────────────────────────────────────────── */}
      <div className="col-span-1 lg:col-span-5 flex flex-col justify-center items-center px-6 sm:px-12 py-10 bg-white relative min-h-screen overflow-y-auto">
        
        {/* Mobile Header Back Button (Hanya tampil di layar kecil / mobile) */}
        <div className="w-full max-w-md flex items-center justify-between lg:hidden mb-6">
          <button
            onClick={() => navigateTo('landing')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-600" />
            <span>Beranda</span>
          </button>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-mono border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live 24/7</span>
          </div>
        </div>

        {/* Ambient Glow Subtle */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-50/70 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md relative z-10 space-y-6">
          
          {/* Header Form Login */}
          <div className="text-center sm:text-left space-y-3">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/30">
              <Building2 className="w-7 h-7" />
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Portal Login Sistem Terpadu
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Pesantren Modern Darul Ulum • Smart Permit &amp; Smart Ri'ayah
              </p>
            </div>

            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-semibold border border-emerald-200 shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Area Terproteksi Sistem Keamanan Pondok</span>
              </span>
            </div>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 shadow-xs animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Form Login */}
          <form className="space-y-4 pt-1" onSubmit={handleSubmit}>
            {/* Username / Email Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Username / Email Akun
              </label>
              <div className="relative rounded-xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4 text-emerald-600" />
                </div>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrorMessage('');
                  }}
                  placeholder="contoh: superadmin@gmail.com"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Password
                </label>
              </div>
              <div className="relative rounded-xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4 text-emerald-600" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMessage('');
                  }}
                  placeholder="Masukkan password akun..."
                  className="block w-full pl-10 pr-10 py-2.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition font-mono"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition"
                  title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Memverifikasi kredensial...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Masuk ke Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Collapsible Panel: Demo Accounts One-Click Quick Fill (7 Role Akses) */}
          <div className="pt-3 border-t border-slate-200/80">
            <button
              type="button"
              onClick={() => setIsDemoPanelOpen(!isDemoPanelOpen)}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100/90 border border-slate-200 text-slate-700 text-xs font-bold transition"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Pilih Akun Demo (7 Role Akses)</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span>{isDemoPanelOpen ? 'Tutup' : 'Lihat'}</span>
                {isDemoPanelOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </button>

            {isDemoPanelOpen && (
              <div className="mt-3 space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {accounts.map((acc, idx) => {
                  const Icon = roleIcons[acc.role] || ShieldCheck;
                  const isCurrent = email.toLowerCase() === acc.email.toLowerCase();

                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => handleSelectDemoAccount(acc)}
                      className={`w-full text-left p-2.5 rounded-xl border transition flex items-center justify-between gap-3 ${
                        isCurrent
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-2xs'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`p-1.5 rounded-lg shrink-0 ${
                          isCurrent ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-500'
                        }`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="truncate">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold truncate">
                              {acc.roleName}
                            </span>
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-500">
                              Role {idx + 1}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono truncate">
                            {acc.email} • pass: <span className="text-emerald-700 font-semibold">{acc.password}</span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isCurrent ? (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-700 font-bold bg-emerald-100/90 px-2.5 py-0.5 rounded-full border border-emerald-300">
                            <Check className="w-3 h-3" />
                            Dipilih
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md font-semibold transition">
                            Gunakan
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Copyright */}
          <div className="pt-2 text-center text-[11px] text-slate-400">
            © {new Date().getFullYear()} Pesantren Modern Darul Ulum • Smart Permit &amp; Ri'ayah v3.8
          </div>

        </div>
      </div>

    </div>
  );
}
