# SMART RIAYAH FLUTTER MOBILE CLIENT (ANDROID & iOS)
**Sistem:** Smart Permit & Smart Ri'ayah (Pesantren Modern Darul Ulum)

Modul ini adalah aplikasi mobile Flutter mandiri yang terhubung langsung ke Backend REST API Smart Riayah (Node.js Express + PostgreSQL + ESP32 IoT Turnstile Gate).

---

## 🚀 Cara Menjalankan Aplikasi Flutter:

### 1. Prasyarat:
Pastikan Flutter SDK (>= 3.0.0) sudah terpasang di komputer Anda.
Cek dengan perintah:
```bash
flutter --version
```

### 2. Jalankan Backend Server Smart Riayah:
Di folder utama proyek `Smart Riayah`, jalankan:
```bash
npm run server
```
Server akan aktif di: `http://localhost:5000` (atau IP WiFi Anda, misal: `192.168.1.10:5000`).

### 3. Jalankan Aplikasi Flutter:
Buka terminal baru di folder `flutter_client/`:
```bash
cd flutter_client
flutter pub get
flutter run
```
Pilih perangkat target:
- **1:** Android Emulator atau HP Android Fisik via USB (Aktifkan USB Debugging)
- **2:** Chrome (Flutter Web)
- **3:** iOS Simulator / iPhone (khusus macOS)

---

## 📡 Daftar Endpoint REST API yang Digunakan:
| Endpoint | Method | Fungsi |
|---|---|---|
| `/api/health` | GET | Cek status server & koneksi PostgreSQL |
| `/api/santri` | GET | Mengambil profil santri, saldo RFID, dan poin disiplin |
| `/api/permits` | GET, POST | Pengajuan & pemantauan izin santri (Smart Permit) |
| `/api/permits/:id/approve` | POST | Otorisasi izin oleh Musyrif via HP |
| `/api/gate/verify-rfid` | POST | Verifikasi tap RFID gate 13.56 MHz |
| `/api/evaluasi` | GET, POST | Hasil evaluasi AI aktivitas santri |

---

## 💡 Mode Alternatif: WebView Wrapper
Jika Anda ingin menyajikan seluruh dashboard web ke dalam aplikasi Flutter dengan tampilan 100% identik:
Gunakan package `webview_flutter`:
```dart
WebViewWidget(
  controller: WebViewController()
    ..loadRequest(Uri.parse('http://10.0.2.2:5173')),
)
```
Tampilan web Smart Riayah sudah dioptimalkan otomatis menyesuaikan diri (auto-responsive) pada layar smartphone, tablet, maupun desktop!
