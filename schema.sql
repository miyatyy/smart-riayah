-- =====================================================================================
-- SKEMA BASIS DATA POSTGRESQL & SUPABASE REALTIME: SMART RI'AYAH (smart_riayah_db)
-- Sistem Manajemen, Monitoring Santri, IoT Smart Gate, Perizinan & AI Analytics
-- Eksekusi langsung di Supabase SQL Editor atau pgAdmin Query Tool
-- =====================================================================================

-- 0. EXTENSION & TRIGGER FUNCTION OTOMATISASI UPDATED_AT
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -------------------------------------------------------------------------------------
-- 1. TABEL: ROLES (Peran Pengguna Sistem)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    nama_role VARCHAR(50) NOT NULL UNIQUE,
    deskripsi TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------------------------------
-- 2. TABEL: USERS (Pengguna Sistem, Pembina & Pengurus)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nama_lengkap VARCHAR(150) NOT NULL,
    email VARCHAR(100) UNIQUE,
    role_id INT NOT NULL REFERENCES roles(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    no_telepon VARCHAR(25),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------------------------------
-- 3. TABEL: ROOMS (Kamar Asrama Santri & Realtime Occupancy)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rooms (
    id VARCHAR(50) PRIMARY KEY, -- Contoh: 'RM-204'
    nama_gedung VARCHAR(150) NOT NULL DEFAULT 'Asrama Santri',
    kategori_gedung VARCHAR(20) NOT NULL DEFAULT 'PUTRA' CHECK (kategori_gedung IN ('PUTRA', 'PUTRI')),
    nomor_kamar VARCHAR(100) NOT NULL,
    lantai INT NOT NULL DEFAULT 1,
    kapasitas INT NOT NULL DEFAULT 8,
    terisi INT NOT NULL DEFAULT 0,
    ketua_kamar VARCHAR(150),
    skor_kerapian_terakhir INT NOT NULL DEFAULT 90 CHECK (skor_kerapian_terakhir BETWEEN 0 AND 100),
    jadwal_piket_hari_ini VARCHAR(255) DEFAULT 'Jadwal Reguler',
    catatan_inspeksi TEXT DEFAULT 'Kamar siap huni dan rapi.',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS trg_rooms_updated_at ON rooms;
CREATE TRIGGER trg_rooms_updated_at
BEFORE UPDATE ON rooms
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -------------------------------------------------------------------------------------
-- 4. TABEL: SANTRI (Data Induk Santri, Identitas RFID & Saldo)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS santri (
    id VARCHAR(50) PRIMARY KEY, -- Contoh: 'S-101'
    nis VARCHAR(50) NOT NULL UNIQUE,
    nama_lengkap VARCHAR(150) NOT NULL,
    gender VARCHAR(10) NOT NULL DEFAULT 'L' CHECK (gender IN ('L', 'P')),
    kelas VARCHAR(50) NOT NULL DEFAULT '10-A',
    kamar_id VARCHAR(50) REFERENCES rooms(id) ON UPDATE CASCADE ON DELETE SET NULL,
    kamar VARCHAR(100) NOT NULL DEFAULT 'Umar bin Khattab 204',
    rfid_uid VARCHAR(50) UNIQUE, -- Contoh: '04:A1:2B:9C'
    nama_wali VARCHAR(150),
    no_wali VARCHAR(50),
    saldo_rfid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    saldo_awal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    limit_jajan_harian NUMERIC(12, 2) NOT NULL DEFAULT 25000.00,
    poin_disiplin INT NOT NULL DEFAULT 100 CHECK (poin_disiplin BETWEEN 0 AND 100),
    status_asrama VARCHAR(30) NOT NULL DEFAULT 'DI_ASRAMA' CHECK (status_asrama IN ('DI_ASRAMA', 'DI_LUAR', 'TERLAMBAT', 'SAKIT')),
    foto_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS trg_santri_updated_at ON santri;
CREATE TRIGGER trg_santri_updated_at
BEFORE UPDATE ON santri
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -------------------------------------------------------------------------------------
-- 5. TABEL: PERMITS (Surat Izin Santri Keluar / Pulang / Bermalam)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS permits (
    id VARCHAR(50) PRIMARY KEY, -- Contoh: 'PRM-2026-001'
    santri_id VARCHAR(50) NOT NULL REFERENCES santri(id) ON UPDATE CASCADE ON DELETE CASCADE,
    santri_nama VARCHAR(150),
    kategori VARCHAR(50) NOT NULL DEFAULT 'Pesiar',
    keperluan TEXT,
    penjemput VARCHAR(150),
    waktu_keluar_rencana TIMESTAMP WITH TIME ZONE,
    batas_kembali TIMESTAMP WITH TIME ZONE,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'ACTIVE', 'OVERDUE', 'COMPLETED', 'REJECTED')),
    musyrif_penyetuju VARCHAR(150),
    waktu_approval TIMESTAMP WITH TIME ZONE,
    waktu_keluar_aktual TIMESTAMP WITH TIME ZONE,
    waktu_kembali_aktual TIMESTAMP WITH TIME ZONE,
    token_izin VARCHAR(100),
    catatan_musyrif TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------------------------------
-- 6. TABEL: GATE_LOGS (Log Riwayat Tap RFID Smart Turnstile Gate ESP32-S3)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gate_logs (
    id VARCHAR(50) PRIMARY KEY, -- Contoh: 'LOG-9001'
    santri_id VARCHAR(50) REFERENCES santri(id) ON UPDATE CASCADE ON DELETE SET NULL,
    santri_nama VARCHAR(150),
    rfid_uid VARCHAR(50),
    gate_id VARCHAR(50) DEFAULT 'GATE-01 (Main Gate)',
    tipe VARCHAR(30) NOT NULL DEFAULT 'TAP_KELUAR' CHECK (tipe IN ('TAP_KELUAR', 'TAP_MASUK', 'DENIED_BYPASS', 'DENIED_BLOCKED')),
    status VARCHAR(30) NOT NULL DEFAULT 'VERIFIED' CHECK (status IN ('VERIFIED', 'BLOCKED', 'OVERDUE', 'WARNING')),
    remarks TEXT,
    snapshot_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------------------------------
-- 7. TABEL: EVALUASI_HARIAN (Monitoring Shalat 5 Waktu, Tahfidz & Kedisiplinan)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evaluasi_harian (
    id SERIAL PRIMARY KEY,
    santri_id VARCHAR(50) NOT NULL REFERENCES santri(id) ON UPDATE CASCADE ON DELETE CASCADE,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    shalat_subuh VARCHAR(30) NOT NULL DEFAULT 'BERJAMAAH_MASJID',
    shalat_dzuhur VARCHAR(30) NOT NULL DEFAULT 'BERJAMAAH_MASJID',
    shalat_ashar VARCHAR(30) NOT NULL DEFAULT 'BERJAMAAH_MASJID',
    shalat_maghrib VARCHAR(30) NOT NULL DEFAULT 'BERJAMAAH_MASJID',
    shalat_isya VARCHAR(30) NOT NULL DEFAULT 'BERJAMAAH_MASJID',
    dhuha BOOLEAN DEFAULT TRUE,
    qiyamullail BOOLEAN DEFAULT TRUE,
    tahfidz_surah VARCHAR(100) DEFAULT 'An-Naba',
    tahfidz_ayat VARCHAR(50) DEFAULT '1-15',
    tahfidz_juz INT DEFAULT 1,
    tahfidz_predikat VARCHAR(20) DEFAULT 'MUMTAZ',
    tahfidz_nilai VARCHAR(10) DEFAULT 'A',
    skor_kedisiplinan INT NOT NULL DEFAULT 95 CHECK (skor_kedisiplinan BETWEEN 0 AND 100),
    kebersihan_kamar INT NOT NULL DEFAULT 90 CHECK (kebersihan_kamar BETWEEN 0 AND 100),
    catatan_perilaku TEXT,
    rekomendasi_ai TEXT,
    evaluator_id INT REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_santri_tanggal UNIQUE (santri_id, tanggal)
);

DROP TRIGGER IF EXISTS trg_evaluasi_updated_at ON evaluasi_harian;
CREATE TRIGGER trg_evaluasi_updated_at
BEFORE UPDATE ON evaluasi_harian
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -------------------------------------------------------------------------------------
-- 8. TABEL: PELANGGARAN (Catatan Kedisiplinan & Reward Santri)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pelanggaran (
    id VARCHAR(50) PRIMARY KEY, -- Contoh: 'DISC-01'
    santri_id VARCHAR(50) NOT NULL REFERENCES santri(id) ON UPDATE CASCADE ON DELETE CASCADE,
    tanggal TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    jenis VARCHAR(20) NOT NULL DEFAULT 'PELANGGARAN' CHECK (jenis IN ('PELANGGARAN', 'REWARD')),
    kategori VARCHAR(100) NOT NULL DEFAULT 'Kedisiplinan',
    poin INT NOT NULL DEFAULT 0,
    deskripsi TEXT,
    pencatat VARCHAR(150) DEFAULT 'Musyrif',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------------------------------
-- 9. TABEL: REKAM_MEDIS (Klinik Poskestren & Kesehatan Santri)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rekam_medis (
    id VARCHAR(50) PRIMARY KEY, -- Contoh: 'MED-001'
    santri_id VARCHAR(50) NOT NULL REFERENCES santri(id) ON UPDATE CASCADE ON DELETE CASCADE,
    tanggal TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    keluhan TEXT NOT NULL,
    diagnosa TEXT NOT NULL,
    tindakan TEXT NOT NULL,
    status_istirahat VARCHAR(50) NOT NULL DEFAULT 'ISTIRAHAT_ASRAMA',
    durasi_istirahat VARCHAR(50) DEFAULT '1 Hari',
    butuh_rujukan_rs BOOLEAN NOT NULL DEFAULT FALSE,
    rs_rujukan VARCHAR(150),
    petugas_klinik VARCHAR(150) DEFAULT 'dr. Nurul Aini (Poskestren)',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------------------------------
-- 10. TABEL: RFID_TRANSACTIONS (Transaksi Dompet Digital Santri di Kantin & Koperasi)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rfid_transactions (
    id VARCHAR(50) PRIMARY KEY, -- Contoh: 'TRX-POS-101'
    santri_id VARCHAR(50) NOT NULL REFERENCES santri(id) ON UPDATE CASCADE ON DELETE CASCADE,
    tanggal TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    tipe VARCHAR(50) NOT NULL DEFAULT 'KANTIN_POS',
    nominal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    merchant VARCHAR(150) DEFAULT 'Kantin Sehat Darul Ulum',
    keterangan TEXT,
    saldo_akhir NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------------------------------
-- 11. INDEX UNTUK PERFORMA QUERY MAKSIMAL
-- -------------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_santri_nis ON santri(nis);
CREATE INDEX IF NOT EXISTS idx_santri_rfid ON santri(rfid_uid);
CREATE INDEX IF NOT EXISTS idx_permits_santri ON permits(santri_id);
CREATE INDEX IF NOT EXISTS idx_gate_logs_santri ON gate_logs(santri_id);
CREATE INDEX IF NOT EXISTS idx_gate_logs_created ON gate_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evaluasi_santri_tgl ON evaluasi_harian(santri_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_rooms_nomor ON rooms(nomor_kamar);
CREATE INDEX IF NOT EXISTS idx_pelanggaran_santri ON pelanggaran(santri_id);
CREATE INDEX IF NOT EXISTS idx_rekam_medis_santri ON rekam_medis(santri_id);
CREATE INDEX IF NOT EXISTS idx_rfid_trx_santri ON rfid_transactions(santri_id);

-- -------------------------------------------------------------------------------------
-- 12. KONFIGURASI ROW LEVEL SECURITY (RLS) & POLICIES SUPABASE
-- -------------------------------------------------------------------------------------
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE santri ENABLE ROW LEVEL SECURITY;
ALTER TABLE permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE gate_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluasi_harian ENABLE ROW LEVEL SECURITY;
ALTER TABLE pelanggaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE rekam_medis ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfid_transactions ENABLE ROW LEVEL SECURITY;

-- Buat Kebijakan Akses (Policies) agar aplikasi web/klien anonim & terautentikasi dapat membaca & menulis
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('roles', 'users', 'rooms', 'santri', 'permits', 'gate_logs', 'evaluasi_harian', 'pelanggaran', 'rekam_medis', 'rfid_transactions')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Allow all select on %I" ON %I', t, t);
        EXECUTE format('CREATE POLICY "Allow all select on %I" ON %I FOR SELECT TO anon, authenticated USING (true)', t, t);

        EXECUTE format('DROP POLICY IF EXISTS "Allow all insert on %I" ON %I', t, t);
        EXECUTE format('CREATE POLICY "Allow all insert on %I" ON %I FOR INSERT TO anon, authenticated WITH CHECK (true)', t, t);

        EXECUTE format('DROP POLICY IF EXISTS "Allow all update on %I" ON %I', t, t);
        EXECUTE format('CREATE POLICY "Allow all update on %I" ON %I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)', t, t);

        EXECUTE format('DROP POLICY IF EXISTS "Allow all delete on %I" ON %I', t, t);
        EXECUTE format('CREATE POLICY "Allow all delete on %I" ON %I FOR DELETE TO anon, authenticated USING (true)', t, t);
    END LOOP;
END $$;

-- -------------------------------------------------------------------------------------
-- 13. AKTIFKAN REPLICA IDENTITY FULL & PUBLIKASI SUPABASE REALTIME
-- -------------------------------------------------------------------------------------
ALTER TABLE rooms REPLICA IDENTITY FULL;
ALTER TABLE santri REPLICA IDENTITY FULL;
ALTER TABLE permits REPLICA IDENTITY FULL;
ALTER TABLE gate_logs REPLICA IDENTITY FULL;
ALTER TABLE evaluasi_harian REPLICA IDENTITY FULL;
ALTER TABLE pelanggaran REPLICA IDENTITY FULL;
ALTER TABLE rekam_medis REPLICA IDENTITY FULL;
ALTER TABLE rfid_transactions REPLICA IDENTITY FULL;

-- Tambahkan tabel ke supabase_realtime publication
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE rooms, santri, permits, gate_logs, evaluasi_harian, pelanggaran, rekam_medis, rfid_transactions;
    EXCEPTION
        WHEN duplicate_object THEN
            NULL; -- Jika sudah terdaftar, lewati
    END;
END $$;

-- -------------------------------------------------------------------------------------
-- 14. DATA AWAL (SEED DATA DEFAULT)
-- -------------------------------------------------------------------------------------

-- Roles
INSERT INTO roles (nama_role, deskripsi) VALUES
('superadmin', 'Akses penuh ke seluruh konfigurasi master sistem'),
('admin_riayah', 'Administrasi santri, pos RFID, keuangan, dan data induk'),
('musyrif', 'Pembina asrama, evaluasi harian shalat & tahfidz, approval izin'),
('satpam', 'Petugas gerbang pos keamanan & monitoring scan RFID Smart Gate'),
('poskestren', 'Petugas medis & klinik santri'),
('walisantri', 'Akses portal pantau perkembangan anak oleh wali santri'),
('mudir', 'Pimpinan pondok / eksekutif monitoring riayah')
ON CONFLICT (nama_role) DO NOTHING;

-- Rooms
INSERT INTO rooms (id, nama_gedung, kategori_gedung, nomor_kamar, lantai, kapasitas, terisi, ketua_kamar, skor_kerapian_terakhir, jadwal_piket_hari_ini, catatan_inspeksi) VALUES
('RM-204', 'Asrama Putra Umar bin Khattab', 'PUTRA', 'Kamar 204', 2, 10, 8, 'Ahmad Fauzi', 94, 'Ahmad Fauzi & Danial Hakim', 'Kamar rapi, lemari seragam tertata rapi, sajadah terlipat wangi.'),
('RM-102', 'Asrama Putra Abu Bakar', 'PUTRA', 'Kamar 102', 1, 8, 7, 'Muhammad Rayhan', 88, 'Rayhan & Ilham', 'Rak sandal luar perlu ditata ulang.'),
('RM-105', 'Asrama Putri Khadijah', 'PUTRI', 'Kamar 105', 1, 8, 6, 'Siti Nurhaliza', 98, 'Siti Nurhaliza & Fatimah K.', 'Sangat bersih, wangi melati, sanitasi wastafel prima.'),
('RM-101', 'Asrama Putri Siti Aisyah', 'PUTRI', 'Kamar 101', 1, 8, 4, 'Siti Maryam', 95, 'Siti Maryam & Anisa', 'Kamar baru renovasi, fasilitas tempat tidur dan loker baru siap pakai.'),
('RM-202', 'Asrama Putri Siti Aisyah', 'PUTRI', 'Kamar 202', 2, 10, 5, 'Aisyah Zahra', 96, 'Aisyah Zahra & Zahirah', 'Kamar rapi, mukena bersih di gantungan.')
ON CONFLICT (id) DO NOTHING;

-- Santri
INSERT INTO santri (id, nis, nama_lengkap, gender, kelas, kamar_id, kamar, rfid_uid, nama_wali, no_wali, saldo_rfid, saldo_awal, limit_jajan_harian, poin_disiplin, status_asrama) VALUES
('S-101', '125456', 'Muhammad Fatih Robbani', 'L', '10 IPA 1', 'RM-204', 'Asrama Putra Umar bin Khattab - Kamar 204', '04:A1:2B:9C', 'H. Bambang Sudarsono', '081234567895', 125000.00, 100000.00, 30000.00, 98, 'DI_ASRAMA'),
('S-102', '125457', 'Aisyah Putri Azzahra', 'P', '11 Keagamaan', 'RM-105', 'Asrama Putri Khadijah - Kamar 105', '53:67:89:EF', 'Hj. Nuraini', '081298765432', 85000.00, 100000.00, 25000.00, 100, 'DI_ASRAMA'),
('S-103', '125458', 'Rayhan Dwi Prasetyo', 'L', '10 IPA 2', 'RM-102', 'Asrama Putra Abu Bakar - Kamar 102', '64:98:C1:2A', 'Drs. Subroto', '085712348899', 45000.00, 100000.00, 20000.00, 88, 'DI_LUAR'),
('S-104', '125459', 'Fatima Zahra El-Farabi', 'P', '12 IPS 1', 'RM-202', 'Asrama Putri Siti Aisyah - Kamar 202', '12:89:D4:5B', 'Ir. H. Syamsudin', '081377889900', 150000.00, 100000.00, 35000.00, 95, 'DI_ASRAMA')
ON CONFLICT (id) DO NOTHING;

-- Permits
INSERT INTO permits (id, santri_id, santri_nama, kategori, keperluan, penjemput, batas_kembali, status, token_izin) VALUES
('PRM-2026-001', 'S-101', 'Muhammad Fatih Robbani', 'Pesiar', 'Membeli kitab kuning dan perlengkapan mandi', 'Paman Ridwan', NOW() + INTERVAL '4 hours', 'APPROVED', 'DU-PERMIT-101-7789'),
('PRM-2026-002', 'S-103', 'Rayhan Dwi Prasetyo', 'Pulang Bermalam', 'Menghadiri walimatul ursy keluarga', 'Bapak Subroto', NOW() + INTERVAL '12 hours', 'ACTIVE', 'DU-PERMIT-103-3312')
ON CONFLICT (id) DO NOTHING;

-- Gate Logs
INSERT INTO gate_logs (id, santri_id, santri_nama, rfid_uid, gate_id, tipe, status, remarks) VALUES
('LOG-9001', 'S-103', 'Rayhan Dwi Prasetyo', '64:98:C1:2A', 'GATE-01 (Main Exit)', 'TAP_KELUAR', 'VERIFIED', 'Izin Pulang Bermalam Valid'),
('LOG-9002', 'S-101', 'Muhammad Fatih Robbani', '04:A1:2B:9C', 'GATE-01 (Main Exit)', 'TAP_KELUAR', 'VERIFIED', 'Izin Pesiar Disetujui')
ON CONFLICT (id) DO NOTHING;
