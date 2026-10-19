import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Smartphone,
  X,
  Copy,
  Check,
  Server,
  Zap,
  Globe,
  Radio,
  FileCode,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Terminal,
  Download
} from 'lucide-react';
import { sound } from '../../utils/audio';

export default function FlutterIntegrationModal({ isOpen, onClose }) {
  const { santriList, permits } = useApp();
  const [activeTab, setActiveTab] = useState('guide'); // 'guide' | 'code' | 'test' | 'architecture'
  const [copiedCode, setCopiedCode] = useState(false);
  const [testApiResult, setTestApiResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [serverHost, setServerHost] = useState(
    typeof window !== 'undefined' ? `${window.location.hostname}:5000` : 'localhost:5000'
  );

  if (!isOpen) return null;

  const flutterDartCode = `// lib/services/smart_riayah_api.dart
// Integrasi Flutter Mobile (Android/iOS) ke Backend Smart Riayah & Smart Permit
import 'dart:convert';
import 'package:http/http.dart' as http;

class SmartRiayahApi {
  // Ganti IP sesuai IP WiFi Laptop/Server tempat Backend Smart Riayah berjalan
  static const String baseUrl = 'http://${serverHost}/api';

  // 1. Ambil Data Santri (Saldo RFID, Poin Disiplin, Status Asrama)
  static Future<List<dynamic>> fetchSantri() async {
    final response = await http.get(Uri.parse('$baseUrl/santri'));
    if (response.statusCode == 200) {
      final json = jsonDecode(response.body);
      return json['data'] ?? [];
    } else {
      throw Exception('Gagal memuat data santri: \${response.statusCode}');
    }
  }

  // 2. Ambil Daftar Izin Santri (Smart Permit)
  static Future<List<dynamic>> fetchPermits({String? status, String? santriId}) async {
    final queryParams = <String, String>{};
    if (status != null) queryParams['status'] = status;
    if (santriId != null) queryParams['santriId'] = santriId;

    final uri = Uri.parse('$baseUrl/permits').replace(queryParameters: queryParams);
    final response = await http.get(uri);
    if (response.statusCode == 200) {
      final json = jsonDecode(response.body);
      return json['data'] ?? [];
    }
    throw Exception('Gagal memuat izin santri');
  }

  // 3. Pengajuan Izin Baru dari Wali Santri (Mobile)
  static Future<bool> submitPermit({
    required String santriId,
    required String kategori,
    required String keperluan,
    required String penjemput,
    required String batasKembali,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/permits'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'santriId': santriId,
        'kategori': kategori,
        'keperluan': keperluan,
        'penjemput': penjemput,
        'batasKembali': batasKembali,
      }),
    );
    return response.statusCode == 200 || response.statusCode == 201;
  }

  // 4. Verifikasi Tap Kartu RFID (ESP32 IoT Turnstile Gate)
  static Future<Map<String, dynamic>> verifyRfid({
    required String rfidUid,
    String gateId = 'GATE-01',
    String direction = 'EXIT',
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/gate/verify-rfid'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'rfidUid': rfidUid,
        'gateId': gateId,
        'direction': direction,
      }),
    );
    return jsonDecode(response.body);
  }
}
`;

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(flutterDartCode);
    setCopiedCode(true);
    sound.playSuccess?.();
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleTestApi = async (endpoint) => {
    setIsTesting(true);
    setTestApiResult(null);
    sound.playBeep?.();
    const startTime = Date.now();

    try {
      // In browser, try backend port 5000 or relative /api
      const targetUrl = `http://${serverHost}/api${endpoint}`;
      const res = await fetch(targetUrl, { signal: AbortSignal.timeout(4000) });
      const latency = Date.now() - startTime;
      const data = await res.json();
      setTestApiResult({
        success: res.ok,
        status: res.status,
        url: targetUrl,
        latencyMs: latency,
        data
      });
      sound.playSuccess?.();
    } catch (err) {
      const latency = Date.now() - startTime;
      // Provide helpful fallback demonstration if local port 5000 isn't started yet
      setTestApiResult({
        success: false,
        status: 'FETCH_ERROR',
        url: `http://${serverHost}/api${endpoint}`,
        latencyMs: latency,
        error: err.message,
        tip: 'Jalankan backend dengan perintah: npm run server (atau node server/index.js) pada port 5000!'
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fade-in select-none">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-900 via-cyan-900 to-slate-950 text-white p-4 sm:p-5 flex items-center justify-between shrink-0 border-b border-cyan-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-md">
              <Smartphone className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                  Koneksi Mobile Flutter & REST API
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/30 text-cyan-200 border border-cyan-400/30 font-bold">
                  Flutter 3.x • Dart
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-semibold">
                  REST API Ready
                </span>
              </div>
              <p className="text-[11px] text-cyan-100 mt-0.5">
                Panduan dan modul penghubung aplikasi Android / iOS berbasis Flutter ke sistem Smart Riayah
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 px-4 py-2 bg-slate-50 border-b border-slate-200 overflow-x-auto shrink-0 text-xs font-bold">
          <button
            onClick={() => setActiveTab('guide')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
              activeTab === 'guide'
                ? 'bg-cyan-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>1. Cara Hubungkan Flutter</span>
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
              activeTab === 'code'
                ? 'bg-cyan-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>2. Kode Dart Siap Pakai</span>
          </button>

          <button
            onClick={() => setActiveTab('test')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
              activeTab === 'test'
                ? 'bg-cyan-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>3. Uji Coba API Langsung</span>
          </button>

          <button
            onClick={() => setActiveTab('architecture')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
              activeTab === 'architecture'
                ? 'bg-cyan-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>4. Arsitektur Web & Mobile</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 text-slate-800 text-xs leading-relaxed">
          
          {/* TAB 1: Panduan Hubungkan Flutter */}
          {activeTab === 'guide' && (
            <div className="space-y-4">
              <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 text-sky-900">
                <div className="flex items-center gap-2 font-bold text-sm mb-1 text-sky-950">
                  <CheckCircle2 className="w-4 h-4 text-sky-600" />
                  <span>Jawaban: Ya, Smart Riayah Sangat Bisa Dihubungkan ke Flutter!</span>
                </div>
                <p className="text-xs text-sky-800 leading-relaxed">
                  Smart Riayah dibangun dengan arsitektur <b>Decoupled RESTful API</b>. Seluruh modul utama
                  (Data Santri, Perizinan Smart Permit, Verifikasi RFID Gate, Poin Kedisiplinan, hingga Evaluasi AI)
                  menyediakan endpoint JSON yang dapat dikonsumsi langsung oleh aplikasi Flutter di smartphone Android maupun iPhone.
                </p>
              </div>

              {/* 3 Opsi Penghubung */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-cyan-300 transition">
                  <span className="text-[10px] font-mono uppercase bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded font-bold">
                    OPSI A (Native REST API)
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm mt-1.5 mb-1">
                    Flutter Native App
                  </h4>
                  <p className="text-[11px] text-slate-600">
                    Gunakan <code>http</code> atau <code>dio</code> di Flutter untuk memanggil endpoint <code>http://localhost:5000/api</code>. Sangat cepat, tampilan 100% native widget.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-emerald-300 transition">
                  <span className="text-[10px] font-mono uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                    OPSI B (In-App WebView)
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm mt-1.5 mb-1">
                    Flutter WebView Wrapper
                  </h4>
                  <p className="text-[11px] text-slate-600">
                    Karena UI web Smart Riayah sudah <b>100% responsif auto-adaptif</b>, Anda dapat membungkusnya dalam widget <code>webview_flutter</code> dengan 1 halaman saja!
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-purple-300 transition">
                  <span className="text-[10px] font-mono uppercase bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-bold">
                    OPSI C (PWA Homescreen)
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm mt-1.5 mb-1">
                    Install PWA di HP
                  </h4>
                  <p className="text-[11px] text-slate-600">
                    Wali santri cukup membuka web di Chrome HP lalu tap "Tambahkan ke Layar Utama". Aplikasi langsung berjalan layar penuh tanpa unduh Play Store!
                  </p>
                </div>
              </div>

              {/* Langkah Instalasi Flutter Client */}
              <div className="bg-slate-900 text-white rounded-2xl p-4 font-mono text-[11px] space-y-2">
                <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2">
                  <span className="flex items-center gap-1.5 text-cyan-300 font-bold">
                    <Terminal className="w-3.5 h-3.5" /> Langkah Cepat Menjalankan Flutter Client:
                  </span>
                  <span>Terminal</span>
                </div>
                <p className="text-slate-300"># 1. Masuk ke folder flutter_client yang sudah disiapkan</p>
                <p className="text-emerald-400 font-bold">cd flutter_client</p>
                <p className="text-slate-300"># 2. Unduh dependensi package http</p>
                <p className="text-emerald-400 font-bold">flutter pub get</p>
                <p className="text-slate-300"># 3. Jalankan di HP Android / Emulator / Chrome</p>
                <p className="text-emerald-400 font-bold">flutter run</p>
              </div>
            </div>
          )}

          {/* TAB 2: Kode Dart Siap Pakai */}
          {activeTab === 'code' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-slate-100 p-3 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Host Server Backend:</span>
                  <input
                    type="text"
                    value={serverHost}
                    onChange={(e) => setServerHost(e.target.value)}
                    placeholder="localhost:5000 atau 192.168.1.5:5000"
                    className="font-mono text-xs px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-bold transition shadow-xs"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Tersalin ke Clipboard!' : 'Salin Kode Dart'}</span>
                </button>
              </div>

              <div className="relative rounded-2xl bg-slate-950 border border-slate-800 text-slate-200 font-mono text-[11px] p-4 overflow-x-auto max-h-[50vh]">
                <pre>{flutterDartCode}</pre>
              </div>
            </div>
          )}

          {/* TAB 3: Uji Coba API Langsung */}
          {activeTab === 'test' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl space-y-2">
                <h4 className="font-bold text-slate-900 text-xs">
                  Tes Endpoint REST API (Simulasi Request dari Flutter):
                </h4>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleTestApi('/health')}
                    disabled={isTesting}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 transition"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>GET /api/health (Status DB)</span>
                  </button>

                  <button
                    onClick={() => handleTestApi('/santri')}
                    disabled={isTesting}
                    className="px-3 py-1.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs flex items-center gap-1 transition"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>GET /api/santri (Data Santri)</span>
                  </button>

                  <button
                    onClick={() => handleTestApi('/permits')}
                    disabled={isTesting}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1 transition"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>GET /api/permits (Smart Permit)</span>
                  </button>
                </div>
              </div>

              {/* Result display */}
              {isTesting && (
                <div className="p-4 rounded-2xl bg-slate-100 text-slate-600 text-xs font-mono animate-pulse flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping" />
                  <span>Mengirim HTTP GET request ke backend server...</span>
                </div>
              )}

              {testApiResult && (
                <div className={`p-4 rounded-2xl border text-xs font-mono space-y-2 ${
                  testApiResult.success
                    ? 'bg-emerald-950/20 border-emerald-400 text-emerald-950'
                    : 'bg-amber-50 border-amber-300 text-amber-900'
                }`}>
                  <div className="flex items-center justify-between font-bold">
                    <span>Target: {testApiResult.url}</span>
                    <span className="px-2 py-0.5 rounded bg-white border text-[10px]">
                      ⏱️ {testApiResult.latencyMs} ms • Status: {testApiResult.status}
                    </span>
                  </div>

                  {testApiResult.tip && (
                    <div className="p-2.5 rounded-xl bg-amber-100 border border-amber-300 text-amber-900 text-[11px]">
                      💡 <b>Info:</b> {testApiResult.tip}
                    </div>
                  )}

                  <div className="bg-slate-900 text-slate-200 p-3 rounded-xl overflow-x-auto max-h-48 text-[11px]">
                    <pre>{JSON.stringify(testApiResult.data || { error: testApiResult.error }, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Arsitektur Web & Mobile */}
          {activeTab === 'architecture' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center">
                <div className="p-4 rounded-2xl bg-cyan-50 border border-cyan-200">
                  <div className="w-10 h-10 mx-auto rounded-full bg-cyan-600 text-white flex items-center justify-center font-bold mb-2">
                    1
                  </div>
                  <h4 className="font-bold text-slate-900">Flutter Mobile App</h4>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Aplikasi dipegang oleh Wali Santri & Musyrif di smartphone untuk ajukan izin, cek buku mutaba'ah, dan terima push notif.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <div className="w-10 h-10 mx-auto rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold mb-2">
                    2
                  </div>
                  <h4 className="font-bold text-slate-900">Node.js Express + Postgres</h4>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Backend pusat yang memproses otorisasi izin, audit log anti-bypass, scoring AI, dan kirim notifikasi WhatsApp Fonnte.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-100 border border-slate-300">
                  <div className="w-10 h-10 mx-auto rounded-full bg-slate-800 text-white flex items-center justify-center font-bold mb-2">
                    3
                  </div>
                  <h4 className="font-bold text-slate-900">ESP32 IoT Turnstile Gate</h4>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Hardware gerbang fisik membaca kartu RFID 13.56 MHz, memverifikasi izin santri ke backend dalam 50 milidetik.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 font-mono">
            Smart Riayah Pesantren Darul Ulum © 2026
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
}
