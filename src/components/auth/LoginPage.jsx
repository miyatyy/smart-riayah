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
  TrendingUp
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
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans relative selection:bg-emerald-500 selection:text-white">
      
      {/* Background Subtle Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-80 bg-gradient-to-b from-emerald-100/60 via-teal-50/30 to-transparent pointer-events-none blur-2xl" />

      {/* Back to Home Button */}
      <div className="absolute top-6 left-6 z-10">
        <button
          onClick={() => navigateTo('landing')}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 transition text-xs font-semibold shadow-xs"
        >
          <ArrowLeft className="w-4 h-4 text-emerald-600" />
          <span>Kembali ke Beranda</span>
        </button>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {/* Brand Icon */}
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20 flex items-center justify-center">
            <Building2 className="w-7 h-7" />
          </div>
        </div>

        <h2 className="mt-4 text-center text-2xl font-black text-slate-900 tracking-tight">
          Portal Login Sistem Terpadu
        </h2>
        <p className="mt-1 text-center text-xs text-slate-500">
          Pesantren Modern Darul Ulum • Smart Permit & Smart Ri'ayah
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white py-7 px-5 sm:px-8 shadow-sm hover:shadow-md transition rounded-2xl sm:rounded-3xl border border-slate-200/90 space-y-5">
          
          {/* Error Alert */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 shadow-xs animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Login Form */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Email / Username Field */}
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
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-50/80 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
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
                  className="block w-full pl-10 pr-10 py-2.5 bg-slate-50/80 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
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
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-sm hover:shadow transition disabled:opacity-50"
              >
                {loading ? (
                  <span>Memverifikasi kredensial...</span>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Masuk ke Dashboard</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Collapsible Panel: Demo Accounts One-Click Quick Fill (Tersimpan rapi di dalam Accordion) */}
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsDemoPanelOpen(!isDemoPanelOpen)}
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 text-slate-600 hover:text-slate-900 text-xs font-semibold transition"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Pilih Akun Demo (7 Role Akses)</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span>{isDemoPanelOpen ? 'Tutup' : 'Lihat'}</span>
                {isDemoPanelOpen ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
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
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`p-1.5 rounded-lg shrink-0 ${
                          isCurrent ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
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
                          <span className="flex items-center gap-1 text-[10px] text-emerald-700 font-bold bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300">
                            <Check className="w-3 h-3" />
                            Dipilih
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 hover:text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
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

        </div>
      </div>
    </div>
  );
}
