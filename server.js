import express from 'express';
import cors from 'cors';
import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

// Konfigurasi Koneksi PostgreSQL
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
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
        const result = await pool.query('SELECT * FROM santri');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.SERVER_PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server Backend Smart Riayah berjalan di http://localhost:${PORT}`);
});