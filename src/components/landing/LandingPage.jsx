import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  ShieldCheck, 
  Radio, 
  MessageSquare, 
  HeartHandshake, 
  ArrowRight, 
  Lock, 
  Cpu, 
  Sparkles, 
  Users, 
  Building2, 
  HeartPulse, 
  TrendingUp, 
  CheckCircle2, 
  Wifi, 
  Activity,
  Layers,
  Wrench,
  ChevronRight
} from 'lucide-react';

export default function LandingPage() {
  const { navigateTo } = useApp();

  const rolePortals = [
    {
      id: 'superadmin',
      roleNum: '01',
      title: 'Super Admin (Developer)',
      subtitle: 'Developer Console & IoT Diagnostics',
      desc: 'Pantau koneksi Web Serial ESP32-S3, status pinout GPIO hardware, live serial terminal, dan manajemen akun sistem.',
      icon: Cpu,
      iconColor: 'bg-cyan-50 text-cyan-600 border-cyan-200',
      badge: 'Developer Console',
      badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      hoverBorder: 'hover:border-cyan-400'
    },
    {
      id: 'admin_riayah',
      roleNum: '02',
      title: 'Admin Ri\'ayah',
      subtitle: 'Setting Builder Asrama & RFID',
      desc: 'Pengaturan kuota kapasitas kamar asrama putra & putri, onboarding santri baru, serta layanan penggantian kartu RFID hilang (revocation).',
      icon: Wrench,
      iconColor: 'bg-emerald-50 text-emerald-600 border-emerald-200',
      badge: 'Setting Builder',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      hoverBorder: 'hover:border-emerald-400'
    },
    {
      id: 'parent',
      roleNum: '03',
      title: 'Orang Tua / Wali Santri',
      subtitle: 'Portal Mobile-First & Pengajuan Izin',
      desc: 'Pengajuan surat izin digital santri dari rumah, pantau mutaba\'ah shalat/tahfidz, serta kontrol saldo dan limit transaksi cashless RFID.',
      icon: Users,
      iconColor: 'bg-emerald-50 text-emerald-600 border-emerald-200',
      badge: 'Mobile-First View',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      hoverBorder: 'hover:border-emerald-400'
    },
    {
      id: 'musyrif',
      roleNum: '04',
      title: 'Musyrif / Musyrifah',
      subtitle: 'Otorisasi Izin & Pembinaan Ri\'ayah',
      desc: 'Verifikasi multi-tier permohonan izin santri/santriwati, pencatatan buku poin adab & pelanggaran, serta monitoring kamar asrama.',
      icon: ShieldCheck,
      iconColor: 'bg-teal-50 text-teal-600 border-teal-200',
      badge: 'Otorisasi Izin',
      badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
      hoverBorder: 'hover:border-teal-400'
    },
    {
      id: 'security',
      roleNum: '05',
      title: 'Pos Satpam (Keamanan)',
      subtitle: 'Command Center & IoT Smart Gate',
      desc: 'Simulator gerbang turnstile otomatis, pembacaan RFID RC522 13.56 MHz, Virtual OLED SSD1306, alarm anti-bypass, & auto countdown.',
      icon: Radio,
      iconColor: 'bg-cyan-50 text-cyan-600 border-cyan-200',
      badge: 'IoT Smart Gate',
      badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      hoverBorder: 'hover:border-cyan-400'
    },
    {
      id: 'poskestren',
      roleNum: '06',
      title: 'Medis UKS / Poskestren',
      subtitle: 'Rekam Medis & Rujukan RS Terpadu',
      desc: 'Pemeriksaan kesehatan harian santri, riwayat alergi, dispensasi istirahat asrama, serta auto-generate izin darurat ke rumah sakit rujukan.',
      icon: HeartPulse,
      iconColor: 'bg-rose-50 text-rose-600 border-rose-200',
      badge: 'Klinik Asrama',
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
      hoverBorder: 'hover:border-rose-400'
    },
    {
      id: 'kyai',
      roleNum: '07',
      title: 'Pimpinan Pondok (Mudir)',
      subtitle: 'Executive Analytics & DSS Pondok',
      desc: 'Dashboard analitik eksekutif pengasuh pondok, visualisasi tren perizinan berkala, headcount asrama putra/putri, & rapor kepribadian.',
      icon: TrendingUp,
      iconColor: 'bg-amber-50 text-amber-600 border-amber-200',
      badge: 'Decision Support',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      hoverBorder: 'hover:border-amber-400'
    }
  ];

  const pillarFeatures = [
    {
      title: 'Multi-Tier Digital Permit',
      desc: 'Alur persetujuan terstruktur dari Wali Santri -> Musyrif Asrama -> Pos Keamanan Gate. Tidak ada lagi surat izin kertas yang mudah tercecer atau dipalsukan.',
      icon: ShieldCheck,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200'
    },
    {
      title: 'IoT Smart Gate Anti-Bypass',
      desc: 'Terintegrasi mikrokontroler ESP32-S3 dan pembaca RFID RC522 13.56 MHz. Palang gerbang otomatis mengunci jika kartu belum memiliki status perizinan APPROVED.',
      icon: Radio,
      color: 'text-cyan-700 bg-cyan-50 border-cyan-200'
    },
    {
      title: 'Real-Time WhatsApp Gateway',
      desc: 'Setiap aksi tap kartu di gerbang, peringatan batas waktu H-30 menit, dan alarm darurat keterlambatan (overdue) langsung terkirim ke WhatsApp ponsel orang tua.',
      icon: MessageSquare,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200'
    },
    {
      title: 'Smart Ri\'ayah Holistic Care',
      desc: 'Pengasuhan komprehensif asrama putra dan putri: mutaba\'ah ibadah, rekam medis poskestren, pembukuan poin kedisiplinan, hingga dompet digital kantin mandiri.',
      icon: HeartHandshake,
      color: 'text-amber-700 bg-amber-50 border-amber-200'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-emerald-500 selection:text-white">
      
      {/* 1. Header / Top Navigation */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          
          {/* Logo & Identity */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-base tracking-tight text-slate-900">
                  SMART PERMIT & RI'AYAH
                </span>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.2 rounded-full font-mono font-bold">
                  v3.8
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Pesantren Modern Darul Ulum
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const el = document.getElementById('role-portal-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition"
            >
              <Users className="w-3.5 h-3.5 text-emerald-600" />
              <span>Daftar 7 Role</span>
            </button>

            <button
              onClick={() => navigateTo('login')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs hover:shadow transition"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Masuk Portal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section with Generated Santri Putra & Putri Smart Gate Illustration */}
      <section className="relative pt-10 pb-16 lg:pt-16 lg:pb-20 overflow-hidden">
        {/* Subtle Ambient Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-96 bg-gradient-to-b from-emerald-100/50 via-teal-50/20 to-transparent pointer-events-none blur-3xl" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left Hero Content */}
            <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
              
              {/* Badge: Hardware Ready */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono font-medium shadow-xs">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                </span>
                <span>IoT ESP32-S3 & RFID 13.56 MHz Ready</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                Sistem Ekosistem Cerdas{' '}
                <span className="text-emerald-700">
                  Smart Permit & Smart Ri'ayah
                </span>
              </h1>

              {/* Sub-headline */}
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto lg:mx-0">
                Transformasi digital pesantren modern terintegrasi gerbang turnstile otomatis IoT ESP32-S3, kartu pintar RFID RC522 anti-bypass, notifikasi WhatsApp real-time wali santri, dan pengasuhan holistik asrama putra & putri.
              </p>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
                <button
                  onClick={() => navigateTo('login')}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs hover:shadow flex items-center justify-center gap-2 transition"
                >
                  <Lock className="w-4 h-4" />
                  <span>Masuk ke Portal Sistem</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    const el = document.getElementById('role-portal-section');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl font-semibold text-xs sm:text-sm bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center gap-2 transition shadow-xs"
                >
                  <Layers className="w-4 h-4 text-emerald-600" />
                  <span>Pilih 7 Hak Akses Role</span>
                </button>
              </div>

              {/* Bullet Highlights */}
              <div className="pt-2 grid grid-cols-2 sm:grid-cols-3 gap-3 text-left">
                <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
                  <div className="text-emerald-700 font-bold text-xs flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Multi-Tier Permit</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">Approval berjenjang resmi</p>
                </div>
                <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
                  <div className="text-cyan-700 font-bold text-xs flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5" />
                    <span>Anti-Bypass Lock</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">Palang otomatis terkunci</p>
                </div>
                <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs col-span-2 sm:col-span-1">
                  <div className="text-emerald-700 font-bold text-xs flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Live WA Gateway</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">Notif tap gerbang ke wali</p>
                </div>
              </div>
            </div>

            {/* Right Hero Image: Santri & Santriwati Smart Gate */}
            <div className="lg:col-span-6 relative">
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-md bg-white">
                
                {/* Main Illustration Image */}
                <img 
                  src="/images/santri_smart_gate.jpg" 
                  alt="Ilustrasi Santri dan Santriwati Pesantren Modern Darul Ulum sedang tap kartu RFID di IoT Smart Turnstile Gate"
                  className="w-full h-auto object-cover"
                />

                {/* Floating Clean Badge 1: Santri Putra & Putri */}
                <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2">
                  <div className="flex -space-x-1.5 overflow-hidden">
                    <img 
                      src="/images/avatar_santri_putra.jpg" 
                      alt="Santri Putra" 
                      className="inline-block h-7 w-7 rounded-full ring-2 ring-white object-cover" 
                    />
                    <img 
                      src="/images/avatar_santri_putri.jpg" 
                      alt="Santriwati Putri" 
                      className="inline-block h-7 w-7 rounded-full ring-2 ring-white object-cover" 
                    />
                  </div>
                  <div className="text-left">
                    <span className="text-[11px] font-bold text-slate-800 block leading-tight">
                      Santri & Santriwati
                    </span>
                    <span className="text-[10px] text-emerald-700 font-mono">
                      Smart Card Multi-Use
                    </span>
                  </div>
                </div>

                {/* Floating Clean Badge 2: Live Gate Actuator */}
                <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <div className="text-left">
                    <span className="text-[11px] font-mono font-bold text-slate-800 block leading-tight">
                      ESP32-S3 + RC522
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Virtual OLED & Servo Lock
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 3. Four Core Pillars Section */}
      <section className="py-14 bg-white border-y border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <span className="text-xs font-mono font-bold text-emerald-700 uppercase tracking-widest block mb-1">
              ARSITEKTUR TERPADU
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              4 Pilar Utama Keunggulan Sistem
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-1.5">
              Sinergi antara perangkat keras IoT mikrokontroler dan sistem informasi pengasuhan pesantren modern.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {pillarFeatures.map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <div 
                  key={idx}
                  className="bg-slate-50/70 hover:bg-white border border-slate-200/90 hover:border-emerald-300 p-5 rounded-2xl shadow-xs hover:shadow-sm transition duration-200 group"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border mb-3.5 ${feat.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition">
                    {feat.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    {feat.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. Seven Role Portals Access Section */}
      <section id="role-portal-section" className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono mb-2">
                <Users className="w-3.5 h-3.5" />
                <span>PILIH ROLE PENGGUNA</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Portal Akses Pengguna (7 Hak Akses Role)
              </h2>
              <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-xl">
                Klik salah satu kartu role di bawah ini untuk langsung masuk ke Halaman Login dengan kredensial yang disesuaikan.
              </p>
            </div>

            <button
              onClick={() => navigateTo('login')}
              className="self-start md:self-auto flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-xs transition"
            >
              <span>Semua Login Role</span>
              <ChevronRight className="w-4 h-4 text-emerald-600" />
            </button>
          </div>

          {/* Grid of 7 Role Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {rolePortals.map((r) => {
              const Icon = r.icon;
              return (
                <div
                  key={r.id}
                  onClick={() => navigateTo('login', r.id)}
                  className={`bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-sm cursor-pointer transition-all duration-200 ${r.hoverBorder} flex flex-col justify-between group`}
                >
                  {/* Top Bar of Card */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3.5">
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${r.badgeColor}`}>
                        Role {r.roleNum}: {r.badge}
                      </span>
                      <div className={`p-2 rounded-xl border ${r.iconColor}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition">
                      {r.title}
                    </h3>
                    <h4 className="text-xs font-medium text-slate-500 mb-2">
                      {r.subtitle}
                    </h4>

                    <p className="text-xs text-slate-600 leading-relaxed mb-4">
                      {r.desc}
                    </p>
                  </div>

                  {/* Bottom Action */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-700 group-hover:text-emerald-800 transition">
                    <span>Masuk ke Dashboard Role Ini</span>
                    <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition" />
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* 5. Footer */}
      <footer className="py-8 bg-white border-t border-slate-200 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-800 block text-xs">
                Pesantren Modern Darul Ulum
              </span>
              <span className="text-[11px] text-slate-400">
                Sistem Smart Permit & Smart Ri'ayah v3.8
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
            <span>Web Serial API</span>
            <span>•</span>
            <span>ESP32-S3 Hardware</span>
            <span>•</span>
            <span>RFID 13.56 MHz RC522</span>
            <span>•</span>
            <span>WhatsApp Gateway</span>
          </div>

          <div className="text-center sm:text-right">
            <p className="text-slate-600 font-medium">Tugas Akhir Sistem Cerdas © 2026</p>
            <p className="text-[10px] text-slate-400">All Rights Reserved</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
