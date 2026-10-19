-- =====================================================================================
-- SKEMA BASIS DATA RELASIONAL (DATABASE SCHEMA)
-- SISTEM "SMART PERMIT & SMART RI'AYAH"
-- Studi Kasus: Pesantren Modern Darul Ulum
-- Lampiran Bab 3 & Bab 4 Laporan Tugas Akhir / Skripsi
-- =====================================================================================

CREATE DATABASE IF NOT EXISTS smart_permit_riayah_db;
USE smart_permit_riayah_db;

-- -------------------------------------------------------------------------------------
-- 1. TABEL: WALI SANTRI (Data Orang Tua / Penanggung Jawab)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wali_santri (
    id_wali INT AUTO_INCREMENT PRIMARY KEY,
    nama_lengkap VARCHAR(150) NOT NULL,
    hubungan ENUM('Ayah Kandung', 'Ibu Kandung', 'Wali Sah') NOT NULL,
    no_whatsapp VARCHAR(20) NOT NULL UNIQUE,
    alamat TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------------------
-- 2. TABEL: KAMAR ASRAMA (Tata Kelola Hunian)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kamar_asrama (
    id_kamar VARCHAR(20) PRIMARY KEY, -- e.g., 'RM-204'
    nama_gedung VARCHAR(100) NOT NULL, -- e.g., 'Asrama Putra Umar bin Khattab'
    nomor_kamar VARCHAR(30) NOT NULL, -- e.g., 'Kamar 204'
    lantai INT NOT NULL,
    kapasitas INT NOT NULL DEFAULT 8,
    id_ketua_kamar VARCHAR(20) NULL,
    skor_kerapian INT DEFAULT 90,
    catatan_inspeksi TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------------------
-- 3. TABEL: SANTRI (Entitas Utama Santri & RFID Smart Card 13.56 MHz)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS santri (
    id_santri VARCHAR(20) PRIMARY KEY, -- e.g., 'S-101'
    nis VARCHAR(30) NOT NULL UNIQUE, -- e.g., '125456'
    nama_lengkap VARCHAR(150) NOT NULL,
    kelas VARCHAR(30) NOT NULL,
    gender ENUM('L', 'P') NOT NULL,
    id_kamar VARCHAR(20) NOT NULL,
    rfid_uid VARCHAR(32) NOT NULL UNIQUE, -- e.g., '04:A1:2B:9C' (UID Mifare Classic 13.56 MHz)
    id_wali INT NOT NULL,
    saldo_rfid DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    limit_jajan_harian DECIMAL(12, 2) NOT NULL DEFAULT 25000.00,
    poin_disiplin INT NOT NULL DEFAULT 100, -- Skala 0 - 100
    tahfidz_juz INT NOT NULL DEFAULT 0,
    status_asrama ENUM('DI_ASRAMA', 'DI_LUAR', 'TERLAMBAT') NOT NULL DEFAULT 'DI_ASRAMA',
    penyakit_khusus VARCHAR(255) DEFAULT '-',
    foto_url VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_santri_wali FOREIGN KEY (id_wali) REFERENCES wali_santri(id_wali) ON UPDATE CASCADE,
    CONSTRAINT fk_santri_kamar FOREIGN KEY (id_kamar) REFERENCES kamar_asrama(id_kamar) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------------------
-- 4. TABEL: PERIZINAN (Modul 1: Smart Permit & Multi-Tier Approval)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS perizinan (
    id_izin VARCHAR(30) PRIMARY KEY, -- e.g., 'PRM-2026-001'
    id_santri VARCHAR(20) NOT NULL,
    kategori ENUM('Pesiar', 'Pulang Bermalam', 'Berobat') NOT NULL,
    keperluan TEXT NOT NULL,
    penjemput VARCHAR(150) NOT NULL,
    waktu_keluar_rencana DATETIME NOT NULL,
    batas_kembali DATETIME NOT NULL, -- Deadlock threshold
    status ENUM('PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'OVERDUE', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
    token_izin VARCHAR(50) NOT NULL UNIQUE, -- Token digital tersinkron ke IoT Gate
    id_musyrif_penyetuju VARCHAR(50) NULL,
    waktu_approval DATETIME NULL,
    waktu_keluar_aktual DATETIME NULL,
    waktu_kembali_aktual DATETIME NULL,
    catatan_musyrif TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_perizinan_santri FOREIGN KEY (id_santri) REFERENCES santri(id_santri) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------------------
-- 5. TABEL: GATE LOGS (Modul 2: IoT Turnstile Gate Audit & Anti-Bypass)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gate_logs (
    id_log BIGINT AUTO_INCREMENT PRIMARY KEY,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_santri VARCHAR(20) NOT NULL,
    rfid_uid VARCHAR(32) NOT NULL,
    gate_id VARCHAR(50) NOT NULL DEFAULT 'GATE-01',
    tipe_scan ENUM('TAP_KELUAR', 'TAP_MASUK', 'ILLEGAL_ATTEMPT') NOT NULL,
    status_verifikasi ENUM('VERIFIED', 'DENIED') NOT NULL,
    remarks TEXT NOT NULL,
    snapshot_cctv_url VARCHAR(255) NULL,
    CONSTRAINT fk_gatelog_santri FOREIGN KEY (id_santri) REFERENCES santri(id_santri) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------------------
-- 6. TABEL: POIN RI'AYAH (Modul 3: Buku Induk Karakter & Kedisiplinan)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS poin_riayah (
    id_poin BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_santri VARCHAR(20) NOT NULL,
    tanggal DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    jenis ENUM('REWARD', 'PELANGGARAN') NOT NULL,
    kategori VARCHAR(100) NOT NULL, -- e.g., 'Keterlambatan Smart Gate (Overdue)', 'Prestasi MQK'
    poin INT NOT NULL, -- (+/- nilai)
    deskripsi TEXT NOT NULL,
    pencatat VARCHAR(100) NOT NULL, -- 'Ust. M. Syukron' atau 'IoT Smart Gate Auto-Audit Daemon'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_poin_santri FOREIGN KEY (id_santri) REFERENCES santri(id_santri) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------------------
-- 7. TABEL: MUTABA'AH & TAHFIDZ (Ibadah Yaumiyah & Al-Qur'an)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mutabaah_tahfidz (
    id_mutabaah BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_santri VARCHAR(20) NOT NULL,
    tanggal DATE NOT NULL,
    subuh ENUM('BERJAMAAH_MASJID', 'MUNFARID', 'MASBUK', 'GHAIB') DEFAULT 'BERJAMAAH_MASJID',
    dzuhur ENUM('BERJAMAAH_MASJID', 'MUNFARID', 'MASBUK', 'GHAIB') DEFAULT 'BERJAMAAH_MASJID',
    ashar ENUM('BERJAMAAH_MASJID', 'MUNFARID', 'MASBUK', 'GHAIB') DEFAULT 'BERJAMAAH_MASJID',
    maghrib ENUM('BERJAMAAH_MASJID', 'MUNFARID', 'MASBUK', 'GHAIB') DEFAULT 'BERJAMAAH_MASJID',
    isya ENUM('BERJAMAAH_MASJID', 'MUNFARID', 'MASBUK', 'GHAIB') DEFAULT 'BERJAMAAH_MASJID',
    dhuha BOOLEAN DEFAULT TRUE,
    qiyamullail BOOLEAN DEFAULT TRUE,
    tahfidz_surah VARCHAR(100) NULL,
    tahfidz_ayat VARCHAR(50) NULL,
    tahfidz_juz INT NULL,
    predikat_tahfidz ENUM('MUMTAZ', 'JAYYID_JIDDAN', 'JAYYID', 'MAQBUL') DEFAULT 'MUMTAZ',
    murojaah_info VARCHAR(255) NULL,
    ustadz_halaqah VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mutabaah_santri FOREIGN KEY (id_santri) REFERENCES santri(id_santri) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------------------
-- 8. TABEL: REKAM MEDIS POSKESTREN (Kesehatan Asrama & Rujukan RS)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rekam_medis_poskestren (
    id_rekam VARCHAR(30) PRIMARY KEY, -- e.g., 'MED-001'
    id_santri VARCHAR(20) NOT NULL,
    tanggal DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    keluhan TEXT NOT NULL,
    diagnosa VARCHAR(255) NOT NULL,
    tindakan TEXT NOT NULL,
    status_istirahat ENUM('ISTIRAHAT_ASRAMA', 'RAWAT_INAP_POSKESTREN', 'RUJUKAN_RS') NOT NULL,
    durasi_istirahat VARCHAR(50) NULL,
    butuh_rujukan_rs BOOLEAN DEFAULT FALSE,
    rs_rujukan VARCHAR(150) NULL,
    petugas_klinik VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_medis_santri FOREIGN KEY (id_santri) REFERENCES santri(id_santri) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------------------
-- 9. TABEL: TRANSAKSI RFID (Modul 4: Cashless Kantin, Laundry, Perpustakaan)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transaksi_rfid (
    id_trx VARCHAR(30) PRIMARY KEY, -- e.g., 'TRX-POS-101'
    id_santri VARCHAR(20) NOT NULL,
    tanggal DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tipe_trx ENUM('KANTIN_POS', 'LAUNDRY', 'PERPUSTAKAAN', 'TOP_UP') NOT NULL,
    nominal DECIMAL(12, 2) NOT NULL,
    merchant VARCHAR(100) NOT NULL,
    keterangan VARCHAR(255) NOT NULL,
    saldo_akhir DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_trx_santri FOREIGN KEY (id_santri) REFERENCES santri(id_santri) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------------------
-- INDEXES UNTUK OPTIMASI PERFORMA REAL-TIME QUERY
-- -------------------------------------------------------------------------------------
CREATE INDEX idx_santri_rfid ON santri(rfid_uid);
CREATE INDEX idx_perizinan_status ON perizinan(status, batas_kembali);
CREATE INDEX idx_gatelog_timestamp ON gate_logs(timestamp);
CREATE INDEX idx_poin_santri ON poin_riayah(id_santri, tanggal);
