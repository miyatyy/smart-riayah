-- =====================================================================================
-- SMART RI'AYAH: TABEL KHUSUS LAPORAN KELAKUAN SANTRI / WATI OLEH OSIS (CRUD)
-- Jalankan skrip ini di: Supabase Dashboard -> SQL Editor -> New Query -> Run
-- Catatan: Sistem juga memiliki auto-fallback jika tabel ini belum dibuat,
-- namun menjalankan SQL ini membuat data OSIS lebih rapi di Table Editor Supabase!
-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.osis_reports (
    id VARCHAR(80) PRIMARY KEY,
    santri_id VARCHAR(80) NOT NULL,
    santri_nama VARCHAR(150) NOT NULL DEFAULT '',
    gender VARCHAR(10) NOT NULL DEFAULT 'L',
    kelas VARCHAR(80) DEFAULT '',
    kamar VARCHAR(150) DEFAULT '',
    bidang_osis VARCHAR(150) NOT NULL DEFAULT 'OSIS Kamtib',
    pelapor_nama VARCHAR(150) NOT NULL DEFAULT 'Pengurus OSIS',
    kategori VARCHAR(40) NOT NULL DEFAULT 'PELANGGARAN',
    jenis VARCHAR(255) NOT NULL,
    keterangan TEXT DEFAULT '',
    poin INT NOT NULL DEFAULT 0,
    tazir TEXT DEFAULT '',
    status VARCHAR(40) NOT NULL DEFAULT 'PENDING_ADMIN',
    admin_note TEXT DEFAULT '',
    verified_by VARCHAR(150),
    verified_at TIMESTAMP WITH TIME ZONE,
    tanggal VARCHAR(20) DEFAULT '',
    waktu VARCHAR(20) DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_osis_reports_santri ON public.osis_reports(santri_id);
CREATE INDEX IF NOT EXISTS idx_osis_reports_status ON public.osis_reports(status);
CREATE INDEX IF NOT EXISTS idx_osis_reports_created ON public.osis_reports(created_at DESC);

-- Trigger otomatis perbarui updated_at
CREATE OR REPLACE FUNCTION public.update_osis_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_osis_reports_updated_at ON public.osis_reports;
CREATE TRIGGER trg_osis_reports_updated_at
BEFORE UPDATE ON public.osis_reports
FOR EACH ROW EXECUTE FUNCTION public.update_osis_reports_updated_at();

-- Aktifkan RLS & izinkan akses penuh CRUD (Create, Read, Update, Delete)
ALTER TABLE public.osis_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all select on osis_reports" ON public.osis_reports;
CREATE POLICY "Allow all select on osis_reports"
    ON public.osis_reports FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow all insert on osis_reports" ON public.osis_reports;
CREATE POLICY "Allow all insert on osis_reports"
    ON public.osis_reports FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all update on osis_reports" ON public.osis_reports;
CREATE POLICY "Allow all update on osis_reports"
    ON public.osis_reports FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all delete on osis_reports" ON public.osis_reports;
CREATE POLICY "Allow all delete on osis_reports"
    ON public.osis_reports FOR DELETE TO anon, authenticated USING (true);

-- Aktifkan Supabase Realtime agar perubahan CRUD langsung muncul di semua perangkat
ALTER TABLE public.osis_reports REPLICA IDENTITY FULL;

DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.osis_reports;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
END $$;
