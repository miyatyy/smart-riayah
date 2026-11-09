import { getMongoConnection } from '../../server/mongo.js';
import pg from 'pg';

const { Pool } = pg;
let pgPool = null;

function getPgPool() {
  try {
    if (!pgPool && process.env.DATABASE_URL) {
      pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 5,
        connectionTimeoutMillis: 3000
      });
      pgPool.on('error', () => {});
    }
    return pgPool;
  } catch {
    return null;
  }
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const mongo = await getMongoConnection();
  const col = mongo.connected && mongo.db ? mongo.db.collection('osis_reports') : null;
  const pgDb = getPgPool();

  try {
    // ─── READ (GET) ──────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const { status, santriId, gender, limit = '100' } = req.query || {};
      const maxRows = Math.min(500, Math.max(1, parseInt(limit, 10) || 100));

      let mongoRows = [];
      if (col) {
        const filter = {};
        if (status && status !== 'ALL') filter.status = status;
        if (santriId) filter.santriId = santriId;
        if (gender) filter.gender = gender;

        mongoRows = await col
          .find(filter, { projection: { _id: 0 } })
          .sort({ created_at: -1 })
          .limit(maxRows)
          .toArray();
      }

      let pgRows = [];
      if (pgDb) {
        try {
          const r = await pgDb.query(
            `SELECT * FROM osis_reports ORDER BY created_at DESC LIMIT $1`,
            [maxRows]
          );
          pgRows = r.rows.map(row => ({
            id: row.id,
            santriId: row.santri_id,
            santriNama: row.santri_nama,
            gender: row.gender,
            kelas: row.kelas,
            kamar: row.kamar,
            bidangOsis: row.bidang_osis,
            pelaporNama: row.pelapor_nama,
            kategori: row.kategori,
            jenis: row.jenis,
            keterangan: row.keterangan,
            poin: Number(row.poin || 0),
            tazir: row.tazir || '',
            status: row.status || 'PENDING_ADMIN',
            adminNote: row.admin_note || '',
            verified_by: row.verified_by || '',
            verified_at: row.verified_at || null,
            tanggal: row.tanggal || '',
            waktu: row.waktu || '',
            created_at: row.created_at,
            updated_at: row.updated_at
          }));
        } catch {
          // Table osis_reports in Postgres might not exist yet; Supabase JS handles messages fallback
        }
      }

      // Merge deduplicated rows (Mongo prioritized if present, else PG)
      const map = new Map();
      pgRows.forEach(item => map.set(item.id, item));
      mongoRows.forEach(item => map.set(item.id, item));
      const combined = Array.from(map.values()).sort(
        (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
      );

      return res.status(200).json({
        success: true,
        source: col ? 'mongodb' : (pgRows.length > 0 ? 'postgresql' : 'fallback'),
        mongoConnected: mongo.connected,
        total: combined.length,
        data: combined
      });
    }

    // ─── CREATE (POST) ───────────────────────────────────────────────────────
    if (req.method === 'POST') {
      const body = parseBody(req);
      if (!body.santriId || !body.jenis) {
        return res.status(400).json({ success: false, message: 'santriId dan jenis wajib diisi.' });
      }

      const nowIso = new Date().toISOString();
      const doc = {
        id: body.id || `OSIS-${Date.now().toString().slice(-6)}`,
        santriId: String(body.santriId),
        santriNama: body.santriNama || '',
        gender: body.gender || 'L',
        kelas: body.kelas || '',
        kamar: body.kamar || '',
        bidangOsis: body.bidangOsis || 'OSIS Kamtib',
        pelaporNama: body.pelaporNama || 'Pengurus OSIS',
        kategori: body.kategori || 'PELANGGARAN',
        jenis: body.jenis,
        keterangan: body.keterangan || '',
        poin: Number(body.poin || 0),
        tazir: body.tazir || '',
        status: body.status || 'PENDING_ADMIN',
        adminNote: body.adminNote || '',
        verified_by: body.verified_by || null,
        verified_at: body.verified_at || null,
        tanggal: body.tanggal || nowIso.slice(0, 10),
        waktu: body.waktu || nowIso.slice(11, 16),
        created_at: body.created_at || nowIso,
        updated_at: nowIso
      };

      let savedMongo = false;
      if (col) {
        await col.updateOne({ id: doc.id }, { $set: doc }, { upsert: true });
        savedMongo = true;
      }

      let savedPg = false;
      if (pgDb) {
        try {
          await pgDb.query(
            `INSERT INTO osis_reports (
              id, santri_id, santri_nama, gender, kelas, kamar, bidang_osis, pelapor_nama,
              kategori, jenis, keterangan, poin, tazir, status, admin_note, verified_by, verified_at,
              tanggal, waktu, created_at, updated_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
            ON CONFLICT (id) DO UPDATE SET
              kategori=EXCLUDED.kategori, jenis=EXCLUDED.jenis, keterangan=EXCLUDED.keterangan,
              poin=EXCLUDED.poin, tazir=EXCLUDED.tazir, status=EXCLUDED.status,
              admin_note=EXCLUDED.admin_note, verified_by=EXCLUDED.verified_by,
              verified_at=EXCLUDED.verified_at, updated_at=EXCLUDED.updated_at`,
            [
              doc.id, doc.santriId, doc.santriNama, doc.gender, doc.kelas, doc.kamar,
              doc.bidangOsis, doc.pelaporNama, doc.kategori, doc.jenis, doc.keterangan,
              doc.poin, doc.tazir, doc.status, doc.adminNote, doc.verified_by,
              doc.verified_at, doc.tanggal, doc.waktu, doc.created_at, doc.updated_at
            ]
          );
          savedPg = true;
        } catch {
          // Table might not exist in PostgreSQL yet
        }
      }

      return res.status(201).json({
        success: true,
        message: 'Laporan OSIS berhasil dibuat dan disimpan.',
        savedMongo,
        savedPg,
        data: doc
      });
    }

    // ─── UPDATE (PUT / PATCH) ────────────────────────────────────────────────
    if (req.method === 'PUT' || req.method === 'PATCH') {
      const body = parseBody(req);
      const id = body.id || req.query?.id;
      if (!id) {
        return res.status(400).json({ success: false, message: 'ID laporan wajib disertakan untuk update.' });
      }

      const nowIso = new Date().toISOString();
      const updateFields = { updated_at: nowIso };
      const allowedKeys = [
        'santriId', 'santriNama', 'gender', 'kelas', 'kamar', 'bidangOsis',
        'pelaporNama', 'kategori', 'jenis', 'keterangan', 'poin', 'tazir',
        'status', 'adminNote', 'verified_by', 'verified_at', 'tanggal', 'waktu'
      ];

      for (const k of allowedKeys) {
        if (body[k] !== undefined) {
          updateFields[k] = k === 'poin' ? Number(body[k]) : body[k];
        }
      }

      let updatedMongo = false;
      let updatedDoc = null;
      if (col) {
        const resMongo = await col.findOneAndUpdate(
          { id: String(id) },
          {
            $set: updateFields,
            $setOnInsert: { id: String(id), created_at: body.created_at || nowIso }
          },
          { returnDocument: 'after', upsert: true, projection: { _id: 0 } }
        );
        updatedDoc = resMongo?.value || resMongo;
        updatedMongo = true;
      }

      let updatedPg = false;
      if (pgDb) {
        try {
          await pgDb.query(
            `UPDATE osis_reports SET
              bidang_osis = COALESCE($2, bidang_osis),
              kategori = COALESCE($3, kategori),
              jenis = COALESCE($4, jenis),
              keterangan = COALESCE($5, keterangan),
              poin = COALESCE($6, poin),
              tazir = COALESCE($7, tazir),
              status = COALESCE($8, status),
              admin_note = COALESCE($9, admin_note),
              verified_by = COALESCE($10, verified_by),
              verified_at = COALESCE($11, verified_at),
              updated_at = $12
            WHERE id = $1`,
            [
              String(id),
              updateFields.bidangOsis ?? null,
              updateFields.kategori ?? null,
              updateFields.jenis ?? null,
              updateFields.keterangan ?? null,
              updateFields.poin !== undefined ? updateFields.poin : null,
              updateFields.tazir ?? null,
              updateFields.status ?? null,
              updateFields.adminNote ?? null,
              updateFields.verified_by ?? null,
              updateFields.verified_at ?? null,
              nowIso
            ]
          );
          updatedPg = true;
        } catch {}
      }

      return res.status(200).json({
        success: true,
        message: `Laporan OSIS [${id}] berhasil diperbarui.`,
        updatedMongo,
        updatedPg,
        data: updatedDoc || { id, ...updateFields }
      });
    }

    // ─── DELETE ──────────────────────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const body = parseBody(req);
      const id = req.query?.id || body?.id;
      if (!id) {
        return res.status(400).json({ success: false, message: 'ID laporan wajib disertakan untuk hapus.' });
      }

      let deletedMongo = false;
      if (col) {
        await col.deleteOne({ id: String(id) });
        deletedMongo = true;
      }

      let deletedPg = false;
      if (pgDb) {
        try {
          await pgDb.query('DELETE FROM osis_reports WHERE id = $1', [String(id)]);
          deletedPg = true;
        } catch {}
      }

      return res.status(200).json({
        success: true,
        message: `Laporan OSIS [${id}] berhasil dihapus dari database.`,
        deletedId: id,
        deletedMongo,
        deletedPg
      });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
  } catch (err) {
    console.error('❌ [/api/osis/reports Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
