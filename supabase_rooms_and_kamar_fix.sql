-- =====================================================================================
-- SMART RI'AYAH: SUPABASE RLS & REALTIME PERMISSIONS FOR ROOMS & KAMAR
-- Jalankan skrip ini di: Supabase Console -> SQL Editor -> New Query -> Run
-- =====================================================================================

-- 1. Pastikan tabel rooms dan kamar mengizinkan SELECT, INSERT, UPDATE, DELETE untuk anon & authenticated
ALTER TABLE IF EXISTS rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS kamar ENABLE ROW LEVEL SECURITY;

-- Policy untuk tabel 'rooms'
DROP POLICY IF EXISTS "Allow all access on rooms" ON rooms;
DROP POLICY IF EXISTS "Allow all select on rooms" ON rooms;
DROP POLICY IF EXISTS "Allow all insert on rooms" ON rooms;
DROP POLICY IF EXISTS "Allow all update on rooms" ON rooms;
DROP POLICY IF EXISTS "Allow all delete on rooms" ON rooms;

CREATE POLICY "Allow all access on rooms" ON rooms 
FOR ALL TO anon, authenticated 
USING (true) 
WITH CHECK (true);

-- Policy untuk tabel 'kamar'
DROP POLICY IF EXISTS "Allow all access on kamar" ON kamar;
DROP POLICY IF EXISTS "Allow all select on kamar" ON kamar;
DROP POLICY IF EXISTS "Allow all insert on kamar" ON kamar;
DROP POLICY IF EXISTS "Allow all update on kamar" ON kamar;
DROP POLICY IF EXISTS "Allow all delete on kamar" ON kamar;

CREATE POLICY "Allow all access on kamar" ON kamar 
FOR ALL TO anon, authenticated 
USING (true) 
WITH CHECK (true);

-- 2. Pastikan publikasi Realtime mencakup rooms & kamar
ALTER TABLE rooms REPLICA IDENTITY FULL;
ALTER TABLE kamar REPLICA IDENTITY FULL;

DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE rooms, kamar;
    EXCEPTION
        WHEN duplicate_object THEN
            NULL;
    END;
END $$;

-- 3. Sinkronisasi Data Keterisian & Kuota Kasur (Semua 6 Kamar Asrama)
UPDATE rooms SET terisi = 8, kapasitas = 10, lantai = 2 WHERE id = 'RM-204';
UPDATE rooms SET terisi = 7, kapasitas = 8, lantai = 1 WHERE id = 'RM-102';
UPDATE rooms SET terisi = 6, kapasitas = 8, lantai = 1 WHERE id = 'RM-105';
UPDATE rooms SET terisi = 4, kapasitas = 8, lantai = 1 WHERE id = 'RM-101';
UPDATE rooms SET terisi = 5, kapasitas = 10, lantai = 2 WHERE id = 'RM-202';
UPDATE rooms SET terisi = 1, kapasitas = 25, lantai = 2 WHERE id = 'RM-9248';

-- Bersihkan data uji coba jika ada di tabel kamar
DELETE FROM kamar WHERE nama_kamar = 'Kamar Uji Coba';

-- Reset auto-increment sequence id tabel kamar agar tidak duplikat
SELECT setval(pg_get_serial_sequence('kamar', 'id'), COALESCE(MAX(id), 1)) FROM kamar;

-- 4. Verifikasi Data Kamar di Supabase
SELECT id, nomor_kamar, nama_gedung, lantai, kapasitas, terisi FROM rooms ORDER BY id;
SELECT id, nama_kamar, asrama, kapasitas, ketua, catatan FROM kamar ORDER BY id;
