/**
 * Vercel Serverless Function: /api/whatsapp/webhook
 * Menerima incoming webhook dari Fonnte WhatsApp Gateway dan membalas secara Otonom (Autonomous AI)
 */

import { generateAutonomousReply, sendFonnteAutoReply, normalizePhone } from '../../server/whatsapp-gateway/aiAutonomousResponder.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'active',
      service: 'Smart Riayah Autonomous WhatsApp AI Webhook',
      timestamp: new Date().toISOString()
    });
  }

  const payload = req.body || {};
  console.log('📥 [Vercel WhatsApp Webhook]:', payload);

  try {
    // 1. Deteksi Delivery Report / Status DLR
    if (payload.status || payload.state) {
      return res.status(200).json({
        success: true,
        type: 'status_update',
        status: payload.status || payload.state
      });
    }

    // 2. Deteksi Pesan Masuk (Incoming Message dari Wali)
    const incomingText = payload.message || payload.text;
    const sender = payload.sender || payload.phone || payload.target;
    const senderName = payload.name || 'Wali Santri';

    if (incomingText && sender) {
      const cleanSender = normalizePhone(sender);

      // JALANKAN OTAK AI OTONOM
      const aiReply = await generateAutonomousReply(cleanSender, incomingText, senderName);

      // Kirim balasan aktif ke Fonnte API secara langsung
      await sendFonnteAutoReply(cleanSender, aiReply);

      // Kembalikan response JSON ke Fonnte (Fonnte webhook format)
      return res.status(200).json({
        success: true,
        type: 'autonomous_reply',
        sender: cleanSender,
        incoming: incomingText,
        reply: aiReply,
        read: true
      });
    }

    return res.status(200).json({ success: true, message: 'Webhook received' });
  } catch (error) {
    console.error('❌ [Vercel Webhook Error]:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
