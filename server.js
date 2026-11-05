import express from 'express';
import cors from 'cors';
import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

// Konfigurasi Koneksi PostgreSQL (smart_riayah_db / pgAdmin)
const pool = new Pool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_DATABASE || process.env.DB_NAME || 'smart_riayah_db',
    user: process.env.DB_USERNAME || process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '140203',
});

// Tes Koneksi Database
pool.connect((err, client, release) => {
    if (err) {
        return console.error('Gagal konek ke PostgreSQL:', err.stack);
    }
    console.log('Berhasil terhubung ke database PostgreSQL (smart_riayah_db)!');
    release();
});

// Endpoint untuk mengambil data santri
app.get('/api/santri', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM santri ORDER BY id');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoint untuk mengambil data kamar & keterisian kasur (rooms)
app.get('/api/rooms', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM rooms ORDER BY id');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoint untuk sync/update kamar (kapasitas & keterisian kasur)
app.post('/api/rooms', async (req, res) => {
    try {
        const r = req.body;
        const result = await pool.query(`
          INSERT INTO rooms (id, nama_gedung, kategori_gedung, nomor_kamar, lantai, kapasitas, terisi, ketua_kamar, catatan_inspeksi)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO UPDATE SET
            nama_gedung = EXCLUDED.nama_gedung,
            kategori_gedung = EXCLUDED.kategori_gedung,
            nomor_kamar = EXCLUDED.nomor_kamar,
            lantai = EXCLUDED.lantai,
            kapasitas = EXCLUDED.kapasitas,
            terisi = EXCLUDED.terisi,
            ketua_kamar = EXCLUDED.ketua_kamar,
            catatan_inspeksi = EXCLUDED.catatan_inspeksi,
            updated_at = NOW()
          RETURNING *;
        `, [
          r.id,
          r.nama_gedung || r.namaGedung || 'Asrama Santri',
          r.kategori_gedung || r.kategoriGedung || 'PUTRA',
          r.nomor_kamar || r.nomorKamar || '',
          parseInt(r.lantai || 1, 10),
          parseInt(r.kapasitas || 8, 10),
          parseInt(r.terisi || 0, 10),
          r.ketua_kamar || r.ketuaKamar || 'Belum Ditentukan',
          r.catatan_inspeksi || r.catatanInspeksi || 'Kamar siap huni.'
        ]);

        // Juga perbarui tabel alias 'kamar' untuk kompatibilitas pgAdmin
        await pool.query(`
          INSERT INTO kamar (kamar_id, nama_kamar, asrama, lantai, kapasitas, terisi, ketua, catatan)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO UPDATE SET
            nama_kamar = EXCLUDED.nama_kamar,
            asrama = EXCLUDED.asrama,
            lantai = EXCLUDED.lantai,
            kapasitas = EXCLUDED.kapasitas,
            terisi = EXCLUDED.terisi,
            ketua = EXCLUDED.ketua,
            catatan = EXCLUDED.catatan,
            updated_at = NOW();
        `, [
          r.id,
          r.nomor_kamar || r.nomorKamar,
          r.nama_gedung || r.namaGedung,
          parseInt(r.lantai || 1, 10),
          parseInt(r.kapasitas || 8, 10),
          parseInt(r.terisi || 0, 10),
          r.ketua_kamar || r.ketuaKamar,
          r.catatan_inspeksi || r.catatanInspeksi
        ]).catch(() => {});

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.SERVER_PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server Backend Smart Riayah berjalan di http://localhost:${PORT}`);
});
