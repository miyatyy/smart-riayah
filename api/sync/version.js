import fs from 'fs';
import path from 'path';

const tmpFile = path.join('/tmp', 'smart_riayah_sync_db.json');

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    try {
      if (fs.existsSync(tmpFile)) {
        const content = fs.readFileSync(tmpFile, 'utf-8');
        const parsed = JSON.parse(content);
        return res.status(200).json({
          version: parsed.version || 0,
          timestamp: parsed.timestamp || 0
        });
      }
    } catch {}

    return res.status(200).json({ version: 0, timestamp: 0 });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
