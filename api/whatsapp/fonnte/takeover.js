import { setManualTakeover, normalizePhone } from '../../../server/whatsapp-gateway/aiAutonomousResponder.js';
import { broadcastToSupabaseRealtime } from '../../../server/whatsapp-gateway/supabaseBroadcaster.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const { phone, isManual } = req.body || {};
  if (!phone) {
    return res.status(400).json({ success: false, message: 'Nomor telepon wajib disertakan' });
  }

  const clean = normalizePhone(phone);
  const active = Boolean(isManual);
  await setManualTakeover(clean, active);

  try {
    await broadcastToSupabaseRealtime('whatsapp.takeover', {
      phone: clean,
      isManual: active,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    // ignore
  }

  return res.status(200).json({
    success: true,
    phone: clean,
    isManual: active,
    message: active
      ? `Nomor ${clean} berhasil diambil alih secara manual. AI Otonom diistirahatkan.`
      : `Nomor ${clean} berhasil dikembalikan ke Mode Otonom AI.`
  });
}

