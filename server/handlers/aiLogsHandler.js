import { getMongoConnection, saveAiDocument } from '../mongo.js';

const AI_COLLECTIONS = ['ai_evaluations', 'ai_chat_logs', 'ai_whatsapp_bookings', 'ai_logs'];

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

export default async function aiLogsHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    // ─── READ (GET) ──────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const { collection = 'ALL', santriId, limit = '100' } = req.query || {};
      const maxRows = Math.min(300, Math.max(1, parseInt(limit, 10) || 100));

      const mongo = await getMongoConnection();
      if (!mongo.connected || !mongo.db) {
        return res.status(200).json({
          success: true,
          mongoConnected: false,
          configured: mongo.configured,
          mode: mongo.mode,
          error: mongo.error,
          total: 0,
          counts: {
            ai_evaluations: 0,
            ai_chat_logs: 0,
            ai_whatsapp_bookings: 0,
            ai_logs: 0
          },
          data: []
        });
      }

      const targetCols = AI_COLLECTIONS.includes(collection) ? [collection] : AI_COLLECTIONS;
      const filter = {};
      if (santriId) filter.santriId = String(santriId);

      const allDocs = [];
      const counts = {};

      await Promise.all(
        AI_COLLECTIONS.map(async (colName) => {
          const col = mongo.db.collection(colName);
          counts[colName] = await col.countDocuments({}).catch(() => 0);

          if (targetCols.includes(colName)) {
            const docs = await col
              .find(filter, { projection: { _id: 0 } })
              .sort({ created_at: -1 })
              .limit(maxRows)
              .toArray();
            docs.forEach(d => allDocs.push({ ...d, ai_collection: d.ai_collection || colName }));
          }
        })
      );

      allDocs.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

      return res.status(200).json({
        success: true,
        mongoConnected: true,
        configured: true,
        mode: mongo.mode,
        dbName: mongo.dbName,
        total: allDocs.length,
        counts,
        data: allDocs.slice(0, maxRows)
      });
    }

    // ─── CREATE (POST) ───────────────────────────────────────────────────────
    if (req.method === 'POST') {
      const body = parseBody(req);
      const collectionName = AI_COLLECTIONS.includes(body.collection) ? body.collection : 'ai_logs';
      const documentPayload = body.data && typeof body.data === 'object' ? body.data : { ...body };
      delete documentPayload.collection;

      const saveRes = await saveAiDocument(collectionName, documentPayload);
      return res.status(200).json({
        success: true,
        savedToMongo: saveRes.savedToMongo,
        collection: saveRes.collection || collectionName,
        id: saveRes.id || documentPayload.id || null,
        warning: saveRes.savedToMongo ? null : saveRes.error
      });
    }

    // ─── UPDATE (PUT / PATCH) ────────────────────────────────────────────────
    if (req.method === 'PUT' || req.method === 'PATCH') {
      const body = parseBody(req);
      const id = body.id || req.query?.id;
      const collectionName = AI_COLLECTIONS.includes(body.collection) ? body.collection : 'ai_logs';

      if (!id) {
        return res.status(400).json({ success: false, message: 'ID log AI wajib disertakan untuk update.' });
      }

      const mongo = await getMongoConnection();
      if (!mongo.connected || !mongo.db) {
        return res.status(200).json({
          success: false,
          mongoConnected: false,
          message: mongo.error || 'MongoDB sedang tidak terhubung.'
        });
      }

      const updateFields = { ...body };
      delete updateFields.id;
      delete updateFields.collection;
      delete updateFields._id;
      updateFields.updated_at = new Date().toISOString();

      const col = mongo.db.collection(collectionName);
      const result = await col.findOneAndUpdate(
        { id: String(id) },
        { $set: updateFields },
        { returnDocument: 'after', projection: { _id: 0 } }
      );

      return res.status(200).json({
        success: true,
        mongoConnected: true,
        data: result?.value || result || { id, ...updateFields }
      });
    }

    // ─── DELETE ──────────────────────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const body = parseBody(req);
      const id = req.query?.id || body?.id;
      const collectionParam = req.query?.collection || body?.collection;

      if (!id) {
        return res.status(400).json({ success: false, message: 'ID dokumen wajib disertakan untuk hapus.' });
      }

      const mongo = await getMongoConnection();
      if (!mongo.connected || !mongo.db) {
        return res.status(200).json({
          success: false,
          mongoConnected: false,
          message: mongo.error || 'MongoDB sedang offline.'
        });
      }

      const colsToSearch = AI_COLLECTIONS.includes(collectionParam) ? [collectionParam] : AI_COLLECTIONS;
      let deletedCount = 0;

      for (const colName of colsToSearch) {
        const resDel = await mongo.db.collection(colName).deleteOne({ id: String(id) });
        deletedCount += resDel.deletedCount || 0;
      }

      return res.status(200).json({
        success: true,
        mongoConnected: true,
        deletedId: id,
        deletedCount
      });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
  } catch (err) {
    console.error('❌ [aiLogsHandler Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

