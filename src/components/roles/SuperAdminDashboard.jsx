import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Cpu, 
  Terminal, 
  Wifi, 
  Radio, 
  ShieldCheck, 
  Users, 
  Database, 
  Download, 
  Upload, 
  RotateCcw, 
  Sparkles, 
  Check, 
  Copy, 
  Edit3, 
  Trash2, 
  PlusCircle, 
  Play, 
  AlertTriangle, 
  Activity,
  Layers,
  ArrowRight,
  ExternalLink,
  Lock,
  KeyRound,
  FileCode2,
  CheckCircle2,
  Zap,
  Power,
  CreditCard
} from 'lucide-react';
import RfidCardManager from '../modules/RfidCardManager';
import ExpressPermitKiosk from '../modules/ExpressPermitKiosk';
import FonnteSettingsBox from '../common/FonnteSettingsBox';
import SantriActivityAnalytics from '../modules/SantriActivityAnalytics';

export default function SuperAdminDashboard() {
  const { 
    isSerialConnected, 
    connectSerial, 
    disconnectSerial, 
    sendCustomCommand, 
    serialRawLogs, 
    accounts, 
    updateAccount, 
    addAccount, 
    exportSystemData, 
    importSystemData, 
    resetAllDataToDefault, 
    setRole,
    santriList,
    permits,
    rooms,
    blacklistedUids,
    gateLogs,
    activeRoleTab,
    setActiveRoleTab,
    triggerYellowLedVirtual
  } = useApp();

  const activeTab = (activeRoleTab === 'diagnostics' || activeRoleTab === 'users' || activeRoleTab === 'database' || activeRoleTab === 'rfid_cards' || activeRoleTab === 'rfid_pairing' || activeRoleTab === 'express_kiosk' || activeRoleTab === 'ai_agent') ? activeRoleTab : 'diagnostics';
  const setActiveTab = setActiveRoleTab;
  const [customCmd, setCustomCmd] = useState('');
  const [editingAccount, setEditingAccount] = useState(null);
  const [copiedFirmware, setCopiedFirmware] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [newAccData, setNewAccData] = useState({
    role: 'musyrif',
    roleName: 'Musyrif Pembantu',
    email: '',
    password: '',
    nama: '',
    jabatan: 'Musyrif Kamar Baru'
  });

  const esp32Pinouts = [
    { pin: 'GPIO 10', func: 'SDA / SS (RC522)', desc: 'Slave Select SPI RFID Reader', color: 'text-cyan-400 bg-cyan-950/60 border-cyan-800' },
    { pin: 'GPIO 11', func: 'MOSI (RC522)', desc: 'Master Out Slave In SPI Line', color: 'text-cyan-400 bg-cyan-950/60 border-cyan-800' },
    { pin: 'GPIO 12', func: 'SCK (RC522)', desc: 'SPI Serial Clock', color: 'text-cyan-400 bg-cyan-950/60 border-cyan-800' },
    { pin: 'GPIO 13', func: 'MISO (RC522)', desc: 'Master In Slave Out SPI Line', color: 'text-cyan-400 bg-cyan-950/60 border-cyan-800' },
    { pin: 'GPIO 9',  func: 'RST (RC522)', desc: 'Reset Pin Modul RFID', color: 'text-cyan-400 bg-cyan-950/60 border-cyan-800' },
    { pin: 'GPIO 15', func: 'BUZZER I/O', desc: 'Sinyal Audio Aktuator 3-Pin', color: 'text-amber-400 bg-amber-950/60 border-amber-800' },
    { pin: 'GPIO 17', func: 'LED HIJAU (+)', desc: 'Kontrol Anoda Akses Diterima (Granted)', color: 'text-emerald-400 bg-emerald-950/60 border-emerald-800' },
    { pin: 'GPIO 16', func: 'LED HIJAU (-)', desc: 'Ground Katoda Permanen (0V)', color: 'text-slate-400 bg-slate-900 border-slate-700' },
    { pin: 'GPIO 18', func: 'LED MERAH (+)', desc: 'Kontrol Anoda Akses Ditolak (Denied)', color: 'text-rose-400 bg-rose-950/60 border-rose-800' },
    { pin: 'GPIO 8',  func: 'LED MERAH (-)', desc: 'Ground Katoda Permanen (0V)', color: 'text-slate-400 bg-slate-900 border-slate-700' },
    { pin: 'VIRTUAL', func: 'LED KUNING (LAYAR)', desc: 'Emulasi Software di Layar Laptop (Warning H-X & Scan, Tanpa Pin Fisik)', color: 'text-amber-300 bg-amber-950/60 border-amber-500 font-bold' },
  ];

  const firmwareCode = `/*
 * FIRMWARE RESMI ESP32-S3 BREADBOARD EDITION
 * SISTEM SMART PERMIT & SMART RI'AYAH PESANTREN MODERN DARUL ULUM
 * Baud Rate: 115200 bps
 */
#include <SPI.h>
#include <MFRC522.h>

#define RST_PIN  9
#define SS_PIN   10
#define MOSI_PIN 11
#define SCK_PIN  12
#define MISO_PIN 13
#define BUZZER   15
#define LED_G_P  17
#define LED_G_N  16
#define LED_R_P  18
#define LED_R_N  8

MFRC522 mfrc522(SS_PIN, RST_PIN);

void setup() {
  Serial.begin(115200);
  pinMode(BUZZER, OUTPUT);
  pinMode(LED_G_P, OUTPUT);
  pinMode(LED_G_N, OUTPUT);
  pinMode(LED_R_P, OUTPUT);
  pinMode(LED_R_N, OUTPUT);
  digitalWrite(LED_G_N, LOW);
  digitalWrite(LED_R_N, LOW);

  SPI.begin(SCK_PIN, MISO_PIN, MOSI_PIN, SS_PIN);
  mfrc522.PCD_Init();
  Serial.println("SYSTEM:ESP32S3_SMART_GATE_READY");
}

void loop() {
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\\n');
    cmd.trim();
    if (cmd == "CMD:OPEN_GATE" || cmd == "CMD:WELCOME_BACK") {
      digitalWrite(LED_G_P, HIGH);
      tone(BUZZER, 2000, 200);
      delay(3000);
      digitalWrite(LED_G_P, LOW);
    } else if (cmd == "CMD:DENY_GATE") {
      digitalWrite(LED_R_P, HIGH);
      for(int i=0; i<3; i++) {
        tone(BUZZER, 800, 150);
        delay(200);
      }
      digitalWrite(LED_R_P, LOW);
    }
  }

  if (!mfrc522.PICC_IsNewCardPresent() || !mfrc522.PICC_ReadCardSerial()) return;

  String uidStr = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    if (mfrc522.uid.uidByte[i] < 0x10) uidStr += "0";
    uidStr += String(mfrc522.uid.uidByte[i], HEX);
    if (i < mfrc522.uid.size - 1) uidStr += ":";
  }
  uidStr.toUpperCase();
  Serial.println("RFID_TAP:" + uidStr);
  tone(BUZZER, 2400, 80);
  mfrc522.PICC_HaltA();
  delay(1000);
}`;

  const downloadFirmware = () => {
    const element = document.createElement("a");
    const file = new Blob([firmwareCode], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = "esp32s3_smart_permit.ino";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    sound.playSuccess();
  };

  const handleSendCmd = (e) => {
    e.preventDefault();
    if (!customCmd.trim()) return;
    sendCustomCommand(customCmd.trim() + '\n');
    setCustomCmd('');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const res = importSystemData(event.target.result);
      if (res.success) {
        alert('Database JSON berhasil direstore ke sistem!');
      } else {
        alert(`Gagal import JSON: ${res.error}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-slate-950 text-slate-100 min-h-full pb-24 font-sans space-y-6 rounded-2xl">
      
      {/* 1. Header Developer Console */}
      <div className="bg-slate-900/90 border border-cyan-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-600 to-slate-900 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shadow-lg shadow-cyan-950">
            <Cpu className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Super Admin & Developer Console
              </h1>
              <span className="text-[10px] bg-cyan-950 text-cyan-300 font-mono font-bold px-2.5 py-0.5 rounded-full border border-cyan-700">
                ROOT PRIVILEGE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Diagnostik Hardware Web Serial ESP32-S3, Manajemen Akun (7 Role), & State Manager Database
            </p>
          </div>
        </div>

        {/* Web Serial Status Pill & Quick Connect Button */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono ${
            isSerialConnected 
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300' 
              : 'bg-slate-900 border-slate-700 text-slate-400'
          }`}>
            <span className={`h-2 w-2 rounded-full ${isSerialConnected ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
            <span>{isSerialConnected ? 'SERIAL: CONNECTED (115200 bps)' : 'SERIAL: DISCONNECTED'}</span>
          </div>

          {isSerialConnected ? (
            <button
              onClick={disconnectSerial}
              className="px-3.5 py-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-700/60 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <Power className="w-3.5 h-3.5" />
              <span>Putus</span>
            </button>
          ) : (
            <button
              onClick={connectSerial}
              className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-cyan-950 flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5 text-gold-300" />
              <span>Hubungkan ESP32</span>
            </button>
          )}
        </div>
      </div>

      {/* Live Fonnte WhatsApp Gateway Quick Configuration Box */}
      <FonnteSettingsBox defaultExpanded={false} />

      {/* 2. Navigation Tabs */}
      <div className="scroll-row border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('diagnostics')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs transition ${
            activeTab === 'diagnostics'
              ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>1. IoT & Web Serial Diagnostics</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs transition ${
            activeTab === 'users'
              ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>2. Manajemen Akun & 7 Role</span>
        </button>

        <button
          onClick={() => setActiveTab('database')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs transition ${
            activeTab === 'database'
              ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>3. Database & Quick-Switch Bypass</span>
        </button>

        <button
          onClick={() => setActiveTab('rfid_cards')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs transition ${
            activeTab === 'rfid_cards'
              ? 'border-emerald-400 text-emerald-300 bg-emerald-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <CreditCard className="w-4 h-4 text-emerald-400" />
          <span>4. Tabel Kartu Terdaftar ({santriList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('rfid_pairing')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs transition ${
            activeTab === 'rfid_pairing'
              ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Radio className="w-4 h-4 text-cyan-400" />
          <span>5. Scanner & Pasangkan Kartu (RC522)</span>
        </button>

        <button
          onClick={() => setActiveTab('express_kiosk')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs transition ${
            activeTab === 'express_kiosk'
              ? 'border-gold-400 text-gold-300 bg-gold-950/20 font-black'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-4 h-4 text-gold-400" />
          <span>6. Kiosk Izin Cepat (Tap & Permit)</span>
        </button>

        <button
          onClick={() => setActiveTab('ai_agent')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs transition ${
            activeTab === 'ai_agent'
              ? 'border-indigo-400 text-indigo-300 bg-indigo-950/30 font-black'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>7. AI Agent & Evaluasi DeepSeek</span>
        </button>
      </div>

      {/* TAB 1: IOT & SERIAL DIAGNOSTICS */}
      {activeTab === 'diagnostics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Interactive Pinout Board Schematic */}
            <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white">
                    Konfigurasi Wiring Pinout ESP32-S3 (Breadboard Single-Row)
                  </h3>
                </div>
                <button
                  onClick={downloadFirmware}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950 hover:bg-cyan-900 border border-cyan-700 text-cyan-300 text-xs font-bold transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh .ino Firmware</span>
                </button>
              </div>

              <p className="text-xs text-slate-400">
                Daftar pin fisik mikrokontroler ESP32-S3 yang terhubung ke modul pembaca RFID RC522 (13.56 MHz), Buzzer 3-Pin, LED Hijau (Granted), dan LED Merah (Denied).
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {esp32Pinouts.map((p, idx) => (
                  <div key={idx} className={`p-3 rounded-2xl border ${p.color} flex items-start justify-between gap-2`}>
                    <div>
                      <span className="text-xs font-mono font-black block tracking-wider">
                        {p.pin}
                      </span>
                      <span className="text-xs font-bold text-white">
                        {p.func}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {p.desc}
                      </p>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mt-1" />
                  </div>
                ))}
              </div>

              {/* Breadboard Note */}
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <span className="font-bold text-gold-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Catatan Hardware Breadboard:
                </span>
                <p>
                  Kedua LED (Hijau & Merah) menggunakan pin ESP32-S3 aktif sebagai Ground (GPIO 16 dan GPIO 8) yang diset ke LOW (0V) di dalam kode firmware sehingga rangkaian tidak memerlukan resistor eksternal tambahan pada breadboard.
                </p>
              </div>
            </div>

            {/* Right Column: Serial Command & Terminal Stream */}
            <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">
                      Live Serial Console (RX / TX Stream)
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    Baud: 115200
                  </span>
                </div>

                {/* Quick Command Triggers */}
                <div className="pt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => sendCustomCommand('CMD:OPEN_GATE\n')}
                    className="px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 rounded-lg text-xs font-mono font-bold transition"
                  >
                    CMD:OPEN_GATE
                  </button>
                  <button
                    onClick={() => sendCustomCommand('CMD:DENY_GATE\n')}
                    className="px-2.5 py-1 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-700/60 rounded-lg text-xs font-mono font-bold transition"
                  >
                    CMD:DENY_GATE
                  </button>
                  <button
                    onClick={() => sendCustomCommand('CMD:WELCOME_BACK\n')}
                    className="px-2.5 py-1 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 rounded-lg text-xs font-mono font-bold transition"
                  >
                    CMD:WELCOME_BACK
                  </button>
                  <button
                    onClick={() => triggerYellowLedVirtual?.(3500, 'TEST SERIAL: VIRTUAL_YELLOW_ON')}
                    className="px-2.5 py-1 bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-500/60 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1"
                    title="Uji coba nyala lampu LED Kuning virtual di layar laptop"
                  >
                    <span>💡 TEST:LED_YELLOW (LAYAR)</span>
                  </button>
                </div>

                {/* Terminal Stream Box */}
                <div className="mt-3 bg-black/90 border border-slate-800 rounded-2xl p-3 font-mono text-[11px] h-60 overflow-y-auto space-y-1 dark-scroll">
                  {serialRawLogs.length === 0 ? (
                    <div className="text-slate-600 italic">
                      [Belum ada log serial. Hubungkan Web Serial atau tap kartu RFID di alat ESP32-S3...]
                    </div>
                  ) : (
                    serialRawLogs.map((log, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="text-slate-500 shrink-0">[{log.time}]</span>
                        <span className={log.dir === 'RX' ? 'text-emerald-400 font-bold' : 'text-cyan-400'}>
                          {log.dir}: {log.text}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Custom Command Sender Input */}
              <form onSubmit={handleSendCmd} className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={customCmd}
                  onChange={(e) => setCustomCmd(e.target.value)}
                  placeholder="Kirim perintah raw serial..."
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Kirim</span>
                </button>
              </form>
            </div>

          </div>
        </div>
      )}

      {/* TAB 2: USER MANAGEMENT (7 ROLES) */}
      {activeTab === 'users' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-400" />
                <span>Daftar Seluruh Akun Login Pengguna (7 Role Sistem)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Kredensial login aktif yang digunakan untuk mengakses dashboard masing-masing aktor pesantren.
              </p>
            </div>

            <button
              onClick={() => setShowAddAccountModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Tambah Akun Baru</span>
            </button>
          </div>

          {/* Account Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                  <th className="py-3 px-3">No</th>
                  <th className="py-3 px-3">Aktor & Role</th>
                  <th className="py-3 px-3">Nama Lengkap & Jabatan</th>
                  <th className="py-3 px-3">Email / Username</th>
                  <th className="py-3 px-3">Password</th>
                  <th className="py-3 px-3">Hak Akses</th>
                  <th className="py-3 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {accounts.map((acc, idx) => (
                  <tr key={acc.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-3 font-mono text-slate-500">{idx + 1}</td>
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <img 
                          src={acc.avatar || '/images/avatar_santri_putra.jpg'} 
                          alt={acc.nama} 
                          className="w-8 h-8 rounded-full border border-emerald-500/40 object-cover" 
                        />
                        <div>
                          <span className="font-bold text-white block">{acc.roleName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">role: {acc.role}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="font-semibold text-slate-200 block">{acc.nama}</span>
                      <span className="text-[11px] text-slate-400">{acc.jabatan}</span>
                    </td>
                    <td className="py-3.5 px-3 font-mono text-cyan-300">
                      {acc.email}
                    </td>
                    <td className="py-3.5 px-3 font-mono font-bold text-gold-300">
                      {acc.password}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full border border-slate-700 font-medium">
                        {acc.badge}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <button
                        onClick={() => setEditingAccount(acc)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs transition"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: DATABASE & QUICK-SWITCH BYPASS */}
      {activeTab === 'database' && (
        <div className="space-y-6">
          
          {/* Quick-Access Switcher (Developer Bypass) */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-gold-400" />
                <h3 className="text-base font-bold text-white">
                  Developer Bypass Mode — Akses Cepat ke Seluruh Role
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Sebagai Super Admin, Anda memiliki hak istimewa untuk langsung berpindah dan melihat tampilan dashboard role mana pun tanpa memasukkan password kembali.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
              {[
                { roleId: 'admin_riayah', label: 'Admin Ri\'ayah', color: 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border-emerald-700' },
                { roleId: 'parent', label: 'Wali Santri', color: 'bg-teal-950/80 hover:bg-teal-900 text-teal-300 border-teal-700' },
                { roleId: 'musyrif', label: 'Musyrif Asrama', color: 'bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border-cyan-700' },
                { roleId: 'security', label: 'Pos Satpam Gate', color: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600' },
                { roleId: 'poskestren', label: 'Medis Poskestren', color: 'bg-rose-950/80 hover:bg-rose-900 text-rose-300 border-rose-700' },
                { roleId: 'kyai', label: 'Pimpinan Mudir', color: 'bg-amber-950/80 hover:bg-amber-900 text-amber-300 border-amber-700' }
              ].map((sw) => (
                <button
                  key={sw.roleId}
                  onClick={() => {
                    sound.playSuccess();
                    setRole(sw.roleId);
                  }}
                  className={`p-3 rounded-2xl border text-xs font-bold transition flex flex-col items-center justify-center text-center gap-1.5 shadow ${sw.color}`}
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Buka {sw.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Database Backup & Restore */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* 1. Export Data */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-950 text-cyan-400 flex items-center justify-center border border-cyan-800">
                <Download className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white">Ekspor Seluruh Database JSON</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Unduh backup lengkap data santri ({santriList.length}), perizinan ({permits.length}), kamar ({rooms.length}), kartu blacklist ({blacklistedUids.length}), dan log sistem.
              </p>
              <button
                onClick={exportSystemData}
                className="w-full py-2.5 px-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Unduh File JSON</span>
              </button>
            </div>

            {/* 2. Import Data */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-950 text-emerald-400 flex items-center justify-center border border-emerald-800">
                <Upload className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white">Impor / Restore Cadangan JSON</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Pulihkan state aplikasi dari berkas JSON yang telah diekspor sebelumnya ke dalam memori peramban secara instan.
              </p>
              <label className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer text-center">
                <Upload className="w-4 h-4" />
                <span>Pilih File JSON</span>
                <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            {/* 3. Reset Demo */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950 text-rose-400 flex items-center justify-center border border-rose-800">
                <RotateCcw className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white">Reset Semua Data ke Default Demo</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Kembalikan semua entitas ke kondisi awal perancangan sidang tugas akhir (re-seed initial data).
              </p>
              <button
                onClick={() => {
                  if (window.confirm('Reset seluruh data kembali ke setelan default awal demo?')) {
                    resetAllDataToDefault();
                  }
                }}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-rose-900 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset Data Demo</span>
              </button>
            </div>

          </div>

        </div>
      )}

      {/* MODAL: EDIT ACCOUNT CREDENTIALS */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto my-auto animate-fade-in">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-cyan-400" />
              <span>Edit Kredensial Akun: {editingAccount.roleName}</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Nama Lengkap</label>
                <input 
                  type="text" 
                  value={editingAccount.nama}
                  onChange={(e) => setEditingAccount({ ...editingAccount, nama: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Jabatan / Keterangan</label>
                <input 
                  type="text" 
                  value={editingAccount.jabatan}
                  onChange={(e) => setEditingAccount({ ...editingAccount, jabatan: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Email / Username</label>
                <input 
                  type="text" 
                  value={editingAccount.email}
                  onChange={(e) => setEditingAccount({ ...editingAccount, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Password</label>
                <input 
                  type="text" 
                  value={editingAccount.password}
                  onChange={(e) => setEditingAccount({ ...editingAccount, password: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setEditingAccount(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  updateAccount(editingAccount.id, editingAccount);
                  setEditingAccount(null);
                }}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TABEL KARTU RFID TERDAFTAR (HALAMAN TERSENDIRI LENGKAP) */}
      {activeTab === 'rfid_cards' && (
        <div className="space-y-6 animate-fade-in">
          <RfidCardManager defaultView="table" isModal={false} />
        </div>
      )}

      {/* TAB 5: SCANNER & PASANGKAN KARTU RFID (HALAMAN TERSENDIRI LENGKAP) */}
      {activeTab === 'rfid_pairing' && (
        <div className="space-y-6 animate-fade-in">
          <RfidCardManager defaultView="pairing" isModal={false} />
        </div>
      )}

      {/* TAB 6: KIOSK IZIN CEPAT VIA RFID SCAN */}
      {activeTab === 'express_kiosk' && (
        <div className="space-y-6 animate-fade-in">
          <ExpressPermitKiosk />
        </div>
      )}

      {/* TAB 7: AI AGENT & EVALUASI DIAGRAM HARIAN */}
      {activeTab === 'ai_agent' && (
        <div className="space-y-6 animate-fade-in bg-slate-900/60 p-4 sm:p-6 rounded-3xl border border-indigo-500/30">
          <SantriActivityAnalytics />
        </div>
      )}

      {/* MODAL: ADD NEW ACCOUNT */}
      {showAddAccountModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto my-auto animate-fade-in">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-emerald-400" />
              <span>Tambah Akun Pengguna Baru</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Pilih Role</label>
                <select
                  value={newAccData.role}
                  onChange={(e) => {
                    const r = e.target.value;
                    const rNames = {
                      superadmin: 'Super Admin',
                      admin_riayah: 'Admin Ri\'ayah',
                      parent: 'Wali Santri',
                      musyrif: 'Musyrif / Musyrifah',
                      security: 'Pos Satpam',
                      poskestren: 'Medis Poskestren',
                      kyai: 'Pimpinan Pondok'
                    };
                    setNewAccData({ ...newAccData, role: r, roleName: rNames[r] || r });
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="admin_riayah">Admin Ri'ayah</option>
                  <option value="musyrif">Musyrif / Musyrifah</option>
                  <option value="parent">Wali Santri</option>
                  <option value="security">Pos Satpam</option>
                  <option value="poskestren">Medis Poskestren</option>
                  <option value="kyai">Pimpinan Pondok</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Nama Lengkap</label>
                <input 
                  type="text" 
                  value={newAccData.nama}
                  onChange={(e) => setNewAccData({ ...newAccData, nama: e.target.value })}
                  placeholder="contoh: Ustadz M. Irfan"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Email / Username Login</label>
                <input 
                  type="text" 
                  value={newAccData.email}
                  onChange={(e) => setNewAccData({ ...newAccData, email: e.target.value })}
                  placeholder="contoh: musyrif2@gmail.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Password</label>
                <input 
                  type="text" 
                  value={newAccData.password}
                  onChange={(e) => setNewAccData({ ...newAccData, password: e.target.value })}
                  placeholder="contoh: rahasia123"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowAddAccountModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (!newAccData.email || !newAccData.password || !newAccData.nama) {
                    alert('Harap isi nama, email, dan password!');
                    return;
                  }
                  addAccount({
                    ...newAccData,
                    avatar: '/images/avatar_santri_putra.jpg',
                    badge: 'Akses Baru'
                  });
                  setShowAddAccountModal(false);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs"
              >
                Tambah Akun
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
