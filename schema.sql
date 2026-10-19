-- =====================================================================================
-- SKEMA BASIS DATA POSTGRESQL: SMART RI'AYAH (smart_riayah_db)
-- Sistem Manajemen, Monitoring Santri, IoT Smart Gate & AI Analytics
-- Cocok dieksekusi langsung di pgAdmin Query Tool atau psql CLI
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
    deskripsi VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------------------------------
-- 2. TABEL: USERS (Akun Pengguna Multirole)
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

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -------------------------------------------------------------------------------------
-- 3. TABEL: SANTRI (Data Induk Santri & Identitas RFID IoT)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS santri (
    id VARCHAR(30) PRIMARY KEY, -- Contoh: 'S-101'
    nis VARCHAR(30) NOT NULL UNIQUE,
    nama_lengkap VARCHAR(150) NOT NULL,
    gender VARCHAR(5) NOT NULL CHECK (gender IN ('L', 'P')),
    kelas VARCHAR(50) NOT NULL,
    kamar VARCHAR(50) NOT NULL,
    rfid_uid VARCHAR(32) UNIQUE, -- Contoh: '04:A1:2B:9C'
    nama_wali VARCHAR(150),
    no_wali VARCHAR(25),
    saldo_rfid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
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
-- 4. TABEL: EVALUASI_HARIAN (Monitoring Shalat 5 Waktu, Tahfidz & Kedisiplinan)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evaluasi_harian (
    id SERIAL PRIMARY KEY,
    santri_id VARCHAR(30) NOT NULL REFERENCES santri(id) ON UPDATE CASCADE ON DELETE CASCADE,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    shalat_subuh VARCHAR(20) NOT NULL DEFAULT 'Berjamaah' CHECK (shalat_subuh IN ('Berjamaah', 'Masbuk', 'Munfarid', 'Alfa', 'Udzur')),
    shalat_dzuhur VARCHAR(20) NOT NULL DEFAULT 'Berjamaah' CHECK (shalat_dzuhur IN ('Berjamaah', 'Masbuk', 'Munfarid', 'Alfa', 'Udzur')),
    shalat_ashar VARCHAR(20) NOT NULL DEFAULT 'Berjamaah' CHECK (shalat_ashar IN ('Berjamaah', 'Masbuk', 'Munfarid', 'Alfa', 'Udzur')),
    shalat_maghrib VARCHAR(20) NOT NULL DEFAULT 'Berjamaah' CHECK (shalat_maghrib IN ('Berjamaah', 'Masbuk', 'Munfarid', 'Alfa', 'Udzur')),
    shalat_isya VARCHAR(20) NOT NULL DEFAULT 'Berjamaah' CHECK (shalat_isya IN ('Berjamaah', 'Masbuk', 'Munfarid', 'Alfa', 'Udzur')),
    tahfidz_surah VARCHAR(100) DEFAULT 'An-Naba',
    tahfidz_ayat VARCHAR(50) DEFAULT '1-15',
    tahfidz_nilai VARCHAR(10) DEFAULT 'A' CHECK (tahfidz_nilai IN ('A', 'B', 'C', 'D')),
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
-- 5. INDEX UNTUK PERFORMA QUERY CEPAT
-- -------------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_santri_nis ON santri(nis);
CREATE INDEX IF NOT EXISTS idx_santri_rfid ON santri(rfid_uid);
CREATE INDEX IF NOT EXISTS idx_evaluasi_santri_tgl ON evaluasi_harian(santri_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);

-- -------------------------------------------------------------------------------------
-- 6. DATA AWAL (SEED DATA DEFAULT UNTUK TESTING)
-- -------------------------------------------------------------------------------------

-- Insert Default Roles
INSERT INTO roles (nama_role, deskripsi) VALUES
('superadmin', 'Akses penuh ke seluruh konfigurasi master sistem'),
('admin_riayah', 'Administrasi santri, pos RFID, keuangan, dan data induk'),
('musyrif', 'Pembina asrama, evaluasi harian shalat & tahfidz, approval izin'),
('satpam', 'Petugas gerbang pos keamanan & monitoring scan RFID Smart Gate'),
('poskestren', 'Petugas medis & klinik santri'),
('walisantri', 'Akses portal pantau perkembangan anak oleh wali santri'),
('mudir', 'Pimpinan pondok / eksekutif monitoring riayah')
ON CONFLICT (nama_role) DO NOTHING;

-- Insert Default Users
INSERT INTO users (username, password_hash, nama_lengkap, email, role_id, no_telepon) VALUES
('superadmin', 'superadmin01', 'Ustadz Ahmad Al-Faruq, M.Pd.', 'superadmin@smartriayah.sch.id', 1, '081234567890'),
('riayah01', 'riayah01', 'Ustadzah Siti Aminah, S.Ag.', 'adminriayah@smartriayah.sch.id', 2, '081234567891'),
('musyrif01', 'musyrif01', 'Ustadz Hasan Basri, S.Pd.I', 'musyrif@smartriayah.sch.id', 3, '081234567892'),
('satpam01', 'satpam01', 'Pak Joko Purwanto', 'security@smartriayah.sch.id', 4, '081234567893'),
('poskestren01', 'poskestren01', 'dr. Fitriani Rahmawati', 'poskestren@smartriayah.sch.id', 5, '081234567894'),
('walisantri01', 'walisantri01', 'H. Bambang Sudarsono', 'wali.bambang@gmail.com', 6, '081234567895'),
('mudir01', 'mudir01', 'K.H. Muhammad Ridwan, Lc., M.A.', 'mudir@smartriayah.sch.id', 7, '081234567896')
ON CONFLICT (username) DO NOTHING;

-- Insert Sample Santri
INSERT INTO santri (id, nis, nama_lengkap, gender, kelas, kamar, rfid_uid, nama_wali, no_wali, saldo_rfid, limit_jajan_harian, poin_disiplin, status_asrama) VALUES
('S-101', '125456', 'Muhammad Fatih Robbani', 'L', '10 IPA 1', 'Kamar Umar bin Khattab (RM-204)', '04:A1:2B:9C', 'H. Bambang Sudarsono', '081234567895', 125000.00, 30000.00, 98, 'DI_ASRAMA'),
('S-102', '125457', 'Aisyah Putri Azzahra', 'P', '11 Keagamaan', 'Kamar Khadijah (RF-102)', '53:67:89:EF', 'Hj. Nuraini', '081298765432', 85000.00, 25000.00, 100, 'DI_ASRAMA'),
('S-103', '125458', 'Rayhan Dwi Prasetyo', 'L', '10 IPA 2', 'Kamar Ali bin Abi Thalib (RM-105)', '64:98:C1:2A', 'Drs. Subroto', '085712348899', 45000.00, 20000.00, 88, 'DI_LUAR'),
('S-104', '125459', 'Fatima Zahra El-Farabi', 'P', '12 IPS 1', 'Kamar Aisyah (RF-201)', '12:89:D4:5B', 'Ir. H. Syamsudin', '081377889900', 150000.00, 35000.00, 95, 'DI_ASRAMA')
ON CONFLICT (id) DO NOTHING;

-- Insert Sample Evaluasi Harian
INSERT INTO evaluasi_harian (santri_id, tanggal, shalat_subuh, shalat_dzuhur, shalat_ashar, shalat_maghrib, shalat_isya, tahfidz_surah, tahfidz_ayat, tahfidz_nilai, skor_kedisiplinan, kebersihan_kamar, catatan_perilaku, rekomendasi_ai, evaluator_id) VALUES
('S-101', CURRENT_DATE, 'Berjamaah', 'Berjamaah', 'Berjamaah', 'Berjamaah', 'Berjamaah', 'An-Naba', '1-20', 'A', 98, 95, 'Sangat tertib, bangun qiyamul lail sebelum subuh dan murajaah tartil.', 'Pertahankan hafalan juz 30 dan persiapkan ujian tasmi akhir bulan.', 3),
('S-102', CURRENT_DATE, 'Berjamaah', 'Berjamaah', 'Berjamaah', 'Berjamaah', 'Berjamaah', 'Al-Mulk', '1-15', 'A', 100, 96, 'Karakter teladan di asrama putri, makharijul huruf tajwid sangat fasih.', 'Sangat layak dicalonkan menjadi duta tahfidz pesantren.', 3),
('S-103', CURRENT_DATE, 'Masbuk', 'Berjamaah', 'Berjamaah', 'Berjamaah', 'Berjamaah', 'An-Nazi''at', '1-10', 'B', 88, 85, 'Masbuk shalat subuh 1 rakaat karena terlambat bangun, perlu pendampingan.', 'Musyrif disarankan menjadwalkan pembinaan adab tidur lebih awal.', 3)
ON CONFLICT (santri_id, tanggal) DO NOTHING;
