/*
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
// Kecepatan SPI 1 MHz agar stabil di kabel jumper breadboard
#define MFRC522_SPICLOCK 1000000u
#include "MFRC522.h"

// ----------------- DEFINISI PIN MODUL RFID RC522 -----------------
#define RST_PIN         255   // Pin Reset RC522 (255 = UINT8_MAX karena kabel RST terhubung langsung ke 3.3V)
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

  sendAllLn(F("\n=============================================="));
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
  beep(250, 2600); // Nada Beep Nyaring
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
  beep(250, 1800); // Nada Beep Sedang
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

  // Diagnostik Komunikasi Sensor RFID RC522
  byte v = rfid.PCD_ReadRegister(rfid.VersionReg);
  sendAll(F("CHIP_VERSION_RAW:0x"));
  sendAllLn(String(v, HEX));

  if (v == 0x00 || v == 0xFF) {
    sendAllLn(F("STATUS_RC522:ERROR_NOT_DETECTED (Periksa kabel SPI RC522 & pastikan pin 3.3V/GND tersambung kuat)"));
    // Kedip LED Merah 3x sebagai alarm visual RC522 belum terdeteksi kabelnya
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
    cmd = Serial.readStringUntil('\n');
  } else if (Serial0.available() > 0) {
    cmd = Serial0.readStringUntil('\n');
  }
  cmd.trim();

  if (cmd.length() > 0) {
    // 1. PERINTAH GERBANG DIBUKA / IZIN APPROVED / WELCOME BACK (CHECK-IN)
    if (cmd == "CMD:OPEN_GATE" || cmd == "CMD:WELCOME_BACK" || cmd == "OPEN") {
      digitalWrite(LED_RED_POS, LOW);    // Pastikan LED merah mati
      digitalWrite(LED_GREEN_POS, HIGH);  // Nyalakan LED Hijau (Akses Diterima)

      // Bunyikan Buzzer 2x Pendek Tanda Verifikasi Sukses
      beep(150, 2400);
      delay(100);
      beep(150, 2400);

      // Tahan LED Hijau menyala selama 3000ms (Durasi Palang Terbuka)
      delay(3000);
      digitalWrite(LED_GREEN_POS, LOW);  // Matikan LED Hijau
      sendAllLn(F("GATE_STATUS:CLOSED_IDLE"));
    }
    // 2. PERINTAH AKSES DITOLAK / ANTI-BYPASS LOCK
    else if (cmd == "CMD:DENY_GATE" || cmd == "DENY") {
      digitalWrite(LED_GREEN_POS, LOW);  // Pastikan LED hijau mati

      // Alarm Penolakan: Kedipkan LED Merah + Buzzer 3x Berturut-turut
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
    beep(80, 2600);
    digitalWrite(LED_GREEN_POS, LOW);

    // Kirim UID ke Serial Web Dashboard dan Serial0 UART
    sendAll(F("RFID_TAP:"));
    sendAllLn(uidString);
  }

  // Hentikan pembacaan kartu aktif agar modul siap untuk scan berikutnya
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}

