import { getMongoConnection } from '../mongo.js';

export default async function mongoHealthHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const conn = await getMongoConnection();
    const counts = {
      osis_reports: 0,
      ai_evaluations: 0,
      ai_chat_logs: 0,
      ai_whatsapp_bookings: 0,
      ai_logs: 0
    };

    if (conn.connected && conn.db) {
      const colNames = Object.keys(counts);
      await Promise.all(
        colNames.map(async (name) => {
          counts[name] = await conn.db.collection(name).countDocuments({}).catch(() => 0);
        })
      );
    }

    return res.status(200).json({
      success: true,
      connected: conn.connected,
      configured: conn.configured,
      mode: conn.mode,
      dbName: conn.dbName,
      maskedUri: conn.maskedUri || null,
      latencyMs: conn.latencyMs,
      error: conn.error || null,
      counts,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(200).json({
      success: false,
      connected: false,
      configured: false,
      mode: 'ERROR',
      error: err.message,
      counts: {
        osis_reports: 0,
        ai_evaluations: 0,
        ai_chat_logs: 0,
        ai_whatsapp_bookings: 0,
        ai_logs: 0
      }
    });
  }
}

