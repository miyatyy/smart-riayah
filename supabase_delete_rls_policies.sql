-- =====================================================================================
-- SMART RI'AYAH: SUPABASE RLS POLICIES FOR DELETE (HAPUS DATA)
-- Jalankan skrip ini di: Supabase Console -> SQL Editor -> New Query -> Run
-- =====================================================================================

-- 1. Pastikan ekstensi dan RLS aktif pada seluruh tabel utama
ALTER TABLE IF EXISTS santri ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS gate_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS evaluasi_harian ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pelanggaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS rekam_medis ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS rfid_transactions ENABLE ROW LEVEL SECURITY;

-- 2. Terapkan Policy DELETE untuk role 'anon' dan 'authenticated'
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'santri', 
        'rooms', 
        'permits', 
        'gate_logs', 
        'evaluasi_harian', 
        'pelanggaran', 
        'rekam_medis', 
        'rfid_transactions'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables
    LOOP
        -- Hapus policy lama jika ada untuk mencegah konflik duplikasi
        EXECUTE format('DROP POLICY IF EXISTS "Allow delete for anon and authenticated on %I" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Allow all delete on %I" ON %I', tbl, tbl);

        -- Buat policy DELETE terbuka untuk akses aplikasi
        EXECUTE format('CREATE POLICY "Allow delete for anon and authenticated on %I" ON %I FOR DELETE TO anon, authenticated USING (true)', tbl, tbl);

        RAISE NOTICE '✅ Policy DELETE berhasil dikonfigurasi untuk tabel: %', tbl;
    END LOOP;
END $$;

-- 3. Verifikasi apakah seluruh tabel sudah memiliki policy DELETE aktif
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    cmd, 
    roles 
FROM pg_policies 
WHERE cmd = 'DELETE'
ORDER BY tablename;

