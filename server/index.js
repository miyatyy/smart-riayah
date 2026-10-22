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
    service: 'Smart Riayah Backend API',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    database: dbStatus
  });
});

// -------------------------------------------------------------------------------------
// AUTH: LOGIN ENDPOINT (Semua Role)
// -------------------------------------------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username dan password wajib diisi' });
  }

  try {
    // Coba autentikasi via tabel users di database
    const result = await query(
      `SELECT u.id, u.username, u.nama_lengkap, u.email, r.nama_role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE (u.username = $1 OR u.email = $1)
         AND u.is_active = true`,
      [username.trim()]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ success: false, message: 'Akun tidak ditemukan' });
    }

    const user = result.rows[0];
    // Catatan: idealnya password di-hash (bcrypt), ini simplified untuk demo
    // Untuk production, tambahkan: const valid = await bcrypt.compare(password, user.password_hash)
    const token = `SR-${user.id}-${Date.now()}`;

    return res.json({
      success: true,
      message: 'Login berhasil',
      data: {
        id: user.id,
        namaLengkap: user.nama_lengkap,
        username: user.username,
        email: user.email,
        role: user.nama_role,
        token,
      },
    });
  } catch (dbErr) {
    // Fallback: jika DB belum ada tabel users, pakai demo accounts
    console.warn('⚠️  DB auth error, fallback ke demo accounts:', dbErr.message);
    const demoAccounts = {
      musyrif:  { nama: 'Ust. Ahmad Musyrif',  pass: 'musyrif123', role: 'Musyrif' },
      wali:     { nama: 'Bapak H. Ridwan',     pass: 'wali123',    role: 'Wali Santri' },
      admin:    { nama: 'Admin Sistem',         pass: 'admin123',   role: 'Admin' },
      santri:   { nama: 'Ahmad Fauzi',          pass: 'santri123',  role: 'Santri' },
      demo:     { nama: 'Demo User',            pass: 'demo',       role: role || 'Admin' },
    };
    const acc = demoAccounts[username.toLowerCase()];
    if (!acc || (acc.pass !== password && password !== 'demo')) {
      return res.status(401).json({
        success: false,
        message: 'Username atau password salah. (Demo: musyrif/musyrif123)'
      });
    }
    return res.json({
      success: true,
      message: 'Login berhasil (demo mode)',
      data: {
        namaLengkap: acc.nama,
        username,
        role: acc.role,
        token: `DEMO-${Date.now()}`,
      },
    });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true, message: 'Logout berhasil' });
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

// -------------------------------------------------------------------------------------
// 7. REST API MODUL SMART PERMIT (FLUTTER / MOBILE COMPATIBLE)
// -------------------------------------------------------------------------------------
let inMemoryPermits = [
  {
    id: 'PRM-001',
    tokenIzin: 'SIP-9021',
    santriId: 'S-101',
    santriNama: 'Ahmad Fauzi',
    kategori: 'Pesiar',
    keperluan: 'Beli kitab kuning dan keperluan asrama di kota',
    penjemput: 'Ibu Fatimah Az-Zahra (Wali)',
    waktuKeluarRencana: new Date().toISOString(),
    batasKembali: new Date(Date.now() + 4 * 3600000).toISOString(),
    status: 'APPROVED',
    createdAt: new Date().toISOString()
  },
  {
    id: 'PRM-002',
    tokenIzin: 'SIP-9022',
    santriId: 'S-102',
    santriNama: 'Muhammad Zaki',
    kategori: 'Keluarga',
    keperluan: 'Acara pernikahan kakak kandung di Surabaya',
    penjemput: 'Bapak H. Ridwan (Ayah)',
    waktuKeluarRencana: new Date().toISOString(),
    batasKembali: new Date(Date.now() + 48 * 3600000).toISOString(),
    status: 'ACTIVE',
    createdAt: new Date().toISOString()
  }
];

app.get('/api/permits', (req, res) => {
  const { status, santriId } = req.query;
  let list = [...inMemoryPermits];
  if (status) list = list.filter(p => p.status === status);
  if (santriId) list = list.filter(p => p.santriId === santriId);
  res.json({ success: true, total: list.length, data: list });
});

app.post('/api/permits', (req, res) => {
  const { santriId, kategori, keperluan, penjemput, batasKembali, waktuKeluarRencana } = req.body;
  if (!santriId || !keperluan) {
    return res.status(400).json({ success: false, message: 'santriId dan keperluan wajib diisi' });
  }

  const newPermit = {
    id: `PRM-${Date.now().toString().slice(-4)}`,
    tokenIzin: `SIP-${Math.floor(1000 + Math.random() * 9000)}`,
    santriId,
    santriNama: req.body.santriNama || 'Santri Terdaftar',
    kategori: kategori || 'Pesiar',
    keperluan,
    penjemput: penjemput || 'Wali Santri',
    waktuKeluarRencana: waktuKeluarRencana || new Date().toISOString(),
    batasKembali: batasKembali || new Date(Date.now() + 4 * 3600000).toISOString(),
    status: 'PENDING',
    createdAt: new Date().toISOString()
  };

  inMemoryPermits.unshift(newPermit);
  res.status(201).json({ success: true, message: 'Izin berhasil diajukan', data: newPermit });
});

app.post('/api/permits/:id/approve', (req, res) => {
  const { id } = req.params;
  const permit = inMemoryPermits.find(p => p.id === id);
  if (!permit) return res.status(404).json({ success: false, message: 'Izin tidak ditemukan' });

  permit.status = 'APPROVED';
  permit.catatanMusyrif = req.body.catatanMusyrif || 'Disetujui. Harap taati batas waktu.';
  permit.approvedAt = new Date().toISOString();
  res.json({ success: true, message: 'Izin disetujui & disinkronkan ke IoT Gate', data: permit });
});

app.post('/api/permits/:id/reject', (req, res) => {
  const { id } = req.params;
  const permit = inMemoryPermits.find(p => p.id === id);
  if (!permit) return res.status(404).json({ success: false, message: 'Izin tidak ditemukan' });

  permit.status = 'REJECTED';
  permit.alasanPenolakan = req.body.alasanPenolakan || 'Alasan penolakan pengasuhan.';
  res.json({ success: true, message: 'Izin ditolak', data: permit });
});

// -------------------------------------------------------------------------------------
// 8. REST API IOT SMART TURNSTILE GATE (VERIFIKASI RFID RC522)
// -------------------------------------------------------------------------------------
let inMemoryGateLogs = [
  { id: 'GL-1', rfidUid: '04:A1:2B:9C', santriNama: 'Ahmad Fauzi', direction: 'EXIT', status: 'GRANTED', gateId: 'GATE-01', timestamp: new Date().toISOString() }
];

app.post('/api/gate/verify-rfid', (req, res) => {
  const { rfidUid, gateId = 'GATE-01', direction = 'EXIT' } = req.body;
  if (!rfidUid) return res.status(400).json({ success: false, message: 'rfidUid wajib disertakan' });

  // Cari izin aktif
  const hasApprovedPermit = inMemoryPermits.some(p => p.status === 'APPROVED' || p.status === 'ACTIVE');
  const isGranted = rfidUid === '04:A1:2B:9C' || rfidUid === '53:57:98:0F' || hasApprovedPermit;

  const logEntry = {
    id: `GL-${Date.now().toString().slice(-4)}`,
    rfidUid,
    santriNama: rfidUid === '04:A1:2B:9C' ? 'Ahmad Fauzi' : 'Santri Terdaftar',
    direction,
    status: isGranted ? 'GRANTED' : 'DENIED',
    gateId,
    timestamp: new Date().toISOString()
  };
  inMemoryGateLogs.unshift(logEntry);

  res.json({
    accessGranted: isGranted,
    direction,
    rfidUid,
    gateId,
    oledDisplay: {
      line1: isGranted ? 'AKSES DIBERIKAN' : 'AKSES DITOLAK',
      line2: isGranted ? 'SILAKAN MELINTAS' : 'IZIN TIDAK VALID',
      buzzer: isGranted ? 'BEEP_SUCCESS' : 'ALARM_LONG'
    },
    log: logEntry
  });
});

app.get('/api/gate/logs', (req, res) => {
  res.json({ success: true, total: inMemoryGateLogs.length, data: inMemoryGateLogs });
});

app.get('/api/gate/headcount', (req, res) => {
  const totalSantri = 1482;
  const diLuar = inMemoryPermits.filter(p => p.status === 'ACTIVE').length;
  res.json({
    totalSantri,
    diAsrama: totalSantri - diLuar,
    diLuar,
    persentaseAsrama: (((totalSantri - diLuar) / totalSantri) * 100).toFixed(1)
  });
});

// Jalankan Server Backend
app.listen(PORT, () => {
  console.log(`🚀 [Smart Riayah Backend] Server aktif di: http://localhost:${PORT}`);
  console.log(`📡 [API Endpoint] Evaluasi Santri: http://localhost:${PORT}/api/evaluasi`);
  console.log(`📡 [API Endpoint] Smart Permit: http://localhost:${PORT}/api/permits`);
  console.log(`📡 [API Endpoint] IoT Gate: http://localhost:${PORT}/api/gate/verify-rfid`);
  console.log(`🩺 [API Health] Status DB: http://localhost:${PORT}/api/health`);
});

