import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, testConnection } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.SERVER_PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// -------------------------------------------------------------------------------------
// HEALTH CHECK ENDPOINT
// -------------------------------------------------------------------------------------
app.get('/api/health', async (req, res) => {
  const dbStatus = await testConnection();
  res.json({
    status: dbStatus.success ? 'healthy' : 'degraded',
    service: 'Smart Riayah PostgreSQL Backend API',
    timestamp: new Date().toISOString(),
    database: dbStatus
  });
});

// -------------------------------------------------------------------------------------
// 1. DATA MASTER: SANTRI
// -------------------------------------------------------------------------------------
app.get('/api/santri', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, nis, nama_lengkap, gender, kelas, kamar, rfid_uid, nama_wali, no_wali, saldo_rfid, poin_disiplin, status_asrama FROM santri ORDER BY nama_lengkap ASC'
    );
    res.json({
      success: true,
      total: result.rowCount,
      data: result.rows
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data santri',
      error: err.message
    });
  }
});

// -------------------------------------------------------------------------------------
// 2. DATA MASTER: USERS (PENGGUNA / EVALUATOR)
// -------------------------------------------------------------------------------------
app.get('/api/users', async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.username, u.nama_lengkap, u.email, r.nama_role, u.is_active 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       ORDER BY u.nama_lengkap ASC`
    );
    res.json({
      success: true,
      total: result.rowCount,
      data: result.rows
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data users',
      error: err.message
    });
  }
});

// -------------------------------------------------------------------------------------
// 3. GET /api/evaluasi: MENGAMBIL DAFTAR EVALUASI SANTRI
// Parameter Opsional Query: ?santri_id=S-101 & ?tanggal=2026-10-19 & ?limit=50
// -------------------------------------------------------------------------------------
app.get('/api/evaluasi', async (req, res) => {
  try {
    const { santri_id, tanggal, limit = 50 } = req.query;
    const conditions = [];
    const params = [];

    if (santri_id) {
      params.push(santri_id);
      conditions.push(`e.santri_id = $${params.length}`);
    }

    if (tanggal) {
      params.push(tanggal);
      conditions.push(`e.tanggal = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(parseInt(limit, 10));
    const limitClause = `LIMIT $${params.length}`;

    const sql = `
      SELECT 
        e.id,
        e.santri_id,
        s.nis AS santri_nis,
        s.nama_lengkap AS santri_nama,
        s.kelas AS santri_kelas,
        s.kamar AS santri_kamar,
        e.tanggal,
        e.shalat_subuh,
        e.shalat_dzuhur,
        e.shalat_ashar,
        e.shalat_maghrib,
        e.shalat_isya,
        e.tahfidz_surah,
        e.tahfidz_ayat,
        e.tahfidz_nilai,
        e.skor_kedisiplinan,
        e.kebersihan_kamar,
        e.catatan_perilaku,
        e.rekomendasi_ai,
        e.evaluator_id,
        u.nama_lengkap AS evaluator_nama,
        e.created_at,
        e.updated_at
      FROM evaluasi_harian e
      JOIN santri s ON e.santri_id = s.id
      LEFT JOIN users u ON e.evaluator_id = u.id
      ${whereClause}
      ORDER BY e.tanggal DESC, e.created_at DESC
      ${limitClause}
    `;

    const result = await query(sql, params);
    res.json({
      success: true,
      total: result.rowCount,
      data: result.rows
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data evaluasi santri',
      error: err.message
    });
  }
});

// -------------------------------------------------------------------------------------
// 4. GET /api/evaluasi/:santri_id: MENGAMBIL RIWAYAT EVALUASI SANTRI TERTENTU
// -------------------------------------------------------------------------------------
app.get('/api/evaluasi/:santri_id', async (req, res) => {
  try {
    const { santri_id } = req.params;
    const sql = `
      SELECT 
        e.*,
        s.nama_lengkap AS santri_nama,
        s.nis AS santri_nis,
        s.kelas AS santri_kelas,
        s.kamar AS santri_kamar,
        u.nama_lengkap AS evaluator_nama
      FROM evaluasi_harian e
      JOIN santri s ON e.santri_id = s.id
      LEFT JOIN users u ON e.evaluator_id = u.id
      WHERE e.santri_id = $1
      ORDER BY e.tanggal DESC, e.created_at DESC
    `;

    const result = await query(sql, [santri_id]);
    res.json({
      success: true,
      santri_id,
      total: result.rowCount,
      data: result.rows
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: `Gagal mengambil riwayat evaluasi santri ${req.params.santri_id}`,
      error: err.message
    });
  }
});

// -------------------------------------------------------------------------------------
// 5. POST /api/evaluasi: MENYIMPAN / MEMPERBARUI (UPSERT) DATA EVALUASI SANTRI
// -------------------------------------------------------------------------------------
app.post('/api/evaluasi', async (req, res) => {
  try {
    const {
      santri_id,
      tanggal,
      shalat_subuh = 'Berjamaah',
      shalat_dzuhur = 'Berjamaah',
      shalat_ashar = 'Berjamaah',
      shalat_maghrib = 'Berjamaah',
      shalat_isya = 'Berjamaah',
      tahfidz_surah = 'An-Naba',
      tahfidz_ayat = '1-10',
      tahfidz_nilai = 'A',
      skor_kedisiplinan = 90,
      kebersihan_kamar = 90,
      catatan_perilaku = '',
      rekomendasi_ai = '',
      evaluator_id = null
    } = req.body;

    if (!santri_id) {
      return res.status(400).json({
        success: false,
        message: 'Parameter santri_id wajib diisi!'
      });
    }

    const targetDate = tanggal || new Date().toISOString().split('T')[0];

    // Cek keberadaan santri
    const santriCheck = await query('SELECT id FROM santri WHERE id = $1', [santri_id]);
    if (santriCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Santri dengan ID '${santri_id}' tidak ditemukan di database`
      });
    }

    // Query UPSERT (Insert atau Update bila santri & tanggal sudah ada)
    const sql = `
      INSERT INTO evaluasi_harian (
        santri_id, tanggal, 
        shalat_subuh, shalat_dzuhur, shalat_ashar, shalat_maghrib, shalat_isya,
        tahfidz_surah, tahfidz_ayat, tahfidz_nilai,
        skor_kedisiplinan, kebersihan_kamar,
        catatan_perilaku, rekomendasi_ai, evaluator_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (santri_id, tanggal) 
      DO UPDATE SET
        shalat_subuh = EXCLUDED.shalat_subuh,
        shalat_dzuhur = EXCLUDED.shalat_dzuhur,
        shalat_ashar = EXCLUDED.shalat_ashar,
        shalat_maghrib = EXCLUDED.shalat_maghrib,
        shalat_isya = EXCLUDED.shalat_isya,
        tahfidz_surah = EXCLUDED.tahfidz_surah,
        tahfidz_ayat = EXCLUDED.tahfidz_ayat,
        tahfidz_nilai = EXCLUDED.tahfidz_nilai,
        skor_kedisiplinan = EXCLUDED.skor_kedisiplinan,
        kebersihan_kamar = EXCLUDED.kebersihan_kamar,
        catatan_perilaku = EXCLUDED.catatan_perilaku,
        rekomendasi_ai = EXCLUDED.rekomendasi_ai,
        evaluator_id = COALESCE(EXCLUDED.evaluator_id, evaluasi_harian.evaluator_id),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;

    const values = [
      santri_id,
      targetDate,
      shalat_subuh,
      shalat_dzuhur,
      shalat_ashar,
      shalat_maghrib,
      shalat_isya,
      tahfidz_surah,
      tahfidz_ayat,
      tahfidz_nilai,
      parseInt(skor_kedisiplinan, 10) || 90,
      parseInt(kebersihan_kamar, 10) || 90,
      catatan_perilaku,
      rekomendasi_ai,
      evaluator_id ? parseInt(evaluator_id, 10) : null
    ];

    const result = await query(sql, values);

    res.status(201).json({
      success: true,
      message: 'Evaluasi harian santri berhasil disimpan ke PostgreSQL',
      data: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal menyimpan data evaluasi santri',
      error: err.message
    });
  }
});

// -------------------------------------------------------------------------------------
// 6. DELETE /api/evaluasi/:id: MENGHAPUS REKORD EVALUASI
// -------------------------------------------------------------------------------------
app.delete('/api/evaluasi/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM evaluasi_harian WHERE id = $1 RETURNING id', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Evaluasi dengan ID ${id} tidak ditemukan`
      });
    }

    res.json({
      success: true,
      message: `Evaluasi ID ${id} berhasil dihapus`
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal menghapus evaluasi santri',
      error: err.message
    });
  }
});

// Jalankan Server Backend
app.listen(PORT, () => {
  console.log(`🚀 [Smart Riayah Backend] Server aktif di: http://localhost:${PORT}`);
  console.log(`📡 [API Endpoint] Evaluasi Santri: http://localhost:${PORT}/api/evaluasi`);
  console.log(`🩺 [API Health] Status DB: http://localhost:${PORT}/api/health`);
});
