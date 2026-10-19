import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Muat variabel lingkungan dari root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Pool } = pg;

// Konfigurasi Pool Koneksi PostgreSQL
export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'smart_riayah_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20, // Kapasitas maksimum koneksi bersamaan
  idleTimeoutMillis: 30000, // Waktu idle sebelum koneksi ditutup
  connectionTimeoutMillis: 5000 // Batas waktu tunggu koneksi
});

// Event listener saat koneksi baru berhasil terhubung
pool.on('connect', () => {
  console.log('📦 [PostgreSQL] Terhubung ke database:', process.env.DB_NAME || 'smart_riayah_db');
});

// Event listener penanganan error tak terduga pada idle client
pool.on('error', (err) => {
  console.error('❌ [PostgreSQL Error]:', err.message);
});

/**
 * Eksekusi query parametrik dengan logging durasi
 * @param {string} text - SQL Query statement
 * @param {Array} params - Nilai parameter query ($1, $2, dst)
 */
export async function query(text, params = []) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'production') {
      console.log('⚡ [SQL Executed]', { text: text.trim().substring(0, 100), duration: `${duration}ms`, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('❌ [SQL Query Error]:', { text, error: error.message });
    throw error;
  }
}

/**
 * Uji koneksi ke PostgreSQL
 * @returns {Promise<{success: boolean, database: string, user: string, version: string, time: string} | {success: false, error: string}>}
 */
export async function testConnection() {
  try {
    const res = await pool.query('SELECT NOW() as now, current_database() as database, current_user as user, version() as version');
    return {
      success: true,
      database: res.rows[0].database,
      user: res.rows[0].user,
      version: res.rows[0].version,
      time: res.rows[0].now
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

export default {
  pool,
  query,
  testConnection
};
