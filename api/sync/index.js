import fs from 'fs';
import path from 'path';

// Ephemeral in-memory database fallback for serverless execution
let memoryDb = {
  version: 0,
  timestamp: 0,
  data: null
};

const tmpFile = path.join('/tmp', 'smart_riayah_sync_db.json');

function readData() {
  try {
    if (fs.existsSync(tmpFile)) {
      const content = fs.readFileSync(tmpFile, 'utf-8');
      return JSON.parse(content);
    }
  } catch {}
  return memoryDb;
}

function saveData(payload) {
  memoryDb = payload;
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(payload), 'utf-8');
  } catch {}
}

export default function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    const current = readData();
    return res.status(200).json(current || { version: 0, data: null });
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const newVersion = body.version || Date.now();
      const payload = {
        version: newVersion,
        timestamp: new Date().toISOString(),
        data: body.data || body
      };
      saveData(payload);
      return res.status(200).json({ success: true, version: newVersion });
    } catch (err) {
      return res.status(400).json({ error: err.message || 'Invalid JSON format' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
