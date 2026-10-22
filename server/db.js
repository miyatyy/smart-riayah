import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Muat variabel lingkungan dari root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Pool } = pg;

// ─── Deteksi Supabase vs PostgreSQL Lokal ─────────────────────────────────────
// Jika DATABASE_URL tersedia (Railway/Supabase), gunakan itu
// Jika tidak, fallback ke variabel DB_* individual
const isSupabase = !!process.env.DATABASE_URL;

const poolConfig = isSupabase
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // Wajib untuk Supabase/Railway
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'smart_riayah_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

export const pool = new Pool(poolConfig);

pool.on('connect', () => {
  const dbLabel = isSupabase ? 'Supabase PostgreSQL' : (process.env.DB_NAME || 'smart_riayah_db');
  console.log(`📦 [Database] Terhubung ke: ${dbLabel}`);
});

pool.on('error', (err) => {
  console.error('❌ [Database Error]:', err.message);
});

/**
 * Eksekusi query parametrik dengan logging durasi
 */
export async function query(text, params = []) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'production') {
      console.log('⚡ [SQL]', { q: text.trim().substring(0, 80), ms: duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('❌ [SQL Error]:', { text: text.substring(0, 80), error: error.message });
    throw error;
  }
}

/**
 * Uji koneksi ke database
 */
export async function testConnection() {
  try {
    const res = await pool.query(
      'SELECT NOW() as now, current_database() as database, current_user as "user", version() as version'
    );
    return {
      success: true,
      type: isSupabase ? 'supabase' : 'local_postgres',
      database: res.rows[0].database,
      user: res.rows[0].user,
      version: res.rows[0].version?.split(' ').slice(0, 2).join(' '),
      time: res.rows[0].now,
    };
  } catch (error) {
    return {
      success: false,
      type: isSupabase ? 'supabase' : 'local_postgres',
      error: error.message,
    };
  }
}

export default { pool, query, testConnection };
