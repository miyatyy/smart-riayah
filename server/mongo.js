import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.env.VERCEL) {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
}

const DEFAULT_LOCAL_URI = 'mongodb://127.0.0.1:27017/smart_riayah';
const DB_NAME = (process.env.MONGODB_DB_NAME || 'smart_riayah').trim();

function resolveMongoUri() {
  const envUri = (process.env.MONGODB_URI || process.env.MONGO_URL || '').trim();
  if (envUri) return envUri;
  // Di local Windows/laptop bisa otomatis coba MongoDB Compass localhost:27017
  if (!process.env.VERCEL) return DEFAULT_LOCAL_URI;
  return '';
}

function maskUri(uri) {
  if (!uri) return '';
  return uri.replace(/:([^:@/]+)@/, ':****@');
}

function detectMode(uri) {
  if (!uri) return 'NOT_CONFIGURED';
  if (uri.startsWith('mongodb+srv://') || (!uri.includes('localhost') && !uri.includes('127.0.0.1'))) {
    return 'ATLAS_CLOUD';
  }
  return 'LOCAL_COMPASS';
}

/**
 * Menghubungkan ke MongoDB dengan connection pooling aman (Serverless & Express)
 * Tidak pernah melempar unhandled error agar UI tidak pernah macet/crash.
 */
export async function getMongoConnection() {
  const uri = resolveMongoUri();
  const mode = detectMode(uri);
  const start = Date.now();

  if (!uri) {
    return {
      connected: false,
      configured: false,
      mode: 'NOT_CONFIGURED',
      db: null,
      client: null,
      dbName: DB_NAME,
      maskedUri: '',
      latencyMs: 0,
      error: 'MONGODB_URI belum disetel di Environment Variables Vercel. Silakan masukkan URI MongoDB Atlas Anda.'
    };
  }

  try {
    if (!globalThis._smartRiayahMongoClient || globalThis._smartRiayahMongoUri !== uri) {
      const client = new MongoClient(uri, {
        serverSelectionTimeoutMS: mode === 'LOCAL_COMPASS' ? 1800 : 4000,
        connectTimeoutMS: mode === 'LOCAL_COMPASS' ? 1800 : 4000,
        maxPoolSize: 10
      });

      globalThis._smartRiayahMongoUri = uri;
      globalThis._smartRiayahMongoPromise = client.connect();
      globalThis._smartRiayahMongoClient = client;
    }

    const client = await globalThis._smartRiayahMongoPromise;
    const db = client.db(DB_NAME);

    // Quick ping verification
    await db.command({ ping: 1 });

    return {
      connected: true,
      configured: true,
      mode,
      db,
      client,
      dbName: DB_NAME,
      maskedUri: maskUri(uri),
      latencyMs: Date.now() - start,
      error: null
    };
  } catch (err) {
    // Reset cached promise on failure so next request can retry
    try {
      await globalThis._smartRiayahMongoClient?.close().catch(() => {});
    } catch {}
    globalThis._smartRiayahMongoClient = null;
    globalThis._smartRiayahMongoPromise = null;

    return {
      connected: false,
      configured: true,
      mode,
      db: null,
      client: null,
      dbName: DB_NAME,
      maskedUri: maskUri(uri),
      latencyMs: Date.now() - start,
      error: err.message || 'Gagal terhubung ke MongoDB'
    };
  }
}

/**
 * Helper cepat menyimpan dokumen hasil AI ke collection MongoDB
 */
export async function saveAiDocument(collectionName = 'ai_logs', document = {}) {
  const allowedCollections = ['ai_evaluations', 'ai_chat_logs', 'ai_whatsapp_bookings', 'ai_logs'];
  const targetCollection = allowedCollections.includes(collectionName) ? collectionName : 'ai_logs';

  try {
    const conn = await getMongoConnection();
    if (!conn.connected || !conn.db) {
      return { success: false, savedToMongo: false, error: conn.error || 'MongoDB offline' };
    }

    const col = conn.db.collection(targetCollection);
    const nowIso = new Date().toISOString();
    const docId = document.id || `AI-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const payload = {
      ...document,
      id: docId,
      ai_collection: targetCollection,
      updated_at: nowIso,
      created_at: document.created_at || nowIso
    };

    await col.updateOne(
      { id: docId },
      { $set: payload },
      { upsert: true }
    );

    return { success: true, savedToMongo: true, id: docId, collection: targetCollection };
  } catch (err) {
    console.warn(`⚠️ [MongoDB Save AI Error] (${targetCollection}):`, err.message);
    return { success: false, savedToMongo: false, error: err.message };
  }
}
