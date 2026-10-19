# DOKUMENTASI ENDPOINT API (BACKEND INTEGRATION REFERENCE)
**Sistem:** Smart Permit & Smart Ri'ayah (Pesantren Modern Darul Ulum)  
**Tugas Akhir / Skripsi**

---

## 1. Modul Smart Permit (Perizinan Santri)
| Endpoint | Method | Role | Deskripsi | Request Body / Param |
|---|---|---|---|---|
| `/api/permits` | `GET` | All | Mengambil daftar perizinan (filter by `status`, `santriId`) | `?status=PENDING&santriId=S-101` |
| `/api/permits` | `POST` | Wali / Santri | Mengajukan izin santri baru | `{ santriId, kategori, keperluan, penjemput, waktuKeluarRencana, batasKembali }` |
| `/api/permits/:id/approve` | `POST` | Musyrif | Menyetujui izin santri & sync ke IoT Gate | `{ catatanMusyrif, idMusyrif }` |
| `/api/permits/:id/reject` | `POST` | Musyrif | Menolak izin santri | `{ alasanPenolakan, idMusyrif }` |

---

## 2. Modul IoT Smart Turnstile Gate (Hardware Interface)
| Endpoint | Method | Role | Deskripsi | Request Body / Param |
|---|---|---|---|---|
| `/api/gate/verify-rfid` | `POST` | IoT Device / ESP32 | Verifikasi tap RFID di Turnstile Gate (13.56 MHz) | `{ rfidUid: "04:A1:2B:9C", gateId: "GATE-01", direction: "EXIT" \| "ENTRY" }` |
| `/api/gate/logs` | `GET` | Satpam / Admin | Mengambil log akses gerbang & anti-bypass | `?limit=50&status=DENIED` |
| `/api/gate/headcount` | `GET` | Satpam / Kyai | Mengambil statistik live santri di dalam asrama vs luar | - |
| `/api/gate/audit-overdue` | `POST` | Daemon Cron | Daemon pemeriksaan otomatis santri terlambat | Auto trigger trigger auto-point cut & WhatsApp alert |

---

## 3. Modul Smart Ri'ayah (Buku Induk Karakter & Poin)
| Endpoint | Method | Role | Deskripsi | Request Body / Param |
|---|---|---|---|---|
| `/api/riayah/points` | `GET` | All | Rekap poin kedisiplinan & reward santri | `?santriId=S-101` |
| `/api/riayah/points` | `POST` | Musyrif / Auto Gate | Menambah catatan poin (Reward / Pelanggaran) | `{ santriId, jenis, kategori, poin, deskripsi, pencatat }` |
| `/api/riayah/mutabaah` | `GET` | Wali / Musyrif | Mengambil catatan shalat berjamaah & tahfidz | `?santriId=S-101&date=2026-10-14` |

---

## 4. Modul Poskestren (Klinik & Rekam Medis)
| Endpoint | Method | Role | Deskripsi | Request Body / Param |
|---|---|---|---|---|
| `/api/poskestren/records` | `GET` | Poskestren / Wali | Riwayat rekam medis santri | `?santriId=S-101` |
| `/api/poskestren/records` | `POST` | Poskestren | Input rekam medis & tindakan | `{ santriId, keluhan, diagnosa, tindakan, statusIstirahat }` |
| `/api/poskestren/refer-hospital`| `POST` | Poskestren | Buat rujukan RS luar (auto create Smart Permit) | `{ santriId, rsRujukan, diagnosa, durasi }` |

---

## 5. Modul WhatsApp Real-Time Gateway
| Endpoint | Method | Role | Deskripsi | Request Body / Param |
|---|---|---|---|---|
| `/api/wa/send-notification` | `POST` | Internal Service | Mengirim notifikasi WhatsApp terenkripsi ke wali santri | `{ penerimaNomor, namaWali, tipeNotifikasi, pesanTeks }` |
| `/api/wa/logs` | `GET` | Admin / Satpam | Riwayat pengiriman WhatsApp Gateway | `?limit=30` |
