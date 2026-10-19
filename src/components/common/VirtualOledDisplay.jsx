import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Cpu, 
  Wifi, 
  Terminal, 
  Radio, 
  Sparkles, 
  Volume2, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  Code2, 
  Check, 
  Copy,
  Download,
  Zap,
  Power,
  Layers,
  FileCode2,
  Sliders
} from 'lucide-react';
import { sound } from '../../utils/audio';

export default function VirtualOledDisplay({ className = '' }) {
  const { 
    oledState, 
    lastScannedUid, 
    lastScannedTime, 
    isSerialConnected, 
    serialRawLogs, 
    connectSerial, 
    disconnectSerial, 
    sendCustomCommand, 
    processRfidTap,
    santriList,
    setIsRfidManagerModalOpen
  } = useApp();

  const [showFirmwareModal, setShowFirmwareModal] = useState(false);
  const [showSerialTerminal, setShowSerialTerminal] = useState(false);
  const [showPinoutGuide, setShowPinoutGuide] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [manualInputUid, setManualInputUid] = useState('');

  // Source code of firmware/esp32s3_smart_permit/esp32s3_smart_permit.ino
  const esp32Code = `/*
 * ==============================================================================
 * SISTEM SMART PERMIT & SMART RI'AYAH PESANTREN MODERN DARUL ULUM
 * FIRMWARE RESMI MIKROKONTROLER ESP32-S3 (BREADBOARD EDITION)
 * ==============================================================================
 * Komponen Terpasang pada 1 Breadboard:
 * 1. ESP32-S3 Dev Module
 * 2. Modul RFID RC522 (13.56 MHz SPI)
 * 3. Modul Buzzer 3 Pin (VCC, GND, I/O)
 * 4. Lampu LED Hijau 5mm (Indikator Akses Diterima / Check-in)
 * 5. Lampu LED Merah 5mm (Indikator Akses Ditolak / Anti-Bypass)
 * (Tanpa Servo fisik, Tanpa OLED fisik - Display Virtual di Dashboard Web)
 *
 * KONFIGURASI WIRING PINOUT FISIK:
 * ------------------------------------------------------------------------------
 * [RFID RC522]  -> ESP32-S3
 * - SDA (SS)    -> GPIO 10
 * - SCK         -> GPIO 12
 * - MOSI        -> GPIO 11
 * - MISO        -> GPIO 13
 * - IRQ         -> (Tidak terhubung / NC)
 * - GND         -> Rel Biru Breadboard (GND)
 * - RST         -> GPIO 9
 * - 3.3V        -> 3V3 ESP32-S3
 *
 * [BUZZER 3-PIN] -> ESP32-S3
 * - I/O (Signal) -> GPIO 15
 * - VCC (+)      -> 3V3 ESP32-S3
 * - GND (-)      -> Rel Biru Breadboard (GND)
 *
 * [LED HIJAU]   -> ESP32-S3
 * - Kaki (+) Panjang -> GPIO 17 (Kontrol ON/OFF)
 * - Kaki (-) Pendek  -> GPIO 16 (Dikonfigurasi sebagai Ground 0V Permanen)
 *
 * [LED MERAH]   -> ESP32-S3
 * - Kaki (+) Panjang -> GPIO 18 (Kontrol ON/OFF)
 * - Kaki (-) Pendek  -> GPIO 8  (Dikonfigurasi sebagai Ground 0V Permanen)
 * ------------------------------------------------------------------------------
 * Serial Baud Rate: 115200 bps
 * Format Transmisi Serial ke Web:
 * - Kirim UID Tap      : RFID_TAP:04:A1:2B:9C
 * - Terima Perintah Buka: CMD:OPEN_GATE / CMD:WELCOME_BACK / OPEN
 * - Terima Perintah Tolak: CMD:DENY_GATE / DENY
 * ==============================================================================
 */

#include <SPI.h>
#include "MFRC522.h"

// ----------------- DEFINISI PIN MODUL RFID RC522 -----------------
#define RST_PIN         255   // Pin Reset RC522 (255 = kabel RST terhubung langsung ke 3.3V)
#define SS_PIN          10    // Pin SDA / Slave Select RC522
#define MOSI_PIN        11    // Pin MOSI SPI
#define SCK_PIN         12    // Pin SCK SPI
#define MISO_PIN        13    // Pin MISO SPI

// ----------------- DEFINISI PIN BUZZER -----------------
#define BUZZER_PIN      15    // Pin I/O Buzzer 3 Kaki
// Ubah ke false jika modul buzzer bertipe Active LOW
#define BUZZER_ACTIVE_HIGH true

// ----------------- DEFINISI PIN LED HIJAU (VERIFIED) -----------------
#define LED_GREEN_POS   17    // Kaki Panjang (+) LED Hijau (Kontrol)
#define LED_GREEN_GND   16    // Kaki Pendek (-) LED Hijau (Ground Permanen)

// ----------------- DEFINISI PIN LED MERAH (DENIED) -----------------
#define LED_RED_POS     18    // Kaki Panjang (+) LED Merah (Kontrol)
#define LED_RED_GND     8     // Kaki Pendek (-) LED Merah (Ground Permanen)

// Objek RFID MFRC522
MFRC522 rfid(SS_PIN, RST_PIN);

// Variabel Penjaga Cooldown Tap Kartu (Menghindari Double-Tap)
unsigned long lastTapTime = 0;
const unsigned long TAP_COOLDOWN_MS = 2000;

// Helper Fungsi Kontrol Buzzer (Mendukung Buzzer Aktif & Buzzer Pasif)
void setBuzzer(bool state) {
  if (state) {
    tone(BUZZER_PIN, 2200);
    digitalWrite(BUZZER_PIN, BUZZER_ACTIVE_HIGH ? HIGH : LOW);
  } else {
    noTone(BUZZER_PIN);
    digitalWrite(BUZZER_PIN, BUZZER_ACTIVE_HIGH ? LOW : HIGH);
  }
}

// Bunyi Beep Merdu (Mendukung Buzzer Pasif via Tone & Aktif via DC)
void beep(int durationMs, int freq = 2400) {
  tone(BUZZER_PIN, freq, durationMs);
  if (BUZZER_ACTIVE_HIGH) {
    digitalWrite(BUZZER_PIN, HIGH);
  }
  delay(durationMs);
  noTone(BUZZER_PIN);
  if (BUZZER_ACTIVE_HIGH) {
    digitalWrite(BUZZER_PIN, LOW);
  }
}

// Helper Pengiriman Serial ke USB CDC & Hardware UART (COM5) Secara Bersamaan
template<typename T>
void sendAll(T val) {
  Serial.print(val);
  Serial0.print(val);
}
template<typename T>
void sendAllLn(T val) {
  Serial.println(val);
  Serial0.println(val);
}

void setup() {
  // 1. Inisialisasi Serial Komunikasi (Serial = USB CDC, Serial0 = Hardware UART COM5)
  Serial.begin(115200);
  Serial0.begin(115200);
  delay(500);

  sendAllLn(F("\\n=============================================="));
  sendAllLn(F("🚀 ESP32-S3 SMART RI'AYAH FIRMWARE STARTING..."));
  sendAllLn(F("=============================================="));

  // 2. Inisialisasi Pin Buzzer
  pinMode(BUZZER_PIN, OUTPUT);
  setBuzzer(false);

  // Inisialisasi Pin LED
  pinMode(LED_GREEN_POS, OUTPUT);
  pinMode(LED_GREEN_GND, OUTPUT);
  pinMode(LED_RED_POS, OUTPUT);
  pinMode(LED_RED_GND, OUTPUT);

  // 3. Self-Test Diagnostik Awal Komponen Saat Booting
  // Test LED Hijau (Arah Normal: 17=HIGH, 16=LOW)
  digitalWrite(LED_GREEN_GND, LOW);
  digitalWrite(LED_GREEN_POS, HIGH);
  beep(250, 2600);
  digitalWrite(LED_GREEN_POS, LOW);

  // Test Cadangan LED Hijau (Jika kaki terbalik: 16=HIGH, 17=LOW)
  digitalWrite(LED_GREEN_POS, LOW);
  digitalWrite(LED_GREEN_GND, HIGH);
  delay(150);
  digitalWrite(LED_GREEN_GND, LOW);
  delay(100);

  // Test LED Merah (Arah Normal: 18=HIGH, 8=LOW)
  digitalWrite(LED_RED_GND, LOW);
  digitalWrite(LED_RED_POS, HIGH);
  beep(250, 1800);
  digitalWrite(LED_RED_POS, LOW);

  // Test Cadangan LED Merah (Jika kaki terbalik: 8=HIGH, 18=LOW)
  digitalWrite(LED_RED_POS, LOW);
  digitalWrite(LED_RED_GND, HIGH);
  delay(150);
  digitalWrite(LED_RED_GND, LOW);
  delay(100);

  // 4. Inisialisasi Jalur SPI Modul RC522
  pinMode(SS_PIN, OUTPUT);
  digitalWrite(SS_PIN, HIGH);

  // Inisialisasi SPI (SS dikontrol manual oleh MFRC522)
  SPI.begin(SCK_PIN, MISO_PIN, MOSI_PIN, -1);
  rfid.PCD_Init();
  delay(50);
  rfid.PCD_AntennaOn();
  rfid.PCD_SetAntennaGain(MFRC522::RxGain_max);

  // Diagnostik Komunikasi Sensor RFID RC522
  byte v = rfid.PCD_ReadRegister(rfid.VersionReg);
  sendAll(F("CHIP_VERSION_RAW:0x"));
  sendAllLn(String(v, HEX));

  if (v == 0x00 || v == 0xFF) {
    sendAllLn(F("STATUS_RC522:ERROR_NOT_DETECTED (Periksa kabel SPI RC522 & pastikan pin 3.3V/GND tersambung kuat)"));
    for (int k = 0; k < 3; k++) {
      digitalWrite(LED_RED_POS, HIGH);
      beep(100);
      digitalWrite(LED_RED_POS, LOW);
      delay(100);
    }
  } else {
    sendAll(F("STATUS_RC522:OK_CHIP_0x"));
    sendAllLn(String(v, HEX));
  }

  // 5. Kirim Status Siap ke Dashboard Web Smart Ri'ayah
  sendAllLn(F("IOT_READY:ESP32_S3_SMART_PERMIT"));
  sendAllLn(F("PINOUT:RC522(9,10,11,12,13)|BUZZER(15)|LED_G(17,16)|LED_R(18,8)"));
}

void loop() {
  // ============================================================================
  // BAGIAN 1: BACA PERINTAH MASUK DARI WEB (Web -> ESP32-S3)
  // ============================================================================
  String cmd = "";
  if (Serial.available() > 0) {
    cmd = Serial.readStringUntil('\\n');
  } else if (Serial0.available() > 0) {
    cmd = Serial0.readStringUntil('\\n');
  }
  cmd.trim();

  if (cmd.length() > 0) {
    // 1. PERINTAH GERBANG DIBUKA / IZIN APPROVED / WELCOME BACK (CHECK-IN)
    if (cmd == "CMD:OPEN_GATE" || cmd == "CMD:WELCOME_BACK" || cmd == "OPEN") {
      digitalWrite(LED_RED_POS, LOW);
      digitalWrite(LED_GREEN_POS, HIGH);
      beep(150, 2400);
      delay(100);
      beep(150, 2400);
      delay(3000);
      digitalWrite(LED_GREEN_POS, LOW);
      sendAllLn(F("GATE_STATUS:CLOSED_IDLE"));
    }
    // 2. PERINTAH AKSES DITOLAK / ANTI-BYPASS LOCK
    else if (cmd == "CMD:DENY_GATE" || cmd == "DENY") {
      digitalWrite(LED_GREEN_POS, LOW);
      for (int i = 0; i < 3; i++) {
        digitalWrite(LED_RED_POS, HIGH);
        setBuzzer(true);
        delay(300);
        digitalWrite(LED_RED_POS, LOW);
        setBuzzer(false);
        delay(150);
      }
      sendAllLn(F("GATE_STATUS:LOCKED_IDLE"));
    }
  }

  // ============================================================================
  // BAGIAN 2: BACA KARTU FISIK RFID 13.56 MHz (ESP32-S3 -> Web)
  // ============================================================================
  // Cek apakah ada kartu baru didekatkan ke modul RC522
  if (!rfid.PICC_IsNewCardPresent()) {
    return;
  }
  // Baca nomor identitas kartu (UID)
  if (!rfid.PICC_ReadCardSerial()) {
    return;
  }

  // Cek Cooldown Tap (Menghindari pembacaan beruntun saat kartu masih menempel)
  unsigned long now = millis();
  if (now - lastTapTime >= TAP_COOLDOWN_MS) {
    lastTapTime = now;

    // Susun UID kartu dalam format Hexadecimal Huruf Besar (XX:XX:XX:XX)
    String uidString = "";
    for (byte i = 0; i < rfid.uid.size; i++) {
      if (rfid.uid.uidByte[i] < 0x10) {
        uidString += "0";
      }
      uidString += String(rfid.uid.uidByte[i], HEX);
      if (i < rfid.uid.size - 1) {
        uidString += ":";
      }
    }
    uidString.toUpperCase();

    // Indikator fisik instan saat kartu terbaca: LED Hijau kedip + Beep 80ms
    digitalWrite(LED_GREEN_POS, HIGH);
    beep(80);
    digitalWrite(LED_GREEN_POS, LOW);

    // Kirim UID ke Serial Web Dashboard
    Serial.print(F("RFID_TAP:"));
    Serial.println(uidString);
  }

  // Hentikan pembacaan kartu aktif agar modul siap untuk scan berikutnya
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(esp32Code);
    setCopiedCode(true);
    sound.playSuccess();
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleDownloadIno = () => {
    const blob = new Blob([esp32Code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'esp32s3_smart_permit.ino';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    sound.playSuccess();
  };

  const handleManualTestTap = (e) => {
    e.preventDefault();
    if (!manualInputUid.trim()) return;
    processRfidTap(manualInputUid.trim());
    setManualInputUid('');
  };

  return (
    <div className={`bg-slate-900 border border-cyan-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden flex flex-col justify-between ${className}`}>
      {/* Background ambient lighting */}
      <div className={`absolute -top-16 -right-16 w-60 h-60 rounded-full blur-3xl pointer-events-none transition-all ${
        oledState.mode === 'APPROVED' || oledState.mode === 'WELCOME_BACK' ? 'bg-emerald-500/20' :
        oledState.mode === 'DENIED' || oledState.mode === 'UNREGISTERED' ? 'bg-rose-500/25' :
        'bg-cyan-500/10'
      }`}></div>

      <div>
        {/* Header Widget */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-md">
              <Cpu className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase bg-cyan-950 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded font-black tracking-wider">
                  VIRTUAL HARDWARE OLED & ACTUATOR
                </span>
                <span className={`text-[10px] font-mono font-bold flex items-center gap-1 ${
                  isSerialConnected ? 'text-emerald-400' : 'text-slate-400'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${isSerialConnected ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}`}></span>
                  {isSerialConnected ? 'ESP32-S3 SERIAL ONLINE' : 'STANDALONE SIMULATOR'}
                </span>
              </div>
              <h3 className="font-bold text-white text-base">
                Virtual OLED SSD1306 & IoT Breadboard Simulator
              </h3>
            </div>
          </div>

          {/* Quick Hardware Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadIno}
              className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5"
              title="Unduh file esp32s3_smart_permit.ino untuk Arduino IDE"
            >
              <Download className="w-3.5 h-3.5" />
              <span>⬇️ Download .ino</span>
            </button>

            <button
              onClick={handleCopyCode}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-mono font-bold text-xs rounded-xl transition flex items-center gap-1.5"
              title="Salin kode sumber C++/Arduino ke clipboard"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Tersalin!' : '📋 Copy Kode .ino'}</span>
            </button>

            <button
              onClick={isSerialConnected ? disconnectSerial : connectSerial}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition flex items-center gap-1.5 shadow-sm border ${
                isSerialConnected
                  ? 'bg-rose-950/80 hover:bg-rose-900 text-rose-300 border-rose-500/60'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-slate-950 border-cyan-400'
              }`}
              title="Koneksikan ESP32-S3 via Web Serial API (115200 Baud)"
            >
              <Power className="w-3.5 h-3.5" />
              <span>{isSerialConnected ? 'Putuskan ESP32' : 'Hubungkan ESP32-S3'}</span>
            </button>

            <button
              onClick={() => setShowFirmwareModal(true)}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl border border-slate-700 transition"
              title="Buka Kode Sumber Arduino / ESP32-S3 Lengkap"
            >
              <Code2 className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowSerialTerminal(!showSerialTerminal)}
              className={`p-2 rounded-xl border transition ${
                showSerialTerminal
                  ? 'bg-cyan-950 text-cyan-300 border-cyan-500'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
              }`}
              title="Lihat Log Monitor Serial RX/TX"
            >
              <Terminal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* BREADBOARD HARDWARE PINOUT & LED/BUZZER ACTUATORS */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pb-2.5 border-b border-slate-800/80 mb-3">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              ESP32-S3 GPIO ACTUATOR MONITOR:
            </span>
            <span className="text-slate-500 text-[10px]">
              SINKRON DENGAN PIN BREADBOARD FISIK
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* LED HIJAU (GPIO 17 (+) / GPIO 16 (GND)) */}
            <div className={`p-3 rounded-xl border transition-all duration-300 flex flex-col items-center justify-center text-center ${
              oledState.ledHijau
                ? 'bg-emerald-950/90 border-emerald-400 shadow-emerald-500/30 shadow-lg'
                : 'bg-slate-900/60 border-slate-800 text-slate-500'
            }`}>
              <div className="relative mb-1.5">
                <div className={`w-6 h-6 rounded-full border-2 transition-all ${
                  oledState.ledHijau
                    ? 'bg-emerald-400 border-white shadow-emerald-400/80 shadow-md scale-110'
                    : 'bg-emerald-950/50 border-emerald-900'
                }`}></div>
                {oledState.ledHijau && (
                  <span className="absolute -inset-1 rounded-full bg-emerald-400/40 animate-ping"></span>
                )}
              </div>
              <span className={`text-[11px] font-mono font-bold ${
                oledState.ledHijau ? 'text-emerald-300' : 'text-slate-500'
              }`}>
                LED HIJAU (OPEN)
              </span>
              <span className="text-[9px] font-mono text-slate-400 mt-0.5">
                (+) GPIO 17 • (-) GPIO 16 (Fisik)
              </span>
            </div>

            {/* LED KUNING (EMULASI VIRTUAL DI LAYAR LAPTOP) */}
            <div className={`p-3 rounded-xl border transition-all duration-300 flex flex-col items-center justify-center text-center relative overflow-hidden ${
              oledState.ledKuning
                ? 'bg-amber-950/90 border-amber-400 shadow-amber-500/50 shadow-lg animate-pulse'
                : 'bg-slate-900/60 border-slate-800 text-slate-500'
            }`}>
              <div className="relative mb-1.5">
                <div className={`w-6 h-6 rounded-full border-2 transition-all ${
                  oledState.ledKuning
                    ? 'bg-amber-400 border-white shadow-amber-400/90 shadow-md scale-110'
                    : 'bg-amber-950/50 border-amber-900'
                }`}></div>
                {oledState.ledKuning && (
                  <span className="absolute -inset-1 rounded-full bg-amber-400/40 animate-ping"></span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className={`text-[11px] font-mono font-bold ${
                  oledState.ledKuning ? 'text-amber-300' : 'text-slate-500'
                }`}>
                  LED KUNING
                </span>
                <span className="text-[8px] bg-amber-500/20 text-amber-300 font-bold px-1 py-0.2 rounded border border-amber-500/40">
                  LAYAR
                </span>
              </div>
              <span className="text-[9px] font-mono text-slate-400 mt-0.5">
                Virtual Screen (H-X / Warning)
              </span>
            </div>

            {/* LED MERAH (GPIO 18 (+) / GPIO 8 (GND)) */}
            <div className={`p-3 rounded-xl border transition-all duration-300 flex flex-col items-center justify-center text-center ${
              oledState.ledMerah
                ? 'bg-rose-950/90 border-rose-500 shadow-rose-500/40 shadow-lg animate-pulse'
                : 'bg-slate-900/60 border-slate-800 text-slate-500'
            }`}>
              <div className="relative mb-1.5">
                <div className={`w-6 h-6 rounded-full border-2 transition-all ${
                  oledState.ledMerah
                    ? 'bg-rose-500 border-white shadow-rose-500/80 shadow-md scale-110'
                    : 'bg-rose-950/50 border-rose-900'
                }`}></div>
                {oledState.ledMerah && (
                  <span className="absolute -inset-1 rounded-full bg-rose-500/50 animate-ping"></span>
                )}
              </div>
              <span className={`text-[11px] font-mono font-bold ${
                oledState.ledMerah ? 'text-rose-300' : 'text-slate-500'
              }`}>
                LED MERAH (DENIED)
              </span>
              <span className="text-[9px] font-mono text-slate-400 mt-0.5">
                (+) GPIO 18 • (-) GPIO 8 (Fisik)
              </span>
            </div>

            {/* BUZZER 3-PIN (GPIO 15) */}
            <div className={`p-3 rounded-xl border transition-all duration-300 flex flex-col items-center justify-center text-center ${
              oledState.buzzer
                ? 'bg-amber-950/90 border-amber-400 shadow-amber-500/30 shadow-lg'
                : 'bg-slate-900/60 border-slate-800 text-slate-500'
            }`}>
              <div className="relative mb-1.5">
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                  oledState.buzzer
                    ? 'bg-amber-400 border-white text-slate-950 shadow-amber-400/80 shadow-md scale-110 animate-bounce'
                    : 'bg-slate-800 border-slate-700 text-slate-600'
                }`}>
                  <Volume2 className="w-3.5 h-3.5" />
                </div>
                {oledState.buzzer && (
                  <span className="absolute -inset-1 rounded-full bg-amber-400/40 animate-ping"></span>
                )}
              </div>
              <span className={`text-[11px] font-mono font-bold ${
                oledState.buzzer ? 'text-amber-300' : 'text-slate-500'
              }`}>
                BUZZER ALARM (3-PIN)
              </span>
              <span className="text-[9px] font-mono text-slate-400 mt-0.5">
                I/O GPIO 15 • 3V3 • GND (Fisik)
              </span>
            </div>
          </div>
        </div>

        {/* 2. TABEL RINGKASAN PINOUT HARDWARE FISIK (BREADBOARD USER) */}
        {showPinoutGuide && (
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 mb-4 text-xs font-mono">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px] text-slate-400 mb-2.5">
              <span className="font-bold text-cyan-400 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" />
                TABEL PINOUT RESMI BREADBOARD ESP32-S3 (TANPA SERVO & TANPA OLED FISIK):
              </span>
              <span className="text-slate-500 text-[10px]">100% SESUAI FILE .INO</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-[11px]">
              <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-1">
                <b className="text-cyan-300 block">1. RFID RC522 (FSPI)</b>
                <div className="text-slate-400 text-[10px] space-y-0.5">
                  <div>• RST = <span className="text-white font-bold">GPIO 9</span></div>
                  <div>• SDA (SS) = <span className="text-white font-bold">GPIO 10</span></div>
                  <div>• MOSI = <span className="text-white font-bold">GPIO 11</span></div>
                  <div>• SCK = <span className="text-white font-bold">GPIO 12</span></div>
                  <div>• MISO = <span className="text-white font-bold">GPIO 13</span></div>
                  <div>• 3V3 & Rel Biru GND</div>
                </div>
              </div>

              <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-1">
                <b className="text-amber-300 block">2. Buzzer (3-Pin)</b>
                <div className="text-slate-400 text-[10px] space-y-0.5">
                  <div>• Pin I/O = <span className="text-white font-bold">GPIO 15</span></div>
                  <div>• VCC = <span className="text-white font-bold">3.3V</span></div>
                  <div>• GND = <span className="text-white font-bold">Rel Biru GND</span></div>
                  <div className="text-amber-400 pt-1">Active HIGH/LOW Configurable</div>
                </div>
              </div>

              <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-1">
                <b className="text-emerald-300 block">3. LED Hijau (Approved)</b>
                <div className="text-slate-400 text-[10px] space-y-0.5">
                  <div>• Kaki (+) Pjg = <span className="text-white font-bold">GPIO 17</span> (Kontrol)</div>
                  <div>• Kaki (-) Pdk = <span className="text-white font-bold">GPIO 16</span> (GND 0V)</div>
                  <div className="text-emerald-400 pt-1">Pin 16 diset LOW di setup()</div>
                </div>
              </div>

              <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-1">
                <b className="text-rose-300 block">4. LED Merah (Denied)</b>
                <div className="text-slate-400 text-[10px] space-y-0.5">
                  <div>• Kaki (+) Pjg = <span className="text-white font-bold">GPIO 18</span> (Kontrol)</div>
                  <div>• Kaki (-) Pdk = <span className="text-white font-bold">GPIO 8</span> (GND 0V)</div>
                  <div className="text-rose-400 pt-1">Pin 8 diset LOW di setup()</div>
                </div>
              </div>

              <div className="bg-slate-900 p-2.5 rounded-xl border border-amber-600/50 space-y-1 sm:col-span-2 lg:col-span-4">
                <div className="flex items-center justify-between">
                  <b className="text-amber-300 block">5. LED Kuning (Virtual Screen Laptop)</b>
                  <span className="text-[9px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded border border-amber-500/40">
                    💻 Layar Saja (Tanpa Pin Fisik)
                  </span>
                </div>
                <div className="text-slate-300 text-[10px] space-y-0.5">
                  <div>• Diimplementasikan langsung secara <span className="text-amber-300 font-bold">software virtual di layar laptop/web</span>.</div>
                  <div>• Berfungsi untuk indikator <span className="text-amber-300 font-bold">Warning H-X Waktu Perizinan Santri</span> & proses verifikasi tap kartu.</div>
                  <div className="text-emerald-400 pt-0.5">Hardware IoT fisik Anda tetap hemat menggunakan 2 LED fisik (Hijau & Merah) saja!</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. THE PHYSICAL VIRTUAL OLED SSD1306 SCREEN (0.96" 128x64 Matrix) */}
        <div className="relative mx-auto max-w-xl">
          {/* OLED Module PCB Board Frame (Deep Navy Blue / Matte Black with Screw Holes) */}
          <div className="bg-gradient-to-b from-slate-950 via-slate-900 to-black p-4 sm:p-5 rounded-2xl border-4 border-slate-700 shadow-2xl relative">
            {/* PCB Screw Holes */}
            <div className="absolute top-2 left-2 w-3 h-3 rounded-full bg-slate-800 border border-slate-600"></div>
            <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-slate-800 border border-slate-600"></div>
            <div className="absolute bottom-2 left-2 w-3 h-3 rounded-full bg-slate-800 border border-slate-600"></div>
            <div className="absolute bottom-2 right-2 w-3 h-3 rounded-full bg-slate-800 border border-slate-600"></div>

            {/* Header Pins Label: GND, VCC, SCL, SDA */}
            <div className="flex items-center justify-center gap-6 text-[9px] font-mono text-slate-400 uppercase tracking-widest pb-2 border-b border-slate-800 mb-3">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>GND</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>VCC 3.3V</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>SCL</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>SDA</span>
            </div>

            {/* The OLED Glass Screen itself (0.96 inch 128x64 display matrix) */}
            <div className="bg-[#020508] border-2 border-slate-800 rounded-lg p-4 sm:p-5 font-mono shadow-inner relative overflow-hidden min-h-[170px] flex flex-col justify-between">
              {/* Scanline overlay for realistic OLED texture */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] pointer-events-none opacity-40"></div>

              {/* Status Header Bar on OLED */}
              <div className="flex items-center justify-between text-[11px] pb-2 border-b border-cyan-900/60 text-cyan-400/80">
                <span className="font-bold tracking-wider">DARUL ULUM SMART GATE</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                  oledState.mode === 'APPROVED' ? 'bg-emerald-400 text-black font-black' :
                  oledState.mode === 'DENIED' || oledState.mode === 'UNREGISTERED' ? 'bg-rose-500 text-white font-black animate-pulse' :
                  oledState.mode === 'WELCOME_BACK' ? 'bg-cyan-400 text-black font-black' :
                  'bg-cyan-950 text-cyan-300'
                }`}>
                  {oledState.mode}
                </span>
              </div>

              {/* OLED Neon Text Content (Monospace Glow) */}
              <div className="py-2.5 space-y-1 sm:space-y-1.5">
                {/* Line 1: Big status banner */}
                <div className={`text-sm sm:text-base font-black tracking-wide ${
                  oledState.mode === 'APPROVED' ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]' :
                  oledState.mode === 'DENIED' || oledState.mode === 'UNREGISTERED' ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.8)]' :
                  oledState.mode === 'WELCOME_BACK' ? 'text-cyan-300 drop-shadow-[0_0_8px_rgba(103,232,249,0.8)]' :
                  'text-cyan-400 drop-shadow-[0_0_6px_rgba(34,211,238,0.6)]'
                }`}>
                  {oledState.line1}
                </div>

                {/* Line 2: Name or instruction */}
                <div className="text-xs sm:text-sm font-bold text-slate-100 drop-shadow-[0_0_4px_rgba(255,255,255,0.4)] truncate">
                  {oledState.line2}
                </div>

                {/* Line 3: Class / Details */}
                <div className="text-[11px] sm:text-xs text-cyan-200/90 truncate">
                  {oledState.line3}
                </div>

                {/* Line 4: Reason / Action */}
                <div className="text-[10px] sm:text-[11px] text-slate-300/80 truncate">
                  {oledState.line4}
                </div>

                {/* Line 5: Deadline / Note */}
                {oledState.line5 && (
                  <div className="text-[10px] sm:text-[11px] text-gold-300 font-semibold truncate pt-0.5">
                    {oledState.line5}
                  </div>
                )}
              </div>

              {/* OLED Footer status bar */}
              <div className="flex items-center justify-between text-[9px] text-slate-500 pt-1.5 border-t border-cyan-950">
                <span>RC522: 13.56 MHz</span>
                <span>CMD: <b className="text-cyan-400">{oledState.lastCommandSent || 'IDLE'}</b></span>
                <span>SSD1306 128x64</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Testing Bar & Last Scanned Detection */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Last scanned box preview */}
          <div className="flex items-center gap-2.5 bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800 text-xs font-mono">
            <span className="text-slate-400 text-[11px]">UID TERAKHIR:</span>
            <span className="font-bold text-gold-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
              {lastScannedUid || 'BELUM ADA SCAN'}
            </span>
            {lastScannedTime && (
              <span className="text-[10px] text-slate-500">
                ({new Date(lastScannedTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })})
              </span>
            )}
          </div>

          {/* Quick preset trigger buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => processRfidTap('04:E5:6F:04')} // Zulfikar Ali (APPROVED)
              className="px-2.5 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 rounded-lg text-[11px] font-mono font-bold transition"
              title="Uji Tap Zulfikar Ali (Izin APPROVED -> Gerbang Dibuka)"
            >
              Uji Tap: Zulfikar (APPROVED)
            </button>

            <button
              onClick={() => processRfidTap('04:A1:2B:9C')} // Ahmad Fauzi (PENDING / REJECTED)
              className="px-2.5 py-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-500/40 rounded-lg text-[11px] font-mono font-bold transition"
              title="Uji Tap Ahmad Fauzi (Belum Izin -> Access Denied)"
            >
              Uji Tap: Ahmad (DENIED)
            </button>

            <button
              onClick={() => processRfidTap('04:D4:5E:F3')} // Fajar Ramadhan (OVERDUE Check-in)
              className="px-2.5 py-1.5 bg-blue-950/80 hover:bg-blue-900 text-cyan-300 border border-cyan-500/40 rounded-lg text-[11px] font-mono font-bold transition"
              title="Uji Tap Fajar Ramadhan (OVERDUE -> Welcome Back / Check-in Selesai)"
            >
              Uji Tap: Fajar (CHECK-IN)
            </button>

            <button
              onClick={() => {
                setOledState({
                  mode: 'WARNING',
                  line1: 'PERINGATAN WAKTU ASRAMA',
                  line2: 'SANTRI DI LUAR (H-30 MENIT)',
                  line3: 'ALARM MUSYRIF / WALI AKTIF',
                  line4: 'LED KUNING VIRTUAL LAYAR: ON',
                  line5: 'AUTO WA REMINDER DISPATCHED',
                  ledHijau: false,
                  ledKuning: true,
                  ledMerah: false,
                  buzzer: true,
                  lastCommandSent: 'VIRTUAL:LED_YELLOW_ACTIVE',
                  activeSantri: null
                });
                sound.playReminderChime();
                setTimeout(() => setOledState(STANDBY_OLED), 4000);
              }}
              className="px-2.5 py-1.5 bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-500/40 rounded-lg text-[11px] font-mono font-bold transition flex items-center gap-1"
              title="Uji Nyala LED Kuning Virtual di Layar Laptop"
            >
              💡 Tes LED Kuning (Layar)
            </button>

            <button
              onClick={() => setIsRfidManagerModalOpen(true)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[11px] font-bold border border-slate-700 flex items-center gap-1 transition"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Kelola Kartu RFID</span>
            </button>
          </div>
        </div>

        {/* Manual Hex UID input */}
        <form onSubmit={handleManualTestTap} className="mt-3 flex items-center gap-2">
          <input
            type="text"
            placeholder="Ketik UID kartu fisik manual (Contoh: 04:A1:2B:9C atau tempel dari serial)..."
            value={manualInputUid}
            onChange={(e) => setManualInputUid(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-cyan-300 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 rounded-xl text-xs font-mono font-bold transition flex items-center gap-1.5 shrink-0"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Simulasikan Tap</span>
          </button>
        </form>

        {/* Serial Raw Logs drawer */}
        {showSerialTerminal && (
          <div className="mt-4 p-3.5 bg-black rounded-xl border border-slate-800 font-mono text-[11px] space-y-1 max-h-44 overflow-y-auto">
            <div className="flex items-center justify-between text-slate-500 pb-1 border-b border-slate-900 text-[10px]">
              <span>LIVE WEB SERIAL TERMINAL MONITOR (115200 BAUD)</span>
              <span>{serialRawLogs.length} Entri</span>
            </div>
            {serialRawLogs.length === 0 ? (
              <div className="text-slate-600 italic py-2">
                Menunggu pembacaan serial dari breadboard ESP32-S3 atau uji coba simulasi...
              </div>
            ) : (
              serialRawLogs.map((log, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-slate-600 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString('id-ID')}
                  </span>
                  <span className={`px-1 py-0.2 rounded text-[9px] font-bold shrink-0 ${
                    log.type === 'RX' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                    log.type === 'TX' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' :
                    log.type === 'ERROR' ? 'bg-rose-950 text-rose-300' :
                    'bg-slate-900 text-slate-400'
                  }`}>
                    {log.type}
                  </span>
                  <span className={log.type === 'RX' ? 'text-emerald-300' : log.type === 'TX' ? 'text-cyan-300' : 'text-slate-400'}>
                    {log.text}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* MODAL: ESP32-S3 Arduino C++ Firmware Code */}
      {showFirmwareModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-cyan-950 text-cyan-400 rounded-xl border border-cyan-500/30">
                  <FileCode2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    Firmware ESP32-S3 (.ino) - Smart Permit IoT Gate
                  </h3>
                  <p className="text-xs text-slate-400">
                    File: <code className="text-cyan-400 font-mono">firmware/esp32s3_smart_permit/esp32s3_smart_permit.ino</code>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFirmwareModal(false)}
                className="text-slate-400 hover:text-white text-sm px-2 py-1"
              >
                ✕ Tutup
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-black rounded-xl p-4 border border-slate-800 text-xs font-mono text-emerald-300">
              <pre className="whitespace-pre-wrap">{esp32Code}</pre>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between pt-2 border-t border-slate-800 text-xs gap-3">
              <span className="text-slate-400">
                Board: <b>ESP32-S3 Dev Module</b> • Port: COMx • Baud: <b>115200</b>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadIno}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition flex items-center gap-1.5 font-sans shadow"
                >
                  <Download className="w-4 h-4" />
                  <span>⬇️ Download .ino</span>
                </button>
                <button
                  onClick={handleCopyCode}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-xl transition flex items-center gap-1.5 font-sans"
                >
                  {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedCode ? 'Tersalin ke Clipboard!' : '📋 Copy Kode .ino'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
