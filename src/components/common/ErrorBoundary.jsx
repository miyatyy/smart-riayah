import React from 'react';
import { ShieldAlert, RefreshCw, Home, AlertCircle } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('💥 [ErrorBoundary] Caught unhandled runtime error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReloadAndClearCache = () => {
    try {
      if ('caches' in window) {
        caches.keys().then((names) => {
          names.forEach((name) => caches.delete(name));
        });
      }
      sessionStorage.clear();
    } catch (e) {
      console.warn('Cache clearing error:', e);
    }
    window.location.reload(true);
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 text-white flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900/90 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl text-center space-y-5 animate-fade-in">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-inner">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-mono font-bold tracking-widest text-emerald-400 uppercase bg-emerald-950/60 border border-emerald-500/30 px-3 py-1 rounded-full">
                Smart Permit &amp; Smart Ri'ayah
              </span>
              <h2 className="text-xl font-black text-white tracking-tight">
                Penyegaran Aplikasi Diperlukan
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Sistem mendeteksi pembaruan versi terbaru pada browser Anda. Silakan klik tombol di bawah untuk memuat ulang antarmuka sistem secara bersih.
              </p>
            </div>

            {this.state.error && (
              <div className="text-left bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-[11px] font-mono text-rose-300/90 overflow-x-auto max-h-32">
                <div className="flex items-center gap-1.5 font-bold text-rose-400 mb-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Detail Sistem:</span>
                </div>
                <div className="break-all">{this.state.error?.toString()}</div>
              </div>
            )}

            <div className="space-y-2.5 pt-2">
              <button
                onClick={this.handleReloadAndClearCache}
                className="w-full py-3 px-4 rounded-xl font-black text-xs sm:text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-900/50 flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>🔄 Muat Ulang &amp; Bersihkan Cache Browser</span>
              </button>

              <button
                onClick={this.handleGoHome}
                className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Kembali ke Halaman Beranda</span>
              </button>
            </div>

            <p className="text-[10px] text-slate-500 font-mono">
              Pesantren Modern Darul Ulum • Smart Ri'ayah Security Shield
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
