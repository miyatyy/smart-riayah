import pg from 'pg';
const { Pool } = pg;

// Pool koneksi PostgreSQL (Lokal atau Cloud Supabase)
let pool;
function getPool() {
  if (!pool) {
    const isSupabase = !!process.env.DATABASE_URL;
    const poolConfig = isSupabase
      ? {
          connectionString: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false },
          max: 5,
          connectionTimeoutMillis: 5000,
        }
      : {
          host: process.env.DB_HOST || '127.0.0.1',
          port: parseInt(process.env.DB_PORT || '5432', 10),
          database: process.env.DB_NAME || 'smart_riayah_db',
          user: process.env.DB_USER || 'postgres',
          password: process.env.DB_PASSWORD || '140203',
          max: 5,
          connectionTimeoutMillis: 5000,
        };
    pool = new Pool(poolConfig);
  }
  return pool;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const p = getPool();

  if (req.method === 'GET') {
    try {
      const result = await p.query(
        'SELECT id, nama_gedung, kategori_gedung, nomor_kamar, lantai, kapasitas, terisi, ketua_kamar, skor_kerapian_terakhir, jadwal_piket_hari_ini, catatan_inspeksi, created_at, updated_at FROM rooms ORDER BY id ASC'
      );
      return res.status(200).json({
        success: true,
        total: result.rowCount,
        data: result.rows
      });
    } catch (err) {
      console.error('❌ [api/rooms GET Error]:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    try {
      const r = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      if (!r || !r.id) {
        return res.status(400).json({ success: false, message: 'ID Kamar wajib disertakan' });
      }

      const id = String(r.id);
      const namaGedung = r.namaGedung || r.nama_gedung || 'Asrama Santri';
      const kategoriGedung = r.kategoriGedung || r.kategori_gedung || 'PUTRA';
      const nomorKamar = r.nomorKamar || r.nomor_kamar || id;
      const lantai = parseInt(r.lantai || 1, 10);
      const kapasitas = parseInt(r.kapasitas || 8, 10);
      const terisi = parseInt(r.terisi !== undefined ? r.terisi : 0, 10);
      const ketuaKamar = r.ketuaKamar || r.ketua_kamar || 'Belum Ditentukan';
      const catatanInspeksi = r.catatanInspeksi || r.catatan_inspeksi || 'Kamar siap huni.';
      const skorKerapian = parseInt(r.skorKerapianTerakhir ?? r.skor_kerapian_terakhir ?? 90, 10);
      const jadwalPiket = r.jadwalPiketHariIni || r.jadwal_piket_hari_ini || 'Jadwal Reguler';

      const sqlRooms = `
        INSERT INTO rooms (
          id, nama_gedung, kategori_gedung, nomor_kamar, lantai, kapasitas, terisi, ketua_kamar, skor_kerapian_terakhir, jadwal_piket_hari_ini, catatan_inspeksi, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          nama_gedung = EXCLUDED.nama_gedung,
          kategori_gedung = EXCLUDED.kategori_gedung,
          nomor_kamar = EXCLUDED.nomor_kamar,
          lantai = EXCLUDED.lantai,
          kapasitas = EXCLUDED.kapasitas,
          terisi = EXCLUDED.terisi,
          ketua_kamar = EXCLUDED.ketua_kamar,
          catatan_inspeksi = EXCLUDED.catatan_inspeksi,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *;
      `;
      const resRooms = await p.query(sqlRooms, [
        id, namaGedung, kategoriGedung, nomorKamar, lantai, kapasitas, terisi, ketuaKamar, skorKerapian, jadwalPiket, catatanInspeksi
      ]);

      const sqlKamar = `
        UPDATE kamar SET
          nama_kamar = $1,
          asrama = $2,
          lantai = $3,
          kapasitas = $4,
          terisi = $5,
          ketua = $6,
          catatan = $7,
          updated_at = CURRENT_TIMESTAMP
        WHERE kamar_id = $8 OR id::text = $8;
      `;
      await p.query(sqlKamar, [
        nomorKamar, namaGedung, lantai, kapasitas, terisi, ketuaKamar, catatanInspeksi, id
      ]).catch(() => {});

      return res.status(200).json({
        success: true,
        message: `Kamar ${id} berhasil diperbarui di PostgreSQL`,
        data: resRooms.rows[0]
      });
    } catch (err) {
      console.error('❌ [api/rooms POST Error]:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
